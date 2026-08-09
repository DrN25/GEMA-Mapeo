import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import type { User, Role } from '../../types/auth';
import { CheckCircle2, AlertTriangle, Loader2, Plus, Edit, ShieldAlert, X, Shield, UserCheck, Eye, EyeOff } from 'lucide-react';

export const AdminUsersView: React.FC = () => {
  const { authFetch, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Submitting state para prevenir múltiples clics
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingActionId, setSubmittingActionId] = useState<string | null>(null);

  // Visibilidad de contraseñas
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewConfirmPassword, setShowNewConfirmPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Modal Feedback de Resultado / Éxito / Alerta
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: ''
  });

  // Modal Confirmación de Cambio de Estado
  const [confirmStatusModal, setConfirmStatusModal] = useState<{
    isOpen: boolean;
    targetUser: User | null;
    newStatus: string;
  }>({
    isOpen: false,
    targetUser: null,
    newStatus: 'A'
  });

  // Modal Crear Usuario
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsuario, setNewUsuario] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [newNombreCompleto, setNewNombreCompleto] = useState('');
  const [newRolId, setNewRolId] = useState<number>(2); // Default 'mapeador'

  // Modal Editar Usuario
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editUsuario, setEditUsuario] = useState('');
  const [editNombreCompleto, setEditNombreCompleto] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRolId, setEditRolId] = useState<number>(2);
  const [editPassword, setEditPassword] = useState('');

  // Carga inicial y por filtro
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter ? `/api/admin/usuarios?estado=${statusFilter}` : '/api/admin/usuarios';
      const [uRes, rRes] = await Promise.all([
        authFetch(url),
        authFetch('/api/admin/roles')
      ]);

      if (!uRes.ok || !rRes.ok) {
        throw new Error('Error al cargar la lista de usuarios o roles.');
      }

      const uData: User[] = await uRes.json();
      const rData: Role[] = await rRes.json();

      setUsers(uData);
      setRoles(rData);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con la API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  // Validaciones en tiempo real para Crear Usuario
  const cleanCreateUsuario = newUsuario.trim().toUpperCase();
  const cleanCreateEmail = newEmail.trim().toLowerCase();

  const isCreateUserDuplicate = cleanCreateUsuario !== '' && users.some(u => u.usuario.trim().toUpperCase() === cleanCreateUsuario);
  const isCreateEmailDuplicate = cleanCreateEmail !== '' && users.some(u => u.email.trim().toLowerCase() === cleanCreateEmail);
  const isPasswordMatch = newPassword.trim() !== '' && newPassword === newConfirmPassword;
  const isCreateValid = cleanCreateUsuario !== '' && !isCreateUserDuplicate && cleanCreateEmail !== '' && !isCreateEmailDuplicate && isPasswordMatch && !isSubmitting;

  // Validaciones en tiempo real para Editar Usuario
  const cleanEditUsuario = editUsuario.trim().toUpperCase();
  const cleanEditEmail = editEmail.trim().toLowerCase();

  const isEditUserDuplicate = editUser !== null && cleanEditUsuario !== '' && users.some(u => Number(u.usuario_id) !== Number(editUser.usuario_id) && u.usuario.trim().toUpperCase() === cleanEditUsuario);
  const isEditEmailDuplicate = editUser !== null && cleanEditEmail !== '' && users.some(u => Number(u.usuario_id) !== Number(editUser.usuario_id) && (u.email || '').trim().toLowerCase() === cleanEditEmail);
  const isEditValid = editUser !== null && cleanEditUsuario !== '' && !isEditUserDuplicate && cleanEditEmail !== '' && !isEditEmailDuplicate && !isSubmitting;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCreateValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: cleanCreateUsuario,
          email: cleanCreateEmail,
          password: newPassword.trim(),
          nombre_completo: newNombreCompleto.trim() || undefined,
          rol_id: newRolId
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error al crear usuario.');
      }

      setShowCreateModal(false);
      setNewUsuario('');
      setNewEmail('');
      setNewPassword('');
      setNewConfirmPassword('');
      setNewNombreCompleto('');
      await loadData();

      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Usuario Creado Exitosamente',
        message: `El usuario '${cleanCreateUsuario}' ha sido registrado en la base de datos con el rol seleccionado.`
      });
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Error al Crear Usuario',
        message: err.message || 'No se pudo completar la transacción.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditOpen = (u: User) => {
    setEditUser(u);
    setEditUsuario(u.usuario);
    setEditNombreCompleto(u.nombre_completo || '');
    setEditEmail(u.email);
    setEditRolId(u.rol_id);
    setEditPassword('');
    setShowEditPassword(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser || !isEditValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await authFetch(`/api/admin/usuarios/${editUser.usuario_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: cleanEditUsuario,
          nombre_completo: editNombreCompleto.trim() || undefined,
          email: cleanEditEmail,
          rol_id: editRolId,
          password: editPassword.trim() || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error al actualizar usuario.');
      }

      setEditUser(null);
      await loadData();

      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Usuario Actualizado Exitosamente',
        message: `Los cambios para la cuenta '${cleanEditUsuario}' han sido guardados correctamente.`
      });
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Error al Actualizar Usuario',
        message: err.message || 'No se pudo guardar la información.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openConfirmStatus = (user: User, newStatus: string) => {
    setConfirmStatusModal({
      isOpen: true,
      targetUser: user,
      newStatus
    });
  };

  const executeStatusChange = async () => {
    const { targetUser, newStatus } = confirmStatusModal;
    if (!targetUser || isSubmitting) return;

    const actionKey = `status-${targetUser.usuario_id}-${newStatus}`;
    setIsSubmitting(true);
    setSubmittingActionId(actionKey);

    try {
      const res = await authFetch(`/api/admin/usuarios/${targetUser.usuario_id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: newStatus })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error al actualizar el estado.');
      }

      const statusLabels: Record<string, string> = {
        'A': 'activado',
        'I': 'inactivado',
        '*': 'eliminado (borrado lógico)'
      };

      setConfirmStatusModal({ isOpen: false, targetUser: null, newStatus: 'A' });
      await loadData();

      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Estado Actualizado',
        message: `La cuenta '${targetUser.usuario}' fue marcada como ${statusLabels[newStatus] || newStatus} en SQL Server.`
      });
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Operación Rechazada',
        message: err.message || 'Ocurrió un error al actualizar el estado del usuario.'
      });
    } finally {
      setIsSubmitting(false);
      setSubmittingActionId(null);
    }
  };

  const renderStatusBadge = (st: string) => {
    switch (st) {
      case 'A':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Activo ('A')</span>;
      case 'I':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Inactivo ('I')</span>;
      case '*':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Eliminado ('*')</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-navy-850 text-slate-400">{st}</span>;
    }
  };

  return (
    <div className="space-y-6 select-none w-full animate-fade-in text-left font-sans text-slate-300">
      {/* Header View: Estilo idéntico a Dashboard.tsx / Mapeo por Ventana */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 tracking-wide flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
            <span>Gestión de Usuarios y Control de Accesos</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Administración de Cuentas RBAC y Auditoría del Sistema GEMA
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setNewUsuario('');
              setNewEmail('');
              setNewPassword('');
              setNewConfirmPassword('');
              setNewNombreCompleto('');
              setShowNewPassword(false);
              setShowNewConfirmPassword(false);
              setShowCreateModal(true);
            }}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.12)] px-4 py-2 rounded-lg text-xs disabled:opacity-50"
          >
            <Plus size={16} />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-[#090f1d]/60 border border-slate-800 p-3 rounded-xl">
        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-2">Filtrar por Estado:</span>
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === '' ? 'bg-indigo-600 text-white' : 'bg-navy-850 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setStatusFilter('A')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === 'A' ? 'bg-emerald-600 text-white' : 'bg-navy-850 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          Activos ('A')
        </button>
        <button
          onClick={() => setStatusFilter('I')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === 'I' ? 'bg-amber-600 text-white' : 'bg-navy-850 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          Inactivos ('I')
        </button>
        <button
          onClick={() => setStatusFilter('*')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === '*' ? 'bg-rose-600 text-white' : 'bg-navy-850 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          Eliminados ('*')
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-semibold">
          <Loader2 className="animate-spin h-7 w-7 text-indigo-500 mx-auto mb-3" />
          Cargando usuarios...
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold">
          {error}
        </div>
      ) : (
        <div className="bg-[#090f1d]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#02040a]/90 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Nombre Completo</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Rol RBAC</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Último Acceso</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {users.map((u) => {
                  return (
                    <tr key={u.usuario_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-100">{u.usuario}</td>
                      <td className="px-6 py-4 text-slate-300">{u.nombre_completo || '—'}</td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {u.rol_nombre}
                        </span>
                      </td>
                      <td className="px-6 py-4">{renderStatusBadge(u.estado)}</td>
                      <td className="px-6 py-4 text-[11px] text-slate-500 font-mono">
                        {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString() : 'Nunca'}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleEditOpen(u)}
                          disabled={isSubmitting}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-lg transition-all border border-slate-700 disabled:opacity-50"
                        >
                          Editar
                        </button>

                        {u.usuario_id !== currentUser?.usuario_id && (
                          <>
                            {u.estado === 'A' ? (
                              <button
                                onClick={() => openConfirmStatus(u, 'I')}
                                disabled={isSubmitting}
                                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-lg transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                              >
                                {submittingActionId === `status-${u.usuario_id}-I` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : null}
                                <span>Inactivar</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => openConfirmStatus(u, 'A')}
                                disabled={isSubmitting}
                                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-lg transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                              >
                                {submittingActionId === `status-${u.usuario_id}-A` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : null}
                                <span>Activar</span>
                              </button>
                            )}

                            {u.estado !== '*' && (
                              <button
                                onClick={() => openConfirmStatus(u, '*')}
                                disabled={isSubmitting}
                                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold rounded-lg transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                              >
                                {submittingActionId === `status-${u.usuario_id}-*` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : null}
                                <span>Eliminar</span>
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-[#02040a]/80 backdrop-blur-md flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="bg-[#090f1d] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
                <Plus className="w-4 h-4 text-violet-400" />
                <span>Crear Nuevo Usuario</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={isSubmitting}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Usuario Corto (para Auditoría, ej: CBAL) <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={newUsuario}
                  onChange={(e) => setNewUsuario(e.target.value.toUpperCase())}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-[#02040a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none uppercase font-bold"
                  placeholder="ej: CBAL"
                />
                {isCreateUserDuplicate && (
                  <p className="mt-1.5 text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>El usuario '{cleanCreateUsuario}' ya se encuentra registrado.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Correo Electrónico <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-[#02040a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                  placeholder="ej: carlos@gema.com"
                />
                {isCreateEmailDuplicate && (
                  <p className="mt-1.5 text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>El correo '{cleanCreateEmail}' ya se encuentra en uso.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Nombre Completo (Opcional)
                </label>
                <input
                  type="text"
                  value={newNombreCompleto}
                  onChange={(e) => setNewNombreCompleto(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-[#02040a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                  placeholder="ej: Carlos Baldoza Llerena"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Contraseña Inicial <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full bg-[#02040a] border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    disabled={isSubmitting}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-200 transition-colors"
                    title={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Confirmar Contraseña <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewConfirmPassword ? 'text' : 'password'}
                    value={newConfirmPassword}
                    onChange={(e) => setNewConfirmPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full bg-[#02040a] border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewConfirmPassword(!showNewConfirmPassword)}
                    disabled={isSubmitting}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-200 transition-colors"
                    title={showNewConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showNewConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {newConfirmPassword !== '' && !isPasswordMatch && (
                  <p className="mt-1.5 text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Las contraseñas no coinciden.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Rol de Usuario RBAC <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <select
                  value={newRolId}
                  onChange={(e) => setNewRolId(Number(e.target.value))}
                  disabled={isSubmitting}
                  className="w-full bg-[#02040a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.rol_id} value={r.rol_id}>
                      {r.nombre} — {r.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-750 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isCreateValid}
                  className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.12)] px-4 py-2 rounded-lg text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                      <span>Creando...</span>
                    </>
                  ) : (
                    <span>Crear Usuario</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Usuario */}
      {editUser && (
        <div className="fixed inset-0 bg-[#02040a]/80 backdrop-blur-md flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="bg-[#090f1d] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
                <Edit className="w-4 h-4 text-indigo-400" />
                <span>Editar Usuario: {editUser.usuario}</span>
              </h3>
              <button
                onClick={() => setEditUser(null)}
                disabled={isSubmitting}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Usuario Corto <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={editUsuario}
                  onChange={(e) => setEditUsuario(e.target.value.toUpperCase())}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-[#02040a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none uppercase font-bold"
                />
                {isEditUserDuplicate && (
                  <p className="mt-1.5 text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>El usuario '{cleanEditUsuario}' ya está en uso por otro registro.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Correo Electrónico <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full bg-[#02040a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                />
                {isEditEmailDuplicate && (
                  <p className="mt-1.5 text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>El correo '{cleanEditEmail}' ya está en uso por otro usuario.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={editNombreCompleto}
                  onChange={(e) => setEditNombreCompleto(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-[#02040a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Rol de Usuario RBAC <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <select
                  value={editRolId}
                  onChange={(e) => setEditRolId(Number(e.target.value))}
                  disabled={isSubmitting}
                  className="w-full bg-[#02040a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.rol_id} value={r.rol_id}>
                      {r.nombre} — {r.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Cambiar Contraseña (Dejar en blanco para conservar actual)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Nueva contraseña opcional..."
                    disabled={isSubmitting}
                    className="w-full bg-[#02040a] border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    disabled={isSubmitting}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-200 transition-colors"
                    title={showEditPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-750 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isEditValid}
                  className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.12)] px-4 py-2 rounded-lg text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar Cambios</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Cambio de Estado */}
      {confirmStatusModal.isOpen && confirmStatusModal.targetUser && (
        <div className="fixed inset-0 bg-[#02040a]/80 backdrop-blur-md flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="bg-[#090f1d] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6 text-amber-400" />
            </div>

            <h3 className="text-base font-bold text-slate-100 uppercase tracking-wide">
              Confirmar Cambio de Estado
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              ¿Está seguro de que desea cambiar el estado de la cuenta de{' '}
              <span className="font-bold text-indigo-400">{confirmStatusModal.targetUser.usuario}</span> a{' '}
              <span className="font-bold text-slate-100">
                {confirmStatusModal.newStatus === 'A' ? 'ACTIVO (\'A\')' : confirmStatusModal.newStatus === 'I' ? 'INACTIVO (\'I\')' : 'ELIMINADO (\'*\')'}
              </span>?
            </p>

            <div className="flex justify-center gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmStatusModal({ isOpen: false, targetUser: null, newStatus: 'A' })}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-750 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeStatusChange}
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.12)] px-4 py-2 rounded-lg text-xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <span>Confirmar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Feedback de Resultado */}
      {feedbackModal.isOpen && (
        <div className="fixed inset-0 bg-[#02040a]/80 backdrop-blur-md flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="bg-[#090f1d] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${feedbackModal.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : feedbackModal.type === 'error'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              }`}>
              {feedbackModal.type === 'success' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : feedbackModal.type === 'error' ? (
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-indigo-400" />
              )}
            </div>

            <h3 className="text-base font-bold text-slate-100 uppercase tracking-wide">
              {feedbackModal.title}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {feedbackModal.message}
            </p>

            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setFeedbackModal({ isOpen: false, type: 'info', title: '', message: '' })}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-100 text-xs font-bold rounded-xl transition-all uppercase tracking-wider"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
