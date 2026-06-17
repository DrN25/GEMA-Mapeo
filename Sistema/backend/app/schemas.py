from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime

class DiscontinuidadBase(BaseModel):
    fam: Optional[int] = Field(None, alias="familia_id")
    dist: Optional[float] = Field(None, alias="distancia_m")
    tipo: str = Field(..., alias="tipo_estructura")
    dip: float
    dipdir: float = Field(..., alias="dip_dir")
    aber: Optional[float] = Field(None, alias="abertura_mm")
    esp: Optional[float] = Field(None, alias="espesor_mm")
    cont: Optional[float] = Field(None, alias="continuidad_m")
    espac: float = Field(..., alias="espaciamiento_m")
    nstr: Optional[float] = Field(None, alias="n_estructuras")
    next: Optional[int] = Field(None, alias="n_extremos_visibles")
    term: Optional[int] = Field(None, alias="terminacion")
    r1: Optional[str] = Field(None, alias="relleno_1_codigo")
    r2: Optional[str] = Field(None, alias="relleno_2_codigo")
    jrc: Optional[int] = Field(None)
    rug: Optional[int] = Field(None, alias="rugosidad_codigo")
    forma: Optional[str] = Field(None, alias="forma_estructura")
    alt: Optional[str] = Field(None, alias="alteracion_codigo")

    class Config:
        populate_by_name = True               # Pydantic v2
        allow_population_by_field_name = True # Pydantic v1
        from_attributes = True               # Pydantic v2
        orm_mode = True                      # Pydantic v1

class VentanaRmrInputBase(BaseModel):
    agua_codigo: str
    resistencia_codigo: str
    gsi_estructura: Optional[str] = None
    gsi_superficie: Optional[str] = None
    gsi_visual: Optional[int] = None
    control_estructural: Optional[int] = None
    efectos_voladura: Optional[int] = None
    ucs_mpa: Optional[float] = None
    is50_mpa: Optional[float] = None
    comentario: Optional[str] = None

    class Config:
        from_attributes = True

class VentanaSaveSchema(BaseModel):
    codigo: str
    fecha_mapeo: Optional[date] = None
    mapeador: Optional[str] = None
    campania: Optional[int] = None
    este_ini: float
    norte_ini: float
    cota_ini: float
    este_fin: float
    norte_fin: float
    cota_fin: float
    largo_m: Optional[float] = None
    altura_m: Optional[float] = None
    dip_talud: float
    alteracion_codigo: Optional[str] = None
    intemperismo_codigo: Optional[str] = None
    lito_1: Optional[str] = None
    lito_2: Optional[str] = None
    lito_3: Optional[str] = None
    unidad_litologica: Optional[str] = None
    sector: Optional[str] = None
    fase: Optional[int] = None
    nivel: Optional[float] = None
    sector_geotecnico: Optional[str] = None

    discontinuidades: List[DiscontinuidadBase] = []
    rmr_input: Optional[VentanaRmrInputBase] = None

    class Config:
        from_attributes = True

class VentanaSummarySchema(BaseModel):
    codigo: str
    fecha_mapeo: Optional[date] = None
    mapeador: Optional[str] = None
    lito_1: Optional[str] = None
    discontinuidades_count: int
    creado_en: datetime

    class Config:
        from_attributes = True
