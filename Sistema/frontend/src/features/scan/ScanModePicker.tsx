/**
 * features/scan/ScanModePicker.tsx — Selector de las 2 opciones de escaneo:
 *  1. Importar en la celda actual (targetCelda)
 *  2. Importar como nueva celda (verificación de duplicados, como el Excel)
 */
import React from 'react';
import { Target, FilePlus2, AlertTriangle } from 'lucide-react';
import type { ScanMode } from './types';

interface ScanModePickerProps {
  mode: ScanMode;
  onChange: (mode: ScanMode) => void;
  targetCelda: string | null;
  hasActiveWindow: boolean;
}

export default function ScanModePicker({ mode, onChange, targetCelda, hasActiveWindow }: ScanModePickerProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">
        Modo de Escaneo
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Opción 1: celda actual */}
        <button
          type="button"
          disabled={!hasActiveWindow}
          onClick={() => onChange('actual')}
          className={`p-3 rounded-xl border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            mode === 'actual'
              ? 'bg-cyan-600/20 border-cyan-500 text-slate-100 shadow-md ring-1 ring-cyan-500/50'
              : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:bg-navy-800/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <Target size={14} className={mode === 'actual' ? 'text-cyan-400' : 'text-slate-500'} />
              Escanear en Celda Actual
            </span>
            {!hasActiveWindow && <AlertTriangle size={13} className="text-amber-500" />}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {hasActiveWindow
              ? <>Los valores detectados se importan a la celda <strong className="text-cyan-400 font-mono">{targetCelda}</strong>.</>
              : 'Abra primero una celda para usar este modo.'}
          </p>
        </button>

        {/* Opción 2: nueva celda */}
        <button
          type="button"
          onClick={() => onChange('nueva')}
          className={`p-3 rounded-xl border text-left transition-all ${
            mode === 'nueva'
              ? 'bg-emerald-600/20 border-emerald-500 text-slate-100 shadow-md ring-1 ring-emerald-500/50'
              : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:bg-navy-800/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <FilePlus2 size={14} className={mode === 'nueva' ? 'text-emerald-400' : 'text-slate-500'} />
              Escanear Nueva(s) Celda(s)
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded">Recomendado</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cada estación detectada crea un borrador. El único campo obligatorio es el nombre de la celda.
          </p>
        </button>
      </div>
    </div>
  );
}
