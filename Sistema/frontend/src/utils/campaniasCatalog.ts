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

export const CAMPANAS_HARDCODED: CampaniaItem[] = [
  { id: 1, label: 'Campaña 2020' },
  { id: 2, label: 'Campaña 2021' },
  { id: 3, label: 'Campaña 2022' },
  { id: 4, label: 'Campaña 2023' },
  { id: 5, label: 'Campaña 2024' },
  { id: 6, label: 'Campaña 2025' },
  { id: 7, label: 'Campaña 2026' },
  { id: 8, label: 'Campaña 2019' },
];

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
