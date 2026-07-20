/* ========================================================================
   Crear catalogos faltantes en GEMA (solo litologias)
   ======================================================================== */
USE [GEMA];
GO

/* ----------------------------------------------------------------------
   ANALISIS DE CADA CODIGO:

   AN     -> Lito1 generico. Usuario dice "es sinonimo de vacio".
             Sin TipoRoca definido. -> No definido
   INTRUSIVO -> Lito1 generico para Endoskarn. -> Igneo (usuario confirmo)
   LAM    -> Lito3 de AN/LAM, grupo INTRUSIVOS segun catalogo. -> Igneo
   LMT_U  -> Variante Urcuhuaraca de LMT, grupo SEDIMENTARIOS. -> Sedimentaria
   MBX / VARIOS -> Brecha ignea. Grupo BRECHAS. -> Brecha
   QZT    -> Cuarcita, grupo METAMORFICAS. -> Metamorfica
   SND    -> Arenisca, grupo SEDIMENTARIOS (full catalog). -> Sedimentaria
   ---------------------------------------------------------------------- */

SET IDENTITY_INSERT dbo.Litologias OFF;
GO

-- AN (codigo generico - sinonimo de vacio segun usuario)
IF NOT EXISTS (SELECT 1 FROM dbo.Litologias WHERE CodigoLitologia = 'AN')
BEGIN
    INSERT INTO dbo.Litologias (CodigoLitologia, NombreLitologia, Descripcion, TipoRoca)
    VALUES ('AN', '', '', 'No definido');
    PRINT 'Creada: AN (No definido)';
END
GO

-- INTRUSIVO
IF NOT EXISTS (SELECT 1 FROM dbo.Litologias WHERE CodigoLitologia = 'INTRUSIVO')
BEGIN
    INSERT INTO dbo.Litologias (CodigoLitologia, NombreLitologia, Descripcion, TipoRoca)
    VALUES ('INTRUSIVO', '', '', 'Igneo');
    PRINT 'Creada: INTRUSIVO (Igneo)';
END
GO

-- LAM
IF NOT EXISTS (SELECT 1 FROM dbo.Litologias WHERE CodigoLitologia = 'LAM')
BEGIN
    INSERT INTO dbo.Litologias (CodigoLitologia, NombreLitologia, Descripcion, TipoRoca)
    VALUES ('LAM', '', '', 'Igneo');
    PRINT 'Creada: LAM (Igneo)';
END
GO

-- LMT_U
IF NOT EXISTS (SELECT 1 FROM dbo.Litologias WHERE CodigoLitologia = 'LMT_U')
BEGIN
    INSERT INTO dbo.Litologias (CodigoLitologia, NombreLitologia, Descripcion, TipoRoca)
    VALUES ('LMT_U', '', '', 'Sedimentaria');
    PRINT 'Creada: LMT_U (Sedimentaria)';
END
GO

-- MBX / VARIOS
IF NOT EXISTS (SELECT 1 FROM dbo.Litologias WHERE CodigoLitologia = 'MBX / VARIOS')
BEGIN
    INSERT INTO dbo.Litologias (CodigoLitologia, NombreLitologia, Descripcion, TipoRoca)
    VALUES ('MBX / VARIOS', '', '', 'Brecha');
    PRINT 'Creada: MBX / VARIOS (Brecha)';
END
GO

-- QZT
IF NOT EXISTS (SELECT 1 FROM dbo.Litologias WHERE CodigoLitologia = 'QZT')
BEGIN
    INSERT INTO dbo.Litologias (CodigoLitologia, NombreLitologia, Descripcion, TipoRoca)
    VALUES ('QZT', '', '', 'Metamorfica');
    PRINT 'Creada: QZT (Metamorfica)';
END
GO

-- SND
IF NOT EXISTS (SELECT 1 FROM dbo.Litologias WHERE CodigoLitologia = 'SND')
BEGIN
    INSERT INTO dbo.Litologias (CodigoLitologia, NombreLitologia, Descripcion, TipoRoca)
    VALUES ('SND', '', '', 'Sedimentaria');
    PRINT 'Creada: SND (Sedimentaria)';
END
GO

PRINT 'COMPLETADO - 7 litologias creadas';

SELECT COUNT(*) as Total_Litologias FROM dbo.Litologias;
GO