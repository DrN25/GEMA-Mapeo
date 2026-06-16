import React from 'react';
import type { WindowHeader, CalculatorResult } from '../utils/rmrCalculator';
import { LITHOLOGY_CLASSIFICATION } from '../utils/catalogData';
import { Calendar, User, AlignLeft, FileSpreadsheet } from 'lucide-react';

interface VentanaFormProps {
  header: WindowHeader;
  onChange: (updatedHeader: WindowHeader) => void;
  calculated: CalculatorResult | null;
  onOpenImportModal: () => void;
}

export default function VentanaForm({
  header,
  onChange,
  calculated: _calculated,
  onOpenImportModal
}: VentanaFormProps) {
  const handleChange = (field: keyof WindowHeader, val: any) => {
    onChange({
      ...header,
      [field]: val
    });
  };

  // Safe coordinate numeric formatting
  const handleCoordinateChange = (field: keyof WindowHeader, val: string) => {
    if (val === '' || val === '-') {
      handleChange(field, val);
      return;
    }
    const num = parseFloat(val);
    handleChange(field, isNaN(num) ? 0 : num);
  };

  // Enforces degree limits (0-90 or 0-359) just like validarGrados in HTML
  const handleDegreeChange = (field: keyof WindowHeader, val: string, maxVal: number) => {
    if (val === '') {
      handleChange(field, '');
      return;
    }
    let num = parseFloat(val);
    if (isNaN(num)) return;
    if (num < 0) num = 0;
    if (num > maxVal) num = maxVal;
    if (maxVal === 360 && num === 360) num = 0; // 360 maps to 0
    handleChange(field, num);
  };

  // Calculate unique unidades for litologia dropdown selection
  const uniqueUnidades = Array.from(new Set(LITHOLOGY_CLASSIFICATION.map(item => item.unidad))).sort();

  // Cascading autocomplete on litologia change
  const handleUnidadChange = (unidad: string) => {
    if (!unidad) {
      onChange({
        ...header,
        unidad_litologica: '',
        lito_1: '',
        lito_2: '',
        lito_3: ''
      });
      return;
    }
    const match = LITHOLOGY_CLASSIFICATION.find(item => item.unidad === unidad);
    if (match) {
      onChange({
        ...header,
        unidad_litologica: unidad,
        lito_1: match.litologia,
        lito_2: match.codigo,
        lito_3: match.grupo
      });
    } else {
      handleChange('unidad_litologica', unidad);
    }
  };

  // Determine if From/To coordinates are entered to auto-calculate Largo (3D distance)
  const ix = parseFloat(String(header.este_from));
  const iy = parseFloat(String(header.norte_from));
  const ic = parseFloat(String(header.cota_from));
  const fx = parseFloat(String(header.este_to));
  const fy = parseFloat(String(header.norte_to));
  const fc = parseFloat(String(header.cota_to));

  const hasCoords = [ix, iy, ic, fx, fy, fc].every(n => !isNaN(n) && n !== 0);
  const calculatedLargo = hasCoords
    ? Math.sqrt(Math.pow(fx - ix, 2) + Math.pow(fy - iy, 2) + Math.pow(fc - ic, 2))
    : null;

  // Sync auto length calculation to state if coords change
  React.useEffect(() => {
    if (calculatedLargo !== null) {
      if (parseFloat(String(header.largo)) !== parseFloat(calculatedLargo.toFixed(2))) {
        handleChange('largo', calculatedLargo.toFixed(2));
      }
    }
  }, [calculatedLargo]);

  return (
    <div className="space-y-6 select-none text-left">
      
      {/* SECCIÓN 1: DATOS DE IDENTIFICACIÓN Y COORDENADAS 3D */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 bg-navy-900/10">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest border-b border-navy-800 pb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs md:text-sm">
            <AlignLeft size={14} className="text-blue-500" />
            <span>Datos de Registro — Identificación de la ventana</span>
          </span>
          <button
            type="button"
            onClick={onOpenImportModal}
            className="flex items-center gap-1.5 bg-navy-900 border border-navy-800 hover:bg-navy-850 hover:border-blue-500/30 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md"
            title="Importar y sobrescribir con Excel"
          >
            <FileSpreadsheet size={14} className="text-blue-500" />
            <span>Importar Excel</span>
          </button>
        </h3>

        {/* Coordenadas e Identificación */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Código Celda</label>
            <input
              type="text"
              id="header-celda"
              value={header.celda}
              onChange={(e) => handleChange('celda', e.target.value.toUpperCase())}
              placeholder="TD2-001"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 tracking-wider text-xs"
            />
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Coordenadas INICIALES (From)</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Este"
                value={header.este_from}
                id="header-este_from"
                onChange={(e) => handleCoordinateChange('este_from', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
                title="Este FROM"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Norte"
                value={header.norte_from}
                onChange={(e) => handleCoordinateChange('norte_from', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
                title="Norte FROM"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Cota"
                value={header.cota_from}
                onChange={(e) => handleCoordinateChange('cota_from', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
                title="Cota FROM"
              />
            </div>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Coordenadas FINALES (To)</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Este"
                value={header.este_to}
                id="header-este_to"
                onChange={(e) => handleCoordinateChange('este_to', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
                title="Este TO"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Norte"
                value={header.norte_to}
                onChange={(e) => handleCoordinateChange('norte_to', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
                title="Norte TO"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Cota"
                value={header.cota_to}
                onChange={(e) => handleCoordinateChange('cota_to', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
                title="Cota TO"
              />
            </div>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between block">
              <span>Largo (m)</span>
              {calculatedLargo !== null && (
                <span className="text-[10px] bg-orange-950/40 border border-orange-500/30 text-orange-400 font-bold px-1.5 py-0.2 rounded">AUTO</span>
              )}
            </label>
            <input
              type="text"
              id="header-largo"
              value={header.largo || ''}
              readOnly={calculatedLargo !== null}
              onChange={(e) => handleChange('largo', e.target.value)}
              className={`w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-center ${
                calculatedLargo !== null ? 'text-orange-400 cursor-not-allowed bg-navy-950/50' : 'text-slate-100 bg-navy-900/40'
              }`}
              placeholder="m"
            />
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: DIMENSIONES, ORIENTACIÓN Y LITOLOGÍA BASE */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 bg-navy-900/10">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Altura (m)</label>
            <input
              type="number"
              step="0.1"
              value={header.altura}
              id="header-altura"
              onChange={(e) => handleChange('altura', parseFloat(e.target.value) || 0)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Dip Talud&deg;</label>
            <input
              type="number"
              min="0"
              max="90"
              placeholder="0-90"
              value={header.dip_talud !== undefined ? header.dip_talud : ''}
              onChange={(e) => handleDegreeChange('dip_talud', e.target.value, 90)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">DipDir Talud&deg;</label>
            <input
              type="number"
              min="0"
              max="359"
              placeholder="0-359"
              value={header.dipdir_talud !== undefined ? header.dipdir_talud : ''}
              onChange={(e) => handleDegreeChange('dipdir_talud', e.target.value, 360)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Dip Hw&deg;</label>
            <input
              type="number"
              min="0"
              max="90"
              placeholder="0-90"
              value={header.dip_hw !== undefined ? header.dip_hw : ''}
              onChange={(e) => handleDegreeChange('dip_hw', e.target.value, 90)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Az Hw&deg;</label>
            <input
              type="number"
              min="0"
              max="359"
              placeholder="0-359"
              value={header.az_hw !== undefined ? header.az_hw : ''}
              onChange={(e) => handleDegreeChange('az_hw', e.target.value, 360)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Unidad Litológica</label>
            <select
              value={header.unidad_litologica || ''}
              onChange={(e) => handleUnidadChange(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal cursor-pointer"
            >
              <option value="">— Seleccione —</option>
              {uniqueUnidades.map(u => (
                <option key={u} value={u} className="bg-navy-900 text-slate-100 text-xs">{u}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: LITOLOGÍA DE DETALLE Y METADATOS COMPLEMENTARIOS */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 bg-navy-900/10">
        <div className="grid grid-cols-2 md:grid-cols-8 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Litología</label>
            <input
              type="text"
              value={header.lito_1 || ''}
              onChange={(e) => handleChange('lito_1', e.target.value)}
              placeholder="Lito"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Código</label>
            <input
              type="text"
              value={header.lito_2 || ''}
              onChange={(e) => handleChange('lito_2', e.target.value)}
              placeholder="Cod"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Grupo</label>
            <input
              type="text"
              value={header.lito_3 || ''}
              onChange={(e) => handleChange('lito_3', e.target.value)}
              placeholder="Grupo"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Sector</label>
            <input
              type="text"
              value={header.sector || ''}
              onChange={(e) => handleChange('sector', e.target.value)}
              placeholder="Sector"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Fase</label>
            <input
              type="text"
              value={header.fase || ''}
              onChange={(e) => handleChange('fase', e.target.value)}
              placeholder="Fase"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Nivel</label>
            <input
              type="text"
              value={header.nivel || ''}
              onChange={(e) => handleChange('nivel', e.target.value)}
              placeholder="Nivel"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Fecha</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-2.5 top-2 text-slate-500 pointer-events-none" />
              <input
                type="date"
                value={header.fecha || ''}
                onChange={(e) => handleChange('fecha', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-9 pr-2 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Mapeador</label>
            <div className="relative">
              <User size={14} className="absolute left-2.5 top-2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={header.mapeador || ''}
                onChange={(e) => handleChange('mapeador', e.target.value)}
                placeholder="Nombre"
                className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-9 pr-2 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
              />
            </div>
          </div>
        </div>

        {/* Metadatos Geotécnicos de Zona */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-navy-850 pt-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Sector Geotécnico</label>
            <input
              type="text"
              value={header.sect_geot || ''}
              onChange={(e) => handleChange('sect_geot', e.target.value)}
              placeholder="Sector Geot."
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Intemperia / Grado</label>
            <input
              type="text"
              value={header.intemperia || ''}
              onChange={(e) => handleChange('intemperia', e.target.value)}
              placeholder="Grado de meteorización"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Alt. de Zona</label>
            <input
              type="text"
              value={header.alt_zona || ''}
              onChange={(e) => handleChange('alt_zona', e.target.value)}
              placeholder="Alta / Media / Baja"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
            />
          </div>
        </div>
      </div>
      
    </div>
  );
}