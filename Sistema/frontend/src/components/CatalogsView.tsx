import { useState } from 'react';
import { BookOpen, Table } from 'lucide-react';
import {
  STRUCTURE_CATALOG,
  RELLENO_CATALOG,
  ALTERACION_CATALOG,
  FORMA_CATALOG,
  RUGOSIDAD_CATALOG
} from '../utils/catalogData';

export default function CatalogsView() {
  const [activeTab, setActiveTab] = useState<string>('tipos');

  const tabs = [
    { id: 'tipos', label: 'Tipos Estr.' },
    { id: 'abertura', label: 'Abertura' },
    { id: 'continuidad', label: 'Continuidad' },
    { id: 'relleno', label: 'Relleno / Espesor' },
    { id: 'rugosidad', label: 'Rugosidad (1-9)' },
    { id: 'forma', label: 'Forma' },
    { id: 'alteracion', label: 'Meteorización' },
    { id: 'jrc', label: 'JRC' }
  ];

  return (
    <div className="space-y-6 select-none text-left animate-fade-in">
      
      {/* Cabecera de Sección */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center justify-center text-orange-500 shadow-md">
            <BookOpen size={20} />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-black text-slate-100 uppercase tracking-widest">Catálogos de Referencia Geomecánica</h2>
            <p className="text-sm text-slate-400">Guía de parámetros y ratings para clasificaciones RMR'89 y RMR'76 (Bieniawski)</p>
          </div>
        </div>
      </div>

      {/* Selector de pestañas */}
      <div className="flex flex-wrap gap-2 border-b border-navy-800 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all ${
              activeTab === t.id
                ? 'bg-orange-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                : 'bg-navy-900/60 border border-navy-800 text-slate-300 hover:bg-navy-800 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Cuerpo del Catálogo */}
      <div className="glass-panel p-6 rounded-xl border border-navy-800 bg-navy-950/20 min-h-[400px] flex flex-col">
        {activeTab === 'tipos' && (
          <div className="space-y-4">
            <h3 className="text-sm md:text-base font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={16} className="text-orange-500" />
              <span>Tipos de Estructura</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs">
                    <th className="py-3 px-4 w-32 border-b border-navy-900">Código</th>
                    <th className="py-3 px-4 border-b border-navy-900">Descripción Estructura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(STRUCTURE_CATALOG).map(([code, desc]) => (
                    <tr key={code} className="hover:bg-navy-900/20">
                      <td className="py-3 px-4 text-orange-400 font-black">{code}</td>
                      <td className="py-3 px-4">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'abertura' && (
          <div className="space-y-4">
            <h3 className="text-sm md:text-base font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={16} className="text-orange-500" />
              <span>Abertura de Juntas</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-3xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs">
                    <th className="py-3 px-4 border-b border-navy-900">Clase</th>
                    <th className="py-3 px-4 text-center border-b border-navy-900">Rango Abertura (mm)</th>
                    <th className="py-3 px-4 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Rating R89</th>
                    <th className="py-3 px-4 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Rating R76</th>
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
                      <td className="py-3 px-4 font-bold">{item.label}</td>
                      <td className="py-3 px-4 text-center font-mono">{item.range}</td>
                      <td className="py-3 px-4 text-center text-pink-300 bg-pink-950/5 font-black">{item.r89}</td>
                      <td className="py-3 px-4 text-center text-amber-300 bg-amber-950/5 font-black">{item.r76}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'continuidad' && (
          <div className="space-y-4">
            <h3 className="text-sm md:text-base font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={16} className="text-orange-500" />
              <span>Continuidad / Persistencia (m)</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-3xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs">
                    <th className="py-3 px-4 border-b border-navy-900">Rango de Persistencia</th>
                    <th className="py-3 px-4 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Rating R89</th>
                    <th className="py-3 px-4 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Rating R76</th>
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
                      <td className="py-3 px-4 font-bold font-mono">{item.range}</td>
                      <td className="py-3 px-4 text-center text-pink-300 bg-pink-950/5 font-black">{item.r89}</td>
                      <td className="py-3 px-4 text-center text-amber-300 bg-amber-950/5 font-black">{item.r76}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'relleno' && (
          <div className="space-y-4">
            <h3 className="text-sm md:text-base font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={16} className="text-orange-500" />
              <span>Código Relleno y Ratings de Espesor</span>
            </h3>
            <p className="text-sm text-slate-400">El espesor determina si se asigna columna de espesor &lt; 5mm o &gt; 5mm. El puntaje final toma el mínimo de Relleno 1 y Relleno 2.</p>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-sm border-collapse" style={{ minWidth: '900px' }}>
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs">
                    <th className="py-3 px-3 border-b border-navy-900">Relleno</th>
                    <th className="py-3 px-2 text-center border-b border-navy-900">Tipo</th>
                    <th className="py-3 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Sin (89)</th>
                    <th className="py-3 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Duro &lt;5 (89)</th>
                    <th className="py-3 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Duro &gt;5 (89)</th>
                    <th className="py-3 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Blando &lt;5 (89)</th>
                    <th className="py-3 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Blando &gt;5 (89)</th>
                    
                    <th className="py-3 px-2 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Sin (76)</th>
                    <th className="py-3 px-2 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Duro &lt;5 (76)</th>
                    <th className="py-3 px-2 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Duro &gt;5 (76)</th>
                    <th className="py-3 px-2 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Blando &lt;5 (76)</th>
                    <th className="py-3 px-2 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Blando &gt;5 (76)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(RELLENO_CATALOG).map(([code, item]) => {
                    return (
                      <tr key={code} className="hover:bg-navy-900/20">
                        <td className="py-3 px-3 font-bold text-orange-400">{code} - {item.name.replace(/\([^)]+\)/g, '')}</td>
                        <td className="py-3 px-2 text-center text-xs text-slate-400">{item.tipo}</td>
                        <td className="py-3 px-2 text-center text-pink-300 bg-pink-950/5">{item.clase === 3 ? item.rmr89 : ''}</td>
                        <td className="py-3 px-2 text-center text-pink-300 bg-pink-950/5">{item.clase === 2 ? item.rmr89 : ''}</td>
                        <td className="py-3 px-2 text-center text-pink-300 bg-pink-950/5">{item.clase === 2 ? item.rmr89_gt5 : ''}</td>
                        <td className="py-3 px-2 text-center text-pink-300 bg-pink-950/5">{item.clase === 1 ? item.rmr89 : ''}</td>
                        <td className="py-3 px-2 text-center text-pink-300 bg-pink-950/5">{item.clase === 1 ? item.rmr89_gt5 : ''}</td>
                        
                        <td className="py-3 px-2 text-center text-amber-300 bg-amber-950/5">{item.clase === 3 ? item.rmr76 : ''}</td>
                        <td className="py-3 px-2 text-center text-amber-300 bg-amber-950/5">{item.clase === 2 ? item.rmr76 : ''}</td>
                        <td className="py-3 px-2 text-center text-amber-300 bg-amber-950/5">{item.clase === 2 ? item.rmr76_gt5 : ''}</td>
                        <td className="py-3 px-2 text-center text-amber-300 bg-amber-950/5">{item.clase === 1 ? item.rmr76 : ''}</td>
                        <td className="py-3 px-2 text-center text-amber-300 bg-amber-950/5">{item.clase === 1 ? item.rmr76_gt5 : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'rugosidad' && (
          <div className="space-y-4">
            <h3 className="text-sm md:text-base font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={16} className="text-orange-500" />
              <span>Rugosidad Estructural</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-4xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs">
                    <th className="py-3 px-4 border-b border-navy-900 w-16 text-center">Perfil</th>
                    <th className="py-3 px-4 border-b border-navy-900">Descripción Perfil</th>
                    <th className="py-3 px-4 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Rating R89</th>
                    <th className="py-3 px-4 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Rating R76</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(RUGOSIDAD_CATALOG).map(([numStr, item]) => (
                    <tr key={numStr} className="hover:bg-navy-900/20">
                      <td className="py-3 px-4 text-center font-bold text-orange-400">{numStr}</td>
                      <td className="py-3 px-4">{item.desc.replace(/^\d\s*—\s*/, '')}</td>
                      <td className="py-3 px-4 text-center text-pink-300 bg-pink-950/5 font-black">{item.r89}</td>
                      <td className="py-3 px-4 text-center text-amber-300 bg-amber-950/5 font-black">{item.r76}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'forma' && (
          <div className="space-y-4">
            <h3 className="text-sm md:text-base font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={16} className="text-orange-500" />
              <span>Forma de Discontinuidades</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs">
                    <th className="py-3 px-4 w-32 border-b border-navy-900">Código</th>
                    <th className="py-3 px-4 border-b border-navy-900">Descripción Forma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(FORMA_CATALOG).map(([code, desc]) => (
                    <tr key={code} className="hover:bg-navy-900/20">
                      <td className="py-3 px-4 text-orange-400 font-black">{code}</td>
                      <td className="py-3 px-4">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'alteracion' && (
          <div className="space-y-4">
            <h3 className="text-sm md:text-base font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={16} className="text-orange-500" />
              <span>Meteorización / Alteración de Pared</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-4xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs">
                    <th className="py-3 px-4 w-24 border-b border-navy-900">Código</th>
                    <th className="py-3 px-4 border-b border-navy-900">Grado de Meteorización</th>
                    <th className="py-3 px-4 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Rating R89</th>
                    <th className="py-3 px-4 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Rating R76</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(ALTERACION_CATALOG).map(([code, item]) => (
                    <tr key={code} className="hover:bg-navy-900/20">
                      <td className="py-3 px-4 font-black text-orange-400">{code}</td>
                      <td className="py-3 px-4">{item.name.replace(/^[a-z]\s*—\s*/i, '')}</td>
                      <td className="py-3 px-4 text-center text-pink-300 bg-pink-950/5 font-black">{item.r89}</td>
                      <td className="py-3 px-4 text-center text-amber-300 bg-amber-950/5 font-black">{item.r76}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'jrc' && (
          <div className="space-y-4">
            <h3 className="text-sm md:text-base font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={16} className="text-orange-500" />
              <span>Matriz JRC vs Perfil de Rugosidad</span>
            </h3>
            <p className="text-sm text-slate-400">Permite comparar visualmente los coeficientes de rugosidad de junta (JRC) con los perfiles numéricos 1 al 9.</p>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs">
                    <th className="py-3 px-4 border-b border-navy-900">Rango Coeficiente JRC</th>
                    <th className="py-3 px-4 text-center border-b border-navy-900 w-36">N&deg; Perfil Rugosidad</th>
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
                      <td className="py-3 px-4 font-semibold">{item.range}</td>
                      <td className="py-3 px-4 text-center font-bold text-orange-400">{item.profile}</td>
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
