/**
 * features/scan/ScanJointsEditor.tsx — Tabla editable de discontinuidades
 * detectadas por el escaneo. Campos faltantes en rojo, filas removibles.
 */
import React from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { handleNumberInputLimit } from '../../utils/inputLimits';
import type { ScanJointRow } from './types';

const JOINT_FIELDS: { key: keyof ScanJointRow; label: string; type: 'num' | 'text'; int?: number; dec?: number }[] = [
  { key: 'distancia_m', label: 'Dist (m)', type: 'num', int: 4, dec: 3 },
  { key: 'tipo_estructura', label: 'Tipo', type: 'text' },
  { key: 'dip', label: 'Dip', type: 'num', int: 3, dec: 0 },
  { key: 'dip_dir', label: 'Dip Dir', type: 'num', int: 3, dec: 0 },
  { key: 'n_estructuras', label: 'N est', type: 'num', int: 3, dec: 0 },
  { key: 'abertura_mm', label: 'Abert (mm)', type: 'num', int: 5, dec: 1 },
  { key: 'espesor_mm', label: 'Esp (mm)', type: 'num', int: 5, dec: 1 },
  { key: 'continuidad_m', label: 'Cont (m)', type: 'num', int: 2, dec: 2 },
  { key: 'espaciamiento_m', label: 'Espac (m)', type: 'num', int: 2, dec: 2 },
  { key: 'n_extremos_visibles', label: 'N extr', type: 'num', int: 2, dec: 0 },
  { key: 'terminacion', label: 'Term', type: 'num', int: 1, dec: 0 },
  { key: 'relleno_1_codigo', label: 'Relleno 1', type: 'text' },
  { key: 'relleno_2_codigo', label: 'Relleno 2', type: 'text' },
  { key: 'jrc', label: 'JRC', type: 'num', int: 2, dec: 0 },
  { key: 'rugosidad_codigo', label: 'Rug', type: 'num', int: 1, dec: 0 },
  { key: 'forma_estructura', label: 'Forma', type: 'text' },
  { key: 'alteracion_codigo', label: 'Alter', type: 'text' },
];

interface ScanJointsEditorProps {
  joints: ScanJointRow[];
  missing: string[][];
  onChange: (joints: ScanJointRow[]) => void;
}

export default function ScanJointsEditor({ joints, missing, onChange }: ScanJointsEditorProps) {
  const updateJoint = (idx: number, key: keyof ScanJointRow, raw: string) => {
    const next = joints.map((j, i) => (i === idx ? { ...j } : j));
    const j = next[idx] as any;
    const field = JOINT_FIELDS.find((f) => f.key === key);
    if (field?.type === 'num') {
      const limited = handleNumberInputLimit(raw, field.int ?? 6, field.dec ?? 2);
      if (limited === '') {
        j[key] = undefined;
      } else {
        const n = parseFloat(limited);
        j[key] = isNaN(n) ? undefined : n;
      }
    } else {
      j[key] = raw || undefined;
    }
    onChange(next);
  };

  const addJoint = () => {
    onChange([
      ...joints,
      {
        numero_estructura: joints.length + 1,
        familia_id: Math.ceil((joints.length + 1) / 3),
        tipo_estructura: 'JN',
        dip: 0,
        dip_dir: 0,
      },
    ]);
  };

  const removeJoint = (idx: number) => {
    onChange(joints.filter((_, i) => i !== idx).map((j, i) => ({ ...j, numero_estructura: i + 1 })));
  };

  const cellClass = (idx: number, key: keyof ScanJointRow) => {
    const isMissing = missing[idx]?.includes(key as string);
    return `w-full bg-navy-900 border rounded px-1.5 py-1 text-[11px] text-slate-100 font-semibold focus:outline-none focus:ring-1 transition-all ${
      isMissing
        ? 'border-rose-500/70 focus:ring-rose-500/60 bg-rose-950/20'
        : 'border-navy-700/80 focus:ring-indigo-500/60'
    }`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
          Discontinuidades Detectadas ({joints.length})
        </span>
        <button
          type="button"
          onClick={addJoint}
          className="flex items-center gap-1 text-[11px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 px-2 py-1 rounded-lg transition-all"
        >
          <Plus size={12} /> Agregar
        </button>
      </div>

      {joints.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-2">
          No se detectaron discontinuidades en la imagen.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-navy-800 bg-navy-950/40">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-[10px] text-slate-400 font-black uppercase tracking-wider border-b border-navy-800 bg-navy-900/80">
                <th className="py-2 px-1.5 w-8">N°</th>
                <th className="py-2 px-1.5 w-10">Fam</th>
                {JOINT_FIELDS.map((f) => (
                  <th key={f.key} className="py-2 px-1.5 min-w-[70px]">{f.label}</th>
                ))}
                <th className="py-2 px-1.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-900/50">
              {joints.map((j, idx) => (
                <tr key={idx} className="hover:bg-navy-900/30">
                  <td className="py-1.5 px-1.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-1.5 px-1.5">
                    <input
                      type="text"
                      value={j.familia_id ?? ''}
                      onChange={(e) => updateJoint(idx, 'familia_id', e.target.value)}
                      className={cellClass(idx, 'familia_id')}
                    />
                  </td>
                  {JOINT_FIELDS.map((f) => (
                    <td key={f.key} className="py-1.5 px-1.5">
                      {f.type === 'num' ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={j[f.key] ?? ''}
                          onChange={(e) => updateJoint(idx, f.key, e.target.value)}
                          className={cellClass(idx, f.key)}
                        />
                      ) : (
                        <input
                          type="text"
                          value={j[f.key] ?? ''}
                          onChange={(e) => updateJoint(idx, f.key, e.target.value)}
                          className={cellClass(idx, f.key)}
                        />
                      )}
                    </td>
                  ))}
                  <td className="py-1.5 px-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeJoint(idx)}
                      className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all"
                      title="Eliminar estructura"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {missing.some((m) => m.length > 0) && (
        <p className="flex items-center gap-1.5 text-[11px] text-rose-400/80">
          <AlertTriangle size={11} />
          Campos en rojo no fueron detectados en la imagen. Puede completarlos o importar con los valores actuales.
        </p>
      )}
    </div>
  );
}
