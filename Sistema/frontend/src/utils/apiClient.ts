// apiClient.ts — Cliente HTTP global con timeout, reintentos con backoff,
// inyección automática de cabeceras Bearer JWT y monitor de conexión

type ConnectionState = 'online' | 'offline';

let connectionState: ConnectionState = 'online';
const listeners = new Set<(s: ConnectionState) => void>();

export function getConnectionState(): ConnectionState {
    return connectionState;
}

export function setConnectionState(s: ConnectionState) {
    if (connectionState !== s) {
        connectionState = s;
        listeners.forEach(cb => cb(s));
    }
}

export function onConnectionChange(cb: (s: ConnectionState) => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
}

export interface ApiFetchOptions {
    timeoutMs?: number;
    retries?: number;
    baseDelayMs?: number;
    method?: string;
    body?: BodyInit | null;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 60_000;   // cubre el cold start de Render (~30-60s)
const DEFAULT_RETRIES = 3;
const BACKOFF_BASE_MS = 1_500;
const MAX_BACKOFF_MS = 15_000;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function jitter(ms: number) {
    return ms * (0.7 + Math.random() * 0.6);
}

function isRetryableStatus(status: number) {
    // 5xx (incluye 502/504 durante el boot de Render) y 429 (rate limit)
    return status >= 500 || status === 429;
}

/**
 * Retorna un objeto con las cabeceras inyectando automáticamente el token Bearer si existe en localStorage
 */
export function getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...customHeaders };
    try {
        const token = localStorage.getItem('gema_auth_token');
        if (token && !headers['Authorization'] && !headers['authorization']) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    } catch (e) { }
    return headers;
}

export async function apiFetch(url: string, opts: ApiFetchOptions = {}): Promise<Response> {
    const {
        timeoutMs = DEFAULT_TIMEOUT_MS,
        retries = DEFAULT_RETRIES,
        baseDelayMs = BACKOFF_BASE_MS,
        method = 'GET',
        body = null,
        headers = {},
        signal,
    } = opts;

    const mergedHeaders = getAuthHeaders(headers);

    let attempt = 0;
    let lastError: unknown = null;

    while (attempt <= retries) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const onOuterAbort = () => controller.abort();
        if (signal) {
            if (signal.aborted) controller.abort();
            else signal.addEventListener('abort', onOuterAbort);
        }

        try {
            const res = await fetch(url, {
                method,
                body,
                headers: mergedHeaders,
                signal: controller.signal,
                cache: 'no-store',
            });
            if (isRetryableStatus(res.status)) {
                lastError = new Error(`HTTP ${res.status}`);
                throw lastError;
            }
            setConnectionState('online');
            return res;
        } catch (err) {
            lastError = err;
            const isAbort = (err as any)?.name === 'AbortError';
            // Si el USUARIO abortó (signal externo), no reintentar
            if (isAbort && signal?.aborted) {
                throw err;
            }
            // Timeout propio o fallo de red: reintentar con backoff si quedan intentos
            if (attempt < retries) {
                attempt += 1;
                const delay = jitter(Math.min(MAX_BACKOFF_MS, baseDelayMs * Math.pow(2, attempt - 1)));
                await sleep(delay);
                continue;
            }
            break;
        } finally {
            clearTimeout(timer);
            if (signal) signal.removeEventListener('abort', onOuterAbort);
        }
    }

    setConnectionState('offline');
    throw lastError ?? new Error('Fetch failed');
}

// Ping liviano: verifica la salud del backend (proceso + base de datos) y
// actualiza el estado de conexión. Va a /api/health para que también pase por
// el proxy local de Vite y el de Netlify (un ping a "/" devolvería el index.html).
export async function pingBackend(baseUrl: string): Promise<boolean> {
    try {
        const res = await apiFetch(`${baseUrl}/api/health`, {
            timeoutMs: 60_000,
            retries: 2,
            baseDelayMs: 2_000,
        });
        const ok = res.ok;
        setConnectionState(ok ? 'online' : 'offline');
        return ok;
    } catch {
        setConnectionState('offline');
        return false;
    }
}

// Ping de detección rápida: si el backend no responde en 10 s se sospecha caída.
// Sirve para el cronómetro de actividad; la confirmación real la hace pingBackend.
export async function pingBackendFast(baseUrl: string): Promise<boolean> {
    try {
        const res = await apiFetch(`${baseUrl}/api/health`, {
            timeoutMs: 10_000,
            retries: 0,
            baseDelayMs: 0,
        });
        const ok = res.ok;
        setConnectionState(ok ? 'online' : 'offline');
        return ok;
    } catch {
        setConnectionState('offline');
        return false;
    }
}
