"""
schemas.py — Contrato API alineado a GEMA (SQL Server)

Estrategia B+ (confirmada):
- API habla en códigos string ("LMT_M", "JN", "NW1_B")
- Backend traduce códigos → IDs FK antes de persistir (lookup en core/catalogs.py)
- GET devuelve códigos (no IDs) al frontend

El frontend nunca ve los IDs internos de GEMA. Esto permite importar Excel
directamente con códigos y mantener el frontend desacoplado del motor de BD.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Union, Dict, Any
from datetime import date, datetime


# ============================================================================
# DISCONTINUIDAD (EstructurasGeologicas) — inputs del usuario
# ============================================================================

class DiscontinuidadBase(BaseModel):
    # Identificación
    estructura_id: Optional[int] = None  # EstructuraID de BD (None = fila nueva local)
    fam: Optional[int] = Field(1, alias="familia_id")
    dist: Optional[float] = Field(None, alias="distancia_m")
    tipo: Optional[str] = Field("JN", alias="tipo_estructura")  # código: "JN", "BED", etc.

    # Geometría
    dip: Optional[float] = 0.0
    dipdir: Optional[float] = Field(0.0, alias="dip_dir")

    # Características físicas
    aber: Optional[float] = Field(None, alias="abertura_mm")
    esp: Optional[float] = Field(None, alias="espesor_mm")
    cont: Optional[float] = Field(None, alias="continuidad_m")
    espac: Optional[float] = Field(None, alias="espaciamiento_m")

    # Conteos
    nstr: Optional[int] = Field(None, alias="n_estructuras")  # NúmeroEstructuras (conteo, input usuario)
    next: Optional[int] = Field(None, alias="n_extremos_visibles")
    term: Optional[int] = Field(None, alias="terminacion")  # 0/1/2/3

    # Relleno (códigos string, no FK)
    r1: Optional[str] = Field(None, alias="relleno_1_codigo")
    r2: Optional[str] = Field(None, alias="relleno_2_codigo")

    # Geomecánica cualitativa
    jrc: Optional[float] = None  # GEMA usa DECIMAL(4,2), admito float
    rug: Optional[int] = Field(None, alias="rugosidad_codigo")  # 1-9
    forma: Optional[str] = Field(None, alias="forma_estructura")  # P/C/O/E/I
    alt: Optional[str] = Field(None, alias="alteracion_codigo")  # f/d/m/a/c/s

    # Proyección 3D
    teta: Optional[float] = None
    alfa: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None

    # Sub-ratings RMR '76 por estructura
    altR76: Optional[float] = Field(None, alias="valor_alteracion_cd76")
    relR76: Optional[float] = Field(None, alias="valor_relleno_cd76")
    contR76: Optional[float] = Field(None, alias="continuidad_cd76")
    abR76: Optional[float] = Field(None, alias="abertura_cd76")
    rugR76: Optional[float] = Field(None, alias="rugosidad_cd76")
    totalR76: Optional[float] = Field(None, alias="valor_condicion_cd76")

    # Sub-ratings RMR '89 por estructura
    altR89: Optional[float] = Field(None, alias="valor_alteracion_cd89")
    relR89: Optional[float] = Field(None, alias="valor_relleno_cd89")
    contR89: Optional[float] = Field(None, alias="continuidad_cd89")
    abR89: Optional[float] = Field(None, alias="abertura_cd89")
    rugR89: Optional[float] = Field(None, alias="rugosidad_cd89")
    totalR89: Optional[float] = Field(None, alias="valor_condicion_cd89")

    class Config:
        populate_by_name = True
        allow_population_by_field_name = True
        from_attributes = True


# ============================================================================
# RMR INPUT (campos mezclados en VentanasMapeo — ya no es tabla aparte)
# ============================================================================

class VentanaRmrInputBase(BaseModel):
    agua_codigo: Optional[str] = "C"                      # C/H/M/E/F
    resistencia_codigo: Optional[str] = "R4"               # R0-R6 (Dureza)
    gsi_estructura: Optional[str] = None  # texto corto
    gsi_superficie: Optional[str] = None  # texto corto
    gsi_visual: Optional[float] = None
    control_estructural: Optional[Any] = None  # 1-5 (backend lo varchar en BD pero int en API)
    efectos_voladura: Optional[Any] = None     # 1-6 (sin 4)
    ucs_mpa: Optional[float] = None
    is50_mpa: Optional[float] = None
    comentario: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================================
# VENTANA — guardado completo (cabecera + discontinuidades + rmr_input)
# ============================================================================

class VentanaSaveSchema(BaseModel):
    # Identificación
    codigo: str                            # CodigoCelda
    campania: Optional[Union[int, str]] = 2026 # CampañaID (FK)
    sector_geotecnico: Optional[str] = "PENDIENTE" # código sector ("NW1_B")
    fecha_mapeo: Optional[Union[date, str]] = None
    nivel: Optional[Union[str, float, int]] = None

    # Coordenadas
    este_ini: Optional[float] = 0.0
    norte_ini: Optional[float] = 0.0
    cota_ini: Optional[float] = 0.0
    este_fin: Optional[float] = 0.0
    norte_fin: Optional[float] = 0.0
    cota_fin: Optional[float] = 0.0

    # Geometría bancaria
    distancia_celda: Optional[float] = None  # DistanciaCelda
    altura: Optional[float] = None
    altura_m: Optional[float] = None
    dip: Optional[float] = None              # Dip (del sondaje/celda, no del talud)
    dip_hw: Optional[float] = None
    azimut_hole: Optional[float] = None
    az_hw: Optional[float] = None
    dip_talud: Optional[float] = 64.0
    dipdir_talud: Optional[float] = None

    # Otros campos de cabecera
    lito_1: Optional[str] = None            # código ("MZQ")
    lito_2: Optional[str] = None            # código
    lito_3: Optional[str] = None            # código
    unidad_litologica: Optional[str] = None  # código ("Intrusivos")
    intemperismo: Optional[str] = None       # código (f/d/m/a/c/s)
    intemperismo_codigo: Optional[str] = None
    alteracion: Optional[str] = None         # texto corto (alteración de zona)
    altura_mapeo: Optional[str] = None       # retrocompatibilidad
    alteracion_codigo: Optional[str] = None
    fase: Optional[Union[int, str]] = None
    mapeador: Optional[str] = None          # código del geotécnico (triggered a FK)

    # Sub-objeto: discontinuidades
    discontinuidades: List[DiscontinuidadBase] = []

    # Sub-objeto: rmr input
    rmr_input: Optional[VentanaRmrInputBase] = None

    class Config:
        from_attributes = True


# ============================================================================
# VENTANA — resumen (para listado en dashboard)
# ============================================================================

class VentanaSummarySchema(BaseModel):
    codigo: str
    fecha_mapeo: Optional[date] = None
    mapeador: Optional[str] = None
    lito_1: Optional[str] = None
    discontinuidades_count: int
    rmr_76: Optional[float] = None
    rmr_89: Optional[float] = None
    creado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# VENTANA — respuesta completa (GET /ventanas/{codigo})
# Incluye sub-ratings calculados en backend (patrón Hybrid Cache Writable)
# ============================================================================

class DiscontinuidadResponse(DiscontinuidadBase):
    # Sub-ratings persistidos (pre-calculados, no editables por UI)
    numero_estructura: Optional[int] = None
    # Sub-ratings 76
    altR76: Optional[float] = None
    relR76: Optional[float] = None
    contR76: Optional[float] = None
    abR76: Optional[float] = None
    rugR76: Optional[float] = None
    totalR76: Optional[float] = None
    # Sub-ratings 89
    altR89: Optional[float] = None
    relR89: Optional[float] = None
    contR89: Optional[float] = None
    abR89: Optional[float] = None
    rugR89: Optional[float] = None
    totalR89: Optional[float] = None
    # Coordenadas proyectadas
    teta: Optional[float] = None
    alfa: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None


class VentanaResponseSchema(BaseModel):
    """Respuesta completa del GET /ventanas/{codigo} con todo el estado."""
    codigo: str
    campania: Optional[int] = None
    sector_geotecnico: Optional[str] = None
    fecha_mapeo: Optional[date] = None
    nivel: Optional[str] = None

    este_ini: float
    norte_ini: float
    cota_ini: float
    este_fin: float
    norte_fin: float
    cota_fin: float

    distancia_celda: Optional[float] = None
    altura: Optional[float] = None
    altura_m: Optional[float] = None
    dip: Optional[float] = None
    dip_hw: Optional[float] = None
    azimut_hole: Optional[float] = None
    az_hw: Optional[float] = None
    dip_talud: float
    dipdir_talud: Optional[float] = None

    lito_1: Optional[str] = None
    lito_2: Optional[str] = None
    lito_3: Optional[str] = None
    unidad_litologica: Optional[str] = None
    intemperismo: Optional[str] = None
    alteracion: Optional[str] = None
    altura_mapeo: Optional[str] = None
    fase: Optional[int] = None
    mapeador: Optional[str] = None

    rmr_input: Optional[VentanaRmrInputBase] = None

    # Sub-ratings de cabecera calculados (RMR 76 y 89)
    agua_r76: Optional[float] = None
    agua_r89: Optional[float] = None
    resist_r76: Optional[float] = None
    resist_r89: Optional[float] = None
    rqd_r76: Optional[float] = None
    rqd_r89: Optional[float] = None
    rqd_pct: Optional[float] = None
    jv: Optional[float] = None
    espac_prom: Optional[float] = None
    spacing_r76: Optional[float] = None
    spacing_r89: Optional[float] = None
    condisc_r76: Optional[float] = None
    condisc_r89: Optional[float] = None
    rmr_76: Optional[float] = None
    rmr_89: Optional[float] = None
    largo_m: Optional[float] = None

    discontinuidades: List[DiscontinuidadResponse] = []

    class Config:
        from_attributes = True
        populate_by_name = True
        allow_population_by_field_name = True


# >>> EnsayoPLTSaveSchema — local SQLite (no GEMA)
class EnsayoPLTSaveSchema(BaseModel):
    id: Optional[int] = None
    campana: Optional[Union[int, str]] = 2026
    fecha_ensayo: Optional[date] = None
    sector_geotecnico: Optional[str] = None
    ejecutado_por: Optional[str] = None
    zona_mapeo: Optional[str] = None
    nivel: Optional[Union[float, str]] = None
    celda_mapeo: Optional[str] = None
    muestra: Optional[str] = None
    codigo_muestra: Optional[str] = None
    litologia_1: Optional[str] = None
    litologia_2: Optional[str] = None
    litologia_3: Optional[str] = None
    tipo_litologico: Optional[str] = None
    este: Optional[float] = None
    norte: Optional[float] = None
    elevacion: Optional[float] = None
    espesor_d: Optional[float] = None
    longitud_l: Optional[float] = None
    ancho_w1: Optional[float] = None
    ancho_w2: Optional[float] = None
    ancho_w: Optional[float] = None
    muestra_valida_longitud: Optional[Union[bool, str]] = None
    muestra_valida_ancho: Optional[Union[bool, str]] = None
    fuerza_p: Optional[float] = None
    direccion_rotura: Optional[str] = None
    tipo_fractura: Optional[str] = None
    diametro_equivalente: Optional[float] = None
    f: Optional[float] = None
    is_mpa: Optional[float] = None
    is_50: Optional[float] = None
    factor_conversion_k: Optional[float] = None
    ucs: Optional[float] = None
    resistencia_isrm: Optional[str] = None
    denominacion_isrm: Optional[str] = None
    tipo_ensayo: Optional[str] = "i"
    observaciones: Optional[str] = None

    class Config:
        from_attributes = True
        populate_by_name = True
        allow_population_by_field_name = True


# ============================================================================
# VENTANA — item liviano para lista paginada (con datos reales desde BD)
# ============================================================================

class VentanaListItemSchema(BaseModel):
    codigo: str
    fecha_mapeo: Optional[date] = None
    sector_geotecnico: Optional[str] = None
    mapeador: Optional[str] = None
    lito_1: Optional[str] = None
    largo_m: Optional[float] = None
    altura_m: Optional[float] = None
    nivel: Optional[str] = None
    rmr_76: Optional[float] = None
    rmr_89: Optional[float] = None
    rqd76_pct: Optional[float] = None
    rqd89_pct: Optional[float] = None
    gsi_visual: Optional[float] = None
    discontinuidades_count: int = 0
    creado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


class VentanasKPISchema(BaseModel):
    """KPIs contextuales sobre el subconjunto filtrado."""
    celdas_count: int = 0
    total_global: int = 0
    largo_total_m: float = 0.0
    rmr_76_promedio: Optional[float] = None
    rmr_89_promedio: Optional[float] = None
    mapeador_mas_reciente: Optional[str] = None
    fecha_min: Optional[date] = None
    fecha_max: Optional[date] = None


class VentanasPaginatedResponse(BaseModel):
    items: List[VentanaListItemSchema] = []
    total: int = 0
    total_filtered: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 1
    kpis: VentanasKPISchema = VentanasKPISchema()