/**
 * test_plt_grid_lifecycle.mjs — Suite de pruebas de integración completa para Grid PLT:
 * - Fórmulas geomecánicas automáticas (ancho_w, De, f, Is, Is50, UCS, ISRM)
 * - Cascada litológica (Lito1 -> Lito2 -> Lito3 -> Tipo litológico)
 * - Snapshot y persistencia local (Deltas, Agregar filas, Eliminar filas, Reiniciar página / F5)
 * - Flujo de guardado a base de datos y descarte de cambios
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(TESTS_DIR, '..', 'frontend');
const CACHE = path.join(TESTS_DIR, '.cache');

// 1. Compilación de módulos requeridos a CommonJS
if (
  !existsSync(path.join(CACHE, 'utils', 'geomecColumns.js')) ||
  !existsSync(path.join(CACHE, 'utils', 'storageManager.js')) ||
  !existsSync(path.join(CACHE, 'utils', 'catalogData.js'))
) {
  execSync(
    `npx tsc src\\utils\\geomecColumns.ts src\\utils\\storageManager.ts src\\config\\storage.ts src\\utils\\catalogData.ts src\\utils\\numericPrecision.ts ` +
    `--rootDir src --module commonjs --outDir ${CACHE} --target es2022 --skipLibCheck --esModuleInterop --ignoreConfig --types react`,
    { cwd: FRONTEND, stdio: 'inherit' }
  );
}

// 2. Mock completo de localStorage en memoria
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
const gc = require(path.join(CACHE, 'utils', 'geomecColumns.js'));
const sm = require(path.join(CACHE, 'utils', 'storageManager.js'));
const cat = require(path.join(CACHE, 'utils', 'catalogData.js'));

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ ${msg}`); }
};

console.log('\n======================================================');
console.log('🧪 PRUEBAS DE INTEGRACIÓN: GRID PLT Y CICLO DE VIDA');
console.log('======================================================\n');

// ── SECCIÓN 1: FÓRMULAS GEOMECÁNICAS PLT ──
console.log('--- 1. FÓRMULAS GEOMECÁNICAS Y CÁLCULOS AUTOMÁTICOS ---');

const row1 = {
  id: 1,
  campana: 2024,
  celda_mapeo: 'CELDA_01',
  espesor_d: 45.0,
  longitud_l: 50.0,
  ancho_w1: 52.0,
  ancho_w2: 54.0,
  fuerza_p: 8.5,
  factor_conversion_k: 22.0,
  litologia_1: 'ANDESITA'
};

const computed1 = gc.applyPltFormulas(row1);

ok(computed1.ancho_w === 53.0, `ancho_w promedio = 53.0 (obtuvo ${computed1.ancho_w})`);
ok(computed1.muestra_valida_longitud === 'SÍ', `Validez longitud L >= 0.5*D: SÍ`);
ok(computed1.muestra_valida_ancho === 'SÍ', `Validez ancho W e/ 0.5*D y 2*D: SÍ`);
ok(typeof computed1.diametro_equivalente === 'number' && computed1.diametro_equivalente > 50, `Diámetro equivalente calculado > 50mm`);
ok(typeof computed1.f === 'number' && computed1.f > 0, `Factor de corrección f calculado`);
ok(typeof computed1.is_mpa === 'number' && computed1.is_mpa > 0, `Is (MPa) calculado`);
ok(typeof computed1.is_50 === 'number' && computed1.is_50 > 0, `Is(50) corregido calculado`);
ok(typeof computed1.ucs === 'number' && computed1.ucs > 0, `UCS calculado correctamente`);
ok(computed1.resistencia_isrm && computed1.resistencia_isrm.startsWith('R'), `Clase ISRM asignada (${computed1.resistencia_isrm})`);

// Caso borde: Muestra inválida por dimensiones pequeñas
const rowInvalida = {
  id: 2,
  espesor_d: 60.0,
  longitud_l: 20.0, // menor que 0.5 * 60 = 30
  ancho_w1: 20.0,
  ancho_w2: 20.0   // 20 menor que 0.5 * 60 = 30
};
const compInvalida = gc.applyPltFormulas(rowInvalida);
ok(compInvalida.muestra_valida_longitud === 'NO', `Detección de longitud inválida (L < 0.5*D): NO`);
ok(compInvalida.muestra_valida_ancho === 'NO', `Detección de ancho inválido (W < 0.5*D): NO`);

// ── SECCIÓN 2: CASCADA LITOLÓGICA ──
console.log('\n--- 2. CASCADA LITOLÓGICA (LITO 1 -> LITO 2 -> LITO 3) ---');
const litoCascade = gc.applyLitoCascade('litologia_1', 'ANDESITA', { litologia_1: '', litologia_2: '', litologia_3: '' });
ok(litoCascade.litologia_1 === 'ANDESITA', 'Litología 1 asignada correctamente');
ok(litoCascade.tipo_litologico !== undefined, 'Tipo litológico resuelto automáticamente desde catálogo');

// ── SECCIÓN 3: PERSISTENCIA LOCAL, DELTAS Y RECUPERACIÓN (F5 / REINICIO) ──
console.log('\n--- 3. PERSISTENCIA LOCAL, DELTAS Y RECUPERACIÓN TRAS RECARGA ---');

const CELDA_TEST = 'CELDA_PLT_100';

// 3.1 Carga inicial desde BD (Snapshot base)
const dbSnapshot = [
  gc.applyPltFormulas({ id: 101, celda_mapeo: CELDA_TEST, codigo_muestra: 'M-01', fuerza_p: 5.0, factor_conversion_k: 20 }),
  gc.applyPltFormulas({ id: 102, celda_mapeo: CELDA_TEST, codigo_muestra: 'M-02', fuerza_p: 6.0, factor_conversion_k: 20 })
];
ok(dbSnapshot.length === 2, 'Snapshot base cargado desde base de datos con 2 registros');

// 3.2 Usuario agrega una fila nueva y edita una existente
const newRow = gc.applyPltFormulas({
  id: 103,
  celda_mapeo: CELDA_TEST,
  muestra: '03',
  fuerza_p: 7.5,
  factor_conversion_k: 22,
  _dirty: true
});

const editedRows = [
  { ...dbSnapshot[0], fuerza_p: 9.9, _dirty: true }, // editada
  dbSnapshot[1],                                     // sin cambios
  newRow                                             // nueva
];

// Se persiste como delta local en localStorage (mismo comportamiento de App.tsx:handlePltChange)
sm.savePltDelta(CELDA_TEST, editedRows);
sm.addPendingPltCell(CELDA_TEST);

ok(sm.getPendingPltCells().includes(CELDA_TEST), 'Celda marcada como pendiente en pendingPltCells');
const deltaInStore = sm.getPltDelta(CELDA_TEST);
ok(deltaInStore.length === 3, `Delta guardado en localStorage contiene 3 filas (obtuvo ${deltaInStore.length})`);
ok(deltaInStore[0].fuerza_p === 9.9, 'Delta almacena el valor modificado (fuerza_p = 9.9)');
ok(deltaInStore[2].codigo_muestra === `${CELDA_TEST}03`, `Delta almacena la fila agregada con codigo_muestra autocalculado (${CELDA_TEST}03)`);

// 3.3 SIMULACIÓN DE REINICIO DE PÁGINA (F5)
console.log('\n--- 4. SIMULACIÓN DE REINICIO DE PÁGINA (RECARGA / F5) ---');
// Al recargar la página, el frontend monta de nuevo:
// 1. Obtiene de BD el snapshot original (2 filas)
// 2. Consulta si hay delta pendiente en localStorage para esta celda
const restoredDelta = sm.getPltDelta(CELDA_TEST);
const rehydratedState = restoredDelta.length > 0 ? restoredDelta : dbSnapshot;

ok(rehydratedState.length === 3, 'Tras F5/reinicio de página: se conservan las 3 filas');
ok(rehydratedState[0].fuerza_p === 9.9, 'Tras F5/reinicio: el valor editado (9.9) se mantiene intacto');
ok(rehydratedState[2].id === 103, 'Tras F5/reinicio: la fila nueva agregada se mantiene intacta');

// 3.4 SIMULACIÓN DE ELIMINACIÓN DE FILA
console.log('\n--- 5. SIMULACIÓN DE ELIMINACIÓN DE FILA ---');
const afterDelete = rehydratedState.filter(r => r.id !== 102); // se elimina la fila 102
sm.savePltDelta(CELDA_TEST, afterDelete);

const deltaAfterDelete = sm.getPltDelta(CELDA_TEST);
ok(deltaAfterDelete.length === 2, `Tras eliminar fila 102: el delta tiene 2 filas`);
ok(!deltaAfterDelete.some(r => r.id === 102), 'La fila eliminada ya no existe en el delta');

// 3.5 SIMULACIÓN DE GUARDADO EXITOSO A BASE DE DATOS
console.log('\n--- 6. SIMULACIÓN DE GUARDADO EXITOSO A BASE DE DATOS ---');
// Al guardar exitosamente en el backend (PUT /api/ensayos-plt):
// Se limpia el delta y se actualiza el snapshot
sm.clearPltDelta(CELDA_TEST);
sm.removePendingPltCell(CELDA_TEST);

ok(!sm.getPendingPltCells().includes(CELDA_TEST), 'Celda removida de pendientes tras guardar');
ok(sm.getPltDelta(CELDA_TEST).length === 0, 'Delta limpiado tras sincronización exitosa');

// 3.6 SIMULACIÓN DE DESCARTE DE CAMBIOS
console.log('\n--- 7. SIMULACIÓN DE DESCARTE DE CAMBIOS ---');
// Usuario hace cambios no deseados:
sm.savePltDelta(CELDA_TEST, [{ id: 999, celda_mapeo: CELDA_TEST, muestra: 'ERRONEO' }]);
sm.addPendingPltCell(CELDA_TEST);
ok(sm.getPendingPltCells().includes(CELDA_TEST), 'Celda con cambios pendientes');

// Usuario presiona "Descartar":
sm.clearPltDelta(CELDA_TEST);
sm.removePendingPltCell(CELDA_TEST);
const discardedState = sm.getPltDelta(CELDA_TEST).length > 0 ? sm.getPltDelta(CELDA_TEST) : dbSnapshot;

ok(!sm.getPendingPltCells().includes(CELDA_TEST), 'Celda desmarcada de pendientes al descartar');
ok(discardedState.length === 2, 'Estado revertido fielmente al snapshot original de BD (2 filas)');
ok(discardedState[0].fuerza_p === 5.0, 'Valores restaurados a los originales de BD');

console.log(`\n======================================================`);
console.log(`🎯 RESULTADO FINAL: ${passed} pasaron, ${failed} fallaron`);
console.log(`======================================================\n`);

process.exit(failed > 0 ? 1 : 0);
