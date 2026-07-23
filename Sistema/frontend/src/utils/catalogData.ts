export let LITHOLOGY_CLASSIFICATION: any[] = [];
export let GROUNDWATER_CATALOG: Record<string, any> = {};
export let STRENGTH_CATALOG: Record<string, any> = {};
export let STRUCTURE_CATALOG: Record<string, string> = {
  JN: "Junta (JS)", BED: "Estratos (BED)", F: "Falla (F)",
  SZ: "Zona de Cizalla (SZ)", CON: "Contacto (CON)", DQ: "Dique (DQ)"
};
export let RELLENO_CATALOG: Record<string, any> = {
  "-1": { name: "Sin información (-1)", clase: 3, tipo: "Sin relleno", rmr76: 5, rmr89: 6, rmr76_gt5: 5, rmr89_gt5: 6 },
  c: { name: "Limpio sin relleno (c)", clase: 3, tipo: "Sin relleno", rmr76: 5, rmr89: 6, rmr76_gt5: 5, rmr89_gt5: 6 },
  cwf: { name: "Limpio sin relleno (c)", clase: 3, tipo: "Sin relleno", rmr76: 5, rmr89: 6, rmr76_gt5: 5, rmr89_gt5: 6 },
  si: { name: "Sílice (si)", clase: 1, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 3, rmr89_gt5: 2 },
  sf: { name: "Sulfuros (sf)", clase: 1, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 3, rmr89_gt5: 2 },
  ep: { name: "Epidota (ep)", clase: 1, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 3, rmr89_gt5: 2 },
  ox: { name: "Óxidos (ox)", clase: 1, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 3, rmr89_gt5: 2 },
  qz: { name: "Cuarzo (qz)", clase: 1, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 3, rmr89_gt5: 2 },
  g: { name: "Panizo (Roca Triturada) (g)", clase: 2, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  cl: { name: "Arcilla (cl)", clase: 2, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  ca: { name: "Calcita (ca)", clase: 2, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  ys: { name: "Yeso (ys)", clase: 2, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  ch: { name: "Clorita (ch)", clase: 2, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  sa: { name: "Arena (sa)", clase: 2, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
};
export let ALTERACION_CATALOG: Record<string, any> = {
  f: { name: "f — Fresca", r76: 5, r89: 6 },
  d: { name: "d — Débilmente meteorizada", r76: 5, r89: 5 },
  m: { name: "m — Moderadamente meteorizada", r76: 4, r89: 3 },
  a: { name: "a — Altamente meteorizada", r76: 3, r89: 3 },
  c: { name: "c — Completamente meteorizada", r76: 2, r89: 2 },
  s: { name: "s — Suelo residual", r76: 1, r89: 1 },
};
export let RUGOSIDAD_CATALOG: Record<number, any> = {};
export let FORMA_CATALOG: Record<string, string> = {
  P: "Plana (P)", C: "Curva (C)", O: "Ondulada (O)", E: "Escalonada (E)", I: "Irregular (I)"
};

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

  // Detectar orden desplazado para Metamórficas o Endoskarn
  const metamorficasEndoskarnRocks = new Set(["GSK", "PSK", "MSK", "ESK", "MBC", "MBL", "EPG", "EGT"]);
  const isShifted = metamorficasEndoskarnRocks.has(cleanL1);

  let finalL2 = cleanL2;
  let finalL3 = cleanL3;

  if (isShifted) {
    finalL2 = cleanL1;
    finalL3 = cleanL2;
  } else {
    if (cleanL3.includes("/")) {
      finalL3 = cleanL3.split("/").pop()?.trim() || cleanL3;
    }
  }

  const foundK = lookupPltKOnly(finalL2, finalL3);
  
  const exactMatch = LITHOLOGY_CLASSIFICATION.find(item => {
    const itemL2 = item.litologia.toUpperCase();
    const itemL3 = item.codigo.toUpperCase();
    const normItemL3 = (itemL3 === "-" || itemL3 === "NR" || !itemL3) ? "NR" : itemL3;
    const searchL3 = (finalL3 === "-" || finalL3 === "NR" || !finalL3) ? "NR" : finalL3;
    return itemL2 === finalL2 && normItemL3 === searchL3;
  }) || LITHOLOGY_CLASSIFICATION.find(item => {
    return item.litologia.toUpperCase() === finalL2 && item.codigo.toUpperCase() === "VARIOS";
  }) || LITHOLOGY_CLASSIFICATION.find(item => {
    return item.litologia.toUpperCase() === finalL2 && (item.codigo.toUpperCase() === "NR" || item.codigo.toUpperCase() === "-");
  });

  return {
    k: foundK !== null ? foundK : 10.0,
    lito1: exactMatch?.grupo === "ENDOSKARN" ? "Intrusivo" : (isShifted ? (exactMatch ? exactMatch.unidad : "LMT") : l1),
    lito2: isShifted ? cleanL1 : (l2 || ""),
    lito3: isShifted ? cleanL2 : (l3 || ""),
    clase: exactMatch ? exactMatch.grupo : (isShifted ? "METAMORFICAS" : "INTRUSIVOS")
  };
}

export function lookupPltKOnly(lito2: string, lito3: string): number | null {
  const l2 = String(lito2 || "").trim().toUpperCase();
  const l3 = String(lito3 || "").trim().toUpperCase();
  const normL3 = (l3 === "-" || l3 === "NR" || !l3) ? "NR" : l3;

  const exact = LITHOLOGY_CLASSIFICATION.find(item => {
    const itemL3 = item.codigo.toUpperCase();
    const normItemL3 = (itemL3 === "-" || itemL3 === "NR" || !itemL3) ? "NR" : itemL3;
    return item.litologia.toUpperCase() === l2 && normItemL3 === normL3;
  });
  if (exact) return exact.k;

  const varios = LITHOLOGY_CLASSIFICATION.find(item => item.litologia.toUpperCase() === l2 && item.codigo.toUpperCase() === "VARIOS");
  if (varios) return varios.k;

  const nr = LITHOLOGY_CLASSIFICATION.find(item => {
    const itemL3 = item.codigo.toUpperCase();
    return item.litologia.toUpperCase() === l2 && (itemL3 === "NR" || itemL3 === "-" || !itemL3);
  });
  if (nr) return nr.k;

  return null;
}

export function initCatalogs(data: any) {
  // 1. Litologías
  LITHOLOGY_CLASSIFICATION.length = 0;
  data.lithology_full.forEach((item: any) => {
    LITHOLOGY_CLASSIFICATION.push({
      grupo: item.grupo,
      unidad: item.lito1,
      litologia: item.lito2,
      codigo: item.lito3,
      k: item.k
    });
  });

  // 2. Agua
  for (const k in GROUNDWATER_CATALOG) delete GROUNDWATER_CATALOG[k];
  data.agua.forEach((item: any) => {
    GROUNDWATER_CATALOG[item.codigo] = {
      desc: `${item.desc} (${item.codigo})`,
      rmr76: item.r76,
      rmr89: item.r89
    };
  });

  // 3. Resistencia
  for (const k in STRENGTH_CATALOG) delete STRENGTH_CATALOG[k];
  data.resistencia.forEach((item: any) => {
    STRENGTH_CATALOG[item.codigo] = {
      desc: `${item.codigo} — ${item.denom} (${item.rango} MPa)`,
      score: item.r76
    };
  });

  // 4. Estructura
  for (const k in STRUCTURE_CATALOG) delete STRUCTURE_CATALOG[k];
  data.estructura.forEach((item: any) => {
    STRUCTURE_CATALOG[item.codigo] = item.nombre;
  });

  // 5. Relleno
  for (const k in RELLENO_CATALOG) delete RELLENO_CATALOG[k];
  data.relleno.forEach((item: any) => {
    const claseVal = item.tipo === "Blando" ? 1 : (item.tipo === "Duro" ? 2 : 3);
    RELLENO_CATALOG[item.codigo] = {
      name: `${item.nombre} (${item.codigo})`,
      clase: claseVal,
      tipo: item.tipo,
      rmr76: item.r76_lt5,
      rmr89: item.r89_lt5,
      rmr76_gt5: item.r76_gte5,
      rmr89_gt5: item.r89_gte5
    };
  });

  // 6. Alteración
  for (const k in ALTERACION_CATALOG) delete ALTERACION_CATALOG[k];
  data.alteracion.forEach((item: any) => {
    ALTERACION_CATALOG[item.codigo] = {
      name: `${item.codigo} — ${item.nombre}`,
      r76: item.r76,
      r89: item.r89
    };
  });

  // 7. Rugosidad
  for (const k in RUGOSIDAD_CATALOG) delete RUGOSIDAD_CATALOG[k];
  data.rugosidad.forEach((item: any) => {
    RUGOSIDAD_CATALOG[item.clase] = {
      desc: item.desc,
      r76: item.r76,
      r89: item.r89
    };
  });

  // 8. Forma
  for (const k in FORMA_CATALOG) delete FORMA_CATALOG[k];
  data.forma.forEach((item: any) => {
    FORMA_CATALOG[item.codigo] = `${item.desc} (${item.codigo})`;
  });
}