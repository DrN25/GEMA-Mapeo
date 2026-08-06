/**
 * utils/qaQcRules.ts — SSOT (Single Source of Truth) de reglas QA/QC del frontend.
 *
 * Cada regla se define UNA sola vez aquí con:
 *   - id: identificador único (usado para activar/desactivar y para el registry)
 *   - severity: 'CRITICA' (bloquea guardado) | 'ADVERTENCIA' (no bloquea)
 *   - enabled: switch global para activar/desactivar la regla sin tocar el código
 *   - evalua: función pura (header, joints, largoEntero, ctx) -> mensaje o null
 *
 * Reglas de VACÍO: viven en `mandatoryRules.ts` (no se duplican aquí).
 * Evaluación: solo se reportan reglas cuyos campos hayan sido "tocados"
 * (blur), excepto las marcadas como `global` (celda, coords, litología, largo
 * y altura) que siempre se evalúan.
 */

import type { JointRow, WindowHeader } from './rmrCalculator';
import { LITHOLOGY_CLASSIFICATION } from './catalogData';
import { isFieldTouched, markFieldTouched } from './qaQcTouch';
import { getCampaniaYear } from './campaniasCatalog';
import { gsiVisualRange } from './rmrCalculator';

export type QaQcSeverity = 'CRITICA' | 'ADVERTENCIA';

export interface QaQcAlert {
  fieldId: string;
  type: 'CRITICA' | 'ADVERTENCIA' | 'VACIO';
  message: string;
  ruleId: string;
  section: string;
}

interface RuleCtx {
  header: WindowHeader;
  joints: JointRow[];
  largoEntero: number;
  campaniaYearMap: Record<number, number>;
}

type Evaluator = (ctx: RuleCtx, row?: JointRow) => string | null;

interface QaQcRuleDef {
  id: string;
  severity: QaQcSeverity;
  enabled: boolean;
  /** Si true, la regla se evalúa siempre aunque el campo no haya sido tocado. */
  global?: boolean;
  fieldId: string;
  section: string;
  evalua: Evaluator;
}

// ---------------------------------------------------------------------------
// Helpers numéricos: un campo "vacío" se ignora (lo cubre la categoría VACÍO).
// -1 es el sentinel de vacío en joints; null/undefined/'' en header.
// ---------------------------------------------------------------------------

const isBlankVal = (v: any): boolean =>
  v === undefined || v === null || v === '' || v === -1 || v === '-1';

const num = (v: any): number | null => {
  if (isBlankVal(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const isIntegerVal = (v: any): boolean => {
  const n = num(v);
  return n !== null && Number.isInteger(n);
};

const isBlankOrNegative = (v: any): boolean => isBlankVal(v) || (num(v) ?? 0) < 0;

// ---------------------------------------------------------------------------
// Sinónimos de grupos litológicos (misma lógica que la UI de bloqueo)
// ---------------------------------------------------------------------------

const GROUP_SYNS: Record<string, string> = {
  SEDIMENTARIA: 'SEDIMENTARIOS', SEDIMENTARIAS: 'SEDIMENTARIOS', SEDIMENTARIO: 'SEDIMENTARIOS',
  INTRUSIVA: 'INTRUSIVOS', INTRUSIVAS: 'INTRUSIVOS', INTRUSIVO: 'INTRUSIVOS',
  METAMORFICO: 'METAMORFICAS', METAMORFICOS: 'METAMORFICAS', METAMORFICA: 'METAMORFICAS',
  BRECHA: 'BRECHAS',
};

// ---------------------------------------------------------------------------
// Registry SSOT — todas las reglas QA/QC del frontend
// ---------------------------------------------------------------------------

const RULES: QaQcRuleDef[] = [
  // ============ A1. CELDA ============
  {
    id: 'CELDA_OBLIGATORIA',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'header-celda',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) =>
      !header.celda || String(header.celda).trim() === ''
        ? 'El nombre de la celda de mapeo es obligatorio.'
        : null,
  },

  // ============ A2/A3. COORDENADAS FROM == TO ============
  {
    id: 'COORDS_FROM_TO_IDENTICAS',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'header-este_to',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const f = [num(header.este_from), num(header.norte_from), num(header.cota_from)];
      const t = [num(header.este_to), num(header.norte_to), num(header.cota_to)];
      if (f.some(x => x === null) || t.some(x => x === null)) return null;
      const eq = f.every((x, i) => x === t[i]);
      return eq
        ? 'Las coordenadas iniciales (FROM) y finales (TO) son idénticas. Ingrese coordenadas UTM reales.'
        : null;
    },
  },

  // ============ A4. LARGO ============
  {
    id: 'LARGO_CERO',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'header-largo',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.largo);
      if (n === null) return null;
      return n === 0 ? 'La distancia de la celda no puede ser 0.' : null;
    },
  },
  {
    id: 'LARGO_NEGATIVO',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'header-largo',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.largo);
      if (n === null) return null;
      return n < 0 ? 'La distancia de la celda no puede ser negativa.' : null;
    },
  },
  {
    id: 'LARGO_MAXIMO',
    severity: 'ADVERTENCIA',
    enabled: true,
    global: true,
    fieldId: 'header-largo',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.largo);
      if (n === null) return null;
      return n > 30 ? 'La distancia de la celda supera los 30 metros. Verifique que sea correcta.' : null;
    },
  },

  // ============ A5. ALTURA ============
  {
    id: 'ALTURA_CERO',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'header-altura',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.altura);
      if (n === null) return null;
      return n === 0 ? 'La altura de la ventana de mapeo no puede ser 0.' : null;
    },
  },
  {
    id: 'ALTURA_NEGATIVA',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'header-altura',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.altura);
      if (n === null) return null;
      return n < 0 ? 'La altura de la ventana de mapeo no puede ser negativa.' : null;
    },
  },
  {
    id: 'ALTURA_MAXIMA',
    severity: 'ADVERTENCIA',
    enabled: true,
    global: true,
    fieldId: 'header-altura',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.altura);
      if (n === null) return null;
      return n > 30 ? 'La altura ingresada supera los 30 metros. Verifique que sea correcta.' : null;
    },
  },

  // ============ A6/A8. DIP_TALUD y DIP_HW en [-90, 90] ============
  {
    id: 'DIP_TALUD_RANGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'header-dip_talud',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.dip_talud);
      if (n === null) return null;
      return n < -90 || n > 90 ? `El Dip del Talud (${n}°) debe estar entre -90° y 90°.` : null;
    },
  },
  {
    id: 'DIP_HW_RANGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'header-dip_hw',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.dip_hw);
      if (n === null) return null;
      return n < -90 || n > 90 ? `El Dip del Agujero (${n}°) debe estar entre -90° y 90°.` : null;
    },
  },

  // ============ A7/A9. DIPDIR_TALUD y AZ_HW en [0, 359.99] ============
  {
    id: 'DIPDIR_TALUD_RANGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'header-dipdir_talud',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.dipdir_talud);
      if (n === null) return null;
      return n < 0 || n > 359.99 ? `La Dirección del Talud (${n}°) debe estar entre 0° y 359.99°.` : null;
    },
  },
  {
    id: 'AZ_HW_RANGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'header-az_hw',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.az_hw);
      if (n === null) return null;
      return n < 0 || n > 359.99 ? `El Azimut del Agujero (${n}°) debe estar entre 0° y 359.99°.` : null;
    },
  },

  // ============ A10/A11. LITOLOGÍA (misma lógica que el bloqueo de guardado) ============
  {
    id: 'LITOLOGIA_COMBINACION_INVALIDA',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'header-lito_1',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const u = (header.lito_1 || '').trim().toUpperCase();
      const l = (header.lito_2 || '').trim().toUpperCase();
      const c = (header.lito_3 || '').trim().toUpperCase();
      const isL1Empty = !u || u === '-1';
      const isL2Empty = !l || l === '-1';
      const isL3Empty = !c || c === '-1' || c === '-' || c === 'NR';

      // Lito 1 y Lito 2 obligatorios; Lito 3 puede quedar vacío (comodín NR/-).
      if (isL1Empty || isL2Empty) return null;

      const normL3 = isL3Empty ? 'NR' : c;
      const matches = LITHOLOGY_CLASSIFICATION.filter(item => {
        const itemU = (item.unidad || '').toUpperCase();
        const itemL = (item.litologia || '').toUpperCase();
        const itemC = (item.codigo || '').toUpperCase();
        const normItemC = (itemC === '-' || itemC === 'NR' || !itemC) ? 'NR' : itemC;
        return itemU === u && itemL === l && normItemC === normL3;
      });

      return matches.length === 0
        ? `Combinación litológica inválida: Lito 1 (${header.lito_1 || '—'}) / Lito 2 (${header.lito_2 || '—'}) / Lito 3 (${header.lito_3 || '—'}).`
        : null;
    },
  },

  // ============ A14. FASE ============
  {
    id: 'FASE_CERO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'header-fase',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.fase);
      if (n === null) return null;
      return n === 0 ? 'La fase no puede ser 0.' : null;
    },
  },
  {
    id: 'FASE_NEGATIVA',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'header-fase',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.fase);
      if (n === null) return null;
      return n < 0 ? 'La fase no puede ser negativa.' : null;
    },
  },

  // ============ A15. NIVEL ============
  {
    id: 'NIVEL_CERO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'header-nivel',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.nivel);
      if (n === null) return null;
      return n === 0 ? 'El nivel no puede ser 0.' : null;
    },
  },
  {
    id: 'NIVEL_NEGATIVO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'header-nivel',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header }) => {
      const n = num(header.nivel);
      if (n === null) return null;
      return n < 0 ? 'El nivel no puede ser negativo.' : null;
    },
  },

  // ============ A16/A17. FECHA vs CAMPAÑA ============
  {
    id: 'FECHA_CAMPANA_ANIO',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'header-fecha',
    section: 'DATOS DE REGISTRO',
    evalua: ({ header, campaniaYearMap }) => {
      const campaniaId = num(header.campania);
      const fecha = header.fecha ? String(header.fecha) : '';
      if (campaniaId === null || !fecha) return null;
      const anioCampana = campaniaYearMap[campaniaId];
      const anioFecha = parseInt(fecha.slice(0, 4), 10);
      if (!anioCampana || isNaN(anioFecha)) return null;
      return anioCampana !== anioFecha
        ? `La campaña (${anioCampana}) y la fecha de mapeo (${anioFecha}) no pertenecen al mismo año.`
        : null;
    },
  },

  // ============ B1. DISTANCIA ============
  {
    id: 'DISTANCIA_CERO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-distancia',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const n = num(row?.distancia);
      if (n === null) return null;
      return n === 0 ? 'La distancia de la estructura no puede ser 0.' : null;
    },
  },
  {
    id: 'DISTANCIA_NEGATIVA',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-distancia',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const n = num(row?.distancia);
      if (n === null) return null;
      return n < 0 ? 'La distancia de la estructura no puede ser negativa.' : null;
    },
  },
  {
    id: 'DISTANCIA_EXCEDE_LARGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-distancia',
    section: 'DISCONTINUIDADES',
    evalua: (ctx, row) => {
      const n = num(row?.distancia);
      if (n === null) return null;
      return n > ctx.largoEntero
        ? `La distancia de la estructura (${n}m) supera el largo de la celda (${ctx.largoEntero}m).`
        : null;
    },
  },

  // ============ B2. DIP (entero, [-90, 90]) ============
  {
    id: 'DIP_ESTRUCTURA_RANGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-dip',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const n = num(row?.dip);
      if (n === null) return null;
      return n < -90 || n > 90 ? `El buzamiento (Dip: ${n}°) debe estar entre -90° y 90°.` : null;
    },
  },
  {
    id: 'DIP_ESTRUCTURA_ENTERO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-dip',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) =>
      !isBlankVal(row?.dip) && !isIntegerVal(row?.dip)
        ? 'El Dip de la estructura debe ser un número entero.'
        : null,
  },

  // ============ B3. DIP_DIR (entero, [0, 359]) ============
  {
    id: 'DIP_DIR_RANGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-dip_dir',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const n = num(row?.dip_dir);
      if (n === null) return null;
      return n < 0 || n > 359 ? `La dirección de buzamiento (${n}°) debe estar entre 0° y 359°.` : null;
    },
  },
  {
    id: 'DIP_DIR_ENTERO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-dip_dir',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) =>
      !isBlankVal(row?.dip_dir) && !isIntegerVal(row?.dip_dir)
        ? 'La dirección de buzamiento debe ser un número entero.'
        : null,
  },

  // ============ B5. N_ESTRUCTURAS ============
  {
    id: 'N_ESTRUCTURAS_CERO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-n_estructuras',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const n = num(row?.n_estructuras);
      if (n === null) return null;
      return n === 0 ? 'El número de estructuras no puede ser 0.' : null;
    },
  },
  {
    id: 'N_ESTRUCTURAS_NEGATIVO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-n_estructuras',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const n = num(row?.n_estructuras);
      if (n === null) return null;
      return n < 0 ? 'El número de estructuras no puede ser negativo.' : null;
    },
  },
  {
    id: 'N_ESTRUCTURAS_ENTERO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-n_estructuras',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) =>
      !isBlankVal(row?.n_estructuras) && !isIntegerVal(row?.n_estructuras)
        ? 'El número de estructuras debe ser un número entero.'
        : null,
  },

  // ============ B6. ABERTURA ============
  {
    id: 'ABERTURA_NEGATIVA',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-abertura',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const n = num(row?.abertura);
      if (n === null) return null;
      return n < 0 ? 'La abertura no puede ser negativa.' : null;
    },
  },
  {
    id: 'ABERTURA_CERO_CON_ESPESOR',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-abertura',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const a = num(row?.abertura);
      const e = num(row?.espesor);
      if (a === null || e === null) return null;
      return e > 0 && a === 0
        ? `Declaró un espesor de relleno de ${e}mm pero la abertura figura en 0mm.`
        : null;
    },
  },
  {
    id: 'ESPESOR_SUPERA_ABERTURA',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-espesor',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const a = num(row?.abertura);
      const e = num(row?.espesor);
      const tipo = String(row?.tipo_estructura || '').trim().toUpperCase();
      if (a === null || e === null) return null;
      if (['F', 'SZ', 'BED'].includes(tipo)) return null;
      return e > a
        ? `El espesor de relleno (${e}mm) no puede ser mayor que la abertura (${a}mm) salvo en F, SZ o BED.`
        : null;
    },
  },
  {
    id: 'ESPESOR_SUPERA_LARGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-espesor',
    section: 'DISCONTINUIDADES',
    evalua: (ctx, row) => {
      const e = num(row?.espesor);
      const tipo = String(row?.tipo_estructura || '').trim().toUpperCase();
      if (e === null) return null;
      if (['F', 'SZ', 'BED'].includes(tipo)) return null;
      return e / 1000 > ctx.largoEntero
        ? `El espesor (${e}mm) supera el largo de la celda (${ctx.largoEntero}m) salvo en F, SZ o BED.`
        : null;
    },
  },

  // ============ B7. ESPESOR ============
  {
    id: 'ESPESOR_NEGATIVO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-espesor',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const n = num(row?.espesor);
      if (n === null) return null;
      return n < 0 ? 'El espesor de relleno no puede ser negativo.' : null;
    },
  },
  {
    id: 'ESPESOR_NO_CERO_RELLENO_LIMPIO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-espesor',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const e = num(row?.espesor);
      const r1 = row?.relleno1;
      if (e === null) return null;
      const rellenoLimpio = r1 === 'c' || r1 === '-1' || r1 === undefined || r1 === null || r1 === '';
      return rellenoLimpio && e !== 0
        ? `Se declaró relleno limpio/sin información pero el espesor figura con ${e}mm (debe ser 0).`
        : null;
    },
  },

  // ============ B8. CONTINUIDAD ============
  {
    id: 'CONTINUIDAD_NEGATIVA',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-continuidad',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const n = num(row?.continuidad);
      if (n === null) return null;
      return n < 0 ? 'La continuidad/persistencia no puede ser negativa.' : null;
    },
  },

  // ============ B9. ESPACIAMIENTO ============
  {
    id: 'ESPACIAMIENTO_NEGATIVO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-espaciamiento',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const n = num(row?.espaciamiento);
      if (n === null) return null;
      return n < 0 ? 'El espaciamiento de la junta no puede ser negativo.' : null;
    },
  },
  {
    id: 'ESPACIAMIENTO_EXCEDE_LARGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-espaciamiento',
    section: 'DISCONTINUIDADES',
    evalua: (ctx, row) => {
      const n = num(row?.espaciamiento);
      if (n === null || n === -1) return null;
      return n > ctx.largoEntero
        ? `El espaciamiento (${n}m) supera el largo de la celda (${ctx.largoEntero}m).`
        : null;
    },
  },

  // ============ B13/B14. JRC y RUGOSIDAD (catálogo) ============
  {
    id: 'JRC_NEGATIVO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-jrc',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const n = num(row?.jrc);
      if (n === null) return null;
      return n < 0 ? 'El coeficiente JRC no puede ser negativo.' : null;
    },
  },
  {
    id: 'JRC_ENTERO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-jrc',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) =>
      !isBlankVal(row?.jrc) && !isIntegerVal(row?.jrc)
        ? 'El coeficiente JRC debe ser un número entero.'
        : null,
  },
  {
    id: 'RUGOSIDAD_NEGATIVA',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-rugosidad',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const n = num(row?.rugosidad);
      if (n === null) return null;
      return n < 0 ? 'La rugosidad de la estructura no puede ser negativa.' : null;
    },
  },
  {
    id: 'RUGOSIDAD_ENTERO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'joint-rugosidad',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) =>
      !isBlankVal(row?.rugosidad) && !isIntegerVal(row?.rugosidad)
        ? 'La rugosidad de la estructura debe ser un número entero.'
        : null,
  },
  {
    id: 'JRC_RUGOSIDAD_CATALOGO',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'joint-jrc',
    section: 'DISCONTINUIDADES',
    evalua: (_ctx, row) => {
      const jrc = num(row?.jrc);
      const rug = num(row?.rugosidad);
      if (jrc === null || rug === null) return null;
      const esperado = getExpectedProfileFromJRC(jrc);
      if (esperado === null) return null;
      return esperado !== rug
        ? `La combinación JRC (${jrc}) con Rugosidad (${rug}) no sigue el catálogo. Perfil esperado: ${esperado}.`
        : null;
    },
  },

  // ============ C6. GSI VISUAL ============
  {
    id: 'GSI_VISUAL_NEGATIVO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'header-gsi_visual',
    section: 'ANÁLISIS RMR & GSI',
    evalua: ({ header }) => {
      const n = num(header.gsi_visual);
      if (n === null) return null;
      return n < 0 ? 'El GSI visual no puede ser negativo.' : null;
    },
  },
  {
    id: 'GSI_VISUAL_ENTERO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'header-gsi_visual',
    section: 'ANÁLISIS RMR & GSI',
    evalua: ({ header }) =>
      !isBlankVal(header.gsi_visual) && !isIntegerVal(header.gsi_visual)
        ? 'El GSI visual debe ser un número entero.'
        : null,
  },
  {
    id: 'GSI_VISUAL_RANGO',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'header-gsi_visual',
    section: 'ANÁLISIS RMR & GSI',
    evalua: ({ header }) => {
      const est = String(header.gsi_estructura || '').trim().toUpperCase();
      const sup = String(header.gsi_superficie || '').trim().toUpperCase();
      const n = num(header.gsi_visual);
      if (n === null) return null;
      // La regla solo aplica si ambas condiciones (estructura y superficie)
      // tienen valor y corresponden al catálogo GSI.
      const rango = gsiVisualRange(est, sup);
      if (!rango) return null;
      if (n < rango.min || n > rango.max) {
        return `El GSI visual (${n}) no corresponde a la combinación seleccionada (${est} / ${sup}). Rango permitido: ${rango.min} a ${rango.max}.`;
      }
      return null;
    },
  },
];

// Mapeo JRC → perfil de rugosidad (tabla corregida, rangos abiertos ]x - y[)
export function getExpectedProfileFromJRC(jrc: number): number | null {
  if (jrc < 0 || jrc > 20) return null;
  if (jrc < 2) return 9;
  if (jrc < 4) return 8;
  if (jrc < 6) return 7;
  if (jrc < 8) return 6;
  if (jrc < 10) return 6;
  if (jrc < 12) return 5;
  if (jrc < 14) return 4;
  if (jrc < 16) return 3;
  if (jrc < 18) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export const QAQC_RULE_REGISTRY: Record<string, QaQcRuleDef> = Object.fromEntries(
  RULES.map(r => [r.id, r]),
);

export const QAQC_RULE_ENFORCEMENT: Record<string, boolean> = Object.fromEntries(
  RULES.map(r => [r.id, r.enabled]),
);

/** Activa/desactiva una regla por ID (SSOT en runtime). */
export function setQaQcRuleEnabled(ruleId: string, enabled: boolean): void {
  const rule = QAQC_RULE_REGISTRY[ruleId];
  if (rule) rule.enabled = enabled;
}

export function resetQaQcRuleDefaults(): void {
  for (const rule of RULES) rule.enabled = true;
}

function fieldIdForJoint(baseId: string, rowIndex: number): string {
  return `${baseId}-${rowIndex}`;
}

function ruleApplies(rule: QaQcRuleDef, fieldId: string): boolean {
  return rule.global || isFieldTouched(fieldId);
}

/**
 * Valida una ventana completa y devuelve las alertas QA/QC (CRITICAS y
 * ADVERTENCIAS). Las reglas de VACÍO viven en mandatoryRules.ts.
 *
 * @param header cabecera de la ventana
 * @param joints discontinuidades
 * @param largoRaw largo (se REDONDEA a entero para todas las comparaciones)
 * @param campanias mapa id -> año (opcional; si no se pasa se usa el catálogo)
 * @param evaluateAll si true, ignora el filtro de "campos tocados" (usado en
 *        el modal de guardado, que es la red de seguridad final).
 */
export function validateWindowQAQC(
  header: WindowHeader,
  joints: JointRow[],
  largoRaw: number,
  campanias?: Record<number, number>,
  evaluateAll: boolean = false,
): QaQcAlert[] {
  const largoEntero = Math.round(Number(largoRaw) || 0);
  const campaniaYearMap = campanias || buildCampaniaYearMap();
  const ctx: RuleCtx = { header, joints, largoEntero, campaniaYearMap };
  const alerts: QaQcAlert[] = [];

  for (const rule of RULES) {
    if (!rule.enabled) continue;

    const isJointRule = rule.fieldId.startsWith('joint-');
    if (isJointRule) {
      joints.forEach((row, idx) => {
        const fieldId = fieldIdForJoint(rule.fieldId, idx);
        if (!evaluateAll && !ruleApplies(rule, fieldId)) return;
        const msg = rule.evalua(ctx, row);
        if (msg) {
          alerts.push({ fieldId, type: rule.severity, message: msg, ruleId: rule.id, section: rule.section });
        }
      });
    } else {
      if (!evaluateAll && !ruleApplies(rule, rule.fieldId)) continue;
      const msg = rule.evalua(ctx, undefined);
      if (msg) {
        alerts.push({ fieldId: rule.fieldId, type: rule.severity, message: msg, ruleId: rule.id, section: rule.section });
      }
    }
  }

  return alerts;
}

export function buildCampaniaYearMap(): Record<number, number> {
  const map: Record<number, number> = {};
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const year = getCampaniaYear(id);
    if (year !== null) map[id] = year;
  }
  return map;
}

export { markFieldTouched };
