import io
import math
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import SessionLocal
from app import models, schemas
from app.routers.ventanas import GEMACatalogResolver, serialize_ventana, get_db, calculate_and_persist_subratings
from app.utils.validator import get_row_val, sanitize_value
from app.core.catalogs import infer_lithology_from_lito3
from app.parsers.excel_a import detect_format, parse_excel_a, normalize_station_to_celda

router = APIRouter()


def clean_num(val):
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
    if val is None or pd.isna(val):
        return None
    s = str(val).strip()
    if s in ("", "-1", "-1.0", "None", "nan", "NaN"):
        return None
    return s


def get_row_val_robust(row_dict: dict, possible_names):
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


def check_duplicate(db: Session, code_celda: str):
    """Busca una celda en SQL Server y devuelve (is_duplicate, existing_data)."""
    code_up = code_celda.strip().upper()
    db_ventana = db.query(models.Ventana).filter_by(codigo_celda=code_up).first()
    is_duplicate = db_ventana is not None
    existing_data = None

    if db_ventana:
        lito1_code = db.query(models.Litologia.codigo).filter_by(litologia_id=db_ventana.litologia1_id).scalar() if db_ventana.litologia1_id else ''
        lito2_code = db.query(models.Litologia.codigo).filter_by(litologia_id=db_ventana.litologia2_id).scalar() if db_ventana.litologia2_id else ''
        lito3_code = db.query(models.Litologia.codigo).filter_by(litologia_id=db_ventana.litologia3_id).scalar() if db_ventana.litologia3_id else ''
        unidad_code = db.query(models.UnidadLitologica.codigo).filter_by(unidad_id=db_ventana.unidad_litologica_id).scalar() if db_ventana.unidad_litologica_id else ''
        sector_code = db.query(models.SectorGeotecnico.codigo).filter_by(sector_id=db_ventana.sector_geotecnico_id).scalar() if db_ventana.sector_geotecnico_id else 'PENDIENTE'
        geotecnico_name = db.query(models.Geotecnico.nombre).filter_by(geotecnico_id=db_ventana.geotecnico_id).scalar() if db_ventana.geotecnico_id else 'SRK'
        campania_name = db.query(models.Campania.nombre).filter_by(campania_id=db_ventana.campania_id).scalar() if db_ventana.campania_id else '2026'

        existing_data = {
            "codigo": db_ventana.codigo_celda,
            "campania": campania_name or 2026,
            "sector": sector_code or 'PENDIENTE',
            "este_ini": float(db_ventana.este_from or 0.0),
            "norte_ini": float(db_ventana.norte_from or 0.0),
            "cota_ini": float(db_ventana.cota_from or 0.0),
            "este_fin": float(db_ventana.este_to or 0.0),
            "norte_fin": float(db_ventana.norte_to or 0.0),
            "cota_fin": float(db_ventana.cota_to or 0.0),
            "largo_m": float(db_ventana.distancia_celda or 15.0),
            "altura_m": float(db_ventana.altura or 15.0),
            "lito_1": lito1_code or '',
            "lito_2": lito2_code or '',
            "lito_3": lito3_code or '',
            "unidad_litologica": unidad_code or '',
            "mapeador": geotecnico_name or 'N/A',
            "fecha": str(db_ventana.fecha_mapeo) if db_ventana.fecha_mapeo else 'N/A',
            "n_discontinuidades": len(db_ventana.discontinuidades),
            "rmr_76": float(db_ventana.rmr76_total) if db_ventana.rmr76_total is not None else None,
            "rmr_89": float(db_ventana.rmr89_total) if db_ventana.rmr89_total is not None else None
        }

    return is_duplicate, existing_data


STANDARD_FIELD_MAPPINGS = {    "codigo_celda": ["CELDA", "CELDA_PADRE", "CODIGOCELDA", "CELDA.1"],
    "este_from": ["ESTE_FROM", "ESTE_INI", "ESTE"],
    "norte_from": ["NORTE_FROM", "NORTE_INI", "NORTE"],
    "cota_from": ["COTA", "COTA_FROM", "COTA_INI", "ELEVACION"],
    "este_to": ["ESTE_TO", "ESTE_FIN"],
    "norte_to": ["NORTE_TO", "NORTE_FIN"],
    "cota_to": ["COTA.1", "COTA_TO", "COTA_FIN"],
    "distancia_celda": ["Dist.Celda", "DISTANCIA_CELDA", "LARGO"],
    "altura": ["Altura", "ALTURA"],
    "dip": ["DIP"],
    "azimut_hole": ["AZ_HOLE", "AZIMUT_HOLE"],
    "dip_talud": ["DIP_TALUD"],
    "dip_dir_talud": ["DIP DIR_TALUD", "DIPDIR_TALUD"],
    "intemperismo": ["INTEMPERISMO"],
    "mapeador": ["GEOTECNICO", "Mapeador", "GEOLOGO"],
    "nivel": ["Nivel", "NIVEL"],
    "lito_1": ["Lito 1", "LITO1"],
    "lito_2": ["Lito 2", "LITO2"],
    "lito_3": ["Lito 3", "LITO3"],
    "unidad_litologica": ["Unidad Litologica", "UNIDAD_LITO"],
    "sector": ["Sector Geotecnicos", "Sector", "SECTOR_GEOTECNICO"],
    "fecha": ["FECHA", "FechaMapeo"],
    "comentarios": ["COMENTARIO", "Comentarios"],

    # Campos Estructura
    "struct_dist": ["Dist. de estr.", "DISTANCIA_ESTRUCTURA"],
    "struct_tipo": ["TIPO", "TIPO_ESTRUCTURA"],
    "struct_dip": ["DIP.1", "DIP_ESTR", "DIP"],
    "struct_dipdir": ["DIP DIR", "DIPDIR"],
    "struct_abertura": ["ABERTURA mm.", "ABERTURA"],
    "struct_espesor": ["ESPESOR mm.", "ESPESOR"],
    "struct_continuidad": ["CONTINUIDAD m.", "CONTINUIDAD"],
    "struct_espaciamiento": ["ESPACIAMIENTO m.", "ESPACIAMIENTO"],
    "struct_n_estructuras": ["NUMERO DE ESTRUCTURAS"],
    "struct_extremos": ["NUMERO DE EXTREMOS VISIBLES"],
    "struct_relleno1": ["TIPO DE  RELLENO 1", "TIPO_RELLENO_1"],
    "struct_relleno2": ["TIPO DE  RELLENO 2", "TIPO_RELLENO_2"],
    "struct_jrc": ["JRC"],
    "struct_rugosidad": ["RUGOSIDAD DE ESTRUCTURAS", "RUGOSIDAD"],
    "struct_forma": ["FORMA DE ESTRUCTURA", "FORMA"],
    "struct_alteracion": ["ALTERACION"]
}


@router.post("/importar-excel/preview")
async def preview_import_excel(
    file: UploadFile = File(...),
    formato: str = "auto",
    hoja: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Previsualiza las celdas y discontinuidades de un Excel de mapeo.
    Detecta automáticamente el formato:
      - 'a' (estaciones): bloques por ancla 'UBICACIÓN' (parser excel_a).
      - 'b' (base de datos): tabla plana con columna 'CELDA' (lógica actual).
    Se procesa la hoja indicada (o la primera si no se especifica).
    """
    contents = await file.read()

    # Leer hojas disponibles con openpyxl (para selección y auto-detección)
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True, read_only=False)
        sheet_names = wb.sheetnames
        if hoja and hoja in sheet_names:
            ws = wb[hoja]
        else:
            ws = wb[sheet_names[0]]
            hoja = sheet_names[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo Excel: {e}")

    fmt = detect_format(ws)
    if fmt == "a":
        return _preview_excel_a(ws, db, hoja)

    # ---- Formato B: tabla plana con columna CELDA ----
    try:
        df = pd.read_excel(io.BytesIO(contents), sheet_name=hoja)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer la hoja '{hoja}': {e}")

    if formato == "estaciones":
        raise HTTPException(
            status_code=400,
            detail="El formato de Estaciones (Excel A) se encuentra en desarrollo. Por favor seleccione el modo Base de Datos (Excel B) o Automático."
        )

    # Encontrar la columna de Celda
    celda_col = None
    for c in df.columns:
        c_upper = str(c).strip().upper()
        if c_upper in ['CELDA', 'CELDA_PADRE', 'CODIGOCELDA', 'CODIGO_CELDA', 'CELDA.1', 'CELDA_ORIGEN']:
            celda_col = c
            break

    if not celda_col:
        cols_preview = ", ".join([f"'{c}'" for c in df.columns[:6]])
        raise HTTPException(
            status_code=400,
            detail=f"Formato no reconocido: No se encontró la columna obligatoria 'CELDA' o 'CELDA_PADRE' en el archivo Excel. Se detectaron las columnas: [{cols_preview}]. Verifique la plantilla."
        )

    # Detectar mapeo de columnas encontradas
    detected_mapping = {}
    excel_cols = [str(c) for c in df.columns]
    for sys_field, candidates in STANDARD_FIELD_MAPPINGS.items():
        found = None
        for col in excel_cols:
            col_clean = " ".join(col.strip().upper().replace("'", "").replace('"', '').split())
            for cand in candidates:
                cand_clean = " ".join(cand.strip().upper().replace("'", "").replace('"', '').split())
                if col_clean == cand_clean:
                    found = col
                    break
            if found: break
        detected_mapping[sys_field] = found or candidates[0]

    # Forward fill columnas de cabecera
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

    grouped = df.groupby(celda_col, sort=False)
    celdas_preview = []

    for code_raw, block_df in grouped:
        code_celda = clean_str(code_raw)
        if not code_celda:
            continue

        records = block_df.to_dict(orient="records")
        header_row = records[0]

        # Extraer metadatos de cabecera del Excel (preservando el 0.0 si es 0)
        este_from_val = clean_num(get_row_val_robust(header_row, ['ESTE_FROM']))
        este_from = este_from_val if este_from_val is not None else 0.0

        norte_from_val = clean_num(get_row_val_robust(header_row, ['NORTE_FROM']))
        norte_from = norte_from_val if norte_from_val is not None else 0.0

        cota_from_val = clean_num(get_row_val_robust(header_row, ['COTA']))
        cota_from = cota_from_val if cota_from_val is not None else 0.0

        este_to_val = clean_num(get_row_val_robust(header_row, ['ESTE_TO']))
        este_to = este_to_val if este_to_val is not None else 0.0

        norte_to_val = clean_num(get_row_val_robust(header_row, ['NORTE_TO']))
        norte_to = norte_to_val if norte_to_val is not None else 0.0

        cota_to_val = clean_num(get_row_val_robust(header_row, ['COTA.1', 'COTA_TO']))
        cota_to = cota_to_val if cota_to_val is not None else 0.0

        altura_val = clean_num(get_row_val_robust(header_row, ['Altura']))
        altura = altura_val if altura_val is not None else 15.0

        largo_val = clean_num(get_row_val_robust(header_row, ['Dist.Celda']))
        largo = largo_val if largo_val is not None else 15.0

        lito1 = clean_str(get_row_val_robust(header_row, ['Lito 1', 'LITO1'])) or ''
        lito2 = clean_str(get_row_val_robust(header_row, ['Lito 2', 'LITO2'])) or ''
        lito3 = clean_str(get_row_val_robust(header_row, ['Lito 3', 'LITO3'])) or ''
        unidad = clean_str(get_row_val_robust(header_row, ['Unidad Litologica'])) or ''
        mapeador = clean_str(get_row_val_robust(header_row, ['GEOTECNICO'])) or 'SRK'
        sector = clean_str(get_row_val_robust(header_row, ['Sector Geotecnicos', 'Sector'])) or 'NW1_B'
        campania_raw = get_row_val_robust(header_row, ['Campaña', 'Año', 'Ano', 'Campania'])
        if not campania_raw:
            fecha_raw = get_row_val_robust(header_row, ['FECHA', 'FechaMapeo'])
            campania_raw = str(fecha_raw)[:4] if fecha_raw else "2026"

        c_str = str(campania_raw).strip()
        if c_str.isdigit() or (len(c_str) == 4 and c_str.startswith("20")):
            campania_val = f"Campaña {c_str}"
        elif c_str.startswith("20") and len(c_str) >= 10:
            campania_val = f"Campaña {c_str[:4]}"
        elif not c_str.lower().startswith("campa"):
            campania_val = f"Campaña {c_str}"
        else:
            campania_val = c_str
        rmr_76_val = clean_num(get_row_val_robust(header_row, ["RMR '76"]))
        rmr_89_val = clean_num(get_row_val_robust(header_row, ["RMR '89"]))

        fecha_val = get_row_val_robust(header_row, ['FECHA', 'FechaMapeo'])
        fecha_str = new_date_str = str(fecha_val)[:10] if fecha_val else datetime.now().strftime("%Y-%m-%d")

        # Parsear estructuras del bloque
        estructuras_preview = []
        for struct_idx, row in enumerate(records):
            dip_val = clean_num(get_row_val_robust(row, ['DIP.1', 'DIP_ESTR', 'DIP']))
            dipdir_val = clean_num(get_row_val_robust(row, ['DIP DIR', 'DIPDIR']))

            if dip_val is None and dipdir_val is None:
                continue

            num_est = struct_idx + 1
            fam_id = math.ceil(num_est / 3.0)

            estructuras_preview.append({
                "numero_estructura": num_est,
                "familia_id": fam_id,
                "tipo_estructura": clean_str(get_row_val_robust(row, ['TIPO'])) or 'JN',
                "dip": dip_val if dip_val is not None else 0.0,
                "dip_dir": dipdir_val if dipdir_val is not None else 0.0,
                "distancia_m": clean_num(get_row_val_robust(row, ['Dist. de estr.'])),
                "abertura_mm": clean_num(get_row_val_robust(row, ['ABERTURA mm.'])),
                "espesor_mm": clean_num(get_row_val_robust(row, ['ESPESOR mm.'])),
                "continuidad_m": clean_num(get_row_val_robust(row, ['CONTINUIDAD m.'])),
                "espaciamiento_m": clean_num(get_row_val_robust(row, ['ESPACIAMIENTO m.'])),
                "n_estructuras": sanitize_value(get_row_val_robust(row, ['NUMERO DE ESTRUCTURAS']), int),
                "n_extremos_visibles": sanitize_value(get_row_val_robust(row, ['NUMERO DE EXTREMOS VISIBLES']), int),
                "relleno_1_codigo": clean_str(get_row_val_robust(row, ['TIPO DE  RELLENO 1'])),
                "relleno_2_codigo": clean_str(get_row_val_robust(row, ['TIPO DE  RELLENO 2'])),
                "jrc": clean_num(get_row_val_robust(row, ['JRC'])),
                "rugosidad_codigo": clean_str(get_row_val_robust(row, ['RUGOSIDAD DE ESTRUCTURAS'])),
                "forma_estructura": clean_str(get_row_val_robust(row, ['FORMA DE ESTRUCTURA'])),
                "alteracion_codigo": clean_str(get_row_val_robust(row, ['ALTERACION']))
            })

        # Buscar coincidencia en la Base de Datos SQL Server
        is_duplicate, existing_data = check_duplicate(db, code_celda)

        # Extraer metadatos de cabecera y geomecanica del Excel
        dip_val = clean_num(get_row_val_robust(header_row, ['DIP']))
        az_hole_val = clean_num(get_row_val_robust(header_row, ['AZ_HOLE', 'AZIMUT', 'AZIMUT_HOLE']))
        dip_talud_val = clean_num(get_row_val_robust(header_row, ['DIP_TALUD', 'DIPTALUD']))
        dipdir_talud_val = clean_num(get_row_val_robust(header_row, ['DIP DIR_TALUD', 'DIPDIR_TALUD', 'DIPDIR']))
        intemperismo_val = clean_str(get_row_val_robust(header_row, ['INTEMPERISMO', 'ALTERACION']))
        nivel_val = clean_str(get_row_val_robust(header_row, ['Nivel', 'NIVEL']))
        comentario_val = clean_str(get_row_val_robust(header_row, ['COMENTARIO', 'COMENTARIOS']))

        ucs_val = clean_num(get_row_val_robust(header_row, ["( UCS )  (Mpa)", "UCS", "UCS_MPA"]))
        is50_val = clean_num(get_row_val_robust(header_row, ["is50 (Mpa)", "IS50", "IS50_MPA"]))

        # RMR 76 campos
        cond_agua_76 = clean_str(get_row_val_robust(header_row, ["CONDICION DE AGUA  '76."]))
        cond_agua_val_76 = clean_num(get_row_val_robust(header_row, ["CONDICION DE AGUA VALOR  '76"]))
        dureza_76 = clean_str(get_row_val_robust(header_row, ["DUREZA  '76"]))
        res_estimada_val_76 = clean_num(get_row_val_robust(header_row, ["RESISTENCIA ESTIMADA VALOR  '76"]))
        gsi_visual_76 = clean_num(get_row_val_robust(header_row, ["GSI VISUAL  '76"]))
        control_est_76 = clean_str(get_row_val_robust(header_row, ["CONTROL ESTRUCTURAL  '76"]))
        efectos_vol_76 = clean_str(get_row_val_robust(header_row, ["EFECTOS DE VOLADURA  '76"]))
        rqd_val_76 = clean_num(get_row_val_robust(header_row, ["RQD - VALOR  '76"]))
        rqd_76 = clean_num(get_row_val_robust(header_row, ["RQD  '76"]))
        frec_frac_76 = clean_num(get_row_val_robust(header_row, ["FRECUENCIA DE FRACTURAMIENTO x m.  '76"]))
        tam_bloq_76 = clean_num(get_row_val_robust(header_row, ["TAMAÑO DE BLOQUES  x m3  '76"]))
        esp_prom_76 = clean_num(get_row_val_robust(header_row, ["ESPACIAMIENTO PROMEDIO   '76"]))
        esp_val_76 = clean_num(get_row_val_robust(header_row, ["ESPACIAMIENTO - VALOR    '76"]))
        cond_disc_val_76 = clean_num(get_row_val_robust(header_row, ["CONDICIÓN DE DISCONTINUIDAD - VALOR     '76"]))

        # RMR 89 campos
        cond_agua_89 = clean_str(get_row_val_robust(header_row, ["CONDICION DE AGUA  '89"]))
        cond_agua_val_89 = clean_num(get_row_val_robust(header_row, ["CONDICION DE AGUA VALOR '89"]))
        dureza_89 = clean_str(get_row_val_robust(header_row, ["DUREZA '89"]))
        res_estimada_val_89 = clean_num(get_row_val_robust(header_row, ["RESISTENCIA ESTIMADA VALOR '89"]))
        gsi_visual_89 = clean_num(get_row_val_robust(header_row, ["GSI VISUAL '89"]))
        control_est_89 = clean_str(get_row_val_robust(header_row, ["CONTROL ESTRUCTURAL '89"]))
        efectos_vol_89 = clean_str(get_row_val_robust(header_row, ["EFECTOS DE VOLADURA '89"]))
        rqd_val_89 = clean_num(get_row_val_robust(header_row, ["RQD - VALOR '89"]))
        rqd_89 = clean_num(get_row_val_robust(header_row, ["RQD '89"]))
        frec_frac_89 = clean_num(get_row_val_robust(header_row, ["FRECUENCIA DE FRACTURAMIENTO x m. '89"]))
        tam_bloq_89 = clean_num(get_row_val_robust(header_row, ["TAMAÑO DE BLOQUES  x m3 '89"]))
        esp_prom_89 = clean_num(get_row_val_robust(header_row, ["ESPACIAMIENTO PROMEDIO '89"]))
        esp_val_89 = clean_num(get_row_val_robust(header_row, ["ESPACIAMIENTO - VALOR '89"]))
        cond_disc_val_89 = clean_num(get_row_val_robust(header_row, ["CONDICIÓN DE DISCONTINUIDAD - VALOR '89"]))

        excel_data = {
            "codigo": code_celda,
            "campania": campania_val,
            "sector": sector,
            "este_ini": este_from,
            "norte_ini": norte_from,
            "cota_ini": cota_from,
            "este_fin": este_to,
            "norte_fin": norte_to,
            "cota_fin": cota_to,
            "largo_m": largo,
            "altura_m": altura,
            "dip": dip_val,
            "azimut_hole": az_hole_val,
            "dip_talud": dip_talud_val,
            "dipdir_talud": dipdir_talud_val,
            "intemperismo": intemperismo_val,
            "nivel": nivel_val,
            "comentarios": comentario_val,
            "lito_1": lito1,
            "lito_2": lito2,
            "lito_3": lito3,
            "unidad_litologica": unidad,
            "mapeador": mapeador,
            "fecha": fecha_str,
            "n_discontinuidades": len(estructuras_preview),
            "ucs_mpa": ucs_val,
            "is50_mpa": is50_val,
            # RMR 76
            "condicion_agua_rmr76": cond_agua_76,
            "condicion_agua_valor_rmr76": cond_agua_val_76,
            "dureza_rmr76": dureza_76,
            "resistencia_estimada_valor_rmr76": res_estimada_val_76,
            "gsi_visual_rmr76": gsi_visual_76,
            "control_estructural_rmr76": control_est_76,
            "efectos_voladura_rmr76": efectos_vol_76,
            "rqd_valor_rmr76": rqd_val_76,
            "rqd_rmr76": rqd_76,
            "frecuencia_fracturamiento_rmr76": frec_frac_76,
            "tamano_bloques_rmr76": tam_bloq_76,
            "espaciamiento_promedio_rmr76": esp_prom_76,
            "espaciamiento_valor_rmr76": esp_val_76,
            "condicion_discontinuidad_valor_rmr76": cond_disc_val_76,
            "rmr_76": rmr_76_val,
            # RMR 89
            "condicion_agua_rmr89": cond_agua_89,
            "condicion_agua_valor_rmr89": cond_agua_val_89,
            "dureza_rmr89": dureza_89,
            "resistencia_estimada_valor_rmr89": res_estimada_val_89,
            "gsi_visual_rmr89": gsi_visual_89,
            "control_estructural_rmr89": control_est_89,
            "efectos_voladura_rmr89": efectos_vol_89,
            "rqd_valor_rmr89": rqd_val_89,
            "rqd_rmr89": rqd_89,
            "frecuencia_fracturamiento_rmr89": frec_frac_89,
            "tamano_bloques_rmr89": tam_bloq_89,
            "espaciamiento_promedio_rmr89": esp_prom_89,
            "espaciamiento_valor_rmr89": esp_val_89,
            "condicion_discontinuidad_valor_rmr89": cond_disc_val_89,
            "rmr_89": rmr_89_val,
            "raw_header_row": {k: (str(v) if pd.notna(v) else None) for k, v in header_row.items()}
        }

        celdas_preview.append({
            "codigo": code_celda,
            "is_duplicate": is_duplicate,
            "excel_data": excel_data,
            "existing_data": existing_data,
            "estructuras": estructuras_preview
        })

    return {
        "status": "success",
        "formato_detectado": "bd",
        "hoja": hoja,
        "total_celdas": len(celdas_preview),
        "total_duplicados": sum(1 for c in celdas_preview if c["is_duplicate"]),
        "columns_detected": excel_cols,
        "mapping_detected": detected_mapping,
        "celdas": celdas_preview
    }


def _preview_excel_a(ws, db: Session, hoja: str):
    """Procesa una hoja en formato A (estaciones) y devuelve la misma
    estructura de respuesta que el preview del formato B."""
    stations = parse_excel_a(ws)
    celdas_preview = []

    for station in stations:
        celda = normalize_station_to_celda(station, infer_lito=infer_lithology_from_lito3)
        if not celda.get("codigo"):
            continue
        code_celda = celda["codigo"]
        is_duplicate, existing_data = check_duplicate(db, code_celda)
        celda["is_duplicate"] = is_duplicate
        celda["existing_data"] = existing_data
        celdas_preview.append(celda)

    return {
        "status": "success",
        "formato_detectado": "a",
        "hoja": hoja,
        "total_celdas": len(celdas_preview),
        "total_duplicados": sum(1 for c in celdas_preview if c["is_duplicate"]),
        "columns_detected": [],
        "mapping_detected": {},
        "celdas": celdas_preview
    }


class ImportCellItem(BaseModel):
    codigo_original: str
    codigo_final: str
    excel_data: Dict[str, Any]
    estructuras: List[Dict[str, Any]]


class ImportExecuteSchema(BaseModel):
    celdas: List[ImportCellItem]
    column_mapping: Optional[Dict[str, str]] = None
    overwrite_duplicates: Optional[bool] = True


@router.post("/importar-excel/ejecutar")
def execute_import_excel(payload: ImportExecuteSchema, db: Session = Depends(get_db)):
    """
    Guarda masivamente en la base de datos SQL Server las celdas seleccionadas
    y renombradas desde la previsualización del usuario.
    """
    if not payload.celdas:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos una celda para importar.")

    resolver = GEMACatalogResolver(db)
    ventanas_creadas = 0
    estructuras_creadas = 0

    for item in payload.celdas:
        code_final = item.codigo_final.strip().upper()
        h = item.excel_data

        sector_str = str(h.get("sector") or 'PENDIENTE').strip().upper()
        sector_id = resolver.sector_id(sector_str)

        campania_val = h.get("campania") or 2026
        campania_id = resolver.resolve_campania_id(campania_val)

        lito1_str = str(h.get("lito_1") or '').strip()
        lito2_str = str(h.get("lito_2") or '').strip()
        lito3_str = str(h.get("lito_3") or '').strip()
        unidad_str = str(h.get("unidad_litologica") or '').strip()

        lito1_id = resolver.litologia_id(lito1_str)
        lito2_id = resolver.litologia_id(lito2_str)
        lito3_id = resolver.litologia_id(lito3_str)
        unidad_id = resolver.unidad_litologica_id(unidad_str)
        if unidad_id is None and lito1_str:
            unidad_id = resolver.infer_unidad_id_from_lito(lito1_str)

        geotecnico_str = str(h.get("mapeador") or 'SRK').strip()
        geotecnico_id = resolver.geotecnico_id(geotecnico_str)

        fecha_val = h.get("fecha")
        fecha_mapeo = None
        if fecha_val and isinstance(fecha_val, str) and len(fecha_val) >= 10:
            try:
                fecha_mapeo = datetime.strptime(fecha_val[:10], "%Y-%m-%d").date()
            except ValueError:
                pass

        # Buscar si ya existe la ventana en la base de datos
        existing_v = db.query(models.Ventana).filter_by(codigo_celda=code_final).first()
        if existing_v:
            if payload.overwrite_duplicates:
                # Modo SOBREESCRIBIR: actualizar celda existente y limpiar discontinuidades anteriores
                v = existing_v
                for old_est in list(v.discontinuidades):
                    db.delete(old_est)
            else:
                # Modo NUEVA CELDA: generar codigo unico sufijo para conservar el registro anterior
                suffix_counter = 1
                new_code = f"{code_final}_NUEVO"
                while db.query(models.Ventana).filter_by(codigo_celda=new_code).first():
                    new_code = f"{code_final}_NUEVO_{suffix_counter}"
                    suffix_counter += 1

                v = models.Ventana(codigo_celda=new_code, campania_id=campania_id, sector_geotecnico_id=sector_id)
                db.add(v)
        else:
            v = models.Ventana(codigo_celda=code_final, campania_id=campania_id, sector_geotecnico_id=sector_id)
            db.add(v)

        v.campania_id = campania_id
        v.sector_geotecnico_id = sector_id
        v.fecha_mapeo = fecha_mapeo
        v.nivel = clean_str(h.get("nivel"))
        v.este_from = float(h["este_ini"]) if h.get("este_ini") is not None else 0.0
        v.norte_from = float(h["norte_ini"]) if h.get("norte_ini") is not None else 0.0
        v.cota_from = float(h["cota_ini"]) if h.get("cota_ini") is not None else 0.0
        v.este_to = float(h["este_fin"]) if h.get("este_fin") is not None else 0.0
        v.norte_to = float(h["norte_fin"]) if h.get("norte_fin") is not None else 0.0
        v.cota_to = float(h["cota_fin"]) if h.get("cota_fin") is not None else 0.0
        v.distancia_celda = clean_num(h.get("largo_m"))
        v.altura = clean_num(h.get("altura_m"))
        v.dip = clean_num(h.get("dip"))
        v.azimut_hole = clean_num(h.get("azimut_hole"))
        v.dip_talud = clean_num(h.get("dip_talud"))
        v.dip_dir_talud = clean_num(h.get("dipdir_talud"))

        v.litologia1_id = lito1_id
        v.litologia2_id = lito2_id
        v.litologia3_id = lito3_id
        v.unidad_litologica_id = unidad_id
        v.grado_intemperismo = clean_str(h.get("intemperismo"))
        v.alteracion = clean_str(h.get("alteracion"))
        v.fase = sanitize_value(h.get("fase"), int)
        v.gsi_superficie = clean_str(h.get("gsi_superficie"))
        v.gsi_estructura = clean_str(h.get("gsi_estructura"))
        v.geotecnico_id = geotecnico_id
        v.comentarios = clean_str(h.get("comentarios"))

        v.ucs_mpa = clean_num(h.get("ucs_mpa"))
        v.is50_mpa = clean_num(h.get("is50_mpa"))

        # Subcampos RMR 76
        v.condicion_agua_rmr76 = clean_str(h.get("condicion_agua_rmr76"))
        v.condicion_agua_valor_rmr76 = clean_num(h.get("condicion_agua_valor_rmr76"))
        v.dureza_rmr76 = clean_str(h.get("dureza_rmr76"))
        v.resistencia_estimada_valor_rmr76 = clean_num(h.get("resistencia_estimada_valor_rmr76"))
        v.gsi_visual_rmr76 = clean_num(h.get("gsi_visual_rmr76"))
        v.control_estructural_rmr76 = clean_str(h.get("control_estructural_rmr76"))
        v.efectos_voladura_rmr76 = clean_str(h.get("efectos_voladura_rmr76"))
        v.rqd_valor_rmr76 = clean_num(h.get("rqd_valor_rmr76"))
        v.rqd_rmr76 = clean_num(h.get("rqd_rmr76"))
        v.frecuencia_fracturamiento_rmr76 = clean_num(h.get("frecuencia_fracturamiento_rmr76"))
        v.tamano_bloques_rmr76 = clean_num(h.get("tamano_bloques_rmr76"))
        v.espaciamiento_promedio_rmr76 = clean_num(h.get("espaciamiento_promedio_rmr76"))
        v.espaciamiento_valor_rmr76 = clean_num(h.get("espaciamiento_valor_rmr76"))
        v.condicion_discontinuidad_valor_rmr76 = clean_num(h.get("condicion_discontinuidad_valor_rmr76"))
        v.rmr76_total = clean_num(h.get("rmr_76"))

        # Subcampos RMR 89
        v.condicion_agua_rmr89 = clean_str(h.get("condicion_agua_rmr89"))
        v.condicion_agua_valor_rmr89 = clean_num(h.get("condicion_agua_valor_rmr89"))
        v.dureza_rmr89 = clean_str(h.get("dureza_rmr89"))
        v.resistencia_estimada_valor_rmr89 = clean_num(h.get("resistencia_estimada_valor_rmr89"))
        v.gsi_visual_rmr89 = clean_num(h.get("gsi_visual_rmr89"))
        v.control_estructural_rmr89 = clean_str(h.get("control_estructural_rmr89"))
        v.efectos_voladura_rmr89 = clean_str(h.get("efectos_voladura_rmr89"))
        v.rqd_valor_rmr89 = clean_num(h.get("rqd_valor_rmr89"))
        v.rqd_rmr89 = clean_num(h.get("rqd_rmr89"))
        v.frecuencia_fracturamiento_rmr89 = clean_num(h.get("frecuencia_fracturamiento_rmr89"))
        v.tamano_bloques_rmr89 = clean_num(h.get("tamano_bloques_rmr89"))
        v.espaciamiento_promedio_rmr89 = clean_num(h.get("espaciamiento_promedio_rmr89"))
        v.espaciamiento_valor_rmr89 = clean_num(h.get("espaciamiento_valor_rmr89"))
        v.condicion_discontinuidad_valor_rmr89 = clean_num(h.get("condicion_discontinuidad_valor_rmr89"))
        v.rmr89_total = clean_num(h.get("rmr_89"))

        # Eliminar viejas estructuras si existía
        for old_est in list(v.discontinuidades):
            db.delete(old_est)

        db.flush()
        ventanas_creadas += 1

        # Insertar discontinuidades
        for s_idx, s in enumerate(item.estructuras):
            dip_v = float(s.get("dip") or 0.0)
            dipdir_v = float(s.get("dip_dir") or 0.0)
            tipo_str = str(s.get("tipo_estructura") or 'JN').strip()
            tipo_id = resolver.tipo_estructura_id(tipo_str)

            num_est_slot = s_idx + 1
            # Respetar familia explícita si viene (Excel A trae ID por
            # estructura); si no, se deriva por el patrón de 3 por familia.
            fam_id = s.get("familia_id") or math.ceil(num_est_slot / 3.0)

            est = models.EstructuraGeologica(
                ventana_id=v.ventana_id,
                numero_estructura=num_est_slot,
                tipo_estructura_id=tipo_id,
                dip=dip_v,
                dip_dir=dipdir_v,
                distancia_estructura=s.get("distancia_m"),
                abertura_mm=s.get("abertura_mm"),
                espesor_mm=s.get("espesor_mm"),
                continuidad_m=s.get("continuidad_m"),
                espaciamiento_m=s.get("espaciamiento_m"),
                numero_estructuras=s.get("n_estructuras"),
                numero_extremos_visibles=s.get("n_extremos_visibles"),
                terminacion=s.get("terminacion"),
                tipo_relleno_1=s.get("relleno_1_codigo"),
                tipo_relleno_2=s.get("relleno_2_codigo"),
                jrc=s.get("jrc"),
                rugosidad_estructura=s.get("rugosidad_codigo"),
                forma_estructura=s.get("forma_estructura"),
                alteracion=s.get("alteracion_codigo"),
                familia_id=fam_id
            )
            db.add(est)
            estructuras_creadas += 1

        db.flush()
        try:
            calculate_and_persist_subratings(db, v)
        except Exception as err:
            print(f"[WARN] Error calculando sub-ratings para celda {v.codigo_celda}: {err}")

    db.commit()

    return {
        "status": "success",
        "message": f"{ventanas_creadas} celdas y {estructuras_creadas} estructuras importadas correctamente en SQL Server.",
        "ventanas_importadas": ventanas_creadas,
        "estructuras_importadas": estructuras_creadas
    }
