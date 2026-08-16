/**
 * features/scan/ScanFieldEditor.tsx — Editor de un campo del preview del
 * escaneo. Si el campo está en `missing` (no detectado por el LLM), muestra
 * contorno ROJO + badge "No detectado" — PERO NO bloquea la importación.
 * Reutiliza la lógica de límites numéricos del sistema (inputLimits).
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { handleNumberInputLimit } from '../../utils/inputLimits';

export interface ScanFieldDef {
  key: string;
  label: string;
  group: string;
  type: 'number' | 'text' | 'date';
  intDigits?: number;
  decDigits?: number;
  placeholder?: string;
}

interface ScanFieldEditorProps {
  field: ScanFieldDef;
  value: any;
  missing: boolean;
  onChange: (key: string, value: any) => void;
  /** Opcional: lista de opciones para combobox (códigos de catálogo). */
  options?: string[];
}

export default function ScanFieldEditor({ field, value, missing, onChange, options }: ScanFieldEditorProps) {
  const isMissing = missing && (value === null || value === undefined || value === '');

  const handleChange = (raw: string) => {
    if (field.type === 'number') {
      const limited = handleNumberInputLimit(raw, field.intDigits ?? 6, field.decDigits ?? 2);
      if (limited === '') {
        onChange(field.key, undefined);
        return;
      }
      const n = parseFloat(limited);
      onChange(field.key, isNaN(n) ? undefined : n);
    } else if (field.type === 'date') {
      onChange(field.key, raw);
    } else {
      onChange(field.key, raw);
    }
  };

  const inputClass = `w-full bg-navy-900 border rounded px-2 py-1.5 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-1 transition-all ${
    isMissing
      ? 'border-rose-500/70 focus:ring-rose-500/60 bg-rose-950/20'
      : 'border-navy-700/80 focus:ring-indigo-500/60'
  }`;

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
        {field.label}
        {isMissing && (
          <span className="flex items-center gap-0.5 text-[9px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded px-1 py-px">
            <AlertTriangle size={8} /> No detectado
          </span>
        )}
      </label>

      {options ? (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(field.key, e.target.value || undefined)}
          className={inputClass + ' cursor-pointer'}
        >
          <option value="" className="bg-navy-950 text-slate-500">— vacío —</option>
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-navy-950 text-slate-200">{opt}</option>
          ))}
        </select>
      ) : field.type === 'date' ? (
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(field.key, e.target.value || undefined)}
          className={inputClass}
        />
      ) : (
        <input
          type="text"
          inputMode={field.type === 'number' ? 'decimal' : undefined}
          value={value ?? ''}
          placeholder={field.placeholder || '—'}
          onChange={(e) => handleChange(e.target.value)}
          className={inputClass}
        />
      )}
    </div>
  );
}
