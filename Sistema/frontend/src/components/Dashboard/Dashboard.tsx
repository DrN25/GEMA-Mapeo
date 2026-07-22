import React, { useState } from 'react';
import { Plus, Search, Map, User, LayoutGrid, Trash2, TrendingUp, FileSpreadsheet, Calendar, ChevronLeft, ChevronRight, Filter, X, ChevronDown } from 'lucide-react';
import CreateWindowModal from '../CreateWindowModal';

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
  pendingImports: string[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onFilterChange: (filters: { dateRange?: string }) => void;
  activeDateRange: string;
  onSelectWindow: (name: string) => void;
  onCreateWindow: (newWindow: any) => void;
  onDeleteWindow: (name: string) => void;
  onOpenImportModal: () => void;
}

export default function Dashboard({
  windows,
  kpis,
  page,
  pageSize,
  totalFiltered,
  totalPages,
  loading,
  pendingImports,
  onPageChange,
  onPageSizeChange,
  onFilterChange,
  activeDateRange,
  onSelectWindow,
  onCreateWindow,
  onDeleteWindow,
  onOpenImportModal
}: DashboardProps) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Filtrar ventanas por busqueda local
  const filteredWindows = search.trim()
    ? windows.filter(w => w.name.toLowerCase().includes(search.toLowerCase().trim()))
    : windows;

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
    <div className="space-y-6 select-none w-full animate-fade-in text-left">
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
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 border ${
              activeDateRange === chip.key
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
          <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
        </summary>
        <div className="mt-3 p-4 bg-navy-950/30 border border-navy-800 rounded-xl grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Sector</label>
            <input type="text" placeholder="NW1_B, E1..."
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Mapeador</label>
            <input type="text" placeholder="SRK, JAMH..."
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">RMR mínimo</label>
            <input type="number" min="0" max="100" placeholder="0"
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">RMR máximo</label>
            <input type="number" min="0" max="100" placeholder="100"
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div className="flex items-end">
            <button
              className="w-full bg-indigo-500/10 border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
            >
              Aplicar
            </button>
          </div>
        </div>
      </details>

      {/* KPIs contextuales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar celda por código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onFilterChange({ dateRange: activeDateRange }); }}
            className="w-full bg-navy-950/80 border border-navy-800 rounded-lg pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-navy-900 bg-navy-950/30">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 font-black uppercase tracking-wider border-b border-navy-800/80 bg-navy-900/40 h-9">
                <th className="py-2 px-4">Celda</th>
                <th className="py-2 px-4">Fecha</th>
                <th className="py-2 px-4">Sector</th>
                <th className="py-2 px-4 text-center">Largo (m)</th>
                <th className="py-2 px-4 text-center">Altura (m)</th>
                <th className="py-2 px-4">Mapeador</th>
                <th className="py-2 px-4 text-center">RMR 89</th>
                <th className="py-2 px-4 text-center">Clase</th>
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
              {!loading && filteredWindows.map(w => (
                <tr
                  key={w.name}
                  onClick={() => onSelectWindow(w.name)}
                  className="hover:bg-navy-900/20 cursor-pointer transition-colors h-11"
                >
                  <td className="py-2.5 px-4 font-black text-slate-100 tracking-wide">
                    <div className="flex items-center gap-2">
                      <span>{w.name}</span>
                      {pendingImports.includes(w.name) && (
                        <span className="text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">IMPORTADO</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 text-[10px]">{w.fecha_mapeo}</td>
                  <td className="py-2.5 px-4 text-slate-400">{w.sector_geotecnico || '—'}</td>
                  <td className="py-2.5 px-4 text-center text-slate-300 font-bold">
                    {w.largo ? `${w.largo.toFixed(2)} m` : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-center text-slate-400">
                    {w.altura ? `${w.altura.toFixed(1)} m` : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-slate-500" />
                      <span>{w.geologo || '—'}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-center font-bold text-indigo-400">{w.rmr_89}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                      w.rmr_89 >= 81 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      w.rmr_89 >= 61 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      w.rmr_89 >= 51 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      w.rmr_89 >= 41 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {w.rmr_89 >= 81 ? 'MUY BUENA' :
                       w.rmr_89 >= 61 ? 'BUENA' :
                       w.rmr_89 >= 51 ? 'REGULAR' :
                       w.rmr_89 >= 41 ? 'MALA' : 'MUY MALA'}
                    </span>
                  </td>
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
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                        i === page
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
      />
    </div>
    </>
  );
}