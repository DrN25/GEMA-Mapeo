"""
app/routers/catalogs.py
Endpoint REST que expone todos los catálogos geomecánicos al frontend.
Fuente única de verdad — cualquier cambio en core/catalogs.py se refleja aquí.
"""
from fastapi import APIRouter

from app.core.catalogs import (
    # Catálogos display enriquecidos
    RESISTENCIA_DISPLAY_CATALOG,
    RQD_DISPLAY_CATALOG,
    ESPACIAMIENTO_DISPLAY_CATALOG,
    AGUA_DISPLAY_CATALOG,
    ALTERACION_DISPLAY_CATALOG,
    RELLENO_DISPLAY_CATALOG,
    RUGOSIDAD_DISPLAY_CATALOG,
    FORMA_DISPLAY_CATALOG,
    ESTRUCTURA_DISPLAY_CATALOG,
    EXTREMOS_TERMINACION_DISPLAY_CATALOG,
    CONTROL_ESTRUCTURAL_DISPLAY_CATALOG,
    EFECTOS_VOLADURA_DISPLAY_CATALOG,
    LITO_COLORES_DISPLAY_CATALOG,
    LITO_VALIDACION_DISPLAY_CATALOG,
    LITHOLOGY_FULL_CATALOG,
    DIRECCION_ROTURA_DISPLAY_CATALOG,
    TIPO_FRACTURA_DISPLAY_CATALOG,
    GSI_SUPERFICIE_DISPLAY_CATALOG,
    GSI_ESTRUCTURA_DISPLAY_CATALOG,
)

router = APIRouter()


@router.get("/catalogs/all")
def get_all_catalogs():
    """
    Retorna todos los catálogos geomecánicos en un único response.
    El frontend carga este endpoint al iniciar y lo cachea en memoria.
    """
    return {
        # Tablas de display para CatalogsView
        "resistencia":          RESISTENCIA_DISPLAY_CATALOG,
        "rqd":                  RQD_DISPLAY_CATALOG,
        "espaciamiento":        ESPACIAMIENTO_DISPLAY_CATALOG,
        "agua":                 AGUA_DISPLAY_CATALOG,
        "alteracion":           ALTERACION_DISPLAY_CATALOG,
        "relleno":              RELLENO_DISPLAY_CATALOG,
        "rugosidad":            RUGOSIDAD_DISPLAY_CATALOG,
        "forma":                FORMA_DISPLAY_CATALOG,
        "estructura":           ESTRUCTURA_DISPLAY_CATALOG,
        "extremos_terminacion": EXTREMOS_TERMINACION_DISPLAY_CATALOG,
        "control_estructural":  CONTROL_ESTRUCTURAL_DISPLAY_CATALOG,
        "efectos_voladura":     EFECTOS_VOLADURA_DISPLAY_CATALOG,
        "direccion_rotura":     DIRECCION_ROTURA_DISPLAY_CATALOG,
        "tipo_fractura":        TIPO_FRACTURA_DISPLAY_CATALOG,
        # Catálogos GSI (Hoek-Brown)
        "gsi_superficie":       GSI_SUPERFICIE_DISPLAY_CATALOG,
        "gsi_estructura":       GSI_ESTRUCTURA_DISPLAY_CATALOG,
        # Tablas de litología (2 vistas)
        "litologia": {
            "tabla_colores":    LITO_COLORES_DISPLAY_CATALOG,    # lito1/lito2/lito3/k
            "tabla_validacion": LITO_VALIDACION_DISPLAY_CATALOG, # grupo/lito2/lito3/validacion/k
        },
        # Tabla completa con grupo+lito1/lito2/lito3/k (para resolveLithologyCascade)
        "lithology_full":       LITHOLOGY_FULL_CATALOG,
    }
