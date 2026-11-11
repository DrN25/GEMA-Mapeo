/**
 * utils/campaniasCatalog.ts — SSOT del catálogo de campañas.
 *
 * VentanaForm lo usa para el select y qaQcRules para validar la coherencia
 * campaña ↔ fecha. Si en el futuro se carga dinámicamente desde el backend,
 * basta con reemplazar la fuente de este módulo.
 */

export interface CampaniaItem {
  id: number;
  label: string;
}

// Compatibility name retained for existing selectors. Values come from Python.
export const CAMPANAS_HARDCODED: CampaniaItem[] = [];
export function initCampaignCatalog(items: CampaniaItem[]) {
  CAMPANAS_HARDCODED.splice(0, CAMPANAS_HARDCODED.length, ...items);
}

/** Devuelve el año de una campaña dado su ID, o null si no se conoce. */
export function getCampaniaYear(campaniaId: number | string): number | null {
  const id = typeof campaniaId === 'number' ? campaniaId : parseInt(String(campaniaId), 10);
  const item = CAMPANAS_HARDCODED.find(c => c.id === id);
  if (!item) return null;
  const match = item.label.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

/** Devuelve el ID de campaña dado su año (ej. 2026 → 7), o null si no se conoce. */
export function getCampaniaIdFromYear(year: number | string): number | null {
  const y = String(year).trim();
  if (!/^\d{4}$/.test(y)) return null;
  const item = CAMPANAS_HARDCODED.find(c => c.label.includes(y));
  return item ? item.id : null;
}
