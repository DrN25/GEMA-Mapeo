import React, { useState } from 'react';
import type { WindowHeader, CalculatorResult } from '../utils/rmrCalculator';
import { Compass } from 'lucide-react';
import { FormulaTooltipTrigger } from './FormulaTooltip';
import { COLUMN_LABELS, ISRM_TABLE } from '../utils/geomecColumns';
import {
  ratingDiscretoRqd,
  ratingContinuoRqd,
  ratingDiscretoResistencia,
  ratingContinuoResistencia
} from '../utils/rmrInterpolation';

interface RmrAnalysisProps {
  header: WindowHeader;
  onChange: (header: WindowHeader) => void;
  calculated: CalculatorResult | null;
  onClose?: () => void;
  showFormulas?: boolean;
}

const handleNumberInputLimit = (value: string, intDigits: number, decDigits: number): string => {
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

// Obtiene dinámicamente el índice de resistencia ISRM (R0 - R6) basado en el UCS en MPa
const getIsrmGrade = (val: number): string => {
  if (val > 250) return 'R6';
  if (val > 100) return 'R5';
  if (val > 50) return 'R4';
  if (val > 25) return 'R3';
  if (val > 5) return 'R2';
  if (val > 1) return 'R1';
  return 'R0';
};

export default function RmrAnalysis({
  header,
  onChange,
  calculated,
  onClose,
  showFormulas = true
}: RmrAnalysisProps) {

  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  if (!calculated) {
    return (
      <div className="glass-panel p-8 rounded-xl border border-navy-800 text-center text-slate-500 space-y-2 bg-navy-950/20">
        <p className="text-xs font-semibold">No hay datos de mapeo disponibles para analizar. Registre discontinuidades en la ventana.</p>
      </div>
    );
  }

  const handleWaterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...header,
      condicion_agua: e.target.value
    });
  };

  const handleNumericInputChange = (field: 'ucs_mpa' | 'is50_mpa' | 'gsi_visual' | 'control_estructural' | 'efectos_voladura', val: string, intDigits: number, decDigits: number) => {
    const sanitized = val.replace(',', '.').replace('-', '');
    const restricted = handleNumberInputLimit(sanitized, intDigits, decDigits);
    setLocalValues(prev => ({ ...prev, [field]: restricted }));

    const num = parseFloat(restricted);
    if (!isNaN(num) && restricted !== '' && !restricted.endsWith('.')) {
      onChange({
        ...header,
        [field]: Math.max(0, num)
      });
    } else if (restricted === '') {
      onChange({
        ...header,
        [field]: 0
      });
    }
  };

  const handleNumericInputBlur = (field: 'ucs_mpa' | 'is50_mpa' | 'gsi_visual' | 'control_estructural' | 'efectos_voladura', val: string) => {
    setLocalValues(prev => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
    const num = parseFloat(val);
    if (isNaN(num)) {
      onChange({ ...header, [field]: 0 });
    } else {
      let clamped = Math.max(0, num);
      if (field === 'ucs_mpa') clamped = Math.min(500, clamped);
      else if (field === 'is50_mpa') clamped = Math.min(50, clamped);
      onChange({ ...header, [field]: clamped });
    }
  };

  const getInputValue = (field: 'ucs_mpa' | 'is50_mpa' | 'gsi_visual' | 'control_estructural' | 'efectos_voladura', stateVal: any): string => {
    if (localValues[field] !== undefined) return localValues[field];
    if (stateVal === undefined || stateVal === null) return '';
    return String(stateVal);
  };

  const handleFieldChange = (field: keyof WindowHeader, val: any) => {
    onChange({
      ...header,
      [field]: val
    });
  };

  const ucs = header.ucs_mpa !== undefined && header.ucs_mpa !== 0 ? header.ucs_mpa : undefined;
  const is50 = header.is50_mpa !== undefined && header.is50_mpa !== 0 ? header.is50_mpa : undefined;
  const gsiCond = header.gsi_superficie || '';
  const gsiEstruc = header.gsi_estructura || '';
  const gsiVisual = header.gsi_visual !== undefined && header.gsi_visual !== 0 ? header.gsi_visual : undefined;
  const ctrl = header.control_estructural !== undefined && header.control_estructural !== 0 ? header.control_estructural : undefined;
  const vol = header.efectos_voladura !== undefined && header.efectos_voladura !== 0 ? header.efectos_voladura : undefined;

  // Resistencia estimada ingresada manualmente por el usuario
  const currentResistGrade = header.resistencia_ucs || '';

  const p1 = calculated.familias_spacing[1] ? calculated.familias_spacing[1].toFixed(2) : '0.00';
  const p2 = calculated.familias_spacing[2] ? calculated.familias_spacing[2].toFixed(2) : '0.00';
  const p3 = calculated.familias_spacing[3] ? calculated.familias_spacing[3].toFixed(2) : '0.00';

  const ucsIs50Divergent = ucs !== undefined && is50 !== undefined && ucs <= is50;
  const gsiVisualInvalid = gsiVisual !== undefined && (gsiVisual < 0 || gsiVisual > 100);

  return (
    <div className="glass-panel p-6 rounded-xl border border-navy-800 bg-navy-950/20 border-l-4 border-l-violet-500 space-y-6 text-left select-none animate-fade-in shadow-xl">

      {/* ENCABEZADO UNIFICADO */}
      <div className="flex items-center justify-between border-b border-navy-900 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg">
            <Compass size={18} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-100 uppercase tracking-widest">
              Análisis Geomecánico RMR & GSI
            </h4>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Código Celda: <span className="text-violet-400 font-bold">{header.celda || '—'}</span> &nbsp;|&nbsp;
              Mapeador: <span className="text-slate-300 font-semibold">{header.mapeador || '—'}</span>
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold transition-all active:scale-95"
          >
            ✕ Cerrar Panel
          </button>
        )}
      </div>

      {/* INPUTS DE CONTROL */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3 bg-navy-950/45 pt-2 pb-4 px-4 rounded-xl border border-navy-900">
        <div className="col-span-2 space-y-1">
          <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] h-7 flex items-end justify-center pb-0.5 text-center leading-tight">
            {COLUMN_LABELS.condicion_agua}
          </label>
          <select
            value={header.condicion_agua || ''}
            onChange={handleWaterChange}
            className="w-full bg-navy-900 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer text-center"
          >
            <option value="" className="bg-navy-950">-- Seleccione --</option>
            <option value="C" className="bg-navy-950">C — Completamente seco</option>
            <option value="H" className="bg-navy-950">H — Húmedo</option>
            <option value="M" className="bg-navy-950">M — Mojado</option>
            <option value="E" className="bg-navy-950">E — Goteando</option>
            <option value="F" className="bg-navy-950">F — Fluyendo</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] h-7 flex items-end justify-center pb-0.5 text-center leading-tight">
            {COLUMN_LABELS.resistencia_ucs}
          </label>
          <select
            value={header.resistencia_ucs || ''}
            onChange={(e) => handleFieldChange('resistencia_ucs', e.target.value)}
            className="w-full bg-navy-900 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer text-center"
          >
            <option value="" className="bg-navy-950">--</option>
            <option value="R6" className="bg-navy-950">R6</option>
            <option value="R5" className="bg-navy-950">R5</option>
            <option value="R4" className="bg-navy-950">R4</option>
            <option value="R3" className="bg-navy-950">R3</option>
            <option value="R2" className="bg-navy-950">R2</option>
            <option value="R1" className="bg-navy-950">R1</option>
            <option value="R0" className="bg-navy-950">R0</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] h-7 flex items-end justify-center pb-0.5 text-center leading-tight">
            {COLUMN_LABELS.is50_mpa}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={getInputValue('is50_mpa', is50)}
            onChange={(e) => handleNumericInputChange('is50_mpa', e.target.value, 4, 2)}
            onBlur={(e) => handleNumericInputBlur('is50_mpa', e.target.value)}
            className={`w-full bg-navy-900 border rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center ${ucsIs50Divergent ? 'border-red-500/80 bg-red-950/20 shadow-[0_0_8px_rgba(239,68,68,0.15)] text-red-300 font-bold' : 'border-navy-700/80'
              }`}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] h-7 flex items-end justify-center pb-0.5 text-center leading-tight">
            {COLUMN_LABELS.gsi_superficie}
          </label>
          <input
            type="text"
            maxLength={2}
            value={gsiCond}
            onChange={(e) => handleFieldChange('gsi_superficie', e.target.value)}
            className="w-full bg-navy-900 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] h-7 flex items-end justify-center pb-0.5 text-center leading-tight">
            {COLUMN_LABELS.gsi_estructura}
          </label>
          <input
            type="text"
            maxLength={2}
            value={gsiEstruc}
            onChange={(e) => handleFieldChange('gsi_estructura', e.target.value)}
            className="w-full bg-navy-900 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] h-7 flex items-end justify-center pb-0.5 text-center leading-tight">
            {COLUMN_LABELS.gsi_visual}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={getInputValue('gsi_visual', gsiVisual)}
            onChange={(e) => handleNumericInputChange('gsi_visual', e.target.value, 3, 0)}
            onBlur={(e) => handleNumericInputBlur('gsi_visual', e.target.value)}
            className={`w-full bg-navy-900 border rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center ${gsiVisualInvalid ? 'border-amber-500/80 bg-amber-950/20 shadow-[0_0_8px_rgba(245,158,11,0.15)] text-amber-300' : 'border-navy-700/80'
              }`}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] h-7 flex items-end justify-center pb-0.5 text-center leading-tight">
            {COLUMN_LABELS.control_estructural}
          </label>
          <select
            value={ctrl !== undefined ? String(ctrl) : ''}
            onChange={(e) => {
              const val = e.target.value === "" ? 0 : parseInt(e.target.value);
              handleFieldChange('control_estructural', val);
            }}
            className="w-full bg-navy-900 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer text-center"
          >
            <option value="" className="bg-navy-950">--</option>
            <option value="1" className="bg-navy-950">1</option>
            <option value="2" className="bg-navy-950">2</option>
            <option value="3" className="bg-navy-950">3</option>
            <option value="4" className="bg-navy-950">4</option>
            <option value="5" className="bg-navy-950">5</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] h-7 flex items-end justify-center pb-0.5 text-center leading-tight">
            {COLUMN_LABELS.efectos_voladura}
          </label>
          <select
            value={vol !== undefined ? String(vol) : ''}
            onChange={(e) => {
              const val = e.target.value === "" ? 0 : parseInt(e.target.value);
              handleFieldChange('efectos_voladura', val);
            }}
            className="w-full bg-navy-900 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer text-center"
          >
            <option value="" className="bg-navy-950">--</option>
            <option value="1" className="bg-navy-950">1</option>
            <option value="2" className="bg-navy-950">2</option>
            <option value="3" className="bg-navy-950">3</option>
            <option value="5" className="bg-navy-950">5</option>
            <option value="6" className="bg-navy-950">6</option>
          </select>
        </div>
      </div>

      {/* KPIS DE VALIDACIÓN */}
      <div className="flex flex-wrap justify-center items-center gap-6 my-6 select-none animate-fade-in">
        <div className="bg-gradient-to-r from-sky-600/90 to-sky-500/80 text-white px-6 py-3.5 rounded-2xl flex items-center gap-4 shadow-[0_0_20px_rgba(14,165,233,0.3)] border border-sky-400 hover:scale-[1.02] transition-all cursor-default">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-200 shadow-[0_0_8px_rgba(255,255,255,1)] animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-100/90">{COLUMN_LABELS.rqd_est}</span>
            <span className="text-2xl font-black font-mono leading-none mt-1">{calculated.rqd_est.toFixed(2)}%</span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-violet-600/90 to-violet-500/80 text-white px-6 py-3.5 rounded-2xl flex items-center gap-4 shadow-[0_0_20px_rgba(139,92,246,0.3)] border border-violet-400 hover:scale-[1.02] transition-all cursor-default">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-200 shadow-[0_0_8px_rgba(255,255,255,1)]" />
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-100/90">{COLUMN_LABELS.gsi_visual}</span>
            <span className="text-2xl font-black font-mono leading-none mt-1">{gsiVisual}</span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-amber-600/90 to-amber-500/80 text-white px-6 py-3.5 rounded-2xl flex items-center gap-4 shadow-[0_0_20px_rgba(245,158,11,0.3)] border border-amber-400 hover:scale-[1.02] transition-all cursor-default">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-200 shadow-[0_0_8px_rgba(255,255,255,1)]" />
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-100/90">{COLUMN_LABELS.rmr_76}</span>
            <span className="text-2xl font-black font-mono leading-none mt-1">{calculated.rmr_76.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-pink-600/90 to-pink-500/80 text-white px-6 py-3.5 rounded-2xl flex items-center gap-4 shadow-[0_0_20px_rgba(236,72,153,0.3)] border border-pink-400 hover:scale-[1.02] transition-all cursor-default">
          <div className="w-2.5 h-2.5 rounded-full bg-pink-200 shadow-[0_0_8px_rgba(255,255,255,1)]" />
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-pink-100/90">{COLUMN_LABELS.rmr_89}</span>
            <span className="text-2xl font-black font-mono leading-none mt-1">{calculated.rmr_89.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* TABLA DE VALORACIÓN DINÁMICA */}
      <div className="overflow-x-auto rounded-xl border border-navy-800 bg-navy-950/40 shadow-inner">
        <table className="w-full text-left text-xs border-collapse border-separate border-spacing-0" style={{ minWidth: '1200px' }}>
          <thead>
            <tr className="bg-navy-900/80 text-slate-300 font-bold uppercase tracking-wider text-xs border-b border-navy-800">
              <th className="py-3 px-3 text-center sticky left-0 bg-navy-900 z-10 w-20 border-r border-b border-navy-800/80">RATING</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.condicion_agua_short}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.val_agua_sub}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.resistencia_ucs}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.val_resist_sub}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.gsi_superficie}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.gsi_estructura}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.gsi_visual}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.control_estructural_short}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.efectos_voladura_short}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.rqd_valor_sub}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.rqd_est}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.jv}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.block_size}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.global_spacing}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.espac_val_sub}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.condicion_rating_sub}</th>
              <th className="py-3 px-3 text-center border-r border-b border-navy-800/80 bg-navy-900/40 text-slate-200 font-extrabold shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]">{COLUMN_LABELS.rmr_final_sub}</th>
              <th className="py-3 px-2 text-center border-r border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.ucs_mpa}</th>
              <th className="py-3 px-2 text-center border-b border-navy-800/80 bg-navy-900/20">{COLUMN_LABELS.is50_mpa}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-900/50 text-slate-300 font-medium text-xs">
            {/* RMR'76 */}
            <tr className="hover:bg-navy-900/30 transition-colors bg-amber-500/[0.01]">
              <td className="py-3 px-3 text-center font-black text-amber-400 bg-amber-500/10 sticky left-0 z-10 w-20 border-r border-b border-navy-800/80 shadow-[2px_0_5px_rgba(245,158,11,0.15)]">{(76).toFixed(2)}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80">{header.condicion_agua}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-bold text-amber-400 bg-amber-500/[0.04]">
                <FormulaTooltipTrigger formulaId="val_agua_r76" params={{ code: header.condicion_agua, val: calculated.water_rating_76 }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.water_rating_76.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-bold">
                <FormulaTooltipTrigger formulaId="resistencia_ucs" params={{ val: currentResistGrade }} position="bottom" enabled={showFormulas}>
                  <span>{currentResistGrade}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-bold text-amber-400 bg-amber-500/[0.04]">
                <FormulaTooltipTrigger formulaId="val_resist_r76" params={{ code: header.resistencia_ucs, val: calculated.ucs_rating_76 }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.ucs_rating_76.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80">{gsiCond}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80">{gsiEstruc}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80">{gsiVisual?.toFixed(2) ?? '—'}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80">{ctrl?.toFixed(2) ?? '—'}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80">{vol?.toFixed(2) ?? '—'}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-bold text-amber-400 bg-amber-500/[0.04]">
                <FormulaTooltipTrigger formulaId="rqd_rating_r76" params={{ rqd: calculated.rqd_est, val: calculated.rqd_rating_76 }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.rqd_rating_76?.toFixed(2) ?? '—'}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-mono text-slate-400">
                <FormulaTooltipTrigger formulaId="rqd_est" params={{ jv: calculated.jv, val: calculated.rqd_est }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.rqd_est.toFixed(2)}%</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-mono text-slate-400">
                <FormulaTooltipTrigger formulaId="jv" params={{ val: calculated.jv }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.jv > 0 ? calculated.jv.toFixed(4) : '0.0000'}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-mono text-slate-400">
                <FormulaTooltipTrigger formulaId="block_size" params={{ global_spacing: calculated.global_spacing, val: calculated.block_size }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.block_size > 0 ? calculated.block_size.toFixed(2) : '0.00'}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-mono text-sky-400">
                <FormulaTooltipTrigger formulaId="global_spacing" params={{ val: calculated.global_spacing }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.global_spacing.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-bold text-amber-400 bg-amber-500/[0.04]">
                <FormulaTooltipTrigger formulaId="spacing_rating_r76" params={{ spacing: calculated.global_spacing, val: calculated.spacing_rating_76 }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.spacing_rating_76.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-bold text-amber-400 bg-amber-500/[0.04]">
                <FormulaTooltipTrigger formulaId="condicion_rating_r76" params={{ val: calculated.condicion_rating_76 }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.condicion_rating_76.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-3 text-center border-r border-b border-navy-800/80 font-black text-amber-400 bg-amber-500/20 text-sm shadow-[inset_0_0_10px_rgba(245,158,11,0.2)]">
                <FormulaTooltipTrigger formulaId="rmr_76" params={{ ucs: calculated.ucs_rating_76, rqd: calculated.rqd_rating_76, spacing: calculated.spacing_rating_76, cond: calculated.condicion_rating_76, water: calculated.water_rating_76 }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.rmr_76.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 text-slate-400">{ucs !== undefined ? ucs.toFixed(2) : '—'}</td>
              <td className="py-3 px-2 text-center border-b border-navy-800/80 text-slate-400">{is50 !== undefined ? is50.toFixed(2) : '—'}</td>
            </tr>

            {/* RMR'89 */}
            <tr className="hover:bg-navy-900/30 transition-colors bg-pink-500/[0.01]">
              <td className="py-3 px-3 text-center font-black text-pink-400 bg-pink-500/10 sticky left-0 z-10 w-20 border-r border-b border-navy-800/80 shadow-[2px_0_5px_rgba(236,72,153,0.15)]">{(89).toFixed(2)}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80">{header.condicion_agua}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-bold text-pink-400 bg-pink-500/[0.04]">
                <FormulaTooltipTrigger formulaId="val_agua_r89" params={{ code: header.condicion_agua, val: calculated.water_rating_89 }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.water_rating_89.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-bold">
                <FormulaTooltipTrigger formulaId="resistencia_ucs" params={{ val: currentResistGrade }} position="bottom" enabled={showFormulas}>
                  <span>{currentResistGrade}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-bold text-pink-400 bg-pink-500/[0.04]">
                <FormulaTooltipTrigger
                  formulaId="val_resist_r89"
                  params={{
                    code: header.resistencia_ucs,
                    val: calculated.ucs_rating_89,
                    ucs: header.ucs_mpa,
                    discreto: header.ucs_mpa ? ratingDiscretoResistencia(header.ucs_mpa) : undefined,
                    continuo: header.ucs_mpa ? ratingContinuoResistencia(header.ucs_mpa) : undefined
                  }}
                  position="bottom"
                  enabled={showFormulas}
                >
                  <span>{calculated.ucs_rating_89.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80">{gsiCond}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80">{gsiEstruc}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80">{gsiVisual?.toFixed(2) ?? '—'}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80">{ctrl?.toFixed(2) ?? '—'}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80">{vol?.toFixed(2) ?? '—'}</td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-bold text-pink-400 bg-pink-500/[0.04]">
                <FormulaTooltipTrigger
                  formulaId="rqd_rating_r89"
                  params={{
                    rqd: calculated.rqd_est,
                    val: calculated.rqd_rating_89,
                    discreto: ratingDiscretoRqd(calculated.rqd_est),
                    continuo: ratingContinuoRqd(calculated.rqd_est)
                  }}
                  position="bottom"
                  enabled={showFormulas}
                >
                  <span>{calculated.rqd_rating_89.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-mono text-slate-400">
                <FormulaTooltipTrigger formulaId="rqd_est" params={{ jv: calculated.jv, val: calculated.rqd_est }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.rqd_est.toFixed(2)}%</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-mono text-slate-400">
                <FormulaTooltipTrigger formulaId="jv" params={{ val: calculated.jv }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.jv > 0 ? calculated.jv.toFixed(4) : '0.0000'}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-mono text-slate-400">
                <FormulaTooltipTrigger formulaId="block_size" params={{ global_spacing: calculated.global_spacing, val: calculated.block_size }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.block_size > 0 ? calculated.block_size.toFixed(2) : '0.00'}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-mono text-sky-400">
                <FormulaTooltipTrigger formulaId="global_spacing" params={{ val: calculated.global_spacing }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.global_spacing.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-bold text-pink-400 bg-pink-500/[0.04]">
                <FormulaTooltipTrigger formulaId="spacing_rating_r89" params={{ spacing: calculated.global_spacing, val: calculated.spacing_rating_89 }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.spacing_rating_89.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 font-bold text-pink-400 bg-pink-500/[0.04]">
                <FormulaTooltipTrigger formulaId="condicion_rating_r89" params={{ val: calculated.condicion_rating_89 }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.condicion_rating_89.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-3 text-center border-r border-b border-navy-800/80 font-black text-pink-400 bg-pink-500/20 text-sm shadow-[inset_0_0_10px_rgba(236,72,153,0.2)]">
                <FormulaTooltipTrigger formulaId="rmr_89" params={{ ucs: calculated.ucs_rating_89, rqd: calculated.rqd_rating_89, spacing: calculated.spacing_rating_89, cond: calculated.condicion_rating_89, water: calculated.water_rating_89 }} position="bottom" enabled={showFormulas}>
                  <span>{calculated.rmr_89.toFixed(2)}</span>
                </FormulaTooltipTrigger>
              </td>
              <td className="py-3 px-2 text-center border-r border-b border-navy-800/80 text-slate-400">{ucs !== undefined ? ucs.toFixed(2) : '—'}</td>
              <td className="py-3 px-2 text-center border-b border-navy-800/80 text-slate-400">{is50 !== undefined ? is50.toFixed(2) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* DETALLE FORMULADO */}
      <div className="p-3.5 bg-navy-950/65 rounded-lg border border-navy-900/80 font-mono text-xs text-slate-300 text-left border-l-4 border-indigo-500 shadow-md">
        <strong>Jv</strong> = (1/{p1}) + (1/{p2}) + (1/{p3}) = <strong>{calculated.jv.toFixed(4)}</strong> &nbsp;|&nbsp; <strong>RQD% Est. (Palmström)</strong> = 115 − 3.3 × {calculated.jv.toFixed(4)} = <strong className="text-sky-400">{calculated.rqd_est.toFixed(2)}%</strong>
      </div>
    </div>
  );
}