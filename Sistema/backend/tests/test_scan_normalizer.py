"""
tests/test_scan_normalizer.py — Pruebas unitarias del normalizador del agente.

Cubre el caso más importante del módulo: el JSON CRUDO que devuelve el LLM
(sucio, con strings, unidades, códigos raros, valores inventados) debe
convertirse al contrato estándar excel_data/estructuras con los mismos
defaults y límites que el importador de Excel.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.agents.normalizer import (
    classify_raw_response,
    extract_cells_from_raw_response,
    normalize_raw_cell,
)


class TestNormalizeHeader:
    def test_codigo_normalizado(self):
        out = normalize_raw_cell({"codigo": "  td1  "})
        assert out["codigo"] == "td1"

    def test_codigo_asignado_por_defecto_si_vacio(self):
        out = normalize_raw_cell({"codigo": None})
        assert out["codigo"] == "SIN_NOMBRE_1"
        assert out["excel_data"]["codigo"] == "SIN_NOMBRE_1"

    def test_coordenadas_redondeadas_a_3(self):
        out = normalize_raw_cell(
            {"este_ini": 812345.6789, "norte_ini": 8432101.55555}
        )
        assert out["excel_data"]["este_ini"] == 812345.679
        assert out["excel_data"]["norte_ini"] == 8432101.556

    def test_sector_default_pendiente(self):
        out = normalize_raw_cell({})
        assert out["excel_data"]["sector"] == "PENDIENTE"

    def test_mapeador_default_srk(self):
        out = normalize_raw_cell({})
        assert out["excel_data"]["mapeador"] == "SRK"

    def test_campania_derivada_de_fecha(self):
        out = normalize_raw_cell({"fecha": "2025-03-15"})
        assert out["excel_data"]["campania"] == "Campaña 2025"
        assert out["excel_data"]["fecha"] == "2025-03-15"

    def test_campania_default_si_sin_fecha(self):
        out = normalize_raw_cell({})
        assert out["excel_data"]["campania"] == "Campaña 2026"

    def test_largo_null_si_no_viene(self):
        out = normalize_raw_cell({})
        assert out["excel_data"]["largo_m"] is None

    def test_dip_fuera_de_rango_es_missing(self):
        out = normalize_raw_cell({"dip": 95})
        assert out["excel_data"]["dip"] is None
        assert "dip" in out["missing_header"]

    def test_dip_negativo_talud_permitido(self):
        out = normalize_raw_cell({"dip_talud": -30})
        assert out["excel_data"]["dip_talud"] == -30.0

    def test_string_numerico_limpio(self):
        out = normalize_raw_cell({"largo_m": "15,5 m"})
        # "15,5 m" -> replace coma por punto -> "15.5 m" no parsea; es lectura dudosa
        assert out["excel_data"]["largo_m"] is None


class TestNormalizeJoints:
    def test_familia_auto_si_no_viene(self):
        out = normalize_raw_cell({"estructuras": [{"dip": 10, "dip_dir": 90}]})
        assert out["estructuras"][0]["familia_id"] == 1

    def test_familia_explicita_respetada(self):
        out = normalize_raw_cell({"estructuras": [{"familia_id": 3, "dip": 10}]})
        assert out["estructuras"][0]["familia_id"] == 3

    def test_tipo_estructura_default_jn(self):
        out = normalize_raw_cell({"estructuras": [{"dip": 10, "dip_dir": 90}]})
        assert out["estructuras"][0]["tipo_estructura"] == "JN"

    def test_tipo_j_se_normaliza_a_jn(self):
        out = normalize_raw_cell({"estructuras": [{"tipo_estructura": "J"}]})
        assert out["estructuras"][0]["tipo_estructura"] == "JN"

    def test_rugosidad_fuera_de_rango_null(self):
        out = normalize_raw_cell({"estructuras": [{"rugosidad_codigo": 12}]})
        assert out["estructuras"][0]["rugosidad_codigo"] is None
        assert "rugosidad_codigo" in out["missing_joints"][0]

    def test_jrc_recien_21_es_missing(self):
        out = normalize_raw_cell({"estructuras": [{"jrc": 21}]})
        assert out["estructuras"][0]["jrc"] is None

    def test_dip_y_dipdir_defaults_0(self):
        out = normalize_raw_cell({"estructuras": [{}]})
        e = out["estructuras"][0]
        assert e["dip"] == 0.0
        assert e["dip_dir"] == 0.0

    def test_relleno_codigo_minuscula(self):
        out = normalize_raw_cell({"estructuras": [{"relleno_1_codigo": "CL"}]})
        assert out["estructuras"][0]["relleno_1_codigo"] == "cl"


class TestMissingFields:
    def test_celda_vacia_marca_campos_esperados(self):
        out = normalize_raw_cell({})
        assert "largo_m" in out["missing_header"]
        assert "este_ini" not in out["missing_header"]  # default 0.0, no missing
        assert "sector" not in out["missing_header"]  # default PENDIENTE
        assert "mapeador" not in out["missing_header"]  # default SRK
        assert "fecha" not in out["missing_header"]  # default hoy

    def test_confianza_menor_a_1_con_datos_parciales(self):
        out = normalize_raw_cell({"codigo": "TD1", "largo_m": 15})
        assert 0.0 < out["confidence"] < 1.0


class TestClassifyResponse:
    def test_datos_con_celdas(self):
        r = classify_raw_response({"tipo_resultado": "datos", "celdas": [{"codigo": "X"}]})
        assert r["tipo"] == "datos"

    def test_no_mapping_form_explicito(self):
        r = classify_raw_response({"tipo_resultado": "no_mapping_form", "celdas": [], "mensaje": "foto equivocada"})
        assert r["tipo"] == "no_mapping_form"
        assert "foto equivocada" in r["mensaje"]

    def test_no_mapping_form_con_celdas_vacias_sin_marca(self):
        r = classify_raw_response({"celdas": []})
        assert r["tipo"] == "no_mapping_form"

    def test_error_sin_campo_celdas(self):
        r = classify_raw_response({"foo": 1})
        assert r["tipo"] == "error"

    def test_error_no_objeto(self):
        r = classify_raw_response("texto")
        assert r["tipo"] == "error"

    def test_celda_sin_codigo_no_es_error(self):
        """Formulario sin nombre de celda: NO es un error, es una celda
        válida con codigo null (el preview exige el nombre al importar)."""
        r = classify_raw_response({"tipo_resultado": "datos", "celdas": [{"codigo": None}]})
        assert r["tipo"] == "datos"


class TestExtractCells:
    def test_respuesta_con_celdas(self):
        raw = {"celdas": [{"codigo": "TD1"}, {"codigo": "TD2"}]}
        cells = extract_cells_from_raw_response(raw)
        assert len(cells) == 2
        assert cells[0]["codigo"] == "TD1"

    def test_respuesta_sin_codigos_asigna_correlativos(self):
        raw = {"celdas": [{"excel_data": {"largo_m": 10}}, {"excel_data": {"largo_m": 15}}]}
        cells = extract_cells_from_raw_response(raw)
        assert len(cells) == 2
        assert cells[0]["codigo"] == "SIN_NOMBRE_1"
        assert cells[1]["codigo"] == "SIN_NOMBRE_2"

    def test_respuesta_con_alias_estaciones(self):
        raw = {"estaciones": [{"codigo": "EST_A", "estructuras": [{"dip": 45}]}]}
        cells = extract_cells_from_raw_response(raw)
        assert len(cells) == 1
        assert cells[0]["codigo"] == "EST_A"

    def test_respuesta_plana_auto_envuelta(self):
        raw = {"excel_data": {"sector": "NW1", "largo_m": 12}, "estructuras": [{"dip": 45, "dip_dir": 120}]}
        cells = extract_cells_from_raw_response(raw)
        assert len(cells) == 1
        assert cells[0]["codigo"] == "SIN_NOMBRE_1"
        assert cells[0]["excel_data"]["sector"] == "NW1"
        assert len(cells[0]["estructuras"]) == 1

    def test_respuesta_lista_directa(self):
        raw = [{"codigo": "L1", "excel_data": {"largo_m": 5}}]
        cells = extract_cells_from_raw_response(raw)
        assert len(cells) == 1
        assert cells[0]["codigo"] == "L1"

    def test_respuesta_sin_celdas(self):
        assert extract_cells_from_raw_response({"celdas": []}) == []
        assert extract_cells_from_raw_response({}) == []
        assert extract_cells_from_raw_response(None) == []

    def test_no_objeto(self):
        assert extract_cells_from_raw_response("texto") == []


class TestConfig:
    def test_public_config_sin_secretos(self):
        from app.agents import config as cfg

        pub = cfg.public_config()
        assert pub["provider"] == "openrouter"
        assert "api_key" not in str(pub).lower().replace("apikey", "")
        assert "sk-or-v1" not in str(pub)
        assert "max_images_per_batch" in pub
