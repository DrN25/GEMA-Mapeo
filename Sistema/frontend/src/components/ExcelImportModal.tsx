import React, { useState, useRef } from 'react';
import { X, FileSpreadsheet, Upload, Check, AlertTriangle, Loader, Settings, Table, ArrowRight, CheckCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8001`;

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (cellCodes: string[]) => void;
}

interface CeldaPreview {
  codigo: string;
  este: number;
  norte: number;
  n_discontinuidades: number;
  mapeador: string | null;
  fecha: string;
}

type Step = 'select' | 'preview' | 'done';

export default function ExcelImportModal({ isOpen, onClose, onImport }: ExcelImportModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'auto' | 'ventana' | 'bd'>('auto');
  const [preview, setPreview] = useState<CeldaPreview[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importCount, setImportCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(null);
      setSelected(new Set());
      setError(null);
      setStep('select');
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      let url = `${API_BASE}/api/importar-excel/preview`;
      if (mode === 'ventana') url += '?formato=ventana';
      else if (mode === 'bd') url += '?formato=bd';

      const res = await fetch(url, { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        setPreview(data.celdas || []);
        setSelected(new Set((data.celdas || []).map((c: CeldaPreview) => c.codigo)));
        setStep('preview');
      } else {
        setError(data.detail || 'Error al procesar el archivo');
      }
    } catch {
      setError('Error de conexion con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || selected.size === 0) return;
    setImporting(true);
    setError(null);

    // Parsear y cargar en la UI (sin guardar en BD)
    try {
      const formData = new FormData();
      formData.append('file', file);
      let url = `${API_BASE}/api/importar-excel?celdas=${Array.from(selected).join(',')}`;
      if (mode === 'ventana') url += '&formato=ventana';
      else if (mode === 'bd') url += '&formato=bd';

      const res = await fetch(url, { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        setImportCount(selected.size);
        setImportMessage(data.message || `${selected.size} celdas importadas correctamente`);
        setStep('done');
        onImport(Array.from(selected));
      } else {
        setError(data.detail || 'Error al procesar');
      }
    } catch {
      setError('Error de conexion');
    } finally {
      setImporting(false);
    }
  };

  const resetAndStartOver = () => {
    setStep('select');
    setFile(null);
    setPreview(null);
    setSelected(new Set());
    setError(null);
    setImportMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleAll = () => {
    if (!preview) return;
    if (selected.size === preview.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(preview.map(c => c.codigo)));
    }
  };

  const selectAll = selected.size === (preview?.length || 0);

  // Pantalla de completado
  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
        <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-navy-800 shadow-2xl bg-navy-900/95 relative overflow-hidden text-center">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 w-full absolute top-0 left-0" />
          <CheckCircle size={48} className="mx-auto text-emerald-400 mb-4" />
          <h3 className="text-lg font-black text-slate-100">Importacion completada</h3>
          <p className="text-sm text-slate-400 mt-2">{importCount} celda{importCount !== 1 ? 's' : ''} importada{importCount !== 1 ? 's' : ''} correctamente.</p>
          <p className="text-xs text-slate-500 mt-1">Los datos se guardaron automaticamente en la base de datos.</p>
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={resetAndStartOver}
              className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-300 px-5 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5">
              <FileSpreadsheet size={14} /> Importar otro archivo
            </button>
            <button onClick={onClose}
              className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 px-5 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5">
              <Check size={14} /> Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-3xl p-6 rounded-2xl border border-navy-800 shadow-2xl bg-navy-900/95 relative overflow-hidden max-h-[90vh] flex flex-col">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 w-full absolute top-0 left-0 shrink-0" />

        <div className="flex items-center justify-between border-b border-navy-800 pb-3 shrink-0">
          <h3 className="text-sm font-black text-slate-100 tracking-wider uppercase flex items-center gap-2 mt-1">
            <FileSpreadsheet size={16} className="text-emerald-400" />
            <span>{step === 'preview' ? `Previsualizacion (${preview?.length || 0} celdas)` : 'Importar Excel'}</span>
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-all">
            <X size={16} />
          </button>
        </div>

        {step === 'select' && (
          <>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 border-2 border-dashed border-navy-700 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500/50 transition-all bg-navy-950/30"
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
              {file ? (
                <div className="space-y-1">
                  <FileSpreadsheet size={32} className="mx-auto text-emerald-400" />
                  <p className="text-sm font-bold text-slate-200">{file.name}</p>
                  <p className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload size={32} className="mx-auto text-slate-500" />
                  <p className="text-sm font-semibold text-slate-400">Haz clic para seleccionar un archivo</p>
                  <p className="text-[10px] text-slate-600">.xlsx o .xls</p>
                </div>
              )}
            </div>

            <button onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 mt-3 transition-all">
              <Settings size={12} /> {showOptions ? 'Ocultar' : 'Mostrar'} opciones
            </button>

            {showOptions && (
              <div className="mt-2 p-2 bg-navy-950/40 border border-navy-800 rounded-lg">
                <div className="flex gap-2">
                  {[
                    { key: 'auto', label: 'Auto' },
                    { key: 'ventana', label: 'Estaciones' },
                    { key: 'bd', label: 'BD' },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => setMode(opt.key as any)}
                      className={`px-3 py-1 rounded text-[10px] font-bold border transition-all ${
                        mode === opt.key
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-navy-900 border-navy-700/70 text-slate-400'
                      }`}>{opt.label}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2.5 justify-end mt-5 pt-4 border-t border-navy-800">
              <button onClick={onClose} className="bg-navy-900 border border-navy-800 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold">Cerrar</button>
              <button onClick={handlePreview} disabled={!file || loading}
                className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50">
                {loading ? <Loader size={14} className="animate-spin" /> : <Table size={14} />}
                {loading ? 'Procesando...' : 'Previsualizar'}
              </button>
            </div>
          </>
        )}

        {step === 'preview' && preview && (
          <>
            {/* Barra de seleccion */}
            <div className="flex items-center justify-between mt-3 mb-2 shrink-0">
              <p className="text-xs text-slate-400 font-semibold">
                {selected.size} de {preview.length} celdas seleccionadas
              </p>
              <button onClick={toggleAll} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold">
                {selectAll ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </button>
            </div>

            {/* Tabla */}
            <div className="flex-1 overflow-y-auto min-h-0 rounded-lg border border-navy-900">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] text-slate-500 font-black uppercase tracking-wider border-b border-navy-800 bg-navy-900/40 sticky top-0">
                    <th className="py-2 px-2 w-8 text-center">
                      <input type="checkbox" checked={selectAll} onChange={toggleAll} className="accent-emerald-500 w-3 h-3" />
                    </th>
                    <th className="py-2 px-3 text-left">Celda</th>
                    <th className="py-2 px-3 text-right">Este</th>
                    <th className="py-2 px-3 text-right">Norte</th>
                    <th className="py-2 px-3 text-center">Estructuras</th>
                    <th className="py-2 px-3">Mapeador</th>
                    <th className="py-2 px-3">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/30 text-slate-300">
                  {preview.map(c => (
                    <tr key={c.codigo}
                      onClick={() => {
                        const next = new Set(selected);
                        if (next.has(c.codigo)) next.delete(c.codigo);
                        else next.add(c.codigo);
                        setSelected(next);
                      }}
                      className={`cursor-pointer hover:bg-navy-900/20 transition-colors ${selected.has(c.codigo) ? 'bg-emerald-500/[0.03]' : ''}`}
                    >
                      <td className="py-2 px-2 text-center">
                        <input type="checkbox" checked={selected.has(c.codigo)} readOnly className="accent-emerald-500 w-3 h-3" />
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-100">{c.codigo}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-400">{c.este.toFixed(4)}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-400">{c.norte.toFixed(3)}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-bold text-[10px]">{c.n_discontinuidades}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">{c.mapeador || '—'}</td>
                      <td className="py-2 px-3 text-slate-500 text-[10px]">{c.fecha.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-3 p-3 rounded-lg border text-xs font-semibold flex items-start gap-2 bg-red-500/10 border-red-500/30 text-red-400 shrink-0">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-2.5 justify-end mt-4 pt-4 border-t border-navy-800 shrink-0">
              <button
                onClick={resetAndStartOver}
                className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95">
                Volver
              </button>
              <button onClick={handleImport} disabled={selected.size === 0 || importing}
                className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 font-bold transition-all active:scale-95 px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50">
                {importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                {importing ? 'Importando...' : `Importar ${selected.size} celda${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}