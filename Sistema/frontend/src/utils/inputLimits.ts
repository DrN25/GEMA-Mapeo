/**
 * Utilidades de límites de entrada numérica.
 * Misma lógica que el modal de creación de celdas (CreateWindowModal),
 * extraída para reutilizarla en el Dashboard y demás formularios.
 */

export const handleNumberInputLimit = (value: string, intDigits: number, decDigits: number): string => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return cleaned.slice(0, -1);
  let integerPart = parts[0];
  let decimalPart = parts[1];
  if (integerPart.length > intDigits) integerPart = integerPart.slice(0, intDigits);
  if (decimalPart !== undefined && decimalPart.length > decDigits) decimalPart = decimalPart.slice(0, decDigits);
  return decimalPart !== undefined ? `${integerPart}.${decimalPart}` : integerPart;
};

/**
 * Límite de valor numérico: recorta a intDigits enteros y decDigits decimales,
 * y rechaza el cambio si el valor supera `max`.
 * Devuelve el texto limitado si es válido, o null si debe rechazarse.
 */
export const limitNumberWithMax = (value: string, intDigits: number, decDigits: number, max: number): string | null => {
  const limited = handleNumberInputLimit(value, intDigits, decDigits);
  if (limited === '') return '';
  const n = parseFloat(limited);
  if (isNaN(n)) return null;
  if (n < 0 || n > max) return null;
  return limited;
};
