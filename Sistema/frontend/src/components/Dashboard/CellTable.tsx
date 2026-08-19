import React from 'react';
import { Trash2, Check, Plus } from 'lucide-react';
import type { WindowSummary } from './Dashboard';
import type { PendingCellSummary } from '../../utils/cellRegistry';
import { CELL_SOURCE_LABELS } from '../../utils/cellRegistry';

export interface CellTableProps {
  windows: WindowSummary[];
  loading: boolean;
  pageSize: number;
  pendingCells?: PendingCellSummary[];
  pendingCellNames?: string[];
  mode?: 'dashboard' | 'select';
  onSelectWindow?: (name: string) => void;
  onDeleteWindow?: (name: string) => void;
  selectedCellNames?: string[];
  onToggleSelectCell?: (name: string) => void;
  emptyMessage?: string;
  className?: string;
}

export const CellTable: React.FC<CellTableProps> = ({
  windows,
  loading,
  pageSize,
  pendingCells = [],
  pendingCellNames = [],
  mode = 'dashboard',
  onSelectWindow,
  onDeleteWindow,
  selectedCellNames = [],
  onToggleSelectCell,
  emptyMessage = 'No se encontraron celdas en este rango.',
  className = ''
}) => {
  const isSelectMode = mode === 'select';

  const isCellSelected = (name: string) => {
    const up = name.trim().toUpperCase();
    return selectedCellNames.some(n => n.trim().toUpperCase() === up);
  };

  const handleRowClick = (name: string) => {
    if (isSelectMode) {
      if (onToggleSelectCell) onToggleSelectCell(name);
    } else {
      if (onSelectWindow) onSelectWindow(name);
    }
  };

  return (
    <div className={`overflow-x-auto rounded-xl border border-navy-800 bg-navy-950/30 ${className}`}>
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="text-[10px] text-slate-400 font-black uppercase tracking-wider border-b border-navy-800 bg-navy-900/60 h-9">
            {isSelectMode && (
              <th className="py-2 px-3 text-center w-10">
                <span className="sr-only">Seleccionar</span>
              </th>
            )}
            <th className="py-2 px-4">Celda</th>
            <th className="py-2 px-4">Fecha</th>
            <th className="py-2 px-4">Sector</th>
            <th className="py-2 px-4 text-center text-amber-400">RMR 76</th>
            <th className="py-2 px-4 text-center text-pink-400">RMR 89</th>
            <th className="py-2 px-4 text-center text-amber-400">RQD % 76</th>
            <th className="py-2 px-4 text-center text-pink-400">RQD % 89</th>
            <th className="py-2 px-4 text-center text-violet-400">GSI Visual</th>
            <th className="py-2 px-4 text-center">{isSelectMode ? 'Selección' : 'Acción'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-800/60 text-slate-200 font-medium">
          {loading && [...Array(pageSize)].map((_, i) => (
            <tr key={`skeleton-${i}`} className="h-11 animate-pulse">
              {isSelectMode && (
                <td className="py-2.5 px-3 text-center">
                  <div className="h-4 w-4 bg-navy-800/60 rounded mx-auto" />
                </td>
              )}
              {[...Array(9)].map((_, j) => (
                <td key={j} className="py-2.5 px-4">
                  <div className="h-3 bg-navy-800/60 rounded w-3/4 mx-auto" />
                </td>
              ))}
            </tr>
          ))}

          {/* Celdas Borradores Pendientes (sin sincronizar) */}
          {!loading && pendingCells.length > 0 && pendingCells.map(pc => {
            const selected = isCellSelected(pc.name);
            return (
              <tr
                key={`pend-${pc.name}`}
                onClick={() => handleRowClick(pc.name)}
                className={`cursor-pointer transition-colors h-11 ${
                  selected
                    ? 'bg-emerald-500/15 hover:bg-emerald-500/20 border-l-2 border-emerald-400'
                    : 'bg-amber-500/[0.04] hover:bg-navy-900/40'
                }`}
              >
                {isSelectMode && (
                  <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelectCell && onToggleSelectCell(pc.name)}
                      className="w-4 h-4 rounded border-navy-700 bg-navy-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                    />
                  </td>
                )}
                <td className="py-2.5 px-4 font-black text-slate-100 tracking-wide">
                  <div className="flex items-center gap-2">
                    <span>{pc.name}</span>
                    {CELL_SOURCE_LABELS.local && (
                      <span
                        className="text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black px-1.5 py-0.5 rounded uppercase tracking-wider"
                        title="Esta celda aún no se ha guardado en la base de datos (Borrador local)."
                      >
                        {CELL_SOURCE_LABELS.local}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-4 text-slate-400 text-[10px]">{pc.fecha_mapeo || '—'}</td>
                <td className="py-2.5 px-4 text-slate-400">{pc.sector_geotecnico || '—'}</td>
                <td className="py-2.5 px-4 text-center text-slate-500">—</td>
                <td className="py-2.5 px-4 text-center text-slate-500">—</td>
                <td className="py-2.5 px-4 text-center text-slate-500">—</td>
                <td className="py-2.5 px-4 text-center text-slate-500">—</td>
                <td className="py-2.5 px-4 text-center text-slate-500">—</td>
                <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                  {isSelectMode ? (
                    <button
                      onClick={() => onToggleSelectCell && onToggleSelectCell(pc.name)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 mx-auto active:scale-95 ${
                        selected
                          ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-400'
                          : 'bg-navy-800/80 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-400 border border-navy-700/80 hover:border-emerald-500/40'
                      }`}
                    >
                      {selected ? (
                        <>
                          <Check size={12} />
                          <span>En Cola</span>
                        </>
                      ) : (
                        <>
                          <Plus size={12} />
                          <span>Agregar</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => onSelectWindow && onSelectWindow(pc.name)}
                        className="bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all shadow-sm active:scale-95 px-3 py-1.5 rounded-lg text-xs"
                      >
                        Mapear
                      </button>
                      {onDeleteWindow && (
                        <button
                          onClick={() => onDeleteWindow(pc.name)}
                          className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all active:scale-90"
                          title="Descartar borrador"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}

          {/* Celdas Sincronizadas / Registradas */}
          {!loading && windows.map(w => {
            const selected = isCellSelected(w.name);
            const isPending = pendingCellNames.includes(w.name);
            return (
              <tr
                key={w.name}
                onClick={() => handleRowClick(w.name)}
                className={`cursor-pointer transition-colors h-11 ${
                  selected
                    ? 'bg-emerald-500/15 hover:bg-emerald-500/20 border-l-2 border-emerald-400'
                    : 'hover:bg-navy-900/40'
                }`}
              >
                {isSelectMode && (
                  <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelectCell && onToggleSelectCell(w.name)}
                      className="w-4 h-4 rounded border-navy-700 bg-navy-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                    />
                  </td>
                )}
                <td className="py-2.5 px-4 font-black text-slate-100 tracking-wide">
                  <div className="flex items-center gap-2">
                    <span>{w.name}</span>
                    {isPending && (
                      <span
                        className="text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black px-1.5 py-0.5 rounded uppercase tracking-wider"
                        title="Celda con cambios sin guardar."
                      >
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
                  {isSelectMode ? (
                    <button
                      onClick={() => onToggleSelectCell && onToggleSelectCell(w.name)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 mx-auto active:scale-95 ${
                        selected
                          ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-400'
                          : 'bg-navy-800/80 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-400 border border-navy-700/80 hover:border-emerald-500/40'
                      }`}
                    >
                      {selected ? (
                        <>
                          <Check size={12} />
                          <span>En Cola</span>
                        </>
                      ) : (
                        <>
                          <Plus size={12} />
                          <span>Agregar</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => onSelectWindow && onSelectWindow(w.name)}
                        className="bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all shadow-sm active:scale-95 px-3 py-1.5 rounded-lg text-xs"
                      >
                        Mapear
                      </button>
                      {onDeleteWindow && (
                        <button
                          onClick={() => onDeleteWindow(w.name)}
                          className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all active:scale-90"
                          title="Eliminar celda"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}

          {!loading && windows.length === 0 && pendingCells.length === 0 && (
            <tr>
              <td colSpan={isSelectMode ? 10 : 9} className="py-12 text-center text-slate-500 text-xs font-semibold">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CellTable;
