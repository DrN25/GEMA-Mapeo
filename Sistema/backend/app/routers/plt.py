"""
routers/plt.py — Ensayos PLT Irregulares directamente en SQL Server (plt.EnsayoPLT).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas as s

router = APIRouter()


def _resolve_direccion_id(dir_str: str) -> int:
    if not dir_str:
        return 3
    cleaned = str(dir_str).strip().upper().replace("/", "").replace(".", "")
    if cleaned in ("PA", "PARALELA"):
        return 1
    if cleaned in ("PE", "PERPENDICULAR"):
        return 2
    return 3


def _resolve_tipo_fractura_id(frac_str: str) -> int:
    if not frac_str:
        return 1
    cleaned = str(frac_str).strip().upper()
    if cleaned == "E":
        return 2
    if cleaned == "C":
        return 3
    return 1  # Defecto 'M'


@router.get("/ensayos-plt", response_model=List[s.EnsayoPLTSaveSchema])
def get_ensayos_plt(db: Session = Depends(get_db)):
    sql_rows = db.query(models.EnsayoPLT).all()
    result = []
    for r in sql_rows:
        dir_code = "Pa" if r.direccion_id == 1 else "Pe" if r.direccion_id == 2 else "NA"
        frac_code = "E" if r.tipo_fractura_id == 2 else "C" if r.tipo_fractura_id == 3 else "M"
        
        celda = ""
        if r.ventana_id:
            v = db.query(models.Ventana).filter_by(ventana_id=r.ventana_id).first()
            if v:
                celda = v.codigo_celda
        
        result.append(s.EnsayoPLTSaveSchema(
            id=r.ensayo_plt_id,
            campana=r.campania_id,
            fecha_ensayo=r.fecha_ensayo,
            sector_geotecnico=str(r.sector_geotecnico_id) if r.sector_geotecnico_id else None,
            ejecutado_por=r.ejecucion_ensayo or r.usuario_registro or "CBA",
            zona_mapeo=r.zona_muestreo or "",
            nivel=r.nivel or "",
            celda_mapeo=celda or (r.codigo_muestra.split('_')[0] if '_' in r.codigo_muestra else r.codigo_muestra),
            muestra=r.nro_muestra or "",
            codigo_muestra=r.codigo_muestra,
            litologia_1="",
            litologia_2="",
            litologia_3="",
            tipo_litologico=r.tipo_litologico or "",
            este=float(r.coordenada_este) if r.coordenada_este is not None else None,
            norte=float(r.coordenada_norte) if r.coordenada_norte is not None else None,
            elevacion=float(r.elevacion) if r.elevacion is not None else None,
            espesor_d=float(r.espesor_d_cm) if r.espesor_d_cm is not None else None,
            longitud_l=float(r.longitud_l_cm) if r.longitud_l_cm is not None else None,
            ancho_w1=float(r.ancho_w1_cm) if r.ancho_w1_cm is not None else None,
            ancho_w2=float(r.ancho_w2_cm) if r.ancho_w2_cm is not None else None,
            ancho_w=float(r.ancho_w_cm) if r.ancho_w_cm is not None else None,
            muestra_valida_longitud=r.muestra_valida_long,
            muestra_valida_ancho=r.muestra_valida_ancho,
            fuerza_p=float(r.fuerza_p_kn) if r.fuerza_p_kn is not None else None,
            direccion_rotura=dir_code,
            tipo_fractura=frac_code,
            diametro_equivalente=float(r.diametro_equiv_cm) if r.diametro_equiv_cm is not None else None,
            f=float(r.factor_f) if r.factor_f is not None else None,
            is_mpa=float(r.is_mpa) if r.is_mpa is not None else None,
            is_50=float(r.is50_mpa) if r.is50_mpa is not None else None,
            factor_conversion_k=float(r.factor_k_valor) if r.factor_k_valor is not None else 10.0,
            ucs=float(r.ucs_mpa) if r.ucs_mpa is not None else None,
            resistencia_isrm=r.denominacion_isrm,
            tipo_ensayo="i",
            observaciones=r.observaciones,
        ))
    return result


@router.post("/ensayos-plt")
def save_ensayos_plt(data: List[s.EnsayoPLTSaveSchema], db: Session = Depends(get_db)):
    for d in data:
        codigo_m = d.codigo_muestra or f"{(d.celda_mapeo or 'M')}_{(d.muestra or '1')}"
        sql_row = db.query(models.EnsayoPLT).filter_by(codigo_muestra=codigo_m).first()

        # Resolver VentanaID
        v_id = None
        if d.celda_mapeo:
            v_obj = db.query(models.Ventana).filter_by(codigo_celda=d.celda_mapeo.strip().upper()).first()
            if v_obj:
                v_id = v_obj.ventana_id

        dir_id = _resolve_direccion_id(d.direccion_rotura or "")
        frac_id = _resolve_tipo_fractura_id(d.tipo_fractura or "")

        is_valid_l = bool(d.muestra_valida_longitud) if isinstance(d.muestra_valida_longitud, bool) else (str(d.muestra_valida_longitud).upper() == "SI")
        is_valid_w = bool(d.muestra_valida_ancho) if isinstance(d.muestra_valida_ancho, bool) else (str(d.muestra_valida_ancho).upper() == "SI")

        if not sql_row:
            sql_row = models.EnsayoPLT(
                codigo_muestra=codigo_m,
                campania_id=int(d.campana) if d.campana and str(d.campana).isdigit() else 7,
                ventana_id=v_id,
                tipo_ensayo_id=4,  # 'i'
                direccion_id=dir_id,
                tipo_fractura_id=frac_id,
                factor_k_valor=d.factor_conversion_k,
                fecha_ensayo=d.fecha_ensayo,
                ejecucion_ensayo=d.ejecutado_por,
                zona_muestreo=d.zona_mapeo,
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
                denominacion_isrm=d.resistencia_isrm or d.denominacion_isrm,
                observaciones=d.observaciones,
                origen_plt="IRREGULAR",
                nro_muestra=d.muestra,
                tipo_litologico=d.tipo_litologico,
                nivel=str(d.nivel) if d.nivel is not None else None
            )
            db.add(sql_row)
        else:
            sql_row.ventana_id = v_id
            sql_row.direccion_id = dir_id
            sql_row.tipo_fractura_id = frac_id
            sql_row.factor_k_valor = d.factor_conversion_k
            sql_row.fecha_ensayo = d.fecha_ensayo
            sql_row.ejecucion_ensayo = d.ejecutado_por
            sql_row.zona_muestreo = d.zona_mapeo
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
            sql_row.denominacion_isrm = d.resistencia_isrm or d.denominacion_isrm
            sql_row.observaciones = d.observaciones
            sql_row.nro_muestra = d.muestra
            sql_row.tipo_litologico = d.tipo_litologico
            sql_row.nivel = str(d.nivel) if d.nivel is not None else None

    db.commit()
    return {"status": "success", "message": "Ensayos PLT guardados con éxito en SQL Server"}