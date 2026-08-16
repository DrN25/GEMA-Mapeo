import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { X, FileSpreadsheet, Upload, Check, ArrowRight, AlertTriangle, Search, RefreshCw, Layers, CheckCircle2, Info } from 'lucide-react';
import { LITHOLOGY_CLASSIFICATION, resolveLithologyCascade } from '../../utils/catalogData';
import {
    PLT_COLUMN_DEFS as EXPECTED_FIELDS,
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
    // HOOKS SIEMPRE antes del early return (Rules of Hooks)
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

    const [rawGrid, setRawGrid] = useState<any[][] | null>(null);
    const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [mappings, setMappings] = useState<Record<string, number>>({});

    const [importedRowsState, setImportedRowsState] = useState<any[]>([]);

    const [groupSearch, setGroupSearch] = useState('');
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
    const [showConfirm, setShowConfirm] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [pickerQuery, setPickerQuery] = useState('');
    const [successData, setSuccessData] = useState<{ celda: string; count: number } | null>(null);

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
        setGroupSearch('');
        setSuccessData(null);
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
            let s = String(val).trim();
            if (s.includes(',')) {
                const commas = (s.match(/,/g) || []).length;
                s = commas === 1 ? s.replace(',', '.') : s.replace(/,/g, '');
            }
            const num = parseFloat(s);
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
            rowObj.codigo_muestra = cUp && mUp ? `${cUp}_${mUp}` : "";

            resolveImportedLithology(rowObj);
            list.push(rowObj);
        }
        setImportedRowsState(list);
    };

    // Modelo de grupos
    const groups = useMemo(() => groupPltRowsByCelda(importedRowsState, knownCells), [importedRowsState, knownCells]);
    const activeNorm = normalizeCeldaCode(activeWindowCelda || '');
    const activeGroup = groups.find(g => g.name === activeNorm) || null;
    const otherGroups = groups.filter(g => g.name !== activeNorm);

    const filteredOtherGroups = useMemo(() => {
        const q = groupSearch.trim().toLowerCase();
        if (!q) return otherGroups;
        return otherGroups.filter(g => g.originalName.toLowerCase().includes(q) || g.name.includes(q));
    }, [otherGroups, groupSearch]);

    const toggleSelectAllOther = () => {
        setSelectedGroups(prev => {
            const next = new Set(prev);
            const allSelected = filteredOtherGroups.every(g => next.has(g.name));
            if (allSelected) {
                filteredOtherGroups.forEach(g => next.delete(g.name));
            } else {
                filteredOtherGroups.forEach(g => next.add(g.name));
            }
            return next;
        });
    };

    useEffect(() => {
        if (!activeGroup) return;
        setSelectedGroups(prev => new Set([...prev, activeGroup.name]));
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

    const pickerTargets = useMemo(() => {
        const q = normalizeCeldaCode(pickerQuery) || '';
        const uniq = new Map<string, string>();
        for (const c of knownCells) {
            const n = normalizeCeldaCode(c);
            if (!n || n === activeNorm) continue;
            if (q && !n.includes(q)) continue;
            if (!uniq.has(n)) uniq.set(n, c);
        }
        return [...uniq.values()].sort();
    }, [knownCells, activeWindowCelda, pickerQuery]);

    const importAllTo = (target: string) => {
        const rows = selectedRows.length > 0 ? retagPltRows(selectedRows, target) : selectedRows;
        if (rows.length === 0) {
            alert("No se encontraron registros de ensayo PLT válidos para importar.");
            return;
        }
        onImportToCell(target, rows);
        setShowConfirm(false);
        setShowPicker(false);
        setSuccessData({ celda: target, count: rows.length });
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

        if (selectedOtherGroups.length === 0) {
            importAllTo(activeWindowCelda);
        } else {
            setShowConfirm(true);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 view-modal z-[55] flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md animate-fade-in text-left">
            <div className="glass-panel w-full max-w-4xl max-h-[92vh] flex flex-col border border-navy-800/80 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.6)] relative overflow-hidden bg-navy-950/95 text-xs text-slate-100">
                {/* Top accent bar */}
                <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 w-full" />

                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-navy-850 shrink-0 bg-navy-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                            <FileSpreadsheet size={22} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                <span>Importación de Ensayos PLT</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Carga de planillas Excel con normalización estricta ISRM y redondeos de ley</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { onClose(); resetState(); }}
                        className="p-2 rounded-xl hover:bg-navy-800 text-slate-400 hover:text-slate-100 transition-all border border-transparent hover:border-navy-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!file ? (
                        <div className="space-y-4">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-navy-800 hover:border-emerald-500/50 bg-navy-950/60 hover:bg-navy-900/50 rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 space-y-4 group shadow-xl"
                            >
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx" className="hidden" />
                                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto group-hover:scale-110 group-hover:bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all">
                                    <Upload size={28} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-black text-slate-100 uppercase tracking-wide">Arrastra tu planilla de Ensayos PLT aquí</p>
                                    <p className="text-xs text-slate-400 font-medium">o haz clic para explorar archivos en formato <span className="text-emerald-400 font-mono font-bold">.xlsx</span></p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Metadata del archivo cargado */}
                            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-navy-900/80 border border-navy-800 rounded-xl shadow-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                                        <FileSpreadsheet size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-100 truncate max-w-xs">{file.name}</p>
                                        <p className="text-[11px] text-slate-400">
                                            {(file.size / 1024).toFixed(1)} KB | Hoja activa: <span className="text-emerald-400 font-bold">{selectedSheet}</span>
                                        </p>
                                    </div>
                                </div>

                                {sheets.length > 1 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 font-semibold">Cambiar Hoja:</span>
                                        <select
                                            value={selectedSheet}
                                            onChange={(e) => {
                                                setSelectedSheet(e.target.value);
                                                if (workbook) processSheet(workbook, e.target.value);
                                            }}
                                            className="bg-navy-950 border border-navy-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-bold outline-none cursor-pointer focus:border-emerald-500"
                                        >
                                            {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Info de Guía / Proceso */}
                            <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-200/90 text-xs leading-relaxed space-y-1 shadow-md">
                                <div className="flex items-center gap-2 text-sky-400 font-extrabold uppercase tracking-wider text-xs">
                                    <Info size={14} className="text-sky-400" />
                                    <span>¿Cómo funciona la importación de celdas PLT?</span>
                                </div>
                                <p className="text-xs text-slate-300">
                                    Por defecto vienen preseleccionados los ensayos pertenecientes a la celda activa:{' '}
                                    <strong className="text-emerald-400 font-bold">{activeWindowCelda || '—'}</strong>. Si seleccionas datos de otras celdas contenidas en la planilla, podrás{' '}
                                    <strong className="text-slate-100">renombrarlos a la celda actual</strong> o{' '}
                                    <strong className="text-slate-100">elegir otra celda de destino</strong> existente.
                                </p>
                            </div>

                            {/* Grupo: Celda Activa (Preseleccionada) */}
                            {activeGroup && (
                                <label className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 p-4 cursor-pointer transition-all shadow-md">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedGroups.has(activeGroup.name)}
                                            onChange={() => toggleGroup(activeGroup.name)}
                                            className="accent-emerald-500 w-4 h-4 shrink-0 rounded cursor-pointer"
                                        />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 size={15} className="text-emerald-400" />
                                                <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                                                    Celda Actual: {activeGroup.originalName}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                                                    Destino Principal
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5 font-medium">Los ensayos se asignarán e integrarán directamente en la celda abierta.</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 rounded-full shrink-0">
                                        {activeGroup.rows.length} registros
                                    </span>
                                </label>
                            )}

                            {/* Celdas Adicionales Detectadas en la Planilla */}
                            {otherGroups.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-navy-850">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                            <Layers size={14} className="text-violet-400" />
                                            <span>Otras Celdas detectadas en la Planilla ({otherGroups.length})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Filtrar celda..."
                                                    value={groupSearch}
                                                    onChange={e => setGroupSearch(e.target.value)}
                                                    className="bg-navy-950 border border-navy-800 focus:border-violet-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 transition-all outline-none"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={toggleSelectAllOther}
                                                className="px-2.5 py-1 rounded-lg border border-navy-700 bg-navy-900 text-slate-300 hover:text-white hover:border-slate-600 transition-all text-xs font-semibold"
                                            >
                                                {filteredOtherGroups.length > 0 && filteredOtherGroups.every(g => selectedGroups.has(g.name)) ? 'Desmarcar todas' : 'Marcar todas'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Lista compacta ultra limpia */}
                                    <div className="max-h-[380px] overflow-y-auto space-y-1.5 p-1.5 bg-navy-950/70 border border-navy-850 rounded-xl shadow-inner">
                                        {filteredOtherGroups.length === 0 ? (
                                            <p className="text-xs text-slate-500 text-center py-4">No se encontraron celdas con ese filtro.</p>
                                        ) : (
                                            filteredOtherGroups.map(g => {
                                                const isSel = selectedGroups.has(g.name);
                                                return (
                                                    <label
                                                        key={g.name}
                                                        className={`flex items-center justify-between px-3.5 py-2 rounded-lg border transition-all cursor-pointer select-none ${isSel
                                                            ? 'border-violet-500/40 bg-violet-500/10 text-slate-100'
                                                            : 'border-navy-800/80 bg-navy-900/40 hover:bg-navy-850/80 text-slate-300'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSel}
                                                                onChange={() => toggleGroup(g.name)}
                                                                className="accent-violet-500 w-4 h-4 shrink-0 rounded cursor-pointer"
                                                            />
                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${g.exists ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                                            <span className="text-xs font-mono font-bold uppercase tracking-wide text-slate-200 truncate">{g.originalName}</span>
                                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${g.exists ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'}`}>
                                                                {g.exists ? 'En Sistema' : 'Sin Registro Previo'}
                                                            </span>
                                                        </div>

                                                        <span className="text-xs font-mono font-bold text-slate-300 bg-navy-950 border border-navy-800 px-2.5 py-0.5 rounded-md shrink-0">
                                                            {g.rows.length} reg.
                                                        </span>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Tabla de Vista Previa */}
                            {selectedRows.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                            Vista Previa — <span className="text-emerald-400 font-mono">{selectedRows.length}</span> registros listos para importar
                                        </h4>
                                    </div>
                                    <div className="overflow-x-auto border border-navy-800 rounded-xl max-h-56 overflow-y-auto shadow-inner bg-navy-950/60">
                                        <table className="w-full text-xs text-left border-collapse text-slate-300">
                                            <thead className="bg-navy-900 text-slate-400 font-bold border-b border-navy-800 text-xs uppercase sticky top-0">
                                                <tr>
                                                    <th className="py-2.5 px-3 border-r border-navy-800">Código Muestra</th>
                                                    <th className="py-2.5 px-3 text-center border-r border-navy-800">Celda Mapeo</th>
                                                    <th className="py-2.5 px-3 text-center border-r border-navy-800">Nivel</th>
                                                    <th className="py-2.5 px-3 text-center border-r border-navy-800">Fuerza P (kN)</th>
                                                    <th className="py-2.5 px-3 text-center border-r border-navy-800">Espesor D (cm)</th>
                                                    <th className="py-2.5 px-3 text-center">Unidad Litológica</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedRows.map((row, i) => (
                                                    <tr key={i} className="border-b border-navy-900/60 hover:bg-navy-900/40 transition-colors">
                                                        <td className="py-2 px-3 font-semibold text-slate-200 border-r border-navy-900/40">{row.codigo_muestra || '—'}</td>
                                                        <td className="py-2 px-3 text-center border-r border-navy-900/40 font-bold text-emerald-400 font-mono">{row.celda_mapeo}</td>
                                                        <td className="py-2 px-3 text-center border-r border-navy-900/40 font-mono">{row.nivel}</td>
                                                        <td className="py-2 px-3 text-center border-r border-navy-900/40 font-mono">{row.fuerza_p}</td>
                                                        <td className="py-2 px-3 text-center border-r border-navy-900/40 font-mono">{row.espesor_d}</td>
                                                        <td className="py-2 px-3 text-center font-medium text-slate-300">{row.tipo_litologico}</td>
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

                {/* MODAL CONFIRMACIÓN REDISEÑADO (Sombra glassmorphism con botones de tarjeta) */}
                {showConfirm && !showPicker && (
                    <div className="fixed inset-0 view-modal z-[65] flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fade-in">
                        <div className="glass-panel w-full max-w-xl p-6 rounded-2xl border border-amber-500/40 shadow-2xl bg-navy-900/95 space-y-5">
                            <div className="flex items-start gap-3.5 border-b border-navy-800 pb-4">
                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                                    <AlertTriangle size={24} />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">Celdas con otro código seleccionadas</h4>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Seleccionaste <strong className="text-amber-400">{selectedRows.length}</strong> registro(s) provenientes de{' '}
                                        <strong className="text-amber-400">{selectedOtherGroups.length}</strong> celda(s) diferente(s):{' '}
                                        <span className="text-slate-100 font-bold">{selectedOtherGroups.map(g => g.originalName).join(', ')}</span>.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowConfirm(false); importAllTo(activeWindowCelda || ''); }}
                                    disabled={!activeWindowCelda}
                                    className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-left transition-all flex items-start gap-3.5 group cursor-pointer disabled:opacity-40"
                                >
                                    <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform">
                                        <RefreshCw size={18} />
                                    </div>
                                    <div>
                                        <span className="text-xs font-black text-emerald-300 block uppercase tracking-wider">
                                            Renombrar TODAS las celdas seleccionadas a la celda actual ({activeWindowCelda || '—'})
                                        </span>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Los {selectedRows.length} registros se re-etiquetarán e importarán como si pertenecieran a la celda actual.
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowPicker(true)}
                                    className="p-4 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-left transition-all flex items-start gap-3.5 group cursor-pointer"
                                >
                                    <div className="p-2 bg-sky-500/20 rounded-lg text-sky-400 group-hover:scale-110 transition-transform">
                                        <Search size={18} />
                                    </div>
                                    <div>
                                        <span className="text-xs font-black text-sky-300 block uppercase tracking-wider">Elegir otra celda de destino</span>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Todos los registros seleccionados se importarán a la celda existente que elijas.
                                        </p>
                                    </div>
                                </button>
                            </div>

                            <div className="flex justify-end border-t border-navy-800 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(false)}
                                    className="bg-navy-950 border border-navy-800 hover:bg-navy-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                                >
                                    Volver
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL PICKER DESTINO REDISEÑADO */}
                {showPicker && showConfirm && (
                    <div className="fixed inset-0 view-modal z-[65] flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fade-in">
                        <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-sky-500/40 shadow-2xl bg-navy-900/95 space-y-4">
                            <div>
                                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">Elegir Celda de Destino</h4>
                                <p className="text-xs text-slate-400 mt-1">
                                    Los <strong className="text-sky-400">{selectedRows.length}</strong> registros seleccionados se importarán a la celda elegida.
                                </p>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar celda por código..."
                                    value={pickerQuery}
                                    onChange={(e) => setPickerQuery(e.target.value)}
                                    className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                />
                                <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            </div>

                            <div className="space-y-1 max-h-56 overflow-y-auto border border-navy-800 rounded-xl p-1 bg-navy-950/40">
                                {pickerTargets.length === 0 && (
                                    <p className="text-xs text-slate-500 text-center py-6">No hay celdas disponibles en el sistema.</p>
                                )}
                                {pickerTargets.map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => importAllTo(t)}
                                        className="w-full text-left px-3.5 py-2 rounded-lg hover:bg-sky-500/10 border border-transparent hover:border-sky-500/30 text-xs font-bold font-mono text-slate-200 transition-all flex items-center justify-between group"
                                    >
                                        <span>{t}</span>
                                        <ArrowRight size={14} className="text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))}
                            </div>

                            <div className="flex justify-end gap-2 border-t border-navy-800 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowPicker(false)}
                                    className="bg-navy-950 border border-navy-800 hover:bg-navy-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                                >
                                    Volver
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUB-MODAL RESULTADO DE IMPORTACIÓN EXITOSA (Estilo SaveResultModal) */}
                {successData && (
                    <div className="fixed inset-0 view-modal z-[70] flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fade-in text-left">
                        <div className="glass-panel w-full max-w-md flex flex-col border border-emerald-500/40 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/95 text-slate-100">
                            <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 w-full shrink-0" />

                            <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                                        <CheckCircle2 size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                                            Importación Exitosa Completada
                                        </h3>
                                        <p className="text-xs text-slate-400">Registros PLT integrados correctamente</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setSuccessData(null); onClose(); resetState(); }}
                                    className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-navy-950/80 border border-emerald-500/30 p-3.5 rounded-xl text-center flex flex-col items-center">
                                        <FileSpreadsheet size={18} className="text-emerald-400 mb-1" />
                                        <span className="text-xl font-black font-mono text-emerald-400">{successData.count}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registros PLT</span>
                                    </div>

                                    <div className="bg-navy-950/80 border border-emerald-500/30 p-3.5 rounded-xl text-center flex flex-col items-center">
                                        <Layers size={18} className="text-teal-400 mb-1" />
                                        <span className="text-sm font-black font-mono text-teal-300 truncate max-w-[120px]">{successData.celda}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Celda Destino</span>
                                    </div>
                                </div>

                                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs text-center font-medium leading-relaxed">
                                    Se han añadido <strong className="text-white font-bold">{successData.count} registros</strong> a los Ensayos PLT de la celda <strong className="text-white font-bold">{successData.celda}</strong>.
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-navy-800/80 bg-navy-950/40 flex justify-center shrink-0">
                                <button
                                    type="button"
                                    onClick={() => { setSuccessData(null); onClose(); resetState(); }}
                                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 text-xs font-black tracking-wide transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <CheckCircle2 size={16} />
                                    <span>Entendido, Continuar</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Buttons */}
                <div className="flex gap-2 justify-end px-6 py-4 border-t border-navy-850 shrink-0 bg-navy-900/60">
                    <button
                        type="button"
                        onClick={() => { onClose(); resetState(); }}
                        className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 hover:text-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleImportClick}
                        disabled={selectedRows.length === 0 || !activeWindowCelda}
                        className="bg-emerald-500 hover:bg-emerald-400 text-navy-950 px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <span>Importar Ensayos</span>
                        <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}