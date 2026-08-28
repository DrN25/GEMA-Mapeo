"""
app/utils/plt_validator.py — Motor de Validación QA/QC para Ensayos PLT Irregulares.
Procesa archivos Excel de Ensayos PLT, detecta inconsistencias contra las reglas SSOT (rules_plt.py),
analiza la integridad de celdas A-B-C-D y exporta el diagnóstico estructurado.
"""

import json
import math
import os
import re
import time
import unicodedata
from collections import defaultdict
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

import openpyxl
import pandas as pd

from app.core.catalogs import (
    LITHOLOGY_FULL_CATALOG,
    LITHOLOGY_GROUP_SYNONYMS,
)
from app.core.rules_plt import RULES_REGISTRY_PLT, CATEGORIES_REGISTRY_PLT


PLT_MANDATORY_COLS_COUNT = 34
CAT_DIRECCION_ROTURA = ["Pa", "Pe", "NA"]
CAT_TIPO_FRACTURA = ["M", "E", "C"]

# ---------------------------------------------------------------------------
# Catálogo oficial ISRM (SSOT)
# ---------------------------------------------------------------------------
ISRM_TABLE_PLT = [
    {"indice": "R0", "min_ucs": 0.25, "max_ucs": 1.0, "denominacion": "Extremadamente débil"},
    {"indice": "R1", "min_ucs": 1.0, "max_ucs": 5.0, "denominacion": "Muy débil"},
    {"indice": "R2", "min_ucs": 5.0, "max_ucs": 25.0, "denominacion": "Débil"},
    {"indice": "R3", "min_ucs": 25.0, "max_ucs": 50.0, "denominacion": "Moderadamente resistente"},
    {"indice": "R4", "min_ucs": 50.0, "max_ucs": 100.0, "denominacion": "Resistente"},
    {"indice": "R5", "min_ucs": 100.0, "max_ucs": 250.0, "denominacion": "Muy resistente"},
    {"indice": "R6", "min_ucs": 250.0, "max_ucs": float("inf"), "denominacion": "Extremadamente resistente"},
]

# Sinónimos canónicos para mapear columnas de ambos formatos de Excel
PLT_CANONICAL_COLUMNS = {
    "campania": ["CAMPANA SRK", "CAMPANA", "CAMPANIA"],
    "fecha_ensayo": ["FECHA DE ENSAYO2", "FECHA DE ENSAYO", "FECHAENSAYO", "FECHA_ENSAYO", "FECHA"],
    "tipo_ensayo": ["TIPO DE ENSAYO", "TIPO_ENSAYO", "TIPO ENSAYO"],
    "ejecutado_por": ["EJECUTADO POR", "EJECUCION DE ENSAYO", "EJECUTADOPOR"],
    "zona_muestreo": ["ZONA DE MUESTREO", "ZONADEMUESTREO", "ZONA DE MAPEO", "ZONA_MAPEO", "ZONA"],
    "nivel": ["NIVEL"],
    "celda_mapeo": ["CELDA DE MAPEO", "CELDAMAPEO", "CELDA_MAPEO", "CELDA"],
    "muestra": ["MUESTRA"],
    "codigo_muestra": ["CODIGO DE MUESTRA", "CODIGO MUESTRA", "CODIGO_MUESTRA"],
    "litologia_1": ["LITOLOGIA 1", "LITOLOGIA_1", "LITO 1", "LITO1"],
    "litologia_2": ["LITOLOGIA 2", "LITOLOGIA_2", "LITO 2", "LITO2"],
    "litologia_3": ["LITOLOGIA 3", "LITOLOGIA_3", "LITO 3", "LITO3"],
    "tipo_litologico": ["TIPO LITOLOGICO", "TIPO_LITOLOGICO", "TIPO LITOLICO", "TIPOLITOLOGICO"],
    "este": ["ESTE (M)", "ESTE(M)", "ESTE", "EAST"],
    "norte": ["NORTE (M)", "NORTE(M)", "NORTE", "NORTH"],
    "elevacion": ["ELEVACION (MSNM)", "ELEVACION(MSNM)", "ELEVACION", "COTA", "Z"],
    "espesor_d": ["ESPESOR D (CM)", "ESPESOR D", "ESPESORD(CM)", "ESPESORD", "ESPESOR"],
    "longitud_l": ["LONGITUD L (CM)", "LONGITUD L", "LONGITUDL(CM)", "LONGITUDL", "LONGITUD"],
    "ancho_w1": ["ANCHO W1 (CM)", "ANCHO W1", "ANCHOW1(CM)", "ANCHOW1"],
    "ancho_w2": ["ANCHO W2 (CM)", "ANCHO W2", "ANCHOW2(CM)", "ANCHOW2"],
    "ancho_w": ["ANCHO W (CM)", "ANCHO W", "ANCHOW(CM)", "ANCHOW"],
    "muestra_valida_long": ["MUESTRA VALIDA - LONGITUD", "MUESTRA VALIDA LONGITUD", "VALIDA LONGITUD"],
    "muestra_valida_ancho": ["MUESTRA VALIDA - ANCHO", "MUESTRA VALIDA ANCHO", "VALIDA ANCHO"],
    "fuerza_p": ["FUERZA P (KN)", "FUERZA P", "FUERZAP(KN)", "FUERZAP", "FUERZA"],
    "direccion_rotura": ["DIRECCION DE ROTURA", "DIRECCION DE RUPTURA", "DIRECCION_ROTURA", "DIRECCION ROTURA"],
    "tipo_fractura": ["TIPO DE FRACTURA", "TIPO FRACTURA", "TIPO_FRACTURA"],
    "diametro_equiv": ["DIAMETRO EQUIVALENTE (CM)", "DIAMETRO EQUIVALENTE", "DIAMETROEQUIVALENTE"],
    "f": ["F", "FACTOR F", "FACTOR_F"],
    "is_mpa": ["IS (MPA)", "IS(MPA)", "IS"],
    "is50_mpa": ["IS(50) (MPA)", "IS50 (MPA)", "IS(50)", "IS50"],
    "factor_k": ["FACTOR DE CONVERSION K", "FACTOR DE CONVERSION", "FACTOR K", "FACTOR_K", "K"],
    "ucs_mpa": ["RCS/UCS (MPA)", "RCS (MPA)", "UCS (MPA)", "RCS", "UCS"],
    "resistencia_isrm": ["RESISTENCIA ISRM", "RESISTENCIA_ISRM", "ISRM"],
    "observaciones": ["OBSERVACIONES", "OBSERVACION", "COMENTARIOS", "COMENTARIO"],
}


def _strip_accents(text: str) -> str:
    """Remueve acentos y caracteres diacríticos."""
    if not text:
        return ""
    text = unicodedata.normalize('NFD', str(text))
    return "".join(c for c in text if unicodedata.category(c) != 'Mn')


def _norm_str(val: Any) -> str:
    """Normaliza texto eliminando acentos, saltos de línea y espacios redundantes."""
    if val is None or pd.isna(val):
        return ""
    s = _strip_accents(str(val)).strip().replace("\r", " ").replace("\n", " ")
    s = re.sub(r"\s+", " ", s).upper()
    return s


def sanitize_number(val: Any) -> Optional[float]:
    """Convierte cualquier valor a float seguro, o None si es nulo/inválido/error de fórmula."""
    if val is None or pd.isna(val):
        return None
    s = str(val).strip().replace(",", "")
    if s == "" or s.upper() in ("NONE", "NAN", "NULL", "N/A", "-", "#VALUE!", "#REF!", "#DIV/0!", "#NAME?", "#N/A"):
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def sanitize_date(val: Any) -> Tuple[Optional[datetime], Optional[str]]:
    """Parsea una fecha desde datetime, pandas Timestamp, string o serial numérico de Excel."""
    if val is None or pd.isna(val):
        return None, None

    if isinstance(val, (datetime, pd.Timestamp)):
        dt_val = val.to_pydatetime() if hasattr(val, "to_pydatetime") else val
        return dt_val, dt_val.strftime("%Y-%m-%d")

    # Serial numérico de Excel
    if isinstance(val, (int, float)):
        try:
            dt = pd.to_datetime(val, unit="D", origin="1899-12-30")
            return dt.to_pydatetime(), dt.strftime("%Y-%m-%d")
        except Exception:
            pass

    s = str(val).strip()
    if not s or s.upper() in ("NONE", "NAN", "NULL", "N/A", "-"):
        return None, None

    formats = [
        "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d",
        "%d/%m/%y", "%d-%m-%y", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S"
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return dt, dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    try:
        dt_pd = pd.to_datetime(s)
        return dt_pd.to_pydatetime(), dt_pd.strftime("%Y-%m-%d")
    except Exception:
        return None, s


def is_formula_error(val: Any) -> bool:
    """Detecta si un valor de celda es un error de fórmula de Excel."""
    if val is None:
        return False
    s = str(val).strip().upper()
    return any(err in s for err in ("#VALUE!", "#REF!", "#DIV/0!", "#NAME?", "#N/A", "#NUM!", "#NULL!"))


def normalize_lithology_group(group_val: Any) -> str:
    """Normaliza plurales, prefijos ('ROCA') y variaciones ortográficas de grupos litológicos."""
    if not group_val:
        return ""
    s = _norm_str(group_val)
    if "INTRUSIV" in s:
        return "INTRUSIVOS"
    if "SEDIMENTAR" in s:
        return "SEDIMENTARIOS"
    if "METAMORF" in s:
        return "METAMORFICAS"
    if "BRECHA" in s:
        return "BRECHAS"
    if "SKARN" in s or "ENDO" in s:
        return "ENDOSKARN"
    return LITHOLOGY_GROUP_SYNONYMS.get(s, s)


def resolve_expected_lithology(l1: str, l2: str, l3: str) -> Tuple[Optional[str], Optional[float]]:
    """
    Resuelve el grupo litológico esperado y el factor K a partir de Lito 1, 2 y 3
    usando LITHOLOGY_FULL_CATALOG (SSOT del sistema).
    """
    c_l1 = _norm_str(l1)
    c_l2 = _norm_str(l2)
    c_l3 = _norm_str(l3)

    if not c_l1 and not c_l2 and not c_l3:
        return None, None

    # Normalizar comodines
    norm_l3 = "NR" if (not c_l3 or c_l3 in ("-", "NR", "VARIOS", "NONE")) else c_l3

    # 1. Búsqueda exacta completa (lito1, lito2, lito3)
    for it in LITHOLOGY_FULL_CATALOG:
        it_l1 = _norm_str(it.get("lito1"))
        it_l2 = _norm_str(it.get("lito2"))
        it_l3 = _norm_str(it.get("lito3"))
        if it_l1 == c_l1 and it_l2 == c_l2 and (it_l3 == c_l3 or (norm_l3 == "NR" and it_l3 in ("-", "NR", "VARIOS"))):
            return normalize_lithology_group(it.get("grupo")), it.get("k")

    # 2. Búsqueda por lito2 y lito3
    if c_l2:
        for it in LITHOLOGY_FULL_CATALOG:
            it_l2 = _norm_str(it.get("lito2"))
            it_l3 = _norm_str(it.get("lito3"))
            if it_l2 == c_l2 and (it_l3 == c_l3 or (norm_l3 == "NR" and it_l3 in ("-", "NR", "VARIOS"))):
                return normalize_lithology_group(it.get("grupo")), it.get("k")

    # 3. Búsqueda directa de lito3
    if c_l3 and c_l3 not in ("-", "NR", "VARIOS"):
        for it in LITHOLOGY_FULL_CATALOG:
            it_l3 = _norm_str(it.get("lito3"))
            if it_l3 == c_l3:
                return normalize_lithology_group(it.get("grupo")), it.get("k")

    return None, None


def get_expected_isrm(ucs_val: Optional[float]) -> Optional[str]:
    """Calcula el índice ISRM oficial (R0 a R6) correspondiente a un UCS."""
    if ucs_val is None or ucs_val < 0.25:
        return None
    for r in ISRM_TABLE_PLT:
        if r["min_ucs"] <= ucs_val < r["max_ucs"]:
            return r["indice"]
    return "R6" if ucs_val >= 250.0 else None


def normalize_sample_code(celda: str, muestra: str) -> str:
    """Genera la representación canónica del código de muestra."""
    c = str(celda or "").strip().upper()
    m = str(muestra or "").strip().upper()
    if c and m:
        return f"{c}_{m}"
    return c or m


def are_sample_codes_compatible(actual: str, celda: str, muestra: str) -> bool:
    """
    Verifica si el código de muestra ingresado es compatible con {celda} y {muestra},
    siendo flexible con separadores ('-', '_', espacio o pegado).
    """
    act_clean = re.sub(r"[\s\-_]+", "", _norm_str(actual))
    exp_clean = re.sub(r"[\s\-_]+", "", f"{_norm_str(celda)}{_norm_str(muestra)}")
    return act_clean == exp_clean if exp_clean else True


def detect_header_row(file_path: str, max_check: int = 10) -> int:
    """
    Detecta automáticamente la fila de encabezados reales en el Excel (0-indexed)
    buscando palabras clave como FECHA y (CELDA o MUESTRA o NIVEL).
    """
    df_sample = pd.read_excel(file_path, sheet_name=0, header=None, nrows=max_check)
    for r_idx in range(len(df_sample)):
        row_vals = [_norm_str(x) for x in df_sample.iloc[r_idx] if pd.notna(x)]
        has_fecha = any("FECHA" in v for v in row_vals)
        has_id = any("CELDA" in v or "MUESTRA" in v or "NIVEL" in v for v in row_vals)
        if has_fecha and has_id:
            return r_idx
    return 0


# ---------------------------------------------------------------------------
# MOTOR PRINCIPAL DE VALIDACIÓN PLT
# ---------------------------------------------------------------------------

def validate_plt_excel(
    file_path: str,
    output_json_path: Optional[str] = None,
    tolerance: float = 0.1
) -> dict:
    """
    Audita un archivo Excel de Ensayos PLT (.xlsx / .xlsm) contra las reglas QAQC oficiales.
    Retorna un diccionario completo con incidencias, métricas y resumen de celdas.
    """
    t_start = time.time()
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Archivo Excel no encontrado: {file_path}")

    # Detectar la fila de encabezados reales
    header_row_idx = detect_header_row(file_path)

    # Cargar Excel con pandas en la fila de encabezados detectada
    df_raw = pd.read_excel(file_path, sheet_name=0, header=header_row_idx)

    # Mapeo dinámico de columnas del Excel a las claves canónicas
    col_map: Dict[str, str] = {}
    for canon_key, synonyms in PLT_CANONICAL_COLUMNS.items():
        found = False
        for raw_col in df_raw.columns:
            raw_norm = _norm_str(raw_col)
            if raw_norm in synonyms:
                col_map[canon_key] = raw_col
                found = True
                break
        if not found:
            # Búsqueda difusa por substring
            for raw_col in df_raw.columns:
                raw_norm = _norm_str(raw_col)
                if any(s in raw_norm for s in synonyms if len(s) > 3):
                    col_map[canon_key] = raw_col
                    break

    incidencias: List[dict] = []
    total_filas = len(df_raw)

    # 1. Agrupamiento cronológico por (Fecha, Celda) para evaluar Integridad ABCD
    cell_groups: Dict[Tuple[str, str], List[dict]] = defaultdict(list)

    for idx, row in df_raw.iterrows():
        fila_excel = idx + header_row_idx + 2  # 1-indexed en Excel
        fecha_raw = row.get(col_map.get("fecha_ensayo"))
        _, fecha_str = sanitize_date(fecha_raw)
        celda_raw = str(row.get(col_map.get("celda_mapeo"), "") or "").strip().upper()
        muestra_raw = str(row.get(col_map.get("muestra"), "") or "").strip().upper()

        group_key = (fecha_str or "SIN_FECHA", celda_raw or f"FILA_{fila_excel}")
        cell_groups[group_key].append({
            "fila_excel": fila_excel,
            "muestra": muestra_raw,
            "row_data": row
        })

    # Resumen de celdas y evaluación de secuencia ABCD
    resumen_celdas: Dict[str, dict] = {}

    for (fecha_k, celda_k), group_rows in cell_groups.items():
        count_muestras = len(group_rows)
        muestras_secuencia = [r["muestra"] for r in group_rows]
        secuencia_str = "-".join(muestras_secuencia) if muestras_secuencia else "VACÍA"
        filas_nums = [r["fila_excel"] for r in group_rows]

        first_row = group_rows[0]["row_data"]
        camp_val = first_row.get(col_map.get("campania"))
        lito_val = normalize_lithology_group(first_row.get(col_map.get("tipo_litologico")))
        nivel_val = sanitize_number(first_row.get(col_map.get("nivel")))

        # Clasificación de la secuencia ABCD
        has_formula_err = any(
            is_formula_error(r["row_data"].get(col_map.get(k)))
            for r in group_rows
            for k in ("is50_mpa", "ucs_mpa", "fuerza_p", "ancho_w")
            if col_map.get(k)
        )

        if has_formula_err:
            estado_secuencia = "ANÓMALA"
        elif muestras_secuencia == ["A", "B", "C", "D"]:
            estado_secuencia = "CORRECTO (A-B-C-D)"
        elif count_muestras == 4 and set(muestras_secuencia) == {"A", "B", "C", "D"}:
            estado_secuencia = "ORDEN INCORRECTO"
        elif count_muestras < 4:
            estado_secuencia = "INCOMPLETA (< 4)"
        elif count_muestras > 4:
            estado_secuencia = "EXCEDENTE (> 4)"
        else:
            estado_secuencia = "ORDEN INCORRECTO"

        cell_entry_key = f"{celda_k} ({fecha_k})" if fecha_k != "SIN_FECHA" else celda_k

        resumen_celdas[cell_entry_key] = {
            "celda": celda_k,
            "fecha": fecha_k,
            "campania": camp_val,
            "tipo_litologico": lito_val,
            "nivel": nivel_val,
            "total_muestras": count_muestras,
            "secuencia": secuencia_str,
            "estado_secuencia": estado_secuencia,
            "filas": filas_nums,
            "alertas": 0,
            "advertencias": 0,
            "vacios": 0,
        }

        # Registrar advertencia si la secuencia no es correcta canónica
        if estado_secuencia == "ORDEN INCORRECTO":
            incidencias.append({
                "fila_excel": filas_nums[0],
                "tipo_incidencia": "ADVERTENCIA",
                "rule_code": "WRN_PLT_SECUENCIA_DESORDEN",
                "celda_mapeo": celda_k,
                "campania": camp_val,
                "columna": "Celda de mapeo",
                "valor_actual": secuencia_str,
                "mensaje": RULES_REGISTRY_PLT["WRN_PLT_SECUENCIA_DESORDEN"].format_message(
                    celda=celda_k, secuencia=secuencia_str
                ),
            })
            resumen_celdas[cell_entry_key]["advertencias"] += 1
        elif estado_secuencia == "INCOMPLETA (< 4)":
            incidencias.append({
                "fila_excel": filas_nums[0],
                "tipo_incidencia": "ADVERTENCIA",
                "rule_code": "WRN_PLT_CELDA_INCOMPLETA",
                "celda_mapeo": celda_k,
                "campania": camp_val,
                "columna": "Celda de mapeo",
                "valor_actual": secuencia_str,
                "mensaje": RULES_REGISTRY_PLT["WRN_PLT_CELDA_INCOMPLETA"].format_message(
                    celda=celda_k, count=count_muestras, secuencia=secuencia_str
                ),
            })
            resumen_celdas[cell_entry_key]["advertencias"] += 1
        elif estado_secuencia == "EXCEDENTE (> 4)":
            incidencias.append({
                "fila_excel": filas_nums[0],
                "tipo_incidencia": "ADVERTENCIA",
                "rule_code": "WRN_PLT_CELDA_EXCEDENTE",
                "celda_mapeo": celda_k,
                "campania": camp_val,
                "columna": "Celda de mapeo",
                "valor_actual": secuencia_str,
                "mensaje": RULES_REGISTRY_PLT["WRN_PLT_CELDA_EXCEDENTE"].format_message(
                    celda=celda_k, count=count_muestras, secuencia=secuencia_str
                ),
            })
            resumen_celdas[cell_entry_key]["advertencias"] += 1

    # 2. Validación Fila a Fila (Reglas QAQC de las 34 Columnas)
    for idx, row in df_raw.iterrows():
        fila_excel = idx + header_row_idx + 2

        def get_val(key: str) -> Any:
            col_name = col_map.get(key)
            return row.get(col_name) if col_name else None

        celda_raw = str(get_val("celda_mapeo") or "").strip().upper()
        camp_raw = get_val("campania")
        fecha_dt, fecha_str = sanitize_date(get_val("fecha_ensayo"))
        cell_key = f"{celda_raw} ({fecha_str})" if fecha_str else celda_raw

        def reg_err(col_key_name: str, val_actual: Any, rule_code: str, **kwargs):
            rule_obj = RULES_REGISTRY_PLT.get(rule_code)
            if not rule_obj:
                return
            cat_obj = CATEGORIES_REGISTRY_PLT.get(rule_obj.category_code)
            sev = cat_obj.severity if cat_obj else "ALERTA"
            msg = rule_obj.format_message(**kwargs)

            # Nombre oficial de columna
            display_col = col_map.get(col_key_name, col_key_name)

            incidencias.append({
                "fila_excel": fila_excel,
                "tipo_incidencia": sev,
                "rule_code": rule_code,
                "celda_mapeo": celda_raw,
                "campania": camp_raw,
                "columna": display_col,
                "valor_actual": str(val_actual) if val_actual is not None else "—",
                "mensaje": msg,
            })

            # Actualizar contadores en resumen de celda
            if cell_key in resumen_celdas:
                if sev == "ALERTA":
                    resumen_celdas[cell_key]["alertas"] += 1
                elif sev == "ADVERTENCIA":
                    resumen_celdas[cell_key]["advertencias"] += 1
                elif sev == "VACIO":
                    resumen_celdas[cell_key]["vacios"] += 1

        # Check de errores de fórmula transversal
        for col_k in PLT_CANONICAL_COLUMNS.keys():
            raw_v = get_val(col_k)
            if is_formula_error(raw_v):
                reg_err(col_k, raw_v, "ERR_PLT_FORMULA_ERROR", col_name=col_map.get(col_k, col_k), value=str(raw_v))

        # --- GRUPO 1: Información General ---
        # 1. Campaña
        if camp_raw is None or pd.isna(camp_raw) or str(camp_raw).strip() == "":
            reg_err("campania", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Campaña")
        else:
            camp_num = sanitize_number(camp_raw)
            if camp_num is None or not (2000 <= int(camp_num) <= 2035):
                reg_err("campania", camp_raw, "ERR_PLT_CAMPANA_INVALIDA", value=camp_raw)

        # 2. Fecha de ensayo
        fecha_val = get_val("fecha_ensayo")
        if fecha_val is None or pd.isna(fecha_val) or str(fecha_val).strip() == "":
            reg_err("fecha_ensayo", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Fecha de ensayo")
        elif fecha_dt is None:
            reg_err("fecha_ensayo", fecha_val, "ERR_PLT_FECHA_INVALIDA", value=fecha_val)
        elif fecha_dt > datetime.now():
            reg_err("fecha_ensayo", fecha_str, "ERR_PLT_FECHA_FUTURA", value=fecha_str)

        # 4. Tipo de ensayo
        tipo_ens = get_val("tipo_ensayo")
        if tipo_ens is None or pd.isna(tipo_ens) or str(tipo_ens).strip() == "":
            reg_err("tipo_ensayo", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Tipo de ensayo")
        elif _norm_str(tipo_ens) != "I":
            reg_err("tipo_ensayo", tipo_ens, "ERR_PLT_TIPO_ENSAYO_INVALIDO", value=tipo_ens)

        # --- GRUPO 2: Muestra y Litología ---
        # 5. Nivel
        nivel_raw = get_val("nivel")
        if nivel_raw is None or pd.isna(nivel_raw) or str(nivel_raw).strip() == "":
            reg_err("nivel", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Nivel")
        else:
            nivel_num = sanitize_number(nivel_raw)
            if nivel_num is None:
                reg_err("nivel", nivel_raw, "ERR_PLT_NIVEL_NO_NUMERICO", value=nivel_raw)
            elif nivel_num < 0:
                reg_err("nivel", nivel_num, "ERR_PLT_NIVEL_NEGATIVO", value=nivel_num)
            elif nivel_num > 4999:
                reg_err("nivel", nivel_num, "ERR_PLT_NIVEL_LIMITE_EXCEDIDO", value=nivel_num)

        # 6. Celda de mapeo
        if not celda_raw:
            reg_err("celda_mapeo", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Celda de mapeo")

        # 7. Muestra
        muestra_val = _norm_str(get_val("muestra"))
        if not muestra_val:
            reg_err("muestra", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Muestra")
        elif muestra_val not in ("A", "B", "C", "D"):
            reg_err("muestra", muestra_val, "ERR_PLT_MUESTRA_INVALIDA", value=muestra_val)

        # 8. Código de muestra
        cod_muestra = str(get_val("codigo_muestra") or "").strip()
        if not cod_muestra:
            reg_err("codigo_muestra", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Código de muestra")
        elif not are_sample_codes_compatible(cod_muestra, celda_raw, muestra_val):
            exp_code = normalize_sample_code(celda_raw, muestra_val)
            reg_err("codigo_muestra", cod_muestra, "ERR_PLT_CODIGO_MUESTRA_INCONGRUENTE",
                    actual=cod_muestra, celda=celda_raw, muestra=muestra_val, expected=exp_code)

        # 9. Litología 1, 2, 3
        lito1 = str(get_val("litologia_1") or "").strip()
        lito2 = str(get_val("litologia_2") or "").strip()
        lito3 = str(get_val("litologia_3") or "").strip()

        if not lito1:
            reg_err("litologia_1", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Litología 1")

        exp_grupo, exp_k = resolve_expected_lithology(lito1, lito2, lito3)

        if lito1 and (lito2 or lito3) and not exp_grupo:
            reg_err("litologia_1", f"{lito1}/{lito2}/{lito3}", "ERR_PLT_LITOLOGIA_COMBINACION_INVALIDA",
                    l1=lito1, l2=lito2, l3=lito3)

        # 12. Tipo litológico
        tipo_lito_raw = get_val("tipo_litologico")
        if tipo_lito_raw is None or pd.isna(tipo_lito_raw) or str(tipo_lito_raw).strip() == "":
            reg_err("tipo_litologico", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Tipo litológico")
        else:
            tipo_lito_norm = normalize_lithology_group(tipo_lito_raw)
            valid_grupos = {"INTRUSIVOS", "SEDIMENTARIOS", "METAMORFICAS", "BRECHAS", "ENDOSKARN"}
            if tipo_lito_norm not in valid_grupos:
                reg_err("tipo_litologico", tipo_lito_raw, "ERR_PLT_TIPO_LITOLOGICO_INVALIDO", value=tipo_lito_raw)
            elif exp_grupo and tipo_lito_norm != normalize_lithology_group(exp_grupo):
                reg_err("tipo_litologico", tipo_lito_raw, "ERR_PLT_TIPO_LITOLOGICO_INCONGRUENTE",
                        actual=tipo_lito_raw, expected=exp_grupo)

        # --- GRUPO 3: Coordenadas WGS84 ---
        este_num = sanitize_number(get_val("este"))
        norte_num = sanitize_number(get_val("norte"))
        elev_num = sanitize_number(get_val("elevacion"))

        if este_num is None:
            reg_err("este", get_val("este"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Este (m)")
        elif este_num <= 0:
            reg_err("este", este_num, "ERR_PLT_COORD_ESTE_RANGO", value=este_num)

        if norte_num is None:
            reg_err("norte", get_val("norte"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Norte (m)")
        elif norte_num <= 0:
            reg_err("norte", norte_num, "ERR_PLT_COORD_NORTE_RANGO", value=norte_num)

        if elev_num is None:
            reg_err("elevacion", get_val("elevacion"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Elevación (msnm)")
        elif elev_num <= 0:
            reg_err("elevacion", elev_num, "ERR_PLT_ELEVACION_RANGO", value=elev_num)

        # --- GRUPO 4: Geometría del Bloque ---
        espesor_d = sanitize_number(get_val("espesor_d"))
        longitud_l = sanitize_number(get_val("longitud_l"))
        ancho_w1 = sanitize_number(get_val("ancho_w1"))
        ancho_w2 = sanitize_number(get_val("ancho_w2"))
        ancho_w = sanitize_number(get_val("ancho_w"))

        if espesor_d is None:
            reg_err("espesor_d", get_val("espesor_d"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Espesor D (cm)")
        elif espesor_d <= 0:
            reg_err("espesor_d", espesor_d, "ERR_PLT_ESPESOR_D_RANGO", value=espesor_d)

        if longitud_l is None:
            reg_err("longitud_l", get_val("longitud_l"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Longitud L (cm)")
        elif longitud_l <= 0:
            reg_err("longitud_l", longitud_l, "ERR_PLT_LONGITUD_L_RANGO", value=longitud_l)

        if ancho_w1 is None:
            reg_err("ancho_w1", get_val("ancho_w1"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Ancho W1 (cm)")
        elif ancho_w1 <= 0:
            reg_err("ancho_w1", ancho_w1, "ERR_PLT_ANCHO_W1_RANGO", value=ancho_w1)

        if ancho_w2 is None:
            reg_err("ancho_w2", get_val("ancho_w2"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Ancho W2 (cm)")
        elif ancho_w2 <= 0:
            reg_err("ancho_w2", ancho_w2, "ERR_PLT_ANCHO_W2_RANGO", value=ancho_w2)

        # Validación de Ancho W = (W1 + W2)/2
        if ancho_w1 is not None and ancho_w2 is not None:
            expected_w = round((ancho_w1 + ancho_w2) / 2.0, 2)
            if ancho_w is None:
                reg_err("ancho_w", get_val("ancho_w"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Ancho W (cm)")
            elif abs(ancho_w - expected_w) > tolerance:
                reg_err("ancho_w", ancho_w, "ERR_PLT_ANCHO_W_INCONGRUENTE",
                        actual=ancho_w, w1=ancho_w1, w2=ancho_w2, expected=expected_w)

        # Validación Muestra Válida Longitud (L >= D)
        valida_l_raw = _norm_str(get_val("muestra_valida_long"))
        valida_l_norm = "SI" if "S" in valida_l_raw else ("NO" if "N" in valida_l_raw else valida_l_raw)
        if longitud_l is not None and espesor_d is not None:
            exp_valida_l = "SI" if longitud_l >= espesor_d else "NO"
            if not valida_l_norm:
                reg_err("muestra_valida_long", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Muestra válida - longitud")
            elif valida_l_norm != exp_valida_l:
                reg_err("muestra_valida_long", valida_l_raw, "ERR_PLT_MUESTRA_VALIDA_LONG_INCONGRUENTE",
                        actual=valida_l_raw, l_val=longitud_l, d_val=espesor_d, expected="SÍ" if exp_valida_l == "SI" else "NO")

        # Validación Muestra Válida Ancho (0.3W < D < W)
        valida_w_raw = _norm_str(get_val("muestra_valida_ancho"))
        valida_w_norm = "SI" if "S" in valida_w_raw else ("NO" if "N" in valida_w_raw else valida_w_raw)
        effective_w = ancho_w if ancho_w is not None else ((ancho_w1 + ancho_w2) / 2.0 if ancho_w1 and ancho_w2 else None)
        if espesor_d is not None and effective_w is not None and effective_w > 0:
            exp_valida_w = "SI" if (espesor_d > 0.3 * effective_w and espesor_d < effective_w) else "NO"
            if not valida_w_norm:
                reg_err("muestra_valida_ancho", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Muestra válida - ancho")
            elif valida_w_norm != exp_valida_w:
                reg_err("muestra_valida_ancho", valida_w_raw, "ERR_PLT_MUESTRA_VALIDA_ANCHO_INCONGRUENTE",
                        actual=valida_w_raw, d_val=espesor_d, w_val=round(effective_w, 2), expected="SÍ" if exp_valida_w == "SI" else "NO")

        # --- GRUPO 5: Datos del Ensayo ---
        fuerza_p = sanitize_number(get_val("fuerza_p"))
        dir_rot = _norm_str(get_val("direccion_rotura"))
        tipo_frac = _norm_str(get_val("tipo_fractura"))

        if fuerza_p is None:
            reg_err("fuerza_p", get_val("fuerza_p"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Fuerza P (kN)")
        elif fuerza_p <= 0:
            reg_err("fuerza_p", fuerza_p, "ERR_PLT_FUERZA_P_RANGO", value=fuerza_p)

        if not dir_rot:
            reg_err("direccion_rotura", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Dirección de rotura")
        elif dir_rot not in ("PA", "PE", "NA"):
            reg_err("direccion_rotura", get_val("direccion_rotura"), "ERR_PLT_DIRECCION_ROTURA_INVALIDA", value=get_val("direccion_rotura"))

        if not tipo_frac:
            reg_err("tipo_fractura", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Tipo de fractura")
        elif tipo_frac not in ("M", "E", "C"):
            reg_err("tipo_fractura", get_val("tipo_fractura"), "ERR_PLT_TIPO_FRACTURA_INVALIDO", value=get_val("tipo_fractura"))

        # --- GRUPO 6: Cálculo Is ---
        de_num = sanitize_number(get_val("diametro_equiv"))
        f_num = sanitize_number(get_val("f"))
        is_num = sanitize_number(get_val("is_mpa"))
        is50_num = sanitize_number(get_val("is50_mpa"))

        calc_de = None
        if espesor_d is not None and effective_w is not None and espesor_d > 0 and effective_w > 0:
            calc_de = round(math.sqrt(4.0 * espesor_d * effective_w / math.pi), 4)
            if de_num is None:
                reg_err("diametro_equiv", get_val("diametro_equiv"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Diametro equivalente (cm)")
            elif abs(de_num - calc_de) > tolerance:
                reg_err("diametro_equiv", de_num, "ERR_PLT_DIAMETRO_EQUIV_INCONGRUENTE",
                        actual=de_num, expected=calc_de)

        effective_de = de_num if de_num is not None else calc_de
        calc_f = None
        if effective_de is not None and effective_de > 0:
            calc_f = round(math.pow((effective_de * 10.0) / 50.0, 0.45), 4)
            if f_num is None:
                reg_err("f", get_val("f"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="F")
            elif abs(f_num - calc_f) > tolerance:
                reg_err("f", f_num, "ERR_PLT_FACTOR_F_INCONGRUENTE", actual=f_num, expected=calc_f)

        calc_is = None
        if fuerza_p is not None and effective_de is not None and effective_de > 0:
            calc_is = round((fuerza_p * 1000.0) / math.pow(effective_de * 10.0, 2), 4)
            if is_num is None:
                reg_err("is_mpa", get_val("is_mpa"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Is (MPa)")
            elif abs(is_num - calc_is) > tolerance:
                reg_err("is_mpa", is_num, "ERR_PLT_IS_INCONGRUENTE", actual=is_num, expected=calc_is)

        # Is(50): solo si muestra válida ancho == "SÍ", es Is * F; si es "NO", debe ser nulo
        effective_is = is_num if is_num is not None else calc_is
        effective_f = f_num if f_num is not None else calc_f
        if valida_w_norm == "SI" and effective_is is not None and effective_f is not None:
            calc_is50 = round(effective_is * effective_f, 4)
            if is50_num is None:
                reg_err("is50_mpa", get_val("is50_mpa"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Is(50) (MPa)")
            elif abs(is50_num - calc_is50) > tolerance:
                reg_err("is50_mpa", is50_num, "ERR_PLT_IS50_INCONGRUENTE", actual=is50_num, expected=calc_is50)
        elif valida_w_norm == "NO" and is50_num is not None:
            reg_err("is50_mpa", is50_num, "ERR_PLT_IS50_INCONGRUENTE", actual=is50_num, expected="NULL (Muestra Inválida)")

        # --- GRUPO 7: Resistencia de Roca (K, UCS, ISRM) ---
        factor_k_num = sanitize_number(get_val("factor_k"))
        ucs_num = sanitize_number(get_val("ucs_mpa"))
        isrm_raw = _norm_str(get_val("resistencia_isrm"))

        if factor_k_num is None:
            reg_err("factor_k", get_val("factor_k"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Factor de conversión K")
        else:
            if not (5.0 <= factor_k_num <= 30.0):
                reg_err("factor_k", factor_k_num, "ERR_PLT_FACTOR_K_RANGO", value=factor_k_num)
            elif exp_k is not None and abs(factor_k_num - exp_k) > tolerance:
                reg_err("factor_k", factor_k_num, "ERR_PLT_FACTOR_K_INCONGRUENTE", actual=factor_k_num, expected=exp_k)

        effective_k = factor_k_num if factor_k_num is not None else exp_k
        effective_is50 = is50_num if is50_num is not None else (calc_is50 if valida_w_norm == "SI" and 'calc_is50' in locals() else None)

        calc_ucs = None
        if effective_is50 is not None and effective_k is not None:
            calc_ucs = round(effective_is50 * effective_k, 3)
            if ucs_num is None:
                reg_err("ucs_mpa", get_val("ucs_mpa"), "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="RCS/UCS (MPa)")
            elif abs(ucs_num - calc_ucs) > tolerance:
                reg_err("ucs_mpa", ucs_num, "ERR_PLT_UCS_INCONGRUENTE", actual=ucs_num, expected=calc_ucs)

        effective_ucs = ucs_num if ucs_num is not None else calc_ucs
        if effective_ucs is not None:
            exp_isrm = get_expected_isrm(effective_ucs)
            if not isrm_raw:
                reg_err("resistencia_isrm", None, "ERR_PLT_CAMPO_OBLIGATORIO_VACIO", col_name="Resistencia ISRM")
            elif exp_isrm and isrm_raw != exp_isrm:
                reg_err("resistencia_isrm", isrm_raw, "ERR_PLT_RESISTENCIA_ISRM_INCONGRUENTE",
                        actual=isrm_raw, ucs_val=round(effective_ucs, 2), expected=exp_isrm)

    # Consolidación final del diagnóstico JSON
    total_alertas = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    total_advertencias = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
    total_vacios = sum(1 for i in incidencias if i.get("tipo_incidencia") == "VACIO")

    output_json = {
        "nombre_archivo": os.path.basename(file_path),
        "total_filas_procesadas": total_filas,
        "total_celdas_evaluadas": total_filas * PLT_MANDATORY_COLS_COUNT,
        "metricas_globales": {
            "total_registros": total_filas,
            "total_celdas": len(resumen_celdas),
            "total_alertas": total_alertas,
            "total_advertencias": total_advertencias,
            "total_vacios": total_vacios,
        },
        "incidencias": incidencias,
        "resumen_por_celda": resumen_celdas,
    }

    if output_json_path:
        os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
        tmp_path = output_json_path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(output_json, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, output_json_path)

    elapsed = time.time() - t_start
    print(f"[QAQC PLT] Validación finalizada en {elapsed:.2f}s | Alertas: {total_alertas} | Advertencias: {total_advertencias} | Vacíos: {total_vacios}")
    return output_json
