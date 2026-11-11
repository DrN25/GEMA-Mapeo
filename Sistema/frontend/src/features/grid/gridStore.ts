// src/features/grid/gridStore.ts
import { create } from 'zustand';
import type { CellCoordinate } from './types';
import type { QAQCAlert } from './schema/types';
import { PLT_SCHEMA, PLT_SCHEMA_MAP, validateRow } from './schema';
import { LITHOLOGY_CLASSIFICATION } from '../../utils/catalogData';
import { resolveExpectedKStrict } from '../../utils/pltQaQcRules';

const LITO_TRIGGER_KEYS = new Set(['litologia_1', 'litologia_2', 'litologia_3', 'model2022']);
const PLT_CALC_COLS = PLT_SCHEMA.filter(col => Boolean(col.calculate || col.autoGenerate));
const PLT_VALID_COLS = PLT_SCHEMA.filter(col => col.editor !== 'none' || Boolean(col.customValidators));

function isRecordDifferent(
  a: Record<string, any> | undefined,
  b: Record<string, any> | undefined
): boolean {
  if (!a || !b) return true;
  for (const col of PLT_SCHEMA) {
    if (col.editor === 'none' && !col.calculate) continue;
    const key = col.id;
    const valA = a[key];
    const valB = b[key];
    if (valA === undefined && valB === undefined) continue;
    if (valA === null && valB === null) continue;
    if (String(valA ?? '').trim() !== String(valB ?? '').trim()) {
      return true;
    }
  }
  return false;
}

export function recalculateDerivedFields(
  row: Record<string, any>,
  colKey?: string
): void {
  const kIsBlank =
    row.factor_conversion_k === null ||
    row.factor_conversion_k === undefined ||
    String(row.factor_conversion_k).trim() === '';
  if (kIsBlank || (colKey && LITO_TRIGGER_KEYS.has(colKey))) {
    const kExpected = resolveExpectedKStrict(row);
    if (kExpected !== null) {
      row.factor_conversion_k = kExpected;
    }
  }

  for (const col of PLT_CALC_COLS) {
    if (col.calculate) {
      const calcVal = col.calculate(row);
      if (calcVal !== undefined) {
        row[col.id] = calcVal;
      }
    } else if (col.autoGenerate && (!row[col.id] || String(row[col.id]).trim() === '')) {
      const genVal = col.autoGenerate(row);
      if (genVal !== undefined) {
        row[col.id] = genVal;
      }
    }
  }
}

export interface GridStoreState {
  recordsById: Map<number, Record<string, any>>;
  originalRecordsById: Map<number, Record<string, any>>;
  rowIds: number[];
  rowVersions: Map<number, number>;
  dataVersion: number;
  rowKey: string;

  qaqcAlertsByRowId: Map<number, QAQCAlert[]>;

  activeCell: CellCoordinate | null;
  editingCell: CellCoordinate | null;
  editorValue: any;

  dirtyRowIds: Set<number>;

  setInitialRecords: (records: Record<string, any>[], rowKey?: string) => void;
  getRowById: (rowId: number) => Record<string, any> | undefined;
  getAllRecords: () => Record<string, any>[];
  setActiveCell: (coord: CellCoordinate | null) => void;
  startEditing: (coord: CellCoordinate) => void;
  setEditorValue: (val: any) => void;
  commitEditing: () => void;
  cancelEditing: () => void;
  updateCell: (rowId: number, colKey: string, value: any) => void;
  insertRowBelow: (rowIdx: number, prefill?: Partial<Record<string, any>>) => number;
  deleteRow: (rowId: number) => void;
}

export const useGridStore = create<GridStoreState>((set, get) => ({
  recordsById: new Map(),
  originalRecordsById: new Map(),
  rowIds: [],
  rowVersions: new Map(),
  dataVersion: 1,
  rowKey: 'id',

  qaqcAlertsByRowId: new Map(),

  activeCell: null,
  editingCell: null,
  editorValue: '',

  dirtyRowIds: new Set(),

  setInitialRecords: (records: Record<string, any>[], rowKey: string = 'id') => {
    const recordsMap = new Map<number, Record<string, any>>();
    const originalMap = new Map<number, Record<string, any>>();
    const rowIds: number[] = [];
    const rowVersions = new Map<number, number>();
    const qaqcMap = new Map<number, QAQCAlert[]>();

    for (let i = 0; i < records.length; i++) {
      const orig = records[i];
      const rawId = orig[rowKey] !== undefined && orig[rowKey] !== null
        ? Number(orig[rowKey])
        : Date.now() + i;
      const validId = isNaN(rawId) ? Date.now() + i : rawId;

      const rowCopy = { ...orig, [rowKey]: validId };
      recalculateDerivedFields(rowCopy);

      recordsMap.set(validId, rowCopy);
      originalMap.set(validId, { ...rowCopy });
      rowIds.push(validId);
      rowVersions.set(validId, 1);

      const alerts = validateRow(rowCopy, PLT_VALID_COLS);
      if (alerts.length > 0) {
        qaqcMap.set(validId, alerts);
      }
    }

    set({
      recordsById: recordsMap,
      originalRecordsById: originalMap,
      rowIds,
      rowVersions,
      qaqcAlertsByRowId: qaqcMap,
      dirtyRowIds: new Set(),
      activeCell: rowIds.length > 0 ? { rowIdx: 0, colKey: 'campana', rowId: rowIds[0] } : null,
      editingCell: null,
      editorValue: '',
      dataVersion: get().dataVersion + 1,
      rowKey
    });
  },

  getRowById: (rowId: number) => {
    return get().recordsById.get(rowId);
  },

  getAllRecords: () => {
    const { rowIds, recordsById } = get();
    return rowIds.map(id => recordsById.get(id)).filter(Boolean) as Record<string, any>[];
  },

  setActiveCell: (coord: CellCoordinate | null) => {
    set({ activeCell: coord });
  },

  startEditing: (coord: CellCoordinate) => {
    const { recordsById, rowIds } = get();
    const rowId = coord.rowId !== undefined ? coord.rowId : rowIds[coord.rowIdx];
    if (rowId === undefined) return;
    const row = recordsById.get(rowId);
    if (!row) return;

    set({
      activeCell: coord,
      editingCell: coord,
      editorValue: row[coord.colKey] ?? ''
    });
  },

  setEditorValue: (val: any) => {
    set({ editorValue: val });
  },

  commitEditing: () => {
    const { editingCell, editorValue, updateCell } = get();
    if (!editingCell) return;
    const rowId = editingCell.rowId;
    if (rowId === undefined) return;

    updateCell(rowId, editingCell.colKey, editorValue);
    set({ editingCell: null });
  },

  cancelEditing: () => {
    set({ editingCell: null });
  },

  updateCell: (rowId: number, colKey: string, value: any) => {
    const { recordsById, originalRecordsById, rowVersions, dirtyRowIds, qaqcAlertsByRowId, dataVersion } = get();
    const existing = recordsById.get(rowId);
    if (!existing) return;

    let normalizedVal = value;
    const colSchema = PLT_SCHEMA_MAP.get(colKey);
    if (colSchema && (colSchema.type === 'decimal' || colSchema.type === 'integer')) {
      if (value === '' || value === null || value === undefined) {
        normalizedVal = null;
      } else if (typeof value !== 'number') {
        const parsed = Number(String(value).trim().replace(/,/g, '.'));
        if (Number.isFinite(parsed)) {
          normalizedVal = colSchema.type === 'integer' ? Math.round(parsed) : parsed;
        }
      }
      if (colKey === 'nivel' && typeof normalizedVal === 'number' && normalizedVal > 4999) {
        normalizedVal = 4999;
      }
    }

    const updatedRow: Record<string, any> = { ...existing, [colKey]: normalizedVal };

    if (colKey === 'litologia_1' && LITHOLOGY_CLASSIFICATION.length > 0) {
      updatedRow.litologia_2 = '';
      updatedRow.litologia_3 = '';
      if (normalizedVal) {
        const matches = LITHOLOGY_CLASSIFICATION.filter(item => item.unidad === normalizedVal);
        const uniqueL2 = Array.from(new Set(matches.map(m => m.litologia)));
        if (uniqueL2.length === 1) {
          updatedRow.litologia_2 = uniqueL2[0];
          const uniqueL3 = Array.from(new Set(matches.filter(m => m.litologia === uniqueL2[0]).map(m => m.codigo)));
          if (uniqueL3.length === 1) {
            updatedRow.litologia_3 = uniqueL3[0];
          }
        }
      }
    } else if (colKey === 'litologia_2' && LITHOLOGY_CLASSIFICATION.length > 0) {
      updatedRow.litologia_3 = '';
      if (normalizedVal) {
        const matches = LITHOLOGY_CLASSIFICATION.filter(
          item => item.unidad === updatedRow.litologia_1 && item.litologia === normalizedVal
        );
        const uniqueL3 = Array.from(new Set(matches.map(m => m.codigo)));
        if (uniqueL3.length === 1) {
          updatedRow.litologia_3 = uniqueL3[0];
        }
      }
    }

    recalculateDerivedFields(updatedRow, colKey);

    recordsById.set(rowId, updatedRow);

    const orig = originalRecordsById.get(rowId);
    if (isRecordDifferent(updatedRow, orig)) {
      dirtyRowIds.add(rowId);
    } else {
      dirtyRowIds.delete(rowId);
    }

    const alerts = validateRow(updatedRow, PLT_VALID_COLS);
    if (alerts.length > 0) {
      qaqcAlertsByRowId.set(rowId, alerts);
    } else {
      qaqcAlertsByRowId.delete(rowId);
    }

    const curVer = rowVersions.get(rowId) || 1;
    rowVersions.set(rowId, curVer + 1);

    set({
      dirtyRowIds,
      qaqcAlertsByRowId,
      dataVersion: dataVersion + 1
    });
  },

  insertRowBelow: (rowIdx: number, prefill?: Partial<Record<string, any>>) => {
    const { rowIds, recordsById, originalRecordsById, rowVersions, dirtyRowIds, rowKey, dataVersion } = get();
    const newId = Date.now() + Math.floor(Math.random() * 1000);

    const parentRow = rowIdx >= 0 && rowIdx < rowIds.length ? recordsById.get(rowIds[rowIdx]) : null;

    const newRow: Record<string, any> = {
      [rowKey]: newId,
      campana: parentRow?.campana || String(new Date().getFullYear()),
      fecha_ensayo: parentRow?.fecha_ensayo || new Date().toISOString().split('T')[0],
      ejecutado_por: parentRow?.ejecutado_por || '',
      tipo_ensayo: 'i',
      nivel: parentRow?.nivel ?? null,
      celda_mapeo: parentRow?.celda_mapeo || '',
      muestra: '',
      codigo_muestra: '',
      litologia_1: parentRow?.litologia_1 || '',
      litologia_2: parentRow?.litologia_2 || '',
      litologia_3: parentRow?.litologia_3 || '',
      este: parentRow?.este ?? null,
      norte: parentRow?.norte ?? null,
      elevacion: parentRow?.elevacion ?? null,
      espesor_d: null,
      longitud_l: null,
      ancho_w1: null,
      ancho_w2: null,
      fuerza_p: null,
      direccion_rotura: '',
      tipo_fractura: '',
      factor_conversion_k: null,
      sector_geotecnico: parentRow?.sector_geotecnico || '',
      zona_mapeo: parentRow?.zona_mapeo || '',
      observaciones: '',
      ...prefill
    };

    recalculateDerivedFields(newRow);

    recordsById.set(newId, newRow);
    originalRecordsById.set(newId, {}); // Fila nueva -> original vacío
    rowVersions.set(newId, 1);

    const nextRowIds = [...rowIds];
    const insertPos = rowIdx >= 0 ? rowIdx + 1 : nextRowIds.length;
    nextRowIds.splice(insertPos, 0, newId);

    dirtyRowIds.add(newId);

    set({
      rowIds: nextRowIds,
      dirtyRowIds,
      activeCell: { rowIdx: insertPos, colKey: 'muestra', rowId: newId },
      dataVersion: dataVersion + 1
    });

    return newId;
  },

  deleteRow: (rowId: number) => {
    const { rowIds, recordsById, originalRecordsById, rowVersions, dirtyRowIds, qaqcAlertsByRowId, dataVersion } = get();
    recordsById.delete(rowId);
    originalRecordsById.delete(rowId);
    rowVersions.delete(rowId);
    qaqcAlertsByRowId.delete(rowId);

    const nextRowIds = rowIds.filter(id => id !== rowId);
    dirtyRowIds.add(rowId); // Marcar como modificado para sincronizar eliminación

    set({
      rowIds: nextRowIds,
      dirtyRowIds,
      activeCell: nextRowIds.length > 0 ? { rowIdx: Math.max(0, Math.min(nextRowIds.length - 1, 0)), colKey: 'campana', rowId: nextRowIds[0] } : null,
      dataVersion: dataVersion + 1
    });
  }
}));

