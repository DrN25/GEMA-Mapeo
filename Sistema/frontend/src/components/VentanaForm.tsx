import React from 'react';
import type { WindowHeader, CalculatorResult } from '../utils/rmrCalculator';
import { LITHOLOGY_CLASSIFICATION, ALTERACION_CATALOG } from '../utils/catalogData';
import { Calendar, User, AlignLeft, FileSpreadsheet } from 'lucide-react';

interface VentanaFormProps {
  header: WindowHeader;
  onChange: (updatedHeader: WindowHeader) => void;
  calculated: CalculatorResult | null;
  onOpenImportModal: () => void;
}

// Función helper para limitar la edición de enteros y decimales en inputs de texto
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

export default function VentanaForm({
  header,
  onChange,
  calculated: _calculated,
  onOpenImportModal
}: VentanaFormProps) {

  const [localValues, setLocalValues] = React.useState<Record<string, string>>({});

  const handleChange = (field: keyof WindowHeader, val: any) => {
    onChange({
      ...header,
      [field]: val
    });
  };

  const getInputValue = (field: keyof WindowHeader, stateVal: any): string => {
    if (localValues[field as string] !== undefined) return localValues[field as string];
    if (stateVal === undefined || stateVal === null) return '';
    return String(stateVal);
  };

  const handleCoordinateInputChange = (field: keyof WindowHeader, val: string, intDigits: number, decDigits: number) => {
    const restricted = handleNumberInputLimit(val, intDigits, decDigits);
    setLocalValues(prev => ({ ...prev, [field as string]: restricted }));

    const num = parseFloat(restricted);
    if (!isNaN(num) && restricted !== '' && !restricted.endsWith('.')) {
      handleChange(field, num);
    } else if (restricted === '') {
      handleChange(field, 0);
    }
  };

  const handleCoordinateInputBlur = (field: keyof WindowHeader, val: string) => {
    setLocalValues(prev => {
      const copy = { ...prev };
      delete copy[field as string];
      return copy;
    });
    const num = parseFloat(val);
    if (isNaN(num)) {
      handleChange(field, 0);
    } else {
      handleChange(field, num);
    }
  };

  const handleDegreeChange = (field: keyof WindowHeader, val: string, maxVal: number) => {
    if (val === '') {
      handleChange(field, '');
      return;
    }
    let num = parseFloat(val);
    if (isNaN(num)) return;

    if (field !== 'dip_hw' && num < 0) {
      num = 0;
    } else if (field === 'dip_hw' && num < -90) {
      num = -90;
    }

    if (num > maxVal) num = maxVal;
    if (maxVal === 360 && num === 360) num = 0;
    handleChange(field, Math.round(num * 100) / 100);
  };

  // 🧪 LÓGICA DE FILTRADO Y CASCADA INTELIGENTE DE LITOLOGÍAS NATIVAS
  const uniqueLito1 = Array.from(new Set(LITHOLOGY_CLASSIFICATION.map(item => item.unidad))).sort();
  const uniqueUnidades = Array.from(new Set(LITHOLOGY_CLASSIFICATION.map(item => item.grupo))).sort(); // unidad_litologica es grupo

  const filteredLito2Options = header.lito_1
    ? Array.from(new Set(LITHOLOGY_CLASSIFICATION.filter(item => item.unidad === header.lito_1).map(item => item.litologia))).sort()
    : Array.from(new Set(LITHOLOGY_CLASSIFICATION.map(item => item.litologia))).sort();

  const filteredLito3Options = header.lito_1 && header.lito_2
    ? Array.from(new Set(LITHOLOGY_CLASSIFICATION.filter(item => item.unidad === header.lito_1 && item.litologia === header.lito_2).map(item => item.codigo))).sort()
    : Array.from(new Set(LITHOLOGY_CLASSIFICATION.map(item => item.codigo))).sort();

  const handleLito1Change = (val: string) => {
    if (!val) {
      onChange({
        ...header,
        lito_1: '',
        lito_2: '',
        lito_3: '',
        unidad_litologica: ''
      });
      return;
    }
    const matches = LITHOLOGY_CLASSIFICATION.filter(item => item.unidad === val);
    if (matches.length === 1) {
      onChange({
        ...header,
        lito_1: val,
        lito_2: matches[0].litologia,
        lito_3: matches[0].codigo,
        unidad_litologica: matches[0].grupo
      });
    } else {
      const uniqueL2 = Array.from(new Set(matches.map(m => m.litologia)));
      const uniqueGrup = Array.from(new Set(matches.map(m => m.grupo)));
      onChange({
        ...header,
        lito_1: val,
        lito_2: uniqueL2.length === 1 ? uniqueL2[0] : '',
        lito_3: '',
        unidad_litologica: uniqueGrup.length === 1 ? uniqueGrup[0] : ''
      });
    }
  };

  const handleLito2Change = (val: string) => {
    if (!val) {
      onChange({
        ...header,
        lito_2: '',
        lito_3: '',
        unidad_litologica: ''
      });
      return;
    }
    const matches = LITHOLOGY_CLASSIFICATION.filter(
      item => item.unidad === header.lito_1 && item.litologia === val
    );
    if (matches.length === 1) {
      onChange({
        ...header,
        lito_2: val,
        lito_3: matches[0].codigo,
        unidad_litologica: matches[0].grupo
      });
    } else {
      onChange({
        ...header,
        lito_2: val,
        lito_3: ''
      });
    }
  };

  const handleLito3Change = (val: string) => {
    if (!val) {
      onChange({ ...header, lito_3: '' });
      return;
    }
    const match = LITHOLOGY_CLASSIFICATION.find(
      item => item.unidad === header.lito_1 && item.litologia === header.lito_2 && item.codigo === val
    ) || LITHOLOGY_CLASSIFICATION.find(item => item.codigo === val);

    if (match) {
      onChange({
        ...header,
        lito_1: match.unidad,
        lito_2: match.litologia,
        lito_3: match.codigo,
        unidad_litologica: match.grupo
      });
    }
  };

  const handleUnidadChange = (val: string) => {
    handleChange('unidad_litologica', val);
  };

  // Cálculo de largo automático redondeado estrictamente a entero
  const ix = parseFloat(String(header.este_from));
  const iy = parseFloat(String(header.norte_from));
  const ic = parseFloat(String(header.cota_from));
  const fx = parseFloat(String(header.este_to));
  const fy = parseFloat(String(header.norte_to));
  const fc = parseFloat(String(header.cota_to));

  const hasCoords = [ix, iy, ic, fx, fy, fc].every(n => !isNaN(n) && n !== 0);
  const calculatedLargo = hasCoords
    ? Math.round(Math.sqrt(Math.pow(fx - ix, 2) + Math.pow(fy - iy, 2) + Math.pow(fc - ic, 2)))
    : null;

  React.useEffect(() => {
    if (calculatedLargo !== null) {
      if (Number(header.largo) !== calculatedLargo) {
        handleChange('largo', calculatedLargo);
      }
    }
  }, [calculatedLargo]);

  return (
    <div className="space-y-4 select-none text-left">
      {/* SECCIÓN 1: DATOS DE IDENTIFICACIÓN Y COORDENADAS 3D APILADAS VERTICALMENTE */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 bg-navy-900/10">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest border-b border-navy-800 pb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs md:text-sm">
            <AlignLeft size={14} className="text-emerald-500" />
            <span>Datos de Registro — Identificación de la ventana</span>
          </span>
          <button
            type="button"
            onClick={onOpenImportModal}
            className="flex items-center gap-1.5 bg-navy-900 border border-navy-800 hover:bg-navy-850 hover:border-emerald-500/30 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md"
          >
            <FileSpreadsheet size={14} className="text-emerald-500" />
            <span>Importar Excel</span>
          </button>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* CELDA */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Celda</label>
            <input
              type="text"
              id="header-celda"
              value={header.celda}
              onChange={(e) => handleChange('celda', e.target.value.toUpperCase())}
              placeholder="TD2-001"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 tracking-wider text-xs"
            />
          </div>

          {/* COORDENADAS INICIALES (FROM) - APILADAS */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Coordenadas Iniciales (From)</label>
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                placeholder="Este (X)"
                value={getInputValue('este_from', header.este_from)}
                id="header-este_from"
                onChange={(e) => handleCoordinateInputChange('este_from', e.target.value, 6, 2)}
                onBlur={(e) => handleCoordinateInputBlur('este_from', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-left font-normal"
              />
              <input
                type="text"
                placeholder="Norte (Y)"
                value={getInputValue('norte_from', header.norte_from)}
                id="header-norte_from"
                onChange={(e) => handleCoordinateInputChange('norte_from', e.target.value, 7, 2)}
                onBlur={(e) => handleCoordinateInputBlur('norte_from', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-left font-normal"
              />
              <input
                type="text"
                placeholder="Cota (Z)"
                value={getInputValue('cota_from', header.cota_from)}
                id="header-cota_from"
                onChange={(e) => handleCoordinateInputChange('cota_from', e.target.value, 4, 2)}
                onBlur={(e) => handleCoordinateInputBlur('cota_from', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-left font-normal"
              />
            </div>
          </div>

          {/* COORDENADAS FINALES (TO) - APILADAS */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Coordenadas Finales (To)</label>
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                placeholder="Este (X)"
                value={getInputValue('este_to', header.este_to)}
                id="header-este_to"
                onChange={(e) => handleCoordinateInputChange('este_to', e.target.value, 6, 2)}
                onBlur={(e) => handleCoordinateInputBlur('este_to', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-left font-normal"
              />
              <input
                type="text"
                placeholder="Norte (Y)"
                value={getInputValue('norte_to', header.norte_to)}
                id="header-norte_to"
                onChange={(e) => handleCoordinateInputChange('norte_to', e.target.value, 7, 2)}
                onBlur={(e) => handleCoordinateInputBlur('norte_to', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-left font-normal"
              />
              <input
                type="text"
                placeholder="Cota (Z)"
                value={getInputValue('cota_to', header.cota_to)}
                id="header-cota_to"
                onChange={(e) => handleCoordinateInputChange('cota_to', e.target.value, 4, 2)}
                onBlur={(e) => handleCoordinateInputBlur('cota_to', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-left font-normal"
              />
            </div>
          </div>

          {/* LARGO (M) AUTO */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between block">
              <span>Largo (m)</span>
              {calculatedLargo !== null && (
                <span className="text-[10px] bg-orange-500/10 border border-orange-500/30 text-orange-400 font-extrabold px-2 py-0.5 rounded cursor-help">
                  AUTO
                </span>
              )}
            </label>
            <input
              type="text"
              id="header-largo"
              value={header.largo || ''}
              readOnly={calculatedLargo !== null}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, '');
                handleChange('largo', cleaned === '' ? '' : parseInt(cleaned, 10));
              }}
              className={`w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-center ${calculatedLargo !== null ? 'text-orange-400 cursor-not-allowed bg-navy-950/50' : 'text-slate-100 bg-navy-900/40'}`}
              placeholder="m"
            />
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: DIMENSIONES Y ORIENTACIONES (Fila horizontal de 5 campos) */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-900/10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Altura (m)</label>
            <input
              type="number"
              step="0.1"
              value={header.altura}
              id="header-altura"
              onChange={(e) => handleChange('altura', parseFloat(e.target.value) || 0)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Dip Talud&deg;</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="90"
              placeholder="0-90"
              value={header.dip_talud !== undefined ? header.dip_talud : ''}
              onChange={(e) => handleDegreeChange('dip_talud', e.target.value, 90)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">DipDir Talud&deg;</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="359"
              placeholder="0-359"
              value={header.dipdir_talud !== undefined ? header.dipdir_talud : ''}
              onChange={(e) => handleDegreeChange('dipdir_talud', e.target.value, 360)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Dip Hw&deg;</label>
            <input
              type="number"
              step="0.01"
              min="-90"
              max="90"
              placeholder="0-90"
              value={header.dip_hw !== undefined ? header.dip_hw : ''}
              onChange={(e) => handleDegreeChange('dip_hw', e.target.value, 90)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Az Hw&deg;</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="359"
              placeholder="0-359"
              value={header.az_hw !== undefined ? header.az_hw : ''}
              onChange={(e) => handleDegreeChange('az_hw', e.target.value, 360)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-normal"
            />
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: LITOLOGÍAS DESPLEGABLES CON CASCADA Y METADATOS COMPLEMENTARIOS (En una sola fila de 9 columnas) */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-5 bg-navy-900/10">

        {/* Fila Horizontal Unificada de 9 campos */}
        <div className="grid grid-cols-3 md:grid-cols-9 gap-3 pb-3">
          {/* Lito 1 */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Lito 1</label>
            <select
              value={header.lito_1 || ''}
              onChange={(e) => handleLito1Change(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold cursor-pointer text-center"
            >
              <option value="">— Lito 1 —</option>
              {uniqueLito1.map(l => (
                <option key={l} value={l} className="bg-navy-900 text-slate-100 text-xs">{l}</option>
              ))}
            </select>
          </div>

          {/* Lito 2 */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Lito 2</label>
            <select
              value={header.lito_2 || '-1'}
              onChange={(e) => handleLito2Change(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold cursor-pointer text-center"
            >
              <option value="-1">— Lito 2 —</option>
              {filteredLito2Options.map(l => (
                <option key={l} value={l} className="bg-navy-900 text-slate-100 text-xs">{l}</option>
              ))}
            </select>
          </div>

          {/* Lito 3 */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Lito 3</label>
            <select
              value={header.lito_3 || '-1'}
              onChange={(e) => handleLito3Change(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1 text-orange-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold cursor-pointer text-center"
            >
              <option value="-1">— Lito 3 —</option>
              {filteredLito3Options.map(l => (
                <option key={l} value={l} className="bg-navy-900 text-slate-100 text-xs">{l}</option>
              ))}
            </select>
          </div>

          {/* Unidad Litológica al costado de las litos */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Unidad Litológica</label>
            <select
              value={header.unidad_litologica || ''}
              onChange={(e) => handleUnidadChange(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold cursor-pointer text-center"
            >
              <option value="">— Unidad —</option>
              {uniqueUnidades.map(u => (
                <option key={u} value={u} className="bg-navy-900 text-slate-100 text-xs">{u}</option>
              ))}
            </select>
          </div>

          {/* Sector */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Sector</label>
            <input
              type="text"
              value={header.sector || ''}
              onChange={(e) => handleChange('sector', e.target.value)}
              placeholder="Sector"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-normal"
            />
          </div>

          {/* Fase */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Fase</label>
            <input
              type="text"
              value={header.fase || ''}
              onChange={(e) => handleChange('fase', e.target.value)}
              placeholder="Fase"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-normal"
            />
          </div>

          {/* Nivel */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Nivel</label>
            <input
              type="text"
              value={header.nivel || ''}
              onChange={(e) => handleChange('nivel', handleNumberInputLimit(e.target.value, 4, 2))}
              placeholder="Nivel"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-normal"
              title="Nivel"
            />
          </div>

          {/* Fecha */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Fecha</label>
            <div className="relative">
              <Calendar size={12} className="absolute left-2.5 top-2.5 text-slate-500 pointer-events-none" />
              <input
                type="date"
                value={header.fecha || ''}
                onChange={(e) => handleChange('fecha', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-8 pr-1 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-normal"
              />
            </div>
          </div>

          {/* Mapeador */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Mapeador</label>
            <div className="relative">
              <User size={12} className="absolute left-2.5 top-2.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={header.mapeador || ''}
                onChange={(e) => handleChange('mapeador', e.target.value)}
                placeholder="Nombre"
                className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-8 pr-1 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-normal"
              />
            </div>
          </div>
        </div>

        {/* Metadatos Geotécnicos de Zona (3 columnas simétricas) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-navy-850 pt-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Sector Geotécnico</label>
            <input
              type="text"
              value={header.sect_geot || ''}
              onChange={(e) => handleChange('sect_geot', e.target.value)}
              placeholder="Sector Geot."
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Intemperismo / Meteorización</label>
            <select
              value={header.intemperia || ''}
              onChange={(e) => handleChange('intemperia', e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-normal cursor-pointer text-left"
            >
              <option value="" className="bg-navy-950 text-slate-500">— Seleccionar —</option>
              {Object.entries(ALTERACION_CATALOG).map(([key, item]) => {
                const parts = item.name.split(' — ');
                const desc = parts[1] || item.name;
                return (
                  <option key={key} value={key} className="bg-navy-950 text-slate-100 text-xs">
                    {key} ({desc})
                  </option>
                );
              })}
              {header.intemperia && !ALTERACION_CATALOG[header.intemperia] && (
                <option value={header.intemperia} className="bg-navy-950 text-amber-400 text-xs">
                  {header.intemperia} (Valor no normalizado)
                </option>
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Alt. de Zona</label>
            <input
              type="text"
              value={header.alt_zona || ''}
              onChange={(e) => handleChange('alt_zona', e.target.value)}
              placeholder="Alta / Media / Baja"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-normal"
            />
          </div>
        </div>
      </div>
    </div>
  );
}