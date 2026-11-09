// src/features/grid/schema/validationEngine.ts
import type { ColumnSchema, QAQCAlert } from './types';
import { GLOBAL_EMPTY_TOKENS } from './types';

export function isEmptyValue(
  val: any,
  extraTokens?: string[],
  excludedTokens?: string[]
): boolean {
  if (val === null || val === undefined) return true;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return true;

    if (excludedTokens && excludedTokens.includes(trimmed)) {
      return false;
    }

    if (GLOBAL_EMPTY_TOKENS.includes(trimmed)) {
      return true;
    }

    if (extraTokens && extraTokens.includes(trimmed)) {
      return true;
    }
  }

  return false;
}

export function validateCell(
  val: any,
  row: Record<string, any>,
  col: ColumnSchema
): QAQCAlert | null {
  const rowId = Number(row.id || row.idd || 0);

  // 1. Validación de vacíos según política
  const isValEmpty = isEmptyValue(val, col.extraEmptyTokens, col.emptyTokensExclude);
  if (isValEmpty) {
    if (col.emptyPolicy === 'block') {
      return {
        rowId,
        field: col.id,
        type: 'CRÍTICO',
        message: `${col.header} es obligatorio`,
        value: val
      };
    }
    if (col.emptyPolicy === 'warn') {
      return {
        rowId,
        field: col.id,
        type: 'AVISO',
        message: `${col.header} no debería estar vacío`,
        value: val
      };
    }
    return null;
  }

  // 2. Validación de restricciones numéricas
  if (col.type === 'decimal' || col.type === 'integer') {
    const num = Number(val);
    if (isNaN(num)) {
      return {
        rowId,
        field: col.id,
        type: 'CRÍTICO',
        message: `${col.header} debe ser un valor numérico`,
        value: val
      };
    }

    const c = col.constraints;
    if (c) {
      if (c.positiveOnly && num < 0) {
        return {
          rowId,
          field: col.id,
          type: 'CRÍTICO',
          message: `${col.header} no admite valores negativos (${num})`,
          value: val
        };
      }

      if (c.minHard !== undefined && num < c.minHard) {
        return {
          rowId,
          field: col.id,
          type: 'CRÍTICO',
          message: `${col.header} por debajo del límite mínimo (${c.minHard}): ${num}`,
          value: val
        };
      }

      if (c.maxHard !== undefined && num > c.maxHard) {
        return {
          rowId,
          field: col.id,
          type: 'CRÍTICO',
          message: `${col.header} supera el límite máximo (${c.maxHard}): ${num}`,
          value: val
        };
      }

      if (c.minSoft !== undefined && num < c.minSoft) {
        return {
          rowId,
          field: col.id,
          type: 'AVISO',
          message: `${col.header} fuera del rango recomendado (mín ${c.minSoft}): ${num}`,
          value: val
        };
      }

      if (c.maxSoft !== undefined && num > c.maxSoft) {
        return {
          rowId,
          field: col.id,
          type: 'AVISO',
          message: `${col.header} fuera del rango recomendado (máx ${c.maxSoft}): ${num}`,
          value: val
        };
      }
    }
  }

  // 3. Validadores personalizados si existen
  if (col.customValidators && col.customValidators.length > 0) {
    for (const validator of col.customValidators) {
      const alert = validator(val, row);
      if (alert) return alert;
    }
  }

  return null;
}

export function validateRow(
  row: Record<string, any>,
  schema: ColumnSchema[]
): QAQCAlert[] {
  const alerts: QAQCAlert[] = [];
  for (const col of schema) {
    if (col.editor === 'none' && !col.customValidators) continue;
    const alert = validateCell(row[col.id], row, col);
    if (alert) {
      alerts.push(alert);
    }
  }
  return alerts;
}

