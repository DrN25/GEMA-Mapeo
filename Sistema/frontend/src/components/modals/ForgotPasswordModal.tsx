import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2, X, Mail, ShieldCheck } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8001`;

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPasswordMatch = newPassword.trim() !== '' && newPassword === confirmPassword;
  const isMinLength = newPassword.length >= 4;

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_or_username: emailOrUsername.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al solicitar el código de recuperación.');
      }

      if (data.code_preview) {
        setInfoMsg(`Código generado de prueba: ${data.code_preview}`);
        setCode(data.code_preview);
      } else {
        setInfoMsg(`Se envió un código de verificación al correo ${data.email || 'registrado'}.`);
      }

      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error al enviar el código.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !newPassword.trim() || !isPasswordMatch || !isMinLength || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_or_username: emailOrUsername.trim(),
          code: code.trim(),
          new_password: newPassword.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al restablecer contraseña.');
      }

      setSuccessMsg('¡Contraseña restablecida exitosamente! Ya puedes iniciar sesión.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Código inválido o error al actualizar contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetModal = () => {
    setStep(1);
    setEmailOrUsername('');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setInfoMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#02040a]/80 backdrop-blur-md flex justify-center items-center p-4 z-[110] animate-fade-in font-sans select-none">
      <div className="bg-[#090f1d] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-left">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <span>Recuperar Contraseña</span>
          </h3>
          <button
            onClick={handleResetModal}
            disabled={isSubmitting}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {successMsg ? (
          <div className="py-6 text-center space-y-4 animate-fade-in">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wide">¡Contraseña Restablecida!</h4>
            <p className="text-xs text-slate-300">{successMsg}</p>
            <button
              onClick={handleResetModal}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all uppercase tracking-wider mt-4"
            >
              Ir a Iniciar Sesión
            </button>
          </div>
        ) : step === 1 ? (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Ingresa tu nombre de usuario o correo electrónico para enviarte un código de verificación de 6 dígitos.
            </p>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs font-semibold animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                Usuario o Correo Electrónico <span className="text-rose-500 font-bold ml-0.5">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-[#02040a] border border-slate-800 rounded-xl pl-3.5 pr-4 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none font-medium"
                  placeholder="ej: ADMIN o carlos@gema.com"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleResetModal}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-750 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!emailOrUsername.trim() || isSubmitting}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all duration-200 active:scale-95 shadow-lg shadow-indigo-600/20 px-4 py-2 rounded-xl text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Enviar Código</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            {infoMsg && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-start gap-2.5 text-indigo-300 text-xs font-semibold animate-fade-in">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs font-semibold animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                Código de 6 Dígitos <span className="text-rose-500 font-bold ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                required
                disabled={isSubmitting}
                className="w-full bg-[#02040a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs font-mono text-center tracking-widest text-base focus:border-indigo-500 focus:outline-none"
                placeholder="123456"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                Nueva Contraseña <span className="text-rose-500 font-bold ml-0.5">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-[#02040a] border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                  placeholder="Mínimo 4 caracteres..."
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  disabled={isSubmitting}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-200 transition-colors"
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {newPassword !== '' && !isMinLength && (
                <p className="mt-1 text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Debe tener al menos 4 caracteres.</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                Confirmar Nueva Contraseña <span className="text-rose-500 font-bold ml-0.5">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-[#02040a] border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                  placeholder="Repetir nueva contraseña..."
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  disabled={isSubmitting}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-200 transition-colors"
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmPassword !== '' && !isPasswordMatch && (
                <p className="mt-1.5 text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Las contraseñas no coinciden.</span>
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-750 disabled:opacity-50"
              >
                Atrás
              </button>
              <button
                type="submit"
                disabled={!code.trim() || !newPassword.trim() || !isPasswordMatch || !isMinLength || isSubmitting}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all duration-200 active:scale-95 shadow-lg shadow-indigo-600/20 px-4 py-2 rounded-xl text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Restablecer Contraseña</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
