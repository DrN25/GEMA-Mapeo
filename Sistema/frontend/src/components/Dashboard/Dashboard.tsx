import React, { useState } from 'react';
import { Plus, Search, Map, User, LayoutGrid, Trash2, TrendingUp, FileSpreadsheet, Calendar } from 'lucide-react';

export interface WindowSummary {
  name: string;
  proyecto: string;
  geologo: string;
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
      dip_talud: 64.0,
      lito_3: '',
      lito_model: '',
      mapeador: mapeador.trim(),
      sector: sector.trim(),
      fase: fase.trim(),
      nivel: nivel.trim(),
      sect_geot: sector.trim(),
      fecha: new Date().toISOString().split('T')[0],
      condicion_agua: 'C',
      resistencia_ucs: 'R4',
      campania: parseInt(campania) || 2026,
      turno,
      joints: [],
      calculated: null
    });

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
    <div className="space-y-6 select-none w-full animate-fade-in text-left">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 tracking-wide flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
            <span>Mapeo Geomecánico de Ventanas de Detalle</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1 font-semibold">Registro estructural sistemático, auditorías STRUCT-QA/QC y análisis de calidad de macizo rocoso.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(16,185,129,0.12)] active:scale-95"
          >
            <FileSpreadsheet size={16} className="text-emerald-400" />
            <span>Importar Excel</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.12)] px-4 py-2 rounded-lg text-xs"
          >
            <Plus size={16} />
            <span>Nueva Celda</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Date Card */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Fecha de Hoy</span>
            <span className="text-xl font-black text-slate-100 block">{dayNum} {monthName}</span>
            <span className="text-[10px] font-bold text-indigo-400 block leading-none">{capitalizedWeekday}</span>
          </div>
          <Calendar size={22} className="text-indigo-500/40" />
        </div>

        {/* Total Celdas */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Total Celdas</span>
            <span className="text-xl font-black text-slate-100 block">{windows.length}</span>
            <span className="text-[10px] font-bold text-slate-400 block leading-none">Registradas en DB</span>
          </div>
          <LayoutGrid size={22} className="text-indigo-500/40" />
        </div>

        {/* Avance Escaneado */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Avance Escaneado</span>
            <span className="text-xl font-black text-slate-100 block">{totalLargoM.toFixed(1)} m</span>
            <span className="text-[10px] font-bold text-emerald-400 block leading-none">Longitud total</span>
          </div>
          <Map size={22} className="text-emerald-500/40 animate-pulse" />
        </div>

        {/* RMR Promedio */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">RMR Promedio</span>
            <span className="text-xl font-black text-indigo-400 block">{rmrPromedio}</span>
            <span className="text-[10px] font-bold text-indigo-400 block leading-none">Calidad de roca</span>
          </div>
          <TrendingUp size={22} className="text-indigo-400/40" />
        </div>

        {/* Ultimo Mapeador */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Último Mapeador</span>
            <span className="text-base font-black text-slate-200 block truncate max-w-[130px]">
              {windows.length > 0 ? windows[windows.length - 1].geologo : 'N/A'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 block leading-none">Responsable</span>
          </div>
          <User size={22} className="text-indigo-500/40" />
        </div>
      </div>

      {/* Grid */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/15 shadow-xl space-y-4">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar celda por código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-navy-950/80 border border-navy-800 rounded-lg pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-navy-900 bg-navy-950/30">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 font-black uppercase tracking-wider border-b border-navy-800/80 bg-navy-900/40 h-9">
                <th className="py-2 px-4">Celda de Mapeo</th>
                <th className="py-2 px-4 text-center">Largo (m)</th>
                <th className="py-2 px-4 text-center">Altura (m)</th>
                <th className="py-2 px-4">Mapeador</th>
                <th className="py-2 px-4 text-center">RMR 89</th>
                <th className="py-2 px-4 text-center">Clase Verbal</th>
                <th className="py-2 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-900/30 text-slate-200 font-medium">
              {filtered.map(w => (
                <tr
                  key={w.name}
                  onClick={() => onSelectWindow(w.name)}
                  className="hover:bg-navy-900/20 cursor-pointer transition-colors h-11"
                >
                  <td className="py-2.5 px-4 font-black text-slate-100 tracking-wide">{w.name}</td>
                  <td className="py-2.5 px-4 text-center text-slate-300 font-bold">{w.largo.toFixed(2)} m</td>
                  <td className="py-2.5 px-4 text-center text-slate-400">{w.altura.toFixed(1)} m</td>
                  <td className="py-2.5 px-4 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-slate-500" />
                      <span>{w.geologo}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-center font-bold text-indigo-400">{w.rmr_89}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${w.rmr_89 >= 81 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]' :
                        w.rmr_89 >= 61 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.05)]' :
                          w.rmr_89 >= 41 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-[0_0_8px_rgba(245,158,11,0.05)]' :
                            'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.1)]'
                      }`}>
                      {w.class_89}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => onSelectWindow(w.name)}
                        className="bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all shadow-sm active:scale-95 px-3 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5"
                      >
                        Mapear
                      </button>
                      <button
                        onClick={() => onDeleteWindow(w.name)}
                        className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200 shadow-sm active:scale-90 flex items-center justify-center"
                        title="Eliminar celda"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs font-semibold">
                    No se encontraron celdas de mapeo registradas. Haz clic en "Nueva Celda" para iniciar una.
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
          <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl border border-navy-800 shadow-2xl bg-navy-900/95 my-8 relative overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 w-full absolute top-0 left-0" />
            <h3 className="text-sm font-black text-slate-100 tracking-wider border-b border-navy-800 pb-3 uppercase flex items-center gap-2 mt-1">
              <Plus size={16} className="text-indigo-400" />
              <span>Nueva Celda de Mapeo Geomecánico</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Código Celda / Ventana</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. TD2-001"
                    value={celda}
                    onChange={(e) => setCelda(e.target.value.toUpperCase())}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold tracking-wider"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Mapeador</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. AS-HM"
                    value={mapeador}
                    onChange={(e) => setMapeador(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Proyecto</label>
                  <select
                    required
                    value={proyecto}
                    onChange={(e) => setProyecto(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer text-slate-100"
                  >
                    <option value="Proyecto A">Proyecto A</option>
                    <option value="Proyecto B">Proyecto B</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Campaña (Año)</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. 2026"
                    value={campania}
                    onChange={(e) => setCampania(handleNumberInputLimit(e.target.value, 4, 0))}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Turno</label>
                  <select
                    required
                    value={turno}
                    onChange={(e) => setTurno(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer"
                  >
                    <option value="Día">Día</option>
                    <option value="Noche">Noche</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Sector</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. E1"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Fase</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. 5"
                    value={fase}
                    onChange={(e) => setFase(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Nivel</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. 3960"
                    value={nivel}
                    onChange={(e) => setNivel(handleNumberInputLimit(e.target.value, 4, 2))}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div className="border-t border-navy-800/80 pt-3.5">
                <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-2">Coordenadas Iniciales (Scanline FROM)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1 col-span-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Este (X)</label>
                        <input
                          type="text"
                          required
                          placeholder="794444.8700"
                          value={esteFrom}
                          onChange={(e) => setEsteFrom(handleNumberInputLimit(e.target.value, 6, 4))}
                          className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Norte (Y)</label>
                        <input
                          type="text"
                          required
                          placeholder="8440465.910"
                          value={norteFrom}
                          onChange={(e) => setNorteFrom(handleNumberInputLimit(e.target.value, 7, 3))}
                          className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Cota (Z)</label>
                    <input
                      type="text"
                      required
                      placeholder="3960.50"
                      value={cotaFrom}
                      onChange={(e) => setCotaFrom(handleNumberInputLimit(e.target.value, 4, 2))}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-navy-800/60 pt-3">
                <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-wider mb-2">Coordenadas Finales (Scanline TO)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1 col-span-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Este (X)</label>
                        <input
                          type="text"
                          required
                          placeholder="794449.1300"
                          value={esteTo}
                          onChange={(e) => setEsteTo(handleNumberInputLimit(e.target.value, 6, 4))}
                          className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Norte (Y)</label>
                        <input
                          type="text"
                          required
                          placeholder="8440455.690"
                          value={norteTo}
                          onChange={(e) => setNorteTo(handleNumberInputLimit(e.target.value, 7, 3))}
                          className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Cota (Z)</label>
                    <input
                      type="text"
                      required
                      placeholder="3961.10"
                      value={cotaTo}
                      onChange={(e) => setCotaTo(handleNumberInputLimit(e.target.value, 4, 2))}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-navy-800/80 pt-3.5 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">Altura Ventana (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="15.0"
                    value={altura}
                    onChange={(e) => setAltura(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">Largo de celda calculada (m)</label>
                  <div className="w-full bg-navy-950/80 border border-navy-800 rounded-lg px-3 py-2 text-indigo-400 text-xs font-black flex items-center justify-center min-h-[34px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
                    {calculatedLargo !== null ? `${Math.round(calculatedLargo)}` : '—'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-4 border-t border-navy-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all shadow-sm active:scale-95 px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5"
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