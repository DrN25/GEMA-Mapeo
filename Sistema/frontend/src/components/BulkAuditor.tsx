import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertTriangle, ChevronLeft, ChevronRight, BarChart3, Database, RefreshCw, Activity, ShieldCheck } from 'lucide-react';

interface BulkAuditorProps {
    apiBase: string;
}

export default function BulkAuditor({ apiBase }: BulkAuditorProps) {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'loaded' | 'error'>('idle');
    const [message, setMessage] = useState<string>('');
    const [kpis, setKpis] = useState<any>(null);

    const [incidencias, setIncidencias] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterTipo, setFilterTipo] = useState<string>('');
    const [filterCelda, setFilterCelda] = useState<string>('');

    const MANDATORY_COLS_COUNT = 77; // 77 Columnas obligatorias por discontinuidad

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setMessage('');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');
        setMessage('Transmitiendo base de datos masiva al servidor...');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${apiBase}/api/geomecanica/importar-excel-bulk`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                setStatus('processing');
                setMessage('Planilla cargada. Saneando coordenadas y recalculando indices RMR...');
                pollCompactData();
            } else {
                setStatus('error');
                setMessage('Ocurrio un error al intentar iniciar el analisis masivo.');
            }
        } catch (e) {
            setStatus('error');
            setMessage('Error de red al conectar con el servidor.');
        }
    };

    const pollCompactData = () => {
        const timer = setInterval(async () => {
            try {
                const res = await fetch(`${apiBase}/api/geomecanica/resumen-ligero`);
                if (res.status === 200) {
                    const data = await res.json();
                    setKpis(data);
                    setStatus('loaded');
                    clearInterval(timer);
                    fetchPaginatedIncidencias(1, '', '');
                }
            } catch (e) {
                console.warn("Esperando diagnostico...");
            }
        }, 5000); // Poll cada 5 segundos
    };

    const fetchPaginatedIncidencias = async (currentPage: number, tipo: string, celda: string) => {
        try {
            const query = `${apiBase}/api/geomecanica/incidencias-paginadas?page=${currentPage}&limit=50&tipo=${tipo}&celda=${celda}`;
            const res = await fetch(query);
            if (res.ok) {
                const data = await res.json();
                setIncidencias(data.data);
                setPage(data.page);
                setTotalPages(data.total_pages);
            }
        } catch (e) {
            console.error("Error cargando incidencias paginadas", e);
        }
    };

    const handleFilterTipo = (tipo: string) => {
        setFilterTipo(tipo);
        fetchPaginatedIncidencias(1, tipo, filterCelda);
    };

    const handleFilterCelda = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        fetchPaginatedIncidencias(1, filterTipo, filterCelda);
    };

    const totalCeldasEvaluadas = kpis ? kpis.total_filas_procesadas * MANDATORY_COLS_COUNT : 0;
    const vaciosPct = kpis && totalCeldasEvaluadas > 0 ? (kpis.metricas_globales.total_vacios / totalCeldasEvaluadas) * 100 : 0;

    return (
        <div className="space-y-6 select-none text-left animate-fade-in">

            {/* HEADER PRINCIPAL */}
            <div className="flex items-center justify-between border-b border-navy-800 pb-4">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-slate-100">Auditoría Masiva de Ingesta</h2>
                    <p className="text-xs text-slate-400">Herramienta cientifica de validacion estructural, vacios y consistencia fisica.</p>
                </div>
            </div>

            {/* ÁREA DE CARGA INICIAL */}
            {status !== 'loaded' && status !== 'processing' && (
                <div className="glass-panel p-8 rounded-xl border border-navy-800 space-y-6 max-w-xl mx-auto">
                    <div className="text-center space-y-2">
                        <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full w-14 h-14 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                            <Database size={24} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest">Auditar Base de Datos</h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">Sube el archivo Excel desnormalizado "BD" de discontinuidades para auditar consistencias en el servidor.</p>
                        </div>
                    </div>

                    <div className="border border-dashed border-navy-700/80 hover:border-indigo-500/40 rounded-xl p-6 text-center bg-navy-950/45 transition-colors cursor-pointer relative group">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={status === 'uploading'}
                        />
                        <Upload size={32} className="mx-auto text-slate-500 group-hover:text-indigo-400 transition-colors mb-2" />
                        <span className="text-xs font-semibold text-slate-300 block">
                            {file ? file.name : 'Arrastra aquí tu base de datos (.xlsx) o haz clic para buscar'}
                        </span>
                    </div>

                    {status !== 'idle' && (
                        <div className={`p-4 rounded-lg flex gap-3 text-xs border ${status === 'uploading' ? 'bg-navy-900/60 border-navy-800 text-slate-300' : 'bg-red-500/10 border-red-500/20 text-red-300'
                            }`}>
                            <div className="space-y-1">
                                <p className="font-bold">{status === 'uploading' ? 'Cargando datos...' : 'Validación Fallida'}</p>
                                <p className="leading-snug text-slate-400">{message}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t border-navy-800 gap-3">
                        <button
                            onClick={handleUpload}
                            disabled={!file || status === 'uploading'}
                            className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-800 dark:text-indigo-400 px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed animate-pulse-ring"
                        >
                            Iniciar Auditoría Masiva
                        </button>
                    </div>
                </div>
            )}

            {/* COMPONENTE DE CARGA / PROCESANDO EXCEL */}
            {status === 'processing' && (
                <div className="glass-panel p-8 rounded-xl border border-navy-800 text-center space-y-4 max-w-lg mx-auto animate-pulse">
                    <Activity size={32} className="text-indigo-400 animate-spin mx-auto" />
                    <p className="text-sm font-bold text-slate-100 uppercase tracking-wider">Auditoría Geotécnica en Ejecución</p>
                    <p className="text-xs text-slate-400">{message}</p>
                </div>
            )}

            {/* DASHBOARD DE KPIS (ESTILO POWER BI) */}
            {status === 'loaded' && kpis && (
                <div className="space-y-6 animate-fade-in">

                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Registros</span>
                            <span className="text-2xl font-black text-slate-100 block mt-2">{kpis.total_filas_procesadas.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none mt-1">Discontinuidades</span>
                        </div>

                        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Celdas Padre</span>
                            <span className="text-2xl font-black text-slate-100 block mt-2">{kpis.metricas_globales.total_celdas_padre}</span>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none mt-1">Estaciones</span>
                        </div>

                        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex flex-col justify-between border-l-4 border-l-emerald-500">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Registros Completos</span>
                            <span className="text-2xl font-black text-emerald-400 block mt-2">{kpis.metricas_globales.total_ok.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none mt-1">100% OK</span>
                        </div>

                        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex flex-col justify-between border-l-4 border-l-slate-500">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Celdas Vacías</span>
                            <span className="text-2xl font-black text-slate-400 block mt-2">{kpis.metricas_globales.total_vacios.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none mt-1">{vaciosPct.toFixed(4)}% de Vacíos Real</span>
                        </div>

                        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex flex-col justify-between border-l-4 border-l-amber-500">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Advertencias</span>
                            <span className="text-2xl font-black text-amber-500">{kpis.metricas_globales.total_advertencias.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none mt-1">Inconsistencias</span>
                        </div>

                        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex flex-col justify-between border-l-4 border-l-red-500">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Alertas</span>
                            <span className="text-2xl font-black text-red-500 block mt-2">{kpis.metricas_globales.total_alertas.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none mt-1">Fallas Críticas</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Vacíos por Campaña */}
                        <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                                <BarChart3 size={14} className="text-indigo-400" />
                                <span>Campos Vacíos por Campaña (Logueo)</span>
                            </h3>
                            <div className="space-y-3">
                                {Object.entries(kpis.vacios_por_campana).map(([camp, count]: [string, any]) => {
                                    const f_camp = kpis.distribucion_filas_campana[camp] || 1;
                                    const celdas_camp = f_camp * MANDATORY_COLS_COUNT;
                                    const pct = (count / celdas_camp) * 100;
                                    return (
                                        <div key={camp} className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold text-slate-300">
                                                <span>Año {camp} ({f_camp.toLocaleString()} filas)</span>
                                                <span>{count.toLocaleString()} vacíos ({pct.toFixed(4)}% real)</span>
                                            </div>
                                            <div className="w-full bg-navy-950 rounded-full h-1.5 border border-navy-900 overflow-hidden">
                                                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, pct * 10)}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Vacíos por Sector */}
                        <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                                <BarChart3 size={14} className="text-indigo-400" />
                                <span>Campos Vacíos por Sector Geotécnico</span>
                            </h3>
                            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                                {Object.entries(kpis.vacios_por_geotecnico).map(([geo, count]: [string, any]) => {
                                    const f_geo = kpis.distribucion_filas_geotecnico[geo] || 1;
                                    const celdas_geo = f_geo * MANDATORY_COLS_COUNT;
                                    const pct = (count / celdas_geo) * 100;
                                    return (
                                        <div key={geo} className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold text-slate-300">
                                                <span>Sector {geo} ({f_geo.toLocaleString()} filas)</span>
                                                <span>{count.toLocaleString()} vacíos ({pct.toFixed(4)}% real)</span>
                                            </div>
                                            <div className="w-full bg-navy-950 rounded-full h-1.5 border border-navy-900 overflow-hidden">
                                                <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, pct * 10)}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* TABLA PAGINADA DE INCIDENCIAS */}
                    <div className="glass-panel p-6 rounded-xl border border-navy-800 space-y-4">
                        <div className="flex flex-wrap justify-between items-center gap-4">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">Visor de Incidencias Geomecánicas Paginado</h3>

                            <div className="flex flex-wrap items-center gap-4">
                                <form onSubmit={handleFilterCelda} className="flex items-center gap-1.5 bg-navy-950 border border-navy-800 rounded-lg px-2 py-1">
                                    <input
                                        type="text"
                                        placeholder="Celda..."
                                        value={filterCelda}
                                        onChange={(e) => setFilterCelda(e.target.value.toUpperCase())}
                                        className="bg-transparent text-xs text-slate-200 focus:outline-none w-20 uppercase font-semibold"
                                    />
                                    <button type="submit" className="text-[10px] text-indigo-400 font-bold uppercase hover:text-indigo-300">Buscar</button>
                                </form>

                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Tipo:</span>
                                    <select
                                        value={filterTipo}
                                        onChange={(e) => handleFilterTipo(e.target.value)}
                                        className="bg-navy-950 border border-navy-800 text-xs px-2 py-1.5 rounded-lg text-slate-200 font-bold focus:outline-none cursor-pointer"
                                    >
                                        <option value="">TODOS</option>
                                        <option value="VACIO">VACÍOS</option>
                                        <option value="ADVERTENCIA">ADVERTENCIAS</option>
                                        <option value="ALERTA">ALERTAS</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-navy-850">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-navy-950 text-slate-400 font-semibold border-b border-navy-850 h-8 uppercase text-[10px] tracking-wider">
                                        <th className="py-2 px-3 text-center">Fila</th>
                                        <th className="py-2 px-3">Estación Padre</th>
                                        <th className="py-2 px-3">Estructura Hija</th>
                                        <th className="py-2 px-3">Columna Excel</th>
                                        <th className="py-2 px-3 text-center">Valor Registrado</th>
                                        <th className="py-2 px-3 text-center">Tipo</th>
                                        <th className="py-2 px-3">Retroalimentación Geotécnica</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {incidencias.map((inc, i) => (
                                        <tr key={i} className="border-b border-navy-900/40 hover:bg-navy-900/10">
                                            <td className="py-2 px-3 text-center font-mono text-slate-500 h-8">{inc.fila_excel}</td>
                                            <td className="py-2 px-3 font-bold text-slate-200 h-8">{inc.celda_padre}</td>
                                            <td className="py-2 px-3 font-semibold text-slate-300 h-8">{inc.celda_hija}</td>
                                            <td className="py-2 px-3 text-slate-400 font-mono h-8">{inc.columna}</td>
                                            <td className="py-2 px-3 text-center font-bold h-8">{inc.valor_actual !== null ? inc.valor_actual : '—'}</td>
                                            <td className="py-2 px-3 text-center h-8">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${inc.tipo_incidencia === 'ALERTA' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                        inc.tipo_incidencia === 'ADVERTENCIA' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                            'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                                    }`}>
                                                    {inc.tipo_incidencia}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-slate-300 italic leading-snug h-8">{inc.mensaje}</td>
                                        </tr>
                                    ))}
                                    {incidencias.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="py-8 text-center text-slate-500 italic">No se hallaron coincidencias en el rango o tipo seleccionado.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* CONTROLES DE PAGINACIÓN */}
                        <div className="flex justify-between items-center text-xs text-slate-400 pt-2 select-none">
                            <span>Página **{page}** de **{totalPages}**</span>
                            <div className="flex gap-2">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => fetchPaginatedIncidencias(page - 1, filterTipo, filterCelda)}
                                    className="p-1.5 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => fetchPaginatedIncidencias(page + 1, filterTipo, filterCelda)}
                                    className="p-1.5 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}