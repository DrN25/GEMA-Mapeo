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
    LITHOLOGY_CLASSIFICATION, RESISTENCIA_DISPLAY_CATALOG, RQD_DISPLAY_CATALOG,
    get_project_geology_config, GROUP_COMPATIBILITY
)
from app.validation.registry import RULES_REGISTRY, CATEGORIES_REGISTRY, GEOMECHANICAL_THRESHOLDS
from app.utils.interpolation import rating_continuo_rqd, rating_continuo_r1


from functools import lru_cache

_MISSING = object()


@lru_cache(maxsize=4096)
def _clean_k(s):
    return "".join(str(s).split()).replace(".", "").replace("(", "").replace(")", "").replace("_", "").replace("-", "").upper()


def get_row_val(row_dict, key):
    val = row_dict.get(key, _MISSING)
    if val is not _MISSING:
        return val

    norm_map = getattr(row_dict, "_norm_lookup", None)
    if norm_map is not None:
        resolved = norm_map.get(_clean_k(key))
        return row_dict.get(resolved) if resolved is not None else None

    target_norm = _clean_k(key)
    for k, v in row_dict.items():
        if _clean_k(k) == target_norm:
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
    except (ValueError, TypeError, OverflowError):
        return None

def is_within_tolerance(val, targets, tolerance):
    if val is None: return False
    return any(abs(val - t) <= tolerance for t in targets)

def match_lito_column(catalog_val, input_val, intrusive_codes: set = None) -> bool:
    c_val = str(catalog_val or '').strip().upper()
    i_val = str(input_val or '').strip().upper()
    
    if c_val == '-' or c_val == '':
        return True
        
    options = [opt.strip() for opt in c_val.split('/')]
    for opt in options:
        if opt == 'VARIOS' or opt == 'CUALQUIERA':
            return i_val not in ['', '-', 'N/A', 'NONE']
            
        if opt in ('INTRUSIVO', 'INTRUSIVOS'):
            if intrusive_codes is not None:
                if i_val in intrusive_codes:
                    return True
            elif i_val in ["MZB", "MBF1", "MBF2", "MZM", "MZH", "MZD", "MZQ", "AN"]:
                return True
            
        if opt == i_val:
            return True
            
    return False

def normalize_geological_group(group_str):
    if not group_str:
        return ""
    
    val = str(group_str).strip().upper()
    val = val.replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O").replace("Ú", "U")
    
    if "EXOS" in val or "ALTERADA" in val:
        return "METAMORFICAS"
    if "SEDIMENT" in val:
        return "SEDIMENTARIOS"
    if "METAMORF" in val:
        return "METAMORFICAS"
    if "INTRUSIV" in val:
        return "INTRUSIVOS"
    if "BRECHA" in val:
        return "BRECHAS"
    if "ESDONS" in val or "ENDO" in val:
        return "ENDOSKARN"
    if "SKARN" in val or val == "SK":
        return "SKARN"
        
    return NORM_GROUP_MAP.get(val, val)

def validate_geotechnical_header(row_dict, registrar_error):
    dip_talud = sanitize_value(get_row_val(row_dict, 'DIP_TALUD'), float, allow_negative=True)
    if dip_talud is not None:
        dip_talud = round(dip_talud, 2)
        if not (-90.0 <= dip_talud <= 90.0):
            registrar_error("DIP_TALUD", dip_talud, "ERR_DIP_TALUD_RANGO", value=dip_talud)

def validate_geomechanical_properties(row_dict, registrar_error, campania=None):
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
            code_upper = dureza_89.upper()
            if campania in [2021, 2022, 2023]:
                ucs_val = sanitize_value(get_row_val(row_dict, "( UCS )  (Mpa)"), float)
                if ucs_val is not None:
                    expected_r = rating_continuo_r1(ucs_val)
                    if abs(dureza_val_89 - expected_r) > 0.2:
                        registrar_error("RESISTENCIA ESTIMADA VALOR '89", dureza_val_89, "ERR_RESISTENCIA_89_INCONGRUENTE", value=dureza_val_89, dureza_val=dureza_89, expected=f"{expected_r:.2f} (Ábaco UCS={ucs_val} MPa)")
                else:
                    if code_upper in RESISTENCIA_RATING_CATALOG:
                        expected = RESISTENCIA_RATING_CATALOG[code_upper]["r89"]
                        if abs(dureza_val_89 - expected) > 0.2:
                            registrar_error("RESISTENCIA ESTIMADA VALOR '89", dureza_val_89, "ERR_RESISTENCIA_89_INCONGRUENTE", value=dureza_val_89, dureza_val=dureza_89, expected=f"{expected} (Discreto)")
            else:
                if code_upper in RESISTENCIA_RATING_CATALOG:
                    expected = RESISTENCIA_RATING_CATALOG[code_upper]["r89"]
                    if abs(dureza_val_89 - expected) > 0.2:
                        registrar_error("RESISTENCIA ESTIMADA VALOR '89", dureza_val_89, "ERR_RESISTENCIA_89_INCONGRUENTE", value=dureza_val_89, dureza_val=dureza_89, expected=f"{expected} (Discreto)")
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
        if rqd_76 > 100.0:
            registrar_error("RQD  '76", rqd_76, "ERR_RQD_76_SUPERIOR_100", value=round(rqd_76, 2))
            
    rqd_89 = sanitize_value(get_row_val(row_dict, "RQD '89"), float)
    if rqd_89 is not None:
        if rqd_89 > 100.0:
            registrar_error("RQD '89", rqd_89, "ERR_RQD_89_SUPERIOR_100", value=round(rqd_89, 2))

    # 6. RQD Ratings por umbral discreto & comprobación de congruencia
    rqd_val_76 = sanitize_value(get_row_val(row_dict, "RQD - VALOR  '76"), float)
    if rqd_val_76 is not None:
        rqd_val_76 = round(rqd_val_76, 2)
        if not is_within_tolerance(rqd_val_76, [3, 8, 13, 17, 20], 0.2):
            registrar_error("RQD - VALOR  '76", rqd_val_76, "WRN_RQD_VAL_76_VALOR_ALEJADO", value=rqd_val_76)
        
        # Validación de incongruencia RQD 76
        if rqd_76 is not None:
            rqd_76_int = int(round(rqd_76))
            expected_76 = 3 if rqd_76_int < 25 else (8 if rqd_76_int < 50 else (13 if rqd_76_int < 75 else (17 if rqd_76_int < 90 else 20)))
            if abs(rqd_val_76 - expected_76) > 0.2:
                registrar_error("RQD - VALOR  '76", rqd_val_76, "ERR_RQD_76_INCONGRUENTE", value=rqd_val_76, pct=round(rqd_76, 2), expected=expected_76)

    rqd_val_89 = sanitize_value(get_row_val(row_dict, "RQD - VALOR '89"), float)
    if rqd_val_89 is not None:
        rqd_val_89 = round(rqd_val_89, 2)
        if not (3.0 <= rqd_val_89 <= 20.0):
            registrar_error("RQD - VALOR '89", rqd_val_89, "WRN_RQD_VAL_89_VALOR_ALEJADO", value=rqd_val_89)
            
        elif rqd_89 is not None:
            if campania == 2021:
                rqd_89_int = int(round(rqd_89))
                expected_rqd = 3 if rqd_89_int < 25 else (8 if rqd_89_int < 50 else (13 if rqd_89_int < 75 else (17 if rqd_89_int < 90 else 20)))
                if abs(rqd_val_89 - expected_rqd) > 0.2:
                    registrar_error("RQD - VALOR '89", rqd_val_89, "ERR_RQD_89_INCONGRUENTE", value=rqd_val_89, pct=round(rqd_89, 2), expected=f"{expected_rqd} (Discreto)")
            else:
                expected_rqd_r = rating_continuo_rqd(rqd_89)
                if abs(rqd_val_89 - expected_rqd_r) > 0.2:
                    registrar_error("RQD - VALOR '89", rqd_val_89, "ERR_RQD_89_INCONGRUENTE", value=rqd_val_89, pct=round(rqd_89, 2), expected=f"{expected_rqd_r:.2f} (Ábaco RQD)")

    # 8. Espaciamiento Promedio y Coherencia de Ratings
    espac_prom_76 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO PROMEDIO   '76"), float)
    espac_val_76 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO - VALOR    '76"), float)

    if espac_prom_76 is not None:
        espac_prom_76 = round(espac_prom_76, 3)
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
                # Exacto
                if espac_prom_76 < 0.05 - 1e-9: expected_ex = 5
                elif espac_prom_76 < 0.3 - 1e-9: expected_ex = 10
                elif espac_prom_76 < 1.0 - 1e-9: expected_ex = 20
                elif espac_prom_76 < 3.0 - 1e-9: expected_ex = 25
                else: expected_ex = 30
                
                # Redondeado a 2 decimales (formato visual en Excel)
                espac_prom_76_rounded = round(espac_prom_76, 2)
                if espac_prom_76_rounded < 0.05: expected_rd = 5
                elif espac_prom_76_rounded < 0.3: expected_rd = 10
                elif espac_prom_76_rounded < 1.0: expected_rd = 20
                elif espac_prom_76_rounded < 3.0: expected_rd = 25
                else: expected_rd = 30
                
                if val_int != expected_ex and val_int != expected_rd:
                    registrar_error("ESPACIAMIENTO - VALOR    '76", espac_val_76, "ERR_ESPACIAMIENTO_VALOR_76_NO_ALINEADO", value=val_int, promedio=espac_prom_76, expected=expected_ex)

    espac_prom_89 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO PROMEDIO '89"), float)
    espac_val_89 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO - VALOR '89"), float)

    if espac_prom_89 is not None:
        espac_prom_89 = round(espac_prom_89, 3)
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
                # Exacto
                if espac_prom_89 < 0.06 - 1e-9: expected_ex = 5
                elif espac_prom_89 < 0.2 - 1e-9: expected_ex = 8
                elif espac_prom_89 < 0.6 - 1e-9: expected_ex = 10
                elif espac_prom_89 < 2.0 - 1e-9: expected_ex = 15
                else: expected_ex = 20
                
                # Redondeado a 2 decimales
                espac_prom_89_rounded = round(espac_prom_89, 2)
                if espac_prom_89_rounded < 0.06: expected_rd = 5
                elif espac_prom_89_rounded < 0.2: expected_rd = 8
                elif espac_prom_89_rounded < 0.6: expected_rd = 10
                elif espac_prom_89_rounded < 2.0: expected_rd = 15
                else: expected_rd = 20
                
                if val_int != expected_ex and val_int != expected_rd:
                    registrar_error("ESPACIAMIENTO - VALOR '89", espac_val_89, "ERR_ESPACIAMIENTO_VALOR_89_NO_ALINEADO", value=val_int, promedio=espac_prom_89, expected=expected_ex)

    # 9. RMR no nulo
    rmr_76 = sanitize_value(get_row_val(row_dict, "RMR '76"), float)
    if rmr_76 is not None and rmr_76 <= 0.0:
        registrar_error("RMR '76", rmr_76, "ERR_RMR_76_CERO")
        
    rmr_89 = sanitize_value(get_row_val(row_dict, "RMR '89"), float)
    if rmr_89 is not None and rmr_89 <= 0.0:
        registrar_error("RMR '89", rmr_89, "ERR_RMR_89_CERO")

def validate_structural_row(row_dict, dist_celda, registrar_error, parent_coords=None):
    # 1. Tipo de estructura geológica
    raw_tipo = (
        get_row_val(row_dict, "TIPO") or 
        get_row_val(row_dict, "TIPO DE ESTRUCT") or 
        get_row_val(row_dict, "TIPO DE ESTRUCTURA")
    )
    
    # Manejo del centinela "-1" ("Sin Registro"): No genera error y desactiva validaciones de discontinuidad
    if raw_tipo is not None and str(raw_tipo).strip() in ['-1', '-1.0']:
        return

    tipo_junta = sanitize_value(raw_tipo, str)
    if tipo_junta is not None:
        tipo_junta_clean = tipo_junta.strip().upper()
        if tipo_junta_clean not in TIPO_ESTRUCTURA_CATALOG:
            if tipo_junta_clean == 'J':
                registrar_error("TIPO", tipo_junta, "WRN_TIPO_ESTRUCTURA_J")
            else:
                registrar_error("TIPO", tipo_junta, "ERR_TIPO_ESTRUCTURA_INVALIDO", value=tipo_junta, allowed_types=TIPO_ESTRUCTURA_CATALOG)

    # 2. Rellenos de junta (Opcionales)
    rel1 = sanitize_value(get_row_val(row_dict, "TIPO DE  RELLENO 1"), str, allow_negative=True)
    if rel1 is not None and rel1 not in ['-1', '-1.0']:
        rel1_clean = rel1.strip().lower()
        if rel1_clean not in TIPO_RELLENO_CATALOG:
            registrar_error("TIPO DE  RELLENO 1", rel1, "ERR_RELLENO_1_INVALIDO", value=rel1, allowed_fill_types=TIPO_RELLENO_CATALOG)
        
    rel2 = sanitize_value(get_row_val(row_dict, "TIPO DE  RELLENO 2"), str, allow_negative=True)
    if rel2 is not None and rel2 not in ['-1', '-1.0']:
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

    if espesor is not None and espesor < 0 and espesor != -1.0:
        registrar_error("ESPESOR mm.", espesor, "ERR_ESPESOR_NEGATIVO", value=espesor)
    if abertura is not None and abertura < 0 and abertura != -1.0:
        registrar_error("ABERTURA mm.", abertura, "ERR_ABERTURA_NEGATIVO", value=abertura)

    if espesor is not None and abertura is not None and espesor > abertura:
        if not es_estructura_exceptuada:
            registrar_error("ESPESOR mm.", espesor, "ERR_ESPESOR_SUPERIOR_ABERTURA", struct_type=(tipo_junta_clean or 'N/A'), thickness=espesor, aperture=abertura)

    # 8. Comprobaciones de escala física de la abertura
    if abertura is not None:
        if es_estructura_exceptuada:
            if dist_celda is not None and (abertura / 1000.0) > dist_celda:
                registrar_error("ABERTURA mm.", abertura, "ERR_ABERTURA_EXCEDE_CELDA", struct_type=tipo_junta_clean, aperture=abertura, cell_len=dist_celda)

    # 9. Persistencia de discontinuidad (Continuidad física vs celda)
    cont_junta = sanitize_value(get_row_val(row_dict, "CONTINUIDAD m."), float)
    if cont_junta is not None:
        cont_junta = round(cont_junta, 2)
        if cont_junta < 0 and cont_junta != -1.0:
            registrar_error("CONTINUIDAD m.", cont_junta, "ERR_CONTINUIDAD_NEGATIVA", value=cont_junta)

    # 10. Espaciamiento de discontinuidad estructural
    espac_struct = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO m."), float)
    if espac_struct is not None:
        espac_struct = round(espac_struct, 2)
        if espac_struct < 0 and espac_struct != -1.0:
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

    # 13. Distancia de la estructura a lo largo de la celda (Permite -1 como Sin Registro)
    raw_dist_est = (
        get_row_val(row_dict, "Dist. de estr.") or 
        get_row_val(row_dict, "DISTANCIA") or 
        get_row_val(row_dict, "DISTANCIA DE ESTRUCTURA")
    )
    dist_est = sanitize_value(raw_dist_est, float, allow_negative=True)
    if dist_est is not None and dist_est != -1.0:
        if dist_est < 0.0:
            registrar_error("Dist. de estr.", dist_est, "ERR_DISTANCIA_ESTRUCTURA_EXCEDE_CELDA", dest=dist_est, largo=dist_celda or 0.0)
        elif dist_celda is not None and dist_est > (dist_celda + GEOMECHANICAL_THRESHOLDS["ESTRUCTURA_DISTANCIA_TOLERANCIA"]):
            registrar_error("Dist. de estr.", dist_est, "ERR_DISTANCIA_ESTRUCTURA_EXCEDE_CELDA", dest=dist_est, largo=round(dist_celda, 2))

    # 14. Coordenadas de estructura (x, y, z) respecto a la recta de la ventana
    sx = sanitize_value(get_row_val(row_dict, "x") or get_row_val(row_dict, "X"), float)
    sy = sanitize_value(get_row_val(row_dict, "y") or get_row_val(row_dict, "Y"), float)
    sz = sanitize_value(get_row_val(row_dict, "z") or get_row_val(row_dict, "Z"), float)
    if all(v is not None for v in [sx, sy, sz]) and not (sx == 0 and sy == 0 and sz == 0):
        if parent_coords and all(c is not None for c in parent_coords):
            ef, nf, cf, et, nt, ct = parent_coords
            dx, dy, dz = et - ef, nt - nf, ct - cf
            l_scan = math.sqrt(dx*dx + dy*dy + dz*dz)
            if l_scan > 0:
                # Desviación ortogonal a la recta de celda
                wx, wy, wz = sx - ef, sy - nf, sz - cf
                t = (wx * dx + wy * dy + wz * dz) / (l_scan * l_scan)
                proj_x = ef + t * dx
                proj_y = nf + t * dy
                proj_z = cf + t * dz
                d_perp = math.sqrt((sx - proj_x)**2 + (sy - proj_y)**2 + (sz - proj_z)**2)
                if d_perp > GEOMECHANICAL_THRESHOLDS["ESTRUCTURA_COORD_TOLERANCIA"]:
                    registrar_error("x, y, z", sx, "ERR_COORD_ESTRUCTURA_FUERA_DE_CELDA", x=round(sx, 2), y=round(sy, 2), z=round(sz, 2), desv=round(d_perp, 2))
                
                # Contraste con el cálculo analítico estándar de GEMA
                if dist_est is not None and dist_est > 0:
                    calc_x = ef + (dist_est / l_scan) * dx
                    calc_y = nf + (dist_est / l_scan) * dy
                    calc_z = cf + (dist_est / l_scan) * dz
                    diff_calc = math.sqrt((sx - calc_x)**2 + (sy - calc_y)**2 + (sz - calc_z)**2)
                    if diff_calc > GEOMECHANICAL_THRESHOLDS["ESTRUCTURA_COORD_TOLERANCIA"]:
                        registrar_error(
                            "x, y, z",
                            sx,
                            "ERR_COORD_ESTRUCTURA_DISCREPANCIA_CALCULO",
                            diff=round(diff_calc, 2),
                            decl_x=round(sx, 2), decl_y=round(sy, 2), decl_z=round(sz, 2),
                            calc_x=round(calc_x, 2), calc_y=round(calc_y, 2), calc_z=round(calc_z, 2),
                            ef=round(ef, 2), nf=round(nf, 2), cf=round(cf, 2),
                            et=round(et, 2), nt=round(nt, 2), ct=round(ct, 2),
                            dest=round(dist_est, 2),
                            l_scan=round(l_scan, 2)
                        )

def validate_lithology_correlation(row_dict, registrar_error, project: str = "ferrobamba"):
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

    # Configuración geológica declarativa del proyecto
    proj_cfg = get_project_geology_config(project)
    catalog = proj_cfg.get("catalog", LITHOLOGY_CLASSIFICATION)
    aliases = proj_cfg.get("aliases", {})
    intrusive_codes = proj_cfg.get("intrusive_codes", set())
    shifted_rocks = proj_cfg.get("shifted_rocks", set())
    default_endo_k = proj_cfg.get("default_endo_k", 9.87)
    overrides = proj_cfg.get("overrides", {})

    # Aplicar aliases declarativos (ej. SK -> SKARN, MZB/P -> MZB_P)
    l1_clean = aliases.get(l1_clean, l1_clean)
    l2_clean = aliases.get(l2_clean, l2_clean)
    l3_clean = aliases.get(l3_clean, l3_clean)
    u_lito_clean = aliases.get(u_lito.strip().upper(), u_lito.strip().upper()) if u_lito else ""

    group_input_norm = normalize_geological_group(u_lito_clean) if u_lito_clean else ""

    # Determinar si es Metamórfica o Endoskarn mediante roca en Lito 1 (desplazado) o Lito 2 (estándar)
    is_shifted = l1_clean in shifted_rocks
    
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
    
    # 0. Overrides específicos del proyecto
    override_key = (l1_clean, l2_clean, l3_clean)
    if override_key in overrides:
        matched_row = overrides[override_key]
    else:
        override_key2 = (eff_l2, eff_l3)
        if override_key2 in overrides:
            matched_row = overrides[override_key2]

    # Caso especial: Endoskarn (EPG, EGT o grupo explícito ENDOSKARN con roca compatible)
    if not matched_row and (eff_l2 in ["EPG", "EGT"] or (group_input_norm == "ENDOSKARN" and eff_l2 in shifted_rocks)):
        valid_endo_l1 = {"INTRUSIVO", "INTRUSIVOS", "ENDO", "ENDOSKARN"}
        if is_shifted or l1_clean in valid_endo_l1 or l1_clean in intrusive_codes or not l1_clean:
            matched_row = {"grupo": "ENDOSKARN", "lito1": "INTRUSIVO", "lito2": eff_l2, "lito3": "-", "k": default_endo_k}
            
    if not matched_row and eff_l2:
        # 1. Buscar coincidencia exacta en lito2 y lito3
        for row in catalog:
            row_l3 = row["lito3"].upper()
            norm_row_l3 = "NR" if row_l3 in ["-", "NR", ""] else row_l3
            norm_search_l3 = "NR" if eff_l3_search in ["-", "NR", ""] else eff_l3_search
            if row["lito2"].upper() == eff_l2 and norm_row_l3 == norm_search_l3:
                matched_row = row
                break
                
        # 2. Si no hay coincidencia exacta, buscar con "VARIOS"
        if not matched_row:
            for row in catalog:
                if row["lito2"].upper() == eff_l2 and row["lito3"].upper() == "VARIOS":
                    matched_row = row
                    break
                    
        # 3. Si no, buscar con "NR" o "-" fallback
        if not matched_row:
            for row in catalog:
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
                                    match_lito_column(matched_row["lito3"], l2_clean, intrusive_codes))
        else:
            if l1_clean:
                if matched_row["grupo"] == "ENDOSKARN":
                    is_valid_combination = (l1_clean in {"INTRUSIVO", "INTRUSIVOS", "ENDO", "ENDOSKARN"} or 
                                            l1_clean in intrusive_codes)
                else:
                    is_valid_combination = match_lito_column(matched_row["lito1"], l1_clean, intrusive_codes)
            else:
                is_valid_combination = True

    # Emitir alertas litológicas correspondientes
    if not is_valid_combination:
        registrar_error("Lito 1", l1, "ERR_LITOLOGIA_COMBINACION_INVALIDA", l1=l1, l2=l2, l3=l3)
    elif u_lito and matched_row:
        group_esperado = matched_row["grupo"]
        compatible_groups = GROUP_COMPATIBILITY.get(group_input_norm, {group_input_norm})
        if group_esperado not in compatible_groups and group_input_norm != group_esperado:
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
        elif matched_row is not None and is_valid_combination and matched_row.get("k") is not None:
            factor_k = matched_row["k"]
            expected_ucs = is50_val * factor_k
            if abs(ucs_val - expected_ucs) > 1.0:
                registrar_error("( UCS )  (Mpa)", ucs_val, "WRN_UCS_VS_IS50_K_DIVERGENTE", ucs_val=ucs_val, is50_val=is50_val, factor_k=factor_k, expected_ucs=expected_ucs)

