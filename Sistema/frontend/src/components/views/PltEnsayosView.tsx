import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Activity,
  Plus,
  Trash2,
  BarChart3,
  X,
  Filter,
  ChevronDown,
  TrendingUp,
  Info,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Calculator
} from 'lucide-react';
import { FormulaTooltipTrigger } from '../Common/FormulaTooltip';
import PltExcelImportModal from '../modals/PltExcelImportModal';
import { VirtualizedGrid, type CellAlertInfo } from '../../features/grid';
import { LITHOLOGY_CLASSIFICATION } from '../../utils/catalogData';
import type { WindowHeader } from '../../utils/rmrCalculator';
import type { QaQcAlert } from '../../utils/qaQcRules';
import {
  PLT_COLUMN_DEFS as COLS,
  CAT_DIRECCION_ROTURA,
  CAT_TIPO_FRACTURA,
  CAT_TIPO_LITOLOGICO,
  ISRM_TABLE,
  applyLitoCascade,
  applyPltFormulas,
  normalizeCeldaCode,
  getPltConstraints,
  handlePltNumberLimit,
  handleGridKeyDown,
  getCellClassName,
  formatCellValue,
  getLito2Options,
  getLito3Options
} from '../../utils/geomecColumns';

interface PltEnsayosViewProps {
  pltEnsayos: any[];
  onChange: (rows: any[]) => void;
  activeWindowCelda: string | null;
  activeHeader?: WindowHeader | null;
  alerts?: QaQcAlert[];
  showFormulas?: boolean;
  knownCells?: string[];
  /** Handler único de import (App: agrega, persiste y cambia la vista si aplica). */
  onImportToCell?: (celda: string, rows: any[]) => void;
}

interface PltFilterState {
  codigoMuestra: string;
  fechaDesde: string;
  fechaHasta: string;
  campana: string;
  sector: string;
  tipoLito: string;
  lito1: string;
  nivel: string;
  ucsMin: string;
  ucsMax: string;
  is50Min: string;
  is50Max: string;
  isrm: string;
}

const INITIAL_FILTERS: PltFilterState = {
  codigoMuestra: '',
  fechaDesde: '',
  fechaHasta: '',
  campana: '',
  sector: '',
  tipoLito: '',
  lito1: '',
  nivel: '',
  ucsMin: '',
  ucsMax: '',
  is50Min: '',
  is50Max: '',
  isrm: ''
};

export default function PltEnsayosView({
  pltEnsayos,
  onChange,
  activeWindowCelda,
  activeHeader = null,
  alerts = [],
  showFormulas = true,
  knownCells = [],
  onImportToCell
}: PltEnsayosViewProps) {
  const [filterActiveCell, setFilterActiveCell] = useState(true);

  // ── Filtros avanzados (Borrador vs Aplicado) ──
  const [draftFilters, setDraftFilters] = useState<PltFilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<PltFilterState>(INITIAL_FILTERS);

  const [activeModal, setActiveModal] = useState<'reporte' | 'import_excel' | null>(null);
  const [editCell, setEditCell] = useState<{ id: number; key: string } | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const visibleCols = useMemo(() => COLS.filter(c => !c.hidden), []);

  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters });
  };

  const handleClearFilters = () => {
    setDraftFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
  };

  const hasActiveFilters = useMemo(() => {
    return Object.values(appliedFilters).some(v => typeof v === 'string' && v.trim() !== '');
  }, [appliedFilters]);

  const activeFilterCount = useMemo(() => {
    return Object.values(appliedFilters).filter(v => typeof v === 'string' && v.trim() !== '').length;
  }, [appliedFilters]);

  const hasDraftChanges = useMemo(() => {
    return JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters);
  }, [draftFilters, appliedFilters]);

  const createEmptyRow = (customId?: number, prefillCelda?: string, letter?: string) => {
    const celdaTarget = (
      prefillCelda || (filterActiveCell && activeWindowCelda ? activeWindowCelda : "")
    ).trim().toUpperCase();
    const hdr =
      activeHeader && (!celdaTarget || normalizeCeldaCode(activeHeader.celda) === normalizeCeldaCode(celdaTarget))
        ? activeHeader
        : null;
    const muestraLetter = letter ? letter.trim().toUpperCase() : "";
    const hdrNivelRaw = hdr?.nivel !== undefined && hdr?.nivel !== null && String(hdr.nivel).trim() !== ""
      ? Number(hdr.nivel)
      : null;

    return applyPltFormulas({
      id: customId || Date.now(),
      campana: hdr?.campania || new Date().getFullYear(),
      fecha_ensayo: new Date().toISOString().split("T")[0],
      sector_geotecnico: hdr?.sect_geot || "",
      ejecutado_por: "",
      zona_mapeo: "",
      tipo_ensayo: "i",
      nivel: hdrNivelRaw !== null && Number.isFinite(hdrNivelRaw) ? hdrNivelRaw : null,
      celda_mapeo: celdaTarget,
      muestra: muestraLetter,
      codigo_muestra: celdaTarget && muestraLetter ? `${celdaTarget}${muestraLetter}` : "",
      litologia_1: hdr?.lito_1 || "",
      litologia_2: hdr?.lito_2 || "",
      litologia_3: hdr?.lito_3 || "",
      tipo_litologico: "",
      este: null,
      norte: null,
      elevacion: null,
      espesor_d: null,
      longitud_l: null,
      ancho_w1: null,
      ancho_w2: null,
      fuerza_p: null,
      direccion_rotura: "",
      tipo_fractura: "",
      factor_conversion_k: null,
      observaciones: "",
      _dirty: true
    });
  };

  const handleAddRow = () => {
    const maxId = pltEnsayos.reduce((mx, r) => Math.max(mx, Number(r?.id) || 0), Date.now());
    const newRow = createEmptyRow(maxId + 1);
    onChange([...pltEnsayos, newRow]);
  };

  const handleGenerate4Samples = () => {
    const targetCelda = (activeWindowCelda || activeHeader?.celda || "").trim().toUpperCase();
    if (!targetCelda) {
      alert("Seleccione o cree una celda de mapeo antes de generar las 4 muestras A, B, C, D.");
      return;
    }
    const targetNorm = normalizeCeldaCode(targetCelda);
    const existingForCell = pltEnsayos.filter(r => {
      const c = String(r?.celda_mapeo || "").trim();
      return !c || normalizeCeldaCode(c) === targetNorm;
    });
    const existingLetters = new Set(
      existingForCell.map(r => String(r?.muestra || "").trim().toUpperCase()).filter(Boolean)
    );
    const missingLetters = (["A", "B", "C", "D"] as const).filter(l => !existingLetters.has(l));
    if (missingLetters.length === 0) {
      alert(`La celda ${targetCelda} ya tiene registradas las 4 muestras obligatorias (A, B, C y D).`);
      return;
    }
    const baseId = pltEnsayos.reduce((mx, r) => Math.max(mx, Number(r?.id) || 0), Date.now());
    const newRows = missingLetters.map((letter, idx) =>
      createEmptyRow(baseId + idx + 1, targetCelda, letter)
    );
    onChange([...pltEnsayos, ...newRows]);
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

  // ── Pipeline: primero calcular fórmulas, luego filtrar sólo con appliedFilters ──
  const allComputedRows = useMemo(() => {
    return pltEnsayos.map(r => applyPltFormulas(r));
  }, [pltEnsayos]);

  const computedRows = useMemo(() => {
    let rows = allComputedRows;
    const f = appliedFilters;

    if (f.codigoMuestra.trim()) {
      const term = f.codigoMuestra.trim().toUpperCase();
      rows = rows.filter(r =>
        (r.codigo_muestra || '').toUpperCase().includes(term) ||
        (r.muestra || '').toUpperCase().includes(term) ||
        (r.celda_mapeo || '').toUpperCase().includes(term)
      );
    }
    if (f.fechaDesde) rows = rows.filter(r => r.fecha_ensayo >= f.fechaDesde);
    if (f.fechaHasta) rows = rows.filter(r => r.fecha_ensayo <= f.fechaHasta);
    if (f.campana) rows = rows.filter(r => String(r.campana) === f.campana);
    if (f.sector.trim()) rows = rows.filter(r => (r.sector_geotecnico || '').toUpperCase().includes(f.sector.trim().toUpperCase()));
    if (f.tipoLito) rows = rows.filter(r => r.tipo_litologico === f.tipoLito);
    if (f.lito1) rows = rows.filter(r => r.litologia_1 === f.lito1);
    if (f.nivel.trim()) {
      const nv = parseFloat(f.nivel.trim());
      if (!isNaN(nv)) rows = rows.filter(r => r.nivel !== null && Math.abs(Number(r.nivel) - nv) < 0.5);
    }
    if (f.ucsMin) { const v = parseFloat(f.ucsMin); if (!isNaN(v)) rows = rows.filter(r => typeof r.ucs === 'number' && r.ucs >= v); }
    if (f.ucsMax) { const v = parseFloat(f.ucsMax); if (!isNaN(v)) rows = rows.filter(r => typeof r.ucs === 'number' && r.ucs <= v); }
    if (f.is50Min) { const v = parseFloat(f.is50Min); if (!isNaN(v)) rows = rows.filter(r => typeof r.is_50 === 'number' && r.is_50 >= v); }
    if (f.is50Max) { const v = parseFloat(f.is50Max); if (!isNaN(v)) rows = rows.filter(r => typeof r.is_50 === 'number' && r.is_50 <= v); }
    if (f.isrm) rows = rows.filter(r => r.resistencia_isrm === f.isrm);

    return rows;
  }, [allComputedRows, appliedFilters]);

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
        let updatedRow = { ...r, [key]: val, _dirty: true };
        return applyPltFormulas(updatedRow);
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
        return applyPltFormulas({ ...cascade, _dirty: true });
      }
      return r;
    });
    onChange(updated);
  };

  const reportStats = useMemo(() => {
    const rr = computedRows;
    const total = rr.length;

    // Helpers estadísticos
    const avg = (arr: number[]) => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0;
    const median = (arr: number[]): number | null => {
      if (!arr.length) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const stdDev = (arr: number[], mean: number): number => {
      if (arr.length < 2) return 0;
      return Math.sqrt(arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (arr.length - 1));
    };
    const cvPct = (arr: number[]): number | null => {
      if (arr.length < 2) return null;
      const m = avg(arr);
      return m !== 0 ? (stdDev(arr, m) / Math.abs(m)) * 100 : null;
    };

    // Desglose por Tipo de Rotura: únicamente M (matriz) representa roca intacta
    const fracM = rr.filter(r => String(r?.tipo_fractura || '').trim().toUpperCase() === 'M');
    const fracECount = rr.filter(r => String(r?.tipo_fractura || '').trim().toUpperCase() === 'E').length;
    const fracCCount = rr.filter(r => String(r?.tipo_fractura || '').trim().toUpperCase() === 'C').length;
    const fracOtherCount = total - fracM.length - fracECount - fracCCount;
    const intactRows = fracM;
    const intactCount = intactRows.length;

    // Arrays numéricos de resistencia calculados EXCLUSIVAMENTE sobre Tipo M (Roca Intacta)
    const ucsV = intactRows.filter(r => typeof r.ucs === 'number' && r.ucs !== null).map(r => r.ucs as number);
    const isV = intactRows.filter(r => typeof r.is_mpa === 'number' && r.is_mpa !== null).map(r => r.is_mpa as number);
    const is50V = intactRows.filter(r => typeof r.is_50 === 'number' && r.is_50 !== null).map(r => r.is_50 as number);
    const kV = intactRows.filter(r => typeof r.factor_conversion_k === 'number' && r.factor_conversion_k !== null).map(r => r.factor_conversion_k as number);

    // Validez geométrica sobre el total de probetas ensayadas
    const valL = rr.filter(r => r.muestra_valida_longitud === 'SÍ').length;
    const valA = rr.filter(r => r.muestra_valida_ancho === 'SÍ').length;
    const bothValid = rr.filter(r => r.muestra_valida_longitud === 'SÍ' && r.muestra_valida_ancho === 'SÍ').length;

    // Distribuciones de resistencia intacta (Tipo M)
    const isrmCnt: Record<string, number> = {};
    ISRM_TABLE.forEach(r => { isrmCnt[r.indice] = 0; });
    intactRows.forEach(r => { if (r.resistencia_isrm) isrmCnt[r.resistencia_isrm] = (isrmCnt[r.resistencia_isrm] || 0) + 1; });

    const tipoCnt: Record<string, number> = {};
    intactRows.forEach(r => { if (r.tipo_litologico) tipoCnt[r.tipo_litologico] = (tipoCnt[r.tipo_litologico] || 0) + 1; });

    const sectorCnt: Record<string, number> = {};
    intactRows.forEach(r => { const s = (r.sector_geotecnico || '').trim(); if (s) sectorCnt[s] = (sectorCnt[s] || 0) + 1; });

    const sectorCount = new Set(intactRows.map(r => (r.sector_geotecnico || '').trim()).filter(Boolean)).size;
    const litoCount = new Set(intactRows.map(r => (r.tipo_litologico || '').trim()).filter(Boolean)).size;

    return {
      total,
      totalUnfiltered: allComputedRows.length,
      intactCount,
      fracMCount: fracM.length,
      fracECount,
      fracCCount,
      fracOtherCount,
      valL, valA, bothValid,
      bothValidPct: total > 0 ? (bothValid / total) * 100 : 0,

      ucsMin: ucsV.length ? Math.min(...ucsV) : null,
      ucsMax: ucsV.length ? Math.max(...ucsV) : null,
      ucsAvg: ucsV.length ? avg(ucsV) : null,
      ucsMedian: median(ucsV),
      ucsCv: cvPct(ucsV),
      ucsCount: ucsV.length,

      isMin: isV.length ? Math.min(...isV) : null,
      isMax: isV.length ? Math.max(...isV) : null,
      isAvg: isV.length ? avg(isV) : null,
      isMedian: median(isV),
      isCv: cvPct(isV),

      is50Min: is50V.length ? Math.min(...is50V) : null,
      is50Max: is50V.length ? Math.max(...is50V) : null,
      is50Avg: is50V.length ? avg(is50V) : null,
      is50Median: median(is50V),
      is50Cv: cvPct(is50V),
      is50Count: is50V.length,

      kMin: kV.length ? Math.min(...kV) : null,
      kMax: kV.length ? Math.max(...kV) : null,
      kAvg: kV.length ? avg(kV) : null,
      kMedian: median(kV),

      isrmCnt, tipoCnt, sectorCnt, sectorCount, litoCount,
    };
  }, [computedRows, allComputedRows]);

  const handleExportExcel = () => {
    const dataToExport = computedRows.map((r, idx) => {
      const obj: Record<string, any> = { "#": idx + 1 };
      COLS.forEach(c => {
        obj[c.label] = r[c.key] ?? "";
      });
      return obj;
    });

    const summaryRows = [
      { Indicador: "Total ensayos PLT filtrados", Valor: reportStats.total, Unidad: "registros", Criterio: "Todos los tipos de rotura" },
      { Indicador: "Tipo de Rotura M (Matriz - Roca Intacta)", Valor: reportStats.fracMCount, Unidad: "registros", Criterio: "Único tipo incorporado a estimaciones Is/Is(50)/UCS" },
      { Indicador: "Tipo de Rotura E (Estructura - Excluido)", Valor: reportStats.fracECount, Unidad: "registros", Criterio: "Excluido de resistencia intacta" },
      { Indicador: "Tipo de Rotura C (Combinada - Excluido)", Valor: reportStats.fracCCount, Unidad: "registros", Criterio: "Excluido de resistencia intacta" },
      { Indicador: "Sin clasificar / Otro", Valor: reportStats.fracOtherCount, Unidad: "registros", Criterio: "Excluido hasta clasificar M/E/C" },
      { Indicador: "Muestras válidas geométricas (L >= D y 0.3W < D < W)", Valor: `${reportStats.bothValid} / ${reportStats.total} (${reportStats.bothValidPct.toFixed(1)}%)`, Unidad: "%", Criterio: "ASTM / ISRM" },
      { Indicador: "Is Promedio (Solo Tipo M)", Valor: reportStats.isAvg !== null ? Number(reportStats.isAvg.toFixed(4)) : "", Unidad: "MPa", Criterio: "Solo rotura M" },
      { Indicador: "Is(50) Promedio (Solo Tipo M)", Valor: reportStats.is50Avg !== null ? Number(reportStats.is50Avg.toFixed(4)) : "", Unidad: "MPa", Criterio: "Solo rotura M" },
      { Indicador: "UCS Promedio (Solo Tipo M)", Valor: reportStats.ucsAvg !== null ? Number(reportStats.ucsAvg.toFixed(2)) : "", Unidad: "MPa", Criterio: "Solo rotura M" },
      { Indicador: "UCS Mediana (Solo Tipo M)", Valor: reportStats.ucsMedian !== null ? Number(reportStats.ucsMedian.toFixed(2)) : "", Unidad: "MPa", Criterio: "Solo rotura M" },
      { Indicador: "Factor K Promedio (Solo Tipo M)", Valor: reportStats.kAvg !== null ? Number(reportStats.kAvg.toFixed(2)) : "", Unidad: "adimensional", Criterio: "Según litología declarada" },
      ...ISRM_TABLE.map(row => ({
        Indicador: `Distribución ISRM ${row.indice} (${row.denominacion})`,
        Valor: reportStats.isrmCnt[row.indice] || 0,
        Unidad: "muestras M",
        Criterio: `${row.minUcs} - ${Number.isFinite(row.maxUcs) ? row.maxUcs : "∞"} MPa`,
      })),
    ];

    const formulaRows = [
      { Parametro: "Ancho equivalente (W)", Formula: "W = (W1 + W2) / 2", Unidad: "cm", Criterio_Normativo: "Promedio de anchos W1 y W2 de muestra irregular." },
      { Parametro: "Criterio geométrico bloque irregular", Formula: "0.3W < D < W  y  L >= D", Unidad: "cm", Criterio_Normativo: "Distancia mínima al borde = 0.5D; Is(50) solo se calcula si 0.3W < D < W." },
      { Parametro: "Diámetro equivalente (De)", Formula: "De = sqrt(4 * D * W / pi)", Unidad: "cm", Criterio_Normativo: "Reproducibilidad admitida ±0.005 cm por redondeo." },
      { Parametro: "Factor de corrección por tamaño (F)", Formula: "F = (De_mm / 50)^0.45", Unidad: "adimensional", Criterio_Normativo: "De_mm = De (cm) * 10; denominador 50 mm." },
      { Parametro: "Índice de carga puntual sin corrección (Is)", Formula: "Is = (P * 1000) / De_mm^2", Unidad: "MPa", Criterio_Normativo: "P en kN convertido a N (*1000)." },
      { Parametro: "Índice de carga puntual corregido (Is50)", Formula: "Is(50) = F * Is", Unidad: "MPa", Criterio_Normativo: "Condicionado a cumplimiento 0.3W < D < W." },
      { Parametro: "Resistencia a Compresión Simple (RCS / UCS)", Formula: "RCS = Is(50) * K", Unidad: "MPa", Criterio_Normativo: "K según litología declarada; solo Tipo M para roca intacta." },
      { Parametro: "Control de Carga aplicada (P)", Formula: "55 < P <= 60 kN (Precaución) ; P > 60 kN (Verificación)", Unidad: "kN", Criterio_Normativo: "P > 60 kN exige comentario obligatorio en Observaciones." },
    ];

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const wsFormulas = XLSX.utils.json_to_sheet(formulaRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PLT Irregulares");
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Roca Intacta (M)");
    XLSX.utils.book_append_sheet(wb, wsFormulas, "Fórmulas y Criterios");
    XLSX.writeFile(wb, "plt_ensayos_irregulares.xlsx");
  };

  // Mapeo de índices originales y alertas QA/QC para resaltado por celda y foco
  const rowIndexById = useMemo(() => {
    const map = new Map<number, number>();
    pltEnsayos.forEach((r, idx) => {
      const idNum = Number(r?.id);
      if (Number.isFinite(idNum)) {
        map.set(idNum, idx);
      }
    });
    return map;
  }, [pltEnsayos]);

  const alertsByRowId = useMemo(() => {
    const map = new Map<number, Record<string, CellAlertInfo>>();
    if (!Array.isArray(alerts) || alerts.length === 0) return map;

    const rank: Record<'CRITICA' | 'VACIO' | 'ADVERTENCIA', number> = {
      CRITICA: 3,
      VACIO: 2,
      ADVERTENCIA: 1,
    };

    for (const al of alerts) {
      if (!al?.fieldId || !al.fieldId.startsWith('plt-')) continue;
      const m = /^plt-(.+)-(\d+)$/.exec(al.fieldId);
      if (!m) continue;
      const colKey = m[1];
      const origIdx = Number(m[2]);
      const targetRow = pltEnsayos[origIdx];
      if (!targetRow) continue;
      const rowId = Number(targetRow.id);
      if (!Number.isFinite(rowId)) continue;

      let recAlerts = map.get(rowId);
      if (!recAlerts) {
        recAlerts = {};
        map.set(rowId, recAlerts);
      }
      const existing = recAlerts[colKey];
      const sev: 'CRITICA' | 'VACIO' | 'ADVERTENCIA' =
        al.type === 'CRITICA' ? 'CRITICA' : al.type === 'VACIO' ? 'VACIO' : 'ADVERTENCIA';
      if (!existing) {
        recAlerts[colKey] = { severity: sev, messages: [al.message] };
      } else {
        const nextSev = rank[sev] > rank[existing.severity] ? sev : existing.severity;
        const msgs = existing.messages.includes(al.message) ? existing.messages : [...existing.messages, al.message];
        recAlerts[colKey] = { severity: nextSev, messages: msgs };
      }
    }
    return map;
  }, [alerts, pltEnsayos]);

  return (
    <div className="space-y-6 select-none animate-fade-in text-left">
      {/* Header Toolbar */}
      <div className="glass-panel p-4 rounded-xl border border-navy-800 bg-navy-950/40 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
            <span>Ensayos PLT Irregulares</span>
          </h2>
          <span className="text-xs bg-violet-500/10 border border-violet-500/30 text-violet-300 font-extrabold px-3 py-1 rounded-lg flex items-center gap-1.5">
            <span>Celda Activa:</span>
            <span className="text-amber-400 font-mono">{activeWindowCelda || "Sin Celda Seleccionada"}</span>
          </span>
          <span className="text-xs bg-navy-900 border border-navy-800 text-slate-300 font-bold px-3 py-1 rounded-full">
            {hasActiveFilters ? `${computedRows.length} / ${pltEnsayos.length}` : pltEnsayos.length} ensayos PLT
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveModal('reporte')}
            className="px-4 py-2 bg-violet-500/10 border border-violet-500/40 hover:bg-violet-500/20 hover:border-violet-400 text-violet-300 text-xs font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.12)] rounded-lg flex items-center justify-center gap-2"
          >
            <Activity size={14} className="text-violet-400" />
            <span>Reporte Resumen</span>
          </button>

          <button
            onClick={() => setActiveModal('import_excel')}
            className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 text-emerald-300 text-xs font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.12)] rounded-lg flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            <span>Importar Excel</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 text-emerald-300 text-xs font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.12)] rounded-lg flex items-center justify-center gap-2"
          >
            <Download size={14} className="text-emerald-400" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={handleGenerate4Samples}
            className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/40 hover:bg-cyan-500/20 hover:border-cyan-400 text-cyan-300 text-xs font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(6,182,212,0.12)] rounded-lg flex items-center justify-center gap-2"
            title="Generar muestras obligatorias A, B, C y D para la celda activa"
          >
            <Plus size={14} className="text-cyan-400" />
            <span>Generar 4 muestras (A–D)</span>
          </button>

          <button
            onClick={handleAddRow}
            className="px-4 py-2 bg-violet-500/10 border border-violet-500/40 hover:bg-violet-500/20 hover:border-violet-400 text-violet-300 text-xs font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.12)] rounded-lg flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            <span>Nueva Fila</span>
          </button>
        </div>
      </div>

      {/* ── FILTROS AVANZADOS ── */}
      <details className="group" open>
        <summary className="flex items-center gap-2 text-xs text-slate-400 font-semibold cursor-pointer hover:text-slate-200 transition-all select-none list-none">
          <Filter size={14} className="text-violet-400" />
          <span>Filtros avanzados</span>
          {hasActiveFilters && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 text-xs font-bold">
              {activeFilterCount} activos
            </span>
          )}
          {hasDraftChanges && (
            <span className="ml-1 px-2 py-0.5 rounded-md bg-navy-900 border border-navy-700 text-slate-400 text-xs font-medium">
              Sin aplicar
            </span>
          )}
          <ChevronDown size={12} className="group-open:rotate-180 transition-transform text-slate-400" />
        </summary>

        <div className="mt-3 p-5 bg-navy-950/70 backdrop-blur-md border border-navy-800 rounded-2xl space-y-4 shadow-2xl">
          {/* SECCIÓN 1: Búsqueda e Identificación */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2 pb-1 border-b border-navy-800/80">
              <Search size={13} className="text-violet-400" />
              <span>Identificación & Búsqueda</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* CÓDIGO MUESTRA (PRIMERA FILA - PRIMERA POSICIÓN) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Código Muestra <span className="text-violet-400/80 font-normal">(búsqueda)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ej: AG57A..."
                    value={draftFilters.codigoMuestra}
                    onChange={e => setDraftFilters({ ...draftFilters, codigoMuestra: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') handleApplyFilters(); }}
                    className="w-full bg-navy-900 border border-violet-500/40 focus:border-violet-400 focus:ring-1 focus:ring-violet-400 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition-all font-semibold"
                  />
                  <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-400/60 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Fecha desde</label>
                <input
                  type="date"
                  value={draftFilters.fechaDesde}
                  onChange={e => setDraftFilters({ ...draftFilters, fechaDesde: e.target.value })}
                  className="w-full bg-navy-900 border border-navy-700/70 focus:border-violet-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Fecha hasta</label>
                <input
                  type="date"
                  value={draftFilters.fechaHasta}
                  onChange={e => setDraftFilters({ ...draftFilters, fechaHasta: e.target.value })}
                  className="w-full bg-navy-900 border border-navy-700/70 focus:border-violet-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Campaña</label>
                <select
                  value={draftFilters.campana}
                  onChange={e => setDraftFilters({ ...draftFilters, campana: e.target.value })}
                  className="w-full bg-navy-900 border border-navy-700/70 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 transition-all"
                >
                  <option value="">Todas las campañas</option>
                  {["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028"].map(y => (
                    <option key={y} value={y} className="bg-navy-950">{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Geología y Ubicación */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2 pb-1 border-b border-navy-800/80">
              <Activity size={13} className="text-teal-400" />
              <span>Geología & Ubicación</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Sector Geotécnico</label>
                <input
                  type="text"
                  placeholder="NW1_B, E1..."
                  value={draftFilters.sector}
                  onChange={e => setDraftFilters({ ...draftFilters, sector: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleApplyFilters(); }}
                  className="w-full bg-navy-900 border border-navy-700/70 focus:border-teal-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Unidad Litológica</label>
                <select
                  value={draftFilters.tipoLito}
                  onChange={e => setDraftFilters({ ...draftFilters, tipoLito: e.target.value })}
                  className="w-full bg-navy-900 border border-navy-700/70 focus:border-teal-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 transition-all"
                >
                  <option value="">Todas las unidades</option>
                  {CAT_TIPO_LITOLOGICO.map(t => (
                    <option key={t} value={t} className="bg-navy-950">{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Litología 1</label>
                <select
                  value={draftFilters.lito1}
                  onChange={e => setDraftFilters({ ...draftFilters, lito1: e.target.value })}
                  className="w-full bg-navy-900 border border-navy-700/70 focus:border-teal-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 transition-all"
                >
                  <option value="">Todas las litologías</option>
                  {Array.from(new Set(LITHOLOGY_CLASSIFICATION.map((it: any) => it.unidad))).sort().map((u: any) => (
                    <option key={u} value={u} className="bg-navy-950">{u}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Nivel</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej: 4200"
                  value={draftFilters.nivel}
                  onChange={e => setDraftFilters({ ...draftFilters, nivel: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleApplyFilters(); }}
                  className="w-full bg-navy-900 border border-navy-700/70 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: Rangos de Resistencia ISRM */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5 pb-1 border-b border-navy-800/80">
              <div className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={13} className="text-sky-400" />
                <span>Rangos de Resistencia ISRM</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-navy-900/60 border border-navy-800 px-2.5 py-0.5 rounded-md select-none">
                <Info size={12} className="text-sky-400/80 shrink-0" />
                <span>
                  <strong className="text-slate-300 font-semibold">Mín</strong> = desde, <strong className="text-slate-300 font-semibold">Máx</strong> = hasta. <span className="text-slate-500 font-normal italic">Ej: Mín 50 y Máx 150 busca entre 50 y 150 MPa</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  UCS Mín <span className="text-slate-400 font-normal">(desde)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ej: 50"
                    value={draftFilters.ucsMin}
                    onChange={e => setDraftFilters({ ...draftFilters, ucsMin: e.target.value.replace(/[^0-9.]/g, '') })}
                    onKeyDown={e => { if (e.key === 'Enter') handleApplyFilters(); }}
                    className="w-full bg-navy-900 border border-violet-500/30 focus:border-violet-400 rounded-lg px-3 pr-9 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition-all font-medium"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-violet-400/80 pointer-events-none">MPa</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  UCS Máx <span className="text-slate-400 font-normal">(hasta)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ej: 150"
                    value={draftFilters.ucsMax}
                    onChange={e => setDraftFilters({ ...draftFilters, ucsMax: e.target.value.replace(/[^0-9.]/g, '') })}
                    onKeyDown={e => { if (e.key === 'Enter') handleApplyFilters(); }}
                    className="w-full bg-navy-900 border border-violet-500/30 focus:border-violet-400 rounded-lg px-3 pr-9 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition-all font-medium"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-violet-400/80 pointer-events-none">MPa</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Is(50) Mín <span className="text-slate-400 font-normal">(desde)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ej: 2"
                    value={draftFilters.is50Min}
                    onChange={e => setDraftFilters({ ...draftFilters, is50Min: e.target.value.replace(/[^0-9.]/g, '') })}
                    onKeyDown={e => { if (e.key === 'Enter') handleApplyFilters(); }}
                    className="w-full bg-navy-900 border border-sky-500/30 focus:border-sky-400 rounded-lg px-3 pr-9 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition-all font-medium"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-sky-400/80 pointer-events-none">MPa</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Is(50) Máx <span className="text-slate-400 font-normal">(hasta)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ej: 8"
                    value={draftFilters.is50Max}
                    onChange={e => setDraftFilters({ ...draftFilters, is50Max: e.target.value.replace(/[^0-9.]/g, '') })}
                    onKeyDown={e => { if (e.key === 'Enter') handleApplyFilters(); }}
                    className="w-full bg-navy-900 border border-sky-500/30 focus:border-sky-400 rounded-lg px-3 pr-9 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition-all font-medium"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-sky-400/80 pointer-events-none">MPa</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Clase ISRM</label>
                <select
                  value={draftFilters.isrm}
                  onChange={e => setDraftFilters({ ...draftFilters, isrm: e.target.value })}
                  className="w-full bg-navy-900 border border-navy-700/70 focus:border-sky-400 rounded-lg px-3 py-1.5 text-xs text-slate-100 transition-all"
                >
                  <option value="">Todas las clases</option>
                  {ISRM_TABLE.map(r => (
                    <option key={r.indice} value={r.indice} className="bg-navy-950">{r.indice} — {r.denominacion}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* BOTONERA Y PIE DE CONSOLA DE FILTROS */}
          <div className="pt-3 border-t border-navy-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400 font-semibold flex items-center gap-2">
              <Info size={14} className="text-slate-500" />
              <span>
                Mostrando <span className="font-mono text-cyan-400 font-bold">{computedRows.length}</span> de <span className="font-mono text-slate-300 font-bold">{allComputedRows.length}</span> ensayos
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(hasActiveFilters || Object.values(draftFilters).some(v => v.trim() !== '')) && (
                <button
                  onClick={handleClearFilters}
                  className="px-3.5 py-1.5 rounded-lg border border-navy-700 text-slate-400 hover:text-slate-200 hover:border-navy-600 transition-all active:scale-95 text-xs font-bold flex items-center gap-1.5 bg-navy-900/60"
                >
                  <RotateCcw size={13} />
                  <span>Limpiar filtros</span>
                </button>
              )}

              <button
                onClick={handleApplyFilters}
                className="bg-indigo-500/10 border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-300 px-5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-[0_0_12px_rgba(99,102,241,0.12)] flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Aplicar filtros</span>
              </button>
            </div>
          </div>
        </div>
      </details>

      {/* Grid Virtualizada Moderna con Editor Flotante, Navegación de Teclado y Paginación (50/100/250) */}
      <VirtualizedGrid
        initialRecords={computedRows}
        rowKey="id"
        height="650px"
        defaultPageSize={50}
        alertsByRowId={alertsByRowId}
        rowIndexById={rowIndexById}
        onChange={(updatedRecords) => {
          if (!hasActiveFilters) {
            onChange(updatedRecords);
            return;
          }
          const currentFilteredIds = new Set(computedRows.map(r => r.id));
          const updatedIds = new Set(updatedRecords.map(r => r.id));
          const updatedMap = new Map(updatedRecords.map(r => [r.id, r]));

          const nextFull = pltEnsayos
            .filter(orig => !currentFilteredIds.has(orig.id) || updatedIds.has(orig.id))
            .map(orig => updatedMap.get(orig.id) || orig);

          for (const r of updatedRecords) {
            if (!pltEnsayos.some(orig => orig.id === r.id)) {
              nextFull.push(r);
            }
          }
          onChange(nextFull);
        }}
        onDeleteRow={(deletedId) => {
          onChange(pltEnsayos.filter(r => r.id !== deletedId));
        }}
      />

      {/* 📊 REPORTE RESUMEN MODAL CON GRÁFICOS INTERACTIVOS SVG */}
      {activeModal === 'reporte' && (
        <div
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-navy-800 shadow-2xl relative overflow-hidden bg-navy-900/95"
          >
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 w-full shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy-800/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-violet-500/10 border border-violet-500/30 text-violet-400 rounded-xl shadow-lg">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                    Reporte Resumen & Dashboard Geotécnico — Ensayos PLT
                  </h3>
                  <p className="text-xs text-slate-400">
                    Estadísticas descriptivas, gráficos de distribución ISRM y control de calidad
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-violet-500/10 border border-violet-500/30 text-violet-300 font-extrabold px-3 py-1 rounded-lg hidden sm:flex items-center gap-1.5">
                  <span>Celda:</span>
                  <span className="text-amber-400 font-mono">{activeWindowCelda || "Sin Celda"}</span>
                </span>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-navy-800 transition-colors"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Banner de aviso cuando hay filtros activos */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between px-4 py-3 bg-violet-500/10 border border-violet-500/30 rounded-xl text-xs text-violet-200 shadow-[0_0_15px_rgba(139,92,246,0.08)]">
                  <div className="flex items-center gap-2.5">
                    <Info size={16} className="text-violet-400 shrink-0" />
                    <span>
                      <strong className="font-extrabold text-violet-300">Filtros Activos:</strong> Mostrando reporte sobre <span className="font-mono text-amber-400 font-bold">{reportStats.total}</span> de <span className="font-mono text-slate-300">{reportStats.totalUnfiltered}</span> ensayos PLT.
                    </span>
                  </div>
                  <button
                    onClick={handleClearFilters}
                    className="text-xs underline text-violet-400 hover:text-violet-200 font-bold transition-colors shrink-0 ml-2"
                  >
                    Restablecer filtros
                  </button>
                </div>
              )}

              {reportStats.total === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                  <BarChart3 size={44} className="text-slate-700 mb-3" />
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Sin ensayos PLT para reportar
                  </p>
                  <p className="text-xs mt-1.5 text-slate-400">
                    {hasActiveFilters ? "Ningún ensayo coincide con los filtros aplicados." : "Agrega filas con 'Nueva Fila' o importa un Excel para ver el resumen."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Banner de Criterio Roca Intacta: Solo Tipo M */}
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5 text-emerald-200">
                      <AlertTriangle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="font-extrabold text-emerald-300">Roca Intacta (Solo Tipo M):</strong>{' '}
                        Los promedios, medianas, ISRM y estimaciones de resistencia se calculan únicamente con ensayos de rotura en Matriz (<strong>M</strong>).
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                        M (Matriz): {reportStats.fracMCount}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                        E (Estructura): {reportStats.fracECount}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 font-bold">
                        C (Combinada): {reportStats.fracCCount}
                      </span>
                      {reportStats.fracOtherCount > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                          Sin clasificar: {reportStats.fracOtherCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 8 KPIs Principales (Con texto >= 12px) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-cyan-500/[0.08] to-transparent border border-cyan-500/20 rounded-xl p-4 text-center shadow-md">
                      <div className="text-2xl font-black text-cyan-400 font-mono">{reportStats.total}</div>
                      <div className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-wider">Total Ensayos</div>
                      <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">{reportStats.intactCount} Tipo M (intacta)</div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500/[0.08] to-transparent border border-amber-500/20 rounded-xl p-4 text-center shadow-md">
                      <div className="text-2xl font-black text-amber-400 font-mono">
                        {reportStats.ucsAvg !== null ? reportStats.ucsAvg.toFixed(1) : '—'} <span className="text-xs font-normal text-amber-400/80">MPa</span>
                      </div>
                      <div className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-wider">UCS Promedio (M)</div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500/[0.05] to-transparent border border-amber-500/30 rounded-xl p-4 text-center shadow-md">
                      <div className="text-2xl font-black text-amber-300 font-mono">
                        {reportStats.ucsMedian !== null ? reportStats.ucsMedian.toFixed(1) : '—'} <span className="text-xs font-normal text-amber-300/80">MPa</span>
                      </div>
                      <div className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-wider">UCS Mediana (M)</div>
                    </div>

                    <div className="bg-gradient-to-br from-sky-500/[0.08] to-transparent border border-sky-500/20 rounded-xl p-4 text-center shadow-md">
                      <div className="text-2xl font-black text-sky-400 font-mono">
                        {reportStats.is50Avg !== null ? reportStats.is50Avg.toFixed(2) : '—'} <span className="text-xs font-normal text-sky-400/80">MPa</span>
                      </div>
                      <div className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-wider">Is(50) Promedio (M)</div>
                    </div>

                    <div className="bg-gradient-to-br from-rose-500/[0.08] to-transparent border border-rose-500/20 rounded-xl p-4 text-center shadow-md">
                      <div className="text-2xl font-black font-mono text-rose-400">
                        {reportStats.ucsCv !== null ? `${reportStats.ucsCv.toFixed(1)}%` : '—'}
                      </div>
                      <div className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-wider">CV% Resistencia (M)</div>
                    </div>

                    <div className="bg-gradient-to-br from-violet-500/[0.08] to-transparent border border-violet-500/20 rounded-xl p-4 text-center shadow-md">
                      <div className="text-2xl font-black text-violet-400 font-mono">{reportStats.sectorCount}</div>
                      <div className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-wider">Sectores (Tipo M)</div>
                    </div>

                    <div className="bg-gradient-to-br from-teal-500/[0.08] to-transparent border border-teal-500/20 rounded-xl p-4 text-center shadow-md">
                      <div className="text-2xl font-black text-teal-400 font-mono">{reportStats.litoCount}</div>
                      <div className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-wider">Tipos Litológicos (M)</div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500/[0.08] to-transparent border border-emerald-500/20 rounded-xl p-4 text-center shadow-md">
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        {reportStats.bothValidPct.toFixed(0)}%
                      </div>
                      <div className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-wider">Muestras Válidas</div>
                    </div>
                  </div>

                  {/* 📊 SECCIÓN DE GRÁFICOS VISUALES: DONUT CHART ISRM & BAR CHART LITOLÓGICO */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Gráfico 1: Donut Chart ISRM SVG */}
                    <div className="bg-navy-950/60 border border-navy-800 p-5 rounded-2xl space-y-4 shadow-xl">
                      <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                        <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
                          <BarChart3 size={15} className="text-violet-400" />
                          <span>Distribución ISRM (Solo Tipo M)</span>
                        </h4>
                        <span className="text-xs font-bold text-slate-400">R0 a R6</span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
                        {/* SVG Donut */}
                        <div className="relative w-40 h-40 shrink-0">
                          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                            {(() => {
                              const isrmColorsHex: Record<string, string> = {
                                R0: '#ef4444',
                                R1: '#f97316',
                                R2: '#f59e0b',
                                R3: '#eab308',
                                R4: '#10b981',
                                R5: '#06b6d4',
                                R6: '#3b82f6'
                              };
                              let cumulativePercent = 0;
                              const radius = 38;
                              const circumference = 2 * Math.PI * radius;

                              return ISRM_TABLE.map(row => {
                                const count = reportStats.isrmCnt[row.indice] || 0;
                                const pct = reportStats.intactCount > 0 ? (count / reportStats.intactCount) : 0;
                                const strokeDasharray = `${pct * circumference} ${circumference}`;
                                const strokeDashoffset = -cumulativePercent * circumference;
                                cumulativePercent += pct;

                                if (count === 0) return null;

                                return (
                                  <circle
                                    key={row.indice}
                                    cx="50"
                                    cy="50"
                                    r={radius}
                                    fill="transparent"
                                    stroke={isrmColorsHex[row.indice] || '#64748b'}
                                    strokeWidth="12"
                                    strokeDasharray={strokeDasharray}
                                    strokeDashoffset={strokeDashoffset}
                                    className="transition-all duration-500 hover:opacity-80"
                                  />
                                );
                              });
                            })()}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                            <span className="text-xl font-black text-slate-100 font-mono">{reportStats.intactCount}</span>
                            <span className="text-xs font-extrabold text-emerald-400 uppercase">Tipo M</span>
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="space-y-1.5 text-xs w-full sm:w-auto">
                          {(() => {
                            const isrmColorsBg: Record<string, string> = {
                              R0: 'bg-rose-500',
                              R1: 'bg-orange-500',
                              R2: 'bg-amber-500',
                              R3: 'bg-yellow-500',
                              R4: 'bg-emerald-500',
                              R5: 'bg-cyan-500',
                              R6: 'bg-blue-500'
                            };

                            return ISRM_TABLE.map(row => {
                              const count = reportStats.isrmCnt[row.indice] || 0;
                              const pct = reportStats.intactCount > 0 ? (count / reportStats.intactCount) * 100 : 0;

                              return (
                                <div key={row.indice} className="flex items-center justify-between gap-3 font-semibold text-slate-300">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${isrmColorsBg[row.indice] || 'bg-slate-500'}`} />
                                    <span>{row.indice} ({row.denominacion})</span>
                                  </div>
                                  <span className="font-mono text-slate-400">{count} ({pct.toFixed(1)}%)</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Gráfico 2: Barras Horizontales Litología */}
                    <div className="bg-navy-950/60 border border-navy-800 p-5 rounded-2xl space-y-4 shadow-xl">
                      <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                        <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
                          <Activity size={15} className="text-teal-400" />
                          <span>Distribución por Unidad Litológica</span>
                        </h4>
                        <span className="text-xs font-bold text-emerald-400">Roca Intacta (M)</span>
                      </div>

                      <div className="space-y-3 py-1">
                        {(() => {
                          const litoPalette = [
                            "bg-gradient-to-r from-violet-600 to-indigo-500",
                            "bg-gradient-to-r from-teal-600 to-emerald-500",
                            "bg-gradient-to-r from-fuchsia-600 to-pink-500",
                            "bg-gradient-to-r from-sky-600 to-blue-500",
                            "bg-gradient-to-r from-amber-600 to-orange-500"
                          ];
                          const entries = Object.entries(reportStats.tipoCnt).sort((a, b) => b[1] - a[1]);

                          if (entries.length === 0) {
                            return <p className="text-xs text-slate-400 italic">Sin ensayos Tipo M con tipo litológico registrado.</p>;
                          }

                          return entries.map(([tipo, count], idx) => {
                            const pct = reportStats.intactCount > 0 ? (count / reportStats.intactCount) * 100 : 0;
                            return (
                              <div key={tipo} className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-300">
                                  <span className="font-mono text-slate-200">{tipo}</span>
                                  <span className="font-mono text-slate-400">{count} ({pct.toFixed(1)}%)</span>
                                </div>
                                <div className="w-full bg-navy-900 border border-navy-800 rounded-full h-3 overflow-hidden p-0.5">
                                  <div
                                    className={`h-full rounded-full ${litoPalette[idx % litoPalette.length]} transition-all duration-500`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Tabla de Estadística Descriptiva Completa */}
                  <div className="bg-navy-950/60 border border-navy-800 rounded-2xl p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                      <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={15} className="text-amber-400" />
                        <span>Estadística Descriptiva de Roca Intacta (Solo Tipo M)</span>
                      </h4>
                      <span className="text-xs text-slate-400 font-mono font-bold">Valores en MPa</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-navy-900 text-slate-300 uppercase text-xs font-extrabold tracking-wider border-b border-navy-800">
                            <th className="py-2.5 px-3">Indicador</th>
                            <th className="py-2.5 px-3 text-center">Mínimo</th>
                            <th className="py-2.5 px-3 text-center">Máximo</th>
                            <th className="py-2.5 px-3 text-center">Promedio</th>
                            <th className="py-2.5 px-3 text-center">Mediana</th>
                            <th className="py-2.5 px-3 text-center">CV %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-navy-900 font-mono text-slate-200">
                          <tr className="hover:bg-navy-900/40">
                            <td className="py-3 px-3 font-bold font-sans text-teal-300">Is (Carga Puntual Brutal)</td>
                            <td className="py-3 px-3 text-center text-rose-300">{reportStats.isMin !== null ? reportStats.isMin.toFixed(4) : "—"}</td>
                            <td className="py-3 px-3 text-center text-emerald-300">{reportStats.isMax !== null ? reportStats.isMax.toFixed(4) : "—"}</td>
                            <td className="py-3 px-3 text-center font-bold text-teal-300">{reportStats.isAvg !== null ? reportStats.isAvg.toFixed(4) : "—"}</td>
                            <td className="py-3 px-3 text-center text-slate-300">{reportStats.isMedian !== null ? reportStats.isMedian.toFixed(4) : "—"}</td>
                            <td className="py-3 px-3 text-center text-rose-400 font-bold">{reportStats.isCv !== null ? `${reportStats.isCv.toFixed(1)}%` : "—"}</td>
                          </tr>
                          <tr className="hover:bg-navy-900/40">
                            <td className="py-3 px-3 font-bold font-sans text-sky-300">Is(50) (Corregido a 50mm)</td>
                            <td className="py-3 px-3 text-center text-rose-300">{reportStats.is50Min !== null ? reportStats.is50Min.toFixed(4) : "—"}</td>
                            <td className="py-3 px-3 text-center text-emerald-300">{reportStats.is50Max !== null ? reportStats.is50Max.toFixed(4) : "—"}</td>
                            <td className="py-3 px-3 text-center font-bold text-sky-300">{reportStats.is50Avg !== null ? reportStats.is50Avg.toFixed(4) : "—"}</td>
                            <td className="py-3 px-3 text-center text-slate-300">{reportStats.is50Median !== null ? reportStats.is50Median.toFixed(4) : "—"}</td>
                            <td className="py-3 px-3 text-center text-rose-400 font-bold">{reportStats.is50Cv !== null ? `${reportStats.is50Cv.toFixed(1)}%` : "—"}</td>
                          </tr>
                          <tr className="hover:bg-navy-900/40">
                            <td className="py-3 px-3 font-bold font-sans text-amber-300">UCS Estimado (MPa)</td>
                            <td className="py-3 px-3 text-center text-rose-300">{reportStats.ucsMin !== null ? reportStats.ucsMin.toFixed(2) : "—"}</td>
                            <td className="py-3 px-3 text-center text-emerald-300">{reportStats.ucsMax !== null ? reportStats.ucsMax.toFixed(2) : "—"}</td>
                            <td className="py-3 px-3 text-center font-black text-amber-300">{reportStats.ucsAvg !== null ? reportStats.ucsAvg.toFixed(2) : "—"}</td>
                            <td className="py-3 px-3 text-center font-bold text-amber-300/90">{reportStats.ucsMedian !== null ? reportStats.ucsMedian.toFixed(2) : "—"}</td>
                            <td className="py-3 px-3 text-center text-rose-400 font-extrabold">{reportStats.ucsCv !== null ? `${reportStats.ucsCv.toFixed(1)}%` : "—"}</td>
                          </tr>
                          <tr className="hover:bg-navy-900/40">
                            <td className="py-3 px-3 font-bold font-sans text-violet-300">Factor K (Conversión Litológica)</td>
                            <td className="py-3 px-3 text-center text-slate-400">{reportStats.kMin !== null ? reportStats.kMin.toFixed(1) : "—"}</td>
                            <td className="py-3 px-3 text-center text-slate-400">{reportStats.kMax !== null ? reportStats.kMax.toFixed(1) : "—"}</td>
                            <td className="py-3 px-3 text-center text-violet-300 font-bold">{reportStats.kAvg !== null ? reportStats.kAvg.toFixed(1) : "—"}</td>
                            <td className="py-3 px-3 text-center text-slate-300">{reportStats.kMedian !== null ? reportStats.kMedian.toFixed(1) : "—"}</td>
                            <td className="py-3 px-3 text-center text-slate-500">—</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Sector Geotécnico & Validez Geométrica */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Sector Geotécnico */}
                    <div className="bg-navy-950/60 border border-navy-800 p-5 rounded-2xl space-y-3 shadow-xl">
                      <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-navy-800 pb-2">Distribución por Sector Geotécnico (Solo M)</h4>
                      <div className="space-y-2.5">
                        {(() => {
                          const sectorPalette = [
                            "bg-cyan-500",
                            "bg-indigo-500",
                            "bg-purple-500",
                            "bg-amber-500",
                            "bg-rose-500"
                          ];
                          const entries = Object.entries(reportStats.sectorCnt).sort((a, b) => b[1] - a[1]);

                          if (entries.length === 0) {
                            return <p className="text-xs text-slate-400 italic">Sin sectores geotécnicos con rotura M registrados.</p>;
                          }

                          return entries.map(([sector, count], idx) => {
                            const pct = reportStats.intactCount > 0 ? (count / reportStats.intactCount) * 100 : 0;
                            return (
                              <div key={sector} className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-300">
                                  <span className="font-mono text-slate-200">{sector}</span>
                                  <span className="font-mono text-slate-400">{count} ({pct.toFixed(1)}%)</span>
                                </div>
                                <div className="w-full bg-navy-900 border border-navy-800 rounded-full h-2.5 overflow-hidden">
                                  <div className={`h-full rounded-full ${sectorPalette[idx % sectorPalette.length]}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Validez Geométrica */}
                    <div className="bg-navy-950/60 border border-navy-800 p-5 rounded-2xl space-y-3 shadow-xl">
                      <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-navy-800 pb-2">Control de Validez Geométrica</h4>
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between p-3 bg-navy-900/60 border border-navy-800 rounded-xl">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-200 block">Criterio Longitud (L ≥ D)</span>
                            <span className="text-xs text-slate-400">Distancia mínima al extremo = 0.5D</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-emerald-400 text-sm block">{reportStats.valL} / {reportStats.total}</span>
                            <span className="text-xs text-slate-400 font-semibold">{reportStats.total > 0 ? ((reportStats.valL / reportStats.total) * 100).toFixed(1) : 0}%</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-navy-900/60 border border-navy-800 rounded-xl">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-200 block">Criterio Ancho (0.3W &lt; D &lt; W)</span>
                            <span className="text-xs text-slate-400">Condición requerida para calcular Is(50)</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-sky-400 text-sm block">{reportStats.valA} / {reportStats.total}</span>
                            <span className="text-xs text-slate-400 font-semibold">{reportStats.total > 0 ? ((reportStats.valA / reportStats.total) * 100).toFixed(1) : 0}%</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                          <div className="space-y-0.5">
                            <span className="font-extrabold text-emerald-300 block">Ambos Criterios Válidos</span>
                            <span className="text-xs text-emerald-400/80 font-medium">Muestras 100% conformes para informe</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-black text-emerald-400 text-base block">{reportStats.bothValid} / {reportStats.total}</span>
                            <span className="text-xs font-bold text-emerald-400">{reportStats.bothValidPct.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fórmulas y Criterios Normativos (ASTM / ISRM) */}
                  <div className="bg-navy-950/60 border border-navy-800 rounded-2xl p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                      <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
                        <Calculator size={15} className="text-cyan-400" />
                        <span>Fórmulas y Criterios Normativos (ASTM / ISRM)</span>
                      </h4>
                      <span className="text-xs text-slate-400 font-mono font-bold">Muestras Irregulares</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-navy-900/70 border border-navy-800 space-y-1">
                        <div className="font-bold text-cyan-300">Ancho Equivalente y Validez Geométrica</div>
                        <div className="font-mono text-slate-100">W = (W1 + W2) / 2 &nbsp;;&nbsp; 0.3W &lt; D &lt; W &nbsp;;&nbsp; L ≥ D</div>
                        <div className="text-slate-400">Distancia mínima al extremo = 0.5D. Is(50) solo se calcula cuando 0.3W &lt; D &lt; W.</div>
                      </div>
                      <div className="p-3 rounded-xl bg-navy-900/70 border border-navy-800 space-y-1">
                        <div className="font-bold text-cyan-300">Diámetro Equivalente (De)</div>
                        <div className="font-mono text-slate-100">De = √(4 × D × W / π) &nbsp;[cm]</div>
                        <div className="text-slate-400">Tolerancia máxima de redondeo respecto al archivo origen: ±0.005 cm.</div>
                      </div>
                      <div className="p-3 rounded-xl bg-navy-900/70 border border-navy-800 space-y-1">
                        <div className="font-bold text-sky-300">Factor de Corrección por Tamaño (F)</div>
                        <div className="font-mono text-slate-100">F = (De_mm / 50)^0.45 &nbsp;(con De_mm = De × 10)</div>
                        <div className="text-slate-400">Adimensional; normaliza la probeta irregular al diámetro estándar de 50 mm.</div>
                      </div>
                      <div className="p-3 rounded-xl bg-navy-900/70 border border-navy-800 space-y-1">
                        <div className="font-bold text-teal-300">Índice de Carga Puntual (Is e Is(50))</div>
                        <div className="font-mono text-slate-100">Is = (P × 1000) / De_mm² &nbsp;;&nbsp; Is(50) = F × Is &nbsp;[MPa]</div>
                        <div className="text-slate-400">P en kN (×1000 a N). Precaución si 55 &lt; P ≤ 60 kN; alerta y observación obligatoria si P &gt; 60 kN.</div>
                      </div>
                      <div className="p-3 rounded-xl bg-navy-900/70 border border-navy-800 space-y-1 md:col-span-2">
                        <div className="font-bold text-amber-300">Resistencia a Compresión Simple Estimada (RCS / UCS)</div>
                        <div className="font-mono text-slate-100">RCS = Is(50) × K &nbsp;[MPa]</div>
                        <div className="text-slate-400">K según combinación litológica declarada en muestreo. Únicamente Tipo de Rotura M (Matriz) integra estimaciones de roca intacta.</div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-xl bg-navy-950/60 border border-navy-800 text-xs text-slate-400 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-2">
                      <Activity size={13} className="text-violet-400" />
                      {reportStats.total} ensayos reportados ({reportStats.intactCount} Tipo M roca intacta) {hasActiveFilters && `(de ${reportStats.totalUnfiltered} totales)`}
                    </span>
                    <span>Normas ISRM & Suggested Methods</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 📥 EXCEL IMPORT MODAL DE ACOPLAMIENTO MODULAR */}
      <PltExcelImportModal
        isOpen={activeModal === 'import_excel'}
        onClose={() => setActiveModal(null)}
        onImportToCell={(celda, importedRows) => {
          onImportToCell && onImportToCell(celda, importedRows);
        }}
        activeWindowCelda={activeWindowCelda}
        knownCells={knownCells}
      />
    </div>
  );
}
