import React from 'react';
import { ShieldAlert, AlertTriangle, X, ShieldX } from 'lucide-react';

interface SaveErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  errorMessage: string;
}

export default function SaveErrorModal({
  isOpen,
  onClose,
  title = 'No Se Pudo Guardar',
  errorMessage
}: SaveErrorModalProps) {
  if (!isOpen) return null;

  const isPermissionDenied = errorMessage.toLowerCase().includes('acceso denegado') ||
    errorMessage.toLowerCase().includes('no tiene permiso') ||
    errorMessage.toLowerCase().includes('rol') ||
    errorMessage.toLowerCase().includes('403') ||
    errorMessage.toLowerCase().includes('401');

  return (
    <div className="fixed inset-0 view-modal z-[120] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in text-left font-sans select-none">
      <div className="glass-panel w-full max-w-md flex flex-col border border-rose-500/30 rounded-2xl shadow-2xl relative overflow-hidden bg-[#090f1d] text-slate-100">

        {/* Superior Accent Line */}
        <div className="h-1.5 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 w-full shrink-0" />

        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.15)]">
              {isPermissionDenied ? <ShieldX size={20} /> : <ShieldAlert size={20} />}
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                {isPermissionDenied ? 'Acceso Denegado' : title}
              </h3>
              <p className="text-xs text-rose-400/90 font-semibold">
                {isPermissionDenied ? 'Permisos insuficientes para modificar datos' : 'No se pudo sincronizar con SQL Server'}
              </p>
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
        <div className="p-6 space-y-4">
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-200 text-xs font-semibold leading-relaxed flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-300">Detalle del Error:</p>
              <p className="text-slate-200 font-medium">{errorMessage}</p>
            </div>
          </div>

          <div className="p-3 bg-navy-950/80 border border-slate-800 rounded-xl text-[11px] text-slate-400 text-center leading-normal">
            💡 <span className="font-bold text-slate-300">Nota:</span> Tus borradores locales se mantienen seguros en sesión y no se han perdido.
          </div>
        </div>

        {/* Modal Footer Action */}
        <div className="px-6 py-4 border-t border-navy-800/80 bg-navy-950/40 flex justify-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black tracking-wide transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] active:scale-95 flex items-center justify-center gap-2 uppercase"
          >
            <span>Entendido, Regresar</span>
          </button>
        </div>

      </div>
    </div>
  );
}
