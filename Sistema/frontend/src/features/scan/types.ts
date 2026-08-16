/**
 * features/scan/types.ts — Tipos del módulo de Escaneo de imágenes.
 *
 * El contrato es un espejo del importador de Excel: la respuesta del preview
 * genera ScanCeldaItem que, al confirmar, produce ImportedCellItem (el mismo
 * tipo que consume App.tsx:handleImportToPending vía excelDataToWindowData).
 */

export type ScanMode = 'actual' | 'nueva';

/** Campo del sistema -> etiqueta amigable para la UI. */
export interface ScanFieldMeta {
  key: string;
  label: string;
  group: string;
  type: 'number' | 'text' | 'date';
  intDigits?: number;
  decDigits?: number;
}

export interface ScanJointRow {
  numero_estructura: number;
  familia_id: number;
  tipo_estructura: string;
  dip: number;
  dip_dir: number;
  distancia_m?: number;
  abertura_mm?: number;
  espesor_mm?: number;
  continuidad_m?: number;
  espaciamiento_m?: number;
  n_estructuras?: number;
  n_extremos_visibles?: number;
  terminacion?: number;
  relleno_1_codigo?: string;
  relleno_2_codigo?: string;
  jrc?: number;
  rugosidad_codigo?: string;
  forma_estructura?: string;
  alteracion_codigo?: string;
}

/** excel_data + estructuras con metadatos de escaneo (respuesta del backend). */
export interface ScanCeldaItem {
  codigo: string | null;
  is_duplicate: boolean;
  excel_data: Record<string, any>;
  existing_data: Record<string, any> | null;
  estructuras: ScanJointRow[];
  source_image: number;
  missing_header: string[];
  missing_joints: string[][];
  confidence: number;
}

export interface ScanPreviewResponse {
  status: string;
  formato_detectado: string;
  total_celdas: number;
  total_duplicados: number;
  existing_codes: string[];
  celdas: ScanCeldaItem[];
  modelo_utilizado: string | null;
  errores_por_imagen: ScanImageError[];
}

/** Resultado por imagen: error de transporte o marca "no_mapping_form". */
export interface ScanImageError {
  source_image: number;
  tipo: 'error' | 'no_mapping_form';
  error?: string | null;
  mensaje?: string | null;
}

export interface ScanConfigResponse {
  provider: string;
  free_model: string;
  paid_model: string;
  use_free_model: boolean;
  max_images_per_batch: number;
  max_image_mb: number;
  concurrency: number;
  is_configured: boolean;
}

/** Item listo para entregar a handleImportToPending (mismo tipo que Excel). */
export interface ScanImportedCellItem {
  codigo_original: string;
  codigo_final: string;
  excel_data: any;
  estructuras: ScanJointRow[];
  exists_in_db?: boolean;
}

/** Metadatos de edición por campo (para el preview editable). */
export const SCAN_FIELD_GROUPS: Record<string, string> = {
  identificacion: 'Identificación',
  coordenadas: 'Coordenadas (INI / FIN)',
  geometria: 'Geometría de la Ventana',
  litologia: 'Litología',
  clasificacion: 'Clasificación Geomecánica',
  rmr: 'Parámetros RMR (opcional — se calculan al guardar)',
};
