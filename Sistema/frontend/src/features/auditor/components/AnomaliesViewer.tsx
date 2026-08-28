import { AlertTriangle, Settings, FileText, Search, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface AnomaliesViewerProps {
    incidencias: any[];
    totalRecords: number;
    filterSearch: string;
    onFilterSearch: (search: string) => void;
    page: number;
    totalPages: number;
    onPageChange: (newPage: number) => void;
    kpis: any;
    isLoading?: boolean;
}

export default function AnomaliesViewer({
    incidencias,
    totalRecords,
    filterSearch,
    onFilterSearch,
    page,
    totalPages,
    onPageChange,
    kpis,
    isLoading = false,
}: AnomaliesViewerProps) {
    if (!kpis) return null;

    const getAlertRankStyle = (idx: number) => {
        if (idx === 0) return 'bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-xs font-black';
        if (idx === 1) return 'bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded text-xs font-black';
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded text-xs font-bold';
    };

    const getWarningRankStyle = (idx: number) => {
        if (idx === 0) return 'bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded text-xs font-black';
        if (idx === 1) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded text-xs font-black';
        return 'bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded text-xs font-bold';
    };

    return (
        <div className="space-y-6 animate-fade-in text-xs">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Alertas Críticas */}
                <div className="rounded-xl border border-navy-800 bg-navy-900/30 p-5 space-y-4 shadow-lg">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-red-400" />
                        <span>Fallas Críticas con Mayor Ocurrencia</span>
                    </h3>
                    <div className="space-y-2.5 max-h-[350px] overflow-y-auto p-1 scrollbar-thin">
                        {kpis.error_types_detailed?.alertas?.map((item: any, idx: number) => {
                            const isFiltered = filterSearch === item.mensaje;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => onFilterSearch(isFiltered ? '' : item.mensaje)}
                                    className={`w-full flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-xl border text-left transition-all ${isFiltered
                                        ? 'bg-red-500/10 border-red-500 shadow-md ring-1 ring-red-500/30'
                                        : 'bg-navy-900/40 border-navy-800 hover:bg-navy-850/60 hover:border-navy-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={getAlertRankStyle(idx)}>{idx + 1}</span>
                                        <span className="text-red-400 font-black uppercase text-xs tracking-wider leading-relaxed block break-words">
                                            {item.mensaje}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0 font-bold">
                                        <span className="bg-navy-950 border border-navy-900 text-slate-400 px-2.5 py-1 rounded-md text-xs">
                                            {item.cantidad} casos
                                        </span>
                                        <span className="bg-cyan-500/10 text-cyan-400 px-2.5 py-1 rounded-md text-xs">
                                            {item.pct.toFixed(1)}%
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Advertencias */}
                <div className="rounded-xl border border-navy-800 bg-navy-900/30 p-5 space-y-4 shadow-lg">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                        <Settings size={14} className="text-amber-500" />
                        <span>Avisos de Inconsistencia RMR</span>
                    </h3>
                    <div className="space-y-2.5 max-h-[350px] overflow-y-auto p-1 scrollbar-thin">
                        {kpis.error_types_detailed?.advertencias?.map((item: any, idx: number) => {
                            const isFiltered = filterSearch === item.mensaje;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => onFilterSearch(isFiltered ? '' : item.mensaje)}
                                    className={`w-full flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-xl border text-left transition-all ${isFiltered
                                        ? 'bg-orange-500/10 border-orange-500 shadow-md ring-1 ring-orange-500/30'
                                        : 'bg-navy-900/40 border-navy-800 hover:bg-navy-850/60 hover:border-navy-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={getWarningRankStyle(idx)}>{idx + 1}</span>
                                        <span className="text-orange-400 font-black uppercase text-xs tracking-wider leading-relaxed block break-words">
                                            {item.mensaje}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0 font-bold">
                                        <span className="bg-navy-950 border border-navy-900 text-slate-400 px-2.5 py-1 rounded-md text-xs">
                                            {item.cantidad} casos
                                        </span>
                                        <span className="bg-orange-500/10 text-orange-400 px-2.5 py-1 rounded-md text-xs">
                                            {item.pct.toFixed(1)}%
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Visor detallado */}
            <div className="rounded-xl border border-cyan-500/10 bg-navy-900/30 p-6 space-y-4 shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                            <FileText size={14} className="text-cyan-400" />
                            <span>Monitor de Anomalías Geomecánicas Paginado</span>
                            {isLoading && (
                                <Loader2 size={14} className="animate-spin text-cyan-400 ml-1.5" />
                            )}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 font-semibold">
                            {isLoading ? (
                                <span className="text-cyan-400 animate-pulse font-bold">Recuperando registros filtrados...</span>
                            ) : (
                                <>Se detectaron **{totalRecords.toLocaleString()}** celdas con observaciones.</>
                            )}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 bg-navy-950 border border-navy-800 rounded-lg px-3 py-1.5 w-full sm:w-64">
                        <Search size={14} className="text-slate-500 shrink-0" />
                        <input
                            type="text"
                            placeholder="Buscar columna, celda, error..."
                            value={filterSearch}
                            onChange={(e) => onFilterSearch(e.target.value)}
                            className="bg-transparent text-xs text-slate-200 focus:outline-none w-full font-bold"
                        />
                        {filterSearch && (
                            <button onClick={() => onFilterSearch('')} className="text-slate-500 hover:text-slate-350">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                <div className={`overflow-x-auto rounded-xl border border-navy-850 bg-navy-950/20 transition-all duration-350 ${isLoading ? 'opacity-40 pointer-events-none' : ''
                    }`}>
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-navy-900 text-slate-400 font-extrabold uppercase border-b border-navy-850 tracking-wider text-xs">
                                <th className="py-3 px-3 text-xs text-center w-16">Fila</th>
                                <th className="py-3 px-3 text-xs">Estación Padre</th>
                                <th className="py-3 px-3 text-xs">Celda Hija</th>
                                <th className="py-3 px-3 text-xs text-center w-24">Campaña</th>
                                <th className="py-3 px-3 text-xs w-28">Geotécnico</th>
                                <th className="py-3 px-3 text-xs w-24 text-center">Sector</th>
                                <th className="py-3 px-3 text-xs w-48 font-mono">Campo (Columna)</th>
                                <th className="py-3 px-3 text-xs text-center w-20">Valor</th>
                                <th className="py-3 px-3 text-xs text-center w-28">Gravedad</th>
                                <th className="py-3 px-3 text-xs">Comentario y Feedback de Consistencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {incidencias.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-8 text-center text-xs text-slate-500 italic font-semibold">
                                        No se encontraron fallas con los criterios de búsqueda establecidos.
                                    </td>
                                </tr>
                            ) : (
                                incidencias.map((item, idx) => {
                                    const severityBadge = item.tipo_incidencia === 'ALERTA'
                                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                        : item.tipo_incidencia === 'ADVERTENCIA'
                                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';

                                    const rawVal = item.valor_actual;
                                    const displayVal = (rawVal === null || rawVal === undefined || String(rawVal).trim() === "" || String(rawVal) === "-1")
                                        ? '—'
                                        : String(rawVal);

                                    return (
                                        <tr key={idx} className="border-b border-navy-900/60 hover:bg-navy-850/40 transition-all font-normal">
                                            <td className="py-2.5 px-3 text-center font-mono text-slate-500">{item.fila_excel}</td>
                                            <td className="py-2.5 px-3 font-bold text-slate-200">{item.celda_padre}</td>
                                            <td className="py-2.5 px-3 text-slate-300">{item.celda_hija}</td>
                                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{item.campania || '—'}</td>
                                            <td className="py-2.5 px-3 text-slate-400 truncate max-w-[110px]">{item.geotecnico || '—'}</td>
                                            <td className="py-2.5 px-3 text-slate-400 text-center">{item.sector_geotecnico || '—'}</td>
                                            <td className="py-2.5 px-3 text-cyan-400 font-mono font-semibold">{item.columna}</td>
                                            <td className="py-2.5 px-3 text-center font-mono text-slate-350">{displayVal}</td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase border ${severityBadge}`}>
                                                    {item.tipo_incidencia === 'VACIO' ? 'VACÍO' : item.tipo_incidencia}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-300 leading-relaxed font-semibold italic">{item.mensaje}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 border-t border-navy-850 text-xs text-slate-500 font-semibold">
                    <span>
                        Página <strong className="text-slate-350">{page}</strong> de <strong className="text-slate-350">{totalPages}</strong>
                    </span>

                    <div className="flex gap-2">
                        <button
                            disabled={page <= 1 || isLoading}
                            onClick={() => onPageChange(page - 1)}
                            className="p-1.5 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={page >= totalPages || isLoading}
                            onClick={() => onPageChange(page + 1)}
                            className="p-1.5 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}