"""
tests/test_plt_rules.py — Pruebas unitarias de reglas geomecánicas PLT Irregulares
para Revisión de Excels (Estándar 34 columnas y Campo Compacto), exportador y router PLT.
"""

import math
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import openpyxl
import pytest

from app.core.audit_plt_helpers import aggregate_plt_audit_metrics
from app.core.rules_plt import CATEGORIES_REGISTRY_PLT, COMPACT_FIELD_CATEGORIES, RULES_REGISTRY_PLT
from app.routers.plt import (
    _resolve_direccion_id,
    _resolve_tipo_fractura_id,
    get_ensayos_plt,
    save_ensayos_plt,
)
from app.schemas import EnsayoPLTSaveSchema
from app.services.plt_excel_exporter import export_plt_audit_to_excel
from app.utils.plt_validator import validate_plt_excel


STD_HEADERS = [
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

COMPACT_HEADERS = [
    "CELDA", "Código de muestra", "Lito 1", "Lito 2", "Lito 3",
    "Este", "Norte", "Elevación",
    "Espesor D (cm)", "Longitud L (cm)", "Ancho W1 (cm)", "Ancho W2 (cm)", "Ancho W (cm)",
    "Muestra válida - longitud", "Muestra válida - ancho",
    "Fuerza P (kN)", "Dirección de rotura", "Tipo de fractura",
    "Diámetro equiv. (cm)", "F", "Is", "Is(50) (MPa)", "RCU (MPa)", "Resistencia ISRM",
    "Observaciones",
]


def _compute_expected_metrics(
    *, d=4.0, l=6.0, w1=6.0, w2=6.4, p=12.0, k=12.29
):
    w = round((w1 + w2) / 2.0, 3)
    raw_de = math.sqrt((4.0 * w * d) / math.pi)
    de = round(raw_de, 4)
    f_val = round(math.pow(de / 5.0, 0.45), 4)
    is_val = round((p * 1000.0) / math.pow(de * 10.0, 2), 4)
    is50 = round(is_val * f_val, 4)
    ucs = round(is50 * k, 3)
    val_l = "SI" if l >= d else "NO"
    val_w = "SI" if (0.3 * w < d < w) else "NO"
    # ISRM R0-R6
    if ucs < 1.0:
        isrm = "R0"
    elif ucs < 5.0:
        isrm = "R1"
    elif ucs < 25.0:
        isrm = "R2"
    elif ucs < 50.0:
        isrm = "R3"
    elif ucs < 100.0:
        isrm = "R4"
    elif ucs < 250.0:
        isrm = "R5"
    else:
        isrm = "R6"
    return {
        "w": w, "raw_de": raw_de, "de": de, "f": f_val,
        "is": is_val, "is50": is50, "ucs": ucs,
        "val_l": val_l, "val_w": val_w, "isrm": isrm,
    }


def _make_std_row(
    *,
    celda="AG57",
    muestra="A",
    codigo_muestra=None,
    l1="MZQ",
    l2="MZQ",
    l3="MZQ",
    tipo_lito="INTRUSIVOS",
    este=793150.0,
    norte=8440000.0,
    elev=3900.0,
    d=4.0,
    l=6.0,
    w1=6.0,
    w2=6.4,
    w_override=None,
    p=12.0,
    dir_rot="Pa",
    frac="M",
    de_override=None,
    k=12.29,
    obs="Ensayo regular",
):
    m = _compute_expected_metrics(d=d, l=l, w1=w1, w2=w2, p=p, k=k)
    de_used = de_override if de_override is not None else m["de"]
    # Recalculate F/Is/Is50/UCS using the row's stored De if overridden so downstream formula parity holds
    f_used = round(math.pow(de_used / 5.0, 0.45), 4)
    is_used = round((p * 1000.0) / math.pow(de_used * 10.0, 2), 4)
    is50_used = round(is_used * f_used, 4)
    ucs_used = round(is50_used * k, 3)
    if ucs_used < 1.0:
        isrm_used = "R0"
    elif ucs_used < 5.0:
        isrm_used = "R1"
    elif ucs_used < 25.0:
        isrm_used = "R2"
    elif ucs_used < 50.0:
        isrm_used = "R3"
    elif ucs_used < 100.0:
        isrm_used = "R4"
    elif ucs_used < 250.0:
        isrm_used = "R5"
    else:
        isrm_used = "R6"

    cod = codigo_muestra if codigo_muestra is not None else f"{celda}{muestra}"
    return [
        2026, "2026-05-10", "i", "ING. TEST",
        "FASE 5", 3900, celda, muestra, cod,
        l1, l2, l3, tipo_lito,
        este, norte, elev,
        d, l, w1, w2, (w_override if w_override is not None else m["w"]),
        m["val_l"], m["val_w"], p,
        dir_rot, frac, de_used,
        f_used, is_used, is50_used, k,
        ucs_used, isrm_used, obs,
    ]


def _write_std_workbook(path, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["REPORTE ENSAYOS PLT"])  # fila 1 titulo; fila 2 headers
    ws.append(STD_HEADERS)
    for r in rows:
        ws.append(r)
    wb.save(path)
    wb.close()


def _write_compact_workbook(path, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["FORMATO DE CAMPO"])
    ws.append(["PLT IRREGULAR"])
    ws.append(COMPACT_HEADERS)  # fila 3 headers (index 2)
    ws.append([])
    ws.append([])
    for r in rows:              # fila 6+ datos
        ws.append(r)
    wb.save(path)
    wb.close()


def test_standard_valid_abcd_cell_zero_incidences(tmp_path):
    """Celda A-B-C-D válida con código concatenado sin guion y coordenadas distintas."""
    xlsx = tmp_path / "std_ok.xlsx"
    rows = [
        _make_std_row(muestra="A", este=793150.1, norte=8440000.1, elev=3900.1, frac="M"),
        _make_std_row(muestra="B", este=793151.1, norte=8440001.1, elev=3900.2, frac="M"),
        _make_std_row(muestra="C", este=793152.1, norte=8440002.1, elev=3900.3, frac="E"),
        _make_std_row(muestra="D", este=793153.1, norte=8440003.1, elev=3900.4, frac="C"),
    ]
    _write_std_workbook(xlsx, rows)

    diag = validate_plt_excel(str(xlsx), tolerance=0.1, project="ferrobamba")
    assert diag["formato_detectado"] == "FORMAT_STANDARD_34"
    assert diag["metricas_globales"]["total_alertas"] == 0
    assert diag["metricas_globales"]["total_advertencias"] == 0
    assert diag["metricas_globales"]["total_vacios"] == 0
    assert diag["resumen_fractura"] == {"M": 2, "E": 1, "C": 1, "otros": 0}
    cell_info = next(iter(diag["resumen_por_celda"].values()))
    assert cell_info["estado_secuencia"] == "CORRECTO (A-B-C-D)"


def test_duplicate_coordinates_same_cell_critical(tmp_path):
    """Coordenadas repetidas entre muestras de la misma celda disparan ALERTA crítica."""
    xlsx = tmp_path / "dup_coords.xlsx"
    rows = [
        _make_std_row(muestra="A", este=793150.0, norte=8440000.0, elev=3900.0),
        _make_std_row(muestra="B", este=793150.0, norte=8440000.0, elev=3900.0),
        _make_std_row(muestra="C", este=793152.0, norte=8440002.0, elev=3900.5),
        _make_std_row(muestra="D", este=793153.0, norte=8440003.0, elev=3900.8),
    ]
    _write_std_workbook(xlsx, rows)

    diag = validate_plt_excel(str(xlsx), project="ferrobamba")
    coord_errs = [i for i in diag["incidencias"] if i["rule_code"] == "ERR_PLT_COORD_DUPLICADAS_EN_CELDA"]
    assert len(coord_errs) == 1
    assert coord_errs[0]["tipo_incidencia"] == "ALERTA"
    assert coord_errs[0]["fila_excel"] == 4


def test_applied_load_thresholds_and_mandatory_observations(tmp_path):
    """55<P<=60 es ADVERTENCIA; P>60 es ALERTA + Observaciones VACIO solo si está en blanco."""
    xlsx = tmp_path / "load_p.xlsx"
    rows = [
        # 58 kN: precaución (ADVERTENCIA), sin VACIO aunque obs vacía
        _make_std_row(muestra="A", este=793150.1, p=58.0, obs=""),
        # 62.5 kN + obs vacía: verificación (ALERTA) + obs obligatoria (VACIO)
        _make_std_row(muestra="B", este=793151.1, p=62.5, obs=""),
        # 65.0 kN + obs con sustento: verificación (ALERTA), NO VACIO
        _make_std_row(muestra="C", este=793152.1, p=65.0, obs="Roca muy competente"),
        # 25.0 kN normal
        _make_std_row(muestra="D", este=793153.1, p=25.0, obs=""),
    ]
    _write_std_workbook(xlsx, rows)

    diag = validate_plt_excel(str(xlsx), project="ferrobamba")
    by_code = [i for i in diag["incidencias"]]

    p_alta = [i for i in by_code if i["rule_code"] == "WRN_PLT_CARGA_P_ALTA"]
    p_verif = [i for i in by_code if i["rule_code"] == "ERR_PLT_CARGA_P_VERIFICACION"]
    p_obs = [i for i in by_code if i["rule_code"] == "ERR_PLT_OBSERVACION_OBLIGATORIA_CARGA_P"]

    assert len(p_alta) == 1 and p_alta[0]["tipo_incidencia"] == "ADVERTENCIA" and p_alta[0]["fila_excel"] == 3
    assert len(p_verif) == 2 and all(i["tipo_incidencia"] == "ALERTA" for i in p_verif)
    assert len(p_obs) == 1 and p_obs[0]["tipo_incidencia"] == "VACIO" and p_obs[0]["fila_excel"] == 4


def test_geometry_out_of_norm_and_de_tolerance(tmp_path):
    """Geometría fuera de 0.3W<D<W o L>=D emite ADVERTENCIA; De > ±0.005 cm emite ALERTA."""
    xlsx = tmp_path / "geom_de.xlsx"
    w1, w2 = 6.0, 6.0  # W = 6.0 => 0.3*W = 1.8
    # Fila 3: D=6.5 >= W (viola 0.3W<D<W) y L=5.0 < D (viola L>=D)
    row_bad_geom = _make_std_row(muestra="A", este=793150.1, d=6.5, l=5.0, w1=w1, w2=w2)
    # Fila 4: De dentro de +-0.005 cm (raw_de + 0.004)
    m_ok = _compute_expected_metrics(d=4.0, l=6.0, w1=6.0, w2=6.4)
    row_de_ok = _make_std_row(muestra="B", este=793151.1, de_override=round(m_ok["raw_de"] + 0.004, 4))
    # Fila 5: De excede +-0.005 cm (raw_de + 0.008)
    row_de_bad = _make_std_row(muestra="C", este=793152.1, de_override=round(m_ok["raw_de"] + 0.008, 4))
    row_normal = _make_std_row(muestra="D", este=793153.1)

    _write_std_workbook(xlsx, [row_bad_geom, row_de_ok, row_de_bad, row_normal])
    diag = validate_plt_excel(str(xlsx), tolerance=0.1, project="ferrobamba")

    geom_wrns = [i for i in diag["incidencias"] if i["rule_code"] == "WRN_PLT_GEOMETRIA_FUERA_NORMA"]
    de_errs = [i for i in diag["incidencias"] if i["rule_code"] == "ERR_PLT_DIAMETRO_EQUIV_INCONGRUENTE"]

    assert len(geom_wrns) == 1
    assert geom_wrns[0]["tipo_incidencia"] == "ADVERTENCIA"
    assert geom_wrns[0]["fila_excel"] == 3

    assert len(de_errs) == 1
    assert de_errs[0]["tipo_incidencia"] == "ALERTA"
    assert de_errs[0]["fila_excel"] == 5


def test_factor_k_mismatch_is_warning_and_out_of_range_is_alert(tmp_path):
    """Factor K distinto al catálogo es ADVERTENCIA; K fuera de [5, 30] es ALERTA."""
    xlsx = tmp_path / "factor_k.xlsx"
    rows = [
        _make_std_row(muestra="A", este=793150.1, k=14.84),  # MZQ espera 12.29 -> ADVERTENCIA
        _make_std_row(muestra="B", este=793151.1, k=35.0),   # fuera de [5,30] -> ALERTA
        _make_std_row(muestra="C", este=793152.1, k=12.29),  # OK
        _make_std_row(muestra="D", este=793153.1, k=12.29),  # OK
    ]
    _write_std_workbook(xlsx, rows)
    diag = validate_plt_excel(str(xlsx), project="ferrobamba")

    k_wrns = [i for i in diag["incidencias"] if i["rule_code"] == "ERR_PLT_FACTOR_K_INCORRECTO"]
    k_rng = [i for i in diag["incidencias"] if i["rule_code"] == "ERR_PLT_FACTOR_K_RANGO"]

    assert len(k_wrns) == 1 and k_wrns[0]["tipo_incidencia"] == "ADVERTENCIA" and k_wrns[0]["fila_excel"] == 3
    assert len(k_rng) == 1 and k_rng[0]["tipo_incidencia"] == "ALERTA" and k_rng[0]["fila_excel"] == 4


def test_fracture_catalog_strict_m_e_c_and_unified_f_exponent(tmp_path):
    """Solo M, E, C son válidos ('M-E' rechazado); F siempre usa exponente 0.45 incluso De en [4,6]."""
    xlsx = tmp_path / "frac_and_f.xlsx"
    # D=3.6, W=5.3 -> raw_de=4.9289 (en [4, 6]), helper usa math.pow(de/5.0, 0.45)
    rows = [
        _make_std_row(muestra="A", este=793150.1, d=3.6, l=5.0, w1=5.2, w2=5.4, frac="M"),
        _make_std_row(muestra="B", este=793151.1, d=3.6, l=5.0, w1=5.2, w2=5.4, frac="E"),
        _make_std_row(muestra="C", este=793152.1, d=3.6, l=5.0, w1=5.2, w2=5.4, frac="C"),
        _make_std_row(muestra="D", este=793153.1, d=3.6, l=5.0, w1=5.2, w2=5.4, frac="M-E"),
    ]
    _write_std_workbook(xlsx, rows)
    diag = validate_plt_excel(str(xlsx), tolerance=0.01, project="ferrobamba")

    frac_errs = [i for i in diag["incidencias"] if i["rule_code"] == "ERR_PLT_TIPO_FRACTURA_CATALOGO"]
    f_errs = [i for i in diag["incidencias"] if i["rule_code"] == "ERR_PLT_FACTOR_F_INCONGRUENTE"]

    assert len(f_errs) == 0
    assert len(frac_errs) == 1 and frac_errs[0]["fila_excel"] == 6
    assert diag["resumen_fractura"] == {"M": 1, "E": 1, "C": 1, "otros": 1}


def test_compact_field_format_all_new_rules(tmp_path):
    """Formato de campo compacto evalúa coord duplicadas, carga P>55/>60+obs, De ±0.005 y M/E/C."""
    assert "CAT_PLT_CARGA_P_PRECAUCION" in COMPACT_FIELD_CATEGORIES
    assert "CAT_PLT_CARGA_P_VERIFICACION" in COMPACT_FIELD_CATEGORIES
    assert "CAT_PLT_OBSERVACION_OBLIGATORIA_P" in COMPACT_FIELD_CATEGORIES
    assert "CAT_PLT_COORD_DUPLICADAS_MUESTRAS" in COMPACT_FIELD_CATEGORIES
    assert "CAT_PLT_GEOMETRIA_INVALIDA" in COMPACT_FIELD_CATEGORIES

    xlsx = tmp_path / "compact.xlsx"
    m = _compute_expected_metrics(d=4.0, l=6.0, w1=6.0, w2=6.4, p=12.0, k=12.29)
    # Row 6 (A): válido sin guion AG57A
    r1 = [
        "AG57", "AG57A", "MZQ", "MZQ", "MZQ",
        793150.1, 8440000.1, 3900.1,
        4.0, 6.0, 6.0, 6.4, m["w"], m["val_l"], m["val_w"],
        12.0, "Pa", "M", m["de"], m["f"], m["is"], m["is50"], m["ucs"], m["isrm"], "",
    ]
    # Row 7 (B): coords idénticas a A, P=64 (>60) con obs vacía
    m_p64 = _compute_expected_metrics(d=4.0, l=6.0, w1=6.0, w2=6.4, p=64.0, k=12.29)
    r2 = [
        "AG57", "AG57B", "MZQ", "MZQ", "MZQ",
        793150.1, 8440000.1, 3900.1,
        4.0, 6.0, 6.0, 6.4, m_p64["w"], m_p64["val_l"], m_p64["val_w"],
        64.0, "Pa", "E", m_p64["de"], m_p64["f"], m_p64["is"], m_p64["is50"], m_p64["ucs"], m_p64["isrm"], "",
    ]
    # Row 8 (C): De fuera de tolerancia 0.005 cm
    r3 = [
        "AG57", "AG57C", "MZQ", "MZQ", "MZQ",
        793152.1, 8440002.1, 3900.3,
        4.0, 6.0, 6.0, 6.4, m["w"], m["val_l"], m["val_w"],
        12.0, "Pa", "C", round(m["raw_de"] + 0.007, 4), m["f"], m["is"], m["is50"], m["ucs"], m["isrm"], "",
    ]
    # Row 9 (D): P=57 (55-60 ADVERTENCIA) y geometría inválida (D=6.5 > W=6.0)
    m_badg = _compute_expected_metrics(d=6.5, l=6.0, w1=6.0, w2=6.0, p=57.0, k=12.29)
    r4 = [
        "AG57", "AG57D", "MZQ", "MZQ", "MZQ",
        793153.1, 8440003.1, 3900.4,
        6.5, 6.0, 6.0, 6.0, m_badg["w"], m_badg["val_l"], m_badg["val_w"],
        57.0, "Pa", "M", m_badg["de"], m_badg["f"], m_badg["is"], m_badg["is50"], m_badg["ucs"], m_badg["isrm"], "",
    ]

    _write_compact_workbook(xlsx, [r1, r2, r3, r4])
    diag = validate_plt_excel(str(xlsx), tolerance=0.1, project="ferrobamba")
    assert diag["formato_detectado"] == "FORMAT_COMPACT_FIELD"

    codes = {i["rule_code"] for i in diag["incidencias"]}
    assert "ERR_PLT_COORD_DUPLICADAS_EN_CELDA" in codes
    assert "ERR_PLT_CARGA_P_VERIFICACION" in codes
    assert "ERR_PLT_OBSERVACION_OBLIGATORIA_CARGA_P" in codes
    assert "ERR_PLT_DIAMETRO_EQUIV_INCONGRUENTE" in codes
    assert "WRN_PLT_CARGA_P_ALTA" in codes
    assert "WRN_PLT_GEOMETRIA_FUERA_NORMA" in codes
    assert "ERR_PLT_CODIGO_MUESTRA_INCONGRUENTE" not in codes
    assert diag["resumen_fractura"] == {"M": 2, "E": 1, "C": 1, "otros": 0}


def test_exporter_includes_intact_rock_m_section_and_formulas(tmp_path):
    """El Excel exportado incluye sección Roca Intacta (Solo Tipo M) y tabla de fórmulas ASTM/ISRM."""
    xlsx = tmp_path / "export_in.xlsx"
    rows = [
        _make_std_row(muestra="A", este=793150.1, frac="M"),
        _make_std_row(muestra="B", este=793151.1, frac="E"),
        _make_std_row(muestra="C", este=793152.1, frac="C"),
        _make_std_row(muestra="D", este=793153.1, p=62.0, obs=""),
    ]
    _write_std_workbook(xlsx, rows)
    diag = validate_plt_excel(str(xlsx), project="ferrobamba")
    compact = aggregate_plt_audit_metrics(diag)
    assert compact["resumen_fractura"] == {"M": 2, "E": 1, "C": 1, "otros": 0}

    wb = export_plt_audit_to_excel(diag, compact, diag["incidencias"])
    out_path = tmp_path / "plt_audit_out.xlsx"
    wb.save(out_path)
    wb.close()

    wb_read = openpyxl.load_workbook(out_path, data_only=False)
    try:
        ws = wb_read["📊 Dashboard Ejecutivo"]
        all_texts = [
            str(v)
            for row in ws.iter_rows(values_only=True)
            for v in row
            if v is not None
        ]
        joined = "\n".join(all_texts)
        assert "CRITERIO DE ROCA INTACTA (SOLO TIPO M)" in joined
        assert "M (Matriz)" in joined
        assert "E (Estructura)" in joined
        assert "C (Combinada)" in joined
        assert "W = (W1 + W2) / 2" in joined
        assert "De = √(4 × D × W / π)" in joined
        assert "Is(50) = F × Is" in joined
        assert "RCS = Is(50) × K" in joined
    finally:
        wb_read.close()


def test_router_helpers_and_codigo_muestra_concat_without_underscore():
    """El router resuelve fractura M/E/C, concatena {celda}{muestra} sin '_' y reconstruye celda legacy."""
    assert _resolve_tipo_fractura_id("M") == 1
    assert _resolve_tipo_fractura_id("E") == 2
    assert _resolve_tipo_fractura_id("C") == 3
    assert _resolve_tipo_fractura_id("M-E") is None
    assert _resolve_direccion_id("Pa") == 1
    assert _resolve_direccion_id("Pe") == 2
    assert _resolve_direccion_id("NA") == 3

    from app import models as app_models

    # Mock SQLAlchemy Session & GEMACatalogResolver para verificar save_ensayos_plt -> codigo_muestra = 'AG57A'
    db = MagicMock()

    def _query_side_effect(*entities):
        q = MagicMock()
        q.filter.return_value = q
        q.filter_by.return_value = q
        if entities and entities[0] is app_models.Ventana:
            q.all.return_value = [SimpleNamespace(codigo_celda="AG57", ventana_id=10)]
        else:
            q.all.return_value = []
        q.first.return_value = None
        return q

    db.query.side_effect = _query_side_effect

    fake_resolver = MagicMock()
    fake_resolver.litologia_id.return_value = 1
    fake_resolver.sector_id.return_value = 1

    payload = [
        EnsayoPLTSaveSchema(
            campana=2026,
            celda_mapeo="AG57",
            muestra="A",
            codigo_muestra="",  # fuerza la generación por fallback en backend
            litologia_1="MZQ",
            tipo_fractura="M",
            direccion_rotura="Pa",
            espesor_d=4.0,
            longitud_l=6.0,
            ancho_w1=6.0,
            ancho_w2=6.4,
            ancho_w=6.2,
            fuerza_p=12.0,
        )
    ]
    user = SimpleNamespace(usuario="TESTER", email="t@gema.com")

    with patch("app.routers.ventanas.GEMACatalogResolver", return_value=fake_resolver):
        with patch("app.routers.plt.get_ensayos_plt", return_value=[]) as mock_get:
            save_ensayos_plt(data=payload, celda="AG57", db=db, current_user=user)
            mock_get.assert_called_once()

    added_row = db.add.call_args[0][0]
    assert added_row.codigo_muestra == "AG57A"
    assert added_row.nro_muestra == "A"
    assert added_row.tipo_fractura_id == 1

    # Verificar reconstrucción en get_ensayos_plt cuando ventana_id es None y codigo_muestra='AG57A'
    legacy_row = SimpleNamespace(
        ensayo_plt_id=50,
        campania_id=2026,
        fecha_ensayo=None,
        sector_geotecnico_id=None,
        ejecucion_ensayo="ING",
        usuario_registro="ING",
        zona_muestreo="Z1",
        nivel="3900",
        ventana_id=None,
        codigo_muestra="AG57A",
        nro_muestra="A",
        litologia1_id=None,
        litologia2_id=None,
        litologia3_id=None,
        tipo_litologico="INTRUSIVOS",
        coordenada_este=793150.0,
        coordenada_norte=8440000.0,
        elevacion=3900.0,
        espesor_d_cm=4.0,
        longitud_l_cm=6.0,
        ancho_w1_cm=6.0,
        ancho_w2_cm=6.4,
        ancho_w_cm=6.2,
        muestra_valida_long=True,
        muestra_valida_ancho=True,
        fuerza_p_kn=12.0,
        direccion_id=1,
        tipo_fractura_id=2,
        diametro_equiv_cm=5.619,
        factor_f=1.0537,
        is_mpa=3.8007,
        is50_mpa=4.0048,
        factor_k_valor=12.29,
        ucs_mpa=49.219,
        denominacion_isrm="R3",
        observaciones=None,
    )
    db2 = MagicMock()
    q2 = MagicMock()
    q2.filter.return_value = q2
    q2.limit.return_value = q2
    q2.all.return_value = [legacy_row]
    q2.first.return_value = None
    db2.query.return_value = q2

    res_list = get_ensayos_plt(celda=None, db=db2)
    assert len(res_list) == 1
    assert res_list[0].celda_mapeo == "AG57"
    assert res_list[0].codigo_muestra == "AG57A"
    assert res_list[0].tipo_fractura == "E"
