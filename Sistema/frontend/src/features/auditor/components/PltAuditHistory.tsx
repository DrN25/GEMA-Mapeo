import React from 'react';
import { Folder } from 'lucide-react';

export interface PltAuditHistoryItem {
    id: string;
    fecha: string;
    archivo: string;
    total_registros: number;
    total_vacios: number;
    total_advertencias: number;
    total_alertas: number;
}

interface PltAuditHistoryProps {
    history: PltAuditHistoryItem[];
    selectedAuditId: string;
    onSelectAudit: (auditId: string) => void;
}

export default function PltAuditHistory({
    history,
    selectedAuditId,
    onSelectAudit,
}: PltAuditHistoryProps) {
    return (
        <div className="rounded-xl border border-cyan-500/10 bg-[#090f1d]/50 p-4 shadow-xl select-none">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Folder size={14} className="text-cyan-400" />
                    <span>Historial de Auditorías PLT Realizadas</span>
                </h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {history.length === 0 ? (
                    <span className="text-xs text-slate-500 italic px-2">No hay registros de auditorías PLT anteriores.</span>
                ) : (
                    history.map((audit) => {
                        const isActive = selectedAuditId === audit.id;
                        return (
                            <button
                                key={audit.id}
                                onClick={() => onSelectAudit(audit.id)}
                                className={`flex-shrink-0 p-3 rounded-lg border text-left transition-all ${isActive
                                    ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                    : 'bg-[#0f172a]/40 border-navy-800 hover:border-slate-700 hover:bg-slate-900/40'
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-black text-slate-100 truncate max-w-[180px]" title={audit.archivo}>
                                        {audit.archivo}
                                    </span>
                                    <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-450 font-bold">
                                        {audit.total_registros} filas
                                    </span>
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
