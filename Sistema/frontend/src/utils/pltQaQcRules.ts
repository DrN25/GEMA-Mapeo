/**
 * utils/pltQaQcRules.ts — SSOT de reglas QA/QC para Ensayos PLT Irregulares en Interfaz.
 *
 * Complementa las reglas de campos obligatorios (mandatoryRules.ts) y valida:
 *   1. 4 muestras obligatorias por celda con letras A, B, C, D (sin duplicados y orden A-B-C-D).
 *   2. Concatenación código_muestra = {celda}{muestra} sin guion bajo (ej. AG57A).
 *   3. Coordenadas distintas entre las 4 muestras de la misma celda.
 *   4. Coordenadas (Este, Norte) dentro de los límites FROM–TO del mapeo de la celda.
 *   5. Elevación similar al rango Cota FROM–TO del mapeo (1.0–1.5 m advertencia; >1.5 m crítica).
 *   6. Comparación litológica contra Mapeo ("No es la litología que registró en mapeo.").
 *   7. Factor K coherente con la litología declarada en el ensayo (advertencia) y rango [5, 30] (crítica).
 *   8. Geometría ASTM/ISRM (0.3W < D < W y L >= D) + tolerancia ±0.005 cm en Diámetro Equivalente De.
 *   9. Carga aplicada P (55 < P <= 60 kN advertencia; P > 60 kN alerta de verificación + Obs obligatoria).
 *  10. Catálogos de dirección de rotura (Pa/Pe/NA) y tipo de fractura (M/E/C).
 */

import type { WindowHeader } from './rmrCalculator';
import type { QaQcAlert, QaQcSeverity } from './qaQcRules';
import {
  LITHOLOGY_CLASSIFICATION,
  EQUIVALENCIAS_MIGRACION,
} from './catalogData';

export interface PltQaQcRuleDef {
  id: string;
  severity: QaQcSeverity;
  description: string;
}

export const PLT_QAQC_RULE_REGISTRY: Record<string, PltQaQcRuleDef> = {
  PLT_MUESTRA_INVALIDA: {
    id: 'PLT_MUESTRA_INVALIDA',
    severity: 'CRITICA',
    description: 'Letra de muestra debe pertenecer a las 4 opciones (A, B, C o D).',
  },
  PLT_MUESTRA_DUPLICADA: {
    id: 'PLT_MUESTRA_DUPLICADA',
    severity: 'CRITICA',
    description: 'Muestra duplicada (A/B/C/D) dentro de la misma celda de mapeo.',
  },
  PLT_MUESTRAS_CANTIDAD_ABCD: {
    id: 'PLT_MUESTRAS_CANTIDAD_ABCD',
    severity: 'CRITICA',
    description: 'Cada celda con ensayos PLT debe registrar obligatoriamente las 4 muestras A, B, C y D.',
  },
  PLT_MUESTRAS_ORDEN_ABCD: {
    id: 'PLT_MUESTRAS_ORDEN_ABCD',
    severity: 'ADVERTENCIA',
    description: 'Orden recomendado A, B, C, D dentro de la celda de mapeo.',
  },
  PLT_CODIGO_MUESTRA_SIN_GUION: {
    id: 'PLT_CODIGO_MUESTRA_SIN_GUION',
    severity: 'CRITICA',
    description: 'El código de muestra debe generarse como {celda}{muestra} sin guiones ni separadores (ej. AG57A).',
  },
  PLT_COORD_DUPLICADAS: {
    id: 'PLT_COORD_DUPLICADAS',
    severity: 'CRITICA',
    description: 'Las coordenadas (Este, Norte, Elevación) deben ser distintas para las 4 muestras de una celda.',
  },
  PLT_COORD_FUERA_FROM_TO: {
    id: 'PLT_COORD_FUERA_FROM_TO',
    severity: 'CRITICA',
    description: 'Las coordenadas Este y Norte de cada muestra deben estar dentro del rango FROM–TO del mapeo.',
  },
  PLT_ELEVACION_FUERA_MAPEO: {
    id: 'PLT_ELEVACION_FUERA_MAPEO',
    severity: 'CRITICA',
    description: 'La elevación excede la tolerancia máxima de ±1.5 m respecto al rango Cota FROM–TO del mapeo.',
  },
  PLT_ELEVACION_VARIACION_MAPEO: {
    id: 'PLT_ELEVACION_VARIACION_MAPEO',
    severity: 'ADVERTENCIA',
    description: 'La elevación presenta variación de 1.0 a 1.5 m respecto al rango Cota FROM–TO del mapeo.',
  },
  PLT_LITOLOGIA_DISTINTA_MAPEO: {
    id: 'PLT_LITOLOGIA_DISTINTA_MAPEO',
    severity: 'ADVERTENCIA',
    description: 'La combinación litológica del ensayo PLT difiere de la registrada en Mapeo.',
  },
  PLT_FACTOR_K_RANGO: {
    id: 'PLT_FACTOR_K_RANGO',
    severity: 'CRITICA',
    description: 'Factor de conversión K fuera del rango admitido [5, 30].',
  },
  PLT_FACTOR_K_INCONGRUENTE: {
    id: 'PLT_FACTOR_K_INCONGRUENTE',
    severity: 'ADVERTENCIA',
    description: 'Factor de conversión K no coincide con el asociado a la litología declarada en muestreo.',
  },
  PLT_DIMENSION_NO_POSITIVA: {
    id: 'PLT_DIMENSION_NO_POSITIVA',
    severity: 'CRITICA',
    description: 'Dimensiones geométricas (D, L, W1, W2) deben ser positivas (> 0).',
  },
  PLT_GEOMETRIA_FUERA_NORMA: {
    id: 'PLT_GEOMETRIA_FUERA_NORMA',
    severity: 'ADVERTENCIA',
    description: 'Geometría de probeta irregular fuera de norma ASTM/ISRM (0.3W < D < W y L >= D).',
  },
  PLT_DIAMETRO_EQUIV_TOLERANCIA: {
    id: 'PLT_DIAMETRO_EQUIV_TOLERANCIA',
    severity: 'ADVERTENCIA',
    description: 'Diámetro equivalente importado (De) excede la tolerancia máxima de ±0.005 cm respecto a sqrt(4*D*W/pi).',
  },
  PLT_FUERZA_P_NO_POSITIVA: {
    id: 'PLT_FUERZA_P_NO_POSITIVA',
    severity: 'CRITICA',
    description: 'La fuerza aplicada P (kN) debe ser positiva (> 0).',
  },
  PLT_CARGA_P_PRECAUCION: {
    id: 'PLT_CARGA_P_PRECAUCION',
    severity: 'ADVERTENCIA',
    description: 'La carga aplicada P supera 55 kN (precaución entre 55 y 60 kN).',
  },
  PLT_CARGA_P_VERIFICACION: {
    id: 'PLT_CARGA_P_VERIFICACION',
    severity: 'ADVERTENCIA',
    description: 'Carga aplicada P > 60 kN: alerta de verificación del registro (comentario obligatorio en Observaciones).',
  },
  PLT_TIPO_FRACTURA_INVALIDO: {
    id: 'PLT_TIPO_FRACTURA_INVALIDO',
    severity: 'CRITICA',
    description: 'Tipo de fractura debe ser M (matriz), E (estructura) o C (combinada).',
  },
  PLT_DIRECCION_ROTURA_INVALIDA: {
    id: 'PLT_DIRECCION_ROTURA_INVALIDA',
    severity: 'CRITICA',
    description: 'Dirección de rotura debe ser Pa, Pe, NA o N/A.',
  },
};

const VALID_MUESTRAS = ['A', 'B', 'C', 'D'] as const;
const VALID_MUESTRAS_SET = new Set<string>(VALID_MUESTRAS);
const VALID_FRACTURA_SET = new Set<string>(['M', 'E', 'C']);
const VALID_DIRECCION_SET = new Set<string>(['PA', 'PE', 'NA', 'N/A']);

const isBlankVal = (v: any): boolean => {
  if (v === undefined || v === null) return true;
  const s = String(v).trim();
  return s === '' || s === '-1';
};

const num = (v: any): number | null => {
  if (isBlankVal(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normLitoToken = (v: any): string => {
  if (v === undefined || v === null) return '';
  const s = String(v).trim().toUpperCase();
  if (!s || s === '-1' || s === '-' || s === 'NR') return '';
  return s;
};

function normalizeCeldaLocal(celda: string): string {
  if (!celda) return '';
  const raw = String(celda).trim().toUpperCase();
  const matches = raw.match(/[A-Z]+|[0-9]+/g);
  if (!matches) return raw;
  const normalizedSegments = matches.map(segment => {
    if (/^[0-9]+$/.test(segment)) {
      const parsed = parseInt(segment, 10);
      return isNaN(parsed) ? segment : String(parsed);
    }
    return segment;
  });
  let result = '';
  normalizedSegments.forEach((seg, idx) => {
    if (idx === 0) {
      result += seg;
    } else {
      const prev = normalizedSegments[idx - 1];
      const isCurrentNum = /^[0-9]+$/.test(seg);
      const isPrevNum = /^[0-9]+$/.test(prev);
      if ((isCurrentNum && isPrevNum) || (!isCurrentNum && isPrevNum)) {
        result += '-' + seg;
      } else {
        result += seg;
      }
    }
  });
  return result;
}

/**
 * Resuelve el Factor K oficial únicamente si la combinación litológica existe
 * genuinamente en el catálogo oficial o en EQUIVALENCIAS_MIGRACION (sin usar
 * el fallback por defecto 10.0). Retorna null si el catálogo no está cargado
 * o no hay coincidencia inequívoca.
 */
let _kCacheSignature = '';
let _kExact123 = new Map<string, number>();
let _kBy23 = new Map<string, number>();

function ensureKCache(): void {
  const n = LITHOLOGY_CLASSIFICATION.length;
  const first = LITHOLOGY_CLASSIFICATION[0];
  const last = LITHOLOGY_CLASSIFICATION[n - 1];
  const sig = `${n}|${first?.unidad || ''}|${first?.codigo || ''}|${last?.codigo || ''}|${last?.k ?? ''}`;
  if (sig === _kCacheSignature) return;
  _kCacheSignature = sig;
  _kExact123 = new Map<string, number>();
  _kBy23 = new Map<string, number>();
  for (const item of LITHOLOGY_CLASSIFICATION) {
    if (typeof item?.k !== 'number') continue;
    const iL1 = String(item.unidad || '').trim().toUpperCase();
    const iL2 = String(item.litologia || '').trim().toUpperCase();
    const rawL3 = String(item.codigo || '').trim().toUpperCase();
    const iL3 = !rawL3 || rawL3 === '-' ? 'NR' : rawL3;
    const k123 = `${iL1}|${iL2}|${iL3}`;
    if (!_kExact123.has(k123)) _kExact123.set(k123, item.k);
    const k23 = `${iL2}|${iL3}`;
    if (!_kBy23.has(k23)) _kBy23.set(k23, item.k);
  }
}

const SHIFTED_LITO_SET = new Set(['GSK', 'PSK', 'MSK', 'ESK', 'MBC', 'MBL', 'EPG', 'EGT']);

export function resolveExpectedKStrict(row: any): number | null {
  const cleanL1 = String(row?.litologia_1 || '').trim().toUpperCase();
  const cleanL2 = String(row?.litologia_2 || '').trim().toUpperCase();
  let cleanL3 = String(row?.litologia_3 || '').trim().toUpperCase();
  const m2022 = String(row?.model2022 || '').trim().toUpperCase();

  if (m2022) {
    if (m2022 === 'ENDO') return 9.87;
    if (EQUIVALENCIAS_MIGRACION[m2022]) return EQUIVALENCIAS_MIGRACION[m2022].k;
  }

  if (!LITHOLOGY_CLASSIFICATION || LITHOLOGY_CLASSIFICATION.length === 0) return null;
  if (!cleanL1 && !cleanL2) return null;

  if (!cleanL3 || cleanL3 === '-' || cleanL3 === '-1') cleanL3 = 'NR';

  const isShifted = SHIFTED_LITO_SET.has(cleanL1);

  const finalL1 = cleanL1;
  let finalL2 = cleanL2;
  let finalL3 = cleanL3;

  if (isShifted) {
    finalL2 = cleanL1;
    finalL3 = cleanL2 || 'NR';
  } else if (cleanL3.includes('/')) {
    finalL3 = cleanL3.split('/').pop()?.trim() || cleanL3;
  }

  const normFinalL3 = finalL3 === '-' || !finalL3 ? 'NR' : finalL3;
  ensureKCache();

  // 1. Búsqueda exacta por L1 + L2 + L3 (si L1 no fue desplazado)
  if (!isShifted && finalL1 && finalL2) {
    const kExact = _kExact123.get(`${finalL1}|${finalL2}|${normFinalL3}`);
    if (kExact !== undefined) return kExact;
  }

  // 2. Búsqueda por L2 + L3 (exacto, luego VARIOS, luego NR)
  if (finalL2) {
    const k23 = _kBy23.get(`${finalL2}|${normFinalL3}`);
    if (k23 !== undefined) return k23;
    const kVarios = _kBy23.get(`${finalL2}|VARIOS`);
    if (kVarios !== undefined) return kVarios;
    const kNr = _kBy23.get(`${finalL2}|NR`);
    if (kNr !== undefined) return kNr;
  }
  return null;
}

/**
 * Valida todos los ensayos PLT Irregulares en sesión contra las reglas QA/QC y,
 * cuando está disponible, contra la cabecera de la ventana de Mapeo activa.
 */
export function validatePltQAQC(
  pltEnsayos: any[],
  activeHeader?: WindowHeader | null,
): QaQcAlert[] {
  if (!Array.isArray(pltEnsayos) || pltEnsayos.length === 0) return [];

  const alerts: QaQcAlert[] = [];
  const SECTION = 'ENSAYOS PLT IRREGULARES';

  const hdrCeldaNorm = activeHeader?.celda ? normalizeCeldaLocal(activeHeader.celda) : '';

  const ef = num(activeHeader?.este_from);
  const nf = num(activeHeader?.norte_from);
  const cf = num(activeHeader?.cota_from);
  const et = num(activeHeader?.este_to);
  const nt = num(activeHeader?.norte_to);
  const ct = num(activeHeader?.cota_to);

  const hasPlanBounds =
    ef !== null &&
    et !== null &&
    nf !== null &&
    nt !== null &&
    (ef !== 0 || et !== 0 || nf !== 0 || nt !== 0);

  const hasCotaBounds =
    cf !== null &&
    ct !== null &&
    (cf !== 0 || ct !== 0);

  const hdrL1 = normLitoToken(activeHeader?.lito_1);
  const hdrL2 = normLitoToken(activeHeader?.lito_2);
  const hdrL3 = normLitoToken(activeHeader?.lito_3);
  const hasHdrLito = Boolean(hdrL1 || hdrL2);

  // Agrupar filas con celda_mapeo no vacía por celda normalizada
  const cellGroups = new Map<string, { display: string; indices: number[] }>();

  pltEnsayos.forEach((row, i) => {
    const rawCelda = String(row?.celda_mapeo || '').trim();
    const normCelda = normalizeCeldaLocal(rawCelda);
    if (normCelda) {
      if (!cellGroups.has(normCelda)) {
        cellGroups.set(normCelda, { display: rawCelda.toUpperCase(), indices: [] });
      }
      cellGroups.get(normCelda)!.indices.push(i);
    }

    const rowBelongsToActiveHeader =
      Boolean(activeHeader) && (!normCelda || !hdrCeldaNorm || normCelda === hdrCeldaNorm);

    // 1. Muestra individual (A, B, C o D)
    const muestraRaw = String(row?.muestra ?? '').trim();
    const muestraUp = muestraRaw.toUpperCase();
    if (muestraRaw && !VALID_MUESTRAS_SET.has(muestraUp)) {
      alerts.push({
        fieldId: `plt-muestra-${i}`,
        type: 'CRITICA',
        ruleId: 'PLT_MUESTRA_INVALIDA',
        section: SECTION,
        message: `PLT Fila ${i + 1}: Muestra '${muestraRaw}' inválida. Solo se permiten las 4 opciones A, B, C o D.`,
      });
    }

    // 2. Código de muestra sin guión ({celda}{muestra}, ej. AG57A)
    const codMuestraRaw = String(row?.codigo_muestra ?? '').trim();
    if (rawCelda && muestraUp && codMuestraRaw) {
      const expectedCod = `${rawCelda.toUpperCase()}${muestraUp}`;
      if (codMuestraRaw.toUpperCase() !== expectedCod) {
        alerts.push({
          fieldId: `plt-codigo_muestra-${i}`,
          type: 'CRITICA',
          ruleId: 'PLT_CODIGO_MUESTRA_SIN_GUION',
          section: SECTION,
          message: `PLT Fila ${i + 1}: Código de muestra '${codMuestraRaw}' debe concatenar celda + muestra sin separadores ('${expectedCod}').`,
        });
      }
    }

    // 3. Coordenadas dentro de FROM–TO y Elevación vs Mapeo
    const este = num(row?.este);
    const norte = num(row?.norte);
    const elev = num(row?.elevacion);

    if (rowBelongsToActiveHeader && hasPlanBounds) {
      const minE = Math.min(ef!, et!);
      const maxE = Math.max(ef!, et!);
      const minN = Math.min(nf!, nt!);
      const maxN = Math.max(nf!, nt!);

      if (este !== null && (este < minE - 0.01 || este > maxE + 0.01)) {
        alerts.push({
          fieldId: `plt-este-${i}`,
          type: 'CRITICA',
          ruleId: 'PLT_COORD_FUERA_FROM_TO',
          section: SECTION,
          message: `PLT Fila ${i + 1}: Coordenada Este (${este}) fuera del rango FROM–TO de mapeo [${minE}, ${maxE}].`,
        });
      }
      if (norte !== null && (norte < minN - 0.01 || norte > maxN + 0.01)) {
        alerts.push({
          fieldId: `plt-norte-${i}`,
          type: 'CRITICA',
          ruleId: 'PLT_COORD_FUERA_FROM_TO',
          section: SECTION,
          message: `PLT Fila ${i + 1}: Coordenada Norte (${norte}) fuera del rango FROM–TO de mapeo [${minN}, ${maxN}].`,
        });
      }
    }

    if (rowBelongsToActiveHeader && hasCotaBounds && elev !== null) {
      const minC = Math.min(cf!, ct!);
      const maxC = Math.max(cf!, ct!);
      const diffZ = Math.round(Math.max(0, minC - elev, elev - maxC) * 10000) / 10000;
      if (diffZ > 1.5) {
        alerts.push({
          fieldId: `plt-elevacion-${i}`,
          type: 'CRITICA',
          ruleId: 'PLT_ELEVACION_FUERA_MAPEO',
          section: SECTION,
          message: `PLT Fila ${i + 1}: Elevación (${elev} msnm) excede ±1.5 m respecto al mapeo [${minC}, ${maxC}] (desviación: ${diffZ.toFixed(2)} m).`,
        });
      } else if (diffZ >= 1.0) {
        alerts.push({
          fieldId: `plt-elevacion-${i}`,
          type: 'ADVERTENCIA',
          ruleId: 'PLT_ELEVACION_VARIACION_MAPEO',
          section: SECTION,
          message: `PLT Fila ${i + 1}: Elevación (${elev} msnm) varía ${diffZ.toFixed(2)} m respecto al mapeo [${minC}, ${maxC}] (rango 1.0–1.5 m).`,
        });
      }
    }

    // 4. Comparación litológica contra Mapeo
    const pL1 = normLitoToken(row?.litologia_1);
    const pL2 = normLitoToken(row?.litologia_2);
    const pL3 = normLitoToken(row?.litologia_3);
    if (rowBelongsToActiveHeader && hasHdrLito && (pL1 || pL2)) {
      if (pL1 !== hdrL1 || pL2 !== hdrL2 || pL3 !== hdrL3) {
        const hdrDesc = [hdrL1, hdrL2, hdrL3].filter(Boolean).join('/');
        const pltDesc = [pL1, pL2, pL3].filter(Boolean).join('/');
        alerts.push({
          fieldId: `plt-litologia_1-${i}`,
          type: 'ADVERTENCIA',
          ruleId: 'PLT_LITOLOGIA_DISTINTA_MAPEO',
          section: SECTION,
          message: `No es la litología que registró en mapeo. PLT Fila ${i + 1}: registró ${pltDesc} y en mapeo figura ${hdrDesc}. Verifique que el Factor K corresponda a la litología del muestreo.`,
        });
      }
    }

    // 5. Factor K: rango [5, 30] (CRITICA) y coherencia con litología declarada (ADVERTENCIA)
    const kVal = num(row?.factor_conversion_k);
    if (kVal !== null) {
      if (kVal < 5 || kVal > 30) {
        alerts.push({
          fieldId: `plt-factor_conversion_k-${i}`,
          type: 'CRITICA',
          ruleId: 'PLT_FACTOR_K_RANGO',
          section: SECTION,
          message: `PLT Fila ${i + 1}: Factor K = ${kVal} fuera del rango permitido [5, 30].`,
        });
      } else {
        const expectedK = resolveExpectedKStrict(row);
        if (expectedK !== null && Math.abs(kVal - expectedK) > 0.1) {
          alerts.push({
            fieldId: `plt-factor_conversion_k-${i}`,
            type: 'ADVERTENCIA',
            ruleId: 'PLT_FACTOR_K_INCONGRUENTE',
            section: SECTION,
            message: `PLT Fila ${i + 1}: Factor K (${kVal}) no corresponde a la litología declarada (esperado: ${expectedK}).`,
          });
        }
      }
    }

    // 6. Dimensiones y Geometría ASTM/ISRM + Diámetro Equivalente ±0.005 cm
    const d = num(row?.espesor_d);
    const l = num(row?.longitud_l);
    const w1 = num(row?.ancho_w1);
    const w2 = num(row?.ancho_w2);

    if (d !== null && d <= 0) {
      alerts.push({
        fieldId: `plt-espesor_d-${i}`,
        type: 'CRITICA',
        ruleId: 'PLT_DIMENSION_NO_POSITIVA',
        section: SECTION,
        message: `PLT Fila ${i + 1}: Espesor D (${d}) debe ser mayor a 0.`,
      });
    }
    if (l !== null && l <= 0) {
      alerts.push({
        fieldId: `plt-longitud_l-${i}`,
        type: 'CRITICA',
        ruleId: 'PLT_DIMENSION_NO_POSITIVA',
        section: SECTION,
        message: `PLT Fila ${i + 1}: Longitud L (${l}) debe ser mayor a 0.`,
      });
    }
    if (w1 !== null && w1 <= 0) {
      alerts.push({
        fieldId: `plt-ancho_w1-${i}`,
        type: 'CRITICA',
        ruleId: 'PLT_DIMENSION_NO_POSITIVA',
        section: SECTION,
        message: `PLT Fila ${i + 1}: Ancho W1 (${w1}) debe ser mayor a 0.`,
      });
    }
    if (w2 !== null && w2 <= 0) {
      alerts.push({
        fieldId: `plt-ancho_w2-${i}`,
        type: 'CRITICA',
        ruleId: 'PLT_DIMENSION_NO_POSITIVA',
        section: SECTION,
        message: `PLT Fila ${i + 1}: Ancho W2 (${w2}) debe ser mayor a 0.`,
      });
    }

    const w = w1 !== null && w2 !== null && w1 > 0 && w2 > 0 ? (w1 + w2) / 2 : null;
    const geomFailures: string[] = [];
    if (d !== null && l !== null && d > 0 && l > 0 && l < d) {
      geomFailures.push(`L=${l} cm < D=${d} cm (distancia mín. 0.5D)`);
    }
    if (d !== null && w !== null && d > 0 && !(0.3 * w < d && d < w)) {
      geomFailures.push(
        `D=${d} cm fuera de 0.3W < D < W (${(0.3 * w).toFixed(2)}–${w.toFixed(2)} cm)`,
      );
    }
    if (geomFailures.length > 0) {
      alerts.push({
        fieldId: `plt-espesor_d-${i}`,
        type: 'ADVERTENCIA',
        ruleId: 'PLT_GEOMETRIA_FUERA_NORMA',
        section: SECTION,
        message: `PLT Fila ${i + 1}: Geometría fuera de norma ASTM/ISRM (${geomFailures.join('; ')}).`,
      });
    }

    const rawDe = num(row?._raw_de);
    if (rawDe !== null && d !== null && w !== null && d > 0 && w > 0) {
      const calcDe = Math.sqrt((4 * d * w) / Math.PI);
      if (Math.abs(rawDe - calcDe) > 0.005) {
        alerts.push({
          fieldId: `plt-diametro_equivalente-${i}`,
          type: 'ADVERTENCIA',
          ruleId: 'PLT_DIAMETRO_EQUIV_TOLERANCIA',
          section: SECTION,
          message: `PLT Fila ${i + 1}: Diámetro equivalente importado (${rawDe} cm) difiere en más de ±0.005 cm del calculado (${calcDe.toFixed(4)} cm).`,
        });
      }
    }

    // 7. Carga aplicada P (kN)
    const p = num(row?.fuerza_p);
    if (p !== null) {
      if (p <= 0) {
        alerts.push({
          fieldId: `plt-fuerza_p-${i}`,
          type: 'CRITICA',
          ruleId: 'PLT_FUERZA_P_NO_POSITIVA',
          section: SECTION,
          message: `PLT Fila ${i + 1}: Fuerza P (${p} kN) debe ser mayor a 0.`,
        });
      } else if (p > 60) {
        alerts.push({
          fieldId: `plt-fuerza_p-${i}`,
          type: 'ADVERTENCIA',
          ruleId: 'PLT_CARGA_P_VERIFICACION',
          section: SECTION,
          message: `PLT Fila ${i + 1}: Alerta de verificación de registro — Fuerza P = ${p} kN (> 60 kN). Verifique la carga y consigne motivo en Observaciones.`,
        });
      } else if (p > 55) {
        alerts.push({
          fieldId: `plt-fuerza_p-${i}`,
          type: 'ADVERTENCIA',
          ruleId: 'PLT_CARGA_P_PRECAUCION',
          section: SECTION,
          message: `PLT Fila ${i + 1}: Fuerza P = ${p} kN supera el límite recomendado de 55 kN (precaución 55–60 kN).`,
        });
      }
    }

    // 8. Tipo de fractura y Dirección de rotura
    const fracRaw = String(row?.tipo_fractura ?? '').trim();
    if (fracRaw && !VALID_FRACTURA_SET.has(fracRaw.toUpperCase())) {
      alerts.push({
        fieldId: `plt-tipo_fractura-${i}`,
        type: 'CRITICA',
        ruleId: 'PLT_TIPO_FRACTURA_INVALIDO',
        section: SECTION,
        message: `PLT Fila ${i + 1}: Tipo de fractura '${fracRaw}' inválido. Valores admitidos: M (matriz), E (estructura) o C (combinada).`,
      });
    }

    const dirRaw = String(row?.direccion_rotura ?? '').trim();
    if (dirRaw && !VALID_DIRECCION_SET.has(dirRaw.toUpperCase())) {
      alerts.push({
        fieldId: `plt-direccion_rotura-${i}`,
        type: 'CRITICA',
        ruleId: 'PLT_DIRECCION_ROTURA_INVALIDA',
        section: SECTION,
        message: `PLT Fila ${i + 1}: Dirección de rotura '${dirRaw}' inválida. Valores admitidos: Pa, Pe, NA o N/A.`,
      });
    }
  });

  // 9. Reglas por celda: 4 muestras A-B-C-D (sin duplicados, orden) y coordenadas distintas
  for (const [, group] of cellGroups.entries()) {
    const { display, indices } = group;
    const seenMuestras = new Map<string, number[]>();
    const letters: string[] = [];
    const coordMap = new Map<string, number[]>();

    for (const idx of indices) {
      const r = pltEnsayos[idx];
      const mUp = String(r?.muestra ?? '').trim().toUpperCase();
      letters.push(mUp);

      if (VALID_MUESTRAS_SET.has(mUp)) {
        if (!seenMuestras.has(mUp)) seenMuestras.set(mUp, []);
        seenMuestras.get(mUp)!.push(idx);
      }

      const e = num(r?.este);
      const n = num(r?.norte);
      const z = num(r?.elevacion);
      if (e !== null && n !== null && z !== null) {
        const key = `${e.toFixed(4)}|${n.toFixed(4)}|${z.toFixed(2)}`;
        if (!coordMap.has(key)) coordMap.set(key, []);
        coordMap.get(key)!.push(idx);
      }
    }

    for (const [mUp, locs] of seenMuestras.entries()) {
      if (locs.length > 1) {
        for (const dupIdx of locs.slice(1)) {
          alerts.push({
            fieldId: `plt-muestra-${dupIdx}`,
            type: 'CRITICA',
            ruleId: 'PLT_MUESTRA_DUPLICADA',
            section: SECTION,
            message: `PLT Fila ${dupIdx + 1} (${display}): La muestra '${mUp}' está duplicada (ya existe en la fila ${locs[0] + 1}).`,
          });
        }
      }
    }

    const validLetters = letters.filter(m => VALID_MUESTRAS_SET.has(m));
    const uniqueValid = new Set(validLetters);
    const missing = VALID_MUESTRAS.filter(m => !uniqueValid.has(m));

    if (indices.length !== 4 || uniqueValid.size !== 4) {
      let msg = '';
      if (indices.length < 4) {
        msg = `Celda ${display}: Debe registrar obligatoriamente las 4 muestras A, B, C y D (actual: ${indices.length}; faltan: ${missing.join(', ')}).`;
      } else if (indices.length > 4) {
        msg = `Celda ${display}: Posee ${indices.length} registros; solo se permiten exactamente 4 muestras obligatorias (A, B, C y D).`;
      } else {
        msg = `Celda ${display}: Las 4 muestras de la celda deben ser obligatoriamente A, B, C y D (faltan: ${missing.join(', ')}).`;
      }
      alerts.push({
        fieldId: `plt-muestra-${indices[0]}`,
        type: 'CRITICA',
        ruleId: 'PLT_MUESTRAS_CANTIDAD_ABCD',
        section: SECTION,
        message: msg,
      });
    } else if (
      letters[0] !== 'A' ||
      letters[1] !== 'B' ||
      letters[2] !== 'C' ||
      letters[3] !== 'D'
    ) {
      alerts.push({
        fieldId: `plt-muestra-${indices[0]}`,
        type: 'ADVERTENCIA',
        ruleId: 'PLT_MUESTRAS_ORDEN_ABCD',
        section: SECTION,
        message: `Celda ${display}: Se recomienda ordenar las 4 muestras en secuencia A, B, C, D (actual: ${letters.join('-')}).`,
      });
    }

    for (const [, locs] of coordMap.entries()) {
      if (locs.length > 1) {
        const refRow = pltEnsayos[locs[0]];
        for (const dupIdx of locs.slice(1)) {
          alerts.push({
            fieldId: `plt-este-${dupIdx}`,
            type: 'CRITICA',
            ruleId: 'PLT_COORD_DUPLICADAS',
            section: SECTION,
            message: `PLT Fila ${dupIdx + 1} (${display}): Coordenadas (E=${refRow.este}, N=${refRow.norte}, Elev=${refRow.elevacion}) idénticas a la fila ${locs[0] + 1}. Deben ser distintas para cada muestra.`,
          });
        }
      }
    }
  }

  return alerts;
}
