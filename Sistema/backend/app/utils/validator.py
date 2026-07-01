import os
import sys
import json
import math
import time
from datetime import datetime
import pandas as pd
import numpy as np

from app.core.catalogs import (
    NORM_GROUP_MAP, MANDATORY_COLS_COUNT,
    CONDICION_AGUA_CATALOG, RESISTENCIA_RATING_CATALOG, CONTROL_ESTRUCTURAL_CATALOG,
    EFECTOS_VOLADURA_CATALOG, RQD_RATINGS_CATALOG, ESPACIAMIENTO_R89_CATALOG,
    ESPACIAMIENTO_R76_CATALOG, TIPO_ESTRUCTURA_CATALOG, TIPO_RELLENO_CATALOG,
    RUGOSIDAD_CATALOG, FORMA_ESTRUCTURA_CATALOG, ALTERACION_CATALOG,
    LITHOLOGY_CLASSIFICATION
)

def clean_and_rename_columns(df):
    cols = []
    cota_seen, celda_seen = 0, 0
    for col in df.columns:
        col_str = str(col).strip()
        if '.' in col_str:
            parts = col_str.split('.')
            base_name = ".".join(parts[:-1]).strip()
            if base_name in ['CELDA', 'COTA'] and parts[-1].isdigit():
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
        else:
            cols.append(col_str)
    df.columns = cols
    return df

def get_row_val(row_dict, key):
    if key in row_dict:
        return row_dict[key]
    key_norm = "".join(key.split()).replace(".", "").upper()
    for k, v in row_dict.items():
        if "".join(str(k).split()).replace(".", "").upper() == key_norm:
            return v
    return None

def sanitize_value(val, target_type):
    if val is None or pd.isna(val):
        return None
    
    val_str = str(val).strip()
    val_upper = val_str.upper()
    
    if val_str == '' or val_upper in ['-1', '-1.0', 'N/A', 'NONE', 'NAN']:
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

def match_lito_column(catalog_val, input_val):
    c_val = str(catalog_val or '').strip().upper()
    i_val = str(input_val or '').strip().upper()
    if c_val == '-' or c_val == '':
        return i_val in ['', '-', 'N/A', 'NONE']
    
    # Maneja opciones múltiples separadas por '/' (ej. 'MBX / varios' o 'Intrusivo')
    options = [opt.strip() for opt in c_val.split('/')]
    for opt in options:
        if opt == 'VARIOS' or opt == 'CUALQUIERA':
            return True
        if opt == 'INTRUSIVO' and i_val in ["MZB", "MBF1", "MBF2", "MZM", "MZH", "MZD", "MZQ", "AN"]:
            return True
        if opt == i_val:
            return True
    return False

def normalize_geological_group(group_str):
    if not group_str:
        return ""
    
    # Sanitiza el texto de entrada removiendo acentos y convirtiendo a mayúsculas
    val = str(group_str).strip().upper()
    val = val.replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O").replace("Ú", "U")
    
    # Clasificación por similitud semántica geológica
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
    dip_talud = sanitize_value(get_row_val(row_dict, 'DIP_TALUD'), float)
    if dip_talud is not None and not (-90.0 <= dip_talud <= 90.0):
        registrar_error("DIP_TALUD", dip_talud, "ALERTA", f"Ángulo del talud fuera del rango [-90, 90] grados. Valor actual de DIP_TALUD: {dip_talud}°.")

def validate_geomechanical_properties(row_dict, registrar_error):
    # 1. Validación de Condición de Agua (Códigos)
    agua_76 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA  '76."), str)
    if agua_76 is not None:
        agua_76_clean = agua_76.upper()
        if agua_76_clean not in CONDICION_AGUA_CATALOG:
            registrar_error("CONDICION DE AGUA  '76.", agua_76, "ALERTA", f"Código de agua '76 no admitido. Valor ingresado: '{agua_76}'. Debe ser uno de {list(CONDICION_AGUA_CATALOG.keys())} (C, H, M, E, F).")

    agua_89 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA  '89"), str)
    if agua_89 is not None:
        agua_89_clean = agua_89.upper()
        if agua_89_clean not in CONDICION_AGUA_CATALOG:
            registrar_error("CONDICION DE AGUA  '89", agua_89, "ALERTA", f"Código de agua '89 no admitido. Valor ingresado: '{agua_89}'. Debe ser uno de {list(CONDICION_AGUA_CATALOG.keys())} (C, H, M, E, F).")

    # 2. Rating y Coherencia de Condición de Agua
    agua_val_76 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA VALOR  '76"), int)
    if agua_val_76 is not None:
        if not (0 <= agua_val_76 <= 10):
            registrar_error("CONDICION DE AGUA VALOR  '76", agua_val_76, "ALERTA", f"Valor de agua '76 excede los límites reales de la escala [0, 10]. Valor ingresado: {agua_val_76}.")
        elif agua_76 is not None and agua_76.upper() in CONDICION_AGUA_CATALOG:
            expected = CONDICION_AGUA_CATALOG[agua_76.upper()]["r76"]
            if agua_val_76 != expected:
                registrar_error("CONDICION DE AGUA VALOR  '76", agua_val_76, "ALERTA", f"Rating de agua '76 es incongruente con el código. Valor ingresado: {agua_val_76}, Código: '{agua_76}'. Se esperaba {expected} según catálogo.")
        elif agua_val_76 not in [10, 7, 4, 0]:
            registrar_error("CONDICION DE AGUA VALOR  '76", agua_val_76, "ADVERTENCIA", f"El valor de agua '76 es un valor medio no exacto. Valor ingresado: {agua_val_76}. Valores permitidos: [10, 7, 4, 0].")

    agua_val_89 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA VALOR '89"), int)
    if agua_val_89 is not None:
        if not (0 <= agua_val_89 <= 15):
            registrar_error("CONDICION DE AGUA VALOR '89", agua_val_89, "ALERTA", f"Valor de agua '89 excede los límites reales de la escala [0, 15]. Valor ingresado: {agua_val_89}.")
        elif agua_89 is not None and agua_89.upper() in CONDICION_AGUA_CATALOG:
            expected = CONDICION_AGUA_CATALOG[agua_89.upper()]["r89"]
            if agua_val_89 != expected:
                registrar_error("CONDICION DE AGUA VALOR '89", agua_val_89, "ALERTA", f"Rating de agua '89 es incongruente con el código. Valor ingresado: {agua_val_89}, Código: '{agua_89}'. Se esperaba {expected} según catálogo.")
        elif agua_val_89 not in [15, 10, 7, 4, 0]:
            registrar_error("CONDICION DE AGUA VALOR '89", agua_val_89, "ADVERTENCIA", f"El valor de agua '89 es un valor medio no exacto. Valor ingresado: {agua_val_89}. Valores permitidos: [15, 10, 7, 4, 0].")

    # 3. Dureza y Ratings de Resistencia ISRM (Tolerancia ±0.5)
    dureza_76 = sanitize_value(get_row_val(row_dict, "DUREZA  '76"), str)
    if dureza_76 is not None:
        dureza_76_clean = dureza_76.upper()
        if dureza_76_clean not in RESISTENCIA_RATING_CATALOG:
            registrar_error("DUREZA  '76", dureza_76, "ALERTA", f"Dureza '76 '{dureza_76}' no admitida. Debe ser R0 a R6.")

    dureza_val_76 = sanitize_value(get_row_val(row_dict, "RESISTENCIA ESTIMADA VALOR  '76"), float)
    if dureza_val_76 is not None:
        if not (0 <= dureza_val_76 <= 15):
            registrar_error("RESISTENCIA ESTIMADA VALOR  '76", dureza_val_76, "ALERTA", f"Rating de resistencia '76 fuera del límite real [0, 15]. Valor ingresado: {dureza_val_76}.")
        elif dureza_76 is not None and dureza_76.upper() in RESISTENCIA_RATING_CATALOG:
            expected = RESISTENCIA_RATING_CATALOG[dureza_76.upper()]["r76"]
            if abs(dureza_val_76 - expected) > 0.5:
                registrar_error("RESISTENCIA ESTIMADA VALOR  '76", dureza_val_76, "ALERTA", f"Resistencia '76 es incongruente con la dureza. Valor ingresado: {dureza_val_76}, Dureza: '{dureza_76}'. Se esperaba {expected} (Tolerancia ±0.5).")
        elif not is_within_tolerance(dureza_val_76, [0, 1, 2, 4, 7, 12, 15], 0.5):
            registrar_error("RESISTENCIA ESTIMADA VALOR  '76", dureza_val_76, "ADVERTENCIA", f"Puntaje de resistencia '76 es un valor alejado no válido. Valor ingresado: {dureza_val_76}. Valores discretos estándar: [0, 1, 2, 4, 7, 12, 15].")

    dureza_89 = sanitize_value(get_row_val(row_dict, "DUREZA '89"), str)
    if dureza_89 is not None:
        dureza_89_clean = dureza_89.upper()
        if dureza_89_clean not in RESISTENCIA_RATING_CATALOG:
            registrar_error("DUREZA '89", dureza_89, "ALERTA", f"Dureza '89 '{dureza_89}' no admitida. Debe ser R0 a R6.")

    dureza_val_89 = sanitize_value(get_row_val(row_dict, "RESISTENCIA ESTIMADA VALOR '89"), float)
    if dureza_val_89 is not None:
        if not (0 <= dureza_val_89 <= 15):
            registrar_error("RESISTENCIA ESTIMADA VALOR '89", dureza_val_89, "ALERTA", f"Rating de resistencia '89 fuera del límite real [0, 15]. Valor ingresado: {dureza_val_89}.")
        elif dureza_89 is not None and dureza_89.upper() in RESISTENCIA_RATING_CATALOG:
            expected = RESISTENCIA_RATING_CATALOG[dureza_89.upper()]["r89"]
            if abs(dureza_val_89 - expected) > 0.5:
                registrar_error("RESISTENCIA ESTIMADA VALOR '89", dureza_val_89, "ALERTA", f"Resistencia '89 es incongruente con la dureza. Valor ingresado: {dureza_val_89}, Dureza: '{dureza_89}'. Se esperaba {expected} (Tolerancia ±0.5).")
        elif not is_within_tolerance(dureza_val_89, [0, 1, 2, 4, 7, 12, 15], 0.5):
            registrar_error("RESISTENCIA ESTIMADA VALOR '89", dureza_val_89, "ADVERTENCIA", f"Puntaje de resistencia '89 es un valor alejado no válido. Valor ingresado: {dureza_val_89}. Valores discretos estándar: [0, 1, 2, 4, 7, 12, 15].")

    # 4. Control Estructural [1, 5]
    ctrl_76 = sanitize_value(get_row_val(row_dict, "CONTROL ESTRUCTURAL  '76"), int)
    if ctrl_76 is not None and ctrl_76 not in CONTROL_ESTRUCTURAL_CATALOG:
        registrar_error("CONTROL ESTRUCTURAL  '76", ctrl_76, "ALERTA", f"Control estructural '76 fuera de límites permitidos [1, 5]. Valor ingresado: {ctrl_76}.")
    ctrl_89 = sanitize_value(get_row_val(row_dict, "CONTROL ESTRUCTURAL '89"), int)
    if ctrl_89 is not None and ctrl_89 not in CONTROL_ESTRUCTURAL_CATALOG:
        registrar_error("CONTROL ESTRUCTURAL '89", ctrl_89, "ALERTA", f"Control estructural '89 fuera de límites permitidos [1, 5]. Valor ingresado: {ctrl_89}.")

    # 5. Efectos de Voladura [1, 6]
    vol_76 = sanitize_value(get_row_val(row_dict, "EFECTOS DE VOLADURA  '76"), int)
    if vol_76 is not None:
        if not (1 <= vol_76 <= 6):
            registrar_error("EFECTOS DE VOLADURA  '76", vol_76, "ALERTA", f"Efecto de voladura '76 excede los límites de la escala [1, 6]. Valor ingresado: {vol_76}.")
        elif vol_76 not in EFECTOS_VOLADURA_CATALOG:
            registrar_error("EFECTOS DE VOLADURA  '76", vol_76, "ADVERTENCIA", f"Puntaje de efectos de voladura '76 es un valor medio no exacto. Valor ingresado: {vol_76}. Se sugieren los valores estándar de catálogo: {EFECTOS_VOLADURA_CATALOG}.")

    vol_89 = sanitize_value(get_row_val(row_dict, "EFECTOS DE VOLADURA '89"), int)
    if vol_89 is not None:
        if not (1 <= vol_89 <= 6):
            registrar_error("EFECTOS DE VOLADURA '89", vol_89, "ALERTA", f"Efecto de voladura '89 excede los límites de la escala [1, 6]. Valor ingresado: {vol_89}.")
        elif vol_89 not in EFECTOS_VOLADURA_CATALOG:
            registrar_error("EFECTOS DE VOLADURA '89", vol_89, "ADVERTENCIA", f"Puntaje de efectos de voladura '89 es un valor medio no exacto. Valor ingresado: {vol_89}. Se sugieren los valores estándar de catálogo: {EFECTOS_VOLADURA_CATALOG}.")

    # 6. RQD Ratings por umbral discreto (Tolerancia ±1.5)
    rqd_val_76 = sanitize_value(get_row_val(row_dict, "RQD - VALOR  '76"), float)
    if rqd_val_76 is not None:
        if not is_within_tolerance(rqd_val_76, [3, 8, 13, 17, 20], 1.5):
            registrar_error("RQD - VALOR  '76", rqd_val_76, "ADVERTENCIA", f"Puntaje de RQD '76 es un valor alejado no válido. Valor ingresado: {rqd_val_76}. Valores de catálogo esperados: [3, 8, 13, 17, 20].")

    rqd_val_89 = sanitize_value(get_row_val(row_dict, "RQD - VALOR '89"), float)
    if rqd_val_89 is not None:
        if not is_within_tolerance(rqd_val_89, [3, 8, 13, 17, 20], 1.5):
            registrar_error("RQD - VALOR '89", rqd_val_89, "ADVERTENCIA", f"Puntaje de RQD '89 es un valor alejado no válido. Valor ingresado: {rqd_val_89}. Valores de catálogo esperados: [3, 8, 13, 17, 20].")

    # 7. Porcentaje de RQD (Límite físico del 100%)
    rqd_76 = sanitize_value(get_row_val(row_dict, "RQD  '76"), float)
    if rqd_76 is not None and rqd_76 > 100.0:
        registrar_error("RQD  '76", rqd_76, "ALERTA", f"Porcentaje de RQD '76 no puede ser superior al 100%. Porcentaje actual: {rqd_76}%.")
    rqd_89 = sanitize_value(get_row_val(row_dict, "RQD '89"), float)
    if rqd_89 is not None and rqd_89 > 100.0:
        registrar_error("RQD '89", rqd_89, "ALERTA", f"Porcentaje de RQD '89 no puede ser superior al 100%. Porcentaje actual: {rqd_89}%.")

    # 8. Espaciamiento Promedio y Coherencia de Ratings
    espac_prom_76 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO PROMEDIO   '76"), float)
    espac_val_76 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO - VALOR    '76"), float) # Toleramos decimales

    if espac_prom_76 is not None:
        if espac_prom_76 < 0:
            registrar_error("ESPACIAMIENTO PROMEDIO   '76", espac_prom_76, "ALERTA", f"El espaciamiento promedio '76 no puede ser negativo. Valor ingresado: {espac_prom_76} m.")
        elif espac_prom_76 == 0:
            registrar_error("ESPACIAMIENTO PROMEDIO   '76", espac_prom_76, "ALERTA", f"Inconsistencia: El espaciamiento promedio '76 es de 0.0 m (debe ser mayor a cero).")

    if espac_val_76 is not None:
        if not (5.0 <= espac_val_76 <= 30.0):
            registrar_error("ESPACIAMIENTO - VALOR    '76", espac_val_76, "ALERTA", f"Valor de rating de espaciamiento '76 fuera del rango [5, 30]. Valor ingresado: {espac_val_76}.")
        elif espac_val_76 % 1 == 0:  # Validar límites discretos tradicionales de catálogo únicamente si no tiene decimales
            val_int = int(espac_val_76)
            if val_int not in [5, 10, 20, 25, 30]:
                registrar_error("ESPACIAMIENTO - VALOR    '76", espac_val_76, "ADVERTENCIA", f"Puntaje de espaciamiento '76 es un valor medio no exacto. Valor ingresado: {val_int}. Valores de catálogo estándar: [5, 10, 20, 25, 30].")
            elif espac_prom_76 is not None and espac_prom_76 > 0:
                if espac_prom_76 < 0.05: expected = 5
                elif espac_prom_76 < 0.3: expected = 10
                elif espac_prom_76 < 1.0: expected = 20
                elif espac_prom_76 < 3.0: expected = 25
                else: expected = 30
                if val_int != expected:
                    registrar_error("ESPACIAMIENTO - VALOR    '76", espac_val_76, "ALERTA", f"Rating de espaciamiento '76 no se alinea con el promedio. Valor ingresado: {val_int}, Espaciamiento promedio: {espac_prom_76} m. Se esperaba {expected} según la escala discreta R76.")

    espac_prom_89 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO PROMEDIO '89"), float)
    espac_val_89 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO - VALOR '89"), float) # Toleramos decimales

    if espac_prom_89 is not None:
        if espac_prom_89 < 0:
            registrar_error("ESPACIAMIENTO PROMEDIO '89", espac_prom_89, "ALERTA", f"El espaciamiento promedio '89 no puede ser negativo. Valor ingresado: {espac_prom_89} m.")
        elif espac_prom_89 == 0:
            registrar_error("ESPACIAMIENTO PROMEDIO '89", espac_prom_89, "ALERTA", f"Inconsistencia: El espaciamiento promedio '89 es de 0.0 m (debe ser mayor a cero).")

    if espac_val_89 is not None:
        if not (5.0 <= espac_val_89 <= 20.0):
            registrar_error("ESPACIAMIENTO - VALOR '89", espac_val_89, "ALERTA", f"Valor de rating de espaciamiento '89 fuera del rango [5, 20]. Valor ingresado: {espac_val_89}.")
        elif espac_val_89 % 1 == 0:  # Validar límites discretos tradicionales de catálogo únicamente si no tiene decimales
            val_int = int(espac_val_89)
            if val_int not in [5, 8, 10, 15, 20]:
                registrar_error("ESPACIAMIENTO - VALOR '89", espac_val_89, "ADVERTENCIA", f"Puntaje de espaciamiento '89 es un valor medio no exacto. Valor ingresado: {val_int}. Valores de catálogo estándar: [5, 8, 10, 15, 20].")
            elif espac_prom_89 is not None and espac_prom_89 > 0:
                if espac_prom_89 < 0.06: expected = 5
                elif espac_prom_89 < 0.2: expected = 8
                elif espac_prom_89 < 0.6: expected = 10
                elif espac_prom_89 < 2.0: expected = 15
                else: expected = 20
                if val_int != expected:
                    registrar_error("ESPACIAMIENTO - VALOR '89", espac_val_89, "ALERTA", f"Rating de espaciamiento '89 no se alinea con el promedio esperado. Valor ingresado: {val_int}, Espaciamiento promedio: {espac_prom_89} m. Se esperaba {expected} según la escala discreta R89.")

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
                registrar_error("TIPO", tipo_junta, "ADVERTENCIA", "Tipo de estructura geológica 'J' sugerida a normalizar por 'JN' según catálogo estándar. Código ingresado: 'J'.")
            else:
                registrar_error("TIPO", tipo_junta, "ALERTA", f"Tipo de estructura geológica no permitida. Valor ingresado: '{tipo_junta}'. Debe ser uno de {TIPO_ESTRUCTURA_CATALOG}.")

    # 2. Rellenos de junta (Opcionales)
    rel1 = sanitize_value(get_row_val(row_dict, "TIPO DE  RELLENO 1"), str)
    if rel1 is not None:
        rel1_clean = rel1.strip().lower()
        if rel1_clean not in TIPO_RELLENO_CATALOG:
            registrar_error("TIPO DE  RELLENO 1", rel1, "ALERTA", f"Tipo de relleno no pertenece al catálogo. Relleno 1 ingresado: '{rel1}'. Catálogo permitido: {TIPO_RELLENO_CATALOG}.")
        
    rel2 = sanitize_value(get_row_val(row_dict, "TIPO DE  RELLENO 2"), str)
    if rel2 is not None:
        rel2_clean = rel2.strip().lower()
        if rel2_clean not in TIPO_RELLENO_CATALOG:
            registrar_error("TIPO DE  RELLENO 2", rel2, "ALERTA", f"Tipo de relleno no pertenece al catálogo. Relleno 2 ingresado: '{rel2}'. Catálogo permitido: {TIPO_RELLENO_CATALOG}.")

    # 3. JRC [0, 20]
    jrc_val = sanitize_value(get_row_val(row_dict, "JRC"), int)
    if jrc_val is not None and not (0 <= jrc_val <= 20):
        registrar_error("JRC", jrc_val, "ALERTA", f"Valor JRC fuera de rango permitido [0, 20]. Valor ingresado: {jrc_val}.")

    # 4. Clase de Rugosidad ISRM [1, 9]
    rug_val = sanitize_value(get_row_val(row_dict, "RUGOSIDAD DE ESTRUCTURAS"), int)
    if rug_val is not None and rug_val not in RUGOSIDAD_CATALOG:
        registrar_error("RUGOSIDAD DE ESTRUCTURAS", rug_val, "ALERTA", f"Clase de rugosidad de junta fuera de límites [1, 9]. Valor ingresado: {rug_val}.")

    # 5. Forma de estructura
    forma_estrucs = sanitize_value(get_row_val(row_dict, "FORMA DE ESTRUCTURA"), str)
    if forma_estrucs is not None:
        forma_estrucs_clean = forma_estrucs.strip().upper()
        if forma_estrucs_clean not in FORMA_ESTRUCTURA_CATALOG:
            registrar_error("FORMA DE ESTRUCTURA", forma_estrucs, "ALERTA", f"Forma de estructura inválida. Debe ser P, C, O, E o I. Valor ingresado: '{forma_estrucs}'.")

    # 6. Alteración de Pared de Junta
    alt_pared = sanitize_value(get_row_val(row_dict, "ALTERACION"), str)
    if alt_pared is not None:
        alt_pared_clean = alt_pared.strip().lower()
        if alt_pared_clean not in ALTERACION_CATALOG:
            registrar_error("ALTERACION", alt_pared, "ALERTA", f"Código de alteración inválido. Código ingresado: '{alt_pared}'. Debe ser uno de {ALTERACION_CATALOG}.")

    # 7. Espesor y Abertura (Inconsistencia física y validaciones de negativos)
    espesor = sanitize_value(get_row_val(row_dict, "ESPESOR mm."), float)
    abertura = sanitize_value(get_row_val(row_dict, "ABERTURA mm."), float)

    # Estructuras exceptuadas explícitamente de la regla de espesor vs abertura
    tipo_junta_clean = tipo_junta.strip().upper() if tipo_junta is not None else ""
    es_estructura_exceptuada = tipo_junta_clean in ['F', 'RF', 'VN', 'SZ', 'F+10', 'BED']

    # Validar que no sean valores negativos
    if espesor is not None and espesor < 0:
        registrar_error("ESPESOR mm.", espesor, "ALERTA", f"El espesor del relleno no puede ser un valor negativo. Valor ingresado: {espesor} mm.")
    if abertura is not None and abertura < 0:
        registrar_error("ABERTURA mm.", abertura, "ALERTA", f"La abertura total no puede ser un valor negativo. Valor ingresado: {abertura} mm.")

    # Si el espesor supera a la abertura, lanzamos ALERTA excepto si es una de las estructuras exceptuadas
    if espesor is not None and abertura is not None and espesor > abertura:
        if not es_estructura_exceptuada:
            registrar_error("ESPESOR mm.", espesor, "ALERTA", f"Espesor del relleno es superior a la abertura total y no pertenece a F, RF, VN, SZ, F+10, BED. Estructura geológica: '{tipo_junta_clean or 'N/A'}', Espesor: {espesor} mm, Abertura total: {abertura} mm.")


    # 8. Comprobaciones de escala física de la abertura
    if abertura is not None:
        
        if es_estructura_exceptuada:
            if dist_celda is not None and (abertura / 1000.0) > dist_celda:
                registrar_error("ABERTURA mm.", abertura, "ALERTA", f"La abertura de la falla supera la longitud de la celda y no pertenece a F, RF, VN, SZ, F+10, BED. Tipo de junta: '{tipo_junta_clean}', Abertura: {abertura} mm, Longitud de la celda (Dist.Celda): {dist_celda} m.")

    # 9. Persistencia de discontinuidad (Continuidad física vs celda - ERROR DE SUPERACIÓN ELIMINADO)
    cont_junta = sanitize_value(get_row_val(row_dict, "CONTINUIDAD m."), float)
    if cont_junta is not None:
        if cont_junta < 0:
            registrar_error("CONTINUIDAD m.", cont_junta, "ALERTA", f"La persistencia de discontinuidad (continuidad) no puede ser un valor negativo. Valor ingresado: {cont_junta} m.")
        if cont_junta > 25.0:
            registrar_error("CONTINUIDAD m.", cont_junta, "ADVERTENCIA", f"La persistencia es superior a 25 metros. Valor ingresado: {cont_junta} m.")

    # 10. Espaciamiento de discontinuidad estructural
    espac_struct = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO m."), float)
    if espac_struct is not None and espac_struct < 0:
        registrar_error("ESPACIAMIENTO m.", espac_struct, "ALERTA", f"El espaciamiento de discontinuidad no puede ser un valor negativo. Valor ingresado: {espac_struct} m.")

    # 11. Inclinación y Dirección de Estructura (Rangos geográficos reales de orientación)
    dip_estruc = sanitize_value(get_row_val(row_dict, 'DIP'), float)
    if dip_estruc is not None and not (-90.0 <= dip_estruc <= 90.0):
        registrar_error("DIP", dip_estruc, "ALERTA", f"Valor de inclinación (Dip) fuera de rango permitido [-90, 90] grados. Valor ingresado: {dip_estruc}°.")

    dipdir_estruc = sanitize_value(get_row_val(row_dict, 'DIP DIR'), float)
    if dipdir_estruc is not None and not (0.0 <= dipdir_estruc <= 360.0):
        registrar_error("DIP DIR", dipdir_estruc, "ALERTA", f"Valor de dirección de inclinación (Dip Direction) fuera de rango permitido [0, 360] grados. Valor ingresado: {dipdir_estruc}°.")

    # 12. Consistencia en conteo de estructuras estructurales (Debe ser un valor discreto)
    num_estrucs = sanitize_value(get_row_val(row_dict, "NUMERO DE ESTRUCTURAS") or get_row_val(row_dict, "N_ESTRUCTURAS"), float)
    if num_estrucs is not None:
        if num_estrucs % 1 != 0:
            registrar_error("NUMERO DE ESTRUCTURAS", num_estrucs, "ALERTA", f"En número de estructuras solamente se permiten números enteros. Valor ingresado: {num_estrucs}.")

def validate_lithology_correlation(row_dict, registrar_error):
    l1 = sanitize_value(get_row_val(row_dict, "Lito 1"), str)
    l2 = sanitize_value(get_row_val(row_dict, "Lito 2"), str)
    l3 = sanitize_value(get_row_val(row_dict, "Lito 3"), str)
    u_lito = sanitize_value(get_row_val(row_dict, "Unidad Litologica"), str)
    
    matched_row = None
    if all(v is not None for v in [l1, l2, l3, u_lito]):
        l1_clean = l1.strip().upper()
        l2_clean = l2.strip().upper()
        l3_clean = l3.strip().upper() if l3 else ""
        
        # Normalización robusta para evitar errores por variaciones de ingreso de texto ('Sedimentaria', 'Roca metamórfica', etc.)
        group_input_norm = normalize_geological_group(u_lito)

        # --- REGLA LITOLÓGICA DE ENDOSKARN MEJORADA ---
        if group_input_norm == "ENDOSKARN":
            intrusivos_l1 = ["MZB", "MBF1", "MBF2", "MZM", "MZH", "MZD", "MZQ", "AN"]
            l1_ok = l1_clean in intrusivos_l1
            l2_ok = l2_clean in ["EPG", "EGT"]
            l3_ok = True
            
            if l1_ok and l2_ok:
                matched_row = {"grupo": "ENDOSKARN", "lito1": l1_clean, "lito2": l2_clean, "lito3": l3_clean, "k": 9.87}
        else:
            for row in LITHOLOGY_CLASSIFICATION:
                l1_ok = match_lito_column(row["lito1"], l1_clean)
                l2_ok = match_lito_column(row["lito2"], l2_clean)
                l3_ok = match_lito_column(row["lito3"], l3_clean)
                if l1_ok and l2_ok and l3_ok:
                    matched_row = row
                    break
                
        if not matched_row:
            registrar_error("Lito 1", l1, "ALERTA", f"Combinación litológica Lito 1-2-3 inválida según el catálogo. Litologías ingresadas -> Lito 1: '{l1}', Lito 2: '{l2}', Lito 3: '{l3}'.")
        else:
            group_esperado = matched_row["grupo"]
            if group_input_norm != group_esperado:
                registrar_error("Unidad Litologica", u_lito, "ALERTA", f"Unidad litológica es incongruente con la litología. Unidad ingresada: '{u_lito}'. Se esperaba la unidad geológica '{group_esperado}' basada en la litología.")

    # 13. Resistencia Uniaxial UCS vs Resistencia de Carga Puntual (Is50)
    ucs_val = sanitize_value(get_row_val(row_dict, "( UCS )  (Mpa)"), float)
    is50_val = sanitize_value(get_row_val(row_dict, "is50 (Mpa)"), float)
    if ucs_val is not None and is50_val is not None:
        if ucs_val <= is50_val:
            registrar_error("( UCS )  (Mpa)", ucs_val, "ALERTA", f"UCS debe ser mayor a Is50. UCS ingresado: {ucs_val} MPa, Is50 ingresado: {is50_val} MPa.")
        
        if matched_row is not None:
            factor_k = matched_row["k"]
            expected_ucs = is50_val * factor_k
            if abs(ucs_val - expected_ucs) > 1.0:
                registrar_error("( UCS )  (Mpa)", ucs_val, "ADVERTENCIA", f"Divergencia de resistencia uniaxial (UCS vs Is50 * K). UCS ingresado: {ucs_val} MPa, Is50 ingresado: {is50_val} MPa, factor K asociado: {factor_k}, UCS esperado (Is50 * K): {expected_ucs:.2f} MPa.")

def validate_bulk_excel(file_path, output_json_path):
    print(f"[*] Leyendo archivo Excel: {file_path}")
    try: df = pd.read_excel(file_path, engine='openpyxl')
    except Exception as e:
        print(f"[-] Error al abrir el archivo Excel: {e}")
        sys.exit(1)
        
    df = clean_and_rename_columns(df)
    
    # Propagación ffill sobre columnas de cabecera
    propagate_cols = [
        'CELDA_PADRE', 'ESTE_FROM', 'NORTE_FROM', 'COTA_FROM', 'ESTE_TO', 'NORTE_TO', 
        'COTA_TO', 'Dist.Celda', 'Altura', 'DIP', 'AZ_HOLE', 'DIP_TALUD', 'DIP DIR_TALUD', 
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
    if 'CELDA_PADRE' in df.columns:
        # Paso 1: Propagar la columna de control 'CELDA_PADRE' globalmente para asignar la estación a cada fila
        df['CELDA_PADRE'] = df['CELDA_PADRE'].replace([-1, -1.0, '-1', '-1.0'], np.nan)
        df['CELDA_PADRE'] = df['CELDA_PADRE'].ffill()
        
        # Paso 2: Sanitizar el resto de columnas de cabecera colocándolas en NaN si vienen como -1
        for col in propagate_cols:
            if col in df.columns and col != 'CELDA_PADRE':
                df[col] = df[col].replace([-1, -1.0, '-1', '-1.0'], np.nan)
        
        # Paso 3: Propagar el resto de cabeceras de forma aislada agrupando por la 'CELDA_PADRE' ya poblada
        cols_to_fill = [c for c in propagate_cols if c in df.columns and c != 'CELDA_PADRE']
        df[cols_to_fill] = df.groupby('CELDA_PADRE')[cols_to_fill].ffill()

    records = df.to_dict(orient='records')
    incidencias, resumen_celdas = [], {}
    total_filas = len(records)
    total_vacios, total_advertencias, total_alertas, total_ok = 0, 0, 0, 0
    filas_por_campana, filas_por_geotecnico = {}, {}
    vacios_por_campana, vacios_por_geotecnico = {}, {}
    current_parent, daughter_counter = None, 0

    for idx, row_dict in enumerate(records):
        fila_excel = idx + 2 
        celda_padre = sanitize_value(get_row_val(row_dict, 'CELDA_PADRE'), str)
        if not celda_padre:
            incidencias.append({
                "fila_excel": fila_excel, "celda_padre": "N/A", "celda_hija": "N/A",
                "columna": "CELDA_PADRE", "valor_actual": None, "tipo_incidencia": "ALERTA",
                "mensaje": "La fila no posee una estación de mapeo válida asociada."
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

        if camp: 
            filas_por_campana[str(camp)] = filas_por_campana.get(str(camp), 0) + 1
        if geo: 
            filas_por_geotecnico[geo] = filas_por_geotecnico.get(geo, 0) + 1

        if celda_padre not in resumen_celdas:
            resumen_celdas[celda_padre] = {
                "total_hijas": 0,
                "vacios": 0,
                "advertencias": 0,
                "alertas": 0,
                "estado_celda": "OK",
                "dist_celda": dist_celda if dist_celda is not None else 0.0,
                "campania": str(camp) if camp else "N/A"
            }

        if celda_padre != current_parent:
            current_parent, daughter_counter = celda_padre, 1
        else:
            daughter_counter += 1

        celda_hija = f"{celda_padre}-{daughter_counter}"
        resumen_celdas[celda_padre]["total_hijas"] += 1
        row_has_errors = False

        def registrar_error(col, val, tipo, msg):
            nonlocal row_has_errors, total_vacios, total_advertencias, total_alertas
            incidencias.append({
                "fila_excel": fila_excel, "celda_padre": celda_padre, "celda_hija": celda_hija,
                "columna": col, "valor_actual": val, "tipo_incidencia": tipo, "mensaje": msg,
                "campania": str(camp) if camp else "N/A", "geotecnico": geo if geo else "N/A", "sector_geotecnico": sector
            })
            if tipo == "VACIO":
                total_vacios += 1
                resumen_celdas[celda_padre]["vacios"] += 1
                if camp: vacios_por_campana[str(camp)] = vacios_por_campana.get(str(camp), 0) + 1
                if geo: vacios_por_geotecnico[geo] = vacios_por_geotecnico.get(geo, 0) + 1
            elif tipo == "ADVERTENCIA":
                total_advertencias += 1
                resumen_celdas[celda_padre]["advertencias"] += 1
            elif tipo == "ALERTA":
                total_alertas += 1
                resumen_celdas[celda_padre]["alertas"] += 1
                row_has_errors = True

        # 1. Validar campos obligatorios vacíos (RELLENO 2 es OPCIONAL)
        for col_key in df.columns:
            if col_key in ['COMENTARIO', 'CELDA_DUPLICADA_IGNORE', 'TIPO DE  RELLENO 2', 'TIPO DE RELLENO 2']: continue
            v = sanitize_value(row_dict.get(col_key), str)
            if v is None: 
                registrar_error(col_key, None, "VACIO", f"Campo obligatorio se encuentra vacío. Columna: '{col_key}'.")

        # 2. Desglose de validaciones estructuradas
        validate_geotechnical_header(row_dict, registrar_error)
        validate_geomechanical_properties(row_dict, registrar_error)
        validate_structural_row(row_dict, dist_celda, registrar_error)
        validate_lithology_correlation(row_dict, registrar_error)

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