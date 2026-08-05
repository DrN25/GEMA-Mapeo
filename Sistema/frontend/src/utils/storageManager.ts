/**
 * storageManager.ts — Administración central del localStorage de celdas.
 *
 * Responsabilidades:
 *  - Evicción de celdas sincronizadas (barrido total, opción A):
 *    al cambiar de celda, todo caché que no esté protegido se elimina.
 *  - Límite duro de celdas cacheadas (MAX_CACHED_CELLS).
 *  - Escritura segura (safeSetItem): ante QuotaExceededError libera espacio
 *    y reintenta; si no hay nada que liberar, devuelve un código de error.
 *  - Estimación de espacio para importaciones (canImport).
 *
 * Regla de oro: NUNCA se borra una celda protegida
 *   (activa, pendiente en geolog_unsaved_windows o recién importada).
 */

import { STORAGE_CONFIG } from '../config/storage';

export type StorageErrorCode = 'QUOTA_FULL' | 'IMPORT_LIMITED' | 'TOO_MANY_PENDING';

export interface StorageResult {
  ok: boolean;
  code?: StorageErrorCode;
  maxCells?: number;
  usedChars?: number;
  availableChars?: number;
}

export interface EvictionContext {
  /** Código de la celda activa (nunca se evicta). */
  activeCelda?: string | null;
  /** Códigos recién importados (nunca se evictan hasta su guardado). */
  pendingImports?: string[];
}

// ---------------------------------------------------------------------------
// Claves por celda
// ---------------------------------------------------------------------------

const KEY_WINDOW = (celda: string) => `geolog_window_${celda}`;
const KEY_SNAPSHOT = (celda: string) => `geolog_window_snapshot_${celda}`;
const KEY_HASH = (celda: string) => `geolog_window_snapshot_hash_${celda}`;
const KEY_PLT = (celda: string) => `plt_ensayos_${celda}`;
const KEY_UNSAVED = 'geolog_unsaved_windows';

/** Claves globales que empiezan con el mismo prefijo que las celdas. */
const GLOBAL_KEYS = new Set([
  'geolog_window_current_view',
  'geolog_window_dashboard_page',
  'geolog_window_dashboard_pagesize',
]);

// ---------------------------------------------------------------------------
// Utilidades de lectura
// ---------------------------------------------------------------------------

/** Extrae el código de celda de una clave `geolog_window_*` (o null si no lo es). */
function celdaFromKey(key: string): string | null {
  if (!key.startsWith('geolog_window_')) return null;
  if (GLOBAL_KEYS.has(key)) return null;
  if (key.startsWith('geolog_windows_')) return null; // summaries (plural)
  if (key.startsWith('geolog_window_snapshot_')) return null;
  const celda = key.slice('geolog_window_'.length);
  return celda || null;
}

/** Códigos de todas las celdas actualmente cacheadas en localStorage. */
export function getCachedCeldas(): string[] {
  const celdas: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const celda = celdaFromKey(key);
    if (celda && !celdas.includes(celda)) celdas.push(celda);
  }
  return celdas;
}

export function getCachedCellsCount(): number {
  return getCachedCeldas().length;
}

/** Espacio usado real en localStorage (chars UTF-16). */
export function getStorageUsage(): { usedChars: number; quotaChars: number; availableChars: number } {
  let usedChars = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    usedChars += key.length + (localStorage.getItem(key)?.length ?? 0);
  }
  const quotaChars = STORAGE_CONFIG.QUOTA_CHARS;
  return { usedChars, quotaChars, availableChars: quotaChars - usedChars };
}

function getUnsavedList(): string[] {
  try {
    const raw = localStorage.getItem(KEY_UNSAVED);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Lista de celdas pendientes (geolog_unsaved_windows)
// ---------------------------------------------------------------------------

/** Códigos de todas las celdas con cambios pendientes por sincronizar. */
export function getUnsavedCeldas(): string[] {
  return getUnsavedList();
}

/** Registra una celda como pendiente (idempotente). */
export function addPendingCell(celda: string): void {
  const list = getUnsavedList();
  if (!list.includes(celda)) {
    try {
      localStorage.setItem(KEY_UNSAVED, JSON.stringify([...list, celda]));
    } catch {
      // ignorar: la lista de pendientes nunca debe romper el flujo principal
    }
  }
}

/** Quita una celda de la lista de pendientes (idempotente). */
export function removePendingCell(celda: string): void {
  const list = getUnsavedList();
  if (list.includes(celda)) {
    try {
      localStorage.setItem(KEY_UNSAVED, JSON.stringify(list.filter(c => c !== celda)));
    } catch {
      // ignorar
    }
  }
}

// ---------------------------------------------------------------------------
// Índice de validación por celda (geolog_cell_validation)
// ---------------------------------------------------------------------------

export interface CellValidationRecord {
  ok: boolean;
  count: number;
  issues: string[];
}

const KEY_VALIDATION = 'geolog_cell_validation';

/** Mapa completo de validaciones persistidas por celda. */
export function getCellValidationMap(): Record<string, CellValidationRecord> {
  try {
    const raw = localStorage.getItem(KEY_VALIDATION);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Persiste el resultado de validación de una celda (se actualiza en cada evaluación). */
export function setCellValidation(celda: string, record: CellValidationRecord): void {
  try {
    const map = getCellValidationMap();
    map[celda] = record;
    localStorage.setItem(KEY_VALIDATION, JSON.stringify(map));
  } catch {
    // ignorar: el índice nunca debe romper el flujo principal
  }
}

/** Elimina el registro de validación de una celda (al guardar o descartar). */
export function clearCellValidation(celda: string): void {
  try {
    const map = getCellValidationMap();
    if (celda in map) {
      delete map[celda];
      localStorage.setItem(KEY_VALIDATION, JSON.stringify(map));
    }
  } catch {
    // ignorar
  }
}

/** Elimina el índice completo (limpieza general). */
export function clearAllCellValidations(): void {
  try {
    localStorage.removeItem(KEY_VALIDATION);
  } catch {
    // ignorar
  }
}

/** ¿La celda está protegida de evicción? */
export function isCeldaProtegida(celda: string, ctx: EvictionContext = {}): boolean {
  if (celda === ctx.activeCelda) return true;
  if (ctx.pendingImports && ctx.pendingImports.includes(celda)) return true;
  return getUnsavedList().includes(celda);
}

// ---------------------------------------------------------------------------
// Caché de celdas (acceso único a geolog_window_*)
// ---------------------------------------------------------------------------

/** Lee el caché crudo de una celda (geolog_window_*) o null. */
export function getCachedCellRaw(celda: string): string | null {
  try {
    return localStorage.getItem(KEY_WINDOW(celda));
  } catch {
    return null;
  }
}

/** ¿Existe caché de la celda? */
export function hasCachedCell(celda: string): boolean {
  return getCachedCellRaw(celda) !== null;
}

/** Escribe el caché de una celda de forma segura (protege la activa). */
export function setCachedCellRaw(celda: string, value: string): StorageResult {
  return safeSetItem(KEY_WINDOW(celda), value, { activeCelda: celda });
}

// ---------------------------------------------------------------------------
// Evicción
// ---------------------------------------------------------------------------

/** Elimina las 4 claves asociadas a una celda del localStorage. */
export function evictCelda(celda: string): void {
  const keys = [KEY_WINDOW(celda), KEY_SNAPSHOT(celda), KEY_HASH(celda), KEY_PLT(celda)];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignorar: la evicción nunca debe romper el flujo principal
    }
  }
}

/**
 * Barrido total (Opción A): elimina el caché de TODAS las celdas no protegidas.
 * Idempotente y sin estado externo: solo lee localStorage + geolog_unsaved_windows.
 * Devuelve cuántas celdas se evictaron.
 */
export function evictSincronizadas(ctx: EvictionContext = {}): number {
  let evicted = 0;
  for (const celda of getCachedCeldas()) {
    if (isCeldaProtegida(celda, ctx)) continue;
    evictCelda(celda);
    evicted++;
  }
  return evicted;
}

/** Regla 2: si el número de celdas cacheadas supera el tope, evicta sincronizadas. */
export function enforceCellCacheLimit(ctx: EvictionContext = {}): number {
  if (getCachedCellsCount() < STORAGE_CONFIG.MAX_CACHED_CELLS) return 0;
  return evictSincronizadas(ctx);
}

// ---------------------------------------------------------------------------
// Escritura segura
// ---------------------------------------------------------------------------

/**
 * Escritura segura: si localStorage lanza (QuotaExceededError), libera espacio
 * evictando celdas sincronizadas y reintenta. Si no se puede liberar nada,
 * devuelve TOO_MANY_PENDING (todo pendiente); si aún así falla, QUOTA_FULL.
 */
export function safeSetItem(key: string, value: string, ctx: EvictionContext = {}): StorageResult {
  // Regla 2: antes de cachear una celda nueva, respetar el tope de celdas
  if (celdaFromKey(key)) {
    enforceCellCacheLimit(ctx);
  }

  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch {
    const freed = evictSincronizadas(ctx);
    if (freed === 0) {
      return { ok: false, code: 'TOO_MANY_PENDING' };
    }
    try {
      localStorage.setItem(key, value);
      return { ok: true };
    } catch {
      return { ok: false, code: 'QUOTA_FULL' };
    }
  }
}

// ---------------------------------------------------------------------------
// Estimación de espacio para importaciones (middleware)
// ---------------------------------------------------------------------------

/**
 * ¿Caben `count` celdas nuevas en localStorage?
 * Usa el espacio usado real + una estimación por celda (configurable).
 */
export function canImport(count: number, perCellChars?: number): StorageResult {
  const perCell = perCellChars ?? STORAGE_CONFIG.ESTIMATE_PER_CELL_CHARS;
  const { usedChars, quotaChars } = getStorageUsage();
  const availableChars = Math.floor(quotaChars * STORAGE_CONFIG.SAFETY_RATIO) - usedChars;

  if (availableChars <= 0) {
    return { ok: false, code: 'QUOTA_FULL', usedChars, availableChars };
  }

  const estimated = count * perCell;
  if (estimated <= availableChars) {
    return { ok: true, usedChars, availableChars };
  }

  const maxCells = Math.floor(availableChars / perCell);
  if (maxCells >= 1) {
    return { ok: false, code: 'IMPORT_LIMITED', maxCells, usedChars, availableChars };
  }
  return { ok: false, code: 'QUOTA_FULL', usedChars, availableChars };
}
