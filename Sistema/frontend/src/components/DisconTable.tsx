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
}

export default function DisconTable({
  joints,
  onChange,
  selectedRowIndex,
  onSelectRow,
  largoMax
}: DisconTableProps) {

  // Local state to hold temporary string values of numeric inputs while typing,
  // preventing decimal dot erasure.
  const [localValues, setLocalValues] = React.useState<Record<string, string>>({});

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

  const handleRowChange = (index: number, field: keyof JointRow, val: any) => {
    const updated = [...joints];
    updated[index] = {
      ...updated[index],
      [field]: val
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

    // Parse and update parent state in real-time if valid number to trigger calculation update
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
    else if (field === 'n_estructuras') { min = 1; max = 20; }
    else if (field === 'jrc') { min = 0; max = 20; }
    else if (field === 'rugosidad') { min = 1; max = 9; }

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
        extremos_visibles: 1,
        terminacion: 0,
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
        extremos_visibles: 1,
        terminacion: 0,
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
        extremos_visibles: 1,
        terminacion: 0,
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
      extremos_visibles: 1,
      terminacion: 0,
      relleno1: 'cwf',
      relleno2: undefined,
      jrc: -1,
      rugosidad: -1,
      forma: 'O',
      alteracion: 'd'
    };
    onChange(updated);
  };

  const deleteLastFamily = () => {
    const maxFam = Math.max(0, ...joints.map(j => j.familia));
    if (maxFam === 0) return;
    if (maxFam <= 3) {
      alert("No se pueden eliminar las familias básicas obligatorias (F1, F2, F3).");
      return;
    }
    
    const confirm1 = confirm(`¿Está seguro de que desea eliminar la Familia ${maxFam}?`);
    if (!confirm1) return;
    const confirm2 = confirm(`ATENCIÓN: Se borrarán definitivamente todos los datos cargados en la Familia ${maxFam}. ¿Confirmar eliminación?`);
    if (!confirm2) return;
    
    const updated = joints.filter(j => j.familia !== maxFam);
    onChange(updated);
    if (selectedRowIndex !== null && selectedRowIndex >= updated.length) {
      onSelectRow(updated.length > 0 ? updated.length - 1 : null);
    }
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
        <table className="w-full text-left text-sm border-separate border-spacing-0" style={{ minWidth: '2400px' }}>
          <thead>
            <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs">
              {/* Columnas fijas a la izquierda */}
              <th rowSpan={2} className="py-3 px-2 text-center sticky left-0 bg-navy-950 z-20 border-r border-navy-900 w-[52px] min-w-[52px]">Fam</th>
              <th rowSpan={2} className="py-3 px-2 text-center sticky left-[52px] bg-navy-950 z-20 border-r border-navy-900 w-[85px] min-w-[85px]">Dist (m)</th>
              
              {/* Columnas inputs */}
              <th rowSpan={2} className="py-3 px-2 text-center w-20">Dip (&deg;)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">DipDir (&deg;)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">Tipo</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-20">Cant (N)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">Abert (mm)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">Espes (mm)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">Cont (m)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">Espac (m)</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-24">Ext Vis</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-20">Term</th>
              <th rowSpan={2} className="py-3 px-2 w-32 text-center">Relleno 1</th>
              <th rowSpan={2} className="py-3 px-2 w-32 text-center">Relleno 2</th>
              
              {/* Ratings intermedios */}
              <th colSpan={2} className="py-2 px-2 text-center border-l border-navy-900 text-pink-400 bg-pink-950/10 text-xs">Valor Relleno (R89)</th>
              <th colSpan={2} className="py-2 px-2 text-center border-l border-navy-900 text-amber-400 bg-amber-950/10 text-xs">Valor Relleno (R76)</th>

              <th rowSpan={2} className="py-3 px-2 text-center w-20">JRC</th>
              <th rowSpan={2} className="py-3 px-2 w-36 text-center">Rugosidad</th>
              <th rowSpan={2} className="py-3 px-2 text-center w-20">Forma</th>
              <th rowSpan={2} className="py-3 px-2 w-32 text-center">Alteración</th>

              {/* Ratings de Condición RMR89 */}
              <th colSpan={6} className="py-2 px-2 text-center bg-pink-900/10 border-l border-navy-900 text-pink-400 text-xs">Condición Discontinuidades (RMR'89)</th>
              
              {/* Ratings de Condición RMR76 */}
              <th colSpan={6} className="py-2 px-2 text-center bg-amber-900/10 border-l border-navy-900 text-amber-400 text-xs">Condición Discontinuidades (RMR'76)</th>

              {/* Accion */}
              <th rowSpan={2} className="py-3 px-2 text-center sticky right-0 bg-navy-950 z-20 border-l border-navy-900 w-[60px] min-w-[60px]">Acción</th>
            </tr>
            <tr className="bg-navy-950 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-navy-900">
              {/* Row 2 Subheaders */}
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

              // On the fly ratings calculations matching the HTML engine
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

              const rugItem = j.rugosidad && j.rugosidad !== -1 ? RUGOSIDAD_CATALOG[j.rugosidad] : null;
              const rugR89 = rugItem ? rugItem.r89 : null;
              const rugR76 = rugItem ? rugItem.r76 : null;

              const hasAll89 = altR89 !== null && relR89 !== null && contR89 !== null && abR89 !== null && rugR89 !== null;
              const hasAll76 = altR76 !== null && relR76 !== null && contR76 !== null && abR76 !== null && rugR76 !== null;
              const totalR89 = hasAll89 ? Math.min(30, altR89! + relR89! + contR89! + abR89! + rugR89!) : null;
              const totalR76 = hasAll76 ? Math.min(25, altR76! + relR76! + contR76! + abR76! + rugR76!) : null;

              // Row background styling depending on family index
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
                  {/* Fam (Sticky left 1) */}
                  <td className="py-2 px-1 text-center sticky left-0 z-10 border-r border-navy-900 bg-navy-950 font-normal">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${getFamilyBadgeStyle(j.familia)}`}>
                      F{j.familia}
                    </span>
                  </td>

                  {/* Dist (Sticky left 2) */}
                  <td className="py-2 px-1 text-center sticky left-[52px] z-10 border-r border-navy-900 bg-navy-950">
                    <input
                      type="number"
                      step="0.01"
                      id={`joint-distancia-${idx}`}
                      value={getInputValue(idx, 'distancia', j.distancia)}
                      onChange={(e) => handleInputChange(idx, 'distancia', e.target.value)}
                      onBlur={(e) => handleInputBlur(idx, 'distancia', e.target.value, largoMax)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'distancia')}
                      className="w-full bg-transparent text-slate-100 text-center font-normal focus:outline-none text-xs"
                    />
                  </td>

                  {/* Inputs */}
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
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
                      id={`joint-dip_dir-${idx}`}
                      value={getInputValue(idx, 'dip_dir', j.dip_dir)}
                      onChange={(e) => handleInputChange(idx, 'dip_dir', e.target.value)}
                      onBlur={(e) => handleInputBlur(idx, 'dip_dir', e.target.value, 360)}
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
                      {Object.keys(STRUCTURE_CATALOG).map(code => (
                        <option key={code} value={code} className="bg-navy-950 text-slate-200">
                          {code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      id={`joint-n_estructuras-${idx}`}
                      value={getInputValue(idx, 'n_estructuras', j.n_estructuras)}
                      onChange={(e) => handleInputChange(idx, 'n_estructuras', e.target.value)}
                      onBlur={(e) => handleInputBlur(idx, 'n_estructuras', e.target.value, 20)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'n_estructuras')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none font-normal text-xs"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      step="0.01"
                      id={`joint-abertura-${idx}`}
                      value={getInputValue(idx, 'abertura', j.abertura)}
                      onChange={(e) => handleInputChange(idx, 'abertura', e.target.value)}
                      onBlur={(e) => handleInputBlur(idx, 'abertura', e.target.value, 100)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'abertura')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none text-xs"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      step="0.01"
                      id={`joint-espesor-${idx}`}
                      value={getInputValue(idx, 'espesor', j.espesor)}
                      onChange={(e) => handleInputChange(idx, 'espesor', e.target.value)}
                      onBlur={(e) => handleInputBlur(idx, 'espesor', e.target.value, 100)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'espesor')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none text-xs"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      step="0.1"
                      id={`joint-continuidad-${idx}`}
                      value={getInputValue(idx, 'continuidad', j.continuidad)}
                      onChange={(e) => handleInputChange(idx, 'continuidad', e.target.value)}
                      onBlur={(e) => handleInputBlur(idx, 'continuidad', e.target.value, 100)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'continuidad')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none text-xs"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      step="0.01"
                      id={`joint-espaciamiento-${idx}`}
                      value={getInputValue(idx, 'espaciamiento', j.espaciamiento)}
                      onChange={(e) => handleInputChange(idx, 'espaciamiento', e.target.value)}
                      onBlur={(e) => handleInputBlur(idx, 'espaciamiento', e.target.value, 100)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'espaciamiento')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none text-xs"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <select
                      value={j.extremos_visibles}
                      onChange={(e) => handleRowChange(idx, 'extremos_visibles', parseInt(e.target.value) || 0)}
                      className="bg-transparent text-slate-300 focus:outline-none text-center cursor-pointer w-full text-xs"
                    >
                      <option value="0" className="bg-navy-950">0</option>
                      <option value="1" className="bg-navy-950">1</option>
                      <option value="2" className="bg-navy-950">2</option>
                      <option value="3" className="bg-navy-950">3</option>
                    </select>
                  </td>
                  <td className="py-2 px-1 text-center">
                    <select
                      value={j.terminacion}
                      onChange={(e) => handleRowChange(idx, 'terminacion', parseInt(e.target.value) || 0)}
                      className="bg-transparent text-slate-300 focus:outline-none text-center cursor-pointer w-full text-xs"
                    >
                      {[0, 1, 2, 3, 4, 5].map(num => (
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

                  {/* Sub-ratings de Relleno (Críticos v.r1 y v.r2) */}
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

                  {/* Properties */}
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
                  <td className="py-2 px-1">
                    <select
                      value={j.rugosidad}
                      onChange={(e) => handleRowChange(idx, 'rugosidad', parseInt(e.target.value) || 1)}
                      className="bg-transparent text-slate-300 focus:outline-none text-xs text-center cursor-pointer w-full"
                    >
                      {Object.keys(RUGOSIDAD_CATALOG).map(numStr => {
                        const num = parseInt(numStr);
                        return (
                          <option key={num} value={num} className="bg-navy-950 text-xs">
                            {num}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td className="py-2 px-1 text-center">
                    <select
                      value={j.forma}
                      onChange={(e) => handleRowChange(idx, 'forma', e.target.value)}
                      className="bg-transparent text-slate-300 focus:outline-none text-center cursor-pointer w-full text-xs"
                    >
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
                      {Object.keys(ALTERACION_CATALOG).map(code => (
                        <option key={code} value={code} className="bg-navy-950 text-xs">
                          {code}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* R89 Ratings */}
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

                  {/* R76 Ratings */}
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

                  {/* Sticky right Action (Limpiar) */}
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

      <div className="add-bar flex items-center gap-3 bg-navy-950/30 p-3.5 border-t border-navy-900 rounded-b-xl justify-end">
        <button
          onClick={createFamily}
          className="bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 text-orange-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
          title="Crear un nuevo grupo de 3 registros para la siguiente familia"
        >
          <Plus size={14} />
          <span>Crear Familia</span>
        </button>
        <button
          onClick={deleteLastFamily}
          className="bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
          title="Eliminar el último grupo de 3 registros de la familia"
        >
          <Trash2 size={14} />
          <span>Eliminar Familia</span>
        </button>
      </div>
    </div>
  );
}