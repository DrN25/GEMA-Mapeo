import { useState, useEffect, useRef } from 'react';
import {
    FileSpreadsheet, AlertTriangle, Database, ShieldCheck, Download,
    Loader2, RefreshCw, Trash2, X, WifiOff
} from 'lucide-react';
import BulkImportWizard from './BulkImportWizard';

// Subcomponentes del módulo
import AuditHistory from './components/AuditHistory';
import type { AuditHistoryItem } from './components/AuditHistory';
import KpiMetrics from './components/KpiMetrics';
import ConsolidatedDeviations from './components/ConsolidatedDeviations';
import DistributionBreakdown from './components/DistributionBreakdown';
import AnomaliesViewer from './components/AnomaliesViewer';
import ComparativoModal from './components/ComparativoModal';

interface BulkAuditorProps {
    apiBase: string;
}

export default function BulkAuditor({ apiBase }: BulkAuditorProps) {
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'loaded' | 'error'>(() => {
        const saved = localStorage.getItem('geomec_bulk_auditor_status');
        return (saved as any) || 'idle';
    });

    const [message, setMessage] = useState<string>(() => {
        return localStorage.getItem('geomec_bulk_auditor_message') || '';
    });

    const [selectedAuditId, setSelectedAuditId] = useState<string>(() => {
        return localStorage.getItem('geomec_bulk_auditor_audit_id') || '';
    });

    const [excelReady, setExcelReady] = useState<boolean>(false);
    const [errorKind, setErrorKind] = useState<string | null>(() => {
        return localStorage.getItem('geomec_bulk_auditor_error_kind') || null;
    });
    const [auditVerified, setAuditVerified] = useState<boolean>(false);
    const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
    const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);

    // Historial e indicadores KPI
    const [history, setHistory] = useState<AuditHistoryItem[]>([]);
    const [kpis, setKpis] = useState<any>(null);

    // Paginación y filtros
    const [incidencias, setIncidencias] = useState<any[]>([]);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [totalRecords, setTotalRecords] = useState<number>(0);

    const [filterTipo, setFilterTipo] = useState<string>('');
    const [filterCelda, setFilterCelda] = useState<string>('');
    const [filterCampania, setFilterCampania] = useState<string>('');
    const [filterGeotecnico, setFilterGeotecnico] = useState<string>('');
    const [filterSearch, setFilterSearch] = useState<string>('');

    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [selectedObservation, setSelectedObservation] = useState<string | null>(null);
    const [isConsolidatedExpanded, setIsConsolidatedExpanded] = useState<boolean>(false);

    // Hilos de procesamiento asíncrono
    const [processingAuditId, setProcessingAuditId] = useState<string>(() => {
        return localStorage.getItem('geomec_bulk_auditor_processing_id') || '';
    });
    const [processingFileName, setProcessingFileName] = useState<string>(() => {
        return localStorage.getItem('geomec_bulk_auditor_processing_file') || '';
    });
    const [showProgressToast, setShowProgressToast] = useState<string>('');
    const [loadingTable, setLoadingTable] = useState<boolean>(false);

    const pollingRef = useRef<any>(null);
    const selectedAuditIdRef = useRef(selectedAuditId);

    useEffect(() => {
        selectedAuditIdRef.current = selectedAuditId;
    }, [selectedAuditId]);

    // Sincronización del estado con el almacenamiento local
    useEffect(() => {
        localStorage.setItem('geomec_bulk_auditor_status', status);
    }, [status]);

    useEffect(() => {
        localStorage.setItem('geomec_bulk_auditor_message', message);
    }, [message]);

    useEffect(() => {
        if (errorKind) {
            localStorage.setItem('geomec_bulk_auditor_error_kind', errorKind);
        } else {
            localStorage.removeItem('geomec_bulk_auditor_error_kind');
        }
    }, [errorKind]);

    useEffect(() => {
        localStorage.setItem('geomec_bulk_auditor_audit_id', selectedAuditId);
    }, [selectedAuditId]);

    useEffect(() => {
        if (processingAuditId) {
            localStorage.setItem('geomec_bulk_auditor_processing_id', processingAuditId);
        } else {
            localStorage.removeItem('geomec_bulk_auditor_processing_id');
        }
    }, [processingAuditId]);

    useEffect(() => {
        if (processingFileName) {
            localStorage.setItem('geomec_bulk_auditor_processing_file', processingFileName);
        } else {
            localStorage.removeItem('geomec_bulk_auditor_processing_file');
        }
    }, [processingFileName]);

    // Cuando ya no hay procesamiento activo, limpiar el nombre del archivo
    useEffect(() => {
        if (!processingAuditId) setProcessingFileName('');
    }, [processingAuditId]);

    useEffect(() => {
        fetchHistory();
    }, []);

    // Al montar con un dashboard persistido (recarga / reapertura del navegador):
    // verificar contra el backend que la auditoría sigue existiendo. Si la data se
    // perdió (p.ej. el servidor se reinició), se muestra un error claro — nunca una
    // pantalla en blanco.
    useEffect(() => {
        // Estados obsoletos de localStorage (sesiones previas): 'uploading' no puede
        // sobrevivir a una recarga (no hay subida en vuelo), y 'processing' sin
        // processingAuditId no tiene poller → volver al inicio en lugar de cargar infinito.
        if (status === 'uploading' || (status === 'processing' && !processingAuditId)) {
            setStatus('idle');
            return;
        }
        if (status === 'loaded' && selectedAuditId) {
            verifyAuditExists(selectedAuditId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Poller único de estado: corre solo mientras haya una auditoría procesando.
    // El primer poll decide la verdad: si el backend ya no procesa (o murió), sale del estado de carga.
    useEffect(() => {
        if (processingAuditId) {
            startStatusPolling(processingAuditId);
        } else {
            stopStatusPolling();
        }
    }, [processingAuditId]);

    // Al desmontar (cambiar de vista en la app) detener el poller: el estado se
    // conserva en localStorage y la verificación al volver decide si continúa.
    useEffect(() => () => { stopStatusPolling(); }, []);

    // KPIs: el backend solo los afecta por auditoría y años seleccionados — los demás
    // filtros NO cambian el compact, así que no debe re-descargarse (~1.1 MB por interacción ahorrado).
    useEffect(() => {
        if (status === 'loaded' && selectedAuditId && auditVerified) {
            fetchKpis(selectedAuditId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, selectedAuditId, selectedYears, auditVerified]);

    // Incidencias paginadas: el filtrado es server-side, dependen de todos los filtros.
    useEffect(() => {
        if (status === 'loaded' && selectedAuditId && auditVerified) {
            fetchPaginatedIncidencias(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, selectedAuditId, selectedYears, filterTipo, filterCelda, filterCampania, filterGeotecnico, filterSearch, auditVerified]);

    // --- POLLER ÚNICO DE ESTADO (GET /status) ---
    // Mientras procesa: respuestas de ~200 bytes. El resumen completo (1.1 MB) solo se
    // descarga cuando el backend reporta "listo".
    const MAX_CONSECUTIVE_FAILURES = 4;
    const POLL_INTERVAL_MS = 5000;

    const startStatusPolling = (auditId: string) => {
        stopStatusPolling();
        let fails = 0;

        const tick = async () => {
            try {
                const res = await fetch(`${apiBase}/api/geomecanica/status?audit_id=${auditId}`);
                if (res.status === 404) {
                    failAudit('not_found', 'La auditoría ya no existe en el servidor (probablemente se reinició o se perdieron los archivos). Vuelve a cargar tu planilla.', auditId);
                    return;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const data = await res.json();
                fails = 0;

                if (data.status === 'procesando') return; // sigue polleando

                if (data.status === 'error') {
                    failAudit('processing', data.detail || 'El procesamiento falló en el servidor.', auditId);
                    return;
                }

                // "listo": el compact ya existe → mostrar el dashboard de inmediato.
                // El .xlsx del paso 5 puede tardar unos segundos más (o morir si el
                // servidor cae): NO bloqueamos la vista por eso, solo seguimos
                // polleando liviano hasta que reporte_listo habilite la descarga.
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
                // Solo saltar al dashboard si esta auditoría es la que se está viendo;
                // si quedó en segundo plano (banner), no se cambia la vista actual.
                if (selectedAuditIdRef.current === auditId) {
                    setStatus('loaded');
                }
                setShowProgressToast(`Auditoría finalizada. La planilla "${data.nombre_archivo || 'importada'}" se encuentra procesada.`);
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

    // Maneja cualquier fallo del poller/verificación según el tipo:
    // - 'network': el servidor no responde (se conserva processingAuditId para reintentar)
    // - 'not_found': los archivos de la auditoría ya no existen en el backend
    // - 'processing': el pipeline persistió un error en el compact
    const failAudit = (kind: 'network' | 'not_found' | 'processing', msg: string, auditId: string) => {
        stopStatusPolling();
        setErrorKind(kind);
        setMessage(msg);
        setAuditVerified(false);

        // Si la auditoría que falló no es la que el usuario está viendo (proceso en
        // segundo plano), no rompemos la vista actual: solo lo notificamos con un toast.
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

    // Verificación única (montaje / selección de auditoría previa / reintento):
    // confirma que la data del reporte sigue existiendo antes de renderizar el dashboard.
    const verifyAuditExists = async (auditId: string) => {
        try {
            const res = await fetch(`${apiBase}/api/geomecanica/status?audit_id=${auditId}`);
            if (res.status === 404) {
                failAudit('not_found', 'La auditoría ya no existe en el servidor (probablemente se reinició o se perdieron los archivos).', auditId);
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
            // Restaurar 'loaded' antes de verificar: si la verificación tiene éxito,
            // los efectos de carga del dashboard deben poder dispararse.
            setStatus('loaded');
            verifyAuditExists(selectedAuditId);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${apiBase}/api/geomecanica/auditorias`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (e) {
            console.error("Fallo de red cargando auditorías previas:", e);
        }
    };

    const fetchKpis = async (auditId: string) => {
        try {
            const yearParam = selectedYears.length > 0 ? selectedYears.join(",") : "TODOS";
            const res = await fetch(`${apiBase}/api/geomecanica/resumen-ligero?audit_id=${auditId}&years=${yearParam}`);
            if (res.ok) {
                const data = await res.json();
                setKpis(data);
            } else if (res.status === 404) {
                failAudit('not_found', 'La auditoría ya no existe en el servidor (probablemente se reinició o se perdieron los archivos).', auditId);
            } else if (res.status === 400) {
                const data = await res.json().catch(() => null);
                failAudit('processing', data?.detail || 'El procesamiento falló en el servidor.', auditId);
            }
        } catch (e) {
            failAudit('network', 'No se pudo contactar al servidor. Verifica tu conexión o el estado del servicio.', auditId);
        }
    };

    const fetchPaginatedIncidencias = async (currentPage: number) => {
        setLoadingTable(true);
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('page', String(currentPage));
            queryParams.append('limit', '50');
            if (selectedAuditId) queryParams.append('audit_id', selectedAuditId);
            if (filterTipo) queryParams.append('tipo', filterTipo);
            if (filterCelda) queryParams.append('celda', filterCelda);

            if (selectedYears.length > 0) {
                queryParams.append('campania', selectedYears.join(","));
            } else if (filterCampania) {
                queryParams.append('campania', filterCampania);
            }

            if (filterGeotecnico) queryParams.append('geotecnico', filterGeotecnico);
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
            console.error("Fallo obteniendo las incidencias paginadas:", e);
        } finally {
            setLoadingTable(false);
        }
    };

    const handleWizardConfirm = async (payload: any) => {
        setIsWizardOpen(false);
        setStatus('processing');
        setErrorKind(null);
        setMessage('Ejecutando cálculos de celdas y auditoría geomecánica masiva...');

        const formData = new FormData();
        formData.append('file', payload.file);

        try {
            const res = await fetch(`${apiBase}/api/geomecanica/importar-excel-bulk`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                setSelectedAuditId(data.audit_id);
                setProcessingAuditId(data.audit_id);
                setProcessingFileName(data.filename || payload.file.name);
            } else {
                const err = await res.json();
                setStatus('error');
                setMessage(err.detail || 'Fallo de procesamiento en el servidor.');
            }
        } catch (e) {
            setStatus('error');
            setMessage('Error de red al intentar conectar con el servidor.');
        }
    };

    // Cierra la vista actual (dashboard/error) y vuelve al inicio, pero CONSERVA
    // processingAuditId: si hay una auditoría procesando en segundo plano, el banner
    // de progreso sigue visible desde la vista de inicio y el poller continúa
    // (por eso NO se detiene aquí: se detiene solo cuando processingAuditId se limpia).
    const handleCloseView = () => {
        setStatus('idle');
        setSelectedAuditId('');
        setKpis(null);
        setIncidencias([]);
        setMessage('');
        setExcelReady(false);
        setErrorKind(null);
        setAuditVerified(false);

        localStorage.removeItem('geomec_bulk_auditor_status');
        localStorage.removeItem('geomec_bulk_auditor_message');
        localStorage.removeItem('geomec_bulk_auditor_audit_id');
        localStorage.removeItem('geomec_bulk_auditor_error_kind');
    };

    // Cancela de verdad la auditoría en curso: avisa al backend (flag de cancelación)
    // y limpia TODO el estado, incluido el procesamiento en segundo plano.
    const handleCancelProcessing = async () => {
        const target = processingAuditId;
        if (target && !window.confirm('¿Cancelar la auditoría en curso? Se detendrá el procesamiento en el servidor y se eliminarán sus archivos parciales.')) return;
        try {
            if (target) {
                await fetch(`${apiBase}/api/geomecanica/cancelar?audit_id=${target}`, { method: 'POST' });
            }
        } catch (e) {
            console.warn("No se pudo notificar la cancelación al servidor:", e);
        }
        handleCloseView();
        setProcessingAuditId('');
        setProcessingFileName('');
        localStorage.removeItem('geomec_bulk_auditor_processing_id');
        localStorage.removeItem('geomec_bulk_auditor_processing_file');
        if (target) setShowProgressToast('Auditoría cancelada.');
    };

    const clearAllFilters = () => {
        setFilterTipo('');
        setFilterCelda('');
        setFilterCampania('');
        setFilterGeotecnico('');
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

    const handleExportExcel = () => {
        if (!excelReady || !selectedAuditId) return;
        window.open(`${apiBase}/api/geomecanica/reporte-excel?audit_id=${selectedAuditId}`, '_blank');
    };

    const numCeldasPadre = kpis?.familia1?.num_celdas_padre || 0;
    const totalDiscontinuidades = kpis?.familia1?.total_discontinuidades || 0;
    const totalMetrosMapped = kpis?.familia1?.total_metros || 0;

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

    const periodLabel = selectedYears.length > 0
        ? `Campañas: ${selectedYears.join(', ')}`
        : 'Todas las campañas registradas';

    return (
        <div className="space-y-6 text-left animate-fade-in text-slate-200 p-4">

            <BulkImportWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onConfirm={handleWizardConfirm}
            />

            <ComparativoModal
                isOpen={isCompareOpen}
                onClose={() => setIsCompareOpen(false)}
                history={history}
                apiBase={apiBase}
            />

            {status !== 'uploading' && (
                <AuditHistory
                    history={history}
                    selectedAuditId={selectedAuditId}
                    onSelectAudit={handleSelectPastAudit}
                    onOpenCompare={() => setIsCompareOpen(true)}
                />
            )}

            {showProgressToast && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-400 font-semibold animate-fade-in">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-400" />
                        <span>{showProgressToast}</span>
                    </div>
                    <button onClick={() => setShowProgressToast('')} className="text-slate-450 hover:text-slate-200">
                        <X size={14} />
                    </button>
                </div>
            )}

            {processingAuditId && (status === 'loaded' || status === 'idle') && (
                <div className="bg-cyan-950/40 border border-cyan-500/20 rounded-xl p-3.5 flex items-center justify-between text-xs text-cyan-400 font-semibold shadow-md animate-fade-in">
                    <div className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-cyan-400" />
                        <span>Generando otra revisión en segundo plano{processingFileName ? `: ${processingFileName}` : ''}...</span>
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
                            className="bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1 rounded text-xs font-bold hover:bg-red-500/20 transition-all"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {status !== 'loaded' && !selectedAuditId && status !== 'uploading' && status !== 'processing' && status !== 'error' && (
                <div className="rounded-2xl border border-cyan-500/15 p-10 space-y-8 max-w-xl mx-auto bg-gradient-to-b from-[#0e172a]/60 to-[#090f1d]/90 shadow-2xl mt-12 relative overflow-hidden backdrop-blur-md">
                    <div className="text-center space-y-3 relative z-10">
                        <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full w-14 h-14 flex items-center justify-center mx-auto shadow-md">
                            <Database size={24} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Nueva Auditoría Geomecánica</h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed font-semibold">
                                Sube una planilla de mapeo de celdas para realizar validaciones cruzadas RMR y control de calidad estructural.
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
                                Iniciar Asistente de Carga
                            </span>
                            <span className="text-xs text-slate-500 block mt-1 font-bold">
                                Carga un libro Excel (.xlsx) de celdas de mapeo o BD consolidada.
                            </span>
                        </div>
                    </button>
                </div>
            )}

            {status === 'error' && (
                <div className="rounded-2xl border border-red-500/25 p-8 max-w-xl mx-auto bg-[#170d12]/90 shadow-2xl mt-12 relative overflow-hidden backdrop-blur-md">
                    <div className="text-center space-y-4">
                        <div className={`p-3 rounded-full w-14 h-14 flex items-center justify-center mx-auto shadow-md ${errorKind === 'network' ? 'bg-amber-500/10 border border-amber-500/25 text-amber-400' : 'bg-red-500/10 border border-red-500/25 text-red-400'}`}>
                            {errorKind === 'network' ? <WifiOff size={24} /> : <AlertTriangle size={24} />}
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">
                                {errorKind === 'network' ? 'Conexión con el servidor perdida'
                                    : errorKind === 'not_found' ? 'Auditoría no encontrada'
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

            {(status === 'uploading' || status === 'processing') && (
                <div className="rounded-2xl border border-cyan-500/15 text-center space-y-6 max-w-lg mx-auto bg-[#090f1d]/90 p-10 shadow-2xl mt-12 animate-fade-in">
                    <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-cyan-400 border-r-cyan-400 rounded-full animate-spin"></div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center justify-center gap-1.5">
                            <RefreshCw size={14} className="animate-spin" />
                            <span>{status === 'uploading' ? 'Transmitiendo datos...' : (processingFileName ? `Procesando: ${processingFileName}` : 'Procesando Reglas de Consistencia')}</span>
                        </p>
                        <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                            Calculando RQD polinómico, espaciamiento R76/R89, saturando variables de rugosidad, forma y JRC, y cruzando correlaciones litológicas.
                        </p>
                    </div>
                    <div className="pt-2">
                        <button
                            onClick={handleCancelProcessing}
                            className="w-full flex items-center justify-center gap-2 bg-red-500/15 hover:bg-red-650 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-lg text-xs font-black transition-all active:scale-95"
                        >
                            <Trash2 size={14} />
                            <span>Cancelar Proceso</span>
                        </button>
                    </div>
                </div>
            )}

            {(status === 'loaded' || selectedAuditId) && kpis && status !== 'uploading' && status !== 'processing' && status !== 'error' && (
                <div className="space-y-6 animate-fade-in">

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#090f1d]/60 p-4 border border-cyan-500/10 rounded-xl gap-4 shadow-md backdrop-blur-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg">
                                    <ShieldCheck size={18} />
                                </div>
                                <div>
                                    <h1 className="text-xs font-black uppercase tracking-widest">Auditoría Geotécnica de Integridad</h1>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Planilla Activa: <span className="font-bold text-slate-100">{kpis?.nombre_archivo || 'Por Defecto'}</span>
                                    </p>
                                </div>
                            </div>

                            {kpis.distribucion_campania && kpis.distribucion_campania.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 border border-navy-900 rounded-xl p-1">
                                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest px-2">Campañas:</span>
                                    <button
                                        onClick={() => setSelectedYears([])}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${selectedYears.length === 0 ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-navy-900/60 text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Todas
                                    </button>
                                    {uniqueYears.map(yr => {
                                        const isSelected = selectedYears.includes(yr);
                                        return (
                                            <button
                                                key={yr}
                                                onClick={() => {
                                                    setSelectedYears(prev => prev.includes(yr) ? prev.filter(y => y !== yr) : [...prev, yr]);
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${isSelected ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-navy-900/60 text-slate-400 hover:text-slate-200'}`}
                                            >
                                                {yr}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

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
                                className={`flex items-center gap-1.5 border px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md active:scale-95 ${excelReady
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

                    <KpiMetrics
                        kpis={kpis}
                        numCeldasPadre={numCeldasPadre}
                        totalDiscontinuidades={totalDiscontinuidades}
                        totalMetrosMapped={totalMetrosMapped}
                        periodLabel={periodLabel}
                        filterTipo={filterTipo}
                        onFilterTipo={(tipo) => setFilterTipo(prev => prev === tipo ? '' : tipo)}
                    />

                    <ConsolidatedDeviations
                        kpis={kpis}
                        uniqueYears={uniqueYears}
                        coreObservationTypes={coreObservationTypes}
                        selectedObservation={selectedObservation}
                        setSelectedObservation={setSelectedObservation}
                        isConsolidatedExpanded={isConsolidatedExpanded}
                        setIsConsolidatedExpanded={setIsConsolidatedExpanded}
                    />

                    <DistributionBreakdown
                        kpis={kpis}
                        filterCampania={filterCampania}
                        onFilterCampania={(camp) => setFilterCampania(prev => prev === camp ? '' : camp)}
                        filterCelda={filterCelda}
                        onFilterCelda={(celda) => setFilterCelda(prev => prev === celda ? '' : celda)}
                        filterGeotecnico={filterGeotecnico}
                        onFilterGeotecnico={(geo) => setFilterGeotecnico(prev => prev === geo ? '' : geo)}
                    />

                    <AnomaliesViewer
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