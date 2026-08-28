import React, { useState, useMemo } from 'react';
import { ShieldCheck, Search, X, CheckCircle2, AlertTriangle, AlertOctagon, Shuffle } from 'lucide-react';

interface PltCellIntegrityTableProps {
    resumenPorCelda: Record<string, any>;
    filterSecuencia?: string;
    onSelectCell?: (celda: string) => void;
}

export default function PltCellIntegrityTable({
    resumenPorCelda,
    filterSecuencia = '',
    onSelectCell,
}: PltCellIntegrityTableProps) {
    const [search, setSearch] = useState<string>('');
    const [stateFilter, setStateFilter] = useState<string>(filterSecuencia || 'ALL');

    const cellList = useMemo(() => {
        if (!resumenPorCelda) return [];
        return Object.entries(resumenPorCelda).map(([key, val]) => ({
            id: key,
            ...val,
        }));
    }, [resumenPorCelda]);

    const filteredCells = useMemo(() => {
        return cellList.filter(c => {
            if (stateFilter !== 'ALL') {
                if (stateFilter === 'CORRECTO' && !c.estado_secuencia?.includes('CORRECTO')) return false;
                if (stateFilter === 'DESORDEN' && !c.estado_secuencia?.includes('ORDEN')) return false;
                if (stateFilter === 'INCOMPLETA' && !c.estado_secuencia?.includes('INCOMPLETA')) return false;
                if (stateFilter === 'EXCEDENTE' && !c.estado_secuencia?.includes('EXCEDENTE')) return false;
                if (stateFilter === 'ANOMALA' && !c.estado_secuencia?.includes('ANÓMALA')) return false;
            }

            if (search) {
                const q = search.trim().toUpperCase();
                const matchCelda = String(c.celda || '').toUpperCase().includes(q);
                const matchLito = String(c.tipo_litologico || '').toUpperCase().includes(q);
                const matchCamp = String(c.campania || '').toUpperCase().includes(q);
                const matchSec = String(c.secuencia || '').toUpperCase().includes(q);
                if (!matchCelda && !matchLito && !matchCamp && !matchSec) return false;
            }

            return true;
        });
    }, [cellList, search, stateFilter]);

    const getStateBadge = (state: string) => {
        if (!state) return null;
        if (state.includes('CORRECTO')) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 size={11} />
                    <span>CORRECTO (4/4 ABCD)</span>
                </span>
            );
        }
        if (state.includes('ORDEN')) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                    <Shuffle size={11} />
                    <span>EN DESORDEN</span>
                </span>
            );
        }
        if (state.includes('INCOMPLETA')) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    <AlertTriangle size={11} />
                    <span>INCOMPLETA (&lt;4)</span>
                </span>
            );
        }
        if (state.includes('EXCEDENTE')) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <AlertOctagon size={11} />
                    <span>EXCEDENTE (&gt;4)</span>
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertOctagon size={11} />
                <span>ANÓMALA (#ERR)</span>
            </span>
        );
    };

    return (
        <div className="rounded-xl border border-cyan-500/10 bg-[#090f1d]/50 p-6 space-y-4 shadow-xl select-none">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-cyan-400" />
                        <span>Tabla de Integridad de Secuencias ABCD por Celda</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                        Verifica el cumplimiento de 4 muestras en orden secuencial por cada estación de ensayo.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    {/* Búsqueda */}
                    <div className="flex items-center gap-2 bg-slate-950 border border-navy-800 rounded-lg px-3 py-1.5 w-full sm:w-56">
                        <Search size={14} className="text-slate-500 shrink-0" />
                        <input
                            type="text"
                            placeholder="Buscar celda, lito..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-transparent text-xs text-slate-200 focus:outline-none w-full font-bold"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="text-slate-500 hover:text-slate-350">
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Selector de Estado */}
                    <select
                        value={stateFilter}
                        onChange={(e) => setStateFilter(e.target.value)}
                        className="bg-slate-950 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-bold focus:outline-none"
                    >
                        <option value="ALL">Todos los Estados</option>
                        <option value="CORRECTO">Solo Correctas (ABCD)</option>
                        <option value="DESORDEN">En Desorden</option>
                        <option value="INCOMPLETA">Incompletas (&lt;4)</option>
                        <option value="EXCEDENTE">Excedentes (&gt;4)</option>
                        <option value="ANOMALA">Anómalas (#ERR)</option>
                    </select>
                </div>
            </div>

            {/* Tabla */}
            <div className="rounded-xl border border-navy-850 bg-[#090f1d]/20 overflow-hidden">
                <div className="max-h-72 overflow-y-auto overflow-x-auto scrollbar-thin">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 font-extrabold border-b border-navy-850 uppercase tracking-wider text-xs">
                            <tr>
                                <th className="py-2.5 px-3">Celda Mapeo</th>
                                <th className="py-2.5 px-3">Fecha Ensayo</th>
                                <th className="py-2.5 px-3 text-center">Campaña</th>
                                <th className="py-2.5 px-3">Tipo Litológico</th>
                                <th className="py-2.5 px-3 text-center">Nivel</th>
                                <th className="py-2.5 px-3 text-center">Muestras</th>
                                <th className="py-2.5 px-3 text-center">Secuencia</th>
                                <th className="py-2.5 px-3 text-center">Estado Secuencia</th>
                                <th className="py-2.5 px-3 text-center text-red-400">Alertas</th>
                                <th className="py-2.5 px-3 text-center text-orange-400">Advs</th>
                                <th className="py-2.5 px-3 text-center text-yellow-400">Vacíos</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCells.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-6 text-center text-xs text-slate-500 italic font-semibold">
                                        No se encontraron celdas con los filtros aplicados.
                                    </td>
                                </tr>
                            ) : (
                                filteredCells.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        onClick={() => onSelectCell && onSelectCell(row.celda)}
                                        className="border-b border-navy-900/60 hover:bg-slate-900/30 cursor-pointer transition-all font-normal"
                                    >
                                        <td className="py-2 px-3 font-bold text-slate-200">{row.celda}</td>
                                        <td className="py-2 px-3 font-mono text-slate-400">{row.fecha || '—'}</td>
                                        <td className="py-2 px-3 text-center font-mono text-slate-400">{row.campania || '—'}</td>
                                        <td className="py-2 px-3 text-slate-300">{row.tipo_litologico || '—'}</td>
                                        <td className="py-2 px-3 text-center font-mono text-slate-400">{row.nivel ?? '—'}</td>
                                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-200">{row.total_muestras}</td>
                                        <td className="py-2 px-3 text-center font-mono font-bold text-cyan-400">{row.secuencia}</td>
                                        <td className="py-2 px-3 text-center">{getStateBadge(row.estado_secuencia)}</td>
                                        <td className="py-2 px-3 text-center font-mono font-bold text-red-400">{row.alertas || '—'}</td>
                                        <td className="py-2 px-3 text-center font-mono font-bold text-orange-400">{row.advertencias || '—'}</td>
                                        <td className="py-2 px-3 text-center font-mono font-bold text-yellow-400">{row.vacios || '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
