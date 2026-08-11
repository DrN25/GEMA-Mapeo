import { WifiOff, RotateCcw } from 'lucide-react';

interface ConnectionLostOverlayProps {
  isOpen: boolean;
  onRetry: () => void;
}

export default function ConnectionLostOverlay({ isOpen, onRetry }: ConnectionLostOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#02040a]/90 backdrop-blur-md animate-fade-in font-sans select-none">
      <div className="w-full max-w-md bg-[#090f1d] border border-amber-500/40 rounded-2xl shadow-2xl p-8 space-y-5 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
          <WifiOff size={26} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Conexión con el servidor perdida</h3>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            No se pudo contactar con el servidor del sistema. Puede estar dormido (Render) o detenido. Para continuar, recarga la página: al cargar, el sistema despertará el servidor automáticamente. Tus datos de mapeo se conservan en esta sesión.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 pt-1">
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <RotateCcw size={14} />
            <span>Recargar página</span>
          </button>
          <button
            onClick={onRetry}
            className="w-full py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 border border-navy-700 text-slate-300 text-xs font-bold transition-all active:scale-95"
          >
            Reintentar conexión
          </button>
        </div>
      </div>
    </div>
  );
}
