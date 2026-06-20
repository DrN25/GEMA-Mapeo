import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Activity,
  BookOpen,
  Plus,
  X,
  Check,
  Trash2
} from 'lucide-react';

// ==========================================
// CATALOGS & CONFIG
// ==========================================
const CAT_TIPO_LITOLOGICO = ["Roca intrusiva", "Roca plutónica", "Roca volcánica"];
const CAT_TIPO_FRACTURA = ["M", "E", "C"];
const CAT_DIRECCION_ROTURA = ["Pa", "Pe", "NA"];

const ISRM_TABLE = [
  { indice: "R0", minUcs: 0.25, maxUcs: 1, denominacion: "Roca extremadamente débil" },
  { indice: "R1", minUcs: 1, maxUcs: 5, denominacion: "Roca muy débil" },
  { indice: "R2", minUcs: 5, maxUcs: 25, denominacion: "Roca débil" },
  { indice: "R3", minUcs: 25, maxUcs: 50, denominacion: "Roca moderadamente resistente" },
  { indice: "R4", minUcs: 50, maxUcs: 100, denominacion: "Roca resistente" },
  { indice: "R5", minUcs: 100, maxUcs: 250, denominacion: "Roca muy resistente" },
  { indice: "R6", minUcs: 250, maxUcs: Infinity, denominacion: "Roca extremadamente resistente" },
];

const LITO_CATALOG = [
  { lito1: "MZB", lito2: "MZB", lito3: "MZB_EQ", factorK: 8.29 },
  { lito1: "MZB", lito2: "MZB", lito3: "MZB_P", factorK: 8.53 },
  { lito1: "MBF1", lito2: "MBF", lito3: "MBF1", factorK: 9.2 },
  { lito1: "MBF2", lito2: "MBF", lito3: "MBF2", factorK: 10.73 },
  { lito1: "MBF2", lito2: "MBF", lito3: "MBF_P", factorK: 9.31 },
  { lito1: "MZM", lito2: "MZM", lito3: "MZM_F", factorK: 9.31 },
  { lito1: "MZM", lito2: "MZM", lito3: "MZM_M", factorK: 8.61 },
  { lito1: "MZH", lito2: "MZH", lito3: "MZH_1", factorK: 11.62 },
  { lito1: "MZH", lito2: "MZH", lito3: "MZH_2", factorK: 9.31 },
  { lito1: "MZD", lito2: "MZD", lito3: "MZD", factorK: 7.6 },
  { lito1: "MZQ", lito2: "MZQ", lito3: "MZQ", factorK: 12.29 },
  { lito1: "AN", lito2: "AN", lito3: "LAM", factorK: 9.31 },
  { lito1: "LMT", lito2: "LMT", lito3: "LMT_M", factorK: 14.74 },
  { lito1: "LMT", lito2: "LMT", lito3: "LMT_Mg", factorK: 14.25 },
  { lito1: "LMT", lito2: "LMT", lito3: "LMT_S", factorK: 14.84 },
  { lito1: "LMT", lito2: "LMT", lito3: "LMT_C", factorK: 16.83 },
  { lito1: "LMT", lito2: "LMT", lito3: "LMT_U", factorK: 14.84 },
  { lito1: "SHL", lito2: "HFL", lito3: "SHL_MA", factorK: 14.84 },
  { lito1: "LMT", lito2: "GSK", lito3: "Varios", factorK: 11.15 },
  { lito1: "LMT", lito2: "PSK", lito3: "Varios", factorK: 12.63 },
  { lito1: "LMT", lito2: "MSK", lito3: "Varios", factorK: 12.63 },
  { lito1: "LMT", lito2: "ESK", lito3: "Varios", factorK: 12.63 },
  { lito1: "LMT", lito2: "MBC", lito3: "Varios", factorK: 11.78 },
  { lito1: "LMT", lito2: "MBL", lito3: "Varios", factorK: 13.34 },
  { lito1: "SHL", lito2: "HFL", lito3: null, factorK: 12.63 },
  { lito1: "SND", lito2: "QZT", lito3: null, factorK: 12.63 },
  { lito1: "TBX", lito2: "TBX", lito3: "TBX", factorK: 13.72 },
  { lito1: "HBX", lito2: "HBX", lito3: "HBX", factorK: 11.41 },
  { lito1: "MBX", lito2: "MBX", lito3: "MBX", factorK: 11.41 },
  { lito1: "Intrusivo", lito2: "EPG", lito3: null, factorK: 9.87 },
  { lito1: "Intrusivo", lito2: "EGT", lito3: null, factorK: 9.87 },
];

function getLito2Options(l1: string) {
  if (!l1) return [];
  return Array.from(new Set(LITO_CATALOG.filter(e => e.lito1 === l1).map(e => e.lito2)));
}

function getLito3Options(l1: string, l2: string | null | undefined) {
  if (!l1 || !l2) return [];
  return LITO_CATALOG.filter(e => e.lito1 === l1 && e.lito2 === l2 && e.lito3 !== null).map(e => e.lito3 as string);
}

function getIsrmClass(ucs: number | null) {
  if (ucs === null || ucs === undefined || isNaN(ucs)) return null;
  const e = ISRM_TABLE.find(r => ucs >= r.minUcs && ucs < r.maxUcs);
  return e ? { indice: e.indice, denominacion: e.denominacion } : null;
}

export function applyPltFormulas(row: any) {
  const r = { ...row };
  const num = (v: any) => (v !== null && v !== undefined && v !== "" && !isNaN(Number(v))) ? Number(v) : null;

  const w1 = num(r.ancho_w1);
  const w2 = num(r.ancho_w2);
  r.ancho_w = (w1 !== null && w2 !== null) ? Math.round((w1 + w2) / 2 * 100) / 100 : null;

  const L = num(r.longitud_l);
  const D = num(r.espesor_d);
  const W = r.ancho_w;

  r.muestra_valida_longitud = (L !== null && D !== null) ? (L >= D ? "SÍ" : "NO") : null;
  r.muestra_valida_ancho = (D !== null && W !== null) ? (D > 0.3 * W && D < W ? "SÍ" : "NO") : null;
  r.diametro_equivalente = (D !== null && W !== null) ? Math.round(Math.sqrt(4 * D * W / Math.PI) * 100) / 100 : null;
  r.f = (r.diametro_equivalente !== null) ? Math.round(Math.pow((r.diametro_equivalente * 10) / 50, 0.45) * 10000) / 10000 : null;

  const P = num(r.fuerza_p);
  r.is_mpa = (P !== null && r.diametro_equivalente !== null && r.diametro_equivalente > 0)
    ? Math.round((P * 1000) / Math.pow(r.diametro_equivalente * 10, 2) * 10000) / 10000
    : null;
  r.is50 = (r.is_mpa !== null && r.f !== null) ? Math.round(r.is_mpa * r.f * 10000) / 10000 : null;

  const K = num(r.factor_conversion_k);
  r.ucs = (r.is50 !== null && K !== null) ? Math.round(r.is50 * K * 100) / 100 : null;

  const cls = getIsrmClass(r.ucs);
  r.resistencia_isrm = cls ? cls.indice : null;
  r.denominacion_isrm = cls ? cls.denominacion : null;

  return r;
}

export function applyLitoCascade(key: string, val: any, row: any) {
  const r = { ...row, [key]: val };
  if (key === "litologia_1") {
    r.litologia_2 = null;
    r.litologia_3 = null;
    r.factor_conversion_k = null;
  }
  if (key === "litologia_2") {
    r.litologia_3 = null;
    r.factor_conversion_k = null;
    const entries = LITO_CATALOG.filter(e => e.lito1 === r.litologia_1 && e.lito2 === String(val || ""));
    if (entries.length > 0 && entries.every(e => e.lito3 === null)) {
      r.factor_conversion_k = entries[0].factorK;
    }
  }
  if (key === "litologia_3") {
    const entry = LITO_CATALOG.find(e => e.lito1 === r.litologia_1 && e.lito2 === r.litologia_2 && e.lito3 === (val || null));
    if (entry) {
      r.factor_conversion_k = entry.factorK;
    }
  }
  return r;
}

// 🧪 ALGORITMO DE NORMALIZACIÓN INTELIGENTE DE CELDAS (Letras y Números por separado)
export function normalizeCeldaCode(celda: string): string {
  if (!celda) return "";
  const raw = celda.trim().toUpperCase();

  // Extraer secuencias continuas de letras y números
  const matches = raw.match(/[A-Z]+|[0-9]+/g);
  if (!matches) return raw;

  // Saneamiento de ceros redundantes a la izquierda
  const normalizedSegments = matches.map(segment => {
    if (/^[0-9]+$/.test(segment)) {
      const parsed = parseInt(segment, 10);
      return isNaN(parsed) ? segment : String(parsed);
    }
    return segment;
  });

  // Reconstrucción del código canónico unificado
  let result = "";
  normalizedSegments.forEach((seg, idx) => {
    if (idx === 0) {
      result += seg;
    } else {
      const prev = normalizedSegments[idx - 1];
      const isCurrentNum = /^[0-9]+$/.test(seg);
      const isPrevNum = /^[0-9]+$/.test(prev);

      if (isCurrentNum && isPrevNum) {
        result += "-" + seg;
      } else if (!isCurrentNum && isPrevNum) {
        result += "-" + seg;
      } else {
        result += seg;
      }
    }
  });

  return result;
}

const GROUP_META: Record<number, { label: string; bg: string }> = {
  1: { label: "Información General del Ensayo", bg: "rgba(26,53,96,0.5)" },
  2: { label: "Identificación de Muestra", bg: "rgba(13,58,74,0.5)" },
  3: { label: "Coordenadas WGS84", bg: "rgba(42,74,34,0.5)" },
  4: { label: "Geometría del bloque irregular", bg: "rgba(58,42,80,0.5)" },
  5: { label: "Datos del ensayo", bg: "rgba(92,26,26,0.5)" },
  6: { label: "Cálculo de índice de carga puntual", bg: "rgba(74,58,0,0.5)" },
  7: { label: "Resistencia de la roca intacta", bg: "rgba(92,26,58,0.5)" },
  8: { label: "Observaciones", bg: "rgba(42,42,42,0.5)" },
};

const COLS = [
  { key: "campana", label: "Campaña", type: "int", width: 80, group: 1, required: true, synonyms: ["campana", "campaña", "campana "] },
  { key: "fecha_ensayo", label: "Fecha de ensayo", type: "date", width: 120, group: 1, required: true, synonyms: ["fecha de ensayo", "fechaensayo", "fecha_ensayo"] },
  { key: "sector_geotecnico", label: "Sector Geotécnico", type: "text", width: 110, group: 1, synonyms: ["sector geotécnico", "sectorgeotecnico", "sector_geotecnico", "sector"] },
  { key: "ejecutado_por", label: "Ejecutado por", type: "text", width: 110, group: 1, required: true, synonyms: ["ejecutado por", "ejecutadopor", "ejecución de ensayo", "ejecución de ensayo", "ejecucion de ensayo"] },

  { key: "zona_mapeo", label: "Zona de muestreo", type: "text", width: 130, group: 2, required: true, synonyms: ["zona de muestreo", "zonademuestreo", "zona", "zona_mapeo", "zonamapeo", "zona de muestreo", "identificación de muestra"] },
  { key: "nivel", label: "Nivel", type: "decimal", width: 80, group: 2, required: true, synonyms: ["nivel"] },
  { key: "celda_mapeo", label: "Celda de mapeo", type: "text", width: 110, group: 2, required: true, synonyms: ["celda de mapeo", "celdamapeo", "celda_mapeo", "celda"] },
  { key: "muestra", label: "Muestra", type: "text", width: 80, group: 2, required: true, synonyms: ["muestra"] },
  { key: "codigo_muestra", label: "Código muestra", type: "text", width: 110, group: 2, required: true, synonyms: ["codigo muestra", "códigomuestra", "codigo_muestra", "codigomuestra"] },
  { key: "litologia_1", label: "Litología 1", type: "lito1", width: 90, group: 2, required: true, synonyms: ["litologia 1", "litología 1", "litologia_1", "lito1"] },
  { key: "litologia_2", label: "Litología 2", type: "lito2", width: 90, group: 2, synonyms: ["litologia 2", "litología 2", "litologia_2", "lito2"] },
  { key: "litologia_3", label: "Litología 3", type: "lito3", width: 90, group: 2, synonyms: ["litologia 3", "litología 3", "litologia_3", "lito3", "litho 3 - modelo2022"] },
  { key: "tipo_litologico", label: "Tipo litológico", type: "select", width: 130, group: 2, required: true, options: CAT_TIPO_LITOLOGICO, synonyms: ["tipo litologico", "tipolitológico", "tipo_litologico", "tipo litológico"] },

  { key: "este", label: "Este (m)", type: "decimal", width: 100, group: 3, synonyms: ["este", "este (m)", "east", "este(m)"] },
  { key: "norte", label: "Norte (m)", type: "decimal", width: 110, group: 3, synonyms: ["norte", "norte (m)", "north", "norte(m)"] },
  { key: "elevacion", label: "Elevación (msnm)", type: "decimal", width: 100, group: 3, synonyms: ["elevacion", "elevación", "elevación (msnm)", "elevacion(msnm)", "z"] },

  { key: "espesor_d", label: "Espesor D (cm)", type: "decimal", width: 90, group: 4, synonyms: ["espesor d", "espesord", "espesor d (cm)", "espesord(cm)", "espesor\nd\n(cm)", "espesor d (cm)"] },
  { key: "longitud_l", label: "Longitud L (cm)", type: "decimal", width: 90, group: 4, synonyms: ["longitud l", "longitudl", "longitud l (cm)", "longitudl(cm)", "longitud\nl\n(cm)", "longitud l (cm)"] },
  { key: "ancho_w1", label: "Ancho W1 (cm)", type: "decimal", width: 95, group: 4, synonyms: ["ancho w1", "anchow1", "ancho w1 (cm)", "anchow1(cm)", "ancho\nw1\n(cm)"] },
  { key: "ancho_w2", label: "Ancho W2 (cm)", type: "decimal", width: 95, group: 4, synonyms: ["ancho w2", "anchow2", "ancho w2 (cm)", "anchow2(cm)", "ancho\nw2\n(cm)"] },
  { key: "ancho_w", label: "Ancho W (cm)", type: "decimal", width: 95, group: 4, computed: true, synonyms: ["ancho w", "anchow", "ancho w (cm)", "anchow(cm)", "ancho\nw\n(cm)"] },
  { key: "muestra_valida_longitud", label: "Muestra válida - L", type: "text", width: 115, group: 4, computed: true, synonyms: ["muestra valida - longitud", "muestra válida - longitud"] },
  { key: "muestra_valida_ancho", label: "Muestra válida - W", type: "text", width: 115, group: 4, computed: true, synonyms: ["muestra valida - ancho", "muestra válida - ancho"] },

  { key: "fuerza_p", label: "Fuerza P (kN)", type: "decimal", width: 90, group: 5, important: true, synonyms: ["fuerza p", "fuerzap", "fuerza p (kn)", "fuerzap(kn)", "fuerza\np\n(kn)", "fuerza p (kn)"] },
  { key: "direccion_rotura", label: "Dirección rotura", type: "select", width: 110, group: 5, options: CAT_DIRECCION_ROTURA, synonyms: ["direccion rotura", "dirección rotura", "dirección de ruptura", "direccion_rotura"] },
  { key: "tipo_fractura", label: "Tipo fractura", type: "select", width: 110, group: 5, options: CAT_TIPO_FRACTURA, synonyms: ["tipo fractura", "tipo de fractura", "tipo_fractura"] },

  { key: "diametro_equivalente", label: "Diám. Equiv De (cm)", type: "decimal", width: 120, group: 6, computed: true, synonyms: ["diametro equivalente", "diámetro equiv de (cm)", "diametro equivalente\n(cm)"] },
  { key: "f", label: "Fact. Correc.", type: "decimal", width: 85, group: 6, computed: true, synonyms: ["f", "fact correc", "fact. correc."] },
  { key: "is_mpa", label: "Is (MPa)", type: "decimal", width: 80, group: 6, important: true, computed: true, synonyms: ["is", "is (mpa)", "is(mpa)"] },
  { key: "is_50", label: "Is(50) (MPa)", type: "decimal", width: 85, group: 6, important: true, computed: true, synonyms: ["is50", "is(50)", "is(50) (mpa)", "is50(mpa)"] },

  { key: "factor_conversion_k", label: "Factor K", type: "decimal", width: 80, group: 7, synonyms: ["factor k", "factork", "factor de conversión k", "factor_conversion_k"] },
  { key: "ucs", label: "UCS (MPa)", type: "decimal", width: 80, group: 7, important: true, computed: true, synonyms: ["ucs", "ucs (mpa)", "ucs(mpa)"] },
  { key: "resistencia_isrm", label: "Resist. ISRM", type: "text", width: 90, group: 7, computed: true, synonyms: ["resistencia isrm", "resist. isrm"] },
  { key: "denominacion_isrm", label: "Denominación ISRM", type: "text", width: 220, group: 7, computed: true, synonyms: ["denominacion isrm", "denominación isrm", "denominación isrm de la resistencia de la roca"] },

  { key: "observaciones", label: "Observaciones", type: "text", width: 180, group: 8, synonyms: ["observaciones"] },
];

interface PltEnsayosViewProps {
  pltEnsayos: any[];
  onChange: (rows: any[]) => void;
  activeWindowCelda: string | null;
  onSave: () => void;
  syncStatus: string;
  syncMessage: string;
}

export default function PltEnsayosView({
  pltEnsayos,
  onChange,
  activeWindowCelda,
  onSave,
  syncStatus,
  syncMessage
}: PltEnsayosViewProps) {
  const [filterActiveCell, setFilterActiveCell] = useState(true);

  const [fCampana, setFCampana] = useState('');
  const [fZona, setFZona] = useState('');
  const [fLito, setFLito] = useState('');

  const [activeModal, setActiveModal] = useState<'qaqc' | 'reporte' | 'catalogo' | null>(null);
  const [editCell, setEditCell] = useState<{ id: number; key: string } | null>(null);

  // Estado temporal de importación para la confirmación de filtro inteligente
  const [pendingImportRows, setPendingImportRows] = useState<any[] | null>(null);

  const createEmptyRow = (customId?: number, prefillCelda?: string) => {
    return {
      id: customId || Date.now(),
      campana: new Date().getFullYear(),
      fecha_ensayo: new Date().toISOString().split("T")[0],
      sector_geotecnico: "",
      ejecutado_por: "",
      zona_mapeo: "",
      nivel: 3960.0,
      celda_mapeo: prefillCelda || (filterActiveCell && activeWindowCelda ? activeWindowCelda : ""),
      muestra: "",
      codigo_muestra: "",
      litologia_1: "",
      litologia_2: "",
      litologia_3: "",
      tipo_litologico: "Roca intrusiva",
      este: null,
      norte: null,
      elevacion: null,
      espesor_d: null,
      longitud_l: null,
      ancho_w1: null,
      ancho_w2: null,
      fuerza_p: null,
      direccion_rotura: "Pa",
      tipo_fractura: "M",
      factor_conversion_k: null,
      observaciones: "",
      _dirty: true
    };
  };

  const handleAddRow = () => {
    const newRow = createEmptyRow();
    onChange([...pltEnsayos, newRow]);
  };

  const handleInsertRowBelow = (index: number) => {
    const parentRow = pltEnsayos[index];
    const newRow = createEmptyRow(Date.now() + index, parentRow?.celda_mapeo);
    const updated = [...pltEnsayos];
    updated.splice(index + 1, 0, newRow);
    onChange(updated);
  };

  const handleDeleteRow = (id: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar este registro de ensayo PLT?")) {
      onChange(pltEnsayos.filter(r => r.id !== id));
    }
  };

  // 🧪 VINCULAMOS FILTRADO INTELIGENTE EN EL GRID PRINCIPAL
  const filteredRows = useMemo(() => {
    return pltEnsayos.filter(r => {
      if (filterActiveCell && activeWindowCelda) {
        const normRowCell = normalizeCeldaCode(r.celda_mapeo);
        const normActiveCell = normalizeCeldaCode(activeWindowCelda);
        if (normRowCell !== normActiveCell) {
          return false;
        }
      }
      if (fCampana && !String(r.campana || "").toLowerCase().includes(fCampana.toLowerCase())) return false;
      if (fZona && !String(r.zona_mapeo || "").toLowerCase().includes(fZona.toLowerCase())) return false;
      if (fLito && !String(r.litologia_1 || "").toLowerCase().includes(fLito.toLowerCase())) return false;

      return true;
    });
  }, [pltEnsayos, filterActiveCell, activeWindowCelda, fCampana, fZona, fLito]);

  // Compute values for all rows
  const computedRows = useMemo(() => {
    return filteredRows.map(r => applyPltFormulas(r));
  }, [filteredRows]);

  const handleCommitEdit = (id: number, key: string, rawVal: any) => {
    setEditCell(null);
    const col = COLS.find(c => c.key === key);
    if (!col) return;

    let val = rawVal;
    if (rawVal === "" || rawVal === null || rawVal === undefined) {
      val = null;
    } else if (col.type === "int") {
      val = parseInt(rawVal, 10);
      if (isNaN(val)) val = null;
    } else if (col.type === "decimal") {
      val = parseFloat(rawVal);
      if (isNaN(val)) val = null;
    }

    const updated = pltEnsayos.map(r => {
      if (r.id === id) {
        return { ...r, [key]: val, _dirty: true };
      }
      return r;
    });
    onChange(updated);
  };

  const handleCommitSelect = (id: number, key: string, val: any) => {
    setEditCell(null);
    const updated = pltEnsayos.map(r => {
      if (r.id === id) {
        const cascade = applyLitoCascade(key, val || null, r);
        return { ...cascade, _dirty: true };
      }
      return r;
    });
    onChange(updated);
  };

  const getCellClassName = (c: any, val: any) => {
    const base = "border-r border-navy-900/30 text-xs px-2 min-h-[28px] flex items-center select-text font-mono";
    if (c.computed) {
      if (c.key === "muestra_valida_longitud" || c.key === "muestra_valida_ancho") {
        if (val === "SÍ") return `${base} text-emerald-400 font-bold bg-emerald-500/5`;
        if (val === "NO") return `${base} text-rose-400 font-bold bg-rose-500/5`;
        return `${base} text-slate-500 italic bg-navy-950/10`;
      }
      if (c.key === "resistencia_isrm" && val) {
        const isrmColors: Record<string, string> = {
          r0: "text-rose-400 font-semibold",
          r1: "text-orange-400 font-semibold",
          r2: "text-amber-400 font-semibold",
          r3: "text-yellow-400 font-semibold",
          r4: "text-emerald-400 font-semibold",
          r5: "text-cyan-400 font-bold",
          r6: "text-blue-400 font-bold",
        };
        return `${base} ${isrmColors[val.toLowerCase()] || "text-slate-400"}`;
      }
      if (c.important) return `${base} text-orange-400 font-bold bg-orange-500/5`;
      return `${base} text-slate-400 italic bg-navy-950/10`;
    }
    if (c.important) return `${base} text-orange-400 font-bold`;
    return `${base} text-slate-300 font-normal`;
  };

  const formatCellValue = (val: any, c: any) => {
    if (val === null || val === undefined || val === "") return "";
    if (c.type === "decimal" && typeof val === "number") {
      return val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
    }
    return String(val);
  };

  const handleExportExcel = () => {
    const dataToExport = computedRows.map((r, idx) => {
      const obj: Record<string, any> = { "#": idx + 1 };
      COLS.forEach(c => {
        obj[c.label] = r[c.key] ?? "";
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PLT Irregulares");
    XLSX.writeFile(wb, "plt_ensayos_irregulares.xlsx");
  };

  // Función de normalización robusta de cadenas para mapear cabeceras con saltos de línea e inconsistencias de redacción
  const normalizeHeader = (val: any): string => {
    if (val === null || val === undefined) return "";
    return String(val)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s\n\r_/-]/g, "")
      .replace(/[()]/g, "")
      .trim();
  };

  // 🧪 Saneamiento y autocompletado automático de litologías importadas (Lito 1, Lito 2, Lito 3, Factor K)
  const resolveImportedLithology = (rowObj: any) => {
    const code = String(rowObj.litologia_3 || rowObj.litologia_2 || rowObj.litologia_1 || "").trim().toUpperCase();
    if (!code) return;

    const match = LITO_CATALOG.find(e => e.lito3?.toUpperCase() === code) ||
      LITO_CATALOG.find(e => e.lito2?.toUpperCase() === code) ||
      LITO_CATALOG.find(e => e.lito1?.toUpperCase() === code);

    if (match) {
      rowObj.litologia_1 = match.lito1;
      rowObj.litologia_2 = match.lito2 || "";
      rowObj.litologia_3 = match.lito3 || "";
      rowObj.factor_conversion_k = match.factorK;
    }
  };

  // EXCEL IMPORT - IMPLEMENTACIÓN EXACTA DE LA LÓGICA DE TU ARCHIVO OFFLINE DE HTML CON AUTO-DETECCION DE FILA DE CABECERA
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // 1. Convertir la hoja de Excel a una matriz bidimensional cruda (Arreglo 2D de filas)
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (rawRows.length < 2) {
          alert("El archivo importado no contiene filas de datos.");
          return;
        }

        // 2. Construir mapeador dinámico tolerante de Etiquetas (Labels) y sinónimos a Claves reales de BD (Keys en snake_case)
        const labelToKey: Record<string, string> = {};
        COLS.filter(c => !c.computed).forEach(c => {
          labelToKey[normalizeHeader(c.label)] = c.key;
          if (c.synonyms) {
            c.synonyms.forEach(s => {
              labelToKey[normalizeHeader(s)] = c.key;
            });
          }
        });

        // 3. Auto-detección dinámica de la fila de cabeceras (Soporta layouts de doble cabecera de tus planillas reales)
        let bestRowIdx = 0;
        let maxMatches = -1;
        const maxScan = Math.min(10, rawRows.length);

        for (let r = 0; r < maxScan; r++) {
          const row = rawRows[r];
          if (!row) continue;
          let matches = 0;
          row.forEach((cellVal) => {
            if (cellVal === null || cellVal === undefined) return;
            const cleanVal = normalizeHeader(cellVal);
            if (labelToKey[cleanVal]) {
              matches++;
            }
          });
          if (matches > maxMatches) {
            maxMatches = matches;
            bestRowIdx = r;
          }
        }

        const headerRow = rawRows[bestRowIdx] || [];

        // 4. Mapear las posiciones de columna del Excel a sus respectivas claves de BD
        const colMap = headerRow.map(h => {
          if (h === null || h === undefined) return null;
          const cleanHeader = normalizeHeader(h);
          return labelToKey[cleanHeader] || null;
        });

        // 5. Mapear cada fila física a un objeto de Ensayo PLT, saneando tipos numéricos, fechas seriales y litologías
        const importedRows = rawRows.slice(bestRowIdx + 1).map((r, rowIdx) => {
          const rowObj: any = createEmptyRow(Date.now() + rowIdx);
          colMap.forEach((key, colIdx) => {
            if (key && r[colIdx] !== undefined && r[colIdx] !== null && r[colIdx] !== "") {
              let cellVal = r[colIdx];

              const colMeta = COLS.find(c => c.key === key);
              if (colMeta) {
                if (colMeta.type === "int") {
                  const parsed = parseInt(String(cellVal), 10);
                  cellVal = isNaN(parsed) ? null : parsed;
                } else if (colMeta.type === "decimal") {
                  const parsed = parseFloat(String(cellVal));
                  cellVal = isNaN(parsed) ? null : parsed;
                } else if (colMeta.type === "date") {
                  if (typeof cellVal === "number") {
                    // Convertir fecha serial de Excel a string YYYY-MM-DD
                    const jsDate = new Date((cellVal - 25569) * 86400 * 1000);
                    cellVal = jsDate.toISOString().split("T")[0];
                  } else if (cellVal instanceof Date) {
                    cellVal = cellVal.toISOString().split("T")[0];
                  } else {
                    cellVal = String(cellVal).trim().substring(0, 10);
                  }
                } else {
                  cellVal = String(cellVal).trim();
                }
              }
              rowObj[key] = cellVal;
            }
          });

          // Autocompletado inteligente de cascada litológica al importar
          resolveImportedLithology(rowObj);

          return rowObj;
        });

        // 🛡 FILTRADO INTELIGENTE ANTES DE LA CARGA (Filtra o importa todo según decisión)
        if (activeWindowCelda) {
          setPendingImportRows(importedRows);
        } else {
          onChange([...pltEnsayos, ...importedRows]);
          alert(`Se importaron ${importedRows.length} registros con éxito.`);
        }
      } catch (err) {
        console.error(err);
        alert("Error al importar Excel. Verifique el formato e inténtelo de nuevo.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // QA/QC Validation calculations
  const qaqcDetails = useMemo(() => {
    return computedRows.map(r => {
      const required = ["campana", "fecha_ensayo", "ejecutado_por", "zona_mapeo", "nivel", "celda_mapeo", "muestra", "codigo_muestra", "litologia_1"];
      const camposOk = required.every(k => r[k] !== null && r[k] !== undefined && r[k] !== "");
      const longitudOk = r.muestra_valida_longitud !== null ? (r.muestra_valida_longitud === "SÍ") : null;
      const anchoOk = r.muestra_valida_ancho !== null ? (r.muestra_valida_ancho === "SÍ") : null;
      const fuerzaOk = typeof r.fuerza_p === "number" && r.fuerza_p > 0;
      const factorKOk = typeof r.factor_conversion_k === "number" && r.factor_conversion_k > 0;
      const ucsOk = typeof r.ucs === "number" && r.ucs > 0;
      const fracOk = !!r.tipo_fractura;
      const dirOk = !!r.direccion_rotura;

      const issues = [];
      if (!camposOk) issues.push("Campos obligatorios incompletos");
      if (longitudOk === false) issues.push("L < D (Longitud inválida)");
      if (anchoOk === false) issues.push("D/W fuera de rango (Ancho inválido)");
      if (!fuerzaOk) issues.push("Fuerza P faltante");
      if (!factorKOk) issues.push("Factor K sin asignar");
      if (!ucsOk) issues.push("UCS no calculable");
      if (!fracOk) issues.push("Tipo fractura faltante");
      if (!dirOk) issues.push("Dirección rotura faltante");

      return {
        id: r.id,
        codigo: r.codigo_muestra || `ID ${r.id}`,
        camposOk,
        longitudOk,
        anchoOk,
        fuerzaOk,
        factorKOk,
        ucsOk,
        fracOk,
        dirOk,
        issues
      };
    });
  }, [computedRows]);

  const qaqcStats = useMemo(() => {
    const total = qaqcDetails.length;
    const okCount = qaqcDetails.filter(r => r.issues.length === 0).length;
    const errCount = total - okCount;
    const valLong = qaqcDetails.filter(r => r.longitudOk === true).length;
    const valAncho = qaqcDetails.filter(r => r.anchoOk === true).length;
    return { total, okCount, errCount, valLong, valAncho };
  }, [qaqcDetails]);

  // Report dashboard calculations
  const reportStats = useMemo(() => {
    const rr = computedRows;
    const total = rr.length;
    const withUcs = rr.filter(r => typeof r.ucs === "number").length;
    const valL = rr.filter(r => r.muestra_valida_longitud === "SÍ").length;
    const valA = rr.filter(r => r.muestra_valida_ancho === "SÍ").length;

    const ucsV = rr.filter(r => typeof r.ucs === "number").map(r => r.ucs as number);
    const is50V = rr.filter(r => typeof r.is_50 === "number").map(r => r.is_50 as number);

    const avg = (arr: number[]) => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0;

    const isrmCnt: Record<string, number> = {};
    ISRM_TABLE.forEach(r => { isrmCnt[r.indice] = 0; });
    rr.forEach(r => {
      if (r.resistencia_isrm) isrmCnt[r.resistencia_isrm] = (isrmCnt[r.resistencia_isrm] || 0) + 1;
    });

    const litoCnt: Record<string, number> = {};
    rr.forEach(r => {
      if (r.litologia_1) litoCnt[r.litologia_1] = (litoCnt[r.litologia_1] || 0) + 1;
    });

    return {
      total,
      withUcs,
      valL,
      valA,
      ucsMin: ucsV.length ? Math.min(...ucsV) : null,
      ucsMax: ucsV.length ? Math.max(...ucsV) : null,
      ucsAvg: ucsV.length ? avg(ucsV) : null,
      is50Avg: is50V.length ? avg(is50V) : null,
      isrmCnt,
      litoCnt
    };
  }, [computedRows]);

  return (
    <div className="space-y-6 select-none animate-fade-in text-left">
      {/* TOOLBAR RE-ESTILIZADO PARA CONECTARSE DE FORMA COHERENTE CON REGISTRO DE CAMPO */}
      <div className="glass-panel p-4 rounded-xl border border-navy-800 bg-navy-950/20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black text-slate-100 uppercase tracking-widest">Ensayos PLT Irregulares</h2>
          <span className="text-xs bg-navy-900 border border-navy-800 text-slate-400 font-bold px-2 py-0.5 rounded-full">
            {filteredRows.length} de {pltEnsayos.length} registros
          </span>

          <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider ml-4 cursor-pointer hover:text-slate-200 select-none">
            <input
              type="checkbox"
              checked={filterActiveCell}
              onChange={(e) => setFilterActiveCell(e.target.checked)}
              disabled={!activeWindowCelda}
              className="accent-orange-500 rounded cursor-pointer"
            />
            <span>Filtrar por Celda Actual {activeWindowCelda ? `(${activeWindowCelda})` : ""}</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* SEARCH FILTERS */}
          <input
            type="text"
            placeholder="Campaña"
            value={fCampana}
            onChange={(e) => setFCampana(e.target.value)}
            className="bg-navy-900 border border-navy-800 hover:border-navy-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg w-24 outline-none focus:ring-2 focus:ring-orange-500/20"
          />
          <input
            type="text"
            placeholder="Muestreo"
            value={fZona}
            onChange={(e) => setFZona(e.target.value)}
            className="bg-navy-900 border border-navy-800 hover:border-navy-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg w-28 outline-none focus:ring-2 focus:ring-orange-500/20"
          />
          <input
            type="text"
            placeholder="Litología"
            value={fLito}
            onChange={(e) => setFLito(e.target.value)}
            className="bg-navy-900 border border-navy-800 hover:border-navy-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg w-28 outline-none focus:ring-2 focus:ring-orange-500/20"
          />

          <div className="h-6 w-[1px] bg-navy-800 mx-2" />

          {/* ACCIONES DEL TOOLBAR DE ESTILO COHERENTE */}
          <button
            onClick={() => setActiveModal('qaqc')}
            className="flex items-center gap-1.5 bg-navy-900 border border-navy-800 hover:bg-navy-850 hover:border-indigo-500/30 text-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md"
          >
            <ShieldCheck size={14} className="text-indigo-400" />
            <span>Control QA/QC</span>
          </button>

          <button
            onClick={() => setActiveModal('reporte')}
            className="flex items-center gap-1.5 bg-navy-900 border border-navy-800 hover:bg-navy-850 hover:border-cyan-500/30 text-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md"
          >
            <Activity size={14} className="text-cyan-400" />
            <span>Reporte Resumen</span>
          </button>

          <button
            onClick={() => setActiveModal('catalogo')}
            className="flex items-center gap-1.5 bg-navy-900 border border-navy-800 hover:bg-navy-850 hover:border-amber-500/30 text-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md"
          >
            <BookOpen size={14} className="text-amber-400" />
            <span>Ver Catálogo</span>
          </button>

          {/* BOTÓN IMPORTAR EXCEL COMPLETAMENTE VERDE */}
          <label className="flex items-center gap-1.5 bg-navy-900 border border-navy-800 hover:bg-navy-850 hover:border-emerald-500/30 text-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer select-none shadow-md">
            <FileSpreadsheet size={14} className="text-emerald-500" />
            <span>Importar Excel</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
          </label>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-navy-900 border border-navy-800 hover:bg-navy-850 hover:border-sky-500/30 text-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md"
          >
            <Download size={14} className="text-sky-400" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 bg-gradient-to-r from-orange-600 to-amber-500 hover:brightness-110 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition-all active:scale-95 shadow-md shadow-orange-950/20"
          >
            <Plus size={14} />
            <span>Nueva Fila</span>
          </button>
        </div>
      </div>

      {/* SYNCHRONIZATION STATUS BAR */}
      <div className="flex justify-between items-center bg-navy-900/40 border border-navy-800/80 px-4 py-2 rounded-lg text-xs">
        <span className="text-slate-400 font-semibold">{syncMessage}</span>
        <button
          onClick={onSave}
          disabled={syncStatus === 'saving'}
          className={`px-3 py-1 rounded-md font-bold text-xs shadow-md border ${syncStatus === 'synced'
              ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-orange-500/10 border-orange-500/35 text-orange-400 hover:bg-orange-500/20 animate-pulse'
            }`}
        >
          {syncStatus === 'saving' ? 'Guardando...' : syncStatus === 'synced' ? 'Guardado' : 'Guardar Cambios'}
        </button>
      </div>

      {/* HORIZONTAL SCROLLABLE GRID */}
      <div className="glass-panel rounded-xl border border-navy-800 overflow-hidden shadow-2xl bg-navy-950/15">
        <div className="overflow-x-auto w-full h-[65vh]">
          <table className="w-max min-w-full border-collapse">
            <thead>
              {/* Row Group Headers */}
              <tr>
                <th className="bg-navy-950 text-slate-500 font-bold text-[10px] py-1 border-r border-b border-navy-800 text-center sticky left-0 z-20 w-10">#</th>
                {Object.entries(GROUP_META).map(([id, meta]) => {
                  const span = COLS.filter(c => c.group === Number(id)).length;
                  return (
                    <th
                      key={id}
                      colSpan={span}
                      style={{ backgroundColor: meta.bg }}
                      className="text-slate-200 font-bold text-[10px] tracking-wider py-1 border-r border-b border-navy-800 text-center"
                    >
                      {meta.label}
                    </th>
                  );
                })}
                <th className="bg-navy-950 text-slate-500 border-b border-navy-800 text-center w-[75px]"></th>
              </tr>

              {/* Column Headers */}
              <tr className="bg-navy-950/80 border-b border-navy-850">
                <th className="bg-navy-950 text-slate-400 font-semibold text-[10px] uppercase py-2 border-r border-navy-850 text-center sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">#</th>
                {COLS.map(c => (
                  <th
                    key={c.key}
                    style={{ width: c.width, minWidth: c.width }}
                    className={`px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider border-r border-navy-850 select-none ${c.required ? "text-rose-400/90 after:content-['*'] after:ml-0.5 after:text-rose-400" :
                        c.important ? "text-orange-400" :
                          c.computed ? "text-slate-500 italic" : "text-slate-400"
                      }`}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="text-center font-bold text-[10px] uppercase text-slate-500 px-2 w-[75px]">Acción</th>
              </tr>
            </thead>

            <tbody>
              {computedRows.map((row, idx) => {
                const isEven = idx % 2 === 0;
                const rowBg = isEven ? "bg-navy-900/5 hover:bg-navy-900/25" : "bg-navy-950/20 hover:bg-navy-900/25";

                return (
                  <tr key={row.id} className={`${rowBg} transition-colors border-b border-navy-900/20`}>
                    {/* Row index column (Sticky Left) */}
                    <td className="sticky left-0 bg-navy-950 text-center text-slate-500 font-mono font-bold text-[10px] py-1 border-r border-navy-800 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.15)] select-none">
                      {idx + 1}
                    </td>

                    {/* Dynamic data cells */}
                    {COLS.map(c => {
                      const val = row[c.key];
                      const isEditing = editCell && editCell.id === row.id && editCell.key === c.key;

                      // Check if celda_mapeo cell should be disabled (when filtering is locked to active cell)
                      const isCellLocked = c.key === "celda_mapeo" && filterActiveCell;

                      return (
                        <td
                          key={c.key}
                          style={{ width: c.width, minWidth: c.width }}
                          onClick={() => {
                            if (!c.computed && !isCellLocked) {
                              setEditCell({ id: row.id, key: c.key });
                            }
                          }}
                          className="p-0 border-r border-navy-900/20 cursor-text hover:bg-navy-900/10 transition-colors"
                        >
                          {isEditing ? (
                            c.type === "select" || c.type === "lito1" || c.type === "lito2" || c.type === "lito3" ? (
                              (() => {
                                let options = c.options || [];
                                if (c.type === "lito1") {
                                  options = Array.from(new Set(LITO_CATALOG.map(e => e.lito1)));
                                } else if (c.type === "lito2") {
                                  options = getLito2Options(row.litologia_1);
                                } else if (c.type === "lito3") {
                                  options = getLito3Options(row.litologia_1, row.litologia_2);
                                }

                                return (
                                  <select
                                    autoFocus
                                    value={val ?? ""}
                                    onBlur={() => setEditCell(null)}
                                    onChange={(e) => handleCommitSelect(row.id, c.key, e.target.value)}
                                    className="w-full h-full min-h-[28px] bg-navy-900 text-slate-100 border-2 border-blue-500 rounded px-1.5 text-xs outline-none cursor-pointer"
                                  >
                                    <option value="">—</option>
                                    {options.map((o: string) => (
                                      <option key={o} value={o}>{o}</option>
                                    ))}
                                  </select>
                                );
                              })()
                            ) : (
                              <input
                                autoFocus
                                type={c.type === "date" ? "date" : "text"}
                                defaultValue={val ?? ""}
                                onBlur={(e) => handleCommitEdit(row.id, c.key, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCommitEdit(row.id, c.key, e.currentTarget.value);
                                  } else if (e.key === 'Escape') {
                                    setEditCell(null);
                                  }
                                }}
                                className="w-full h-full min-h-[28px] bg-navy-900 text-slate-100 border-2 border-blue-500 rounded px-2 text-xs outline-none font-mono"
                              />
                            )
                          ) : (
                            <div className={getCellClassName(c, val)}>
                              {formatCellValue(val, c) || (
                                <span className="text-navy-700/60 font-semibold select-none">—</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Actions Column */}
                    <td className="py-1 px-2 text-center w-[75px] border-r border-navy-900/20">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleInsertRowBelow(idx)}
                          className="text-slate-500 hover:text-emerald-400 font-black text-sm px-1 transition-colors"
                          title="Insertar fila abajo"
                        >
                          +
                        </button>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="text-slate-400 hover:text-rose-400 font-bold text-xs px-1 transition-colors flex items-center justify-center"
                          title="Eliminar registro"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {computedRows.length === 0 && (
                <tr>
                  <td colSpan={COLS.length + 2} className="py-16 text-center text-slate-500 italic bg-navy-950/10 font-semibold">
                    No se registran ensayos PLT para esta vista. Haz clic en "Nueva Fila" para crear uno.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🛡 QA/QC MODAL */}
      {activeModal === 'qaqc' && (
        <div
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-4xl p-6 rounded-xl border border-navy-800 space-y-4 text-left shadow-2xl bg-navy-900/95 max-h-[85vh] flex flex-col"
          >
            <div className="flex justify-between items-center border-b border-navy-800 pb-3">
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
                <span>Control de Calidad QA/QC</span>
                <span className="text-xs bg-navy-950 border border-navy-800 px-2 py-0.5 rounded-full font-bold text-orange-400">
                  {qaqcStats.okCount} / {qaqcStats.total} OK
                </span>
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-100 text-lg">✕</button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-navy-950/40 border border-navy-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-black text-emerald-400 font-mono">{qaqcStats.okCount}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Sin observaciones</div>
              </div>
              <div className="bg-navy-950/40 border border-navy-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-black text-rose-400 font-mono">{qaqcStats.errCount}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Con errores</div>
              </div>
              <div className="bg-navy-950/40 border border-navy-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-black text-orange-400 font-mono">{qaqcStats.valLong}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Válidas Longitud (L ≥ D)</div>
              </div>
              <div className="bg-navy-950/40 border border-navy-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-black text-blue-400 font-mono">{qaqcStats.valAncho}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Válidas Ancho (0.3W &lt; D &lt; W)</div>
              </div>
            </div>

            {/* Legends */}
            <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-400">
              {["Campos obligatorios", "L ≥ D", "0.3W < D < W", "Fuerza P > 0", "Factor K", "UCS calc", "Fractura", "Dirección"].map(t => (
                <span key={t} className="bg-navy-950 border border-navy-850 px-2 py-0.5 rounded text-slate-400 font-mono">{t}</span>
              ))}
            </div>

            {/* Details Table */}
            <div className="overflow-y-auto flex-1 border border-navy-850 rounded-lg">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-navy-950 z-10">
                  <tr className="border-b border-navy-850 text-slate-400">
                    <th className="py-2 px-3">Muestra</th>
                    <th className="py-2 px-2 text-center">Campos</th>
                    <th className="py-2 px-2 text-center">L ≥ D</th>
                    <th className="py-2 px-2 text-center">D vs W</th>
                    <th className="py-2 px-2 text-center">Fuerza P</th>
                    <th className="py-2 px-2 text-center">K</th>
                    <th className="py-2 px-2 text-center">UCS</th>
                    <th className="py-2 px-2 text-center">Frac</th>
                    <th className="py-2 px-2 text-center">Dir</th>
                    <th className="py-2 px-3">Observaciones QC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/30">
                  {qaqcDetails.map((r, i) => (
                    <tr key={r.id} className={`${i % 2 === 0 ? "bg-navy-900/5" : "bg-navy-950/20"} ${r.issues.length ? "border-l-2 border-rose-500" : ""}`}>
                      <td className="py-2 px-3 font-mono font-bold text-slate-300">{r.codigo}</td>
                      <td className="py-2 px-2 text-center font-bold">{r.camposOk ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">✗</span>}</td>
                      <td className="py-2 px-2 text-center font-bold">
                        {r.longitudOk === null ? <span className="text-slate-600">—</span> : r.longitudOk ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">✗</span>}
                      </td>
                      <td className="py-2 px-2 text-center font-bold">
                        {r.anchoOk === null ? <span className="text-slate-600">—</span> : r.anchoOk ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">✗</span>}
                      </td>
                      <td className="py-2 px-2 text-center font-bold">{r.fuerzaOk ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">✗</span>}</td>
                      <td className="py-2 px-2 text-center font-bold">{r.factorKOk ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">✗</span>}</td>
                      <td className="py-2 px-2 text-center font-bold">{r.ucsOk ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">✗</span>}</td>
                      <td className="py-2 px-2 text-center font-bold">{r.fracOk ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">✗</span>}</td>
                      <td className="py-2 px-2 text-center font-bold">{r.dirOk ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">✗</span>}</td>
                      <td className={`py-2 px-3 font-mono text-[10px] ${r.issues.length ? "text-rose-400 font-bold" : "text-emerald-400/80"}`}>
                        {r.issues.length ? r.issues.join(" · ") : "Estable"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 📊 REPORT MODAL */}
      {activeModal === 'reporte' && (
        <div
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-3xl p-6 rounded-xl border border-navy-800 space-y-4 text-left shadow-2xl bg-navy-900/95 max-h-[85vh] flex flex-col"
          >
            <div className="flex justify-between items-center border-b border-navy-800 pb-3">
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest">
                Reportabilidad — Resumen de Ensayos PLT
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-100 text-lg">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {/* KPIs Grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-navy-950/40 border border-navy-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-cyan-400 font-mono">{reportStats.total}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Total Ensayos</div>
                </div>
                <div className="bg-navy-950/40 border border-navy-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-emerald-400 font-mono">{reportStats.withUcs}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Con UCS calculado</div>
                </div>
                <div className="bg-navy-950/40 border border-navy-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-orange-400 font-mono">{reportStats.valL}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Válidos Longitud</div>
                </div>
                <div className="bg-navy-950/40 border border-navy-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-purple-400 font-mono">{reportStats.valA}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Válidos Ancho</div>
                </div>
              </div>

              {/* UCS Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-navy-950/60 border border-navy-800/60 p-3 rounded-lg flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-semibold">UCS mín (MPa)</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{reportStats.ucsMin !== null ? reportStats.ucsMin.toFixed(1) : "—"}</span>
                </div>
                <div className="bg-navy-950/60 border border-navy-800/60 p-3 rounded-lg flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-semibold">UCS máx (MPa)</span>
                  <span className="font-mono font-bold text-rose-400 text-sm">{reportStats.ucsMax !== null ? reportStats.ucsMax.toFixed(1) : "—"}</span>
                </div>
                <div className="bg-navy-950/60 border border-navy-800/60 p-3 rounded-lg flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-semibold">UCS prom (MPa)</span>
                  <span className="font-mono font-bold text-amber-400 text-sm">{reportStats.ucsAvg !== null ? reportStats.ucsAvg.toFixed(1) : "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* ISRM Class distribution */}
                <div className="bg-navy-950/30 border border-navy-850 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-navy-800 pb-2">Distribución por Clase ISRM</h4>
                  <div className="space-y-2">
                    {ISRM_TABLE.map(r => {
                      const count = reportStats.isrmCnt[r.indice] || 0;
                      const pct = reportStats.total > 0 ? (count / reportStats.total * 100) : 0;
                      return (
                        <div key={r.indice} className="flex items-center gap-3 text-xs">
                          <span className="font-bold text-orange-400 w-8">{r.indice}</span>
                          <div className="flex-1 bg-navy-950 border border-navy-900 rounded h-3 overflow-hidden">
                            <div className="bg-orange-500/40 h-full rounded transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono text-slate-400 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Lithology distribution */}
                <div className="bg-navy-950/30 border border-navy-850 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-navy-800 pb-2">Distribución por Litología 1</h4>
                  <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                    {Object.entries(reportStats.litoCnt).sort((a, b) => b[1] - a[1]).map(([lito, count]) => {
                      const pct = reportStats.total > 0 ? (count / reportStats.total * 100) : 0;
                      return (
                        <div key={lito} className="flex items-center gap-3 text-xs">
                          <span className="font-bold text-blue-400 w-16 truncate">{lito}</span>
                          <div className="flex-1 bg-navy-950 border border-navy-900 rounded h-3 overflow-hidden">
                            <div className="bg-blue-500/40 h-full rounded transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono text-slate-400 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                    {Object.keys(reportStats.litoCnt).length === 0 && (
                      <span className="text-slate-500 text-xs italic block">Sin registros cargados</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Is(50) Average */}
              {reportStats.is50Avg !== null && (
                <div className="bg-navy-950/60 border border-navy-800 p-3 rounded-lg flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-semibold">Is(50) promedio (MPa)</span>
                  <span className="font-mono font-bold text-blue-400 text-sm">{reportStats.is50Avg.toFixed(4)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 📖 CATALOG MODAL */}
      {activeModal === 'catalogo' && (
        <div
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-xl p-6 rounded-xl border border-navy-800 space-y-4 text-left shadow-2xl bg-navy-900/95 max-h-[85vh] flex flex-col"
          >
            <div className="flex justify-between items-center border-b border-navy-800 pb-3">
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest">
                Catálogo Litológico — Factor K
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-100 text-lg">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 border border-navy-850 rounded-lg">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-navy-950 z-10 border-b border-navy-850">
                  <tr className="text-slate-400">
                    <th className="py-2.5 px-3">Litología 1</th>
                    <th className="py-2.5 px-3">Litología 2</th>
                    <th className="py-2.5 px-3">Litología 3</th>
                    <th className="py-2.5 px-3 text-right">Factor K</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/30">
                  {LITO_CATALOG.map((e, idx) => {
                    const isEven = idx % 2 === 0;
                    return (
                      <tr key={idx} className={isEven ? "bg-navy-900/5" : "bg-navy-950/20"}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-300">{e.lito1}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{e.lito2}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{e.lito3 || <span className="text-navy-850">—</span>}</td>
                        <td className="py-2 px-3 font-mono font-bold text-orange-400 text-right">{e.factorK}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 🛡 MODAL DE CONFIRMACIÓN DE FILTRADO INTELIGENTE ANTES DE LA CARGA */}
      {pendingImportRows && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left select-none">
          <div className="glass-panel w-full max-w-md p-6 rounded-xl border border-navy-800 space-y-4 shadow-2xl bg-navy-900/95">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest border-b border-navy-800 pb-2 flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-orange-400" />
              <span>Confirmar Filtro de Importación</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              Se han procesado <span className="text-orange-400 font-bold">{pendingImportRows.length}</span> registros en el archivo Excel.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              ¿Deseas importar **únicamente** los registros que correspondan a la celda activa actual (<span className="text-orange-400 font-black">{activeWindowCelda}</span>) o prefieres importar todos los registros del archivo?
            </p>

            <div className="flex gap-2 justify-end pt-3 border-t border-navy-800 shrink-0">
              <button
                onClick={() => setPendingImportRows(null)}
                className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const filtered = pendingImportRows.filter(r =>
                    normalizeCeldaCode(r.celda_mapeo) === normalizeCeldaCode(activeWindowCelda || "")
                  );
                  onChange([...pltEnsayos, ...filtered]);
                  alert(`Se importaron ${filtered.length} registros que coinciden con ${activeWindowCelda}.`);
                  setPendingImportRows(null);
                }}
                className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-400 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all shadow-md active:scale-95"
              >
                Solo {activeWindowCelda} ({pendingImportRows.filter(r => normalizeCeldaCode(r.celda_mapeo) === normalizeCeldaCode(activeWindowCelda || "")).length})
              </button>
              <button
                onClick={() => {
                  onChange([...pltEnsayos, ...pendingImportRows]);
                  alert(`Se importaron todos los ${pendingImportRows.length} registros del archivo.`);
                  setPendingImportRows(null);
                }}
                className="bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/25 text-orange-400 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all shadow-md active:scale-95"
              >
                Importar Todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}