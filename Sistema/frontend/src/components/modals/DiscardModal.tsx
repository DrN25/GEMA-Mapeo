import { useState } from 'react';
import { RotateCcw, AlertOctagon, Check, X, FileSpreadsheet } from 'lucide-react';
import type { WindowData, AllWindowsDiffSummary } from '../../utils/diffUtils';

interface DiscardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDiscard: (scope: 'active' | 'all') => void;
  activeWindow: WindowData | null;
  workspaceDiff: AllWindowsDiffSummary;
}

export default function DiscardModal({
  isOpen,
  onClose,
  onConfirmDiscard,
  activeWindow,
  workspaceDiff
}: DiscardModalProps) {
  if (!isOpen) return null;

  const activeHasChanges = workspaceDiff.activeDiff.hasChanges;

  const [selectedScope, setSelectedScope] = useState<'active' | 'all'>(
    activeHasChanges ? 'active' : 'all'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in text-left">
      <div className="glass-panel w-full max-w-xl flex flex-col border border-rose-500/30 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/95 text-slate-100">
        
        {/* Superior Accent Line */}
        <div className="h-1.5 bg-gradient-to-r from-rose-500 via-red-500 to-rose-700 w-full shrink-0" />

        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.15)]">
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                Descartar Cambios Pendientes
              </h3>
              <p className="text-xs text-slate-400">Revertir modificaciones no guardadas al último estado persistido</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* Scope Selector Options */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
              Seleccione el Alcance a Descartar:
            </label>

            <div className="grid grid-cols-1 gap-3">
              {/* Option 1: Descartar solo Celda Activa */}
              {activeHasChanges && (
                <button
                  type="button"
                  onClick={() => setSelectedScope('active')}
                  className={`p-4 rounded-xl border text-left transition-all relative flex items-start gap-3 ${
                    selectedScope === 'active'
                      ? 'bg-rose-500/10 border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                      : 'bg-navy-950/40 border-navy-800 hover:border-navy-700'
                  }`}
                >
                  <div className={`mt-0.5 p-1 rounded-full border ${selectedScope === 'active' ? 'bg-rose-500 border-rose-400 text-navy-950' : 'border-navy-700'}`}>
                    <Check size={12} className="stroke-[3]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-100">
                        Descartar solo Celda Activa ({activeWindow?.header.celda || 'Celda Activa'})
                      </span>
                      <span className="text-xs font-extrabold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        {workspaceDiff.activeDiff.totalEdits} cambios
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Descarta solo los cambios no guardados en la celda abierta actualmente.
                    </p>
                  </div>
                </button>
              )}

              {/* Option 2: Descartar TODAS las Celdas Pendientes */}
              <button
                type="button"
                onClick={() => setSelectedScope('all')}
                className={`p-4 rounded-xl border text-left transition-all relative flex items-start gap-3 ${
                  selectedScope === 'all'
                    ? 'bg-rose-500/10 border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                    : 'bg-navy-950/40 border-navy-800 hover:border-navy-700'
                }`}
              >
                <div className={`mt-0.5 p-1 rounded-full border ${selectedScope === 'all' ? 'bg-rose-500 border-rose-400 text-navy-950' : 'border-navy-700'}`}>
                  <Check size={12} className="stroke-[3]" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-100">
                      Descartar TODAS las Celdas Pendientes ({workspaceDiff.totalWindowsWithChanges} celdas)
                    </span>
                    <span className="text-xs font-extrabold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      {workspaceDiff.totalCellEditsAll + workspaceDiff.totalJointsAddedAll + workspaceDiff.totalJointsDeletedAll} cambios totales
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Descarta todas las modificaciones sin guardar registradas en la sesión.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="flex items-center gap-3 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
            <AlertOctagon size={20} className="shrink-0 text-rose-400" />
            <span>ATENCIÓN: Esta acción es irreversible. Se perderán las modificaciones no guardadas.</span>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-navy-800/80 bg-navy-950/40 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-300 text-xs font-bold transition-all active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmDiscard(selectedScope)}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black tracking-wide transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] active:scale-95 flex items-center gap-2"
          >
            <RotateCcw size={16} />
            <span>Sí, Descartar Cambios</span>
          </button>
        </div>

      </div>
    </div>
  );
}
