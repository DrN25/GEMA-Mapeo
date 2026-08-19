"""
app/core/audit_helpers.py
Funciones puras de utilidad compartidas entre auditoria.py y comparativo.py.
Sin dependencias de FastAPI — solo lógica de negocio y datos.
"""
import os
import shutil
import time
from collections import Counter, defaultdict

from app.core.catalogs import MANDATORY_COLS_COUNT
from app.core.rules import RULES_REGISTRY, CATEGORIES_REGISTRY


# ---------------------------------------------------------------------------
# Conversión de tipos — seguros frente a None
# ---------------------------------------------------------------------------

def safe_int(val, default: int = 0) -> int:
    """Convierte val a int de forma segura, retorna default si falla."""
    if val is None:
        return default
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def safe_float(val, default: float = 0.0) -> float:
    """Convierte val a float de forma segura, retorna default si falla."""
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# Nombre seguro de hoja Excel (máx 31 caracteres, sin chars especiales)
# ---------------------------------------------------------------------------

def get_safe_sheet_name(title: str, index: int) -> str:
    """Genera un nombre de hoja Excel válido (≤ 31 chars, sin chars ilegales)."""
    clean_title = "".join(c for c in title if c not in r':\/?*[]\'\"').strip()
    suffix = f" ({index})"
    max_title_len = 31 - len(suffix)
    return f"{clean_title[:max_title_len].strip()}{suffix}"


# ---------------------------------------------------------------------------
# Reemplazo de archivo con reintentos (evita PermissionError en Windows)
# ---------------------------------------------------------------------------

def safe_replace(src: str, dst: str, retries: int = 5, delay: float = 0.2) -> None:
    """Reemplaza src por dst con reintentos. Fallback a copyfile si os.replace falla."""
    for i in range(retries):
        try:
            os.replace(src, dst)
            return
        except (PermissionError, OSError) as e:
            if i == retries - 1:
                try:
                    shutil.copyfile(src, dst)
                    try:
                        os.remove(src)
                    except Exception:
                        pass
                    return
                except Exception:
                    raise e
            time.sleep(delay)


# ---------------------------------------------------------------------------
# Categorización de incidencias (SSOT para auditoria y comparativo)
# ---------------------------------------------------------------------------

def get_incidence_category_name(i: dict) -> str:
    """
    Retorna el nombre canónico de categoría de una incidencia.
    Primero busca por rule_code en RULES_REGISTRY, luego aplica heurísticas
    sobre el mensaje para compatibilidad con registros legacy.
    """
    rule_code = i.get("rule_code")
    rule = RULES_REGISTRY.get(rule_code) if rule_code else None
    if rule:
        cat = CATEGORIES_REGISTRY.get(rule.category_code)
        if cat:
            return cat.name

    # Fallback para registros legacy (sin rule_code)
    msg = i.get("mensaje", "")
    msg_up = msg.upper()

    # Búsqueda en categorías del registry
    for _cat_code, cat_obj in CATEGORIES_REGISTRY.items():
        if cat_obj.name.upper() in msg_up:
            return cat_obj.name

    # Heurísticas de substring para mensajes legacy
    if "VACÍO" in msg_up or "VACIO" in msg_up or "CAMPO OBLIGATORIO" in msg_up:
        return "Campo obligatorio se encuentra vacío."
    if "ÁNGULO DEL TALUD" in msg_up or "ANGULO DEL TALUD" in msg_up or "DIP_TALUD" in msg_up:
        return "Ángulo del talud fuera del rango [-90, 90] grados."
    if "AGUA" in msg_up:
        if "CÓDIGO" in msg_up or "CODIGO" in msg_up or "NO ADMITIDO" in msg_up:
            return "Código de agua '76 / '89 no admitido. Debe ser C, H, M, E o F."
        if "EXCEDE" in msg_up or "LÍMITES REALES" in msg_up or "LIMITES REALES" in msg_up:
            return "Valor de agua '76 / '89 excede los límites reales de la escala."
        if "INCONGRUENTE" in msg_up or "RATING" in msg_up:
            return "Rating de agua '76 / '89 es incongruente con el código."
        if "MEDIO NO EXACTO" in msg_up:
            return "El valor de agua '76 / '89 es un valor medio no exacto."
    if "DUREZA" in msg_up and "ADMITIDA" in msg_up:
        return "Dureza '76 / '89 no admitida. Debe ser R0 a R6."
    if "RESISTENCIA" in msg_up:
        if "INCONGRUENTE" in msg_up:
            return "Resistencia '76 / '89 es incongruente con la dureza."
        if "LÍMITE REAL" in msg_up or "LIMITE REAL" in msg_up or "EXCEDE" in msg_up or "FUERA DEL" in msg_up:
            return "Rating de resistencia '76 / '89 fuera del límite real."
        if "ALEJADO" in msg_up or "PUNTAJE DE RESISTENCIA" in msg_up:
            return "Puntaje de resistencia '76 / '89 es un valor alejado no válido."
    if "CONTROL ESTRUCTURAL" in msg_up:
        return "Control estructural '76 / '89 fuera de límites permitidos [1, 5]."
    if "EFECTO" in msg_up or "VOLADURA" in msg_up:
        if "EXCEDE" in msg_up or "ESCALA" in msg_up:
            return "Efecto de voladura '76 / '89 excede los límites de la escala."
        if "MEDIO NO EXACTO" in msg_up:
            return "Puntaje de efectos de voladura '76 / '89 es un valor medio no exacto."
    if "RQD" in msg_up:
        if "SUPERIOR AL 100%" in msg_up or "SUPERIOR" in msg_up:
            return "Porcentaje de RQD '76 / '89 no puede ser superior al 100%."
        if "ALEJADO" in msg_up or "PUNTAJE DE RQD" in msg_up:
            return "Puntaje de RQD '76 / '89 es un valor alejado no válido."
    if "ESPACIAMIENTO PROMEDIO" in msg_up:
        if "ES DE 0.0 M" in msg_up or "CERO" in msg_up:
            return "Inconsistencia: El espaciamiento promedio '76 / '89 es de 0.0 m (debe ser mayor a cero)."
        if "POSITIVO" in msg_up or "NEGATIVO" in msg_up:
            return "El espaciamiento promedio '76 / '89 debe ser positivo."
    if "ESPACIAMIENTO" in msg_up:
        if "RANGO" in msg_up or "FUERA DEL" in msg_up:
            return "Valor de rating de espaciamiento '76 / '89 fuera de rango."
        if "ALINEA" in msg_up:
            return "Rating de espaciamiento '76 / '89 no se alinea con el promedio."
        if "MEDIO NO EXACTO" in msg_up:
            return "Puntaje de espaciamiento '76 / '89 es un valor medio no exacto."
    if "SUGERIDA A NORMALIZAR POR 'JN'" in msg_up or "NORMALIZAR POR 'JN'" in msg_up:
        return "Tipo de estructura geológica 'J' sugerida a normalizar por 'JN'."
    if "TIPO DE ESTRUCTURA GEOLÓGICA NO PERMITIDA" in msg_up or "TIPO DE ESTRUCTURA GEOLOGICA NO PERMITIDA" in msg_up:
        return "Tipo de estructura geológica no permitida."
    if ("RELLENO" in msg_up and "CATÁLOGO" in msg_up) or ("RELLENO" in msg_up and "CATALOGO" in msg_up):
        return "Tipo de relleno no pertenece al catálogo."
    if "JRC" in msg_up and "RANGO" in msg_up:
        return "Valor JRC fuera de rango permitido [0, 20]."
    if ("RUGOSIDAD" in msg_up and "LÍMITES" in msg_up) or ("RUGOSIDAD" in msg_up and "LIMITES" in msg_up):
        return "Clase de rugosidad de junta fuera de límites [1, 9]."
    if ("FORMA" in msg_up and "INVÁLIDA" in msg_up) or ("FORMA" in msg_up and "INVALIDA" in msg_up):
        return "Forma de estructura inválida. Debe ser P, C, O, E o I."
    if "ALTERACION" in msg_up or "ALTERACIÓN" in msg_up:
        return "Código de alteración inválido."
    if "ESPESOR" in msg_up and "SUPERIOR" in msg_up and "ABERTURA" in msg_up:
        return "Espesor del relleno es superior a la abertura total."
    if "ABERTURA DE LA FALLA" in msg_up or ("ABERTURA" in msg_up and "FALLA" in msg_up and "SUPERA" in msg_up):
        return "La abertura de la falla supera la longitud de la celda."
    if "UCS" in msg_up and "IS50" in msg_up:
        if "DIVERGENTE" in msg_up:
            return "UCS es divergente a Is50."
        if "DIVERGENCIA" in msg_up or "IS50 * K" in msg_up or "UCS VS IS50 * K" in msg_up:
            return "Divergencia de resistencia uniaxial (UCS vs Is50 * K)."
    if "COMBINACIÓN LITOLÓGICA" in msg_up or "COMBINACION LITOLOGICA" in msg_up:
        return "Combinación litológica Lito 1-2-3 inválida según el catálogo."
    if "UNIDAD LITOLÓGICA" in msg_up or "UNIDAD LITOLOGICA" in msg_up:
        return "Unidad litológica es incongruente con la litología."
    if "INCLINACIÓN (DIP) FUERA" in msg_up or "INCLINACION (DIP) FUERA" in msg_up or ("DIP" in msg_up and "DIP DIR" not in msg_up and "TALUD" not in msg_up):
        return "Valor de inclinación (Dip) fuera de rango permitido [-90, 90] grados."
    if "INCLINACIÓN (DIP DIRECTION) FUERA" in msg_up or "DIP DIR" in msg_up:
        return "Valor de dirección de inclinación (Dip Direction) fuera de rango permitido [0, 360] grados."
    if "NÚMERO DE ESTRUCTURAS" in msg_up or "NUMERO DE ESTRUCTURAS" in msg_up:
        return "En número de estructuras solamente se permiten números enteros."
    if "ESPESOR" in msg_up and "NEGATIVO" in msg_up:
        return "El espesor del relleno no puede ser un valor negativo."
    if "ABERTURA" in msg_up and "NEGATIVO" in msg_up:
        return "La abertura total no puede ser un valor negativo."
    if ("PERSISTENCIA" in msg_up and "NEGATIVO" in msg_up) or ("CONTINUIDAD" in msg_up and "NEGATIVO" in msg_up):
        return "La persistencia de discontinuidad (continuidad) no puede ser un valor negativo."
    if "ESPACIAMIENTO" in msg_up and "NEGATIVO" in msg_up:
        return "El espaciamiento de discontinuidad no puede ser un valor negativo."

    return msg


# ---------------------------------------------------------------------------
# Agregación de métricas de auditoría (SSOT para auditoria y comparativo)
# ---------------------------------------------------------------------------

def aggregate_audit_metrics(diag: dict, years_filter: str = None) -> dict:
    """
    Centraliza el cálculo estadístico y cruzamiento de variables.
    Evita duplicación de código entre el pipeline asíncrono y los endpoints de API.
    """
    from datetime import datetime

    incidencias = diag.get("incidencias", [])
    total_filas_original = diag.get("total_filas_procesadas", 0)
    resumen_celdas_raw = diag.get("resumen_por_celda_padre", {})

    if years_filter and years_filter not in ("TODOS", ""):
        years_list = [y.strip() for y in years_filter.split(",") if y.strip()]
        incidencias = [i for i in incidencias if str(i.get("campania")) in years_list]
        resumen_celdas = {k: v for k, v in resumen_celdas_raw.items() if str(v.get("campania")) in years_list}
        total_filas = len(incidencias)
    else:
        resumen_celdas = resumen_celdas_raw
        total_filas = total_filas_original

    num_celdas_padre = len(resumen_celdas)
    promedio_hijas = sum(x["total_hijas"] for x in resumen_celdas.values()) / max(1, num_celdas_padre)
    total_metros = sum(safe_float(x.get("dist_celda", 0.0)) for x in resumen_celdas.values())

    total_fields = total_filas * MANDATORY_COLS_COUNT
    total_vacios = sum(1 for i in incidencias if i.get("tipo_incidencia") == "VACIO")
    total_advertencias = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
    total_alertas = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    total_correctos = total_fields - (total_vacios + total_advertencias + total_alertas)

    row_errors: dict = defaultdict(set)
    for i in incidencias:
        row_errors[i["fila_excel"]].add(i["tipo_incidencia"])

    discs_con_alerta = sum(1 for errs in row_errors.values() if "ALERTA" in errs)
    discs_con_advertencia = sum(1 for errs in row_errors.values() if "ADVERTENCIA" in errs and "ALERTA" not in errs)
    discs_con_vacio = sum(1 for errs in row_errors.values() if "VACIO" in errs)
    discs_correctas = total_filas - len(row_errors)

    camp_stats: dict = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set(), "celdas": set()})
    geo_stats: dict = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set(), "celdas": set()})
    sector_stats: dict = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set(), "celdas": set()})

    observaciones_por_año: dict = defaultdict(lambda: defaultdict(lambda: {"incidents": 0, "stations": set()}))
    top_stations_por_año: dict = defaultdict(lambda: defaultdict(lambda: Counter()))

    # Inicializar todas las campañas presentes en las estaciones evaluadas (para que campañas 100% limpias aparezcan en métricas)
    for c_info in resumen_celdas.values():
        camp_name = str(c_info.get("campania", "N/A"))
        if camp_name and camp_name not in ("N/A", "None", ""):
            _ = camp_stats[camp_name]

    for i in incidencias:
        c = str(i.get("campania", "N/A"))
        obs_key = get_incidence_category_name(i)
        celda = i.get("celda_padre", "N/A")
        g = i.get("geotecnico", "N/A")
        s = i.get("sector_geotecnico", "N/A")

        observaciones_por_año[c][obs_key]["incidents"] += 1
        observaciones_por_año[c][obs_key]["stations"].add(celda)
        top_stations_por_año[c][obs_key][celda] += 1

        camp_stats[c]["filas"].add(i["fila_excel"])
        camp_stats[c]["celdas"].add(celda)
        geo_stats[g]["filas"].add(i["fila_excel"])
        geo_stats[g]["celdas"].add(celda)
        sector_stats[s]["filas"].add(i["fila_excel"])
        sector_stats[s]["celdas"].add(celda)

        tipo = i.get("tipo_incidencia")
        if tipo == "VACIO":
            camp_stats[c]["vacios"] += 1
            geo_stats[g]["vacios"] += 1
            sector_stats[s]["vacios"] += 1
        elif tipo == "ADVERTENCIA":
            camp_stats[c]["advertencias"] += 1
            geo_stats[g]["advertencias"] += 1
            sector_stats[s]["advertencias"] += 1
        elif tipo == "ALERTA":
            camp_stats[c]["alertas"] += 1
            geo_stats[g]["alertas"] += 1
            sector_stats[s]["alertas"] += 1

    consolidado_tabla: dict = {}
    all_known_years = set(camp_stats.keys()) | set(observaciones_por_año.keys())
    for year in sorted(all_known_years, key=lambda x: str(x)):
        if year in ("N/A", "None", "") and len(all_known_years) > 1:
            continue
        types = observaciones_por_año.get(year, {})
        consolidado_tabla[year] = {}
        total_inc_año = sum(v["incidents"] for v in types.values())
        severity = "LEVE" if total_inc_año < 100 else ("MODERADO" if total_inc_año < 1000 else "CRÍTICO")
        consolidado_tabla[year]["severity"] = severity
        consolidado_tabla[year]["total_incidents"] = total_inc_año
        for obs_key, stats in types.items():
            worst = [{"celda": k, "count": v} for k, v in top_stations_por_año[year][obs_key].most_common(3)]
            consolidado_tabla[year][obs_key] = {
                "incidents": stats["incidents"],
                "affected_stations": len(stats["stations"]),
                "top_stations": worst,
            }

    def _build_dist(stats_dict: dict, key_name: str) -> list:
        rows = []
        for key_val, stats in sorted(stats_dict.items(), key=lambda x: str(x[0])):
            rows_count = len(stats["filas"])
            celdas_afectadas = len(stats["celdas"])
            if rows_count == 0 and key_name == "campania":
                celdas_de_camp = [v for v in resumen_celdas.values() if str(v.get("campania")) == str(key_val)]
                rows_count = sum(c.get("total_hijas", 0) for c in celdas_de_camp)

            total_fields_g = rows_count * MANDATORY_COLS_COUNT
            rows.append({
                key_name: key_val,
                "discontinuidades": rows_count,
                "celdas_afectadas": celdas_afectadas,
                "estructuras_afectadas": len(stats["filas"]),
                "vacios_cant": stats["vacios"],
                "vacios_pct": (stats["vacios"] / max(1, total_fields_g)) * 100,
                "advertencias_cant": stats["advertencias"],
                "advertencias_pct": (stats["advertencias"] / max(1, total_fields_g)) * 100,
                "alertas_cant": stats["alertas"],
                "alertas_pct": (stats["alertas"] / max(1, total_fields_g)) * 100,
            })
        return rows

    distribucion_campania = _build_dist(camp_stats, "campania")
    distribucion_geotecnico = _build_dist(geo_stats, "geotecnico")
    distribucion_sector = _build_dist(sector_stats, "sector")

    msg_alertas = Counter(get_incidence_category_name(i) for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    msg_advertencias = Counter(get_incidence_category_name(i) for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")

    top_5_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common(5)]
    lista_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common()]
    lista_advertencias = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_advertencias)) * 100} for k, v in msg_advertencias.most_common()]

    sorted_worst = sorted(resumen_celdas.items(), key=lambda x: (x[1].get("alertas", 0), x[1].get("vacios", 0), x[1].get("advertencias", 0)), reverse=True)[:20]
    worst_cells = [{"celda": k, **v} for k, v in sorted_worst]
    col_counter = Counter(i.get("columna", "Desconocido") for i in incidencias)
    top_column_errors = [{"columna": k, "cantidad": v} for k, v in col_counter.most_common(15)]

    return {
        "fecha_auditoria": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "consolidado_observaciones": consolidado_tabla,
        "resumen_por_celda_padre": resumen_celdas,
        "status": "completado",
        "familia1": {
            "num_celdas_padre": num_celdas_padre,
            "promedio_hijas": round(promedio_hijas, 2),
            "total_discontinuidades": total_filas,
            "total_metros": round(total_metros, 2),
        },
        "familia2": {
            "total_fields": total_fields,
            "total_vacios": total_vacios,
            "total_advertencias": total_advertencias,
            "total_alertas": total_alertas,
            "total_correctos": total_correctos,
        },
        "familia3": {
            "total_discontinuidades": total_filas,
            "discontinuidades_alertas": discs_con_alerta,
            "discontinuidades_advertencias": discs_con_advertencia,
            "discontinuidades_vacios": discs_con_vacio,
            "discontinuidades_correctas": discs_correctas,
        },
        "distribucion_campania": distribucion_campania,
        "distribucion_sector": distribucion_sector,
        "distribucion_geotecnico": distribucion_geotecnico,
        "top_5_alertas": top_5_alertas,
        "error_types_detailed": {"alertas": lista_alertas, "advertencias": lista_advertencias},
        "worst_cells": worst_cells,
        "top_column_errors": top_column_errors,
    }
