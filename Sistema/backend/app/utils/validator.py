# app/utils/validator.py
import os
import sys
import json
import math
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
    key_norm = "".join(key.split()).upper()
    for k, v in row_dict.items():
        if "".join(str(k).split()).upper() == key_norm:
            return v
    return None

def sanitize_value(val, target_type):
    if val is None or pd.isna(val):
        return None
    val_str = str(val).strip()
    if val_str in ['', '-1', '-1.0']:
        return None
    try: return target_type(val)
    except (ValueError, TypeError): return None

# --- FUNCIONES AUXILIARES DE COINCIDENCIA DE LITOLOGÍAS ---

def match_lito_column(catalog_val, input_val):
    c_val = str(catalog_val or '').strip().upper()
    i_val = str(input_val or '').strip().upper()
    if c_val == 'VARIOS':
        return True
    if c_val == '-' or c_val == '':
        return i_val in ['', '-', 'N/A', 'NONE']
    if c_val == 'INTRUSIVO':
        # Grupo intrusivo válido si pertenece al catálogo de intrusivos
        return i_val in ["MZB", "MBF1", "MBF2", "MZM", "MZH", "MZD", "MZQ", "AN"]
    return c_val == i_val

# --- SEGMENTACIÓN DE COMPROBACIONES DE INTEGRIDAD ---

def validate_geotechnical_header(row_dict, registrar_error):
    # Dip_Talud: rango entre -90 y 90 (Alerta)
    dip_talud = sanitize_value(get_row_val(row_dict, 'DIP_TALUD'), float)
    if dip_talud is not None and not (-90.0 <= dip_talud <= 90.0):
        registrar_error("DIP_TALUD", dip_talud, "ALERTA", "Ángulo del talud fuera del rango [-90, 90] grados.")

    # Altura de celda: límite máximo de 30 metros (Alerta)
    altura_celda = sanitize_value(get_row_val(row_dict, 'Altura'), float)
    if altura_celda is not None and altura_celda > 30.0:
        registrar_error("Altura", altura_celda, "ALERTA", "Altura de la celda de estación excede el límite máximo de 30 metros.")

def validate_geomechanical_properties(row_dict, registrar_error):
    # 1. Validación de Condición de Agua (Códigos)
    agua_76 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA  '76."), str)
    if agua_76 is not None:
        agua_76_up = agua_76.upper()
        if agua_76_up not in CONDICION_AGUA_CATALOG:
            registrar_error("CONDICION DE AGUA  '76.", agua_76, "ALERTA", f"Código de agua '76 '{agua_76}' no admitido. Debe ser C, H, M, E o F.")

    agua_89 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA  '89"), str)
    if agua_89 is not None:
        agua_89_up = agua_89.upper()
        if agua_89_up not in CONDICION_AGUA_CATALOG:
            registrar_error("CONDICION DE AGUA  '89", agua_89, "ALERTA", f"Código de agua '89 '{agua_89}' no admitido. Debe ser C, H, M, E o F.")

    # 2. Validación de Ratings de Condición de Agua (Con advertencias de valor medio)
    agua_val_76 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA VALOR  '76"), int)
    if agua_val_76 is not None:
        if not (0 <= agua_val_76 <= 10):
            registrar_error("CONDICION DE AGUA VALOR  '76", agua_val_76, "ALERTA", "Valor de agua '76 excede los límites reales de la escala [0, 10].")
        elif agua_76 is not None and agua_76.upper() in CONDICION_AGUA_CATALOG:
            expected = CONDICION_AGUA_CATALOG[agua_76.upper()]["r76"]
            if agua_val_76 != expected:
                registrar_error("CONDICION DE AGUA VALOR  '76", agua_val_76, "ALERTA", f"Rating de agua '76 ({agua_val_76}) es incongruente con el código '{agua_76}'. Se esperaba {expected}.")
        elif agua_val_76 not in [10, 7, 4, 0]:
            registrar_error("CONDICION DE AGUA VALOR  '76", agua_val_76, "ADVERTENCIA", f"El valor de agua '76 ({agua_val_76}) es un valor medio no exacto.")

    agua_val_89 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA VALOR '89"), int)
    if agua_val_89 is not None:
        if not (0 <= agua_val_89 <= 15):
            registrar_error("CONDICION DE AGUA VALOR '89", agua_val_89, "ALERTA", "Valor de agua '89 excede los límites reales de la escala [0, 15].")
        elif agua_89 is not None and agua_89.upper() in CONDICION_AGUA_CATALOG:
            expected = CONDICION_AGUA_CATALOG[agua_89.upper()]["r89"]
            if agua_val_89 != expected:
                registrar_error("CONDICION DE AGUA VALOR '89", agua_val_89, "ALERTA", f"Rating de agua '89 ({agua_val_89}) es incongruente con el código '{agua_89}'. Se esperaba {expected}.")
        elif agua_val_89 not in [15, 10, 7, 4, 0]:
            registrar_error("CONDICION DE AGUA VALOR '89", agua_val_89, "ADVERTENCIA", f"El valor de agua '89 ({agua_val_89}) es un valor medio no exacto.")

    # 3. Validación de Dureza y Resistencia ISRM (Con advertencias de valor medio)
    dureza_76 = sanitize_value(get_row_val(row_dict, "DUREZA  '76"), str)
    if dureza_76 is not None:
        dureza_76_up = dureza_76.upper()
        if dureza_76_up not in RESISTENCIA_RATING_CATALOG:
            registrar_error("DUREZA  '76", dureza_76, "ALERTA", f"Dureza '76 '{dureza_76}' no admitida. Debe ser R0 a R6.")

    dureza_val_76 = sanitize_value(get_row_val(row_dict, "RESISTENCIA ESTIMADA VALOR  '76"), int)
    if dureza_val_76 is not None:
        if not (0 <= dureza_val_76 <= 15):
            registrar_error("RESISTENCIA ESTIMADA VALOR  '76", dureza_val_76, "ALERTA", "Rating de resistencia '76 fuera del límite real [0, 15].")
        elif dureza_76 is not None and dureza_76.upper() in RESISTENCIA_RATING_CATALOG:
            expected = RESISTENCIA_RATING_CATALOG[dureza_76.upper()]["r76"]
            if dureza_val_76 != expected:
                registrar_error("RESISTENCIA ESTIMADA VALOR  '76", dureza_val_76, "ALERTA", f"Resistencia '76 ({dureza_val_76}) es incongruente con la dureza '{dureza_76}'. Se esperaba {expected}.")
        elif dureza_val_76 not in [15, 12, 7, 4, 2, 1, 0]:
            registrar_error("RESISTENCIA ESTIMADA VALOR  '76", dureza_val_76, "ADVERTENCIA", f"Puntaje de resistencia '76 ({dureza_val_76}) es un valor medio no exacto.")

    dureza_89 = sanitize_value(get_row_val(row_dict, "DUREZA '89"), str)
    if dureza_89 is not None:
        dureza_89_up = dureza_89.upper()
        if dureza_89_up not in RESISTENCIA_RATING_CATALOG:
            registrar_error("DUREZA '89", dureza_89, "ALERTA", f"Dureza '89 '{dureza_89}' no admitida. Debe ser R0 a R6.")

    dureza_val_89 = sanitize_value(get_row_val(row_dict, "RESISTENCIA ESTIMADA VALOR '89"), int)
    if dureza_val_89 is not None:
        if not (0 <= dureza_val_89 <= 15):
            registrar_error("RESISTENCIA ESTIMADA VALOR '89", dureza_val_89, "ALERTA", "Rating de resistencia '89 fuera del límite real [0, 15].")
        elif dureza_89 is not None and dureza_89.upper() in RESISTENCIA_RATING_CATALOG:
            expected = RESISTENCIA_RATING_CATALOG[dureza_89.upper()]["r89"]
            if dureza_val_89 != expected:
                registrar_error("RESISTENCIA ESTIMADA VALOR '89", dureza_val_89, "ALERTA", f"Resistencia '89 ({dureza_val_89}) es incongruente con la dureza '{dureza_89}'. Se esperaba {expected}.")
        elif dureza_val_89 not in [15, 12, 7, 4, 2, 1, 0]:
            registrar_error("RESISTENCIA ESTIMADA VALOR '89", dureza_val_89, "ADVERTENCIA", f"Puntaje de resistencia '89 ({dureza_val_89}) es un valor medio no exacto.")

    # 4. Control Estructural [1, 2, 3, 4, 5] (Es entero estricto de catálogo)
    ctrl_76 = sanitize_value(get_row_val(row_dict, "CONTROL ESTRUCTURAL  '76"), int)
    if ctrl_76 is not None and ctrl_76 not in CONTROL_ESTRUCTURAL_CATALOG:
        registrar_error("CONTROL ESTRUCTURAL  '76", ctrl_76, "ALERTA", "Control estructural '76 fuera de límites permitidos [1, 5].")
    ctrl_89 = sanitize_value(get_row_val(row_dict, "CONTROL ESTRUCTURAL '89"), int)
    if ctrl_89 is not None and ctrl_89 not in CONTROL_ESTRUCTURAL_CATALOG:
        registrar_error("CONTROL ESTRUCTURAL '89", ctrl_89, "ALERTA", "Control estructural '89 fuera de límites permitidos [1, 5].")

    # 5. Efectos de Voladura [1, 2, 3, 5, 6] (Omitir 4, Advertencia si es 4, Alerta si está fuera)
    vol_76 = sanitize_value(get_row_val(row_dict, "EFECTOS DE VOLADURA  '76"), int)
    if vol_76 is not None:
        if not (1 <= vol_76 <= 6):
            registrar_error("EFECTOS DE VOLADURA  '76", vol_76, "ALERTA", "Efecto de voladura '76 excede los límites de la escala [1, 6].")
        elif vol_76 not in EFECTOS_VOLADURA_CATALOG:
            registrar_error("EFECTOS DE VOLADURA  '76", vol_76, "ADVERTENCIA", f"Puntaje de efectos de voladura '76 ({vol_76}) es un valor medio no exacto.")

    vol_89 = sanitize_value(get_row_val(row_dict, "EFECTOS DE VOLADURA '89"), int)
    if vol_89 is not None:
        if not (1 <= vol_89 <= 6):
            registrar_error("EFECTOS DE VOLADURA '89", vol_89, "ALERTA", "Efecto de voladura '89 excede los límites de la escala [1, 6].")
        elif vol_89 not in EFECTOS_VOLADURA_CATALOG:
            registrar_error("EFECTOS DE VOLADURA '89", vol_89, "ADVERTENCIA", f"Puntaje de efectos de voladura '89 ({vol_89}) es un valor medio no exacto.")

    # 6. RQD Valor exacto de tabla discreta (Alerta si supera límites, Advertencia si es valor medio)
    rqd_val_76 = sanitize_value(get_row_val(row_dict, "RQD - VALOR  '76"), int)
    if rqd_val_76 is not None:
        if not (0 <= rqd_val_76 <= 20):
            registrar_error("RQD - VALOR  '76", rqd_val_76, "ALERTA", "Valor de RQD '76 excede los límites reales de la escala [0, 20].")
        elif rqd_val_76 not in [3, 8, 13, 17, 20]:
            registrar_error("RQD - VALOR  '76", rqd_val_76, "ADVERTENCIA", f"Puntaje de RQD '76 ({rqd_val_76}) es un valor medio no exacto.")

    rqd_val_89 = sanitize_value(get_row_val(row_dict, "RQD - VALOR '89"), int)
    if rqd_val_89 is not None:
        if not (0 <= rqd_val_89 <= 20):
            registrar_error("RQD - VALOR '89", rqd_val_89, "ALERTA", "Valor de RQD '89 excede los límites reales de la escala [0, 20].")
        elif rqd_val_89 not in [3, 8, 13, 17, 20]:
            registrar_error("RQD - VALOR '89", rqd_val_89, "ADVERTENCIA", f"Puntaje de RQD '89 ({rqd_val_89}) es un valor medio no exacto.")

    # 7. Porcentaje de RQD (Límite 100%)
    rqd_76 = sanitize_value(get_row_val(row_dict, "RQD  '76"), float)
    if rqd_76 is not None and rqd_76 > 100.0:
        registrar_error("RQD  '76", rqd_76, "ALERTA", "Porcentaje de RQD '76 no puede ser superior al 100%.")
    rqd_89 = sanitize_value(get_row_val(row_dict, "RQD '89"), float)
    if rqd_89 is not None and rqd_89 > 100.0:
        registrar_error("RQD '89", rqd_89, "ALERTA", "Porcentaje de RQD '89 no puede ser superior al 100%.")

    # 8. Espaciamiento Promedio y Valor de Rating correspondientes (Con advertencias de valor medio)
    espac_prom_76 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO PROMEDIO   '76"), float)
    espac_val_76 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO - VALOR    '76"), int)
    if espac_prom_76 is not None and espac_prom_76 <= 0:
        registrar_error("ESPACIAMIENTO PROMEDIO   '76", espac_prom_76, "ALERTA", "El espaciamiento promedio '76 debe ser positivo.")
    if espac_val_76 is not None:
        if not (5 <= espac_val_76 <= 30):
            registrar_error("ESPACIAMIENTO - VALOR    '76", espac_val_76, "ALERTA", "Valor de rating de espaciamiento '76 fuera del rango [5, 30].")
        elif espac_val_76 not in [5, 10, 20, 25, 30]:
            registrar_error("ESPACIAMIENTO - VALOR    '76", espac_val_76, "ADVERTENCIA", f"Puntaje de espaciamiento '76 ({espac_val_76}) es un valor medio no exacto.")
        elif espac_prom_76 is not None:
            if espac_prom_76 < 0.05: expected = 5
            elif espac_prom_76 < 0.3: expected = 10
            elif espac_prom_76 < 1.0: expected = 20
            elif espac_prom_76 < 3.0: expected = 25
            else: expected = 30
            if espac_val_76 != expected:
                registrar_error("ESPACIAMIENTO - VALOR    '76", espac_val_76, "ALERTA", f"Rating de espaciamiento '76 ({espac_val_76}) no se alinea con el promedio de {espac_prom_76}m (se esperaba {expected}).")

    espac_prom_89 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO PROMEDIO '89"), float)
    espac_val_89 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO - VALOR '89"), int)
    if espac_prom_89 is not None and espac_prom_89 <= 0:
        registrar_error("ESPACIAMIENTO PROMEDIO '89", espac_prom_89, "ALERTA", "El espaciamiento promedio '89 debe ser positivo.")
    if espac_val_89 is not None:
        if not (5 <= espac_val_89 <= 20):
            registrar_error("ESPACIAMIENTO - VALOR '89", espac_val_89, "ALERTA", "Valor de rating de espaciamiento '89 fuera del rango [5, 20].")
        elif espac_val_89 not in [5, 8, 10, 15, 20]:
            registrar_error("ESPACIAMIENTO - VALOR '89", espac_val_89, "ADVERTENCIA", f"Puntaje de espaciamiento '89 ({espac_val_89}) es un valor medio no exacto.")
        elif espac_prom_89 is not None:
            if espac_prom_89 < 0.06: expected = 5
            elif espac_prom_89 < 0.2: expected = 8
            elif espac_prom_89 < 0.6: expected = 10
            elif espac_prom_89 < 2.0: expected = 15
            else: expected = 20
            if espac_val_89 != expected:
                registrar_error("ESPACIAMIENTO - VALOR '89", espac_val_89, "ALERTA", f"Rating de espaciamiento '89 ({espac_val_89}) no se alinea con el promedio de {espac_prom_89}m (se esperaba {expected}).")

def validate_structural_row(row_dict, dist_celda, registrar_error):
    # 1. Tipo de estructura
    tipo_junta = sanitize_value(get_row_val(row_dict, "TIPO"), str)
    if tipo_junta is not None and tipo_junta.upper() not in TIPO_ESTRUCTURA_CATALOG:
        registrar_error("TIPO", tipo_junta, "ALERTA", f"Tipo de estructura geológica '{tipo_junta}' no permitida.")

    # 2. Relleno 1 y Relleno 2
    rel1 = sanitize_value(get_row_val(row_dict, "TIPO DE  RELLENO 1"), str)
    if rel1 is not None and rel1.lower() not in TIPO_RELLENO_CATALOG:
        registrar_error("TIPO DE  RELLENO 1", rel1, "ALERTA", f"Tipo de relleno 1 '{rel1}' no pertenece al catálogo.")
        
    rel2 = sanitize_value(get_row_val(row_dict, "TIPO DE  RELLENO 2"), str)
    if rel2 is not None and rel2.lower() not in TIPO_RELLENO_CATALOG:
        registrar_error("TIPO DE  RELLENO 2", rel2, "ALERTA", f"Tipo de relleno 2 '{rel2}' no pertenece al catálogo.")

    # 3. JRC [0, 20]
    jrc_val = sanitize_value(get_row_val(row_dict, "JRC"), int)
    if jrc_val is not None and not (0 <= jrc_val <= 20):
        registrar_error("JRC", jrc_val, "ALERTA", f"Valor JRC ({jrc_val}) fuera de rango permitido [0, 20].")

    # 4. Rugosidad de Estructuras [1, 9]
    rug_val = sanitize_value(get_row_val(row_dict, "RUGOSIDAD DE ESTRUCTURAS"), int)
    if rug_val is not None and rug_val not in RUGOSIDAD_CATALOG:
        registrar_error("RUGOSIDAD DE ESTRUCTURAS", rug_val, "ALERTA", f"Clase de rugosidad de junta ({rug_val}) fuera de límites [1, 9].")

    # 5. Forma de estructura
    forma_estrucs = sanitize_value(get_row_val(row_dict, "FORMA DE ESTRUCTURA"), str)
    if forma_estrucs is not None and forma_estrucs.upper() not in FORMA_ESTRUCTURA_CATALOG:
        registrar_error("FORMA DE ESTRUCTURA", forma_estrucs, "ALERTA", f"Forma de estructura '{forma_estrucs}' inválida. Debe ser P, C, O, E o I.")

    # 6. Alteración
    alt_pared = sanitize_value(get_row_val(row_dict, "ALTERACION"), str)
    if alt_pared is not None and alt_pared.lower() not in ALTERACION_CATALOG:
        registrar_error("ALTERACION", alt_pared, "ALERTA", f"Código de alteración '{alt_pared}' inválido.")

    # 7. Espesor no puede superar abertura (Alerta)
    espesor = sanitize_value(get_row_val(row_dict, "ESPESOR mm."), float)
    abertura = sanitize_value(get_row_val(row_dict, "ABERTURA mm."), float)
    if espesor is not None and abertura is not None and espesor > abertura:
         registrar_error("ESPESOR mm.", espesor, "ALERTA", f"Fallo físico: Espesor del relleno ({espesor}mm) es superior a la abertura total ({abertura}mm).")

    # 8. Comprobaciones de abertura (Límite 10,000 / Excepción de Fallas)
    if abertura is not None:
        is_falla = tipo_junta is not None and (tipo_junta.upper() in ['F', 'F+10', 'F-10'] or tipo_junta.upper().startswith('F'))
        if is_falla:
            # Límite físico: abertura en metros no puede superar el largo de celda
            if dist_celda is not None and (abertura / 1000.0) > dist_celda:
                registrar_error("ABERTURA mm.", abertura, "ALERTA", f"Fallo físico: La abertura de la falla ({abertura}mm) supera la longitud de la celda ({dist_celda}m).")
        else:
            if abertura > 10000.0:
                registrar_error("ABERTURA mm.", abertura, "ADVERTENCIA", f"La abertura ({abertura}mm) excede el máximo sugerido de 10000mm.")

    # 9. Persistencia de discontinuidad (Continuidad) vs Ventana y límite de 25m (Advertencias)
    cont_junta = sanitize_value(get_row_val(row_dict, "CONTINUIDAD m."), float)
    if cont_junta is not None:
        if dist_celda is not None and cont_junta > dist_celda:
            registrar_error("CONTINUIDAD m.", cont_junta, "ADVERTENCIA", f"La persistencia de discontinuidad ({cont_junta}m) supera el largo de ventana ({dist_celda}m).")
        if cont_junta > 25.0:
            registrar_error("CONTINUIDAD m.", cont_junta, "ADVERTENCIA", f"La persistencia ({cont_junta}m) es inusualmente elevada (> 25 metros).")

def validate_lithology_correlation(row_dict, registrar_error):
    # 1. Comprobación cruzada litológica lito1-lito2-lito3 y K-Factor
    l1 = sanitize_value(get_row_val(row_dict, "Lito 1"), str)
    l2 = sanitize_value(get_row_val(row_dict, "Lito 2"), str)
    l3 = sanitize_value(row_dict.get("Lito 3"), str)
    u_lito = sanitize_value(row_dict.get("Unidad Litologica"), str)
    
    matched_row = None
    if all(v is not None for v in [l1, l2, l3, u_lito]):
        for row in LITHOLOGY_CLASSIFICATION:
            l1_ok = match_lito_column(row["lito1"], l1)
            l2_ok = match_lito_column(row["lito2"], l2)
            l3_ok = match_lito_column(row["lito3"], l3)
            if l1_ok and l2_ok and l3_ok:
                matched_row = row
                break
                
        if not matched_row:
            registrar_error("Lito 1", l1, "ALERTA", f"Combinación litológica inválida: Lito 1: '{l1}' | Lito 2: '{l2}' | Lito 3: '{l3}'.")
        else:
            # 2. Comprobación de Unidad Litológica (Grupo)
            group_esperado = matched_row["grupo"]
            group_input_norm = NORM_GROUP_MAP.get(str(u_lito).strip().upper(), str(u_lito).strip().upper())
            if group_input_norm != group_esperado:
                registrar_error("Unidad Litologica", u_lito, "ALERTA", f"Unidad litológica '{u_lito}' es incongruente con la litología. Esperado: '{group_esperado}'.")

    # 3. Validaciones de resistencia UCS vs is50
    ucs_val = sanitize_value(get_row_val(row_dict, "( UCS )  (Mpa)"), float)
    is50_val = sanitize_value(get_row_val(row_dict, "is50 (Mpa)"), float)
    if ucs_val is not None and is50_val is not None:
        if ucs_val <= is50_val:
            registrar_error("( UCS )  (Mpa)", ucs_val, "ALERTA", f"Fallo físico: UCS ({ucs_val} MPa) debe ser mayor a is50 ({is50_val} MPa).")
        
        # 4. Multiplicación de UCS con Factor K de catálogo litológico (Advertencia)
        if matched_row is not None:
            factor_k = matched_row["k"]
            expected_ucs = is50_val * factor_k
            if abs(ucs_val - expected_ucs) > 1.0:
                registrar_error("( UCS )  (Mpa)", ucs_val, "ADVERTENCIA", f"Divergencia de resistencia uniaxial: UCS real ({ucs_val} MPa) difiere del producto is50 * K ({is50_val} * {factor_k} = {expected_ucs:.2f} MPa).")

# --- PROCESADOR CENTRAL DE PLANILLAS EXCEL ---

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
        'GEOTECNICO', 'Nivel', 'Lito 1', 'Lito 2', 'Lito 3', 'Unidad Litologica'
    ]
    for col in propagate_cols:
        if col in df.columns:
            df[col] = df[col].replace([-1, -1.0, '-1', '-1.0'], np.nan)
            df[col] = df[col].ffill()

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
        if camp: filas_por_campana[str(camp)] = filas_por_campana.get(str(camp), 0) + 1
        geo = sanitize_value(get_row_val(row_dict, 'GEOTECNICO'), str)
        if geo: filas_por_geotecnico[geo] = filas_por_geotecnico.get(geo, 0) + 1

        if celda_padre not in resumen_celdas:
            resumen_celdas[celda_padre] = {"total_hijas": 0, "vacios": 0, "advertencias": 0, "alertas": 0, "estado_celda": "OK"}

        if celda_padre != current_parent:
            current_parent, daughter_counter = celda_padre, 1
        else:
            daughter_counter += 1

        celda_hija = f"{celda_padre}-{daughter_counter}"
        resumen_celdas[celda_padre]["total_hijas"] += 1
        row_has_errors = False

        dist_celda = sanitize_value(get_row_val(row_dict, 'Dist.Celda'), float)

        def registrar_error(col, val, tipo, msg):
            nonlocal row_has_errors, total_vacios, total_advertencias, total_alertas
            incidencias.append({
                "fila_excel": fila_excel, "celda_padre": celda_padre, "celda_hija": celda_hija,
                "columna": col, "valor_actual": val, "tipo_incidencia": tipo, "mensaje": msg,
                "campania": str(camp) if camp else "N/A", "geotecnico": geo if geo else "N/A", "sector_geotecnico": geo or "N/A"
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

        # 1. Validar campos obligatorios vacíos
        for col_key in df.columns:
            if col_key in ['COMENTARIO', 'CELDA_DUPLICADA_IGNORE']: continue
            v = sanitize_value(row_dict.get(col_key), str)
            if v is None: registrar_error(col_key, None, "VACIO", f"El campo '{col_key}' se encuentra vacío.")

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
        "distribucion_filas_campana": filas_por_campana, "distribucion_filas_geotecnico": filas_por_geotecnico,
        "vacios_por_campana": vacios_por_campana, "vacios_por_geotecnico": vacios_por_geotecnico,
        "incidencias": incidencias, "resumen_por_celda_padre": resumen_celdas
    }

    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(output_json, f, ensure_ascii=False)