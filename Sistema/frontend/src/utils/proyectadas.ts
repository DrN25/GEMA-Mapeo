/**
 * proyectadas.ts — Coordenadas PROYECTADAS (From/To).
 *
 * Son campos SOLO locales: se persisten en localStorage por celda pero NUNCA
 * se envían a la BD. Por eso:
 *   - NO participan en el diff contra el snapshot (el hash de activeWindow
 *     no las incluye) → el botón GUARDAR CAMBIOS no se activa por ellas.
 *   - SÍ se consideran "cambios a descartar": el botón Descartar Cambios
 *     las revierte (borra el borrador local y limpia la UI).
 *
 * Claves:
 *   geolog_proyectadas_${celda}  → JSON con los 6 valores (strings, para
 *                                  permitir escritura en progreso).
 *   geolog_proyectadas_celdas    → registro de celdas con datos (para
 *                                  descartar todo y limpiezas).
 */

export interface ProyectadasCoords {
  este_from: string;
  norte_from: string;
  cota_from: string;
  este_to: string;
  norte_to: string;
  cota_to: string;
}

export const EMPTY_PROYECTADAS: ProyectadasCoords = {
  este_from: '',
  norte_from: '',
  cota_from: '',
  este_to: '',
  norte_to: '',
  cota_to: ''
};

const KEY = (celda: string) => `geolog_proyectadas_${celda}`;
const REGISTRY_KEY = 'geolog_proyectadas_celdas';

export function loadProyectadas(celda: string): ProyectadasCoords {
  try {
    const raw = localStorage.getItem(KEY(celda));
    if (!raw) return { ...EMPTY_PROYECTADAS };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_PROYECTADAS, ...parsed };
  } catch {
    return { ...EMPTY_PROYECTADAS };
  }
}

export function saveProyectadas(celda: string, coords: ProyectadasCoords): void {
  try {
    localStorage.setItem(KEY(celda), JSON.stringify(coords));
    const list = getProyectadasCeldas();
    if (!list.includes(celda)) {
      list.push(celda);
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(list));
    }
  } catch {
    // localStorage no disponible: el campo queda solo en memoria
  }
}

export function clearProyectadas(celda: string): void {
  try {
    localStorage.removeItem(KEY(celda));
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(getProyectadasCeldas().filter(c => c !== celda)));
  } catch {
    // ignorar: la limpieza nunca debe romper el flujo
  }
}

export function clearAllProyectadas(): void {
  try {
    for (const celda of getProyectadasCeldas()) {
      localStorage.removeItem(KEY(celda));
    }
    localStorage.removeItem(REGISTRY_KEY);
  } catch {
    // ignorar
  }
}

export function getProyectadasCeldas(): string[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** ¿Hay algún valor escrito? (basura tipada como '.' no cuenta). */
export function isProyectadasDirty(coords: ProyectadasCoords): boolean {
  return Object.values(coords).some(v => {
    if (v === undefined || v === null) return false;
    const s = String(v).trim();
    return s !== '' && s !== '.';
  });
}

/** Migra la clave al renombrar una celda (mismo patrón que window/snapshot). */
export function renameProyectadasKey(oldCelda: string, newCelda: string): void {
  try {
    const raw = localStorage.getItem(KEY(oldCelda));
    if (raw) {
      localStorage.setItem(KEY(newCelda), raw);
      localStorage.removeItem(KEY(oldCelda));
    }
    const list = getProyectadasCeldas();
    if (list.includes(oldCelda) && !list.includes(newCelda)) {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify([...list.filter(c => c !== oldCelda), newCelda]));
    }
  } catch {
    // ignorar
  }
}
