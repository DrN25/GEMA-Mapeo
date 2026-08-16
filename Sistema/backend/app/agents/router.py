"""
agents/router.py — Endpoints REST del agente de escaneo IA.

  GET  /api/scan/config    Estado del agente (provider, modelos, límites).
                           NUNCA expone la API key.
  POST /api/scan/preview   Imágenes -> celdas normalizadas (modo actual/nueva).

El guardado NUNCA es directo: el frontend convierte el preview en borradores
pendientes (mismo flujo que la importación Excel) y sube con GUARDAR CAMBIOS.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.agents import config
from app.agents.scanner_service import ScanValidationError, ScannerService
from app.auth.dependencies import require_role
from app.database import get_db

router = APIRouter()


@router.get("/scan/config", response_model=dict, tags=["Agente de Escaneo IA"])
def get_scan_config():
    """Configuración pública del agente (sin secretos)."""
    return config.public_config()


@router.post("/scan/preview", tags=["Agente de Escaneo IA"])
async def scan_preview(
    files: List[UploadFile] = File(...),
    modo: str = "nueva",
    target_celda: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin", "mapeador"])),
):
    """Analiza 1..N imágenes de formularios de mapeo y devuelve las celdas
    detectadas en el contrato estándar del preview de importación.

    - modo=actual   : importa los valores en la celda actual (target_celda).
    - modo=nueva    : detecta el código de cada estación y verifica duplicados.
    """
    try:
        service = ScannerService(db)
        return await service.preview(files, modo=modo, target_celda=target_celda)
    except ScanValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando el escaneo: {str(e)[:500]}",
        )
