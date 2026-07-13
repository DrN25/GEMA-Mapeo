export interface LithologyItem {
  name: string;
  bg: string;
  text: string;
}

export const LITHOLOGY_CATALOG: Record<string, LithologyItem> = {
  bx: { name: "Brecha", bg: "#FF0D00", text: "#FFFFFF" },
  egt: { name: "Exoskarn granate", bg: "#C86432", text: "#FFFFFF" },
  endo: { name: "Endo skarn", bg: "#A020F0", text: "#FFFFFF" },
  epg: { name: "Monzonita epidótica", bg: "#64A050", text: "#FFFFFF" },
  esk: { name: "Exoskarn", bg: "#BADD5B", text: "#000000" },
  gd: { name: "Granodiorita", bg: "#B4B4B4", text: "#000000" },
  gsk: { name: "Garnet skarn", bg: "#D25028", text: "#FFFFFF" },
  hbx: { name: "Brecha hidrotermal", bg: "#DC5050", text: "#FFFFFF" },
  hfl: { name: "Hornfels", bg: "#A0A0A0", text: "#000000" },
  lmt: { name: "Caliza", bg: "#4E708F", text: "#FFFFFF" },
  lmt_c: { name: "Caliza Carbonosa", bg: "#354A5F", text: "#FFFFFF" },
  lmt_m: { name: "Caliza micrítica", bg: "#4E708F", text: "#FFFFFF" },
  lmt_mg: { name: "Caliza Magnésica", bg: "#8B6914", text: "#FFFFFF" },
  lmt_s1: { name: "Caliza Sucia 1", bg: "#D1C29B", text: "#000000" },
  lmt_s2: { name: "Caliza Sucia 2", bg: "#D1C29B", text: "#000000" },
  lmt_s3: { name: "Caliza Sucia 3", bg: "#D1C29B", text: "#000000" },
  lmt_s4: { name: "Caliza Sucia 4", bg: "#D1C29B", text: "#000000" },
  mara: { name: "Caliza Mara", bg: "#5C7C99", text: "#FFFFFF" },
  mara_bx: { name: "Brecha Mara", bg: "#F25555", text: "#FFFFFF" },
  mbc: { name: "Mármol con calcosita", bg: "#2EAEA8", text: "#FFFFFF" },
  mbf: { name: "Monzonita biotítica félsica", bg: "#FEC85A", text: "#000000" },
  mbf_1: { name: "Monzonita biotítica félsica 1", bg: "#FECE65", text: "#000000" },
  mbf_2: { name: "Monzonita biotítica félsica 2", bg: "#FDC178", text: "#000000" },
  mbf_p: { name: "Monzonita biotítica félsica p", bg: "#FFA500", text: "#000000" },
  mbl: { name: "Mármol biotítico", bg: "#66B2FF", text: "#000000" },
  mbx: { name: "Brecha mármol", bg: "#F25555", text: "#FFFFFF" },
  msk: { name: "Magnetite skarn", bg: "#782828", text: "#FFFFFF" },
  mzb: { name: "Monzonita biotítica", bg: "#FFC896", text: "#000000" },
  mzb_eq: { name: "Monzonita biotítica equigranular", bg: "#FEE5CE", text: "#000000" },
  mzb_p: { name: "Monzonita biotítica porfírica", bg: "#FFD8B5", text: "#000000" },
  mzd: { name: "Monzonita Diorítico", bg: "#3E9C3E", text: "#FFFFFF" },
  mzh: { name: "Monzonita hornbléndica", bg: "#FF78B4", text: "#000000" },
  mzh_1: { name: "Monzonita hornbléndica 1", bg: "#FF6294", text: "#FFFFFF" },
  mzh_2: { name: "Monzonita hornbléndica 2", bg: "#FF62F1", text: "#000000" },
  mzm: { name: "Monzonita máfica", bg: "#FED2F0", text: "#000000" },
  mzm_m: { name: "Monzonita máfica masiva", bg: "#FEDCFC", text: "#000000" },
  mzq: { name: "Monzonita cuarzosa", bg: "#D4C848", text: "#000000" },
  nr: { name: "No recuperado", bg: "#DCDCDC", text: "#000000" },
  ovd: { name: "Óxidos y venas", bg: "#B45A00", text: "#FFFFFF" },
  psk: { name: "Pyroxene skarn", bg: "#A0B43C", text: "#000000" },
  qt: { name: "Cuarcita", bg: "#F5F5F5", text: "#000000" },
  skarn: { name: "Skarn", bg: "#BADD5B", text: "#000000" },
  tbx: { name: "Brecha tectónica", bg: "#FF6464", text: "#FFFFFF" }
};

export interface GroundwaterItem {
  desc: string;
  rmr76: number;
  rmr89: number;
}

export const GROUNDWATER_CATALOG: Record<string, GroundwaterItem> = {
  C: { desc: "Completamente seco (C)", rmr76: 10, rmr89: 15 },
  H: { desc: "Húmedo (H)", rmr76: 10, rmr89: 10 },
  M: { desc: "Mojado (Goteo) (M)", rmr76: 7, rmr89: 7 },
  E: { desc: "Goteando (Presión moderada) (E)", rmr76: 4, rmr89: 4 },
  F: { desc: "Fluyendo (Flujo continuo) (F)", rmr76: 0, rmr89: 0 }
};

export interface StrengthItem {
  desc: string;
  score: number;
}

export const STRENGTH_CATALOG: Record<string, StrengthItem> = {
  R0: { desc: "R0 — Extremadamente débil (< 1 MPa)", score: 0 },
  R1: { desc: "R1 — Muy débil (1 - 5 MPa)", score: 1 },
  R2: { desc: "R2 — Débil (5 - 25 MPa)", score: 2 },
  R3: { desc: "R3 — Media / Moderadamente resistente (25 - 50 MPa)", score: 4 },
  R4: { desc: "R4 — Fuerte / Resistente (50 - 100 MPa)", score: 7 },
  R5: { desc: "R5 — Muy fuerte / Muy resistente (100 - 250 MPa)", score: 12 },
  R6: { desc: "R6 — Extremadamente fuerte (> 250 MPa)", score: 15 }
};

export const STRUCTURE_CATALOG: Record<string, string> = {
  JN: "Junta (JS)",
  BED: "Estratos (BED)",
  F: "Falla (F)",
  SZ: "Zona de Cizalla (SZ)",
  CON: "Contacto (CON)",
  DQ: "Dique (DQ)"
};

export interface RellenoItem {
  name: string;
  clase: number; // 1 = Blando, 2 = Duro, 3 = Sin relleno
  tipo: string;
  rmr76: number;      // Espesor < 5mm
  rmr89: number;      // Espesor < 5mm
  rmr76_gt5: number;  // Espesor >= 5mm
  rmr89_gt5: number;  // Espesor >= 5mm
}

// Normalización estricta de claves en minúsculas para compatibilidad absoluta con Excel
export const RELLENO_CATALOG: Record<string, RellenoItem> = {
  "-1": { name: "Sin relleno (-1)", clase: 3, tipo: "Sin relleno", rmr76: 5, rmr89: 6, rmr76_gt5: 5, rmr89_gt5: 6 },
  cwf: { name: "Limpio sin relleno (cwf)", clase: 3, tipo: "Sin relleno", rmr76: 5, rmr89: 6, rmr76_gt5: 5, rmr89_gt5: 6 },
  si: { name: "Sílice (si)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 3, rmr89_gt5: 2 },
  sf: { name: "Sulfuros (sf)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 3, rmr89_gt5: 2 },
  ep: { name: "Epidota (ep)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 3, rmr89_gt5: 2 },
  ox: { name: "Óxidos (ox)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 3, rmr89_gt5: 2 },
  qz: { name: "Cuarzo (qz)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 3, rmr89_gt5: 2 },
  g: { name: "Panizo (g)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  cl: { name: "Arcilla (cl)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  ca: { name: "Calcita (ca)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  ys: { name: "Yeso (ys)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  ch: { name: "Clorita (ch)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 }
};

export const ALTERACION_CATALOG: Record<string, { name: string; r76: number; r89: number }> = {
  f: { name: "f — Fresca", r76: 5, r89: 6 },
  d: { name: "d — Débilmente meteorizada", r76: 5, r89: 5 },
  m: { name: "m — Moderadamente meteorizada", r76: 4, r89: 3 },
  a: { name: "a — Altamente meteorizada", r76: 3, r89: 3 },
  c: { name: "c — Completamente meteorizada", r76: 2, r89: 2 },
  s: { name: "s — Suelo residual", r76: 1, r89: 1 }
};

export const FORMA_CATALOG: Record<string, string> = {
  P: "Plana (P)",
  C: "Curva (C)",
  O: "Ondulada (O)",
  E: "Escalonada (E)",
  I: "Irregular (I)"
};

// Rugosidad corregida según la tabla Bieniawski / SRK de tu leyenda
export const RUGOSIDAD_CATALOG: Record<number, { desc: string; r76: number; r89: number }> = {
  1: { desc: "1 — Muy rugosa (Escalón/Irreg)", r76: 5, r89: 6 },
  2: { desc: "2 — Rugosa (Ondulada)", r76: 4, r89: 5 },
  3: { desc: "3 — Lig. Rugosa (Ondulada)", r76: 4, r89: 5 },
  4: { desc: "4 — Plana Rugosa", r76: 2, r89: 3 },
  5: { desc: "5 — Plana Lig. Rugosa", r76: 2, r89: 3 },
  6: { desc: "6 — Plana Lisa", r76: 0, r89: 1 },
  7: { desc: "7 — Ondulada Pulida", r76: 0, r89: 1 },
  8: { desc: "8 — Plana Pulida / Espejo", r76: 0, r89: 0 },
  9: { desc: "9 — Cizallada / Arcillosa", r76: 0, r89: 0 }
};

export interface LithologyClassificationItem {
  grupo: string;
  unidad: string;
  litologia: string;
  codigo: string;
  k: number; // Factor de correlación para estimación de resistencia PLT (2023)
}

// Catálogo litológico enriquecido con los factores K de tus tablas
export const LITHOLOGY_CLASSIFICATION: LithologyClassificationItem[] = [
  // INTRUSIVOS (lito1=MZB, MBF1, MBF2, MZM, MZH, MZD, MZQ, AN)
  { grupo: "INTRUSIVOS", unidad: "MZB", litologia: "MZB", codigo: "MZB_EQ", k: 8.29 },
  { grupo: "INTRUSIVOS", unidad: "MZB", litologia: "MZB", codigo: "MZB_P", k: 8.53 },
  { grupo: "INTRUSIVOS", unidad: "MZB", litologia: "MZB", codigo: "NR", k: 9.31 },

  { grupo: "INTRUSIVOS", unidad: "MBF1", litologia: "MBF", codigo: "MBF1", k: 9.20 },
  { grupo: "INTRUSIVOS", unidad: "MBF1", litologia: "MBF", codigo: "NR", k: 9.31 },

  { grupo: "INTRUSIVOS", unidad: "MBF2", litologia: "MBF", codigo: "MBF2", k: 10.73 },
  { grupo: "INTRUSIVOS", unidad: "MBF2", litologia: "MBF", codigo: "MBF_P", k: 9.31 },
  { grupo: "INTRUSIVOS", unidad: "MBF2", litologia: "MBF", codigo: "NR", k: 9.31 },

  { grupo: "INTRUSIVOS", unidad: "MZM", litologia: "MZM", codigo: "MZM_F", k: 9.31 },
  { grupo: "INTRUSIVOS", unidad: "MZM", litologia: "MZM", codigo: "MZM_M", k: 8.61 },
  { grupo: "INTRUSIVOS", unidad: "MZM", litologia: "MZM", codigo: "NR", k: 9.31 },

  { grupo: "INTRUSIVOS", unidad: "MZH", litologia: "MZH", codigo: "MZH_1", k: 11.62 },
  { grupo: "INTRUSIVOS", unidad: "MZH", litologia: "MZH", codigo: "MZH_2", k: 9.31 },
  { grupo: "INTRUSIVOS", unidad: "MZH", litologia: "MZH", codigo: "NR", k: 9.31 },

  { grupo: "INTRUSIVOS", unidad: "MZD", litologia: "MZD", codigo: "MZD", k: 7.60 },
  { grupo: "INTRUSIVOS", unidad: "MZQ", litologia: "MZQ", codigo: "MZQ", k: 12.29 },
  { grupo: "INTRUSIVOS", unidad: "AN", litologia: "AN", codigo: "LAM", k: 9.31 },

  // SEDIMENTARIOS (lito1=LMT, SHL, SND, OVD)
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "LMT", codigo: "LMT", k: 14.84 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "LMT", codigo: "LMT_M", k: 14.74 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "LMT", codigo: "LMT_MG", k: 14.25 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "LMT", codigo: "LMT_S", k: 14.84 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "LMT", codigo: "LMT_C", k: 16.83 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "LMT", codigo: "LMT_U", k: 14.84 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "LMT", codigo: "NR", k: 14.84 },

  { grupo: "SEDIMENTARIOS", unidad: "SHL", litologia: "HFL", codigo: "SHL_MA", k: 14.84 },
  { grupo: "SEDIMENTARIOS", unidad: "SHL", litologia: "HFL", codigo: "-", k: 12.63 },
  { grupo: "SEDIMENTARIOS", unidad: "SND", litologia: "QZT", codigo: "-", k: 12.63 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "OVD", codigo: "OVD", k: 14.84 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "OVD", codigo: "-", k: 14.84 },

  // BRECHAS (lito1=TBX, HBX, MBX / varios)
  { grupo: "BRECHAS", unidad: "TBX", litologia: "TBX", codigo: "TBX", k: 13.72 },
  { grupo: "BRECHAS", unidad: "HBX", litologia: "HBX", codigo: "HBX", k: 11.41 },
  { grupo: "BRECHAS", unidad: "MBX / varios", litologia: "MBX", codigo: "MBX", k: 11.41 },

  // ENDOSKARN (lito1=Intrusivo)
  { grupo: "ENDOSKARN", unidad: "Intrusivo", litologia: "EPG", codigo: "MZB_EQ", k: 9.87 },
  { grupo: "ENDOSKARN", unidad: "Intrusivo", litologia: "EPG", codigo: "MZM_M", k: 9.87 },
  { grupo: "ENDOSKARN", unidad: "Intrusivo", litologia: "EPG", codigo: "MZD", k: 9.87 },
  { grupo: "ENDOSKARN", unidad: "Intrusivo", litologia: "EPG", codigo: "-", k: 9.87 },
  { grupo: "ENDOSKARN", unidad: "Intrusivo", litologia: "EGT", codigo: "MZM_M", k: 9.87 },
  { grupo: "ENDOSKARN", unidad: "Intrusivo", litologia: "EGT", codigo: "MZB_EQ", k: 9.87 },
  { grupo: "ENDOSKARN", unidad: "Intrusivo", litologia: "EGT", codigo: "-", k: 9.87 },

  // METAMORFICAS (lito1=LMT)
  // GSK
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "GSK", codigo: "LMT_M", k: 11.15 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "GSK", codigo: "LMT_C", k: 11.15 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "GSK", codigo: "LMT_S", k: 11.15 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "GSK", codigo: "LMT_U", k: 11.15 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "GSK", codigo: "LMT_MG", k: 11.15 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "GSK", codigo: "Varios", k: 11.15 },
  // PSK
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "PSK", codigo: "LMT_MG", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "PSK", codigo: "LMT_C", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "PSK", codigo: "LMT_S", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "PSK", codigo: "LMT_U", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "PSK", codigo: "LMT_M", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "PSK", codigo: "Varios", k: 12.63 },
  // MSK
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MSK", codigo: "LMT_MG", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MSK", codigo: "LMT_S", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MSK", codigo: "Varios", k: 12.63 },
  // ESK
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "ESK", codigo: "LMT_M", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "ESK", codigo: "LMT_MG", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "ESK", codigo: "LMT_C", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "ESK", codigo: "LMT_S", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "ESK", codigo: "Varios", k: 12.63 },
  // MBC
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MBC", codigo: "LMT_M", k: 11.78 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MBC", codigo: "LMT_MG", k: 11.78 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MBC", codigo: "LMT_S", k: 11.78 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MBC", codigo: "Varios", k: 11.78 },
  // MBL
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MBL", codigo: "LMT_MG", k: 13.34 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MBL", codigo: "LMT_S", k: 13.34 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MBL", codigo: "LMT_M", k: 13.34 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MBL", codigo: "LMT_C", k: 13.34 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MBL", codigo: "Varios", k: 13.34 }
];

export interface ResolvedKResult {
  k: number;
  lito1: string;
  lito2: string;
  lito3: string;
  clase: string;
}

const EQUIVALENCIAS_MIGRACION: Record<string, { lito1: string, lito2: string, lito3: string, k: number }> = {
  TBX: { lito1: "TBX", lito2: "TBX", lito3: "TBX", k: 13.72 },
  LMT_C: { lito1: "LMT", lito2: "LMT", lito3: "LMT_C", k: 16.83 },
  SKARN: { lito1: "LMT", lito2: "GSK", lito3: "Varios", k: 11.15 },
  LMT_M: { lito1: "LMT", lito2: "LMT", lito3: "LMT_M", k: 14.74 },
  LMT_S2: { lito1: "LMT", lito2: "LMT", lito3: "LMT_S", k: 14.84 },
  LMT_S3: { lito1: "LMT", lito2: "LMT", lito3: "LMT_S", k: 14.84 },
  LMT_S4: { lito1: "LMT", lito2: "LMT", lito3: "LMT_S", k: 14.30 },
  LMT_MG: { lito1: "LMT", lito2: "LMT", lito3: "LMT_MG", k: 14.25 },
  MBC: { lito1: "LMT", lito2: "MBC", lito3: "Varios", k: 11.78 },
  MZQ: { lito1: "MZQ", lito2: "MZQ", lito3: "MZQ", k: 12.29 },
  MZB_P: { lito1: "MZB", lito2: "MZB", lito3: "MZB_P", k: 8.53 }
};

export function resolveLithologyCascade(
  l1: string,
  l2: string | null | undefined,
  l3: string | null | undefined,
  model2022?: string | null,
  fallbackLito1?: string
): ResolvedKResult {
  const cleanL1 = String(l1 || "").trim().toUpperCase();
  const cleanL2 = String(l2 || "").trim().toUpperCase();
  let cleanL3 = String(l3 || "").trim().toUpperCase();
  if (!cleanL3 || cleanL3 === "-") cleanL3 = "NR";

  // 1. PRIORIDAD 1: Flujo Histórico/Transición si la columna del Modelo 2022 tiene datos
  const m2022 = String(model2022 || "").trim().toUpperCase();
  if (m2022) {
    if (m2022 === "ENDO") {
      const targetL2 = (cleanL1 === "EPG" || cleanL2 === "EPG") ? "EPG" : "EGT";
      return { k: 9.87, lito1: "Intrusivo", lito2: targetL2, lito3: "-", clase: "ENDOSKARN" };
    }
    const equiv = EQUIVALENCIAS_MIGRACION[m2022];
    if (equiv) {
      const exactMatch = LITHOLOGY_CLASSIFICATION.find(item => item.unidad.toUpperCase() === equiv.lito1.toUpperCase() && item.litologia.toUpperCase() === equiv.lito2.toUpperCase() && item.codigo.toUpperCase() === equiv.lito3.toUpperCase());
      return {
        k: equiv.k,
        lito1: equiv.lito1,
        lito2: equiv.lito2,
        lito3: equiv.lito3,
        clase: exactMatch ? exactMatch.grupo : "SEDIMENTARIOS"
      };
    } else {
      // Regla de Paso Directo (Pass-Through)
      const lookupK = lookupPltKOnly(m2022, "NR") || 10.0;
      const exactMatch = LITHOLOGY_CLASSIFICATION.find(item => item.litologia.toUpperCase() === m2022 && item.codigo.toUpperCase() === "NR");
      return {
        k: lookupK,
        lito1: cleanL1 || fallbackLito1 || "LMT",
        lito2: m2022,
        lito3: "NR",
        clase: exactMatch ? exactMatch.grupo : "SEDIMENTARIOS"
      };
    }
  }

  // 2. PRIORIDAD 2: Flujo de Datos Nuevos (Moderno 2023+ / Web)
  const finalL2 = cleanL2;
  const finalL3 = cleanL3;

  const foundK = lookupPltKOnly(finalL2, finalL3);
  const exactMatch = LITHOLOGY_CLASSIFICATION.find(item => item.litologia.toUpperCase() === finalL2 && item.codigo.toUpperCase() === finalL3)
    || LITHOLOGY_CLASSIFICATION.find(item => item.litologia.toUpperCase() === finalL2 && item.codigo.toUpperCase() === "VARIOS")
    || LITHOLOGY_CLASSIFICATION.find(item => item.litologia.toUpperCase() === finalL2 && item.codigo.toUpperCase() === "NR");

  return {
    k: foundK !== null ? foundK : 10.0,
    lito1: l1,
    lito2: l2 || "",
    lito3: l3 || "",
    clase: exactMatch ? exactMatch.grupo : "INTRUSIVOS"
  };
}

export function lookupPltKOnly(lito2: string, lito3: string): number | null {
  const l2 = String(lito2 || "").trim().toUpperCase();
  const l3 = String(lito3 || "").trim().toUpperCase();
  const normL3 = (l3 === "-" || l3 === "NR" || !l3) ? "NR" : l3;

  // Exacto (con normalización de - y NR)
  const exact = LITHOLOGY_CLASSIFICATION.find(item => {
    const itemL3 = item.codigo.toUpperCase();
    const normItemL3 = (itemL3 === "-" || itemL3 === "NR" || !itemL3) ? "NR" : itemL3;
    return item.litologia.toUpperCase() === l2 && normItemL3 === normL3;
  });
  if (exact) return exact.k;

  // Varios
  const varios = LITHOLOGY_CLASSIFICATION.find(item => item.litologia.toUpperCase() === l2 && item.codigo.toUpperCase() === "VARIOS");
  if (varios) return varios.k;

  // NR / - fallback
  const nr = LITHOLOGY_CLASSIFICATION.find(item => {
    const itemL3 = item.codigo.toUpperCase();
    return item.litologia.toUpperCase() === l2 && (itemL3 === "NR" || itemL3 === "-" || !itemL3);
  });
  if (nr) return nr.k;

  return null;
}

export interface LitoColoresItem {
  lito1: string;
  lito2: string;
  lito3: string;
  k: number;
}

export interface LitoValidacionItem {
  grupo: string;
  lito2: string;
  lito3: string;
  validacion: string;
  k: number;
}

export const LITO_COLORES_DATA: LitoColoresItem[] = [
  { lito1: "MZB", lito2: "MZB", lito3: "MZB_EQ", k: 8.29 },
  { lito1: "MZB", lito2: "MZB", lito3: "MZB_P", k: 8.53 },
  { lito1: "MBF1", lito2: "MBF", lito3: "MBF1", k: 9.20 },
  { lito1: "MBF2", lito2: "MBF", lito3: "MBF2", k: 10.73 },
  { lito1: "MBF2", lito2: "MBF", lito3: "MBF_P", k: 9.31 },
  { lito1: "MZM", lito2: "MZM", lito3: "MZM_F", k: 9.31 },
  { lito1: "MZM", lito2: "MZM", lito3: "MZM_M", k: 8.61 },
  { lito1: "MZH", lito2: "MZH", lito3: "MZH_1", k: 11.62 },
  { lito1: "MZH", lito2: "MZH", lito3: "MZH_2", k: 9.31 },
  { lito1: "MZD", lito2: "MZD", lito3: "MZD", k: 7.60 },
  { lito1: "MZQ", lito2: "MZQ", lito3: "MZQ", k: 12.29 },
  { lito1: "AN", lito2: "AN", lito3: "LAM", k: 9.31 },
  { lito1: "LMT", lito2: "LMT", lito3: "LMT_M", k: 14.74 },
  { lito1: "LMT", lito2: "LMT", lito3: "LMT_Mg", k: 14.25 },
  { lito1: "LMT", lito2: "LMT", lito3: "LMT_S", k: 14.84 },
  { lito1: "LMT", lito2: "LMT", lito3: "LMT_C", k: 16.83 },
  { lito1: "LMT", lito2: "LMT", lito3: "LMT_U", k: 14.84 },
  { lito1: "SHL", lito2: "HFL", lito3: "SHL_MA", k: 14.84 },
  { lito1: "LMT", lito2: "GSK", lito3: "Varios", k: 11.15 },
  { lito1: "LMT", lito2: "PSK", lito3: "Varios", k: 12.63 },
  { lito1: "LMT", lito2: "MSK", lito3: "Varios", k: 12.63 },
  { lito1: "LMT", lito2: "ESK", lito3: "Varios", k: 12.63 },
  { lito1: "LMT", lito2: "MBC", lito3: "Varios", k: 11.78 },
  { lito1: "LMT", lito2: "MBL", lito3: "Varios", k: 13.34 },
  { lito1: "SHL", lito2: "HFL", lito3: "-", k: 12.63 },
  { lito1: "SND", lito2: "QZT", lito3: "-", k: 12.63 },
  { lito1: "TBX", lito2: "TBX", lito3: "TBX", k: 13.72 },
  { lito1: "HBX", lito2: "HBX", lito3: "HBX", k: 11.41 },
  { lito1: "MBX / varios", lito2: "MBX", lito3: "MBX", k: 11.41 },
  { lito1: "Intrusivo", lito2: "EPG", lito3: "-", k: 9.87 },
  { lito1: "Intrusivo", lito2: "EGT", lito3: "-", k: 9.87 }
];

export const LITO_VALIDACION_DATA: LitoValidacionItem[] = [
  { grupo: "INTRUSIVOS", lito2: "MZB", lito3: "MZB_EQ", validacion: "MZB/MZB_EQ", k: 8.29 },
  { grupo: "INTRUSIVOS", lito2: "MZB", lito3: "MZB_P", validacion: "MZB/MZB_P", k: 8.53 },
  { grupo: "INTRUSIVOS", lito2: "MBF", lito3: "MBF1", validacion: "MBF/MBF1", k: 9.20 },
  { grupo: "INTRUSIVOS", lito2: "MBF", lito3: "MBF2", validacion: "MBF/MBF2", k: 10.73 },
  { grupo: "INTRUSIVOS", lito2: "MBF", lito3: "MBF_P", validacion: "MBF/MBF_P", k: 9.31 },
  { grupo: "INTRUSIVOS", lito2: "MZM", lito3: "MZM_F", validacion: "MZM/MZM_F", k: 9.31 },
  { grupo: "INTRUSIVOS", lito2: "MZM", lito3: "MZM_M", validacion: "MZM/MZM_M", k: 8.61 },
  { grupo: "INTRUSIVOS", lito2: "MZH", lito3: "MZH_1", validacion: "MZH/MZH_1", k: 11.62 },
  { grupo: "INTRUSIVOS", lito2: "MZH", lito3: "MZH_2", validacion: "MZH/MZH_2", k: 9.31 },
  { grupo: "INTRUSIVOS", lito2: "MZD", lito3: "MZD", validacion: "MZD/MZD", k: 7.60 },
  { grupo: "INTRUSIVOS", lito2: "MZQ", lito3: "MZQ", validacion: "MZQ/MZQ", k: 12.29 },
  { grupo: "INTRUSIVOS", lito2: "MBF", lito3: "NR", validacion: "MBF/NR", k: 9.31 },
  { grupo: "INTRUSIVOS", lito2: "MZM", lito3: "NR", validacion: "MZM/NR", k: 9.31 },
  { grupo: "INTRUSIVOS", lito2: "MZB", lito3: "NR", validacion: "MZB/NR", k: 9.31 },
  { grupo: "INTRUSIVOS", lito2: "MZH", lito3: "NR", validacion: "MZH/NR", k: 9.31 },
  { grupo: "ENDOSKARN", lito2: "EGT", lito3: "MZM_M", validacion: "EGT/MZM_M", k: 9.87 },
  { grupo: "ENDOSKARN", lito2: "EGT", lito3: "MZB_EQ", validacion: "EGT/MZB_EQ", k: 9.87 },
  { grupo: "ENDOSKARN", lito2: "EGT", lito3: "-", validacion: "EGT/-", k: 9.87 },
  { grupo: "ENDOSKARN", lito2: "EPG", lito3: "MZB_EQ", validacion: "EPG/MZB_EQ", k: 9.87 },
  { grupo: "ENDOSKARN", lito2: "EPG", lito3: "MZM_M", validacion: "EPG/MZM_M", k: 9.87 },
  { grupo: "ENDOSKARN", lito2: "EPG", lito3: "MZD", validacion: "EPG/MZD", k: 9.87 },
  { grupo: "ENDOSKARN", lito2: "EPG", lito3: "-", validacion: "EPG/-", k: 9.87 },
  { grupo: "BRECHAS", lito2: "TBX", lito3: "TBX", validacion: "TBX/TBX", k: 13.72 },
  { grupo: "BRECHAS", lito2: "BX", lito3: "TBX", validacion: "BX/TBX", k: 13.72 },
  { grupo: "BRECHAS", lito2: "HBX", lito3: "HBX", validacion: "HBX/HBX", k: 11.41 },
  { grupo: "BRECHAS", lito2: "MBX", lito3: "MBX", validacion: "MBX/MBX", k: 11.41 },
  { grupo: "SEDIMENTARIAS", lito2: "LMT", lito3: "LMT", validacion: "LMT/LMT", k: 14.84 },
  { grupo: "SEDIMENTARIAS", lito2: "LMT", lito3: "NR", validacion: "LMT/NR", k: 14.84 },
  { grupo: "SEDIMENTARIAS", lito2: "LMT", lito3: "LMT_M", validacion: "LMT/LMT_M", k: 14.74 },
  { grupo: "SEDIMENTARIAS", lito2: "LMT", lito3: "LMT_MG", validacion: "LMT/LMT_MG", k: 14.25 },
  { grupo: "SEDIMENTARIAS", lito2: "LMT", lito3: "LMT_S", validacion: "LMT/LMT_S", k: 14.84 },
  { grupo: "SEDIMENTARIAS", lito2: "LMT", lito3: "LMT_C", validacion: "LMT/LMT_C", k: 16.83 },
  { grupo: "SEDIMENTARIAS", lito2: "HFL", lito3: "SHL_MA", validacion: "HFL/SHL_MA", k: 14.84 },
  { grupo: "SEDIMENTARIAS", lito2: "OVD", lito3: "OVD", validacion: "OVD/OVD", k: 14.84 },
  { grupo: "SEDIMENTARIAS", lito2: "OVD", lito3: "-", validacion: "OVD/-", k: 14.84 },
  { grupo: "METAMORFICAS", lito2: "GSK", lito3: "LMT_M", validacion: "GSK/LMT_M", k: 11.15 },
  { grupo: "METAMORFICAS", lito2: "GSK", lito3: "LMT_C", validacion: "GSK/LMT_C", k: 11.15 },
  { grupo: "METAMORFICAS", lito2: "GSK", lito3: "LMT_S", validacion: "GSK/LMT_S", k: 11.15 },
  { grupo: "METAMORFICAS", lito2: "GSK", lito3: "LMT_U", validacion: "GSK/LMT_U", k: 11.15 },
  { grupo: "METAMORFICAS", lito2: "GSK", lito3: "Varios", validacion: "GSK/Varios", k: 11.15 },
  { grupo: "METAMORFICAS", lito2: "PSK", lito3: "LMT_MG", validacion: "PSK/LMT_MG", k: 12.63 },
  { grupo: "METAMORFICAS", lito2: "PSK", lito3: "LMT_C", validacion: "PSK/LMT_C", k: 12.63 },
  { grupo: "METAMORFICAS", lito2: "PSK", lito3: "LMT_S", validacion: "PSK/LMT_S", k: 12.63 },
  { grupo: "METAMORFICAS", lito2: "PSK", lito3: "LMT_U", validacion: "PSK/LMT_U", k: 12.63 },
  { grupo: "METAMORFICAS", lito2: "MSK", lito3: "LMT_MG", validacion: "MSK/LMT_MG", k: 12.63 },
  { grupo: "METAMORFICAS", lito2: "MSK", lito3: "LMT_S", validacion: "MSK/LMT_S", k: 12.63 },
  { grupo: "METAMORFICAS", lito2: "ESK", lito3: "LMT_M", validacion: "ESK/LMT_M", k: 12.63 },
  { grupo: "METAMORFICAS", lito2: "ESK", lito3: "LMT_MG", validacion: "ESK/LMT_MG", k: 12.63 },
  { grupo: "METAMORFICAS", lito2: "ESK", lito3: "LMT_C", validacion: "ESK/LMT_C", k: 12.63 },
  { grupo: "METAMORFICAS", lito2: "ESK", lito3: "LMT_S", validacion: "ESK/LMT_S", k: 12.63 },
  { grupo: "METAMORFICAS", lito2: "ESK", lito3: "Varios", validacion: "ESK/Varios", k: 12.63 },
  { grupo: "METAMORFICAS", lito2: "MBC", lito3: "LMT_M", validacion: "MBC/LMT_M", k: 11.78 },
  { grupo: "METAMORFICAS", lito2: "MBC", lito3: "LMT_MG", validacion: "MBC/LMT_MG", k: 11.78 },
  { grupo: "METAMORFICAS", lito2: "MBC", lito3: "LMT_S", validacion: "MBC/LMT_S", k: 11.78 },
  { grupo: "METAMORFICAS", lito2: "MBC", lito3: "Varios", validacion: "MBC/Varios", k: 11.78 },
  { grupo: "METAMORFICAS", lito2: "MBL", lito3: "LMT_MG", validacion: "MBL/LMT_MG", k: 13.34 },
  { grupo: "METAMORFICAS", lito2: "MBL", lito3: "LMT_S", validacion: "MBL/LMT_S", k: 13.34 },
  { grupo: "METAMORFICAS", lito2: "MBL", lito3: "LMT_M", validacion: "MBL/LMT_M", k: 13.34 },
  { grupo: "METAMORFICAS", lito2: "MBL", lito3: "LMT_C", validacion: "MBL/LMT_C", k: 13.34 },
  { grupo: "METAMORFICAS", lito2: "MBL", lito3: "Varios", validacion: "MBL/Varios", k: 13.34 }
];