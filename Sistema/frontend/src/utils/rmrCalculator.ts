import {
  STRENGTH_CATALOG,
  GROUNDWATER_CATALOG,
  RELLENO_CATALOG,
  ALTERACION_CATALOG,
  RUGOSIDAD_CATALOG
} from './catalogData';

export interface JointRow {
  id: number;
  familia: number; // 1 to 9
  distancia: number; // meters
  tipo_estructura: string; // J, BED, F, SZ, CON
  dip: number; // degrees
  dip_dir: number; // degrees
  n_estructuras: number;
  abertura: number; // mm
  espesor: number; // mm
  continuidad: number; // m
  espaciamiento: number; // m
  extremos_visibles: number; // 0, 1, 2
  terminacion: number; // 0 to 5
  relleno1: string; // ca, sand, ch, cl, gy, RXF, FBX, GOU, PAT, SIO, QZ, SU, OX, ep, cwf
  relleno2?: string;
  jrc: number; // 0-20
  rugosidad: number; // 1-9
  forma: string; // P, C, O, E, I
  alteracion: string; // f, d, m, a, c, s
}

export interface WindowHeader {
  celda: string;
  este_from: number;
  norte_from: number;
  cota_from: number;
  este_to: number;
  norte_to: number;
  cota_to: number;
  altura: number;
  dip_talud?: number;
  lito_3?: string;
  lito_model?: string;
  mapeador?: string;
  sector?: string;
  fase?: string;
  nivel?: string;
  sect_geot?: string;
  fecha?: string;
  condicion_agua: string; // C, H, M, E, F
  resistencia_ucs: string; // R0 to R6
}

export interface CalculatedJoint {
  row: JointRow;
  x: number;
  y: number;
  z: number;
  // Ratings
  alteracion_76: number;
  alteracion_89: number;
  relleno_76: number;
  relleno_89: number;
  continuidad_76: number;
  continuidad_89: number;
  abertura_76: number;
  abertura_89: number;
  rugosidad_76: number;
  rugosidad_89: number;
  total_condicion_76: number;
  total_condicion_89: number;
}

export interface CalculatorResult {
  largo: number;
  dip_hole: number;
  az_hole: number;
  dip_dir_talud: number;
  // Averages
  familias_spacing: Record<number, number>; // average spacing per family
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
  // RMR Finals
  rmr_76: number;
  rmr_89: number;
  class_76: string;
  class_89: string;
  joints: CalculatedJoint[];
}

// 1. Individual parameter rating calculations
export function getContinuidadRating(val: number): { r76: number; r89: number } {
  if (val < 1.0) return { r76: 5, r89: 6 };
  if (val <= 3.0) return { r76: 4, r89: 4 };
  if (val <= 10.0) return { r76: 3, r89: 2 };
  if (val <= 20.0) return { r76: 1, r89: 1 };
  return { r76: 0, r89: 0 };
}

export function getAberturaRating(val: number): { r76: number; r89: number } {
  if (val <= 0) return { r76: 5, r89: 6 };
  if (val < 0.1) return { r76: 4, r89: 5 };
  if (val <= 1.0) return { r76: 3, r89: 3 };
  if (val <= 5.0) return { r76: 1, r89: 1 };
  return { r76: 0, r89: 0 };
}

export function getFillingRatingSingle(rellenoCode: string, thicknessMm: number): { r76: number; r89: number } {
  const item = RELLENO_CATALOG[rellenoCode] || RELLENO_CATALOG['cwf'];
  if (item.clase === 3 || thicknessMm === 0) {
    return { r76: 5, r89: 6 };
  }
  if (item.clase === 2) { // Duro
    return {
      r76: thicknessMm < 5 ? 4 : 3,
      r89: thicknessMm < 5 ? 4 : 2
    };
  } else { // Blando
    return {
      r76: thicknessMm < 5 ? 2 : 0,
      r89: thicknessMm < 5 ? 2 : 0
    };
  }
}

export function getRqdRating76(rqd: number): number {
  if (rqd < 25) return 3;
  if (rqd < 50) return 8;
  if (rqd < 75) return 13;
  if (rqd < 90) return 17;
  return 20;
}

export function getRqdRating89(rqd: number): number {
  if (rqd < 0) return 3;
  if (rqd > 100) return 20;
  // Bieniawski cubic continuous equation
  const val = -0.000006 * Math.pow(rqd, 3) + 0.0015 * Math.pow(rqd, 2) + 0.0806 * rqd + 3.0282;
  const rating = Math.round(val);
  return Math.max(3, Math.min(20, rating));
}

export function getSpacingRating76(spacingM: number): number {
  if (spacingM < 0.05) return 5;
  if (spacingM <= 0.3) return 10;
  if (spacingM <= 1.0) return 20;
  if (spacingM <= 3.0) return 25;
  return 30;
}

export function getSpacingRating89(spacingM: number): number {
  if (spacingM < 0.06) return 5;
  if (spacingM <= 0.2) return 8;
  if (spacingM <= 0.6) return 10;
  if (spacingM <= 2.0) return 15;
  return 20;
}

export function getRockClass(rmr: number): string {
  if (rmr >= 81) return "Muy Buena";
  if (rmr >= 61) return "Buena";
  if (rmr >= 41) return "Regular";
  if (rmr >= 21) return "Mala";
  return "Muy Mala";
}

// 2. Comprehensive Calculator Engine
export function calculateWindowGeomec(header: WindowHeader, joints: JointRow[]): CalculatorResult {
  const dx = header.este_to - header.este_from;
  const dy = header.norte_to - header.norte_from;
  const dz = header.cota_to - header.cota_from;

  // 3D Distance (Window Largo)
  const largo = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Inclinacion (Dip hole)
  const dip_hole = largo > 0 ? Math.asin((header.cota_from - header.cota_to) / largo) * (180 / Math.PI) : 0;

  // Azimut (Az hole)
  let az_hole = Math.atan2(dx, dy) * (180 / Math.PI);
  if (az_hole < 0) az_hole += 360;

  // DipDir Talud = Az_hole + 90
  const dip_dir_talud = (az_hole + 90) % 360;

  // 3D Direction Cosenes Unit Vectors
  const vx = largo > 0 ? dx / largo : 0;
  const vy = largo > 0 ? dy / largo : 0;
  const vz = largo > 0 ? dz / largo : 0;

  // Calculate each joint coordinates and ratings
  const calculatedJoints: CalculatedJoint[] = joints.map(j => {
    // Spatial coordinates projection
    const x = header.este_from + j.distancia * vx;
    const y = header.norte_from + j.distancia * vy;
    const z = header.cota_from + j.distancia * vz;

    // Alteracion
    const altItem = ALTERACION_CATALOG[j.alteracion] || { r76: 3, r89: 3 };
    const alt76 = altItem.r76;
    const alt89 = altItem.r89;

    // Relleno (Conservador: toma el menor puntaje entre Relleno 1 y Relleno 2)
    const rel1_ratings = getFillingRatingSingle(j.relleno1, j.espesor);
    const rel2_ratings = j.relleno2 ? getFillingRatingSingle(j.relleno2, j.espesor) : { r76: 99, r89: 99 };
    const rel76 = Math.min(rel1_ratings.r76, rel2_ratings.r76);
    const rel89 = Math.min(rel1_ratings.r89, rel2_ratings.r89);

    // Continuidad
    const contRatings = getContinuidadRating(j.continuidad);
    const cont76 = contRatings.r76;
    const cont89 = contRatings.r89;

    // Abertura
    const abRatings = getAberturaRating(j.abertura);
    const ab76 = abRatings.r76;
    const ab89 = abRatings.r89;

    // Rugosidad
    const rugItem = RUGOSIDAD_CATALOG[j.rugosidad] || { r76: 3, r89: 3 };
    const rug76 = rugItem.r76;
    const rug89 = rugItem.r89;

    // Total condition rating (cap at 25 for 76 and 30 for 89)
    const total_condicion_76 = Math.min(25, alt76 + rel76 + cont76 + ab76 + rug76);
    const total_condicion_89 = Math.min(30, alt89 + rel89 + cont89 + ab89 + rug89);

    return {
      row: j,
      x,
      y,
      z,
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
      total_condicion_89
    };
  });

  // Averages per family (group by familia 1 to 9)
  const familySpacingSums: Record<number, number[]> = {};
  calculatedJoints.forEach(cj => {
    const fam = cj.row.familia;
    if (cj.row.espaciamiento > 0) {
      if (!familySpacingSums[fam]) familySpacingSums[fam] = [];
      familySpacingSums[fam].push(cj.row.espaciamiento);
    }
  });

  const familias_spacing: Record<number, number> = {};
  Object.keys(familySpacingSums).forEach(k => {
    const fam = parseInt(k);
    const arr = familySpacingSums[fam];
    familias_spacing[fam] = arr.reduce((a, b) => a + b, 0) / arr.length;
  });

  // Joint Volumetric Count (Jv)
  let jv = 0;
  Object.values(familias_spacing).forEach(avgSp => {
    if (avgSp > 0) {
      jv += 1 / avgSp;
    }
  });

  // RQD estimation (Palmström: 115 - 3.3 * Jv)
  const rqd_est = Math.max(0, Math.min(100, jv > 0 ? 115 - 3.3 * jv : 100));

  // RQD Ratings
  const rqd_rating_76 = getRqdRating76(rqd_est);
  const rqd_rating_89 = getRqdRating89(rqd_est);

  // Global Spacing (weighted average by number of structures of each row)
  let totalStructures = 0;
  let spacingWeightedSum = 0;
  calculatedJoints.forEach(cj => {
    if (cj.row.espaciamiento > 0) {
      const n = cj.row.n_estructuras || 1;
      totalStructures += n;
      spacingWeightedSum += cj.row.espaciamiento * n;
    }
  });
  const global_spacing = totalStructures > 0 ? spacingWeightedSum / totalStructures : 0.5; // default if none

  const spacing_rating_76 = getSpacingRating76(global_spacing);
  const spacing_rating_89 = getSpacingRating89(global_spacing);

  // Global Condition Rating (weighted average by number of structures of each row)
  let totalCondStructures = 0;
  let cond76WeightedSum = 0;
  let cond89WeightedSum = 0;
  calculatedJoints.forEach(cj => {
    const n = cj.row.n_estructuras || 1;
    totalCondStructures += n;
    cond76WeightedSum += cj.total_condicion_76 * n;
    cond89WeightedSum += cj.total_condicion_89 * n;
  });
  const condicion_rating_76 = totalCondStructures > 0 ? Math.round(cond76WeightedSum / totalCondStructures) : 20;
  const condicion_rating_89 = totalCondStructures > 0 ? Math.round(cond89WeightedSum / totalCondStructures) : 25;

  // Water Ratings
  const waterItem = GROUNDWATER_CATALOG[header.condicion_agua] || GROUNDWATER_CATALOG['C'];
  const water_rating_76 = waterItem.rmr76;
  const water_rating_89 = waterItem.rmr89;

  // UCS Strength Ratings
  const strengthItem = STRENGTH_CATALOG[header.resistencia_ucs] || STRENGTH_CATALOG['R4'];
  const ucs_rating_76 = strengthItem.score;
  const ucs_rating_89 = strengthItem.score;

  // RMR Finals
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
