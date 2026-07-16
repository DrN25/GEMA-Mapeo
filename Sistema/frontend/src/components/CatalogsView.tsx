import { useState, useEffect } from 'react';
import {
  Table, Layers, Compass, Flame, AlignLeft, Droplet,
  Shield, Zap, Sparkles, Sliders, Maximize2, MoveRight,
  Database, GitBranch, ArrowRightLeft
} from 'lucide-react';

const getGroupBadge = (grupo: string) => {
  const g = String(grupo).toUpperCase();
  if (g.includes("INTRUSIVO")) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-violet-500/10 border border-violet-500/30 text-violet-300">
        INTRUSIVOS
      </span>
    );
  }
  if (g.includes("SEDIMENTARIA") || g.includes("SEDIMENTARIO")) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-sky-500/10 border border-sky-500/30 text-sky-300">
        SEDIMENTARIAS
      </span>
    );
  }
  if (g.includes("METAMORFICA") || g.includes("METAMORFICO")) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
        METAMÓRFICAS
      </span>
    );
  }
  if (g.includes("BRECHA")) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-500/10 border border-rose-500/30 text-rose-300">
        BRECHAS
      </span>
    );
  }
  if (g.includes("ENDOSKARN")) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/10 border border-amber-500/30 text-amber-300">
        ENDOSKARN
      </span>
    );
  }
  return <span className="text-slate-400 font-bold">{grupo}</span>;
};

interface CatalogsViewProps {
  mode?: 'ventanas' | 'plt';
}

export default function CatalogsView({ mode = 'ventanas' }: CatalogsViewProps) {
  const [activeTab, setActiveTab] = useState<string>('litologia');
  const [catalogs, setCatalogs] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/catalogs/all')
      .then(res => {
        if (!res.ok) throw new Error("Server error");
        return res.json();
      })
      .then(data => {
        setCatalogs(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading catalogs in view:", err);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-3 text-slate-400 min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></div>
        <p className="text-xs font-semibold">Cargando catálogos geomecánicos SSOT...</p>
      </div>
    );
  }

  const groups = mode === 'plt' ? [
    {
      title: 'Ensayos PLT & Litología',
      items: [
        { id: 'litologia', label: 'Litología y K', icon: Layers },
        { id: 'plt_resistencia_isrm', label: 'Clasificación Resistencia ISRM', icon: Shield },
        { id: 'plt_direccion_rotura', label: 'Dirección de Rotura', icon: Compass },
        { id: 'plt_tipo_fractura', label: 'Tipo de Fractura', icon: AlignLeft },
        { id: 'plt_valoracion_rmr', label: 'Valoración Resistencia RMR', icon: Table },
        { id: 'extremos_terminacion', label: 'Extremos / Terminación', icon: Maximize2 }
      ]
    }
  ] : [
    {
      title: 'Roca Intacta & Litología',
      items: [
        { id: 'litologia', label: 'Litología y K', icon: Layers },
        { id: 'resistencia', label: 'Resistencia ISRM', icon: Shield }
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
        { id: 'jrc', label: 'JRC vs Rugosidad', icon: Table }
      ]
    }
  ];

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6 bg-navy-950 min-h-screen text-slate-100">
      {/* SIDE MENU */}
      <div className="w-full md:w-64 shrink-0 space-y-4">
        {groups.map((g, gIdx) => (
          <div key={gIdx} className="space-y-1 bg-navy-900/30 p-3 rounded-xl border border-navy-900">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 mb-2">
              {g.title}
            </h4>
            {g.items.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all text-left ${
                    active
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/10'
                      : 'text-slate-400 hover:bg-navy-900/60 hover:text-slate-200'
                  }`}
                >
                  <Icon size={14} className={active ? 'text-white' : 'text-slate-400'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* CONTENT TAB */}
      <div className="flex-1 bg-navy-900/10 p-5 rounded-2xl border border-navy-900/55 min-w-0">
        
        {/* 1. LITOLOGÍA Y K */}
        {activeTab === 'litologia' && (
          <div className="flex flex-col gap-8">
            {/* TABLA 1 */}
            <div className="space-y-3">
              <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
                <Layers size={14} className="text-cyan-400 animate-pulse" />
                <span>Factor de correlación para ensayos de carga puntual (SRK, 2023)</span>
              </h3>
              <div className="overflow-x-auto rounded-lg border border-navy-900 max-h-[40vh] scrollbar-thin">
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
                    {catalogs.litologia.tabla_colores.map((item: any, idx: number) => {
                      const lito2Up = item.lito2.toUpperCase();
                      let grupo = "INTRUSIVOS";
                      if (["GSK", "PSK", "MSK", "ESK", "MBC", "MBL"].includes(lito2Up)) {
                        grupo = "METAMORFICAS";
                      } else {
                        const l1 = item.lito1.toUpperCase();
                        if (["MZB", "MBF1", "MBF2", "MZM", "MZH", "MZD", "MZQ", "AN"].includes(l1)) {
                          grupo = "INTRUSIVOS";
                        } else if (["LMT", "SHL", "SND"].includes(l1)) {
                          grupo = "SEDIMENTARIAS";
                        } else if (l1 === "INTRUSIVO") {
                          grupo = "ENDOSKARN";
                        } else if (["TBX", "HBX", "MBX / VARIOS", "BX"].includes(l1)) {
                          grupo = "BRECHAS";
                        }
                      }
                      
                      return (
                        <tr key={idx} className="hover:bg-navy-900/20">
                          <td className="py-2 px-4">{getGroupBadge(grupo)}</td>
                          <td className="py-2 px-4 text-slate-300 font-semibold">{item.lito1}</td>
                          <td className="py-2 px-4 text-slate-300">{item.lito2}</td>
                          <td className="py-2 px-4 text-slate-300">{item.lito3}</td>
                          <td className="py-2 px-4 text-center font-bold text-cyan-400">{item.k.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TABLA 2 */}
            <div className="space-y-3">
              <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
                <Layers size={14} className="text-violet-500 animate-pulse" />
                <span>Factor de correlación para ensayos de carga puntual (Detallado)</span>
              </h3>
              <div className="overflow-x-auto rounded-lg border border-navy-900 max-h-[40vh] scrollbar-thin">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-navy-950 z-10 border-b border-navy-900">
                    <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-4">Unidad Geotécnica</th>
                      <th className="py-2.5 px-4">Lito 2</th>
                      <th className="py-2.5 px-4">Lito 3</th>
                      <th className="py-2.5 px-4">Validación Lito</th>
                      <th className="py-2.5 px-4 text-center text-cyan-400">Factor K (K)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                    {catalogs.litologia.tabla_validacion.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-navy-900/20">
                        <td className="py-2 px-4">{getGroupBadge(item.grupo)}</td>
                        <td className="py-2 px-4 text-slate-300 font-semibold">{item.lito2}</td>
                        <td className="py-2 px-4 text-slate-300">{item.lito3}</td>
                        <td className="py-2 px-4 text-slate-400 font-mono text-[11px]">{item.validacion}</td>
                        <td className="py-2 px-4 text-center font-bold text-cyan-400">{item.k.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                  {catalogs.agua.map((item: any, idx: number) => (
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
                    {catalogs.resistencia.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-navy-900/20">
                        <td className="py-2.5 px-4 font-black text-orange-400">{item.codigo}</td>
                        <td className="py-2.5 px-4 font-mono">{item.rango}</td>
                        <td className="py-2.5 px-4">{item.denom}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-amber-300">{item.r76}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-pink-300">
                          {item.r89_min !== undefined ? `${item.r89_min.toFixed(2)} - ${item.r89_max.toFixed(2)}` : item.r89}
                        </td>
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
                  {catalogs.control_estructural.map((item: any, idx: number) => (
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
                  {catalogs.efectos_voladura.map((item: any, idx: number) => (
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
                  {catalogs.rqd.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-mono font-bold">{item.rango}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-amber-300">{item.r76}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-pink-300">{item.r89_min.toFixed(2)} - {item.r89_max.toFixed(2)}</td>
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
                  {catalogs.espaciamiento.map((item: any, idx: number) => (
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
                  {catalogs.estructura.map((item: any) => (
                    <tr key={item.codigo} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 text-orange-400 font-black">{item.codigo}</td>
                      <td className="py-2.5 px-4">{item.nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXTREMOS Y TERMINACIÓN */}
        {activeTab === 'extremos_terminacion' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Maximize2 size={14} className="text-orange-500" />
              <span>Extremos Visibles / Terminación de Estructuras</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 text-center w-20">Código</th>
                    <th className="py-2.5 px-4">Extremos visible / Terminación</th>
                    <th className="py-2.5 px-4">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {catalogs.extremos_terminacion.map((item: any) => (
                    <tr key={item.codigo} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 text-center text-orange-400 font-black">{item.codigo}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-200">{item.terminacion}</td>
                      <td className="py-2.5 px-4 text-slate-350 leading-relaxed">{item.desc}</td>
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
                    { label: "Abierta", range: "≥ 0.1 y < 1.0 mm", r89: 3, r76: 3 },
                    { label: "Muy Abierta", range: "≥ 1.0 y < 5.0 mm", r89: 1, r76: 1 },
                    { label: "Extremadamente Abierta", range: "≥ 5.0 mm", r89: 0, r76: 0 }
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
                    { range: "≥ 1 y < 3 m", r89: 4, r76: 4 },
                    { range: "≥ 3 y < 10 m", r89: 2, r76: 3 },
                    { range: "≥ 10 y < 20 m", r89: 1, r76: 1 },
                    { range: "≥ 20 m", r89: 0, r76: 0 }
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
                  {catalogs.relleno.map((item: any) => {
                    const claseVal = item.tipo === "Blando" ? 1 : (item.tipo === "Duro" ? 2 : 3);
                    return (
                      <tr key={item.codigo} className="hover:bg-navy-900/20">
                        <td className="py-2.5 px-3 font-bold text-orange-400">{item.codigo} - {item.nombre}</td>
                        <td className="py-2.5 px-2 text-center text-[10px] text-slate-400 font-semibold">{item.tipo}</td>
                        <td className="py-2.5 px-2 text-center text-pink-300 font-mono">{claseVal === 3 ? item.r89_lt5 : '—'}</td>
                        <td className="py-2.5 px-2 text-center text-pink-300 font-mono">{claseVal === 2 ? item.r89_lt5 : '—'}</td>
                        <td className="py-2.5 px-2 text-center text-pink-300 font-mono">{claseVal === 2 ? item.r89_gte5 : '—'}</td>
                        <td className="py-2.5 px-2 text-center text-pink-300 font-mono">{claseVal === 1 ? item.r89_lt5 : '—'}</td>
                        <td className="py-2.5 px-2 text-center text-pink-300 font-mono">{claseVal === 1 ? item.r89_gte5 : '—'}</td>
                        <td className="py-2.5 px-2 text-center text-amber-300 font-mono">{claseVal === 3 ? item.r76_lt5 : '—'}</td>
                        <td className="py-2.5 px-2 text-center text-amber-300 font-mono">{claseVal === 2 ? item.r76_lt5 : '—'}</td>
                        <td className="py-2.5 px-2 text-center text-amber-300 font-mono">{claseVal === 2 ? item.r76_gte5 : '—'}</td>
                      </tr>
                    );
                  })}
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
                  {catalogs.rugosidad.map((item: any) => (
                    <tr key={item.clase} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 text-center font-bold text-orange-400">{item.clase}</td>
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
                  {catalogs.forma.map((item: any) => (
                    <tr key={item.codigo} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 text-orange-400 font-black">{item.codigo}</td>
                      <td className="py-2.5 px-4">{item.desc}</td>
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
                  {catalogs.alteracion.map((item: any) => (
                    <tr key={item.codigo} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-black text-orange-400">{item.codigo}</td>
                      <td className="py-2.5 px-4">{item.nombre}</td>
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

        {/* TABS INDIVIDUALES DE PLT (Solo en modo PLT) */}
        {activeTab === 'plt_resistencia_isrm' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Shield size={14} className="text-cyan-400" />
              <span>Clasificación de Resistencia ISRM (UCS)</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-3xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-navy-850">
                    <th className="py-2.5 px-4 w-24">Código</th>
                    <th className="py-2.5 px-4 text-center">UCS Mínimo (MPa)</th>
                    <th className="py-2.5 px-4 text-center">UCS Máximo (MPa)</th>
                    <th className="py-2.5 px-4">Denominación ISRM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/30 text-slate-300 font-medium">
                  {[
                    { code: "R0", min: "0.25", max: "1.00", desc: "Extremadamente débil", color: "text-rose-400" },
                    { code: "R1", min: "1.00", max: "5.00", desc: "Muy débil", color: "text-orange-400" },
                    { code: "R2", min: "5.00", max: "25.00", desc: "Débil", color: "text-amber-400" },
                    { code: "R3", min: "25.00", max: "50.00", desc: "Moderadamente resistente", color: "text-yellow-400" },
                    { code: "R4", min: "50.00", max: "100.00", desc: "Resistente", color: "text-emerald-400" },
                    { code: "R5", min: "100.00", max: "250.00", desc: "Muy resistente", color: "text-cyan-400" },
                    { code: "R6", min: "250.00", max: "> 250.00", desc: "Extremadamente resistente", color: "text-indigo-400" }
                  ].map((row, index) => (
                    <tr key={index} className="hover:bg-navy-900/20">
                      <td className={`py-2.5 px-4 font-black ${row.color}`}>{row.code}</td>
                      <td className="py-2.5 px-4 text-center font-mono">{row.min}</td>
                      <td className="py-2.5 px-4 text-center font-mono">{row.max}</td>
                      <td className="py-2.5 px-4">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'plt_direccion_rotura' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Compass size={14} className="text-emerald-400" />
              <span>Dirección de Rotura (ISRM)</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-navy-850">
                    <th className="py-2.5 px-4 w-24">Sigla</th>
                    <th className="py-2.5 px-4">Descripción Geológica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/30 text-slate-300 font-medium">
                  {[
                    { sigla: "Pa", desc: "Paralela a los planos de debilidad (estratificación, foliación)" },
                    { sigla: "Pe", desc: "Perpendicular a los planos de debilidad (estratificación, foliación)" },
                    { sigla: "NA", desc: "No aplica (rocas masivas sin planos de debilidad)" }
                  ].map((row, index) => (
                    <tr key={index} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-bold text-emerald-400">{row.sigla}</td>
                      <td className="py-2.5 px-4 text-slate-200">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'plt_tipo_fractura' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <AlignLeft size={14} className="text-indigo-400" />
              <span>Tipo de Fractura / Rotura</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-navy-850">
                    <th className="py-2.5 px-4 w-24">Tipo</th>
                    <th className="py-2.5 px-4">Criterio de Aceptación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/30 text-slate-300 font-medium">
                  {[
                    { tipo: "M", desc: "Rotura por matriz. Si la muestra no se rompe se considera M." },
                    { tipo: "E", desc: "Rotura por estructura preexistente." },
                    { tipo: "C", desc: "Rotura combinada (por matriz y estructura en simultáneo)." }
                  ].map((row, index) => (
                    <tr key={index} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-bold text-indigo-400">{row.tipo}</td>
                      <td className="py-2.5 px-4 text-slate-200">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'plt_valoracion_rmr' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <AlignLeft size={14} className="text-amber-400" />
              <span>Valoración de Resistencia de la Roca Intacta (RMR)</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-navy-850">
                    <th className="py-2.5 px-4">Rango de Resistencia UCS (MPa)</th>
                    <th className="py-2.5 px-4 text-center">Rating RMR'89</th>
                    <th className="py-2.5 px-4 text-center">Rating RMR'76</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/30 text-slate-300 font-medium">
                  {[
                    { ucs: "≥ 250 MPa", r89: 15, r76: 10 },
                    { ucs: "100 - < 250 MPa", r89: 12, r76: 8 },
                    { ucs: "50 - < 100 MPa", r89: 7, r76: 5 },
                    { ucs: "25 - < 50 MPa", r89: 4, r76: 2 },
                    { ucs: "5 - < 25 MPa", r89: 2, r76: 1 },
                    { ucs: "1 - < 5 MPa", r89: 1, r76: 0 }
                  ].map((row, index) => (
                    <tr key={index} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-semibold text-slate-200">{row.ucs}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-emerald-400">{row.r89}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-emerald-400">{row.r76}</td>
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