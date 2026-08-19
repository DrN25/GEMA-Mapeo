import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  X,
  Loader2,
  AlertCircle,
  CheckCheck,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUpDown,
  ArrowLeftRight,
  GripVertical
} from 'lucide-react';
import type { WindowSummary } from '../Dashboard/Dashboard';
import type { PendingCellSummary } from '../../utils/cellRegistry';
import { CellFilters, type AdvancedFiltersState } from '../Dashboard/CellFilters';
import { CellTable } from '../Dashboard/CellTable';
import { PaginationControl } from '../Common/PaginationControl';
import { gatherVentanaData, exportMultipleVentanas } from '../../services/excelExportService';

export interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  windows: WindowSummary[];
  loading: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  totalFiltered: number;
  pendingCells: PendingCellSummary[];
  pendingCellNames: string[];
  activeDateRange: string;
  advancedFilters: AdvancedFiltersState;
  onFilterChange: (filters: { dateRange?: string }) => void;
  onAdvancedFilterChange: (filters: AdvancedFiltersState) => void;
  onClearAdvancedFilters: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  activeWindow: any | null;
}

export const ExcelExportModal: React.FC<ExcelExportModalProps> = ({
  isOpen,
  onClose,
  windows,
  loading,
  page,
  pageSize,
  totalPages,
  totalFiltered,
  pendingCells,
  pendingCellNames,
  activeDateRange,
  advancedFilters,
  onFilterChange,
  onAdvancedFilterChange,
  onClearAdvancedFilters,
  onPageChange,
  onPageSizeChange,
  activeWindow
}) => {
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; celda?: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Estados y Refs para Drag & Drop interactivo con placeholder en tiempo real
  const draggedIndexRef = React.useRef<number | null>(null);
  const dropInsertIndexRef = React.useRef<number | null>(null);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);

  // Al abrir el modal, preseleccionar la celda activa si existe y la lista está vacía
  useEffect(() => {
    if (isOpen) {
      setExportError(null);
      setExportProgress(null);
      draggedIndexRef.current = null;
      dropInsertIndexRef.current = null;
      setDraggedIndex(null);
      setDropInsertIndex(null);
      if (activeWindow && activeWindow.header?.celda) {
        const activeName = activeWindow.header.celda.trim().toUpperCase();
        setSelectedCells(prev => {
          if (prev.length === 0) return [activeName];
          return prev;
        });
      }
    }
  }, [isOpen, activeWindow]);

  if (!isOpen) return null;

  const handleToggleCell = (name: string) => {
    const up = name.trim().toUpperCase();
    setSelectedCells(prev => {
      if (prev.some(c => c.trim().toUpperCase() === up)) {
        return prev.filter(c => c.trim().toUpperCase() !== up);
      }
      return [...prev, up];
    });
  };

  const handleRemoveChip = (name: string) => {
    const up = name.trim().toUpperCase();
    setSelectedCells(prev => prev.filter(c => c.trim().toUpperCase() !== up));
  };

  const handleSelectAllVisible = () => {
    const visibleNames: string[] = [
      ...pendingCells.map(pc => pc.name.trim().toUpperCase()),
      ...windows.map(w => w.name.trim().toUpperCase())
    ];

    setSelectedCells(prev => {
      const merged = new Set([...prev, ...visibleNames]);
      return Array.from(merged);
    });
  };

  const handleClearSelection = () => {
    setSelectedCells([]);
  };

  // Helper de ordenamiento natural inteligente:
  // - Ignora prefijos/sufijos de borrador ("BORRADOR", "(Borrador)", etc.)
  // - Normaliza guiones ('-'), guiones bajos ('_') y puntos para que 'TEST-005' se ordene exactamente entre 'TEST_004' y 'TEST_006'.
  const cleanNameForSort = (str: string): string => {
    if (!str) return '';
    let s = str.trim();
    const prefixRe = new RegExp('^(borrador[\\s\\-_:.]*|\\[borrador\\]|\\(borrador\\))', 'i');
    const suffixRe = new RegExp('([\\s\\-_:.]*borrador|\\[borrador\\]|\\(borrador\\))$', 'i');
    s = s.replace(prefixRe, '').replace(suffixRe, '');
    return s.trim();
  };

  const compareCellNames = (a: string, b: string): number => {
    const cleanA = cleanNameForSort(a);
    const cleanB = cleanNameForSort(b);

    const normA = cleanA.replace(/[-_.]/g, '_');
    const normB = cleanB.replace(/[-_.]/g, '_');

    const cmp = normA.localeCompare(normB, undefined, { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  };

  // Funciones de ordenación rápida
  const handleSortAlphaAsc = () => {
    setSelectedCells(prev => [...prev].sort((a, b) => compareCellNames(a, b)));
  };

  const handleSortAlphaDesc = () => {
    setSelectedCells(prev => [...prev].sort((a, b) => compareCellNames(b, a)));
  };

  const handleReverseOrder = () => {
    setSelectedCells(prev => [...prev].reverse());
  };

  // Reordenamiento por botones de flechas
  const handleMoveLeft = (index: number) => {
    if (index <= 0) return;
    setSelectedCells(prev => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveRight = (index: number) => {
    setSelectedCells(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Handlers robustos para Drag & Drop fluido con placeholder
  const updateDropTarget = (targetIndex: number) => {
    dropInsertIndexRef.current = targetIndex;
    setDropInsertIndex(targetIndex);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    draggedIndexRef.current = index;
    setDraggedIndex(index);
    updateDropTarget(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleChipDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const target = e.clientX < midpoint ? index : index + 1;
    updateDropTarget(target);
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (e.target === e.currentTarget || dropInsertIndexRef.current === null) {
      updateDropTarget(selectedCells.length);
    }
  };

  const executeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceIdx = draggedIndexRef.current;
    const rawTargetIdx = dropInsertIndexRef.current;

    if (sourceIdx !== null && rawTargetIdx !== null) {
      let finalTargetIdx: number = rawTargetIdx;
      if (sourceIdx < finalTargetIdx) {
        finalTargetIdx -= 1;
      }

      if (sourceIdx !== finalTargetIdx && sourceIdx >= 0 && finalTargetIdx >= 0) {
        setSelectedCells(prev => {
          const next = [...prev];
          if (sourceIdx < next.length && finalTargetIdx <= next.length) {
            const [item] = next.splice(sourceIdx, 1);
            next.splice(finalTargetIdx, 0, item);
          }
          return next;
        });
      }
    }

    draggedIndexRef.current = null;
    dropInsertIndexRef.current = null;
    setDraggedIndex(null);
    setDropInsertIndex(null);
  };

  const handleDragEnd = () => {
    draggedIndexRef.current = null;
    dropInsertIndexRef.current = null;
    setDraggedIndex(null);
    setDropInsertIndex(null);
  };

  const handleExport = async () => {
    if (selectedCells.length === 0 || isExporting) return;

    setIsExporting(true);
    setExportError(null);
    const total = selectedCells.length;
    setExportProgress({ current: 0, total });

    try {
      const gatheredItems: any[] = [];

      for (let i = 0; i < selectedCells.length; i++) {
        const celda = selectedCells[i];
        setExportProgress({ current: i + 1, total, celda });

        const itemData = await gatherVentanaData(celda, activeWindow);
        gatheredItems.push(itemData);
      }

      const defaultFilename = selectedCells.length === 1
        ? `mapeo_ventana_${selectedCells[0]}.xlsx`
        : `mapeo_ventanas_export_${selectedCells.length}_celdas.xlsx`;

      await exportMultipleVentanas(gatheredItems, defaultFilename);

      // Cerrar modal tras exportar exitosamente
      onClose();
    } catch (err: any) {
      console.error('Error al exportar celdas seleccionadas:', err);
      setExportError(err?.message || 'Ocurrió un error inesperado al recopilar y exportar los datos.');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-3 md:p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
      <div
        className="glass-panel w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900 text-slate-100 border border-navy-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-navy-800 flex items-center justify-between bg-navy-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-100 flex items-center gap-2">
                <span>Exportar Mapeo a Plantilla Excel</span>
                <span className="text-[11px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-black px-2 py-0.5 rounded-full">
                  {selectedCells.length} {selectedCells.length === 1 ? 'celda' : 'celdas'}
                </span>
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Selecciona y ordena las celdas para generar un único archivo Excel con hojas <strong>ventana</strong> y <strong>BD</strong> compacta.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-slate-400 hover:text-slate-100 p-2 rounded-lg hover:bg-navy-800/80 transition-colors disabled:opacity-50"
            title="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
          {/* Alerta de Error */}
          {exportError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-3.5 flex items-start gap-3 text-xs animate-fade-in">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">Error en la exportación:</p>
                <p className="mt-0.5 text-slate-300">{exportError}</p>
              </div>
              <button onClick={() => setExportError(null)} className="text-rose-400 hover:text-rose-200">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Bandeja de Celdas Seleccionadas con Drag & Drop y Ordenamiento Rápido */}
          <div className="bg-navy-950/40 border border-navy-800 rounded-xl p-3.5 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUpDown size={13} className="text-emerald-400" />
                  <span>Orden de Exportación ({selectedCells.length}):</span>
                </span>
                <span className="text-[10px] text-slate-500 hidden sm:inline">
                  (Arrastra las etiquetas o usa las flechas para ordenar)
                </span>
              </div>

              {/* Botones de acción y ordenación rápida */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedCells.length > 1 && (
                  <div className="flex items-center bg-navy-900 border border-navy-700/80 rounded-lg p-0.5 gap-0.5">
                    <button
                      onClick={handleSortAlphaAsc}
                      disabled={isExporting}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-emerald-400 hover:bg-navy-800 px-2 py-1 rounded transition-colors"
                      title="Ordenar alfabéticamente A → Z"
                    >
                      <ArrowDownAZ size={13} />
                      <span>A → Z</span>
                    </button>
                    <button
                      onClick={handleSortAlphaDesc}
                      disabled={isExporting}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-emerald-400 hover:bg-navy-800 px-2 py-1 rounded transition-colors"
                      title="Ordenar alfabéticamente Z → A"
                    >
                      <ArrowUpAZ size={13} />
                      <span>Z → A</span>
                    </button>
                    <button
                      onClick={handleReverseOrder}
                      disabled={isExporting}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-cyan-400 hover:bg-navy-800 px-2 py-1 rounded transition-colors"
                      title="Invertir orden actual de las celdas"
                    >
                      <ArrowLeftRight size={12} />
                      <span>Invertir</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={handleSelectAllVisible}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 px-2.5 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                  title="Seleccionar todas las celdas de la página actual"
                >
                  <CheckCheck size={13} />
                  <span>Seleccionar toda la página</span>
                </button>

                {selectedCells.length > 0 && (
                  <button
                    onClick={handleClearSelection}
                    disabled={isExporting}
                    className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-rose-400 bg-navy-900 hover:bg-rose-500/10 border border-navy-700 hover:border-rose-500/30 px-2 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                    title="Vaciar cola de exportación"
                  >
                    <Trash2 size={13} />
                    <span className="hidden sm:inline">Limpiar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Lista de Chips con Placeholder de inserción interactivo */}
            <div
              onDragOver={handleContainerDragOver}
              onDrop={executeDrop}
              className="flex flex-wrap items-center gap-2 min-h-[52px] max-h-40 overflow-y-auto p-2 bg-navy-950/60 border border-navy-800/80 rounded-xl transition-all"
            >
              {selectedCells.length === 0 ? (
                <span className="text-xs text-slate-500 italic py-1">
                  No hay celdas seleccionadas. Haz clic en las filas de la tabla abajo o usa "+ Agregar".
                </span>
              ) : (
                <>
                  {selectedCells.map((name, idx) => {
                    const isPending = pendingCellNames.includes(name) || pendingCells.some(pc => pc.name === name);
                    const isFirst = idx === 0;
                    const isLast = idx === selectedCells.length - 1;
                    const isBeingDragged = draggedIndex === idx;
                    const showPlaceholderBefore = draggedIndex !== null && dropInsertIndex === idx && draggedIndex !== idx && draggedIndex !== idx - 1;

                    return (
                      <React.Fragment key={name}>
                        {/* Placeholder visual ANTES de este elemento en color Diamante Minecraft (celeste verde oscuro brillante) */}
                        {showPlaceholderBefore && (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.dataTransfer.dropEffect = 'move';
                              updateDropTarget(idx);
                            }}
                            onDrop={executeDrop}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border-2 border-dashed border-cyan-400 bg-cyan-500/20 text-cyan-200 text-xs font-black shadow-[0_0_15px_rgba(6,182,212,0.45)] animate-in fade-in zoom-in-90 duration-150 scale-105 shrink-0 select-none"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                            <span>↳ Insertar aquí</span>
                          </div>
                        )}

                        <div
                          draggable={!isExporting}
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleChipDragOver(e, idx)}
                          onDrop={executeDrop}
                          onDragEnd={handleDragEnd}
                          className={`inline-flex items-center gap-1.5 bg-emerald-500/15 border text-emerald-400 text-xs font-black pl-1.5 pr-1.5 py-1 rounded-lg shadow-sm group select-none transition-all duration-150 ease-out cursor-grab active:cursor-grabbing ${
                            isBeingDragged
                              ? 'opacity-25 scale-95 border-dashed border-slate-500 bg-slate-800/10'
                              : 'border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-500/20'
                          }`}
                          title="Arrastra para reordenar la posición"
                        >
                          {/* Manija de Arrastre */}
                          <GripVertical
                            size={12}
                            className="text-emerald-500/40 group-hover:text-emerald-300 shrink-0 -mr-0.5"
                          />

                          {/* Número de Orden */}
                          <span className="w-4 h-4 rounded bg-emerald-600/30 text-emerald-400 flex items-center justify-center text-[10px] font-black shrink-0">
                            {idx + 1}
                          </span>

                          <span className="tracking-tight">{name}</span>

                          {isPending && (
                            <span
                              className="text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black px-1.5 py-0.5 rounded uppercase tracking-wider"
                              title="Esta celda aún no se ha guardado en la base de datos (Borrador local)."
                            >
                              BORRADOR
                            </span>
                          )}

                          {/* Botones de Reordenamiento con Flechas */}
                          {selectedCells.length > 1 && (
                            <div className="flex items-center gap-0.5 ml-0.5 border-l border-emerald-500/30 pl-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveLeft(idx);
                                }}
                                disabled={isFirst || isExporting}
                                className={`p-0.5 rounded transition-colors ${
                                  isFirst
                                    ? 'opacity-20 cursor-not-allowed'
                                    : 'hover:bg-emerald-500/30 text-emerald-400 active:scale-90'
                                }`}
                                title={`Mover ${name} hacia la izquierda`}
                              >
                                <ChevronLeft size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveRight(idx);
                                }}
                                disabled={isLast || isExporting}
                                className={`p-0.5 rounded transition-colors ${
                                  isLast
                                    ? 'opacity-20 cursor-not-allowed'
                                    : 'hover:bg-emerald-500/30 text-emerald-400 active:scale-90'
                                }`}
                                title={`Mover ${name} hacia la derecha`}
                              >
                                <ChevronRight size={13} />
                              </button>
                            </div>
                          )}

                          {/* Botón Quitar */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveChip(name);
                            }}
                            disabled={isExporting}
                            className="text-emerald-400 hover:text-rose-400 transition-colors ml-0.5 p-0.5 rounded hover:bg-rose-500/10"
                            title={`Quitar ${name} de la cola`}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {/* Placeholder al FINAL de la lista en color Diamante Minecraft */}
                  {draggedIndex !== null && dropInsertIndex === selectedCells.length && draggedIndex !== selectedCells.length - 1 && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        updateDropTarget(selectedCells.length);
                      }}
                      onDrop={executeDrop}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border-2 border-dashed border-cyan-400 bg-cyan-500/20 text-cyan-200 text-xs font-black shadow-[0_0_15px_rgba(6,182,212,0.45)] animate-in fade-in zoom-in-90 duration-150 scale-105 shrink-0 select-none"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      <span>↳ Mover al final</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Filtros Inteligentes */}
          <CellFilters
            activeDateRange={activeDateRange}
            onFilterChange={onFilterChange}
            advancedFilters={advancedFilters}
            onAdvancedFilterChange={onAdvancedFilterChange}
            onClearAdvancedFilters={onClearAdvancedFilters}
            hideDateChips={false}
          />

          {/* Grilla / Tabla de Celdas en modo Selección */}
          <CellTable
            windows={windows}
            loading={loading}
            pageSize={pageSize}
            pendingCells={pendingCells}
            pendingCellNames={pendingCellNames}
            mode="select"
            selectedCellNames={selectedCells}
            onToggleSelectCell={handleToggleCell}
            emptyMessage="No se encontraron celdas con los filtros especificados."
          />

          {/* Paginación */}
          <PaginationControl
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            totalFiltered={totalFiltered}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-navy-800 bg-navy-950/60 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="text-xs text-slate-400">
            {exportProgress ? (
              <div className="flex items-center gap-2 text-emerald-400 font-bold animate-pulse">
                <Loader2 size={14} className="animate-spin" />
                <span>
                  Recopilando {exportProgress.celda ? `"${exportProgress.celda}"` : 'datos'} ({exportProgress.current}/{exportProgress.total} celdas)...
                </span>
              </div>
            ) : (
              <span>
                Total a exportar: <strong className="text-slate-100">{selectedCells.length}</strong> {selectedCells.length === 1 ? 'celda' : 'celdas'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-100 hover:bg-navy-800/80 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              onClick={handleExport}
              disabled={selectedCells.length === 0 || isExporting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Generando Excel...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={15} />
                  <span>Descargar Excel ({selectedCells.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelExportModal;
