import os
import gc
import math
import openpyxl
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.database import SessionLocal
from app import models, schemas
from app.routers.ventanas import GEMACatalogResolver, serialize_ventana, get_db, calculate_and_persist_subratings
from app.utils.validator import get_row_val, sanitize_value
from app.core.catalogs import infer_lithology_from_lito3
from app.parsers.excel_a import detect_format, parse_excel_a, normalize_station_to_celda
from app.core.audit import apply_audit
from app.auth.dependencies import require_role
from app.core.excel_styles import dedup_pandas_headers, save_upload_to_temp

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


def build_celdas_existing(db: Session, celdas_codes: List[str]) -> Dict[str, Dict[str, Any]]:
    """Prefetch en batch de la info de celdas que YA existen en BD.

    Reemplaza check_duplicate() en el preview: en vez de ~9 queries por celda
    (ventana + 3 litologías + unidad + sector + geotécnico + campaña + conteo
    de discontinuidades), hace 1 query de ventanas con IN + 5 queries de
    catálogos + 1 de conteo agrupado — coste fijo, independiente de N.

    Devuelve {codigo_celda (mayúsculas): existing_data} — el mismo shape y los
    mismos defaults que check_duplicate, para no alterar el resultado final.
    """
    if not celdas_codes:
        return {}
    codes_upper = {c.strip().upper() for c in celdas_codes if c and str(c).strip()}
    if not codes_upper:
        return {}

    ventanas = db.query(models.Ventana).filter(
        models.Ventana.codigo_celda.in_(codes_upper)
    ).all()
    if not ventanas:
        return {}

    litos = {l.litologia_id: l.codigo for l in db.query(models.Litologia).all()}
    unidades = {u.unidad_id: u.codigo for u in db.query(models.UnidadLitologica).all()}
    sectores = {s.sector_id: s.codigo for s in db.query(models.SectorGeotecnico).all()}
    geotecnicos = {g.geotecnico_id: g.nombre for g in db.query(models.Geotecnico).all()}
    campanias = {c.campania_id: c.nombre for c in db.query(models.Campania).all()}

    counts = dict(
        db.query(models.EstructuraGeologica.ventana_id, func.count(models.EstructuraGeologica.estructura_id))
        .filter(models.EstructuraGeologica.ventana_id.in_([v.ventana_id for v in ventanas]))
        .group_by(models.EstructuraGeologica.ventana_id)
        .all()
    )

    result: Dict[str, Dict[str, Any]] = {}
    for v in ventanas:
        campania_name = campanias.get(v.campania_id) if v.campania_id else '2026'
        sector_code = sectores.get(v.sector_geotecnico_id) if v.sector_geotecnico_id else 'PENDIENTE'
        geotecnico_name = geotecnicos.get(v.geotecnico_id) if v.geotecnico_id else 'SRK'
        result[v.codigo_celda] = {
            "codigo": v.codigo_celda,
            "campania": campania_name or 2026,
            "sector": sector_code or 'PENDIENTE',
            "este_ini": float(v.este_from or 0.0),
            "norte_ini": float(v.norte_from or 0.0),
            "cota_ini": float(v.cota_from or 0.0),
            "este_fin": float(v.este_to or 0.0),
            "norte_fin": float(v.norte_to or 0.0),
            "cota_fin": float(v.cota_to or 0.0),
            "largo_m": float(v.distancia_celda or 15.0),
            "altura_m": float(v.altura or 15.0),
            "lito_1": (litos.get(v.litologia1_id) if v.litologia1_id else '') or '',
            "lito_2": (litos.get(v.litologia2_id) if v.litologia2_id else '') or '',
            "lito_3": (litos.get(v.litologia3_id) if v.litologia3_id else '') or '',
            "unidad_litologica": (unidades.get(v.unidad_litologica_id) if v.unidad_litologica_id else '') or '',
            "mapeador": geotecnico_name or 'N/A',
            "fecha": str(v.fecha_mapeo) if v.fecha_mapeo else 'N/A',
            "n_discontinuidades": counts.get(v.ventana_id, 0),
            "rmr_76": float(v.rmr76_total) if v.rmr76_total is not None else None,
            "rmr_89": float(v.rmr89_total) if v.rmr89_total is not None else None
        }
    return result


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


_PANDAS_NA_STRINGS_IMP = frozenset({
    "", "#N/A", "#N/A N/A", "#NA", "-1.#IND", "-1.#QNAN",
    "-NaN", "-nan", "1.#IND", "1.#QNAN", "<NA>", "N/A",
    "NA", "NULL", "NaN", "None", "n/a", "nan", "null",
    "#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!",
})
_IMP_EMPTY_MARKERS = (-1, -1.0, "-1", "-1.0", "NAN", "None")


def _is_pd_na_imp(val) -> bool:
    if val is None:
        return True
    if isinstance(val, float) and math.isnan(val):
        return True
    if isinstance(val, str) and val in _PANDAS_NA_STRINGS_IMP:
        return True
    return False


def _parse_imp_numeric_str(s: str):
    """Replica el parseo numérico de cadenas de pandas TextParser."""
    if "_" in s:
        return None
    s_strip = s.strip()
    if not s_strip:
        return None
    try:
        return int(s_strip)
    except ValueError:
        pass
    try:
        fv = float(s_strip)
        if not math.isnan(fv):
            return fv
    except ValueError:
        pass
    return None


def _resolve_import_col_candidates(excel_cols: list, possible_names) -> tuple:
    if isinstance(possible_names, str):
        possible_names = [possible_names]

    cleaned_col_map = {}
    for idx, k in enumerate(excel_cols):
        k_clean = " ".join(str(k).strip().upper().replace("'", "").replace('"', "").split())
        cleaned_col_map[k_clean] = idx

    phase1 = []
    for name in possible_names:
        n_clean = " ".join(str(name).strip().upper().replace("'", "").replace('"', "").split())
        if n_clean in cleaned_col_map:
            phase1.append(cleaned_col_map[n_clean])

    def _clean_k(s):
        return "".join(str(s).split()).replace(".", "").replace("(", "").replace(")", "").replace("_", "").replace("-", "").upper()

    exact_idx_map = {}
    norm_idx_map = {}
    for idx, k in enumerate(excel_cols):
        if k not in exact_idx_map:
            exact_idx_map[k] = idx
        nk = _clean_k(k)
        if nk not in norm_idx_map:
            norm_idx_map[nk] = idx

    phase2 = []
    for name in possible_names:
        if name in exact_idx_map:
            phase2.append(exact_idx_map[name])
        else:
            tn = _clean_k(name)
            if tn in norm_idx_map:
                phase2.append(norm_idx_map[tn])

    return tuple(phase1), tuple(phase2)


def _lookup_imp_val(row_seq, cands: tuple):
    phase1, phase2 = cands
    for idx in phase1:
        val = row_seq[idx]
        if not _is_pd_na_imp(val) and val not in _IMP_EMPTY_MARKERS:
            return val
    for idx in phase2:
        val = row_seq[idx]
        if val is not None and not _is_pd_na_imp(val) and val not in (-1, -1.0, "-1", "-1.0"):
            return val
    return None


@router.post("/importar-excel/hojas")
async def list_excel_sheets(file: UploadFile = File(...)):
    """
    Devuelve SOLO los nombres de hojas de un libro Excel, sin parsear el
    contenido de las celdas (openpyxl en modo read_only lee únicamente
    xl/workbook.xml). Es instantáneo incluso para archivos muy grandes.
    """
    tmp_path = None
    try:
        ext = os.path.splitext(file.filename or "")[1] or ".xlsx"
        tmp_path = await save_upload_to_temp(file, suffix=ext)
        wb = openpyxl.load_workbook(tmp_path, read_only=True, data_only=False)
        try:
            names = list(wb.sheetnames)
        finally:
            wb.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo Excel: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
    return {"status": "success", "hojas": names}


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
    tmp_path = None
    try:
        ext = os.path.splitext(file.filename or "")[1] or ".xlsx"
        try:
            tmp_path = await save_upload_to_temp(file, suffix=ext)
            wb_ro = openpyxl.load_workbook(tmp_path, data_only=True, read_only=True)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo Excel: {e}")

        try:
            sheet_names = wb_ro.sheetnames
            if hoja and hoja in sheet_names:
                ws_ro = wb_ro[hoja]
            else:
                ws_ro = wb_ro[sheet_names[0]]
                hoja = sheet_names[0]

            fmt = detect_format(ws_ro)
            if fmt == "unknown":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "El formato del archivo no es soportado o la hoja seleccionada no contiene datos de mapeo. "
                        "Verifique que esté usando una plantilla válida de mapeo geomecánico "
                        "e intente con otra hoja del libro."
                    )
                )

            if fmt == "a":
                wb_ro.close()
                wb_dom = openpyxl.load_workbook(tmp_path, data_only=True, read_only=False)
                try:
                    return _preview_excel_a(wb_dom[hoja], db, hoja)
                finally:
                    wb_dom.close()

            if formato == "estaciones":
                raise HTTPException(
                    status_code=400,
                    detail="El modo de importación seleccionado no está disponible. Por favor utilice el modo Automático."
                )

            # ---- Formato B: streaming con read_only=True en 2 pasadas (sin DOM ni DataFrames) ----
            # Pasada 1: determinar rango efectivo de columnas/filas y columnas float64 (con NaNs o floats)
            row_iter1 = ws_ro.iter_rows(values_only=True)
            raw_header = next(row_iter1, None)
            if not raw_header:
                raise HTTPException(
                    status_code=400,
                    detail="Formato no reconocido: No se encontró la columna obligatoria 'CELDA' o 'CELDA_PADRE' en el archivo Excel. Se detectaron las columnas: []. Verifique la plantilla."
                )

            last_hdr_col = -1
            for ci, v in enumerate(raw_header):
                if v is not None:
                    last_hdr_col = ci

            saw_int = []
            saw_float = []
            saw_other = []
            non_na_counts = []

            def _ensure_cap(n: int):
                if n > len(saw_int):
                    delta = n - len(saw_int)
                    saw_int.extend([False] * delta)
                    saw_float.extend([False] * delta)
                    saw_other.extend([False] * delta)
                    non_na_counts.extend([0] * delta)

            _ensure_cap(max(last_hdr_col + 1, 1))
            max_used_col = last_hdr_col
            last_non_empty_row = 1
            has_any_non_na_row = False

            for row_num, row in enumerate(row_iter1, start=2):
                r_len = len(row)
                last_non_none = -1
                for ci in range(r_len - 1, -1, -1):
                    if row[ci] is not None:
                        last_non_none = ci
                        break
                if last_non_none < 0:
                    continue

                if last_non_none > max_used_col:
                    max_used_col = last_non_none
                _ensure_cap(max_used_col + 1)

                row_has_non_na = False
                for ci in range(last_non_none + 1):
                    v = row[ci]
                    if _is_pd_na_imp(v):
                        continue
                    row_has_non_na = True
                    non_na_counts[ci] += 1
                    tv = type(v)
                    if tv is int:
                        saw_int[ci] = True
                    elif tv is float:
                        saw_float[ci] = True
                    elif tv is str:
                        parsed = _parse_imp_numeric_str(v)
                        if parsed is None:
                            saw_other[ci] = True
                        elif type(parsed) is int:
                            saw_int[ci] = True
                        else:
                            saw_float[ci] = True
                    else:
                        saw_other[ci] = True

                if row_has_non_na:
                    last_non_empty_row = row_num
                    has_any_non_na_row = True

            effective_ncols = max_used_col + 1 if max_used_col >= 0 else 0
            raw_hdr_slice = [raw_header[i] if i < len(raw_header) else None for i in range(effective_ncols)]
            excel_cols = [str(c) for c in dedup_pandas_headers(raw_hdr_slice)]

            # Encontrar la columna de Celda
            celda_col = None
            celda_col_idx = None
            for idx, c in enumerate(excel_cols):
                c_upper = c.strip().upper()
                if c_upper in ("CELDA", "CELDA_PADRE", "CODIGOCELDA", "CODIGO_CELDA", "CELDA.1", "CELDA_ORIGEN"):
                    celda_col = c
                    celda_col_idx = idx
                    break

            if not celda_col:
                cols_preview = ", ".join([f"'{c}'" for c in excel_cols[:6]])
                raise HTTPException(
                    status_code=400,
                    detail=f"Formato no reconocido: No se encontró la columna obligatoria 'CELDA' o 'CELDA_PADRE' en el archivo Excel. Se detectaron las columnas: [{cols_preview}]. Verifique la plantilla."
                )

            if not has_any_non_na_row:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "La hoja seleccionada está vacía o no contiene datos de mapeo. "
                        "Verifique que esté usando una plantilla válida de mapeo geomecánico "
                        "o intente con otra hoja del libro."
                    )
                )

            total_data_rows = last_non_empty_row - 1
            is_numeric_col = [
                (not saw_other[ci]) and (saw_int[ci] or saw_float[ci])
                for ci in range(effective_ncols)
            ]
            coerce_to_float = [
                is_numeric_col[ci] and (saw_float[ci] or non_na_counts[ci] < total_data_rows)
                for ci in range(effective_ncols)
            ]

            def _coerce_imp_cell(v, ci: int):
                if is_numeric_col[ci]:
                    tv = type(v)
                    if tv is int:
                        return float(v) if coerce_to_float[ci] else v
                    if tv is float:
                        return v
                    if tv is str:
                        parsed = _parse_imp_numeric_str(v)
                        if parsed is not None:
                            return float(parsed) if coerce_to_float[ci] else parsed
                return v

            # Detectar mapeo de columnas encontradas
            detected_mapping = {}
            for sys_field, candidates in STANDARD_FIELD_MAPPINGS.items():
                found = None
                for col in excel_cols:
                    col_clean = " ".join(col.strip().upper().replace("'", "").replace('"', "").split())
                    for cand in candidates:
                        cand_clean = " ".join(cand.strip().upper().replace("'", "").replace('"', "").split())
                        if col_clean == cand_clean:
                            found = col
                            break
                    if found:
                        break
                detected_mapping[sys_field] = found or candidates[0]

            # Forward fill columnas de cabecera
            header_cols_set = {
                celda_col, "ESTE_FROM", "NORTE_FROM", "COTA", "ESTE_TO", "NORTE_TO", "COTA.1",
                "Dist.Celda", "Altura", "DIP", "AZ_HOLE", "DIP_TALUD", "DIP DIR_TALUD", "INTEMPERISMO",
                "CONDICION DE AGUA  '76.", "CONDICION DE AGUA VALOR  '76", "DUREZA  '76", "RESISTENCIA ESTIMADA VALOR  '76",
                "GSI VISUAL  '76", "CONTROL ESTRUCTURAL  '76", "EFECTOS DE VOLADURA  '76", "RQD - VALOR  '76", "RQD  '76",
                "FRECUENCIA DE FRACTURAMIENTO x m.  '76", "TAMAÑO DE BLOQUES  x m3  '76", "ESPACIAMIENTO PROMEDIO   '76",
                "ESPACIAMIENTO - VALOR    '76", "CONDICIÓN DE DISCONTINUIDAD - VALOR     '76", "RMR '76",
                "( UCS )  (Mpa)", "is50 (Mpa)", "CONDICION DE AGUA  '89", "CONDICION DE AGUA VALOR '89", "DUREZA '89",
                "RESISTENCIA ESTIMADA VALOR '89", "GSI VISUAL '89", "CONTROL ESTRUCTURAL '89", "EFECTOS DE VOLADURA '89",
                "RQD - VALOR '89", "RQD '89", "FRECUENCIA DE FRACTURAMIENTO x m. '89", "TAMAÑO DE BLOQUES  x m3 '89",
                "ESPACIAMIENTO PROMEDIO '89", "ESPACIAMIENTO - VALOR '89", "CONDICIÓN DE DISCONTINUIDAD - VALOR '89", "RMR '89",
                "FECHA", "COMENTARIO", "GEOTECNICO", "Nivel", "Lito 1", "Lito 2", "Lito 3", "Unidad Litologica",
                "Sector Geotecnicos", "Campaña", "Año", "Ano",
            }
            ffill_indices = [i for i, col in enumerate(excel_cols) if col in header_cols_set]
            ffill_state = {i: None for i in ffill_indices}

            # Precomputar índices de columnas una sola vez para cabecera y estructuras
            cands_este_from = _resolve_import_col_candidates(excel_cols, ["ESTE_FROM"])
            cands_norte_from = _resolve_import_col_candidates(excel_cols, ["NORTE_FROM"])
            cands_cota_from = _resolve_import_col_candidates(excel_cols, ["COTA"])
            cands_este_to = _resolve_import_col_candidates(excel_cols, ["ESTE_TO"])
            cands_norte_to = _resolve_import_col_candidates(excel_cols, ["NORTE_TO"])
            cands_cota_to = _resolve_import_col_candidates(excel_cols, ["COTA.1", "COTA_TO"])
            cands_altura = _resolve_import_col_candidates(excel_cols, ["Altura"])
            cands_largo = _resolve_import_col_candidates(excel_cols, ["Dist.Celda"])
            cands_lito1 = _resolve_import_col_candidates(excel_cols, ["Lito 1", "LITO1"])
            cands_lito2 = _resolve_import_col_candidates(excel_cols, ["Lito 2", "LITO2"])
            cands_lito3 = _resolve_import_col_candidates(excel_cols, ["Lito 3", "LITO3"])
            cands_unidad = _resolve_import_col_candidates(excel_cols, ["Unidad Litologica"])
            cands_mapeador = _resolve_import_col_candidates(excel_cols, ["GEOTECNICO"])
            cands_sector = _resolve_import_col_candidates(excel_cols, ["Sector Geotecnicos", "Sector"])
            cands_camp = _resolve_import_col_candidates(excel_cols, ["Campaña", "Año", "Ano", "Campania"])
            cands_fecha = _resolve_import_col_candidates(excel_cols, ["FECHA", "FechaMapeo"])
            cands_rmr76 = _resolve_import_col_candidates(excel_cols, ["RMR '76"])
            cands_rmr89 = _resolve_import_col_candidates(excel_cols, ["RMR '89"])
            cands_dip = _resolve_import_col_candidates(excel_cols, ["DIP"])
            cands_az = _resolve_import_col_candidates(excel_cols, ["AZ_HOLE", "AZIMUT", "AZIMUT_HOLE"])
            cands_dip_t = _resolve_import_col_candidates(excel_cols, ["DIP_TALUD", "DIPTALUD"])
            cands_dipdir_t = _resolve_import_col_candidates(excel_cols, ["DIP DIR_TALUD", "DIPDIR_TALUD", "DIPDIR"])
            cands_intem = _resolve_import_col_candidates(excel_cols, ["INTEMPERISMO", "ALTERACION"])
            cands_nivel = _resolve_import_col_candidates(excel_cols, ["Nivel", "NIVEL"])
            cands_coment = _resolve_import_col_candidates(excel_cols, ["COMENTARIO", "COMENTARIOS"])
            cands_ucs = _resolve_import_col_candidates(excel_cols, ["( UCS )  (Mpa)", "UCS", "UCS_MPA"])
            cands_is50 = _resolve_import_col_candidates(excel_cols, ["is50 (Mpa)", "IS50", "IS50_MPA"])
            cands_cw76 = _resolve_import_col_candidates(excel_cols, ["CONDICION DE AGUA  '76."])
            cands_cwv76 = _resolve_import_col_candidates(excel_cols, ["CONDICION DE AGUA VALOR  '76"])
            cands_dur76 = _resolve_import_col_candidates(excel_cols, ["DUREZA  '76"])
            cands_resv76 = _resolve_import_col_candidates(excel_cols, ["RESISTENCIA ESTIMADA VALOR  '76"])
            cands_gsi76 = _resolve_import_col_candidates(excel_cols, ["GSI VISUAL  '76"])
            cands_ce76 = _resolve_import_col_candidates(excel_cols, ["CONTROL ESTRUCTURAL  '76"])
            cands_ev76 = _resolve_import_col_candidates(excel_cols, ["EFECTOS DE VOLADURA  '76"])
            cands_rqdv76 = _resolve_import_col_candidates(excel_cols, ["RQD - VALOR  '76"])
            cands_rqd76 = _resolve_import_col_candidates(excel_cols, ["RQD  '76"])
            cands_ff76 = _resolve_import_col_candidates(excel_cols, ["FRECUENCIA DE FRACTURAMIENTO x m.  '76"])
            cands_tb76 = _resolve_import_col_candidates(excel_cols, ["TAMAÑO DE BLOQUES  x m3  '76"])
            cands_ep76 = _resolve_import_col_candidates(excel_cols, ["ESPACIAMIENTO PROMEDIO   '76"])
            cands_evl76 = _resolve_import_col_candidates(excel_cols, ["ESPACIAMIENTO - VALOR    '76"])
            cands_cdv76 = _resolve_import_col_candidates(excel_cols, ["CONDICIÓN DE DISCONTINUIDAD - VALOR     '76"])
            cands_cw89 = _resolve_import_col_candidates(excel_cols, ["CONDICION DE AGUA  '89"])
            cands_cwv89 = _resolve_import_col_candidates(excel_cols, ["CONDICION DE AGUA VALOR '89"])
            cands_dur89 = _resolve_import_col_candidates(excel_cols, ["DUREZA '89"])
            cands_resv89 = _resolve_import_col_candidates(excel_cols, ["RESISTENCIA ESTIMADA VALOR '89"])
            cands_gsi89 = _resolve_import_col_candidates(excel_cols, ["GSI VISUAL '89"])
            cands_ce89 = _resolve_import_col_candidates(excel_cols, ["CONTROL ESTRUCTURAL '89"])
            cands_ev89 = _resolve_import_col_candidates(excel_cols, ["EFECTOS DE VOLADURA '89"])
            cands_rqdv89 = _resolve_import_col_candidates(excel_cols, ["RQD - VALOR '89"])
            cands_rqd89 = _resolve_import_col_candidates(excel_cols, ["RQD '89"])
            cands_ff89 = _resolve_import_col_candidates(excel_cols, ["FRECUENCIA DE FRACTURAMIENTO x m. '89"])
            cands_tb89 = _resolve_import_col_candidates(excel_cols, ["TAMAÑO DE BLOQUES  x m3 '89"])
            cands_ep89 = _resolve_import_col_candidates(excel_cols, ["ESPACIAMIENTO PROMEDIO '89"])
            cands_evl89 = _resolve_import_col_candidates(excel_cols, ["ESPACIAMIENTO - VALOR '89"])
            cands_cdv89 = _resolve_import_col_candidates(excel_cols, ["CONDICIÓN DE DISCONTINUIDAD - VALOR '89"])

            st_dip = _resolve_import_col_candidates(excel_cols, ["DIP.1", "DIP_ESTR", "DIP"])
            st_dipdir = _resolve_import_col_candidates(excel_cols, ["DIP DIR", "DIPDIR"])
            st_tipo = _resolve_import_col_candidates(excel_cols, ["TIPO"])
            st_dist = _resolve_import_col_candidates(excel_cols, ["Dist. de estr."])
            st_aber = _resolve_import_col_candidates(excel_cols, ["ABERTURA mm."])
            st_esp = _resolve_import_col_candidates(excel_cols, ["ESPESOR mm."])
            st_cont = _resolve_import_col_candidates(excel_cols, ["CONTINUIDAD m."])
            st_espac = _resolve_import_col_candidates(excel_cols, ["ESPACIAMIENTO m."])
            st_nest = _resolve_import_col_candidates(excel_cols, ["NUMERO DE ESTRUCTURAS"])
            st_ext = _resolve_import_col_candidates(excel_cols, ["NUMERO DE EXTREMOS VISIBLES"])
            st_rel1 = _resolve_import_col_candidates(excel_cols, ["TIPO DE  RELLENO 1"])
            st_rel2 = _resolve_import_col_candidates(excel_cols, ["TIPO DE  RELLENO 2"])
            st_jrc = _resolve_import_col_candidates(excel_cols, ["JRC"])
            st_rug = _resolve_import_col_candidates(excel_cols, ["RUGOSIDAD DE ESTRUCTURAS"])
            st_frm = _resolve_import_col_candidates(excel_cols, ["FORMA DE ESTRUCTURA"])
            st_alt = _resolve_import_col_candidates(excel_cols, ["ALTERACION"])

            struct_needed_indices = sorted({
                idx
                for cands in (
                    st_dip, st_dipdir, st_tipo, st_dist, st_aber, st_esp,
                    st_cont, st_espac, st_nest, st_ext, st_rel1, st_rel2,
                    st_jrc, st_rug, st_frm, st_alt,
                )
                for group in cands
                for idx in group
            })
            # Map from column index within full row -> same index in compact row_vec (only allocated for used cols)
            groups_map: Dict[Any, Dict[str, Any]] = {}

            # Pasada 2: agrupar en streaming conservando solo 1 fila cabecera por celda + estructuras compactas
            row_iter2 = ws_ro.iter_rows(
                min_row=2, max_row=last_non_empty_row, max_col=effective_ncols, values_only=True
            )
            row_buf = [None] * effective_ncols
            for raw_row in row_iter2:
                r_len = len(raw_row)
                for ci in ffill_indices:
                    v = raw_row[ci] if ci < r_len else None
                    if not _is_pd_na_imp(v):
                        ffill_state[ci] = _coerce_imp_cell(v, ci)

                code_raw = ffill_state[celda_col_idx]
                if _is_pd_na_imp(code_raw):
                    continue
                code_celda = clean_str(code_raw)
                if not code_celda:
                    continue

                grp = groups_map.get(code_raw)
                if grp is None:
                    # Solo para la primera fila de la celda normalizamos todas sus columnas
                    full_hdr = [None] * effective_ncols
                    for ci in range(effective_ncols):
                        if ci in ffill_state:
                            full_hdr[ci] = ffill_state[ci]
                        else:
                            v = raw_row[ci] if ci < r_len else None
                            if _is_pd_na_imp(v):
                                full_hdr[ci] = None
                            else:
                                full_hdr[ci] = _coerce_imp_cell(v, ci)
                    grp = {
                        "code_celda": code_celda,
                        "header_vals": tuple(full_hdr),
                        "row_count": 0,
                        "estructuras": [],
                    }
                    groups_map[code_raw] = grp
                    row_seq = full_hdr
                else:
                    # En filas hijas únicamente leemos los ~16 campos de estructura + ffill DIP si aplica
                    for ci in struct_needed_indices:
                        if ci in ffill_state:
                            row_buf[ci] = ffill_state[ci]
                        else:
                            v = raw_row[ci] if ci < r_len else None
                            if _is_pd_na_imp(v):
                                row_buf[ci] = None
                            else:
                                row_buf[ci] = _coerce_imp_cell(v, ci)
                    row_seq = row_buf

                struct_idx = grp["row_count"]
                grp["row_count"] = struct_idx + 1

                dip_val = clean_num(_lookup_imp_val(row_seq, st_dip))
                dipdir_val = clean_num(_lookup_imp_val(row_seq, st_dipdir))
                if dip_val is None and dipdir_val is None:
                    continue

                num_est = struct_idx + 1
                grp["estructuras"].append({
                    "numero_estructura": num_est,
                    "familia_id": math.ceil(num_est / 3.0),
                    "tipo_estructura": clean_str(_lookup_imp_val(row_seq, st_tipo)) or "JN",
                    "dip": dip_val if dip_val is not None else 0.0,
                    "dip_dir": dipdir_val if dipdir_val is not None else 0.0,
                    "distancia_m": clean_num(_lookup_imp_val(row_seq, st_dist)),
                    "abertura_mm": clean_num(_lookup_imp_val(row_seq, st_aber)),
                    "espesor_mm": clean_num(_lookup_imp_val(row_seq, st_esp)),
                    "continuidad_m": clean_num(_lookup_imp_val(row_seq, st_cont)),
                    "espaciamiento_m": clean_num(_lookup_imp_val(row_seq, st_espac)),
                    "n_estructuras": sanitize_value(_lookup_imp_val(row_seq, st_nest), int),
                    "n_extremos_visibles": sanitize_value(_lookup_imp_val(row_seq, st_ext), int),
                    "relleno_1_codigo": clean_str(_lookup_imp_val(row_seq, st_rel1)),
                    "relleno_2_codigo": clean_str(_lookup_imp_val(row_seq, st_rel2)),
                    "jrc": clean_num(_lookup_imp_val(row_seq, st_jrc)),
                    "rugosidad_codigo": clean_str(_lookup_imp_val(row_seq, st_rug)),
                    "forma_estructura": clean_str(_lookup_imp_val(row_seq, st_frm)),
                    "alteracion_codigo": clean_str(_lookup_imp_val(row_seq, st_alt)),
                })
        finally:
            try:
                wb_ro.close()
            except Exception:
                pass
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    group_list = list(groups_map.values())
    groups_map.clear()
    gc.collect()

    # Prefetch en batch de celdas existentes (1 query IN + catálogos)
    existing_map = build_celdas_existing(db, [g["code_celda"] for g in group_list])
    celdas_preview = []

    for g in group_list:
        code_celda = g["code_celda"]
        header_vals = g["header_vals"]
        estructuras_preview = g["estructuras"]

        este_from_val = clean_num(_lookup_imp_val(header_vals, cands_este_from))
        este_from = este_from_val if este_from_val is not None else 0.0

        norte_from_val = clean_num(_lookup_imp_val(header_vals, cands_norte_from))
        norte_from = norte_from_val if norte_from_val is not None else 0.0

        cota_from_val = clean_num(_lookup_imp_val(header_vals, cands_cota_from))
        cota_from = cota_from_val if cota_from_val is not None else 0.0

        este_to_val = clean_num(_lookup_imp_val(header_vals, cands_este_to))
        este_to = este_to_val if este_to_val is not None else 0.0

        norte_to_val = clean_num(_lookup_imp_val(header_vals, cands_norte_to))
        norte_to = norte_to_val if norte_to_val is not None else 0.0

        cota_to_val = clean_num(_lookup_imp_val(header_vals, cands_cota_to))
        cota_to = cota_to_val if cota_to_val is not None else 0.0

        altura_val = clean_num(_lookup_imp_val(header_vals, cands_altura))
        altura = altura_val if altura_val is not None else 15.0

        largo_val = clean_num(_lookup_imp_val(header_vals, cands_largo))
        largo = largo_val if largo_val is not None else 15.0

        lito1 = clean_str(_lookup_imp_val(header_vals, cands_lito1)) or ""
        lito2 = clean_str(_lookup_imp_val(header_vals, cands_lito2)) or ""
        lito3 = clean_str(_lookup_imp_val(header_vals, cands_lito3)) or ""
        unidad = clean_str(_lookup_imp_val(header_vals, cands_unidad)) or ""
        mapeador = clean_str(_lookup_imp_val(header_vals, cands_mapeador)) or "SRK"
        sector = clean_str(_lookup_imp_val(header_vals, cands_sector)) or "NW1_B"

        campania_raw = _lookup_imp_val(header_vals, cands_camp)
        if not campania_raw:
            fecha_raw = _lookup_imp_val(header_vals, cands_fecha)
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

        rmr_76_val = clean_num(_lookup_imp_val(header_vals, cands_rmr76))
        rmr_89_val = clean_num(_lookup_imp_val(header_vals, cands_rmr89))

        fecha_val = _lookup_imp_val(header_vals, cands_fecha)
        fecha_str = str(fecha_val)[:10] if fecha_val else datetime.now().strftime("%Y-%m-%d")

        code_up = code_celda.strip().upper()
        is_duplicate = code_up in existing_map
        existing_data = existing_map.get(code_up)

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
            "dip": clean_num(_lookup_imp_val(header_vals, cands_dip)),
            "azimut_hole": clean_num(_lookup_imp_val(header_vals, cands_az)),
            "dip_talud": clean_num(_lookup_imp_val(header_vals, cands_dip_t)),
            "dipdir_talud": clean_num(_lookup_imp_val(header_vals, cands_dipdir_t)),
            "intemperismo": clean_str(_lookup_imp_val(header_vals, cands_intem)),
            "nivel": clean_str(_lookup_imp_val(header_vals, cands_nivel)),
            "comentarios": clean_str(_lookup_imp_val(header_vals, cands_coment)),
            "lito_1": lito1,
            "lito_2": lito2,
            "lito_3": lito3,
            "unidad_litologica": unidad,
            "mapeador": mapeador,
            "fecha": fecha_str,
            "n_discontinuidades": len(estructuras_preview),
            "ucs_mpa": clean_num(_lookup_imp_val(header_vals, cands_ucs)),
            "is50_mpa": clean_num(_lookup_imp_val(header_vals, cands_is50)),
            # RMR 76
            "condicion_agua_rmr76": clean_str(_lookup_imp_val(header_vals, cands_cw76)),
            "condicion_agua_valor_rmr76": clean_num(_lookup_imp_val(header_vals, cands_cwv76)),
            "dureza_rmr76": clean_str(_lookup_imp_val(header_vals, cands_dur76)),
            "resistencia_estimada_valor_rmr76": clean_num(_lookup_imp_val(header_vals, cands_resv76)),
            "gsi_visual_rmr76": clean_num(_lookup_imp_val(header_vals, cands_gsi76)),
            "control_estructural_rmr76": clean_str(_lookup_imp_val(header_vals, cands_ce76)),
            "efectos_voladura_rmr76": clean_str(_lookup_imp_val(header_vals, cands_ev76)),
            "rqd_valor_rmr76": clean_num(_lookup_imp_val(header_vals, cands_rqdv76)),
            "rqd_rmr76": clean_num(_lookup_imp_val(header_vals, cands_rqd76)),
            "frecuencia_fracturamiento_rmr76": clean_num(_lookup_imp_val(header_vals, cands_ff76)),
            "tamano_bloques_rmr76": clean_num(_lookup_imp_val(header_vals, cands_tb76)),
            "espaciamiento_promedio_rmr76": clean_num(_lookup_imp_val(header_vals, cands_ep76)),
            "espaciamiento_valor_rmr76": clean_num(_lookup_imp_val(header_vals, cands_evl76)),
            "condicion_discontinuidad_valor_rmr76": clean_num(_lookup_imp_val(header_vals, cands_cdv76)),
            "rmr_76": rmr_76_val,
            # RMR 89
            "condicion_agua_rmr89": clean_str(_lookup_imp_val(header_vals, cands_cw89)),
            "condicion_agua_valor_rmr89": clean_num(_lookup_imp_val(header_vals, cands_cwv89)),
            "dureza_rmr89": clean_str(_lookup_imp_val(header_vals, cands_dur89)),
            "resistencia_estimada_valor_rmr89": clean_num(_lookup_imp_val(header_vals, cands_resv89)),
            "gsi_visual_rmr89": clean_num(_lookup_imp_val(header_vals, cands_gsi89)),
            "control_estructural_rmr89": clean_str(_lookup_imp_val(header_vals, cands_ce89)),
            "efectos_voladura_rmr89": clean_str(_lookup_imp_val(header_vals, cands_ev89)),
            "rqd_valor_rmr89": clean_num(_lookup_imp_val(header_vals, cands_rqdv89)),
            "rqd_rmr89": clean_num(_lookup_imp_val(header_vals, cands_rqd89)),
            "frecuencia_fracturamiento_rmr89": clean_num(_lookup_imp_val(header_vals, cands_ff89)),
            "tamano_bloques_rmr89": clean_num(_lookup_imp_val(header_vals, cands_tb89)),
            "espaciamiento_promedio_rmr89": clean_num(_lookup_imp_val(header_vals, cands_ep89)),
            "espaciamiento_valor_rmr89": clean_num(_lookup_imp_val(header_vals, cands_evl89)),
            "condicion_discontinuidad_valor_rmr89": clean_num(_lookup_imp_val(header_vals, cands_cdv89)),
            "rmr_89": rmr_89_val,
            "raw_header_row": {k: (str(v) if v is not None else None) for k, v in zip(excel_cols, header_vals)},
        }

        celdas_preview.append({
            "codigo": code_celda,
            "is_duplicate": is_duplicate,
            "excel_data": excel_data,
            "existing_data": existing_data,
            "estructuras": estructuras_preview,
        })

    group_list.clear()

    # Lista completa de códigos existentes en BD: sirve para que el frontend
    # detecte si un NOMBRE RENOMBRADO colisiona con otra celda existente
    # (aunque esa celda no venga en el Excel importado).
    all_existing_codes = [
        c[0] for c in db.query(models.Ventana.codigo_celda).all() if c[0]
    ]

    return {
        "status": "success",
        "formato_detectado": "bd",
        "hoja": hoja,
        "total_celdas": len(celdas_preview),
        "total_duplicados": sum(1 for c in celdas_preview if c["is_duplicate"]),
        "columns_detected": excel_cols,
        "mapping_detected": detected_mapping,
        "existing_codes": all_existing_codes,
        "celdas": celdas_preview,
    }


def _preview_excel_a(ws, db: Session, hoja: str):
    """Procesa una hoja en formato A (estaciones) y devuelve la misma
    estructura de respuesta que el preview del formato B."""
    stations = parse_excel_a(ws)
    if not stations:
        raise HTTPException(
            status_code=400,
            detail=(
                "No se detectaron estaciones de mapeo en la hoja seleccionada. "
                "Verifique que la hoja contenga bloques de estación (TD1, TD2, ...) "
                "o intente con otra hoja del archivo."
            )
        )
    celdas_preview = []

    for station in stations:
        celda = normalize_station_to_celda(station, infer_lito=infer_lithology_from_lito3)
        if not celda.get("codigo"):
            continue
        celdas_preview.append(celda)

    if not celdas_preview:
        raise HTTPException(
            status_code=400,
            detail=(
                "La hoja seleccionada no contiene celdas de mapeo válidas. "
                "Verifique que el archivo tenga el formato de mapeo esperado "
                "o intente con otra hoja del libro."
            )
        )

    # Prefetch en batch de celdas existentes (1 query IN + catálogos) en vez
    # de check_duplicate() por estación (~9 queries cada una).
    existing_map = build_celdas_existing(db, [c["codigo"] for c in celdas_preview])
    for celda in celdas_preview:
        code_up = celda["codigo"].strip().upper()
        celda["is_duplicate"] = code_up in existing_map
        celda["existing_data"] = existing_map.get(code_up)

    all_existing_codes = [
        c[0] for c in db.query(models.Ventana.codigo_celda).all() if c[0]
    ]

    return {
        "status": "success",
        "formato_detectado": "a",
        "hoja": hoja,
        "total_celdas": len(celdas_preview),
        "total_duplicados": sum(1 for c in celdas_preview if c["is_duplicate"]),
        "columns_detected": [],
        "mapping_detected": {},
        "existing_codes": all_existing_codes,
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
def execute_import_excel(
    payload: ImportExecuteSchema,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role(["admin", "mapeador"]))
):
    """
    Guarda masivamente en la base de datos SQL Server las celdas seleccionadas
    y renombradas desde la previsualización del usuario.
    """
    if not payload.celdas:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos una celda para importar.")

    # Validate the complete selection before the first write (including resolver inserts).
    from app.validation.adapters import from_import
    from app.validation.service import evaluate_window
    from app.validation.context import assert_valid, campaign_year
    for selected in payload.celdas:
        draft = from_import(selected)
        result = evaluate_window(draft, operation='import_save', campaign_year=campaign_year(draft['header'].get('campania')))
        assert_valid(result)
        geometry = result['derived']['geometry']
        if geometry:
            selected.excel_data.update(dip=geometry['dip_hw'], azimut_hole=geometry['az_hw'], dipdir_talud=geometry['dipdir_talud'])
            if selected.excel_data.get('largo_m') is None:
                selected.excel_data['largo_m'] = geometry['length_m']
        selected.excel_data['gsi_visual_rmr76'] = result['derived']['gsi_visual']
        selected.excel_data['gsi_visual_rmr89'] = result['derived']['gsi_visual']

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
        is_new_v = True
        if existing_v:
            if payload.overwrite_duplicates:
                # Modo SOBREESCRIBIR: actualizar celda existente y limpiar discontinuidades anteriores
                v = existing_v
                is_new_v = False
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

        apply_audit(v, current_user, is_new=is_new_v)

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
            # La columna TipoEstructuraID NO acepta NULL: si el tipo no se
            # resolvió (código desconocido o vacío), caer a 'JN'.
            if tipo_id is None:
                tipo_id = resolver.tipo_estructura_id("JN")

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
            apply_audit(est, current_user, is_new=True)
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
