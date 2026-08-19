/**
 * test_proyectadas.mjs — Regresión de las Coordenadas PROYECTADAS (solo locales).
 *
 * Verifica:
 *   A) CRUD: save / load / clear por celda y registro geolog_proyectadas_celdas
 *   B) isProyectadasDirty: empty, blank, '.' no cuentan; cualquier dígito sí
 *   C) renameProyectadasKey: migra datos al nuevo nombre y limpia el viejo
 *   D) clearAllProyectadas: borra todas las entradas del registro
 *   E) Invariante de prefijo: claves "geolog_proyectadas_*" NO interfieren con storageManager
 *   F) Flujo de descarte: después de clearProyectadas, isProyectadasDirty = false
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND  = path.resolve(TESTS_DIR, '..', 'frontend');
const CACHE     = path.join(TESTS_DIR, '.cache');

const needCompile =
  !existsSync(path.join(CACHE, 'utils', 'proyectadas.js')) ||
  !existsSync(path.join(CACHE, 'utils', 'storageManager.js'));

if (needCompile) {
  execSync(
    `npx tsc src\\utils\\proyectadas.ts src\\utils\\storageManager.ts src\\config\\storage.ts ` +
    `--module commonjs --outDir ${CACHE} --target es2022 --skipLibCheck --esModuleInterop --ignoreConfig --types react`,
    { cwd: FRONTEND, stdio: 'inherit' }
  );
}

const store = new Map();
globalThis.localStorage = {
  getItem:    (k) => (store.has(k) ? store.get(k) : null),
  setItem:    (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear:      () => store.clear(),
  key:        (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const require = createRequire(import.meta.url);
const proy = require(path.join(CACHE, 'utils', 'proyectadas.js'));

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else       { failed++; console.log(`  ❌ ${msg}`); }
};

// A) CRUD
console.log('\n📋 A) CRUD: save / load / clear por celda\n');
const CELDA_A = 'TEST_PROY_A';
const CELDA_B = 'TEST_PROY_B';
const emptyVal = proy.loadProyectadas(CELDA_A);
ok(emptyVal.este_from === '' && emptyVal.cota_to === '', 'loadProyectadas sin datos devuelve EMPTY_PROYECTADAS');
const coords = { este_from: '123456.789', norte_from: '8765432.1', cota_from: '3200.5', este_to: '123500.0', norte_to: '8765400.0', cota_to: '3195.0' };
proy.saveProyectadas(CELDA_A, coords);
const loaded = proy.loadProyectadas(CELDA_A);
ok(loaded.este_from === '123456.789', 'load devuelve este_from guardado');
ok(loaded.cota_to === '3195.0', 'load devuelve cota_to guardado');
const celdas = proy.getProyectadasCeldas();
ok(celdas.includes(CELDA_A), `getProyectadasCeldas incluye ${CELDA_A}`);
proy.saveProyectadas(CELDA_B, { ...proy.EMPTY_PROYECTADAS, este_from: '111000.0' });
ok(proy.getProyectadasCeldas().length === 2, 'Hay 2 celdas en el registro tras guardar B');
proy.clearProyectadas(CELDA_A);
ok(proy.loadProyectadas(CELDA_A).este_from === '', 'Tras clearProyectadas(A) => EMPTY_PROYECTADAS');
ok(!proy.getProyectadasCeldas().includes(CELDA_A), `${CELDA_A} se quita del registro`);
ok(proy.getProyectadasCeldas().includes(CELDA_B), `${CELDA_B} sigue en el registro`);

// B) isProyectadasDirty
console.log('\n📋 B) isProyectadasDirty\n');
const dirtyCoords = { este_from: '123456.789', norte_from: '', cota_from: '', este_to: '', norte_to: '', cota_to: '' };
ok( proy.isProyectadasDirty(dirtyCoords), 'dirty cuando al menos un campo tiene valor');
ok(!proy.isProyectadasDirty({ ...proy.EMPTY_PROYECTADAS }), 'EMPTY_PROYECTADAS no es dirty');
ok(!proy.isProyectadasDirty({ este_from: '   ', norte_from: '', cota_from: '', este_to: '', norte_to: '', cota_to: '' }), 'solo espacios no es dirty');
ok(!proy.isProyectadasDirty({ este_from: '.', norte_from: '.', cota_from: '.', este_to: '.', norte_to: '.', cota_to: '.' }), '"." en todos los campos no es dirty');
ok( proy.isProyectadasDirty({ este_from: '0', norte_from: '', cota_from: '', este_to: '', norte_to: '', cota_to: '' }), '"0" (digito) SI es dirty');

// C) renameProyectadasKey
console.log('\n📋 C) renameProyectadasKey\n');
const OLD_CELDA = 'PROY_OLD';
const NEW_CELDA = 'PROY_NEW';
proy.saveProyectadas(OLD_CELDA, { ...proy.EMPTY_PROYECTADAS, norte_from: '8000000.0' });
proy.renameProyectadasKey(OLD_CELDA, NEW_CELDA);
ok(!proy.getProyectadasCeldas().includes(OLD_CELDA), `${OLD_CELDA} se quita del registro tras rename`);
ok( proy.getProyectadasCeldas().includes(NEW_CELDA), `${NEW_CELDA} queda en el registro`);
ok(proy.loadProyectadas(NEW_CELDA).norte_from === '8000000.0', 'Los datos migran al nuevo nombre');
ok(proy.loadProyectadas(OLD_CELDA).norte_from === '', 'El viejo nombre queda vacio');
proy.renameProyectadasKey('INEXISTENTE', 'DESTINO');
ok(!proy.getProyectadasCeldas().includes('INEXISTENTE'), 'rename de celda inexistente no rompe el registro');

// D) clearAllProyectadas
console.log('\n📋 D) clearAllProyectadas\n');
ok(proy.getProyectadasCeldas().length > 0, 'Hay entradas antes de clearAll');
proy.clearAllProyectadas();
ok(proy.getProyectadasCeldas().length === 0, 'clearAllProyectadas vacia el registro');
ok(proy.loadProyectadas(CELDA_B).este_from === '', 'Tras clearAll los datos de B tambien se borraron');
ok(proy.loadProyectadas(NEW_CELDA).norte_from === '', 'Tras clearAll los datos de NEW_CELDA tambien se borraron');

// E) Invariante de prefijo
console.log('\n📋 E) Invariante de prefijo (celdaFromKey no captura proyectadas)\n');
proy.saveProyectadas('PREF_TEST', { ...proy.EMPTY_PROYECTADAS, este_from: '1' });
const keyPresente = [...store.keys()].some(k => k === 'geolog_window_PREF_TEST');
ok(!keyPresente, 'saveProyectadas NO escribe en geolog_window_* (sin interferencia con eviccion)');
proy.clearProyectadas('PREF_TEST');

// F) Flujo de descarte
console.log('\n📋 F) Flujo de descarte\n');
const CELDA_DISC = 'PROY_DISC';
proy.saveProyectadas(CELDA_DISC, { este_from: '500000', norte_from: '9000000', cota_from: '3500', este_to: '500100', norte_to: '9000100', cota_to: '3490' });
const beforeDiscard = proy.loadProyectadas(CELDA_DISC);
ok(proy.isProyectadasDirty(beforeDiscard), 'antes de descartar: dirty = true');
proy.clearProyectadas(CELDA_DISC);
const afterDiscard = proy.loadProyectadas(CELDA_DISC);
ok(!proy.isProyectadasDirty(afterDiscard), 'despues de descartar: dirty = false');
ok(!proy.getProyectadasCeldas().includes(CELDA_DISC), 'la celda se quita del registro');

console.log(`\n${passed} pasaron, ${failed} fallaron\n`);
process.exit(failed === 0 ? 0 : 1);
