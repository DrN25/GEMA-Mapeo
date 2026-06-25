# app/routers/plt.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas

router = APIRouter()

@router.get("/ensayos-plt", response_model=List[schemas.EnsayoPLTSaveSchema])
def get_ensayos_plt(db: Session = Depends(get_db)):
    res = db.query(models.EnsayoPLTIrregular).all()
    return res

@router.post("/ensayos-plt")
def save_ensayos_plt(data: List[schemas.EnsayoPLTSaveSchema], db: Session = Depends(get_db)):
    existing = {r.id: r for r in db.query(models.EnsayoPLTIrregular).all()}
    incoming_ids = {d.id for d in data if d.id is not None}
    
    # 1. Eliminar filas inexistentes
    for rid, row in list(existing.items()):
        if rid not in incoming_ids:
            db.delete(row)
            
    # 2. Insertar o actualizar registros entrantes
    for d in data:
        if d.id is not None and d.id in existing:
            row = existing[d.id]
            row.campana = d.campana
            row.fecha_ensayo = d.fecha_ensayo
            row.sector_geotecnico = d.sector_geotecnico
            row.ejecutado_por = d.ejecutado_por
            row.zona_mapeo = d.zona_mapeo
            row.nivel = d.nivel
            row.celda_mapeo = d.celda_mapeo.strip().upper()
            row.muestra = d.muestra
            row.codigo_muestra = d.codigo_muestra
            row.litologia_1 = d.litologia_1
            row.litologia_2 = d.litologia_2
            row.litologia_3 = d.litologia_3
            row.tipo_litologico = d.tipo_litologico
            row.este = d.este
            row.norte = d.norte
            row.elevacion = d.elevacion
            row.espesor_d = d.espesor_d
            row.longitud_l = d.longitud_l
            row.ancho_w1 = d.ancho_w1
            row.ancho_w2 = d.ancho_w2
            row.fuerza_p = d.fuerza_p
            row.direccion_rotura = d.direccion_rotura
            row.tipo_fractura = d.tipo_fractura
            row.factor_conversion_k = d.factor_conversion_k
            row.observaciones = d.observaciones
        else:
            row = models.EnsayoPLTIrregular(
                campana=d.campana, fecha_ensayo=d.fecha_ensayo, sector_geotecnico=d.sector_geotecnico,
                ejecutado_por=d.ejecutado_por, zona_mapeo=d.zona_mapeo, nivel=d.nivel,
                celda_mapeo=d.celda_mapeo.strip().upper(), muestra=d.muestra, codigo_muestra=d.codigo_muestra,
                litologia_1=d.litologia_1, litologia_2=d.litologia_2, litologia_3=d.litologia_3,
                tipo_litologico=d.tipo_litologico, este=d.este, norte=d.norte, elevacion=d.elevacion,
                espesor_d=d.espesor_d, longitud_l=d.longitud_l, ancho_w1=d.ancho_w1, ancho_w2=d.ancho_w2,
                fuerza_p=d.fuerza_p, direccion_rotura=d.direccion_rotura, tipo_fractura=d.tipo_fractura,
                factor_conversion_k=d.factor_conversion_k, observaciones=d.observaciones
            )
            db.add(row)
            
    db.commit()
    return {"status": "success", "message": "Ensayos PLT guardados con éxito"}