/**
 * Mapping validation rules execute in the Python validation service.
 * Only workspace/DB uniqueness check (`CELDA_DUPLICADA`) runs locally against
 * browser workspace state (`knownCells`, `dbCellNames`, `originalCelda`).
 */
import type { QaQcAlert, QaQcSeverity } from '../types/validation';
import type { WindowHeader, JointRow } from './rmrCalculator';

export type { QaQcAlert, QaQcSeverity };

export interface WindowQaQcExtraCtx {
  dbCellNames?: string[];
  originalCelda?: string | null;
  knownCells?: string[];
}

function normalizeCeldaLocal(celda: string): string {
  if (!celda) return '';
  const raw = String(celda).trim().toUpperCase();
  const matches = raw.match(/[A-Z]+|[0-9]+/g);
  if (!matches) return raw;
  const normalizedSegments = matches.map((segment) => {
    if (/^[0-9]+$/.test(segment)) {
      const parsed = parseInt(segment, 10);
      return isNaN(parsed) ? segment : String(parsed);
    }
    return segment;
  });
  let result = '';
  normalizedSegments.forEach((seg, idx) => {
    if (idx === 0) {
      result += seg;
    } else {
      const prev = normalizedSegments[idx - 1];
      const isCurrentNum = /^[0-9]+$/.test(seg);
      const isPrevNum = /^[0-9]+$/.test(prev);
      if ((isCurrentNum && isPrevNum) || (!isCurrentNum && isPrevNum)) {
        result += '-' + seg;
      } else {
        result += seg;
      }
    }
  });
  return result;
}

export function validateWindowDuplicateCelda(
  header: Pick<WindowHeader, 'celda'>,
  extraCtx?: WindowQaQcExtraCtx,
): QaQcAlert[] {
  if (!extraCtx) return [];
  const rawUpper = String(header.celda || '').trim().toUpperCase();
  const norm = normalizeCeldaLocal(rawUpper);
  if (!norm) return [];
  const normOrig = extraCtx.originalCelda
    ? normalizeCeldaLocal(extraCtx.originalCelda)
    : null;
  if (normOrig && norm === normOrig) return [];

  const dbDup = (extraCtx.dbCellNames || []).find(
    (c) => normalizeCeldaLocal(c) === norm,
  );
  if (dbDup) {
    return [
      {
        fieldId: 'header-celda',
        type: 'CRITICA',
        ruleId: 'CELDA_DUPLICADA',
        section: 'DATOS DE REGISTRO',
        message: `El código de celda '${rawUpper}' ya existe o equivale a '${String(dbDup).trim().toUpperCase()}' en la base de datos. No se permiten celdas duplicadas.`,
      },
    ];
  }

  const localDup = (extraCtx.knownCells || []).find((c) => {
    const cu = String(c || '').trim().toUpperCase();
    return cu !== '' && cu !== rawUpper && normalizeCeldaLocal(cu) === norm;
  });
  if (localDup) {
    return [
      {
        fieldId: 'header-celda',
        type: 'CRITICA',
        ruleId: 'CELDA_DUPLICADA',
        section: 'DATOS DE REGISTRO',
        message: `El código de celda '${rawUpper}' equivale a la celda existente '${String(localDup).trim().toUpperCase()}' en el workspace. No se permiten celdas duplicadas.`,
      },
    ];
  }
  return [];
}

/** Compatibility entry point restricted solely to workspace/DB duplicate-cell detection. */
export function validateWindowQAQC(
  header: WindowHeader,
  _joints?: JointRow[],
  _largoRaw?: number,
  _campanias?: Record<number, number>,
  _evaluateAll?: boolean,
  extraCtx?: WindowQaQcExtraCtx,
): QaQcAlert[] {
  return validateWindowDuplicateCelda(header, extraCtx);
}
