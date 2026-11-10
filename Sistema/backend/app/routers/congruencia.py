import os
import io
import re
import gc
import math
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from fastapi import APIRouter, File, UploadFile, HTTPException

from app.utils.validator import get_row_val, sanitize_value
from app.utils.interpolation import rating_continuo_rqd, rating_continuo_r1
from app.core.catalogs import RESISTENCIA_RATING_CATALOG
from app.core.excel_styles import (
    make_wo_cell,
    dedup_pandas_headers,
    save_upload_to_temp,
    wb_to_temp_file_response,
)

router = APIRouter()

# Estilos de Excel Premium
FONT_TITLE = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
FILL_HEADER = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid") # Azul oscuro / Slate 800
FILL_GREEN = PatternFill(start_color="E6F4EA", end_color="E6F4EA", fill_type="solid")  # Verde suave
FONT_GREEN = Font(name="Calibri", size=10, bold=True, color="137333")
FILL_RED = PatternFill(start_color="FCE8E6", end_color="FCE8E6", fill_type="solid")    # Rojo suave
FONT_RED = Font(name="Calibri", size=10, bold=True, color="C5221F")
FONT_DATA = Font(name="Calibri", size=10)
FONT_MONO = Font(name="Consolas", size=10)
ALIGN_CENTER = Alignment(horizontal="center", vertical="center")
ALIGN_LEFT = Alignment(horizontal="left", vertical="center")
ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")

BORDER_THIN = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)

def round_half_up(n):
    if n is None:
        return None
    return math.floor(n + 0.5)

def style_row_cell(cell, fill=None, font=FONT_DATA, alignment=ALIGN_LEFT, border=BORDER_THIN):
    if fill:
        cell.fill = fill
    cell.font = font
    cell.alignment = alignment
    cell.border = border

def apply_auto_filter_and_styles(ws):
    # Ajustar ancho de columnas y añadir filtros automáticos
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            # Cabecera siempre negrita
            if cell.row == 1:
                cell.font = FONT_TITLE
                cell.fill = FILL_HEADER
                cell.alignment = ALIGN_CENTER
                cell.border = BORDER_THIN
            else:
                if cell.border is None or cell.border == Border():
                    cell.border = BORDER_THIN
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)
    
    if ws.max_row > 1:
        last_col = get_column_letter(ws.max_column)
        ws.auto_filter.ref = f"A1:{last_col}{ws.max_row}"

def natural_sort_key(s):
    if s is None:
        return []
    s = str(s)
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

def get_row_val_robust(row_dict, possible_names):
    """
    Busca un valor en el diccionario de la fila de forma resiliente,
    colapsando múltiples espacios, comillas y convirtiendo a mayúsculas.
    """
    if isinstance(possible_names, str):
        possible_names = [possible_names]
        
    cleaned_row = {}
    for k, v in row_dict.items():
        k_str = str(k).strip().upper()
        # Elimina comillas y colapsa espacios dobles o triples
        k_clean = " ".join(k_str.replace("'", "").replace('"', '').split())
        cleaned_row[k_clean] = v
        
    for name in possible_names:
        name_str = str(name).strip().upper()
        name_clean = " ".join(name_str.replace("'", "").replace('"', '').split())
        if name_clean in cleaned_row:
            return cleaned_row[name_clean]
            
    # Fallback al get_row_val original del validador
    for name in possible_names:
        val = get_row_val(row_dict, name)
        if val is not None:
            return val
            
    return None

def get_resolved_campaign(row_dict):
    camp = sanitize_value(get_row_val_robust(row_dict, ['Campaña', 'Año', 'Ano', 'Campanha', 'CAMPANIA', 'AÑO', 'CAMPAÑA']), int)
    return camp

def evaluate_resistencia_76(row_dict):
    dureza = sanitize_value(get_row_val_robust(row_dict, ["DUREZA '76", "DUREZA  '76", "DUREZA 76"]), str)
    dureza_val = sanitize_value(get_row_val_robust(row_dict, ["RESISTENCIA ESTIMADA VALOR '76", "RESISTENCIA ESTIMADA VALOR  '76", "RESISTENCIA ESTIMADA VALOR 76"]), float)
    
    if dureza is None and dureza_val is None:
        return None
    
    if dureza is not None:
        code_upper = dureza.upper()
        if code_upper in RESISTENCIA_RATING_CATALOG:
            expected = RESISTENCIA_RATING_CATALOG[code_upper]["r76"]
            if dureza_val is not None:
                dureza_val = round(dureza_val, 2)
                correct = abs(dureza_val - expected) <= 0.2
                msg = "Correcto" if correct else f"Valor ingresado {dureza_val:.1f} no coincide con el discreto de {code_upper} ({expected})"
                return correct, expected, msg
            else:
                return False, expected, "Valor numérico faltante"
        else:
            return False, None, f"Dureza '{dureza}' no es válida en catálogo"
    
    return False, None, "Código de dureza faltante"

def evaluate_rqd_76(row_dict):
    rqd_pct = sanitize_value(get_row_val_robust(row_dict, ["RQD '76", "RQD  '76", "RQD 76"]), float)
    rqd_val = sanitize_value(get_row_val_robust(row_dict, ["RQD - VALOR '76", "RQD - VALOR  '76", "RQD VALOR 76"]), float)
    
    if rqd_pct is None and rqd_val is None:
        return None
        
    if rqd_pct is not None:
        rqd_int = int(round_half_up(rqd_pct))
        expected = 3 if rqd_int < 25 else (8 if rqd_int < 50 else (13 if rqd_int < 75 else (17 if rqd_int < 90 else 20)))
        if rqd_val is not None:
            rqd_val = round(rqd_val, 2)
            correct = abs(rqd_val - expected) <= 0.2
            msg = "Correcto" if correct else f"Valor ingresado {rqd_val:.1f} no coincide con Bieniawski '76 ({expected}) para {rqd_pct:.1f}%"
            return correct, expected, msg
        else:
            return False, expected, "Rating de RQD faltante"
            
    return False, None, "Porcentaje RQD faltante"

def evaluate_resistencia_89(row_dict, camp):
    dureza = sanitize_value(get_row_val_robust(row_dict, ["DUREZA '89", "DUREZA  '89", "DUREZA 89"]), str)
    dureza_val = sanitize_value(get_row_val_robust(row_dict, ["RESISTENCIA ESTIMADA VALOR '89", "RESISTENCIA ESTIMADA VALOR  '89", "RESISTENCIA ESTIMADA VALOR 89"]), float)
    ucs = sanitize_value(get_row_val_robust(row_dict, ["( UCS ) (Mpa)", "( UCS )  (Mpa)", "UCS (MPA)", "UCS"]), float)
    
    if dureza is None and dureza_val is None:
        return None
        
    if camp in [2021, 2022, 2023]:
        if ucs is not None:
            expected = rating_continuo_r1(ucs)
            if dureza_val is not None:
                dureza_val = round(dureza_val, 2)
                correct = abs(dureza_val - expected) <= 0.2
                msg = "Correcto" if correct else f"Valor ingresado {dureza_val:.2f} difiere del ábaco continuo ({expected:.2f}) para UCS {ucs:.2f} MPa"
                return correct, round(expected, 2), msg
            else:
                return False, round(expected, 2), "Valor numérico faltante (Ábaco)"
        else:
            # Fallback a discreto si no hay UCS en años de ábaco
            if dureza is not None:
                code_upper = dureza.upper()
                if code_upper in RESISTENCIA_RATING_CATALOG:
                    expected = RESISTENCIA_RATING_CATALOG[code_upper]["r89"]
                    if dureza_val is not None:
                        dureza_val = round(dureza_val, 2)
                        correct = abs(dureza_val - expected) <= 0.2
                        msg = "Correcto (Fallback)" if correct else f"Valor ingresado {dureza_val:.1f} difiere de {code_upper} ({expected})"
                        return correct, expected, msg
            return False, None, "Falta valor de UCS para cálculo de ábaco continuo (Campaña 2021-2023)"
    else:
        # 2024+ o N/A: Discreto
        if dureza is not None:
            code_upper = dureza.upper()
            if code_upper in RESISTENCIA_RATING_CATALOG:
                expected = RESISTENCIA_RATING_CATALOG[code_upper]["r89"]
                if dureza_val is not None:
                    dureza_val = round(dureza_val, 2)
                    correct = abs(dureza_val - expected) <= 0.2
                    msg = "Correcto" if correct else f"Valor ingresado {dureza_val:.1f} difiere de Bieniawski '89 ({expected}) para {code_upper}"
                    return correct, expected, msg
                else:
                    return False, expected, "Valor numérico faltante"
            else:
                return False, None, f"Dureza '{dureza}' no es válida en catálogo"
        return False, None, "Código de dureza faltante"

def evaluate_rqd_89(row_dict, camp):
    rqd_pct = sanitize_value(get_row_val_robust(row_dict, ["RQD '89", "RQD  '89", "RQD 89"]), float)
    rqd_val = sanitize_value(get_row_val_robust(row_dict, ["RQD - VALOR '89", "RQD - VALOR  '89", "RQD VALOR 89"]), float)
    
    if rqd_pct is None and rqd_val is None:
        return None
        
    if camp == 2021:
        # Discreto en 2021 con redondeo a entero
        if rqd_pct is not None:
            rqd_int = int(round_half_up(rqd_pct))
            expected = 3 if rqd_int < 25 else (8 if rqd_int < 50 else (13 if rqd_int < 75 else (17 if rqd_int < 90 else 20)))
            if rqd_val is not None:
                rqd_val = round(rqd_val, 2)
                correct = abs(rqd_val - expected) <= 0.2
                msg = "Correcto" if correct else f"Valor ingresado {rqd_val:.1f} difiere de Bieniawski '89 ({expected}) para {rqd_pct:.1f}% (2021)"
                return correct, expected, msg
            else:
                return False, expected, "Rating de RQD faltante"
        return False, None, "Porcentaje RQD faltante"
    else:
        # 2022+ o N/A: Continuo
        if rqd_pct is not None:
            expected = rating_continuo_rqd(rqd_pct)
            if rqd_val is not None:
                rqd_val = round(rqd_val, 2)
                correct = abs(rqd_val - expected) <= 0.2
                msg = "Correcto" if correct else f"Valor ingresado {rqd_val:.2f} difiere del ábaco continuo ({expected:.2f}) para {rqd_pct:.2f}%"
                return correct, round(expected, 2), msg
            else:
                return False, round(expected, 2), "Rating de RQD faltante (Ábaco)"
        return False, None, "Porcentaje RQD faltante"

_PANDAS_NA_STRINGS = frozenset({
    "", "#N/A", "#N/A N/A", "#NA", "-1.#IND", "-1.#QNAN",
    "-NaN", "-nan", "1.#IND", "1.#QNAN", "<NA>", "N/A",
    "NA", "NULL", "NaN", "None", "n/a", "nan", "null", "none",
})

_CONG_FFILL_COLS = frozenset({
    "CELDA_PADRE", "Campaña", "Año", "Ano", "Campanha",
    "GEOTECNICO", "Sector Geotecnico", "Sector",
})

_CONG_LOOKUP_GROUPS = (
    ("CELDA_PADRE",),
    ("ID",),
    ("Campaña", "Año", "Ano", "Campanha", "CAMPANIA", "AÑO", "CAMPAÑA"),
    ("DUREZA '76", "DUREZA  '76", "DUREZA 76"),
    ("RESISTENCIA ESTIMADA VALOR '76", "RESISTENCIA ESTIMADA VALOR  '76", "RESISTENCIA ESTIMADA VALOR 76", "RESISTENCIA ESTIMADA '76", "RESISTENCIA ESTIMADA 76"),
    ("RQD '76", "RQD  '76", "RQD 76"),
    ("RQD - VALOR '76", "RQD - VALOR  '76", "RQD VALOR 76", "RQD - VALOR 76", "RQD VALOR  '76"),
    ("DUREZA '89", "DUREZA  '89", "DUREZA 89"),
    ("RESISTENCIA ESTIMADA VALOR '89", "RESISTENCIA ESTIMADA VALOR  '89", "RESISTENCIA ESTIMADA VALOR 89", "RESISTENCIA ESTIMADA '89", "RESISTENCIA ESTIMADA 89"),
    ("( UCS ) (Mpa)", "( UCS )  (Mpa)", "UCS (MPA)", "UCS", "UCS_MPA"),
    ("RQD '89", "RQD  '89", "RQD 89"),
    ("RQD - VALOR '89", "RQD - VALOR  '89", "RQD VALOR 89", "RQD - VALOR 89", "RQD VALOR  '89"),
)


def _is_pd_na(val) -> bool:
    if val is None:
        return True
    if isinstance(val, float) and math.isnan(val):
        return True
    if isinstance(val, str) and val in _PANDAS_NA_STRINGS:
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


def _resolve_robust_col_name(col_names: list, possible_names):
    if isinstance(possible_names, str):
        possible_names = [possible_names]
    cleaned_names = {}
    for col in col_names:
        k_clean = " ".join(str(col).strip().upper().replace("'", "").replace('"', "").split())
        cleaned_names[k_clean] = col
    for name in possible_names:
        name_clean = " ".join(str(name).strip().upper().replace("'", "").replace('"', "").split())
        if name_clean in cleaned_names:
            return cleaned_names[name_clean]

    def _clean_k(s):
        return "".join(str(s).split()).replace(".", "").replace("(", "").replace(")", "").replace("_", "").replace("-", "").upper()

    col_set = set(col_names)
    for name in possible_names:
        if name in col_set:
            return name
        t_norm = _clean_k(name)
        for col in col_names:
            if _clean_k(col) == t_norm:
                return col
    return None


def _iter_parent_rows_streaming(source):
    """
    Lee un libro Excel (.xlsx) en modo read_only=True sin Materializar DataFrames
    ni dicts de 85 columnas por fila. Replica clean_and_rename_columns, el ffill
    de columnas de cabecera y el filtrado is_parent original.
    """
    src = io.BytesIO(source) if isinstance(source, (bytes, bytearray)) else source
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    try:
        ws = wb.active
        row_iter = ws.iter_rows(values_only=True)
        raw_header = next(row_iter, None)
        if not raw_header:
            raise ValueError("El archivo Excel está vacío o no tiene encabezados.")

        pandas_cols = dedup_pandas_headers(raw_header)
        raw_celda_idx = None
        for idx, col in enumerate(pandas_cols):
            if str(col).strip().upper() in ("CELDA", "CELDA_PADRE"):
                raw_celda_idx = idx
                break
        if raw_celda_idx is None:
            raise ValueError("No se encontró la columna 'CELDA' o 'CELDA_PADRE' en el archivo Excel.")

        cleaned_cols = _clean_rename_col_list(pandas_cols)
        last_col_by_name = {}
        for i, cname in enumerate(cleaned_cols):
            last_col_by_name[cname] = i

        needed_names = set()
        for aliases in _CONG_LOOKUP_GROUPS:
            matched = _resolve_robust_col_name(cleaned_cols, aliases)
            if matched is not None:
                needed_names.add(matched)
        for ffill_col in _CONG_FFILL_COLS:
            if ffill_col in last_col_by_name:
                needed_names.add(ffill_col)

        selected_items = [
            (cname, col_idx)
            for col_idx, cname in enumerate(cleaned_cols)
            if cname in needed_names and last_col_by_name[cname] == col_idx
        ]
        ffill_indices = [col_idx for cname, col_idx in selected_items if cname in _CONG_FFILL_COLS]
        max_needed_col = max([raw_celda_idx] + [col_idx for _, col_idx in selected_items]) + 1

        ffill_state = {col_idx: None for col_idx in ffill_indices}
        row_iter_trimmed = ws.iter_rows(min_row=2, max_col=max_needed_col, values_only=True)

        for fila_excel, row in enumerate(row_iter_trimmed, start=2):
            r_len = len(row)
            raw_celda = row[raw_celda_idx] if raw_celda_idx < r_len else None

            for col_idx in ffill_indices:
                v = row[col_idx] if col_idx < r_len else None
                if not _is_pd_na(v):
                    ffill_state[col_idx] = v

            if _is_pd_na(raw_celda):
                continue
            celda_str = str(raw_celda).strip()
            if celda_str == "" or celda_str in ("-1", "-1.0"):
                continue

            row_dict = {}
            for cname, col_idx in selected_items:
                if col_idx in ffill_state:
                    row_dict[cname] = ffill_state[col_idx]
                else:
                    row_dict[cname] = row[col_idx] if col_idx < r_len else None

            yield fila_excel, row_dict
    finally:
        wb.close()


def _write_wo_cong_sheet(wb, title: str, headers: list, max_lens: list, styled_rows_iter, row_count: int):
    ws = wb.create_sheet(title=title)
    for ci, ml in enumerate(max_lens, start=1):
        ws.column_dimensions[get_column_letter(ci)].width = max(ml + 4, 12)
    ws.append([
        make_wo_cell(ws, h, font=FONT_TITLE, fill=FILL_HEADER, alignment=ALIGN_CENTER, border=BORDER_THIN)
        for h in headers
    ])
    for row_cells in styled_rows_iter(ws):
        ws.append(row_cells)
    if row_count > 0:
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{row_count + 1}"


@router.post("/congruencia/auditar")
async def auditar_congruencia(file: UploadFile = File(...)):
    # 0. Gate de formato: solo .xlsx (openpyxl no lee .xls)
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail=f"Formato no soportado. Solo se aceptan archivos .xlsx (Excel 2007+): {file.filename}")

    headers_res_76 = ["Número de Fila", "ID", "Celda", "Campaña", "Dureza 76", "Resistencia Estimada Valor 76", "Correcto (Si/No)", "Valor Esperado"]
    headers_rqd_76 = ["Número de Fila", "ID", "Celda", "Campaña", "RQD 76", "RQD Valor 76", "Correcto (Si/No)", "Valor Esperado"]
    headers_res_89 = ["Número de Fila", "ID", "Celda", "Campaña", "Dureza 89", "UCS (MPa)", "Resistencia Estimada Valor 89", "Correcto (Si/No)", "Valor Esperado"]
    headers_rqd_89 = ["Número de Fila", "ID", "Celda", "Campaña", "RQD 89", "RQD Valor 89", "Correcto (Si/No)", "Valor Esperado"]

    ml_res_76 = [len(h) for h in headers_res_76]
    ml_rqd_76 = [len(h) for h in headers_rqd_76]
    ml_res_89 = [len(h) for h in headers_res_89]
    ml_rqd_89 = [len(h) for h in headers_rqd_89]

    rows_res_76, rows_rqd_76, rows_res_89, rows_rqd_89 = [], [], [], []

    def _track_ml(max_lens: list, vals: tuple):
        for ci, v in enumerate(vals):
            v_len = len(str(v or ""))
            if v_len > max_lens[ci]:
                max_lens[ci] = v_len

    ext = os.path.splitext(file.filename)[1] or ".xlsx"
    temp_path = None
    try:
        temp_path = await save_upload_to_temp(file, suffix=ext)
        try:
            for fila_excel, row_dict in _iter_parent_rows_streaming(temp_path):
                celda = sanitize_value(get_row_val_robust(row_dict, "CELDA_PADRE"), str)
                id_val = sanitize_value(get_row_val_robust(row_dict, "ID"), str) or f"F{fila_excel}"
                camp = get_resolved_campaign(row_dict)
                camp_str = str(camp) if camp else "N/A"

                # 1. Evaluar Resistencia 76
                res_76_res = evaluate_resistencia_76(row_dict)
                if res_76_res is not None:
                    correct, expected, msg = res_76_res
                    val_esp = "" if correct else expected
                    corr_str = "Si" if correct else f"No: {msg}"
                    dureza_76 = sanitize_value(get_row_val_robust(row_dict, ["DUREZA '76", "DUREZA  '76", "DUREZA 76"]), str) or ""
                    dureza_val_76 = sanitize_value(get_row_val_robust(row_dict, ["RESISTENCIA ESTIMADA VALOR '76", "RESISTENCIA ESTIMADA VALOR  '76", "RESISTENCIA ESTIMADA VALOR 76"]), float)
                    dureza_val_76_str = f"{dureza_val_76:.1f}" if dureza_val_76 is not None else ""
                    vals = (fila_excel, id_val, celda, camp_str, dureza_76, dureza_val_76_str, corr_str, val_esp)
                    _track_ml(ml_res_76, vals)
                    rows_res_76.append((vals, correct))

                # 2. Evaluar RQD 76
                rqd_76_res = evaluate_rqd_76(row_dict)
                if rqd_76_res is not None:
                    correct, expected, msg = rqd_76_res
                    val_esp = "" if correct else expected
                    corr_str = "Si" if correct else f"No: {msg}"
                    rqd_76 = sanitize_value(get_row_val_robust(row_dict, ["RQD '76", "RQD  '76", "RQD 76"]), float)
                    rqd_76_str = f"{rqd_76:.2f}" if rqd_76 is not None else ""
                    rqd_val_76 = sanitize_value(get_row_val_robust(row_dict, ["RQD - VALOR '76", "RQD - VALOR  '76", "RQD VALOR 76"]), float)
                    rqd_val_76_str = f"{rqd_val_76:.1f}" if rqd_val_76 is not None else ""
                    vals = (fila_excel, id_val, celda, camp_str, rqd_76_str, rqd_val_76_str, corr_str, val_esp)
                    _track_ml(ml_rqd_76, vals)
                    rows_rqd_76.append((vals, correct))

                # 3. Evaluar Resistencia 89 (Con columna UCS incorporada)
                res_89_res = evaluate_resistencia_89(row_dict, camp)
                if res_89_res is not None:
                    correct, expected, msg = res_89_res
                    val_esp = "" if correct else expected
                    corr_str = "Si" if correct else f"No: {msg}"
                    dureza_89 = sanitize_value(get_row_val_robust(row_dict, ["DUREZA '89", "DUREZA  '89", "DUREZA 89"]), str) or ""
                    ucs = sanitize_value(get_row_val_robust(row_dict, ["( UCS ) (Mpa)", "( UCS )  (Mpa)", "UCS (MPA)", "UCS", "UCS_MPA"]), float)
                    ucs_str = f"{ucs:.2f}" if ucs is not None else ""
                    dureza_val_89 = sanitize_value(get_row_val_robust(row_dict, ["RESISTENCIA ESTIMADA VALOR '89", "RESISTENCIA ESTIMADA VALOR  '89", "RESISTENCIA ESTIMADA VALOR 89"]), float)
                    dureza_val_89_str = f"{dureza_val_89:.2f}" if dureza_val_89 is not None else ""
                    vals = (fila_excel, id_val, celda, camp_str, dureza_89, ucs_str, dureza_val_89_str, corr_str, val_esp)
                    _track_ml(ml_res_89, vals)
                    rows_res_89.append((vals, correct))

                # 4. Evaluar RQD 89 (Con columna UCS removida)
                rqd_89_res = evaluate_rqd_89(row_dict, camp)
                if rqd_89_res is not None:
                    correct, expected, msg = rqd_89_res
                    val_esp = "" if correct else expected
                    corr_str = "Si" if correct else f"No: {msg}"
                    rqd_89 = sanitize_value(get_row_val_robust(row_dict, ["RQD '89", "RQD  '89", "RQD 89"]), float)
                    rqd_89_str = f"{rqd_89:.2f}" if rqd_89 is not None else ""
                    rqd_val_89 = sanitize_value(get_row_val_robust(row_dict, ["RQD - VALOR '89", "RQD - VALOR  '89", "RQD VALOR 89"]), float)
                    rqd_val_89_str = f"{rqd_val_89:.2f}" if rqd_val_89 is not None else ""
                    vals = (fila_excel, id_val, celda, camp_str, rqd_89_str, rqd_val_89_str, corr_str, val_esp)
                    _track_ml(ml_rqd_89, vals)
                    rows_rqd_89.append((vals, correct))
        except ValueError as ve:
            msg = str(ve)
            if "CELDA" in msg:
                raise HTTPException(status_code=400, detail="No se encontró la columna 'CELDA' o 'CELDA_PADRE' en el archivo Excel.")
            raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo Excel: {ve}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo Excel: {e}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass

    wb = openpyxl.Workbook(write_only=True)

    def _iter_res_76(ws):
        for v, corr in rows_res_76:
            fill_c = FILL_GREEN if corr else FILL_RED
            font_c = FONT_GREEN if corr else FONT_RED
            align_esp = ALIGN_RIGHT if isinstance(v[7], (int, float)) else ALIGN_LEFT
            yield [
                make_wo_cell(ws, v[0], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(ws, v[1], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(ws, v[2], font=FONT_DATA, alignment=ALIGN_LEFT, border=BORDER_THIN),
                make_wo_cell(ws, v[3], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(ws, v[4], font=FONT_DATA, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(ws, v[5], font=FONT_MONO, alignment=ALIGN_RIGHT, border=BORDER_THIN),
                make_wo_cell(ws, v[6], fill=fill_c, font=font_c, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(ws, v[7], font=FONT_MONO, alignment=align_esp, border=BORDER_THIN),
            ]

    def _iter_rqd_rows(rows_list):
        def _inner(ws):
            for v, corr in rows_list:
                fill_c = FILL_GREEN if corr else FILL_RED
                font_c = FONT_GREEN if corr else FONT_RED
                align_esp = ALIGN_RIGHT if isinstance(v[7], (int, float)) else ALIGN_LEFT
                yield [
                    make_wo_cell(ws, v[0], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
                    make_wo_cell(ws, v[1], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
                    make_wo_cell(ws, v[2], font=FONT_DATA, alignment=ALIGN_LEFT, border=BORDER_THIN),
                    make_wo_cell(ws, v[3], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
                    make_wo_cell(ws, v[4], font=FONT_MONO, alignment=ALIGN_RIGHT, border=BORDER_THIN),
                    make_wo_cell(ws, v[5], font=FONT_MONO, alignment=ALIGN_RIGHT, border=BORDER_THIN),
                    make_wo_cell(ws, v[6], fill=fill_c, font=font_c, alignment=ALIGN_CENTER, border=BORDER_THIN),
                    make_wo_cell(ws, v[7], font=FONT_MONO, alignment=align_esp, border=BORDER_THIN),
                ]
        return _inner

    def _iter_res_89(ws):
        for v, corr in rows_res_89:
            fill_c = FILL_GREEN if corr else FILL_RED
            font_c = FONT_GREEN if corr else FONT_RED
            align_esp = ALIGN_RIGHT if isinstance(v[8], (int, float)) else ALIGN_LEFT
            yield [
                make_wo_cell(ws, v[0], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(ws, v[1], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(ws, v[2], font=FONT_DATA, alignment=ALIGN_LEFT, border=BORDER_THIN),
                make_wo_cell(ws, v[3], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(ws, v[4], font=FONT_DATA, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(ws, v[5], font=FONT_MONO, alignment=ALIGN_RIGHT, border=BORDER_THIN),
                make_wo_cell(ws, v[6], font=FONT_MONO, alignment=ALIGN_RIGHT, border=BORDER_THIN),
                make_wo_cell(ws, v[7], fill=fill_c, font=font_c, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(ws, v[8], font=FONT_MONO, alignment=align_esp, border=BORDER_THIN),
            ]

    _write_wo_cong_sheet(wb, "Resistencia 76", headers_res_76, ml_res_76, _iter_res_76, len(rows_res_76))
    rows_res_76.clear()
    _write_wo_cong_sheet(wb, "RQD 76", headers_rqd_76, ml_rqd_76, _iter_rqd_rows(rows_rqd_76), len(rows_rqd_76))
    rows_rqd_76.clear()
    _write_wo_cong_sheet(wb, "Resistencia 89", headers_res_89, ml_res_89, _iter_res_89, len(rows_res_89))
    rows_res_89.clear()
    _write_wo_cong_sheet(wb, "RQD 89", headers_rqd_89, ml_rqd_89, _iter_rqd_rows(rows_rqd_89), len(rows_rqd_89))
    rows_rqd_89.clear()
    gc.collect()

    return wb_to_temp_file_response(wb, "Revision_Congruencia_Consolidada.xlsx")


def _get_parent_cells_map(contents) -> dict:
    cells_map = {}
    for fila_excel, row_dict in _iter_parent_rows_streaming(contents):
        celda = sanitize_value(get_row_val_robust(row_dict, "CELDA_PADRE"), str)
        if not celda:
            continue

        camp = get_resolved_campaign(row_dict)
        key = (celda.strip().upper(), camp)

        # Si ya agregamos esta celda-campaña, evitamos que las filas de discontinuidades (vacías) la pisen
        if key in cells_map:
            continue

        cells_map[key] = {
            "fila": fila_excel,
            "id": sanitize_value(get_row_val_robust(row_dict, "ID"), str) or f"F{fila_excel}",
            "celda": celda,
            "campania": camp,
            "dureza_76": sanitize_value(get_row_val_robust(row_dict, ["DUREZA '76", "DUREZA  '76", "DUREZA 76"]), str) or "",
            "resistencia_76": sanitize_value(get_row_val_robust(row_dict, ["RESISTENCIA ESTIMADA VALOR '76", "RESISTENCIA ESTIMADA VALOR  '76", "RESISTENCIA ESTIMADA VALOR 76", "RESISTENCIA ESTIMADA '76", "RESISTENCIA ESTIMADA 76"]), float),
            "rqd_76": sanitize_value(get_row_val_robust(row_dict, ["RQD '76", "RQD  '76", "RQD 76"]), float),
            "rqd_valor_76": sanitize_value(get_row_val_robust(row_dict, ["RQD - VALOR '76", "RQD - VALOR  '76", "RQD VALOR 76", "RQD - VALOR 76", "RQD VALOR  '76"]), float),
            "dureza_89": sanitize_value(get_row_val_robust(row_dict, ["DUREZA '89", "DUREZA  '89", "DUREZA 89"]), str) or "",
            "resistencia_89": sanitize_value(get_row_val_robust(row_dict, ["RESISTENCIA ESTIMADA VALOR '89", "RESISTENCIA ESTIMADA VALOR  '89", "RESISTENCIA ESTIMADA VALOR 89", "RESISTENCIA ESTIMADA '89", "RESISTENCIA ESTIMADA 89"]), float),
            "ucs": sanitize_value(get_row_val_robust(row_dict, ["( UCS ) (Mpa)", "( UCS )  (Mpa)", "UCS (MPA)", "UCS", "UCS_MPA"]), float),
            "rqd_89": sanitize_value(get_row_val_robust(row_dict, ["RQD '89", "RQD  '89", "RQD 89"]), float),
            "rqd_valor_89": sanitize_value(get_row_val_robust(row_dict, ["RQD - VALOR '89", "RQD - VALOR  '89", "RQD VALOR 89", "RQD - VALOR 89", "RQD VALOR  '89"]), float),
        }
    return cells_map


@router.post("/congruencia/comparar")
async def comparar_congruencia(antes: UploadFile = File(...), despues: UploadFile = File(...)):
    # 0. Gate de formato: solo .xlsx (openpyxl no lee .xls)
    for f in [antes, despues]:
        if not f.filename.lower().endswith(".xlsx"):
            raise HTTPException(status_code=400, detail=f"Formato no soportado. Solo se aceptan archivos .xlsx (Excel 2007+): {f.filename}")

    path_antes = None
    path_despues = None
    try:
        path_antes = await save_upload_to_temp(antes, suffix=os.path.splitext(antes.filename)[1] or ".xlsx")
        try:
            map_antes = _get_parent_cells_map(path_antes)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error leyendo archivo ANTES: {e}")

        path_despues = await save_upload_to_temp(despues, suffix=os.path.splitext(despues.filename)[1] or ".xlsx")
        try:
            map_despues = _get_parent_cells_map(path_despues)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error leyendo archivo DESPUES: {e}")
    finally:
        for p in (path_antes, path_despues):
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass

    comp_header = [
        "Celda", "Campaña",
        "Fila Antes", "Fila Después", "Cambio Fila",
        "ID Antes", "ID Después", "Cambio ID",
        "Dureza 76 Antes", "Dureza 76 Después", "Cambio Dureza 76",
        "Resistencia 76 Antes", "Resistencia 76 Después", "Cambio Resistencia 76",
        "RQD 76 Antes", "RQD 76 Después", "Cambio RQD 76",
        "RQD Valor 76 Antes", "RQD Valor 76 Después", "Cambio RQD Valor 76",
        "Dureza 89 Antes", "Dureza 89 Después", "Cambio Dureza 89",
        "Resistencia 89 Antes", "Resistencia 89 Después", "Cambio Resistencia 89",
        "UCS Antes", "UCS Después", "Cambio UCS",
        "RQD 89 Antes", "RQD 89 Después", "Cambio RQD 89",
        "RQD Valor 89 Antes", "RQD Valor 89 Después", "Cambio RQD Valor 89",
    ]
    miss_header = ["Celda", "Campaña", "Fila", "ID", "Archivo Origen"]

    ml_comp = [len(h) for h in comp_header]
    ml_miss = [len(h) for h in miss_header]

    all_keys = set(map_antes.keys()) | set(map_despues.keys())
    sorted_keys = sorted(all_keys, key=lambda x: (natural_sort_key(x[0]), x[1] or 0))
    del all_keys

    def format_val(val):
        if val is None:
            return ""
        if isinstance(val, float):
            return round(val, 2)
        return val

    comp_rows = []
    miss_rows = []
    for key in sorted_keys:
        a_data = map_antes.get(key)
        d_data = map_despues.get(key)

        if a_data and d_data:
            fila_a, fila_d = a_data["fila"], d_data["fila"]
            id_a, id_d = a_data["id"], d_data["id"]
            d76_a, d76_d = a_data["dureza_76"], d_data["dureza_76"]
            r76_a, r76_d = a_data["resistencia_76"], d_data["resistencia_76"]
            rq76_a, rq76_d = a_data["rqd_76"], d_data["rqd_76"]
            rqv76_a, rqv76_d = a_data["rqd_valor_76"], d_data["rqd_valor_76"]
            d89_a, d89_d = a_data["dureza_89"], d_data["dureza_89"]
            r89_a, r89_d = a_data["resistencia_89"], d_data["resistencia_89"]
            ucs_a, ucs_d = a_data["ucs"], d_data["ucs"]
            rq89_a, rq89_d = a_data["rqd_89"], d_data["rqd_89"]
            rqv89_a, rqv89_d = a_data["rqd_valor_89"], d_data["rqd_valor_89"]

            row_data = (
                key[0],
                str(key[1]) if key[1] else "N/A",
                fila_a, fila_d, "Si" if fila_a != fila_d else "No",
                id_a, id_d, "Si" if id_a != id_d else "No",
                d76_a, d76_d, "Si" if d76_a != d76_d else "No",
                format_val(r76_a), format_val(r76_d), "Si" if r76_a != r76_d else "No",
                format_val(rq76_a), format_val(rq76_d), "Si" if rq76_a != rq76_d else "No",
                format_val(rqv76_a), format_val(rqv76_d), "Si" if rqv76_a != rqv76_d else "No",
                d89_a, d89_d, "Si" if d89_a != d89_d else "No",
                format_val(r89_a), format_val(r89_d), "Si" if r89_a != r89_d else "No",
                format_val(ucs_a), format_val(ucs_d), "Si" if ucs_a != ucs_d else "No",
                format_val(rq89_a), format_val(rq89_d), "Si" if rq89_a != rq89_d else "No",
                format_val(rqv89_a), format_val(rqv89_d), "Si" if rqv89_a != rqv89_d else "No",
            )
            for ci, v in enumerate(row_data):
                v_len = len(str(v or ""))
                if v_len > ml_comp[ci]:
                    ml_comp[ci] = v_len
            comp_rows.append(row_data)
        else:
            orig = "Antes" if a_data else "Después"
            dat = a_data if a_data else d_data
            row_m = (
                dat["celda"],
                str(dat["campania"]) if dat["campania"] else "N/A",
                dat["fila"],
                dat["id"],
                orig,
            )
            for ci, v in enumerate(row_m):
                v_len = len(str(v or ""))
                if v_len > ml_miss[ci]:
                    ml_miss[ci] = v_len
            miss_rows.append(row_m)

    del map_antes, map_despues, sorted_keys
    gc.collect()

    change_cols = {5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35}

    def _iter_comp(ws):
        for row_data in comp_rows:
            cells = [
                make_wo_cell(ws, row_data[0], font=FONT_DATA, alignment=ALIGN_LEFT, border=BORDER_THIN),
                make_wo_cell(ws, row_data[1], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
            ]
            for col_i in range(3, 36):
                val = row_data[col_i - 1]
                if col_i in change_cols:
                    is_ch = val == "Si"
                    cells.append(make_wo_cell(
                        ws, val,
                        fill=(FILL_RED if is_ch else FILL_GREEN),
                        font=(FONT_RED if is_ch else FONT_GREEN),
                        alignment=ALIGN_CENTER,
                        border=BORDER_THIN,
                    ))
                elif isinstance(val, (int, float)):
                    cells.append(make_wo_cell(ws, val, font=FONT_MONO, alignment=ALIGN_RIGHT, border=BORDER_THIN))
                elif col_i in (3, 4, 6, 7):
                    cells.append(make_wo_cell(ws, val, font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN))
                else:
                    cells.append(make_wo_cell(ws, val, alignment=ALIGN_LEFT, border=BORDER_THIN))
            yield cells

    def _iter_miss(ws):
        for row_m in miss_rows:
            is_antes = row_m[4] == "Antes"
            yield [
                make_wo_cell(ws, row_m[0], font=FONT_DATA, alignment=ALIGN_LEFT, border=BORDER_THIN),
                make_wo_cell(ws, row_m[1], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(ws, row_m[2], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(ws, row_m[3], font=FONT_MONO, alignment=ALIGN_CENTER, border=BORDER_THIN),
                make_wo_cell(
                    ws, row_m[4],
                    fill=(FILL_RED if is_antes else FILL_GREEN),
                    font=(FONT_RED if is_antes else FONT_GREEN),
                    alignment=ALIGN_CENTER,
                    border=BORDER_THIN,
                ),
            ]

    wb = openpyxl.Workbook(write_only=True)
    _write_wo_cong_sheet(wb, "Comparaciones", comp_header, ml_comp, _iter_comp, len(comp_rows))
    comp_rows.clear()
    _write_wo_cong_sheet(wb, "Celdas Faltantes", miss_header, ml_miss, _iter_miss, len(miss_rows))
    miss_rows.clear()
    gc.collect()

    return wb_to_temp_file_response(wb, "Comparacion_Celdas_Padre.xlsx")