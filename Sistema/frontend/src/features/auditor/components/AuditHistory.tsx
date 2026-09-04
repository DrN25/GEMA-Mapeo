import { Folder } from 'lucide-react';

export interface AuditHistoryItem {
    audit_id: string;
    fecha: string;
    archivo: string;
    proyecto?: string;
    total_filas: number;
    total_vacios: number;
    total_advertencias: number;
    total_alertas: number;
}

interface AuditHistoryProps {
    history: AuditHistoryItem[];
    selectedAuditId: string;
    onSelectAudit: (auditId: string) => void;
    onOpenCompare: () => void;
}

export default function AuditHistory({
    history,
    selectedAuditId,
    onSelectAudit,
    onOpenCompare,
}: AuditHistoryProps) {
    return (
        <div className="rounded-xl border border-cyan-500/10 bg-navy-900/50 p-4 shadow-xl select-none">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Folder size={14} className="text-cyan-400" />
                    <span>Historial de Importaciones Mapeadas y Revisadas</span>
                </h3>
                {history.length >= 1 && (
                    <button
                        onClick={onOpenCompare}
                        className="bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-400 hover:text-cyan-300 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
                    >
                        <span>Comparar Reportes (A vs B)</span>
                    </button>
                )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {history.length === 0 ? (
                    <span className="text-xs text-slate-500 italic px-2">No hay registros de auditorías anteriores.</span>
                ) : (
                    history.map((audit) => {
                        const isActive = selectedAuditId === audit.audit_id;
                        return (
                            <button
                                key={audit.audit_id}
                                onClick={() => onSelectAudit(audit.audit_id)}
                                className={`flex-shrink-0 p-3 rounded-lg border text-left transition-all ${isActive
                                    ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                    : 'bg-navy-900/40 border-navy-800 hover:border-navy-700 hover:bg-navy-850/50'
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-black text-slate-100 truncate max-w-[150px]" title={audit.archivo}>
                                        {audit.archivo}
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[9px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-mono px-1.5 py-0.5 rounded font-bold uppercase">
                                            {audit.proyecto || 'ferrobamba'}
                                        </span>
                                        <span className="text-xs bg-navy-800 px-2 py-0.5 rounded text-slate-300 font-bold">
                                            {audit.total_filas} filas
                                        </span>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 mt-1.5 flex gap-2 font-semibold">
                                    <span>{audit.fecha}</span>
                                    <span className="text-red-400 font-bold">{audit.total_alertas} Alertas</span>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
