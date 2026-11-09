import React, { useState, useMemo, useEffect } from 'react';
import {
    Search, BookOpen, AlertTriangle, AlertCircle, Info,
    CheckCircle2, XCircle, Copy, Check, X,
    ArrowRight, Tag, RefreshCw, Layers, ShieldCheck,
    Compass, Sparkles
} from 'lucide-react';
import { getAuthHeaders } from '../../../utils/apiClient';
import fallbackRulesData from '../data/reglasFallback.json';

export interface ReglaCatalogo {
    code: string;
    category_code: string;
    category_name: string;
    columns: string[];
    severity: 'ALERTA' | 'ADVERTENCIA' | 'VACIO' | string;
    description: string;
    technical_formula?: string;
    example_ok?: string;
    example_error?: string;
    tipo_mapeo: string;
    message_template?: string;
}

interface ReglasCatalogoViewProps {
    apiBase: string;
    initialSelectedRule?: string | null;
    onBackToAudit?: () => void;
}

export default function ReglasCatalogoView({
    apiBase,
    initialSelectedRule = null,
    onBackToAudit
}: ReglasCatalogoViewProps) {
    const [reglas, setReglas] = useState<ReglaCatalogo[]>(() => fallbackRulesData as ReglaCatalogo[]);
    const [loading, setLoading] = useState<boolean>(false);
    const [selectedRule, setSelectedRule] = useState<ReglaCatalogo | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Filtros
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedColumn, setSelectedColumn] = useState<string>('TODAS');
    const [selectedSeverity, setSelectedSeverity] = useState<string>('TODAS');
    const [selectedScope, setSelectedScope] = useState<string>('TODOS');
    const [sortBy, setSortBy] = useState<'code' | 'severity' | 'category'>('code');

    // Cargar reglas desde la API (con fallback inmediato)
    useEffect(() => {
        let isMounted = true;
        const fetchReglas = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${apiBase}/api/geomecanica/reglas`, {
                    headers: getAuthHeaders(),
                    cache: 'no-store'
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0 && isMounted) {
                        setReglas(data);
                    }
                }
            } catch (err) {
                console.warn('Usando catálogo local de reglas (modo fallback offline):', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchReglas();
        return () => {
            isMounted = false;
        };
    }, [apiBase]);

    // Seleccionar regla inicial si viene como prop
    useEffect(() => {
        if (initialSelectedRule && reglas.length > 0) {
            const found = reglas.find(r => r.code === initialSelectedRule);
            if (found) setSelectedRule(found);
        }
    }, [initialSelectedRule, reglas]);

    // Cerrar modal con tecla Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedRule) {
                setSelectedRule(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRule]);

    // Listado ordenado de columnas únicas con su conteo de ocurrencias
    const columnStats = useMemo(() => {
        const counts: Record<string, number> = {};
        reglas.forEach(r => {
            (r.columns || []).forEach(col => {
                const trimmed = col.trim();
                if (trimmed) {
                    counts[trimmed] = (counts[trimmed] || 0) + 1;
                }
            });
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [reglas]);

    // Columnas destacadas para acceso rápido
    const topQuickColumns = useMemo(() => {
        const priorityList = [
            'Nivel', 'Dist.Celda', 'Dist. de estr.', 'TIPO', 'DIP',
            'DIP DIRECTION', 'ESTE_FROM', 'NORTE_FROM', 'COTA_FROM',
            'x', 'y', 'z', 'JRC', 'ABERTURA mm.', 'ESPESOR mm.',
            'Lito 1', 'RQD', 'CELDA'
        ];
        return priorityList.filter(col => columnStats.some(([c]) => c === col));
    }, [columnStats]);

    // Métricas globales para badges superiores
    const metrics = useMemo(() => {
        const total = reglas.length;
        const alertas = reglas.filter(r => r.severity === 'ALERTA').length;
        const advertencias = reglas.filter(r => r.severity === 'ADVERTENCIA').length;
        const vacios = reglas.filter(r => r.severity === 'VACIO').length;
        const celdas = reglas.filter(r => r.tipo_mapeo?.toLowerCase().includes('celda')).length;
        const estructuras = reglas.filter(r => r.tipo_mapeo?.toLowerCase().includes('estructura')).length;
        return { total, alertas, advertencias, vacios, celdas, estructuras };
    }, [reglas]);

    // Filtrado interactivo
    const filteredReglas = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();

        return reglas.filter(r => {
            // Filtro por Severidad
            if (selectedSeverity !== 'TODAS' && r.severity !== selectedSeverity) {
                return false;
            }

            // Filtro por Ámbito
            if (selectedScope !== 'TODOS') {
                const isCelda = r.tipo_mapeo?.toLowerCase().includes('celda');
                if (selectedScope === 'CELDAS' && !isCelda) return false;
                if (selectedScope === 'ESTRUCTURAS' && isCelda) return false;
            }

            // Filtro por Columna
            if (selectedColumn !== 'TODAS') {
                const hasCol = (r.columns || []).some(
                    col => col.toLowerCase() === selectedColumn.toLowerCase()
                );
                if (!hasCol) return false;
            }

            // Filtro por texto de búsqueda
            if (q) {
                const matchCode = r.code?.toLowerCase().includes(q);
                const matchCat = r.category_name?.toLowerCase().includes(q);
                const matchDesc = r.description?.toLowerCase().includes(q);
                const matchForm = r.technical_formula?.toLowerCase().includes(q);
                const matchCols = (r.columns || []).some(col => col.toLowerCase().includes(q));
                if (!matchCode && !matchCat && !matchDesc && !matchForm && !matchCols) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            if (sortBy === 'severity') {
                const weight = (s: string) => (s === 'ALERTA' ? 3 : s === 'ADVERTENCIA' ? 2 : 1);
                const diff = weight(b.severity) - weight(a.severity);
                if (diff !== 0) return diff;
                return a.code.localeCompare(b.code);
            }
            if (sortBy === 'category') {
                return (a.category_name || '').localeCompare(b.category_name || '');
            }
            return a.code.localeCompare(b.code);
        });
    }, [reglas, searchTerm, selectedSeverity, selectedScope, selectedColumn, sortBy]);

    const handleCopyCode = (code: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const handleSelectColumnFilter = (col: string) => {
        setSelectedColumn(prev => (prev === col ? 'TODAS' : col));
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setSelectedColumn('TODAS');
        setSelectedSeverity('TODAS');
        setSelectedScope('TODOS');
        setSortBy('code');
    };

    const hasActiveFilters = searchTerm !== '' || selectedColumn !== 'TODAS' || selectedSeverity !== 'TODAS' || selectedScope !== 'TODOS';

    return (
        <div className="flex-1 flex flex-col h-full bg-navy-950 text-slate-100 overflow-hidden font-sans">
            {/* Encabezado Principal */}
            <div className="bg-navy-900 border-b border-navy-800 px-6 py-4 shrink-0 shadow-sm dark:shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-600 dark:text-cyan-400 shadow-inner">
                            <BookOpen size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-black tracking-tight text-slate-100">
                                    Diccionario de Reglas Geomecánicas
                                </h1>
                                <span className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-[11px] font-black px-2 py-0.5 rounded-full">
                                    {metrics.total} Reglas
                                </span>
                                {loading && (
                                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                        <RefreshCw size={12} className="animate-spin text-cyan-500" />
                                        Sincronizando...
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 font-medium">
                                Catálogo de validación y control de calidad QA/QC para mapeo de celdas y estructuras geomecánicas.
                            </p>
                        </div>
                    </div>

                    {/* Botones de acción / métricas en píldoras */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="hidden lg:flex items-center gap-1.5 bg-navy-950 p-1.5 rounded-xl border border-navy-800 text-[11px]">
                            <span className="px-2 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 rounded-lg font-black flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                {metrics.alertas} Alertas
                            </span>
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 rounded-lg font-black flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                {metrics.advertencias} Advertencias
                            </span>
                            <span className="px-2 py-0.5 bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30 rounded-lg font-black flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                                {metrics.vacios} Obligatorios
                            </span>
                        </div>

                        {onBackToAudit && (
                            <button
                                onClick={onBackToAudit}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-100 dark:text-slate-950 font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                            >
                                <Layers size={14} />
                                <span>Volver a Revisión</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Barra de Filtros y Búsqueda */}
                <div className="mt-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                    {/* Input de Búsqueda Rápida */}
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar regla por código, columna (ej: Nivel, Dist.Celda), fórmula o descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-navy-950 border border-navy-800 focus:border-cyan-500 text-slate-100 placeholder:text-slate-400 text-xs rounded-xl pl-10 pr-9 py-2 transition-all outline-none shadow-inner"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filtro por Ámbito */}
                    <div className="inline-flex p-0.5 bg-navy-950 rounded-xl border border-navy-800 shrink-0">
                        <button
                            onClick={() => setSelectedScope('TODOS')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                selectedScope === 'TODOS'
                                    ? 'bg-navy-800 text-slate-100 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-100'
                            }`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setSelectedScope('CELDAS')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                selectedScope === 'CELDAS'
                                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-100'
                            }`}
                        >
                            Celdas ({metrics.celdas})
                        </button>
                        <button
                            onClick={() => setSelectedScope('ESTRUCTURAS')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                selectedScope === 'ESTRUCTURAS'
                                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-100'
                            }`}
                        >
                            Estructuras ({metrics.estructuras})
                        </button>
                    </div>

                    {/* Filtro por Severidad */}
                    <div className="inline-flex p-0.5 bg-navy-950 rounded-xl border border-navy-800 shrink-0">
                        <button
                            onClick={() => setSelectedSeverity('TODAS')}
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                selectedSeverity === 'TODAS'
                                    ? 'bg-navy-800 text-slate-100 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-100'
                            }`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => setSelectedSeverity('ALERTA')}
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                selectedSeverity === 'ALERTA'
                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                                    : 'text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300'
                            }`}
                        >
                            Alertas
                        </button>
                        <button
                            onClick={() => setSelectedSeverity('ADVERTENCIA')}
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                selectedSeverity === 'ADVERTENCIA'
                                    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/40'
                                    : 'text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300'
                            }`}
                        >
                            Advertencias
                        </button>
                        <button
                            onClick={() => setSelectedSeverity('VACIO')}
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                selectedSeverity === 'VACIO'
                                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/40'
                                    : 'text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300'
                            }`}
                        >
                            Obligatorios
                        </button>
                    </div>

                    {/* Ordenar por */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-navy-950 border border-navy-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-cyan-500 font-bold shrink-0"
                    >
                        <option value="code">Ordenar: Código A-Z</option>
                        <option value="severity">Ordenar: Severidad (Alertas primero)</option>
                        <option value="category">Ordenar: Categoría</option>
                    </select>
                </div>

                {/* Filtro de Columnas Rápidas (Chips interactivos tipo carrusel/flex) */}
                <div className="mt-3 pt-3 border-t border-navy-800 flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 shrink-0">
                        <Tag size={12} className="text-cyan-500" />
                        Filtrar por Columna:
                    </span>

                    <button
                        onClick={() => setSelectedColumn('TODAS')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                            selectedColumn === 'TODAS'
                                ? 'bg-cyan-500 text-slate-100 dark:text-slate-950 font-black shadow-sm'
                                : 'bg-navy-950 text-slate-300 hover:text-slate-100 border border-navy-800'
                        }`}
                    >
                        Todas ({reglas.length})
                    </button>

                    {topQuickColumns.map(col => {
                        const count = columnStats.find(([c]) => c === col)?.[1] || 0;
                        const isSelected = selectedColumn.toLowerCase() === col.toLowerCase();
                        return (
                            <button
                                key={col}
                                onClick={() => handleSelectColumnFilter(col)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isSelected
                                        ? 'bg-cyan-500 text-slate-100 dark:text-slate-950 font-black shadow-sm'
                                        : 'bg-navy-950 text-slate-300 hover:text-slate-100 border border-navy-800 hover:border-slate-500'
                                }`}
                            >
                                <span>{col}</span>
                                <span className={`text-[10px] px-1 rounded font-sans ${
                                    isSelected ? 'bg-black/15 text-slate-100 dark:text-slate-950 font-bold' : 'bg-navy-800 text-slate-400'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}

                    {/* Selector de columna adicional si hay más */}
                    <select
                        value={topQuickColumns.includes(selectedColumn) ? '' : selectedColumn}
                        onChange={(e) => e.target.value && setSelectedColumn(e.target.value)}
                        className="bg-navy-950 border border-navy-800 text-slate-300 text-xs rounded-lg px-2 py-1 font-mono outline-none shrink-0"
                    >
                        <option value="">Otras columnas ({columnStats.length - topQuickColumns.length})...</option>
                        {columnStats
                            .filter(([col]) => !topQuickColumns.includes(col))
                            .map(([col, count]) => (
                                <option key={col} value={col}>
                                    {col} ({count})
                                </option>
                            ))}
                    </select>

                    {hasActiveFilters && (
                        <button
                            onClick={handleResetFilters}
                            className="ml-auto text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 shrink-0 cursor-pointer"
                        >
                            <X size={12} />
                            <span>Limpiar filtros</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Contenido Principal: Grid de Reglas */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Resumen de resultados */}
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span>
                        Mostrando <strong className="text-slate-100 font-black">{filteredReglas.length}</strong> de {reglas.length} reglas
                        {selectedColumn !== 'TODAS' && (
                            <span className="ml-1 text-cyan-600 dark:text-cyan-300 font-semibold">
                                para columna <code className="bg-navy-900 px-1 py-0.5 rounded border border-cyan-500/30 font-mono text-cyan-700 dark:text-cyan-300 font-bold">{selectedColumn}</code>
                            </span>
                        )}
                    </span>
                    <span className="text-[11px] text-slate-400">
                        Haz clic en una regla para ver su formulación técnica y ejemplos prácticos
                    </span>
                </div>

                {filteredReglas.length === 0 ? (
                    <div className="bg-navy-900 border border-dashed border-navy-800 rounded-2xl p-12 text-center max-w-lg mx-auto my-8">
                        <AlertCircle size={40} className="mx-auto text-slate-400 mb-3" />
                        <h3 className="text-base font-bold text-slate-100 mb-1">No se encontraron reglas coincidentes</h3>
                        <p className="text-xs text-slate-400 mb-4">
                            No hay reglas que coincidan con los criterios de búsqueda o filtros seleccionados.
                        </p>
                        <button
                            onClick={handleResetFilters}
                            className="px-4 py-2 bg-navy-800 hover:bg-navy-700 text-cyan-600 dark:text-cyan-400 rounded-xl text-xs font-bold transition-all border border-navy-800 cursor-pointer"
                        >
                            Restablecer todos los filtros
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredReglas.map((regla) => {
                            const isAlert = regla.severity === 'ALERTA';
                            const isWarning = regla.severity === 'ADVERTENCIA';
                            const isVacio = regla.severity === 'VACIO';
                            const isCelda = regla.tipo_mapeo?.toLowerCase().includes('celda');

                            return (
                                <div
                                    key={regla.code}
                                    onClick={() => setSelectedRule(regla)}
                                    className="group relative bg-navy-900 hover:bg-navy-850 dark:hover:bg-navy-900/90 border border-navy-800 hover:border-cyan-500/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between"
                                >
                                    <div>
                                        {/* Cabecera de la Tarjeta */}
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {/* Badge de Severidad */}
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                                    isAlert
                                                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                                        : isWarning
                                                        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                                                        : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                                                }`}>
                                                    {isAlert && <AlertCircle size={11} />}
                                                    {isWarning && <AlertTriangle size={11} />}
                                                    {isVacio && <Info size={11} />}
                                                    {regla.severity}
                                                </span>

                                                {/* Badge de Ámbito */}
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-navy-950 text-slate-400 border border-navy-800">
                                                    {isCelda ? 'Celdas' : 'Estructuras'}
                                                </span>
                                            </div>

                                            {/* Botón rápido de copiar código */}
                                            <button
                                                onClick={(e) => handleCopyCode(regla.code, e)}
                                                title="Copiar código de regla"
                                                className="text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 p-1 rounded-lg hover:bg-navy-950 transition-all cursor-pointer"
                                            >
                                                {copiedCode === regla.code ? (
                                                    <Check size={14} className="text-emerald-500" />
                                                ) : (
                                                    <Copy size={14} />
                                                )}
                                            </button>
                                        </div>

                                        {/* Código de la Regla */}
                                        <div className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-300 tracking-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-200 break-all mb-1.5">
                                            {regla.code}
                                        </div>

                                        {/* Nombre / Título */}
                                        <h3 className="text-xs font-bold text-slate-100 line-clamp-2 leading-relaxed mb-2">
                                            {regla.category_name}
                                        </h3>

                                        {/* Descripción Breve */}
                                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-normal mb-3 font-medium">
                                            {regla.description || 'Validación de integridad geomecánica sobre registros Excel.'}
                                        </p>
                                    </div>

                                    <div>
                                        {/* Fórmula técnica previa (si existe) */}
                                        {regla.technical_formula && (
                                            <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-amber-500/5 dark:bg-navy-950 border border-amber-500/20 dark:border-navy-800 font-mono text-[10px] text-amber-800 dark:text-amber-300 truncate">
                                                {regla.technical_formula}
                                            </div>
                                        )}

                                        {/* Columnas involucradas (Tags interactivos) */}
                                        <div className="flex flex-wrap gap-1 items-center mb-3">
                                            {(regla.columns || []).slice(0, 4).map((col) => (
                                                <button
                                                    key={col}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelectColumnFilter(col);
                                                    }}
                                                    title={`Filtrar por columna ${col}`}
                                                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-navy-950 text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-300 border border-navy-800 hover:border-cyan-500/40 transition-all cursor-pointer"
                                                >
                                                    {col}
                                                </button>
                                            ))}
                                            {(regla.columns || []).length > 4 && (
                                                <span className="text-[10px] text-slate-400 px-1 font-mono">
                                                    +{(regla.columns || []).length - 4} más
                                                </span>
                                            )}
                                        </div>

                                        {/* Botón Ver Detalle */}
                                        <div className="pt-2 border-t border-navy-800 flex items-center justify-between text-[11px] text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 font-bold transition-all">
                                            <span>Examinar regla y ejemplos</span>
                                            <ArrowRight size={13} className="transform group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal / Slide-over Drawer de Detalle Exhaustivo */}
            {selectedRule && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 dark:bg-navy-950/80 backdrop-blur-md animate-fade-in"
                    onClick={() => setSelectedRule(null)}
                >
                    <div
                        className="bg-navy-900 border border-navy-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up text-left"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Cabecera del Modal */}
                        <div className="px-6 py-4 bg-navy-900 border-b border-navy-800 flex items-start justify-between gap-4 shrink-0">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                        selectedRule.severity === 'ALERTA'
                                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                            : selectedRule.severity === 'ADVERTENCIA'
                                            ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                                            : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                                    }`}>
                                        {selectedRule.severity === 'ALERTA' && <AlertCircle size={12} />}
                                        {selectedRule.severity === 'ADVERTENCIA' && <AlertTriangle size={12} />}
                                        {selectedRule.severity === 'VACIO' && <Info size={12} />}
                                        {selectedRule.severity}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-navy-950 text-slate-300 border border-navy-800">
                                        {selectedRule.tipo_mapeo}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400">
                                        Cat: {selectedRule.category_code}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <h2 className="font-mono text-base font-black text-cyan-700 dark:text-cyan-300 tracking-tight">
                                        {selectedRule.code}
                                    </h2>
                                    <button
                                        onClick={() => handleCopyCode(selectedRule.code)}
                                        className="text-slate-400 hover:text-slate-100 p-1 rounded hover:bg-navy-950 transition-all cursor-pointer"
                                        title="Copiar código"
                                    >
                                        {copiedCode === selectedRule.code ? (
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                <Check size={12} /> ¡Copiado!
                                            </span>
                                        ) : (
                                            <Copy size={13} />
                                        )}
                                    </button>
                                </div>
                                <div className="text-xs font-semibold text-slate-200 mt-1">
                                    {selectedRule.category_name}
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedRule(null)}
                                className="text-slate-400 hover:text-slate-100 p-1.5 rounded-xl hover:bg-navy-950 transition-all shrink-0 cursor-pointer"
                                title="Cerrar (Esc)"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Cuerpo Desplazable del Modal */}
                        <div className="p-6 overflow-y-auto space-y-5 text-slate-200 text-xs">
                            {/* Descripción Geomecánica */}
                            <div>
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                                    <ShieldCheck size={14} className="text-cyan-500" />
                                    Fundamento Geomecánico y Control de Calidad
                                </h4>
                                <div className="p-3.5 bg-navy-950 border border-navy-800 rounded-xl leading-relaxed text-slate-200 font-medium">
                                    {selectedRule.description || selectedRule.category_name}
                                </div>
                            </div>

                            {/* Columnas Involucradas */}
                            <div>
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                                    <Tag size={14} className="text-cyan-500" />
                                    Columnas Involucradas en el Libro Excel
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {(selectedRule.columns || []).map((col) => (
                                        <div
                                            key={col}
                                            className="font-mono text-xs px-2.5 py-1 rounded-lg bg-navy-950 border border-navy-800 text-cyan-700 dark:text-cyan-300 font-bold flex items-center gap-1.5"
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                                            {col}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Criterio Técnico y Fórmula Matemática */}
                            {selectedRule.technical_formula && (
                                <div>
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                                        <Compass size={14} className="text-amber-500" />
                                        Fórmula Técnica / Condición de Activación
                                    </h4>
                                    <div className="p-3 bg-amber-500/5 dark:bg-navy-950 border border-amber-500/30 rounded-xl font-mono text-amber-900 dark:text-amber-300 text-xs leading-relaxed overflow-x-auto">
                                        {selectedRule.technical_formula}
                                    </div>
                                </div>
                            )}

                            {/* Casos Prácticos: Válido vs Error */}
                            <div>
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-cyan-500" />
                                    Casos de Evaluación Práctica
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Caso Válido */}
                                    <div className="p-3.5 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-xl">
                                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-black text-xs mb-2">
                                            <CheckCircle2 size={15} />
                                            <span>Caso Válido (Pasa Revisión)</span>
                                        </div>
                                        <div className="text-[11px] text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                                            {selectedRule.example_ok || 'Valores dentro de los rangos tolerados y coherencia matemática estricta.'}
                                        </div>
                                    </div>

                                    {/* Caso con Error */}
                                    <div className="p-3.5 bg-rose-500/10 dark:bg-rose-950/20 border border-rose-500/30 rounded-xl">
                                        <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-black text-xs mb-2">
                                            <XCircle size={15} />
                                            <span>Caso con Incidencia (Dispara Error)</span>
                                        </div>
                                        <div className="text-[11px] text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                                            {selectedRule.example_error || 'Valor anómalo o fuera de tolerancias de medición geotécnica.'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Mensaje de Revisión */}
                            {selectedRule.message_template && (
                                <div>
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                                        <AlertTriangle size={14} className="text-slate-400" />
                                        Plantilla del Mensaje Generado en Reporte
                                    </h4>
                                    <div className="p-3 bg-navy-950 border border-navy-800 rounded-xl text-slate-200 font-mono text-xs">
                                        "{selectedRule.message_template}"
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pie del Modal */}
                        <div className="px-6 py-3.5 bg-navy-900 border-t border-navy-800 flex items-center justify-between shrink-0">
                            <span className="text-[11px] text-slate-400">
                                Presiona <kbd className="px-1.5 py-0.5 bg-navy-950 border border-navy-800 rounded text-slate-300 font-mono">Esc</kbd> para salir
                            </span>
                            <button
                                onClick={() => setSelectedRule(null)}
                                className="px-4 py-1.5 bg-navy-800 hover:bg-navy-700 text-slate-100 text-xs font-bold rounded-xl transition-all cursor-pointer"
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
