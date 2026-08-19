import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, X, Loader2, CheckCheck, Trash2, AlertCircle } from 'lucide-react';
import type { WindowSummary } from '../Dashboard/Dashboard';
import type { PendingCellSummary } from '../../utils/cellRegistry';
import CellFilters, { type AdvancedFiltersState } from '../Dashboard/CellFilters';
import CellTable from '../Dashboard/CellTable';
import PaginationControl from '../Common/PaginationControl';
import { gatherVentanaData, exportMultipleVentanas } from '../../services/excelExportService';
import type { WindowData } from '../../utils/diffUtils';

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
  activeWindow: WindowData | null;
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

  // Al abrir el modal, preseleccionar la celda activa si existe y la lista está vacía
  useEffect(() => {
    if (isOpen) {
      setExportError(null);
      setExportProgress(null);
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
                Selecciona las celdas deseadas para generar un único archivo Excel con hojas <strong>ventana</strong> y <strong>BD</strong> compacta.
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

          {/* Bandeja de Celdas Seleccionadas (Chips) */}
          <div className="bg-navy-950/40 border border-navy-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                Celdas en cola de exportación ({selectedCells.length}):
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllVisible}
                  disabled={isExporting}
                  className="flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 px-2.5 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  <CheckCheck size={12} />
                  <span>Seleccionar página visible</span>
                </button>
                {selectedCells.length > 0 && (
                  <button
                    onClick={handleClearSelection}
                    disabled={isExporting}
                    className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-rose-400 bg-navy-900 hover:bg-rose-500/10 border border-navy-700 hover:border-rose-500/30 px-2.5 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    <span>Limpiar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Lista de Chips */}
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
              {selectedCells.length === 0 ? (
                <span className="text-xs text-slate-500 italic py-1">
                  No hay celdas seleccionadas. Haz clic en las filas de la tabla abajo o usa "+ Agregar".
                </span>
              ) : (
                selectedCells.map(name => {
                  const isPending = pendingCellNames.includes(name) || pendingCells.some(pc => pc.name === name);
                  return (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-black px-2.5 py-1 rounded-lg shadow-sm animate-fade-in"
                    >
                      <span>{name}</span>
                      {isPending && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded uppercase font-bold">
                          Borrador
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveChip(name)}
                        disabled={isExporting}
                        className="text-emerald-400 hover:text-rose-400 transition-colors ml-0.5"
                        title={`Quitar ${name} de la selección`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })
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
          />

          {/* Tabla de Celdas en modo 'select' */}
          <CellTable
            windows={windows}
            loading={loading}
            pageSize={pageSize}
            pendingCells={pendingCells}
            pendingCellNames={pendingCellNames}
            mode="select"
            selectedCellNames={selectedCells}
            onToggleSelectCell={handleToggleCell}
            emptyMessage="No se encontraron celdas con los filtros actuales para seleccionar."
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
