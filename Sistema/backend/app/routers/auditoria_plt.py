"""
app/routers/auditoria_plt.py — Router de Endpoints para la Auditoría QA/QC de Ensayos PLT.
Maneja carga de archivos, cómputo de métricas, filtrado paginado y exportación de reportes Excel.
Incluye seguimiento detallado por consola en cada operación.
"""

import io
import json
import os
import shutil
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse, JSONResponse

from app.core.audit_plt_helpers import aggregate_plt_audit_metrics, get_plt_incidence_category_name
from app.services.plt_excel_exporter import generar_excel_reporte_plt
from app.utils.plt_validator import validate_plt_excel

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
uploads_dir = os.path.join(BASE_DIR, "uploads")
history_dir = os.path.join(uploads_dir, "history_plt")
os.makedirs(uploads_dir, exist_ok=True)
os.makedirs(history_dir, exist_ok=True)

DIAGNOSTICO_PLT_PATH = os.path.join(uploads_dir, "diagnostico_plt.json")
RESUMEN_LIGERO_PLT_PATH = os.path.join(uploads_dir, "resumen_plt_ligero.json")


@router.post("/auditoria/plt/upload")
async def upload_plt_audit_file(
    file: UploadFile = File(...),
    tolerance: float = Query(0.1, description="Tolerancia para validación de fórmulas numéricas")
):
    """
    Recibe un archivo Excel (.xlsx / .xlsm) de Ensayos PLT, ejecuta la validación QAQC
    y genera el diagnóstico y resumen ligero para el frontend.
    """
    t_start = time.time()
    print(f"\n[QAQC PLT] 📥 [{datetime.now().strftime('%H:%M:%S')}] Recibiendo archivo '{file.filename}'...")

    if not file.filename.endswith((".xlsx", ".xls", ".xlsm")):
        print(f"[QAQC PLT] ❌ Formato inválido: {file.filename}")
        raise HTTPException(status_code=400, detail="Formato de archivo no soportado. Debe ser un Excel (.xlsx, .xlsm, .xls).")

    temp_path = os.path.join(uploads_dir, f"temp_plt_{int(time.time())}_{file.filename}")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size_kb = os.path.getsize(temp_path) / 1024.0
        print(f"[QAQC PLT] 📂 Archivo temporal guardado ({file_size_kb:.1f} KB). Iniciando motor de validación QAQC...")

        # Ejecutar validación QAQC
        diag = validate_plt_excel(temp_path, output_json_path=DIAGNOSTICO_PLT_PATH, tolerance=tolerance)
        compact = aggregate_plt_audit_metrics(diag)

        # Guardar resumen ligero
        with open(RESUMEN_LIGERO_PLT_PATH, "w", encoding="utf-8") as f:
            json.dump(compact, f, ensure_ascii=False, indent=2)

        # Guardar en histórico
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        hist_filename = f"diag_plt_{timestamp_str}_{file.filename}.json"
        shutil.copyfile(DIAGNOSTICO_PLT_PATH, os.path.join(history_dir, hist_filename))

        fam1 = compact.get("familia1", {})
        fam2 = compact.get("familia2", {})
        integ = compact.get("integridad_celdas", {})
        elapsed = time.time() - t_start

        print(f"[QAQC PLT] ✅ Validación finalizada con éxito en {elapsed:.2f}s:")
        print(f"           - Registros procesados: {fam1.get('total_registros', 0)} | Celdas: {fam1.get('total_celdas', 0)}")
        print(f"           - Integridad global: {fam2.get('pct_integridad', 0):.2f}%")
        print(f"           - Alertas: {fam2.get('total_alertas', 0)} | Advertencias: {fam2.get('total_advertencias', 0)} | Vacíos: {fam2.get('total_vacios', 0)}")
        print(f"           - Celdas ABCD: {integ.get('correctas_abcd', 0)} OK | {integ.get('desorden_abcd', 0)} desorden | {integ.get('incompletas_abcd', 0)} incompletas | {integ.get('excedentes_abcd', 0)} excedentes")

        return {
            "status": "success",
            "message": "Auditoría PLT completada exitosamente.",
            "archivo": file.filename,
            "metricas": compact
        }
    except Exception as e:
        print(f"[QAQC PLT] ❌ Error durante la auditoría: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al procesar la auditoría PLT: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.get("/auditoria/plt/resumen-ligero")
def get_plt_resumen_ligero(campania: Optional[str] = Query(None, description="Filtro opcional de campañas separadas por coma")):
    """
    Retorna el resumen de KPIs y métricas agregadas de la auditoría PLT actual.
    Soporta filtrado dinámico por campañas.
    """
    if not os.path.exists(DIAGNOSTICO_PLT_PATH):
        raise HTTPException(status_code=404, detail="No hay ninguna auditoría PLT realizada previamente.")

    try:
        with open(DIAGNOSTICO_PLT_PATH, "r", encoding="utf-8") as f:
            diag = json.load(f)

        compact = aggregate_plt_audit_metrics(diag, campania)
        filt_label = campania if campania else "TODAS"
        print(f"[QAQC PLT] 📊 Resumen ligero consultado (Campañas: {filt_label}) -> {compact['familia1']['total_registros']} registros.")
        return compact
    except Exception as e:
        print(f"[QAQC PLT] ❌ Error al calcular resumen: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al calcular resumen PLT: {str(e)}")


@router.get("/auditoria/plt/incidencias-paginadas")
def get_plt_incidencias_paginadas(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    tipo_incidencia: Optional[str] = Query(None),
    rule_code: Optional[str] = Query(None),
    campania: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """
    Retorna la lista paginada de incidencias con filtros por tipo, regla, campaña o búsqueda por texto.
    """
    if not os.path.exists(DIAGNOSTICO_PLT_PATH):
        raise HTTPException(status_code=404, detail="No hay datos de auditoría PLT disponibles.")

    try:
        with open(DIAGNOSTICO_PLT_PATH, "r", encoding="utf-8") as f:
            diag = json.load(f)

        incidencias = diag.get("incidencias", [])

        # Filtros
        if tipo_incidencia and tipo_incidencia.upper() not in ("TODOS", "ALL", ""):
            incidencias = [i for i in incidencias if str(i.get("tipo_incidencia")).upper() == tipo_incidencia.upper()]

        if rule_code and rule_code not in ("TODOS", "ALL", ""):
            incidencias = [i for i in incidencias if i.get("rule_code") == rule_code]

        if campania and campania not in ("TODOS", "ALL", ""):
            camps = [c.strip() for c in campania.split(",") if c.strip()]
            incidencias = [i for i in incidencias if str(i.get("campania")) in camps]

        if search:
            q = search.strip().upper()
            incidencias = [
                i for i in incidencias
                if q in str(i.get("celda_mapeo", "")).upper()
                or q in str(i.get("columna", "")).upper()
                or q in str(i.get("mensaje", "")).upper()
                or q in str(i.get("valor_actual", "")).upper()
            ]

        total_items = len(incidencias)
        total_pages = max(1, (total_items + limit - 1) // limit)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paged_items = incidencias[start_idx:end_idx]

        print(f"[QAQC PLT] 📄 Incidencias paginadas -> Pág {page}/{total_pages} (Total: {total_items} filtradas)")

        return {
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages,
            "items": paged_items
        }
    except Exception as e:
        print(f"[QAQC PLT] ❌ Error en paginación: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener incidencias paginadas: {str(e)}")


@router.get("/auditoria/plt/reporte-excel")
def download_plt_excel_report(campania: Optional[str] = Query(None)):
    """
    Genera y descarga el reporte Excel profesional (.xlsx) con Dashboard Ejecutivo,
    Integridad ABCD, Catálogo de Errores e Incidencias Detalladas.
    """
    t_start = time.time()
    print(f"\n[QAQC PLT] 📤 Generando reporte Excel profesional multi-hoja...")
    if not os.path.exists(DIAGNOSTICO_PLT_PATH):
        raise HTTPException(status_code=404, detail="No hay datos de auditoría PLT para generar el reporte.")

    try:
        with open(DIAGNOSTICO_PLT_PATH, "r", encoding="utf-8") as f:
            diag = json.load(f)

        compact = aggregate_plt_audit_metrics(diag, campania)
        stream = generar_excel_reporte_plt(diag, compact, campania)
        size_kb = len(stream.getvalue()) / 1024.0
        elapsed = time.time() - t_start

        filename = f"reporte_auditoria_qaqc_plt_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
        print(f"[QAQC PLT] 🚀 Reporte Excel generado ({size_kb:.1f} KB) en {elapsed:.2f}s -> '{filename}'")

        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        print(f"[QAQC PLT] ❌ Error generando reporte Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al generar reporte Excel PLT: {str(e)}")


@router.get("/auditoria/plt/auditorias")
def list_plt_audit_history():
    """
    Lista el historial de auditorías PLT procesadas previamente.
    """
    if not os.path.exists(history_dir):
        return []

    history = []
    for fn in os.listdir(history_dir):
        if fn.endswith(".json"):
            fp = os.path.join(history_dir, fn)
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    data = json.load(f)
                stat = os.stat(fp)
                history.append({
                    "id": fn,
                    "archivo": data.get("nombre_archivo", fn),
                    "fecha": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                    "total_registros": data.get("metricas_globales", {}).get("total_registros", 0),
                    "total_alertas": data.get("metricas_globales", {}).get("total_alertas", 0),
                    "total_advertencias": data.get("metricas_globales", {}).get("total_advertencias", 0),
                    "total_vacios": data.get("metricas_globales", {}).get("total_vacios", 0),
                })
            except Exception:
                continue

    history.sort(key=lambda x: x["fecha"], reverse=True)
    return history
