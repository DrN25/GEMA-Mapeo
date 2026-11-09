// src/features/grid/types.ts

export type ColumnType = 'string' | 'number' | 'select' | 'date' | 'readonly';
export type ColumnEditor = 'text' | 'select' | 'number' | 'date' | 'none';
export type ColumnPinned = 'left' | 'right' | false;

export interface ColumnValidationRules {
  min?: number;
  max?: number;
  required?: boolean;
  options?: string[];
  customRule?: string;
}

export interface GridColumnDef<T = Record<string, any>> {
  id: string;
  header: string;
  group: string;
  groupBg?: string;
  accessorKey: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  pinned?: ColumnPinned;
  type: ColumnType;
  editor: ColumnEditor;
  options?: string[];
  getDynamicOptions?: (row: T) => string[];
  validations?: ColumnValidationRules;
  hint?: string;
  unit?: string;
  formula?: string;
  decimals?: number;
  displayHint?: string;
  format?: (value: any) => string;
  cellClassName?: (value: any, row: T) => string;
  customStyleClass?: string;
}

export interface CellCoordinate {
  rowIdx: number;
  colKey: string;
  rowId?: number;
}

export interface FloatingEditorPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type GridVersion = 'v1' | 'v2';

