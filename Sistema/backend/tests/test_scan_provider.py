"""
tests/test_scan_provider.py — Pruebas del cliente OpenRouter:
fallback free -> pago, errores de cuota vs. errores duros.
"""

import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from app.agents.llm_provider import (
    OpenRouterProvider,
    LLMProviderError,
    LLMQuotaError,
    _looks_like_free_quota,
)

IMG = b"\x89PNG\r\n\x1a\nfake-image-bytes"
PROMPT = "prompt de prueba"


@pytest.fixture(autouse=True)
def _reset_free_broken():
    """Resetea el flag global 'free caído' entre tests (los fakes no deben
    contaminarse entre sí)."""
    import app.agents.llm_provider as mod

    mod._FREE_BROKEN_GLOBAL = False
    yield
    mod._FREE_BROKEN_GLOBAL = False


def _completion_response(model: str, content: str) -> dict:
    return {
        "id": "x",
        "object": "chat.completion",
        "created": 1,
        "model": model,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": content}}],
        "usage": {},
    }


class TestQuotaDetection:
    def test_429_es_cuota(self):
        assert _looks_like_free_quota(429, "", "nvidia/xxx:free") is True

    def test_free_en_mensaje_es_cuota(self):
        body = json.dumps({"error": {"message": "free tier daily limit reached"}})
        assert _looks_like_free_quota(429, body, "nvidia/xxx:free") is True

    def test_mensaje_quota(self):
        assert _looks_like_free_quota(200, "quota exhausted", "nvidia/xxx:free") is True

    def test_error_auth_no_es_cuota(self):
        assert _looks_like_free_quota(401, "Invalid API key", "nvidia/xxx:free") is False

    def test_400_no_es_cuota(self):
        assert _looks_like_free_quota(400, "bad request", "nvidia/xxx:free") is False


class TestFallback:
    @staticmethod
    def _activa_free(monkeypatch):
        """Activa el intento del modelo free (default desactivado en config)."""
        import app.agents.config as cfg
        monkeypatch.setattr(cfg, "get_use_free_model", lambda: True)

    def test_fallback_a_pago_cuando_free_agotado(self, monkeypatch):
        self._activa_free(monkeypatch)
        provider = OpenRouterProvider(
            api_key="test-key",
            free_model="free/model:free",
            paid_model="paid/model",
        )
        calls = []

        def fake_post(self, payload, timeout_seconds=None):
            calls.append(payload["model"])
            if payload["model"].startswith("free"):
                raise LLMQuotaError("free tier limit reached")
            return {"tipo_resultado": "datos", "celdas": [{"codigo": "TD1", "excel_data": {"largo_m": 15}}]}, "paid/model"

        monkeypatch.setattr(OpenRouterProvider, "_post", fake_post)
        data = provider.extract_structured_data(IMG, PROMPT)
        assert calls == ["free/model:free", "paid/model"]
        assert data["celdas"][0]["codigo"] == "TD1"
        assert provider.last_model_used == "paid/model"

    def test_sin_fallback_si_free_responde(self, monkeypatch):
        self._activa_free(monkeypatch)
        provider = OpenRouterProvider(api_key="k", free_model="f:free", paid_model="p")
        calls = []

        def fake_post(self, payload, timeout_seconds=None):
            calls.append(payload["model"])
            return {"tipo_resultado": "datos", "celdas": [{"codigo": "TD1", "excel_data": {"largo_m": 15}}]}, "f:free"

        monkeypatch.setattr(OpenRouterProvider, "_post", fake_post)
        provider.extract_structured_data(IMG, PROMPT)
        assert calls == ["f:free"]

    def test_error_duro_no_reintenta(self, monkeypatch):
        self._activa_free(monkeypatch)
        provider = OpenRouterProvider(api_key="k", free_model="f:free", paid_model="p")
        calls = []

        def fake_post(self, payload, timeout_seconds=None):
            calls.append(payload["model"])
            raise LLMProviderError("Invalid API key")

        monkeypatch.setattr(OpenRouterProvider, "_post", fake_post)
        with pytest.raises(LLMProviderError):
            provider.extract_structured_data(IMG, PROMPT)
        assert calls == ["f:free"]  # no intentó el pago

    def test_ambos_agotados_lanza_provider_error(self, monkeypatch):
        provider = OpenRouterProvider(api_key="k", free_model="f:free", paid_model="p")

        def fake_post(self, payload, timeout_seconds=None):
            raise LLMQuotaError("quota")

        monkeypatch.setattr(OpenRouterProvider, "_post", fake_post)
        with pytest.raises(LLMProviderError):
            provider.extract_structured_data(IMG, PROMPT)

    def test_sin_api_key_error_claro(self):
        provider = OpenRouterProvider(api_key="", free_model="f", paid_model="p")
        with pytest.raises(LLMProviderError, match="OPENROUTER_API_KEY"):
            provider.extract_structured_data(IMG, PROMPT)


class TestParseContent:
    def test_content_json_plano(self):
        provider = OpenRouterProvider(api_key="k", free_model="f", paid_model="p")
        data, model = provider._parse_content('{"celdas": []}', "m")
        assert data == {"celdas": []}

    def test_content_con_fences_markdown(self):
        provider = OpenRouterProvider(api_key="k", free_model="f", paid_model="p")
        data, _ = provider._parse_content('```json\n{"celdas": [{"codigo": "X"}]}\n```', "m")
        assert data["celdas"][0]["codigo"] == "X"

    def test_content_no_json_lanza_error(self):
        provider = OpenRouterProvider(api_key="k", free_model="f", paid_model="p")
        with pytest.raises(LLMProviderError):
            provider._parse_content("no es json", "m")

    def test_payload_incluye_imagen_base64(self):
        provider = OpenRouterProvider(api_key="k", free_model="f", paid_model="p")
        payload = provider._build_payload("f", IMG, PROMPT)
        assert "data:image/png;base64," in payload["messages"][0]["content"][1]["image_url"]["url"]
        assert payload["response_format"] == {"type": "json_object"}


class TestRetriesAndValidation:
    """Reintentos con prompt de corrección y validación estructural."""

    def test_formato_invalido_reintenta_con_correccion(self, monkeypatch):
        provider = OpenRouterProvider(api_key="k", free_model="f:free", paid_model="p")
        responses = iter([
            {"foo": "no tiene celdas"},  # 1er intento: inválido
            {"tipo_resultado": "datos", "celdas": [{"codigo": "TD1", "excel_data": {"largo_m": 15}}]},  # 2do: válido
        ])
        prompts = []

        def fake_post(self, payload, timeout_seconds=None):
            prompts.append(payload["messages"][0]["content"][0]["text"])
            return next(responses), "f:free"

        monkeypatch.setattr(OpenRouterProvider, "_post", fake_post)
        data = provider.extract_structured_data(IMG, PROMPT, max_attempts=2)
        assert data["celdas"][0]["codigo"] == "TD1"
        assert len(prompts) == 2
        assert "REINTENTO" in prompts[1]  # el 2do prompt es de corrección

    def test_no_agota_intentos_si_primero_es_valido(self, monkeypatch):
        provider = OpenRouterProvider(api_key="k", free_model="f:free", paid_model="p")
        calls = []

        def fake_post(self, payload, timeout_seconds=None):
            calls.append(1)
            return {"tipo_resultado": "datos", "celdas": [{"codigo": "TD1", "excel_data": {"largo_m": 15}}]}, "f:free"

        monkeypatch.setattr(OpenRouterProvider, "_post", fake_post)
        provider.extract_structured_data(IMG, PROMPT)
        assert calls == [1]

    def test_no_mapping_form_del_free_se_verifica_con_pago(self, monkeypatch):
        """Falso negativo del modelo FREE: si dice 'no_mapping_form', el
        sistema debe verificar con el modelo de pago (los free son débiles).
        El no_mapping_form del PAGO sí es respuesta válida final."""
        TestFallback._activa_free(monkeypatch)
        provider = OpenRouterProvider(api_key="k", free_model="free/x:free", paid_model="paid/x")
        calls = []

        def fake_post(self, payload, timeout_seconds=None):
            calls.append(payload["model"])
            if payload["model"].startswith("free"):
                return {"tipo_resultado": "no_mapping_form", "celdas": [], "mensaje": "no es formulario"}, "free/x:free"
            return {"tipo_resultado": "datos", "celdas": [{"codigo": "TD1", "excel_data": {"largo_m": 15}}]}, "paid/x"

        monkeypatch.setattr(OpenRouterProvider, "_post", fake_post)
        data = provider.extract_structured_data(IMG, PROMPT)
        assert calls == ["free/x:free", "paid/x"]  # free falló -> pago
        assert data["celdas"][0]["codigo"] == "TD1"
        assert provider.last_model_used == "paid/x"

    def test_no_mapping_form_del_pago_es_final(self, monkeypatch):
        """El pago es confiable: si ÉL dice no_mapping_form, es respuesta
        final (no reintenta). El free se intenta primero por costo, pero el
        modelo devuelto (pago) marca la respuesta como definitiva."""
        TestFallback._activa_free(monkeypatch)
        provider = OpenRouterProvider(api_key="k", free_model="free/x:free", paid_model="paid/x")
        calls = []

        def fake_post(self, payload, timeout_seconds=None):
            calls.append(payload["model"])
            return {"tipo_resultado": "no_mapping_form", "celdas": [], "mensaje": "no es formulario"}, "paid/x"

        monkeypatch.setattr(OpenRouterProvider, "_post", fake_post)
        data = provider.extract_structured_data(IMG, PROMPT)
        assert calls == ["free/x:free"]  # un solo intento (free), respuesta del pago = final
        assert data["tipo_resultado"] == "no_mapping_form"

    def test_celda_sin_codigo_es_valida(self, monkeypatch):
        """celdas con codigo null (formulario sin nombre de celda) es válido:
        NO bloquea el escaneo; la verificación ocurre en el preview."""
        provider = OpenRouterProvider(api_key="k", free_model="f:free", paid_model="p")

        def fake_post(self, payload, timeout_seconds=None):
            return {"tipo_resultado": "datos", "celdas": [{"codigo": None, "excel_data": {"largo_m": 15}}]}, "f:free"

        monkeypatch.setattr(OpenRouterProvider, "_post", fake_post)
        data = provider.extract_structured_data(IMG, PROMPT)
        assert data["celdas"][0]["codigo"] is None

    def test_agota_intentos_si_siempre_invalido(self, monkeypatch):
        provider = OpenRouterProvider(api_key="k", free_model="f:free", paid_model="p")
        calls = []

        def fake_post(self, payload, timeout_seconds=None):
            calls.append(1)
            return {"nada": 1}, "f:free"

        monkeypatch.setattr(OpenRouterProvider, "_post", fake_post)
        with pytest.raises(LLMProviderError, match="2 intentos"):
            provider.extract_structured_data(IMG, PROMPT, max_attempts=2)
        assert len(calls) == 2
