/**
 * cellRegistry.ts — Catálogo unificado de celdas del sistema.
 *
 * Es el ÚNICO punto de consulta para saber qué celdas existen y en qué estado:
 *   - 'bd'    : existe en la base de datos (listado del dashboard)
 *   - 'local' : borrador local pendiente de guardar (BORRADOR)
 *   - 'excel' : reservado para importaciones futuras (Fase 2)
 *
 * Si mañana se agrega un nuevo estado (ej. 'excel'), solo se toca este módulo:
 * getCellSource + CELL_SOURCE_LABELS. El resto del sistema consume estas funciones.
 *
 * Regla de capas: este módulo es la capa de DOMINIO; solo accede a localStorage
 * a través de storageManager (nunca directo). La única excepción es la lectura
 * del caché geolog_window_* para construir resúmenes, delegada en storageManager
 * vía getCachedCeldas + evictCelda.
 */

import {
  evictCelda,
  getCachedCellRaw,
  getCachedCeldas,
  getCellValidationMap,
  getUnsavedCeldas,
  removePendingCell as removeFromPendingList,
  setCellValidation as persistValidation,
  clearCellValidation as clearValidation,
  type CellValidationRecord,
} from './storageManager';
import type { WindowHeader } from './rmrCalculator';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type CellSource = 'bd' | 'local' | 'excel';

export interface KnownCell {
  name: string;
  source: CellSource;
}

/** Resumen de un borrador local, compatible con el render del Dashboard. */
export interface PendingCellSummary {
  name: string;
  fecha_mapeo: string;
  sector_geotecnico?: string;
  geologo: string;
  lito_1?: string;
  largo: number;
  altura: number;
  nivel?: string;
  rmr_76: number;
  rmr_89: number;
  rqd76_pct: number | null;
  rqd89_pct: number | null;
  gsi_visual: number | null;
  class_89: string;
}

/** Etiquetas de UI por estado. La UI solo las renderiza, nunca las decide. */
export const CELL_SOURCE_LABELS: Record<CellSource, string | null> = {
  bd: null,
  local: 'BORRADOR',
  excel: 'IMPORTADO',
};

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** ¿La celda tiene cambios locales pendientes de guardar? */
export function isCellPending(name: string): boolean {
  const up = name.trim().toUpperCase();
  return getUnsavedCeldas().some(n => n.trim().toUpperCase() === up);
}

/** Estado de una celda ('bd' si existe en el listado, 'local' si es borrador). */
export function getCellSource(name: string, knownFromDb: string[]): CellSource {
  const up = name.trim().toUpperCase();
  if ((knownFromDb || []).some(n => n.trim().toUpperCase() === up)) return 'bd';
  if (isCellPending(name)) return 'local';
  return 'bd';
}

/** Catálogo unificado: celdas de BD (listado actual) + borradores locales. */
export function getAllKnownCells(knownFromDb: string[]): KnownCell[] {
  const map = new Map<string, CellSource>();
  for (const n of knownFromDb || []) {
    const up = n.trim().toUpperCase();
    if (up) map.set(up, 'bd');
  }
  for (const n of getUnsavedCeldas()) {
    const up = n.trim().toUpperCase();
    if (up && !map.has(up)) map.set(up, 'local');
  }
  return [...map.entries()].map(([name, source]) => ({ name, source }));
}

/** Solo los nombres (para existingCeldas de los modales). */
export function getAllKnownCellNames(knownFromDb: string[]): string[] {
  return getAllKnownCells(knownFromDb).map(c => c.name);
}

/** Nombres de TODAS las celdas pendientes (para marcar sus filas en el Dashboard). */
export function getPendingCellNames(): string[] {
  return getUnsavedCeldas();
}

/**
 * Resúmenes de los borradores locales que NO existen en BD.
 * Las celdas pendientes que YA existen en la base (p.ej. importadas con nombre
 * duplicado) se muestran sobre su fila normal, NO como una fila BORRADOR aparte.
 */
export function getLocalOnlyPendingSummaries(knownFromDb: string[]): PendingCellSummary[] {
  const dbSet = new Set((knownFromDb || []).map(n => n.trim().toUpperCase()));
  return getPendingCellSummaries().filter(pc => !dbSet.has(pc.name.trim().toUpperCase()));
}

/** Resúmenes de los borradores locales para el Dashboard. */
export function getPendingCellSummaries(): PendingCellSummary[] {
  const summaries: PendingCellSummary[] = [];
  for (const name of getUnsavedCeldas()) {
    try {
      const raw = getCachedCellRaw(name);
      if (!raw) continue;
      const data = JSON.parse(raw) as { header?: WindowHeader };
      const h = data?.header;
      if (!h?.celda) continue;
      summaries.push({
        name: h.celda,
        fecha_mapeo: h.fecha || '',
        sector_geotecnico: h.sector || h.sect_geot || undefined,
        geologo: h.mapeador || 'N/A',
        lito_1: h.lito_1 || undefined,
        largo: typeof h.largo === 'number' ? h.largo : 0,
        altura: h.altura || 0,
        nivel: h.nivel || undefined,
        rmr_76: 0,
        rmr_89: 0,
        rqd76_pct: null,
        rqd89_pct: null,
        gsi_visual: null,
        class_89: '—',
      });
    } catch {
      continue; // caché corrupto: no bloquear el dashboard
    }
  }
  return summaries;
}

// ---------------------------------------------------------------------------
// Mutaciones
// ---------------------------------------------------------------------------

/**
 * Descarta un borrador local por completo: lo quita de la lista de pendientes,
 * elimina su caché (window, snapshot, hash y PLT) y su registro de validación.
 * No toca la BD.
 */
export function discardLocalCell(name: string): void {
  removeFromPendingList(name);
  evictCelda(name);
  clearValidation(name);
}

// ---------------------------------------------------------------------------
// Estado de validación QA/QC por celda (persistido, actualizado en cada evaluación)
// ---------------------------------------------------------------------------

export interface PendingValidation {
  celda: string;
  ok: boolean;
  count: number;
  issues: string[];
}

/** Persiste el resultado de validación de una celda. */
export function setCellValidation(celda: string, issueMessages: string[]): void {
  const clean = issueMessages.filter(Boolean);
  persistValidation(celda, {
    ok: clean.length === 0,
    count: clean.length,
    issues: clean,
  });
}

/** Registro de validación de una celda (o null si nunca se evaluó). */
export function getCellValidation(celda: string): CellValidationRecord | null {
  const map = getCellValidationMap();
  return map[celda] ?? null;
}

/** ¿La celda tiene un registro de validación persistido? */
export function hasCellValidation(celda: string): boolean {
  return getCellValidation(celda) !== null;
}

/** Celdas pendientes cuyo estado persistido es INVÁLIDO (bloquean el guardado). */
export function getInvalidPendingCells(): PendingValidation[] {
  const pending = new Set(getUnsavedCeldas().map(n => n.trim().toUpperCase()));
  const map = getCellValidationMap();
  const result: PendingValidation[] = [];
  for (const [celda, record] of Object.entries(map)) {
    if (!record.ok && pending.has(celda.trim().toUpperCase())) {
      result.push({ celda, ok: false, count: record.count, issues: record.issues });
    }
  }
  return result;
}

/** Celdas pendientes que solo existen localmente (sin snapshot en BD). */
export function getLocalOnlyPendingCells(): string[] {
  return getUnsavedCeldas().filter(celda => !localStorage.getItem(`geolog_window_snapshot_${celda}`));
}

/** Limpia el registro de validación de una celda (al guardar exitosamente). */
export function clearCellValidation(celda: string): void {
  clearValidation(celda);
}

// ---------------------------------------------------------------------------
// Validación previa al guardado
// ---------------------------------------------------------------------------

export interface NameCollisionCheck {
  ok: boolean;
  collisions: string[];
}

/**
 * Verifica que los nombres de celdas NUEVAS (sin snapshot) no hayan sido
 * creados en BD por otra persona después de crear el borrador local.
 * Ante cualquier error (red, HTTP) el resultado es BLOQUEANTE (conservador):
 * nunca se debe sobreescribir una celda ajena en silencio.
 */
export async function verifyNameCollisions(
  names: string[],
  apiBase: string,
  knownFromDb: string[] = []
): Promise<NameCollisionCheck> {
  const dbSet = new Set((knownFromDb || []).map(n => n.trim().toUpperCase()));
  const unique = [...new Set(names.map(n => n.trim().toUpperCase()).filter(Boolean))];
  const collisions: string[] = [];

  const results = await Promise.all(
    unique.map(async (name) => {
      if (dbSet.has(name)) return { name, collision: true };
      try {
        const res = await fetch(`${apiBase}/api/ventanas-check/${encodeURIComponent(name)}`);
        if (!res.ok) return { name, collision: true };
        const data = await res.json();
        return { name, collision: Boolean(data?.exists) };
      } catch {
        return { name, collision: true };
      }
    })
  );

  for (const r of results) {
    if (r.collision) collisions.push(r.name);
  }
  return { ok: collisions.length === 0, collisions };
}

/** Celdas cuyo caché existe en localStorage (para diagnósticos). */
export function getCachedCellNames(): string[] {
  return getCachedCeldas();
}
