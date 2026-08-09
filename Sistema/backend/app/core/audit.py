from datetime import datetime
from typing import Any

def apply_audit(instance: Any, current_user: Any, is_new: bool = True) -> None:
    """
    Helper de auditoría reutilizable para cualquier modelo de SQLAlchemy.
    Asigna automáticamente el campo `Usuario` (o `Email` como fallback)
    y la fecha/hora actual del servidor.
    """
    if not instance or not current_user:
        return

    now = datetime.now()
    user_str = getattr(current_user, 'usuario', None) or getattr(current_user, 'email', None) or 'SYSTEM'

    if is_new:
        if hasattr(instance, 'usuario_registro') or hasattr(instance, 'UsuarioRegistro'):
            if hasattr(instance, 'usuario_registro'):
                setattr(instance, 'usuario_registro', user_str)
            else:
                setattr(instance, 'UsuarioRegistro', user_str)

        if hasattr(instance, 'fecha_registro') or hasattr(instance, 'FechaRegistro'):
            current_freg = getattr(instance, 'fecha_registro', None) or getattr(instance, 'FechaRegistro', None)
            if not current_freg:
                if hasattr(instance, 'fecha_registro'):
                    setattr(instance, 'fecha_registro', now)
                else:
                    setattr(instance, 'FechaRegistro', now)
    else:
        if hasattr(instance, 'usuario_modificacion') or hasattr(instance, 'UsuarioModificacion'):
            if hasattr(instance, 'usuario_modificacion'):
                setattr(instance, 'usuario_modificacion', user_str)
            else:
                setattr(instance, 'UsuarioModificacion', user_str)

        if hasattr(instance, 'fecha_modificacion') or hasattr(instance, 'FechaModificacion'):
            if hasattr(instance, 'fecha_modificacion'):
                setattr(instance, 'fecha_modificacion', now)
            else:
                setattr(instance, 'FechaModificacion', now)
