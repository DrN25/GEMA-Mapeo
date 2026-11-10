"""
app/services/plt_excel_exporter.py — Generador de Reporte Excel Profesional Multi-Hoja QA/QC para PLT.
Estructura y estilos 100% calcados del motor de auditoría de Mapeo Geomecánico (generar_excel_reporte_core),
optimizado con Workbook(write_only=True) para minimizar el consumo de memoria RAM.
"""

from collections import Counter, defaultdict
import openpyxl
from openpyxl.chart import BarChart, Reference
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.cell_range import CellRange

from app.core.excel_styles import get_styles, make_wo_cell
from app.core.audit_helpers import safe_int, safe_float, get_safe_sheet_name
from app.core.audit_plt_helpers import get_plt_incidence_category_name
from app.core.rules_plt import CATEGORIES_REGISTRY_PLT, COMPACT_FIELD_CATEGORIES


def export_plt_audit_to_excel(diag: dict, compact: dict, filtered: list) -> openpyxl.Workbook:
    """
    Genera el libro Excel (.xlsx) completo de auditoría QA/QC para Ensayos PLT.
    Calcado 1:1 de la estructura, jerarquía, hipervínculos, estilos y gráficos de Mapeo Geomecánico.
    """
    s = get_styles()
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

    err_widths = {1: 3, 2: 11, 3: 14, 4: 14, 5: 10, 6: 18, 7: 10, 8: 24, 9: 14, 10: 60}

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

    formato_tipo = diag.get("formato_detectado", "FORMAT_STANDARD_34")

    wb = openpyxl.Workbook(write_only=True)

    # =========================================================================
    # --- HOJA 1: DASHBOARD EJECUTIVO ---
    # =========================================================================
    ws_dash = wb.create_sheet(title="📊 Dashboard Ejecutivo")
    ws_dash.views.sheetView[0].showGridLines = True

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

    d_cell(2, 2, "SISTEMA DE REVISIÓN GEOTÉCNICA — ENSAYOS PLT", font=font_title)
    subtitle_txt = (
        "Dashboard Ejecutivo de Control de Calidad, Consistencia Geomecánica y Secuencias ABCD (Formato de Campo)"
        if "COMPACT" in str(formato_tipo)
        else "Dashboard Ejecutivo de Control de Calidad, Consistencia de 34 Columnas y Secuencias ABCD"
    )
    proj_name = str(compact.get("proyecto") or diag.get("proyecto") or "Ferrobamba").upper()
    d_cell(3, 2, f"{subtitle_txt} | PROYECTO: {proj_name}", font=font_subtitle)

    total_filas = compact.get("familia1", {}).get("total_registros", diag.get("total_filas_procesadas", 0))
    total_fields = compact.get("familia2", {}).get("total_fields", total_filas * (24 if "COMPACT" in str(formato_tipo) else 34))
    total_vacios = sum(1 for i in filtered if i.get("tipo_incidencia") == "VACIO")
    total_advertencias = sum(1 for i in filtered if i.get("tipo_incidencia") == "ADVERTENCIA")
    total_alertas = sum(1 for i in filtered if i.get("tipo_incidencia") == "ALERTA")
    total_correctos = max(0, total_fields - (total_vacios + total_advertencias + total_alertas))
    pct_integridad = (total_correctos / max(1, total_fields)) * 100

    total_celdas = len(compact.get("resumen_por_celda", diag.get("resumen_por_celda", {})))

    # Tarjetas KPI Superiores
    d_kpi(5, 2, "CELDAS EVALUADAS", total_celdas, fill_kpi_gray, font_kpi_val_blue)
    d_kpi(5, 4, "MUESTRAS REGISTRADAS", total_filas, fill_kpi_gray, font_kpi_val_blue)
    d_kpi(5, 6, "INTEGRIDAD GLOBAL", f"{pct_integridad:.2f}%", fill_accent_green, font_kpi_val_green)
    d_kpi(5, 8, "ALERTAS CRÍTICAS", total_alertas, fill_accent_red, font_kpi_val_red)
    d_kpi(5, 10, "ADVERTENCIAS", total_advertencias, fill_accent_orange, font_kpi_val_orange)

    # 1. Tabla: Desempeño por Campaña (solo si existen campañas registradas)
    dist_camp = compact.get("distribucion_campania", [])
    has_real_campaigns = any(str(r.get("campania", "")).strip() not in ["N/A", "Sin Campaña", ""] for r in dist_camp)

    r_camp = 11
    if has_real_campaigns:
        d_cell(9, 2, "DESEMPEÑO DE CONTROL POR CAMPAÑA", font=font_section)
        headers_camp = ["Campaña", "Muestras", "Celdas Afectadas", "Muestras Afectadas", "Alertas (N)", "% Alertas", "Vacíos (N)", "% Vacíos"]
        for idx, col in enumerate(headers_camp, start=2):
            d_cell(10, idx, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin)

        for row in dist_camp:
            rf = fill_zebra if r_camp % 2 == 0 else None
            d_cell(r_camp, 2, str(row.get("campania")), font=font_bold, alignment=alignment_center, border=border_thin, fill=rf)
            d_cell(r_camp, 3, safe_int(row.get("registros")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
            d_cell(r_camp, 4, safe_int(row.get("celdas_afectadas")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
            d_cell(r_camp, 5, safe_int(row.get("registros_afectados", row.get("registros"))), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
            d_cell(r_camp, 6, safe_int(row.get("alertas_cant")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
            d_cell(r_camp, 7, safe_float(row.get("alertas_pct")) / 100.0, alignment=alignment_right, num_fmt='0.00%', border=border_thin, fill=rf)
            d_cell(r_camp, 8, safe_int(row.get("vacios_cant")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
            d_cell(r_camp, 9, safe_float(row.get("vacios_pct")) / 100.0, alignment=alignment_right, num_fmt='0.00%', border=border_thin, fill=rf)
            r_camp += 1
    else:
        r_camp = 9

    # 2. Tabla: Distribución por Tipo Litológico
    r_lito = r_camp + (2 if has_real_campaigns else 0)
    d_cell(r_lito, 2, "DISTRIBUCIÓN POR TIPO LITOLÓGICO", font=font_section)
    headers_lito = ["Tipo Litológico", "Muestras", "Celdas Afectadas", "Alertas (N)", "% Alertas", "Vacíos (N)", "% Vacíos"]
    for idx, col in enumerate(headers_lito, start=2):
        d_cell(r_lito + 1, idx, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin)

    curr_l_r = r_lito + 2
    for row in compact.get("distribucion_litologia", []):
        rf = fill_zebra if curr_l_r % 2 == 0 else None
        d_cell(curr_l_r, 2, str(row.get("tipo_litologico")), font=font_bold, alignment=alignment_left, border=border_thin, fill=rf)
        d_cell(curr_l_r, 3, safe_int(row.get("registros")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(curr_l_r, 4, safe_int(row.get("celdas_afectadas", 0)), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(curr_l_r, 5, safe_int(row.get("alertas_cant")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(curr_l_r, 6, safe_float(row.get("alertas_pct")) / 100.0, alignment=alignment_right, num_fmt='0.00%', border=border_thin, fill=rf)
        d_cell(curr_l_r, 7, safe_int(row.get("vacios_cant")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(curr_l_r, 8, safe_float(row.get("vacios_pct")) / 100.0, alignment=alignment_right, num_fmt='0.00%', border=border_thin, fill=rf)
        curr_l_r += 1

    # 3. Tabla: Top 5 Celdas con Mayor Incidencia
    r_worst = curr_l_r + 2
    d_cell(r_worst, 2, "TOP 5 CELDAS CON MAYOR INCIDENCIA", font=font_section)
    headers_worst = ["Celda Mapeo", "Muestras", "Alertas (N)", "Advertencias (N)", "Vacíos (N)"]
    for idx, col in enumerate(headers_worst, start=2):
        d_cell(r_worst + 1, idx, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin)

    curr_w_r = r_worst + 2
    for row in compact.get("worst_cells", [])[:5]:
        rf = fill_zebra if curr_w_r % 2 == 0 else None
        d_cell(curr_w_r, 2, str(row.get("celda")), font=font_bold, alignment=alignment_left, border=border_thin, fill=rf)
        d_cell(curr_w_r, 3, safe_int(row.get("total_muestras", 4)), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(curr_w_r, 4, safe_int(row.get("alertas")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(curr_w_r, 5, safe_int(row.get("advertencias")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(curr_w_r, 6, safe_int(row.get("vacios")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        curr_w_r += 1

    # 4. Tabla: Integridad de Secuencias ABCD por Celda
    r_abcd = curr_w_r + 2
    d_cell(r_abcd, 2, "INTEGRIDAD DE SECUENCIAS ABCD POR CELDA", font=font_section)
    headers_abcd = ["Estado de Secuencia", "Total Celdas (N)", "% Cumplimiento"]
    for idx, col in enumerate(headers_abcd, start=2):
        d_cell(r_abcd + 1, idx, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin)

    integ = compact.get("integridad_celdas", {})
    tot_c = max(1, total_celdas)
    abcd_rows = [
        ("Correctas (4/4 ABCD)", integ.get("correctas_abcd", 0)),
        ("En Desorden", integ.get("desorden_abcd", 0)),
        ("Incompletas (< 4)", integ.get("incompletas_abcd", 0)),
        ("Excedentes (> 4)", integ.get("excedentes_abcd", 0)),
        ("Anómalas (#ERR)", integ.get("anomalas_abcd", 0)),
    ]

    curr_a_r = r_abcd + 2
    for label, count in abcd_rows:
        rf = fill_zebra if curr_a_r % 2 == 0 else None
        d_cell(curr_a_r, 2, label, font=font_bold, alignment=alignment_left, border=border_thin, fill=rf)
        d_cell(curr_a_r, 3, safe_int(count), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(curr_a_r, 4, count / tot_c, alignment=alignment_right, num_fmt='0.00%', border=border_thin, fill=rf)
        curr_a_r += 1

    # 5. Tabla: Principales Desviaciones Críticas (Columna Derecha)
    d_cell(9, 10, "PRINCIPALES DESVIACIONES CRÍTICAS", font=font_section)
    headers_top = ["Regla de Consistencia", "Cantidad (N)", "% Incidencia"]
    for idx, col in enumerate(headers_top, start=10):
        d_cell(10, idx, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin)

    top_alertas = compact.get("top_5_alertas", [])
    if not top_alertas:
        top_alertas = compact.get("error_types_detailed", {}).get("alertas", [])[:5]

    for idx, a in enumerate(top_alertas[:5]):
        r_top = 11 + idx
        rf = fill_zebra if r_top % 2 == 0 else None
        pct = safe_float(a.get("pct", a.get("cantidad", 0) / max(1, total_alertas) * 100)) / 100.0
        d_cell(r_top, 10, a.get("mensaje", "Desviación Crítica"), font=font_regular, alignment=alignment_left, border=border_thin, fill=rf)
        d_cell(r_top, 11, safe_int(a.get("cantidad")), alignment=alignment_right, num_fmt='#,##0', border=border_thin, fill=rf)
        d_cell(r_top, 12, pct, alignment=alignment_right, num_fmt='0.00%', border=border_thin, fill=rf)

    max_d_row = max(dash_grid.keys()) if dash_grid else 16
    dash_rows = []
    for r in range(1, max_d_row + 1):
        cols_dict = dash_grid.get(r)
        if not cols_dict:
            dash_rows.append([])
        else:
            max_c = max(cols_dict.keys())
            dash_rows.append([cols_dict.get(c) for c in range(1, max_c + 1)])
    dash_grid.clear()

    ws_dash.column_dimensions['A'].width = 3
    for ci, w in _compute_sample_widths(dash_rows[:19]).items():
        ws_dash.column_dimensions[get_column_letter(ci)].width = w
    for row_cells in dash_rows:
        ws_dash.append(row_cells)
    dash_rows.clear()

    # Gráfica Nativa de Excel
    if len(top_alertas) > 0:
        chart = BarChart()
        chart.type = "col"
        chart.style = 10
        chart.title = "Frecuencia de Desviaciones Críticas Detectadas"
        chart.y_axis.title = "Cantidad de Ocurrencias"
        chart.x_axis.title = "Regla de Consistencia"
        max_r_chart = 10 + len(top_alertas[:5])
        chart_data = Reference(ws_dash, min_col=11, min_row=10, max_row=max_r_chart)
        chart_cats = Reference(ws_dash, min_col=10, min_row=11, max_row=max_r_chart)
        chart.add_data(chart_data, titles_from_data=True)
        chart.set_categories(chart_cats)
        chart.legend = None
        chart.width = 16
        chart.height = 10
        ws_dash.add_chart(chart, "J18")

    # =========================================================================
    # --- HOJA 2: REGISTRO MAESTRO DE ERRORES (CATÁLOGO / ÍNDICE) ---
    # =========================================================================
    ws_cat = wb.create_sheet(title="📋 Catálogo de Errores")
    ws_cat.views.sheetView[0].showGridLines = True

    all_campaigns = sorted(
        set(
            [str(row.get("campania")) for row in compact.get("distribucion_campania", []) if row.get("campania") and str(row.get("campania")) not in ["N/A", "None", "", "Sin Campaña"]]
            + [str(inc.get("campania")) for inc in filtered if inc.get("campania") and str(inc.get("campania")) not in ["N/A", "None", "", "Sin Campaña"]]
        ),
        key=lambda x: str(x),
    )

    headers_cat = ["ID", "Gravedad", "Regla de Consistencia Evaluada", "Total (N)"]
    if all_campaigns:
        headers_cat += [f"Año {c}" for c in all_campaigns]
    headers_cat.append("Enlace Directo")

    incidencias_por_error = defaultdict(list)
    for inc in filtered:
        msg_simplificado = get_plt_incidence_category_name(inc)
        incidencias_por_error[msg_simplificado].append(inc)

    if "COMPACT" in str(formato_tipo):
        applicable_categories = [cat for code, cat in CATEGORIES_REGISTRY_PLT.items() if code in COMPACT_FIELD_CATEGORIES]
    else:
        applicable_categories = list(CATEGORIES_REGISTRY_PLT.values())

    catalog_frequencies = []
    for cat in applicable_categories:
        rule_msg = cat.name
        matches = incidencias_por_error[rule_msg]
        camp_counts = {c: sum(1 for m in matches if str(m.get("campania", "N/A")) == c) for c in all_campaigns}
        catalog_frequencies.append({
            "msg": rule_msg,
            "severity": cat.severity,
            "matches": matches,
            "count": len(matches),
            "camp_counts": camp_counts,
        })

    catalog_frequencies = sorted(catalog_frequencies, key=lambda x: x["count"], reverse=True)

    cat_rows = [
        [],
        [None, make_wo_cell(ws_cat, "REGISTRO MAESTRO DE REGLAS DE CONSISTENCIA PLT", font=font_title)],
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
                make_wo_cell(ws_cat, f'=HYPERLINK("#{chr(39)}{tab_name}{chr(39)}!B2", "👉 Navegar a Registros")', font=font_link, alignment=alignment_center, border=border_thin)
            )
        else:
            row_cells.append(
                make_wo_cell(ws_cat, "Limpio / 0 Incidencias", font=font_clean, alignment=alignment_center, fill=fill_accent_green, border=border_thin)
            )

        cat_rows.append(row_cells)
        r_cat += 1

    ws_cat.column_dimensions['A'].width = 3
    for ci, w in _compute_sample_widths(cat_rows[:19]).items():
        ws_cat.column_dimensions[get_column_letter(ci)].width = w
    for row_cells in cat_rows:
        ws_cat.append(row_cells)
    cat_rows.clear()

    last_col_letter = get_column_letter(5 + len(all_campaigns) + 1)
    ws_cat.auto_filter.ref = f"B5:{last_col_letter}{r_cat - 1}"

    # =========================================================================
    # --- HOJA 3: DETALLE PLANO COMPLETO DE INCIDENCIAS ---
    # =========================================================================
    chunk_size = 1000000
    detail_chunks = [filtered[i:i + chunk_size] for i in range(0, len(filtered), chunk_size)]
    if not detail_chunks:
        detail_chunks = [[]]

    sev_fills = {
        "ALERTA": fill_accent_red,
        "ADVERTENCIA": fill_accent_orange,
        "VACIO": fill_accent_yellow,
    }
    headers_detail = [
        "ID",
        "Fila Excel",
        "Gravedad",
        "Celda Mapeo",
        "Muestra",
        "Campaña",
        "Tipo Litológico",
        "Nivel",
        "Columna de Falla",
        "Valor Actual",
        "Código Regla",
        "Mensaje de Inconsistencia Geomecánica",
    ]

    for chunk_idx, chunk_data in enumerate(detail_chunks):
        title = "📑 Detalle de Incidencias"
        if len(detail_chunks) > 1:
            title = f"📑 Detalle Incidencias ({chunk_idx + 1})"

        ws_detail = wb.create_sheet(title=title)
        ws_detail.views.sheetView[0].showGridLines = True

        head_rows = [
            [],
            [None, make_wo_cell(ws_detail, "REGISTRO DETALLADO DE TODAS LAS INCIDENCIAS DETECTADAS", font=font_title)],
            [None, make_wo_cell(ws_detail, "Base de datos plana de inconsistencias. Utilice los filtros en los encabezados para auditar registros específicos.", font=font_subtitle)],
            [],
            [None] + [make_wo_cell(ws_detail, col, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin) for col in headers_detail],
        ]

        grid_heading_row = 5
        r_detail_start = 6

        def _build_detail_row(d_idx: int, r_detail: int, inc: dict) -> list:
            sev = inc.get("tipo_incidencia", "ALERTA")
            sev_fill = sev_fills.get(sev, fill_accent_yellow)
            row_zebra = fill_zebra if (r_detail % 2 == 0) else None
            raw_val = inc.get("valor_actual")
            val_str = "—" if raw_val is None or str(raw_val).strip() in ["", "-1"] else str(raw_val)
            return [
                None,
                make_wo_cell(ws_detail, d_idx, font=font_regular, fill=row_zebra, border=border_thin, alignment=alignment_center),
                make_wo_cell(ws_detail, safe_int(inc.get("fila_excel")), fill=row_zebra, border=border_thin, alignment=alignment_center),
                make_wo_cell(ws_detail, sev, font=font_bold, fill=sev_fill, border=border_thin, alignment=alignment_center),
                make_wo_cell(ws_detail, str(inc.get("celda_mapeo", inc.get("celda_padre", "—"))), fill=row_zebra, border=border_thin, alignment=alignment_left),
                make_wo_cell(ws_detail, str(inc.get("muestra", inc.get("celda_hija", "—"))), fill=row_zebra, border=border_thin, alignment=alignment_center),
                make_wo_cell(ws_detail, str(inc.get("campania", "—")), fill=row_zebra, border=border_thin, alignment=alignment_center),
                make_wo_cell(ws_detail, str(inc.get("tipo_litologico", "—")), fill=row_zebra, border=border_thin, alignment=alignment_left),
                make_wo_cell(ws_detail, str(inc.get("nivel", "—")), fill=row_zebra, border=border_thin, alignment=alignment_center),
                make_wo_cell(ws_detail, str(inc.get("columna", "—")), fill=row_zebra, border=border_thin, alignment=alignment_left),
                make_wo_cell(ws_detail, val_str, fill=row_zebra, border=border_thin, alignment=alignment_center),
                make_wo_cell(ws_detail, str(inc.get("rule_code", "—")), fill=row_zebra, border=border_thin, alignment=alignment_center),
                make_wo_cell(ws_detail, str(inc.get("mensaje", "—")), fill=row_zebra, border=border_thin, alignment=alignment_left),
            ]

        sample_rows = list(head_rows)
        for d_idx in range(1, min(14, len(chunk_data)) + 1):
            sample_rows.append(_build_detail_row(d_idx, r_detail_start + d_idx - 1, chunk_data[d_idx - 1]))

        ws_detail.column_dimensions['A'].width = 3
        for ci, w in _compute_sample_widths(sample_rows[:19]).items():
            ws_detail.column_dimensions[get_column_letter(ci)].width = w

        for sr in sample_rows:
            ws_detail.append(sr)
        for d_idx in range(15, len(chunk_data) + 1):
            ws_detail.append(_build_detail_row(d_idx, r_detail_start + d_idx - 1, chunk_data[d_idx - 1]))

        end_detail_row = max(grid_heading_row + 1, r_detail_start + len(chunk_data) - 1)
        ws_detail.auto_filter.ref = f"B{grid_heading_row}:M{end_detail_row}"

    # =========================================================================
    # --- HOJAS 4+: DETALLES INDIVIDUALES POR REGLA DE ERROR ---
    # =========================================================================
    headers_inc = [
        "Fila Excel",
        "Celda Mapeo",
        "Muestra",
        "Campaña",
        "Tipo Litológico",
        "Nivel",
        "Columna de Falla",
        "Valor Actual",
        "Mensaje de Inconsistencia",
    ]
    max_allowed_err = 1000000

    for orig_msg, mapping_data in active_sheets_mapping.items():
        sh_name = mapping_data["tab_name"]
        err_records = mapping_data["records"]

        ws_err = wb.create_sheet(title=sh_name)
        ws_err.views.sheetView[0].showGridLines = True
        for ci, w in err_widths.items():
            ws_err.column_dimensions[get_column_letter(ci)].width = w

        st_affected = len(set(x.get("celda_mapeo", x.get("celda_padre", "N/A")) for x in err_records))
        tot_affected = len(err_records)

        r_dist_yr = defaultdict(int)
        for r in err_records:
            r_dist_yr[str(r.get("campania", "N/A"))] += 1
        unique_years = sorted(list(set(str(r.get("campania", "N/A")) for r in err_records)))

        rule_group = defaultdict(list)
        for r in err_records:
            rule_group[r.get("rule_code", "Desconocido")].append(r)
        rule_stats = sorted(
            [
                {"rule_code": rc, "total": len(recs), "yr_counts": Counter(str(r.get("campania", "N/A")) for r in recs)}
                for rc, recs in rule_group.items()
            ],
            key=lambda x: x["total"],
            reverse=True,
        )

        msg_group = defaultdict(list)
        for r in err_records:
            msg_group[r.get("mensaje", "Desconocido")].append(r)
        msg_stats = sorted(
            [
                {"message": mv, "total": len(recs), "yr_counts": Counter(str(r.get("campania", "N/A")) for r in recs)}
                for mv, recs in msg_group.items()
            ],
            key=lambda x: x["total"],
            reverse=True,
        )

        dist_table_height = len(r_dist_yr)
        jump_link_row = 12 + dist_table_height + 1
        table_a_start = jump_link_row + 2
        table_a_height = 2 + len(rule_stats)

        truncated_err = len(err_records) > max_allowed_err
        err_records_to_write = err_records[:max_allowed_err]

        indiv_start = table_a_start + table_a_height + 2
        indiv_height = 2 + len(err_records_to_write) + (1 if truncated_err else 0)
        table_b_start = indiv_start + indiv_height + 2

        ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=5, max_col=7, max_row=5))
        ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=7, max_col=3, max_row=7))
        ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=8, max_col=3, max_row=8))
        ws_err.merged_cells.ranges.add(CellRange(min_col=4, min_row=7, max_col=5, max_row=7))
        ws_err.merged_cells.ranges.add(CellRange(min_col=4, min_row=8, max_col=5, max_row=8))

        ws_err.append([])
        ws_err.append([None, make_wo_cell(ws_err, '=HYPERLINK("#\'📋 Catálogo de Errores\'!B2", "⬅️ Volver al Registro Maestro de Errores")', font=font_link, alignment=alignment_left)])
        ws_err.append([])
        ws_err.append([None, make_wo_cell(ws_err, "ANÁLISIS DE INCIDENCIA EN BASE DE DATOS", font=font_section)])
        ws_err.append([None, make_wo_cell(ws_err, f"Regla: {orig_msg.upper()}", font=font_err_banner, fill=fill_accent_red, border=border_thin)])
        ws_err.append([])
        ws_err.append([
            None,
            make_wo_cell(ws_err, "CELDAS AFECTADAS", font=font_kpi_lbl, alignment=alignment_center, fill=fill_kpi_gray, border=border_kpi),
            make_wo_cell(ws_err, None, fill=fill_kpi_gray, border=border_kpi),
            make_wo_cell(ws_err, "MUESTRAS AFECTADAS (CANTIDAD)", font=font_kpi_lbl, alignment=alignment_center, fill=fill_kpi_gray, border=border_kpi),
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
        ws_err.append([None, make_wo_cell(ws_err, f'=HYPERLINK("#\'{sh_name}\'!B{table_b_start}", "⬇️ Ir a Métricas de Mensajes de Inconsistencia Únicos (al final de la hoja)")', font=font_link, alignment=alignment_left)])
        ws_err.append([])
        ws_err.append([None, make_wo_cell(ws_err, "MÉTRICAS POR REGLA ESPECÍFICA (CÓDIGO)", font=font_section)])

        ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=table_a_start + 1, max_col=4, max_row=table_a_start + 1))
        headers_a = ["Ocurrencias Totales"] + [f"Año {y}" if y != "N/A" else "N/A" for y in unique_years]
        ws_err.append(
            [
                None,
                make_wo_cell(ws_err, "Código de Regla", font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin),
                make_wo_cell(ws_err, None, fill=fill_primary, border=border_thin),
                make_wo_cell(ws_err, None, fill=fill_primary, border=border_thin),
            ]
            + [make_wo_cell(ws_err, h, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin) for h in headers_a]
        )

        for idx, stat in enumerate(rule_stats):
            r_row = table_a_start + 2 + idx
            rf = fill_zebra if r_row % 2 == 0 else None
            ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=r_row, max_col=4, max_row=r_row))
            ws_err.append(
                [
                    None,
                    make_wo_cell(ws_err, stat["rule_code"], font=font_bold, alignment=alignment_center, fill=rf, border=border_thin),
                    make_wo_cell(ws_err, None, fill=rf, border=border_thin),
                    make_wo_cell(ws_err, None, fill=rf, border=border_thin),
                    make_wo_cell(ws_err, stat["total"], font=font_bold, alignment=alignment_right, num_fmt='#,##0', fill=rf, border=border_thin),
                ]
                + [make_wo_cell(ws_err, stat["yr_counts"].get(yr, 0), font=font_regular, alignment=alignment_right, num_fmt='#,##0', fill=rf, border=border_thin) for yr in unique_years]
            )

        ws_err.append([])
        ws_err.append([])
        ws_err.append([None, make_wo_cell(ws_err, "REGISTROS INDIVIDUALES AFECTADOS (LISTADO COMPLETO)", font=font_section)])

        header_row_idx = indiv_start + 1
        ws_err.append([None] + [make_wo_cell(ws_err, h_name, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin) for h_name in headers_inc])

        start_data_row = indiv_start + 2
        curr_row = start_data_row
        for inc_item in err_records_to_write:
            row_zebra = fill_zebra if (curr_row <= start_data_row + 150 and curr_row % 2 == 0) else None
            raw_val = inc_item.get("valor_actual")
            val_str = "—" if raw_val is None or str(raw_val).strip() in ["", "-1"] else str(raw_val)
            row_vals = [
                safe_int(inc_item.get("fila_excel")),
                str(inc_item.get("celda_mapeo", inc_item.get("celda_padre", "—"))),
                str(inc_item.get("muestra", inc_item.get("celda_hija", "—"))),
                str(inc_item.get("campania", "—")),
                str(inc_item.get("tipo_litologico", "—")),
                str(inc_item.get("nivel", "—")),
                str(inc_item.get("columna", "—")),
                val_str,
                str(inc_item.get("mensaje", "—")),
            ]
            row_cells = [None]
            for c_idx, val in enumerate(row_vals, start=2):
                align = alignment_center if c_idx in (2, 3, 4, 5, 7, 9) else alignment_left
                row_cells.append(make_wo_cell(ws_err, val, fill=row_zebra, border=border_thin, alignment=align))
            ws_err.append(row_cells)
            curr_row += 1

        if truncated_err:
            ws_err.append([
                None,
                make_wo_cell(ws_err, None, border=border_thin, alignment=alignment_center),
                make_wo_cell(ws_err, "--- REPORTE TRUNCADO: SE SUPERÓ EL LÍMITE DE FILAS DE EXCEL (1,048,576) ---", border=border_thin, alignment=alignment_center),
            ] + [make_wo_cell(ws_err, None, border=border_thin) for _ in range(7)])

        end_data_row = start_data_row + len(err_records_to_write) - 1 + (1 if truncated_err else 0)
        ws_err.auto_filter.ref = f"B{header_row_idx}:J{end_data_row}"

        ws_err.append([])
        ws_err.append([])
        ws_err.append([
            None,
            make_wo_cell(ws_err, "MÉTRICAS POR MENSAJE DE INCONSISTENCIA GEOMECÁNICA ÚNICO", font=font_section),
            None,
            None,
            make_wo_cell(ws_err, f'=HYPERLINK("#\'{sh_name}\'!B2", "⬆️ Volver al Inicio de la Hoja")', font=font_link, alignment=alignment_left),
        ])

        ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=table_b_start + 1, max_col=7, max_row=table_b_start + 1))
        headers_b = ["Ocurrencias Totales"] + [f"Año {y}" if y != "N/A" else "N/A" for y in unique_years]
        ws_err.append(
            [
                None,
                make_wo_cell(ws_err, "Mensaje de Inconsistencia Geomecánica Único", font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin),
            ]
            + [make_wo_cell(ws_err, None, fill=fill_primary, border=border_thin) for _ in range(5)]
            + [make_wo_cell(ws_err, h, font=font_header, fill=fill_primary, alignment=alignment_center, border=border_thin) for h in headers_b]
        )

        for idx, stat in enumerate(msg_stats):
            r_row = table_b_start + 2 + idx
            rf = fill_zebra if r_row % 2 == 0 else None
            ws_err.merged_cells.ranges.add(CellRange(min_col=2, min_row=r_row, max_col=7, max_row=r_row))
            ws_err.append(
                [
                    None,
                    make_wo_cell(ws_err, stat["message"], font=font_regular, alignment=alignment_left, fill=rf, border=border_thin),
                ]
                + [make_wo_cell(ws_err, None, fill=rf, border=border_thin) for _ in range(5)]
                + [make_wo_cell(ws_err, stat["total"], font=font_bold, alignment=alignment_right, num_fmt='#,##0', fill=rf, border=border_thin)]
                + [make_wo_cell(ws_err, stat["yr_counts"].get(yr, 0), font=font_regular, alignment=alignment_right, num_fmt='#,##0', fill=rf, border=border_thin) for yr in unique_years]
            )

    return wb


# Alias para retrocompatibilidad
generar_excel_reporte_plt = export_plt_audit_to_excel
generar_excel_reporte_core_plt = export_plt_audit_to_excel
