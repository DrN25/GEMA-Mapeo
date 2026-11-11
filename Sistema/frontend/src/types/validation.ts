export interface QaQcAlert {
  fieldId: string;
  type: 'CRITICA' | 'ADVERTENCIA' | 'VACIO';
  message: string;
  ruleId: string;
  section: string;
}

export type QaQcSeverity = QaQcAlert['type'];

export interface WindowValidation {
  client_id: string;
  can_save: boolean;
  issues: QaQcAlert[];
  ruleset_version: string;
  derived: { gsi_visual: number; rqd_est: number; condicion_rating_89: number;
    geometry: { length_m: number; dip_hw: number; az_hw: number; dipdir_talud: number } | null };
}

export interface ValidationResponse {
  request_id: string;
  draft_revision: number;
  ruleset_version: string;
  windows: WindowValidation[];
}
