"""
plt_models.py — Modelo para Ensayos PLT en SQLite local.
NO forma parte de GEMA. Tabla independiente en plt.db.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Date, DateTime
from app.plt_database import Base


class EnsayoPLTIrregular(Base):
    __tablename__ = "ensayo_plt_irregular"

    id = Column(Integer, primary_key=True, autoincrement=True)
    campana = Column(Integer, nullable=False)
    fecha_ensayo = Column(Date, nullable=False)
    sector_geotecnico = Column(String(100), nullable=True)
    ejecutado_por = Column(String(200), nullable=False)
    zona_mapeo = Column(String(200), nullable=False)
    nivel = Column(Float, nullable=False)
    celda_mapeo = Column(String(100), nullable=False)
    muestra = Column(String(100), nullable=False)
    codigo_muestra = Column(String(100), nullable=False)
    litologia_1 = Column(String(100), nullable=False)
    litologia_2 = Column(String(100), nullable=True)
    litologia_3 = Column(String(100), nullable=True)
    tipo_litologico = Column(String(200), nullable=False)
    este = Column(Float, nullable=True)
    norte = Column(Float, nullable=True)
    elevacion = Column(Float, nullable=True)
    espesor_d = Column(Float, nullable=True)
    longitud_l = Column(Float, nullable=True)
    ancho_w1 = Column(Float, nullable=True)
    ancho_w2 = Column(Float, nullable=True)
    fuerza_p = Column(Float, nullable=True)
    direccion_rotura = Column(String(50), nullable=True)
    tipo_fractura = Column(String(50), nullable=True)
    factor_conversion_k = Column(Float, nullable=True)
    tipo_ensayo = Column(String(50), nullable=True, default="i")
    observaciones = Column(String(1000), nullable=True)
    creado_en = Column(DateTime, default=datetime.utcnow, nullable=False)
    modificado_en = Column(DateTime, nullable=True, onupdate=datetime.utcnow)