/**
 * Configuración central del almacenamiento local (localStorage).
 * SSOT: si necesitas ajustar límites, este es el ÚNICO lugar.
 */

export const STORAGE_CONFIG = {
  /** Límite conservador del navegador, medido en caracteres UTF-16
   *  (la misma unidad con la que Chrome/Edge/Firefox/Safari cuentan la cuota ~5 MB). */
  QUOTA_CHARS: 5_000_000,

  /** Fracción de la cuota que se considera utilizable. Nunca se usa el 100%:
   *  se reserva margen para la celda activa, claves globales y el resto de la app. */
  SAFETY_RATIO: 0.8,

  /** Tope de celdas cacheadas (geolog_window_*). 100 celdas ≈ 0.5 MB reales,
   *  muy por debajo del límite del navegador. */
  MAX_CACHED_CELLS: 100,

  /** Estimación conservadora por celda cacheada (en chars UTF-16):
   *  window (~2400) + snapshot (~2400) + hash (~30) + margen. */
  ESTIMATE_PER_CELL_CHARS: 5030,
} as const;
