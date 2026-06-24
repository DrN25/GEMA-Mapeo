import os
import sys
import json
import math
import argparse
from datetime import datetime
import pandas as pd
import numpy as np

# Matriz de Correlación Litoestratigráfica Oficial (v2.0)
LITHOLOGY_CATALOG = {
    "INTRUSIVOS": [
        {"lito1": "MZB", "lito2": "MZB", "lito3": "MZB_EQ", "k": 8.29},
        {"lito1": "MZB", "lito2": "MZB", "lito3": "MZB_P", "k": 8.53},
        {"lito1": "MBF1", "lito2": "MBF", "lito3": "MBF1", "k": 9.20},
        {"lito1": "MBF2", "lito2": "MBF", "lito3": "MBF2", "k": 10.73},
        {"lito1": "MBF2", "lito2": "MBF", "lito3": "MBF_P", "k": 9.31},
        {"lito1": "MZM", "lito2": "MZM", "lito3": "MZM_F", "k": 9.31},
        {"lito1": "MZM", "lito2": "MZM", "lito3": "MZM_M", "k": 8.61},
        {"lito1": "MZH", "lito2": "MZH", "lito3": "MZH_1", "k": 11.62},
        {"lito1": "MZH", "lito2": "MZH", "lito3": "MZH_2", "k": 9.31},
        {"lito1": "MZD", "lito2": "MZD", "lito3": "MZD", "k": 7.60},
        {"lito1": "MZQ", "lito2": "MZQ", "lito3": "MZQ", "k": 12.29},
        {"lito1": "AN", "lito2": "AN", "lito3": "LAM", "k": 9.31}
    ],
    "SEDIMENTARIOS": [
        {"lito1": "LMT", "lito2": "LMT", "lito3": "LMT_M", "k": 14.74},
        {"lito1": "LMT", "lito2": "LMT", "lito3": "LMT_Mg", "k": 14.25},
        {"lito1": "LMT", "lito2": "LMT", "lito3": "LMT_S", "k": 14.84},
        {"lito1": "LMT", "lito2": "LMT", "lito3": "LMT_C", "k": 16.83},
        {"lito1": "LMT", "lito2": "LMT", "lito3": "LMT_U", "k": 14.84},
        {"lito1": "SHL", "lito2": "HFL", "lito3": "SHL_MA", "k": 14.84}
    ],
    "METAMORFICAS": [
        {"lito1": "LMT", "lito2": "GSK", "lito3": "Varios", "k": 11.15},
        {"lito1": "LMT", "lito2": "PSK", "lito3": "Varios", "k": 12.63},
        {"lito1": "LMT", "lito2": "MSK", "lito3": "Varios", "k": 12.63},
        {"lito1": "LMT", "lito2": "ESK", "lito3": "Varios", "k": 12.63},
        {"lito1": "LMT", "lito2": "MBC", "lito3": "Varios", "k": 11.78},
        {"lito1": "LMT", "lito2": "MBL", "lito3": "Varios", "k": 13.34},
        {"lito1": "SHL", "lito2": "HFL", "lito3": "-", "k": 12.63},
        {"lito1": "SND", "lito2": "QZT", "lito3": "-", "k": 12.63}
    ],
    "BRECHAS": [
        {"lito1": "TBX", "lito2": "TBX", "lito3": "TBX", "k": 13.72},
        {"lito1": "HBX", "lito2": "HBX", "lito3": "HBX", "k": 11.41},
        {"lito1": "MBX / varios", "lito2": "MBX", "lito3": "MBX", "k": 11.41},
        {"lito1": "MBX", "lito2": "MBX", "lito3": "MBX", "k": 11.41}
    ],
    "ENDOSKARN": [
        {"lito1": "Intrusivo", "lito2": "EPG", "lito3": "-", "k": 9.87},
        {"lito1": "Intrusivo", "lito2": "EGT", "lito3": "-", "k": 9.87}
    ]
}

NORM_GROUP_MAP = {
    "SEDIMENTARIAS": "SEDIMENTARIOS",
    "SEDIMENTARIOS": "SEDIMENTARIOS",
    "INTRUSIVOS": "INTRUSIVOS",
    "METAMORFICAS": "METAMORFICAS",
    "BRECHAS": "BRECHAS",
    "ENDOSKARN": "ENDOSKARN"
}

MANDATORY_COLS_COUNT = 77

def clean_and_rename_columns(df):
    cols = []
    cota_seen = 0
    celda_seen = 0
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
    if val_str == '' or val_str == '-1' or val_str == '-1.0':
        return None
    try:
        return target_type(val)
    except (ValueError, TypeError):
        return None

def validate_bulk_excel(file_path, output_json_path):
    print(f"[*] Leyendo archivo Excel: {file_path}")
    
    try:
        df = pd.read_excel(file_path, engine='openpyxl')
    except Exception as e:
        print(f"[-] Error al abrir el archivo Excel: {e}")
        sys.exit(1)
        
    df = clean_and_rename_columns(df)
    
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
    
    print("[*] Aplicando propagacion vertical ffill sobre columnas de cabecera...")
    for col in propagate_cols:
        if col in df.columns:
            df[col] = df[col].replace([-1, -1.0, '-1', '-1.0'], np.nan)
            df[col] = df[col].ffill()

    # Conversión a registros de diccionarios para preservar caracteres exactos
    records = df.to_dict(orient='records')
    
    incidencias = []
    resumen_celdas = {}
    
    total_filas = len(records)
    total_vacios = 0
    total_advertencias = 0
    total_alertas = 0
    total_ok = 0
    
    filas_por_campana = {}
    filas_por_geotecnico = {}
    
    vacios_por_campana = {}
    vacios_por_geotecnico = {}
    
    print(f"[*] Procesando {total_filas} registros...")
    
    current_parent = None
    daughter_counter = 0
    station_angles = {}

    for idx, row_dict in enumerate(records):
        fila_excel = idx + 2 
        
        celda_padre = sanitize_value(get_row_val(row_dict, 'CELDA_PADRE'), str)
        if not celda_padre:
            incidencias.append({
                "fila_excel": fila_excel,
                "celda_padre": "N/A",
                "celda_hija": "N/A",
                "columna": "CELDA_PADRE",
                "valor_actual": None,
                "tipo_incidencia": "ALERTA",
                "mensaje": "La fila no posee una estacion de mapeo valida asociada."
            })
            total_alertas += 1
            continue

        camp = sanitize_value(get_row_val(row_dict, 'Campaña'), int)
        if camp:
            filas_por_campana[str(camp)] = filas_por_campana.get(str(camp), 0) + 1
        geo = sanitize_value(get_row_val(row_dict, 'GEOTECNICO'), str)
        if geo:
            filas_por_geotecnico[geo] = filas_por_geotecnico.get(geo, 0) + 1

        if celda_padre not in resumen_celdas:
            resumen_celdas[celda_padre] = {
                "total_hijas": 0,
                "vacios": 0,
                "advertencias": 0,
                "alertas": 0,
                "estado_celda": "OK"
            }

        if celda_padre != current_parent:
            current_parent = celda_padre
            daughter_counter = 1
        else:
            daughter_counter += 1

        celda_hija = f"{celda_padre}-{daughter_counter}"
        resumen_celdas[celda_padre]["total_hijas"] += 1
        row_has_errors = False

        # Declaramos e inicializamos las variables de forma segura y temprana
        camp = sanitize_value(get_row_val(row_dict, 'Campaña'), int)
        if camp:
            filas_por_campana[str(camp)] = filas_por_campana.get(str(camp), 0) + 1
            
        geo = sanitize_value(get_row_val(row_dict, 'GEOTECNICO'), str)
        if geo:
            filas_por_geotecnico[geo] = filas_por_geotecnico.get(geo, 0) + 1
            
        geo_zone = geo  # Alias temprano para sector geotécnico

        def registrar_error(col, val, tipo, msg):
            nonlocal row_has_errors, total_vacios, total_advertencias, total_alertas
            incidencias.append({
                "fila_excel": fila_excel,
                "celda_padre": celda_padre,
                "celda_hija": celda_hija,
                "columna": col,
                "valor_actual": val,
                "tipo_incidencia": tipo,
                "mensaje": msg,
                "campania": str(camp) if camp else "N/A",
                "geotecnico": geo if geo else "N/A",
                "sector_geotecnico": geo_zone if geo_zone else "N/A"
            })
            if tipo == "VACIO":
                total_vacios += 1
                resumen_celdas[celda_padre]["vacios"] += 1
                if camp:
                    vacios_por_campana[str(camp)] = vacios_por_campana.get(str(camp), 0) + 1
                if geo:
                    vacios_por_geotecnico[geo] = vacios_por_geotecnico.get(geo, 0) + 1
            elif tipo == "ADVERTENCIA":
                total_advertencias += 1
                resumen_celdas[celda_padre]["advertencias"] += 1
            elif tipo == "ALERTA":
                total_alertas += 1
                resumen_celdas[celda_padre]["alertas"] += 1
                row_has_errors = True

        # ==========================================
        # VALIDACIÓN DE CAMPOS OBLIGATORIOS (77 COLUMNAS)
        # ==========================================
        for col_key in df.columns:
            if col_key == 'COMENTARIO' or col_key == 'CELDA_DUPLICADA_IGNORE':
                continue
            v = sanitize_value(row_dict.get(col_key), str)
            if v is None:
                registrar_error(col_key, None, "VACIO", f"El campo '{col_key}' se encuentra vacio.")

        # ==========================================
        # VALIDACIONES SECUENCIALES INDIVIDUALES
        # ==========================================
        
        # id (Col 1)
        r_id = sanitize_value(get_row_val(row_dict, 'id'), int)
        if r_id is not None and r_id <= 0:
            registrar_error("id", r_id, "ALERTA", "El id del registro debe ser un entero positivo.")

        # Coordenadas FROM (Cols 4, 5, 6)
        e_from = sanitize_value(get_row_val(row_dict, 'ESTE_FROM'), float)
        n_from = sanitize_value(get_row_val(row_dict, 'NORTE_FROM'), float)
        c_from = sanitize_value(get_row_val(row_dict, 'COTA_FROM'), float)
        
        if e_from is not None and not (100000.0 <= e_from <= 999999.0):
            registrar_error("ESTE_FROM", e_from, "ALERTA", "Coordenada Este_From fuera de rango UTM valido.")
        if n_from is not None and not (1000000.0 <= n_from <= 9999999.0):
            registrar_error("NORTE_FROM", n_from, "ALERTA", "Coordenada Norte_From fuera de rango UTM valido.")
        if c_from is not None and not (0.0 <= c_from <= 5000.0):
            registrar_error("COTA_FROM", c_from, "ALERTA", "Elevacion Cota_From fuera de rango [0, 5000].")

        # Coordenadas TO (Cols 7, 8, 9)
        e_to = sanitize_value(get_row_val(row_dict, 'ESTE_TO'), float)
        n_to = sanitize_value(get_row_val(row_dict, 'NORTE_TO'), float)
        c_to = sanitize_value(get_row_val(row_dict, 'COTA_TO'), float)
        
        if e_to is not None and not (100000.0 <= e_to <= 999999.0):
            registrar_error("ESTE_TO", e_to, "ALERTA", "Coordenada Este_To fuera de rango UTM valido.")
        elif e_to is not None and e_to == e_from:
            registrar_error("ESTE_TO", e_to, "ADVERTENCIA", "La coordenada Este_To es exactamente igual a Este_From.")

        if n_to is not None and not (1000000.0 <= n_to <= 9999999.0):
            registrar_error("NORTE_TO", n_to, "ALERTA", "Coordenada Norte_To fuera de rango UTM valido.")
        elif n_to is not None and n_to == n_from:
            registrar_error("NORTE_TO", n_to, "ADVERTENCIA", "La coordenada Norte_To es exactamente igual a Norte_From.")

        if c_to is not None and not (0.0 <= c_to <= 5000.0):
            registrar_error("COTA_TO", c_to, "ALERTA", "Elevacion Cota_To fuera de rango [0, 5000].")
        elif c_to is not None and c_from is not None and abs(c_to - c_from) > 5.0:
            registrar_error("COTA_TO", c_to, "ADVERTENCIA", f"Variacion abrupta de cota vertical entre extremos (> 5m). Delta: {abs(c_to - c_from):.2f}m")

        # Dist.Celda (Largo) (Col 10)
        dist_celda = sanitize_value(get_row_val(row_dict, 'Dist.Celda'), float)
        if dist_celda is not None:
            if dist_celda > 25.0:
                registrar_error("Dist.Celda", dist_celda, "ALERTA", f"El largo de la celda ({dist_celda}m) supera el limite maximo permitido de 25m.")
            elif dist_celda <= 0:
                registrar_error("Dist.Celda", dist_celda, "ALERTA", "El largo de la celda debe ser positivo.")
            
            # Verificación de distancia euclidiana 3D real
            if all(v is not None for v in [e_from, n_from, c_from, e_to, n_to, c_to]):
                l_calc = math.sqrt((e_to - e_from)**2 + (n_to - n_from)**2 + (c_to - c_from)**2)
                if abs(dist_celda - l_calc) > 1.0:
                    registrar_error("Dist.Celda", dist_celda, "ADVERTENCIA", f"El largo difiere de la distancia euclidiana calculada por coordenadas ({l_calc:.2f}m).")

        # Altura (Col 11)
        altura_celda = sanitize_value(get_row_val(row_dict, 'Altura'), float)
        if altura_celda is not None and not (1.0 <= altura_celda <= 30.0):
            registrar_error("Altura", altura_celda, "ALERTA", "Altura de celda fuera de rango operativo [1, 30] metros.")

        # DIP (Col 12)
        dip_slope = sanitize_value(get_row_val(row_dict, 'DIP'), float)
        if dip_slope is not None and not (-90.0 <= dip_slope <= 90.0):
            registrar_error("DIP", dip_slope, "ALERTA", "Inclinacion angular de celda fuera de limites.")

        # AZ_HOLE (Col 13)
        az_hole = sanitize_value(get_row_val(row_dict, 'AZ_HOLE'), float)
        if az_hole is not None and not (0.0 <= az_hole <= 359.99):
            registrar_error("AZ_HOLE", az_hole, "ALERTA", "Azimut de perforacion fuera de limites angulares.")

        # DIP_TALUD (Col 14)
        dip_talud = sanitize_value(get_row_val(row_dict, 'DIP_TALUD'), float)
        if dip_talud is not None:
            if not (0.0 <= dip_talud <= 90.0):
                registrar_error("DIP_TALUD", dip_talud, "ALERTA", "Angulo del talud fuera de rango.")
            elif dip_talud < 35.0 or dip_talud > 78.0:
                registrar_error("DIP_TALUD", dip_talud, "ADVERTENCIA", f"Inclinacion del talud fuera del diseño minero estandar ({dip_talud}°).")

        # DIP DIR_TALUD (Col 15)
        dipdir_talud = sanitize_value(get_row_val(row_dict, 'DIP DIR_TALUD'), float)
        if dipdir_talud is not None and not (0.0 <= dipdir_talud <= 359.99):
            registrar_error("DIP DIR_TALUD", dipdir_talud, "ALERTA", "Direccion de talud fuera de rango.")

        # INTEMPERISMO (Col 16)
        intemp = sanitize_value(get_row_val(row_dict, 'INTEMPERISMO'), str)
        if intemp is not None and intemp.lower() not in ['f', 'd', 'm', 'a', 'c', 's']:
            registrar_error("INTEMPERISMO", intemp, "ALERTA", f"Grado de meteorizacion '{intemp}' no catalogado.")

        # CONDICIÓN AGUA '76 (Cols 17, 18)
        c_agua_76 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA  '76."), str)
        c_agua_val_76 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA VALOR  '76"), int)
        if c_agua_76 is not None and c_agua_76.upper() not in ['C', 'H', 'M', 'E', 'F']:
            registrar_error("CONDICION DE AGUA  '76.", c_agua_76, "ALERTA", "Clave de agua '76 invalida.")
        if c_agua_val_76 is not None and not (0 <= c_agua_val_76 <= 10):
            registrar_error("CONDICION DE AGUA VALOR  '76", c_agua_val_76, "ALERTA", "Puntaje de agua '76 fuera de rango.")

        # DUREZA '76 (Cols 19, 20)
        dureza_76 = sanitize_value(get_row_val(row_dict, "DUREZA  '76"), str)
        dureza_val_76 = sanitize_value(get_row_val(row_dict, "RESISTENCIA ESTIMADA VALOR  '76"), int)
        if dureza_76 is not None and dureza_76.upper() not in ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6']:
            registrar_error("DUREZA  '76", dureza_76, "ALERTA", "Clave de dureza '76 invalida.")
        if dureza_val_76 is not None and not (0 <= dureza_val_76 <= 10):
            registrar_error("RESISTENCIA ESTIMADA VALOR  '76", dureza_val_76, "ALERTA", "Rating de resistencia '76 fuera de limites.")

        # GSI VISUAL '76 (Col 21)
        gsi_76 = sanitize_value(get_row_val(row_dict, "GSI VISUAL  '76"), int)
        if gsi_76 is not None and not (10 <= gsi_76 <= 95):
            registrar_error("GSI VISUAL  '76", gsi_76, "ALERTA", "GSI visual '76 fuera de rango.")

        # CONTROL ESTRUCTURAL '76 (Col 22)
        ctrl_76 = sanitize_value(get_row_val(row_dict, "CONTROL ESTRUCTURAL  '76"), int)
        if ctrl_76 is not None and not (1 <= ctrl_76 <= 5):
            registrar_error("CONTROL ESTRUCTURAL  '76", ctrl_76, "ALERTA", "Control estructural '76 invalido.")

        # EFECTOS DE VOLADURA '76 (Col 23)
        vol_76 = sanitize_value(get_row_val(row_dict, "EFECTOS DE VOLADURA  '76"), int)
        if vol_76 is not None and not (1 <= vol_76 <= 5):
            registrar_error("EFECTOS DE VOLADURA  '76", vol_76, "ALERTA", "Efectos de voladura '76 invalido.")

        # RQD '76 (Cols 24, 25)
        rqd_val_76 = sanitize_value(get_row_val(row_dict, "RQD - VALOR  '76"), int)
        rqd_76 = sanitize_value(get_row_val(row_dict, "RQD  '76"), float)
        if rqd_val_76 is not None and not (3 <= rqd_val_76 <= 20):
            registrar_error("RQD - VALOR  '76", rqd_val_76, "ALERTA", "Rating de RQD '76 fuera de rango.")
        if rqd_76 is not None and not (0.0 <= rqd_76 <= 100.0):
            registrar_error("RQD  '76", rqd_76, "ALERTA", "Porcentaje de RQD '76 fuera de rango.")

        # FRACTURAS x m '76 (Col 26)
        freq_76 = sanitize_value(get_row_val(row_dict, "FRECUENCIA DE FRACTURAMIENTO x m.  '76"), float)
        if freq_76 is not None and freq_76 < 0:
            registrar_error("FRECUENCIA DE FRACTURAMIENTO x m.  '76", freq_76, "ALERTA", "Frecuencia no puede ser negativa.")

        # BLOQUES '76 (Col 27)
        block_76 = sanitize_value(get_row_val(row_dict, "TAMAÑO DE BLOQUES  x m3  '76"), float)
        if block_76 is not None and block_76 < 0:
            registrar_error("TAMAÑO DE BLOQUES  x m3  '76", block_76, "ALERTA", "Volumen de bloque no puede ser negativo.")

        # ESPACIAMIENTO '76 (Cols 28, 29)
        espac_prom_76 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO PROMEDIO   '76"), float)
        espac_val_76 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO - VALOR    '76"), int)
        if espac_prom_76 is not None and espac_prom_76 <= 0:
            registrar_error("ESPACIAMIENTO PROMEDIO   '76", espac_prom_76, "ALERTA", "Espaciamiento promedio '76 debe ser positivo.")
        if espac_val_76 is not None and not (5 <= espac_val_76 <= 30):
            registrar_error("ESPACIAMIENTO - VALOR    '76", espac_val_76, "ALERTA", "Rating de espaciamiento '76 fuera de rango.")

        # CONDICIÓN DISCONTINUIDAD '76 (Col 30)
        cond_val_76 = sanitize_value(get_row_val(row_dict, "CONDICIÓN DE DISCONTINUIDAD - VALOR     '76"), float)
        if cond_val_76 is not None and not (0.0 <= cond_val_76 <= 25.0):
            registrar_error("CONDICIÓN DE DISCONTINUIDAD - VALOR     '76", cond_val_76, "ALERTA", "Valor de condicion de discontinuidad '76 fuera de limites.")

        # RMR '76 (Col 31)
        rmr_76 = sanitize_value(get_row_val(row_dict, "RMR '76"), float)
        if rmr_76 is not None and not (0.0 <= rmr_76 <= 100.0):
            registrar_error("RMR '76", rmr_76, "ALERTA", "Puntuacion final RMR '76 fuera de escala.")

        # UCS y Is50 (Cols 32, 33)
        ucs_val = sanitize_value(get_row_val(row_dict, "( UCS )  (Mpa)"), float)
        if ucs_val is not None and not (0.25 <= ucs_val <= 350.0):
            registrar_error("( UCS )  (Mpa)", ucs_val, "ALERTA", "Resistencia UCS fuera de limites reales.")

        is50_val = sanitize_value(get_row_val(row_dict, "is50 (Mpa)"), float)
        if is50_val is not None and not (0.0 <= is50_val <= 20.0):
            registrar_error("is50 (Mpa)", is50_val, "ALERTA", "Is50 fuera de limites reales.")
        elif is50_val is not None and is50_val > 0 and ucs_val is not None:
            ratio = ucs_val / is50_val
            if not (10.0 <= ratio <= 35.0):
                registrar_error("is50 (Mpa)", is50_val, "ADVERTENCIA", f"La relacion de conversion UCS/Is50 ({ratio:.2f}) se encuentra fuera del rango [10, 35].")

        # CONDICIÓN AGUA '89 (Cols 34, 35)
        c_agua_89 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA  '89"), str)
        c_agua_val_89 = sanitize_value(get_row_val(row_dict, "CONDICION DE AGUA VALOR '89"), int)
        if c_agua_89 is not None and c_agua_89.upper() not in ['C', 'H', 'M', 'E', 'F']:
            registrar_error("CONDICION DE AGUA  '89", c_agua_89, "ALERTA", "Clave de agua '89 invalida.")
        if c_agua_val_89 is not None and not (0 <= c_agua_val_89 <= 15):
            registrar_error("CONDICION DE AGUA VALOR '89", c_agua_val_89, "ALERTA", "Puntaje de agua '89 fuera de rango.")

        # DUREZA '89 (Cols 36, 37)
        dureza_89 = sanitize_value(get_row_val(row_dict, "DUREZA '89"), str)
        dureza_val_89 = sanitize_value(get_row_val(row_dict, "RESISTENCIA ESTIMADA VALOR '89"), float)
        if dureza_89 is not None and dureza_89.upper() not in ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6']:
            registrar_error("DUREZA '89", dureza_89, "ALERTA", "Clave de dureza '89 invalida.")
        if dureza_val_89 is not None and not (0.0 <= dureza_val_89 <= 15.0):
            registrar_error("RESISTENCIA ESTIMADA VALOR '89", dureza_val_89, "ALERTA", "Rating de resistencia '89 fuera de limites.")
        elif dureza_89 and ucs_val is not None:
            isrm_ranges = {
                'R0': (0.25, 1.0), 'R1': (1.0, 5.0), 'R2': (5.0, 25.0),
                'R3': (25.0, 50.0), 'R4': (50.0, 100.0), 'R5': (100.0, 250.0),
                'R6': (250.0, 400.0)
            }
            limits = isrm_ranges.get(dureza_89.upper())
            if limits and not (limits[0] <= ucs_val <= limits[1]):
                registrar_error("( UCS )  (Mpa)", ucs_val, "ADVERTENCIA", f"UCS ({ucs_val} MPa) es incompatible con la dureza '{dureza_89}' [{limits[0]}-{limits[1]} MPa].")

        # GSI VISUAL '89 (Col 38)
        gsi_89 = sanitize_value(get_row_val(row_dict, "GSI VISUAL '89"), int)
        if gsi_89 is not None and not (10 <= gsi_89 <= 95):
            registrar_error("GSI VISUAL '89", gsi_89, "ALERTA", "GSI visual '89 fuera de rango.")

        # CONTROL ESTRUCTURAL '89 (Col 39)
        ctrl_89 = sanitize_value(get_row_val(row_dict, "CONTROL ESTRUCTURAL '89"), int)
        if ctrl_89 is not None and not (1 <= ctrl_89 <= 5):
            registrar_error("CONTROL ESTRUCTURAL '89", ctrl_89, "ALERTA", "Control estructural '89 invalido.")

        # EFECTOS DE VOLADURA '89 (Col 40)
        vol_89 = sanitize_value(get_row_val(row_dict, "EFECTOS DE VOLADURA '89"), int)
        if vol_89 is not None and not (1 <= vol_89 <= 5):
            registrar_error("EFECTOS DE VOLADURA '89", vol_89, "ALERTA", "Efectos de voladura '89 invalido.")

        # RQD '89 (Cols 41, 42)
        rqd_val_89 = sanitize_value(get_row_val(row_dict, "RQD - VALOR '89"), int)
        rqd_89 = sanitize_value(get_row_val(row_dict, "RQD '89"), float)
        if rqd_val_89 is not None and not (3 <= rqd_val_89 <= 20):
            registrar_error("RQD - VALOR '89", rqd_val_89, "ALERTA", "Rating de RQD '89 fuera de rango.")
        if rqd_89 is not None and not (0.0 <= rqd_89 <= 100.0):
            registrar_error("RQD '89", rqd_89, "ALERTA", "Porcentaje de RQD '89 fuera de rango.")

        # FRACTURAS x m '89 (Col 43)
        freq_89 = sanitize_value(get_row_val(row_dict, "FRECUENCIA DE FRACTURAMIENTO x m. '89"), float)
        if freq_89 is not None and freq_89 < 0:
            registrar_error("FRECUENCIA DE FRACTURAMIENTO x m. '89", freq_89, "ALERTA", "Frecuencia no puede ser negativa.")

        # BLOQUES '89 (Col 44)
        block_89 = sanitize_value(get_row_val(row_dict, "TAMAÑO DE BLOQUES  x m3 '89"), float)
        if block_89 is not None and block_89 < 0:
            registrar_error("TAMAÑO DE BLOQUES  x m3 '89", block_89, "ALERTA", "Volumen de bloque no puede ser negativo.")

        # ESPACIAMIENTO '89 (Cols 45, 46)
        espac_prom_89 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO PROMEDIO '89"), float)
        espac_val_89 = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO - VALOR '89"), int)
        if espac_prom_89 is not None and espac_prom_89 <= 0:
            registrar_error("ESPACIAMIENTO PROMEDIO '89", espac_prom_89, "ALERTA", "Espaciamiento promedio '89 debe ser positivo.")
        if espac_val_89 is not None and not (5 <= espac_val_89 <= 20):
            registrar_error("ESPACIAMIENTO - VALOR '89", espac_val_89, "ALERTA", "Rating de espaciamiento '89 fuera de rango.")

        # CONDICIÓN DISCONTINUIDAD '89 (Col 47)
        cond_val_89 = sanitize_value(get_row_val(row_dict, "CONDICIÓN DE DISCONTINUIDAD - VALOR '89"), float)
        if cond_val_89 is not None and not (0.0 <= cond_val_89 <= 30.0):
            registrar_error("CONDICIÓN DE DISCONTINUIDAD - VALOR '89", cond_val_89, "ALERTA", "Valor de condicion de discontinuidad '89 fuera de limites.")

        # RMR '89 (Col 48)
        rmr_89 = sanitize_value(get_row_val(row_dict, "RMR '89"), float)
        if rmr_89 is not None and not (0.0 <= rmr_89 <= 100.0):
            registrar_error("RMR '89", rmr_89, "ALERTA", "Puntuacion final RMR '89 fuera de escala.")

        # Comparación RMR76 vs 89
        if rmr_76 is not None and rmr_89 is not None:
            if abs(rmr_89 - rmr_76) > 15.0:
                registrar_error("RMR '89", rmr_89, "ADVERTENCIA", f"La diferencia entre RMR '89 ({rmr_89:.1f}) y RMR '76 ({rmr_76:.1f}) es excesiva (> 15 puntos).")

        # FECHA (Col 49)
        fecha_reg = sanitize_value(get_row_val(row_dict, "FECHA"), str) # Puede ser string o datetime

        # Dist. de estr. (Col 51)
        dist_estr = sanitize_value(get_row_val(row_dict, "Dist. de estr."), float)
        if dist_estr is None:
            registrar_error("Dist. de estr.", None, "VACIO", "Distancia de la discontinuidad vacia.")
        elif dist_celda is not None:
            if dist_estr > dist_celda:
                registrar_error("Dist. de estr.", dist_estr, "ALERTA", f"La distancia de discontinuidad ({dist_estr}m) excede el largo de ventana ({dist_celda}m).")
            elif dist_estr < 0:
                registrar_error("Dist. de estr.", dist_estr, "ALERTA", "La distancia de discontinuidad no puede ser negativa.")

        # teta y alfa (Cols 52, 53)
        teta = sanitize_value(get_row_val(row_dict, "teta"), float)
        alfa = sanitize_value(get_row_val(row_dict, "alfa"), float)
        if teta is not None and alfa is not None:
            if celda_padre not in station_angles:
                station_angles[celda_padre] = (teta, alfa)
            else:
                orig_teta, orig_alfa = station_angles[celda_padre]
                if abs(teta - orig_teta) > 0.001 or abs(alfa - orig_alfa) > 0.001:
                    registrar_error("teta", teta, "ALERTA", "Los angulos de orientacion de scanline cambiaron dentro de la misma celda.")

        # Coordenadas calculadas de juntas (x, y, z) (Cols 54, 55, 56)
        x_val = sanitize_value(get_row_val(row_dict, "x"), float)
        y_val = sanitize_value(get_row_val(row_dict, "y"), float)
        z_val = sanitize_value(get_row_val(row_dict, "z"), float)
        if all(v is not None for v in [x_val, y_val, z_val, e_from, n_from, c_from, e_to, n_to, c_to, dist_estr, dist_celda]) and dist_celda > 0:
            ratio = dist_estr / dist_celda
            x_calc = e_from + ratio * (e_to - e_from)
            y_calc = n_from + ratio * (n_to - n_from)
            z_calc = c_from + ratio * (c_to - c_from)
            if abs(x_val - x_calc) > 0.05 or abs(y_val - y_calc) > 0.05 or abs(z_val - z_calc) > 0.05:
                registrar_error("x", x_val, "ALERTA", f"Error de proyeccion: Coordenadas de junta difieren de la interpolacion lineal. Esperado: [{x_calc:.3f}, {y_calc:.3f}, {z_calc:.3f}]")

        # TIPO (Col 57)
        tipo_junta = sanitize_value(get_row_val(row_dict, "TIPO"), str)
        if tipo_junta is not None and tipo_junta.upper() not in ['JN', 'BED', 'FL', 'SH', 'SZ', 'FO', 'CO']:
            registrar_error("TIPO", tipo_junta, "ALERTA", "Tipo de estructura geologica invalida.")

        # DIP y DIP DIR (Cols 58, 59)
        j_dip = sanitize_value(get_row_val(row_dict, "DIP"), float) # El segundo DIP es de la junta
        j_dipdir = sanitize_value(get_row_val(row_dict, "DIP DIR"), float)
        if j_dip is not None and not (0.0 <= j_dip <= 90.0):
            registrar_error("DIP (Junta)", j_dip, "ALERTA", "Buzamiento (DIP) de discontinuidad fuera de rango.")
        if j_dipdir is not None and not (0.0 <= j_dipdir <= 359.99):
            registrar_error("DIP DIR", j_dipdir, "ALERTA", "Direccion de discontinuidad fuera de limites.")

        # NUMERO DE ESTRUCTURAS (Col 60)
        n_estrucs = sanitize_value(get_row_val(row_dict, "NUMERO DE ESTRUCTURAS"), int)
        if n_estrucs is not None:
            if n_estrucs <= 0:
                registrar_error("NUMERO DE ESTRUCTURAS", n_estrucs, "ALERTA", "La cantidad de estructuras debe ser mayor a 0.")
            elif n_estrucs > 999:
                registrar_error("NUMERO DE ESTRUCTURAS", n_estrucs, "ALERTA", "Cantidad de estructuras supera el limite de 3 digitos.")
            elif n_estrucs > 50:
                registrar_error("NUMERO DE ESTRUCTURAS", n_estrucs, "ADVERTENCIA", "Cantidad inusualmente alta de estructuras para un scanline.")

        # ABERTURA y ESPESOR (Cols 61, 62)
        abertura = sanitize_value(get_row_val(row_dict, "ABERTURA mm."), float)
        espesor = sanitize_value(get_row_val(row_dict, "ESPESOR mm."), float)
        if abertura is not None and not (0.0 <= abertura <= 100.0):
            registrar_error("ABERTURA mm.", abertura, "ALERTA", "Abertura fuera de limites validos.")
        if espesor is not None:
            if espesor > 999.9:
                registrar_error("ESPESOR mm.", espesor, "ALERTA", "El espesor excede el limite de 4 digitos.")
            elif espesor < 0.0:
                registrar_error("ESPESOR mm.", espesor, "ALERTA", "El espesor no puede ser negativo.")

        if abertura is not None and espesor is not None:
            if espesor > abertura:
                registrar_error("ESPESOR mm.", espesor, "ALERTA", f"Fallo fisico: El espesor del relleno ({espesor}mm) es mayor que la abertura total ({abertura}mm).")
            elif espesor > 0.0 and (abertura - espesor) > 5.0:
                registrar_error("ABERTURA mm.", abertura, "ADVERTENCIA", f"Discrepancia geometrica: Abertura ({abertura}mm) supera al espesor ({espesor}mm) por mas de 5mm.")

        # CONTINUIDAD m. (Col 63)
        cont_junta = sanitize_value(get_row_val(row_dict, "CONTINUIDAD m."), float)
        if cont_junta is not None:
            if cont_junta > 25.0:
                registrar_error("CONTINUIDAD m.", cont_junta, "ALERTA", "Persistencia mayor a 25m.")
            elif cont_junta < 0.0:
                registrar_error("CONTINUIDAD m.", cont_junta, "ALERTA", "La persistencia no puede ser negativa.")
            elif altura_celda is not None and cont_junta > altura_celda:
                registrar_error("CONTINUIDAD m.", cont_junta, "ALERTA", f"Persistencia ({cont_junta}m) supera la altura de la ventana ({altura_celda}m).")

        # ESPACIAMIENTO m. (Col 64)
        espac = sanitize_value(get_row_val(row_dict, "ESPACIAMIENTO m."), float)
        if paginacion_checks_ok := (espac is not None):
            if espac < 0.01:
                registrar_error("ESPACIAMIENTO m.", espac, "ALERTA", "Espaciamiento cerrado (menor a 1cm).")
            if dist_celda is not None and espac > dist_celda:
                registrar_error("ESPACIAMIENTO m.", espac, "ALERTA", f"El espaciamiento ({espac}m) supera el largo de ventana ({dist_celda}m).")
            elif altura_celda is not None and espac > altura_celda:
                registrar_error("ESPACIAMIENTO m.", espac, "ALERTA", f"El espaciamiento ({espac}m) supera la altura de la ventana ({altura_celda}m).")

        # NUMERO DE EXTREMOS VISIBLES (Col 65)
        ext_vis = sanitize_value(get_row_val(row_dict, "NUMERO DE EXTREMOS VISIBLES"), int)
        if ext_vis is not None and not (0 <= ext_vis <= 2):
            registrar_error("NUMERO DE EXTREMOS VISIBLES", ext_vis, "ALERTA", "Extremos visibles debe estar en el rango [0, 2].")

        # TIPO DE RELLENO 1 / 2 (Cols 66, 67)
        rel1 = sanitize_value(get_row_val(row_dict, "TIPO DE  RELLENO 1"), str)
        if rel1 is not None and rel1.lower() not in ['ca', 'ox', 'qtz', 'cwf', 'chert', 'py']:
            registrar_error("TIPO DE  RELLENO 1", rel1, "ADVERTENCIA", f"Tipo de relleno '{rel1}' no convencional.")

        # JRC y Rugosidad (Cols 68, 69)
        jrc_val = sanitize_value(get_row_val(row_dict, "JRC"), int)
        rug_val = sanitize_value(get_row_val(row_dict, "RUGOSIDAD DE ESTRUCTURAS"), int)
        if jrc_val is not None and not (1 <= jrc_val <= 20):
            registrar_error("JRC", jrc_val, "ALERTA", "JRC fuera de rango [1, 20].")
        if rug_val is not None and not (1 <= rug_val <= 9):
            registrar_error("RUGOSIDAD DE ESTRUCTURAS", rug_val, "ALERTA", "Perfil de rugosidad fuera de limites [1, 9].")
        elif jrc_val is not None and rug_val is not None:
            if (rug_val >= 8 and jrc_val < 14) or (rug_val <= 2 and jrc_val > 4):
                registrar_error("JRC", jrc_val, "ADVERTENCIA", f"JRC ({jrc_val}) es incongruente con el perfil de rugosidad {rug_val}.")

        # FORMA (Col 70)
        forma_estrucs = sanitize_value(get_row_val(row_dict, "FORMA DE ESTRUCTURA"), str)
        if forma_estrucs is not None and forma_estrucs.upper() not in ['O', 'P', 'U', 'S']:
            registrar_error("FORMA DE ESTRUCTURA", forma_estrucs, "ALERTA", "Forma de discontinuidad invalida.")

        # ALTERACION (Col 71)
        alt_pared = sanitize_value(get_row_val(row_dict, "ALTERACION"), str)
        if alt_pared is not None and alt_pared.lower() not in ['f', 'd', 'm', 'a', 'c', 's']:
            registrar_error("ALTERACION", alt_pared, "ALERTA", "Clave de alteracion no catalogada.")

        # GEOTECNICO (Col 72)
        geo_zone = sanitize_value(get_row_val(row_dict, "GEOTECNICO"), str)

        # Nivel (Col 73)
        lvl_elev = sanitize_value(get_row_val(row_dict, "Nivel"), float)
        if lvl_elev is not None and not (0.0 <= lvl_elev <= 5000.0):
            registrar_error("Nivel", lvl_elev, "ALERTA", "Nivel topografico fuera de rango.")

        # Lito 1, 2, 3 (Cols 74, 75, 76, 77)
        l1 = sanitize_value(get_row_val(row_dict, "Lito 1"), str)
        l2 = sanitize_value(get_row_val(row_dict, "Lito 2"), str)
        l3 = sanitize_value(row_dict.get("Lito 3"), str)
        u_lito = sanitize_value(row_dict.get("Unidad Litologica"), str)
        
        if all(v is not None for v in [l1, l2, l3, u_lito]):
            group_canonico = NORM_GROUP_MAP.get(u_lito.upper(), u_lito.upper())
            group_records = LITHOLOGY_CATALOG.get(group_canonico)
            if not group_records:
                registrar_error("Unidad Litologica", u_lito, "ALERTA", f"Unidad litologica '{u_lito}' invalida.")
            else:
                matched_record = None
                for rec in group_records:
                    l1_match = (rec["lito1"].upper() == l1.upper()) or (rec["lito1"] == "MBX / varios" and l1.upper() in ["MBX", "VARIOS"])
                    l2_match = rec["lito2"].upper() == l2.upper()
                    l3_match = (rec["lito3"].upper() == l3.upper()) or (rec["lito3"] == "-" and l3 == "")
                    if l1_match and l2_match and l3_match:
                        matched_record = rec
                        break
                if not matched_record:
                    registrar_error("Lito 1", l1, "ALERTA", f"Asociacion litoestratigrafica invalida [{l1} | {l2} | {l3}].")

        # Campaña (Col 79)
        camp_yr = sanitize_value(get_row_val(row_dict, "Campaña"), int)
        if camp_yr is not None and not (2000 <= camp_yr <= datetime.now().year):
            registrar_error("Campaña", camp_yr, "ALERTA", "Año de campaña fuera del limite.")

        if not row_has_errors:
            total_ok += 1

        if (idx + 1) % 100000 == 0:
            print(f"[*] Procesados {idx + 1} de {total_filas} registros...")

    total_celdas_ok = sum(1 for c, data in resumen_celdas.items() if data["alertas"] == 0 and data["vacios"] == 0)
    for c, data in resumen_celdas.items():
        if data["alertas"] > 0:
            data["estado_celda"] = "ALERTA"
        elif data["vacios"] > 0 or data["advertencias"] > 0:
            data["estado_celda"] = "ADVERTENCIA"
        else:
            data["estado_celda"] = "OK"

    # 4. Cálculo matemático del universo total de celdas geomecanicas evaluadas
    total_celdas_evaluadas = total_filas * MANDATORY_COLS_COUNT

    output_json = {
        "total_filas_procesadas": total_filas,
        "total_celdas_evaluadas": total_celdas_evaluadas,
        "metricas_globales": {
            "total_celdas_padre": len(resumen_celdas),
            "total_celdas_hija_procesadas": total_filas,
            "total_ok": total_ok,
            "total_vacios": total_vacios,
            "total_advertencias": total_advertencias,
            "total_alertas": total_alertas,
            "total_celdas_ok": total_celdas_ok
        },
        "distribucion_filas_campana": filas_por_campana,
        "distribucion_filas_geotecnico": filas_por_geotecnico,
        "vacios_por_campana": vacios_por_campana,
        "vacios_por_geotecnico": vacios_por_geotecnico,
        "incidencias": incidencias,
        "resumen_por_celda_padre": resumen_celdas
    }

    print(f"[*] Escribiendo reporte consolidado en: {output_json_path}")
    try:
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(output_json, f, ensure_ascii=False)
        print("[+] Proceso de validación masivo completado con éxito.")
    except Exception as e:
        print(f"[-] Error escribiendo reporte JSON: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validador de Ingesta Geomecánica Masiva v2.0")
    parser.add_argument("--input", required=True, help="Ruta de acceso a la planilla Excel (.xlsx, .xls)")
    parser.add_argument("--output", default="salida_metricas.json", help="Ruta del JSON de analiticas de salida")
    
    args = parser.parse_args()
    if not os.path.exists(args.input):
        print(f"[-] Archivo de entrada inexistente: {args.input}")
        sys.exit(1)
        
    start_time = datetime.now()
    validate_bulk_excel(args.input, args.output)
    duration = datetime.now() - start_time
    print(f"[*] Tiempo de ejecucion: {duration.total_seconds():.2f} segundos.")
