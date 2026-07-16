import os
import sys
import json
import math
import time
from datetime import datetime
from collections import defaultdict
import pandas as pd
import numpy as np

from app.core.catalogs import (
    NORM_GROUP_MAP, MANDATORY_COLS_COUNT,
    CONDICION_AGUA_CATALOG, RESISTENCIA_RATING_CATALOG, CONTROL_ESTRUCTURAL_CATALOG,
    EFECTOS_VOLADURA_CATALOG, RQD_RATINGS_CATALOG, ESPACIAMIENTO_R89_CATALOG,
    ESPACIAMIENTO_R76_CATALOG, TIPO_ESTRUCTURA_CATALOG, TIPO_RELLENO_CATALOG,
    RUGOSIDAD_CATALOG, FORMA_ESTRUCTURA_CATALOG, ALTERACION_CATALOG,
    LITHOLOGY_CLASSIFICATION, RESISTENCIA_DISPLAY_CATALOG, RQD_DISPLAY_CATALOG
)
from app.core.rules import RULES_REGISTRY, CATEGORIES_REGISTRY
from app.utils.interpolation import rating_promedio_rqd, rating_promedio_r1

# --- Constantes pre-computadas a nivel de módulo para máximo rendimiento ---
_MAPEO_ESTRUCTURAL_COLS = {
    "Dist.Celda", "Altura", "DIP", "AZ_HOLE", "DIP_TALUD", "DIP DIR_TALUD", "INTEMPERISMO",
    "CONDICION DE AGUA  '76.", "CONDICION DE AGUA VALOR  '76", "DUREZA  '76",
    "RESISTENCIA ESTIMADA VALOR  '76", "GSI VISUAL  '76", "CONTROL ESTRUCTURAL  '76",
    "EFECTOS DE VOLADURA  '76", "RQD - VALOR  '76", "RQD  '76",
    "FRECUENCIA DE FRACTURAMIENTO x m.  '76", "TAMAÑO DE BLOQUES  x m3  '76",
    "ESPACIAMIENTO PROMEDIO   '76", "ESPACIAMIENTO - VALOR    '76",
    "CONDICIÓN DE DISCONTINUIDAD - VALOR     '76", "RMR '76", "( UCS )  (Mpa)", "is50 (Mpa)",
    "CONDICION DE AGUA  '89", "CONDICION DE AGUA VALOR '89", "DUREZA '89",
    "RESISTENCIA ESTIMADA VALOR '89", "GSI VISUAL '89", "CONTROL ESTRUCTURAL '89",
    "EFECTOS DE VOLADURA '89", "RQD - VALOR '89", "RQD '89",
    "FRECUENCIA DE FRACTURAMIENTO x m. '89", "TAMAÑO DE BLOQUES  x m3 '89",
    "ESPACIAMIENTO PROMEDIO '89", "ESPACIAMIENTO - VALOR '89",
    "CONDICIÓN DE DISCONTINUIDAD - VALOR '89", "RMR '89", "FECHA", "COMENTARIO GEOTECNICO",
    "Nivel", "Lito 1", "Lito 2", "Lito 3", "Unidad Litologica"
}

def _norm_col(c: str) -> str:
    return "".join(c.upper().split()).replace(".", "").replace("'", "").replace('"', "").replace("(", "").replace(")", "").replace("-", "").replace("_", "")

_MAPEO_ESTRUCTURAL_NORM = frozenset(_norm_col(x) for x in _MAPEO_ESTRUCTURAL_COLS)

def clean_and_rename_columns(df):
    cols = []
    cota_seen, celda_seen = 0, 0
    dip_seen = 0
    for col in df.columns:
        col_str = str(col).strip()
        if '.' in col_str:
            parts = col_str.split('.')
            base_name = ".".join(parts[:-1]).strip()
            if parts[-1].isdigit():
                if base_name == 'DIP':
                    cols.append('DIP_ESTRUC')
                    continue
                elif base_name in ['CELDA', 'COTA']:
                    col_str = base_name
        if col_str == 'COTA':
            if cota_seen == 0:
                cols.append('COTA_FROM')
                cota_seen += 1
            else:
                cols.append('COTA_TO')
        elif col_str == 'CELDA':
            if celda_seen == 0:
                cols.append('CELDA_PADRE')
                celda_seen += 1
            else:
                cols.append('CELDA_DUPLICADA_IGNORE')
        elif col_str == 'DIP':
            if dip_seen == 0:
                cols.append('DIP')
                dip_seen += 1
            else:
                cols.append('DIP_ESTRUC')
        else:
            cols.append(col_str)
    df.columns = cols
    return df

def get_row_val(row_dict, key):
    if key in row_dict:
        return row_dict[key]
    
    def clean_k(s):
        return "".join(str(s).split()).replace(".", "").replace("(", "").replace(")", "").replace("_", "").replace("-", "").upper()
    
    target_norm = clean_k(key)
    for k, v in row_dict.items():
        if clean_k(k) == target_norm:
            return v
    return None

def sanitize_value(val, target_type, allow_negative=False):
    if val is None or pd.isna(val):
        return None
    
    val_str = str(val).strip()
    val_upper = val_str.upper()
    
    empty_markers = ['N/A', 'NONE', 'NAN', 'NULL']
    if not allow_negative:
        empty_markers.extend(['-1', '-1.0'])
        
    if val_str == '' or val_upper in empty_markers:
        return None
        
    if target_type == str:
        if val_str.endswith('.0'):
            val_str = val_str[:-2]
        return val_str.strip()
        
    try:
        if target_type == int:
            return int(float(val))
        return target_type(val)
    except (ValueError, TypeError):
        return None

def is_within_tolerance(val, targets, tolerance):
    if val is None: return False
    return any(abs(val - t) <= tolerance for t in targets)

def match_lito_column(catalog_val, input_val) -> bool:
    c_val = str(catalog_val or '').strip().upper()
    i_val = str(input_val or '').strip().upper()
    
    if c_val == '-' or c_val == '':
        return True
        
    options = [opt.strip() for opt in c_val.split('/')]
    for opt in options:
        if opt == 'VARIOS' or opt == 'CUALQUIERA':
            return i_val not in ['', '-', 'N/A', 'NONE']
            
        if opt == 'INTRUSIVO' and i_val in ["MZB", "MBF1", "MBF2", "MZM", "MZH", "MZD", "MZQ", "AN"]:
            return True
            
        if opt == i_val:
            return True
            
    return False

def normalize_geological_group(group_str):
    if not group_str:
        return ""
    
    val = str(group_str).strip().upper()
    val = val.replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O").replace("Ú", "U")
    
    if "SEDIMENT" in val:
        return "SEDIMENTARIOS"
    if "METAMORF" in val:
        return "METAMORFICAS"
    if "INTRUSIV" in val:
        return "INTRUSIVOS"
    if "BRECHA" in val:
        return "BRECHAS"
    if "SKARN" in val or "ESDONS" in val or "ENDOS" in val:
        return "ENDOSKARN"
        
    return NORM_GROUP_MAP.get(val, val)

def validate_geotechnical_header(row_dict, registrar_error):
    dip_talud = sanitize_value(get_row_val(row_dict, 'DIP_TALUD'), float, allow_negative=True)
    if dip_talud is not None:
        dip_talud = round(dip_talud, 2)
        if not (-90.0 <= dip_talud <= 90.0):
            registrar_error("DIP_TALUD", dip_talud, "ERR_DIP_TALUD_RANGO", value=dip_talud)

def validate_geomechanical_properties(row_dict, registrar_error):
    # 1. Validación de Condición de Agua (Códigos)
    agua_76 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA  '76."), str)
    if agua_76 is not None:
        agua_76_clean = agua_76.upper()
        if agua_76_clean not in CONDICION_AGUA_CATALOG:
            registrar_error("CONDICION DE AGUA  '76.", agua_76, "ERR_AGUA_76_CODIGO_INVALIDO", value=agua_76, allowed_codes=list(CONDICION_AGUA_CATALOG.keys()))

    agua_89 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA  '89"), str)
    if agua_89 is not None:
        agua_89_clean = agua_89.upper()
        if agua_89_clean not in CONDICION_AGUA_CATALOG:
            registrar_error("CONDICION DE AGUA  '89", agua_89, "ERR_AGUA_89_CODIGO_INVALIDO", value=agua_89, allowed_codes=list(CONDICION_AGUA_CATALOG.keys()))

    # 2. Rating y Coherencia de Condición de Agua
    agua_val_76 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA VALOR  '76"), int)
    if agua_val_76 is not None:
        if not (0 <= agua_val_76 <= 10):
            registrar_error("CONDICION DE AGUA VALOR  '76", agua_val_76, "ERR_AGUA_76_LIMITE_EXCEDIDO", value=agua_val_76)
        elif agua_76 is not None and agua_76.upper() in CONDICION_AGUA_CATALOG:
            expected = CONDICION_AGUA_CATALOG[agua_76.upper()]["r76"]
            if agua_val_76 != expected:
                registrar_error("CONDICION DE AGUA VALOR  '76", agua_val_76, "ERR_AGUA_76_INCONGRUENTE", value=agua_val_76, code_val=agua_76, expected=expected)
        elif agua_val_76 not in [10, 7, 4, 0]:
            registrar_error("CONDICION DE AGUA VALOR  '76", agua_val_76, "WRN_AGUA_76_VALOR_MEDIO", value=agua_val_76)

    agua_val_89 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA VALOR '89"), int)
    if agua_val_89 is not None:
        if not (0 <= agua_val_89 <= 15):
            registrar_error("CONDICION DE AGUA VALOR '89", agua_val_89, "ERR_AGUA_89_LIMITE_EXCEDIDO", value=agua_val_89)
        elif agua_89 is not None and agua_89.upper() in CONDICION_AGUA_CATALOG:
            expected = CONDICION_AGUA_CATALOG[agua_89.upper()]["r89"]
            if agua_val_89 != expected:
                registrar_error("CONDICION DE AGUA VALOR '89", agua_val_89, "ERR_AGUA_89_INCONGRUENTE", value=agua_val_89, code_val=agua_89, expected=expected)
        elif agua_val_89 not in [15, 10, 7, 4, 0]:
            registrar_error("CONDICION DE AGUA VALOR '89", agua_val_89, "WRN_AGUA_89_VALOR_MEDIO", value=agua_val_89)

    # 3. Dureza y Ratings de Resistencia ISRM
    dureza_76 = sanitize_value(get_row_val(row_dict, "DUREZA  '76"), str)
    if dureza_76 is not None:
        dureza_76_clean = dureza_76.upper()
        if dureza_76_clean not in RESISTENCIA_RATING_CATALOG:
            registrar_error("DUREZA  '76", dureza_76, "ERR_DUREZA_76_INVALIDA", value=dureza_76)

    dureza_val_76 = sanitize_value(get_row_val(row_dict, "RESISTENCIA ESTIMADA VALOR  '76"), float)
    if dureza_val_76 is not None:
        dureza_val_76 = round(dureza_val_76, 2)
        if not (0 <= dureza_val_76 <= 15):
            registrar_error("RESISTENCIA ESTIMADA VALOR  '76", dureza_val_76, "ERR_RESISTENCIA_76_LIMITE_EXCEDIDO", value=dureza_val_76)
        elif dureza_76 is not None and dureza_76.upper() in RESISTENCIA_RATING_CATALOG:
            expected = RESISTENCIA_RATING_CATALOG[dureza_76.upper()]["r76"]
            if abs(dureza_val_76 - expected) > 0.2:
                registrar_error("RESISTENCIA ESTIMADA VALOR  '76", dureza_val_76, "ERR_RESISTENCIA_76_INCONGRUENTE", value=dureza_val_76, dureza_val=dureza_76, expected=expected)
        elif not is_within_tolerance(dureza_val_76, [0, 1, 2, 4, 7, 12, 15], 0.2):
            registrar_error("RESISTENCIA ESTIMADA VALOR  '76", dureza_val_76, "WRN_RESISTENCIA_76_VALOR_ALEJADO", value=dureza_val_76)

    dureza_89 = sanitize_value(get_row_val(row_dict, "DUREZA '89"), str)
    if dureza_89 is not None:
        dureza_89_clean = dureza_89.upper()
        if dureza_89_clean not in RESISTENCIA_RATING_CATALOG:
            registrar_error("DUREZA '89", dureza_89, "ERR_DUREZA_89_INVALIDA", value=dureza_89)

    dureza_val_89 = sanitize_value(get_row_val(row_dict, "RESISTENCIA ESTIMADA VALOR '89"), float)
    if dureza_val_89 is not None:
        dureza_val_89 = round(dureza_val_89, 2)
        if not (0 <= dureza_val_89 <= 15):
            registrar_error("RESISTENCIA ESTIMADA VALOR '89", dureza_val_89, "ERR_RESISTENCIA_89_LIMITE_EXCEDIDO", value=dureza_val_89)
        elif dureza_89 is not None:
            r89_ranges = {
                item["codigo"]: (item["r89_min"], item["r89_max"], f"{item['r89_min']:.2f} - {item['r89_max']:.2f} ({item['rango']} MPa)")
                for item in RESISTENCIA_DISPLAY_CATALOG
            }
            code_upper = dureza_89.upper()
            if code_upper in r89_ranges:
                min_v, max_v, range_str = r89_ranges[code_upper]
                if not (min_v <= dureza_val_89 <= max_v):
                    registrar_error("RESISTENCIA ESTIMADA VALOR '89", dureza_val_89, "ERR_RESISTENCIA_89_INCONGRUENTE", value=dureza_val_89, dureza_val=dureza_89, expected=range_str)
            else:
                registrar_error("DUREZA '89", dureza_89, "ERR_DUREZA_89_INVALIDA", value=dureza_89)

    # 4. Control Estructural [1, 5]
    ctrl_76 = sanitize_value(get_row_val(row_dict, "CONTROL ESTRUCTURAL  '76"), int)
    if ctrl_76 is not None and ctrl_76 != 0:
        if ctrl_76 not in CONTROL_ESTRUCTURAL_CATALOG:
            registrar_error("CONTROL ESTRUCTURAL  '76", ctrl_76, "ERR_CONTROL_ESTRUCTURAL_76_FUERA_LIMITES", value=ctrl_76)
    ctrl_89 = sanitize_value(get_row_val(row_dict, "CONTROL ESTRUCTURAL '89"), int)
    if ctrl_89 is not None and ctrl_89 != 0:
        if ctrl_89 not in CONTROL_ESTRUCTURAL_CATALOG:
            registrar_error("CONTROL ESTRUCTURAL '89", ctrl_89, "ERR_CONTROL_ESTRUCTURAL_89_FUERA_LIMITES", value=ctrl_89)

    # 5. Efectos de Voladura [1, 6] (Se excluye el valor 0 que representa un campo vacío/no mapeado)
    vol_76 = sanitize_value(get_row_val(row_dict, "EFECTOS DE VOLADURA  '76"), int)
    if vol_76 is not None and vol_76 != 0:
        if not (1 <= vol_76 <= 6):
            registrar_error("EFECTOS DE VOLADURA  '76", vol_76, "ERR_EFECTOS_VOLADURA_76_EXCEDE_ESCALA", value=vol_76)
        elif vol_76 not in EFECTOS_VOLADURA_CATALOG:
            registrar_error("EFECTOS DE VOLADURA  '76", vol_76, "WRN_EFECTOS_VOLADURA_76_VALOR_MEDIO", value=vol_76, allowed_values=EFECTOS_VOLADURA_CATALOG)

    vol_89 = sanitize_value(get_row_val(row_dict, "EFECTOS DE VOLADURA '89"), int)
    if vol_89 is not None and vol_89 != 0:
        if not (1 <= vol_89 <= 6):
            registrar_error("EFECTOS DE VOLADURA '89", vol_89, "ERR_EFECTOS_VOLADURA_89_EXCEDE_ESCALA", value=vol_89)
        elif vol_89 not in EFECTOS_VOLADURA_CATALOG:
            registrar_error("EFECTOS DE VOLADURA '89", vol_89, "WRN_EFECTOS_VOLADURA_89_VALOR_MEDIO", value=vol_89, allowed_values=EFECTOS_VOLADURA_CATALOG)

    # 7. Porcentaje de RQD (Límite físico del 100%)
    rqd_76 = sanitize_value(get_row_val(row_dict, "RQD  '76"), float)
    if rqd_76 is not None:
        rqd_76 = round(rqd_76, 2)
        if rqd_76 > 100.0:
            registrar_error("RQD  '76", rqd_76, "ERR_RQD_76_SUPERIOR_100", value=rqd_76)
            
    rqd_89 = sanitize_value(get_row_val(row_dict, "RQD '89"), float)
    if rqd_89 is not None:
        rqd_89 = round(rqd_89, 2)
        if rqd_89 > 100.0:
            registrar_error("RQD '89", rqd_89, "ERR_RQD_89_SUPERIOR_100", value=rqd_89)

    # 6. RQD Ratings por umbral discreto & comprobación de congruencia
    rqd_val_76 = sanitize_value(get_row_val(row_dict, "RQD - VALOR  '76"), float)
    if rqd_val_76 is not None:
        rqd_val_76 = round(rqd_val_76, 2)
        if not is_within_tolerance(rqd_val_76, [3, 8, 13, 17, 20], 0.2):
            registrar_error("RQD - VALOR  '76", rqd_val_76, "WRN_RQD_VAL_76_VALOR_ALEJADO", value=rqd_val_76)
        
        # Validación de incongruencia RQD 76
        if rqd_76 is not None:
            expected_76 = 3 if rqd_76 < 25 - 1e-9 else (8 if rqd_76 < 50 - 1e-9 else (13 if rqd_76 < 75 - 1e-9 else (17 if rqd_76 < 90 - 1e-9 else 20)))
            if abs(rqd_val_76 - expected_76) > 0.2:
                registrar_error("RQD - VALOR  '76", rqd_val_76, "ERR_RQD_76_INCONGRUENTE", value=rqd_val_76, pct=rqd_76, expected=expected_76)

    rqd_val_89 = sanitize_value(get_row_val(row_dict, "RQD - VALOR '89"), float)
    if rqd_val_89 is not None:
        rqd_val_89 = round(rqd_val_89, 2)
        if not (3.0 <= rqd_val_89 <= 20.0):
            registrar_error("RQD - VALOR '89", rqd_val_89, "WRN_RQD_VAL_89_VALOR_ALEJADO", value=rqd_val_89)
            
        # Validación de incongruencia RQD 89
        elif rqd_89 is not None:
            if rqd_89 < 25 - 1e-9:
                min_r, max_r, range_str = 3.0, 5.8, "3.0 - 5.8 (< 25%)"
            elif rqd_89 < 50 - 1e-9:
                min_r, max_r, range_str = 5.8, 10.0, "5.8 - 10.0 (25 - 50%)"
            elif rqd_89 < 75 - 1e-9:
                min_r, max_r, range_str = 10.0, 15.0, "10.0 - 15.0 (50 - 75%)"
            elif rqd_89 < 90 - 1e-9:
                min_r, max_r, range_str = 15.0, 18.0, "15.0 - 18.0 (75 - 90%)"
            else:
                min_r, max_r, range_str = 18.0, 20.0, "18.0 - 20.0 (90 - 100%)"
                
            if not (min_r <= rqd_val_89 <= max_r):
                registrar_error("RQD - VALOR '89", rqd_val_89, "ERR_RQD_89_INCONGRUENTE", value=rqd_val_89, pct=rqd_89, expected=range_str)

    # 8. Espaciamiento Promedio y Coherencia de Ratings
    espac_prom_76 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO PROMEDIO   '76"), float)
    espac_val_76 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO - VALOR    '76"), float)

    if espac_prom_76 is not None:
        espac_prom_76 = round(espac_prom_76, 2)
        if espac_prom_76 < 0:
            registrar_error("ESPACIAMIENTO PROMEDIO   '76", espac_prom_76, "ERR_ESPACIAMIENTO_PROMEDIO_76_NEGATIVO", value=espac_prom_76)
        elif espac_prom_76 == 0:
            registrar_error("ESPACIAMIENTO PROMEDIO   '76", espac_prom_76, "ERR_ESPACIAMIENTO_PROMEDIO_76_CERO")

    if espac_val_76 is not None and espac_val_76 != 0:
        espac_val_76 = round(espac_val_76, 2)
        if not (5.0 <= espac_val_76 <= 30.0):
            registrar_error("ESPACIAMIENTO - VALOR    '76", espac_val_76, "ERR_ESPACIAMIENTO_VALOR_76_RANGO", value=espac_val_76)
        elif espac_val_76 % 1 == 0:
            val_int = int(espac_val_76)
            if val_int not in [5, 10, 20, 25, 30]:
                registrar_error("ESPACIAMIENTO - VALOR    '76", espac_val_76, "WRN_ESPACIAMIENTO_VALOR_76_VALOR_MEDIO", value=val_int)
            elif espac_prom_76 is not None and espac_prom_76 > 0:
                if espac_prom_76 < 0.05 - 1e-9: expected = 5
                elif espac_prom_76 < 0.3 - 1e-9: expected = 10
                elif espac_prom_76 < 1.0 - 1e-9: expected = 20
                elif espac_prom_76 < 3.0 - 1e-9: expected = 25
                else: expected = 30
                if val_int != expected:
                    registrar_error("ESPACIAMIENTO - VALOR    '76", espac_val_76, "ERR_ESPACIAMIENTO_VALOR_76_NO_ALINEADO", value=val_int, promedio=espac_prom_76, expected=expected)

    espac_prom_89 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO PROMEDIO '89"), float)
    espac_val_89 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO - VALOR '89"), float)

    if espac_prom_89 is not None:
        espac_prom_89 = round(espac_prom_89, 2)
        if espac_prom_89 < 0:
            registrar_error("ESPACIAMIENTO PROMEDIO '89", espac_prom_89, "ERR_ESPACIAMIENTO_PROMEDIO_89_NEGATIVO", value=espac_prom_89)
        elif espac_prom_89 == 0:
            registrar_error("ESPACIAMIENTO PROMEDIO '89", espac_prom_89, "ERR_ESPACIAMIENTO_PROMEDIO_89_CERO")

    if espac_val_89 is not None and espac_val_89 != 0:
        espac_val_89 = round(espac_val_89, 2)
        if not (5.0 <= espac_val_89 <= 20.0):
            registrar_error("ESPACIAMIENTO - VALOR '89", espac_val_89, "ERR_ESPACIAMIENTO_VALOR_89_RANGO", value=espac_val_89)
        elif espac_val_89 % 1 == 0:
            val_int = int(espac_val_89)
            if val_int not in [5, 8, 10, 15, 20]:
                registrar_error("ESPACIAMIENTO - VALOR '89", espac_val_89, "WRN_ESPACIAMIENTO_VALOR_89_VALOR_MEDIO", value=val_int)
            elif espac_prom_89 is not None and espac_prom_89 > 0:
                if espac_prom_89 < 0.06 - 1e-9: expected = 5
                elif espac_prom_89 < 0.2 - 1e-9: expected = 8
                elif espac_prom_89 < 0.6 - 1e-9: expected = 10
                elif espac_prom_89 < 2.0 - 1e-9: expected = 15
                else: expected = 20
                if val_int != expected:
                    registrar_error("ESPACIAMIENTO - VALOR '89", espac_val_89, "ERR_ESPACIAMIENTO_VALOR_89_NO_ALINEADO", value=val_int, promedio=espac_prom_89, expected=expected)

    # 9. RMR no nulo
    rmr_76 = sanitize_value(get_row_val(row_dict, "RMR '76"), float)
    if rmr_76 is not None and rmr_76 <= 0.0:
        registrar_error("RMR '76", rmr_76, "ERR_RMR_76_CERO")
        
    rmr_89 = sanitize_value(get_row_val(row_dict, "RMR '89"), float)
    if rmr_89 is not None and rmr_89 <= 0.0:
        registrar_error("RMR '89", rmr_89, "ERR_RMR_89_CERO")

def validate_structural_row(row_dict, dist_celda, registrar_error):
    # 1. Tipo de estructura geológica
    tipo_junta = sanitize_value(
        get_row_val(row_dict, "TIPO") or 
        get_row_val(row_dict, "TIPO DE ESTRUCT") or 
        get_row_val(row_dict, "TIPO DE ESTRUCTURA"), 
        str
    )
    if tipo_junta is not None:
        tipo_junta_clean = tipo_junta.strip().upper()
        if tipo_junta_clean not in TIPO_ESTRUCTURA_CATALOG:
            if tipo_junta_clean == 'J':
                registrar_error("TIPO", tipo_junta, "WRN_TIPO_ESTRUCTURA_J")
            else:
                registrar_error("TIPO", tipo_junta, "ERR_TIPO_ESTRUCTURA_INVALIDO", value=tipo_junta, allowed_types=TIPO_ESTRUCTURA_CATALOG)

    # 2. Rellenos de junta (Opcionales)
    rel1 = sanitize_value(get_row_val(row_dict, "TIPO DE  RELLENO 1"), str, allow_negative=True)
    if rel1 is not None:
        rel1_clean = rel1.strip().lower()
        if rel1_clean not in TIPO_RELLENO_CATALOG:
            registrar_error("TIPO DE  RELLENO 1", rel1, "ERR_RELLENO_1_INVALIDO", value=rel1, allowed_fill_types=TIPO_RELLENO_CATALOG)
        
    rel2 = sanitize_value(get_row_val(row_dict, "TIPO DE  RELLENO 2"), str, allow_negative=True)
    if rel2 is not None:
        rel2_clean = rel2.strip().lower()
        if rel2_clean not in TIPO_RELLENO_CATALOG:
            registrar_error("TIPO DE  RELLENO 2", rel2, "ERR_RELLENO_2_INVALIDO", value=rel2, allowed_fill_types=TIPO_RELLENO_CATALOG)

    # 3. JRC [0, 20]
    jrc_val = sanitize_value(get_row_val(row_dict, "JRC"), int)
    if jrc_val is not None and not (0 <= jrc_val <= 20):
        registrar_error("JRC", jrc_val, "ERR_JRC_RANGO", value=jrc_val)

    # 4. Clase de Rugosidad ISRM [1, 9]
    rug_val = sanitize_value(get_row_val(row_dict, "RUGOSIDAD DE ESTRUCTURAS"), int)
    if rug_val is not None and rug_val not in RUGOSIDAD_CATALOG:
        registrar_error("RUGOSIDAD DE ESTRUCTURAS", rug_val, "ERR_RUGOSIDAD_RANGO", value=rug_val)

    # 5. Forma de estructura
    forma_estrucs = sanitize_value(get_row_val(row_dict, "FORMA DE ESTRUCTURA"), str)
    if forma_estrucs is not None:
        forma_estrucs_clean = forma_estrucs.strip().upper()
        if forma_estrucs_clean not in FORMA_ESTRUCTURA_CATALOG:
            registrar_error("FORMA DE ESTRUCTURA", forma_estrucs, "ERR_FORMA_ESTRUCTURA_INVALIDA", value=forma_estrucs)

    # 6. Alteración de Pared de Junta
    alt_pared = sanitize_value(get_row_val(row_dict, "ALTERACION"), str)
    if alt_pared is not None:
        alt_pared_clean = alt_pared.strip().lower()
        if alt_pared_clean not in ALTERACION_CATALOG:
            registrar_error("ALTERACION", alt_pared, "ERR_ALTERACION_INVALIDA", value=alt_pared, allowed_alteration_types=ALTERACION_CATALOG)

    # 7. Espesor y Abertura
    espesor = sanitize_value(get_row_val(row_dict, "ESPESOR mm."), float)
    if espesor is not None:
        espesor = round(espesor, 2)
    abertura = sanitize_value(get_row_val(row_dict, "ABERTURA mm."), float)
    if abertura is not None:
        abertura = round(abertura, 2)

    tipo_junta_clean = tipo_junta.strip().upper() if tipo_junta is not None else ""
    es_estructura_exceptuada = tipo_junta_clean in ['F', 'SZ', 'BED']

    if espesor is not None and espesor < 0:
        registrar_error("ESPESOR mm.", espesor, "ERR_ESPESOR_NEGATIVO", value=espesor)
    if abertura is not None and abertura < 0:
        registrar_error("ABERTURA mm.", abertura, "ERR_ABERTURA_NEGATIVO", value=abertura)

    if espesor is not None and abertura is not None and espesor > abertura:
        if not es_estructura_exceptuada:
            registrar_error("ESPESOR mm.", espesor, "ERR_ESPESOR_SUPERIOR_ABERTURA", struct_type=(tipo_junta_clean or 'N/A'), thickness=espesor, aperture=abertura)

    # 8. Comprobaciones de escala física de la abertura
    if abertura is not None:
        if es_estructura_exceptuada:
            if dist_celda is not None and (abertura / 1000.0) > dist_celda:
                registrar_error("ABERTURA mm.", abertura, "ERR_ABERTURA_EXCEDE_CELDA", struct_type=tipo_junta_clean, aperture=abertura, cell_len=dist_celda)

    # 9. Persistencia de discontinuidad (Continuidad física vs celda - ERROR DE SUPERACIÓN ELIMINADO)
    cont_junta = sanitize_value(get_row_val(row_dict, "CONTINUIDAD m."), float)
    if cont_junta is not None:
        cont_junta = round(cont_junta, 2)
        if cont_junta < 0:
            registrar_error("CONTINUIDAD m.", cont_junta, "ERR_CONTINUIDAD_NEGATIVA", value=cont_junta)

    # 10. Espaciamiento de discontinuidad estructural
    espac_struct = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO m."), float)
    if espac_struct is not None:
        espac_struct = round(espac_struct, 2)
        if espac_struct < 0:
            registrar_error("ESPACIAMIENTO m.", espac_struct, "ERR_ESPACIAMIENTO_NEGATIVO", value=espac_struct)

    # 11. Inclinación y Dirección de Estructura
    dip_estruc = sanitize_value(get_row_val(row_dict, 'DIP_ESTRUC') or get_row_val(row_dict, 'DIP.1') or get_row_val(row_dict, 'DIP'), float, allow_negative=False)
    if dip_estruc is not None:
        dip_estruc = round(dip_estruc, 2)
        if not (0.0 <= dip_estruc <= 90.0):
            registrar_error("DIP_ESTRUC", dip_estruc, "ERR_DIP_ESTRUC_RANGO", value=dip_estruc)



    # 12. Consistencia en conteo de estructuras estructurales
    num_estrucs = sanitize_value(get_row_val(row_dict, "NUMERO DE ESTRUCTURAS") or get_row_val(row_dict, "N_ESTRUCTURAS"), float)
    if num_estrucs is not None:
        if num_estrucs % 1 != 0:
            registrar_error("NUMERO DE ESTRUCTURAS", num_estrucs, "ERR_NUMERO_ESTRUCTURAS_DECIMAL", value=num_estrucs)

def validate_lithology_correlation(row_dict, registrar_error):
    l1 = sanitize_value(get_row_val(row_dict, "Lito 1"), str)
    l2 = sanitize_value(get_row_val(row_dict, "Lito 2"), str)
    l3 = sanitize_value(get_row_val(row_dict, "Lito 3"), str)
    u_lito = sanitize_value(get_row_val(row_dict, "Unidad Litologica"), str)
    
    l1_clean = l1.strip().upper() if l1 else ""
    l2_clean = l2.strip().upper() if l2 else ""
    l3_clean = l3.strip().upper() if l3 else ""
    
    # Si no hay ninguna litología ingresada, omitimos la validación por completo
    if not l1_clean and not l2_clean and (not l3_clean or l3_clean == "-"):
        return

    group_input_norm = normalize_geological_group(u_lito) if u_lito else ""

    # Determinar si es Metamórfica o Endoskarn mediante roca en Lito 1 (desplazado) o Lito 2 (estándar)
    metamorficas_endoskarn_rocks = {"GSK", "PSK", "MSK", "ESK", "MBC", "MBL", "EPG", "EGT"}
    is_shifted = l1_clean in metamorficas_endoskarn_rocks
    
    if is_shifted:
        # Orden desplazado (ej. Lito1=MBL, Lito2=LMT_MG)
        eff_l2 = l1_clean
        eff_l3 = l2_clean
    else:
        # Orden estándar (ej. Lito2=GSK, Lito3=LMT_M)
        eff_l2 = l2_clean
        eff_l3 = l3_clean
        if "/" in eff_l3:
            eff_l3 = eff_l3.split("/")[-1].strip()

    eff_l3_search = "NR" if (not eff_l3 or eff_l3 == "-") else eff_l3

    # --- BÚSQUEDA DE LITOLOGÍA ---
    matched_row = None
    
    # Caso especial: Endoskarn
    if group_input_norm == "ENDOSKARN" or eff_l2 in ["EPG", "EGT"]:
        intrusivos_l1 = ["MZB", "MBF1", "MBF2", "MZM", "MZH", "MZD", "MZQ", "AN"]
        valid_endo_l1 = {"INTRUSIVO", "INTRUSIVOS", "ENDO", "ENDOSKARN"}
        if is_shifted or l1_clean in valid_endo_l1 or l1_clean in intrusivos_l1 or not l1_clean:
            matched_row = {"grupo": "ENDOSKARN", "lito1": "INTRUSIVO", "lito2": eff_l2, "lito3": "-", "k": 9.87}
            
    if not matched_row and eff_l2:
        # 1. Buscar coincidencia exacta en lito2 y lito3
        for row in LITHOLOGY_CLASSIFICATION:
            row_l3 = row["lito3"].upper()
            norm_row_l3 = "NR" if row_l3 in ["-", "NR", ""] else row_l3
            norm_search_l3 = "NR" if eff_l3_search in ["-", "NR", ""] else eff_l3_search
            if row["lito2"].upper() == eff_l2 and norm_row_l3 == norm_search_l3:
                matched_row = row
                break
                
        # 2. Si no hay coincidencia exacta, buscar con "VARIOS"
        if not matched_row:
            for row in LITHOLOGY_CLASSIFICATION:
                if row["lito2"].upper() == eff_l2 and row["lito3"].upper() == "VARIOS":
                    matched_row = row
                    break
                    
        # 3. Si no, buscar con "NR" o "-" fallback
        if not matched_row:
            for row in LITHOLOGY_CLASSIFICATION:
                row_l3 = row["lito3"].upper()
                if row["lito2"].upper() == eff_l2 and row_l3 in ["NR", "-", ""]:
                    matched_row = row
                    break

    # --- VERIFICACIÓN RIGUROSA DE LA COMBINACIÓN ---
    is_valid_combination = False
    if matched_row is not None:
        if is_shifted:
            # En orden desplazado, Lito 1 (roca) y Lito 2 (subclase/alteración) deben calzar
            is_valid_combination = (l1_clean == matched_row["lito2"].upper() and 
                                    match_lito_column(matched_row["lito3"], l2_clean))
        else:
            if l1_clean:
                if matched_row["grupo"] == "ENDOSKARN":
                    is_valid_combination = (l1_clean in {"INTRUSIVO", "INTRUSIVOS", "ENDO", "ENDOSKARN"} or 
                                            l1_clean in ["MZB", "MBF1", "MBF2", "MZM", "MZH", "MZD", "MZQ", "AN"])
                else:
                    is_valid_combination = match_lito_column(matched_row["lito1"], l1_clean)
            else:
                is_valid_combination = True

    # Emitir alertas litológicas correspondientes
    if not is_valid_combination:
        registrar_error("Lito 1", l1, "ERR_LITOLOGIA_COMBINACION_INVALIDA", l1=l1, l2=l2, l3=l3)
    elif u_lito and matched_row:
        group_esperado = matched_row["grupo"]
        if group_input_norm != group_esperado:
            registrar_error("Unidad Litologica", u_lito, "ERR_UNIDAD_LITOLOGICA_INCONGRUENTE", value=u_lito, expected_group=group_esperado)

    # 13. Resistencia Uniaxial UCS vs Resistencia de Carga Puntual (Is50)
    ucs_val = sanitize_value(get_row_val(row_dict, "( UCS )  (Mpa)"), float)
    if ucs_val is not None:
        ucs_val = round(ucs_val, 2)
    is50_val = sanitize_value(get_row_val(row_dict, "is50 (Mpa)"), float)
    if is50_val is not None:
        is50_val = round(is50_val, 2)
    
    if ucs_val is not None and is50_val is not None:
        if ucs_val <= is50_val:
            registrar_error("( UCS )  (Mpa)", ucs_val, "ERR_UCS_DIVERGENTE_IS50", ucs_val=ucs_val, is50_val=is50_val)
        else:
            factor_k = matched_row["k"] if (matched_row is not None and is_valid_combination) else 10.0
            expected_ucs = is50_val * factor_k
            if abs(ucs_val - expected_ucs) > 1.0:
                registrar_error("( UCS )  (Mpa)", ucs_val, "WRN_UCS_VS_IS50_K_DIVERGENTE", ucs_val=ucs_val, is50_val=is50_val, factor_k=factor_k, expected_ucs=expected_ucs)

def format_raw_value_for_report(raw_val):
    if raw_val is None or pd.isna(raw_val):
        return None
        
    # Si es float o numpy float, redondear a 2 decimales
    if isinstance(raw_val, (float, np.floating)):
        if math.isnan(raw_val):
            return None
        if raw_val.is_integer():
            return int(raw_val)
        return round(float(raw_val), 2)
        
    # Si es int o numpy int, mantener
    if isinstance(raw_val, (int, np.integer)):
        return int(raw_val)
        
    if isinstance(raw_val, str):
        val_str = raw_val.strip()
        if val_str == '':
            return None
        # Verificar si es numérico decimal o entero
        try:
            f_val = float(val_str)
            if f_val.is_integer():
                return int(f_val)
            return round(f_val, 2)
        except ValueError:
            return val_str
            
    return str(raw_val)

def validate_bulk_excel(file_path, output_json_path):
    t_start = time.time()
    print(f"    [*] [QA/QC] Iniciando lectura de archivo: {os.path.basename(file_path)}")
    
    try: 
        xls = pd.ExcelFile(file_path, engine='openpyxl')
        sheet_names = xls.sheet_names
        
        # Validar si el archivo es un reporte del sistema ya procesado
        is_report = any("DASHBOARD" in s.upper() or "ERRORES" in s.upper() or "INCIDENCIAS" in s.upper() for s in sheet_names)
        if is_report:
            raise ValueError("El archivo cargado es un reporte de auditoría generado por el sistema. Por favor, cargue la base de datos geomecánica original con sus celdas de mapeo.")
            
        df = pd.read_excel(xls, sheet_name=sheet_names[0])
        print(f"    [+] [QA/QC] Archivo cargado con éxito. Filas físicas leídas: {len(df)}")
    except ValueError as ve:
        raise ve
    except Exception as e:
        print(f"    [-] [QA/QC] Error crítico al leer el archivo Excel: {e}")
        raise ValueError(f"No se pudo leer el archivo Excel. Verifique que no esté corrupto. Detalle: {str(e)}")
        
    df = clean_and_rename_columns(df)
    print(f"    [*] [QA/QC] Columnas depuradas. Aplicando propagación de estación y sanitización de vacíos...")
    
    # 1. Solo propagar CELDA_PADRE para poder asociar las celdas hijas a su estación
    if 'CELDA_PADRE' in df.columns:
        df['CELDA_PADRE'] = df['CELDA_PADRE'].replace([-1, -1.0, '-1', '-1.0'], np.nan)
        df['CELDA_PADRE'] = df['CELDA_PADRE'].ffill()
        
    # Normalización ultra-robusta de nombres de columnas para sanitizar con seguridad
    def clean_col_name(s):
        return "".join(str(s).split()).replace(".", "").replace("(", "").replace(")", "").replace("_", "").replace("-", "").upper()

    propagate_cols = [
        'ESTE_FROM', 'NORTE_FROM', 'COTA_FROM', 'ESTE_TO', 'NORTE_TO', 'COTA_TO', 
        'Dist.Celda', 'Altura', 'DIP', 'AZ_HOLE', 'DIP_TALUD', 'DIP_DIR_TALUD', 
        'INTEMPERISMO', "CONDICION DE AGUA  '76.", "CONDICION DE AGUA VALOR  '76", 
        "DUREZA  '76", "RESISTENCIA ESTIMADA VALOR  '76", "GSI VISUAL  '76", 
        "CONTROL ESTRUCTURAL  '76", "EFECTOS DE VOLADURA  '76", "RQD - VALOR  '76", 
        "RQD  '76", "FRECUENCIA DE FRACTURAMIENTO x m.  '76", "TAMAÑO DE BLOQUES  x m3  '76", 
        "ESPACIAMIENTO PROMEDIO   '76", "ESPACIAMIENTO - VALOR    '76", 
        "CONDICIÓN DE DISCONTINUIDAD - VALOR     '76", "RMR '76", "( UCS )  (Mpa)", 
        "is50 (Mpa)", "CONDICION DE AGUA  '89", "CONDICION DE AGUA VALOR '89", 
        "DUREZA '89", "RESISTENCIA ESTIMADA VALOR '89", "GSI VISUAL '89", 
        "CONTROL ESTRUCTURAL '89", "EFECTOS DE VOLADURA '89", "RQD - VALOR '89", 
        "RQD '89", "FRECUENCIA DE FRACTURAMIENTO x m. '89", "TAMAÑO DE BLOQUES  x m3 '89", 
        "ESPACIAMIENTO PROMEDIO '89", "ESPACIAMIENTO - VALOR '89", 
        "CONDICIÓN DE DISCONTINUIDAD - VALOR '89", "RMR '89", "FECHA",
        'GEOTECNICO', 'Nivel', 'Lito 1', 'Lito 2', 'Lito 3', 'Unidad Litologica', 'sector_geotecnico', 'sector_geotecnicos'
    ]

    df_col_map = {clean_col_name(c): c for c in df.columns}
    resolved_propagate_cols = []
    for p_col in propagate_cols:
        norm_p = clean_col_name(p_col)
        if norm_p in df_col_map:
            resolved_propagate_cols.append(df_col_map[norm_p])

    # Sanitizar valores de Excel sin propagar con ffill, previniendo duplicados falsos en celdas hijas
    for col in resolved_propagate_cols:
        col_clean = clean_col_name(col)
        if col_clean not in ['DIP', 'DIPTALUD']:
            df[col] = df[col].replace([-1, -1.0, '-1', '-1.0'], np.nan)

    records = df.to_dict(orient='records')
    
    print(f"    [*] [QA/QC] Ejecutando validaciones QA/QC sobre {len(records)} registros individuales...")
    incidencias, resumen_celdas = [], {}
    total_filas = len(records)
    total_vacios, total_advertencias, total_alertas, total_ok = 0, 0, 0, 0
    filas_por_campana, filas_por_geotecnico = {}, {}
    vacios_por_campana, vacios_por_geotecnico = {}, {}
    
    seen_parents = set()
    daughter_counters = {}
    parent_properties = {}
    active_celda_padre = None
    active_block_key = None

    for idx, row_dict in enumerate(records):
        fila_excel = idx + 2 
        celda_padre = sanitize_value(get_row_val(row_dict, 'CELDA_PADRE'), str)
        if not celda_padre:
            incidencias.append({
                "fila_excel": fila_excel, "celda_padre": "N/A", "celda_hija": "N/A",
                "columna": "CELDA_PADRE", "valor_actual": None, 
                "rule_code": "ERR_CELDA_PADRE_MISSING",
                "tipo_incidencia": "ALERTA",
                "mensaje": "La fila no posee una estación de mapeo válida asociada.",
                "tipo_mapeo": "Mapeo de Celdas"
            })
            total_alertas += 1
            continue

        camp = sanitize_value(get_row_val(row_dict, 'Campaña'), int)
        geo = sanitize_value(get_row_val(row_dict, 'GEOTECNICO'), str)
        sector = sanitize_value(
            get_row_val(row_dict, 'sector_geotecnicos') or 
            get_row_val(row_dict, 'sector_geotecnico') or 
            get_row_val(row_dict, 'sector') or
            get_row_val(row_dict, 'Sector Geotecnico') or
            get_row_val(row_dict, 'Sector Geotecnicos'),
            str
        ) or "N/A"
        dist_celda = sanitize_value(get_row_val(row_dict, 'Dist.Celda'), float)

        # Detectar inicio de bloque / nueva fila padre
        # Regla 1: El nombre de celda (CELDA1) cambió → nueva estación
        # Regla 2: Celda duplicada explícita en CELDA2 con mismo nombre → bloque repetido
        # Regla 3: Mismo nombre de celda PERO distinta campaña → misma estación, año diferente
        celda_dup = get_row_val(row_dict, 'CELDA_DUPLICADA_IGNORE')
        is_new_parent_row = False

        if celda_padre != active_celda_padre:
            # El nombre de celda cambió — nueva estación
            is_new_parent_row = True
        elif celda_dup is not None and str(celda_dup).strip().upper() == celda_padre.upper():
            # CELDA2 tiene el mismo nombre que CELDA1 → bloque repetido explícito
            is_new_parent_row = True
        elif camp is not None and active_block_key is not None:
            # Mismo nombre de celda — verificar si la CAMPAÑA cambió respecto al bloque activo
            active_camp = parent_properties.get(active_block_key, {}).get("camp")
            if active_camp is not None and str(camp) != str(active_camp):
                is_new_parent_row = True

        if is_new_parent_row:
            active_celda_padre = celda_padre
            active_block_key = f"{celda_padre}_row_{fila_excel}"


        is_parent_row = False
        if active_block_key not in seen_parents:
            seen_parents.add(active_block_key)
            is_parent_row = True
            daughter_counters[active_block_key] = 1
            parent_properties[active_block_key] = {
                "camp": camp,
                "geo": geo,
                "sector": sector,
                "dist_celda": dist_celda,
                "dip_talud": sanitize_value(get_row_val(row_dict, 'DIP_TALUD'), float, allow_negative=True)
            }
        else:
            daughter_counters[active_block_key] += 1

        props = parent_properties.get(active_block_key, {})
        resolved_camp = props.get("camp") or camp
        resolved_geo = props.get("geo") or geo
        resolved_sector = props.get("sector") or sector
        resolved_dist_celda = props.get("dist_celda") or dist_celda

        if resolved_camp: 
            filas_por_campana[str(resolved_camp)] = filas_por_campana.get(str(resolved_camp), 0) + 1
        if resolved_geo: 
            filas_por_geotecnico[resolved_geo] = filas_por_geotecnico.get(resolved_geo, 0) + 1

        if celda_padre not in resumen_celdas:
            resumen_celdas[celda_padre] = {
                "total_hijas": 0,
                "vacios": 0,
                "advertencias": 0,
                "alertas": 0,
                "estado_celda": "OK",
                "dist_celda": resolved_dist_celda if resolved_dist_celda is not None else 0.0,
                "campania": str(resolved_camp) if resolved_camp else "N/A"
            }
        else:
            if resolved_camp and (resumen_celdas[celda_padre]["campania"] == "N/A" or is_new_parent_row):
                resumen_celdas[celda_padre]["campania"] = str(resolved_camp)

        celda_hija = f"{celda_padre}-{daughter_counters[active_block_key]}"
        resumen_celdas[celda_padre]["total_hijas"] += 1
        row_has_errors = False

        def registrar_error(col, val, rule_code, **msg_kwargs):
            nonlocal row_has_errors, total_vacios, total_advertencias, total_alertas
            rule = RULES_REGISTRY.get(rule_code)
            if not rule:
                raise ValueError(f"Código de regla desconocido: {rule_code}")
            cat = CATEGORIES_REGISTRY.get(rule.category_code)
            tipo = cat.severity if cat else "ALERTA"
            msg = rule.format_message(**msg_kwargs)
            
            # Clasificación de Tipo de Mapeo — usando constantes pre-computadas a nivel de módulo
            col_clean = str(col).strip()
            is_estructural_specific = (col_clean == "DIP_ESTRUC") or (col_clean == "DIP" and rule_code.startswith("ERR_DIP_ESTRUC"))
            if is_estructural_specific:
                tipo_mapeo = "Mapeo de Estructuras"
            else:
                tipo_mapeo = "Mapeo de Celdas" if _norm_col(col_clean) in _MAPEO_ESTRUCTURAL_NORM else "Mapeo de Estructuras"
            
            # Obtener el valor real e íntegro de la celda de la planilla original
            actual_col = col
            if col == "DIP" and rule_code.startswith("ERR_DIP_ESTRUC") and "DIP_ESTRUC" in row_dict:
                actual_col = "DIP_ESTRUC"
            raw_excel_val = get_row_val(row_dict, actual_col)
            formatted_val = format_raw_value_for_report(raw_excel_val)
            
            incidencias.append({
                "fila_excel": fila_excel, "celda_padre": celda_padre, "celda_hija": celda_hija,
                "columna": col, "valor_actual": formatted_val, 
                "rule_code": rule_code,
                "tipo_incidencia": tipo, "mensaje": msg,
                "campania": str(resolved_camp) if resolved_camp else "N/A", 
                "geotecnico": resolved_geo if resolved_geo else "N/A", 
                "sector_geotecnico": resolved_sector,
                "tipo_mapeo": tipo_mapeo
            })
            if tipo == "VACIO":
                total_vacios += 1
                resumen_celdas[celda_padre]["vacios"] += 1
                if resolved_camp: vacios_por_campana[str(resolved_camp)] = vacios_por_campana.get(str(resolved_camp), 0) + 1
                if resolved_geo: vacios_por_geotecnico[resolved_geo] = vacios_por_geotecnico.get(resolved_geo, 0) + 1
            elif tipo == "ADVERTENCIA":
                total_advertencias += 1
                resumen_celdas[celda_padre]["advertencias"] += 1
            elif tipo == "ALERTA":
                total_alertas += 1
                resumen_celdas[celda_padre]["alertas"] += 1
                row_has_errors = True

        # 1. Validar campos obligatorios vacíos (RELLENO 2 es OPCIONAL)
        structural_mandatory_cols = [
            'TIPO', 'TIPO DE ESTRUCT', 'TIPO DE ESTRUCTURA', 'JRC', 'RUGOSIDAD DE ESTRUCTURAS', 
            'FORMA DE ESTRUCTURA', 'ALTERACION', 'ESPESOR mm.', 'ABERTURA mm.', 'CONTINUIDAD m.', 
            'ESPACIAMIENTO m.', 'DIP_ESTRUC', 'DIP DIR', 'NUMERO DE ESTRUCTURAS', 'N_ESTRUCTURAS'
        ]
        structural_mandatory_clean = [clean_col_name(c) for c in structural_mandatory_cols]

        for col_key in df.columns:
            if col_key in ['COMENTARIO', 'CELDA_DUPLICADA_IGNORE', 'TIPO DE  RELLENO 2', 'TIPO DE RELLENO 2'] or str(col_key).startswith('Unnamed:'): 
                continue
                
            # Omisión Inteligente de Vacíos: Si es celda secundaria (hija) y la columna NO es de tipo estructural,
            # omitimos por completo el chequeo de vacío, ya que las columnas de cabecera/geomecánica solo son obligatorias en la fila maestra (padre).
            if not is_parent_row and clean_col_name(col_key) not in structural_mandatory_clean:
                continue

            is_dip_col = clean_col_name(col_key) in ['DIP', 'DIPTALUD']
            v = sanitize_value(row_dict.get(col_key), str, allow_negative=is_dip_col)
                
            if v is None: 
                registrar_error(col_key, None, "ERR_CAMPO_OBLIGATORIO_VACIO", col_key=col_key)

        # 2. Desglose de validaciones estructuradas
        # Omisión Inteligente de Reglas Cruzadas: Si la celda es secundaria y hereda sus datos por omisión,
        # evitamos re-evaluar las validaciones globales de cabecera y propiedades geomecánicas.
        # Solo se validan si el usuario ingresó explícitamente información en esta fila secundaria.
        debe_validar_global = is_parent_row
        if not is_parent_row:
            # Verificamos si hay alguna columna de cabecera o geomecánica que tenga un valor explícito en esta fila secundaria
            for col in resolved_propagate_cols:
                if sanitize_value(row_dict.get(col), str) is not None:
                    debe_validar_global = True
                    break

        if debe_validar_global:
            # Validación cruzada basada en las coordenadas espaciales de la celda
            ef = sanitize_value(get_row_val(row_dict, 'ESTE_FROM'), float)
            nf = sanitize_value(get_row_val(row_dict, 'NORTE_FROM'), float)
            cf = sanitize_value(get_row_val(row_dict, 'COTA_FROM'), float)
            et = sanitize_value(get_row_val(row_dict, 'ESTE_TO'), float)
            nt = sanitize_value(get_row_val(row_dict, 'NORTE_TO'), float)
            ct = sanitize_value(get_row_val(row_dict, 'COTA_TO'), float)
            
            coords_valid = all(val is not None for val in [ef, nf, cf, et, nt, ct]) and not (ef == 0 and nf == 0 and cf == 0)
            
            largo_calc = None
            if coords_valid:
                dx = et - ef
                dy = nt - nf
                dz = ct - cf
                largo_calc = math.sqrt(dx*dx + dy*dy + dz*dz)
                
            largo_val = largo_calc if (largo_calc is not None and largo_calc > 0) else resolved_dist_celda
            
            # Validaciones de fórmulas comentadas a petición
            # if coords_valid and largo_val and largo_val > 0:
            #     dx = et - ef
            #     dy = nt - nf
            #     dz = ct - cf
            #     
            #     sin_val = abs(dz) / largo_val
            #     if sin_val > 1.0:
            #         sin_val = 1.0
            #     expected_dip = abs(math.asin(sin_val) * (180.0 / math.pi))
            #     
            #     expected_az = (math.atan2(dx, dy) * (180.0 / math.pi)) % 360.0
            #     if expected_az < 0:
            #         expected_az += 360.0
            #         
            #     expected_dipdir = (expected_az + 90.0) % 360.0
            #     
            #     # Validar DIP (inclinación de celda)
            #     entered_dip = sanitize_value(get_row_val(row_dict, 'DIP'), float, allow_negative=True)
            #     if entered_dip is not None:
            #         if abs(abs(entered_dip) - expected_dip) > 2.0:
            #             registrar_error("DIP", entered_dip, "WRN_DIP_DISCREPANCIA_COORD", actual=entered_dip, expected=round(expected_dip, 2))
            #             
            #     # Validar AZ_HOLE
            #     entered_az = sanitize_value(get_row_val(row_dict, 'AZ_HOLE'), float)
            #     if entered_az is not None:
            #         diff_az = abs(entered_az - expected_az) % 360.0
            #         if diff_az > 180.0:
            #             diff_az = 360.0 - diff_az
            #         if diff_az > 2.0:
            #             registrar_error("AZ_HOLE", entered_az, "WRN_AZ_HOLE_DISCREPANCIA", actual=entered_az, expected=round(expected_az, 2))
            #             
            #     # Validar DIP_DIR_TALUD
            #     entered_dipdir = sanitize_value(get_row_val(row_dict, 'DIP_DIR_TALUD'), float)
            #     if entered_dipdir is not None:
            #         diff_dd = abs(entered_dipdir - expected_dipdir) % 360.0
            #         if diff_dd > 180.0:
            #             diff_dd = 360.0 - diff_dd
            #         if diff_dd > 2.0:
            #             registrar_error("DIP_DIR_TALUD", entered_dipdir, "WRN_DIP_DIR_TALUD_DISCREPANCIA", actual=entered_dipdir, expected=round(expected_dipdir, 2))
            
            # Comparar DIP_TALUD de fila hija contra el valor de la fila maestra (parent_properties) con 2° de tolerancia
            if not is_parent_row:
                parent_dip_talud = props.get("dip_talud")
                entered_dip_talud = sanitize_value(get_row_val(row_dict, 'DIP_TALUD'), float, allow_negative=True)
                if entered_dip_talud is not None and parent_dip_talud is not None:
                    if abs(abs(entered_dip_talud) - abs(parent_dip_talud)) > 2.0:
                        registrar_error("DIP_TALUD", entered_dip_talud, "WRN_DIP_TALUD_DISCREPANCIA", actual=entered_dip_talud, expected=parent_dip_talud)

            validate_geotechnical_header(row_dict, registrar_error)
            validate_geomechanical_properties(row_dict, registrar_error)
            validate_lithology_correlation(row_dict, registrar_error)
            
        validate_structural_row(row_dict, resolved_dist_celda, registrar_error)

        if not row_has_errors: total_ok += 1

    total_celdas_ok = sum(1 for c, data in resumen_celdas.items() if data["alertas"] == 0 and data["vacios"] == 0)
    for c, data in resumen_celdas.items():
        if data["alertas"] > 0: data["estado_celda"] = "ALERTA"
        elif data["vacios"] > 0 or data["advertencias"] > 0: data["estado_celda"] = "ADVERTENCIA"
        else: data["estado_celda"] = "OK"

    output_json = {
        "total_filas_procesadas": total_filas,
        "total_celdas_evaluadas": total_filas * MANDATORY_COLS_COUNT,
        "metricas_globales": {
            "total_celdas_padre": len(resumen_celdas), "total_celdas_hija_procesadas": total_filas,
            "total_ok": total_ok, "total_vacios": total_vacios, "total_advertencias": total_advertencias,
            "total_alertas": total_alertas, "total_celdas_ok": total_celdas_ok
        },
        "distribucion_filas_campana": filas_por_campana, "distribucion_geotecnico": filas_por_geotecnico,
        "consolidado_tabla": {}
    }
    
    output_json["incidencias"] = incidencias
    output_json["resumen_por_celda_padre"] = resumen_celdas

    tmp_path = output_json_path + ".tmp"
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(output_json, f, ensure_ascii=False)
    
    os.replace(tmp_path, output_json_path)

    elapsed = time.time() - t_start
    print(f"    [+] [QA/QC] Validación geomecánica finalizada en {elapsed:.2f}s. Alertas: {total_alertas} | Vacíos: {total_vacios} | Advertencias: {total_advertencias}")