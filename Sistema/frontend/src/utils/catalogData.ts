export interface LithologyItem {
  name: string;
  bg: string;
  text: string;
}

export const LITHOLOGY_CATALOG: Record<string, LithologyItem> = {
  BX: { name: "Brecha", bg: "#FF0D00", text: "#FFFFFF" },
  EGT: { name: "Exoskarn granate", bg: "#C86432", text: "#FFFFFF" },
  ENDO: { name: "Endo skarn", bg: "#A020F0", text: "#FFFFFF" },
  EPG: { name: "Monzonita epidótica", bg: "#64A050", text: "#FFFFFF" },
  ESK: { name: "Exoskarn", bg: "#BADD5B", text: "#000000" },
  GD: { name: "Granodiorita", bg: "#B4B4B4", text: "#000000" },
  GSK: { name: "Garnet skarn", bg: "#D25028", text: "#FFFFFF" },
  HBX: { name: "Brecha hidrotermal", bg: "#DC5050", text: "#FFFFFF" },
  HFL: { name: "Hornfels", bg: "#A0A0A0", text: "#000000" },
  LMT: { name: "Caliza", bg: "#4E708F", text: "#FFFFFF" },
  LMT_C: { name: "Caliza Carbonosa", bg: "#354A5F", text: "#FFFFFF" },
  LMT_M: { name: "Caliza micrítica", bg: "#4E708F", text: "#FFFFFF" },
  LMT_MG: { name: "Caliza Magnésica", bg: "#8B6914", text: "#FFFFFF" },
  LMT_S1: { name: "Caliza Sucia 1", bg: "#D1C29B", text: "#000000" },
  LMT_S2: { name: "Caliza Sucia 2", bg: "#D1C29B", text: "#000000" },
  LMT_S3: { name: "Caliza Sucia 3", bg: "#D1C29B", text: "#000000" },
  LMT_S4: { name: "Caliza Sucia 4", bg: "#D1C29B", text: "#000000" },
  MARA: { name: "Caliza Mara", bg: "#5C7C99", text: "#FFFFFF" },
  MARA_BX: { name: "Brecha Mara", bg: "#F25555", text: "#FFFFFF" },
  MBC: { name: "Mármol con calcosita", bg: "#2EAEA8", text: "#FFFFFF" },
  MBF: { name: "Monzonita biotítica félsica", bg: "#FEC85A", text: "#000000" },
  MBF_1: { name: "Monzonita biotítica félsica 1", bg: "#FECE65", text: "#000000" },
  MBF_2: { name: "Monzonita biotítica félsica 2", bg: "#FDC178", text: "#000000" },
  MBF_P: { name: "Monzonita biotítica félsica p", bg: "#FFA500", text: "#000000" },
  MBL: { name: "Mármol biotítico", bg: "#66B2FF", text: "#000000" },
  MBX: { name: "Brecha mármol", bg: "#F25555", text: "#FFFFFF" },
  MSK: { name: "Magnetite skarn", bg: "#782828", text: "#FFFFFF" },
  MZB: { name: "Monzonita biotítica", bg: "#FFC896", text: "#000000" },
  MZB_EQ: { name: "Monzonita biotítica equigranular", bg: "#FEE5CE", text: "#000000" },
  MZB_P: { name: "Monzonita biotítica porfírica", bg: "#FFD8B5", text: "#000000" },
  MZD: { name: "Monzonita Diorítico", bg: "#3E9C3E", text: "#FFFFFF" },
  MZH: { name: "Monzonita hornbléndica", bg: "#FF78B4", text: "#000000" },
  MZH_1: { name: "Monzonita hornbléndica 1", bg: "#FF6294", text: "#FFFFFF" },
  MZH_2: { name: "Monzonita hornbléndica 2", bg: "#FF62F1", text: "#000000" },
  MZM: { name: "Monzonita máfica", bg: "#FED2F0", text: "#000000" },
  MZM_M: { name: "Monzonita máfica masiva", bg: "#FEDCFC", text: "#000000" },
  MZQ: { name: "Monzonita cuarzosa", bg: "#D4C848", text: "#000000" },
  NR: { name: "No recuperado", bg: "#DCDCDC", text: "#000000" },
  OVD: { name: "Óxidos y venas", bg: "#B45A00", text: "#FFFFFF" },
  PSK: { name: "Pyroxene skarn", bg: "#A0B43C", text: "#000000" },
  QT: { name: "Cuarcita", bg: "#F5F5F5", text: "#000000" },
  SKARN: { name: "Skarn", bg: "#BADD5B", text: "#000000" },
  TBX: { name: "Brecha tectónica", bg: "#FF6464", text: "#FFFFFF" }
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

export const RELLENO_CATALOG: Record<string, RellenoItem> = {
  ca: { name: "Calcita (ca)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  sand: { name: "Arena (sand)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  ch: { name: "Clorita (ch)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  cl: { name: "Arcilla (cl)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  gy: { name: "Yeso (gy)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  RXF: { name: "Roca triturada (RXF)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  FBX: { name: "Brecha de falla (FBX)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  GOU: { name: "Panizo (GOU)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  PAT: { name: "Patinas (PAT)", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  SIO: { name: "Silicatos (SIO)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  QZ: { name: "Cuarzo (QZ)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  SU: { name: "Sulfuros (SU)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  OX: { name: "Óxidos (OX)", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
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

export const RUGOSIDAD_CATALOG: Record<number, { desc: string; r76: number; r89: number }> = {
  1: { desc: "1 — Muy rugosa (Escalón/Irreg)", r76: 5, r89: 6 },
  2: { desc: "2 — Rugosa (Ondulada)", r76: 4, r89: 5 },
  3: { desc: "3 — Lig. Rugosa (Ondulada)", r76: 3, r89: 3 },
  4: { desc: "4 — Plana Rugosa", r76: 4, r89: 5 },
  5: { desc: "5 — Plana Lig. Rugosa", r76: 3, r89: 3 },
  6: { desc: "6 — Plana Lisa", r76: 1, r89: 1 },
  7: { desc: "7 — Ondulada Pulida", r76: 3, r89: 3 },
  8: { desc: "8 — Plana Pulida / Espejo", r76: 1, r89: 1 },
  9: { desc: "9 — Cizallada / Arcillosa", r76: 0, r89: 0 }
};
