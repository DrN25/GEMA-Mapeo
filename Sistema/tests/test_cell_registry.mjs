/**
 * test_cell_registry.mjs — Regresión del bug "TEST_004 y TEST_004 IMPORTADO".
 *
 * Escenario del usuario:
 *   - TEST_004 ya existe en la base de datos (knownFromDb)
 *   - Se importa un Excel con una celda del mismo nombre → queda pendiente
 *     (geolog_unsaved_windows + caché) SIN crear una celda nueva
 *   - El Dashboard NO debe mostrar 2 filas: la pendiente que existe en BD se
 *     marca sobre su fila normal (badge PENDIENTE), no como fila BORRADOR aparte
 *
 * Antes de correrlo, el runner ejecuta tsc para compilar los módulos TS a CJS.
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(TESTS_DIR, '..', 'frontend');
const CACHE = path.join(TESTS_DIR, '.cache');

// 1. Compilar los módulos TS necesarios a CJS (una sola vez por corrida)
if (!existsSync(path.join(CACHE, 'utils', 'cellRegistry.js')) || !existsSync(path.join(CACHE, 'utils', 'mandatoryRules.js'))) {
  execSync(
    `npx tsc src\\utils\\cellRegistry.ts src\\utils\\storageManager.ts src\\config\\storage.ts src\\utils\\mandatoryRules.ts ` +
    `--module commonjs --outDir ${CACHE} --target es2022 --skipLibCheck --esModuleInterop --ignoreConfig --types react`,
    { cwd: FRONTEND, stdio: 'inherit' }
  );
}

// 2. Mock de localStorage (Map en memoria)
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const require = createRequire(import.meta.url);
const cr = require(path.join(CACHE, 'utils', 'cellRegistry.js'));
const sm = require(path.join(CACHE, 'utils', 'storageManager.js'));
const mr = require(path.join(CACHE, 'utils', 'mandatoryRules.js'));

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ ${msg}`); }
};

const CELDA_BD = 'TEST_004';      // existe en BD (listado del dashboard)
const CELDA_LOCAL = 'TEST_LOCAL_X'; // borrador local puro (no existe en BD)
const snapshot = JSON.stringify({ header: { celda: CELDA_BD, fecha: '05/08/2026', mapeador: 'P. TEST', sector: 'Sector A' } });

// 3. Preparar estado: TEST_004 pendiente (import con nombre duplicado) + borrador puro
sm.addPendingCell(CELDA_BD);
sm.safeSetItem(`geolog_window_${CELDA_BD}`, snapshot, { activeCelda: CELDA_BD });
sm.addPendingCell(CELDA_LOCAL);
sm.safeSetItem(`geolog_window_${CELDA_LOCAL}`, JSON.stringify({ header: { celda: CELDA_LOCAL, fecha: '05/08/2026', mapeador: 'P. TEST' } }), { activeCelda: CELDA_LOCAL });

console.log('\n📋 Escenario del usuario: TEST_004 existe en BD y quedó pendiente tras importar\n');

// A) Nombres de todas las pendientes (para el badge en la fila normal)
const pendingNames = cr.getPendingCellNames();
ok(pendingNames.includes(CELDA_BD), `getPendingCellNames() incluye ${CELDA_BD} (badge PENDIENTE en su fila normal)`);
ok(pendingNames.includes(CELDA_LOCAL), `getPendingCellNames() incluye ${CELDA_LOCAL}`);

// B) La clave del fix: resúmenes para el Dashboard = solo las que NO existen en BD
const dbNames = [CELDA_BD];
const localOnly = cr.getLocalOnlyPendingSummaries(dbNames);
ok(!localOnly.some(pc => pc.name.trim().toUpperCase() === CELDA_BD),
  `El Dashboard NO muestra fila BORRADOR para ${CELDA_BD} (existe en BD) → no se duplica "TEST_004 / TEST_004 IMPORTADO"`);
ok(localOnly.some(pc => pc.name === CELDA_LOCAL),
  `El Dashboard SÍ muestra fila BORRADOR para ${CELDA_LOCAL} (borrador puro)`);
ok(localOnly.length === 1, `Solo hay 1 fila BORRADOR en el Dashboard (${localOnly.length} fila(s))`);

// C) Compatibilidad: sin listado de BD (p. ej. dashboard sin fetch), se muestran todas
const allSummaries = cr.getLocalOnlyPendingSummaries([]);
ok(allSummaries.length === 2, `Sin listado de BD se muestran las ${allSummaries.length} pendientes (retrocompatible)`);

// D) El resumen construye datos correctos desde el caché
const sumBd = allSummaries.find(pc => pc.name === CELDA_BD);
ok(sumBd && sumBd.geologo === 'P. TEST' && sumBd.fecha_mapeo === '05/08/2026',
  'El resumen lee geólogo/fecha desde el caché');

// E) Case-insensitive: TEST_004 / test_004 son la misma celda
ok(!cr.getLocalOnlyPendingSummaries(['test_004']).some(pc => pc.name === CELDA_BD),
  'La comparación con la BD ignora mayúsculas (test_004 === TEST_004)');

// F) Descarte total: al descartar se limpia lista + caché + validación
cr.setCellValidation(CELDA_LOCAL, ['issue de prueba']);
cr.discardLocalCell(CELDA_LOCAL);
ok(!cr.getPendingCellNames().includes(CELDA_LOCAL), 'discardLocalCell quita la celda de la lista de pendientes');
ok(!store.has(`geolog_window_${CELDA_LOCAL}`), 'discardLocalCell elimina el caché de la celda');
ok(cr.getCellValidation(CELDA_LOCAL) === null, 'discardLocalCell limpia su validación QA/QC');

console.log('\n📋 Regla de bloqueo del guardado (solo CRITICA/VACIO; ADVERTENCIA no bloquea)\n');

// G) Severidades: el bug reportado (RTF_001 con 3 "problemas" que eran advertencias)
ok(mr.isBlockingValidationAlert('CRITICA') === true, 'CRITICA bloquea el guardado');
ok(mr.isBlockingValidationAlert('VACIO') === true, 'VACIO (campo obligatorio sin llenar) bloquea el guardado');
ok(mr.isBlockingValidationAlert('ADVERTENCIA') === false, 'ADVERTENCIA NO bloquea el guardado');
ok(mr.isBlockingValidationAlert(undefined) === false, 'Alerta sin tipo no bloquea (conservador)');

// H) Simulación del flujo real de App.tsx: las alertas se filtran con
//    isBlockingValidationAlert ANTES de persistir. Celda con solo advertencias
//    → se persisten 0 mensajes → no aparece como inválida (ya no bloquea).
const alertsSoloAdvertencias = [
  { type: 'ADVERTENCIA', message: 'Advertencia 1' },
  { type: 'ADVERTENCIA', message: 'Advertencia 2' },
  { type: 'ADVERTENCIA', message: 'Advertencia 3' },
];
sm.addPendingCell(CELDA_BD);
cr.setCellValidation(CELDA_BD,
  alertsSoloAdvertencias.filter(a => mr.isBlockingValidationAlert(a.type)).map(a => a.message));
ok(cr.getInvalidPendingCells().length === 0,
  'Celda con 3 ADVERTENCIAS ya no bloquea el guardado (el filtro deja 0 mensajes)');
cr.setCellValidation(CELDA_BD, ['Campo obligatorio vacío']);
ok(cr.getInvalidPendingCells().length === 1,
  'Celda con 1 VACIO sigue bloqueando el guardado (correcto)');

console.log(`\n${passed} pasaron, ${failed} fallaron\n`);
process.exit(failed === 0 ? 0 : 1);
