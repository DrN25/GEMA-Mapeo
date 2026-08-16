import React, { useState } from 'react';
import { Plus, Search, Map, User, LayoutGrid, Trash2, TrendingUp, FileSpreadsheet, Calendar, ChevronLeft, ChevronRight, Filter, X, ChevronDown, ScanLine } from 'lucide-react';
import CreateWindowModal from '../modals/CreateWindowModal';
import { limitNumberWithMax } from '../../utils/inputLimits';
import type { PendingCellSummary } from '../../utils/cellRegistry';
import { CELL_SOURCE_LABELS, getAllKnownCellNames } from '../../utils/cellRegistry';

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
  advancedFilters: {
    celda: string;
    sector: string;
    rmr76: string;
    rmr89: string;
    rqd76: string;
    rqd89: string;
    gsi: string;
  };
  onAdvancedFilterChange: (filters: {
    celda: string;
    sector: string;
    rmr76: string;
    rmr89: string;
    rqd76: string;
    rqd89: string;
    gsi: string;
  }) => void;
  onClearAdvancedFilters: () => void;
  onSelectWindow: (name: string) => void;
  onCreateWindow: (newWindow: any) => void;
  onDeleteWindow: (name: string) => void;
  onOpenImportModal: () => void;
  onOpenScanModal: () => void;
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
  searchTerm,
  isGlobalSearch,
  onSearchSubmit,
  onClearSearch,
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
  onOpenScanModal
}: DashboardProps) {
  const [showModal, setShowModal] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm);
  const [localAdv, setLocalAdv] = useState(advancedFilters);

  React.useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  React.useEffect(() => {
    setLocalAdv(advancedFilters);
  }, [advancedFilters]);

  const hasAdvancedFilters = !!(
    localAdv.celda.trim() || localAdv.sector.trim() || localAdv.rmr76 !== '' ||
    localAdv.rmr89 !== '' || localAdv.rqd76 !== '' || localAdv.rqd89 !== '' || localAdv.gsi !== ''
  );

  const applyAdvancedFilters = () => {
    onAdvancedFilterChange({
      celda: localAdv.celda.trim(),
      sector: localAdv.sector.trim(),
      rmr76: localAdv.rmr76,
      rmr89: localAdv.rmr89,
      rqd76: localAdv.rqd76,
      rqd89: localAdv.rqd89,
      gsi: localAdv.gsi,
    });
  };

  const filteredWindows = windows;

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
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenImportModal}
              className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(16,185,129,0.12)] active:scale-95"
            >
              <FileSpreadsheet size={16} className="text-emerald-400" />
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

        {/* Date range chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'hoy', label: 'Hoy' },
            { key: 'ayer', label: 'Ayer' },
            { key: 'semana', label: 'Esta semana' },
            { key: 'mes', label: 'Este mes' },
            { key: 'ano', label: 'Este año' },
            { key: 'todo', label: 'Todo' },
          ].map(chip => (
            <button
              key={chip.key}
              onClick={() => onFilterChange({ dateRange: chip.key })}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 border ${activeDateRange === chip.key
                ? 'bg-violet-500/20 border-violet-500/50 text-violet-300 shadow-[0_0_10px_rgba(139,92,246,0.15)]'
                : 'bg-navy-900/40 border-navy-700/70 text-slate-400 hover:text-slate-200 hover:border-navy-600'
                }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Filtros avanzados colapsable */}
        <details className="group">
          <summary className="flex items-center gap-2 text-xs text-slate-500 font-semibold cursor-pointer hover:text-slate-300 transition-all select-none list-none">
            <Filter size={14} />
            <span>Filtros avanzados</span>
            {hasAdvancedFilters && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 text-[10px] font-black">
                {[localAdv.celda, localAdv.sector, localAdv.rmr76, localAdv.rmr89, localAdv.rqd76, localAdv.rqd89, localAdv.gsi].filter(v => v !== '').length} activos
              </span>
            )}
            <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
          </summary>

          <div className="mt-3 p-4 bg-navy-950/30 border border-navy-800 rounded-xl space-y-3">
            {/* Fila 1: Identificación (Celda + Sector) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                  Código de Celda <span className="text-violet-500">(coincidencia exacta primero)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. TEST, A1, TR13..."
                  value={localAdv.celda}
                  onChange={(e) => setLocalAdv({ ...localAdv, celda: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyAdvancedFilters(); }}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Sector</label>
                <input
                  type="text"
                  placeholder="NW1_B, E1..."
                  value={localAdv.sector}
                  onChange={(e) => setLocalAdv({ ...localAdv, sector: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyAdvancedFilters(); }}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Fila 2: RMR 76 / RMR 89 / RQD % 76 / RQD % 89 */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">
                Clasificación Geomecánica <span className="text-slate-600 font-semibold normal-case">(valor exacto)</span>
              </label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">RMR 76</label>
                  <div className="relative">
                    <input
                      type="text" inputMode="decimal" placeholder="55.25"
                      value={localAdv.rmr76}
                      onChange={(e) => {
                        const v = limitNumberWithMax(e.target.value, 3, 2, 100);
                        if (v !== null) setLocalAdv({ ...localAdv, rmr76: v });
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') applyAdvancedFilters(); }}
                      className="w-full bg-navy-950 border border-amber-500/20 focus:border-amber-500/50 focus:ring-amber-500/30 rounded-lg px-2.5 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 transition-all"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-500/70 pointer-events-none">pts</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-pink-400 uppercase tracking-wider block">RMR 89</label>
                  <div className="relative">
                    <input
                      type="text" inputMode="decimal" placeholder="55.25"
                      value={localAdv.rmr89}
                      onChange={(e) => {
                        const v = limitNumberWithMax(e.target.value, 3, 2, 100);
                        if (v !== null) setLocalAdv({ ...localAdv, rmr89: v });
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') applyAdvancedFilters(); }}
                      className="w-full bg-navy-950 border border-pink-500/20 focus:border-pink-500/50 focus:ring-pink-500/30 rounded-lg px-2.5 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 transition-all"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-pink-500/70 pointer-events-none">pts</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">RQD % 76</label>
                  <div className="relative">
                    <input
                      type="text" inputMode="decimal" placeholder="80.5"
                      value={localAdv.rqd76}
                      onChange={(e) => {
                        const v = limitNumberWithMax(e.target.value, 3, 2, 100);
                        if (v !== null) setLocalAdv({ ...localAdv, rqd76: v });
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') applyAdvancedFilters(); }}
                      className="w-full bg-navy-950 border border-amber-500/20 focus:border-amber-500/50 focus:ring-amber-500/30 rounded-lg px-2.5 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 transition-all"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-500/70 pointer-events-none">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-pink-400 uppercase tracking-wider block">RQD % 89</label>
                  <div className="relative">
                    <input
                      type="text" inputMode="decimal" placeholder="80.5"
                      value={localAdv.rqd89}
                      onChange={(e) => {
                        const v = limitNumberWithMax(e.target.value, 3, 2, 100);
                        if (v !== null) setLocalAdv({ ...localAdv, rqd89: v });
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') applyAdvancedFilters(); }}
                      className="w-full bg-navy-950 border border-pink-500/20 focus:border-pink-500/50 focus:ring-pink-500/30 rounded-lg px-2.5 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 transition-all"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-pink-500/70 pointer-events-none">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fila 3: GSI Visual + Botones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-violet-400 uppercase tracking-wider block">GSI Visual</label>
                <div className="relative max-w-xs">
                  <input
                    type="text" inputMode="numeric" placeholder="60"
                    value={localAdv.gsi}
                    onChange={(e) => {
                      const v = limitNumberWithMax(e.target.value, 3, 0, 100);
                      if (v !== null) setLocalAdv({ ...localAdv, gsi: v });
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyAdvancedFilters(); }}
                    className="w-full bg-navy-950 border border-violet-500/20 focus:border-violet-500/50 focus:ring-violet-500/30 rounded-lg px-2.5 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 transition-all"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-violet-500/70 pointer-events-none">GSI</span>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                {hasAdvancedFilters && (
                  <button
                    onClick={onClearAdvancedFilters}
                    className="px-3 py-1.5 rounded-lg border border-navy-700 text-slate-500 hover:text-red-400 hover:border-red-500/40 transition-all active:scale-95 text-xs font-bold"
                  >
                    Limpiar filtros
                  </button>
                )}
                <button
                  onClick={applyAdvancedFilters}
                  className="bg-indigo-500/10 border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/20 px-5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-[0_0_12px_rgba(99,102,241,0.1)]"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </details>

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

        {/* Search + Grid */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/15 shadow-xl space-y-4">
          {/* BÚSQUEDA POR NOMBRE DE CELDA DESACTIVADA (solicitud de negocio):
              La búsqueda por código de celda ahora vive en "Filtros avanzados".
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-2xl w-full">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Escriba código de celda (ej. A1, TR13)..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSearchSubmit(localSearch, isGlobalSearch);
                    }
                  }}
                  className="w-full bg-navy-950/80 border border-navy-800 rounded-lg pl-9 pr-8 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {localSearch && (
                  <button
                    onClick={() => {
                      setLocalSearch('');
                      onClearSearch();
                    }}
                    className="absolute right-2.5 top-3 text-slate-500 hover:text-slate-200 transition-colors"
                    title="Limpiar texto de búsqueda"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSearchSubmit(localSearch, false)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
                  title={`Buscar dentro del rango activo (${filterLabel})`}
                >
                  <Search size={13} />
                  <span>Buscar en {filterLabel}</span>
                </button>

                <button
                  onClick={() => onSearchSubmit(localSearch, true)}
                  className={`border font-bold px-3.5 py-2 rounded-lg text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 whitespace-nowrap ${
                    isGlobalSearch && searchTerm.trim()
                      ? 'bg-violet-500 border-violet-400 text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]'
                      : 'bg-navy-900 border-navy-700 text-slate-300 hover:text-white hover:border-navy-600'
                  }`}
                  title="Buscar en todo el historial completo de la base de datos (ignora filtro de fecha)"
                >
                  <span>🌐 Buscar en todo</span>
                </button>
              </div>
            </div>

            {searchTerm.trim() && (
              <div className="flex items-center justify-between gap-3 bg-violet-500/10 border border-violet-500/30 rounded-lg px-3.5 py-2 text-xs text-violet-300 animate-fade-in">
                <div className="flex items-center gap-2 font-medium">
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                  <span>
                    {isGlobalSearch ? '🌐 Todo el historial' : `📅 En ${filterLabel}`}: Buscando <strong className="text-white">"{searchTerm}"</strong> (Coincidencia exacta prioritario)
                  </span>
                </div>
                <button
                  onClick={() => {
                    setLocalSearch('');
                    onClearSearch();
                  }}
                  className="text-[11px] font-bold text-violet-400 hover:text-violet-200 underline cursor-pointer ml-3 whitespace-nowrap"
                >
                  Limpiar búsqueda
                </button>
              </div>
            )}
          </div>
          */}

          <div className="overflow-x-auto rounded-lg border border-navy-900 bg-navy-950/30">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="text-[10px] text-slate-500 font-black uppercase tracking-wider border-b border-navy-800/80 bg-navy-900/40 h-9">
                  <th className="py-2 px-4">Celda</th>
                  <th className="py-2 px-4">Fecha</th>
                  <th className="py-2 px-4">Sector</th>
                  <th className="py-2 px-4 text-center text-amber-400">RMR 76</th>
                  <th className="py-2 px-4 text-center text-pink-400">RMR 89</th>
                  <th className="py-2 px-4 text-center text-amber-400">RQD % 76</th>
                  <th className="py-2 px-4 text-center text-pink-400">RQD % 89</th>
                  <th className="py-2 px-4 text-center text-violet-400">GSI Visual</th>
                  <th className="py-2 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-900/30 text-slate-200 font-medium">
                {loading && [...Array(pageSize)].map((_, i) => (
                  <tr key={`skeleton-${i}`} className="h-11 animate-pulse">
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="py-2.5 px-4">
                        <div className="h-3 bg-navy-800/60 rounded w-3/4 mx-auto" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!loading && pendingCells.length > 0 && pendingCells.map(pc => (
                  <tr
                    key={`pend-${pc.name}`}
                    onClick={() => onSelectWindow(pc.name)}
                    className="hover:bg-navy-900/20 cursor-pointer transition-colors h-11 bg-amber-500/[0.04]"
                  >
                    <td className="py-2.5 px-4 font-black text-slate-100 tracking-wide">
                      <div className="flex items-center gap-2">
                        <span>{pc.name}</span>
                        {CELL_SOURCE_LABELS.local && (
                          <span
                            className="text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black px-1.5 py-0.5 rounded uppercase tracking-wider"
                            title="Esta celda aún no se ha guardado en la base de datos. Usa GUARDAR CAMBIOS para subirla."
                          >
                            {CELL_SOURCE_LABELS.local}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[10px]">{pc.fecha_mapeo || '—'}</td>
                    <td className="py-2.5 px-4 text-slate-400">{pc.sector_geotecnico || '—'}</td>
                    <td className="py-2.5 px-4 text-center text-slate-600">—</td>
                    <td className="py-2.5 px-4 text-center text-slate-600">—</td>
                    <td className="py-2.5 px-4 text-center text-slate-600">—</td>
                    <td className="py-2.5 px-4 text-center text-slate-600">—</td>
                    <td className="py-2.5 px-4 text-center text-slate-600">—</td>
                    <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => onSelectWindow(pc.name)}
                          className="bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all shadow-sm active:scale-95 px-3 py-1.5 rounded-lg text-xs"
                        >
                          Mapear
                        </button>
                        <button
                          onClick={() => onDeleteWindow(pc.name)}
                          className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all active:scale-90"
                          title="Descartar borrador"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredWindows.map(w => (
                  <tr
                    key={w.name}
                    onClick={() => onSelectWindow(w.name)}
                    className="hover:bg-navy-900/20 cursor-pointer transition-colors h-11"
                  >
                    <td className="py-2.5 px-4 font-black text-slate-100 tracking-wide">
                      <div className="flex items-center gap-2">
                        <span>{w.name}</span>
                        {/* Estado único: cualquier celda con cambios locales sin guardar es un BORRADOR */}
                        {pendingCellNames.includes(w.name) && (
                          <span className="text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black px-1.5 py-0.5 rounded uppercase tracking-wider" title="Celda con cambios sin guardar. Ábrela para editarla y usa GUARDAR CAMBIOS.">
                            BORRADOR
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[10px]">{w.fecha_mapeo}</td>
                    <td className="py-2.5 px-4 text-slate-400">{w.sector_geotecnico || '—'}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-amber-400">{w.rmr_76.toFixed(2)}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-pink-400">{w.rmr_89.toFixed(2)}</td>
                    <td className="py-2.5 px-4 text-center text-amber-400">{w.rqd76_pct !== null ? w.rqd76_pct.toFixed(2) : '—'}</td>
                    <td className="py-2.5 px-4 text-center text-pink-400">{w.rqd89_pct !== null ? w.rqd89_pct.toFixed(2) : '—'}</td>
                    <td className="py-2.5 px-4 text-center text-violet-400">{w.gsi_visual !== null ? Math.round(w.gsi_visual) : '—'}</td>
                    <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => onSelectWindow(w.name)}
                          className="bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all shadow-sm active:scale-95 px-3 py-1.5 rounded-lg text-xs"
                        >
                          Mapear
                        </button>
                        <button
                          onClick={() => onDeleteWindow(w.name)}
                          className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all active:scale-90"
                          title="Eliminar celda"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredWindows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 text-xs font-semibold">
                      No se encontraron celdas en este rango. {activeDateRange === 'hoy' ? 'Crea la primera del día.' : 'Prueba con otro filtro.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Filas por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="bg-navy-950 border border-navy-800 rounded px-2 py-1 text-slate-200 text-xs"
                >
                  {[20, 50, 100, 200].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded border border-navy-800 bg-navy-900/40 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={14} />
                </button>
                {(() => {
                  const pages = [];
                  const maxVisible = 7;
                  let start = Math.max(1, page - Math.floor(maxVisible / 2));
                  const end = Math.min(totalPages, start + maxVisible - 1);
                  if (end - start + 1 < maxVisible) {
                    start = Math.max(1, end - maxVisible + 1);
                  }
                  if (start > 1) {
                    pages.push(
                      <button key={1} onClick={() => onPageChange(1)} className="px-2.5 py-1 rounded text-xs text-slate-500 hover:text-slate-200">1</button>
                    );
                    if (start > 2) pages.push(<span key="dots1" className="text-slate-600 px-1">...</span>);
                  }
                  for (let i = start; i <= end; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => onPageChange(i)}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${i === page
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                          : 'text-slate-400 hover:text-slate-200'
                          }`}
                      >
                        {i}
                      </button>
                    );
                  }
                  if (end < totalPages) {
                    if (end < totalPages - 1) pages.push(<span key="dots2" className="text-slate-600 px-1">...</span>);
                    pages.push(
                      <button key={totalPages} onClick={() => onPageChange(totalPages)} className="px-2.5 py-1 rounded text-xs text-slate-500 hover:text-slate-200">{totalPages}</button>
                    );
                  }
                  return pages;
                })()}
                <button
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded border border-navy-800 bg-navy-900/40 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CreateWindowModal */}
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