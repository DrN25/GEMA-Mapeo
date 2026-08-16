"""
agents/llm_provider.py — Cliente LLM (OpenRouter) con fallback free -> pago.

Estrategia de costos:
  1. Se intenta SIEMPRE primero el modelo gratuito (``:free``).
  2. Si la llamada falla por cuota/rate-limit del modelo free (HTTP 429 o
     mensajes del estilo "free tier limit"), se reintenta automáticamente con
     el modelo de pago (fallback).
  3. Errores de autenticación/request malformada NO reintentan (serían el
     mismo error en ambos modelos).

Diseño SOLID: el router/service depende de la abstracción ``LLMProvider``;
agregar otro proveedor (Anthropic, OpenAI directo) = nueva implementación.
"""

import base64
import io
import json
import logging
from typing import Dict, List, Optional, Tuple

import httpx

from app.agents import config
from app.agents.prompt_builder import build_correction_prompt

logger = logging.getLogger(__name__)

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

# Cache global del estado "free caído": una vez que el modelo free falla
# (timeout/falso negativo), los análisis siguientes de la sesión saltan
# directo al pago (evita esperar 75s de timeout en cada imagen).
_FREE_BROKEN_GLOBAL = False

# Prompt para el modelo reparador de JSON (solo texto, sin imagen).
JSON_FIX_PROMPT = """Eres un extractor de JSON. El texto a continuación contiene
datos estructurados, posiblemente envueltos en razonamiento, explicaciones o
texto de relleno (puede incluir markdown, múltiples bloques JSON o el JSON
corrupto con comas finales).

Tu tarea: devolver SOLO el objeto JSON válido que contiene los datos
(prioriza el que tenga las claves "tipo_resultado" o "celdas"). Si hay varios
candidatos, elige el más completo. Corrige errores menores (trailing commas,
comillas rotas). NO agregues texto, explicaciones ni markdown: SOLO el JSON.

TEXTO A REPARAR:
"""


class LLMProviderError(Exception):
    """Error de transporte/proveedor LLM (no relacionado con cuota)."""


class LLMQuotaError(LLMProviderError):
    """Cuota agotada o rate-limit en el modelo actual (candidato a fallback)."""


class LLMProvider:
    """Abstracción del proveedor de visión LLM."""

    def extract_structured_data(self, image_bytes: bytes, prompt: str, image_name: str = "") -> Dict:
        raise NotImplementedError


def _looks_like_free_quota(status_code: int, body_text: str, model: str) -> bool:
    """True si el error es de cuota/rate-limit o flakiness del modelo free
    (candidato a fallback al modelo de pago)."""
    haystack = body_text.lower()
    is_free_model = ":free" in model.lower() or model.lower().endswith(":free")

    # Errores no reintentables: auth/request inválida
    if any(h in haystack for h in config.NON_RETRYABLE_HINTS):
        return False
    # 429 siempre se considera cuota/rate (típico de free tiers)
    if status_code == 429:
        return True
    # Mensajes de cuota en el body
    if any(h in haystack for h in config.FREE_LIMIT_HINTS):
        return True
    # Timeouts/sobrecarga: solo si el modelo es free (el pago es confiable)
    if is_free_model and any(h in haystack for h in config.FREE_TIMEOUT_HINTS):
        return True
    return is_free_model and status_code >= 500


class OpenRouterProvider(LLMProvider):
    """Implementación OpenRouter (httpx) con fallback free -> pago automático."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        free_model: Optional[str] = None,
        paid_model: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
    ):
        # None = usar la key del entorno; "" = simular ausencia (tests).
        self.api_key = api_key if api_key is not None else config.get_openrouter_api_key()
        self.free_model = free_model or config.get_free_model()
        self.paid_model = paid_model or config.get_paid_model()
        self.json_fix_model = config.get_json_fix_model() or self.paid_model
        self.timeout_seconds = timeout_seconds or config.get_scan_timeout_seconds()
        self._current_model_used: Optional[str] = None
        # Métricas por llamada y acumuladas (para monitoreo de costos).
        self.last_usage: Dict = {}
        self.last_cost_usd: float = 0.0
        self.total_cost_usd: float = 0.0
        self.total_prompt_tokens: int = 0
        self.total_completion_tokens: int = 0

    # ------------------------------------------------------------------
    # API pública
    # ------------------------------------------------------------------

    @property
    def last_model_used(self) -> Optional[str]:
        """Modelo que respondió en la última llamada (free o paid)."""
        return self._current_model_used

    def extract_structured_data(
        self,
        image_bytes: bytes,
        prompt: str,
        image_name: str = "",
        max_attempts: int = 2,
    ) -> Dict:
        """Envía la imagen (bytes) + prompt y devuelve el JSON estructurado del LLM.

        Estrategia de robustez (modelos gratuitos son propensos a fallar):
          1. Primer intento con el prompt normal.
          2. Si el JSON es inválido, viene vacío, o el modelo marca la imagen
             como "no_mapping_form" (falso negativo), se REINTENTA con un
             prompt de corrección (hasta `max_attempts` veces).
          3. Si el modelo free agota cuota/falla por flakiness, fallback al
             modelo de pago con el MISMO ciclo de reintentos.

        Lanza LLMProviderError si fallan ambos modelos.
        """
        if not self.api_key:
            raise LLMProviderError(
                "OPENROUTER_API_KEY no configurada en el backend (.env). "
                "El agente de escaneo IA no puede operar sin ella."
            )

        last_issue: Optional[str] = None
        last_raw: Optional[Dict] = None
        free_falso_negativo = False
        usar_prompt_original = False  # tras un falso negativo del free
        for attempt in range(max_attempts):
            if usar_prompt_original:
                attempt_prompt = prompt  # verificación con pago: prompt normal
                usar_prompt_original = False
            else:
                attempt_prompt = (
                    prompt if attempt == 0 else build_correction_prompt(last_raw, last_issue or "respuesta inválida")
                )
            try:
                data, model = self._attempt_models(image_bytes, attempt_prompt)
            except LLMProviderError:
                # Errores de transporte/auth/cuota: no tiene sentido corregir
                # el prompt; propagar (el fallback free->paid ya ocurrió).
                raise

            self._current_model_used = model

            # Falso negativo del modelo FREE: respondió "no_mapping_form" pero
            # los free son débiles/inconsistentes — verificar con el pago.
            if (
                self._es_modelo_free(model)
                and isinstance(data, dict)
                and data.get("tipo_resultado") == "no_mapping_form"
            ):
                free_falso_negativo = True
                self._free_broken = True  # los siguientes intentos van al pago
                usar_prompt_original = True  # el pago debe ver con prompt limpio
                last_issue = "el modelo gratuito marcó la imagen como no relacionada, pero debe confirmarse con el modelo de pago"
                last_raw = data
                logger.warning(
                    "Intento %d de %s: el modelo free marcó no_mapping_form — verificando con el modelo de pago...",
                    attempt + 1, image_name or "imagen",
                )
                continue

            # Respuesta VÁLIDA pero SOSPECHOSAMENTE POBRE del free: si extrajo
            # muy pocas estructuras/cabecera, es probable que haya leído mal
            # (los free tienden a quedarse con 1-2 filas de la tabla). Se
            # verifica con el pago para no perder datos.
            if (
                self._es_modelo_free(model)
                and isinstance(data, dict)
                and self._respuesta_sospechosamente_pobre(data)
            ):
                self._free_broken = True
                usar_prompt_original = True
                last_issue = "el modelo gratuito devolvió datos sospechosamente incompletos, verificando con el modelo de pago"
                last_raw = data
                logger.warning(
                    "Intento %d de %s: respuesta free pobre (pocas estructuras) — verificando con el pago...",
                    attempt + 1, image_name or "imagen",
                )
                continue

            issue = self._validate_response(data)
            if issue is None:
                return data
            last_issue = issue
            last_raw = data
            logger.warning(
                "Intento %d de %s: %s. Reintentando con prompt de corrección...",
                attempt + 1, image_name or "imagen", issue,
            )

        detalle = "falso negativo del modelo gratuito" if free_falso_negativo else (last_issue or "respuesta inválida")
        raise LLMProviderError(
            f"El agente no pudo extraer datos válidos de la imagen tras "
            f"{max_attempts} intentos: {detalle}"
        )

    @staticmethod
    def _es_modelo_free(model: str) -> bool:
        m = (model or "").lower()
        return ":free" in m or m.endswith(":free") or "free" in m

    @staticmethod
    def _respuesta_sospechosamente_pobre(data: Dict) -> bool:
        """True si la respuesta del free es válida pero incompleta: 1-2
        estructuras cuando una tabla de discontinuidades suele tener más.

        Los modelos free tienden a leer solo la primera fila de la tabla.
        En ese caso conviene verificar con el modelo de pago.
        """
        if not isinstance(data, dict):
            return False
        celdas = data.get("celdas")
        if not isinstance(celdas, list) or not celdas:
            return False
        for celda in celdas:
            est = celda.get("estructuras") if isinstance(celda, dict) else None
            if isinstance(est, list):
                if 1 <= len(est) <= 2:
                    return True
        return False

    # ------------------------------------------------------------------
    # Internos
    # ------------------------------------------------------------------

    def _attempt_models(self, image_bytes: bytes, prompt: str) -> Tuple[Dict, str]:
        """Intenta free -> paid (fallback por cuota/flakiness del free).

        Optimización de latencia: si el modelo free ya falló una vez en esta
        sesión (timeout/flakiness — común en tiers gratuitos), los siguientes
        intentos van DIRECTOS al modelo de pago, evitando esperar el timeout
        del free en cada reintento de corrección.
        """
        global _FREE_BROKEN_GLOBAL
        free_broken = getattr(self, "_free_broken", False) or _FREE_BROKEN_GLOBAL
        usar_free = config.get_use_free_model() and not free_broken
        if usar_free:
            try:
                return self._post_free(image_bytes, prompt)
            except LLMQuotaError as e:
                logger.warning("Modelo free %s no disponible (fallback a %s): %s", self.free_model, self.paid_model, e)
                self._free_broken = True
                _FREE_BROKEN_GLOBAL = True
                if self.paid_model == self.free_model:
                    raise
        payload_paid = self._build_payload(self.paid_model, image_bytes, prompt)
        try:
            return self._post(payload_paid)
        except LLMQuotaError as e2:
            raise LLMQuotaError(f"Cuota agotada en ambos modelos: {e2}") from e2

    def _post_free(self, image_bytes: bytes, prompt: str) -> Tuple[Dict, str]:
        """POST al modelo free con timeout reducido (los free son lentos y
        propensos a cuelgues; no vale la pena esperar el timeout completo)."""
        free_timeout = min(self.timeout_seconds, 75)
        payload = self._build_payload(self.free_model, image_bytes, prompt)
        try:
            return self._post(payload, timeout_seconds=free_timeout)
        except LLMProviderError as e:
            # Timeout/flakiness del modelo free: SÍ amerita fallback al pago.
            # Errores de auth/request inválida: NO (serían idénticos en el pago).
            msg = str(e).lower()
            if any(h in msg for h in config.NON_RETRYABLE_HINTS):
                raise
            raise LLMQuotaError(str(e)) from e

    @staticmethod
    def _validate_response(data: Dict) -> Optional[str]:
        """Valida la estructura mínima de la respuesta del LLM.

        Devuelve None si es aceptable, o un string describiendo el problema
        (usado en el prompt de corrección del siguiente intento).
        """
        if not isinstance(data, dict):
            return "la respuesta no es un objeto JSON"
        # Marca explícita de imagen no relacionada: respuesta VÁLIDA (no reintentar)
        tipo = data.get("tipo_resultado")
        if tipo == "no_mapping_form":
            return None
        celdas = data.get("celdas")
        if celdas is None:
            # Aceptar respuestas sin "tipo_resultado" pero con "celdas" (legacy)
            if "celdas" in data:
                return None if isinstance(celdas, list) else "el campo 'celdas' no es una lista"
            return "falta el campo 'celdas' en la respuesta"
        if not isinstance(celdas, list):
            return "el campo 'celdas' no es una lista"
        # Celda "pobre": sin ningún dato aprovechable (solo defaults/null) —
        # el modelo respondió algo, pero no extrajo nada útil. Reintentar.
        if not celdas:
            return "la lista 'celdas' está vacía sin marca no_mapping_form"
        for celda in celdas:
            if isinstance(celda, dict) and OpenRouterProvider._celda_tiene_datos(celda):
                return None
        return "las celdas devueltas no contienen datos extraídos (solo campos vacíos)"

    @staticmethod
    def _celda_tiene_datos(celda: dict) -> bool:
        """True si la celda tiene al menos un dato aprovechable del modelo."""
        ed = celda.get("excel_data")
        if isinstance(ed, dict):
            for k, v in ed.items():
                if k in ("campania",):  # derivado, no cuenta
                    continue
                if v is not None and str(v).strip() not in ("", "-1", "None", "null"):
                    return True
        est = celda.get("estructuras")
        if isinstance(est, list) and est:
            return True
        return False

    @staticmethod
    def _optimize_image(image_bytes: bytes) -> bytes:
        """Redimensiona (si excede el máximo) conservando PNG lossless.

        Los modelos de visión cobran por resolución, pero JPEG degrada el
        texto fino de las tablas (causa lecturas erróneas). Estrategia:
          - Si la imagen ya es pequeña (< máx px): se devuelve tal cual.
          - Si excede: se redimensiona y se guarda en PNG (lossless).
        Si PIL no está disponible o falla, devuelve los bytes originales.
        """
        max_dim = config.get_max_image_dimension()
        if max_dim <= 0:
            return image_bytes
        try:
            from PIL import Image as PILImage

            img = PILImage.open(io.BytesIO(image_bytes))
            img.load()
            w, h = img.size
            if max(w, h) <= max_dim:
                return image_bytes  # ya cabe: no tocar
            scale = max_dim / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), PILImage.LANCZOS)
            if img.mode != "RGB":
                img = img.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            return buf.getvalue()
        except Exception as e:
            logger.debug("No se pudo optimizar la imagen: %s", e)
            return image_bytes

    @staticmethod
    def _build_payload(model: str, image_bytes: bytes, prompt: str) -> Dict:
        b64 = base64.b64encode(OpenRouterProvider._optimize_image(image_bytes)).decode("utf-8")
        return {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64}"},
                        },
                    ],
                }
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "max_tokens": config.get_max_tokens(),
        }

    def _post(self, payload: Dict, timeout_seconds: Optional[int] = None) -> Tuple[Dict, str]:
        """POST + parseo con reparador de JSON si el contenido no parsea."""
        raw_content, model = self._post_raw(payload, timeout_seconds)
        try:
            data, _ = self._parse_content(raw_content, model)
            return data, model
        except LLMProviderError:
            data_fix, fix_model = self._fix_json_content(raw_content, model)
            self._current_model_used = f"{model} (+fix:{fix_model})"
            return data_fix, model

    def _post_raw(self, payload: Dict, timeout_seconds: Optional[int] = None) -> Tuple[str, str]:
        """POST HTTP crudo: devuelve (content_raw, model).
        SIN reparador (lo usa _fix_json_content para evitar recursión)."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://gema-mapeo.local",
            "X-Title": "GEMA Mapeo - Scanner IA",
        }
        timeout = timeout_seconds or self.timeout_seconds
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(OPENROUTER_CHAT_URL, json=payload, headers=headers)
        except httpx.TimeoutException as e:
            # Timeout no es cuota: no intentar fallback de modelo (sería lento x2)
            raise LLMProviderError(f"Timeout al comunicarse con OpenRouter: {e}") from e
        except httpx.HTTPError as e:
            raise LLMProviderError(f"Error de red con OpenRouter: {e}") from e

        body_text = resp.text or ""

        if resp.status_code != 200:
            raise LLMQuotaError(f"HTTP {resp.status_code}: {body_text[:400]}") \
                if _looks_like_free_quota(resp.status_code, body_text, payload["model"]) \
                else LLMProviderError(f"HTTP {resp.status_code}: {body_text[:400]}")

        try:
            resp_json = resp.json()
            if "choices" not in resp_json:
                err_field = resp_json.get("error") or {}
                err_msg = (
                    err_field.get("message", "")
                    if isinstance(err_field, dict)
                    else str(err_field)
                ) or body_text[:400]
                if _looks_like_free_quota(resp.status_code, err_msg, payload["model"]):
                    raise LLMQuotaError(err_msg)
                raise LLMProviderError(f"Respuesta sin choices de OpenRouter: {err_msg}")
            content = resp_json["choices"][0]["message"]["content"]
            model = resp_json.get("model") or payload["model"]
            # Métricas de uso/costo (OpenRouter devuelve usage.cost en USD)
            usage = resp_json.get("usage") or {}
            self.last_usage = usage
            cost = float(usage.get("cost") or 0.0)
            self.last_cost_usd = cost
            self.total_cost_usd += cost
            self.total_prompt_tokens += int(usage.get("prompt_tokens") or 0)
            self.total_completion_tokens += int(usage.get("completion_tokens") or 0)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            raise LLMProviderError(f"Respuesta inesperada de OpenRouter: {body_text[:400]}") from e

        return content or "", model

    # ------------------------------------------------------------------
    # Reparación de JSON con modelo extra (solo texto, mucho más barato)
    # ------------------------------------------------------------------

    def _fix_json_content(self, content: str, model_orig: str) -> Tuple[Dict, str]:
        """Reenvía el contenido crudo a un modelo de TEXTO barato que extrae
        el JSON válido. Se usa cuando el modelo de visión devolvió contenido
        no parseable (razonamiento, markdown, JSON corrupto)."""
        logger.warning("Usando modelo reparador de JSON (%s) para la salida de %s", self.json_fix_model, model_orig)
        payload = {
            "model": self.json_fix_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": JSON_FIX_PROMPT + content[:60000]},
                    ],
                }
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
            "max_tokens": config.get_max_tokens(),
        }
        try:
            raw_fix, model = self._post_raw(payload)
            data = self._parse_content(raw_fix, model)[0]
        except LLMProviderError as e:
            raise LLMProviderError(
                f"El modelo {model_orig} no devolvió JSON válido y el reparador "
                f"({self.json_fix_model}) tampoco pudo extraerlo: {e}"
            ) from e
        # El reparador puede devolver cualquier JSON; validar el contrato.
        issue = self._validate_response(data)
        if issue is not None and not (isinstance(data, dict) and data.get("tipo_resultado") == "no_mapping_form"):
            raise LLMProviderError(
                f"El reparador devolvió JSON sin el contrato esperado: {issue}"
            )
        return data, model

    @staticmethod
    def _parse_content(content: str, model: str) -> Tuple[Dict, str]:
        """Extrae el JSON del content (muy tolerante).

        Estrategias en orden:
          1. json.loads directo (JSON puro o con fences markdown).
          2. Recorrer todas las posiciones de '{' y probar parsear desde ahí
             hasta el final (rescata el JSON aunque haya razonamiento/texto
             ANTES — común en modelos "reasoning" como nemotron-3).
          3. Limpiar trailing commas y reintentar (mini-corrección).
          4. Priorizar el candidato que contenga 'celdas' o 'tipo_resultado'.
        """
        text = (content or "").strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:].strip()

        def _parse(s: str):
            try:
                return json.loads(s)
            except json.JSONDecodeError:
                return None

        # 1. Directo
        data = _parse(text)
        if isinstance(data, dict):
            return data, model

        # 2. Buscar el objeto balanceado más largo que parsee.
        #    Para cada '{', probar desde ahí hasta el final; quedarse con el
        #    más largo que parsea y que parece nuestro contrato.
        candidatos = []
        for i, ch in enumerate(text):
            if ch != "{":
                continue
            for end in range(len(text) - 1, i - 1, -1):
                if text[end] != "}":
                    continue
                sub = text[i : end + 1]
                d = _parse(sub)
                if isinstance(d, dict):
                    score = 0
                    if "celdas" in d:
                        score += 100
                    if "tipo_resultado" in d:
                        score += 50
                    candidatos.append((len(sub), score, d))
                    break  # el más largo desde esta '{' ya está

        if candidatos:
            candidatos.sort(key=lambda x: (x[1], x[0]), reverse=True)
            data = candidatos[0][2]
            return data, model

        # 3. Mini-corrección: trailing commas (modelos suelen dejarlos)
        import re as _re
        fixed = _re.sub(r",\s*([}\]])", r"\1", text)
        data = _parse(fixed)
        if isinstance(data, dict):
            return data, model
        # También probar los candidatos con la limpieza aplicada
        for i, ch in enumerate(fixed):
            if ch != "{":
                continue
            for end in range(len(fixed) - 1, i - 1, -1):
                if fixed[end] != "}":
                    continue
                d = _parse(fixed[i : end + 1])
                if isinstance(d, dict) and ("celdas" in d or "tipo_resultado" in d):
                    return d, model

        raise LLMProviderError(
            f"El modelo {model} no devolvió JSON válido: {text[:400]}"
        )
