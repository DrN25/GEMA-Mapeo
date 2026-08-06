/**
 * windowTransform.ts — Transformaciones de datos de ventanas (puras y testables).
 *
 *  - normalizeJoints:              normaliza la grilla de discontinuidades (familias, plantillas)
 *  - windowFromServerResponse:     respuesta del GET /api/ventanas/{codigo} → WindowData
 *  - excelDataToWindowData:        item del preview de importación → WindowData
 */

import type { WindowHeader, JointRow } from './rmrCalculator';
import type { WindowData } from './diffUtils';
import { normalizeNumeric } from './numericPrecision';
import { getCampaniaIdFromYear } from './campaniasCatalog';
import { GSI_SUPERFICIE_CATALOG, GSI_ESTRUCTURA_CATALOG } from './catalogData';

/**
 * Normaliza un código GSI recuperado de BD/Excel: trim + mayúsculas.
 * Si tras normalizar no está en el catálogo (y el catálogo está cargado),
 * devuelve '' (vacío) para que el select solo ofrezca opciones válidas.
 * Si el catálogo no se cargó (offline), conserva el valor normalizado para
 * no perder datos.
 */
export function toGsiCode(v: any, catalog: Record<string, unknown>): string {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s || s === '-1') return '';
  if (Object.keys(catalog).length > 0 && !(s in catalog)) return '';
  return s;
}

export function normalizeJoints(loadedJoints: JointRow[], defaultAlt: string = 'd'): JointRow[] {
  const mappedJoints = (loadedJoints || []).map((j, i) => {
    const expectedFam = Math.ceil((i + 1) / 3.0);
    const maxFamAllowed = Math.ceil((loadedJoints.length || 1) / 3.0);
    const useFam = (j.familia && j.familia <= maxFamAllowed) ? j.familia : expectedFam;
    return {
      ...j,
      familia: useFam,
      tipo_estructura: (j.tipo_estructura && j.tipo_estructura.toUpperCase() === 'J') ? 'JN' : (j.tipo_estructura || 'JN'),
      alteracion: (j.alteracion && j.alteracion !== '-1') ? j.alteracion : defaultAlt
    };
  });
  const result: JointRow[] = [...mappedJoints];

  // Obtener familias existentes en los datos + asegurar 1-3
  const fams = new Set(mappedJoints.map(j => j.familia));
  for (let f = 1; f <= 3; f++) fams.add(f);
  const sortedFams = [...fams].sort((a, b) => a - b);

  for (const fam of sortedFams) {
    const count = result.filter(j => j.familia === fam).length;
    for (let i = count; i < 3; i++) {
      result.push({
        id: result.length + 1,
        familia: fam,
        distancia: -1,
        tipo_estructura: '-1',
        dip: -1,
        dip_dir: -1,
        n_estructuras: -1,
        abertura: -1,
        espesor: -1,
        continuidad: -1,
        espaciamiento: -1,
        extremos_visibles: -1,
        terminacion: -1,
        relleno1: '-1',
        relleno2: undefined,
        jrc: -1,
        rugosidad: -1,
        forma: '-1',
        // Mismo criterio que los joints cargados (map de arriba): la fila vacía
        // toma el defaultAlt. Si quedara '-1', la PRIMERA re-normalización lo
        // cambiaría a defaultAlt → el hash del caché diferiría del snapshot en
        // cada apertura → celda marcada BORRADOR sin cambios y diff fantasma.
        alteracion: defaultAlt
      });
    }
  }
  return result
    .sort((a, b) => a.familia - b.familia)
    .map((j, idx) => ({ ...j, id: idx + 1 }));
}

/**
 * Política del sistema en cascada: ninguna distancia de discontinuidad puede
 * exceder el largo de la celda. Ajusta los joints que la violan.
 *
 * Devuelve el MISMO array si no hay nada que ajustar (para evitar re-renders).
 * Debe aplicarse por igual al estado activo Y al snapshot/baseline, para que
 * el caché y el snapshot nunca diverjan por esta política (si divergieran,
 * la celda quedaría marcada pendiente con "cambios de discontinuidad" sin que
 * el usuario toque nada).
 *
 * @param calculatedLargo largo calculado (RMR) si ya está disponible; si no,
 *        se deriva de las coordenadas o del largo del header (misma lógica
 *        que el efecto de cascada de App.tsx).
 */
export function applyDistanceCascade(
  header: WindowHeader,
  joints: JointRow[],
  calculatedLargo?: number
): JointRow[] {
  let maxLargo = 0;
  if (calculatedLargo !== undefined && calculatedLargo !== null && calculatedLargo > 0) {
    maxLargo = calculatedLargo;
  } else {
    const ix = parseFloat(String(header.este_from));
    const iy = parseFloat(String(header.norte_from));
    const ic = parseFloat(String(header.cota_from));
    const fx = parseFloat(String(header.este_to));
    const fy = parseFloat(String(header.norte_to));
    const fc = parseFloat(String(header.cota_to));
    const hasCoords = [ix, iy, ic, fx, fy, fc].every(n => !isNaN(n) && n !== 0);
    maxLargo = hasCoords
      ? Math.round(Math.sqrt(Math.pow(fx - ix, 2) + Math.pow(fy - iy, 2) + Math.pow(fc - ic, 2)))
      : Math.round(Number(header.largo) || 0);
  }

  if (maxLargo <= 0) return joints;
  const needsAdjustment = (joints || []).some(
    j => j.distancia !== undefined && j.distancia !== -1 && j.distancia !== null && j.distancia > maxLargo
  );
  if (!needsAdjustment) return joints;

  return (joints || []).map(j => {
    if (j.distancia !== undefined && j.distancia !== -1 && j.distancia !== null && j.distancia > maxLargo) {
      return { ...j, distancia: maxLargo };
    }
    return j;
  });
}

/**
 * Convierte la respuesta del GET /api/ventanas/{codigo} al formato interno
 * WindowData (header + joints normalizados). Se reutiliza al abrir una celda
 * y al importar celdas duplicadas (baseline del diff).
 */
export function windowFromServerResponse(v: any): WindowData {
  const roundDec = (val: any, decs: number): number => {
    if (val === null || val === undefined) return 0;
    const num = parseFloat(val);
    if (isNaN(num)) return 0;
    const factor = Math.pow(10, decs);
    return Math.round(num * factor) / factor;
  };

  const getFieldVal = (d: any, aliasKey: string, snakeKey: string, fallback: any = -1) => {
    const val = d[aliasKey] !== undefined && d[aliasKey] !== null ? d[aliasKey] : d[snakeKey];
    return val !== undefined && val !== null ? val : fallback;
  };

  const header: WindowHeader = {
    celda: v.codigo,
    este_from: normalizeNumeric('este_from', v.este_ini) ?? undefined,
    norte_from: v.norte_ini !== null && v.norte_ini !== undefined ? roundDec(v.norte_ini, 3) : undefined,
    cota_from: v.cota_ini !== null && v.cota_ini !== undefined ? roundDec(v.cota_ini, 2) : undefined,
    este_to: normalizeNumeric('este_to', v.este_fin) ?? undefined,
    norte_to: v.norte_fin !== null && v.norte_fin !== undefined ? roundDec(v.norte_fin, 3) : undefined,
    cota_to: v.cota_fin !== null && v.cota_fin !== undefined ? roundDec(v.cota_fin, 2) : undefined,
    altura: (v.altura !== null && v.altura !== undefined) ? roundDec(v.altura, 1) : undefined,
    dip_talud: v.dip_talud !== null && v.dip_talud !== undefined ? roundDec(v.dip_talud, 2) : undefined,
    dipdir_talud: v.dipdir_talud !== null && v.dipdir_talud !== undefined ? roundDec(v.dipdir_talud, 2) : undefined,
    dip_hw: v.dip !== null && v.dip !== undefined ? roundDec(v.dip, 2) : undefined,
    az_hw: v.azimut_hole !== null && v.azimut_hole !== undefined ? roundDec(v.azimut_hole, 2) : undefined,
    largo: v.largo_m !== null && v.largo_m !== undefined
      ? v.largo_m
      : (v.distancia_celda !== null && v.distancia_celda !== undefined ? v.distancia_celda : undefined),
    unidad_litologica: v.unidad_litologica || '',
    lito_1: v.lito_1 || '',
    lito_2: v.lito_2 || '',
    lito_3: v.lito_3 || '',
    mapeador: v.mapeador || 'AS-HM',
    sector: v.sector_geotecnico || '',
    fase: String(v.fase || ''),
    nivel: String(v.nivel || ''),
    sect_geot: v.sector_geotecnico || '',
    intemperia: v.intemperismo || '',
    alteracion: v.alteracion || v.altura_mapeo || '',
    alt_mapeo: v.alteracion || v.altura_mapeo || '',
    fecha: v.fecha_mapeo || new Date().toISOString().split('T')[0],
    condicion_agua: v.rmr_input?.agua_codigo || '',
    resistencia_ucs: v.rmr_input?.resistencia_codigo || '',
    comentario: v.rmr_input?.comentario || '',
    campania: v.campania !== null && v.campania !== undefined ? v.campania : 2026,
    gsi_estructura: toGsiCode(v.rmr_input?.gsi_estructura, GSI_ESTRUCTURA_CATALOG),
    gsi_superficie: toGsiCode(v.rmr_input?.gsi_superficie, GSI_SUPERFICIE_CATALOG),
    gsi_visual: v.rmr_input?.gsi_visual !== null && v.rmr_input?.gsi_visual !== undefined ? v.rmr_input.gsi_visual : 0,
    control_estructural: v.rmr_input?.control_estructural !== null && v.rmr_input?.control_estructural !== undefined ? v.rmr_input.control_estructural : 0,
    efectos_voladura: v.rmr_input?.efectos_voladura !== null && v.rmr_input?.efectos_voladura !== undefined ? v.rmr_input.efectos_voladura : 0,
    ucs_mpa: v.rmr_input?.ucs_mpa !== null && v.rmr_input?.ucs_mpa !== undefined ? parseFloat(v.rmr_input.ucs_mpa) : 0,
    is50_mpa: v.rmr_input?.is50_mpa !== null && v.rmr_input?.is50_mpa !== undefined ? parseFloat(v.rmr_input.is50_mpa) : 0
  };

  const joints: JointRow[] = (v.discontinuidades || []).map((d: any, idx: number) => {
    const dist = getFieldVal(d, 'dist', 'distancia_m', -1);
    const nstr = getFieldVal(d, 'nstr', 'n_estructuras', -1);
    const aber = getFieldVal(d, 'aber', 'abertura_mm', -1);
    const esp = getFieldVal(d, 'esp', 'espesor_mm', -1);
    const cont = getFieldVal(d, 'cont', 'continuidad_m', -1);
    const espac = getFieldVal(d, 'espac', 'espaciamiento_m', -1);
    const dip_val = d.dip !== undefined && d.dip !== null ? d.dip : -1;
    const dip_dir_val = getFieldVal(d, 'dipdir', 'dip_dir', -1);
    const rug_val = getFieldVal(d, 'rug', 'rugosidad_codigo', -1);
    const ext_val = getFieldVal(d, 'next', 'n_extremos_visibles', -1);
    const term_val = getFieldVal(d, 'term', 'terminacion', -1);
    const r1_raw = getFieldVal(d, 'r1', 'relleno_1_codigo', '-1');
    const r2_raw = getFieldVal(d, 'r2', 'relleno_2_codigo', undefined);
    const r1_val = (!r1_raw || r1_raw === '-1') ? '-1' : (r1_raw === 'cwf' ? 'c' : r1_raw);
    const r2_val = (!r2_raw || r2_raw === '-1') ? undefined : (r2_raw === 'cwf' ? 'c' : r2_raw);

    return {
      id: idx + 1,
      estructura_id: d.estructura_id ?? null,
      familia: d.fam || d.familia_id || 1,
      distancia: dist !== -1 ? Math.max(0, Math.round(dist)) : -1,
      tipo_estructura: (d.tipo && d.tipo !== '-1') ? d.tipo : (d.tipo_estructura && d.tipo_estructura !== '-1' ? d.tipo_estructura : '-1'),
      dip: dip_val !== -1 ? roundDec(dip_val, 2) : -1,
      dip_dir: dip_dir_val !== -1 ? roundDec(dip_dir_val, 2) : -1,
      n_estructuras: nstr !== -1 ? (Math.round(nstr) > 0 ? Math.round(nstr) : -1) : -1,
      abertura: aber !== -1 ? roundDec(aber, 1) : -1,
      espesor: esp !== -1 ? roundDec(esp, 1) : -1,
      continuidad: cont !== -1 ? roundDec(cont, 2) : -1,
      espaciamiento: espac !== -1 ? roundDec(espac, 2) : -1,
      extremos_visibles: ext_val !== undefined && ext_val !== null && ext_val !== -1 ? Math.min(2, Math.max(0, ext_val)) : -1,
      terminacion: term_val !== undefined && term_val !== null && term_val !== -1 ? Math.min(3, Math.max(0, term_val)) : -1,
      relleno1: r1_val,
      relleno2: r2_val,
      jrc: d.jrc !== null && d.jrc !== undefined ? Math.min(20, Math.max(0, d.jrc)) : -1,
      rugosidad: rug_val !== -1 ? Math.min(9, Math.max(0, rug_val)) : -1,
      forma: (d.forma && d.forma !== '-1') ? d.forma : (d.forma_estructura && d.forma_estructura !== '-1' ? d.forma_estructura : '-1'),
      alteracion: (d.alt && d.alt !== '-1') ? d.alt : (d.alteracion_codigo && d.alteracion_codigo !== '-1' ? d.alteracion_codigo : '-1')
    };
  });

  return { header, joints: normalizeJoints(joints, header.intemperia) };
}

/**
 * Convierte un item del preview de importación (excel_data + estructuras)
 * al formato interno WindowData. Devuelve null si no es convertible.
 */
export function excelDataToWindowData(codigoFinal: string, excelData: any, estructuras: any[]): WindowData | null {
  if (!codigoFinal || !excelData) return null;
  const num = (v: any, key: string): number | undefined => normalizeNumeric(key, v) ?? undefined;
  const str = (v: any): string => (v === null || v === undefined ? '' : String(v).trim());

  const campaniaMatch = String(excelData.campania || '').match(/20\d{2}/);
  const header: WindowHeader = {
    celda: codigoFinal,
    este_from: num(excelData.este_ini, 'este_from'),
    norte_from: num(excelData.norte_ini, 'norte_from'),
    cota_from: num(excelData.cota_ini, 'cota_from'),
    este_to: num(excelData.este_fin, 'este_to'),
    norte_to: num(excelData.norte_fin, 'norte_to'),
    cota_to: num(excelData.cota_fin, 'cota_to'),
    largo: num(excelData.largo_m, 'largo'),
    altura: num(excelData.altura_m, 'altura'),
    dip_talud: num(excelData.dip_talud, 'dip_talud'),
    dipdir_talud: num(excelData.dipdir_talud, 'dipdir_talud'),
    dip_hw: num(excelData.dip, 'dip_hw'),
    az_hw: num(excelData.azimut_hole, 'az_hw'),
    unidad_litologica: str(excelData.unidad_litologica),
    lito_1: str(excelData.lito_1),
    lito_2: str(excelData.lito_2),
    lito_3: str(excelData.lito_3),
    mapeador: str(excelData.mapeador) || 'AS-HM',
    sector: str(excelData.sector),
    fase: str(excelData.fase),
    nivel: str(excelData.nivel),
    sect_geot: str(excelData.sector),
    intemperia: str(excelData.intemperismo),
    alteracion: str(excelData.alteracion),
    alt_mapeo: str(excelData.alteracion),
    fecha: str(excelData.fecha) || new Date().toISOString().split('T')[0],
    condicion_agua: str(excelData.condicion_agua_rmr76) || str(excelData.condicion_agua_rmr89),
    resistencia_ucs: str(excelData.dureza_rmr76) || str(excelData.dureza_rmr89),
    comentario: str(excelData.comentarios),
    // El sistema trabaja con ID de campaña (Campaña 2026 = id 7), no con el año
    campania: campaniaMatch ? (getCampaniaIdFromYear(campaniaMatch[0]) ?? 7) : 7,
    gsi_superficie: toGsiCode(excelData.gsi_superficie, GSI_SUPERFICIE_CATALOG),
    gsi_estructura: toGsiCode(excelData.gsi_estructura, GSI_ESTRUCTURA_CATALOG),
    gsi_visual: num(excelData.gsi_visual_rmr76, 'gsi_visual') ?? 0,
    control_estructural: num(excelData.control_estructural_rmr76, 'control_estructural') ?? 0,
    efectos_voladura: num(excelData.efectos_voladura_rmr76, 'efectos_voladura') ?? 0,
    ucs_mpa: num(excelData.ucs_mpa, 'ucs_mpa') ?? 0,
    is50_mpa: num(excelData.is50_mpa, 'is50_mpa') ?? 0,
  };

  const joints: JointRow[] = (estructuras || []).map((s: any, idx: number) => {
    const toNum = (v: any, key: string): number => {
      const n = normalizeNumeric(key, v);
      return n === null ? -1 : n;
    };
    return {
      id: idx + 1,
      estructura_id: null,
      familia: s.familia_id || Math.ceil((idx + 1) / 3),
      distancia: toNum(s.distancia_m, 'distancia'),
      tipo_estructura: str(s.tipo_estructura) || 'JN',
      dip: toNum(s.dip, 'dip'),
      dip_dir: toNum(s.dip_dir, 'dip_dir'),
      n_estructuras: toNum(s.n_estructuras, 'n_estructuras'),
      abertura: toNum(s.abertura_mm, 'abertura'),
      espesor: toNum(s.espesor_mm, 'espesor'),
      continuidad: toNum(s.continuidad_m, 'continuidad'),
      espaciamiento: toNum(s.espaciamiento_m, 'espaciamiento'),
      extremos_visibles: toNum(s.n_extremos_visibles, 'n_extremos_visibles'),
      terminacion: toNum(s.terminacion, 'terminacion'),
      relleno1: str(s.relleno_1_codigo) || '-1',
      relleno2: str(s.relleno_2_codigo) || undefined,
      jrc: toNum(s.jrc, 'jrc'),
      rugosidad: toNum(s.rugosidad_codigo, 'rugosidad'),
      forma: str(s.forma_estructura) || '-1',
      alteracion: str(s.alteracion_codigo) || '-1',
    };
  });

  return { header, joints: normalizeJoints(joints, header.intemperia) };
}
