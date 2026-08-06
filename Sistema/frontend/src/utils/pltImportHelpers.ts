/**
 * pltImportHelpers.ts — Helpers puros del import de Ensayos PLT.
 *
 * - groupPltRowsByCelda: agrupa los registros parseados del Excel por celda
 *   (normalizada con normalizeCeldaCode) y marca si la celda EXISTE en el
 *   sistema (BD o localStorage — la lista knownCells viene del SSOT de App).
 * - retagPltRows: re-etiqueta registros a otra celda de destino (celda_mapeo
 *   + codigo_muestra regenerado con el mismo formato del modal).
 */

import { normalizeCeldaCode } from './geomecColumns';

export interface PltImportGroup {
  /** Nombre de celda normalizado (trim + mayúsculas). */
  name: string;
  /** Nombre original tal como viene del Excel (primera ocurrencia). */
  originalName: string;
  rows: any[];
  /** true si la celda existe en BD o como borrador local (knownCells). */
  exists: boolean;
}

/**
 * Agrupa registros por celda normalizada. Los registros sin celda_mapeo se
 * omiten (no se pueden importar sin destino).
 */
export function groupPltRowsByCelda(rows: any[], knownCells: string[]): PltImportGroup[] {
  const knownNorm = new Set(knownCells.map(c => normalizeCeldaCode(c)));
  const map = new Map<string, { originalName: string; rows: any[] }>();
  for (const r of rows || []) {
    const raw = String(r.celda_mapeo || '').trim();
    if (!raw) continue;
    const name = normalizeCeldaCode(raw);
    if (!name) continue;
    if (!map.has(name)) map.set(name, { originalName: raw, rows: [] });
    map.get(name)!.rows.push(r);
  }
  return [...map.entries()].map(([name, g]) => ({
    name,
    originalName: g.originalName,
    rows: g.rows,
    exists: knownNorm.has(name)
  }));
}

/**
 * Re-etiqueta un conjunto de registros a la celda de destino: actualiza
 * celda_mapeo con el CÓDIGO REAL de la celda (trim + mayúsculas, sin
 * normalizar: normalizeCeldaCode solo sirve para comparar/agrupar, el valor
 * persistido debe ser el código tal cual, p.ej. "TEST_004") y regenera
 * codigo_muestra con el mismo criterio del modal ({CELDA}-{muestra}).
 */
export function retagPltRows(rows: any[], targetCelda: string): any[] {
  const cUp = String(targetCelda || '').trim().toUpperCase();
  return (rows || []).map(r => {
    const mUp = String(r.muestra || '').trim();
    return {
      ...r,
      celda_mapeo: cUp,
      codigo_muestra: cUp && mUp ? `${cUp}-${mUp}` : ''
    };
  });
}
