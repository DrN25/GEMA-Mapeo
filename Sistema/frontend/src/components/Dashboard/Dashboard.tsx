import React, { useState } from 'react';
import { Plus, Search, Map, User, LayoutGrid, Trash2, TrendingUp, FileSpreadsheet, Calendar } from 'lucide-react';

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

  // Form state for creating a window celda (Defaulted to empty values)
  const [celda, setCelda] = useState('');
  const [proyecto, setProyecto] = useState('Proyecto A');
  const [mapeador, setMapeador] = useState('');
  const [sector, setSector] = useState('');
  const [fase, setFase] = useState('');
  const [nivel, setNivel] = useState('');
  const [esteFrom, setEsteFrom] = useState('');
  const [norteFrom, setNorteFrom] = useState('');
  const [cotaFrom, setCotaFrom] = useState('');
  const [esteTo, setEsteTo] = useState('');
  const [norteTo, setNorteTo] = useState('');
  const [cotaTo, setCotaTo] = useState('');
  const [altura, setAltura] = useState<number | ''>('');
  const [campania, setCampania] = useState(new Date().getFullYear().toString());
  const [turno, setTurno] = useState('Día');

  const handleNumberInputLimit = (value: string, intDigits: number, decDigits: number): string => {
    // Keep only numbers and dot
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return cleaned.slice(0, -1);

    let integerPart = parts[0];
    let decimalPart = parts[1];

    if (integerPart.length > intDigits) {
      integerPart = integerPart.slice(0, intDigits);
    }
    if (decimalPart !== undefined && decimalPart.length > decDigits) {
      decimalPart = decimalPart.slice(0, decDigits);
    }

    return decimalPart !== undefined ? `${integerPart}.${decimalPart}` : integerPart;
  };

  const ix = parseFloat(esteFrom);
  const iy = parseFloat(norteFrom);
  const ic = parseFloat(cotaFrom);
  const fx = parseFloat(esteTo);
  const fy = parseFloat(norteTo);
  const fc = parseFloat(cotaTo);

  const hasCoords = [ix, iy, ic, fx, fy, fc].every(n => !isNaN(n) && n !== 0);
  const calculatedLargo = hasCoords
    ? Math.sqrt(Math.pow(fx - ix, 2) + Math.pow(fy - iy, 2) + Math.pow(fc - ic, 2))
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!celda.trim()) return;

    onCreateWindow({
      celda: celda.trim().toUpperCase(),
      este_from: esteFrom === '' ? 0 : Number(esteFrom),
      norte_from: norteFrom === '' ? 0 : Number(norteFrom),
      cota_from: cotaFrom === '' ? 0 : Number(cotaFrom),
      este_to: esteTo === '' ? 0 : Number(esteTo),
      norte_to: norteTo === '' ? 0 : Number(norteTo),
      cota_to: cotaTo === '' ? 0 : Number(cotaTo),
      largo_m: calculatedLargo !== null ? calculatedLargo : 0,
      altura: altura === '' ? 0 : Number(altura),
      dip_talud: 64.0, // default
      lito_3: '', // default
      lito_model: '', // default
      mapeador: mapeador.trim(),
      sector: sector.trim(),
      fase: fase.trim(),
      nivel: nivel.trim(),
      sect_geot: sector.trim(),
      fecha: new Date().toISOString().split('T')[0],
      condicion_agua: 'C', // default
      resistencia_ucs: 'R4', // default
      campania: parseInt(campania) || 2026,
      turno,
      joints: [],
      calculated: null
    });

    // Reset all form states to empty on successful submit
    setShowModal(false);
    setCelda('');
    setProyecto('Proyecto A');
    setMapeador('');
    setSector('');
    setFase('');
    setNivel('');
    setEsteFrom('');
    setNorteFrom('');
    setCotaFrom('');
    setEsteTo('');
    setNorteTo('');
    setCotaTo('');
    setAltura('');
    setCampania(new Date().getFullYear().toString());
    setTurno('Día');
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
          <h2 className="text-2xl font-black text-slate-100 tracking-wide bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Mapeo Geomecánico de Ventanas</h2>
          <p className="text-slate-400 text-xs mt-1">Registra, audita y calcula el RMR en ventanas de escaneo estructural en tiempo real.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-1.5 bg-navy-900 border border-navy-800 hover:bg-navy-850 hover:border-indigo-500/30 text-slate-300 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95"
          >
            <FileSpreadsheet size={18} className="text-indigo-400" />
            <span>Importar Excel (Local)</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-800 dark:text-indigo-400 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95"
          >
            <Plus size={18} />
            <span>Nueva Celda de Mapeo</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Date Card */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Fecha de Hoy</span>
            <span className="text-2xl font-black text-slate-100 block">
              {dayNum} {monthName}
            </span>
            <span className="text-[10px] font-bold text-slate-400 block leading-none">{capitalizedWeekday}</span>
          </div>
          <Calendar size={24} className="text-indigo-500/40" />
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Total Celdas</span>
            <span className="text-2xl font-black text-slate-100 block">{windows.length}</span>
          </div>
          <LayoutGrid size={24} className="text-indigo-500/40" />
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Avance Escaneado</span>
            <span className="text-2xl font-black text-slate-100 block">{totalLargoM.toFixed(1)} m</span>
          </div>
          <Map size={24} className="text-indigo-500/40" />
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">RMR Promedio</span>
            <span className="text-2xl font-black text-indigo-400 block">{rmrPromedio}</span>
          </div>
          <TrendingUp size={24} className="text-indigo-500/40" />
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Último Mapeador</span>
            <span className="text-lg font-black text-slate-100 block truncate max-w-[140px]">
              {windows.length > 0 ? windows[windows.length - 1].geologo : 'N/A'}
            </span>
          </div>
          <User size={24} className="text-indigo-500/40" />
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
            className="w-full bg-navy-950 border border-navy-800 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${w.rmr_89 >= 61 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
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
                        className="bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded text-xs font-bold transition-all shadow-sm active:scale-95"
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

      {/* Modal Registro Nueva Celda (Modificado con un ancho max-w-2xl para mayor holgura) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl p-6 rounded-xl border border-navy-800 space-y-4 text-left shadow-2xl bg-navy-900/95 my-8">
            <h3 className="text-base font-bold text-slate-100 tracking-wide border-b border-navy-800 pb-2 uppercase flex items-center gap-2">
              <Plus size={18} className="text-indigo-400" />
              <span>Nueva Celda de Mapeo Geomecánico</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Código Celda / Ventana</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. TD2-001"
                    value={celda}
                    onChange={(e) => setCelda(e.target.value.toUpperCase())}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold tracking-wider"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Mapeador</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. AS-HM"
                    value={mapeador}
                    onChange={(e) => setMapeador(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
                  />
                </div>
              </div>

              {/* Distribución optimizada con Proyecto, Campaña y Turno */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Proyecto</label>
                  <select
                    required
                    value={proyecto}
                    onChange={(e) => setProyecto(e.target.value)}
                    className={`w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold cursor-pointer ${proyecto === '' ? 'text-slate-500' : 'text-slate-100'
                      }`}
                  >
                    <option value="Proyecto A" className="bg-navy-950 text-slate-100">Proyecto A</option>
                    <option value="Proyecto B" className="bg-navy-950 text-slate-100">Proyecto B</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Campaña (Año)</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. 2026"
                    value={campania}
                    onChange={(e) => setCampania(handleNumberInputLimit(e.target.value, 4, 0))}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Turno</label>
                  <select
                    required
                    value={turno}
                    onChange={(e) => setTurno(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold cursor-pointer"
                  >
                    <option value="Día" className="bg-navy-950 text-slate-100">Día</option>
                    <option value="Noche" className="bg-navy-950 text-slate-100">Noche</option>
                  </select>
                </div>
              </div>

              {/* Fila con Sector, Fase, Nivel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Sector</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. E1"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Fase</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. 5"
                    value={fase}
                    onChange={(e) => setFase(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Nivel</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. 3960"
                    value={nivel}
                    onChange={(e) => setNivel(handleNumberInputLimit(e.target.value, 4, 2))}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
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
                      type="text"
                      required
                      placeholder="794444.8700"
                      value={esteFrom}
                      onChange={(e) => setEsteFrom(handleNumberInputLimit(e.target.value, 6, 4))} // <- Cambiado a 4 decimales
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-1.5 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">Norte (Y)</label>
                    <input
                      type="text"
                      required
                      placeholder="8440465.910"
                      value={norteFrom}
                      onChange={(e) => setNorteFrom(handleNumberInputLimit(e.target.value, 7, 3))} // <- Cambiado a 3 decimales
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-1.5 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
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
                      type="text"
                      required
                      placeholder="794449.1300"
                      value={esteTo}
                      onChange={(e) => setEsteTo(handleNumberInputLimit(e.target.value, 6, 4))} // <- Cambiado a 4 decimales
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-1.5 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">Norte (Y)</label>
                    <input
                      type="text"
                      required
                      placeholder="8440455.690"
                      value={norteTo}
                      onChange={(e) => setNorteTo(handleNumberInputLimit(e.target.value, 7, 3))} // <- Cambiado a 3 decimales
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-1.5 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Physical Parameters */}
              <div className="border-t border-navy-800/60 pt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase block">Altura Ventana (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="15.0"
                    value={altura}
                    onChange={(e) => setAltura(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase block">Largo (m)</label>
                  <div className="w-full bg-navy-900/60 border border-navy-800 rounded-lg px-3 py-2 text-indigo-400 text-sm font-bold flex items-center justify-center min-h-[38px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
                    {calculatedLargo !== null ? `${Math.round(calculatedLargo)}` : '—'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-navy-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-300 px-4 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95"
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