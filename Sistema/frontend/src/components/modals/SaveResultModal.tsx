import { CheckCircle2, Database, Layers, FileCheck, X } from 'lucide-react';

interface SaveResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedCount: number;
  totalEdits: number;
  totalJoints: number;
  serverMessage?: string;
}

export default function SaveResultModal({
  isOpen,
  onClose,
  savedCount,
  totalEdits,
  totalJoints,
  serverMessage = 'Todos los datos fueron validados y guardados exitosamente en SQL Server.'
}: SaveResultModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in text-left">
      <div className="glass-panel w-full max-w-md flex flex-col border border-emerald-500/30 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/95 text-slate-100">
        
        {/* Superior Accent Line */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 w-full shrink-0" />

        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                Guardado Completado Exitósamente
              </h3>
              <p className="text-xs text-slate-400">Sincronización con base de datos finalizada</p>
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
        <div className="p-6 space-y-5">
          
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-navy-950/80 border border-emerald-500/20 p-3 rounded-xl text-center flex flex-col items-center">
              <Database size={16} className="text-emerald-400 mb-1" />
              <span className="text-lg font-black font-mono text-emerald-400">{savedCount}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Celdas</span>
            </div>

            <div className="bg-navy-950/80 border border-emerald-500/20 p-3 rounded-xl text-center flex flex-col items-center">
              <FileCheck size={16} className="text-teal-400 mb-1" />
              <span className="text-lg font-black font-mono text-teal-400">{totalEdits}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cambios</span>
            </div>

            <div className="bg-navy-950/80 border border-emerald-500/20 p-3 rounded-xl text-center flex flex-col items-center">
              <Layers size={16} className="text-cyan-400 mb-1" />
              <span className="text-lg font-black font-mono text-cyan-400">{totalJoints}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Joints</span>
            </div>
          </div>

          {/* Server Message Banner */}
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs text-center font-medium">
            {serverMessage}
          </div>

        </div>

        {/* Modal Footer Action */}
        <div className="px-6 py-4 border-t border-navy-800/80 bg-navy-950/40 flex justify-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 text-xs font-black tracking-wide transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Entendido, Continuar</span>
          </button>
        </div>

      </div>
    </div>
  );
}
