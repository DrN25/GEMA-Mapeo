import { useState } from 'react';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle, 
  AlertCircle, GitCompare, ArrowRightLeft, Shield, Sliders
} from 'lucide-react';

interface CongruenceAuditorProps {
  apiBase: string;
}

export default function CongruenceAuditor({ apiBase }: CongruenceAuditorProps) {
  // Estados para Auditoría de Congruencia
  const [fileAudit, setFileAudit] = useState<File | null>(null);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditSuccess, setAuditSuccess] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Estados para Comparación
  const [fileAntes, setFileAntes] = useState<File | null>(null);
  const [fileDespues, setFileDespues] = useState<File | null>(null);
  const [compareLoading, setCompareLoading] = useState<boolean>(false);
  const [compareSuccess, setCompareSuccess] = useState<boolean>(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Manejador de Auditoría
  const handleAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileAudit) return;

    setAuditLoading(true);
    setAuditSuccess(false);
    setAuditError(null);

    const formData = new FormData();
    formData.append('file', fileAudit);

    try {
      const res = await fetch(`${apiBase}/api/congruencia/auditar`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error procesando la auditoría de congruencia.');
      }

      // Descargar el archivo blob
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Auditoria_Congruencia_${fileAudit.name}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setAuditSuccess(true);
    } catch (err: any) {
      setAuditError(err.message || 'Error de conexión con el servidor.');
    } finally {
      setAuditLoading(false);
    }
  };

  // Manejador de Comparación
  const handleCompareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileAntes || !fileDespues) return;

    setCompareLoading(true);
    setCompareSuccess(false);
    setCompareError(null);

    const formData = new FormData();
    formData.append('antes', fileAntes);
    formData.append('despues', fileDespues);

    try {
      const res = await fetch(`${apiBase}/api/congruencia/comparar`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error procesando la comparación.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Comparativo_Congruencia_Celdas.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setCompareSuccess(true);
    } catch (err: any) {
      setCompareError(err.message || 'Error de conexión con el servidor.');
    } finally {
      setCompareLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left select-none animate-fade-in max-w-7xl mx-auto">
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-navy-850 pb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-100 uppercase tracking-widest flex items-center gap-2.5">
            <ArrowRightLeft className="text-indigo-400" size={24} />
            <span>Auditoría y Comparativo de Congruencia</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Motor de auditoría de celdas padre geomecánicas (RQD / Resistencia) por año de campaña.
          </p>
        </div>
      </div>

      {/* Reglas e Información de Campañas (Rich UI Card) */}
      <div className="bg-navy-950/40 border border-indigo-500/10 p-5 rounded-xl text-xs text-slate-300 grid grid-cols-1 md:grid-cols-2 gap-6 relative overflow-hidden">
        <div className="space-y-3">
          <span className="font-black text-[10px] uppercase text-violet-400 tracking-wider flex items-center gap-1.5">
            <Shield size={14} className="text-violet-400" />
            Lógica de Resistencia por Campaña
          </span>
          <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
            <li><strong className="text-slate-300">Resistencia '76 (Todos los años):</strong> Tabla Discreta original Bieniawski 76 (0, 1, 2, 4, 7, 12, 15).</li>
            <li><strong className="text-slate-300">Resistencia '89 (2021-2023):</strong> Ábaco Continuo mediante función monótona PCHIP UCS (MPa).</li>
            <li><strong className="text-slate-300">Resistencia '89 (2024+):</strong> Tabla Discreta original Bieniawski 89 (0, 1, 2, 4, 7, 12, 15).</li>
          </ul>
        </div>
        <div className="space-y-3">
          <span className="font-black text-[10px] uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
            <Sliders size={14} className="text-cyan-400" />
            Lógica de RQD por Campaña
          </span>
          <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
            <li><strong className="text-slate-300">RQD '76 (Todos los años):</strong> Tabla Discreta original (redondeado a entero) Bieniawski 76.</li>
            <li><strong className="text-slate-300">RQD '89 (Campaña 2021):</strong> Tabla Discreta original (redondeado a entero) Bieniawski 89.</li>
            <li><strong className="text-slate-300">RQD '89 (Campaña 2022+):</strong> Ábaco Continuo mediante spline cúbica RQD (%) con tolerancia ±0.2.</li>
          </ul>
        </div>
      </div>

      {/* Grid de Operaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Panel Izquierdo: Auditoría Individual */}
        <div className="glass-panel border border-navy-800 bg-navy-950/20 p-6 rounded-2xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-navy-850 pb-3">
              <FileSpreadsheet className="text-indigo-400" size={16} />
              <span>Auditoría de Congruencia Individual</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sube una planilla de Excel de mapeo. El sistema auditará la consistencia de cada celda padre y generará un reporte de 4 hojas indicando desviaciones y el valor esperado por catálogo.
            </p>

            <form onSubmit={handleAuditSubmit} className="space-y-4">
              <div className="border-2 border-dashed border-navy-800 hover:border-indigo-500/50 rounded-xl p-6 transition-all bg-navy-950/40 relative flex flex-col items-center justify-center text-center cursor-pointer group">
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setFileAudit(e.target.files[0]);
                      setAuditSuccess(false);
                      setAuditError(null);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="text-slate-500 group-hover:text-indigo-400 transition-colors mb-2" size={32} />
                <span className="text-xs font-bold text-slate-300 block max-w-[280px] truncate">
                  {fileAudit ? fileAudit.name : "Selecciona o arrastra el archivo Excel"}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Soporta formatos .xlsx y .xls</span>
              </div>

              {auditError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-start gap-2 text-xs">
                  <AlertCircle className="shrink-0 mt-0.5" size={14} />
                  <span>{auditError}</span>
                </div>
              )}

              {auditSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg flex items-start gap-2 text-xs">
                  <CheckCircle className="shrink-0 mt-0.5" size={14} />
                  <span>¡Reporte de auditoría generado y descargado con éxito!</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!fileAudit || auditLoading}
                className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border active:scale-95 ${
                  fileAudit && !auditLoading
                    ? "bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border-indigo-500/40 cursor-pointer shadow-[0_0_12px_rgba(99,102,241,0.12)]"
                    : "bg-navy-900 border-navy-850 text-slate-500 cursor-not-allowed"
                }`}
              >
                {auditLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></span>
                    <span>Procesando Auditoría...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Auditar y Descargar Reporte</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Panel Derecho: Comparación Antes/Después */}
        <div className="glass-panel border border-navy-800 bg-navy-950/20 p-6 rounded-2xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-navy-850 pb-3">
              <GitCompare className="text-cyan-400" size={16} />
              <span>Comparación de Celdas Padre</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sube dos versiones de planilla de Excel (Antes vs Después). El sistema emparejará las celdas padre comunes, comparará sus propiedades geomecánicas y listará celdas discrepantes o faltantes.
            </p>

            <form onSubmit={handleCompareSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Archivo Antes */}
                <div className="border border-dashed border-navy-800 hover:border-cyan-500/40 rounded-xl p-4 transition-all bg-navy-950/30 relative flex flex-col items-center justify-center text-center cursor-pointer group h-36">
                  <input 
                    type="file" 
                    accept=".xlsx, .xls"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setFileAntes(e.target.files[0]);
                        setCompareSuccess(false);
                        setCompareError(null);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="text-slate-500 group-hover:text-cyan-450 transition-colors mb-1.5" size={24} />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    Archivo Antes (Origen)
                  </span>
                  <span className="text-[11px] font-bold text-slate-300 block max-w-[130px] truncate">
                    {fileAntes ? fileAntes.name : "Seleccionar"}
                  </span>
                </div>

                {/* Archivo Después */}
                <div className="border border-dashed border-navy-800 hover:border-cyan-500/40 rounded-xl p-4 transition-all bg-navy-950/30 relative flex flex-col items-center justify-center text-center cursor-pointer group h-36">
                  <input 
                    type="file" 
                    accept=".xlsx, .xls"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setFileDespues(e.target.files[0]);
                        setCompareSuccess(false);
                        setCompareError(null);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="text-slate-500 group-hover:text-cyan-455 transition-colors mb-1.5" size={24} />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    Archivo Después (Nueva)
                  </span>
                  <span className="text-[11px] font-bold text-slate-300 block max-w-[130px] truncate">
                    {fileDespues ? fileDespues.name : "Seleccionar"}
                  </span>
                </div>
              </div>

              {compareError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-start gap-2 text-xs">
                  <AlertCircle className="shrink-0 mt-0.5" size={14} />
                  <span>{compareError}</span>
                </div>
              )}

              {compareSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg flex items-start gap-2 text-xs">
                  <CheckCircle className="shrink-0 mt-0.5" size={14} />
                  <span>¡Reporte de comparación y desajustes generado con éxito!</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!fileAntes || !fileDespues || compareLoading}
                className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border active:scale-95 ${
                  fileAntes && fileDespues && !compareLoading
                    ? "bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border-cyan-500/40 cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.12)]"
                    : "bg-navy-900 border-navy-850 text-slate-500 cursor-not-allowed"
                }`}
              >
                {compareLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
                    <span>Procesando Comparativo...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Comparar y Descargar Reporte</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
