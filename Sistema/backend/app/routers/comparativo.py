"""
comparativo.py — Router independiente para generar reportes Excel comparativos
entre dos auditorias geomecanicas. Completamente desacoplado de auditoria.py.
"""
import os
import gc
import json
import math
import shutil
import tempfile
from datetime import datetime
from collections import Counter, defaultdict

import openpyxl
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, Reference
from openpyxl.worksheet.cell_range import CellRange
from fastapi import APIRouter, File, UploadFile, HTTPException, Form

from app.utils.validator import validate_bulk_excel, sanitize_value, format_raw_value_for_report
from app.core.catalogs import MANDATORY_COLS_COUNT
from app.core.rules import RULES_REGISTRY, CATEGORIES_REGISTRY
from app.core.audit_helpers import (
    safe_int,
    safe_float,
    get_safe_sheet_name,
    get_incidence_category_name,
)
from app.core.excel_styles import (
    get_styles,
    make_wo_cell,
    dedup_pandas_headers,
    save_upload_to_temp,
    wb_to_temp_file_response,
)

router = APIRouter()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
uploads_dir = os.path.join(BASE_DIR, "uploads")

# Map local legacy names to centralized implementations
_safe_int = safe_int
_safe_float = safe_float
_get_safe_sheet_name = get_safe_sheet_name
_make_styles = get_styles

# ─── Lógica de comparación con intersección de campañas ───────────────────────

def _build_key_set(incs: list) -> set:
    return {(i.get("celda_padre",""), i.get("columna",""), i.get("rule_code","")) for i in incs}

def _build_key_map(incs: list) -> dict:
    m = {}
    for i in incs:
        k = (i.get("celda_padre",""), i.get("columna",""), i.get("rule_code",""))
        if k not in m:
            m[k] = i
    return m

_PANDAS_NA_STRINGS_CMP = frozenset({
    "", "#N/A", "#N/A N/A", "#NA", "-1.#IND", "-1.#QNAN",
    "-NaN", "-nan", "1.#IND", "1.#QNAN", "<NA>", "N/A",
    "NA", "NULL", "NaN", "None", "n/a", "nan", "null",
    "#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!",
})


def _is_pd_na_cmp(val) -> bool:
    if val is None:
        return True
    if isinstance(val, float) and math.isnan(val):
        return True
    if isinstance(val, str) and val in _PANDAS_NA_STRINGS_CMP:
        return True
    return False


def _clean_rename_col_list(raw_cols: list) -> list:
    cols = []
    cota_seen, celda_seen, dip_seen = 0, 0, 0
    for col in raw_cols:
        col_str = str(col).strip()
        if "." in col_str:
            parts = col_str.split(".")
            base_name = ".".join(parts[:-1]).strip()
            if parts[-1].isdigit():
                if base_name == "DIP":
                    cols.append("DIP_ESTRUC")
                    continue
                elif base_name in ("CELDA", "COTA"):
                    col_str = base_name
        if col_str == "COTA":
            if cota_seen == 0:
                cols.append("COTA_FROM")
                cota_seen += 1
            else:
                cols.append("COTA_TO")
        elif col_str == "CELDA":
            if celda_seen == 0:
                cols.append("CELDA_PADRE")
                celda_seen += 1
            else:
                cols.append("CELDA_DUPLICADA_IGNORE")
        elif col_str == "DIP":
            if dip_seen == 0:
                cols.append("DIP")
                dip_seen += 1
            else:
                cols.append("DIP_ESTRUC")
        else:
            cols.append(col_str)
    return cols


def _load_values_from_excel(excel_path, keys_to_query):
    values_map = {}
    celda_counts = {}
    if not keys_to_query or not excel_path or not os.path.exists(excel_path):
        return values_map, celda_counts
    wb = None
    try:
        wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
        ws = wb.worksheets[0]
        row_iter = ws.iter_rows(values_only=True)
        raw_header = next(row_iter, None)
        if not raw_header:
            return values_map, celda_counts

        clean_cols = _clean_rename_col_list(dedup_pandas_headers(raw_header))
        col_to_idx = {}
        for idx, cname in enumerate(clean_cols):
            if cname not in col_to_idx:
                col_to_idx[cname] = idx

        celda_col_idx = col_to_idx.get("CELDA_PADRE")
        if celda_col_idx is None:
            return values_map, celda_counts

        targets_by_cp_nth = defaultdict(list)
        for celda_p, n_th, columna in keys_to_query:
            ci = col_to_idx.get(columna)
            if ci is not None:
                targets_by_cp_nth[(celda_p, n_th)].append((columna, ci))

        last_cp = None
        pending_empty = 0
        neg_markers = (-1, -1.0, "-1", "-1.0")

        for raw_row in row_iter:
            row_has_data = False
            for v in raw_row:
                if v is not None and not _is_pd_na_cmp(v):
                    row_has_data = True
                    break
            if not row_has_data:
                if last_cp is not None:
                    pending_empty += 1
                continue

            if pending_empty:
                if last_cp is not None:
                    celda_counts[last_cp] = celda_counts.get(last_cp, 0) + pending_empty
                pending_empty = 0

            r_len = len(raw_row)
            cval = raw_row[celda_col_idx] if celda_col_idx < r_len else None
            if not _is_pd_na_cmp(cval) and cval not in neg_markers:
                cp_clean = sanitize_value(cval, str)
                if cp_clean:
                    last_cp = cp_clean

            if not last_cp:
                continue

            nth = celda_counts.get(last_cp, 0) + 1
            celda_counts[last_cp] = nth

            tcols = targets_by_cp_nth.get((last_cp, nth))
            if tcols:
                for col_name, ci in tcols:
                    val = raw_row[ci] if ci < r_len else None
                    if not _is_pd_na_cmp(val):
                        values_map[(last_cp, nth, col_name)] = val
    except Exception as e:
        print(f"Error loading Excel for comparison values ({excel_path}): {e}")
    finally:
        if wb is not None:
            try:
                wb.close()
            except Exception:
                pass
    return values_map, celda_counts

def _compare_audits(diag_a, compact_a, diag_b, compact_b, excel_path_a=None, excel_path_b=None) -> dict:
    inc_a = diag_a.get("incidencias", [])
    inc_b = diag_b.get("incidencias", [])

    # 1. Analizar e intersectar campañas para comparación justa
    campanias_a = {str(i.get("campania")) for i in inc_a if i.get("campania")}
    campanias_b = {str(i.get("campania")) for i in inc_b if i.get("campania")}
    campanias_a.discard("N/A"); campanias_a.discard("")
    campanias_b.discard("N/A"); campanias_b.discard("")
    
    common_campaigns = campanias_a & campanias_b
    has_camp_mismatch = (campanias_a != campanias_b)
    is_filtered_by_common = False
    
    # Filtrar incidencias si hay desajuste y existen campañas comunes
    if has_camp_mismatch and len(common_campaigns) > 0:
        is_filtered_by_common = True
        inc_a_filtered = [i for i in inc_a if str(i.get("campania")) in common_campaigns]
        inc_b_filtered = [i for i in inc_b if str(i.get("campania")) in common_campaigns]
    else:
        inc_a_filtered = inc_a
        inc_b_filtered = inc_b

    keys_a = _build_key_set(inc_a_filtered)
    keys_b = _build_key_set(inc_b_filtered)
    map_a  = _build_key_map(inc_a_filtered)
    map_b  = _build_key_map(inc_b_filtered)

    new_keys      = keys_b - keys_a
    resolved_keys = keys_a - keys_b
    persistent    = keys_a & keys_b

    # Construir conjuntos de consulta para la carga optimizada de Excel
    keys_to_query_b = set()
    for k in resolved_keys:
        rec_a = map_a.get(k)
        if rec_a:
            celda_p = rec_a.get("celda_padre", "")
            celda_h = rec_a.get("celda_hija", "")
            columna = rec_a.get("columna", "")
            n_th = 1
            if celda_h and "-" in celda_h:
                parts = celda_h.split("-")
                if len(parts) >= 2 and parts[-1].isdigit():
                    n_th = int(parts[-1])
            keys_to_query_b.add((celda_p, n_th, columna))
            
    keys_to_query_a = set()
    for k in new_keys:
        rec_b = map_b.get(k)
        if rec_b:
            celda_p = rec_b.get("celda_padre", "")
            celda_h = rec_b.get("celda_hija", "")
            columna = rec_b.get("columna", "")
            n_th = 1
            if celda_h and "-" in celda_h:
                parts = celda_h.split("-")
                if len(parts) >= 2 and parts[-1].isdigit():
                    n_th = int(parts[-1])
            keys_to_query_a.add((celda_p, n_th, columna))

    values_map_a, celda_counts_a = _load_values_from_excel(excel_path_a, keys_to_query_a)
    values_map_b, celda_counts_b = _load_values_from_excel(excel_path_b, keys_to_query_b)

    fam1_a = compact_a.get("familia1", {})
    fam2_a = compact_a.get("familia2", {})
    fam1_b = compact_b.get("familia1", {})
    fam2_b = compact_b.get("familia2", {})

    total_filas_a = _safe_int(fam1_a.get("total_discontinuidades", 0))
    total_filas_b = _safe_int(fam1_b.get("total_discontinuidades", 0))
    celdas_a      = len(compact_a.get("resumen_por_celda_padre", {}))
    celdas_b      = len(compact_b.get("resumen_por_celda_padre", {}))
    
    # Recalcular KPIs basados en el filtro si aplica
    if is_filtered_by_common:
        alertas_a = sum(1 for i in inc_a_filtered if i.get("tipo_incidencia") == "ALERTA")
        alertas_b = sum(1 for i in inc_b_filtered if i.get("tipo_incidencia") == "ALERTA")
        vacios_a  = sum(1 for i in inc_a_filtered if i.get("tipo_incidencia") == "VACIO")
        vacios_b  = sum(1 for i in inc_b_filtered if i.get("tipo_incidencia") == "VACIO")
        adv_a     = sum(1 for i in inc_a_filtered if i.get("tipo_incidencia") == "ADVERTENCIA")
        adv_b     = sum(1 for i in inc_b_filtered if i.get("tipo_incidencia") == "ADVERTENCIA")
        
        celdas_a  = len({i.get("celda_padre") for i in inc_a_filtered if i.get("celda_padre")})
        celdas_b  = len({i.get("celda_padre") for i in inc_b_filtered if i.get("celda_padre")})
        
        # Estimar cantidad de discontinuidades/filas de campañas comunes
        total_filas_a = len({i.get("fila_excel") for i in inc_a_filtered if i.get("fila_excel")})
        total_filas_b = len({i.get("fila_excel") for i in inc_b_filtered if i.get("fila_excel")})
    else:
        alertas_a = _safe_int(fam2_a.get("total_alertas", 0))
        alertas_b = _safe_int(fam2_b.get("total_alertas", 0))
        vacios_a  = _safe_int(fam2_a.get("total_vacios", 0))
        vacios_b  = _safe_int(fam2_b.get("total_vacios", 0))
        adv_a     = _safe_int(fam2_a.get("total_advertencias", 0))
        adv_b     = _safe_int(fam2_b.get("total_advertencias", 0))

    fields_a = total_filas_a * MANDATORY_COLS_COUNT
    fields_b = total_filas_b * MANDATORY_COLS_COUNT
    correctos_a = fields_a - alertas_a - vacios_a - adv_a
    correctos_b = fields_b - alertas_b - vacios_b - adv_b
    integrid_a = (correctos_a / max(1, fields_a)) * 100.0
    integrid_b = (correctos_b / max(1, fields_b)) * 100.0

    # Top errores A y B
    top_a = Counter(i.get("rule_code", i.get("mensaje","?")) for i in inc_a_filtered if i.get("tipo_incidencia")=="ALERTA")
    top_b = Counter(i.get("rule_code", i.get("mensaje","?")) for i in inc_b_filtered if i.get("tipo_incidencia")=="ALERTA")
    all_err_keys = set(top_a.keys()) | set(top_b.keys())
    top_errors = sorted(
        [{"codigo": k, "cant_a": top_a.get(k,0), "cant_b": top_b.get(k,0)} for k in all_err_keys],
        key=lambda x: max(x["cant_a"], x["cant_b"]), reverse=True
    )[:15]

    # Distribución por campaña
    camp_map = defaultdict(lambda: {"alertas_a":0,"vacios_a":0,"adv_a":0,"celdas_a":set(),
                                     "alertas_b":0,"vacios_b":0,"adv_b":0,"celdas_b":set()})
    for i in inc_a_filtered:
        c = str(i.get("campania","N/A")); t = i.get("tipo_incidencia","")
        camp_map[c]["celdas_a"].add(i.get("celda_padre",""))
        if t=="ALERTA": camp_map[c]["alertas_a"]+=1
        elif t=="VACIO": camp_map[c]["vacios_a"]+=1
        elif t=="ADVERTENCIA": camp_map[c]["adv_a"]+=1
    for i in inc_b_filtered:
        c = str(i.get("campania","N/A")); t = i.get("tipo_incidencia","")
        camp_map[c]["celdas_b"].add(i.get("celda_padre",""))
        if t=="ALERTA": camp_map[c]["alertas_b"]+=1
        elif t=="VACIO": camp_map[c]["vacios_b"]+=1
        elif t=="ADVERTENCIA": camp_map[c]["adv_b"]+=1

    dist_campana = sorted([{
        "campania": c,
        "celdas_a": len(v["celdas_a"]), "celdas_b": len(v["celdas_b"]),
        "alertas_a": v["alertas_a"],    "alertas_b": v["alertas_b"],
        "vacios_a":  v["vacios_a"],     "vacios_b":  v["vacios_b"],
        "adv_a":     v["adv_a"],        "adv_b":     v["adv_b"],
    } for c,v in camp_map.items()], key=lambda x: x["campania"])

    # Distribución por sector
    sect_map = defaultdict(lambda: {"alertas_a":0,"vacios_a":0,"celdas_a":set(),
                                     "alertas_b":0,"vacios_b":0,"celdas_b":set()})
    for i in inc_a_filtered:
        s2 = str(i.get("sector_geotecnico","N/A")); t = i.get("tipo_incidencia","")
        sect_map[s2]["celdas_a"].add(i.get("celda_padre",""))
        if t=="ALERTA": sect_map[s2]["alertas_a"]+=1
        elif t=="VACIO": sect_map[s2]["vacios_a"]+=1
    for i in inc_b_filtered:
        s2 = str(i.get("sector_geotecnico","N/A")); t = i.get("tipo_incidencia","")
        sect_map[s2]["celdas_b"].add(i.get("celda_padre",""))
        if t=="ALERTA": sect_map[s2]["alertas_b"]+=1
        elif t=="VACIO": sect_map[s2]["vacios_b"]+=1
    dist_sector = sorted([{
        "sector": s2,
        "celdas_a": len(v["celdas_a"]), "celdas_b": len(v["celdas_b"]),
        "alertas_a": v["alertas_a"],    "alertas_b": v["alertas_b"],
        "vacios_a":  v["vacios_a"],     "vacios_b":  v["vacios_b"],
    } for s2,v in sect_map.items()], key=lambda x: x["sector"])

    # Agrupar celdas
    res_a = compact_a.get("resumen_por_celda_padre", {})
    res_b = compact_b.get("resumen_por_celda_padre", {})
    all_celdas = set(res_a.keys()) | set(res_b.keys())
    celdas_peor, celdas_mejor = [], []
    for celda in all_celdas:
        da = res_a.get(celda, {"alertas":0,"vacios":0})
        db = res_b.get(celda, {"alertas":0,"vacios":0})
        d_alert = _safe_int(db.get("alertas")) - _safe_int(da.get("alertas"))
        d_vacio = _safe_int(db.get("vacios"))  - _safe_int(da.get("vacios"))
        entry = {"celda": celda, "alertas_a": da.get("alertas",0), "alertas_b": db.get("alertas",0),
                 "vacios_a": da.get("vacios",0), "vacios_b": db.get("vacios",0), "delta": d_alert}
        if d_alert > 0: celdas_peor.append(entry)
        elif d_alert < 0 or d_vacio < 0: celdas_mejor.append(entry)
    celdas_peor.sort(key=lambda x: x["delta"], reverse=True)
    celdas_mejor.sort(key=lambda x: x["delta"])

    return {
        "meta_a": {"nombre": diag_a.get("nombre_archivo","Revisión A"), "fecha": compact_a.get("fecha_auditoria","N/A"), "campanias": sorted(list(campanias_a))},
        "meta_b": {"nombre": diag_b.get("nombre_archivo","Revisión B"), "fecha": compact_b.get("fecha_auditoria","N/A"), "campanias": sorted(list(campanias_b))},
        "campanias_comunes": sorted(list(common_campaigns)),
        "is_filtered_by_common": is_filtered_by_common,
        "has_camp_mismatch": has_camp_mismatch,
        "kpis": {
            "total_filas":   (total_filas_a,  total_filas_b),
            "celdas":        (celdas_a,        celdas_b),
            "alertas":       (alertas_a,       alertas_b),
            "vacios":        (vacios_a,        vacios_b),
            "advertencias":  (adv_a,           adv_b),
            "integridad":    (integrid_a,      integrid_b),
        },
        "top_errors":   top_errors,
        "dist_campana": dist_campana,
        "dist_sector":  dist_sector,
        "celdas_peor":  celdas_peor[:20],
        "celdas_mejor": celdas_mejor[:20],
        "new_incidencias":      [map_b[k] for k in new_keys],
        "resolved_incidencias": [map_a[k] for k in resolved_keys],
        "totales": {"nuevas": len(new_keys), "resueltas": len(resolved_keys), "persistentes": len(persistent)},
        "inc_a_filtered": inc_a_filtered,
        "inc_b_filtered": inc_b_filtered,
        "values_map_a": values_map_a,
        "values_map_b": values_map_b,
        "celda_counts_a": celda_counts_a,
        "celda_counts_b": celda_counts_b,
    }

# ─── Helpers de escritura Excel (write_only streaming) ─────────────────────────

def _make_sparse_row(row_dict: dict) -> list:
    if not row_dict:
        return []
    hi = max(row_dict.keys())
    return [row_dict.get(c) for c in range(1, hi + 1)]


def _wo_header_cells(ws, cols, s, fill=None):
    f = fill or s["fill_primary"]
    return [
        make_wo_cell(
            ws, text,
            font=s["font_header"], fill=f,
            alignment=s["align_center"], border=s["border_thin"],
        )
        for text in cols
    ]


def _delta_wo_cell(ws, val_a, val_b, s, fmt_pct=False, invert=False):
    if val_a is None or val_b is None:
        return make_wo_cell(ws, "—", alignment=s["align_center"])
    delta = _safe_float(val_b) - _safe_float(val_a)
    disp = f"{delta:+.2f}%" if fmt_pct else (f"{int(delta):+d}" if delta == int(delta) else f"{delta:+.2f}")
    improved = (delta < 0) if not invert else (delta > 0)
    if delta == 0:
        return make_wo_cell(ws, disp, font=s["font_delta_gray"], alignment=s["align_center"], border=s["border_thin"])
    if improved:
        return make_wo_cell(ws, disp, font=s["font_delta_green"], fill=s["fill_green"], alignment=s["align_center"], border=s["border_thin"])
    return make_wo_cell(ws, disp, font=s["font_delta_red"], fill=s["fill_red"], alignment=s["align_center"], border=s["border_thin"])


def _kpi_card_comparativo_grid(ws, grid: dict, row: int, col: int, label: str, va, vb, s, fmt="n", invert=False):
    """
    Construye una tarjeta KPI de 3x3 celdas sobre el grid disperso del Dashboard.
    """
    ws.merged_cells.ranges.add(CellRange(min_col=col, min_row=row, max_col=col + 2, max_row=row))
    grid[row][col] = make_wo_cell(
        ws, label, font=s["font_kpi_lbl"], alignment=s["align_center"],
        fill=s["fill_kpi_gray"], border=s["border_kpi"],
    )
    grid[row][col + 1] = make_wo_cell(ws, None, border=s["border_kpi"])
    grid[row][col + 2] = make_wo_cell(ws, None, border=s["border_kpi"])

    sub_font = Font(name="Segoe UI", size=8, bold=True, color="555555")
    for i, h in enumerate(("Base (A)", "Actual (B)", "Δ")):
        grid[row + 1][col + i] = make_wo_cell(
            ws, h, font=sub_font, alignment=s["align_center"],
            fill=s["fill_kpi_gray"], border=s["border_kpi"],
        )

    fmt_val = (lambda v: f"{_safe_float(v):.2f}%") if fmt == "pct" else (lambda v: f"{_safe_int(v):,}")
    da, db = _safe_float(va), _safe_float(vb)
    delta = db - da
    improved = (delta < 0) if not invert else (delta > 0)
    if fmt == "pct":
        dstr = f"{delta:+.2f}%"
    else:
        dstr = f"{int(delta):+d}" if delta == int(delta) else f"{delta:+.2f}"

    grid[row + 2][col] = make_wo_cell(ws, fmt_val(va), font=s["font_kpi_blue"], fill=s["fill_zebra"], border=s["border_kpi"])
    grid[row + 2][col + 1] = make_wo_cell(ws, fmt_val(vb), font=s["font_kpi_blue"], fill=s["fill_zebra"], border=s["border_kpi"])
    if delta == 0:
        grid[row + 2][col + 2] = make_wo_cell(ws, "=", font=s["font_delta_gray"], fill=s["fill_zebra"], border=s["border_kpi"])
    elif improved:
        grid[row + 2][col + 2] = make_wo_cell(ws, dstr, font=s["font_delta_green"], fill=s["fill_green"], border=s["border_kpi"])
    else:
        grid[row + 2][col + 2] = make_wo_cell(ws, dstr, font=s["font_delta_red"], fill=s["fill_red"], border=s["border_kpi"])


def _compute_sample_widths(rows: list, widths: dict) -> dict:
    """Replica el auto-ajuste de ancho basado en las primeras 14 filas."""
    col_vals = defaultdict(list)
    for row in rows[:14]:
        for col_idx, cell in enumerate(row, start=1):
            if col_idx < 2 or cell is None:
                continue
            val = cell.value if hasattr(cell, "value") else cell
            if val is not None:
                val_str = str(val)
                col_vals[col_idx].append("Ver Registros" if val_str.startswith("=HYPERLINK") else val_str)
    for col_idx, vals in col_vals.items():
        if vals:
            max_len = max(len(v) for v in vals)
            widths[col_idx] = min(max(max_len + 4, 11), 52)
    return widths


# ─── Generador de Excel (write_only streaming) ────────────────────────────────

def generar_excel_comparativo_core(datos: dict) -> openpyxl.Workbook:
    s      = _make_styles()
    meta_a = datos["meta_a"]
    meta_b = datos["meta_b"]
    kpis   = datos["kpis"]
    totales = datos["totales"]

    inc_a_filtered = datos.get("inc_a_filtered", [])
    inc_b_filtered = datos.get("inc_b_filtered", [])
    values_map_a = datos.get("values_map_a", {})
    values_map_b = datos.get("values_map_b", {})
    celda_counts_a = datos.get("celda_counts_a", {})
    celda_counts_b = datos.get("celda_counts_b", {})

    wb = openpyxl.Workbook(write_only=True)

    # ── HOJA 1: DASHBOARD ──────────────────────────────────────────────────
    ws = wb.create_sheet("📊 Dashboard")
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 3
    for ci in range(2, 25):
        ws.column_dimensions[get_column_letter(ci)].width = 14
    ws.row_dimensions[2].height = 38

    dash_grid = defaultdict(dict)
    ws.merged_cells.ranges.add(CellRange("B2:P2"))
    dash_grid[2][2] = make_wo_cell(
        ws, "COMPARATIVA DE REVISIÓN Y CONTROL DE CALIDAD",
        font=s["font_title"], alignment=s["align_center"], fill=s["fill_primary"],
    )

    # Alerta o Banner si hay desajuste de campañas
    row_start_kpi = 5
    if datos["has_camp_mismatch"]:
        ws.merged_cells.ranges.add(CellRange("B4:P4"))
        if datos["is_filtered_by_common"]:
            warning_text = f"⚠️ ADVERTENCIA: Mismatch de campañas. Se filtraron solo las campañas comunes: {', '.join(datos['campanias_comunes'])}."
            fill_warn = s["fill_orange"]
            font_warn = Font(name="Segoe UI", size=9, bold=True, color="C65911")
        else:
            warning_text = f"❌ ALERTA: Desajuste total de campañas. A: {datos['meta_a']['campanias']} vs B: {datos['meta_b']['campanias']}."
            fill_warn = s["fill_red"]
            font_warn = Font(name="Segoe UI", size=9, bold=True, color="C00000")

        dash_grid[4][2] = make_wo_cell(
            ws, warning_text, font=font_warn, fill=fill_warn,
            alignment=s["align_center"], border=s["border_thin"],
        )
        row_start_kpi = 6

    kpi_definitions = [
        ("ESTRUCTURAS",   kpis["total_filas"][0],  kpis["total_filas"][1],  "n", False),
        ("ESTACIONES",    kpis["celdas"][0],        kpis["celdas"][1],        "n", False),
        ("ALERTAS",       kpis["alertas"][0],       kpis["alertas"][1],       "n", False),
        ("VACIOS",        kpis["vacios"][0],        kpis["vacios"][1],        "n", False),
        ("ADVERTENCIAS",  kpis["advertencias"][0],  kpis["advertencias"][1],  "n", False),
    ]
    for ki, (lbl, va, vb, fmt, inv) in enumerate(kpi_definitions):
        _kpi_card_comparativo_grid(ws, dash_grid, row_start_kpi, 2 + ki * 3, lbl, va, vb, s, fmt, inv)

    # Fila de Integridad global
    row_int = row_start_kpi + 4
    ws.merged_cells.ranges.add(CellRange(min_col=2, min_row=row_int, max_col=4, max_row=row_int))
    dash_grid[row_int][2] = make_wo_cell(
        ws, "INTEGRIDAD GLOBAL", font=s["font_kpi_lbl"],
        alignment=s["align_center"], fill=s["fill_kpi_gray"], border=s["border_kpi"],
    )

    sub_font_int = Font(name="Segoe UI", size=8, bold=True, color="555555")
    for ci_sub, lbl_sub in ((2, "Base (A)"), (3, "Actual (B)"), (4, "Δ")):
        dash_grid[row_int + 1][ci_sub] = make_wo_cell(
            ws, lbl_sub, font=sub_font_int, alignment=s["align_center"],
            fill=s["fill_kpi_gray"], border=s["border_kpi"],
        )

    for ci2, val in ((2, kpis["integridad"][0]), (3, kpis["integridad"][1])):
        dash_grid[row_int + 2][ci2] = make_wo_cell(
            ws, f"{_safe_float(val):.2f}%", font=s["font_kpi_green"],
            alignment=s["align_center"], fill=s["fill_zebra"], border=s["border_kpi"],
        )
    dash_grid[row_int + 2][4] = _delta_wo_cell(ws, kpis["integridad"][0], kpis["integridad"][1], s, fmt_pct=True, invert=True)

    # Tabla resumen de cambios
    row_res = row_int + 5
    dash_grid[row_res][2] = make_wo_cell(ws, "CONSOLIDADO DE CAMBIOS DE INCIDENCIAS", font=s["font_section"])
    for ri2, (lbl2, qty, fill2) in enumerate([
        ("NUEVAS (Regresiones)", totales["nuevas"], s["fill_new"]),
        ("RESUELTAS (Mejoras)", totales["resueltas"], s["fill_resolved"]),
        ("PERSISTENTES", totales["persistentes"], s["fill_kpi_gray"]),
    ], start=row_res + 1):
        dash_grid[ri2][2] = make_wo_cell(ws, lbl2, font=s["font_bold"], fill=fill2, border=s["border_thin"])
        dash_grid[ri2][3] = make_wo_cell(
            ws, qty, font=s["font_bold"], alignment=s["align_right"],
            fill=fill2, border=s["border_thin"], num_fmt='#,##0',
        )

    # Tabla oculta / auxiliar para Gráficos
    row_chart_tbl = row_res + 6
    dash_grid[row_chart_tbl][2] = make_wo_cell(ws, "CATEGORIA", font=s["font_bold"])
    dash_grid[row_chart_tbl][3] = make_wo_cell(ws, "BASE (A)", font=s["font_bold"])
    dash_grid[row_chart_tbl][4] = make_wo_cell(ws, "ACTUAL (B)", font=s["font_bold"])

    chart_metrics = [
        ("Alertas", kpis["alertas"][0], kpis["alertas"][1]),
        ("Vacios", kpis["vacios"][0], kpis["vacios"][1]),
        ("Advertencias", kpis["advertencias"][0], kpis["advertencias"][1]),
    ]
    for idx, (cat_name, val_a, val_b) in enumerate(chart_metrics, start=1):
        rr = row_chart_tbl + idx
        dash_grid[rr][2] = make_wo_cell(ws, cat_name, font=s["font_regular"])
        dash_grid[rr][3] = make_wo_cell(ws, val_a, font=s["font_regular"], num_fmt='#,##0')
        dash_grid[rr][4] = make_wo_cell(ws, val_b, font=s["font_regular"], num_fmt='#,##0')

    max_dash_row = max(dash_grid.keys()) if dash_grid else 1
    for r in range(1, max_dash_row + 1):
        ws.append(_make_sparse_row(dash_grid.get(r)))
    dash_grid.clear()

    chart = BarChart()
    chart.type = "col"
    chart.style = 10
    chart.title = "Frecuencia de Desviaciones (Base vs Actual)"
    chart.y_axis.title = "Cantidad de Ocurrencias"
    chart.x_axis.title = "Categoría"

    data = Reference(ws, min_col=3, min_row=row_chart_tbl, max_col=4, max_row=row_chart_tbl + 3)
    cats = Reference(ws, min_col=2, min_row=row_chart_tbl + 1, max_row=row_chart_tbl + 3)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.width = 18
    chart.height = 10
    ws.add_chart(chart, "G14")

    # ── HOJA 2: RESUMEN EJECUTIVO ─────────────────────────────────────────
    ws2 = wb.create_sheet("📋 Resumen Ejecutivo")
    ws2_widths = {1: 3, 2: 30, 3: 18, 4: 18, 5: 18, 6: 18, 7: 18, 8: 18}
    ws2.merged_cells.ranges.add(CellRange("B2:H2"))
    exec_rows = [
        ("Estructuras",    kpis["total_filas"][0],    kpis["total_filas"][1],    False, "n"),
        ("Estaciones",     kpis["celdas"][0],          kpis["celdas"][1],          False, "n"),
        ("Alertas criticas",kpis["alertas"][0],        kpis["alertas"][1],         False, "n"),
        ("Vacios",         kpis["vacios"][0],          kpis["vacios"][1],          False, "n"),
        ("Advertencias",   kpis["advertencias"][0],    kpis["advertencias"][1],    False, "n"),
        ("Integridad (%)", kpis["integridad"][0],      kpis["integridad"][1],      True,  "pct"),
        ("Incidencias nuevas",    0,                   totales["nuevas"],           False, "n"),
        ("Incidencias resueltas", totales["resueltas"],0,                           True,  "n"),
    ]
    ws2_buf = [
        [],
        [None, make_wo_cell(ws2, "RESUMEN EJECUTIVO COMPARATIVO", font=s["font_title"], alignment=s["align_center"], fill=s["fill_primary"])],
        [],
        [None] + _wo_header_cells(ws2, ["Indicador", f"A ({meta_a['nombre'][:18]})", f"B ({meta_b['nombre'][:18]})", "Delta Abs.", "Delta %", "Tendencia"], s),
    ]
    for ri2, (lbl, va, vb, inv, fmt) in enumerate(exec_rows, start=5):
        va_f, vb_f = _safe_float(va), _safe_float(vb)
        delta_abs  = vb_f - va_f
        delta_pct2 = ((vb_f - va_f) / max(1.0, abs(va_f))) * 100.0
        improved   = (delta_abs < 0) if not inv else (delta_abs > 0)
        trend      = "Mejora" if improved else ("Deterioro" if delta_abs != 0 else "Igual")
        row_fill2  = s["fill_green"] if improved else (s["fill_red"] if delta_abs != 0 else None)
        disp_a     = f"{va_f:.2f}%" if fmt == "pct" else _safe_int(va)
        disp_b     = f"{vb_f:.2f}%" if fmt == "pct" else _safe_int(vb)
        disp_da    = f"{delta_abs:+.2f}%" if fmt == "pct" else f"{int(delta_abs):+d}"
        disp_dp    = f"{delta_pct2:+.1f}%"
        row_cells = [None]
        for ci2, val2 in ((2, lbl), (3, disp_a), (4, disp_b), (5, disp_da), (6, disp_dp), (7, trend)):
            c_font = s["font_bold"] if ci2 == 2 else (s["font_delta_green"] if (ci2 == 7 and improved) else (s["font_delta_red"] if (ci2 == 7 and delta_abs != 0) else s["font_regular"]))
            c_fill = row_fill2 if (row_fill2 and ci2 >= 5) else (s["fill_zebra"] if ri2 % 2 == 0 else None)
            row_cells.append(make_wo_cell(
                ws2, val2, font=c_font, fill=c_fill,
                alignment=s["align_right"] if ci2 > 3 else s["align_left"],
                border=s["border_thin"],
            ))
        ws2_buf.append(row_cells)

    _compute_sample_widths(ws2_buf, ws2_widths)
    for ci_w, w_val in ws2_widths.items():
        ws2.column_dimensions[get_column_letter(ci_w)].width = w_val
    for r_vals in ws2_buf:
        ws2.append(r_vals)
    ws2.auto_filter.ref = f"B4:H{len(exec_rows) + 4}"

    # ── HOJA 3: POR CAMPAÑA ───────────────────────────────────────────────
    ws3 = wb.create_sheet("📅 Por Campaña")
    ws3_widths = {1: 3, 2: 14}
    for ci2 in range(3, 15):
        ws3_widths[ci2] = 13
    ws3.merged_cells.ranges.add(CellRange("B2:M2"))
    ws3_buf = [
        [],
        [None, make_wo_cell(ws3, "DISTRIBUCION COMPARATIVA POR CAMPANA", font=s["font_title"], alignment=s["align_center"], fill=s["fill_primary"])],
        [],
        [None] + _wo_header_cells(ws3, ["Campana","Celdas A","Celdas B","Alertas A","Alertas B","D.Alertas","Vacios A","Vacios B","D.Vacios","Adv A","Adv B","D.Adv"], s),
    ]
    for ri2, row in enumerate(datos["dist_campana"], start=5):
        vals = [
            row["campania"], row["celdas_a"], row["celdas_b"],
            row["alertas_a"], row["alertas_b"], row["alertas_b"] - row["alertas_a"],
            row["vacios_a"],  row["vacios_b"],  row["vacios_b"]  - row["vacios_a"],
            row["adv_a"],     row["adv_b"],     row["adv_b"]     - row["adv_a"],
        ]
        row_cells = [None]
        for ci2, val2 in enumerate(vals, start=2):
            c_font = None
            c_fill = None
            if ci2 in (7, 10, 13):
                d = _safe_int(val2)
                if d < 0:
                    c_font, c_fill = s["font_delta_green"], s["fill_green"]
                elif d > 0:
                    c_font, c_fill = s["font_delta_red"], s["fill_red"]
                else:
                    c_font = s["font_delta_gray"]
            elif ri2 % 2 == 0:
                c_fill = s["fill_zebra"]
            row_cells.append(make_wo_cell(
                ws3, val2, font=c_font, fill=c_fill,
                alignment=s["align_right"] if ci2 > 2 else s["align_left"],
                border=s["border_thin"],
            ))
        ws3_buf.append(row_cells)

    _compute_sample_widths(ws3_buf, ws3_widths)
    for ci_w, w_val in ws3_widths.items():
        ws3.column_dimensions[get_column_letter(ci_w)].width = w_val
    for r_vals in ws3_buf:
        ws3.append(r_vals)
    ws3.auto_filter.ref = f"B4:M{len(datos['dist_campana']) + 4}"

    # ── HOJA 4: POR SECTOR ────────────────────────────────────────────────
    ws4 = wb.create_sheet("📍 Por Sector")
    ws4_widths = {1: 3, 2: 22}
    for ci2 in range(3, 12):
        ws4_widths[ci2] = 14
    ws4.merged_cells.ranges.add(CellRange("B2:J2"))
    ws4_buf = [
        [],
        [None, make_wo_cell(ws4, "DISTRIBUCION COMPARATIVA POR SECTOR GEOTECNICO", font=s["font_title"], alignment=s["align_center"], fill=s["fill_primary"])],
        [],
        [None] + _wo_header_cells(ws4, ["Sector","Celdas A","Celdas B","Alertas A","Alertas B","D.Alertas","Vacios A","Vacios B","D.Vacios"], s),
    ]
    for ri2, row in enumerate(datos["dist_sector"], start=5):
        vals = [
            row["sector"], row["celdas_a"], row["celdas_b"],
            row["alertas_a"], row["alertas_b"], row["alertas_b"] - row["alertas_a"],
            row["vacios_a"],  row["vacios_b"],  row["vacios_b"]  - row["vacios_a"],
        ]
        row_cells = [None]
        for ci2, val2 in enumerate(vals, start=2):
            c_font = None
            c_fill = None
            if ci2 in (7, 10):
                d = _safe_int(val2)
                if d < 0:
                    c_font, c_fill = s["font_delta_green"], s["fill_green"]
                elif d > 0:
                    c_font, c_fill = s["font_delta_red"], s["fill_red"]
                else:
                    c_font = s["font_delta_gray"]
            elif ri2 % 2 == 0:
                c_fill = s["fill_zebra"]
            row_cells.append(make_wo_cell(
                ws4, val2, font=c_font, fill=c_fill,
                alignment=s["align_right"] if ci2 > 2 else s["align_left"],
                border=s["border_thin"],
            ))
        ws4_buf.append(row_cells)

    _compute_sample_widths(ws4_buf, ws4_widths)
    for ci_w, w_val in ws4_widths.items():
        ws4.column_dimensions[get_column_letter(ci_w)].width = w_val
    for r_vals in ws4_buf:
        ws4.append(r_vals)
    ws4.auto_filter.ref = f"B4:J{len(datos['dist_sector']) + 4}"

    # ── HOJA 5: MASTER REGISTRO DE ERRORES (CATÁLOGO / ÍNDICE) ───────────
    ws_cat = wb.create_sheet(title="❌ Catálogo de Errores")
    ws_cat.views.sheetView[0].showGridLines = True
    for ci_w, w_val in ((1, 3), (2, 6), (3, 16), (4, 52), (5, 12), (6, 12), (7, 12), (8, 22)):
        ws_cat.column_dimensions[get_column_letter(ci_w)].width = w_val

    ws_cat.append([])
    ws_cat.append([None, make_wo_cell(ws_cat, "REGISTRO MAESTRO DE ERRORES COMPARATIVO", font=s["font_title"])])
    ws_cat.append([None, make_wo_cell(ws_cat, "Lista consolidada de desviaciones geomecánicas. Use los hipervínculos para navegar.", font=s["font_subtitle"])])
    ws_cat.append([])
    ws_cat.append([None] + _wo_header_cells(ws_cat, ["ID", "Gravedad", "Regla de Consistencia Evaluada", "Casos A", "Casos B", "Delta (B-A)", "Enlace Detalle"], s))

    incidencias_por_error_a = defaultdict(list)
    for inc in inc_a_filtered:
        incidencias_por_error_a[get_incidence_category_name(inc)].append(inc)

    incidencias_por_error_b = defaultdict(list)
    for inc in inc_b_filtered:
        incidencias_por_error_b[get_incidence_category_name(inc)].append(inc)

    catalog_frequencies = []
    for cat in CATEGORIES_REGISTRY.values():
        rule_msg = cat.name
        matches_a = incidencias_por_error_a[rule_msg]
        matches_b = incidencias_por_error_b[rule_msg]
        if len(matches_a) > 0 or len(matches_b) > 0:
            catalog_frequencies.append({
                "msg": rule_msg,
                "severity": cat.severity,
                "count_a": len(matches_a),
                "count_b": len(matches_b),
                "delta": len(matches_b) - len(matches_a),
                "matches_a": matches_a,
                "matches_b": matches_b,
            })

    catalog_frequencies.sort(key=lambda x: max(x["count_a"], x["count_b"]), reverse=True)
    incidencias_por_error_a.clear()
    incidencias_por_error_b.clear()

    r_cat = 6
    active_sheets_mapping = {}
    for c_idx, rule in enumerate(catalog_frequencies, start=1):
        sev_fill = s["fill_red"] if rule["severity"] == "ALERTA" else (s["fill_orange"] if rule["severity"] == "ADVERTENCIA" else s["fill_yellow"])
        d_val = rule["delta"]
        if d_val < 0:
            d_font, d_fill = s["font_delta_green"], s["fill_green"]
        elif d_val > 0:
            d_font, d_fill = s["font_delta_red"], s["fill_red"]
        else:
            d_font, d_fill = s["font_bold"], None

        tab_name = _get_safe_sheet_name(rule["msg"], c_idx)
        active_sheets_mapping[rule["msg"]] = {
            "tab_name": tab_name,
            "matches_a": rule["matches_a"],
            "matches_b": rule["matches_b"],
            "severity": rule["severity"],
        }

        ws_cat.append([
            None,
            make_wo_cell(ws_cat, c_idx, font=s["font_regular"], alignment=s["align_center"], border=s["border_thin"]),
            make_wo_cell(ws_cat, rule["severity"], font=s["font_bold"], fill=sev_fill, alignment=s["align_center"], border=s["border_thin"]),
            make_wo_cell(ws_cat, rule["msg"], font=s["font_bold"], border=s["border_thin"]),
            make_wo_cell(ws_cat, rule["count_a"], font=s["font_bold"], alignment=s["align_right"], border=s["border_thin"], num_fmt='#,##0'),
            make_wo_cell(ws_cat, rule["count_b"], font=s["font_bold"], alignment=s["align_right"], border=s["border_thin"], num_fmt='#,##0'),
            make_wo_cell(ws_cat, d_val, font=d_font, fill=d_fill, alignment=s["align_right"], border=s["border_thin"], num_fmt='#,##0'),
            make_wo_cell(ws_cat, f'=HYPERLINK("#\'Ref {c_idx}\'!B2", "🔍 Ver Cambios")', font=s["font_link"], alignment=s["align_center"], border=s["border_thin"]),
        ])
        r_cat += 1

    catalog_frequencies.clear()
    ws_cat.auto_filter.ref = f"B5:H{r_cat - 1}"

    # ── HOJA 6: CELDAS CRÍTICAS ───────────────────────────────────────────
    ws6 = wb.create_sheet("⚠️ Celdas Críticas")
    ws6_widths = {1: 3, 2: 22}
    for ci2 in range(3, 9):
        ws6_widths[ci2] = 14
    r_mejor = len(datos["celdas_peor"]) + 6
    ws6.merged_cells.ranges.add(CellRange("B2:H2"))
    ws6.merged_cells.ranges.add(CellRange(min_col=2, min_row=r_mejor, max_col=7, max_row=r_mejor))

    ws6_fill_peor_h = PatternFill(start_color="C00000", end_color="C00000", fill_type="solid")
    ws6_fill_peor_hdr = PatternFill(start_color="9B1C1C", end_color="9B1C1C", fill_type="solid")
    ws6_fill_mej_h = PatternFill(start_color="166534", end_color="166534", fill_type="solid")
    ws6_fill_mej_hdr = PatternFill(start_color="14532D", end_color="14532D", fill_type="solid")

    ws6_buf = [
        [],
        [None, make_wo_cell(ws6, "CELDAS QUE EMPEORARON (mas alertas en B)", font=s["font_section"], alignment=s["align_center"], fill=ws6_fill_peor_h)],
        [None] + _wo_header_cells(ws6, ["Celda","Alertas A","Alertas B","Vacios A","Vacios B","Delta Alert."], s, fill=ws6_fill_peor_hdr),
    ]
    for row in datos["celdas_peor"]:
        row_cells = [None]
        for ci2, val2 in ((2, row["celda"]), (3, row["alertas_a"]), (4, row["alertas_b"]),
                          (5, row["vacios_a"]), (6, row["vacios_b"]), (7, f'+{row["delta"]}')):
            row_cells.append(make_wo_cell(
                ws6, val2,
                font=s["font_bold"] if ci2 in (2, 7) else s["font_regular"],
                fill=s["fill_new"],
                alignment=s["align_right"] if ci2 > 2 else s["align_left"],
                border=s["border_thin"],
            ))
        ws6_buf.append(row_cells)

    ws6_buf.append([])
    ws6_buf.append([])
    ws6_buf.append([None, make_wo_cell(ws6, "CELDAS QUE MEJORARON (menos alertas en B)", font=s["font_section"], alignment=s["align_center"], fill=ws6_fill_mej_h)])
    ws6_buf.append([None] + _wo_header_cells(ws6, ["Celda","Alertas A","Alertas B","Vacios A","Vacios B","Delta Alert."], s, fill=ws6_fill_mej_hdr))
    for row in datos["celdas_mejor"]:
        row_cells = [None]
        for ci2, val2 in ((2, row["celda"]), (3, row["alertas_a"]), (4, row["alertas_b"]),
                          (5, row["vacios_a"]), (6, row["vacios_b"]), (7, str(row["delta"]))):
            row_cells.append(make_wo_cell(
                ws6, val2,
                font=s["font_bold"] if ci2 in (2, 7) else s["font_regular"],
                fill=s["fill_resolved"],
                alignment=s["align_right"] if ci2 > 2 else s["align_left"],
                border=s["border_thin"],
            ))
        ws6_buf.append(row_cells)

    _compute_sample_widths(ws6_buf, ws6_widths)
    for ci_w, w_val in ws6_widths.items():
        ws6.column_dimensions[get_column_letter(ci_w)].width = w_val
    for r_vals in ws6_buf:
        ws6.append(r_vals)

    # ── HOJAS 7+: DETALLES INDIVIDUALES POR REGLA DE ERROR COMPARATIVO ────
    ref_widths = (
        (1, 3), (2, 11), (3, 11), (4, 16), (5, 16), (6, 11),
        (7, 24), (8, 24), (9, 20), (10, 20), (11, 24),
    )
    headers_detail = ["Fila A", "Fila B", "Celda Padre", "Celda Hija", "Campaña", "Sector", "Columna de Falla", "Valor Antiguo (A)", "Valor Nuevo (B)", "Estado de Cambio"]

    for idx_rule, (rule_msg, mapping_data) in enumerate(active_sheets_mapping.items(), start=1):
        sh_name = f"Ref {idx_rule}"
        matches_a = mapping_data["matches_a"]
        matches_b = mapping_data["matches_b"]
        severity = mapping_data["severity"]

        ws_err = wb.create_sheet(title=sh_name)
        ws_err.views.sheetView[0].showGridLines = True
        for ci_w, w_val in ref_widths:
            ws_err.column_dimensions[get_column_letter(ci_w)].width = w_val
        ws_err.merged_cells.ranges.add(CellRange("B5:K5"))

        err_desc_font = Font(name="Segoe UI", size=10, bold=True, color="7F1D1D" if severity == "ALERTA" else "7F5F1D")
        err_desc_fill = s["fill_red"] if severity == "ALERTA" else s["fill_orange"]

        ws_err.append([])
        ws_err.append([None, make_wo_cell(ws_err, '=HYPERLINK("#\'❌ Catálogo de Errores\'!B2", "⬅ Volver al Catálogo de Errores")', font=s["font_link"], alignment=s["align_left"])])
        ws_err.append([])
        ws_err.append([None, make_wo_cell(ws_err, "ANÁLISIS COMPARATIVO DE INCIDENCIA", font=s["font_section"])])
        ws_err.append([None, make_wo_cell(ws_err, f"Regla: {rule_msg.upper()}", font=err_desc_font, fill=err_desc_fill, border=s["border_thin"])])
        ws_err.append([])
        ws_err.append([None] + _wo_header_cells(ws_err, headers_detail, s))

        combined_records = {}
        for r_a in matches_a:
            key_rec = (r_a.get("celda_padre"), r_a.get("columna"))
            combined_records[key_rec] = {"a": r_a, "b": None}

        for r_b in matches_b:
            key_rec = (r_b.get("celda_padre"), r_b.get("columna"))
            if key_rec in combined_records:
                combined_records[key_rec]["b"] = r_b
            else:
                combined_records[key_rec] = {"a": None, "b": r_b}

        r_idx = 8
        for (celda_p, col_falla), cmp_data in combined_records.items():
            rec_a = cmp_data["a"]
            rec_b = cmp_data["b"]

            if rec_a and rec_b:
                estado_str = "PERSISTENTE"
                fila_a = rec_a.get("fila_excel", "")
                fila_b = rec_b.get("fila_excel", "")
                val_antiguo = rec_a.get("valor_actual", "—")
                val_nuevo = rec_b.get("valor_actual", "—")
                resolved_camp = rec_b.get("campania", "")
                resolved_sector = rec_b.get("sector_geotecnico", "")
                celda_h = rec_b.get("celda_hija", "")
            elif rec_a and not rec_b:
                estado_str = "RESUELTA (Mejorado)"
                fila_a = rec_a.get("fila_excel", "")
                fila_b = "—"
                val_antiguo = rec_a.get("valor_actual", "—")
                val_nuevo = "CORREGIDO / OK"

                celda_p = rec_a.get("celda_padre", "")
                celda_h = rec_a.get("celda_hija", "")
                columna = rec_a.get("columna", "")

                n_th = 1
                if celda_h and "-" in celda_h:
                    parts = celda_h.split("-")
                    if len(parts) >= 2 and parts[-1].isdigit():
                        n_th = int(parts[-1])

                if celda_counts_b and (celda_p not in celda_counts_b or n_th > celda_counts_b[celda_p]):
                    val_nuevo = "FILA ELIMINADA / OK"
                elif values_map_b:
                    raw_val_b = values_map_b.get((celda_p, n_th, columna))
                    if raw_val_b is not None:
                        formatted_b = format_raw_value_for_report(raw_val_b)
                        if formatted_b is not None:
                            val_nuevo = formatted_b

                resolved_camp = rec_a.get("campania", "")
                resolved_sector = rec_a.get("sector_geotecnico", "")
            else:
                estado_str = "NUEVA (Regresión)"
                fila_a = "—"
                fila_b = rec_b.get("fila_excel", "")
                val_antiguo = "—"

                celda_p = rec_b.get("celda_padre", "")
                celda_h = rec_b.get("celda_hija", "")
                columna = rec_b.get("columna", "")

                n_th = 1
                if celda_h and "-" in celda_h:
                    parts = celda_h.split("-")
                    if len(parts) >= 2 and parts[-1].isdigit():
                        n_th = int(parts[-1])

                if celda_counts_a and (celda_p not in celda_counts_a or n_th > celda_counts_a[celda_p]):
                    val_antiguo = "FILA CREADA (Nueva)"
                elif values_map_a:
                    raw_val_a = values_map_a.get((celda_p, n_th, columna))
                    if raw_val_a is not None:
                        formatted_a = format_raw_value_for_report(raw_val_a)
                        if formatted_a is not None:
                            val_antiguo = formatted_a

                val_nuevo = rec_b.get("valor_actual", "—")
                resolved_camp = rec_b.get("campania", "")
                resolved_sector = rec_b.get("sector_geotecnico", "")

            row_values = [
                fila_a, fila_b, celda_p, celda_h,
                resolved_camp, resolved_sector, col_falla,
                val_antiguo, val_nuevo, estado_str,
            ]
            row_cells = [None]
            zebra_fill = s["fill_zebra"] if r_idx % 2 == 0 else None
            for col_idx, val in enumerate(row_values, start=2):
                c_align = s["align_left"] if col_idx in (4, 5, 7, 8, 9, 10) else s["align_center"]
                if col_idx == 11:
                    if estado_str.startswith("RESUELTA"):
                        c_fill, c_font = s["fill_resolved"], s["font_delta_green"]
                    elif estado_str.startswith("NUEVA"):
                        c_fill, c_font = s["fill_new"], s["font_delta_red"]
                    else:
                        c_fill, c_font = s["fill_yellow"], s["font_delta_gray"]
                else:
                    c_fill, c_font = zebra_fill, s["font_regular"]
                row_cells.append(make_wo_cell(
                    ws_err, val, font=c_font, fill=c_fill,
                    alignment=c_align, border=s["border_thin"],
                ))
            ws_err.append(row_cells)
            r_idx += 1

        combined_records.clear()
        ws_err.auto_filter.ref = f"B7:K{r_idx - 1}"

    active_sheets_mapping.clear()
    return wb

# ─── Helpers para cargar archivos de historial ───────────────────────────────

def _load_audit_files(audit_id: str):
    history_dir = os.path.join(uploads_dir, "history")
    raw_f    = os.path.join(history_dir, f"{audit_id}_diagnostico.json")
    comp_f   = os.path.join(history_dir, f"{audit_id}_compact.json")
    if not os.path.exists(raw_f) or not os.path.exists(comp_f):
        raise HTTPException(status_code=404,
            detail=f"Revisión '{audit_id}' no encontrada o incompleta en el historial.")
    with open(raw_f,  "r", encoding="utf-8") as f: diag    = json.load(f)
    with open(comp_f, "r", encoding="utf-8") as f: compact = json.load(f)
    return diag, compact

def _stream_wb(wb, fname):
    return wb_to_temp_file_response(wb, fname)

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/geomecanica/comparativo/reporte")
def reporte_comparativo_historial(audit_id_a: str, audit_id_b: str):
    """Genera Excel comparativo entre dos revisiones ya procesadas en el historial."""
    if not audit_id_a or not audit_id_b:
        raise HTTPException(status_code=400, detail="Se requieren audit_id_a y audit_id_b.")
    if audit_id_a == audit_id_b:
        raise HTTPException(status_code=400, detail="Los dos audit_id no pueden ser iguales.")
    diag_a, compact_a = _load_audit_files(audit_id_a)
    diag_b, compact_b = _load_audit_files(audit_id_b)
    excel_path_a = os.path.join(uploads_dir, "history", f"{audit_id_a}.xlsx")
    excel_path_b = os.path.join(uploads_dir, "history", f"{audit_id_b}.xlsx")
    datos = _compare_audits(diag_a, compact_a, diag_b, compact_b, excel_path_a=excel_path_a, excel_path_b=excel_path_b)
    del diag_a, compact_a, diag_b, compact_b
    gc.collect()
    wb    = generar_excel_comparativo_core(datos)
    del datos
    gc.collect()
    fname = f"comparativo_{audit_id_a}_vs_{audit_id_b}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return _stream_wb(wb, fname)

@router.post("/geomecanica/comparativo/importar-y-comparar")
async def reporte_comparativo_importar(file_a: UploadFile = File(...), file_b: UploadFile = File(...), proyecto: str = Form("ferrobamba")):
    """
    Sube dos Excel crudos, los audita secuencialmente y genera el comparativo.
    Puede tardar varios minutos dependiendo del tamano de los archivos.
    """
    for f in [file_a, file_b]:
        if not f.filename.lower().endswith(".xlsx"):
            raise HTTPException(status_code=400, detail=f"Formato no soportado. Solo se aceptan archivos .xlsx (Excel 2007+): {f.filename}")
    ts      = datetime.now().strftime("%Y%m%d_%H%M%S")
    tmp_dir = tempfile.mkdtemp(dir=uploads_dir)
    path_a = None
    path_b = None
    try:
        raw_a  = os.path.join(tmp_dir, "diag_a.json")
        raw_b  = os.path.join(tmp_dir, "diag_b.json")

        path_a = await save_upload_to_temp(file_a, suffix=".xlsx")
        path_b = await save_upload_to_temp(file_b, suffix=".xlsx")

        diag_a = validate_bulk_excel(path_a, raw_a, project=proyecto)
        diag_a["nombre_archivo"] = file_a.filename
        diag_a["proyecto"] = proyecto

        diag_b = validate_bulk_excel(path_b, raw_b, project=proyecto)
        diag_b["nombre_archivo"] = file_b.filename
        diag_b["proyecto"] = proyecto

        from app.routers.auditoria import aggregate_audit_metrics
        compact_a = aggregate_audit_metrics(diag_a)
        compact_a["fecha_auditoria"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        compact_b = aggregate_audit_metrics(diag_b)
        compact_b["fecha_auditoria"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        datos = _compare_audits(diag_a, compact_a, diag_b, compact_b, excel_path_a=path_a, excel_path_b=path_b)
        del diag_a, compact_a, diag_b, compact_b
        gc.collect()
        wb = generar_excel_comparativo_core(datos)
        del datos
        gc.collect()
        return _stream_wb(wb, f"comparativo_{ts}.xlsx")
    finally:
        for p in (path_a, path_b):
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass
        shutil.rmtree(tmp_dir, ignore_errors=True)
