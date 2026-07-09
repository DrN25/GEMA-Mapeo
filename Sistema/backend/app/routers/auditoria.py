import os
import io
import json
import shutil
import math
import openpyxl
import time
import traceback
from datetime import datetime
from collections import Counter, defaultdict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import BarChart, Reference
from openpyxl.utils import get_column_letter

from app.database import get_db
from app.utils.validator import validate_bulk_excel
from app.core.catalogs import MANDATORY_COLS_COUNT

router = APIRouter()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
uploads_dir = os.path.join(BASE_DIR, "uploads")

# --- SISTEMA CENTRALIZADO (SSOT) DE REGLAS DE VALIDACIÓN GEOMECÁNICA ---
from app.core.rules import RULES_REGISTRY, CATEGORIES_REGISTRY

def get_incidence_category_name(i: dict) -> str:
    rule_code = i.get("rule_code")
    rule = RULES_REGISTRY.get(rule_code) if rule_code else None
    if rule:
        cat = CATEGORIES_REGISTRY.get(rule.category_code)
        if cat:
            return cat.name
    
    # Fallback/Backward compatibility for legacy records
    msg = i.get("mensaje", "")
    msg_up = msg.upper()
    for cat_code, cat_obj in CATEGORIES_REGISTRY.items():
        if cat_obj.name.upper() in msg_up:
            return cat_obj.name
            
    # Substring heuristics for legacy messages
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
        if "LÍMITE REAL" in msg_up or "LIMITE REAL" in msg_up or "EXCEDE" in msg_up or "LÍMITE" in msg_up or "FUERA DEL" in msg_up:
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
    if "RELLENO" in msg_up and "CATÁLOGO" in msg_up or "RELLENO" in msg_up and "CATALOGO" in msg_up:
        return "Tipo de relleno no pertenece al catálogo."
    if "JRC" in msg_up and "RANGO" in msg_up:
        return "Valor JRC fuera de rango permitido [0, 20]."
    if "RUGOSIDAD" in msg_up and "LÍMITES" in msg_up or "RUGOSIDAD" in msg_up and "LIMITES" in msg_up:
        return "Clase de rugosidad de junta fuera de límites [1, 9]."
    if "FORMA" in msg_up and "INVÁLIDA" in msg_up or "FORMA" in msg_up and "INVALIDA" in msg_up:
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
    if "PERSISTENCIA" in msg_up and "NEGATIVO" in msg_up or "CONTINUIDAD" in msg_up and "NEGATIVO" in msg_up:
        return "La persistencia de discontinuidad (continuidad) no puede ser un valor negativo."
    if "ESPACIAMIENTO" in msg_up and "NEGATIVO" in msg_up:
        return "El espaciamiento de discontinuidad no puede ser un valor negativo."
        
    return msg

def safe_int(val, default=0):
    if val is None: return default
    try: return int(val)
    except: return default

def safe_float(val, default=0.0):
    if val is None: return default
    try: return float(val)
    except: return default

def get_safe_sheet_name(title, index):
    clean_title = "".join(c for c in title if c not in r':\/?*[]\'"').strip()
    suffix = f" ({index})"
    max_title_len = 31 - len(suffix)
    return f"{clean_title[:max_title_len].strip()}{suffix}"

def safe_replace(src: str, dst: str, retries: int = 5, delay: float = 0.2):
    for i in range(retries):
        try:
            os.replace(src, dst)
            return
        except (PermissionError, OSError) as e:
            if i == retries - 1:
                try:
                    shutil.copyfile(src, dst)
                    try: os.remove(src)
                    except: pass
                    return
                except:
                    raise e
            time.sleep(delay)

# --- FUNCIÓN DE AGREGACIÓN UNIFICADA ---
def aggregate_audit_metrics(diag: dict, years_filter: str = None) -> dict:
    """
    Centraliza el cálculo estadístico y cruzamiento de variables para evitar 
    duplicación de código entre el pipeline asíncrono y los endpoints de API.
    """
    incidencias = diag.get("incidencias", [])
    total_filas_original = diag.get("total_filas_procesadas", 0)
    resumen_celdas_raw = diag.get("resumen_por_celda_padre", {})
    
    if years_filter and years_filter != "TODOS" and years_filter != "":
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
    
    row_errors = defaultdict(set)
    for i in incidencias:
        row_errors[i["fila_excel"]].add(i["tipo_incidencia"])
        
    discs_con_alerta = sum(1 for row, errs in row_errors.items() if "ALERTA" in errs)
    discs_con_advertencia = sum(1 for row, errs in row_errors.items() if "ADVERTENCIA" in errs and "ALERTA" not in errs)
    discs_con_vacio = sum(1 for row, errs in row_errors.items() if "VACIO" in errs)
    discs_correctas = total_filas - len(row_errors)
    
    camp_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set(), "celdas": set()})
    geo_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set(), "celdas": set()})
    sector_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set(), "celdas": set()})
    
    observaciones_por_año = defaultdict(lambda: defaultdict(lambda: {"incidents": 0, "stations": set()}))
    top_stations_por_año = defaultdict(lambda: defaultdict(lambda: Counter()))
    
    for i in incidencias:
        c = i.get("campania", "N/A")
        obs_key = get_incidence_category_name(i)
        celda = i.get("celda_padre", "N/A")
        
        observaciones_por_año[c][obs_key]["incidents"] += 1
        observaciones_por_año[c][obs_key]["stations"].add(celda)
        top_stations_por_año[c][obs_key][celda] += 1
        
        camp_stats[c]["filas"].add(i["fila_excel"])
        camp_stats[c]["celdas"].add(i.get("celda_padre", "N/A"))
        geo_stats[g := i.get("geotecnico", "N/A")]["filas"].add(i["fila_excel"])
        geo_stats[g]["celdas"].add(i.get("celda_padre", "N/A"))
        sector_stats[s := i.get("sector_geotecnico", "N/A")]["filas"].add(i["fila_excel"])
        sector_stats[s]["celdas"].add(i.get("celda_padre", "N/A"))
        
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
            
    consolidado_tabla = {}
    for year, types in observaciones_por_año.items():
        consolidado_tabla[year] = {}
        total_inc_año = sum(v["incidents"] for k, v in types.items())
        severity = "LEVE" if total_inc_año < 100 else ("MODERADO" if total_inc_año < 1000 else "CRÍTICO")
        consolidado_tabla[year]["severity"] = severity
        consolidado_tabla[year]["total_incidents"] = total_inc_año
        
        for obs_key, stats in types.items():
            worst = [{"celda": k, "count": v} for k, v in top_stations_por_año[year][obs_key].most_common(3)]
            consolidado_tabla[year][obs_key] = {
                "incidents": stats["incidents"],
                "affected_stations": len(stats["stations"]),
                "top_stations": worst
            }
            
    distribucion_campania = []
    for c, stats in camp_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * MANDATORY_COLS_COUNT
        distribucion_campania.append({
            "campania": c, "discontinuidades": rows_count,
            "celdas_afectadas": len(stats["celdas"]),
            "estructuras_afectadas": rows_count,
            "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    distribucion_geotecnico = []
    for g, stats in geo_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * MANDATORY_COLS_COUNT
        distribucion_geotecnico.append({
            "geotecnico": g, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    distribucion_sector = []
    for s, stats in sector_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * MANDATORY_COLS_COUNT
        distribucion_sector.append({
            "sector": s, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
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
            "total_metros": round(total_metros, 2)
        },
        "familia2": {
            "total_fields": total_fields, 
            "total_vacios": total_vacios, 
            "total_advertencias": total_advertencias, 
            "total_alertas": total_alertas, 
            "total_correctos": total_correctos
        },
        "familia3": {
            "total_discontinuidades": total_filas, 
            "discontinuidades_alertas": discs_con_alerta, 
            "discontinuidades_advertencias": discs_con_advertencia, 
            "discontinuidades_vacios": discs_con_vacio, 
            "discontinuidades_correctas": discs_correctas
        },
        "distribucion_campania": distribucion_campania,
        "distribucion_sector": distribucion_sector,
        "distribucion_geotecnico": distribucion_geotecnico,
        "top_5_alertas": top_5_alertas,
        "error_types_detailed": {"alertas": lista_alertas, "advertencias": lista_advertencias},
        "worst_cells": worst_cells,
        "top_column_errors": top_column_errors
    }

def generar_excel_reporte_core(diag: dict, compact: dict, filtered: list):
    font_title = Font(name="Segoe UI", size=16, bold=True, color="1B365D")
    font_subtitle = Font(name="Segoe UI", size=10, italic=True, color="555555")
    font_section = Font(name="Segoe UI", size=11, bold=True, color="1B365D")
    font_header = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    font_bold = Font(name="Segoe UI", size=10, bold=True, color="000000")
    font_regular = Font(name="Segoe UI", size=10, color="000000")
    font_kpi_lbl = Font(name="Segoe UI", size=9, bold=True, color="555555")
    
    font_kpi_val_blue = Font(name="Segoe UI", size=18, bold=True, color="1B365D")
    font_kpi_val_green = Font(name="Segoe UI", size=18, bold=True, color="375623")
    font_kpi_val_red = Font(name="Segoe UI", size=18, bold=True, color="C00000")
    font_kpi_val_orange = Font(name="Segoe UI", size=18, bold=True, color="C65911")

    fill_primary = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    fill_accent_green = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
    fill_accent_yellow = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
    fill_accent_orange = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
    fill_accent_red = PatternFill(start_color="F2DCDB", end_color="F2DCDB", fill_type="solid")
    fill_zebra = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
    fill_kpi_gray = PatternFill(start_color="F2F4F7", end_color="F2F4F7", fill_type="solid")

    border_thin = Border(
        left=Side(style='thin', color='E2E8F0'), 
        right=Side(style='thin', color='E2E8F0'), 
        top=Side(style='thin', color='E2E8F0'), 
        bottom=Side(style='thin', color='E2E8F0')
    )
    border_kpi = Border(
        left=Side(style='thin', color='B0C4DE'),
        right=Side(style='thin', color='B0C4DE'),
        top=Side(style='thin', color='B0C4DE'),
        bottom=Side(style='thin', color='B0C4DE')
    )

    alignment_center = Alignment(horizontal="center", vertical="center")
    alignment_left = Alignment(horizontal="left", vertical="center")
    alignment_right = Alignment(horizontal="right", vertical="center")

    wb = openpyxl.Workbook()
    
    def write_kpi_card_opt(ws, start_row, start_col, label, value, bg_fill, val_font):
        c1 = ws.cell(row=start_row, column=start_col, value=label)
        c1.font = font_kpi_lbl
        c1.alignment = alignment_center
        
        c2 = ws.cell(row=start_row+1, column=start_col, value=value)
        c2.font = val_font
        c2.alignment = alignment_center
        
        for r in range(start_row, start_row+2):
            for c in range(start_col, start_col+2):
                cell = ws.cell(row=r, column=c)
                cell.fill = bg_fill
                cell.border = border_kpi
                
        ws.merge_cells(start_row=start_row, start_column=start_col, end_row=start_row, end_column=start_col+1)
        ws.merge_cells(start_row=start_row+1, start_column=start_col, end_row=start_row+1, end_column=start_col+1)

    # --- HOJA 1: DASHBOARD EJECUTIVO ---
    ws_dash = wb.active
    ws_dash.title = "📊 Dashboard Ejecutivo"
    ws_dash.views.sheetView[0].showGridLines = True
    
    ws_dash.cell(row=2, column=2, value="SISTEMA DE AUDITORÍA GEOTÉCNICA").font = font_title
    ws_dash.cell(row=3, column=2, value="Dashboard de Control de Calidad y Consistencia de Mapeo Geomecánico").font = font_subtitle
    
    total_filas = compact.get("familia1", {}).get("total_discontinuidades", 0)
    total_fields = compact.get("familia2", {}).get("total_fields", 0)
    total_vacios = sum(1 for i in filtered if i.get("tipo_incidencia") == "VACIO")
    total_advertencias = sum(1 for i in filtered if i.get("tipo_incidencia") == "ADVERTENCIA")
    total_alertas = sum(1 for i in filtered if i.get("tipo_incidencia") == "ALERTA")
    total_correctos = total_fields - (total_vacios + total_advertencias + total_alertas)
    pct_integridad = (total_correctos / max(1, total_fields)) * 100

    write_kpi_card_opt(ws_dash, 5, 2, "ESTACIONES EVALUADAS", len(compact.get("resumen_por_celda_padre", {})), fill_kpi_gray, font_kpi_val_blue)
    write_kpi_card_opt(ws_dash, 5, 4, "ESTRUCTURAS REGISTRADAS", total_filas, fill_kpi_gray, font_kpi_val_blue)
    write_kpi_card_opt(ws_dash, 5, 6, "INTEGRIDAD GLOBAL", f"{pct_integridad:.2f}%", fill_accent_green, font_kpi_val_green)
    write_kpi_card_opt(ws_dash, 5, 8, "ALERTAS CRÍTICAS", total_alertas, fill_accent_red, font_kpi_val_red)
    write_kpi_card_opt(ws_dash, 5, 10, "ADVERTENCIAS", total_advertencias, fill_accent_orange, font_kpi_val_orange)

    # Tabla: Distribución por Campaña
    ws_dash.cell(row=9, column=2, value="DESEMPEÑO DE CONTROL POR CAMPAÑA").font = font_section
    headers_camp = ["Campaña", "Estructuras", "Celdas Afectadas", "Estructuras Afectadas", "Alertas (N)", "% Alertas", "Vacíos (N)", "% Vacíos"]
    for idx, col in enumerate(headers_camp, start=2):
        cell = ws_dash.cell(row=10, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    r_camp = 11
    for row in compact.get("distribucion_campania", []):
        ws_dash.cell(row=r_camp, column=2, value=row.get("campania")).font = font_bold
        ws_dash.cell(row=r_camp, column=2).alignment = alignment_center
        
        ws_dash.cell(row=r_camp, column=3, value=safe_int(row.get("discontinuidades"))).number_format = '#,##0'
        ws_dash.cell(row=r_camp, column=3).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=4, value=safe_int(row.get("celdas_afectadas"))).number_format = '#,##0'
        ws_dash.cell(row=r_camp, column=4).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=5, value=safe_int(row.get("estructuras_afectadas"))).number_format = '#,##0'
        ws_dash.cell(row=r_camp, column=5).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=6, value=safe_int(row.get("alertas_cant"))).number_format = '#,##0'
        ws_dash.cell(row=r_camp, column=6).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=7, value=safe_float(row.get("alertas_pct")) / 100.0).number_format = '0.00%'
        ws_dash.cell(row=r_camp, column=7).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=8, value=safe_int(row.get("vacios_cant"))).number_format = '#,##0'
        ws_dash.cell(row=r_camp, column=8).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=9, value=safe_float(row.get("vacios_pct")) / 100.0).number_format = '0.00%'
        ws_dash.cell(row=r_camp, column=9).alignment = alignment_right
        
        for col_idx in range(2, 10):
            ws_dash.cell(row=r_camp, column=col_idx).border = border_thin
            if r_camp % 2 == 0:
                ws_dash.cell(row=r_camp, column=col_idx).fill = fill_zebra
        r_camp += 1

    # Tabla: Distribución por Sectores
    r_sect = r_camp + 2
    ws_dash.cell(row=r_sect, column=2, value="DISTRIBUCIÓN POR SECTOR GEOTÉCNICO").font = font_section
    
    r_sect += 1
    headers_sect = ["Sector", "Estructuras", "Alertas (N)", "% Alertas", "Vacíos (N)", "% Vacíos"]
    for idx, col in enumerate(headers_sect, start=2):
        cell = ws_dash.cell(row=r_sect, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    for row in compact.get("distribucion_sector", []):
        r_sect += 1
        ws_dash.cell(row=r_sect, column=2, value=row.get("sector")).font = font_bold
        ws_dash.cell(row=r_sect, column=2).alignment = alignment_center
        
        ws_dash.cell(row=r_sect, column=3, value=safe_int(row.get("discontinuidades"))).number_format = '#,##0'
        ws_dash.cell(row=r_sect, column=3).alignment = alignment_right
        
        ws_dash.cell(row=r_sect, column=4, value=safe_int(row.get("alertas_cant"))).number_format = '#,##0'
        ws_dash.cell(row=r_sect, column=4).alignment = alignment_right
        
        ws_dash.cell(row=r_sect, column=5, value=safe_float(row.get("alertas_pct")) / 100.0).number_format = '0.00%'
        ws_dash.cell(row=r_sect, column=5).alignment = alignment_right
        
        ws_dash.cell(row=r_sect, column=6, value=safe_int(row.get("vacios_cant"))).number_format = '#,##0'
        ws_dash.cell(row=r_sect, column=6).alignment = alignment_right
        
        ws_dash.cell(row=r_sect, column=7, value=safe_float(row.get("vacios_pct")) / 100.0).number_format = '0.00%'
        ws_dash.cell(row=r_sect, column=7).alignment = alignment_right
        
        for col_idx in range(2, 8):
            ws_dash.cell(row=r_sect, column=col_idx).border = border_thin
            if r_sect % 2 == 0:
                ws_dash.cell(row=r_sect, column=col_idx).fill = fill_zebra
        r_sect += 1

    # Tabla: Distribución de Celdas más Afectadas
    r_worst = r_sect + 2
    ws_dash.cell(row=r_worst-1, column=2, value="TOP 5 ESTACIONES CON MAYOR INCIDENCIA").font = font_section
    headers_worst = ["Estación (Celda)", "Total Estructuras", "Vacíos", "Advertencias", "Alertas", "Calificación"]
    for idx, col in enumerate(headers_worst, start=2):
        cell = ws_dash.cell(row=r_worst, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    for row in compact.get("worst_cells", [])[:5]:
        r_worst += 1
        ws_dash.cell(row=r_worst, column=2, value=row.get("celda")).font = font_bold
        ws_dash.cell(row=r_worst, column=2).alignment = alignment_center
        
        ws_dash.cell(row=r_worst, column=3, value=safe_int(row.get("total_hijas"))).number_format = '#,##0'
        ws_dash.cell(row=r_worst, column=3).alignment = alignment_right
        
        ws_dash.cell(row=r_worst, column=4, value=safe_int(row.get("vacios"))).number_format = '#,##0'
        ws_dash.cell(row=r_worst, column=4).alignment = alignment_right
        
        ws_dash.cell(row=r_worst, column=5, value=safe_int(row.get("advertencias"))).number_format = '#,##0'
        ws_dash.cell(row=r_worst, column=5).alignment = alignment_right
        
        ws_dash.cell(row=r_worst, column=6, value=safe_int(row.get("alertas"))).number_format = '#,##0'
        ws_dash.cell(row=r_worst, column=6).alignment = alignment_right
        
        status = row.get("estado_celda", "OK")
        status_cell = ws_dash.cell(row=r_worst, column=7, value=status)
        status_cell.font = font_bold
        status_cell.alignment = alignment_center
        if status == "ALERTA": status_cell.fill = fill_accent_red
        elif status == "ADVERTENCIA": status_cell.fill = fill_accent_orange
        else: status_cell.fill = fill_accent_green
        
        for col_idx in range(2, 8):
            ws_dash.cell(row=r_worst, column=col_idx).border = border_thin
            if r_worst % 2 == 0:
                ws_dash.cell(row=r_worst, column=col_idx).fill = fill_zebra

    # Tabla para Gráfica Directa: Top 5 Alertas Críticas
    ws_dash.cell(row=9, column=9, value="PRINCIPALES DESVIACIONES CRÍTICAS").font = font_section
    headers_graph = ["Error Geotécnico", "Frecuencia"]
    for idx, col in enumerate(headers_graph, start=9):
        cell = ws_dash.cell(row=10, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    top_errs_list = Counter(get_incidence_category_name(i) for i in filtered if i.get("tipo_incidencia") == "ALERTA").most_common(5)
    r_graph = 11
    for msg, qty in top_errs_list:
        ws_dash.cell(row=r_graph, column=9, value=msg).font = font_regular
        ws_dash.cell(row=r_graph, column=9).border = border_thin
        
        c_qty = ws_dash.cell(row=r_graph, column=10, value=qty)
        c_qty.font = font_bold
        c_qty.alignment = alignment_right
        c_qty.number_format = '#,##0'
        c_qty.border = border_thin
        c_qty.fill = fill_accent_red
        
        r_graph += 1
        
    for dummy in range(r_graph, 16):
        ws_dash.cell(row=dummy, column=9, value="—").font = font_regular
        ws_dash.cell(row=dummy, column=9).border = border_thin
        ws_dash.cell(row=dummy, column=10, value=0).font = font_regular
        ws_dash.cell(row=dummy, column=10).border = border_thin
        ws_dash.cell(row=dummy, column=10).number_format = '#,##0'

    # Gráfica Nativa de Excel
    chart = BarChart()
    chart.type = "col"
    chart.style = 10
    chart.title = "Frecuencia de Desviaciones Críticas Detectadas"
    chart.y_axis.title = "Cantidad de Ocurrencias"
    chart.x_axis.title = "Regla de Consistencia"
    
    chart_data = Reference(ws_dash, min_col=10, min_row=10, max_row=15)
    chart_cats = Reference(ws_dash, min_col=9, min_row=11, max_row=15)
    chart.add_data(chart_data, titles_from_data=True)
    chart.set_categories(chart_cats)
    chart.legend = None
    chart.width = 15
    chart.height = 11
    ws_dash.add_chart(chart, "I17")

    # --- HOJA 2: REGISTRO MAESTRO DE ERRORES (CATÁLOGO / ÍNDICE) ---
    ws_cat = wb.create_sheet(title="❌ Catálogo de Errores")
    ws_cat.views.sheetView[0].showGridLines = True
    
    ws_cat.cell(row=2, column=2, value="REGISTRO MAESTRO DE REGLAS DE CONSISTENCIA").font = font_title
    ws_cat.cell(row=3, column=2, value="Catálogo completo de validación geomecánica ordenado por frecuencia. Use los hipervínculos para navegar.").font = font_subtitle
    
    headers_cat = ["ID", "Gravedad", "Regla de Consistencia Evaluada", "Casos Hallados (N)", "Enlace Directo"]
    for idx, col in enumerate(headers_cat, start=2):
        cell = ws_cat.cell(row=5, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    incidencias_por_error = defaultdict(list)
    for inc in filtered:
        msg_simplificado = get_incidence_category_name(inc)
        incidencias_por_error[msg_simplificado].append(inc)

    catalog_frequencies = []
    for cat in CATEGORIES_REGISTRY.values():
        rule_msg = cat.name
        matches = incidencias_por_error[rule_msg]
        catalog_frequencies.append({
            "msg": rule_msg,
            "severity": cat.severity,
            "matches": matches,
            "count": len(matches)
        })
        
    catalog_frequencies = sorted(catalog_frequencies, key=lambda x: x["count"], reverse=True)

    r_cat = 6
    active_sheets_mapping = {}
    
    for c_idx, rule in enumerate(catalog_frequencies, start=1):
        ws_cat.cell(row=r_cat, column=2, value=c_idx).font = font_regular
        ws_cat.cell(row=r_cat, column=2).alignment = alignment_center
        ws_cat.cell(row=r_cat, column=2).border = border_thin
        
        c_sev = ws_cat.cell(row=r_cat, column=3, value=rule["severity"])
        c_sev.font = font_bold
        c_sev.alignment = alignment_center
        c_sev.border = border_thin
        if rule["severity"] == "ALERTA": c_sev.fill = fill_accent_red
        elif rule["severity"] == "ADVERTENCIA": c_sev.fill = fill_accent_orange
        else: c_sev.fill = fill_accent_yellow
        
        ws_cat.cell(row=r_cat, column=4, value=rule["msg"]).font = font_bold if rule["count"] > 0 else font_regular
        ws_cat.cell(row=r_cat, column=4).border = border_thin
        
        c_count = ws_cat.cell(row=r_cat, column=5, value=rule["count"])
        c_count.font = font_bold
        c_count.alignment = alignment_right
        c_count.number_format = '#,##0'
        c_count.border = border_thin
        
        c_link = ws_cat.cell(row=r_cat, column=6)
        if rule["count"] > 0:
            tab_name = get_safe_sheet_name(rule["msg"], c_idx)
            active_sheets_mapping[rule["msg"]] = {"tab_name": tab_name, "records": rule["matches"]}
            
            c_link.value = f'=HYPERLINK("#\'{tab_name}\'!B2", "🔍 Navegar a Registros")'
            c_link.font = Font(name="Segoe UI", size=10, bold=True, color="1B365D", underline="single")
            c_link.alignment = alignment_center
        else:
            c_link.value = "Limpio / 0 Inidencias"
            c_link.font = Font(name="Segoe UI", size=9, italic=True, color="7F8C8D")
            c_link.alignment = alignment_center
            c_link.fill = fill_accent_green
            
        c_link.border = border_thin
        r_cat += 1

    # --- HOJA 3: DETALLE PLANO COMPLETO DE INCIDENCIAS ---
    ws_detail = wb.create_sheet(title="📋 Detalle de Incidencias")
    ws_detail.views.sheetView[0].showGridLines = True
    
    ws_detail.cell(row=2, column=2, value="DETALLE COMPLETO DE INCIDENCIAS").font = font_title
    ws_detail.cell(row=3, column=2, value="Listado plano consolidado de todas las desviaciones y vacíos detectados. Muestra las variables geomecánicas precisas que intervinieron en la inconsistencia.").font = font_subtitle
    
    headers_detail = [
        "Fila Excel", "Gravedad", "Estación Padre", "Estructura Hija", "Campaña", 
        "Logger Geotécnico", "Sector Geotécnico", "Tipo de Mapeo", "Columna de Falla", 
        "Valor Actual", "Mensaje de Inconsistencia Geomecánica"
    ]
    
    ws_detail.append([]) 
    ws_detail.append([None] + headers_detail) 
    grid_heading_row = ws_detail.max_row
    
    for idx in range(2, 13):
        cell = ws_detail.cell(row=grid_heading_row, column=idx)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin
        
    start_detail_row = ws_detail.max_row + 1
    for inc_item in filtered:
        row_data = [
            None,
            safe_int(inc_item.get("fila_excel")),
            inc_item.get("tipo_incidencia", "ALERTA"),
            inc_item.get("celda_padre"),
            inc_item.get("celda_hija"),
            inc_item.get("campania"),
            inc_item.get("geotecnico"),
            inc_item.get("sector_geotecnico"),
            inc_item.get("tipo_mapeo", "Mapeo de Celdas"),
            inc_item.get("columna"),
            inc_item.get("valor_actual") if inc_item.get("valor_actual") is not None else "—",
            inc_item.get("mensaje")
        ]
        ws_detail.append(row_data)
        
    end_detail_row = ws_detail.max_row
    
    for r_idx in range(start_detail_row, end_detail_row + 1):
        if r_idx <= start_detail_row + 150:
            ws_detail.cell(row=r_idx, column=2).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=3).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=4).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=5).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=6).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=7).alignment = alignment_left
            ws_detail.cell(row=r_idx, column=8).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=9).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=10).alignment = alignment_left
            ws_detail.cell(row=r_idx, column=11).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=12).alignment = alignment_left
            
            if r_idx % 2 == 0:
                for col_idx in range(2, 13):
                    if col_idx != 3:
                        ws_detail.cell(row=r_idx, column=col_idx).fill = fill_zebra
        else:
            ws_detail.cell(row=r_idx, column=2).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=3).alignment = alignment_center
            
        cell_sev = ws_detail.cell(row=r_idx, column=3)
        sev = cell_sev.value
        if sev == "ALERTA": cell_sev.fill = fill_accent_red
        elif sev == "ADVERTENCIA": cell_sev.fill = fill_accent_orange
        else: cell_sev.fill = fill_accent_yellow
        cell_sev.font = font_bold
        
        for col_idx in range(2, 13):
            ws_detail.cell(row=r_idx, column=col_idx).border = border_thin
            
    ws_detail.auto_filter.ref = f"B{grid_heading_row}:L{end_detail_row}"

    # --- HOJAS 4+: DETALLES INDIVIDUALES POR REGLA DE ERROR ---
    for orig_msg, mapping_data in active_sheets_mapping.items():
        sh_name = mapping_data["tab_name"]
        err_records = mapping_data["records"]
        
        ws_err = wb.create_sheet(title=sh_name)
        ws_err.views.sheetView[0].showGridLines = True
        
        c_back = ws_err.cell(row=2, column=2)
        c_back.value = '=HYPERLINK("#\'❌ Catálogo de Errores\'!B2", "⬅ Volver al Registro Maestro de Errores")'
        c_back.font = Font(name="Segoe UI", size=10, bold=True, color="1B365D", underline="single")
        c_back.alignment = alignment_left
        
        ws_err.cell(row=4, column=2, value="ANÁLISIS DE INCIDENCIA EN BASE DE DATOS").font = font_section
        cell_err_desc = ws_err.cell(row=5, column=2, value=f"Regla: {orig_msg.upper()}")
        cell_err_desc.font = Font(name="Segoe UI", size=11, bold=True, color="7F1D1D")
        cell_err_desc.fill = fill_accent_red
        cell_err_desc.border = border_thin
        ws_err.merge_cells(start_row=5, start_column=2, end_row=5, end_column=7)
        
        st_affected = len(set(x.get("celda_padre", "N/A") for x in err_records))
        tot_affected = len(err_records)
        
        write_kpi_card_opt(ws_err, 7, 2, "ESTACIONES AFECTADAS (CELDA PADRE)", st_affected, fill_kpi_gray, font_kpi_val_blue)
        write_kpi_card_opt(ws_err, 7, 4, "ESTRUCTURAS AFECTADAS (CANTIDAD)", tot_affected, fill_kpi_gray, font_kpi_val_blue)
        
        # Distribución por Campaña
        ws_err.cell(row=10, column=2, value="DISTRIBUCIÓN POR CAMPAÑA").font = font_section
        for idx, col in enumerate(["Campaña / Año", "Ocurrencias (N)", "% Contribución"], start=2):
            cell = ws_err.cell(row=11, column=idx, value=col)
            cell.font = font_header
            cell.fill = fill_primary
            cell.alignment = alignment_center
            cell.border = border_thin
            
        r_dist_yr = defaultdict(int)
        for r in err_records:
            r_dist_yr[str(r.get("campania", "N/A"))] += 1
            
        curr_y_r = 12
        for yr, y_qty in sorted(r_dist_yr.items()):
            ws_err.cell(row=curr_y_r, column=2, value=yr).font = font_bold
            ws_err.cell(row=curr_y_r, column=2).alignment = alignment_center
            ws_err.cell(row=curr_y_r, column=2).border = border_thin
            
            c_yq = ws_err.cell(row=curr_y_r, column=3, value=y_qty)
            c_yq.font = font_regular
            c_yq.alignment = alignment_right
            c_yq.number_format = '#,##0'
            c_yq.border = border_thin
            
            c_yp = ws_err.cell(row=curr_y_r, column=4, value=y_qty / max(1, tot_affected))
            c_yp.font = font_regular
            c_yp.alignment = alignment_right
            c_yp.number_format = '0.00%'
            c_yp.border = border_thin
            
            curr_y_r += 1

        unique_years = sorted(list(set(str(r.get("campania", "N/A")) for r in err_records)))
        rule_group = defaultdict(list)
        for r in err_records:
            rule_group[r.get("rule_code", "Desconocido")].append(r)
            
        rule_stats = []
        for rule_code, recs in rule_group.items():
            yr_counts = defaultdict(int)
            for r in recs:
                yr_counts[str(r.get("campania", "N/A"))] += 1
            rule_stats.append({
                "rule_code": rule_code,
                "total": len(recs),
                "yr_counts": yr_counts
            })
        rule_stats.sort(key=lambda x: x["total"], reverse=True)
        
        # 2. Agrupar por Mensaje Único (Tabla B)
        msg_group = defaultdict(list)
        for r in err_records:
            msg_group[r.get("mensaje", "Desconocido")].append(r)
            
        msg_stats = []
        for msg_val, recs in msg_group.items():
            yr_counts = defaultdict(int)
            for r in recs:
                yr_counts[str(r.get("campania", "N/A"))] += 1
            msg_stats.append({
                "message": msg_val,
                "total": len(recs),
                "yr_counts": yr_counts
            })
        msg_stats.sort(key=lambda x: x["total"], reverse=True)

        # Precalcular coordenadas de las secciones para los hipervínculos de navegación
        dist_table_height = len(r_dist_yr)
        jump_link_row = 12 + dist_table_height + 1
        
        table_a_start = jump_link_row + 2
        table_a_height = 2 + len(rule_stats)
        
        indiv_start = table_a_start + table_a_height + 2
        indiv_height = 2 + len(err_records)
        
        table_b_start = indiv_start + indiv_height + 2

        # --- ENLACE DIRECTO DE NAVEGACIÓN RÁPIDA ---
        c_jump = ws_err.cell(row=jump_link_row, column=2)
        c_jump.value = f'=HYPERLINK("#\'{sh_name}\'!B{table_b_start}", "🔍 Ir a Métricas de Mensajes de Inconsistencia Únicos (al final de la hoja)")'
        c_jump.font = Font(name="Segoe UI", size=10, bold=True, color="1B365D", underline="single")
        c_jump.alignment = alignment_left

        # --- TABLA A: RESUMEN POR REGLA ESPECÍFICA ---
        ws_err.cell(row=table_a_start, column=2, value="MÉTRICAS POR REGLA ESPECÍFICA (CÓDIGO)").font = font_section
        
        ws_err.cell(row=table_a_start + 1, column=2, value="Código de Regla").font = font_header
        ws_err.cell(row=table_a_start + 1, column=2).fill = fill_primary
        ws_err.cell(row=table_a_start + 1, column=2).alignment = alignment_center
        
        ws_err.merge_cells(start_row=table_a_start + 1, start_column=2, end_row=table_a_start + 1, end_column=4)
        for c_idx in [3, 4]:
            ws_err.cell(row=table_a_start + 1, column=c_idx).fill = fill_primary
            
        headers_a = ["Ocurrencias Totales"] + [f"Año {y}" if y != "N/A" else "N/A" for y in unique_years]
        for col_offset, h_name in enumerate(headers_a, start=5):
            cell = ws_err.cell(row=table_a_start + 1, column=col_offset, value=h_name)
            cell.font = font_header
            cell.fill = fill_primary
            cell.alignment = alignment_center
            
        for col_idx in range(2, 5 + len(unique_years) + 1):
            ws_err.cell(row=table_a_start + 1, column=col_idx).border = border_thin
            
        for idx, stat in enumerate(rule_stats):
            r_row = table_a_start + 2 + idx
            ws_err.cell(row=r_row, column=2, value=stat["rule_code"]).font = font_bold
            ws_err.cell(row=r_row, column=2).alignment = alignment_center
            ws_err.merge_cells(start_row=r_row, start_column=2, end_row=r_row, end_column=4)
            
            c_tot = ws_err.cell(row=r_row, column=5, value=stat["total"])
            c_tot.font = font_bold
            c_tot.alignment = alignment_right
            c_tot.number_format = '#,##0'
            
            for y_idx, yr in enumerate(unique_years):
                val = stat["yr_counts"].get(yr, 0)
                c_val = ws_err.cell(row=r_row, column=6 + y_idx, value=val)
                c_val.font = font_regular
                c_val.alignment = alignment_right
                c_val.number_format = '#,##0'
                
            for col_idx in range(2, 5 + len(unique_years) + 1):
                cell = ws_err.cell(row=r_row, column=col_idx)
                cell.border = border_thin
                if r_row % 2 == 0:
                    cell.fill = fill_zebra

        # --- LISTADO DETALLADO INDIVIDUAL DE INCIDENCIAS (CON COLUMNA 4 SWAP) ---
        ws_err.cell(row=indiv_start, column=2, value="REGISTROS INDIVIDUALES AFECTADOS (LISTADO COMPLETO)").font = font_section
        
        headers_inc = [
            "Fila Excel", "Estación Padre", "Estructura Hija", "Tipo de Mapeo", "Campaña", 
            "Logger Geotécnico", "Sector Geotécnico", "Columna de Falla", 
            "Valor Actual", "Mensaje de Inconsistencia Geomecánica"
        ]
        header_row_idx = indiv_start + 1
        for col_idx, h_name in enumerate(headers_inc, start=2):
            cell = ws_err.cell(row=header_row_idx, column=col_idx, value=h_name)
            cell.font = font_header
            cell.fill = fill_primary
            cell.alignment = alignment_center
            cell.border = border_thin
            
        start_data_row = indiv_start + 2
        for idx, inc_item in enumerate(err_records):
            curr_row = start_data_row + idx
            ws_err.cell(row=curr_row, column=2, value=safe_int(inc_item.get("fila_excel")))
            ws_err.cell(row=curr_row, column=3, value=inc_item.get("celda_padre"))
            ws_err.cell(row=curr_row, column=4, value=inc_item.get("celda_hija"))
            ws_err.cell(row=curr_row, column=5, value=inc_item.get("tipo_mapeo", "Mapeo de Celdas"))
            ws_err.cell(row=curr_row, column=6, value=inc_item.get("campania"))
            ws_err.cell(row=curr_row, column=7, value=inc_item.get("geotecnico"))
            ws_err.cell(row=curr_row, column=8, value=inc_item.get("sector_geotecnico"))
            ws_err.cell(row=curr_row, column=9, value=inc_item.get("columna"))
            ws_err.cell(row=curr_row, column=10, value=inc_item.get("valor_actual") if inc_item.get("valor_actual") is not None else "—")
            ws_err.cell(row=curr_row, column=11, value=inc_item.get("mensaje"))
            
        end_data_row = start_data_row + len(err_records) - 1
        
        for r_idx in range(start_data_row, end_data_row + 1):
            if r_idx <= start_data_row + 150:
                ws_err.cell(row=r_idx, column=2).alignment = alignment_center
                ws_err.cell(row=r_idx, column=3).alignment = alignment_center
                ws_err.cell(row=r_idx, column=4).alignment = alignment_center
                ws_err.cell(row=r_idx, column=5).alignment = alignment_center
                ws_err.cell(row=r_idx, column=6).alignment = alignment_center
                ws_err.cell(row=r_idx, column=7).alignment = alignment_left
                ws_err.cell(row=r_idx, column=8).alignment = alignment_center
                ws_err.cell(row=r_idx, column=9).alignment = alignment_left
                ws_err.cell(row=r_idx, column=10).alignment = alignment_center
                ws_err.cell(row=r_idx, column=11).alignment = alignment_left
                
                if r_idx % 2 == 0:
                    for col_idx in range(2, 12):
                        ws_err.cell(row=r_idx, column=col_idx).fill = fill_zebra
            else:
                ws_err.cell(row=r_idx, column=2).alignment = alignment_center
                ws_err.cell(row=r_idx, column=3).alignment = alignment_center
                
            for col_idx in range(2, 12):
                ws_err.cell(row=r_idx, column=col_idx).border = border_thin
                
        ws_err.auto_filter.ref = f"B{header_row_idx}:K{end_data_row}"

        # --- TABLA B: RESUMEN POR MENSAJE DE INCONSISTENCIA ÚNICO ---
        ws_err.cell(row=table_b_start, column=2, value="MÉTRICAS POR MENSAJE DE INCONSISTENCIA GEOMECÁNICA ÚNICO").font = font_section
        
        c_ret = ws_err.cell(row=table_b_start, column=5)
        c_ret.value = f'=HYPERLINK("#\'{sh_name}\'!B2", "⬅ Volver al Inicio de la Hoja")'
        c_ret.font = Font(name="Segoe UI", size=10, bold=True, color="1B365D", underline="single")
        c_ret.alignment = alignment_left

        ws_err.cell(row=table_b_start + 1, column=2, value="Mensaje de Inconsistencia Geomecánica Único").font = font_header
        ws_err.cell(row=table_b_start + 1, column=2).fill = fill_primary
        ws_err.cell(row=table_b_start + 1, column=2).alignment = alignment_center
        
        ws_err.merge_cells(start_row=table_b_start + 1, start_column=2, end_row=table_b_start + 1, end_column=7)
        for c_idx in range(3, 8):
            ws_err.cell(row=table_b_start + 1, column=c_idx).fill = fill_primary
            
        headers_b = ["Ocurrencias Totales"] + [f"Año {y}" if y != "N/A" else "N/A" for y in unique_years]
        for col_offset, h_name in enumerate(headers_b, start=8):
            cell = ws_err.cell(row=table_b_start + 1, column=col_offset, value=h_name)
            cell.font = font_header
            cell.fill = fill_primary
            cell.alignment = alignment_center
            
        for col_idx in range(2, 8 + len(unique_years) + 1):
            ws_err.cell(row=table_b_start + 1, column=col_idx).border = border_thin
            
        for idx, stat in enumerate(msg_stats):
            r_row = table_b_start + 2 + idx
            ws_err.cell(row=r_row, column=2, value=stat["message"]).font = font_regular
            ws_err.cell(row=r_row, column=2).alignment = alignment_left
            ws_err.merge_cells(start_row=r_row, start_column=2, end_row=r_row, end_column=7)
            
            c_tot = ws_err.cell(row=r_row, column=8, value=stat["total"])
            c_tot.font = font_bold
            c_tot.alignment = alignment_right
            c_tot.number_format = '#,##0'
            
            for y_idx, yr in enumerate(unique_years):
                val = stat["yr_counts"].get(yr, 0)
                c_val = ws_err.cell(row=r_row, column=9 + y_idx, value=val)
                c_val.font = font_regular
                c_val.alignment = alignment_right
                c_val.number_format = '#,##0'
                
            for col_idx in range(2, 8 + len(unique_years) + 1):
                cell = ws_err.cell(row=r_row, column=col_idx)
                cell.border = border_thin
                if r_row % 2 == 0:
                    cell.fill = fill_zebra

    # --- AUTO-AJUSTE DINÁMICO DE COLUMNAS ---
    for ws in wb.worksheets:
        ws.column_dimensions['A'].width = 3
        if ws.title not in ["❌ Catálogo de Errores", "📋 Detalle de Incidencias", "📊 Panel de Control"]:
            # Hojas de error con anchos específicos optimizados
            ws.column_dimensions['B'].width = 11  # Fila Excel
            ws.column_dimensions['C'].width = 14  # Estación Padre
            ws.column_dimensions['D'].width = 14  # Estructura Hija
            ws.column_dimensions['E'].width = 20  # Tipo de Mapeo
            ws.column_dimensions['F'].width = 9   # Campaña
            ws.column_dimensions['G'].width = 16  # Logger Geotécnico
            ws.column_dimensions['H'].width = 16  # Sector Geotécnico
            ws.column_dimensions['I'].width = 24  # Columna de Falla
            ws.column_dimensions['J'].width = 12  # Valor Actual
            ws.column_dimensions['K'].width = 60  # Mensaje de Inconsistencia
        else:
            for col_idx in range(2, ws.max_column + 1):
                vals = []
                for row_idx in range(1, min(15, ws.max_row + 1)):
                    val = ws.cell(row=row_idx, column=col_idx).value
                    if val is not None:
                        val_str = str(val)
                        if val_str.startswith("=HYPERLINK"):
                            vals.append("Ver Registros")
                        else:
                            vals.append(val_str)
                if not vals: continue
                max_len = max(len(v) for v in vals)
                col_letter = get_column_letter(col_idx)
                ws.column_dimensions[col_letter].width = min(max(max_len + 4, 11), 52)

    return wb

def run_bulk_pipeline_with_id(file_path: str, audit_id: str, original_filename: str = None):
    t_start = time.time()
    print(f"\n======================================================================")
    print(f"[*] [AUDITORÍA {audit_id}] INICIANDO PIPELINE DE PROCESAMIENTO ASÍNCRONO")
    print(f"[*] Archivo cargado: {os.path.basename(file_path)}")
    print(f"======================================================================")
    
    history_dir = os.path.join(uploads_dir, "history")
    os.makedirs(history_dir, exist_ok=True)
    raw_json_out = os.path.join(history_dir, f"{audit_id}_diagnostico.json")
    compact_json_out = os.path.join(history_dir, f"{audit_id}_compact.json")
    excel_pregenerated_out = os.path.join(history_dir, f"{audit_id}_reporte_completo.xlsx")
    
    try:
        # Paso 1: Ejecutar la validación masiva en validator.py
        print(f"[*] [AUDITORÍA {audit_id}] Paso 1/5: Ejecutando motor de validación QA/QC geomecánica...")
        validate_bulk_excel(file_path, raw_json_out)
        
        # Paso 2: Copiar al diagnóstico público estático
        print(f"[*] [AUDITORÍA {audit_id}] Paso 2/5: Publicando diagnóstico en caché pública...")
        shutil.copyfile(raw_json_out, os.path.join(uploads_dir, "diagnostico_geomecanico.json"))
        
        # Paso 3: Cargar resultados y compactar métricas para la UI mediante la función unificada
        print(f"[*] [AUDITORÍA {audit_id}] Paso 3/5: Compilando métricas compactas para Dashboard...")
        with open(raw_json_out, "r", encoding="utf-8") as f:
            diag = json.load(f)
            
        diag["nombre_archivo"] = original_filename or os.path.basename(file_path)
        compact = aggregate_audit_metrics(diag)
        compact["audit_id"] = audit_id
        
        print(f"[*] [AUDITORÍA {audit_id}] Paso 4/5: Escribiendo JSON de resumen ligero...")
        compact_json_tmp = compact_json_out + ".tmp"
        with open(compact_json_tmp, "w", encoding="utf-8") as f:
            json.dump(compact, f, ensure_ascii=False)
        safe_replace(compact_json_tmp, compact_json_out)
        
        public_compact = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
        public_compact_tmp = public_compact + ".tmp"
        shutil.copyfile(compact_json_out, public_compact_tmp)
        safe_replace(public_compact_tmp, public_compact)

        # Paso 4: Generar archivo Excel cacheado
        print(f"[*] [AUDITORÍA {audit_id}] Paso 5/5: Pre-generando reporte de Excel (.xlsx) en segundo plano...")
        wb = generar_excel_reporte_core(diag, compact, list(diag.get("incidencias", [])))
        
        excel_tmp = excel_pregenerated_out + ".tmp"
        wb.save(excel_tmp)
        safe_replace(excel_tmp, excel_pregenerated_out)
        
        public_excel = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")
        public_excel_tmp = public_excel + ".tmp"
        shutil.copyfile(excel_pregenerated_out, public_excel_tmp)
        safe_replace(public_excel_tmp, public_excel)
        
        elapsed = time.time() - t_start
        print(f"======================================================================")
        print(f"[+] [AUDITORÍA {audit_id}] PIPELINE COMPLETADO EXITOSAMENTE")
        print(f"[*] Tiempo total: {elapsed:.2f} segundos")
        print(f"======================================================================\n")

    except Exception as e:
        elapsed = time.time() - t_start
        print(f"\n======================================================================")
        print(f"[-] [AUDITORÍA {audit_id}] PIPELINE ABORTADO POR ERROR CRÍTICO")
        print(f"[-] Detalle del error: {str(e)}")
        print(f"[-] Tiempo ejecutado antes del fallo: {elapsed:.2f} segundos")
        print(f"======================================================================")
        traceback.print_exc()
        
        error_data = {
            "audit_id": audit_id,
            "status": "error",
            "fecha_auditoria": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "nombre_archivo": os.path.basename(file_path),
            "error_message": str(e),
            "familia1": {"total_discontinuidades": 0},
            "familia2": {"total_vacios": 0, "total_advertencias": 0, "total_alertas": 0}
        }
        try:
            with open(compact_json_out, "w", encoding="utf-8") as f:
                json.dump(error_data, f, ensure_ascii=False)
            shutil.copyfile(compact_json_out, os.path.join(uploads_dir, "resumen_geomecanico_ligero.json"))
        except Exception as write_err:
            print(f"[-] Error al guardar JSON de contingencia para error de auditoría: {write_err}")

@router.post("/geomecanica/importar-excel-bulk")
async def importar_excel_bulk(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Formato no soportado.")
    audit_id = f"audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    history_dir = os.path.join(uploads_dir, "history")
    os.makedirs(history_dir, exist_ok=True)
    file_path = os.path.join(history_dir, f"{audit_id}.xlsx")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    background_tasks.add_task(run_bulk_pipeline_with_id, file_path, audit_id, file.filename)
    return {"status": "procesando", "audit_id": audit_id, "filename": file.filename}

@router.get("/geomecanica/auditorias")
def listar_auditorias():
    history_dir = os.path.join(uploads_dir, "history")
    if not os.path.exists(history_dir): return []
    audits = []
    for f in os.listdir(history_dir):
        if f.endswith("_compact.json"):
            audit_id = f.replace("_compact.json", "")
            compact_file = os.path.join(history_dir, f)
            try:
                with open(compact_file, "r", encoding="utf-8") as file_content:
                    meta = json.load(file_content)
                    audits.append({
                        "audit_id": audit_id, "fecha": meta.get("fecha_auditoria", "Desconocida"),
                        "archivo": meta.get("nombre_archivo", "Desconocido.xlsx"),
                        "total_filas": meta.get("familia1", {}).get("total_discontinuidades", 0),
                        "total_vacios": meta.get("familia2", {}).get("total_vacios", 0),
                        "total_advertencias": meta.get("familia2", {}).get("total_advertencias", 0),
                        "total_alertas": meta.get("familia2", {}).get("total_alertas", 0)
                    })
            except: pass
    return sorted(audits, key=lambda x: x["fecha"], reverse=True)

@router.get("/geomecanica/resumen-ligero")
def obtener_resumen_ligero(audit_id: str = None, years: str = None):
    # 1. Resolver rutas de archivos correspondientes
    if audit_id:
        raw_file = os.path.join(uploads_dir, "history", f"{audit_id}_diagnostico.json")
        compact_file = os.path.join(uploads_dir, "history", f"{audit_id}_compact.json")
        excel_file = os.path.join(uploads_dir, "history", f"{audit_id}.xlsx")
        
        if not os.path.exists(compact_file) or not os.path.exists(raw_file):
            if os.path.exists(excel_file):
                return JSONResponse(
                    status_code=202, 
                    content={"status": "procesando", "message": "Procesando base de datos masiva y cruzando variables..."}
                )
            raise HTTPException(status_code=404, detail="La auditoría solicitada no existe en el servidor.")
    else:
        raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
        compact_file = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
        if not os.path.exists(raw_file) or not os.path.exists(compact_file):
            history_dir = os.path.join(uploads_dir, "history")
            if os.path.exists(history_dir):
                jsons = [f for f in os.listdir(history_dir) if f.endswith("_diagnostico.json") and not f.endswith(".tmp")]
                if jsons:
                    jsons.sort(key=lambda x: os.path.getmtime(os.path.join(history_dir, x)), reverse=True)
                    latest_id = jsons[0].replace("_diagnostico.json", "")
                    raw_file = os.path.join(history_dir, f"{latest_id}_diagnostico.json")
                    compact_file = os.path.join(history_dir, f"{latest_id}_compact.json")
            
            if not os.path.exists(raw_file) or not os.path.exists(compact_file):
                return JSONResponse(
                    status_code=202, 
                    content={"status": "procesando", "message": "Esperando inicialización de datos de auditoría..."}
                )

    # 2. FAST PATH: Cargar el reporte compacto directamente si no hay filtros aplicados
    if (not years or years == "TODOS" or years == "") and os.path.exists(compact_file):
        try:
            with open(compact_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass # Si falla la lectura, se cae en el cálculo bajo demanda inferior

    # 3. BAJO DEMANDA / FILTRADO: Procesar dinámicamente si se especificaron años o falla la caché
    with open(raw_file, "r", encoding="utf-8") as f:
        diag = json.load(f)
        
    diag["nombre_archivo"] = os.path.basename(raw_file)
    compact = aggregate_audit_metrics(diag, years_filter=years)
    compact["audit_id"] = audit_id or "default"
    
    return compact

@router.get("/geomecanica/incidencias-paginadas")
def obtener_incidencias_paginadas(
    page: int = 1, limit: int = 50, tipo: str = None, celda: str = None, columna: str = None,
    campania: str = None, geotecnico: str = None, sector_geotecnico: str = None, search: str = None, audit_id: str = None
):
    if audit_id: 
        raw_file = os.path.join(uploads_dir, "history", f"{audit_id}_diagnostico.json")
        if not os.path.exists(raw_file):
            return {"data": [], "page": 1, "total_pages": 1, "total_records": 0}
    else: 
        raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
        
    if not os.path.exists(raw_file): 
        return {"data": [], "page": 1, "total_pages": 1, "total_records": 0}
        
    with open(raw_file, "r", encoding="utf-8") as f:
        diag_data = json.load(f)
        
    incidencias = diag_data.get("incidencias", [])
    filtered = incidencias
    if tipo: filtered = [i for i in filtered if i.get("tipo_incidencia") == tipo.upper()]
    if celda:
        celda_up = celda.upper()
        filtered = [i for i in filtered if i.get("celda_padre") == celda_up or i.get("celda_hija") == celda_up]
    if columna: filtered = [i for i in filtered if i.get("columna", "").upper() == columna.upper()]
    if campania:
        years_list = [y.strip() for y in campania.split(",") if y.strip()]
        if len(years_list) > 0 and "TODOS" not in years_list:
            filtered = [i for i in filtered if str(i.get("campania")) in years_list]
    if geotecnico:
        geo_up = geotecnico.upper()
        filtered = [i for i in filtered if i.get("geotecnico", "").upper() == geo_up]
    if sector_geotecnico:
        sect_up = sector_geotecnico.upper()
        filtered = [i for i in filtered if i.get("sector_geotecnico", "").upper() == sect_up]
    
    if search:
        search_lower = search.lower()
        filtered = [
            i for i in filtered 
            if search_lower in i.get("mensaje", "").lower() 
            or search_lower in get_incidence_category_name(i).lower()
            or search_lower in i.get("columna", "").lower()
            or search_lower in i.get("celda_padre", "").lower()
        ]
        
    total_records = len(filtered)
    start_idx = (page - 1) * limit
    return {"page": page, "limit": limit, "total_records": total_records, "total_pages": math.ceil(total_records / limit), "data": filtered[start_idx:start_idx+limit]}

@router.get("/geomecanica/reporte-excel")
def descargar_reporte_excel(
    tipo: str = None, celda: str = None, columna: str = None, campania: str = None,
    geotecnico: str = None, sector_geotecnico: str = None, search: str = None, audit_id: str = None
):
    filtered_vals = []
    for val in [tipo, celda, columna, campania, geotecnico, sector_geotecnico, search]:
        if val is not None:
            v_str = str(val).strip().upper()
            if v_str not in ["", "NONE", "NULL", "UNDEFINED", "TODOS"]:
                filtered_vals.append(val)
                
    is_filtered = len(filtered_vals) > 0
    filename = f"reporte_auditoria_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    if audit_id:
        pregenerated_file = os.path.join(uploads_dir, "history", f"{audit_id}_reporte_completo.xlsx")
    else:
        pregenerated_file = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")

    if not is_filtered and os.path.exists(pregenerated_file):
        return FileResponse(
            pregenerated_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename
        )

    if audit_id:
        raw_file = os.path.join(uploads_dir, "history", f"{audit_id}_diagnostico.json")
        compact_file = os.path.join(uploads_dir, "history", f"{audit_id}_compact.json")
    else:
        raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
        compact_file = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
        if not os.path.exists(raw_file) or not os.path.exists(compact_file):
            history_dir = os.path.join(uploads_dir, "history")
            if os.path.exists(history_dir):
                jsons = [f for f in os.listdir(history_dir) if f.endswith("_diagnostico.json") and not f.endswith(".tmp")]
                if jsons:
                    jsons.sort(key=lambda x: os.path.getmtime(os.path.join(history_dir, x)), reverse=True)
                    latest_id = jsons[0].replace("_diagnostico.json", "")
                    raw_file = os.path.join(history_dir, f"{latest_id}_diagnostico.json")
                    compact_file = os.path.join(history_dir, f"{latest_id}_compact.json")

    if not os.path.exists(raw_file) or not os.path.exists(compact_file):
        raise HTTPException(status_code=404, detail="El diagnóstico solicitado no ha sido generado o está incompleto.")

    with open(raw_file, "r", encoding="utf-8") as f:
        diag = json.load(f)
    with open(compact_file, "r", encoding="utf-8") as f:
        compact = json.load(f)
        
    incidencias = diag.get("incidencias", [])
    
    filtered = incidencias
    if tipo: filtered = [i for i in filtered if i.get("tipo_incidencia") == tipo.upper()]
    if celda:
        celda_up = celda.upper()
        filtered = [i for i in filtered if i.get("celda_padre") == celda_up or i.get("celda_hija") == celda_up]
    if columna: filtered = [i for i in filtered if i.get("columna", "").upper() == columna.upper()]
    if campania:
        years_list = [y.strip() for y in campania.split(",") if y.strip()]
        if len(years_list) > 0 and "TODOS" not in years_list:
            filtered = [i for i in filtered if str(i.get("campania")) in years_list]
    if geotecnico:
        geo_up = geotecnico.upper()
        filtered = [i for i in filtered if i.get("geotecnico", "").upper() == geo_up]
    if sector_geotecnico:
        sect_up = sector_geotecnico.upper()
        filtered = [i for i in filtered if i.get("sector_geotecnico", "").upper() == sect_up]
    
    if search:
        search_lower = search.lower()
        filtered = [
            i for i in filtered 
            if search_lower in i.get("mensaje", "").lower() 
            or search_lower in get_incidence_category_name(i).lower()
            or search_lower in i.get("columna", "").lower()
            or search_lower in i.get("celda_padre", "").lower()
        ]

    wb = generar_excel_reporte_core(diag, compact, filtered)
    
    if not is_filtered:
        os.makedirs(os.path.dirname(pregenerated_file), exist_ok=True)
        excel_tmp = pregenerated_file + ".tmp"
        wb.save(excel_tmp)
        safe_replace(excel_tmp, pregenerated_file)
        
        if not audit_id:
            public_excel = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")
            public_excel_tmp = public_excel + ".tmp"
            shutil.copyfile(pregenerated_file, public_excel_tmp)
            safe_replace(public_excel_tmp, public_excel)
            
        return FileResponse(
            pregenerated_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename
        )

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )