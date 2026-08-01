import { calculateWindowGeomec } from './rmrCalculator';
import type { JointRow, WindowHeader } from './rmrCalculator';
import { LITHOLOGY_CLASSIFICATION } from './catalogData';

export interface ValidationAlert {
  fieldId: string; // El ID del input a resaltar
  type: 'ERROR' | 'WARNING';
  message: string;
  ruleId?: string; // Identificador configurable de la regla QA/QC
}

/**
 * Matriz configurable de evaluación de reglas QA/QC para el guardado.
 * true = La regla bloquea el guardado en SaveConfirmModal si falla.
 * false = La regla solo muestra una advertencia informativa en el panel flotante sin bloquear el guardado.
 */
export const QAQC_RULE_ENFORCEMENT: Record<string, boolean> = {
  // COMBINACIÓN DE LITOLOGÍA (Única regla de combinación activada por defecto para bloquear el guardado)
  INVALID_LITHOLOGY_COMBO: true,

  // OTRAS REGLAS QA/QC ESTRUCTURALES Y FÍSICAS (Desactivadas por defecto para bloqueo; solo se evalúan como AVISOS informativos)
  APERTURE_VS_THICKNESS: false,
  CLEAN_JOINT_THICKNESS: false,
  UCS_VS_IS50: false,
  STRENGTH_VS_WEATHERING: false,
  JRC_VS_PROFILE: false,
  SCANLINE_BOUNDS: true // Límites críticos de scanline/distancia
};

// Función auxiliar para estimar el perfil de rugosidad teórico según el JRC geomecánico
function getExpectedProfileFromJRC(jrc: number): number | null {
  if (jrc < 0 || jrc > 20) return null;
  if (jrc <= 2) return 9;
  if (jrc <= 4) return 8;
  if (jrc <= 6) return 7;
  if (jrc <= 8) return 6;
  if (jrc <= 10) return 5;
  if (jrc <= 12) return 4;
  if (jrc <= 14) return 3;
  if (jrc <= 16) return 2;
  return 1; // JRC entre 16 y 20
}

export function validateWindowQAQC(header: WindowHeader, joints: JointRow[], largo: number): ValidationAlert[] {
  const alerts: ValidationAlert[] = [];

  // --- HEADER VALIDATIONS ---
  if (!header.celda || header.celda.trim() === "") {
    alerts.push({
      fieldId: "header-celda",
      type: "ERROR",
      ruleId: "SCANLINE_BOUNDS",
      message: "El nombre de la celda de mapeo es obligatorio."
    });
  }

  const isCoorsZero =
    header.este_from === 0 && header.norte_from === 0 && header.cota_from === 0 &&
    header.este_to === 0 && header.norte_to === 0 && header.cota_to === 0;

  if (isCoorsZero) {
    alerts.push({
      fieldId: "header-este_from",
      type: "WARNING",
      ruleId: "SCANLINE_BOUNDS",
      message: "Las coordenadas FROM y TO están en cero (0.0). Ingrese coordenadas UTM reales."
    });
  } else {
    if (largo === 0) {
      alerts.push({
        fieldId: "header-este_to",
        type: "ERROR",
        ruleId: "SCANLINE_BOUNDS",
        message: "Las coordenadas iniciales (FROM) y finales (TO) son idénticas, resultando en un largo de celda de 0 metros."
      });
    } else if (largo > 35) {
      alerts.push({
        fieldId: "header-este_to",
        type: "WARNING",
        ruleId: "SCANLINE_BOUNDS",
        message: `El largo calculado de la ventana (${largo.toFixed(2)}m) es muy grande para un scanline de detalle regular (máx aconsejable: 30m).`
      });
    }
  }

  if ((header.altura ?? 0) <= 0) {
    alerts.push({
      fieldId: "header-altura",
      type: "ERROR",
      ruleId: "SCANLINE_BOUNDS",
      message: "La altura de la ventana de mapeo debe ser mayor a 0 metros."
    });
  } else if ((header.altura ?? 0) > 30) {
    alerts.push({
      fieldId: "header-altura",
      type: "WARNING",
      ruleId: "SCANLINE_BOUNDS",
      message: "La altura ingresada supera los 30 metros. Verifique que sea correcta."
    });
  }

  // --- VALIDACIÓN DE COMBINACIÓN DE LITOLOGÍA (Unidad Litológica + Lito 1 + Lito 2 + Lito 3) ---
  const g = (header.unidad_litologica || '').trim().toUpperCase();
  const u = (header.lito_1 || '').trim().toUpperCase();
  const l = (header.lito_2 || '').trim().toUpperCase();
  const c = (header.lito_3 || '').trim().toUpperCase();

  const isGEmpty = !g || g === '-1';
  const isL1Empty = !u || u === '-1';
  const isL2Empty = !l || l === '-1';
  const isL3Empty = !c || c === '-1';

  if (!isGEmpty || !isL1Empty || !isL2Empty || !isL3Empty) {
    if (isGEmpty) {
      alerts.push({
        fieldId: "header-unidad_litologica",
        type: "ERROR",
        ruleId: "INVALID_LITHOLOGY_COMBO",
        message: "Combinación inválida de Litología: Se requiere seleccionar obligatoriamente una Unidad Litológica (INTRUSIVOS, SEDIMENTARIOS, METAMORFICAS, BRECHAS, ENDOSKARN)."
      });
    } else if (LITHOLOGY_CLASSIFICATION && LITHOLOGY_CLASSIFICATION.length > 0) {
      const groupSyns: Record<string, string> = {
        "SEDIMENTARIA": "SEDIMENTARIOS", "SEDIMENTARIAS": "SEDIMENTARIOS", "SEDIMENTARIO": "SEDIMENTARIOS",
        "INTRUSIVA": "INTRUSIVOS", "INTRUSIVAS": "INTRUSIVOS", "INTRUSIVO": "INTRUSIVOS",
        "METAMORFICO": "METAMORFICAS", "METAMORFICOS": "METAMORFICAS", "METAMORFICA": "METAMORFICAS",
        "BRECHA": "BRECHAS"
      };
      const normG = groupSyns[g] || g;

      const matches = LITHOLOGY_CLASSIFICATION.filter(item => {
        const itemG = (item.grupo || '').toUpperCase();
        const normItemG = groupSyns[itemG] || itemG;
        const itemU = (item.unidad || '').toUpperCase();
        const itemL = (item.litologia || '').toUpperCase();
        const itemC = (item.codigo || '').toUpperCase();

        const mg = normItemG === normG;
        const m1 = isL1Empty || itemU === u;
        const m2 = isL2Empty || itemL === l;
        const m3 = isL3Empty || itemC === c;

        return mg && m1 && m2 && m3;
      });

      if (matches.length === 0) {
        alerts.push({
          fieldId: "header-lito_1",
          type: "ERROR",
          ruleId: "INVALID_LITHOLOGY_COMBO",
          message: `Combinación de Litología Inválida en Catálogo: Unidad (${header.unidad_litologica || '—'}) con Lito 1 (${header.lito_1 || '—'}) / Lito 2 (${header.lito_2 || '—'}) / Lito 3 (${header.lito_3 || '—'}) no existe en el Catálogo Geomecánico.`
        });
      }
    }
  }

  // --- STRUCTURES TABLE VALIDATIONS ---
  joints.forEach((j, index) => {
    const rowNum = index + 1;

    const dist = j.distancia;
    const dip = j.dip;
    const dip_dir = j.dip_dir;
    const espac = j.espaciamiento;
    const nstr = j.n_estructuras ?? 1;
    const esp = j.espesor ?? 0;
    const aber = j.abertura ?? 0;
    const ext = j.extremos_visibles;
    const relleno1 = j.relleno1;
    const relleno2 = j.relleno2;
    const jrc = j.jrc;
    const rugosidad = j.rugosidad;

    // Skip validations if any main structural fields are vacant (-1 or undefined)
    if (dist === undefined || dist === -1 || dip === undefined || dip === -1 || dip_dir === undefined || dip_dir === -1) {
      return;
    }

    // Distancia scanline checks
    if (dist < 0 || dist > largo) {
      alerts.push({
        fieldId: `joint-distancia-${index}`,
        type: "ERROR",
        ruleId: "SCANLINE_BOUNDS",
        message: `Fila ${rowNum}: La distancia de la estructura (${dist}m) está fuera del rango del scanline de la ventana (0m - ${largo.toFixed(2)}m).`
      });
    }

    // Dip & Dip Direction bounds
    if (dip < -90 || dip > 90) {
      alerts.push({
        fieldId: `joint-dip-${index}`,
        type: "ERROR",
        ruleId: "SCANLINE_BOUNDS",
        message: `Fila ${rowNum}: El buzamiento (Dip: ${dip}°) debe estar en el rango de -90° a 90°.`
      });
    }
    if (dip_dir < 0 || dip_dir > 360) {
      alerts.push({
        fieldId: `joint-dip_dir-${index}`,
        type: "ERROR",
        ruleId: "SCANLINE_BOUNDS",
        message: `Fila ${rowNum}: La dirección de buzamiento (Dip Dir: ${dip_dir}°) debe estar entre 0° y 360°.`
      });
    }

    // Spacing check (warning if 0)
    if (espac !== undefined && espac !== -1) {
      if (espac <= 0) {
        alerts.push({
          fieldId: `joint-espaciamiento-${index}`,
          type: "WARNING",
          ruleId: "SCANLINE_BOUNDS",
          message: `Fila ${rowNum}: El espaciamiento es 0 o menor. Un espaciamiento nulo incrementará indefinidamente el índice volumétrico Jv.`
        });
      } else if (espac > 10) {
        alerts.push({
          fieldId: `joint-espaciamiento-${index}`,
          type: "WARNING",
          ruleId: "SCANLINE_BOUNDS",
          message: `Fila ${rowNum}: Espaciamiento de junta muy alto (${espac}m). Verifique si corresponde.`
        });
      }
    }

    // Structures count check
    if (nstr < 1) {
      alerts.push({
        fieldId: `joint-n_estructuras-${index}`,
        type: "ERROR",
        ruleId: "SCANLINE_BOUNDS",
        message: `Fila ${rowNum}: La cantidad de estructuras debe ser al menos 1.`
      });
    }

    // Abertura vs Espesor QA/QC
    if (esp > 0 && aber === 0) {
      alerts.push({
        fieldId: `joint-abertura-${index}`,
        type: "WARNING",
        ruleId: "APERTURE_VS_THICKNESS",
        message: `Fila ${rowNum}: Advertencia de Catálogo — Declaró un espesor de relleno de ${esp}mm pero la abertura de junta figura en 0mm.`
      });
    }
    if (aber > 0 && esp > aber) {
      alerts.push({
        fieldId: `joint-espesor-${index}`,
        type: "WARNING",
        ruleId: "APERTURE_VS_THICKNESS",
        message: `Fila ${rowNum}: Advertencia de Catálogo — El espesor de relleno (${esp}mm) no puede ser mayor que la abertura de junta (${aber}mm).`
      });
    }

    // Relleno vs Espesor QA/QC Contradiction
    const isSinRelleno1 = relleno1 === 'c' || relleno1 === 'cwf' || relleno1 === '-1';
    const isSinRelleno2 = !relleno2 || relleno2 === 'c' || relleno2 === 'cwf' || relleno2 === '-1';
    if (isSinRelleno1 && isSinRelleno2 && esp !== -1 && esp > 0) {
      alerts.push({
        fieldId: `joint-espesor-${index}`,
        type: "WARNING",
        ruleId: "CLEAN_JOINT_THICKNESS",
        message: `Fila ${rowNum}: Advertencia de Catálogo — Se declaró junta limpia/sin relleno pero el espesor de relleno figura con ${esp}mm.`
      });
    }

    // JRC vs Rugosidad Correlation Check
    if (jrc !== -1 && jrc !== undefined && rugosidad !== -1 && rugosidad !== undefined) {
      const expectedProf = getExpectedProfileFromJRC(jrc);
      if (expectedProf !== null && Math.abs(expectedProf - rugosidad) > 1) {
        alerts.push({
          fieldId: `joint-jrc-${index}`,
          type: "WARNING",
          ruleId: "JRC_VS_PROFILE",
          message: `Fila ${rowNum}: Desviación geomecánica entre JRC (${jrc}) y Perfil de Rugosidad (${rugosidad}). Perfil sugerido: ${expectedProf}.`
        });
      }
    }

    // Terminations and visibility bounds
    if (ext < 0 || ext > 2) {
      alerts.push({
        fieldId: `joint-extremos_visibles-${index}`,
        type: "ERROR",
        ruleId: "SCANLINE_BOUNDS",
        message: `Fila ${rowNum}: Cantidad de extremos visibles debe estar entre 0 y 2 (opción 3 removida).`
      });
    }

    const term = j.terminacion;
    if (term !== undefined && term !== -1 && (term < 0 || term > 3)) {
      alerts.push({
        fieldId: `joint-terminacion-${index}`,
        type: "ERROR",
        ruleId: "SCANLINE_BOUNDS",
        message: `Fila ${rowNum}: El valor de terminación debe estar entre 0 y 3 (opciones 4 y 5 removidas).`
      });
    }
  });

  // --- VALIDACIONES DE RESISTENCIA UCS VS IS50 ---
  const ucs = header.ucs_mpa;
  const is50 = header.is50_mpa;

  if (ucs !== undefined && ucs !== null && is50 !== undefined && is50 !== null) {
    if (ucs <= is50) {
      alerts.push({
        fieldId: "header-ucs_mpa",
        type: "WARNING",
        ruleId: "UCS_VS_IS50",
        message: `UCS es divergente a Is50. El valor de resistencia UCS (${ucs} MPa) debe ser mayor que la carga puntual Is50 (${is50} MPa).`
      });
    } else {
      const expectedUcs = is50 * 10;
      if (Math.abs(ucs - expectedUcs) > 1.5) {
        alerts.push({
          fieldId: "header-ucs_mpa",
          type: "WARNING",
          ruleId: "UCS_VS_IS50",
          message: `Divergencia de resistencia uniaxial (UCS vs Is50 * K). El UCS ingresado (${ucs} MPa) se desvía del estimado teórico promedio (${expectedUcs.toFixed(1)} MPa) para un Is50 de ${is50} MPa.`
        });
      }
    }
  }

  // --- VALIDACIÓN DE COMPATIBILIDAD DUREZA VS INTEMPERISMO / METEORIZACIÓN ---
  const resist = header.resistencia_ucs ? String(header.resistencia_ucs).toUpperCase() : undefined;
  const intemp = header.intemperia ? String(header.intemperia).toUpperCase() : undefined;

  if (resist && intemp) {
    const isHighStrength = resist === 'R5' || resist === 'R6';
    const isHighWeathering = intemp === 'CWF' || intemp === 'RS' || intemp === 'D' || intemp === 'HWF';

    if (isHighStrength && isHighWeathering) {
      alerts.push({
        fieldId: "header-intemperia",
        type: "WARNING",
        ruleId: "STRENGTH_VS_WEATHERING",
        message: `Advertencia de Catálogo: Alta resistencia de roca (${resist}) declarada con intemperismo elevado/suelo (${intemp}). Por favor consulte el Catálogo Geomecánico.`
      });
    }

    const isVeryLowStrength = resist === 'R0' || resist === 'R1';
    const isFresh = intemp === 'F' || intemp === 'UWF';
    if (isVeryLowStrength && isFresh) {
      alerts.push({
        fieldId: "header-intemperia",
        type: "WARNING",
        ruleId: "STRENGTH_VS_WEATHERING",
        message: `Advertencia Geomecánica: Resistencia muy baja (${resist}) declarada como roca totalmente sana/fresca (${intemp}). Verifique compatibilidad en el Catálogo.`
      });
    }
  }

  // --- VALIDACIONES DE RMR NO NULO ---
  const rmrResult = calculateWindowGeomec(header, joints);
  if (rmrResult.rmr_76 === 0) {
    alerts.push({
      fieldId: "header-resistencia_ucs",
      type: "ERROR",
      ruleId: "SCANLINE_BOUNDS",
      message: "Inconsistencia crítica: El RMR calculado RMR '76 es de 0.0 (no puede ser cero)."
    });
  }
  if (rmrResult.rmr_89 === 0) {
    alerts.push({
      fieldId: "header-resistencia_ucs",
      type: "ERROR",
      ruleId: "SCANLINE_BOUNDS",
      message: "Inconsistencia crítica: El RMR calculado RMR '89 es de 0.0 (no puede ser cero)."
    });
  }

  return alerts;
}