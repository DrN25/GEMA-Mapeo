import { useState } from 'react';
import {
  Table, Layers, Compass, Flame, AlignLeft, Droplet,
  Shield, Zap, Sparkles, Sliders, Maximize2, MoveRight,
  Database, GitBranch, ArrowRightLeft, Activity
} from 'lucide-react';
import {
  STRUCTURE_CATALOG,
  RELLENO_CATALOG,
  ALTERACION_CATALOG,
  FORMA_CATALOG,
  RUGOSIDAD_CATALOG,
  LITHOLOGY_CLASSIFICATION
} from '../utils/catalogData';

// --- DATASETS OFICIALES UNIFICADOS Y REVISADOS CON LLAVES ALINEADAS ---

const AGUA_DATA = [
  { desc: "Completamente seco", codigo: "C", r76: 10, r89: 15 },
  { desc: "Húmedo", codigo: "H", r76: 10, r89: 10 },
  { desc: "Mojado", codigo: "M", r76: 7, r89: 7 },
  { desc: "Goteando", codigo: "E", r76: 4, r89: 4 },
  { desc: "Fluyendo", codigo: "F", r76: 0, r89: 0 }
];

const RESISTENCIA_DATA = [
  { codigo: "R6", rango: "> 250", r76: 15, r89: 15, denom: "Extremadamente resistente" },
  { codigo: "R5", rango: "100 - 250", r76: 12, r89: 12, denom: "Muy resistente" },
  { codigo: "R4", rango: "50 - 100", r76: 7, r89: 7, denom: "Resistente" },
  { codigo: "R3", rango: "25 - 50", r76: 4, r89: 4, denom: "Moderadamente resistente" },
  { codigo: "R2", rango: "5 - 25", r76: 2, r89: 2, denom: "Débil" },
  { codigo: "R1", rango: "1 - 5", r76: 1, r89: 1, denom: "Muy débil" },
  { codigo: "R0", rango: "< 1", r76: 0, r89: 0, denom: "Extremadamente débil" }
];

const CONTROL_ESTRUCTURAL_DATA = [
  { val: 1, clas: "Ninguno", desc: "No hay discontinuidades aparentes, o no hay discontinuidades que influyan la estabilidad del banco" },
  { val: 2, clas: "Debil", desc: "Uno a tres conjuntos de estructuras que son discontinuas y/o tienen una orientacion" },
  { val: 3, clas: "Moderado", desc: "Las discontinuidades forman inestabilidades pequeñas y discontinuidades, del" },
  { val: 4, clas: "Fuerte", desc: "Las discontinuidades estan bien desarrolladas y forman deslizamientos tipo" },
  { val: 5, clas: "Muy Fuerte", desc: "Las discontinuidades estan bien desarrolladas y forman deslizamientos planos o cuñas de igual altura del banco. La cara del banco se sobrequiebra al angulo aparente del mecanismo de control." }
];

const EFECTOS_VOLADURA_DATA = [
  { val: 1, clas: "Ninguno", desc: "No hay efectos visibles." },
  { val: 2, clas: "Debil", desc: "Hay fracturamiento menor y sobrequiebre del area de la cresta por efecto de la voladura. Pocas fracturas nuevas y abiertas." },
  { val: 3, clas: "Moderado", desc: "Varias fracturas irregulares en la cara de banco. Las juntas y fracturas estan abiertas < 10 mm." },
  { val: 5, clas: "Fuerte", desc: "Varias fracturas abiertas. Las juntas y fracturas estan abiertas hasta 20 mm. La cresta del banco está suelta y existe sobrequiebre por efectos de la voladura." },
  { val: 6, clas: "Muy Fuerte", desc: "Muchas fracturas abiertas y fracturas concoidales por efecto de la voladura. La cresta esta fracturada intensamente. Diaclasa y fracturas abiertas > 20mm." }
];

const RQD_DATA_LIST = [
  { rango: "< 25 %", r76: 3, r89: 3, calidad: "Muy Mala" },
  { rango: "25 - 50 %", r76: 8, r89: 8, calidad: "Mala" },
  { rango: "50 - 75 %", r76: 13, r89: 13, calidad: "Regular" },
  { rango: "75 - 90 %", r76: 17, r89: 17, calidad: "Buena" },
  { rango: "90 - 100 %", r76: 20, r89: 20, calidad: "Excelente" }
];

const ESPACIAMIENTO_DATA_LIST = [
  { r89_range: "< 60 mm", r89_rating: 5, r76_range: "< 50 mm", r76_rating: 5 },
  { r89_range: "60 - 200 mm", r89_rating: 8, r76_range: "50 - 300 mm", r76_rating: 10 },
  { r89_range: "200 - 600 mm", r89_rating: 10, r76_range: "300 - 1000 mm", r76_rating: 20 },
  { r89_range: "600 - 2000 mm", r89_rating: 15, r76_range: "1000 - 3000 mm", r76_rating: 25 },
  { r89_range: "> 2000 mm", r89_rating: 20, r76_range: "> 3000 mm", r76_rating: 30 }
];

export default function CatalogsView() {
  const [activeTab, setActiveTab] = useState<string>('litologia');

  const groups = [
    {
      title: 'Roca Intacta & Litología',
      items: [
        { id: 'litologia', label: 'Litología y K', icon: Layers },
        { id: 'resistencia', label: 'Resistencia ISRM', icon: Shield },
        { id: 'plt_irregulares', label: 'Ensayos PLT', icon: Activity }
      ]
    },
    {
      title: 'Parámetros RMR',
      items: [
        { id: 'rqd', label: 'RQD %', icon: Sliders },
        { id: 'espaciamiento', label: 'Espaciamiento', icon: MoveRight },
        { id: 'agua', label: 'Condición Agua', icon: Droplet },
        { id: 'alteracion', label: 'Meteorización', icon: Flame }
      ]
    },
    {
      title: 'Discontinuidades & Estructura',
      items: [
        { id: 'tipos', label: 'Tipos Estr.', icon: GitBranch },
        { id: 'abertura', label: 'Abertura', icon: Maximize2 },
        { id: 'continuidad', label: 'Continuidad', icon: ArrowRightLeft },
        { id: 'relleno', label: 'Relleno / Espesor', icon: Database },
        { id: 'rugosidad', label: 'Rugosidad (1-9)', icon: Flame },
        { id: 'forma', label: 'Forma', icon: Compass },
        { id: 'jrc', label: 'JRC', icon: Table }
      ]
    },
    {
      title: 'Efectos de Contorno',
      items: [
        { id: 'control', label: 'Control Estruc.', icon: Zap },
        { id: 'voladura', label: 'Efectos Voladura', icon: Sparkles }
      ]
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 select-none text-left animate-fade-in h-[75vh]">
      {/* Barra lateral de navegación categórica */}
      <div className="md:col-span-1 border-r border-navy-850/80 pr-4 space-y-5 overflow-y-auto max-h-[70vh] scrollbar-thin">
        {groups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1.5">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">
              {group.title}
            </h4>
            <div className="flex flex-col gap-1">
              {group.items.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${isActive
                      ? 'bg-orange-500 text-slate-950 font-black shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : 'bg-transparent text-slate-400 hover:bg-navy-900/40 hover:text-white'
                      }`}
                  >
                    <Icon size={13} className={isActive ? 'text-slate-950' : 'text-slate-500'} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Contenedor principal de visualización de tablas */}
      <div className="md:col-span-3 overflow-y-auto max-h-[70vh] pr-1 space-y-4 scrollbar-thin">

        {/* 1. LITOLOGÍAS */}
        {activeTab === 'litologia' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Layers size={14} className="text-orange-500" />
              <span>Tabla de Correlación de Litologías y Factores K (PLT)</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-h-[50vh]">
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

        {/* 2. CONDICIÓN DE AGUA */}
        {activeTab === 'agua' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Droplet size={14} className="text-orange-500" />
              <span>Tabla de Condición de Agua Subterránea</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-navy-950 border-b border-navy-900">
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Condición</th>
                    <th className="py-2.5 px-4 text-center">Código</th>
                    <th className="py-2.5 px-4 text-center text-amber-400">Rating 76</th>
                    <th className="py-2.5 px-4 text-center text-pink-400">Rating 89</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {AGUA_DATA.map((item, idx) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 capitalize">{item.desc}</td>
                      <td className="py-2.5 px-4 text-center font-black text-orange-400">{item.codigo}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-amber-300">{item.r76}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-pink-300">{item.r89}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. RESISTENCIA ISRM */}
        {activeTab === 'resistencia' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
                <Shield size={14} className="text-orange-500" />
                <span>Resistencia de la Roca Intacta</span>
              </h3>
              <div className="overflow-x-auto rounded-lg border border-navy-900">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-navy-950 border-b border-navy-900">
                    <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-4">Resistencia</th>
                      <th className="py-2.5 px-4">Rango MPa</th>
                      <th className="py-2.5 px-4">Denominación ISRM</th>
                      <th className="py-2.5 px-4 text-center text-amber-400">Rating 76</th>
                      <th className="py-2.5 px-4 text-center text-pink-400">Rating 89</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                    {RESISTENCIA_DATA.map((item, idx) => (
                      <tr key={idx} className="hover:bg-navy-900/20">
                        <td className="py-2.5 px-4 font-black text-orange-400">{item.codigo}</td>
                        <td className="py-2.5 px-4 font-mono">{item.rango}</td>
                        <td className="py-2.5 px-4">{item.denom}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-amber-300">{item.r76}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-pink-300">{item.r89}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. CONTROL ESTRUCTURAL */}
        {activeTab === 'control' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Zap size={14} className="text-orange-500" />
              <span>Control Estructural</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-navy-950 border-b border-navy-900">
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 text-center">Valor</th>
                    <th className="py-2.5 px-4">Clasificación</th>
                    <th className="py-2.5 px-4">Descripción de Inestabilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {CONTROL_ESTRUCTURAL_DATA.map((item, idx) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 text-center font-black text-orange-400">{item.val}</td>
                      <td className="py-2.5 px-4 font-extrabold">{item.clas}</td>
                      <td className="py-2.5 px-4 leading-relaxed text-slate-300">{item.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. EFECTOS DE VOLADURA */}
        {activeTab === 'voladura' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-orange-500" />
              <span>Efectos de Voladura</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-navy-950 border-b border-navy-900">
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 text-center">Valor</th>
                    <th className="py-2.5 px-4">Clasificación</th>
                    <th className="py-2.5 px-4">Daño en Crestas / Diaclasas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {EFECTOS_VOLADURA_DATA.map((item, idx) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 text-center font-black text-orange-400">{item.val}</td>
                      <td className="py-2.5 px-4 font-extrabold">{item.clas}</td>
                      <td className="py-2.5 px-4 leading-relaxed text-slate-300">{item.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. RQD % */}
        {activeTab === 'rqd' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Sliders size={14} className="text-orange-500" />
              <span>RQD % (Ratings de Calidad)</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-navy-950 border-b border-navy-900">
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Rango (%)</th>
                    <th className="py-2.5 px-4 text-center text-amber-400">Rating 76</th>
                    <th className="py-2.5 px-4 text-center text-pink-400">Rating 89</th>
                    <th className="py-2.5 px-4">Calidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {RQD_DATA_LIST.map((item, idx) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-mono font-bold">{item.rango}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-amber-300">{item.r76}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-pink-300">{item.r89}</td>
                      <td className="py-2.5 px-4 text-slate-300">{item.calidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. ESPACIAMIENTO */}
        {activeTab === 'espaciamiento' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={14} className="text-orange-500" />
              <span>Ratings de Espaciamiento de Discontinuidades</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-navy-950 border-b border-navy-900">
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Rango RMR89</th>
                    <th className="py-2.5 px-4 text-center text-pink-400">Rating 89</th>
                    <th className="py-2.5 px-4">Rango RMR76</th>
                    <th className="py-2.5 px-4 text-center text-amber-400">Rating 76</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {ESPACIAMIENTO_DATA_LIST.map((item, idx) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-mono">{item.r89_range}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-pink-300">{item.r89_rating}</td>
                      <td className="py-2.5 px-4 font-mono">{item.r76_range}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-amber-300">{item.r76_rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TIPOS DE ESTRUCTURA */}
        {activeTab === 'tipos' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <GitBranch size={14} className="text-orange-500" />
              <span>Tipos de Estructura</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Código</th>
                    <th className="py-2.5 px-4">Descripción Estructura</th>
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

        {/* ABERTURA */}
        {activeTab === 'abertura' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Maximize2 size={14} className="text-orange-500" />
              <span>Abertura de Juntas</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Clase</th>
                    <th className="py-2.5 px-4 text-center">Rango Abertura (mm)</th>
                    <th className="py-2.5 px-4 text-center text-pink-400">Rating R89</th>
                    <th className="py-2.5 px-4 text-center text-amber-400">Rating R76</th>
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
                      <td className="py-2.5 px-4 text-center text-pink-300 font-black">{item.r89}</td>
                      <td className="py-2.5 px-4 text-center text-amber-300 font-black">{item.r76}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTINUIDAD */}
        {activeTab === 'continuidad' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <ArrowRightLeft size={14} className="text-orange-500" />
              <span>Continuidad / Persistencia (m)</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Rango de Persistencia</th>
                    <th className="py-2.5 px-4 text-center text-pink-400">Rating R89</th>
                    <th className="py-2.5 px-4 text-center text-amber-400">Rating R76</th>
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
                      <td className="py-2.5 px-4 text-center text-pink-300 font-black">{item.r89}</td>
                      <td className="py-2.5 px-4 text-center text-amber-300 font-black">{item.r76}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RELLENO / ESPESOR */}
        {activeTab === 'relleno' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Database size={14} className="text-orange-500" />
              <span>Código Relleno y Ratings de Espesor</span>
            </h3>
            <p className="text-xs text-slate-400 font-semibold">El espesor de relleno determina si se asigna columna de espesor &lt; 5mm o &ge; 5mm en tus ratings.</p>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-xs border-collapse" style={{ minWidth: '950px' }}>
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 border-b border-navy-900">Relleno</th>
                    <th className="py-2.5 px-2 text-center border-b border-navy-900">Tipo</th>
                    <th className="py-2.5 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Sin (89)</th>
                    <th className="py-2.5 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Duro &lt;5 (89)</th>
                    <th className="py-2.5 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Duro &ge;5 (89)</th>
                    <th className="py-2.5 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Blando &lt;5 (89)</th>
                    <th className="py-2.5 px-2 text-center text-pink-400 bg-pink-950/10 border-b border-navy-900">Blando &ge;5 (89)</th>
                    <th className="py-2.5 px-2 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Sin (76)</th>
                    <th className="py-2.5 px-2 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Duro &lt;5 (76)</th>
                    <th className="py-2.5 px-2 text-center text-amber-400 bg-amber-950/10 border-b border-navy-900">Duro &ge;5 (76)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(RELLENO_CATALOG).map(([code, item]) => (
                    <tr key={code} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-3 font-bold text-orange-400">{code} - {item.name.replace(/\([^)]+\)/g, '')}</td>
                      <td className="py-2.5 px-2 text-center text-[10px] text-slate-400 font-semibold">{item.tipo}</td>
                      <td className="py-2.5 px-2 text-center text-pink-300 font-mono">{item.clase === 3 ? item.rmr89 : '—'}</td>
                      <td className="py-2.5 px-2 text-center text-pink-300 font-mono">{item.clase === 2 ? item.rmr89 : '—'}</td>
                      <td className="py-2.5 px-2 text-center text-pink-300 font-mono">{item.clase === 2 ? item.rmr89_gt5 : '—'}</td>
                      <td className="py-2.5 px-2 text-center text-pink-300 font-mono">{item.clase === 1 ? item.rmr89 : '—'}</td>
                      <td className="py-2.5 px-2 text-center text-pink-300 font-mono">{item.clase === 1 ? item.rmr89_gt5 : '—'}</td>
                      <td className="py-2.5 px-2 text-center text-amber-300 font-mono">{item.clase === 3 ? item.rmr76 : '—'}</td>
                      <td className="py-2.5 px-2 text-center text-amber-300 font-mono">{item.clase === 2 ? item.rmr76 : '—'}</td>
                      <td className="py-2.5 px-2 text-center text-amber-300 font-mono">{item.clase === 2 ? item.rmr76_gt5 : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RUGOSIDAD */}
        {activeTab === 'rugosidad' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Flame size={14} className="text-orange-500" />
              <span>Rugosidad Estructural (1 - 9)</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-4xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 border-b border-navy-900 w-16 text-center">Perfil</th>
                    <th className="py-2.5 px-4 border-b border-navy-900">Descripción Perfil</th>
                    <th className="py-2.5 px-4 text-center text-pink-400">Rating R89</th>
                    <th className="py-2.5 px-4 text-center text-amber-400">Rating R76</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(RUGOSIDAD_CATALOG).map(([numStr, item]) => (
                    <tr key={numStr} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 text-center font-bold text-orange-400">{numStr}</td>
                      <td className="py-2.5 px-4">{item.desc.replace(/^\d\s*—\s*/, '')}</td>
                      <td className="py-2.5 px-4 text-center text-pink-300 font-black">{item.r89}</td>
                      <td className="py-2.5 px-4 text-center text-amber-300 font-black">{item.r76}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FORMA */}
        {activeTab === 'forma' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Compass size={14} className="text-orange-500" />
              <span>Forma de Discontinuidades</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Código</th>
                    <th className="py-2.5 px-4">Descripción Forma</th>
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

        {/* METEORIZACIÓN */}
        {activeTab === 'alteracion' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Flame size={14} className="text-orange-500" />
              <span>Meteorización / Alteración de Pared</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Código</th>
                    <th className="py-2.5 px-4">Grado de Meteorización</th>
                    <th className="py-2.5 px-4 text-center text-pink-400">Rating R89</th>
                    <th className="py-2.5 px-4 text-center text-amber-400">Rating R76</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {Object.entries(ALTERACION_CATALOG).map(([code, item]) => (
                    <tr key={code} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-black text-orange-400">{code}</td>
                      <td className="py-2.5 px-4">{item.name.replace(/^[a-z]\s*—\s*/i, '')}</td>
                      <td className="py-2.5 px-4 text-center text-pink-300 font-black">{item.r89}</td>
                      <td className="py-2.5 px-4 text-center text-amber-300 font-black">{item.r76}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* JRC */}
        {activeTab === 'jrc' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={14} className="text-orange-500" />
              <span>Matriz JRC vs Perfil de Rugosidad</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Rango Coeficiente JRC</th>
                    <th className="py-2.5 px-4 text-center w-36">N&deg; Perfil Rugosidad</th>
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

        {/* ENSAYOS PLT IRREGULARES */}
        {activeTab === 'plt_irregulares' && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
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
      </div>
    </div>
  );
}