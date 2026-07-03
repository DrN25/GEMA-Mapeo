import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { X, FileSpreadsheet, Upload, AlertTriangle, Check, ArrowRight, Filter } from 'lucide-react';
import { LITHOLOGY_CLASSIFICATION } from '../utils/catalogData';
import {
    PLT_COLUMN_DEFS as EXPECTED_FIELDS,
    getPltConstraints,
    normalizeTipoLitologico,
    normalizeCeldaCode
} from '../utils/geomecColumns';

interface PltExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (importedRows: any[]) => void;
    activeWindowCelda: string | null;
}

export default function PltExcelImportModal({
    isOpen,
    onClose,
    onImport,
    activeWindowCelda
}: PltExcelImportModalProps) {
    if (!isOpen) return null;

    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

    const [rawGrid, setRawGrid] = useState<any[][] | null>(null);
    const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [mappings, setMappings] = useState<Record<string, number>>({});

    const [importedRowsState, setImportedRowsState] = useState<any[]>([]);
    const [importMode, setImportMode] = useState<'filtered' | 'all'>('filtered');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setFile(null);
        setSheets([]);
        setSelectedSheet('');
        setWorkbook(null);
        setRawGrid(null);
        setHeaderRowIdx(0);
        setExcelHeaders([]);
        setMappings({});
        setImportedRowsState([]);
        setImportMode('filtered');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        loadWorkbook(selectedFile);
    };

    const loadWorkbook = (selectedFile: File) => {
        setFile(selectedFile);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array', cellDates: true });
                setWorkbook(wb);
                setSheets(wb.SheetNames);
                setSelectedSheet(wb.SheetNames[0]);
                processSheet(wb, wb.SheetNames[0]);
            } catch (err) {
                alert("Error al procesar el archivo Excel.");
                resetState();
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return;
        const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
        if (grid.length === 0) return;
        parseFlatTable(grid);
    };

    const normalize = (val: any): string => {
        if (val === null || val === undefined) return '';
        return String(val).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
    };

    const parseFlatTable = (grid: any[][]) => {
        setRawGrid(grid);
        let bestRowIdx = 0;
        let maxMatches = -1;
        const maxScan = Math.min(15, grid.length);

        for (let r = 0; r < maxScan; r++) {
            const row = grid[r];
            if (!row) continue;
            let matches = 0;
            const normalizedCells = row.map(c => normalize(c));

            EXPECTED_FIELDS.forEach(f => {
                if (f.synonyms) {
                    const hasMatch = f.synonyms.some(s => normalizedCells.includes(normalize(s)));
                    if (hasMatch) matches++;
                }
            });

            if (matches > maxMatches) {
                maxMatches = matches;
                bestRowIdx = r;
            }
        }

        setHeaderRowIdx(bestRowIdx);
        const headerRow = grid[bestRowIdx] || [];
        setExcelHeaders(headerRow.map((h, i) => h ? `${XLSX.utils.encode_col(i)}: ${String(h).trim()}` : `${XLSX.utils.encode_col(i)}: [Vacío]`));

        const suggested: Record<string, number> = {};
        const normalizedHeaders = headerRow.map(h => normalize(h));
        const used = new Set<number>();

        EXPECTED_FIELDS.forEach(f => {
            for (let i = 0; i < normalizedHeaders.length; i++) {
                if (used.has(i)) continue;
                if (normalizedHeaders[i] === normalize(f.key) || (f.synonyms && f.synonyms.some(s => normalize(s) === normalizedHeaders[i]))) {
                    suggested[f.key] = i;
                    used.add(i);
                    break;
                }
            }
        });

        EXPECTED_FIELDS.forEach(f => {
            if (suggested[f.key] !== undefined || !f.synonyms) return;
            for (const syn of f.synonyms) {
                let found = false;
                for (let i = 0; i < normalizedHeaders.length; i++) {
                    if (used.has(i)) continue;
                    const normHeader = normalizedHeaders[i];
                    const isSimilar = normHeader.includes(normalize(f.key)) || f.synonyms.some(s => normHeader.includes(normalize(s)) || normalize(s).includes(normHeader));
                    if (isSimilar) {
                        suggested[f.key] = i;
                        used.add(i);
                        break;
                    }
                }
                if (found) break;
            }
        });

        setMappings(suggested);
        runGrouping(grid, bestRowIdx, suggested);
    };

    const parseDateStr = (val: any): string => {
        if (!val) return new Date().toISOString().split('T')[0];
        if (val instanceof Date) {
            return val.toISOString().split('T')[0];
        }
        const num = parseFloat(String(val));
        if (!isNaN(num) && num > 30000 && num < 60000) {
            const jsDate = new Date((num - 25569) * 86400 * 1000);
            return jsDate.toISOString().split('T')[0];
        }
        return String(val).trim().substring(0, 10);
    };

    const resolveImportedLithology = (rowObj: any) => {
        const code = String(rowObj.litologia_3 || "").trim().toUpperCase();
        const l1 = String(rowObj.litologia_1 || "").trim().toUpperCase();
        const l2 = String(rowObj.litologia_2 || "").trim().toUpperCase();

        let match = null;
        if (code) {
            match = LITHOLOGY_CLASSIFICATION.find(item => item.codigo.toUpperCase() === code);
        }
        if (!match && l1 && l2) {
            match = LITHOLOGY_CLASSIFICATION.find(item => item.unidad.toUpperCase() === l1 && item.litologia.toUpperCase() === l2);
        }
        if (!match && l1) {
            match = LITHOLOGY_CLASSIFICATION.find(item => item.unidad.toUpperCase() === l1);
        }

        if (match) {
            rowObj.litologia_1 = match.unidad;
            rowObj.litologia_2 = match.litologia;
            rowObj.litologia_3 = match.codigo;
            rowObj.tipo_litologico = match.grupo;
            rowObj.factor_conversion_k = match.k;
        } else {
            rowObj.tipo_litologico = normalizeTipoLitologico(rowObj.tipo_litologico);
        }
    };

    const runGrouping = (grid: any[][], headerRowIndex: number, currentMappings: Record<string, number>) => {
        const list: any[] = [];
        const getVal = (row: any[], key: string) => {
            const idx = currentMappings[key];
            return idx !== undefined ? row[idx] : undefined;
        };

        const getNum = (row: any[], key: string, fallback = 0) => {
            const val = getVal(row, key);
            if (val === null || val === undefined || val === "") return fallback;
            const num = parseFloat(String(val).replace(/,/g, ''));
            return isNaN(num) ? fallback : num;
        };

        const getStr = (row: any[], key: string, fallback = "") => {
            const val = getVal(row, key);
            return val !== null && val !== undefined ? String(val).trim() : fallback;
        };

        for (let r = headerRowIndex + 1; r < grid.length; r++) {
            const row = grid[r];
            if (!row || row.length === 0) continue;

            const celdaMapeo = getStr(row, 'celda_mapeo');
            if (!celdaMapeo) continue;

            let nivelVal = getNum(row, 'nivel', 3960);
            if (nivelVal > 4999) nivelVal = 4999;

            const rowObj: any = {
                id: Date.now() + r,
                campana: Math.round(getNum(row, 'campana', new Date().getFullYear())),
                fecha_ensayo: parseDateStr(getVal(row, 'fecha_ensayo')),
                sector_geotecnico: getStr(row, 'sector_geotecnico'),
                ejecutado_por: getStr(row, 'ejecutado_por'),
                zona_mapeo: getStr(row, 'zona_mapeo'),
                nivel: Math.round(nivelVal * 100) / 100,
                celda_mapeo: celdaMapeo,
                muestra: getStr(row, 'muestra'),
                codigo_muestra: "",
                litologia_1: getStr(row, 'litologia_1'),
                litologia_2: getStr(row, 'litologia_2'),
                litologia_3: getStr(row, 'litologia_3'),
                tipo_litologico: getStr(row, 'tipo_litologico', 'INTRUSIVOS'),
                este: getVal(row, 'este') !== null && getVal(row, 'este') !== "" ? Math.round(Math.abs(getNum(row, 'este')) * 10000) / 10000 : null,
                norte: getVal(row, 'norte') !== null && getVal(row, 'norte') !== "" ? Math.round(Math.abs(getNum(row, 'norte')) * 1000) / 1000 : null,
                elevacion: getVal(row, 'elevacion') !== null && getVal(row, 'elevacion') !== "" ? Math.round(Math.abs(getNum(row, 'elevacion')) * 100) / 100 : null,
                espesor_d: getVal(row, 'espesor_d') !== null && getVal(row, 'espesor_d') !== "" ? Math.round(Math.abs(getNum(row, 'espesor_d')) * 10) / 10 : null,
                longitud_l: getVal(row, 'longitud_l') !== null && getVal(row, 'longitud_l') !== "" ? Math.round(Math.abs(getNum(row, 'longitud_l')) * 100) / 100 : null,
                ancho_w1: getVal(row, 'ancho_w1') !== null && getVal(row, 'ancho_w1') !== "" ? Math.round(Math.abs(getNum(row, 'ancho_w1')) * 100) / 100 : null,
                ancho_w2: getVal(row, 'ancho_w2') !== null && getVal(row, 'ancho_w2') !== "" ? Math.round(Math.abs(getNum(row, 'ancho_w2')) * 100) / 100 : null,
                fuerza_p: getVal(row, 'fuerza_p') !== null && getVal(row, 'fuerza_p') !== "" ? Math.round(Math.abs(getNum(row, 'fuerza_p')) * 100) / 100 : null,
                direccion_rotura: getStr(row, 'direccion_rotura', 'Pa'),
                tipo_fractura: getStr(row, 'tipo_fractura', 'M'),
                factor_conversion_k: getVal(row, 'factor_conversion_k') !== null && getVal(row, 'factor_conversion_k') !== "" ? Math.round(Math.abs(getNum(row, 'factor_conversion_k')) * 100) / 100 : null,
                observaciones: getStr(row, 'observaciones'),
                _dirty: true
            };

            const cUp = rowObj.celda_mapeo.trim().toUpperCase();
            const mUp = rowObj.muestra.trim();
            rowObj.codigo_muestra = cUp && mUp ? `${cUp}-${mUp}` : "";

            resolveImportedLithology(rowObj);
            list.push(rowObj);
        }
        setImportedRowsState(list);
    };

    const handleMappingChange = (fieldKey: string, colIdx: number) => {
        if (!rawGrid) return;
        const updated = { ...mappings };
        if (colIdx !== -1) {
            Object.keys(updated).forEach(k => {
                if (updated[k] === colIdx && k !== fieldKey) {
                    delete updated[k];
                }
            });
            updated[fieldKey] = colIdx;
        } else {
            delete updated[fieldKey];
        }
        setMappings(updated);
        runGrouping(rawGrid, headerRowIdx, updated);
    };

    const matchingRows = useMemo(() => {
        if (!activeWindowCelda) return [];
        const activeNorm = normalizeCeldaCode(activeWindowCelda);
        return importedRowsState.filter(r => normalizeCeldaCode(r.celda_mapeo) === activeNorm);
    }, [importedRowsState, activeWindowCelda]);

    useEffect(() => {
        if (activeWindowCelda && matchingRows.length > 0) {
            setImportMode('filtered');
        } else {
            setImportMode('all');
        }
    }, [matchingRows.length, activeWindowCelda]);

    const previewRows = useMemo(() => {
        if (importMode === 'filtered' && activeWindowCelda) {
            return matchingRows.slice(0, 5);
        }
        return importedRowsState.slice(0, 5);
    }, [importMode, matchingRows, importedRowsState, activeWindowCelda]);

    const handleImportClick = () => {
        const rowsToImport = importMode === 'filtered' ? matchingRows : importedRowsState;
        if (rowsToImport.length === 0) {
            alert("No se encontraron registros de ensayo PLT válidos para importar.");
            return;
        }

        if (rowsToImport.length > 500) {
            const confirmBigImport = window.confirm(
                `¡ADVERTENCIA DE RENDIMIENTO!\n\nVas a importar ${rowsToImport.length} registros de golpe. Cargar planillas masivas puede ralentizar el rendimiento del navegador.\n\n¿Deseas continuar?`
            );
            if (!confirmBigImport) return;
        }

        onImport(rowsToImport);
        onClose();
        resetState();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
            <div className="glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col border border-navy-800 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/95 text-xs text-slate-100">
                <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 w-full" />

                <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-100 uppercase tracking-wider">Importación de Ensayos PLT</h3>
                            <p className="text-xs text-slate-400">Procesamiento y normalización estricta de decimales y litologías offline</p>
                        </div>
                    </div>
                    <button onClick={() => { onClose(); resetState(); }} className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!file ? (
                        <div className="space-y-4">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-navy-800 hover:border-emerald-500/40 bg-navy-950/45 hover:bg-navy-950/70 rounded-xl p-10 text-center cursor-pointer transition-all space-y-4 group"
                            >
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                                    <Upload size={22} />
                                </div>
                                <p className="text-sm font-bold text-slate-200">Arrastra tu planilla de Ensayos PLT aquí o haz clic para explorar</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-navy-950/60 border border-navy-850 rounded-xl">
                                <div>
                                    <p className="text-sm font-bold text-slate-200 truncate max-w-xs">{file.name}</p>
                                    <p className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB | Hoja seleccionada: {selectedSheet}</p>
                                </div>
                                {sheets.length > 1 && (
                                    <select
                                        value={selectedSheet}
                                        onChange={(e) => {
                                            setSelectedSheet(e.target.value);
                                            if (workbook) processSheet(workbook, e.target.value);
                                        }}
                                        className="bg-navy-900 border border-navy-800 rounded-lg px-3 py-1.5 text-slate-200 font-bold outline-none cursor-pointer"
                                    >
                                        {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-1 glass-panel p-4 rounded-xl border border-navy-800 space-y-4 max-h-[40vh] overflow-y-auto bg-navy-950/40">
                                    <div className="flex items-center gap-2 text-emerald-400 border-b border-navy-800 pb-2">
                                        <Filter size={16} />
                                        <h4 className="text-xs font-black uppercase tracking-wider">Mapear Columnas PLT</h4>
                                    </div>
                                    <div className="space-y-3.5">
                                        {EXPECTED_FIELDS.map(f => {
                                            const isMapped = mappings[f.key] !== undefined;
                                            return (
                                                <div key={f.key} className="space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-semibold text-slate-300">{f.label} {f.required && <span className="text-red-400">*</span>}</span>
                                                        {isMapped ? (
                                                            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Mapeado</span>
                                                        ) : (
                                                            f.required && <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Requerido</span>
                                                        )}
                                                    </div>
                                                    <select
                                                        value={mappings[f.key] ?? -1}
                                                        onChange={(e) => handleMappingChange(f.key, parseInt(e.target.value))}
                                                        className={`w-full bg-navy-900 border text-xs rounded-lg px-2 py-1.5 focus:outline-none transition-all ${isMapped ? 'border-emerald-500/30 text-emerald-300' : 'border-navy-800 text-slate-400 hover:border-navy-700'}`}
                                                    >
                                                        <option value={-1}>— No Asignado —</option>
                                                        {excelHeaders.map((eh, idx) => (
                                                            <option key={idx} value={idx}>{eh}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="lg:col-span-2 space-y-4">
                                    {importedRowsState.length > 0 && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                                Opciones de Ingesta y Segmentación de Ensayos:
                                            </label>

                                            {activeWindowCelda ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setImportMode('filtered')}
                                                        disabled={matchingRows.length === 0}
                                                        className={`p-4 rounded-xl border text-left flex flex-col gap-1 transition-all ${importMode === 'filtered'
                                                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)] font-bold'
                                                            : 'bg-navy-950/40 border-navy-800 text-slate-400 hover:bg-navy-900/60 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed'
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-center w-full">
                                                            <span className="text-xs uppercase font-extrabold tracking-wider">Ingestar Celda Activa</span>
                                                            {importMode === 'filtered' && <Check size={14} className="text-emerald-400" />}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 leading-normal">
                                                            Cargar únicamente los ensayos de la celda activa: <strong className="text-white">{activeWindowCelda}</strong>
                                                        </p>
                                                        {matchingRows.length > 0 ? (
                                                            <span className="text-[10px] mt-2 bg-emerald-500/20 border border-emerald-500/35 px-2.5 py-0.5 rounded-full w-fit font-black font-mono">
                                                                {matchingRows.length} registros coincidentes
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] mt-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-0.5 rounded-full w-fit font-bold">
                                                                0 coincidencias halladas
                                                            </span>
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setImportMode('all')}
                                                        className={`p-4 rounded-xl border text-left flex flex-col gap-1 transition-all ${importMode === 'all'
                                                            ? 'bg-orange-500/10 border-orange-500/40 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.15)] font-bold'
                                                            : 'bg-navy-950/40 border-navy-800 text-slate-400 hover:bg-navy-900/60 hover:text-slate-300'
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-center w-full">
                                                            <span className="text-xs uppercase font-extrabold tracking-wider">Ingestar Base Completa</span>
                                                            {importMode === 'all' && <Check size={14} className="text-orange-400" />}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 leading-normal">
                                                            Ignorar filtrados por celda e importar todas las filas de ensayos del archivo Excel.
                                                        </p>
                                                        <span className="text-[10px] mt-2 bg-orange-500/20 border border-orange-500/35 px-2.5 py-0.5 rounded-full w-fit font-black font-mono">
                                                            {importedRowsState.length} registros totales
                                                        </span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-3">
                                                    <div className="p-4 rounded-xl border border-navy-800 bg-navy-950/40 text-slate-400 flex flex-col gap-1 text-center justify-center min-h-[90px]">
                                                        <span className="text-xs uppercase font-extrabold tracking-wider text-slate-300">No hay celdas activas actualmente</span>
                                                        <p className="text-[10px] text-slate-500 leading-normal">
                                                            No has seleccionado ninguna ventana geomecánica activa en el Dashboard. El filtro por celda de mapeo está deshabilitado.
                                                        </p>
                                                        <span className="text-[10px] mt-2 bg-navy-900 border border-navy-800 px-2.5 py-0.5 rounded-full w-fit mx-auto font-black font-mono">
                                                            {importedRowsState.length} registros totales listos para importar
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {importMode === 'all' && importedRowsState.length > 500 && (
                                        <div className="flex gap-3 p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-xs leading-relaxed animate-pulse">
                                            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={16} />
                                            <div>
                                                <span className="font-black uppercase tracking-wider text-[9px] block mb-0.5">Alerta de Rendimiento:</span>
                                                El archivo tiene <strong className="text-white font-mono">{importedRowsState.length}</strong> registros. Importar todo de golpe ralentizará la base de datos de React. Se aconseja filtrar por celda activa.
                                            </div>
                                        </div>
                                    )}

                                    {previewRows.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                                Vista Previa Dinámica ({importMode === 'filtered' ? `Celda ${activeWindowCelda}` : 'Todos los Registros'} — Primeras 5 Filas):
                                            </h4>
                                            <div className="overflow-x-auto border border-navy-850 rounded-lg">
                                                <table className="w-full text-xs text-left border-collapse text-slate-300">
                                                    <thead>
                                                        <tr className="bg-navy-950 text-slate-400 font-semibold border-b border-navy-850 text-[10px] uppercase">
                                                            <th className="py-2 px-3 border-r border-navy-850">Muestra</th>
                                                            <th className="py-2 px-3 text-center border-r border-navy-850">Nivel</th>
                                                            <th className="py-2 px-3 text-center border-r border-navy-850">Celda Mapeo</th>
                                                            <th className="py-2 px-3 text-center border-r border-navy-850">Fuerza P (kN)</th>
                                                            <th className="py-2 px-3 text-center">Espesor D (cm)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {previewRows.map((row, i) => (
                                                            <tr key={i} className="border-b border-navy-900/40 bg-navy-900/10">
                                                                <td className="py-2 px-3 font-semibold text-slate-200 border-r border-navy-900/20">{row.codigo_muestra || '—'}</td>
                                                                <td className="py-2 px-3 text-center border-r border-navy-900/20">{row.nivel}</td>
                                                                <td className="py-2 px-3 text-center border-r border-navy-900/20 font-bold text-orange-400">{row.celda_mapeo}</td>
                                                                <td className="py-2 px-3 text-center border-r border-navy-900/20">{row.fuerza_p}</td>
                                                                <td className="py-2 px-3 text-center">{row.espesor_d}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 justify-end px-6 py-4 border-t border-navy-800/80 shrink-0 bg-navy-950/40">
                    <button type="button" onClick={() => { onClose(); resetState(); }} className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold">
                        Cancelar
                    </button>
                    <button
                        onClick={handleImportClick}
                        disabled={importedRowsState.length === 0}
                        className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-400 px-4.5 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <span>Importar Ensayos</span>
                        <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}