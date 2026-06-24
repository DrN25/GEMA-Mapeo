import {
    STRUCTURE_CATALOG,
    RELLENO_CATALOG,
    ALTERACION_CATALOG,
    FORMA_CATALOG,
} from '../utils/catalogData';

export interface ColumnConfig<T = any> {
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'date';
    width: number;
    options?: { value: any; label: string }[]; // Opciones tipadas
    isComputed?: boolean;          // Celda de solo lectura
    precision?: number;            // Cantidad de decimales permitidos
    required?: boolean;            // Requerido por QA/QC
    range?: [number, number];      // Rango de entrada física segura [Min, Max]
    formulaId?: string;            // ID para tooltips matemáticos
    getFormulaParams?: (row: T) => Record<string, any>;
    formatOnBlur?: (val: any) => string; // Formateador visual al perder foco
    customStyleClass?: string;     // Clase CSS de diseño personalizado
}

// Helper visual para clasificar rangos de abertura de discontinuidades
const getAberturaClase = (val: number | undefined | null): string => {
    if (val === undefined || val === null || val === -1) return '';
    if (val <= 0) return 'Ninguna';
    if (val < 0.1) return 'Muy cerrada';
    if (val <= 1.0) return 'Cerrada';
    if (val <= 5.0) return 'Mod. abierta';
    return 'Abierta';
};

// Abreviaciones para el selector de alteración visual
const ALTERACION_ABBR: Record<string, string> = {
    f: 'Fresca',
    d: 'Déb. Met.',
    m: 'Mod. Met.',
    a: 'Alt. Met.',
    c: 'Comp. Met.',
    s: 'Suelo Res.'
};

export const DISCON_COLUMNS: ColumnConfig[] = [
    { key: 'distancia', label: 'Dist Est. (m)', type: 'number', width: 85, precision: 0 },
    { key: 'dip', label: 'Dip (°)', type: 'number', width: 80, precision: 2, range: [0, 90] },
    { key: 'dip_dir', label: 'DipDir (°)', type: 'number', width: 96, precision: 2, range: [0, 359] },
    {
        key: 'tipo_estructura',
        label: 'Tipo Estruc.',
        type: 'select',
        width: 96,
        options: Object.keys(STRUCTURE_CATALOG).map(code => ({ value: code, label: code }))
    },
    { key: 'n_estructuras', label: 'Cant (n)', type: 'number', width: 80, precision: 0, range: [1, 999] },
    {
        key: 'abertura',
        label: 'Abert (mm)',
        type: 'number',
        width: 144,
        precision: 1,
        formatOnBlur: (val) => val !== undefined && val !== -1 ? `${val.toFixed(1).replace('.', ',')} (${getAberturaClase(val)})` : ''
    },
    {
        key: 'espesor',
        label: 'Espes (mm)',
        type: 'number',
        width: 96,
        precision: 1,
        formatOnBlur: (val) => val !== undefined && val !== -1 ? val.toFixed(1) : ''
    },
    { key: 'continuidad', label: 'Cont (m)', type: 'number', width: 96, precision: 2, range: [0, 100] },
    {
        key: 'espaciamiento',
        label: 'Espac (m)',
        type: 'number',
        width: 96,
        precision: 2,
        formatOnBlur: (val) => val !== undefined && val !== -1 ? val.toFixed(2) : ''
    },
    {
        key: 'extremos_visibles',
        label: 'Ext Vis',
        type: 'select',
        width: 96,
        options: [
            { value: 0, label: '0' },
            { value: 1, label: '1' },
            { value: 2, label: '2' }
        ]
    },
    {
        key: 'terminacion',
        label: 'Term',
        type: 'select',
        width: 80,
        options: [
            { value: 0, label: '0' },
            { value: 1, label: '1' },
            { value: 2, label: '2' },
            { value: 3, label: '3' }
        ]
    },
    {
        key: 'relleno1',
        label: 'Relleno 1',
        type: 'select',
        width: 128,
        options: Object.keys(RELLENO_CATALOG).map(code => ({ value: code, label: code }))
    },
    {
        key: 'relleno2',
        label: 'Relleno 2',
        type: 'select',
        width: 128,
        options: Object.keys(RELLENO_CATALOG).map(code => ({ value: code, label: code }))
    },

    // Columnas calculadas de Relleno Individual
    { key: 'r1_89', label: 'V. R1', type: 'number', width: 80, isComputed: true, formulaId: 'rel_single_r89', getFormulaParams: (row) => ({ code: row.relleno1, thickness: row.espesor }) },
    { key: 'r2_89', label: 'V. R2', type: 'number', width: 80, isComputed: true, formulaId: 'rel_single_r89', getFormulaParams: (row) => ({ code: row.relleno2, thickness: row.espesor }) },
    { key: 'r1_76', label: 'V. R1', type: 'number', width: 80, isComputed: true, formulaId: 'rel_single_r76', getFormulaParams: (row) => ({ code: row.relleno1, thickness: row.espesor }) },
    { key: 'r2_76', label: 'V. R2', type: 'number', width: 80, isComputed: true, formulaId: 'rel_single_r76', getFormulaParams: (row) => ({ code: row.relleno2, thickness: row.espesor }) },

    { key: 'jrc', label: 'JRC', type: 'number', width: 80, precision: 0, range: [1, 20] },
    { key: 'rugosidad', label: 'Rugosidad', type: 'number', width: 144, precision: 0, range: [1, 9] },
    {
        key: 'forma',
        label: 'Forma',
        type: 'select',
        width: 80,
        options: Object.keys(FORMA_CATALOG).map(code => ({ value: code, label: code }))
    },
    {
        key: 'alteracion',
        label: 'Alteración',
        type: 'select',
        width: 128,
        options: Object.keys(ALTERACION_CATALOG).map(code => ({ value: code, label: `${code} (${ALTERACION_ABBR[code] || code})` }))
    },

    // Condición RMR'89
    { key: 'altR89', label: 'Alt', type: 'number', width: 80, isComputed: true, formulaId: 'alt_r89', getFormulaParams: (row) => ({ code: row.alteracion }) },
    { key: 'relR89', label: 'Rel', type: 'number', width: 80, isComputed: true, formulaId: 'rel_r89', getFormulaParams: (row) => ({ r1: row.r1_89, r2: row.r2_89 }) },
    { key: 'contR89', label: 'Cont', type: 'number', width: 80, isComputed: true, formulaId: 'cont_r89', getFormulaParams: (row) => ({ value: row.continuidad }) },
    { key: 'abR89', label: 'Aber', type: 'number', width: 80, isComputed: true, formulaId: 'aber_r89', getFormulaParams: (row) => ({ value: row.abertura }) },
    { key: 'rugR89', label: 'Rug', type: 'number', width: 80, isComputed: true, formulaId: 'rug_r89', getFormulaParams: (row) => ({ value: row.rugosidad }) },
    { key: 'totalR89', label: 'Val', type: 'number', width: 80, isComputed: true, formulaId: 'total_cond_r89', getFormulaParams: (row) => ({ alt: row.altR89, rel: row.relR89, cont: row.contR89, aber: row.abR89, rug: row.rugR89 }), customStyleClass: 'bg-pink-500/10 text-pink-300 font-black outline-pink-500/30' },

    // Condición RMR'76
    { key: 'altR76', label: 'Alt', type: 'number', width: 80, isComputed: true, formulaId: 'alt_r76', getFormulaParams: (row) => ({ code: row.alteracion }) },
    { key: 'relR76', label: 'Rel', type: 'number', width: 80, isComputed: true, formulaId: 'rel_r76', getFormulaParams: (row) => ({ r1: row.r1_76, r2: row.r2_76 }) },
    { key: 'contR76', label: 'Cont', type: 'number', width: 80, isComputed: true, formulaId: 'cont_r76', getFormulaParams: (row) => ({ value: row.continuidad }) },
    { key: 'abR76', label: 'Aber', type: 'number', width: 80, isComputed: true, formulaId: 'aber_r76', getFormulaParams: (row) => ({ value: row.abertura }) },
    { key: 'rugR76', label: 'Rug', type: 'number', width: 80, isComputed: true, formulaId: 'rug_r76', getFormulaParams: (row) => ({ value: row.rugosidad }) },
    { key: 'totalR76', label: 'Val', type: 'number', width: 80, isComputed: true, formulaId: 'total_cond_r76', getFormulaParams: (row) => ({ alt: row.altR76, rel: row.relR76, cont: row.contR76, aber: row.abR76, rug: row.rugR76 }), customStyleClass: 'bg-amber-500/10 text-amber-300 font-black outline-amber-500/30' }
];