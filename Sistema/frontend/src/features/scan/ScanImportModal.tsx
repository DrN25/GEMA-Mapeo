/**
 * features/scan/ScanImportModal.tsx — Importación por Escaneo (paso 1).
 *
 * Flujo:
 *  1. Seleccionar modo (celda actual / nueva celda) + 1..15 imágenes.
 *  2. "Analizar" -> POST /api/scan/preview (backend llama a OpenRouter
 *     free con fallback a pago).
 *  3. Preview editable (ScanPreviewModal) -> onImport(items) (mismo contrato
 *     que ExcelImportModal: handleImportToPending en App.tsx).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  X, ScanLine, Upload, Loader2, AlertTriangle, ImagePlus, Sparkles, Trash2
} from 'lucide-react';
import { apiFetch, getAuthHeaders } from '../../utils/apiClient';
import ScanModePicker from './ScanModePicker';
import ScanPreviewModal from './ScanPreviewModal';
import type { ScanConfigResponse, ScanImportedCellItem, ScanPreviewResponse, ScanMode } from './types';

// Rutas RELATIVAS por defecto (mismo patrón que el resto de la app): el
// proxy de Vite (dev) o el túnel/dominio (prod) resuelven /api -> backend.
// El fallback absoluto hostname:8001 rompe en despliegues por túnel/dominio
// público (Cloudflare expone solo el frontend, no el 8001).
const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || '';

interface ScanImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: ScanImportedCellItem[]) => void;
  /** Celda activa actual (modo 'actual'). null si no hay ventana abierta. */
  targetCelda?: string | null;
  /** Nombres de celdas existentes (BD + borradores locales). */
  existingCeldas?: string[];
  apiBase?: string;
}

export default function ScanImportModal({
  isOpen, onClose, onImport, targetCelda = null, existingCeldas = [], apiBase,
}: ScanImportModalProps) {
  const apiBaseUrl = apiBase || DEFAULT_API_BASE;

  const [mode, setMode] = useState<ScanMode>('nueva');
  const [files, setFiles] = useState<File[]>([]);
  const [config, setConfig] = useState<ScanConfigResponse | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ScanPreviewResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasActiveWindow = !!targetCelda;

  const loadConfig = () => {
    setConfigLoading(true);
    setConfigError(null);
    apiFetch(`${apiBaseUrl}/api/scan/config`, { retries: 3, timeoutMs: 60000 })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json().catch(() => null);
      })
      .then((d) => setConfig(d))
      .catch((e: any) => {
        setConfig(null);
        setConfigError(
          `No se pudo contactar el servicio de escaneo (${e?.message || 'error de red'}). ` +
          `Verifique que el backend esté activo en ${apiBaseUrl || 'la misma URL del sitio'}.`
        );
      })
      .finally(() => setConfigLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    loadConfig();
    setError(null);
    setPreview(null);
  }, [isOpen, apiBaseUrl]);

  if (!isOpen) return null;

  const maxImages = config?.max_images_per_batch ?? 15;
  const maxMb = config?.max_image_mb ?? 10;
  const readyToScan = files.length > 0 && !analyzing && !!config?.is_configured;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith('image/'));
    const oversized = incoming.filter((f) => f.size > maxMb * 1024 * 1024);
    if (oversized.length > 0) {
      setError(`La imagen "${oversized[0].name}" supera el límite de ${maxMb} MB.`);
      return;
    }
    const remaining = maxImages - files.length;
    if (incoming.length > remaining) {
      setError(`Máximo ${maxImages} imágenes por lote. Se agregarán solo ${Math.max(0, remaining)}.`);
    }
    setFiles((prev) => [...prev, ...incoming.slice(0, Math.max(0, remaining))]);
    setError(null);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAnalyze = async () => {
    if (!readyToScan) return;
    setAnalyzing(true);
    setError(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      const url = `${apiBaseUrl}/api/scan/preview?modo=${mode}${mode === 'actual' && targetCelda ? `&target_celda=${encodeURIComponent(targetCelda)}` : ''}`;
      // apiFetch: reintentos con backoff + timeout 60s (misma política del resto de la app)
      const res = await apiFetch(url, { method: 'POST', body: fd, retries: 2, timeoutMs: 120000 });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.status === 'success') {
        setPreview(data);
      } else {
        const detail = data?.detail;
        setError(typeof detail === 'string' ? detail : `Error HTTP ${res.status} al analizar las imágenes.`);
      }
    } catch (e: any) {
      setError(`Error de comunicación con el backend (${apiBaseUrl}). Verifique que el servicio esté activo.`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRescanImage = async (sourceImage: number): Promise<ScanPreviewResponse | null> => {
    const img = files[sourceImage];
    if (!img) return null;
    try {
      const fd = new FormData();
      fd.append('files', img);
      const url = `${apiBaseUrl}/api/scan/preview?modo=${mode}${mode === 'actual' && targetCelda ? `&target_celda=${encodeURIComponent(targetCelda)}` : ''}`;
      const res = await apiFetch(url, { method: 'POST', body: fd, retries: 2, timeoutMs: 120000 });
      const data = await res.json().catch(() => null);
      return res.ok && data?.status === 'success' ? data : null;
    } catch {
      return null;
    }
  };

  const handleConfirm = (items: ScanImportedCellItem[]) => {
    setPreview(null);
    setFiles([]);
    onImport(items);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md animate-fade-in">
        <div className="glass-panel w-full max-w-3xl p-6 rounded-2xl border border-navy-800 shadow-2xl bg-navy-900/95 relative overflow-hidden flex flex-col max-h-[92vh]">
          <div className="h-1.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 w-full absolute top-0 left-0 shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-navy-800 pb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <ScanLine size={20} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-100 tracking-wider uppercase">
                  Importación por Escaneo
                </h3>
                <p className="text-xs text-slate-400">
                  Imágenes de formularios de mapeo geomecánico → análisis automático → borradores editables.
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-all">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-5 pt-4">
            {/* Estado del servicio de escaneo */}
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border ${
              configError ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : config?.is_configured ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              <Sparkles size={13} className="shrink-0" />
              {configLoading ? (
                <span>Cargando configuración del escaneo...</span>
              ) : configError ? (
                <span className="flex items-center gap-2">
                  {configError}
                  <button type="button" onClick={loadConfig} className="underline font-bold hover:text-red-300">
                    Reintentar
                  </button>
                </span>
              ) : config?.is_configured ? (
                <span>
                  Escaneo listo — <strong className="font-mono">{config.paid_model}</strong>
                  {config.use_free_model ? (
                    <> con <strong className="font-mono">{config.free_model}</strong> (gratis) como primera opción y fallback automático al modelo de pago.</>
                  ) : (
                    <> (modelo principal, sin fallback gratuito).</>
                  )}
                </span>
              ) : (
                <span>El escaneo no está configurado. Agregue OPENROUTER_API_KEY al .env del backend y reinicie el servicio.</span>
              )}
            </div>

            {/* Selector de modo */}
            <ScanModePicker mode={mode} onChange={setMode} targetCelda={targetCelda} hasActiveWindow={hasActiveWindow} />

            {/* Dropzone */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">
                  Imágenes del Formulario ({files.length}/{maxImages})
                </label>
                {files.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Limpiar
                  </button>
                )}
              </div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-navy-700 hover:border-cyan-500/70 rounded-2xl p-8 text-center cursor-pointer transition-all bg-navy-950/40 hover:bg-navy-950/80 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => addFiles(e.target.files)}
                  className="hidden"
                />
                <ImagePlus size={36} className="mx-auto text-cyan-400/70 group-hover:text-cyan-300 transition-colors" />
                <p className="text-sm font-semibold text-slate-300 mt-2">
                  Haga clic o arrastre las fotos del formulario escaneado
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PNG / JPG — hasta {maxImages} imágenes por lote · {maxMb} MB por imagen
                </p>
              </div>

              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {files.map((f, i) => (
                    <div key={i} className="relative group">
                      <div className="w-20 h-20 rounded-lg border border-navy-700 bg-navy-950/60 overflow-hidden flex items-center justify-center">
                        <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        title="Quitar"
                      >
                        <X size={11} />
                      </button>
                      <span className="block text-[9px] text-slate-500 text-center mt-0.5 truncate w-20">{f.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2 bg-red-500/10 border-red-500/30 text-red-400">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2.5 justify-end pt-4 border-t border-navy-800 shrink-0">
            <button onClick={onClose} className="bg-navy-950 border border-navy-800 hover:bg-navy-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all">
              Cancelar
            </button>
            <button
              onClick={handleAnalyze}
              disabled={!readyToScan}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg"
            >
              {analyzing ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
              {analyzing ? 'Analizando imágenes...' : `Analizar ${files.length} imagen${files.length !== 1 ? 'es' : ''}`}
            </button>
          </div>
        </div>
      </div>

      {/* Paso 2: preview editable */}
      {preview && (
        <ScanPreviewModal
          preview={preview}
          modo={mode}
          targetCelda={targetCelda}
          existingCeldas={existingCeldas}
          onConfirm={handleConfirm}
          onClose={() => setPreview(null)}
          onRescan={handleRescanImage}
          apiBase={apiBaseUrl}
        />
      )}
    </>
  );
}
