import { useState } from 'react';
import { WifiOff, RotateCcw, RefreshCw } from 'lucide-react';
import { CONNECTION_CONFIG } from '../../config/connection';

interface ConnectionLostOverlayProps {
  isOpen: boolean;
  onRetry: () => Promise<void> | void;
}

export default function ConnectionLostOverlay({ isOpen, onRetry }: ConnectionLostOverlayProps) {
  const [manualRetrying, setManualRetrying] = useState(false);

  if (!isOpen) return null;

  const { modal } = CONNECTION_CONFIG;

  const handleManualRetry = async () => {
    if (manualRetrying) return;
    setManualRetrying(true);
    try {
      await onRetry();
    } finally {
      setManualRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#02040a]/90 backdrop-blur-md animate-fade-in font-sans select-none">
      <div className="w-full max-w-md bg-[#090f1d] border border-amber-500/40 rounded-2xl shadow-2xl p-8 space-y-5 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
          <WifiOff size={26} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">{modal.title}</h3>
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
            <RefreshCw size={12} className="animate-spin" />
            <span>{modal.retryingStatus}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            {modal.description}
          </p>
        </div>
        <div className="flex flex-col gap-2.5 pt-1">
          <button
            onClick={() => { if (window.confirm(modal.reloadConfirmText)) window.location.reload(); }}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <RotateCcw size={14} />
            <span>{modal.reloadButtonText}</span>
          </button>
          <button
            onClick={handleManualRetry}
            disabled={manualRetrying}
            className="w-full py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 border border-navy-700 text-slate-300 text-xs font-bold transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <RefreshCw size={13} className={manualRetrying ? 'animate-spin' : ''} />
            <span>{manualRetrying ? modal.retryingButtonText : modal.retryButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
