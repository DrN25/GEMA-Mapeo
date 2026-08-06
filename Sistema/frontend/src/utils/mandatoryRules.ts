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
  header: Record<string, boolean>;
  discontinuities: Record<string, boolean>;
  rmrGsi: Record<string, boolean>;
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
  header: {
    celda: true,
    este_from: true,
    norte_from: true,
    cota_from: true,
    este_to: true,
    norte_to: true,
    cota_to: true,
    altura: true,
    fecha: true,
    largo: true,
    dip_talud: true,
    dipdir_talud: true,
    dip_hw: true,
    az_hw: true,
    lito_1: true,
    lito_2: true,
    lito_3: false,
    unidad_litologica: true,
    sect_geot: true,
    intemperia: true,
    campana: true,
    nivel: true,
    mapeador: true,
    // OPCIONALES
    alt_mapeo: false,
    alteracion: false,
    fase: false,
    comentario: false
  },
  discontinuities: {
    familia: true,
    distancia: true,
    dip: true,
    dip_dir: true,
    tipo_estructura: true,
    n_estructuras: true,
    abertura: true,
    espesor: true,
    continuidad: true,
    espaciamiento: true,
    extremos_visibles: true,
    terminacion: true,
    relleno1: true,
    jrc: true,
    rugosidad: true,
    forma: true,
    alteracion: true,
    // OPCIONALES
    relleno2: false
  },
  rmrGsi: {
    condicion_agua: true,
    resistencia_ucs: true,
    is50_mpa: true,
    gsi_superficie: true,
    gsi_visual: true,
    gsi_estructura: true,
    control_estructural: true,
    efectos_voladura: true
  },
  pltEnsayos: {
    campana: true,
    fecha_ensayo: true,
    ejecutado_por: true,
    tipo_ensayo: true,
    nivel: true,
    celda_mapeo: true,
    muestra: true,
    codigo_muestra: true,
    litologia_1: true,
    litologia_2: true,
    litologia_3: true,
    tipo_litologico: true,
    este: true,
    norte: true,
    elevacion: true,
    espesor_d: true,
    longitud_l: true,
    ancho_w: true,
    ancho_w1: true,
    ancho_w2: true,
    muestra_valida_longitud: true,
    muestra_valida_ancho: true,
    fuerza_p: true,
    direccion_rotura: true,
    tipo_fractura: true,
    diametro_equivalente: true,
    f: true,
    is_mpa: true,
    is_50: true,
    factor_conversion_k: true,
    ucs: true,
    resistencia_isrm: true,
    sector_geotecnico: true,
    zona_mapeo: true,
    // OPCIONALES
    observaciones: false
  }
};

const HEADER_FIELD_LABELS: Record<string, string> = {
  celda: 'Código Celda',
  este_from: 'Este Inicio',
  norte_from: 'Norte Inicio',
  cota_from: 'Cota Inicio',
  este_to: 'Este Fin',
  norte_to: 'Norte Fin',
  cota_to: 'Cota Fin',
  altura: 'Altura Ventana',
  fecha: 'Fecha de Mapeo',
  largo: 'Distancia de Celda',
  dip_talud: 'Dip Talud',
  dipdir_talud: 'DipDir Talud',
  dip_hw: 'Dip HW / Perforación',
  az_hw: 'Azimut HW / Perforación',
  lito_1: 'Litología 1',
  lito_2: 'Litología 2',
  lito_3: 'Litología 3',
  unidad_litologica: 'Unidad Litológica',
  sect_geot: 'Sector Geotécnico',
  intemperia: 'Intemperismo / Meteorización',
  campana: 'Campaña',
  nivel: 'Nivel',
  mapeador: 'Geólogo Mapeador',
  alt_mapeo: 'Alteración',
  alteracion: 'Alteración',
  fase: 'Fase',
  comentario: 'Comentarios'
};

const DISCON_FIELD_LABELS: Record<string, string> = {
  familia: 'Familia',
  distancia: 'Distancia Estructura',
  dip: 'Dip (Buzamiento)',
  dip_dir: 'DipDir (Dirección Buzamiento)',
  tipo_estructura: 'Tipo de Estructura',
  n_estructuras: 'N° de Estructuras',
  abertura: 'Abertura',
  espesor: 'Espesor de Relleno',
  continuidad: 'Continuidad / Persistencia',
  espaciamiento: 'Espaciamiento',
  extremos_visibles: 'Extremos Visibles',
  terminacion: 'Terminación',
  relleno1: 'Tipo de Relleno 1',
  relleno2: 'Tipo de Relleno 2',
  jrc: 'JRC',
  rugosidad: 'Rugosidad de Estructura',
  forma: 'Forma de Estructura',
  alteracion: 'Alteración / Intemperismo Pared'
};

const RMR_GSI_FIELD_LABELS: Record<string, string> = {
  condicion_agua: 'Condición de Agua',
  resistencia_ucs: 'Dureza / Resistencia UCS',
  is50_mpa: 'Is50 (MPa)',
  gsi_superficie: 'Condición de la Superficie (GSI)',
  gsi_visual: 'GSI Visual',
  gsi_estructura: 'Estructura (GSI)',
  control_estructural: 'Control Estructural',
  efectos_voladura: 'Efectos de Voladura'
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

export function validateMapeoWindow(windowData: any): MissingFieldIssue[] {
  if (!windowData || !windowData.header) return [];
  const issues: MissingFieldIssue[] = [];

  const h = windowData.header;

  // 1. Validar Cabecera / Datos de Registro
  for (const [key, isRequired] of Object.entries(MANDATORY_FIELD_RULES.header)) {
    const val = getFieldValue(h, key);
    if (isRequired && isBlank(val)) {
      issues.push({
        group: 'mapeo',
        section: 'DATOS DE REGISTRO',
        fieldKey: key,
        fieldLabel: HEADER_FIELD_LABELS[key] || key,
        message: `Cabecera: El campo '${HEADER_FIELD_LABELS[key] || key}' es obligatorio.`
      });
    }
  }

  // 2. Validar Análisis RMR & GSI
  for (const [key, isRequired] of Object.entries(MANDATORY_FIELD_RULES.rmrGsi)) {
    const val = getFieldValue(h, key);
    if (isRequired && isBlank(val)) {
      issues.push({
        group: 'mapeo',
        section: 'ANÁLISIS RMR & GSI',
        fieldKey: key,
        fieldLabel: RMR_GSI_FIELD_LABELS[key] || key,
        message: `Análisis RMR & GSI: El campo '${RMR_GSI_FIELD_LABELS[key] || key}' es obligatorio.`
      });
    }
  }

  // 3. Validar Discontinuidades
  const joints = Array.isArray(windowData.joints) ? windowData.joints : [];
  joints.forEach((j: any, idx: number) => {
    // Una fila es "vacante" SOLO si todos sus campos editables están vacíos (plantilla sin datos).
    // familia se excluye porque siempre tiene valor asignado, y alteracion porque
    // normalizeJoints puede pre-rellenarla con el intemperismo del header (default).
    // Si tiene cualquier dato, se exigen todos los campos obligatorios (incluye filas de familias creadas).
    const jointFields = Object.keys(MANDATORY_FIELD_RULES.discontinuities)
      .filter(k => k !== 'familia' && k !== 'alteracion');
    const isVacant = jointFields.every(key => isBlank(getFieldValue(j, key)));

    if (isVacant) return;

    for (const [key, isRequired] of Object.entries(MANDATORY_FIELD_RULES.discontinuities)) {
      const val = getFieldValue(j, key);
      if (isRequired && isBlank(val)) {
        issues.push({
          group: 'mapeo',
          section: 'DISCONTINUIDADES',
          fieldKey: key,
          fieldLabel: DISCON_FIELD_LABELS[key] || key,
          rowIndex: idx + 1,
          message: `Discontinuidades (Fila ${idx + 1}): El campo '${DISCON_FIELD_LABELS[key] || key}' es obligatorio.`
        });
      }
    }
  });

  return issues;
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
  });

  return issues;
}
