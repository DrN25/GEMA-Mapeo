/**
 * test_gsi.mjs — Catálogos GSI, fórmula de autocompletado, rango QA/QC,
 * normalización de códigos (BD/Excel) y geometría dip/az autocalculada.
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

if (!existsSync(path.join(CACHE, 'utils', 'rmrCalculator.js')) || !existsSync(path.join(CACHE, 'utils', 'qaQcRules.js'))) {
  execSync(
    `npx tsc src\\utils\\rmrCalculator.ts src\\utils\\catalogData.ts src\\utils\\rmrInterpolation.ts ` +
    `src\\utils\\qaQcRules.ts src\\utils\\qaQcTouch.ts src\\utils\\campaniasCatalog.ts ` +
    `src\\utils\\windowTransform.ts src\\utils\\numericPrecision.ts src\\utils\\diffUtils.ts ` +
    `src\\utils\\storageManager.ts src\\config\\storage.ts ` +
    `--module commonjs --outDir ${CACHE} --target es2022 --skipLibCheck --esModuleInterop --ignoreConfig --types react`,
    { cwd: FRONTEND, stdio: 'inherit' }
  );
}

// Mock de localStorage (para diffUtils/storageManager)
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
const rmr = require(path.join(CACHE, 'utils', 'rmrCalculator.js'));
const cat = require(path.join(CACHE, 'utils', 'catalogData.js'));
const qaqc = require(path.join(CACHE, 'utils', 'qaQcRules.js'));
const wt = require(path.join(CACHE, 'utils', 'windowTransform.js'));

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ ${msg}`); }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n=== 1. Catálogos GSI (defaults SSOT) ===');
ok(cat.GSI_SUPERFICIE_CATALOG['VG']?.min === 36 && cat.GSI_SUPERFICIE_CATALOG['VG']?.max === 45, 'VG rango [36,45]');
ok(cat.GSI_SUPERFICIE_CATALOG['VP']?.min === 0 && cat.GSI_SUPERFICIE_CATALOG['VP']?.max === 9, 'VP rango [0,9]');
ok(cat.GSI_ESTRUCTURA_CATALOG['B']?.min === 30 && cat.GSI_ESTRUCTURA_CATALOG['B']?.max === 40, 'B rango [30,40]');
ok(cat.GSI_ESTRUCTURA_CATALOG['D']?.min === 0 && cat.GSI_ESTRUCTURA_CATALOG['D']?.max === 10, 'D rango [0,10]');
ok(Object.keys(cat.GSI_SUPERFICIE_CATALOG).length === 5, '5 códigos de superficie');
ok(Object.keys(cat.GSI_ESTRUCTURA_CATALOG).length === 4, '4 códigos de estructura');

console.log('\n=== 2. suggestGsiVisual (fórmula de autocompletado) ===');
ok(rmr.suggestGsiVisual(82, 11.11) === 58, 'Ejemplo del md: RQD=82, JCond=11.11 → 58');
ok(rmr.suggestGsiVisual(90, 30) === 85, 'Cap en 85: 1.5*30 + 45 = 90 → 85');
ok(rmr.suggestGsiVisual(0, 0) === 0, 'RQD=0, JCond=0 → 0');
ok(rmr.suggestGsiVisual(null, 11.11) === null, 'Sin RQD → null');
ok(rmr.suggestGsiVisual(82, undefined) === null, 'Sin JCond → null');

console.log('\n=== 3. gsiVisualRange (rango QA/QC derivado por suma) ===');
ok(eq(rmr.gsiVisualRange('VB', 'G'), { min: 47, max: 66 }), 'VB+G → [47,66] (ejemplo del md)');
ok(eq(rmr.gsiVisualRange('B', 'VP'), { min: 30, max: 49 }), 'B+VP → [30,49]');
ok(eq(rmr.gsiVisualRange('D', 'VG'), { min: 36, max: 55 }), 'D+VG → [36,55]');
ok(eq(rmr.gsiVisualRange('B', 'VG'), { min: 66, max: 85 }), 'B+VG → [66,85] (cap 85)');
ok(eq(rmr.gsiVisualRange('vb', ' g '), { min: 47, max: 66 }), 'Normaliza minúsculas/espacios: vb + " g " → [47,66]');
ok(rmr.gsiVisualRange('XX', 'G') === null, 'Estructura fuera de catálogo → null');
ok(rmr.gsiVisualRange('VB', '') === null, 'Sin superficie → null');
ok(rmr.gsiVisualRange(null, null) === null, 'Ambos vacíos → null');

console.log('\n=== 4. toGsiCode (normalización BD/Excel) ===');
ok(wt.toGsiCode('vb', cat.GSI_ESTRUCTURA_CATALOG) === 'VB', '"vb" → "VB"');
ok(wt.toGsiCode(' f ', cat.GSI_SUPERFICIE_CATALOG) === 'F', '" f " → "F"');
ok(wt.toGsiCode('', cat.GSI_SUPERFICIE_CATALOG) === '', 'vacío → vacío');
ok(wt.toGsiCode('-1', cat.GSI_SUPERFICIE_CATALOG) === '', '"-1" → vacío');
ok(wt.toGsiCode('ZZ', cat.GSI_SUPERFICIE_CATALOG) === '', 'Código fuera de catálogo → vacío (solo opciones válidas)');
ok(wt.toGsiCode('VG', {}) === 'VG', 'Catálogo no cargado → conserva el valor normalizado');

console.log('\n=== 5. Geometría autocalculada (dip_hole / az_hole / dip_dir) ===');
// from(100,200,300) → to(100,210,300): ΔE=0, ΔN=10, ΔZ=0 → L=10, dip=0, az=0, dipdir=90
let r = rmr.calculateWindowGeomec({
  celda: 'GEO1', este_from: 100, norte_from: 200, cota_from: 300,
  este_to: 100, norte_to: 210, cota_to: 300
}, []);
ok(r.largo === 10, 'Largo = 10 (ΔN=10)');
ok(Math.abs(r.dip_hole - 0) < 0.001, 'DipHole = 0 (ΔZ=0)');
ok(Math.abs(r.az_hole - 0) < 0.001, 'AZ_Hole = 0 (atan2(0,10))');
ok(Math.abs(r.dip_dir_talud - 90) < 0.001, 'DipDir = (0+90)%360 = 90');

// from(100,200,310) → to(110,200,300): ΔE=10, ΔN=0, ΔZ=10 → L=14, dip=45, az=90, dipdir=180
r = rmr.calculateWindowGeomec({
  celda: 'GEO2', este_from: 100, norte_from: 200, cota_from: 310,
  este_to: 110, norte_to: 200, cota_to: 300
}, []);
ok(r.largo === 14, `Largo = round(√200) = 14 (obtuvo ${r.largo})`);
ok(Math.abs(r.dip_hole - 45) < 1, `DipHole ≈ 45° (obtuvo ${r.dip_hole})`);
ok(Math.abs(r.az_hole - 90) < 1, `AZ_Hole = 90° (obtuvo ${r.az_hole})`);
ok(Math.abs(r.dip_dir_talud - 180) < 1, `DipDir = (90+90)%360 = 180 (obtuvo ${r.dip_dir_talud})`);

// Con HOLE_AUTO, dip_dir_talud NO debe respetar un header viejo de BD
r = rmr.calculateWindowGeomec({
  celda: 'GEO3', este_from: 100, norte_from: 200, cota_from: 310,
  este_to: 110, norte_to: 200, cota_to: 300, dipdir_talud: 999
}, []);
ok(Math.abs(r.dip_dir_talud - 180) < 1, `DipDir ignora header viejo (999) con HOLE_AUTO → 180 (obtuvo ${r.dip_dir_talud})`);

console.log('\n=== 6. Regla QA/QC GSI_VISUAL_RANGO (CRÍTICA) ===');
// Con GSI_VISUAL_AUTO=true la regla IGNORA header.gsi_visual y valida la
// SUGERENCIA derivada por fórmula. Con joints vacíos la sugerencia es
// determinística: sin estructuras → rqd_est=0, jcond=0 → min(85, round(0+0)) = 0.
const baseHeader = { celda: 'QC1', gsi_estructura: 'VB', gsi_superficie: 'G' };
const alerts = (header) => qaqc.validateWindowQAQC(header, [], 10, undefined, true)
  .filter(a => a.ruleId === 'GSI_VISUAL_RANGO');

// VB/G → [47,66]: sugerencia 0 queda FUERA → CRÍTICA, aunque el header diga 58
const a58 = alerts({ ...baseHeader, gsi_visual: 58 });
ok(a58.length === 1 && a58[0].type === 'CRITICA', 'VB/G + [] → sugerencia 0 fuera de [47,66] → CRÍTICA (header 58 ignorado)');
ok(a58.length === 1 && a58[0].message.includes('47 a 66'), 'Mensaje incluye rango 47 a 66');
ok(alerts({ ...baseHeader, gsi_visual: 85 }).length === 1, 'VB/G + header 85 → CRÍTICA (header ignorado, se valida la sugerencia 0)');
ok(alerts({ ...baseHeader }).length === 1, 'VB/G + sin gsi_visual en header → CRÍTICA (la sugerencia nunca falta)');
// D/VP → [0,19]: la sugerencia 0 queda DENTRO → PASA (valida la sugerencia, no el header)
ok(alerts({ celda: 'QC1', gsi_estructura: 'D', gsi_superficie: 'VP', gsi_visual: 99 }).length === 0,
  'D/VP + [] → sugerencia 0 dentro de [0,19] → PASA (header 99 ignorado)');
ok(qaqc.validateWindowQAQC({ ...baseHeader, gsi_superficie: '' }, [], 10, undefined, true)
  .filter(a => a.ruleId === 'GSI_VISUAL_RANGO').length === 0, 'Sin superficie → sin regla');
ok(qaqc.validateWindowQAQC({ celda: 'QC1', gsi_estructura: 'XX', gsi_superficie: 'G' }, [], 10, undefined, true)
  .filter(a => a.ruleId === 'GSI_VISUAL_RANGO').length === 0, 'Estructura fuera de catálogo → sin regla');

console.log(`\n${passed} pasaron, ${failed} fallaron\n`);
process.exit(failed > 0 ? 1 : 0);
