import React from 'react';
import type { WindowHeader, CalculatorResult } from '../utils/rmrCalculator';
import { LITHOLOGY_CLASSIFICATION, ALTERACION_CATALOG } from '../utils/catalogData';
import { AlignLeft, FileSpreadsheet } from 'lucide-react';

interface VentanaFormProps {
  header: WindowHeader;
  onChange: (updatedHeader: WindowHeader) => void;
  calculated: CalculatorResult | null;
  onOpenImportModal: () => void;
}

const handleNumberInputLimit = (value: string, intDigits: number, decDigits: number): string => {
  const isNegative = value.startsWith('-');
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return (isNegative ? '-' : '') + cleaned.slice(0, -1);

  let integerPart = parts[0];
  let decimalPart = parts[1];

  if (integerPart.length > intDigits) {
    integerPart = integerPart.slice(0, intDigits);
  }
  if (decimalPart !== undefined && decimalPart.length > decDigits) {
    decimalPart = decimalPart.slice(0, decDigits);
  }

  const result = decimalPart !== undefined ? `${integerPart}.${decimalPart}` : integerPart;
  return (isNegative && (integerPart || decimalPart) ? '-' : (isNegative && value === '-' ? '-' : '')) + result;
};

// Sanitizador global de entrada decimal para unificar de coma a punto en tiempo real
const sanitizeDecimalInput = (val: string, intDigits: number, decDigits: number): string => {
  const sanitized = val.replace(',', '.');
  return handleNumberInputLimit(sanitized, intDigits, decDigits);
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
    const sanitized = val.replace(',', '.');
    const restricted = handleNumberInputLimit(sanitized, intDigits, decDigits);
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

  const uniqueLito1 = Array.from(new Set(LITHOLOGY_CLASSIFICATION.map(item => item.unidad))).sort();
  const uniqueUnidades = Array.from(new Set(LITHOLOGY_CLASSIFICATION.map(item => item.grupo))).sort();

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

  const handleSectGeotChange = (val: string) => {
    onChange({
      ...header,
      sect_geot: val,
      sector: val
    });
  };

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
      {/* TARJETA UNIFICADA PREMIUM CON BORDE IZQUIERDO VIOLETA DE NEÓN */}
      <div className="glass-panel p-6 rounded-2xl border border-navy-800 bg-navy-950/20 border-l-4 border-l-violet-500 shadow-xl relative overflow-hidden">

        {/* ENCABEZADO PRINCIPAL (CORREGIDO: Jerarquía unificada idéntica a "Comentarios y Fotos") */}
        <div className="flex items-center justify-between border-b border-navy-900 pb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg">
              <AlignLeft size={18} className="text-violet-400" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-100 uppercase tracking-widest">
                Datos de Registro
              </h4>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Identificación y geometría espacial de la celda de mapeo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenImportModal}
            className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.12)]"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            <span>Importar Excel</span>
          </button>
        </div>

        {/* ESTRUCTURA SPLIT GEOMECÁNICA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">

          {/* ========================================================
              COLUMNA IZQUIERDA: DEFINICIÓN ESPACIAL Y DE PLANOS (5 COLS)
              ======================================================== */}
          <div className="lg:col-span-5 space-y-5">

            {/* Celda & Largo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Celda</label>
                <input
                  type="text"
                  id="header-celda"
                  value={header.celda}
                  onChange={(e) => handleChange('celda', e.target.value.toUpperCase())}
                  placeholder="TD2-001"
                  className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 text-xs text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between block w-full">
                  <span>Largo (m)</span>
                  {calculatedLargo !== null && (
                    <span className="text-[10px] bg-orange-500/15 border border-orange-500/30 text-orange-400 font-bold px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(245,158,11,0.1)] select-none">
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
                  className={`w-full border rounded-lg px-3 py-1.5 text-xs font-bold text-center transition-all ${calculatedLargo !== null ? 'text-orange-400 border-orange-500/30 bg-orange-500/[0.03] cursor-not-allowed' : 'text-slate-100 border-navy-700/80 bg-navy-900/40'}`}
                  placeholder="m"
                />
              </div>
            </div>

            {/* COORDENADAS INICIALES (FROM) - VECTOR 3D CON PREFIJOS E, N, Z */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Coordenadas Iniciales (From)</label>
              <div className="flex items-center w-full bg-navy-900/40 border border-navy-700/80 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-violet-500/50 focus-within:border-violet-500 transition-all">
                <div className="px-2.5 py-1.5 bg-navy-950/60 text-slate-400 font-extrabold border-r border-navy-700/80 text-xs select-none uppercase tracking-wider shrink-0">
                  From
                </div>
                <div className="flex-1 flex items-center h-full">
                  <span className="pl-2.5 text-xs font-bold text-slate-500 select-none">E</span>
                  <input
                    type="text"
                    placeholder="Este (X)"
                    value={getInputValue('este_from', header.este_from)}
                    id="header-este_from"
                    onChange={(e) => handleCoordinateInputChange('este_from', e.target.value, 6, 4)}
                    onBlur={(e) => handleCoordinateInputBlur('este_from', e.target.value)}
                    className="w-full bg-transparent text-slate-100 text-xs font-normal focus:outline-none font-mono text-center py-1.5"
                  />
                  <div className="w-[1px] h-5 bg-navy-700/80 shrink-0" />
                  <span className="pl-2 text-xs font-bold text-slate-500 select-none">N</span>
                  <input
                    type="text"
                    placeholder="Norte (Y)"
                    value={getInputValue('norte_from', header.norte_from)}
                    id="header-norte_from"
                    onChange={(e) => handleCoordinateInputChange('norte_from', e.target.value, 7, 3)}
                    onBlur={(e) => handleCoordinateInputBlur('norte_from', e.target.value)}
                    className="w-full bg-navy-900/10 text-slate-100 text-xs font-normal focus:outline-none font-mono text-center py-1.5"
                  />
                  <div className="w-[1px] h-5 bg-navy-700/80 shrink-0" />
                  <span className="pl-2 text-xs font-bold text-slate-500 select-none">Z</span>
                  <input
                    type="text"
                    placeholder="Cota (Z)"
                    value={getInputValue('cota_from', header.cota_from)}
                    id="header-cota_from"
                    onChange={(e) => handleCoordinateInputChange('cota_from', e.target.value, 4, 2)}
                    onBlur={(e) => handleCoordinateInputBlur('cota_from', e.target.value)}
                    className="w-full bg-transparent text-slate-100 text-xs font-normal focus:outline-none font-mono text-center py-1.5"
                  />
                </div>
              </div>
            </div>

            {/* COORDENADAS FINALES (TO) - VECTOR 3D CON PREFIJOS E, N, Z */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Coordenadas Finales (To)</label>
              <div className="flex items-center w-full bg-navy-900/40 border border-navy-700/80 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-violet-500/50 focus-within:border-violet-500 transition-all">
                <div className="px-2.5 py-1.5 bg-navy-950/60 text-slate-400 font-extrabold border-r border-navy-700/80 text-xs select-none uppercase tracking-wider shrink-0">
                  To
                </div>
                <div className="flex-1 flex items-center h-full">
                  <span className="pl-2.5 text-xs font-bold text-slate-500 select-none">E</span>
                  <input
                    type="text"
                    placeholder="Este (X)"
                    value={getInputValue('este_to', header.este_to)}
                    id="header-este_to"
                    onChange={(e) => handleCoordinateInputChange('este_to', e.target.value, 6, 4)}
                    onBlur={(e) => handleCoordinateInputBlur('este_to', e.target.value)}
                    className="w-full bg-transparent text-slate-100 text-xs font-normal focus:outline-none font-mono text-center py-1.5"
                  />
                  <div className="w-[1px] h-5 bg-navy-700/80 shrink-0" />
                  <span className="pl-2 text-xs font-bold text-slate-500 select-none">N</span>
                  <input
                    type="text"
                    placeholder="Norte (Y)"
                    value={getInputValue('norte_to', header.norte_to)}
                    id="header-norte_to"
                    onChange={(e) => handleCoordinateInputChange('norte_to', e.target.value, 7, 3)}
                    onBlur={(e) => handleCoordinateInputBlur('norte_to', e.target.value)}
                    className="w-full bg-navy-900/10 text-slate-100 text-xs font-normal focus:outline-none font-mono text-center py-1.5"
                  />
                  <div className="w-[1px] h-5 bg-navy-700/80 shrink-0" />
                  <span className="pl-2 text-xs font-bold text-slate-500 select-none">Z</span>
                  <input
                    type="text"
                    placeholder="Cota (Z)"
                    value={getInputValue('cota_to', header.cota_to)}
                    id="header-cota_to"
                    onChange={(e) => handleCoordinateInputChange('cota_to', e.target.value, 4, 2)}
                    onBlur={(e) => handleCoordinateInputBlur('cota_to', e.target.value)}
                    className="w-full bg-transparent text-slate-100 text-xs font-normal focus:outline-none font-mono text-center py-1.5"
                  />
                </div>
              </div>
            </div>

            {/* Geometría y Orientación de Talud (Estandarizado a inputs de texto con formateo a punto ".") */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Altura (m)</label>
                <input
                  type="text"
                  value={getInputValue('altura', header.altura)}
                  onChange={(e) => {
                    const limited = sanitizeDecimalInput(e.target.value, 3, 1);
                    handleChange('altura', limited);
                  }}
                  onBlur={(e) => {
                    const num = parseFloat(e.target.value);
                    handleChange('altura', isNaN(num) ? 0 : num);
                  }}
                  className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Dip Talud°</label>
                <input
                  type="text"
                  placeholder="-90 a 90"
                  value={getInputValue('dip_talud', header.dip_talud)}
                  onChange={(e) => {
                    const limited = sanitizeDecimalInput(e.target.value, 2, 2);
                    handleChange('dip_talud', limited);
                  }}
                  onBlur={(e) => {
                    const num = parseFloat(e.target.value);
                    handleChange('dip_talud', isNaN(num) ? 0 : Math.min(90, Math.max(-90, num)));
                  }}
                  className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">DipDir Talud°</label>
                <input
                  type="text"
                  placeholder="0-359"
                  value={getInputValue('dipdir_talud', header.dipdir_talud)}
                  onChange={(e) => {
                    const limited = sanitizeDecimalInput(e.target.value, 3, 2);
                    handleChange('dipdir_talud', limited);
                  }}
                  onBlur={(e) => {
                    const num = parseFloat(e.target.value);
                    handleChange('dipdir_talud', isNaN(num) ? 0 : Math.min(359.99, Math.max(0, num)));
                  }}
                  className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Dip Hw°</label>
                <input
                  type="text"
                  placeholder="-90-90"
                  value={getInputValue('dip_hw', header.dip_hw)}
                  onChange={(e) => {
                    const limited = sanitizeDecimalInput(e.target.value, 3, 2);
                    handleChange('dip_hw', limited);
                  }}
                  onBlur={(e) => {
                    const num = parseFloat(e.target.value);
                    handleChange('dip_hw', isNaN(num) ? 0 : Math.min(90, Math.max(-90, num)));
                  }}
                  className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Az Hw°</label>
                <input
                  type="text"
                  placeholder="0-359"
                  value={getInputValue('az_hw', header.az_hw)}
                  onChange={(e) => {
                    const limited = sanitizeDecimalInput(e.target.value, 3, 2);
                    handleChange('az_hw', limited);
                  }}
                  onBlur={(e) => {
                    const num = parseFloat(e.target.value);
                    handleChange('az_hw', isNaN(num) ? 0 : Math.min(359.99, Math.max(0, num)));
                  }}
                  className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-center"
                />
              </div>
            </div>

          </div>

          {/* ========================================================
              COLUMNA DERECHA: LITOLOGÍA, METADATOS Y ZONIFICACIÓN (7 COLS)
              Con divisor vertical sutil e indentación horizontal
              ======================================================== */}
          <div className="lg:col-span-7 space-y-5 lg:border-l lg:border-navy-900 lg:pl-6">

            {/* Bloque Litológico */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Lito 1</label>
                <select
                  value={header.lito_1 || ''}
                  onChange={(e) => handleLito1Change(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700/85 rounded-lg px-2 py-1.5 text-slate-100 text-xs font-normal cursor-pointer text-center"
                >
                  <option value="">— Lito 1 —</option>
                  {uniqueLito1.map(l => (
                    <option key={l} value={l} className="bg-navy-900 text-slate-100 text-xs">{l}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Lito 2</label>
                <select
                  value={header.lito_2 || '-1'}
                  onChange={(e) => handleLito2Change(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700/85 rounded-lg px-2 py-1.5 text-xs font-normal cursor-pointer text-center"
                >
                  <option value="-1">— Lito 2 —</option>
                  {filteredLito2Options.map(l => (
                    <option key={l} value={l} className="bg-navy-900 text-slate-100 text-xs">{l}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Lito 3</label>
                <select
                  value={header.lito_3 || '-1'}
                  onChange={(e) => handleLito3Change(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700/85 rounded-lg px-2 py-1.5 text-orange-400 text-xs font-normal cursor-pointer text-center shadow-[0_0_10px_rgba(245,158,11,0.05)]"
                >
                  <option value="-1">— Lito 3 —</option>
                  {filteredLito3Options.map(l => (
                    <option key={l} value={l} className="bg-navy-900 text-slate-100 text-xs">{l}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Unidad Lito</label>
                <select
                  value={header.unidad_litologica || ''}
                  onChange={(e) => handleUnidadChange(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700/85 rounded-lg px-2 py-1.5 text-slate-100 text-xs font-normal cursor-pointer text-center"
                >
                  <option value="">— Unidad —</option>
                  {uniqueUnidades.map(u => (
                    <option key={u} value={u} className="bg-navy-900 text-slate-100 text-xs">{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Divisor de Sección: Zonificación */}
            <div className="border-t border-navy-900/60 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Sector Geotécnico</label>
                  <input
                    type="text"
                    value={header.sect_geot || ''}
                    onChange={(e) => handleSectGeotChange(e.target.value)}
                    placeholder="Sector Geot."
                    className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-200 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Intemperismo / Meteorización</label>
                  <select
                    value={header.intemperia || ''}
                    onChange={(e) => handleChange('intemperia', e.target.value)}
                    className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-200 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer"
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
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Alt. de Zona</label>
                  <input
                    type="text"
                    value={header.alt_zona || ''}
                    onChange={(e) => handleChange('alt_zona', e.target.value)}
                    placeholder="Alta / Media / Baja"
                    className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-3 py-1.5 text-slate-200 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Divisor de Sección: Metadatos y Control de Campaña */}
            <div className="border-t border-navy-900/60 pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Fase</label>
                  <input
                    type="text"
                    value={header.fase || ''}
                    onChange={(e) => handleChange('fase', e.target.value)}
                    placeholder="Fase"
                    className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-2 py-1.5 text-slate-200 text-xs text-center font-normal"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Nivel</label>
                  <input
                    type="text"
                    value={header.nivel || ''}
                    onChange={(e) => handleChange('nivel', handleNumberInputLimit(e.target.value, 4, 2))}
                    placeholder="Nivel"
                    className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-2 py-1.5 text-slate-200 text-xs text-center font-normal"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Fecha</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={header.fecha || ''}
                      onChange={(e) => handleChange('fecha', e.target.value)}
                      className="w-full bg-navy-900/40 border border-navy-700/85 rounded-lg px-2 py-1.5 text-slate-200 text-xs text-center font-normal cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Mapeador</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={header.mapeador || ''}
                      onChange={(e) => handleChange('mapeador', e.target.value)}
                      placeholder="Mapeador"
                      className="w-full bg-navy-900/40 border border-navy-700/80 rounded-lg px-2 py-1.5 text-slate-200 text-xs text-center font-normal"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}