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
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'loaded' | 'error'>(() => {
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
    const [errorKind, setErrorKind] = useState<'network' | 'not_found' | 'processing' | null>(() => {
        return (localStorage.getItem('gema_plt_bulk_auditor_error_kind') as any) || null;
    });
    const [auditVerified, setAuditVerified] = useState<boolean>(false);
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

    // Procesamiento en segundo plano y toast
    const [processingAuditId, setProcessingAuditId] = useState<string>(() => {
        return localStorage.getItem('gema_plt_bulk_auditor_processing_id') || '';
    });
    const [processingFileName, setProcessingFileName] = useState<string>(() => {
        return localStorage.getItem('gema_plt_bulk_auditor_processing_file') || '';
    });
    const [showProgressToast, setShowProgressToast] = useState<string>('');
    const [loadingTable, setLoadingTable] = useState<boolean>(false);

    const pollingRef = useRef<any>(null);
    const selectedAuditIdRef = useRef(selectedAuditId);

    useEffect(() => {
        selectedAuditIdRef.current = selectedAuditId;
    }, [selectedAuditId]);

    // Sincronización de estado con localStorage
    useEffect(() => {
        localStorage.setItem('gema_plt_bulk_auditor_status', status);
    }, [status]);

    useEffect(() => {
        localStorage.setItem('gema_plt_bulk_auditor_message', message);
    }, [message]);

    useEffect(() => {
        if (errorKind) {
            localStorage.setItem('gema_plt_bulk_auditor_error_kind', errorKind);
        } else {
            localStorage.removeItem('gema_plt_bulk_auditor_error_kind');
        }
    }, [errorKind]);

    useEffect(() => {
        localStorage.setItem('gema_plt_bulk_auditor_audit_id', selectedAuditId);
    }, [selectedAuditId]);

    useEffect(() => {
        if (processingAuditId) {
            localStorage.setItem('gema_plt_bulk_auditor_processing_id', processingAuditId);
        } else {
            localStorage.removeItem('gema_plt_bulk_auditor_processing_id');
        }
    }, [processingAuditId]);

    useEffect(() => {
        if (processingFileName) {
            localStorage.setItem('gema_plt_bulk_auditor_processing_file', processingFileName);
        } else {
            localStorage.removeItem('gema_plt_bulk_auditor_processing_file');
        }
    }, [processingFileName]);

    useEffect(() => {
        if (!processingAuditId) setProcessingFileName('');
    }, [processingAuditId]);

    useEffect(() => {
        fetchHistory();
    }, []);

    // Verificación inicial al montar (evita pantallas congeladas o estados muertos)
    useEffect(() => {
        if (status === 'uploading' || (status === 'processing' && !processingAuditId)) {
            setStatus('idle');
            return;
        }
        if (status === 'loaded' && selectedAuditId) {
            verifyAuditExists(selectedAuditId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Poller de estado cuando hay procesamiento en curso
    useEffect(() => {
        if (processingAuditId) {
            startStatusPolling(processingAuditId);
        } else {
            stopStatusPolling();
        }
    }, [processingAuditId]);

    useEffect(() => () => { stopStatusPolling(); }, []);

    // Carga de KPIs cuando el dashboard está verificado
    useEffect(() => {
        if (status === 'loaded' && selectedAuditId && auditVerified) {
            fetchKpis(selectedYears, selectedAuditId);
        }
    }, [status, selectedAuditId, selectedYears, auditVerified]);

    // Recargar incidencias paginadas
    useEffect(() => {
        if (status === 'loaded' && selectedAuditId && auditVerified) {
            setPage(1);
            fetchPaginatedIncidencias(1);
        }
    }, [status, selectedAuditId, selectedYears, filterTipo, filterCelda, filterCampania, filterLitologia, filterSearch, selectedObservation, auditVerified]);

    // --- POLLER DE ESTADO (GET /status) ---
    const MAX_CONSECUTIVE_FAILURES = 4;
    const POLL_INTERVAL_MS = 2500;

    const startStatusPolling = (auditId: string) => {
        stopStatusPolling();
        let fails = 0;

        const tick = async () => {
            try {
                const params = new URLSearchParams();
                if (auditId) params.set('audit_id', auditId);
                const res = await fetch(`${apiBase}/api/auditoria/plt/status?${params.toString()}`, { headers: getAuthHeaders() });

                if (res.status === 404) {
                    failAudit('not_found', 'La auditoría PLT ya no existe en el servidor (probablemente se reinició o se perdieron los archivos). Vuelve a cargar tu planilla.', auditId);
                    return;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const data = await res.json();
                fails = 0;

                if (data.status === 'procesando') return; // sigue procesando

                if (data.status === 'error') {
                    failAudit('processing', data.detail || 'El procesamiento falló en el servidor.', auditId);
                    return;
                }

                // Listo
                setExcelReady(Boolean(data.reporte_listo));
                setAuditVerified(true);

                if (!data.reporte_listo) {
                    if (selectedAuditIdRef.current === auditId) {
                        setStatus('loaded');
                    }
                    return;
                }

                stopStatusPolling();
                setProcessingAuditId('');
                fetchHistory();

                if (selectedAuditIdRef.current === auditId) {
                    setStatus('loaded');
                }
                setShowProgressToast(`Auditoría PLT finalizada. La planilla "${data.nombre_archivo || 'importada'}" se encuentra procesada.`);
            } catch (e) {
                fails += 1;
                if (fails >= MAX_CONSECUTIVE_FAILURES) {
                    failAudit('network', 'No se pudo contactar al servidor. Verifica tu conexión o el estado del servicio.', auditId);
                }
            }
        };

        tick();
        pollingRef.current = setInterval(tick, POLL_INTERVAL_MS);
    };

    const stopStatusPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    const failAudit = (kind: 'network' | 'not_found' | 'processing', msg: string, auditId: string) => {
        stopStatusPolling();
        setErrorKind(kind);
        setMessage(msg);
        setAuditVerified(false);

        if (selectedAuditIdRef.current !== auditId) {
            setProcessingAuditId('');
            setShowProgressToast(msg);
            return;
        }

        setStatus('error');
        setKpis(null);
        setIncidencias([]);
        if (kind !== 'network') {
            setSelectedAuditId('');
            setProcessingAuditId('');
        }
    };

    // Verificación única de existencia de auditoría
    const verifyAuditExists = async (auditId: string) => {
        try {
            const params = new URLSearchParams();
            if (auditId) params.set('audit_id', auditId);
            const res = await fetch(`${apiBase}/api/auditoria/plt/status?${params.toString()}`, { headers: getAuthHeaders() });

            if (res.status === 404) {
                failAudit('not_found', 'La auditoría PLT ya no existe en el servidor (probablemente se reinició o se perdieron los archivos).', auditId);
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            if (data.status === 'error') {
                failAudit('processing', data.detail || 'El procesamiento falló en el servidor.', auditId);
                return;
            }
            if (data.status !== 'listo') {
                failAudit('not_found', 'La auditoría solicitada no está completa en el servidor.', auditId);
                return;
            }

            setExcelReady(Boolean(data.reporte_listo));
            setAuditVerified(true);
        } catch (e) {
            failAudit('network', 'No se pudo contactar al servidor. Verifica tu conexión o el estado del servicio.', auditId);
        }
    };

    const handleRetry = () => {
        setErrorKind(null);
        setMessage('');
        if (processingAuditId) {
            setStatus('processing');
            startStatusPolling(processingAuditId);
        } else if (selectedAuditId) {
            setStatus('loaded');
            verifyAuditExists(selectedAuditId);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${apiBase}/api/auditoria/plt/auditorias`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setHistory(data.historial || data || []);
            }
        } catch (e) {
            console.error("Fallo de red cargando historial PLT:", e);
        }
    };

    const fetchKpis = async (campaniasFilter?: string[], auditId?: string) => {
        try {
            const params = new URLSearchParams();
            const years = campaniasFilter !== undefined ? campaniasFilter : selectedYears;
            if (years.length > 0) {
                params.set('campania', years.join(','));
            }
            const effectiveAuditId = auditId !== undefined ? auditId : selectedAuditId;
            if (effectiveAuditId) {
                params.set('audit_id', effectiveAuditId);
            }

            const res = await fetch(`${apiBase}/api/auditoria/plt/resumen-ligero?${params.toString()}`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setKpis(data);
            } else if (res.status === 404) {
                failAudit('not_found', 'La auditoría PLT ya no existe en el servidor (probablemente se reinició o se perdieron los archivos).', effectiveAuditId);
            } else if (res.status === 400) {
                const data = await res.json().catch(() => null);
                failAudit('processing', data?.detail || 'El procesamiento falló en el servidor.', effectiveAuditId);
            }
        } catch (e) {
            failAudit('network', 'No se pudo contactar al servidor. Verifica tu conexión o el estado del servicio.', auditId || selectedAuditId);
        }
    };

    const fetchPaginatedIncidencias = async (currentPage = 1) => {
        setLoadingTable(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(currentPage));
            params.set('limit', '50');

            if (selectedAuditId) params.set('audit_id', selectedAuditId);
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

            const res = await fetch(`${apiBase}/api/auditoria/plt/incidencias-paginadas?${params.toString()}`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setIncidencias(data.items || []);
                setTotalPages(data.total_pages || 1);
                setTotalRecords(data.total_items || 0);
            }
        } catch (e) {
            console.error("Fallo obteniendo incidencias PLT paginadas:", e);
        } finally {
            setLoadingTable(false);
        }
    };

    // Procesar Carga desde el Modal
    const handleWizardConfirm = async (payload: any) => {
        setIsWizardOpen(false);
        setStatus('processing');
        setErrorKind(null);
        setMessage('Ejecutando validación integral de 34 columnas y cálculo de secuencias PLT...');

        const formData = new FormData();
        formData.append('file', payload.file);
        if (payload.proyecto) {
            formData.append('proyecto', payload.proyecto);
        }

        try {
            const cleanBase = apiBase ? apiBase.replace(/\/+$/, '') : '';
            const projParam = payload.proyecto ? `&proyecto=${encodeURIComponent(payload.proyecto)}` : '';
            const res = await fetch(`${cleanBase}/api/auditoria/plt/upload?tolerance=${payload.tolerance || 0.1}${projParam}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                const newId = data.audit_id || payload.file.name;
                setSelectedAuditId(newId);
                setProcessingAuditId(newId);
                setProcessingFileName(data.filename || payload.file.name);
                setKpis(data.metricas);
                setExcelReady(true);
                setAuditVerified(true);
                setStatus('loaded');
                fetchHistory();
            } else {
                let errorMsg = `Error del servidor (HTTP ${res.status})`;
                try {
                    const err = await res.json();
                    if (err.detail) errorMsg = err.detail;
                } catch {
                    const textErr = await res.text().catch(() => '');
                    if (textErr) errorMsg = textErr.slice(0, 200);
                }
                setStatus('error');
                setMessage(errorMsg);
            }
        } catch (e: any) {
            setStatus('error');
            setMessage('Error de red al intentar conectar con el servidor: ' + (e.message || 'Sin conexión'));
        }
    };

    // Cerrar Auditoría y Volver a la Vista de Carga
    const handleCloseView = () => {
        setStatus('idle');
        setSelectedAuditId('');
        setKpis(null);
        setIncidencias([]);
        setMessage('');
        setExcelReady(false);
        setErrorKind(null);
        setAuditVerified(false);
        clearAllFilters();

        localStorage.removeItem('gema_plt_bulk_auditor_status');
        localStorage.removeItem('gema_plt_bulk_auditor_message');
        localStorage.removeItem('gema_plt_bulk_auditor_audit_id');
        localStorage.removeItem('gema_plt_bulk_auditor_error_kind');
    };

    // Cancelar Proceso en Curso
    const handleCancelProcessing = async () => {
        const target = processingAuditId;
        if (target && !window.confirm('¿Cancelar la auditoría PLT en curso? Se detendrá el procesamiento en el servidor y se eliminarán sus archivos parciales.')) return;
        try {
            if (target) {
                await fetch(`${apiBase}/api/auditoria/plt/cancelar?audit_id=${target}`, { method: 'POST', headers: getAuthHeaders() });
            }
        } catch (e) {
            console.warn("No se pudo notificar la cancelación al servidor:", e);
        }
        handleCloseView();
        setProcessingAuditId('');
        setProcessingFileName('');
        localStorage.removeItem('gema_plt_bulk_auditor_processing_id');
        localStorage.removeItem('gema_plt_bulk_auditor_processing_file');
        if (target) setShowProgressToast('Auditoría PLT cancelada.');
    };

    const clearAllFilters = () => {
        setFilterTipo('');
        setFilterCelda('');
        setFilterCampania('');
        setFilterLitologia('');
        setFilterSecuencia('');
        setFilterSearch('');
        setSelectedYears([]);
        setSelectedObservation(null);
    };

    const handleSelectPastAudit = (auditId: string) => {
        setSelectedAuditId(auditId);
        clearAllFilters();
        setStatus('loaded');
        setAuditVerified(false);
        verifyAuditExists(auditId);
    };

    // Descargar Reporte Excel
    const handleExportExcel = async () => {
        if (!excelReady || !selectedAuditId) return;
        try {
            const params = new URLSearchParams();
            if (selectedYears.length > 0) {
                params.set('campania', selectedYears.join(','));
            }
            if (selectedAuditId) {
                params.set('audit_id', selectedAuditId);
            }

            const res = await fetch(`${apiBase}/api/auditoria/plt/reporte-excel?${params.toString()}`, { headers: getAuthHeaders() });
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

    const uniqueYears = kpis?.distribucion_campania?.map((c: any) => String(c.campania)).filter((y: string) => y && y !== "N/A" && y !== "Sin Campaña") || [];

    return (
        <div className="space-y-6 text-left animate-fade-in text-slate-200 p-4 sm:p-6 bg-[#060a14] min-h-screen">
            {/* Modal de Importación */}
            <PltImportWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onConfirm={handleWizardConfirm}
            />

            {/* Historial de Auditorías (Arriba, visible en todo momento salvo durante subida) */}
            {status !== 'uploading' && (
                <PltAuditHistory
                    history={history}
                    selectedAuditId={selectedAuditId}
                    onSelectAudit={handleSelectPastAudit}
                />
            )}

            {/* Banner de Notificación / Toast */}
            {showProgressToast && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-400 font-semibold animate-fade-in shadow-lg">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-400" />
                        <span>{showProgressToast}</span>
                    </div>
                    <button onClick={() => setShowProgressToast('')} className="text-slate-400 hover:text-slate-200">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Banner de Proceso en Segundo Plano */}
            {processingAuditId && (status === 'loaded' || status === 'idle') && (
                <div className="bg-cyan-950/40 border border-cyan-500/20 rounded-xl p-3.5 flex items-center justify-between text-xs text-cyan-400 font-semibold shadow-md animate-fade-in">
                    <div className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-cyan-400" />
                        <span>Generando otra revisión PLT en segundo plano{processingFileName ? `: ${processingFileName}` : ''}...</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setSelectedAuditId(processingAuditId);
                                setStatus('processing');
                            }}
                            className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 px-2.5 py-1 rounded text-xs font-black transition-all"
                        >
                            Ver Progreso
                        </button>
                        <button
                            onClick={handleCancelProcessing}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-2.5 py-1 rounded text-xs font-black transition-all"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* ESTADO IDLE / VACÍO: Tarjeta de Carga Central */}
            {status === 'idle' && !selectedAuditId && (
                <div className="rounded-2xl border border-cyan-500/15 p-10 space-y-8 max-w-xl mx-auto bg-gradient-to-b from-[#0e172a]/60 to-[#090f1d]/90 shadow-2xl mt-12 relative overflow-hidden backdrop-blur-md">
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
                                Carga un libro Excel (.xlsx / .xlsm) de ensayos PLT o formato de campo compacto.
                            </span>
                        </div>
                    </button>
                </div>
            )}

            {/* ESTADO ERROR: Tarjeta con Acciones Claras */}
            {status === 'error' && (
                <div className="rounded-2xl border border-red-500/25 p-8 max-w-xl mx-auto bg-[#170d12]/90 shadow-2xl mt-12 relative overflow-hidden backdrop-blur-md">
                    <div className="text-center space-y-4">
                        <div className={`p-3 rounded-full w-14 h-14 flex items-center justify-center mx-auto shadow-md ${errorKind === 'network' ? 'bg-amber-500/10 border border-amber-500/25 text-amber-400' : 'bg-red-500/10 border border-red-500/25 text-red-400'}`}>
                            {errorKind === 'network' ? <WifiOff size={24} /> : <AlertTriangle size={24} />}
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">
                                {errorKind === 'network' ? 'Conexión con el servidor perdida'
                                    : errorKind === 'not_found' ? 'Auditoría PLT no encontrada'
                                    : 'Error de procesamiento'}
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed font-semibold max-w-md mx-auto">{message}</p>
                        </div>
                        <div className="flex gap-2 justify-center pt-2">
                            {(errorKind === 'network' && (processingAuditId || selectedAuditId)) && (
                                <button
                                    onClick={handleRetry}
                                    className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 px-4 py-2 rounded-lg text-xs font-black transition-all active:scale-95"
                                >
                                    Reintentar
                                </button>
                            )}
                            <button
                                onClick={handleCloseView}
                                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-black transition-all active:scale-95"
                            >
                                Volver al inicio
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ESTADO CARGANDO / PROCESANDO: Spinner con Botón de Cancelación */}
            {(status === 'uploading' || status === 'processing') && (
                <div className="rounded-2xl border border-cyan-500/15 text-center space-y-6 max-w-lg mx-auto bg-[#090f1d]/90 p-10 shadow-2xl mt-12 animate-fade-in">
                    <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-cyan-400 border-r-cyan-400 rounded-full animate-spin"></div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center justify-center gap-1.5">
                            <RefreshCw size={14} className="animate-spin" />
                            <span>{status === 'uploading' ? 'Transmitiendo datos...' : (processingFileName ? `Procesando: ${processingFileName}` : 'Procesando Reglas de Consistencia PLT')}</span>
                        </p>
                        <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                            Evaluando consistencia geométrica, resolviendo cascada litológica, verificando tolerancias en fórmulas y auditando secuencias canónicas A-B-C-D.
                        </p>
                    </div>
                    <div className="pt-2">
                        <button
                            onClick={handleCancelProcessing}
                            className="w-full flex items-center justify-center gap-2 bg-red-500/15 hover:bg-red-600 border border-red-500/30 text-red-400 hover:text-white px-4 py-2.5 rounded-lg text-xs font-black transition-all active:scale-95"
                        >
                            <Trash2 size={14} />
                            <span>Cancelar Proceso</span>
                        </button>
                    </div>
                </div>
            )}

            {/* DASHBOARD PRINCIPAL (VERTICAL INTEGRATED) */}
            {(status === 'loaded' || selectedAuditId) && kpis && status !== 'uploading' && status !== 'processing' && status !== 'error' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Barra de Cabecera Activa */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#090f1d]/60 p-4 border border-cyan-500/10 rounded-xl gap-4 shadow-md backdrop-blur-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg">
                                    <ShieldCheck size={18} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-xs font-black uppercase tracking-widest">
                                            Auditoría QA/QC Ensayos PLT
                                        </h1>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold uppercase">
                                            {kpis?.proyecto?.toUpperCase() || 'FERROBAMBA'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Planilla Activa: <span className="font-bold text-slate-100">{kpis?.nombre_archivo || selectedAuditId || 'Ensayos PLT'}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Selector de Campañas */}
                            {uniqueYears.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 border border-navy-900 rounded-xl p-1">
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
                                className="flex items-center gap-1.5 bg-[#0f172a]/80 hover:bg-slate-900 border border-slate-800 text-slate-350 px-3.5 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
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
                                        : 'bg-[#0f172a]/50 border-navy-850 text-slate-500 cursor-not-allowed opacity-60'
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
                </div>
            )}
        </div>
    );
}
