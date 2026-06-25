import os
import sys
import json
import math
from datetime import datetime
import pandas as pd
import numpy as np

from app.core.catalogs import LITHOLOGY_CATALOG, NORM_GROUP_MAP, MANDATORY_COLS_COUNT

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

# --- FUNCIONES DE VALIDACIÓN SEGMENTADAS ---

def validate_row_coordinates(row_dict, registrar_error):
    e_from = sanitize_value(get_row_val(row_dict, 'ESTE_FROM'), float)
    n_from = sanitize_value(get_row_val(row_dict, 'NORTE_FROM'), float)
    c_from = sanitize_value(get_row_val(row_dict, 'COTA_FROM'), float)
    e_to = sanitize_value(get_row_val(row_dict, 'ESTE_TO'), float)
    n_to = sanitize_value(get_row_val(row_dict, 'NORTE_TO'), float)
    c_to = sanitize_value(get_row_val(row_dict, 'COTA_TO'), float)
    
    if e_from is not None and not (100000.0 <= e_from <= 999999.0):
        registrar_error("ESTE_FROM", e_from, "ALERTA", "Coordenada Este_From fuera de rango UTM válido.")
    if n_from is not None and not (1000000.0 <= n_from <= 9999999.0):
        registrar_error("NORTE_FROM", n_from, "ALERTA", "Coordenada Norte_From fuera de rango UTM válido.")
    if c_from is not None and not (0.0 <= c_from <= 5000.0):
        registrar_error("COTA_FROM", c_from, "ALERTA", "Elevación Cota_From fuera de rango [0, 5000].")

    if e_to is not None and not (100000.0 <= e_to <= 999999.0):
        registrar_error("ESTE_TO", e_to, "ALERTA", "Coordenada Este_To fuera de rango UTM válido.")
    elif e_to is not None and e_to == e_from:
        registrar_error("ESTE_TO", e_to, "ADVERTENCIA", "La coordenada Este_To es exactamente igual a Este_From.")
    if n_to is not None and not (1000000.0 <= n_to <= 9999999.0):
        registrar_error("NORTE_TO", n_to, "ALERTA", "Coordenada Norte_To fuera de rango UTM válido.")
    elif n_to is not None and n_to == n_from:
        registrar_error("NORTE_TO", n_to, "ADVERTENCIA", "La coordenada Norte_To es exactamente igual a Norte_From.")
    if c_to is not None and not (0.0 <= c_to <= 5000.0):
        registrar_error("COTA_TO", c_to, "ALERTA", "Elevación Cota_To fuera de rango [0, 5000].")
    elif c_to is not None and c_from is not None and abs(c_to - c_from) > 5.0:
        registrar_error("COTA_TO", c_to, "ADVERTENCIA", f"Variación abrupta de cota vertical entre extremos (> 5m). Delta: {abs(c_to - c_from):.2f}m")

def validate_row_geomechanics_76_89(row_dict, registrar_error):
    gsi_76 = sanitize_value(get_row_val(row_dict, "GSI VISUAL  '76"), int)
    if gsi_76 is not None and not (10 <= gsi_76 <= 95):
        registrar_error("GSI VISUAL  '76", gsi_76, "ALERTA", "GSI visual '76 fuera de rango.")
        
    gsi_89 = sanitize_value(get_row_val(row_dict, "GSI VISUAL '89"), int)
    if gsi_89 is not None and not (10 <= gsi_89 <= 95):
        registrar_error("GSI VISUAL '89", gsi_89, "ALERTA", "GSI visual '89 fuera de rango.")

    rmr_76 = sanitize_value(get_row_val(row_dict, "RMR '76"), float)
    rmr_89 = sanitize_value(get_row_val(row_dict, "RMR '89"), float)
    if rmr_76 is not None and not (0.0 <= rmr_76 <= 100.0):
        registrar_error("RMR '76", rmr_76, "ALERTA", "Puntuación final RMR '76 fuera de escala.")
    if rmr_89 is not None and not (0.0 <= rmr_89 <= 100.0):
        registrar_error("RMR '89", rmr_89, "ALERTA", "Puntuación final RMR '89 fuera de escala.")
    if rmr_76 is not None and rmr_89 is not None and abs(rmr_89 - rmr_76) > 15.0:
        registrar_error("RMR '89", rmr_89, "ADVERTENCIA", f"Diferencia excesiva entre RMR '89 ({rmr_89:.1f}) y RMR '76 ({rmr_76:.1f}) (> 15 puntos).")

def validate_row_lithology(row_dict, registrar_error):
    l1 = sanitize_value(get_row_val(row_dict, "Lito 1"), str)
    l2 = sanitize_value(get_row_val(row_dict, "Lito 2"), str)
    l3 = sanitize_value(row_dict.get("Lito 3"), str)
    u_lito = sanitize_value(row_dict.get("Unidad Litologica"), str)
    
    if all(v is not None for v in [l1, l2, l3, u_lito]):
        group_canonico = NORM_GROUP_MAP.get(u_lito.upper(), u_lito.upper())
        group_records = LITHOLOGY_CATALOG.get(group_canonico)
        if not group_records:
            registrar_error("Unidad Litologica", u_lito, "ALERTA", f"Unidad litológica '{u_lito}' inválida.")
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
                registrar_error("Lito 1", l1, "ALERTA", f"Asociación litoestratigráfica inválida [{l1} | {l2} | {l3}].")

# --- PROCESADOR PRINCIPAL EN VOLUMEN ---

def validate_bulk_excel(file_path, output_json_path):
    print(f"[*] Leyendo archivo Excel: {file_path}")
    try: df = pd.read_excel(file_path, engine='openpyxl')
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

        # 2. Validaciones lógicas segmentadas
        validate_row_coordinates(row_dict, registrar_error)
        validate_row_geomechanics_76_89(row_dict, registrar_error)
        validate_row_lithology(row_dict, registrar_error)

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