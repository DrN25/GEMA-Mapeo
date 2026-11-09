// src/features/grid/schema/columnFactories.ts
import type { ColumnSchema } from './types';

export type FactoryInput<TRow = Record<string, any>> = Omit<
  Partial<ColumnSchema<TRow>>,
  'id' | 'header' | 'excelName' | 'group' | 'module'
> & {
  id: string;
  header: string;
  excelName: string;
  group: string;
  module: string;
};

export function formatInteger(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  return isNaN(num) ? String(val) : String(Math.round(num));
}

export function formatDecimal(val: any, decimals: number = 2): string {
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return String(parseFloat(num.toFixed(decimals)));
}

export function textColumn<TRow = Record<string, any>>(
  config: FactoryInput<TRow>
): ColumnSchema<TRow> {
  return {
    defaultWidth: 120,
    minWidth: 70,
    editor: 'text',
    emptyPolicy: 'allowed',
    format: (val: any) => (val === null || val === undefined ? '' : String(val).trim()),
    ...config,
    type: 'text'
  };
}

export function integerColumn<TRow = Record<string, any>>(
  config: FactoryInput<TRow>
): ColumnSchema<TRow> {
  return {
    defaultWidth: 80,
    minWidth: 60,
    editor: 'number',
    emptyPolicy: 'allowed',
    format: formatInteger,
    ...config,
    type: 'integer'
  };
}

export function decimalColumn<TRow = Record<string, any>>(
  config: FactoryInput<TRow>
): ColumnSchema<TRow> {
  const decimals = config.decimals ?? 2;
  const defaultDisplayHint = `Vista a ${decimals} decimales; el valor guardado conserva su precisión original`;
  return {
    defaultWidth: 120,
    minWidth: 70,
    decimals,
    editor: 'number',
    emptyPolicy: 'allowed',
    format: (val: any) => formatDecimal(val, decimals),
    ...config,
    displayHint: config.displayHint ?? defaultDisplayHint,
    type: 'decimal'
  };
}

export function selectColumn<TRow = Record<string, any>>(
  config: FactoryInput<TRow>
): ColumnSchema<TRow> {
  return {
    defaultWidth: 130,
    minWidth: 80,
    editor: 'select',
    emptyPolicy: 'allowed',
    format: (val: any) => (val === null || val === undefined ? '' : String(val).trim()),
    ...config,
    type: 'select'
  };
}

export function dateColumn<TRow = Record<string, any>>(
  config: FactoryInput<TRow>
): ColumnSchema<TRow> {
  return {
    defaultWidth: 120,
    minWidth: 90,
    editor: 'date',
    emptyPolicy: 'allowed',
    format: (val: any) => (val === null || val === undefined ? '' : String(val).trim()),
    ...config,
    type: 'date'
  };
}

export function calculatedColumn<TRow = Record<string, any>>(
  config: FactoryInput<TRow>
): ColumnSchema<TRow> {
  const decimals = config.decimals ?? 2;
  const defaultDisplayHint = `Vista a ${decimals} decimales; calculado automáticamente`;
  return {
    defaultWidth: 140,
    minWidth: 80,
    decimals,
    editor: 'none',
    emptyPolicy: 'allowed',
    format: (val: any) => formatDecimal(val, decimals),
    ...config,
    displayHint: config.displayHint ?? defaultDisplayHint,
    type: 'readonly'
  };
}

export function actionColumn<TRow = Record<string, any>>(
  config: FactoryInput<TRow>
): ColumnSchema<TRow> {
  return {
    defaultWidth: 90,
    minWidth: 80,
    editor: 'none',
    pinned: 'right',
    emptyPolicy: 'allowed',
    ...config,
    type: 'readonly'
  };
}

