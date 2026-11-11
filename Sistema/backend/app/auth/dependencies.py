from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import models
from app.auth.scope import system_users
from app.core.security import decode_access_token
from app.database import get_db

bearer = HTTPBearer(auto_error=False)


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> Optional[models.Usuario]:
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return None
    subject = payload.get("sub")
    version = payload.get("ver")
    if not isinstance(subject, str) or not subject.isascii() or not subject.isdecimal():
        return None
    if len(subject) > 10 or int(subject) > 2147483647 or type(version) is not int:
        return None
    return system_users(db).filter(
        models.Usuario.usuario_id == int(subject),
        models.Usuario.estado == "A",
        models.Usuario.version_seguridad == version,
        models.Role.estado == "A",
    ).first()


def get_current_user(
    user: Optional[models.Usuario] = Depends(get_optional_current_user),
) -> models.Usuario:
    if user is None:
        raise HTTPException(
            status_code=401, detail="Sesión inválida o expirada.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(roles_permitidos: List[str]):
    """
    Fábrica de dependencias para verificar permisos RBAC (Control de Acceso basado en Roles).
    Ejemplo: Depends(require_role(["admin", "mapeador"]))
    """
    def role_checker(current_user: models.Usuario = Depends(get_current_user)) -> models.Usuario:
        user_role = current_user.rol.nombre if current_user.rol else None
        if not user_role or user_role not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso Denegado: Su rol ('{user_role}') no tiene permiso para esta operación. Roles requeridos: {roles_permitidos}"
            )
        return current_user

    return role_checker
