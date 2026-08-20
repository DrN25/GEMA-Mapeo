"""
agents/normalizer.py — Post-procesamiento del JSON crudo del LLM.

Convierte la salida del modelo (que puede venir sucia: strings con unidades,
códigos raros, decimales de más, valores inventados) al contrato estándar
`excel_data` + `estructuras` que consume el pipeline de importación existente
(importador de Excel -> excelDataToWindowData en el frontend).

Semántica de campos "missing":
  - Se marcan los campos esperados de la cabecera que quedaron null/vacíos.
  - Los campos con DEFAULTS del sistema (sector=PENDIENTE, mapeador=SRK,
    tipo_estructura=JN, campania derivada de la fecha) NO se marcan rojos:
    tienen un valor válido por convención, igual que el importador de Excel.

Helpers de limpieza: misma semántica que clean_num/clean_str del importador
(importador.py) para que el resultado sea indistinguible del de un Excel.
"""

import math
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Sanitización (espejo de importador.py clean_num/clean_str)
# ---------------------------------------------------------------------------


def _clean_num(val: Any) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, str):
        s = val.strip().replace(",", ".")
        if not s:
            return None
        # Soporte para rangos manuscritos (ej. "3-8" -> 5.5, "1-5" -> 3.0)
        if "-" in s:
            parts = s.split("-")
            if len(parts) == 2:
                try:
                    a, b = float(parts[0].strip()), float(parts[1].strip())
                    return (a + b) / 2.0
                except (ValueError, TypeError):
                    pass
        val = s
    try:
        f = float(val)
        if f in (-1.0, -1):
            return None
        return f
    except (ValueError, TypeError):
        return None


def _clean_int(val: Any) -> Optional[int]:
    f = _clean_num(val)
    if f is None:
        return None
    return int(round(f))  # redondea si viene de rango o float


def _clean_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    if s in ("", "-1", "-1.0", "None", "nan", "NaN", "null", "NULL", "N/A", "NA"):
        return None
    return s


def _round(val: Optional[float], decimals: int) -> Optional[float]:
    if val is None:
        return None
    return round(val, decimals)


def _clamp(val: Optional[float], lo: float, hi: float) -> Optional[float]:
    if val is None:
        return None
    if val < lo or val > hi:
        return None  # fuera de rango físico = lectura dudosa -> missing
    return val


# ---------------------------------------------------------------------------
# Campos esperados (para missing_fields)
# ---------------------------------------------------------------------------

EXPECTED_HEADER_FIELDS: List[str] = [
    "sector", "este_ini", "norte_ini", "cota_ini", "este_fin", "norte_fin",
    "cota_fin", "largo_m", "altura_m", "dip", "azimut_hole", "dip_talud",
    "dipdir_talud", "intemperismo", "alteracion", "fase", "nivel",
    "lito_1", "lito_2", "lito_3", "unidad_litologica", "mapeador",
    "fecha", "comentarios", "gsi_superficie", "gsi_estructura",
    "condicion_agua_rmr76", "dureza_rmr76", "control_estructural_rmr76",
    "efectos_voladura_rmr76", "ucs_mpa", "is50_mpa", "rmr_76", "rmr_89",
]

# Campos con default del sistema (vacío para no forzar fallbacks).
DEFAULTED_HEADER_FIELDS: Dict[str, Any] = {}

EXPECTED_JOINT_FIELDS: List[str] = [
    "tipo_estructura", "dip", "dip_dir", "distancia_m", "abertura_mm",
    "espesor_mm", "continuidad_m", "espaciamiento_m", "n_estructuras",
    "n_extremos_visibles", "terminacion", "relleno_1_codigo", "relleno_2_codigo",
    "jrc", "rugosidad_codigo", "forma_estructura", "alteracion_codigo",
]

# Códigos de catálogo válidos (core/catalogs.py). Los sinónimos comunes que
# escribe el LLM se normalizan aquí.
TIPO_ESTRUCTURA_VALID = {"JN", "BED", "F", "SZ", "CON", "DQ"}
ALTERACION_VALID = {"f", "d", "m", "a", "c", "s"}
RELLENO_VALID = {"c", "cwf", "si", "sf", "ep", "ox", "qz", "g", "cl", "ca", "ys", "ch", "sa"}
FORMA_VALID = {"P", "C", "O", "E", "I"}
AGUA_VALID = {"C", "H", "M", "E", "F"}
DUREZA_VALID = {"R0", "R1", "R2", "R3", "R4", "R5", "R6"}


def _norm_code(val: Any, valid: set, default: Optional[str] = None) -> Optional[str]:
    s = _clean_str(val)
    if s is None:
        return default
    up = s.upper()
    low = s.lower()

    if up in valid:
        return up
    if low in valid:
        return low

    # Sinónimos de tipo_estructura
    if up in ("J", "JS", "J1", "J2", "J3", "J4", "J5", "JUNTA", "DIACLASA"):
        return "JN" if "JN" in valid else default
    if up in ("E", "E1", "E2", "ESTRAT", "ESTRATIFICACION", "ESTRATIFICACIÓN"):
        return "BED" if "BED" in valid else default
    if up in ("F", "F1", "F2", "F3", "FALLA"):
        return "F" if "F" in valid else default
    if up in ("SZ", "CIZALLA", "ZONA CIZALLA"):
        return "SZ" if "SZ" in valid else default
    if up in ("CON", "CONTACTO"):
        return "CON" if "CON" in valid else default
    if up in ("DQ", "DIQUE"):
        return "DQ" if "DQ" in valid else default
    if up in ("SKARN",):
        return "GSK" if "GSK" in valid else default

    # Sinónimos de forma_estructura (P, C, O, E, I)
    if up in ("I", "IRREGULAR", "IRR"):
        return "I" if "I" in valid else default
    if up in ("P", "PLANA", "PLAN"):
        return "P" if "P" in valid else default
    if up in ("O", "ONDULADA", "OND"):
        return "O" if "O" in valid else default
    if up in ("C", "CURVA", "CURV"):
        return "C" if "C" in valid else default
    if up in ("E", "ESCALONADA", "ESC"):
        return "E" if "E" in valid else default

    # Sinónimos de alteración (f, d, m, a, c, s)
    if low in ("f", "fresca", "fresh"):
        return "f" if "f" in valid else default
    if low in ("d", "débil", "debil", "w", "weak"):
        return "d" if "d" in valid else default
    if low in ("m", "moderada", "mod"):
        return "m" if "m" in valid else default
    if low in ("a", "alta", "high"):
        return "a" if "a" in valid else default
    if low in ("c", "completa", "comp"):
        return "c" if "c" in valid else default
    if low in ("s", "suelo", "soil"):
        return "s" if "s" in valid else default

    # Sinónimos de relleno
    if up in ("CQ", "CA", "CALCITA"):
        return "ca" if "ca" in valid else default
    if up in ("OX", "OXIDOS", "ÓXIDOS"):
        return "ox" if "ox" in valid else default
    if up in ("CL", "CLORITA"):
        return "cl" if "cl" in valid else default
    if up in ("QZ", "CUARZO"):
        return "qz" if "qz" in valid else default
    if up in ("G", "PANIZO", "GOUGE", "ARCILLA"):
        return "g" if "g" in valid else default
    if up in ("PA",):
        return "d" if "d" in valid else default

    # Búsqueda case-insensitive final en el set de válidos
    for v in valid:
        if v.upper() == up:
            return v

    return default


# ---------------------------------------------------------------------------
# Normalización de cabecera (excel_data)
# ---------------------------------------------------------------------------


def _normalize_header(raw: Dict[str, Any]) -> Dict[str, Any]:
    d = raw if isinstance(raw, dict) else {}
    # El LLM devuelve {codigo, excel_data: {...}, estructuras: [...]} según el
    # esquema del prompt; tolerar también celdas planas {este_ini: ..., ...}.
    if isinstance(d.get("excel_data"), dict):
        d = {**d, **d["excel_data"]}

    # Fecha y campaña derivada del año (misma lógica que normalize_station_to_celda)
    fecha_raw = _clean_str(d.get("fecha"))
    fecha_str = None
    if fecha_raw:
        m = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", fecha_raw)
        if m:
            y, mo, da = m.groups()
            fecha_str = f"{y}-{int(mo):02d}-{int(da):02d}"
        elif len(fecha_raw) >= 10:
            fecha_str = fecha_raw[:10]
    campania_val = f"Campaña {fecha_str[:4]}" if fecha_str and fecha_str[:4].isdigit() else "Campaña 2026"

    # Código de celda (tolerar alias comunes como estacion, nombre, code)
    codigo_raw = (
        _clean_str(d.get("codigo"))
        or _clean_str(d.get("estacion"))
        or _clean_str(d.get("nombre"))
        or _clean_str(d.get("code"))
        or _clean_str(d.get("codigo_celda"))
    )

    este_ini = _clamp(_round(_clean_num(d.get("este_ini")), 3), -1e12, 1e12)
    norte_ini = _clamp(_round(_clean_num(d.get("norte_ini")), 3), -1e12, 1e12)
    cota_ini = _clamp(_round(_clean_num(d.get("cota_ini")), 3), -1e12, 1e12)
    este_fin = _clamp(_round(_clean_num(d.get("este_fin")), 3), -1e12, 1e12)
    norte_fin = _clamp(_round(_clean_num(d.get("norte_fin")), 3), -1e12, 1e12)
    cota_fin = _clamp(_round(_clean_num(d.get("cota_fin")), 3), -1e12, 1e12)

    rqd_val = _clean_num(d.get("rqd") or d.get("rqd_pct") or d.get("rmr_76"))

    return {
        "codigo": codigo_raw,
        "campania": campania_val,
        "sector": _clean_str(d.get("sector")),
        "este_ini": este_ini if este_ini is not None else 0.0,
        "norte_ini": norte_ini if norte_ini is not None else 0.0,
        "cota_ini": cota_ini if cota_ini is not None else 0.0,
        "este_fin": este_fin if este_fin is not None else 0.0,
        "norte_fin": norte_fin if norte_fin is not None else 0.0,
        "cota_fin": cota_fin if cota_fin is not None else 0.0,
        "largo_m": _clamp(_round(_clean_num(d.get("largo_m")), 3), 0.001, 1e6),
        "altura_m": _clamp(_round(_clean_num(d.get("altura_m")), 3), 0.001, 1e6),
        "dip": _clamp(_round(_clean_num(d.get("dip")), 2), 0.0, 90.0),
        "azimut_hole": _clamp(_round(_clean_num(d.get("azimut_hole")), 2), 0.0, 360.0),
        "dip_talud": _clamp(_round(_clean_num(d.get("dip_talud")), 2), -90.0, 90.0),
        "dipdir_talud": _clamp(_round(_clean_num(d.get("dipdir_talud")), 2), 0.0, 360.0),
        "intemperismo": _norm_code(d.get("intemperismo"), ALTERACION_VALID),
        "alteracion": _norm_code(d.get("alteracion"), ALTERACION_VALID),
        "fase": _clean_int(d.get("fase")),
        "nivel": _clean_str(d.get("nivel")),
        "lito_1": _clean_str(d.get("lito_1")),
        "lito_2": _clean_str(d.get("lito_2")),
        "lito_3": _clean_str(d.get("lito_3")),
        "unidad_litologica": _clean_str(d.get("unidad_litologica")),
        "mapeador": _clean_str(d.get("mapeador")),
        "fecha": fecha_str or datetime.now().strftime("%Y-%m-%d"),
        "comentarios": _clean_str(d.get("comentarios")),
        "gsi_superficie": _clean_str(d.get("gsi_superficie")),
        "gsi_estructura": _clean_str(d.get("gsi_estructura")),
        # RMR (null: lo calcula el backend al guardar)
        "condicion_agua_rmr76": _norm_code(d.get("condicion_agua_rmr76"), AGUA_VALID),
        "dureza_rmr76": _norm_code(d.get("dureza_rmr76"), DUREZA_VALID),
        "condicion_agua_rmr89": _norm_code(d.get("condicion_agua_rmr89"), AGUA_VALID),
        "dureza_rmr89": _norm_code(d.get("dureza_rmr89"), DUREZA_VALID),
        "control_estructural_rmr76": _clean_int(d.get("control_estructural_rmr76")),
        "control_estructural_rmr89": _clean_int(d.get("control_estructural_rmr89")),
        "efectos_voladura_rmr76": _clean_int(d.get("efectos_voladura_rmr76")),
        "efectos_voladura_rmr89": _clean_int(d.get("efectos_voladura_rmr89")),
        "ucs_mpa": _round(_clean_num(d.get("ucs_mpa")), 3),
        "is50_mpa": _round(_clean_num(d.get("is50_mpa")), 3),
        "rmr_76": rqd_val,
        "rmr_89": _clean_num(d.get("rmr_89")),
    }


# ---------------------------------------------------------------------------
# Normalización de estructuras (discontinuidades)
# ---------------------------------------------------------------------------


def _normalize_joint(raw: Any, idx: int) -> Dict[str, Any]:
    d = raw if isinstance(raw, dict) else {}

    jrc_val = _clamp(_round(_clean_num(d.get("jrc")), 2), 0.0, 20.0)
    rug_raw = d.get("rugosidad_codigo") or d.get("rugosidad")
    rug_val = None

    # Caso especial: Formato compuesto tipo "11-5" (JRC = 11, Rugosidad = 5)
    if isinstance(rug_raw, str) and "-" in rug_raw:
        parts = rug_raw.split("-")
        if len(parts) == 2:
            p1 = _clean_num(parts[0].strip())
            p2 = _clean_int(parts[1].strip())
            if p1 is not None and jrc_val is None:
                jrc_val = _clamp(_round(p1, 2), 0.0, 20.0)
            if p2 is not None and 1 <= p2 <= 9:
                rug_val = str(p2)
    else:
        rug_num = _clean_int(rug_raw)
        if rug_num is not None and 1 <= rug_num <= 9:
            rug_val = str(rug_num)

    dipdir = d.get("dip_dir") if d.get("dip_dir") is not None else d.get("dipdir")

    # Identificación de ID y deducción de tipo / familia
    fam_val = _clean_int(d.get("familia_id") or d.get("familia"))
    id_str = _clean_str(d.get("id") or d.get("ID") or d.get("familia") or d.get("tipo_estructura"))
    if id_str:
        m = re.search(r"^[jJfFeE](\d+)", id_str)
        if m:
            fam_val = int(m.group(1))
    if not fam_val or fam_val <= 0:
        fam_val = math.ceil((idx + 1) / 3.0)

    # Tipo de estructura (E/E1 -> BED, J/J1 -> JN, F/F1 -> F, SZ -> SZ)
    tipo_raw = d.get("tipo_estructura") or d.get("tipo")
    tipo = _norm_code(tipo_raw, TIPO_ESTRUCTURA_VALID, default=None)
    if not tipo and id_str:
        id_up = id_str.upper()
        if id_up.startswith("E"):
            tipo = "BED"
        elif id_up.startswith("F"):
            tipo = "F"
        elif id_up.startswith("SZ"):
            tipo = "SZ"
        elif id_up.startswith("J"):
            tipo = "JN"
    tipo = tipo or "JN"

    return {
        "numero_estructura": idx + 1,
        "familia_id": fam_val,
        "tipo_estructura": tipo,
        "dip": _clamp(_round(_clean_num(d.get("dip")), 2), 0.0, 90.0) or 0.0,
        "dip_dir": _clamp(_round(_clean_num(dipdir), 2), 0.0, 360.0) or 0.0,
        "distancia_m": _round(_clean_num(d.get("distancia_m") or d.get("distancia")), 3),
        "abertura_mm": _round(_clean_num(d.get("abertura_mm") or d.get("abertura")), 3),
        "espesor_mm": _round(_clean_num(d.get("espesor_mm") or d.get("espesor")), 3),
        "continuidad_m": _round(_clean_num(d.get("continuidad_m") or d.get("continuidad")), 3),
        "espaciamiento_m": _round(_clean_num(d.get("espaciamiento_m") or d.get("espaciamiento")), 3),
        "n_estructuras": _clean_int(d.get("n_estructuras") or d.get("n_est")),
        "n_extremos_visibles": _clean_int(d.get("n_extremos_visibles")),
        "terminacion": _clean_int(d.get("terminacion")),
        "relleno_1_codigo": _norm_code(d.get("relleno_1_codigo") or d.get("relleno_1"), RELLENO_VALID),
        "relleno_2_codigo": _norm_code(d.get("relleno_2_codigo") or d.get("relleno_2"), RELLENO_VALID),
        "jrc": jrc_val,
        "rugosidad_codigo": rug_val,
        "forma_estructura": _norm_code(d.get("forma_estructura") or d.get("forma"), FORMA_VALID),
        "alteracion_codigo": _norm_code(d.get("alteracion_codigo") or d.get("alteracion"), ALTERACION_VALID),
    }


# ---------------------------------------------------------------------------
# Detección de campos faltantes
# ---------------------------------------------------------------------------


def _is_missing(val: Any) -> bool:
    if val is None:
        return True
    if isinstance(val, str):
        return val.strip() in ("", "-1", "-1.0", "None", "null")
    return False


def _detect_missing_header(excel_data: Dict[str, Any]) -> List[str]:
    missing = []
    for key in EXPECTED_HEADER_FIELDS:
        if key in DEFAULTED_HEADER_FIELDS:
            continue
        if _is_missing(excel_data.get(key)):
            missing.append(key)
    return missing


def _detect_missing_joints(estructuras: List[Dict[str, Any]]) -> List[List[str]]:
    """Lista paralela a `estructuras`: qué campos faltan en cada fila."""
    result = []
    for e in estructuras:
        missing = [key for key in EXPECTED_JOINT_FIELDS if _is_missing(e.get(key))]
        result.append(missing)
    return result


# ---------------------------------------------------------------------------
# API pública
# ---------------------------------------------------------------------------


def normalize_raw_cell(raw_cell: Dict[str, Any], default_index: int = 1) -> Dict[str, Any]:
    """Normaliza UNA celda cruda del LLM -> contrato del sistema.

    Devuelve:
      {codigo, excel_data, estructuras, missing_header, missing_joints, confidence}
    """
    raw = raw_cell if isinstance(raw_cell, dict) else {}
    excel_data = _normalize_header(raw)

    # Si la celda no tiene código, asignar SIN_NOMBRE_{default_index}
    codigo = excel_data.get("codigo")
    if not codigo:
        codigo = f"SIN_NOMBRE_{default_index}"
        excel_data["codigo"] = codigo

    raw_joints = (
        raw.get("estructuras")
        or raw.get("discontinuidades")
        or raw.get("joints")
        or raw.get("structures")
    ) if isinstance(raw, dict) else None
    estructuras = [_normalize_joint(j, i) for i, j in enumerate(raw_joints or [])]

    missing_header = _detect_missing_header(excel_data)
    missing_joints = _detect_missing_joints(estructuras)

    # Confidence: fracción de campos esperados con valor
    expected_total = len(EXPECTED_HEADER_FIELDS) - len(DEFAULTED_HEADER_FIELDS)
    filled_header = expected_total - len(missing_header)
    filled_joints = sum(len(e) - len(m) for e, m in zip(estructuras, missing_joints))
    joint_total = sum(len(e) for e in estructuras)
    confidence = round((filled_header + filled_joints) / max(1, expected_total + joint_total), 3)

    return {
        "codigo": codigo,
        "excel_data": excel_data,
        "estructuras": estructuras,
        "missing_header": missing_header,
        "missing_joints": missing_joints,
        "confidence": confidence,
    }


def extract_cells_from_raw_response(raw_response: Any) -> List[Dict[str, Any]]:
    """Extrae y normaliza las celdas de la respuesta cruda del LLM.

    Soporta el contrato actual (tipo_resultado: datos|no_mapping_form),
    respuestas legacy sin tipo_resultado (solo con "celdas"), listas
    directas, sinónimos de celdas y estructuras planas.
    """
    if isinstance(raw_response, list):
        return [normalize_raw_cell(c, i + 1) for i, c in enumerate(raw_response) if isinstance(c, dict)]
    if not isinstance(raw_response, dict):
        return []

    celdas_raw = raw_response.get("celdas")
    if not isinstance(celdas_raw, list):
        for alias in ("estaciones", "stations", "cells", "datos", "items", "station_list", "resultados"):
            if isinstance(raw_response.get(alias), list):
                celdas_raw = raw_response[alias]
                break

    if not isinstance(celdas_raw, list):
        if any(k in raw_response for k in ("estructuras", "discontinuidades", "joints", "structures", "excel_data", "sector", "dip", "largo_m", "azimut_hole", "codigo")):
            celdas_raw = [raw_response]

    if not isinstance(celdas_raw, list) or not celdas_raw:
        return []
    return [normalize_raw_cell(c, i + 1) for i, c in enumerate(celdas_raw) if isinstance(c, dict)]


def classify_raw_response(raw_response: Any) -> Dict[str, Any]:
    """Clasifica la respuesta cruda del LLM para el servicio/UI.

    Devuelve:
      {tipo: "datos" | "no_mapping_form" | "error", mensaje: str|None}
    - "datos": hay celdas para procesar.
    - "no_mapping_form": el modelo marcó explícitamente que la imagen NO es
      un formulario de mapeo (foto equivocada). El frontend debe avisar.
    - "error": respuesta inválida o sin celdas sin marca explícita.
    """
    if isinstance(raw_response, list) and raw_response:
        return {"tipo": "datos", "mensaje": None}
    if not isinstance(raw_response, dict):
        return {"tipo": "error", "mensaje": "El modelo no devolvió un JSON válido."}

    tipo = raw_response.get("tipo_resultado")
    mensaje = raw_response.get("mensaje") if isinstance(raw_response.get("mensaje"), str) else None
    if tipo == "no_mapping_form":
        return {
            "tipo": "no_mapping_form",
            "mensaje": mensaje or "La imagen no parece un formulario de mapeo geomecánico. ¿Seleccionaste la foto correcta?",
        }

    celdas = raw_response.get("celdas")
    if not isinstance(celdas, list):
        for alias in ("estaciones", "stations", "cells", "datos", "items", "station_list", "resultados"):
            if isinstance(raw_response.get(alias), list):
                celdas = raw_response[alias]
                break
    if not isinstance(celdas, list):
        if any(k in raw_response for k in ("estructuras", "discontinuidades", "joints", "structures", "excel_data", "sector", "dip", "largo_m", "azimut_hole", "codigo")):
            celdas = [raw_response]

    if isinstance(celdas, list) and celdas:
        return {"tipo": "datos", "mensaje": mensaje}
    if isinstance(celdas, list):
        return {
            "tipo": "no_mapping_form",
            "mensaje": mensaje or "La imagen no contiene datos de mapeo legibles.",
        }
    return {"tipo": "error", "mensaje": "El modelo no devolvió datos estructurados."}
