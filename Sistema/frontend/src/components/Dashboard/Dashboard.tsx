import React, { useState } from 'react';
import { Plus, Search, Map, User, LayoutGrid, Trash2, TrendingUp, FileSpreadsheet } from 'lucide-react';

export interface WindowSummary {
  name: string; // matches header.celda
  proyecto: string;
  geologo: string; // matches header.mapeador
  largo: number;
  altura: number;
  fecha_registro: string;
  rmr_76: number;
  rmr_89: number;
  class_89: string;
}

interface DashboardProps {
  windows: WindowSummary[];
  onSelectWindow: (name: string) => void;
  onCreateWindow: (newWindow: any) => void;
  onDeleteWindow: (name: string) => void;
  onOpenImportModal: () => void;
}

export default function Dashboard({
  windows,
  onSelectWindow,
  onCreateWindow,
  onDeleteWindow,
  onOpenImportModal
}: DashboardProps) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form state for creating a window celda
  const [celda, setCelda] = useState('');
  const [proyecto, setProyecto] = useState('Proyecto A');
  const [mapeador, setMapeador] = useState('AS-HM');
  const [sector, setSector] = useState('E1');
  const [fase, setFase] = useState('5');
  const [nivel, setNivel] = useState('3960');
  const [esteFrom, setEsteFrom] = useState(794444.87);
  const [norteFrom, setNorteFrom] = useState(8440465.91);
  const [cotaFrom, setCotaFrom] = useState(3960.47);
  const [esteTo, setEsteTo] = useState(794449.13);
  const [norteTo, setNorteTo] = useState(8440455.69);
  const [cotaTo, setCotaTo] = useState(3959.84);
  const [altura, setAltura] = useState(15.0);
  const [dipTalud, setDipTalud] = useState(64);
  const [lito3, setLito3] = useState('MZQ');
  const [condicionAgua, setCondicionAgua] = useState('C');
  const [resistenciaUcs, setResistenciaUcs] = useState('R4');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!celda.trim()) return;

    onCreateWindow({
      celda: celda.trim().toUpperCase(),
      este_from: Number(esteFrom),
      norte_from: Number(norteFrom),
      cota_from: Number(cotaFrom),
      este_to: Number(esteTo),
      norte_to: Number(norteTo),
      cota_to: Number(cotaTo),
      altura: Number(altura),
      dip_talud: Number(dipTalud),
      lito_3: lito3,
      lito_model: `${lito3}_M`,
      mapeador: mapeador.trim(),
      sector: sector.trim(),
      fase: fase.trim(),
      nivel: nivel.trim(),
      sect_geot: sector.trim(),
      fecha: new Date().toISOString().split('T')[0],
      condicion_agua: condicionAgua,
      resistencia_ucs: resistenciaUcs,
      joints: [],
      calculated: null
    });

    setShowModal(false);
    setCelda('');
  };

  const totalLargoM = windows.reduce((acc, w) => acc + w.largo, 0);
  const rmrPromedio = windows.length > 0
    ? Math.round(windows.reduce((acc, w) => acc + w.rmr_89, 0) / windows.length)
    : 0;

  const filtered = windows.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  const dateObj = new Date();
  const dayNum = dateObj.getDate().toString().padStart(2, '0');
  const monthName = dateObj.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
  const weekdayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
  const capitalizedWeekday = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);

  return (
    <div className="space-y-6 select-none w-full">
      {/* Welcome Banner */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-wide bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">Mapeo Geomecánico de Paredes</h2>
          <p className="text-slate-400 text-xs mt-1">Registra, audita y calcula el RMR en ventanas de escaneo estructural en tiempo real.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-1.5 bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-300 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95"
          >
            <FileSpreadsheet size={18} className="text-amber-400" />
            <span>Importar Excel (Local)</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-800 dark:text-orange-400 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95"
          >
            <Plus size={18} />
            <span>Nueva Celda de Mapeo</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Date Card */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between bg-gradient-to-br from-navy-900/40 to-navy-950/20 shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center bg-cyan-500/10 border border-cyan-500/30 rounded-lg w-12 h-12 shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
              <span className="text-xs font-black text-cyan-400 leading-none">{monthName}</span>
              <span className="text-lg font-black text-slate-100 leading-none mt-0.5">{dayNum}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Fecha de Hoy</span>
              <span className="text-xs font-bold text-slate-300 block leading-tight">{capitalizedWeekday}</span>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Total Celdas</span>
            <span className="text-2xl font-black text-slate-100 block">{windows.length}</span>
          </div>
          <LayoutGrid size={24} className="text-cyan-500/40" />
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Avance Escaneado</span>
            <span className="text-2xl font-black text-slate-100 block">{totalLargoM.toFixed(1)} m</span>
          </div>
          <Map size={24} className="text-cyan-500/40" />
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">RMR Promedio</span>
            <span className="text-2xl font-black text-emerald-400 block">{rmrPromedio}</span>
          </div>
          <TrendingUp size={24} className="text-emerald-500/40" />
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Último Mapeador</span>
            <span className="text-lg font-black text-slate-100 block truncate max-w-[140px]">
              {windows.length > 0 ? windows[windows.length - 1].geologo : 'N/A'}
            </span>
          </div>
          <User size={24} className="text-cyan-500/40" />
        </div>
      </div>

      {/* Search and Table Grid */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar celda por código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-navy-950 border border-navy-800 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs text-slate-500 font-bold uppercase tracking-wider border-b border-navy-800">
                <th className="py-3 px-4">Celda de Mapeo</th>
                <th className="py-3 px-4 text-center">Largo (m)</th>
                <th className="py-3 px-4 text-center">Altura (m)</th>
                <th className="py-3 px-4">Mapeador</th>
                <th className="py-3 px-4 text-center">RMR 89</th>
                <th className="py-3 px-4 text-center">Clase Verbal</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(w => (
                <tr
                  key={w.name}
                  onClick={() => onSelectWindow(w.name)}
                  className="border-b border-navy-900/60 hover:bg-navy-900/10 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4 font-bold text-slate-100 tracking-wide">{w.name}</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 font-bold">{w.largo.toFixed(2)} m</td>
                  <td className="py-3.5 px-4 text-center text-slate-400">{w.altura.toFixed(1)} m</td>
                  <td className="py-3.5 px-4 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-slate-500" />
                      <span>{w.geologo}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center text-slate-300 font-semibold">{w.rmr_89}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      w.rmr_89 >= 61 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      w.rmr_89 >= 41 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {w.class_89}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => onSelectWindow(w.name)}
                        className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-2.5 py-1 rounded text-xs font-bold transition-all shadow-sm active:scale-95"
                      >
                        Mapear
                      </button>
                      <button
                        onClick={() => onDeleteWindow(w.name)}
                        className="p-1.5 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200 shadow-sm active:scale-90 flex items-center justify-center mx-auto"
                        title="Eliminar celda"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    No se encontraron celdas de mapeo registradas. Haz clic en "Nueva Celda de Mapeo" para registrar una.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registro Nueva Celda */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="glass-panel w-full max-w-lg p-6 rounded-xl border border-navy-800 space-y-4 text-left shadow-2xl bg-navy-900/95 my-8">
            <h3 className="text-base font-bold text-slate-100 tracking-wide border-b border-navy-800 pb-2 uppercase flex items-center gap-2">
              <Plus size={18} className="text-orange-400" />
              <span>Nueva Celda de Mapeo Geomecánico</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Código Celda / Ventana</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. TD1"
                    value={celda}
                    onChange={(e) => setCelda(e.target.value.toUpperCase())}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold tracking-wider"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Mapeador</label>
                  <input
                    type="text"
                    required
                    value={mapeador}
                    onChange={(e) => setMapeador(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Proyecto</label>
                  <input
                    type="text"
                    required
                    value={proyecto}
                    onChange={(e) => setProyecto(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Sector</label>
                  <input
                    type="text"
                    required
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Fase</label>
                  <input
                    type="text"
                    required
                    value={fase}
                    onChange={(e) => setFase(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Nivel</label>
                  <input
                    type="text"
                    required
                    value={nivel}
                    onChange={(e) => setNivel(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-semibold"
                  />
                </div>
              </div>

              {/* Coordinates Initial (From) */}
              <div className="border-t border-navy-800/60 pt-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Coordenadas Iniciales (Scanline FROM)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">Este (X)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={esteFrom}
                      onChange={(e) => setEsteFrom(parseFloat(e.target.value) || 0)}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">Norte (Y)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={norteFrom}
                      onChange={(e) => setNorteFrom(parseFloat(e.target.value) || 0)}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">Cota (Z)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={cotaFrom}
                      onChange={(e) => setCotaFrom(parseFloat(e.target.value) || 0)}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Coordinates Final (To) */}
              <div className="border-t border-navy-800/60 pt-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Coordenadas Finales (Scanline TO)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">Este (X)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={esteTo}
                      onChange={(e) => setEsteTo(parseFloat(e.target.value) || 0)}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">Norte (Y)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={norteTo}
                      onChange={(e) => setNorteTo(parseFloat(e.target.value) || 0)}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">Cota (Z)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={cotaTo}
                      onChange={(e) => setCotaTo(parseFloat(e.target.value) || 0)}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Physical Parameters & Geomec parameters */}
              <div className="border-t border-navy-800/60 pt-3 grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase block">Altura Ventana (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={altura}
                    onChange={(e) => setAltura(parseFloat(e.target.value) || 0)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase block">Dip Talud (&deg;)</label>
                  <input
                    type="number"
                    required
                    value={dipTalud}
                    onChange={(e) => setDipTalud(parseFloat(e.target.value) || 0)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase block">Litología (Lito-3)</label>
                  <input
                    type="text"
                    required
                    value={lito3}
                    onChange={(e) => setLito3(e.target.value.toUpperCase())}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase block">Agua Subterránea</label>
                  <select
                    value={condicionAgua}
                    onChange={(e) => setCondicionAgua(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 text-sm focus:outline-none"
                  >
                    <option value="C">Completamente seco (C)</option>
                    <option value="H">Húmedo (H)</option>
                    <option value="M">Mojado (Goteo) (M)</option>
                    <option value="E">Goteando (E)</option>
                    <option value="F">Fluyendo (F)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase block">Resistencia UCS</label>
                  <select
                    value={resistenciaUcs}
                    onChange={(e) => setResistenciaUcs(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 text-sm focus:outline-none"
                  >
                    <option value="R0">R0 — Extremadamente débil (&lt; 1 MPa)</option>
                    <option value="R1">R1 — Muy débil (1 - 5 MPa)</option>
                    <option value="R2">R2 — Débil (5 - 25 MPa)</option>
                    <option value="R3">R3 — Media / Mod. resistente (25 - 50 MPa)</option>
                    <option value="R4">R4 — Fuerte / Resistente (50 - 100 MPa)</option>
                    <option value="R5">R5 — Muy fuerte / Muy resistente (100 - 250 MPa)</option>
                    <option value="R6">R6 — Extremadamente fuerte (&gt; 250 MPa)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-navy-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-800 dark:text-orange-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 animate-pulse-ring"
                >
                  Crear Celda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
