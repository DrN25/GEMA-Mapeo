/**
 * numericPrecision.ts — SSOT de precisión numérica del sistema.
 *
 * Dos capas por campo:
 *   - storage: decimales MÁXIMOS que acepta la base de datos (techo real).
 *              El valor interno NUNCA supera esto (evita pérdida silenciosa al guardar).
 *   - display: decimales que se muestran / se pueden escribir en la interfaz.
 *
 * La BD NO se modifica: esta tabla se adapta a ella.
 * Si mañana cambian los decimales de un campo, se edita UNA línea aquí.
 */

export interface FieldPrecision {
  /** Decimales máximos de la BD (techo; el interno se redondea a esto). */
  storage: number;
  /** Decimales de la interfaz (edición y visualización). */
  display: number;
  /** Límite de dígitos enteros al escribir (solo edición; el import no trunca enteros). */
  intDigits?: number;
}

export const NUMERIC_PRECISION: Record<string, FieldPrecision> = {
  // ===================== Ensayos PLT (plt.EnsayoPLT) =====================
  este:                { storage: 4, display: 4, intDigits: 6 },  // BD (10,4)
  norte:               { storage: 4, display: 4, intDigits: 7 },  // BD (11,4)
  elevacion:           { storage: 2, display: 2, intDigits: 4 },  // BD (8,2)
  espesor_d:           { storage: 2, display: 1, intDigits: 4 },  // BD (5,2)
  nivel:               { storage: 2, display: 2, intDigits: 4 },  // BD String; clamp 4999
  longitud_l:          { storage: 2, display: 2, intDigits: 5 },  // BD (6,2)
  ancho_w1:            { storage: 2, display: 2, intDigits: 5 },  // BD (6,2)
  ancho_w2:            { storage: 2, display: 2, intDigits: 5 },  // BD (6,2)
  ancho_w:             { storage: 2, display: 2, intDigits: 5 },  // BD (6,2) · calculado
  fuerza_p:            { storage: 4, display: 3, intDigits: 5 },  // BD (8,4) · UI 3 ✓
  diametro_equivalente:{ storage: 4, display: 4, intDigits: 5 },  // BD (7,4) · calculado
  f:                   { storage: 4, display: 4, intDigits: 5 },  // BD (6,4) · calculado
  is_mpa:              { storage: 4, display: 4, intDigits: 5 },  // BD (8,4) · calculado
  is_50:               { storage: 4, display: 4, intDigits: 5 },  // BD (8,4) · calculado
  ucs:                 { storage: 3, display: 2, intDigits: 5 },  // BD (9,3) · calculado
  factor_conversion_k: { storage: 2, display: 2, intDigits: 5 },  // BD (5,2)
  campana:             { storage: 0, display: 0, intDigits: 5 },  // entero (año)

  // ===================== Ventanas — cabecera (mapeo.VentanasMapeo) =====================
  este_from:           { storage: 3, display: 3, intDigits: 6 },  // BD (12,3) · UI 3 ✓
  este_to:             { storage: 3, display: 3, intDigits: 6 },  // BD (12,3) · UI 3 ✓
  norte_from:          { storage: 3, display: 3, intDigits: 7 },  // BD (12,3)
  norte_to:            { storage: 3, display: 3, intDigits: 7 },  // BD (12,3)
  cota_from:           { storage: 3, display: 2, intDigits: 4 },  // BD (8,3)
  cota_to:             { storage: 3, display: 2, intDigits: 4 },  // BD (8,3)
  largo:               { storage: 3, display: 3, intDigits: 8 },  // BD (8,3)
  altura:              { storage: 3, display: 1, intDigits: 2 },  // BD (8,3)
  dip_hw:              { storage: 2, display: 2, intDigits: 3 },  // BD (5,2)
  az_hw:               { storage: 2, display: 2, intDigits: 3 },  // BD (6,2)
  dip_talud:           { storage: 2, display: 2, intDigits: 2 },  // BD (5,2)
  dipdir_talud:        { storage: 2, display: 2, intDigits: 3 },  // BD (6,2)
  is50_mpa:            { storage: 3, display: 2, intDigits: 4 },  // BD (8,3)
  ucs_mpa:             { storage: 3, display: 2, intDigits: 4 },  // BD (8,3)
  gsi_visual:          { storage: 2, display: 0, intDigits: 3 },  // BD (5,2) · entero en UI

  // ===================== Discontinuidades (mapeo.EstructurasGeologicas) =====================
  distancia:           { storage: 3, display: 0, intDigits: 4 },  // BD (8,3) · UI entero
  dip:                 { storage: 2, display: 0, intDigits: 3 },  // BD (5,2) · UI entero
  dip_dir:             { storage: 2, display: 0, intDigits: 3 },  // BD (6,2) · UI entero
  abertura:            { storage: 3, display: 1, intDigits: 5 },  // BD (8,3)
  espesor:             { storage: 3, display: 1, intDigits: 5 },  // BD (8,3)
  continuidad:         { storage: 3, display: 2, intDigits: 2 },  // BD (8,3)
  espaciamiento:       { storage: 3, display: 2, intDigits: 2 },  // BD (8,3)
  jrc:                 { storage: 2, display: 0, intDigits: 2 },  // BD (4,2) · UI entero
  rugosidad:           { storage: 0, display: 0, intDigits: 1 },  // BD varchar · entero
};

/** Precisión de un campo (o null si no está registrado). */
export function getFieldPrecision(key: string): FieldPrecision | null {
  return NUMERIC_PRECISION[key] ?? null;
}

/** Redondea un número a `decimals` decimales (sin truncar enteros). */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Normaliza un valor numérico de entrada (importación, commit, servidor):
 * redondea a la precisión objetivo. 'display' = lo que se ve (import/edición);
 * 'storage' = techo de la BD (cálculos internos). Devuelve null si no es número.
 */
export function normalizeNumeric(
  key: string,
  value: any,
  target: 'storage' | 'display' = 'display'
): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  if (isNaN(n)) return null;
  const prec = getFieldPrecision(key);
  if (!prec) return n;
  return roundTo(n, prec[target]);
}
