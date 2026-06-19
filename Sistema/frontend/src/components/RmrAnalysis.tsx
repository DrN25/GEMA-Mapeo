import type { WindowHeader, CalculatorResult } from '../utils/rmrCalculator';
import { Compass, Table } from 'lucide-react';

interface RmrAnalysisProps {
  header: WindowHeader;
  onChange: (header: WindowHeader) => void;
  calculated: CalculatorResult | null;
  onClose?: () => void;
}

export default function RmrAnalysis({
  header,
  onChange,
  calculated,
  onClose
}: RmrAnalysisProps) {
  if (!calculated) {
    return (
      <div className="glass-panel p-8 rounded-xl border border-navy-800 text-center text-slate-500 space-y-2">
        <p className="text-xs">No hay datos de mapeo disponibles para analizar. Registre discontinuidades en la ventana.</p>
      </div>
    );
  }

  const handleWaterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...header,
      condicion_agua: e.target.value
    });
  };

  const handleUcsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    let resistencia_ucs = 'R4';
    if (val > 250) resistencia_ucs = 'R6';
    else if (val > 100) resistencia_ucs = 'R5';
    else if (val > 50) resistencia_ucs = 'R4';
    else if (val > 25) resistencia_ucs = 'R3';
    else if (val > 5) resistencia_ucs = 'R2';
    else if (val > 1) resistencia_ucs = 'R1';
    else resistencia_ucs = 'R0';

    onChange({
      ...header,
      ucs_mpa: val,
      resistencia_ucs
    });
  };

  const handleIs50Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    onChange({
      ...header,
      is50_mpa: val
    });
  };

  const handleFieldChange = (field: keyof WindowHeader, val: any) => {
    onChange({
      ...header,
      [field]: val
    });
  };

  const ucs = header.ucs_mpa !== undefined ? header.ucs_mpa : 73;
  const is50 = header.is50_mpa !== undefined ? header.is50_mpa : 5;
  const gsiCond = header.gsi_superficie || 'G';
  const gsiEstruc = header.gsi_estructura || 'VB';
  const gsiVisual = header.gsi_visual !== undefined ? header.gsi_visual : 56;
  const ctrl = header.control_estructural !== undefined ? header.control_estructural : 3;
  const vol = header.efectos_voladura !== undefined ? header.efectos_voladura : 3;

  const resistLetter = ucs > 250 ? 'A' : ucs > 100 ? 'B' : ucs > 50 ? 'C' : 'D';

  const p1 = calculated.familias_spacing[1] ? calculated.familias_spacing[1].toFixed(3) : '0.000';
  const p2 = calculated.familias_spacing[2] ? calculated.familias_spacing[2].toFixed(3) : '0.000';
  const p3 = calculated.familias_spacing[3] ? calculated.familias_spacing[3].toFixed(3) : '0.000';

  return (
    <div className="glass-panel p-6 rounded-xl border border-navy-800 bg-navy-950/20 space-y-6 text-left select-none animate-fade-in">

      {/* 1. Header Row */}
      <div className="flex items-center justify-between border-b border-navy-850 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
            <Compass size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
              Análisis Geomecánico RMR
            </h3>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
              Código: <span className="text-indigo-400 font-black">{header.celda || '—'}</span> &nbsp;|&nbsp;
              Fecha: <span className="text-slate-300 font-semibold">{header.fecha || '—'}</span>
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            ✕ Cerrar Panel
          </button>
        )}
      </div>

      {/* 2. Parameters Grid Inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 bg-navy-950/45 p-4 rounded-xl border border-navy-900">
        <div className="col-span-2 space-y-1">
          <label className="block text-slate-400 font-bold uppercase tracking-wider text-xs">
            Condición de Agua
          </label>
          <select
            value={header.condicion_agua}
            onChange={handleWaterChange}
            className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer font-normal text-center"
          >
            <option value="C" className="bg-navy-950">C — Completamente seco</option>
            <option value="H" className="bg-navy-950">H — Húmedo</option>
            <option value="M" className="bg-navy-950">M — Mojado</option>
            <option value="E" className="bg-navy-950">E — Goteando</option>
            <option value="F" className="bg-navy-950">F — Fluyendo</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-slate-400 font-bold uppercase tracking-wider text-xs">
            UCS (MPa)
          </label>
          <input
            type="number"
            value={ucs}
            onChange={handleUcsChange}
            min={0}
            className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-normal"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-slate-400 font-bold uppercase tracking-wider text-xs">
            is50 (MPa)
          </label>
          <input
            type="number"
            value={is50}
            onChange={handleIs50Change}
            step="0.1"
            min={0}
            className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-normal"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-slate-400 font-bold uppercase tracking-wider text-xs">
            Cond. SUP
          </label>
          <input
            type="text"
            value={gsiCond}
            onChange={(e) => handleFieldChange('gsi_superficie', e.target.value)}
            className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-normal"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-slate-400 font-bold uppercase tracking-wider text-xs">
            Estruc.
          </label>
          <input
            type="text"
            value={gsiEstruc}
            onChange={(e) => handleFieldChange('gsi_estructura', e.target.value)}
            className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-indigo-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-semibold animate-pulse-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-slate-400 font-bold uppercase tracking-wider text-xs">
            GSI Vis.
          </label>
          <input
            type="number"
            value={gsiVisual}
            onChange={(e) => handleFieldChange('gsi_visual', parseInt(e.target.value) || 0)}
            min={0}
            className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-indigo-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-semibold"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-slate-400 font-bold uppercase tracking-wider text-xs">
            Ctrl. Est.
          </label>
          <input
            type="number"
            value={ctrl}
            onChange={(e) => handleFieldChange('control_estructural', parseInt(e.target.value) || 0)}
            min={0}
            className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-indigo-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-semibold"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-slate-400 font-bold uppercase tracking-wider text-xs">
            Ef. Vol.
          </label>
          <input
            type="number"
            value={vol}
            onChange={(e) => handleFieldChange('efectos_voladura', parseInt(e.target.value) || 0)}
            min={0}
            className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-normal"
          />
        </div>
      </div>

      {/* 3. Badges Metrics - Rediseñadas con la misma forma geométrica y consistencia de los KPIs superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* RQD Estimado */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-gradient-to-br from-navy-950/30 to-sky-950/10 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-24 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-all pointer-events-none" />
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400">RQD Estimado</span>
            <span className="text-2xl font-extrabold font-mono tracking-tight text-sky-200 mt-1.5">
              {calculated.rqd_est.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* RMR '76 */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-gradient-to-br from-navy-950/30 to-pink-950/10 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-24 bg-pink-500/5 rounded-full blur-2xl group-hover:bg-pink-500/10 transition-all pointer-events-none" />
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-pink-400">RMR '76 (Bieniawski)</span>
            <span className="text-2xl font-extrabold font-mono tracking-tight text-pink-200 mt-1.5">
              {calculated.rmr_76}
            </span>
          </div>
        </div>

        {/* RMR '89 */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-gradient-to-br from-navy-950/30 to-amber-950/10 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">RMR '89 (Bieniawski)</span>
            <span className="text-2xl font-extrabold font-mono tracking-tight text-amber-200 mt-1.5">
              {calculated.rmr_89}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Table Rating 76 vs 89 - Consistencia idéntica de bordes y spacing de DisconTable */}
      <div className="overflow-x-auto rounded-lg border border-navy-900 bg-navy-950/20">
        <table className="w-full text-left text-xs border-collapse border-separate border-spacing-0" style={{ minWidth: '1200px' }}>
          <thead>
            <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-navy-900">
              <th className="py-3 px-3 text-center sticky left-0 bg-navy-950 z-10 w-20 border-r border-navy-900">RATING</th>
              <th className="py-3 px-2 text-center text-yellow-400 bg-yellow-500/5">Cond. Agua</th>
              <th className="py-3 px-2 text-center text-yellow-400 bg-yellow-500/5">Valor Agua</th>
              <th className="py-3 px-2 text-center text-yellow-400 bg-yellow-500/5">Resistencia</th>
              <th className="py-3 px-2 text-center text-yellow-400 bg-yellow-500/5">Val Resist.</th>
              <th className="py-3 px-2 text-center text-indigo-400 bg-indigo-500/5">Cond. SUP</th>
              <th className="py-3 px-2 text-center text-indigo-400 bg-indigo-500/5">Estruc. GSI</th>
              <th className="py-3 px-2 text-center text-indigo-400 bg-indigo-500/5">GSI Visual</th>
              <th className="py-3 px-2 text-center text-slate-300 bg-navy-900/40">Ctrl. Estruc.</th>
              <th className="py-3 px-2 text-center text-slate-300 bg-navy-900/40">Ef. Voladura</th>
              <th className="py-3 px-2 text-center text-amber-400 bg-amber-500/5">RQD Valor</th>
              <th className="py-3 px-2 text-center text-amber-400 bg-amber-500/5">RQD (%)</th>
              <th className="py-3 px-2 text-center text-sky-400 bg-sky-500/5">Frec. Frac.</th>
              <th className="py-3 px-2 text-center text-sky-400 bg-sky-500/5">Tam. Bloque</th>
              <th className="py-3 px-2 text-center text-sky-400 bg-sky-500/5">Espac. Prom</th>
              <th className="py-3 px-2 text-center text-amber-400 bg-amber-500/5">Espac. Val</th>
              <th className="py-3 px-2 text-center text-amber-400 bg-amber-500/5">Val ConDisc</th>
              <th className="py-3 px-3 text-center text-slate-200 bg-navy-900/60 font-black">RMR FINAL</th>
              <th className="py-3 px-2 text-center text-slate-400">UCS (MPa)</th>
              <th className="py-3 px-2 text-center text-slate-400">is50 (MPa)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-900/40 text-slate-300 text-xs font-semibold">
            {/* Row RMR'76 */}
            <tr className="hover:bg-navy-900/20 border-b border-navy-900/60 transition-colors bg-pink-500/[0.02]">
              <td className="py-2.5 px-3 text-center font-black text-pink-400 bg-pink-500/10 sticky left-0 z-10 w-20 border-r border-navy-900">{76}</td>
              <td className="py-2.5 px-2 text-center bg-yellow-500/[0.01] text-yellow-300/80">{header.condicion_agua}</td>
              <td className="py-2.5 px-2 text-center bg-yellow-500/[0.01] font-bold">{calculated.water_rating_76}</td>
              <td className="py-2.5 px-2 text-center bg-yellow-500/[0.01] text-yellow-300/80">{resistLetter}</td>
              <td className="py-2.5 px-2 text-center bg-yellow-500/[0.01] font-bold">{calculated.ucs_rating_76}</td>
              <td className="py-2.5 px-2 text-center bg-indigo-500/[0.01] text-indigo-300">{gsiCond}</td>
              <td className="py-2.5 px-2 text-center bg-indigo-500/[0.01] text-indigo-300">{gsiEstruc}</td>
              <td className="py-2.5 px-2 text-center bg-indigo-500/[0.01] text-indigo-300">{gsiVisual}</td>
              <td className="py-2.5 px-2 text-center bg-navy-900/10 text-slate-300">{ctrl}</td>
              <td className="py-2.5 px-2 text-center bg-navy-900/10 text-slate-300">{vol}</td>
              <td className="py-2.5 px-2 text-center bg-amber-500/[0.01] text-amber-300">{calculated.rqd_rating_76}</td>
              <td className="py-2.5 px-2 text-center bg-amber-500/[0.01] font-mono text-slate-400">{calculated.rqd_est.toFixed(0)}%</td>
              <td className="py-2.5 px-2 text-center bg-sky-500/[0.01] font-mono text-slate-400">{calculated.jv > 0 ? calculated.jv.toFixed(2) : '—'}</td>
              <td className="py-2.5 px-2 text-center bg-sky-500/[0.01] font-mono text-slate-400">{calculated.global_spacing > 0 ? Math.pow(calculated.global_spacing, 3).toFixed(2) : '—'}</td>
              <td className="py-2.5 px-2 text-center bg-sky-500/[0.01] font-mono text-sky-400">{calculated.global_spacing.toFixed(2)}</td>
              <td className="py-2.5 px-2 text-center bg-amber-500/[0.01] text-amber-300">{calculated.spacing_rating_76}</td>
              <td className="py-2.5 px-2 text-center bg-amber-500/[0.01] text-amber-300">{calculated.condicion_rating_76}</td>
              <td className="py-2.5 px-3 text-center font-black text-pink-400 bg-pink-500/15 text-sm">{calculated.rmr_76}</td>
              <td className="py-2.5 px-2 text-center text-slate-400">{ucs}</td>
              <td className="py-2.5 px-2 text-center text-slate-400">{is50}</td>
            </tr>

            {/* Row RMR'89 */}
            <tr className="hover:bg-navy-900/20 border-b border-navy-900/60 transition-colors bg-amber-500/[0.02]">
              <td className="py-2.5 px-3 text-center font-black text-amber-400 bg-amber-500/10 sticky left-0 z-10 w-20 border-r border-navy-900">{89}</td>
              <td className="py-2.5 px-2 text-center bg-yellow-500/[0.01] text-yellow-300/80">{header.condicion_agua}</td>
              <td className="py-2.5 px-2 text-center bg-yellow-500/[0.01] font-bold">{calculated.water_rating_89}</td>
              <td className="py-2.5 px-2 text-center bg-yellow-500/[0.01] text-yellow-300/80">{resistLetter}</td>
              <td className="py-2.5 px-2 text-center bg-yellow-500/[0.01] font-bold">{calculated.ucs_rating_89}</td>
              <td className="py-2.5 px-2 text-center bg-indigo-500/[0.01] text-indigo-300">{gsiCond}</td>
              <td className="py-2.5 px-2 text-center bg-indigo-500/[0.01] text-indigo-300">{gsiEstruc}</td>
              <td className="py-2.5 px-2 text-center bg-indigo-500/[0.01] text-indigo-300">{gsiVisual}</td>
              <td className="py-2.5 px-2 text-center bg-navy-900/10 text-slate-300">{ctrl}</td>
              <td className="py-2.5 px-2 text-center bg-navy-900/10 text-slate-300">{vol}</td>
              <td className="py-2.5 px-2 text-center bg-amber-500/[0.01] text-amber-300">{calculated.rqd_rating_89}</td>
              <td className="py-2.5 px-2 text-center bg-amber-500/[0.01] font-mono text-slate-400">{calculated.rqd_est.toFixed(0)}%</td>
              <td className="py-2.5 px-2 text-center bg-sky-500/[0.01] font-mono text-slate-400">{calculated.jv > 0 ? calculated.jv.toFixed(2) : '—'}</td>
              <td className="py-2.5 px-2 text-center bg-sky-500/[0.01] font-mono text-slate-400">{calculated.global_spacing > 0 ? Math.pow(calculated.global_spacing, 3).toFixed(2) : '—'}</td>
              <td className="py-2.5 px-2 text-center bg-sky-500/[0.01] font-mono text-sky-400">{calculated.global_spacing.toFixed(2)}</td>
              <td className="py-2.5 px-2 text-center bg-amber-500/[0.01] text-amber-300">{calculated.spacing_rating_89}</td>
              <td className="py-2.5 px-2 text-center bg-amber-500/[0.01] text-amber-300">{calculated.condicion_rating_89}</td>
              <td className="py-2.5 px-3 text-center font-black text-amber-400 bg-amber-500/15 text-sm">{calculated.rmr_89}</td>
              <td className="py-2.5 px-2 text-center text-slate-400">{ucs}</td>
              <td className="py-2.5 px-2 text-center text-slate-400">{is50}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5. Formula Breakdown Strip */}
      <div className="p-3 bg-navy-950/60 rounded-lg border border-navy-900 font-mono text-xs text-slate-400 text-left border-l-4 border-indigo-500">
        <strong>Jv</strong> = (1/{p1}) + (1/{p2}) + (1/{p3}) = <strong>{calculated.jv.toFixed(3)}</strong> &nbsp;|&nbsp; <strong>RQD%</strong> = 115 − 3.3 × {calculated.jv.toFixed(2)} = <strong>{calculated.rqd_est.toFixed(1)}%</strong>
      </div>
    </div>
  );
}