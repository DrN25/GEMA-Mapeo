# Dashboard v2 — Análisis completo + Plan de rediseño

> Objetivo: mejorar el dashboard para 7,454+ celdas con paginación, filtros
> temporales y KPIs contextuales. Antes de codear, se hace análisis a fondo.

---

## 1. Análisis detallado del Dashboard actual (`Dashboard.tsx`)

### 1.1 Header / Banner (`líneas 144-171`)
**Función**: título "Mapeo Geomecánico de Ventanas de Detalle" + 2 botones (Importar Excel + Nueva Celda).

| Aspecto | Estado | Issue |
|---|---|---|
| Botones siempre visibles | ✅ | OK |
| Título estático | ✅ | OK |
| Sin breadcrumb de usuario actual | ⚠️ | No hay usuario activo visible |
| Sin estado de carga | ⚠️ | Mientras cargan 7,454 celdas, no hay skeleton |
| Botones primary/secondary mezclados | ⚠️ | Importar (emerald) y Nueva (violet) compiten visualmente |

### 1.2 KPI Cards (`líneas 174-226`) — 5 tarjetas

| Card | Cálculo actual | Issue crítico |
|---|---|---|
| **Fecha de Hoy** | Estática `new Date()` al render | ❌ No es interactiva — no permite navegar a ayer/semana |
| **Total Celdas** | `windows.length` (7,454) | ❌ Siempre muestra total, **sin reflejar filtros**. Usuario puede pensar "hoy creé 7,454" |
| **Avance Escaneado** | `windows.reduce((acc, w) => acc + w.largo, 0)` | ❌ Pero `w.largo` está **hardcodeado a 5 en App.tsx:259** cuando no viene del backend → 7,454 × 5 = 37,270 m (ficticio) |
| **RMR Promedio** | `rmr_89` promedio | ❌ Pero `rmr_89` está **hardcodeado a 65 en App.tsx:263** → siempre muestra 65 |
| **Último Mapeador** | `windows[windows.length - 1].geologo` | ❌ Asume ordenamiento cronológico — el backend NO ordena por fecha. Además `geologo` viene como `null` en el summary actual (verificado). |

**Veredicto KPIs**: tres de cinco cards muestran **información incorrecta o falsa**. Esto es el bug más serio porque el usuario ve números y cree他们是 reales.

### 1.3 Search Filter (`líneas 230-239`)
- Solo input de texto para filtrar por `name.toLowerCase().includes(search)`.
- Sin filtros por: fecha, mapeador, sector, campaña, RMR.
- No hay estado guardado entre sesiones.
- No combina filtros AND/OR.
- No busca por sector o fecha.

### 1.4 Tabla de Celdas (`líneas 241-308`) — **el problema principal**

| Aspecto | Estado | Issue |
|---|---|---|
| Render de filas | 7,454 filas al mismo tiempo | 🚨 **Colapso de performance** — DOM gigante, lag al scrollear, lag al buscar |
| Paginación | **NO HAY** | 🚨 El usuario pide explícitamente paginación |
| Sorting | No implementado | No se puede hacer click en header para ordenar |
| Columnas mostradas | Celda, Largo, Altura, Mapeador, RMR89, Clase, Acciones | ❌ **Falta Fecha** (crítico para filtros temporales), **falta Sector**, falta Campaña |
| `class_89` | Hardcodeado a "Regular" en App.tsx:264 | ❌ Siempre dice "Regular" sin importar el RMR real |
| `largo` | Default a 5 si no viene del backend | ❌ Datos ficticios |
| `Altura` | Default a 15.0 | ❌ Datos ficticios |
| Url de celda | Click dirige a `onSelectWindow(w.name)` con `w.name` | ✅ Bien |
| Botón Eliminar con confirm() | Dialog JS nativo | ⚠️ No coherente con el resto (usa `confirm()` browser) |
| Sin selección múltiple | Solo una celda a la vez | No permite selección para acciones batch |

### 1.5 Modal Nueva Celda (`líneas 311-546`)

| Aspecto | Estado | Issue |
|---|---|---|
| 15+ useState en el Dashboard | Code smell | Debiera ser componente separado |
| Default `dip_talud: 64.0` | Hardcodeado | Quizá OK como default |
| Sector como input text | No validado | ❌ Debería ser select con catálogo de GEMA |
| Mapeador como input text | No validado | ❌ Debería ser select con geotécnicos de GEMA (273 personas) |
| Campaña como "año" (texto) | Inconsistente | ❌ Ahora es ID de campaña en GEMA (1-8) |
| Calculado automatic de largo | OK | ✅ |
| Duplica VentanaForm.tsx | Mantenimiento | ❌ Lógica de coords + handleNumberInputLimit duplicada |
| Default `sector: ""` y `sect_geot: secs` | Confuso | Dos campos con el mismo dato |

### 1.6 Bugs detectados en `App.tsx` (alimentación)

Revisé `App.tsx:250-280` y encontré:

```typescript
const summaries: WindowSummary[] = data.map((v: any) => ({
  name: v.codigo,
  proyecto: "Proyecto A",                    // ⚠️ hardcoded
  geologo: v.mapeador || "N/A",              // OK
  largo: v.largo_m !== null && ... ? ... : 5, // ❌ default 5 ficticio
  altura: v.altura_m || 15.0,                // ❌ default 15 ficticio
  fecha_registro: v.fecha_mapeo || new Date().toISOString().split('T')[0],  // OK
  rmr_76: 60,                                // ❌ hardcoded
  rmr_89: 65,                                // ❌ hardcoded
  class_89: "Regular"                        // ❌ hardcoded
}));
```

**Esto significa**: el frontend carga 7,454 celdas pero luego las pinta con valores inventados. Todo RMR/rmr_promedio/largo total/categoría están mal porque el `VentanaSummarySchema` del backend NO envía `largo_m`, `altura_m`, `rmr_76`, `rmr_89` (las mandamos como campos separados — ver backend `schemas.py`).

---

## 2. UX insights del flujo real de trabajo (lo que pidió el usuario)

| Caso de uso | Frecuencia | Celdas típicas | Requerimiento |
|---|---|---|---|
| **Crear celdas del día** | Diaria | 10-20 al día | Modal rápido, default día actual |
| **Ver celdas de HOY** | Muy frecuente | 10-20 | Filtro "Hoy" instantáneo, KPIs solo de hoy |
| **Ver celdas de ayer** | Frecuente | 10-20 | Filtro "Ayer" rápido (1 click) |
| **Ver semana actual** | Ocasional | 50-100 | Filtro "Esta semana" |
| **Ver mes actual** | Raro | 200-400 | Filtro "Este mes" |
| **Ver año actual** | Menos común | 1,000-3,000 | Paginación obligatoria + filtros extra |
| **Ver todo histórico** | Poco común | 7,454 | Paginación + filtros + export |
| **KPIs contextualizados** | Siempre | — | Usuario debe saber SIEMPRE a qué rango corresponden los KPIs |
| **Evitar malinterpretación** | Crítico | — | Etiquetas claras: "KPIs sobre las N celdas filtradas de M totales" |

**Insight clave**: el usuario necesita **transparencia total** sobre qué datos está mirando:
- KPIs deben mostrar "de **N celdas filtradas** de **M total**"
- Header debe decir explicitamente qué rango temporal está activo
- Botón para "resetear a todos" siempre visible

---

## 3. Requisitos funcionales del nuevo Dashboard

### RF-1 Paginación
- [ ] Backend endpoint con parámetros `page`, `page_size`, `order_by`, `order_dir`
- [ ] Frontend con `< ... 5 6 [7] 8 9 ... >`
- [ ] Page size configurable: 20, 50, 100, 200
- [ ] Atajo: mostrar "1 al 20 de 7,454"
- [ ] Mantener selección al cambiar de página

### RF-2 Filtros temporales rápidos
- [ ] Chips de un solo click: **Hoy | Ayer | Esta semana | Este mes | Este año | Todo**
- [ ] "Hoy" es el default al iniciar
- [ ] Al cambiar chip:
  - Backend recibe `fecha_desde`/`fecha_hasta` (ISO 8601)
  - Frontend repinta KPIs sobre el subconjunto
  - Etiqueta visible de "X celdas en el rango Y"

### RF-3 Filtros avanzados
- [ ] Por sector geotécnico (select)
- [ ] Por mapeador/geotecnico (select con 273 opciones + searchable)
- [ ] Por campaña (select con 8 campañas)
- [ ] Por rango de RMR (slider dual 0-100)
- [ ] Por código (buscar exacto o `ILIKE`)
- [ ] Combina todos los filtros (AND)

### RF-4 KPIs contextuales
- [ ] Cada KPI muestra debajo: "Sobre N celdas (de M totales)"
- [ ] Cambia automáticamente al activar filtros temporales/avanzados
- [ ] Tooltip informativo explicando qué significa
- [ ] Highlight visual si los KPIs están mostrando un subconjunto (no todo)

### RF-5 Tabla mejorada
- [ ] Columnas adicionales: Fecha, Sector, Campaña
- [ ] Sorting click en header (asc/desc/none)
- [ ] Selección múltiple con checkboxes
- [ ] Acciones batch: Eliminar seleccionadas, Exportar seleccionadas
- [ ] Indicador visual de que existe bloque seleccionado

### RF-6 Drawer / Panel lateral de detalle
- [ ] Al hacer hover o click en una fila, drawer con info completa (sin salir del dashboard)
- [ ] Botón "Mapear" y "Eliminar" persisten como acciones
- [ ] Foto preview si existe

### RF-7 Performance
- [ ] Virtualización de filas (react-window o @tanstack/react-virtual) si se muestran >50
- [ ] Memoización con `React.memo` de filas
- [ ] Backend con índice en `fecha_mapeo` y en `codigo_celda` (ya creado)
- [ ] Backend no enviar sub-ratings completos en el summary — solo cabecera

### RF-8 Correcciones de bugs (PRIORIDAD 0)
- [ ] **RF-8.1** Eliminar hardcodeos en App.tsx:262-264 (`rmr_76=60, rmr_89=65, class_89="Regular"`)
- [ ] **RF-8.2** Backend `VentanaSummarySchema` debe enviar `rmr_76`, `rmr_89` reales (ya los envía, usarlos)
- [ ] **RF-8.3** Backend GET /ventanas debe ordenar por `fecha_mapeo DESC` por default
- [ ] **RF-8.4** Backend GET /ventanas debe soportar `?page=1&page_size=20&order_by=fecha&order_dir=desc`
- [ ] **RF-8.5** Frontend `largo` default 5 y `altura` default 15.0 → usar valores reales del backend

### RF-9 Modal Nueva Celda refactor
- [ ] Convertir a componente séparado `CreateWindowModal.tsx`
- [ ] Sector → SELECT de catálogo (20 opciones)
- [ ] Mapeador → SELECT de catálogo (273 geotécnicos)
- [ ] Campaña → SELECT de catálogo (8 campañas)
- [ ] Default `fecha_mapeo` = día actual
- [ ] Default `turno`学习 desde localStorage (recordar último)

### RF-10 Feedback visual
- [ ] Skeletons durante carga inicial
- [ ] Indicador de "Cargando página N"
- [ ] Banner de avisos: "Mostrando N celdas de M. KPIs recalculados sobre este subconjunto."
- [ ] Empty state ilustrado cuando no hay celdas en el rango

---

## 4. Arquitectura propuesta

### 4.1 Backend cambios
**Nuevo endpoint GET /api/ventanas** con query params:

```
GET /api/ventanas?page=1&page_size=20
                  &order_by=fecha_mapeo&order_dir=desc
                  &fecha_desde=2026-07-19&fecha_hasta=2026-07-19
                  &sector=NW1_B&mapeador=SRK
                  &campania=2
                  &rmr_min=20&rmr_max=80
                  &q=A1
                  &include_kpis=true
```

**Respuesta**:
```json
{
  "items": [
    { "codigo": "A1", "fecha_mapeo": "2021-08-31", ... }
  ],
  "total": 7454,
  "total_filtered": 18,
  "page": 1,
  "page_size": 20,
  "total_pages": 373,
  "kpis": {
    "celdas_count": 18,
    "total_celdas": 7454,
    "largo_total_m": 270.0,
    "rmr76_promedio": 55.6,
    "rmr89_promedio": 60.3,
    "mapeador_reciente": "SRK",
    "fecha_min": "2021-08-31",
    "fecha_max": "2026-07-19"
  }
}
```

**Endpoints auxiliares**:
- `GET /api/filtros/opciones` → devuelve `{sectores: [], mapeadores: [], campanias: []}` para popular selects.

### 4.2 Frontend cambios

**Estructura de componentes nuevos**:
```
Dashboard/
  Dashboard.tsx              ← actual, refactorizado
  DashboardHeader.tsx       ← Nuevo: banner + filtros rápida (chips)
  DashboardKPIs.tsx         ← Nuevo: 5 KPIs contextuales
  DashboardFilters.tsx      ← Nuevo: filtros avanzados collapsable
  DashboardTable.tsx        ← Nuevo: tabla paginada con sorting + selección
  DashboardPagination.tsx   ← Nuevo: paginación clásica 1 2 3 ... N
  DashboardEmptyState.tsx   ← Nuevo: empty/ilustrado
  CreateWindowModal.tsx     ← Extraído: modal nueva celda
  types.ts                  ← Tipos nuevos (resumen, filtros, kpis)
```

### 4.3 Estado compartido

```typescript
interface DashboardState {
  // Paginación
  page: number;
  pageSize: number;
  total: number;  // total DB
  totalFiltered: number;  // tras filtros
  
  // Sort
  orderBy: 'fecha_mapeo' | 'codigo' | 'rmr_89' | 'largo';
  orderDir: 'asc' | 'desc';
  
  // Filtros temporales (chips)
  dateRange: 'hoy' | 'ayer' | 'semana' | 'mes' | 'ano' | 'todo' | 'custom';
  customDateFrom?: string;
  customDateTo?: string;
  
  // Filtros avanzados
  search: string;
  sector?: string;
  mapeador?: string;
  campania?: number;
  rmrMin?: number;
  rmrMax?: number;
  
  // Data
  items: WindowSummary[];
  kpis: DashboardKPIs;
  loading: boolean;
}
```

---

## 5. Decisiones de UX/UI críticas (necesito tu respuesta)

### D1 — Default al abrir el dashboard
- **D1.A (Recomendada)**: Default `Hoy` — si no hay celdas hoy, empty state con CTA "Crear celda de hoy" (alineado con workflow real).
- **D1.B**: Default `Todo` — usuario arranca con la vista completa historica.

### D2 — Tipo de paginación
- **D2.A**: Clásica `1 2 3 ... N` con botones (familiar, simple).
- **D2.B**: Scroll infinito (lazy load al final) — más fluido pero requiere virtual scroll.
- **D2.C**: Híbrida: scroll infinito dentro de cada chip temporal (Hoy → 10 celdas load todas, but Todo → paginación).

### D3 — KPIs cuando filtro activo
- **D3.A (Recomendada)**: KPIs siempre reflejan el subconjunto filtrado + mensaje "Sobre N celdas de M".
- **D3.B**: Dos filas de KPIs — fila 1 = hoy/seleccionado, fila 2 = histórico total.

### D4 — Modal Nueva Celda
- **D4.A**: Dejarlo inline en Dashboard pero fijarlo como componente separado.
- **D4.B**: Moverlo a su propia ruta modal `/dashboard/nueva`.

### D5 — ¿Cuándo recalcular KPIs?
- **D5.A (Recomendada)**: Backend calcula KPIs en la misma query paginada (con `include_kpis=true`) — simple.
- **D5.B**: Frontend recalcula KPIs desde `items` (incorrecto porque solo tiene la página actual).
- **D5.C**: Llamada separada `GET /api/kpis?filtros=...`.

### D6 — Persistencia de filtros
- **D6.A**: localStorage guarda el último rango temporal (ej. siempre abrir en "Hoy").
- **D6.B**: Cada sesión abre con default "Hoy" sin memoria.

### D7 — Búsqueda por código
- **D7.A**: Buscar solo en la página actual (rápido pero inútil si buscas "A1000" y estás en pág 1).
- **D7.B (Recomendada)**: Backend search traerá las coincidencias + resetea page=1.

### D8 — Selección múltiple
- **D8.A (Recomendada)**: Checkboxes en cada fila + acciones batch (Eliminar, Exportar).
- **D8.B**: Sin selección, un clik por vez (estilo actual).

---

## 6. Plan de implementación por fases

### 🔧 FASE A — Bug fixes críticos (PRIORIDAD 0) — 0.5 día
Antes de cualquier cosa nueva, arreglar el bug de datos inventados.

- [ ] A.1 Quitar hardcodeos en `App.tsx:262-264` (`rmr_76=60, rmr_89=65, class_89="Regular"`).
- [ ] A.2 Backend `VentanaSummarySchema` ya envía `rmr_76`, `rmr_89`, `mapeador`, `fecha_mapeo`. Mapearlos correctamente en frontend.
- [ ] A.3 Backend: `get_ventanas` ordenar por `fecha_mapeo DESC, ventana_id DESC`.
- [ ] A.4 Clase verbal (`class_89`) — derivar en frontend desde `rmr_89` (ver algoritmo RMR).
- [ ] A.5 Si `largo` viene NULL del backend, mostrar "—" en vez de 5.0 ficticio.

### 🎨 FASE B — Backend paginado (PRIORIDAD 1) — 1 día
- [ ] B.1 Modificar `get_ventanas` para aceptar `page, page_size, order_by, order_dir, fecha_desde, fecha_hasta, sector, mapeador, campania, q, rmr_min, rmr_max, include_kpis`.
- [ ] B.2 Implementar query con SQLAlchemy:
  ```python
  query = db.query(Ventana)
  if fecha_desde: query = query.filter(Ventana.fecha_mapeo >= fecha_desde)
  if fecha_hasta: query = query.filter(Ventana.fecha_mapeo <= fecha_hasta)
  if sector_code: query = query.join(SectorGeotecnico).filter(SectorGeotecnico.codigo == sector_code)
  # ... etc
  total_filtered = query.count()
  items = query.order_by(...).offset((page-1)*page_size).limit(page_size).all()
  ```
- [ ] B.3 Respuesta nueva estructura: `{items, total, total_filtered, page, total_pages, kpis}`.
- [ ] B.4 Crear endpoint `GET /api/filtros/opciones` que devuelva catálogos para popular selects.

### 🎨 FASE C — Refactor estructura frontend (PRIORIDAD 1) — 1 día
- [ ] C.1 Crear `Dashboard/types.ts` con interfaces nuevas.
- [ ] C.2 Extraer `CreateWindowModal.tsx` como componente independiente (~250 líneas salen de Dashboard).
- [ ] C.3 `Dashboard.tsx` queda como orchestrer (state management + layout), delega a subcomponentes.

### 🎨 FASE D — Filtros temporales chips (PRIORIDAD 1) — 1 día
- [ ] D.1 Componente `DashboardFiltersChips.tsx: [Hoy | Ayer | Esta semana | Este mes | Este año | Todo]`.
- [ ] D.2 Lógica de calcular `fecha_desde`/`fecha_hasta` según chip.
- [ ] D.3 Estado persistente en localStorage.

### 🎨 FASE E — KPIs contextuales (PRIORIDAD 1) — 0.5 día
- [ ] E.1 `DashboardKPIs.tsx` con 5 cards: Fecha activa, Total celdas (filtered/total), Largo total, RMR promedio, Último mapeador.
- [ ] E.2 Cada card muestra debajo: "Sobre N celdas (M totales)".
- [ ] E.3 Highlight si `N !== M` (subconjunto activo).

### 🎨 FASE F — Tabla + Sort + Paginación (PRIORIDAD 1) — 1.5 días
- [ ] F.1 `DashboardTable.tsx` con columnas: ☐ | Celda | Fecha | Sector | Mapeador | Largo | Altura | RMR89 | Clase | Acciones.
- [ ] F.2 Header click → ordena + envía a backend con `order_by` cambiado.
- [ ] F.3 Filas clickable + botón Eliminar confirm (reemplazar `confirm()` browser.
- [ ] F.4 `DashboardPagination.tsx`: `< [1] 2 3 ... 374 >` + page size selector.
- [ ] F.5 Selección múltiple con checkbox + barra de acciones batch al pie.

### 🎨 FASE G — Filtros avanzados (PRIORIDAD 2) — 1 día
- [ ] G.1 Drawer "Filtros avanzados" con sector/mapeador/campaña/rango RMR + búsqueda por texto.
- [ ] G.2 Chip "Filtros aplicados" con X para quitar individualmente.
- [ ] G.3 Botón "Limpiar todo" (devuelve a default "Hoy").

### 🎨 FASE H — Performance / Virtualización (PRIORIDAD 3) — 0.5 día
- [ ] H.1 Si `page_size > 50`, usar `@tanstack/react-virtual` para filas.
- [ ] H.2 `React.memo` en filas con prop comparison.
- [ ] H.3 Debounce en input de búsqueda (250ms).

### 🎨 FASE I — Toasts / Feedback (PRIORIDAD 3) — 0.5 día
- [ ] I.1 Skeleton durante carga inicial.
- [ ] I.2 Toast verde "+ Celda Z1 creada".
- [ ] I.3 Banner informativo en el header "Mostrando N celdas de M totales".

---

## 7. Tiempo total estimado

| Fase | Tiempo | Resultado visible |
|---|---|---|
| A (bug fixes) | 0.5 día | KPIs correctos |
| B (backend paginado) | 1 día | Endpoint nuevo |
| C (refactor frontend) | 1 día | Estructura clara |
| D (chips temporales) | 1 día | UX real |
| E (KPIs contextuales) | 0.5 día | Transparencia |
| F (tabla+sort+pag) | 1.5 día | **PETAZO principal** |
| G (filtros avanzados) | 1 día | Filtros completos |
| H (virtualización) | 0.5 día | Performance |
| I (toasts/skeletons) | 0.5 día | Pulido |
| **Total** | **~7.5 días** | Dashboard v2 completo |

Puede entregarse por incrementos:
- **Sprint 1 (1.5 días)**: A + B = backend funciona, datos correctos, paginable.
- **Sprint 2 (1.5 días)**: C + D + E = UX mejorada, chips + KPIs contextuales.
- **Sprint 3 (1.5 días)**: F = tabla presentación+sort+pag visible.
- **Sprint 4 (1.5 días)**: G = filtros avanzados.
- **Sprint 5 (1 día)**: H + I = pulido final.

---

## 8. Decisiones pendientes (necesito tu respuesta)

1. D1: Default "Hoy" o "Todo" al abrir.
2. D2: Paginación clásica (1 2 3 ... N), scroll infinito, o híbrida.
3. D3: KPIs siempre sobre subconjunto, o dos filas (subconjunto + histórico).
4. D4: Modal nueva celda → separa en archivo, su propio componente, o ruta.
5. D5: KPIs: backend calcula, frontend calcula, o llamada separada.
6. D6: localStorage para recordar último rango temporal.
7. D7: Búsqueda busca en backend (busca en todos los registros) o solo en página actual.
8. D8: Selección múltiple con acciones batch (Eliminar, Exportar) o sin selección.

¿Quieres que arranque por **FASE A** (bug fixes críticos, 0.5 día/bloque) para tener KPIs correctos lo antes posible, o prefieres esperar a que confirmes las 8 decisiones antes de tocar código?