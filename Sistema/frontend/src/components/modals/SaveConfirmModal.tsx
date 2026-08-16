import { useState, useMemo } from 'react';
import { Save, AlertTriangle, Check, FileSpreadsheet, X, Activity, AlertCircle, BookOpen } from 'lucide-react';
import type { WindowData, AllWindowsDiffSummary } from '../../utils/diffUtils';
import { validateMapeoWindow, validatePltEnsayosList } from '../../utils/mandatoryRules';
import { validateWindowQAQC } from '../../utils/qaqcValidator';
import type { PendingValidation } from '../../utils/cellRegistry';

export interface PltDiffSummary {
  added: number;
  modified: number;
  deleted: number;
  totalChanges: number;
  totalRows: number;
}

interface SaveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSave: (scope: 'active' | 'all') => void;
  activeWindow: WindowData | null;
  workspaceDiff: AllWindowsDiffSummary;
  pltDiff?: PltDiffSummary;
  pltEnsayos?: any[];
  onOpenCatalogs?: () => void;
  /** Celdas pendientes con estado de validación inválido (persistido). */
  invalidPendingCells?: PendingValidation[];
}

export default function SaveConfirmModal({
  isOpen,
  onClose,
  onConfirmSave,
  activeWindow,
  workspaceDiff,
  pltDiff,
  pltEnsayos = [],
  onOpenCatalogs,
  invalidPendingCells = []
}: SaveConfirmModalProps) {
  if (!isOpen) return null;

  const activeHasChanges = workspaceDiff.activeDiff.hasChanges;
  const hasPltChanges = pltDiff && pltDiff.totalChanges > 0;
  const hasAnyWindowChanges = workspaceDiff.totalWindowsWithChanges > 0;

  // Auditoría sincrónica de campos obligatorios
  const mapeoIssues = useMemo(() => {
    return activeWindow ? validateMapeoWindow(activeWindow) : [];
  }, [activeWindow]);

  const pltIssues = useMemo(() => {
    return Array.isArray(pltEnsayos) && pltEnsayos.length > 0 ? validatePltEnsayosList(pltEnsayos) : [];
  }, [pltEnsayos]);

  // Auditoría sincrónica QA/QC de combinaciones inválidas y errores críticos
  const qaqcAlerts = useMemo(() => {
    if (!activeWindow) return [];
    const ef = activeWindow.header.este_from || 0;
    const nf = activeWindow.header.norte_from || 0;
    const cf = activeWindow.header.cota_from || 0;
    const et = activeWindow.header.este_to || 0;
    const nt = activeWindow.header.norte_to || 0;
    const ct = activeWindow.header.cota_to || 0;
    const dx = et - ef;
    const dy = nt - nf;
    const dz = ct - cf;
    const distCalc = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const rawLargo = typeof activeWindow.header.largo === 'number' ? activeWindow.header.largo : parseFloat(String(activeWindow.header.largo || 0));
    const largo = !isNaN(rawLargo) && rawLargo > 0 ? rawLargo : distCalc;

    return validateWindowQAQC(activeWindow.header, activeWindow.joints, largo, undefined, true);
  }, [activeWindow]);

  // CRITICAS y VACIOS bloquean el guardado; ADVERTENCIAS no.
  const qaqcCriticas = qaqcAlerts.filter(a => a.type === 'CRITICA');
  const qaqcAdvertencias = qaqcAlerts.filter(a => a.type === 'ADVERTENCIA');

  // Celdas pendientes inválidas DISTINTAS de la activa (la activa ya se cubre
  // con mapeoIssues + qaqcCriticas + pltIssues).
  const otherInvalidCells = invalidPendingCells.filter(
    v => v.celda !== activeWindow?.header.celda
  );
  const otherInvalidCount = otherInvalidCells.reduce((acc, v) => acc + v.count, 0);

  const totalBlockingIssuesCount = mapeoIssues.length + pltIssues.length + qaqcCriticas.length + otherInvalidCount;
  const hasBlockingErrors = totalBlockingIssuesCount > 0;

  // Si la celda activa tiene cambios, por defecto seleccionamos 'active'; de lo contrario 'all'
  const [selectedScope, setSelectedScope] = useState<'active' | 'all'>(
    activeHasChanges ? 'active' : 'all'
  );

  const isScopeActive = selectedScope === 'active' && activeHasChanges;
  const targetDiff = isScopeActive
    ? workspaceDiff.activeDiff
    : {
        totalEdits: workspaceDiff.totalCellEditsAll + workspaceDiff.totalJointsAddedAll + workspaceDiff.totalJointsDeletedAll,
        headerEditsCount: workspaceDiff.windowsList.reduce((acc, w) => acc + w.diff.headerEditsCount, 0),
        jointsEditsCount: workspaceDiff.windowsList.reduce((acc, w) => acc + w.diff.jointsEditsCount, 0),
        jointsAddedCount: workspaceDiff.totalJointsAddedAll,
        jointsDeletedCount: workspaceDiff.totalJointsDeletedAll
      };

  return (
    <div className="fixed inset-0 view-modal z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in text-left">
      <div className="glass-panel w-full max-w-xl flex flex-col border border-amber-500/30 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/95 text-slate-100">
        
        {/* Superior Accent Line */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 w-full shrink-0" />

        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <Save size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                Confirmar Guardado de Cambios
              </h3>
              <p className="text-xs text-slate-400">Auditoría previa a la sincronización en base de datos SQL Server</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* Scope Selector Options — solo si hay cambios de ventanas */}
          {hasAnyWindowChanges && (
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                Alcance de la Sincronización (Ventanas):
              </label>

              <div className="grid grid-cols-1 gap-3">
                {/* Option 1: Solo Celda Activa (Renderizado si posee cambios) */}
                {activeHasChanges && (
                  <button
                    type="button"
                    onClick={() => setSelectedScope('active')}
                    className={`p-4 rounded-xl border text-left transition-all relative flex items-start gap-3 ${
                      selectedScope === 'active'
                        ? 'bg-amber-500/10 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                        : 'bg-navy-950/40 border-navy-800 hover:border-navy-700'
                    }`}
                  >
                    <div className={`mt-0.5 p-1 rounded-full border ${selectedScope === 'active' ? 'bg-amber-500 border-amber-400 text-navy-950' : 'border-navy-700'}`}>
                      <Check size={12} className="stroke-[3]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-100">
                          Guardar solo Celda Activa ({activeWindow?.header.celda || 'Celda Activa'})
                        </span>
                        <span className="text-xs font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {workspaceDiff.activeDiff.totalEdits} cambios
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Sincroniza únicamente la celda que está visualizando en pantalla.
                      </p>
                    </div>
                  </button>
                )}

                {/* Option 2: Guardar TODAS las Celdas Pendientes */}
                <button
                  type="button"
                  onClick={() => setSelectedScope('all')}
                  className={`p-4 rounded-xl border text-left transition-all relative flex items-start gap-3 ${
                    selectedScope === 'all'
                      ? 'bg-amber-500/10 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                      : 'bg-navy-950/40 border-navy-800 hover:border-navy-700'
                  }`}
                >
                  <div className={`mt-0.5 p-1 rounded-full border ${selectedScope === 'all' ? 'bg-amber-500 border-amber-400 text-navy-950' : 'border-navy-700'}`}>
                    <Check size={12} className="stroke-[3]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-100">
                        Guardar TODAS las Celdas Pendientes ({workspaceDiff.totalWindowsWithChanges} celdas)
                      </span>
                      <span className="text-xs font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {workspaceDiff.totalCellEditsAll + workspaceDiff.totalJointsAddedAll + workspaceDiff.totalJointsDeletedAll} cambios totales
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Sincroniza todas las celdas modificadas registradas en su sesión.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Audit Metrics Breakdown — Ventanas */}
          {hasAnyWindowChanges && (
            <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet size={14} className="text-amber-400" />
                <span>Resumen de Cambios en Ventanas:</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-navy-900/80 p-2.5 rounded-lg border border-navy-800 flex justify-between">
                  <span className="text-slate-400">Atributos de Header:</span>
                  <span className="font-bold text-amber-400">{targetDiff.headerEditsCount}</span>
                </div>
                <div className="bg-navy-900/80 p-2.5 rounded-lg border border-navy-800 flex justify-between">
                  <span className="text-slate-400">Celdas de Discontinuidad:</span>
                  <span className="font-bold text-amber-400">{targetDiff.jointsEditsCount}</span>
                </div>
                <div className="bg-navy-900/80 p-2.5 rounded-lg border border-navy-800 flex justify-between">
                  <span className="text-slate-400">Discontinuidades Nuevas:</span>
                  <span className="font-bold text-emerald-400">+{targetDiff.jointsAddedCount}</span>
                </div>
                <div className="bg-navy-900/80 p-2.5 rounded-lg border border-navy-800 flex justify-between">
                  <span className="text-slate-400">Discontinuidades Eliminadas:</span>
                  <span className="font-bold text-rose-400">-{targetDiff.jointsDeletedCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* Audit Metrics Breakdown — Ensayos PLT */}
          {hasPltChanges && pltDiff && (
            <div className="bg-navy-950/60 border border-violet-500/20 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Activity size={14} className="text-violet-400" />
                <span>Resumen de Cambios en Ensayos PLT Irregulares:</span>
              </h4>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-navy-900/80 p-2.5 rounded-lg border border-navy-800 flex justify-between">
                  <span className="text-slate-400">Nuevos:</span>
                  <span className="font-bold text-emerald-400">+{pltDiff.added}</span>
                </div>
                <div className="bg-navy-900/80 p-2.5 rounded-lg border border-navy-800 flex justify-between">
                  <span className="text-slate-400">Modificados:</span>
                  <span className="font-bold text-amber-400">{pltDiff.modified}</span>
                </div>
                <div className="bg-navy-900/80 p-2.5 rounded-lg border border-navy-800 flex justify-between">
                  <span className="text-slate-400">Eliminados:</span>
                  <span className="font-bold text-rose-400">-{pltDiff.deleted}</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 font-medium">
                Total de registros PLT en sesión: {pltDiff.totalRows} • {pltDiff.totalChanges} cambio(s) pendiente(s)
              </p>
            </div>
          )}

          {/* Empty state: solo PLT y sin ventanas */}
          {!hasAnyWindowChanges && !hasPltChanges && (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400">No se detectaron cambios pendientes de sincronización.</p>
            </div>
          )}

          {/* Card / Banner de Bloqueo Crítico por Incompatibilidad o Campos Pendientes */}
          {hasBlockingErrors && (
            <div className="bg-rose-950/80 border-2 border-rose-500 rounded-2xl p-5 space-y-4 shadow-[0_0_30px_rgba(244,63,94,0.25)] animate-fade-in text-rose-100">
              
              {/* Header de la Alerta */}
              <div className="flex items-start gap-3 border-b border-rose-500/30 pb-3">
                <div className="p-2.5 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-xl shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                  <AlertCircle size={24} className="stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-rose-100 uppercase tracking-wide">
                    ¡GUARDADO BLOQUEADO POR COMBINACIÓN INVÁLIDA O CAMPOS FALTANTES!
                  </h4>
                  <p className="text-xs text-rose-300 font-medium mt-0.5">
                    El sistema detectó {totalBlockingIssuesCount} problema(s) crítico(s) que impiden sincronizar con la base de datos SQL.
                  </p>
                </div>
              </div>

              {/* Lista Detallada de Problemas Críticos */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider block">
                  Detalle de inconsistencias detectadas:
                </span>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {/* QA/QC Críticas */}
                  {qaqcCriticas.map((err, idx) => (
                    <div key={`qaqc-${idx}`} className="text-xs bg-red-950/70 border border-red-500/50 rounded-xl p-3 flex items-center justify-between text-red-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                        <span className="font-semibold leading-tight">{err.message}</span>
                      </div>
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-red-500/30 text-red-200 uppercase shrink-0 ml-2 border border-red-500/40 tracking-wider">
                        Crítico
                      </span>
                    </div>
                  ))}

                  {/* Campos Obligatorios de Mapeo */}
                  {mapeoIssues.map((issue, idx) => (
                    <div key={`map-${idx}`} className="text-xs bg-violet-900/60 border border-violet-500/40 rounded-xl p-3 flex items-center justify-between text-violet-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0 shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                        <span className="font-semibold leading-tight">{issue.message}</span>
                      </div>
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-violet-500/30 text-violet-200 uppercase shrink-0 ml-2 border border-violet-500/40 tracking-wider">
                        {issue.section}
                      </span>
                    </div>
                  ))}

                  {/* Campos Obligatorios PLT */}
                  {pltIssues.map((issue, idx) => (
                    <div key={`plt-${idx}`} className="text-xs bg-violet-900/60 border border-violet-500/40 rounded-xl p-3 flex items-center justify-between text-violet-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0 shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                        <span className="font-semibold leading-tight">{issue.message}</span>
                      </div>
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-violet-500/30 text-violet-200 uppercase shrink-0 ml-2 border border-violet-500/40 tracking-wider">
                        Ensayos PLT
                      </span>
                    </div>
                  ))}

                  {/* Otras celdas pendientes con errores QA/QC (estado persistido) */}
                  {otherInvalidCells.map((v) => (
                    <div key={`other-${v.celda}`} className="text-xs bg-violet-900/60 border border-violet-500/40 rounded-xl p-3 text-violet-100 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-black uppercase tracking-wider">{v.celda}</span>
                        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-violet-500/30 text-violet-200 uppercase shrink-0 ml-2 border border-violet-500/40 tracking-wider">
                          {v.count} problema(s)
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {v.issues.slice(0, 5).map((msg, i) => (
                          <p key={i} className="text-[11px] leading-snug">• {msg}</p>
                        ))}
                        {v.issues.length > 5 && (
                          <p className="text-[10px] text-violet-300/70">y {v.issues.length - 5} más…</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* QA/QC Advertencias (no bloquean) */}
                  {qaqcAdvertencias.map((err, idx) => (
                    <div key={`qaqc-warn-${idx}`} className="text-xs bg-amber-950/60 border border-amber-500/40 rounded-xl p-3 flex items-center justify-between text-amber-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        <span className="font-semibold leading-tight">{err.message}</span>
                      </div>
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-amber-500/30 text-amber-200 uppercase shrink-0 ml-2 border border-amber-500/40 tracking-wider">
                        Advertencia
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* TARJETA PROMINENTE DE RECOMENDACIÓN DE CATÁLOGO */}
              <div className="bg-amber-500/15 border-2 border-amber-500/50 rounded-xl p-4 space-y-3 text-amber-200 shadow-inner">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wide">
                    <BookOpen size={18} className="text-amber-400" />
                    <span>RECOMENDACIÓN CRÍTICA DEL SISTEMA</span>
                  </div>
                  {onOpenCatalogs && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onOpenCatalogs) onOpenCatalogs();
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-navy-950 font-black text-xs transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)] active:scale-95 shrink-0"
                    >
                      <BookOpen size={14} />
                      <span>Ver Catálogos Geomecánicos</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-amber-100 font-medium leading-relaxed">
                  Por favor revise detenidamente el <strong>Catálogo Geomecánico de Referencia</strong> para verificar los rangos y combinaciones compatibles de <strong>Abertura, Relleno, Rugosidad, JRC y Dureza vs Meteorización</strong> antes de corregir el registro.
                </p>
              </div>

            </div>
          )}

          {/* Warning Banner (solo si no hay bloqueo) */}
          {!hasBlockingErrors && (
            <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
              <AlertTriangle size={18} className="shrink-0 text-amber-400" />
              <span>Al confirmar, los datos serán guardados y auditados de forma permanente en SQL Server.</span>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-navy-800/80 bg-navy-950/40 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-300 text-xs font-bold transition-all active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={hasBlockingErrors}
            onClick={() => !hasBlockingErrors && onConfirmSave(selectedScope)}
            className={`px-5 py-2 rounded-xl text-xs font-black tracking-wide transition-all shadow-md flex items-center gap-2 ${
              hasBlockingErrors
                ? 'bg-navy-900 border border-navy-800 text-slate-500 cursor-not-allowed opacity-50 shadow-none'
                : 'bg-amber-500 hover:bg-amber-400 text-navy-950 shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-95'
            }`}
          >
            <Check size={16} className="stroke-[3]" />
            <span>Sí, Guardar Cambios</span>
          </button>
        </div>

      </div>
    </div>
  );
}
