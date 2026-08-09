import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_login_success():
    response = client.post(
        "/api/auth/login",
        json={"username_or_email": "ADMIN", "password": "Admin2026!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["usuario"] == "ADMIN"
    assert data["user"]["rol_nombre"] == "admin"


def test_login_invalid_credentials():
    response = client.post(
        "/api/auth/login",
        json={"username_or_email": "ADMIN", "password": "ClaveIncorrecta"}
    )
    assert response.status_code == 401
    assert "Credenciales incorrectas" in response.json()["detail"]


def test_get_me_protected_endpoint():
    # 1. Sin Token -> 401
    unauth_resp = client.get("/api/auth/me")
    assert unauth_resp.status_code == 401

    # 2. Login para obtener token
    login_resp = client.post(
        "/api/auth/login",
        json={"username_or_email": "ADMIN", "password": "Admin2026!"}
    )
    token = login_resp.json()["access_token"]

    # 3. Con Token -> 200
    auth_resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert auth_resp.status_code == 200
    data = auth_resp.json()
    assert data["usuario"] == "ADMIN"
    assert data["email"] == "admin@gema.com"


def test_admin_list_users_protected():
    login_resp = client.post(
        "/api/auth/login",
        json={"username_or_email": "ADMIN", "password": "Admin2026!"}
    )
    token = login_resp.json()["access_token"]

    response = client.get(
        "/api/admin/usuarios",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    users = response.json()
    assert isinstance(users, list)
    assert len(users) >= 1
    assert any(u["usuario"] == "ADMIN" for u in users)
