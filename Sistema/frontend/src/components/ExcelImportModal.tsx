import React, { useState, useRef } from 'react';
import {
  X, FileSpreadsheet, Upload, Check, AlertTriangle, Loader,
  Settings, Table, CheckCircle, Search, ChevronDown, ChevronUp,
  Layers, Eye, AlertCircle, Info, RefreshCw, PlusCircle
} from 'lucide-react';

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8001`;

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (cellCodes: string[]) => void;
  apiBase?: string;
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

export default function ExcelImportModal({ isOpen, onClose, onImport, apiBase }: ExcelImportModalProps) {
  const apiBaseUrl = apiBase || DEFAULT_API_BASE;

  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'auto' | 'estaciones' | 'bd'>('auto');
  const [activeTab, setActiveTab] = useState<'bd' | 'estaciones'>('bd');

  // Preview States
  const [celdas, setCeldas] = useState<CeldaItem[]>([]);
  const [columnsDetected, setColumnsDetected] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [editedNames, setEditedNames] = useState<Record<string, string>>({});

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setCeldas([]);
      setSelectedCodes(new Set());
      setEditedNames({});
      setError(null);
      setStep('select');
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const targetUrl = `${apiBaseUrl}/api/importar-excel/preview?formato=${mode}`;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(targetUrl, { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);

      if (res.ok && data && data.status === 'success') {
        setCeldas(data.celdas || []);
        setColumnsDetected(data.columns_detected || []);
        setColumnMapping(data.mapping_detected || {});

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

  // Botón Principal Importar -> Revisa si hay duplicados antes de guardar
  const handleInitiateImport = () => {
    if (selectedCodes.size === 0) return;

    const duplicatesSelected = celdas.filter(c => selectedCodes.has(c.codigo) && c.is_duplicate);

    if (duplicatesSelected.length > 0) {
      setShowDoubleConfirmModal(true);
    } else {
      executeImport(true);
    }
  };

  const executeImport = async (overwriteDuplicates: boolean) => {
    if (selectedCodes.size === 0) return;
    setImporting(true);
    setError(null);
    setShowDoubleConfirmModal(false);

    const targetUrl = `${apiBaseUrl}/api/importar-excel/ejecutar`;

    try {
      const itemsToImport = celdas
        .filter(c => selectedCodes.has(c.codigo))
        .map(c => ({
          codigo_original: c.codigo,
          codigo_final: (editedNames[c.codigo] || c.codigo).trim().toUpperCase(),
          excel_data: c.excel_data,
          estructuras: c.estructuras
        }));

      const payload = {
        celdas: itemsToImport,
        column_mapping: columnMapping,
        overwrite_duplicates: overwriteDuplicates
      };

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data && data.status === 'success') {
        setImportResult({
          ventanas: data.ventanas_importadas,
          estructuras: data.estructuras_importadas
        });
        setStep('done');
        onImport(itemsToImport.map(i => i.codigo_final));
      } else {
        const detailMsg = data?.detail;
        const errorMsg = typeof detailMsg === 'string'
          ? detailMsg
          : (Array.isArray(detailMsg)
              ? detailMsg.map((e: any) => e.msg || JSON.stringify(e)).join(', ')
              : (detailMsg ? JSON.stringify(detailMsg) : `Error HTTP ${res.status}: Fallo al persistir celdas.`));
        setError(errorMsg);
      }
    } catch (err: any) {
      setError(`Error de conexión con la base de datos SQL Server: ${err?.message || err}`);
    } finally {
      setImporting(false);
    }
  };

  const resetAndStartOver = () => {
    setStep('select');
    setFile(null);
    setCeldas([]);
    setSelectedCodes(new Set());
    setEditedNames({});
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

  const selectedDuplicates = celdas.filter(c => selectedCodes.has(c.codigo) && c.is_duplicate);

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
        <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-navy-800 shadow-2xl bg-navy-900/95 text-center relative overflow-hidden">
          <div className="h-1.5 bg-emerald-500 w-full absolute top-0 left-0" />
          <CheckCircle size={52} className="mx-auto text-emerald-400 mb-4" />
          <h3 className="text-xl font-black text-slate-100 uppercase tracking-wider">Importación Completada</h3>
          <p className="text-xs text-slate-300 mt-2 font-medium">
            Se registraron <strong className="text-emerald-400">{importResult?.ventanas || 0} celdas</strong> y <strong className="text-indigo-400">{importResult?.estructuras || 0} estructuras</strong> en la base de datos SQL Server.
          </p>
          <p className="text-xs text-slate-500 mt-1">Registros consolidados y catálogos traducidos con éxito.</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md animate-fade-in">
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
                {step === 'preview' ? `Previsualización de Excel BD (${celdas.length} Celdas Encontradas)` : 'Importación de Celdas de Mapeo Geomecánico'}
              </h3>
              <p className="text-xs text-slate-400">
                {step === 'preview' ? 'Seleccione las celdas a guardar, mapee columnas y resuelva duplicados.' : 'Cargue un archivo Excel de mapeo (formato compilado o BD).'}
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
            {/* Selector de Modo */}
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
                disabled={!file || loading}
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
              {/* Tabs */}
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
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                    showMappingAccordion
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
                    <th className="py-2.5 px-3 text-center">Estado BD</th>
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
                          {c.excel_data.este_ini.toFixed(1)} / {c.excel_data.norte_ini.toFixed(1)} / {c.excel_data.cota_ini.toFixed(1)}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold text-xs">
                            {c.estructuras.length} est.
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-slate-300 font-medium">{c.excel_data.mapeador}</td>

                        {/* Badge de Estado en Base de Datos */}
                        <td className="py-2.5 px-3 text-center">
                          {c.is_duplicate ? (
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
                {importing ? 'Guardando en BD...' : `Importar ${selectedCodes.size} Celdas Seleccionadas`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SUB-MODAL DE DOBLE CONFIRMACIÓN DE CELDAS DUPLICADAS */}
      {showDoubleConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-xl p-6 rounded-2xl border border-amber-500/40 shadow-2xl bg-navy-900/95 relative overflow-hidden flex flex-col space-y-4">
            <div className="h-1.5 bg-amber-500 w-full absolute top-0 left-0" />
            
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                  Confirmación de Celdas Coincidentes
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Se detectaron <strong className="text-amber-400">{selectedDuplicates.length} celdas seleccionadas</strong> que ya existen en SQL Server.
                </p>
              </div>
            </div>

            {/* Badges de celdas duplicadas */}
            <div className="p-3 bg-navy-950/80 border border-navy-800 rounded-xl space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Celdas Coincidentes Afectadas:</span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {selectedDuplicates.map(d => (
                  <span key={d.codigo} className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold text-xs border border-amber-500/30">
                    {editedNames[d.codigo] || d.codigo}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Por favor, elija cómo desea proceder con las celdas duplicadas antes de efectuar el guardado en la base de datos:
            </p>

            {/* Opciones de Acción */}
            <div className="grid grid-cols-1 gap-3">
              {/* Opción 1: Sobreescribir */}
              <button
                type="button"
                onClick={() => executeImport(true)}
                className="p-3.5 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-left transition-all group flex items-start gap-3"
              >
                <RefreshCw size={18} className="text-red-400 shrink-0 mt-0.5 group-hover:rotate-180 transition-transform duration-500" />
                <div>
                  <span className="text-xs font-black text-red-300 block uppercase tracking-wider">
                    Option A: Sobreescribir Celdas Existentes
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Reemplaza completamente los datos de cabecera y discontinuidades de las celdas coincidentes en la base de datos.
                  </p>
                </div>
              </button>

              {/* Opción 2: Importar como Nuevas Celdas */}
              <button
                type="button"
                onClick={() => executeImport(false)}
                className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-left transition-all group flex items-start gap-3"
              >
                <PlusCircle size={18} className="text-emerald-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div>
                  <span className="text-xs font-black text-emerald-300 block uppercase tracking-wider">
                    Option B: Importar como Nuevas Celdas (Conservar ambas)
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Conserva las celdas originales en la BD e inserta las nuevas asignando un sufijo único automático (ej. <strong className="text-emerald-300 font-mono">AZ1_NUEVO</strong>).
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fade-in">
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
                      <span className="font-mono">{comparingCelda.existing_data.este_ini.toFixed(1)} / {comparingCelda.existing_data.norte_ini.toFixed(1)} / {comparingCelda.existing_data.cota_ini.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-navy-900">
                      <span className="text-slate-500">Largo / Altura:</span>
                      <span className="font-bold">{comparingCelda.existing_data.largo_m} m / {comparingCelda.existing_data.altura_m} m</span>
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
                    <span className="font-mono">{comparingCelda.excel_data.este_ini.toFixed(1)} / {comparingCelda.excel_data.norte_ini.toFixed(1)} / {comparingCelda.excel_data.cota_ini.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-navy-900">
                    <span className="text-slate-500">Largo / Altura:</span>
                    <span className="font-bold">{comparingCelda.excel_data.largo_m} m / {comparingCelda.excel_data.altura_m} m</span>
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