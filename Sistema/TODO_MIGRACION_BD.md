# Checklist de Migración a Nueva Base de Datos

> Objetivo: revisar y corregir la lógica del backend antes/durante la migración
> desde (SQLite local / SQL Server Express) hacia una base de datos profesional
> (candidata: PostgreSQL). Marcar con `[x]` cada item completado.

**Notas clave**:
- Marcar `[x]` cuando esté resuelto.
- Items marcados como `LÓGICA` sobreviven a la migración (deben corregirse en Python).
- Items marcados como `DIALECTO` son específicos del motor actual y desaparecen con la nueva BD.
- Items marcados como `SCHEMA` requieren cambios en `models.py` y `[N]` migración.

---

## 0. Reconocimiento del estado actual

- [ ] Confirmar qué BD está realmente en uso en producción (SQLite o SQL Server).
- [ ] Hacer dump completo de la BD actual (todas las tablas a CSV/SQL).
- [ ] Documentar cuántos registros hay por tabla en producción.
- [ ] Listar vistas/queries manuales que terceros hagan sobre `ventanas_final` (excel, BI, etc.).

---

## 1. IDs y claves primarias (`LÓGICA` + `SCHEMA`)

### 1.1 `ventanas_final.id` calculado a mano
- [ ] Reemplazar `db.execute(text("SELECT MAX(id) FROM ventanas_final")).scalar()` (en `app/routers/ventanas.py:92`) por un campo `IDENTITY` / `SERIAL` / `AUTOINCREMENT` real en el modelo.
- [ ] Cambiar `id = Column(Integer, primary_key=True, autoincrement=False)` en `models.py:90` a `autoincrement=True`.
- [ ] Verificar que el cálculo `next_id = (max_id or 0) + 1` ya no sea necesario y borrarlo del router.
- [ ] Validar atomicidad: dos `POST /api/ventanas` concurrentes ya no colisionan.

### 1.2 Sin FK entre `ventanas_final.celda` y `ventana.codigo`
- [ ] Declarar `celda` como FK hacia `ventana.codigo` en el nuevo modelo (o migrar a `ventana_id` como FK real).
- [ ] Agregar `ON DELETE CASCADE` para que borrar la ventana borre automáticamente su espejo.
- [ ] Sustituir el `DELETE FROM ventanas_final WHERE celda=...` manual por el cascade automático (simplificar `delete_ventana`).

### 1.3 `discontinuidad.ventana_id` y `ventana_rmr_input.ventana_id`
- [ ] Confirmar FK con `ON DELETE CASCADE` (actualmente solo hay `cascade="all, delete-orphan"` del lado ORM).
- [ ] Agregar FK explícita en SQL (`ForeignKey` ya está, pero validar tornados).

### 1.4 `ensayo_plt_irregular.id` autoincrement
- [ ] Confirmar `autoincrement=True` ya está (línea 173 models.py). Verificar comportamiento en la nueva BD.

---

## 2. `largo_m FetchedValue()` (`LÓGICA` + `SCHEMA`)

### 2.1 Eliminar `FetchedValue`
- [ ] En `models.py:19` cambiar `largo_m = Column(Float, FetchedValue(), nullable=True)` por `largo_m = Column(Float, nullable=True)`.
- [ ] Verificar que no exista trigger/view que compute `largo_m` en la BD.
- [ ] Verificar que `calculator.py:138-156` ya lo calcula siempre (cuando hay coordenadas) — mantener esa lógica.

### 2.2 Quitar el bypass condicional de guardado
- [ ] En `app/routers/ventanas.py:206-207` eliminar el bloque:
  ```python
  if "sqlite" in str(db.bind.url).lower():
      v.largo_m = data.largo_m
  ```
- [ ] En `app/routers/ventanas.py:238-239` eliminar el mismo bloque en la rama de creación.
- [ ] Siempre guardar `largo_m` calculado por el `calculator`, sin importar el dialecto.

### 2.3 Eliminar imports de `FetchedValue`
- [ ] Borrar `FetchedValue` del import en `models.py:1` si ya no se usa en ninguna otra columna.

---

## 3. Migraciones agresivas (`LÓGICA`)

### 3.1 `run.py` — bloque DROP COLUMN
- [ ] Eliminar o desactivar el bloque en `run.py:55-69` que itera `db_col_objects` y hace `ALTER TABLE ... DROP COLUMN` por cada columna "sobrante".
- [ ] Justificar y documentar el cambio como política de migración manual (Alembic en el futuro).

### 3.2 `run.py` — bloque ADD COLUMN
- [ ] Evaluar si mantener `ALTER TABLE ... ADD` (case 3.2 run.py:71-101). Si se usa Alembic, eliminar.
- [ ] Si se mantiene, sustituir la asignación hardcodeada de tipos (`"VARCHAR(1000)"`, `"FLOAT"`, `"INT"`) por tipos derivados del dialecto SQLAlchemy (`column.type.compile(dialect)`).

### 3.3 `run.py` — bloque ALTER COLUMN NULL
- [ ] Revisar el bloque `run.py:104-123` que reescribe columnas `NOT NULL` → `NULL` — evaluar si es necesario.
- [ ] Eliminar si se adopta Alembic como herramienta formal de migraciones.

### 3.4 `main.py` — migración inline
- [ ] Eliminar el bloque `main.py:15-28` (`ALTER TABLE ventana ADD turno ...` etc.) una vez que el schema nuevo esté en Alembic.
- [ ] Evitar que el endpoint principal haga DDL al iniciar — debe ser responsabilidad del deploy.

### 3.5 Adoptar Alembic (opcional pero recomendado)
- [ ] `pip install alembic` y `alembic init migrations` en backend.
- [ ] Generar `revision --autogenerate` que capture el schema actual.
- [ ] Documentar `alembic upgrade head` como paso del deploy.

---

## 4. `sync_to_ventanas_final` (`LÓGICA`)

### 4.1 Quitar el `MAX(id)+1`
- [ ] Eliminar `max_id = db.execute(text("SELECT MAX(id) FROM ventanas_final")).scalar()` y `next_id = (max_id or 0) + 1`.
- [ ] Eliminar `id=next_id` en la creación de cada `VentanasFinal` y `next_id += 1` al final del loop.
- [ ] El ID lo debe entregar la BD al insertar (autoincrement), ver item 1.1.

### 4.2 Transacción y atomicidad
- [ ] En `save_ventana` (ventanas.py:189-271), verificar que toda la transacción (cabecera + discontinuidades + rmr_input + sync_final) comitee atómicamente o haga rollback limpio ante cualquier error.
- [ ] Capturear excepciones conocidas con `try/except` y devolver HTTP 500 con mensaje claro, evitando medias-escrituras.

### 4.3 Defaults fragilizados en el sync
- [ ] Revisar cada default inyectado manualmente en `ventanas.py:97-130` y decidir si debe ser NULL en BD:
  - `tipo_relleno_1=row_norm["r1"] if ... else "cwf"` → ¿debe ser NULL?
  - `tipo_relleno_2=row_norm["r2"] if ... else "-1"` → ¿debe ser NULL?
  - `forma_estructura=row_norm["forma"] if ... else "P"` → ¿debe ser NULL?
  - `alteracion=row_norm["alt"] if ... else "f"` → ¿debe ser NULL?
  - `sector_geotecnico=v.sector_geotecnico if ... else "E1"` → ¿debe ser NULL?
  - `campania=v.campania if ... else 2026` → ¿debe ser NULL?
  - `mapeador ... "RD/RB"` ya no aparece; verificar.
- [ ] Para cada default elegido, documentar la razón (¿es "desconocido" o "valor real")?. Preferir NULL salvo que el dominio geomecánico exija un valor.

### 4.4 Cálculo de `dip` y `az_hole` desde `teta`/`alfa`
- [ ] Revisar `ventanas.py:101-102` — si el usuario no cargó `dip_hw`/`az_hw`, se calcula desde los ángulos. Evaluar si esto debe ser persistente o derivado en una view.

### 4.5 Llamada recursiva `save_ventana` dentro de `importar-excel`
- [ ] Confirmar que `importar_excel_endpoint` (ventanas.py:528) reutiliza `save_ventana` pasando el mismo `db` session — no crea una nueva sesión.
- [ ] Evaluar performance si se importan >100 ventanas (posible N+1 a `sync_to_ventanas_final`).

---

## 5. Replantear `ventanas_final` (`SCHEMA` + `LÓGICA`)

### 5.1 Decidir estrategia
- [ ] Opción A: **Mantener como tabla** y rellenar via trigger (pero requiere triggers en BD).
- [ ] Opción B (recomendada): **Convertir a view** (`CREATE VIEW ventanas_final AS ...`) que unga las otras 3 tablas.
- [ ] Opción C: **Tabla fina `ventana_resultado`** con columnas calculadas separadas por estándar (`estandar CHAR(2)` + `rqd_valor`, `rmr`, etc.).

### 5.2 Si se opta por View
- [ ] Escribir el SQL de la view (joins + agregaciones).
- [ ] Migrar todos los `db.query(models.VentanasFinal).filter_by(celda=...)` a queries sobre las tablas base.
- [ ] Eliminar el modelo SQLAlchemy `VentanasFinal` (o dejar como `__table_args__ = {'info': {'is_view': True}}`).
- [ ] Actualizar `exportar_ventana_excel` para que use las tablas normalizadas en lugar del aplanado.

### 5.3 Columna `struct_y` (typo)
- [ ] Renombrar `struct_y` a `estruct_y` para consistencia con `estruct_x` y `estruct_z` (en models.py:144 y ventanas.py:122).

### 5.4 Columna `efecto_voladura_89` (sin 's')
- [ ] Renombrar `efecto_voladura_89` → `efectos_voladura_89` para matchear `efectos_voladura_76` (models.py:128).

### 5.5 Columnas NOT NULL innecesarias
- [ ] Revisar `abertura_mm = Column(Float, nullable=False)` (ventanas_final) — si una estructura no tiene abertura registrada, ¿debe ser error? Cambiar a `nullable=True` y propagar NULL real.
- [ ] Igual para `espesor_mm`, `rugosidad_estructuras`, `forma_estructura`, `alteracion`, `tipo_relleno_1`, `tipo_relleno_2`, `sector_geotecnico`, `campania`.

### 5.6 Precisión numérica
- [ ] Homogeneizar tipos: `este_from/norte_from/cota_from` en `ventanas_final` están como `FLOAT` (precisión simple) pero en `ventana` son `Numeric(18,6)`. Estándarizar a `Numeric(18,6)` en la nueva BD.
- [ ] Igual para `dip`, `az_hole`, `dip_talud` (FLOAT vs Numeric).

---

## 6. Duplicados entre tablas (`SCHEMA`)

### 6.1 `alteracion` vs `intemperismo` vs `alteracion_codigo`
- [ ] Mapear usos:
  - `ventana.alteracion_codigo` (VARCHAR 10) — usado como alteración por cabecera.
  - `ventana.intemperismo_codigo` (VARCHAR 10).
  - `discontinuidad.alteracion_codigo` (VARCHAR 10) — por estructura.
  - `ventanas_final.alteracion` (VARCHAR 100).
  - `ventanas_final.intemperismo` (VARCHAR 100).
- [ ] Decidir si `alteracion_codigo` de cabecera debe desaparecer (preferible que solo exista por discontinuidad).
- [ ] Renombrar todo a `alteracion_codigo VARCHAR(10)` y `intemperismo_codigo VARCHAR(10)` para consistencia.

### 6.2 `lito_*` redundantes
- [ ] `ventana.lito_1/2/3` y `ventanas_final.lito_1/2/3` — si se decide eliminar `ventanas_final` (ver 5.2), el duplicado desaparece.
- [ ] Validar que `ventana.lito_3` es siempre el "submodelo" (LMT_M, MZH_1, etc.) y no la roca principal — documentar convención.

### 6.3 `sector_geotecnico` duplicado
- [ ] `ventana.sector`, `ventana.sector_geotecnico`, `ventanas_final.sector_geotecnico` — tres columnas storing datos similares.
- [ ] Eliminar `ventana.sector` (no se usa en ninguna query crítica) y standardizar `sector_geotecnico`.

### 6.4 `mapeador` vs `geotecnico`
- [ ] `ventana.mapeador` (VARCHAR 200), `ventanas_final.geotecnico` (VARCHAR 200) — misma persona.
- [ ] Resolver duplicado junto con la sección 5.

### 6.5 `campana` vs `campania`
- [ ] Renombrar `campana` → `campania` en `EnsayoPLTIrregular` para matchear el resto del sistema.
- [ ] Actualizar `plt.py`, `schemas.py`, frontend.

### 6.6 `nivel` duplicado
- [ ] `ventana.nivel` (FLOAT) y `ventanas_final.nivel` (FLOAT) — mismo dato.
- [ ] Resolver con sección 5.

### 6.7 `fecha` vs `fecha_mapeo`
- [ ] `ventana.fecha_mapeo` (DATE) y `ventanas_final.fecha` (DATETIME) — mismo dato con tipos distintos.
- [ ] Estandarizar a `DATE` (sin hora).

---

## 7. Defaults arbitrarios (`LÓGICA` + `SCHEMA`)

Revisar **cada** `nullable=False` con default "mágico". Tabla de auditoría (todos los defaults inyectados en `save_ventana`, `sync_to_ventanas_final`, schemas y frontend):

| # | Ubicación | Default actual | Acción |
|---|---|---|---|
| 7.1 | `ventanas.py:104` agua_codigo | `"C"` | [ ] Confirmar. "C" (seco) es un default físicamente razonable. |
| 7.2 | `ventanas.py:104` resistencia_codigo | `"R4"` | [ ] Confirmar con geomecánico (R4 = Resistente 50-100 MPa). |
| 7.3 | `ventanas.py:75` gsi_estructura | `"VB"` | [ ] Verificar significado (¿Vector Bien?) |
| 7.4 | `ventanas.py:75` gsi_superficie | `"G"` | [ ] Verificar significado (¿Grueso?) |
| 7.5 | `ventanas.py:78` gsi_visual | `50` | [ ] Confirmar. Nivel intermedio, parece razonable. |
| 7.6 | `ventanas.py:78` control_estructural | `4` | [ ] "Fuerte" — revisar si es default correcto. |
| 7.7 | `ventanas.py:78` efectos_voladura | `3` | [ ] "Moderado" — confirmar. |
| 7.8 | `ventanas.py:79` ucs_mpa | `74.0` | [ ] Default muy específico (74 MPa = R4). Cambiar a NULL. |
| 7.9 | `ventanas.py:80` is50_mpa | `5.0` | [ ] Cambiar a NULL. |
| 7.10 | `ventanas.py:125` `tipo_relleno_1` | `"cwf"` | [ ] Cambiar a NULL. "cwf" = clean without filling. |
| 7.11 | `ventanas.py:126` `tipo_relleno_2` | `"-1"` | [ ] Cambiar a NULL. |
| 7.12 | `ventanas.py:127` `rugosidad_estructuras` | `1` | [ ] Cambiar a NULL. |
| 7.13 | `ventanas.py:127` `forma_estructura` | `"P"` | [ ] Cambiar a NULL. |
| 7.14 | `ventanas.py:127` `alteracion` | `"f"` | [ ] Cambiar a NULL. "f" = fresca. |
| 7.15 | `ventanas.py:129` `sector_geotecnico` | `"E1"` | [ ] Cambiar a NULL. |
| 7.16 | `ventanas.py:129` `campania` | `2026` | [ ] Cambiar a NULL o al año actual dinámico. |
| 7.17 | `ventanas.py:522` (importar hoja "ventana") `mapeador` | `"RD/RB"` | [ ] Cambiar a NULL. |
| 7.18 | `ventanas.py:702` (importar hoja "BD") `mapeador` | `"RD/RB"` | [ ] Cambiar a NULL. |
| 7.19 | `ventanas.py:517, 519` `gsi_est = "VB"`, `gsi_cond = "G"` | hardcoded | [ ] Mover a catálogo. |
| 7.20 | `ventanas.py:522` `fase = 5` | hardcoded | [ ] Cambiar a NULL. |
| 7.21 | `ventanas.py:706` `fase = 5` | hardcoded | [ ] Cambiar a NULL. |
| 7.22 | `schemas.py:118` `tipo_ensayo = "i"` | default schema | [ ] Revisar. "i" = irregular; al ser `Optional[str]` con default, mantener. |
| 7.23 | `App.tsx:65/67/71` (frontend) | `-1` enrng_Calc | [ ] Cambiar también en frontend para alinearse con NULL backend. |

### Acciones sistemáticas para cada default:
- [ ] **Identificar el dominio** del default: ¿es un valor razonable preconfigurado o es un marker "sin datos"?
- [ ] Si es marker → reemplazar por NULL y permitir `nullable=True` en el modelo.
- [ ] Si es "valor absolutamente necesario": dejar como `server_default=text("'X'")` en el modelo para la BD, no en el código Python.
- [ ] Documentar cada decisión en este checklist.

---

## 8. Compatibilidad entre dialectos (`DIALECTO` + `LÓGICA`)

### 8.1 Tipos SQLAlchemy estándar
- [ ] Revisar `comentario = Column(String)` (`models.py:82, 138`) — sin longitud. Definir como `String(2000)` o `Text` si es open-ended.
- [ ] Revisar `Float` vs `Numeric` mezclado (ver sección 5.6).
- [ ] Sustituir `Column(String)` por `Column(String(N))` siempre.

### 8.2 Tipos DateTime
- [ ] Cambiar `DateTime` a `DateTime(timezone=True)` para ser TZ-aware (UTC).
- [ ] Cambiar `default=datetime.utcnow` a `default=lambda: datetime.now(timezone.utc)` (deprecation warning en Python 3.12+).
- [ ] Actualizar import en `models.py:3`.

### 8.3 Bypass de dialecto en código
- [ ] Eliminar `if "sqlite" in str(db.bind.url).lower()` (aparece en `ventanas.py:206, 238` y otros).
- [ ] Eliminar `if "sqlite" not in str(engine.url).lower()` en `run.py:79, 106`.
- [ ] Una vez adoptada una BD única, todo el código que bifurca por dialecto es candidato a borrado.

### 8.4 Drivers y dependencias
- [ ] `requirements.txt` tiene `pymssql`, `pyodbc`, `python-calamine`. Evaluar cuáles se mantienen:
  - Cambiar a PostgreSQL → agregar `psycopg2-binary` o `asyncpg`.
  - `pyodbc` ya no necesario (era para SQL Server).
  - `pymssql` ya no necesario.
- [ ] Actualizar `.env` con `DATABASE_URL=postgresql+psycopg2://usuario:pass@host:5432/ventanas`.

### 8.5 `load_dotenv()` override custom
- [ ] `database.py:6-20` y `run.py:4-18` implementan un `load_dotenv()` propio. Cambiar a `python-dotenv` estándar:
  - `from dotenv import load_dotenv; load_dotenv()`.
- [ ] Actualizar `requirements.txt` agregar `python-dotenv`.

### 8.6 Orden de intentos de conexión
- [ ] Simplificar `database.py:1-95` a:
  ```python
  DATABASE_URL = os.environ["DATABASE_URL"]
  engine = create_engine(DATABASE_URL, pool_pre_ping=True)
  ```
- [ ] Eliminar la lógica de "probar ODBC 18, 17, SQL Server" — la nueva BD define su URL completa.
- [ ] Conservar `ventanas.db` SQLite solo para tests locales (`DATABASE_URL=sqlite:///./test.db` en `.env.test`).

### 8.7 Validaciones de filas duplicadas en importación
- [ ] En `importar_excel_endpoint` (ventanas.py:451), si ya existe la ventana por `celda_code`, se sobreescribe sin avisar. Evaluar política: ¿reemplazar, saltar, o versionado?
- [ ] Agregar parámetro `?dry_run=true` para previsualizar cuántas ventanas se importarían / reemplazarían.

---

## 9. Tests y verificación

### 9.1 Antes de tocar nada
- [ ] Hacer snapshot del comportamiento actual: importar un Excel conocido (BD_Mapeo_Ferro_2021...) y exportar las ventanas generadas.
- [ ] Guardar esos archivos Excel como "goldens" en tests/.
- [ ] Comparar output de `calculator.calculate_geomechanics` con los valores del ExcelManual original.

### 9.2 Tests unitarios
- [ ] Crear `tests/test_calculator.py` — cobertura: agua, resistencia, RQD, espaciamiento, condición discontinuidad, RMR final, para '76 y '89.
- [ ] Crear `tests/test_validator.py` — cobertura: cada regla de `rules.py` dispara la alerta esperada.
- [ ] Crear `tests/test_interpolation.py` — verificación de `CubicSpline` y `PchipInterpolator` en valores límite (0, 25, 50, 75, 90, 100).

### 9.3 Tests de integración
- [ ] `tests/test_save_ventana.py`:
  - [ ] POST una ventana completa → comprobar las 4 tablas.
  - [ ] DELETE → comprobar cascada.
  - [ ] POST dos ventanas con mismo código → upsert correcto.
  - [ ] POST concurrente (asyncio o threading) → IDs no colisionan.

### 9.4 Después de la migración
- [ ] Importar el Excel bulk real (jugador de producción) correctamente sin errores.
- [ ] Auditoría masiva (BulkAuditor) genera el mismo Excel de reporte.
- [ ] Comparativo entre dos auditorías funciona.

---

## 10. Migración física (script ETL)

- [ ] Escribir script `migrate_sqlserver_to_postgres.py` que:
  - [ ] Levante cada tabla de SQL Server con `pymssql`.
  - [ ] Transforme tipos (DATETIME → TIMESTAMP, FLOAT → NUMERIC, VARCHAR → VARCHAR).
  - [ ] Inserte en PostgreSQL.
- [ ] Validar conteo de filas en cada tabla (origen == destino).
- [ ] Validar checksums de columnas críticas (celda, fecha_mapeo, rmr_76, rmr_89) por muestreo.
- [ ] Backup de PostgreSQL después de la migración inicial.

---

## 11. Documentación post-migración

- [ ] Actualizar `README` del backend con:
  - Nombre de la nueva BD.
  - URL de conexión estándar.
  - Comando de migración Alembic.
  - Driver de Python requerido.
- [ ] Crear `docs/modelo_de_datos.md` con diagrama ER actualizado.
- [ ] Borrar `.envAna` o moverlo a `.env.prod.example`.

---

## 12. Pendientes referentes al frontend (`LÓGICA`)

- [ ] En `App.tsx`, los defaults de la linea 65+ (`-1` para varios campos) deben alinearse con la política del backend (NULL → strings vacíos o `undefined`).
- [ ] En `App.tsx`, el flag `syncStatus === 'offline'` debe reflejar correctamente el estado de la nueva BD.
- [ ] En `utils/rmrCalculator.ts`, que es espejo del backend, asegurar que ambas implementaciones devuelven los mismos ratings (test de paridad).

---

## Resumen

**Total items**: ~110
**Categorías**: 12

**Priorización tentativa**:
1. **Bloque 1-4** — son urgentes, son bugs de concurrencia y de seguridad de datos.
2. **Bloque 5** — estrategia arquitectónica, decisión de diseño a tomar antes de migrar.
3. **Bloque 6-7** — refinamiento del schema y los defaults.
4. **Bloque 8** — adaptación al nuevo dialecto.
5. **Bloque 9-12** — verificación, migración física y documentación.

**Tiempo estimado**: 3-5 días de trabajo concentrado para bloques 1-7; +2 días para tests y migración física.

---

## Progreso

- [ ] En progreso: bloque 0
- [ ] Próximo bloque crítico: bloque 1 (IDs y claves)