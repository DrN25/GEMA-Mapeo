import { useState, useEffect } from 'react';
import { Save, ArrowLeft, BarChart3, Layers, Gauge, BookOpen, X, Calculator, Eye, FileSpreadsheet } from 'lucide-react';

import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import type { WindowSummary } from './components/Dashboard/Dashboard';
import VentanaForm from './components/VentanaForm';
import DisconTable from './components/DisconTable';
import RmrAnalysis from './components/RmrAnalysis';
import StructurePlot from './components/StructurePlot';
import ValidationPanel from './components/ValidationPanel';
import ExcelImportModal from './components/ExcelImportModal';

import CatalogsView from './components/CatalogsView';
import CommentsPhotos from './components/CommentsPhotos';
import PltEnsayosView from './components/PltEnsayosView';

import {
  calculateWindowGeomec,
  type WindowHeader,
  type JointRow,
  type CalculatorResult
} from './utils/rmrCalculator';

import { validateWindowQAQC } from './utils/qaqcValidator';
import type { ValidationAlert } from './utils/qaqcValidator';

interface WindowData {
  header: WindowHeader;
  joints: JointRow[];
}

const API_BASE = import.meta.env.VITE_API_BASE || "";
const RESOLVED_API_BASE = API_BASE || `${window.location.protocol}//${window.location.hostname}:8001`;

const normalizeJoints = (loadedJoints: JointRow[], defaultAlt: string = 'd'): JointRow[] => {
  const mappedJoints = (loadedJoints || []).map(j => ({
    ...j,
    tipo_estructura: (j.tipo_estructura && j.tipo_estructura.toUpperCase() === 'J') ? 'JN' : (j.tipo_estructura || 'JN'),
    alteracion: (j.alteracion && j.alteracion !== '-1') ? j.alteracion : defaultAlt
  }));

  const result: JointRow[] = [...mappedJoints];
  const maxFam = Math.max(3, ...mappedJoints.map(j => j.familia));
  for (let fam = 1; fam <= maxFam; fam++) {
    const count = result.filter(j => j.familia === fam).length;
    for (let i = count; i < 3; i++) {
      result.push({
        id: result.length + 1,
        familia: fam,
        distancia: -1,
        tipo_estructura: 'JN',
        dip: -1,
        dip_dir: -1,
        n_estructuras: -1,
        abertura: -1,
        espesor: -1,
        continuidad: -1,
        espaciamiento: -1,
        extremos_visibles: 1,
        terminacion: 0,
        relleno1: 'cwf',
        relleno2: undefined,
        jrc: -1,
        rugosidad: -1,
        forma: 'O',
        alteracion: defaultAlt
      });
    }
  }
  return result
    .sort((a, b) => a.familia - b.familia)
    .map((j, idx) => ({ ...j, id: idx + 1 }));
};

export default function App() {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [windows, setWindows] = useState<WindowSummary[]>([]);
  const [activeWindow, setActiveWindow] = useState<WindowData | null>(null);
  const [pltEnsayos, setPltEnsayos] = useState<any[]>([]);
  const [showFormulas, setShowFormulas] = useState<boolean>(true);

  // UI & Theme
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  // Backend Sync Status
  const [syncStatus, setSyncStatus] = useState<'synced' | 'unsaved' | 'saving' | 'offline'>('synced');
  const [syncMessage, setSyncMessage] = useState<string>('Conectado al servidor de base de datos SQL Server.');

  // Real-time calculated results & alerts
  const [calculated, setCalculated] = useState<CalculatorResult | null>(null);
  const [alerts, setAlerts] = useState<ValidationAlert[]>([]);

  // Photos & Captions states
  const [photos, setPhotos] = useState<string[]>(['', '', '', '']);
  const [captions, setCaptions] = useState<string[]>(['', '', '', '']);

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState<boolean>(false);
  const [isCommentsExpanded, setIsCommentsExpanded] = useState<boolean>(false);

  // 1. Initialize Dark Mode Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // 1.5. Evitar de forma global que el scroll del mouse modifique los valores de inputs numéricos y desplegables sin bloquear el scroll de la página
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const isInputNumber = activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'number';
        const isSelect = activeEl.tagName === 'SELECT';

        if (isInputNumber || isSelect) {
          (activeEl as HTMLElement).blur();
        }
      }
    };

    document.addEventListener('wheel', handleGlobalWheel, { passive: true });
    return () => {
      document.removeEventListener('wheel', handleGlobalWheel);
    };
  }, []);

  // 2. Fetch window summaries and PLT trials on mount
  useEffect(() => {
    fetchWindows();
    fetchPltEnsayos();
  }, []);

  // 3. Keep RMR calculations and QA/QC validation updated in real-time
  useEffect(() => {
    if (activeWindow) {
      const res = calculateWindowGeomec(activeWindow.header, activeWindow.joints);
      setCalculated(res);
      const errs = validateWindowQAQC(activeWindow.header, activeWindow.joints, res.largo);
      setAlerts(errs);
    } else {
      setCalculated(null);
      setAlerts([]);
    }
  }, [activeWindow]);

  // 3.5. Reevaluación en cascada de distancias (m) al largo máximo de la celda
  useEffect(() => {
    if (!activeWindow) return;

    // Determinamos el largo de referencia más confiable
    let maxLargo = 0;
    if (calculated && calculated.largo > 0) {
      maxLargo = calculated.largo;
    } else {
      const ix = parseFloat(String(activeWindow.header.este_from));
      const iy = parseFloat(String(activeWindow.header.norte_from));
      const ic = parseFloat(String(activeWindow.header.cota_from));
      const fx = parseFloat(String(activeWindow.header.este_to));
      const fy = parseFloat(String(activeWindow.header.norte_to));
      const fc = parseFloat(String(activeWindow.header.cota_to));
      const hasCoords = [ix, iy, ic, fx, fy, fc].every(n => !isNaN(n) && n !== 0);
      maxLargo = hasCoords
        ? Math.round(Math.sqrt(Math.pow(fx - ix, 2) + Math.pow(fy - iy, 2) + Math.pow(fc - ic, 2)))
        : Math.round(Number(activeWindow.header.largo) || 0);
    }

    if (maxLargo > 0) {
      const needsAdjustment = activeWindow.joints.some(
        j => j.distancia !== -1 && j.distancia !== null && j.distancia > maxLargo
      );

      if (needsAdjustment) {
        const adjustedJoints = activeWindow.joints.map(j => {
          if (j.distancia !== -1 && j.distancia !== null && j.distancia > maxLargo) {
            return { ...j, distancia: maxLargo };
          }
          return j;
        });
        setActiveWindow(prev => prev ? { ...prev, joints: adjustedJoints } : null);
      }
    }
  }, [activeWindow?.header, calculated?.largo]);

  // 4. Synchronize photo loading from localStorage when the active window celda changes
  useEffect(() => {
    if (activeWindow?.header.celda) {
      fetch(`${API_BASE}/api/ventanas/${activeWindow.header.celda}/fotos`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then(data => {
          const resolvedPhotos = (data.photos || ['', '', '', '']).map((p: string) =>
            p ? (p.startsWith('http') || p.startsWith('data:') ? p : `${API_BASE}${p}`) : ''
          );
          setPhotos(resolvedPhotos);
          setCaptions(data.captions || ['', '', '', '']);
        })
        .catch(() => {
          setPhotos(['', '', '', '']);
          setCaptions(['', '', '', '']);
        });
    } else {
      setPhotos(['', '', '', '']);
      setCaptions(['', '', '', '']);
    }
  }, [activeWindow?.header.celda]);

  const handlePhotosChange = (newPhotos: string[], newCaptions: string[]) => {
    setPhotos(newPhotos);
    setCaptions(newCaptions);
  };

  const handleExportExcel = () => {
    if (!activeWindow) return;
    const celda = activeWindow.header.celda;
    window.location.href = `${API_BASE}/api/ventanas/${celda}/exportar`;
  };

  const fetchWindows = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ventanas`);
      if (res.ok) {
        const data = await res.json();
        const summaries: WindowSummary[] = data.map((v: any) => ({
          name: v.codigo,
          proyecto: "Proyecto A",
          geologo: v.mapeador || "N/A",
          largo: v.largo_m !== null && v.largo_m !== undefined ? Math.round(v.largo_m) : 5,
          altura: v.altura_m || 15.0,
          fecha_registro: v.fecha_mapeo || new Date().toISOString().split('T')[0],
          rmr_76: 60,
          rmr_89: 65,
          class_89: "Regular"
        }));
        setWindows(summaries);
        setSyncStatus('synced');
        setSyncMessage('Sincronizado con SQL Server.');
      } else {
        throw new Error();
      }
    } catch (e) {
      console.warn("Backend offline, loading from local cache.");
      setSyncStatus('offline');
      setSyncMessage("Servidor backend desconectado. Operando en modo local temporal.");
      const cached = localStorage.getItem('geolog_windows_summaries');
      if (cached) {
        setWindows(JSON.parse(cached));
      }
    }
  };

  const fetchPltEnsayos = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ensayos-plt`);
      if (res.ok) {
        const data = await res.json();
        setPltEnsayos(data);
      }
    } catch (e) {
      console.warn("Failed to fetch PLT trials from database, checking localStorage.");
      const cached = localStorage.getItem('plt_ensayos_v2');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setPltEnsayos(parsed.rows || parsed || []);
        } catch (err) {
          setPltEnsayos([]);
        }
      }
    }
  };

  const handleSelectWindow = async (name: string) => {
    setSyncStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/api/ventanas/${name}`);
      if (res.ok) {
        const v = await res.json();
        const roundDec = (val: any, decs: number): number => {
          if (val === null || val === undefined) return 0;
          const num = parseFloat(val);
          if (isNaN(num)) return 0;
          const factor = Math.pow(10, decs);
          return Math.round(num * factor) / factor;
        };

        const getFieldVal = (d: any, aliasKey: string, snakeKey: string, fallback: any = -1) => {
          const val = d[aliasKey] !== undefined && d[aliasKey] !== null ? d[aliasKey] : d[snakeKey];
          return val !== undefined && val !== null ? val : fallback;
        };

        const header: WindowHeader = {
          celda: v.codigo,
          este_from: roundDec(v.este_ini, 2),
          norte_from: roundDec(v.norte_ini, 2),
          cota_from: roundDec(v.cota_ini, 2),
          este_to: roundDec(v.este_fin, 2),
          norte_to: roundDec(v.norte_fin, 2),
          cota_to: roundDec(v.cota_fin, 2),
          altura: roundDec(v.altura_m, 1) || 15.0,
          dip_talud: roundDec(v.dip_talud, 2) || 64.0,

          dipdir_talud: v.dipdir_talud !== null && v.dipdir_talud !== undefined ? roundDec(v.dipdir_talud, 2) : undefined,
          dip_hw: v.dip_hw !== null && v.dip_hw !== undefined ? roundDec(v.dip_hw, 2) : undefined,
          az_hw: v.az_hw !== null && v.az_hw !== undefined ? roundDec(v.az_hw, 2) : undefined,

          unidad_litologica: v.unidad_litologica || '',
          lito_1: v.lito_1 || '',
          lito_2: v.lito_2 || '',
          lito_3: v.lito_3 || '',
          mapeador: v.mapeador || 'AS-HM',
          sector: v.sector || 'E1',
          fase: String(v.fase || '5'),
          nivel: String(roundDec(v.nivel, 2) || '3960'),
          sect_geot: v.sector_geotecnico || 'E1',
          intemperia: v.intemperismo_codigo || '',
          alt_zona: v.alteracion_codigo || '',
          fecha: v.fecha_mapeo || new Date().toISOString().split('T')[0],
          condicion_agua: v.rmr_input?.agua_codigo || 'C',
          resistencia_ucs: v.rmr_input?.resistencia_codigo || 'R4',
          comentario: v.rmr_input?.comentario || '',
          campania: v.campania !== null && v.campania !== undefined ? v.campania : 2026,
          turno: v.turno || 'Día',
          gsi_estructura: v.rmr_input?.gsi_estructura || 'VB',
          gsi_superficie: v.rmr_input?.gsi_superficie || 'G',
          gsi_visual: v.rmr_input?.gsi_visual !== null && v.rmr_input?.gsi_visual !== undefined ? v.rmr_input.gsi_visual : 56,
          control_estructural: v.rmr_input?.control_estructural !== null && v.rmr_input?.control_estructural !== undefined ? v.rmr_input.control_estructural : 3,
          efectos_voladura: v.rmr_input?.efectos_voladura !== null && v.rmr_input?.efectos_voladura !== undefined ? v.rmr_input.efectos_voladura : 3,
          ucs_mpa: v.rmr_input?.ucs_mpa !== null && v.rmr_input?.ucs_mpa !== undefined ? parseFloat(v.rmr_input.ucs_mpa) : 73,
          is50_mpa: v.rmr_input?.is50_mpa !== null && v.rmr_input?.is50_mpa !== undefined ? parseFloat(v.rmr_input.is50_mpa) : 5
        };

        const joints: JointRow[] = (v.discontinuidades || []).map((d: any, idx: number) => {
          const dist = getFieldVal(d, 'dist', 'distancia_m', -1);
          const nstr = getFieldVal(d, 'nstr', 'n_estructuras', -1);
          const aber = getFieldVal(d, 'aber', 'abertura_mm', -1);
          const esp = getFieldVal(d, 'esp', 'espesor_mm', -1);
          const cont = getFieldVal(d, 'cont', 'continuidad_m', -1);
          const espac = getFieldVal(d, 'espac', 'espaciamiento_m', -1);

          const dip_val = d.dip !== undefined && d.dip !== null ? d.dip : -1;
          const dip_dir_val = getFieldVal(d, 'dipdir', 'dip_dir', -1);

          const rug_val = getFieldVal(d, 'rug', 'rugosidad_codigo', -1);
          const ext_val = getFieldVal(d, 'next', 'n_extremos_visibles', 1);
          const term_val = getFieldVal(d, 'term', 'terminacion', 0);
          const r1_val = getFieldVal(d, 'r1', 'relleno_1_codigo', 'cwf');
          const r2_val = getFieldVal(d, 'r2', 'relleno_2_codigo', undefined);

          return {
            id: idx + 1,
            familia: d.fam || d.familia_id || 1,
            distancia: dist !== -1 ? Math.max(0, Math.round(dist)) : -1, // Entero positivo
            tipo_estructura: d.tipo || d.tipo_estructura || 'JN',
            dip: dip_val !== -1 ? roundDec(dip_val, 2) : -1,
            dip_dir: dip_dir_val !== -1 ? roundDec(dip_dir_val, 2) : -1,

            // Cant (n): Solo enteros positivos o -1
            n_estructuras: nstr !== -1 ? (Math.round(nstr) > 0 ? Math.round(nstr) : -1) : -1,

            abertura: aber !== -1 ? roundDec(aber, 1) : -1, // 1 decimal
            espesor: esp !== -1 ? roundDec(esp, 1) : -1,   // 1 decimal
            continuidad: cont !== -1 ? roundDec(cont, 2) : -1,
            espaciamiento: espac !== -1 ? roundDec(espac, 2) : -1, // 2 decimales

            extremos_visibles: Math.min(2, Math.max(0, ext_val)), // 0 a 2 (removido 3)
            terminacion: Math.min(3, Math.max(0, term_val)),     // 0 a 3 (removido 4 y 5)
            relleno1: r1_val === '-1' ? 'cwf' : r1_val,
            relleno2: r2_val === '-1' ? undefined : r2_val,
            jrc: d.jrc !== null && d.jrc !== undefined ? Math.min(20, Math.max(0, d.jrc)) : -1,
            rugosidad: rug_val !== -1 ? Math.min(9, Math.max(0, rug_val)) : -1, // Rango 0-9
            forma: d.forma || d.forma_estructura || 'O',
            alteracion: d.alt || d.alteracion_codigo || 'd'
          };
        });

        setActiveWindow({ header, joints: normalizeJoints(joints, header.intemperia) });
        setSyncStatus('synced');
        setCurrentView('mapeo');
        setSelectedRowIndex(0);
      } else {
        throw new Error();
      }
    } catch (e) {
      console.warn("Loading cached local window: ", name);
      const cached = localStorage.getItem(`geolog_window_${name}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.joints = normalizeJoints(parsed.joints || []);
        setActiveWindow(parsed);
      }
      setSyncStatus('offline');
      setCurrentView('mapeo');
    }
  };

  const handleCreateWindow = async (newWindow: any) => {
    const formatted: WindowData = {
      header: {
        celda: newWindow.celda,
        este_from: newWindow.este_from,
        norte_from: newWindow.norte_from,
        cota_from: newWindow.cota_from,
        este_to: newWindow.este_to,
        norte_to: newWindow.norte_to,
        cota_to: newWindow.cota_to,
        altura: newWindow.altura,
        dip_talud: newWindow.dip_talud,

        dipdir_talud: newWindow.dipdir_talud,
        dip_hw: newWindow.dip_hw,
        az_hw: newWindow.az_hw,

        unidad_litologica: newWindow.lito_model || '',
        lito_1: newWindow.lito_model || '',
        lito_2: '',
        lito_3: newWindow.lito_3 || '',
        mapeador: newWindow.mapeador,
        sector: newWindow.sector,
        fase: newWindow.fase,
        nivel: newWindow.nivel,
        sect_geot: newWindow.sect_geot,
        fecha: newWindow.fecha,
        condicion_agua: newWindow.condicion_agua || 'C',
        resistencia_ucs: newWindow.resistencia_ucs || 'R4',
        comentario: '',
        campania: newWindow.campania,
        turno: newWindow.turno,
        gsi_estructura: 'VB',
        gsi_superficie: 'G',
        gsi_visual: 56,
        control_estructural: 3,
        efectos_voladura: 3,
        ucs_mpa: 73,
        is50_mpa: 5
      },
      joints: normalizeJoints([])
    };

    setActiveWindow(formatted);
    setCurrentView('mapeo');
    setSyncStatus('unsaved');
  };

  const handleDeleteWindow = async (name: string) => {
    if (!confirm(`¿Está seguro de que desea eliminar permanentemente la celda ${name}? Se borrará de SQL Server.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/ventanas/${name}`, { method: 'DELETE' });
      if (res.ok) {
        setSyncStatus('synced');
        setSyncMessage(`Celda ${name} eliminada con éxito.`);
        fetchWindows();
      } else {
        throw new Error();
      }
    } catch (e) {
      console.warn("Failed to delete from DB, deleting locally.");
      const updated = windows.filter(w => w.name !== name);
      setWindows(updated);
      localStorage.setItem('geolog_windows_summaries', JSON.stringify(updated));
      localStorage.removeItem(`geolog_window_${name}`);
      setSyncStatus('offline');
    }

    if (activeWindow?.header.celda === name) {
      setActiveWindow(null);
    }
    setCurrentView('dashboard');
  };

  const handleDeleteFamily = (famId: number) => {
    if (!activeWindow) return;

    if (famId <= 3) {
      alert("No se pueden eliminar las familias básicas obligatorias (F1, F2, F3).");
      return;
    }

    const familyJoints = activeWindow.joints.filter(j => j.familia === famId);

    const hasData = familyJoints.some(j =>
      (j.distancia !== -1 && j.distancia !== null) ||
      (j.dip !== -1 && j.dip !== null) ||
      (j.dip_dir !== -1 && j.dip_dir !== null) ||
      (j.espaciamiento !== -1 && j.espaciamiento !== null) ||
      (j.abertura !== -1 && j.abertura !== null) ||
      (j.espesor !== -1 && j.espesor !== null) ||
      (j.jrc !== -1 && j.jrc !== null) ||
      (j.rugosidad !== -1 && j.rugosidad !== 1 && j.rugosidad !== null) ||
      j.tipo_estructura !== 'JN' ||
      j.alteracion !== 'd' ||
      j.forma !== 'O'
    );

    if (hasData) {
      const confirm1 = window.confirm(`¿Está seguro de que desea eliminar la Familia F${famId}? Contiene datos registrados.`);
      if (!confirm1) return;
      const confirm2 = window.confirm(`ATENCIÓN: Se perderán definitivamente todos los datos de la Familia F${famId}. Las familias posteriores serán reindexadas automáticamente. ¿Confirmar eliminación?`);
      if (!confirm2) return;
    }

    const remainingJoints = activeWindow.joints.filter(j => j.familia !== famId);
    const shiftedJoints = remainingJoints.map(j => {
      if (j.familia > famId) {
        return { ...j, familia: j.familia - 1 };
      }
      return j;
    });

    const normalized = normalizeJoints(shiftedJoints);

    setActiveWindow({
      ...activeWindow,
      joints: normalized
    });
    setSyncStatus('unsaved');
  };

  const handleSaveActive = async () => {
    if (!activeWindow || !calculated) return;

    setSyncStatus('saving');
    setSyncMessage("Sincronizando con base de datos SQL Server...");

    const nonVacantJoints = activeWindow.joints.filter(j => !(j.distancia === -1 && j.dip === -1 && j.espaciamiento === -1));

    const payload = {
      codigo: activeWindow.header.celda,
      fecha_mapeo: activeWindow.header.fecha,
      mapeador: activeWindow.header.mapeador,
      campania: parseInt(String(activeWindow.header.campania)) || 2026,
      este_ini: activeWindow.header.este_from,
      norte_ini: activeWindow.header.norte_from,
      cota_ini: activeWindow.header.cota_from,
      este_fin: activeWindow.header.este_to,
      norte_fin: activeWindow.header.norte_to,
      cota_fin: activeWindow.header.cota_to,
      largo_m: calculated.largo,
      altura_m: activeWindow.header.altura,
      dip_talud: activeWindow.header.dip_talud,
      dipdir_talud: activeWindow.header.dipdir_talud,
      dip_hw: activeWindow.header.dip_hw,
      az_hw: activeWindow.header.az_hw,
      alteracion_codigo: activeWindow.header.alt_zona || 'd',
      intemperismo_codigo: activeWindow.header.intemperia || 'd',
      lito_1: activeWindow.header.lito_1 || '',
      lito_2: activeWindow.header.lito_2 || '',
      lito_3: activeWindow.header.lito_3 || '',
      unidad_litologica: activeWindow.header.unidad_litologica || '',
      sector: activeWindow.header.sector,
      fase: parseInt(activeWindow.header.fase || '') || 5,
      nivel: parseFloat(activeWindow.header.nivel || '') || 3960.0,
      sector_geotecnico: activeWindow.header.sect_geot,
      turno: activeWindow.header.turno,
      discontinuidades: nonVacantJoints.map(j => ({
        fam: j.familia,
        dist: j.distancia,
        tipo: j.tipo_estructura,
        dip: j.dip,
        dipdir: j.dip_dir,
        aber: j.abertura,
        esp: j.espesor,
        cont: j.continuidad,
        espac: j.espaciamiento,
        nstr: j.n_estructuras,
        next: j.extremos_visibles,
        term: j.terminacion,
        r1: j.relleno1,
        r2: j.relleno2,
        jrc: j.jrc,
        rug: j.rugosidad,
        forma: j.forma,
        alt: j.alteracion
      })),
      rmr_input: {
        agua_codigo: activeWindow.header.condicion_agua,
        resistencia_codigo: activeWindow.header.resistencia_ucs,
        gsi_estructura: activeWindow.header.gsi_estructura || 'VB',
        gsi_superficie: activeWindow.header.gsi_superficie || 'G',
        gsi_visual: activeWindow.header.gsi_visual !== undefined ? activeWindow.header.gsi_visual : 56,
        control_estructural: activeWindow.header.control_estructural !== undefined ? activeWindow.header.control_estructural : 3,
        efectos_voladura: activeWindow.header.efectos_voladura !== undefined ? activeWindow.header.efectos_voladura : 3,
        ucs_mpa: activeWindow.header.ucs_mpa !== undefined ? activeWindow.header.ucs_mpa : 73,
        is50_mpa: activeWindow.header.is50_mpa !== undefined ? activeWindow.header.is50_mpa : 5,
        comentario: activeWindow.header.comentario || ""
      }
    };

    try {
      const res = await fetch(`${API_BASE}/api/ventanas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resPlt = await fetch(`${API_BASE}/api/ensayos-plt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pltEnsayos)
      });

      if (res.ok && resPlt.ok) {
        setSyncStatus('synced');
        setSyncMessage(`Mapeo Celda ${activeWindow.header.celda} y Ensayos PLT guardados con éxito.`);
        fetchWindows();
      } else {
        throw new Error();
      }
    } catch (e) {
      console.warn("Save database failed, saving locally in cache.");
      localStorage.setItem(`geolog_window_${activeWindow.header.celda}`, JSON.stringify(activeWindow));
      localStorage.setItem('plt_ensayos_v2', JSON.stringify(pltEnsayos));

      const summary: WindowSummary = {
        name: activeWindow.header.celda,
        proyecto: "Proyecto A",
        geologo: activeWindow.header.mapeador || "N/A",
        largo: calculated.largo,
        altura: activeWindow.header.altura,
        fecha_registro: activeWindow.header.fecha || new Date().toISOString().split('T')[0],
        rmr_76: calculated.rmr_76,
        rmr_89: calculated.rmr_89,
        class_89: calculated.class_89
      };

      const updatedSummaries = [...windows.filter(w => w.name !== activeWindow.header.celda), summary];
      setWindows(updatedSummaries);
      localStorage.setItem('geolog_windows_summaries', JSON.stringify(updatedSummaries));

      setSyncStatus('offline');
      setSyncMessage("Cambios resguardados en almacenamiento local temporal.");
    }
  };

  const handleSaveActivePlt = async () => {
    setSyncStatus('saving');
    setSyncMessage("Sincronizando sismología y ensayos PLT...");
    try {
      const resPlt = await fetch(`${API_BASE}/api/ensayos-plt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pltEnsayos)
      });
      if (resPlt.ok) {
        setSyncStatus('synced');
        setSyncMessage("Ensayos PLT guardados con éxito en la base de datos.");
      } else {
        throw new Error();
      }
    } catch (e) {
      console.warn("Save PLT failed, saving locally.");
      localStorage.setItem('plt_ensayos_v2', JSON.stringify(pltEnsayos));
      setSyncStatus('offline');
      setSyncMessage("No se pudo conectar al servidor. Ensayos PLT guardados localmente.");
    }
  };

  const handleFocusField = (fieldId: string) => {
    if (fieldId.startsWith('header-')) {
      setCurrentView('mapeo');
    } else if (fieldId.startsWith('joint-')) {
      setCurrentView('mapeo');
    }

    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('animate-pulse-ring');
        setTimeout(() => el.classList.remove('animate-pulse-ring'), 2000);
      }
    }, 150);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* 1. SIDEBAR */}
      <Sidebar
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        selectedWindow={activeWindow ? activeWindow.header.celda : null}
      />

      {/* 2. MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Sync Status Header */}
        <header className="h-16 border-b border-navy-800 flex items-center justify-between px-6 bg-navy-950/40 backdrop-blur z-10 shrink-0">
          <div className="flex items-center gap-3">
            {currentView !== 'dashboard' && (
              <button
                onClick={() => setCurrentView('dashboard')}
                className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 hover:text-white border border-navy-800 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <ArrowLeft size={14} />
                <span>Volver al Panel</span>
              </button>
            )}

            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest hidden lg:inline pr-3 border-r border-navy-800/80">
              Mapeo de Ventanas Geomecánicas 2.0
            </span>

            {activeWindow && (
              <div className="flex items-center gap-2 animate-fade-in pl-1">
                <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Celda Activa:</span>
                <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-lg uppercase tracking-wider shadow-[0_0_10px_rgba(99,102,241,0.05)]">
                  {activeWindow.header.celda}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Server Connectivity Indicator */}
            <div className="flex items-center gap-2 pr-3 border-r border-navy-800">
              <span className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
                syncStatus === 'saving' ? 'bg-indigo-500 animate-pulse' :
                  syncStatus === 'unsaved' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                    'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                }`} />
              <span className="text-xs text-slate-400 font-semibold hidden md:inline" title={syncMessage}>
                {syncStatus === 'synced' ? 'SQL Server Conectado' :
                  syncStatus === 'saving' ? 'Guardando...' :
                    syncStatus === 'unsaved' ? 'Cambios pendientes' :
                      'Almacenamiento Local Offline'}
              </span>
            </div>

            {/* General Topbar Actions */}
            <div className="flex items-center gap-2">

              <button
                onClick={() => setShowFormulas(!showFormulas)}
                className={`flex items-center gap-1.5 border px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 ${showFormulas
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                  : 'bg-navy-900 border-navy-800 text-slate-400 hover:text-slate-200'
                  }`}
                title="Activar/Desactivar visualización de fórmulas al pasar el mouse"
              >
                <Calculator size={14} className={showFormulas ? 'text-indigo-400 animate-pulse' : 'text-slate-400'} />
                <span>{showFormulas ? 'Fórmulas Activas' : 'Ocultar Fórmulas'}</span>
              </button>

              <button
                onClick={() => setIsCatalogModalOpen(true)}
                className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 hover:text-white border border-navy-800 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                title="Ver Catálogos de Referencia Geomecánica"
              >
                <BookOpen size={14} className="text-indigo-400" />
                <span>Catálogos</span>
              </button>

              {/* NUEVO BOTÓN DE EXPORTACIÓN EXCEL */}
              {activeWindow && (
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 hover:text-white border border-navy-800 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                  title="Exportar Mapeo de esta Ventana en Formato Excel DB"
                >
                  <FileSpreadsheet size={14} className="text-emerald-500" />
                  <span>Exportar</span>
                </button>
              )}

              {activeWindow && (
                <button
                  onClick={handleSaveActive}
                  disabled={syncStatus === 'saving'}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all shadow-md active:scale-95 border ${syncStatus === 'unsaved'
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-900 border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse-ring'
                    : syncStatus === 'saving'
                      ? 'bg-indigo-600 text-white border-indigo-500/30 cursor-wait'
                      : syncStatus === 'synced'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)] font-bold'
                        : 'bg-navy-900 hover:bg-navy-850 text-slate-300 border-navy-800'
                    }`}
                  title="Guardar todos los cambios en SQL Server"
                >
                  <Save size={14} />
                  <span>{syncStatus === 'saving' ? 'Guardando...' : 'Guardar'}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content scroll window */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {currentView === 'dashboard' && (
            <Dashboard
              windows={windows}
              onSelectWindow={handleSelectWindow}
              onCreateWindow={handleCreateWindow}
              onDeleteWindow={handleDeleteWindow}
              onOpenImportModal={() => setIsImportModalOpen(true)}
            />
          )}

          {currentView === 'mapeo' && activeWindow && (
            <div className="space-y-6 animate-fade-in">
              <VentanaForm
                header={activeWindow.header}
                onChange={(header) => {
                  const oldIntemperia = activeWindow.header.intemperia;
                  const newIntemperia = header.intemperia;
                  let joints = activeWindow.joints;

                  if (newIntemperia !== oldIntemperia && ['f', 'd', 'm', 'a', 'c', 's'].includes(newIntemperia || '')) {
                    joints = joints.map(j => ({
                      ...j,
                      alteracion: newIntemperia!
                    }));
                  }
                  setActiveWindow({ ...activeWindow, header, joints });
                }}
                calculated={calculated}
                onOpenImportModal={() => setIsImportModalOpen(true)}
              />

              <DisconTable
                joints={activeWindow.joints}
                onChange={(joints) => setActiveWindow({ ...activeWindow, joints })}
                selectedRowIndex={selectedRowIndex}
                onSelectRow={setSelectedRowIndex}
                largoMax={calculated?.largo || 10}
                onDeleteFamily={handleDeleteFamily}
                intemperia={activeWindow.header.intemperia}
                showFormulas={showFormulas} // Nueva Prop
              />

              {/* 📊 CENTRO DE MÉTRICAS GEOMECÁNICAS (KPIs) ALINEADOS Y DISEÑADOS SEGÚN LA MAQUETA */}
              {(() => {
                const getFamilyStyle = (fam: number) => {
                  const styles: Record<number, { dot: string; container: string; badge: string }> = {
                    1: { dot: 'bg-orange-500', container: 'bg-orange-500/5 border border-orange-500/20 text-orange-400', badge: 'bg-orange-500/20 border border-orange-500/30 text-orange-400' },
                    2: { dot: 'bg-emerald-500', container: 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-400', badge: 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' },
                    3: { dot: 'bg-indigo-500', container: 'bg-indigo-500/5 border border-indigo-500/20 text-indigo-400', badge: 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400' },
                    4: { dot: 'bg-pink-500', container: 'bg-pink-500/5 border border-pink-500/20 text-pink-400', badge: 'bg-pink-500/20 border border-pink-500/30 text-pink-400' },
                    5: { dot: 'bg-cyan-500', container: 'bg-cyan-500/5 border border-cyan-500/20 text-cyan-400', badge: 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400' },
                    6: { dot: 'bg-amber-500', container: 'bg-amber-500/5 border border-amber-500/20 text-amber-400', badge: 'bg-amber-500/20 border border-amber-500/30 text-amber-400' },
                    7: { dot: 'bg-red-500', container: 'bg-red-500/5 border border-red-500/20 text-red-400', badge: 'bg-red-500/20 border border-red-500/30 text-red-400' },
                    8: { dot: 'bg-violet-500', container: 'bg-violet-500/5 border border-violet-500/20 text-violet-400', badge: 'bg-violet-500/20 border border-violet-500/30 text-violet-400' },
                    9: { dot: 'bg-teal-500', container: 'bg-teal-500/5 border border-teal-500/20 text-teal-400', badge: 'bg-teal-500/20 border border-teal-500/30 text-teal-400' },
                  };
                  return styles[fam] || { dot: 'bg-slate-500', container: 'bg-slate-500/5 border border-slate-500/20', badge: 'bg-slate-500/20 border border-slate-500/30 text-slate-400' };
                };

                const getJvClassification = (jv: number): string => {
                  if (jv < 1) return "FRACTURAMIENTO MUY BAJO";
                  if (jv <= 3) return "FRACTURAMIENTO BAJO";
                  if (jv <= 10) return "FRACTURAMIENTO MODERADO";
                  if (jv <= 30) return "FRACTURAMIENTO ALTO";
                  if (jv <= 60) return "FRACTURAMIENTO MUY ALTO";
                  return "MACIZO TRITURADO";
                };

                const activeFamiliesList = Array.from(new Set(activeWindow.joints.map(j => j.familia))).sort((a, b) => a - b);

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 select-none text-left animate-fade-in">

                    {/* Card 1: PROMEDIOS DE ESPACIAMIENTO */}
                    <div className="lg:col-span-3 glass-panel p-6 rounded-xl border border-navy-800 bg-navy-950/20 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest border-b border-navy-900 pb-2.5 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <BarChart3 size={16} className="text-slate-400" />
                            <span>PROMEDIOS DE ESPACIAMIENTO</span>
                          </span>
                          <span className="text-[10px] bg-orange-500/10 border border-orange-500/30 text-orange-400 font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wider">
                            {activeFamiliesList.length} FAMILIAS
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 font-semibold">
                          Promedio aritmético simple de los registros por familia: <code className="text-slate-400/80">Σ(esp) / N</code>
                        </p>
                      </div>

                      <div className="mt-4 overflow-y-auto pr-1 max-h-[175px] space-y-2.5">
                        {activeFamiliesList.map((famId) => {
                          const val = calculated?.familias_spacing[famId];
                          const displayVal = val !== undefined && val !== null ? val.toFixed(4) + ' m' : 'Sin datos';
                          const style = getFamilyStyle(famId);

                          return (
                            <div
                              key={famId}
                              className={`flex items-center justify-between p-3 rounded-lg hover:brightness-110 transition-all ${style.container}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${style.dot} shrink-0`} />
                                <span className="text-xs font-bold text-slate-300">Fam {famId}</span>
                              </div>
                              <span className={`text-xs font-black font-mono px-2 py-0.5 rounded border ${style.badge}`}>
                                {displayVal}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card 2: ÍNDICE VOLUMÉTRICO */}
                    <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-navy-800 bg-navy-950/20 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest border-b border-navy-900 pb-2.5 flex items-center gap-2">
                          <Layers size={16} className="text-yellow-500/80" />
                          <span>ÍNDICE VOLUMÉTRICO</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 font-semibold">
                          Conteo de discontinuidades volumétricas (Jv).
                        </p>
                      </div>

                      <div className="my-4 border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden text-center min-h-[110px]">
                        <span className="text-3xl font-black font-mono tracking-tight text-yellow-500">
                          {calculated ? calculated.jv.toFixed(4) : '—'}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider mt-1 text-slate-400">JTS / M³</span>
                        <Layers size={24} className="text-yellow-500/10 absolute right-4 top-1/2 -translate-y-1/2 shrink-0 stroke-[1.5]" />
                      </div>

                      <div className="mt-auto border border-yellow-500/20 bg-yellow-500/5 rounded-lg py-2 px-3 text-center">
                        <span className="text-xs font-extrabold text-yellow-500 uppercase tracking-widest">
                          {calculated ? getJvClassification(calculated.jv) : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Card 3: RQD ESTIMADO */}
                    <div className="lg:col-span-5 glass-panel p-6 rounded-xl border border-navy-800 bg-navy-950/20 flex flex-col justify-between shadow-lg relative overflow-hidden group">
                      <div>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest border-b border-navy-900 pb-2.5 flex items-center gap-2">
                          <Gauge size={16} className="text-sky-400" />
                          <span>RQD ESTIMADO</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 font-semibold">
                          Cálculo empírico según fórmula de Palmström: <code className="text-sky-400 font-bold bg-navy-900/60 px-1 py-0.5 rounded">115 - 3.3 · Jv</code>
                        </p>
                      </div>

                      <div className="my-4 border border-sky-500/30 bg-sky-500/5 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden text-center min-h-[110px]">
                        <span className="text-3xl font-black font-mono tracking-tight text-sky-400">
                          {calculated ? calculated.rqd_est.toFixed(2) : '—'}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider mt-1 text-slate-400">RQD ESTIMADO</span>
                        <Gauge size={24} className="text-sky-500/10 absolute right-4 top-1/2 -translate-y-1/2 shrink-0 stroke-[1.5]" />
                      </div>

                      <div className="space-y-3 mt-auto">
                        <div className="w-full bg-navy-950 rounded-full h-2.5 border border-navy-900 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.4)]"
                            style={{ width: `${calculated ? calculated.rqd_est : 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-extrabold uppercase tracking-wider px-0.5">
                          <span>MALA</span>
                          <span>REGULAR</span>
                          <span>EXCELENTE</span>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })()}


              {/* 💬 Comentarios y Fotografías Colapsable (Sincronizado con tono naranja geológico) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-navy-950/45 p-4 rounded-xl border border-navy-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg">
                      <BookOpen size={18} className="text-orange-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-100 uppercase tracking-widest">
                        Comentarios y Fotografías
                      </h4>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Registro de observaciones visuales y fotos de la celda
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCommentsExpanded(!isCommentsExpanded)}
                    className="px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-700/60 hover:bg-navy-850 text-slate-300 hover:text-orange-400 text-xs font-bold transition-all active:scale-95"
                  >
                    {isCommentsExpanded ? 'Ocultar Detalle' : 'Mostrar Detalle'}
                  </button>
                </div>

                {isCommentsExpanded && (
                  <CommentsPhotos
                    celda={activeWindow.header.celda}
                    comentario={activeWindow.header.comentario || ''}
                    onComentarioChange={(val) => {
                      setActiveWindow({
                        ...activeWindow,
                        header: {
                          ...activeWindow.header,
                          comentario: val
                        }
                      });
                    }}
                    photos={photos}
                    captions={captions}
                    onPhotosChange={handlePhotosChange}
                    apiBase={RESOLVED_API_BASE}
                  />
                )}
              </div>

              {/* 📊 ANÁLISIS GEOMECÁNICO RMR SIEMPRE EXPANDIDO */}
              <RmrAnalysis
                header={activeWindow.header}
                onChange={(header) => setActiveWindow({ ...activeWindow, header })}
                calculated={calculated}
                showFormulas={showFormulas} // Nueva Prop
              />
            </div>
          )}

          {currentView === 'grafico' && activeWindow && calculated && (
            <StructurePlot
              header={activeWindow.header}
              calculatedJoints={calculated.joints}
              largo={calculated.largo}
            />
          )}

          {currentView === 'plt_ensayos' && (
            <PltEnsayosView
              pltEnsayos={pltEnsayos}
              onChange={(newRows) => {
                setPltEnsayos(newRows);
                setSyncStatus('unsaved');
                setSyncMessage('Ensayos PLT modificados localmente. Presione "Guardar Cambios" para sincronizar.');
              }}
              activeWindowCellda={activeWindow?.header.celda || null}
              onSave={handleSaveActivePlt}
              syncStatus={syncStatus}
              syncMessage={syncMessage}
            />
          )}

        </main>

        {/* 3. QA/QC VALIDATION PANEL (Bottom-Right Floating) */}
        {activeWindow && alerts.length > 0 && (
          <div className="absolute bottom-6 right-6 z-50">
            <ValidationPanel
              alerts={alerts}
              onFocusField={handleFocusField}
            />
          </div>
        )}
      </div>
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={(importedData) => {
          const defaultAlt = importedData.header?.intemperia || 'd';
          setActiveWindow({
            ...importedData,
            joints: normalizeJoints(importedData.joints || [], defaultAlt)
          });
          setSyncStatus('unsaved');
          setSyncMessage('Datos cargados localmente desde Excel. Presione "Guardar Cambios" para sincronizar.');
          setCurrentView('mapeo');
          setSelectedRowIndex(0);
        }}
      />
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
          <div className="glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col border border-navy-800 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/95">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500 w-full" />

            <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                    Catálogos de Referencia Geomecánica
                  </h3>
                  <p className="text-xs text-slate-400">Guía de parámetros y ratings para clasificaciones RMR (Bieniawski)</p>
                </div>
              </div>
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-navy-950/20">
              <CatalogsView />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}