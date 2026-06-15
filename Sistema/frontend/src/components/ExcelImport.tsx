import React, { useState } from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, RefreshCw, Info } from 'lucide-react';

interface ExcelImportProps {
  onImportSuccess: () => void;
  apiBase: string;
}

export default function ExcelImport({ onImportSuccess, apiBase }: ExcelImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

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
    setMessage('Procesando archivo excel e importando celdas de mapeo...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${apiBase}/api/importar-excel`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setStatus('success');
        setMessage(data.message || 'Importación completada con éxito.');
        onImportSuccess();
      } else {
        const errorData = await res.json();
        setStatus('error');
        setMessage(errorData.detail || 'Ocurrió un error al procesar el archivo Excel. Verifique que cumpla con el formato establecido.');
      }
    } catch (e) {
      setStatus('error');
      setMessage('Error de red al conectar con el servidor de base de datos. Verifique que el backend de FastAPI esté corriendo.');
    }
  };

  return (
    <div className="glass-panel p-6 rounded-xl border border-navy-800 space-y-6 max-w-lg mx-auto text-left select-none animate-fade-in">
      <div className="text-center space-y-2">
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full w-14 h-14 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(249,115,22,0.1)]">
          <FileSpreadsheet size={24} />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">Ingesta de Estaciones Geomecánicas</h3>
          <p className="text-xxs text-slate-400 max-w-sm mx-auto">
            Sube el archivo Excel original. El sistema procesará automáticamente las celdas y discontinuidades.
          </p>
        </div>
      </div>

      <div className="border border-dashed border-navy-700/80 hover:border-orange-500/40 rounded-xl p-6 text-center bg-navy-950/45 transition-colors cursor-pointer relative group">
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={status === 'uploading'}
        />
        <Upload size={32} className="mx-auto text-slate-500 group-hover:text-orange-400 transition-colors mb-2" />
        <span className="text-xs font-semibold text-slate-300 block">
          {file ? file.name : 'Arrastra aquí tu archivo Excel o haz clic para buscar'}
        </span>
        <span className="text-[10px] text-slate-500 block mt-1">Soporta formatos: .xlsx, .xls</span>
      </div>

      {status !== 'idle' && (
        <div className={`p-4 rounded-lg flex gap-3 text-xs border ${
          status === 'uploading' ? 'bg-navy-900/60 border-navy-800 text-slate-300' :
          status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
          'bg-red-500/10 border-red-500/20 text-red-300'
        }`}>
          {status === 'uploading' && <RefreshCw className="animate-spin text-orange-400 shrink-0" size={16} />}
          {status === 'success' && <CheckCircle2 className="text-emerald-400 shrink-0" size={16} />}
          {status === 'error' && <AlertCircle className="text-red-400 shrink-0" size={16} />}
          <div className="space-y-1">
            <p className="font-bold">
              {status === 'uploading' ? 'Cargando y Procesando...' :
               status === 'success' ? 'Carga Exitosa' : 'Carga Fallida'}
            </p>
            <p className="leading-snug text-slate-400">{message}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-navy-800 gap-3">
        <button
          type="button"
          onClick={() => { setFile(null); setStatus('idle'); setMessage(''); }}
          disabled={status === 'uploading'}
          className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-35"
        >
          Limpiar
        </button>
        <button
          onClick={handleUpload}
          disabled={!file || status === 'uploading'}
          className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-800 dark:text-orange-400 px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed animate-pulse-ring"
        >
          Procesar Archivo
        </button>
      </div>

      <div className="bg-navy-950/40 p-4 rounded-xl border border-navy-850 space-y-2 text-xxs text-slate-500">
        <p className="font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wide">
          <Info size={12} className="text-orange-400 shrink-0" />
          <span>Información de Formato Soportada</span>
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Pestaña "ventana":</strong> Formato original de tarjetas de celdas apiladas verticalmente cada 30 filas (ej. TD1, TD2).</li>
          <li><strong>Pestaña "BD":</strong> Formato desnormalizado plano con todas las discontinuidades y columnas geomecánicas.</li>
        </ul>
      </div>
    </div>
  );
}
