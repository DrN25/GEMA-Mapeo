import React from 'react';
import { BarChart3, Eye, EyeOff } from 'lucide-react';

interface PltConsolidatedDeviationsProps {
    kpis: any;
    selectedObservation: string | null;
    setSelectedObservation: (obs: string | null) => void;
    isConsolidatedExpanded: boolean;
    setIsConsolidatedExpanded: (expanded: boolean) => void;
}

export default function PltConsolidatedDeviations({
    kpis,
    selectedObservation,
    setSelectedObservation,
    isConsolidatedExpanded,
    setIsConsolidatedExpanded,
}: PltConsolidatedDeviationsProps) {
    if (!kpis) return null;

    const alertas = kpis.error_types_detailed?.alertas || [];
    const advertencias = kpis.error_types_detailed?.advertencias || [];
    const allItems = [...alertas, ...advertencias];

    if (allItems.length === 0) return null;

    const totalObs = (kpis.familia2?.total_alertas || 0) + (kpis.familia2?.total_advertencias || 0) || 1;
    const displayedItems = isConsolidatedExpanded ? allItems : allItems.slice(0, 5);

    return (
        <div className="rounded-xl border border-cyan-500/10 bg-navy-900/50 p-6 space-y-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-cyan-400 shrink-0" />
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-100">
                            Consolidado de Desviaciones e Inconsistencias PLT
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                            Estatus de control de calidad por tipo de regla evaluada y campaña.
                        </p>
                    </div>
                </div>

                {allItems.length > 5 && (
                    <button
                        onClick={() => {
                            setIsConsolidatedExpanded(!isConsolidatedExpanded);
                            if (isConsolidatedExpanded) setSelectedObservation(null);
                        }}
                        className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-600 border border-cyan-400/30 text-slate-950 px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md active:scale-95 shrink-0"
                    >
                        {isConsolidatedExpanded ? (
                            <>
                                <EyeOff size={14} />
                                <span>Ver Top 5 Críticos</span>
                            </>
                        ) : (
                            <>
                                <Eye size={14} />
                                <span>Ver Todas las Reglas ({allItems.length})</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Listado de Barras de Incidencias */}
            <div className="space-y-3">
                {displayedItems.map((item, idx) => {
                    const isSelected = selectedObservation === item.mensaje;
                    const pctGlobal = ((item.cantidad || 0) / totalObs * 100).toFixed(1);
                    const isAlert = alertas.some((a: any) => a.mensaje === item.mensaje);

                    return (
                        <div
                            key={idx}
                            onClick={() => setSelectedObservation(isSelected ? null : item.mensaje)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                                isSelected
                                    ? 'bg-cyan-500/10 border-cyan-500 shadow-md ring-1 ring-cyan-500/30'
                                    : 'bg-navy-900/40 border-navy-800 hover:bg-navy-850/60 hover:border-navy-700'
                            }`}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                        isAlert ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                                    }`}>
                                        {isAlert ? 'ALERTA' : 'ADVERTENCIA'}
                                    </span>
                                    <span className="font-bold text-slate-200">{item.mensaje}</span>
                                </div>
                                <div className="flex items-center gap-3 font-mono">
                                    <span className="text-slate-400 font-bold">{item.cantidad} casos</span>
                                    <span className={`font-black ${isAlert ? 'text-red-400' : 'text-orange-400'}`}>
                                        {pctGlobal}%
                                    </span>
                                </div>
                            </div>

                            {/* Barra de Progreso */}
                            <div className="w-full bg-navy-950 rounded-full h-1.5 mt-2.5 overflow-hidden border border-navy-800">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        isAlert ? 'bg-gradient-to-r from-red-600 to-rose-400' : 'bg-gradient-to-r from-amber-600 to-orange-400'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(2, parseFloat(pctGlobal)))}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
