import React from 'react';
import type { WindowHeader, CalculatorResult } from '../utils/rmrCalculator';
import { LITHOLOGY_CLASSIFICATION, ALTERACION_CATALOG } from '../utils/catalogData';
import { AlignLeft, FileSpreadsheet, AlertTriangle, CheckCircle2, BookOpen, Pencil } from 'lucide-react';
import MapeadorCombobox from './MapeadorCombobox';

// Catálogo de Campañas (alineado a dbo.Campañas de GEMA.sql)
// Hardcodeado temporalmente; al migrar a la nueva BD se cargará dinámicamente desde /api/catalogos/campanas
const CAMPANAS_HARDCODED = [
  { id: 1, label: 'Campaña 2020' },
  { id: 2, label: 'Campaña 2021' },
  { id: 3, label: 'Campaña 2022' },
  { id: 4, label: 'Campaña 2023' },
  { id: 5, label: 'Campaña 2024' },
  { id: 6, label: 'Campaña 2025' },
  { id: 7, label: 'Campaña 2026' },
  { id: 8, label: 'Campaña 2019' },
];

interface VentanaFormProps {
  header: WindowHeader;
  onChange: (updatedHeader: WindowHeader) => void;
  calculated: CalculatorResult | null;
  onOpenImportModal: () => void;
  onOpenCatalogs?: () => void;
  onOpenRenameModal?: () => void;
}

const handleNumberInputLimit = (value: string, intDigits: number, decDigits: number, allowNegative: boolean = false): string => {
  const isNegative = allowNegative && value.startsWith('-');
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return (isNegative ? '-' : '') + cleaned.slice(0, -1);

  let integerPart = parts[0];
  let decimalPart = parts[1];

  if (integerPart.length > intDigits) {
    integerPart = integerPart.slice(0, intDigits);
  }
  if (decimalPart !== undefined && decimalPart.length > decDigits) {
    decimalPart = decimalPart.slice(0, decDigits);
  }

  const result = decimalPart !== undefined ? `${integerPart}.${decimalPart}` : integerPart;
  return (isNegative && (integerPart || decimalPart) ? '-' : (isNegative && value === '-' ? '-' : '')) + result;
};

// Sanitizador global de entrada decimal para unificar de coma a punto en tiempo real
const sanitizeDecimalInput = (val: string, intDigits: number, decDigits: number, allowNegative: boolean = false): string => {
  const sanitized = val.replace(',', '.');
  return handleNumberInputLimit(sanitized, intDigits, decDigits, allowNegative);
};

export default function VentanaForm({
  header,
  onChange,
  calculated: _calculated,
  onOpenImportModal,
  onOpenCatalogs,
  onOpenRenameModal
}: VentanaFormProps) {

  const [localValues, setLocalValues] = React.useState<Record<string, string>>({});

  const handleChange = (field: keyof WindowHeader, val: any) => {
    onChange({
      ...header,
      [field]: val
    });
  };

  const getInputValue = (field: keyof WindowHeader, stateVal: any): string => {
    if (localValues[field as string] !== undefined) return localValues[field as string];
    if (stateVal === undefined || stateVal === null) return '';
    return String(stateVal);
  };

  const handleCoordinateInputChange = (field: keyof WindowHeader, val: string, intDigits: number, decDigits: number) => {
    const sanitized = val.replace(',', '.');
    const restricted = handleNumberInputLimit(sanitized, intDigits, decDigits, false);
    setLocalValues(prev => ({ ...prev, [field as string]: restricted }));

    const num = parseFloat(restricted);
    if (!isNaN(num) && restricted !== '' && !restricted.endsWith('.')) {
      handleChange(field, num);
    } else if (restricted === '') {
      handleChange(field, undefined);
    }
  };

  const handleCoordinateInputBlur = (field: keyof WindowHeader, val: string) => {
    setLocalValues(prev => {
      const copy = { ...prev };
      delete copy[field as string];
      return copy;
    });
    if (!val || val.trim() === '') {
      handleChange(field, undefined);
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num)) {
      handleChange(field, undefined);
    } else {
      handleChange(field, Math.max(0, num));
    }
  };

  const uniqueLito1 = React.useMemo(() => {
    const set = new Set<string>();
    LITHOLOGY_CLASSIFICATION.forEach(item => {
      if (item.unidad) set.add(item.unidad);
    });
    if (header.lito_1) set.add(header.lito_1);
    return Array.from(set).filter(x => x && x !== '-' && x !== 'NR').sort();
  }, [header.lito_1]);

  const uniqueLito2 = React.useMemo(() => {
    const set = new Set<string>();
    LITHOLOGY_CLASSIFICATION.forEach(item => {
      if (item.litologia) set.add(item.litologia);
    });
    if (header.lito_2 && header.lito_2 !== '-1') set.add(header.lito_2);
    return Array.from(set).filter(x => x && x !== '-' && x !== 'NR').sort();
  }, [header.lito_2]);

  const uniqueLito3 = React.useMemo(() => {
    const set = new Set<string>();
    LITHOLOGY_CLASSIFICATION.forEach(item => {
      if (item.codigo) set.add(item.codigo);
    });
    if (header.lito_3 && header.lito_3 !== '-1') set.add(header.lito_3);
    return Array.from(set).filter(x => x && x !== '-' && x !== 'NR').sort();
  }, [header.lito_3]);

  const uniqueUnidades = React.useMemo(() => {
    const set = new Set<string>();
    LITHOLOGY_CLASSIFICATION.forEach(item => {
      if (item.grupo) set.add(item.grupo);
    });
    if (header.unidad_litologica) set.add(header.unidad_litologica);
    return Array.from(set).filter(x => x && x !== '-' && x !== 'NR').sort();
  }, [header.unidad_litologica]);

  const litoValidation = React.useMemo(() => {
    const g = (header.unidad_litologica || '').trim().toUpperCase();
    const u = (header.lito_1 || '').trim().toUpperCase();
    const l = (header.lito_2 || '').trim().toUpperCase();
    const c = (header.lito_3 || '').trim().toUpperCase();

    const isGEmpty = !g || g === '-1';
    const isL1Empty = !u || u === '-1';
    const isL2Empty = !l || l === '-1';
    const isL3Empty = !c || c === '-1';

    if (isGEmpty && isL1Empty && isL2Empty && isL3Empty) {
      return { isInvalid: false, matchedItem: null, reason: null };
    }

    if (isGEmpty) {
      return {
        isInvalid: true,
        matchedItem: null,
        reason: 'Se requiere seleccionar obligatoriamente una Unidad Litológica (INTRUSIVOS, SEDIMENTARIOS, METAMORFICAS, BRECHAS, ENDOSKARN).'
      };
    }

    const groupSyns: Record<string, string> = {
      "SEDIMENTARIA": "SEDIMENTARIOS", "SEDIMENTARIAS": "SEDIMENTARIOS", "SEDIMENTARIO": "SEDIMENTARIOS",
      "INTRUSIVA": "INTRUSIVOS", "INTRUSIVAS": "INTRUSIVOS", "INTRUSIVO": "INTRUSIVOS",
      "METAMORFICO": "METAMORFICAS", "METAMORFICOS": "METAMORFICAS", "METAMORFICA": "METAMORFICAS",
      "BRECHA": "BRECHAS"
    };
    const normG = groupSyns[g] || g;

    const matches = LITHOLOGY_CLASSIFICATION.filter(item => {
      const itemG = (item.grupo || '').toUpperCase();
      const normItemG = groupSyns[itemG] || itemG;
      const itemU = (item.unidad || '').toUpperCase();
      const itemL = (item.litologia || '').toUpperCase();
      const itemC = (item.codigo || '').toUpperCase();

      const mg = normItemG === normG;
      const m1 = isL1Empty || itemU === u;
      const m2 = isL2Empty || itemL === l;
      const m3 = isL3Empty || itemC === c;

      return mg && m1 && m2 && m3;
    });

    if (matches.length === 0) {
      return {
        isInvalid: true,
        matchedItem: null,
        reason: `Combinación no existente en GEMA: Unidad (${header.unidad_litologica}) con Lito 1 (${header.lito_1 || '—'}) / Lito 2 (${header.lito_2 || '—'}) / Lito 3 (${header.lito_3 || '—'}).`
      };
    }

    return { isInvalid: false, matchedItem: matches[0], reason: null };
  }, [header.unidad_litologica, header.lito_1, header.lito_2, header.lito_3]);

  const handleLito1Change = (val: string) => {
    handleChange('lito_1', val);
  };

  const handleLito2Change = (val: string) => {
    handleChange('lito_2', val);
  };

  const handleLito3Change = (val: string) => {
    handleChange('lito_3', val);
  };

  const handleUnidadChange = (val: string) => {
    handleChange('unidad_litologica', val);
  };

  const handleSectGeotChange = (val: string) => {
    onChange({
      ...header,
      sect_geot: val,
      sector: val
    });
  };

  const ix = parseFloat(String(header.este_from));
  const iy = parseFloat(String(header.norte_from));
  const ic = parseFloat(String(header.cota_from));
  const fx = parseFloat(String(header.este_to));
  const fy = parseFloat(String(header.norte_to));
  const fc = parseFloat(String(header.cota_to));

  const hasCoords = [ix, iy, ic, fx, fy, fc].every(n => !isNaN(n) && n !== 0);
  const calculatedLargo = hasCoords
    ? Math.round(Math.sqrt(Math.pow(fx - ix, 2) + Math.pow(fy - iy, 2) + Math.pow(fc - ic, 2)))
    : null;

  React.useEffect(() => {
    if (calculatedLargo !== null) {
      if (Number(header.largo) !== calculatedLargo) {
        handleChange('largo', calculatedLargo);
      }
    }
  }, [calculatedLargo]);

  return (
    <div className="space-y-4 select-none text-left">
      {/* TARJETA UNIFICADA PREMIUM CON BORDE IZQUIERDO VIOLETA DE NEÓN */}
      <div className="glass-panel p-6 rounded-2xl border border-navy-800 bg-navy-950/20 border-l-4 border-l-violet-500 shadow-xl relative overflow-hidden">

        {/* ENCABEZADO PRINCIPAL (CORREGIDO: Jerarquía unificada idéntica a "Comentarios y Fotos") */}
        <div className="flex items-center justify-between border-b border-navy-900 pb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg">
              <AlignLeft size={18} className="text-violet-400" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-100 uppercase tracking-widest">
                Datos de Registro
              </h4>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Identificación y geometría espacial de la celda de mapeo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenImportModal}
            className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.12)]"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            <span>Importar Excel</span>
          </button>
        </div>

        {/* ESTRUCTURA SPLIT GEOMECÁNICA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">

          {/* ========================================================
              COLUMNA IZQUIERDA: DEFINICIÓN ESPACIAL Y DE PLANOS (5 COLS)
              ======================================================== */}
          <div className="lg:col-span-5 space-y-5">

            {/* Celda & Largo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Celda</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    id="header-celda"
                    readOnly
                    value={header.celda || ''}
                    title="El código de celda no se edita directamente para evitar duplicados. Use el botón 'Editar'."
                    className="w-full bg-navy-950/80 border border-navy-800 rounded-lg px-3 py-1.5 text-slate-200 font-black tracking-wider text-xs text-center cursor-not-allowed select-none opacity-90"
                  />
                  {onOpenRenameModal && (
                    <button
                      type="button"
                      onClick={onOpenRenameModal}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-indigo-200 font-bold text-xs transition-all active:scale-95 shrink-0 shadow-sm"
                      title="Editar o renombrar el código de esta celda"
                    >
                      <Pencil size={13} />
                      <span>Editar</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between block w-full">
                  <span>Dist. Celda (m)</span>
                  <span className="text-[10px] bg-orange-500/15 border border-orange-500/30 text-orange-400 font-bold px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(245,158,11,0.1)] select-none">
                    AUTO
                  </span>
                </label>
                <div
                  id="header-largo"
                  title="Calculado automáticamente desde coordenadas FROM→TO"
                  className="w-full border border-orange-500/30 bg-orange-500/[0.03] rounded-lg px-3 py-1.5 text-xs font-bold text-center text-orange-400 cursor-not-allowed select-none"
                >
                  {calculatedLargo !== null ? `${calculatedLargo} m` : '—'}
                </div>
              </div>
            </div>

            {/* COORDENADAS INICIALES (FROM) - VECTOR 3D CON PREFIJOS E, N, Z */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Coordenadas Iniciales (From)</label>
              <div className="flex items-center w-full bg-navy-900/40 border border-navy-700/80 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-violet-500/50 focus-within:border-violet-500 transition-all">
                <div className="px-2.5 py-1.5 bg-navy-950/60 text-slate-400 font-extrabold border-r border-navy-700/80 text-xs select-none uppercase tracking-wider shrink-0">
                  From
                </div>
                <div className="flex-1 flex items-center h-full">
                  <span className="pl-2.5 text-xs font-bold text-slate-500 select-none">E</span>
                  <input
                    type="text"
                    placeholder="Este (X)"
                    value={getInputValue('este_from', header.este_from)}
                    id="header-este_from"
                    onChange={(e) => handleCoordinateInputChange('este_from', e.target.value, 6, 4)}
                    onBlur={(e) => handleCoordinateInputBlur('este_from', e.target.value)}
                    className="w-full bg-transparent text-slate-100 text-xs font-normal focus:outline-none font-mono text-center py-1.5"
                  />
                  <div className="w-[1px] h-5 bg-navy-700/80 shrink-0" />
                  <span className="pl-2 text-xs font-bold text-slate-500 select-none">N</span>
                  <input
                    type="text"
                    placeholder="Norte (Y)"
                    value={getInputValue('norte_from', header.norte_from)}
                    id="header-norte_from"
                    onChange={(e) => handleCoordinateInputChange('norte_from', e.target.value, 7, 3)}
                    onBlur={(e) => handleCoordinateInputBlur('norte_from', e.target.value)}
                    className="w-full bg-navy-900/10 text-slate-100 text-xs font-normal focus:outline-none font-mono text-center py-1.5"
                  />
                  <div className="w-[1px] h-5 bg-navy-700/80 shrink-0" />
                  <span className="pl-2 text-xs font-bold text-slate-500 select-none">C</span>
                  <input
                    type="text"
                    placeholder="Cota (C)"
                    value={getInputValue('cota_from', header.cota_from)}
                    id="header-cota_from"
                    onChange={(e) => handleCoordinateInputChange('cota_from', e.target.value, 4, 2)}
                    onBlur={(e) => handleCoordinateInputBlur('cota_from', e.target.value)}
                    className="w-full bg-transparent text-slate-100 text-xs font-normal focus:outline-none font-mono text-center py-1.5"
                  />
                </div>
              </div>
            </div>

            {/* COORDENADAS FINALES (TO) - VECTOR 3D CON PREFIJOS E, N, Z */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Coordenadas Finales (To)</label>
              <div className="flex items-center w-full bg-navy-900/40 border border-navy-700/80 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-violet-500/50 focus-within:border-violet-500 transition-all">
                <div className="px-2.5 py-1.5 bg-navy-950/60 text-slate-400 font-extrabold border-r border-navy-700/80 text-xs select-none uppercase tracking-wider shrink-0">
                  To
                </div>
                <div className="flex-1 flex items-center h-full">
                  <span className="pl-2.5 text-xs font-bold text-slate-500 select-none">E</span>
                  <input
                    type="text"
                    placeholder="Este (X)"
                    value={getInputValue('este_to', header.este_to)}
                    id="header-este_to"
                    onChange={(e) => handleCoordinateInputChange('este_to', e.target.value, 6, 4)}
                    onBlur={(e) => handleCoordinateInputBlur('este_to', e.target.value)}
                    className="w-full bg-transparent text-slate-100 text-xs font-normal focus:outline-none font-mono text-center py-1.5"
                  />
                  <div className="w-[1px] h-5 bg-navy-700/80 shrink-0" />
                  <span className="pl-2 text-xs font-bold text-slate-500 select-none">N</span>
                  <input
                    type="text"
                    placeholder="Norte (Y)"
                    value={getInputValue('norte_to', header.norte_to)}
                    id="header-norte_to"
                    onChange={(e) => handleCoordinateInputChange('norte_to', e.target.value, 7, 3)}
                    onBlur={(e) => handleCoordinateInputBlur('norte_to', e.target.value)}
                    className="w-full bg-navy-900/10 text-slate-100 text-xs font-normal focus:outline-none font-mono text-center py-1.5"
                  />
                  <div className="w-[1px] h-5 bg-navy-700/80 shrink-0" />
                  <span className="pl-2 text-xs font-bold text-slate-500 select-none">C</span>
                  <input
                    type="text"
                    placeholder="Cota (C)"
                    value={getInputValue('cota_to', header.cota_to)}
                    id="header-cota_to"
                    onChange={(e) => handleCoordinateInputChange('cota_to', e.target.value, 4, 2)}
                    onBlur={(e) => handleCoordinateInputBlur('cota_to', e.target.value)}
                    className="w-full bg-transparent text-slate-100 text-xs font-normal focus:outline-none font-mono text-center py-1.5"
                  />
                </div>
              </div>
            </div>

            {/* Geometría y Orientación de Talud (Estandarizado a inputs de texto con formateo a punto ".") */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Altura (m)</label>
                <input
                  type="text"
                  placeholder="Altura"
                  value={getInputValue('altura', header.altura)}
                  onChange={(e) => {
                    const limited = sanitizeDecimalInput(e.target.value, 2, 1, false);
                    handleChange('altura', limited);
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val === '') {
                      handleChange('altura', undefined);
                      return;
                    }
                    const num = parseFloat(val);
                    handleChange('altura', isNaN(num) ? undefined : Math.min(99, Math.max(0, num)));
                  }}
                  className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Dip Talud°</label>
                <input
                  type="text"
                  placeholder="-90 a 90"
                  value={getInputValue('dip_talud', header.dip_talud)}
                  onChange={(e) => {
                    const limited = sanitizeDecimalInput(e.target.value, 2, 2, true);
                    handleChange('dip_talud', limited);
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val === '') {
                      handleChange('dip_talud', undefined);
                      return;
                    }
                    const num = parseFloat(val);
                    handleChange('dip_talud', isNaN(num) ? undefined : Math.min(90, Math.max(-90, num)));
                  }}
                  className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">DipDir Talud°</label>
                <input
                  type="text"
                  placeholder="0-359"
                  value={getInputValue('dipdir_talud', header.dipdir_talud)}
                  onChange={(e) => {
                    const limited = sanitizeDecimalInput(e.target.value, 3, 2, false);
                    handleChange('dipdir_talud', limited);
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val === '') {
                      handleChange('dipdir_talud', undefined);
                      return;
                    }
                    const num = parseFloat(val);
                    handleChange('dipdir_talud', isNaN(num) ? undefined : Math.min(359.99, Math.max(0, num)));
                  }}
                  className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">DIP°</label>
                <input
                  type="text"
                  placeholder="-90-90"
                  value={getInputValue('dip_hw', header.dip_hw)}
                  onChange={(e) => {
                    const limited = sanitizeDecimalInput(e.target.value, 3, 2, true);
                    handleChange('dip_hw', limited);
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val === '') {
                      handleChange('dip_hw', undefined);
                      return;
                    }
                    const num = parseFloat(val);
                    handleChange('dip_hw', isNaN(num) ? undefined : Math.min(90, Math.max(-90, num)));
                  }}
                  className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">AZ_HOLE°</label>
                <input
                  type="text"
                  placeholder="0-359"
                  value={getInputValue('az_hw', header.az_hw)}
                  onChange={(e) => {
                    const limited = sanitizeDecimalInput(e.target.value, 3, 2, false);
                    handleChange('az_hw', limited);
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val === '') {
                      handleChange('az_hw', undefined);
                      return;
                    }
                    const num = parseFloat(val);
                    handleChange('az_hw', isNaN(num) ? undefined : Math.min(359.99, Math.max(0, num)));
                  }}
                  className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center"
                />
              </div>
            </div>

          </div>

          {/* ========================================================
              COLUMNA DERECHA: LITOLOGÍA, METADATOS Y ZONIFICACIÓN (7 COLS)
              Con divisor vertical sutil e indentación horizontal
              ======================================================== */}
          <div className="lg:col-span-7 space-y-5 lg:border-l lg:border-navy-900 lg:pl-6">

            {/* Bloque Litológico con Selección Independiente y Validación Reactiva */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Lito 1</label>
                  <select
                    value={header.lito_1 || ''}
                    onChange={(e) => handleLito1Change(e.target.value)}
                    className={`w-full bg-navy-900 border rounded-lg px-2 py-1.5 text-slate-100 text-xs font-normal cursor-pointer text-center ${litoValidation.isInvalid ? 'border-amber-500/80 bg-amber-950/20 text-amber-300' : 'border-navy-700/85'
                      }`}
                  >
                    <option value="">— Lito 1 —</option>
                    {uniqueLito1.map(l => (
                      <option key={l} value={l} className="bg-navy-900 text-slate-100 text-xs">{l}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Lito 2</label>
                  <select
                    value={header.lito_2 || '-1'}
                    onChange={(e) => handleLito2Change(e.target.value)}
                    className={`w-full bg-navy-900 border rounded-lg px-2 py-1.5 text-xs font-normal cursor-pointer text-center ${litoValidation.isInvalid ? 'border-amber-500/80 bg-amber-950/20 text-amber-300' : 'border-navy-700/85 text-slate-100'
                      }`}
                  >
                    <option value="-1">— Lito 2 —</option>
                    {uniqueLito2.map(l => (
                      <option key={l} value={l} className="bg-navy-900 text-slate-100 text-xs">{l}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Lito 3</label>
                  <select
                    value={header.lito_3 || '-1'}
                    onChange={(e) => handleLito3Change(e.target.value)}
                    className={`w-full bg-navy-900 border rounded-lg px-2 py-1.5 text-xs font-normal cursor-pointer text-center ${litoValidation.isInvalid ? 'border-amber-500/80 bg-amber-950/20 text-amber-300' : 'border-navy-700/85 text-orange-400'
                      }`}
                  >
                    <option value="-1">— Lito 3 —</option>
                    {uniqueLito3.map(l => (
                      <option key={l} value={l} className="bg-navy-900 text-slate-100 text-xs">{l}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Unidad Lito</label>
                  <select
                    value={header.unidad_litologica || ''}
                    onChange={(e) => handleUnidadChange(e.target.value)}
                    className={`w-full bg-navy-900 border rounded-lg px-2 py-1.5 text-xs font-normal cursor-pointer text-center ${litoValidation.isInvalid ? 'border-amber-500/80 bg-amber-950/20 text-amber-300' : 'border-navy-700/85 text-slate-100'
                      }`}
                  >
                    <option value="">— Unidad —</option>
                    {uniqueUnidades.map(u => (
                      <option key={u} value={u} className="bg-navy-900 text-slate-100 text-xs">{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Banners Prominentes de Validación Litológica */}
              {litoValidation.isInvalid ? (
                <div className="p-4 rounded-xl bg-amber-950/80 border-2 border-amber-500/80 text-amber-200 text-xs space-y-3 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-lg shrink-0">
                      <AlertTriangle size={20} className="stroke-[2.5]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-black text-amber-300 uppercase tracking-wide">
                        ¡COMBINACIÓN LITOLÓGICA INVÁLIDA O INCOMPATIBLE EN GEMA!
                      </h4>
                      <p className="text-xs text-amber-200/90 mt-1 font-semibold leading-relaxed">
                        {litoValidation.reason}
                      </p>
                    </div>
                  </div>

                  {/* Tarjeta Prominente de Recomendación de Catálogo con Botón Directo */}
                  <div className="bg-amber-500/15 border border-amber-500/40 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-100">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <BookOpen size={16} className="text-amber-400 shrink-0" />
                      <span>
                        Se recomienda revisar el <strong>Catálogo Geomecánico de Referencia</strong> para verificar las combinaciones compatibles de <strong>Unidad Litológica, Lito 1, Lito 2 y Lito 3</strong>.
                      </span>
                    </div>
                    {onOpenCatalogs && (
                      <button
                        type="button"
                        onClick={onOpenCatalogs}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-navy-950 font-black text-xs transition-all shadow-[0_0_12px_rgba(245,158,11,0.3)] active:scale-95 shrink-0 self-end sm:self-auto"
                      >
                        <BookOpen size={14} />
                        <span>Ver Catálogo</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : litoValidation.matchedItem ? (
                <div className="p-2 px-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span>Combinación Válida GEMA: <strong>{litoValidation.matchedItem.grupo}</strong> (Lito 1: {litoValidation.matchedItem.unidad} | Lito 2: {litoValidation.matchedItem.litologia})</span>
                  </div>
                  {litoValidation.matchedItem.k !== undefined && (
                    <span className="bg-emerald-500/20 px-2.5 py-0.5 rounded-md text-xs font-bold text-emerald-300 border border-emerald-500/30">
                      Factor K: {litoValidation.matchedItem.k}
                    </span>
                  )}
                </div>
              ) : null}
            </div>

            {/* Divisor de Sección: Zonificación */}
            <div className="border-t border-navy-900/60 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Sector Geotécnico</label>
                  <input
                    type="text"
                    value={header.sect_geot || ''}
                    onChange={(e) => handleSectGeotChange(e.target.value)}
                    placeholder="Sector Geot."
                    maxLength={12}
                    className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-200 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Intemperismo / Meteorización</label>
                  <select
                    value={header.intemperia || ''}
                    onChange={(e) => handleChange('intemperia', e.target.value)}
                    className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-200 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer"
                  >
                    <option value="" className="bg-navy-950 text-slate-500">— Seleccionar —</option>
                    {Object.entries(ALTERACION_CATALOG).map(([key, item]) => {
                      const parts = item.name.split(' — ');
                      const desc = parts[1] || item.name;
                      return (
                        <option key={key} value={key} className="bg-navy-950 text-slate-100 text-xs">
                          {key} ({desc})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Alteración</label>
                  <select
                    value={header.alteracion || header.alt_mapeo || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleChange('alteracion', val);
                      handleChange('alt_mapeo', val);
                    }}
                    className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-200 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer"
                  >
                    <option value="" className="bg-navy-950 text-slate-500">— Seleccionar —</option>
                    {Object.entries(ALTERACION_CATALOG).map(([key, item]) => {
                      const parts = item.name.split(' — ');
                      const desc = parts[1] || item.name;
                      return (
                        <option key={key} value={key} className="bg-navy-950 text-slate-100 text-xs">
                          {key} ({desc})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Divisor de Sección: Metadatos y Control de Campaña */}
            <div className="border-t border-navy-900/60 pt-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Campaña</label>
                  <select
                    value={header.campania !== undefined && header.campania !== null ? String(header.campania) : ''}
                    onChange={(e) => handleChange('campania', e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                    className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-2 py-1.5 text-slate-200 text-xs text-center font-normal cursor-pointer focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  >
                    <option value="" className="bg-navy-950 text-slate-500">— Campaña —</option>
                    {CAMPANAS_HARDCODED.map(c => (
                      <option key={c.id} value={c.id} className="bg-navy-950 text-slate-100 text-xs">{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Fase</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={header.fase || ''}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 2);
                      handleChange('fase', cleaned === '' ? '' : parseInt(cleaned, 10));
                    }}
                    placeholder="Fase"
                    className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-2 py-1.5 text-slate-200 text-xs text-center font-normal"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Nivel</label>
                  <input
                    type="text"
                    value={header.nivel || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace('-', '');
                      const limited = handleNumberInputLimit(val, 4, 2);
                      handleChange('nivel', limited);
                    }}
                    placeholder="Nivel"
                    className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-2 py-1.5 text-slate-200 text-xs text-center font-normal"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Fecha</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={header.fecha || ''}
                      onChange={(e) => handleChange('fecha', e.target.value)}
                      className="w-full bg-navy-900/40 border border-navy-700/85 rounded-lg px-2 py-1.5 text-slate-200 text-xs text-center font-normal cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Mapeador</label>
                  <MapeadorCombobox
                    value={header.mapeador || ''}
                    onChange={(val) => handleChange('mapeador', val)}
                    placeholder="Buscar o crear mapeador..."
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}