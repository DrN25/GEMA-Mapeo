import os
import io
import json
import shutil
import math
import openpyxl
import time
from datetime import datetime
from collections import Counter, defaultdict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import BarChart, Reference
from openpyxl.utils import get_column_letter

from app.database import get_db
from app.utils.validator import validate_bulk_excel

router = APIRouter()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
uploads_dir = os.path.join(BASE_DIR, "uploads")

# --- CATÁLOGO MAESTRO ACTUALIZADO Y SINCRONIZADO DE REGLAS DE CONSISTENCIA ---
MASTER_ERROR_RULES = [
    # Alertas Críticas (Física, Rangos y Catálogos obligatorios)
    {"msg": "Ángulo del talud fuera del rango [-90, 90] grados.", "severity": "ALERTA"},
    {"msg": "Altura de la celda de estación excede el límite máximo de 30 metros.", "severity": "ALERTA"},
    {"msg": "Código de agua '76 no admitido. Debe ser C, H, M, E o F.", "severity": "ALERTA"},
    {"msg": "Código de agua '89 no admitido. Debe ser C, H, M, E o F.", "severity": "ALERTA"},
    {"msg": "Valor de agua '76 excede los límites reales de la escala [0, 10].", "severity": "ALERTA"},
    {"msg": "Rating de agua '76 es incongruente con el código.", "severity": "ALERTA"},
    {"msg": "Valor de agua '89 excede los límites reales de la escala [0, 15].", "severity": "ALERTA"},
    {"msg": "Rating de agua '89 es incongruente con el código.", "severity": "ALERTA"},
    {"msg": "Dureza '76 no admitida. Debe ser R0 a R6.", "severity": "ALERTA"},
    {"msg": "Rating de resistencia '76 fuera del límite real [0, 15].", "severity": "ALERTA"},
    {"msg": "Resistencia '76 es incongruente con la dureza.", "severity": "ALERTA"},
    {"msg": "Dureza '89 no admitida. Debe ser R0 a R6.", "severity": "ALERTA"},
    {"msg": "Rating de resistencia '89 fuera del límite real [0, 15].", "severity": "ALERTA"},
    {"msg": "Resistencia '89 es incongruente con la dureza.", "severity": "ALERTA"},
    {"msg": "Control estructural '76 fuera de límites permitidos [1, 5].", "severity": "ALERTA"},
    {"msg": "Control estructural '89 fuera de límites permitidos [1, 5].", "severity": "ALERTA"},
    {"msg": "Efecto de voladura '76 excede los límites de la escala [1, 6].", "severity": "ALERTA"},
    {"msg": "Efecto de voladura '89 excede los límites de la escala [1, 6].", "severity": "ALERTA"},
    {"msg": "Porcentaje de RQD '76 no puede ser superior al 100%.", "severity": "ALERTA"},
    {"msg": "Porcentaje de RQD '89 no puede ser superior al 100%.", "severity": "ALERTA"},
    {"msg": "El espaciamiento promedio '76 debe ser positivo.", "severity": "ALERTA"},
    {"msg": "Valor de rating de espaciamiento '76 fuera del rango [5, 30].", "severity": "ALERTA"},
    {"msg": "Rating de espaciamiento '76 no se alinea con el promedio.", "severity": "ALERTA"},
    {"msg": "El espaciamiento promedio '89 debe ser positivo.", "severity": "ALERTA"},
    {"msg": "Valor de rating de espaciamiento '89 fuera del rango [5, 20].", "severity": "ALERTA"},
    {"msg": "Rating de espaciamiento '89 no se alinea con el promedio esperado.", "severity": "ALERTA"},
    {"msg": "Tipo de estructura geológica no permitida.", "severity": "ALERTA"},
    {"msg": "Tipo de relleno no pertenece al catálogo.", "severity": "ALERTA"},
    {"msg": "Valor JRC fuera de rango permitido [0, 20].", "severity": "ALERTA"},
    {"msg": "Clase de rugosidad de junta fuera de límites [1, 9].", "severity": "ALERTA"},
    {"msg": "Forma de estructura inválida. Debe ser P, C, O, E o I.", "severity": "ALERTA"},
    {"msg": "Código de alteración inválido.", "severity": "ALERTA"},
    {"msg": "Espesor del relleno es superior a la abertura total.", "severity": "ALERTA"},
    {"msg": "La abertura de la falla supera la longitud de la celda.", "severity": "ALERTA"},
    {"msg": "UCS debe ser mayor a Is50.", "severity": "ALERTA"},
    {"msg": "Combinación litológica Lito 1-2-3 inválida según el catálogo.", "severity": "ALERTA"},
    {"msg": "Unidad litológica es incongruente con la litología.", "severity": "ALERTA"},
    {"msg": "Valor de inclinación (Dip) fuera de rango permitido [-90, 90] grados.", "severity": "ALERTA"},
    {"msg": "Valor de dirección de inclinación (Dip Direction) fuera de rango permitido [0, 360] grados.", "severity": "ALERTA"},
    
    # Advertencias de Consistencia y Formato
    {"msg": "El valor de agua '76 es un valor medio no exacto.", "severity": "ADVERTENCIA"},
    {"msg": "El valor de agua '89 es un valor medio no exacto.", "severity": "ADVERTENCIA"},
    {"msg": "Puntaje de resistencia '76 es un valor alejado no válido.", "severity": "ADVERTENCIA"},
    {"msg": "Puntaje de resistencia '89 es un valor alejado no válido.", "severity": "ADVERTENCIA"},
    {"msg": "Puntaje de efectos de voladura '76 es un valor medio no exacto.", "severity": "ADVERTENCIA"},
    {"msg": "Puntaje de efectos de voladura '89 es un valor medio no exacto.", "severity": "ADVERTENCIA"},
    {"msg": "Puntaje de RQD '76 es un valor alejado no válido.", "severity": "ADVERTENCIA"},
    {"msg": "Puntaje de RQD '89 es un valor alejado no válido.", "severity": "ADVERTENCIA"},
    {"msg": "Puntaje de espaciamiento '76 es un valor medio no exacto.", "severity": "ADVERTENCIA"},
    {"msg": "Puntaje de espaciamiento '89 es un valor medio no exacto.", "severity": "ADVERTENCIA"},
    {"msg": "Tipo de estructura geológica 'J' sugerida a normalizar por 'JN'.", "severity": "ADVERTENCIA"},
    {"msg": "La abertura excede el máximo sugerido de 10000mm.", "severity": "ADVERTENCIA"},
    {"msg": "La persistencia de discontinuidad supera el largo de ventana.", "severity": "ADVERTENCIA"},
    {"msg": "La persistencia es superior a 25 metros.", "severity": "ADVERTENCIA"},
    {"msg": "Divergencia de resistencia uniaxial (UCS vs Is50 * K).", "severity": "ADVERTENCIA"},
    {"msg": "En número de estructuras solamente se permiten números enteros.", "severity": "ADVERTENCIA"},
    {"msg": "Campo obligatorio se encuentra vacío.", "severity": "VACIO"},

    {"msg": "El espesor del relleno no puede ser un valor negativo.", "severity": "ALERTA"},
    {"msg": "La abertura total no puede ser un valor negativo.", "severity": "ALERTA"},
    {"msg": "La persistencia de discontinuidad (continuidad) no puede ser un valor negativo.", "severity": "ALERTA"},
    {"msg": "El espaciamiento de discontinuidad no puede ser un valor negativo.", "severity": "ALERTA"},
]

def safe_int(val, default=0):
    if val is None: return default
    try: return int(val)
    except: return default

def safe_float(val, default=0.0):
    if val is None: return default
    try: return float(val)
    except: return default

def simplify_message(msg):
    msg_clean = str(msg or "").strip()
    msg_up = msg_clean.upper()
    
    if "ÁNGULO DEL TALUD" in msg_up or "DIP_TALUD" in msg_up:
        return "Ángulo del talud fuera del rango [-90, 90] grados."
    if "ALTURA DE LA CELDA" in msg_up or "ALTURA" in msg_up:
        return "Altura de la celda de estación excede el límite máximo de 30 metros."
    if "CÓDIGO DE AGUA '76" in msg_up:
        return "Código de agua '76 no admitido. Debe ser C, H, M, E o F."
    if "CÓDIGO DE AGUA '89" in msg_up:
        return "Código de agua '89 no admitido. Debe ser C, H, M, E o F."
    if "VALOR DE AGUA '76 EXCEDE" in msg_up:
        return "Valor de agua '76 excede los límites reales de la escala [0, 10]."
    if "RATING DE AGUA '76" in msg_up and "INCONGRUENTE" in msg_up:
        return "Rating de agua '76 es incongruente con el código."
    if "VALOR DE AGUA '89 EXCEDE" in msg_up:
        return "Valor de agua '89 excede los límites reales de la escala [0, 15]."
    if "RATING DE AGUA '89" in msg_up and "INCONGRUENTE" in msg_up:
        return "Rating de agua '89 es incongruente con el código."
    if "DUREZA  '76" in msg_up:
         return "Dureza '76 no admitida. Debe ser R0 a R6."
    if "DUREZA '89" in msg_up:
         return "Dureza '89 no admitida. Debe ser R0 a R6."
    if "RESISTENCIA ESTIMADA VALOR  '76" in msg_up and "EXCEDE" in msg_up:
        return "Rating de resistencia '76 fuera del límite real [0, 15]."
    if "RESISTENCIA ESTIMADA VALOR '89" in msg_up and "EXCEDE" in msg_up:
        return "Rating de resistencia '89 fuera del límite real [0, 15]."
    if "RESISTENCIA '76" in msg_up and "INCONGRUENTE" in msg_up:
        return "Resistencia '76 es incongruente con la dureza."
    if "RESISTENCIA '89" in msg_up and "INCONGRUENTE" in msg_up:
        return "Resistencia '89 es incongruente con la dureza."
    if "CONTROL ESTRUCTURAL" in msg_up:
        if "'76" in msg_up: return "Control estructural '76 fuera de límites permitidos [1, 5]."
        return "Control estructural '89 fuera de límites permitidos [1, 5]."
    if "EFECTOS DE VOLADURA" in msg_up:
        if "'76" in msg_up: return "Efecto de voladura '76 excede los límites de la escala [1, 6]."
        return "Efecto de voladura '89 excede los límites de la escala [1, 6]."
    if "RQD - VALOR" in msg_up:
        if "LÍMITES REALES" in msg_up or "EXCEDE" in msg_up:
            if "'76" in msg_up: return "Valor de RQD '76 excede los límites reales de la escala [0, 20]."
            return "Valor de RQD '89 excede los límites reales de la escala [0, 20]."
    if "PORCENTAJE DE RQD" in msg_up:
        if "'76" in msg_up: return "Porcentaje de RQD '76 no puede ser superior al 100%."
        return "Porcentaje de RQD '89 no puede ser superior al 100%."
    if "ESPACIAMIENTO PROMEDIO" in msg_up:
        if "'76" in msg_up: return "El espaciamiento promedio '76 debe ser positivo."
        return "El espaciamiento promedio '89 debe ser positivo."
    if "ESPACIAMIENTO - VALOR" in msg_up:
        if "RANGO" in msg_up or "RANGO PERMITIDO" in msg_up:
            if "'76" in msg_up: return "Valor de rating de espaciamiento '76 fuera del rango [5, 30]."
            return "Valor de rating de espaciamiento '89 fuera del rango [5, 20]."
        if "NO SE ALINEA" in msg_up:
            if "'76" in msg_up: return "Rating de espaciamiento '76 no se alinea con el promedio."
            return "Rating de espaciamiento '89 no se alinea con el promedio esperado."
    if "ESTRUCTURA GEOLÓGICA" in msg_up or "ESTRUCTURA GEOLOGICA" in msg_up:
        return "Tipo de estructura geológica no permitida."
    if "RELLENO 1" in msg_up or "RELLENO 2" in msg_up:
        return "Tipo de relleno no pertenece al catálogo."
    if "VALOR JRC" in msg_up:
        return "Valor JRC fuera de rango permitido [0, 20]."
    if "RUGOSIDAD" in msg_up:
        return "Clase de rugosidad de junta fuera de límites [1, 9]."
    if "FORMA" in msg_up:
        return "Forma de estructura inválida. Debe ser P, C, O, E o I."
    if "ALTERACION" in msg_up or "ALTERACIÓN" in msg_up:
        return "Código de alteración inválido."
    if "ESPESOR" in msg_up and "ABERTURA" in msg_up:
         return "Espesor del relleno es superior a la abertura total."
    if "ABERTURA DE LA FALLA" in msg_up:
         return "La abertura de la falla supera la longitud de la celda."
    if "UCS" in msg_up and "MAYOR A IS50" in msg_up:
         return "UCS debe ser mayor a Is50."
    if "COMBINACIÓN LITOLÓGICA" in msg_up or "COMBINACION LITOLOGICA" in msg_up:
         return "Combinación litológica Lito 1-2-3 inválida según el catálogo."
    if "UNIDAD LITOLÓGICA" in msg_up:
         return "Unidad litológica es incongruente con la litología."
    if "VALOR MEDIO NO EXACTO" in msg_up:
        if "AGUA" in msg_up:
            if "'76" in msg_up: return "El valor de agua '76 es un valor medio no exacto."
            return "El valor de agua '89 es un valor medio no exacto."
        if "VOLADURA" in msg_up:
            if "'76" in msg_up: return "Puntaje de efectos de voladura '76 es un valor medio no exacto."
            return "Puntaje de efectos de voladura '89 es un valor medio no exacto."
        if "ESPACIAMIENTO" in msg_up:
            if "'76" in msg_up: return "Puntaje de espaciamiento '76 es un valor medio no exacto."
            return "Puntaje de espaciamiento '89 es un valor medio no exacto."
    if "VALOR ALEJADO NO VÁLIDO" in msg_up or "VALOR ALEJADO NO VALIDO" in msg_up:
        if "RQD" in msg_up:
            if "'76" in msg_up: return "Puntaje de RQD '76 es un valor alejado no válido."
            return "Puntaje de RQD '89 es un valor alejado no válido."
        if "RESISTENCIA" in msg_up:
            if "'76" in msg_up: return "Puntaje de resistencia '76 es un valor alejado no válido."
            return "Puntaje de resistencia '89 es un valor alejado no válido."
    if "NORMALIZAR POR 'JN'" in msg_up:
        return "Tipo de estructura geológica 'J' sugerida a normalizar por 'JN'."
    if "EXCEDE EL MÁXIMO SUGERIDO" in msg_up:
        return "La abertura excede el máximo sugerido de 10000mm."
    if "SUPERA EL LARGO" in msg_up:
        return "La persistencia de discontinuidad supera el largo de ventana."
    if "SUPERIOR A 25 METROS" in msg_up or "ELEVADA" in msg_up:
        return "La persistencia es superior a 25 metros."
    if "DIVERGENCIA DE RESISTENCIA UNIAXIAL" in msg_up:
        return "Divergencia de resistencia uniaxial (UCS vs Is50 * K)."
    if "VACÍO" in msg_up or "VACIO" in msg_up:
        return "Campo obligatorio se encuentra vacío."
    if "INCLINACIÓN (DIP) FUERA" in msg_up or ("DIP" in msg_up and "DIP DIR" not in msg_up and "TALUD" not in msg_up):
        return "Valor de inclinación (Dip) fuera de rango permitido [-90, 90] grados."
    if "DIP DIRECTION" in msg_up or ("DIP DIR" in msg_up and "TALUD" not in msg_up):
        return "Valor de dirección de inclinación (Dip Direction) fuera de rango permitido [0, 360] grados."
    if "NÚMERO DE ESTRUCTURAS" in msg_up or "NUMERO DE ESTRUCTURAS" in msg_up:
        return "En número de estructuras solamente se permiten números enteros."
    if "ESPESOR" in msg_up and "NEGATIVO" in msg_up:
        return "El espesor del relleno no puede ser un valor negativo."
    if "ABERTURA" in msg_up and "NEGATIVO" in msg_up:
        return "La abertura total no puede ser un valor negativo."
    if "PERSISTENCIA" in msg_up and "NEGATIVO" in msg_up or "CONTINUIDAD" in msg_up and "NEGATIVO" in msg_up:
        return "La persistencia de discontinuidad (continuidad) no puede ser un valor negativo."
    if "ESPACIAMIENTO DE DISCONTINUIDAD" in msg_up or ("ESPACIAMIENTO M." in msg_up and "NEGATIVO" in msg_up):
        return "El espaciamiento de discontinuidad no puede ser un valor negativo."
    return msg_clean

def get_safe_sheet_name(title, index):
    clean_title = "".join(c for c in title if c not in r':\/?*[]\'"').strip()
    suffix = f" ({index})"
    max_title_len = 31 - len(suffix)
    return f"{clean_title[:max_title_len].strip()}{suffix}"

# --- HELPER SEGURO DE REEMPLAZO DE ARCHIVOS EN WINDOWS ---
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

# --- GENERADOR CORE DE ALTO RENDIMIENTO EXTREMO ---
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
    
    # Reutilización optimizada de KPI Cards
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

    # KPI Cards
    write_kpi_card_opt(ws_dash, 5, 2, "ESTACIONES EVALUADAS", len(compact.get("resumen_por_celda_padre", {})), fill_kpi_gray, font_kpi_val_blue)
    write_kpi_card_opt(ws_dash, 5, 4, "ESTRUCTURAS REGISTRADAS", total_filas, fill_kpi_gray, font_kpi_val_blue)
    write_kpi_card_opt(ws_dash, 5, 6, "INTEGRIDAD GLOBAL", f"{pct_integridad:.2f}%", fill_accent_green, font_kpi_val_green)
    write_kpi_card_opt(ws_dash, 5, 8, "ALERTAS CRÍTICAS", total_alertas, fill_accent_red, font_kpi_val_red)
    write_kpi_card_opt(ws_dash, 5, 10, "ADVERTENCIAS", total_advertencias, fill_accent_orange, font_kpi_val_orange)

    # Tabla: Distribución por Campaña
    ws_dash.cell(row=9, column=2, value="DESEMPEÑO DE CONTROL POR CAMPAÑA").font = font_section
    headers_camp = ["Campaña", "Estructuras", "Alertas (N)", "% Alertas", "Vacíos (N)", "% Vacíos"]
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
        
        ws_dash.cell(row=r_camp, column=4, value=safe_int(row.get("alertas_cant"))).number_format = '#,##0'
        ws_dash.cell(row=r_camp, column=4).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=5, value=safe_float(row.get("alertas_pct")) / 100.0).number_format = '0.00%'
        ws_dash.cell(row=r_camp, column=5).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=6, value=safe_int(row.get("vacios_cant"))).number_format = '#,##0'
        ws_dash.cell(row=r_camp, column=6).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=7, value=safe_float(row.get("vacios_pct")) / 100.0).number_format = '0.00%'
        ws_dash.cell(row=r_camp, column=7).alignment = alignment_right
        
        for col_idx in range(2, 8):
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

    top_errs_list = Counter(simplify_message(i.get("mensaje")) for i in filtered if i.get("tipo_incidencia") == "ALERTA").most_common(5)
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
        msg_simplificado = simplify_message(inc.get("mensaje", ""))
        incidencias_por_error[msg_simplificado].append(inc)

    catalog_frequencies = []
    for rule in MASTER_ERROR_RULES:
        rule_msg = rule["msg"]
        matches = incidencias_por_error[rule_msg]
        catalog_frequencies.append({
            "msg": rule_msg,
            "severity": rule["severity"],
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
    ws_detail.cell(row=3, column=2, value="Listado plano consolidado de todas las desviaciones y vacíos detectados. Use los filtros de Excel en las cabeceras para segmentar.").font = font_subtitle
    
    headers_detail = [
        "Fila Excel", "Gravedad", "Estación Padre", "Estructura Hija", "Campaña", 
        "Logger Geotécnico", "Sector Geotécnico", "Columna de Falla", 
        "Valor Actual", "Mensaje de Inconsistencia Geomecánica"
    ]
    
    ws_detail.append([]) 
    ws_detail.append([None] + headers_detail) 
    grid_heading_row = ws_detail.max_row
    
    for idx in range(2, 12):
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
            inc_item.get("columna"),
            inc_item.get("valor_actual") if inc_item.get("valor_actual") is not None else "—",
            simplify_message(inc_item.get("mensaje"))
        ]
        ws_detail.append(row_data)
        
    end_detail_row = ws_detail.max_row
    
    # Renderizado ultra veloz
    for r_idx in range(start_detail_row, end_detail_row + 1):
        if r_idx <= start_detail_row + 150:
            ws_detail.cell(row=r_idx, column=2).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=3).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=4).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=5).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=6).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=7).alignment = alignment_left
            ws_detail.cell(row=r_idx, column=8).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=9).alignment = alignment_left
            ws_detail.cell(row=r_idx, column=10).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=11).alignment = alignment_left
            
            if r_idx % 2 == 0:
                for col_idx in range(2, 12):
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
        
        for col_idx in range(2, 12):
            ws_detail.cell(row=r_idx, column=col_idx).border = border_thin
            
    ws_detail.auto_filter.ref = f"B{grid_heading_row}:K{end_detail_row}"

    # --- HOJAS 4+: DETALLES INDIVIDUALES POR REGLA DE ERROR (CON DASHBOARD Y KPIS) ---
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
            
        # Distribución por Geotécnico / Responsable (Logger Geotécnico)
        ws_err.cell(row=10, column=6, value="DISTRIBUCIÓN POR GEOTÉCNICO / RESPONSABLE").font = font_section
        for idx, col in enumerate(["Logger Geotécnico", "Ocurrencias (N)", "% Contribución"], start=6):
            cell = ws_err.cell(row=11, column=idx, value=col)
            cell.font = font_header
            cell.fill = fill_primary
            cell.alignment = alignment_center
            cell.border = border_thin
            
        r_dist_sc = defaultdict(int)
        for r in err_records:
            r_dist_sc[str(r.get("geotecnico", "N/A"))] += 1
            
        curr_s_r = 12
        for sc, s_qty in sorted(r_dist_sc.items()):
            ws_err.cell(row=curr_s_r, column=6, value=sc).font = font_bold
            ws_err.cell(row=curr_s_r, column=6).alignment = alignment_center
            ws_err.cell(row=curr_s_r, column=6).border = border_thin
            
            c_sq = ws_err.cell(row=curr_s_r, column=7, value=s_qty)
            c_sq.font = font_regular
            c_sq.alignment = alignment_right
            c_sq.number_format = '#,##0'
            c_sq.border = border_thin
            
            c_sp = ws_err.cell(row=curr_s_r, column=8, value=s_qty / max(1, tot_affected))
            c_sp.font = font_regular
            c_sp.alignment = alignment_right
            c_sp.number_format = '0.00%'
            c_sp.border = border_thin
            
            curr_s_r += 1

        # Renglones Libres y Escritura por Ráfagas
        ws_err.append([])
        ws_err.append([None, "REGISTROS INDIVIDUALES AFECTADOS (LISTADO COMPLETO)"])
        title_row_idx = ws_err.max_row
        ws_err.cell(row=title_row_idx, column=2).font = font_section
        
        headers_inc = [
            "Fila Excel", "Estación Padre", "Estructura Hija", "Campaña", 
            "Logger Geotécnico", "Sector Geotécnico", "Columna de Falla", 
            "Valor Actual", "Mensaje de Inconsistencia Geomecánica"
        ]
        ws_err.append([None] + headers_inc)
        header_row_idx = ws_err.max_row
        
        for col_idx in range(2, 11):
            cell = ws_err.cell(row=header_row_idx, column=col_idx)
            cell.font = font_header
            cell.fill = fill_primary
            cell.alignment = alignment_center
            cell.border = border_thin
            
        start_data_row = ws_err.max_row + 1
        for inc_item in err_records:
            row_data = [
                None,
                safe_int(inc_item.get("fila_excel")),
                inc_item.get("celda_padre"),
                inc_item.get("celda_hija"),
                inc_item.get("campania"),
                inc_item.get("geotecnico"),
                inc_item.get("sector_geotecnico"),
                inc_item.get("columna"),
                inc_item.get("valor_actual") if inc_item.get("valor_actual") is not None else "—",
                inc_item.get("mensaje")
            ]
            ws_err.append(row_data)
            
        end_data_row = ws_err.max_row
        
        # Formateado de datos optimizado por lotes
        for r_idx in range(start_data_row, end_data_row + 1):
            if r_idx <= start_data_row + 150:
                ws_err.cell(row=r_idx, column=2).alignment = alignment_center
                ws_err.cell(row=r_idx, column=3).alignment = alignment_center
                ws_err.cell(row=r_idx, column=4).alignment = alignment_center
                ws_err.cell(row=r_idx, column=5).alignment = alignment_center
                ws_err.cell(row=r_idx, column=6).alignment = alignment_left
                ws_err.cell(row=r_idx, column=7).alignment = alignment_center
                ws_err.cell(row=r_idx, column=8).alignment = alignment_left
                ws_err.cell(row=r_idx, column=9).alignment = alignment_center
                ws_err.cell(row=r_idx, column=10).alignment = alignment_left
                
                if r_idx % 2 == 0:
                    for col_idx in range(2, 11):
                        ws_err.cell(row=r_idx, column=col_idx).fill = fill_zebra
            else:
                ws_err.cell(row=r_idx, column=2).alignment = alignment_center
                ws_err.cell(row=r_idx, column=3).alignment = alignment_center
                
            for col_idx in range(2, 11):
                ws_err.cell(row=r_idx, column=col_idx).border = border_thin
                
        ws_err.auto_filter.ref = f"B{header_row_idx}:J{end_data_row}"

    # --- AUTO-AJUSTE DINÁMICO DE COLUMNAS ---
    for ws in wb.worksheets:
        ws.column_dimensions['A'].width = 3
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

# --- PIPELINE DE PROCESAMIENTO ASÍNCRONO ---
def run_bulk_pipeline_with_id(file_path: str, audit_id: str):
    history_dir = os.path.join(uploads_dir, "history")
    os.makedirs(history_dir, exist_ok=True)
    raw_json_out = os.path.join(history_dir, f"{audit_id}_diagnostico.json")
    compact_json_out = os.path.join(history_dir, f"{audit_id}_compact.json")
    excel_pregenerated_out = os.path.join(history_dir, f"{audit_id}_reporte_completo.xlsx")
    
    validate_bulk_excel(file_path, raw_json_out)
    shutil.copyfile(raw_json_out, os.path.join(uploads_dir, "diagnostico_geomecanico.json"))
    
    with open(raw_json_out, "r", encoding="utf-8") as f:
        diag = json.load(f)
        
    compact = {k: v for k, v in diag.items() if k != "incidencias"}
    incidencias = diag.get("incidencias", [])
    total_filas = diag.get("total_filas_procesadas", 0)
    
    resumen_celdas = diag.get("resumen_por_celda_padre", {})
    num_celdas_padre = len(resumen_celdas)
    promedio_hijas = sum(x["total_hijas"] for x in resumen_celdas.values()) / max(1, num_celdas_padre)
    total_metros = sum(safe_float(x.get("dist_celda", 0.0)) for x in resumen_celdas.values())
    
    total_fields = total_filas * 77
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
    
    camp_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set()})
    geo_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set()})
    sector_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set()})
    
    observaciones_por_año = defaultdict(lambda: defaultdict(lambda: {"incidents": 0, "stations": set()}))
    top_stations_por_año = defaultdict(lambda: defaultdict(lambda: Counter()))
    
    for i in incidencias:
        c = i.get("campania", "N/A")
        if c == "N/A": continue
        obs_key = simplify_message(i.get("mensaje", ""))
        celda = i.get("celda_padre", "N/A")
        
        observaciones_por_año[c][obs_key]["incidents"] += 1
        observaciones_por_año[c][obs_key]["stations"].add(celda)
        top_stations_por_año[c][obs_key][celda] += 1
        
        camp_stats[c]["filas"].add(i["fila_excel"])
        geo_stats[g := i.get("geotecnico", "N/A")]["filas"].add(i["fila_excel"])
        sector_stats[s := i.get("sector_geotecnico", "N/A")]["filas"].add(i["fila_excel"])
        
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
        total_fields_group = rows_count * 77
        distribucion_campania.append({
            "campania": c, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    distribucion_geotecnico = []
    for g, stats in geo_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * 77
        distribucion_geotecnico.append({
            "geotecnico": g, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    distribucion_sector = []
    for s, stats in sector_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * 77
        distribucion_sector.append({
            "sector": s, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    msg_alertas = Counter(simplify_message(i.get("mensaje")) for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    msg_advertencias = Counter(simplify_message(i.get("mensaje")) for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
    
    top_5_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common(5)]
    lista_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common()]
    lista_advertencias = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_advertencias)) * 100} for k, v in msg_advertencias.most_common()]
    
    compact["audit_id"] = audit_id
    compact["fecha_auditoria"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    compact["nombre_archivo"] = os.path.basename(file_path)
    compact["consolidado_observaciones"] = consolidado_tabla
    
    compact["familia1"] = {
        "num_celdas_padre": num_celdas_padre,
        "promedio_hijas": round(promedio_hijas, 2),
        "total_discontinuidades": total_filas,
        "total_metros": round(total_metros, 2)
    }
    compact["familia2"] = {"total_fields": total_fields, "total_vacios": total_vacios, "total_advertencias": total_advertencias, "total_alertas": total_alertas, "total_correctos": total_correctos}
    compact["familia3"] = {"total_discontinuidades": total_filas, "discontinuidades_alertas": discs_con_alerta, "discontinuidades_advertencias": discs_con_advertencia, "discontinuidades_vacios": discs_con_vacio, "discontinuidades_correctas": discs_correctas}
    compact["distribucion_campania"] = distribucion_campania
    compact["distribucion_sector"] = distribucion_sector
    compact["distribucion_geotecnico"] = distribucion_geotecnico
    compact["top_5_alertas"] = top_5_alertas
    compact["error_types_detailed"] = {"alertas": lista_alertas, "advertencias": lista_advertencias}
    
    sorted_worst = sorted(resumen_celdas.items(), key=lambda x: (x[1].get("alertas", 0), x[1].get("vacios", 0), x[1].get("advertencias", 0)), reverse=True)[:20]
    compact["worst_cells"] = [{"celda": k, **v} for k, v in sorted_worst]
    col_counter = Counter(i.get("columna", "Desconocido") for i in incidencias)
    compact["top_column_errors"] = [{"columna": k, "cantidad": v} for k, v in col_counter.most_common(15)]
    
    # Escritura segura de JSONs (Tmp + Replace)
    compact_json_tmp = compact_json_out + ".tmp"
    with open(compact_json_tmp, "w", encoding="utf-8") as f:
        json.dump(compact, f, ensure_ascii=False)
    safe_replace(compact_json_tmp, compact_json_out)
    
    public_diag = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
    public_diag_tmp = public_diag + ".tmp"
    shutil.copyfile(raw_json_out, public_diag_tmp)
    safe_replace(public_diag_tmp, public_diag)
    
    public_compact = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
    public_compact_tmp = public_compact + ".tmp"
    shutil.copyfile(compact_json_out, public_compact_tmp)
    safe_replace(public_compact_tmp, public_compact)

    # PRE-GENERACIÓN COMPLETA EN DISCO
    try:
        print(f"[*] Iniciando pre-generación asíncrona de reporte de Excel para {audit_id}...")
        wb = generar_excel_reporte_core(diag, compact, list(incidencias))
        
        excel_tmp = excel_pregenerated_out + ".tmp"
        wb.save(excel_tmp)
        safe_replace(excel_tmp, excel_pregenerated_out)
        
        # Sincronizar también con la copia pública
        public_excel = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")
        public_excel_tmp = public_excel + ".tmp"
        shutil.copyfile(excel_pregenerated_out, public_excel_tmp)
        safe_replace(public_excel_tmp, public_excel)
        print(f"[+] Reporte completo pre-generado y cacheado en disk sin errores.")
    except Exception as e:
        print(f"[-] Error al pre-generar reporte de Excel en segundo plano: {e}")

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
    background_tasks.add_task(run_bulk_pipeline_with_id, file_path, audit_id)
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
        
    with open(raw_file, "r", encoding="utf-8") as f:
        diag = json.load(f)
        
    incidencias = diag.get("incidencias", [])
    total_filas_original = diag.get("total_filas_procesadas", 0)
    
    if years and years != "TODOS" and years != "":
        years_list = [y.strip() for y in years.split(",") if y.strip()]
        incidencias = [i for i in incidencias if str(i.get("campania")) in years_list]
        resumen_celdas_raw = diag.get("resumen_por_celda_padre", {})
        resumen_celdas = {k: v for k, v in resumen_celdas_raw.items() if str(v.get("campania")) in years_list}
        total_filas = len(incidencias)
    else:
        resumen_celdas = diag.get("resumen_por_celda_padre", {})
        total_filas = total_filas_original

    num_celdas_padre = len(resumen_celdas)
    promedio_hijas = sum(x["total_hijas"] for x in resumen_celdas.values()) / max(1, num_celdas_padre)
    total_metros = sum(safe_float(x.get("dist_celda", 0.0)) for x in resumen_celdas.values())
    
    total_fields = total_filas * 77
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
    
    camp_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set()})
    geo_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set()})
    sector_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set()})
    observaciones_por_año = defaultdict(lambda: defaultdict(lambda: {"incidents": 0, "stations": set()}))
    top_stations_por_año = defaultdict(lambda: defaultdict(lambda: Counter()))
    
    for i in incidencias:
        c = i.get("campania", "N/A")
        obs_key = simplify_message(i.get("mensaje", ""))
        celda = i.get("celda_padre", "N/A")
        
        observaciones_por_año[c][obs_key]["incidents"] += 1
        observaciones_por_año[c][obs_key]["stations"].add(celda)
        top_stations_por_año[c][obs_key][celda] += 1
        
        camp_stats[c]["filas"].add(i["fila_excel"])
        geo_stats[i.get("geotecnico", "N/A")]["filas"].add(i["fila_excel"])
        sector_stats[i.get("sector_geotecnico", "N/A")]["filas"].add(i["fila_excel"])
        
        tipo = i.get("tipo_incidencia")
        if tipo == "VACIO":
            camp_stats[c]["vacios"] += 1
            geo_stats[i.get("geotecnico", "N/A")]["vacios"] += 1
            sector_stats[i.get("sector_geotecnico", "N/A")]["vacios"] += 1
        elif tipo == "ADVERTENCIA":
            camp_stats[c]["advertencias"] += 1
            geo_stats[i.get("geotecnico", "N/A")]["advertencias"] += 1
            sector_stats[i.get("sector_geotecnico", "N/A")]["advertencias"] += 1
        elif tipo == "ALERTA":
            camp_stats[c]["alertas"] += 1
            geo_stats[i.get("geotecnico", "N/A")]["alertas"] += 1
            sector_stats[i.get("sector_geotecnico", "N/A")]["alertas"] += 1
            
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
        total_fields_group = rows_count * 77
        distribucion_campania.append({
            "campania": c, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    distribucion_geotecnico = []
    for g, stats in geo_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * 77
        distribucion_geotecnico.append({
            "geotecnico": g, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    distribucion_sector = []
    for s, stats in sector_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * 77
        distribucion_sector.append({
            "sector": s, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    msg_alertas = Counter(simplify_message(i.get("mensaje")) for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    msg_advertencias = Counter(simplify_message(i.get("mensaje")) for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
    
    top_5_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common(5)]
    lista_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common()]
    lista_advertencias = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_advertencias)) * 100} for k, v in msg_advertencias.most_common()]
    
    compact = {}
    compact["audit_id"] = audit_id or "default"
    compact["fecha_auditoria"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    compact["nombre_archivo"] = os.path.basename(raw_file)
    compact["consolidado_observaciones"] = consolidado_tabla
    compact["resumen_por_celda_padre"] = resumen_celdas
    
    compact["familia1"] = {
        "num_celdas_padre": num_celdas_padre,
        "promedio_hijas": round(promedio_hijas, 2),
        "total_discontinuidades": total_filas,
        "total_metros": round(total_metros, 2)
    }
    compact["familia2"] = {"total_fields": total_fields, "total_vacios": total_vacios, "total_advertencias": total_advertencias, "total_alertas": total_alertas, "total_correctos": total_correctos}
    compact["familia3"] = {"total_discontinuidades": total_filas, "discontinuidades_alertas": discs_con_alerta, "discontinuidades_advertencias": discs_con_advertencia, "discontinuidades_vacios": discs_con_vacio, "discontinuidades_correctas": discs_correctas}
    compact["distribucion_campania"] = distribucion_campania
    compact["distribucion_sector"] = distribucion_sector
    compact["distribucion_geotecnico"] = distribucion_geotecnico
    compact["top_5_alertas"] = top_5_alertas
    compact["error_types_detailed"] = {"alertas": lista_alertas, "advertencias": lista_advertencias}
    
    sorted_worst = sorted(resumen_celdas.items(), key=lambda x: (x[1].get("alertas", 0), x[1].get("vacios", 0), x[1].get("advertencias", 0)), reverse=True)[:20]
    compact["worst_cells"] = [{"celda": k, **v} for k, v in sorted_worst]
    col_counter = Counter(i.get("columna", "Desconocido") for i in incidencias)
    compact["top_column_errors"] = [{"columna": k, "cantidad": v} for k, v in col_counter.most_common(15)]
    
    return compact

@router.get("/geomecanica/incidencias-paginadas")
def obtener_incidencias_paginadas(
    page: int = 1, limit: int = 50, tipo: str = None, celda: str = None, columna: str = None,
    campania: str = None, geotecnico: str = None, sector_geotecnico: str = None, search: str = None, audit_id: str = None
):
    if audit_id: 
        raw_file = os.path.join(uploads_dir, "history", f"{audit_id}_diagnostico.json")
        compact_file = os.path.join(uploads_dir, "history", f"{audit_id}_compact.json")
        if not os.path.exists(raw_file) or not os.path.exists(compact_file):
            raise HTTPException(status_code=202, detail="La auditoría se encuentra en procesamiento...")
    else: 
        raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
        
    if not os.path.exists(raw_file): 
        raise HTTPException(status_code=404, detail="El diagnóstico solicitado no existe.")
        
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
            or search_lower in simplify_message(i.get("mensaje", "")).lower()
            or search_lower in i.get("columna", "").lower()
            or search_lower in i.get("celda_padre", "").lower()
        ]
        
    total_records = len(filtered)
    start_idx = (page - 1) * limit
    return {"page": page, "limit": limit, "total_records": total_records, "total_pages": math.ceil(total_records / limit), "data": filtered[start_idx:start_idx+limit]}

# --- CONTROLADOR CENTRAL DE EXPORTACIÓN CON AUTOGUARDADO EN CACHÉ ---
@router.get("/geomecanica/reporte-excel")
def descargar_reporte_excel(
    tipo: str = None, celda: str = None, columna: str = None, campania: str = None,
    geotecnico: str = None, sector_geotecnico: str = None, search: str = None, audit_id: str = None
):
    # Desinfectar y validar de forma estricta los filtros enviados
    filtered_vals = []
    for val in [tipo, celda, columna, campania, geotecnico, sector_geotecnico, search]:
        if val is not None:
            v_str = str(val).strip().upper()
            if v_str not in ["", "NONE", "NULL", "UNDEFINED", "TODOS"]:
                filtered_vals.append(val)
                
    is_filtered = len(filtered_vals) > 0
    filename = f"reporte_auditoria_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    # 1. EVALUAR RUTA DEL CACHÉ EN DISCO
    if audit_id:
        pregenerated_file = os.path.join(uploads_dir, "history", f"{audit_id}_reporte_completo.xlsx")
    else:
        pregenerated_file = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")

    # 2. SI NO HAY FILTROS ACTIVOS Y EL REPORTE YA EXISTE COMPLETO, DEVOLVER AL INSTANTE (0.01s)
    if not is_filtered and os.path.exists(pregenerated_file):
        return FileResponse(
            pregenerated_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename
        )

    # 3. SI NO EXISTE EN CACHÉ (Caso de auditorías históricas), COMPILAR DE FORMA ACELERADA EN VIVO
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
    
    # Procesar filtrados en vivo
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
            or search_lower in simplify_message(i.get("mensaje", "")).lower()
            or search_lower in i.get("columna", "").lower()
            or search_lower in i.get("celda_padre", "").lower()
        ]

    # Generación acelerada utilizando el método 'append' nativo
    wb = generar_excel_reporte_core(diag, compact, filtered)
    
    # 4. GUARDAR EN DISCO MEDIANTE PROTOCOLO ATÓMICO (Cachear para la próxima descarga de esta auditoría)
    if not is_filtered:
        os.makedirs(os.path.dirname(pregenerated_file), exist_ok=True)
        excel_tmp = pregenerated_file + ".tmp"
        wb.save(excel_tmp)
        safe_replace(excel_tmp, pregenerated_file)
        
        # Sincronizar reporte estático general
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

    # 5. RETORNO EN TIEMPO REAL DE FILTRADO DINÁMICO (Veloce por set de datos acotado)
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )