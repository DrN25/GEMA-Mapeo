import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { X, FileSpreadsheet, Upload, Check, ArrowRight, Filter, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import { LITHOLOGY_CLASSIFICATION, resolveLithologyCascade } from '../../utils/catalogData';
import {
    PLT_COLUMN_DEFS as EXPECTED_FIELDS,
    getPltConstraints,
    normalizeTipoLitologico,
    normalizeCeldaCode
} from '../../utils/geomecColumns';
import { groupPltRowsByCelda, retagPltRows } from '../../utils/pltImportHelpers';

interface PltExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Importa registros a UNA celda de destino. Si la celda no es la activa,
     *  App cambia la ventana activa y la vista a Ensayos PLT automáticamente. */
    onImportToCell: (celda: string, rows: any[]) => void;
    activeWindowCelda: string | null;
    /** Celdas que existen en el sistema (BD + borradores locales) — SSOT de App. */
    knownCells: string[];
}

export default function PltExcelImportModal({
    isOpen,
    onClose,
    onImportToCell,
    activeWindowCelda,
    knownCells
}: PltExcelImportModalProps) {
    // HOOKS SIEMPRE antes del early return (Rules of Hooks — el modal monta
    // siempre y solo renderiza cuando isOpen; alternar el orden crashea React).
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

    const [rawGrid, setRawGrid] = useState<any[][] | null>(null);
    const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [mappings, setMappings] = useState<Record<string, number>>({});

    const [importedRowsState, setImportedRowsState] = useState<any[]>([]);

    // Selección estilo Mapeo: checkbox por CELDA (grupo). La celda activa viene
    // preseleccionada; al importar, TODAS las seleccionadas van a UNA celda de
    // destino (renombrando o eligiendo otra celda en la confirmación).
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
    // Sub-modal de confirmación (estilo ExcelImportModal de Mapeo)
    const [showConfirm, setShowConfirm] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [pickerQuery, setPickerQuery] = useState('');

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
        setSelectedGroups(new Set());
        setShowConfirm(false);
        setShowPicker(false);
        setPickerQuery('');
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
        const cleanL1 = String(rowObj.litologia_1 || "").trim().toUpperCase();
        const cleanL2 = String(rowObj.litologia_2 || "").trim().toUpperCase();
        const cleanL3 = String(rowObj.litologia_3 || "").trim().toUpperCase();
        const cleanM2022 = String(rowObj.model2022 || "").trim().toUpperCase();

        const res = resolveLithologyCascade(cleanL1, cleanL2, cleanL3, cleanM2022 || null);
        rowObj.litologia_1 = res.lito1;
        rowObj.litologia_2 = res.lito2;
        rowObj.litologia_3 = res.lito3;
        rowObj.tipo_litologico = res.clase;
        rowObj.factor_conversion_k = res.k;
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
                tipo_ensayo: getStr(row, 'tipo_ensayo', 'i') || 'i',
                zona_mapeo: getStr(row, 'zona_mapeo'),
                nivel: Math.round(nivelVal * 100) / 100,
                celda_mapeo: celdaMapeo,
                muestra: getStr(row, 'muestra'),
                codigo_muestra: "",
                litologia_1: getStr(row, 'litologia_1'),
                litologia_2: getStr(row, 'litologia_2'),
                litologia_3: getStr(row, 'litologia_3'),
                model2022: getStr(row, 'model2022'),
                tipo_litologico: getStr(row, 'tipo_litologico', 'INTRUSIVOS'),
                este: getVal(row, 'este') !== null && getVal(row, 'este') !== "" ? Math.round(Math.abs(getNum(row, 'este')) * 10000) / 10000 : null,
                norte: getVal(row, 'norte') !== null && getVal(row, 'norte') !== "" ? Math.round(Math.abs(getNum(row, 'norte')) * 1000) / 1000 : null,
                elevacion: getVal(row, 'elevacion') !== null && getVal(row, 'elevacion') !== "" ? Math.round(Math.abs(getNum(row, 'elevacion')) * 100) / 100 : null,
                espesor_d: getVal(row, 'espesor_d') !== null && getVal(row, 'espesor_d') !== "" ? Math.round(Math.abs(getNum(row, 'espesor_d')) * 10) / 10 : null,
                longitud_l: getVal(row, 'longitud_l') !== null && getVal(row, 'longitud_l') !== "" ? Math.round(Math.abs(getNum(row, 'longitud_l')) * 100) / 100 : null,
                ancho_w1: getVal(row, 'ancho_w1') !== null && getVal(row, 'ancho_w1') !== "" ? Math.round(Math.abs(getNum(row, 'ancho_w1')) * 100) / 100 : null,
                ancho_w2: getVal(row, 'ancho_w2') !== null && getVal(row, 'ancho_w2') !== "" ? Math.round(Math.abs(getNum(row, 'ancho_w2')) * 100) / 100 : null,
                fuerza_p: getVal(row, 'fuerza_p') !== null && getVal(row, 'fuerza_p') !== "" ? Math.round(Math.abs(getNum(row, 'fuerza_p')) * 1000) / 1000 : null,
                direccion_rotura: (() => {
                    const rawDir = getStr(row, 'direccion_rotura', 'Pa').trim();
                    const cleanDir = rawDir.toUpperCase().replace(/\//g, "").replace(/\./g, "");
                    if (cleanDir === "PA" || cleanDir === "PARALELA") return "Pa";
                    if (cleanDir === "PE" || cleanDir === "PERPENDICULAR") return "Pe";
                    return "NA";
                })(),
                tipo_fractura: (() => {
                    const rawFrac = getStr(row, 'tipo_fractura', 'M').trim().toUpperCase();
                    if (rawFrac === "E" || rawFrac.includes("ESTRUCTURA")) return "E";
                    if (rawFrac === "C" || rawFrac.includes("COMBINADA")) return "C";
                    return "M";
                })(),
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

    // ============ Modelo de grupos (celdas reconocidas en el Excel) ============
    const groups = useMemo(() => groupPltRowsByCelda(importedRowsState, knownCells), [importedRowsState, knownCells]);
    const activeNorm = normalizeCeldaCode(activeWindowCelda || '');
    const activeGroup = groups.find(g => g.name === activeNorm) || null;
    const otherGroups = groups.filter(g => g.name !== activeNorm);

    // Por defecto: preseleccionada la celda actual (estilo Mapeo)
    useEffect(() => {
        if (!activeGroup) return;
        setSelectedGroups(prev => new Set([...prev, activeGroup.name]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [importedRowsState, activeWindowCelda]);

    const selectedRows = useMemo(() => {
        return groups.filter(g => selectedGroups.has(g.name)).flatMap(g => g.rows);
    }, [groups, selectedGroups]);

    const selectedOtherGroups = useMemo(
        () => otherGroups.filter(g => selectedGroups.has(g.name)),
        [otherGroups, selectedGroups]
    );

    const toggleGroup = (name: string) => {
        setSelectedGroups(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    // Celdas destino del picker: SOLO las que existen en el sistema (excluye la
    // activa). Se listan con su CÓDIGO REAL (p.ej. "RTF_001"); la normalización
    // solo se usa para comparar/buscar.
    const pickerTargets = useMemo(() => {
        const q = normalizeCeldaCode(pickerQuery) || '';
        const uniq = new Map<string, string>(); // normalized → código real
        for (const c of knownCells) {
            const n = normalizeCeldaCode(c);
            if (!n || n === activeNorm) continue;
            if (q && !n.includes(q)) continue;
            if (!uniq.has(n)) uniq.set(n, c);
        }
        return [...uniq.values()].sort();
    }, [knownCells, activeWindowCelda, pickerQuery]);

    // Importar a la celda destino con TODOS los registros seleccionados
    // (los de otras celdas se re-etiquetan al destino — decisión única).
    const importAllTo = (target: string) => {
        const rows = selectedRows.length > 0 ? retagPltRows(selectedRows, target) : selectedRows;
        if (rows.length === 0) {
            alert("No se encontraron registros de ensayo PLT válidos para importar.");
            return;
        }
        onImportToCell(target, rows);
        onClose();
        resetState();
    };

    const handleImportClick = () => {
        if (!activeWindowCelda) {
            alert("No hay una celda activa para importar los registros.");
            return;
        }
        const rows = selectedRows;
        if (rows.length === 0) {
            alert("Selecciona al menos una celda con registros para importar.");
            return;
        }

        if (rows.length > 500) {
            const confirmBigImport = window.confirm(
                `¡ADVERTENCIA DE RENDIMIENTO!\n\nVas a importar ${rows.length} registros de golpe. Cargar planillas masivas puede ralentizar el rendimiento del navegador.\n\n¿Deseas continuar?`
            );
            if (!confirmBigImport) return;
        }

        // Todo pertenece a la celda actual → importar directo.
        // Hay celdas de OTROS nombres seleccionadas → confirmación única.
        if (selectedOtherGroups.length === 0) {
            importAllTo(activeWindowCelda);
        } else {
            setShowConfirm(true);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
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

                            <div className="grid grid-cols-1 gap-6">
                                {/* MAPEO DE COLUMNAS — COMENTADO DE MOMENTO (el mapeo es automático por sinónimos)
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
                                */}

                                <div className="space-y-4">
                                    {importedRowsState.length > 0 && (
                                        <div className="space-y-4">
                                            {/* Info del proceso */}
                                            <div className="p-3.5 rounded-xl border border-sky-500/25 bg-sky-500/5 text-sky-200/90 text-[11px] leading-relaxed space-y-1">
                                                <span className="font-black uppercase tracking-wider text-sky-400 text-[10px] block">¿Cómo funciona la importación?</span>
                                                <p>
                                                    Por defecto están seleccionados los registros con el nombre de la celda actual:{' '}
                                                    <strong className="text-white">{activeWindowCelda || '—'}</strong>. También puedes importar
                                                    registros que tengan otro código de celda en el archivo, pero deberás{' '}
                                                    <strong className="text-white">renombrarlos a la celda actual</strong> o{' '}
                                                    <strong className="text-white">elegir otra celda de destino</strong> (la vista cambiará
                                                    automáticamente a esa celda).
                                                </p>
                                            </div>

                                            {/* Grupo: celda activa */}
                                            {activeGroup && (
                                                <label className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 px-3.5 py-3 cursor-pointer transition-all">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedGroups.has(activeGroup.name)}
                                                        onChange={() => toggleGroup(activeGroup.name)}
                                                        className="accent-emerald-500 w-4 h-4 shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <Check size={14} className="text-emerald-400 shrink-0" />
                                                            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 truncate">
                                                                Celda actual: {activeGroup.originalName}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400 shrink-0">({activeGroup.rows.length} registros)</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 mt-0.5">Se importará directamente a la celda actual.</p>
                                                    </div>
                                                    <span className="text-[10px] font-black font-mono text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full shrink-0">
                                                        {activeGroup.rows.length}
                                                    </span>
                                                </label>
                                            )}

                                            {/* Otras celdas del Excel (checkbox estilo Mapeo) */}
                                            {otherGroups.map(g => {
                                                const isSel = selectedGroups.has(g.name);
                                                return (
                                                    <label key={g.name} className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 cursor-pointer transition-all ${isSel ? 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10' : 'border-navy-800 bg-navy-950/40 hover:bg-navy-900/40'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSel}
                                                            onChange={() => toggleGroup(g.name)}
                                                            className="accent-amber-500 w-4 h-4 shrink-0 mt-0.5"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`w-2 h-2 rounded-full shrink-0 ${g.exists ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                                                <span className="text-xs font-black uppercase tracking-wider text-slate-200 truncate">{g.originalName}</span>
                                                                <span className="text-[10px] font-bold text-slate-400">({g.rows.length} registros)</span>
                                                                {g.exists ? (
                                                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded">Existe</span>
                                                                ) : (
                                                                    <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 rounded">No existe</span>
                                                                )}
                                                            </div>
                                                            {isSel && (
                                                                <p className="text-[10px] text-amber-300/80 mt-1">
                                                                    Al importar se te pedirá renombrar estos registros a la celda actual o elegir otra celda de destino.
                                                                </p>
                                                            )}
                                                            {!g.exists && (
                                                                <p className="text-[10px] text-rose-300/80 mt-1">
                                                                    ⚠️ La celda {g.originalName} no tiene registro disponible en el sistema. Solo podrás renombrar sus registros a una celda existente.
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-black font-mono text-slate-300 bg-navy-900 border border-navy-800 px-2 py-0.5 rounded-full shrink-0">
                                                            {g.rows.length}
                                                        </span>
                                                    </label>
                                                );
                                            })}

                                            {/* Vista previa de lo que se importará */}
                                            {selectedRows.length > 0 && (
                                                <div className="space-y-2">
                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                                        Vista previa — {selectedRows.length} registros seleccionados
                                                    </h4>
                                                    <div className="overflow-x-auto border border-navy-850 rounded-lg max-h-64 overflow-y-auto">
                                                        <table className="w-full text-xs text-left border-collapse text-slate-300">
                                                            <thead className="bg-navy-950 text-slate-400 font-semibold border-b border-navy-850 text-[10px] uppercase sticky top-0">
                                                                <tr>
                                                                    <th className="py-2 px-3 border-r border-navy-850">Código Muestra</th>
                                                                    <th className="py-2 px-3 text-center border-r border-navy-850">Celda</th>
                                                                    <th className="py-2 px-3 text-center border-r border-navy-850">Nivel</th>
                                                                    <th className="py-2 px-3 text-center border-r border-navy-850">Fuerza P (kN)</th>
                                                                    <th className="py-2 px-3 text-center">Espesor D (cm)</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {selectedRows.map((row, i) => (
                                                                    <tr key={i} className="border-b border-navy-900/40 bg-navy-900/10">
                                                                        <td className="py-1.5 px-3 font-semibold text-slate-200 border-r border-navy-900/20">{row.codigo_muestra || '—'}</td>
                                                                        <td className="py-1.5 px-3 text-center border-r border-navy-900/20 font-bold text-orange-400">{row.celda_mapeo}</td>
                                                                        <td className="py-1.5 px-3 text-center border-r border-navy-900/20">{row.nivel}</td>
                                                                        <td className="py-1.5 px-3 text-center border-r border-navy-900/20">{row.fuerza_p}</td>
                                                                        <td className="py-1.5 px-3 text-center">{row.espesor_d}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* SUB-MODAL: confirmación única (estilo ExcelImportModal de Mapeo) */}
                {showConfirm && !showPicker && (
                    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fade-in">
                        <div className="glass-panel w-full max-w-xl p-5 rounded-2xl border border-amber-500/40 shadow-2xl bg-navy-900/95 space-y-4">
                            <div className="flex items-start gap-3 border-b border-navy-800 pb-3">
                                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                                    <AlertTriangle size={22} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">Celdas con otro código seleccionadas</h4>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Seleccionaste <strong className="text-amber-400">{selectedRows.length}</strong> registro(s) de{' '}
                                        <strong className="text-amber-400">{selectedOtherGroups.length}</strong> celda(s) que no es la actual:{' '}
                                        <span className="text-slate-200 font-bold">{selectedOtherGroups.map(g => g.originalName).join(', ')}</span>.
                                        La importación va a UNA sola celda: elige cómo proceder.
                                    </p>
                                    {selectedOtherGroups.some(g => !g.exists) && (
                                        <p className="text-[11px] text-rose-300 mt-1">
                                            ⚠️ Algunas celdas no existen en el sistema: sus registros solo podrán renombrarse a una celda existente.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowConfirm(false); importAllTo(activeWindowCelda || ''); }}
                                    disabled={!activeWindowCelda}
                                    className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-left transition-all flex items-start gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <RefreshCw size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-xs font-black text-amber-300 block uppercase tracking-wider">
                                            Renombrar TODAS las celdas seleccionadas a la celda actual ({activeWindowCelda || '—'})
                                        </span>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Los {selectedRows.length} registros se importarán como si pertenecieran a la celda actual.
                                        </p>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowPicker(true)}
                                    className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-left transition-all flex items-start gap-3"
                                >
                                    <Search size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-xs font-black text-emerald-300 block uppercase tracking-wider">Elegir otra celda de destino</span>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Todos los registros seleccionados se importarán a UNA celda; la vista cambiará automáticamente a esa celda.
                                        </p>
                                    </div>
                                </button>
                            </div>
                            <div className="flex justify-end border-t border-navy-800 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(false)}
                                    className="bg-navy-950 border border-navy-800 hover:bg-navy-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold"
                                >
                                    Volver
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUB-MODAL: elegir celda de destino (solo celdas existentes) */}
                {showPicker && showConfirm && (
                    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fade-in">
                        <div className="glass-panel w-full max-w-md p-5 rounded-2xl border border-emerald-500/40 shadow-2xl bg-navy-900/95 space-y-4">
                            <div>
                                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">Elegir celda de destino</h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Los {selectedRows.length} registros seleccionados se importarán a la celda que elijas.
                                </p>
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar celda..."
                                    value={pickerQuery}
                                    onChange={(e) => setPickerQuery(e.target.value)}
                                    className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                            </div>
                            <div className="space-y-1 max-h-52 overflow-y-auto">
                                {pickerTargets.length === 0 && (
                                    <p className="text-[11px] text-slate-500 text-center py-4">No hay celdas disponibles en el sistema.</p>
                                )}
                                {pickerTargets.map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => importAllTo(t)}
                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 text-xs font-bold font-mono text-slate-200"
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2 border-t border-navy-800 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowPicker(false)}
                                    className="bg-navy-950 border border-navy-800 hover:bg-navy-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold"
                                >
                                    Volver
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex gap-2 justify-end px-6 py-4 border-t border-navy-800/80 shrink-0 bg-navy-950/40">
                    <button type="button" onClick={() => { onClose(); resetState(); }} className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold">
                        Cancelar
                    </button>
                    <button
                        onClick={handleImportClick}
                        disabled={selectedRows.length === 0 || !activeWindowCelda}
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