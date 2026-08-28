"""
app/core/audit_plt_helpers.py — Funciones de cálculo y agregación de métricas para Auditoría PLT.
Sin dependencias de FastAPI — lógica de agregación pura y SSOT de categorización.
"""

from collections import Counter, defaultdict
from datetime import datetime
from typing import Dict, List, Optional

from app.core.audit_helpers import safe_float, safe_int
from app.core.rules_plt import CATEGORIES_REGISTRY_PLT, RULES_REGISTRY_PLT, COMPACT_FIELD_CATEGORIES


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
    Soporta filtrado opcional por años de campaña y ajuste dinámico por formato detectado.
    """
    formato_tipo = diag.get("formato_detectado", "FORMAT_STANDARD_34")
    mandatory_cols_count = 24 if "COMPACT" in str(formato_tipo) else 34

    incidencias_raw = diag.get("incidencias", [])
    total_filas_original = diag.get("total_filas_procesadas", 0)
    resumen_celdas_raw = diag.get("resumen_por_celda", {})

    # Filtrado por campañas si aplica
    if years_filter:
        years_list = [y.strip().upper() for y in years_filter.split(",") if y.strip()]
        incidencias = [i for i in incidencias_raw if str(i.get("campania", "")).strip().upper() in years_list]
        resumen_celdas = {
            k: v for k, v in resumen_celdas_raw.items()
            if str(v.get("campania", "")).strip().upper() in years_list
        }
        total_filas = sum(v.get("total_muestras", 0) for v in resumen_celdas.values())
    else:
        incidencias = incidencias_raw
        resumen_celdas = resumen_celdas_raw
        total_filas = total_filas_original

    # 1. Indicadores Familia 1: Muestras y Celdas
    num_celdas = len(resumen_celdas)
    promedio_muestras = (total_filas / max(1, num_celdas)) if num_celdas > 0 else 4.0

    # 2. Indicadores Familia 2: Campos individuales (24 para compacto, 34 para estándar)
    total_fields = total_filas * mandatory_cols_count
    total_vacios = sum(1 for i in incidencias if i.get("tipo_incidencia") == "VACIO")
    total_advertencias = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
    total_alertas = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    total_correctos = max(0, total_fields - (total_vacios + total_advertencias + total_alertas))
    pct_integridad = (total_correctos / max(1, total_fields)) * 100 if total_fields > 0 else 100.0

    # 3. Indicadores Familia 3: Registros/Filas
    filas_con_alerta = set()
    filas_con_advertencia = set()
    filas_con_vacio = set()

    for inc in incidencias:
        fila_idx = inc.get("fila_excel")
        tipo = inc.get("tipo_incidencia")
        if tipo == "ALERTA":
            filas_con_alerta.add(fila_idx)
        elif tipo == "ADVERTENCIA":
            filas_con_advertencia.add(fila_idx)
        elif tipo == "VACIO":
            filas_con_vacio.add(fila_idx)

    registros_alerta = len(filas_con_alerta)
    registros_advertencia = len(filas_con_advertencia - filas_con_alerta)
    registros_vacio = len(filas_con_vacio - filas_con_alerta - filas_con_advertencia)
    registros_correctos = max(0, total_filas - len(filas_con_alerta | filas_con_advertencia | filas_con_vacio))

    # 4. Integridad de Celdas y Secuencias ABCD
    correctas_abcd = sum(1 for v in resumen_celdas.values() if v.get("estado_secuencia") == "CORRECTO (A-B-C-D)")
    desorden_abcd = sum(1 for v in resumen_celdas.values() if "ORDEN" in str(v.get("estado_secuencia", "")))
    incompletas_abcd = sum(1 for v in resumen_celdas.values() if "INCOMPLETA" in str(v.get("estado_secuencia", "")))
    excedentes_abcd = sum(1 for v in resumen_celdas.values() if "EXCEDENTE" in str(v.get("estado_secuencia", "")))
    anomalas_abcd = sum(1 for v in resumen_celdas.values() if "ANÓMALA" in str(v.get("estado_secuencia", "")))

    # 5. Distribución por Campaña
    campanias_data = defaultdict(lambda: {"registros": 0, "celdas": set(), "alertas": 0, "advertencias": 0, "vacios": 0})
    for c_key, c_val in resumen_celdas.items():
        c_name = str(c_val.get("campania", "Sin Campaña"))
        campanias_data[c_name]["registros"] += c_val.get("total_muestras", 0)
        campanias_data[c_name]["celdas"].add(c_key)
        campanias_data[c_name]["alertas"] += c_val.get("alertas", 0)
        campanias_data[c_name]["advertencias"] += c_val.get("advertencias", 0)
        campanias_data[c_name]["vacios"] += c_val.get("vacios", 0)

    distribucion_campania = []
    for c_name, data in sorted(campanias_data.items(), key=lambda x: str(x[0])):
        total_regs = data["registros"]
        total_fields_camp = total_regs * mandatory_cols_count if total_regs > 0 else 1
        distribucion_campania.append({
            "campania": c_name,
            "registros": total_regs,
            "celdas_afectadas": len(data["celdas"]),
            "alertas_cant": data["alertas"],
            "alertas_pct": round((data["alertas"] / total_fields_camp) * 100, 2),
            "advertencias_cant": data["advertencias"],
            "advertencias_pct": round((data["advertencias"] / total_fields_camp) * 100, 2),
            "vacios_cant": data["vacios"],
            "vacios_pct": round((data["vacios"] / total_fields_camp) * 100, 2),
        })

    # 6. Distribución por Tipo Litológico
    lito_data = defaultdict(lambda: {"registros": 0, "celdas": set(), "alertas": 0, "advertencias": 0, "vacios": 0})
    for c_key, c_val in resumen_celdas.items():
        lito_name = str(c_val.get("tipo_litologico", "Sin Litología"))
        lito_data[lito_name]["registros"] += c_val.get("total_muestras", 0)
        lito_data[lito_name]["celdas"].add(c_key)
        lito_data[lito_name]["alertas"] += c_val.get("alertas", 0)
        lito_data[lito_name]["advertencias"] += c_val.get("advertencias", 0)
        lito_data[lito_name]["vacios"] += c_val.get("vacios", 0)

    distribucion_litologia = []
    for l_name, data in sorted(lito_data.items(), key=lambda x: x[1]["alertas"], reverse=True):
        total_regs = data["registros"]
        total_fields_lito = total_regs * mandatory_cols_count if total_regs > 0 else 1
        distribucion_litologia.append({
            "tipo_litologico": l_name,
            "registros": total_regs,
            "celdas_afectadas": len(data["celdas"]),
            "alertas_cant": data["alertas"],
            "alertas_pct": round((data["alertas"] / total_fields_lito) * 100, 2),
            "advertencias_cant": data["advertencias"],
            "advertencias_pct": round((data["advertencias"] / total_fields_lito) * 100, 2),
            "vacios_cant": data["vacios"],
            "vacios_pct": round((data["vacios"] / total_fields_lito) * 100, 2),
        })

    # 7. Celdas con más fallas (Worst Cells)
    worst_cells = []
    for c_key, c_val in sorted(resumen_celdas.items(), key=lambda x: (x[1].get("alertas", 0), x[1].get("advertencias", 0)), reverse=True):
        worst_cells.append({
            "celda": c_key,
            "total_muestras": c_val.get("total_muestras", 0),
            "campania": c_val.get("campania", "—"),
            "tipo_litologico": c_val.get("tipo_litologico", "—"),
            "nivel": c_val.get("nivel", "—"),
            "secuencia": c_val.get("secuencia", "—"),
            "estado_secuencia": c_val.get("estado_secuencia", "—"),
            "alertas": c_val.get("alertas", 0),
            "advertencias": c_val.get("advertencias", 0),
            "vacios": c_val.get("vacios", 0),
        })

    # 8. Agrupación por Reglas / Observaciones Detalladas
    obs_alertas = Counter()
    obs_advertencias = Counter()
    for inc in incidencias:
        tipo = inc.get("tipo_incidencia")
        msg = inc.get("mensaje", "Inconsistencia no categorizada")
        if tipo == "ALERTA":
            obs_alertas[msg] += 1
        elif tipo == "ADVERTENCIA":
            obs_advertencias[msg] += 1

    error_types_detailed = {
        "alertas": [
            {"mensaje": k, "cantidad": v, "pct": round((v / max(1, total_alertas)) * 100, 2)}
            for k, v in obs_alertas.most_common()
        ],
        "advertencias": [
            {"mensaje": k, "cantidad": v, "pct": round((v / max(1, total_advertencias)) * 100, 2)}
            for k, v in obs_advertencias.most_common()
        ],
    }

    top_5_alertas = error_types_detailed["alertas"][:5]

    return {
        "fecha_auditoria": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status": "completado",
        "formato_detectado": formato_tipo,
        "total_registros_evaluados": total_filas,
        "total_alertas": total_alertas,
        "total_advertencias": total_advertencias,
        "total_vacios": total_vacios,
        "total_correctos": total_correctos,
        "integridad_global_pct": round(pct_integridad, 2),
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
        "worst_cells": worst_cells,
        "error_types_detailed": error_types_detailed,
        "top_5_alertas": top_5_alertas,
        "resumen_por_celda": resumen_celdas,
    }
