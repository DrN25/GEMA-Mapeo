/**
 * utils/qaQcTouch.ts — Registro de campos "tocados" (blur).
 *
 * Las reglas QA/QC solo se evalúan sobre campos que hayan perdido el foco
 * al menos una vez (blur), salvo las reglas marcadas como `global` en
 * qaQcRules.ts. Este módulo es el SSOT de ese estado.
 *
 * Expone además un mecanismo de suscripción (patrón observer) para que los
 * consumidores (App.tsx) reaccionen cuando se marca un campo nuevo, sin
 * acoplarse a los componentes de formulario.
 */

const touchedFields = new Set<string>();
const listeners = new Set<() => void>();

export function markFieldTouched(fieldId: string): void {
  if (!fieldId || touchedFields.has(fieldId)) return;
  touchedFields.add(fieldId);
  notify();
}

export function isFieldTouched(fieldId: string): boolean {
  return touchedFields.has(fieldId);
}

export function resetTouchedFields(): void {
  touchedFields.clear();
  notify();
}

export function getTouchedVersion(): number {
  return touchedFields.size;
}

/** Suscribe un callback a los cambios del set de campos tocados.
 *  Devuelve la función para desuscribirse. */
export function subscribeTouched(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  listeners.forEach(cb => cb());
}
