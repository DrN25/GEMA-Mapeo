# app/routers/auditoria.py
import os
import io
import json
import shutil
import math
import openpyxl
from datetime import datetime
from collections import Counter, defaultdict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from app.database import get_db

# Evitar importaciones circulares referenciando el validador a nivel de módulo
import sys
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(BASE_DIR)
try:
    from validador_geomecanico import validate_bulk_excel
except ImportError:
    from app.validador_geomecanico import validate_bulk_excel

router = APIRouter()
uploads_dir = os.path.join(BASE_DIR, "uploads")

COMPACT_CACHE = None

def safe_int(val, default=0):
    if val is None: return default
    try: return int(val)
    except: return default

def safe_float(val, default=0.0):
    if val is None: return default
    try: return float(val)
    except: return default

def run_bulk_pipeline_with_id(file_path: str, audit_id: str):
    history_dir = os.path.join(uploads_dir, "history")
    os.makedirs(history_dir, exist_ok=True)
    raw_json_out = os.path.join(history_dir, f"{audit_id}_diagnostico.json")
    compact_json_out = os.path.join(history_dir, f"{audit_id}_compact.json")
    
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
    
    for i in incidencias:
        c = i.get("campania", "N/A")
        g = i.get("geotecnico", "N/A")
        s = i.get("sector_geotecnico", "N/A")
        
        camp_stats[c]["filas"].add(i["fila_excel"])
        geo_stats[g]["filas"].add(i["fila_excel"])
        sector_stats[s]["filas"].add(i["fila_excel"])
        
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
        
    msg_alertas = Counter(i.get("mensaje") for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    msg_advertencias = Counter(i.get("mensaje") for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
    
    top_5_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common(5)]
    lista_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common(20)]
    lista_advertencias = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_advertencias)) * 100} for k, v in msg_advertencias.most_common(20)]
    
    compact["audit_id"] = audit_id
    compact["fecha_auditoria"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    compact["nombre_archivo"] = os.path.basename(file_path)
    
    compact["familia1"] = {"num_celdas_padre": num_celdas_padre, "promedio_hijas": round(promedio_hijas, 2), "total_discontinuidades": total_filas}
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
    
    with open(compact_json_out, "w", encoding="utf-8") as f:
        json.dump(compact, f, ensure_ascii=False)
    shutil.copyfile(compact_json_out, os.path.join(uploads_dir, "resumen_geomecanico_ligero.json"))

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
def obtener_resumen_ligero(audit_id: str = None):
    global COMPACT_CACHE
    if audit_id:
        compact_file = os.path.join(uploads_dir, "history", f"{audit_id}_compact.json")
        if os.path.exists(compact_file):
            with open(compact_file, "r", encoding="utf-8") as f:
                return json.load(f)
        excel_file = os.path.join(uploads_dir, "history", f"{audit_id}.xlsx")
        if os.path.exists(excel_file):
            return JSONResponse(status_code=202, content={"status": "procesando", "message": "Procesando analíticas..."})
        raise HTTPException(status_code=404, detail="Auditoría no encontrada")
    if COMPACT_CACHE is None:
        compact_file = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
        if os.path.exists(compact_file):
            with open(compact_file, "r", encoding="utf-8") as f:
                COMPACT_CACHE = json.load(f)
        else:
            return JSONResponse(status_code=202, content={"status": "procesando"})
    return COMPACT_CACHE

@router.get("/geomecanica/incidencias-paginadas")
def obtener_incidencias_paginadas(
    page: int = 1, limit: int = 50, tipo: str = None, celda: str = None, columna: str = None,
    campania: str = None, geotecnico: str = None, sector_geotecnico: str = None, search: str = None, audit_id: str = None
):
    if audit_id: raw_file = os.path.join(uploads_dir, "history", f"{audit_id}_diagnostico.json")
    else: raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
    if not os.path.exists(raw_file): raise HTTPException(status_code=404, detail="El diagnóstico solicitado no existe.")
    with open(raw_file, "r", encoding="utf-8") as f:
        diag_data = json.load(f)
    incidencias = diag_data.get("incidencias", [])
    filtered = incidencias
    if tipo: filtered = [i for i in filtered if i.get("tipo_incidencia") == tipo.upper()]
    if celda:
        celda_up = celda.upper()
        filtered = [i for i in filtered if i.get("celda_padre") == celda_up or i.get("celda_hija") == celda_up]
    if columna: filtered = [i for i in filtered if i.get("columna", "").upper() == columna.upper()]
    if campania: filtered = [i for i in filtered if i.get("campania") == campania]
    if geotecnico:
        geo_up = geotecnico.upper()
        filtered = [i for i in filtered if i.get("geotecnico", "").upper() == geo_up]
    if sector_geotecnico:
        sect_up = sector_geotecnico.upper()
        filtered = [i for i in filtered if i.get("sector_geotecnico", "").upper() == sect_up]
    if search:
        search_lower = search.lower()
        filtered = [i for i in filtered if search_lower in i.get("mensaje", "").lower() or search_lower in i.get("columna", "").lower() or search_lower in i.get("celda_padre", "").lower()]
    total_records = len(filtered)
    start_idx = (page - 1) * limit
    return {"page": page, "limit": limit, "total_records": total_records, "total_pages": math.ceil(total_records / limit), "data": filtered[start_idx:start_idx+limit]}

@router.get("/geomecanica/reporte-excel")
def descargar_reporte_excel(
    tipo: str = None, celda: str = None, columna: str = None, campania: str = None,
    geotecnico: str = None, sector_geotecnico: str = None, search: str = None, audit_id: str = None
):
    if audit_id:
        raw_file = os.path.join(uploads_dir, "history", f"{audit_id}_diagnostico.json")
        compact_file = os.path.join(uploads_dir, "history", f"{audit_id}_compact.json")
    else:
        raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
        compact_file = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
        if not os.path.exists(raw_file) or not os.path.exists(compact_file):
            history_dir = os.path.join(uploads_dir, "history")
            if os.path.exists(history_dir):
                jsons = [f for f in os.listdir(history_dir) if f.endswith("_diagnostico.json")]
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
    if campania: filtered = [i for i in filtered if i.get("campania") == campania]
    if geotecnico:
        geo_up = geotecnico.upper()
        filtered = [i for i in filtered if i.get("geotecnico", "").upper() == geo_up]
    if sector_geotecnico:
        sect_up = sector_geotecnico.upper()
        filtered = [i for i in filtered if i.get("sector_geotecnico", "").upper() == sect_up]
    if search:
        search_lower = search.lower()
        filtered = [i for i in filtered if search_lower in i.get("mensaje", "").lower() or search_lower in i.get("columna", "").lower() or search_lower in i.get("celda_padre", "").lower()]

    wb = openpyxl.Workbook()
    default_sheet = wb.active
    wb.remove(default_sheet)
    font_title = Font(name="Calibri", size=16, bold=True, color="1B365D")
    font_subtitle = Font(name="Calibri", size=10, italic=True, color="555555")
    font_section = Font(name="Calibri", size=11, bold=True, color="1B365D")
    font_header = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    font_bold = Font(name="Calibri", size=10, bold=True, color="000000")
    font_regular = Font(name="Calibri", size=10, color="000000")
    fill_primary = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    fill_accent_green = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
    fill_accent_yellow = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
    fill_accent_orange = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
    fill_accent_red = PatternFill(start_color="F2DCDB", end_color="F2DCDB", fill_type="solid")
    border_thin = Border(left=Side(style='thin', color='D9D9D9'), right=Side(style='thin', color='D9D9D9'), top=Side(style='thin', color='D9D9D9'), bottom=Side(style='thin', color='D9D9D9'))
    alignment_center = Alignment(horizontal="center", vertical="center")
    alignment_left = Alignment(horizontal="left", vertical="center")
    alignment_right = Alignment(horizontal="right", vertical="center")

    ws1 = wb.create_sheet(title="Resumen Ejecutivo")
    ws1.views.sheetView[0].showGridLines = True
    ws1.cell(row=2, column=2, value="AUDITORÍA DE INTEGRIDAD GEOTÉCNICA").font = font_title
    ws1.cell(row=3, column=2, value="Reporte consolidado del estado de consistencia física y lógica").font = font_subtitle
    meta_rows = [
        ("Archivo Auditado:", compact.get("nombre_archivo", "N/A")),
        ("Fecha de Auditoría:", compact.get("fecha_auditoria", "N/A")),
        ("Celdas Padre Evaluadas:", safe_int(compact.get("familia1", {}).get("num_celdas_padre", 0))),
        ("Total de Estructuras (Filas):", safe_int(compact.get("familia1", {}).get("total_discontinuidades", 0))),
        ("Total de Datos (Campos):", safe_int(compact.get("familia2", {}).get("total_fields", 0)))
    ]
    start_row = 5
    for label, val in meta_rows:
        c1 = ws1.cell(row=start_row, column=2, value=label)
        c1.font = font_bold
        c1.border = border_thin
        c2 = ws1.cell(row=start_row, column=3, value=val)
        c2.font = font_regular
        c2.border = border_thin
        if isinstance(val, (int, float)):
            c2.number_format = '#,##0'
            c2.alignment = alignment_right
        start_row += 1

    ws1.cell(row=11, column=2, value="MÉTRICAS DE ESTRUCTURAS Y CELDAS").font = font_section
    header_row = 12
    cols = ["Métrica", "Valor", "Descripción"]
    for idx, col in enumerate(cols, start=2):
        cell = ws1.cell(row=header_row, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    fam1 = compact.get("familia1", {})
    general_metrics = [
        ("Celdas Padre", safe_int(fam1.get("num_celdas_padre", 0)), "Estaciones totales auditadas"),
        ("Promedio de Capas Hijas", safe_float(fam1.get("promedio_hijas", 0)), "Estructuras promedio por estación"),
        ("Total de Estructuras Mapeadas", safe_int(fam1.get("total_discontinuidades", 0)), "Total de filas de discontinuidades")
    ]
    curr_row = 13
    for m, v, d in general_metrics:
        ws1.cell(row=curr_row, column=2, value=m).font = font_regular
        ws1.cell(row=curr_row, column=2).border = border_thin
        val_cell = ws1.cell(row=curr_row, column=3, value=v)
        val_cell.font = font_bold
        val_cell.border = border_thin
        val_cell.alignment = alignment_right
        if isinstance(v, int): val_cell.number_format = '#,##0'
        elif isinstance(v, float): val_cell.number_format = '#,##0.00'
        ws1.cell(row=curr_row, column=4, value=d).font = font_regular
        ws1.cell(row=curr_row, column=4).border = border_thin
        curr_row += 1

    ws1.cell(row=17, column=2, value="AUDITORÍA DE DATOS INDIVIDUALES (CAMPOS)").font = font_section
    header_row = 18
    for idx, col in enumerate(["Estado de Campo", "Cantidad de Campos", "Porcentaje", "Acción Recomendada"], start=2):
        cell = ws1.cell(row=header_row, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    fam2 = compact.get("familia2", {})
    total_fields = max(1, safe_int(fam2.get("total_fields", 1)))
    fields_metrics = [
        ("Campos OK", safe_int(fam2.get("total_correctos", 0)), fill_accent_green, "Datos validados, listos para análisis geomecánico"),
        ("Campos Vacíos", safe_int(fam2.get("total_vacios", 0)), fill_accent_yellow, "Completar celdas obligatorias según scanline"),
        ("Advertencias", safe_int(fam2.get("total_advertencias", 0)), fill_accent_orange, "Revisar posibles inconsistencias lógicas"),
        ("Alertas Críticas", safe_int(fam2.get("total_alertas", 0)), fill_accent_red, "Corregir inmediatamente para evitar distorsión RMR")
    ]
    curr_row = 19
    for name, qty, fill, rcmd in fields_metrics:
        ws1.cell(row=curr_row, column=2, value=name).font = font_regular
        ws1.cell(row=curr_row, column=2).border = border_thin
        qty_cell = ws1.cell(row=curr_row, column=3, value=qty)
        qty_cell.font = font_bold
        qty_cell.border = border_thin
        qty_cell.alignment = alignment_right
        qty_cell.number_format = '#,##0'
        pct_cell = ws1.cell(row=curr_row, column=4, value=qty / total_fields)
        pct_cell.font = font_bold
        pct_cell.border = border_thin
        pct_cell.alignment = alignment_right
        pct_cell.number_format = '0.00%'
        rc_cell = ws1.cell(row=curr_row, column=5, value=rcmd)
        rc_cell.font = font_regular
        rc_cell.border = border_thin
        rc_cell.fill = fill
        curr_row += 1

    ws1.cell(row=24, column=2, value="AUDITORÍA POR ESTRUCTURAS (FILAS)").font = font_section
    header_row = 25
    for idx, col in enumerate(["Estado de Estructura", "Cantidad de Filas", "Porcentaje", "Efecto en Calidad de Base de Datos"], start=2):
        cell = ws1.cell(row=header_row, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    fam3 = compact.get("familia3", {})
    total_discs = max(1, safe_int(fam3.get("total_discontinuidades", 1)))
    discs_metrics = [
        ("Filas 100% OK", safe_int(fam3.get("discontinuidades_correctas", 0)), fill_accent_green, "Integridad de registros geomecánicos perfecta"),
        ("Filas con Vacíos", safe_int(fam3.get("discontinuidades_vacios", 0)), fill_accent_yellow, "Registros incompletos con datos vacíos"),
        ("Filas con Advertencias", safe_int(fam3.get("discontinuidades_advertencias", 0)), fill_accent_orange, "Registros con desvíos leves de consistencia"),
        ("Filas con Alertas", safe_int(fam3.get("discontinuidades_alertas", 0)), fill_accent_red, "Incompatibilidad física o geométrica grave detectada")
    ]
    curr_row = 26
    for name, qty, fill, eff in discs_metrics:
        ws1.cell(row=curr_row, column=2, value=name).font = font_regular
        ws1.cell(row=curr_row, column=2).border = border_thin
        qty_cell = ws1.cell(row=curr_row, column=3, value=qty)
        qty_cell.font = font_bold
        qty_cell.border = border_thin
        qty_cell.alignment = alignment_right
        qty_cell.number_format = '#,##0'
        pct_cell = ws1.cell(row=curr_row, column=4, value=qty / total_discs)
        pct_cell.font = font_bold
        pct_cell.border = border_thin
        pct_cell.alignment = alignment_right
        pct_cell.number_format = '0.00%'
        eff_cell = ws1.cell(row=curr_row, column=5, value=eff)
        eff_cell.font = font_regular
        eff_cell.border = border_thin
        eff_cell.fill = fill
        curr_row += 1

    ws2 = wb.create_sheet(title="Distribuciones & Celdas")
    ws2.views.sheetView[0].showGridLines = True
    ws2.cell(row=2, column=2, value="DISTRIBUCIÓN POR CAMPAÑA DE LOGUEO (AÑO)").font = font_section
    r_cam = 3
    for idx, col in enumerate(["Campaña", "Discontinuidades", "Alertas (cant)", "Alertas (%)", "Vacíos (cant)", "Vacíos (%)"], start=2):
        cell = ws2.cell(row=r_cam, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin
    for row in compact.get("distribucion_campania", []):
        r_cam += 1
        ws2.cell(row=r_cam, column=2, value=row.get("campania")).font = font_bold
        ws2.cell(row=r_cam, column=3, value=safe_int(row.get("discontinuidades"))).font = font_regular
        ws2.cell(row=r_cam, column=4, value=safe_int(row.get("alertas_cant"))).font = font_regular
        ws2.cell(row=r_cam, column=5, value=safe_float(row.get("alertas_pct")) / 100.0).font = font_regular
        ws2.cell(row=r_cam, column=6, value=safe_int(row.get("vacios_cant"))).font = font_regular
        ws2.cell(row=r_cam, column=7, value=safe_float(row.get("vacios_pct")) / 100.0).font = font_regular
        ws2.cell(row=r_cam, column=2).alignment = alignment_center
        ws2.cell(row=r_cam, column=3).number_format = '#,##0'
        ws2.cell(row=r_cam, column=3).alignment = alignment_right
        ws2.cell(row=r_cam, column=4).number_format = '#,##0'
        ws2.cell(row=r_cam, column=4).alignment = alignment_right
        ws2.cell(row=r_cam, column=5).number_format = '0.00%'
        ws2.cell(row=r_cam, column=5).alignment = alignment_right
        ws2.cell(row=r_cam, column=6).number_format = '#,##0'
        ws2.cell(row=r_cam, column=6).alignment = alignment_right
        ws2.cell(row=r_cam, column=7).number_format = '0.00%'
        ws2.cell(row=r_cam, column=7).alignment = alignment_right
        for col_idx in range(2, 8): ws2.cell(row=r_cam, column=col_idx).border = border_thin

    r_sec = r_cam + 3
    ws2.cell(row=r_sec-1, column=2, value="DISTRIBUCIÓN POR SECTOR GEOTÉCNICO").font = font_section
    for idx, col in enumerate(["Sector", "Discontinuidades", "Alertas (cant)", "Alertas (%)", "Vacíos (cant)", "Vacíos (%)"], start=2):
        cell = ws2.cell(row=r_sec, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin
    for row in compact.get("distribucion_sector", []):
        r_sec += 1
        ws2.cell(row=r_sec, column=2, value=row.get("sector")).font = font_bold
        ws2.cell(row=r_sec, column=3, value=safe_int(row.get("discontinuidades"))).font = font_regular
        ws2.cell(row=r_sec, column=4, value=safe_int(row.get("alertas_cant"))).font = font_regular
        ws2.cell(row=r_sec, column=5, value=safe_float(row.get("alertas_pct")) / 100.0).font = font_regular
        ws2.cell(row=r_sec, column=6, value=safe_int(row.get("vacios_cant"))).font = font_regular
        ws2.cell(row=r_sec, column=7, value=safe_float(row.get("vacios_pct")) / 100.0).font = font_regular
        ws2.cell(row=r_sec, column=2).alignment = alignment_center
        ws2.cell(row=r_sec, column=3).number_format = '#,##0'
        ws2.cell(row=r_sec, column=3).alignment = alignment_right
        ws2.cell(row=r_sec, column=4).number_format = '#,##0'
        ws2.cell(row=r_sec, column=4).alignment = alignment_right
        ws2.cell(row=r_sec, column=5).number_format = '0.00%'
        ws2.cell(row=r_sec, column=5).alignment = alignment_right
        ws2.cell(row=r_sec, column=6).number_format = '#,##0'
        ws2.cell(row=r_sec, column=6).alignment = alignment_right
        ws2.cell(row=r_sec, column=7).number_format = '0.00%'
        ws2.cell(row=r_sec, column=7).alignment = alignment_right
        for col_idx in range(2, 8): ws2.cell(row=r_sec, column=col_idx).border = border_thin

    r_geo = r_sec + 3
    ws2.cell(row=r_geo-1, column=2, value="CALIDAD DE REGISTRO POR GEOTÉCNICO / PERSONA").font = font_section
    for idx, col in enumerate(["Geotécnico", "Discontinuidades", "Alertas (cant)", "Alertas (%)", "Vacíos (cant)", "Vacíos (%)"], start=2):
        cell = ws2.cell(row=r_geo, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin
    for row in compact.get("distribucion_geotecnico", []):
        r_geo += 1
        ws2.cell(row=r_geo, column=2, value=row.get("geotecnico")).font = font_bold
        ws2.cell(row=r_geo, column=3, value=safe_int(row.get("discontinuidades"))).font = font_regular
        ws2.cell(row=r_geo, column=4, value=safe_int(row.get("alertas_cant"))).font = font_regular
        ws2.cell(row=r_geo, column=5, value=safe_float(row.get("alertas_pct")) / 100.0).font = font_regular
        ws2.cell(row=r_geo, column=6, value=safe_int(row.get("vacios_cant"))).font = font_regular
        ws2.cell(row=r_geo, column=7, value=safe_float(row.get("vacios_pct")) / 100.0).font = font_regular
        ws2.cell(row=r_geo, column=2).alignment = alignment_center
        ws2.cell(row=r_geo, column=3).number_format = '#,##0'
        ws2.cell(row=r_geo, column=3).alignment = alignment_right
        ws2.cell(row=r_geo, column=4).number_format = '#,##0'
        ws2.cell(row=r_geo, column=4).alignment = alignment_right
        ws2.cell(row=r_geo, column=5).number_format = '0.00%'
        ws2.cell(row=r_geo, column=5).alignment = alignment_right
        ws2.cell(row=r_geo, column=6).number_format = '#,##0'
        ws2.cell(row=r_geo, column=6).alignment = alignment_right
        ws2.cell(row=r_geo, column=7).number_format = '0.00%'
        ws2.cell(row=r_geo, column=7).alignment = alignment_right
        for col_idx in range(2, 8): ws2.cell(row=r_geo, column=col_idx).border = border_thin

    r_worst = r_geo + 3
    ws2.cell(row=r_worst-1, column=2, value="PEORES CELDAS DE ESTACIÓN (MAYOR ACUMULACIÓN DE OBSERVACIONES)").font = font_section
    for idx, col in enumerate(["Estación (Celda)", "Total Hijas", "Vacíos", "Advertencias", "Alertas", "Calificación"], start=2):
        cell = ws2.cell(row=r_worst, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin
    for row in compact.get("worst_cells", []):
        r_worst += 1
        ws2.cell(row=r_worst, column=2, value=row.get("celda")).font = font_bold
        ws2.cell(row=r_worst, column=3, value=safe_int(row.get("total_hijas"))).font = font_regular
        ws2.cell(row=r_worst, column=4, value=safe_int(row.get("vacios"))).font = font_regular
        ws2.cell(row=r_worst, column=5, value=safe_int(row.get("advertencias"))).font = font_regular
        ws2.cell(row=r_worst, column=6, value=safe_int(row.get("alertas"))).font = font_regular
        status = row.get("estado_celda", "OK")
        status_cell = ws2.cell(row=r_worst, column=7, value=status)
        status_cell.font = font_bold
        if status == "ALERTA": status_cell.fill = fill_accent_red
        elif status == "ADVERTENCIA": status_cell.fill = fill_accent_orange
        else: status_cell.fill = fill_accent_green
        ws2.cell(row=r_worst, column=2).alignment = alignment_center
        ws2.cell(row=r_worst, column=3).number_format = '#,##0'
        ws2.cell(row=r_worst, column=3).alignment = alignment_right
        ws2.cell(row=r_worst, column=4).number_format = '#,##0'
        ws2.cell(row=r_worst, column=4).alignment = alignment_right
        ws2.cell(row=r_worst, column=5).number_format = '#,##0'
        ws2.cell(row=r_worst, column=5).alignment = alignment_right
        ws2.cell(row=r_worst, column=6).number_format = '#,##0'
        ws2.cell(row=r_worst, column=6).alignment = alignment_right
        ws2.cell(row=r_worst, column=7).alignment = alignment_center
        for col_idx in range(2, 8): ws2.cell(row=r_worst, column=col_idx).border = border_thin

    ws3 = wb.create_sheet(title="Top Frecuencia de Errores")
    ws3.views.sheetView[0].showGridLines = True
    ws3.cell(row=2, column=2, value="ALERTAS CRÍTICAS CON MAYOR CANTIDAD DE OCURRENCIAS").font = font_section
    r_err = 3
    for idx, col in enumerate(["Ranking", "Mensaje de Alerta Crítica", "Ocurrencias", "Porcentaje (%)"], start=2):
        cell = ws3.cell(row=r_err, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin
    for i_idx, item in enumerate(compact.get("error_types_detailed", {}).get("alertas", [])):
        r_err += 1
        ws3.cell(row=r_err, column=2, value=i_idx+1).font = font_bold
        ws3.cell(row=r_err, column=3, value=item.get("mensaje")).font = font_regular
        ws3.cell(row=r_err, column=4, value=safe_int(item.get("cantidad"))).font = font_regular
        ws3.cell(row=r_err, column=5, value=safe_float(item.get("pct")) / 100.0).font = font_regular
        ws3.cell(row=r_err, column=2).alignment = alignment_center
        ws3.cell(row=r_err, column=4).number_format = '#,##0'
        ws3.cell(row=r_err, column=4).alignment = alignment_right
        ws3.cell(row=r_err, column=5).number_format = '0.00%'
        ws3.cell(row=r_err, column=5).alignment = alignment_right
        for col_idx in range(2, 6):
            cell_border = ws3.cell(row=r_err, column=col_idx)
            cell_border.border = border_thin
            if i_idx < 3: cell_border.fill = fill_accent_red

    r_warn = r_err + 3
    ws3.cell(row=r_warn-1, column=2, value="ADVERTENCIAS DE CONSISTENCIA CON MAYOR CANTIDAD DE OCURRENCIAS").font = font_section
    for idx, col in enumerate(["Ranking", "Mensaje de Advertencia", "Ocurrencias", "Porcentaje (%)"], start=2):
        cell = ws3.cell(row=r_warn, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin
    for i_idx, item in enumerate(compact.get("error_types_detailed", {}).get("advertencias", [])):
        r_warn += 1
        ws3.cell(row=r_warn, column=2, value=i_idx+1).font = font_bold
        ws3.cell(row=r_warn, column=3, value=item.get("mensaje")).font = font_regular
        ws3.cell(row=r_warn, column=4, value=safe_int(item.get("cantidad"))).font = font_regular
        ws3.cell(row=r_warn, column=5, value=safe_float(item.get("pct")) / 100.0).font = font_regular
        ws3.cell(row=r_warn, column=2).alignment = alignment_center
        ws3.cell(row=r_warn, column=4).number_format = '#,##0'
        ws3.cell(row=r_warn, column=4).alignment = alignment_right
        ws3.cell(row=r_warn, column=5).number_format = '0.00%'
        ws3.cell(row=r_warn, column=5).alignment = alignment_right
        for col_idx in range(2, 6):
            cell_border = ws3.cell(row=r_warn, column=col_idx)
            cell_border.border = border_thin
            if i_idx < 3: cell_border.fill = fill_accent_orange

    ws4 = wb.create_sheet(title="Listado Incidencias Detalle")
    ws4.views.sheetView[0].showGridLines = True
    ws4.cell(row=2, column=2, value="DETALLE INDIVIDUAL DE REGISTROS CON OBSERVACIONES (FILTRADO)").font = font_section
    ws4.cell(row=3, column=2, value="Listado dinámico según filtros cruzados").font = font_subtitle
    for idx, col in enumerate(headers_inc, start=2):
        cell = ws4.cell(row=5, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin
    limite_filas = 12000
    r_inc = 5
    for inc in filtered[:limite_filas]:
        r_inc += 1
        ws4.cell(row=r_inc, column=2, value=safe_int(inc.get("fila_excel"))).font = font_regular
        ws4.cell(row=r_inc, column=3, value=inc.get("celda_padre")).font = font_bold
        ws4.cell(row=r_inc, column=4, value=inc.get("celda_hija")).font = font_regular
        ws4.cell(row=r_inc, column=5, value=inc.get("campania")).font = font_regular
        ws4.cell(row=r_inc, column=6, value=inc.get("geotecnico")).font = font_regular
        ws4.cell(row=r_inc, column=7, value=inc.get("sector_geotecnico")).font = font_regular
        ws4.cell(row=r_inc, column=8, value=inc.get("columna")).font = font_regular
        val_act = inc.get("valor_actual")
        ws4.cell(row=r_inc, column=9, value=val_act if val_act is not None else "—").font = font_regular
        tipo_inc = inc.get("tipo_incidencia")
        tipo_cell = ws4.cell(row=r_inc, column=10, value=tipo_inc)
        tipo_cell.font = font_bold
        if tipo_inc == "ALERTA": tipo_cell.fill = fill_accent_red
        elif tipo_inc == "ADVERTENCIA": tipo_cell.fill = fill_accent_orange
        else: tipo_cell.fill = fill_accent_yellow
        ws4.cell(row=r_inc, column=11, value=inc.get("mensaje")).font = font_regular
        
        ws4.cell(row=r_inc, column=2).alignment = alignment_center
        ws4.cell(row=r_inc, column=3).alignment = alignment_center
        ws4.cell(row=r_inc, column=4).alignment = alignment_center
        ws4.cell(row=r_inc, column=5).alignment = alignment_center
        ws4.cell(row=r_inc, column=6).alignment = alignment_left
        ws4.cell(row=r_inc, column=7).alignment = alignment_center
        ws4.cell(row=r_inc, column=8).alignment = alignment_left
        ws4.cell(row=r_inc, column=9).alignment = alignment_center
        ws4.cell(row=r_inc, column=10).alignment = alignment_center
        ws4.cell(row=r_inc, column=11).alignment = alignment_left
        for col_idx in range(2, 12): ws4.cell(row=r_inc, column=col_idx).border = border_thin

    for ws in [ws1, ws2, ws3, ws4]:
        ws.column_dimensions['A'].width = 3
        for col_idx in range(2, ws.max_column + 1):
            vals = []
            for row_idx in range(1, min(100, ws.max_row + 1)):
                val = ws.cell(row=row_idx, column=col_idx).value
                if val is not None: vals.append(str(val))
            if not vals: continue
            max_len = max(len(v) for v in vals)
            col_letter = openpyxl.utils.get_column_letter(col_idx)
            ws.column_dimensions[col_letter].width = min(max(max_len + 4, 12), 48)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    filename = f"reporte_auditoria_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename}"})

@router.get("/geomecanica/reporte-markdown")
def descargar_reporte_markdown(
    tipo: str = None, celda: str = None, columna: str = None, campania: str = None,
    geotecnico: str = None, sector_geotecnico: str = None, search: str = None, audit_id: str = None
):
    if audit_id: raw_file = os.path.join(uploads_dir, "history", f"{audit_id}_diagnostico.json")
    else: raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
    if not os.path.exists(raw_file): raise HTTPException(status_code=404, detail="El diagnóstico solicitado no existe.")
    with open(raw_file, "r", encoding="utf-8") as f:
        diag = json.load(f)
    incidencias = diag.get("incidencias", [])
    filtered = incidencias
    if tipo: filtered = [i for i in filtered if i.get("tipo_incidencia") == tipo.upper()]
    if celda:
        celda_up = celda.upper()
        filtered = [i for i in filtered if i.get("celda_padre") == celda_up or i.get("celda_hija") == celda_up]
    if columna: filtered = [i for i in filtered if i.get("columna", "").upper() == columna.upper()]
    if campania: filtered = [i for i in filtered if i.get("campania") == campania]
    if geotecnico:
        geo_up = geotecnico.upper()
        filtered = [i for i in filtered if i.get("geotecnico", "").upper() == geo_up]
    if sector_geotecnico:
        sect_up = sector_geotecnico.upper()
        filtered = [i for i in filtered if i.get("sector_geotecnico", "").upper() == sect_up]
    if search:
        search_lower = search.lower()
        filtered = [i for i in filtered if search_lower in i.get("mensaje", "").lower() or search_lower in i.get("columna", "").lower()]
    md_content = ["# Reporte de Auditoria de Consistencia Geomecanica Detallado", f"**Generado el:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ", f"**Total Incidencias Coincidentes:** {len(filtered):,}  \n", "### Filtros Aplicados:", f"* **Tipo:** `{tipo or 'TODOS'}`", f"* **Columna:** `{columna or 'TODAS'}`", f"* **Estación:** `{celda or 'TODAS'}`", f"* **Campaña:** `{campania or 'TODAS'}`", f"* **Sector:** `{sector_geotecnico or 'TODOS'}`", f"* **Geotécnico:** `{geotecnico or 'TODOS'}`"]
    if search: md_content.append(f"* **Buscador:** `{search}`")
    md_content.extend(["\n---", "\n| Fila Excel | Celda Padre | Celda Hija | Columna | Valor Actual | Tipo | Mensaje de Retroalimentación |", "| :-: | :--- | :--- | :--- | :---: | :---: | :--- |"])
    for inc in filtered[:3000]:
        val = inc.get("valor_actual")
        md_content.append(f"| {inc.get('fila_excel', '—')} | {inc.get('celda_padre', '—')} | {inc.get('celda_hija', '—')} | {inc.get('columna', '—')} | {val if val is not None else '—'} | `{inc.get('tipo_incidencia')}` | {inc.get('mensaje', '—')} |")
    return StreamingResponse(io.BytesIO(("\n".join(md_content)).encode("utf-8")), media_type="text/markdown", headers={"Content-Disposition": "attachment; filename=reporte_auditoria_detallado.md"})