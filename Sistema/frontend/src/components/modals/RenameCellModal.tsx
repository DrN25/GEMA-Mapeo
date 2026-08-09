import React, { useState, useEffect } from 'react';
import { Pencil, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8001`;
import { getAuthHeaders } from '../../utils/apiClient';

interface RenameCellModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCelda: string;
  existingCeldas?: string[];
  onRename: (newCelda: string) => Promise<void> | void;
}

export default function RenameCellModal({
  isOpen,
  onClose,
  currentCelda,
  existingCeldas = [],
  onRename
}: RenameCellModalProps) {
  const [newCelda, setNewCelda] = useState('');
  const [nameCheckStatus, setNameCheckStatus] = useState<'idle' | 'checking' | 'available' | 'duplicate' | 'same'>('idle');
  const [nameCheckMsg, setNameCheckMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewCelda(currentCelda || '');
      setNameCheckStatus('same');
      setNameCheckMsg('');
      setIsSubmitting(false);
    }
  }, [isOpen, currentCelda]);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    const clean = newCelda.trim().toUpperCase();
    const cleanCurrent = (currentCelda || '').trim().toUpperCase();

    if (!clean) {
      setNameCheckStatus('idle');
      setNameCheckMsg('');
      return;
    }

    if (clean === cleanCurrent) {
      setNameCheckStatus('same');
      setNameCheckMsg('Nombre actual de la celda');
      return;
    }

    const isLocalDuplicate = existingCeldas.some(c => c.trim().toUpperCase() === clean && c.trim().toUpperCase() !== cleanCurrent);

    setNameCheckStatus('checking');
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/ventanas-check/${encodeURIComponent(clean)}?current_codigo=${encodeURIComponent(cleanCurrent)}`, { headers: getAuthHeaders() })
        .then(res => {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(data => {
          if (isCancelled) return;
          if (data.exists || isLocalDuplicate) {
            setNameCheckStatus('duplicate');
            setNameCheckMsg(`¡El código de celda '${clean}' ya existe en el sistema!`);
          } else {
            setNameCheckStatus('available');
            setNameCheckMsg(`Código de celda disponible`);
          }
        })
        .catch(() => {
          if (isCancelled) return;
          if (isLocalDuplicate) {
            setNameCheckStatus('duplicate');
            setNameCheckMsg(`¡La celda '${clean}' ya existe en el sistema!`);
          } else {
            setNameCheckStatus('available');
            setNameCheckMsg(`Código de celda disponible`);
          }
        });
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [newCelda, currentCelda, existingCeldas, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCelda.trim().toUpperCase();
    if (!clean || nameCheckStatus === 'duplicate' || nameCheckStatus === 'same') return;

    setIsSubmitting(true);
    try {
      await onRename(clean);
      onClose();
    } catch (err) {
      console.error("Error al renombrar celda:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-navy-800 shadow-2xl bg-navy-900/95 relative overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 w-full absolute top-0 left-0" />
        
        <div className="flex items-center justify-between border-b border-navy-800 pb-3">
          <h3 className="text-sm font-black text-slate-100 tracking-wider uppercase flex items-center gap-2 mt-1">
            <Pencil size={16} className="text-indigo-400" />
            <span>Editar Nombre de Celda</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Código Actual</span>
            <span className="text-sm font-black text-slate-300 font-mono tracking-wider">{currentCelda}</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Nuevo Código de Celda / Ventana
              </label>
              {nameCheckStatus === 'checking' && (
                <span className="text-[10px] text-slate-400 animate-pulse flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Verificando...
                </span>
              )}
              {nameCheckStatus === 'available' && (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Disponible
                </span>
              )}
              {nameCheckStatus === 'duplicate' && (
                <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                  <AlertTriangle size={11} /> Ya existe
                </span>
              )}
            </div>
            
            <input
              type="text"
              required
              maxLength={20}
              placeholder="ej. TD2-001"
              value={newCelda}
              onChange={(e) => setNewCelda(e.target.value.trim().toUpperCase().slice(0, 20))}
              className={`w-full bg-navy-950 border rounded-lg px-3 py-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none font-bold tracking-wider ${
                nameCheckStatus === 'duplicate'
                  ? 'border-rose-500/80 bg-rose-950/20 text-rose-200 focus:ring-1 focus:ring-rose-500'
                  : nameCheckStatus === 'available'
                  ? 'border-emerald-500/80 bg-emerald-950/20 text-emerald-200 focus:ring-1 focus:ring-emerald-500'
                  : 'border-navy-800 focus:ring-1 focus:ring-indigo-500'
              }`}
            />

            {nameCheckStatus === 'duplicate' && (
              <p className="text-[10px] font-bold text-rose-400 mt-1 flex items-center gap-1">
                <AlertTriangle size={12} className="shrink-0" />
                <span>{nameCheckMsg}</span>
              </p>
            )}
          </div>

          <div className="flex gap-2.5 justify-end pt-4 border-t border-navy-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || nameCheckStatus !== 'available'}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md active:scale-95 px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
              <span>Renombrar Celda</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
