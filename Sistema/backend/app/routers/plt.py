"""
routers/plt.py — Ensayos PLT Irregulares en SQL Server (plt.EnsayoPLT) filtrados por celda geomecánica.
Soporte completo para Litologías (1, 2, 3), Tipo Litológico, Sector Geotécnico y Validación Booleana (1 para SÍ, 0 para NO).
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Any

from app.database import get_db
from app import models, schemas as s

router = APIRouter()


def _resolve_direccion_id(dir_str: Optional[str]) -> Optional[int]:
    if not dir_str or str(dir_str).strip() == "":
        return None
    cleaned = str(dir_str).strip().upper().replace("/", "").replace(".", "")
    if cleaned in ("PA", "PARALELA"):
        return 1
    if cleaned in ("PE", "PERPENDICULAR"):
        return 2
    if cleaned in ("NA", "N/A"):
        return 3
    return None


def _resolve_tipo_fractura_id(frac_str: Optional[str]) -> Optional[int]:
    if not frac_str or str(frac_str).strip() == "":
        return None
    cleaned = str(frac_str).strip().upper()
    if cleaned == "M":
        return 1
    if cleaned == "E":
        return 2
    if cleaned == "C":
        return 3
    return None


def _parse_bool_validation(val: Any) -> Optional[bool]:
    if val is None or val == "":
        return None
    if isinstance(val, bool):
        return val
    cleaned = str(val).strip().upper().replace("Í", "I")
    if cleaned in ("SI", "1", "TRUE", "S"):
        return True
    if cleaned in ("NO", "0", "FALSE", "N"):
        return False
    return None


@router.get("/ensayos-plt", response_model=List[s.EnsayoPLTSaveSchema])
def get_ensayos_plt(celda: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(models.EnsayoPLT)
    
    if celda and celda.strip():
        celda_clean = celda.strip().upper()
        v = db.query(models.Ventana).filter_by(codigo_celda=celda_clean).first()
        if v:
            query = query.filter(
                (models.EnsayoPLT.ventana_id == v.ventana_id) | 
                (models.EnsayoPLT.codigo_muestra.like(f"{celda_clean}_%")) |
                (models.EnsayoPLT.codigo_muestra == celda_clean)
            )
        else:
            query = query.filter(
                (models.EnsayoPLT.codigo_muestra.like(f"{celda_clean}_%")) |
                (models.EnsayoPLT.codigo_muestra == celda_clean)
            )
    else:
        query = query.limit(500)

    sql_rows = query.all()
    
    # Pre-cargar mapa de ventana_id -> codigo_celda
    ventana_ids = {r.ventana_id for r in sql_rows if r.ventana_id}
    ventana_map = {}
    if ventana_ids:
        ventanas = db.query(models.Ventana.ventana_id, models.Ventana.codigo_celda).filter(models.Ventana.ventana_id.in_(ventana_ids)).all()
        ventana_map = {v_id: c_code for v_id, c_code in ventanas}

    # Pre-cargar mapa de litologia_id -> codigo
    lito_ids = set()
    sector_ids = set()
    for r in sql_rows:
        if r.litologia1_id: lito_ids.add(r.litologia1_id)
        if r.litologia2_id: lito_ids.add(r.litologia2_id)
        if r.litologia3_id: lito_ids.add(r.litologia3_id)
        if r.sector_geotecnico_id: sector_ids.add(r.sector_geotecnico_id)

    lito_map = {}
    if lito_ids:
        l_rows = db.query(models.Litologia.litologia_id, models.Litologia.codigo).filter(models.Litologia.litologia_id.in_(lito_ids)).all()
        lito_map = {l_id: code for l_id, code in l_rows}

    sector_map = {}
    if sector_ids:
        s_rows = db.query(models.SectorGeotecnico.sector_id, models.SectorGeotecnico.codigo).filter(models.SectorGeotecnico.sector_id.in_(sector_ids)).all()
        sector_map = {s_id: code for s_id, code in s_rows}

    result = []
    for r in sql_rows:
        dir_code = "Pa" if r.direccion_id == 1 else ("Pe" if r.direccion_id == 2 else ("NA" if r.direccion_id == 3 else ""))
        frac_code = "M" if r.tipo_fractura_id == 1 else ("E" if r.tipo_fractura_id == 2 else ("C" if r.tipo_fractura_id == 3 else ""))
        
        celda_code = ventana_map.get(r.ventana_id, "")
        if not celda_code and r.codigo_muestra:
            celda_code = r.codigo_muestra.split('_')[0] if '_' in r.codigo_muestra else r.codigo_muestra

        lito1_code = lito_map.get(r.litologia1_id, "")
        lito2_code = lito_map.get(r.litologia2_id, "")
        lito3_code = lito_map.get(r.litologia3_id, "")
        sector_code = sector_map.get(r.sector_geotecnico_id, "")

        val_long = "SÍ" if r.muestra_valida_long is True else ("NO" if r.muestra_valida_long is False else None)
        val_ancho = "SÍ" if r.muestra_valida_ancho is True else ("NO" if r.muestra_valida_ancho is False else None)

        result.append(s.EnsayoPLTSaveSchema(
            id=r.ensayo_plt_id,
            campana=r.campania_id,
            fecha_ensayo=r.fecha_ensayo,
            sector_geotecnico=sector_code,
            ejecutado_por=r.ejecucion_ensayo or r.usuario_registro or "",
            zona_mapeo=r.zona_muestreo or "",
            nivel=r.nivel or "",
            celda_mapeo=celda_code,
            muestra=r.nro_muestra or "",
            codigo_muestra=r.codigo_muestra or "",
            litologia_1=lito1_code,
            litologia_2=lito2_code,
            litologia_3=lito3_code,
            tipo_litologico=r.tipo_litologico or "",
            este=float(r.coordenada_este) if r.coordenada_este is not None else None,
            norte=float(r.coordenada_norte) if r.coordenada_norte is not None else None,
            elevacion=float(r.elevacion) if r.elevacion is not None else None,
            espesor_d=float(r.espesor_d_cm) if r.espesor_d_cm is not None else None,
            longitud_l=float(r.longitud_l_cm) if r.longitud_l_cm is not None else None,
            ancho_w1=float(r.ancho_w1_cm) if r.ancho_w1_cm is not None else None,
            ancho_w2=float(r.ancho_w2_cm) if r.ancho_w2_cm is not None else None,
            ancho_w=float(r.ancho_w_cm) if r.ancho_w_cm is not None else None,
            muestra_valida_longitud=val_long,
            muestra_valida_ancho=val_ancho,
            fuerza_p=float(r.fuerza_p_kn) if r.fuerza_p_kn is not None else None,
            direccion_rotura=dir_code,
            tipo_fractura=frac_code,
            diametro_equivalente=float(r.diametro_equiv_cm) if r.diametro_equiv_cm is not None else None,
            f=float(r.factor_f) if r.factor_f is not None else None,
            is_mpa=float(r.is_mpa) if r.is_mpa is not None else None,
            is_50=float(r.is50_mpa) if r.is50_mpa is not None else None,
            factor_conversion_k=float(r.factor_k_valor) if r.factor_k_valor is not None else None,
            ucs=float(r.ucs_mpa) if r.ucs_mpa is not None else None,
            resistencia_isrm=r.denominacion_isrm,
            tipo_ensayo="i",
            observaciones=r.observaciones,
        ))
    return result


@router.delete("/ensayos-plt/{plt_id}")
def delete_ensayo_plt(plt_id: int, db: Session = Depends(get_db)):
    sql_row = db.query(models.EnsayoPLT).filter_by(ensayo_plt_id=plt_id).first()
    if not sql_row:
        raise HTTPException(status_code=404, detail=f"Registro PLT {plt_id} no encontrado.")
    db.delete(sql_row)
    db.commit()
    return {"status": "success", "message": f"Registro PLT {plt_id} eliminado permanentemente de SQL Server"}


@router.post("/ensayos-plt", response_model=List[s.EnsayoPLTSaveSchema])
def save_ensayos_plt(data: List[s.EnsayoPLTSaveSchema], celda: Optional[str] = Query(None), db: Session = Depends(get_db)):
    celda_origen = celda.strip().upper() if celda and celda.strip() else None
    affected_celdas = set()
    if celda_origen:
        affected_celdas.add(celda_origen)
    for item in data:
        if item.celda_mapeo and item.celda_mapeo.strip():
            affected_celdas.add(item.celda_mapeo.strip().upper())

    ventana_map = {}
    if affected_celdas:
        v_objs = db.query(models.Ventana).filter(models.Ventana.codigo_celda.in_(affected_celdas)).all()
        ventana_map = {v.codigo_celda: v.ventana_id for v in v_objs}

    existing_db_rows = []
    for celda_clean in affected_celdas:
        v_id = ventana_map.get(celda_clean)
        q = db.query(models.EnsayoPLT)
        if v_id:
            q = q.filter(
                (models.EnsayoPLT.ventana_id == v_id) |
                (models.EnsayoPLT.codigo_muestra.like(f"{celda_clean}_%")) |
                (models.EnsayoPLT.codigo_muestra == celda_clean)
            )
        else:
            q = q.filter(
                (models.EnsayoPLT.codigo_muestra.like(f"{celda_clean}_%")) |
                (models.EnsayoPLT.codigo_muestra == celda_clean)
            )
        existing_db_rows.extend(q.all())

    from app.routers.ventanas import GEMACatalogResolver
    resolver = GEMACatalogResolver(db)
    processed_rows = []

    for d in data:
        celda_clean = d.celda_mapeo.strip().upper() if d.celda_mapeo and d.celda_mapeo.strip() else ""
        v_id = ventana_map.get(celda_clean)
        muestra_str = d.muestra.strip() if d.muestra and str(d.muestra).strip() else ""

        # CodigoMuestra: celda_muestra si muestra tiene algo, o celda si muestra está vacía
        if d.codigo_muestra and str(d.codigo_muestra).strip():
            codigo_m = str(d.codigo_muestra).strip()
        elif celda_clean and muestra_str:
            codigo_m = f"{celda_clean}_{muestra_str}"
        elif celda_clean:
            codigo_m = celda_clean
        else:
            codigo_m = muestra_str or "M"

        # Resolver relaciones de catálogo SQL Server
        lito1_id = resolver.litologia_id(d.litologia_1)
        lito2_id = resolver.litologia_id(d.litologia_2)
        lito3_id = resolver.litologia_id(d.litologia_3)
        sector_id = resolver.sector_id(d.sector_geotecnico)

        sql_row = None
        if d.id and isinstance(d.id, int) and d.id < 1000000000:
            sql_row = db.query(models.EnsayoPLT).filter_by(ensayo_plt_id=d.id).first()

        dir_id = _resolve_direccion_id(d.direccion_rotura)
        frac_id = _resolve_tipo_fractura_id(d.tipo_fractura)

        is_valid_l = _parse_bool_validation(d.muestra_valida_longitud)
        is_valid_w = _parse_bool_validation(d.muestra_valida_ancho)

        ejecutado_val = d.ejecutado_por.strip() if d.ejecutado_por and str(d.ejecutado_por).strip() else None

        if not sql_row:
            sql_row = models.EnsayoPLT(
                codigo_muestra=codigo_m,
                campania_id=int(d.campana) if d.campana and str(d.campana).isdigit() else 7,
                litologia1_id=lito1_id,
                litologia2_id=lito2_id,
                litologia3_id=lito3_id,
                sector_geotecnico_id=sector_id,
                ventana_id=v_id,
                tipo_ensayo_id=4,  # 'i'
                direccion_id=dir_id,
                tipo_fractura_id=frac_id,
                factor_k_valor=d.factor_conversion_k,
                fecha_ensayo=d.fecha_ensayo,
                ejecucion_ensayo=ejecutado_val,
                zona_muestreo=d.zona_mapeo if d.zona_mapeo and str(d.zona_mapeo).strip() else None,
                coordenada_este=d.este,
                coordenada_norte=d.norte,
                elevacion=d.elevacion,
                espesor_d_cm=d.espesor_d,
                longitud_l_cm=d.longitud_l,
                ancho_w1_cm=d.ancho_w1,
                ancho_w2_cm=d.ancho_w2,
                ancho_w_cm=d.ancho_w,
                muestra_valida_long=is_valid_l,
                muestra_valida_ancho=is_valid_w,
                fuerza_p_kn=d.fuerza_p,
                diametro_equiv_cm=d.diametro_equivalente,
                factor_f=d.f,
                is_mpa=d.is_mpa,
                is50_mpa=d.is_50,
                ucs_mpa=d.ucs,
                denominacion_isrm=d.resistencia_isrm or d.denominacion_isrm or None,
                observaciones=d.observaciones if d.observaciones and str(d.observaciones).strip() else None,
                origen_plt="IRREGULAR",
                nro_muestra=d.muestra if d.muestra and str(d.muestra).strip() else None,
                tipo_litologico=d.tipo_litologico if d.tipo_litologico and str(d.tipo_litologico).strip() else None,
                nivel=str(d.nivel).strip() if d.nivel is not None and str(d.nivel).strip() else None
            )
            db.add(sql_row)
        else:
            sql_row.codigo_muestra = codigo_m
            sql_row.campania_id = int(d.campana) if d.campana and str(d.campana).isdigit() else 7
            sql_row.litologia1_id = lito1_id
            sql_row.litologia2_id = lito2_id
            sql_row.litologia3_id = lito3_id
            sql_row.sector_geotecnico_id = sector_id
            sql_row.ventana_id = v_id
            sql_row.direccion_id = dir_id
            sql_row.tipo_fractura_id = frac_id
            sql_row.factor_k_valor = d.factor_conversion_k
            sql_row.fecha_ensayo = d.fecha_ensayo
            sql_row.ejecucion_ensayo = ejecutado_val
            sql_row.zona_muestreo = d.zona_mapeo if d.zona_mapeo and str(d.zona_mapeo).strip() else None
            sql_row.coordenada_este = d.este
            sql_row.coordenada_norte = d.norte
            sql_row.elevacion = d.elevacion
            sql_row.espesor_d_cm = d.espesor_d
            sql_row.longitud_l_cm = d.longitud_l
            sql_row.ancho_w1_cm = d.ancho_w1
            sql_row.ancho_w2_cm = d.ancho_w2
            sql_row.ancho_w_cm = d.ancho_w
            sql_row.muestra_valida_long = is_valid_l
            sql_row.muestra_valida_ancho = is_valid_w
            sql_row.fuerza_p_kn = d.fuerza_p
            sql_row.diametro_equiv_cm = d.diametro_equivalente
            sql_row.factor_f = d.f
            sql_row.is_mpa = d.is_mpa
            sql_row.is50_mpa = d.is_50
            sql_row.ucs_mpa = d.ucs
            sql_row.denominacion_isrm = d.resistencia_isrm or d.denominacion_isrm or None
            sql_row.observaciones = d.observaciones if d.observaciones and str(d.observaciones).strip() else None
            sql_row.nro_muestra = d.muestra if d.muestra and str(d.muestra).strip() else None
            sql_row.tipo_litologico = d.tipo_litologico if d.tipo_litologico and str(d.tipo_litologico).strip() else None
            sql_row.nivel = str(d.nivel).strip() if d.nivel is not None and str(d.nivel).strip() else None

        processed_rows.append(sql_row)

    # Asignar EnsayoPLT_ID generados por SQL Server a las nuevas filas
    db.flush()

    incoming_ids = {r.ensayo_plt_id for r in processed_rows if r.ensayo_plt_id}

    # Eliminar físicamente los registros de la celda cuyos EnsayoPLT_ID no están en la lista entrante
    for db_row in existing_db_rows:
        if db_row.ensayo_plt_id not in incoming_ids:
            db.delete(db_row)

    db.commit()

    return get_ensayos_plt(celda=celda_origen, db=db)