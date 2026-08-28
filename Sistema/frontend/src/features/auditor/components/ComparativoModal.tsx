import React, { useState } from 'react';
import { getAuthHeaders } from '../../../utils/apiClient';
import { X, ArrowRight, Upload, AlertTriangle, FileSpreadsheet, Loader2, Download } from 'lucide-react';
import type { AuditHistoryItem } from './AuditHistory';

interface ComparativoModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: AuditHistoryItem[];
    apiBase: string;
}

export default function ComparativoModal({ isOpen, onClose, history, apiBase }: ComparativoModalProps) {
    const [tab, setTab] = useState<'history' | 'files'>('history');
    
    // Configuración para comparación por historial
    const [auditA, setAuditA] = useState<string>('');
    const [auditB, setAuditB] = useState<string>('');
    
    // Configuración para comparación por archivos nuevos
    const [fileA, setFileA] = useState<File | null>(null);
    const [fileB, setFileB] = useState<File | null>(null);
    
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    if (!isOpen) return null;

    const handleCompareHistory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auditA || !auditB) {
            setError('Debe seleccionar ambas auditorías para realizar la comparación.');
            return;
        }
        if (auditA === auditB) {
            setError('No puede comparar una auditoría consigo misma. Seleccione dos auditorías diferentes.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const url = `${apiBase}/api/geomecanica/comparativo/reporte?audit_id_a=${auditA}&audit_id_b=${auditB}`;
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({ detail: 'Fallo al generar el reporte comparativo.' }));
                throw new Error(errData.detail || 'Fallo de procesamiento.');
            }
            
            // Descargar el archivo
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `comparativo_${auditA}_vs_${auditB}_${new Date().toISOString().slice(0,10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error de conexión con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    const handleCompareFiles = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fileA || !fileB) {
            setError('Debe seleccionar ambos archivos Excel para realizar la comparación.');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('file_a', fileA);
        formData.append('file_b', fileB);

        try {
            const url = `${apiBase}/api/geomecanica/comparativo/importar-y-comparar`;
            const res = await fetch(url, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ detail: 'Fallo al procesar y comparar las planillas subidas.' }));
                throw new Error(errData.detail || 'Fallo al procesar y comparar.');
            }

            // Descargar el archivo
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `comparativo_carga_directa_${new Date().toISOString().slice(0,10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error de procesamiento. Asegúrese de que ambos archivos tengan el formato correcto.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-navy-900 border border-cyan-500/15 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-cyan-500/10">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="text-cyan-400" size={18} />
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-100">
                            Comparativa de Auditorías
                        </h2>
                    </div>
                    <button 
                        onClick={onClose} 
                        disabled={loading}
                        className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-cyan-500/10 bg-navy-950">
                    <button
                        onClick={() => { setTab('history'); setError(''); }}
                        disabled={loading}
                        className={`flex-1 py-3 text-xs font-black uppercase tracking-wider text-center transition-all ${
                            tab === 'history' 
                                ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-500/5' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/30'
                        }`}
                    >
                        Desde Historial
                    </button>
                    <button
                        onClick={() => { setTab('files'); setError(''); }}
                        disabled={loading}
                        className={`flex-1 py-3 text-xs font-black uppercase tracking-wider text-center transition-all ${
                            tab === 'files' 
                                ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-500/5' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/30'
                        }`}
                    >
                        Importar Nuevos Excels
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                            <AlertTriangle size={14} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {tab === 'history' ? (
                        <form onSubmit={handleCompareHistory} className="space-y-4">
                            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                                Compare dos revisiones históricas del sistema. La auditoría base se tomará como la referencia de origen, y la auditoría actual mostrará las diferencias frente a esta.
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                        Auditoría Base (A - Referencia)
                                    </label>
                                    <select
                                        value={auditA}
                                        onChange={(e) => setAuditA(e.target.value)}
                                        disabled={loading}
                                        className="w-full bg-navy-950 border border-cyan-500/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
                                    >
                                        <option value="">-- Seleccionar auditoría base --</option>
                                        {history.map((h) => (
                                            <option key={h.audit_id} value={h.audit_id}>
                                                {h.archivo} ({h.fecha} - {h.total_filas} filas)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-center py-1">
                                    <div className="w-8 h-8 rounded-full border border-cyan-500/10 bg-navy-950 flex items-center justify-center text-cyan-400">
                                        <ArrowRight size={14} className="rotate-90" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                        Auditoría Actual (B - Comparar)
                                    </label>
                                    <select
                                        value={auditB}
                                        onChange={(e) => setAuditB(e.target.value)}
                                        disabled={loading}
                                        className="w-full bg-navy-950 border border-cyan-500/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
                                    >
                                        <option value="">-- Seleccionar auditoría actual --</option>
                                        {history.map((h) => (
                                            <option key={h.audit_id} value={h.audit_id}>
                                                {h.archivo} ({h.fecha} - {h.total_filas} filas)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !auditA || !auditB}
                                className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-navy-950 disabled:border-cyan-500/10 text-slate-950 disabled:text-slate-500 border border-cyan-400/20 px-4 py-3 rounded-xl text-xs font-black transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>Generando comparación...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download size={14} />
                                        <span>Generar Reporte Comparativo</span>
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleCompareFiles} className="space-y-4">
                            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                                Suba directamente dos planillas Excel (.xlsx) sin procesar. El sistema las auditará de manera secuencial en el servidor y le entregará el reporte de comparación.
                            </p>

                            <div className="space-y-3">
                                {/* Archivo A */}
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                        Planilla Base (A - Referencia)
                                    </label>
                                    <div className="flex items-center gap-2 bg-navy-950 border border-cyan-500/10 rounded-xl px-3 py-2">
                                        <Upload size={14} className="text-cyan-400 shrink-0" />
                                        <input
                                            type="file"
                                            accept=".xlsx"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0] || null;
                                                if (f && !f.name.toLowerCase().endsWith('.xlsx')) {
                                                    setFileA(null);
                                                    setError('Formato no soportado. Solo se aceptan archivos .xlsx (Excel 2007+).');
                                                    return;
                                                }
                                                setFileA(f);
                                            }}
                                            disabled={loading}
                                            className="text-xs text-slate-200 focus:outline-none file:hidden w-full cursor-pointer"
                                        />
                                    </div>
                                    {fileA && (
                                        <span className="text-[10px] text-cyan-400 font-bold mt-1 block">
                                            {fileA.name} ({Math.round(fileA.size / 1024)} KB)
                                        </span>
                                    )}
                                </div>

                                {/* Archivo B */}
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                        Planilla Actual (B - Comparar)
                                    </label>
                                    <div className="flex items-center gap-2 bg-navy-950 border border-cyan-500/10 rounded-xl px-3 py-2">
                                        <Upload size={14} className="text-cyan-400 shrink-0" />
                                        <input
                                            type="file"
                                            accept=".xlsx"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0] || null;
                                                if (f && !f.name.toLowerCase().endsWith('.xlsx')) {
                                                    setFileB(null);
                                                    setError('Formato no soportado. Solo se aceptan archivos .xlsx (Excel 2007+).');
                                                    return;
                                                }
                                                setFileB(f);
                                            }}
                                            disabled={loading}
                                            className="text-xs text-slate-200 focus:outline-none file:hidden w-full cursor-pointer"
                                        />
                                    </div>
                                    {fileB && (
                                        <span className="text-[10px] text-cyan-400 font-bold mt-1 block">
                                            {fileB.name} ({Math.round(fileB.size / 1024)} KB)
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 bg-cyan-950/20 border border-cyan-500/10 rounded-xl text-[10px] leading-relaxed text-cyan-400/80 font-bold flex gap-2">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-cyan-400" />
                                <span>
                                    <strong>Nota de Rendimiento:</strong> Auditar dos planillas completas consecutivamente en el servidor y consolidar la diferencia puede demorar de 10 a 30 segundos. Por favor, no cierre esta ventana durante el proceso.
                                </span>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !fileA || !fileB}
                                className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-[#0d1527] disabled:border-cyan-500/10 text-slate-950 disabled:text-slate-500 border border-cyan-400/20 px-4 py-3 rounded-xl text-xs font-black transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>Procesando y Comparando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download size={14} />
                                        <span>Subir y Comparar Planillas</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
