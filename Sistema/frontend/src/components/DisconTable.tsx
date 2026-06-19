import React from 'react';
import type { JointRow } from '../utils/rmrCalculator';
import {
  STRUCTURE_CATALOG,
  RELLENO_CATALOG,
  ALTERACION_CATALOG,
  FORMA_CATALOG,
  RUGOSIDAD_CATALOG
} from '../utils/catalogData';
import {
  getContinuidadRating,
  getAberturaRating,
  getFillingRatingSingle
} from '../utils/rmrCalculator';
import { ShieldAlert, Plus, Trash2 } from 'lucide-react';

interface DisconTableProps {
  joints: JointRow[];
  onChange: (updatedJoints: JointRow[]) => void;
  selectedRowIndex: number | null;
  onSelectRow: (index: number | null) => void;
  largoMax: number;
  onDeleteFamily: (famId: number) => void;
}

const getAberturaClase = (val: number | undefined | null): string => {
  if (val === undefined || val === null || val === -1) return '';
  if (val <= 0) return 'Ninguna';
  if (val < 0.1) return 'Muy cerrada';
  if (val <= 1.0) return 'Cerrada';
  if (val <= 5.0) return 'Mod. abierta';
  return 'Abierta';
};

const limitDecimalPlaces = (val: string, maxDecimals: number): string => {
  const parts = val.split('.');
  if (parts.length > 1 && parts[1].length > maxDecimals) {
    return `${parts[0]}.${parts[1].slice(0, maxDecimals)}`;
  }
  return val;
};

export default function DisconTable({
  joints,
  onChange,
  selectedRowIndex,
  onSelectRow,
  largoMax,
  onDeleteFamily
}: DisconTableProps) {

  const [localValues, setLocalValues] = React.useState<Record<string, string>>({});
  const [familyToDelete, setFamilyToDelete] = React.useState<number>(1);
  const [focusedField, setFocusedField] = React.useState<string | null>(null);

  const activeFamilies = React.useMemo(() => {
    return Array.from(new Set(joints.map(j => j.familia))).sort((a, b) => a - b);
  }, [joints]);

  React.useEffect(() => {
    const maxEligible = activeFamilies.filter(f => f > 3);
    if (maxEligible.length > 0) {
      setFamilyToDelete(maxEligible[maxEligible.length - 1]);
    } else {
      setFamilyToDelete(1);
    }
  }, [activeFamilies]);

  const getFamilyBadgeStyle = (fam: number) => {
    const styles: Record<number, string> = {
      1: 'text-orange-400 bg-orange-500/10 border border-orange-500/20',
      2: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
      3: 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20',
      4: 'text-pink-400 bg-pink-500/10 border border-pink-500/20',
      5: 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20',
      6: 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
      7: 'text-red-400 bg-red-500/10 border border-red-500/20',
      8: 'text-violet-400 bg-violet-500/10 border border-violet-500/20',
      9: 'text-teal-400 bg-teal-500/10 border border-teal-500/20'
    };
    return styles[fam] || 'text-slate-400 bg-slate-500/10 border border-slate-500/20';
  };

  const limitPrecision = (val: number, decimals = 6): number => {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  };

  const handleRowChange = (index: number, field: keyof JointRow, val: any) => {
    const updated = [...joints];
    let cleanedVal = val;

    if (typeof val === 'number' && val !== -1) {
      cleanedVal = limitPrecision(val, 6);
    }

    updated[index] = {
      ...updated[index],
      [field]: cleanedVal
    };
    onChange(updated);
  };

  const getInputValue = (index: number, field: keyof JointRow, stateVal: any): string => {
    const key = `${index}-${String(field)}`;
    if (localValues[key] !== undefined) return localValues[key];
    if (stateVal === undefined || stateVal === null || stateVal === -1) return '';
    return String(stateVal);
  };

  const handleInputChange = (index: number, field: keyof JointRow, val: string) => {
    const key = `${index}-${String(field)}`;
    setLocalValues(prev => ({ ...prev, [key]: val }));

    const num = parseFloat(val);
    if (!isNaN(num) && val !== '' && !val.endsWith('.') && val !== '-') {
      handleRowChange(index, field, num);
    } else if (val === '') {
      handleRowChange(index, field, -1);
    }
  };

  const handleInputBlur = (index: number, field: keyof JointRow, val: string, maxVal: number) => {
    const key = `${index}-${String(field)}`;
    setLocalValues(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    if (val === '' || val === undefined) {
      handleRowChange(index, field, -1);
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num) || num === -1) {
      handleRowChange(index, field, -1);
      return;
    }

    let min = 0;
    let max = maxVal;
    if (field === 'dip') { min = 0; max = 90; }
    else if (field === 'dip_dir') { min = 0; max = 359; }
    else if (field === 'jrc') { min = 0; max = 20; }
    else if (field === 'rugosidad') { min = 0; max = 9; }

    const clamped = Math.min(max, Math.max(min, num));
    handleRowChange(index, field, clamped);
  };

  const createFamily = () => {
    const nextFam = Math.max(0, ...joints.map(j => j.familia)) + 1;
    const newRows: JointRow[] = [
      {
        id: joints.length + 1,
        familia: nextFam,
        distancia: -1,
        tipo_estructura: 'JN',
        dip: -1,
        dip_dir: -1,
        n_estructuras: -1,
        abertura: -1,
        espesor: -1,
        continuidad: -1,
        espaciamiento: -1,
        extremos_visibles: -1,
        terminacion: -1,
        relleno1: 'cwf',
        relleno2: undefined,
        jrc: -1,
        rugosidad: -1,
        forma: 'O',
        alteracion: 'd'
      },
      {
        id: joints.length + 2,
        familia: nextFam,
        distancia: -1,
        tipo_estructura: 'JN',
        dip: -1,
        dip_dir: -1,
        n_estructuras: -1,
        abertura: -1,
        espesor: -1,
        continuidad: -1,
        espaciamiento: -1,
        extremos_visibles: -1,
        terminacion: -1,
        relleno1: 'cwf',
        relleno2: undefined,
        jrc: -1,
        rugosidad: -1,
        forma: 'O',
        alteracion: 'd'
      },
      {
        id: joints.length + 3,
        familia: nextFam,
        distancia: -1,
        tipo_estructura: 'JN',
        dip: -1,
        dip_dir: -1,
        n_estructuras: -1,
        abertura: -1,
        espesor: -1,
        continuidad: -1,
        espaciamiento: -1,
        extremos_visibles: -1,
        terminacion: -1,
        relleno1: 'cwf',
        relleno2: undefined,
        jrc: -1,
        rugosidad: -1,
        forma: 'O',
        alteracion: 'd'
      }
    ];
    onChange([...joints, ...newRows]);
    onSelectRow(joints.length);
  };

  const clearRow = (index: number) => {
    const updated = [...joints];
    updated[index] = {
      ...updated[index],
      distancia: -1,
      tipo_estructura: 'JN',
      dip: -1,
      dip_dir: -1,
      n_estructuras: -1,
      abertura: -1,
      espesor: -1,
      continuidad: -1,
      espaciamiento: -1,
      extremos_visibles: -1,
      terminacion: -1,
      relleno1: 'cwf',
      relleno2: undefined,
      jrc: -1,
      rugosidad: -1,
      forma: 'O',
      alteracion: 'd'
    };
    onChange(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, colName: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index < joints.length - 1) {
        const nextEl = document.getElementById(`joint-${colName}-${index + 1}`);
        if (nextEl) nextEl.focus();
      }
    }
  };

  return (
    <div className="glass-panel p-6 rounded-xl border border-navy-800 space-y-4 select-none">
      <div className="flex justify-between items-center border-b border-navy-800 pb-3">
        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
          <ShieldAlert size={16} className="text-orange-500" />
          <span>Registro de Discontinuidades</span>
        </h3>
      </div>

      <div className="overflow-x-auto relative rounded-lg border border-navy-900 bg-navy-950/20">
        <table className="w-full text-left text-sm border-collapse border-separate border-spacing-0" style={{ minWidth: '2400px' }}>
          <thead>
            <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs">
              <th rowSpan={2} className="py-3 px-2 text-center sticky left-0 bg-navy-950 z-20 border-r border-navy-900 w-[52px] min-w-[52px]">Fam</th>
              <th rowSpan={2} className="py-3 px-2 text-center sticky left-[52px] bg-navy-950 z-20 border-r border-navy-900 w-[85px] min-w-[85px]">Dist (m)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-20">Dip (&deg;)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">DipDir (&deg;)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">Tipo</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-20">Cant (n)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-36">Abert (mm)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">Espes (mm)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">Cont (m)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">Espac (m)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">Ext Vis</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-20">Term</th>
              <th rowSpan={2} className="py-3 px-2 w-32 text-center">Relleno 1</th>
              <th rowSpan={2} className="py-3 px-2 w-32 text-center">Relleno 2</th>
              <th colSpan={2} className="py-2 px-2 text-center border-l border-navy-900 text-pink-400 bg-pink-950/10 text-xs">Valor Relleno (R89)</th>
              <th colSpan={2} className="py-2 px-2 text-center border-l border-navy-900 text-amber-400 bg-amber-950/10 text-xs">Valor Relleno (R76)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-20">JRC</th>
              <th rowSpan={2} className="py-3 px-2 w-36 text-center">Rugosidad</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-20">Forma</th>
              <th rowSpan={2} className="py-3 px-2 w-32 text-center">Alteración</th>
              <th colSpan={6} className="py-2 px-2 text-center bg-pink-900/10 border-l border-navy-900 text-pink-400 text-xs">Condición Discontinuidades (RMR'89)</th>
              <th colSpan={6} className="py-2 px-2 text-center bg-amber-900/10 border-l border-navy-900 text-amber-400 text-xs">Condición Discontinuidades (RMR'76)</th>
              <th rowSpan={2} className="py-3 px-2 text-center sticky right-0 bg-navy-950 z-20 border-l border-navy-900 w-[60px] min-w-[60px]">Acción</th>
            </tr>
            <tr className="bg-navy-950 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-navy-900">
              <th className="py-1 px-2 text-center border-l border-navy-900 text-pink-400/80 bg-pink-950/5">V. R1</th>
              <th className="py-1 px-2 text-center text-pink-400/80 bg-pink-950/5">V. R2</th>
              <th className="py-1 px-2 text-center border-l border-navy-900 text-amber-400/80 bg-amber-950/5">V. R1</th>
              <th className="py-1 px-2 text-center text-amber-400/80 bg-amber-950/5">V. R2</th>
              <th className="py-1 px-2 text-center bg-pink-900/5 border-l border-navy-900 text-pink-400/80">Alt</th>
              <th className="py-1 px-2 text-center bg-pink-900/5 text-pink-400/80">Rel</th>
              <th className="py-1 px-2 text-center bg-pink-900/5 text-pink-400/80">Cont</th>
              <th className="py-1 px-2 text-center bg-pink-900/5 text-pink-400/80">Aber</th>
              <th className="py-1 px-2 text-center bg-pink-900/5 text-pink-400/80">Rug</th>
              <th className="py-1 px-2 text-center bg-pink-950/20 text-pink-300 font-black">Val</th>
              <th className="py-1 px-2 text-center bg-amber-900/5 border-l border-navy-900 text-amber-400/80">Alt</th>
              <th className="py-1 px-2 text-center bg-amber-900/5 text-amber-400/80">Rel</th>
              <th className="py-1 px-2 text-center bg-amber-900/5 text-amber-400/80">Cont</th>
              <th className="py-1 px-2 text-center bg-amber-900/5 text-amber-400/80">Aber</th>
              <th className="py-1 px-2 text-center bg-amber-900/5 text-amber-400/80">Rug</th>
              <th className="py-1 px-2 text-center bg-amber-950/20 text-amber-300 font-black">Val</th>
            </tr>
          </thead>
          <tbody>
            {joints.map((j, idx) => {
              const isSelected = selectedRowIndex === idx;

              const altItem = j.alteracion && j.alteracion !== '-1' ? ALTERACION_CATALOG[j.alteracion] : null;
              const altR89 = altItem ? altItem.r89 : null;
              const altR76 = altItem ? altItem.r76 : null;

              const rel1_ratings = j.relleno1 && j.relleno1 !== '-1' ? getFillingRatingSingle(j.relleno1, j.espesor) : null;
              const rel2_ratings = j.relleno2 && j.relleno2 !== '-1' ? getFillingRatingSingle(j.relleno2, j.espesor) : null;

              const r1_89 = rel1_ratings ? rel1_ratings.r89 : null;
              const r2_89 = rel2_ratings ? rel2_ratings.r89 : null;
              const r1_76 = rel1_ratings ? rel1_ratings.r76 : null;
              const r2_76 = rel2_ratings ? rel2_ratings.r76 : null;

              let relR89 = null;
              let relR76 = null;
              if (r1_89 !== null && r2_89 !== null) {
                relR89 = Math.min(r1_89, r2_89);
                relR76 = Math.min(r1_76!, r2_76!);
              } else if (r1_89 !== null) {
                relR89 = r1_89;
                relR76 = r1_76;
              } else if (r2_89 !== null) {
                relR89 = r2_89;
                relR76 = r2_76;
              }

              const contRatings = j.continuidad !== undefined && j.continuidad !== -1 ? getContinuidadRating(j.continuidad) : null;
              const contR89 = contRatings ? contRatings.r89 : null;
              const contR76 = contRatings ? contRatings.r76 : null;

              const abRatings = j.abertura !== undefined && j.abertura !== -1 ? getAberturaRating(j.abertura) : null;
              const abR89 = abRatings ? abRatings.r89 : null;
              const abR76 = abRatings ? abRatings.r76 : null;

              const rugItem = j.rugosidad !== undefined && j.rugosidad !== -1 ? (RUGOSIDAD_CATALOG[j.rugosidad] || { r76: 0, r89: 0 }) : null;
              const rugR89 = rugItem ? rugItem.r89 : null;
              const rugR76 = rugItem ? rugItem.r76 : null;

              const hasAll89 = altR89 !== null && relR89 !== null && contR89 !== null && abR89 !== null && rugR89 !== null;
              const hasAll76 = altR76 !== null && relR76 !== null && contR76 !== null && abR76 !== null && rugR76 !== null;
              const totalR89 = hasAll89 ? Math.min(30, altR89! + relR89! + contR89! + abR89! + rugR89!) : null;
              const totalR76 = hasAll76 ? Math.min(25, altR76! + relR76! + contR76! + abR76! + rugR76!) : null;

              const famColors = [
                'bg-slate-900/20', 'bg-orange-950/5', 'bg-emerald-950/5',
                'bg-purple-950/5', 'bg-pink-950/5', 'bg-blue-950/5',
                'bg-red-950/5', 'bg-slate-900/10', 'bg-amber-950/5'
              ];
              const rowBg = famColors[(j.familia - 1) % famColors.length] || 'bg-slate-900/10';

              const fmtRating = (v: number | null) => v !== null ? String(v) : '—';

              return (
                <tr
                  key={idx}
                  onClick={() => onSelectRow(idx)}
                  className={`hover:bg-navy-900/20 border-b border-navy-900/60 transition-colors ${rowBg} ${isSelected ? 'bg-orange-500/10 hover:bg-orange-500/15' : ''}`}
                >
                  <td className="py-2 px-1 text-center sticky left-0 z-10 border-r border-navy-900 bg-navy-950 font-normal">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${getFamilyBadgeStyle(j.familia)}`}>
                      F{j.familia}
                    </span>
                  </td>

                  {/* Dist (m) - Limitado estrictamente a solo enteros positivos desde 0 */}
                  <td className="py-2 px-1 text-center sticky left-[52px] z-10 border-r border-navy-900 bg-navy-950">
                    <input
                      type="number"
                      id={`joint-distancia-${idx}`}
                      value={getInputValue(idx, 'distancia', j.distancia)}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        handleInputChange(idx, 'distancia', digits);
                      }}
                      onBlur={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        if (digits === '') {
                          handleRowChange(idx, 'distancia', -1);
                        } else {
                          const num = parseInt(digits, 10);
                          const clamped = Math.min(Math.round(largoMax), Math.max(0, num));
                          handleRowChange(idx, 'distancia', clamped);
                        }
                      }}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'distancia')}
                      className="w-full bg-transparent text-slate-100 text-center font-normal focus:outline-none text-xs"
                    />
                  </td>

                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      step="0.01"
                      id={`joint-dip-${idx}`}
                      value={getInputValue(idx, 'dip', j.dip)}
                      onChange={(e) => handleInputChange(idx, 'dip', e.target.value)}
                      onBlur={(e) => handleInputBlur(idx, 'dip', e.target.value, 90)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'dip')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none font-normal text-xs"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      step="0.01"
                      id={`joint-dip_dir-${idx}`}
                      value={getInputValue(idx, 'dip_dir', j.dip_dir)}
                      onChange={(e) => handleInputChange(idx, 'dip_dir', e.target.value)}
                      onBlur={(e) => handleInputBlur(idx, 'dip_dir', e.target.value, 359)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'dip_dir')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none font-normal text-xs"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <select
                      value={j.tipo_estructura}
                      onChange={(e) => handleRowChange(idx, 'tipo_estructura', e.target.value)}
                      className="w-full bg-transparent text-slate-200 font-normal focus:outline-none text-center cursor-pointer text-xs"
                    >
                      <option value="-1" className="bg-navy-950 text-slate-500">-</option>
                      {Object.keys(STRUCTURE_CATALOG).map(code => (
                        <option key={code} value={code} className="bg-navy-950 text-slate-200">
                          {code}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Cant (n) - Solo enteros positivos, admite -1 representado como vacío */}
                  <td className="py-2 px-1 text-center">
                    <input
                      type="text"
                      id={`joint-n_estructuras-${idx}`}
                      value={getInputValue(idx, 'n_estructuras', j.n_estructuras)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '-1') {
                          handleInputChange(idx, 'n_estructuras', '-1');
                        } else {
                          const digits = val.replace(/\D/g, '');
                          handleInputChange(idx, 'n_estructuras', digits);
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const num = parseInt(val, 10);
                        if (val === '' || isNaN(num) || num <= 0) {
                          if (num === -1) {
                            handleRowChange(idx, 'n_estructuras', -1);
                          } else {
                            handleRowChange(idx, 'n_estructuras', -1);
                          }
                        } else {
                          handleRowChange(idx, 'n_estructuras', num);
                        }
                      }}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'n_estructuras')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none text-xs font-semibold"
                    />
                  </td>

                  {/* Abert (mm) - Muestra "nn.d (Clase)" al no tener foco, limita a 1 decimal */}
                  <td className="py-2 px-1 text-center">
                    <input
                      type="text"
                      id={`joint-abertura-${idx}`}
                      value={
                        focusedField === `${idx}-abertura`
                          ? getInputValue(idx, 'abertura', j.abertura)
                          : (j.abertura !== undefined && j.abertura !== -1
                            ? `${limitPrecision(j.abertura, 1).toFixed(1).replace('.', ',')} (${getAberturaClase(j.abertura)})`
                            : '')
                      }
                      onFocus={() => setFocusedField(`${idx}-abertura`)}
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) val = val.slice(0, -1);
                        val = limitDecimalPlaces(val, 1);
                        handleInputChange(idx, 'abertura', val);
                      }}
                      onBlur={(e) => {
                        setFocusedField(null);
                        const val = e.target.value;
                        if (val === '') {
                          handleRowChange(idx, 'abertura', -1);
                          return;
                        }
                        const num = parseFloat(val);
                        if (isNaN(num) || num < 0) {
                          handleRowChange(idx, 'abertura', -1);
                        } else {
                          handleRowChange(idx, 'abertura', limitPrecision(num, 1));
                        }
                      }}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'abertura')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none text-xs font-semibold"
                    />
                  </td>

                  {/* Espes (mm) - Limita a 1 decimal */}
                  <td className="py-2 px-1 text-center">
                    <input
                      type="text"
                      id={`joint-espesor-${idx}`}
                      value={
                        focusedField === `${idx}-espesor`
                          ? getInputValue(idx, 'espesor', j.espesor)
                          : (j.espesor !== undefined && j.espesor !== -1 ? limitPrecision(j.espesor, 1).toFixed(1) : '')
                      }
                      onFocus={() => setFocusedField(`${idx}-espesor`)}
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) val = val.slice(0, -1);
                        val = limitDecimalPlaces(val, 1);
                        handleInputChange(idx, 'espesor', val);
                      }}
                      onBlur={(e) => {
                        setFocusedField(null);
                        const val = e.target.value;
                        if (val === '') {
                          handleRowChange(idx, 'espesor', -1);
                          return;
                        }
                        const num = parseFloat(val);
                        if (isNaN(num) || num < 0) {
                          handleRowChange(idx, 'espesor', -1);
                        } else {
                          handleRowChange(idx, 'espesor', limitPrecision(num, 1));
                        }
                      }}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'espesor')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none text-xs"
                    />
                  </td>

                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      step="0.01"
                      id={`joint-continuidad-${idx}`}
                      value={getInputValue(idx, 'continuidad', j.continuidad)}
                      onChange={(e) => handleInputChange(idx, 'continuidad', e.target.value)}
                      onBlur={(e) => handleInputBlur(idx, 'continuidad', e.target.value, 100)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'continuidad')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none text-xs"
                    />
                  </td>

                  {/* Espac (m) - Limita a 2 decimales */}
                  <td className="py-2 px-1 text-center">
                    <input
                      type="text"
                      id={`joint-espaciamiento-${idx}`}
                      value={
                        focusedField === `${idx}-espaciamiento`
                          ? getInputValue(idx, 'espaciamiento', j.espaciamiento)
                          : (j.espaciamiento !== undefined && j.espaciamiento !== -1 ? limitPrecision(j.espaciamiento, 2).toFixed(2) : '')
                      }
                      onFocus={() => setFocusedField(`${idx}-espaciamiento`)}
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) val = val.slice(0, -1);
                        val = limitDecimalPlaces(val, 2);
                        handleInputChange(idx, 'espaciamiento', val);
                      }}
                      onBlur={(e) => {
                        setFocusedField(null);
                        const val = e.target.value;
                        if (val === '') {
                          handleRowChange(idx, 'espaciamiento', -1);
                          return;
                        }
                        const num = parseFloat(val);
                        if (isNaN(num) || num < 0) {
                          handleRowChange(idx, 'espaciamiento', -1);
                        } else {
                          handleRowChange(idx, 'espaciamiento', limitPrecision(num, 2));
                        }
                      }}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'espaciamiento')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none text-xs"
                    />
                  </td>

                  {/* Ext Vis - Removida la opción 3 */}
                  <td className="py-2 px-1 text-center">
                    <select
                      value={j.extremos_visibles}
                      onChange={(e) => handleRowChange(idx, 'extremos_visibles', parseInt(e.target.value) ?? -1)}
                      className="bg-transparent text-slate-300 focus:outline-none text-center cursor-pointer w-full text-xs animate-fade-in"
                    >
                      <option value="-1" className="bg-navy-950 text-slate-500">-</option>
                      <option value="0" className="bg-navy-950">0</option>
                      <option value="1" className="bg-navy-950">1</option>
                      <option value="2" className="bg-navy-950">2</option>
                    </select>
                  </td>

                  {/* Term - Removidas las opciones 4 y 5 */}
                  <td className="py-2 px-1 text-center font-normal text-xs">
                    <select
                      value={j.terminacion}
                      onChange={(e) => handleRowChange(idx, 'terminacion', parseInt(e.target.value) ?? -1)}
                      className="bg-transparent text-slate-300 focus:outline-none text-center cursor-pointer w-full text-xs"
                    >
                      <option value="-1" className="bg-navy-950 text-slate-500">-</option>
                      {[0, 1, 2, 3].map(num => (
                        <option key={num} value={num} className="bg-navy-950">
                          {num}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="py-2 px-1">
                    <select
                      value={j.relleno1}
                      onChange={(e) => handleRowChange(idx, 'relleno1', e.target.value)}
                      className="bg-transparent text-slate-300 focus:outline-none text-xs font-normal cursor-pointer w-full text-center"
                    >
                      <option value="-1" className="bg-navy-950 text-slate-500">-</option>
                      {Object.keys(RELLENO_CATALOG).map(code => (
                        <option key={code} value={code} className="bg-navy-950">
                          {code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-1">
                    <select
                      value={j.relleno2 || ''}
                      onChange={(e) => handleRowChange(idx, 'relleno2', e.target.value || undefined)}
                      className="bg-transparent text-slate-300 focus:outline-none text-xs font-normal cursor-pointer w-full text-center"
                    >
                      <option value="" className="bg-navy-950 text-slate-500">-</option>
                      {Object.keys(RELLENO_CATALOG).map(code => (
                        <option key={code} value={code} className="bg-navy-950">
                          {code}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="py-2 px-2 text-center bg-pink-900/5 text-pink-300 font-bold border-l border-navy-900/60 text-xs">
                    {fmtRating(r1_89)}
                  </td>
                  <td className="py-2 px-2 text-center bg-pink-900/5 text-pink-300 font-bold text-xs">
                    {fmtRating(r2_89)}
                  </td>
                  <td className="py-2 px-2 text-center bg-amber-900/5 text-amber-300 font-bold border-l border-navy-900/60 text-xs">
                    {fmtRating(r1_76)}
                  </td>
                  <td className="py-2 px-2 text-center bg-amber-900/5 text-amber-300 font-bold text-xs">
                    {fmtRating(r2_76)}
                  </td>

                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      id={`joint-jrc-${idx}`}
                      value={getInputValue(idx, 'jrc', j.jrc)}
                      onChange={(e) => handleInputChange(idx, 'jrc', e.target.value)}
                      onBlur={(e) => handleInputBlur(idx, 'jrc', e.target.value, 20)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'jrc')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none font-normal text-xs"
                    />
                  </td>

                  {/* Rugosidad - Convertido a input numérico del 0 al 9, idéntico a JRC */}
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      id={`joint-rugosidad-${idx}`}
                      value={getInputValue(idx, 'rugosidad', j.rugosidad)}
                      onChange={(e) => handleInputChange(idx, 'rugosidad', e.target.value)}
                      onBlur={(e) => handleInputBlur(idx, 'rugosidad', e.target.value, 9)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'rugosidad')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none font-normal text-xs"
                    />
                  </td>

                  <td className="py-2 px-1 text-center">
                    <select
                      value={j.forma}
                      onChange={(e) => handleRowChange(idx, 'forma', e.target.value)}
                      className="bg-transparent text-slate-300 focus:outline-none text-center cursor-pointer w-full text-xs"
                    >
                      <option value="-1" className="bg-navy-950 text-slate-500">-</option>
                      {Object.keys(FORMA_CATALOG).map(code => (
                        <option key={code} value={code} className="bg-navy-950 text-xs">
                          {code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-1">
                    <select
                      value={j.alteracion}
                      onChange={(e) => handleRowChange(idx, 'alteracion', e.target.value)}
                      className="bg-transparent text-slate-300 focus:outline-none text-xs font-normal cursor-pointer w-full text-center"
                    >
                      <option value="-1" className="bg-navy-950 text-slate-500">-</option>
                      {Object.keys(ALTERACION_CATALOG).map(code => (
                        <option key={code} value={code} className="bg-navy-950 text-xs">
                          {code}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="py-2 px-2 text-center bg-pink-900/5 text-pink-300 font-normal border-l border-navy-900/60 text-xs">
                    {fmtRating(altR89)}
                  </td>
                  <td className="py-2 px-2 text-center bg-pink-900/5 text-pink-300 font-normal text-xs">
                    {fmtRating(relR89)}
                  </td>
                  <td className="py-2 px-2 text-center bg-pink-900/5 text-pink-300 font-normal text-xs">
                    {fmtRating(contR89)}
                  </td>
                  <td className="py-2 px-2 text-center bg-pink-900/5 text-pink-300 font-normal text-xs">
                    {fmtRating(abR89)}
                  </td>
                  <td className="py-2 px-2 text-center bg-pink-900/5 text-pink-300 font-normal text-xs">
                    {fmtRating(rugR89)}
                  </td>
                  <td className="py-2 px-2 text-center bg-pink-950/20 text-pink-200 font-black text-xs">
                    {fmtRating(totalR89)}
                  </td>

                  <td className="py-2 px-2 text-center bg-amber-900/5 text-amber-300 font-normal border-l border-navy-900/60 text-xs">
                    {fmtRating(altR76)}
                  </td>
                  <td className="py-2 px-2 text-center bg-amber-900/5 text-amber-300 font-normal text-xs">
                    {fmtRating(relR76)}
                  </td>
                  <td className="py-2 px-2 text-center bg-amber-900/5 text-amber-300 font-normal text-xs">
                    {fmtRating(contR76)}
                  </td>
                  <td className="py-2 px-2 text-center bg-amber-900/5 text-amber-300 font-normal text-xs">
                    {fmtRating(abR76)}
                  </td>
                  <td className="py-2 px-2 text-center bg-amber-900/5 text-amber-300 font-normal text-xs">
                    {fmtRating(rugR76)}
                  </td>
                  <td className="py-2 px-2 text-center bg-amber-950/20 text-amber-200 font-black text-xs">
                    {fmtRating(totalR76)}
                  </td>

                  <td className="py-2 px-2 text-center sticky right-0 bg-navy-950 z-10 border-l border-navy-900 w-[60px] min-w-[60px] max-w-[60px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearRow(idx);
                      }}
                      className="p-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors mx-auto flex items-center justify-center active:scale-95"
                      title="Limpiar fila"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {joints.length === 0 && (
              <tr>
                <td colSpan={35} className="py-8 text-center text-slate-500 text-xs bg-navy-950">
                  Ninguna estructura registrada en esta celda. Haz clic en "Crear Familia" para ingresar discontinuidades.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="add-bar flex flex-wrap items-center gap-4 bg-navy-950/30 p-3.5 border-t border-navy-900 rounded-b-xl justify-between">
        <span className="text-xs text-slate-500 italic">
          * Nota: F1, F2 y F3 son obligatorias para calcular JV y promedios ponderados.
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={createFamily}
            className="bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 text-orange-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Crear Familia</span>
          </button>

          <div className="flex items-center gap-2 border-l border-navy-800 pl-3">
            <span className="text-xs text-slate-400 font-bold">Borrar Familia:</span>
            <select
              value={familyToDelete}
              onChange={(e) => setFamilyToDelete(parseInt(e.target.value) || 1)}
              className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer font-bold"
            >
              {activeFamilies.map(f => (
                <option key={f} value={f}>
                  Familia F{f}
                </option>
              ))}
            </select>
            <button
              onClick={() => onDeleteFamily(familyToDelete)}
              className="bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              <span>Eliminar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}