from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field
from app.auth.scope import system_roles, system_users

from app.database import get_db
from app import models, schemas
from app.core.security import hash_password
from app.core.audit import apply_audit
from app.auth.dependencies import require_role

router = APIRouter()


@router.get("/roles", response_model=List[schemas.RoleOutSchema])
def list_roles(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role(["admin"]))
):
    """Lista los roles disponibles en la base de datos."""
    roles = system_roles(db).filter(models.Role.estado == 'A').all()
    return [
        schemas.RoleOutSchema(
            rol_id=r.rol_id,
            nombre=r.nombre,
            descripcion=r.descripcion,
            estado=r.estado
        )
        for r in roles
    ]


@router.get("/usuarios", response_model=List[schemas.UserOutSchema])
def list_users(
    estado: Optional[str] = Query(None, description="Filtrar por estado ('A', 'I', '*')"),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role(["admin"]))
):
    """Lista todos los usuarios registrados (excluye por defecto los eliminados '*' salvo que se pida)."""
    query = system_users(db)
    if estado:
        query = query.filter(models.Usuario.estado == estado)
    else:
        query = query.filter(models.Usuario.estado != '*')

    users = query.order_by(models.Usuario.usuario_id.desc()).all()
    return [
        schemas.UserOutSchema(
            usuario_id=u.usuario_id,
            usuario=u.usuario,
            email=u.email,
            nombre_completo=u.nombre_completo,
            rol_id=u.rol_id,
            rol_nombre=u.rol.nombre if u.rol else "desconocido",
            geotecnico_id=u.geotecnico_id,
            estado=u.estado,
            ultimo_acceso=u.ultimo_acceso,
            fecha_registro=u.fecha_registro
        )
        for u in users
    ]


@router.post("/usuarios", response_model=schemas.UserOutSchema)
def create_user(
    data: schemas.UserCreateSchema,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role(["admin"]))
):
    """Crea un nuevo usuario en la base de datos (solo Administradores)."""
    usuario_str = data.usuario.strip().upper()
    email_str = data.email.strip().lower()

    if not usuario_str or not email_str or not data.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El campo Usuario, Email y Contraseña son obligatorios."
        )

    if len(data.password.strip()) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 4 caracteres."
        )

    # Verificar duplicado por Usuario
    existing_u = db.query(models.Usuario).filter(models.Usuario.usuario == usuario_str).first()
    if existing_u:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El nombre de usuario '{usuario_str}' ya existe en el sistema."
        )

    # Verificar duplicado por Email
    existing_e = system_users(db).filter(models.Usuario.email == email_str).first()
    if existing_e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El correo electrónico '{email_str}' ya se encuentra registrado."
        )

    # Verificar que el Rol exista
    rol = system_roles(db).filter(models.Role.rol_id == data.rol_id, models.Role.estado == "A").first()
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El RolID {data.rol_id} no existe."
        )

    new_user = models.Usuario(
        usuario=usuario_str,
        email=email_str,
        contrasena_hash=hash_password(data.password),
        nombre_completo=data.nombre_completo.strip() if data.nombre_completo else None,
        rol_id=data.rol_id,
        sistema_id=rol.sistema_id,
        geotecnico_id=data.geotecnico_id,
        estado='A'
    )

    apply_audit(new_user, current_user, is_new=True)

    db.add(new_user)
    commit_changes(db)
    db.refresh(new_user)

    return schemas.UserOutSchema(
        usuario_id=new_user.usuario_id,
        usuario=new_user.usuario,
        email=new_user.email,
        nombre_completo=new_user.nombre_completo,
        rol_id=new_user.rol_id,
        rol_nombre=rol.nombre,
        geotecnico_id=new_user.geotecnico_id,
        estado=new_user.estado,
        ultimo_acceso=new_user.ultimo_acceso,
        fecha_registro=new_user.fecha_registro
    )


@router.put("/usuarios/{user_id}", response_model=schemas.UserOutSchema)
def update_user(
    user_id: int,
    data: schemas.UserUpdateSchema,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role(["admin"]))
):
    """Actualiza la información de un usuario existente."""
    user = system_users(db).filter(models.Usuario.usuario_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con ID {user_id} no encontrado."
        )

    if user.protegido and (
        (data.usuario is not None and data.usuario.strip().upper() != user.usuario)
        or (data.email is not None and data.email.strip().lower() != user.email)
        or (data.rol_id is not None and data.rol_id != user.rol_id)
        or bool(data.password and data.password.strip())
    ):
        raise HTTPException(status_code=403, detail="La identidad, el rol y la contraseña de la cuenta protegida se gestionan por separado.")

    if data.usuario is not None and data.usuario.strip():
        u_str = data.usuario.strip().upper()
        if u_str != user.usuario:
            existing_u = db.query(models.Usuario).filter(models.Usuario.usuario == u_str).first()
            if existing_u:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El nombre de usuario '{u_str}' ya está en uso por otro registro."
                )
            user.usuario = u_str

    if data.nombre_completo is not None:
        user.nombre_completo = data.nombre_completo.strip() if data.nombre_completo else None

    if data.email is not None:
        email_str = data.email.strip().lower()
        if email_str != user.email:
            existing_e = system_users(db).filter(models.Usuario.email == email_str).first()
            if existing_e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El correo '{email_str}' ya está en uso por otro usuario."
                )
            user.email = email_str
            user.version_seguridad += 1

    if data.rol_id is not None:
        rol = system_roles(db).filter(models.Role.rol_id == data.rol_id, models.Role.estado == "A").first()
        if not rol:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rol inválido.")
        user.rol_id = data.rol_id

    if data.geotecnico_id is not None:
        user.geotecnico_id = data.geotecnico_id

    if data.password and data.password.strip():
        if len(data.password.strip()) < 4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña debe tener al menos 4 caracteres."
            )
        user.contrasena_hash = hash_password(data.password.strip())
        user.version_seguridad += 1

    apply_audit(user, current_user, is_new=False)

    commit_changes(db)
    db.refresh(user)

    return schemas.UserOutSchema(
        usuario_id=user.usuario_id,
        usuario=user.usuario,
        email=user.email,
        nombre_completo=user.nombre_completo,
        rol_id=user.rol_id,
        rol_nombre=user.rol.nombre if user.rol else "desconocido",
        geotecnico_id=user.geotecnico_id,
        estado=user.estado,
        ultimo_acceso=user.ultimo_acceso,
        fecha_registro=user.fecha_registro
    )


@router.patch("/usuarios/{user_id}/estado", response_model=schemas.UserOutSchema)
def update_user_status(
    user_id: int,
    status_data: schemas.UserStatusSchema,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role(["admin"]))
):
    """
    Actualiza el estado del usuario:
    'A' = Activo | 'I' = Inactivo | '*' = Eliminado (Borrado Lógico).
    """
    st = status_data.estado.upper()
    if st not in ['A', 'I', '*']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Estado inválido. Debe ser 'A' (Activo), 'I' (Inactivo) o '*' (Eliminado)."
        )

    user = system_users(db).filter(models.Usuario.usuario_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con ID {user_id} no encontrado."
        )

    # Impedir que un admin se auto-desactive o auto-elimine
    if (user.protegido or user.usuario_id == current_user.usuario_id) and st in ['I', '*']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar ni eliminar esta cuenta de administrador."
        )

    if user.estado != st:
        user.version_seguridad += 1
    user.estado = st
    apply_audit(user, current_user, is_new=False)

    commit_changes(db)
    db.refresh(user)

    return schemas.UserOutSchema(
        usuario_id=user.usuario_id,
        usuario=user.usuario,
        email=user.email,
        nombre_completo=user.nombre_completo,
        rol_id=user.rol_id,
        rol_nombre=user.rol.nombre if user.rol else "desconocido",
        geotecnico_id=user.geotecnico_id,
        estado=user.estado,
        ultimo_acceso=user.ultimo_acceso,
        fecha_registro=user.fecha_registro
    )


def commit_changes(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="El cambio entra en conflicto con un registro existente.") from exc


class RoleInput(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    descripcion: Optional[str] = Field(default=None, max_length=200)


@router.post("/roles", response_model=schemas.RoleOutSchema, status_code=201)
def create_role(
    data: RoleInput,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role(["admin"])),
):
    name = data.nombre.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre del rol es obligatorio.")
    role = models.Role(nombre=name, descripcion=data.descripcion, estado="A",
                       sistema_id=current_user.sistema_id)
    db.add(role)
    commit_changes(db)
    db.refresh(role)
    return role


@router.put("/roles/{role_id}", response_model=schemas.RoleOutSchema)
def update_role(
    role_id: int,
    data: RoleInput,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role(["admin"])),
):
    role = system_roles(db).filter(models.Role.rol_id == role_id).first()
    if role is None:
        raise HTTPException(status_code=404, detail="Rol no encontrado.")
    name = data.nombre.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre del rol es obligatorio.")
    if name != role.nombre and (role.protegido or role.nombre in {"admin", "mapeador", "lectura"}):
        raise HTTPException(status_code=403, detail="El nombre de este rol se usa en los permisos actuales.")
    role.nombre = name
    role.descripcion = data.descripcion
    commit_changes(db)
    db.refresh(role)
    return role
