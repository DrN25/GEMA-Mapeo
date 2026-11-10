// src/features/grid/schema/pltColumns.ts
import type { ColumnSchema } from './types';
import {
  textColumn,
  decimalColumn,
  selectColumn,
  dateColumn,
  calculatedColumn,
  actionColumn
} from './columnFactories';
import {
  getLito2Options,
  getLito3Options,
  getIsrmClass,
  CAT_DIRECCION_ROTURA,
  CAT_TIPO_FRACTURA
} from '../../../utils/geomecColumns';
import { LITHOLOGY_CLASSIFICATION, resolveLithologyCascade } from '../../../utils/catalogData';
import { resolveExpectedKStrict } from '../../../utils/pltQaQcRules';
import { roundTo } from '../../../utils/numericPrecision';

const numOrNull = (v: any): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined || v === '') return null;
  const trimmed = String(v).trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

export const CAMPANA_OPTIONS = [
  '2019', '2020', '2021', '2022', '2023',
  '2024', '2025', '2026', '2027', '2028'
];

export const LITO1_OPTIONS = Array.from(
  new Set(LITHOLOGY_CLASSIFICATION.map(item => item.unidad))
).sort();

export const PLT_SCHEMA: ColumnSchema[] = [
  // =========================================================================
  // GRUPO 1: Columna de Índice / Fila Fija (Pinned Left)
  // =========================================================================
  actionColumn({
    id: 'row_num',
    header: '#',
    excelName: '#',
    group: '#',
    module: 'plt',
    defaultWidth: 46,
    minWidth: 40,
    maxWidth: 60,
    pinned: 'left',
    hint: 'Índice de la fila'
  }),

  // =========================================================================
  // GRUPO 2: Información General del Ensayo
  // =========================================================================
  selectColumn({
    id: 'campana',
    header: 'Campaña',
    excelName: 'Campaña',
    group: 'General',
    module: 'plt',
    defaultWidth: 95,
    minWidth: 80,
    options: CAMPANA_OPTIONS,
    emptyPolicy: 'block',
    hint: 'Año de la campaña'
  }),
  dateColumn({
    id: 'fecha_ensayo',
    header: 'Fecha Ensayo',
    excelName: 'Fecha de ensayo',
    group: 'General',
    module: 'plt',
    defaultWidth: 120,
    minWidth: 100,
    emptyPolicy: 'block',
    hint: 'Fecha de ejecución del ensayo PLT'
  }),
  textColumn({
    id: 'ejecutado_por',
    header: 'Ejecutado Por',
    excelName: 'Ejecutado por',
    group: 'General',
    module: 'plt',
    defaultWidth: 110,
    minWidth: 80,
    emptyPolicy: 'block',
    hint: 'Responsable técnico de la ejecución'
  }),
  selectColumn({
    id: 'tipo_ensayo',
    header: 'Tipo Ensayo',
    excelName: 'Tipo de ensayo',
    group: 'General',
    module: 'plt',
    defaultWidth: 90,
    minWidth: 70,
    options: ['i'],
    emptyPolicy: 'block',
    hint: 'i = Irregular'
  }),

  // =========================================================================
  // GRUPO 2: Identificación de Muestra
  // =========================================================================
  decimalColumn({
    id: 'nivel',
    header: 'Nivel',
    excelName: 'Nivel',
    group: 'Identificación de Muestra',
    module: 'plt',
    defaultWidth: 85,
    minWidth: 70,
    decimals: 2,
    constraints: { positiveOnly: true, maxHard: 4999 },
    emptyPolicy: 'block',
    hint: 'Banco o cota de nivel'
  }),
  textColumn({
    id: 'celda_mapeo',
    header: 'Celda',
    excelName: 'Celda de mapeo',
    group: 'Identificación de Muestra',
    module: 'plt',
    defaultWidth: 110,
    minWidth: 80,
    emptyPolicy: 'block',
    hint: 'Código de celda / estación de mapeo'
  }),
  selectColumn({
    id: 'muestra',
    header: 'Muestra',
    excelName: 'Muestra',
    group: 'Identificación de Muestra',
    module: 'plt',
    defaultWidth: 80,
    minWidth: 60,
    options: ['A', 'B', 'C', 'D'],
    emptyPolicy: 'block',
    customValidators: [
      (val: any, row: Record<string, any>) => {
        const s = String(val || '').trim().toUpperCase();
        if (!['A', 'B', 'C', 'D'].includes(s)) {
          return {
            rowId: Number(row.id || row.idd || 0),
            field: 'muestra',
            type: 'CRÍTICO',
            message: `Muestra '${val}' inválida: solo se permiten A, B, C o D`,
            value: val
          };
        }
        return null;
      }
    ],
    hint: 'Letra de muestra obligatoria (A, B, C o D)'
  }),
  calculatedColumn({
    id: 'codigo_muestra',
    header: 'Código Muestra',
    excelName: 'Código de muestra',
    group: 'Identificación de Muestra',
    module: 'plt',
    defaultWidth: 125,
    minWidth: 95,
    format: (val: any) => (val === null || val === undefined ? '' : String(val)),
    calculate: (row: Record<string, any>) => {
      const c = String(row.celda_mapeo || '').trim().toUpperCase();
      const m = String(row.muestra || '').trim().toUpperCase();
      return c ? (m ? `${c}${m}` : c) : (m || '');
    },
    hint: 'Generado automáticamente: {Celda}{Muestra} (sin guion)'
  }),
  selectColumn({
    id: 'litologia_1',
    header: 'Lito 1',
    excelName: 'Litología 1',
    group: 'Identificación de Muestra',
    module: 'plt',
    defaultWidth: 100,
    minWidth: 80,
    options: LITO1_OPTIONS,
    emptyPolicy: 'block',
    hint: 'Unidad litológica principal'
  }),
  selectColumn({
    id: 'litologia_2',
    header: 'Lito 2',
    excelName: 'Litología 2',
    group: 'Identificación de Muestra',
    module: 'plt',
    defaultWidth: 100,
    minWidth: 80,
    getDynamicOptions: (row: Record<string, any>) => getLito2Options(row.litologia_1),
    hint: 'Litología dependiente de Lito 1'
  }),
  selectColumn({
    id: 'litologia_3',
    header: 'Lito 3',
    excelName: 'Litología 3',
    group: 'Identificación de Muestra',
    module: 'plt',
    defaultWidth: 100,
    minWidth: 80,
    getDynamicOptions: (row: Record<string, any>) => getLito3Options(row.litologia_1, row.litologia_2),
    hint: 'Código específico dependiente de Lito 1 y 2'
  }),
  calculatedColumn({
    id: 'tipo_litologico',
    header: 'Tipo Litológico',
    excelName: 'Tipo litológico',
    group: 'Identificación de Muestra',
    module: 'plt',
    defaultWidth: 130,
    minWidth: 100,
    format: (val: any) => (val === null || val === undefined ? '' : String(val)),
    calculate: (row: Record<string, any>) => {
      if (!row.litologia_1 && !row.litologia_2 && !row.litologia_3 && !row.model2022) return '';
      const res = resolveLithologyCascade(row.litologia_1, row.litologia_2, row.litologia_3, row.model2022 || null);
      return res.clase || '';
    },
    hint: 'Clase litológica resuelta por cascada'
  }),

  // =========================================================================
  // GRUPO 3: Coordenadas WGS84
  // =========================================================================
  decimalColumn({
    id: 'este',
    header: 'Este',
    excelName: 'Este (m)',
    group: 'Coordenadas WGS84',
    module: 'plt',
    defaultWidth: 100,
    minWidth: 80,
    decimals: 2,
    unit: 'm',
    constraints: { positiveOnly: true, minHard: 0 },
    emptyPolicy: 'block',
    hint: 'Coordenada Este en metros'
  }),
  decimalColumn({
    id: 'norte',
    header: 'Norte',
    excelName: 'Norte (m)',
    group: 'Coordenadas WGS84',
    module: 'plt',
    defaultWidth: 110,
    minWidth: 80,
    decimals: 2,
    unit: 'm',
    constraints: { positiveOnly: true, minHard: 0 },
    emptyPolicy: 'block',
    hint: 'Coordenada Norte en metros'
  }),
  decimalColumn({
    id: 'elevacion',
    header: 'Elevación',
    excelName: 'Elevación (msnm)',
    group: 'Coordenadas WGS84',
    module: 'plt',
    defaultWidth: 100,
    minWidth: 80,
    decimals: 2,
    unit: 'msnm',
    emptyPolicy: 'block',
    hint: 'Cota de elevación'
  }),

  // =========================================================================
  // GRUPO 4: Geometría del Bloque Irregular
  // =========================================================================
  decimalColumn({
    id: 'espesor_d',
    header: 'Espesor D',
    excelName: 'Espesor D (cm)',
    group: 'Geometría del Bloque',
    module: 'plt',
    defaultWidth: 95,
    minWidth: 75,
    decimals: 2,
    unit: 'cm',
    constraints: { positiveOnly: true, minHard: 0.1 },
    emptyPolicy: 'block',
    hint: 'Espesor de la probeta irregular (cm)'
  }),
  decimalColumn({
    id: 'longitud_l',
    header: 'Longitud L',
    excelName: 'Longitud L (cm)',
    group: 'Geometría del Bloque',
    module: 'plt',
    defaultWidth: 95,
    minWidth: 75,
    decimals: 2,
    unit: 'cm',
    constraints: { positiveOnly: true, minHard: 0.1 },
    emptyPolicy: 'block',
    hint: 'Longitud de la probeta irregular (cm)'
  }),
  decimalColumn({
    id: 'ancho_w1',
    header: 'Ancho W1',
    excelName: 'Ancho W1 (cm)',
    group: 'Geometría del Bloque',
    module: 'plt',
    defaultWidth: 95,
    minWidth: 75,
    decimals: 2,
    unit: 'cm',
    constraints: { positiveOnly: true, minHard: 0.1 },
    emptyPolicy: 'block',
    hint: 'Primer ancho de la probeta (cm)'
  }),
  decimalColumn({
    id: 'ancho_w2',
    header: 'Ancho W2',
    excelName: 'Ancho W2 (cm)',
    group: 'Geometría del Bloque',
    module: 'plt',
    defaultWidth: 95,
    minWidth: 75,
    decimals: 2,
    unit: 'cm',
    constraints: { positiveOnly: true, minHard: 0.1 },
    emptyPolicy: 'block',
    hint: 'Segundo ancho de la probeta (cm)'
  }),
  calculatedColumn({
    id: 'ancho_w',
    header: 'Ancho W',
    excelName: 'Ancho W (cm)',
    group: 'Geometría del Bloque',
    module: 'plt',
    defaultWidth: 95,
    minWidth: 75,
    decimals: 2,
    unit: 'cm',
    calculate: (row: Record<string, any>) => {
      const w1 = numOrNull(row.ancho_w1);
      const w2 = numOrNull(row.ancho_w2);
      return (w1 !== null && w2 !== null) ? roundTo((w1 + w2) / 2, 2) : null;
    },
    hint: 'Promedio: (W1 + W2) / 2'
  }),
  calculatedColumn({
    id: 'muestra_valida_longitud',
    header: 'Válida Long.',
    excelName: 'Muestra válida longitud',
    group: 'Geometría del Bloque',
    module: 'plt',
    defaultWidth: 105,
    minWidth: 85,
    format: (val: any) => (val === null || val === undefined ? '' : String(val)),
    calculate: (row: Record<string, any>) => {
      const l = numOrNull(row.longitud_l);
      const d = numOrNull(row.espesor_d);
      if (l !== null && d !== null) {
        return l >= d ? 'SÍ' : 'NO';
      }
      return null;
    },
    hint: 'Condición: L >= D (distancia mín. 0.5D)'
  }),
  calculatedColumn({
    id: 'muestra_valida_ancho',
    header: 'Válida Ancho',
    excelName: 'Muestra válida ancho',
    group: 'Geometría del Bloque',
    module: 'plt',
    defaultWidth: 105,
    minWidth: 85,
    format: (val: any) => (val === null || val === undefined ? '' : String(val)),
    calculate: (row: Record<string, any>) => {
      const d = numOrNull(row.espesor_d);
      const w = numOrNull(row.ancho_w);
      if (d !== null && w !== null) {
        return (d > 0.3 * w && d < w) ? 'SÍ' : 'NO';
      }
      return null;
    },
    hint: 'Condición: 0.3*W < D < W'
  }),

  // =========================================================================
  // GRUPO 5: Datos del Ensayo
  // =========================================================================
  decimalColumn({
    id: 'fuerza_p',
    header: 'Fuerza P',
    excelName: 'Fuerza P (kN)',
    group: 'Datos del Ensayo',
    module: 'plt',
    defaultWidth: 95,
    minWidth: 75,
    decimals: 2,
    unit: 'kN',
    constraints: { positiveOnly: true, minHard: 0.01 },
    emptyPolicy: 'block',
    customValidators: [
      (val: any, row: Record<string, any>) => {
        const p = Number(val);
        if (!Number.isFinite(p)) return null;
        if (p > 60) {
          return {
            rowId: Number(row.id || row.idd || 0),
            field: 'fuerza_p',
            type: 'AVISO',
            message: `Carga P = ${p} kN (> 60 kN): alerta de verificación. Obligatorio comentar en Observaciones.`,
            value: val
          };
        }
        if (p > 55) {
          return {
            rowId: Number(row.id || row.idd || 0),
            field: 'fuerza_p',
            type: 'AVISO',
            message: `Carga P = ${p} kN supera 55 kN (precaución 55–60 kN).`,
            value: val
          };
        }
        return null;
      }
    ],
    hint: 'Carga de rotura P en kilonewtons (evitar > 55–60 kN; >60 kN exige comentario)'
  }),
  selectColumn({
    id: 'direccion_rotura',
    header: 'Dir. Rotura',
    excelName: 'Dirección rotura',
    group: 'Datos del Ensayo',
    module: 'plt',
    defaultWidth: 100,
    minWidth: 80,
    options: CAT_DIRECCION_ROTURA,
    emptyPolicy: 'block',
    hint: 'Pa = Paralelo, Pe = Perpendicular, NA = No Aplica'
  }),
  selectColumn({
    id: 'tipo_fractura',
    header: 'Tipo Fractura',
    excelName: 'Tipo fractura',
    group: 'Datos del Ensayo',
    module: 'plt',
    defaultWidth: 100,
    minWidth: 80,
    options: CAT_TIPO_FRACTURA,
    emptyPolicy: 'block',
    hint: 'M = Matriz (roca intacta), E = Estructura, C = Combinada'
  }),

  // =========================================================================
  // GRUPO 6: Cálculo de Índice de Carga Puntual
  // =========================================================================
  calculatedColumn({
    id: 'diametro_equivalente',
    header: 'De (cm)',
    excelName: 'Diámetro equivalente (cm)',
    group: 'Índice de Carga Puntual',
    module: 'plt',
    defaultWidth: 110,
    minWidth: 85,
    decimals: 4,
    unit: 'cm',
    calculate: (row: Record<string, any>) => {
      const d = numOrNull(row.espesor_d);
      const w = numOrNull(row.ancho_w);
      return (d !== null && w !== null && d > 0 && w > 0)
        ? roundTo(Math.sqrt((4 * d * w) / Math.PI), 4)
        : null;
    },
    hint: 'De = sqrt(4 * D * W / PI) en cm'
  }),
  calculatedColumn({
    id: 'f',
    header: 'F (Factor)',
    excelName: 'Factor F',
    group: 'Índice de Carga Puntual',
    module: 'plt',
    defaultWidth: 90,
    minWidth: 70,
    decimals: 4,
    calculate: (row: Record<string, any>) => {
      const de = numOrNull(row.diametro_equivalente);
      return (de !== null && de > 0)
        ? roundTo(Math.pow((de * 10) / 50, 0.45), 4)
        : null;
    },
    hint: 'F = ((De * 10) / 50) ^ 0.45'
  }),
  calculatedColumn({
    id: 'is_mpa',
    header: 'Is (MPa)',
    excelName: 'Is (MPa)',
    group: 'Índice de Carga Puntual',
    module: 'plt',
    defaultWidth: 95,
    minWidth: 75,
    decimals: 4,
    unit: 'MPa',
    calculate: (row: Record<string, any>) => {
      const p = numOrNull(row.fuerza_p);
      const de = numOrNull(row.diametro_equivalente);
      return (p !== null && de !== null && de > 0)
        ? roundTo((p * 1000) / Math.pow(de * 10, 2), 4)
        : null;
    },
    hint: 'Is = (P * 1000) / (De * 10)^2'
  }),
  calculatedColumn({
    id: 'is_50',
    header: 'Is(50) (MPa)',
    excelName: 'Is(50) (MPa)',
    group: 'Índice de Carga Puntual',
    module: 'plt',
    defaultWidth: 105,
    minWidth: 85,
    decimals: 4,
    unit: 'MPa',
    calculate: (row: Record<string, any>) => {
      const isMpa = numOrNull(row.is_mpa);
      const f = numOrNull(row.f);
      if (row.muestra_valida_ancho === 'SÍ' && isMpa !== null && f !== null) {
        return roundTo(isMpa * f, 4);
      }
      return null;
    },
    hint: 'Is(50) = Is * F (solo si muestra válida ancho == SÍ)'
  }),

  // =========================================================================
  // GRUPO 7: Resistencia de la Roca Intacta
  // =========================================================================
  decimalColumn({
    id: 'factor_conversion_k',
    header: 'Factor K',
    excelName: 'Factor de conversión K',
    group: 'Resistencia Intacta',
    module: 'plt',
    defaultWidth: 90,
    minWidth: 70,
    decimals: 2,
    constraints: { positiveOnly: true, minHard: 5, maxHard: 30 },
    emptyPolicy: 'allowed',
    customValidators: [
      (val: any, row: Record<string, any>) => {
        const kNum = Number(val);
        if (!Number.isFinite(kNum)) return null;
        const expected = resolveExpectedKStrict(row);
        if (expected !== null && Math.abs(kNum - expected) > 0.1) {
          return {
            rowId: Number(row.id || row.idd || 0),
            field: 'factor_conversion_k',
            type: 'AVISO',
            message: `Factor K (${kNum}) no corresponde a la litología declarada (esperado: ${expected})`,
            value: val
          };
        }
        return null;
      }
    ],
    hint: 'Factor K según litología del muestreo (autocompletado desde catálogo o editable [5–30])'
  }),
  calculatedColumn({
    id: 'ucs',
    header: 'UCS (MPa)',
    excelName: 'UCS (MPa)',
    group: 'Resistencia Intacta',
    module: 'plt',
    defaultWidth: 100,
    minWidth: 80,
    decimals: 3,
    unit: 'MPa',
    calculate: (row: Record<string, any>) => {
      const is50 = numOrNull(row.is_50);
      const k = numOrNull(row.factor_conversion_k);
      return (is50 !== null && k !== null)
        ? roundTo(is50 * k, 3)
        : null;
    },
    hint: 'UCS = Is(50) * K'
  }),
  calculatedColumn({
    id: 'resistencia_isrm',
    header: 'ISRM',
    excelName: 'Resistencia ISRM',
    group: 'Resistencia Intacta',
    module: 'plt',
    defaultWidth: 85,
    minWidth: 65,
    format: (val: any) => (val === null || val === undefined ? '' : String(val)),
    calculate: (row: Record<string, any>) => {
      const ucs = numOrNull(row.ucs);
      if (ucs === null) return null;
      const cls = getIsrmClass(ucs);
      return cls ? cls.indice : null;
    },
    hint: 'Clasificación ISRM (R0 a R6)'
  }),

  // =========================================================================
  // GRUPO 8: Observaciones y Ubicación
  // =========================================================================
  textColumn({
    id: 'sector_geotecnico',
    header: 'Sector Geot.',
    excelName: 'Sector geotécnico',
    group: 'Observaciones y Ubicación',
    module: 'plt',
    defaultWidth: 110,
    minWidth: 85,
    hint: 'Sector geotécnico asignado'
  }),
  textColumn({
    id: 'zona_mapeo',
    header: 'Zona Mapeo',
    excelName: 'Zona de mapeo',
    group: 'Observaciones y Ubicación',
    module: 'plt',
    defaultWidth: 120,
    minWidth: 90,
    emptyPolicy: 'block',
    hint: 'Zona de muestreo / mapeo'
  }),
  textColumn({
    id: 'observaciones',
    header: 'Observaciones',
    excelName: 'Observaciones',
    group: 'Observaciones y Ubicación',
    module: 'plt',
    defaultWidth: 180,
    minWidth: 120,
    hint: 'Notas o comentarios sobre la probeta'
  }),

  // =========================================================================
  // GRUPO 9: Acciones Fijas (Pinned Right)
  // =========================================================================
  actionColumn({
    id: 'acciones_col',
    header: 'Acciones',
    excelName: 'Acciones',
    group: 'Acciones',
    module: 'plt',
    defaultWidth: 85,
    minWidth: 75,
    pinned: 'right',
    hint: 'Operaciones sobre la fila'
  })
];

export const PLT_SCHEMA_MAP = new Map<string, ColumnSchema>(
  PLT_SCHEMA.map(col => [col.id, col])
);
