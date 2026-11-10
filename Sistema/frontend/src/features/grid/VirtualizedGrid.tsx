// src/features/grid/VirtualizedGrid.tsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type HeaderGroup,
  type Header
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { GridColumnDef, FloatingEditorPosition, ColumnPinned } from './types';
import { getPltGridColumns } from './columnsDefinition';
import { useGridStore } from './gridStore';
import { FloatingEditor } from './FloatingEditor';

export interface CellAlertInfo {
  severity: 'CRITICA' | 'ADVERTENCIA' | 'VACIO';
  messages: string[];
}

export interface VirtualizedGridProps {
  initialRecords?: Record<string, any>[];
  rowKey?: string;
  height?: string | number;
  pinnedConfig?: Record<string, ColumnPinned>;
  onColumnResize?: (colId: string, newWidth: number) => void;
  onDeleteRow?: (rowId: number) => void;
  onChange?: (records: Record<string, any>[]) => void;
  defaultPageSize?: number;
  isLoading?: boolean;
  alertsByRowId?: Map<number, Record<string, CellAlertInfo>>;
  rowIndexById?: Map<number, number>;
}

const EMPTY_DATA: any[] = [];

export function formatDisplayValue(val: any, colDef?: GridColumnDef): string {
  if (val === null || val === undefined || val === '') return '—';

  if (colDef?.format) {
    const formatted = colDef.format(val);
    return formatted === '' ? '—' : formatted;
  }

  if (colDef?.type === 'number') {
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(num)) return '—';
    const dec = colDef.decimals ?? 2;
    return String(parseFloat(num.toFixed(dec)));
  }

  const s = String(val).trim();
  return s === '' ? '—' : s;
}

// =========================================================================
// HEADER AISLADO MEMOIZADO
// =========================================================================
interface GridHeaderProps {
  headerGroups: HeaderGroup<any>[];
  colWidths: Record<string, number>;
  onResizeCommit: (colId: string, newWidth: number) => void;
}

const GridHeader = React.memo<GridHeaderProps>(({
  headerGroups,
  colWidths,
  onResizeCommit
}) => {
  const handleStartResize = useCallback((header: Header<any, unknown>, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const colDef: GridColumnDef | undefined = (header.column.columnDef.meta as any)?.gridDef;
    const colId = header.id;
    const minW = colDef?.minWidth ?? 45;
    const maxW = colDef?.maxWidth ?? 500;
    const startX = e.clientX;
    const startWidth = colWidths[colId] || header.getSize();

    const handleEl = e.currentTarget;
    try {
      handleEl.setPointerCapture(e.pointerId);
    } catch (_) {}

    const colEl = document.getElementById(`plt-col-${colId}`);
    const thEl = document.querySelector(`th[data-col-id="${colId}"]`) as HTMLElement | null;

    let currentCalculatedWidth = startWidth;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const delta = moveEvt.clientX - startX;
      currentCalculatedWidth = Math.max(minW, Math.min(maxW, Math.round(startWidth + delta)));
      if (colEl) colEl.style.width = `${currentCalculatedWidth}px`;
      if (thEl) thEl.style.width = `${currentCalculatedWidth}px`;
    };

    const onPointerUp = (upEvt: PointerEvent) => {
      try {
        handleEl.releasePointerCapture(upEvt.pointerId);
      } catch (_) {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      onResizeCommit(colId, currentCalculatedWidth);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [colWidths, onResizeCommit]);

  return (
    <thead className="bg-navy-900 border-b border-navy-800 text-slate-300">
      {headerGroups.map((headerGroup, gIdx) => (
        <tr key={headerGroup.id} className="h-7">
          {headerGroup.headers.map(header => {
            const meta: any = header.column.columnDef.meta;
            const isStickyLeft = meta?.isStickyLeft;
            const isStickyRight = meta?.isStickyRight;
            const leftOffset = meta?.stickyOffset ?? 0;
            const rightOffset = meta?.stickyRightOffset ?? 0;
            const colDef: GridColumnDef | undefined = meta?.gridDef;

            // Nivel 0 (Grupos) vs Nivel 1 (Columnas Hoja)
            const isGroupLevel = gIdx === 0;
            const headerHeight = isGroupLevel ? 28 : 34;
            const topOffset = isGroupLevel ? 0 : 28;

            let stickyClasses = 'bg-navy-900 sticky select-none';
            let styleObj: React.CSSProperties = {
              top: topOffset,
              height: headerHeight,
              width: `${header.getSize()}px`,
              minWidth: `${header.getSize()}px`,
              maxWidth: `${header.getSize()}px`
            };

            if (isStickyLeft) {
              stickyClasses += isGroupLevel ? ' z-40 border-r-2 border-navy-800' : ' z-30 border-r-2 border-navy-800';
              styleObj.left = `${leftOffset}px`;
            } else if (isStickyRight) {
              stickyClasses += isGroupLevel ? ' z-40 border-l-2 border-navy-800' : ' z-30 border-l-2 border-navy-800';
              styleObj.right = `${rightOffset}px`;
            } else {
              stickyClasses += ' z-20';
            }

            return (
              <th
                key={header.id}
                data-col-id={header.id}
                colSpan={header.colSpan}
                style={styleObj}
                className={`px-2 py-1 border-r border-b border-navy-800 font-bold text-center truncate relative ${stickyClasses}`}
              >
                <div className="flex items-center justify-center relative w-full h-full overflow-hidden">
                  <span className="truncate">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </span>
                  {colDef?.unit && (
                    <span className="text-[10px] text-sky-400 font-normal ml-1">({colDef.unit})</span>
                  )}
                </div>

                {!isGroupLevel && colDef && (
                  <div
                    data-testid={`resize-handle-${header.id}`}
                    onPointerDown={(e) => handleStartResize(header, e)}
                    className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize select-none hover:bg-sky-400/80 active:bg-sky-500 z-50 flex items-center justify-end group"
                    title={`Redimensionar columna ${colDef.header} (${colDef.minWidth ?? 45}px - ${colDef.maxWidth ?? 500}px)`}
                  >
                    <div className="w-[1.5px] h-full bg-navy-700/60 group-hover:bg-sky-300" />
                  </div>
                )}
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
});

// =========================================================================
// FILA DE DATOS MEMOIZADA
// =========================================================================
interface GridRowProps {
  virtualRow: { index: number; start: number; size: number };
  rowId: number;
  rowDisplayIndex: number;
  origRowIdx?: number;
  record: Record<string, any>;
  rowVersion: number;
  leafColumns: any[];
  activeColKey: string | null;
  rowAlerts?: Record<string, CellAlertInfo>;
  rowAlertsSig?: string;
  onCellClick: (rowIdx: number, colKey: string, e: React.MouseEvent<HTMLTableCellElement>) => void;
  onCellDoubleClick: (rowIdx: number, colKey: string, e: React.MouseEvent<HTMLTableCellElement>) => void;
  onInsertRowBelow: (rowIdx: number) => void;
  onDeleteRow: (rowId: number) => void;
}

const GridRow = React.memo<GridRowProps>(({
  virtualRow,
  rowId,
  rowDisplayIndex,
  origRowIdx,
  record,
  leafColumns,
  activeColKey,
  rowAlerts,
  onCellClick,
  onCellDoubleClick,
  onInsertRowBelow,
  onDeleteRow
}) => {
  const isEven = virtualRow.index % 2 === 0;
  const rowBg = isEven ? 'bg-navy-950/20' : 'bg-navy-900/10';

  return (
    <tr
      key={rowId}
      style={{ height: `${virtualRow.size}px` }}
      className={`border-b border-navy-900/40 hover:bg-navy-900/30 group transition-colors ${rowBg}`}
    >
      {leafColumns.map(col => {
        const colKey = col.id;
        const meta: any = col.columnDef.meta;
        const isStickyLeft = meta?.isStickyLeft;
        const isStickyRight = meta?.isStickyRight;
        const leftOffset = meta?.stickyOffset ?? 0;
        const rightOffset = meta?.stickyRightOffset ?? 0;
        const isActive = activeColKey === colKey;
        const colDef: GridColumnDef | undefined = meta?.gridDef;

        // 1. Columna de número de fila
        if (colKey === 'row_num') {
          return (
            <td
              key={colKey}
              style={{ left: `${leftOffset}px` }}
              className="sticky bg-navy-950 px-2 py-1.5 text-center text-[11px] font-mono text-slate-400 font-bold border-r-2 border-b border-navy-800 z-20 select-none"
            >
              {rowDisplayIndex + 1}
            </td>
          );
        }

        // 2. Columna de acciones
        if (colKey === 'acciones_col') {
          return (
            <td
              key={colKey}
              style={{ right: `${rightOffset}px` }}
              className="sticky bg-navy-950 px-2 py-1 text-center border-l-2 border-b border-navy-800 z-20 select-none"
            >
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => onInsertRowBelow(virtualRow.index)}
                  className="text-slate-400 hover:text-emerald-500 font-black text-sm px-1 transition-colors select-none"
                  title="Insertar fila abajo"
                >
                  +
                </button>
                <button
                  onClick={() => onDeleteRow(rowId)}
                  className="p-1 rounded bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 hover:text-red-400 transition-colors select-none"
                  title="Eliminar ensayo PLT"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </td>
          );
        }

        const rawVal = record[colKey];
        const displayVal = formatDisplayValue(rawVal, colDef);

        let stickyClasses = '';
        let stickyStyle: React.CSSProperties = {};
        if (isStickyLeft) {
          stickyClasses = 'sticky z-10 bg-navy-950 group-hover:bg-navy-900 border-r-2 border-navy-800 font-bold';
          stickyStyle = { left: `${leftOffset}px` };
        } else if (isStickyRight) {
          stickyClasses = 'sticky z-10 bg-navy-950 group-hover:bg-navy-900 border-l-2 border-navy-800 text-slate-200';
          stickyStyle = { right: `${rightOffset}px` };
        }

        const isReadOnly = colDef?.type === 'readonly';
        const activeRing = isActive
          ? isReadOnly
            ? 'ring-2 ring-inset ring-amber-400/80 z-20 font-semibold bg-amber-500/10'
            : 'ring-2 ring-inset ring-indigo-500/80 z-20 font-semibold bg-indigo-500/10'
          : '';

        const lockedClasses = isReadOnly
          ? 'bg-slate-900/40 text-slate-500 cursor-not-allowed select-none opacity-80'
          : 'cursor-cell text-slate-200';

        const cellAlert = rowAlerts?.[colKey];
        let alertClasses = '';
        if (cellAlert?.severity === 'CRITICA') {
          alertClasses = 'bg-red-500/15 text-red-200 ring-1 ring-inset ring-red-500/70';
        } else if (cellAlert?.severity === 'VACIO') {
          alertClasses = 'bg-violet-500/15 text-violet-200 ring-1 ring-inset ring-violet-500/70';
        } else if (cellAlert?.severity === 'ADVERTENCIA') {
          alertClasses = 'bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-500/60';
        }

        return (
          <td
            key={colKey}
            id={origRowIdx !== undefined ? `plt-${colKey}-${origRowIdx}` : undefined}
            tabIndex={origRowIdx !== undefined ? -1 : undefined}
            title={cellAlert ? cellAlert.messages.join('\n') : undefined}
            data-testid={`cell-${virtualRow.index}-${colKey}`}
            data-col-key={colKey}
            data-row-idx={virtualRow.index}
            onClick={(e) => onCellClick(virtualRow.index, colKey, e)}
            onDoubleClick={(e) => onCellDoubleClick(virtualRow.index, colKey, e)}
            style={stickyStyle}
            className={`px-2 py-1.5 text-center truncate border-r border-b border-navy-800/60 select-none relative ${stickyClasses} ${lockedClasses} ${alertClasses} ${activeRing}`}
          >
            {displayVal}
          </td>
        );
      })}
    </tr>
  );
}, (prev, next) => {
  return (
    prev.rowId === next.rowId &&
    prev.rowDisplayIndex === next.rowDisplayIndex &&
    prev.origRowIdx === next.origRowIdx &&
    prev.virtualRow.index === next.virtualRow.index &&
    prev.virtualRow.start === next.virtualRow.start &&
    prev.rowVersion === next.rowVersion &&
    prev.activeColKey === next.activeColKey &&
    prev.rowAlertsSig === next.rowAlertsSig &&
    prev.leafColumns === next.leafColumns
  );
});

// =========================================================================
// COMPONENTE PRINCIPAL VIRTUALIZED GRID
// =========================================================================
export const VirtualizedGrid: React.FC<VirtualizedGridProps> = ({
  initialRecords,
  rowKey = 'id',
  height = '520px',
  pinnedConfig,
  onColumnResize,
  onDeleteRow,
  onChange,
  defaultPageSize = 50,
  isLoading = false,
  alertsByRowId,
  rowIndexById
}) => {
  const rowIds = useGridStore(s => s.rowIds);
  const rowVersions = useGridStore(s => s.rowVersions);
  const activeCell = useGridStore(s => s.activeCell);
  const editingCell = useGridStore(s => s.editingCell);
  const isEditing = editingCell !== null;
  const setInitialRecords = useGridStore(s => s.setInitialRecords);
  const getRowById = useGridStore(s => s.getRowById);
  const getAllRecords = useGridStore(s => s.getAllRecords);
  const setActiveCell = useGridStore(s => s.setActiveCell);
  const startEditing = useGridStore(s => s.startEditing);
  const cancelEditing = useGridStore(s => s.cancelEditing);
  const commitEditing = useGridStore(s => s.commitEditing);
  const insertRowBelow = useGridStore(s => s.insertRowBelow);
  const deleteRowStore = useGridStore(s => s.deleteRow);
  const dataVersion = useGridStore(s => s.dataVersion);
  const qaqcAlertsByRowId = useGridStore(s => s.qaqcAlertsByRowId);

  const containerRef = useRef<HTMLDivElement>(null);

  // Estados locales de ancho de columnas y editor flotante
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [editorPos, setEditorPos] = useState<FloatingEditorPosition | null>(null);

  // Estado de Paginación configurable (50 por defecto, opciones 50, 100, 250)
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Carga inicial y reactiva
  const prevKeyRef = useRef<string>('');
  useEffect(() => {
    if (!initialRecords) return;
    const len = initialRecords.length;
    const firstId = len > 0 ? initialRecords[0]?.[rowKey] : '';
    const lastId = len > 0 ? initialRecords[len - 1]?.[rowKey] : '';
    const syncKey = `${len}:${firstId}:${lastId}`;

    if (prevKeyRef.current !== syncKey) {
      prevKeyRef.current = syncKey;
      setInitialRecords(initialRecords, rowKey);
      setCurrentPage(1);
    }
  }, [initialRecords, rowKey, setInitialRecords]);

  // Notificar cambios al componente padre (PltEnsayosView / App.tsx)
  const prevVerRef = useRef<number>(dataVersion);
  useEffect(() => {
    if (dataVersion !== prevVerRef.current) {
      prevVerRef.current = dataVersion;
      if (onChange) {
        onChange(getAllRecords());
      }
    }
  }, [dataVersion, onChange, getAllRecords]);

  // Definición de columnas
  const gridColumns = useMemo(() => getPltGridColumns(), []);

  // Filas paginadas activas
  const totalRecords = rowIds.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const validPage = Math.min(currentPage, totalPages);

  const paginatedRowIds = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return rowIds.slice(start, start + pageSize);
  }, [rowIds, validPage, pageSize]);

  // Construir columnas de TanStack Table agrupadas con sticky offsets
  const tanstackColumns = useMemo<ColumnDef<any, any>[]>(() => {
    const groupsMap = new Map<string, GridColumnDef[]>();
    for (const col of gridColumns) {
      const g = col.group || 'General';
      if (!groupsMap.has(g)) groupsMap.set(g, []);
      groupsMap.get(g)!.push(col);
    }

    const rightPinnedCols = gridColumns.filter(c => (pinnedConfig?.[c.id] ?? c.pinned) === 'right');
    const rightOffsets: Record<string, number> = {};
    let rightAcc = 0;
    for (let i = rightPinnedCols.length - 1; i >= 0; i--) {
      const col = rightPinnedCols[i];
      rightOffsets[col.id] = rightAcc;
      rightAcc += (colWidths[col.id] || col.defaultWidth);
    }

    let leftAccumulator = 0;
    const result: ColumnDef<any, any>[] = [];

    for (const [groupTitle, cols] of groupsMap.entries()) {
      let groupLeftStart = leftAccumulator;
      let groupRightOffsetMin = Infinity;

      const childCols: ColumnDef<any, any>[] = cols.map(c => {
        const width = colWidths[c.id] || c.defaultWidth;
        const pinSetting = pinnedConfig?.[c.id] ?? c.pinned;
        const isStickyLeft = pinSetting === 'left';
        const isStickyRight = pinSetting === 'right';

        let offset = 0;
        let rightOffset = 0;
        if (isStickyLeft) {
          offset = leftAccumulator;
          leftAccumulator += width;
        } else if (isStickyRight) {
          rightOffset = rightOffsets[c.id] ?? 0;
          if (rightOffset < groupRightOffsetMin) groupRightOffsetMin = rightOffset;
        }

        return {
          id: c.id,
          accessorKey: c.accessorKey,
          header: c.header,
          size: width,
          meta: {
            gridDef: c,
            pinned: pinSetting,
            stickyOffset: offset,
            stickyRightOffset: rightOffset,
            isStickyLeft,
            isStickyRight
          }
        };
      });

      const allStickyLeft = childCols.length > 0 && childCols.every(c => (c.meta as any)?.isStickyLeft);
      const allStickyRight = childCols.length > 0 && childCols.every(c => (c.meta as any)?.isStickyRight);

      result.push({
        id: `group_${groupTitle}`,
        header: groupTitle,
        columns: childCols,
        meta: {
          isGroup: true,
          isStickyLeft: allStickyLeft,
          isStickyRight: allStickyRight,
          stickyOffset: allStickyLeft ? groupLeftStart : undefined,
          stickyRightOffset: allStickyRight ? (groupRightOffsetMin === Infinity ? 0 : groupRightOffsetMin) : undefined,
          groupTitle,
          groupBg: cols[0]?.groupBg
        }
      });
    }

    return result;
  }, [gridColumns, colWidths, pinnedConfig]);

  const table = useReactTable({
    data: EMPTY_DATA,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel()
  });

  const leafColumns = useMemo(() => table.getAllLeafColumns(), [table]);

  // Virtualizador de filas sobre paginatedRowIds
  const rowVirtualizer = useVirtualizer({
    count: paginatedRowIds.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 36,
    overscan: 8
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalVirtualSize = rowVirtualizer.getTotalSize();
  const virtualPaddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const virtualPaddingBottom = virtualRows.length > 0
    ? totalVirtualSize - virtualRows[virtualRows.length - 1].end
    : 0;

  const handleResizeCommit = useCallback((colId: string, newWidth: number) => {
    setColWidths(prev => ({ ...prev, [colId]: newWidth }));
    onColumnResize?.(colId, newWidth);
  }, [onColumnResize]);

  // Editor flotante
  const openEditorForCell = useCallback((rowIdx: number, colKey: string) => {
    const colDef = gridColumns.find(c => c.id === colKey);
    if (!colDef || colDef.editor === 'none' || colDef.type === 'readonly') return;

    const rowId = paginatedRowIds[rowIdx];
    if (rowId === undefined) return;
    const rec = getRowById(rowId);
    if (!rec) return;

    if (containerRef.current) {
      const cellEl = containerRef.current.querySelector(
        `[data-testid="cell-${rowIdx}-${colKey}"]`
      );

      if (cellEl) {
        const cRect = containerRef.current.getBoundingClientRect();
        const cellRect = cellEl.getBoundingClientRect();

        setEditorPos({
          top: cellRect.top - cRect.top + containerRef.current.scrollTop,
          left: cellRect.left - cRect.left + containerRef.current.scrollLeft,
          width: cellRect.width,
          height: cellRect.height
        });
      }
    }

    startEditing({ rowIdx, colKey, rowId });
  }, [paginatedRowIds, gridColumns, getRowById, startEditing]);

  const handleCellClick = useCallback((rowIdx: number, colKey: string) => {
    const rowId = paginatedRowIds[rowIdx];
    if (rowId === undefined) return;
    if (isEditing) {
      commitEditing();
      setEditorPos(null);
    }
    setActiveCell({ rowIdx, colKey, rowId });
  }, [paginatedRowIds, isEditing, commitEditing, setActiveCell]);

  const handleCellDoubleClick = useCallback((rowIdx: number, colKey: string) => {
    openEditorForCell(rowIdx, colKey);
  }, [openEditorForCell]);

  // Navegación por teclado (Flechas y Tab/Shift+Tab)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!activeCell) return;
    const { rowIdx, colKey } = activeCell;
    const colIdx = leafColumns.findIndex(c => c.id === colKey);

    if (isEditing) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIdx < paginatedRowIds.length - 1) {
        const nextId = paginatedRowIds[rowIdx + 1];
        setActiveCell({ rowIdx: rowIdx + 1, colKey, rowId: nextId });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIdx > 0) {
        const nextId = paginatedRowIds[rowIdx - 1];
        setActiveCell({ rowIdx: rowIdx - 1, colKey, rowId: nextId });
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (colIdx < leafColumns.length - 1) {
        setActiveCell({ rowIdx, colKey: leafColumns[colIdx + 1].id, rowId: activeCell.rowId });
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (colIdx > 0) {
        setActiveCell({ rowIdx, colKey: leafColumns[colIdx - 1].id, rowId: activeCell.rowId });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const dir = e.shiftKey ? -1 : 1;
      const nextIdx = colIdx + dir;
      if (nextIdx >= 0 && nextIdx < leafColumns.length) {
        setActiveCell({ rowIdx, colKey: leafColumns[nextIdx].id, rowId: activeCell.rowId });
      } else if (dir === 1 && rowIdx < paginatedRowIds.length - 1) {
        // Wrap a la siguiente fila
        setActiveCell({ rowIdx: rowIdx + 1, colKey: leafColumns[1].id, rowId: paginatedRowIds[rowIdx + 1] });
      } else if (dir === -1 && rowIdx > 0) {
        // Wrap a la fila anterior
        setActiveCell({ rowIdx: rowIdx - 1, colKey: leafColumns[leafColumns.length - 2].id, rowId: paginatedRowIds[rowIdx - 1] });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openEditorForCell(rowIdx, colKey);
    }
  };

  const handleNavigateNext = useCallback((direction: 'down' | 'right' | 'up' | 'left') => {
    if (!activeCell) return;
    const { rowIdx, colKey } = activeCell;
    const colIdx = leafColumns.findIndex(c => c.id === colKey);

    if (direction === 'down' && rowIdx < paginatedRowIds.length - 1) {
      setActiveCell({ rowIdx: rowIdx + 1, colKey, rowId: paginatedRowIds[rowIdx + 1] });
    } else if (direction === 'right') {
      if (colIdx < leafColumns.length - 1) {
        setActiveCell({ rowIdx, colKey: leafColumns[colIdx + 1].id, rowId: activeCell.rowId });
      } else if (rowIdx < paginatedRowIds.length - 1) {
        setActiveCell({ rowIdx: rowIdx + 1, colKey: leafColumns[1].id, rowId: paginatedRowIds[rowIdx + 1] });
      }
    } else if (direction === 'left') {
      if (colIdx > 0) {
        setActiveCell({ rowIdx, colKey: leafColumns[colIdx - 1].id, rowId: activeCell.rowId });
      }
    }
  }, [activeCell, leafColumns, paginatedRowIds, setActiveCell]);

  const handleInsertRow = useCallback((rowIdx: number) => {
    const actualGlobalIdx = (validPage - 1) * pageSize + rowIdx;
    insertRowBelow(actualGlobalIdx);
  }, [validPage, pageSize, insertRowBelow]);

  const handleDeleteRow = useCallback((rowId: number) => {
    if (confirm('¿Estás seguro de que deseas eliminar este registro de ensayo PLT?')) {
      if (onDeleteRow) onDeleteRow(rowId);
      deleteRowStore(rowId);
    }
  }, [onDeleteRow, deleteRowStore]);

  const activeColumnDef = editingCell ? gridColumns.find(c => c.id === editingCell.colKey) : undefined;
  const headerGroups = useMemo(() => table.getHeaderGroups(), [table]);

  return (
    <div className="relative w-full border border-navy-800 rounded-xl overflow-hidden bg-navy-950 font-sans shadow-2xl flex flex-col">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{ height, overflow: 'auto', position: 'relative' }}
        className="w-full focus:outline-none scrollbar-thin scrollbar-thumb-navy-700 scrollbar-track-navy-950"
      >
        <table className="border-collapse text-xs select-none" style={{ tableLayout: 'fixed', width: 'max-content' }}>
          <colgroup>
            {leafColumns.map(col => (
              <col
                key={col.id}
                id={`plt-col-${col.id}`}
                style={{ width: `${colWidths[col.id] || col.getSize()}px` }}
              />
            ))}
          </colgroup>

          <GridHeader
            headerGroups={headerGroups}
            colWidths={colWidths}
            onResizeCommit={handleResizeCommit}
          />

          <tbody>
            {virtualPaddingTop > 0 && (
              <tr style={{ height: `${virtualPaddingTop}px` }}>
                <td colSpan={leafColumns.length} style={{ height: `${virtualPaddingTop}px`, padding: 0, border: 0 }} />
              </tr>
            )}

            {virtualRows.map(virtualRow => {
              const rowId = paginatedRowIds[virtualRow.index];
              const rec = rowId !== undefined ? getRowById(rowId) : undefined;
              if (!rec) return null;

              const activeColKey = activeCell?.rowIdx === virtualRow.index ? activeCell.colKey : null;
              const rowVersion = rowVersions.get(rowId) || 1;
              const extRowAlerts = alertsByRowId?.get(rowId);
              const storeAlerts = qaqcAlertsByRowId.get(rowId) || [];
              let mergedRowAlerts: Record<string, CellAlertInfo> | undefined = extRowAlerts;

              if (storeAlerts.length > 0) {
                const rank: Record<'CRITICA' | 'VACIO' | 'ADVERTENCIA', number> = {
                  CRITICA: 3,
                  VACIO: 2,
                  ADVERTENCIA: 1,
                };
                mergedRowAlerts = extRowAlerts ? { ...extRowAlerts } : {};
                for (const sa of storeAlerts) {
                  const sev: 'CRITICA' | 'ADVERTENCIA' = sa.type === 'CRÍTICO' ? 'CRITICA' : 'ADVERTENCIA';
                  const cur = mergedRowAlerts[sa.field];
                  if (!cur) {
                    mergedRowAlerts[sa.field] = { severity: sev, messages: [sa.message] };
                  } else {
                    const nextSev = rank[sev] > rank[cur.severity] ? sev : cur.severity;
                    const msgs = cur.messages.includes(sa.message) ? cur.messages : [...cur.messages, sa.message];
                    mergedRowAlerts[sa.field] = { severity: nextSev, messages: msgs };
                  }
                }
              }

              const rowAlertsSig = mergedRowAlerts
                ? Object.entries(mergedRowAlerts)
                    .map(([k, v]) => `${k}:${v.severity}:${v.messages.length}`)
                    .sort()
                    .join('|')
                : '';

              const actualGlobalIdx = (validPage - 1) * pageSize + virtualRow.index;
              const origRowIdx = rowIndexById ? rowIndexById.get(rowId) : actualGlobalIdx;

              return (
                <GridRow
                  key={rowId}
                  virtualRow={virtualRow}
                  rowId={rowId}
                  rowDisplayIndex={actualGlobalIdx}
                  origRowIdx={origRowIdx}
                  record={rec}
                  rowVersion={rowVersion}
                  leafColumns={leafColumns}
                  activeColKey={activeColKey}
                  rowAlerts={mergedRowAlerts}
                  rowAlertsSig={rowAlertsSig}
                  onCellClick={handleCellClick}
                  onCellDoubleClick={handleCellDoubleClick}
                  onInsertRowBelow={handleInsertRow}
                  onDeleteRow={handleDeleteRow}
                />
              );
            })}

            {virtualPaddingBottom > 0 && (
              <tr style={{ height: `${virtualPaddingBottom}px` }}>
                <td colSpan={leafColumns.length} style={{ height: `${virtualPaddingBottom}px`, padding: 0, border: 0 }} />
              </tr>
            )}

            {paginatedRowIds.length === 0 && (
              <tr>
                <td
                  colSpan={leafColumns.length}
                  className="py-16 text-center text-slate-400 italic bg-navy-950 border-b border-navy-800 text-xs font-semibold select-none"
                >
                  No se registran ensayos PLT para los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Editor Flotante Único */}
        {isEditing && editorPos && activeColumnDef && (
          <FloatingEditor
            position={editorPos}
            column={activeColumnDef}
            onCommit={() => {
              commitEditing();
              setEditorPos(null);
            }}
            onCancel={() => {
              cancelEditing();
              setEditorPos(null);
            }}
            onNavigateNext={handleNavigateNext}
          />
        )}
      </div>

      {/* Barra de Paginación Rápida: 50 por defecto, 100, 250 */}
      <div
        data-testid="grid-pagination-bar"
        className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-navy-950/95 border-t border-navy-800 text-xs text-slate-400 gap-3 select-none"
      >
        <div className="flex items-center gap-3">
          <span>
            Página <span className="font-bold text-slate-200">{validPage}</span> de{' '}
            <span className="font-bold text-slate-200">{totalPages}</span>
            <span className="text-slate-500 ml-1.5 font-mono">
              ({totalRecords.toLocaleString()} registros totales)
            </span>
          </span>

          <div className="flex items-center gap-1.5 pl-3 border-l border-navy-800">
            <span className="text-slate-500 text-[11px]">Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-navy-900 border border-navy-800 rounded px-2 py-0.5 text-xs text-slate-300 outline-none cursor-pointer hover:border-navy-700"
            >
              <option value={50}>50 filas</option>
              <option value={100}>100 filas</option>
              <option value={250}>250 filas</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={validPage <= 1 || isLoading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-navy-800 bg-navy-900 text-slate-300 hover:bg-navy-800 hover:text-slate-100 transition-all disabled:opacity-30 disabled:pointer-events-none font-semibold text-xs"
          >
            <ChevronLeft size={13} />
            <span>Anterior</span>
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={validPage >= totalPages || isLoading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-navy-800 bg-navy-900 text-slate-300 hover:bg-navy-800 hover:text-slate-100 transition-all disabled:opacity-30 disabled:pointer-events-none font-semibold text-xs"
          >
            <span>Siguiente</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

