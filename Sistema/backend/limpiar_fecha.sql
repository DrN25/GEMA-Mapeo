/* Eliminar celdas con FechaMapeo = 2026-07-19 */
USE [GEMA];
GO

SELECT COUNT(*) as Ventanas_A_Borrar FROM mapeo.VentanasMapeo
WHERE FechaMapeo = '2026-07-19';

SELECT COUNT(*) as Estructuras_A_Borrar FROM mapeo.EstructurasGeologicas eg
INNER JOIN mapeo.VentanasMapeo vm ON eg.VentanaID = vm.VentanaID
WHERE vm.FechaMapeo = '2026-07-19';
GO

DELETE FROM mapeo.VentanasMapeo
WHERE FechaMapeo = '2026-07-19';
GO

PRINT 'Eliminacion completada';
GO