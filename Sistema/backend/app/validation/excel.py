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
from app.core.rules import RULES_REGISTRY, CATEGORIES_REGISTRY, GEOMECHANICAL_THRESHOLDS
from app.utils.interpolation import rating_continuo_rqd, rating_continuo_r1

class AuditCancelledError(Exception):
    """Se lanza cuando el usuario cancela una auditoría en curso (flag de cancelación presente)."""

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

# Compatibility exports: a single implementation shared with interactive validation.
from app.validation.predicates import (
    get_row_val,
    sanitize_value,
    is_within_tolerance,
    match_lito_column,
    normalize_geological_group,
    validate_geotechnical_header,
    validate_geomechanical_properties,
    validate_structural_row,
    validate_lithology_correlation
)

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

def validate_bulk_excel(file_path, output_json_path, cancel_flag_path: str = None, project: str = "ferrobamba"):
    t_start = time.time()
    print(f"    [*] [QA/QC] Iniciando lectura de archivo: {os.path.basename(file_path)}")
    
    try: 
        xls = pd.ExcelFile(file_path, engine='openpyxl')
        sheet_names = xls.sheet_names
        
        # Validar si el archivo es un reporte del sistema ya procesado
        is_report = any("DASHBOARD" in s.upper() or "ERRORES" in s.upper() or "INCIDENCIAS" in s.upper() for s in sheet_names)
        if is_report:
            raise ValueError("El archivo cargado es un reporte de revisión generado por el sistema. Por favor, cargue la base de datos geomecánica original con sus celdas de mapeo.")
            
        df = pd.read_excel(xls, sheet_name=sheet_names[0])
        xls.close()  # liberar el handle del archivo (en Windows impide borrar/limpiar el .xlsx)
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
    parent_coords_map = {}
    seen_celda_blocks = {}
    seen_coords_cells = {}
    active_celda_padre = None
    active_block_key = None

    for idx, row_dict in enumerate(records):
        # Cancelación cooperativa: revisar el flag cada 2000 filas para abortar rápido
        if cancel_flag_path and idx % 2000 == 0 and os.path.exists(cancel_flag_path):
            raise AuditCancelledError(f"Revisión cancelada por el usuario en la fila {idx + 2}.")
        fila_excel = idx + 2 
        celda_padre = sanitize_value(get_row_val(row_dict, 'CELDA_PADRE'), str)
        if not celda_padre:
            association_rule = RULES_REGISTRY['ERR_CELDA_PADRE_MISSING']
            if not association_rule.enabled or 'backend' not in association_rule.scope or 'excel_review' not in association_rule.operations:
                continue
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
            if not rule.enabled or 'backend' not in rule.scope or 'excel_review' not in rule.operations:
                return
            cat = CATEGORIES_REGISTRY.get(rule.category_code)
            tipo = cat.severity if cat else "ALERTA"
            msg_admin = rule.format_message(es_admin=True, **msg_kwargs)
            msg_no_admin = rule.format_message(es_admin=False, **msg_kwargs)
            try:
                rec_text = rule.recommendation_template.format(**msg_kwargs) if rule.recommendation_template else ""
            except Exception:
                rec_text = rule.recommendation_template
            
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
            elif col == "x, y, z":
                vx = get_row_val(row_dict, "x") or get_row_val(row_dict, "X")
                vy = get_row_val(row_dict, "y") or get_row_val(row_dict, "Y")
                vz = get_row_val(row_dict, "z") or get_row_val(row_dict, "Z")
                formatted_val = f"({format_raw_value_for_report(vx)}, {format_raw_value_for_report(vy)}, {format_raw_value_for_report(vz)})"
            else:
                raw_excel_val = get_row_val(row_dict, actual_col)
                formatted_val = format_raw_value_for_report(raw_excel_val)
            
            incidencias.append({
                "fila_excel": fila_excel, "celda_padre": celda_padre, "celda_hija": celda_hija,
                "columna": col, "valor_actual": formatted_val, 
                "rule_code": rule_code,
                "tipo_incidencia": tipo, 
                "mensaje": msg_admin,
                "mensaje_no_admin": msg_no_admin,
                "recomendacion": rec_text,
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
        raw_tipo = (
            get_row_val(row_dict, 'TIPO') or 
            get_row_val(row_dict, 'TIPO DE ESTRUCT') or 
            get_row_val(row_dict, 'TIPO DE ESTRUCTURA')
        )
        is_tipo_sin_registro = str(raw_tipo).strip() in ['-1', '-1.0'] if raw_tipo is not None else False

        # Comprobación de unicidad de código de celda
        if is_parent_row:
            if celda_padre in seen_celda_blocks and seen_celda_blocks[celda_padre] != fila_excel:
                registrar_error("CELDA", celda_padre, "ERR_CODIGO_CELDA_DUPLICADO", codigo=celda_padre, fila_orig=seen_celda_blocks[celda_padre])
            else:
                seen_celda_blocks[celda_padre] = fila_excel

        structural_mandatory_cols = [
            'TIPO', 'TIPO DE ESTRUCT', 'TIPO DE ESTRUCTURA', 'JRC', 'RUGOSIDAD DE ESTRUCTURAS', 
            'FORMA DE ESTRUCTURA', 'ALTERACION', 'ESPESOR mm.', 'ABERTURA mm.', 'CONTINUIDAD m.', 
            'ESPACIAMIENTO m.', 'DIP_ESTRUC', 'DIP DIR', 'NUMERO DE ESTRUCTURAS', 'N_ESTRUCTURAS',
            'TIPO DE  RELLENO 1', 'TIPO DE RELLENO 1', 'Dist. de estr.', 'DISTANCIA', 'DISTANCIA DE ESTRUCTURA',
            'x', 'y', 'z', 'X', 'Y', 'Z'
        ]
        structural_mandatory_clean = [clean_col_name(c) for c in structural_mandatory_cols]

        for col_key in df.columns:
            if col_key in ['COMENTARIO', 'CELDA_DUPLICADA_IGNORE', 'TIPO DE  RELLENO 2', 'TIPO DE RELLENO 2'] or str(col_key).startswith('Unnamed:'): 
                continue
                
            # Si la fila tiene TIPO == "-1", se desactiva la obligatoriedad de campos de discontinuidad
            if is_tipo_sin_registro and clean_col_name(col_key) in structural_mandatory_clean:
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
        debe_validar_global = is_parent_row
        if not is_parent_row:
            # Verificamos si hay alguna columna de cabecera o geomecánica que tenga un valor explícito en esta fila secundaria
            for col in resolved_propagate_cols:
                if sanitize_value(row_dict.get(col), str) is not None:
                    debe_validar_global = True
                    break

        if debe_validar_global:
            # Coordenadas espaciales de la celda
            ef = sanitize_value(get_row_val(row_dict, 'ESTE_FROM'), float)
            nf = sanitize_value(get_row_val(row_dict, 'NORTE_FROM'), float)
            cf = sanitize_value(get_row_val(row_dict, 'COTA_FROM') or get_row_val(row_dict, 'COTA'), float)
            et = sanitize_value(get_row_val(row_dict, 'ESTE_TO'), float)
            nt = sanitize_value(get_row_val(row_dict, 'NORTE_TO'), float)
            ct = sanitize_value(get_row_val(row_dict, 'COTA_TO') or get_row_val(row_dict, 'COTA.1'), float)
            
            coords_valid = all(val is not None for val in [ef, nf, cf, et, nt, ct]) and not (ef == 0 and nf == 0 and cf == 0)
            
            largo_calc = None
            if coords_valid:
                dx = et - ef
                dy = nt - nf
                dz = ct - cf
                largo_calc = math.sqrt(dx*dx + dy*dy + dz*dz)
                
            largo_val = largo_calc if (largo_calc is not None and largo_calc > 0) else resolved_dist_celda
            
            # Guardar coordenadas de la celda padre para las estructuras hijas
            if is_parent_row:
                parent_coords_map[active_block_key] = (ef, nf, cf, et, nt, ct)

                # A. Comprobar que las coordenadas no estén fuera del rango recomendado del proyecto
                coords_check = [
                    ("ESTE_FROM", ef, GEOMECHANICAL_THRESHOLDS["COORD_ESTE_MIN"], GEOMECHANICAL_THRESHOLDS["COORD_ESTE_MAX"]),
                    ("NORTE_FROM", nf, GEOMECHANICAL_THRESHOLDS["COORD_NORTE_MIN"], GEOMECHANICAL_THRESHOLDS["COORD_NORTE_MAX"]),
                    ("COTA_FROM", cf, GEOMECHANICAL_THRESHOLDS["COORD_COTA_MIN"], GEOMECHANICAL_THRESHOLDS["COORD_COTA_MAX"]),
                    ("ESTE_TO", et, GEOMECHANICAL_THRESHOLDS["COORD_ESTE_MIN"], GEOMECHANICAL_THRESHOLDS["COORD_ESTE_MAX"]),
                    ("NORTE_TO", nt, GEOMECHANICAL_THRESHOLDS["COORD_NORTE_MIN"], GEOMECHANICAL_THRESHOLDS["COORD_NORTE_MAX"]),
                    ("COTA_TO", ct, GEOMECHANICAL_THRESHOLDS["COORD_COTA_MIN"], GEOMECHANICAL_THRESHOLDS["COORD_COTA_MAX"])
                ]
                for c_col, c_val, c_min, c_max in coords_check:
                    if c_val is not None and not (c_min <= c_val <= c_max):
                        registrar_error(c_col, c_val, "GEOM_ERR_COORD_FUERA_DE_PROYECTO", columna=c_col, valor=c_val)

                # B. Comprobar segmento degenerado (FROM == TO) y Distancia 3D
                if coords_valid:
                    if largo_calc is not None and largo_calc < GEOMECHANICAL_THRESHOLDS['MIN_SEGMENT_LENGTH']:
                        registrar_error("ESTE_FROM", ef, "GEOM_ERR_SEGMENTO_DEGENERADO")

                    # C. Coordenadas duplicadas entre celdas distintas
                    coord_key = (round(ef, 2), round(nf, 2), round(cf, 2), round(et, 2), round(nt, 2), round(ct, 2))
                    if coord_key in seen_coords_cells:
                        prev_cell, prev_fila = seen_coords_cells[coord_key]
                        if prev_cell != celda_padre:
                            registrar_error("ESTE_FROM", ef, "ERR_COORDENADAS_CELDA_DUPLICADAS", codigo=celda_padre, otro_codigo=prev_cell, fila_orig=prev_fila)
                    else:
                        seen_coords_cells[coord_key] = (celda_padre, fila_excel)

                    # D. Discrepancia Dist.Celda declarada vs 3D (> 5m ALERTA)
                    if resolved_dist_celda is not None and largo_calc is not None:
                        diff_d = abs(largo_calc - resolved_dist_celda)
                        if diff_d > GEOMECHANICAL_THRESHOLDS["DISTANCIA_CELDA_MAX_DIFF"]:
                            registrar_error("Dist.Celda", resolved_dist_celda, "ERR_DISTANCIA_CELDA_DISCREPANCIA_COORD", decl=round(resolved_dist_celda, 2), calc=round(largo_calc, 2), diff=round(diff_d, 2))

                # E. Cota vs Nivel (Tolerancia 20m)
                raw_nivel = get_row_val(row_dict, "Nivel") or get_row_val(row_dict, "NIVEL")
                nivel_val = sanitize_value(raw_nivel, float)
                if nivel_val is not None and cf is not None and ct is not None:
                    cota_prom = (cf + ct) / 2.0
                    diff_nivel = abs(cota_prom - nivel_val)
                    if diff_nivel > GEOMECHANICAL_THRESHOLDS["COTA_VS_NIVEL_MAX_DIFF"]:
                        registrar_error("Nivel", raw_nivel, "GEOM_WRN_COTA_VS_NIVEL", cota_prom=round(cota_prom, 2), diff=round(diff_nivel, 2), nivel=raw_nivel)
            
            # Comparar DIP_TALUD de fila hija contra el valor de la fila maestra (parent_properties) con 2° de tolerancia
            if not is_parent_row:
                parent_dip_talud = props.get("dip_talud")
                entered_dip_talud = sanitize_value(get_row_val(row_dict, 'DIP_TALUD'), float, allow_negative=True)
                if entered_dip_talud is not None and parent_dip_talud is not None:
                    if abs(abs(entered_dip_talud) - abs(parent_dip_talud)) > 2.0:
                        registrar_error("DIP_TALUD", entered_dip_talud, "WRN_DIP_TALUD_DISCREPANCIA", actual=entered_dip_talud, expected=parent_dip_talud)

            validate_geotechnical_header(row_dict, registrar_error)
            validate_geomechanical_properties(row_dict, registrar_error, resolved_camp)
            validate_lithology_correlation(row_dict, registrar_error, project=project)
            
        curr_coords = parent_coords_map.get(active_block_key)
        validate_structural_row(row_dict, resolved_dist_celda, registrar_error, parent_coords=curr_coords)

        from app.validation.service import evaluate_excel_extensions
        evaluate_excel_extensions(row_dict, resolved_dist_celda, registrar_error,
                                  campaign_year=resolved_camp, is_parent=is_parent_row)
        if not row_has_errors: total_ok += 1

    total_celdas_ok = sum(1 for c, data in resumen_celdas.items() if data["alertas"] == 0 and data["vacios"] == 0)
    for c, data in resumen_celdas.items():
        if data["alertas"] > 0: data["estado_celda"] = "ALERTA"
        elif data["vacios"] > 0 or data["advertencias"] > 0: data["estado_celda"] = "ADVERTENCIA"
        else: data["estado_celda"] = "OK"

    from app.validation.service import ruleset_version
    output_json = {
        "ruleset_version": ruleset_version(),
        "proyecto": project,
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
