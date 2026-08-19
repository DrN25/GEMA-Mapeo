/**
 * services/excelExportService.ts — Servicio cliente para exportar celdas/ventanas
 * rellenando la plantilla maestra de Excel (.xlsx) con fórmulas vivas.
 *
 * Funciona tanto para celdas guardadas en BD como para borradores en memoria
 * (Escáner IA en ScanPreviewModal, Importador Excel, o vista activa de Ventana).
 */

import { getAuthHeaders } from '../utils/apiClient';
import type { WindowData } from '../utils/diffUtils';
import { calculateWindowGeomec, suggestGsiVisual } from '../utils/rmrCalculator';
import { windowFromServerResponse } from '../utils/windowTransform';

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:8001`
    : ''
);

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function getLocalWindowData(celda: string): WindowData | null {
  try {
    const raw = localStorage.getItem(`geolog_window_${celda}`);
    if (!raw) return null;
    return JSON.parse(raw) as WindowData;
  } catch {
    return null;
  }
}

/**
 * Descarga el Excel de una ventana guardada en la base de datos por su código.
 */
export async function exportVentanaFromDb(
  codigo: string,
  filename?: string,
  apiBase?: string
): Promise<void> {
  const base = apiBase || DEFAULT_API_BASE;
  const codeUp = codigo.trim().toUpperCase();
  const url = `${base}/api/ventanas/${encodeURIComponent(codeUp)}/exportar`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!resp.ok) {
    const errJson = await resp.json().catch(() => null);
    throw new Error(errJson?.detail || `Error al exportar la ventana ${codeUp} (${resp.status})`);
  }

  const blob = await resp.blob();
  const outName = filename || `mapeo_ventana_${codeUp}.xlsx`;
  triggerBlobDownload(blob, outName);
}

/**
 * Descarga el Excel de una o más celdas en memoria (sin requerir que estén guardadas en BD).
 * Acepta formato WindowData, ScanCeldaItem, ImportedCellItem, o dict con excel_data + estructuras.
 */
export async function exportVentanaFromMemory(
  data: {
    codigo?: string;
    codigo_final?: string;
    excel_data?: any;
    estructuras?: any[];
    header?: any;
    joints?: any[];
    items?: any[];
  },
  filename?: string,
  apiBase?: string
): Promise<void> {
  const base = apiBase || DEFAULT_API_BASE;
  const url = `${base}/api/ventanas/exportar-template`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });

  if (!resp.ok) {
    const errJson = await resp.json().catch(() => null);
    throw new Error(errJson?.detail || `Error al exportar la plantilla de Excel (${resp.status})`);
  }

  const blob = await resp.blob();
  const defaultCode = data.codigo || data.codigo_final || data.header?.celda || data.excel_data?.codigo || 'VENTANA';
  const outName = filename || `mapeo_ventana_${defaultCode}.xlsx`;
  triggerBlobDownload(blob, outName);
}

/**
 * Exporta un lote de múltiples celdas en un único archivo Excel con 2 filas de separación.
 */
export async function exportMultipleVentanas(
  items: any[],
  filename?: string,
  apiBase?: string
): Promise<void> {
  return exportVentanaFromMemory({ items }, filename || 'mapeo_ventanas_export.xlsx', apiBase);
}

/**
 * Recopila los datos completos de una celda para exportar, siguiendo la jerarquía:
 * 1. Celda Activa en memoria (React state con GSI Visual en vivo)
 * 2. Borrador / Cambios locales en LocalStorage (geolog_window_X)
 * 3. Base de Datos (GET /api/ventanas/X transformado a WindowData)
 */
export async function gatherVentanaData(
  celdaName: string,
  activeWindow: WindowData | null,
  apiBase?: string
): Promise<any> {
  const up = celdaName.trim().toUpperCase();

  // 1. ¿Es la celda activa actualmente en pantalla?
  if (activeWindow && activeWindow.header?.celda?.trim().toUpperCase() === up) {
    const calc = calculateWindowGeomec(activeWindow.header, activeWindow.joints || []);
    const liveGsi = suggestGsiVisual(calc.rqd_est, calc.condicion_rating_89);
    return {
      codigo: up,
      header: {
        ...activeWindow.header,
        gsi_visual: liveGsi ?? activeWindow.header.gsi_visual
      },
      joints: activeWindow.joints || []
    };
  }

  // 2. ¿Tiene borrador o cambios locales en LocalStorage?
  const cachedData = getLocalWindowData(up);
  if (cachedData && cachedData.header) {
    const calc = calculateWindowGeomec(cachedData.header, cachedData.joints || []);
    const liveGsi = suggestGsiVisual(calc.rqd_est, calc.condicion_rating_89);
    return {
      codigo: up,
      header: {
        ...cachedData.header,
        gsi_visual: liveGsi ?? cachedData.header.gsi_visual
      },
      joints: cachedData.joints || []
    };
  }

  // 3. Obtener de Base de Datos
  const base = apiBase || DEFAULT_API_BASE;
  const url = `${base}/api/ventanas/${encodeURIComponent(up)}`;
  const resp = await fetch(url, { headers: getAuthHeaders() });
  if (!resp.ok) {
    throw new Error(`No se pudo obtener la celda ${up} desde el servidor (${resp.status})`);
  }
  const dbJson = await resp.json();
  const winData = windowFromServerResponse(dbJson);
  const calc = calculateWindowGeomec(winData.header, winData.joints || []);
  const liveGsi = suggestGsiVisual(calc.rqd_est, calc.condicion_rating_89);
  return {
    codigo: up,
    header: {
      ...winData.header,
      gsi_visual: liveGsi ?? winData.header.gsi_visual
    },
    joints: winData.joints || []
  };
}
