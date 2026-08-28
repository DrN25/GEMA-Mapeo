import React, { useState, useEffect } from 'react';
import { Layers, Activity, ShieldCheck, Sparkles, Database } from 'lucide-react';
import BulkAuditor from './BulkAuditor';
import PltBulkAuditor from './PltBulkAuditor';

interface AuditoriaHubProps {
    apiBase: string;
}

export default function AuditoriaHub({ apiBase }: AuditoriaHubProps) {
    const [auditMode, setAuditMode] = useState<'mapeo' | 'plt'>(() => {
        return (localStorage.getItem('gema_active_audit_mode') as 'mapeo' | 'plt') || 'mapeo';
    });

    useEffect(() => {
        localStorage.setItem('gema_active_audit_mode', auditMode);
    }, [auditMode]);

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-navy-950 overflow-hidden select-none font-sans">
            {/* Barra de Selector Superior */}
            <div className="bg-navy-900 border-b border-navy-800 px-6 py-2.5 flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                        Módulo de Auditoría:
                    </span>
                    <div className="inline-flex p-1 bg-navy-950 rounded-xl border border-navy-800 shadow-inner">
                        {/* Opción 1: Mapeo Geomecánico */}
                        <button
                            onClick={() => setAuditMode('mapeo')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                                auditMode === 'mapeo'
                                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/50'
                            }`}
                        >
                            <Layers size={14} />
                            <span>Mapeo Geomecánico (Ventanas)</span>
                        </button>

                        {/* Opción 2: Ensayos PLT */}
                        <button
                            onClick={() => setAuditMode('plt')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                                auditMode === 'plt'
                                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/50'
                            }`}
                        >
                            <Activity size={14} />
                            <span>Ensayos PLT Irregulares</span>
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                auditMode === 'plt' ? 'bg-navy-950/40 text-slate-900 dark:text-slate-950' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            }`}>
                                QA/QC
                            </span>
                        </button>
                    </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-semibold">
                    <ShieldCheck size={14} className="text-cyan-400" />
                    <span>Control de Calidad Geotécnica SSOT</span>
                </div>
            </div>

            {/* Contenedor del Auditor Activo */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {auditMode === 'mapeo' ? (
                    <BulkAuditor apiBase={apiBase} />
                ) : (
                    <PltBulkAuditor apiBase={apiBase} />
                )}
            </div>
        </div>
    );
}
