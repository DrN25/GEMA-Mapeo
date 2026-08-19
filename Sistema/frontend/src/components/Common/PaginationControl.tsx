import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationControlProps {
  page: number;
  pageSize: number;
  totalPages: number;
  totalFiltered?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const PaginationControl: React.FC<PaginationControlProps> = ({
  page,
  pageSize,
  totalPages,
  totalFiltered,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100, 200],
  className = ''
}) => {
  if (totalPages <= 1 && (!pageSizeOptions || pageSizeOptions.length === 0)) {
    return null;
  }

  const renderPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('dots1');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('dots2');
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 pt-2 ${className}`}>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>Filas por página:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="bg-navy-950 border border-navy-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          {pageSizeOptions.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {totalFiltered !== undefined && (
          <span className="text-[11px] text-slate-500 ml-1">
            ({totalFiltered.toLocaleString()} {totalFiltered === 1 ? 'resultado' : 'resultados'})
          </span>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded border border-navy-800 bg-navy-900/40 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Página anterior"
          >
            <ChevronLeft size={14} />
          </button>

          {renderPageNumbers().map((item, idx) => {
            if (typeof item === 'string') {
              return <span key={`${item}-${idx}`} className="text-slate-600 px-1">...</span>;
            }
            return (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  item === page
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-[0_0_8px_rgba(139,92,246,0.2)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-900/40'
                }`}
              >
                {item}
              </button>
            );
          })}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded border border-navy-800 bg-navy-900/40 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Página siguiente"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PaginationControl;
