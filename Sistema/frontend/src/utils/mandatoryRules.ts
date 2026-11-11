/**
 * utils/mandatoryRules.ts — Módulo centralizado y desacoplado para la validación de campos obligatorios en el guardado.
 * Estructura tipo "switch" booleana (true = obligatorio, false = opcional).
 */

/**
 * ¿La alerta BLOQUEA el guardado? Solo CRITICA y VACIO.
 * Las ADVERTENCIAS se muestran en el panel QA/QC pero nunca impiden guardar.
 */
export function isBlockingValidationAlert(type: string | undefined): boolean {
  return type === 'CRITICA' || type === 'VACIO';
}

export interface MandatoryFieldRules {
  pltEnsayos: Record<string, boolean>;
}

export interface MissingFieldIssue {
  group: 'mapeo' | 'plt';
  section: string;
  fieldKey: string;
  fieldLabel: string;
  rowIndex?: number;
  message: string;
}

/**
 * Convierte una lista de campos vacíos a alertas QA/QC tipo 'VACIO'
 * con el fieldId correcto para el enfoque de campos.
 */
export function toVacioAlerts(issues: MissingFieldIssue[]): Array<{
  fieldId: string;
  type: 'VACIO';
  message: string;
  ruleId: string;
  section: string;
}> {
  return issues.map(issue => {
    let fieldId: string;
    if (issue.group === 'plt') {
      fieldId = `plt-${issue.fieldKey}${issue.rowIndex !== undefined ? `-${issue.rowIndex - 1}` : ''}`;
    } else if (issue.section === 'DISCONTINUIDADES') {
      fieldId = `joint-${issue.fieldKey}-${issue.rowIndex !== undefined ? issue.rowIndex - 1 : 0}`;
    } else {
      fieldId = `header-${issue.fieldKey}`;
    }
    return {
      fieldId,
      type: 'VACIO' as const,
      message: issue.message,
      ruleId: 'CAMPO_OBLIGATORIO_VACIO',
      section: issue.section,
    };
  });
}

export const MANDATORY_FIELD_RULES: MandatoryFieldRules = {
  pltEnsayos: {
    campana: true,
    fecha_ensayo: true,
    tipo_ensayo: true,
    nivel: true,
    celda_mapeo: true,
    muestra: true,
    codigo_muestra: true,
    litologia_1: true,
    tipo_litologico: true,
    este: true,
    norte: true,
    elevacion: true,
    espesor_d: true,
    longitud_l: true,
    ancho_w1: true,
    ancho_w2: true,
    fuerza_p: true,
    direccion_rotura: true,
    tipo_fractura: true,

    // OPCIONALES Y CAMPOS DERIVADOS DE ENSAYO (observaciones es obligatorio condicionalmente si P > 60 kN)
    ejecutado_por: false,
    litologia_2: false,
    litologia_3: false,
    ancho_w: false,
    muestra_valida_longitud: false,
    muestra_valida_ancho: false,
    diametro_equivalente: false,
    f: false,
    is_mpa: false,
    is_50: false,
    factor_conversion_k: false,
    ucs: false,
    resistencia_isrm: false,
    sector_geotecnico: false,
    zona_mapeo: false,
    observaciones: false
  }
};

export const PLT_FIELD_LABELS: Record<string, string> = {
  campana: 'Campaña',
  fecha_ensayo: 'Fecha de Ensayo',
  ejecutado_por: 'Ejecutado Por',
  tipo_ensayo: 'Tipo de Ensayo',
  nivel: 'Nivel',
  celda_mapeo: 'Celda de Mapeo',
  muestra: 'Muestra',
  codigo_muestra: 'Código Muestra',
  litologia_1: 'Litología 1',
  litologia_2: 'Litología 2',
  litologia_3: 'Litología 3',
  tipo_litologico: 'Tipo Litológico',
  este: 'Coordenada Este',
  norte: 'Coordenada Norte',
  elevacion: 'Elevación',
  espesor_d: 'Espesor D',
  longitud_l: 'Longitud L',
  ancho_w: 'Ancho W',
  ancho_w1: 'Ancho W1',
  ancho_w2: 'Ancho W2',
  muestra_valida_longitud: 'Muestra Válida L',
  muestra_valida_ancho: 'Muestra Válida W',
  fuerza_p: 'Fuerza P',
  direccion_rotura: 'Dirección Rotura',
  tipo_fractura: 'Tipo Fractura',
  diametro_equivalente: 'Diámetro Equivalente',
  f: 'Factor Corrección (f)',
  is_mpa: 'Is (MPa)',
  is_50: 'Is50 (MPa)',
  factor_conversion_k: 'Factor K',
  ucs: 'UCS (MPa)',
  resistencia_isrm: 'Resistencia ISRM',
  sector_geotecnico: 'Sector Geotécnico',
  zona_mapeo: 'Zona Muestreo',
  observaciones: 'Observaciones'
};

function getFieldValue(obj: any, key: string): any {
  if (!obj) return undefined;
  if (obj[key] !== undefined && obj[key] !== null) return obj[key];

  // Mapa de sinónimos entre la vista y la cabecera
  const synonyms: Record<string, string[]> = {
    campana: ['campania', 'campana_id', 'campania_id'],
    sect_geot: ['sector', 'sector_geotecnico'],
    mapeador: ['geologo', 'ejecutado_por'],
  };

  const altKeys = synonyms[key];
  if (altKeys) {
    for (const altKey of altKeys) {
      if (obj[altKey] !== undefined && obj[altKey] !== null) {
        return obj[altKey];
      }
    }
  }
  return undefined;
}

function isBlank(val: any): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '' || trimmed === '-1';
  }
  if (typeof val === 'number') {
    return isNaN(val) || val === -1;
  }
  return false;
}

export function validatePltEnsayosList(pltEnsayos: any[]): MissingFieldIssue[] {
  if (!Array.isArray(pltEnsayos) || pltEnsayos.length === 0) return [];
  const issues: MissingFieldIssue[] = [];

  pltEnsayos.forEach((row: any, idx: number) => {
    for (const [key, isRequired] of Object.entries(MANDATORY_FIELD_RULES.pltEnsayos)) {
      const val = getFieldValue(row, key);
      if (isRequired && isBlank(val)) {
        issues.push({
          group: 'plt',
          section: 'ENSAYOS PLT IRREGULARES',
          fieldKey: key,
          fieldLabel: PLT_FIELD_LABELS[key] || key,
          rowIndex: idx + 1,
          message: `PLT Irregulares (Fila ${idx + 1}): El campo '${PLT_FIELD_LABELS[key] || key}' es obligatorio.`
        });
      }
    }

    const fuerzaPNum = !isBlank(row?.fuerza_p) ? Number(row.fuerza_p) : NaN;
    if (Number.isFinite(fuerzaPNum) && fuerzaPNum > 60 && isBlank(row?.observaciones)) {
      issues.push({
        group: 'plt',
        section: 'ENSAYOS PLT IRREGULARES',
        fieldKey: 'observaciones',
        fieldLabel: PLT_FIELD_LABELS.observaciones || 'Observaciones',
        rowIndex: idx + 1,
        message: `PLT Irregulares (Fila ${idx + 1}): Fuerza P = ${fuerzaPNum} kN (> 60 kN). Es obligatorio registrar un comentario en 'Observaciones'.`
      });
    }
  });

  return issues;
}
