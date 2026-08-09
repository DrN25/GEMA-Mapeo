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
        (models.Usuario.usuario == val.upper()) |
        (models.Usuario.usuario == val) |
        (models.Usuario.email == val.lower()) |
        (models.Usuario.email == val)
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


import random
import string
import logging
import os

logger = logging.getLogger(__name__)

# Diccionario en memoria para almacenar códigos de recuperación temporales
# { "email_o_usuario": { "code": "123456", "expires": timestamp } }
RECOVERY_CODES = {}


@router.post("/change-password")
def change_password(
    data: schemas.ChangePasswordSchema,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    """Permite al usuario logueado cambiar su contraseña actual (mínimo 4 caracteres)."""
    if not verify_password(data.old_password, current_user.contrasena_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual ingresada no es correcta."
        )

    if not data.new_password or len(data.new_password.strip()) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 4 caracteres."
        )

    current_user.contrasena_hash = hash_password(data.new_password.strip())
    current_user.fecha_modificacion = datetime.now()
    current_user.usuario_modificacion = current_user.usuario
    db.commit()

    return {"message": "Contraseña actualizada exitosamente."}


@router.post("/forgot-password")
def forgot_password(
    data: schemas.ForgotPasswordSchema,
    db: Session = Depends(get_db)
):
    """
    Solicita la recuperación de contraseña enviando un código de 6 dígitos al correo del usuario.
    Usa Resend API (HTTP/443) en producción — compatible con Render Free Plan.
    """
    val = data.email_or_username.strip()
    if not val:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe ingresar su nombre de usuario o correo electrónico."
        )

    user = db.query(models.Usuario).filter(
        (models.Usuario.usuario == val.upper()) |
        (models.Usuario.usuario == val) |
        (models.Usuario.email == val.lower()) |
        (models.Usuario.email == val)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El usuario o correo electrónico '{val}' no se encuentra registrado en el sistema."
        )

    if user.estado != 'A':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La cuenta de usuario '{user.usuario}' se encuentra inhabilitada o desactivada. Contacte al Administrador."
        )

    # Generar código numérico de 6 dígitos
    code = "".join(random.choices(string.digits, k=6))
    RECOVERY_CODES[user.email.lower()] = {
        "code": code,
        "usuario": user.usuario,
        "created_at": datetime.now()
    }
    if user.usuario:
        RECOVERY_CODES[user.usuario.upper()] = RECOVERY_CODES[user.email.lower()]

    # Envío de correo vía Resend API (HTTP/443) — funciona en Render Free Plan
    resend_api_key = os.getenv("RESEND_API_KEY")
    resend_from = os.getenv("RESEND_FROM", "GEMA Mapeo <onboarding@resend.dev>")

    email_sent = False
    if resend_api_key:
        try:
            import resend
            resend.api_key = resend_api_key
            params: resend.Emails.SendParams = {
                "from": resend_from,
                "to": [user.email],
                "subject": "GEMA — Código de Recuperación de Contraseña",
                "text": (
                    f"Hola {user.usuario},\n\n"
                    f"Tu código de verificación para restablecer tu contraseña en GEMA es:\n\n"
                    f"  {code}\n\n"
                    f"Este código expira en breve. Si no solicitaste este cambio, puedes ignorar este correo."
                ),
            }
            resend.Emails.send(params)
            email_sent = True
            logger.info(f"Correo Resend enviado exitosamente a {user.email}")
        except Exception as e:
            logger.warning(f"No se pudo enviar correo vía Resend: {e}. Se utilizó el código generado: {code}")

    logger.info(f"🔑 CÓDIGO DE RECUPERACIÓN GEMA para '{user.usuario}' ({user.email}): {code}")

    return {
        "message": f"Código de verificación generado para {user.email}.",
        "email": user.email,
        "code_preview": code if not email_sent else None,
        "email_sent": email_sent
    }


@router.post("/reset-password")
def reset_password(
    data: schemas.ResetPasswordSchema,
    db: Session = Depends(get_db)
):
    """
    Restablece la contraseña del usuario verificando el código de 6 dígitos.
    Requiere una nueva contraseña de al menos 4 caracteres.
    """
    val = data.email_or_username.strip()
    code_input = data.code.strip()
    new_pass = data.new_password.strip()

    if not val or not code_input or not new_pass:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Todos los campos son obligatorios."
        )

    if len(new_pass) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 4 caracteres."
        )

    user = db.query(models.Usuario).filter(
        (models.Usuario.usuario == val.upper()) |
        (models.Usuario.usuario == val) |
        (models.Usuario.email == val.lower()) |
        (models.Usuario.email == val)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario o correo no encontrado."
        )

    recovery = RECOVERY_CODES.get(user.email.lower()) or RECOVERY_CODES.get(user.usuario.upper())
    if not recovery or recovery["code"] != code_input:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de verificación es incorrecto o ha expirado."
        )

    # Actualizar contraseña
    user.contrasena_hash = hash_password(new_pass)
    user.fecha_modificacion = datetime.now()
    user.usuario_modificacion = user.usuario
    db.commit()

    # Consumir el código
    RECOVERY_CODES.pop(user.email.lower(), None)
    RECOVERY_CODES.pop(user.usuario.upper(), None)

    return {"message": "Contraseña restablecida exitosamente. Ya puedes iniciar sesión con tu nueva clave."}

