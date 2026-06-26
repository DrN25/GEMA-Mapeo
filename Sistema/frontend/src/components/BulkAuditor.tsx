import React, { useState, useEffect } from 'react';
import {
    Upload, FileSpreadsheet, AlertTriangle, ChevronLeft, ChevronRight,
    BarChart3, Database, RefreshCw, Activity, ShieldCheck, X, Download,
    Filter, Search, FileText, Calendar, User, Folder, Settings, ArrowLeft,
    Map, Layers
} from 'lucide-react';

interface BulkAuditorProps {
    apiBase: string;
}

interface AuditHistoryItem {
    audit_id: string;
    fecha: string;
    archivo: string;
    total_filas: number;
    total_vacios: number;
    total_advertencias: number;
    total_alertas: number;
}

export default function BulkAuditor({ apiBase }: BulkAuditorProps) {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'loaded' | 'error'>('idle');
    const [message, setMessage] = useState<string>('');

    // Historial de auditorías
    const [history, setHistory] = useState<AuditHistoryItem[]>([]);
    const [selectedAuditId, setSelectedAuditId] = useState<string>('');
    const [kpis, setKpis] = useState<any>(null);

    // Filtros e incidencias paginadas
    const [incidencias, setIncidencias] = useState<any[]>([]);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [totalRecords, setTotalRecords] = useState<number>(0);

    const [filterTipo, setFilterTipo] = useState<string>('');
    const [filterCelda, setFilterCelda] = useState<string>('');
    const [filterColumna, setFilterColumna] = useState<string>('');
    const [filterCampania, setFilterCampania] = useState<string>('');
    const [filterGeotecnico, setFilterGeotecnico] = useState<string>('');
    const [filterSector, setFilterSector] = useState<string>('');
    const [filterSearch, setFilterSearch] = useState<string>('');

    // Período dinámico de campaña, colapsado de panel y Drilldown interactivo
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [selectedObservation, setSelectedObservation] = useState<string | null>(null);
    const [isConsolidatedExpanded, setIsConsolidatedExpanded] = useState<boolean>(false);

    const MANDATORY_COLS_COUNT = 77;

    useEffect(() => {
        fetchHistory();
    }, []);

    // Escuchar cambios de selección de filtros cruzados y peticiones en caliente (selectedYears agregado)
    useEffect(() => {
        if (status === 'loaded' && selectedAuditId) {
            fetchKpisAndIncidencias();
        }
    }, [selectedAuditId, filterTipo, filterCelda, filterColumna, filterCampania, filterGeotecnico, filterSector, filterSearch, selectedYears, status]);

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${apiBase}/api/geomecanica/auditorias`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (e) {
            console.error("Error al cargar historial de auditorías:", e);
        }
    };

    const fetchKpisAndIncidencias = async () => {
        try {
            // Petición en caliente enviando los años activos separados por comas
            const yearParam = selectedYears.length > 0 ? selectedYears.join(",") : "TODOS";
            const kpiUrl = selectedAuditId
                ? `${apiBase}/api/geomecanica/resumen-ligero?audit_id=${selectedAuditId}&years=${yearParam}`
                : `${apiBase}/api/geomecanica/resumen-ligero?years=${yearParam}`;

            const resKpi = await fetch(kpiUrl);
            if (resKpi.ok) {
                const data = await resKpi.json();
                setKpis(data);
                if (!selectedAuditId && data.audit_id) {
                    setSelectedAuditId(data.audit_id);
                }
            }
            fetchPaginatedIncidencias(1);
        } catch (e) {
            console.error("Error cargando estadísticas cruzadas:", e);
        }
    };

    const fetchPaginatedIncidencias = async (currentPage: number) => {
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('page', String(currentPage));
            queryParams.append('limit', '50');
            if (selectedAuditId) queryParams.append('audit_id', selectedAuditId);
            if (filterTipo) queryParams.append('tipo', filterTipo);
            if (filterCelda) queryParams.append('celda', filterCelda);
            if (filterColumna) queryParams.append('columna', filterColumna);

            // Si hay multiselección de años activos en pantalla, la enviamos al buscador
            if (selectedYears.length > 0) {
                queryParams.append('campania', selectedYears.join(","));
            } else if (filterCampania) {
                queryParams.append('campania', filterCampania);
            }

            if (filterGeotecnico) queryParams.append('geotecnico', filterGeotecnico);
            if (filterSector) queryParams.append('sector_geotecnico', filterSector);
            if (filterSearch) queryParams.append('search', filterSearch);

            const res = await fetch(`${apiBase}/api/geomecanica/incidencias-paginadas?${queryParams.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setIncidencias(data.data);
                setPage(data.page);
                setTotalPages(data.total_pages);
                setTotalRecords(data.total_records);
            }
        } catch (e) {
            console.error("Error cargando grilla paginada:", e);
        }
    };

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
                const data = await res.json();
                setStatus('processing');
                setMessage('Planilla cargada. Compilando estadísticas y cruzando variables por familias...');
                setSelectedAuditId(data.audit_id);
                pollCompactData(data.audit_id);
            } else {
                setStatus('error');
                setMessage('Ocurrió un error al intentar iniciar el análisis masivo.');
            }
        } catch (e) {
            setStatus('error');
            setMessage('Error de red al conectar con el servidor.');
        }
    };

    const pollCompactData = (auditId: string) => {
        let attempts = 0;
        const timer = setInterval(async () => {
            attempts++;
            try {
                const res = await fetch(`${apiBase}/api/geomecanica/resumen-ligero?audit_id=${auditId}`);
                if (res.status === 200) {
                    const data = await res.json();
                    setKpis(data);
                    setStatus('loaded');
                    fetchHistory();
                    clearInterval(timer);
                } else if (res.status === 202) {
                    const data = await res.json();
                    setMessage(data.message || 'Procesando variables geotécnicas...');
                } else if (res.status === 404 && attempts > 15) {
                    setStatus('error');
                    setMessage('No se encontró la auditoría procesada en el servidor.');
                    clearInterval(timer);
                }
            } catch (e) {
                console.warn("Esperando respuesta del servidor...");
            }
        }, 4000);
    };

    const handleSelectPastAudit = (auditId: string) => {
        setSelectedAuditId(auditId);
        clearAllFilters();
        setSelectedYears([]);
        setSelectedObservation(null);
        setStatus('loaded');
    };

    const handleFilterTipo = (tipo: string) => setFilterTipo(prev => prev === tipo ? '' : tipo);
    const handleFilterCelda = (celda: string) => setFilterCelda(prev => prev === celda ? '' : celda);
    const handleFilterColumna = (columna: string) => setFilterColumna(prev => prev === columna ? '' : columna);
    const handleFilterCampania = (camp: string) => setFilterCampania(prev => prev === camp ? '' : camp);
    const handleFilterGeotecnico = (geo: string) => setFilterGeotecnico(prev => prev === geo ? '' : geo);
    const handleFilterSector = (sec: string) => setFilterSector(prev => prev === sec ? '' : sec);

    const toggleYearSelection = (year: string) => {
        setSelectedYears(prev => {
            if (prev.includes(year)) {
                return prev.filter(y => y !== year);
            } else {
                return [...prev, year];
            }
        });
    };

    const clearAllFilters = () => {
        setFilterTipo('');
        setFilterCelda('');
        setFilterColumna('');
        setFilterCampania('');
        setFilterGeotecnico('');
        setFilterSector('');
        setFilterSearch('');
        setSelectedYears([]);
        setSelectedObservation(null);
    };

    const handleDownloadExcel = () => {
        const queryParams = new URLSearchParams();
        if (selectedAuditId) queryParams.append('audit_id', selectedAuditId);
        if (filterTipo) queryParams.append('tipo', filterTipo);
        if (filterCelda) queryParams.append('celda', filterCelda);
        if (filterColumna) queryParams.append('columna', filterColumna);

        if (selectedYears.length > 0) {
            queryParams.append('campania', selectedYears.join(","));
        } else if (filterCampania) {
            queryParams.append('campania', filterCampania);
        }

        if (filterGeotecnico) queryParams.append('geotecnico', filterGeotecnico);
        if (filterSector) queryParams.append('sector_geotecnico', filterSector);
        if (filterSearch) queryParams.append('search', filterSearch);

        // Parámetro dinámico para romper el caché del navegador (Cache Buster)
        queryParams.append('_t', String(Date.now()));

        const resolvedBase = apiBase || `${window.location.protocol}//${window.location.hostname}:8001`;
        window.open(`${resolvedBase}/api/geomecanica/reporte-excel?${queryParams.toString()}`);
    };

    const handleDownloadMD = () => {
        const queryParams = new URLSearchParams();
        if (selectedAuditId) queryParams.append('audit_id', selectedAuditId);
        if (filterTipo) queryParams.append('tipo', filterTipo);
        if (filterCelda) queryParams.append('celda', filterCelda);
        if (filterColumna) queryParams.append('columna', filterColumna);

        if (selectedYears.length > 0) {
            queryParams.append('campania', selectedYears.join(","));
        } else if (filterCampania) {
            queryParams.append('campania', filterCampania);
        }

        if (filterGeotecnico) queryParams.append('geotecnico', filterGeotecnico);
        if (filterSector) queryParams.append('sector_geotecnico', filterSector);
        if (filterSearch) queryParams.append('search', filterSearch);

        window.open(`${apiBase}/api/geomecanica/reporte-markdown?${queryParams.toString()}`);
    };

    // --- CÁLCULO DINÁMICO DE KPIS SEGÚN CAMPAÑA/AÑO SELECCIONADO ---
    let numCeldasPadre = kpis?.familia1?.num_celdas_padre || 0;
    let totalDiscontinuidades = kpis?.familia1?.total_discontinuidades || 0;
    let totalMetrosMapped = kpis?.familia1?.total_metros || 0;
    let periodLabel = "Periodo Completo";

    if (kpis) {
        if (selectedYears.length > 0 && kpis.resumen_por_celda_padre) {
            const matchingCeldas = Object.entries(kpis.resumen_por_celda_padre).filter(
                ([_, cellData]: [any, any]) => selectedYears.includes(String(cellData.campania))
            );
            numCeldasPadre = matchingCeldas.length;
            totalDiscontinuidades = matchingCeldas.reduce((acc, [_, cellData]: [any, any]) => acc + (cellData.total_hijas || 0), 0);
            totalMetrosMapped = matchingCeldas.reduce((acc, [_, cellData]: [any, any]) => acc + (cellData.dist_celda || 0), 0);
            periodLabel = `Campaña: ${selectedYears.sort().join(", ")}`;
        } else if (kpis.distribucion_campania && kpis.distribucion_campania.length > 0) {
            const years = kpis.distribucion_campania.map((c: any) => parseInt(c.campania)).filter((y: any) => !isNaN(y));
            if (years.length > 0) {
                periodLabel = `Periodo: ${Math.min(...years)} - ${Math.max(...years)}`;
            }
        }
    }

    // --- COLORES SEMÁNTICOS ESTANDARIZADOS ---
    const colorVacios = "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    const colorAdvertencias = "text-orange-500 bg-orange-500/10 border-orange-500/20";
    const colorAlertas = "text-red-500 bg-red-500/10 border-red-500/20";

    // --- FORMATEADOR DE RANKING REESTRUCTURADO ---
    // Alertas: Rojo (1-3), Naranja (4-10), Amarillo (11+)
    const getAlertRankStyle = (index: number) => {
        const rank = index + 1;
        if (rank >= 1 && rank <= 3) {
            return "text-red-500 font-extrabold text-xs bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 rounded shadow-[0_0_12px_rgba(239,68,68,0.25)]";
        }
        if (rank >= 4 && rank <= 10) {
            return "text-orange-500 font-extrabold text-xs bg-orange-500/10 border border-orange-500/30 px-2.5 py-0.5 rounded shadow-[0_0_8px_rgba(249,115,22,0.15)]";
        }
        return "text-yellow-400 font-bold text-xs bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded";
    };

    // Advertencias: Naranja (1-3), Amarillo (4-10), Crema (11+)
    const getWarningRankStyle = (index: number) => {
        const rank = index + 1;
        if (rank >= 1 && rank <= 3) {
            return "text-orange-500 font-extrabold text-xs bg-orange-500/10 border border-orange-500/30 px-2.5 py-0.5 rounded shadow-[0_0_12px_rgba(249,115,22,0.25)]";
        }
        if (rank >= 4 && rank <= 10) {
            return "text-yellow-400 font-extrabold text-xs bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-0.5 rounded shadow-[0_0_8px_rgba(234,179,8,0.15)]";
        }
        return "text-[#fef3c7] font-semibold text-xs bg-amber-500/10 border border-amber-200/20 px-1.5 py-0.5 rounded";
    };

    const pctFieldsCorrectos = kpis?.familia2 ? ((kpis.familia2.total_correctos / kpis.familia2.total_fields) * 100).toFixed(2) : '0';
    const pctFieldsVacios = kpis?.familia2 ? ((kpis.familia2.total_vacios / kpis.familia2.total_fields) * 100).toFixed(2) : '0';
    const pctFieldsAdvs = kpis?.familia2 ? ((kpis.familia2.total_advertencias / kpis.familia2.total_fields) * 100).toFixed(2) : '0';
    const pctFieldsAlertas = kpis?.familia2 ? ((kpis.familia2.total_alertas / kpis.familia2.total_fields) * 100).toFixed(2) : '0';

    const pctDiscsCorrectas = kpis?.familia3 ? ((kpis.familia3.discontinuidades_correctas / kpis.familia3.total_discontinuidades) * 100).toFixed(2) : '0';
    const pctDiscsVacias = kpis?.familia3 ? ((kpis.familia3.discontinuidades_vacios / kpis.familia3.total_discontinuidades) * 100).toFixed(2) : '0';
    const pctDiscsAdvs = kpis?.familia3 ? ((kpis.familia3.discontinuidades_advertencias / kpis.familia3.total_discontinuidades) * 100).toFixed(2) : '0';
    const pctDiscsAlertas = kpis?.familia3 ? ((kpis.familia3.discontinuidades_alertas / kpis.familia3.total_discontinuidades) * 100).toFixed(2) : '0';

    // --- PROCESAMIENTO DINÁMICO DE OBSERVACIONES DESDE EL BACKEND ---
    const coreObservationTypes = kpis?.consolidado_observaciones
        ? Array.from(
            new Set(
                Object.values(kpis.consolidado_observaciones).flatMap((yearData: any) =>
                    Object.keys(yearData).filter(k => k !== 'severity' && k !== 'total_incidents')
                )
            )
        ).sort()
        : [];

    const uniqueYears = kpis?.consolidado_observaciones
        ? Object.keys(kpis.consolidado_observaciones).sort()
        : [];

    return (
        <div className="space-y-6 select-none text-left animate-fade-in text-slate-100 print:text-black print:bg-white text-xs sm:text-sm bg-[#02040a] min-h-screen p-1 sm:p-3 font-sans">

            {/* SECCIÓN 1: HISTORIAL DE AUDITORÍAS PASADAS */}
            <div className="rounded-xl border border-slate-800/80 bg-[#090f1d]/50 backdrop-blur-md p-4 print:hidden">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <Folder size={14} className="text-indigo-400" />
                    <span>Historial de Importaciones Geotécnicas Auditadas</span>
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                    {history.map((audit) => {
                        const isActive = selectedAuditId === audit.audit_id;
                        return (
                            <button
                                key={audit.audit_id}
                                onClick={() => handleSelectPastAudit(audit.audit_id)}
                                className={`flex-shrink-0 p-3 rounded-lg border text-left transition-all ${isActive
                                    ? 'bg-indigo-500/10 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/30'
                                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-black text-slate-100 truncate max-w-[180px]" title={audit.archivo}>
                                        {audit.archivo}
                                    </span>
                                    <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-bold">
                                        {audit.total_filas} estructuras
                                    </span>
                                </div>
                                <div className="text-xs text-slate-400 mt-1 flex gap-2">
                                    <span>{audit.fecha}</span>
                                    <span className="text-red-500 font-semibold">{audit.total_alertas} Alertas</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ÁREA DE CARGA INICIAL (Auditoría Nueva) */}
            {status !== 'loaded' && !selectedAuditId && (
                <div className="rounded-xl border border-slate-800/80 p-8 space-y-6 max-w-xl mx-auto bg-[#090f1d]/50 backdrop-blur-md mt-6 print:hidden shadow-xl">
                    <div className="text-center space-y-2">
                        <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full w-14 h-14 flex items-center justify-center mx-auto shadow-md">
                            <Database size={24} />
                        </div>
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-100">Auditar Nueva Planilla de Mapeo</h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                                Sube un nuevo archivo Excel de discontinuidades para escanear, auditar y compilar KPIs de integridad.
                            </p>
                        </div>
                    </div>

                    <div className="border border-dashed border-slate-700 hover:border-indigo-500/45 rounded-xl p-6 text-center bg-slate-900/20 transition-all cursor-pointer relative group">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <FileSpreadsheet size={32} className="mx-auto text-slate-500 group-hover:text-indigo-400 transition-colors mb-2" />
                        <span className="text-xs font-semibold text-slate-300 block">
                            {file ? file.name : 'Arrastra tu archivo .xlsx o haz clic para buscar'}
                        </span>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-850">
                        <button
                            onClick={handleUpload}
                            disabled={!file}
                            className="bg-indigo-500 hover:bg-indigo-600 border border-indigo-400/30 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                        >
                            Iniciar Auditoría Masiva
                        </button>
                    </div>
                </div>
            )}

            {/* CABECERA CUANDO SE ENCUENTRAN RESULTADOS CARGADOS */}
            {(status === 'loaded' || selectedAuditId) && kpis && (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#090f1d]/60 p-4 border border-slate-800/80 rounded-xl gap-4 print:border-b print:border-black print:pb-4 print:mb-6 shadow-md">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg print:hidden">
                                <ShieldCheck size={18} />
                            </div>
                            <div>
                                <h1 className="text-xs font-black uppercase tracking-widest print:text-lg">Auditoría Geotécnica de Integridad</h1>
                                <p className="text-xs text-slate-400 uppercase tracking-wider print:text-xs mt-1">
                                    Auditoría Activa: <span className="font-bold text-slate-100 print:text-black">{kpis?.nombre_archivo || 'Por Defecto'}</span>
                                </p>
                            </div>
                        </div>

                        {/* SELECTOR DINÁMICO DE PERÍODO (CAMPAÑA - PÍLDORAS MULTISELECCIÓN INTERACTIVAS) */}
                        {kpis.distribucion_campania && kpis.distribucion_campania.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 border border-slate-800/80 rounded-xl p-1.5 print:hidden">
                                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest px-2.5">Campañas:</span>
                                <button
                                    onClick={() => setSelectedYears([])}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all uppercase ${selectedYears.length === 0
                                        ? 'bg-indigo-500 text-slate-950 shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                                        : 'bg-navy-900/60 border border-navy-800/80 text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    Todas
                                </button>
                                {kpis.distribucion_campania.map((c: any) => {
                                    const isSelected = selectedYears.includes(String(c.campania));
                                    return (
                                        <button
                                            key={c.campania}
                                            onClick={() => {
                                                toggleYearSelection(String(c.campania));
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${isSelected
                                                ? 'bg-indigo-500 text-slate-950 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                                                : 'bg-navy-900/40 border border-navy-800/60 text-slate-400 hover:text-slate-200'
                                                }`}
                                        >
                                            {c.campania}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 print:hidden w-full sm:w-auto justify-end">
                        <button
                            onClick={handleDownloadExcel}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-750 border border-emerald-500/30 text-white px-4 py-2 rounded-lg text-xs font-black shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all active:scale-95"
                            title="Exportar base de datos de auditoría completa a Excel"
                        >
                            <Download size={14} />
                            <span>Exportar Excel (.xlsx)</span>
                        </button>

                        <button
                            onClick={() => {
                                setSelectedAuditId('');
                                setStatus('idle');
                            }}
                            className="bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-300 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                            Subir Otro Excel
                        </button>
                    </div>
                </div>
            )}

            {/* COMPRESOR LOADER */}
            {(status === 'uploading' || status === 'processing') && (
                <div className="rounded-xl border border-slate-800/80 text-center space-y-4 max-w-lg mx-auto animate-pulse print:hidden bg-[#090f1d]/50 backdrop-blur-md p-10">
                    <Activity size={32} className="text-indigo-400 animate-spin mx-auto" />
                    <p className="text-xs font-black uppercase tracking-wider">{status === 'uploading' ? 'Cargando Base de Datos...' : 'Auditoría en Ejecución'}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
                </div>
            )}

            {/* DASHBOARD COMPLETO CON KPIs Y TABLAS INTERACTIVAS */}
            {(status === 'loaded' || selectedAuditId) && kpis && (
                <div className="space-y-6 animate-fade-in print:text-black">

                    {/* BARRA DE FILTROS CRUZADOS ACTIVOS */}
                    {(filterTipo || filterCelda || filterColumna || filterCampania || filterGeotecnico || filterSector || filterSearch) && (
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-indigo-500/5 border border-indigo-500/25 rounded-xl gap-4 animate-fade-in print:hidden">
                            <div className="flex items-center gap-3">
                                <Filter size={18} className="text-indigo-400 shrink-0" />
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-black text-slate-300 uppercase tracking-wider mr-1">Consultas Activas:</span>

                                    <button onClick={clearAllFilters} className="text-xs text-slate-400 hover:text-white underline font-extrabold ml-2">
                                        Limpiar Todo
                                    </button>
                                </div>
                            </div>

                            {/* CONTENEDOR MULTI-EXPORTACIÓN SEGÚN CONFIGURACIÓN */}
                            <div className="flex flex-wrap gap-2 shrink-0">
                                <button
                                    onClick={handleDownloadExcel}
                                    className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/35 hover:bg-emerald-500/25 text-emerald-300 px-3.5 py-2 rounded-lg text-xs font-black shadow-sm transition-all active:scale-95"
                                    title="Exportar base consolidada y listado filtrado a Excel"
                                >
                                    <Download size={14} className="text-emerald-400" />
                                    <span>Exportar Reporte (.xlsx)</span>
                                </button>
                                <button
                                    onClick={handleDownloadMD}
                                    className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/35 hover:bg-indigo-500/25 text-indigo-300 px-3.5 py-2 rounded-lg text-xs font-black shadow-sm transition-all active:scale-95"
                                >
                                    <Download size={14} />
                                    <span>Reporte Geotécnico (.md)</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* CONTROL DE ESTACIONES MAPEADAS (KPIs REACTIVOS AL PERÍODO CON ICONOS) */}
                    {kpis.familia1 && (
                        <div className="rounded-xl border border-slate-800/80 bg-[#090f1d]/50 backdrop-blur-md p-5 grid grid-cols-1 md:grid-cols-3 gap-6 print:border-black print:text-black">
                            <div className="flex items-center justify-between p-2">
                                <div className="space-y-1">
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Métricas de Ventanas</span>
                                    <span className="text-4xl font-black text-indigo-400 font-mono block mt-1 print:text-black">
                                        {numCeldasPadre.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-slate-400 font-semibold block">{periodLabel}</span>
                                </div>
                                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl print:hidden">
                                    <Map size={24} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-2 border-l border-slate-800/60 pl-6 print:border-black">
                                <div className="space-y-1">
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Total de Estructuras Mapeadas</span>
                                    <span className="text-4xl font-black text-indigo-400 font-mono block mt-1 print:text-black">
                                        {totalDiscontinuidades.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-slate-400 font-semibold block">{periodLabel}</span>
                                </div>
                                <div className="p-3 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl print:hidden">
                                    <Layers size={24} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-2 border-l border-slate-800/60 pl-6 print:border-black">
                                <div className="space-y-1">
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">TOTAL DE METROS MAPEADOS</span>
                                    <span className="text-4xl font-black text-indigo-400 font-mono block mt-1 print:text-black">
                                        {totalMetrosMapped.toLocaleString()} <span className="text-xs text-slate-400 font-semibold">metros</span>
                                    </span>
                                    <span className="text-xs text-slate-400 font-semibold block">{periodLabel}</span>
                                </div>
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl print:hidden">
                                    <Activity size={24} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- NUEVO MONITOR INTERACTIVO DE OBSERVACIONES POR AÑO (VISTA CONSOLIDADA O DRILLDOWN) --- */}
                    {kpis.consolidado_observaciones && (
                        <div className="rounded-xl border border-slate-800/80 bg-[#090f1d]/50 backdrop-blur-md p-6 space-y-6 shadow-xl relative overflow-hidden">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={16} className="text-indigo-400 shrink-0" />
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-100">
                                            CONSOLIDADO - OBSERVACIONES POR AÑO
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Vista unificada del estado geotécnico de control de calidad por campaña de perforación.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsConsolidatedExpanded(!isConsolidatedExpanded);
                                        if (isConsolidatedExpanded) setSelectedObservation(null);
                                    }}
                                    className="bg-indigo-500 hover:bg-indigo-600 border border-indigo-400/30 text-slate-950 px-4 py-2 rounded-lg text-xs font-black transition-all shadow-[0_0_12px_rgba(99,102,241,0.12)] active:scale-95 select-none"
                                >
                                    {isConsolidatedExpanded ? "🙈 Ocultar Panel" : "👁️ Mostrar Panel"}
                                </button>
                            </div>

                            {isConsolidatedExpanded && (
                                <div className="border-t border-slate-800/60 pt-4 animate-fade-in space-y-6">
                                    {!selectedObservation ? (
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xs text-slate-400">
                                                    Haz clic sobre una tipología para desplegar tendencias dinámicas e identificar anomalías.
                                                </p>
                                            </div>

                                            <div className="overflow-x-auto rounded-lg border border-slate-800/80">
                                                <table className="w-full text-xs text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-slate-800/80">
                                                            <th className="py-3.5 px-4 text-xs">Tipo de Observación Geotécnica</th>
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
                                                                        <div className={`mt-1 text-xs font-black tracking-widest px-2.5 py-1 rounded-lg uppercase ${badgeColor}`}>
                                                                            {sev}
                                                                        </div>
                                                                    </th>
                                                                );
                                                            })}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800/40 text-slate-300 font-semibold text-xs">
                                                        {coreObservationTypes.map((obsType, oIdx) => (
                                                            <tr
                                                                key={oIdx}
                                                                onClick={() => setSelectedObservation(obsType)}
                                                                className="hover:bg-indigo-500/5 cursor-pointer transition-all border-b border-slate-900/60"
                                                            >
                                                                <td className="py-3.5 px-4 text-slate-100 font-black text-xs">{obsType}</td>
                                                                {uniqueYears.map(yr => {
                                                                    const val = kpis.consolidado_observaciones[yr]?.[obsType]?.incidents || 0;
                                                                    return (
                                                                        <td key={yr} className="py-3.5 px-4 text-center font-mono">
                                                                            <span className={`px-2.5 py-1 rounded text-xs font-black border ${val > 100
                                                                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                                                : val > 10
                                                                                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                                                                    : val > 0
                                                                                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                                                        : 'bg-slate-900/30 text-slate-600 border-transparent'}`}>
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
                                        <div className="space-y-6 animate-fade-in text-xs">
                                            {/* CABECERA DEL DRILLDOWN DETALLADO */}
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
                                                <div>
                                                    <button
                                                        onClick={() => setSelectedObservation(null)}
                                                        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-wider mb-2"
                                                    >
                                                        <ArrowLeft size={14} />
                                                        <span>Volver al Consolidado General</span>
                                                    </button>
                                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">
                                                        OBSERVACIÓN — {selectedObservation}
                                                    </h3>
                                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                        Visualizando tendencias analíticas de registros y estructuras afectadas a lo largo de las campañas activas.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* GRÁFICOS DE TENDENCIA CON ESCALAMIENTO ADAPTATIVO */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Gráfico 1: Incidencias Totales */}
                                                <div className="bg-[#02040a]/40 border border-slate-850 p-4 rounded-xl space-y-3">
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                                        Registros de la Observación por Año
                                                    </h4>
                                                    <div className="flex justify-between items-end h-40 border-b border-slate-850 pb-2">
                                                        {uniqueYears.map(yr => {
                                                            const val = kpis.consolidado_observaciones[yr]?.[selectedObservation]?.incidents || 0;
                                                            const maxVal = Math.max(...uniqueYears.map(y => kpis.consolidado_observaciones[y]?.[selectedObservation]?.incidents || 0), 1);

                                                            const heightPct = val > 0 ? 8 + (val / maxVal) * 92 : 0;
                                                            return (
                                                                <div key={yr} className="flex flex-col items-center flex-1 group">
                                                                    <span className="text-xs font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-all mb-1">
                                                                        {val}
                                                                    </span>
                                                                    <div
                                                                        style={{ height: `${heightPct}%` }}
                                                                        className={`w-8 rounded-t border-t-2 transition-all ${val > 100
                                                                            ? 'bg-red-500/20 hover:bg-red-500 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                                                            : val > 10
                                                                                ? 'bg-orange-500/20 hover:bg-orange-500 border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.15)]'
                                                                                : val > 0
                                                                                    ? 'bg-yellow-500/20 hover:bg-yellow-500 border-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.1)]'
                                                                                    : 'bg-slate-900 border-transparent h-1'}`}
                                                                    />
                                                                    <span className="text-xs font-bold text-slate-500 mt-2">{yr}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Gráfico 2: Estaciones Afectadas */}
                                                <div className="bg-[#02040a]/40 border border-slate-850 p-4 rounded-xl space-y-3">
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                                        Estaciones (Taladros) Afectadas por Año
                                                    </h4>
                                                    <div className="flex justify-between items-end h-40 border-b border-slate-850 pb-2">
                                                        {uniqueYears.map(yr => {
                                                            const val = kpis.consolidado_observaciones[yr]?.[selectedObservation]?.affected_stations || 0;
                                                            const maxVal = Math.max(...uniqueYears.map(y => kpis.consolidado_observaciones[y]?.[selectedObservation]?.affected_stations || 0), 1);

                                                            const heightPct = val > 0 ? 8 + (val / maxVal) * 92 : 0;
                                                            return (
                                                                <div key={yr} className="flex flex-col items-center flex-1 group">
                                                                    <span className="text-xs font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-all mb-1">
                                                                        {val}
                                                                    </span>
                                                                    <div
                                                                        style={{ height: `${heightPct}%` }}
                                                                        className={`w-8 rounded-t border-t-2 transition-all ${val > 20
                                                                            ? 'bg-red-500/20 hover:bg-red-500 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                                                            : val > 5
                                                                                ? 'bg-orange-500/20 hover:bg-orange-500 border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.15)]'
                                                                                : val > 0
                                                                                    ? 'bg-yellow-500/20 hover:bg-yellow-500 border-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.1)]'
                                                                                    : 'bg-slate-900 border-transparent h-1'}`}
                                                                    />
                                                                    <span className="text-xs font-bold text-slate-500 mt-2">{yr}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* TABLA DE TOP 3 TALADROS MÁS CRÍTICOS POR AÑO */}
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                                    TOP 3 TALADROS CON MÁS REGISTROS OBSERVADOS POR AÑO
                                                </h4>
                                                <div className="overflow-x-auto rounded-lg border border-slate-800/80">
                                                    <table className="w-full text-xs text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-slate-800">
                                                                <th className="py-2.5 px-3 text-center w-24 text-xs">Año</th>
                                                                <th className="py-2.5 px-3 text-xs">1° Más Crítico</th>
                                                                <th className="py-2.5 px-3 text-xs">2° Más Crítico</th>
                                                                <th className="py-2.5 px-3 text-xs">3° Más Crítico</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-800/40 text-slate-300">
                                                            {uniqueYears.map(yr => {
                                                                const topList = kpis.consolidado_observaciones[yr]?.[selectedObservation]?.top_stations || [];
                                                                return (
                                                                    <tr key={yr} className="hover:bg-slate-900/10 border-b border-slate-900/50">
                                                                        <td className="py-3 px-3 text-center font-black bg-[#02040a]/30 text-xs">{yr}</td>
                                                                        <td className="py-3 px-3">
                                                                            {topList[0] ? (
                                                                                <span className="font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg text-xs">
                                                                                    {topList[0].celda} <span className="font-mono font-black">({topList[0].count})</span>
                                                                                </span>
                                                                            ) : <span className="text-slate-600">—</span>}
                                                                        </td>
                                                                        <td className="py-3 px-3">
                                                                            {topList[1] ? (
                                                                                <span className="font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-lg text-xs">
                                                                                    {topList[1].celda} <span className="font-mono font-extrabold">({topList[1].count})</span>
                                                                                </span>
                                                                            ) : <span className="text-slate-600">—</span>}
                                                                        </td>
                                                                        <td className="py-3 px-3">
                                                                            {topList[2] ? (
                                                                                <span className="font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-lg text-xs">
                                                                                    {topList[2].celda} <span className="font-mono font-bold">({topList[2].count})</span>
                                                                                </span>
                                                                            ) : <span className="text-slate-600">—</span>}
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
                    )}

                    {/* INTEGRIDAD DE DATOS (CAMPOS) VS DISCONTINUIDADES (FILAS) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* AUDITORÍA DE DATOS INDIVIDUALES (CAMPOS) */}
                        {kpis.familia2 && (
                            <div className="rounded-xl border border-slate-800/80 bg-[#090f1d]/50 backdrop-blur-md p-6 space-y-4 print:border-black">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800/50 pb-2 flex justify-between">
                                    <span>Auditoría de Datos Individuales (Campos de Excel)</span>
                                    <span className="text-xs bg-slate-900 text-slate-400 px-2 py-0.5 rounded font-mono">
                                        Total: {kpis.familia2.total_fields.toLocaleString()} campos
                                    </span>
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    <div className="bg-[#10b981]/5 border border-[#10b981]/20 p-4 rounded-xl text-center shadow-inner">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Campos OK</span>
                                        <span className="text-3xl font-black text-[#10b981] block mt-2 font-mono">{kpis.familia2.total_correctos.toLocaleString()}</span>
                                        <span className="text-xs font-extrabold text-[#10b981] block mt-2 bg-[#10b981]/10 border border-[#10b981]/20 py-1 rounded">
                                            {pctFieldsCorrectos}% del total
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => handleFilterTipo('VACIO')}
                                        className={`border p-4 rounded-xl text-center transition-all shadow-inner ${filterTipo === 'VACIO'
                                            ? 'bg-yellow-500/15 border-yellow-500 ring-2 ring-yellow-500/40'
                                            : 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10 hover:border-yellow-500/40'
                                            }`}
                                    >
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Campos Vacíos</span>
                                        <span className="text-3xl font-black text-yellow-500 block mt-2 font-mono">{kpis.familia2.total_vacios.toLocaleString()}</span>
                                        <span className="text-xs font-extrabold text-yellow-500 block mt-2 bg-yellow-500/10 border border-yellow-500/20 py-1 rounded">
                                            {pctFieldsVacios}% del total
                                        </span>
                                    </button>

                                    <button
                                        onClick={() => handleFilterTipo('ADVERTENCIA')}
                                        className={`border p-4 rounded-xl text-center transition-all shadow-inner ${filterTipo === 'ADVERTENCIA'
                                            ? 'bg-orange-500/15 border-orange-500 ring-2 ring-orange-500/40'
                                            : 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10 hover:border-orange-500/40'
                                            }`}
                                    >
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Advertencias</span>
                                        <span className="text-3xl font-black text-orange-500 block mt-2 font-mono">{kpis.familia2.total_advertencias.toLocaleString()}</span>
                                        <span className="text-xs font-extrabold text-orange-500 block mt-2 bg-orange-500/10 border border-orange-500/20 py-1 rounded">
                                            {pctFieldsAdvs}% del total
                                        </span>
                                    </button>

                                    <button
                                        onClick={() => handleFilterTipo('ALERTA')}
                                        className={`border p-4 rounded-xl text-center transition-all shadow-inner ${filterTipo === 'ALERTA'
                                            ? 'bg-red-500/15 border-red-500 ring-2 ring-red-500/40'
                                            : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40'
                                            }`}
                                    >
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Alertas Críticas</span>
                                        <span className="text-3xl font-black text-red-500 block mt-2 font-mono">{kpis.familia2.total_alertas.toLocaleString()}</span>
                                        <span className="text-xs font-extrabold text-red-500 block mt-2 bg-red-500/10 border border-red-500/20 py-1 rounded">
                                            {pctFieldsAlertas}% del total
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* INTEGRIDAD DE DISCONTINUIDADES (FILAS COMPLETAS - ESTRELLA DE COLORES UNIFICADOS) */}
                        {kpis.familia3 && (
                            <div className="rounded-xl border border-slate-800/80 bg-[#090f1d]/50 backdrop-blur-md p-6 space-y-4 print:border-black">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800/50 pb-2 flex justify-between">
                                    <span>Integridad Estructural de Discontinuidades (Estructuras)</span>
                                    <span className="text-xs bg-slate-900 text-slate-400 px-2 py-0.5 rounded font-mono">
                                        Total: {kpis.familia3.total_discontinuidades.toLocaleString()} estructuras
                                    </span>
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    <div className="bg-[#10b981]/5 border border-[#10b981]/20 p-4 rounded-xl text-center shadow-inner">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Estructuras OK</span>
                                        <span className="text-3xl font-black text-[#10b981] block mt-2 font-mono">{kpis.familia3.discontinuidades_correctas.toLocaleString()}</span>
                                        <span className="text-xs font-bold text-[#10b981] block mt-2 bg-[#10b981]/10 border border-[#10b981]/20 py-1 rounded">
                                            {pctDiscsCorrectas}% del total
                                        </span>
                                    </div>

                                    <div className="bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-xl text-center shadow-inner">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Estructuras con Vacíos</span>
                                        <span className="text-3xl font-black text-yellow-500 block mt-2 font-mono">{kpis.familia3.discontinuidades_vacios.toLocaleString()}</span>
                                        <span className="text-xs font-bold text-yellow-500 block mt-2 bg-yellow-500/10 border border-yellow-500/20 py-1 rounded">
                                            {pctDiscsVacias}% del total
                                        </span>
                                    </div>

                                    <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-xl text-center shadow-inner">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Estructuras con Advs</span>
                                        <span className="text-3xl font-black text-orange-500 block mt-2 font-mono">{kpis.familia3.discontinuidades_advertencias.toLocaleString()}</span>
                                        <span className="text-xs font-bold text-orange-500 block mt-2 bg-orange-500/10 border border-orange-500/20 py-1 rounded">
                                            {pctDiscsAdvs}% del total
                                        </span>
                                    </div>

                                    <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl text-center shadow-inner">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Estructuras con Alertas</span>
                                        <span className="text-3xl font-black text-red-500 block mt-2 font-mono">{kpis.familia3.discontinuidades_alertas.toLocaleString()}</span>
                                        <span className="text-xs font-bold text-red-500 block mt-2 bg-red-500/10 border border-red-500/20 py-1 rounded">
                                            {pctDiscsAlertas}% del total
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* TABLAS COMPARATIVAS DE DISTRIBUCIÓN POR CATEGORÍAS - CON ALTURA LIMITADA Y SCROLL */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                        {/* DISTRIBUCIÓN POR CAMPAÑA DE LOGUEO */}
                        <div className="rounded-xl border border-slate-800/80 bg-[#090f1d]/50 backdrop-blur-md p-5 space-y-4 print:border-black">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800/50 pb-2 flex items-center gap-2">
                                <Calendar size={14} className="text-indigo-400" />
                                <span>Distribución por Campaña de Logueo (Año)</span>
                            </h3>
                            <div className="rounded-xl border border-slate-800/80 overflow-hidden">
                                <div className="max-h-56 overflow-y-auto bg-[#02040a] scrollbar-thin scrollbar-thumb-slate-800">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-950 text-xs text-slate-400 font-extrabold uppercase tracking-wider border-b border-slate-800 print:bg-slate-100 print:text-black">
                                                <th className="py-2.5 px-3 bg-slate-950">Campaña</th>
                                                <th className="py-2.5 px-3 text-center bg-slate-950">Estructuras (N)</th>
                                                <th className="py-2.5 px-3 text-center text-red-500 bg-slate-950">Alertas (%)</th>
                                                <th className="py-2.5 px-3 text-center text-orange-500 bg-slate-950">Advs (%)</th>
                                                <th className="py-2.5 px-3 text-center text-yellow-500 bg-slate-950">Vacíos (%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {kpis.distribucion_campania?.map((row: any, idx: number) => {
                                                const isFiltered = filterCampania === row.campania;
                                                return (
                                                    <tr
                                                        key={idx}
                                                        onClick={() => handleFilterCampania(row.campania)}
                                                        className={`border-b border-slate-900/60 cursor-pointer transition-colors ${isFiltered ? 'bg-indigo-500/15 ring-2 ring-indigo-500/40' : 'hover:bg-slate-900/30'
                                                            }`}
                                                    >
                                                        <td className="py-2 px-3 font-bold text-slate-200">{row.campania}</td>
                                                        <td className="py-2 px-3 text-center font-mono">{row.discontinuidades}</td>
                                                        <td className="py-2 px-3 text-center font-mono font-bold text-red-400">
                                                            {row.alertas_cant} <span className="text-[10px] text-slate-500 font-normal">({row.alertas_pct.toFixed(2)}%)</span>
                                                        </td>
                                                        <td className="py-2 px-3 text-center font-mono font-bold text-orange-400">
                                                            {row.advertencias_cant} <span className="text-[10px] text-slate-500 font-normal">({row.advertencias_pct.toFixed(2)}%)</span>
                                                        </td>
                                                        <td className="py-2 px-3 text-center font-mono font-bold text-yellow-400">
                                                            {row.vacios_cant} <span className="text-[10px] text-slate-500 font-normal">({row.vacios_pct.toFixed(2)}%)</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* DISTRIBUCIÓN POR SECTOR GEOTÉCNICO */}
                        <div className="rounded-xl border border-slate-800/80 bg-[#090f1d]/50 backdrop-blur-md p-5 space-y-4 print:border-black">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800/50 pb-2 flex items-center gap-2">
                                <BarChart3 size={14} className="text-indigo-400" />
                                <span>Distribución por Sector Geotécnico</span>
                            </h3>
                            <div className="rounded-xl border border-slate-800/80 overflow-hidden">
                                <div className="max-h-56 overflow-y-auto bg-[#02040a] scrollbar-thin scrollbar-thumb-slate-800">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-950 text-xs text-slate-400 font-extrabold uppercase tracking-wider border-b border-slate-800 print:bg-slate-100 print:text-black">
                                                <th className="py-2.5 px-3 bg-slate-950">Sector</th>
                                                <th className="py-2.5 px-3 text-center bg-slate-950">Estructuras (N)</th>
                                                <th className="py-2.5 px-3 text-center text-red-500 bg-slate-950">Alertas (%)</th>
                                                <th className="py-2.5 px-3 text-center text-orange-500 bg-slate-950">Advs (%)</th>
                                                <th className="py-2.5 px-3 text-center text-yellow-500 bg-slate-950">Vacíos (%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {kpis.distribucion_sector?.map((row: any, idx: number) => {
                                                const isFiltered = filterSector === row.sector;
                                                return (
                                                    <tr
                                                        key={idx}
                                                        onClick={() => handleFilterSector(row.sector)}
                                                        className={`border-b border-slate-900/60 cursor-pointer transition-colors ${isFiltered ? 'bg-indigo-500/15 ring-2 ring-indigo-500/40' : 'hover:bg-slate-900/30'
                                                            }`}
                                                    >
                                                        <td className="py-2 px-3 font-bold text-slate-200">{row.sector}</td>
                                                        <td className="py-2 px-3 text-center font-mono">{row.discontinuidades}</td>
                                                        <td className="py-2 px-3 text-center font-mono font-bold text-red-400">
                                                            {row.alertas_cant} <span className="text-[10px] text-slate-500 font-normal">({row.alertas_pct.toFixed(2)}%)</span>
                                                        </td>
                                                        <td className="py-2 px-3 text-center font-mono font-bold text-orange-400">
                                                            {row.advertencias_cant} <span className="text-[10px] text-slate-500 font-normal">({row.advertencias_pct.toFixed(2)}%)</span>
                                                        </td>
                                                        <td className="py-2 px-3 text-center font-mono font-bold text-yellow-400">
                                                            {row.vacios_cant} <span className="text-[10px] text-slate-500 font-normal">({row.vacios_pct.toFixed(2)}%)</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* DISTRIBUCIÓN POR GEOTÉCNICO / LOGUEADOR */}
                        <div className="rounded-xl border border-slate-800/80 bg-[#090f1d]/50 backdrop-blur-md p-5 space-y-4 print:border-black">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800/50 pb-2 flex items-center gap-2">
                                <User size={14} className="text-indigo-400" />
                                <span>Responsable del Registro (Errores)</span>
                            </h3>
                            <div className="rounded-xl border border-slate-800/80 overflow-hidden">
                                <div className="max-h-56 overflow-y-auto bg-[#02040a] scrollbar-thin scrollbar-thumb-slate-800">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-950 text-xs text-slate-400 font-extrabold uppercase tracking-wider border-b border-slate-800 print:bg-slate-100 print:text-black">
                                                <th className="py-2.5 px-3 bg-slate-950">Geotécnico</th>
                                                <th className="py-2.5 px-3 text-center bg-slate-950">Estructuras (N)</th>
                                                <th className="py-2.5 px-3 text-center text-red-500 bg-slate-950">Alertas (%)</th>
                                                <th className="py-2.5 px-3 text-center text-orange-500 bg-slate-950">Advs (%)</th>
                                                <th className="py-2.5 px-3 text-center text-yellow-500 bg-slate-950">Vacíos (%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {kpis.distribucion_geotecnico?.map((row: any, idx: number) => {
                                                const isFiltered = filterGeotecnico === row.geotecnico;
                                                return (
                                                    <tr
                                                        key={idx}
                                                        onClick={() => handleFilterGeotecnico(row.geotecnico)}
                                                        className={`border-b border-slate-900/60 cursor-pointer transition-colors ${isFiltered ? 'bg-indigo-500/15 ring-2 ring-indigo-500/40' : 'hover:bg-slate-900/30'
                                                            }`}
                                                    >
                                                        <td className="py-2 px-3 font-bold text-slate-200 truncate max-w-[100px]">{row.geotecnico}</td>
                                                        <td className="py-2 px-3 text-center font-mono">{row.discontinuidades}</td>
                                                        <td className="py-2 px-3 text-center font-mono font-bold text-red-400">
                                                            {row.alertas_cant} <span className="text-[10px] text-slate-500 font-normal">({row.alertas_pct.toFixed(2)}%)</span>
                                                        </td>
                                                        <td className="py-2 px-3 text-center font-mono font-bold text-orange-400">
                                                            {row.advertencias_cant} <span className="text-[10px] text-slate-500 font-normal">({row.advertencias_pct.toFixed(2)}%)</span>
                                                        </td>
                                                        <td className="py-2 px-3 text-center font-mono font-bold text-yellow-400">
                                                            {row.vacios_cant} <span className="text-[10px] text-slate-500 font-normal">({row.vacios_pct.toFixed(2)}%)</span>
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

                    {/* CUADROS GEMELOS: ALERTAS DE INCOMPATIBILIDAD FISICA VS ADVERTENCIAS DE CONSISTENCIA */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* COMPONENTE IZQUIERDO: ALERTAS CRÍTICAS CON MAYOR CANTIDAD DE OCURRENCIAS */}
                        <div className="rounded-xl border border-slate-800/80 bg-[#090f1d]/30 p-5 space-y-4 print:border-black shadow-lg">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800/50 pb-2 flex items-center gap-2">
                                <AlertTriangle size={14} className="text-red-500" />
                                <span>Alertas Críticas con Mayor Cantidad de Ocurrencias</span>
                            </h3>

                            <div className="rounded-xl border border-slate-800/80 overflow-hidden">
                                <div className="space-y-3 max-h-[420px] overflow-y-auto p-2 bg-[#02040a]/40 scrollbar-thin scrollbar-thumb-slate-800">
                                    {kpis.error_types_detailed?.alertas?.map((item: any, idx: number) => {
                                        const isFiltered = filterSearch === item.mensaje;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setFilterSearch(prev => prev === item.mensaje ? '' : item.mensaje)}
                                                className={`w-full flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-xl border text-left transition-all hover:scale-[1.015] ${isFiltered
                                                    ? 'bg-red-500/10 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-500/30'
                                                    : 'bg-[#0f172a]/30 border-slate-800/80 hover:bg-slate-900/50 hover:border-slate-700'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    {/* NUEVO FORMATEADOR DE RANKING PARA ALERTAS */}
                                                    <span className={`shrink-0 ${getAlertRankStyle(idx)}`}>
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-red-500 font-black uppercase text-xs tracking-wider leading-relaxed block break-words">
                                                        {item.mensaje}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 mt-2 md:mt-0 ml-0 md:ml-4 shrink-0">
                                                    <span className="bg-[#02040a] border border-slate-800/80 text-slate-300 px-2.5 py-1 rounded-md text-xs font-normal lowercase font-sans">
                                                        {item.cantidad.toLocaleString()} ocurrencias
                                                    </span>
                                                    <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-md text-xs font-normal lowercase font-sans">
                                                        {item.pct.toFixed(2)}% del total
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* COMPONENTE DERECHO: ADVERTENCIAS DE CONSISTENCIA CON MAYOR CANTIDAD DE OCURRENCIAS */}
                        <div className="rounded-xl border border-slate-800/80 bg-[#090f1d]/30 p-5 space-y-4 print:border-black shadow-lg">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800/50 pb-2 flex items-center gap-2">
                                <Settings size={14} className="text-amber-500" />
                                <span>Advertencias de Consistencia con Mayor Cantidad de Ocurrencias</span>
                            </h3>

                            <div className="rounded-xl border border-slate-800/80 overflow-hidden">
                                <div className="space-y-3 max-h-[420px] overflow-y-auto p-2 bg-[#02040a]/40 scrollbar-thin scrollbar-thumb-slate-800">
                                    {kpis.error_types_detailed?.advertencias?.map((item: any, idx: number) => {
                                        const isFiltered = filterSearch === item.mensaje;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setFilterSearch(prev => prev === item.mensaje ? '' : item.mensaje)}
                                                className={`w-full flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-xl border text-left transition-all hover:scale-[1.015] ${isFiltered
                                                    ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/30'
                                                    : 'bg-[#0f172a]/30 border-slate-800/80 hover:bg-slate-900/50 hover:border-slate-700'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    {/* NUEVO FORMATEADOR DE RANKING PARA ADVERTENCIAS */}
                                                    <span className={`shrink-0 ${getWarningRankStyle(idx)}`}>
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-orange-500 font-black uppercase text-xs tracking-wider leading-relaxed block break-words">
                                                        {item.mensaje}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 mt-2 md:mt-0 ml-0 md:ml-4 shrink-0">
                                                    <span className="bg-[#02040a] border border-slate-800/80 text-slate-300 px-2.5 py-1 rounded-md text-xs font-normal lowercase font-sans">
                                                        {item.cantidad.toLocaleString()} ocurrencias
                                                    </span>
                                                    <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2.5 py-1 rounded-md text-xs font-normal lowercase font-sans">
                                                        {item.pct.toFixed(2)}% del total
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* VISOR COMPLETO FILA POR FILA (LIVE DETAILED GRID CON BUSCADOR) */}
                    <div className="rounded-xl border border-slate-800/80 bg-[#090f1d]/30 p-6 space-y-4 print:hidden shadow-lg">

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                                    <FileText size={14} className="text-indigo-400" />
                                    <span>Buscador y Monitor de Anomalías Paginado</span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Mostrando **{totalRecords.toLocaleString()}** registros de estructuras que coinciden con los filtros cruzados seleccionados.
                                </p>
                            </div>

                            {/* BUSCADOR */}
                            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800/80 rounded-lg px-3 py-1.5 w-full sm:w-64">
                                <Search size={14} className="text-slate-500 shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Buscar columna, celda, error..."
                                    value={filterSearch}
                                    onChange={(e) => setFilterSearch(e.target.value)}
                                    className="bg-transparent text-xs text-slate-200 focus:outline-none w-full font-bold"
                                />
                                {filterSearch && (
                                    <button onClick={() => setFilterSearch('')} className="text-slate-500 hover:text-slate-300">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* TABLA DE INCIDENCIAS */}
                        <div className="rounded-xl border border-slate-800/60 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800/80 h-10 uppercase text-xs tracking-wider">
                                            <th className="py-2.5 px-3 text-center">Fila</th>
                                            <th className="py-2.5 px-3">Estación Padre</th>
                                            <th className="py-2.5 px-3">Estructura</th>
                                            <th className="py-2.5 px-3">Campaña</th>
                                            <th className="py-2.5 px-3">Geotécnico</th>
                                            <th className="py-2.5 px-3">Columna</th>
                                            <th className="py-2.5 px-3 text-center">Valor</th>
                                            <th className="py-2.5 px-3 text-center">Tipo</th>
                                            <th className="py-2.5 px-3">Feedback / Retroalimentación de Consistencia</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {incidencias.map((inc, i) => (
                                            <tr key={i} className="border-b border-slate-900/40 hover:bg-slate-900/10">
                                                <td className="py-2 px-3 text-center font-mono text-slate-500 h-8">{inc.fila_excel}</td>
                                                <td className="py-2 px-3 font-bold text-slate-200 h-8">{inc.celda_padre}</td>
                                                <td className="py-2 px-3 font-semibold text-slate-300 h-8">{inc.celda_hija}</td>
                                                <td className="py-2 px-3 text-slate-400 font-mono h-8">{inc.campania || 'N/A'}</td>
                                                <td className="py-2 px-3 text-slate-400 font-medium h-8">{inc.geotecnico || 'N/A'}</td>
                                                <td className="py-2 px-3 text-indigo-400 font-mono h-8">{inc.columna}</td>
                                                <td className="py-2 px-3 text-center font-bold h-8">
                                                    {inc.valor_actual !== null ? String(inc.valor_actual) : '—'}
                                                </td>
                                                <td className="py-2 px-3 text-center h-8">
                                                    <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase ${inc.tipo_incidencia === 'ALERTA'
                                                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                        : inc.tipo_incidencia === 'ADVERTENCIA'
                                                            ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                                        }`}>
                                                        {inc.tipo_incidencia === 'VACIO' ? 'VACÍO' : inc.tipo_incidencia}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3 text-slate-300 italic leading-snug h-8">{inc.mensaje}</td>
                                            </tr>
                                        ))}
                                        {incidencias.length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="py-8 text-center text-slate-500 italic">
                                                    No se hallaron complejidades para los filtros seleccionados.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* CONTROLES DE PAGINACIÓN */}
                        <div className="flex justify-between items-center text-xs text-slate-400 pt-2 select-none">
                            <span>Página **{page}** de **{totalPages}**</span>
                            <div className="flex gap-2">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => {
                                        const newPage = page - 1;
                                        setPage(newPage);
                                        fetchPaginatedIncidencias(newPage);
                                    }}
                                    className="p-1.5 rounded-lg bg-[#090f1d] hover:bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => {
                                        const newPage = page + 1;
                                        setPage(newPage);
                                        fetchPaginatedIncidencias(newPage);
                                    }}
                                    className="p-1.5 rounded-lg bg-[#090f1d] hover:bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
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