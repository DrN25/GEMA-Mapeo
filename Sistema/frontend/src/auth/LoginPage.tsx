import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { pingBackend } from '../utils/apiClient';
import { applyStoredTheme } from '../utils/theme';
import { Eye, EyeOff, Loader2, WifiOff, RefreshCw, Lock } from 'lucide-react';
import { ForgotPasswordModal } from '../components/modals/ForgotPasswordModal';

const API_BASE = import.meta.env.VITE_API_BASE || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:8001`
    : ''
);

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Estado para la verificación previa de conectividad con el backend
  const [checkingBackend, setCheckingBackend] = useState(true);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const checkConnection = async () => {
    setCheckingBackend(true);
    setError(null);
    try {
      const ok = await pingBackend(API_BASE);
      setBackendOnline(ok);
    } catch {
      setBackendOnline(false);
    } finally {
      setCheckingBackend(false);
    }
  };

  useEffect(() => {
    // Respetar el tema guardado en localStorage (claro/oscuro)
    applyStoredTheme();
    checkConnection();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!usernameOrEmail.trim() || !password.trim()) {
      setError('Por favor ingrese su usuario o correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await login({
        username_or_email: usernameOrEmail.trim(),
        password: password
      });
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas. Verifique sus datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#02040a] text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden font-sans select-none">
      {/* Ambient glow background */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#090f1d]/90 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl p-8 z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4 shadow-lg shadow-indigo-500/5">
            <Lock className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-xl font-black tracking-widest bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-500 bg-clip-text text-transparent uppercase">
            VENTANAS 2.0
          </h1>
          <p className="text-xs text-indigo-400 font-extrabold uppercase tracking-widest mt-1">
            Mapeo Geomecánico & Control de Acceso
          </p>
        </div>

        {/* Pantalla de Carga/Verificación de Conectividad con el Backend */}
        {checkingBackend ? (
          <div className="py-8 text-center space-y-4 animate-fade-in">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <div>
              <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Conectando con el servidor GEMA...</p>
              <p className="text-[11px] text-slate-400 mt-1">Verificando disponibilidad de base de datos y servicios</p>
            </div>
          </div>
        ) : backendOnline === false ? (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3 animate-fade-in text-left">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>Servidor Inaccesible o Despertando</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              No se pudo establecer comunicación inicial con el backend. Si el sistema está alojado en Render, el servidor puede tardar unos segundos en despertar.
            </p>
            <button
              onClick={checkConnection}
              className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar Conexión</span>
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 text-xs font-semibold animate-fade-in">
                <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                  Usuario o Correo Electrónico <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="ej: ADMIN o usuario@gema.com"
                  disabled={loading}
                  className="w-full bg-[#02040a] border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Contraseña <span className="text-rose-500 font-bold ml-0.5">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    className="w-full bg-[#02040a] border border-slate-800 rounded-xl pl-4 pr-11 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-200 transition-colors"
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50 flex justify-center items-center gap-2 text-xs uppercase tracking-wider"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 text-white" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <span>Iniciar Sesión</span>
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">
            Mapeo de Ventanas &copy; 2026
          </p>
        </div>
      </div>

      {/* Modal Olvidaste Tu Contraseña */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </div>
  );
};
