/**
 * test_plt_import.mjs — Helpers del import PLT: agrupación por celda,
 * estado de existencia y re-etiquetado (renombrado a otra celda).
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(TESTS_DIR, '..', 'frontend');
const CACHE = path.join(TESTS_DIR, '.cache');

if (!existsSync(path.join(CACHE, 'utils', 'pltImportHelpers.js'))) {
  execSync(
    `npx tsc src\\utils\\pltImportHelpers.ts src\\utils\\geomecColumns.ts src\\utils\\numericPrecision.ts ` +
    `--rootDir src --module commonjs --outDir ${CACHE} --target es2022 --skipLibCheck --esModuleInterop --ignoreConfig --types react`,
    { cwd: FRONTEND, stdio: 'inherit' }
  );
}

const require = createRequire(import.meta.url);
const h = require(path.join(CACHE, 'utils', 'pltImportHelpers.js'));

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ ${msg}`); }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const rows = [
  { id: 1, celda_mapeo: 'test_004 ', muestra: 'A1', codigo_muestra: 'TEST_004_A1' },
  { id: 2, celda_mapeo: 'test_004', muestra: 'A2', codigo_muestra: 'TEST_004_A2' },
  { id: 3, celda_mapeo: 'RTF_001', muestra: 'B1', codigo_muestra: 'RTF_001_B1' },
  { id: 4, celda_mapeo: 'RTF_001', muestra: 'B2', codigo_muestra: 'RTF_001_B2' },
  { id: 5, celda_mapeo: 'noexiste_zz', muestra: 'C1', codigo_muestra: 'NOEXISTE_ZZ_C1' },
  { id: 6, celda_mapeo: '  ', muestra: 'D1', codigo_muestra: '' },
  { id: 7, celda_mapeo: 'RTF_001', muestra: 'B3', codigo_muestra: 'RTF_001_B3' },
];

console.log('\n=== 1. groupPltRowsByCelda (agrupación + existencia) ===');
const known = ['TEST_004', 'rtf_001']; // BD + localStorage (normalizado en el helper)
const groups = h.groupPltRowsByCelda(rows, known);

ok(groups.length === 3, `3 grupos (obtuvo ${groups.length})`);
const gTest = groups.find(g => g.name === 'TEST4'); // normalizeCeldaCode('test_004 ') = 'TEST4'
const gRtf = groups.find(g => g.name === 'RTF1');   // normalizeCeldaCode('RTF_001') = 'RTF1'
const gNo = groups.find(g => g.name === 'NOEXISTEZZ');
ok(gTest && gTest.rows.length === 2, 'test_004 → 2 registros (normaliza "test_004 ")');
ok(gTest?.originalName === 'test_004', 'Conserva el nombre original del Excel (trim)');
ok(gRtf && gRtf.rows.length === 3, 'RTF_001 → 3 registros');
ok(gNo && gNo.rows.length === 1, 'NOEXISTE_ZZ → 1 registro');
ok(gTest?.exists === true, 'TEST_004 existe (case-insensitive)');
ok(gRtf?.exists === true, 'RTF_001 existe ("rtf_001" en known)');
ok(gNo?.exists === false, 'NOEXISTE_ZZ no existe');
ok(!groups.some(g => g.name === ''), 'Registros sin celda se omiten');

console.log('\n=== 2. retagPltRows (renombrado a otra celda) ===');
const retagged = h.retagPltRows(gRtf.rows, 'test_004');
ok(retagged.length === 3, 'Mantiene la cantidad de registros');
ok(retagged.every(r => r.celda_mapeo === 'TEST_004'), 'celda_mapeo con el CÓDIGO REAL (TEST_004, no normalizado)');
ok(retagged[0].codigo_muestra === 'TEST_004_B1', `codigo_muestra regenerado con guion bajo (obtuvo ${retagged[0].codigo_muestra})`);
ok(retagged[0].muestra === 'B1' && retagged[0].id === 3, 'Resto de campos intactos');

const retagged2 = h.retagPltRows([{ id: 1, celda_mapeo: 'X', muestra: '  ', codigo_muestra: 'X-1' }], 'RTF_001');
ok(retagged2[0].celda_mapeo === 'RTF_001' && retagged2[0].codigo_muestra === '', 'Muestra vacía → codigo_muestra vacío, celda real RTF_001');

console.log('\n=== 3. Orden de grupos (estabilidad) ===');
const names = groups.map(g => g.name);
ok(eq(names, ['TEST4', 'RTF1', 'NOEXISTEZZ']), `Orden estable: ${names.join(', ')}`);

console.log(`\n${passed} pasaron, ${failed} fallaron\n`);
process.exit(failed > 0 ? 1 : 0);
