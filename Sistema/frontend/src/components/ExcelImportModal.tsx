import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { X, FileSpreadsheet, Upload, AlertTriangle, Check, ArrowRight, Info, Filter } from 'lucide-react';
import type { WindowHeader, JointRow } from '../utils/rmrCalculator';
import { LITHOLOGY_CLASSIFICATION } from '../utils/catalogData';

interface WindowData {
  header: WindowHeader;
  joints: JointRow[];
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (importedData: WindowData) => void;
}

interface MappingField {
  key: string;
  label: string;
  required: boolean;
  synonyms: string[];
}

// Campos esperados con sinónimos enriquecidos para la importación
const EXPECTED_FIELDS: MappingField[] = [
  { key: 'celda', label: 'Código Celda', required: true, synonyms: ['celda', 'codigocelda', 'codigo', 'window', 'windowid', 'station', 'estacion', 'estaciones'] },
  { key: 'este_from', label: 'Este FROM (X)', required: true, synonyms: ['estefrom', 'este_from', 'east_from', 'eastfrom', 'x_from', 'xfrom', 'esteini'] },
  { key: 'norte_from', label: 'Norte FROM (Y)', required: true, synonyms: ['nortefrom', 'norte_from', 'north_from', 'northfrom', 'y_from', 'yfrom', 'norteini'] },
  { key: 'cota_from', label: 'Cota FROM (Z)', required: true, synonyms: ['cotafrom', 'cota_from', 'rl_from', 'rlfrom', 'z_from', 'zfrom', 'cotaini'] },
  { key: 'este_to', label: 'Este TO (X)', required: true, synonyms: ['esteto', 'este_to', 'east_to', 'eastto', 'x_to', 'xto', 'estefin'] },
  { key: 'norte_to', label: 'Norte TO (Y)', required: true, synonyms: ['norteto', 'norte_to', 'north_to', 'northto', 'y_to', 'yto', 'nortefin'] },
  { key: 'cota_to', label: 'Cota TO (Z)', required: true, synonyms: ['cotato', 'cota_to', 'rl_to', 'rlto', 'z_to', 'zto', 'cotafin'] },
  { key: 'altura', label: 'Altura (m)', required: true, synonyms: ['altura', 'alturam', 'height', 'heightm', 'alturaventanam'] },
  { key: 'dip_talud', label: 'Dip Talud (°)', required: true, synonyms: ['diptalud', 'dip_talud', 'taluddip', 'slope_dip', 'diptaluddeg'] },

  { key: 'dipdir_talud', label: 'DipDir Talud (°)', required: false, synonyms: ['dipdir_talud', 'dip_dir_talud', 'dipdir_talud_deg'] },
  { key: 'dip_hw', label: 'Dip Hw (Dip Hole) (°)', required: false, synonyms: ['dip_hw', 'dip_hole', 'dip_hole_deg', 'dip_hw_deg'] },
  { key: 'az_hw', label: 'Az Hw (Az Hole) (°)', required: false, synonyms: ['az_hw', 'az_hole', 'az_hole_deg', 'az_hw_deg', 'azimuth_hole'] },
  { key: 'alt_zona', label: 'Alt. de Zona', required: false, synonyms: ['alt_zona', 'alteracion_zona', 'alteracion_codigo', 'alt_zona_code', 'alteracionce'] },
  { key: 'intemperia', label: 'Intemperia / Grado', required: false, synonyms: ['intemperia', 'intemperismo', 'weathering_grade', 'weathering', 'intemp', 'intemperismo_codigo'] },

  { key: 'lito_3', label: 'Litología (Lito-3)', required: false, synonyms: ['lito3', 'litologia3', 'lito_3', 'litocm', 'litologia_3'] },
  { key: 'lito_model', label: 'Lito Modelo', required: false, synonyms: ['litomodel', 'lito_model', 'litologia1', 'lito1', 'lito_1', 'litock', 'lito3modelo', 'lito3_modelo'] },
  { key: 'mapeador', label: 'Geólogo Mapeador', required: false, synonyms: ['mapeador', 'geologo', 'geot', 'mapeado_por', 'logged_by', 'geotecnico'] },
  { key: 'fecha', label: 'Fecha Mapeo', required: false, synonyms: ['fecha', 'fechamapeo', 'fecha_mapeo', 'date', 'fechabg'] },
  { key: 'condicion_agua', label: 'Agua Subterránea', required: false, synonyms: ['condicionagua', 'condicion_agua', 'aguasubterranea', 'agua', 'water', 'aguacode', 'aguadeobs'] },
  { key: 'resistencia_ucs', label: 'Resistencia UCS', required: false, synonyms: ['resistenciaucs', 'resistencia_ucs', 'ucs', 'dureza', 'strength', 'rescode'] },

  // Campos adicionales de validación RMR para tabla plana
  { key: 'ucs_mpa', label: 'UCS intacto (MPa)', required: false, synonyms: ['ucs_mpa', 'ucsval', 'ucsvalue', 'ucs_val', 'ucs_value', 'ucsrating'] },
  { key: 'is50_mpa', label: 'is50 intacto (MPa)', required: false, synonyms: ['is50_mpa', 'is50val', 'is50value', 'is50_val', 'is50_value', 'is50'] },
  { key: 'gsi_visual', label: 'GSI Visual', required: false, synonyms: ['gsi_visual', 'gsivisual', 'gsi', 'gsival', 'gsivalue'] },
  { key: 'gsi_superficie', label: 'GSI Superficie', required: false, synonyms: ['gsi_superficie', 'gsi_sup', 'gsisurf'] },
  { key: 'gsi_estructura', label: 'GSI Estructura', required: false, synonyms: ['gsi_estructura', 'gsi_est', 'gsistruc'] },
  { key: 'control_estructural', label: 'Control Estructural', required: false, synonyms: ['control_estructural', 'control', 'ctrl_est'] },
  { key: 'efectos_voladura', label: 'Efectos Voladura', required: false, synonyms: ['efectos_voladura', 'voladura', 'blast_effect'] },

  // Joint / Discontinuity properties
  { key: 'familia', label: 'Familia', required: true, synonyms: ['familia', 'fam', 'family', 'set'] },
  { key: 'distancia', label: 'Distancia (m)', required: true, synonyms: ['distancia', 'distanciam', 'distance', 'dist', 'distanciambk', 'distdeestr', 'dist_de_estr'] },
  { key: 'tipo_estructura', label: 'Tipo Estructura', required: true, synonyms: ['tipoestructura', 'tipo_estructura', 'tipo', 'type', 'structure_type', 'tipoestructurabq'] },
  { key: 'dip', label: 'Dip / Buzamiento (°)', required: true, synonyms: ['dip', 'inclinacion', 'dipdeg', 'buzamiento', 'buzamientobr'] },
  { key: 'dip_dir', label: 'DipDir / Dirección (°)', required: true, synonyms: ['dipdir', 'dip_dir', 'direction', 'azimut', 'azimuth', 'direccionbs'] },
  { key: 'n_estructuras', label: 'Cantidad (N)', required: false, synonyms: ['n_estructuras', 'cant', 'cantidad', 'count', 'n', 'numestructuras', 'cantidadbt'] },
  { key: 'abertura', label: 'Abertura (mm)', required: false, synonyms: ['abertura', 'aberturamm', 'aperture', 'aberturabu'] },
  { key: 'espesor', label: 'Espesor (mm)', required: false, synonyms: ['espesor', 'espesormm', 'thickness', 'espesorbv'] },
  { key: 'continuidad', label: 'Continuidad (m)', required: false, synonyms: ['continuidad', 'continuidadm', 'persistence', 'length', 'continuidadbw'] },
  { key: 'espaciamiento', label: 'Espaciamiento (m)', required: false, synonyms: ['espaciamiento', 'espaciamientom', 'spacing', 'espaciamientobx'] },
  { key: 'extremos_visibles', label: 'Extremos Visibles', required: false, synonyms: ['extremosvisibles', 'extremos', 'ext_vis', 'visible', 'numextremosvisibles', 'extremosby'] },
  { key: 'terminacion', label: 'Terminación', required: false, synonyms: ['terminacion', 'termination'] },
  { key: 'relleno1', label: 'Relleno 1', required: false, synonyms: ['relleno1', 'relleno_1', 'relleno', 'tiporelleno1', 'tipoderelleno1bz', 'tipoderelleno1', 'tipo_de_relleno_1'] },
  { key: 'relleno2', label: 'Relleno 2', required: false, synonyms: ['relleno2', 'relleno_2', 'tiporelleno2', 'tipoderelleno2ca', 'tipoderelleno2', 'tipo_de_relleno_2'] },
  { key: 'jrc', label: 'JRC', required: false, synonyms: ['jrc', 'jrc10', 'jrc_10', 'jrccb'] },
  { key: 'rugosidad', label: 'Rugosidad', required: false, synonyms: ['rugosidad', 'rug', 'rugosidadcc'] },
  { key: 'forma', label: 'Forma', required: false, synonyms: ['forma', 'shape', 'formacd'] },
  { key: 'alteracion', label: 'Alteración', required: false, synonyms: ['alteracion', 'alt', 'weathering', 'alteracionce'] }
];

export default function ExcelImportModal({
  isOpen,
  onClose,
  onImport
}: ExcelImportModalProps) {
  if (!isOpen) return null;

  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [isStackedTemplate, setIsStackedTemplate] = useState<boolean>(true);

  // MAPPED MODE STATE
  const [rawGrid, setRawGrid] = useState<any[][] | null>(null);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, number>>({});
  const [detectedCeldas, setDetectedCeldas] = useState<string[]>([]);
  const [selectedCeldaCode, setSelectedCeldaCode] = useState<string>('');
  const [parsedWindowData, setParsedWindowData] = useState<Record<string, WindowData>>({});

  // STACKED MODE STATE
  const [detectedTemplateCells, setDetectedTemplateCells] = useState<Record<string, WindowData>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setSheets([]);
    setSelectedSheet('');
    setWorkbook(null);
    setRawGrid(null);
    setHeaderRowIdx(0);
    setExcelHeaders([]);
    setMappings({});
    setDetectedCeldas([]);
    setSelectedCeldaCode('');
    setParsedWindowData({});
    setDetectedTemplateCells({});
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    loadWorkbook(selectedFile);
  };

  const loadWorkbook = (selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        setWorkbook(wb);
        setSheets(wb.SheetNames);

        const defaultSheet = wb.SheetNames.find(name => {
          const upper = name.toUpperCase();
          return upper.includes('VENTANA') || upper.includes('BD') || upper.includes('ESTACION') || upper.includes('DATA');
        }) || wb.SheetNames[0];

        setSelectedSheet(defaultSheet);
        processSheet(wb, defaultSheet);
      } catch (err) {
        alert("Error al procesar el archivo Excel. Asegúrate de que sea un archivo válido.");
        console.error(err);
        resetState();
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
    if (grid.length === 0) {
      alert("La hoja seleccionada está vacía.");
      return;
    }

    setRawGrid(grid);

    const isStacked = sheetName.toLowerCase().includes("ventana");
    setIsStackedTemplate(isStacked);

    if (isStacked) {
      parseStackedTemplate(grid);
    } else {
      parseFlatTable(grid);
    }
  };

  const handleToggleMode = (stacked: boolean) => {
    if (!rawGrid) return;
    setIsStackedTemplate(stacked);
    if (stacked) {
      parseStackedTemplate(rawGrid);
    } else {
      parseFlatTable(rawGrid);
    }
  };

  const detectLithology = (rawLito3Code: string, fallbackCode = "") => {
    const code = String(rawLito3Code || fallbackCode || '').trim().toUpperCase();

    const match = LITHOLOGY_CLASSIFICATION.find(item => item.codigo.toUpperCase() === code);

    if (match) {
      return {
        lito_1: match.unidad,
        lito_2: match.litologia,
        lito_3: match.codigo,
        unidad_litologica: match.grupo
      };
    }

    return {
      lito_1: rawLito3Code || fallbackCode || '',
      lito_2: '',
      lito_3: rawLito3Code || fallbackCode || '',
      unidad_litologica: 'INTRUSIVOS'
    };
  };

  const parseDateStr = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    if (val instanceof Date) {
      const offset = val.getTimezoneOffset();
      const corrected = new Date(val.getTime() - offset * 60 * 1000);
      return corrected.toISOString().split('T')[0];
    }
    const num = parseFloat(String(val));
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const jsDate = new Date((num - 25569) * 86400 * 1000);
      return jsDate.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    return str.substring(0, 10);
  };

  const roundDec = (val: number, decs: number): number => {
    const factor = Math.pow(10, decs);
    return Math.round(val * factor) / factor;
  };

  // 1. Parser para pestañas apiladas verticalmente ("ventana")
  const parseStackedTemplate = (grid: any[][]) => {
    const cellsFound: Record<string, WindowData> = {};

    const getNum = (r: number, c: number) => {
      const val = grid[r]?.[c];
      if (val === null || val === undefined) return 0;
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    };

    const getStr = (r: number, c: number) => {
      const val = grid[r]?.[c];
      return val !== null && val !== undefined ? String(val).trim() : "";
    };

    for (let start = 2; start < grid.length; start += 30) {
      let celdaVal = grid[start + 1]?.[0];
      if (!celdaVal) {
        celdaVal = grid[start]?.[50];
      }
      if (!celdaVal || !String(celdaVal).trim()) continue;
      const codigo = String(celdaVal).trim().toUpperCase();

      const este_from = roundDec(getNum(start + 2, 1), 2);
      const norte_from = roundDec(getNum(start + 2, 3), 2);
      const cota_from = roundDec(getNum(start + 2, 5), 2);
      const este_to = roundDec(getNum(start + 3, 1), 2);
      const norte_to = roundDec(getNum(start + 3, 3), 2);
      const cota_to = roundDec(getNum(start + 3, 5), 2);

      const altura = roundDec(getNum(start + 3, 10), 1);
      const dip_talud = roundDec(getNum(start + 2, 13), 2);
      const dipdir_talud = roundDec(getNum(start + 3, 13), 2);
      const dip_hw = roundDec(getNum(start + 4, 13), 2);
      const az_hw = roundDec(getNum(start + 5, 13), 2);

      const lito_3 = getStr(start + 1, 15);
      const alt_zona = getStr(start + 2, 15);
      const intemperia = getStr(start + 3, 15);
      const lito_model = getStr(start + 4, 15);
      const mapeador = getStr(start + 5, 15);

      const sector = getStr(start + 1, 19);
      const fase = String(Math.round(getNum(start + 2, 20)) || 5);
      const nivel = String(roundDec(getNum(start + 3, 20), 2) || 3960);
      const sect_geot = getStr(start + 4, 20);
      const fecha = parseDateStr(grid[start + 1]?.[36]);

      const condicion_agua = getStr(start + 8, 35) || 'C';
      const resistencia_ucs = getStr(start + 8, 37) || 'R4';
      const gsi_superficie = getStr(start + 8, 39) || 'G';
      const gsi_estructura = getStr(start + 8, 40) || 'VB';

      // Aplicación de redondeo estricto a las celdas de validación RMR
      const gsi_visual = roundDec(getNum(start + 8, 41) || 56, 2);
      const control_estructural = Math.round(getNum(start + 8, 42)) || 3;
      const efectos_voladura = Math.round(getNum(start + 8, 43)) || 3;
      const ucs_mpa = roundDec(getNum(start + 8, 52) || 73, 2);
      const is50_mpa = roundDec(getNum(start + 8, 53) || 5, 2);

      const litoDetails = detectLithology(lito_model, lito_3);

      const joints: JointRow[] = [];
      let jId = 1;

      for (let r = start + 12; r <= start + 25; r++) {
        const famVal = grid[r]?.[0];
        if (famVal === null || famVal === undefined || String(famVal).trim() === "") continue;
        const fam = parseInt(famVal);
        if (isNaN(fam)) continue;

        const dip = Math.min(90, Math.max(0, roundDec(getNum(r, 3), 2)));
        const dip_dir = Math.min(359, Math.max(0, roundDec(getNum(r, 4), 2)));

        const raw_nstr = Math.round(getNum(r, 5));
        const n_estructuras = raw_nstr > 0 ? raw_nstr : -1;
        const distancia = Math.max(0, Math.round(getNum(r, 1)));
        const abertura = roundDec(getNum(r, 6), 1);
        const espesor = roundDec(getNum(r, 7), 1);
        const espaciamiento = roundDec(getNum(r, 9), 2);

        const jrc = sanitizeRange(getNum(r, 18), 0, 20);
        const rugosidad = sanitizeRange(getNum(r, 19), 0, 9);
        const extremos_visibles = sanitizeRange(getNum(r, 10), 0, 2);
        const terminacion = sanitizeRange(getNum(r, 11), 0, 3);

        joints.push({
          id: jId++,
          familia: fam,
          distancia,
          tipo_estructura: getStr(r, 2) || 'JN',
          dip: dip !== -1 ? dip : undefined,
          dip_dir: dip_dir !== -1 ? dip_dir : undefined,
          n_estructuras,
          abertura,
          espesor,
          continuidad: roundDec(getNum(r, 8), 2),
          espaciamiento,
          extremos_visibles,
          terminacion,
          relleno1: getStr(r, 12).toLowerCase() || 'cwf',
          relleno2: getStr(r, 13).toLowerCase() || undefined,
          jrc: jrc !== -1 ? jrc : undefined,
          rugosidad: rugosidad !== -1 ? rugosidad : -1,
          forma: getStr(r, 20) || 'O',
          alteracion: getStr(r, 21).toLowerCase() || 'd'
        });
      }

      cellsFound[codigo] = {
        header: {
          celda: codigo,
          este_from, norte_from, cota_from,
          este_to, norte_to, cota_to,
          altura, dip_talud, dipdir_talud, dip_hw, az_hw,
          ...litoDetails,
          mapeador, sector, fase, nivel, sect_geot,
          fecha, condicion_agua, resistencia_ucs,
          intemperia, alt_zona,
          gsi_superficie, gsi_estructura, gsi_visual,
          control_estructural, efectos_voladura,
          ucs_mpa, is50_mpa
        },
        joints
      };
    }

    setDetectedTemplateCells(cellsFound);
    const codes = Object.keys(cellsFound);
    if (codes.length > 0) {
      setSelectedCeldaCode(codes[0]);
    } else {
      setSelectedCeldaCode('');
    }
  };

  // 2. Parser para tablas planas ("BD") con mapeo dinámico
  const parseFlatTable = (grid: any[][]) => {
    setRawGrid(grid);

    let bestRowIdx = 0;
    let maxMatches = -1;
    const maxScan = Math.min(15, grid.length);

    const normalize = (val: any): string => {
      if (val === null || val === undefined) return '';
      return String(val)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
    };

    for (let r = 0; r < maxScan; r++) {
      const row = grid[r];
      if (!row) continue;
      let matches = 0;
      const normalizedCells = row.map(c => normalize(c));

      EXPECTED_FIELDS.forEach(f => {
        const hasMatch = f.synonyms.some(s => normalizedCells.includes(s));
        if (hasMatch) matches++;
      });

      if (matches > maxMatches) {
        maxMatches = matches;
        bestRowIdx = r;
      }
    }

    setHeaderRowIdx(bestRowIdx);

    const headerRow = grid[bestRowIdx] || [];
    const formattedHeaders = headerRow.map((h, i) => {
      const letter = XLSX.utils.encode_col(i);
      const label = h !== null && h !== undefined ? String(h).trim() : '';
      return label ? `${letter}: ${label}` : `${letter}: [Vacío]`;
    });
    setExcelHeaders(formattedHeaders);

    const suggested: Record<string, number> = {};
    const normalizedHeaders = headerRow.map(h => normalize(h));
    const used = new Set<number>();

    EXPECTED_FIELDS.forEach(f => {
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (used.has(i)) continue;
        if (normalizedHeaders[i] === f.key) {
          suggested[f.key] = i;
          used.add(i);
          break;
        }
      }
    });

    EXPECTED_FIELDS.forEach(f => {
      if (suggested[f.key] !== undefined) return;
      for (const syn of f.synonyms) {
        let found = false;
        for (let i = 0; i < normalizedHeaders.length; i++) {
          if (used.has(i)) continue;
          if (normalizedHeaders[i] === syn) {
            suggested[f.key] = i;
            used.add(i);
            found = true;
            break;
          }
        }
        if (found) break;
      }
    });

    setMappings(suggested);
    runGrouping(grid, bestRowIdx, suggested);
  };

  const runGrouping = (grid: any[][], headerRowIndex: number, currentMappings: Record<string, number>) => {
    const celdasData: Record<string, WindowData> = {};

    const getVal = (row: any[], key: string) => {
      const idx = currentMappings[key];
      return idx !== undefined ? row[idx] : undefined;
    };

    const getNum = (row: any[], key: string, fallback = 0) => {
      const val = getVal(row, key);
      if (val === null || val === undefined) return fallback;
      const num = parseFloat(val);
      return isNaN(num) ? fallback : num;
    };

    const getStr = (row: any[], key: string, fallback = "") => {
      const val = getVal(row, key);
      return val !== null && val !== undefined ? String(val).trim() : fallback;
    };

    for (let r = headerRowIndex + 1; r < grid.length; r++) {
      const row = grid[r];
      if (!row || row.length === 0) continue;

      const celdaCode = getStr(row, 'celda').toUpperCase();
      if (!celdaCode) continue;

      if (!celdasData[celdaCode]) {
        const rawLitoModel = getStr(row, 'lito_model');
        const rawLito3 = getStr(row, 'lito_3');
        const litoDetails = detectLithology(rawLitoModel, rawLito3);

        celdasData[celdaCode] = {
          header: {
            celda: celdaCode,
            este_from: roundDec(getNum(row, 'este_from', 0), 2),
            norte_from: roundDec(getNum(row, 'norte_from', 0), 2),
            cota_from: roundDec(getNum(row, 'cota_from', 0), 2),
            este_to: roundDec(getNum(row, 'este_to', 0), 2),
            norte_to: roundDec(getNum(row, 'norte_to', 0), 2),
            cota_to: roundDec(getNum(row, 'cota_to', 0), 2),
            altura: roundDec(getNum(row, 'altura', 15.0), 1),
            dip_talud: roundDec(getNum(row, 'dip_talud', 64.0), 2),

            dipdir_talud: roundDec(getNum(row, 'dipdir_talud', 247.0), 2),
            dip_hw: roundDec(getNum(row, 'dip_hw', 0.0), 2),
            az_hw: roundDec(getNum(row, 'az_hw', 0.0), 2),

            ...litoDetails,
            mapeador: getStr(row, 'mapeador', 'AS-HM'),
            sector: getStr(row, 'sector', 'E1'),
            fase: getStr(row, 'fase', '5'),
            nivel: String(roundDec(getNum(row, 'nivel', 3960), 2)),
            sect_geot: getStr(row, 'sect_geot', 'E1'),
            fecha: parseDateStr(getVal(row, 'fecha')),
            condicion_agua: getStr(row, 'condicion_agua', 'C'),
            resistencia_ucs: getStr(row, 'resistencia_ucs', 'R4'),
            alt_zona: getStr(row, 'alt_zona', ''),
            intemperia: getStr(row, 'intemperia', ''),

            // Campos RMR numéricos adicionados con redondeo estricto a 2 decimales
            ucs_mpa: roundDec(getNum(row, 'ucs_mpa', 73.00), 2),
            is50_mpa: roundDec(getNum(row, 'is50_mpa', 5.00), 2),
            gsi_visual: roundDec(getNum(row, 'gsi_visual', 56.00), 2),
            gsi_superficie: getStr(row, 'gsi_superficie', 'G'),
            gsi_estructura: getStr(row, 'gsi_estructura', 'VB'),
            control_estructural: Math.round(getNum(row, 'control_estructural', 3)),
            efectos_voladura: Math.round(getNum(row, 'efectos_voladura', 3))
          },
          joints: []
        };
      }

      const famVal = getVal(row, 'familia');
      if (famVal !== null && famVal !== undefined && String(famVal).trim() !== "") {
        const fam = parseInt(famVal);
        if (!isNaN(fam)) {
          const dip = Math.min(90, Math.max(0, roundDec(getNum(row, 'dip', 45), 2)));
          const dip_dir = Math.min(359, Math.max(0, roundDec(getNum(row, 'dip_dir', 180), 2)));

          const raw_nstr = Math.round(getNum(row, 'n_estructuras', 1));
          const n_estructuras = raw_nstr > 0 ? raw_nstr : -1;
          const distancia = Math.max(0, Math.round(getNum(row, 'distancia', 0)));
          const abertura = roundDec(getNum(row, 'abertura', 0.1), 1);
          const espesor = roundDec(getNum(row, 'espesor', 0), 1);
          const espaciamiento = roundDec(getNum(row, 'espaciamiento', 0.5), 2);

          const jrc = sanitizeRange(getNum(row, 'jrc'), 0, 20);
          const rugosidad = sanitizeRange(getNum(row, 'rugosidad'), 0, 9);
          const extremos_visibles = sanitizeRange(getNum(row, 'extremos_visibles'), 0, 2);
          const terminacion = sanitizeRange(getNum(row, 'terminacion'), 0, 3);

          celdasData[celdaCode].joints.push({
            id: celdasData[celdaCode].joints.length + 1,
            familia: fam,
            distancia,
            tipo_estructura: getStr(row, 'tipo_estructura', 'JN'),
            dip: dip !== -1 ? dip : undefined,
            dip_dir: dip_dir !== -1 ? dip_dir : undefined,
            n_estructuras,
            abertura,
            espesor,
            continuidad: roundDec(getNum(row, 'continuidad', 1.5), 2),
            espaciamiento,
            extremos_visibles,
            terminacion,
            relleno1: getStr(row, 'relleno1').toLowerCase() || 'cwf',
            relleno2: getStr(row, 'relleno2').toLowerCase() || undefined,
            jrc: jrc !== -1 ? jrc : undefined,
            rugosidad: rugosidad !== -1 ? rugosidad : -1,
            forma: getStr(row, 'forma', 'O'),
            alteracion: getStr(row, 'alteracion').toLowerCase() || 'd'
          });
        }
      }
    }

    setParsedWindowData(celdasData);
    const codes = Object.keys(celdasData).sort();
    setDetectedCeldas(codes);
    if (codes.length > 0) {
      setSelectedCeldaCode(codes[0]);
    } else {
      setSelectedCeldaCode('');
    }
  };

  const sanitizeRange = (val: number, min: number, max: number, fallback = -1): number => {
    if (isNaN(val) || val === null || val === undefined) return fallback;
    if (val < min || val > max) return fallback;
    return Math.round(val);
  };

  const handleMappingChange = (fieldKey: string, colIdx: number) => {
    if (!rawGrid) return;
    const updated = { ...mappings };
    if (colIdx !== -1) {
      Object.keys(updated).forEach(k => {
        if (updated[k] === colIdx && k !== fieldKey) {
          delete updated[k];
        }
      });
      updated[fieldKey] = colIdx;
    } else {
      delete updated[fieldKey];
    }
    setMappings(updated);
    runGrouping(rawGrid, headerRowIdx, updated);
  };

  const handleImportClick = () => {
    if (!selectedCeldaCode) {
      alert("Seleccione una celda para importar.");
      return;
    }
    const targetData = isStackedTemplate
      ? detectedTemplateCells[selectedCeldaCode]
      : parsedWindowData[selectedCeldaCode];

    if (!targetData) {
      alert("No se encontraron datos para la celda seleccionada.");
      return;
    }

    onImport(targetData);
    onClose();
    resetState();
  };

  const activeDataPreview = isStackedTemplate
    ? detectedTemplateCells[selectedCeldaCode]
    : parsedWindowData[selectedCeldaCode];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
      <div className="glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col border border-navy-800 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/95">

        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-orange-400 to-amber-500 w-full" />

        <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100 uppercase tracking-wider">
                Importación Avanzada desde Excel
              </h3>
              <p className="text-xs text-slate-400">
                Procesamiento local 100% offline con saneamiento y redondeo estricto de decimales
              </p>
            </div>
          </div>
          <button
            onClick={() => { onClose(); resetState(); }}
            className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {!file && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-navy-800 hover:border-orange-500/40 bg-navy-950/45 hover:bg-navy-950/70 rounded-xl p-10 text-center cursor-pointer transition-all space-y-4 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Upload size={22} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-200">
                    Arrastra tu planilla Excel aquí o haz clic para explorar
                  </p>
                  <p className="text-xs text-slate-500">
                    Soporta formatos estándar de celdas (.xlsx, .xls)
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 text-orange-400 text-xs font-semibold">
                * Nota: Formatos admitidos: Pestañas de scanline de detalle ('ventana') o tablas planas estructuradas ('BD').
              </div>
            </div>
          )}

          {file && (
            <div className="space-y-6">
              {/* Selector de Pestañas y Acciones */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-navy-950/40 p-4 rounded-xl border border-navy-800">
                <div className="flex items-center gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Hoja de cálculo activa</label>
                    <select
                      value={selectedSheet}
                      onChange={(e) => {
                        setSelectedSheet(e.target.value);
                        if (workbook) processSheet(workbook, e.target.value);
                      }}
                      className="bg-navy-900 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-bold focus:outline-none cursor-pointer"
                    >
                      {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleMode(true)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all border ${isStackedTemplate
                      ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 font-extrabold'
                      : 'bg-navy-900 border-navy-800/80 text-slate-400 hover:text-slate-300'
                      }`}
                  >
                    Plantilla Apilada ("ventana")
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleMode(false)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all border ${!isStackedTemplate
                      ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 font-extrabold'
                      : 'bg-navy-900 border-navy-800/80 text-slate-400 hover:text-slate-300'
                      }`}
                  >
                    Tabla Plana / Mapeable ("BD")
                  </button>
                </div>
              </div>

              {!isStackedTemplate && rawGrid && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  <div className="lg:col-span-1 glass-panel p-4 rounded-xl border border-navy-800 space-y-4 max-h-[50vh] overflow-y-auto bg-navy-950/40">
                    <div className="flex items-center gap-2 text-orange-400 border-b border-navy-800 pb-2">
                      <Filter size={16} />
                      <h4 className="text-xs font-black uppercase tracking-wider">Mapear Columnas</h4>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      {EXPECTED_FIELDS.map(f => {
                        const isMapped = mappings[f.key] !== undefined;
                        return (
                          <div key={f.key} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-slate-300">
                                {f.label} {f.required && <span className="text-red-400">*</span>}
                              </span>
                              {isMapped ? (
                                <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Mapeado</span>
                              ) : (
                                f.required && <span className="text-xs text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Requerido</span>
                              )}
                            </div>

                            <select
                              value={mappings[f.key] ?? -1}
                              onChange={(e) => handleMappingChange(f.key, parseInt(e.target.value))}
                              className={`w-full bg-navy-900 border text-xs rounded-lg px-2 py-1.5 focus:outline-none transition-all ${isMapped ? 'border-orange-500/30 text-orange-300' : 'border-navy-800 text-slate-400 hover:border-navy-700'
                                }`}
                            >
                              <option value={-1}>— No Asignado —</option>
                              {excelHeaders.map((eh, idx) => (
                                <option key={idx} value={idx}>{eh}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-4">
                    {detectedCeldas.length > 0 ? (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                          Celdas Geomecánicas Detectadas ({detectedCeldas.length}):
                        </label>
                        <div className="flex flex-wrap gap-2 p-3 border border-navy-850 rounded-xl bg-navy-950/35 max-h-36 overflow-y-auto">
                          {detectedCeldas.map(code => {
                            const cData = parsedWindowData[code];
                            const isSelected = selectedCeldaCode === code;
                            return (
                              <button
                                key={code}
                                onClick={() => setSelectedCeldaCode(code)}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 ${isSelected
                                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.15)] font-black'
                                  : 'bg-navy-900/40 border-navy-800 text-slate-400 hover:bg-navy-900/60 hover:text-slate-300'
                                  }`}
                              >
                                <span>{code}</span>
                                <span className="text-xs text-slate-500 bg-navy-950 px-1 py-0.5 rounded">
                                  {cData.joints.length} estruct.
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-500 flex gap-2">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span>No se han detectado celdas geomecánicas. Asegúrate de mapear las columnas requeridas (Código Celda, Coordenadas, Familia, Distancia, Dip y DipDir).</span>
                      </div>
                    )}

                    {activeDataPreview && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Vista Previa de Estructuras para {selectedCeldaCode} (Primeros 5 registros):
                        </h4>

                        <div className="overflow-x-auto border border-navy-850 rounded-lg">
                          <table className="w-full text-xs text-left border-collapse text-slate-300">
                            <thead>
                              <tr className="bg-navy-950 text-slate-400 font-semibold border-b border-navy-850">
                                <th className="py-2 px-3">Set / Fam</th>
                                <th className="py-2 px-3 text-center">Dist (m)</th>
                                <th className="py-2 px-3 text-center">Tipo</th>
                                <th className="py-2 px-3 text-center">Dip (°)</th>
                                <th className="py-2 px-3 text-center">DipDir (°)</th>
                                <th className="py-2 px-3 text-center">Abert (mm)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeDataPreview.joints.slice(0, 5).map((j, i) => (
                                <tr key={i} className="border-b border-navy-900/40 bg-navy-900/10">
                                  <td className="py-2 px-3 font-semibold text-slate-200">F{j.familia}</td>
                                  <td className="py-2 px-3 text-center">{j.distancia}</td>
                                  <td className="py-2 px-3 text-center">{j.tipo_estructura}</td>
                                  <td className="py-2 px-3 text-center">{j.dip}</td>
                                  <td className="py-2 px-3 text-center">{j.dip_dir}</td>
                                  <td className="py-2 px-3 text-center">{j.abertura}</td>
                                </tr>
                              ))}
                              {activeDataPreview.joints.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="py-6 text-center text-slate-500 font-medium">
                                    No hay juntas estructuradas en este tramo.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isStackedTemplate && (
                <div className="space-y-4">
                  {Object.keys(detectedTemplateCells).length > 0 ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                          Celdas Geomecánicas Detectadas en la Planilla ({Object.keys(detectedTemplateCells).length}):
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1">
                          {Object.keys(detectedTemplateCells).map(code => {
                            const cData = detectedTemplateCells[code];
                            const isSelected = selectedCeldaCode === code;
                            return (
                              <div
                                key={code}
                                onClick={() => setSelectedCeldaCode(code)}
                                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${isSelected
                                  ? 'bg-orange-500/10 border-orange-500/40 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.15)] font-bold'
                                  : 'bg-navy-950/40 border-navy-800 text-slate-400 hover:bg-navy-900/60 hover:text-slate-300'
                                  }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-black tracking-wide">{code}</span>
                                  {isSelected && <Check size={14} className="text-orange-400" />}
                                </div>
                                <div className="flex justify-between items-center text-xs text-slate-500">
                                  <span>{cData.header.lito_2 || cData.header.lito_1}</span>
                                  <span>{cData.joints.length} estruct.</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {activeDataPreview && (
                        <div className="space-y-2 border-t border-navy-850 pt-4">
                          <div className="flex justify-between items-center text-xs text-slate-400">
                            <span className="font-bold text-slate-300 uppercase tracking-wider">
                              Cabecera de Celda ({selectedCeldaCode}):
                            </span>
                            <span>Fecha Mapeo: {activeDataPreview.header.fecha} | Geólogo: {activeDataPreview.header.mapeador}</span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-navy-950/45 border border-navy-850 p-3.5 rounded-xl text-xs text-slate-300">
                            <div><span className="text-slate-500">Desde:</span> {activeDataPreview.header.este_from}, {activeDataPreview.header.norte_from}, {activeDataPreview.header.cota_from}</div>
                            <div><span className="text-slate-500">Hasta:</span> {activeDataPreview.header.este_to}, {activeDataPreview.header.norte_to}, {activeDataPreview.header.cota_to}</div>
                            <div><span className="text-slate-500">Altura / Dip:</span> {activeDataPreview.header.altura}m / {activeDataPreview.header.dip_talud}°</div>
                            <div><span className="text-slate-500">Agua / Resis:</span> {activeDataPreview.header.condicion_agua} / {activeDataPreview.header.resistencia_ucs}</div>
                          </div>

                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">
                            Discontinuidades de la Celda ({activeDataPreview.joints.length} registros):
                          </h4>

                          <div className="overflow-x-auto border border-navy-850 rounded-xl">
                            <table className="w-full text-xs text-left border-collapse text-slate-300">
                              <thead>
                                <tr className="bg-navy-950 text-slate-400 font-semibold border-b border-navy-850">
                                  <th className="py-2.5 px-3">Set</th>
                                  <th className="py-2.5 px-3 text-center">Distancia (m)</th>
                                  <th className="py-2.5 px-3 text-center">Tipo</th>
                                  <th className="py-2.5 px-3 text-center">Buzamiento (°)</th>
                                  <th className="py-2.5 px-3 text-center">Dir. Buzamiento (°)</th>
                                  <th className="py-2.5 px-3 text-center">Abert (mm)</th>
                                  <th className="py-2.5 px-3">Relleno 1</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeDataPreview.joints.slice(0, 5).map((j, i) => (
                                  <tr key={i} className="border-b border-navy-900/40 bg-navy-900/10">
                                    <td className="py-2.5 px-3 font-semibold text-slate-200">F{j.familia}</td>
                                    <td className="py-2.5 px-3 text-center">{j.distancia}</td>
                                    <td className="py-2.5 px-3 text-center">{j.tipo_estructura}</td>
                                    <td className="py-2.5 px-3 text-center">{j.dip}</td>
                                    <td className="py-2.5 px-3 text-center">{j.dip_dir}</td>
                                    <td className="py-2.5 px-3 text-center">{j.abertura}</td>
                                    <td className="py-2.5 px-3">{j.relleno1}</td>
                                  </tr>
                                ))}
                                {activeDataPreview.joints.length > 5 && (
                                  <tr>
                                    <td colSpan={7} className="py-2 px-3 text-center text-slate-500 italic bg-navy-950/20">
                                      y {activeDataPreview.joints.length - 5} estructuras adicionales...
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-500 flex gap-2">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <span>No se ha detectado ninguna estructura en el rango esperado de esta pestaña. Revise el formato.</span>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t border-navy-800/80 shrink-0 bg-navy-950/40">
          <button
            type="button"
            onClick={() => { onClose(); resetState(); }}
            className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95"
          >
            Cancelar
          </button>
          <button
            onClick={handleImportClick}
            disabled={!selectedCeldaCode}
            className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-800 dark:text-orange-400 px-4.5 py-2 rounded-lg text-xs font-black transition-all shadow-sm active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed animate-pulse-ring flex items-center gap-1.5"
          >
            <span>Importar Datos</span>
            <ArrowRight size={14} />
          </button>
        </div>

      </div>
    </div>
  );
}