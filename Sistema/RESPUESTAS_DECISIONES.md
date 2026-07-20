# Respuestas a las 7 decisiones + Nuevo panorama GEMA.sql

> Documento que responde las 7 decisiones pendientes de `ANALISIS_INTERFAZ.md`
> e incorpora el descubrimiento del esquema SQL Server real (`GEMA.sql`).
> **Esto cambia el panorama**: la BD real de producción no es la del `models.py` del backend,
> sino una base normalizada con tablas catálogo y FKs reales llamada `GEMA`.

---

## 0. Hallazgo crucial: GEMA.sql

La BD real de producción (`GEMA` en SQL Server) tiene un esquema **completamente distinto** al que está en `backend/app/models.py` del Sistema.

### Esquema real de GEMA (8 tablas con catálogos FK)

```
┌─────────────────────────────────────────────────────────────────┐
│  mapeo.VentanasMapeo  (PK: VentanaID IDENTITY)                  │
│   ├── FK CampañaID          → dbo.Campañas                       │
│   ├── FK SectorGeotecnicoID → mapeo.SectoresGeotecnicos          │
│   ├── FK Litologia1ID       → dbo.Litologias                    │
│   ├── FK Litologia2ID       → dbo.Litologias                    │
│   ├── FK Litologia3ID       → dbo.Litologias                    │
│   ├── FK UnidadLitologicaID → dbo.UnidadesLitologicas           │
│   ├── FK GeotecnicoID       → dbo.Geotecnicos                   │
│   └── Todos los sub-ratings RMR '76 y '89 están en columnas     │
└─────────────────────────────────────────────────────────────────┘
                  │
                  │ 1:N ON DELETE CASCADE
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│  mapeo.EstructurasGeologicas (PK: EstructuraID IDENTITY)         │
│   ├── FK VentanaID         → mapeo.VentanasMapeo                │
│   ├── FK TipoEstructuraID  → dbo.TiposEstructura               │
│   └── UNIQUE (VentanaID, NumeroEstructura)                       │
└─────────────────────────────────────────────────────────────────┘

Catálogos (todos con IDENTITY y UNIQUE en código):
  • dbo.Campañas            (PK CampañaID, UNIQUE NombreCampaña)
  • mapeo.SectoresGeotecnicos (PK SectorGeotecnicoID, UNIQUE CodigoSector)
  • dbo.Litologias          (PK LitologiaID, UNIQUE CodigoLitologia)
  • dbo.UnidadesLitologicas (PK UnidadLitologicaID, UNIQUE CodigoUnidad)
  • dbo.TiposEstructura     (PK TipoEstructuraID, UNIQUE CodigoEstructura)
  • dbo.Geotecnicos         (PK GeotecnicoID)
```

### Diferencias críticas vs `models.py` actual

| Aspecto | `models.py` (Sistema) | `GEMA.sql` (Producción real) |
|---|---|---|
| Sector geotecnico | `String(100)` texto libre | `INT FK` a `SectoresGeotecnicos` |
| Campaña | `Integer` (año 2026) | `INT FK` a `Campañas` (1-8) |
| Litologías 1/2/3 | `String(100)` texto libre | `INT FK` a `Litologias` (catálogo de 60+ items) |
| Unidad litológica | `String(100)` texto libre | `INT FK` a `UnidadesLitologicas` (5 grupos) |
| Geotecnico/Mapeador | `String(200)` texto libre | `INT FK` a `Geotecnicos` (24 personas) |
| Tipo estructura | `String(50)` ('JN','BED',…) | `INT FK` a `TiposEstructura` (11 tipos) |
| Sub-ratings RMR | NO existen en `ventanas_final` (solo agregados) | **SÍ existen como columnas** en `VentanasMapeo` |
| `ventanas_final` (tabla apanada) | SÍ existe (79 columnas) | NO existe (es una view implícita) |
| `ventana` + `discontinuidad` + `rmr_input` | Tres tablas separadas | `VentanasMapeo` + `EstructurasGeologicas` (dos) |
| Auditoría | `creado_en`, `modificado_en` | `FechaRegistro`, `UsuarioRegistro`, `FechaModificacion`, `UsuarioModificacion` |
| Largo/Dist.Celda | `largo_m FLOAT FetchedValue` | `DistanciaCelda DECIMAL(8,3)` (sin FetchedValue) |
| Precisión coords | `Numeric(18,6)` | `DECIMAL(12,3)` (menos precisión) |
| JRC | `INT` | `DECIMAL(4,2)` (admite decimales) |
| Rugosidad estructura | `INT (1-9)` | `NVARCHAR(50)` (admite códigos) |
| Forma estructura | `String(50)` (P,C,O,E,I) | `NVARCHAR(50)` |
| Alteración | `String(10)` (f,d,m,a,c,s) | `NVARCHAR(50)` |
| Relleno 1/2 | `String(50)` | `NVARCHAR(50)` |
| Nivel | `FLOAT` (3960.0) | `NVARCHAR(50)` (puede ser "3960", "3960.5", "3960-N") |
| `turno` (día/noche) | `String(50)` | NO existe |
| `dip_hw`/`az_hw` | Columnas separadas | `DIP`/`AzimutHole` en VentanasMapeo |
| `VentanaRmrInput` (1:1) | Tabla separada | Mezclada en `VentanasMapeo` |
| `EnsayoPLTIrregular` | Tabla del Sistema | NO existe en GEMA (se maneja aparte) |

### Conclusión

**El backend actual está mapeado contra un esquema inventado, NO contra GEMA**. Toda la migración a "una BD más profesional" consiste en reconstruir `models.py` para que hable directamente con GEMA (o su equivalente en PostgreSQL).

---

## 1. SUB-RATINGS (autocalculados) — Decisión de diseño

### Tu pregunta reformulada
> Los sub-ratings (altR76, relR76, contR76, abR76, rugR76, totalR76 + equivalentes en 89) son autocalculados.
> ¿Los persistimos en BD o los calculamos on-the-fly?
> Si los persistimos, al cargar: ¿recuperamos directo de BD (confiamos) o ignoramos y recalcamos (interfaz confiable)?
> Esto también afecta al botón Guardar — debe ser robusto.

### Mi recomendación: **PATRÓN HYBRID (CACHE WRITABLE)**

```
┌──────────────────────────────────────────────────────────────┐
│ 1. INPUT del usuario    → 2. CALCULO en UI    → 3. MUESTRA    │
│                          (altR76, etc. — autocalc)             │
│                                                                   │
│ 4. GUARDAR (POST) → payload INCLUYE sub-ratings             │
│                       ↓                                          │
│ 5. BACKEND: valida inputs, RECALCULA sub-ratings              │
│             (no confía en lo que envió la UI)                   │
│             ↓                                                    │
│ 6. PERSISTE: inputs + sub-ratings recalculados                │
│             ↓                                                    │
│ 7. RESPONSE: devuelve el obj guardado (con sub-ratings)        │
└──────────────────────────────────────────────────────────────┘

Al CARGAR una ventana (GET):
  8. Lee de BD: inputs + sub-ratings persistidos
  9. La UI muestra los sub-ratings DIRECTO de BD (no recalca)
      - ¿Por qué? Porque están pre-validados y son inmutables.
      - Si la UI no puede recalcular igual que el backend, mejor confiar en BD.
  10. Si el usuario EDITA un input → la UI recalca en tiempo real
      y al guardar, vuelve a paso 4.
```

### Justificación

**¿Por qué persistir también los autocalculados (no solo los inputs)?**
- ✅ GEMA ya los tiene como columnas (`ResistenciaEstimadaValorRMR76`, etc.) — no rompemos el esquema.
- ✅ Permite que terceros (BI, Excel, reportes) consulten directamente sin recalcular.
- ✅ Histórico inmutable: si cambian las fórmulas del RMR en el futuro, los datos antiguos quedan congelados con su valor original.
- ✅ Permite auditoría: comparar "lo que se calculó al guardar" vs "lo que se calcula hoy" detecta bugs.

**¿Por qué el backend recalcula al recibir (no confía en la UI)?**
- ✅ La UI puede tener bugs, el usuario puede manipular JS, el navegador puede tener versión cũ del catálogo.
- ✅ El backend es la fuente única de verdad (SSOT) para fórmulas geomecánicas.
- ✅ Es un cálculo barato (milisegundos) — no impacta performance.

**¿Por qué al cargar la UI muestra lo de BD sin recalcular?**
- ✅ Si el usuario no editó nada, no hay razón para recalcular.
- ✅ Evita parpadeos si las fórmulas Backend y Frontend difirieren ligeramente.
- ✅ Solo se recalca cuando el usuario edita un campo input → hay que recalcular para mostrar cambios en tiempo real.

### Implementación técnica

```python
# save_ventana (backend) — flujo propuesto
def save_ventana(data: schemas.VentanaSaveSchema, db: Session = Depends(get_db)):
    # 1. Persistir inputs del usuario
    ventana = upsert_ventana(db, data)
    discontinuidades = upsert_discontinuidades(db, ventana.id, data.discontinuidades)
    rmr_input = upsert_rmr_input(db, ventana.id, data.rmr_input)

    # 2. Calcular sub-ratings en backend (NO usar los que envió la UI)
    res = calculator.calculate_geomechanics(ventana, discontinuidades, rmr_input)

    # 3. Persistir los sub-ratings calculados en VentanasMapeo
    ventana.condicion_agua_valor_rmr76 = res.agua_rating_76
    ventana.resistencia_estimada_valor_rmr76 = res.ucs_rating_76
    ventana.rqd_valor_rmr76 = res.rqd_rating_76
    # ... etc
    db.commit()

    # 4. Devolver todo el obj guardado (UI lo usa para "modo sync'd")
    return serialize_ventana(ventana, discontinuidades, rmr_input, res)
```

```typescript
// Frontend — payload POST
const payload = {
  // inputs del usuario (no sub-ratings)
  codigo: header.celda,
  condicion_agua: header.condicion_agua,
  resistencia_ucs: header.resistencia_ucs,  // dureza
  discontinuidades: [...],
  // ... NO incluir sub-ratings en el payload
};

// Al recibir respuesta del POST, sobrescribir el estado local
const response = await fetch('/api/ventanas', { ... });
const savedWindow = await response.json();
// Mergear los sub-ratings calculados del backend a `calculated`
setCalculated(savedWindow.calculated);
```

### Botón Guardar robusto

Para detectar cambios sin depender del "interesado" usuario, implements:

```typescript
// Al cargar una ventana GET, capturar snapshot "original"
const [originalSnapshot, setOriginalSnapshot] = useState<string>('');

useEffect(() => {
  if (activeWindow) {
    const snapshot = JSON.stringify({
      header: activeWindow.header,
      joints: activeWindow.joints
    });
    setOriginalSnapshot(snapshot);
    setSyncStatus('synced');
  }
}, [activeWindow?.header.celda]);

// Cada vez que cambian header o joints, comparar contra snapshot
useEffect(() => {
  if (!activeWindow) return;
  const current = JSON.stringify({
    header: activeWindow.header,
    joints: activeWindow.joints
  });
  if (current !== originalSnapshot) {
    setSyncStatus('unsaved');
  } else {
    setSyncStatus('synced');
  }
}, [activeWindow]);
```

**Esto es robusto porque:**
- ✅ Detecta cualquier cambio (input text, select, alternativa, fila nueva).
- ✅ No depende de los handlers `onChange` (que pueden olvidar pasar algo).
- ✅ Si el usuario edita y después vuelve al valor original, el botón vuelve a "synced".
- ✅ Compara solo inputs del usuario, no sub-ratings autocalculados (que cambian pero no son "edición").

---

## 2. "Dureza" vs "Resistencia Estimada"

Decisión: ✅ **Llamaremos "Dureza" en la interfaz, fiel al Excel**.

**Acciónes inmediatas**:
- `RmrAnalysis.tsx`: label `COLUMN_LABELS.resistencia_ucs` cambiar de "Resistencia Estimada" a "Dureza".
- `geomecColumns.ts:64`: actualizar SSOT.
- En la tabla de valoración dinámica, el sub-rating sí puede seguir llamándose "Resistencia Estimada (Valor)" porque es el _número_ del rating, no el input del usuario.

---

## 3. Catálogo GSI Superficie — input text libre (pocos caracteres)

Decisión: ✅ **Mantener como input text con límite corto** (10-20 chars).

**Acciones**:
- `RmrAnalysis.tsx`: agregar `maxLength={20}` y `pattern="[A-Za-z]{1,20}"` al input de `gsi_superficie`.
- `models.VentanaRmrInput.gsi_superficie`: ya es `String(50)` — mantener.
- `GEMA.sql`: el campo está dentro de `VentanasMapeo` — proponer tipo `NVARCHAR(20) NULL`.
- Tooltip/ayuda: ayudar al usuario con sugerencias comunes.

---

## 4. Catálogo GSI Estructura — input text libre (pocos caracteres)

Decisión: ✅ **Mismo que 3** — input text con `maxLength={20}`.

---

## 5. Campaña — Tabla FK en BD (futura task)

Decisión: ✅ **Lo alineamos a `dbo.Campañas` de GEMA (tablas FK)**.

**Estado**:
- GEMA ya tiene `dbo.Campañas` con 8 registros (Campaña 2019 a 2026).
- El widget del frontend más adelante será un SELECT cargado desde el backend (`GET /api/catalogos/campanas`).

**Acción inmediata**: por ahora, mientras llega el análisis BD, dejamos el widget como **SELECT estático** con los 8 valores conocidos, hardcodeados en el frontend. Cuando se haga la migración a la nueva BD, se sustituye por un fetch al endpoint correspondiente.

```typescript
const CAMPANAS_HARD Toni = [
  { id: 1, label: "Campaña 2020" },
  { id: 2, label: "Campaña 2021" },
  { id: 3, label: "Campaña 2022" },
  { id: 4, label: "Campaña 2023" },
  { id: 5, label: "Campaña 2024" },
  { id: 6, label: "Campaña 2025" },
  { id: 7, label: "Campaña 2026" },
  { id: 8, label: "Campaña 2019" },
];
// VentanaForm select:
<select value={header.campania || ''} onChange={(e) => handleChange('campania', parseInt(e.target.value))}>
  <option value="">-- Campaña --</option>
  {CAMPANAS_HARDCODED.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
</select>
```

**Aviso importante**: el `header.campania` actual es un `int` año (2026). El GEMA es el `CampañaID` (1-8). **Al alinear, el valor cambia semánticamente**: ya no es "el año" sino "el ID de la fila en la tabla Campañas". Por eso lo más adecuado es guardar el ID y mostrar "Campaña 2026" como label.

---

## 6. Number de Estructuras vs NumeroEstructura — Explicación detallada

Esto es importante — hay **dos conceptos distintos** que tu mapeo menciona:

### 6.1 `NumeroEstructura` (mapeo.md línea 74)
> (no existe en el excel): NumeroEstructura {MAPEO POR VENTANA - REGISTRO DE DISCONTINUIDADES DE VENTANA}
> <Debe de autocompletarse, con 1,2,3,...,n dependiendo de su numero de fila en la tabla>

Esto es el **ordinal de la fila**: la 1ª estructura que registras es `NumeroEstructura=1`, la segunda `=2`, etc. Es solo un contador secuencial por ventana. Lo da el orden de la tabla de discontinuidades en la UI.

- En `GEMA.sql` ya existe como columna obligatoria `UNIQUE(VentanaID, NumeroEstructura)`.
- En `models.py` actual del backend se llama `orden_en_familia` (que es distinto — es ordinal **dentro de una familia**, no dentro de la ventana).
- En el frontend NO existe como input explícito — se ve como número de fila visual de la tabla.

**Acción**: 🎯 En la nueva BD debe llamarse `NumeroEstructura INT NOT NULL`, autocalculado al insertar (1, 2, 3, …). La UI no lo pide, lo asigna el backend según el orden del payload.

### 6.2 `NUMERO DE ESTRUCTURAS` (Excel BJ, mapeo.md sección 3, línea 99)
> (BJ) NUMERO DE ESTRUCTURAS: Debería de agregarse un campo NumeroEstructuras en la tabla mapeo.EstructurasGeologicas

Esto es **otra cosa**: es el **conteo de cuántas estructuras del mismo tipo/familia hay en esa celda**. Por ejemplo, si en la celda A1 hay 6 juntas (JN) en la familia 1 con espaciamiento 0.35 m, el campo `NUMERO DE ESTRUCTURAS` sería 6.

- En el backend actual (`models.py:56`) se llama `n_estructuras`.
- En el frontend (`JointRow.n_estructuras`) ya existe como input.
- En `GEMA.sql` NO existe — está marcado en mapeo.md sección 3 como "debería agregarse".

**Acción**: 🎯 En la nueva BD agregar columna `NumeroEstructuras INT NULL` a `EstructurasGeologicas`. La UI ya lo maneja, no requiere cambios de interfaz.

### 6.3 Resumen visual

```
EstructurasGeologicas (tabla)
├── EstructuraID               (PK, autocalculado)
├── VentanaID                  (FK)
├── NumeroEstructura           (1,2,3... por ventana — autocalculado ordinal)  ← 6.1
├── TipoEstructuraID           (FK al catálogo)
├── Dip, DipDir, ...
├── NumeroEstructuras          (cuántas estructuras de este tipo hay)          ← 6.2
└── ...
```

**¿Por qué es importante distinguirlos?**
- `NumeroEstructura` (singular) → "¿qué posición es esta fila dentro de la ventana?"
- `NumeroEstructuras` (plural) → "¿cuántas juntas hay en la familia/espaciamiento que esta fila representa?"

Actualmente el backend confunde ambos con `orden_en_familia` (que es un tercer concepto más — el ordinal dentro de la familia, no dentro de la ventana).

---

## 7. Acordiones vs Tabs — Explicación detallada

### 7.1 Acordeones (vertical collapsible)

```
┌─────────────────────────────────────────┐
│ ▼ DATOS DE REGISTRO                     │  ← clic para colapsar/expandir
├─────────────────────────────────────────┤
│  Celda: [A1]     Campaña: [2026 ▾]     │
│  Sector Geot: [NW1_B ▾]                │
│  ...                                    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ ▶ GEOMETRÍA Y COORDENADAS  (colapsado)  │  ← clic para expandir
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ ▶ LITOLOGÍA  (colapsado)                │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ ▼ ANÁLISIS RMR & GSI                    │
├─────────────────────────────────────────┤
│  ...                                    │
└─────────────────────────────────────────┘
```

**Pros**:
- ✅ Bajo impacto en el código actual — solo envolver cada bloque en un `<Collapsible>`.
- ✅ Mantiene todos los datos accesibles verticalmente.
- ✅ Aprovecha bien el scroll (en móvil funciona excelente).
- ✅ Coherente con `CommentsPhotos.tsx` que ya usa este patrón.

**Contras**:
- ❌ En desktop, la pantalla queda "larga" aunque colapses todo.
- ❌ El usuario tiene que hacer clic en cada título para abrir/cerrar (más clics).
- ❌ No hay "memoria visual" — al cerrar uno se olvida dónde estaba.

### 7.2 Tabs (pestañas horizontales)

```
┌─────────────────────────────────────────┐
│ [Datos Registro] [Geometría] [Litología]│
│ [Análisis RMR]  [Discontinuidades]      │  ← tabs horizontales
├─────────────────────────────────────────┤
│  Contenido de la tab activa aquí:       │
│                                         │
│  Celda: [A1]    Campaña: [2026 ▾]      │
│  Sector Geot: [NW1_B ▾]               │
│  ...                                    │
└─────────────────────────────────────────┘
```

**Pros**:
- ✅昼 Compacto — solo se ve una sección a la vez, poco scroll vertical.
- ✅ Navegación clara (clic en tab = switch instantáneo).
- ✅ Memorizable: "Análisis RMR está en la 4ª tab".
- ✅ Patrón moderno (Material, AntD, shadcn/ui).

**Contras**:
- ❌ Mayor impacto de código — hay que dividir cada sección en su propio componente.
- ❌ El usuario no puede ver dos secciones a la vez (ej: header + discontinuidades para validación cruzada).
- ❌ En pantallas pequeñas, las tabs se comprimen y se hace difícil navegar.

### 7.3 Mi recomendación: **Mixto según sección**

| Sección | Recomendación | Razón |
|---|---|---|
| `VentanaForm` (Datos de Registro) | **Acordiones** | El usuario completa por bloques pero puede saltar entre ellos. Los bloques son extensos, scroll es aceptable. |
| `RmrAnalysis` (RMR & GSI) | **3 tabs horizontales** | Es una tabla ancha + KPIs + inputs. Tabs para: "Inputs", "Tabla de Valoración", "KPIs y detalle". |
| `DisconTable` (tabla discontinuidades) | **Siempre visible** (no tabs ni accordion) | Es el corazón del mapeo; el usuario debe verla siempre cuando edita. |
| `CommentsPhotos` | **Acordeón** (ya lo es) | Confirmar el patrón actual. |

**Decisión sugerida**: 🎯 Acordiones en `VentanaForm`, tabs en `RmrAnalysis`.

---

## 8. Resumen de decisiones finales

| # | Decisión | Acción |
|---|---|---|
| 1 | Persistir sub-ratings patron **Hybrid Cache Writable** — backend recalcula, UI confía en BD al cargar, snapshot para detectar cambios | Implementar en backend + frontend |
| 2 | Llamar "Dureza" en la UI, fiel al Excel | Cambiar label |
| 3 | GSI Superficie: input text maxLength 20 | Sin select |
| 4 | GSI Estructura: input text maxLength 20 | Sin select |
| 5 | Campaña: SELECT estático hardcoded (8 campañas) de momento; futuro fetch a tabla FK en nueva BD | Implementar estático |
| 6.a | `NumeroEstructura` (singular) = ordinal de fila por ventana, autocalculado backend | Alinear |
| 6.b | `NumeroEstadísticas` (plural) = conteo de estructuras del mismo tipo, input del usuario | Alinear |
| 7 | Acordiones en `VentanaForm`, tabs en `RmrAnalysis`, DisconTable siempre visible | Implementar |

---

## 9. Próximos pasos propuestos

Ahora que confirmaste las decisiones, propongo este orden de ejecución (alineado con `ANALISIS_INTERFAZ.md`):

### FASE 1 (1 día) — Correcciones mínimas e irreversibles
- [ ] 1.1 Cambiar labels "Z" → "C" en coordenadas.
- [ ] 1.2 Cambiar labels "Largo (m)" → "Dist. Celda (m)".
- [ ] 1.3 Cambiar labels "Dip Hw°/Az Hw°" → "DIP°/AZ_HOLE°".
- [ ] 1.4 Cambiar label "Resistencia Estimada" → "Dureza".
- [ ] 1.5 Agregar SELECT Campaña (8 valores hardcodeados).
- [ ] 1.6 GSI Superficie/Estructura: `maxLength={20}`.
- [ ] 1.7 Verificar `JRC` (mapeo [1,20] vs UI [1,20]).

### FASE 2 (1 día) — Reorganización UX (acordiones + tabs)
- [ ] 2.1 VentanaForm → acordiones (Identificación, Geometría, Litología).
- [ ] 2.2 RmrAnalysis → 3 tabs (Inputs, Tabla, KPIs).
- [ ] 2.3 DisconTable → siempre visible, sin cambios.

### FASE 3 (1 día) — Botón Guardar robusto
- [ ] 3.1 Snapshot JSON al cargar ventana.
- [ ] 3.2 Comparar snapshot en cada render para detectar `unsaved`.
- [ ] 3.3 Refrescar `syncStatus` correctamente cuando se recupera de DB.

### FASE 4 (2 días) — Persistencia de sub-ratings (cuando la nueva BD esté lista)
- [ ] 4.1 Backend `calculator.py` revisar que devuelve sub-ratings por discontinuidad.
- [ ] 4.2 `save_ventana` recalcular y persistir sub-ratings por estructura (no solo por cabecera).
- [ ] 4.3 Frontend recibir sub-ratings del POST response y mergearlos al estado.

### FASE 5 (futura) — Migración real a GEMA / PostgreSQL
- [ ] Análisis profundo de GEMA + 8 tablas catalog.
- [ ] Construir nuevo `models.py` alineado a GEMA.
- [ ] Estrategia de migración de datos (SQLite/SQL Server Express → GEMA/Postgres).

---

## 10. Pregunta abierta que detecté

Como GEMA usa **FKs a catálogos con ID numéricos** (LitologiaID, SectorGeotecnicoID, TipoEstructuraID, etc.), pero el **frontend actual habla en códigos string** ("MZB", "NW1_B", "JN"):

- 🎯 **¿Cómo resolvemos esta traducción?** Hay dos estrategias:
  - **A) Frontend almacena códigos, backend traduce a IDs en el POST (lookup en catálogos)** — más simple para frontend.
  - **B) Frontend carga los catálogos completos con IDs y envía IDs en el payload** — más fiel a la BD.

Recomiendo **A**: el frontend sigue hablando en códigos (es lo que entiende el usuario y el Excel), y el backend traduce códigos→IDs antes de persistir. El endpoint `/api/catalogs/all` ya devuelve los códigos; podemos agregarle los `id` numéricos de GEMA cuando se haga la migración real.

¿Confirmas este enfoque o prefieres el B?