import { BarChart3, ArrowLeft, Eye, EyeOff } from 'lucide-react';

interface ConsolidatedDeviationsProps {
    kpis: any;
    uniqueYears: string[];
    coreObservationTypes: string[];
    selectedObservation: string | null;
    setSelectedObservation: (obs: string | null) => void;
    isConsolidatedExpanded: boolean;
    setIsConsolidatedExpanded: (expanded: boolean) => void;
}

export default function ConsolidatedDeviations({
    kpis,
    uniqueYears,
    coreObservationTypes,
    selectedObservation,
    setSelectedObservation,
    isConsolidatedExpanded,
    setIsConsolidatedExpanded,
}: ConsolidatedDeviationsProps) {
    if (!kpis || !kpis.consolidado_observaciones) return null;

    return (
        <div className="rounded-xl border border-cyan-500/10 bg-navy-900/50 p-6 space-y-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-cyan-400 shrink-0" />
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-100">
                            Consolidado de Desviaciones Geotécnicas
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                            Estatus geomecánico del control de calidad por campaña de perforación.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setIsConsolidatedExpanded(!isConsolidatedExpanded);
                        if (isConsolidatedExpanded) setSelectedObservation(null);
                    }}
                    className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-600 border border-cyan-400/30 text-slate-950 px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md active:scale-95"
                >
                    {isConsolidatedExpanded ? (
                        <>
                            <EyeOff size={14} />
                            <span>Ocultar Consolidado</span>
                        </>
                    ) : (
                        <>
                            <Eye size={14} />
                            <span>Ver Consolidado</span>
                        </>
                    )}
                </button>
            </div>

            {isConsolidatedExpanded && (
                <div className="border-t border-navy-850 pt-4 space-y-6 animate-fade-in">
                    {!selectedObservation ? (
                        <div className="space-y-4">
                            <p className="text-xs text-slate-400 font-semibold">
                                Haz clic sobre un error del listado para desplegar tendencias temporales y taladros de mayor impacto.
                            </p>

                            <div className="overflow-x-auto rounded-lg border border-navy-800">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-navy-800">
                                            <th className="py-3 px-4 text-xs">Tipo de Inconsistencia Geomecánica</th>
                                            {uniqueYears.map(yr => {
                                                const sev = kpis.consolidado_observaciones[yr].severity;
                                                const badgeColor = sev === 'CRÍTICO'
                                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    : sev === 'MODERADO'
                                                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                                                return (
                                                    <th key={yr} className="py-3 px-4 text-center min-w-32 text-xs">
                                                        <div className="font-black text-slate-200">{yr}</div>
                                                        <div className={`mt-1 text-xs font-black tracking-widest px-2.5 py-0.5 rounded-lg uppercase ${badgeColor}`}>
                                                            {sev}
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-navy-850 text-slate-300 font-semibold text-xs bg-navy-900/20">
                                        {coreObservationTypes.map((obsType, oIdx) => (
                                            <tr
                                                key={oIdx}
                                                onClick={() => setSelectedObservation(obsType)}
                                                className="hover:bg-cyan-500/5 cursor-pointer transition-colors"
                                            >
                                                <td className="py-3 px-4 text-slate-100 font-black text-xs">{obsType}</td>
                                                {uniqueYears.map(yr => {
                                                    const val = kpis.consolidado_observaciones[yr]?.[obsType]?.incidents || 0;
                                                    return (
                                                        <td key={yr} className="py-3 px-4 text-center font-mono">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-black border ${val > 50
                                                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                                : val > 10
                                                                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                                                    : val > 0
                                                                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                                        : 'bg-navy-900/30 text-slate-500 border-transparent'
                                                                }`}>
                                                                {val.toLocaleString()}
                                                            </span>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-navy-850 pb-4 gap-4">
                                <div>
                                    <button
                                        onClick={() => setSelectedObservation(null)}
                                        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-black uppercase tracking-wider mb-2"
                                    >
                                        <ArrowLeft size={14} />
                                        <span>Volver al Consolidado General</span>
                                    </button>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-100">
                                        Falla: {selectedObservation}
                                    </h3>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-navy-900/30 border border-navy-850 p-4 rounded-xl space-y-3">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                        Ocurrencias por Campaña
                                    </h4>
                                    <div className="flex justify-between items-end h-40 border-b border-navy-850 pb-2">
                                        {uniqueYears.map(yr => {
                                            const val = kpis.consolidado_observaciones[yr]?.[selectedObservation]?.incidents || 0;
                                            const maxVal = Math.max(...uniqueYears.map(y => kpis.consolidado_observaciones[y]?.[selectedObservation]?.incidents || 0), 1);
                                            const heightPct = val > 0 ? 8 + (val / maxVal) * 92 : 0;
                                            return (
                                                <div key={yr} className="flex flex-col items-center flex-1 group">
                                                    <span className="text-xs font-bold text-cyan-400 opacity-0 group-hover:opacity-100 mb-1">{val}</span>
                                                    <div
                                                        style={{ height: `${heightPct}%` }}
                                                        className={`w-8 rounded-t border-t-2 transition-all ${val > 25 ? 'bg-red-500/20 hover:bg-red-500 border-red-500' : 'bg-orange-500/20 hover:bg-orange-500 border-orange-500'
                                                            }`}
                                                    />
                                                    <span className="text-xs font-bold text-slate-500 mt-2">{yr}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="bg-navy-900/30 border border-navy-850 p-4 rounded-xl space-y-3">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                        Estaciones (Celdas Padre) Afectadas por Año
                                    </h4>
                                    <div className="flex justify-between items-end h-40 border-b border-navy-850 pb-2">
                                        {uniqueYears.map(yr => {
                                            const val = kpis.consolidado_observaciones[yr]?.[selectedObservation]?.affected_stations || 0;
                                            const maxVal = Math.max(...uniqueYears.map(y => kpis.consolidado_observaciones[y]?.[selectedObservation]?.affected_stations || 0), 1);
                                            const heightPct = val > 0 ? 8 + (val / maxVal) * 92 : 0;
                                            return (
                                                <div key={yr} className="flex flex-col items-center flex-1 group">
                                                    <span className="text-xs font-bold text-cyan-400 opacity-0 group-hover:opacity-100 mb-1">{val}</span>
                                                    <div
                                                        style={{ height: `${heightPct}%` }}
                                                        className={`w-8 rounded-t border-t-2 transition-all ${val > 5 ? 'bg-red-500/20 hover:bg-red-500 border-red-500' : 'bg-yellow-500/20 hover:bg-yellow-500 border-yellow-500'
                                                            }`}
                                                    />
                                                    <span className="text-xs font-bold text-slate-500 mt-2">{yr}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                    TOP 3 ESTACIONES CON MAYOR RECURRENCIA DEL ERROR
                                </h4>
                                <div className="overflow-x-auto rounded-lg border border-navy-800 bg-navy-950/20">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider border-b border-navy-800">
                                                <th className="py-2.5 px-3 text-center w-24 text-xs">Campaña</th>
                                                <th className="py-2.5 px-3 text-xs">1° Crítica</th>
                                                <th className="py-2.5 px-3 text-xs">2° Crítica</th>
                                                <th className="py-2.5 px-3 text-xs">3° Crítica</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-navy-850 text-slate-300">
                                            {uniqueYears.map(yr => {
                                                const topList = kpis.consolidado_observaciones[yr]?.[selectedObservation]?.top_stations || [];
                                                return (
                                                    <tr key={yr} className="hover:bg-slate-900/10">
                                                        <td className="py-3 px-3 text-center font-black text-xs bg-slate-950/40">{yr}</td>
                                                        <td className="py-3 px-3">
                                                            {topList[0] ? (
                                                                <span className="font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded text-xs">
                                                                    {topList[0].celda} <span className="font-mono font-black">({topList[0].count})</span>
                                                                </span>
                                                            ) : <span className="text-slate-500">—</span>}
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            {topList[1] ? (
                                                                <span className="font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded text-xs">
                                                                    {topList[1].celda} <span className="font-mono font-extrabold">({topList[1].count})</span>
                                                                </span>
                                                            ) : <span className="text-slate-500">—</span>}
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            {topList[2] ? (
                                                                <span className="font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded text-xs">
                                                                    {topList[2].celda} <span className="font-mono font-black">({topList[2].count})</span>
                                                                </span>
                                                            ) : <span className="text-slate-500">—</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}