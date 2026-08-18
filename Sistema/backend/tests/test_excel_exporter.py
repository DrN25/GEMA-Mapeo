"""
tests/test_excel_exporter.py — Pruebas unitarias del exportador de Excel basado en plantilla.
"""

import io
import openpyxl
import pytest
from app.services.excel_exporter import export_ventanas_to_excel, _sanitize_val


def test_sanitize_val():
    assert _sanitize_val(-1) is None
    assert _sanitize_val(-1.0) is None
    assert _sanitize_val("-1") is None
    assert _sanitize_val(" -1.0 ") is None
    assert _sanitize_val("None") is None
    assert _sanitize_val("") is None
    assert _sanitize_val(None) is None
    assert _sanitize_val(0) == 0
    assert _sanitize_val(0.0) == 0.0
    assert _sanitize_val("MZQ") == "MZQ"
    assert _sanitize_val("JN") == "JN"


def test_export_single_ventana_basic():
    sample_ventana = {
        "codigo": "TD-01",
        "excel_data": {
            "codigo": "TD-01",
            "sector": "NW1_B",
            "este_ini": 1000.5,
            "norte_ini": 2000.5,
            "cota_ini": 3000.5,
            "este_fin": 1010.5,
            "norte_fin": 2010.5,
            "cota_fin": 3000.5,
            "largo_m": 15.0,
            "altura_m": 15.0,
            "dip_talud": 65.0,
            "lito_3": "MZQ",
            "alteracion": "d",
            "intemperismo": "f",
            "fase": "FASE 1",
            "nivel": "NIVEL 100",
            "mapeador": "SRK",
            "fecha": "2026-08-18",
            "comentarios": "Mapeo de prueba geomecánico",
            "condicion_agua_rmr76": "C",
            "dureza_rmr76": "R3",
            "gsi_superficie": "B",
            "gsi_estructura": "M",
            "gsi_visual_rmr76": 55.0,
            "control_estructural_rmr76": -5.0,
            "efectos_voladura_rmr76": -2.0,
            "ucs_mpa": 85.0,
            "is50_mpa": 3.8
        },
        "estructuras": [
            {
                "familia_id": 1,
                "distancia_m": 2.5,
                "tipo_estructura": "JN",
                "dip": 45.0,
                "dip_dir": 120.0,
                "n_estructuras": 1,
                "abertura_mm": 1.2,
                "espesor_mm": 2.0,
                "continuidad_m": 3.5,
                "espaciamiento_m": 0.8,
                "n_extremos_visibles": 1,
                "terminacion": 1,
                "relleno_1_codigo": "c",
                "relleno_2_codigo": "-1",  # Debe sanitizarse a None
                "jrc": 8.0,
                "rugosidad_codigo": "3",
                "forma_estructura": "P",
                "alteracion_codigo": "d"
            },
            {
                "familia_id": 2,
                "distancia_m": 5.0,
                "tipo_estructura": "FL",
                "dip": 60.0,
                "dip_dir": 210.0,
                "n_estructuras": 2,
                "abertura_mm": 0.5,
                "espesor_mm": 1.0,
                "continuidad_m": 2.0,
                "espaciamiento_m": 1.5,
                "n_extremos_visibles": 2,
                "terminacion": 1,
                "relleno_1_codigo": "s",
                "relleno_2_codigo": None,
                "jrc": 10.0,
                "rugosidad_codigo": "4",
                "forma_estructura": "O",
                "alteracion_codigo": "f"
            }
        ]
    }

    buf = export_ventanas_to_excel(sample_ventana)
    assert isinstance(buf, io.BytesIO)
    assert buf.getbuffer().nbytes > 0

    # Cargar y verificar celdas en el Excel generado
    wb = openpyxl.load_workbook(buf, data_only=False)
    ws = wb["ventana"]

    # 1. Cabecera
    assert ws["A4"].value == "TD-01"
    assert ws["B5"].value == 1000.5
    assert ws["D5"].value == 2000.5
    assert ws["F5"].value == 3000.5
    assert ws["B6"].value == 1010.5
    assert ws["D6"].value == 2010.5
    assert ws["F6"].value == 3000.5
    assert ws["K6"].value == 15.0
    assert ws["N5"].value == 65.0
    # Celdas con fórmulas intactas
    assert str(ws["K5"].value).startswith("=")
    assert str(ws["N6"].value).startswith("=")
    assert str(ws["N7"].value).startswith("=")
    assert str(ws["N8"].value).startswith("=")
    assert ws["P4"].value == "MZQ"
    assert ws["P7"].value == "MZQ"
    assert ws["P5"].value == "d"
    assert ws["P6"].value == "f"
    assert ws["U4"].value == "NW1_B"
    assert ws["U7"].value == "NW1_B"
    assert ws["U5"].value == "FASE 1"
    assert ws["U6"].value == "NIVEL 100"
    assert ws["P8"].value == "SRK"
    assert ws["AK4"].value == "2026-08-18"
    assert ws["BD21"].value == "Mapeo de prueba geomecánico"

    # 2. RMR
    assert ws["AJ11"].value == "C"
    assert ws["AL11"].value == "R3"
    assert ws["AN11"].value == "B"
    assert ws["AO11"].value == "M"
    assert ws["AP11"].value == 55.0
    assert ws["AQ11"].value == -5.0
    assert ws["AR11"].value == -2.0
    assert ws["BA11"].value == 85.0
    assert ws["BB11"].value == 3.8

    # 3. Discontinuidades
    # Fila 15 (Estructura 1)
    assert ws["A15"].value == 1
    assert ws["B15"].value == 2.5
    assert ws["C15"].value == "JN"
    assert ws["D15"].value == 45.0
    assert ws["E15"].value == 120.0
    assert ws["M15"].value == "c"
    assert ws["N15"].value is None  # Sanitizado desde '-1'
    # Fórmulas en fila 15 activa
    assert str(ws["W15"].value).startswith("=")
    assert str(ws["AB15"].value).startswith("=")

    # Fila 16 (Estructura 2)
    assert ws["A16"].value == 2
    assert ws["B16"].value == 5.0
    assert str(ws["W16"].value).startswith("=")
    assert str(ws["AB16"].value).startswith("=")

    # Fila 17 (Fila vacía, no debe tener fórmulas en W..AI)
    assert ws["A17"].value is None
    assert ws["W17"].value is None
    assert ws["AB17"].value is None
    assert ws["AH17"].value is None

    # 4. Fórmulas ponderadas RMR
    assert "SUM(F15:F16)" in str(ws["AW11"].value)
    assert "SUM(F15:F16)" in str(ws["AY11"].value)


def test_export_multiple_ventanas():
    v1 = {
        "codigo": "CELDA-1",
        "excel_data": {"codigo": "CELDA-1", "sector": "SEC-A", "este_ini": 100},
        "estructuras": [{"distancia_m": 1.0, "tipo_estructura": "JN", "dip": 30}]
    }
    v2 = {
        "codigo": "CELDA-2",
        "excel_data": {"codigo": "CELDA-2", "sector": "SEC-B", "este_ini": 200},
        "estructuras": [{"distancia_m": 2.0, "tipo_estructura": "FL", "dip": 50}]
    }

    buf = export_ventanas_to_excel([v1, v2])
    wb = openpyxl.load_workbook(buf, data_only=False)
    ws = wb["ventana"]

    # Celda 1 en base_row=4
    assert ws["A4"].value == "CELDA-1"
    assert ws["U4"].value == "SEC-A"

    # Celda 2 en base_row=34 (4 + 28 + 2 = 34)
    assert ws["A34"].value == "CELDA-2"
    assert ws["U34"].value == "SEC-B"
    assert ws["B35"].value == 200
