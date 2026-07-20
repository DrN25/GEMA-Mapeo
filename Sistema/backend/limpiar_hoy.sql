/* Eliminar celdas y estructuras creadas HOY y AYER */
USE [GEMA];
GO

DECLARE @dos_dias DATE = DATEADD(DAY, -1, CAST(GETDATE() AS DATE));

-- Ver cuantas se borrarian
SELECT COUNT(*) as Ventanas_A_Borrar FROM mapeo.VentanasMapeo
WHERE CAST(FechaRegistro AS DATE) >= @dos_dias;

SELECT COUNT(*) as Estructuras_A_Borrar FROM mapeo.EstructurasGeologicas eg
INNER JOIN mapeo.VentanasMapeo vm ON eg.VentanaID = vm.VentanaID
WHERE CAST(vm.FechaRegistro AS DATE) >= @dos_dias;
GO

-- Borrar (CASCADE elimina estructuras automaticamente)
DELETE FROM mapeo.VentanasMapeo
WHERE CAST(FechaRegistro AS DATE) >= DATEADD(DAY, -1, CAST(GETDATE() AS DATE));
GO

PRINT 'Eliminacion completada (hoy + ayer)';
GO