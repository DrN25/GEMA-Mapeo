// src/features/grid/columnsDefinition.ts
import type { GridColumnDef, ColumnType } from './types';
import { PLT_SCHEMA, type ColumnSchema } from './schema';

export function schemaToGridColumnDef(col: ColumnSchema): GridColumnDef {
  let colType: ColumnType = 'string';
  if (col.type === 'decimal' || col.type === 'integer') {
    colType = 'number';
  } else if (col.type === 'readonly') {
    colType = 'readonly';
  } else if (col.type === 'select') {
    colType = 'select';
  } else if (col.type === 'date') {
    colType = 'date';
  }

  return {
    id: col.id,
    header: col.header,
    group: col.group,
    groupBg: col.groupBg,
    accessorKey: col.id,
    defaultWidth: col.defaultWidth,
    minWidth: col.minWidth,
    maxWidth: col.maxWidth,
    pinned: col.pinned,
    type: colType,
    editor: col.editor,
    options: col.options,
    getDynamicOptions: col.getDynamicOptions,
    validations: {
      min: col.constraints?.minSoft ?? col.constraints?.minHard,
      max: col.constraints?.maxSoft ?? col.constraints?.maxHard,
      required: col.emptyPolicy === 'block'
    },
    hint: col.hint,
    unit: col.unit,
    decimals: col.decimals,
    displayHint: col.displayHint,
    format: col.format,
    cellClassName: col.cellClassName,
    customStyleClass: col.customStyleClass
  };
}

export function getPltGridColumns(): GridColumnDef[] {
  return PLT_SCHEMA.filter(c => !c.hidden).map(schemaToGridColumnDef);
}

