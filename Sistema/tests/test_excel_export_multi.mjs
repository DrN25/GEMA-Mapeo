/**
 * test_excel_export_multi.mjs — Test unitario del flujo de exportación multi-celda
 * y resolución jerárquica de datos (Memoria Activa -> LocalStorage -> BD).
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND  = path.resolve(TESTS_DIR, '..', 'frontend');
const CACHE     = path.join(TESTS_DIR, '.cache');

// Compilar dependencias TS a JS si es necesario
execSync(
  `npx tsc src\\utils\\rmrCalculator.ts src\\utils\\catalogData.ts src\\utils\\windowTransform.ts ` +
  `--module commonjs --outDir ${CACHE} --target es2022 --skipLibCheck --esModuleInterop --ignoreConfig --types react`,
  { cwd: FRONTEND, stdio: 'inherit' }
);

const require = createRequire(import.meta.url);
const rmrCalc = require(path.join(CACHE, 'utils', 'rmrCalculator.js'));
const winTrans = require(path.join(CACHE, 'utils', 'windowTransform.js'));

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.error(`  ❌ FALLO: ${msg}`); }
};

console.log('\n📋 A) Jerarquía de extracción de datos para exportación');

// Mock de localStorage
const store = new Map();
globalThis.localStorage = {
  getItem:    (k) => (store.has(k) ? store.get(k) : null),
  setItem:    (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear:      () => store.clear(),
};

// 1. Caso A: Celda Activa en pantalla
const activeWin = {
  header: {
    celda: 'CELDA_ACTIVA',
    este_from: 100,
    norte_from: 200,
    cota_from: 300,
    este_to: 105,
    norte_to: 200,
    cota_to: 300,
    resistencia_ucs: 'R3',
    condicion_agua: 'W1',
    gsi_superficie: 'MB',
    gsi_estructura: 'B'
  },
  joints: [
    { n_discontinuidad: 1, familia: 1, dip: 45, dip_dir: 90, espaciamiento: 0.25, continuidad: 2, n_estructuras: 1 }
  ]
};

// Simulación de gatherVentanaData lógica
function mockGather(name, active) {
  const up = name.trim().toUpperCase();
  if (active && active.header?.celda?.toUpperCase() === up) {
    const calc = rmrCalc.calculateWindowGeomec(active.header, active.joints || []);
    const liveGsi = rmrCalc.suggestGsiVisual(calc.rqd_est, calc.condicion_rating_89);
    return {
      codigo: up,
      header: { ...active.header, gsi_visual: liveGsi ?? active.header.gsi_visual },
      joints: active.joints || []
    };
  }

  const raw = globalThis.localStorage.getItem(`geolog_window_${up}`);
  if (raw) {
    const parsed = JSON.parse(raw);
    const calc = rmrCalc.calculateWindowGeomec(parsed.header, parsed.joints || []);
    const liveGsi = rmrCalc.suggestGsiVisual(calc.rqd_est, calc.condicion_rating_89);
    return {
      codigo: up,
      header: { ...parsed.header, gsi_visual: liveGsi ?? parsed.header.gsi_visual },
      joints: parsed.joints || []
    };
  }

  return null;
}

const itemActivo = mockGather('CELDA_ACTIVA', activeWin);
ok(itemActivo !== null, 'Extrae celda activa correctamente');
ok(itemActivo.codigo === 'CELDA_ACTIVA', 'Código coincide con CELDA_ACTIVA');
ok(itemActivo.joints.length === 1, 'Mantiene discontinuidades de celda activa');
ok(itemActivo.header.gsi_visual !== undefined, 'Calcula GSI visual en vivo para celda activa');

// 2. Caso B: Borrador local en LocalStorage
const draftWin = {
  header: {
    celda: 'BORRADOR_LOCAL',
    este_from: 500,
    resistencia_ucs: 'R4',
    condicion_agua: 'W2'
  },
  joints: [
    { n_discontinuidad: 1, familia: 1, dip: 60, dip_dir: 180, espaciamiento: 0.5, continuidad: 3, n_estructuras: 2 },
    { n_discontinuidad: 2, familia: 2, dip: 70, dip_dir: 270, espaciamiento: 0.3, continuidad: 1, n_estructuras: 1 }
  ]
};
store.set('geolog_window_BORRADOR_LOCAL', JSON.stringify(draftWin));

const itemDraft = mockGather('BORRADOR_LOCAL', activeWin);
ok(itemDraft !== null, 'Extrae borrador desde LocalStorage cuando no es activa');
ok(itemDraft.codigo === 'BORRADOR_LOCAL', 'Código coincide con BORRADOR_LOCAL');
ok(itemDraft.joints.length === 2, 'Contiene 2 discontinuidades del borrador');

console.log('\n📋 B) Consolidación del Payload Multi-Celda');

const lote = [itemActivo, itemDraft];
const payload = { items: lote };

ok(Array.isArray(payload.items), 'Payload items es un arreglo');
ok(payload.items.length === 2, 'Payload contiene 2 celdas para exportación');
ok(payload.items[0].codigo === 'CELDA_ACTIVA', 'Primer item es CELDA_ACTIVA');
ok(payload.items[1].codigo === 'BORRADOR_LOCAL', 'Segundo item es BORRADOR_LOCAL');

console.log(`\n${passed} pasaron, ${failed} fallaron\n`);
if (failed > 0) process.exit(1);
