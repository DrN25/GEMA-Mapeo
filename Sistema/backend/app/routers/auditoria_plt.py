import os
import io
import json
import shutil
import openpyxl
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse, JSONResponse

from app.utils.plt_validator import validate_plt_excel
from app.core.audit_plt_helpers import (
    aggregate_plt_audit_metrics,
    get_plt_incidence_category_name,
)
from app.services.plt_excel_exporter import export_plt_audit_to_excel, generar_excel_reporte_plt

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
uploads_dir = os.path.join(BASE_DIR, "uploads")
plt_history_dir = os.path.join(uploads_dir, "plt_history")
os.makedirs(plt_history_dir, exist_ok=True)

# Archivo de caché de última auditoría PLT
LATEST_PLT_DIAG = os.path.join(uploads_dir, "plt_diagnostico_ultimo.json")
LATEST_PLT_COMPACT = os.path.join(uploads_dir, "plt_compact_ultimo.json")


@router.post("/auditoria/plt/upload")
async def upload_plt_audit_file(
    file: UploadFile = File(...),
    tolerance: float = Query(0.1, description="Tolerancia numérica para fórmulas (default: 0.1)"),
):
    """
    Recibe un archivo Excel (.xlsx / .xlsm) de Ensayos PLT, ejecuta la validación integral
    de 34 columnas y secuencias ABCD, y guarda el diagnóstico y resumen en caché.
    """
    if not file.filename.lower().endswith(('.xlsx', '.xlsm', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Formato no soportado. Solo se aceptan libros de Excel (.xlsx, .xlsm, .xls).",
        )

    print(f"\n[QAQC PLT] [CARGA] [{datetime.now().strftime('%H:%M:%S')}] Recibiendo archivo '{file.filename}'...")

    temp_path = os.path.join(plt_history_dir, f"temp_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)

        file_size_kb = len(content) / 1024.0
        print(f"[QAQC PLT] [ARCHIVO] Archivo temporal guardado ({file_size_kb:.1f} KB). Iniciando motor de validacion QAQC...")

        # Ejecutar motor de validación
        start_time = datetime.now()
        diag = validate_plt_excel(temp_path, tolerance=tolerance)
        elapsed_sec = (datetime.now() - start_time).total_seconds()

        # Guardar nombre de archivo en el diagnóstico
        diag["nombre_archivo"] = file.filename
        diag["fecha_auditoria"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

        # Generar métricas y KPIs
        metricas = aggregate_plt_audit_metrics(diag)
        metricas["nombre_archivo"] = file.filename

        # Guardar caché
        with open(LATEST_PLT_DIAG, "w", encoding="utf-8") as f:
            json.dump(diag, f, ensure_ascii=False, indent=2)

        with open(LATEST_PLT_COMPACT, "w", encoding="utf-8") as f:
            json.dump(metricas, f, ensure_ascii=False, indent=2)

        # Guardar en histórico
        hist_id = f"plt_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        hist_diag = os.path.join(plt_history_dir, f"{hist_id}_diag.json")
        hist_comp = os.path.join(plt_history_dir, f"{hist_id}_compact.json")
        with open(hist_diag, "w", encoding="utf-8") as f:
            json.dump(diag, f, ensure_ascii=False)
        with open(hist_comp, "w", encoding="utf-8") as f:
            json.dump(metricas, f, ensure_ascii=False)

        integ = metricas.get("integridad_celdas", {})
        print(
            f"[QAQC PLT] [EXITO] Validacion finalizada con exito en {elapsed_sec:.2f}s:\n"
            f"           - Registros procesados: {diag.get('total_filas_procesadas', 0)} | Celdas: {len(diag.get('resumen_por_celda', {}))}\n"
            f"           - Integridad global: {metricas.get('integridad_global_pct', 0.0):.2f}%\n"
            f"           - Alertas: {metricas.get('total_alertas', 0)} | Advertencias: {metricas.get('total_advertencias', 0)} | Vacios: {metricas.get('total_vacios', 0)}\n"
            f"           - Celdas ABCD: {integ.get('correctas_abcd', 0)} OK | {integ.get('desorden_abcd', 0)} desorden | {integ.get('incompletas_abcd', 0)} incompletas | {integ.get('excedentes_abcd', 0)} excedentes"
        )

        return JSONResponse(
            content={
                "status": "success",
                "message": "Auditoría PLT ejecutada correctamente",
                "filename": file.filename,
                "metricas": metricas,
            }
        )

    except Exception as e:
        print(f"[QAQC PLT] [ERROR] Error durante la auditoria PLT: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error durante la auditoría PLT: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.get("/auditoria/plt/resumen-ligero")
def get_plt_resumen_ligero(campania: Optional[str] = Query(None, description="Filtro opcional de campañas separadas por coma")):
    """
    Retorna los KPIs ejecutivos y estadísticas de la última auditoría PLT realizada.
    Soporta filtrado dinámico por campañas.
    """
    if not os.path.exists(LATEST_PLT_DIAG):
        raise HTTPException(status_code=404, detail="No hay ninguna auditoría PLT cargada en memoria.")

    with open(LATEST_PLT_DIAG, "r", encoding="utf-8") as f:
        diag = json.load(f)

    metricas = aggregate_plt_audit_metrics(diag, years_filter=campania)
    metricas["nombre_archivo"] = diag.get("nombre_archivo", "Planilla PLT")

    camp_log = campania if campania else "TODAS"
    print(f"[QAQC PLT] [CONSULTA] Resumen ligero consultado (Campanias: {camp_log}) -> {metricas.get('total_registros_evaluados', 0)} registros.")
    return JSONResponse(content=metricas)


@router.get("/auditoria/plt/incidencias-paginadas")
def get_plt_incidencias_paginadas(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    tipo_incidencia: Optional[str] = Query(None, description="ALERTA, ADVERTENCIA, VACIO"),
    rule_code: Optional[str] = Query(None, description="Código de regla específica"),
    campania: Optional[str] = Query(None, description="Filtro de campañas separadas por coma"),
    search: Optional[str] = Query(None, description="Búsqueda por texto en celda, columna o mensaje"),
):
    """
    Retorna la lista paginada y filtrada de inconsistencias encontradas en la auditoría PLT.
    """
    if not os.path.exists(LATEST_PLT_DIAG):
        raise HTTPException(status_code=404, detail="No hay ninguna auditoría PLT cargada en memoria.")

    with open(LATEST_PLT_DIAG, "r", encoding="utf-8") as f:
        diag = json.load(f)

    items = diag.get("incidencias", [])

    # Filtrar por campañas
    if campania:
        camps = [c.strip().upper() for c in campania.split(",") if c.strip()]
        if camps:
            items = [i for i in items if str(i.get("campania", "")).strip().upper() in camps]

    # Filtrar por severidad
    if tipo_incidencia and tipo_incidencia.upper() != "TODOS":
        items = [i for i in items if i.get("tipo_incidencia") == tipo_incidencia.upper()]

    # Filtrar por código de regla
    if rule_code:
        items = [i for i in items if i.get("rule_code") == rule_code]

    # Filtrar por búsqueda de texto
    if search:
        q = search.strip().upper()
        items = [
            i for i in items
            if q in str(i.get("celda_mapeo", i.get("celda_padre", ""))).upper()
            or q in str(i.get("muestra", i.get("celda_hija", ""))).upper()
            or q in str(i.get("columna", "")).upper()
            or q in str(i.get("mensaje", "")).upper()
            or q in str(i.get("rule_code", "")).upper()
            or q in str(i.get("tipo_litologico", "")).upper()
        ]

    total_items = len(items)
    total_pages = max(1, (total_items + limit - 1) // limit)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    page_items = items[start_idx:end_idx]

    return JSONResponse(
        content={
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages,
            "items": page_items,
        }
    )


@router.get("/auditoria/plt/reporte-excel")
def download_plt_excel_report(campania: Optional[str] = Query(None)):
    """
    Genera y descarga el libro Excel (.xlsx) profesional multi-hoja con Dashboard Ejecutivo,
    Catálogo de Errores, Integridad de Celdas e Incidencias Detalladas.
    """
    if not os.path.exists(LATEST_PLT_DIAG):
        raise HTTPException(status_code=404, detail="No hay ninguna auditoría PLT cargada en memoria.")

    print(f"\n[QAQC PLT] [REPORTE] Generando reporte Excel profesional multi-hoja...")
    start_time = datetime.now()

    with open(LATEST_PLT_DIAG, "r", encoding="utf-8") as f:
        diag = json.load(f)

    compact = aggregate_plt_audit_metrics(diag, years_filter=campania)
    filtered = diag.get("incidencias", [])

    if campania:
        camps = [c.strip().upper() for c in campania.split(",") if c.strip()]
        if camps:
            filtered = [i for i in filtered if str(i.get("campania", "")).strip().upper() in camps]

    wb = export_plt_audit_to_excel(diag, compact, filtered)

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    elapsed_sec = (datetime.now() - start_time).total_seconds()
    size_kb = stream.getbuffer().nbytes / 1024.0
    filename = f"reporte_auditoria_qaqc_plt_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    print(f"[QAQC PLT] [ENVIADO] Reporte Excel generado ({size_kb:.1f} KB) en {elapsed_sec:.2f}s -> '{filename}'")

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/auditoria/plt/auditorias")
def list_plt_audit_history():
    """
    Lista el historial de todas las auditorías PLT procesadas en el sistema.
    """
    history = []
    if os.path.exists(plt_history_dir):
        for f in os.listdir(plt_history_dir):
            if f.endswith("_compact.json"):
                fpath = os.path.join(plt_history_dir, f)
                try:
                    with open(fpath, "r", encoding="utf-8") as fp:
                        data = json.load(fp)
                    audit_id = f.replace("_compact.json", "")
                    history.append({
                        "id": audit_id,
                        "fecha": data.get("fecha_auditoria", "—"),
                        "archivo": data.get("nombre_archivo", "Planilla PLT"),
                        "total_registros": data.get("total_registros_evaluados", data.get("familia1", {}).get("total_registros", 0)),
                        "total_alertas": data.get("total_alertas", 0),
                        "total_advertencias": data.get("total_advertencias", 0),
                        "total_vacios": data.get("total_vacios", 0),
                    })
                except Exception:
                    pass

    # Ordenar por fecha descendente
    history.sort(key=lambda x: x["id"], reverse=True)
    return JSONResponse(content=history)
