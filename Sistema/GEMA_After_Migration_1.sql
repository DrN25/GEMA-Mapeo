USE [GEMA]
GO
    /****** Objeto: Table [mapeo].[VentanasMapeo] Fecha de script: 22/07/2026 15:01:05 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO CREATE TABLE [mapeo].[VentanasMapeo](
        [VentanaID] [int] IDENTITY(1, 1) NOT NULL,
        [CodigoCelda] [nvarchar](20) NOT NULL,
        [CampañaID] [int] NOT NULL,
        [SectorGeotecnicoID] [int] NOT NULL,
        [FechaMapeo] [date] NULL,
        [Nivel] [nvarchar](50) NULL,
        [EsteFrom] [decimal](12, 3) NOT NULL,
        [NorteFrom] [decimal](12, 3) NOT NULL,
        [CotaFrom] [decimal](8, 3) NOT NULL,
        [EsteTo] [decimal](12, 3) NOT NULL,
        [NorteTo] [decimal](12, 3) NOT NULL,
        [CotaTo] [decimal](8, 3) NOT NULL,
        [DistanciaCelda] [decimal](8, 3) NULL,
        [Altura] [decimal](8, 3) NULL,
        [DIP] [decimal](5, 2) NULL,
        [AzimutHole] [decimal](6, 2) NULL,
        [DipTalud] [decimal](5, 2) NULL,
        [DipDirTalud] [decimal](6, 2) NULL,
        [Litologia1ID] [int] NULL,
        [Litologia2ID] [int] NULL,
        [Litologia3ID] [int] NULL,
        [UnidadLitologicaID] [int] NULL,
        [GradoIntemperismo] [nvarchar](10) NULL,
        [CondicionAguaRMR76] [nvarchar](50) NULL,
        [CondicionAguaValorRMR76] [decimal](5, 2) NULL,
        [DurezaRMR76] [nvarchar](10) NULL,
        [ResistenciaEstimadaValorRMR76] [decimal](5, 2) NULL,
        [GSI_VisualRMR76] [decimal](5, 2) NULL,
        [ControlEstructuralRMR76] [nvarchar](50) NULL,
        [EfectosVoladuraRMR76] [nvarchar](50) NULL,
        [RQD_ValorRMR76] [decimal](5, 2) NULL,
        [RQD_RMR76] [decimal](5, 2) NULL,
        [FrecuenciaFracturamientoRMR76] [decimal](8, 3) NULL,
        [TamañoBloquesRMR76] [decimal](8, 3) NULL,
        [EspaciamientoPromedioRMR76] [decimal](8, 3) NULL,
        [EspaciamientoValorRMR76] [decimal](5, 2) NULL,
        [CondicionDiscontinuidadValorRMR76] [decimal](5, 2) NULL,
        [RMR76_Total] [decimal](5, 2) NULL,
        [CondicionAguaRMR89] [nvarchar](50) NULL,
        [CondicionAguaValorRMR89] [decimal](5, 2) NULL,
        [DurezaRMR89] [nvarchar](10) NULL,
        [ResistenciaEstimadaValorRMR89] [decimal](5, 2) NULL,
        [GSI_VisualRMR89] [decimal](5, 2) NULL,
        [ControlEstructuralRMR89] [nvarchar](50) NULL,
        [EfectosVoladuraRMR89] [nvarchar](50) NULL,
        [RQD_ValorRMR89] [decimal](5, 2) NULL,
        [RQD_RMR89] [decimal](5, 2) NULL,
        [FrecuenciaFracturamientoRMR89] [decimal](8, 3) NULL,
        [TamañoBloquesRMR89] [decimal](8, 3) NULL,
        [EspaciamientoPromedioRMR89] [decimal](8, 3) NULL,
        [EspaciamientoValorRMR89] [decimal](5, 2) NULL,
        [CondicionDiscontinuidadValorRMR89] [decimal](5, 2) NULL,
        [RMR89_Total] [decimal](5, 2) NULL,
        [UCS_MPa] [decimal](8, 3) NULL,
        [IS50_MPa] [decimal](8, 3) NULL,
        [GeotecnicoID] [int] NULL,
        [Comentarios] [nvarchar](max) NULL,
        [FechaRegistro] [datetime] NOT NULL,
        [UsuarioRegistro] [nvarchar](100) NULL,
        [FechaModificacion] [datetime] NULL,
        [UsuarioModificacion] [nvarchar](100) NULL,
        [AlturaZona] [nvarchar](20) NULL,
        [Fase] [int] NULL,
        [Turno] [nvarchar](20) NULL,
        [GSISuperficie] [nvarchar](20) NULL,
        [GSIEstructura] [nvarchar](20) NULL,
        PRIMARY KEY CLUSTERED ([VentanaID] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY]
    ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
ALTER TABLE [mapeo].[VentanasMapeo]
ADD DEFAULT (getdate()) FOR [FechaRegistro]
GO
ALTER TABLE [mapeo].[VentanasMapeo] WITH NOCHECK
ADD CONSTRAINT [FK_VentanasMapeo_Campanas] FOREIGN KEY([CampañaID]) REFERENCES [dbo].[Campañas] ([CampañaID])
GO
ALTER TABLE [mapeo].[VentanasMapeo] NOCHECK CONSTRAINT [FK_VentanasMapeo_Campanas]
GO
ALTER TABLE [mapeo].[VentanasMapeo] WITH NOCHECK
ADD CONSTRAINT [FK_VentanasMapeo_Campañas] FOREIGN KEY([CampañaID]) REFERENCES [dbo].[Campañas] ([CampañaID])
GO
ALTER TABLE [mapeo].[VentanasMapeo] NOCHECK CONSTRAINT [FK_VentanasMapeo_Campañas]
GO
ALTER TABLE [mapeo].[VentanasMapeo] WITH NOCHECK
ADD CONSTRAINT [FK_VentanasMapeo_Geotecnico] FOREIGN KEY([GeotecnicoID]) REFERENCES [dbo].[Geotecnicos] ([GeotecnicoID])
GO
ALTER TABLE [mapeo].[VentanasMapeo] NOCHECK CONSTRAINT [FK_VentanasMapeo_Geotecnico]
GO
ALTER TABLE [mapeo].[VentanasMapeo] WITH NOCHECK
ADD CONSTRAINT [FK_VentanasMapeo_Geotecnicos] FOREIGN KEY([GeotecnicoID]) REFERENCES [dbo].[Geotecnicos] ([GeotecnicoID])
GO
ALTER TABLE [mapeo].[VentanasMapeo] NOCHECK CONSTRAINT [FK_VentanasMapeo_Geotecnicos]
GO
ALTER TABLE [mapeo].[VentanasMapeo] WITH NOCHECK
ADD CONSTRAINT [FK_VentanasMapeo_Litologia1] FOREIGN KEY([Litologia1ID]) REFERENCES [dbo].[Litologias] ([LitologiaID])
GO
ALTER TABLE [mapeo].[VentanasMapeo] NOCHECK CONSTRAINT [FK_VentanasMapeo_Litologia1]
GO
ALTER TABLE [mapeo].[VentanasMapeo] WITH NOCHECK
ADD CONSTRAINT [FK_VentanasMapeo_Litologia2] FOREIGN KEY([Litologia2ID]) REFERENCES [dbo].[Litologias] ([LitologiaID])
GO
ALTER TABLE [mapeo].[VentanasMapeo] NOCHECK CONSTRAINT [FK_VentanasMapeo_Litologia2]
GO
ALTER TABLE [mapeo].[VentanasMapeo] WITH NOCHECK
ADD CONSTRAINT [FK_VentanasMapeo_Litologia3] FOREIGN KEY([Litologia3ID]) REFERENCES [dbo].[Litologias] ([LitologiaID])
GO
ALTER TABLE [mapeo].[VentanasMapeo] NOCHECK CONSTRAINT [FK_VentanasMapeo_Litologia3]
GO
ALTER TABLE [mapeo].[VentanasMapeo] WITH NOCHECK
ADD CONSTRAINT [FK_VentanasMapeo_Litologias] FOREIGN KEY([Litologia1ID]) REFERENCES [dbo].[Litologias] ([LitologiaID])
GO
ALTER TABLE [mapeo].[VentanasMapeo] NOCHECK CONSTRAINT [FK_VentanasMapeo_Litologias]
GO
ALTER TABLE [mapeo].[VentanasMapeo] WITH NOCHECK
ADD CONSTRAINT [FK_VentanasMapeo_Sectores] FOREIGN KEY([SectorGeotecnicoID]) REFERENCES [mapeo].[SectoresGeotecnicos] ([SectorGeotecnicoID])
GO
ALTER TABLE [mapeo].[VentanasMapeo] NOCHECK CONSTRAINT [FK_VentanasMapeo_Sectores]
GO
ALTER TABLE [mapeo].[VentanasMapeo] WITH NOCHECK
ADD CONSTRAINT [FK_VentanasMapeo_SectoresGeo] FOREIGN KEY([SectorGeotecnicoID]) REFERENCES [mapeo].[SectoresGeotecnicos] ([SectorGeotecnicoID])
GO
ALTER TABLE [mapeo].[VentanasMapeo] NOCHECK CONSTRAINT [FK_VentanasMapeo_SectoresGeo]
GO
ALTER TABLE [mapeo].[VentanasMapeo] WITH NOCHECK
ADD CONSTRAINT [FK_VentanasMapeo_UnidadLito] FOREIGN KEY([UnidadLitologicaID]) REFERENCES [dbo].[UnidadesLitologicas] ([UnidadLitologicaID])
GO
ALTER TABLE [mapeo].[VentanasMapeo] NOCHECK CONSTRAINT [FK_VentanasMapeo_UnidadLito]
GO USE [GEMA]
GO
    /****** Objeto: Table [mapeo].[EstructurasGeologicas] Fecha de script: 22/07/2026 15:04:06 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO CREATE TABLE [mapeo].[EstructurasGeologicas](
        [EstructuraID] [int] IDENTITY(1, 1) NOT NULL,
        [VentanaID] [int] NOT NULL,
        [NumeroEstructura] [int] NOT NULL,
        [TipoEstructuraID] [int] NOT NULL,
        [Dip] [decimal](5, 2) NOT NULL,
        [DipDir] [decimal](6, 2) NOT NULL,
        [DistanciaEstructura] [decimal](8, 3) NULL,
        [Teta] [decimal](6, 2) NULL,
        [Alfa] [decimal](6, 2) NULL,
        [X] [decimal](12, 3) NULL,
        [Y] [decimal](12, 3) NULL,
        [Z] [decimal](12, 3) NULL,
        [Abertura_mm] [decimal](8, 3) NULL,
        [Espesor_mm] [decimal](8, 3) NULL,
        [Continuidad_m] [decimal](8, 3) NULL,
        [Espaciamiento_m] [decimal](8, 3) NULL,
        [NumeroExtremosVisibles] [int] NULL,
        [TipoRelleno1] [nvarchar](50) NULL,
        [TipoRelleno2] [nvarchar](50) NULL,
        [JRC] [decimal](4, 2) NULL,
        [RugosidadEstructura] [nvarchar](50) NULL,
        [FormaEstructura] [nvarchar](50) NULL,
        [Alteracion] [nvarchar](50) NULL,
        [FechaRegistro] [datetime] NOT NULL,
        [NumeroEstructuras] [int] NULL,
        [FamiliaID] [int] NULL,
        [ValorAlteracionCD76] [decimal](5, 2) NULL,
        [ValorRellenoCD76] [decimal](5, 2) NULL,
        [ContinuidadCD76] [decimal](5, 2) NULL,
        [AberturaCD76] [decimal](5, 2) NULL,
        [RugosidadCD76] [decimal](5, 2) NULL,
        [ValorCondicionCD76] [decimal](5, 2) NULL,
        [ValorAlteracionCD89] [decimal](5, 2) NULL,
        [ValorRellenoCD89] [decimal](5, 2) NULL,
        [ContinuidadCD89] [decimal](5, 2) NULL,
        [AberturaCD89] [decimal](5, 2) NULL,
        [RugosidadCD89] [decimal](5, 2) NULL,
        [ValorCondicionCD89] [decimal](5, 2) NULL,
        [UsuarioRegistro] [nvarchar](100) NULL,
        [FechaModificacion] [datetime] NULL,
        [UsuarioModificacion] [nvarchar](100) NULL,
        [Terminacion] [int] NULL,
        PRIMARY KEY CLUSTERED ([EstructuraID] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY],
        CONSTRAINT [UQ_EstructurasGeo_VentanaNumero] UNIQUE NONCLUSTERED ([VentanaID] ASC, [NumeroEstructura] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY]
    ) ON [PRIMARY]
GO
ALTER TABLE [mapeo].[EstructurasGeologicas]
ADD DEFAULT (getdate()) FOR [FechaRegistro]
GO
ALTER TABLE [mapeo].[EstructurasGeologicas] WITH NOCHECK
ADD CONSTRAINT [FK_EstructurasGeo_TipoEstructura] FOREIGN KEY([TipoEstructuraID]) REFERENCES [dbo].[TiposEstructura] ([TipoEstructuraID])
GO
ALTER TABLE [mapeo].[EstructurasGeologicas] NOCHECK CONSTRAINT [FK_EstructurasGeo_TipoEstructura]
GO
ALTER TABLE [mapeo].[EstructurasGeologicas] WITH NOCHECK
ADD CONSTRAINT [FK_EstructurasGeo_Ventana] FOREIGN KEY([VentanaID]) REFERENCES [mapeo].[VentanasMapeo] ([VentanaID]) ON DELETE CASCADE
GO
ALTER TABLE [mapeo].[EstructurasGeologicas] NOCHECK CONSTRAINT [FK_EstructurasGeo_Ventana]
GO
ALTER TABLE [mapeo].[EstructurasGeologicas] WITH NOCHECK
ADD CONSTRAINT [FK_EstructurasGeologicas_TiposEstructura] FOREIGN KEY([TipoEstructuraID]) REFERENCES [dbo].[TiposEstructura] ([TipoEstructuraID])
GO
ALTER TABLE [mapeo].[EstructurasGeologicas] NOCHECK CONSTRAINT [FK_EstructurasGeologicas_TiposEstructura]
GO
ALTER TABLE [mapeo].[EstructurasGeologicas] WITH NOCHECK
ADD CONSTRAINT [FK_EstructurasGeologicas_Ventanas] FOREIGN KEY([VentanaID]) REFERENCES [mapeo].[VentanasMapeo] ([VentanaID])
GO
ALTER TABLE [mapeo].[EstructurasGeologicas] NOCHECK CONSTRAINT [FK_EstructurasGeologicas_Ventanas]
GO USE [GEMA]
GO
    /****** Objeto: Table [mapeo].[SectoresGeotecnicos] Fecha de script: 19/07/2026 17:20:00 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO CREATE TABLE [mapeo].[SectoresGeotecnicos](
        [SectorGeotecnicoID] [int] IDENTITY(1, 1) NOT NULL,
        [CodigoSector] [nvarchar](20) NOT NULL,
        [NombreSector] [nvarchar](100) NOT NULL,
        [Descripcion] [nvarchar](max) NULL,
        [Proyecto] [nvarchar](100) NULL,
        [Estado] [nvarchar](20) NOT NULL,
        [FechaRegistro] [datetime] NOT NULL,
        PRIMARY KEY CLUSTERED ([SectorGeotecnicoID] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY],
        UNIQUE NONCLUSTERED ([CodigoSector] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY]
    ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
ALTER TABLE [mapeo].[SectoresGeotecnicos]
ADD DEFAULT ('Activo') FOR [Estado]
GO
ALTER TABLE [mapeo].[SectoresGeotecnicos]
ADD DEFAULT (getdate()) FOR [FechaRegistro]
GO USE [GEMA]
GO
    /****** Objeto: Table [dbo].[Campañas] Fecha de script: 19/07/2026 17:26:34 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO CREATE TABLE [dbo].[Campañas](
        [CampañaID] [int] NOT NULL,
        [NombreCampaña] [nvarchar](100) NOT NULL,
        [FechaInicio] [date] NULL,
        [FechaFin] [date] NULL,
        [Descripcion] [nvarchar](500) NULL,
        [Estado] [nvarchar](20) NOT NULL,
        [FechaRegistro] [datetime] NOT NULL,
        PRIMARY KEY CLUSTERED ([CampañaID] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY],
        UNIQUE NONCLUSTERED ([NombreCampaña] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY]
    ) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Campañas]
ADD DEFAULT ('Activa') FOR [Estado]
GO
ALTER TABLE [dbo].[Campañas]
ADD DEFAULT (getdate()) FOR [FechaRegistro]
GO
ALTER TABLE [dbo].[Campañas] WITH NOCHECK
ADD CONSTRAINT [CHK_Campañas_Estado] CHECK (
        (
            [Estado] = 'Suspendida'
            OR [Estado] = 'Finalizada'
            OR [Estado] = 'Activa'
        )
    )
GO
ALTER TABLE [dbo].[Campañas] NOCHECK CONSTRAINT [CHK_Campañas_Estado]
GO
ALTER TABLE [dbo].[Campañas] WITH NOCHECK
ADD CONSTRAINT [CHK_Campañas_Fechas] CHECK (
        (
            [FechaFin] IS NULL
            OR [FechaFin] >= [FechaInicio]
        )
    )
GO
ALTER TABLE [dbo].[Campañas] NOCHECK CONSTRAINT [CHK_Campañas_Fechas]
GO USE [GEMA]
GO
    /****** Objeto: Table [dbo].[Geotecnicos] Fecha de script: 19/07/2026 17:27:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO CREATE TABLE [dbo].[Geotecnicos](
        [GeotecnicoID] [int] IDENTITY(1, 1) NOT NULL,
        [NombreCompleto] [nvarchar](150) NOT NULL,
        [Especialidad] [nvarchar](100) NULL,
        [Email] [nvarchar](100) NULL,
        [Telefono] [nvarchar](20) NULL,
        [Estado] [nvarchar](20) NOT NULL,
        [FechaRegistro] [datetime] NOT NULL,
        PRIMARY KEY CLUSTERED ([GeotecnicoID] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY]
    ) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Geotecnicos]
ADD DEFAULT ('Activo') FOR [Estado]
GO
ALTER TABLE [dbo].[Geotecnicos]
ADD DEFAULT (getdate()) FOR [FechaRegistro]
GO
ALTER TABLE [dbo].[Geotecnicos] WITH NOCHECK
ADD CONSTRAINT [CHK_Geotecnicos_Estado] CHECK (
        (
            [Estado] = 'Inactivo'
            OR [Estado] = 'Activo'
        )
    )
GO
ALTER TABLE [dbo].[Geotecnicos] NOCHECK CONSTRAINT [CHK_Geotecnicos_Estado]
GO USE [GEMA]
GO
    /****** Objeto: Table [dbo].[Litologias] Fecha de script: 19/07/2026 17:28:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO CREATE TABLE [dbo].[Litologias](
        [LitologiaID] [int] IDENTITY(1, 1) NOT NULL,
        [CodigoLitologia] [nvarchar](20) NOT NULL,
        [NombreLitologia] [nvarchar](100) NOT NULL,
        [Descripcion] [nvarchar](500) NULL,
        [TipoRoca] [nvarchar](50) NULL,
        [FechaRegistro] [datetime] NOT NULL,
        PRIMARY KEY CLUSTERED ([LitologiaID] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY]
    ) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Litologias]
ADD DEFAULT (getdate()) FOR [FechaRegistro]
GO USE [GEMA]
GO
    /****** Objeto: Table [dbo].[UnidadesLitologicas] Fecha de script: 19/07/2026 17:29:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO CREATE TABLE [dbo].[UnidadesLitologicas](
        [UnidadLitologicaID] [int] IDENTITY(1, 1) NOT NULL,
        [CodigoUnidad] [nvarchar](20) NOT NULL,
        [NombreUnidad] [nvarchar](100) NOT NULL,
        [Descripcion] [nvarchar](max) NULL,
        [TipoRoca] [nvarchar](50) NULL,
        [Estado] [nvarchar](20) NOT NULL,
        [FechaRegistro] [datetime] NOT NULL,
        PRIMARY KEY CLUSTERED ([UnidadLitologicaID] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY],
        UNIQUE NONCLUSTERED ([CodigoUnidad] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY]
    ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
ALTER TABLE [dbo].[UnidadesLitologicas]
ADD DEFAULT ('Activo') FOR [Estado]
GO
ALTER TABLE [dbo].[UnidadesLitologicas]
ADD DEFAULT (getdate()) FOR [FechaRegistro]
GO USE [GEMA]
GO
    /****** Objeto: Table [dbo].[TiposEstructura] Fecha de script: 19/07/2026 17:31:09 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO CREATE TABLE [dbo].[TiposEstructura](
        [TipoEstructuraID] [int] IDENTITY(1, 1) NOT NULL,
        [CodigoEstructura] [nvarchar](20) NOT NULL,
        [NombreEstructura] [nvarchar](100) NOT NULL,
        [Descripcion] [nvarchar](500) NULL,
        [FechaRegistro] [datetime] NOT NULL,
        PRIMARY KEY CLUSTERED ([TipoEstructuraID] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY],
        UNIQUE NONCLUSTERED ([CodigoEstructura] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
        ) ON [PRIMARY]
    ) ON [PRIMARY]
GO
ALTER TABLE [dbo].[TiposEstructura]
ADD DEFAULT (getdate()) FOR [FechaRegistro]
GO