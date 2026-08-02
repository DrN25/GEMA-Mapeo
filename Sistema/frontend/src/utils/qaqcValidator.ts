/**
 * utils/qaqcValidator.ts — Punto de entrada de validación QA/QC del frontend.
 *
 * Todas las reglas están definidas en `qaQcRules.ts` (SSOT). Este módulo
 * re-exporta la API pública para compatibilidad con los consumidores
 * existentes (App.tsx, SaveConfirmModal, ValidationPanel).
 */

export {
  validateWindowQAQC,
  getExpectedProfileFromJRC,
  QAQC_RULE_REGISTRY,
  QAQC_RULE_ENFORCEMENT,
  setQaQcRuleEnabled,
  resetQaQcRuleDefaults,
  buildCampaniaYearMap,
  markFieldTouched,
} from './qaQcRules';
export type { QaQcAlert, QaQcSeverity } from './qaQcRules';
export { resetTouchedFields } from './qaQcTouch';

// Alias retrocompatible: el panel y el modal usan `type` como
// 'CRITICA' | 'ADVERTENCIA' | 'VACIO'.
export type ValidationAlert = import('./qaQcRules').QaQcAlert;
