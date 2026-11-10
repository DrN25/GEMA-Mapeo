/**
 * test_plt_qaqc_rules.mjs — Suite de pruebas unitarias para las nuevas reglas QA/QC
 * de Ensayos PLT Irregulares en Interfaz:
 *   1. No celdas duplicadas (CELDA_DUPLICADA en Cabecera/Mapeo)
 *   2. 4 muestras obligatorias A, B, C, D (cantidad, duplicados, orden)
 *   3. Código de muestra concatenado {celda}{muestra} sin guion bajo (ej. AG57A)
 *   4. Coordenadas distintas por muestra + límites FROM–TO + tolerancia elevación 1.0–1.5 m / >1.5 m
 *   5. Comparación litológica vs Mapeo ("No es la litología que registró en mapeo.")
 *   6. Factor K coherente con la litología declarada del muestreo + rango [5, 30]
 *   7. Geometría ASTM/ISRM (0.3W < D < W y L >= D) + De tolerancia ±0.005 cm
 *   8. Carga aplicada P (55–60 kN advertencia; > 60 kN alerta verificación + Observaciones VACIO)
 *   9. Fractura estricta M/E/C y conservación de Factor K editado manualmente en gridStore
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(TESTS_DIR, '..', 'frontend');
const FRONTEND_MODULES = path.resolve(TESTS_DIR, '../frontend/node_modules');
const require = createRequire(import.meta.url);
const CjsModule = require('node:module');
process.env.NODE_PATH = [FRONTEND_MODULES, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
CjsModule._initPaths();
const CACHE = path.join(TESTS_DIR, '.cache');

if (
  !existsSync(path.join(CACHE, 'utils', 'pltQaQcRules.js')) ||
  !existsSync(path.join(CACHE, 'utils', 'qaQcRules.js')) ||
  !existsSync(path.join(CACHE, 'utils', 'mandatoryRules.js')) ||
  !existsSync(path.join(CACHE, 'features', 'grid', 'gridStore.js'))
) {
  execSync(
    `npx tsc ` +
      `src\\utils\\pltQaQcRules.ts ` +
      `src\\utils\\qaQcRules.ts ` +
      `src\\utils\\mandatoryRules.ts ` +
      `src\\utils\\geomecColumns.ts ` +
      `src\\utils\\catalogData.ts ` +
      `src\\utils\\numericPrecision.ts ` +
      `src\\utils\\rmrCalculator.ts ` +
      `src\\utils\\rmrInterpolation.ts ` +
      `src\\utils\\qaQcTouch.ts ` +
      `src\\utils\\campaniasCatalog.ts ` +
      `src\\features\\grid\\gridStore.ts ` +
      `src\\features\\grid\\schema\\pltColumns.ts ` +
      `src\\features\\grid\\schema\\validationEngine.ts ` +
      `--rootDir src --module commonjs --outDir ${CACHE} --target es2022 --skipLibCheck --esModuleInterop --ignoreConfig --types react`,
    { cwd: FRONTEND, stdio: 'inherit' }
  );
}

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const cat = require(path.join(CACHE, 'utils', 'catalogData.js'));
const pltQaqc = require(path.join(CACHE, 'utils', 'pltQaQcRules.js'));
const qaqc = require(path.join(CACHE, 'utils', 'qaQcRules.js'));
const mandatory = require(path.join(CACHE, 'utils', 'mandatoryRules.js'));
const gc = require(path.join(CACHE, 'utils', 'geomecColumns.js'));
const { useGridStore } = require(path.join(CACHE, 'features', 'grid', 'gridStore.js'));
const { PLT_SCHEMA_MAP } = require(path.join(CACHE, 'features', 'grid', 'schema', 'pltColumns.js'));

// Inicializar catálogos mínimos oficiales para resolver cascada y Factor K estricto
cat.initCatalogs({
  lithology_full: [
    { grupo: 'INTRUSIVOS', lito1: 'MZQ', lito2: 'MZQ', lito3: 'MZQ', k: 12.29 },
    { grupo: 'SEDIMENTARIOS', lito1: 'LMT', lito2: 'LMT', lito3: 'LMT_C', k: 16.83 },
    { grupo: 'METAMORFICAS', lito1: 'LMT', lito2: 'GSK', lito3: 'LMT_M', k: 11.15 },
  ],
  agua: [],
  resistencia: [],
  estructura: [],
  relleno: [],
  alteracion: [],
  rugosidad: [],
  forma: [],
  gsi_superficie: [
    { codigo: 'G', termino: 'Buena', desc: '', min: 27, max: 36 },
  ],
  gsi_estructura: [
    { codigo: 'VB', termino: 'Muy Blocosa', desc: '', min: 20, max: 30 },
  ],
});

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.log(`  ❌ ${msg}`);
  }
};

const baseHeader = {
  celda: 'AG57',
  este_from: 793100,
  norte_from: 8440000,
  cota_from: 3900,
  este_to: 793200,
  norte_to: 8440100,
  cota_to: 3905,
  lito_1: 'MZQ',
  lito_2: 'MZQ',
  lito_3: 'MZQ',
  unidad_litologica: 'INTRUSIVOS',
  gsi_estructura: 'VB',
  gsi_superficie: 'G',
};

function makePltRow(letter, idx, overrides = {}) {
  return gc.applyPltFormulas({
    id: 1000 + idx,
    campana: '2026',
    fecha_ensayo: '2026-05-10',
    ejecutado_por: 'ING. TEST',
    tipo_ensayo: 'i',
    nivel: 3900,
    celda_mapeo: 'AG57',
    muestra: letter,
    litologia_1: 'MZQ',
    litologia_2: 'MZQ',
    litologia_3: 'MZQ',
    tipo_litologico: 'INTRUSIVOS',
    este: 793120 + idx * 10,
    norte: 8440020 + idx * 10,
    elevacion: 3902 + idx * 0.2,
    espesor_d: 4.0,
    longitud_l: 6.0,
    ancho_w1: 6.0,
    ancho_w2: 6.4,
    fuerza_p: 12.0,
    direccion_rotura: 'Pa',
    tipo_fractura: 'M',
    factor_conversion_k: 12.29,
    zona_mapeo: 'FASE 5',
    observaciones: '',
    ...overrides,
  });
}

console.log('\n=== 1. CELDA_DUPLICADA (Cabecera Mapeo vs BD / Workspace) ===');
{
  const hDupDb = { ...baseHeader, celda: 'TEST-04' };
  const alDb = qaqc.validateWindowQAQC(hDupDb, [], 10, undefined, true, {
    dbCellNames: ['TEST_004', 'OTRA'],
    originalCelda: null,
    knownCells: ['AG57'],
  }).filter(a => a.ruleId === 'CELDA_DUPLICADA');
  ok(alDb.length === 1 && alDb[0].type === 'CRITICA', 'Detecta celda duplicada normalizada contra BD (TEST-04 vs TEST_004)');

  const alSelf = qaqc.validateWindowQAQC(hDupDb, [], 10, undefined, true, {
    dbCellNames: ['TEST_004'],
    originalCelda: 'TEST_004',
    knownCells: ['TEST_004'],
  }).filter(a => a.ruleId === 'CELDA_DUPLICADA');
  ok(alSelf.length === 0, 'Excluye el mismo nombre original al editar celda existente');

  const hDupWs = { ...baseHeader, celda: 'AG-057' };
  const alWs = qaqc.validateWindowQAQC(hDupWs, [], 10, undefined, true, {
    dbCellNames: [],
    originalCelda: null,
    knownCells: ['AG57'],
  }).filter(a => a.ruleId === 'CELDA_DUPLICADA');
  ok(alWs.length === 1 && alWs[0].type === 'CRITICA', 'Detecta duplicado equivalente contra workspace local');
}

console.log('\n=== 2. Caso válido completo (4 muestras A-B-C-D sin alertas) ===');
{
  const validRows = ['A', 'B', 'C', 'D'].map((m, i) => makePltRow(m, i));
  const alerts = pltQaqc.validatePltQAQC(validRows, baseHeader);
  const missing = mandatory.validatePltEnsayosList(validRows);
  ok(alerts.length === 0, `4 muestras válidas A-B-C-D producen 0 alertas QA/QC (obtuvo ${alerts.length})`);
  ok(missing.length === 0, `4 muestras válidas producen 0 vacíos obligatorios (obtuvo ${missing.length})`);
  ok(validRows[0].codigo_muestra === 'AG57A' && validRows[3].codigo_muestra === 'AG57D', 'codigo_muestra concatenado sin guion bajo (AG57A..AG57D)');
}

console.log('\n=== 3. 4 Muestras A-B-C-D y codigo_muestra sin guion ===');
{
  const emptyAlerts = pltQaqc.validatePltQAQC([], baseHeader);
  ok(emptyAlerts.length === 0, '0 filas PLT no bloquean celdas sin ensayos');

  const incomplete = ['A', 'B', 'C'].map((m, i) => makePltRow(m, i));
  const alInc = pltQaqc.validatePltQAQC(incomplete, baseHeader);
  ok(alInc.some(a => a.ruleId === 'PLT_MUESTRAS_CANTIDAD_ABCD' && a.type === 'CRITICA'), 'Menos de 4 muestras emite CRITICA');

  const excess = ['A', 'B', 'C', 'D', 'A'].map((m, i) => makePltRow(m, i));
  const alExc = pltQaqc.validatePltQAQC(excess, baseHeader);
  ok(alExc.some(a => a.ruleId === 'PLT_MUESTRAS_CANTIDAD_ABCD' && a.type === 'CRITICA'), 'Más de 4 muestras emite CRITICA');
  ok(alExc.some(a => a.ruleId === 'PLT_MUESTRA_DUPLICADA' && a.type === 'CRITICA'), 'Muestra duplicada en la celda emite CRITICA');

  const unordered = ['B', 'A', 'D', 'C'].map((m, i) => makePltRow(m, i));
  const alOrd = pltQaqc.validatePltQAQC(unordered, baseHeader);
  ok(alOrd.some(a => a.ruleId === 'PLT_MUESTRAS_ORDEN_ABCD' && a.type === 'ADVERTENCIA'), 'Orden != A-B-C-D emite ADVERTENCIA');

  const badLetter = ['A', 'B', 'C', 'E'].map((m, i) => makePltRow(m, i));
  const alLet = pltQaqc.validatePltQAQC(badLetter, baseHeader);
  ok(alLet.some(a => a.ruleId === 'PLT_MUESTRA_INVALIDA' && a.type === 'CRITICA'), 'Letra E fuera de A-D emite CRITICA');

  const withUnderscore = ['A', 'B', 'C', 'D'].map((m, i) => makePltRow(m, i));
  withUnderscore[0].codigo_muestra = 'AG57_A';
  const alCod = pltQaqc.validatePltQAQC(withUnderscore, baseHeader);
  ok(alCod.some(a => a.ruleId === 'PLT_CODIGO_MUESTRA_SIN_GUION' && a.type === 'CRITICA'), 'Código con guion bajo AG57_A emite CRITICA');
}

console.log('\n=== 4. Coordenadas distintas, limites FROM-TO y tolerancia Elevacion ===');
{
  const rows = ['A', 'B', 'C', 'D'].map((m, i) => makePltRow(m, i));
  // B tiene mismas coords que A
  rows[1].este = rows[0].este;
  rows[1].norte = rows[0].norte;
  rows[1].elevacion = rows[0].elevacion;
  // C fuera de FROM-TO (Este = 793500 > 793200) y Elevación +1.25 m (ADVERTENCIA 1.0–1.5 m)
  rows[2].este = 793500;
  rows[2].elevacion = 3906.25;
  // D Elevación +2.0 m (> 1.5 m -> CRITICA)
  rows[3].elevacion = 3907.0;

  const al = pltQaqc.validatePltQAQC(rows, baseHeader);
  ok(al.some(a => a.ruleId === 'PLT_COORD_DUPLICADAS' && a.type === 'CRITICA' && a.fieldId === 'plt-este-1'), 'Coordenadas duplicadas dentro de celda -> CRITICA');
  ok(al.some(a => a.ruleId === 'PLT_COORD_FUERA_FROM_TO' && a.type === 'CRITICA' && a.fieldId === 'plt-este-2'), 'Este fuera de FROM-TO -> CRITICA');
  ok(al.some(a => a.ruleId === 'PLT_ELEVACION_VARIACION_MAPEO' && a.type === 'ADVERTENCIA' && a.fieldId === 'plt-elevacion-2'), 'Elevación entre 1.0 y 1.5 m del mapeo -> ADVERTENCIA');
  ok(al.some(a => a.ruleId === 'PLT_ELEVACION_FUERA_MAPEO' && a.type === 'CRITICA' && a.fieldId === 'plt-elevacion-3'), 'Elevación > 1.5 m del mapeo -> CRITICA');
}

console.log('\n=== 5. Litologia distinta a Mapeo y Factor K contra litologia declarada ===');
{
  const rows = ['A', 'B', 'C', 'D'].map((m, i) => makePltRow(m, i));
  // A cambia litología a LMT/LMT/LMT_C (K oficial 16.83): distinta a mapeo (MZQ), pero K coherente (16.83)
  rows[0].litologia_1 = 'LMT';
  rows[0].litologia_2 = 'LMT';
  rows[0].litologia_3 = 'LMT_C';
  rows[0].factor_conversion_k = 16.83;
  // B cambia litología a LMT/LMT/LMT_C pero mantiene K=12.29 (mismatch contra SU litología)
  rows[1].litologia_1 = 'LMT';
  rows[1].litologia_2 = 'LMT';
  rows[1].litologia_3 = 'LMT_C';
  rows[1].factor_conversion_k = 12.29;
  // C tiene K=35 fuera de rango [5, 30]
  rows[2].factor_conversion_k = 35;

  const al = pltQaqc.validatePltQAQC(rows, baseHeader);
  const litoWarn0 = al.find(a => a.ruleId === 'PLT_LITOLOGIA_DISTINTA_MAPEO' && a.fieldId === 'plt-litologia_1-0');
  ok(litoWarn0 && litoWarn0.type === 'ADVERTENCIA' && litoWarn0.message.startsWith('No es la litología que registró en mapeo.'), 'Litología distinta a Mapeo -> ADVERTENCIA con mensaje exacto');
  ok(!al.some(a => a.ruleId === 'PLT_FACTOR_K_INCONGRUENTE' && a.fieldId === 'plt-factor_conversion_k-0'), 'K=16.83 coherente con LMT/LMT/LMT_C del muestreo NO marca error contra Mapeo');
  ok(al.some(a => a.ruleId === 'PLT_FACTOR_K_INCONGRUENTE' && a.type === 'ADVERTENCIA' && a.fieldId === 'plt-factor_conversion_k-1'), 'K=12.29 no asociado a LMT_C declarada -> ADVERTENCIA');
  ok(al.some(a => a.ruleId === 'PLT_FACTOR_K_RANGO' && a.type === 'CRITICA' && a.fieldId === 'plt-factor_conversion_k-2'), 'K=35 fuera de [5, 30] -> CRITICA');
}

console.log('\n=== 6. Geometria 0.3W < D < W, L >= D, De +-0.005 cm y Carga P / Observaciones ===');
{
  const rows = ['A', 'B', 'C', 'D'].map((m, i) => makePltRow(m, i));
  // A: D=6.5 >= W=6.2 -> geometría fuera de norma ADVERTENCIA y is_50 debe ser null
  rows[0] = makePltRow('A', 0, { espesor_d: 6.5, longitud_l: 5.0, ancho_w1: 6.2, ancho_w2: 6.2 });
  // B: _raw_de excede ±0.005 cm
  rows[1]._raw_de = rows[1].diametro_equivalente + 0.008;
  // C: _raw_de dentro de ±0.005 cm (0.004 cm) y P = 58 kN (55-60 ADVERTENCIA)
  rows[2]._raw_de = rows[2].diametro_equivalente + 0.004;
  rows[2].fuerza_p = 58.0;
  // D: P = 64 kN (>60) con observaciones vacía -> ADVERTENCIA de verificación + VACIO obligatorio
  rows[3].fuerza_p = 64.0;
  rows[3].observaciones = '';

  const al = pltQaqc.validatePltQAQC(rows, baseHeader);
  const miss = mandatory.validatePltEnsayosList(rows);

  ok(rows[0].muestra_valida_ancho === 'NO' && rows[0].is_50 === null, 'Si 0.3W < D < W es NO, is_50 no se calcula (null)');
  ok(al.some(a => a.ruleId === 'PLT_GEOMETRIA_FUERA_NORMA' && a.type === 'ADVERTENCIA' && a.fieldId === 'plt-espesor_d-0'), 'Geometría fuera de norma ASTM -> ADVERTENCIA');
  ok(al.some(a => a.ruleId === 'PLT_DIAMETRO_EQUIV_TOLERANCIA' && a.type === 'ADVERTENCIA' && a.fieldId === 'plt-diametro_equivalente-1'), 'De > ±0.005 cm -> ADVERTENCIA');
  ok(!al.some(a => a.ruleId === 'PLT_DIAMETRO_EQUIV_TOLERANCIA' && a.fieldId === 'plt-diametro_equivalente-2'), 'De dentro de ±0.005 cm no dispara alerta');
  ok(al.some(a => a.ruleId === 'PLT_CARGA_P_PRECAUCION' && a.type === 'ADVERTENCIA' && a.fieldId === 'plt-fuerza_p-2'), '55 < P <= 60 kN -> ADVERTENCIA');
  ok(al.some(a => a.ruleId === 'PLT_CARGA_P_VERIFICACION' && a.type === 'ADVERTENCIA' && a.fieldId === 'plt-fuerza_p-3'), 'P > 60 kN -> ADVERTENCIA de verificación');
  ok(miss.some(m => m.fieldKey === 'observaciones' && m.rowIndex === 4), 'P > 60 kN con Observaciones vacía -> VACIO obligatorio');

  rows[3].observaciones = 'Bloque de monzonita fresca';
  const missFilled = mandatory.validatePltEnsayosList(rows);
  ok(!missFilled.some(m => m.fieldKey === 'observaciones' && m.rowIndex === 4), 'Con Observaciones llena, ya no marca VACIO');
}

console.log('\n=== 7. Fractura M/E/C, GridStore (Factor K editable) y PltSchema ===');
{
  const muestraCol = PLT_SCHEMA_MAP.get('muestra');
  const deCol = PLT_SCHEMA_MAP.get('diametro_equivalente');
  ok(JSON.stringify(muestraCol.options) === JSON.stringify(['A', 'B', 'C', 'D']), 'pltColumns: muestra solo tiene opciones A, B, C, D');
  ok(deCol.header === 'De (cm)' && deCol.unit === 'cm', 'pltColumns: diámetro equivalente en cm');

  const badFrac = ['A', 'B', 'C', 'D'].map((m, i) => makePltRow(m, i));
  badFrac[0].tipo_fractura = 'M-E';
  const alFrac = pltQaqc.validatePltQAQC(badFrac, baseHeader);
  ok(alFrac.some(a => a.ruleId === 'PLT_TIPO_FRACTURA_INVALIDO' && a.type === 'CRITICA'), 'Tipo fractura M-E rechazado (solo M, E, C)');

  useGridStore.getState().setInitialRecords([makePltRow('A', 0)]);
  useGridStore.getState().updateCell(1000, 'factor_conversion_k', 15.5);
  useGridStore.getState().updateCell(1000, 'fuerza_p', 18.0);
  const afterP = useGridStore.getState().getRowById(1000);
  ok(afterP.factor_conversion_k === 15.5, 'gridStore conserva Factor K editado manualmente al cambiar Fuerza P');

  useGridStore.getState().updateCell(1000, 'litologia_1', 'LMT');
  useGridStore.getState().updateCell(1000, 'litologia_2', 'LMT');
  useGridStore.getState().updateCell(1000, 'litologia_3', 'LMT_C');
  const afterLito = useGridStore.getState().getRowById(1000);
  ok(afterLito.factor_conversion_k === 16.83, `gridStore recalcula Factor K al cambiar litología declarada (obtuvo ${afterLito.factor_conversion_k})`);
}

console.log(`\n${passed} pasaron, ${failed} fallaron\n`);
process.exit(failed > 0 ? 1 : 0);
