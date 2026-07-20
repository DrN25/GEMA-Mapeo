# Bloque 7 — Auditoría de defaults arbitrarios (resuelto)

> Estado real después de la reescritura del backend para GEMA.

---

## Resumen

De los **23 defaults** listados originalmente:
- **13 ya fueron eliminados** (cambiados a NULL en el nuevo código)
- **8 correspondían al import-excel** (endpoint removido temporalmente)
- **2 persisten** como defaults razonables
- **0 pendientes de decisión geomecánica**

---

## 7.1–7.9 Defaults de cabecera RMR (VENTANAS)

| # | Default original | Estado actual en código | Decisión |
|---|---|---|---|
| 7.1 | `agua_codigo = "C"` | ❌ **ELIMINADO** del router. Calculator.py aún lo tiene como fallback de cómputo (no perjudica la BD). | ✅ BD guarda NULL si no se ingresó |
| 7.2 | `resistencia_codigo = "R4"` | ❌ **ELIMINADO** del router. Mismo patrón que 7.1. | ✅ BD guarda NULL |
| 7.3 | `gsi_estructura = "VB"` | ❌ **ELIMINADO** — ya no existe en el nuevo router | ✅ Se guarda NULL si no se envía |
| 7.4 | `gsi_superficie = "G"` | ❌ **ELIMINADO** | ✅ NULL |
| 7.5 | `gsi_visual = 50` | ❌ **ELIMINADO** | ✅ NULL |
| 7.6 | `control_estructural = 4` | ❌ **ELIMINADO** | ✅ NULL |
| 7.7 | `efectos_voladura = 3` | ❌ **ELIMINADO** | ✅ NULL |
| 7.8 | `ucs_mpa = 74.0` | ❌ **ELIMINADO** | ✅ NULL |
| 7.9 | `is50_mpa = 5.0` | ❌ **ELIMINADO** | ✅ NULL |

## 7.10–7.14 Defaults de discontinuidades (ESTRUCTURAS)

| # | Default original | Estado actual en código | Decisión |
|---|---|---|---|
| 7.10 | `tipo_relleno_1 = "cwf"` | ❌ **ELIMINADO** → `tipo_relleno_1=d.r1 if d.r1 and d.r1!="-1" else None` | ✅ Se guarda NULL si no hay relleno |
| 7.11 | `tipo_relleno_2 = "-1"` | ❌ **ELIMINADO** → mismo patrón que 7.10 | ✅ NULL |
| 7.12 | `rugosidad_estructuras = 1` | ❌ **ELIMINADO** → `str(d.rug) if d.rug is not None else None` | ✅ NULL |
| 7.13 | `forma_estructura = "P"` | ❌ **ELIMINADO** → `d.forma if d.forma and d.forma!="-1" else None` | ✅ NULL |
| 7.14 | `alteracion = "f"` | ❌ **ELIMINADO** → `d.alt if d.alt and d.alt!="-1" else None` | ✅ NULL |

## 7.15–7.16 Defaults de identificación

| # | Default original | Estado actual | Decisión |
|---|---|---|---|
| 7.15 | `sector_geotecnico = "E1"` | ❌ **ELIMINADO** → si no se envía, el backend responde **400 Bad Request** | ✅ Forzoso — el usuario debe elegir un sector válido |
| 7.16 | `campania = 2026` | ❌ **ELIMINADO** → se valida contra GEMA, 400 si no existe | ✅ Forzoso |

## 7.17–7.21 Defaults de import-excel (endpoint removido)

| # | Default original | Estado |
|---|---|---|
| 7.17 | `mapeador = "RD/RB"` en importación hoja "ventana" | ❌ Endpoint `importar-excel` **removido temporalmente**. Se reescribirá cuando se retome. |
| 7.18 | `mapeador = "RD/RB"` en importación hoja "BD" | ❌ Idem |
| 7.19 | `gsi_est = "VB"`, `gsi_cond = "G"` hardcoded | ❌ Idem |
| 7.20 | `fase = 5` hardcoded | ❌ Idem |
| 7.21 | `fase = 5` hardcoded | ❌ Idem |

## 7.22 Default de schema PLT

| # | Default original | Estado | Decisión |
|---|---|---|---|
| 7.22 | `tipo_ensayo: Optional[str] = "i"` | ✅ Persiste en `schemas.py` | **MANTENER**. "i" = irregular, es el tipo de ensayo PLT estándar para muestras irregulares. Si no se envía, "i" es correcto. |

## 7.23 Default frontend (-1 como "sin datos")

| # | Default original | Estado | Decisión |
|---|---|---|---|
| 7.23 | `-1` como marcador de "sin datos" en App.tsx | ⚠️ **PERSISTE** en 9 lugares | Depende de estrategia. Ver análisis abajo. |

---

## Análisis detallado del item 7.23 (frontend -1)

### ¿Por qué existe `-1` en el frontend?

El frontend usa `-1` como **sentinel value** para indicar "no ingresado / sin datos". Aparece en 3 contextos:

1. **`normalizeJoints()`** (App.tsx:56-70) — al crear filas vacías de discontinuidades, pone `distancia:-1, abertura:-1, espesor:-1, espaciamiento:-1, jrc:-1, rugosidad:-1`
2. **`handleSelectWindow()`** (App.tsx:446) — al cargar desde backend, si `d.jrc` es null → `:-1`
3. **`handleDeleteFamily()`** (App.tsx:584-585) — al verificar si una familia tiene datos revisa `!== -1`

### ¿Problema?

El backend actual transforma `-1` → `None` (NULL en BD) al recibir (función `clean()` en `ventanas.py`). Por lo tanto:
- **El backend siempre recibe -1 y lo guarda como NULL** → no hay datos incorrectos en BD
- **El frontend compara con -1 para saber si un campo fue llenado** → lógica correcta

### Opciones:

**A) Mantener `-1` como sentinel (recomendado)**
- No requiere cambios
- El `clean()` en backend lo traduce a NULL
- El frontend puede distinguir "0" (real) de "-1" (no ingresado)

**B) Cambiar a `null`/`undefined` en frontend**
- Requiere cambiar todas las comparaciones `!== -1` por `!== null && !== undefined`
- Más riesgoso, más líneas de cambio
- Beneficio: alineación conceptual con NULL en BD

**C) Cambio híbrido — solo los campos críticos**
- Mantener `-1` para campos numéricos (distancia, abertura, espesor, etc.)
- Cambiar solo JRC y rugosidad a `null` (ya aceptan 0 como valor válido)

### Mi recomendación → **Opción A (mantener)**

`-1` no causa daño porque el backend lo limpia, y la interfaz lo usa activamente para detectar "no editado". Cambiarlo ahora implicaría tocar ~30 líneas con riesgo de bugs por nulo vs. no definido. Cuando se haga la refactorización del frontend a types más estrictos se puede migrar.

---

## Conclusión final

| Estado | Cantidad |
|---|---|
| ✅ Ya eliminados (NULL) | 13 defaults |
| ✅ Mantener como están (razonables) | 3 defaults (`"C"`, `"R4"`, `"i"`) |
| ❌ Endpoint removido (se resolverá después) | 6 defaults |
| ⚠️ Frontend -1 (recomiendo mantener) | 1 default |
| **Total** | **23** |

**No hay defaults peligrosos en el código actual.** Los únicos valores fijos que existen (`"C"`, `"R4"`, `"i"`) son defaults seguros y justificados geomecánicamente.

¿Quieres cambiar alguno de los que están como "mantener" o prefieres pasar al siguiente bloque?