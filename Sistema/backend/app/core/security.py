import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
import bcrypt
from jose import jwt, JWTError

# Configuración de JWT
JWT_ISSUER = "gema-mapeo"
JWT_AUDIENCE = "gema-mapeo-api"


def signing_key():
    key = os.environ.get("JWT_SECRET_KEY", "").strip()
    if not key:
        raise RuntimeError("Configura JWT_SECRET_KEY para GEMA-Mapeo.")
    return key


ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 horas


def hash_password(password: str) -> str:
    """Genera un hash seguro con bcrypt."""
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si una contraseña en texto plano coincide con su hash bcrypt."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crea un token JWT firmado con claims de usuario y expiración."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update(exp=expire, iat=datetime.now(timezone.utc), iss=JWT_ISSUER, aud=JWT_AUDIENCE)
    encoded_jwt = jwt.encode(to_encode, signing_key(), algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """Decodifica y verifica un token JWT. Devuelve el payload o None si es inválido/expirado."""
    try:
        payload = jwt.decode(
            token, signing_key(), algorithms=[ALGORITHM], issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE, options={"require_exp": True, "require_iat": True,
                                           "require_iss": True, "require_aud": True},
        )
        return payload
    except (JWTError, RuntimeError):
        return None
