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
  textColumn({
    id: 'muestra',
    header: 'Muestra',
    excelName: 'Muestra',
    group: 'Identificación de Muestra',
    module: 'plt',
    defaultWidth: 80,
    minWidth: 60,
    emptyPolicy: 'block',
    hint: 'Número de muestra / probeta'
  }),
  calculatedColumn({
    id: 'codigo_muestra',
    header: 'Código Muestra',
    excelName: 'Código de muestra',
    group: 'Identificación de Muestra',
    module: 'plt',
    defaultWidth: 125,
    minWidth: 95,
    calculate: (row: Record<string, any>) => {
      const c = String(row.celda_mapeo || '').trim().toUpperCase();
      const m = String(row.muestra || '').trim();
      return c ? (m ? `${c}_${m}` : c) : (m || '');
    },
    hint: 'Generado automáticamente: Celda_Muestra'
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
    calculate: (row: Record<string, any>) => {
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
      const w1 = row.ancho_w1 !== null && row.ancho_w1 !== undefined && row.ancho_w1 !== '' ? Number(row.ancho_w1) : null;
      const w2 = row.ancho_w2 !== null && row.ancho_w2 !== undefined && row.ancho_w2 !== '' ? Number(row.ancho_w2) : null;
      return (w1 !== null && w2 !== null && !isNaN(w1) && !isNaN(w2)) ? Number(((w1 + w2) / 2).toFixed(2)) : null;
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
    calculate: (row: Record<string, any>) => {
      const l = Number(row.longitud_l);
      const d = Number(row.espesor_d);
      if (row.longitud_l != null && row.espesor_d != null && !isNaN(l) && !isNaN(d)) {
        return l >= d ? 'SÍ' : 'NO';
      }
      return null;
    },
    hint: 'Condición: L >= D'
  }),
  calculatedColumn({
    id: 'muestra_valida_ancho',
    header: 'Válida Ancho',
    excelName: 'Muestra válida ancho',
    group: 'Geometría del Bloque',
    module: 'plt',
    defaultWidth: 105,
    minWidth: 85,
    calculate: (row: Record<string, any>) => {
      const d = Number(row.espesor_d);
      const w = Number(row.ancho_w);
      if (row.espesor_d != null && row.ancho_w != null && !isNaN(d) && !isNaN(w)) {
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
    hint: 'Carga de rotura P en kilonewtons'
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
    hint: 'M = Matriz, E = Estructura, C = Combinada'
  }),

  // =========================================================================
  // GRUPO 6: Cálculo de Índice de Carga Puntual
  // =========================================================================
  calculatedColumn({
    id: 'diametro_equivalente',
    header: 'De (mm)',
    excelName: 'Diámetro equivalente (mm)',
    group: 'Índice de Carga Puntual',
    module: 'plt',
    defaultWidth: 110,
    minWidth: 85,
    decimals: 4,
    calculate: (row: Record<string, any>) => {
      const d = Number(row.espesor_d);
      const w = Number(row.ancho_w);
      return (d && w && !isNaN(d) && !isNaN(w))
        ? Number(Math.sqrt((4 * d * w) / Math.PI).toFixed(4))
        : null;
    },
    hint: 'De = sqrt(4 * D * W / PI)'
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
      const de = Number(row.diametro_equivalente);
      return (de && !isNaN(de))
        ? Number(Math.pow((de * 10) / 50, 0.45).toFixed(4))
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
      const p = Number(row.fuerza_p);
      const de = Number(row.diametro_equivalente);
      return (p && de && de > 0 && !isNaN(p) && !isNaN(de))
        ? Number(((p * 1000) / Math.pow(de * 10, 2)).toFixed(4))
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
      const isMpa = Number(row.is_mpa);
      const f = Number(row.f);
      if (row.muestra_valida_ancho === 'SÍ' && !isNaN(isMpa) && !isNaN(f) && row.is_mpa !== null && row.f !== null) {
        return Number((isMpa * f).toFixed(4));
      }
      return null;
    },
    hint: 'Is(50) = Is * F (solo si muestra válida ancho == SÍ)'
  }),

  // =========================================================================
  // GRUPO 7: Resistencia de la Roca Intacta
  // =========================================================================
  calculatedColumn({
    id: 'factor_conversion_k',
    header: 'Factor K',
    excelName: 'Factor de conversión K',
    group: 'Resistencia Intacta',
    module: 'plt',
    defaultWidth: 90,
    minWidth: 70,
    decimals: 2,
    calculate: (row: Record<string, any>) => {
      const res = resolveLithologyCascade(row.litologia_1, row.litologia_2, row.litologia_3, row.model2022 || null);
      return res.k !== null ? Number(res.k) : null;
    },
    hint: 'Factor K litológico oficial'
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
      const is50 = Number(row.is_50);
      const k = Number(row.factor_conversion_k);
      return (!isNaN(is50) && !isNaN(k) && row.is_50 !== null && row.factor_conversion_k !== null)
        ? Number((is50 * k).toFixed(3))
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
    calculate: (row: Record<string, any>) => {
      const ucs = Number(row.ucs);
      if (row.ucs === null || isNaN(ucs)) return null;
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
