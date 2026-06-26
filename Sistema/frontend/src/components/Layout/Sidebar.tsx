import {
  Home,
  Map,
  TrendingUp,
  Share2,
  Moon,
  Sun,
  FileSpreadsheet
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  selectedWindow: string | null;
  isCollapsed: boolean; // <-- PROPIEDAD AÑADIDA
}

export default function Sidebar({
  currentView,
  onViewChange,
  darkMode,
  onToggleDarkMode,
  selectedWindow,
  isCollapsed // <-- DESTRUCTURACIÓN
}: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Home / Dashboard', icon: Home, category: 'GENERAL' },
    { id: 'mapeo', label: 'Mapeo por Ventana', icon: Map, category: 'REGISTRO DE CAMPO' },
    { id: 'grafico', label: 'Gráfico de Estructuras', icon: Share2, category: 'VISUALIZACIÓN' },
    { id: 'plt_ensayos', label: 'Ensayos PLT Irregulares', icon: TrendingUp, category: 'ENSAYOS' },
    { id: 'auditoria_masiva', label: 'Auditoría de Ingesta', icon: FileSpreadsheet, category: 'AUDITORIA' }
  ];

  const categories = ['GENERAL', 'REGISTRO DE CAMPO', 'VISUALIZACIÓN', 'ENSAYOS', 'AUDITORIA'];

  return (
    <aside className={`glass-panel chrome-dark flex flex-col h-screen text-slate-300 select-none shadow-2xl relative z-20 transition-all duration-300 ease-in-out ${isCollapsed
        ? 'w-0 opacity-0 border-r-0 pointer-events-none overflow-hidden'
        : 'w-64 opacity-100 border-r border-navy-800/80'
      }`}>
      {/* Contenedor estático para evitar que los textos internos se amontonen o deformen durante la animación */}
      <div className="w-64 flex flex-col h-full shrink-0">
        {/* Brand Header */}
        <div className="p-5 border-b border-navy-800/80 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-slate-100 tracking-widest bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-500 bg-clip-text text-transparent">VENTANAS 2.0</h1>
            <p className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest mt-1">
              {selectedWindow ? `Celda: ${selectedWindow}` : 'Ninguna Celda'}
            </p>
          </div>
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-400 hover:text-slate-100 transition-all shadow-md active:scale-95"
            title="Alternar Modo Claro/Oscuro"
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {categories.map(category => {
            const items = menuItems.filter(item => item.category === category);
            if (items.length === 0) return null;

            return (
              <div key={category} className="space-y-1.5">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-navy-800" />
                  <span>{category}</span>
                </h3>
                {items.map(item => {
                  const isActive = currentView === item.id;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onViewChange(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-xs text-left transition-all relative group ${isActive
                        ? 'bg-indigo-600/10 text-indigo-400 font-bold border-l-2 border-indigo-500 shadow-[inset_0_0_10px_rgba(99,102,241,0.05)]'
                        : 'hover:bg-navy-900/30 hover:text-slate-200 text-slate-400'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          size={16}
                          className={`${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-indigo-400'
                            } transition-colors shrink-0`}
                        />
                        <span className="leading-tight break-words font-semibold tracking-wide">{item.label}</span>
                      </div>

                      {isActive && (
                        <span className="absolute right-0 top-1 bottom-1 w-1 bg-indigo-500 rounded-l-md shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-navy-800/80 text-[10px] text-slate-500 text-center font-black uppercase tracking-wider">
          Mapeo de Ventanas &copy; 2026
        </div>
      </div>
    </aside>
  );
}