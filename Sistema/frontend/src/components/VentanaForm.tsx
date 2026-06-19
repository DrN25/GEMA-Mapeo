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

// Función helper para limitar estrictamente la edición de enteros y decimales en inputs de texto
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

  // Estado local para conservar la edición en texto de coordenadas y evitar deformar los puntos decimales mientras se tipea
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

  // Litologías
  const uniqueUnidades = Array.from(new Set(LITHOLOGY_CLASSIFICATION.map(item => item.unidad))).sort();
  const filteredClassifications = header.unidad_litologica
    ? LITHOLOGY_CLASSIFICATION.filter(item => item.unidad === header.unidad_litologica)
    : LITHOLOGY_CLASSIFICATION;

  const currentCombinedValue = header.lito_2 && header.unidad_litologica && header.lito_1
    ? `${header.lito_2}|${header.unidad_litologica}|${header.lito_1}`
    : '';

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
    onChange({
      ...header,
      unidad_litologica: unidad,
      lito_1: '',
      lito_2: '',
      lito_3: ''
    });
  };

  const handleCombinedClassificationChange = (combinedValue: string) => {
    if (!combinedValue) {
      onChange({
        ...header,
        unidad_litologica: '',
        lito_1: '',
        lito_2: '',
        lito_3: ''
      });
      return;
    }

    const [codigo, unidad, litologia] = combinedValue.split('|');
    const match = LITHOLOGY_CLASSIFICATION.find(
      item => item.codigo === codigo && item.unidad === unidad && item.litologia === litologia
    );

    if (match) {
      onChange({
        ...header,
        unidad_litologica: match.unidad,
        lito_1: match.litologia,
        lito_2: match.codigo,
        lito_3: match.grupo
      });
    }
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
          >
            <FileSpreadsheet size={14} className="text-blue-500" />
            <span>Importar Excel</span>
          </button>
        </h3>

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
                type="text"
                placeholder="Este"
                value={getInputValue('este_from', header.este_from)}
                id="header-este_from"
                onChange={(e) => handleCoordinateInputChange('este_from', e.target.value, 6, 2)}
                onBlur={(e) => handleCoordinateInputBlur('este_from', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
                title="Este FROM (Máx. 6 enteros, 2 dec.)"
              />
              <input
                type="text"
                placeholder="Norte"
                value={getInputValue('norte_from', header.norte_from)}
                id="header-norte_from"
                onChange={(e) => handleCoordinateInputChange('norte_from', e.target.value, 7, 2)}
                onBlur={(e) => handleCoordinateInputBlur('norte_from', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
                title="Norte FROM (Máx. 7 enteros, 2 dec.)"
              />
              <input
                type="text"
                placeholder="Cota"
                value={getInputValue('cota_from', header.cota_from)}
                id="header-cota_from"
                onChange={(e) => handleCoordinateInputChange('cota_from', e.target.value, 4, 2)}
                onBlur={(e) => handleCoordinateInputBlur('cota_from', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
                title="Cota FROM (Máx. 4 enteros, 2 dec.)"
              />
            </div>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Coordenadas FINALES (To)</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Este"
                value={getInputValue('este_to', header.este_to)}
                id="header-este_to"
                onChange={(e) => handleCoordinateInputChange('este_to', e.target.value, 6, 2)}
                onBlur={(e) => handleCoordinateInputBlur('este_to', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
                title="Este TO (Máx. 6 enteros, 2 dec.)"
              />
              <input
                type="text"
                placeholder="Norte"
                value={getInputValue('norte_to', header.norte_to)}
                id="header-norte_to"
                onChange={(e) => handleCoordinateInputChange('norte_to', e.target.value, 7, 2)}
                onBlur={(e) => handleCoordinateInputBlur('norte_to', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
                title="Norte TO (Máx. 7 enteros, 2 dec.)"
              />
              <input
                type="text"
                placeholder="Cota"
                value={getInputValue('cota_to', header.cota_to)}
                id="header-cota_to"
                onChange={(e) => handleCoordinateInputChange('cota_to', e.target.value, 4, 2)}
                onBlur={(e) => handleCoordinateInputBlur('cota_to', e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
                title="Cota TO (Máx. 4 enteros, 2 dec.)"
              />
            </div>
          </div>

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
              onBlur={(e) => {
                const val = e.target.value;
                if (val !== '') {
                  handleChange('largo', Math.round(parseFloat(val)));
                }
              }}
              className={`w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-center ${calculatedLargo !== null ? 'text-orange-400 cursor-not-allowed bg-navy-950/50' : 'text-slate-100 bg-navy-900/40'}`}
              placeholder="m (Entero)"
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
              step="0.01"
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
              step="0.01"
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
              step="0.01"
              min="-90"
              max="90"
              placeholder="-90 a 90"
              value={header.dip_hw !== undefined ? header.dip_hw : ''}
              onChange={(e) => handleDegreeChange('dip_hw', e.target.value, 90)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center font-normal"
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
              <option value="">— Seleccione Unidad —</option>
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
              readOnly
              value={header.lito_1 || ''}
              placeholder="Automático"
              className="w-full bg-navy-950/50 border border-navy-800 text-slate-400 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none cursor-not-allowed font-semibold text-center"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Código (Lito-3)</label>
            <select
              value={currentCombinedValue}
              onChange={(e) => handleCombinedClassificationChange(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-orange-400 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold cursor-pointer"
            >
              <option value="">— Seleccione Código —</option>
              {filteredClassifications.map(item => {
                const isGeneric = item.codigo === 'Varios' || item.codigo === '-';
                const label = isGeneric
                  ? `${item.codigo} - ${item.unidad} (${item.litologia})`
                  : `${item.codigo} - ${item.unidad}`;
                const combinedKey = `${item.codigo}|${item.unidad}|${item.litologia}`;

                return (
                  <option key={combinedKey} value={combinedKey} className="bg-navy-900 text-slate-100 text-xs font-normal">
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Grupo</label>
            <input
              type="text"
              readOnly
              value={header.lito_3 || ''}
              placeholder="Automático"
              className="w-full bg-navy-950/50 border border-navy-800 text-slate-400 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none cursor-not-allowed font-semibold text-center"
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
              onChange={(e) => handleChange('nivel', handleNumberInputLimit(e.target.value, 4, 2))}
              placeholder="Nivel"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
              title="Nivel (Máx. 4 enteros, 2 dec.)"
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