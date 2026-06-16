import type { CalculatorResult } from '../utils/rmrCalculator';
import { ShieldCheck, Compass, AlertCircle } from 'lucide-react';
import {
  STRUCTURE_CATALOG,
  ALTERACION_CATALOG,
  RELLENO_CATALOG
} from '../utils/catalogData';

interface RmrAnalysisProps {
  calculated: CalculatorResult | null;
  condicionAgua: string;
  resistenciaUcs: string;
}

export default function RmrAnalysis({
  calculated,
  condicionAgua,
  resistenciaUcs
}: RmrAnalysisProps) {
  if (!calculated) {
    return (
      <div className="glass-panel p-8 rounded-xl border border-navy-800 text-center text-slate-500 space-y-2">
        <AlertCircle className="mx-auto text-slate-600" size={32} />
        <p className="text-xs">No hay datos de mapeo disponibles para analizar. Registre discontinuidades en la ventana.</p>
      </div>
    );
  }

  const getRmrClassBadge = (rmr: number, classStr: string) => {
    let colors = 'bg-red-500/10 text-red-400 border border-red-500/20';
    if (rmr >= 81) colors = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]';
    else if (rmr >= 61) colors = 'bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)]';
    else if (rmr >= 41) colors = 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
    else if (rmr >= 21) colors = 'bg-orange-500/10 text-orange-400 border border-orange-500/20';

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${colors}`}>
        Clase {classStr} ({rmr} Pts)
      </span>
    );
  };

  return (
    <div className="space-y-6 select-none text-left">
      {/* 1. TOP CARDS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">RQD Estimado (Palmström)</span>
          <span className="text-3xl font-black text-amber-400 tracking-tight mt-1">{calculated.rqd_est.toFixed(1)}%</span>
          <span className="text-xs text-slate-500 mt-1">Calculado de Jv: {calculated.jv.toFixed(2)} juntas/m³</span>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Espaciamiento Prom. Global</span>
          <span className="text-3xl font-black text-purple-400 tracking-tight mt-1">{(calculated.global_spacing * 1000).toFixed(0)} mm</span>
          <span className="text-xs text-slate-500 mt-1">Promedio de discontinuidades registradas</span>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-gradient-to-br from-orange-500/5 to-amber-500/5 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Puntaje RMR R76</span>
          <span className="text-3xl font-black text-orange-400 tracking-tight mt-1">{calculated.rmr_76} Pts</span>
          <div className="mt-2">{getRmrClassBadge(calculated.rmr_76, calculated.class_76)}</div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-gradient-to-br from-emerald-500/5 to-orange-500/5 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Puntaje RMR R89</span>
          <span className="text-3xl font-black text-emerald-400 tracking-tight mt-1">{calculated.rmr_89} Pts</span>
          <div className="mt-2">{getRmrClassBadge(calculated.rmr_89, calculated.class_89)}</div>
        </div>
      </div>

      {/* 2. RMR'76 vs RMR'89 PARAMETERS BREAKDOWN */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4">
        <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest border-b border-navy-800/60 pb-2 flex items-center gap-2">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Desglose de Parámetros RMR (Bieniawski)</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-navy-850">
                <th className="py-2.5 px-3">Parámetro / Propiedad</th>
                <th className="py-2.5 px-3 text-center">Valor / Entrada</th>
                <th className="py-2.5 px-3 text-center text-amber-400">RMR '76 Pts</th>
                <th className="py-2.5 px-3 text-center text-emerald-400">RMR '89 Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-900/60 font-semibold text-slate-300">
              <tr>
                <td className="py-2 px-3">1. Resistencia Compresión Uniaxial (UCS)</td>
                <td className="py-2 px-3 text-center text-slate-400">{resistenciaUcs}</td>
                <td className="py-2 px-3 text-center">{calculated.ucs_rating_76}</td>
                <td className="py-2 px-3 text-center">{calculated.ucs_rating_89}</td>
              </tr>
              <tr>
                <td className="py-2 px-3">2. Índice RQD</td>
                <td className="py-2 px-3 text-center text-slate-400">{calculated.rqd_est.toFixed(1)} %</td>
                <td className="py-2 px-3 text-center">{calculated.rqd_rating_76}</td>
                <td className="py-2 px-3 text-center">{calculated.rqd_rating_89}</td>
              </tr>
              <tr>
                <td className="py-2 px-3">3. Espaciamiento de Juntas</td>
                <td className="py-2 px-3 text-center text-slate-400">{(calculated.global_spacing * 1000).toFixed(0)} mm</td>
                <td className="py-2 px-3 text-center">{calculated.spacing_rating_76}</td>
                <td className="py-2 px-3 text-center">{calculated.spacing_rating_89}</td>
              </tr>
              <tr>
                <td className="py-2 px-3">4. Condición de Discontinuidades (Promedio)</td>
                <td className="py-2 px-3 text-center text-slate-400">Ponderado por Cantidad</td>
                <td className="py-2 px-3 text-center font-bold text-amber-400">{calculated.condicion_rating_76}</td>
                <td className="py-2 px-3 text-center font-bold text-emerald-400">{calculated.condicion_rating_89}</td>
              </tr>
              <tr>
                <td className="py-2 px-3">5. Presencia de Agua Subterránea</td>
                <td className="py-2 px-3 text-center text-slate-400">Condición: {condicionAgua}</td>
                <td className="py-2 px-3 text-center">{calculated.water_rating_76}</td>
                <td className="py-2 px-3 text-center">{calculated.water_rating_89}</td>
              </tr>
              <tr className="bg-navy-950 font-black text-slate-100 text-sm">
                <td className="py-3 px-3 uppercase text-xs">Puntaje RMR Total</td>
                <td className="py-3 px-3 text-center">Final</td>
                <td className="py-3 px-3 text-center text-amber-400">{calculated.rmr_76}</td>
                <td className="py-3 px-3 text-center text-emerald-400">{calculated.rmr_89}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. STRUCTURAL DETAILS BREAKDOWN */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4">
        <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest border-b border-navy-800/60 pb-2 flex items-center gap-2">
          <Compass size={14} className="text-purple-400" />
          <span>Detalle de Estructuras y Ratings de Junta Individuales (R89)</span>
        </h3>

        <div className="overflow-x-auto max-h-[350px] relative rounded-lg border border-navy-900 bg-navy-950/40">
          <table className="w-full text-left border-collapse text-xs border-separate" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-navy-850">
                <th className="py-2.5 px-2 text-center sticky left-0 bg-navy-950 z-10 w-10">ID</th>
                <th className="py-2.5 px-2 text-center sticky left-10 bg-navy-950 z-10 w-16">Dist (m)</th>
                <th className="py-2.5 px-2">Tipo</th>
                <th className="py-2.5 px-2 text-center">Dip/DipDir</th>
                <th className="py-2.5 px-2 text-center text-purple-400">Alteración</th>
                <th className="py-2.5 px-2 text-center text-purple-400">Relleno</th>
                <th className="py-2.5 px-2 text-center text-purple-400">Persistencia</th>
                <th className="py-2.5 px-2 text-center text-purple-400">Abertura</th>
                <th className="py-2.5 px-2 text-center text-purple-400">Rugosidad</th>
                <th className="py-2.5 px-2 text-center text-emerald-400 font-bold">Total Cond R89</th>
                <th className="py-2.5 px-3">UTM X (E)</th>
                <th className="py-2.5 px-3">UTM Y (N)</th>
                <th className="py-2.5 px-3">UTM Z (Cota)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-900/60 font-semibold text-slate-300">
              {calculated.joints.map((cj, idx) => (
                <tr key={idx} className="hover:bg-navy-900/10">
                  <td className="py-2.5 px-2 text-center font-bold text-slate-400 sticky left-0 bg-navy-950">{cj.row.id}</td>
                  <td className="py-2.5 px-2 text-center sticky left-10 bg-navy-950 text-slate-100 font-semibold">{cj.row.distancia?.toFixed(2) ?? '—'}</td>
                  <td className="py-2.5 px-2 font-bold text-amber-400">{STRUCTURE_CATALOG[cj.row.tipo_estructura] || cj.row.tipo_estructura}</td>
                  <td className="py-2.5 px-2 text-center">{cj.row.dip}&deg; / {cj.row.dip_dir}&deg;</td>
                  <td className="py-2.5 px-2 text-center" title={ALTERACION_CATALOG[cj.row.alteracion]?.name}>{cj.alteracion_89}</td>
                  <td className="py-2.5 px-2 text-center" title={RELLENO_CATALOG[cj.row.relleno1]?.name}>{cj.relleno_89}</td>
                  <td className="py-2.5 px-2 text-center">{cj.continuidad_89}</td>
                  <td className="py-2.5 px-2 text-center">{cj.abertura_89}</td>
                  <td className="py-2.5 px-2 text-center">{cj.rugosidad_89}</td>
                  <td className="py-2.5 px-2 text-center text-emerald-400 font-black">{cj.total_condicion_89}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-400">{cj.x.toFixed(2)}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-400">{cj.y.toFixed(2)}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-400">{cj.z.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
