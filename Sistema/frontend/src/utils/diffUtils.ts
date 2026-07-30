import type { WindowHeader, JointRow } from './rmrCalculator';

export interface WindowData {
  header: WindowHeader;
  joints: JointRow[];
}

export interface WindowDiffResult {
  headerEditsCount: number;
  jointsEditsCount: number;
  jointsAddedCount: number;
  jointsDeletedCount: number;
  totalEdits: number;
  editedFieldsList: string[];
  hasChanges: boolean;
}

export interface WindowSummaryDiff {
  celda: string;
  diff: WindowDiffResult;
}

export interface AllWindowsDiffSummary {
  activeDiff: WindowDiffResult;
  totalWindowsWithChanges: number;
  totalCellEditsAll: number;
  totalJointsAddedAll: number;
  totalJointsDeletedAll: number;
  windowsList: WindowSummaryDiff[];
}

/**
 * Normaliza valores para comparación justa ignorando diferencias cosméticas
 */
function normalizeVal(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    return val.toString();
  }
  return String(val).trim();
}

/**
 * Verifica si una discontinuidad posee datos ingresados reales o es solo una plantilla vacía (vacante)
 */
export function isNonVacantJoint(j: JointRow): boolean {
  if (!j) return false;
  return (
    (j.distancia !== -1 && j.distancia !== null && j.distancia !== undefined) ||
    (j.dip !== -1 && j.dip !== null && j.dip !== undefined) ||
    (j.dip_dir !== -1 && j.dip_dir !== null && j.dip_dir !== undefined) ||
    (j.espaciamiento !== -1 && j.espaciamiento !== null && j.espaciamiento !== undefined) ||
    (j.abertura !== -1 && j.abertura !== null && j.abertura !== undefined) ||
    (j.espesor !== -1 && j.espesor !== null && j.espesor !== undefined) ||
    (j.n_estructuras !== -1 && j.n_estructuras !== null && j.n_estructuras !== undefined) ||
    (j.jrc !== -1 && j.jrc !== null && j.jrc !== undefined) ||
    (j.rugosidad !== -1 && j.rugosidad !== null && j.rugosidad !== undefined)
  );
}

/**
 * Audita las diferencias exactas campo por campo entre un snapshot y el estado actual de una ventana
 */
export function computeWindowDiff(
  before: WindowData | null,
  after: WindowData
): WindowDiffResult {
  let effectiveBefore = before;

  // Fallback si before es null: intentar cargar el snapshot persistido de localStorage
  if (!effectiveBefore && after?.header?.celda) {
    try {
      const snapshotRaw = localStorage.getItem(`geolog_window_snapshot_${after.header.celda}`);
      if (snapshotRaw) {
        effectiveBefore = JSON.parse(snapshotRaw);
      }
    } catch (e) {
      console.warn("No se pudo cargar el snapshot baseline para diff:", e);
    }
  }

  // Si sigue sin haber snapshot 'before', verificar si la celda existe en BD o en caché local
  if (!effectiveBefore) {
    let existsInDbSummaries = false;
    try {
      const summariesStr = localStorage.getItem('geolog_windows_summaries');
      if (summariesStr && after?.header?.celda) {
        const summaries = JSON.parse(summariesStr);
        existsInDbSummaries = Array.isArray(summaries) && summaries.some((s: any) => s.name === after.header.celda);
      }
    } catch (e) {}

    // Solo considerar "existente" si hay un snapshot de referencia guardado,
    // NO solo un caché de datos activos (que puede existir por escritura prematura en handleCreateWindow).
    const hasPersistedSnapshot = !!localStorage.getItem(`geolog_window_snapshot_${after?.header?.celda}`);

    if (existsInDbSummaries || hasPersistedSnapshot) {
      // Usar 'after' como baseline para evitar falsos positivos en celdas existentes sin snapshot previo
      effectiveBefore = JSON.parse(JSON.stringify(after));
    } else {
      // Es una celda totalmente nueva creada en sesión
      const nonVacantAfter = (after.joints || []).filter(isNonVacantJoint);
      const jCount = nonVacantAfter.length;
      return {
        headerEditsCount: 1,
        jointsEditsCount: 0,
        jointsAddedCount: jCount,
        jointsDeletedCount: 0,
        totalEdits: 1 + jCount,
        editedFieldsList: ['Celda Nueva', `${jCount} discontinuidades creadas`],
        hasChanges: true
      };
    }
  }

  let headerEditsCount = 0;
  let jointsEditsCount = 0;
  let jointsAddedCount = 0;
  let jointsDeletedCount = 0;
  const editedFieldsList: string[] = [];

  // 1. Comparación de Header
  const headerKeys: (keyof WindowHeader)[] = [
    'este_from', 'norte_from', 'cota_from',
    'este_to', 'norte_to', 'cota_to',
    'altura', 'dip_talud', 'dipdir_talud', 'dip_hw', 'az_hw',
    'unidad_litologica', 'lito_1', 'lito_2', 'lito_3',
    'mapeador', 'sector', 'fase', 'nivel', 'sect_geot', 'intemperia', 'alt_mapeo', 'fecha',
    'condicion_agua', 'resistencia_ucs', 'comentario', 'campania',
    'gsi_estructura', 'gsi_superficie', 'gsi_visual', 'control_estructural', 'efectos_voladura', 'ucs_mpa', 'is50_mpa'
  ];

  if (effectiveBefore) {
    for (const key of headerKeys) {
      const valA = normalizeVal(effectiveBefore.header[key]);
      const valB = normalizeVal(after.header[key]);
      if (valA !== valB) {
        headerEditsCount++;
        editedFieldsList.push(`Header: ${String(key)}`);
      }
    }
  }

  // 2. Comparación de JointRows ignorando plantillas vacías
  const beforeJointsMap = new Map<number, JointRow>();
  const beforeJoints = effectiveBefore ? (effectiveBefore.joints || []) : [];
  beforeJoints.forEach(j => beforeJointsMap.set(j.id, j));

  const afterJointsMap = new Map<number, JointRow>();
  (after.joints || []).forEach(j => afterJointsMap.set(j.id, j));

  const allIds = new Set([...beforeJointsMap.keys(), ...afterJointsMap.keys()]);

  const jointKeys: (keyof JointRow)[] = [
    'familia', 'distancia', 'tipo_estructura', 'dip', 'dip_dir', 'n_estructuras',
    'abertura', 'espesor', 'continuidad', 'espaciamiento', 'extremos_visibles',
    'terminacion', 'relleno1', 'relleno2', 'jrc', 'rugosidad', 'forma', 'alteracion'
  ];

  for (const id of allIds) {
    const beforeJ = beforeJointsMap.get(id);
    const afterJ = afterJointsMap.get(id);

    const wasNonVacant = beforeJ ? isNonVacantJoint(beforeJ) : false;
    const isNowNonVacant = afterJ ? isNonVacantJoint(afterJ) : false;

    if (!wasNonVacant && !isNowNonVacant) {
      // Ambas son vacantes (plantilla vacía) -> ignorar
      continue;
    }

    if (!wasNonVacant && isNowNonVacant) {
      // Se ingresaron datos en una fila plantilla -> discontinuidad registrada
      jointsAddedCount++;
      editedFieldsList.push(`Discontinuidad F${afterJ!.familia} (ID ${id}) registrada`);
    } else if (wasNonVacant && !isNowNonVacant) {
      // Se borraron los datos de una discontinuidad existente
      jointsDeletedCount++;
      editedFieldsList.push(`Discontinuidad F${beforeJ!.familia} (ID ${id}) borrada`);
    } else if (beforeJ && afterJ) {
      // Fila con datos reales editada
      let rowHasEdit = false;
      for (const jKey of jointKeys) {
        const valA = normalizeVal(beforeJ[jKey]);
        const valB = normalizeVal(afterJ[jKey]);
        if (valA !== valB) {
          jointsEditsCount++;
          rowHasEdit = true;
        }
      }
      if (rowHasEdit) {
        editedFieldsList.push(`Discontinuidad F${afterJ.familia} (ID ${id}) modificada`);
      }
    }
  }

  const totalEdits = headerEditsCount + jointsEditsCount + jointsAddedCount + jointsDeletedCount;

  return {
    headerEditsCount,
    jointsEditsCount,
    jointsAddedCount,
    jointsDeletedCount,
    totalEdits,
    editedFieldsList,
    hasChanges: totalEdits > 0
  };
}

/**
 * Audita el total de cambios acumulados en el espacio de trabajo
 */
export function computeAllWindowsDiff(
  activeWindow: WindowData | null,
  activeSnapshot: WindowData | null
): AllWindowsDiffSummary {
  const activeDiff = activeWindow ? computeWindowDiff(activeSnapshot, activeWindow) : {
    headerEditsCount: 0,
    jointsEditsCount: 0,
    jointsAddedCount: 0,
    jointsDeletedCount: 0,
    totalEdits: 0,
    editedFieldsList: [],
    hasChanges: false
  };

  const windowsList: WindowSummaryDiff[] = [];
  let totalCellEditsAll = 0;
  let totalJointsAddedAll = 0;
  let totalJointsDeletedAll = 0;

  // Registrar la celda activa primero si tiene cambios
  if (activeWindow && activeDiff.hasChanges) {
    windowsList.push({
      celda: activeWindow.header.celda,
      diff: activeDiff
    });
    totalCellEditsAll += activeDiff.headerEditsCount + activeDiff.jointsEditsCount;
    totalJointsAddedAll += activeDiff.jointsAddedCount;
    totalJointsDeletedAll += activeDiff.jointsDeletedCount;
  }

  // Cargar lista de celdas pendientes rastreadas en localStorage
  try {
    const unsavedListRaw = localStorage.getItem('geolog_unsaved_windows');
    const unsavedCeldaNames: string[] = unsavedListRaw ? JSON.parse(unsavedListRaw) : [];

    for (const celdaName of unsavedCeldaNames) {
      if (activeWindow && activeWindow.header.celda === celdaName) continue; // Ya procesada arriba

      const cachedActiveRaw = localStorage.getItem(`geolog_window_${celdaName}`);
      const cachedSnapshotRaw = localStorage.getItem(`geolog_window_snapshot_${celdaName}`);

      if (cachedActiveRaw) {
        const cachedActive: WindowData = JSON.parse(cachedActiveRaw);
        const cachedSnapshot: WindowData | null = cachedSnapshotRaw ? JSON.parse(cachedSnapshotRaw) : null;
        const diff = computeWindowDiff(cachedSnapshot, cachedActive);

        if (diff.hasChanges) {
          windowsList.push({ celda: celdaName, diff });
          totalCellEditsAll += diff.headerEditsCount + diff.jointsEditsCount;
          totalJointsAddedAll += diff.jointsAddedCount;
          totalJointsDeletedAll += diff.jointsDeletedCount;
        }
      }
    }
  } catch (e) {
    console.warn("Error leyendo celdas pendientes de localStorage:", e);
  }

  return {
    activeDiff,
    totalWindowsWithChanges: windowsList.length,
    totalCellEditsAll,
    totalJointsAddedAll,
    totalJointsDeletedAll,
    windowsList
  };
}
