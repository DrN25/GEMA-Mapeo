import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { X, FileSpreadsheet, Upload, AlertTriangle, Check, ArrowRight, Info, Filter } from 'lucide-react';
import type { WindowHeader, JointRow } from '../utils/rmrCalculator';

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

// Expected fields for mapping a flat "BD" style sheet
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
  { key: 'lito_3', label: 'Litología (Lito-3)', required: false, synonyms: ['lito3', 'litologia3', 'lito_3', 'litocm', 'litologia_3'] },
  { key: 'lito_model', label: 'Lito Modelo', required: false, synonyms: ['litomodel', 'lito_model', 'litologia1', 'lito1', 'lito_1', 'litock'] },
  { key: 'mapeador', label: 'Geólogo Mapeador', required: false, synonyms: ['mapeador', 'geologo', 'geot', 'mapeado_por', 'logged_by', 'geotecnico'] },
  { key: 'fecha', label: 'Fecha Mapeo', required: false, synonyms: ['fecha', 'fechamapeo', 'fecha_mapeo', 'date', 'fechabg'] },
  { key: 'condicion_agua', label: 'Agua Subterránea', required: false, synonyms: ['condicionagua', 'condicion_agua', 'aguasubterranea', 'agua', 'water', 'aguacode', 'aguadeobs'] },
  { key: 'resistencia_ucs', label: 'Resistencia UCS', required: false, synonyms: ['resistenciaucs', 'resistencia_ucs', 'ucs', 'dureza', 'strength', 'rescode'] },
  
  // Joint / Discontinuity properties
  { key: 'familia', label: 'Familia', required: true, synonyms: ['familia', 'fam', 'family', 'set'] },
  { key: 'distancia', label: 'Distancia (m)', required: true, synonyms: ['distancia', 'distanciam', 'distance', 'dist', 'distanciambk'] },
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
  { key: 'relleno1', label: 'Relleno 1', required: false, synonyms: ['relleno1', 'relleno_1', 'relleno', 'tiporelleno1', 'tipoderelleno1bz'] },
  { key: 'relleno2', label: 'Relleno 2', required: false, synonyms: ['relleno2', 'relleno_2', 'tiporelleno2', 'tipoderelleno2ca'] },
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
  
  // Sheet type auto-detected
  const [isStackedTemplate, setIsStackedTemplate] = useState<boolean>(true);

  // MAPPED MODE STATE (For flat tables like "BD")
  const [rawGrid, setRawGrid] = useState<any[][] | null>(null);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, number>>({});
  const [detectedCeldas, setDetectedCeldas] = useState<string[]>([]);
  const [selectedCeldaCode, setSelectedCeldaCode] = useState<string>('');
  const [parsedWindowData, setParsedWindowData] = useState<Record<string, WindowData>>({});

  // STACKED MODE STATE (For template tab "ventana")
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

        // Find primary target sheet (ventana or BD)
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

    const isStacked = sheetName.toLowerCase().includes("ventana");
    setIsStackedTemplate(isStacked);

    if (isStacked) {
      parseStackedTemplate(grid);
    } else {
      parseFlatTable(grid);
    }
  };

  // 1. Parser for standard vertical stacked cards template ("ventana" tab)
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

    const parseDateStr = (val: any): string => {
      if (!val) return new Date().toISOString().split('T')[0];
      if (val instanceof Date) return val.toISOString().split('T')[0];
      const str = String(val).trim();
      return str.substring(0, 10);
    };

    for (let start = 2; start < grid.length; start += 30) {
      let celdaVal = grid[start + 1]?.[0]; // Row 4 Col A
      if (!celdaVal) {
        celdaVal = grid[start]?.[50]; // Row 3 Col AY (index 50)
      }
      if (!celdaVal || !String(celdaVal).trim()) continue;
      const codigo = String(celdaVal).trim().toUpperCase();

      const este_from = getNum(start + 2, 1);
      const norte_from = getNum(start + 2, 3);
      const cota_from = getNum(start + 2, 5);
      const este_to = getNum(start + 3, 1);
      const norte_to = getNum(start + 3, 3);
      const cota_to = getNum(start + 3, 5);
      const altura = getNum(start + 3, 10);
      const dip_talud = getNum(start + 2, 13);

      const lito_3 = getStr(start + 1, 15);
      const lito_model = getStr(start + 4, 15);
      const mapeador = getStr(start + 5, 15);
      const sector = getStr(start + 1, 19);
      const fase = String(Math.round(getNum(start + 2, 20)) || 5);
      const nivel = String(getNum(start + 3, 20) || 3960);
      const sect_geot = getStr(start + 4, 20);
      const fecha = parseDateStr(grid[start + 1]?.[36]);

      const condicion_agua = getStr(start + 8, 35) || 'C';
      const resistencia_ucs = getStr(start + 8, 37) || 'R4';

      const joints: JointRow[] = [];
      let jId = 1;
      
      for (let r = start + 14; r <= start + 27; r++) {
        const famVal = grid[r]?.[0];
        if (famVal === null || famVal === undefined || String(famVal).trim() === "") continue;
        const fam = parseInt(famVal);
        if (isNaN(fam)) continue;

        joints.push({
          id: jId++,
          familia: fam,
          distancia: getNum(r, 1),
          tipo_estructura: getStr(r, 2) || 'J',
          dip: getNum(r, 3),
          dip_dir: getNum(r, 4),
          n_estructuras: getNum(r, 5) || 1,
          abertura: getNum(r, 6),
          espesor: getNum(r, 7),
          continuidad: getNum(r, 8),
          espaciamiento: getNum(r, 9),
          extremos_visibles: getNum(r, 10),
          terminacion: getNum(r, 11),
          relleno1: getStr(r, 12) || 'cwf',
          relleno2: getStr(r, 13) || undefined,
          jrc: getNum(r, 18) || 10,
          rugosidad: getNum(r, 19) || 2,
          forma: getStr(r, 20) || 'O',
          alteracion: getStr(r, 21) || 'd'
        });
      }

      cellsFound[codigo] = {
        header: {
          celda: codigo,
          este_from, norte_from, cota_from,
          este_to, norte_to, cota_to,
          altura, dip_talud, lito_3, lito_model,
          mapeador, sector, fase, nivel, sect_geot,
          fecha, condicion_agua, resistencia_ucs
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

  // 2. Advanced Generic Parser for Flat database layouts ("BD" tab) with mappings
  const parseFlatTable = (grid: any[][]) => {
    setRawGrid(grid);

    // Find header row indices by checking synapses
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
      return label ? `${letter}: ${label}` : `${letter}: [Vacio]`;
    });
    setExcelHeaders(formattedHeaders);

    // Initial suggested mappings
    const suggested: Record<string, number> = {};
    const normalizedHeaders = headerRow.map(h => normalize(h));
    const used = new Set<number>();

    // Exact key matches first
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

    // Synonyms match next
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

  // Group rows of the flat grid into separate celdas using current mappings
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

    const parseDateStr = (val: any): string => {
      if (!val) return new Date().toISOString().split('T')[0];
      if (val instanceof Date) return val.toISOString().split('T')[0];
      const str = String(val).trim();
      return str.substring(0, 10);
    };

    for (let r = headerRowIndex + 1; r < grid.length; r++) {
      const row = grid[r];
      if (!row || row.length === 0) continue;

      const celdaCode = getStr(row, 'celda').toUpperCase();
      if (!celdaCode) continue;

      if (!celdasData[celdaCode]) {
        celdasData[celdaCode] = {
          header: {
            celda: celdaCode,
            este_from: getNum(row, 'este_from', 0),
            norte_from: getNum(row, 'norte_from', 0),
            cota_from: getNum(row, 'cota_from', 0),
            este_to: getNum(row, 'este_to', 0),
            norte_to: getNum(row, 'norte_to', 0),
            cota_to: getNum(row, 'cota_to', 0),
            altura: getNum(row, 'altura', 15.0),
            dip_talud: getNum(row, 'dip_talud', 64.0),
            lito_3: getStr(row, 'lito_3', 'MZQ'),
            lito_model: getStr(row, 'lito_model', 'MZQ_M'),
            mapeador: getStr(row, 'mapeador', 'AS-HM'),
            sector: getStr(row, 'sector', 'E1'),
            fase: getStr(row, 'fase', '5'),
            nivel: getStr(row, 'nivel', '3960'),
            sect_geot: getStr(row, 'sect_geot', 'E1'),
            fecha: parseDateStr(getVal(row, 'fecha')),
            condicion_agua: getStr(row, 'condicion_agua', 'C'),
            resistencia_ucs: getStr(row, 'resistencia_ucs', 'R4')
          },
          joints: []
        };
      }

      // Check if this row contains valid joint structure details (require set / set-distancia)
      const famVal = getVal(row, 'familia');
      if (famVal !== null && famVal !== undefined && String(famVal).trim() !== "") {
        const fam = parseInt(famVal);
        if (!isNaN(fam)) {
          celdasData[celdaCode].joints.push({
            id: celdasData[celdaCode].joints.length + 1,
            familia: fam,
            distancia: getNum(row, 'distancia', 0),
            tipo_estructura: getStr(row, 'tipo_estructura', 'J'),
            dip: getNum(row, 'dip', 45),
            dip_dir: getNum(row, 'dip_dir', 180),
            n_estructuras: getNum(row, 'n_estructuras', 1),
            abertura: getNum(row, 'abertura', 0.1),
            espesor: getNum(row, 'espesor', 0),
            continuidad: getNum(row, 'continuidad', 1.5),
            espaciamiento: getNum(row, 'espaciamiento', 0.5),
            extremos_visibles: getNum(row, 'extremos_visibles', 1),
            terminacion: getNum(row, 'terminacion', 0),
            relleno1: getStr(row, 'relleno1', 'cwf'),
            relleno2: getStr(row, 'relleno2') || undefined,
            jrc: getNum(row, 'jrc', 10),
            rugosidad: getNum(row, 'rugosidad', 2),
            forma: getStr(row, 'forma', 'O'),
            alteracion: getStr(row, 'alteracion', 'd')
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

  const handleMappingChange = (fieldKey: string, colIdx: number) => {
    if (!rawGrid) return;
    const updated = { ...mappings };
    if (colIdx !== -1) {
      // Enforce unique mapping
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
        
        {/* Top colorful gradient border from stable taladros */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-orange-400 to-amber-500 w-full" />

        {/* Head */}
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
                Procesamiento local 100% offline (sin conexión a base de datos requerida)
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

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Upload step */}
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
              
              <div className="flex gap-3.5 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 text-xs text-slate-300 leading-relaxed shadow-sm">
                <Info className="text-orange-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="font-bold text-slate-200 block mb-0.5">Tipos de Planilla Soportados:</span>
                  <ul className="list-disc pl-4 space-y-1 mt-1">
                    <li><strong>Pestaña "ventana":</strong> Tarjetas de celdas apiladas verticalmente cada 30 filas (formato original).</li>
                    <li><strong>Pestaña "BD":</strong> Formato desnormalizado plano con todas las discontinuidades y columnas geomecánicas. El sistema permite mapear las columnas manualmente si las cabeceras varían.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Active Work Area */}
          {file && (
            <div className="space-y-6">
              
              {/* File details banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-navy-950/60 border border-navy-850 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 text-orange-400 rounded-lg">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-200 truncate max-w-xs md:max-w-md">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB | Tipo: {isStackedTemplate ? 'Plantilla Apilada ("ventana")' : 'Tabla Plana ("BD")'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {sheets.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">Hoja:</span>
                      <select
                        value={selectedSheet}
                        onChange={(e) => {
                          setSelectedSheet(e.target.value);
                          if (workbook) processSheet(workbook, e.target.value);
                        }}
                        className="bg-navy-900 border border-navy-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      >
                        {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                  <button
                    onClick={resetState}
                    className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded bg-red-500/10 border border-red-500/20 transition-all active:scale-95"
                  >
                    Cambiar archivo
                  </button>
                </div>
              </div>

              {/* DYNAMIC MAPPING MODE (Flat "BD" layout) */}
              {!isStackedTemplate && rawGrid && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Mappings panel */}
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
                                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Mapeado</span>
                              ) : (
                                f.required && <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Requerido</span>
                              )}
                            </div>
                            
                            <select
                              value={mappings[f.key] ?? -1}
                              onChange={(e) => handleMappingChange(f.key, parseInt(e.target.value))}
                              className={`w-full bg-navy-900 border text-xs rounded-lg px-2 py-1.5 focus:outline-none transition-all ${
                                isMapped ? 'border-orange-500/30 text-orange-300' : 'border-navy-800 text-slate-400 hover:border-navy-700'
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

                  {/* Right Column: Previews and Celdas found */}
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
                                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 ${
                                  isSelected
                                    ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.15)]'
                                    : 'bg-navy-900/40 border-navy-800 text-slate-400 hover:bg-navy-900/60 hover:text-slate-300'
                                }`}
                              >
                                <span>{code}</span>
                                <span className="text-[10px] text-slate-500 bg-navy-950 px-1 py-0.5 rounded">
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

                    {/* Preview Table of joints in the active window */}
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
                                  <td className="py-2 px-3 text-center">{j.distancia.toFixed(2)}</td>
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

              {/* STACKED CARD TEMPLATE MODE ("ventana" sheet) */}
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
                                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                                  isSelected
                                    ? 'bg-orange-500/10 border-orange-500/40 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.15)] font-bold'
                                    : 'bg-navy-950/40 border-navy-800 text-slate-400 hover:bg-navy-900/60 hover:text-slate-300'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-black tracking-wide">{code}</span>
                                  {isSelected && <Check size={14} className="text-orange-400" />}
                                </div>
                                <div className="flex justify-between items-center text-[11px] text-slate-500">
                                  <span>{cData.header.lito_3}</span>
                                  <span>{cData.joints.length} estruct.</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Preview table for the template selection */}
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
                                    <td className="py-2.5 px-3 text-center">{j.distancia.toFixed(2)}</td>
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

        {/* Footer actions */}
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
