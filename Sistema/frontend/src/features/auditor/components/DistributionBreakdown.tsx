import { Calendar, BarChart3, User } from 'lucide-react';

interface DistributionBreakdownProps {
    kpis: any;
    filterCampania: string;
    onFilterCampania: (camp: string) => void;
    filterCelda: string;
    onFilterCelda: (celda: string) => void;
    filterGeotecnico: string;
    onFilterGeotecnico: (geo: string) => void;
}

export default function DistributionBreakdown({
    kpis,
    filterCampania,
    onFilterCampania,
    filterCelda,
    onFilterCelda,
    filterGeotecnico,
    onFilterGeotecnico,
}: DistributionBreakdownProps) {
    if (!kpis) return null;

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* DISTRIBUCIÓN POR CAMPAÑA */}
            <div className="rounded-xl border border-cyan-500/10 bg-[#090f1d]/50 p-5 space-y-4 shadow-md shadow-[0_0_20px_rgba(6,182,212,0.01)]">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                    <Calendar size={14} className="text-cyan-400" />
                    <span>Distribución por Campaña Geotécnica</span>
                </h3>
                <div className="rounded-xl border border-navy-800 overflow-hidden bg-slate-950">
                    <div className="max-h-56 overflow-y-auto scrollbar-thin">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 font-extrabold border-b border-navy-900">
                                <tr>
                                    <th className="py-2.5 px-3">Campaña</th>
                                    <th className="py-2.5 px-3 text-center">Filas (N)</th>
                                    <th className="py-2.5 px-3 text-center text-red-400">Alertas (%)</th>
                                    <th className="py-2.5 px-3 text-center text-orange-400">Advs (%)</th>
                                    <th className="py-2.5 px-3 text-center text-yellow-400">Vacíos (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {kpis.distribucion_campania?.map((row: any, idx: number) => {
                                    const isFiltered = filterCampania === row.campania;
                                    return (
                                        <tr
                                            key={idx}
                                            onClick={() => onFilterCampania(row.campania)}
                                            className={`border-b border-slate-900/60 cursor-pointer transition-colors ${isFiltered ? 'bg-indigo-500/15 ring-2 ring-indigo-500/40' : 'hover:bg-slate-900/30'}`}
                                        >
                                            <td className="py-2 px-3 font-bold text-slate-200">{row.campania}</td>
                                            <td className="py-2 px-3 text-center font-mono">{row.discontinuidades}</td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-red-400">
                                                {row.alertas_cant} <span className="text-xs text-slate-500 font-normal">({row.alertas_pct.toFixed(1)}%)</span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-orange-400">
                                                {row.advertencias_cant} <span className="text-xs text-slate-500 font-normal">({row.advertencias_pct.toFixed(1)}%)</span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-yellow-400">
                                                {row.vacios_cant} <span className="text-xs text-slate-500 font-normal">({row.vacios_pct.toFixed(1)}%)</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* DISTRIBUCIÓN POR CELDAS MÁS AFECTADAS */}
            <div className="rounded-xl border border-cyan-500/10 bg-[#090f1d]/50 p-5 space-y-4 shadow-md shadow-[0_0_20px_rgba(6,182,212,0.01)]">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                    <BarChart3 size={14} className="text-cyan-400" />
                    <span>Estaciones Geomecánicas con Más Fallas</span>
                </h3>
                <div className="rounded-xl border border-navy-800 overflow-hidden bg-slate-950">
                    <div className="max-h-56 overflow-y-auto scrollbar-thin">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 font-extrabold border-b border-navy-900">
                                <tr>
                                    <th className="py-2.5 px-3">Celda Padre</th>
                                    <th className="py-2.5 px-3 text-center">Filas (N)</th>
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
                                            className={`border-b border-navy-900/60 cursor-pointer hover:bg-slate-900/30 ${isFiltered ? 'bg-cyan-500/15' : ''}`}
                                        >
                                            <td className="py-2 px-3 font-bold text-slate-200">{row.celda}</td>
                                            <td className="py-2 px-3 text-center font-mono">{row.total_hijas}</td>
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

            {/* RESPONSABLE / GEÓLOGOS */}
            <div className="rounded-xl border border-cyan-500/10 bg-[#090f1d]/50 p-5 space-y-4 shadow-md shadow-[0_0_20px_rgba(6,182,212,0.01)]">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                    <User size={14} className="text-cyan-400" />
                    <span>Fallas Agrupadas por Geotecnista</span>
                </h3>
                <div className="rounded-xl border border-navy-800 overflow-hidden bg-slate-950">
                    <div className="max-h-56 overflow-y-auto scrollbar-thin">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 font-extrabold border-b border-navy-900">
                                <tr>
                                    <th className="py-2.5 px-3">Geotécnico</th>
                                    <th className="py-2.5 px-3 text-center">Registros (N)</th>
                                    <th className="py-2.5 px-3 text-center text-red-400">Alertas (%)</th>
                                    <th className="py-2.5 px-3 text-center text-orange-400">Advs (%)</th>
                                    <th className="py-2.5 px-3 text-center text-yellow-400">Vacíos (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {kpis.distribucion_geotecnico?.map((row: any, idx: number) => {
                                    const isFiltered = filterGeotecnico === row.geotecnico;
                                    return (
                                        <tr
                                            key={idx}
                                            onClick={() => onFilterGeotecnico(row.geotecnico)}
                                            className={`border-b border-navy-900/60 cursor-pointer hover:bg-slate-900/30 ${isFiltered ? 'bg-cyan-500/15' : ''}`}
                                        >
                                            <td className="py-2 px-3 font-bold text-slate-200 truncate max-w-[100px]">{row.geotecnico}</td>
                                            <td className="py-2 px-3 text-center font-mono">{row.discontinuidades}</td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-red-400">
                                                {row.alertas_cant} <span className="text-xs text-slate-500 font-normal">({row.alertas_pct.toFixed(1)}%)</span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-orange-400">
                                                {row.advertencias_cant} <span className="text-xs text-slate-500 font-normal">({row.advertencias_pct.toFixed(1)}%)</span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-yellow-400">
                                                {row.vacios_cant} <span className="text-xs text-slate-500 font-normal">({row.vacios_pct.toFixed(1)}%)</span>
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