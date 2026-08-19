import React, { useState, useEffect } from 'react';
import { Filter, ChevronDown, Trash2 } from 'lucide-react';
import { limitNumberWithMax } from '../../utils/inputLimits';

export interface AdvancedFiltersState {
  celda: string;
  sector: string;
  rmr76: string;
  rmr89: string;
  rqd76: string;
  rqd89: string;
  gsi: string;
}

export interface CellFiltersProps {
  activeDateRange: string;
  onFilterChange: (filters: { dateRange?: string }) => void;
  advancedFilters: AdvancedFiltersState;
  onAdvancedFilterChange: (filters: AdvancedFiltersState) => void;
  onClearAdvancedFilters: () => void;
  hideDateChips?: boolean;
  className?: string;
}

export const DATE_RANGE_OPTIONS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'ayer', label: 'Ayer' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mes' },
  { key: 'ano', label: 'Este año' },
  { key: 'todo', label: 'Todo' },
];

export const CellFilters: React.FC<CellFiltersProps> = ({
  activeDateRange,
  onFilterChange,
  advancedFilters,
  onAdvancedFilterChange,
  onClearAdvancedFilters,
  hideDateChips = false,
  className = ''
}) => {
  const [localAdv, setLocalAdv] = useState<AdvancedFiltersState>(advancedFilters);

  useEffect(() => {
    setLocalAdv(advancedFilters);
  }, [advancedFilters]);

  const hasAdvancedFilters = !!(
    localAdv.celda.trim() || localAdv.sector.trim() || localAdv.rmr76 !== '' ||
    localAdv.rmr89 !== '' || localAdv.rqd76 !== '' || localAdv.rqd89 !== '' || localAdv.gsi !== ''
  );

  const activeFiltersCount = [
    localAdv.celda, localAdv.sector, localAdv.rmr76, localAdv.rmr89, localAdv.rqd76, localAdv.rqd89, localAdv.gsi
  ].filter(v => v !== '').length;

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

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Date range chips */}
      {!hideDateChips && (
        <div className="flex flex-wrap gap-2">
          {DATE_RANGE_OPTIONS.map(chip => (
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
      )}

      {/* Filtros avanzados colapsable */}
      <details className="group" open={hasAdvancedFilters}>
        <summary className="flex items-center gap-2 text-xs text-slate-500 font-semibold cursor-pointer hover:text-slate-300 transition-all select-none list-none">
          <Filter size={14} />
          <span>Filtros avanzados</span>
          {hasAdvancedFilters && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 text-[10px] font-black">
              {activeFiltersCount} activos
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
                    type="text"
                    inputMode="decimal"
                    placeholder="55.25"
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
                    type="text"
                    inputMode="decimal"
                    placeholder="55.25"
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
                    type="text"
                    inputMode="decimal"
                    placeholder="80.5"
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
                    type="text"
                    inputMode="decimal"
                    placeholder="80.5"
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
                  type="text"
                  inputMode="numeric"
                  placeholder="60"
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
                  className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 px-3 py-1.5 rounded-lg transition-all active:scale-95 shadow-sm"
                  title="Limpiar todos los filtros avanzados"
                >
                  <Trash2 size={13} />
                  <span>Limpiar filtros</span>
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
    </div>
  );
};

export default CellFilters;
