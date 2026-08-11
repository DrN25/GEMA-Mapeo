import React, { useState } from 'react';
import { Key, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { authFetch } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPasswordMatch = newPassword.trim() !== '' && newPassword === confirmPassword;
  const isMinLength = newPassword.length >= 4;
  const isValid = oldPassword.trim() !== '' && newPassword.trim() !== '' && isPasswordMatch && isMinLength && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Error al cambiar contraseña.');
      }

      setSuccessMsg('¡Contraseña actualizada exitosamente!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-[#02040a]/80 backdrop-blur-md flex justify-center items-center p-4 z-[110] animate-fade-in font-sans select-none">
      <div className="bg-white dark:bg-[#090f1d] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-slate-800 dark:text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Cambiar Mi Contraseña</span>
          </h3>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {successMsg ? (
          <div className="py-6 text-center space-y-4 animate-fade-in">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">¡Operación Completada!</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">{successMsg}</p>
            <button
              onClick={handleClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl transition-all uppercase tracking-wider mt-4 border border-slate-200 dark:border-slate-700"
            >
              Aceptar y Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Contraseña Actual <span className="text-rose-500 font-bold ml-0.5">*</span>
              </label>
              <div className="relative">
                <input
                  type={showOld ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 dark:bg-[#02040a] border border-slate-200 dark:border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-800 dark:text-slate-100 text-xs focus:border-indigo-500 focus:outline-none font-medium placeholder-slate-400 dark:placeholder-slate-600"
                  placeholder="Contraseña actual..."
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  disabled={isSubmitting}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title={showOld ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Nueva Contraseña <span className="text-rose-500 font-bold ml-0.5">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 dark:bg-[#02040a] border border-slate-200 dark:border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-800 dark:text-slate-100 text-xs focus:border-indigo-500 focus:outline-none font-medium placeholder-slate-400 dark:placeholder-slate-600"
                  placeholder="Mínimo 4 caracteres..."
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  disabled={isSubmitting}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title={showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {newPassword !== '' && !isMinLength && (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Debe tener al menos 4 caracteres.</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Confirmar Nueva Contraseña <span className="text-rose-500 font-bold ml-0.5">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 dark:bg-[#02040a] border border-slate-200 dark:border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-800 dark:text-slate-100 text-xs focus:border-indigo-500 focus:outline-none font-medium placeholder-slate-400 dark:placeholder-slate-600"
                  placeholder="Repetir nueva contraseña..."
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  disabled={isSubmitting}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmPassword !== '' && !isPasswordMatch && (
                <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Las contraseñas no coinciden.</span>
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!isValid}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all duration-200 active:scale-95 shadow-md px-4 py-2 rounded-xl text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Actualizar Contraseña</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
