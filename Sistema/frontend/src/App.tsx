import { useState, useEffect } from 'react';
import { Save, ArrowLeft } from 'lucide-react';

import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import type { WindowSummary } from './components/Dashboard/Dashboard';
import VentanaForm from './components/VentanaForm';
import DisconTable from './components/DisconTable';
import RmrAnalysis from './components/RmrAnalysis';
import StructurePlot from './components/StructurePlot';
import ValidationPanel from './components/ValidationPanel';
import ExcelImportModal from './components/ExcelImportModal';

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

export default function App() {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [windows, setWindows] = useState<WindowSummary[]>([]);
  const [activeWindow, setActiveWindow] = useState<WindowData | null>(null);

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

  // 2. Fetch window summaries on mount
  useEffect(() => {
    fetchWindows();
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

  const fetchWindows = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ventanas`);
      if (res.ok) {
        const data = await res.json();
        // Convert to WindowSummary shape
        const summaries: WindowSummary[] = data.map((v: any) => ({
          name: v.codigo,
          proyecto: "Proyecto A", // Default values
          geologo: v.mapeador || "N/A",
          largo: 5.0, // placeholder, updated in select
          altura: 15.0,
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

  const handleSelectWindow = async (name: string) => {
    setSyncStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/api/ventanas/${name}`);
      if (res.ok) {
        const v = await res.json();
        const header: WindowHeader = {
          celda: v.codigo,
          este_from: v.este_ini,
          norte_from: v.norte_ini,
          cota_from: v.cota_ini,
          este_to: v.este_fin,
          norte_to: v.norte_fin,
          cota_to: v.cota_fin,
          altura: v.altura_m || 15.0,
          dip_talud: v.dip_talud || 64.0,
          lito_3: v.lito_3 || 'MZQ',
          lito_model: v.lito_1 || 'MZQ_M',
          mapeador: v.mapeador || 'AS-HM',
          sector: v.sector || 'E1',
          fase: String(v.fase || '5'),
          nivel: String(v.nivel || '3960'),
          sect_geot: v.sector_geotecnico || 'E1',
          fecha: v.fecha_mapeo || new Date().toISOString().split('T')[0],
          condicion_agua: v.rmr_input?.agua_codigo || 'C',
          resistencia_ucs: v.rmr_input?.resistencia_codigo || 'R4'
        };

        const joints: JointRow[] = (v.discontinuidades || []).map((d: any, idx: number) => ({
          id: idx + 1,
          familia: d.fam || 1,
          distancia: d.dist || 0.0,
          tipo_estructura: d.tipo || 'J',
          dip: d.dip || 45,
          dip_dir: d.dipdir || 180,
          n_estructuras: d.nstr || 1,
          abertura: d.aber || 0.1,
          espesor: d.esp || 0.0,
          continuidad: d.cont || 1.5,
          espaciamiento: d.espac || 0.5,
          extremos_visibles: d.next !== undefined ? d.next : 1,
          terminacion: d.term !== undefined ? d.term : 0,
          relleno1: d.r1 || 'cwf',
          relleno2: d.r2 || undefined,
          jrc: d.jrc || 10,
          rugosidad: d.rug || 2,
          forma: d.forma || 'O',
          alteracion: d.alt || 'd'
        }));

        setActiveWindow({ header, joints });
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
        setActiveWindow(JSON.parse(cached));
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
        lito_3: newWindow.lito_3,
        lito_model: newWindow.lito_model,
        mapeador: newWindow.mapeador,
        sector: newWindow.sector,
        fase: newWindow.fase,
        nivel: newWindow.nivel,
        sect_geot: newWindow.sect_geot,
        fecha: newWindow.fecha,
        condicion_agua: newWindow.condicion_agua,
        resistencia_ucs: newWindow.resistencia_ucs
      },
      joints: []
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

  const handleSaveActive = async () => {
    if (!activeWindow || !calculated) return;

    setSyncStatus('saving');
    setSyncMessage("Sincronizando con base de datos SQL Server...");

    // Format save payload to match backend schemas
    const payload = {
      codigo: activeWindow.header.celda,
      fecha_mapeo: activeWindow.header.fecha,
      mapeador: activeWindow.header.mapeador,
      campania: 2026,
      este_ini: activeWindow.header.este_from,
      norte_ini: activeWindow.header.norte_from,
      cota_ini: activeWindow.header.cota_from,
      este_fin: activeWindow.header.este_to,
      norte_fin: activeWindow.header.norte_to,
      cota_fin: activeWindow.header.cota_to,
      largo_m: calculated.largo,
      altura_m: activeWindow.header.altura,
      dip_talud: activeWindow.header.dip_talud,
      alteracion_codigo: 'd', // default placeholder (1 character for SQL Server CHAR(1))
      intemperismo_codigo: 'd',
      lito_1: `${activeWindow.header.lito_3}_M`,
      lito_2: activeWindow.header.lito_3,
      lito_3: activeWindow.header.lito_3,
      unidad_litologica: `${activeWindow.header.lito_3}_M`,
      sector: activeWindow.header.sector,
      fase: parseInt(activeWindow.header.fase || '') || 5,
      nivel: parseFloat(activeWindow.header.nivel || '') || 3960.0,
      sector_geotecnico: activeWindow.header.sect_geot,
      discontinuidades: activeWindow.joints.map(j => ({
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
        gsi_estructura: "VB",
        gsi_superficie: "G",
        gsi_visual: 50,
        control_estructural: 4,
        efectos_voladura: 3,
        ucs_mpa: 74.0,
        is50_mpa: 5.0,
        comentario: "Guardado desde portal web"
      }
    };

    try {
      const res = await fetch(`${API_BASE}/api/ventanas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSyncStatus('synced');
        setSyncMessage(`Mapeo Celda ${activeWindow.header.celda} guardado con éxito.`);
        fetchWindows();
      } else {
        throw new Error();
      }
    } catch (e) {
      console.warn("Save database failed, saving locally in cache.");
      localStorage.setItem(`geolog_window_${activeWindow.header.celda}`, JSON.stringify(activeWindow));

      // Update local summaries list
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

  const handleFocusField = (fieldId: string) => {
    // Determine view based on field prefix
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
                className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-800 text-slate-300 hover:text-white border border-navy-800 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <ArrowLeft size={14} />
                <span>Volver al Panel</span>
              </button>
            )}
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest hidden sm:inline">
              Mapeo de Paredes Geomecánicas 2.0
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Server Connectivity Indicator */}
            <div className="flex items-center gap-2 pr-3 border-r border-navy-800">
              <span className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
                syncStatus === 'saving' ? 'bg-blue-500 animate-pulse' :
                  syncStatus === 'unsaved' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                    'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                }`} />
              <span className="text-xs text-slate-400 font-semibold" title={syncMessage}>
                {syncStatus === 'synced' ? 'SQL Server Conectado' :
                  syncStatus === 'saving' ? 'Guardando...' :
                    syncStatus === 'unsaved' ? 'Cambios pendientes' :
                      'Almacenamiento Local Offline'}
              </span>
            </div>

            {/* General Window Actions */}
            <div className="flex items-center gap-2">
              {activeWindow && (
                <button
                  onClick={handleSaveActive}
                  disabled={syncStatus === 'saving'}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all shadow-md active:scale-95 border ${syncStatus === 'unsaved'
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-900 border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse-ring'
                    : syncStatus === 'saving'
                      ? 'bg-blue-600 text-white border-blue-500/30 cursor-wait'
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
                onChange={(header) => setActiveWindow({ ...activeWindow, header })}
                calculated={calculated}
                onOpenImportModal={() => setIsImportModalOpen(true)}
              />
              <DisconTable
                joints={activeWindow.joints}
                onChange={(joints) => setActiveWindow({ ...activeWindow, joints })}
                selectedRowIndex={selectedRowIndex}
                onSelectRow={setSelectedRowIndex}
              />
            </div>
          )}

          {currentView === 'rmr' && (
            <RmrAnalysis
              calculated={calculated}
              condicionAgua={activeWindow?.header.condicion_agua || 'C'}
              resistenciaUcs={activeWindow?.header.resistencia_ucs || 'R4'}
            />
          )}

          {currentView === 'grafico' && activeWindow && calculated && (
            <StructurePlot
              header={activeWindow.header}
              calculatedJoints={calculated.joints}
              largo={calculated.largo}
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
          setActiveWindow(importedData);
          setSyncStatus('unsaved');
          setSyncMessage('Datos cargados localmente desde Excel. Presione "Guardar Cambios" para sincronizar.');
          setCurrentView('mapeo');
          setSelectedRowIndex(0);
        }}
      />
    </div>
  );
}
