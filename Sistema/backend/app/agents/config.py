"""
agents/config.py — Configuración del agente de escaneo IA.

Todas las claves viven en variables de entorno del backend (.env), que está
gitignored. La API key NUNCA se expone al frontend: el endpoint /api/scan/config
solo devuelve proveedor/modelo/estado de configuración.

Variables soportadas (con defaults de desarrollo):
  OPENROUTER_API_KEY          Clave de OpenRouter.
  LLM_FREE_MODEL              Modelo gratis (primera opción; fallback a pago al
                              agotar el límite diario). Default: nvidia/nemotron-nano-12b-v2-vl:free
  LLM_PAID_MODEL              Modelo de pago (fallback). Default: openai/gpt-5.6-luna
  SCAN_MAX_IMAGES_PER_BATCH   Máximo de imágenes por lote (default 15).
  SCAN_MAX_IMAGE_MB           Máximo de MB por imagen (default 10).
  SCAN_CONCURRENCY            Imágenes procesadas en paralelo (default 3).
  SCAN_TIMEOUT_SECONDS        Timeout por llamada al LLM (default 120).
"""

import os
from typing import Optional

_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
_env_cache: dict = {"mtime": None, "vars": {}}


def _read_env_file() -> dict:
    """Lee backend/.env con caché por mtime: editar el .env NO exige reiniciar
    el backend (los valores se refrescan en cada lectura de configuración)."""
    try:
        mtime = os.path.getmtime(_ENV_PATH)
    except OSError:
        return {}
    if _env_cache["mtime"] == mtime:
        return _env_cache["vars"]
    vars: dict = {}
    try:
        with open(_ENV_PATH, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    vars[key.strip()] = val.strip().strip('"').strip("'")
    except OSError:
        pass
    _env_cache["mtime"] = mtime
    _env_cache["vars"] = vars
    return vars


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    """1. Variables ya cargadas en el entorno (docker/CI/run.py).
    2. Relectura fresca del archivo .env (permite editar sin reiniciar)."""
    val = os.environ.get(name)
    if val is not None and str(val).strip():
        return str(val).strip()
    val = _read_env_file().get(name)
    if val is not None and str(val).strip():
        return str(val).strip()
    return default

# Marcadores de error de OpenRouter cuando un modelo :free agota su cuota
# diaria (HTTP 429 / límite de rate, cuota free agotada, etc.). Se usan para
# decidir el fallback automático al modelo de pago.
FREE_LIMIT_HINTS = (
    "free",
    "quota",
    "rate limit",
    "rate_limit",
    "429",
    "daily",
    "insufficient",
    "no credit",
    "credits",
    "limit reached",
    "temporarily unavailable",
)

# Errores que NO deben intentar fallback (no es problema de cuota).
NON_RETRYABLE_HINTS = (
    "invalid api key",
    "401",
    "403",
    "authentication",
    "unauthorized",
    "bad request",
    "400",
)

# Timeouts/flakiness del modelo free (lentos): también caen al modelo de pago.
FREE_TIMEOUT_HINTS = (
    "timeout",
    "timed out",
    "idle",
    "overloaded",
    "unavailable",
    "server error",
    "500",
    "502",
    "503",
)


def _env_int(name: str, default: int) -> int:
    try:
        return int(_env(name) or default)
    except (TypeError, ValueError):
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(_env(name) or default)
    except (TypeError, ValueError):
        return default


def get_openrouter_api_key() -> Optional[str]:
    """API key de OpenRouter (backend-only)."""
    return _env("OPENROUTER_API_KEY")


def get_free_model() -> str:
    """Modelo gratis (primera opción)."""
    return _env("LLM_FREE_MODEL") or "nvidia/nemotron-nano-12b-v2-vl:free"


def get_paid_model() -> str:
    """Modelo de pago (fallback)."""
    return _env("LLM_PAID_MODEL") or "google/gemini-2.5-flash-lite"


def get_use_free_model() -> bool:
    """¿Intentar primero el modelo gratuito? Evaluación 2026-08-15: NINGÚN
    modelo free dio resultados utilizables (falsos negativos, JSON inválido,
    timeouts, 429) y agregan hasta 75s de latencia. Default: False (ir
    directo al modelo de pago). Activar solo si aparece un free confiable."""
    val = _env("SCAN_USE_FREE_MODEL", "false")
    return str(val).strip().lower() in ("1", "true", "yes", "si", "on")


def get_max_images_per_batch() -> int:
    return max(1, _env_int("SCAN_MAX_IMAGES_PER_BATCH", 15))


def get_max_image_mb() -> int:
    return max(1, _env_int("SCAN_MAX_IMAGE_MB", 10))


def get_scan_concurrency() -> int:
    return max(1, _env_int("SCAN_CONCURRENCY", 3))


def get_scan_timeout_seconds() -> int:
    return max(10, _env_int("SCAN_TIMEOUT_SECONDS", 120))


def get_json_fix_model() -> str:
    """Modelo de TEXTO usado para reparar/extraer el JSON cuando el modelo de
    visión devuelve contenido no parseable (razonamiento, texto envuelto, etc.).

    Es un modelo SIN visión (mucho más barato): recibe el texto crudo y
    devuelve el JSON limpio. Default: "" = usar el mismo modelo de pago.
    IMPORTANTE: si el modelo de visión falló, el reparador debe ser OTRO
    modelo (usar el mismo puede fallar igual)."""
    return _env("LLM_JSON_FIX_MODEL") or ""


def get_max_tokens() -> int:
    """Máximo de tokens de salida por llamada. El JSON de una celda con
    10+ estructuras puede superar 8k tokens; cortarse ahí causa fallos de
    parseo. Default 16000."""
    return max(4096, _env_int("SCAN_MAX_TOKENS", 16000))


def get_max_image_dimension() -> int:
    """Dimensión máxima (px) para redimensionar la imagen antes de enviarla
    al LLM. Reduce tokens de imagen (los modelos cobran por resolución) y
    acelera la llamada. Default 2000: suficiente margen para tablas densas.
    La imagen se conserva en PNG (lossless) — JPEG degrada texto fino.
    0 = no redimensionar."""
    return max(0, _env_int("SCAN_MAX_IMAGE_DIMENSION", 2000))


def get_image_quality() -> int:
    """Calidad JPEG/WebP para la imagen comprimida (0-100). Default 85."""
    return max(10, min(100, _env_int("SCAN_IMAGE_QUALITY", 85)))


def is_configured() -> bool:
    """True si hay API key configurada (precondición para usar el agente)."""
    return bool(get_openrouter_api_key())


def public_config() -> dict:
    """Configuración segura para el frontend (sin secretos)."""
    return {
        "provider": "openrouter",
        "free_model": get_free_model(),
        "paid_model": get_paid_model(),
        "use_free_model": get_use_free_model(),
        "max_images_per_batch": get_max_images_per_batch(),
        "max_image_mb": get_max_image_mb(),
        "concurrency": get_scan_concurrency(),
        "is_configured": is_configured(),
    }
