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
import re
from types import SimpleNamespace
import app.routers.auditoria as auditoria_router
from app.routers.auditoria import generar_excel_reporte_core, descargar_reporte_excel
from app.core.rules import RULES_REGISTRY, CATEGORIES_REGISTRY
from app.validation.window_rules import WINDOW_RULES

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


def _window_incident(fila, celda, col, val, rule_code, tipo_incidencia):
    rule = RULES_REGISTRY[rule_code]
    return {
        "fila_excel": fila,
        "celda_padre": celda,
        "celda_hija": f"{celda}-01",
        "tipo_mapeo": rule.tipo_mapeo,
        "campania": "2026",
        "geotecnico": "GEO_1",
        "sector_geotecnico": "NORTE",
        "columna": col,
        "valor_actual": val,
        "rule_code": rule_code,
        "tipo_incidencia": tipo_incidencia,
        "mensaje": rule.format_message(es_admin=True),
        "mensaje_no_admin": rule.format_message(es_admin=False),
    }


def test_cat_window_critica_and_advertencia_distinct_rows_and_valid_hyperlinks(mock_audit_data, tmp_path):
    _, base_compact = mock_audit_data
    cat_crit = CATEGORIES_REGISTRY["CAT_WINDOW_CRITICA"]
    cat_warn = CATEGORIES_REGISTRY["CAT_WINDOW_ADVERTENCIA"]
    assert cat_crit.name != cat_warn.name
    assert cat_crit.get_name(es_admin=False) != cat_warn.get_name(es_admin=False)

    incidencias = [
        _window_incident(2, "VNT-001", "Dist.Celda", 0, "LARGO_CERO", "ALERTA"),
        _window_incident(3, "VNT-002", "Dist.Celda", 45, "LARGO_MAXIMO", "ADVERTENCIA"),
    ]
    diag = {"proyecto": "FERROBAMBA", "total_filas_procesadas": 2, "incidencias": incidencias}
    compact = dict(base_compact)
    compact["familia2"] = {
        "total_fields": 20,
        "total_correctos": 18,
        "total_vacios": 0,
        "total_advertencias": 1,
        "total_alertas": 1,
    }

    for is_admin in (True, False):
        wb = generar_excel_reporte_core(diag, compact, incidencias, es_admin=is_admin)
        out_path = tmp_path / f"cat_window_{'admin' if is_admin else 'std'}.xlsx"
        wb.save(out_path)
        wb.close()
        wb_loaded = openpyxl.load_workbook(out_path, data_only=False)
        ws_cat = wb_loaded["❌ Catálogo de Errores"]

        rows_by_rule = {}
        hyperlink_targets = []
        for row_idx in range(6, ws_cat.max_row + 1):
            rule_name = ws_cat.cell(row=row_idx, column=4).value
            total_val = ws_cat.cell(row=row_idx, column=5).value
            if rule_name:
                rows_by_rule.setdefault(rule_name, []).append(total_val)
            link_val = ws_cat.cell(row=row_idx, column=ws_cat.max_column).value
            if isinstance(link_val, str) and link_val.startswith("=HYPERLINK"):
                match = re.search(r"#(?:'([^']+)'|([^!]+))!", link_val)
                assert match, f"Hipervínculo inesperado en catálogo: {link_val}"
                hyperlink_targets.append((rule_name, match.group(1) or match.group(2)))

        expected_crit = cat_crit.get_name(is_admin)
        expected_warn = cat_warn.get_name(is_admin)
        assert rows_by_rule.get(expected_crit) == [1]
        assert rows_by_rule.get(expected_warn) == [1]
        assert len(hyperlink_targets) == 2
        for rule_name, sheet_target in hyperlink_targets:
            assert sheet_target in wb_loaded.sheetnames, f"Hoja faltante para {rule_name}: {sheet_target}"
        wb_loaded.close()


def test_window_rules_and_numeric_rule_rbac_templates_and_excel_no_rec_phrases(mock_audit_data, tmp_path):
    _, base_compact = mock_audit_data
    window_codes = [rule.code for rule in WINDOW_RULES] + ["ERR_VALOR_NUMERICO_INVALIDO"]
    for code in window_codes:
        rule_obj = RULES_REGISTRY[code]
        assert rule_obj.observation_template, f"Falta observation_template en {code}"
        assert rule_obj.recommendation_template, f"Falta recommendation_template en {code}"
        non_admin_msg = rule_obj.format_message(es_admin=False)
        for phrase in REC_PHRASES:
            assert phrase.lower() not in non_admin_msg.lower(), (
                f"{code} filtró '{phrase}' en mensaje no-admin: {non_admin_msg}"
            )

    incidencias = [
        _window_incident(2, "VNT-001", "DIP", 120, "DIP_HW_RANGO", "ALERTA"),
        _window_incident(3, "VNT-001", "Dist.Celda", 0, "LARGO_CERO", "ALERTA"),
        _window_incident(4, "VNT-002", "DIP_ESTRUC", 12.5, "DIP_ESTRUCTURA_ENTERO", "ALERTA"),
        _window_incident(5, "VNT-002", "Altura", "ABC", "ERR_VALOR_NUMERICO_INVALIDO", "ALERTA"),
    ]
    diag = {"proyecto": "FERROBAMBA", "total_filas_procesadas": 4, "incidencias": incidencias}
    compact = dict(base_compact)
    compact["familia2"] = {
        "total_fields": 40,
        "total_correctos": 36,
        "total_vacios": 0,
        "total_advertencias": 0,
        "total_alertas": 4,
    }

    wb_std = generar_excel_reporte_core(diag, compact, incidencias, es_admin=False)
    std_path = tmp_path / "window_rbac_std.xlsx"
    wb_std.save(std_path)
    wb_std.close()
    wb_std_loaded = openpyxl.load_workbook(std_path, data_only=True)
    try:
        found_recs = []
        for sname in wb_std_loaded.sheetnames:
            ws = wb_std_loaded[sname]
            for r in range(1, ws.max_row + 1):
                for c in range(1, ws.max_column + 1):
                    val = str(ws.cell(row=r, column=c).value or "")
                    for phrase in REC_PHRASES:
                        if phrase.lower() in val.lower():
                            found_recs.append((sname, r, c, phrase, val))
        assert len(found_recs) == 0, f"Excel no-admin filtró frases de recomendación: {found_recs}"
        assert wb_std_loaded["📋 Detalle de Incidencias"].max_row == 5 + len(incidencias)
    finally:
        wb_std_loaded.close()

    wb_adm = generar_excel_reporte_core(diag, compact, incidencias, es_admin=True)
    adm_path = tmp_path / "window_rbac_adm.xlsx"
    wb_adm.save(adm_path)
    wb_adm.close()
    wb_adm_loaded = openpyxl.load_workbook(adm_path, data_only=True)
    try:
        assert wb_adm_loaded["📋 Detalle de Incidencias"].max_row == 5 + len(incidencias)
    finally:
        wb_adm_loaded.close()


def test_descargar_reporte_excel_cache_and_vary_headers(mock_audit_data, tmp_path, monkeypatch):
    diag, compact = mock_audit_data
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr(auditoria_router, "uploads_dir", str(uploads))

    admin_user = SimpleNamespace(rol=SimpleNamespace(nombre="admin"))
    std_user = SimpleNamespace(rol=SimpleNamespace(nombre="mapeador"))

    # 1. Respuesta cacheada pregenerada (admin y estándar)
    (uploads / "reporte_completo_admin_ultimo.xlsx").write_bytes(b"admin-cached")
    (uploads / "reporte_completo_standard_ultimo.xlsx").write_bytes(b"std-cached")
    resp_cached_admin = descargar_reporte_excel(current_user=admin_user)
    resp_cached_std = descargar_reporte_excel(current_user=std_user)
    assert resp_cached_admin.headers.get("cache-control") == "no-store"
    assert resp_cached_admin.headers.get("vary") == "Authorization"
    assert resp_cached_std.headers.get("cache-control") == "no-store"
    assert resp_cached_std.headers.get("vary") == "Authorization"

    # 2. Respuesta regenerada sin caché previo
    (uploads / "reporte_completo_standard_ultimo.xlsx").unlink()
    (uploads / "diagnostico_geomecanico.json").write_text(json.dumps(diag), encoding="utf-8")
    (uploads / "resumen_geomecanico_ligero.json").write_text(json.dumps(compact), encoding="utf-8")
    resp_regen = descargar_reporte_excel(current_user=std_user)
    assert resp_regen.headers.get("cache-control") == "no-store"
    assert resp_regen.headers.get("vary") == "Authorization"

    # 3. Respuesta filtrada temporal (wb_to_temp_file_response)
    resp_filtered = descargar_reporte_excel(celda="VNT-001", current_user=admin_user)
    try:
        assert resp_filtered.headers.get("cache-control") == "no-store"
        assert resp_filtered.headers.get("vary") == "Authorization"
    finally:
        if getattr(resp_filtered, "path", None) and os.path.exists(resp_filtered.path):
            os.remove(resp_filtered.path)

