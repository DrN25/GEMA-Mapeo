import { useState } from 'react';
import { Table, Layers, Compass, Flame, AlignLeft } from 'lucide-react';
import {
  STRUCTURE_CATALOG,
  RELLENO_CATALOG,
  ALTERACION_CATALOG,
  FORMA_CATALOG,
  RUGOSIDAD_CATALOG,
  LITHOLOGY_CLASSIFICATION
} from '../utils/catalogData';

export default function CatalogsView() {
  const [activeTab, setActiveTab] = useState<string>('litologia');

  const tabs = [
    { id: 'litologia', label: 'Litología y K' },
    { id: 'tipos', label: 'Tipos Estr.' },
    { id: 'abertura', label: 'Abertura' },
    { id: 'continuidad', label: 'Continuidad' },
    { id: 'relleno', label: 'Relleno / Espesor' },
    { id: 'rugosidad', label: 'Rugosidad (1-9)' },
    { id: 'forma', label: 'Forma' },
    { id: 'alteracion', label: 'Meteorización' },
    { id: 'jrc', label: 'JRC' },
    { id: 'plt_irregulares', label: 'Ensayos PLT Irreg.' } // Nueva Pestaña
  ];

  return (
    <div className="space-y-4 select-none text-left animate-fade-in">
      {/* Selector de pestañas */}
      <div className="flex flex-wrap gap-1.5 border-b border-navy-850 pb-2.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${activeTab === t.id
              ? 'bg-orange-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
              : 'bg-navy-900/60 border border-navy-800 text-slate-300 hover:bg-navy-800 hover:text-white'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Cuerpo del Catálogo */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 min-h-[350px] flex flex-col">

        {/* TABLA DE LITOLOGÍAS */}
        {activeTab === 'litologia' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={14} className="text-orange-500" />
              <span>Tabla de Correlación de Litologías y Factores K (PLT)</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-h-[380px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-navy-950 z-10 border-b border-navy-900">
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Clase / Grupo</th>
                    <th className="py-2.5 px-4">Litología 1 (Lito 1)</th>
                    <th className="py-2.5 px-4">Litología 2 (Lito 2)</th>
                    <th className="py-2.5 px-4">Litología 3 (Lito 3)</th>
                    <th className="py-2.5 px-4 text-center text-cyan-400">Factor K</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {LITHOLOGY_CLASSIFICATION.map((item, idx) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-bold text-slate-400">{item.grupo}</td>
                      <td className="py-2.5 px-4 text-slate-300 font-semibold">{item.unidad}</td>
                      <td className="py-2.5 px-4 text-slate-300">{item.litologia}</td>
                      <td className="py-2.5 px-4 text-slate-300">{item.codigo}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-cyan-400">{item.k.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TABLA DE ENERO / EN GRIS NUEVAS TABLAS DE ENSAYO PLT */}
        {activeTab === 'plt_irregulares' && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">

            {/* 1. Clasificación ISRM */}
            <div className="space-y-2">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-navy-850 pb-1.5 flex items-center gap-1.5">
                <Table size={12} className="text-cyan-400" />
                <span>Clasificación de Resistencia ISRM (UCS)</span>
              </h3>
              <div className="overflow-x-auto rounded-lg border border-navy-900">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-navy-850">
                      <th className="py-2 px-3">Código</th>
                      <th className="py-2 px-3 text-center">UCS Mínimo (MPa)</th>
                      <th className="py-2 px-3 text-center">UCS Máximo (MPa)</th>
                      <th className="py-2 px-3">Denominación ISRM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-900/30 text-slate-300">
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-bold text-rose-400">R0</td>
                      <td className="py-2 px-3 text-center font-mono">0.25</td>
                      <td className="py-2 px-3 text-center font-mono">1.00</td>
                      <td className="py-2 px-3">Extremadamente débil</td>
                    </tr>
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-bold text-orange-400">R1</td>
                      <td className="py-2 px-3 text-center font-mono">1.00</td>
                      <td className="py-2 px-3 text-center font-mono">5.00</td>
                      <td className="py-2 px-3">Muy débil</td>
                    </tr>
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-bold text-amber-400">R2</td>
                      <td className="py-2 px-3 text-center font-mono">5.00</td>
                      <td className="py-2 px-3 text-center font-mono">25.00</td>
                      <td className="py-2 px-3">Débil</td>
                    </tr>
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-bold text-yellow-400">R3</td>
                      <td className="py-2 px-3 text-center font-mono">25.00</td>
                      <td className="py-2 px-3 text-center font-mono">50.00</td>
                      <td className="py-2 px-3">Moderadamente resistente</td>
                    </tr>
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-bold text-emerald-400">R4</td>
                      <td className="py-2 px-3 text-center font-mono">50.00</td>
                      <td className="py-2 px-3 text-center font-mono">100.00</td>
                      <td className="py-2 px-3">Resistente</td>
                    </tr>
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-bold text-cyan-400">R5</td>
                      <td className="py-2 px-3 text-center font-mono">100.00</td>
                      <td className="py-2 px-3 text-center font-mono">250.00</td>
                      <td className="py-2 px-3">Muy resistente</td>
                    </tr>
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-bold text-indigo-400">R6</td>
                      <td className="py-2 px-3 text-center font-mono">250.00</td>
                      <td className="py-2 px-3 text-center font-mono">&gt; 250.00</td>
                      <td className="py-2 px-3">Extremadamente resistente</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Dirección de Rotura */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-navy-850 pb-1.5 flex items-center gap-1.5">
                  <Compass size={12} className="text-emerald-400" />
                  <span>Dirección de Rotura (ISRM)</span>
                </h3>
                <div className="overflow-x-auto rounded-lg border border-navy-900">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-navy-850">
                        <th className="py-2 px-3">Sigla</th>
                        <th className="py-2 px-3">Descripción Geológica</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-900/30 text-slate-300">
                      <tr className="hover:bg-navy-900/20">
                        <td className="py-2 px-3 font-bold text-emerald-400">Pa</td>
                        <td className="py-2 px-3">Paralela a los planos de debilidad (estratificación, foliación)</td>
                      </tr>
                      <tr className="hover:bg-navy-900/20">
                        <td className="py-2 px-3 font-bold text-emerald-400">Pe</td>
                        <td className="py-2 px-3">Perpendicular a los planos de debilidad (estratificación, foliación)</td>
                      </tr>
                      <tr className="hover:bg-navy-900/20">
                        <td className="py-2 px-3 font-bold text-emerald-400">NA</td>
                        <td className="py-2 px-3">No aplica (rocas masivas sin planos de debilidad)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Tipo de Fractura */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-navy-850 pb-1.5 flex items-center gap-1.5">
                  <Flame size={12} className="text-indigo-400" />
                  <span>Tipo de Fractura / Rotura</span>
                </h3>
                <div className="overflow-x-auto rounded-lg border border-navy-900">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-navy-850">
                        <th className="py-2 px-3">Tipo</th>
                        <th className="py-2 px-3">Criterio de Aceptación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-900/30 text-slate-300">
                      <tr className="hover:bg-navy-900/20">
                        <td className="py-2 px-3 font-bold text-indigo-400">M</td>
                        <td className="py-2 px-3">Rotura por matriz. Si la muestra no se rompe se considera M.</td>
                      </tr>
                      <tr className="hover:bg-navy-900/20">
                        <td className="py-2 px-3 font-bold text-indigo-400">E</td>
                        <td className="py-2 px-3">Rotura por estructura preexistente.</td>
                      </tr>
                      <tr className="hover:bg-navy-900/20">
                        <td className="py-2 px-3 font-bold text-indigo-400">C</td>
                        <td className="py-2 px-3">Rotura combinada (por matriz y estructura en simultáneo).</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 4. Escala de Resistencia RMR Bieniawski */}
            <div className="space-y-2">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-navy-850 pb-1.5 flex items-center gap-1.5">
                <AlignLeft size={12} className="text-amber-400" />
                <span>Valoración de Resistencia de la Roca Intacta (RMR)</span>
              </h3>
              <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-navy-850">
                      <th className="py-2 px-3">Rango de Resistencia UCS (MPa)</th>
                      <th className="py-2 px-3 text-center">Rating RMR'89</th>
                      <th className="py-2 px-3 text-center">Rating RMR'76</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-900/30 text-slate-300">
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-semibold">&gt; 250 MPa</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">15</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">10</td>
                    </tr>
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-semibold">100 - 250 MPa</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">12</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">8</td>
                    </tr>
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-semibold">50 - 100 MPa</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">7</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">5</td>
                    </tr>
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-semibold">25 - 50 MPa</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">4</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">2</td>
                    </tr>
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-semibold">5 - 25 MPa</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">2</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">1</td>
                    </tr>
                    <tr className="hover:bg-navy-900/20">
                      <td className="py-2 px-3 font-semibold">1 - 5 MPa</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">1</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ... TABLAS RESTANTES (tipos, abertura, continuidad, etc) ... */}
        {activeTab === 'tipos' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={14} className="text-orange-500" />
              <span>Tipos de Estructura</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 w-32 border-b border-navy-900">Código</th>
                    <th className="py-2.5 px-4 border-b border-navy-900">Descripción Estructura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(STRUCTURE_CATALOG).map(([code, desc]) => (
                    <tr key={code} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 text-orange-400 font-black">{code}</td>
                      <td className="py-2.5 px-4">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'abertura' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={14} className="text-orange-500" />
              <span>Abertura de Juntas</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-3xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 border-b border-navy-900">Clase</th>
                    <th className="py-2.5 px-4 text-center border-b border-navy-900">Rango Abertura (mm)</th>
                    <th className="py-2.5 px-4 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Rating R89</th>
                    <th className="py-2.5 px-4 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Rating R76</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {[
                    { label: "Masiva", range: "0 mm", r89: 6, r76: 5 },
                    { label: "Entre Abierta", range: "< 0.1 mm", r89: 5, r76: 4 },
                    { label: "Abierta", range: "0.1 - 1.0 mm", r89: 3, r76: 3 },
                    { label: "Muy Abierta", range: "1.0 - 5.0 mm", r89: 1, r76: 1 },
                    { label: "Extremadamente Abierta", range: "> 5.0 mm", r89: 0, r76: 0 }
                  ].map((item, idx) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-bold">{item.label}</td>
                      <td className="py-2.5 px-4 text-center font-mono">{item.range}</td>
                      <td className="py-2.5 px-4 text-center text-pink-300 bg-pink-950/5 font-black">{item.r89}</td>
                      <td className="py-2.5 px-4 text-center text-amber-300 bg-amber-950/5 font-black">{item.r76}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'continuidad' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={14} className="text-orange-500" />
              <span>Continuidad / Persistencia (m)</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-3xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 border-b border-navy-900">Rango de Persistencia</th>
                    <th className="py-2.5 px-4 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Rating R89</th>
                    <th className="py-2.5 px-4 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Rating R76</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {[
                    { range: "< 1 m", r89: 6, r76: 5 },
                    { range: "1 - 3 m", r89: 4, r76: 4 },
                    { range: "3 - 10 m", r89: 2, r76: 3 },
                    { range: "10 - 20 m", r89: 1, r76: 1 },
                    { range: "> 20 m", r89: 0, r76: 0 }
                  ].map((item, idx) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-bold font-mono">{item.range}</td>
                      <td className="py-2.5 px-4 text-center text-pink-300 bg-pink-950/5 font-black">{item.r89}</td>
                      <td className="py-2.5 px-4 text-center text-amber-300 bg-amber-950/5 font-black">{item.r76}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'relleno' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={14} className="text-orange-500" />
              <span>Código Relleno y Ratings de Espesor</span>
            </h3>
            <p className="text-xs text-slate-400">El espesor determina si se asigna columna de espesor &lt; 5mm o &gt; 5mm.</p>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-xs border-collapse" style={{ minWidth: '900px' }}>
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 border-b border-navy-900">Relleno</th>
                    <th className="py-2.5 px-2 text-center border-b border-navy-900">Tipo</th>
                    <th className="py-2.5 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Sin (89)</th>
                    <th className="py-2.5 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Duro &lt;5 (89)</th>
                    <th className="py-2.5 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Duro &gt;5 (89)</th>
                    <th className="py-2.5 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Blando &lt;5 (89)</th>
                    <th className="py-2.5 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Blando &gt;5 (89)</th>
                    <th className="py-2.5 px-2 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Sin (76)</th>
                    <th className="py-2.5 px-2 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Duro &lt;5 (76)</th>
                    <th className="py-2.5 px-2 text-center text-amber-300 bg-amber-950/5">Sin relleno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(RELLENO_CATALOG).map(([code, item]) => {
                    return (
                      <tr key={code} className="hover:bg-navy-900/20">
                        <td className="py-2.5 px-3 font-bold text-orange-400">{code} - {item.name.replace(/\([^)]+\)/g, '')}</td>
                        <td className="py-2.5 px-2 text-center text-[10px] text-slate-400">{item.tipo}</td>
                        <td className="py-2.5 px-2 text-center text-pink-300 bg-pink-950/5">{item.clase === 3 ? item.rmr89 : ''}</td>
                        <td className="py-2.5 px-2 text-center text-pink-300 bg-pink-950/5">{item.clase === 2 ? item.rmr89 : ''}</td>
                        <td className="py-2.5 px-2 text-center text-pink-300 bg-pink-950/5">{item.clase === 2 ? item.rmr89_gt5 : ''}</td>
                        <td className="py-2.5 px-2 text-center text-pink-300 bg-pink-950/5">{item.clase === 1 ? item.rmr89 : ''}</td>
                        <td className="py-2.5 px-2 text-center text-pink-300 bg-pink-950/5">{item.clase === 1 ? item.rmr89_gt5 : ''}</td>
                        <td className="py-2.5 px-2 text-center text-amber-300 bg-amber-950/5">{item.clase === 3 ? item.rmr76 : ''}</td>
                        <td className="py-2.5 px-2 text-center text-amber-300 bg-amber-950/5">{item.clase === 2 ? item.rmr76 : ''}</td>
                        <td className="py-2.5 px-2 text-center text-amber-300 bg-amber-950/5">{item.clase === 2 ? item.rmr76_gt5 : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ... RESTO DE CASOS ... */}
        {activeTab === 'rugosidad' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={14} className="text-orange-500" />
              <span>Rugosidad Estructural</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-4xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 border-b border-navy-900 w-16 text-center">Perfil</th>
                    <th className="py-2.5 px-4 border-b border-navy-900">Descripción Perfil</th>
                    <th className="py-2.5 px-4 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Rating R89</th>
                    <th className="py-2.5 px-4 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Rating R76</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(RUGOSIDAD_CATALOG).map(([numStr, item]) => (
                    <tr key={numStr} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 text-center font-bold text-orange-400">{numStr}</td>
                      <td className="py-2.5 px-4">{item.desc.replace(/^\d\s*—\s*/, '')}</td>
                      <td className="py-2.5 px-4 text-center text-pink-300 bg-pink-950/5 font-black">{item.r89}</td>
                      <td className="py-2.5 px-4 text-center text-amber-300 bg-amber-950/5 font-black">{item.r76}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'forma' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={14} className="text-orange-500" />
              <span>Forma de Discontinuidades</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 w-32 border-b border-navy-900">Código</th>
                    <th className="py-2.5 px-4 border-b border-navy-900">Descripción Forma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(FORMA_CATALOG).map(([code, desc]) => (
                    <tr key={code} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 text-orange-400 font-black">{code}</td>
                      <td className="py-2.5 px-4">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'alteracion' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={14} className="text-orange-500" />
              <span>Meteorización / Alteración de Pared</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-4xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 border-b border-navy-900">Código</th>
                    <th className="py-2.5 px-4 border-b border-navy-900">Grado de Meteorización</th>
                    <th className="py-2.5 px-4 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Rating R89</th>
                    <th className="py-2.5 px-4 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Rating R76</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(ALTERACION_CATALOG).map(([code, item]) => (
                    <tr key={code} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-black text-orange-400">{code}</td>
                      <td className="py-2.5 px-4">{item.name.replace(/^[a-z]\s*—\s*/i, '')}</td>
                      <td className="py-2.5 px-4 text-center text-pink-300 bg-pink-950/5 font-black">{item.r89}</td>
                      <td className="py-2.5 px-4 text-center text-amber-300 bg-amber-950/5 font-black">{item.r76}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'jrc' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={14} className="text-orange-500" />
              <span>Matriz JRC vs Perfil de Rugosidad</span>
            </h3>
            <p className="text-xs text-slate-400">Coeficientes de rugosidad de junta (JRC) vs perfiles del 1 al 9.</p>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 border-b border-navy-900">Rango Coeficiente JRC</th>
                    <th className="py-2.5 px-4 text-center border-b border-navy-900 w-36">N&deg; Perfil Rugosidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {[
                    { range: "0 - 2", profile: 9 },
                    { range: "2 - 4", profile: 8 },
                    { range: "4 - 6", profile: 7 },
                    { range: "6 - 8", profile: 6 },
                    { range: "8 - 10", profile: 5 },
                    { range: "10 - 12", profile: 4 },
                    { range: "12 - 14", profile: 3 },
                    { range: "14 - 16", profile: 2 },
                    { range: "16 - 18", profile: 1 },
                    { range: "18 - 20", profile: 1 }
                  ].map((item, idx) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-semibold">{item.range}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-orange-400">{item.profile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}