import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import type { ColumnConfig } from '../../utils/geomecColumns';
import { FormulaTooltipTrigger } from '../FormulaTooltip';

interface GeomecTableProps<T> {
    data: T[];
    columns: ColumnConfig<T>[];
    rowIdKey: keyof T;
    onCellChange: (rowId: any, columnKey: string, val: any) => void;
    onInsertRowBelow?: (index: number) => void;
    onDeleteRow?: (rowId: any) => void;
    onSelectRow?: (index: number) => void;
    selectedRowIndex?: number | null;
    minWidthStyle?: string;
    customHeader?: React.ReactNode;
    validationErrors?: Record<string, 'ERROR' | 'WARNING'>;
    showFormulas?: boolean;
    tableId: string;
    renderCell?: (colKey: string, val: any, row: T) => React.ReactNode;
    getRowClassName?: (row: T, idx: number) => string;
    renderRowIndex?: (idx: number, row: T) => React.ReactNode;
}

export default function GeomecTable<T extends { id: any;[key: string]: any }>({
    data,
    columns,
    rowIdKey,
    onCellChange,
    onInsertRowBelow,
    onDeleteRow,
    onSelectRow,
    selectedRowIndex,
    minWidthStyle = '100%',
    customHeader,
    validationErrors = {},
    showFormulas = true,
    tableId,
    renderCell,
    getRowClassName,
    renderRowIndex
}: GeomecTableProps<T>) {
    const [localValues, setLocalValues] = useState<Record<string, string>>({});
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

    useEffect(() => {
        const savedWidths = localStorage.getItem(`geomec-table-widths-${tableId}`);
        if (savedWidths) {
            try {
                setColumnWidths(JSON.parse(savedWidths));
            } catch (e) {
                console.warn("Error leyendo anchos de columna", e);
            }
        }
    }, [tableId]);

    const handleResizeStart = (e: React.MouseEvent, colKey: string, currentWidth: number) => {
        e.preventDefault();
        const startX = e.clientX;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = Math.max(60, currentWidth + deltaX);
            const updatedWidths = { ...columnWidths, [colKey]: newWidth };
            setColumnWidths(updatedWidths);
            localStorage.setItem(`geomec-table-widths-${tableId}`, JSON.stringify(updatedWidths));
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const getInputValue = (rowId: any, key: string, stateVal: any): string => {
        const mapKey = `${rowId}-${key}`;
        if (localValues[mapKey] !== undefined) return localValues[mapKey];
        if (stateVal === undefined || stateVal === null || stateVal === -1) return '';
        return String(stateVal);
    };

    const handleInputChange = (rowId: any, key: string, rawVal: string, precision?: number) => {
        const mapKey = `${rowId}-${key}`;

        // CORREGIDO: Sanitizador global de comas decimales regionales en tiempo real
        let val = rawVal.replace(',', '.');

        if (precision !== undefined) {
            val = handleNumberLimit(val, precision);
        }
        setLocalValues(prev => ({ ...prev, [mapKey]: val }));

        const num = parseFloat(val);
        if (!isNaN(num) && val !== '' && !val.endsWith('.') && val !== '-') {
            onCellChange(rowId, key, num);
        } else if (val === '') {
            onCellChange(rowId, key, -1);
        }
    };

    const handleNumberLimit = (value: string, precision: number): string => {
        const cleaned = value.replace(/[^0-9.]/g, '');
        const parts = cleaned.split('.');
        if (parts.length > 2) return cleaned.slice(0, -1);

        const integerPart = parts[0];
        let decimalPart = parts[1];

        if (precision === 0) {
            return integerPart;
        }
        if (decimalPart !== undefined && decimalPart.length > precision) {
            decimalPart = decimalPart.slice(0, precision);
        }
        return decimalPart !== undefined ? `${integerPart}.${decimalPart}` : integerPart;
    };

    const handleInputBlur = (rowId: any, col: ColumnConfig, rawVal: string) => {
        const mapKey = `${rowId}-${col.key}`;
        setFocusedField(null);
        setLocalValues(prev => {
            const copy = { ...prev };
            delete copy[mapKey];
            return copy;
        });

        if (rawVal === '') {
            onCellChange(rowId, col.key, -1);
            return;
        }

        // CORREGIDO: Sanitizador global de comas decimales regionales al perder el foco
        const sanitizedVal = rawVal.replace(',', '.');

        if (col.type === 'number') {
            let num = parseFloat(sanitizedVal);
            if (isNaN(num)) {
                onCellChange(rowId, col.key, -1);
                return;
            }
            if (col.range) {
                num = Math.min(col.range[1], Math.max(col.range[0], num));
            }
            onCellChange(rowId, col.key, num);
        } else {
            onCellChange(rowId, col.key, sanitizedVal);
        }
    };

    const handleGridKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        const activeElement = e.currentTarget;
        const key = e.key;

        const allowedKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
        if (!allowedKeys.includes(key)) return;

        const td = activeElement.closest("td");
        const tr = activeElement.closest("tr");
        if (!td || !tr) return;

        const cellIndex = td.cellIndex;
        let targetInput: HTMLInputElement | HTMLSelectElement | null = null;

        if (key === "ArrowUp") {
            e.preventDefault();
            const prevTr = tr.previousElementSibling as HTMLTableRowElement | null;
            if (prevTr) {
                const targetTd = prevTr.cells[cellIndex];
                if (targetDataInput(targetTd)) {
                    targetDataInput(targetTd).focus();
                    if (targetDataInput(targetTd) instanceof HTMLInputElement) {
                        (targetDataInput(targetTd) as HTMLInputElement).select();
                    }
                }
            }
        } else if (key === "ArrowDown" || key === "Enter") {
            e.preventDefault();
            const nextTr = tr.nextElementSibling as HTMLTableRowElement | null;
            if (nextTr) {
                const targetTd = nextTr.cells[cellIndex];
                if (targetDataInput(targetTd)) {
                    targetDataInput(targetTd).focus();
                    if (targetDataInput(targetTd) instanceof HTMLInputElement) {
                        (targetDataInput(targetTd) as HTMLInputElement).select();
                    }
                }
            }
        } else if (key === "ArrowLeft") {
            let shouldMove = true;
            if (activeElement instanceof HTMLInputElement) {
                try {
                    if (activeElement.selectionStart !== null && activeElement.selectionStart > 0) {
                        shouldMove = false;
                    }
                } catch {
                    // Fallback
                }
            }
            if (shouldMove) {
                let prevTd = td.previousElementSibling as HTMLTableCellElement | null;
                while (prevTd) {
                    const input = prevTd.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
                    if (input) {
                        e.preventDefault();
                        targetInput = input;
                        break;
                    }
                    prevTd = prevTd.previousElementSibling as HTMLTableCellElement | null;
                }
            }
        } else if (key === "ArrowRight") {
            let shouldMove = true;
            if (activeElement instanceof HTMLInputElement) {
                try {
                    if (activeElement.selectionStart !== null && activeElement.selectionEnd !== activeElement.value.length) {
                        shouldMove = false;
                    }
                } catch {
                    // Fallback
                }
            }
            if (shouldMove) {
                let nextTd = td.nextElementSibling as HTMLTableCellElement | null;
                while (nextTd) {
                    const input = nextTd.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
                    if (input) {
                        e.preventDefault();
                        targetInput = input;
                        break;
                    }
                    nextTd = nextTd.nextElementSibling as HTMLTableCellElement | null;
                }
            }
        }

        if (targetInput) {
            targetInput.focus();
            if (targetInput instanceof HTMLInputElement && targetInput.type !== "date") {
                targetInput.select();
            }
        }
    };

    const targetDataInput = (td: HTMLTableCellElement | null): HTMLInputElement | HTMLSelectElement | null => {
        if (!td) return null;
        return td.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
    };

    const getCellClassName = (col: ColumnConfig, customTdStyle: string, errType?: 'ERROR' | 'WARNING') => {
        let borderClass = "border-r border-b border-navy-800/60";
        if (errType === 'ERROR') borderClass = "border-r border-b border-red-500/80 bg-red-950/20 shadow-[inset_0_0_8px_rgba(239,68,68,0.15)]";
        else if (errType === 'WARNING') borderClass = "border-r border-b border-amber-500/80 bg-amber-950/15 shadow-[inset_0_0_8px_rgba(245,158,11,0.1)]";
        return `relative h-9 p-0 ${borderClass} ${customTdStyle} transition-all duration-150`;
    };

    const formatCellValue = (val: any, col: ColumnConfig, isFocused: boolean) => {
        if (val === null || val === undefined || val === -1) return '';
        if (!isFocused && col.formatOnBlur) {
            return col.formatOnBlur(val);
        }
        if (col.type === 'number' && col.precision !== undefined && typeof val === 'number') {
            if (isFocused) return String(val);
            return val.toFixed(col.precision);
        }
        return String(val);
    };

    return (
        <div className="overflow-x-auto relative rounded-xl border border-navy-800/80 bg-navy-950/45 shadow-[0_4px_30px_rgba(0,0,0,0.4)] backdrop-blur-md">
            <table className="w-max min-w-full border-collapse border-separate border-spacing-0" style={{ minWidth: minWidthStyle }}>
                {customHeader ? (
                    customHeader
                ) : (
                    <thead>
                        <tr className="bg-navy-900/90 text-slate-300 font-bold uppercase tracking-wider text-xs h-9">
                            <th className="py-2.5 px-3 text-center sticky left-0 bg-navy-900/90 z-20 border-r border-b border-navy-800 w-12 min-w-[48px] h-9 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">#</th>
                            {columns.map(c => {
                                const width = columnWidths[c.key] || c.width;
                                return (
                                    <th
                                        key={c.key}
                                        style={{ width, minWidth: width }}
                                        className="relative py-2.5 px-2 text-center border-r border-b border-navy-800/80 text-[11px] select-none font-bold uppercase tracking-wider h-9"
                                    >
                                        <span>{c.label}</span>
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, c.key, width)}
                                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-30"
                                        />
                                    </th>
                                );
                            })}
                            {(onInsertRowBelow || onDeleteRow) && (
                                <th className="py-2.5 px-2 text-center sticky right-0 bg-navy-900/90 z-20 border-l border-b border-navy-800 w-[75px] min-w-[75px] h-9 shadow-[-2px_0_5px_rgba(0,0,0,0.15)]">Acción</th>
                            )}
                        </tr>
                    </thead>
                )}
                <tbody>
                    {data.map((row, idx) => {
                        const isSelected = selectedRowIndex === idx;
                        const customRowBg = getRowClassName ? getRowClassName(row, idx) : (idx % 2 === 0 ? "bg-navy-900/10" : "bg-navy-950/30");
                        const rowBg = isSelected ? "bg-indigo-500/10 shadow-[inset_0_0_12px_rgba(99,102,241,0.08)]" : customRowBg;

                        return (
                            <tr
                                key={row[rowIdKey]}
                                onClick={() => onSelectRow?.(idx)}
                                className={`${rowBg} h-9 transition-colors border-b border-navy-900/30 hover:bg-navy-900/20`}
                            >
                                {/* CORREGIDO: FAM sticky left tiene fondo sólido bg-navy-950 absoluto y un z-index aumentado a z-20 para evitar solapamientos */}
                                <td className="sticky left-0 bg-navy-950 text-center text-slate-400 font-mono font-bold text-xs py-1.5 border-r border-b border-navy-800/80 z-20 shadow-[3px_0_6px_rgba(0,0,0,0.25)] select-none h-9">
                                    {renderRowIndex ? renderRowIndex(idx, row) : idx + 1}
                                </td>

                                {columns.map(c => {
                                    const width = columnWidths[c.key] || c.width;
                                    const val = row[c.key];
                                    const mapKey = `${row[rowIdKey]}-${c.key}`;
                                    const isFocused = focusedField === mapKey;
                                    const errType = validationErrors[mapKey];

                                    const customTdStyle = c.isComputed && c.customStyleClass ? c.customStyleClass : '';

                                    return (
                                        <td
                                            key={c.key}
                                            style={{ width, minWidth: width, maxWidth: width }}
                                            className={getCellClassName(c, customTdStyle, errType)}
                                        >
                                            {renderCell && renderCell(c.key, val, row) ? (
                                                <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                                                    {renderCell(c.key, val, row)}
                                                </div>
                                            ) : c.isComputed ? (
                                                (() => {
                                                    const displayValue = formatCellValue(val, c, false);
                                                    const isTotal = c.key === 'totalR89' || c.key === 'totalR76';

                                                    const renderCellContent = (
                                                        <div className={`absolute inset-0 flex items-center justify-center text-xs text-center leading-none ${c.customStyleClass || 'text-indigo-300 font-semibold'}`}>
                                                            {!isTotal && (
                                                                <div className="absolute inset-[2px] border border-dashed border-indigo-500/20 rounded-sm pointer-events-none" />
                                                            )}
                                                            <span className="relative z-10">
                                                                {displayValue || (
                                                                    <span className="text-navy-700/60 font-semibold select-none">—</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    );

                                                    if (c.formulaId) {
                                                        const params = c.getFormulaParams ? c.getFormulaParams(row) : {};
                                                        return (
                                                            <FormulaTooltipTrigger formulaId={c.formulaId} params={{ ...params, val }} position="top" enabled={showFormulas}>
                                                                {renderCellContent}
                                                            </FormulaTooltipTrigger>
                                                        );
                                                    }
                                                    return renderCellContent;
                                                })()
                                            ) : (
                                                <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                                                    {c.type === 'select' && c.options ? (
                                                        <select
                                                            value={val ?? ''}
                                                            onChange={(e) => onCellChange(row[rowIdKey], c.key, e.target.value || null)}
                                                            onKeyDown={handleGridKeyDown}
                                                            className="bg-transparent text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-center cursor-pointer w-full h-full text-xs font-normal px-2 border-0"
                                                        >
                                                            <option value="" className="bg-navy-950 text-slate-500">—</option>
                                                            {c.options.map(o => (
                                                                <option key={o.value} value={o.value} className="bg-navy-950 text-slate-100">{o.label}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type={c.type === 'date' ? 'date' : 'text'}
                                                            value={getInputValue(row[rowIdKey], c.key, formatCellValue(val, c, isFocused))}
                                                            onFocus={() => setFocusedField(mapKey)}
                                                            onChange={(e) => handleInputChange(row[rowIdKey], c.key, e.target.value, c.precision)}
                                                            onBlur={(e) => handleInputBlur(row[rowIdKey], c, e.target.value)}
                                                            onKeyDown={handleGridKeyDown}
                                                            className="w-full h-full bg-transparent text-slate-100 text-center focus:outline-none focus:bg-navy-900/50 focus:ring-1 focus:ring-indigo-500/40 border-0 px-2 text-xs font-normal transition-all"
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}

                                {/* CORREGIDO: ACCIÓN sticky right tiene fondo sólido bg-navy-950 absoluto y un z-index aumentado a z-20 para evitar solapamientos */}
                                {(onInsertRowBelow || onDeleteRow) && (
                                    <td className="sticky right-0 bg-navy-950 text-center py-1 px-2 border-l border-b border-navy-800/80 z-20 w-[75px] min-w-[75px] h-9 shadow-[-3px_0_6px_rgba(0,0,0,0.25)]">
                                        <div className="flex items-center justify-center gap-3">
                                            {onInsertRowBelow && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onInsertRowBelow(idx); }}
                                                    className="text-slate-400 hover:text-emerald-400 font-extrabold text-sm px-1 transition-colors select-none"
                                                    title="Insertar fila abajo"
                                                >
                                                    +
                                                </button>
                                            )}
                                            {onDeleteRow && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteRow(row[rowIdKey]); }}
                                                    className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all flex items-center justify-center mx-auto active:scale-95"
                                                    title="Limpiar fila"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        );
                    })}

                    {data.length === 0 && (
                        <tr>
                            <td colSpan={columns.length + 2} className="py-16 text-center text-slate-500 italic bg-navy-950 border-b border-navy-800 text-xs font-semibold select-none">
                                No se registran discontinuidades con distancias válidas para proyectar.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}