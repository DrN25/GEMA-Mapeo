import React, { useState, useRef, useMemo } from 'react';
import {
  X, FileSpreadsheet, Upload, Check, AlertTriangle, Loader,
  Settings, Table, CheckCircle, Search, ChevronDown, ChevronUp,
  Layers, Eye, AlertCircle, Info, RefreshCw
} from 'lucide-react';
import { getFieldPrecision } from '../../utils/numericPrecision';
import { getAuthHeaders } from '../../utils/apiClient';

// Formatea un valor con la precisión de display del SSOT (los decimales del
// Excel no deben verse crudos en el preview: generan desconfianza).
const fmtPrec = (key: string, val: any): string => {
  const n = Number(val);
  if (val === null || val === undefined || isNaN(n)) return '—';
  const dec = getFieldPrecision(key)?.display ?? 1;
  return n.toFixed(dec);
};

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:8001`
    : ''
);

// Tamaño máximo permitido por archivo Excel (MB).
// Nota: Render free tiene 512 MB de RAM; un xlsx se expande al descomprimirse,
// por lo que archivos > 100 MB pueden matar el proceso. Si notas OOM, baja este límite.
const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Item listo para importar como borrador pendiente (ya no se escribe directo en BD). */
export interface ImportedCellItem {
  codigo_original: string;
  codigo_final: string;
  excel_data: CellComparisonData;
  estructuras: EstructuraPreview[];
  /** true si el código final YA existe en la BD (del preview). Permite a la
   * app saltarse el GET de baseline para celdas nuevas (devolvía 404). */
  exists_in_db?: boolean;
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: ImportedCellItem[]) => void;
  apiBase?: string;
  /** Nombres de celdas existentes: BD del listado + borradores locales pendientes. */
  existingCeldas?: string[];
}

interface EstructuraPreview {
  numero_estructura: number;
  familia_id: number;
  tipo_estructura: string;
  dip: number;
  dip_dir: number;
  distancia_m?: number;
  abertura_mm?: number;
  espesor_mm?: number;
  continuidad_m?: number;
  espaciamiento_m?: number;
  n_estructuras?: number;
  n_extremos_visibles?: number;
  relleno_1_codigo?: string;
  relleno_2_codigo?: string;
  jrc?: number;
  rugosidad_codigo?: string;
  forma_estructura?: string;
  alteracion_codigo?: string;
}

interface CellComparisonData {
  codigo: string;
  campania: any;
  sector: string;
  este_ini: number;
  norte_ini: number;
  cota_ini: number;
  este_fin: number;
  norte_fin: number;
  cota_fin: number;
  largo_m: number;
  altura_m: number;
  lito_1: string;
  lito_2: string;
  lito_3: string;
  unidad_litologica?: string;
  mapeador: string;
  fecha: string;
  n_discontinuidades: number;
  rmr_76?: number;
  rmr_89?: number;
}

interface CeldaItem {
  codigo: string;
  codigoEdited?: string;
  is_duplicate: boolean;
  excel_data: CellComparisonData;
  existing_data?: CellComparisonData | null;
  estructuras: EstructuraPreview[];
}

type Step = 'select' | 'preview' | 'done';

const formatCampania = (val: any) => {
  if (!val) return 'Campaña 2026';
  const str = String(val).trim();
  if (str.includes('T') || str.includes('-')) {
    const year = str.slice(0, 4);
    if (/^\d{4}$/.test(year)) return `Campaña ${year}`;
  }
  if (/^\d{4}$/.test(str)) return `Campaña ${str}`;
  if (!str.toLowerCase().includes('campa')) return `Campaña ${str}`;
  return str;
};

export default function ExcelImportModal({ isOpen, onClose, onImport, apiBase, existingCeldas = [] }: ExcelImportModalProps) {
  const apiBaseUrl = apiBase || DEFAULT_API_BASE;

  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  // TEMPORALMENTE DESACTIVADO: Selector de modo de importación oculto de la interfaz.
  // La importación siempre opera en modo automático ('auto').
  // const [mode, setMode] = useState<'auto' | 'estaciones' | 'bd'>('auto');
  const mode: 'auto' = 'auto';
  // TEMPORALMENTE DESACTIVADO: Tab de formato (BD / Estaciones) oculto de la interfaz.
  // const [activeTab, setActiveTab] = useState<'bd' | 'estaciones'>('bd');

  // Preview States
  const [celdas, setCeldas] = useState<CeldaItem[]>([]);
  const [columnsDetected, setColumnsDetected] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [editedNames, setEditedNames] = useState<Record<string, string>>({});
  // Todos los códigos existentes en BD (los devuelve el preview): sirven
  // para detectar si un nombre RENOMBRADO colisiona con otra celda que no
  // venía en el Excel importado.
  const [existingCodes, setExistingCodes] = useState<string[]>([]);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [showMappingAccordion, setShowMappingAccordion] = useState(false);

  // Duplicate Comparison Sub-Modal State
  const [comparingCelda, setComparingCelda] = useState<CeldaItem | null>(null);

  // Double Confirmation Modal State
  const [showDoubleConfirmModal, setShowDoubleConfirmModal] = useState(false);

  // Status States
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ventanas: number; estructuras: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetsLoading, setSheetsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Códigos que YA EXISTEN en el sistema (los devolvió el preview = BD,
  // más los marcados como duplicados del Excel, más los borradores locales
  // pendientes que aporta la app): sirven para detectar si un nombre RENOMBRADO
  // colisiona con otra celda (de BD o borrador local).
  const existingDbCodes = useMemo(() => {
    const set = new Set<string>(
      (existingCodes || []).map(c => c.trim().toUpperCase())
    );
    celdas.filter(c => c.is_duplicate).forEach(c => {
      set.add(c.codigo.trim().toUpperCase());
    });
    (existingCeldas || []).forEach(c => {
      set.add(c.trim().toUpperCase());
    });
    return set;
  }, [existingCodes, celdas, existingCeldas]);

  // Una celda es duplicada si su NOMBRE FINAL (con renombrado aplicado)
  // coincide con algún código existente en BD. Si el usuario renombró la
  // celda a un código nuevo, deja de ser duplicada.
  const isDuplicateFinal = (c: CeldaItem): boolean => {
    const finalName = (editedNames[c.codigo] || c.codigo).trim().toUpperCase();
    return existingDbCodes.has(finalName);
  };

  // Códigos que existen en BD (los devuelve el preview del backend).
  const bdCodes = useMemo(
    () => new Set((existingCodes || []).map(c => c.trim().toUpperCase())),
    [existingCodes]
  );

  // Duplicados seleccionados agrupados por el origen de la colisión:
  //  - enBd: el nombre final ya existe en la base de datos (se actualizará al guardar)
  //  - soloLocal: el nombre final solo existe como borrador local (se reemplazará y el
  //    borrador manual se pierde)
  const selectedDuplicates = celdas.filter(c => selectedCodes.has(c.codigo) && isDuplicateFinal(c));
  const duplicateGroups = useMemo(() => {
    const enBd: string[] = [];
    const soloLocal: string[] = [];
    for (const c of selectedDuplicates) {
      const finalName = (editedNames[c.codigo] || c.codigo).trim().toUpperCase();
      if (bdCodes.has(finalName)) {
        enBd.push(finalName);
      } else {
        soloLocal.push(finalName);
      }
    }
    return { enBd, soloLocal };
  }, [selectedDuplicates, editedNames, bdCodes]);

  if (!isOpen) return null;

  // Validaciones previas al botón "Procesar Excel"
  const fileTooBig = file ? file.size > MAX_FILE_SIZE_BYTES : false;
  const sheetsReady = !!file && !fileTooBig && !sheetsLoading && sheets.length > 0 && !!selectedSheet;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setCeldas([]);
      setSelectedCodes(new Set());
      setEditedNames({});
      setExistingCodes([]);
      setError(null);
      setStep('select');
      // Limpiar el estado de hojas SÍNCRONAMENTE para evitar que se vea
      // la hoja del archivo anterior durante la carga.
      setSheets([]);
      setSelectedSheet('');

      // Validación de tamaño: si excede el límite, no intentar listar hojas.
      if (f.size > MAX_FILE_SIZE_BYTES) {
        setSheetsLoading(false);
        return;
      }

      // Listar las hojas en el BACKEND (openpyxl read_only — streaming,
      // no descomprime el libro completo). Parsear el Excel en el
      // navegador (SheetJS) tarda minutos en archivos grandes.
      setSheetsLoading(true);
      const fd = new FormData();
      fd.append('file', f);
      fetch(`${apiBaseUrl}/api/importar-excel/hojas`, { method: 'POST', headers: getAuthHeaders(), body: fd })
        .then(res => res.json().catch(() => null))
        .then(data => {
          const names = data?.hojas || [];
          setSheets(names);
          setSelectedSheet(names[0] || '');
        })
        .catch(err => {
          console.warn("No se pudieron leer las hojas del Excel:", err);
          setSheets([]);
          setSelectedSheet('');
        })
        .finally(() => {
          setSheetsLoading(false);
        });
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const targetUrl = `${apiBaseUrl}/api/importar-excel/preview?formato=${mode}${selectedSheet ? `&hoja=${encodeURIComponent(selectedSheet)}` : ''}`;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(targetUrl, { method: 'POST', headers: getAuthHeaders(), body: formData });
      const data = await res.json().catch(() => null);

      if (res.ok && data && data.status === 'success') {
        setCeldas(data.celdas || []);
        setColumnsDetected(data.columns_detected || []);
        setColumnMapping(data.mapping_detected || {});
        setExistingCodes(data.existing_codes || []);

        const initialSelected = new Set<string>((data.celdas || []).map((c: CeldaItem) => c.codigo));
        setSelectedCodes(initialSelected);

        const initNames: Record<string, string> = {};
        (data.celdas || []).forEach((c: CeldaItem) => {
          initNames[c.codigo] = c.codigo;
        });
        setEditedNames(initNames);

        setStep('preview');
      } else {
        const detailMsg = data?.detail;
        const errorMsg = typeof detailMsg === 'string'
          ? detailMsg
          : (Array.isArray(detailMsg)
            ? detailMsg.map((e: any) => e.msg || JSON.stringify(e)).join(', ')
            : (detailMsg ? JSON.stringify(detailMsg) : `Error HTTP ${res.status}: No se pudo procesar la plantilla Excel.`));
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error("Error al previsualizar Excel:", err);
      setError(`Error de comunicación con el servidor backend (${targetUrl}). Verifique que el servicio esté activo.`);
    } finally {
      setLoading(false);
    }
  };

  // Botón Principal Importar -> Revisa si hay duplicados antes de aceptar
  const handleInitiateImport = () => {
    if (selectedCodes.size === 0) return;

    const duplicatesSelected = celdas.filter(c => selectedCodes.has(c.codigo) && isDuplicateFinal(c));

    if (duplicatesSelected.length > 0) {
      setShowDoubleConfirmModal(true);
    } else {
      executeImport();
    }
  };

  /**
   * Fase 2: ya NO se escribe directo en la BD. Las celdas se entregan a la app
   * como borradores pendientes; el guardado (GUARDAR CAMBIOS) las sube después
   * de QA/QC y verificación de colisiones.
   */
  const executeImport = () => {
    if (selectedCodes.size === 0) return;
    setImporting(true);
    setError(null);
    setShowDoubleConfirmModal(false);

    try {
      const existingSet = new Set(existingCodes.map(c => String(c).trim().toUpperCase()));
      const itemsToImport: ImportedCellItem[] = celdas
        .filter(c => selectedCodes.has(c.codigo))
        .map(c => {
          const codigo_final = (editedNames[c.codigo] || c.codigo).trim().toUpperCase();
          return {
            codigo_original: c.codigo,
            codigo_final,
            excel_data: c.excel_data,
            estructuras: c.estructuras,
            exists_in_db: existingSet.has(codigo_final)
          };
        });

      onImport(itemsToImport);
      setImportResult({
        ventanas: itemsToImport.length,
        estructuras: itemsToImport.reduce((acc, i) => acc + (i.estructuras?.length || 0), 0)
      });
      setStep('done');
    } catch (err: any) {
      setError(`Error al preparar la importación: ${err?.message || err}`);
    } finally {
      setImporting(false);
    }
  };

  const resetAndStartOver = () => {
    setStep('select');
    setFile(null);
    setSheets([]);
    setSelectedSheet('');
    setCeldas([]);
    setSelectedCodes(new Set());
    setEditedNames({});
    setExistingCodes([]);
    setError(null);
    setSearchQuery('');
    setComparingCelda(null);
    setShowDoubleConfirmModal(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredCeldas = celdas.filter(c => {
    const code = editedNames[c.codigo] || c.codigo;
    return code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.excel_data.sector || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.excel_data.mapeador || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const toggleSelectAll = () => {
    if (selectedCodes.size === filteredCeldas.length) {
      setSelectedCodes(new Set());
    } else {
      setSelectedCodes(new Set(filteredCeldas.map(c => c.codigo)));
    }
  };

  const isAllSelected = filteredCeldas.length > 0 && selectedCodes.size === filteredCeldas.length;

  // Renderizado de Pantalla de Éxito
  if (step === 'done') {
    return (
      <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
        <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-navy-800 shadow-2xl bg-navy-900/95 text-center relative overflow-hidden">
          <div className="h-1.5 bg-emerald-500 w-full absolute top-0 left-0" />
          <CheckCircle size={52} className="mx-auto text-emerald-400 mb-4" />
          <h3 className="text-xl font-black text-slate-100 uppercase tracking-wider">Importación Completada</h3>
          <p className="text-xs text-slate-300 mt-2 font-medium">
            Se añadieron <strong className="text-emerald-400">{importResult?.ventanas || 0} celdas</strong> y <strong className="text-indigo-400">{importResult?.estructuras || 0} estructuras</strong> como borradores pendientes.
          </p>
          <p className="text-xs text-slate-500 mt-1">Revise los datos y use el botón <strong>GUARDAR CAMBIOS</strong> para subirlos a la base de datos SQL Server.</p>
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={resetAndStartOver}
              className="bg-navy-950 border border-navy-800 hover:bg-navy-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
              <FileSpreadsheet size={14} /> Importar otro archivo
            </button>
            <button onClick={onClose}
              className="bg-emerald-500 hover:bg-emerald-600 text-navy-950 font-black px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg flex items-center gap-1.5">
              <Check size={14} /> Finalizar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-5xl p-6 rounded-2xl border border-navy-800 shadow-2xl bg-navy-900/95 relative overflow-hidden max-h-[92vh] flex flex-col">
        <div className="h-1.5 bg-indigo-500 w-full absolute top-0 left-0 shrink-0" />

        {/* Cabecera Principal */}
        <div className="flex items-center justify-between border-b border-navy-800 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-100 tracking-wider uppercase">
                {step === 'preview' ? `Previsualización de Excel (${celdas.length} Celdas Encontradas)` : 'Importación de Celdas de Mapeo Geomecánico'}
              </h3>
              <p className="text-xs text-slate-400">
                {step === 'preview' ? 'Seleccione las celdas a guardar, mapee columnas y resuelva duplicados.' : `Cargue un archivo Excel de mapeo geomecánico. (Límite Máximo: ${MAX_FILE_SIZE_MB} Mb.)`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* PASO 1: SELECCIÓN DE ARCHIVO Y MODO */}
        {step === 'select' && (
          <div className="space-y-5 pt-4">
            {/* TEMPORALMENTE DESACTIVADO: Selector de Modo de Importación.
                La importación siempre funciona en modo automático ('auto'),
                por lo que este bloque permanece comentado.
            {/*
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">Modo de Importación</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('auto')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    mode === 'auto'
                      ? 'bg-indigo-600/20 border-indigo-500 text-slate-100 shadow-md ring-1 ring-indigo-500/50'
                      : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:bg-navy-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Automático</span>
                    <span className="text-xs bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded">Recomendado</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Detecta automáticamente la estructura del archivo.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('bd')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    mode === 'bd'
                      ? 'bg-emerald-600/20 border-emerald-500 text-slate-100 shadow-md ring-1 ring-emerald-500/50'
                      : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:bg-navy-800/50'
                  }`}
                >
                  <span className="text-xs font-bold block text-emerald-400">Base de Datos (Excel B)</span>
                  <p className="text-xs text-slate-500 mt-1">Formato compilado con herencia de cabecera ffill.</p>
                </button>

                <button
                  type="button"
                  disabled
                  className="p-3 rounded-xl border border-navy-800/40 bg-navy-950/30 text-slate-600 cursor-not-allowed opacity-60 text-left relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Estaciones (Excel A)</span>
                    <span className="text-xs bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded">Próximamente</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">Formato de estaciones de mapeo individual.</p>
                </button>
              </div>
            </div>
            */}

            {/* Zona Dropzone para Cargar Archivo */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-navy-700 hover:border-indigo-500/70 rounded-2xl p-10 text-center cursor-pointer transition-all bg-navy-950/40 hover:bg-navy-950/80 group"
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
              {file ? (
                <div className="space-y-2">
                  <FileSpreadsheet size={40} className="mx-auto text-emerald-400 transition-transform" />
                  <p className="text-sm font-bold text-slate-100">{file.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{(file.size / 1024).toFixed(1)} KB — Listo para procesar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload size={40} className="mx-auto text-slate-500 group-hover:text-indigo-400 transition-all" />
                  <p className="text-sm font-semibold text-slate-300">Haga clic o arrastre su archivo Excel aquí</p>
                  <p className="text-xs text-slate-500">Soporta plantillas <strong className="text-slate-400">.xlsx</strong> y <strong className="text-slate-400">.xls</strong></p>
                </div>
              )}
            </div>

            {/* Selección de Hoja del Libro (siempre visible, deshabilitado sin archivo) */}
            <div className={`p-4 rounded-xl border transition-all ${file ? 'bg-navy-950/60 border-indigo-500/40' : 'bg-navy-950/30 border-navy-800/60'}`}>
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="flex items-center gap-2 text-xs font-black text-slate-300 uppercase tracking-wider">
                  <Table size={14} className={file ? 'text-indigo-400' : 'text-slate-600'} />
                  <span>Seleccionar Hoja del Excel</span>
                </div>
                {file && !fileTooBig && sheets.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    {sheets.length} hoja{sheets.length !== 1 ? 's' : ''} detectada{sheets.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {file ? (
                fileTooBig ? (
                  <div className="flex items-start gap-2 text-xs text-rose-400/90 leading-relaxed">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>
                      El archivo supera el límite de <strong>{MAX_FILE_SIZE_MB} MB</strong> permitido.
                      Elija otro Excel o separe el archivo en partes que solo contengan las hojas que necesita.
                    </span>
                  </div>
                ) : sheetsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-amber-400/90">
                    <Loader size={14} className="animate-spin" />
                    <span>Leyendo hojas del archivo...</span>
                  </div>
                ) : sheets.length > 0 ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <select
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className="flex-1 min-w-[220px] bg-navy-900 border border-indigo-500/40 rounded-lg px-3 py-2 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                    >
                      {sheets.map(s => (
                        <option key={s} value={s} className="bg-navy-950 text-slate-200">{s}</option>
                      ))}
                    </select>
                    <span className="text-[11px] text-slate-400 font-medium leading-snug">
                      El formato del archivo se detecta automáticamente al procesar.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-xs text-rose-400/90 leading-relaxed">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>No se pudieron leer las hojas del archivo. Intente con otro Excel.</span>
                  </div>
                )
              ) : (
                <p className="text-xs text-slate-500 font-medium">
                  Cargue primero un archivo Excel para seleccionar la hoja que desea procesar.
                </p>
              )}
            </div>

            {error && (
              <div className="p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2 bg-red-500/10 border-red-500/30 text-red-400">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Acciones del Paso 1 */}
            <div className="flex gap-2.5 justify-end pt-3 border-t border-navy-800">
              <button onClick={onClose} className="bg-navy-950 border border-navy-800 hover:bg-navy-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all">
                Cancelar
              </button>
              <button
                onClick={handlePreview}
                disabled={!sheetsReady || loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg"
              >
                {loading ? <Loader size={15} className="animate-spin" /> : <Table size={15} />}
                {loading ? 'Analizando Excel...' : 'Procesar Excel'}
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: PREVISUALIZACIÓN Y SELECCIÓN DE CELDAS */}
        {step === 'preview' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3 pt-3">
            {/* Zona de Información de Mapeo de Columnas */}
            <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <Info size={18} className="text-indigo-400 shrink-0" />
                <span>
                  Para consultar o personalizar la correspondencia de los encabezados de su archivo Excel, acceda a la opción <strong>Mapeo de Columnas</strong>.
                </span>
              </div>
            </div>

            {/* Tabs de Formato + Buscador + Acordeón Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* TEMPORALMENTE DESACTIVADO: Tabs de formato (BD / Estaciones).
                  La importación siempre opera en modo automático.
              {/*
              <div className="flex bg-navy-950 p-1 rounded-xl border border-navy-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('bd')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'bd' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers size={13} />
                  <span>Base de Datos (BD) ({celdas.length})</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="px-3 py-1.5 rounded-lg font-bold text-slate-600 cursor-not-allowed opacity-60 flex items-center gap-1.5"
                >
                  <span>Estaciones (Excel A)</span>
                  <span className="text-xs bg-navy-900 text-slate-500 px-1.5 py-0.5 rounded">Próximamente</span>
                </button>
              </div>
              */}

              {/* Controles de Búsqueda y Mapeo */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar celda o sector..."
                    className="bg-navy-950 border border-navy-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52 font-semibold"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowMappingAccordion(!showMappingAccordion)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${showMappingAccordion
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                    : 'bg-navy-950 border-navy-800 text-slate-400 hover:bg-navy-800'
                    }`}
                >
                  <Settings size={13} />
                  <span>Mapeo de Columnas</span>
                  {showMappingAccordion ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </div>

            {/* Acordeón Desplegable de Mapeo de Columnas */}
            {showMappingAccordion && (
              <div className="p-3 bg-navy-950/80 border border-navy-800 rounded-xl space-y-2 shrink-0 animate-fade-in max-h-40 overflow-y-auto">
                <div className="flex items-center justify-between pb-1 border-b border-navy-800/80">
                  <span className="text-xs font-black uppercase text-purple-400 tracking-wider">Configuración de Equivalencia de Columnas Excel</span>
                  <span className="text-xs text-slate-500">Ajuste si los encabezados de su Excel difieren</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(columnMapping).map(([sysKey, excelCol]) => (
                    <div key={sysKey} className="space-y-0.5">
                      <label className="text-xs font-bold text-slate-400 block truncate">{sysKey}</label>
                      <select
                        value={excelCol}
                        onChange={(e) => setColumnMapping(prev => ({ ...prev, [sysKey]: e.target.value }))}
                        className="w-full bg-navy-900 border border-navy-700/80 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      >
                        {columnsDetected.map(c => (
                          <option key={c} value={c} className="bg-navy-950 text-slate-200">{c}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Barra de estado de Selección */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 shrink-0">
              <span>
                Seleccionadas: <strong className="text-slate-100 font-mono">{selectedCodes.size}</strong> de {filteredCeldas.length} celdas
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {isAllSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </button>
            </div>

            {/* Tabla Principal de Previsualización de Celdas */}
            <div className="flex-1 overflow-y-auto min-h-0 rounded-xl border border-navy-800 bg-navy-950/40">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-xs text-slate-400 font-black uppercase tracking-wider border-b border-navy-800 bg-navy-900/80 sticky top-0 z-10">
                    <th className="py-2.5 px-2 w-8 text-center">
                      <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} className="accent-indigo-500 w-3.5 h-3.5" />
                    </th>
                    <th className="py-2.5 px-3 text-left">Código Celda</th>
                    <th className="py-2.5 px-3 text-left">Sector</th>
                    <th className="py-2.5 px-3 text-right">Este / Norte / Cota</th>
                    <th className="py-2.5 px-3 text-center">Estructuras</th>
                    <th className="py-2.5 px-3 text-left">Mapeador</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/50 text-slate-300">
                  {filteredCeldas.map(c => {
                    const isSelected = selectedCodes.has(c.codigo);
                    const currentName = editedNames[c.codigo] || c.codigo;
                    const isRenamed = currentName !== c.codigo;

                    return (
                      <tr
                        key={c.codigo}
                        className={`hover:bg-navy-900/30 transition-colors ${isSelected ? 'bg-indigo-500/[0.04]' : ''}`}
                      >
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const next = new Set(selectedCodes);
                              if (next.has(c.codigo)) next.delete(c.codigo);
                              else next.add(c.codigo);
                              setSelectedCodes(next);
                            }}
                            className="accent-indigo-500 w-3.5 h-3.5 cursor-pointer"
                          />
                        </td>

                        {/* Código de celda editable */}
                        <td className="py-2.5 px-3 font-bold">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={currentName}
                              onChange={(e) => setEditedNames(prev => ({ ...prev, [c.codigo]: e.target.value.toUpperCase() }))}
                              className="bg-navy-900 border border-navy-700/80 rounded px-2 py-1 text-xs text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 w-28 uppercase"
                            />
                            {isRenamed && (
                              <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">Renombrado</span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-slate-400 font-semibold">{c.excel_data.sector}</td>

                        <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-400">
                          {fmtPrec('este_from', c.excel_data.este_ini)} / {fmtPrec('norte_from', c.excel_data.norte_ini)} / {fmtPrec('cota_from', c.excel_data.cota_ini)}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold text-xs">
                            {c.estructuras.length} est.
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-slate-300 font-medium">{c.excel_data.mapeador}</td>

                        {/* Badge de Estado en Base de Datos (evaluado con el nombre final) */}
                        <td className="py-2.5 px-3 text-center">
                          {isDuplicateFinal(c) ? (
                            <button
                              type="button"
                              onClick={() => setComparingCelda(c)}
                              className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-400 font-bold text-xs hover:bg-amber-500/20 transition-all flex items-center gap-1 mx-auto"
                            >
                              <AlertTriangle size={12} />
                              <span>Posible Duplicado</span>
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
                              Nueva Celda
                            </span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setComparingCelda(c)}
                            className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-indigo-300 transition-all"
                            title="Ver detalles y comparar"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 bg-red-500/10 border-red-500/30 text-red-400 shrink-0">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Acciones del Paso 2 */}
            <div className="flex gap-2.5 justify-end pt-3 border-t border-navy-800 shrink-0">
              <button
                type="button"
                onClick={resetAndStartOver}
                className="bg-navy-950 border border-navy-800 hover:bg-navy-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleInitiateImport}
                disabled={selectedCodes.size === 0 || importing}
                className="bg-emerald-500 hover:bg-emerald-600 text-navy-950 font-black px-5 py-2 rounded-xl text-xs flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg"
              >
                {importing ? <Loader size={15} className="animate-spin" /> : <Upload size={15} />}
                {importing ? 'Guardando...' : `Importar ${selectedCodes.size} Celdas Seleccionadas`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SUB-MODAL DE DOBLE CONFIRMACIÓN DE CELDAS DUPLICADAS */}
      {showDoubleConfirmModal && (
        <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-xl p-6 rounded-2xl border border-amber-500/40 shadow-2xl bg-navy-900/95 relative overflow-hidden flex flex-col space-y-4">
            <div className="h-1.5 bg-amber-500 w-full absolute top-0 left-0" />

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                  Celdas con el mismo nombre encontradas
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Importarás <strong className="text-amber-400">{selectedDuplicates.length} celda(s)</strong> que ya
                  tienen una celda con el mismo nombre. Al guardar, su contenido
                  <strong> será reemplazado</strong> por el del archivo Excel.
                </p>
              </div>
            </div>

            {/* Celdas que colisionan con la BD */}
            {duplicateGroups.enBd.length > 0 && (
              <div className="p-3 bg-navy-950/80 border border-indigo-500/30 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block">
                  Ya existen en la base de datos ({duplicateGroups.enBd.length})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {duplicateGroups.enBd.map(n => (
                    <span key={n} className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono font-bold text-[11px] border border-indigo-500/30">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Celdas que colisionan con un borrador local */}
            {duplicateGroups.soloLocal.length > 0 && (
              <div className="p-3 bg-navy-950/80 border border-amber-500/30 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                  Ya existen como borrador local (aún no están en la base de datos) ({duplicateGroups.soloLocal.length})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {duplicateGroups.soloLocal.map(n => (
                    <span key={n} className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold text-[11px] border border-amber-500/30">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Explicación clara de lo que pasará */}
            {duplicateGroups.enBd.length > 0 && (
              <p className="text-xs text-slate-300 leading-relaxed">
                Al importar y presionar <strong>GUARDAR CAMBIOS</strong>, los datos actuales de
                estas celdas <strong>en la base de datos se reemplazarán</strong> con los del
                archivo Excel.
              </p>
            )}
            {duplicateGroups.soloLocal.length > 0 && (
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Estas celdas solo existen como <strong>borrador local</strong> (aún no están en la
                base de datos). Al importar, el borrador <strong>se reemplazará</strong> con los
                datos del Excel y <strong>los cambios que tenías en el borrador se perderán</strong>.
                Si quieres conservarlos, renombra la celda del Excel antes de importar.
              </p>
            )}

            {/* Opciones de Acción */}
            <div className="grid grid-cols-1 gap-3">
              {/* Opción 1: Importar y reemplazar las existentes */}
              <button
                type="button"
                onClick={() => executeImport()}
                className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-left transition-all group flex items-start gap-3"
              >
                <RefreshCw size={18} className="text-amber-400 shrink-0 mt-0.5 group-hover:rotate-180 transition-transform duration-500" />
                <div>
                  <span className="text-xs font-black text-amber-300 block uppercase tracking-wider">
                    Importar y reemplazar {selectedDuplicates.length > 0 ? `(${selectedDuplicates.length} celda(s))` : ''}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Las celdas se añaden como BORRADOR con los datos del archivo. Al presionar
                    GUARDAR CAMBIOS, el contenido actual de cada celda con el mismo nombre
                    (en la base de datos o como borrador local) será reemplazado por el del Excel.
                  </p>
                </div>
              </button>
            </div>

            {/* Botón Volver */}
            <div className="flex justify-end pt-2 border-t border-navy-800">
              <button
                type="button"
                onClick={() => setShowDoubleConfirmModal(false)}
                className="bg-navy-950 border border-navy-800 hover:bg-navy-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                Volver a la Previsualización (Renombrar manualmente)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL DE COMPARACIÓN LADO A LADO (DUPLICADOS) */}
      {comparingCelda && (
        <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-4xl p-6 rounded-2xl border border-navy-800 shadow-2xl bg-navy-900/95 relative overflow-hidden flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-400" />
                <h4 className="text-sm font-black text-slate-100 tracking-wider uppercase">
                  Comparación de Celda Duplicada: <strong className="text-amber-400">{comparingCelda.codigo}</strong>
                </h4>
              </div>
              <button onClick={() => setComparingCelda(null)} className="p-1 rounded-lg hover:bg-navy-800 text-slate-400">
                <X size={16} />
              </button>
            </div>

            {/* Tarjetas Lado a Lado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tarjeta Izquierda: Base de Datos SQL Server */}
              <div className="p-4 rounded-xl border border-navy-800 bg-navy-950/80 space-y-2">
                <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                  <span className="text-xs font-black text-slate-300 uppercase tracking-wider">Registrado en BD SQL Server</span>
                  {comparingCelda.existing_data ? (
                    <span className="text-xs bg-indigo-500/20 text-indigo-300 font-bold px-2.5 py-0.5 rounded">Existente</span>
                  ) : (
                    <span className="text-xs bg-slate-800 text-slate-500 font-bold px-2.5 py-0.5 rounded">No Existe</span>
                  )}
                </div>

                {comparingCelda.existing_data ? (
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between py-1 border-b border-navy-900">
                      <span className="text-slate-500">Campaña:</span>
                      <span className="font-bold text-slate-200">{formatCampania(comparingCelda.existing_data.campania)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-navy-900">
                      <span className="text-slate-500">Sector Geotécnico:</span>
                      <span className="font-bold">{comparingCelda.existing_data.sector}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-navy-900">
                      <span className="text-slate-500">Coordenadas Iniciales:</span>
                      <span className="font-mono">{fmtPrec('este_from', comparingCelda.existing_data.este_ini)} / {fmtPrec('norte_from', comparingCelda.existing_data.norte_ini)} / {fmtPrec('cota_from', comparingCelda.existing_data.cota_ini)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-navy-900">
                      <span className="text-slate-500">Largo / Altura:</span>
                      <span className="font-bold">{fmtPrec('largo', comparingCelda.existing_data.largo_m)} m / {fmtPrec('altura', comparingCelda.existing_data.altura_m)} m</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-navy-900">
                      <span className="text-slate-500">Litologías (1/2/3):</span>
                      <span className="font-bold">{comparingCelda.existing_data.lito_1} / {comparingCelda.existing_data.lito_2 || '-'} / {comparingCelda.existing_data.lito_3 || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-navy-900">
                      <span className="text-slate-500">Mapeador:</span>
                      <span className="font-bold">{comparingCelda.existing_data.mapeador}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-navy-900">
                      <span className="text-slate-500">Estructuras Registradas:</span>
                      <span className="font-bold text-indigo-400">{comparingCelda.existing_data.n_discontinuidades} est.</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-6 text-center">Esta celda es totalmente nueva en el sistema.</p>
                )}
              </div>

              {/* Tarjeta Derecha: Excel Entrante */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/10 space-y-2">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">Datos en Excel Entrante</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded">A Importar</span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-navy-900">
                    <span className="text-slate-500">Campaña:</span>
                    <span className="font-bold text-emerald-300">{formatCampania(comparingCelda.excel_data.campania)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-navy-900">
                    <span className="text-slate-500">Sector Geotécnico:</span>
                    <span className="font-bold">{comparingCelda.excel_data.sector}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-navy-900">
                    <span className="text-slate-500">Coordenadas Iniciales:</span>
                    <span className="font-mono">{fmtPrec('este_from', comparingCelda.excel_data.este_ini)} / {fmtPrec('norte_from', comparingCelda.excel_data.norte_ini)} / {fmtPrec('cota_from', comparingCelda.excel_data.cota_ini)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-navy-900">
                    <span className="text-slate-500">Largo / Altura:</span>
                    <span className="font-bold">{fmtPrec('largo', comparingCelda.excel_data.largo_m)} m / {fmtPrec('altura', comparingCelda.excel_data.altura_m)} m</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-navy-900">
                    <span className="text-slate-500">Litologías (1/2/3):</span>
                    <span className="font-bold">{comparingCelda.excel_data.lito_1} / {comparingCelda.excel_data.lito_2 || '-'} / {comparingCelda.excel_data.lito_3 || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-navy-900">
                    <span className="text-slate-500">Mapeador:</span>
                    <span className="font-bold">{comparingCelda.excel_data.mapeador}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-navy-900">
                    <span className="text-slate-500">Estructuras en Excel:</span>
                    <span className="font-bold text-emerald-400">{comparingCelda.excel_data.n_discontinuidades} est.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-400" />
              <span>
                <strong>Recomendación:</strong> Si esta celda representa un levantamiento distinto de la celda en BD, puede modificar su código en la tabla (ej. <strong className="text-white">{comparingCelda.codigo}_2026</strong>) para registrarla independientemente sin sobreescribir.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setComparingCelda(null)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
