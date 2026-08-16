import React, { useMemo, useState } from 'react';
import type { JointRow } from '../../utils/rmrCalculator';
import GeomecTable from '../Common/GeomecTable';
import { DISCON_COLUMNS, COLUMN_LABELS } from '../../utils/geomecColumns';
import {
  ALTERACION_CATALOG,
  RELLENO_CATALOG,
  RUGOSIDAD_CATALOG
} from '../../utils/catalogData';
import {
  getContinuidadRating,
  getAberturaRating,
  getFillingRatingSingle
} from '../../utils/rmrCalculator';
import { Layers, Plus, Trash2 } from 'lucide-react';

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

const getFamilyColor = (famNum: number): string => {
  const colors = [
    '#fb923c', // Naranja (F1)
    '#34d399', // Esmeralda (F2)
    '#818cf8', // Índigo (F3)
    '#f472b6', // Rosa (F4)
    '#22d3ee', // Celeste (F5)
    '#fbbf24', // Oro (F6)
    '#f87171', // Rojo (F7)
    '#a78bfa', // Violeta (F8)
    '#2dd4bf'  // Verde Azulado (F9)
  ];
  return colors[(famNum - 1) % colors.length];
};

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

  const enrichedColumns = useMemo(() => {
    return DISCON_COLUMNS.map(col => {
      const pinkKeys = ['r1_89', 'r2_89', 'altR89', 'relR89', 'contR89', 'abR89', 'rugR89'];
      const amberKeys = ['r1_76', 'r2_76', 'altR76', 'relR76', 'contR76', 'abR76', 'rugR76'];

      if (pinkKeys.includes(col.key)) {
        return {
          ...col,
          customStyleClass: 'bg-pink-500/[0.015] text-pink-400 font-normal'
        };
      }
      if (col.key === 'totalR89') {
        return {
          ...col,
          customStyleClass: 'bg-pink-500/10 text-pink-300 font-black shadow-[inset_0_0_8px_rgba(236,72,153,0.15)] text-center'
        };
      }
      if (amberKeys.includes(col.key)) {
        return {
          ...col,
          customStyleClass: 'bg-amber-500/[0.015] text-amber-400 font-normal'
        };
      }
      if (col.key === 'totalR76') {
        return {
          ...col,
          customStyleClass: 'bg-amber-500/10 text-amber-300 font-black shadow-[inset_0_0_8px_rgba(245,158,11,0.15)] text-center'
        };
      }
      return {
        ...col,
        customStyleClass: col.customStyleClass || 'font-normal'
      };
    });
  }, [DISCON_COLUMNS]);

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
        altR89, altR76, r1_89, r2_89, r1_76, r2_76, relR89, relR76, contR89, contR76, abR89, abR76, rugR89, rugR76, totalR89, totalR76
      };
    });
  }, [joints]);

  const handleCellChange = (rowId: any, columnKey: string, val: any) => {
    const updated = joints.map(j => {
      if (j.id === rowId) {
        const clampedVal = (columnKey === 'distancia' || columnKey === 'espaciamiento') && val !== -1 && val !== null && val !== undefined
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
    setFamilyToDelete(nextFam);
    const newRows: JointRow[] = Array.from({ length: 3 }).map((_, i) => ({
      id: joints.length + 1 + i,
      familia: nextFam,
      distancia: -1,
      tipo_estructura: '-1',
      dip: -1,
      dip_dir: -1,
      n_estructuras: -1,
      abertura: -1,
      espesor: -1,
      continuidad: -1,
      espaciamiento: -1,
      extremos_visibles: -1,
      terminacion: -1,
      relleno1: '-1',
      relleno2: undefined,
      jrc: -1,
      rugosidad: -1,
      forma: '-1',
      alteracion: '-1'
    }));
    onChange([...joints, ...newRows]);
    onSelectRow(joints.length);
  };

  const clearRow = (rowId: any) => {
    const updated = joints.map(j => {
      if (j.id === rowId) {
        return {
          ...j,
          distancia: -1,
          tipo_estructura: '-1',
          dip: -1,
          dip_dir: -1,
          n_estructuras: -1,
          abertura: -1,
          espesor: -1,
          continuidad: -1,
          espaciamiento: -1,
          extremos_visibles: -1,
          terminacion: -1,
          relleno1: '-1',
          relleno2: undefined,
          jrc: -1,
          rugosidad: -1,
          forma: '-1',
          alteracion: '-1'
        };
      }
      return j;
    });
    onChange(updated);
  };

  const getRowClassName = (_row: any, idx: number) => {
    const famId = _row?.familia || Math.floor(idx / 3) + 1;
    const borderClass = (idx + 1) % 3 === 0 ? "border-b-2 border-navy-700/80" : "border-b border-navy-900/25";

    const backgrounds: Record<number, string> = {
      1: "bg-orange-500/[0.015]",
      2: "bg-emerald-500/[0.015]",
      3: "bg-indigo-500/[0.015]",
      4: "bg-pink-500/[0.015]",
      5: "bg-cyan-500/[0.015]",
      6: "bg-amber-500/[0.015]",
      7: "bg-red-500/[0.015]",
      8: "bg-violet-500/[0.015]",
      9: "bg-teal-500/[0.015]"
    };

    return `${backgrounds[famId] || "bg-slate-500/[0.015]"} ${borderClass}`;
  };

  const renderRowIndex = (idx: number, _row: any) => {
    const famId = _row?.familia || Math.floor(idx / 3) + 1;
    const color = getFamilyColor(famId);
    return (
      <span
        style={{ color, borderColor: `${color}40`, backgroundColor: `${color}10` }}
        className="text-[11px] font-black px-2 py-0.5 rounded-md border uppercase font-sans tracking-wide animate-fade-in"
      >
        F{famId}
      </span>
    );
  };

  const customHeader = (
    <thead>
      <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[11px] h-9">
        <th rowSpan={2} className="py-2 px-2 text-center sticky left-0 bg-navy-950 z-30 border-r border-b border-navy-800/80 w-[52px] min-w-[52px] shadow-[2px_0_5px_rgba(0,0,0,0.15)] h-9">Fam</th>
        <th rowSpan={2} className="py-2 px-2 text-center border-r border-b border-navy-800/80 w-[85px] min-w-[85px] h-9">{COLUMN_LABELS.distancia}</th>
        <th rowSpan={2} className="py-2 px-2 text-center w-20 border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.dip}</th>
        <th rowSpan={2} className="py-2 px-2 text-center w-24 border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.dip_dir}</th>
        <th rowSpan={2} className="py-2 px-2 text-center w-24 border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.tipo_estructura}</th>
        <th rowSpan={2} className="py-2 px-2 text-center w-20 border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.n_estructuras}</th>
        <th rowSpan={2} className="py-2 px-2 text-center w-36 border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.abertura}</th>
        <th rowSpan={2} className="py-2 px-2 text-center w-24 border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.espesor}</th>
        <th rowSpan={2} className="py-2 px-2 text-center w-24 border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.continuidad}</th>
        <th rowSpan={2} className="py-2 px-2 text-center w-24 border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.espaciamiento}</th>
        <th rowSpan={2} className="py-2 px-2 text-center w-24 border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.extremos_visibles}</th>
        <th rowSpan={2} className="py-2 px-2 text-center w-20 border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.terminacion}</th>
        <th rowSpan={2} className="py-2 px-2 w-32 text-center border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.relleno1}</th>
        <th rowSpan={2} className="py-2 px-2 w-32 text-center border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.relleno2}</th>
        <th colSpan={2} className="py-1 px-2 text-center border-r border-b border-navy-800/80 text-pink-400 bg-pink-950/15 text-[11px] font-black tracking-widest h-5">Valor Relleno (R89)</th>
        <th colSpan={2} className="py-1 px-2 text-center border-r border-b border-navy-800/80 text-amber-400 bg-amber-950/15 text-[11px] font-black tracking-widest h-5">Valor Relleno (R76)</th>
        <th rowSpan={2} className="py-2 px-2 text-center w-20 border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.jrc}</th>
        <th rowSpan={2} className="py-2 px-2 w-36 text-center border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.rugosidad}</th>
        <th rowSpan={2} className="py-2 px-2 text-center w-20 border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.forma}</th>
        <th rowSpan={2} className="py-2 px-2 w-32 text-center border-r border-b border-navy-800/80 h-9">{COLUMN_LABELS.alteracion}</th>
        <th colSpan={6} className="py-1 px-2 text-center bg-pink-950/15 border-r border-b border-navy-800/80 text-pink-400 text-[11px] font-black tracking-widest h-5">Condición Discontinuidades (RMR'89)</th>
        <th colSpan={6} className="py-1 px-2 text-center bg-amber-950/15 border-r border-b border-navy-800/80 text-amber-400 text-[11px] font-black tracking-widest h-5">Condición Discontinuidades (RMR'76)</th>
        <th rowSpan={2} className="py-2 px-2 text-center sticky right-0 bg-navy-950 z-30 border-l border-b border-navy-800/80 w-[70px] min-w-[70px] shadow-[-2px_0_5px_rgba(0,0,0,0.15)] h-9">Acción</th>
      </tr>
      <tr className="bg-navy-950 text-slate-500 font-extrabold uppercase tracking-wider text-[10px] h-4">
        <th className="py-1 px-2 text-center border-r border-b border-navy-800/80 text-pink-400/85 bg-pink-950/10 h-4">{COLUMN_LABELS.r1_sub_89}</th>
        <th className="py-1 px-2 text-center border-r border-b border-navy-800/80 text-pink-400/85 bg-pink-950/10 h-4">{COLUMN_LABELS.r2_sub_89}</th>
        <th className="py-1 px-2 text-center border-r border-b border-navy-800/80 text-amber-400/85 bg-amber-950/10 h-4">{COLUMN_LABELS.r1_sub_76}</th>
        <th className="py-1 px-2 text-center border-r border-b border-navy-800/80 text-amber-400/85 bg-amber-950/10 h-4">{COLUMN_LABELS.r2_sub_76}</th>
        <th className="py-1 px-2 text-center bg-pink-950/5 border-r border-b border-navy-800/80 text-pink-400/85 h-4">{COLUMN_LABELS.alt_sub}</th>
        <th className="py-1 px-2 text-center bg-pink-950/5 border-r border-b border-navy-800/80 text-pink-400/85 h-4">{COLUMN_LABELS.rel_sub}</th>
        <th className="py-1 px-2 text-center bg-pink-950/5 border-r border-b border-navy-800/80 text-pink-400/85 h-4">{COLUMN_LABELS.cont_sub}</th>
        <th className="py-1 px-2 text-center bg-pink-950/5 border-r border-b border-navy-800/80 text-pink-400/85 h-4">{COLUMN_LABELS.aber_sub}</th>
        <th className="py-1 px-2 text-center bg-pink-950/5 border-r border-b border-navy-800/80 text-pink-400/85 h-4">{COLUMN_LABELS.rug_sub}</th>
        <th className="py-1 px-2 text-center bg-pink-500/20 border-r border-b border-navy-800/80 text-pink-300 font-black h-4 shadow-[inset_0_0_8px_rgba(236,72,153,0.1)]">{COLUMN_LABELS.val_sub}</th>
        <th className="py-1 px-2 text-center bg-amber-950/5 border-r border-b border-navy-800/80 text-amber-400/85 h-4">{COLUMN_LABELS.alt_sub}</th>
        <th className="py-1 px-2 text-center bg-amber-950/5 border-r border-b border-navy-800/80 text-amber-400/85 h-4">{COLUMN_LABELS.rel_sub}</th>
        <th className="py-1 px-2 text-center bg-amber-950/5 border-r border-b border-navy-800/80 text-amber-400/85 h-4">{COLUMN_LABELS.cont_sub}</th>
        <th className="py-1 px-2 text-center bg-amber-950/5 border-r border-b border-navy-800/80 text-amber-400/85 h-4">{COLUMN_LABELS.aber_sub}</th>
        <th className="py-1 px-2 text-center bg-amber-950/5 border-r border-b border-navy-800/80 text-amber-400/85 h-4">{COLUMN_LABELS.rug_sub}</th>
        <th className="py-1 px-2 text-center bg-amber-500/20 border-r border-b border-navy-800/80 text-amber-300 font-black h-4 shadow-[inset_0_0_8px_rgba(245,158,11,0.1)]">{COLUMN_LABELS.val_sub}</th>
      </tr>
    </thead>
  );

  return (
    <div className="glass-panel p-6 rounded-xl border border-navy-800 bg-navy-950/15 shadow-xl space-y-4 select-none">
      <div className="flex justify-between items-center border-b border-navy-900 pb-3">
        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
          <Layers size={16} className="text-violet-400 animate-pulse" />
          <span>Registro de Discontinuidades de Ventana</span>
        </h3>
      </div>

      <GeomecTable
        data={computedJoints}
        columns={enrichedColumns}
        rowIdKey="id"
        onCellChange={handleCellChange}
        onSelectRow={onSelectRow}
        selectedRowIndex={selectedRowIndex}
        minWidthStyle="2400px"
        customHeader={customHeader}
        onDeleteRow={clearRow}
        showFormulas={showFormulas}
        tableId="discontinuidades"
        getRowClassName={getRowClassName}
        renderRowIndex={renderRowIndex}
      />

      <div className="add-bar flex flex-wrap items-center gap-4 bg-navy-950/40 p-4 border-t border-navy-800 rounded-b-xl justify-between shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]">
        <span className="text-xs text-slate-400 italic font-medium">
          * Nota: F1, F2 y F3 son obligatorias para calcular el Jv y promedios volumétricos ponderados.
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={createFamily}
            className="bg-violet-500/10 border border-violet-500/40 hover:bg-violet-500/20 hover:border-violet-400 text-violet-400 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-2 shadow-[0_0_12px_rgba(139,92,246,0.12)]"
          >
            <Plus size={14} />
            <span>Crear Familia</span>
          </button>

          <div className="flex items-center gap-3 border-l border-navy-800 pl-4">
            <span className="text-xs text-slate-400 font-extrabold tracking-wide">Borrar:</span>
            <select
              value={familyToDelete}
              onChange={(e) => setFamilyToDelete(parseInt(e.target.value) || 1)}
              className="bg-navy-900 border border-navy-700/80 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none cursor-pointer font-bold"
            >
              {activeFamilies.map(f => (
                <option key={f} value={f}>
                  Familia F{f}
                </option>
              ))}
            </select>
            <button
              onClick={() => onDeleteFamily(familyToDelete)}
              className="bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 hover:text-red-400 text-red-400 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-2 shadow-[0_0_12px_rgba(239,68,68,0.12)]"
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