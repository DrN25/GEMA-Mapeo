# Análisis de Brechas: mapeo.md ↔ Interfaz ↔ BD

> Generado por análisis arquitectónico.
> Propósito: identificar todos los gaps entre la interfaz actual, el mapeo objetivo (`Sistema/mapeo.md`)
> y el modelo de datos actual (`backend/app/models.py`) antes de tocar código.
> Estrategia: primero la interfaz debe quedar 100% fiel al mapeo.md, luego se migra a la nueva BD.

---

## Convenciones de notación

- ✅ = existe y mapea correctamente
- ⚠️ = existe en la interfaz pero con desviaciones (nombre, ubicación, tipo)
- ❌ = existe en mapeo.md pero NO está en la interfaz o en la BD
- 🎯 = acción concreta a ejecutar

---

## 1. Tabla `mapeo.VentanasMapeo` (cabecera)

### 1.1 Campos existentes y correctamente mapeados

| Excel | Campo interfaz | Widget | Estado |
|---|---|---|---|
| (B) Celda | `header.celda` | VentanaForm input text uppercase | ✅ |
| (CB) Sector Geotecnico | `header.sect_geot` | VentanaForm input text | ⚠️ Debería ser select con catálogo |
| (AY) FECHA | `header.fecha` | VentanaForm input date | ✅ |
| (BW) Nivel | `header.nivel` | VentanaForm input text numérico (enteros 4, decimales 2) | ✅ |
| (D) ESTE_FROM | `header.este_from` | VentanaForm coordenadas FROM E | ✅ |
| (E) NORTE_FROM | `header.norte_from` | Coordenadas FROM N | ✅ |
| (F) COTA_FROM | `header.cota_from` | Coordenadas FROM Z/C | ⚠️ label "Z" debe ser "C" |
| (G) ESTE_TO | `header.este_to` | Coordenadas TO E | ✅ |
| (H) NORTE_TO | `header.norte_to` | Coordenadas TO N | ✅ |
| (I) COTA | `header.cota_to` | Coordenadas TO Z/C | ⚠️ label "Z" debe ser "C" |
| (J) Dist.Celda | `header.largo` (calculado) | VentanaForm input readonly "AUTO" | ⚠️ etiqueta dice "Largo (m)" pero debería ser "Dist. Celda (m)" ya que el mapeo lo llama `DistanciaCelda`. El cálculo automático es correcto. |
| (K) Altura | `header.altura` | input decimal | ✅ |
| (L) DIP | `header.dip_hw` | input "Dip Hw°" | ⚠️ label "Dip Hw°" debe ser "DIP°" según mapeo (es el DIP del sondaje/celda, no del hanging wall) |
| (M) AZ_HOLE | `header.az_hw` | input "Az Hw°" | ⚠️ label "Az Hw°" debe ser "AZ_HOLE°" según mapeo |
| (N) DIP_TALUD | `header.dip_talud` | input decimal | ✅ |
| (O) DIP DIR_TALUD | `header.dipdir_talud` | input decimal | ✅ |
| (BX) Lito 1 | `header.lito_1` | select cascada 1/3 | ✅ |
| (BY) Lito 2 | `header.lito_2` | select cascada 2/3 | ✅ |
| (BZ) Lito 3 | `header.lito_3` | select cascada 3/3 | ✅ |
| (CA) Unidad Litologica | `header.unidad_litologica` | select | ✅ |
| (P) INTEMPERISMO | `header.intemperia` | select (usa catálogo ALTERACION_CATALOG) | ⚠️ catálogo reusado — hay que verificar que el catálogo sea de intemperismo, no alteración |
| (Q) CONDICION DE AGUA '76 | `header.condicion_agua` | RmrAnalysis select C/H/M/E/F | ✅ |
| (S) DUREZA '76 | `header.resistencia_ucs` | RmrAnalysis select R0-R6 | ⚠️ label "Resistencia Estimada" pero el mapeo lo nombra `DurezaRMR76` — revisar con geomecánico |
| (U) GSI VISUAL '76 | `header.gsi_visual` | RmrAnalysis input numérico | ✅ |
| (V) CONTROL ESTRUCTURAL '76 | `header.control_estructural` | RmrAnalysis select 1-5 | ✅ |
| (W) EFECTOS DE VOLADURA '76 | `header.efectos_voladura` | RmrAnalysis select 1-6 (sin 4) | ✅ |
| (AI-AH) Bloque '89 | ✅ mismos campos | RmrAnalysis usa los mismos inputs de cabecera | ✅ |
| (AG) UCS | `header.ucs_mpa` | RmrAnalysis input numérico | ✅ |
| (AH) is50 | `header.is50_mpa` | RmrAnalysis input numérico | ✅ |
| (BV) GEOTECNICO | `header.mapeador` | VentanaForm input text "Mapeador" | ✅ (renombrado en BD) |
| (AZ) COMENTARIO | `header.comentario` | CommentsPhotos textarea | ✅ |

### 1.2 Campos en mapeo.md PERO faltantes en la interfaz

| Excel | Campo esperado | Widget | Estado | Acción |
|---|---|---|---|---|
| (CC) Campaña | `header.campania` | **SELECT** para CampañaID | ❌ No hay widget visible en VentanaForm ni en RmrAnalysis. `campania` está definido en `WindowHeader` pero el usuario no lo puede editar. | 🎯 Agregar select en VentanaForm (sección "Metadatos y Control de Campaña" — junto a Fase/Nivel/Fecha/Mapeador) con catálogo dinámico (texto o FK a tabla `campania`) |
| FechaRegistro | estado | n/a (sistema) | ❌ Solo `creado_en` en BD | 🎯 Mantener — se llena solo en backend |
| UsuarioRegistro | estado | n/a (sistema) | ❌ No existe | 🎯 Agregar campo `usuario_registro` en BD y capturar del auth/localStorage |
| FechaModificacion | estado | n/a (sistema) | ❌ Solo `modificado_en` en BD | 🎯 Mantener |
| UsuarioModificacion | estado | n/a (sistema) | ❌ No existe | 🎯 Agregar campo `usuario_modificacion` en BD |

### 1.3 Campos en RmrAnalysis que el mapeo espera como CONDICION DE LA SUP (GSI) / ESTRUCTURA (GSI)

| Mapeo | Interfaz actual | Estado |
|---|---|---|
| CondicionSup_GSI | `header.gsi_superficie` (input TEXT) | ⚠️ debería ser select con catálogo (G, S, etc.) |
| Estructura_GSI | `header.gsi_estructura` (input TEXT) | ⚠️ debería ser select con catálogo (VB, BB, etc.) |

> **Acción**: 🎯 Identificar catálogo completo de superficies y estructuras GSI usadas en el Excel A y reemplazar inputs por selects.

### 1.4 Campos calculados (no son input del usuario, pero deben mapearse a BD)

El mapeo.md los enumera como columnas del Excel pero corresponden a **resultados del RMR**:
- (R) CondicionAguaValorRMR76 → `calculated.water_rating_76`
- (T) ResistenciaEstimadaValorRMR76 → `calculated.ucs_rating_76`
- (X) RQD_ValorRMR76 → `calculated.rqd_rating_76`
- (Y) RQD_RMR76 → `calculated.rqd_est` (en %)
- (Z) FrecuenciaFracturamientoRMR76 → `calculated.jv`
- (AA) TamañoBloquesRMR76 → `Math.pow(calculated.global_spacing, 3)`
- (AB) EspaciamientoPromedioRMR76 → `calculated.global_spacing`
- (AC) EspaciamientoValorRMR76 → `calculated.spacing_rating_76`
- (AE) CondicionDiscontinuidadValorRMR76 → `calculated.condicion_rating_76`
- (AF) RMR76_Total → `calculated.rmr_76`
- (AJ-AX) Bloque '89 → equivalentes

**Estado**: ✅ Todos calculados y mostrados en `RmrAnalysis.tsx`. Solo hay que confirmar que se persistan en BD en el sync final (actualmente van a `ventanas_final`).

### 1.5 Campos a NO mapear (según mapeo.md línea 65-67)

- `Estado_QA_Espaciamiento 76` → no va a BD
- `Estado_QA_Espaciamiento 89` → no va a BD

**Estado**: ✅ (no existen en la interfaz ni en el modelo)

---

## 2. Tabla `mapeo.EstructurasGeologicas` (discontinuidades)

### 2.1 Campos correctamente mapeados

| Excel | Campo interfaz | Column Config | Estado |
|---|---|---|---|
| (BG) TIPO | `j.tipo_estructura` | DISCON_COLUMNS.tipo_estructura (select) | ✅ |
| (BH) DIP | `j.dip` | input number range [-90,90] | ✅ |
| (BI) DIPDIR | `j.dip_dir` | input number range [0,359] | ✅ |
| (BA) Dist. de estr. | `j.distancia` | input number | ✅ |
| (BK) ABERTURA mm. | `j.abertura` | input number | ✅ |
| (BL) ESPESOR mm. | `j.espesor` | input number | ✅ |
| (BM) CONTINUIDAD m. | `j.continuidad` | input number | ✅ |
| (BN) ESPACIAMIENTO m. | `j.espaciamiento` | input number | ✅ |
| (BO) NUMERO DE EXTREMOS VISIBLES | `j.extremos_visibles` | select 0/1/2 | ✅ |
| (BP) TIPO DE RELLENO 1 | `j.relleno1` | select (catálogo) | ✅ |
| (BQ) TIPO DE RELLENO 2 | `j.relleno2` | select (catálogo) | ✅ |
| (BR) JRC | `j.jrc` | input number range [1,20] | ⚠️ mapeo dice [0,20], verificar |
| (BS) RUGOSIDAD DE ESTRUCTURAS | `j.rugosidad` | input number range [1,9] | ✅ |
| (BT) FORMA DE ESTRUCTURA | `j.forma` | select P/C/O/E/I | ✅ |
| (BU) ALTERACION | `j.alteracion` | select | ✅ |
| Terminacion | `j.terminacion` | select 0/1/2/3 | ✅ |

### 2.2 Campos calculados (no editables, se muestran en tabla)

| Excel | Campo interfaz | Column Config | Estado |
|---|---|---|---|
| (BB) teta | `calculatedJoint.theta` | structure plot | ✅ |
| (BC) alfa | `calculatedJoint.alpha` | structure plot | ✅ |
| (BD) x | `calculatedJoint.x` | structure plot | ✅ |
| (BE) y | `calculatedJoint.y` | structure plot | ✅ |
| (BF) z | `calculatedJoint.z` | structure plot | ✅ |

### 2.3 Campos faltantes en la BD (sección 4 de mapeo.md)

Estos son los sub-ratings por discontinuidad que actualmente **solo se muestran en la UI** pero no se persisten en BD:

#### Bloque '76
| Mapeo | Equivalente UI | Estado |
|---|---|---|
| ValorAlteracionCondicionDiscontinuidades76 | `row.altR76` | ❌ No persistido |
| ValorRellenoCondicionDiscontinuidades76 | `row.relR76` | ❌ No persistido |
| ContinuidadCondicionDiscontinuidades76 | `row.contR76` | ❌ No persistido |
| AberturaCondicionDiscontinuidades76 | `row.abR76` | ❌ No persistido |
| RugosidadCondicionDiscontinuidades76 | `row.rugR76` | ❌ No persistido |
| ValorCondicionDiscontinuidades76 | `row.totalR76` | ❌ No persistido |

#### Bloque '89 (idem)
| Mapeo | Equivalente UI | Estado |
|---|---|---|
| ValorAlteracionCondicionDiscontinuidades89 | `row.altR89` | ❌ No persistido |
| ValorRellenoCondicionDiscontinuidades89 | `row.relR89` | ❌ No persistido |
| ContinuidadCondicionDiscontinuidades89 | `row.contR89` | ❌ No persistido |
| AberturaCondicionDiscontinuidades89 | `row.abR89` | ❌ No persistido |
| RugosidadCondicionDiscontinuidades89 | `row.rugR89` | ❌ No persistido |
| ValorCondicionDiscontinuidades89 | `row.totalR89` | ❌ No persistido |

> **Decisión arquitectónica**: estos sub-ratings son derivables de los inputs (alteracion + espesor + rugosidad + abertura + continuidad) y del estándar (76 o 89). **No deben persistirse** — deben ser una **VIEW** en la nueva BD o calcularse on-the-fly. Persistirlos duplica información y rompe SSOT. Confirmar con geomecánico.

### 2.4 Campo del Excel que no tiene BD (sección 3 de mapeo.md)

| Excel | Decisiones |
|---|---|
| (BJ) NUMERO DE ESTRUCTURAS | ⚠️ Actualmente existe `n_estructuras` en `JointRow` y en `discontinuidad` model. Pero mapeo.md lo marca como "no tiene BD". **Revisar**: ¿se refiere al conteo de estructurasgeológicas de la misma familia, o al número ordinal de la fila? Por el contexto (línea 74 del mapeo), `NumeroEstructura` ya existe como ordinal auto-generado. **Acción**: 🎯 Confirmar con geomecánico si `NUMERO DE ESTRUCTURAS` del Excel coincide con el actual `j.n_estructuras`. |

### 2.5 Campos interfaz que no están en BD (sección 4 del mapeo.md)

| Interfaz (mapeo.md línea 102-106) | Estado actual del backend | Acción |
|---|---|---|
| ALT. DE ZONA | `header.alt_zona` está en la UI pero NO en `models.Ventana` | 🎯 Agregar columna `alt_zona VARCHAR(20)` a `Ventana` |
| FASE | `header.fase` está en la UI y `fase` en `models.Ventana` (Integer) | ✅ (revisar tipo: el form pasa string, la BD espera int) |
| CONDICION DE LA SUP (GSI) | `header.gsi_superficie` en UI y `gsi_superficie` en `models.VentanaRmrInput` | ✅ |
| ESTRUCTURA (GSI) | `header.gsi_estructura` en UI y `gsi_estructura` en `models.VentanaRmrInput` | ✅ |
| TERMINACION (discontinuidad) | `j.terminacion` en UI y `terminacion` en `models.Discontinuidad` | ✅ |
| Sub-ratings 76/89 | UI sí, BD NO | Ver sección 2.3 |

---

## 3. Correcciones específicas en la interfaz (sección 5 del mapeo.md)

### 3.1 ⚠️ CRÍTICO: cambiar label "Z" por "C" en coordenadas
- **Ubicación**: `VentanaForm.tsx` líneas 319 (FROM) y 363 (TO)
- **Acción**: 🎯 Reemplazar `>Z<` con `>C<` y el placeholder `Cota (Z)` con `Cota (C)`.

### 3.2 Mejoizar orden y navegación con tabs/flechas
- **Secciones afectadas**:
  - `MAPEO POR VENTANA - DATOS DE REGISTRO` (VentanaForm.tsx)
  - `MAPEO POR VENTANA - ANALISIS GEOMECANICO RMR & GSI` (RmrAnalysis.tsx)
- **Acción**: 🎯 Estudiar implementación de:
  - **Opción A (recomendada)**: Tabs horizontales ("Datos Básicos", "Coordenadas", "Litología", "Geomecánico") dentro de VentanaForm.
  - **Opción B**: Stepper con flechas, igual que un wizard.
  - **Opción C**: Acordiones verticales plegables (más simple, coherente con los ya usados para CommentsPhotos).
- **Decisión**: Propuesta = Opción C (acordiones) para bajo impacto + Opción A (tabs) para RmrAnalysis (ya es muy ancho).

### 3.3 Cambiar nombres de columnas para ser fiel al Excel
- **Estado**: cumplir analizar columna por columna en `COLUMN_LABELS` (`geomecColumns.ts`)
- **Acción**: 🎯 Audit completa de labels en `COLUMN_LABELS` vs Excel. Ejemplos detectados:
  - `distancia` → "Distancia Estructura (m)" vs Excel "Dist. de estr." — mantener el nuestro, más legible
  - `dip` → "Dip (°)" ✅ (Excel: "DIP")
  - `dip_dir` → "DipDir (°)" ✅
  - `gsi_superficie` → "Condicion de la SUP (GSI)" — debería decir **completamente** como el Excel (proponer: "Condición de la Superficie (GSI)")
  - `gsi_estructura` → "Estructura (GSI)" ✅
  - `resistencia_ucs` → "Resistencia Estimada" vs Excel "DUREZA" — el mapeo lo llama DurezaRMR76/89. **Decisión**: ¿dejar "Resistencia Estimada" (más fiel al RMR) o volver a "Dureza"? Solicitar input del geomecánico.
  - `largo` → VentanaForm dice "Largo (m)", Excel dice "Dist.Celda". **Acción**: 🎯 Cambiar label a "Dist. Celda (m)".
  - `dip_hw` → "Dip Hw°" → Excel "DIP". **Acción**: 🎯 Cambiar label a "DIP°".
  - `az_hw` → "Az Hw°" → Excel "AZ_HOLE". **Acción**: 🎯 Cambiar label a "AZ_HOLE°".

### 3.4 (Opcional) Permitir importación de Excel A (Estaciones) y Excel B (BD) completa
- **Estado actual**:
  - Excel B (BD) ya tiene importador en `ventanas.py:451` (hoja "ventana" o "BD")
  - Excel A (Estaciones) NO tiene importador específico
- **Acción**: 🎯 Crear endpoint `/api/importar-excel-estaciones` y fusionar datos de Estaciones con BD al guardar la ventana. Esto se conecta con la sección 4 de mapeo (campos que se recuperan del Excel A: Estaciones).

---

## 4. Plan de ejecución por fases

### FASE 0 — Confirmación de criterios (1 día)
- [ ] Confirmar con geomecánico el nombre estándar de cada campo (especialmente: "Dureza" vs "Resistencia Estimada", `dip_hw`/`az_hw` vs `dip`/`az_hole`).
- [ ] Definir la política de **persistencia de sub-ratings** (ver sección 2.3): ¿se persisten o se calculan on-the-fly?
- [ ] Confirmar catálogo de `gsi_superficie` (¿G, S, Sl, etc.?)
- [ ] Confirmar catálogo de `gsi_estructura` (¿VB, BB, etc.?")
- [ ] Confirmar catálogo de `campania` (¿ anual, estática [2021, 2023, 2026] o tabla FK?)
- [ ] Confirmar que `NUMERO DE ESTRUCTURAS` (Excel BJ) es distinto de `NumeroEstructura` ordinal autocalculado.

### FASE 1 — Correcciones de labels y widgets mínimos (1 día)
Objetivo: interfaz 100% fiel al mapeo.md, sin mover layout.

- [ ] **1.1** VentanaForm: cambiar labels "Z" → "C" en coordenadas FROM/TO.
- [ ] **1.2** VentanaForm: cambiar label "Largo (m)" → "Dist. Celda (m)" (calculatedAUTO).
- [ ] **1.3** VentanaForm: cambiar labels "Dip Hw°" → "DIP°" y "Az Hw°" → "AZ_HOLE°".
- [ ] **1.4** VentanaForm: agregar widget SELECT `Campaña` en sección "Metadatos y Control de Campaña" (-catálogo configurable, default ["2021", "2023", "2026"]).
- [ ] **1.5** VentanaForm: cambiar `Sector Geotécnico` de input text a SELECT con catálogo si existe (sino pospuesto a FASE 3).
- [ ] **1.6** RmrAnalysis: convertir `gsi_superficie` de input text a SELECT con catálogo (depende de F0).
- [ ] **1.7** RmrAnalysis: convertir `gsi_estructura` de input text a SELECT con catálogo (depende de F0).
- [ ] **1.8** Verificar `JRC` range: mapeo dice [1,20] pero el input en `geomecColumns.ts` también dice [1,20] — confirmar con BD (`models.py:61` es Integer sin range, ok).

### FASE 2 — Reorganización UX/UI (2 días)
Objetivo: mejorar la jerarquía y navegación sin romper la fidelidad del mapeo.

- [ ] **2.1** VentanaForm: dividir en 4 acordiones verticales:
  - Identificación (Celda, Campaña, Sector Geotécnico, Fecha, Mapeador, Fase, Nivel)
  - Geometría y Coordenadas (From E/N/C, To E/N/C, Dist.Celda, Altura, Dip Talud, DipDir Talud, DIP°, AZ_HOLE°)
  - Litología (Lito 1, Lito 2, Lito 3, Unidad Litologica, Intemperismo, Alt. de Zona)
  - — dejar el RMR & GSI en su propio panel vertical (no romper la tabla ancha)
- [ ] **2.2** RmrAnalysis: dividir en 3 sub-paneles horizontales con tabs:
  - Inputs de Control (Agua, Dureza, IS50, GSI... 9 inputs)
  - Tabla de Valoración Dinámica (la tabla actual)
  - KPIs y detalle formulado
- [ ] **2.3** Padre/VentanaForm y RmrAnalysis: preservar la integridad horizontal de la tabla de discontinuidades (DisconTable) — no se rompe en tabs, se mantiene siempre visible.
- [ ] **2.4** Validar que al guardar → los campos nuevos (`campania`, `alt_zona`) se incluyan en el payload `POST /api/ventanas` (verificar `App.tsx:553-613`).

### FASE 3 — Persistencia de campos nuevos (1 día)
Objetivo: los campos nuevos de la interfaz llegan a la BD actual (no a la nueva todavía).

- [ ] **3.1** `schemas.py`: agregar `alt_zona: Optional[str]` a `VentanaSaveSchema`.
- [ ] **3.2** `models.py`: agregar columnas a `Ventana`:
  - `alt_zona = Column(String(20), nullable=True)`
- [ ] **3.3** `schemas.py`: confirmar que `campania` ya está (sí, línea 50). Validar que se envía desde el frontend.
- [ ] **3.4** `ventanas.py` (`save_ventana`): incluir `alt_zona` y `campania` en el upsert.
- [ ] **3.5** `main.py` ADD COLUMN para `alt_zona` en la migración inline ( solventar que arranque limpio).
- [ ] **3.6** Confirmar persistencia con un POST de prueba y un GET posterior.

### FASE 4 — Importación Excel A (Estaciones) (2-3 días)
Objetivo: el Excel A aporta los sub-ratings de condición de discontinuidad y los GSI superficies/estructura.

- [ ] **4.1** Mapear cabeceras del Excel A (Estaciones) — ver `Material/Estaciones_A21_23-04-2026 (1).xlsx`.
- [ ] **4.2** Identificar columnas que deben "mergear" con la ventana por `celda` como clave.
- [ ] **4.3** Extender `importar_excel_endpoint` para admitir hojas extra:
  - `Estaciones_A21` → importación pura (una fila por celda)
  - `Compilado` → importación pura (ventanas con datos de cabecera)
- [ ] **4.4** Resolver joins en BD (o persistir todo en `ventana`).
- [ ] **4.5** Tests: importar Excel A y comprobar que `gsi_superficie`, `gsi_estructura`, `alt_zona`, `fase` se llenan correctamente.

### FASE 5 — Importación Excel B (BD) (1-2 días)
Objetivo: test completo de importación del Compilado_Ventanas_2023 y BD_Mapeo_Ferro_2021.

- [ ] **5.1** Comparar resultado esperado vs actual con un Excel "golden" definido.
- [ ] **5.2** Validar que las columnas nuevas (CC Campaña, alt_zona) se importan correctamente.
- [ ] **5.3** Evaluar unificación: hoy existen dos ramas (`hoja "ventana"` y `hoja "BD"`) — simplificar a una sola estrategia de detección de cabeceras o exponerla como parámetro.

### FASE 6 — Verificación final (1 día)
- [ ] **6.1** Lint + typecheck (`npm run lint`, `npx tsc --noEmit`).
- [ ] **6.2** Build: `npm run build` debe pasar sin errores.
- [ ] **6.3** Backend tests manuales: importar/exportar/check de IDs no colisionan.
- [ ] **6.4** Actualizar `mapeo.md` con checkboxes de los items resueltos.

---

## 5. Resumen de gaps detectados

| Categoría | Cantidad | Severidad |
|---|---|---|
| Labels incorrectos en interfaz | 5 (C/Z, largo, dip_hw, az_hw, dureza) | Media |
| Campos faltantes en interfaz | 1 (Campaña select) | Alta |
| Widgets a cambiar de input text → select | 3 (Sector Geot, GSI Superficie, GSI Estructura) | Media |
| Campos faltantes en BD actual | 1+ (`alt_zona`, y sub-ratings por discontinuidad) | Media |
| Mejoras UX de layout | 2 (tabs/acordiones en VentanaForm y RmrAnalysis) | Baja |
| Imports Excel A | 1 (no existe importador Estaciones) | Media |
| Imports Excel B | 0 (ya existe, requiere validación) | Baja |

**Tiempo estimado total**: 8-11 días según disponibilidad.

---

## 6. Decisiones pendientes (requieren tu input)

1. **Política de sub-ratings**: persistir o calcular on-the-fly (ver sección 2.3).
2. **Nombre del campo "Dureza"**: ¿es "Dureza" o "Resistencia Estimada"? (El mapeo dice Dureza, el RMR usa Resistencia).
3. **Catálogo de `gsi_superficie`**: ¿qué valores incluye? (¿G, S, Sl, Bs, Bu...?)
4. **Catálogo de `gsi_estructura`**: ¿qué valores incluye? (¿VB, BB, B, UB...?)
5. **Política de campañas**: ¿catálogo estático [2021, 2023, 2026] o tabla FK dinámica?
6. **`NUMERO DE ESTRUCTURAS` (Excel BJ)**: ¿es `n_estructuras` (conteo) o `NumeroEstructura` (ordinal)? Confirmar.
7. **Layout**: ¿Acordiones (Opción C, más simple) o Tabs (Opción A, más potente)?

Cuando confirmes las decisiones, arranco por **FASE 1** que es la de menor impacto (labels + widget Campaña + selects) y delivery en menos de un día.