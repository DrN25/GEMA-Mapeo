/**
 * test_window_transform.mjs — E2E del lado frontend.
 *
 * Toma el fixture generado por test_import_e2e.py (preview real del Excel A21)
 * y valida que excelDataToWindowData transforme TODO correctamente:
 *   - campaña → ID de campaña (no año)
 *   - fase / GSI superficie / GSI estructura presentes
 *   - coords redondeadas a la precisión del SSOT (este 3 dec)
 *   - is50_mpa redondeado a 2 dec
 *   - joints con precisión de la UI (dip/dip_dir/distancia enteros)
 *   - sin NaN ni campos vacíos críticos
 *
 * Antes de correrlo, el runner ejecuta tsc para compilar los módulos TS a CJS.
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(TESTS_DIR, '..', 'frontend');
const CACHE = path.join(TESTS_DIR, '.cache');
const FIXTURE = path.join(TESTS_DIR, 'fixtures', 'preview_a21.json');

// 1. Compilar los módulos TS necesarios a CJS (una sola vez por corrida)
if (!existsSync(path.join(CACHE, 'utils', 'windowTransform.js'))) {
  execSync(
    `npx tsc src\\utils\\windowTransform.ts src\\utils\\numericPrecision.ts src\\utils\\campaniasCatalog.ts ` +
    `--module commonjs --outDir ${CACHE} --target es2022 --skipLibCheck --esModuleInterop --ignoreConfig --types react`,
    { cwd: FRONTEND, stdio: 'inherit' }
  );
}

const require = createRequire(import.meta.url);
const wt = require(path.join(CACHE, 'utils', 'windowTransform.js'));

// 2. Cargar el fixture del Excel real
if (!existsSync(FIXTURE)) {
  console.error('❌ No existe el fixture. Ejecuta primero: python test_import_e2e.py');
  process.exit(1);
}
const celdas = JSON.parse(readFileSync(FIXTURE, 'utf8'));

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const decs = (n) => {
  if (n === null || n === undefined || isNaN(n)) return 0;
  const s = String(n).split('.')[1] || '';
  return s.length;
};

console.log(`== E2E frontend: ${celdas.length} celdas del Excel A21 → WindowData ==`);

test('todas las celdas se transforman sin errores', () => {
  for (const c of celdas) {
    const w = wt.excelDataToWindowData(c.codigo, c.excel_data, c.estructuras);
    if (!w) throw new Error(`celda ${c.codigo} no se transformó`);
  }
});

test('campaña → ID de campaña (7 = Campaña 2026), no el año', () => {
  for (const c of celdas) {
    const w = wt.excelDataToWindowData(c.codigo, c.excel_data, c.estructuras);
    const anio = String(c.excel_data.campania || '').match(/20\d{2}/);
    const idEsperado = anio ? (anio[0] === '2026' ? 7 : (anio[0] === '2025' ? 6 : anio[0] === '2024' ? 5 : anio[0] === '2023' ? 4 : anio[0] === '2022' ? 3 : anio[0] === '2021' ? 2 : anio[0] === '2020' ? 1 : 8)) : 7;
    if (w.header.campania !== idEsperado) {
      throw new Error(`${c.codigo}: campania=${w.header.campania} esperado=${idEsperado} (Excel: ${c.excel_data.campania})`);
    }
  }
});

test('fase y GSI superficie/estructura se preservan', () => {
  let conFase = 0, conSup = 0, conEst = 0;
  for (const c of celdas) {
    const w = wt.excelDataToWindowData(c.codigo, c.excel_data, c.estructuras);
    if (String(c.excel_data.fase || '').trim()) { conFase++; if (String(w.header.fase).trim() !== String(c.excel_data.fase).trim()) throw new Error(`${c.codigo}: fase`); }
    if (String(c.excel_data.gsi_superficie || '').trim()) { conSup++; if (w.header.gsi_superficie !== String(c.excel_data.gsi_superficie).trim()) throw new Error(`${c.codigo}: gsi sup`); }
    if (String(c.excel_data.gsi_estructura || '').trim()) { conEst++; if (w.header.gsi_estructura !== String(c.excel_data.gsi_estructura).trim()) throw new Error(`${c.codigo}: gsi est`); }
  }
  if (conFase === 0 || conSup === 0 || conEst === 0) throw new Error('no hay datos de fase/GSI en el fixture');
  console.log(`    → fase ${conFase}/${celdas.length} · GSI sup ${conSup} · GSI est ${conEst}`);
});

test('coords redondeadas a la precisión del SSOT (este 3 dec)', () => {
  for (const c of celdas) {
    const w = wt.excelDataToWindowData(c.codigo, c.excel_data, c.estructuras);
    if (w.header.este_from !== undefined) {
      if (decs(w.header.este_from) > 3) throw new Error(`${c.codigo}: este_from con ${decs(w.header.este_from)} dec`);
      if (decs(w.header.norte_from ?? 0) > 3) throw new Error(`${c.codigo}: norte_from con más de 3 dec`);
    }
  }
});

test('sin NaN en campos numéricos del header', () => {
  for (const c of celdas) {
    const w = wt.excelDataToWindowData(c.codigo, c.excel_data, c.estructuras);
    for (const k of ['este_from', 'norte_from', 'cota_from', 'este_to', 'norte_to', 'cota_to', 'largo', 'altura', 'campania']) {
      const v = w.header[k];
      if (v !== undefined && v !== null && isNaN(Number(v))) throw new Error(`${c.codigo}: ${k} = NaN`);
    }
  }
});

test('joints con precisión de la UI (enteros en dip/dip_dir/distancia)', () => {
  for (const c of celdas) {
    const w = wt.excelDataToWindowData(c.codigo, c.excel_data, c.estructuras);
    for (const j of w.joints) {
      if (j.dip !== -1 && decs(j.dip) > 0) throw new Error(`${c.codigo}: dip con decimales (${j.dip})`);
      if (j.dip_dir !== -1 && decs(j.dip_dir) > 0) throw new Error(`${c.codigo}: dip_dir con decimales`);
      if (j.distancia !== -1 && decs(j.distancia) > 0) throw new Error(`${c.codigo}: distancia con decimales`);
      if (j.abertura !== -1 && decs(j.abertura) > 1) throw new Error(`${c.codigo}: abertura con más de 1 dec`);
    }
  }
});

test('is50_mpa importado con ≤2 decimales (display)', () => {
  for (const c of celdas) {
    const w = wt.excelDataToWindowData(c.codigo, c.excel_data, c.estructuras);
    if (w.header.is50_mpa !== 0 && w.header.is50_mpa !== undefined && decs(w.header.is50_mpa) > 2) {
      throw new Error(`${c.codigo}: is50_mpa con ${decs(w.header.is50_mpa)} dec`);
    }
  }
});

console.log(`\n${passed} pruebas pasadas ✅`);
