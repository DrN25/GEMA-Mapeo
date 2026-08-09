"""
models.py — Alineado a GEMA (SQL Server)

Tabla principal: mapeo.VentanasMapeo
Tabla de estructuras: mapeo.EstructurasGeologicas (1:N con cascade)

Catálogos (solo lectura — el backend NO los usa, los códigos se traducen
en el router via core/catalogs.py):
- dbo.Campañas
- mapeo.SectoresGeotecnicos
- dbo.Litologias
- dbo.UnidadesLitologicas
- dbo.TiposEstructura
- dbo.Geotecnicos

Si en el futuro decides que el backend lea catálogos de GEMA, desncomentar
los modelos catalog y agregar inner join en routers/ventanas.py:resolve_*.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, Float, String, Numeric, Date, DateTime, Boolean, ForeignKey, Identity, func
)
from sqlalchemy.orm import relationship
from app.database import Base


# ============================================================================
# CATÁLOGOS — SÓLO LECTURA (FKs target). Catálogos fuente de verdad en Python: core/catalogs.py
# ============================================================================

class Campania(Base):
    __tablename__ = "Campañas"
    __table_args__ = {"schema": "dbo"}

    campania_id = Column("CampañaID", Integer, primary_key=True)
    nombre = Column("NombreCampaña", String(100), nullable=False)
    fecha_inicio = Column("FechaInicio", Date, nullable=True)
    fecha_fin = Column("FechaFin", Date, nullable=True)
    descripcion = Column("Descripcion", String(500), nullable=True)
    estado = Column("Estado", String(20), nullable=False, default="Activa")
    fecha_registro = Column("FechaRegistro", DateTime, nullable=False, default=func.getdate())


class SectorGeotecnico(Base):
    __tablename__ = "SectoresGeotecnicos"
    __table_args__ = {"schema": "mapeo"}

    sector_id = Column("SectorGeotecnicoID", Integer, primary_key=True)
    codigo = Column("CodigoSector", String(20), nullable=False, unique=True)
    nombre = Column("NombreSector", String(100), nullable=False)
    descripcion = Column("Descripcion", String, nullable=True)
    proyecto = Column("Proyecto", String(100), nullable=True)
    estado = Column("Estado", String(20), nullable=False, default="Activo")
    fecha_registro = Column("FechaRegistro", DateTime, nullable=False, default=func.getdate())


class Litologia(Base):
    __tablename__ = "Litologias"
    __table_args__ = {"schema": "dbo"}

    litologia_id = Column("LitologiaID", Integer, primary_key=True)
    codigo = Column("CodigoLitologia", String(20), nullable=False, unique=True)
    nombre = Column("NombreLitologia", String(100), nullable=False)
    descripcion = Column("Descripcion", String(500), nullable=True)
    tipo_roca = Column("TipoRoca", String(50), nullable=True)
    fecha_registro = Column("FechaRegistro", DateTime, nullable=False, default=func.getdate())


class UnidadLitologica(Base):
    __tablename__ = "UnidadesLitologicas"
    __table_args__ = {"schema": "dbo"}

    unidad_id = Column("UnidadLitologicaID", Integer, primary_key=True)
    codigo = Column("CodigoUnidad", String(20), nullable=False, unique=True)
    nombre = Column("NombreUnidad", String(100), nullable=False)
    descripcion = Column("Descripcion", String, nullable=True)
    tipo_roca = Column("TipoRoca", String(50), nullable=True)
    estado = Column("Estado", String(20), nullable=False, default="Activo")
    fecha_registro = Column("FechaRegistro", DateTime, nullable=False, default=func.getdate())


class TipoEstructura(Base):
    __tablename__ = "TiposEstructura"
    __table_args__ = {"schema": "dbo"}

    tipo_estructura_id = Column("TipoEstructuraID", Integer, primary_key=True)
    codigo = Column("CodigoEstructura", String(20), nullable=False, unique=True)
    nombre = Column("NombreEstructura", String(100), nullable=False)
    descripcion = Column("Descripcion", String(500), nullable=True)
    fecha_registro = Column("FechaRegistro", DateTime, nullable=False, default=func.getdate())


class Geotecnico(Base):
    __tablename__ = "Geotecnicos"
    __table_args__ = {"schema": "dbo"}

    geotecnico_id = Column("GeotecnicoID", Integer, primary_key=True)
    nombre = Column("NombreCompleto", String(150), nullable=False)
    especialidad = Column("Especialidad", String(100), nullable=True)
    email = Column("Email", String(100), nullable=True)
    telefono = Column("Telefono", String(20), nullable=True)
    estado = Column("Estado", String(20), nullable=False, default="Activo")


# ============================================================================
# TABLA PRINCIPAL: mapeo.VentanasMapeo
# (Incluye todos los sub-ratings de cabecera RMR'76 y '89)
# ============================================================================

class Ventana(Base):
    __tablename__ = "VentanasMapeo"
    __table_args__ = {"schema": "mapeo"}

    ventana_id = Column("VentanaID", Integer, Identity(always=True), primary_key=True)
    codigo_celda = Column("CodigoCelda", String(20), nullable=False)
    campania_id = Column("CampañaID", Integer, ForeignKey("dbo.Campañas.CampañaID"), nullable=False)
    sector_geotecnico_id = Column("SectorGeotecnicoID", Integer, ForeignKey("mapeo.SectoresGeotecnicos.SectorGeotecnicoID"), nullable=False)
    fecha_mapeo = Column("FechaMapeo", Date, nullable=True)
    nivel = Column("Nivel", String(50), nullable=True)

    # Coordenadas (DECIMAL(12,3) y (8,3) según GEMA.sql)
    este_from = Column("EsteFrom", Numeric(12, 3), nullable=False)
    norte_from = Column("NorteFrom", Numeric(12, 3), nullable=False)
    cota_from = Column("CotaFrom", Numeric(8, 3), nullable=False)
    este_to = Column("EsteTo", Numeric(12, 3), nullable=False)
    norte_to = Column("NorteTo", Numeric(12, 3), nullable=False)
    cota_to = Column("CotaTo", Numeric(8, 3), nullable=False)

    # Geometría bancaria
    distancia_celda = Column("DistanciaCelda", Numeric(8, 3), nullable=True)
    altura = Column("Altura", Numeric(8, 3), nullable=True)
    dip = Column("DIP", Numeric(5, 2), nullable=True)
    azimut_hole = Column("AzimutHole", Numeric(6, 2), nullable=True)
    dip_talud = Column("DipTalud", Numeric(5, 2), nullable=True)
    dip_dir_talud = Column("DipDirTalud", Numeric(6, 2), nullable=True)

    # Litología (FKs a catálogos)
    litologia1_id = Column("Litologia1ID", Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    litologia2_id = Column("Litologia2ID", Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    litologia3_id = Column("Litologia3ID", Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    unidad_litologica_id = Column("UnidadLitologicaID", Integer, ForeignKey("dbo.UnidadesLitologicas.UnidadLitologicaID"), nullable=True)

    # Cabecera geológica
    grado_intemperismo = Column("GradoIntemperismo", String(10), nullable=True)
    alteracion = Column("Alteracion", String(50), nullable=True)
    fase = Column("Fase", Integer, nullable=True)

    # GSI inputs
    gsi_superficie = Column("GSISuperficie", String(20), nullable=True)
    gsi_estructura = Column("GSIEstructura", String(20), nullable=True)

    # =================== RMR '76 (cabecera) ===================
    condicion_agua_rmr76 = Column("CondicionAguaRMR76", String(50), nullable=True)
    condicion_agua_valor_rmr76 = Column("CondicionAguaValorRMR76", Numeric(5, 2), nullable=True)
    dureza_rmr76 = Column("DurezaRMR76", String(10), nullable=True)
    resistencia_estimada_valor_rmr76 = Column("ResistenciaEstimadaValorRMR76", Numeric(5, 2), nullable=True)
    gsi_visual_rmr76 = Column("GSI_VisualRMR76", Numeric(5, 2), nullable=True)
    control_estructural_rmr76 = Column("ControlEstructuralRMR76", String(50), nullable=True)
    efectos_voladura_rmr76 = Column("EfectosVoladuraRMR76", String(50), nullable=True)
    rqd_valor_rmr76 = Column("RQD_ValorRMR76", Numeric(5, 2), nullable=True)
    rqd_rmr76 = Column("RQD_RMR76", Numeric(5, 2), nullable=True)
    frecuencia_fracturamiento_rmr76 = Column("FrecuenciaFracturamientoRMR76", Numeric(8, 3), nullable=True)
    tamano_bloques_rmr76 = Column("TamañoBloquesRMR76", Numeric(8, 3), nullable=True)
    espaciamiento_promedio_rmr76 = Column("EspaciamientoPromedioRMR76", Numeric(8, 3), nullable=True)
    espaciamiento_valor_rmr76 = Column("EspaciamientoValorRMR76", Numeric(5, 2), nullable=True)
    condicion_discontinuidad_valor_rmr76 = Column("CondicionDiscontinuidadValorRMR76", Numeric(5, 2), nullable=True)
    rmr76_total = Column("RMR76_Total", Numeric(5, 2), nullable=True)

    # =================== RMR '89 (cabecera) ===================
    condicion_agua_rmr89 = Column("CondicionAguaRMR89", String(50), nullable=True)
    condicion_agua_valor_rmr89 = Column("CondicionAguaValorRMR89", Numeric(5, 2), nullable=True)
    dureza_rmr89 = Column("DurezaRMR89", String(10), nullable=True)
    resistencia_estimada_valor_rmr89 = Column("ResistenciaEstimadaValorRMR89", Numeric(5, 2), nullable=True)
    gsi_visual_rmr89 = Column("GSI_VisualRMR89", Numeric(5, 2), nullable=True)
    control_estructural_rmr89 = Column("ControlEstructuralRMR89", String(50), nullable=True)
    efectos_voladura_rmr89 = Column("EfectosVoladuraRMR89", String(50), nullable=True)
    rqd_valor_rmr89 = Column("RQD_ValorRMR89", Numeric(5, 2), nullable=True)
    rqd_rmr89 = Column("RQD_RMR89", Numeric(5, 2), nullable=True)
    frecuencia_fracturamiento_rmr89 = Column("FrecuenciaFracturamientoRMR89", Numeric(8, 3), nullable=True)
    tamano_bloques_rmr89 = Column("TamañoBloquesRMR89", Numeric(8, 3), nullable=True)
    espaciamiento_promedio_rmr89 = Column("EspaciamientoPromedioRMR89", Numeric(8, 3), nullable=True)
    espaciamiento_valor_rmr89 = Column("EspaciamientoValorRMR89", Numeric(5, 2), nullable=True)
    condicion_discontinuidad_valor_rmr89 = Column("CondicionDiscontinuidadValorRMR89", Numeric(5, 2), nullable=True)
    rmr89_total = Column("RMR89_Total", Numeric(5, 2), nullable=True)

    # Resistencia intacta
    ucs_mpa = Column("UCS_MPa", Numeric(8, 3), nullable=True)
    is50_mpa = Column("IS50_MPa", Numeric(8, 3), nullable=True)

    # Relaciones FK
    geotecnico_id = Column("GeotecnicoID", Integer, ForeignKey("dbo.Geotecnicos.GeotecnicoID"), nullable=True)
    comentarios = Column("Comentarios", String, nullable=True)

    # Auditoría (FechaRegistro ya tiene DEFAULT getdate en GEMA.sql)
    fecha_registro = Column("FechaRegistro", DateTime, nullable=False, default=func.getdate(), server_default=func.getdate())
    usuario_registro = Column("UsuarioRegistro", String(100), nullable=True)
    fecha_modificacion = Column("FechaModificacion", DateTime, nullable=True)
    usuario_modificacion = Column("UsuarioModificacion", String(100), nullable=True)

    # Relationship
    discontinuidades = relationship(
        "EstructuraGeologica",
        back_populates="ventana",
        cascade="all, delete-orphan",
        passive_deletes=True
    )


# ============================================================================
# TABLA DE ESTRUCTURAS: mapeo.EstructurasGeologicas
# (con sub-ratings por discontinuidad agregados)
# ============================================================================

class EstructuraGeologica(Base):
    __tablename__ = "EstructurasGeologicas"
    __table_args__ = {"schema": "mapeo"}

    estructura_id = Column("EstructuraID", Integer, Identity(always=True), primary_key=True)
    ventana_id = Column("VentanaID", Integer, ForeignKey("mapeo.VentanasMapeo.VentanaID", ondelete="CASCADE"), nullable=False)
    numero_estructura = Column("NumeroEstructura", Integer, nullable=False)
    tipo_estructura_id = Column("TipoEstructuraID", Integer, ForeignKey("dbo.TiposEstructura.TipoEstructuraID"), nullable=True)

    dip = Column("Dip", Numeric(5, 2), nullable=False)
    dip_dir = Column("DipDir", Numeric(6, 2), nullable=False)
    distancia_estructura = Column("DistanciaEstructura", Numeric(8, 3), nullable=True)

    # Proyección 3D calculada
    teta = Column("Teta", Numeric(6, 2), nullable=True)
    alfa = Column("Alfa", Numeric(6, 2), nullable=True)
    x = Column("X", Numeric(12, 3), nullable=True)
    y = Column("Y", Numeric(12, 3), nullable=True)
    z = Column("Z", Numeric(12, 3), nullable=True)

    # Características físicas
    abertura_mm = Column("Abertura_mm", Numeric(8, 3), nullable=True)
    espesor_mm = Column("Espesor_mm", Numeric(8, 3), nullable=True)
    continuidad_m = Column("Continuidad_m", Numeric(8, 3), nullable=True)
    espaciamiento_m = Column("Espaciamiento_m", Numeric(8, 3), nullable=True)
    numero_extremos_visibles = Column("NumeroExtremosVisibles", Integer, nullable=True)

    # Relleno (String según GEMA.sql — no es FK a catálogo)
    tipo_relleno_1 = Column("TipoRelleno1", String(50), nullable=True)
    tipo_relleno_2 = Column("TipoRelleno2", String(50), nullable=True)

    jrc = Column("JRC", Numeric(4, 2), nullable=True)
    rugosidad_estructura = Column("RugosidadEstructura", String(50), nullable=True)
    forma_estructura = Column("FormaEstructura", String(50), nullable=True)
    alteracion = Column("Alteracion", String(50), nullable=True)

    # Familia (1-9) — agrupación lógica
    familia_id = Column("FamiliaID", Integer, nullable=True)
    # Número de estructuras del mismo tipo (input del usuario)
    numero_estructuras = Column("NumeroEstructuras", Integer, nullable=True)
    # Terminación (0/1/2/3)
    terminacion = Column("Terminacion", Integer, nullable=True)

    # =================== Sub-ratings RMR '76 por estructura ===================
    valor_alteracion_cd76 = Column("ValorAlteracionCD76", Numeric(5, 2), nullable=True)
    valor_relleno_cd76	= Column("ValorRellenoCD76", Numeric(5, 2), nullable=True)
    continuidad_cd76	= Column("ContinuidadCD76", Numeric(5, 2), nullable=True)
    abertura_cd76		= Column("AberturaCD76", Numeric(5, 2), nullable=True)
    rugosidad_cd76		= Column("RugosidadCD76", Numeric(5, 2), nullable=True)
    valor_condicion_cd76	= Column("ValorCondicionCD76", Numeric(5, 2), nullable=True)

    # =================== Sub-ratings RMR '89 por estructura ===================
    valor_alteracion_cd89 = Column("ValorAlteracionCD89", Numeric(5, 2), nullable=True)
    valor_relleno_cd89	= Column("ValorRellenoCD89", Numeric(5, 2), nullable=True)
    continuidad_cd89	= Column("ContinuidadCD89", Numeric(5, 2), nullable=True)
    abertura_cd89		= Column("AberturaCD89", Numeric(5, 2), nullable=True)
    rugosidad_cd89		= Column("RugosidadCD89", Numeric(5, 2), nullable=True)
    valor_condicion_cd89	= Column("ValorCondicionCD89", Numeric(5, 2), nullable=True)

    # Auditoría
    fecha_registro = Column("FechaRegistro", DateTime, nullable=False, default=func.getdate(), server_default=func.getdate())
    usuario_registro = Column("UsuarioRegistro", String(100), nullable=True)
    fecha_modificacion = Column("FechaModificacion", DateTime, nullable=True)
    usuario_modificacion = Column("UsuarioModificacion", String(100), nullable=True)

    # Relationship
    ventana = relationship("Ventana", back_populates="discontinuidades")


# Alias para compatibilidad con código existente
Discontinuidad = EstructuraGeologica


# ============================================================================
# TABLA DE ENSAYOS PLT IRREGULARES: plt.EnsayoPLT (SQL Server)
# ============================================================================

class EnsayoPLT(Base):
    __tablename__ = "EnsayoPLT"
    __table_args__ = {"schema": "plt"}

    ensayo_plt_id = Column("EnsayoPLT_ID", Integer, Identity(always=True), primary_key=True)
    codigo_muestra = Column("CodigoMuestra", String(20), nullable=True)
    campania_id = Column("CampañaID", Integer, nullable=False)
    litologia1_id = Column("LitologiaID_1", Integer, nullable=True)
    litologia2_id = Column("LitologiaID_2", Integer, nullable=True)
    litologia3_id = Column("LitologiaID_3", Integer, nullable=True)
    ventana_id = Column("VentanaID", Integer, ForeignKey("mapeo.VentanasMapeo.VentanaID"), nullable=True)
    tipo_ensayo_id = Column("TipoEnsayoPLT_ID", Integer, nullable=True, default=4)
    direccion_id = Column("DireccionID", Integer, nullable=True)
    tipo_fractura_id = Column("TipoFracturaPLT_ID", Integer, nullable=True)
    factor_k_valor = Column("FactorK_Valor", Numeric(5, 2), nullable=True)
    fecha_ensayo = Column("FechaEnsayo", Date, nullable=True)
    ejecucion_ensayo = Column("EjecucionEnsayo", String(40), nullable=True)
    zona_muestreo = Column("ZonaMuestreo", String(60), nullable=True)
    coordenada_este = Column("CoordenadaEste", Numeric(10, 4), nullable=True)
    coordenada_norte = Column("CoordenadaNorte", Numeric(11, 4), nullable=True)
    elevacion = Column("Elevacion", Numeric(8, 2), nullable=True)
    espesor_d_cm = Column("Espesor_D_cm", Numeric(5, 2), nullable=True)
    longitud_l_cm = Column("Longitud_L_cm", Numeric(6, 2), nullable=True)
    ancho_w1_cm = Column("Ancho_W1_cm", Numeric(6, 2), nullable=True)
    ancho_w2_cm = Column("Ancho_W2_cm", Numeric(6, 2), nullable=True)
    ancho_w_cm = Column("Ancho_W_cm", Numeric(6, 2), nullable=True)
    muestra_valida_long = Column("MuestraValidaLong", Boolean, nullable=True)
    muestra_valida_ancho = Column("MuestraValidaAncho", Boolean, nullable=True)
    fuerza_p_kn = Column("FuerzaP_kN", Numeric(8, 4), nullable=True)
    diametro_equiv_cm = Column("DiametroEquiv_cm", Numeric(7, 4), nullable=True)
    factor_f = Column("FactorF", Numeric(6, 4), nullable=True)
    is_mpa = Column("Is_MPa", Numeric(8, 4), nullable=True)
    is50_mpa = Column("Is50_MPa", Numeric(8, 4), nullable=True)
    ucs_mpa = Column("UCS_MPa", Numeric(9, 3), nullable=True)
    denominacion_isrm = Column("DenominacionISRM", String(40), nullable=True)
    observaciones = Column("Observaciones", String(300), nullable=True)
    fecha_registro = Column("FechaRegistro", DateTime, nullable=False, default=func.getdate(), server_default=func.getdate())
    usuario_registro = Column("UsuarioRegistro", String(50), nullable=True)
    origen_plt = Column("OrigenPLT", String(10), nullable=False, default="IRREGULAR")
    nro_muestra = Column("NroMuestra", String(8), nullable=True)
    tipo_litologico = Column("TipoLitologico", String(20), nullable=True)
    nivel = Column("Nivel", String(50), nullable=True)
    sector_geotecnico_id = Column("SectorGeotecnicoID", Integer, nullable=True)


# ============================================================================
# ESQUEMA DE AUTENTICACIÓN Y ROLES: auth.Roles y auth.Usuarios
# ============================================================================

class Role(Base):
    __tablename__ = "Roles"
    __table_args__ = {"schema": "auth"}

    rol_id = Column("RolID", Integer, primary_key=True)
    nombre = Column("Nombre", String(50), nullable=False, unique=True)
    descripcion = Column("Descripcion", String(200), nullable=True)
    estado = Column("Estado", String(1), nullable=False, default="A")

    usuarios = relationship("Usuario", back_populates="rol")


class Usuario(Base):
    __tablename__ = "Usuarios"
    __table_args__ = {"schema": "auth"}

    usuario_id = Column("UsuarioID", Integer, primary_key=True)
    usuario = Column("Usuario", String(50), nullable=False, unique=True)
    email = Column("Email", String(200), nullable=False, unique=True)
    contrasena_hash = Column("ContrasenaHash", String(255), nullable=False)
    nombre_completo = Column("NombreCompleto", String(150), nullable=True)
    rol_id = Column("RolID", Integer, ForeignKey("auth.Roles.RolID"), nullable=False)
    geotecnico_id = Column("GeotecnicoID", Integer, ForeignKey("dbo.Geotecnicos.GeotecnicoID"), nullable=True)
    estado = Column("Estado", String(1), nullable=False, default="A")
    ultimo_acceso = Column("UltimoAcceso", DateTime, nullable=True)
    fecha_registro = Column("FechaRegistro", DateTime, nullable=False, default=func.getdate())
    usuario_registro = Column("UsuarioRegistro", String(100), nullable=True)
    fecha_modificacion = Column("FechaModificacion", DateTime, nullable=True)
    usuario_modificacion = Column("UsuarioModificacion", String(100), nullable=True)

    rol = relationship("Role", back_populates="usuarios")
    geotecnico = relationship("Geotecnico")