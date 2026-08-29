"""
app/routers/auditoria_plt.py — Endpoints API para Auditoría QA/QC de Ensayos PLT Irregulares.
Incluye validación de 34 columnas, cálculo de KPIs, filtrado dinámico, pre-generación y persistencia de Excel en uploads/.
"""

import os
import io
import json
import shutil
import openpyxl
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse

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

# Archivos de caché persistentes en uploads/
LATEST_PLT_DIAG = os.path.join(uploads_dir, "plt_diagnostico_ultimo.json")
LATEST_PLT_COMPACT = os.path.join(uploads_dir, "plt_compact_ultimo.json")
LATEST_PLT_EXCEL = os.path.join(uploads_dir, "plt_reporte_completo_ultimo.xlsx")


def _pregenerate_plt_excel(diag: dict, compact: dict, excel_out_path: str, public_out_path: str):
    """Genera y guarda el libro Excel completo en disco en segundo plano o de forma síncrona."""
    try:
        incidencias_list = diag.get("incidencias", [])
        wb = export_plt_audit_to_excel(diag, compact, incidencias_list)
        
        tmp_out = excel_out_path + ".tmp"
        wb.save(tmp_out)
        if os.path.exists(excel_out_path):
            try: os.remove(excel_out_path)
            except Exception: pass
        shutil.move(tmp_out, excel_out_path)

        tmp_pub = public_out_path + ".tmp"
        shutil.copyfile(excel_out_path, tmp_pub)
        if os.path.exists(public_out_path):
            try: os.remove(public_out_path)
            except Exception: pass
        shutil.move(tmp_pub, public_out_path)

        size_kb = os.path.getsize(excel_out_path) / 1024.0
        print(f"[QAQC PLT] [PRE-GENERACIÓN EXCEL] Reporte Excel guardado en disco ({size_kb:.1f} KB) -> '{os.path.basename(excel_out_path)}'")
    except Exception as e:
        print(f"[QAQC PLT] [ERROR PRE-GENERACIÓN] Error al generar Excel: {e}")


@router.post("/auditoria/plt/upload")
async def upload_plt_audit_file(
    file: UploadFile = File(...),
    tolerance: float = Query(0.1, description="Tolerancia numérica para fórmulas (default: 0.1)"),
):
    """
    Recibe un archivo Excel de Ensayos PLT, ejecuta la validación integral,
    guarda el diagnóstico, métricas compactas y pre-genera el reporte Excel (.xlsx) en uploads/.
    """
    if not file.filename.lower().endswith(('.xlsx', '.xlsm', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Formato no soportado. Solo se aceptan libros de Excel (.xlsx, .xlsm, .xls).",
        )

    print(f"\n[QAQC PLT] [CARGA] [{datetime.now().strftime('%H:%M:%S')}] Recibiendo archivo '{file.filename}'...")

    audit_id = f"plt_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    saved_excel_path = os.path.join(plt_history_dir, f"{audit_id}.xlsx")
    temp_path = os.path.join(plt_history_dir, f"temp_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")

    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)
        shutil.copyfile(temp_path, saved_excel_path)

        file_size_kb = len(content) / 1024.0
        print(f"[QAQC PLT] [ARCHIVO] Archivo guardado en uploads/plt_history ({file_size_kb:.1f} KB). Iniciando motor de validación QAQC...")

        # 1. Ejecutar motor de validación
        start_time = datetime.now()
        diag = validate_plt_excel(temp_path, tolerance=tolerance)
        elapsed_sec = (datetime.now() - start_time).total_seconds()

        diag["nombre_archivo"] = file.filename
        diag["fecha_auditoria"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        diag["audit_id"] = audit_id

        # 2. Generar métricas y KPIs
        metricas = aggregate_plt_audit_metrics(diag)
        metricas["nombre_archivo"] = file.filename
        metricas["fecha_auditoria"] = diag["fecha_auditoria"]
        metricas["audit_id"] = audit_id

        # 3. Guardar diagnóstico y resumen público en uploads/
        with open(LATEST_PLT_DIAG, "w", encoding="utf-8") as f:
            json.dump(diag, f, ensure_ascii=False, indent=2)

        with open(LATEST_PLT_COMPACT, "w", encoding="utf-8") as f:
            json.dump(metricas, f, ensure_ascii=False, indent=2)

        # 4. Guardar en histórico
        hist_diag = os.path.join(plt_history_dir, f"{audit_id}_diag.json")
        hist_comp = os.path.join(plt_history_dir, f"{audit_id}_compact.json")
        hist_excel = os.path.join(plt_history_dir, f"{audit_id}_reporte_completo.xlsx")

        with open(hist_diag, "w", encoding="utf-8") as f:
            json.dump(diag, f, ensure_ascii=False)
        with open(hist_comp, "w", encoding="utf-8") as f:
            json.dump(metricas, f, ensure_ascii=False)

        # 5. Pre-generar y guardar el reporte Excel (.xlsx) en uploads/
        _pregenerate_plt_excel(diag, metricas, hist_excel, LATEST_PLT_EXCEL)

        integ = metricas.get("integridad_celdas", {})
        print(
            f"[QAQC PLT] [ÉXITO] Validación finalizada con éxito en {elapsed_sec:.2f}s:\n"
            f"           - Registros procesados: {diag.get('total_filas_procesadas', 0)} | Celdas: {len(diag.get('resumen_por_celda', {}))}\n"
            f"           - Integridad global: {metricas.get('integridad_global_pct', 0.0):.2f}%\n"
            f"           - Alertas: {metricas.get('total_alertas', 0)} | Advertencias: {metricas.get('total_advertencias', 0)} | Vacíos: {metricas.get('total_vacios', 0)}\n"
            f"           - Celdas ABCD: {integ.get('correctas_abcd', 0)} OK | {integ.get('desorden_abcd', 0)} desorden | {integ.get('incompletas_abcd', 0)} incompletas | {integ.get('excedentes_abcd', 0)} excedentes\n"
            f"           - Reporte Excel pre-generado en: {hist_excel}"
        )

        return JSONResponse(
            content={
                "status": "success",
                "message": "Auditoría PLT ejecutada correctamente",
                "audit_id": audit_id,
                "filename": file.filename,
                "metricas": metricas,
            }
        )

    except Exception as e:
        print(f"[QAQC PLT] [ERROR] Error durante la auditoría PLT: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error durante la auditoría PLT: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.get("/auditoria/plt/status")
def get_plt_audit_status(audit_id: Optional[str] = Query(None)):
    """
    Estado ligero (~200 bytes) de la auditoría PLT para el polling del frontend y verificación de reporte Excel.
    """
    if audit_id:
        compact_file = os.path.join(plt_history_dir, f"{audit_id}_compact.json")
        reporte_file = os.path.join(plt_history_dir, f"{audit_id}_reporte_completo.xlsx")
    else:
        compact_file = LATEST_PLT_COMPACT
        reporte_file = LATEST_PLT_EXCEL

    if os.path.exists(compact_file):
        try:
            with open(compact_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            meta = {}
        return {
            "status": "listo",
            "reporte_listo": os.path.exists(reporte_file),
            "nombre_archivo": meta.get("nombre_archivo"),
            "fecha_auditoria": meta.get("fecha_auditoria"),
            "audit_id": meta.get("audit_id", audit_id),
        }

    if os.path.exists(LATEST_PLT_DIAG):
        return {"status": "procesando", "reporte_listo": False}

    raise HTTPException(status_code=404, detail="No se encontró ninguna auditoría PLT activa.")


@router.get("/auditoria/plt/resumen-ligero")
def get_plt_resumen_ligero(
    audit_id: Optional[str] = Query(None),
    campania: Optional[str] = Query(None, description="Filtro opcional de campañas separadas por coma"),
):
    """
    Retorna los KPIs ejecutivos y estadísticas de la auditoría PLT.
    Soporta filtrado dinámico por campañas y selección de histórico por audit_id.
    """
    if audit_id:
        diag_path = os.path.join(plt_history_dir, f"{audit_id}_diag.json")
    else:
        diag_path = LATEST_PLT_DIAG

    if not os.path.exists(diag_path):
        raise HTTPException(status_code=404, detail="No hay ninguna auditoría PLT cargada en memoria.")

    with open(diag_path, "r", encoding="utf-8") as f:
        diag = json.load(f)

    metricas = aggregate_plt_audit_metrics(diag, years_filter=campania)
    metricas["nombre_archivo"] = diag.get("nombre_archivo", "Planilla PLT")
    metricas["audit_id"] = diag.get("audit_id", audit_id)

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
    audit_id: Optional[str] = Query(None),
):
    """
    Retorna la lista paginada y filtrada de inconsistencias encontradas en la auditoría PLT.
    """
    if audit_id:
        diag_path = os.path.join(plt_history_dir, f"{audit_id}_diag.json")
    else:
        diag_path = LATEST_PLT_DIAG

    if not os.path.exists(diag_path):
        raise HTTPException(status_code=404, detail="No hay ninguna auditoría PLT cargada en memoria.")

    with open(diag_path, "r", encoding="utf-8") as f:
        diag = json.load(f)

    items = diag.get("incidencias", [])

    # Filtrar por campañas
    if campania:
        camps = [c.strip().upper() for c in campania.split(",") if c.strip()]
        if camps and "TODAS" not in camps:
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
def download_plt_excel_report(
    campania: Optional[str] = Query(None),
    audit_id: Optional[str] = Query(None),
):
    """
    Descarga el libro Excel (.xlsx) profesional multi-hoja con Dashboard Ejecutivo,
    Catálogo de Errores, Integridad de Celdas e Incidencias Detalladas.
    Si no hay filtros, descarga inmediatamente el archivo pre-generado guardado en uploads/.
    """
    if audit_id:
        pregenerated_file = os.path.join(plt_history_dir, f"{audit_id}_reporte_completo.xlsx")
        diag_path = os.path.join(plt_history_dir, f"{audit_id}_diag.json")
    else:
        pregenerated_file = LATEST_PLT_EXCEL
        diag_path = LATEST_PLT_DIAG

    is_filtered = bool(campania and campania.strip().upper() not in ["", "TODAS", "NONE", "NULL"])
    filename = f"reporte_auditoria_qaqc_plt_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    # Si no hay filtros y el archivo pre-generado existe en uploads, servir directamente
    if not is_filtered and os.path.exists(pregenerated_file):
        print(f"[QAQC PLT] [DESCARGA RÁPIDA] Sirviendo reporte pre-generado desde disco: {pregenerated_file}")
        return FileResponse(
            pregenerated_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename,
        )

    if not os.path.exists(diag_path):
        raise HTTPException(status_code=404, detail="No hay ninguna auditoría PLT cargada en memoria.")

    print(f"\n[QAQC PLT] [REPORTE] Generando reporte Excel con filtros...")
    start_time = datetime.now()

    with open(diag_path, "r", encoding="utf-8") as f:
        diag = json.load(f)

    compact = aggregate_plt_audit_metrics(diag, years_filter=campania)
    filtered = diag.get("incidencias", [])

    if campania:
        camps = [c.strip().upper() for c in campania.split(",") if c.strip()]
        if camps and "TODAS" not in camps:
            filtered = [i for i in filtered if str(i.get("campania", "")).strip().upper() in camps]

    wb = export_plt_audit_to_excel(diag, compact, filtered)

    # Si no había filtros, guardar también en disco
    if not is_filtered:
        os.makedirs(os.path.dirname(pregenerated_file), exist_ok=True)
        wb.save(pregenerated_file)
        if not audit_id:
            shutil.copyfile(pregenerated_file, LATEST_PLT_EXCEL)
        return FileResponse(
            pregenerated_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename,
        )

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    elapsed_sec = (datetime.now() - start_time).total_seconds()
    size_kb = stream.getbuffer().nbytes / 1024.0
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
                    with open(fpath, "r", encoding="utf-8") as file:
                        data = json.load(file)
                        history.append({
                            "audit_id": data.get("audit_id", f.replace("_compact.json", "")),
                            "nombre_archivo": data.get("nombre_archivo", "Planilla PLT"),
                            "fecha_auditoria": data.get("fecha_auditoria", "—"),
                            "total_registros": data.get("total_registros_evaluados", 0),
                            "integridad_global_pct": data.get("integridad_global_pct", 0.0),
                            "total_alertas": data.get("total_alertas", 0),
                            "total_advertencias": data.get("total_advertencias", 0),
                            "total_vacios": data.get("total_vacios", 0),
                        })
                except Exception:
                    pass

    history.sort(key=lambda x: str(x.get("audit_id", "")), reverse=True)
    return JSONResponse(content={"historial": history})
