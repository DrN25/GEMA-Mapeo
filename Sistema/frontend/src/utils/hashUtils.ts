/**
 * Generador de hash rápido y determinístico en 32 bits (Murmur-like)
 * para auditoría reactiva de cambios en celdas de ventanas geomecánicas.
 */
export function fastHashString(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export function fastHashObject(obj: any): string {
  if (obj === null || obj === undefined) return 'null';
  try {
    const jsonStr = JSON.stringify(obj);
    return fastHashString(jsonStr);
  } catch (e) {
    return String(Math.random());
  }
}
