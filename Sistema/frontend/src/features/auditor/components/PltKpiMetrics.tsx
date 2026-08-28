import React from 'react';
import { Layers, Activity, ShieldCheck, CheckCircle2, AlertTriangle, AlertOctagon, Shuffle, AlertCircle } from 'lucide-react';

interface PltKpiMetricsProps {
    kpis: any;
    filterTipo: string;
    onFilterTipo: (tipo: string) => void;
    filterSecuencia?: string;
    onFilterSecuencia?: (sec: string) => void;
}

export default function PltKpiMetrics({
    kpis,
    filterTipo,
    onFilterTipo,
    filterSecuencia = '',
    onFilterSecuencia,
}: PltKpiMetricsProps) {
    if (!kpis) return null;

    // Cálculo de porcentajes de campos individuales (familia2)
    const f2 = kpis.familia2 || {};
    const totalFields = f2.total_fields || 1;
    const pctFieldsCorrectos = ((f2.total_correctos || 0) / totalFields * 100).toFixed(1);
    const pctFieldsVacios = ((f2.total_vacios || 0) / totalFields * 100).toFixed(1);
    const pctFieldsAdvs = ((f2.total_advertencias || 0) / totalFields * 100).toFixed(1);
    const pctFieldsAlertas = ((f2.total_alertas || 0) / totalFields * 100).toFixed(1);

    // Cálculo de porcentajes a nivel de fila (familia3)
    const f3 = kpis.familia3 || {};
    const totalFilas = f3.total_registros || 1;
    const pctFilasCorrectas = ((f3.registros_correctos || 0) / totalFilas * 100).toFixed(1);
    const pctFilasVacias = ((f3.registros_vacio || 0) / totalFilas * 100).toFixed(1);
    const pctFilasAdvs = ((f3.registros_advertencia || 0) / totalFilas * 100).toFixed(1);
    const pctFilasAlertas = ((f3.registros_alerta || 0) / totalFilas * 100).toFixed(1);

    // Integridad Celdas ABCD
    const integ = kpis.integridad_celdas || {};
    const totalCeldas = integ.total_celdas || 1;

    return (
        <div className="space-y-6">
            {/* AUDITORÍA GENERAL / FAMILIA 1 */}
            {kpis.familia1 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-5 space-y-2 relative overflow-hidden">
                        <div className="flex justify-between items-center text-slate-400">
                            <span className="text-xs font-black uppercase tracking-wider">Total Ensayos / Muestras</span>
                            <Layers size={16} className="text-cyan-400" />
                        </div>
                        <span className="text-3xl font-black text-slate-100 font-mono tracking-tight block">
                            {kpis.familia1.total_registros?.toLocaleString() ?? 0}
                        </span>
                        <p className="text-xs text-slate-500 font-semibold">
                            Total de muestras evaluadas en la planilla
                        </p>
                    </div>

                    <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-5 space-y-2 relative overflow-hidden">
                        <div className="flex justify-between items-center text-slate-400">
                            <span className="text-xs font-black uppercase tracking-wider">Celdas de Mapeo</span>
                            <Activity size={16} className="text-cyan-400" />
                        </div>
                        <span className="text-3xl font-black text-slate-100 font-mono tracking-tight block">
                            {kpis.familia1.total_celdas?.toLocaleString() ?? 0}
                        </span>
                        <p className="text-xs text-slate-500 font-semibold">
                            Estaciones de ensayo independientes
                        </p>
                    </div>

                    <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-5 space-y-2 relative overflow-hidden">
                        <div className="flex justify-between items-center text-slate-400">
                            <span className="text-xs font-black uppercase tracking-wider">Muestras / Celda Promedio</span>
                            <Layers size={16} className="text-cyan-400" />
                        </div>
                        <span className="text-3xl font-black text-slate-100 font-mono tracking-tight block">
                            {kpis.familia1.promedio_muestras_por_celda ?? 4}
                        </span>
                        <p className="text-xs text-slate-500 font-semibold">
                            Razón estándar esperada: 4.0 (A-B-C-D)
                        </p>
                    </div>
                </div>
            )}

            {/* AUDITORÍA DE CAMPOS INDIVIDUALES (FAMILIA 2) */}
            {kpis.familia2 && (
                <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-6 space-y-4">
                    <h3 className="text-xs font-black uppercase text-slate-350 border-b border-navy-850 pb-2 flex justify-between">
                        <span>Auditoría de Datos por Celdas Individuales (34 Columnas)</span>
                        <span className="text-xs bg-navy-850 text-slate-400 px-2 py-0.5 rounded font-mono">
                            Total: {kpis.familia2.total_fields?.toLocaleString() ?? 0} campos
                        </span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl text-center shadow-inner">
                            <span className="text-xs font-black text-slate-500 uppercase block">Campos OK</span>
                            <span className="text-2xl font-black text-emerald-500 dark:text-emerald-400 block mt-2 font-mono">
                                {kpis.familia2.total_correctos?.toLocaleString() ?? 0}
                            </span>
                            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 block mt-2 bg-emerald-500/15 border border-emerald-500/30 py-0.5 rounded">
                                {pctFieldsCorrectos}%
                            </span>
                        </div>

                        <button
                            onClick={() => onFilterTipo('VACIO')}
                            className={`border p-4 rounded-xl text-center transition-all ${
                                filterTipo === 'VACIO' ? 'bg-yellow-500/15 border-yellow-500 shadow-md' : 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10'
                            }`}
                        >
                            <span className="text-xs font-black text-slate-500 uppercase block">Campos Vacíos</span>
                            <span className="text-2xl font-black text-yellow-500 block mt-2 font-mono">
                                {kpis.familia2.total_vacios?.toLocaleString() ?? 0}
                            </span>
                            <span className="text-xs font-extrabold text-yellow-500 block mt-2 bg-yellow-500/15 border border-yellow-500/30 py-0.5 rounded">
                                {pctFieldsVacios}%
                            </span>
                        </button>

                        <button
                            onClick={() => onFilterTipo('ADVERTENCIA')}
                            className={`border p-4 rounded-xl text-center transition-all ${
                                filterTipo === 'ADVERTENCIA' ? 'bg-orange-500/15 border-orange-500 shadow-md' : 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10'
                            }`}
                        >
                            <span className="text-xs font-black text-slate-500 uppercase block">Advertencias</span>
                            <span className="text-2xl font-black text-orange-500 block mt-2 font-mono">
                                {kpis.familia2.total_advertencias?.toLocaleString() ?? 0}
                            </span>
                            <span className="text-xs font-extrabold text-orange-500 block mt-2 bg-orange-500/10 border border-orange-500/20 py-1 rounded">
                                {pctFieldsAdvs}%
                            </span>
                        </button>

                        <button
                            onClick={() => onFilterTipo('ALERTA')}
                            className={`border p-4 rounded-xl text-center transition-all ${
                                filterTipo === 'ALERTA' ? 'bg-red-500/15 border-red-500 shadow-md' : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                            }`}
                        >
                            <span className="text-xs font-black text-slate-500 uppercase block">Alertas Críticas</span>
                            <span className="text-2xl font-black text-red-500 block mt-2 font-mono">
                                {kpis.familia2.total_alertas?.toLocaleString() ?? 0}
                            </span>
                            <span className="text-xs font-extrabold text-red-500 block mt-2 bg-red-500/15 border border-red-500/30 py-0.5 rounded">
                                {pctFieldsAlertas}%
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {/* AUDITORÍA DE FILAS (FAMILIA 3) */}
            {kpis.familia3 && (
                <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-6 space-y-4">
                    <h3 className="text-xs font-black uppercase text-slate-350 border-b border-navy-850 pb-2 flex justify-between">
                        <span>Auditoría a Nivel de Registro (Filas de Muestra)</span>
                        <span className="text-xs bg-navy-850 text-slate-400 px-2 py-0.5 rounded font-mono">
                            Total: {kpis.familia3.total_registros?.toLocaleString() ?? 0} filas
                        </span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl text-center">
                            <span className="text-xs font-black text-slate-500 uppercase block">Filas Sin Errores</span>
                            <span className="text-2xl font-black text-emerald-500 dark:text-emerald-400 block mt-2 font-mono">
                                {kpis.familia3.registros_correctos?.toLocaleString() ?? 0}
                            </span>
                            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 block mt-2 bg-emerald-500/15 border border-emerald-500/30 py-0.5 rounded">
                                {pctFilasCorrectas}%
                            </span>
                        </div>

                        <div className="bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-xl text-center">
                            <span className="text-xs font-black text-slate-500 uppercase block">Filas con Vacíos</span>
                            <span className="text-2xl font-black text-yellow-500 block mt-2 font-mono">
                                {kpis.familia3.registros_vacio?.toLocaleString() ?? 0}
                            </span>
                            <span className="text-xs font-extrabold text-yellow-500 block mt-2 bg-yellow-500/15 border border-yellow-500/30 py-0.5 rounded">
                                {pctFilasVacias}%
                            </span>
                        </div>

                        <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-xl text-center">
                            <span className="text-xs font-black text-slate-500 uppercase block">Filas con Advs</span>
                            <span className="text-2xl font-black text-orange-500 block mt-2 font-mono">
                                {kpis.familia3.registros_advertencia?.toLocaleString() ?? 0}
                            </span>
                            <span className="text-xs font-extrabold text-orange-500 block mt-2 bg-orange-500/15 border border-orange-500/30 py-0.5 rounded">
                                {pctFilasAdvs}%
                            </span>
                        </div>

                        <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl text-center">
                            <span className="text-xs font-black text-slate-500 uppercase block">Filas con Alertas</span>
                            <span className="text-2xl font-black text-red-500 block mt-2 font-mono">
                                {kpis.familia3.registros_alerta?.toLocaleString() ?? 0}
                            </span>
                            <span className="text-xs font-extrabold text-red-500 block mt-2 bg-red-500/15 border border-red-500/30 py-0.5 rounded">
                                {pctFilasAlertas}%
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* AUDITORÍA DE INTEGRIDAD DE SECUENCIAS ABCD */}
            {kpis.integridad_celdas && (
                <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-6 space-y-4">
                    <h3 className="text-xs font-black uppercase text-slate-350 border-b border-navy-850 pb-2 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={16} className="text-cyan-400" />
                            <span>Integridad de Secuencias A-B-C-D por Celda</span>
                        </div>
                        <span className="text-xs bg-navy-850 text-slate-400 px-2 py-0.5 rounded font-mono">
                            Total: {totalCeldas} celdas
                        </span>
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <button
                            onClick={() => onFilterSecuencia && onFilterSecuencia(filterSecuencia === 'CORRECTO' ? '' : 'CORRECTO')}
                            className={`p-3 rounded-xl border text-center transition-all ${
                                filterSecuencia === 'CORRECTO' ? 'bg-emerald-500/20 border-emerald-500 shadow-md' : 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                            }`}
                        >
                            <span className="text-[10px] font-black text-slate-400 uppercase block">Correctas (4/4)</span>
                            <span className="text-xl font-black text-emerald-500 dark:text-emerald-400 block mt-1 font-mono">{integ.correctas_abcd ?? 0}</span>
                            <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1 bg-emerald-500/15 py-0.5 rounded">
                                {((integ.correctas_abcd || 0) / totalCeldas * 100).toFixed(1)}%
                            </span>
                        </button>

                        <button
                            onClick={() => onFilterSecuencia && onFilterSecuencia(filterSecuencia === 'DESORDEN' ? '' : 'DESORDEN')}
                            className={`p-3 rounded-xl border text-center transition-all ${
                                filterSecuencia === 'DESORDEN' ? 'bg-yellow-500/20 border-yellow-500 shadow-md' : 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10'
                            }`}
                        >
                            <span className="text-[10px] font-black text-slate-400 uppercase block">En Desorden</span>
                            <span className="text-xl font-black text-yellow-500 block mt-1 font-mono">{integ.desorden_abcd ?? 0}</span>
                            <span className="text-[10px] font-extrabold text-yellow-500 block mt-1 bg-yellow-500/15 py-0.5 rounded">
                                {((integ.desorden_abcd || 0) / totalCeldas * 100).toFixed(1)}%
                            </span>
                        </button>

                        <button
                            onClick={() => onFilterSecuencia && onFilterSecuencia(filterSecuencia === 'INCOMPLETA' ? '' : 'INCOMPLETA')}
                            className={`p-3 rounded-xl border text-center transition-all ${
                                filterSecuencia === 'INCOMPLETA' ? 'bg-orange-500/20 border-orange-500 shadow-md' : 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10'
                            }`}
                        >
                            <span className="text-[10px] font-black text-slate-400 uppercase block">Incompletas (&lt; 4)</span>
                            <span className="text-xl font-black text-orange-500 block mt-1 font-mono">{integ.incompletas_abcd ?? 0}</span>
                            <span className="text-[10px] font-extrabold text-orange-500 block mt-1 bg-orange-500/15 py-0.5 rounded">
                                {((integ.incompletas_abcd || 0) / totalCeldas * 100).toFixed(1)}%
                            </span>
                        </button>

                        <button
                            onClick={() => onFilterSecuencia && onFilterSecuencia(filterSecuencia === 'EXCEDENTE' ? '' : 'EXCEDENTE')}
                            className={`p-3 rounded-xl border text-center transition-all ${
                                filterSecuencia === 'EXCEDENTE' ? 'bg-rose-500/20 border-rose-500 shadow-md' : 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10'
                            }`}
                        >
                            <span className="text-[10px] font-black text-slate-400 uppercase block">Excedentes (&gt; 4)</span>
                            <span className="text-xl font-black text-rose-500 block mt-1 font-mono">{integ.excedentes_abcd ?? 0}</span>
                            <span className="text-[10px] font-extrabold text-rose-500 block mt-1 bg-rose-500/15 py-0.5 rounded">
                                {((integ.excedentes_abcd || 0) / totalCeldas * 100).toFixed(1)}%
                            </span>
                        </button>

                        <button
                            onClick={() => onFilterSecuencia && onFilterSecuencia(filterSecuencia === 'ANOMALA' ? '' : 'ANOMALA')}
                            className={`p-3 rounded-xl border text-center transition-all ${
                                filterSecuencia === 'ANOMALA' ? 'bg-red-500/20 border-red-500 shadow-md' : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                            }`}
                        >
                            <span className="text-[10px] font-black text-slate-400 uppercase block">Anómalas (#ERR)</span>
                            <span className="text-xl font-black text-red-500 block mt-1 font-mono">{integ.anomalas_abcd ?? 0}</span>
                            <span className="text-[10px] font-extrabold text-red-500 block mt-1 bg-red-500/15 py-0.5 rounded">
                                {((integ.anomalas_abcd || 0) / totalCeldas * 100).toFixed(1)}%
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
