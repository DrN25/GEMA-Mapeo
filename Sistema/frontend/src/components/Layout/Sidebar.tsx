import {
  Home,
  Map,
  TrendingUp,
  Share2,
  Moon,
  Sun,
  BookOpen
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  selectedWindow: string | null;
}

export default function Sidebar({
  currentView,
  onViewChange,
  darkMode,
  onToggleDarkMode,
  selectedWindow
}: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Home / Dashboard', icon: Home, category: 'GENERAL' },
    { id: 'mapeo', label: 'Mapeo por Ventana', icon: Map, category: 'REGISTRO DE CAMPO' },
    { id: 'rmr', label: 'Análisis RMR', icon: TrendingUp, category: 'CONTROL Y ANÁLISIS' },
    { id: 'catalogos', label: 'Catálogos de Referencia', icon: BookOpen, category: 'CONTROL Y ANÁLISIS' },
    { id: 'grafico', label: 'Gráfico de Estructuras', icon: Share2, category: 'VISUALIZACIÓN' }
  ];

  const categories = ['GENERAL', 'REGISTRO DE CAMPO', 'CONTROL Y ANÁLISIS', 'VISUALIZACIÓN'];

  return (
    <aside className="w-64 glass-panel chrome-dark border-r border-navy-800 flex flex-col h-screen text-slate-300 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-navy-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-100 tracking-wider bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">VENTANAS 2.0</h1>
          <p className="text-xs text-orange-500 dark:text-amber-400 font-bold uppercase mt-0.5">
            {selectedWindow ? `Celda: ${selectedWindow}` : 'Ninguna celda'}
          </p>
        </div>
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-400 hover:text-slate-100 transition-colors shadow-md active:scale-95 animate-pulse-ring"
          title="Alternar Modo Claro/Oscuro"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {categories.map(category => {
          const items = menuItems.filter(item => item.category === category);
          if (items.length === 0) return null;

          return (
            <div key={category} className="space-y-1">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest px-3 mb-2">
                {category}
              </h3>
              {items.map(item => {
                const isActive = currentView === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-all group relative ${
                      isActive
                        ? 'bg-orange-600/10 text-orange-600 dark:bg-orange-500/10 dark:text-amber-400 font-bold border-l-2 border-orange-600 dark:border-amber-400 shadow-sm'
                        : 'hover:bg-navy-900/40 hover:text-slate-100 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left min-w-0">
                      <Icon
                        size={18}
                        className={`${isActive ? 'text-orange-600 dark:text-amber-400' : 'text-slate-500 group-hover:text-orange-600 dark:group-hover:text-amber-400'
                          } transition-colors shrink-0`}
                      />
                      <span className="text-left leading-tight break-words">{item.label}</span>
                    </div>

                    {isActive && (
                      <span className="absolute right-0 top-1 bottom-1 w-1 bg-orange-600 dark:bg-amber-400 rounded-l-md" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-navy-800 text-xs text-slate-500 text-center font-bold">
        Ventanas Geomecánicas &copy; 2026
      </div>
    </aside>
  );
}
