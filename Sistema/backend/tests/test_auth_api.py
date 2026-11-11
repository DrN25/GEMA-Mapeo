from datetime import datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.auth import router as auth
from app.core.security import hash_password
from app.database import get_db
from app.routers import admin


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "isolated-test-key-for-mapeo")
    monkeypatch.delenv("BREVO_API_KEY", raising=False)
    engine = create_engine("sqlite://", poolclass=StaticPool,
                           connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def attach_schemas(connection, _):
        connection.execute("ATTACH DATABASE ':memory:' AS auth")
        connection.execute("ATTACH DATABASE ':memory:' AS dbo")
        connection.execute("PRAGMA foreign_keys=ON")

    for model in (models.Sistema, models.Role, models.Usuario):
        model.__table__.create(engine)
    session = sessionmaker(bind=engine)
    with session.begin() as db:
        db.add_all([
            models.Sistema(sistema_id=1, codigo="mapeo", nombre="Mapeo", estado="A"),
            models.Sistema(sistema_id=2, codigo="logueo", nombre="Logueo", estado="A"),
        ])
        db.flush()
        db.add_all([
            models.Role(rol_id=1, sistema_id=1, nombre="admin", estado="A", protegido=True),
            models.Role(rol_id=2, sistema_id=2, nombre="admin", estado="A"),
            models.Role(rol_id=3, sistema_id=1, nombre="lectura", estado="A"),
        ])
        db.flush()
        db.add_all([
            models.Usuario(usuario_id=1, sistema_id=1, usuario="ADMIN", email="shared@example.test",
                           contrasena_hash=hash_password("mapa"), rol_id=1, protegido=True,
                           fecha_registro=datetime.now()),
            models.Usuario(usuario_id=2, sistema_id=2, usuario="ADMIN_LOGUEO", email="shared@example.test",
                           contrasena_hash=hash_password("logu"), rol_id=2,
                           fecha_registro=datetime.now()),
            models.Usuario(usuario_id=3, sistema_id=1, usuario="TEST", email="test@example.test",
                           contrasena_hash=hash_password("test"), rol_id=1,
                           fecha_registro=datetime.now()),
            models.Usuario(usuario_id=4, sistema_id=1, usuario="LECTURA", email="read@example.test",
                           contrasena_hash=hash_password("leer"), rol_id=3,
                           fecha_registro=datetime.now()),
        ])

    def test_db():
        with session() as db:
            yield db

    app = FastAPI()
    app.include_router(auth.router, prefix="/api/auth")
    app.include_router(admin.router, prefix="/api/admin")
    app.dependency_overrides[get_db] = test_db
    with TestClient(app) as test_client:
        yield test_client
    engine.dispose()


def login(client, identifier, password):
    return client.post("/api/auth/login", json={"username_or_email": identifier, "password": password})


def bearer(client, identifier="ADMIN", password="mapa"):
    result = login(client, identifier, password)
    assert result.status_code == 200, result.text
    return {"Authorization": "Bearer " + result.json()["access_token"]}


def test_login_scope_and_existing_password(client):
    assert login(client, "shared@example.test", "logu").status_code == 401
    assert login(client, "ADMIN_LOGUEO", "logu").status_code == 401
    assert login(client, "shared@example.test", "mapa").json()["user"]["usuario_id"] == 1
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=bearer(client)).json()["usuario"] == "ADMIN"


def test_admin_cannot_access_other_system(client):
    headers = bearer(client)
    assert {row["usuario_id"] for row in client.get("/api/admin/usuarios", headers=headers).json()} == {1, 3, 4}
    assert {row["rol_id"] for row in client.get("/api/admin/roles", headers=headers).json()} == {1, 3}
    assert client.put("/api/admin/usuarios/2", headers=headers, json={"nombre_completo": "Ajeno"}).status_code == 404
    assert client.put("/api/admin/roles/2", headers=headers, json={"nombre": "ajeno"}).status_code == 404
    assert client.put("/api/admin/usuarios/3", headers=headers, json={"rol_id": 2}).status_code == 400
    assert client.get("/api/admin/usuarios", headers=bearer(client, "LECTURA", "leer")).status_code == 403


def test_protected_admin_and_multiple_admins(client):
    headers = bearer(client, "TEST", "test")
    assert client.put("/api/admin/usuarios/1", headers=headers, json={"rol_id": 3}).status_code == 403
    assert client.put("/api/admin/usuarios/1", headers=headers, json={"email": "other@example.test"}).status_code == 403
    assert client.patch("/api/admin/usuarios/1/estado", headers=headers, json={"estado": "I"}).status_code == 400
    assert client.put("/api/admin/roles/1", headers=headers, json={"nombre": "otro"}).status_code == 403
    response = client.post("/api/admin/roles", headers=headers, json={"nombre": "operador"})
    assert response.status_code == 201
    role_id = response.json()["rol_id"]
    assert client.put(f"/api/admin/roles/{role_id}", headers=headers, json={"nombre": "operador", "descripcion": "Piloto"}).status_code == 200


def test_password_change_revokes_previous_token(client):
    headers = bearer(client)
    response = client.post("/api/auth/change-password", headers=headers,
                           json={"old_password": "mapa", "new_password": "nueva"})
    assert response.status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert login(client, "ADMIN", "nueva").status_code == 200


def test_recovery_without_email_does_not_disclose_code(client):
    response = client.post("/api/auth/forgot-password", json={"email_or_username": "shared@example.test"})
    assert response.status_code == 503
    assert "code_preview" not in response.json()
