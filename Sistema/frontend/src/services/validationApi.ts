import { apiFetch } from '../utils/apiClient';
import type { WindowData } from '../utils/diffUtils';
import type { ValidationResponse } from '../types/validation';

let revision = 0;
export async function validateWindows(apiBase: string, windows: WindowData[], signal?: AbortSignal): Promise<ValidationResponse> {
  const id = ++revision;
  const res = await apiFetch(`${apiBase}/api/validation/windows/preview`, {
    method: 'POST', retries: 0, timeoutMs: 15000, signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: String(id), draft_revision: id, windows }),
  });
  if (!res.ok) throw new Error(`No se pudo validar el borrador (HTTP ${res.status}).`);
  const data: ValidationResponse = await res.json();
  if (data.request_id !== String(id) || data.draft_revision !== id || data.windows?.length !== windows.length || !data.ruleset_version) {
    throw new Error('La respuesta de validación no corresponde al borrador solicitado.');
  }
  if (data.windows.some((result, index) => result.client_id !== windows[index].header.celda
    || typeof result.can_save !== 'boolean' || !Array.isArray(result.issues)
    || result.ruleset_version !== data.ruleset_version)) {
    throw new Error('La respuesta de validación contiene resultados incompletos o de otra ventana.');
  }
  return data;
}

export function validationErrorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'issues' in detail && Array.isArray(detail.issues)) {
    return detail.issues.map((i: { message?: string }) => i.message || '').filter(Boolean).join('\n') || fallback;
  }
  return fallback;
}
