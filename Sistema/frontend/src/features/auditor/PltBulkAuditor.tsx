import React, { useState, useEffect, useRef } from 'react';
import {
    FileSpreadsheet, AlertTriangle, Database, ShieldCheck, Download,
    Loader2, RefreshCw, Trash2, X, WifiOff
} from 'lucide-react';
import { apiFetch, getAuthHeaders } from '../../utils/apiClient';

import PltImportWizard from './components/PltImportWizard';
import PltAuditHistory, { type PltAuditHistoryItem } from './components/PltAuditHistory';
import PltKpiMetrics from './components/PltKpiMetrics';
import PltConsolidatedDeviations from './components/PltConsolidatedDeviations';
import PltDistributionBreakdown from './components/PltDistributionBreakdown';
import PltCellIntegrityTable from './components/PltCellIntegrityTable';
import PltAnomaliesViewer from './components/PltAnomaliesViewer';

interface PltBulkAuditorProps {
    apiBase: string;
}

export default function PltBulkAuditor({ apiBase }: PltBulkAuditorProps) {
    const [status, setStatus] = useState<'idle' | 'uploading' | 'loaded' | 'error'>(() => {
        const saved = localStorage.getItem('gema_plt_bulk_auditor_status');
        return (saved as any) || 'idle';
    });

    const [message, setMessage] = useState<string>(() => {
        return localStorage.getItem('gema_plt_bulk_auditor_message') || '';
    });

    const [selectedAuditId, setSelectedAuditId] = useState<string>(() => {
        return localStorage.getItem('gema_plt_bulk_auditor_audit_id') || '';
    });

    const [excelReady, setExcelReady] = useState<boolean>(false);
    const [errorKind, setErrorKind] = useState<string | null>(null);
    const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);

    // Historial e indicadores KPI
    const [history, setHistory] = useState<PltAuditHistoryItem[]>([]);
    const [kpis, setKpis] = useState<any>(null);

    // Paginación y filtros
    const [incidencias, setIncidencias] = useState<any[]>([]);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [totalRecords, setTotalRecords] = useState<number>(0);

    const [filterTipo, setFilterTipo] = useState<string>('');
    const [filterCelda, setFilterCelda] = useState<string>('');
    const [filterCampania, setFilterCampania] = useState<string>('');
    const [filterLitologia, setFilterLitologia] = useState<string>('');
    const [filterSecuencia, setFilterSecuencia] = useState<string>('');
    const [filterSearch, setFilterSearch] = useState<string>('');

    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [selectedObservation, setSelectedObservation] = useState<string | null>(null);
    const [isConsolidatedExpanded, setIsConsolidatedExpanded] = useState<boolean>(false);
    const [loadingTable, setLoadingTable] = useState<boolean>(false);

    // Sincronización con localStorage
    useEffect(() => {
        localStorage.setItem('gema_plt_bulk_auditor_status', status);
    }, [status]);

    useEffect(() => {
        localStorage.setItem('gema_plt_bulk_auditor_message', message);
    }, [message]);

    useEffect(() => {
        localStorage.setItem('gema_plt_bulk_auditor_audit_id', selectedAuditId);
    }, [selectedAuditId]);

    // Cargar Historial
    const fetchHistory = async () => {
        try {
            const res = await apiFetch(`${apiBase}/api/auditoria/plt/auditorias`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data || []);
            }
        } catch (e) {
            console.error('Error fetching PLT history:', e);
        }
    };

    // Cargar Resumen / KPIs
    const fetchKpis = async (campaniasFilter?: string[]) => {
        try {
            const params = new URLSearchParams();
            const years = campaniasFilter !== undefined ? campaniasFilter : selectedYears;
            if (years.length > 0) {
                params.set('campania', years.join(','));
            }

            const res = await apiFetch(`${apiBase}/api/auditoria/plt/resumen-ligero?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setKpis(data);
                setStatus('loaded');
                setExcelReady(true);
            } else if (res.status === 404) {
                setStatus('idle');
                setKpis(null);
                setExcelReady(false);
            }
        } catch (e) {
            console.error('Error fetching PLT KPIs:', e);
        }
    };

    // Cargar Incidencias Paginadas
    const fetchPaginatedIncidencias = async (currentPage = 1) => {
        if (status !== 'loaded' && !selectedAuditId) return;

        setLoadingTable(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(currentPage));
            params.set('limit', '50');

            if (filterTipo) params.set('tipo_incidencia', filterTipo);
            if (selectedYears.length > 0) {
                params.set('campania', selectedYears.join(','));
            } else if (filterCampania) {
                params.set('campania', filterCampania);
            }

            let effectiveSearch = filterSearch;
            if (selectedObservation) {
                effectiveSearch = selectedObservation;
            } else if (filterCelda) {
                effectiveSearch = filterCelda;
            } else if (filterLitologia) {
                effectiveSearch = filterLitologia;
            }

            if (effectiveSearch) params.set('search', effectiveSearch);

            const res = await apiFetch(`${apiBase}/api/auditoria/plt/incidencias-paginadas?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setIncidencias(data.items || []);
                setTotalPages(data.total_pages || 1);
                setTotalRecords(data.total_items || 0);
            }
        } catch (e) {
            console.error('Error fetching paginated PLT incidencias:', e);
        } finally {
            setLoadingTable(false);
        }
    };

    // Carga inicial
    useEffect(() => {
        fetchHistory();
        if (status === 'loaded' || selectedAuditId) {
            fetchKpis();
        }
    }, [selectedAuditId]);

    // Recargar incidencias al cambiar filtros
    useEffect(() => {
        if (status === 'loaded' || selectedAuditId) {
            setPage(1);
            fetchPaginatedIncidencias(1);
        }
    }, [filterTipo, filterCelda, filterCampania, filterLitologia, filterSearch, selectedObservation, selectedYears]);

    // Recargar KPIs al cambiar filtro de años
    useEffect(() => {
        if (status === 'loaded' || selectedAuditId) {
            fetchKpis(selectedYears);
        }
    }, [selectedYears]);

    // Cerrar Auditoría (Funciona 100%)
    const handleCloseView = () => {
        setStatus('idle');
        setSelectedAuditId('');
        setKpis(null);
        setIncidencias([]);
        setMessage('');
        setExcelReady(false);
        setErrorKind(null);
        setSelectedYears([]);
        setFilterTipo('');
        setFilterCelda('');
        setFilterCampania('');
        setFilterLitologia('');
        setFilterSearch('');
        setSelectedObservation(null);

        localStorage.removeItem('gema_plt_bulk_auditor_status');
        localStorage.removeItem('gema_plt_bulk_auditor_message');
        localStorage.removeItem('gema_plt_bulk_auditor_audit_id');
    };

    // Procesar Carga desde el Modal
    const handleConfirmImport = async ({ file, tolerance }: { file: File; tolerance: number }) => {
        setIsWizardOpen(false);
        setStatus('uploading');
        setMessage('Cargando y procesando archivo Excel PLT...');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await apiFetch(`${apiBase}/api/auditoria/plt/upload?tolerance=${tolerance}`, {
                method: 'POST',
                body: formData,
                timeoutMs: 120_000,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Error en la validación del archivo.');
            }

            const data = await res.json();
            setSelectedAuditId(file.name);
            setKpis(data.metricas);
            setStatus('loaded');
            setExcelReady(true);
            fetchHistory();
        } catch (e: any) {
            setStatus('error');
            setMessage(e.message || 'Error inesperado al auditar el archivo.');
        }
    };

    // Descargar Reporte Excel Multi-Hoja
    const handleExportExcel = async () => {
        try {
            const params = new URLSearchParams();
            if (selectedYears.length > 0) {
                params.set('campania', selectedYears.join(','));
            }

            const res = await apiFetch(`${apiBase}/api/auditoria/plt/reporte-excel?${params.toString()}`);
            if (!res.ok) throw new Error('Error al generar el reporte Excel.');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte_auditoria_qaqc_plt_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Error al exportar Excel PLT:', e);
        }
    };

    // Campañas disponibles
    const uniqueYears = kpis?.distribucion_campania?.map((c: any) => String(c.campania)) || [];

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 text-slate-200 select-none font-sans bg-navy-950">
            {/* Modal de Importación */}
            <PltImportWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onConfirm={handleConfirmImport}
            />

            {/* Historial de Auditorías */}
            {status !== 'uploading' && (
                <PltAuditHistory
                    history={history}
                    selectedAuditId={selectedAuditId}
                    onSelectAudit={(auditId) => {
                        setSelectedAuditId(auditId);
                        fetchKpis();
                    }}
                />
            )}

            {/* ESTADO IDLE / VACÍO */}
            {status !== 'loaded' && !selectedAuditId && status !== 'uploading' && status !== 'error' && (
                <div className="rounded-2xl border border-cyan-500/15 p-10 space-y-8 max-w-xl mx-auto bg-gradient-to-b from-navy-900/60 to-navy-950/90 shadow-2xl mt-12 relative overflow-hidden backdrop-blur-md">
                    <div className="text-center space-y-3 relative z-10">
                        <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full w-14 h-14 flex items-center justify-center mx-auto shadow-md">
                            <Database size={24} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">
                                Nueva Auditoría PLT Irregular
                            </h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed font-semibold">
                                Sube una planilla de Ensayos de Carga Puntual (PLT) para evaluar 34 columnas obligatorias, fórmulas con tolerancia e integridad de secuencias A-B-C-D.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsWizardOpen(true)}
                        className="w-full border border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10 rounded-2xl p-8 text-center transition-all cursor-pointer relative group flex flex-col items-center gap-3"
                    >
                        <FileSpreadsheet size={36} className="text-cyan-500 group-hover:text-cyan-300 transition-colors" />
                        <div>
                            <span className="text-sm font-black text-slate-200 block group-hover:text-cyan-300 transition-colors">
                                Iniciar Asistente de Carga PLT
                            </span>
                            <span className="text-xs text-slate-500 block mt-1 font-bold">
                                Carga un libro Excel (.xlsx / .xlsm) de ensayos PLT o BD consolidada.
                            </span>
                        </div>
                    </button>
                </div>
            )}

            {/* ESTADO ERROR */}
            {status === 'error' && (
                <div className="rounded-2xl border border-red-500/25 p-8 max-w-xl mx-auto bg-red-950/20 shadow-2xl mt-12 relative overflow-hidden backdrop-blur-md">
                    <div className="text-center space-y-4">
                        <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-400 rounded-full w-14 h-14 flex items-center justify-center mx-auto shadow-md">
                            <AlertTriangle size={24} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">
                                Error en la Auditoría PLT
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed font-semibold max-w-md mx-auto">
                                {message}
                            </p>
                        </div>
                        <div className="flex gap-2 justify-center pt-2">
                            <button
                                onClick={handleCloseView}
                                className="bg-navy-800 hover:bg-navy-750 border border-navy-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-black transition-all active:scale-95"
                            >
                                Volver al inicio
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ESTADO CARGANDO / PROCESANDO */}
            {status === 'uploading' && (
                <div className="rounded-2xl border border-cyan-500/15 text-center space-y-6 max-w-lg mx-auto bg-navy-900/90 p-10 shadow-2xl mt-12 animate-fade-in">
                    <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-cyan-400 border-r-cyan-400 rounded-full animate-spin"></div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center justify-center gap-1.5">
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Auditando Planilla PLT...</span>
                        </p>
                        <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                            Evaluando 34 columnas, resolviendo cascada litológica, verificando tolerancias en fórmulas y validando secuencias cronológicas A-B-C-D.
                        </p>
                    </div>
                </div>
            )}

            {/* DASHBOARD PRINCIPAL (VERTICAL INTEGRATED) */}
            {(status === 'loaded' || selectedAuditId) && kpis && status !== 'uploading' && status !== 'error' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Barra de Cabecera Activa */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-navy-900/60 p-4 border border-cyan-500/10 rounded-xl gap-4 shadow-md backdrop-blur-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg">
                                    <ShieldCheck size={18} />
                                </div>
                                <div>
                                    <h1 className="text-xs font-black uppercase tracking-widest">
                                        Auditoría QA/QC Ensayos PLT
                                    </h1>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Planilla Activa: <span className="font-bold text-slate-100">{kpis?.nombre_archivo || selectedAuditId || 'Ensayos PLT'}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Selector de Campañas */}
                            {uniqueYears.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 bg-navy-950 border border-navy-800 rounded-xl p-1">
                                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest px-2">Campañas:</span>
                                    <button
                                        onClick={() => setSelectedYears([])}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                            selectedYears.length === 0 ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-navy-900/60 text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        Todas
                                    </button>
                                    {uniqueYears.map((yr: string) => {
                                        const isSelected = selectedYears.includes(yr);
                                        return (
                                            <button
                                                key={yr}
                                                onClick={() => {
                                                    setSelectedYears(prev =>
                                                        isSelected ? prev.filter(y => y !== yr) : [...prev, yr]
                                                    );
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                                    isSelected ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-navy-900/60 text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                {yr}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Botones Cerrar y Exportar Excel */}
                        <div className="flex gap-2.5 w-full sm:w-auto shrink-0 justify-end">
                            <button
                                onClick={handleCloseView}
                                className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-300 px-3.5 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
                            >
                                <Trash2 size={14} className="text-red-400" />
                                <span>Cerrar</span>
                            </button>

                            <button
                                disabled={!excelReady}
                                onClick={handleExportExcel}
                                className={`flex items-center gap-1.5 border px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md active:scale-95 ${
                                    excelReady
                                        ? 'bg-cyan-500 hover:bg-cyan-600 border-cyan-400/30 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                                        : 'bg-navy-900/50 border-navy-850 text-slate-500 cursor-not-allowed opacity-60'
                                }`}
                            >
                                {!excelReady ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin text-cyan-400" />
                                        <span>Cargando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download size={14} />
                                        <span>Reporte Excel</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* 1. Tarjetas KPI Métricas */}
                    <PltKpiMetrics
                        kpis={kpis}
                        filterTipo={filterTipo}
                        onFilterTipo={(tipo) => setFilterTipo(prev => prev === tipo ? '' : tipo)}
                        filterSecuencia={filterSecuencia}
                        onFilterSecuencia={(sec) => setFilterSecuencia(prev => prev === sec ? '' : sec)}
                    />

                    {/* 2. Consolidado de Desviaciones */}
                    <PltConsolidatedDeviations
                        kpis={kpis}
                        selectedObservation={selectedObservation}
                        setSelectedObservation={setSelectedObservation}
                        isConsolidatedExpanded={isConsolidatedExpanded}
                        setIsConsolidatedExpanded={setIsConsolidatedExpanded}
                    />

                    {/* 3. Distribución por Campaña, Worst Cells y Litología */}
                    <PltDistributionBreakdown
                        kpis={kpis}
                        filterCampania={filterCampania}
                        onFilterCampania={(camp) => setFilterCampania(prev => prev === camp ? '' : camp)}
                        filterCelda={filterCelda}
                        onFilterCelda={(celda) => setFilterCelda(prev => prev === celda ? '' : celda)}
                        filterLitologia={filterLitologia}
                        onFilterLitologia={(lito) => setFilterLitologia(prev => prev === lito ? '' : lito)}
                    />

                    {/* 4. Tabla de Integridad de Secuencias ABCD por Celda */}
                    <PltCellIntegrityTable
                        resumenPorCelda={kpis?.resumen_por_celda || {}}
                        filterSecuencia={filterSecuencia}
                        onSelectCell={(celda) => {
                            setFilterCelda(prev => prev === celda ? '' : celda);
                        }}
                    />

                    {/* 5. Monitor de Anomalías Paginado */}
                    <PltAnomaliesViewer
                        incidencias={incidencias}
                        totalRecords={totalRecords}
                        filterSearch={filterSearch}
                        onFilterSearch={(search) => setFilterSearch(search)}
                        page={page}
                        totalPages={totalPages}
                        onPageChange={(newPage) => {
                            setPage(newPage);
                            fetchPaginatedIncidencias(newPage);
                        }}
                        kpis={kpis}
                        isLoading={loadingTable}
                    />

                    {/* 6. Historial de Auditorías en Pie de Página */}
                    <PltAuditHistory
                        history={history}
                        selectedAuditId={selectedAuditId}
                        onSelectAudit={(auditId) => {
                            setSelectedAuditId(auditId);
                            fetchKpis();
                        }}
                    />
                </div>
            )}
        </div>
    );
}
