import React, { useMemo, useState } from 'react';
import type { JointRow } from '../utils/rmrCalculator';
import GeomecTable from './Common/GeomecTable';
import { DISCON_COLUMNS } from '../utils/geomecColumns';
import {
  ALTERACION_CATALOG,
  RELLENO_CATALOG,
  RUGOSIDAD_CATALOG
} from '../utils/catalogData';
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
  largoMax: number;
  onDeleteFamily: (famId: number) => void;
  intemperia?: string;
  showFormulas?: boolean;
}

export default function DisconTable({
  joints,
  onChange,
  selectedRowIndex,
  onSelectRow,
  largoMax,
  onDeleteFamily,
  intemperia,
  showFormulas = true
}: DisconTableProps) {
  const [familyToDelete, setFamilyToDelete] = useState<number>(4);

  const activeFamilies = useMemo(() => {
    return Array.from(new Set(joints.map(j => j.familia))).sort((a, b) => a - b);
  }, [joints]);

  const computedJoints = useMemo(() => {
    return joints.map(j => {
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

      return {
        ...j,
        altR89,
        altR76,
        r1_89,
        r2_89,
        r1_76,
        r2_76,
        relR89,
        relR76,
        contR89,
        contR76,
        abR89,
        abR76,
        rugR89,
        rugR76,
        totalR89,
        totalR76
      };
    });
  }, [joints]);

  const handleCellChange = (rowId: any, columnKey: string, val: any) => {
    const updated = joints.map(j => {
      if (j.id === rowId) {
        const clampedVal = columnKey === 'distancia' && val !== -1
          ? Math.min(Math.round(largoMax), Math.max(0, val))
          : val;
        return { ...j, [columnKey]: clampedVal };
      }
      return j;
    });
    onChange(updated);
  };

  const createFamily = () => {
    const nextFam = Math.max(0, ...joints.map(j => j.familia)) + 1;
    const defaultAlt = (intemperia && ['f', 'd', 'm', 'a', 'c', 's'].includes(intemperia)) ? intemperia : 'd';
    const newRows: JointRow[] = Array.from({ length: 3 }).map((_, i) => ({
      id: joints.length + 1 + i,
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
      alteracion: defaultAlt
    }));
    onChange([...joints, ...newRows]);
    onSelectRow(joints.length);
  };

  const clearRow = (rowId: any) => {
    const defaultAlt = (intemperia && ['f', 'd', 'm', 'a', 'c', 's'].includes(intemperia)) ? intemperia : 'd';
    const updated = joints.map(j => {
      if (j.id === rowId) {
        return {
          ...j,
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
          alteracion: defaultAlt
        };
      }
      return j;
    });
    onChange(updated);
  };

  const customHeader = (
    <thead>
      <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs">
        <th rowSpan={2} className="py-3 px-2 text-center sticky left-0 bg-navy-950 z-20 border-r border-b border-navy-800 w-[52px] min-w-[52px]">Fam</th>
        <th rowSpan={2} className="py-3 px-2 text-center sticky left-[52px] bg-navy-950 z-20 border-r border-b border-navy-800 w-[85px] min-w-[85px]">Dist Est. (m)</th>
        <th rowSpan={2} className="py-3 px-2 text-center w-20 border-r border-b border-navy-800">Dip (&deg;)</th>
        <th rowSpan={2} className="py-3 px-2 text-center w-24 border-r border-b border-navy-800">DipDir (&deg;)</th>
        <th rowSpan={2} className="py-3 px-2 text-center w-24 border-r border-b border-navy-800">Tipo Estruc.</th>
        <th rowSpan={2} className="py-3 px-2 text-center w-20 border-r border-b border-navy-800">Cant (n)</th>
        <th rowSpan={2} className="py-3 px-2 text-center w-36 border-r border-b border-navy-800">Abert (mm)</th>
        <th rowSpan={2} className="py-3 px-2 text-center w-24 border-r border-b border-navy-800">Espes (mm)</th>
        <th rowSpan={2} className="py-3 px-2 text-center w-24 border-r border-b border-navy-800">Cont (m)</th>
        <th rowSpan={2} className="py-3 px-2 text-center w-24 border-r border-b border-navy-800">Espac (m)</th>
        <th rowSpan={2} className="py-3 px-2 text-center w-24 border-r border-b border-navy-800">Ext Vis</th>
        <th rowSpan={2} className="py-3 px-2 text-center w-20 border-r border-b border-navy-800">Term</th>
        <th rowSpan={2} className="py-3 px-2 w-32 text-center border-r border-b border-navy-800">Relleno 1</th>
        <th rowSpan={2} className="py-3 px-2 w-32 text-center border-r border-b border-navy-800">Relleno 2</th>
        <th colSpan={2} className="py-2 px-2 text-center border-r border-b border-navy-800 text-pink-400 bg-pink-950/10 text-xs">Valor Relleno (R89)</th>
        <th colSpan={2} className="py-2 px-2 text-center border-r border-b border-navy-800 text-amber-400 bg-amber-950/10 text-xs">Valor Relleno (R76)</th>
        <th rowSpan={2} className="py-3 px-2 text-center w-20 border-r border-b border-navy-800">JRC</th>
        <th rowSpan={2} className="py-3 px-2 w-36 text-center border-r border-b border-navy-800">Rugosidad</th>
        <th rowSpan={2} className="py-3 px-2 text-center w-20 border-r border-b border-navy-800">Forma</th>
        <th rowSpan={2} className="py-3 px-2 w-32 text-center border-r border-b border-navy-800">Alteración</th>
        <th colSpan={6} className="py-2 px-2 text-center bg-pink-900/10 border-r border-b border-navy-800 text-pink-400 text-xs">Condición Discontinuidades (RMR'89)</th>
        <th colSpan={6} className="py-2 px-2 text-center bg-amber-900/10 border-r border-b border-navy-800 text-amber-400 text-xs">Condición Discontinuidades (RMR'76)</th>
        <th rowSpan={2} className="py-3 px-2 text-center sticky right-0 bg-navy-950 z-20 border-l border-b border-navy-800 w-[70px] min-w-[70px]">Acción</th>
      </tr>
      <tr className="bg-navy-950 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-navy-800">
        <th className="py-1 px-2 text-center border-r border-b border-navy-800 text-pink-400/80 bg-pink-950/5">V. R1</th>
        <th className="py-1 px-2 text-center border-r border-b border-navy-800 text-pink-400/80 bg-pink-950/5">V. R2</th>
        <th className="py-1 px-2 text-center border-r border-b border-navy-800 text-amber-400/80 bg-amber-950/5">V. R1</th>
        <th className="py-1 px-2 text-center border-r border-b border-navy-800 text-amber-400/80 bg-amber-950/5">V. R2</th>
        <th className="py-1 px-2 text-center bg-pink-900/5 border-r border-b border-navy-800 text-pink-400/80">Alt</th>
        <th className="py-1 px-2 text-center bg-pink-900/5 border-r border-b border-navy-800 text-pink-400/80">Rel</th>
        <th className="py-1 px-2 text-center bg-pink-900/5 border-r border-b border-navy-800 text-pink-400/80">Cont</th>
        <th className="py-1 px-2 text-center bg-pink-900/5 border-r border-b border-navy-800 text-pink-400/80">Aber</th>
        <th className="py-1 px-2 text-center bg-pink-900/5 border-r border-b border-navy-800 text-pink-400/80">Rug</th>
        <th className="py-1 px-2 text-center bg-pink-950/20 border-r border-b border-navy-800 text-pink-300 font-black">Val</th>
        <th className="py-1 px-2 text-center bg-amber-900/5 border-r border-b border-navy-800 text-amber-400/80">Alt</th>
        <th className="py-1 px-2 text-center bg-amber-900/5 border-r border-b border-navy-800 text-amber-400/80">Rel</th>
        <th className="py-1 px-2 text-center bg-amber-900/5 border-r border-b border-navy-800 text-amber-400/80">Cont</th>
        <th className="py-1 px-2 text-center bg-amber-900/5 border-r border-b border-navy-800 text-amber-400/80">Aber</th>
        <th className="py-1 px-2 text-center bg-amber-900/5 border-r border-b border-navy-800 text-amber-400/80">Rug</th>
        <th className="py-1 px-2 text-center bg-amber-950/20 border-r border-b border-navy-800 text-amber-300 font-black">Val</th>
      </tr>
    </thead>
  );

  return (
    <div className="glass-panel p-6 rounded-xl border border-navy-800 space-y-4 select-none">
      <div className="flex justify-between items-center border-b border-navy-800 pb-3">
        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest">
          Registro de Discontinuidades
        </h3>
      </div>

      <GeomecTable
        data={computedJoints}
        columns={DISCON_COLUMNS}
        rowIdKey="id"
        onCellChange={handleCellChange}
        onSelectRow={onSelectRow}
        selectedRowIndex={selectedRowIndex}
        minWidthStyle="2400px"
        customHeader={customHeader}
        onDeleteRow={clearRow}
        showFormulas={showFormulas}
        tableId="discontinuidades"
      />

      <div className="add-bar flex flex-wrap items-center gap-4 bg-navy-950/30 p-3.5 border-t border-navy-850 rounded-b-xl justify-between">
        <span className="text-xs text-slate-500 italic">
          * Nota: F1, F2 y F3 son obligatorias para calcular JV y promedios ponderados.
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={createFamily}
            className="bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span>Crear Familia</span>
          </button>

          <div className="flex items-center gap-2 border-l border-navy-800 pl-3">
            <span className="text-xs text-slate-400 font-bold">Borrar Familia:</span>
            <select
              value={familyToDelete}
              onChange={(e) => setFamilyToDelete(parseInt(e.target.value) || 1)}
              className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer font-bold animate-fade-in"
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
              <span>Eliminar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}