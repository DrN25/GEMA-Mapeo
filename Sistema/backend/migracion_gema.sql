/* ========================================================================
 Migración schema GEMA — Adaptar tablas existentes para el backend
 Fecha: 2026-07-19
 Ejecutar en: SQL Server Management Studio contra base [GEMA]
 Notas: Todos los ALTER son idempotentes (revisan si la columna ya existe).
 ======================================================================== */
USE [GEMA];
GO
    /* ----------------------------------------------------------------------
     BLOQUE 1: Columnas faltantes en [mapeo].[VentanasMapeo]
     ---------------------------------------------------------------------- */
    -- alt_zona (Alta/Media/Baja — campo de cabecera)
    IF COL_LENGTH('mapeo.VentanasMapeo', 'AlturaZona') IS NULL BEGIN
ALTER TABLE [mapeo].[VentanasMapeo]
ADD [AlturaZona] [nvarchar](20) NULL;
PRINT '✓ Agregada columna AlturaZona a mapeo.VentanasMapeo';
END
GO -- fase (1-5)
    IF COL_LENGTH('mapeo.VentanasMapeo', 'Fase') IS NULL BEGIN
ALTER TABLE [mapeo].[VentanasMapeo]
ADD [Fase] [int] NULL;
PRINT '✓ Agregada columna Fase a mapeo.VentanasMapeo';
END
GO -- turno (Día/Noche)
    IF COL_LENGTH('mapeo.VentanasMapeo', 'Turno') IS NULL BEGIN
ALTER TABLE [mapeo].[VentanasMapeo]
ADD [Turno] [nvarchar](20) NULL;
PRINT '✓ Agregada columna Turno a mapeo.VentanasMapeo';
END
GO -- GSI Superficie (texto corto)
    IF COL_LENGTH('mapeo.VentanasMapeo', 'GSISuperficie') IS NULL BEGIN
ALTER TABLE [mapeo].[VentanasMapeo]
ADD [GSISuperficie] [nvarchar](20) NULL;
PRINT '✓ Agregada columna GSISuperficie a mapeo.VentanasMapeo';
END
GO -- GSI Estructura (texto corto)
    IF COL_LENGTH('mapeo.VentanasMapeo', 'GSIEstructura') IS NULL BEGIN
ALTER TABLE [mapeo].[VentanasMapeo]
ADD [GSIEstructura] [nvarchar](20) NULL;
PRINT '✓ Agregada columna GSIEstructura a mapeo.VentanasMapeo';
END
GO
    /* ----------------------------------------------------------------------
     BLOQUE 2: Sub-ratings por discontinuidad en [mapeo].[EstructurasGeologicas]
     ---------------------------------------------------------------------- */
    -- Cantidad de estructuras del mismo tipo (input del usuario, no ordinal)
    IF COL_LENGTH(
        'mapeo.EstructurasGeologicas',
        'NumeroEstructuras'
    ) IS NULL BEGIN
ALTER TABLE [mapeo].[EstructurasGeologicas]
ADD [NumeroEstructuras] [int] NULL;
PRINT '✓ Agregada columna NumeroEstructuras a mapeo.EstructurasGeologicas';
END
GO -- Terminación (0/1/2/3)
    IF COL_LENGTH('mapeo.EstructurasGeologicas', 'Terminacion') IS NULL BEGIN
ALTER TABLE [mapeo].[EstructurasGeologicas]
ADD [Terminacion] [int] NULL;
PRINT '✓ Agregada columna Terminacion a mapeo.EstructurasGeologicas';
END
ELSE BEGIN PRINT 'ℹ La columna Terminacion ya existe';
END
GO -- Familia (1-9) — ordinal dentro de la familia, NO ordinal de ventana
    IF COL_LENGTH('mapeo.EstructurasGeologicas', 'FamiliaID') IS NULL BEGIN
ALTER TABLE [mapeo].[EstructurasGeologicas]
ADD [FamiliaID] [int] NULL;
PRINT '✓ Agregada columna FamiliaID a mapeo.EstructurasGeologicas';
END
GO -- Sub-ratings 76
    IF COL_LENGTH(
        'mapeo.EstructurasGeologicas',
        'ValorAlteracionCD76'
    ) IS NULL BEGIN
ALTER TABLE [mapeo].[EstructurasGeologicas]
ADD [ValorAlteracionCD76] [decimal](5, 2) NULL,
    [ValorRellenoCD76] [decimal](5, 2) NULL,
    [ContinuidadCD76] [decimal](5, 2) NULL,
    [AberturaCD76] [decimal](5, 2) NULL,
    [RugosidadCD76] [decimal](5, 2) NULL,
    [ValorCondicionCD76] [decimal](5, 2) NULL;
PRINT '✓ Agregadas 6 columnas de sub-ratings RMR76 a mapeo.EstructurasGeologicas';
END
GO -- Sub-ratings 89
    IF COL_LENGTH(
        'mapeo.EstructurasGeologicas',
        'ValorAlteracionCD89'
    ) IS NULL BEGIN
ALTER TABLE [mapeo].[EstructurasGeologicas]
ADD [ValorAlteracionCD89] [decimal](5, 2) NULL,
    [ValorRellenoCD89] [decimal](5, 2) NULL,
    [ContinuidadCD89] [decimal](5, 2) NULL,
    [AberturaCD89] [decimal](5, 2) NULL,
    [RugosidadCD89] [decimal](5, 2) NULL,
    [ValorCondicionCD89] [decimal](5, 2) NULL;
PRINT '✓ Agregadas 6 columnas de sub-ratings RMR89 a mapeo.EstructurasGeologicas';
END
GO -- Coordendas proyectadas de la estructura (X/Y/Z en el plano de la ventana)
    -- Nota: X/Y/Z ya existen como columnas en GEMA.sql, NO toca agregar
    -- FechaModificacion y UsuarioModificacion en EstructurasGeologicas (no estaban en GEMA)
    IF COL_LENGTH('mapeo.EstructurasGeologicas', 'UsuarioRegistro') IS NULL BEGIN
ALTER TABLE [mapeo].[EstructurasGeologicas]
ADD [UsuarioRegistro] [nvarchar](100) NULL,
    [FechaModificacion] [datetime] NULL,
    [UsuarioModificacion] [nvarchar](100) NULL;
PRINT '✓ Agregadas columnas de auditoría a mapeo.EstructurasGeologicas';
END
GO
    /* ----------------------------------------------------------------------
     BLOQUE 3: Índices recomendados (no bloqueantes)
     ---------------------------------------------------------------------- */
    -- Índice por CodigoCelda en VentanasMapeo (lookup rápido por código)
    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'IX_VentanasMapeo_CodigoCelda'
    ) BEGIN CREATE INDEX [IX_VentanasMapeo_CodigoCelda] ON [mapeo].[VentanasMapeo] ([CodigoCelda]);
PRINT '✓ Creado índice IX_VentanasMapeo_CodigoCelda';
END
GO -- Índice por CampañaID en VentanasMapeo (filtros por campaña en auditoría)
    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'IX_VentanasMapeo_CampanaID'
    ) BEGIN CREATE INDEX [IX_VentanasMapeo_CampanaID] ON [mapeo].[VentanasMapeo] ([CampañaID]);
PRINT '✓ Creado índice IX_VentanasMapeo_CampanaID';
END
GO -- Índice por SectorGeotecnicoID en VentanasMapeo
    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'IX_VentanasMapeo_SectorID'
    ) BEGIN CREATE INDEX [IX_VentanasMapeo_SectorID] ON [mapeo].[VentanasMapeo] ([SectorGeotecnicoID]);
PRINT '✓ Creado índice IX_VentanasMapeo_SectorID';
END
GO -- Índice por FamiliaID en EstructurasGeologicas
    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'IX_EstructurasGeo_FamiliaID'
    ) BEGIN CREATE INDEX [IX_EstructurasGeo_FamiliaID] ON [mapeo].[EstructurasGeologicas] ([FamiliaID]);
PRINT '✓ Creado índice IX_EstructurasGeo_FamiliaID';
END
GO PRINT '===== MIGRACIÓN GEMA COMPLETADA =====';
GO