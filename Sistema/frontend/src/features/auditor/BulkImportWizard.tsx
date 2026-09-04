import React, { useState, useRef, useEffect } from 'react';
import { X, UploadCloud, FileSpreadsheet, CheckCircle2, Layers } from 'lucide-react';

export type ProjectType = 'ferrobamba' | 'chalco';

interface BulkImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (payload: { file: File; proyecto: ProjectType }) => void;
}

export default function BulkImportWizard({ isOpen, onClose, onConfirm }: BulkImportWizardProps) {
    const [file, setFile] = useState<File | null>(null);
    const [proyecto, setProyecto] = useState<ProjectType>('ferrobamba');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setProyecto('ferrobamba');
            setErrorMsg('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) {
                setFile(null);
                setErrorMsg('Formato no soportado. Solo se aceptan archivos .xlsx (Excel 2007+).');
                return;
            }
            setErrorMsg('');
            setFile(selectedFile);
        }
    };

    const handleConfirmClick = () => {
        if (file) {
            onConfirm({ file, proyecto });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
            <div className="w-full max-w-lg bg-navy-900 border border-navy-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">

                {/* Cabecera */}
                <div className="shrink-0 border-b border-navy-800 bg-navy-900/30 p-5 flex justify-between items-center">
                    <div>
                        <h2 className="text-base font-black text-slate-100 uppercase tracking-wider">Cargar Planilla Geomecánica</h2>
                        <p className="text-xs text-slate-400 mt-1">Sube el archivo Excel de mapeo para iniciar el análisis masivo.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-navy-800 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Cuerpo del Asistente */}
                <div className="p-6 space-y-5">
                    {/* Selector de Proyecto Geológico */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                            <Layers size={14} className="text-cyan-400" />
                            <span>Proyecto Geológico (Catálogo Litológico)</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setProyecto('ferrobamba')}
                                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                                    proyecto === 'ferrobamba'
                                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                                        : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span className="text-xs font-black uppercase">Ferrobamba</span>
                                    {proyecto === 'ferrobamba' && <CheckCircle2 size={14} className="text-cyan-400" />}
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1">Tajo Ferrobamba (Reglas Oficiales)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setProyecto('chalco')}
                                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                                    proyecto === 'chalco'
                                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                                        : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span className="text-xs font-black uppercase">Chalcobamba</span>
                                    {proyecto === 'chalco' && <CheckCircle2 size={14} className="text-cyan-400" />}
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1">Tajo Chalco (Reglas Chalco)</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-cyan-500/5 border border-cyan-500/10 p-3.5 rounded-xl text-xs text-slate-300 leading-relaxed font-normal">
                        Las reglas de correlación litológica (Lito 1, 2, 3 y factor K) se ajustarán dinámicamente según el proyecto seleccionado ({proyecto === 'ferrobamba' ? 'Ferrobamba' : 'Chalcobamba'}).
                    </div>

                    <div
                        className={`border-2 border-dashed rounded-xl p-7 flex flex-col items-center justify-center text-center transition-all ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-cyan-500/30 hover:border-cyan-500/60 bg-navy-900/20 cursor-pointer'
                            }`}
                        onClick={() => inputRef.current?.click()}
                    >
                        <input
                            type="file"
                            className="hidden"
                            accept=".xlsx"
                            ref={inputRef}
                            onChange={handleFileChange}
                        />
                        <FileSpreadsheet size={36} className={file ? 'text-emerald-400 mb-2' : 'text-cyan-500 mb-2'} />
                        <h3 className="text-sm font-bold text-slate-200">Archivo Excel de Celdas (.xlsx)</h3>
                        <p className="text-xs text-slate-400 mt-1">
                            {file ? file.name : 'Haz clic aquí para explorar tu computadora'}
                        </p>
                        {file && (
                            <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono px-2 py-0.5 rounded mt-2">
                                {(file.size / 1024).toFixed(1)} KB
                            </span>
                        )}
                    </div>

                    {errorMsg && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold animate-fade-in">
                            {errorMsg}
                        </div>
                    )}

                    {file && (
                        <div className="flex gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold animate-fade-in">
                            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                            <span>Archivo listo para procesar bajo perfil <strong>{proyecto.toUpperCase()}</strong>. Presione "Iniciar Auditoría Masiva".</span>
                        </div>
                    )}
                </div>

                {/* Controles del Pie */}
                <div className="p-4 border-t border-navy-800 bg-navy-950/80 flex justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg font-bold text-xs bg-navy-800 hover:bg-navy-750 text-slate-300 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={!file}
                        onClick={handleConfirmClick}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-black text-xs bg-cyan-500 hover:bg-cyan-400 text-navy-950 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                    >
                        <span>Iniciar Auditoría Masiva</span>
                        <UploadCloud size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}