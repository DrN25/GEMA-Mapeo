-- Ejecutar en la copia local, con la base seleccionada en SSMS o sqlcmd -d.
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'db_ad0a4f_gema'
    THROW 51000, 'Seleccione la copia local db_ad0a4f_gema.', 1;
IF OBJECT_ID(N'auth.Usuarios', N'U') IS NULL OR OBJECT_ID(N'auth.Roles', N'U') IS NULL
    THROW 51001, 'Faltan las tablas de autenticacion esperadas.', 1;
IF OBJECT_ID(N'auth.Sistemas', N'U') IS NOT NULL
    THROW 51002, 'La migracion ya se aplico o hay que revisar el esquema.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    -- La clasificacion fue revisada para estas cinco cuentas.
    IF EXISTS (
        SELECT UsuarioID, Usuario FROM auth.Usuarios
        EXCEPT SELECT * FROM (VALUES
            (1, N'ADMIN'), (2, N'TEST'), (3, N'TEST_002'),
            (4, N'TEST_001'), (5, N'TEST_003')
        ) AS esperados(UsuarioID, Usuario)
    ) OR (SELECT COUNT(*) FROM auth.Usuarios) <> 5
        THROW 51003, 'El inventario de cuentas cambio. Revise su pertenencia antes de migrar.', 1;

    IF NOT EXISTS (
        SELECT 1 FROM auth.Usuarios u JOIN auth.Roles r ON r.RolID = u.RolID
        WHERE u.UsuarioID = 1 AND u.Estado = 'A' AND r.Nombre = N'admin' AND r.Estado = 'A'
    )
        THROW 51004, 'No se encontro la cuenta ADMIN activa con su rol esperado.', 1;

    DECLARE @emailUnique sysname, @roleUnique sysname;
    SELECT @emailUnique = kc.name FROM sys.key_constraints kc
    JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id
        AND ic.index_id = kc.unique_index_id AND ic.key_ordinal = 1
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE kc.parent_object_id = OBJECT_ID(N'auth.Usuarios') AND kc.type = 'UQ'
        AND c.name = N'Email'
        AND NOT EXISTS (SELECT 1 FROM sys.index_columns x WHERE x.object_id = ic.object_id
            AND x.index_id = ic.index_id AND x.key_ordinal > 1);
    SELECT @roleUnique = kc.name FROM sys.key_constraints kc
    JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id
        AND ic.index_id = kc.unique_index_id AND ic.key_ordinal = 1
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE kc.parent_object_id = OBJECT_ID(N'auth.Roles') AND kc.type = 'UQ'
        AND c.name = N'Nombre'
        AND NOT EXISTS (SELECT 1 FROM sys.index_columns x WHERE x.object_id = ic.object_id
            AND x.index_id = ic.index_id AND x.key_ordinal > 1);
    IF @emailUnique IS NULL OR @roleUnique IS NULL
        THROW 51005, 'Revise los constraints unicos de Email y Nombre antes de migrar.', 1;

    CREATE TABLE auth.Sistemas (
        SistemaID int IDENTITY PRIMARY KEY,
        Codigo nvarchar(50) NOT NULL UNIQUE,
        Nombre nvarchar(100) NOT NULL,
        Estado char(1) NOT NULL DEFAULT 'A'
    );
    INSERT auth.Sistemas(Codigo, Nombre)
    VALUES (N'mapeo', N'GEMA-Mapeo'), (N'logueo', N'GEMA-Logueo');

    ALTER TABLE auth.Roles ADD SistemaID int NULL,
        EsProtegido bit NOT NULL CONSTRAINT DF_AuthRoles_Protegido DEFAULT 0;
    ALTER TABLE auth.Usuarios ADD SistemaID int NULL,
        EsProtegido bit NOT NULL CONSTRAINT DF_AuthUsuarios_Protegido DEFAULT 0,
        VersionSeguridad int NOT NULL CONSTRAINT DF_AuthUsuarios_Version DEFAULT 0;

    EXEC sys.sp_executesql N'
        DECLARE @mapeo int = (SELECT SistemaID FROM auth.Sistemas WHERE Codigo = N''mapeo'');
        UPDATE auth.Roles SET SistemaID = @mapeo, EsProtegido = CASE WHEN Nombre = N''admin'' THEN 1 ELSE 0 END;
        UPDATE auth.Usuarios SET SistemaID = @mapeo, EsProtegido = CASE WHEN UsuarioID = 1 THEN 1 ELSE 0 END;
        ALTER TABLE auth.Roles ALTER COLUMN SistemaID int NOT NULL;
        ALTER TABLE auth.Usuarios ALTER COLUMN SistemaID int NOT NULL;
        ALTER TABLE auth.Roles ADD CONSTRAINT FK_AuthRoles_Sistemas FOREIGN KEY (SistemaID) REFERENCES auth.Sistemas(SistemaID);
        ALTER TABLE auth.Roles ADD CONSTRAINT UQ_AuthRoles_SistemaRol UNIQUE (SistemaID, RolID);
        ALTER TABLE auth.Roles ADD CONSTRAINT UQ_AuthRoles_SistemaNombre UNIQUE (SistemaID, Nombre);
        ALTER TABLE auth.Usuarios ADD CONSTRAINT UQ_AuthUsuarios_SistemaEmail UNIQUE (SistemaID, Email);
        ALTER TABLE auth.Usuarios ADD CONSTRAINT FK_AuthUsuarios_SistemaRol
            FOREIGN KEY (SistemaID, RolID) REFERENCES auth.Roles(SistemaID, RolID);
    ';
    DECLARE @ddl nvarchar(max) = N'ALTER TABLE auth.Usuarios DROP CONSTRAINT ' + QUOTENAME(@emailUnique);
    EXEC sys.sp_executesql @ddl;
    SET @ddl = N'ALTER TABLE auth.Roles DROP CONSTRAINT ' + QUOTENAME(@roleUnique);
    EXEC sys.sp_executesql @ddl;

    EXEC sys.sp_executesql N'
        CREATE TABLE auth.Permisos (
            PermisoID int IDENTITY PRIMARY KEY,
            SistemaID int NOT NULL REFERENCES auth.Sistemas(SistemaID),
            Codigo nvarchar(100) NOT NULL,
            Nombre nvarchar(100) NOT NULL,
            Modulo nvarchar(80) NOT NULL,
            Descripcion nvarchar(200) NULL,
            Estado char(1) NOT NULL DEFAULT ''A'',
            CONSTRAINT UQ_AuthPermisos_SistemaCodigo UNIQUE (SistemaID, Codigo),
            CONSTRAINT UQ_AuthPermisos_SistemaPermiso UNIQUE (SistemaID, PermisoID)
        );
        CREATE TABLE auth.RolPermisos (
            SistemaID int NOT NULL,
            RolID int NOT NULL,
            PermisoID int NOT NULL,
            FechaRegistro datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
            UsuarioRegistro nvarchar(100) NULL,
            CONSTRAINT PK_AuthRolPermisos PRIMARY KEY (SistemaID, RolID, PermisoID),
            CONSTRAINT FK_AuthRolPermisos_Rol FOREIGN KEY (SistemaID, RolID)
                REFERENCES auth.Roles(SistemaID, RolID),
            CONSTRAINT FK_AuthRolPermisos_Permiso FOREIGN KEY (SistemaID, PermisoID)
                REFERENCES auth.Permisos(SistemaID, PermisoID)
        );
    ';
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
