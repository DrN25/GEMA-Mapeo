import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

export const COLUMN_NAMES = {
    distancia: "Distancia Estructura (m)",
    dip: "Dip (°)",
    dip_dir: "DipDir (°)",
    tipo_estructura: "Tipo de Estructura",
    n_estructuras: "Cantidad (n)",
    abertura: "Abertura (mm)",
    espesor: "Espesor (mm)",
    continuidad: "Continuidad (m)",
    espaciamiento: "Espaciamiento (m)",
    extremos_visibles: "Ext Vis",
    terminacion: "Term",
    relleno1: "Relleno 1",
    relleno2: "Relleno 2",
    jrc: "JRC",
    rugosidad: "Rugosidad",
    forma: "Forma",
    alteracion: "Alteración",

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

    condicion_agua: "Condición de Agua",
    val_agua_r89: "Valor Agua (R89)",
    val_agua_r76: "Valor Agua (R76)",
    resistencia_ucs: "Resistencia",
    val_resist_r89: "Val Resist. (R89)",
    val_resist_r76: "Val Resist. (R76)",
    rqd_rating_r89: "RQD Valor (R89)",
    rqd_rating_r76: "RQD Valor (R76)",
    rqd_est: "RQD (%)",
    jv: "Frec. Frac. (Jv)",
    block_size: "Tam. Bloque",
    global_spacing: "Espac. Prom",
    spacing_rating_r89: "Espac. Val (R89)",
    spacing_rating_r76: "Espac. Val (R76)",
    condicion_rating_r89: "Val ConDisc (R89)",
    condicion_rating_r76: "Val ConDisc (R76)",
    rmr_89: "RMR FINAL (89)",
    rmr_76: "RMR FINAL (76)",
    ucs_mpa: "UCS (MPa)",
    is50_mpa: "is50 (MPa)",
    espac_prom: "Espaciamiento Promedio",

    // Nuevas columnas de Ensayos PLT
    ancho_w: "Ancho W (cm)",
    muestra_valida_longitud: "Muestra Válida - L",
    muestra_valida_ancho: "Muestra Válida - W",
    diametro_equivalente: "Diámetro Equivalente De (cm)",
    f: "Factor de Corrección f",
    is_mpa: "Is (MPa)",
    is_50: "Is(50) (MPa)",
    factor_conversion_k: "Factor K",
    ucs: "UCS (MPa)",
    resistencia_isrm: "Resist. ISRM",
    denominacion_isrm: "Denominación ISRM"
};

export interface FormulaDef {
    title: string;
    equation: string;
    description: string;
    inputs: string[];
    calcExplanation?: (params?: Record<string, any>) => string;
}

export const FORMULA_DEFS: Record<string, FormulaDef> = {
    rel_single_r89: {
        title: `Rating Relleno en RMR89`,
        equation: `Puntaje = Función(${COLUMN_NAMES.relleno1}, ${COLUMN_NAMES.espesor})`,
        description: "Determina el puntaje asignado al relleno según su mineralogía/dureza. Si el espesor es ≥ 5mm, se aplica la reducción 'gt5' del catálogo de rellenos.",
        inputs: [COLUMN_NAMES.relleno1, COLUMN_NAMES.espesor],
        calcExplanation: (params) => {
            if (!params) return "";
            const { code, thickness, val } = params;
            return `Código: "${code || '—'}" | Espesor: ${thickness !== -1 && thickness !== undefined ? `${thickness} mm` : '—'} ➔ Rating: ${val ?? '—'}`;
        }
    },
    rel_single_r76: {
        title: `Rating Relleno en RMR76`,
        equation: `Puntaje = Función(${COLUMN_NAMES.relleno1}, ${COLUMN_NAMES.espesor})`,
        description: "Determina el puntaje correspondiente a RMR'76 basado en el catálogo de rellenos y la potencia del mismo.",
        inputs: [COLUMN_NAMES.relleno1, COLUMN_NAMES.espesor],
        calcExplanation: (params) => {
            if (!params) return "";
            const { code, thickness, val } = params;
            return `Código: "${code || '—'}" | Espesor: ${thickness !== -1 && thickness !== undefined ? `${thickness} mm` : '—'} ➔ Rating: ${val ?? '—'}`;
        }
    },
    alt_r89: {
        title: `Rating ${COLUMN_NAMES.alt_r89}`,
        equation: `Puntaje = Catálogo(${COLUMN_NAMES.alteracion})`,
        description: "Asigna puntaje directo según la clasificación de meteorización/alteración (Fresca, Débil, Moderada, Alta, Completa, Suelo residual).",
        inputs: [COLUMN_NAMES.alteracion],
        calcExplanation: (params) => `Alteración seleccionada: "${params?.code || '—'}" ➔ Rating: ${params?.val ?? '—'}`
    },
    alt_r76: {
        title: `Rating ${COLUMN_NAMES.alt_r76}`,
        equation: `Puntaje = Catálogo(${COLUMN_NAMES.alteracion})`,
        description: "Asigna puntaje para RMR'76 según la meteorización observada en las paredes.",
        inputs: [COLUMN_NAMES.alteracion],
        calcExplanation: (params) => `Alteración seleccionada: "${params?.code || '—'}" ➔ Rating: ${params?.val ?? '—'}`
    },
    rel_r89: {
        title: `Rating ${COLUMN_NAMES.rel_r89}`,
        equation: `Rating = min(Rating(R1), Rating(R2))`,
        description: "Criterio conservador: toma el puntaje más desfavorable (el menor valor) entre el Relleno 1 y el Relleno 2.",
        inputs: [COLUMN_NAMES.relleno1, COLUMN_NAMES.relleno2],
        calcExplanation: (params) => {
            if (!params) return "";
            const { r1, r2 } = params;
            const minVal = Math.min(r1 ?? 99, r2 ?? 99);
            return `min(R1: ${r1 ?? '—'}, R2: ${r2 ?? '—'}) = ${minVal === 99 ? '—' : minVal}`;
        }
    },
    rel_r76: {
        title: `Rating ${COLUMN_NAMES.rel_r76}`,
        equation: `Rating = min(Rating(R1), Rating(R2))`,
        description: "Rating de relleno combinado correspondiente a RMR'76.",
        inputs: [COLUMN_NAMES.relleno1, COLUMN_NAMES.relleno2],
        calcExplanation: (params) => {
            if (!params) return "";
            const { r1, r2 } = params;
            const minVal = Math.min(r1 ?? 99, r2 ?? 99);
            return `min(R1: ${r1 ?? '—'}, R2: ${r2 ?? '—'}) = ${minVal === 99 ? '—' : minVal}`;
        }
    },
    cont_r89: {
        title: `Rating ${COLUMN_NAMES.cont_r89}`,
        equation: `Rating = Clasificación(${COLUMN_NAMES.continuidad})`,
        description: "Intervalos Bieniawski: <1m = 6 | 1-3m = 4 | 3-10m = 2 | 10-20m = 1 | >20m = 0",
        inputs: [COLUMN_NAMES.continuidad],
        calcExplanation: (params) => `Continuidad actual: ${params?.value !== -1 && params?.value !== undefined ? `${params.value} m` : '—'} ➔ Rating: ${params?.val ?? '—'}`
    },
    cont_r76: {
        title: `Rating ${COLUMN_NAMES.cont_r76}`,
        equation: `Rating = Clasificación(${COLUMN_NAMES.continuidad})`,
        description: "Intervalos RMR76: <1m = 5 | 1-3m = 4 | 3-10m = 3 | 10-20m = 1 | >20m = 0",
        inputs: [COLUMN_NAMES.continuidad],
        calcExplanation: (params) => `Continuidad actual: ${params?.value !== -1 && params?.value !== undefined ? `${params.value} m` : '—'} ➔ Rating: ${params?.val ?? '—'}`
    },
    aber_r89: {
        title: `Rating ${COLUMN_NAMES.aber_r89}`,
        equation: `Rating = Clasificación(${COLUMN_NAMES.abertura})`,
        description: "Intervalos Bieniawski: 0mm = 6 | <0.1mm = 5 | 0.1-1.0mm = 3 | 1.0-5.0mm = 1 | >5.0mm = 0",
        inputs: [COLUMN_NAMES.abertura],
        calcExplanation: (params) => `Abertura actual: ${params?.value !== -1 && params?.value !== undefined ? `${params.value} mm` : '—'} ➔ Rating: ${params?.val ?? '—'}`
    },
    aber_r76: {
        title: `Rating ${COLUMN_NAMES.aber_r76}`,
        equation: `Rating = Clasificación(${COLUMN_NAMES.abertura})`,
        description: "Intervalos RMR76: 0mm = 5 | <0.1mm = 4 | 0.1-1.0mm = 3 | 1.0-5.0mm = 1 | >5.0mm = 0",
        inputs: [COLUMN_NAMES.abertura],
        calcExplanation: (params) => `Abertura actual: ${params?.value !== -1 && params?.value !== undefined ? `${params.value} mm` : '—'} ➔ Rating: ${params?.val ?? '—'}`
    },
    rug_r89: {
        title: `Rating ${COLUMN_NAMES.rug_r89}`,
        equation: `Rating = Catálogo(${COLUMN_NAMES.rugosidad})`,
        description: "Puntaje correspondiente al perfil de rugosidad de junta (1 al 9, desde muy rugosa hasta cizallada).",
        inputs: [COLUMN_NAMES.rugosidad],
        calcExplanation: (params) => `Perfil rugosidad: ${params?.value !== -1 && params?.value !== undefined ? params.value : '—'} ➔ Rating: ${params?.val ?? '—'}`
    },
    rug_r76: {
        title: `Rating ${COLUMN_NAMES.rug_r76}`,
        equation: `Rating = Catálogo(${COLUMN_NAMES.rugosidad})`,
        description: "Puntaje correspondiente al perfil de rugosidad para RMR'76.",
        inputs: [COLUMN_NAMES.rugosidad],
        calcExplanation: (params) => `Perfil rugosidad: ${params?.value !== -1 && params?.value !== undefined ? params.value : '—'} ➔ Rating: ${params?.val ?? '—'}`
    },
    total_cond_r89: {
        title: `Total Condición de Juntas (R89)`,
        equation: `Valor = min(30, Alt + Rel + Cont + Aber + Rug)`,
        description: "Suma los ratings de Alteración, Relleno Combinado, Continuidad, Abertura y Rugosidad. El total se satura a un límite máximo de 30 según Bieniawski.",
        inputs: [COLUMN_NAMES.alt_r89, COLUMN_NAMES.rel_r89, COLUMN_NAMES.cont_r89, COLUMN_NAMES.aber_r89, COLUMN_NAMES.rug_r89],
        calcExplanation: (params) => {
            if (!params) return "";
            const { alt, rel, cont, aber, rug } = params;
            const sum = (alt || 0) + (rel || 0) + (cont || 0) + (aber || 0) + (rug || 0);
            return `Suma: ${alt || 0} + ${rel || 0} + ${cont || 0} + ${aber || 0} + ${rug || 0} = ${sum} ➔ Satura a: ${Math.min(30, sum)}`;
        }
    },
    total_cond_r76: {
        title: `Total Condición de Juntas (R76)`,
        equation: `Valor = min(25, Alt + Rel + Cont + Aber + Rug)`,
        description: "Suma los ratings individuales de condición de juntas saturando el total a un límite máximo de 25 según Bieniawski.",
        inputs: [COLUMN_NAMES.alt_r76, COLUMN_NAMES.rel_r76, COLUMN_NAMES.cont_r76, COLUMN_NAMES.aber_r76, COLUMN_NAMES.rug_r76],
        calcExplanation: (params) => {
            if (!params) return "";
            const { alt, rel, cont, aber, rug } = params;
            const sum = (alt || 0) + (rel || 0) + (cont || 0) + (aber || 0) + (rug || 0);
            return `Suma: ${alt || 0} + ${rel || 0} + ${cont || 0} + ${aber || 0} + ${rug || 0} = ${sum} ➔ Satura a: ${Math.min(25, sum)}`;
        }
    },
    val_agua_r89: {
        title: `Rating ${COLUMN_NAMES.val_agua_r89}`,
        equation: `Rating = Catálogo(${COLUMN_NAMES.condicion_agua})`,
        description: "Asigna el rating de presencia de agua: Seco = 15 | Húmedo = 10 | Mojado = 7 | Goteando = 4 | Fluyendo = 0.",
        inputs: [COLUMN_NAMES.condicion_agua],
        calcExplanation: (params) => `Condición: "${params?.code || '—'}" ➔ Rating: ${params?.val ?? '—'}`
    },
    val_agua_r76: {
        title: `Rating ${COLUMN_NAMES.val_agua_r76}`,
        equation: `Rating = Catálogo(${COLUMN_NAMES.condicion_agua})`,
        description: "Asigna el rating de presencia de agua: Seco/Húmedo = 10 | Mojado = 7 | Goteando = 4 | Fluyendo = 0.",
        inputs: [COLUMN_NAMES.condicion_agua],
        calcExplanation: (params) => `Condición: "${params?.code || '—'}" ➔ Rating: ${params?.val ?? '—'}`
    },
    resistencia_ucs: {
        title: `Código de ${COLUMN_NAMES.resistencia_ucs}`,
        equation: `Clase = Catálogo(${COLUMN_NAMES.resistencia_ucs})`,
        description: "Determina el código de resistencia a partir de la estimación manual de campo en rango R0 a R6.",
        inputs: [COLUMN_NAMES.resistencia_ucs],
        calcExplanation: (params) => `Código ISRM: "${params?.val ?? '—'}"`
    },
    val_resist_r89: {
        title: `Rating Resistencia (R89)`,
        equation: `Rating = (Discreto(UCS) + Continuo(UCS)) / 2`,
        description: "Determina el rating combinando la tabla discreta 4.1 de Bieniawski y la curva continua del Ábaco (interpolación PCHIP) en base al UCS en MPa.",
        inputs: [COLUMN_NAMES.resistencia_ucs, COLUMN_NAMES.ucs_mpa],
        calcExplanation: (params) => {
            if (!params) return "";
            const { ucs, discreto, continuo, val } = params;
            if (ucs !== undefined && ucs > 0) {
                return `UCS: ${ucs.toFixed(1)} MPa ➔ (Discreto: ${discreto ?? '—'} + Continuo: ${continuo !== undefined ? continuo.toFixed(2) : '—'}) / 2 = ${val !== undefined ? val.toFixed(2) : '—'}`;
            }
            return `Grado: "${params?.code || '—'}" ➔ Rating: ${params?.val ?? '—'}`;
        }
    },
    val_resist_r76: {
        title: `Rating Resistencia (R76)`,
        equation: `Rating = Catálogo(${COLUMN_NAMES.resistencia_ucs})`,
        description: "Determina el rating de resistencia geomecánica en base al catálogo estándar de resistencia estimada para RMR'76.",
        inputs: [COLUMN_NAMES.resistencia_ucs],
        calcExplanation: (params) => `Grado: "${params?.code || '—'}" ➔ Rating: ${params?.val ?? '—'}`
    },
    rqd_est: {
        title: `Porcentaje de ${COLUMN_NAMES.rqd_est}`,
        equation: `RQD% = max(0, min(100, 115 - 3.3 * Jv))`,
        description: "Cálculo empírico según fórmula de Palmström. Permite estimar el RQD (%) a partir del espaciamiento volumétrico de juntas (Jv).",
        inputs: [COLUMN_NAMES.jv],
        calcExplanation: (params) => `Jv: ${params?.jv !== undefined ? params.jv.toFixed(4) : '—'} ➔ 115 - 3.3 * ${params?.jv?.toFixed(4) || '0'} = ${params?.val?.toFixed(2) ?? '—'}%`
    },
    rqd_rating_r89: {
        title: `Rating RQD (R89)`,
        equation: `Rating = (Discreto(RQD) + Continuo(RQD)) / 2`,
        description: "Determina el rating combinando la tabla discreta (Bieniawski) y la curva continua del Ábaco (interpolación CubicSpline).",
        inputs: [COLUMN_NAMES.rqd_est],
        calcExplanation: (params) => {
            if (!params) return "";
            const { rqd, discreto, continuo, val } = params;
            if (rqd !== undefined) {
                return `RQD: ${rqd.toFixed(2)}% ➔ (Discreto: ${discreto ?? '—'} + Continuo: ${continuo !== undefined ? continuo.toFixed(2) : '—'}) / 2 = ${val !== undefined ? val.toFixed(2) : '—'}`;
            }
            return `RQD: ${params?.rqd !== undefined ? `${params.rqd.toFixed(2)}%` : '—'} ➔ Rating: ${params?.val ?? '—'}`;
        }
    },
    rqd_rating_r76: {
        title: `Rating RQD (R76)`,
        equation: `Rating = Umbral(RQD%)`,
        description: "Puntaje discreto de RMR'76 basado en el intervalo de RQD (<25% = 3 | <50% = 8 | <75% = 13 | <90% = 17 | >=90% = 20).",
        inputs: [COLUMN_NAMES.rqd_est],
        calcExplanation: (params) => `RQD: ${params?.rqd !== undefined ? `${params.rqd.toFixed(2)}%` : '—'} ➔ Rating: ${params?.val ?? '—'}`
    },
    jv: {
        title: `Índice Volumétrico ${COLUMN_NAMES.jv}`,
        equation: `Jv = Σ(1 / S_promedio_familia_i)`,
        description: "Estima el número de discontinuidades por metro cúbico sumando la inversa del espaciamiento promedio real de todas las familias mapeadas.",
        inputs: [COLUMN_NAMES.espac_prom],
        calcExplanation: (params) => `Espaciamientos por Familia mapeados. Jv total calculado: ${params?.val !== undefined ? params.val.toFixed(4) : '—'}`
    },
    block_size: {
        title: `${COLUMN_NAMES.block_size} Estimado (m³)`,
        equation: `V_bloque = S_global ^ 3`,
        description: "Estima de forma simplificada el tamaño tridimensional del bloque de roca intacta elevando al cubo el espaciamiento global promedio.",
        inputs: [COLUMN_NAMES.global_spacing],
        calcExplanation: (params) => `S_global: ${params?.global_spacing || '0'} m ➔ (${params?.global_spacing || '0'} m)³ = ${params?.val?.toFixed(4) ?? '—'} m³`
    },
    global_spacing: {
        title: `${COLUMN_NAMES.global_spacing} (Ponderado)`,
        equation: `S_global = Σ(Espacamiento_i * n_i) / Σ(n_i)`,
        description: "Fórmula de espaciamiento global ponderada utilizando la cantidad de estructuras (n) observadas en cada scanline como factor de ponderación.",
        inputs: [COLUMN_NAMES.espaciamiento, COLUMN_NAMES.n_estructuras],
        calcExplanation: (params) => `Promedio global ponderado calculado. Espaciamiento: ${params?.val ?? '—'} m`
    },
    spacing_rating_r89: {
        title: `Rating Espaciamiento (R89)`,
        equation: `Rating = Umbral(S_global)`,
        description: "Asigna puntaje al espaciamiento según Bieniawski 89: <0.06m = 5 | 0.06-0.2m = 8 | 0.2-0.6m = 10 | 0.6-2.0m = 15 | >2.0m = 20.",
        inputs: [COLUMN_NAMES.global_spacing],
        calcExplanation: (params) => `Espaciamiento: ${params?.spacing !== undefined ? `${params.spacing} m` : '—'} ➔ Rating: ${params?.val ?? '—'}`
    },
    spacing_rating_r76: {
        title: `Rating Espaciamiento (R76)`,
        equation: `Rating = Umbral(S_global)`,
        description: "Asigna puntaje según RMR'76: <0.05m = 5 | 0.05-0.3m = 10 | 0.3-1.0m = 20 | 1.0-3.0m = 25 | >3.0m = 30.",
        inputs: [COLUMN_NAMES.global_spacing],
        calcExplanation: (params) => `Espaciamiento: ${params?.spacing !== undefined ? `${params.spacing} m` : '—'} ➔ Rating: ${params?.val ?? '—'}`
    },
    condicion_rating_r89: {
        title: `Rating Condición Global (R89)`,
        equation: `Rating_Global = Σ(Condición_i * n_i) / Σ(n_i)`,
        description: "Suma ponderada de las condiciones individuales de cada discontinuidad multiplicada por su cantidad respectiva de estructuras (n).",
        inputs: [COLUMN_NAMES.val_r89, COLUMN_NAMES.n_estructuras],
        calcExplanation: (params) => `Promedio ponderado calculado ➔ Rating Global: ${params?.val ?? '—'}`
    },
    condicion_rating_r76: {
        title: `Rating Condición Global (R76)`,
        equation: `Rating_Global = Σ(Condición_i * n_i) / Σ(n_i)`,
        description: "Suma ponderada de las condiciones individuales según RMR'76 multiplicada por la cantidad de estructuras (n).",
        inputs: [COLUMN_NAMES.val_r76, COLUMN_NAMES.n_estructuras],
        calcExplanation: (params) => `Promedio ponderado calculado ➔ Rating Global: ${params?.val ?? '—'}`
    },
    rmr_89: {
        title: `RMR FINAL (Clasificación Bieniawski 1989)`,
        equation: `RMR'89 = Resist + RQD + Espac + Cond + Agua`,
        description: "Suma total de la valoración del macizo según Bieniawski (1989).",
        inputs: [COLUMN_NAMES.val_resist_r89, COLUMN_NAMES.rqd_rating_r89, COLUMN_NAMES.spacing_rating_r89, COLUMN_NAMES.condicion_rating_r89, COLUMN_NAMES.val_agua_r89],
        calcExplanation: (params) => {
            if (!params) return "";
            const { ucs, rqd, spacing, cond, water } = params;
            const sum = (ucs || 0) + (rqd || 0) + (spacing || 0) + (cond || 0) + (water || 0);
            return `${ucs || 0} (Resist) + ${rqd || 0} (RQD) + ${spacing || 0} (Espac) + ${cond || 0} (Cond) + ${water || 0} (Agua) = ${sum}`;
        }
    },
    rmr_76: {
        title: `RMR FINAL (Clasificación Bieniawski 1976)`,
        equation: `RMR'76 = Resist + RQD + Espac + Cond + Agua`,
        description: "Suma total de la valoración del macizo según Bieniawski (1976).",
        inputs: [COLUMN_NAMES.val_resist_r76, COLUMN_NAMES.rqd_rating_r76, COLUMN_NAMES.spacing_rating_r76, COLUMN_NAMES.condicion_rating_r76, COLUMN_NAMES.val_agua_r76],
        calcExplanation: (params) => {
            if (!params) return "";
            const { ucs, rqd, spacing, cond, water } = params;
            const sum = (ucs || 0) + (rqd || 0) + (spacing || 0) + (cond || 0) + (water || 0);
            return `${ucs || 0} (Resist) + ${rqd || 0} (RQD) + ${spacing || 0} (Espac) + ${cond || 0} (Cond) + ${water || 0} (Agua) = ${sum}`;
        }
    },

    // Ecuaciones de Ensayos PLT
    plt_ancho_w: {
        title: "Ancho W Promedio",
        equation: "W = (W1 + W2) / 2",
        description: "Calcula el ancho promedio a partir de las mediciones ortogonales W1 y W2 en centímetros.",
        inputs: ["Ancho W1 (cm)", "Ancho W2 (cm)"],
        calcExplanation: (params) => {
            if (!params) return "";
            const { w1, w2, val } = params;
            return `(${w1 ?? '—'} + ${w2 ?? '—'}) / 2 = ${val ?? '—'} cm`;
        }
    },
    plt_valida_long: {
        title: "Validez de Longitud de Muestra",
        equation: "Validez = (L ≥ D) ➔ SÍ / NO",
        description: "Estándar ISRM: la longitud L de la muestra debe ser igual o superior al espesor D para un ensayo válido de bloque irregular.",
        inputs: ["Longitud L (cm)", "Espesor D (cm)"],
        calcExplanation: (params) => {
            if (!params) return "";
            const { l, d, val } = params;
            return `L: ${l ?? '—'} ≥ D: ${d ?? '—'} ➔ ${val ?? '—'}`;
        }
    },
    plt_valida_ancho: {
        title: "Validez de Ancho de Muestra",
        equation: "Validez = (0.3 * W < D < W) ➔ SÍ / NO",
        description: "Estándar ISRM: la relación entre el espesor D y el ancho W de la muestra debe encontrarse en este intervalo óptimo.",
        inputs: ["Espesor D (cm)", "Ancho W (cm)"],
        calcExplanation: (params) => {
            if (!params) return "";
            const { d, w, val } = params;
            return `0.3 * W: ${(0.3 * (w || 0)).toFixed(2)} < D: ${d ?? '—'} < W: ${w ?? '—'} ➔ ${val ?? '—'}`;
        }
    },
    plt_diam_equiv: {
        title: "Diámetro Equivalente (De)",
        equation: "De = √(4 * D * W / π)",
        description: "Calcula el diámetro de núcleo equivalente para un bloque irregular de sección transversal rectangular.",
        inputs: ["Espesor D (cm)", "Ancho W (cm)"],
        calcExplanation: (params) => {
            if (!params) return "";
            const { d, w, val } = params;
            return `√(4 * ${d ?? '0'} * ${w ?? '0'} / π) = ${val ?? '—'} cm`;
        }
    },
    plt_f_factor: {
        title: "Factor de Corrección por Tamaño (f)",
        equation: "f = (De * 10 / 50) ^ 0.45",
        description: "Factor de corrección de escala estándar para normalizar el diámetro equivalente a la referencia de 50 mm.",
        inputs: [COLUMN_NAMES.diametro_equivalente],
        calcExplanation: (params) => {
            if (!params) return "";
            const { de, val } = params;
            return `(${de !== undefined ? (de * 10).toFixed(1) : '0'} / 50) ^ 0.45 = ${val ?? '—'}`;
        }
    },
    plt_is_mpa: {
        title: "Índice Carga Puntual Is (MPa)",
        equation: "Is = P * 1000 / (De * 10)²",
        description: "Índice de carga puntual no corregido en MPa calculado a partir de la fuerza de ruptura P (kN) y el diámetro equivalente.",
        inputs: ["Fuerza P (kN)", COLUMN_NAMES.diametro_equivalente],
        calcExplanation: (params) => {
            if (!params) return "";
            const { p, de, val } = params;
            return `${p ?? '0'} * 1000 / (${de !== undefined ? (de * 10).toFixed(1) : '0'})² = ${val ?? '—'} MPa`;
        }
    },
    plt_is50: {
        title: "Índice Carga Puntual Is(50)",
        equation: "Is(50) = Is * f",
        description: "Índice de resistencia corregido a la escala estándar de 50 mm mediante el factor f.",
        inputs: [COLUMN_NAMES.is_mpa, COLUMN_NAMES.f],
        calcExplanation: (params) => {
            if (!params) return "";
            const { isVal, f, val } = params;
            return `${isVal ?? '0'} * ${f ?? '0'} = ${val ?? '—'} MPa`;
        }
    },
    plt_ucs: {
        title: "UCS Estimado (MPa)",
        equation: "UCS = Is(50) * K",
        description: "Estima la resistencia a compresión uniaxial simple de la roca intacta mediante el factor de correlación K.",
        inputs: [COLUMN_NAMES.is_50, COLUMN_NAMES.factor_conversion_k],
        calcExplanation: (params) => {
            if (!params) return "";
            const { is50, k, val } = params;
            return `${is50 ?? '0'} * ${k ?? '0'} = ${val ?? '—'} MPa`;
        }
    },
    plt_isrm: {
        title: "Clasificación de Resistencia ISRM",
        equation: "Clasificación = Lookup(ISRM_TABLE, UCS)",
        description: "Clasifica la resistencia del macizo de roca intacta en los grados normalizados (R0 a R6) según el UCS estimado.",
        inputs: [COLUMN_NAMES.ucs],
        calcExplanation: (params) => `UCS: ${params?.ucs !== undefined ? params.ucs.toFixed(2) : '—'} ➔ ISRM: ${params?.val ?? '—'}`
    },
    utm_x_proj: {
        title: "Proyección UTM Este (X)",
        equation: "X = Distancia * sin(θ) + Este_FROM",
        description: "Calcula la coordenada Este (X) del plano de la discontinuidad proyectada a lo largo del scanline 3D.",
        inputs: ["Distancia", "Ángulo θ", "Este FROM"],
        calcExplanation: (params) => `X = ${params?.dist?.toFixed(3) ?? '—'} * sin(${params?.theta?.toFixed(2) ?? '—'}°) + ${params?.este_from?.toFixed(2) ?? '—'} = ${params?.val?.toFixed(4) ?? '—'}`
    },
    utm_y_proj: {
        title: "Proyección UTM Norte (Y)",
        equation: "Y = Distancia * cos(θ) + Norte_FROM",
        description: "Calcula la coordenada Norte (Y) de la discontinuidad proyectada.",
        inputs: ["Distancia", "Ángulo θ", "Norte FROM"],
        calcExplanation: (params) => `Y = ${params?.dist?.toFixed(3) ?? '—'} * cos(${params?.theta?.toFixed(2) ?? '—'}°) + ${params?.norte_from?.toFixed(2) ?? '—'} = ${params?.val?.toFixed(2) ?? '—'}`
    },
    utm_z_proj: {
        title: "Proyección UTM Cota (Z)",
        equation: "Z = Distancia * cos(θ) * sin(α) + Cota_FROM",
        description: "Calcula la cota o elevación (Z) de la discontinuidad proyectada.",
        inputs: ["Distancia", "Ángulo θ", "Ángulo α", "Cota FROM"],
        calcExplanation: (params) => `Z = ${params?.dist?.toFixed(3) ?? '—'} * cos(${params?.theta?.toFixed(2) ?? '—'}°) * sin(${params?.alpha?.toFixed(2) ?? '—'}°) + ${params?.cota_from?.toFixed(2) ?? '—'} = ${params?.val?.toFixed(6) ?? '—'}`
    },
    theta_angle: {
        title: "Ángulo de Proyección θ (Azimut Aparente)",
        equation: "θ = acot((Norte_TO - Norte_FROM) / (Este_TO - Este_FROM))",
        description: "Representa la dirección azimutal aparente en planta (ángulo horizontal) del scanline 3D calculado a partir de las coordenadas del extremo de inicio (FROM) y fin (TO).",
        inputs: ["Este (FROM/TO)", "Norte (FROM/TO)"],
        calcExplanation: (params) => {
            if (!params) return "";
            const { norte_to, norte_from, este_to, este_from, val } = params;
            const dy = (norte_to ?? 0) - (norte_from ?? 0);
            const dx = (este_to ?? 0) - (este_from ?? 0);
            return `θ = acot((${norte_to?.toFixed(2)} - ${norte_from?.toFixed(2)}) / (${este_to?.toFixed(2)} - ${este_from?.toFixed(2)})) = acot(${dy.toFixed(2)} / ${dx.toFixed(2)}) = ${val?.toFixed(6)}°`;
        }
    },
    alpha_angle: {
        title: "Ángulo de Proyección α (Plunge Aparente)",
        equation: "α = acot((Este_TO - Este_FROM) / (Cota_TO - Cota_FROM))",
        description: "Representa el plunge o inclinación vertical aparente del scanline 3D respecto al plano horizontal de referencia.",
        inputs: ["Este (FROM/TO)", "Cota (FROM/TO)"],
        calcExplanation: (params) => {
            if (!params) return "";
            const { este_to, este_from, cota_to, cota_from, val } = params;
            const dx = (este_to ?? 0) - (este_from ?? 0);
            const dz = (cota_to ?? 0) - (cota_from ?? 0);
            return `α = acot((${este_to?.toFixed(2)} - ${este_from?.toFixed(2)}) / (${cota_to?.toFixed(2)} - ${cota_from?.toFixed(2)})) = acot(${dx.toFixed(2)} / ${dz.toFixed(2)}) = ${val?.toFixed(6)}°`;
        }
    }
};

interface FormulaTooltipTriggerProps {
    children: React.ReactNode;
    formulaId: string;
    params?: Record<string, any>;
    position?: 'top' | 'bottom';
    className?: string;
    enabled?: boolean;
}

export const FormulaTooltipTrigger: React.FC<FormulaTooltipTriggerProps> = ({
    children,
    formulaId,
    params,
    position = 'top',
    className = "",
    enabled = true
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [coords, setCoords] = useState<DOMRect | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);

    const handleMouseEnter = () => {
        if (!enabled) return;
        if (triggerRef.current) {
            setCoords(triggerRef.current.getBoundingClientRect());
            setIsHovered(true);
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    useEffect(() => {
        if (!isHovered || !enabled) return;

        const updatePosition = () => {
            if (triggerRef.current) {
                setCoords(triggerRef.current.getBoundingClientRect());
            }
        };

        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isHovered, enabled]);

    const def = FORMULA_DEFS[formulaId];

    return (
        <span
            ref={triggerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`inline-block w-full ${className}`}
        >
            {children}
            {isHovered && coords && def && enabled && (
                <PortalTooltip coords={coords} def={def} params={params} position={position} />
            )}
        </span>
    );
};

interface PortalTooltipProps {
    coords: DOMRect;
    def: FormulaDef;
    params?: Record<string, any>;
    position: 'top' | 'bottom';
}

const PortalTooltip: React.FC<PortalTooltipProps> = ({ coords, def, params, position }) => {
    const [tooltipSize, setTooltipSize] = useState({ width: 320, height: 210 });
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (tooltipRef.current) {
            const rect = tooltipRef.current.getBoundingClientRect();
            setTooltipSize({
                width: rect.width || 320,
                height: rect.height || 210
            });
        }
    }, [def, params]);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16;

    let left = coords.left + coords.width / 2;

    const halfW = tooltipSize.width / 2;
    if (left - halfW < margin) {
        left = halfW + margin;
    } else if (left + halfW > viewportWidth - margin) {
        left = viewportWidth - halfW - margin;
    }

    let finalPosition = position;
    if (finalPosition === 'top' && coords.top - tooltipSize.height - margin < 0) {
        finalPosition = 'bottom';
    } else if (finalPosition === 'bottom' && coords.bottom + tooltipSize.height + margin > viewportHeight) {
        finalPosition = 'top';
    }

    const top = finalPosition === 'top'
        ? coords.top - 6
        : coords.bottom + 6;

    const transformVal = finalPosition === 'top'
        ? 'translate(-50%, -100%)'
        : 'translate(-50%, 0)';

    return ReactDOM.createPortal(
        <div
            ref={tooltipRef}
            style={{
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                transform: transformVal,
                zIndex: 9999,
                width: '320px'
            }}
            className="p-4 bg-slate-950/95 border border-indigo-500/40 rounded-xl shadow-2xl backdrop-blur-md text-left select-none animate-fade-in text-xs space-y-3 pointer-events-none"
        >
            <div className="flex items-center justify-between border-b border-navy-850 pb-1.5">
                <span className="font-black text-indigo-400 uppercase tracking-widest text-[9px]">
                    Ecuación Geomecánica
                </span>
                <span className="text-[9px] font-extrabold bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Auto
                </span>
            </div>

            <h4 className="text-slate-100 font-bold text-xs uppercase tracking-wide leading-tight">
                {def.title}
            </h4>

            <div className="bg-navy-900/60 border border-navy-800/80 rounded-lg p-2 font-mono text-[10px] text-cyan-400 font-semibold break-words">
                {def.equation}
            </div>

            <p className="text-slate-400 text-[11px] leading-relaxed">
                {def.description}
            </p>

            <div className="flex flex-wrap gap-1 items-center">
                <span className="text-slate-500 font-extrabold uppercase text-[8px]">Depende de:</span>
                {def.inputs.map((inp, idx) => (
                    <span key={idx} className="bg-navy-900 border border-navy-800/80 px-1.5 py-0.5 rounded text-[9px] text-slate-300 font-semibold">
                        {inp}
                    </span>
                ))}
            </div>

            {def.calcExplanation && params && (
                <div className="border-t border-navy-900 pt-2 space-y-1">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Reemplazo en fórmula:</span>
                    <div className="font-mono text-[10px] text-indigo-300 font-bold break-words bg-indigo-500/5 border border-indigo-500/10 rounded px-2 py-1">
                        {def.calcExplanation(params)}
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};