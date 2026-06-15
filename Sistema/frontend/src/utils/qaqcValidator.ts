import type { JointRow, WindowHeader } from './rmrCalculator';

export interface ValidationAlert {
  fieldId: string; // The ID of the input to highlight
  type: 'ERROR' | 'WARNING';
  message: string;
}

export function validateWindowQAQC(header: WindowHeader, joints: JointRow[], largo: number): ValidationAlert[] {
  const alerts: ValidationAlert[] = [];

  // --- HEADER VALIDATIONS ---
  if (!header.celda || header.celda.trim() === "") {
    alerts.push({
      fieldId: "header-celda",
      type: "ERROR",
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
      message: "Las coordenadas FROM y TO están en cero (0.0). Ingrese coordenadas UTM reales."
    });
  } else {
    if (largo === 0) {
      alerts.push({
        fieldId: "header-este_to",
        type: "ERROR",
        message: "Las coordenadas iniciales (FROM) y finales (TO) son idénticas, resultando en un largo de celda de 0 metros."
      });
    } else if (largo > 35) {
      alerts.push({
        fieldId: "header-este_to",
        type: "WARNING",
        message: `El largo calculado de la ventana (${largo.toFixed(2)}m) es muy grande para un scanline de detalle regular (máx aconsejable: 30m).`
      });
    }
  }

  if (header.altura <= 0) {
    alerts.push({
      fieldId: "header-altura",
      type: "ERROR",
      message: "La altura de la ventana de mapeo debe ser mayor a 0 metros."
    });
  } else if (header.altura > 30) {
    alerts.push({
      fieldId: "header-altura",
      type: "WARNING",
      message: "La altura ingresada supera los 30 metros. Verifique que sea correcta."
    });
  }

  // --- STRUCTURES TABLE VALIDATIONS ---
  joints.forEach((j, index) => {
    const rowNum = index + 1;

    // Distancia scanline checks
    if (j.distancia < 0 || j.distancia > largo) {
      alerts.push({
        fieldId: `joint-distancia-${index}`,
        type: "ERROR",
        message: `Fila ${rowNum}: La distancia de la estructura (${j.distancia}m) está fuera del rango del scanline de la ventana (0m - ${largo.toFixed(2)}m).`
      });
    }

    // Dip & Dip Direction bounds
    if (j.dip < 0 || j.dip > 90) {
      alerts.push({
        fieldId: `joint-dip-${index}`,
        type: "ERROR",
        message: `Fila ${rowNum}: El buzamiento (Dip: ${j.dip}°) debe estar en el rango de 0° a 90°.`
      });
    }
    if (j.dip_dir < 0 || j.dip_dir > 360) {
      alerts.push({
        fieldId: `joint-dip_dir-${index}`,
        type: "ERROR",
        message: `Fila ${rowNum}: La dirección de buzamiento (Dip Dir: ${j.dip_dir}°) debe estar entre 0° y 360°.`
      });
    }

    // Spacing check (warning if 0)
    if (j.espaciamiento <= 0) {
      alerts.push({
        fieldId: `joint-espaciamiento-${index}`,
        type: "WARNING",
        message: `Fila ${rowNum}: El espaciamiento es 0 o menor. Un espaciamiento nulo incrementará indefinidamente el índice volumétrico Jv.`
      });
    } else if (j.espaciamiento > 10) {
      alerts.push({
        fieldId: `joint-espaciamiento-${index}`,
        type: "WARNING",
        message: `Fila ${rowNum}: Espaciamiento de junta muy alto (${j.espaciamiento}m). Verifique si corresponde.`
      });
    }

    // Structures count check
    if (j.n_estructuras < 1) {
      alerts.push({
        fieldId: `joint-n_estructuras-${index}`,
        type: "ERROR",
        message: `Fila ${rowNum}: La cantidad de estructuras debe ser al menos 1.`
      });
    }

    // Abertura vs Espesor QA/QC
    if (j.espesor > 0 && j.abertura === 0) {
      alerts.push({
        fieldId: `joint-abertura-${index}`,
        type: "WARNING",
        message: `Fila ${rowNum}: Declaró un espesor de relleno de ${j.espesor}mm pero la abertura de junta figura en 0mm.`
      });
    }
    if (j.abertura > 0 && j.espesor > j.abertura) {
      alerts.push({
        fieldId: `joint-espesor-${index}`,
        type: "WARNING",
        message: `Fila ${rowNum}: El espesor de relleno (${j.espesor}mm) es mayor que la abertura de junta (${j.abertura}mm).`
      });
    }

    // Terminations and visibility bounds
    if (j.extremos_visibles < 0 || j.extremos_visibles > 2) {
      alerts.push({
        fieldId: `joint-extremos_visibles-${index}`,
        type: "ERROR",
        message: `Fila ${rowNum}: Cantidad de extremos visibles debe ser 0, 1 o 2.`
      });
    }
  });

  return alerts;
}
