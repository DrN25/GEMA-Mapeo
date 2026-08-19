import React, { useState } from 'react';
import { Plus, Map, User, LayoutGrid, TrendingUp, FileSpreadsheet, Calendar, ScanLine } from 'lucide-react';
import CreateWindowModal from '../modals/CreateWindowModal';
import type { PendingCellSummary } from '../../utils/cellRegistry';
import { getAllKnownCellNames } from '../../utils/cellRegistry';
import CellFilters, { type AdvancedFiltersState } from './CellFilters';
import CellTable from './CellTable';
import PaginationControl from '../Common/PaginationControl';

export interface WindowSummary {
  name: string;
  fecha_mapeo: string;
  sector_geotecnico?: string;
  geologo: string;
  lito_1?: string;
  largo: number;
  altura: number;
  nivel?: string;
  rmr_76: number;
  rmr_89: number;
  rqd76_pct: number | null;
  rqd89_pct: number | null;
  gsi_visual: number | null;
  class_89: string;
}

export interface DashboardKPIs {
  celdas_count: number;
  total_global: number;
  largo_total_m: number;
  rmr_76_promedio: number | null;
  rmr_89_promedio: number | null;
  mapeador_mas_reciente: string | null;
  fecha_min: string | null;
  fecha_max: string | null;
}

interface DashboardProps {
  windows: WindowSummary[];
  kpis: DashboardKPIs | null;
  page: number;
  pageSize: number;
  totalFiltered: number;
  totalPages: number;
  loading: boolean;
  pendingCells: PendingCellSummary[];
  /** Todas las celdas con cambios sin guardar (existan o no en BD): marcar su fila normal. */
  pendingCellNames: string[];
  searchTerm: string;
  isGlobalSearch: boolean;
  onSearchSubmit: (term: string, isGlobal: boolean) => void;
  onClearSearch: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onFilterChange: (filters: { dateRange?: string }) => void;
  activeDateRange: string;
  advancedFilters: AdvancedFiltersState;
  onAdvancedFilterChange: (filters: AdvancedFiltersState) => void;
  onClearAdvancedFilters: () => void;
  onSelectWindow: (name: string) => void;
  onCreateWindow: (newWindow: any) => void;
  onDeleteWindow: (name: string) => void;
  onOpenImportModal: () => void;
  onOpenScanModal: () => void;
  onOpenExportModal?: () => void;
}

export default function Dashboard({
  windows,
  kpis,
  page,
  pageSize,
  totalFiltered,
  totalPages,
  loading,
  pendingCells,
  pendingCellNames,
  onPageChange,
  onPageSizeChange,
  onFilterChange,
  activeDateRange,
  advancedFilters,
  onAdvancedFilterChange,
  onClearAdvancedFilters,
  onSelectWindow,
  onCreateWindow,
  onDeleteWindow,
  onOpenImportModal,
  onOpenScanModal,
  onOpenExportModal
}: DashboardProps) {
  const [showModal, setShowModal] = useState(false);

  const formatDate = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
    const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' });
    return `${day} ${month} · ${weekday.charAt(0).toUpperCase() + weekday.slice(1)}`;
  };

  const dateObj = new Date();
  const filterLabel = activeDateRange === 'hoy' ? 'Hoy' :
    activeDateRange === 'ayer' ? 'Ayer' :
      activeDateRange === 'semana' ? 'Esta semana' :
        activeDateRange === 'mes' ? 'Este mes' :
          activeDateRange === 'ano' ? 'Este año' : 'Todo';
  const kpiSubset = totalFiltered !== (kpis?.total_global || 0) && kpis
    ? `Sobre ${totalFiltered.toLocaleString()} celdas de ${kpis.total_global.toLocaleString()} totales`
    : `Total: ${(kpis?.total_global || 0).toLocaleString()} celdas`;

  return (
    <>
      <div className="space-y-6 select-none w-full animate-fade-in text-left view-dashboard">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-100 tracking-wide flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
              <span>Mapeo Geomecánico de Ventanas de Detalle</span>
            </h2>
            <p className="text-slate-400 text-xs mt-1 font-semibold">{kpiSubset}</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap justify-start md:justify-end">
            {onOpenExportModal && (
              <button
                onClick={onOpenExportModal}
                className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(16,185,129,0.12)] active:scale-95"
              >
                <FileSpreadsheet size={16} className="text-emerald-400" />
                <span>Exportar Excel</span>
              </button>
            )}
            <button
              onClick={onOpenImportModal}
              className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/40 hover:bg-teal-500/20 hover:border-teal-400 text-teal-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(20,184,166,0.12)] active:scale-95"
            >
              <FileSpreadsheet size={16} className="text-teal-400" />
              <span>Importar Excel</span>
            </button>
            <button
              onClick={onOpenScanModal}
              className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/40 hover:bg-cyan-500/20 hover:border-cyan-400 text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(6,182,212,0.12)] active:scale-95"
            >
              <ScanLine size={16} className="text-cyan-400" />
              <span>Importar Escaneado</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.12)] px-4 py-2 rounded-lg text-xs"
            >
              <Plus size={16} />
              <span>Nueva Celda</span>
            </button>
          </div>
        </div>

        {/* Filtros de Rango de Fecha y Filtros Avanzados */}
        <CellFilters
          activeDateRange={activeDateRange}
          onFilterChange={onFilterChange}
          advancedFilters={advancedFilters}
          onAdvancedFilterChange={onAdvancedFilterChange}
          onClearAdvancedFilters={onClearAdvancedFilters}
        />

        {/* KPIs contextuales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Rango activo</span>
              <span className="text-base font-black text-slate-100 block">{filterLabel}</span>
              <span className="text-[10px] font-bold text-violet-400 block leading-none">{formatDate(dateObj)}</span>
            </div>
            <Calendar size={22} className="text-indigo-500/40" />
          </div>

          <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Total Celdas</span>
              <span className="text-xl font-black text-slate-100 block">{(kpis?.celdas_count || 0).toLocaleString()}</span>
              <span className="text-[10px] font-bold text-slate-400 block leading-none">{kpiSubset}</span>
            </div>
            <LayoutGrid size={22} className="text-indigo-500/40" />
          </div>

          <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Avance Escaneado</span>
              <span className="text-xl font-black text-slate-100 block">{(kpis?.largo_total_m || 0).toFixed(1)} m</span>
              <span className="text-[10px] font-bold text-emerald-400 block leading-none">Longitud total</span>
            </div>
            <Map size={22} className="text-emerald-500/40 animate-pulse" />
          </div>

          <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">RMR Promedio</span>
              <span className="text-xl font-black text-indigo-400 block">{kpis?.rmr_76_promedio !== null ? kpis?.rmr_76_promedio?.toFixed(1) : '—'}</span>
              <span className="text-[10px] font-bold text-indigo-400 block leading-none">RMR 76</span>
            </div>
            <TrendingUp size={22} className="text-indigo-400/40" />
          </div>

          <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">RMR Promedio</span>
              <span className="text-xl font-black text-indigo-400 block">{kpis?.rmr_89_promedio !== null ? kpis?.rmr_89_promedio?.toFixed(1) : '—'}</span>
              <span className="text-[10px] font-bold text-indigo-400 block leading-none">RMR 89</span>
            </div>
            <TrendingUp size={22} className="text-indigo-400/40" />
          </div>

          <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Último Mapeador</span>
              <span className="text-base font-black text-slate-200 block truncate max-w-[130px]">
                {kpis?.mapeador_mas_reciente || 'N/A'}
              </span>
              <span className="text-[10px] font-bold text-slate-400 block leading-none">Responsable más reciente</span>
            </div>
            <User size={22} className="text-indigo-500/40" />
          </div>
        </div>

        {/* Tabla de Celdas y Paginación */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/15 shadow-xl space-y-4">
          <CellTable
            windows={windows}
            loading={loading}
            pageSize={pageSize}
            pendingCells={pendingCells}
            pendingCellNames={pendingCellNames}
            mode="dashboard"
            onSelectWindow={onSelectWindow}
            onDeleteWindow={onDeleteWindow}
            emptyMessage={`No se encontraron celdas en este rango. ${activeDateRange === 'hoy' ? 'Crea la primera del día.' : 'Prueba con otro filtro.'}`}
          />

          <PaginationControl
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>

        {/* Modal para Crear Nueva Celda */}
        <CreateWindowModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onCreate={onCreateWindow}
          existingCeldas={getAllKnownCellNames(windows.map(w => w.name))}
        />
      </div>
    </>
  );
}