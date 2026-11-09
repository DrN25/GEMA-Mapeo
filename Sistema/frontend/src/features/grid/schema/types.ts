// src/features/grid/schema/types.ts

export type ColumnDataType = 'text' | 'integer' | 'decimal' | 'select' | 'readonly' | 'date';

export type EmptyPolicy = 'allowed' | 'warn' | 'block';

export type AlertSeverity = 'CRÍTICO' | 'AVISO';

export const GLOBAL_EMPTY_TOKENS: readonly string[] = ['-', '--'];

export interface QAQCAlert {
  rowId: number;
  field: string;
  type: AlertSeverity;
  message: string;
  value?: any;
}

export interface ColumnConstraints {
  positiveOnly?: boolean;
  minHard?: number;
  maxHard?: number;
  minSoft?: number;
  maxSoft?: number;
  maxLength?: number;
}

export interface ColumnSchema<TRow = Record<string, any>> {
  id: string;
  header: string;
  excelName: string;
  group: string;
  groupBg?: string;
  module: string;
  type: ColumnDataType;
  decimals?: number;
  unit?: string;
  hint?: string;
  displayHint?: string;
  pinned?: 'left' | 'right' | false;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  editor: 'text' | 'select' | 'number' | 'date' | 'none';
  constraints?: ColumnConstraints;
  emptyPolicy: EmptyPolicy;
  extraEmptyTokens?: string[];
  emptyTokensExclude?: string[];
  options?: string[];
  getDynamicOptions?: (row: TRow) => string[];
  autoGenerate?: (row: TRow) => string;
  calculate?: (row: TRow) => any;
  format?: (val: any) => string;
  cellClassName?: (val: any, row: TRow) => string;
  customStyleClass?: string;
  customValidators?: ((val: any, row: TRow) => QAQCAlert | null)[];
  hidden?: boolean;
}

