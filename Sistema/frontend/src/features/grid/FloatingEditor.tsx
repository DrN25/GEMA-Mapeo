// src/features/grid/FloatingEditor.tsx
import React, { useEffect, useRef, useMemo } from 'react';
import type { GridColumnDef, FloatingEditorPosition } from './types';
import { useGridStore } from './gridStore';
import { PLT_SCHEMA_MAP, validateCell } from './schema';

interface FloatingEditorProps {
  position: FloatingEditorPosition;
  column: GridColumnDef;
  onCommit: () => void;
  onCancel: () => void;
  onNavigateNext?: (direction: 'down' | 'right' | 'up' | 'left') => void;
}

export const FloatingEditor: React.FC<FloatingEditorProps> = ({
  position,
  column,
  onCommit,
  onCancel,
  onNavigateNext
}) => {
  const editorValue = useGridStore(s => s.editorValue);
  const setEditorValue = useGridStore(s => s.setEditorValue);

  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (column.editor === 'select' && selectRef.current) {
      selectRef.current.focus();
    } else if (inputRef.current) {
      inputRef.current.focus();
      if (column.editor !== 'date') {
        inputRef.current.select();
      }
    }
  }, [column.editor]);

  // Obtener la fila en edición para opciones dinámicas y validación en caliente
  const editingRow = useMemo(() => {
    const editingCell = useGridStore.getState().editingCell;
    const rowId = editingCell?.rowId;
    return rowId !== undefined ? useGridStore.getState().recordsById.get(rowId) || {} : {};
  }, []);

  // Opciones del select: soporta estáticas o dinámicas por fila (cascada litológica)
  const resolvedOptions = useMemo(() => {
    if (column.getDynamicOptions) {
      return column.getDynamicOptions(editingRow);
    }
    return column.options || [];
  }, [column, editingRow]);

  // Validación reactiva en caliente usando el esquema SSOT
  const validationAlert = useMemo(() => {
    const schemaCol = PLT_SCHEMA_MAP.get(column.id);
    if (!schemaCol) return null;
    return validateCell(editorValue, editingRow, schemaCol);
  }, [editorValue, column.id, editingRow]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit();
      onNavigateNext?.('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onCommit();
      onNavigateNext?.(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const isSelect = column.editor === 'select';
  const isDate = column.editor === 'date' || column.type === 'date';

  let borderColor = 'border-indigo-500 ring-2 ring-indigo-500/40';
  if (validationAlert?.type === 'CRÍTICO') {
    borderColor = 'border-rose-500 ring-2 ring-rose-500/50 shadow-rose-950/50';
  } else if (validationAlert?.type === 'AVISO') {
    borderColor = 'border-amber-400 ring-2 ring-amber-500/50 shadow-amber-950/50';
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
        zIndex: 50
      }}
      className="animate-scale-up shadow-2xl"
    >
      {isSelect ? (
        <select
          ref={selectRef}
          data-testid="floating-select"
          value={editorValue ?? ''}
          onChange={(e) => setEditorValue(e.target.value)}
          onBlur={onCommit}
          onKeyDown={handleKeyDown}
          className={`w-full h-full bg-navy-950 border ${borderColor} text-slate-100 px-1 text-center text-xs font-semibold rounded shadow-lg outline-none cursor-pointer`}
        >
          <option value="" className="bg-navy-950 text-slate-500">—</option>
          {resolvedOptions.map((opt) => (
            <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          ref={inputRef}
          data-testid="floating-input"
          type={isDate ? 'date' : 'text'}
          value={editorValue ?? ''}
          onChange={(e) => setEditorValue(e.target.value)}
          onBlur={onCommit}
          onKeyDown={handleKeyDown}
          className={`w-full h-full bg-navy-950 border ${borderColor} text-slate-100 px-2 text-center text-xs font-medium rounded shadow-lg outline-none`}
        />
      )}

      {/* Tooltip de feedback en caliente si hay alerta */}
      {validationAlert && (
        <div
          data-testid="floating-editor-tooltip"
          className={`absolute top-full left-0 mt-1 px-2 py-0.5 text-[11px] font-sans rounded shadow-xl whitespace-nowrap z-50 pointer-events-none ${
            validationAlert.type === 'CRÍTICO'
              ? 'bg-rose-950/95 border border-rose-500 text-rose-200'
              : 'bg-amber-950/95 border border-amber-500 text-amber-200'
          }`}
        >
          {validationAlert.type === 'CRÍTICO' ? '⚠️' : 'ℹ️'} {validationAlert.message}
        </div>
      )}
    </div>
  );
};

