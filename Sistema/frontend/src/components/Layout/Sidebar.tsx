import React, { useState } from 'react';
import { Home, Map, TrendingUp, Share2, Moon, Sun, FileSpreadsheet, Users, LogOut, ShieldAlert, Key } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ChangePasswordModal } from '../modals/ChangePasswordModal';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  selectedWindow: string | null;
  isCollapsed: boolean;
}

export default function Sidebar({
  currentView,
  onViewChange,
  darkMode,
  onToggleDarkMode,
  selectedWindow,
  isCollapsed
}: SidebarProps) {
  const { user, logout, hasRole } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Home / Dashboard', icon: Home, category: 'GENERAL' },
    { id: 'mapeo', label: 'Mapeo por Ventana', icon: Map, category: 'REGISTRO DE CAMPO' },
    { id: 'grafico', label: 'Gráfico de Estructuras', icon: Share2, category: 'VISUALIZACIÓN' },
    { id: 'plt_ensayos', label: 'Ensayos PLT Irregulares', icon: TrendingUp, category: 'ENSAYOS' },
    { id: 'auditoria_masiva', label: 'Carga para Revision', icon: FileSpreadsheet, category: 'REVISION GENERAL' }
  ];

  if (hasRole(['admin'])) {
    menuItems.push({ id: 'admin_usuarios', label: 'Gestión de Usuarios', icon: Users, category: 'ADMINISTRACIÓN' });
  }

  const categories = ['GENERAL', 'REGISTRO DE CAMPO', 'VISUALIZACIÓN', 'ENSAYOS', 'REVISION GENERAL', 'ADMINISTRACIÓN'];

  return (
    <>
      <aside className={`glass-panel chrome-dark flex flex-col h-screen select-none shadow-2xl relative z-20 transition-all duration-300 ease-in-out ${isCollapsed
        ? 'w-0 opacity-0 border-r-0 pointer-events-none overflow-hidden'
        : 'w-64 opacity-100 border-r border-slate-200/80 dark:border-navy-800/80'
        }`}>
        {/* Contenedor estático para evitar que los textos internos se amontonen o deformen durante la animación */}
        <div className="w-64 flex flex-col h-full shrink-0">
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-200/80 dark:border-navy-800/80 flex items-center justify-between">
            <div>
              <h1 className="text-base font-black tracking-widest bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 dark:from-indigo-400 dark:via-violet-400 dark:to-indigo-500 bg-clip-text text-transparent">VENTANAS 2.0</h1>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-widest mt-1">
                {selectedWindow ? `Celda: ${selectedWindow}` : 'Ninguna Celda'}
              </p>
            </div>
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-850 border border-slate-200 dark:border-navy-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-slate-100 transition-all shadow-sm active:scale-95"
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
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-navy-800" />
                    <span>{category}</span>
                  </h3>
                  {items.map(item => {
                    const isActive = currentView === item.id;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        onClick={() => onViewChange(item.id)}
                        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs text-left transition-all relative group ${isActive
                          ? 'bg-indigo-50 dark:bg-indigo-600/10 text-indigo-700 dark:text-indigo-400 font-bold border-l-4 border-indigo-600 dark:border-indigo-500 shadow-sm'
                          : 'hover:bg-slate-100/80 dark:hover:bg-navy-900/30 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-semibold'
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            size={16}
                            className={`${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                              } transition-colors shrink-0`}
                          />
                          <span className="leading-tight break-words tracking-wide">{item.label}</span>
                        </div>

                        {isActive && (
                          <span className="absolute right-0 top-1 bottom-1 w-1 bg-indigo-600 dark:bg-indigo-500 rounded-l-md shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* User Profile & Logout Footer */}
          {user && (
            <div className="p-3 mx-3 mb-2 rounded-xl bg-slate-50 dark:bg-navy-900/90 border border-slate-200 dark:border-navy-800 space-y-2.5 shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                  {user.usuario.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{user.usuario}</p>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider truncate leading-tight">{user.rol_nombre}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowChangePasswordModal(true)}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-white dark:bg-indigo-500/10 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 text-[11px] font-bold transition-all active:scale-95 shadow-sm"
                  title="Cambiar Mi Contraseña"
                >
                  <Key size={13} />
                  <span>Contraseña</span>
                </button>

                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 text-[11px] font-bold transition-all active:scale-95 shadow-sm"
                  title="Cerrar Sesión del Sistema"
                >
                  <LogOut size={13} />
                  <span>Salir</span>
                </button>
              </div>
            </div>
          )}

          <div className="p-3 border-t border-slate-200/80 dark:border-navy-800/80 text-[10px] text-slate-400 dark:text-slate-500 text-center font-black uppercase tracking-wider">
            Mapeo de Ventanas &copy; 2026
          </div>
        </div>
      </aside>

      {/* Modal Confirmación de Cerrar Sesión */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-[#02040a]/80 backdrop-blur-md flex justify-center items-center p-4 z-[100] animate-fade-in font-sans select-none">
          <div className="bg-white dark:bg-[#090f1d] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>

            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
              ¿Cerrar Sesión?
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              ¿Está seguro de que desea salir del sistema GEMA? Se cerrará la sesión del usuario{' '}
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{user?.usuario}</span>.
            </p>

            <div className="flex justify-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all border border-slate-200 dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <LogOut size={14} />
                <span>Confirmar Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar Mi Contraseña */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </>
  );
}