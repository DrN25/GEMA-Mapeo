"""
agents/schemas.py — Contratos Pydantic de la API /api/scan/*.

La respuesta del preview es un espejo del preview del importador de Excel
(routers/importador.py:581): el frontend reutiliza los mismos componentes.
Se agregan campos de escaneo: source_image, missing_header, missing_joints,
confidence y modelo utilizado.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ScanConfigResponse(BaseModel):
    provider: str
    free_model: str
    paid_model: str
    max_images_per_batch: int
    max_image_mb: int
    concurrency: int
    is_configured: bool


class ScanCeldaPreview(BaseModel):
    codigo: Optional[str] = None
    is_duplicate: bool = False
    excel_data: Dict[str, Any] = {}
    existing_data: Optional[Dict[str, Any]] = None
    estructuras: List[Dict[str, Any]] = []
    # --- Campos específicos del escaneo ---
    source_image: int = 0
    missing_header: List[str] = []
    missing_joints: List[List[str]] = []
    confidence: float = 0.0


class ScanPreviewResponse(BaseModel):
    status: str = "success"
    formato_detectado: str = "scan"
    total_celdas: int = 0
    total_duplicados: int = 0
    existing_codes: List[str] = []
    celdas: List[ScanCeldaPreview] = []
    modelo_utilizado: Optional[str] = None
    errores_por_imagen: List[Dict[str, Any]] = []


class ScanExecuteItem(BaseModel):
    codigo_original: str
    codigo_final: str
    excel_data: Dict[str, Any]
    estructuras: List[Dict[str, Any]]
    exists_in_db: Optional[bool] = False


class ScanExecuteSchema(BaseModel):
    celdas: List[ScanExecuteItem]
