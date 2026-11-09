"""
tests/test_auditoria_excel_roles.py — Pruebas automatizadas de exportación Excel y control RBAC.
Verifica que las recomendaciones geomecánicas solo se emitan para rol 'admin'
y se omitan de forma estricta para roles 'mapeador', 'lectura' o solicitudes sin token.
"""

import os
import json
import tempfile
import openpyxl
import pytest
from app.routers.auditoria import generar_excel_reporte_core
from app.core.rules import RULES_REGISTRY, CATEGORIES_REGISTRY

REC_PHRASES = [
    "Debe ser", "Debe estar", "Se esperaba", "Opciones:", "Rangos válidos:",
    "debe ser mayor a cero", "debe ser positivo"
]


@pytest.fixture
def mock_audit_data():
    """Genera datos sintéticos con incidencias que disparan reglas con recomendación."""
    diag = {
        "proyecto": "FERROBAMBA",
        "total_filas_procesadas": 10,
        "incidencias": [
            {
                "fila_excel": 2,
                "celda_padre": "VNT-001",
                "celda_hija": "VNT-001-01",
                "tipo_mapeo": "Mapeo de Celdas",
                "campania": "2026",
                "geotecnico": "GEO_1",
                "sector_geotecnico": "NORTE",
                "columna": "CONDICION DE AGUA  '76.",
                "valor_actual": "X",
                "rule_code": "ERR_AGUA_76_CODIGO_INVALIDO",
                "tipo_incidencia": "ALERTA",
                "mensaje": RULES_REGISTRY["ERR_AGUA_76_CODIGO_INVALIDO"].format_message(es_admin=True, value="X", allowed_codes="C, H, M, E, F"),
                "mensaje_no_admin": RULES_REGISTRY["ERR_AGUA_76_CODIGO_INVALIDO"].format_message(es_admin=False, value="X", allowed_codes="C, H, M, E, F")
            },
            {
                "fila_excel": 3,
                "celda_padre": "VNT-001",
                "celda_hija": "VNT-001-02",
                "tipo_mapeo": "Mapeo de Celdas",
                "campania": "2026",
                "geotecnico": "GEO_1",
                "sector_geotecnico": "NORTE",
                "columna": "DUREZA",
                "valor_actual": "R9",
                "rule_code": "ERR_DUREZA_76_INVALIDA",
                "tipo_incidencia": "ALERTA",
                "mensaje": RULES_REGISTRY["ERR_DUREZA_76_INVALIDA"].format_message(es_admin=True, value="R9"),
                "mensaje_no_admin": RULES_REGISTRY["ERR_DUREZA_76_INVALIDA"].format_message(es_admin=False, value="R9")
            },
            {
                "fila_excel": 4,
                "celda_padre": "VNT-002",
                "celda_hija": "VNT-002-01",
                "tipo_mapeo": "Mapeo de Celdas",
                "campania": "2026",
                "geotecnico": "GEO_2",
                "sector_geotecnico": "SUR",
                "columna": "DIP",
                "valor_actual": None,
                "rule_code": "ERR_CAMPO_OBLIGATORIO_VACIO",
                "tipo_incidencia": "VACIO",
                "mensaje": RULES_REGISTRY["ERR_CAMPO_OBLIGATORIO_VACIO"].format_message(es_admin=True, col_key="DIP"),
                "mensaje_no_admin": RULES_REGISTRY["ERR_CAMPO_OBLIGATORIO_VACIO"].format_message(es_admin=False, col_key="DIP")
            }
        ]
    }

    compact = {
        "proyecto": "FERROBAMBA",
        "familia1": {
            "num_celdas_padre": 2,
            "total_discontinuidades": 10,
            "total_metros_mapeados": 45.0
        },
        "familia2": {
            "total_fields": 100,
            "total_correctos": 97,
            "total_vacios": 1,
            "total_advertencias": 0,
            "total_alertas": 2
        },
        "resumen_por_celda_padre": {
            "VNT-001": {"dist_celda": 25.0, "campania": "2026", "alertas": 2, "advertencias": 0, "vacios": 0},
            "VNT-002": {"dist_celda": 20.0, "campania": "2026", "alertas": 0, "advertencias": 0, "vacios": 1}
        },
        "distribucion_campania": [
            {"campania": "2026", "discontinuidades": 10, "celdas_afectadas": 2, "estructuras_afectadas": 3, "alertas_cant": 2, "alertas_pct": 20.0, "vacios_cant": 1, "vacios_pct": 10.0}
        ],
        "distribucion_sector": [
            {"sector": "NORTE", "discontinuidades": 5, "alertas_cant": 2, "alertas_pct": 40.0, "vacios_cant": 0, "vacios_pct": 0.0},
            {"sector": "SUR", "discontinuidades": 5, "alertas_cant": 0, "alertas_pct": 0.0, "vacios_cant": 1, "vacios_pct": 20.0}
        ],
        "worst_cells": [
            {"celda": "VNT-001", "total_hijas": 5, "vacios": 0, "advertencias": 0, "alertas": 2, "estado_celda": "ALERTA"}
        ]
    }
    return diag, compact


def test_excel_export_admin_includes_recommendations(mock_audit_data):
    diag, compact = mock_audit_data
    incidencias = list(diag["incidencias"])
    wb = generar_excel_reporte_core(diag, compact, incidencias, es_admin=True)

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        wb.save(tmp_path)
        wb_loaded = openpyxl.load_workbook(tmp_path, data_only=True)

        # En la hoja de detalle o en hojas específicas, deben figurar las recomendaciones
        admin_text_found = False
        for sname in wb_loaded.sheetnames:
            ws = wb_loaded[sname]
            for r in range(1, ws.max_row + 1):
                for c in range(1, ws.max_column + 1):
                    val = str(ws.cell(row=r, column=c).value or "")
                    if "Debe ser uno de" in val or "Debe ser R0 a R6" in val:
                        admin_text_found = True
                        break
                if admin_text_found:
                    break
            if admin_text_found:
                break

        assert admin_text_found is True, "El reporte de Administrador debe incluir recomendaciones explícitas."
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_excel_export_non_admin_omits_all_recommendations(mock_audit_data):
    diag, compact = mock_audit_data
    incidencias = list(diag["incidencias"])
    wb = generar_excel_reporte_core(diag, compact, incidencias, es_admin=False)

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        wb.save(tmp_path)
        wb_loaded = openpyxl.load_workbook(tmp_path, data_only=True)

        found_recs = []
        for sname in wb_loaded.sheetnames:
            ws = wb_loaded[sname]
            for r in range(1, ws.max_row + 1):
                for c in range(1, ws.max_column + 1):
                    val = str(ws.cell(row=r, column=c).value or "")
                    for phrase in REC_PHRASES:
                        if phrase.lower() in val.lower():
                            found_recs.append((sname, r, c, phrase, val))

        assert len(found_recs) == 0, f"El reporte no-admin contiene frases de recomendación prohibidas: {found_recs}"
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_total_inconsistencias_matches_categories(mock_audit_data):
    diag, compact = mock_audit_data
    f2 = compact["familia2"]
    total_alertas = f2["total_alertas"]
    total_advertencias = f2["total_advertencias"]
    total_vacios = f2["total_vacios"]

    total_inconsistencias = total_alertas + total_advertencias + total_vacios
    assert total_inconsistencias == 3
    assert len(diag["incidencias"]) == total_inconsistencias

