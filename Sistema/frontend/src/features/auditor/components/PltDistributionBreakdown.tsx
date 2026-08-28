import React from 'react';
import { Calendar, BarChart3, Layers } from 'lucide-react';

interface PltDistributionBreakdownProps {
    kpis: any;
    filterCampania: string;
    onFilterCampania: (camp: string) => void;
    filterCelda: string;
    onFilterCelda: (celda: string) => void;
    filterLitologia: string;
    onFilterLitologia: (lito: string) => void;
}

export default function PltDistributionBreakdown({
    kpis,
    filterCampania,
    onFilterCampania,
    filterCelda,
    onFilterCelda,
    filterLitologia,
    onFilterLitologia,
}: PltDistributionBreakdownProps) {
    if (!kpis) return null;

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* DISTRIBUCIÓN POR CAMPAÑA */}
            <div className="rounded-xl border border-cyan-500/10 bg-navy-900/50 p-5 space-y-4 shadow-md">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                    <Calendar size={14} className="text-cyan-400" />
                    <span>Distribución por Campaña Geotécnica</span>
                </h3>
                <div className="rounded-xl border border-navy-800 overflow-hidden bg-navy-950">
                    <div className="max-h-56 overflow-y-auto overflow-x-auto scrollbar-thin">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-navy-900 text-slate-400 font-extrabold border-b border-navy-800">
                                <tr>
                                    <th className="py-2.5 px-3">Campaña</th>
                                    <th className="py-2.5 px-3 text-center">Regs (N)</th>
                                    <th className="py-2.5 px-3 text-center text-red-400">Alertas (%)</th>
                                    <th className="py-2.5 px-3 text-center text-orange-400">Advs (%)</th>
                                    <th className="py-2.5 px-3 text-center text-yellow-400">Vacíos (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {kpis.distribucion_campania?.map((row: any, idx: number) => {
                                    const isFiltered = filterCampania === String(row.campania);
                                    return (
                                        <tr
                                            key={idx}
                                            onClick={() => onFilterCampania(String(row.campania))}
                                            className={`border-b border-navy-900/60 cursor-pointer hover:bg-navy-800/30 ${isFiltered ? 'bg-cyan-500/15' : ''}`}
                                        >
                                            <td className="py-2 px-3 font-bold text-slate-200">{row.campania}</td>
                                            <td className="py-2 px-3 text-center font-mono">{row.registros}</td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-red-400">
                                                {row.alertas_cant} <span className="text-[10px] text-slate-500 font-normal">({row.alertas_pct?.toFixed(1)}%)</span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-orange-400">
                                                {row.advertencias_cant} <span className="text-[10px] text-slate-500 font-normal">({row.advertencias_pct?.toFixed(1)}%)</span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-yellow-400">
                                                {row.vacios_cant} <span className="text-[10px] text-slate-500 font-normal">({row.vacios_pct?.toFixed(1)}%)</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* CELDAS CON MÁS FALLAS */}
            <div className="rounded-xl border border-cyan-500/10 bg-navy-900/50 p-5 space-y-4 shadow-md">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                    <BarChart3 size={14} className="text-cyan-400" />
                    <span>Celdas de Mapeo con Más Fallas</span>
                </h3>
                <div className="rounded-xl border border-navy-800 overflow-hidden bg-navy-950">
                    <div className="max-h-56 overflow-y-auto overflow-x-auto scrollbar-thin">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-navy-900 text-slate-400 font-extrabold border-b border-navy-800">
                                <tr>
                                    <th className="py-2.5 px-3">Celda</th>
                                    <th className="py-2.5 px-3 text-center">Muestras</th>
                                    <th className="py-2.5 px-3 text-center text-red-400">Alertas</th>
                                    <th className="py-2.5 px-3 text-center text-orange-400">Advs</th>
                                    <th className="py-2.5 px-3 text-center text-yellow-400">Vacíos</th>
                                </tr>
                            </thead>
                            <tbody>
                                {kpis.worst_cells?.slice(0, 10).map((row: any, idx: number) => {
                                    const isFiltered = filterCelda === row.celda;
                                    return (
                                        <tr
                                            key={idx}
                                            onClick={() => onFilterCelda(row.celda)}
                                            className={`border-b border-navy-900/60 cursor-pointer hover:bg-navy-800/30 ${isFiltered ? 'bg-cyan-500/15' : ''}`}
                                        >
                                            <td className="py-2 px-3 font-bold text-slate-200">{row.celda}</td>
                                            <td className="py-2 px-3 text-center font-mono">{row.total_muestras ?? row.total_hijas ?? 4}</td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-red-400">{row.alertas}</td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-orange-400">{row.advertencias}</td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-yellow-400">{row.vacios}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* DISTRIBUCIÓN POR TIPO LITOLÓGICO */}
            <div className="rounded-xl border border-cyan-500/10 bg-navy-900/50 p-5 space-y-4 shadow-md">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                    <Layers size={14} className="text-cyan-400" />
                    <span>Fallas Agrupadas por Tipo Litológico</span>
                </h3>
                <div className="rounded-xl border border-navy-800 overflow-hidden bg-navy-950">
                    <div className="max-h-56 overflow-y-auto overflow-x-auto scrollbar-thin">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-navy-900 text-slate-400 font-extrabold border-b border-navy-800">
                                <tr>
                                    <th className="py-2.5 px-3">Tipo Litológico</th>
                                    <th className="py-2.5 px-3 text-center">Regs (N)</th>
                                    <th className="py-2.5 px-3 text-center text-red-400">Alertas (%)</th>
                                    <th className="py-2.5 px-3 text-center text-orange-400">Advs (%)</th>
                                    <th className="py-2.5 px-3 text-center text-yellow-400">Vacíos (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {kpis.distribucion_litologia?.map((row: any, idx: number) => {
                                    const isFiltered = filterLitologia === row.tipo_litologico;
                                    return (
                                        <tr
                                            key={idx}
                                            onClick={() => onFilterLitologia(row.tipo_litologico)}
                                            className={`border-b border-navy-900/60 cursor-pointer hover:bg-navy-800/30 ${isFiltered ? 'bg-cyan-500/15' : ''}`}
                                        >
                                            <td className="py-2 px-3 font-bold text-slate-200 truncate max-w-[120px]">{row.tipo_litologico}</td>
                                            <td className="py-2 px-3 text-center font-mono">{row.registros}</td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-red-400">
                                                {row.alertas_cant} <span className="text-[10px] text-slate-500 font-normal">({row.alertas_pct?.toFixed(1)}%)</span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-orange-400">
                                                {row.advertencias_cant} <span className="text-[10px] text-slate-500 font-normal">({row.advertencias_pct?.toFixed(1)}%)</span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-yellow-400">
                                                {row.vacios_cant} <span className="text-[10px] text-slate-500 font-normal">({row.vacios_pct?.toFixed(1)}%)</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
