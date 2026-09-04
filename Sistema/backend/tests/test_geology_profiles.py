"""
tests/test_geology_profiles.py
Pruebas exhaustivas para la arquitectura de Configuración Geológica por Proyecto,
soporte dinámico de catálogos (Ferrobamba / Chalco), aliases, overrides, y compatibilidad de grupos.
"""
import pytest
from app.core.catalogs import (
    normalize_project_name,
    get_project_geology_config,
    get_lithology_catalog_for_project,
    get_available_projects,
    build_display_catalogs,
    infer_lithology_from_lito3,
    GROUP_COMPATIBILITY,
    PROJECT_GEOLOGY_CONFIG,
    FERROBAMBA_LITHOLOGY_CATALOG,
    CHALCO_LITHOLOGY_CATALOG,
)
from app.utils.validator import (
    match_lito_column,
    validate_lithology_correlation,
)
from app.utils.plt_validator import (
    resolve_expected_lithology,
)


def test_normalize_project_name():
    assert normalize_project_name("ferrobamba") == "ferrobamba"
    assert normalize_project_name("FERROBAMBA") == "ferrobamba"
    assert normalize_project_name("Chalco") == "chalco"
    assert normalize_project_name("CHALCOBAMBA") == "chalco"
    assert normalize_project_name("Chalcobamba (Chalco)") == "chalco"
    assert normalize_project_name(None) == "ferrobamba"
    assert normalize_project_name("") == "ferrobamba"
    assert normalize_project_name("desconocido") == "ferrobamba"


def test_get_project_geology_config():
    cfg_fb = get_project_geology_config("ferrobamba")
    assert cfg_fb["name"] == "ferrobamba"
    assert "intrusive_codes" in cfg_fb
    assert "MZB" in cfg_fb["intrusive_codes"]
    assert cfg_fb["default_endo_k"] == 9.87

    cfg_ch = get_project_geology_config("chalco")
    assert cfg_ch["name"] == "chalco"
    assert "SK" in cfg_ch["aliases"]
    assert cfg_ch["aliases"]["SK"] == "SKARN"

    # Fallback a ferrobamba si no existe
    cfg_unknown = get_project_geology_config("xyz_invalid")
    assert cfg_unknown["name"] == "ferrobamba"


def test_get_available_projects():
    projects = get_available_projects()
    assert len(projects) >= 2
    ids = [p["id"] for p in projects]
    assert "ferrobamba" in ids
    assert "chalco" in ids


def test_build_display_catalogs():
    colores, validacion = build_display_catalogs(FERROBAMBA_LITHOLOGY_CATALOG)
    assert len(colores) == len(FERROBAMBA_LITHOLOGY_CATALOG)
    assert len(validacion) > 0

    # Verificar que cada item de tabla_colores tiene 'grupo'
    for item in colores:
        assert "grupo" in item
        assert "lito1" in item
        assert "lito2" in item
        assert "lito3" in item
        assert "k" in item

    # Verificar estructura de tabla_validacion
    for item in validacion:
        assert "grupo" in item
        assert "lito2" in item
        assert "lito3" in item
        assert "k" in item


def test_infer_lithology_from_lito3():
    # Para Ferrobamba
    inf = infer_lithology_from_lito3("MZQ", project="ferrobamba")
    assert inf is not None
    assert inf["lito1"] == "MZQ"
    assert inf["grupo"] == "INTRUSIVOS"
    assert inf["k"] == 12.29

    inf_m = infer_lithology_from_lito3("LMT_M", project="ferrobamba")
    assert inf_m is not None
    assert inf_m["lito1"] == "LMT"

    # Para valor inexistente
    inf_none = infer_lithology_from_lito3("CODIGO_INEXISTENTE_999")
    assert inf_none is None


def test_group_compatibility():
    assert "ENDOSKARN" in GROUP_COMPATIBILITY["SKARN"]
    assert "METAMORFICAS" in GROUP_COMPATIBILITY["SKARN"]
    assert "METAMORFICAS" in GROUP_COMPATIBILITY["EXOSKARN"]


def test_match_lito_column():
    assert match_lito_column("LMT", "LMT") is True
    assert match_lito_column("LMT", "SHL") is False
    assert match_lito_column("-", "CUALQUIERA") is True
    assert match_lito_column("VARIOS", "LMT_M") is True
    assert match_lito_column("INTRUSIVO", "MZB") is True
    
    # Con intrusive_codes específicos de proyecto
    custom_intrusives = {"CUSTOM_INT", "POR"}
    assert match_lito_column("INTRUSIVO", "CUSTOM_INT", intrusive_codes=custom_intrusives) is True
    assert match_lito_column("INTRUSIVO", "SHL", intrusive_codes=custom_intrusives) is False


def test_validator_ferrobamba_standard():
    errors = []
    def reg_err(col, val, code, **kw):
        errors.append((col, val, code, kw))

    # Combinación estándar correcta: LMT / GSK / LMT_M (Metamórfica, k=11.15)
    row = {
        "Lito 1": "LMT",
        "Lito 2": "GSK",
        "Lito 3": "LMT_M",
        "Unidad Litologica": "METAMORFICAS",
        "( UCS )  (Mpa)": 111.5,
        "is50 (Mpa)": 10.0,
    }
    validate_lithology_correlation(row, reg_err, project="ferrobamba")
    assert len(errors) == 0


def test_validator_shifted_rocks():
    errors = []
    def reg_err(col, val, code, **kw):
        errors.append((col, val, code, kw))

    # Orden desplazado (Lito 1 = MBL, Lito 2 = LMT_MG)
    row = {
        "Lito 1": "MBL",
        "Lito 2": "LMT_MG",
        "Lito 3": "-",
        "Unidad Litologica": "METAMORFICAS",
        "( UCS )  (Mpa)": 133.4,
        "is50 (Mpa)": 10.0,
    }
    validate_lithology_correlation(row, reg_err, project="ferrobamba")
    assert len(errors) == 0


def test_validator_skarn_group_compatibility():
    errors = []
    def reg_err(col, val, code, **kw):
        errors.append((col, val, code, kw))

    # Fila donde el usuario ingresa 'SKARN' en Unidad Litologica para una roca metamórfica (GSK)
    row = {
        "Lito 1": "LMT",
        "Lito 2": "GSK",
        "Lito 3": "LMT_M",
        "Unidad Litologica": "SKARN",
        "( UCS )  (Mpa)": 111.5,
        "is50 (Mpa)": 10.0,
    }
    validate_lithology_correlation(row, reg_err, project="ferrobamba")
    # No debe arrojar error de grupo incongruente gracias a GROUP_COMPATIBILITY
    group_errors = [e for e in errors if e[2] == "ERR_UNIDAD_LITOLOGICA_INCONGRUENTE"]
    assert len(group_errors) == 0


def test_validator_chalco_alias():
    errors = []
    def reg_err(col, val, code, **kw):
        errors.append((col, val, code, kw))

    # En Chalco, 'SK' es alias de 'SKARN'
    row = {
        "Lito 1": "LMT",
        "Lito 2": "GSK",
        "Lito 3": "LMT_M",
        "Unidad Litologica": "SK",
        "( UCS )  (Mpa)": 111.5,
        "is50 (Mpa)": 10.0,
    }
    validate_lithology_correlation(row, reg_err, project="chalco")
    group_errors = [e for e in errors if e[2] == "ERR_UNIDAD_LITOLOGICA_INCONGRUENTE"]
    assert len(group_errors) == 0


def test_validator_invalid_combination():
    errors = []
    def reg_err(col, val, code, **kw):
        errors.append((col, val, code, kw))

    # Combinación imposible: INTRUSIVO MZB con roca sedimentaria LMT
    row = {
        "Lito 1": "SHL",
        "Lito 2": "MZB",
        "Lito 3": "MZB_EQ",
        "Unidad Litologica": "INTRUSIVOS",
    }
    validate_lithology_correlation(row, reg_err, project="ferrobamba")
    assert any(e[2] == "ERR_LITOLOGIA_COMBINACION_INVALIDA" for e in errors)


def test_plt_resolve_expected_lithology():
    # Ferrobamba Intrusivo
    tipo, k = resolve_expected_lithology("MZB", "MZB", "MZB_EQ", project="ferrobamba")
    assert tipo == "INTRUSIVOS"
    assert k == 8.29

    # Metamórficas
    tipo_meta, k_meta = resolve_expected_lithology("LMT", "GSK", "LMT_M", project="ferrobamba")
    assert tipo_meta == "METAMORFICAS"
    assert k_meta == 11.15

    # Chalco
    tipo_ch, k_ch = resolve_expected_lithology("MZB", "MZB", "MZB_EQ", project="chalco")
    assert tipo_ch == "INTRUSIVOS"
    assert k_ch == 8.29
