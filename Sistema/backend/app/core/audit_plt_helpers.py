"""
app/core/audit_plt_helpers.py — Funciones de cálculo y agregación de métricas para Auditoría PLT.
Sin dependencias de FastAPI — lógica de agregación pura y SSOT de categorización.
"""

from collections import Counter, defaultdict
from datetime import datetime
from typing import Dict, List, Optional

from app.core.audit_helpers import safe_float, safe_int
from app.core.rules_plt import CATEGORIES_REGISTRY_PLT, RULES_REGISTRY_PLT

# Cantidad de columnas obligatorias evaluadas en PLT (34 columnas estándar)
PLT_MANDATORY_COLS_COUNT = 34


def get_plt_incidence_category_name(i: dict) -> str:
    """
    Retorna el nombre canónico de la categoría de una incidencia PLT.
    Resuelve rule_code -> ErrorRulePLT -> category_code -> RuleCategoryPLT.name.
    Garantiza que el Catálogo de Errores agrupe exactamente por regla maestra.
    """
    rule_code = i.get("rule_code")
    if rule_code and rule_code in RULES_REGISTRY_PLT:
        rule = RULES_REGISTRY_PLT[rule_code]
        cat = CATEGORIES_REGISTRY_PLT.get(rule.category_code)
        if cat:
            return cat.name

    # Fallback si no viene rule_code
    msg = str(i.get("mensaje", "")).upper()
    for cat in CATEGORIES_REGISTRY_PLT.values():
        if cat.name.upper() in msg:
            return cat.name

    if "VACÍO" in msg or "VACIO" in msg or "OBLIGATORIO" in msg:
        return "Campo obligatorio se encuentra vacío."

    return i.get("mensaje", "Inconsistencia no categorizada")


def aggregate_plt_audit_metrics(diag: dict, years_filter: Optional[str] = None) -> dict:
    """
    Calcula todas las métricas estadísticas, KPIs y cruces de variables para la auditoría PLT.
    Soporta filtrado opcional por años de campaña.
    """
    incidencias_raw = diag.get("incidencias", [])
    total_filas_original = diag.get("total_filas_procesadas", 0)
    resumen_celdas_raw = diag.get("resumen_por_celda", {})
    integrity_summary_raw = diag.get("integrity_summary", {})

    # Filtrado por campañas si aplica
    if years_filter and years_filter not in ("TODOS", "", "None", None):
        years_list = [y.strip() for y in str(years_filter).split(",") if y.strip()]
        incidencias = [i for i in incidencias_raw if str(i.get("campania")) in years_list]
        resumen_celdas = {k: v for k, v in resumen_celdas_raw.items() if str(v.get("campania")) in years_list}
        total_filas = sum(len(v.get("filas", [])) for v in resumen_celdas.values()) if resumen_celdas else len(incidencias)
    else:
        incidencias = incidencias_raw
        resumen_celdas = resumen_celdas_raw
        total_filas = total_filas_original

    num_celdas = len(resumen_celdas)
    promedio_muestras = (total_filas / max(1, num_celdas)) if num_celdas > 0 else 0.0

    # Total campos evaluados
    total_fields = total_filas * PLT_MANDATORY_COLS_COUNT
    total_vacios = sum(1 for i in incidencias if i.get("tipo_incidencia") == "VACIO")
    total_advertencias = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
    total_alertas = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    total_correctos = max(0, total_fields - (total_vacios + total_advertencias + total_alertas))
    pct_integridad = (total_correctos / max(1, total_fields)) * 100.0

    # Clasificación a nivel de registro (fila)
    row_errors: Dict[int, set] = defaultdict(set)
    for i in incidencias:
        row_idx = i.get("fila_excel")
        if row_idx is not None:
            row_errors[row_idx].add(i.get("tipo_incidencia"))

    registros_alerta = sum(1 for errs in row_errors.values() if "ALERTA" in errs)
    registros_advertencia = sum(1 for errs in row_errors.values() if "ADVERTENCIA" in errs and "ALERTA" not in errs)
    registros_vacio = sum(1 for errs in row_errors.values() if "VACIO" in errs and "ALERTA" not in errs and "ADVERTENCIA" not in errs)
    registros_correctos = max(0, total_filas - len(row_errors))

    # Agrupaciones estadísticas
    camp_stats: Dict[str, dict] = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set(), "celdas": set()})
    lito_stats: Dict[str, dict] = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set(), "celdas": set()})
    nivel_stats: Dict[str, dict] = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set(), "celdas": set()})

    # Inicializar con todas las celdas presentes
    for c_key, c_info in resumen_celdas.items():
        camp_name = str(c_info.get("campania", "N/A"))
        if camp_name and camp_name not in ("N/A", "None", ""):
            camp_stats[camp_name]["celdas"].add(c_key)
            for f_num in c_info.get("filas", []):
                camp_stats[camp_name]["filas"].add(f_num)

        lito_name = str(c_info.get("tipo_litologico", "N/A"))
        if lito_name and lito_name not in ("N/A", "None", ""):
            lito_stats[lito_name]["celdas"].add(c_key)
            for f_num in c_info.get("filas", []):
                lito_stats[lito_name]["filas"].add(f_num)

        nivel_val = str(c_info.get("nivel", "N/A"))
        if nivel_val and nivel_val not in ("N/A", "None", ""):
            nivel_stats[nivel_val]["celdas"].add(c_key)
            for f_num in c_info.get("filas", []):
                nivel_stats[nivel_val]["filas"].add(f_num)

    for i in incidencias:
        c = str(i.get("campania", "N/A"))
        l = str(i.get("tipo_litologico", "N/A"))
        n = str(i.get("nivel", "N/A"))
        celda = i.get("celda_mapeo", "N/A")
        fila = i.get("fila_excel")
        tipo = i.get("tipo_incidencia")

        camp_stats[c]["filas"].add(fila)
        camp_stats[c]["celdas"].add(celda)
        lito_stats[l]["filas"].add(fila)
        lito_stats[l]["celdas"].add(celda)
        nivel_stats[n]["filas"].add(fila)
        nivel_stats[n]["celdas"].add(celda)

        if tipo == "VACIO":
            camp_stats[c]["vacios"] += 1
            lito_stats[l]["vacios"] += 1
            nivel_stats[n]["vacios"] += 1
        elif tipo == "ADVERTENCIA":
            camp_stats[c]["advertencias"] += 1
            lito_stats[l]["advertencias"] += 1
            nivel_stats[n]["advertencias"] += 1
        elif tipo == "ALERTA":
            camp_stats[c]["alertas"] += 1
            lito_stats[l]["alertas"] += 1
            nivel_stats[n]["alertas"] += 1

    def _build_dist(stats_dict: dict, key_name: str) -> List[dict]:
        rows = []
        for key_val, stats in sorted(stats_dict.items(), key=lambda x: str(x[0])):
            if str(key_val) in ("None", ""):
                continue
            rows_count = len(stats["filas"])
            celdas_afectadas = len(stats["celdas"])
            total_fields_g = max(1, rows_count * PLT_MANDATORY_COLS_COUNT)
            rows.append({
                key_name: key_val,
                "registros": rows_count,
                "celdas_afectadas": celdas_afectadas,
                "vacios_cant": stats["vacios"],
                "vacios_pct": round((stats["vacios"] / total_fields_g) * 100, 2),
                "advertencias_cant": stats["advertencias"],
                "advertencias_pct": round((stats["advertencias"] / total_fields_g) * 100, 2),
                "alertas_cant": stats["alertas"],
                "alertas_pct": round((stats["alertas"] / total_fields_g) * 100, 2),
            })
        return rows

    distribucion_campania = _build_dist(camp_stats, "campania")
    distribucion_litologia = _build_dist(lito_stats, "tipo_litologico")
    distribucion_nivel = _build_dist(nivel_stats, "nivel")

    # Top Alertas y Advertencias
    msg_alertas = Counter(get_plt_incidence_category_name(i) for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    msg_advertencias = Counter(get_plt_incidence_category_name(i) for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")

    top_5_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common(5)]
    lista_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common()]
    lista_advertencias = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_advertencias)) * 100} for k, v in msg_advertencias.most_common()]

    # Peores celdas
    sorted_worst = sorted(
        resumen_celdas.items(),
        key=lambda x: (x[1].get("alertas", 0), x[1].get("vacios", 0), x[1].get("advertencias", 0)),
        reverse=True
    )[:20]
    worst_cells = [{"celda": k, **v} for k, v in sorted_worst]

    # Top columnas con errores
    col_counter = Counter(i.get("columna", "Desconocido") for i in incidencias)
    top_column_errors = [{"columna": k, "cantidad": v} for k, v in col_counter.most_common(15)]

    # Resumen de Integridad ABCD
    correctas_abcd = sum(1 for c in resumen_celdas.values() if c.get("estado_secuencia") == "CORRECTO (A-B-C-D)")
    desorden_abcd = sum(1 for c in resumen_celdas.values() if c.get("estado_secuencia") == "ORDEN INCORRECTO")
    incompletas_abcd = sum(1 for c in resumen_celdas.values() if c.get("estado_secuencia") == "INCOMPLETA (< 4)")
    excedentes_abcd = sum(1 for c in resumen_celdas.values() if c.get("estado_secuencia") == "EXCEDENTE (> 4)")
    anomalas_abcd = sum(1 for c in resumen_celdas.values() if c.get("estado_secuencia") == "ANÓMALA")

    return {
        "fecha_auditoria": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status": "completado",
        "familia1": {
            "total_registros": total_filas,
            "total_celdas": num_celdas,
            "promedio_muestras_por_celda": round(promedio_muestras, 2),
        },
        "familia2": {
            "total_fields": total_fields,
            "total_vacios": total_vacios,
            "total_advertencias": total_advertencias,
            "total_alertas": total_alertas,
            "total_correctos": total_correctos,
            "pct_integridad": round(pct_integridad, 2),
        },
        "familia3": {
            "total_registros": total_filas,
            "registros_alerta": registros_alerta,
            "registros_advertencia": registros_advertencia,
            "registros_vacio": registros_vacio,
            "registros_correctos": registros_correctos,
        },
        "integridad_celdas": {
            "total_celdas": num_celdas,
            "correctas_abcd": correctas_abcd,
            "desorden_abcd": desorden_abcd,
            "incompletas_abcd": incompletas_abcd,
            "excedentes_abcd": excedentes_abcd,
            "anomalas_abcd": anomalas_abcd,
        },
        "distribucion_campania": distribucion_campania,
        "distribucion_litologia": distribucion_litologia,
        "distribucion_nivel": distribucion_nivel,
        "top_5_alertas": top_5_alertas,
        "error_types_detailed": {
            "alertas": lista_alertas,
            "advertencias": lista_advertencias,
        },
        "worst_cells": worst_cells,
        "top_column_errors": top_column_errors,
        "resumen_por_celda": resumen_celdas,
    }
