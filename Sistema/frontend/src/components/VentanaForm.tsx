import type { WindowHeader, CalculatorResult } from '../utils/rmrCalculator';
import { LITHOLOGY_CATALOG, GROUNDWATER_CATALOG, STRENGTH_CATALOG } from '../utils/catalogData';
import { Calendar, User, Compass, ArrowRightLeft, AlignLeft, FileSpreadsheet } from 'lucide-react';

interface VentanaFormProps {
  header: WindowHeader;
  onChange: (updatedHeader: WindowHeader) => void;
  calculated: CalculatorResult | null;
  onOpenImportModal: () => void;
}

export default function VentanaForm({
  header,
  onChange,
  calculated,
  onOpenImportModal
}: VentanaFormProps) {
  const handleChange = (field: keyof WindowHeader, val: any) => {
    onChange({
      ...header,
      [field]: val
    });
  };

  const handleCoordinateChange = (field: keyof WindowHeader, val: string) => {
    const num = parseFloat(val);
    handleChange(field, isNaN(num) ? 0 : num);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 select-none text-left">
      {/* CARD 1: METADATOS GENERALES */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4">
        <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest border-b border-navy-800/60 pb-2 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlignLeft size={14} className="text-orange-400" />
            <span>Información General</span>
          </span>
          <button
            type="button"
            onClick={onOpenImportModal}
            className="flex items-center gap-1 bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-300 px-2.5 py-1 rounded text-xs font-bold transition-all shadow-sm active:scale-95"
            title="Importar y sobrescribir con Excel"
          >
            <FileSpreadsheet size={12} className="text-amber-400" />
            <span>Importar Excel</span>
          </button>
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Código Celda</label>
            <input
              type="text"
              id="header-celda"
              value={header.celda}
              onChange={(e) => handleChange('celda', e.target.value.toUpperCase())}
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Mapeador / Geólogo</label>
            <div className="relative">
              <User size={12} className="absolute left-2.5 top-3 text-slate-500" />
              <input
                type="text"
                value={header.mapeador || ''}
                onChange={(e) => handleChange('mapeador', e.target.value)}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg pl-8 pr-2 py-2 text-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 font-semibold"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase block">Sector</label>
            <input
              type="text"
              value={header.sector || ''}
              onChange={(e) => handleChange('sector', e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase block">Fase</label>
            <input
              type="text"
              value={header.fase || ''}
              onChange={(e) => handleChange('fase', e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase block">Nivel</label>
            <input
              type="text"
              value={header.nivel || ''}
              onChange={(e) => handleChange('nivel', e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-navy-800/40 pt-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fecha</label>
            <div className="relative">
              <Calendar size={12} className="absolute left-2.5 top-3 text-slate-500" />
              <input
                type="date"
                value={header.fecha || ''}
                onChange={(e) => handleChange('fecha', e.target.value)}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg pl-8 pr-2 py-2 text-slate-300 text-xs focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Litología (Lito-3)</label>
            <select
              value={header.lito_3 || ''}
              onChange={(e) => handleChange('lito_3', e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-200 text-xs focus:outline-none font-bold"
            >
              {Object.keys(LITHOLOGY_CATALOG).map(code => (
                <option key={code} value={code}>
                  {code} - {LITHOLOGY_CATALOG[code].name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* CARD 2: SCANLINE CARTESIANO 3D */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4">
        <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest border-b border-navy-800/60 pb-2 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ArrowRightLeft size={14} className="text-amber-400" />
            <span>Scanline de Detalle 3D</span>
          </span>
          <span className="text-xs bg-navy-900 border border-navy-800 px-1.5 py-0.5 rounded text-amber-400 font-bold uppercase shrink-0">
            Largo: {calculated ? `${calculated.largo.toFixed(2)}m` : '0m'}
          </span>
        </h3>

        <div className="space-y-3">
          {/* Coordinates FROM */}
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Coordenada FROM (Scanline Inicial)</span>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Este"
                value={header.este_from}
                id="header-este_from"
                onChange={(e) => handleCoordinateChange('este_from', e.target.value)}
                className="bg-navy-950 border border-navy-800 rounded px-2 py-1.5 text-slate-100 text-xs focus:outline-none"
                title="Este FROM"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Norte"
                value={header.norte_from}
                onChange={(e) => handleCoordinateChange('norte_from', e.target.value)}
                className="bg-navy-950 border border-navy-800 rounded px-2 py-1.5 text-slate-100 text-xs focus:outline-none"
                title="Norte FROM"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Cota"
                value={header.cota_from}
                onChange={(e) => handleCoordinateChange('cota_from', e.target.value)}
                className="bg-navy-950 border border-navy-800 rounded px-2 py-1.5 text-slate-100 text-xs focus:outline-none"
                title="Cota FROM"
              />
            </div>
          </div>

          {/* Coordinates TO */}
          <div className="space-y-1 pt-1 border-t border-navy-850">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Coordenada TO (Scanline Final)</span>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Este"
                value={header.este_to}
                id="header-este_to"
                onChange={(e) => handleCoordinateChange('este_to', e.target.value)}
                className="bg-navy-950 border border-navy-800 rounded px-2 py-1.5 text-slate-100 text-xs focus:outline-none"
                title="Este TO"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Norte"
                value={header.norte_to}
                onChange={(e) => handleCoordinateChange('norte_to', e.target.value)}
                className="bg-navy-950 border border-navy-800 rounded px-2 py-1.5 text-slate-100 text-xs focus:outline-none"
                title="Norte TO"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Cota"
                value={header.cota_to}
                onChange={(e) => handleCoordinateChange('cota_to', e.target.value)}
                className="bg-navy-950 border border-navy-800 rounded px-2 py-1.5 text-slate-100 text-xs focus:outline-none"
                title="Cota TO"
              />
            </div>
          </div>

          {/* Dimensiones */}
          <div className="grid grid-cols-2 gap-3 border-t border-navy-850 pt-2.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Altura (m)</label>
              <input
                type="number"
                step="0.5"
                value={header.altura}
                id="header-altura"
                onChange={(e) => handleChange('altura', parseFloat(e.target.value) || 0)}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Dip Talud (&deg;)</label>
              <input
                type="number"
                value={header.dip_talud || 0}
                onChange={(e) => handleChange('dip_talud', parseFloat(e.target.value) || 0)}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CARD 3: GEOMECÁNICA DE LA PARED */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4">
        <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest border-b border-navy-800/60 pb-2 flex items-center gap-2">
          <Compass size={14} className="text-emerald-400" />
          <span>Parámetros de la Pared</span>
        </h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Agua Subterránea</label>
            <select
              value={header.condicion_agua}
              onChange={(e) => handleChange('condicion_agua', e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-300 text-xs focus:outline-none"
            >
              {Object.keys(GROUNDWATER_CATALOG).map(code => (
                <option key={code} value={code}>
                  {GROUNDWATER_CATALOG[code].desc}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Resistencia de la Roca (UCS)</label>
            <select
              value={header.resistencia_ucs}
              onChange={(e) => handleChange('resistencia_ucs', e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-2 text-slate-300 text-xs focus:outline-none"
            >
              {Object.keys(STRENGTH_CATALOG).map(code => (
                <option key={code} value={code}>
                  {STRENGTH_CATALOG[code].desc}
                </option>
              ))}
            </select>
          </div>

          {/* Computations Feedbacks */}
          {calculated && (
            <div className="grid grid-cols-2 gap-2 bg-navy-950/60 border border-navy-850 p-2.5 rounded-lg text-xs text-slate-400">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-500 block">Dip Scanline:</span>
                <span className="text-slate-200 font-semibold text-xs">{calculated.dip_hole.toFixed(2)}&deg;</span>
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-slate-500 block">Azimut Scanline:</span>
                <span className="text-slate-200 font-semibold text-xs">{calculated.az_hole.toFixed(2)}&deg;</span>
              </div>
              <div className="space-y-0.5 mt-1 border-t border-navy-850 pt-1">
                <span className="font-bold text-slate-500 block">DipDir Talud:</span>
                <span className="text-amber-400 font-bold text-xs">{calculated.dip_dir_talud.toFixed(2)}&deg;</span>
              </div>
              <div className="space-y-0.5 mt-1 border-t border-navy-850 pt-1">
                <span className="font-bold text-slate-500 block">RMR R89 Est:</span>
                <span className="text-emerald-400 font-bold text-xs">{calculated.rmr_89} ({calculated.class_89})</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
