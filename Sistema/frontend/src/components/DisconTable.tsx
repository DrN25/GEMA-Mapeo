import React from 'react';
import type { JointRow } from '../utils/rmrCalculator';
import {
  STRUCTURE_CATALOG,
  RELLENO_CATALOG,
  ALTERACION_CATALOG,
  FORMA_CATALOG,
  RUGOSIDAD_CATALOG
} from '../utils/catalogData';
import { Plus, Trash2, ShieldAlert } from 'lucide-react';
import {
  getContinuidadRating,
  getAberturaRating,
  getFillingRatingSingle
} from '../utils/rmrCalculator';

interface DisconTableProps {
  joints: JointRow[];
  onChange: (updatedJoints: JointRow[]) => void;
  selectedRowIndex: number | null;
  onSelectRow: (index: number | null) => void;
}

export default function DisconTable({
  joints,
  onChange,
  selectedRowIndex,
  onSelectRow
}: DisconTableProps) {

  const handleRowChange = (index: number, field: keyof JointRow, val: any) => {
    const updated = [...joints];
    updated[index] = {
      ...updated[index],
      [field]: val
    };
    onChange(updated);
  };

  const handleNumericChange = (index: number, field: keyof JointRow, val: string) => {
    const num = parseFloat(val);
    handleRowChange(index, field, isNaN(num) ? 0 : num);
  };

  const addRow = () => {
    const newRow: JointRow = {
      id: joints.length + 1,
      familia: 1,
      distancia: joints.length > 0 ? joints[joints.length - 1].distancia + 1.0 : 0.0,
      tipo_estructura: 'J',
      dip: 45,
      dip_dir: 180,
      n_estructuras: 1,
      abertura: 0.1,
      espesor: 0.0,
      continuidad: 1.5,
      espaciamiento: 0.5,
      extremos_visibles: 1,
      terminacion: 0,
      relleno1: 'cwf',
      jrc: 10,
      rugosidad: 2,
      forma: 'O',
      alteracion: 'd'
    };
    onChange([...joints, newRow]);
    onSelectRow(joints.length);
  };

  const deleteRow = (index: number) => {
    const updated = joints.filter((_, i) => i !== index).map((j, i) => ({
      ...j,
      id: i + 1
    }));
    onChange(updated);
    if (selectedRowIndex === index) {
      onSelectRow(updated.length > 0 ? 0 : null);
    } else if (selectedRowIndex !== null && selectedRowIndex > index) {
      onSelectRow(selectedRowIndex - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, colName: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === joints.length - 1) {
        addRow();
        setTimeout(() => {
          const el = document.getElementById(`joint-distancia-${index + 1}`);
          if (el) el.focus();
        }, 100);
      } else {
        const nextEl = document.getElementById(`joint-${colName}-${index + 1}`);
        if (nextEl) nextEl.focus();
      }
    }
  };

  return (
    <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 select-none">
      <div className="flex justify-between items-center border-b border-navy-800 pb-3">
        <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
          <ShieldAlert size={14} className="text-orange-500" />
          <span>Tabla de Discontinuidades (Scanline)</span>
        </h3>
        <button
          onClick={addRow}
          className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 text-orange-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
        >
          <Plus size={14} />
          <span>Agregar Fila</span>
        </button>
      </div>

      <div className="overflow-x-auto relative rounded-lg border border-navy-900">
        <table className="w-full text-left text-xs border-separate border-spacing-0" style={{ minWidth: '1800px' }}>
          <thead>
            <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs">
              {/* Columnas fijas a la izquierda con anchos definidos en px y sin separaciones */}
              <th className="py-3 px-2 text-center sticky left-0 bg-navy-950 z-20 border-r border-navy-900 w-[52px] min-w-[52px] max-w-[52px]">ID</th>
              <th className="py-3 px-2 text-center sticky left-[52px] bg-navy-950 z-20 border-r border-navy-900 w-[80px] min-w-[80px] max-w-[80px]">Dist (m)</th>
              <th className="py-3 px-3 sticky left-[132px] bg-navy-950 z-20 border-r border-navy-900 w-[110px] min-w-[110px] max-w-[110px]">Tipo</th>

              {/* Columnas dinámicas con scroll */}
              <th className="py-3 px-2 text-center w-16">Fam</th>
              <th className="py-3 px-2 text-center w-16">Dip (&deg;)</th>
              <th className="py-3 px-2 text-center w-20">DipDir (&deg;)</th>
              <th className="py-3 px-2 text-center w-16">Cant (N)</th>
              <th className="py-3 px-2 text-center w-20">Abert (mm)</th>
              <th className="py-3 px-2 text-center w-20">Espes (mm)</th>
              <th className="py-3 px-2 text-center w-20">Cont (m)</th>
              <th className="py-3 px-2 text-center w-20">Espac (m)</th>
              <th className="py-3 px-2 text-center w-20">Ext Vis</th>
              <th className="py-3 px-2 text-center w-16">Term</th>
              <th className="py-3 px-2 w-28">Relleno 1</th>
              <th className="py-3 px-2 w-28">Relleno 2</th>
              <th className="py-3 px-2 text-center w-16">JRC</th>
              <th className="py-3 px-2 w-28">Rugosidad</th>
              <th className="py-3 px-2 text-center w-16">Forma</th>
              <th className="py-3 px-2 w-24">Alteración</th>

              {/* Columnas de cálculo */}
              <th className="py-3 px-2 text-center bg-navy-900/60 border-l border-navy-900 text-orange-400 w-14">Alt R89</th>
              <th className="py-3 px-2 text-center bg-navy-900/60 text-orange-400 w-14">Rel R89</th>
              <th className="py-3 px-2 text-center bg-navy-900/60 text-orange-400 w-14">Cont R89</th>
              <th className="py-3 px-2 text-center bg-navy-900/60 text-orange-400 w-14">Aber R89</th>
              <th className="py-3 px-2 text-center bg-navy-900/60 text-orange-400 w-14">Rug R89</th>
              <th className="py-3 px-2 text-center bg-navy-900/60 text-orange-400 font-bold w-16">Total R89</th>

              {/* Columna de acción fija a la derecha */}
              <th className="py-3 px-2 text-center sticky right-0 bg-navy-950 z-20 border-l border-navy-900 w-[60px] min-w-[60px] max-w-[60px]">Acción</th>
            </tr>
          </thead>
          <tbody>
            {joints.map((j, idx) => {
              const isSelected = selectedRowIndex === idx;

              const altR89 = ALTERACION_CATALOG[j.alteracion]?.r89 || 3;
              const rel1_ratings = getFillingRatingSingle(j.relleno1, j.espesor);
              const rel2_ratings = j.relleno2 ? getFillingRatingSingle(j.relleno2, j.espesor) : { r76: 99, r89: 99 };
              const relR89 = Math.min(rel1_ratings.r89, rel2_ratings.r89);

              const contR89 = getContinuidadRating(j.continuidad).r89;
              const aberR89 = getAberturaRating(j.abertura).r89;
              const rugR89 = RUGOSIDAD_CATALOG[j.rugosidad]?.r89 || 3;
              const totalR89 = Math.min(30, altR89 + relR89 + contR89 + aberR89 + rugR89);

              return (
                <tr
                  key={idx}
                  onClick={() => onSelectRow(idx)}
                  className={`hover:bg-navy-900/10 border-b border-navy-900/60 transition-colors ${isSelected ? 'bg-orange-500/10' : ''
                    }`}
                >
                  {/* Celdas fijas a la izquierda con fondo sólido para evitar que se transluzca el fondo */}
                  <td className="py-2 px-2 text-center font-bold text-slate-400 sticky left-0 bg-navy-950 z-10 border-r border-navy-900 w-[52px] min-w-[52px] max-w-[52px]">
                    {j.id}
                  </td>
                  <td className="py-2 px-1 text-center sticky left-[52px] bg-navy-950 z-10 border-r border-navy-900 w-[80px] min-w-[80px] max-w-[80px]">
                    <input
                      type="number"
                      step="0.01"
                      id={`joint-distancia-${idx}`}
                      value={j.distancia}
                      onChange={(e) => handleNumericChange(idx, 'distancia', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'distancia')}
                      className="w-full bg-transparent text-slate-100 text-center font-semibold focus:outline-none focus:bg-navy-900 px-1 py-0.5 rounded"
                    />
                  </td>
                  <td className="py-2 px-1.5 sticky left-[132px] bg-navy-950 z-10 border-r border-navy-900 w-[110px] min-w-[110px] max-w-[110px]">
                    <select
                      value={j.tipo_estructura}
                      onChange={(e) => handleRowChange(idx, 'tipo_estructura', e.target.value)}
                      className="w-full bg-transparent text-slate-200 font-bold focus:outline-none focus:bg-navy-900 py-0.5 rounded cursor-pointer"
                    >
                      {Object.keys(STRUCTURE_CATALOG).map(code => (
                        <option key={code} value={code} className="bg-navy-950 text-slate-200">
                          {STRUCTURE_CATALOG[code]}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Celdas normales con scroll */}
                  <td className="py-2 px-1 text-center">
                    <select
                      value={j.familia}
                      onChange={(e) => handleRowChange(idx, 'familia', parseInt(e.target.value) || 1)}
                      className="bg-transparent text-slate-300 text-center w-full focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <option key={num} value={num} className="bg-navy-950 text-slate-300">
                          F{num}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      id={`joint-dip-${idx}`}
                      value={j.dip}
                      onChange={(e) => handleNumericChange(idx, 'dip', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'dip')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      id={`joint-dip_dir-${idx}`}
                      value={j.dip_dir}
                      onChange={(e) => handleNumericChange(idx, 'dip_dir', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'dip_dir')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      id={`joint-n_estructuras-${idx}`}
                      value={j.n_estructuras}
                      onChange={(e) => handleNumericChange(idx, 'n_estructuras', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'n_estructuras')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      step="0.01"
                      id={`joint-abertura-${idx}`}
                      value={j.abertura}
                      onChange={(e) => handleNumericChange(idx, 'abertura', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'abertura')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      step="0.01"
                      id={`joint-espesor-${idx}`}
                      value={j.espesor}
                      onChange={(e) => handleNumericChange(idx, 'espesor', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'espesor')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      step="0.1"
                      id={`joint-continuidad-${idx}`}
                      value={j.continuidad}
                      onChange={(e) => handleNumericChange(idx, 'continuidad', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'continuidad')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      step="0.05"
                      id={`joint-espaciamiento-${idx}`}
                      value={j.espaciamiento}
                      onChange={(e) => handleNumericChange(idx, 'espaciamiento', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'espaciamiento')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-1 text-center">
                    <select
                      value={j.extremos_visibles}
                      onChange={(e) => handleRowChange(idx, 'extremos_visibles', parseInt(e.target.value) || 0)}
                      className="bg-transparent text-slate-300 focus:outline-none w-full"
                    >
                      <option value="0" className="bg-navy-950">0</option>
                      <option value="1" className="bg-navy-950">1</option>
                      <option value="2" className="bg-navy-950">2</option>
                    </select>
                  </td>
                  <td className="py-2 px-1 text-center">
                    <select
                      value={j.terminacion}
                      onChange={(e) => handleRowChange(idx, 'terminacion', parseInt(e.target.value) || 0)}
                      className="bg-transparent text-slate-300 focus:outline-none w-full"
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
                      className="bg-transparent text-slate-300 focus:outline-none w-full text-xs font-semibold"
                    >
                      {Object.keys(RELLENO_CATALOG).map(code => (
                        <option key={code} value={code} className="bg-navy-950">
                          {RELLENO_CATALOG[code].name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-1">
                    <select
                      value={j.relleno2 || ''}
                      onChange={(e) => handleRowChange(idx, 'relleno2', e.target.value || undefined)}
                      className="bg-transparent text-slate-300 focus:outline-none w-full text-xs font-semibold"
                    >
                      <option value="" className="bg-navy-950 text-slate-500">- Ninguno -</option>
                      {Object.keys(RELLENO_CATALOG).map(code => (
                        <option key={code} value={code} className="bg-navy-950">
                          {RELLENO_CATALOG[code].name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      id={`joint-jrc-${idx}`}
                      value={j.jrc}
                      onChange={(e) => handleNumericChange(idx, 'jrc', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'jrc')}
                      className="w-full bg-transparent text-slate-200 text-center focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-1">
                    <select
                      value={j.rugosidad}
                      onChange={(e) => handleRowChange(idx, 'rugosidad', parseInt(e.target.value) || 1)}
                      className="bg-transparent text-slate-300 focus:outline-none w-full text-xs"
                    >
                      {Object.keys(RUGOSIDAD_CATALOG).map(numStr => {
                        const num = parseInt(numStr);
                        return (
                          <option key={num} value={num} className="bg-navy-950">
                            {RUGOSIDAD_CATALOG[num].desc}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td className="py-2 px-1 text-center">
                    <select
                      value={j.forma}
                      onChange={(e) => handleRowChange(idx, 'forma', e.target.value)}
                      className="bg-transparent text-slate-300 focus:outline-none w-full text-center"
                    >
                      {Object.keys(FORMA_CATALOG).map(code => (
                        <option key={code} value={code} className="bg-navy-950">
                          {code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-1">
                    <select
                      value={j.alteracion}
                      onChange={(e) => handleRowChange(idx, 'alteracion', e.target.value)}
                      className="bg-transparent text-slate-300 focus:outline-none w-full text-xs font-semibold"
                    >
                      {Object.keys(ALTERACION_CATALOG).map(code => (
                        <option key={code} value={code} className="bg-navy-950">
                          {ALTERACION_CATALOG[code].name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Resultados calculados */}
                  <td className="py-2 px-2 text-center bg-navy-900/30 border-l border-navy-900/60 font-bold text-orange-400">
                    {altR89}
                  </td>
                  <td className="py-2 px-2 text-center bg-navy-900/30 font-bold text-orange-400">
                    {relR89}
                  </td>
                  <td className="py-2 px-2 text-center bg-navy-900/30 font-bold text-orange-400">
                    {contR89}
                  </td>
                  <td className="py-2 px-2 text-center bg-navy-900/30 font-bold text-orange-400">
                    {aberR89}
                  </td>
                  <td className="py-2 px-2 text-center bg-navy-900/30 font-bold text-orange-400">
                    {rugR89}
                  </td>
                  <td className="py-2 px-2 text-center bg-navy-900/30 font-black text-orange-400">
                    {totalR89}
                  </td>

                  {/* Columna Acción fija a la derecha */}
                  <td className="py-2 px-2 text-center sticky right-0 bg-navy-950 z-10 border-l border-navy-900 w-[60px] min-w-[60px] max-w-[60px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRow(idx);
                      }}
                      className="p-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors mx-auto flex items-center justify-center"
                      title="Eliminar fila"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {joints.length === 0 && (
              <tr>
                <td colSpan={26} className="py-8 text-center text-slate-500 text-xs bg-navy-950">
                  Ninguna estructura registrada en esta celda. Haz clic en "Agregar Fila" para ingresar discontinuidades.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}