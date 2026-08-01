import React, { useState, useEffect } from 'react';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import MapeadorCombobox from './MapeadorCombobox';

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8001`;

interface CreateWindowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: any) => void;
}

interface CatalogOption {
  codigo: string;
  nombre: string;
}

const handleNumberInputLimit = (value: string, intDigits: number, decDigits: number): string => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return cleaned.slice(0, -1);
  let integerPart = parts[0];
  let decimalPart = parts[1];
  if (integerPart.length > intDigits) integerPart = integerPart.slice(0, intDigits);
  if (decimalPart !== undefined && decimalPart.length > decDigits) decimalPart = decimalPart.slice(0, decDigits);
  return decimalPart !== undefined ? `${integerPart}.${decimalPart}` : integerPart;
};

export default function CreateWindowModal({ isOpen, onClose, onCreate }: CreateWindowModalProps) {
  const [celda, setCelda] = useState('');
  const [mapeadorId, setMapeadorId] = useState('');
  const [sector, setSector] = useState('');
  const [campania, setCampania] = useState('');
  const [nivel, setNivel] = useState('');
  const [fase, setFase] = useState('');
  const [esteFrom, setEsteFrom] = useState('');
  const [norteFrom, setNorteFrom] = useState('');
  const [cotaFrom, setCotaFrom] = useState('');
  const [esteTo, setEsteTo] = useState('');
  const [norteTo, setNorteTo] = useState('');
  const [cotaTo, setCotaTo] = useState('');
  const [altura, setAltura] = useState<number | ''>('');

  const [sectores, setSectores] = useState<CatalogOption[]>([]);
  const [mapeadores, setMapeadores] = useState<CatalogOption[]>([]);
  const [campanias, setCampanias] = useState<{ id: number; nombre: string }[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingCatalogs(true);
    fetch(`${API_BASE}/api/filtros/opciones`)
      .then(r => r.json())
      .then(data => {
        setSectores(data.sectores || []);
        setMapeadores(data.mapeadores || []);
        setCampanias(data.campanias || []);
        // Defaults
        const today = new Date();
        const defaultCamp = data.campanias?.find((c: any) =>
          c.nombre.includes(String(today.getFullYear()))
        );
        if (defaultCamp) setCampania(String(defaultCamp.id));
        if (data.sectores?.length > 0) setSector(data.sectores[0].codigo);
        if (data.mapeadores?.length > 0) setMapeadorId(data.mapeadores[0].codigo);
      })
      .catch(() => {
        setCampania('');
      })
      .finally(() => setLoadingCatalogs(false));
  }, [isOpen]);

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

    onCreate({
      celda: celda.trim().toUpperCase(),
      este_from: esteFrom === '' ? 0 : Number(esteFrom),
      norte_from: norteFrom === '' ? 0 : Number(norteFrom),
      cota_from: cotaFrom === '' ? 0 : Number(cotaFrom),
      este_to: esteTo === '' ? 0 : Number(esteTo),
      norte_to: norteTo === '' ? 0 : Number(norteTo),
      cota_to: cotaTo === '' ? 0 : Number(cotaTo),
      largo_m: calculatedLargo !== null ? calculatedLargo : 0,
      altura: altura === '' ? 0 : Number(altura),
      dip_talud: 0,
      lito_3: '',
      lito_model: '',
      mapeador: mapeadorId,
      sector,
      fase,
      nivel,
      sect_geot: sector,
      fecha: new Date().toISOString().split('T')[0],
      condicion_agua: '',
      resistencia_ucs: '',
      campania: parseInt(campania) || 7,
      joints: [],
      calculated: null,
    });

    onClose();
    resetForm();
  };

  const resetForm = () => {
    setCelda('');
    setMapeadorId('');
    setSector('');
    setCampania('');
    setNivel('');
    setFase('');
    setEsteFrom(''); setNorteFrom(''); setCotaFrom('');
    setEsteTo(''); setNorteTo(''); setCotaTo('');
    setAltura('');
    setShowMore(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl border border-navy-800 shadow-2xl bg-navy-900/95 my-8 relative overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 w-full absolute top-0 left-0" />
        <div className="flex items-center justify-between border-b border-navy-800 pb-3">
          <h3 className="text-sm font-black text-slate-100 tracking-wider uppercase flex items-center gap-2 mt-1">
            <Plus size={16} className="text-indigo-400" />
            <span>Nueva Celda de Mapeo Geomecánico</span>
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-all">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Fila 1: Celda + Mapeador (select) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Código Celda / Ventana</label>
              <input type="text" required maxLength={20} placeholder="ej. TD2-001" value={celda}
                onChange={(e) => setCelda(e.target.value.trim().toUpperCase().slice(0, 20))}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold tracking-wider" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Mapeador</label>
              <MapeadorCombobox
                value={mapeadorId}
                onChange={(val) => setMapeadorId(val)}
                options={mapeadores}
                placeholder="Buscar o crear mapeador..."
              />
            </div>
          </div>

          {/* Fila 2: Campaña, Sector, Nivel */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Campaña</label>
              <select required value={campania} onChange={(e) => setCampania(e.target.value)}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer text-slate-100">
                <option value="">— Campaña —</option>
                {campanias.map(c => (
                  <option key={c.id} value={c.id} className="bg-navy-950 text-slate-100">{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Sector Geot.</label>
              <select required value={sector} onChange={(e) => setSector(e.target.value)}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer text-slate-100">
                <option value="">— Sector —</option>
                {sectores.map(s => (
                  <option key={s.codigo} value={s.codigo} className="bg-navy-950 text-slate-100">{s.codigo} — {s.nombre}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Nivel</label>
              <input type="text" required placeholder="ej. 3960" value={nivel}
                onChange={(e) => setNivel(handleNumberInputLimit(e.target.value, 4, 2))}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold" />
            </div>
          </div>

          {/* Mostrar más / menos */}
          <button type="button" onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 text-[10px] font-black text-indigo-400 uppercase tracking-wider hover:text-indigo-300 transition-all">
            {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showMore ? 'Ocultar' : 'Mostrar'} coordenadas y detalles
          </button>

          {showMore && (
            <>
              <div className="border-t border-navy-800/80 pt-3">
                <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-2">Coordenadas Iniciales (FROM)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Este (X)</label>
                    <input type="text" required placeholder="794444.8700" value={esteFrom}
                      onChange={(e) => setEsteFrom(handleNumberInputLimit(e.target.value, 6, 4))}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Norte (Y)</label>
                    <input type="text" required placeholder="8440465.910" value={norteFrom}
                      onChange={(e) => setNorteFrom(handleNumberInputLimit(e.target.value, 7, 3))}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Cota (C)</label>
                    <input type="text" required placeholder="3960.50" value={cotaFrom}
                      onChange={(e) => setCotaFrom(handleNumberInputLimit(e.target.value, 4, 2))}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center" />
                  </div>
                </div>
              </div>

              <div className="border-t border-navy-800/60 pt-3">
                <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-wider mb-2">Coordenadas Finales (TO)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Este (X)</label>
                    <input type="text" required placeholder="794449.1300" value={esteTo}
                      onChange={(e) => setEsteTo(handleNumberInputLimit(e.target.value, 6, 4))}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Norte (Y)</label>
                    <input type="text" required placeholder="8440456.690" value={norteTo}
                      onChange={(e) => setNorteTo(handleNumberInputLimit(e.target.value, 7, 3))}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Cota (C)</label>
                    <input type="text" required placeholder="3961.10" value={cotaTo}
                      onChange={(e) => setCotaTo(handleNumberInputLimit(e.target.value, 4, 2))}
                      className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">Altura Ventana (m)</label>
                  <input type="number" step="0.5" required placeholder="15.0" value={altura}
                    onChange={(e) => setAltura(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">Largo de celda (calculado)</label>
                  <div className="w-full bg-navy-950/80 border border-navy-800 rounded-lg px-3 py-2 text-indigo-400 text-xs font-black flex items-center justify-center min-h-[34px]">
                    {calculatedLargo !== null ? `${Math.round(calculatedLargo)}` : '—'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Fase</label>
                  <input type="text" inputMode="numeric" placeholder="ej. 5" value={fase}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 2);
                      setFase(cleaned);
                    }}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold" />
                </div>
              </div>
            </>
          )}

          {/* Acciones */}
          <div className="flex gap-2.5 justify-end pt-4 border-t border-navy-800">
            <button type="button" onClick={() => { onClose(); resetForm(); }}
              className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95">
              Cancelar
            </button>
            <button type="submit" disabled={loadingCatalogs}
              className="bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all shadow-sm active:scale-95 px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
              <Plus size={14} /> Crear Celda
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}