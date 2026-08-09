from typing import List, Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> models.Usuario:
    """
    Inyección de dependencia para validar el token JWT y retornar el usuario activo.
    Soporta extracción por Bearer scheme estándar y por header directo.
    """
    jwt_token = token
    if not jwt_token and authorization:
        if authorization.startswith("Bearer "):
            jwt_token = authorization.split(" ")[1]
        else:
            jwt_token = authorization

    if not jwt_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se proporcionó token de autenticación (Header Authorization requerido).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(jwt_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticación inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username_or_email = payload.get("sub")
    if not username_or_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sin sujeto de usuario.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Buscar por Usuario o por Email
    user = db.query(models.Usuario).filter(
        (models.Usuario.usuario == username_or_email) | (models.Usuario.email == username_or_email)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado en la base de datos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verificar Estado ('A' = Activo)
    if user.estado != 'A':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta de usuario inhabilitada o desactivada. Contacte al administrador.",
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
