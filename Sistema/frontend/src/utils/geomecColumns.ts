import {
    STRUCTURE_CATALOG,
    RELLENO_CATALOG,
    ALTERACION_CATALOG,
    FORMA_CATALOG,
    RUGOSIDAD_CATALOG,
    LITHOLOGY_CLASSIFICATION,
    resolveLithologyCascade
} from '../utils/catalogData';

// 1. DICCIONARIO MAESTRO DE ETIQUETAS (SSOT ABSOLUTO)
export const COLUMN_LABELS: Record<string, string> = {
    // Cabeceras de Discontinuidades
    distancia: "Distancia Estructura (m)",
    dip: "Dip (°)",
    dip_dir: "DipDir (°)",
    tipo_estructura: "Tipo de Estructura",
    n_estructuras: "N° de Estructuras",
    abertura: "Abertura (mm)",
    espesor: "Espesor (mm)",
    continuidad: "Continuidad (m)",
    espaciamiento: "Espaciamiento (m)",
    extremos_visibles: "N° de Extremos Visibles",
    terminacion: "Terminacion",
    relleno1: "Tipo de Relleno 1",
    relleno2: "Tipo de Relleno 2",
    jrc: "JRC",
    rugosidad: "Rugosidad de Estructura",
    forma: "Forma de Estructura",
    alteracion: "Alteración",

    // Subcabeceras de la tabla de discontinuidades (R89 / R76)
    r1_sub_89: "Valor Relleno 1",
    r2_sub_89: "Valor Relleno 2",
    r1_sub_76: "Valor Relleno 1",
    r2_sub_76: "Valor Relleno 2",
    alt_sub: "Valor de Alteración",
    rel_sub: "Valor de Relleno",
    cont_sub: "Continuidad",
    aber_sub: "Abertura",
    rug_sub: "Rugosidad",
    val_sub: "Valor",

    // Ratings calculados
    alt_r89: "Alteración (R89)",
    alt_r76: "Alteración (R76)",
    rel_r89: "Relleno (R89)",
    rel_r76: "Relleno (R76)",
    cont_r89: "Continuidad (R89)",
    cont_r76: "Continuidad (R76)",
    aber_r89: "Abertura (R89)",
    aber_r76: "Abertura (R76)",
    rug_r89: "Rugosidad (R89)",
    rug_r76: "Rugosidad (R76)",
    val_r89: "Total Condición (R89)",
    val_r76: "Total Condición (R76)",

    // Cabeceras de Ventana y Análisis Geomecánico (RmrAnalysis.tsx)
    condicion_agua: "Condición de Agua",
    condicion_agua_short: "Condición de Agua",
    val_agua_sub: "Valor Agua",
    val_agua_r89: "Valor Agua (R89)",
    val_agua_r76: "Valor Agua (R76)",
    resistencia_ucs: "Dureza",
    val_resist_sub: "Resistencia Estimada (Valor)",
    val_resist_r89: "Resistencia Estimada Valor (R89)",
    val_resist_r76: "Resistencia Estimada Valor (R76)",
    gsi_superficie: "Condicion de la SUP (GSI)",
    gsi_estructura: "Estructura (GSI)",
    gsi_visual: "GSI (Visual)",
    control_estructural: "Control Estructural",
    control_estructural_short: "Ctrl. Estruc.",
    efectos_voladura: "Efectos de la Voladura",
    efectos_voladura_short: "Ef. Voladura",
    rqd_valor_sub: "RQD Valor",
    rqd_rating_r89: "RQD Valor (R89)",
    rqd_rating_r76: "RQD Valor (R76)",
    rqd_est: "RQD (%)",
    jv: "Frecuencia de Fracturamiento x m",
    block_size: "Tamaño de Bloque (m3)",
    global_spacing: "Espaciamiento Promedio",
    espac_val_sub: "Espaciamiento Valor",
    spacing_rating_r89: "Espac. Val (R89)",
    spacing_rating_r76: "Espac. Val (R76)",
    condicion_rating_sub: "Condicion de Discontinuidad Valor",
    condicion_rating_r89: "Condicion de Discontinuidad Valor (R89)",
    condicion_rating_r76: "Condicion de Discontinuidad Valor (R76)",
    rmr_final_sub: "RMR",
    rmr_89: "RMR (89)",
    rmr_76: "RMR (76)",
    ucs_mpa: "UCS (MPa)",
    is50_mpa: "is50 (MPa)",
    espac_prom: "Espaciamiento Promedio",
    espaciamiento_junta: "Espaciamiento de Junta",

    // Cabeceras de Ensayos PLT
    campana: "Campaña",
    fecha_ensayo: "Fecha de ensayo",
    sector_geotecnico: "Sector Geotécnico",
    ejecutado_por: "Ejecutado por",
    zona_mapeo: "ZONA",
    tipo_ensayo: "Tipo de Ensayo",
    nivel: "Nivel",
    celda_mapeo: "Celda de mapeo",
    muestra: "Muestra",
    codigo_muestra: "Código muestra",
    litologia_1: "Litología 1",
    litologia_2: "Litología 2",
    litologia_3: "Litología 3",
    tipo_litologico: "Tipo litológico",
    este: "Este (m)",
    norte: "Norte (m)",
    elevacion: "Elevación (msnm)",
    espesor_d: "Espesor D (cm)",
    longitud_l: "Longitud L (cm)",
    ancho_w1: "Ancho W1 (cm)",
    ancho_w2: "Ancho W2 (cm)",
    ancho_w: "Ancho W (cm)",
    muestra_valida_longitud: "Muestra válida - L",
    muestra_valida_ancho: "Muestra válida - W",
    fuerza_p: "Fuerza P (kN)",
    direccion_rotura: "Dirección rotura",
    tipo_fractura: "Tipo fractura",
    diametro_equivalente: "Diám. Equiv De (cm)",
    f: "Fact. Correc.",
    is_mpa: "Is (MPa)",
    is_50: "Is(50) (MPa)",
    factor_conversion_k: "Factor K",
    ucs: "UCS (MPa)",
    resistencia_isrm: "Resist. ISRM",
    denominacion_isrm: "Denominación ISRM",
    observaciones: "Observaciones"
};

export interface ColumnConfig<T = any> {
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'date';
    width: number;
    options?: { value: any; label: string }[];
    isComputed?: boolean;
    precision?: number;
    required?: boolean;
    range?: [number, number];
    formulaId?: string;
    getFormulaParams?: (row: T) => Record<string, any>;
    formatOnBlur?: (val: any) => string;
    customStyleClass?: string;
}

const getAberturaClase = (val: number | undefined | null): string => {
    if (val === undefined || val === null || val === -1) return '';
    if (val <= 0) return 'Ninguna';
    if (val < 0.1) return 'Muy cerrada';
    if (val <= 1.0) return 'Cerrada';
    if (val <= 5.0) return 'Mod. abierta';
    return 'Abierta';
};

const ALTERACION_ABBR: Record<string, string> = {
    f: 'Fresca', d: 'Déb. Met.', m: 'Mod. Met.', a: 'Alt. Met.', c: 'Comp. Met.', s: 'Suelo Res.'
};

// 2. CONFIGURACIÓN DE COLUMNAS DE DISCONTINUIDADES
export const DISCON_COLUMNS: ColumnConfig[] = [
    { key: 'distancia', label: COLUMN_LABELS.distancia, type: 'number', width: 85, precision: 0 },
    { key: 'dip', label: COLUMN_LABELS.dip, type: 'number', width: 80, precision: 2, range: [-90, 90] },
    { key: 'dip_dir', label: COLUMN_LABELS.dip_dir, type: 'number', width: 96, precision: 2, range: [0, 359] },
    {
        key: 'tipo_estructura',
        label: COLUMN_LABELS.tipo_estructura,
        type: 'select',
        width: 96,
        options: Object.keys(STRUCTURE_CATALOG).map(code => ({ value: code, label: code }))
    },
    { key: 'n_estructuras', label: COLUMN_LABELS.n_estructuras, type: 'number', width: 80, precision: 0, range: [1, 999] },
    {
        key: 'abertura',
        label: COLUMN_LABELS.abertura,
        type: 'number',
        width: 144,
        precision: 1,
        range: [0, 50000],
        formatOnBlur: (val) => val !== undefined && val !== -1 ? `${val.toFixed(1).replace('.', ',')} (${getAberturaClase(val)})` : ''
    },
    {
        key: 'espesor',
        label: COLUMN_LABELS.espesor,
        type: 'number',
        width: 96,
        precision: 1,
        range: [0, 50000],
        formatOnBlur: (val) => val !== undefined && val !== -1 ? val.toFixed(1) : ''
    },
    { key: 'continuidad', label: COLUMN_LABELS.continuidad, type: 'number', width: 96, precision: 2, range: [0, 99] },
    {
        key: 'espaciamiento',
        label: COLUMN_LABELS.espaciamiento,
        type: 'number',
        width: 96,
        precision: 2,
        range: [0, 99],
        formatOnBlur: (val) => val !== undefined && val !== -1 ? val.toFixed(2) : ''
    },
    {
        key: 'extremos_visibles',
        label: COLUMN_LABELS.extremos_visibles,
        type: 'select',
        width: 96,
        options: [{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }]
    },
    {
        key: 'terminacion',
        label: COLUMN_LABELS.terminacion,
        type: 'select',
        width: 80,
        options: [{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]
    },
    {
        key: 'relleno1',
        label: COLUMN_LABELS.relleno1,
        type: 'select',
        width: 128,
        options: Object.keys(RELLENO_CATALOG).filter(code => code !== 'cwf').map(code => ({ value: code, label: code }))
    },
    {
        key: 'relleno2',
        label: COLUMN_LABELS.relleno2,
        type: 'select',
        width: 128,
        options: Object.keys(RELLENO_CATALOG).filter(code => code !== 'cwf').map(code => ({ value: code, label: code }))
    },

    { key: 'r1_89', label: COLUMN_LABELS.r1_sub_89, type: 'number', width: 80, isComputed: true, formulaId: 'rel_single_r89', getFormulaParams: (row) => ({ code: row.relleno1, thickness: row.espesor }) },
    { key: 'r2_89', label: COLUMN_LABELS.r2_sub_89, type: 'number', width: 80, isComputed: true, formulaId: 'rel_single_r89', getFormulaParams: (row) => ({ code: row.relleno2, thickness: row.espesor }) },
    { key: 'r1_76', label: COLUMN_LABELS.r1_sub_76, type: 'number', width: 80, isComputed: true, formulaId: 'rel_single_r76', getFormulaParams: (row) => ({ code: row.relleno1, thickness: row.espesor }) },
    { key: 'r2_76', label: COLUMN_LABELS.r2_sub_76, type: 'number', width: 80, isComputed: true, formulaId: 'rel_single_r76', getFormulaParams: (row) => ({ code: row.relleno2, thickness: row.espesor }) },

    { key: 'jrc', label: COLUMN_LABELS.jrc, type: 'number', width: 80, precision: 0, range: [0, 20] },
    { key: 'rugosidad', label: COLUMN_LABELS.rugosidad, type: 'number', width: 144, precision: 0, range: [1, 9] },
    {
        key: 'forma',
        label: COLUMN_LABELS.forma,
        type: 'select',
        width: 80,
        options: Object.keys(FORMA_CATALOG).map(code => ({ value: code, label: code }))
    },
    {
        key: 'alteracion',
        label: COLUMN_LABELS.alteracion,
        type: 'select',
        width: 128,
        options: Object.keys(ALTERACION_CATALOG).map(code => ({ value: code, label: `${code} (${ALTERACION_ABBR[code] || code})` }))
    },

    { key: 'altR89', label: COLUMN_LABELS.alt_sub, type: 'number', width: 80, isComputed: true, formulaId: 'alt_r89', getFormulaParams: (row) => ({ code: row.alteracion }) },
    { key: 'relR89', label: COLUMN_LABELS.rel_sub, type: 'number', width: 80, isComputed: true, formulaId: 'rel_r89', getFormulaParams: (row) => ({ r1: row.r1_89, r2: row.r2_89 }) },
    { key: 'contR89', label: COLUMN_LABELS.cont_sub, type: 'number', width: 80, isComputed: true, formulaId: 'cont_r89', getFormulaParams: (row) => ({ value: row.continuidad }) },
    { key: 'abR89', label: COLUMN_LABELS.aber_sub, type: 'number', width: 80, isComputed: true, formulaId: 'aber_r89', getFormulaParams: (row) => ({ value: row.abertura }) },
    { key: 'rugR89', label: COLUMN_LABELS.rug_sub, type: 'number', width: 80, isComputed: true, formulaId: 'rug_r89', getFormulaParams: (row) => ({ value: row.rugosidad }) },
    { key: 'totalR89', label: COLUMN_LABELS.val_sub, type: 'number', width: 80, isComputed: true, formulaId: 'total_cond_r89', getFormulaParams: (row) => ({ alt: row.altR89, rel: row.relR89, cont: row.contR89, aber: row.abR89, rug: row.rugR89 }), customStyleClass: 'bg-pink-500/10 text-pink-300 font-black outline-pink-500/30' },

    { key: 'altR76', label: COLUMN_LABELS.alt_sub, type: 'number', width: 80, isComputed: true, formulaId: 'alt_r76', getFormulaParams: (row) => ({ code: row.alteracion }) },
    { key: 'relR76', label: COLUMN_LABELS.rel_sub, type: 'number', width: 80, isComputed: true, formulaId: 'rel_r76', getFormulaParams: (row) => ({ r1: row.r1_76, r2: row.r2_76 }) },
    { key: 'contR76', label: COLUMN_LABELS.cont_sub, type: 'number', width: 80, isComputed: true, formulaId: 'cont_r76', getFormulaParams: (row) => ({ value: row.continuidad }) },
    { key: 'abR76', label: COLUMN_LABELS.aber_sub, type: 'number', width: 80, isComputed: true, formulaId: 'aber_r76', getFormulaParams: (row) => ({ value: row.abertura }) },
    { key: 'rugR76', label: COLUMN_LABELS.rug_sub, type: 'number', width: 80, isComputed: true, formulaId: 'rug_r76', getFormulaParams: (row) => ({ value: row.rugosidad }) },
    { key: 'totalR76', label: COLUMN_LABELS.val_sub, type: 'number', width: 80, isComputed: true, formulaId: 'total_cond_r76', getFormulaParams: (row) => ({ alt: row.altR76, rel: row.relR76, cont: row.contR76, aber: row.abR76, rug: row.rugR76 }), customStyleClass: 'bg-amber-500/10 text-amber-300 font-black outline-amber-500/30' }
];

// 3. CONFIGURACIÓN DE COLUMNAS DE ENSAYOS PLT
export interface PltColumnConfig {
    key: string;
    label: string;
    type: 'text' | 'decimal' | 'int' | 'date' | 'select' | 'lito1' | 'lito2' | 'lito3';
    width: number;
    group: number;
    required?: boolean;
    computed?: boolean;
    options?: string[];
    synonyms?: string[];
    hidden?: boolean;
}

export const CAT_TIPO_LITOLOGICO = ["INTRUSIVOS", "SEDIMENTARIOS", "METAMORFICAS", "BRECHAS", "ENDOSKARN"];
export const CAT_TIPO_FRACTURA = ["M", "E", "C"];
export const CAT_DIRECCION_ROTURA = ["Pa", "Pe", "NA"];

export const ISRM_TABLE = [
    { indice: "R0", minUcs: 0.25, maxUcs: 1, denominacion: "Extremadamente débil" },
    { indice: "R1", minUcs: 1, maxUcs: 5, denominacion: "Muy débil" },
    { indice: "R2", minUcs: 5, maxUcs: 25, denominacion: "Débil" },
    { indice: "R3", minUcs: 25, maxUcs: 50, denominacion: "Moderadamente resistente" },
    { indice: "R4", minUcs: 50, maxUcs: 100, denominacion: "Resistente" },
    { indice: "R5", minUcs: 100, maxUcs: 250, denominacion: "Muy resistente" },
    { indice: "R6", minUcs: 250, maxUcs: Infinity, denominacion: "Extremadamente resistente" },
];

export const PLT_COLUMN_DEFS: PltColumnConfig[] = [
    { key: "campana", label: COLUMN_LABELS.campana, type: "select", width: 90, group: 1, required: true, options: ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028"], synonyms: ["campana", "campaña", "campana "] },
    { key: "fecha_ensayo", label: COLUMN_LABELS.fecha_ensayo, type: "date", width: 120, group: 1, required: true, synonyms: ["fecha de ensayo", "fechaensayo", "fecha_ensayo", "fecha"] },
    { key: "ejecutado_por", label: COLUMN_LABELS.ejecutado_por, type: "text", width: 110, group: 1, required: true, synonyms: ["ejecutado por", "ejecutadopor", "ejecución de ensayo", "ejecucion de ensayo", "ejecutado"] },
    { key: "tipo_ensayo", label: COLUMN_LABELS.tipo_ensayo, type: "select", width: 100, group: 1, required: true, options: ["i"], synonyms: ["tipo_ensayo", "tipo de ensayo", "tipo ensayo", "tipo"] },

    { key: "nivel", label: COLUMN_LABELS.nivel, type: "decimal", width: 80, group: 2, required: true, synonyms: ["nivel"] },
    { key: "celda_mapeo", label: COLUMN_LABELS.celda_mapeo, type: "text", width: 110, group: 2, required: true, synonyms: ["celda de mapeo", "celdamapeo", "celda_mapeo", "celda"] },
    { key: "muestra", label: COLUMN_LABELS.muestra, type: "text", width: 80, group: 2, required: true, synonyms: ["muestra"] },
    { key: "codigo_muestra", label: COLUMN_LABELS.codigo_muestra, type: "text", width: 110, group: 2, computed: true },
    { key: "litologia_1", label: COLUMN_LABELS.litologia_1, type: "lito1", width: 90, group: 2, required: true, synonyms: ["litologia 1", "litología 1", "litologia_1", "lito1"] },
    { key: "litologia_2", label: COLUMN_LABELS.litologia_2, type: "lito2", width: 90, group: 2, synonyms: ["litologia 2", "litología 2", "litologia_2", "lito2"] },
    { key: "litologia_3", label: COLUMN_LABELS.litologia_3, type: "lito3", width: 90, group: 2, synonyms: ["litologia 3", "litología 3", "litologia_3", "lito3"] },
    { key: "model2022", label: "Model2022", type: "text", width: 100, group: 2, hidden: true, synonyms: ["model2022", "modelo 2022", "modelo2022", "litho 3 - modelo2022"] },
    { key: "tipo_litologico", label: COLUMN_LABELS.tipo_litologico, type: "text", width: 130, group: 2, computed: true, required: true, synonyms: ["tipo litologico", "tipolitológico", "tipo_litologico", "tipo litólico", "tipo litológico"] },

    { key: "este", label: COLUMN_LABELS.este, type: "decimal", width: 100, group: 3, synonyms: ["este", "este (m)", "east", "este(m)"] },
    { key: "norte", label: COLUMN_LABELS.norte, type: "decimal", width: 110, group: 3, synonyms: ["norte", "norte (m)", "north", "norte(m)"] },
    { key: "elevacion", label: COLUMN_LABELS.elevacion, type: "decimal", width: 100, group: 3, synonyms: ["elevacion", "elevación", "elevación (msnm)", "elevacion(msnm)", "elevacion (msnm)", "z"] },

    { key: "espesor_d", label: COLUMN_LABELS.espesor_d, type: "decimal", width: 90, group: 4, synonyms: ["espesor d", "espesord", "espesor d (cm)", "espesord(cm)", "espesor\nd\n(cm)", "espesor d", "espesor"] },
    { key: "longitud_l", label: COLUMN_LABELS.longitud_l, type: "decimal", width: 90, group: 4, synonyms: ["longitud l", "longitudl", "longitud l (cm)", "longitudl(cm)", "longitud\nl\n(cm)", "longitud l", "longitud"] },
    { key: "ancho_w1", label: COLUMN_LABELS.ancho_w1, type: "decimal", width: 95, group: 4, synonyms: ["ancho w1", "anchow1", "ancho w1 (cm)", "anchow1(cm)", "ancho\nw1\n(cm)"] },
    { key: "ancho_w2", label: COLUMN_LABELS.ancho_w2, type: "decimal", width: 95, group: 4, synonyms: ["ancho w2", "anchow2", "ancho w2 (cm)", "anchow2(cm)", "ancho\nw2\n(cm)"] },
    { key: "ancho_w", label: COLUMN_LABELS.ancho_w, type: "decimal", width: 95, group: 4, computed: true },
    { key: "muestra_valida_longitud", label: COLUMN_LABELS.muestra_valida_longitud, type: "text", width: 115, group: 4, computed: true },
    { key: "muestra_valida_ancho", label: COLUMN_LABELS.muestra_valida_ancho, type: "text", width: 115, group: 4, computed: true },

    { key: "fuerza_p", label: COLUMN_LABELS.fuerza_p, type: "decimal", width: 90, group: 5, synonyms: ["fuerza p", "fuerzap", "fuerza p (kn)", "fuerzap(kn)", "fuerza\np\n(kn)", "fuerza p (kn)"] },
    { key: "direccion_rotura", label: COLUMN_LABELS.direccion_rotura, type: "select", width: 110, group: 5, options: CAT_DIRECCION_ROTURA, synonyms: ["direccion rotura", "dirección rotura", "dirección de ruptura", "direccion_rotura"] },
    { key: "tipo_fractura", label: COLUMN_LABELS.tipo_fractura, type: "select", width: 110, group: 5, options: CAT_TIPO_FRACTURA, synonyms: ["tipo fractura", "tipo de fractura", "tipo_fractura"] },

    { key: "diametro_equivalente", label: COLUMN_LABELS.diametro_equivalente, type: "decimal", width: 120, group: 6, computed: true },
    { key: "f", label: COLUMN_LABELS.f, type: "decimal", width: 85, group: 6, computed: true },
    { key: "is_mpa", label: COLUMN_LABELS.is_mpa, type: "decimal", width: 80, group: 6, computed: true },
    { key: "is_50", label: COLUMN_LABELS.is_50, type: "decimal", width: 85, group: 6, computed: true },

    { key: "factor_conversion_k", label: COLUMN_LABELS.factor_conversion_k, type: "decimal", width: 80, group: 7, computed: true, synonyms: ["factor k", "factork", "factor de conversión k", "factor_conversion_k"] },
    { key: "ucs", label: COLUMN_LABELS.ucs, type: "decimal", width: 80, group: 7, computed: true },
    { key: "resistencia_isrm", label: COLUMN_LABELS.resistencia_isrm, type: "text", width: 90, group: 7, computed: true },
    { key: "denominacion_isrm", label: COLUMN_LABELS.denominacion_isrm, type: "text", width: 220, group: 7, computed: true, hidden: true },

    { key: "observaciones", label: COLUMN_LABELS.observaciones, type: "text", width: 180, group: 8, synonyms: ["observaciones"] },
    { key: "sector_geotecnico", label: COLUMN_LABELS.sector_geotecnico, type: "text", width: 110, group: 8, synonyms: ["sector geotécnico", "sectorgeotecnico", "sector_geotecnico", "sector", "sectorgeot"] },
    { key: "zona_mapeo", label: COLUMN_LABELS.zona_mapeo, type: "text", width: 130, group: 8, required: true, synonyms: ["zona de muestreo", "zonademuestreo", "zona", "zona_mapeo", "zonamapeo", "identificación de muestra", "identificacion de muestra", "zona_mapeo ", "zona "] },
];

export const GROUP_META: Record<number, { label: string; bg: string }> = {
    1: { label: "Información General del Ensayo", bg: "rgba(30, 41, 59, 0.7)" },
    2: { label: "Identificación de Muestra", bg: "rgba(13, 148, 136, 0.15)" },
    3: { label: "Coordenadas WGS84", bg: "rgba(16, 185, 129, 0.15)" },
    4: { label: "Geometría del bloque irregular", bg: "rgba(59, 130, 246, 0.15)" },
    5: { label: "Datos del ensayo", bg: "rgba(99, 102, 241, 0.15)" },
    6: { label: "Cálculo de índice de carga puntual", bg: "rgba(139, 92, 246, 0.15)" },
    7: { label: "Resistencia de la roca intacta", bg: "rgba(100, 116, 139, 0.15)" },
    8: { label: "Observaciones", bg: "rgba(30, 41, 59, 0.3)" },
};

// 4. LÓGICAS DE CÁLCULO Y FORMATEO COMPARTIDAS (PLT)
export function getLito2Options(l1: string) {
    if (!l1) return [];
    return Array.from(new Set(
        LITHOLOGY_CLASSIFICATION.filter(item => item.unidad === l1).map(item => item.litologia)
    )).sort();
}

export function getLito3Options(l1: string, l2: string | null | undefined) {
    if (!l1 || !l2) return [];
    return Array.from(new Set(
        LITHOLOGY_CLASSIFICATION.filter(item => item.unidad === l1 && item.litologia === l2).map(item => item.codigo)
    )).sort();
}

export function getIsrmClass(ucs: number | null) {
    if (ucs === null || ucs === undefined || isNaN(ucs)) return null;
    const match = ISRM_TABLE.find(r => ucs >= r.minUcs && ucs < r.maxUcs);
    return match ? { indice: match.indice, denominacion: match.denominacion } : null;
}

export function applyPltFormulas(row: any) {
    const r = { ...row };
    const num = (v: any) => (v !== null && v !== undefined && v !== "" && !isNaN(Number(v))) ? Number(v) : null;

    const celdaStr = String(r.celda_mapeo || "").trim().toUpperCase();
    const muestraStr = String(r.muestra || "").trim();
    r.codigo_muestra = celdaStr ? (muestraStr ? `${celdaStr}_${muestraStr}` : celdaStr) : (muestraStr || "");

    const w1 = num(r.ancho_w1);
    const w2 = num(r.ancho_w2);
    r.ancho_w = (w1 !== null && w2 !== null) ? Math.round((w1 + w2) / 2 * 100) / 100 : null;

    const L = num(r.longitud_l);
    const D = num(r.espesor_d);
    const W = r.ancho_w;

    r.muestra_valida_longitud = (L !== null && D !== null) ? (L >= D ? "SÍ" : "NO") : null;
    r.muestra_valida_ancho = (D !== null && W !== null) ? (D > 0.3 * W && D < W ? "SÍ" : "NO") : null;
    r.diametro_equivalente = (D !== null && W !== null) ? Math.round(Math.sqrt(4 * D * W / Math.PI) * 1000000) / 1000000 : null;
    r.f = (r.diametro_equivalente !== null) ? Math.round(Math.pow((r.diametro_equivalente * 10) / 50, 0.45) * 1000000) / 1000000 : null;

    const P = num(r.fuerza_p);
    r.is_mpa = (P !== null && r.diametro_equivalente !== null && r.diametro_equivalente > 0)
        ? Math.round((P * 1000) / Math.pow(r.diametro_equivalente * 10, 2) * 1000000) / 1000000
        : null;

    // Conforme a temp.md: SI (Muestra válida - ancho == "SI") ENTONCES (F * Is) SINO NULL
    r.is_50 = (r.muestra_valida_ancho === "SÍ" && r.is_mpa !== null && r.f !== null)
        ? Math.round(r.is_mpa * r.f * 1000000) / 1000000
        : null;

    const res = resolveLithologyCascade(r.litologia_1, r.litologia_2, r.litologia_3, null);
    r.factor_conversion_k = res.k;
    r.tipo_litologico = res.clase;

    const K = num(r.factor_conversion_k);
    r.ucs = (r.is_50 !== null && K !== null) ? Math.round(r.is_50 * K * 100) / 100 : null;

    const cls = getIsrmClass(r.ucs);
    r.resistencia_isrm = cls ? cls.indice : null;
    r.denominacion_isrm = cls ? cls.denominacion : null;

    return r;
}

export function arePltRowsEqual(a: any, b: any): boolean {
    if (!a || !b) return false;
    const fields = [
        'campana', 'fecha_ensayo', 'sector_geotecnico', 'ejecutado_por',
        'zona_mapeo', 'nivel', 'celda_mapeo', 'muestra', 'codigo_muestra',
        'litologia_1', 'litologia_2', 'litologia_3', 'tipo_litologico',
        'este', 'norte', 'elevacion', 'espesor_d', 'longitud_l',
        'ancho_w1', 'ancho_w2', 'fuerza_p', 'direccion_rotura',
        'tipo_fractura', 'observaciones'
    ];

    for (const f of fields) {
        const valA = (a[f] === null || a[f] === undefined) ? '' : String(a[f]).trim();
        const valB = (b[f] === null || b[f] === undefined) ? '' : String(b[f]).trim();
        if (valA !== valB) {
            return false;
        }
    }
    return true;
}

export function applyLitoCascade(key: string, val: any, row: any) {
    const r = { ...row, [key]: val };

    if (key === "litologia_1") {
        r.litologia_2 = "";
        r.litologia_3 = "";
        if (val) {
            const matches = LITHOLOGY_CLASSIFICATION.filter(item => item.unidad === val);
            if (matches.length > 0) {
                const uniqueL2 = Array.from(new Set(matches.map(m => m.litologia)));
                if (uniqueL2.length === 1) {
                    r.litologia_2 = uniqueL2[0];
                    const matchesL2 = matches.filter(m => m.litologia === uniqueL2[0]);
                    const uniqueL3 = Array.from(new Set(matchesL2.map(m => m.codigo)));
                    if (uniqueL3.length === 1) {
                        r.litologia_3 = uniqueL3[0];
                    }
                }
            }
        }
    } else if (key === "litologia_2") {
        r.litologia_3 = "";
        if (val) {
            const matches = LITHOLOGY_CLASSIFICATION.filter(
                item => item.unidad === r.litologia_1 && item.litologia === val
            );
            if (matches.length > 0) {
                const uniqueL3 = Array.from(new Set(matches.map(m => m.codigo)));
                if (uniqueL3.length === 1) {
                    r.litologia_3 = uniqueL3[0];
                }
            }
        }
    }

    const res = resolveLithologyCascade(r.litologia_1, r.litologia_2, r.litologia_3, null);
    r.factor_conversion_k = res.k;
    r.tipo_litologico = res.clase;

    return r;
}

export function normalizeCeldaCode(celda: string): string {
    if (!celda) return "";
    const raw = celda.trim().toUpperCase();
    const matches = raw.match(/[A-Z]+|[0-9]+/g);
    if (!matches) return raw;

    const normalizedSegments = matches.map(segment => {
        if (/^[0-9]+$/.test(segment)) {
            const parsed = parseInt(segment, 10);
            return isNaN(parsed) ? segment : String(parsed);
        }
        return segment;
    });

    let result = "";
    normalizedSegments.forEach((seg, idx) => {
        if (idx === 0) {
            result += seg;
        } else {
            const prev = normalizedSegments[idx - 1];
            const isCurrentNum = /^[0-9]+$/.test(seg);
            const isPrevNum = /^[0-9]+$/.test(prev);

            if (isCurrentNum && isPrevNum) {
                result += "-" + seg;
            } else if (!isCurrentNum && isPrevNum) {
                result += "-" + seg;
            } else {
                result += seg;
            }
        }
    });

    return result;
}

export function getPltConstraints(key: string): { intDigits: number; decDigits: number } | null {
    if (key === "este") return { intDigits: 6, decDigits: 4 };
    if (key === "norte") return { intDigits: 7, decDigits: 3 };
    if (key === "elevacion") return { intDigits: 4, decDigits: 2 };
    if (key === "espesor_d") return { intDigits: 4, decDigits: 1 };
    if (key === "nivel") return { intDigits: 4, decDigits: 2 };

    const decCols = ["longitud_l", "ancho_w1", "ancho_w2", "fuerza_p", "factor_conversion_k", "campana"];
    if (decCols.includes(key)) {
        return { intDigits: 5, decDigits: 2 };
    }
    return null;
}

export const handlePltNumberLimit = (value: string, intDigits: number, decDigits: number): string => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return cleaned.slice(0, -1);

    let integerPart = parts[0];
    let decimalPart = parts[1];

    if (integerPart.length > intDigits) {
        integerPart = integerPart.slice(0, intDigits);
    }
    if (decimalPart !== undefined && decimalPart.length > decDigits) {
        decimalPart = decimalPart.slice(0, decDigits);
    }

    return decimalPart !== undefined ? `${integerPart}.${decimalPart}` : integerPart;
};

export const handleGridKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    const activeElement = e.currentTarget;
    const key = e.key;

    const allowedKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
    if (!allowedKeys.includes(key)) return;

    const td = activeElement.closest("td");
    const tr = activeElement.closest("tr");
    if (!td || !tr) return;

    const cellIndex = td.cellIndex;
    let targetInput: HTMLInputElement | HTMLSelectElement | null = null;

    if (key === "ArrowUp") {
        e.preventDefault();
        const prevTr = tr.previousElementSibling as HTMLTableRowElement | null;
        if (prevTr) {
            const targetTd = prevTr.cells[cellIndex];
            const inputEl = targetDataInput(targetTd);
            if (inputEl) {
                inputEl.focus();
                if (inputEl instanceof HTMLInputElement) {
                    inputEl.select();
                }
            }
        }
    } else if (key === "ArrowDown" || key === "Enter") {
        e.preventDefault();
        const nextTr = tr.nextElementSibling as HTMLTableRowElement | null;
        if (nextTr) {
            const targetTd = nextTr.cells[cellIndex];
            const inputEl = targetDataInput(targetTd);
            if (inputEl) {
                inputEl.focus();
                if (inputEl instanceof HTMLInputElement) {
                    inputEl.select();
                }
            }
        }
    } else if (key === "ArrowLeft") {
        let shouldMove = true;
        if (activeElement instanceof HTMLInputElement) {
            try {
                if (activeElement.selectionStart !== null && activeElement.selectionStart > 0) {
                    shouldMove = false;
                }
            } catch {
                // Safe
            }
        }
        if (shouldMove) {
            let prevTd = td.previousElementSibling as HTMLTableCellElement | null;
            while (prevTd) {
                const input = prevTd.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
                if (input) {
                    e.preventDefault();
                    targetInput = input;
                    break;
                }
                prevTd = prevTd.previousElementSibling as HTMLTableCellElement | null;
            }
        }
    } else if (key === "ArrowRight") {
        let shouldMove = true;
        if (activeElement instanceof HTMLInputElement) {
            try {
                if (activeElement.selectionStart !== null && activeElement.selectionEnd !== activeElement.value.length) {
                    shouldMove = false;
                }
            } catch {
                // Safe
            }
        }
        if (shouldMove) {
            let nextTd = td.nextElementSibling as HTMLTableCellElement | null;
            while (nextTd) {
                const input = nextTd.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
                if (input) {
                    e.preventDefault();
                    targetInput = input;
                    break;
                }
                nextTd = nextTd.nextElementSibling as HTMLTableCellElement | null;
            }
        }
    }

    if (targetInput) {
        targetInput.focus();
        if (targetInput instanceof HTMLInputElement && targetInput.type !== "date") {
            targetInput.select();
        }
    }
};

const targetDataInput = (td: HTMLTableCellElement | null): HTMLInputElement | HTMLSelectElement | null => {
    if (!td) return null;
    return td.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
};

export const getCellClassName = (c: any, val: any) => {
    const base = "border-r border-b border-navy-800 text-xs px-2 min-h-[34px] flex items-center select-text font-normal text-center justify-center leading-none";

    if (c.key === "is_mpa" || c.key === "is_50") {
        return `${base} outline outline-1 outline-offset-[-2px] outline-dashed outline-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold justify-center`;
    }

    if (c.computed) {
        if (c.key === "muestra_valida_longitud" || c.key === "muestra_valida_ancho") {
            if (val === "SÍ") return `${base} text-emerald-400 font-bold bg-emerald-500/5 justify-center`;
            if (val === "NO") return `${base} text-rose-400 font-bold bg-rose-500/5 justify-center`;
            return `${base} text-slate-500 italic bg-navy-950/10 justify-center`;
        }
        if (c.key === "resistencia_isrm" && val) {
            const isrmColors: Record<string, string> = {
                r0: "text-rose-400 font-bold",
                r1: "text-orange-400 font-bold",
                r2: "text-amber-400 font-bold",
                r3: "text-yellow-400 font-bold",
                r4: "text-emerald-400 font-bold",
                r5: "text-cyan-400 font-extrabold",
                r6: "text-blue-400 font-extrabold",
            };
            return `${base} ${isrmColors[val.toLowerCase()] || "text-slate-400"} justify-center`;
        }

        return `${base} outline outline-1 outline-offset-[-2px] outline-dashed outline-indigo-500/35 bg-indigo-500/[0.03] text-indigo-300 font-semibold`;
    }

    return `${base} text-slate-300 font-normal`;
};

export const formatCellValue = (val: any, c: any) => {
    if (val === null || val === undefined || val === "") return "";
    if (c.type === "decimal" && typeof val === "number") {
        if (c.key === "fuerza_p") return val.toFixed(3);
        if (["diametro_equivalente", "f", "is_mpa", "is_50", "este", "norte"].includes(c.key)) return val.toFixed(4);
        if (["ucs", "factor_conversion_k", "ancho_w", "espesor_d", "longitud_l", "ancho_w1", "ancho_w2", "elevacion", "nivel"].includes(c.key)) return val.toFixed(2);
        return val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
    }
    return String(val);
};

export const normalizeTipoLitologico = (val: string): string => {
    if (!val || String(val).trim() === "") return "";
    const s = String(val || "").trim().toLowerCase();
    if (s.includes("intrusiv") || s.includes("pluton") || s.includes("volcan")) return "INTRUSIVOS";
    if (s.includes("sedimentar") || s.includes("caliz")) return "SEDIMENTARIOS";
    if (s.includes("metamorf") || s.includes("marmor") || s.includes("skarn")) return "METAMORFICAS";
    if (s.includes("brecha")) return "BRECHAS";
    if (s.includes("endoskarn")) return "ENDOSKARN";
    return "";
};