/**
 * features/scan/ScanPreviewModal.tsx — Previsualización EDITABLE del escaneo.
 *
 * - Selector de celda (botones con el nombre de cada celda; si se renombra,
 *   el botón muestra el nombre editado; sin nombre -> "(sin nombre)").
 * - Formulario por grupos (coordenadas, geometría, litología...).
 * - Campos NO detectados por el LLM: contorno rojo + badge, sin bloquear.
 * - Verificación de duplicados (modo nueva) igual al importador Excel.
 * - Confirmación -> onImport(items) (mismo tipo ImportedCellItem de Excel).
 */
import React, { useMemo, useState } from 'react';
import {
  X, CheckCircle2, AlertTriangle, ScanLine, Loader2, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import ScanFieldEditor from './ScanFieldEditor';
import type { ScanFieldDef } from './ScanFieldEditor';
import ScanJointsEditor from './ScanJointsEditor';
import { handleNumberInputLimit } from '../../utils/inputLimits';
import { getAuthHeaders } from '../../utils/apiClient';
import type { ScanCeldaItem, ScanImportedCellItem, ScanPreviewResponse } from './types';

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:8001`
    : ''
);

const HEADER_FIELDS: ScanFieldDef[] = [
  // Identificación
  { key: 'codigo', label: 'Código de Celda', group: 'identificacion', type: 'text', placeholder: 'TD-01' },
  { key: 'sector', label: 'Sector', group: 'identificacion', type: 'text', placeholder: 'NW1_B' },
  { key: 'mapeador', label: 'Mapeador', group: 'identificacion', type: 'text', placeholder: 'SRK' },
  { key: 'fecha', label: 'Fecha de Mapeo', group: 'identificacion', type: 'date' },
  { key: 'fase', label: 'Fase', group: 'identificacion', type: 'number', intDigits: 3, decDigits: 0 },
  { key: 'nivel', label: 'Nivel', group: 'identificacion', type: 'text' },
  // Coordenadas
  { key: 'este_ini', label: 'Este INI', group: 'coordenadas', type: 'number', intDigits: 6, decDigits: 3 },
  { key: 'norte_ini', label: 'Norte INI', group: 'coordenadas', type: 'number', intDigits: 7, decDigits: 3 },
  { key: 'cota_ini', label: 'Cota INI', group: 'coordenadas', type: 'number', intDigits: 4, decDigits: 3 },
  { key: 'este_fin', label: 'Este FIN', group: 'coordenadas', type: 'number', intDigits: 6, decDigits: 3 },
  { key: 'norte_fin', label: 'Norte FIN', group: 'coordenadas', type: 'number', intDigits: 7, decDigits: 3 },
  { key: 'cota_fin', label: 'Cota FIN', group: 'coordenadas', type: 'number', intDigits: 4, decDigits: 3 },
  // Geometría
  { key: 'largo_m', label: 'Largo (m)', group: 'geometria', type: 'number', intDigits: 8, decDigits: 3 },
  { key: 'altura_m', label: 'Altura (m)', group: 'geometria', type: 'number', intDigits: 2, decDigits: 3 },
  { key: 'dip', label: 'Dip ventana', group: 'geometria', type: 'number', intDigits: 3, decDigits: 2 },
  { key: 'azimut_hole', label: 'Azimut ventana', group: 'geometria', type: 'number', intDigits: 3, decDigits: 2 },
  { key: 'dip_talud', label: 'Dip talud', group: 'geometria', type: 'number', intDigits: 2, decDigits: 2 },
  { key: 'dipdir_talud', label: 'DipDir talud', group: 'geometria', type: 'number', intDigits: 3, decDigits: 2 },
  // Litología
  { key: 'lito_1', label: 'Lito 1', group: 'litologia', type: 'text' },
  { key: 'lito_2', label: 'Lito 2', group: 'litologia', type: 'text' },
  { key: 'lito_3', label: 'Lito 3', group: 'litologia', type: 'text' },
  { key: 'unidad_litologica', label: 'Unidad Litológica', group: 'litologia', type: 'text' },
  // Clasificación
  { key: 'intemperismo', label: 'Intemperismo', group: 'clasificacion', type: 'text' },
  { key: 'alteracion', label: 'Alteración', group: 'clasificacion', type: 'text' },
  { key: 'gsi_superficie', label: 'GSI Superficie', group: 'clasificacion', type: 'text' },
  { key: 'gsi_estructura', label: 'GSI Estructura', group: 'clasificacion', type: 'text' },
  { key: 'comentarios', label: 'Comentarios', group: 'clasificacion', type: 'text' },
  // RMR (opcional)
  { key: 'condicion_agua_rmr76', label: 'Condición de Agua', group: 'rmr', type: 'text' },
  { key: 'dureza_rmr76', label: 'Dureza ISRM', group: 'rmr', type: 'text' },
  { key: 'control_estructural_rmr76', label: 'Control Estructural', group: 'rmr', type: 'number', intDigits: 1, decDigits: 0 },
  { key: 'efectos_voladura_rmr76', label: 'Efectos Voladura', group: 'rmr', type: 'number', intDigits: 1, decDigits: 0 },
  { key: 'ucs_mpa', label: 'UCS (MPa)', group: 'rmr', type: 'number', intDigits: 4, decDigits: 2 },
  { key: 'is50_mpa', label: 'Is50 (MPa)', group: 'rmr', type: 'number', intDigits: 4, decDigits: 2 },
];

const GROUPS_ORDER = ['identificacion', 'coordenadas', 'geometria', 'litologia', 'clasificacion', 'rmr'];
const GROUP_LABELS: Record<string, string> = {
  identificacion: 'Identificación',
  coordenadas: 'Coordenadas (INI / FIN)',
  geometria: 'Geometría de la Ventana',
  litologia: 'Litología',
  clasificacion: 'Clasificación Geomecánica',
  rmr: 'Parámetros RMR (opcional)',
};

// Códigos sugeridos para comboboxes simples (mismos catálogos del sistema).
const SECTOR_SUGGESTIONS = ['PENDIENTE', 'NW1_B', 'NW1_A', 'NE1_B', 'SE1_A', 'SW1_B'];
const ALTERACION_SUGGESTIONS = ['f', 'd', 'm', 'a', 'c', 's'];
const AGUA_SUGGESTIONS = ['C', 'H', 'M', 'E', 'F'];
const DUREZA_SUGGESTIONS = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6'];

const fieldDef = (key: string) => HEADER_FIELDS.find((f) => f.key === key);
const optionsFor = (key: string) => {
  if (key === 'sector') return SECTOR_SUGGESTIONS;
  if (key === 'intemperismo' || key === 'alteracion') return ALTERACION_SUGGESTIONS;
  if (key === 'condicion_agua_rmr76') return AGUA_SUGGESTIONS;
  if (key === 'dureza_rmr76') return DUREZA_SUGGESTIONS;
  return undefined;
};

interface ScanPreviewModalProps {
  preview: ScanPreviewResponse;
  modo: 'actual' | 'nueva';
  targetCelda: string | null;
  existingCeldas: string[];
  onConfirm: (items: ScanImportedCellItem[]) => void;
  onClose: () => void;
  /** Re-analiza una imagen (por si faltaron campos). */
  onRescan?: (sourceImage: number) => Promise<ScanPreviewResponse | null>;
  apiBase?: string;
}

export default function ScanPreviewModal({
  preview, modo, targetCelda, existingCeldas, onConfirm, onClose, onRescan, apiBase,
}: ScanPreviewModalProps) {
  const apiBaseUrl = apiBase || DEFAULT_API_BASE;

  // Celdas editables (copias locales de excel_data + estructuras)
  const [cells, setCells] = useState<ScanCeldaItem[]>(() =>
    preview.celdas.map((c) => ({
      ...c,
      excel_data: { ...c.excel_data },
      estructuras: c.estructuras.map((j) => ({ ...j })),
      missing_header: [...c.missing_header],
      missing_joints: c.missing_joints.map((m) => [...m]),
    }))
  );

  // Índice de la celda visible en el preview
  const [activeIdx, setActiveIdx] = useState(0);
  const [rescanning, setRescanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const active = cells[activeIdx] ?? null;

  // Todos los códigos existentes (BD del preview + borradores locales)
  const existingDbCodes = useMemo(() => {
    const set = new Set<string>((preview.existing_codes || []).map((c) => c.trim().toUpperCase()));
    (existingCeldas || []).forEach((c) => set.add(c.trim().toUpperCase()));
    return set;
  }, [preview.existing_codes, existingCeldas]);

  const isDuplicateFinal = (c: ScanCeldaItem): boolean => {
    const name = (c.codigo || '').trim().toUpperCase();
    return name.length > 0 && existingDbCodes.has(name);
  };

  const updateHeader = (idx: number, key: string, value: any) => {
    setCells((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], excel_data: { ...next[idx].excel_data, [key]: value } };
      return next;
    });
  };

  const updateJoints = (idx: number, joints: any[]) => {
    setCells((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], estructuras: joints };
      return next;
    });
  };

  const renameCell = (idx: number, newName: string) => {
    setCells((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], codigo: newName.trim().toUpperCase() };
      return next;
    });
  };

  const handleRescan = async (sourceImage?: number) => {
    const imgIdx = sourceImage ?? active?.source_image ?? 0;
    if (!onRescan) return;
    setRescanning(true);
    try {
      const result = await onRescan(imgIdx);
      if (result) {
        const idxToKeep = active ? cells.findIndex((c) => c.codigo === active.codigo && c.source_image === active.source_image) : -1;
        setCells((prev) => {
          const others = idxToKeep >= 0 ? prev.filter((c, i) => i !== idxToKeep) : [];
          const fresh = result.celdas.map((c) => ({
            ...c,
            excel_data: { ...c.excel_data },
            estructuras: c.estructuras.map((j) => ({ ...j })),
          }));
          return [...others, ...fresh];
        });
        setActiveIdx(0);
      }
    } finally {
      setRescanning(false);
    }
  };

  const handleConfirm = () => {
    if (modo === 'nueva') {
      const missingNames = cells.filter((c) => !(c.codigo || '').trim());
      if (missingNames.length > 0) {
        alert(`Las siguientes celdas no tienen nombre. Asígneles un código antes de importar:\n${missingNames.map((c, i) => ` • Celda ${i + 1} (imagen ${c.source_image + 1})`).join('\n')}`);
        return;
      }
    }
    setConfirming(true);
    const items: ScanImportedCellItem[] = cells.map((c) => {
      const codigo_final = (c.codigo || '').trim().toUpperCase() || targetCelda?.trim().toUpperCase() || '';
      return {
        codigo_original: codigo_final,
        codigo_final,
        excel_data: c.excel_data,
        estructuras: c.estructuras,
        exists_in_db: existingDbCodes.has(codigo_final),
      };
    });
    onConfirm(items);
  };

  const missingCount = useMemo(() => {
    if (!active) return 0;
    return active.missing_header.filter((m) => (active.excel_data[m] === null || active.excel_data[m] === undefined || active.excel_data[m] === '')).length;
  }, [active]);

  if (!active) {
    // Distinguir: imagen NO relacionada (foto equivocada) vs error real.
    const notMapping = preview.errores_por_imagen?.filter((e) => e.tipo === 'no_mapping_form') || [];
    const hardErrors = preview.errores_por_imagen?.filter((e) => e.tipo !== 'no_mapping_form') || [];
    const showNotMapping = preview.total_celdas === 0 && notMapping.length > 0;

    return (
      <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md animate-fade-in">
        <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-navy-800 bg-navy-900/95 text-center">
          {showNotMapping ? (
            <>
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
                <AlertTriangle size={24} className="text-amber-400" />
              </div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">No se pudieron extraer datos</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                El análisis no encontró un formulario de mapeo geomecánico legible en{' '}
                {notMapping.length === 1 ? 'la imagen enviada' : `${notMapping.length} de las imágenes enviadas`}.
              </p>
              <div className="mt-3 space-y-1 text-left">
                {notMapping.map((e) => (
                  <p key={e.source_image} className="text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                    <strong>Imagen {e.source_image + 1}:</strong> {e.mensaje || 'No se detectó un formulario de mapeo legible.'}
                  </p>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Puede que haya seleccionado la foto incorrecta, que la imagen esté borrosa, recortada o girada, o
                que el formulario no tenga las secciones esperadas. Verifique la imagen y vuelva a intentarlo.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">No se pudieron extraer datos</h3>
              <p className="text-xs text-slate-400 mt-2">
                El escaneo no pudo extraer datos de las imágenes enviadas.
                {hardErrors.length > 0 && (
                  <span className="block mt-2 text-rose-400">
                    {hardErrors.map((e) => `Imagen ${e.source_image + 1}: ${e.error || e.mensaje || 'error'}`).join('\n')}
                  </span>
                )}
              </p>
            </>
          )}
          <div className="flex gap-2 justify-center mt-5">
            <button onClick={onClose} className="bg-navy-950 border border-navy-800 hover:bg-navy-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold">
              Volver a las imágenes
            </button>
            {onRescan && preview.celdas.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  void handleRescan(preview.errores_por_imagen?.[0]?.source_image ?? 0);
                }}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <RefreshCw size={13} /> Reintentar análisis
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-6xl p-5 rounded-2xl border border-navy-800 shadow-2xl bg-navy-900/95 relative overflow-hidden flex flex-col max-h-[94vh]">
        <div className="h-1.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 w-full absolute top-0 left-0 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy-800 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <ScanLine size={20} />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-100 tracking-wider uppercase">
                Previsualización del Escaneo ({cells.length} celda{cells.length !== 1 ? 's' : ''} detectada{cells.length !== 1 ? 's' : ''})
              </h3>
              <p className="text-xs text-slate-400">
                {preview.modelo_utilizado
                  ? <>Modelo: <strong className="text-cyan-400 font-mono">{preview.modelo_utilizado}</strong> · </> : null}
                Revise y corrija los datos. Los campos en rojo no fueron detectados y no bloquean la importación.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Selector de celdas */}
        {cells.length > 1 && (
          <div className="flex flex-wrap gap-2 pt-3 shrink-0">
            {cells.map((c, idx) => {
              const name = (c.codigo || '').trim().toUpperCase();
              const dup = isDuplicateFinal(c);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    idx === activeIdx
                      ? 'bg-cyan-600/30 border border-cyan-500 text-cyan-200'
                      : 'bg-navy-950 border border-navy-800 text-slate-400 hover:bg-navy-800/60'
                  }`}
                >
                  {name || <span className="italic text-amber-400">(sin nombre)</span>}
                  {dup && <AlertTriangle size={11} className="text-amber-400" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 pt-3">
          {/* Encabezado de la celda activa */}
          <div className="flex flex-wrap items-center gap-2 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Celda:</span>
              <input
                type="text"
                value={active.codigo ?? ''}
                onChange={(e) => renameCell(activeIdx, e.target.value)}
                placeholder={modo === 'actual' ? (targetCelda || '—') : 'Código (obligatorio)'}
                disabled={modo === 'actual'}
                className={`w-44 bg-navy-900 border rounded-lg px-3 py-1.5 text-sm text-slate-100 font-black uppercase focus:outline-none focus:ring-1 transition-all ${
                  modo === 'actual'
                    ? 'border-cyan-500/60 text-cyan-300'
                    : !(active.codigo || '').trim()
                      ? 'border-rose-500/70 focus:ring-rose-500/60'
                      : isDuplicateFinal(active)
                        ? 'border-amber-500/70 focus:ring-amber-500/60'
                        : 'border-navy-700/80 focus:ring-indigo-500/60'
                }`}
              />
              {modo === 'actual' && (
                <span className="text-[11px] text-cyan-400 font-bold">→ importa en la celda actual</span>
              )}
              {modo === 'nueva' && (active.codigo || '').trim() && isDuplicateFinal(active) && (
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <AlertTriangle size={11} /> Posible duplicado — se reemplazará al guardar
                </span>
              )}
              {modo === 'nueva' && !(active.codigo || '').trim() && (
                <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-lg">
                  Nombre obligatorio en modo nueva celda
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500">Imagen {active.source_image + 1} · confianza {(active.confidence * 100).toFixed(0)}% · {missingCount} campo(s) faltantes</span>
              {onRescan && (
                <button
                  type="button"
                  onClick={() => { void handleRescan(); }}
                  disabled={rescanning}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-teal-300 bg-teal-500/10 border border-teal-500/30 hover:bg-teal-500/20 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                >
                  {rescanning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Reanalizar
                </button>
              )}
            </div>
          </div>

          {/* Formulario por grupos */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {GROUPS_ORDER.map((group) => {
              const fields = HEADER_FIELDS.filter((f) => f.group === group);
              const collapsed = expanded[group] === true;
              return (
                <div key={group} className="p-3 rounded-xl border border-navy-800 bg-navy-950/50 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [group]: !collapsed }))}
                    className="w-full flex items-center justify-between text-[11px] font-black text-slate-300 uppercase tracking-wider"
                  >
                    {GROUP_LABELS[group]}
                    {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                  </button>
                  {!collapsed && fields.map((f) => (
                    <ScanFieldEditor
                      key={f.key}
                      field={f}
                      value={active.excel_data[f.key]}
                      missing={active.missing_header.includes(f.key)}
                      options={optionsFor(f.key)}
                      onChange={(k, v) => updateHeader(activeIdx, k, v)}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Tabla de estructuras */}
          <div className="mt-4">
            <ScanJointsEditor
              joints={active.estructuras}
              missing={active.missing_joints}
              onChange={(joints) => updateJoints(activeIdx, joints)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 justify-end pt-3 border-t border-navy-800 shrink-0">
          <button onClick={onClose} className="bg-navy-950 border border-navy-800 hover:bg-navy-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all">
            Volver
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className="bg-emerald-500 hover:bg-emerald-600 text-navy-950 font-black px-5 py-2 rounded-xl text-xs flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg"
          >
            {confirming ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {confirming ? 'Preparando...' : `Importar ${cells.length} celda${cells.length !== 1 ? 's' : ''} como borradores`}
          </button>
        </div>
      </div>
    </div>
  );
}
