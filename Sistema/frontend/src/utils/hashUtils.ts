/**
 * Generador de hash rápido y determinístico en 32 bits (Murmur-like)
 * para auditoría reactiva de cambios en celdas de ventanas geomecánicas.
 *
 * IMPORTANTE: fastHashObject usa serialización CANÓNICA (keys ordenadas).
 * Así el hash solo depende de los VALORES, no del orden de construcción de
 * los objetos (el orden de keys cambia entre versiones del transform y
 * producía "cambios fantasma" al reabrir celdas).
 */
export function fastHashString(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/**
 * Serialización canónica: objetos con keys ordenadas alfabéticamente,
 * arrays en orden, keys con valor undefined omitidas (igual que JSON.stringify).
 */
export function canonicalStringify(v: any): string {
  if (v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(canonicalStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const parts: string[] = [];
    for (const k of Object.keys(v).sort()) {
      const val = v[k];
      if (val === undefined) continue;
      parts.push(`${JSON.stringify(k)}:${canonicalStringify(val)}`);
    }
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(v);
}

export function fastHashObject(obj: any): string {
  if (obj === null || obj === undefined) return 'null';
  try {
    return fastHashString(canonicalStringify(obj));
  } catch (e) {
    return String(Math.random());
  }
}

/** ¿Dos objetos tienen los MISMOS VALORES (ignorando orden de keys)? */
export function canonicalEqual(a: any, b: any): boolean {
  if (a === b) return true;
  try {
    return canonicalStringify(a) === canonicalStringify(b);
  } catch {
    return false;
  }
}
