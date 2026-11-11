/** Compatibility exports for workspace duplicate-cell check and types. */
export { validateWindowDuplicateCelda, validateWindowQAQC } from './qaQcRules';
export type { QaQcAlert, QaQcSeverity, WindowQaQcExtraCtx } from './qaQcRules';
export type ValidationAlert = import('../types/validation').QaQcAlert;
