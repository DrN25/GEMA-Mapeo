import { useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle, Minimize2, MapPin, Tag } from 'lucide-react';
import type { ValidationAlert } from '../utils/qaqcValidator';

interface ValidationPanelProps {
  alerts: ValidationAlert[];
  onFocusField: (fieldId: string) => void;
}

export default function ValidationPanel({ alerts, onFocusField }: ValidationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getAlertContext = (fieldId: string) => {
    if (!fieldId) return { tab: 'Mapeo', column: 'General' };

    if (fieldId.startsWith('header-')) {
      const parts = fieldId.split('-');
      const colName = parts[1] || '';
      let column = 'Cabecera';
      if (colName === 'celda') column = 'Celda';
      else if (colName === 'este_from') column = 'Este FROM';
      else if (colName === 'norte_from') column = 'Norte FROM';
      else if (colName === 'cota_from') column = 'Cota FROM';
      else if (colName === 'este_to') column = 'Este TO';
      else if (colName === 'norte_to') column = 'Norte TO';
      else if (colName === 'cota_to') column = 'Cota TO';
      else if (colName === 'altura') column = 'Altura';
      return { tab: 'Cabecera', column };
    }

    if (fieldId.startsWith('joint-')) {
      const parts = fieldId.split('-');
      const colName = parts[1] || '';
      let column = 'Discontinuidad';
      switch (colName) {
        case 'distancia': column = 'Distancia'; break;
        case 'dip': column = 'Buzamiento (Dip)'; break;
        case 'dip_dir': column = 'Buz. Dir. (DipDir)'; break;
        case 'espaciamiento': column = 'Espaciamiento'; break;
        case 'n_estructuras': column = 'Cantidad (N)'; break;
        case 'abertura': column = 'Abertura'; break;
        case 'espesor': column = 'Espesor'; break;
        case 'continuidad': column = 'Persistencia'; break;
        case 'extremos_visibles': column = 'Ext. Visibles'; break;
      }
      return { tab: 'Estructuras', column };
    }

    return { tab: 'Mapeo', column: 'General' };
  };

  const errorCount = alerts.filter(a => a.type === 'ERROR').length;
  const warningCount = alerts.filter(a => a.type === 'WARNING').length;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center border shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 group backdrop-blur ${
          errorCount > 0 
            ? 'bg-red-50 dark:bg-red-950/85 border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.15)] dark:shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.55)]'
            : warningCount > 0
            ? 'bg-amber-50 dark:bg-amber-950/85 border-amber-200 dark:border-amber-500/50 text-amber-600 dark:text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)] dark:shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.45)]'
            : 'bg-emerald-50 dark:bg-emerald-950/85 border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] dark:shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.35)]'
        }`}
        title={`${alerts.length} validaciones QA/QC pendientes. Haz clic para expandir.`}
      >
        {alerts.length > 0 && (
          <span className={`absolute inset-0 rounded-full animate-ping opacity-25 group-hover:opacity-40 ${
            errorCount > 0 ? 'bg-red-500' : 'bg-amber-500'
          }`} />
        )}
        
        {errorCount > 0 ? (
          <AlertOctagon size={24} className="animate-pulse" />
        ) : warningCount > 0 ? (
          <AlertTriangle size={24} />
        ) : (
          <CheckCircle size={24} />
        )}

        {alerts.length > 0 && (
          <span className={`absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1.5 rounded-full text-xs font-black flex items-center justify-center border shadow-md ${
            errorCount > 0
              ? 'bg-red-500 border-red-400 text-white'
              : 'bg-amber-500 border-amber-400 text-black'
          }`}>
            {alerts.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="w-80 glass-panel rounded-xl border border-navy-800 shadow-2xl p-4 flex flex-col max-h-[380px] overflow-hidden select-none backdrop-blur animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-navy-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Validaciones QA/QC</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {errorCount > 0 && (
              <span className="bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold px-2 py-0.5 rounded-md animate-pulse">
                {errorCount} ERROR
              </span>
            )}
            {warningCount > 0 && (
              <span className="bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-md">
                {warningCount} AVISO
              </span>
            )}
            {alerts.length === 0 && (
              <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-md">
                CONSISTENTE
              </span>
            )}
          </div>
          
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-navy-800 transition-colors"
            title="Minimizar panel"
          >
            <Minimize2 size={14} />
          </button>
        </div>
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
            <CheckCircle size={36} className="text-emerald-500/40 mb-2" />
            <p className="text-sm font-medium text-slate-400">Sin inconsistencias</p>
            <p className="text-xs mt-0.5">El mapeo cumple con la consistencia geométrica y física.</p>
          </div>
        ) : (
          [...alerts]
            .sort((a, b) => (a.type === 'ERROR' ? -1 : 1) - (b.type === 'ERROR' ? -1 : 1))
            .map((alert, idx) => {
              const isError = alert.type === 'ERROR';
              const context = getAlertContext(alert.fieldId);
              
              return (
                <div
                  key={idx}
                  onClick={() => onFocusField(alert.fieldId)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${
                    isError
                      ? 'bg-red-50 dark:bg-red-950/45 border-red-200 dark:border-red-800/40 text-red-800 dark:text-slate-200 hover:bg-red-100 dark:hover:bg-red-950/60'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/30 text-amber-800 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                  }`}
                >
                  <div className="flex gap-2.5 items-start">
                    {isError ? (
                      <AlertOctagon size={16} className="text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className={`inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded-full border ${
                          isError
                            ? 'bg-red-500/20 border-red-500/40 text-red-300'
                            : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        }`}>
                          {isError ? 'Error' : 'Aviso'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-800/70 border border-slate-700/60 text-slate-300">
                          <MapPin size={8} className="text-cyan-400 shrink-0" />
                          {context.tab}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                          <Tag size={8} className="shrink-0" />
                          {context.column}
                        </span>
                      </div>
                      <p className="text-xs leading-snug text-slate-200 font-medium">{alert.message}</p>
                    </div>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
