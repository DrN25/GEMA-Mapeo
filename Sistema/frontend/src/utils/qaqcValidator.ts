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

    const dist = j.distancia;
    const dip = j.dip;
    const dip_dir = j.dip_dir;
    const espac = j.espaciamiento;
    const nstr = j.n_estructuras ?? 1;
    const esp = j.espesor ?? 0;
    const aber = j.abertura ?? 0;
    const ext = j.extremos_visibles;

    // Skip validations if any main structural fields are vacant (-1 or undefined)
    if (dist === undefined || dist === -1 || dip === undefined || dip === -1 || dip_dir === undefined || dip_dir === -1) {
      return;
    }

    // Distancia scanline checks
    if (dist < 0 || dist > largo) {
      alerts.push({
        fieldId: `joint-distancia-${index}`,
        type: "ERROR",
        message: `Fila ${rowNum}: La distancia de la estructura (${dist}m) está fuera del rango del scanline de la ventana (0m - ${largo.toFixed(2)}m).`
      });
    }

    // Dip & Dip Direction bounds
    if (dip < 0 || dip > 90) {
      alerts.push({
        fieldId: `joint-dip-${index}`,
        type: "ERROR",
        message: `Fila ${rowNum}: El buzamiento (Dip: ${dip}°) debe estar en el rango de 0° a 90°.`
      });
    }
    if (dip_dir < 0 || dip_dir > 360) {
      alerts.push({
        fieldId: `joint-dip_dir-${index}`,
        type: "ERROR",
        message: `Fila ${rowNum}: La dirección de buzamiento (Dip Dir: ${dip_dir}°) debe estar entre 0° y 360°.`
      });
    }

    // Spacing check (warning if 0)
    if (espac !== undefined && espac !== -1) {
      if (espac <= 0) {
        alerts.push({
          fieldId: `joint-espaciamiento-${index}`,
          type: "WARNING",
          message: `Fila ${rowNum}: El espaciamiento es 0 o menor. Un espaciamiento nulo incrementará indefinidamente el índice volumétrico Jv.`
        });
      } else if (espac > 10) {
        alerts.push({
          fieldId: `joint-espaciamiento-${index}`,
          type: "WARNING",
          message: `Fila ${rowNum}: Espaciamiento de junta muy alto (${espac}m). Verifique si corresponde.`
        });
      }
    }

    // Structures count check
    if (nstr < 1) {
      alerts.push({
        fieldId: `joint-n_estructuras-${index}`,
        type: "ERROR",
        message: `Fila ${rowNum}: La cantidad de estructuras debe ser al menos 1.`
      });
    }

    // Abertura vs Espesor QA/QC
    if (esp > 0 && aber === 0) {
      alerts.push({
        fieldId: `joint-abertura-${index}`,
        type: "WARNING",
        message: `Fila ${rowNum}: Declaró un espesor de relleno de ${esp}mm pero la abertura de junta figura en 0mm.`
      });
    }
    if (aber > 0 && esp > aber) {
      alerts.push({
        fieldId: `joint-espesor-${index}`,
        type: "WARNING",
        message: `Fila ${rowNum}: El espesor de relleno (${esp}mm) es mayor que la abertura de junta (${aber}mm).`
      });
    }

    // Terminations and visibility bounds
    if (ext < 0 || ext > 3) {
      alerts.push({
        fieldId: `joint-extremos_visibles-${index}`,
        type: "ERROR",
        message: `Fila ${rowNum}: Cantidad de extremos visibles debe estar entre 0 y 3.`
      });
    }
  });

  return alerts;
}
