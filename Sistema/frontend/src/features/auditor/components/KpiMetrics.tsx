import { Map, Layers, Activity } from 'lucide-react';

interface KpiMetricsProps {
    kpis: any;
    numCeldasPadre: number;
    totalDiscontinuidades: number;
    totalMetrosMapped: number;
    periodLabel: string;
    filterTipo: string;
    onFilterTipo: (tipo: string) => void;
}

export default function KpiMetrics({
    kpis,
    numCeldasPadre,
    totalDiscontinuidades,
    totalMetrosMapped,
    periodLabel,
    filterTipo,
    onFilterTipo,
}: KpiMetricsProps) {
    if (!kpis) return null;

    // Cálculo de porcentajes de campos individuales
    const f2 = kpis.familia2 || {};
    const totalFields = f2.total_fields || 1;
    const pctFieldsCorrectos = ((f2.total_correctos || 0) / totalFields * 100).toFixed(1);
    const pctFieldsVacios = ((f2.total_vacios || 0) / totalFields * 100).toFixed(1);
    const pctFieldsAdvs = ((f2.total_advertencias || 0) / totalFields * 100).toFixed(1);
    const pctFieldsAlertas = ((f2.total_alertas || 0) / totalFields * 100).toFixed(1);

    // Cálculo de porcentajes de filas estructurales
    const f3 = kpis.familia3 || {};
    const totalRows = f3.total_discontinuidades || 1;
    const pctDiscsCorrectas = ((f3.discontinuidades_correctas || 0) / totalRows * 100).toFixed(1);
    const pctDiscsVacias = ((f3.discontinuidades_vacios || 0) / totalRows * 100).toFixed(1);
    const pctDiscsAdvs = ((f3.discontinuidades_advertencias || 0) / totalRows * 100).toFixed(1);
    const pctDiscsAlertas = ((f3.discontinuidades_alertas || 0) / totalRows * 100).toFixed(1);

    return (
        <div className="space-y-6">
            {/* MONITOR KPIS METRICAS GENERALES */}
            {kpis.familia1 && (
                <div className="rounded-xl border border-cyan-500/10 bg-[#090f1d]/50 p-5 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-md">
                    <div className="flex items-center justify-between p-2">
                        <div className="space-y-1">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Estaciones Evaluadas</span>
                            <span className="text-3xl font-black text-cyan-400 font-mono block mt-1">
                                {numCeldasPadre.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500 font-semibold block">{periodLabel}</span>
                        </div>
                        <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
                            <Map size={24} />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-2 border-l border-navy-850 pl-6">
                        <div className="space-y-1">
                            <span className="text-xs font-black text-slate-500 uppercase block tracking-wider">Estructuras Registradas</span>
                            <span className="text-3xl font-black text-cyan-400 font-mono block mt-1">
                                {totalDiscontinuidades.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500 font-semibold block">{periodLabel}</span>
                        </div>
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                            <Layers size={24} />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-2 border-l border-navy-850 pl-6">
                        <div className="space-y-1">
                            <span className="text-xs font-black text-slate-500 uppercase block tracking-wider">Metros Mapeados Totales</span>
                            <span className="text-3xl font-black text-cyan-400 font-mono block mt-1">
                                {totalMetrosMapped.toLocaleString()} <span className="text-xs text-slate-500 font-semibold">m</span>
                            </span>
                            <span className="text-xs text-slate-500 font-semibold block">{periodLabel}</span>
                        </div>
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                            <Activity size={24} />
                        </div>
                    </div>
                </div>
            )}

            {/* INTEGRIDAD POR CAMPOS VS DISCONTINUIDADES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AUDITORÍA DE CAMPOS */}
                {kpis.familia2 && (
                    <div className="rounded-xl border border-navy-800 bg-[#090f1d]/50 p-6 space-y-4">
                        <h3 className="text-xs font-black uppercase text-slate-350 border-b border-navy-850 pb-2 flex justify-between">
                            <span>Auditoría de Datos por Celdas Individuales</span>
                            <span className="text-xs bg-slate-900 text-slate-500 px-2 py-0.5 rounded font-mono">
                                Total: {kpis.familia2.total_fields.toLocaleString()} campos
                            </span>
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div className="bg-[#10b981]/5 border border-[#10b981]/20 p-4 rounded-xl text-center shadow-inner">
                                <span className="text-xs font-black text-slate-500 uppercase block">Campos OK</span>
                                <span className="text-2xl font-black text-[#10b981] block mt-2 font-mono">{kpis.familia2.total_correctos.toLocaleString()}</span>
                                <span className="text-xs font-extrabold text-[#10b981] block mt-2 bg-[#10b981]/15 border border-[#10b981]/30 py-0.5 rounded">
                                    {pctFieldsCorrectos}%
                                </span>
                            </div>

                            <button
                                onClick={() => onFilterTipo('VACIO')}
                                className={`border p-4 rounded-xl text-center transition-all ${filterTipo === 'VACIO' ? 'bg-yellow-500/15 border-yellow-500' : 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10'
                                    }`}
                            >
                                <span className="text-xs font-black text-slate-500 uppercase block">Campos Vacíos</span>
                                <span className="text-2xl font-black text-yellow-500 block mt-2 font-mono">{kpis.familia2.total_vacios.toLocaleString()}</span>
                                <span className="text-xs font-extrabold text-yellow-500 block mt-2 bg-yellow-500/15 border border-yellow-500/30 py-0.5 rounded">
                                    {pctFieldsVacios}%
                                </span>
                            </button>

                            <button
                                onClick={() => onFilterTipo('ADVERTENCIA')}
                                className={`border p-4 rounded-xl text-center transition-all ${filterTipo === 'ADVERTENCIA' ? 'bg-orange-500/15 border-orange-500' : 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10'
                                    }`}
                            >
                                <span className="text-xs font-black text-slate-500 uppercase block">Advertencias</span>
                                <span className="text-2xl font-black text-orange-500 block mt-2 font-mono">{kpis.familia2.total_advertencias.toLocaleString()}</span>
                                <span className="text-xs font-extrabold text-orange-500 block mt-2 bg-orange-500/10 border border-orange-500/20 py-1 rounded">
                                    {pctFieldsAdvs}%
                                </span>
                            </button>

                            <button
                                onClick={() => onFilterTipo('ALERTA')}
                                className={`border p-4 rounded-xl text-center transition-all ${filterTipo === 'ALERTA' ? 'bg-red-500/15 border-red-500' : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                                    }`}
                            >
                                <span className="text-xs font-black text-slate-500 uppercase block">Alertas</span>
                                <span className="text-2xl font-black text-red-500 block mt-2 font-mono">{kpis.familia2.total_alertas.toLocaleString()}</span>
                                <span className="text-xs font-extrabold text-red-500 block mt-2 bg-red-500/15 border border-red-500/30 py-0.5 rounded">
                                    {pctFieldsAlertas}%
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                {/* AUDITORÍA DE REGISTROS (FILAS) */}
                {kpis.familia3 && (
                    <div className="rounded-xl border border-navy-800 bg-[#090f1d]/50 p-6 space-y-4">
                        <h3 className="text-xs font-black uppercase text-slate-350 border-b border-navy-850 pb-2 flex justify-between">
                            <span>Auditoría de Filas de Registro (Corridas/Juntas)</span>
                            <span className="text-xs bg-slate-900 text-slate-500 px-2 py-0.5 rounded font-mono">
                                Total: {kpis.familia3.total_discontinuidades.toLocaleString()} filas
                            </span>
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div className="bg-[#10b981]/5 border border-[#10b981]/20 p-4 rounded-xl text-center">
                                <span className="text-xs font-black text-slate-500 uppercase block">Filas Correctas</span>
                                <span className="text-2xl font-black text-[#10b981] block mt-2 font-mono">{kpis.familia3.discontinuidades_correctas.toLocaleString()}</span>
                                <span className="text-xs font-extrabold text-[#10b981] block mt-2 bg-[#10b981]/15 border border-[#10b981]/30 py-0.5 rounded">
                                    {pctDiscsCorrectas}%
                                </span>
                            </div>

                            <div className="bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-xl text-center">
                                <span className="text-xs font-black text-slate-500 uppercase block">Filas con Vacíos</span>
                                <span className="text-2xl font-black text-yellow-500 block mt-2 font-mono">{kpis.familia3.discontinuidades_vacios.toLocaleString()}</span>
                                <span className="text-xs font-extrabold text-yellow-500 block mt-2 bg-yellow-500/15 border border-yellow-500/30 py-0.5 rounded">
                                    {pctDiscsVacias}%
                                </span>
                            </div>

                            <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-xl text-center">
                                <span className="text-xs font-black text-slate-500 uppercase block">Filas con Advs</span>
                                <span className="text-2xl font-black text-orange-500 block mt-2 font-mono">{kpis.familia3.discontinuidades_advertencias.toLocaleString()}</span>
                                <span className="text-xs font-extrabold text-orange-500 block mt-2 bg-orange-500/15 border border-orange-500/30 py-0.5 rounded">
                                    {pctDiscsAdvs}%
                                </span>
                            </div>

                            <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl text-center">
                                <span className="text-xs font-black text-slate-500 uppercase block">Filas con Alertas</span>
                                <span className="text-2xl font-black text-red-500 block mt-2 font-mono">{kpis.familia3.discontinuidades_alertas.toLocaleString()}</span>
                                <span className="text-xs font-extrabold text-red-500 block mt-2 bg-red-500/15 border border-red-500/30 py-0.5 rounded">
                                    {pctDiscsAlertas}%
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}