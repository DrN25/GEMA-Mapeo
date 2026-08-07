import { useState, useEffect, useRef, useMemo } from 'react';
import { Save, ArrowLeft, BarChart3, Layers, Gauge, BookOpen, X, Calculator, Menu, FileSpreadsheet, Activity, RotateCcw, Loader2 } from 'lucide-react';

import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import type { WindowSummary } from './components/Dashboard/Dashboard';
import VentanaForm from './components/views/VentanaForm';
import DisconTable from './components/views/DisconTable';
import RmrAnalysis from './components/views/RmrAnalysis';
import StructurePlot from './components/views/StructurePlot';
import ValidationPanel from './components/Common/ValidationPanel';
import ExcelImportModal, { type ImportedCellItem } from './components/modals/ExcelImportModal';

import CatalogsView from './components/views/CatalogsView';
import CommentsPhotos from './components/views/CommentsPhotos';
import PltEnsayosView from './components/views/PltEnsayosView';

import SaveConfirmModal from './components/modals/SaveConfirmModal';
import DiscardModal from './components/modals/DiscardModal';
import SaveResultModal from './components/modals/SaveResultModal';
import RenameCellModal from './components/modals/RenameCellModal';

import { fastHashObject, canonicalEqual } from './utils/hashUtils';
import { apiFetch, pingBackend } from './utils/apiClient';
import { evictSincronizadas, safeSetItem, addPendingCell, removePendingCell, getCachedCellRaw, canImport, addPendingPltCell, removePendingPltCell, getPendingPltCells, savePltDelta, getPltDelta, clearPltDelta } from './utils/storageManager';
import {
  discardLocalCell,
  getAllKnownCellNames,
  getInvalidPendingCells,
  getLocalOnlyPendingCells,
  getLocalOnlyPendingSummaries,
  getPendingCellNames,
  getPendingCellSummaries,
  hasCellValidation,
  isCellPending,
  setCellValidation,
  clearCellValidation,
  verifyNameCollisions,
} from './utils/cellRegistry';
import {
  computeWindowDiff,
  computeAllWindowsDiff,
  type WindowData,
  type WindowDiffResult,
  type AllWindowsDiffSummary
} from './utils/diffUtils';

// --- MIGRACIÓN AL NUEVO BULK AUDITOR MODULAR ---
import BulkAuditor from './features/auditor/BulkAuditor';
import CongruenceAuditor from './features/auditor/CongruenceAuditor';
import { initCatalogs } from './utils/catalogData';

import {
  calculateWindowGeomec,
  suggestGsiVisual,
  GSI_VISUAL_AUTO,
  type WindowHeader,
  type JointRow,
  type CalculatorResult
} from './utils/rmrCalculator';

import { validateWindowQAQC } from './utils/qaqcValidator';
import type { QaQcAlert } from './utils/qaQcRules';
import { buildCampaniaYearMap } from './utils/qaQcRules';
import { resetTouchedFields, subscribeTouched } from './utils/qaQcTouch';
import { validateMapeoWindow, validatePltEnsayosList, toVacioAlerts, isBlockingValidationAlert, type MissingFieldIssue } from './utils/mandatoryRules';
import { arePltRowsEqual, applyPltFormulas } from './utils/geomecColumns';

const API_BASE = import.meta.env.VITE_API_BASE || "";
const RESOLVED_API_BASE = API_BASE || `${window.location.protocol}//${window.location.hostname}:8001`;

import { normalizeJoints, windowFromServerResponse, excelDataToWindowData, applyDistanceCascade } from './utils/windowTransform';
import { HOLE_AUTO } from './utils/rmrCalculator';
export default function App() {
  // Inicializar vista y paginación desde localStorage de forma síncrona para resiliencia ante F5
  const [currentView, setCurrentView] = useState<string>(() => {
    try {
      const savedView = localStorage.getItem('geolog_window_current_view');
      if (savedView) return savedView;
    } catch (e) { }
    return 'dashboard';
  });

  const [windows, setWindows] = useState<WindowSummary[]>([]);

  // Inicialización síncrona desde localStorage para resiliencia ante recargas (F5)
  const [activeWindow, setActiveWindow] = useState<WindowData | null>(() => {
    try {
      const activeCelda = localStorage.getItem('geolog_active_window_celda');
      if (activeCelda) {
        const cached = localStorage.getItem(`geolog_window_${activeCelda}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Mismo criterio que windowFromServerResponse/loadCachedLocal: normalizar
          // con el intemperismo del header para que el hash coincida con el snapshot.
          parsed.joints = normalizeJoints(parsed.joints || [], parsed.header?.intemperia);
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Error al restaurar celda activa desde localStorage:", e);
    }
    return null;
  });

  const [dbSnapshotData, setDbSnapshotData] = useState<WindowData | null>(() => {
    try {
      const activeCelda = localStorage.getItem('geolog_active_window_celda');
      if (activeCelda) {
        const cached = localStorage.getItem(`geolog_window_snapshot_${activeCelda}`);
        if (cached) return JSON.parse(cached);
      }
    } catch (e) { }
    return null;
  });

  const [dbSnapshotHash, setDbSnapshotHash] = useState<string | null>(() => {
    try {
      const activeCelda = localStorage.getItem('geolog_active_window_celda');
      if (activeCelda) {
        return localStorage.getItem(`geolog_window_snapshot_hash_${activeCelda}`);
      }
    } catch (e) { }
    return null;
  });

  const [pltEnsayos, setPltEnsayos] = useState<any[]>([]);
  const pltSnapshotRef = useRef<any[]>([]);
  const [showFormulas, setShowFormulas] = useState<boolean>(true);

  // Estados de Modales y Bloqueo Transaccional
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState<boolean>(false);
  const [showDiscardModal, setShowDiscardModal] = useState<boolean>(false);
  const [showSaveResultModal, setShowSaveResultModal] = useState<boolean>(false);
  const [isLoadingWindow, setIsLoadingWindow] = useState<boolean>(false);
  const [saveResultData, setSaveResultData] = useState<{ savedCount: number; totalEdits: number; totalJoints: number }>({
    savedCount: 0,
    totalEdits: 0,
    totalJoints: 0
  });

  // Paginación y filtros del Dashboard con inicialización desde localStorage
  const [loading, setLoading] = useState<boolean>(false);
  const [kpis, setKpis] = useState<any>(null);
  const [page, setPage] = useState<number>(() => {
    try {
      const savedPage = localStorage.getItem('geolog_window_dashboard_page');
      if (savedPage) {
        const parsed = parseInt(savedPage, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch (e) { }
    return 1;
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const savedSize = localStorage.getItem('geolog_window_dashboard_pagesize');
      if (savedSize) {
        const parsed = parseInt(savedSize, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch (e) { }
    return 20;
  });

  // Persistir currentView en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('geolog_window_current_view', currentView);
    } catch (e) { }
  }, [currentView]);

  // Persistir paginación en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('geolog_window_dashboard_page', String(page));
    } catch (e) { }
  }, [page]);

  useEffect(() => {
    try {
      localStorage.setItem('geolog_window_dashboard_pagesize', String(pageSize));
    } catch (e) { }
  }, [pageSize]);

  // Si la vista requiere celda activa pero no hay ninguna seleccionada, redirigir a dashboard
  useEffect(() => {
    if (!activeWindow && (currentView === 'mapeo' || currentView === 'grafico' || currentView === 'plt_ensayos')) {
      setCurrentView('dashboard');
    }
  }, [activeWindow, currentView]);
  const [totalFiltered, setTotalFiltered] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeDateRange, setActiveDateRange] = useState<string>('todo');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isGlobalSearch, setIsGlobalSearch] = useState<boolean>(false);
  const [advancedFilters, setAdvancedFilters] = useState<{
    celda: string;
    sector: string;
    rmr76: string;
    rmr89: string;
    rqd76: string;
    rqd89: string;
    gsi: string;
  }>({
    celda: '',
    sector: '',
    rmr76: '',
    rmr89: '',
    rqd76: '',
    rqd89: '',
    gsi: '',
  });
  const [pendingImports, setPendingImports] = useState<string[]>([]);

  // Quita una celda de la marca "recién importada" (al guardarla, descartarla
  // o eliminarla). Evita badges IMPORTADO fantasma sobre celdas ya procesadas.
  const clearPendingImport = (celda: string) => {
    setPendingImports(prev => (prev.includes(celda) ? prev.filter(c => c !== celda) : prev));
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // UI & Theme
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  // Backend Sync Status
const [syncStatus, setSyncStatus] = useState<'synced' | 'unsaved' | 'saving' | 'offline'>('synced');
const [syncMessage, setSyncMessage] = useState<string>('Conectado al servidor de base de datos SQL Server.');
// Indicador de conexión: SOLO refleja si la BD responde (verde/rojo).
// Independiente del estado de cambios pendientes (syncStatus).
const [dbOnline, setDbOnline] = useState(true);

  // Boot resiliente: reintentos automáticos mientras el backend despierta (cold start)
  const [bootAttempt, setBootAttempt] = useState<number>(0);
  const [bootFailed, setBootFailed] = useState<boolean>(false);
  const bootLoaderRef = useRef<() => void>(() => {});

  // Real-time calculated results & alerts
  const [calculated, setCalculated] = useState<CalculatorResult | null>(null);
  const [alerts, setAlerts] = useState<QaQcAlert[]>([]);
  const [catalogsLoaded, setCatalogsLoaded] = useState<boolean>(false);

  // Photos & Captions states
  const [photos, setPhotos] = useState<string[]>(['', '', '', '']);
  const [captions, setCaptions] = useState<string[]>(['', '', '', '']);

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState<boolean>(false);
  const [isPltCatalogModalOpen, setIsPltCatalogModalOpen] = useState<boolean>(false);
  const [isCommentsExpanded, setIsCommentsExpanded] = useState<boolean>(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);

  // 1. Initialize Dark Mode Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Evitar de forma global que el scroll del mouse modifique los valores de inputs numéricos y desplegables
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const isInputNumber = activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'number';
        const isSelect = activeEl.tagName === 'SELECT';

        if (isInputNumber || isSelect) {
          (activeEl as HTMLElement).blur();
        }
      }
    };

    document.addEventListener('wheel', handleGlobalWheel, { passive: true });
    return () => {
      document.removeEventListener('wheel', handleGlobalWheel);
    };
  }, []);

  // 2. Fetch catalogs first, then summaries and PLT trials on mount
  // Boot resiliente: si el backend está dormido (Render free) el primer intento
  // dispara el cold start (~1 min). apiFetch reintenta con backoff internamente;
  // si aún así falla, se muestra error con botón Reintentar y se sigue intentando
  // en segundo plano cada 10s hasta que el servidor responda (sin recargar la página).
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/api/catalogs/all`, { retries: 4, timeoutMs: 60000 });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        initCatalogs(data);
        setCatalogsLoaded(true);
        setDbOnline(true);
        setBootAttempt(0);
        setBootFailed(false);
        // No pisar 'unsaved' si hay cambios pendientes (ventana o PLT): el
        // estado de sincronización lo gestiona el efecto reactivo.
        if (!hasPendingRef.current) {
          setSyncStatus('synced');
          setSyncMessage('Conectado al servidor de base de datos SQL Server.');
        }
        fetchWindows();
      } catch (err) {
        console.error("Error loading geomechanical catalogs:", err);
        setBootAttempt(a => a + 1);
        setSyncStatus('offline');
        setDbOnline(false);
        setSyncMessage('No se pudo conectar con el servidor. Puede estar despertando o fuera de línea.');
        setBootFailed(true);
        // Reintento automático en segundo plano: el servidor puede tardar en despertar
        setTimeout(() => {
          if (!catalogsLoadedRef.current) bootLoaderRef.current();
        }, 10_000);
      }
    };
    bootLoaderRef.current = loadCatalogs;
    loadCatalogs();
  }, []);

  // Heartbeat + detección de visibilidad:
  // - Pestaña visible: ping cada 5 min (Render free duerme a los 15 min de inactividad)
  //   -> el backend nunca duerme mientras la app está abierta.
  // - Volver a la pestaña (visibilitychange): ping inmediato que despierta el backend
  //   y actualiza el indicador de conexión (banner de reconexión).
  // - Pestaña oculta: se detienen los pings (no se queman horas de instancia gratis).
  const catalogsLoadedRef = useRef(false);
  useEffect(() => {
    catalogsLoadedRef.current = catalogsLoaded;
  }, [catalogsLoaded]);

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;

    const heartbeat = async () => {
      if (disposed) return;
      const ok = await pingBackend(API_BASE);
      if (!disposed) setDbOnline(ok);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        heartbeat();
        if (!timer) timer = window.setInterval(heartbeat, 5 * 60 * 1000);
      } else if (timer) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer) window.clearInterval(timer);
    };
  }, []);

  // 3. Auditoría reactiva de diferencias y rastreo de celda activa
  const workspaceDiff = computeAllWindowsDiff(activeWindow, dbSnapshotData);

  // 3b. Auditoría reactiva de cambios en Ensayos PLT
  const pltDiffSummary = useMemo(() => {
    const snap = pltSnapshotRef.current;
    const curr = pltEnsayos;
    const snapIds = new Set(snap.map((r: any) => r.id));
    const currIds = new Set(curr.map((r: any) => r.id));

    let added = 0;
    let deleted = 0;
    let modified = 0;

    for (const row of curr) {
      if (!snapIds.has(row.id)) {
        added++;
      } else {
        const snapRow = snap.find((s: any) => s.id === row.id);
        if (snapRow && !arePltRowsEqual(row, snapRow)) {
          modified++;
        }
      }
    }
    for (const row of snap) {
      if (!currIds.has(row.id)) {
        deleted++;
      }
    }
    const totalChanges = added + modified + deleted;
    return { added, modified, deleted, totalChanges, totalRows: curr.length };
  }, [pltEnsayos]);

  const unsavedCount = workspaceDiff.totalWindowsWithChanges;

  // Resúmenes de los borradores locales para el Dashboard (se recalcula con el diff).
  // Solo los que NO existen en BD: los pendientes que ya existen en BD (p.ej. importados
  // con nombre duplicado) se muestran sobre su fila normal, no como fila BORRADOR aparte.
  const pendingCellSummaries = useMemo(
    () => getLocalOnlyPendingSummaries(windows.map(w => w.name)),
    [workspaceDiff, pendingImports, windows]
  );

  // Nombres de TODAS las celdas pendientes: marcar con badge "PENDIENTE" su fila normal.
  const pendingCellNames = useMemo(
    () => getPendingCellNames(),
    [workspaceDiff, pendingImports]
  );

  // Celdas que existen en el sistema (BD + borradores locales) — SSOT para el
  // modal de import PLT (validación de destinos y estado de cada celda del Excel).
  // Se obtiene con un fetch DEDICADO de todas las celdas (independiente del
  // filtro/búsqueda actual del dashboard, que limitaría la lista).
  const [allCellNames, setAllCellNames] = useState<string[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/ventanas/celdas`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (Array.isArray(data)) {
          setAllCellNames(data);
        }
      })
      .catch(() => { /* sin backend: solo borradores locales */ });
  }, []);

  const knownCells = useMemo(
    () => [...new Set([...allCellNames, ...pendingCellNames])],
    [allCellNames, pendingCellNames]
  );

  useEffect(() => {
    if (!activeWindow) return;
    const celda = activeWindow.header.celda;
    const ctx = { activeCelda: celda, pendingImports };
    safeSetItem('geolog_active_window_celda', celda, ctx);
    safeSetItem(`geolog_window_${celda}`, JSON.stringify(activeWindow), ctx);

    const activeHash = fastHashObject(activeWindow);
    const savedHash = dbSnapshotHash || localStorage.getItem(`geolog_window_snapshot_hash_${celda}`);

    if (activeHash !== savedHash) {
      addPendingCell(celda);
    } else {
      removePendingCell(celda);
    }
  }, [activeWindow, dbSnapshotHash, pendingImports]);

  useEffect(() => {
    const targetCelda = activeWindow?.header?.celda?.trim()?.toUpperCase();
    if (targetCelda && loadedPltCeldaRef.current !== targetCelda) {
      fetchPltEnsayos(targetCelda, true);
    }
  }, [activeWindow?.header?.celda]);

  // Actualización reactiva del estado de sincronización (amarillo / verde)
  // hasPendingRef: espejo SIEMPRE actual del estado pendiente (ventana + PLT),
  // para que los async (fetchWindows/catálogos) no lean valores STALE de un
  // closure anterior al decidir si pisan 'unsaved' (regla: inputs frescos).
  const hasPendingRef = useRef(false);
  useEffect(() => {
    const hasWindowChanges = workspaceDiff.totalWindowsWithChanges > 0;
    const hasPltChanges = pltDiffSummary.totalChanges > 0;
    hasPendingRef.current = hasWindowChanges || hasPltChanges;
    if (hasWindowChanges || hasPltChanges) {
      setSyncStatus('unsaved');
      setSyncMessage('Cambios pendientes por sincronizar en SQL Server.');
    } else {
      setSyncStatus('synced');
      setSyncMessage('SQL Server Conectado. Todos los datos están sincronizados.');
    }
  }, [workspaceDiff.totalWindowsWithChanges, pltDiffSummary.totalChanges]);

  // Re-render de validaciones cuando se marca un campo como "tocado" (blur)
  const [touchedTick, setTouchedTick] = useState(0);
  useEffect(() => {
    return subscribeTouched(() => setTouchedTick(t => t + 1));
  }, []);

  // Keep RMR calculations and QA/QC validation updated in real-time
  useEffect(() => {
    if (!catalogsLoaded) {
      setAlerts([]);
      return;
    }
    if (activeWindow) {
      const res = calculateWindowGeomec(activeWindow.header, activeWindow.joints);
      setCalculated(res);
      const errs = validateWindowQAQC(activeWindow.header, activeWindow.joints, res.largo, buildCampaniaYearMap(), true);
      const vacios = toVacioAlerts(validateMapeoWindow(activeWindow));
      const pltVacios = toVacioAlerts(validatePltEnsayosList(pltEnsayos));
      const allAlerts = [...errs, ...vacios, ...pltVacios];
      setAlerts(allAlerts);
      // Estado persistido de validación de la celda activa (lo consume el bloqueo del guardado).
      // Solo persisten CRITICAS y VACIOS: las ADVERTENCIAS se muestran en el panel QA/QC
      // pero NO deben impedir guardar en la base de datos.
      const blockingAlerts = allAlerts.filter(a => isBlockingValidationAlert(a.type));
      setCellValidation(activeWindow.header.celda, blockingAlerts.map(a => a.message || JSON.stringify(a)));
    } else {
      const pltVacios = toVacioAlerts(validatePltEnsayosList(pltEnsayos));
      setCalculated(null);
      setAlerts([...pltVacios]);
    }
  }, [activeWindow, touchedTick, catalogsLoaded, pltEnsayos]);

  // Resetear el registro de campos "tocados" al cambiar de ventana activa
  useEffect(() => {
    resetTouchedFields();
  }, [activeWindow?.header?.celda]);

  // Reevaluación en cascada de distancias (m) al largo máximo de la celda.
  // La misma política se aplica al snapshot/baseline en handleSelectWindow,
  // para que caché y snapshot nunca diverjan por este ajuste automático.
  // IMPORTANTE: el largo se computa FRESCO desde la ventana activa. Usar
  // `calculated?.largo` aquí era un bug: al cambiar de celda, el efecto corría
  // con el largo de la celda ANTERIOR (stale) y clampeaba distancias que el
  // baseline (clampeado con el largo correcto) no tocó → la celda quedaba
  // pendiente con "cambios de discontinuidad" fantasma e intermitente.
  useEffect(() => {
    if (!activeWindow) return;

    const computedLargo = calculateWindowGeomec(activeWindow.header, activeWindow.joints).largo;
    const adjustedJoints = applyDistanceCascade(activeWindow.header, activeWindow.joints, computedLargo);
    if (adjustedJoints !== activeWindow.joints) {
      setActiveWindow(prev => prev ? { ...prev, joints: adjustedJoints } : null);
    }
  }, [activeWindow?.header]);

  // Synchronize photo loading from localStorage when the active window celda changes
  useEffect(() => {
    if (activeWindow?.header.celda) {
      fetch(`${API_BASE}/api/ventanas/${activeWindow.header.celda}/fotos`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then(data => {
          const resolvedPhotos = (data.photos || ['', '', '', '']).map((p: string) =>
            p ? (p.startsWith('http') || p.startsWith('data:') ? p : `${API_BASE}${p}`) : ''
          );
          setPhotos(resolvedPhotos);
          setCaptions(data.captions || ['', '', '', '']);
        })
        .catch(() => {
          setPhotos(['', '', '', '']);
          setCaptions(['', '', '', '']);
        });
    } else {
      setPhotos(['', '', '', '']);
      setCaptions(['', '', '', '']);
    }
  }, [activeWindow?.header.celda]);

  const handlePhotosChange = (newPhotos: string[], newCaptions: string[]) => {
    setPhotos(newPhotos);
    setCaptions(newCaptions);
  };

  const handleExportExcel = () => {
    if (!activeWindow) return;
    const celda = activeWindow.header.celda;
    window.location.href = `${API_BASE}/api/ventanas/${celda}/exportar`;
  };

  const fetchWindows = async (p?: number, ps?: number, dr?: string, searchTerm?: string, isGlobalSearch?: boolean, advFilters?: typeof advancedFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p || page),
        page_size: String(ps || pageSize),
        order_by: 'fecha_mapeo',
        order_dir: 'desc',
      });

      if (isGlobalSearch !== undefined) {
        params.set('search_global', String(isGlobalSearch));
      }

      const af = advFilters || advancedFilters;
      if (af.celda.trim()) params.set('q', af.celda.trim());
      if (af.sector.trim()) params.set('sector', af.sector.trim());
      if (af.rmr76 !== '') params.set('rmr76', String(Number(af.rmr76)));
      if (af.rmr89 !== '') params.set('rmr89', String(Number(af.rmr89)));
      if (af.rqd76 !== '') params.set('rqd76', String(Number(af.rqd76)));
      if (af.rqd89 !== '') params.set('rqd89', String(Number(af.rqd89)));
      if (af.gsi !== '') params.set('gsi', String(Number(af.gsi)));

      // Calcular fecha_desde/fecha_hasta según dateRange
      const drActive = dr || activeDateRange;
      const now = new Date();
      if (drActive === 'hoy') {
        const today = now.toISOString().split('T')[0];
        params.set('fecha_desde', today);
        params.set('fecha_hasta', today);
      } else if (drActive === 'ayer') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        params.set('fecha_desde', yesterday.toISOString().split('T')[0]);
        params.set('fecha_hasta', yesterday.toISOString().split('T')[0]);
      } else if (drActive === 'semana') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.set('fecha_desde', weekAgo.toISOString().split('T')[0]);
        params.set('fecha_hasta', now.toISOString().split('T')[0]);
      } else if (drActive === 'mes') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        params.set('fecha_desde', monthAgo.toISOString().split('T')[0]);
        params.set('fecha_hasta', now.toISOString().split('T')[0]);
      } else if (drActive === 'ano') {
        params.set('fecha_desde', `${now.getFullYear()}-01-01`);
        params.set('fecha_hasta', now.toISOString().split('T')[0]);
      }

      if (searchTerm) params.set('q', searchTerm);

      const res = await fetch(`${API_BASE}/api/ventanas?${params}`);
      if (res.ok) {
        const data = await res.json();
        const summaries: WindowSummary[] = data.items.map((v: any) => ({
          name: v.codigo,
          fecha_mapeo: v.fecha_mapeo || '',
          sector_geotecnico: v.sector_geotecnico || '',
          geologo: v.mapeador || 'N/A',
          lito_1: v.lito_1 || '',
          largo: v.largo_m !== null ? v.largo_m : 0,
          altura: v.altura_m || 0,
          nivel: v.nivel || '',
          rmr_76: v.rmr_76 !== null ? v.rmr_76 : 0,
          rmr_89: v.rmr_89 !== null ? v.rmr_89 : 0,
          rqd76_pct: v.rqd76_pct !== null && v.rqd76_pct !== undefined ? v.rqd76_pct : null,
          rqd89_pct: v.rqd89_pct !== null && v.rqd89_pct !== undefined ? v.rqd89_pct : null,
          gsi_visual: v.gsi_visual !== null && v.gsi_visual !== undefined ? v.gsi_visual : null,
          class_89: v.rmr_89 >= 81 ? 'MUY BUENA' : v.rmr_89 >= 61 ? 'BUENA' : v.rmr_89 >= 41 ? 'MALA' : 'MUY MALA',
        }));
        setWindows(summaries);
        setKpis(data.kpis);
        setTotalFiltered(data.total_filtered);
        setTotalPages(data.total_pages);
        setPage(data.page);
        setDbOnline(true);
        // No pisar 'unsaved': el estado de sincronización lo gestiona el efecto
        // reactivo según los diffs (ventana + PLT). fetchWindows corre al montar
        // y al aplicar filtros; un 'synced' incondicional desactivaría el botón
        // de guardar aunque haya cambios pendientes (p. ej. registros PLT
        // importados y persistidos en localStorage).
        if (!hasPendingRef.current) {
          setSyncStatus('synced');
          setSyncMessage(`${data.total_filtered.toLocaleString()} celdas en ${data.page}/${data.total_pages} páginas.`);
        }
        return data;
      } else {
        throw new Error();
      }
    } catch (e) {
      console.warn("Backend offline, loading from local cache.", e);
      setSyncStatus('offline');
      setDbOnline(false);
      setSyncMessage("Servidor backend desconectado.");
    } finally {
      setLoading(false);
    }
  };

  const loadedPltCeldaRef = useRef<string | null>(null);

  const fetchPltEnsayos = async (celda?: string, force: boolean = false) => {
    const targetCelda = (celda || activeWindow?.header?.celda || "").trim().toUpperCase();
    if (!targetCelda) {
      setPltEnsayos([]);
      pltSnapshotRef.current = [];
      loadedPltCeldaRef.current = null;
      return;
    }

    if (!force && loadedPltCeldaRef.current === targetCelda) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/ensayos-plt?celda=${encodeURIComponent(targetCelda)}`);
      if (res.ok) {
        const data = await res.json();
        const computed = (data || []).map((r: any) => applyPltFormulas(r));
        // Re-hidratar los registros PLT importados pendientes (delta local):
        // el snapshot queda SOLO con los de BD para que el diff los marque
        // como cambios pendientes (mismo modelo que el import de Mapeo).
        const delta = getPltDelta(targetCelda);
        setPltEnsayos(delta.length > 0 ? [...computed, ...delta] : computed);
        pltSnapshotRef.current = JSON.parse(JSON.stringify(computed));
        loadedPltCeldaRef.current = targetCelda;
        setDbOnline(true);
      }
    } catch (e) {
      console.warn("Failed to fetch PLT trials from database, checking localStorage.", e);
      setDbOnline(false);
      const cached = localStorage.getItem(`plt_ensayos_${targetCelda}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const rows = parsed.rows || parsed || [];
          setPltEnsayos(rows);
          pltSnapshotRef.current = JSON.parse(JSON.stringify(rows));
          loadedPltCeldaRef.current = targetCelda;
        } catch (err) {
          setPltEnsayos([]);
          pltSnapshotRef.current = [];
          loadedPltCeldaRef.current = targetCelda;
        }
      } else {
        setPltEnsayos([]);
        pltSnapshotRef.current = [];
        loadedPltCeldaRef.current = targetCelda;
      }
    }
  };

  const handlePltChange = (newRows: any[]) => {
    setPltEnsayos(newRows);
    const celda = activeWindow?.header?.celda?.trim()?.toUpperCase();
    if (celda) {
      savePltDelta(celda, newRows);
      const snap = pltSnapshotRef.current;
      const isDirty = JSON.stringify(newRows) !== JSON.stringify(snap);
      if (isDirty) {
        addPendingPltCell(celda);
      } else {
        clearPltDelta(celda);
        removePendingPltCell(celda);
      }
    }
  };

  /**
   * Importación PLT (una sola vía, mismo modelo que el import de Mapeo):
   * agrega los registros al estado de la celda destino, los PERSISTE como
   * delta local (sobreviven recargas) y los registra como pendientes.
   * Si la celda destino no es la activa, cambia la ventana activa y la vista
   * a Ensayos PLT automáticamente.
   */
  const handlePltImport = async (celda: string, rows: any[]) => {
    if (!celda || !Array.isArray(rows) || rows.length === 0) return;
    // Computar los campos derivados (muestra_valida_*, diam_equiv, f, is, is50,
    // ucs, resistencia) ANTES de entrar al estado: la validación QA/QC los exige
    // y el resto del sistema (fetch BD, grilla) siempre trabaja con filas
    // computadas. Sin esto, las filas importadas nunca podrían guardarse.
    const computedRows = rows.map((r: any) => applyPltFormulas(r));
    const isOtherCell = activeWindow?.header.celda !== celda;
    if (isOtherCell) {
      await handleSelectWindow(celda);
      await fetchPltEnsayos(celda, true);
      setCurrentView('plt_ensayos');
    }
    setPltEnsayos(prev => [...prev, ...computedRows]);
    savePltDelta(celda, [...getPltDelta(celda), ...computedRows]);
    addPendingPltCell(celda);
  };

  const handleSelectWindow = async (name: string) => {
    setSyncStatus('saving');
    // Carga desde el caché local (borrador). Devuelve true si se cargó.
    const loadCachedLocal = (): boolean => {
      const cached = getCachedCellRaw(name);
      if (!cached) return false;
      try {
        const parsed = JSON.parse(cached);
        // Normalizar SIEMPRE con el mismo criterio que windowFromServerResponse
        // (intemperismo del header): si se usa el default 'd', alteracion difiere
        // del snapshot → hash distinto → la celda se marca pendiente al abrirla
        // sin tocar nada y el diff muestra cambios que no existen.
        parsed.joints = normalizeJoints(parsed.joints || [], parsed.header?.intemperia);
        setActiveWindow(parsed);
        const snapshotRaw = localStorage.getItem(`geolog_window_snapshot_${name}`);
        if (snapshotRaw) {
          const snapParsed = JSON.parse(snapshotRaw);
          setDbSnapshotData(snapParsed);
          setDbSnapshotHash(fastHashObject(snapParsed));
        } else {
          // Celda sin respaldo en BD (borrador local): mantenerla como NUEVA
          // pendiente (snapshot nulo) para que el diff la siga detectando.
          setDbSnapshotData(null);
          setDbSnapshotHash(null);
        }
        return true;
      } catch {
        return false; // caché corrupto
      }
    };

    try {
      const res = await fetch(`${API_BASE}/api/ventanas/${name}`);
      if (res.ok) {
        const v = await res.json();
        const loadedWindow = windowFromServerResponse(v);
        // Aplicar la política de cascada (distancia ≤ largo) al BASELINE antes
        // de guardarlo como snapshot/hash: así caché y snapshot quedan
        // consistentes y la celda no se marca pendiente con "cambios de
        // discontinuidad" solo por el ajuste automático al abrirla.
        loadedWindow.joints = applyDistanceCascade(
          loadedWindow.header,
          loadedWindow.joints,
          calculateWindowGeomec(loadedWindow.header, loadedWindow.joints).largo
        );

        // Si la celda tiene una versión local con cambios sin guardar (borrador),
        // esa versión es el estado activo y la BD solo es el baseline del diff.
        const cachedLocalRaw = getCachedCellRaw(name);
        const hasLocalPending = isCellPending(name) && !!cachedLocalRaw;

        // Reparación silenciosa de residuos viejos: si el borrador local es
        // IDÉNTICO a la BD (mismos valores, ignorando formato/orden de keys),
        // no es un cambio real → se limpia automáticamente para que no marque
        // la celda como pendiente al abrirla sin haber tocado nada.
        if (hasLocalPending && cachedLocalRaw) {
          try {
            const cachedParsed = JSON.parse(cachedLocalRaw);
            const cachedNorm: any = {
              header: cachedParsed.header,
              joints: normalizeJoints(cachedParsed.joints || [], cachedParsed.header?.intemperia),
            };
            if (canonicalEqual(cachedNorm, loadedWindow)) {
              removePendingCell(name);
            }
          } catch {
            // caché corrupto: se ignora; el flujo normal decide más abajo
          }
        }

        let activeToUse = loadedWindow;
        if (hasLocalPending && cachedLocalRaw) {
          try {
            const localParsed = JSON.parse(cachedLocalRaw);
            localParsed.joints = normalizeJoints(localParsed.joints || [], localParsed.header?.intemperia);
            activeToUse = localParsed;
          } catch {
            activeToUse = loadedWindow; // caché corrupto: usar la versión de BD
          }
        }
        const snapshotHash = fastHashObject(loadedWindow);

        setActiveWindow(activeToUse);
        setDbSnapshotData(loadedWindow);
        setDbSnapshotHash(snapshotHash);

        const ctx = { activeCelda: name, pendingImports };
        safeSetItem('geolog_active_window_celda', name, ctx);
        safeSetItem(`geolog_window_${name}`, JSON.stringify(activeToUse), ctx);
        safeSetItem(`geolog_window_snapshot_${name}`, JSON.stringify(loadedWindow), ctx);
        safeSetItem(`geolog_window_snapshot_hash_${name}`, snapshotHash, ctx);

        // Regla 1 (Opción A): al cambiar de celda, eliminar el caché de todas
        // las celdas no protegidas (activa, pendientes, recién importadas).
        evictSincronizadas(ctx);

        fetchPltEnsayos(name);
        setDbOnline(true);
        if (!hasPendingRef.current) {
          setSyncStatus('synced');
        } else {
          setSyncStatus('unsaved');
        }
        setCurrentView('mapeo');
        setSelectedRowIndex(0);
        return;
      }

      if (res.status === 404) {
        // La celda no existe en BD (borrador local): NO es una desconexión.
        // El estado de sincronización lo recalcula el efecto reactivo.
        const loaded = loadCachedLocal();
        if (!loaded) {
          if (!hasPendingRef.current) {
            setSyncStatus('synced');
            setSyncMessage('SQL Server Conectado.');
          } else {
            setSyncStatus('unsaved');
          }
        }
        setCurrentView('mapeo');
        return;
      }

      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.warn("Loading cached local window: ", name, e);
      loadCachedLocal();
      setSyncStatus('offline');
      setDbOnline(false);
      setSyncMessage('SQL Server Desconectado.');
      setCurrentView('mapeo');
    }
  };

  const handleCreateWindow = async (newWindow: any) => {
    const formatted: WindowData = {
      header: {
        celda: newWindow.celda,
        este_from: newWindow.este_from,
        norte_from: newWindow.norte_from,
        cota_from: newWindow.cota_from,
        este_to: newWindow.este_to,
        norte_to: newWindow.norte_to,
        cota_to: newWindow.cota_to,
        altura: newWindow.altura,
        dip_talud: newWindow.dip_talud,
        dipdir_talud: newWindow.dipdir_talud,
        dip_hw: newWindow.dip_hw,
        az_hw: newWindow.az_hw,
        unidad_litologica: newWindow.lito_model || '',
        lito_1: newWindow.lito_model || '',
        lito_2: '',
        lito_3: newWindow.lito_3 || '',
        mapeador: newWindow.mapeador,
        sector: newWindow.sector,
        fase: newWindow.fase,
        nivel: newWindow.nivel,
        sect_geot: newWindow.sect_geot,
        fecha: newWindow.fecha,
        condicion_agua: newWindow.condicion_agua || '',
        resistencia_ucs: newWindow.resistencia_ucs || '',
        comentario: '',
        campania: newWindow.campania,
        gsi_estructura: '',
        gsi_superficie: '',
        gsi_visual: 0,
        control_estructural: 0,
        efectos_voladura: 0,
        ucs_mpa: 0,
        is50_mpa: 0
      },
      joints: normalizeJoints([])
    };

    setActiveWindow(formatted);
    setDbSnapshotData(null);
    setDbSnapshotHash(null);
    safeSetItem('geolog_active_window_celda', formatted.header.celda, { activeCelda: formatted.header.celda, pendingImports });
    // NO escribir geolog_window_* aquí: el useEffect de rastreo lo hará en el siguiente ciclo
    // de render, después de que computeWindowDiff detecte correctamente la celda como nueva.
    setCurrentView('mapeo');
    setSyncStatus('unsaved');
  };

  const handleDeleteWindow = async (name: string) => {
    // Borrador local puro: no existe en BD (no tiene snapshot). Eliminarlo
    // significa descartarlo del workspace, sin tocar SQL Server.
    const isLocalOnly = isCellPending(name) && !localStorage.getItem(`geolog_window_snapshot_${name}`);
    if (isLocalOnly) {
      if (!confirm(`El borrador local '${name}' aún no está en la base de datos. Al eliminarlo se perderá definitivamente. ¿Continuar?`)) {
        return;
      }
      discardLocalCell(name);
      clearPendingImport(name);
      if (activeWindow?.header.celda === name) {
        setActiveWindow(null);
      }
      setCurrentView('dashboard');
      return;
    }

    if (!confirm(`¿Está seguro de que desea eliminar permanentemente la celda ${name}? Se borrará de SQL Server.`)) {
      return;
    }

    try {
         const res = await fetch(`${API_BASE}/api/ventanas/${name}`, { method: 'DELETE' });
         if (res.ok) {
           setDbOnline(true);
           if (!hasPendingRef.current) {
             setSyncStatus('synced');
             setSyncMessage(`Celda ${name} eliminada con éxito.`);
           } else {
             setSyncStatus('unsaved');
           }
           fetchWindows();
      } else {
        throw new Error();
      }
    } catch (e) {
      console.warn("Failed to delete from DB, deleting locally.", e);
      const updated = windows.filter(w => w.name !== name);
      setWindows(updated);
      setSyncStatus('offline');
      setDbOnline(false);
    }

    // Limpiar cualquier resto local de la celda (pendientes + caché) en ambos caminos
    discardLocalCell(name);
    clearPendingImport(name);

    if (activeWindow?.header.celda === name) {
      setActiveWindow(null);
    }
    setCurrentView('dashboard');
  };

  /**
   * Fase 2 del import: las celdas del Excel NO se escriben directo en BD.
   * Se convierten en borradores pendientes (localStorage) con su estado de
   * validación, y se suben recién con GUARDAR CAMBIOS (QA/QC + colisiones).
   */
  const handleImportToPending = async (items: ImportedCellItem[]) => {
    if (!Array.isArray(items) || items.length === 0) return;

    // Regla 3 — middleware de espacio: no importar si el navegador no tiene lugar
    const space = canImport(items.length);
    if (!space.ok) {
      alert(
        space.code === 'IMPORT_LIMITED'
          ? `Solo hay espacio en el navegador para ${space.maxCells} celda(s). Guarde sus cambios pendientes o importe menos celdas.`
          : 'El almacenamiento del navegador está lleno. Guarde sus cambios pendientes para liberar espacio e intente de nuevo.'
      );
      return;
    }

    let imported = 0;
    const firstCelda = items[0]?.codigo_final;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const windowData = excelDataToWindowData(item.codigo_final, item.excel_data, item.estructuras);
      if (!windowData) continue;
      const celda = windowData.header.celda;
      const ctx = { activeCelda: celda };
      safeSetItem(`geolog_window_${celda}`, JSON.stringify(windowData), ctx);

      // Baseline: si la celda ya existe en BD, traer su estado para que el
      // guardado la ACTUALICE en lugar de bloquear por colisión de nombre.
      // La PRIMERA celda se salta: handleSelectWindow la abrirá y hará ese
      // fetch con su propia lógica (evita el GET duplicado en los logs).
      const hasSnapshot = !!localStorage.getItem(`geolog_window_snapshot_${celda}`);
      if (!hasSnapshot && celda !== firstCelda) {
        try {
          const res = await fetch(`${API_BASE}/api/ventanas/${encodeURIComponent(celda)}`);
          if (res.ok) {
            const v = await res.json();
            const baseline = windowFromServerResponse(v);
            // Misma política de cascada que handleSelectWindow: el baseline del
            // import también debe quedar consistente con el caché.
            baseline.joints = applyDistanceCascade(
              baseline.header,
              baseline.joints,
              calculateWindowGeomec(baseline.header, baseline.joints).largo
            );
            safeSetItem(`geolog_window_snapshot_${celda}`, JSON.stringify(baseline), ctx);
            safeSetItem(`geolog_window_snapshot_hash_${celda}`, fastHashObject(baseline), ctx);
          }
        } catch {
          // offline: quedará como borrador nuevo; el guardado avisará si colisiona
        }
      }

      addPendingCell(celda);
      // Estado de validación desde el primer momento (bloquea el guardado si está incompleta)
      setCellValidation(celda, validateMapeoWindow(windowData).map(i => i.message));
      imported++;
    }

    if (imported === 0) return;

    const codes = items.map(i => i.codigo_final);
    setPendingImports(prev => [...new Set([...prev, ...codes])]);
    setSyncStatus('unsaved');
    setSyncMessage(`${imported} celda(s) importadas como borradores. Revise los datos y use GUARDAR CAMBIOS para subirlas a la base de datos.`);
    handleSelectWindow(items[0].codigo_final);
  };

  const handleRenameActiveCelda = async (newCeldaName: string) => {
    if (!activeWindow) return;
    const oldCeldaName = activeWindow.header.celda;
    const cleanNewName = newCeldaName.trim().toUpperCase();

    if (!cleanNewName || oldCeldaName === cleanNewName) return;

    // 1. Actualizar estado local inmediatamente
    const updatedHeader: WindowHeader = {
      ...activeWindow.header,
      celda: cleanNewName
    };

    const updatedWindow: WindowData = {
      ...activeWindow,
      header: updatedHeader
    };

    // 2. Intentar actualizar en servidor SQL Server
    try {
      const res = await fetch(`${RESOLVED_API_BASE}/api/ventanas/${encodeURIComponent(oldCeldaName)}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_codigo: cleanNewName })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Error al renombrar la celda en el servidor.");
      }
        setDbOnline(true);
        if (!hasPendingRef.current) {
          setSyncStatus('synced');
          setSyncMessage(`Celda renombrada a '${cleanNewName}' en SQL Server.`);
        } else {
          setSyncStatus('unsaved');
        }
      } catch (err) {
        console.warn("Backend rename offline or failed, applying local snapshot migration:", err);
      setSyncStatus('offline');
      setDbOnline(false);
      setSyncMessage(`Celda renombrada localmente a '${cleanNewName}'.`);
    }

    // 3. Migrar llaves de LocalStorage y snapshot tree
    try {
      const ctx = { activeCelda: cleanNewName, pendingImports };
      const windowCache = localStorage.getItem(`geolog_window_${oldCeldaName}`);
      if (windowCache) {
        const parsed = JSON.parse(windowCache);
        parsed.header.celda = cleanNewName;
        safeSetItem(`geolog_window_${cleanNewName}`, JSON.stringify(parsed), ctx);
        localStorage.removeItem(`geolog_window_${oldCeldaName}`);
      } else {
        safeSetItem(`geolog_window_${cleanNewName}`, JSON.stringify(updatedWindow), ctx);
      }

      const snapshotCache = localStorage.getItem(`geolog_window_snapshot_${oldCeldaName}`);
      if (snapshotCache) {
        const parsedSnap = JSON.parse(snapshotCache);
        parsedSnap.header.celda = cleanNewName;
        safeSetItem(`geolog_window_snapshot_${cleanNewName}`, JSON.stringify(parsedSnap), ctx);
        localStorage.removeItem(`geolog_window_snapshot_${oldCeldaName}`);
      }

      const hashCache = localStorage.getItem(`geolog_window_snapshot_hash_${oldCeldaName}`);
      if (hashCache) {
        safeSetItem(`geolog_window_snapshot_hash_${cleanNewName}`, hashCache, ctx);
        localStorage.removeItem(`geolog_window_snapshot_hash_${oldCeldaName}`);
      }

      const pltCache = localStorage.getItem(`plt_ensayos_${oldCeldaName}`);
      if (pltCache) {
        safeSetItem(`plt_ensayos_${cleanNewName}`, pltCache, ctx);
        localStorage.removeItem(`plt_ensayos_${oldCeldaName}`);
      }

      safeSetItem('geolog_active_window_celda', cleanNewName, ctx);
    } catch (e) {
      console.error("Error al migrar claves de LocalStorage:", e);
    }

    // 4. Actualizar referencias en estado React
    setActiveWindow(updatedWindow);

    if (dbSnapshotData) {
      setDbSnapshotData({
        ...dbSnapshotData,
        header: { ...dbSnapshotData.header, celda: cleanNewName }
      });
    }

    // Refrescar listado de celdas
    fetchWindows();
  };

  // Paginación y filtros del Dashboard
  const handleSearchSubmit = (term: string, globalSearch: boolean) => {
    setSearchTerm(term);
    setIsGlobalSearch(globalSearch);
    setPage(1);
    fetchWindows(1, pageSize, activeDateRange, term, globalSearch);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setIsGlobalSearch(false);
    setPage(1);
    fetchWindows(1, pageSize, activeDateRange, '', false);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchWindows(newPage, pageSize, activeDateRange, searchTerm, isGlobalSearch);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    fetchWindows(1, newSize, activeDateRange, searchTerm, isGlobalSearch);
  };

  const handleFilterChange = (filters: { dateRange?: string }) => {
    const newDr = filters.dateRange || activeDateRange;
    if (newDr !== activeDateRange) {
      setActiveDateRange(newDr);
      const termToKeep = isGlobalSearch ? searchTerm : '';
      if (!isGlobalSearch) {
        setSearchTerm('');
      }
      setPage(1);
      fetchWindows(1, pageSize, newDr, termToKeep, isGlobalSearch, advancedFilters);
    }
  };

  const handleAdvancedFilterChange = (filters: {
    celda: string;
    sector: string;
    rmr76: string;
    rmr89: string;
    rqd76: string;
    rqd89: string;
    gsi: string;
  }) => {
    setAdvancedFilters(filters);
    setPage(1);
    fetchWindows(1, pageSize, activeDateRange, searchTerm, isGlobalSearch, filters);
  };

  const handleClearAdvancedFilters = () => {
    const cleared = {
      celda: '',
      sector: '',
      rmr76: '',
      rmr89: '',
      rqd76: '',
      rqd89: '',
      gsi: '',
    };
    setAdvancedFilters(cleared);
    setPage(1);
    fetchWindows(1, pageSize, activeDateRange, searchTerm, isGlobalSearch, cleared);
  };

  const handleDeleteFamily = (famId: number) => {
    if (!activeWindow) return;

    if (famId <= 3) {
      alert("No se pueden eliminar las familias básicas obligatorias (F1, F2, F3).");
      return;
    }

    const familyJoints = activeWindow.joints.filter(j => j.familia === famId);

    const isBlankVal = (v: any) => v === undefined || v === null || v === -1 || v === '-1' || v === '';

    const hasData = familyJoints.some(j =>
      !isBlankVal(j.distancia) ||
      !isBlankVal(j.dip) ||
      !isBlankVal(j.dip_dir) ||
      !isBlankVal(j.espaciamiento) ||
      !isBlankVal(j.abertura) ||
      !isBlankVal(j.espesor) ||
      !isBlankVal(j.jrc) ||
      !isBlankVal(j.rugosidad) ||
      !isBlankVal(j.tipo_estructura) ||
      !isBlankVal(j.alteracion) ||
      !isBlankVal(j.forma) ||
      !isBlankVal(j.extremos_visibles) ||
      !isBlankVal(j.terminacion) ||
      !isBlankVal(j.relleno1) ||
      !isBlankVal(j.n_estructuras) ||
      !isBlankVal(j.continuidad)
    );

    if (hasData) {
      const confirm1 = window.confirm(`¿Está seguro de que desea eliminar la Familia F${famId}? Contiene datos registrados.`);
      if (!confirm1) return;
      const confirm2 = window.confirm(`ATENCIÓN: Se perderán definitivamente todos los datos de la Familia F${famId}. Las familias posteriores serán reindexadas automáticamente. ¿Confirmar eliminación?`);
      if (!confirm2) return;
    }

    const remainingJoints = activeWindow.joints.filter(j => j.familia !== famId);
    const shiftedJoints = remainingJoints.map(j => {
      if (j.familia > famId) {
        return { ...j, familia: j.familia - 1 };
      }
      return j;
    });

    const normalized = normalizeJoints(shiftedJoints, activeWindow.header.intemperia);

    setActiveWindow({
      ...activeWindow,
      joints: normalized
    });
  };

  const handleConfirmSave = async (scope: 'active' | 'all') => {
    setIsLoadingWindow(true);
    setShowSaveConfirmModal(false);
    setSyncStatus('saving');
    setSyncMessage("Sincronizando con base de datos SQL Server...");

    let windowsToSave: WindowData[] = [];
    if (scope === 'active' && activeWindow) {
      windowsToSave = [activeWindow];
    } else {
      const unsavedRaw = localStorage.getItem('geolog_unsaved_windows');
      const unsavedNames: string[] = unsavedRaw ? JSON.parse(unsavedRaw) : [];
      const allNames = new Set(unsavedNames);
      if (activeWindow) allNames.add(activeWindow.header.celda);

      for (const celda of allNames) {
        if (activeWindow && activeWindow.header.celda === celda) {
          windowsToSave.push(activeWindow);
        } else {
          const cachedRaw = localStorage.getItem(`geolog_window_${celda}`);
          if (cachedRaw) {
            windowsToSave.push(JSON.parse(cachedRaw));
          }
        }
      }
    }

    let successCount = 0;
    let totalJointsSaved = 0;

    // Verificación de colisiones: las celdas NUEVAS (sin snapshot) pudieron ser
    // creadas en BD por otra persona después de crear el borrador local. Ante
    // cualquier duda (celda existente o error de red) se bloquea el guardado.
    const newCellNames = windowsToSave
      .filter(w => !localStorage.getItem(`geolog_window_snapshot_${w.header.celda}`))
      .map(w => w.header.celda);
    if (newCellNames.length > 0) {
      const check = await verifyNameCollisions(newCellNames, API_BASE, windows.map(w => w.name));
      if (!check.ok) {
        setIsLoadingWindow(false);
        setSyncStatus('unsaved');
        setSyncMessage('No se guardó: hay celdas cuyo código ya existe en la base de datos.');
        alert(
          `El código ${check.collisions.join(', ')} ya existe en la base de datos ` +
          '(fue creado después de su borrador). Renombre su celda o descarte el borrador antes de guardar.'
        );
        return;
      }
    }

    // Bloqueo por QA/QC (F1/F2): se consulta el estado de validación PERSISTIDO
    // de cada celda pendiente (actualizado en cada evaluación). Si una celda no
    // tiene registro (p.ej. importada sin abrir), se evalúa aquí mismo (fallback).
    for (const w of windowsToSave) {
      if (!hasCellValidation(w.header.celda)) {
        setCellValidation(w.header.celda, validateMapeoWindow(w).map(i => i.message));
      }
    }
    const invalidCells = getInvalidPendingCells()
      .filter(v => windowsToSave.some(w => w.header.celda === v.celda));
    if (invalidCells.length > 0) {
      setIsLoadingWindow(false);
      setSyncStatus('unsaved');
      setSyncMessage('No se guardó: hay celdas con campos pendientes o inconsistencias QA/QC.');
      alert(
        `No se puede guardar: ${invalidCells
          .map(v => `${v.celda} (${v.count} problema(s))`)
          .join(', ')}. Abra cada celda y corrija los campos señalados en el panel QA/QC.`
      );
      return;
    }

    for (const winData of windowsToSave) {
      const nonVacantJoints = (winData.joints || []).filter(j => !(j.distancia === -1 && j.dip === -1 && j.espaciamiento === -1));
      const winCalc = calculateWindowGeomec(winData.header, winData.joints);

      const payload = {
        codigo: winData.header.celda,
        fecha_mapeo: winData.header.fecha || new Date().toISOString().split('T')[0],
        mapeador: winData.header.mapeador || 'AS-HM',
        campania: parseInt(String(winData.header.campania)) || 2026,
        este_ini: winData.header.este_from || 0,
        norte_ini: winData.header.norte_from || 0,
        cota_ini: winData.header.cota_from || 0,
        este_fin: winData.header.este_to || 0,
        norte_fin: winData.header.norte_to || 0,
        cota_fin: winData.header.cota_to || 0,
        largo_m: winCalc.largo,
        altura: winData.header.altura !== undefined && winData.header.altura !== null ? winData.header.altura : null,
        altura_m: winData.header.altura !== undefined && winData.header.altura !== null ? winData.header.altura : null,
        dip: HOLE_AUTO ? winCalc.dip_hole : (winData.header.dip_hw !== undefined && winData.header.dip_hw !== null ? winData.header.dip_hw : null),
        dip_hw: HOLE_AUTO ? winCalc.dip_hole : (winData.header.dip_hw !== undefined && winData.header.dip_hw !== null ? winData.header.dip_hw : null),
        azimut_hole: HOLE_AUTO ? winCalc.az_hole : (winData.header.az_hw !== undefined && winData.header.az_hw !== null ? winData.header.az_hw : null),
        az_hw: HOLE_AUTO ? winCalc.az_hole : (winData.header.az_hw !== undefined && winData.header.az_hw !== null ? winData.header.az_hw : null),
        dip_talud: winData.header.dip_talud !== undefined && winData.header.dip_talud !== null ? winData.header.dip_talud : null,
        dipdir_talud: HOLE_AUTO ? winCalc.dip_dir_talud : (winData.header.dipdir_talud !== undefined && winData.header.dipdir_talud !== null ? winData.header.dipdir_talud : null),
        alteracion: (winData.header.alteracion || winData.header.alt_mapeo) && (winData.header.alteracion || winData.header.alt_mapeo) !== '-1' ? (winData.header.alteracion || winData.header.alt_mapeo)!.toLowerCase().trim() : null,
        altura_mapeo: (winData.header.alteracion || winData.header.alt_mapeo) && (winData.header.alteracion || winData.header.alt_mapeo) !== '-1' ? (winData.header.alteracion || winData.header.alt_mapeo)!.toLowerCase().trim() : null,
        alteracion_codigo: (winData.header.alteracion || winData.header.alt_mapeo) && (winData.header.alteracion || winData.header.alt_mapeo) !== '-1' ? (winData.header.alteracion || winData.header.alt_mapeo)!.toLowerCase().trim() : null,
        intemperismo: winData.header.intemperia && winData.header.intemperia !== '-1' ? winData.header.intemperia : null,
        intemperismo_codigo: winData.header.intemperia && winData.header.intemperia !== '-1' ? winData.header.intemperia : null,
        lito_1: winData.header.lito_1 || null,
        lito_2: winData.header.lito_2 || null,
        lito_3: winData.header.lito_3 || null,
        unidad_litologica: winData.header.unidad_litologica || null,
        sector: winData.header.sector && winData.header.sector !== '-1' ? winData.header.sector : null,
        fase: winData.header.fase && String(winData.header.fase).trim() !== '' ? parseInt(String(winData.header.fase)) : null,
        nivel: winData.header.nivel ? String(winData.header.nivel) : null,
        sector_geotecnico: winData.header.sect_geot && winData.header.sect_geot !== '-1' ? winData.header.sect_geot : null,
        discontinuidades: nonVacantJoints.map(j => {
          const cj = winCalc.joints.find(c => c.row.id === j.id) || winCalc.joints.find(c => c.row.familia === j.familia && c.row.distancia === j.distancia && c.row.dip === j.dip);
          return {
            estructura_id: j.estructura_id ?? null,
            fam: j.familia,
            dist: j.distancia === -1 ? null : j.distancia,
            tipo: (j.tipo_estructura && j.tipo_estructura !== '-1') ? j.tipo_estructura : null,
            dip: j.dip === -1 ? null : j.dip,
            dipdir: j.dip_dir === -1 ? null : j.dip_dir,
            aber: j.abertura === -1 ? null : j.abertura,
            esp: j.espesor === -1 ? null : j.espesor,
            cont: j.continuidad === -1 ? null : j.continuidad,
            espac: j.espaciamiento === -1 ? null : j.espaciamiento,
            nstr: j.n_estructuras === -1 ? null : j.n_estructuras,
            next: j.extremos_visibles === -1 ? null : j.extremos_visibles,
            term: j.terminacion === -1 ? null : j.terminacion,
            r1: (j.relleno1 && j.relleno1 !== '-1') ? j.relleno1 : null,
            r2: (j.relleno2 && j.relleno2 !== '-1') ? j.relleno2 : null,
            jrc: j.jrc === -1 ? null : j.jrc,
            rug: j.rugosidad === -1 ? null : j.rugosidad,
            forma: (j.forma && j.forma !== '-1') ? j.forma : null,
            alt: (j.alteracion && j.alteracion !== '-1') ? j.alteracion : null,
            teta: cj ? cj.theta : null,
            alfa: cj ? cj.alpha : null,
            x: cj ? cj.x : null,
            y: cj ? cj.y : null,
            z: cj ? cj.z : null,
            altR76: cj ? cj.alteracion_76 : null,
            relR76: cj ? cj.relleno_76 : null,
            contR76: cj ? cj.continuidad_76 : null,
            abR76: cj ? cj.abertura_76 : null,
            rugR76: cj ? cj.rugosidad_76 : null,
            totalR76: cj ? cj.total_condicion_76 : null,
            altR89: cj ? cj.alteracion_89 : null,
            relR89: cj ? cj.relleno_89 : null,
            contR89: cj ? cj.continuidad_89 : null,
            abR89: cj ? cj.abertura_89 : null,
            rugR89: cj ? cj.rugosidad_89 : null,
            totalR89: cj ? cj.total_condicion_89 : null,
          };
        }),
        rmr_input: {
          agua_codigo: (winData.header.condicion_agua && winData.header.condicion_agua !== '-1') ? winData.header.condicion_agua : null,
          resistencia_codigo: (winData.header.resistencia_ucs && winData.header.resistencia_ucs !== '-1') ? winData.header.resistencia_ucs : null,
          gsi_estructura: (winData.header.gsi_estructura && winData.header.gsi_estructura !== '-1') ? winData.header.gsi_estructura : null,
          gsi_superficie: (winData.header.gsi_superficie && winData.header.gsi_superficie !== '-1') ? winData.header.gsi_superficie : null,
          gsi_visual: GSI_VISUAL_AUTO ? (suggestGsiVisual(winCalc.rqd_est, winCalc.condicion_rating_89) ?? null) : (winData.header.gsi_visual || null),
          control_estructural: winData.header.control_estructural || null,
          efectos_voladura: winData.header.efectos_voladura || null,
          ucs_mpa: winData.header.ucs_mpa || null,
          is50_mpa: winData.header.is50_mpa || null,
          comentario: winData.header.comentario || null
        }
      };

      try {
        const res = await fetch(`${API_BASE}/api/ventanas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          successCount++;
          totalJointsSaved += nonVacantJoints.length;
          setDbOnline(true);
          clearPendingImport(winData.header.celda);
          const hash = fastHashObject(winData);
          const ctx = { activeCelda: winData.header.celda, pendingImports };
          safeSetItem(`geolog_window_${winData.header.celda}`, JSON.stringify(winData), ctx);
          safeSetItem(`geolog_window_snapshot_${winData.header.celda}`, JSON.stringify(winData), ctx);
          safeSetItem(`geolog_window_snapshot_hash_${winData.header.celda}`, hash, ctx);
          clearCellValidation(winData.header.celda);

          if (activeWindow && activeWindow.header.celda === winData.header.celda) {
            setDbSnapshotData(winData);
            setDbSnapshotHash(hash);
          }

          const unsavedRaw = localStorage.getItem('geolog_unsaved_windows');
          const unsavedList: string[] = unsavedRaw ? JSON.parse(unsavedRaw) : [];
          safeSetItem('geolog_unsaved_windows', JSON.stringify(unsavedList.filter(c => c !== winData.header.celda)), ctx);
        }
      } catch (err) {
        console.warn("Save DB failed, persisting locally in localStorage:", winData.header.celda, err);
        setDbOnline(false);
        const hash = fastHashObject(winData);
        const ctx = { activeCelda: winData.header.celda, pendingImports };
        safeSetItem(`geolog_window_${winData.header.celda}`, JSON.stringify(winData), ctx);
        safeSetItem(`geolog_window_snapshot_${winData.header.celda}`, JSON.stringify(winData), ctx);
        safeSetItem(`geolog_window_snapshot_hash_${winData.header.celda}`, hash, ctx);
        if (activeWindow && activeWindow.header.celda === winData.header.celda) {
          setDbSnapshotData(winData);
          setDbSnapshotHash(hash);
        }
        successCount++;
      }
    }

    // Guardado de Ensayos PLT para TODAS las celdas pendientes
    const pendingPltList = getPendingPltCells();
    const activeCeldaNorm = activeWindow?.header?.celda?.trim()?.toUpperCase();

    if (activeCeldaNorm && JSON.stringify(pltEnsayos) !== JSON.stringify(pltSnapshotRef.current)) {
      if (!pendingPltList.includes(activeCeldaNorm)) {
        pendingPltList.push(activeCeldaNorm);
      }
    }

    for (const celdaName of pendingPltList) {
      const isCurrentActive = activeCeldaNorm === celdaName;
      const rowsToSave = isCurrentActive ? pltEnsayos : getPltDelta(celdaName);

      try {
        const targetUrl = `${API_BASE}/api/ensayos-plt?celda=${encodeURIComponent(celdaName)}`;
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rowsToSave)
        });
        if (res.ok) {
          const savedData = await res.json();
          const computed = (savedData || []).map((r: any) => applyPltFormulas(r));
          if (isCurrentActive) {
            setPltEnsayos(computed);
            pltSnapshotRef.current = JSON.parse(JSON.stringify(computed));
            loadedPltCeldaRef.current = celdaName;
          }
          clearPltDelta(celdaName);
          removePendingPltCell(celdaName);
          setDbOnline(true);
        }
      } catch (e) {
        console.error("Error saving PLT trials to SQL Server for cell", celdaName, e);
        setDbOnline(false);
      }
    }

      setIsLoadingWindow(false);
      if (!hasPendingRef.current) {
        setSyncStatus('synced');
        setSyncMessage(`${successCount} celda(s) sincronizadas con SQL Server.`);
      } else {
        setSyncStatus('unsaved');
      }
      fetchWindows();

    setSaveResultData({
      savedCount: successCount,
      totalEdits: workspaceDiff.totalCellEditsAll,
      totalJoints: totalJointsSaved
    });
    setShowSaveResultModal(true);
  };

  const handleConfirmDiscard = (scope: 'active' | 'all') => {
    setShowDiscardModal(false);
    if (scope === 'active' && activeWindow) {
      const celda = activeWindow.header.celda;
      const snapshotRaw = localStorage.getItem(`geolog_window_snapshot_${celda}`);
      if (snapshotRaw) {
        // Celda con respaldo en BD: restaurar al último estado persistido
        const ctx = { activeCelda: celda, pendingImports };
        const parsed = JSON.parse(snapshotRaw);
        setActiveWindow(parsed);
        safeSetItem(`geolog_window_${celda}`, JSON.stringify(parsed), ctx);
        removePendingCell(celda);
        // Sincronizar la referencia de hash con el estado restaurado: el efecto de
        // rastreo compara el hash del caché contra ESTA referencia, y si divergen
        // (p. ej. referencia vieja o ausente) vuelve a marcar la celda como
        // pendiente → badge BORRADOR fantasma tras descartar.
        const restoredHash = fastHashObject(parsed);
        setDbSnapshotHash(restoredHash);
        safeSetItem(`geolog_window_snapshot_hash_${celda}`, restoredHash, ctx);
      } else {
        // Borrador local puro: se elimina definitivamente
        discardLocalCell(celda);
        setActiveWindow(null);
      }
      clearPendingImport(celda);
      // Descartar también los ensayos PLT importados pendientes de la celda
      if (getPendingPltCells().includes(celda)) {
        clearPltDelta(celda);
        removePendingPltCell(celda);
        fetchPltEnsayos(celda, true);
      }
    } else {
      try {
        const unsavedRaw = localStorage.getItem('geolog_unsaved_windows');
        const unsavedNames: string[] = unsavedRaw ? JSON.parse(unsavedRaw) : [];
        for (const celda of unsavedNames) {
          const snapshotRaw = localStorage.getItem(`geolog_window_snapshot_${celda}`);
          if (snapshotRaw) {
            const ctx = { activeCelda: celda, pendingImports };
            const parsed = JSON.parse(snapshotRaw);
            safeSetItem(`geolog_window_${celda}`, JSON.stringify(parsed), ctx);
            // Mismo principio que el scope 'active': referencia = estado restaurado.
            const restoredHash = fastHashObject(parsed);
            safeSetItem(`geolog_window_snapshot_hash_${celda}`, restoredHash, ctx);
            if (activeWindow && activeWindow.header.celda === celda) {
              setActiveWindow(parsed);
              setDbSnapshotData(parsed);
              setDbSnapshotHash(restoredHash);
            }
          } else {
            // Borrador local puro: no tiene respaldo en BD → eliminar definitivamente
            discardLocalCell(celda);
            if (activeWindow && activeWindow.header.celda === celda) {
              setActiveWindow(null);
            }
          }
          clearPendingImport(celda);
        }
        localStorage.setItem('geolog_unsaved_windows', JSON.stringify([]));

        // Limpiar deltas PLT de todas las celdas pendientes
        const pendingPlt = getPendingPltCells();
        for (const c of pendingPlt) {
          clearPltDelta(c);
          removePendingPltCell(c);
        }
        if (activeWindow?.header?.celda) {
          fetchPltEnsayos(activeWindow.header.celda, true);
        }
      } catch (e) { }
    }
  };



  const handleFocusField = (fieldId: string) => {
    if (fieldId.startsWith('header-') || fieldId.startsWith('joint-')) {
      setCurrentView('mapeo');
    } else if (fieldId.startsWith('plt-')) {
      setCurrentView('plt_ensayos');
    }

    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('animate-pulse-ring');
        setTimeout(() => el.classList.remove('animate-pulse-ring'), 2000);
      }
    }, 150);
  };

  if (!catalogsLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-navy-950 text-slate-100 gap-4">
        <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold tracking-wide text-slate-400">
          {bootFailed
            ? `No se pudo conectar con el servidor. Puede estar despertando o fuera de línea. (intento ${bootAttempt})`
            : bootAttempt > 0
              ? `Despertando servidor... (intento ${bootAttempt + 1})`
              : 'Cargando interfaz de ventanas geomecánicas...'}
        </p>
        {bootFailed && (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => {
                setBootFailed(false);
                setBootAttempt(0);
                bootLoaderRef.current();
              }}
              className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 shadow-md"
            >
              Reintentar
            </button>
            <p className="text-xs text-slate-500 font-semibold">Se reintenta automáticamente cada 10 segundos...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-navy-950 text-slate-100 font-sans">
      {/* 1. SIDEBAR */}
      <Sidebar
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        selectedWindow={activeWindow ? activeWindow.header.celda : null}
        isCollapsed={sidebarCollapsed}
      />

      {/* 2. MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Banner global de reconexión (backend dormido / fuera de línea) */}
        {!dbOnline && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs font-bold px-6 py-2 flex items-center gap-2 z-20">
            <Loader2 size={14} className="animate-spin shrink-0" />
            <span>Perdiste conexión con el servidor. Puede estar despertando... Reconectando automáticamente.</span>
          </div>
        )}
        {/* Sync Status Header */}
        <header className="h-16 border-b border-navy-800 flex items-center justify-between px-6 bg-navy-950/40 backdrop-blur z-10 shrink-0">
          <div className="flex items-center gap-3">

            {/* BOTÓN INTERACTIVO DE COLAPSO */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 mr-1 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-400 hover:text-slate-100 transition-all shadow-md active:scale-95"
              title={sidebarCollapsed ? "Mostrar menú lateral" : "Ocultar menú lateral"}
            >
              <Menu size={16} />
            </button>

            {currentView !== 'dashboard' && (
              <button
                onClick={() => setCurrentView('dashboard')}
                className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 hover:text-white border border-navy-800 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <ArrowLeft size={14} />
                <span>Volver al Panel</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Server Connectivity Indicator */}
            <div className="flex items-center gap-2 pr-3 border-r border-navy-800">
              <span className={`w-2.5 h-2.5 rounded-full ${dbOnline
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                }`} />
              <span className="text-xs text-slate-400 font-semibold hidden md:inline" title={dbOnline ? 'Conectado al servidor de base de datos SQL Server.' : 'SQL Server Desconectado'}>
                {dbOnline ? 'SQL Server Conectado' : 'SQL Server Desconectado'}
              </span>
            </div>

            {/* General Topbar Actions */}
            <div className="flex items-center gap-2">

              <button
                onClick={() => setShowFormulas(!showFormulas)}
                className={`flex items-center gap-1.5 border px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 ${showFormulas
                  ? 'bg-violet-500/10 border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.12)]'
                  : 'bg-navy-900 border-navy-800 text-slate-400 hover:text-slate-200'
                  }`}
                title="Activar/Desactivar visualización de fórmulas al pasar el mouse"
              >
                <Calculator size={14} className={showFormulas ? 'text-violet-400 animate-pulse' : 'text-slate-400'} />
                <span>{showFormulas ? 'Fórmulas Activas' : 'Ocultar Fórmulas'}</span>
              </button>

              <button
                onClick={() => setIsCatalogModalOpen(true)}
                className="flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/40 hover:bg-sky-500/20 hover:border-sky-400 text-sky-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(14,165,233,0.12)] active:scale-95"
                title="Ver Catálogos de Referencia Geomecánica de Ventanas"
              >
                <BookOpen size={14} className="text-sky-400" />
                <span>Catálogo de Ventanas</span>
              </button>

              <button
                onClick={() => setIsPltCatalogModalOpen(true)}
                className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/40 hover:bg-cyan-500/20 hover:border-cyan-400 text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(6,182,212,0.12)] active:scale-95"
                title="Ver Catálogos de Referencia de Ensayos PLT"
              >
                <Activity size={14} className="text-cyan-400" />
                <span>Catálogo de Ensayos PLT</span>
              </button>

              {activeWindow && (
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(16,185,129,0.12)] active:scale-95"
                  title="Exportar Mapeo de esta Ventana en Formato Excel DB"
                >
                  <FileSpreadsheet size={14} className="text-emerald-400" />
                  <span>Exportar</span>
                </button>
              )}

              {/* Botón Descartar Cambios */}
              {unsavedCount > 0 && (
                <button
                  onClick={() => setShowDiscardModal(true)}
                  disabled={isLoadingWindow}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 border bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.15)]"
                  title="Descartar cambios no guardados en el espacio de trabajo"
                >
                  <RotateCcw size={14} />
                  <span>Descartar Cambios</span>
                </button>
              )}

              {/* Botón Guardar Cambios */}
              <button
                onClick={() => setShowSaveConfirmModal(true)}
                disabled={isLoadingWindow || (unsavedCount === 0 && syncStatus !== 'unsaved')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 border relative ${unsavedCount > 0 || syncStatus === 'unsaved'
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse'
                  : 'bg-navy-900 border-navy-800 text-slate-500 cursor-not-allowed opacity-70'
                  }`}
                title="Guardar todos los cambios en SQL Server"
              >
                <Save size={14} />
                <span>GUARDAR CAMBIOS</span>
                {(unsavedCount > 0 || syncStatus === 'unsaved') && (
                  <span className="ml-1 bg-amber-500 text-navy-950 font-black text-[10px] px-1.5 py-0.5 rounded-full">
                    {unsavedCount > 0 ? unsavedCount : '!'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content scroll window */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {currentView === 'dashboard' && (
            <Dashboard
              windows={windows}
              kpis={kpis}
              page={page}
              pageSize={pageSize}
              totalFiltered={totalFiltered}
              totalPages={totalPages}
              loading={loading}
              pendingCells={pendingCellSummaries}
              pendingCellNames={pendingCellNames}
              searchTerm={searchTerm}
              isGlobalSearch={isGlobalSearch}
              onSearchSubmit={handleSearchSubmit}
              onClearSearch={handleClearSearch}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              onFilterChange={handleFilterChange}
              activeDateRange={activeDateRange}
              advancedFilters={advancedFilters}
              onAdvancedFilterChange={handleAdvancedFilterChange}
              onClearAdvancedFilters={handleClearAdvancedFilters}
              onSelectWindow={handleSelectWindow}
              onCreateWindow={handleCreateWindow}
              onDeleteWindow={handleDeleteWindow}
              onOpenImportModal={() => setIsImportModalOpen(true)}
            />
          )}

          {currentView === 'auditoria_masiva' && (
            <BulkAuditor apiBase={RESOLVED_API_BASE} />
          )}

          {currentView === 'congruencia' && (
            <CongruenceAuditor apiBase={RESOLVED_API_BASE} />
          )}

          {currentView === 'mapeo' && activeWindow && (
            <div className="space-y-6 animate-fade-in">
              <VentanaForm
                key={activeWindow.header.celda}
                header={activeWindow.header}
                onChange={(header) => {
                  setActiveWindow({ ...activeWindow, header });
                }}
                calculated={calculated}
                onOpenImportModal={() => setIsImportModalOpen(true)}
                onOpenCatalogs={() => setIsCatalogModalOpen(true)}
                onOpenRenameModal={() => setIsRenameModalOpen(true)}
                showFormulas={showFormulas}
              />

              <DisconTable
                joints={activeWindow.joints}
                onChange={(joints) => setActiveWindow({ ...activeWindow, joints })}
                selectedRowIndex={selectedRowIndex}
                onSelectRow={setSelectedRowIndex}
                largoMax={calculated?.largo || 10}
                onDeleteFamily={handleDeleteFamily}
                intemperia={activeWindow.header.intemperia}
                showFormulas={showFormulas} // Nueva Prop
              />

              {/* CENTRO DE MÉTRICAS GEOMECÁNICA */}
              {(() => {
                const getFamilyStyle = (fam: number) => {
                  const styles: Record<number, { dot: string; container: string; badge: string }> = {
                    1: { dot: 'bg-orange-500', container: 'bg-orange-500/5 border border-orange-500/20 text-orange-400', badge: 'bg-orange-500/20 border border-orange-500/30 text-orange-400' },
                    2: { dot: 'bg-emerald-500', container: 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-400', badge: 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' },
                    3: { dot: 'bg-indigo-500', container: 'bg-indigo-500/5 border border-indigo-500/20 text-indigo-400', badge: 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400' },
                    4: { dot: 'bg-pink-500', container: 'bg-pink-500/5 border border-pink-500/20 text-pink-400', badge: 'bg-pink-500/20 border border-pink-500/30 text-pink-400' },
                    5: { dot: 'bg-cyan-500', container: 'bg-cyan-500/5 border border-cyan-500/20 text-cyan-400', badge: 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400' },
                    6: { dot: 'bg-amber-500', container: 'bg-amber-500/5 border border-amber-500/20 text-amber-400', badge: 'bg-amber-500/20 border border-amber-500/30 text-amber-400' },
                    7: { dot: 'bg-red-500', container: 'bg-red-500/5 border border-red-500/20 text-red-400', badge: 'bg-red-500/20 border border-red-500/30 text-red-400' },
                    8: { dot: 'bg-violet-500', container: 'bg-violet-500/5 border border-violet-500/20 text-violet-400', badge: 'bg-violet-500/20 border border-violet-500/30 text-violet-400' },
                    9: { dot: 'bg-teal-500', container: 'bg-teal-500/5 border border-teal-500/20 text-teal-400', badge: 'bg-teal-500/20 border border-teal-500/30 text-teal-400' },
                  };
                  return styles[fam] || { dot: 'bg-slate-500', container: 'bg-slate-500/5 border border-slate-500/20', badge: 'bg-slate-500/20 border border-slate-500/30 text-slate-400' };
                };

                const getJvClassification = (jv: number): string => {
                  if (jv < 1) return "FRACTURAMIENTO MUY BAJO";
                  if (jv <= 3) return "FRACTURAMIENTO BAJO";
                  if (jv <= 10) return "FRACTURAMIENTO MODERADO";
                  if (jv <= 30) return "FRACTURAMIENTO ALTO";
                  if (jv <= 60) return "FRACTURAMIENTO MUY ALTO";
                  return "MACIZO TRITURADO";
                };

                const activeFamiliesList = Array.from(new Set(activeWindow.joints.map(j => j.familia))).sort((a, b) => a - b);

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 select-none text-left animate-fade-in">

                    {/* Card 1: PROMEDIOS DE ESPACIAMIENTO */}
                    <div className="lg:col-span-3 glass-panel p-6 rounded-xl border border-navy-800 bg-navy-950/20 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest border-b border-navy-900 pb-2.5 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <BarChart3 size={16} className="text-slate-400" />
                            <span>PROMEDIOS DE ESPACIAMIENTO</span>
                          </span>
                          <span className="text-[10px] bg-orange-500/10 border border-orange-500/30 text-orange-400 font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wider">
                            {activeFamiliesList.length} FAMILIAS
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 font-semibold">
                          Promedio aritmético simple de los registros por familia: <code className="text-slate-400/80">Î£(esp) / N</code>
                        </p>
                      </div>

                      <div className="mt-4 overflow-y-auto pr-1 max-h-[175px] space-y-2.5">
                        {activeFamiliesList.map((famId) => {
                          const val = calculated?.familias_spacing[famId];
                          const displayVal = val !== undefined && val !== null ? val.toFixed(4) + ' m' : 'Sin datos';
                          const style = getFamilyStyle(famId);

                          return (
                            <div
                              key={famId}
                              className={`flex items-center justify-between p-3 rounded-lg hover:brightness-110 transition-all ${style.container}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${style.dot} shrink-0`} />
                                <span className="text-xs font-bold text-slate-300">Fam {famId}</span>
                              </div>
                              <span className={`text-xs font-black font-mono px-2 py-0.5 rounded border ${style.badge}`}>
                                {displayVal}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card 2: ÍNDICE VOLUMÉTRICO */}
                    <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-navy-800 bg-navy-950/20 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest border-b border-navy-900 pb-2.5 flex items-center gap-2">
                          <Layers size={16} className="text-yellow-500/80" />
                          <span>ÍNDICE VOLUMÉTRICO</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 font-semibold">
                          Conteo de discontinuidades volumétricas (Jv).
                        </p>
                      </div>

                      <div className="my-4 border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden text-center min-h-[110px]">
                        <span className="text-3xl font-black font-mono tracking-tight text-yellow-500">
                          {calculated ? calculated.jv.toFixed(4) : '—'}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider mt-1 text-slate-400">JTS / M³</span>
                        <Layers size={24} className="text-yellow-500/10 absolute right-4 top-1/2 -translate-y-1/2 shrink-0 stroke-[1.5]" />
                      </div>

                      <div className="mt-auto border border-yellow-500/20 bg-yellow-500/5 rounded-lg py-2 px-3 text-center">
                        <span className="text-xs font-extrabold text-yellow-500 uppercase tracking-widest">
                          {calculated ? getJvClassification(calculated.jv) : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Card 3: RQD ESTIMADO */}
                    <div className="lg:col-span-5 glass-panel p-6 rounded-xl border border-navy-800 bg-navy-950/20 flex flex-col justify-between shadow-lg relative overflow-hidden group">
                      <div>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest border-b border-navy-900 pb-2.5 flex items-center gap-2">
                          <Gauge size={16} className="text-sky-400" />
                          <span>RQD ESTIMADO</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 font-semibold">
                          Cálculo empírico según fórmula de Palmström: <code className="text-sky-400 font-bold bg-navy-900/60 px-1 py-0.5 rounded">115 - 3.3 · Jv</code>
                        </p>
                      </div>

                      <div className="my-4 border border-sky-500/30 bg-sky-500/5 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden text-center min-h-[110px]">
                        <span className="text-3xl font-black font-mono tracking-tight text-sky-400">
                          {calculated ? calculated.rqd_est.toFixed(2) : '—'}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider mt-1 text-slate-400">RQD ESTIMADO</span>
                        <Gauge size={24} className="text-sky-500/10 absolute right-4 top-1/2 -translate-y-1/2 shrink-0 stroke-[1.5]" />
                      </div>

                      <div className="space-y-3 mt-auto">
                        <div className="w-full bg-navy-950 rounded-full h-2.5 border border-navy-900 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.4)]"
                            style={{ width: `${calculated ? calculated.rqd_est : 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-extrabold uppercase tracking-wider px-0.5">
                          <span>MALA</span>
                          <span>REGULAR</span>
                          <span>EXCELENTE</span>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })()}

              {/* Comentarios y Fotografías Colapsable */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-navy-950/45 p-4 rounded-xl border border-navy-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg">
                      <BookOpen size={18} className="text-orange-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-100 uppercase tracking-widest">
                        Comentarios y Fotografías
                      </h4>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Registro de observaciones visuales y fotos de la celda
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCommentsExpanded(!isCommentsExpanded)}
                    className="px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-700/60 hover:bg-navy-850 text-slate-300 hover:text-orange-400 text-xs font-bold transition-all active:scale-95"
                  >
                    {isCommentsExpanded ? 'Ocultar Detalle' : 'Mostrar Detalle'}
                  </button>
                </div>

                {isCommentsExpanded && (
                  <CommentsPhotos
                    celda={activeWindow.header.celda}
                    comentario={activeWindow.header.comentario || ''}
                    onComentarioChange={(val) => {
                      setActiveWindow({
                        ...activeWindow,
                        header: {
                          ...activeWindow.header,
                          comentario: val
                        }
                      });
                    }}
                    photos={photos}
                    captions={captions}
                    onPhotosChange={handlePhotosChange}
                    apiBase={RESOLVED_API_BASE}
                  />
                )}
              </div>

              {/* ANÁLISIS GEOMECÁNICO RMR SIEMPRE EXPANDIDO */}
              <RmrAnalysis
                header={activeWindow.header}
                onChange={(header) => setActiveWindow({ ...activeWindow, header })}
                calculated={calculated}
                showFormulas={showFormulas} // Nueva Prop
              />
            </div>
          )}

          {currentView === 'grafico' && activeWindow && calculated && (
            <StructurePlot
              header={activeWindow.header}
              calculatedJoints={calculated.joints}
              largo={calculated.largo}
              showFormulas={showFormulas}
            />
          )}

          {currentView === 'plt_ensayos' && (
            <PltEnsayosView
              pltEnsayos={pltEnsayos}
              onChange={handlePltChange}
              activeWindowCelda={activeWindow?.header.celda || null}
              showFormulas={showFormulas}
              knownCells={knownCells}
              onImportToCell={handlePltImport}
            />
          )}

        </main>

        {/* 3. QA/QC VALIDATION PANEL */}
        {alerts.length > 0 && (activeWindow || currentView === 'plt_ensayos') && (
          <div className="absolute bottom-6 right-6 z-50">
            <ValidationPanel
              alerts={alerts}
              onFocusField={handleFocusField}
            />
          </div>
        )}
      </div>
      <ExcelImportModal
        isOpen={isImportModalOpen}
        apiBase={RESOLVED_API_BASE}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportToPending}
        existingCeldas={getAllKnownCellNames(windows.map(w => w.name))}
      />
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
          <div className="glass-panel w-full max-w-[72vw] max-h-[90vh] flex flex-col border border-navy-800 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/95">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500 w-full" />

            <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                    Catálogo de Referencia de Ventanas (RMR)
                  </h3>
                  <p className="text-xs text-slate-400">Guía de parámetros y ratings para clasificaciones RMR (Bieniawski)</p>
                </div>
              </div>
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-navy-950/20">
              <CatalogsView mode="ventanas" />
            </div>
          </div>
        </div>
      )}

      {isPltCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
          <div className="glass-panel w-full max-w-[95vw] max-h-[90vh] flex flex-col border border-navy-800 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/95">
            <div className="h-1.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 w-full" />

            <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                    Catálogo de Ensayos PLT y Litologías
                  </h3>
                  <p className="text-xs text-slate-400">Parámetros de resistencia de roca intacta y factores de correlación K</p>
                </div>
              </div>
              <button
                onClick={() => setIsPltCatalogModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-navy-950/20">
              <CatalogsView mode="plt" />
            </div>
          </div>
        </div>
      )}

      {/* Modales de Confirmación, Descarte y Resultados */}
      <SaveConfirmModal
        isOpen={showSaveConfirmModal}
        onClose={() => setShowSaveConfirmModal(false)}
        onConfirmSave={handleConfirmSave}
        activeWindow={activeWindow}
        workspaceDiff={workspaceDiff}
        pltDiff={pltDiffSummary}
        pltEnsayos={pltEnsayos}
        onOpenCatalogs={() => setIsCatalogModalOpen(true)}
        invalidPendingCells={getInvalidPendingCells()}
      />

      <DiscardModal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onConfirmDiscard={handleConfirmDiscard}
        activeWindow={activeWindow}
        workspaceDiff={workspaceDiff}
        localOnlyCells={getLocalOnlyPendingCells()}
      />

      <SaveResultModal
        isOpen={showSaveResultModal}
        onClose={() => setShowSaveResultModal(false)}
        savedCount={saveResultData.savedCount}
        totalEdits={saveResultData.totalEdits}
        totalJoints={saveResultData.totalJoints}
      />

      <RenameCellModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        currentCelda={activeWindow?.header?.celda || ''}
        existingCeldas={getAllKnownCellNames(windows.map(w => w.name))}
        onRename={handleRenameActiveCelda}
      />

      {/* Glassmorphic UI Loading Lock Overlay */}
      {isLoadingWindow && (
        <div className="fixed inset-0 z-[100] bg-navy-950/70 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-slate-100 pointer-events-auto select-none">
          <div className="p-6 bg-navy-900 border border-violet-500/30 rounded-2xl shadow-2xl flex flex-col items-center gap-3">
            <Loader2 size={40} className="text-violet-400 animate-spin" />
            <p className="text-xs font-black uppercase tracking-wider text-slate-100">Sincronizando ventanas con SQL Server...</p>
            <p className="text-[11px] text-slate-400 font-medium">Por favor espere a que finalice la transacción en la base de datos.</p>
          </div>
        </div>
      )}
    </div>
  );
}
