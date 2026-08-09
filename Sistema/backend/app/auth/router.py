from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import verify_password, hash_password, create_access_token
from app.auth.dependencies import get_current_user

router = APIRouter()


@router.post("/login", response_model=schemas.TokenResponseSchema)
def login(credentials: schemas.LoginSchema, db: Session = Depends(get_db)):
    """
    Inicio de sesión con Usuario o Email + Contraseña.
    Retorna un token JWT Bearer si las credenciales son válidas y la cuenta está activa.
    """
    val = credentials.username_or_email.strip()
    if not val:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe ingresar su nombre de usuario o correo electrónico."
        )

    user = db.query(models.Usuario).filter(
        (models.Usuario.usuario == val) | (models.Usuario.email == val)
    ).first()

    if not user or not verify_password(credentials.password, user.contrasena_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas. Verifique su usuario/correo y contraseña."
        )

    if user.estado != 'A':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Su cuenta de usuario se encuentra inhabilitada ('I') o desactivada ('*')."
        )

    # Actualizar UltimoAcceso
    user.ultimo_acceso = datetime.now()
    db.commit()

    rol_nombre = user.rol.nombre if user.rol else "lectura"

    access_token = create_access_token(data={"sub": user.usuario, "rol": rol_nombre})

    user_out = schemas.UserOutSchema(
        usuario_id=user.usuario_id,
        usuario=user.usuario,
        email=user.email,
        nombre_completo=user.nombre_completo,
        rol_id=user.rol_id,
        rol_nombre=rol_nombre,
        geotecnico_id=user.geotecnico_id,
        estado=user.estado,
        ultimo_acceso=user.ultimo_acceso,
        fecha_registro=user.fecha_registro
    )

    return schemas.TokenResponseSchema(
        access_token=access_token,
        token_type="bearer",
        user=user_out
    )


@router.get("/me", response_model=schemas.UserOutSchema)
def get_me(current_user: models.Usuario = Depends(get_current_user)):
    """Retorna la información del usuario autenticado actualmente."""
    rol_nombre = current_user.rol.nombre if current_user.rol else "lectura"
    return schemas.UserOutSchema(
        usuario_id=current_user.usuario_id,
        usuario=current_user.usuario,
        email=current_user.email,
        nombre_completo=current_user.nombre_completo,
        rol_id=current_user.rol_id,
        rol_nombre=rol_nombre,
        geotecnico_id=current_user.geotecnico_id,
        estado=current_user.estado,
        ultimo_acceso=current_user.ultimo_acceso,
        fecha_registro=current_user.fecha_registro
    )


@router.post("/change-password")
def change_password(
    data: schemas.ChangePasswordSchema,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    """Permite al usuario logueado cambiar su contraseña actual."""
    if not verify_password(data.old_password, current_user.contrasena_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual ingresada no es correcta."
        )

    if not data.new_password or len(data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 6 caracteres."
        )

    current_user.contrasena_hash = hash_password(data.new_password)
    current_user.fecha_modificacion = datetime.now()
    current_user.usuario_modificacion = current_user.usuario
    db.commit()

    return {"message": "Contraseña actualizada exitosamente."}
