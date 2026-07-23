-- ============================================================================
-- SCRIPT DE LIMPIEZA DE TABLAS DE MAPEO GEOMECÁNICO (GEMA SQL SERVER)
-- ============================================================================
-- Este script elimina de forma limpia todos los registros de las tablas:
-- 1. mapeo.EstructurasGeologicas (tabla hija con FK a VentanasMapeo)
-- 2. mapeo.VentanasMapeo (tabla padre)
-- Y reajusta los contadores IDENTITY a 0.
-- ============================================================================

BEGIN TRANSACTION;

-- 1. Eliminar estructuras geológicas de discontinuidades
DELETE FROM mapeo.EstructurasGeologicas;

-- 2. Eliminar cabeceras de ventanas de mapeo
DELETE FROM mapeo.VentanasMapeo;

-- 3. Resetear contadores de identidad (IDENTITY)
DBCC CHECKIDENT ('mapeo.EstructurasGeologicas', RESEED, 0);
DBCC CHECKIDENT ('mapeo.VentanasMapeo', RESEED, 0);

COMMIT TRANSACTION;

PRINT 'Limpieza de mapeo.EstructurasGeologicas y mapeo.VentanasMapeo ejecutada con éxito.';
