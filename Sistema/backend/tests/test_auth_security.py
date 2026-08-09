from datetime import timedelta
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token


def test_password_hashing_and_verification():
    raw_password = "Admin2026!"
    hashed = hash_password(raw_password)

    # El hash no debe ser igual al texto plano
    assert hashed != raw_password
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    # Verificación correcta
    assert verify_password("Admin2026!", hashed) is True

    # Verificación de clave errónea
    assert verify_password("PasswordErrada", hashed) is False
    assert verify_password("", hashed) is False
    assert verify_password("Admin2026!", "") is False


def test_jwt_creation_and_decoding():
    data = {"sub": "ADMIN", "rol": "admin"}
    token = create_access_token(data=data, expires_delta=timedelta(minutes=30))

    assert isinstance(token, str)
    assert len(token) > 20

    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == "ADMIN"
    assert payload.get("rol") == "admin"
    assert "exp" in payload


def test_jwt_expired_or_invalid():
    # Token expirado
    data = {"sub": "EXPIRED_USER", "rol": "mapeador"}
    expired_token = create_access_token(data=data, expires_delta=timedelta(seconds=-10))

    payload = decode_access_token(expired_token)
    assert payload is None

    # Token corrupto o alterado
    invalid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature"
    assert decode_access_token(invalid_token) is None
