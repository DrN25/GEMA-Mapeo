import { useEffect, useState } from 'react';
import type { WindowData } from '../utils/diffUtils';
import type { WindowValidation } from '../types/validation';
import { validateWindows } from '../services/validationApi';

export function useWindowValidation(apiBase: string, window: WindowData | null, enabled: boolean) {
  const key = enabled && window ? JSON.stringify(window) : '';
  const [state, setState] = useState<{ key: string; result?: WindowValidation; error?: string }>({ key: '' });
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(() => {
      validateWindows(apiBase, [JSON.parse(key)], controller.signal).then(data => {
        if (current) setState({ key, result: data.windows[0] });
      }).catch((err: unknown) => {
        if (current) setState({ key, error: err instanceof Error ? err.message : 'Validación no disponible.' });
      });
    }, 300);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [apiBase, key]);
  // Invalidate synchronously on render, before an effect can run. A response for
  // a previous draft is never allowed to enable the save button for the new one.
  const fresh = !!key && state.key === key;
  return { result: fresh ? state.result : undefined, error: fresh ? state.error : undefined,
    pending: !!key && (!fresh || (!state.result && !state.error)) };
}
