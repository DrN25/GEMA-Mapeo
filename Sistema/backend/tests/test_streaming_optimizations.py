"""
tests/test_streaming_optimizations.py — Pruebas de regresión y paridad para los
flujos optimizados por streaming (read_only / write_only y archivos temporales):
  - core/excel_styles.py
  - parsers/excel_a.py (detect_format en modo read_only y normal)
  - routers/importador.py (coerción Pandas, ffill, limpieza temporal)
  - routers/congruencia.py (auditar y comparar en streaming)
  - routers/comparativo.py (_load_values_from_excel, comparativo write_only y subida dual)
  - utils/plt_validator.py + services/plt_excel_exporter.py (ferrobamba y chalco)
"""

import asyncio
import math
import os
from unittest.mock import MagicMock

import openpyxl
import pandas as pd
import pytest

from app.core.audit_helpers import aggregate_audit_metrics
from app.core.audit_plt_helpers import aggregate_plt_audit_metrics
from app.core.excel_styles import (
    dedup_pandas_headers,
    save_upload_to_temp,
    wb_to_temp_file_response,
)
from app.parsers.excel_a import detect_format
from app.routers.comparativo import (
    _compare_audits,
    _load_values_from_excel,
    generar_excel_comparativo_core,
    reporte_comparativo_importar,
)
from app.routers.congruencia import auditar_congruencia, comparar_congruencia
from app.routers.importador import list_excel_sheets, preview_import_excel
from app.services.plt_excel_exporter import export_plt_audit_to_excel
from app.utils.plt_validator import validate_plt_excel
from app.utils.validator import clean_and_rename_columns, sanitize_value


class _DummyUpload:
    """Simula UploadFile con lectura por bloques."""

    def __init__(self, path: str, filename: str | None = None):
        self.filename = filename or os.path.basename(path)
        self._path = path
        self._fh = None
        self.file = open(path, "rb")

    async def read(self, size: int = -1):
        if self._fh is None:
            self._fh = open(self._path, "rb")
        chunk = self._fh.read(size)
        if not chunk:
            self._fh.close()
        return chunk

    def close(self):
        if self._fh and not self._fh.closed:
            self._fh.close()
        if self.file and not self.file.closed:
            self.file.close()


class _WholeReadUpload:
    """Simula un objeto simple cuyo metodo read() no acepta parametro size."""

    def __init__(self, path: str):
        self.filename = os.path.basename(path)
        self._path = path

    async def read(self):
        with open(self._path, "rb") as f:
            return f.read()


def _make_mock_db():
    q = MagicMock()
    q.filter.return_value = q
    q.all.return_value = []
    db = MagicMock()
    db.query.return_value = q
    return db


def _build_synthetic_mapeo_xlsx(
    path: str,
    *,
    second_celda_rqd89: float = 13.0,
    extra_col_late_value: bool = False,
    daughter_celda_val=-1,
):
    headers = [
        "ID", "CELDA", "Campaña", "GEOTECNICO", "Sector Geotecnicos",
        "ESTE_FROM", "NORTE_FROM", "COTA", "ESTE_TO", "NORTE_TO", "COTA",
        "Dist.Celda", "Altura", "DIP", "DIP",
        "DUREZA '76", "RESISTENCIA ESTIMADA VALOR '76", "RQD '76", "RQD - VALOR '76",
        "DUREZA '89", "( UCS ) (Mpa)", "RESISTENCIA ESTIMADA VALOR '89",
        "RQD '89", "RQD - VALOR '89",
        "TIPO", "DIP DIR", "ESPACIAMIENTO m.", "ABERTURA mm.", "JRC",
        "x", "y", "z", "FECHA", "CELDA",
    ]
    rows = [
        [
            "E1", "C-001", "2026", "GEO_A", "NORTE",
            "793153.61", 8440000.0, "3950", 793160.0, 8440005.0, 3951.0,
            10.0, 5.0, -70, 45,
            "R3", 4, 60.0, 13,
            "R3", 35.0, 4,
            60.0, 11.79,
            "JN", 120, "0.48", "007", 8,
            10.0, "#VALUE!", "none", "2026-08-01", "C-001",
        ],
        [
            "E2", daughter_celda_val, -1, None, None,
            None, None, None, None, None, None,
            None, None, None, 60,
            None, None, None, None,
            None, None, None,
            None, None,
            "FL", 210, "1.25", "12", 10,
            12.0, 20.0, "text", None, daughter_celda_val,
        ],
        [
            "E3", "C-002", 2021, "GEO_B", "SUR",
            793200.0, 8440100.0, 3960.0, 793210.0, 8440100.0, 3960.0,
            10.0, 6.0, 80, 70,
            "R4", 12, 60.0, 13,
            "R4", 75.0, 6.5,
            60.0, second_celda_rqd89,
            "JN", 95, "0.35", "5", 9,
            None, None, None, "2021-05-10", "C-002",
        ],
    ]
    if extra_col_late_value:
        # Columna sin encabezado y poblada únicamente en una fila tardía
        rows[2].append(42.5)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "BD"
    ws.append(headers)
    for r in rows:
        ws.append(r)
    wb.save(path)
    wb.close()


# ---------------------------------------------------------------------------
# 1. excel_styles
# ---------------------------------------------------------------------------

def test_dedup_pandas_headers_matches_pandas():
    raw = ["CELDA", None, "", "CELDA", "CELDA.1", "DIP", "DIP"]
    assert dedup_pandas_headers(raw) == [
        "CELDA", "Unnamed: 1", "Unnamed: 2", "CELDA.2", "CELDA.1", "DIP", "DIP.1"
    ]


def test_save_upload_to_temp_and_cleanup(tmp_path):
    src = tmp_path / "sample.xlsx"
    src.write_bytes(b"PK-test-bytes")

    async def _run():
        up_chunked = _DummyUpload(str(src))
        out1 = await save_upload_to_temp(up_chunked, suffix=".xlsx", chunk_size=4)
        up_chunked.close()
        assert os.path.exists(out1)
        with open(out1, "rb") as fh:
            assert fh.read() == b"PK-test-bytes"
        os.remove(out1)

        up_whole = _WholeReadUpload(str(src))
        out2 = await save_upload_to_temp(up_whole, suffix=".xlsx")
        assert os.path.exists(out2)
        with open(out2, "rb") as fh:
            assert fh.read() == b"PK-test-bytes"
        os.remove(out2)

    asyncio.run(_run())


def test_wb_to_temp_file_response_creates_and_deletes(tmp_path):
    wb = openpyxl.Workbook(write_only=True)
    ws = wb.create_sheet("Test")
    ws.append(["A", "B"])
    ws.append([1, 2])

    resp = wb_to_temp_file_response(wb, "salida.xlsx")
    assert os.path.exists(resp.path)

    loaded = openpyxl.load_workbook(resp.path, data_only=True)
    try:
        assert loaded.sheetnames == ["Test"]
        assert [c.value for c in loaded["Test"][2]] == [1, 2]
    finally:
        loaded.close()

    asyncio.run(resp.background())
    assert not os.path.exists(resp.path)


# ---------------------------------------------------------------------------
# 2. excel_a.detect_format y importador.py
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("read_only", [True, False])
def test_detect_format_a_b_unknown(tmp_path, read_only):
    p_a = tmp_path / "fmt_a.xlsx"
    wb_a = openpyxl.Workbook()
    ws_a = wb_a.active
    ws_a["B3"] = "UBICACIÓN"
    wb_a.save(p_a)
    wb_a.close()

    p_b = tmp_path / "fmt_b.xlsx"
    wb_b = openpyxl.Workbook()
    wb_b.active.append(["ID", "CELDA", "DIP"])
    wb_b.save(p_b)
    wb_b.close()

    p_u = tmp_path / "fmt_u.xlsx"
    wb_u = openpyxl.Workbook()
    wb_u.active.append(["FOO", "BAR"])
    wb_u.save(p_u)
    wb_u.close()

    for path, expected in ((p_a, "a"), (p_b, "b"), (p_u, "unknown")):
        wb = openpyxl.load_workbook(path, read_only=read_only, data_only=True)
        try:
            assert detect_format(wb.active) == expected
        finally:
            wb.close()


def test_importador_preview_coercion_parity_vs_pandas(tmp_path):
    xlsx_path = tmp_path / "mapeo_imp.xlsx"
    _build_synthetic_mapeo_xlsx(str(xlsx_path), extra_col_late_value=True, daughter_celda_val=None)

    df_pd = pd.read_excel(xlsx_path, engine="openpyxl")

    up_sheets = _DummyUpload(str(xlsx_path))
    up_prev = _DummyUpload(str(xlsx_path))
    db = _make_mock_db()
    try:
        sheets_res = asyncio.run(list_excel_sheets(up_sheets))
        assert sheets_res == {"status": "success", "hojas": ["BD"]}
        prev_res = asyncio.run(preview_import_excel(up_prev, formato="auto", hoja=None, db=db))
    finally:
        up_sheets.close()
        up_prev.close()

    assert prev_res["formato_detectado"] == "bd"
    assert prev_res["total_celdas"] == 2
    assert len(prev_res["celdas"][0]["estructuras"]) == 2
    assert len(prev_res["celdas"][1]["estructuras"]) == 1

    # Validar paridad exacta de raw_header_row frente a pandas.read_excel
    raw_hdr_streaming = prev_res["celdas"][0]["excel_data"]["raw_header_row"]
    pd_row0 = df_pd.iloc[0]
    raw_hdr_pd = {
        str(k): (str(v) if pd.notna(v) else None)
        for k, v in pd_row0.items()
    }
    assert raw_hdr_streaming == raw_hdr_pd
    # Confirmar reglas críticas de coerción Pandas:
    assert raw_hdr_streaming["ESTE_FROM"] == "793153.61"
    assert raw_hdr_streaming["ESPACIAMIENTO m."] == "0.48"
    assert raw_hdr_streaming["y"] is None  # '#VALUE!' -> NA en Pandas
    assert raw_hdr_streaming["z"] == "none"  # 'none' minúscula NO es NA en Pandas
    assert raw_hdr_streaming["Unnamed: 34"] is None  # columna dinámica tardía


# ---------------------------------------------------------------------------
# 3. congruencia.py
# ---------------------------------------------------------------------------

def test_congruencia_auditar_and_comparar_streaming(tmp_path):
    xlsx_a = tmp_path / "cong_a.xlsx"
    xlsx_b = tmp_path / "cong_b.xlsx"
    _build_synthetic_mapeo_xlsx(str(xlsx_a), second_celda_rqd89=13.0)
    _build_synthetic_mapeo_xlsx(str(xlsx_b), second_celda_rqd89=15.0)

    up_aud = _DummyUpload(str(xlsx_a))
    try:
        resp_aud = asyncio.run(auditar_congruencia(up_aud))
    finally:
        up_aud.close()

    wb_aud = openpyxl.load_workbook(resp_aud.path, data_only=True)
    try:
        assert wb_aud.sheetnames == ["Resistencia 76", "RQD 76", "Resistencia 89", "RQD 89"]
        for sname in wb_aud.sheetnames:
            ws = wb_aud[sname]
            assert ws.max_row == 3  # 1 cabecera + 2 celdas padre (C-001, C-002)
            assert ws.auto_filter.ref is not None
        assert wb_aud["Resistencia 76"].cell(2, 7).value == "Si"
        assert wb_aud["RQD 89"].cell(3, 7).value == "Si"  # 2021 discreto: 60% -> 13
    finally:
        wb_aud.close()
        asyncio.run(resp_aud.background())
    assert not os.path.exists(resp_aud.path)

    up_a = _DummyUpload(str(xlsx_a))
    up_b = _DummyUpload(str(xlsx_b))
    try:
        resp_cmp = asyncio.run(comparar_congruencia(up_a, up_b))
    finally:
        up_a.close()
        up_b.close()

    wb_cmp = openpyxl.load_workbook(resp_cmp.path, data_only=True)
    try:
        assert wb_cmp.sheetnames == ["Comparaciones", "Celdas Faltantes"]
        ws_comp = wb_cmp["Comparaciones"]
        assert ws_comp.max_row == 3
        assert ws_comp.auto_filter.ref is not None
        # En C-002 cambió RQD Valor 89 de 13 a 15 -> última columna ("Cambio RQD Valor 89") = "Si"
        assert ws_comp.cell(3, 35).value == "Si"
        assert ws_comp.cell(2, 35).value == "No"
    finally:
        wb_cmp.close()
        asyncio.run(resp_cmp.background())
    assert not os.path.exists(resp_cmp.path)


# ---------------------------------------------------------------------------
# 4. comparativo.py
# ---------------------------------------------------------------------------

def test_comparativo_load_values_export_and_import_endpoint(tmp_path):
    xlsx_a = tmp_path / "cmp_a.xlsx"
    xlsx_b = tmp_path / "cmp_b.xlsx"
    _build_synthetic_mapeo_xlsx(str(xlsx_a), second_celda_rqd89=13.0)
    _build_synthetic_mapeo_xlsx(str(xlsx_b), second_celda_rqd89=15.0)

    keys = {("C-001", 1, "ESPACIAMIENTO m."), ("C-001", 2, "ABERTURA mm."), ("C-001", 1, "y"), ("C-002", 1, "RQD - VALOR '89")}
    vals_b, counts_b = _load_values_from_excel(str(xlsx_b), keys)
    assert counts_b == {"C-001": 2, "C-002": 1}
    assert vals_b[("C-001", 1, "ESPACIAMIENTO m.")] == "0.48"
    assert vals_b[("C-001", 2, "ABERTURA mm.")] == "12"
    assert ("C-001", 1, "y") not in vals_b  # '#VALUE!' tratado como NA igual que Pandas
    assert vals_b[("C-002", 1, "RQD - VALOR '89")] == 15.0

    # Verificar coherencia directa contra Pandas + sanitize_value
    df_pd = clean_and_rename_columns(pd.read_excel(xlsx_b, engine="openpyxl"))
    assert sanitize_value(df_pd.iloc[0]["ESPACIAMIENTO m."], float) == pytest.approx(float(vals_b[("C-001", 1, "ESPACIAMIENTO m.")]))

    diag_a = {
        "nombre_archivo": "A.xlsx",
        "total_filas_procesadas": 3,
        "incidencias": [
            {
                "fila_excel": 2, "celda_padre": "C-001", "celda_hija": "C-001-1",
                "columna": "RQD - VALOR '89", "valor_actual": "11.79",
                "rule_code": "ERR_ABERTURA_RANGO", "tipo_incidencia": "ALERTA",
                "mensaje": "Valor fuera de rango", "campania": "2026", "sector_geotecnico": "NORTE",
            }
        ],
        "resumen_por_celda_padre": {
            "C-001": {"total_hijas": 2, "alertas": 1, "vacios": 0, "campania": "2026", "sector": "NORTE"},
            "C-002": {"total_hijas": 1, "alertas": 0, "vacios": 0, "campania": "2021", "sector": "SUR"},
        },
    }
    diag_b = {
        "nombre_archivo": "B.xlsx",
        "total_filas_procesadas": 3,
        "incidencias": [
            {
                "fila_excel": 4, "celda_padre": "C-002", "celda_hija": "C-002-1",
                "columna": "JRC", "valor_actual": "9",
                "rule_code": "ERR_JRC_RANGO", "tipo_incidencia": "ALERTA",
                "mensaje": "Valor fuera de rango", "campania": "2021", "sector_geotecnico": "SUR",
            }
        ],
        "resumen_por_celda_padre": {
            "C-001": {"total_hijas": 2, "alertas": 0, "vacios": 0, "campania": "2026", "sector": "NORTE"},
            "C-002": {"total_hijas": 1, "alertas": 1, "vacios": 0, "campania": "2021", "sector": "SUR"},
        },
    }
    compact_a = aggregate_audit_metrics({**diag_a, "resumen_por_celda_padre": dict(diag_a["resumen_por_celda_padre"])})
    compact_b = aggregate_audit_metrics({**diag_b, "resumen_por_celda_padre": dict(diag_b["resumen_por_celda_padre"])})

    datos = _compare_audits(diag_a, compact_a, diag_b, compact_b, excel_path_a=str(xlsx_a), excel_path_b=str(xlsx_b))
    assert datos["totales"] == {"nuevas": 1, "resueltas": 1, "persistentes": 0}

    wb_cmp = generar_excel_comparativo_core(datos)
    out_wb = tmp_path / "cmp_out.xlsx"
    wb_cmp.save(out_wb)
    wb_cmp.close()

    wb_chk = openpyxl.load_workbook(out_wb, data_only=False)
    try:
        assert "📊 Dashboard" in wb_chk.sheetnames
        assert "Ref 1" in wb_chk.sheetnames
        assert len(wb_chk["📊 Dashboard"]._charts) == 1
        assert len(wb_chk["📊 Dashboard"].merged_cells.ranges) > 0
        assert wb_chk["📋 Resumen Ejecutivo"].auto_filter.ref is not None
    finally:
        wb_chk.close()

    # Probar endpoint completo reporte_comparativo_importar (subida + auditoría dual + FileResponse)
    up1 = _DummyUpload(str(xlsx_a), filename="cmp_a.xlsx")
    up2 = _DummyUpload(str(xlsx_b), filename="cmp_b.xlsx")
    try:
        resp_ep = asyncio.run(reporte_comparativo_importar(file_a=up1, file_b=up2, proyecto="ferrobamba"))
    finally:
        up1.close()
        up2.close()

    wb_ep = openpyxl.load_workbook(resp_ep.path, data_only=False)
    try:
        assert "📊 Dashboard" in wb_ep.sheetnames
    finally:
        wb_ep.close()
        asyncio.run(resp_ep.background())
    assert not os.path.exists(resp_ep.path)


# ---------------------------------------------------------------------------
# 5. plt_validator.py + plt_excel_exporter.py
# ---------------------------------------------------------------------------

def _build_synthetic_plt_xlsx(path: str):
    headers = [
        "CAMPANA SRK", "FECHA DE ENSAYO", "TIPO DE ENSAYO", "EJECUTADO POR",
        "ZONA DE MUESTREO", "NIVEL", "CELDA DE MAPEO", "MUESTRA", "CODIGO DE MUESTRA",
        "LITOLOGIA 1", "LITOLOGIA 2", "LITOLOGIA 3", "TIPO LITOLOGICO",
        "ESTE (M)", "NORTE (M)", "ELEVACION (MSNM)",
        "ESPESOR D (CM)", "LONGITUD L (CM)", "ANCHO W1 (CM)", "ANCHO W2 (CM)", "ANCHO W (CM)",
        "MUESTRA VALIDA - LONGITUD", "MUESTRA VALIDA - ANCHO", "FUERZA P (KN)",
        "DIRECCION DE ROTURA", "TIPO DE FRACTURA", "DIAMETRO EQUIVALENTE (CM)",
        "F", "IS (MPA)", "IS(50) (MPA)", "FACTOR DE CONVERSION K",
        "RCS/UCS (MPA)", "RESISTENCIA ISRM", "OBSERVACIONES",
    ]
    w1, w2, d, l, p = 5.0, 5.0, 3.0, 4.5, 4.0
    w = (w1 + w2) / 2.0
    de = round(math.sqrt((4.0 * w * d) / math.pi), 2)
    f_val = round(math.pow(de / 5.0, 0.45), 4)
    is_mpa = round((p * 1000.0) / math.pow(de * 10.0, 2), 4)
    is50 = round(is_mpa * f_val, 4)
    k_val = 23.0
    ucs = round(is50 * k_val, 3)

    rows = []
    for sub in ("A", "B"):
        rows.append([
            "2026", "2026-08-15", "IRREGULAR", "SRK",
            "ZONA1", 3900, "PLT-001", sub, f"PLT-001-{sub}",
            "INTRUSIVO", "PORFIDO", "MZQ", "INTRUSIVOS",
            793150.0, 8440000.0, 3900.0,
            d, l, w1, w2, w,
            "SI", "SI", p,
            "Pe", "M", de,
            f_val, is_mpa, is50, k_val,
            ucs, "R3", "OK",
        ])

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["TABLA ENSAYOS PLT"])  # Fila 1 título -> encabezados en fila 2 (index 1)
    ws.append(headers)
    for r in rows:
        ws.append(r)
    wb.save(path)
    wb.close()


def test_plt_streaming_validator_and_write_only_exporter(tmp_path):
    plt_xlsx = tmp_path / "plt_sample.xlsx"
    _build_synthetic_plt_xlsx(str(plt_xlsx))

    diag_ferro = validate_plt_excel(str(plt_xlsx), tolerance=0.1, project="ferrobamba")
    diag_chalco = validate_plt_excel(str(plt_xlsx), tolerance=0.1, project="chalco")

    assert diag_ferro["formato_detectado"] == "FORMAT_STANDARD_34"
    assert diag_ferro["total_filas_procesadas"] == 2
    assert diag_chalco["total_filas_procesadas"] == 2

    compact = aggregate_plt_audit_metrics(diag_ferro)
    wb_plt = export_plt_audit_to_excel(diag_ferro, compact, diag_ferro["incidencias"])
    out_plt = tmp_path / "plt_report.xlsx"
    wb_plt.save(out_plt)
    wb_plt.close()

    wb_chk = openpyxl.load_workbook(out_plt, data_only=False)
    try:
        assert "📊 Dashboard Ejecutivo" in wb_chk.sheetnames
        assert "📋 Catálogo de Errores" in wb_chk.sheetnames
        assert "📑 Detalle de Incidencias" in wb_chk.sheetnames
        assert len(wb_chk.sheetnames) >= 5
    finally:
        wb_chk.close()
