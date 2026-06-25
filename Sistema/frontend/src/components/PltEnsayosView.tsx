import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Activity,
  Plus,
  Trash2,
  Filter
} from 'lucide-react';
import { FormulaTooltipTrigger } from './FormulaTooltip';
import PltExcelImportModal from './PltExcelImportModal';
import { LITHOLOGY_CLASSIFICATION } from '../utils/catalogData';

export const CAT_TIPO_LITOLOGICO = ["INTRUSIVOS", "SEDIMENTARIOS", "METAMORFICAS", "BRECHAS", "ENDOSKARN"];
export const CAT_TIPO_FRACTURA = ["M", "E", "C"];
export const CAT_DIRECCION_ROTURA = ["Pa", "Pe", "NA"];

export const ISRM_TABLE = [
  { indice: "R0", minUcs: 0.25, maxUcs: 1, denominacion: "Extremadamente débil" },
  { indice: "R1", minUcs: 1, maxUcs: 5, denominacion: "Muy débil" },
  { indice: "R2", minUcs: 5, maxUcs: 25, denominacion: "Débil" },
  { indice: "R3", minUcs: 25, maxUcs: 50, denominacion: "Moderadamente resistente" },
  { indice: "R4", minUcs: 50, maxUcs: 100, denominacion: "Resistente" },
  { indice: "R5", minUcs: 100, maxUcs: 250, denominacion: "Muy resistente" },
  { indice: "R6", minUcs: 250, maxUcs: Infinity, denominacion: "Extremadamente resistente" },
];

function getLito2Options(l1: string) {
  if (!l1) return [];
  return Array.from(new Set(
    LITHOLOGY_CLASSIFICATION.filter(item => item.unidad === l1).map(item => item.litologia)
  )).sort();
}

function getLito3Options(l1: string, l2: string | null | undefined) {
  if (!l1 || !l2) return [];
  return Array.from(new Set(
    LITHOLOGY_CLASSIFICATION.filter(item => item.unidad === l1 && item.litologia === l2).map(item => item.codigo)
  )).sort();
}

function getIsrmClass(ucs: number | null) {
  if (ucs === null || ucs === undefined || isNaN(ucs)) return null;
  const match = ISRM_TABLE.find(r => ucs >= r.minUcs && ucs < r.maxUcs);
  return match ? { indice: match.indice, denominacion: match.denominacion } : null;
}

export function applyPltFormulas(row: any) {
  const r = { ...row };
  const num = (v: any) => (v !== null && v !== undefined && v !== "" && !isNaN(Number(v))) ? Number(v) : null;

  const celdaStr = String(r.celda_mapeo || "").trim().toUpperCase();
  const muestraStr = String(r.muestra || "").trim();
  r.codigo_muestra = celdaStr && muestraStr ? `${celdaStr}-${muestraStr}` : "";

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
  r.is_50 = (r.is_mpa !== null && r.f !== null) ? Math.round(r.is_mpa * r.f * 10000) / 10000 : null;

  const K = num(r.factor_conversion_k);
  r.ucs = (r.is_50 !== null && K !== null) ? Math.round(r.is_50 * K * 100) / 100 : null;

  const cls = getIsrmClass(r.ucs);
  r.resistencia_isrm = cls ? cls.indice : null;
  r.denominacion_isrm = cls ? cls.denominacion : null;

  return r;
}

export function applyLitoCascade(key: string, val: any, row: any) {
  const r = { ...row, [key]: val };

  if (key === "litologia_1") {
    r.litologia_2 = "";
    r.litologia_3 = "";
    r.factor_conversion_k = null;
    r.tipo_litologico = "";

    if (val) {
      const matches = LITHOLOGY_CLASSIFICATION.filter(item => item.unidad === val);
      if (matches.length > 0) {
        const uniqueL2 = Array.from(new Set(matches.map(m => m.litologia)));
        if (uniqueL2.length === 1) {
          r.litologia_2 = uniqueL2[0];
          const matchesL2 = matches.filter(m => m.litologia === uniqueL2[0]);
          const uniqueL3 = Array.from(new Set(matchesL2.map(m => m.codigo)));
          if (uniqueL3.length === 1) {
            r.litologia_3 = uniqueL3[0];
            r.factor_conversion_k = matchesL2[0].k;
          }
        }
        const uniqueGroups = Array.from(new Set(matches.map(m => m.grupo)));
        if (uniqueGroups.length === 1) {
          r.tipo_litologico = uniqueGroups[0];
        }
      }
    }
  }

  else if (key === "litologia_2") {
    r.litologia_3 = "";
    r.factor_conversion_k = null;

    if (val) {
      const matches = LITHOLOGY_CLASSIFICATION.filter(
        item => item.unidad === r.litologia_1 && item.litologia === val
      );
      if (matches.length > 0) {
        const uniqueL3 = Array.from(new Set(matches.map(m => m.codigo)));
        if (uniqueL3.length === 1) {
          r.litologia_3 = uniqueL3[0];
          r.factor_conversion_k = matches[0].k;
        }
        const uniqueGroups = Array.from(new Set(matches.map(m => m.grupo)));
        if (uniqueGroups.length === 1) {
          r.tipo_litologico = uniqueGroups[0];
        }
      }
    }
  }

  else if (key === "litologia_3") {
    if (val) {
      const match = LITHOLOGY_CLASSIFICATION.find(
        item => item.unidad === r.litologia_1 && item.litologia === r.litologia_2 && item.codigo === val
      ) || LITHOLOGY_CLASSIFICATION.find(item => item.codigo === val);

      if (match) {
        r.litologia_1 = match.unidad;
        r.litologia_2 = match.litologia;
        r.litologia_3 = match.codigo;
        r.tipo_litologico = match.grupo;
        r.factor_conversion_k = match.k;
      }
    } else {
      r.factor_conversion_k = null;
    }
  }

  return r;
}

export function normalizeCeldaCode(celda: string): string {
  if (!celda) return "";
  const raw = celda.trim().toUpperCase();
  const matches = raw.match(/[A-Z]+|[0-9]+/g);
  if (!matches) return raw;

  const normalizedSegments = matches.map(segment => {
    if (/^[0-9]+$/.test(segment)) {
      const parsed = parseInt(segment, 10);
      return isNaN(parsed) ? segment : String(parsed);
    }
    return segment;
  });

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

function getPltConstraints(key: string): { intDigits: number; decDigits: number } | null {
  if (key === "este") return { intDigits: 6, decDigits: 4 };
  if (key === "norte") return { intDigits: 7, decDigits: 3 };
  if (key === "elevacion") return { intDigits: 4, decDigits: 2 };
  if (key === "espesor_d") return { intDigits: 4, decDigits: 1 };
  if (key === "nivel") return { intDigits: 4, decDigits: 2 };

  const decCols = ["longitud_l", "ancho_w1", "ancho_w2", "fuerza_p", "factor_conversion_k", "campana"];
  if (decCols.includes(key)) {
    return { intDigits: 5, decDigits: 2 };
  }
  return null;
}

const handlePltNumberLimit = (value: string, intDigits: number, decDigits: number): string => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return cleaned.slice(0, -1);

  let integerPart = parts[0];
  let decimalPart = parts[1];

  if (integerPart.length > intDigits) {
    integerPart = integerPart.slice(0, intDigits);
  }
  if (decimalPart !== undefined && decimalPart.length > decDigits) {
    decimalPart = decimalPart.slice(0, decDigits);
  }

  return decimalPart !== undefined ? `${integerPart}.${decimalPart}` : integerPart;
};

const handleGridKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
  const activeElement = e.currentTarget;
  const key = e.key;

  const allowedKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
  if (!allowedKeys.includes(key)) return;

  const td = activeElement.closest("td");
  const tr = activeElement.closest("tr");
  if (!td || !tr) return;

  const cellIndex = td.cellIndex;
  let targetInput: HTMLInputElement | HTMLSelectElement | null = null;

  if (key === "ArrowUp") {
    e.preventDefault();
    const prevTr = tr.previousElementSibling as HTMLTableRowElement | null;
    if (prevTr) {
      const targetTd = prevTr.cells[cellIndex];
      if (targetDataInput(targetTd)) {
        targetDataInput(targetTd).focus();
        if (targetDataInput(targetTd) instanceof HTMLInputElement) {
          (targetDataInput(targetTd) as HTMLInputElement).select();
        }
      }
    }
  } else if (key === "ArrowDown" || key === "Enter") {
    e.preventDefault();
    const nextTr = tr.nextElementSibling as HTMLTableRowElement | null;
    if (nextTr) {
      const targetTd = nextTr.cells[cellIndex];
      if (targetDataInput(targetTd)) {
        targetDataInput(targetTd).focus();
        if (targetDataInput(targetTd) instanceof HTMLInputElement) {
          (targetDataInput(targetTd) as HTMLInputElement).select();
        }
      }
    }
  } else if (key === "ArrowLeft") {
    let shouldMove = true;
    if (activeElement instanceof HTMLInputElement) {
      try {
        if (activeElement.selectionStart !== null && activeElement.selectionStart > 0) {
          shouldMove = false;
        }
      } catch {
        // Safe
      }
    }
    if (shouldMove) {
      let prevTd = td.previousElementSibling as HTMLTableCellElement | null;
      while (prevTd) {
        const input = prevTd.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
        if (input) {
          e.preventDefault();
          targetInput = input;
          break;
        }
        prevTd = prevTd.previousElementSibling as HTMLTableCellElement | null;
      }
    }
  } else if (key === "ArrowRight") {
    let shouldMove = true;
    if (activeElement instanceof HTMLInputElement) {
      try {
        if (activeElement.selectionStart !== null && activeElement.selectionEnd !== activeElement.value.length) {
          shouldMove = false;
        }
      } catch {
        // Safe
      }
    }
    if (shouldMove) {
      let nextTd = td.nextElementSibling as HTMLTableCellElement | null;
      while (nextTd) {
        const input = nextTd.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
        if (input) {
          e.preventDefault();
          targetInput = input;
          break;
        }
        nextTd = nextTd.nextElementSibling as HTMLTableCellElement | null;
      }
    }
  }

  if (targetInput) {
    targetInput.focus();
    if (targetInput instanceof HTMLInputElement && targetInput.type !== "date") {
      targetInput.select();
    }
  }
};

const targetDataInput = (td: HTMLTableCellElement | null): HTMLInputElement | HTMLSelectElement | null => {
  if (!td) return null;
  return td.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
};

const GROUP_META: Record<number, { label: string; bg: string }> = {
  1: { label: "Información General del Ensayo", bg: "rgba(30, 41, 59, 0.7)" },
  2: { label: "Identificación de Muestra", bg: "rgba(13, 148, 136, 0.15)" },
  3: { label: "Coordenadas WGS84", bg: "rgba(16, 185, 129, 0.15)" },
  4: { label: "Geometría del bloque irregular", bg: "rgba(59, 130, 246, 0.15)" },
  5: { label: "Datos del ensayo", bg: "rgba(99, 102, 241, 0.15)" },
  6: { label: "Cálculo de índice de carga puntual", bg: "rgba(139, 92, 246, 0.15)" },
  7: { label: "Resistencia de la roca intacta", bg: "rgba(100, 116, 139, 0.15)" },
  8: { label: "Observaciones", bg: "rgba(30, 41, 59, 0.3)" },
};

const COLS = [
  { key: "campana", label: "Campaña", type: "int", width: 80, group: 1, required: true, synonyms: ["campana", "campaña"] },
  { key: "fecha_ensayo", label: "Fecha de ensayo", type: "date", width: 120, group: 1, required: true, synonyms: ["fecha de ensayo", "fechaensayo", "fecha_ensayo"] },
  { key: "sector_geotecnico", label: "Sector Geotécnico", type: "text", width: 110, group: 1, synonyms: ["sector geotécnico", "sectorgeotecnico", "sector_geotecnico", "sector", "sectorgeot"] },
  { key: "ejecutado_por", label: "Ejecutado por", type: "text", width: 110, group: 1, required: true, synonyms: ["ejecutado por", "ejecutadopor", "ejecución de ensayo", "ejecucion de ensayo", "ejecutado"] },

  { key: "zona_mapeo", label: "Zona de muestreo", type: "text", width: 130, group: 2, required: true, synonyms: ["zona de muestreo", "zonademuestreo", "zona", "zona_mapeo", "zonamapeo", "identificación de muestra", "identificacion de muestra"] },
  { key: "nivel", label: "Nivel", type: "decimal", width: 80, group: 2, required: true, synonyms: ["nivel"] },
  { key: "celda_mapeo", label: "Celda de mapeo", type: "text", width: 110, group: 2, required: true, synonyms: ["celda de mapeo", "celdamapeo", "celda_mapeo", "celda"] },
  { key: "muestra", label: "Muestra", type: "text", width: 80, group: 2, required: true, synonyms: ["muestra"] },
  { key: "codigo_muestra", label: "Código muestra", type: "text", width: 110, group: 2, computed: true, synonyms: ["codigo muestra", "códigomuestra", "codigo_muestra", "codigomuestra"] },
  { key: "litologia_1", label: "Litología 1", type: "lito1", width: 90, group: 2, required: true, synonyms: ["litologia 1", "litología 1", "litologia_1", "lito1"] },
  { key: "litologia_2", label: "Litología 2", type: "lito2", width: 90, group: 2, synonyms: ["litologia 2", "litología 2", "litologia_2", "lito2"] },
  { key: "litologia_3", label: "Litología 3", type: "lito3", width: 90, group: 2, synonyms: ["litologia 3", "litología 3", "litologia_3", "lito3", "litho 3 - modelo2022", "litho 3"] },
  { key: "tipo_litologico", label: "Tipo litológico", type: "select", width: 130, group: 2, required: true, options: CAT_TIPO_LITOLOGICO, synonyms: ["tipo litologico", "tipolitológico", "tipo_litologico", "tipo litólico", "tipo litológico"] },

  { key: "este", label: "Este (m)", type: "decimal", width: 100, group: 3, synonyms: ["este", "este (m)", "east", "este(m)"] },
  { key: "norte", label: "Norte (m)", type: "decimal", width: 110, group: 3, synonyms: ["norte", "norte (m)", "north", "norte(m)"] },
  { key: "elevacion", label: "Elevación (msnm)", type: "decimal", width: 100, group: 3, synonyms: ["elevacion", "elevación", "elevación (msnm)", "elevacion(msnm)", "elevacion (msnm)", "z"] },

  { key: "espesor_d", label: "Espesor D (cm)", type: "decimal", width: 90, group: 4, synonyms: ["espesor d", "espesord", "espesor d (cm)", "espesord(cm)", "espesor\nd\n(cm)", "espesor d", "espesor"] },
  { key: "longitud_l", label: "Longitud L (cm)", type: "decimal", width: 90, group: 4, synonyms: ["longitud l", "longitudl", "longitud l (cm)", "longitudl(cm)", "longitud\nl\n(cm)", "longitud l", "longitud"] },
  { key: "ancho_w1", label: "Ancho W1 (cm)", type: "decimal", width: 95, group: 4, synonyms: ["ancho w1", "anchow1", "ancho w1 (cm)", "anchow1(cm)", "ancho\nw1\n(cm)"] },
  { key: "ancho_w2", label: "Ancho W2 (cm)", type: "decimal", width: 95, group: 4, synonyms: ["ancho w2", "anchow2", "ancho w2 (cm)", "anchow2(cm)", "ancho\nw2\n(cm)"] },
  { key: "ancho_w", label: "Ancho W (cm)", type: "decimal", width: 95, group: 4, computed: true, synonyms: ["ancho w", "anchow", "ancho w (cm)", "anchow(cm)", "ancho\nw\n(cm)"] },
  { key: "muestra_valida_longitud", label: "Muestra válida - L", type: "text", width: 115, group: 4, computed: true, synonyms: ["muestra valida - longitud", "muestra válida - longitud"] },
  { key: "muestra_valida_ancho", label: "Muestra válida - W", type: "text", width: 115, group: 4, computed: true, synonyms: ["muestra valida - ancho", "muestra válida - ancho"] },

  { key: "fuerza_p", label: "Fuerza P (kN)", type: "decimal", width: 90, group: 5, synonyms: ["fuerza p", "fuerzap", "fuerza p (kn)", "fuerzap(kn)", "fuerza\np\n(kn)", "fuerza p (kn)"] },
  { key: "direccion_rotura", label: "Dirección rotura", type: "select", width: 110, group: 5, options: CAT_DIRECCION_ROTURA, synonyms: ["direccion rotura", "dirección rotura", "dirección de ruptura", "direccion_rotura"] },
  { key: "tipo_fractura", label: "Tipo fractura", type: "select", width: 110, group: 5, options: CAT_TIPO_FRACTURA, synonyms: ["tipo fractura", "tipo de fractura", "tipo_fractura"] },

  { key: "diametro_equivalente", label: "Diám. Equiv De (cm)", type: "decimal", width: 120, group: 6, computed: true, synonyms: ["diametro equivalente", "diámetro equiv de (cm)", "diametro equivalente\n(cm)"] },
  { key: "f", label: "Fact. Correc.", type: "decimal", width: 85, group: 6, computed: true, synonyms: ["f", "fact correc", "fact. correc."] },
  { key: "is_mpa", label: "Is (MPa)", type: "decimal", width: 80, group: 6, computed: true, synonyms: ["is", "is (mpa)", "is(mpa)"] },
  { key: "is_50", label: "Is(50) (MPa)", type: "decimal", width: 85, group: 6, computed: true, synonyms: ["is50", "is(50)", "is(50) (mpa)", "is50(mpa)"] },

  { key: "factor_conversion_k", label: "Factor K", type: "decimal", width: 80, group: 7, synonyms: ["factor k", "factork", "factor de conversión k", "factor_conversion_k"] },
  { key: "ucs", label: "UCS (MPa)", type: "decimal", width: 80, group: 7, computed: true, synonyms: ["ucs", "ucs (mpa)", "ucs(mpa)"] },
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
  showFormulas?: boolean;
}

export default function PltEnsayosView({
  pltEnsayos,
  onChange,
  activeWindowCelda,
  onSave: _onSave,
  syncStatus: _syncStatus,
  syncMessage: _syncMessage,
  showFormulas = true
}: PltEnsayosViewProps) {
  const [filterActiveCell, setFilterActiveCell] = useState(true);

  const [fCampana, setFCampana] = useState('');
  const [fZona, setFZona] = useState('');
  const [fLito, setFLito] = useState('');

  const [activeModal, setActiveModal] = useState<'qaqc' | 'reporte' | 'import_excel' | null>(null);
  const [editCell, setEditCell] = useState<{ id: number; key: string } | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const createEmptyRow = (customId?: number, prefillCelda?: string) => {
    return {
      id: customId || Date.now(),
      campana: new Date().getFullYear(),
      fecha_ensayo: new Date().toISOString().split("T")[0],
      sector_geotecnico: "",
      ejecutado_por: "",
      zona_mapeo: "",
      nivel: 3960.00,
      celda_mapeo: prefillCelda || (filterActiveCell && activeWindowCelda ? activeWindowCelda : ""),
      muestra: "",
      codigo_muestra: "",
      litologia_1: "",
      litologia_2: "",
      litologia_3: "",
      tipo_litologico: "INTRUSIVOS",
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

  const computedRows = useMemo(() => {
    return filteredRows.map(r => applyPltFormulas(r));
  }, [filteredRows]);

  const getInputValue = (id: number, key: string, stateVal: any): string => {
    const mapKey = `${id}-${key}`;
    if (localValues[mapKey] !== undefined) return localValues[mapKey];
    if (stateVal === undefined || stateVal === null) return '';
    return String(stateVal);
  };

  const handleInputChange = (id: number, key: string, val: string) => {
    const mapKey = `${id}-${key}`;
    setLocalValues(prev => ({ ...prev, [mapKey]: val }));
  };

  const handleRowChange = (id: number, key: string, val: any) => {
    const updated = pltEnsayos.map(r => {
      if (r.id === id) {
        let updatedRow = { ...r, [key]: val, _dirty: true };
        if (key === "litologia_1" || key === "litologia_2" || key === "litologia_3") {
          updatedRow = applyLitoCascade(key, val, updatedRow);
        }
        return updatedRow;
      }
      return r;
    });
    onChange(updated);
  };

  const handleCommitEdit = (id: number, key: string, rawVal: any) => {
    setEditCell(null);
    const mapKey = `${id}-${key}`;
    setLocalValues(prev => {
      const copy = { ...prev };
      delete copy[mapKey];
      return copy;
    });

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

    if (key === "nivel" && typeof val === "number" && val > 4999) {
      val = 4999.00;
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
    const base = "border-r border-b border-navy-800 text-xs px-2 min-h-[34px] flex items-center select-text font-normal text-center justify-center leading-none";

    if (c.key === "is_mpa" || c.key === "is_50") {
      return `${base} outline outline-1 outline-offset-[-2px] outline-dashed outline-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold justify-center`;
    }

    if (c.computed) {
      if (c.key === "muestra_valida_longitud" || c.key === "muestra_valida_ancho") {
        if (val === "SÍ") return `${base} text-emerald-400 font-bold bg-emerald-500/5 justify-center`;
        if (val === "NO") return `${base} text-rose-400 font-bold bg-rose-500/5 justify-center`;
        return `${base} text-slate-500 italic bg-navy-950/10 justify-center`;
      }
      if (c.key === "resistencia_isrm" && val) {
        const isrmColors: Record<string, string> = {
          r0: "text-rose-400 font-bold",
          r1: "text-orange-400 font-bold",
          r2: "text-amber-400 font-bold",
          r3: "text-yellow-400 font-bold",
          r4: "text-emerald-400 font-bold",
          r5: "text-cyan-400 font-extrabold",
          r6: "text-blue-400 font-extrabold",
        };
        return `${base} ${isrmColors[val.toLowerCase()] || "text-slate-400"} justify-center`;
      }

      return `${base} outline outline-1 outline-offset-[-2px] outline-dashed outline-indigo-500/35 bg-indigo-500/[0.03] text-indigo-300 font-semibold`;
    }

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

  const reportStats = useMemo(() => {
    const rr = computedRows;
    const total = rr.length;
    const withUcs = rr.filter(r => typeof r.ucs === "number").length;
    const valL = rr.filter(r => r.muestra_valida_longitud === "SÍ").length;
    const valA = rr.filter(r => r.muestra_valida_ancho === "SÍ").length;

    const ucsV = rr.filter(r => typeof r.ucs === "number" && r.ucs !== null).map(r => r.ucs as number);
    const isV = rr.filter(r => typeof r.is_mpa === "number" && r.is_mpa !== null).map(r => r.is_mpa as number);
    const is50V = rr.filter(r => typeof r.is_50 === "number" && r.is_50 !== null).map(r => r.is_50 as number);

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

      isMin: isV.length ? Math.min(...isV) : null,
      isMax: isV.length ? Math.max(...isV) : null,
      isAvg: isV.length ? avg(isV) : null,

      is50Min: is50V.length ? Math.min(...is50V) : null,
      is50Max: is50V.length ? Math.max(...is50V) : null,
      is50Avg: is50V.length ? avg(is50V) : null,

      isrmCnt,
      litoCnt
    };
  }, [computedRows]);

  return (
    <div className="space-y-6 select-none animate-fade-in text-left">
      {/* TOOLBAR RE-ESTILIZADO CON BOTONES ESTANDARIZADOS */}
      <div className="glass-panel p-4 rounded-xl border border-navy-800 bg-navy-950/20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
            <span>Ensayos PLT Irregulares</span>
          </h2>
          <span className="text-xs bg-navy-900 border border-navy-800 text-slate-400 font-bold px-2 py-0.5 rounded-full">
            {filteredRows.length} de {pltEnsayos.length} registros
          </span>

          <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider ml-4 cursor-pointer hover:text-slate-200 select-none">
            <input
              type="checkbox"
              checked={filterActiveCell}
              onChange={(e) => setFilterActiveCell(e.target.checked)}
              onKeyDown={handleGridKeyDown}
              disabled={!activeWindowCelda}
              className="accent-violet-500 rounded cursor-pointer"
            />
            <span>Filtrar por Celda Actual {activeWindowCelda ? `(${activeWindowCelda})` : ""}</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Campaña"
            value={fCampana}
            onChange={(e) => setFCampana(e.target.value)}
            onKeyDown={handleGridKeyDown}
            className="bg-navy-900 border border-navy-800 hover:border-navy-700 text-slate-200 text-xs px-2.5 py-2 rounded-lg w-24 outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          <input
            type="text"
            placeholder="Muestreo"
            value={fZona}
            onChange={(e) => setFZona(e.target.value)}
            onKeyDown={handleGridKeyDown}
            className="bg-navy-900 border border-navy-800 hover:border-navy-700 text-slate-200 text-xs px-2.5 py-2 rounded-lg w-28 outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          <input
            type="text"
            placeholder="Litología"
            value={fLito}
            onChange={(e) => setFLito(e.target.value)}
            onKeyDown={handleGridKeyDown}
            className="bg-navy-900 border border-navy-800 hover:border-navy-700 text-slate-200 text-xs px-2.5 py-2 rounded-lg w-28 outline-none focus:ring-1 focus:ring-violet-500/50"
          />

          <div className="h-6 w-[1px] bg-navy-800 mx-2" />

          {/* Control QA/QC — Estilo Cian/Cielo Neón */}
          <button
            onClick={() => setActiveModal('qaqc')}
            className="px-4 py-2 bg-sky-500/10 border border-sky-500/40 hover:bg-sky-500/20 hover:border-sky-400 text-sky-400 text-xs font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(14,165,233,0.12)] rounded-lg flex items-center justify-center gap-2"
          >
            <ShieldCheck size={14} className="text-sky-400" />
            <span>Control QA/QC</span>
          </button>

          {/* Reporte Resumen — Estilo Violeta Eléctrico Neón */}
          <button
            onClick={() => setActiveModal('reporte')}
            className="px-4 py-2 bg-violet-500/10 border border-violet-500/40 hover:bg-violet-500/20 hover:border-violet-400 text-violet-400 text-xs font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.12)] rounded-lg flex items-center justify-center gap-2"
          >
            <Activity size={14} className="text-violet-400" />
            <span>Reporte Resumen</span>
          </button>

          {/* Importar Excel — Estilo Esmeralda Neón */}
          <button
            onClick={() => setActiveModal('import_excel')}
            className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 text-emerald-400 text-xs font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.12)] rounded-lg flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            <span>Importar Excel</span>
          </button>

          {/* Exportar Excel — Estilo Esmeralda Neón */}
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 text-emerald-400 text-xs font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.12)] rounded-lg flex items-center justify-center gap-2"
          >
            <Download size={14} className="text-emerald-400" />
            <span>Exportar Excel</span>
          </button>

          {/* Nueva Fila — Estilo Violeta Eléctrico Neón */}
          <button
            onClick={handleAddRow}
            className="px-4 py-2 bg-violet-500/10 border border-violet-500/40 hover:bg-violet-500/20 hover:border-violet-400 text-violet-400 text-xs font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.12)] rounded-lg flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            <span>Nueva Fila</span>
          </button>
        </div>
      </div>

      {/* HORIZONTAL SCROLLABLE GRID */}
      <div className="overflow-x-auto relative rounded-lg border border-navy-700 bg-navy-950/20">
        <table className="w-max min-w-full border-collapse border-separate border-spacing-0" style={{ minWidth: '3500px' }}>
          <thead>
            <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-navy-800">
              <th className="py-3 px-2 text-center sticky left-0 bg-navy-950 z-20 border-r border-b border-navy-800 w-12 min-w-[48px]">#</th>
              {COLS.map(c => (
                <th
                  key={c.key}
                  style={{ width: c.width, minWidth: c.width }}
                  className={`py-3 px-2 text-center border-r border-b border-navy-800 text-[10px] select-none font-bold uppercase tracking-wider ${c.important ? "text-cyan-400" :
                    c.computed ? "text-slate-500" : "text-slate-400"
                    }`}
                >
                  {c.label}
                </th>
              ))}
              <th className="py-3 px-2 text-center sticky right-0 bg-navy-950 z-20 border-l border-b border-navy-800 w-[75px] min-w-[75px]">Acción</th>
            </tr>
          </thead>

          <tbody>
            {computedRows.map((row, idx) => {
              const isEven = idx % 2 === 0;
              const rowBg = isEven ? "bg-navy-900/5" : "bg-navy-950/20";

              return (
                <tr key={row.id} className={`${rowBg} transition-colors border-b border-navy-900/20 hover:bg-navy-900/10`}>
                  <td className="sticky left-0 bg-navy-950 text-center text-slate-500 font-mono font-bold text-[10px] py-1 border-r border-b border-navy-800 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.15)] select-none">
                    {idx + 1}
                  </td>

                  {COLS.map(c => {
                    const val = row[c.key];
                    const isCellLocked = (c.key === "celda_mapeo" && filterActiveCell) || c.computed;

                    return (
                      <td
                        key={c.key}
                        style={{ width: c.width, minWidth: c.width }}
                        className="p-0 border-r border-b border-navy-800 cursor-text hover:bg-navy-900/10 transition-colors animate-fade-in"
                      >
                        {isCellLocked ? (
                          (() => {
                            const renderedCell = (
                              <div className={getCellClassName(c, val)}>
                                {formatCellValue(val, c) || (
                                  <span className="text-navy-700/60 font-semibold select-none">—</span>
                                )}
                              </div>
                            );

                            if (c.computed) {
                              let fId = "";
                              let params: Record<string, any> = {};

                              if (c.key === "ancho_w") { fId = "plt_ancho_w"; params = { w1: row.ancho_w1, w2: row.ancho_w2, val }; }
                              else if (c.key === "muestra_valida_longitud") { fId = "plt_valida_long"; params = { l: row.longitud_l, d: row.espesor_d, val }; }
                              else if (c.key === "muestra_valida_ancho") { fId = "plt_valida_ancho"; params = { d: row.espesor_d, w: row.ancho_w, val }; }
                              else if (c.key === "diametro_equivalente") { fId = "plt_diam_equiv"; params = { d: row.espesor_d, w: row.ancho_w, val }; }
                              else if (c.key === "f") { fId = "plt_f_factor"; params = { de: row.diametro_equivalente, val }; }
                              else if (c.key === "is_mpa") { fId = "plt_is_mpa"; params = { p: row.fuerza_p, de: row.diametro_equivalente, val }; }
                              else if (c.key === "is_50") { fId = "plt_is50"; params = { isVal: row.is_mpa, f: row.f, val }; }
                              else if (c.key === "ucs") { fId = "plt_ucs"; params = { is50: row.is_50, k: row.factor_conversion_k, val }; }
                              else if (c.key === "resistencia_isrm") { fId = "plt_isrm"; params = { ucs: row.ucs, val }; }
                              else if (c.key === "denominacion_isrm") { fId = "plt_isrm"; params = { ucs: row.ucs, val }; }

                              if (fId) {
                                return (
                                  <FormulaTooltipTrigger formulaId={fId} params={params} position="top" enabled={showFormulas}>
                                    {renderedCell}
                                  </FormulaTooltipTrigger>
                                );
                              }
                            }

                            return renderedCell;
                          })()
                        ) : (
                          c.type === "select" || c.type === "lito1" || c.type === "lito2" || c.type === "lito3" ? (
                            (() => {
                              let options = c.options || [];
                              if (c.type === "lito1") {
                                options = Array.from(new Set(LITHOLOGY_CLASSIFICATION.map(e => e.unidad)));
                              } else if (c.type === "lito2") {
                                options = getLito2Options(row.litologia_1);
                              } else if (c.type === "lito3") {
                                options = getLito3Options(row.litologia_1, row.litologia_2);
                              }

                              return (
                                <select
                                  value={val ?? ""}
                                  onChange={(e) => handleCommitSelect(row.id, c.key, e.target.value)}
                                  className="bg-transparent text-slate-300 focus:outline-none text-center cursor-pointer w-full text-xs font-semibold py-2 px-1 focus:ring-1 focus:ring-violet-500/50"
                                >
                                  <option value="" className="bg-navy-950 text-slate-500">—</option>
                                  {options.map((o: string) => (
                                    <option key={o} value={o} className="bg-navy-950 text-slate-100">{o}</option>
                                  ))}
                                </select>
                              );
                            })()
                          ) : (
                            <input
                              type={c.type === "date" ? "date" : "text"}
                              value={getInputValue(row.id, c.key, val)}
                              onChange={(e) => {
                                let inputVal = e.target.value;
                                if (c.type === "int" || c.type === "decimal") {
                                  const constraints = getPltConstraints(c.key);
                                  const intDig = constraints ? constraints.intDigits : 5;
                                  const decDig = constraints ? constraints.decDigits : (c.type === "int" ? 0 : 2);

                                  inputVal = handlePltNumberLimit(inputVal, intDig, decDig);

                                  if (c.key === "nivel") {
                                    const parsed = parseFloat(inputVal);
                                    if (!isNaN(parsed) && parsed > 4999) {
                                      inputVal = "4999";
                                    }
                                  }
                                }
                                handleInputChange(row.id, c.key, inputVal);
                              }}
                              onKeyDown={handleGridKeyDown}
                              onBlur={(e) => {
                                handleCommitEdit(row.id, c.key, e.target.value);
                              }}
                              className="w-full bg-transparent text-slate-200 text-center focus:outline-none font-normal text-xs py-2.5 px-2 focus:bg-navy-900/50 focus:ring-1 focus:ring-violet-500/50"
                            />
                          )
                        )}
                      </td>
                    );
                  })}

                  <td className="sticky right-0 bg-navy-950 text-center py-1 px-2 border-l border-b border-navy-800 z-10 w-[75px] min-w-[75px]">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => handleInsertRowBelow(idx)}
                        className="text-slate-500 hover:text-emerald-400 font-black text-sm px-1 transition-colors select-none"
                        title="Insertar fila abajo"
                      >
                        +
                      </button>
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 hover:text-red-400 transition-colors flex items-center justify-center mx-auto active:scale-95"
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
                <td colSpan={COLS.length + 2} className="py-16 text-center text-slate-500 italic bg-navy-950 border-b border-navy-800 text-xs font-semibold select-none">
                  No se registran ensayos PLT para esta vista. Haz clic en "Nueva Fila" para crear uno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

            <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-400">
              {["Campos obligatorios", "L ≥ D", "0.3W < D < W", "Fuerza P > 0", "Factor K", "UCS calc", "Fractura", "Dirección"].map(t => (
                <span key={t} className="bg-navy-950 border border-navy-850 px-2 py-0.5 rounded text-slate-400 font-mono">{t}</span>
              ))}
            </div>

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

            <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-400">
              {["Campos obligatorios", "L ≥ D", "0.3W < D < W", "Fuerza P > 0", "Factor K", "UCS calc", "Fractura", "Dirección"].map(t => (
                <span key={t} className="bg-navy-950 border border-navy-850 px-2 py-0.5 rounded text-slate-400 font-mono">{t}</span>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 space-y-6 pr-1">
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

              {/* METRICAS AVANZADAS PLT (Is, Is50, UCS) con Mínimo, Máximo y Promedio de cada uno */}
              <div className="space-y-4">
                <div className="bg-navy-950/40 border border-teal-500/20 bg-gradient-to-br from-teal-500/[0.03] to-transparent p-4 rounded-xl space-y-3 shadow-[0_4px_20px_rgba(20,184,166,0.02)]">
                  <div className="flex items-center justify-between border-b border-navy-800/80 pb-2">
                    <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest block">Índice Is — Carga Puntual No Corregido</span>
                    <span className="text-[9px] bg-teal-500/10 border border-teal-500/30 text-teal-400 font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">Is (MPa)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-rose-500/[0.02] border border-rose-500/10 p-3 rounded-lg flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] text-rose-400/70 font-bold uppercase tracking-wider mb-1">Mínimo</span>
                      <span className="font-mono font-bold text-rose-300 text-sm">{reportStats.isMin !== null ? reportStats.isMin.toFixed(4) : "—"}</span>
                    </div>
                    <div className="bg-emerald-500/[0.02] border border-emerald-500/10 p-3 rounded-lg flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wider mb-1">Máximo</span>
                      <span className="font-mono font-bold text-emerald-300 text-sm">{reportStats.isMax !== null ? reportStats.isMax.toFixed(4) : "—"}</span>
                    </div>
                    <div className="bg-teal-500/5 border border-teal-500/20 p-3 rounded-lg flex flex-col justify-center items-center text-center shadow-[0_0_15px_rgba(20,184,166,0.03)]">
                      <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider mb-1">Promedio</span>
                      <span className="font-mono font-black text-teal-300 text-sm drop-shadow-[0_0_8px_rgba(20,184,166,0.25)]">{reportStats.isAvg !== null ? reportStats.isAvg.toFixed(4) : "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-navy-950/40 border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.03] to-transparent p-4 rounded-xl space-y-3 shadow-[0_4px_20px_rgba(14,165,233,0.02)]">
                  <div className="flex items-center justify-between border-b border-navy-800/80 pb-2">
                    <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest block">Índice Is(50) — Corregido a 50 mm</span>
                    <span className="text-[9px] bg-sky-500/10 border border-sky-500/30 text-sky-400 font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">Is(50) (MPa)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-rose-500/[0.02] border border-rose-500/10 p-3 rounded-lg flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] text-rose-400/70 font-bold uppercase tracking-wider mb-1">Mínimo</span>
                      <span className="font-mono font-bold text-rose-300 text-sm">{reportStats.is50Min !== null ? reportStats.is50Min.toFixed(4) : "—"}</span>
                    </div>
                    <div className="bg-emerald-500/[0.02] border border-emerald-500/10 p-3 rounded-lg flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wider mb-1">Máximo</span>
                      <span className="font-mono font-bold text-emerald-300 text-sm">{reportStats.is50Max !== null ? reportStats.is50Max.toFixed(4) : "—"}</span>
                    </div>
                    <div className="bg-sky-500/5 border border-sky-500/20 p-3 rounded-lg flex flex-col justify-center items-center text-center shadow-[0_0_15px_rgba(14,165,233,0.03)]">
                      <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider mb-1">Promedio</span>
                      <span className="font-mono font-black text-sky-300 text-sm drop-shadow-[0_0_8px_rgba(14,165,233,0.25)]">{reportStats.is50Avg !== null ? reportStats.is50Avg.toFixed(4) : "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-navy-950/40 border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.03] to-transparent p-4 rounded-xl space-y-3 shadow-[0_4px_20px_rgba(245,158,11,0.02)]">
                  <div className="flex items-center justify-between border-b border-navy-800/80 pb-2">
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">Resistencia UCS Estimada</span>
                    <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">UCS (MPa)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-rose-500/[0.02] border border-rose-500/10 p-3 rounded-lg flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] text-rose-400/70 font-bold uppercase tracking-wider mb-1">Mínimo</span>
                      <span className="font-mono font-bold text-rose-300 text-sm">{reportStats.ucsMin !== null ? reportStats.ucsMin.toFixed(2) : "—"}</span>
                    </div>
                    <div className="bg-emerald-500/[0.02] border border-emerald-500/10 p-3 rounded-lg flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wider mb-1">Máximo</span>
                      <span className="font-mono font-bold text-emerald-300 text-sm">{reportStats.ucsMax !== null ? reportStats.ucsMax.toFixed(2) : "—"}</span>
                    </div>
                    <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg flex flex-col justify-center items-center text-center shadow-[0_0_15px_rgba(245,158,11,0.03)]">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">Promedio</span>
                      <span className="font-mono font-black text-amber-300 text-sm drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]">{reportStats.ucsAvg !== null ? reportStats.ucsAvg.toFixed(2) : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-navy-950/40 border border-navy-800 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest border-b border-navy-800 pb-2">Clasificación ISRM</h4>
                  <div className="space-y-2">
                    {(() => {
                      const isrmColors: Record<string, string> = {
                        R0: "bg-rose-500/60 shadow-[0_0_8px_rgba(239,68,68,0.25)]",
                        R1: "bg-orange-500/60 shadow-[0_0_8px_rgba(249,115,22,0.25)]",
                        R2: "bg-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.25)]",
                        R3: "bg-yellow-500/60 shadow-[0_0_8px_rgba(234,179,8,0.25)]",
                        R4: "bg-emerald-500/60 shadow-[0_0_8_rgba(16,185,129,0.25)]",
                        R5: "bg-cyan-500/60 shadow-[0_0_8_rgba(6,182,212,0.25)]",
                        R6: "bg-blue-500/60 shadow-[0_0_8_rgba(59,130,246,0.25)]"
                      };
                      return ISRM_TABLE.map(row => {
                        const count = reportStats.isrmCnt[row.indice] || 0;
                        const pct = reportStats.total > 0 ? (count / reportStats.total) * 100 : 0;
                        return (
                          <div key={row.indice} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-slate-400">
                              <span>{row.indice} ({row.denominacion})</span>
                              <span>{count} ({pct.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-navy-950 border border-navy-900 rounded-full h-2.5 overflow-hidden">
                              <div className={`h-full rounded-full ${isrmColors[row.indice] || "bg-slate-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📥 EXCEL IMPORT MODAL DE ACOPLAMIENTO MODULAR */}
      <PltExcelImportModal
        isOpen={activeModal === 'import_excel'}
        onClose={() => setActiveModal(null)}
        onImport={(importedRows) => {
          onChange([...pltEnsayos, ...importedRows]);
          alert(`Importación exitosa: se han añadido ${importedRows.length} registros a Ensayos PLT.`);
        }}
        activeWindowCelda={activeWindowCelda}
      />
    </div>
  );
}