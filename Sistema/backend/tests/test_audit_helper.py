from datetime import datetime
from app.core.audit import apply_audit


class DummyUser:
    def __init__(self, usuario, email):
        self.usuario = usuario
        self.email = email


class DummyModel:
    def __init__(self):
        self.usuario_registro = None
        self.fecha_registro = None
        self.usuario_modificacion = None
        self.fecha_modificacion = None


def test_apply_audit_new_record():
    user = DummyUser(usuario="CBAL", email="carlos@gema.com")
    model = DummyModel()

    apply_audit(model, user, is_new=True)

    assert model.usuario_registro == "CBAL"
    assert isinstance(model.fecha_registro, datetime)
    assert model.usuario_modificacion is None
    assert model.fecha_modificacion is None


def test_apply_audit_update_record():
    user = DummyUser(usuario="ADMIN", email="admin@gema.com")
    model = DummyModel()
    model.usuario_registro = "CBAL"
    model.fecha_registro = datetime(2026, 1, 1, 10, 0, 0)

    apply_audit(model, user, is_new=False)

    assert model.usuario_registro == "CBAL"  # Registro intacto
    assert model.usuario_modificacion == "ADMIN"
    assert isinstance(model.fecha_modificacion, datetime)
