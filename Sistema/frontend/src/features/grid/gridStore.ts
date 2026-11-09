// src/features/grid/gridStore.ts
import { create } from 'zustand';
import type { CellCoordinate } from './types';
import type { QAQCAlert } from './schema/types';
import { PLT_SCHEMA, PLT_SCHEMA_MAP, validateRow } from './schema';

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
  for (const col of PLT_SCHEMA) {
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
      originalMap.set(validId, JSON.parse(JSON.stringify(rowCopy)));
      rowIds.push(validId);
      rowVersions.set(validId, 1);

      const alerts = validateRow(rowCopy, PLT_SCHEMA);
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

    const updatedRow = { ...existing, [colKey]: value };
    recalculateDerivedFields(updatedRow, colKey);

    recordsById.set(rowId, updatedRow);

    const orig = originalRecordsById.get(rowId);
    const newDirtySet = new Set(dirtyRowIds);
    if (isRecordDifferent(updatedRow, orig)) {
      newDirtySet.add(rowId);
    } else {
      newDirtySet.delete(rowId);
    }

    const alerts = validateRow(updatedRow, PLT_SCHEMA);
    const newQaqcMap = new Map(qaqcAlertsByRowId);
    if (alerts.length > 0) {
      newQaqcMap.set(rowId, alerts);
    } else {
      newQaqcMap.delete(rowId);
    }

    const curVer = rowVersions.get(rowId) || 1;
    rowVersions.set(rowId, curVer + 1);

    set({
      dirtyRowIds: newDirtySet,
      qaqcAlertsByRowId: newQaqcMap,
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
      direccion_rotura: 'Pa',
      tipo_fractura: 'M',
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

    const newDirtySet = new Set(dirtyRowIds);
    newDirtySet.add(newId);

    set({
      rowIds: nextRowIds,
      dirtyRowIds: newDirtySet,
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
    const newDirtySet = new Set(dirtyRowIds);
    newDirtySet.add(rowId); // Marcar como modificado para sincronizar eliminación

    set({
      rowIds: nextRowIds,
      dirtyRowIds: newDirtySet,
      activeCell: nextRowIds.length > 0 ? { rowIdx: Math.max(0, Math.min(nextRowIds.length - 1, 0)), colKey: 'campana', rowId: nextRowIds[0] } : null,
      dataVersion: dataVersion + 1
    });
  }
}));

