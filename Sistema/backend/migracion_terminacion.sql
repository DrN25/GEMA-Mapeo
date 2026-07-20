/* Script mínimo para agregar SOLO la columna Terminacion que falló en la primera ejecución */
USE [GEMA];
GO

IF COL_LENGTH('mapeo.EstructurasGeologicas', 'Terminacion') IS NULL
BEGIN
    ALTER TABLE [mapeo].[EstructurasGeologicas]
    ADD [Terminacion] [int] NULL;
    PRINT '✓ Agregada columna Terminacion a mapeo.EstructurasGeologicas';
END
ELSE
BEGIN
    PRINT 'ℹ La columna Terminacion ya existe';
END
GO