"""Shared identity queries for the Mapeo deployment."""
from app import models

SYSTEM_CODE = "mapeo"


def system_roles(db):
    return db.query(models.Role).join(models.Sistema).filter(
        models.Sistema.codigo == SYSTEM_CODE,
        models.Sistema.estado == "A",
    )


def system_users(db):
    return db.query(models.Usuario).join(models.Usuario.rol).join(models.Sistema).filter(
        models.Sistema.codigo == SYSTEM_CODE,
        models.Sistema.estado == "A",
    )


def find_identity(db, value):
    users = system_users(db).filter(models.Role.estado == "A")
    # Give the globally unique username priority over an email match.
    return users.filter(models.Usuario.usuario.in_((value.upper(), value))).first() or users.filter(
        models.Usuario.email.in_((value.lower(), value))
    ).first()
