import {
  STRENGTH_CATALOG,
  GROUNDWATER_CATALOG,
  RELLENO_CATALOG,
  ALTERACION_CATALOG,
  RUGOSIDAD_CATALOG
} from './catalogData';
import { ratingDiscretoRqd, ratingContinuoRqd, ratingDiscretoResistencia, ratingContinuoResistencia } from './rmrInterpolation';

export interface JointRow {
  id: number;
  familia: number; // 1 to 9
  distancia?: number;
  tipo_estructura: string;
  dip?: number;
  dip_dir?: number;
  n_estructuras?: number;
  abertura?: number;
  espesor?: number;
  continuidad?: number;
  espaciamiento?: number;
  extremos_visibles: number;
  terminacion: number;
  relleno1: string;
  relleno2?: string;
  jrc?: number;
  rugosidad: number;
  forma: string;
  alteracion: string;
}

export interface WindowHeader {
  celda: string;
  este_from: number;
  norte_from: number;
  cota_from: number;
  este_to: number;
  norte_to: number;
  cota_to: number;
  largo?: number | string;
  altura: number;
  dip_talud: number;
  dipdir_talud?: number;
  dip_hw?: number;
  az_hw?: number;
  unidad_litologica?: string;
  lito_1?: string;
  lito_2?: string;
  lito_3?: string;
  sector?: string;
  fase?: string;
  nivel?: string;
  fecha?: string;
  mapeador?: string;
  sect_geot?: string;
  intemperia?: string;
  alt_zona?: string;
  condicion_agua: string;
  resistencia_ucs: string;
  comentario?: string;
  campania?: number;
  turno?: string;
  gsi_estructura?: string;
  gsi_superficie?: string;
  gsi_visual?: number;
  control_estructural?: number;
  efectos_voladura?: number;
  ucs_mpa?: number;
  is50_mpa?: number;
}

export interface CalculatedJoint {
  row: JointRow;
  x: number;
  y: number;
  z: number;
  theta: number;
  alpha: number;
  inBounds: boolean;
  alteracion_76: number | null;
  alteracion_89: number | null;
  relleno_76: number | null;
  relleno_89: number | null;
  continuidad_76: number | null;
  continuidad_89: number | null;
  abertura_76: number | null;
  abertura_89: number | null;
  rugosidad_76: number | null;
  rugosidad_89: number | null;
  total_condicion_76: number | null;
  total_condicion_89: number | null;
  relleno1_score_89: number | null;
  relleno2_score_89: number | null;
  relleno1_score_76: number | null;
  relleno2_score_76: number | null;
}

export interface CalculatorResult {
  largo: number;
  dip_hole: number;
  az_hole: number;
  dip_dir_talud: number;
  familias_spacing: Record<number, number>;
  jv: number;
  rqd_est: number;
  rqd_rating_76: number;
  rqd_rating_89: number;
  global_spacing: number;
  spacing_rating_76: number;
  spacing_rating_89: number;
  condicion_rating_76: number;
  condicion_rating_89: number;
  water_rating_76: number;
  water_rating_89: number;
  ucs_rating_76: number;
  ucs_rating_89: number;
  rmr_76: number;
  rmr_89: number;
  class_76: string;
  class_89: string;
  joints: CalculatedJoint[];
}

export function getContinuidadRating(val: number | undefined | null): { r76: number | null; r89: number | null } {
  if (val === undefined || val === null || val === -1) return { r76: null, r89: null };
  if (val < 1.0) return { r76: 5, r89: 6 };
  if (val <= 3.0) return { r76: 4, r89: 4 };
  if (val <= 10.0) return { r76: 3, r89: 2 };
  if (val <= 20.0) return { r76: 1, r89: 1 };
  return { r76: 0, r89: 0 };
}

export function getAberturaRating(val: number | undefined | null): { r76: number | null; r89: number | null } {
  if (val === undefined || val === null || val === -1) return { r76: null, r89: null };
  if (val <= 0) return { r76: 5, r89: 6 };
  if (val < 0.1) return { r76: 4, r89: 5 };
  if (val <= 1.0) return { r76: 3, r89: 3 };
  if (val <= 5.0) return { r76: 1, r89: 1 };
  return { r76: 0, r89: 0 };
}

export function getFillingRatingSingle(rellenoCode: string | undefined | null, thicknessMm: number | undefined | null): { r76: number | null; r89: number | null } {
  if (!rellenoCode) return { r76: null, r89: null };

  const cleanCode = String(rellenoCode).trim().toLowerCase();
  const item = RELLENO_CATALOG[cleanCode] || RELLENO_CATALOG['-1'];

  if (item.clase === 3 || thicknessMm === 0 || thicknessMm === undefined || thicknessMm === null || thicknessMm === -1) {
    return { r76: item.rmr76, r89: item.rmr89 };
  }

  const isMenorA5 = thicknessMm < 5;

  return {
    r76: isMenorA5 ? item.rmr76 : item.rmr76_gt5,
    r89: isMenorA5 ? item.rmr89 : item.rmr89_gt5
  };
}

const EPSILON = 1e-9;

export function getRqdRating76(rqd: number): number {
  const rounded = Math.round(rqd);
  if (rounded < 25) return 3;
  if (rounded < 50) return 8;
  if (rounded < 75) return 13;
  if (rounded < 90) return 17;
  return 20;
}

export function getRqdRating89(rqd: number, campania?: number): number {
  if (campania === 2021) {
    return ratingDiscretoRqd(rqd);
  }
  return ratingContinuoRqd(rqd);
}

export function getSpacingRating76(spacingM: number): number {
  if (spacingM < 0.05 - EPSILON) return 5;
  if (spacingM < 0.3 - EPSILON) return 10;
  if (spacingM < 1.0 - EPSILON) return 20;
  if (spacingM < 3.0 - EPSILON) return 25;
  return 30;
}

export function getSpacingRating89(spacingM: number): number {
  if (spacingM < 0.06 - EPSILON) return 5;
  if (spacingM < 0.2 - EPSILON) return 8;
  if (spacingM < 0.6 - EPSILON) return 10;
  if (spacingM < 2.0 - EPSILON) return 15;
  return 20;
}


export function getRockClass(rmr: number): string {
  if (rmr >= 81) return "Muy Buena";
  if (rmr >= 61) return "Buena";
  if (rmr >= 41) return "Regular";
  if (rmr >= 21) return "Mala";
  return "Muy Mala";
}

export function calculateWindowGeomec(header: WindowHeader, joints: JointRow[]): CalculatorResult {
  const dx = header.este_to - header.este_from;
  const dy = header.norte_to - header.norte_from;
  const dz = header.cota_to - header.cota_from;

  let largo = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const isCoordsValid = [header.este_from, header.norte_from, header.cota_from, header.este_to, header.norte_to, header.cota_to].every(c => c !== undefined && c !== null && !isNaN(c) && c !== 0);
  if (!isCoordsValid || largo <= 0) {
    largo = typeof header.largo === 'string' ? parseFloat(header.largo) : (header.largo || 0.0);
    if (isNaN(largo)) largo = 0;
  }
  largo = Math.round(largo);

  const dip_hole = largo > 0 && isCoordsValid ? Math.asin((header.cota_from - header.cota_to) / largo) * (180 / Math.PI) : 0;

  let az_hole = largo > 0 && isCoordsValid ? Math.atan2(dx, dy) * (180 / Math.PI) : 0;
  if (az_hole < 0) az_hole += 360;

  const dip_dir_talud = header.dipdir_talud !== undefined && header.dipdir_talud !== -1
    ? header.dipdir_talud
    : (az_hole + 90) % 360;

  const acot = (val: number) => {
    if (val === 0) return Math.PI / 2;
    const atanVal = Math.atan(1 / val);
    return val < 0 ? Math.PI + atanVal : atanVal;
  };

  const theta_rad = dx === 0 ? (dy >= 0 ? 0 : Math.PI) : acot(dy / dx);
  const alpha_rad = dz === 0 ? 0 : acot(dx / dz);

  const theta_deg = (theta_rad * 180) / Math.PI;
  const alpha_deg = (alpha_rad * 180) / Math.PI;

  const calculatedJoints: CalculatedJoint[] = joints.map(j => {
    const hasDist = j.distancia !== undefined && j.distancia !== -1 && j.distancia >= 0;
    const dist = hasDist ? j.distancia! : 0.0;

    const x = dist * Math.sin(theta_rad) + header.este_from;
    const y = dist * Math.cos(theta_rad) + header.norte_from;
    const z = dist * Math.cos(theta_rad) * Math.sin(alpha_rad) + header.cota_from;

    const inBounds = dist >= 0 && dist <= largo;

    const hasAlt = j.alteracion && j.alteracion !== '-1';
    const altItem = hasAlt ? ALTERACION_CATALOG[j.alteracion] : null;
    const alt76 = altItem ? altItem.r76 : null;
    const alt89 = altItem ? altItem.r89 : null;

    const hasR1 = !!j.relleno1;
    const hasR2 = !!j.relleno2;

    const rel1_ratings = hasR1 ? getFillingRatingSingle(j.relleno1, j.espesor) : null;
    const rel2_ratings = hasR2 ? getFillingRatingSingle(j.relleno2, j.espesor) : null;

    let rel76: number | null = null;
    let rel89: number | null = null;

    if (rel1_ratings && rel2_ratings) {
      rel76 = Math.min(rel1_ratings.r76 ?? 99, rel2_ratings.r76 ?? 99);
      rel89 = Math.min(rel1_ratings.r89 ?? 99, rel2_ratings.r89 ?? 99);
    } else if (rel1_ratings) {
      rel76 = rel1_ratings.r76;
      rel89 = rel1_ratings.r89;
    } else if (rel2_ratings) {
      rel76 = rel2_ratings.r76;
      rel89 = rel2_ratings.r89;
    }

    const hasCont = j.continuidad !== undefined && j.continuidad !== -1;
    const contRatings = hasCont ? getContinuidadRating(j.continuidad) : null;
    const cont76 = contRatings ? contRatings.r76 : null;
    const cont89 = contRatings ? contRatings.r89 : null;

    const hasAber = j.abertura !== undefined && j.abertura !== -1;
    const abRatings = hasAber ? getAberturaRating(j.abertura) : null;
    const ab76 = abRatings ? abRatings.r76 : null;
    const ab89 = abRatings ? abRatings.r89 : null;

    const hasRug = j.rugosidad && j.rugosidad !== -1;
    const rugItem = hasRug ? RUGOSIDAD_CATALOG[j.rugosidad] : null;
    const rug76 = rugItem ? rugItem.r76 : null;
    const rug89 = rugItem ? rugItem.r89 : null;

    const hasAll89 = alt89 !== null && rel89 !== null && cont89 !== null && ab89 !== null && rug89 !== null;
    const hasAll76 = alt76 !== null && rel76 !== null && cont76 !== null && ab76 !== null && rug76 !== null;

    const total_condicion_76 = hasAll76 ? Math.min(25, alt76! + rel76! + cont76! + ab76! + rug76!) : null;
    const total_condicion_89 = hasAll89 ? Math.min(30, alt89! + rel89! + cont89! + ab89! + rug89!) : null;

    return {
      row: j,
      x, y, z,
      theta: theta_deg,
      alpha: alpha_deg,
      inBounds,
      alteracion_76: alt76,
      alteracion_89: alt89,
      relleno_76: rel76,
      relleno_89: rel89,
      continuidad_76: cont76,
      continuidad_89: cont89,
      abertura_76: ab76,
      abertura_89: ab89,
      rugosidad_76: rug76,
      rugosidad_89: rug89,
      total_condicion_76,
      total_condicion_89,
      relleno1_score_89: rel1_ratings ? rel1_ratings.r89 : null,
      relleno2_score_89: rel2_ratings ? rel2_ratings.r89 : null,
      relleno1_score_76: rel1_ratings ? rel1_ratings.r76 : null,
      relleno2_score_76: rel2_ratings ? rel2_ratings.r76 : null
    };
  });

  const familias_spacing: Record<number, number> = {};
  const familias_sum_pond: Record<number, number> = {};
  const familias_sum_n: Record<number, number> = {};

  joints.forEach(j => {
    const fam = j.familia;
    const sp = j.espaciamiento;

    if (sp !== undefined && sp !== -1 && sp > 0) {
      if (!familias_sum_pond[fam]) {
        familias_sum_pond[fam] = 0;
        familias_sum_n[fam] = 0;
      }
      familias_sum_pond[fam] += sp;
      familias_sum_n[fam] += 1;
    }
  });

  for (let fam = 1; fam <= 9; fam++) {
    if (familias_sum_n[fam] > 0) {
      familias_spacing[fam] = familias_sum_pond[fam] / familias_sum_n[fam];
    }
  }

  let jv = 0;
  Object.keys(familias_spacing).forEach(k => {
    const avgSp = familias_spacing[parseInt(k)];
    if (avgSp > 0) {
      jv += 1 / avgSp;
    }
  });

  const rqd_est = Math.max(0, Math.min(100, jv > 0 ? 115 - 3.3 * jv : 100));

  const rqd_rating_76 = getRqdRating76(rqd_est);
  const rqd_rating_89 = getRqdRating89(rqd_est, header.campania);

  let totalStructures = 0;
  let spacingWeightedSum = 0;
  calculatedJoints.forEach(cj => {
    const sp = cj.row.espaciamiento;
    if (sp !== undefined && sp !== -1 && sp > 0) {
      let n = cj.row.n_estructuras;
      if (n === undefined || n === null || n === -1) {
        n = 0;
      }
      totalStructures += n;
      spacingWeightedSum += sp * n;
    }
  });
  const global_spacing = totalStructures > 0 ? spacingWeightedSum / totalStructures : 0.5;

  const spacing_rating_76 = getSpacingRating76(global_spacing);
  const spacing_rating_89 = getSpacingRating89(global_spacing);

  let totalCond76Structures = 0;
  let totalCond89Structures = 0;
  let cond76WeightedSum = 0;
  let cond89WeightedSum = 0;

  calculatedJoints.forEach(cj => {
    let n = cj.row.n_estructuras;
    if (n === undefined || n === null || n === -1) {
      n = 0;
    }

    if (cj.total_condicion_76 !== null) {
      totalCond76Structures += n;
      cond76WeightedSum += cj.total_condicion_76 * n;
    }
    if (cj.total_condicion_89 !== null) {
      totalCond89Structures += n;
      cond89WeightedSum += cj.total_condicion_89 * n;
    }
  });

  const condicion_rating_76 = totalCond76Structures > 0 ? Math.round(cond76WeightedSum / totalCond76Structures) : 20;
  const condicion_rating_89 = totalCond89Structures > 0 ? Math.round(cond89WeightedSum / totalCond89Structures) : 25;

  const waterItem = GROUNDWATER_CATALOG[header.condicion_agua] || GROUNDWATER_CATALOG['C'];
  const water_rating_76 = waterItem.rmr76;
  const water_rating_89 = waterItem.rmr89;

  // RATING DE RESISTENCIA ESTIMADA (UCS) OBTENIDO EXCLUSIVAMENTE DEL INPUT DE CAMPO (ISRM GRADE R0-R6)
  const strengthItem = STRENGTH_CATALOG[header.resistencia_ucs] || STRENGTH_CATALOG['R4'];
  const ucs_rating_76 = strengthItem.score;
  const isUcsMpaValid = header.ucs_mpa !== undefined && header.ucs_mpa !== null && header.ucs_mpa > 0;
  const isCampAnaAbaco = header.campania === 2021 || header.campania === 2022 || header.campania === 2023;

  const ucs_rating_89 = isCampAnaAbaco
    ? (isUcsMpaValid ? ratingContinuoResistencia(header.ucs_mpa!) : strengthItem.score)
    : (isUcsMpaValid ? ratingDiscretoResistencia(header.ucs_mpa!) : strengthItem.score);

  const rmr_76 = ucs_rating_76 + rqd_rating_76 + spacing_rating_76 + condicion_rating_76 + water_rating_76;
  const rmr_89 = ucs_rating_89 + rqd_rating_89 + spacing_rating_89 + condicion_rating_89 + water_rating_89;

  return {
    largo,
    dip_hole,
    az_hole,
    dip_dir_talud,
    familias_spacing,
    jv,
    rqd_est: Math.round(rqd_est * 100) / 100,
    rqd_rating_76,
    rqd_rating_89,
    global_spacing: Math.round(global_spacing * 1000) / 1000,
    spacing_rating_76,
    spacing_rating_89,
    condicion_rating_76,
    condicion_rating_89,
    water_rating_76,
    water_rating_89,
    ucs_rating_76,
    ucs_rating_89,
    rmr_76,
    rmr_89,
    class_76: getRockClass(rmr_76),
    class_89: getRockClass(rmr_89),
    joints: calculatedJoints
  };
}