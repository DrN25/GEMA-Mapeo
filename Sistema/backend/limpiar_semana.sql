/* Eliminar celdas y estructuras de la ULTIMA SEMANA (7 dias) */
USE [GEMA];
GO

DECLARE @semana DATE = DATEADD(DAY, -6, CAST(GETDATE() AS DATE));

SELECT COUNT(*) as Ventanas_A_Borrar FROM mapeo.VentanasMapeo
WHERE CAST(FechaRegistro AS DATE) >= @semana;

SELECT COUNT(*) as Estructuras_A_Borrar FROM mapeo.EstructurasGeologicas eg
INNER JOIN mapeo.VentanasMapeo vm ON eg.VentanaID = vm.VentanaID
WHERE CAST(vm.FechaRegistro AS DATE) >= @semana;
GO

DELETE FROM mapeo.VentanasMapeo
WHERE CAST(FechaRegistro AS DATE) >= DATEADD(DAY, -6, CAST(GETDATE() AS DATE));
GO

PRINT 'Eliminacion completada (ultimos 7 dias)';
GO