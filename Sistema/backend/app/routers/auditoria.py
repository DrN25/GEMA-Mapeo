import os
import io
import json
import shutil
import math
import openpyxl
import gc
import time
import traceback
from datetime import datetime
from collections import Counter, defaultdict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import BarChart, Reference
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.cell_range import CellRange

from typing import Optional
from app import models
from app.auth.dependencies import get_optional_current_user
from app.database import get_db
from app.utils.validator import validate_bulk_excel, AuditCancelledError
from app.core.catalogs import MANDATORY_COLS_COUNT

router = APIRouter()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
uploads_dir = os.path.join(BASE_DIR, "uploads")

# --- SISTEMA CENTRALIZADO (SSOT) DE REGLAS DE VALIDACIÓN GEOMECÁNICA ---
from app.core.rules import RULES_REGISTRY, CATEGORIES_REGISTRY, get_rules_catalog_data
from app.core.audit_helpers import (
    safe_int,
    safe_float,
    get_safe_sheet_name,
    safe_replace,
    get_incidence_category_name,
    aggregate_audit_metrics,
)
from app.core.excel_styles import (
    get_styles,
    make_wo_cell,
    wb_to_temp_file_response,
)

def generar_excel_reporte_core(diag: dict, compact: dict, filtered: list, es_admin: bool = False):
    s = get_styles()

    def _resolve_msg(item: dict) -> str:
        if es_admin:
            return item.get("mensaje", "")
        if item.get("mensaje_no_admin"):
            return item.get("mensaje_no_admin")
        rule_code = item.get("rule_code")
        if rule_code and rule_code in RULES_REGISTRY:
            rule = RULES_REGISTRY[rule_code]
            if rule.recommendation_template:
                return rule.observation_template
        return item.get("mensaje", "")

    def _resolve_cat_name(inc: dict) -> str:
        rule_code = inc.get("rule_code")
        if rule_code and rule_code in RULES_REGISTRY:
            cat_code = RULES_REGISTRY[rule_code].category_code
            cat = CATEGORIES_REGISTRY.get(cat_code)
            if cat:
                return cat.get_name(es_admin)
        cat_name = get_incidence_category_name(inc)
        if not es_admin and ". Debe ser " in cat_name:
            cat_name = cat_name.split(". Debe ser ")[0].strip() + "."
        return cat_name

    font_title = s["font_title"]
    font_subtitle = s["font_subtitle"]
    font_section = s["font_section"]
    font_header = s["font_header"]
    font_bold = s["font_bold"]
    font_regular = s["font_regular"]
    font_kpi_lbl = s["font_kpi_lbl"]

    font_kpi_val_blue = s["font_kpi_blue"]
    font_kpi_val_green = s["font_kpi_green"]
    font_kpi_val_red = s["font_kpi_red"]
    font_kpi_val_orange = s["font_kpi_orange"]

    font_link = s["font_link"]
    font_muted = Font(name="Segoe UI", size=9, color="AAAAAA")
    font_clean = Font(name="Segoe UI", size=9, italic=True, color="7F8C8D")
    font_err_banner = Font(name="Segoe UI", size=11, bold=True, color="7F1D1D")

    fill_primary = s["fill_primary"]
    fill_accent_green = s["fill_green"]
    fill_accent_yellow = s["fill_yellow"]
    fill_accent_orange = s["fill_orange"]
    fill_accent_red = s["fill_red"]
    fill_zebra = s["fill_zebra"]
    fill_kpi_gray = s["fill_kpi_gray"]

    border_thin = s["border_thin"]
    border_kpi = s["border_kpi"]

    alignment_center = s["align_center"]
    alignment_left = s["align_left"]
    alignment_right = s["align_right"]

    err_widths = {1: 3, 2: 11, 3: 14, 4: 14, 5: 20, 6: 9, 7: 16, 8: 16, 9: 24, 10: 12, 11: 60}

    def _compute_sample_widths(sample_rows: list) -> dict:
        col_vals = defaultdict(list)
        for row in sample_rows:
            for col_idx, cell in enumerate(row, start=1):
                if col_idx < 2 or cell is None:
                    continue
                val = cell.value if hasattr(cell, "value") else cell
                if val is not None:
                    val_str = str(val)
                    col_vals[col_idx].append("Ver Registros" if val_str.startswith("=HYPERLINK") else val_str)
        return {
            col_idx: min(max(max(len(v) for v in vals) + 4, 11), 52)
            for col_idx, vals in col_vals.items()
            if vals
        }

    wb = openpyxl.Workbook(write_only=True)

    # --- HOJA 1: DASHBOARD EJECUTIVO ---
    ws_dash = wb.create_sheet(title="📊 Dashboard Ejecutivo")
    ws_dash.views.sheetView[0].showGridLines = True
    for ci, w in err_widths.items():
        ws_dash.column_dimensions[get_column_letter(ci)].width = w

    # Grid en memoria solo para las ~70 filas del Dashboard (evita acceso aleatorio en write_only)
    dash_grid = defaultdict(dict)

    def d_cell(r, c, val=None, font=None, fill=None, border=None, alignment=None, num_fmt=None):
        cell = dash_grid[r].get(c)
        if cell is None:
            cell = make_wo_cell(ws_dash, val, font=font, fill=fill, border=border, alignment=alignment, num_fmt=num_fmt)
            dash_grid[r][c] = cell
        else:
            if val is not None:
                cell.value = val
            if font is not None:
                cell.font = font
            if fill is not None:
                cell.fill = fill
            if border is not None:
                cell.border = border
            if alignment is not None:
                cell.alignment = alignment
            if num_fmt is not None:
                cell.number_format = num_fmt
        return cell

    def d_kpi(start_row, start_col, label, value, bg_fill, val_font):
        ws_dash.merged_cells.ranges.add(CellRange(min_col=start_col, min_row=start_row, max_col=start_col + 1, max_row=start_row))
        ws_dash.merged_cells.ranges.add(CellRange(min_col=start_col, min_row=start_row + 1, max_col=start_col + 1, max_row=start_row + 1))
        d_cell(start_row, start_col, label, font=font_kpi_lbl, alignment=alignment_center, fill=bg_fill, border=border_kpi)
        d_cell(start_row, start_col + 1, None, fill=bg_fill, border=border_kpi)
        d_cell(start_row + 1, start_col, value, font=val_font, alignment=alignment_center, fill=bg_fill, border=border_kpi)
        d_cell(start_row + 1, start_col + 1, None, fill=bg_fill, border=border_kpi)

    proj_name = str(compact.get("proyecto") or diag.get("proyecto") or "Ferrobamba").upper()
    d_cell(2, 2, "SISTEMA DE REVISIÓN GEOTÉCNICA", font=font_title)
    d_cell(3, 2, f"Dashboard de Control de Calidad y Consistencia de Mapeo Geomecánico | PROYECTO: {proj_name}", font=font_subtitle)

    total_filas = compact.get("familia1", {}).get("total_discontinuidades", 0)
    total_fields = compact.get("familia2", {}).get("total_fields", 0)
    total_vacios = sum(1 for i in filtered if i.get("tipo_incidencia") == "VACIO")
    total_advertencias = sum(1 for i in filtered if i.get("tipo_incidencia") == "ADVERTENCIA")
    total_alertas = sum(1 for i in filtered if i.get("tipo_incidencia") == "ALERTA")
    total_correctos = total_fields - (total_vacios + total_advertencias + total_alertas)
    pct_integridad = (total_correctos / max(1, total_fields)) * 100

    d_kpi(5, 2, "ESTACIONES EVALUADAS", len(compact.get("resumen_por_celda_padre", {})), fill_kpi_gray, font_kpi_val_blue)
    d_kpi(5, 4, "ESTRUCTURAS REGISTRADAS", total_filas, fill_kpi_gray, font_kpi_val_blue)
    d_kpi(5, 6, "INTEGRIDAD GLOBAL", f"{pct_integridad:.2f}%", fill_accent_green, font_kpi_val_green)
    d_kpi(5, 8, "ALERTAS CRÍTICAS", total_alertas, fill_accent_red, font_kpi_val_red)
    d_kpi(5, 10, "ADVERTENCIAS", total_advertencias, fill_accent_orange, font_kpi_val_orange)

    # Tabla: Distribución por Campaña
    d_cell(9, 2, "DESEMPEÑO DE CONTROL POR CAMPAÑA", font=font_section)
    headers_camp = ["Campaña", "Estructuras", "Celdas Afectadas", "Estructuras Afectadas", "Alertas (N)", "% Alertas", "Vacíos (N)", "% Vacíos"]
    for idx, col in enumerate(headers_camp, start=2):
        d_cell(10, idx, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin)

    r_camp = 11
    for row in compact.get("distribucion_campania", []):
        rf = fill_zebra if r_camp % 2 == 0 else None
        d_cell(r_camp, 2, row.get("campania"), font=font_bold, alignment=alignment_center, border=border_thin, fill=rf)
        d_cell(r_camp, 3, safe_int(row.get("discontinuidades")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(r_camp, 4, safe_int(row.get("celdas_afectadas")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(r_camp, 5, safe_int(row.get("estructuras_afectadas")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(r_camp, 6, safe_int(row.get("alertas_cant")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(r_camp, 7, safe_float(row.get("alertas_pct")) / 100.0, alignment=alignment_right, num_fmt='0.00%', border=border_thin, fill=rf)
        d_cell(r_camp, 8, safe_int(row.get("vacios_cant")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(r_camp, 9, safe_float(row.get("vacios_pct")) / 100.0, alignment=alignment_right, num_fmt='0.00%', border=border_thin, fill=rf)
        r_camp += 1

    # Tabla: Distribución por Sectores
    r_sect = r_camp + 2
    d_cell(r_sect, 2, "DISTRIBUCIÓN POR SECTOR GEOTÉCNICO", font=font_section)
    r_sect += 1
    headers_sect = ["Sector", "Estructuras", "Alertas (N)", "% Alertas", "Vacíos (N)", "% Vacíos"]
    for idx, col in enumerate(headers_sect, start=2):
        d_cell(r_sect, idx, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin)

    for row in compact.get("distribucion_sector", []):
        r_sect += 1
        rf = fill_zebra if r_sect % 2 == 0 else None
        d_cell(r_sect, 2, row.get("sector"), font=font_bold, alignment=alignment_center, border=border_thin, fill=rf)
        d_cell(r_sect, 3, safe_int(row.get("discontinuidades")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(r_sect, 4, safe_int(row.get("alertas_cant")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(r_sect, 5, safe_float(row.get("alertas_pct")) / 100.0, alignment=alignment_right, num_fmt='0.00%', border=border_thin, fill=rf)
        d_cell(r_sect, 6, safe_int(row.get("vacios_cant")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(r_sect, 7, safe_float(row.get("vacios_pct")) / 100.0, alignment=alignment_right, num_fmt='0.00%', border=border_thin, fill=rf)
        r_sect += 1

    # Tabla: Distribución de Celdas más Afectadas
    r_worst = r_sect + 2
    d_cell(r_worst - 1, 2, "TOP 5 ESTACIONES CON MAYOR INCIDENCIA", font=font_section)
    headers_worst = ["Estación (Celda)", "Total Estructuras", "Vacíos", "Advertencias", "Alertas", "Calificación"]
    for idx, col in enumerate(headers_worst, start=2):
        d_cell(r_worst, idx, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin)

    for row in compact.get("worst_cells", [])[:5]:
        r_worst += 1
        rf = fill_zebra if r_worst % 2 == 0 else None
        d_cell(r_worst, 2, row.get("celda"), font=font_bold, alignment=alignment_center, border=border_thin, fill=rf)
        d_cell(r_worst, 3, safe_int(row.get("total_hijas")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(r_worst, 4, safe_int(row.get("vacios")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(r_worst, 5, safe_int(row.get("advertencias")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(r_worst, 6, safe_int(row.get("alertas")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        status = row.get("estado_celda", "OK")
        st_fill = fill_accent_red if status == "ALERTA" else (fill_accent_orange if status == "ADVERTENCIA" else fill_accent_green)
        d_cell(r_worst, 7, status, font=font_bold, alignment=alignment_center, border=border_thin, fill=(rf if rf else st_fill))

    # Tabla para Gráfica Directa: Top 5 Alertas Críticas
    d_cell(9, 9, "PRINCIPALES DESVIACIONES CRÍTICAS", font=font_section)
    for idx, col in enumerate(["Error Geotécnico", "Frecuencia"], start=9):
        d_cell(10, idx, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin)

    top_errs_list = Counter(_resolve_cat_name(i) for i in filtered if i.get("tipo_incidencia") == "ALERTA").most_common(5)
    r_graph = 11
    for msg, qty in top_errs_list:
        d_cell(r_graph, 9, msg, font=font_regular, border=border_thin)
        d_cell(r_graph, 10, qty, font=font_bold, alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=fill_accent_red)
        r_graph += 1

    for dummy in range(r_graph, 16):
        d_cell(dummy, 9, "—", font=font_regular, border=border_thin)
        d_cell(dummy, 10, 0, font=font_regular, border=border_thin, num_fmt='#,##0')

    max_d_row = max(dash_grid.keys()) if dash_grid else 16
    for r in range(1, max_d_row + 1):
        cols_dict = dash_grid.get(r)
        if not cols_dict:
            ws_dash.append([])
        else:
            max_c = max(cols_dict.keys())
            ws_dash.append([cols_dict.get(c) for c in range(1, max_c + 1)])
    dash_grid.clear()

    chart = BarChart()
    chart.type = "col"
    chart.style = 10
    chart.title = "Frecuencia de Desviaciones Críticas Detectadas"
    chart.y_axis.title = "Cantidad de Ocurrencias"
    chart.x_axis.title = "Regla de Consistencia"

    chart_data = Reference(ws_dash, min_col=10, min_row=10, max_row=15)
    chart_cats = Reference(ws_dash, min_col=9, min_row=11, max_row=15)
    chart.add_data(chart_data, titles_from_data=True)
    chart.set_categories(chart_cats)
    chart.legend = None
    chart.width = 15
    chart.height = 11
    ws_dash.add_chart(chart, "I17")

    # --- HOJA 2: REGISTRO MAESTRO DE ERRORES (CATÁLOGO / ÍNDICE) ---
    ws_cat = wb.create_sheet(title="❌ Catálogo de Errores")
    ws_cat.views.sheetView[0].showGridLines = True

    all_campaigns = sorted(set(
        [str(row.get("campania")) for row in compact.get("distribucion_campania", []) if row.get("campania") and str(row.get("campania")) not in ["N/A", "None", ""]] +
        [str(inc.get("campania")) for inc in filtered if inc.get("campania") and str(inc.get("campania")) not in ["N/A", "None", ""]]
    ), key=lambda x: str(x))

    headers_cat = ["ID", "Gravedad", "Regla de Consistencia Evaluada", "Total (N)"] + [f"Año {c}" for c in all_campaigns] + ["Enlace Directo"]

    incidencias_por_error = defaultdict(list)
    for inc in filtered:
        incidencias_por_error[_resolve_cat_name(inc)].append(inc)

    catalog_frequencies = []
    for cat in CATEGORIES_REGISTRY.values():
        rule_msg = cat.get_name(es_admin)
        matches = incidencias_por_error[rule_msg]
        camp_counts = {c: sum(1 for m in matches if str(m.get("campania", "N/A")) == c) for c in all_campaigns}
        catalog_frequencies.append({
            "msg": rule_msg,
            "severity": cat.severity,
            "matches": matches,
            "count": len(matches),
            "camp_counts": camp_counts,
        })
    catalog_frequencies.sort(key=lambda x: x["count"], reverse=True)

    cat_rows = [
        [],
        [None, make_wo_cell(ws_cat, "REGISTRO MAESTRO DE REGLAS DE CONSISTENCIA", font=font_title)],
        [None, make_wo_cell(ws_cat, "Catálogo completo de validación geomecánica ordenado por frecuencia. Use los hipervínculos para navegar.", font=font_subtitle)],
        [],
        [None] + [make_wo_cell(ws_cat, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin) for col in headers_cat],
    ]

    r_cat = 6
    active_sheets_mapping = {}
    for c_idx, rule in enumerate(catalog_frequencies, start=1):
        sev_fill = fill_accent_red if rule["severity"] == "ALERTA" else (fill_accent_orange if rule["severity"] == "ADVERTENCIA" else fill_accent_yellow)
        row_cells = [
            None,
            make_wo_cell(ws_cat, c_idx, font=font_regular, alignment=alignment_center, border=border_thin),
            make_wo_cell(ws_cat, rule["severity"], font=font_bold, alignment=alignment_center, border=border_thin, fill=sev_fill),
            make_wo_cell(ws_cat, rule["msg"], font=(font_bold if rule["count"] > 0 else font_regular), border=border_thin),
            make_wo_cell(ws_cat, rule["count"], font=font_bold, alignment=alignment_right, num_fmt='#,##0', border=border_thin),
        ]
        for camp_key in all_campaigns:
            v = rule["camp_counts"].get(camp_key, 0)
            row_cells.append(
                make_wo_cell(ws_cat, v, font=(font_muted if v == 0 else font_regular), alignment=alignment_right, num_fmt='#,##0', border=border_thin)
            )
        if rule["count"] > 0:
            tab_name = get_safe_sheet_name(rule["msg"], c_idx)
            active_sheets_mapping[rule["msg"]] = {"tab_name": tab_name, "records": rule["matches"]}
            row_cells.append(
                make_wo_cell(ws_cat, f'=HYPERLINK("#{chr(39)}{tab_name}{chr(39)}!B2", "🔍 Navegar a Registros")', font=font_link, alignment=alignment_center, border=border_thin)
            )
        else:
            row_cells.append(
                make_wo_cell(ws_cat, "Limpio / 0 Incidencias", font=font_clean, alignment=alignment_center, fill=fill_accent_green, border=border_thin)
            )
        cat_rows.append(row_cells)
        r_cat += 1

    ws_cat.column_dimensions['A'].width = 3
    for ci, w in _compute_sample_widths(cat_rows[:14]).items():
        ws_cat.column_dimensions[get_column_letter(ci)].width = w
    for row_cells in cat_rows:
        ws_cat.append(row_cells)
    last_col_letter = get_column_letter(6 + len(all_campaigns))
    ws_cat.auto_filter.ref = f"B5:{last_col_letter}{r_cat - 1}"

    # --- HOJA 3: DETALLE PLANO COMPLETO DE INCIDENCIAS ---
    chunk_size = 1000000
    detail_chunks = [filtered[i:i + chunk_size] for i in range(0, len(filtered), chunk_size)]
    if not detail_chunks:
        detail_chunks = [[]]

    sev_fills = {
        "ALERTA": fill_accent_red,
        "ADVERTENCIA": fill_accent_orange,
        "VACIO": fill_accent_yellow
    }
    headers_detail = [
        "Fila Excel", "Gravedad", "Estación Padre", "Estructura Hija", "Campaña",
        "Mapeador Geotécnico", "Sector Geotécnico", "Tipo de Mapeo", "Columna de Falla",
        "Valor Actual", "Mensaje de Inconsistencia Geomecánica"
    ]

    for chunk_idx, chunk_data in enumerate(detail_chunks):
        title = "📋 Detalle de Incidencias"
        if len(detail_chunks) > 1:
            title = f"📋 Detalle Incidencias ({chunk_idx + 1})"

        ws_detail = wb.create_sheet(title=title)
        ws_detail.views.sheetView[0].showGridLines = True

        head_rows = [
            [],
            [None, make_wo_cell(ws_detail, "DETALLE COMPLETO DE INCIDENCIAS", font=font_title)],
            [None, make_wo_cell(ws_detail, "Listado plano consolidado de todas las desviaciones y vacíos detectados.", font=font_subtitle)],
            [],
            [None] + [make_wo_cell(ws_detail, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin) for col in headers_detail],
        ]
        grid_heading_row = 5
        start_detail_row = 6

        def _build_detail_row(curr_row: int, inc_item: dict) -> list:
            sev = inc_item.get("tipo_incidencia", "ALERTA")
            sev_fill = sev_fills.get(sev, fill_accent_yellow)
            row_zebra = fill_zebra if (curr_row % 2 == 0) else None
            values = [
                safe_int(inc_item.get("fila_excel")),
                sev,
                inc_item.get("celda_padre"),
                inc_item.get("celda_hija"),
                inc_item.get("campania"),
                inc_item.get("geotecnico"),
                inc_item.get("sector_geotecnico"),
                inc_item.get("tipo_mapeo", "Mapeo de Celdas"),
                inc_item.get("columna"),
                inc_item.get("valor_actual") if inc_item.get("valor_actual") is not None else "—",
                _resolve_msg(inc_item)
            ]
            row_cells = [None]
            for col_idx, val in enumerate(values, start=2):
                if col_idx == 3:
                    row_cells.append(make_wo_cell(ws_detail, val, font=font_bold, fill=sev_fill, border=border_thin, alignment=alignment_center))
                else:
                    align = alignment_center if col_idx in (2, 4, 5, 6, 8, 9, 11) else alignment_left
                    row_cells.append(make_wo_cell(ws_detail, val, fill=row_zebra, border=border_thin, alignment=align))
            return row_cells

        sample_rows = list(head_rows)
        for idx in range(min(9, len(chunk_data))):
            sample_rows.append(_build_detail_row(start_detail_row + idx, chunk_data[idx]))

        ws_detail.column_dimensions['A'].width = 3
        for ci, w in _compute_sample_widths(sample_rows).items():
            ws_detail.column_dimensions[get_column_letter(ci)].width = w
        for sr in sample_rows:
            ws_detail.append(sr)
        for idx in range(9, len(chunk_data)):
            ws_detail.append(_build_detail_row(start_detail_row + idx, chunk_data[idx]))

        end_detail_row = start_detail_row + len(chunk_data) - 1
        ws_detail.auto_filter.ref = f"B{grid_heading_row}:L{max(grid_heading_row, end_detail_row)}"

    # --- HOJAS 4+: DETALLES INDIVIDUALES POR REGLA DE ERROR ---
    headers_inc = [
        "Fila Excel", "Estación Padre", "Estructura Hija", "Tipo de Mapeo", "Campaña",
        "Mapeador Geotécnico", "Sector Geotécnico", "Columna de Falla",
        "Valor Actual", "Mensaje de Inconsistencia Geomecánica"
    ]

    for orig_msg, mapping_data in active_sheets_mapping.items():
        sh_name = mapping_data["tab_name"]
        err_records = mapping_data["records"]

        ws_err = wb.create_sheet(title=sh_name)
        ws_err.views.sheetView[0].showGridLines = True
        for ci, w in err_widths.items():
            ws_err.column_dimensions[get_column_letter(ci)].width = w

        st_affected = len(set(x.get("celda_padre", "N/A") for x in err_records))
        tot_affected = len(err_records)

        r_dist_yr = defaultdict(int)
        for r in err_records:
            r_dist_yr[str(r.get("campania", "N/A"))] += 1
        unique_years = sorted(list(set(str(r.get("campania", "N/A")) for r in err_records)))

        rule_group = defaultdict(list)
        for r in err_records:
            rule_group[r.get("rule_code", "Desconocido")].append(r)
        rule_stats = sorted(
            [{"rule_code": rc, "total": len(recs), "yr_counts": Counter(str(r.get("campania", "N/A")) for r in recs)} for rc, recs in rule_group.items()],
            key=lambda x: x["total"],
            reverse=True,
        )

        msg_group = defaultdict(list)
        for r in err_records:
            msg_group[_resolve_msg(r)].append(r)
        msg_stats = sorted(
            [{"message": mv, "total": len(recs), "yr_counts": Counter(str(r.get("campania", "N/A")) for r in recs)} for mv, recs in msg_group.items()],
            key=lambda x: x["total"],
            reverse=True,
        )

        dist_table_height = len(r_dist_yr)
        jump_link_row = 12 + dist_table_height + 1
        table_a_start = jump_link_row + 2
        table_a_height = 2 + len(rule_stats)
        indiv_start = table_a_start + table_a_height + 2
        indiv_height = 2 + len(err_records)
        table_b_start = indiv_start + indiv_height + 2

        ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=5, max_col=7, max_row=5))
        ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=7, max_col=3, max_row=7))
        ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=8, max_col=3, max_row=8))
        ws_err.merged_cells.ranges.add(CellRange(min_col=4, min_row=7, max_col=5, max_row=7))
        ws_err.merged_cells.ranges.add(CellRange(min_col=4, min_row=8, max_col=5, max_row=8))

        ws_err.append([])
        ws_err.append([None, make_wo_cell(ws_err, '=HYPERLINK("#\'❌ Catálogo de Errores\'!B2", "⬅ Volver al Registro Maestro de Errores")', font=font_link, alignment=alignment_left)])
        ws_err.append([])
        ws_err.append([None, make_wo_cell(ws_err, "ANÁLISIS DE INCIDENCIA EN BASE DE DATOS", font=font_section)])
        ws_err.append([None, make_wo_cell(ws_err, f"Regla: {orig_msg.upper()}", font=font_err_banner, fill=fill_accent_red, border=border_thin)])
        ws_err.append([])
        ws_err.append([
            None,
            make_wo_cell(ws_err, "ESTACIONES AFECTADAS (CELDA PADRE)", font=font_kpi_lbl, alignment=alignment_center, fill=fill_kpi_gray, border=border_kpi),
            make_wo_cell(ws_err, None, fill=fill_kpi_gray, border=border_kpi),
            make_wo_cell(ws_err, "ESTRUCTURAS AFECTADAS (CANTIDAD)", font=font_kpi_lbl, alignment=alignment_center, fill=fill_kpi_gray, border=border_kpi),
            make_wo_cell(ws_err, None, fill=fill_kpi_gray, border=border_kpi),
        ])
        ws_err.append([
            None,
            make_wo_cell(ws_err, st_affected, font=font_kpi_val_blue, alignment=alignment_center, fill=fill_kpi_gray, border=border_kpi),
            make_wo_cell(ws_err, None, fill=fill_kpi_gray, border=border_kpi),
            make_wo_cell(ws_err, tot_affected, font=font_kpi_val_blue, alignment=alignment_center, fill=fill_kpi_gray, border=border_kpi),
            make_wo_cell(ws_err, None, fill=fill_kpi_gray, border=border_kpi),
        ])
        ws_err.append([])
        ws_err.append([None, make_wo_cell(ws_err, "DISTRIBUCIÓN POR CAMPAÑA", font=font_section)])
        ws_err.append([None] + [make_wo_cell(ws_err, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin) for col in ["Campaña / Año", "Ocurrencias (N)", "% Contribución"]])
        for yr, y_qty in sorted(r_dist_yr.items()):
            ws_err.append([
                None,
                make_wo_cell(ws_err, yr, font=font_bold, alignment=alignment_center, border=border_thin),
                make_wo_cell(ws_err, y_qty, font=font_regular, alignment=alignment_right, num_fmt='#,##0', border=border_thin),
                make_wo_cell(ws_err, y_qty / max(1, tot_affected), font=font_regular, alignment=alignment_right, num_fmt='0.00%', border=border_thin),
            ])
        ws_err.append([])
        ws_err.append([None, make_wo_cell(ws_err, f'=HYPERLINK("#\'{sh_name}\'!B{table_b_start}", "🔍 Ir a Métricas de Mensajes de Inconsistencia Únicos (al final de la hoja)")', font=font_link, alignment=alignment_left)])
        ws_err.append([])
        ws_err.append([None, make_wo_cell(ws_err, "MÉTRICAS POR REGLA ESPECÍFICA (CÓDIGO)", font=font_section)])
        ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=table_a_start + 1, max_col=4, max_row=table_a_start + 1))
        headers_a = ["Ocurrencias Totales"] + [f"Año {y}" if y != "N/A" else "N/A" for y in unique_years]
        ws_err.append(
            [None, make_wo_cell(ws_err, "Código de Regla", font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin),
             make_wo_cell(ws_err, None, fill=fill_primary, border=border_thin),
             make_wo_cell(ws_err, None, fill=fill_primary, border=border_thin)] +
            [make_wo_cell(ws_err, h, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin) for h in headers_a]
        )
        for idx, stat in enumerate(rule_stats):
            r_row = table_a_start + 2 + idx
            rf = fill_zebra if r_row % 2 == 0 else None
            ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=r_row, max_col=4, max_row=r_row))
            ws_err.append(
                [None, make_wo_cell(ws_err, stat["rule_code"], font=font_bold, alignment=alignment_center, fill=rf, border=border_thin),
                 make_wo_cell(ws_err, None, fill=rf, border=border_thin), make_wo_cell(ws_err, None, fill=rf, border=border_thin),
                 make_wo_cell(ws_err, stat["total"], font=font_bold, alignment=alignment_right, num_fmt='#,##0', fill=rf, border=border_thin)] +
                [make_wo_cell(ws_err, stat["yr_counts"].get(yr, 0), font=font_regular, alignment=alignment_right, num_fmt='#,##0', fill=rf, border=border_thin) for yr in unique_years]
            )
        ws_err.append([])
        ws_err.append([])
        ws_err.append([None, make_wo_cell(ws_err, "REGISTROS INDIVIDUALES AFECTADOS (LISTADO COMPLETO)", font=font_section)])
        header_row_idx = indiv_start + 1
        ws_err.append([None] + [make_wo_cell(ws_err, h, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin) for h in headers_inc])

        start_data_row = indiv_start + 2
        curr_row = start_data_row
        for inc_item in err_records:
            row_zebra = fill_zebra if curr_row % 2 == 0 else None
            row_vals = [
                safe_int(inc_item.get("fila_excel")),
                inc_item.get("celda_padre"),
                inc_item.get("celda_hija"),
                inc_item.get("tipo_mapeo", "Mapeo de Celdas"),
                inc_item.get("campania"),
                inc_item.get("geotecnico"),
                inc_item.get("sector_geotecnico"),
                inc_item.get("columna"),
                inc_item.get("valor_actual") if inc_item.get("valor_actual") is not None else "—",
                _resolve_msg(inc_item)
            ]
            row_cells = [None]
            for c_idx, val in enumerate(row_vals, start=2):
                align = alignment_center if c_idx in (2, 3, 4, 5, 6, 8, 10) else alignment_left
                row_cells.append(make_wo_cell(ws_err, val, fill=row_zebra, border=border_thin, alignment=align))
            ws_err.append(row_cells)
            curr_row += 1

        end_data_row = start_data_row + len(err_records) - 1
        ws_err.auto_filter.ref = f"B{header_row_idx}:K{max(header_row_idx, end_data_row)}"

        ws_err.append([])
        ws_err.append([])
        ws_err.append([
            None,
            make_wo_cell(ws_err, "MÉTRICAS POR MENSAJE DE INCONSISTENCIA GEOMECÁNICA ÚNICO", font=font_section),
            None, None,
            make_wo_cell(ws_err, f'=HYPERLINK("#\'{sh_name}\'!B2", "⬅ Volver al Inicio de la Hoja")', font=font_link, alignment=alignment_left),
        ])
        ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=table_b_start + 1, max_col=7, max_row=table_b_start + 1))
        headers_b = ["Ocurrencias Totales"] + [f"Año {y}" if y != "N/A" else "N/A" for y in unique_years]
        ws_err.append(
            [None, make_wo_cell(ws_err, "Mensaje de Inconsistencia Geomecánica Único", font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin)] +
            [make_wo_cell(ws_err, None, fill=fill_primary, border=border_thin) for _ in range(5)] +
            [make_wo_cell(ws_err, h, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin) for h in headers_b]
        )
        for idx, stat in enumerate(msg_stats):
            r_row = table_b_start + 2 + idx
            rf = fill_zebra if r_row % 2 == 0 else None
            ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=r_row, max_col=7, max_row=r_row))
            ws_err.append(
                [None, make_wo_cell(ws_err, stat["message"], font=font_regular, alignment=alignment_left, fill=rf, border=border_thin)] +
                [make_wo_cell(ws_err, None, fill=rf, border=border_thin) for _ in range(5)] +
                [make_wo_cell(ws_err, stat["total"], font=font_bold, alignment=alignment_right, num_fmt='#,##0', fill=rf, border=border_thin)] +
                [make_wo_cell(ws_err, stat["yr_counts"].get(yr, 0), font=font_regular, alignment=alignment_right, num_fmt='#,##0', fill=rf, border=border_thin) for yr in unique_years]
            )

    return wb

# --- Helpers de cancelación cooperativa y lock de concurrencia ---
# El pipeline valida en loop con pandas; para poder abortarlo desde la UI se usa un
# flag de cancelación por audit_id que el validator revisa periódicamente, y un lock
# global que impide lanzar dos auditorías pesadas simultáneas en la misma instancia.

def _cancel_flag_path(audit_id: str) -> str:
    return os.path.join(uploads_dir, "history", f"{audit_id}.cancel")

def _lock_file_path() -> str:
    return os.path.join(uploads_dir, "history", "processing.lock")

def _is_cancelled(audit_id: str) -> bool:
    return os.path.exists(_cancel_flag_path(audit_id))

def _cleanup_audit_files(audit_id: str) -> None:
    history_dir = os.path.join(uploads_dir, "history")
    for suffix in [".xlsx", "_diagnostico.json", "_compact.json", "_reporte_completo.xlsx", ".cancel"]:
        p = os.path.join(history_dir, f"{audit_id}{suffix}")
        for attempt in range(3):
            try:
                os.remove(p)
                break
            except OSError:
                if attempt == 2:
                    break
                time.sleep(0.3)  # reintentar: en Windows puede estar momentáneamente bloqueado

def _acquire_lock(audit_id: str) -> bool:
    lock_path = _lock_file_path()
    history_dir = os.path.join(uploads_dir, "history")
    if os.path.exists(lock_path):
        try:
            with open(lock_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            old_audit_id = data.get("audit_id")
            # 1. Si la auditoría anterior fue cancelada o tiene el flag .cancel
            if old_audit_id and _is_cancelled(old_audit_id):
                _cleanup_audit_files(old_audit_id)
                try: os.remove(lock_path)
                except OSError: pass
            # 2. Si la auditoría anterior ya terminó (existe _compact.json)
            elif old_audit_id and os.path.exists(os.path.join(history_dir, f"{old_audit_id}_compact.json")):
                try: os.remove(lock_path)
                except OSError: pass
            # 3. Si no existe ningún archivo de trabajo de la auditoría anterior (proceso huérfano)
            elif old_audit_id and not os.path.exists(os.path.join(history_dir, f"{old_audit_id}.xlsx")) and not os.path.exists(os.path.join(history_dir, f"{old_audit_id}_diagnostico.json")):
                try: os.remove(lock_path)
                except OSError: pass
            else:
                age = time.time() - data.get("started_at", 0)
                if age < 3 * 3600:  # 3 horas máximo
                    return False
        except Exception:
            pass
        try:
            if os.path.exists(lock_path):
                os.remove(lock_path)
        except OSError:
            pass
    with open(lock_path, "w", encoding="utf-8") as f:
        json.dump({"audit_id": audit_id, "started_at": time.time()}, f)
    return True

def _release_lock(audit_id: str = None) -> None:
    lock_path = _lock_file_path()
    try:
        if os.path.exists(lock_path):
            if audit_id is None:
                os.remove(lock_path)
            else:
                with open(lock_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if data.get("audit_id") == audit_id:
                    os.remove(lock_path)
    except Exception:
        pass

def run_bulk_pipeline_with_id(file_path: str, audit_id: str, original_filename: str = None, proyecto: str = "ferrobamba"):
    t_start = time.time()
    print(f"\n======================================================================")
    print(f"[*] [AUDITORÍA {audit_id}] INICIANDO PIPELINE DE PROCESAMIENTO ASÍNCRONO")
    print(f"[*] Archivo cargado: {os.path.basename(file_path)} | Proyecto: {proyecto}")
    print(f"======================================================================")
    
    history_dir = os.path.join(uploads_dir, "history")
    os.makedirs(history_dir, exist_ok=True)
    raw_json_out = os.path.join(history_dir, f"{audit_id}_diagnostico.json")
    compact_json_out = os.path.join(history_dir, f"{audit_id}_compact.json")
    excel_pregenerated_out = os.path.join(history_dir, f"{audit_id}_reporte_completo.xlsx")
    
    try:
        # Paso 1: Ejecutar la validación masiva en validator.py
        print(f"[*] [AUDITORÍA {audit_id}] Paso 1/5: Ejecutando motor de validación QA/QC geomecánica...")
        diag = validate_bulk_excel(file_path, raw_json_out, cancel_flag_path=_cancel_flag_path(audit_id), project=proyecto)
        if _is_cancelled(audit_id):
            _cleanup_audit_files(audit_id)
            print(f"[x] [AUDITORÍA {audit_id}] Cancelada por el usuario tras la validación.")
            return

        # Paso 2: Copiar al diagnóstico público estático
        print(f"[*] [AUDITORÍA {audit_id}] Paso 2/5: Publicando diagnóstico en caché pública...")
        if _is_cancelled(audit_id):
            _cleanup_audit_files(audit_id)
            print(f"[x] [AUDITORÍA {audit_id}] Cancelada por el usuario antes de publicar el diagnóstico.")
            return
        shutil.copyfile(raw_json_out, os.path.join(uploads_dir, "diagnostico_geomecanico.json"))

        # Paso 3: Cargar resultados y compactar métricas para la UI mediante la función unificada
        print(f"[*] [AUDITORÍA {audit_id}] Paso 3/5: Compilando métricas compactas para Dashboard...")
        if _is_cancelled(audit_id):
            _cleanup_audit_files(audit_id)
            print(f"[x] [AUDITORÍA {audit_id}] Cancelada por el usuario antes de compilar métricas.")
            return
        if diag is None:
            with open(raw_json_out, "r", encoding="utf-8") as f:
                diag = json.load(f)

        diag["nombre_archivo"] = original_filename or os.path.basename(file_path)
        diag["proyecto"] = proyecto
        compact = aggregate_audit_metrics(diag)
        compact["audit_id"] = audit_id
        compact["nombre_archivo"] = diag["nombre_archivo"]
        compact["proyecto"] = proyecto

        print(f"[*] [AUDITORÍA {audit_id}] Paso 4/5: Escribiendo JSON de resumen ligero...")
        if _is_cancelled(audit_id):
            _cleanup_audit_files(audit_id)
            print(f"[x] [AUDITORÍA {audit_id}] Cancelada por el usuario antes de publicar el resumen.")
            return
        compact_json_tmp = compact_json_out + ".tmp"
        with open(compact_json_tmp, "w", encoding="utf-8") as f:
            json.dump(compact, f, ensure_ascii=False)
        safe_replace(compact_json_tmp, compact_json_out)
        
        public_compact = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
        public_compact_tmp = public_compact + ".tmp"
        shutil.copyfile(compact_json_out, public_compact_tmp)
        safe_replace(public_compact_tmp, public_compact)

        # Paso 5: Generar archivo Excel cacheado
        # IMPORTANTE: Extraemos las incidencias del dict principal y vaciamos la referencia en diag
        # para que el GC pueda liberar el dict grande mientras openpyxl construye el workbook,
        # evitando el MemoryError por tener dos copias gigantes en RAM simultáneamente.
        print(f"[*] [AUDITORÍA {audit_id}] Paso 5/5: Pre-generando reporte de Excel (.xlsx) en segundo plano...")
        if _is_cancelled(audit_id):
            _cleanup_audit_files(audit_id)
            print(f"[x] [AUDITORÍA {audit_id}] Cancelada por el usuario antes de generar el reporte Excel.")
            return
        incidencias_list = diag.pop("incidencias", [])
        
        # 1. Pre-generar reporte ADMIN (con recomendaciones)
        excel_admin_out = os.path.join(uploads_dir, "history", f"{audit_id}_reporte_admin.xlsx")
        wb_admin = generar_excel_reporte_core(diag, compact, incidencias_list, es_admin=True)
        excel_admin_tmp = excel_admin_out + ".tmp"
        wb_admin.save(excel_admin_tmp)
        wb_admin.close()
        safe_replace(excel_admin_tmp, excel_admin_out)
        del wb_admin
        gc.collect()

        # 2. Pre-generar reporte STANDARD / NO-ADMIN (sin recomendaciones)
        excel_std_out = os.path.join(uploads_dir, "history", f"{audit_id}_reporte_standard.xlsx")
        wb_std = generar_excel_reporte_core(diag, compact, incidencias_list, es_admin=False)
        excel_std_tmp = excel_std_out + ".tmp"
        wb_std.save(excel_std_tmp)
        wb_std.close()
        safe_replace(excel_std_tmp, excel_std_out)
        del wb_std
        del incidencias_list  # liberar RAM tras guardar archivos
        gc.collect()

        # Compatibilidad histórica
        shutil.copyfile(excel_std_out, excel_pregenerated_out)

        # Accesos directos globales para última auditoría
        public_admin = os.path.join(uploads_dir, "reporte_completo_admin_ultimo.xlsx")
        public_admin_tmp = public_admin + ".tmp"
        shutil.copyfile(excel_admin_out, public_admin_tmp)
        safe_replace(public_admin_tmp, public_admin)

        public_std = os.path.join(uploads_dir, "reporte_completo_standard_ultimo.xlsx")
        public_std_tmp = public_std + ".tmp"
        shutil.copyfile(excel_std_out, public_std_tmp)
        safe_replace(public_std_tmp, public_std)

        public_excel = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")
        public_excel_tmp = public_excel + ".tmp"
        shutil.copyfile(excel_std_out, public_excel_tmp)
        safe_replace(public_excel_tmp, public_excel)
        
        elapsed = time.time() - t_start
        print(f"======================================================================")
        print(f"[+] [AUDITORÍA {audit_id}] PIPELINE COMPLETADO EXITOSAMENTE")
        print(f"[*] Tiempo total: {elapsed:.2f} segundos")
        print(f"======================================================================\n")

    except AuditCancelledError as e:
        print(f"\n[x] [AUDITORÍA {audit_id}] AUDITORÍA CANCELADA POR EL USUARIO: {e}")
        _cleanup_audit_files(audit_id)
        print(f"[x] [AUDITORÍA {audit_id}] Archivos parciales eliminados.")

    except Exception as e:
        elapsed = time.time() - t_start
        print(f"\n======================================================================")
        print(f"[-] [AUDITORÍA {audit_id}] PIPELINE ABORTADO POR ERROR CRÍTICO")
        print(f"[-] Detalle del error: {str(e)}")
        print(f"[-] Tiempo ejecutado antes del fallo: {elapsed:.2f} segundos")
        print(f"======================================================================")
        traceback.print_exc()
        
        error_data = {
            "audit_id": audit_id,
            "status": "error",
            "fecha_auditoria": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "nombre_archivo": os.path.basename(file_path),
            "error_message": str(e),
            "familia1": {"total_discontinuidades": 0},
            "familia2": {"total_vacios": 0, "total_advertencias": 0, "total_alertas": 0}
        }
        try:
            with open(compact_json_out, "w", encoding="utf-8") as f:
                json.dump(error_data, f, ensure_ascii=False)
            shutil.copyfile(compact_json_out, os.path.join(uploads_dir, "resumen_geomecanico_ligero.json"))
        except Exception as write_err:
            print(f"[-] Error al guardar JSON de contingencia para error de auditoría: {write_err}")
    finally:
        _release_lock(audit_id)

@router.post("/geomecanica/cancelar")
def cancelar_auditoria(audit_id: str = None):
    """
    Cancela cooperativamente una auditoría en curso: crea un flag que el pipeline
    revisa periódicamente (en el loop de validación y entre pasos) para abortar
    y limpiar los archivos parciales.
    """
    if not audit_id:
        lock_path = _lock_file_path()
        if os.path.exists(lock_path):
            try:
                with open(lock_path, "r", encoding="utf-8") as f:
                    audit_id = json.load(f).get("audit_id")
            except Exception:
                pass
        if not audit_id:
            # Si no hay lock ni audit_id, liberar cualquier lock residual
            _release_lock()
            return {"status": "cancelado", "audit_id": None}

    with open(_cancel_flag_path(audit_id), "w", encoding="utf-8") as f:
        f.write("1")
    _cleanup_audit_files(audit_id)
    _release_lock(audit_id)
    return {"status": "cancelado", "audit_id": audit_id}

@router.post("/geomecanica/importar-excel-bulk")
async def importar_excel_bulk(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    proyecto: str = Form("ferrobamba")
):
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Formato no soportado. Solo se aceptan archivos .xlsx (Excel 2007+).")
    audit_id = f"audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    history_dir = os.path.join(uploads_dir, "history")
    os.makedirs(history_dir, exist_ok=True)

    # Guard de concurrencia: una sola revisión pesada a la vez (evita OOM por
    # dos pipelines simultáneos de archivos grandes en instancias pequeñas).
    if not _acquire_lock(audit_id):
        raise HTTPException(
            status_code=409,
            detail="Ya hay una revisión en proceso en el servidor. Espera a que termine o cancélala antes de subir otro archivo."
        )

    try:
        file_path = os.path.join(history_dir, f"{audit_id}.xlsx")

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Validar de forma síncrona si es un reporte generado por el sistema (modo read_only sin cargar data)
        try:
            wb_check = openpyxl.load_workbook(file_path, read_only=True)
            sheet_names = wb_check.sheetnames
            wb_check.close()
            del wb_check
            is_report = any("DASHBOARD" in s.upper() or "ERRORES" in s.upper() or "INCIDENCIAS" in s.upper() for s in sheet_names)
            if is_report:
                try:
                    os.remove(file_path)
                except:
                    pass
                raise HTTPException(
                    status_code=400,
                    detail="El archivo cargado es un reporte de revisión generado por el sistema. Por favor, cargue la base de datos geomecánica original con sus celdas de mapeo."
                )
        except HTTPException:
            raise
        except Exception as e:
            try:
                os.remove(file_path)
            except:
                pass
            raise HTTPException(
                status_code=400,
                detail=f"No se pudo leer el archivo Excel. Verifique que no esté corrupto o posea un formato inválido. Detalle: {str(e)}"
            )

        background_tasks.add_task(run_bulk_pipeline_with_id, file_path, audit_id, file.filename, proyecto)
        return {"status": "procesando", "audit_id": audit_id, "filename": file.filename, "proyecto": proyecto}
    except BaseException:
        # Cualquier fallo (desconexión del cliente, error de disco, fallo al agendar)
        # debe liberar el lock para no bloquear futuras auditorías hasta el timeout.
        _release_lock(audit_id)
        raise

@router.get("/geomecanica/auditorias")
def listar_auditorias():
    history_dir = os.path.join(uploads_dir, "history")
    if not os.path.exists(history_dir): return []
    audits = []
    for f in os.listdir(history_dir):
        if f.endswith("_compact.json"):
            audit_id = f.replace("_compact.json", "")
            compact_file = os.path.join(history_dir, f)
            try:
                with open(compact_file, "r", encoding="utf-8") as file_content:
                    meta = json.load(file_content)
                    audits.append({
                        "audit_id": audit_id, "fecha": meta.get("fecha_auditoria", "Desconocida"),
                        "archivo": meta.get("nombre_archivo", "Desconocido.xlsx"),
                        "proyecto": meta.get("proyecto", "ferrobamba"),
                        "total_filas": meta.get("familia1", {}).get("total_discontinuidades", 0),
                        "total_vacios": meta.get("familia2", {}).get("total_vacios", 0),
                        "total_advertencias": meta.get("familia2", {}).get("total_advertencias", 0),
                        "total_alertas": meta.get("familia2", {}).get("total_alertas", 0)
                    })
            except: pass
    return sorted(audits, key=lambda x: x["fecha"], reverse=True)

@router.get("/geomecanica/status")
def obtener_status_auditoria(audit_id: str = None):
    """
    Estado canónico y liviano (~200 bytes) de una auditoría para el polling del frontend.
    Reemplaza el uso de /resumen-ligero como chequeo de estado: no carga JSONs grandes.

    Respuestas:
      {"status": "procesando"}   -> el pipeline aún corre (existe el .xlsx subido o el diagnóstico)
      {"status": "listo", "reporte_listo": bool, "nombre_archivo": ..., "fecha_auditoria": ...}
      {"status": "error", "detail": ...}  -> fallo persistido por el pipeline en el compact
      404                             -> el audit_id ya no existe (archivos perdidos por reinicio/redeploy)
    """
    if not audit_id:
        raise HTTPException(status_code=400, detail="Parámetro 'audit_id' requerido.")

    history_dir = os.path.join(uploads_dir, "history")
    excel_file = os.path.join(history_dir, f"{audit_id}.xlsx")
    raw_file = os.path.join(history_dir, f"{audit_id}_diagnostico.json")
    compact_file = os.path.join(history_dir, f"{audit_id}_compact.json")
    reporte_file = os.path.join(history_dir, f"{audit_id}_reporte_completo.xlsx")

    if os.path.exists(compact_file):
        try:
            with open(compact_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            meta = {}
        if meta.get("status") == "error":
            return {"status": "error", "detail": meta.get("error_message", "El procesamiento falló en el servidor.")}
        return {
            "status": "listo",
            "reporte_listo": os.path.exists(reporte_file),
            "nombre_archivo": meta.get("nombre_archivo"),
            "fecha_auditoria": meta.get("fecha_auditoria"),
        }

    if os.path.exists(excel_file) or os.path.exists(raw_file):
        return {"status": "procesando"}

    raise HTTPException(
        status_code=404,
        detail="La revisión solicitada ya no existe en el servidor (sus archivos se perdieron, probablemente por un reinicio o redeploy).",
    )

@router.get("/geomecanica/resumen-ligero")
def obtener_resumen_ligero(audit_id: str = None, years: str = None):
    # 1. Resolver rutas de archivos correspondientes
    if audit_id:
        raw_file = os.path.join(uploads_dir, "history", f"{audit_id}_diagnostico.json")
        compact_file = os.path.join(uploads_dir, "history", f"{audit_id}_compact.json")
        excel_file = os.path.join(uploads_dir, "history", f"{audit_id}.xlsx")
        
        # Check first if the compact_file has error status
        if os.path.exists(compact_file):
            try:
                with open(compact_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                if meta.get("status") == "error":
                    raise HTTPException(status_code=400, detail=meta.get("error_message", "Error de procesamiento en segundo plano."))
            except HTTPException:
                raise
            except Exception:
                pass

        if not os.path.exists(compact_file) or not os.path.exists(raw_file):
            if os.path.exists(excel_file):
                return JSONResponse(
                    status_code=202, 
                    content={"status": "procesando", "message": "Procesando base de datos masiva y cruzando variables..."}
                )
            raise HTTPException(status_code=404, detail="La revisión solicitada no existe en el servidor.")
    else:
        raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
        compact_file = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
        if not os.path.exists(raw_file) or not os.path.exists(compact_file):
            history_dir = os.path.join(uploads_dir, "history")
            if os.path.exists(history_dir):
                jsons = [f for f in os.listdir(history_dir) if f.endswith("_diagnostico.json") and not f.endswith(".tmp")]
                if jsons:
                    jsons.sort(key=lambda x: os.path.getmtime(os.path.join(history_dir, x)), reverse=True)
                    latest_id = jsons[0].replace("_diagnostico.json", "")
                    raw_file = os.path.join(history_dir, f"{latest_id}_diagnostico.json")
                    compact_file = os.path.join(history_dir, f"{latest_id}_compact.json")
            
            # Check default compact_file for error
            if os.path.exists(compact_file):
                try:
                    with open(compact_file, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                    if meta.get("status") == "error":
                        raise HTTPException(status_code=400, detail=meta.get("error_message", "Error en segundo plano."))
                except HTTPException:
                    raise
                except Exception:
                    pass

            if not os.path.exists(raw_file) or not os.path.exists(compact_file):
                return JSONResponse(
                    status_code=202, 
                    content={"status": "procesando", "message": "Esperando inicialización de datos de revisión..."}
                )

    # 2. FAST PATH: Cargar el reporte compacto directamente si no hay filtros aplicados
    if (not years or years == "TODOS" or years == "") and os.path.exists(compact_file):
        try:
            with open(compact_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
            if meta.get("status") == "error":
                raise HTTPException(status_code=400, detail=meta.get("error_message", "Error en segundo plano."))
            return meta
        except HTTPException:
            raise
        except Exception:
            pass 

    # 3. BAJO DEMANDA / FILTRADO: Procesar dinámicamente si se especificaron años o falla la caché
    with open(raw_file, "r", encoding="utf-8") as f:
        diag = json.load(f)
        
    diag["nombre_archivo"] = os.path.basename(raw_file)
    compact = aggregate_audit_metrics(diag, years_filter=years)
    compact["audit_id"] = audit_id or "default"
    
    return compact

@router.get("/geomecanica/incidencias-paginadas")
def obtener_incidencias_paginadas(
    page: int = 1, limit: int = 50, tipo: str = None, celda: str = None, columna: str = None,
    campania: str = None, geotecnico: str = None, sector_geotecnico: str = None, search: str = None, audit_id: str = None
):
    if audit_id: 
        raw_file = os.path.join(uploads_dir, "history", f"{audit_id}_diagnostico.json")
        if not os.path.exists(raw_file):
            return {"data": [], "page": 1, "total_pages": 1, "total_records": 0}
    else: 
        raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
        
    if not os.path.exists(raw_file): 
        return {"data": [], "page": 1, "total_pages": 1, "total_records": 0}
        
    with open(raw_file, "r", encoding="utf-8") as f:
        diag_data = json.load(f)
        
    incidencias = diag_data.get("incidencias", [])
    filtered = incidencias
    if tipo: filtered = [i for i in filtered if i.get("tipo_incidencia") == tipo.upper()]
    if celda:
        celda_up = celda.upper()
        filtered = [i for i in filtered if i.get("celda_padre") == celda_up or i.get("celda_hija") == celda_up]
    if columna: filtered = [i for i in filtered if i.get("columna", "").upper() == columna.upper()]
    if campania:
        years_list = [y.strip() for y in campania.split(",") if y.strip()]
        if len(years_list) > 0 and "TODOS" not in years_list:
            filtered = [i for i in filtered if str(i.get("campania")) in years_list]
    if geotecnico:
        geo_up = geotecnico.upper()
        filtered = [i for i in filtered if i.get("geotecnico", "").upper() == geo_up]
    if sector_geotecnico:
        sect_up = sector_geotecnico.upper()
        filtered = [i for i in filtered if i.get("sector_geotecnico", "").upper() == sect_up]
    
    if search:
        search_lower = search.lower()
        filtered = [
            i for i in filtered 
            if search_lower in i.get("mensaje", "").lower() 
            or search_lower in get_incidence_category_name(i).lower()
            or search_lower in i.get("columna", "").lower()
            or search_lower in i.get("celda_padre", "").lower()
        ]
        
    total_records = len(filtered)
    start_idx = (page - 1) * limit
    return {"page": page, "limit": limit, "total_records": total_records, "total_pages": math.ceil(total_records / limit), "data": filtered[start_idx:start_idx+limit]}

@router.get("/geomecanica/reporte-excel")
def descargar_reporte_excel(
    tipo: str = None, celda: str = None, columna: str = None, campania: str = None,
    geotecnico: str = None, sector_geotecnico: str = None, search: str = None, audit_id: str = None,
    current_user: Optional[models.Usuario] = Depends(get_optional_current_user)
):
    # Control RBAC: Solo el rol 'admin' (estrictamente en minúsculas) recibe recomendaciones
    es_admin = False
    if current_user and current_user.rol and current_user.rol.nombre:
        if current_user.rol.nombre.strip().lower() == "admin":
            es_admin = True

    filtered_vals = []
    for val in [tipo, celda, columna, campania, geotecnico, sector_geotecnico, search]:
        if val is not None:
            v_str = str(val).strip().upper()
            if v_str not in ["", "NONE", "NULL", "UNDEFINED", "TODOS"]:
                filtered_vals.append(val)
                
    is_filtered = len(filtered_vals) > 0
    filename = f"reporte_revision_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    if audit_id:
        target_name = f"{audit_id}_reporte_admin.xlsx" if es_admin else f"{audit_id}_reporte_standard.xlsx"
        pregenerated_file = os.path.join(uploads_dir, "history", target_name)
        if not os.path.exists(pregenerated_file) and es_admin:
            fallback_file = os.path.join(uploads_dir, "history", f"{audit_id}_reporte_completo.xlsx")
            if os.path.exists(fallback_file):
                pregenerated_file = fallback_file
    else:
        target_name = "reporte_completo_admin_ultimo.xlsx" if es_admin else "reporte_completo_standard_ultimo.xlsx"
        pregenerated_file = os.path.join(uploads_dir, target_name)
        if not os.path.exists(pregenerated_file) and es_admin:
            fallback_file = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")
            if os.path.exists(fallback_file):
                pregenerated_file = fallback_file

    if not is_filtered and os.path.exists(pregenerated_file):
        return FileResponse(
            pregenerated_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename,
            headers={"Cache-Control": "no-store", "Vary": "Authorization"},
        )

    if audit_id:
        raw_file = os.path.join(uploads_dir, "history", f"{audit_id}_diagnostico.json")
        compact_file = os.path.join(uploads_dir, "history", f"{audit_id}_compact.json")
    else:
        raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
        compact_file = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
        if not os.path.exists(raw_file) or not os.path.exists(compact_file):
            history_dir = os.path.join(uploads_dir, "history")
            if os.path.exists(history_dir):
                jsons = [f for f in os.listdir(history_dir) if f.endswith("_diagnostico.json") and not f.endswith(".tmp")]
                if jsons:
                    jsons.sort(key=lambda x: os.path.getmtime(os.path.join(history_dir, x)), reverse=True)
                    latest_id = jsons[0].replace("_diagnostico.json", "")
                    raw_file = os.path.join(history_dir, f"{latest_id}_diagnostico.json")
                    compact_file = os.path.join(history_dir, f"{latest_id}_compact.json")

    if not os.path.exists(raw_file) or not os.path.exists(compact_file):
        raise HTTPException(status_code=404, detail="El diagnóstico solicitado no ha sido generado o está incompleto.")

    with open(raw_file, "r", encoding="utf-8") as f:
        diag = json.load(f)
    with open(compact_file, "r", encoding="utf-8") as f:
        compact = json.load(f)
        
    incidencias = diag.get("incidencias", [])
    
    filtered = incidencias
    if tipo: filtered = [i for i in filtered if i.get("tipo_incidencia") == tipo.upper()]
    if celda:
        celda_up = celda.upper()
        filtered = [i for i in filtered if i.get("celda_padre") == celda_up or i.get("celda_hija") == celda_up]
    if columna: filtered = [i for i in filtered if i.get("columna", "").upper() == columna.upper()]
    if campania:
        years_list = [y.strip() for y in campania.split(",") if y.strip()]
        if len(years_list) > 0 and "TODOS" not in years_list:
            filtered = [i for i in filtered if str(i.get("campania")) in years_list]
    if geotecnico:
        geo_up = geotecnico.upper()
        filtered = [i for i in filtered if i.get("geotecnico", "").upper() == geo_up]
    if sector_geotecnico:
        sect_up = sector_geotecnico.upper()
        filtered = [i for i in filtered if i.get("sector_geotecnico", "").upper() == sect_up]
    
    if search:
        search_lower = search.lower()
        filtered = [
            i for i in filtered 
            if search_lower in i.get("mensaje", "").lower() 
            or search_lower in get_incidence_category_name(i).lower()
            or search_lower in i.get("columna", "").lower()
            or search_lower in i.get("celda_padre", "").lower()
        ]

    wb = generar_excel_reporte_core(diag, compact, filtered, es_admin=es_admin)
    
    if not is_filtered:
        os.makedirs(os.path.dirname(pregenerated_file), exist_ok=True)
        excel_tmp = pregenerated_file + ".tmp"
        wb.save(excel_tmp)
        wb.close()
        safe_replace(excel_tmp, pregenerated_file)
        
        if not audit_id:
            public_excel = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")
            public_excel_tmp = public_excel + ".tmp"
            shutil.copyfile(pregenerated_file, public_excel_tmp)
            safe_replace(public_excel_tmp, public_excel)
            
        return FileResponse(
            pregenerated_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename,
            headers={"Cache-Control": "no-store", "Vary": "Authorization"},
        )

    return wb_to_temp_file_response(
        wb,
        filename,
        headers={"Cache-Control": "no-store", "Vary": "Authorization"},
    )

@router.get("/geomecanica/reglas")
@router.get("/auditoria/reglas")
@router.get("/revision/reglas")
def obtener_catalogo_reglas():
    """
    Retorna el catálogo completo de reglas de consistencia de revisión
    con metadatos, severidades, categorías, columnas y ejemplos didácticos.
    """
    return get_rules_catalog_data()
