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
  J: "Junta (J)",
  BED: "Estratos (BED)",
  F: "Falla (F)",
  SZ: "Zona de Cizalla (SZ)",
  CON: "Contacto (CON)"
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
  ca: { name: "Calcita (ca)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  sand: { name: "Arena (sand)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  ch: { name: "Clorita (ch)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  cl: { name: "Arcilla (cl)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  gy: { name: "Yeso (gy)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  rxf: { name: "Roca triturada (rxf)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  fbx: { name: "Brecha de falla (fbx)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  gou: { name: "Panizo (gou)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  g: { name: "Panizo (g)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  pat: { name: "Patinas (pat)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  sio: { name: "Silicatos (sio)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  si: { name: "Silicatos (si)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  qz: { name: "Cuarzo (qz)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  su: { name: "Sulfuros (su)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  sf: { name: "Sulfuros (sf)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  ox: { name: "Óxidos (ox)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  ep: { name: "Epidota (ep)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  cwf: { name: "Limpia, sin relleno (cwf)", clase: 3, tipo: "Sin relleno", rmr76: 5, rmr89: 6, rmr76_gt5: 5, rmr89_gt5: 6 }
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
  { grupo: "INTRUSIVOS", unidad: "MZB", litologia: "MZB", codigo: "MZB_EQ", k: 8.29 },
  { grupo: "INTRUSIVOS", unidad: "MZB", litologia: "MZB", codigo: "MZB_P", k: 8.53 },
  { grupo: "INTRUSIVOS", unidad: "MBF1", litologia: "MBF", codigo: "MBF1", k: 9.20 },
  { grupo: "INTRUSIVOS", unidad: "MBF2", litologia: "MBF", codigo: "MBF2", k: 10.73 },
  { grupo: "INTRUSIVOS", unidad: "MBF2", litologia: "MBF", codigo: "MBF_P", k: 9.31 },
  { grupo: "INTRUSIVOS", unidad: "MZM", litologia: "MZM", codigo: "MZM_F", k: 9.31 },
  { grupo: "INTRUSIVOS", unidad: "MZM", litologia: "MZM", codigo: "MZM_M", k: 8.61 },
  { grupo: "INTRUSIVOS", unidad: "MZH", litologia: "MZH", codigo: "MZH_1", k: 11.62 },
  { grupo: "INTRUSIVOS", unidad: "MZH", litologia: "MZH", codigo: "MZH_2", k: 9.31 },
  { grupo: "INTRUSIVOS", unidad: "MZD", litologia: "MZD", codigo: "MZD", k: 7.60 },
  { grupo: "INTRUSIVOS", unidad: "MZQ", litologia: "MZQ", codigo: "MZQ", k: 12.29 },
  { grupo: "INTRUSIVOS", unidad: "AN", litologia: "LAM", codigo: "LAM", k: 9.31 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "LMT", codigo: "LMT_M", k: 14.74 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "LMT", codigo: "LMT_Mg", k: 14.25 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "LMT", codigo: "LMT_S", k: 14.84 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "LMT", codigo: "LMT_C", k: 16.83 },
  { grupo: "SEDIMENTARIOS", unidad: "LMT", litologia: "LMT", codigo: "LMT_U", k: 14.84 },
  { grupo: "SEDIMENTARIOS", unidad: "SHL", litologia: "HFL", codigo: "SHL_MA", k: 14.84 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "GSK", codigo: "Varios", k: 11.15 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "PSK", codigo: "Varios", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MSK", codigo: "Varios", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "ESK", codigo: "Varios", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MBC", codigo: "Varios", k: 11.78 },
  { grupo: "METAMORFICAS", unidad: "LMT", litologia: "MBL", codigo: "Varios", k: 13.34 },
  { grupo: "METAMORFICAS", unidad: "SHL", litologia: "HFL", codigo: "-", k: 12.63 },
  { grupo: "METAMORFICAS", unidad: "SND", litologia: "QZT", codigo: "-", k: 12.63 },
  { grupo: "BRECHAS", unidad: "TBX", litologia: "TBX", codigo: "TBX", k: 13.72 },
  { grupo: "BRECHAS", unidad: "HBX", litologia: "HBX", codigo: "HBX", k: 11.41 },
  { grupo: "BRECHAS", unidad: "MBX / varios", litologia: "MBX", codigo: "MBX", k: 11.41 },
  { grupo: "ENDOSKARN", unidad: "Intrusivo", litologia: "EPG", codigo: "-", k: 9.87 },
  { grupo: "ENDOSKARN", unidad: "Intrusivo", litologia: "EGT", codigo: "-", k: 9.87 }
];