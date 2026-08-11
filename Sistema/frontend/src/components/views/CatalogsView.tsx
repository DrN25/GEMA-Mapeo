import { useState, useEffect } from 'react';
import { getAuthHeaders } from '../../utils/apiClient';
import {
  Table, Layers, Compass, Flame, AlignLeft, Droplet,
  Shield, Zap, Sparkles, Sliders, Maximize2, MoveRight,
  Database, GitBranch, ArrowRightLeft
} from 'lucide-react';
import {
  ratingDiscretoRqd,
  ratingContinuoRqd,
  ratingPromedioRqd,
  ratingDiscretoResistencia,
  ratingContinuoResistencia,
  ratingPromedioResistencia
} from '../../utils/rmrInterpolation';
import tablaLitologiasImg from '../../images/catalogs/tabla_litologias.png';
import gsiImg from '../../images/catalogs/gsi.png';

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
    const apiBase = import.meta.env.VITE_API_BASE || "";
    fetch(`${apiBase}/api/catalogs/all`, { headers: getAuthHeaders() })
      .then(res => {
        if (!res.ok) throw new Error("Server error");
        return res.json();
      })
      .then(data => {
        setCatalogs(data);
        setLoading(false);
      })
      .catch(err => {
        console.warn("No se pudo cargar catálogos desde el servidor backend, continuando en modo fallback local:", err);
        setLoading(false);
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
    },
    {
      title: 'GSI (Hoek-Brown)',
      items: [
        { id: 'gsi_superficie', label: 'Condición Superficie', icon: Layers },
        { id: 'gsi_estructura', label: 'Estructura', icon: Layers },
        { id: 'gsi_rangos', label: 'Rango GSI Visual', icon: Table }
      ]
    }
  ];

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6 bg-slate-100 dark:bg-navy-950 min-h-screen text-slate-800 dark:text-slate-100 font-sans">
      {/* SIDE MENU */}
      <div className="w-full md:w-64 shrink-0 space-y-4">
        {groups.map((g, gIdx) => (
          <div key={gIdx} className="space-y-1 bg-white/80 dark:bg-navy-900/30 p-3 rounded-xl border border-slate-200 dark:border-navy-900 shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider px-2 mb-2">
              {g.title}
            </h4>
            {g.items.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all text-left ${active
                      ? 'bg-indigo-600 dark:bg-violet-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-navy-900/60 hover:text-indigo-700 dark:hover:text-slate-200'
                    }`}
                >
                  <Icon size={14} className={active ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* CONTENT TAB */}
      <div className="flex-1 bg-white/90 dark:bg-navy-900/10 p-5 rounded-2xl border border-slate-200 dark:border-navy-900/55 min-w-0 shadow-sm">

        {/* 1. LITOLOGÍA Y K */}
        {activeTab === 'litologia' && (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Tablas de litología */}
            <div className="flex-1 min-w-0 flex flex-col gap-8">
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

            {/* Imagen de referencia: Tabla de Litologías */}
            <div className="lg:w-[380px] shrink-0">
              <div className="lg:sticky lg:top-0 space-y-3">
                <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
                  <Layers size={14} className="text-emerald-400 animate-pulse" />
                  <span>Tabla de Litologías</span>
                </h3>
                <div className="rounded-lg border border-navy-900 overflow-hidden bg-navy-950/40">
                  <img
                    src={tablaLitologiasImg}
                    alt="Tabla de Litologías"
                    className="w-full h-auto object-contain"
                  />
                </div>
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

        {/* GSI — CONDICIÓN DE LA SUPERFICIE */}
        {activeTab === 'gsi_superficie' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Layers size={14} className="text-violet-500" />
              <span>GSI — Condición de la Superficie (Eje X de Hoek-Brown)</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium max-w-3xl">
              45 unidades repartidas en 5 columnas (9 unidades por columna).
            </p>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-3xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-navy-950 border-b border-navy-900">
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Código</th>
                    <th className="py-2.5 px-4">Término</th>
                    <th className="py-2.5 px-4">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {(catalogs.gsi_superficie || []).map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-black text-violet-400">{item.codigo}</td>
                      <td className="py-2.5 px-4">{item.termino}</td>
                      <td className="py-2.5 px-4 text-slate-300">{item.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GSI — ESTRUCTURA */}
        {activeTab === 'gsi_estructura' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Layers size={14} className="text-violet-500" />
              <span>GSI — Estructura (Eje Y de Hoek-Brown)</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium max-w-3xl">
              40 unidades repartidas en 4 filas (10 unidades por fila).
            </p>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-3xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-navy-950 border-b border-navy-900">
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Código</th>
                    <th className="py-2.5 px-4">Término</th>
                    <th className="py-2.5 px-4">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {(catalogs.gsi_estructura || []).map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-black text-violet-400">{item.codigo}</td>
                      <td className="py-2.5 px-4">{item.termino}</td>
                      <td className="py-2.5 px-4 text-slate-300">{item.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GSI — RANGO PERMITIDO DEL GSI VISUAL (tabla derivada por suma) */}
        {activeTab === 'gsi_rangos' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Table size={14} className="text-violet-500" />
              <span>GSI Visual — Rango Permitido (Estructura × Superficie)</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium max-w-3xl">
              Rango = [Estructura.min + Superficie.min, min(85, Estructura.max + Superficie.max)]. El QA/QC marca
              CRÍTICA si el GSI visual sale de este rango.
            </p>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-4xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-navy-950 border-b border-navy-900">
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Estructura \ Superficie</th>
                    {(catalogs.gsi_superficie || []).map((s: any, idx: number) => (
                      <th key={idx} className="py-2.5 px-4 text-center text-violet-400">
                        {s.codigo}<br /><span className="text-[9px] font-semibold text-slate-500">[{s.min}–{s.max}]</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {(catalogs.gsi_estructura || []).map((e: any, ei: number) => (
                    <tr key={ei} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-black text-violet-400">
                        {e.codigo}<span className="text-[9px] font-semibold text-slate-500 ml-1">[{e.min}–{e.max}]</span>
                      </td>
                      {(catalogs.gsi_superficie || []).map((s: any, si: number) => {
                        const min = e.min + s.min;
                        const max = Math.min(85, e.max + s.max);
                        return (
                          <td key={si} className="py-2.5 px-4 text-center font-bold text-violet-300">
                            [{min}–{max}]
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-navy-900 overflow-hidden bg-navy-950/40 max-w-4xl">
              <img
                src={gsiImg}
                alt="Gráfica de referencia GSI (Hoek-Brown)"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        )}

        {/* 3. RESISTENCIA ISRM */}
        {activeTab === 'resistencia' && (
          <div className="space-y-5">
            <div className="space-y-3">
              <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
                <Shield size={14} className="text-orange-500" />
                <span>Resistencia de la Roca Intacta</span>
              </h3>

              <div className="bg-navy-950/40 border border-violet-500/20 p-3.5 rounded-xl text-xs space-y-2 text-slate-350 max-w-3xl">
                <span className="font-black text-[10px] uppercase text-violet-400 tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping"></span>
                  Lógica Geomecánica Aplicada por Campaña
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <h5 className="font-semibold text-slate-200 text-xs">Resistencia '89:</h5>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                      <li>Campañas 2021 a 2023: <strong className="text-cyan-400">Ábaco Continuo</strong> (Función PCHIP UCS)</li>
                      <li>Campañas 2024 en adelante: <strong className="text-violet-400">Tabla Discreta Original</strong></li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-slate-200 text-xs">Resistencia '76:</h5>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                      <li>Todos los años: <strong className="text-slate-300">Tabla Discreta Original</strong> (ISRM R0-R6)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
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
                          <td className="py-2.5 px-4 text-center font-bold text-pink-300">{item.r89}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="max-w-3xl">
                  <ResistenciaRatingChart />
                </div>
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
          <div className="space-y-4">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Sliders size={14} className="text-orange-500" />
              <span>RQD % (Ratings de Calidad)</span>
            </h3>

            <div className="bg-navy-950/40 border border-cyan-500/20 p-3.5 rounded-xl text-xs space-y-2 text-slate-350 max-w-3xl">
              <span className="font-black text-[10px] uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                Lógica Geomecánica Aplicada por Campaña
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <h5 className="font-semibold text-slate-200 text-xs">RQD '89:</h5>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                    <li>Campaña 2021: <strong className="text-violet-400">Tabla Discreta Original</strong></li>
                    <li>Campañas 2022 en adelante: <strong className="text-cyan-400">Ábaco Continuo</strong> (Función CubicSpline)</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-semibold text-slate-200 text-xs">RQD '76:</h5>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                    <li>Todos los años: <strong className="text-slate-300">Tabla Discreta Original</strong> (con redondeo a entero)</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-6">
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
                        <td className="py-2.5 px-4 text-center font-bold text-pink-300">{item.r89}</td>
                        <td className="py-2.5 px-4 text-slate-300">{item.calidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="max-w-3xl">
                <RqdRatingChart />
              </div>
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

        {/* DIRECCIÓN DE ROTURA PLT */}
        {activeTab === 'plt_direccion_rotura' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <Compass size={14} className="text-cyan-400" />
              <span>Tabla de Dirección de Rotura (PLT Irregulares)</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-navy-950 border-b border-navy-900">
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 text-center w-24">Código</th>
                    <th className="py-2.5 px-4">Descripción de Orientación respecto a planos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {(catalogs?.direccion_rotura || [
                    { codigo: "Pa", descripcion: "Paralela a los planos de debilidad de la muestra" },
                    { codigo: "Pe", descripcion: "Perpendicular a los planos de debilidad de la muestra" },
                    { codigo: "NA", descripcion: "No aplica — roca masiva sin planos de debilidad definidos" }
                  ]).map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 text-center font-black text-cyan-400">{item.codigo}</td>
                      <td className="py-2.5 px-4 text-slate-300 leading-relaxed">{item.descripcion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TIPO DE FRACTURA PLT */}
        {activeTab === 'plt_tipo_fractura' && (
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-200 border-b border-navy-800 pb-2 flex items-center gap-2">
              <AlignLeft size={14} className="text-violet-400" />
              <span>Tabla de Tipo de Fractura (PLT Irregulares)</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-900 max-w-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-navy-950 border-b border-navy-900">
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 text-center w-24">Código</th>
                    <th className="py-2.5 px-4">Descripción del Modo de Rotura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/40 text-slate-200 font-medium">
                  {(catalogs?.tipo_fractura || [
                    { codigo: "M", descripcion: "Rotura por matriz — falla a través de la roca intacta" },
                    { codigo: "E", descripcion: "Rotura por estructura — falla a lo largo de discontinuidad preexistente" },
                    { codigo: "C", descripcion: "Rotura combinada — por matriz y estructura simultáneamente" }
                  ]).map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 text-center font-black text-violet-400">{item.codigo}</td>
                      <td className="py-2.5 px-4 text-slate-300 leading-relaxed">{item.descripcion}</td>
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
                    { range: "]0 - 2[", profile: 9 },
                    { range: "]2 - 4[", profile: 8 },
                    { range: "]4 - 6[", profile: 7 },
                    { range: "]6 - 8[", profile: 6 },
                    { range: "]8 - 10[", profile: 6 },
                    { range: "]10 - 12[", profile: 5 },
                    { range: "]12 - 14[", profile: 4 },
                    { range: "]14 - 16[", profile: 3 },
                    { range: "]16 - 18[", profile: 2 },
                    { range: "]18 - 20[", profile: 1 }
                  ].map((item, idx) => (
                    <tr key={idx} className="hover:bg-navy-900/20">
                      <td className="py-2.5 px-4 font-semibold font-mono">{item.range}</td>
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

      </div>
    </div>
  );
}

// =========================================================================
// RATING PROMEDIO DE RQD (R2) - SVG CHART
// =========================================================================
function RqdRatingChart() {
  const [hoveredVal, setHoveredVal] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, rectWidth: 800 });

  const width = 800;
  const height = 500;
  const paddingLeft = 70;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 70;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const continuousPoints: string[] = [];

  for (let val = 0; val <= 100; val += 0.5) {
    const cx = paddingLeft + (val / 100) * chartWidth;
    const rc = ratingContinuoRqd(val);
    const cy_c = height - paddingBottom - (rc / 20) * chartHeight;
    continuousPoints.push(`${cx},${cy_c}`);
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert to SVG design coordinates (0 to 800)
    const svgX = (clientX / rect.width) * width;

    let val = ((svgX - paddingLeft) / chartWidth) * 100;
    val = Math.max(0, Math.min(100, val));

    setHoveredVal(val);
    setMousePos({ x: clientX, y: clientY, rectWidth: rect.width });
  };

  const handleMouseLeave = () => {
    setHoveredVal(null);
  };

  const continuousPath = `M ${continuousPoints.join(' L ')}`;
  const h_cont = hoveredVal !== null ? ratingContinuoRqd(hoveredVal) : 0;

  // Ticks y de 2 en 2 para RQD (0 a 20) para evitar colisiones a 12px
  const yTicks = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  // Ticks x RQD
  const xTicks = [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

  // Tooltip positioning relative to SVG to avoid parent padding offset
  const isRightHalf = mousePos.x > mousePos.rectWidth / 2;
  const tooltipLeft = isRightHalf ? mousePos.x - 240 : mousePos.x + 20;
  const tooltipTop = mousePos.y - 45;

  return (
    <div className="relative overflow-visible border border-navy-900 bg-navy-950/60 p-5 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h4 className="text-sm font-bold text-slate-300">Curvas de Valoración RQD (R89)</h4>
          <p className="text-xs text-slate-500">Mueve el cursor sobre la gráfica para ver los detalles exactos (X, Y)</p>
        </div>
        <div className="flex gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-cyan-400"></span> Ábaco Continuo</span>
        </div>
      </div>

      {/* direct wrapper that has the exact bounds of the SVG */}
      <div className="relative overflow-visible">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible select-none cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Grid lines & Y Labels (de 2 en 2, etiquetas a 12px) */}
          {yTicks.map((rating) => {
            const cy = height - paddingBottom - (rating / 20) * chartHeight;
            const isMajor = rating % 10 === 0;
            return (
              <g key={rating}>
                <line
                  x1={paddingLeft}
                  y1={cy}
                  x2={width - paddingRight}
                  y2={cy}
                  stroke={isMajor ? "#334155" : "#1e293b"}
                  strokeWidth={isMajor ? 1.0 : 0.6}
                  strokeDasharray={isMajor ? undefined : "2,2"}
                />
                <text
                  x={paddingLeft - 10}
                  y={cy + 4}
                  fill={isMajor ? "#94a3b8" : "#475569"}
                  className="font-bold font-mono text-right"
                  style={{ fontSize: "12px" }}
                  textAnchor="end"
                >
                  {rating}
                </text>
              </g>
            );
          })}

          {/* Grid lines & X Labels (etiquetas a 12px) */}
          {xTicks.map((pct) => {
            const cx = paddingLeft + (pct / 100) * chartWidth;
            const isMajor = [0, 25, 50, 75, 90, 100].includes(pct);
            return (
              <g key={pct}>
                <line
                  x1={cx}
                  y1={paddingTop}
                  x2={cx}
                  y2={height - paddingBottom}
                  stroke={isMajor ? "#334155" : "#1e293b"}
                  strokeWidth={isMajor ? 1.0 : 0.6}
                  strokeDasharray={isMajor ? undefined : "3,3"}
                />
                <text
                  x={cx}
                  y={height - paddingBottom + 18}
                  fill={isMajor ? "#94a3b8" : "#475569"}
                  className="font-bold font-mono"
                  style={{ fontSize: "12px" }}
                  textAnchor="middle"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Axis lines */}
          <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="#475569" strokeWidth={1.5} />
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} stroke="#475569" strokeWidth={1.5} />

          {/* Axis Titles (min 12px) */}
          <text
            transform="rotate(-90)"
            x={- (paddingTop + chartHeight / 2)}
            y={20}
            fill="#94a3b8"
            className="font-bold tracking-wider"
            style={{ fontSize: "12px" }}
            textAnchor="middle"
          >
            Rating RMR'89 (Eje Y)
          </text>
          <text
            x={paddingLeft + chartWidth / 2}
            y={height - 20}
            fill="#94a3b8"
            className="font-bold tracking-wider"
            style={{ fontSize: "12px" }}
            textAnchor="middle"
          >
            Porcentaje RQD (%) (Eje X)
          </text>

          {/* Paths */}
          <path d={continuousPath} fill="none" stroke="#06b6d4" strokeWidth={3.5} opacity={1.0} />

          {/* Hover elements */}
          {hoveredVal !== null && (
            <>
              <line
                x1={paddingLeft + (hoveredVal / 100) * chartWidth}
                y1={paddingTop}
                x2={paddingLeft + (hoveredVal / 100) * chartWidth}
                y2={height - paddingBottom}
                stroke="#06b6d4"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
              <circle
                cx={paddingLeft + (hoveredVal / 100) * chartWidth}
                cy={height - paddingBottom - (h_cont / 20) * chartHeight}
                r={5}
                fill="#06b6d4"
                stroke="#fff"
                strokeWidth={1.5}
              />
            </>
          )}
        </svg>

        {/* HTML Tooltip (absolutely positioned within the exact wrapper) */}
        {hoveredVal !== null && (
          <div
            className="absolute z-10 pointer-events-none bg-slate-900/95 border border-navy-800 text-xs rounded-lg p-3 shadow-xl space-y-1.5 w-56 text-slate-200"
            style={{
              left: `${tooltipLeft}px`,
              top: `${tooltipTop}px`
            }}
          >
            <div className="font-bold text-slate-300 border-b border-navy-850 pb-1 flex justify-between">
              <span>RQD% (Eje X):</span>
              <span className="text-cyan-400 font-mono">{hoveredVal.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between font-bold border-t border-navy-850 pt-1 text-cyan-400 font-mono">
              <span>Rating Continuo (Y):</span>
              <span>{h_cont.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// RATING PROMEDIO DE RESISTENCIA (R1) - SVG CHART
// =========================================================================
function ResistenciaRatingChart() {
  const [hoveredVal, setHoveredVal] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, rectWidth: 800 });

  const width = 800;
  const height = 500;
  const paddingLeft = 70;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 70;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const continuousPoints: string[] = [];

  for (let val = 0; val <= 260; val += 1.0) {
    const cx = paddingLeft + (val / 260) * chartWidth;
    const rc = ratingContinuoResistencia(val);
    const cy_c = height - paddingBottom - (rc / 15) * chartHeight;
    continuousPoints.push(`${cx},${cy_c}`);
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert to SVG design coordinates (0 to 260)
    const svgX = (clientX / rect.width) * width;

    let val = ((svgX - paddingLeft) / chartWidth) * 260;
    val = Math.max(0, Math.min(260, val));

    setHoveredVal(val);
    setMousePos({ x: clientX, y: clientY, rectWidth: rect.width });
  };

  const handleMouseLeave = () => {
    setHoveredVal(null);
  };

  const continuousPath = `M ${continuousPoints.join(' L ')}`;
  const h_cont = hoveredVal !== null ? ratingContinuoResistencia(hoveredVal) : 0;

  // Ticks y de 2 en 2 para Resistencia (0 a 15)
  const yTicks = [0, 2, 4, 6, 8, 10, 12, 14, 15];
  // Ticks x UCS cada 25 mas el limite 260
  const xTicks = [0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 260];

  // Tooltip positioning relative to SVG to avoid parent padding offset
  const isRightHalf = mousePos.x > mousePos.rectWidth / 2;
  const tooltipLeft = isRightHalf ? mousePos.x - 240 : mousePos.x + 20;
  const tooltipTop = mousePos.y - 45;

  return (
    <div className="relative overflow-visible border border-navy-900 bg-navy-950/60 p-5 rounded-xl">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-300">Curvas de Valoración Resistencia UCS (R1 RMR89)</h4>
          <p className="text-xs text-slate-500">Mueve el cursor sobre la gráfica para ver los detalles exactos (X, Y)</p>
        </div>
        <div className="flex gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-cyan-400"></span> Ábaco Continuo</span>
        </div>
      </div>

      {/* direct wrapper that has the exact bounds of the SVG */}
      <div className="relative overflow-visible">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible select-none cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Grid lines & Y Labels (de 2 en 2, etiquetas a 12px) */}
          {yTicks.map((rating) => {
            const cy = height - paddingBottom - (rating / 15) * chartHeight;
            const isMajor = rating % 6 === 0 || rating === 15;
            return (
              <g key={rating}>
                <line
                  x1={paddingLeft}
                  y1={cy}
                  x2={width - paddingRight}
                  y2={cy}
                  stroke={isMajor ? "#334155" : "#1e293b"}
                  strokeWidth={isMajor ? 1.0 : 0.6}
                  strokeDasharray={isMajor ? undefined : "2,2"}
                />
                <text
                  x={paddingLeft - 10}
                  y={cy + 4}
                  fill={isMajor ? "#94a3b8" : "#475569"}
                  className="font-bold font-mono text-right"
                  style={{ fontSize: "12px" }}
                  textAnchor="end"
                >
                  {rating}
                </text>
              </g>
            );
          })}

          {/* Grid lines & X Labels (cada 25, etiquetas a 12px) */}
          {xTicks.map((ucsVal) => {
            const cx = paddingLeft + (ucsVal / 260) * chartWidth;
            const isMajor = [0, 50, 100, 200, 250].includes(ucsVal);
            return (
              <g key={ucsVal}>
                <line
                  x1={cx}
                  y1={paddingTop}
                  x2={cx}
                  y2={height - paddingBottom}
                  stroke={isMajor ? "#334155" : "#1e293b"}
                  strokeWidth={isMajor ? 1.0 : 0.6}
                  strokeDasharray={isMajor ? undefined : "3,3"}
                />
                <text
                  x={cx}
                  y={height - paddingBottom + 18}
                  fill={isMajor ? "#94a3b8" : "#475569"}
                  className="font-bold font-mono"
                  style={{ fontSize: "12px" }}
                  textAnchor="middle"
                >
                  {ucsVal}
                </text>
              </g>
            );
          })}

          {/* Axis lines */}
          <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="#475569" strokeWidth={1.5} />
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} stroke="#475569" strokeWidth={1.5} />

          {/* Axis Titles (min 12px) */}
          <text
            transform="rotate(-90)"
            x={- (paddingTop + chartHeight / 2)}
            y={20}
            fill="#94a3b8"
            className="font-bold tracking-wider"
            style={{ fontSize: "12px" }}
            textAnchor="middle"
          >
            Rating RMR'89 (Eje Y)
          </text>
          <text
            x={paddingLeft + chartWidth / 2}
            y={height - 20}
            fill="#94a3b8"
            className="font-bold tracking-wider"
            style={{ fontSize: "12px" }}
            textAnchor="middle"
          >
            Resistencia Compresión Uniaxial UCS (MPa) (Eje X)
          </text>

          {/* Paths */}
          <path d={continuousPath} fill="none" stroke="#06b6d4" strokeWidth={3.5} opacity={1.0} />

          {/* Hover elements */}
          {hoveredVal !== null && (
            <>
              <line
                x1={paddingLeft + (hoveredVal / 260) * chartWidth}
                y1={paddingTop}
                x2={paddingLeft + (hoveredVal / 260) * chartWidth}
                y2={height - paddingBottom}
                stroke="#06b6d4"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
              <circle
                cx={paddingLeft + (hoveredVal / 260) * chartWidth}
                cy={height - paddingBottom - (h_cont / 15) * chartHeight}
                r={4.5}
                fill="#06b6d4"
                stroke="#fff"
                strokeWidth={1.5}
              />
            </>
          )}
        </svg>

        {/* HTML Tooltip (absolutely positioned within the exact wrapper) */}
        {hoveredVal !== null && (
          <div
            className="absolute z-10 pointer-events-none bg-slate-900/95 border border-navy-800 text-xs rounded-lg p-3 shadow-xl space-y-1.5 w-56 text-slate-200"
            style={{
              left: `${tooltipLeft}px`,
              top: `${tooltipTop}px`
            }}
          >
            <div className="font-bold text-slate-300 border-b border-navy-850 pb-1 flex justify-between">
              <span>UCS (Eje X):</span>
              <span className="text-cyan-400 font-mono">{hoveredVal.toFixed(1)} MPa</span>
            </div>
            <div className="flex justify-between font-bold border-t border-navy-850 pt-1 text-cyan-400 font-mono">
              <span>Rating Continuo (Y):</span>
              <span>{h_cont.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}