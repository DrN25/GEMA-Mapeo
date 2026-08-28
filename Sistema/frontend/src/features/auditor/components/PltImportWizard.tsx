import React, { useState, useRef, useEffect } from 'react';
import { X, UploadCloud, FileSpreadsheet, CheckCircle2, Sliders } from 'lucide-react';

interface PltImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (payload: { file: File; tolerance: number }) => void;
}

export default function PltImportWizard({ isOpen, onClose, onConfirm }: PltImportWizardProps) {
    const [file, setFile] = useState<File | null>(null);
    const [tolerance, setTolerance] = useState<number>(0.1);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setErrorMsg('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const name = selectedFile.name.toLowerCase();
            if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm') && !name.endsWith('.xls')) {
                setFile(null);
                setErrorMsg('Formato no soportado. Solo se aceptan archivos Excel (.xlsx, .xlsm, .xls).');
                return;
            }
            setErrorMsg('');
            setFile(selectedFile);
        }
    };

    const handleConfirmClick = () => {
        if (file) {
            onConfirm({ file, tolerance });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left font-sans select-none">
            <div className="w-full max-w-lg bg-[#090f1d] border border-navy-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">

                {/* Cabecera */}
                <div className="shrink-0 border-b border-navy-800 bg-navy-900/30 p-5 flex justify-between items-center">
                    <div>
                        <h2 className="text-base font-black text-slate-100 uppercase tracking-wider">Cargar Planilla Ensayos PLT</h2>
                        <p className="text-xs text-slate-400 mt-1">Sube el archivo Excel de ensayos de carga puntual (34 columnas)</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/50 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Cuerpo */}
                <div className="p-6 space-y-5">
                    {/* Zona Drag & Drop */}
                    <div
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            const droppedFile = e.dataTransfer.files?.[0];
                            if (droppedFile) {
                                const name = droppedFile.name.toLowerCase();
                                if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm') && !name.endsWith('.xls')) {
                                    setErrorMsg('Formato no soportado. Solo se aceptan archivos Excel (.xlsx, .xlsm, .xls).');
                                    return;
                                }
                                setErrorMsg('');
                                setFile(droppedFile);
                            }
                        }}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                            file
                                ? 'border-cyan-500/50 bg-cyan-500/5'
                                : 'border-navy-800 hover:border-cyan-500/30 hover:bg-navy-900/20'
                        }`}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xlsx,.xlsm,.xls"
                            className="hidden"
                            onChange={handleFileChange}
                        />

                        {file ? (
                            <>
                                <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl shadow-md">
                                    <FileSpreadsheet size={28} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-slate-100">{file.name}</p>
                                    <p className="text-[10px] text-slate-500 font-mono">{(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                                <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                                    Clic para cambiar archivo
                                </span>
                            </>
                        ) : (
                            <>
                                <div className="p-3 bg-slate-800 text-slate-400 rounded-xl">
                                    <UploadCloud size={28} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-200">
                                        Haz clic para seleccionar o arrastra el archivo aquí
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">
                                        Archivos Excel .xlsx / .xlsm (formatos estándar y consolidados)
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Tolerancia de fórmulas */}
                    <div className="p-4 rounded-xl bg-navy-950/60 border border-navy-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-slate-300 font-bold">
                                <Sliders size={14} className="text-cyan-400" />
                                <span>Tolerancia de Fórmulas Numéricas</span>
                            </div>
                            <span className="font-mono text-cyan-400 font-black bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                                ± {tolerance.toFixed(2)}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                            Tolerancia admitida para verificar cálculos de Ancho W, Diámetro equivalente, Is, Is(50), K y UCS.
                        </p>
                        <input
                            type="range"
                            min="0.01"
                            max="0.5"
                            step="0.01"
                            value={tolerance}
                            onChange={(e) => setTolerance(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>

                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                            {errorMsg}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-navy-800 bg-navy-900/30 p-4 flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={!file}
                        onClick={handleConfirmClick}
                        className="px-5 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-black uppercase tracking-wider rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-2"
                    >
                        <CheckCircle2 size={14} />
                        <span>Procesar Planilla PLT</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
