"""
routers/plt.py — Ensayos PLT en SQLite local (no GEMA).
Tabla aislada en plt.db, manejada completamente aparte del esquema GEMA.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.plt_database import get_plt_db
from app.plt_models import EnsayoPLTIrregular
from app import schemas as s

router = APIRouter()


@router.get("/ensayos-plt", response_model=List[s.EnsayoPLTSaveSchema])
def get_ensayos_plt(db: Session = Depends(get_plt_db)):
    res = db.query(EnsayoPLTIrregular).all()
    return res


@router.post("/ensayos-plt")
def save_ensayos_plt(data: List[s.EnsayoPLTSaveSchema], db: Session = Depends(get_plt_db)):
    existing = {r.id: r for r in db.query(EnsayoPLTIrregular).all()}
    incoming_ids = {d.id for d in data if d.id is not None}

    for rid, row in list(existing.items()):
        if rid not in incoming_ids:
            db.delete(row)

    for d in data:
        if d.id is not None and d.id in existing:
            row = existing[d.id]
            for col in [
                "campana", "fecha_ensayo", "sector_geotecnico", "ejecutado_por",
                "zona_mapeo", "nivel", "celda_mapeo", "muestra", "codigo_muestra",
                "litologia_1", "litologia_2", "litologia_3", "tipo_litologico",
                "este", "norte", "elevacion", "espesor_d", "longitud_l",
                "ancho_w1", "ancho_w2", "fuerza_p", "direccion_rotura",
                "tipo_fractura", "factor_conversion_k", "tipo_ensayo", "observaciones",
            ]:
                setattr(row, col, getattr(d, col))
        else:
            db.add(EnsayoPLTIrregular(
                campana=d.campana, fecha_ensayo=d.fecha_ensayo,
                sector_geotecnico=d.sector_geotecnico,
                ejecutado_por=d.ejecutado_por, zona_mapeo=d.zona_mapeo, nivel=d.nivel,
                celda_mapeo=d.celda_mapeo.strip().upper(), muestra=d.muestra,
                codigo_muestra=d.codigo_muestra,
                litologia_1=d.litologia_1, litologia_2=d.litologia_2,
                litologia_3=d.litologia_3, tipo_litologico=d.tipo_litologico,
                este=d.este, norte=d.norte, elevacion=d.elevacion,
                espesor_d=d.espesor_d, longitud_l=d.longitud_l,
                ancho_w1=d.ancho_w1, ancho_w2=d.ancho_w2,
                fuerza_p=d.fuerza_p, direccion_rotura=d.direccion_rotura,
                tipo_fractura=d.tipo_fractura,
                factor_conversion_k=d.factor_conversion_k,
                tipo_ensayo=d.tipo_ensayo, observaciones=d.observaciones,
            ))
    db.commit()
    return {"status": "success", "message": "Ensayos PLT guardados con éxito en SQLite local"}