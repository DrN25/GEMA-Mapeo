"""
agents/scanner_service.py — Orquestador del escaneo multi-imagen.

Responsabilidades:
  - Validar límites del lote (máx. imágenes, tamaño por imagen).
  - Procesar imágenes en paralelo (concurrencia limitada) llamando al LLM.
  - Fusionar resultados (una imagen puede traer 1..N celdas).
  - En modo 'actual': forzar el código de la celda objetivo y omitir el
    chequeo de duplicados (se sobrescribe la celda existente al guardar).
  - En modo 'nueva': detectar duplicados contra la BD (build_celdas_existing)
    y devolver existing_codes para que el frontend valide renombrados.
"""

import asyncio
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.agents import config
from app.agents.llm_provider import LLMProvider, OpenRouterProvider, LLMProviderError
from app.agents.normalizer import (
    classify_raw_response,
    extract_cells_from_raw_response,
)
from app.agents.prompt_builder import build_scan_prompt
from app.routers.importador import build_celdas_existing
from app import models

# Límites físicos de OpenRouter para imagen en base64 (modelo vision).
MAX_BASE64_MB = 20


class ScanValidationError(Exception):
    """Error de validación del lote de imágenes (HTTP 400)."""


class ScanImageProcessor:
    """Procesa una sola imagen -> lista de celdas normalizadas."""

    def __init__(self, provider: LLMProvider):
        self.provider = provider

    async def process_image(self, image_bytes: bytes, image_index: int) -> Dict[str, Any]:
        try:
            raw = await asyncio.to_thread(
                self.provider.extract_structured_data,
                image_bytes,
                build_scan_prompt(),
                f"imagen_{image_index}",
            )
        except LLMProviderError as e:
            return {
                "ok": False,
                "source_image": image_index,
                "tipo": "error",
                "error": str(e),
                "mensaje": str(e),
                "celdas": [],
            }

        clasificacion = classify_raw_response(raw)
        celdas = extract_cells_from_raw_response(raw)
        for c in celdas:
            c["source_image"] = image_index
        return {
            "ok": True,
            "source_image": image_index,
            "tipo": clasificacion["tipo"],
            "error": None,
            "mensaje": clasificacion["mensaje"],
            "celdas": celdas,
        }


class ScannerService:
    """Servicio de alto nivel usado por el router."""

    def __init__(self, db: Session, provider: Optional[LLMProvider] = None):
        self.db = db
        self.provider = provider or OpenRouterProvider()

    # ------------------------------------------------------------------
    # Validación del lote
    # ------------------------------------------------------------------

    @staticmethod
    def validate_batch(files: List[Any]) -> None:
        max_images = config.get_max_images_per_batch()
        if not files:
            raise ScanValidationError("Debe enviar al menos una imagen.")
        if len(files) > max_images:
            raise ScanValidationError(
                f"Se recibieron {len(files)} imágenes. El máximo permitido por lote es {max_images}."
            )
        max_mb = config.get_max_image_mb()
        for f in files:
            f.file.seek(0, 2)
            size = f.file.tell()
            f.file.seek(0)
            if size > max_mb * 1024 * 1024:
                raise ScanValidationError(
                    f"La imagen '{f.filename}' supera el límite de {max_mb} MB."
                )
            if size == 0:
                raise ScanValidationError(f"La imagen '{f.filename}' está vacía.")

    # ------------------------------------------------------------------
    # Preview
    # ------------------------------------------------------------------

    async def preview(
        self,
        images: List[Any],
        modo: str = "nueva",
        target_celda: Optional[str] = None,
    ) -> Dict[str, Any]:
        if modo not in ("actual", "nueva"):
            raise ScanValidationError("modo debe ser 'actual' o 'nueva'.")
        if modo == "actual" and not target_celda:
            raise ScanValidationError(
                "El modo 'actual' requiere la celda objetivo (target_celda)."
            )

        self.validate_batch(images)
        if not config.is_configured():
            raise ScanValidationError(
                "OPENROUTER_API_KEY no configurada en el backend (.env). "
                "El agente de escaneo no puede operar."
            )

        # Leer bytes con concurrencia limitada
        semaphore = asyncio.Semaphore(config.get_scan_concurrency())

        async def _read_and_process(i: int, f: Any) -> Dict[str, Any]:
            image_bytes = await asyncio.to_thread(f.file.read)
            async with semaphore:
                return await ScanImageProcessor(self.provider).process_image(image_bytes, i)

        results = await asyncio.gather(*[_read_and_process(i, f) for i, f in enumerate(images)])

        errores = [
            {
                "source_image": r["source_image"],
                "tipo": r.get("tipo", "error"),
                "error": r.get("error"),
                "mensaje": r.get("mensaje"),
            }
            for r in results
            if not r["ok"] or r.get("tipo") == "no_mapping_form"
        ]
        celdas_raw = [c for r in results if r["ok"] for c in r["celdas"]]

        # ---- Post-procesamiento por modo ----
        if modo == "actual":
            for c in celdas_raw:
                c["codigo"] = target_celda.strip().upper()
            existing_map = {}
            is_dup = False
        else:
            codes = [c["codigo"] for c in celdas_raw if c.get("codigo")]
            existing_map = build_celdas_existing(self.db, codes)

        celdas_out: List[Dict[str, Any]] = []
        for c in celdas_raw:
            code = (c.get("codigo") or "").strip().upper()
            is_dup = bool(code and code in existing_map) if modo == "nueva" else False
            celdas_out.append(
                {
                    "codigo": c.get("codigo"),
                    "is_duplicate": is_dup,
                    "excel_data": c.get("excel_data", {}),
                    "existing_data": existing_map.get(code) if code else None,
                    "estructuras": c.get("estructuras", []),
                    "source_image": c.get("source_image", 0),
                    "missing_header": c.get("missing_header", []),
                    "missing_joints": c.get("missing_joints", []),
                    "confidence": c.get("confidence", 0.0),
                }
            )

        all_existing_codes = [
            c[0] for c in self.db.query(models.Ventana.codigo_celda).all() if c[0]
        ]

        return {
            "status": "success",
            "formato_detectado": "scan",
            "total_celdas": len(celdas_out),
            "total_duplicados": sum(1 for c in celdas_out if c["is_duplicate"]),
            "existing_codes": all_existing_codes,
            "celdas": celdas_out,
            "modelo_utilizado": self.provider.last_model_used,
            "errores_por_imagen": [
                {"source_image": e["source_image"], "tipo": e.get("tipo", "error"), "error": e["error"], "mensaje": e.get("mensaje")}
                for e in errores
            ],
        }
