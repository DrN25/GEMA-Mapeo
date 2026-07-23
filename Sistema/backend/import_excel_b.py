#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
import_excel_b.py — Script para Importar Datos Mapeados desde Excel B a GEMA SQL Server
--------------------------------------------------------------------------------------
Este script lee un archivo Excel B (formato compilado/BD) y realiza lo siguiente:
1. Carga las variables de entorno desde backend/.env.
2. Agrupa los registros por 'CELDA' y hereda la cabecera (Forward Fill / ffill).
3. Resuelve los catálogos (FK IDs) usando GEMACatalogResolver.
4. Inserta las cabeceras en mapeo.VentanasMapeo y las discontinuidades en mapeo.EstructurasGeologicas.
5. Calcula automáticamente NumeroEstructura (1..N) y FamiliaID (ceil(N/3)).

Uso:
    python import_excel_b.py [--excel RUTA_EXCEL] [--clean]
"""

import sys
import os
import math
import argparse
import pandas as pd
from datetime import datetime

# Asegurar que el directorio de backend esté en el sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, ".env"))

from app.database import SessionLocal
from app import models
from app.routers.ventanas import GEMACatalogResolver
from app.utils.validator import sanitize_value, clean_and_rename_columns, get_row_val


def get_row_val_robust(row_dict, possible_names):
    """Busca resiliente en diccionario de fila."""
    if isinstance(possible_names, str):
        possible_names = [possible_names]
        
    cleaned_row = {}
    for k, v in row_dict.items():
        k_str = str(k).strip().upper()
        k_clean = " ".join(k_str.replace("'", "").replace('"', '').split())
        cleaned_row[k_clean] = v
        
    for name in possible_names:
        name_str = str(name).strip().upper()
        name_clean = " ".join(name_str.replace("'", "").replace('"', '').split())
        if name_clean in cleaned_row:
            val = cleaned_row[name_clean]
            if pd.notna(val) and val not in (-1, -1.0, "-1", "-1.0", "NAN", "None"):
                return val
            
    for name in possible_names:
        val = get_row_val(row_dict, name)
        if val is not None and val not in (-1, -1.0, "-1", "-1.0"):
            return val
            
    return None


def clean_num(val):
    """Limpia valores numéricos descartando nulos, NaNs o sentinelas -1."""
    if val is None or pd.isna(val):
        return None
    try:
        f = float(val)
        if f in (-1.0, -1):
            return None
        return f
    except (ValueError, TypeError):
        return None


def clean_str(val):
    """Limpia valores de texto descartando nulos o sentinelas -1."""
    if val is None or pd.isna(val):
        return None
    s = str(val).strip()
    if s in ("", "-1", "-1.0", "None", "nan", "NaN"):
        return None
    return s


def import_excel_b(excel_path: str, clean_first: bool = False):
    print("=" * 80)
    print(f"[+] INICIANDO IMPORTACION DESDE EXCEL B")
    print("=" * 80)

    target_file = excel_path
    if os.path.isdir(target_file):
        candidates = [
            os.path.join(target_file, f) for f in os.listdir(target_file)
            if f.endswith(('.xlsx', '.xls')) and not f.startswith('~$')
        ]
        if candidates:
            b_match = next((c for c in candidates if 'Excel_B' in os.path.basename(c) or 'BD' in os.path.basename(c)), candidates[0])
            target_file = b_match
            print(f"[+] Se detecto una carpeta en la ruta. Seleccionando archivo: {target_file}")
        else:
            print(f"[ERROR] No se encontraron archivos Excel (.xlsx/.xls) en la carpeta '{target_file}'.")
            sys.exit(1)

    if not os.path.isfile(target_file):
        print(f"[ERROR] El archivo de Excel '{target_file}' no existe o no es un archivo valido.")
        sys.exit(1)

    # 1. Leer Excel con pandas primero para asegurar que el archivo es valido
    print(f"[+] Leyendo archivo de Excel: {target_file}...")
    try:
        df = pd.read_excel(target_file)
    except Exception as e:
        print(f"[ERROR] No se pudo leer el archivo Excel '{target_file}': {e}")
        sys.exit(1)

    print(f"[+] Total de filas en Excel: {len(df)} | Total de columnas: {len(df.columns)}")

    # Encontrar la columna de Celda
    celda_col = None
    for c in df.columns:
        if str(c).strip().upper() in ['CELDA', 'CELDA_PADRE', 'CODIGOCELDA']:
            celda_col = c
            break

    if not celda_col:
        print("[ERROR] No se encontro la columna 'CELDA' en el archivo Excel.")
        sys.exit(1)

    db = SessionLocal()
    resolver = GEMACatalogResolver(db)

    # 2. Limpieza previa si se solicita (SOLO despues de verificar que el Excel es valido)
    if clean_first:
        print("[+] Eliminando registros existentes de mapeo.EstructurasGeologicas y mapeo.VentanasMapeo...")
        db.execute(models.EstructuraGeologica.__table__.delete())
        db.execute(models.Ventana.__table__.delete())
        db.commit()
        print("[OK] Tablas limpiadas con exito.")

    # Definir columnas de cabecera a heredar (ffill)
    header_cols = [
        celda_col, 'ESTE_FROM', 'NORTE_FROM', 'COTA', 'ESTE_TO', 'NORTE_TO', 'COTA.1',
        'Dist.Celda', 'Altura', 'DIP', 'AZ_HOLE', 'DIP_TALUD', 'DIP DIR_TALUD', 'INTEMPERISMO',
        "CONDICION DE AGUA  '76.", "CONDICION DE AGUA VALOR  '76", "DUREZA  '76", "RESISTENCIA ESTIMADA VALOR  '76",
        "GSI VISUAL  '76", "CONTROL ESTRUCTURAL  '76", "EFECTOS DE VOLADURA  '76", "RQD - VALOR  '76", "RQD  '76",
        "FRECUENCIA DE FRACTURAMIENTO x m.  '76", "TAMAÑO DE BLOQUES  x m3  '76", "ESPACIAMIENTO PROMEDIO   '76",
        "ESPACIAMIENTO - VALOR    '76", "CONDICIÓN DE DISCONTINUIDAD - VALOR     '76", "RMR '76",
        "( UCS )  (Mpa)", "is50 (Mpa)", "CONDICION DE AGUA  '89", "CONDICION DE AGUA VALOR '89", "DUREZA '89",
        "RESISTENCIA ESTIMADA VALOR '89", "GSI VISUAL '89", "CONTROL ESTRUCTURAL '89", "EFECTOS DE VOLADURA '89",
        "RQD - VALOR '89", "RQD '89", "FRECUENCIA DE FRACTURAMIENTO x m. '89", "TAMAÑO DE BLOQUES  x m3 '89",
        "ESPACIAMIENTO PROMEDIO '89", "ESPACIAMIENTO - VALOR '89", "CONDICIÓN DE DISCONTINUIDAD - VALOR '89", "RMR '89",
        'FECHA', 'COMENTARIO', 'GEOTECNICO', 'Nivel', 'Lito 1', 'Lito 2', 'Lito 3', 'Unidad Litologica',
        'Sector Geotecnicos', 'Campaña', 'Año', 'Ano'
    ]

    for col in header_cols:
        if col in df.columns:
            df[col] = df[col].ffill()

    # Agrupar por celda
    grouped = df.groupby(celda_col, sort=False)
    print(f"[+] Total de Celdas (Ventanas) a procesar: {len(grouped)}")

    ventanas_creadas = 0
    estructuras_creadas = 0

    for code_raw, block_df in grouped:
        code_celda = clean_str(code_raw)
        if not code_celda:
            continue

        records = block_df.to_dict(orient="records")
        header_row = records[0]

        # Resolver catálogos FK
        sector_str = clean_str(get_row_val_robust(header_row, ['Sector Geotecnicos', 'Sector', 'SECTOR_GEOTECNICO'])) or 'PENDIENTE'
        sector_id = resolver.sector_id(sector_str)

        campania_val = get_row_val_robust(header_row, ['Campaña', 'Año', 'Ano', 'Campanha', 'FECHA']) or 2026
        campania_id = resolver.resolve_campania_id(campania_val)

        lito1_str = clean_str(get_row_val_robust(header_row, ['Lito 1', 'LITO1']))
        lito2_str = clean_str(get_row_val_robust(header_row, ['Lito 2', 'LITO2']))
        lito3_str = clean_str(get_row_val_robust(header_row, ['Lito 3', 'LITO3']))
        unidad_str = clean_str(get_row_val_robust(header_row, ['Unidad Litologica', 'UNIDAD_LITO']))

        lito1_id = resolver.litologia_id(lito1_str)
        lito2_id = resolver.litologia_id(lito2_str)
        lito3_id = resolver.litologia_id(lito3_str)
        unidad_id = resolver.unidad_litologica_id(unidad_str)
        if unidad_id is None and lito1_str:
            unidad_id = resolver.infer_unidad_id_from_lito(lito1_str)

        geotecnico_str = clean_str(get_row_val_robust(header_row, ['GEOTECNICO', 'Mapeador', 'GEOLOGO'])) or 'SRK'
        geotecnico_id = resolver.geotecnico_id(geotecnico_str)

        # Parsear fecha
        fecha_val = get_row_val_robust(header_row, ['FECHA', 'FechaMapeo'])
        fecha_mapeo = None
        if isinstance(fecha_val, (pd.Timestamp, datetime)):
            fecha_mapeo = fecha_val.date()
        elif isinstance(fecha_val, str) and len(fecha_val) >= 10:
            try:
                fecha_mapeo = datetime.strptime(fecha_val[:10], "%Y-%m-%d").date()
            except ValueError:
                pass

        # Buscar si la ventana ya existe en la BD
        v = db.query(models.Ventana).filter_by(codigo_celda=code_celda).first()
        if not v:
            v = models.Ventana(codigo_celda=code_celda, campania_id=campania_id, sector_geotecnico_id=sector_id)
            db.add(v)

        # Asignar campos de cabecera
        v.campania_id = campania_id
        v.sector_geotecnico_id = sector_id
        v.fecha_mapeo = fecha_mapeo
        v.nivel = clean_str(get_row_val_robust(header_row, ['Nivel', 'NIVEL']))
        v.este_from = clean_num(get_row_val_robust(header_row, ['ESTE_FROM'])) or 0.0
        v.norte_from = clean_num(get_row_val_robust(header_row, ['NORTE_FROM'])) or 0.0
        v.cota_from = clean_num(get_row_val_robust(header_row, ['COTA'])) or 0.0
        v.este_to = clean_num(get_row_val_robust(header_row, ['ESTE_TO'])) or 0.0
        v.norte_to = clean_num(get_row_val_robust(header_row, ['NORTE_TO'])) or 0.0
        v.cota_to = clean_num(get_row_val_robust(header_row, ['COTA.1', 'COTA_TO'])) or 0.0
        v.distancia_celda = clean_num(get_row_val_robust(header_row, ['Dist.Celda', 'DISTANCIA_CELDA']))
        v.altura = clean_num(get_row_val_robust(header_row, ['Altura', 'ALTURA']))
        v.dip = clean_num(get_row_val_robust(header_row, ['DIP']))
        v.azimut_hole = clean_num(get_row_val_robust(header_row, ['AZ_HOLE']))
        v.dip_talud = clean_num(get_row_val_robust(header_row, ['DIP_TALUD']))
        v.dip_dir_talud = clean_num(get_row_val_robust(header_row, ['DIP DIR_TALUD', 'DIPDIR_TALUD']))

        v.litologia1_id = lito1_id
        v.litologia2_id = lito2_id
        v.litologia3_id = lito3_id
        v.unidad_litologica_id = unidad_id
        v.grado_intemperismo = clean_str(get_row_val_robust(header_row, ['INTEMPERISMO']))
        v.geotecnico_id = geotecnico_id
        v.comentarios = clean_str(get_row_val_robust(header_row, ['COMENTARIO']))

        # Campons RMR '76 (cabecera)
        v.condicion_agua_rmr76 = clean_str(get_row_val_robust(header_row, ["CONDICION DE AGUA  '76."]))
        v.condicion_agua_valor_rmr76 = clean_num(get_row_val_robust(header_row, ["CONDICION DE AGUA VALOR  '76"]))
        v.dureza_rmr76 = clean_str(get_row_val_robust(header_row, ["DUREZA  '76"]))
        v.resistencia_estimada_valor_rmr76 = clean_num(get_row_val_robust(header_row, ["RESISTENCIA ESTIMADA VALOR  '76"]))
        v.gsi_visual_rmr76 = clean_num(get_row_val_robust(header_row, ["GSI VISUAL  '76"]))
        v.control_estructural_rmr76 = clean_str(get_row_val_robust(header_row, ["CONTROL ESTRUCTURAL  '76"]))
        v.efectos_voladura_rmr76 = clean_str(get_row_val_robust(header_row, ["EFECTOS DE VOLADURA  '76"]))
        v.rqd_valor_rmr76 = clean_num(get_row_val_robust(header_row, ["RQD - VALOR  '76"]))
        v.rqd_rmr76 = clean_num(get_row_val_robust(header_row, ["RQD  '76"]))
        v.frecuencia_fracturamiento_rmr76 = clean_num(get_row_val_robust(header_row, ["FRECUENCIA DE FRACTURAMIENTO x m.  '76"]))
        v.tamano_bloques_rmr76 = clean_num(get_row_val_robust(header_row, ["TAMAÑO DE BLOQUES  x m3  '76"]))
        v.espaciamiento_promedio_rmr76 = clean_num(get_row_val_robust(header_row, ["ESPACIAMIENTO PROMEDIO   '76"]))
        v.espaciamiento_valor_rmr76 = clean_num(get_row_val_robust(header_row, ["ESPACIAMIENTO - VALOR    '76"]))
        v.condicion_discontinuidad_valor_rmr76 = clean_num(get_row_val_robust(header_row, ["CONDICIÓN DE DISCONTINUIDAD - VALOR     '76"]))
        v.rmr76_total = clean_num(get_row_val_robust(header_row, ["RMR '76"]))

        # Campos RMR '89 (cabecera)
        v.condicion_agua_rmr89 = clean_str(get_row_val_robust(header_row, ["CONDICION DE AGUA  '89"]))
        v.condicion_agua_valor_rmr89 = clean_num(get_row_val_robust(header_row, ["CONDICION DE AGUA VALOR '89"]))
        v.dureza_rmr89 = clean_str(get_row_val_robust(header_row, ["DUREZA '89"]))
        v.resistencia_estimada_valor_rmr89 = clean_num(get_row_val_robust(header_row, ["RESISTENCIA ESTIMADA VALOR '89"]))
        v.gsi_visual_rmr89 = clean_num(get_row_val_robust(header_row, ["GSI VISUAL '89"]))
        v.control_estructural_rmr89 = clean_str(get_row_val_robust(header_row, ["CONTROL ESTRUCTURAL '89"]))
        v.efectos_voladura_rmr89 = clean_str(get_row_val_robust(header_row, ["EFECTOS DE VOLADURA '89"]))
        v.rqd_valor_rmr89 = clean_num(get_row_val_robust(header_row, ["RQD - VALOR '89"]))
        v.rqd_rmr89 = clean_num(get_row_val_robust(header_row, ["RQD '89"]))
        v.frecuencia_fracturamiento_rmr89 = clean_num(get_row_val_robust(header_row, ["FRECUENCIA DE FRACTURAMIENTO x m. '89"]))
        v.tamano_bloques_rmr89 = clean_num(get_row_val_robust(header_row, ["TAMAÑO DE BLOQUES  x m3 '89"]))
        v.espaciamiento_promedio_rmr89 = clean_num(get_row_val_robust(header_row, ["ESPACIAMIENTO PROMEDIO '89"]))
        v.espaciamiento_valor_rmr89 = clean_num(get_row_val_robust(header_row, ["ESPACIAMIENTO - VALOR '89"]))
        v.condicion_discontinuidad_valor_rmr89 = clean_num(get_row_val_robust(header_row, ["CONDICIÓN DE DISCONTINUIDAD - VALOR '89"]))
        v.rmr89_total = clean_num(get_row_val_robust(header_row, ["RMR '89"]))

        v.ucs_mpa = clean_num(get_row_val_robust(header_row, ["( UCS )  (Mpa)"]))
        v.is50_mpa = clean_num(get_row_val_robust(header_row, ["is50 (Mpa)"]))

        # Limpiar estructuras anteriores de esta ventana si ya existía
        for old_est in list(v.discontinuidades):
            db.delete(old_est)

        db.flush()  # Garantizar obtención de ventana_id
        ventanas_creadas += 1

        # 3. Procesar las estructuras discontinuidades del bloque
        for struct_idx, row in enumerate(records):
            dip_val = clean_num(get_row_val_robust(row, ['DIP.1', 'DIP_ESTR', 'DIP']))
            dipdir_val = clean_num(get_row_val_robust(row, ['DIP DIR', 'DIPDIR']))

            # Si no hay dip ni dipdir válidos, ignorar fila vacía
            if dip_val is None and dipdir_val is None:
                continue

            tipo_str = clean_str(get_row_val_robust(row, ['TIPO', 'TIPO_ESTRUCTURA'])) or 'JN'
            tipo_id = resolver.tipo_estructura_id(tipo_str)

            num_est_slot = struct_idx + 1
            fam_id = math.ceil(num_est_slot / 3.0)

            n_est_input = sanitize_value(get_row_val_robust(row, ['NUMERO DE ESTRUCTURAS']), int)
            n_extremos = sanitize_value(get_row_val_robust(row, ['NUMERO DE EXTREMOS VISIBLES']), int)

            est = models.EstructuraGeologica(
                ventana_id=v.ventana_id,
                numero_estructura=num_est_slot,
                tipo_estructura_id=tipo_id,
                dip=dip_val if dip_val is not None else 0.0,
                dip_dir=dipdir_val if dipdir_val is not None else 0.0,
                distancia_estructura=clean_num(get_row_val_robust(row, ['Dist. de estr.', 'DISTANCIA_ESTRUCTURA'])),
                teta=clean_num(get_row_val_robust(row, ['teta', 'TETA'])),
                alfa=clean_num(get_row_val_robust(row, ['alfa', 'ALFA'])),
                x=clean_num(get_row_val_robust(row, ['x', 'X'])),
                y=clean_num(get_row_val_robust(row, ['y', 'Y'])),
                z=clean_num(get_row_val_robust(row, ['z', 'Z'])),
                abertura_mm=clean_num(get_row_val_robust(row, ['ABERTURA mm.', 'ABERTURA'])),
                espesor_mm=clean_num(get_row_val_robust(row, ['ESPESOR mm.', 'ESPESOR'])),
                continuidad_m=clean_num(get_row_val_robust(row, ['CONTINUIDAD m.', 'CONTINUIDAD'])),
                espaciamiento_m=clean_num(get_row_val_robust(row, ['ESPACIAMIENTO m.', 'ESPACIAMIENTO'])),
                numero_estructuras=n_est_input,
                numero_extremos_visibles=n_extremos,
                tipo_relleno_1=clean_str(get_row_val_robust(row, ['TIPO DE  RELLENO 1', 'TIPO_RELLENO_1'])),
                tipo_relleno_2=clean_str(get_row_val_robust(row, ['TIPO DE  RELLENO 2', 'TIPO_RELLENO_2'])),
                jrc=clean_num(get_row_val_robust(row, ['JRC'])),
                rugosidad_estructura=clean_str(get_row_val_robust(row, ['RUGOSIDAD DE ESTRUCTURAS', 'RUGOSIDAD'])),
                forma_estructura=clean_str(get_row_val_robust(row, ['FORMA DE ESTRUCTURA', 'FORMA'])),
                alteracion=clean_str(get_row_val_robust(row, ['ALTERACION'])),
                familia_id=fam_id
            )
            db.add(est)
            estructuras_creadas += 1

    print("[+] Guardando cambios en la base de datos SQL Server GEMA...")
    db.commit()
    db.close()

    print("\n" + "=" * 80)
    print("[OK] IMPORTACION COMPLETADA CON EXITO")
    print("=" * 80)
    print(f"[+] Ventanas / Celdas Creadas/Actualizadas: {ventanas_creadas}")
    print(f"[+] Estructuras / Discontinuidades Importadas: {estructuras_creadas}")
    print("=" * 80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Importar Excel B a GEMA SQL Server")
    default_excel = r"c:\Users\Rafael\UNSA\Projects\Ing. Materiales\mapeo_ventana_geomecanica\Material\Excel_B_BD.xlsx"
    parser.add_argument("--excel", type=str, default=default_excel, help="Ruta al archivo Excel B")
    parser.add_argument("--clean", action="store_true", help="Limpiar tablas antes de importar")
    args = parser.parse_args()

    import_excel_b(args.excel, clean_first=args.clean)
