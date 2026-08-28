"""
app/services/plt_excel_exporter.py — Generador de Reportes Excel QAQC para Ensayos PLT.
Construye un libro .xlsx multi-hoja con Dashboard Ejecutivo, Integridad ABCD,
Catálogo de Errores con enlaces bidireccionales, y Detalle de Incidencias.
Reutiliza la paleta y funciones de app.core.excel_styles.
"""

import io
import re
from collections import defaultdict
from typing import Dict, List, Optional

import openpyxl
from openpyxl.utils import get_column_letter

from app.core.audit_plt_helpers import get_plt_incidence_category_name, aggregate_plt_audit_metrics
from app.core.excel_styles import get_styles, write_kpi_card
from app.core.rules_plt import CATEGORIES_REGISTRY_PLT, RULES_REGISTRY_PLT


def _safe_sheet_title(name: str) -> str:
    """Sanea el nombre para cumplir los límites de nombres de hoja en Excel (máx 31 caracteres)."""
    clean = re.sub(r'[:\\/?*\[\]]', '_', name)
    return clean[:31].strip()


def generar_excel_reporte_plt(diag: dict, compact: Optional[dict] = None, years_filter: Optional[str] = None) -> io.BytesIO:
    """
    Genera el archivo Excel binario (.xlsx) con el reporte completo de auditoría QAQC PLT.
    """
    if compact is None:
        compact = aggregate_plt_audit_metrics(diag, years_filter)

    s = get_styles()
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Eliminar hoja default

    incidencias_raw = diag.get("incidencias", [])
    if years_filter and years_filter not in ("TODOS", "", "None", None):
        years_list = [y.strip() for y in str(years_filter).split(",") if y.strip()]
        incidencias = [i for i in incidencias_raw if str(i.get("campania")) in years_list]
    else:
        incidencias = incidencias_raw

    # =========================================================================
    # HOJA 1: Dashboard Ejecutivo PLT
    # =========================================================================
    ws_dash = wb.create_sheet(title="Dashboard Ejecutivo PLT")
    ws_dash.views.sheetView[0].showGridLines = True

    # Banner Título
    ws_dash.cell(row=2, column=2, value="AUDITORÍA QA/QC — ENSAYOS DE CARGA PUNTUAL (PLT)").font = s["font_title"]
    ws_dash.cell(row=3, column=2, value=f"Archivo: {diag.get('nombre_archivo', 'N/A')}  |  Fecha Evaluación: {compact.get('fecha_auditoria', '')}").font = s["font_subtitle"]

    # Tarjetas KPI (Fila 5 a 6)
    fam1 = compact.get("familia1", {})
    fam2 = compact.get("familia2", {})
    fam3 = compact.get("familia3", {})
    pct_int = fam2.get("pct_integridad", 100.0)

    font_kpi_pct = s["font_kpi_green"] if pct_int >= 95.0 else (s["font_kpi_orange"] if pct_int >= 80.0 else s["font_kpi_red"])

    write_kpi_card(ws_dash, 5, 2, "TOTAL REGISTROS", fam1.get("total_registros", 0), s["fill_kpi_gray"], s["font_kpi_blue"], s)
    write_kpi_card(ws_dash, 5, 4, "TOTAL CELDAS", fam1.get("total_celdas", 0), s["fill_kpi_gray"], s["font_kpi_blue"], s)
    write_kpi_card(ws_dash, 5, 6, "% INTEGRIDAD GLOBAL", f"{pct_int:.1f}%", s["fill_kpi_gray"], font_kpi_pct, s)
    write_kpi_card(ws_dash, 5, 8, "TOTAL ALERTAS", fam2.get("total_alertas", 0), s["fill_kpi_gray"], s["font_kpi_red"], s)
    write_kpi_card(ws_dash, 5, 10, "TOTAL ADVERTENCIAS", fam2.get("total_advertencias", 0), s["fill_kpi_gray"], s["font_kpi_orange"], s)
    write_kpi_card(ws_dash, 5, 12, "TOTAL VACÍOS", fam2.get("total_vacios", 0), s["fill_kpi_gray"], s["font_kpi_blue"], s)

    # Tarjetas Integridad Celdas ABCD (Fila 8 a 9)
    integ = compact.get("integridad_celdas", {})
    write_kpi_card(ws_dash, 8, 2, "CELDAS ABCD OK (4)", integ.get("correctas_abcd", 0), s["fill_green"], s["font_kpi_green"], s)
    write_kpi_card(ws_dash, 8, 4, "CELDAS EN DESORDEN", integ.get("desorden_abcd", 0), s["fill_yellow"], s["font_kpi_orange"], s)
    write_kpi_card(ws_dash, 8, 6, "CELDAS INCOMPLETAS (<4)", integ.get("incompletas_abcd", 0), s["fill_orange"], s["font_kpi_orange"], s)
    write_kpi_card(ws_dash, 8, 8, "CELDAS EXCEDENTES (>4)", integ.get("excedentes_abcd", 0), s["fill_red"], s["font_kpi_red"], s)
    write_kpi_card(ws_dash, 8, 10, "CELDAS ANÓMALAS", integ.get("anomalas_abcd", 0), s["fill_red"], s["font_kpi_red"], s)

    curr_row = 12

    # Tabla: Distribución por Campaña
    ws_dash.cell(row=curr_row, column=2, value="1. DISTRIBUCIÓN Y CALIDAD POR CAMPAÑA").font = s["font_section"]
    curr_row += 1

    headers_camp = ["Campaña", "Registros", "Celdas Afectadas", "Vacíos", "% Vacíos", "Advertencias", "% Advert.", "Alertas", "% Alertas"]
    for col_idx, h in enumerate(headers_camp, start=2):
        c = ws_dash.cell(row=curr_row, column=col_idx, value=h)
        c.font = s["font_header"]
        c.fill = s["fill_primary"]
        c.alignment = s["align_center"]
    curr_row += 1

    for row_data in compact.get("distribucion_campania", []):
        ws_dash.cell(row=curr_row, column=2, value=str(row_data.get("campania", ""))).alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=3, value=row_data.get("registros", 0)).alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=4, value=row_data.get("celdas_afectadas", 0)).alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=5, value=row_data.get("vacios_cant", 0)).alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=6, value=f"{row_data.get('vacios_pct', 0.0):.1f}%").alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=7, value=row_data.get("advertencias_cant", 0)).alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=8, value=f"{row_data.get('advertencias_pct', 0.0):.1f}%").alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=9, value=row_data.get("alertas_cant", 0)).alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=10, value=f"{row_data.get('alertas_pct', 0.0):.1f}%").alignment = s["align_center"]
        for c_idx in range(2, 11):
            ws_dash.cell(row=curr_row, column=c_idx).border = s["border_thin"]
            ws_dash.cell(row=curr_row, column=c_idx).font = s["font_regular"]
        curr_row += 1

    curr_row += 2

    # Tabla: Distribución por Tipo Litológico
    ws_dash.cell(row=curr_row, column=2, value="2. DISTRIBUCIÓN POR TIPO LITOLÓGICO").font = s["font_section"]
    curr_row += 1

    headers_lito = ["Tipo Litológico", "Registros", "Celdas Afectadas", "Vacíos", "% Vacíos", "Advertencias", "% Advert.", "Alertas", "% Alertas"]
    for col_idx, h in enumerate(headers_lito, start=2):
        c = ws_dash.cell(row=curr_row, column=col_idx, value=h)
        c.font = s["font_header"]
        c.fill = s["fill_primary"]
        c.alignment = s["align_center"]
    curr_row += 1

    for row_data in compact.get("distribucion_litologia", []):
        ws_dash.cell(row=curr_row, column=2, value=str(row_data.get("tipo_litologico", ""))).alignment = s["align_left"]
        ws_dash.cell(row=curr_row, column=3, value=row_data.get("registros", 0)).alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=4, value=row_data.get("celdas_afectadas", 0)).alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=5, value=row_data.get("vacios_cant", 0)).alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=6, value=f"{row_data.get('vacios_pct', 0.0):.1f}%").alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=7, value=row_data.get("advertencias_cant", 0)).alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=8, value=f"{row_data.get('advertencias_pct', 0.0):.1f}%").alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=9, value=row_data.get("alertas_cant", 0)).alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=10, value=f"{row_data.get('alertas_pct', 0.0):.1f}%").alignment = s["align_center"]
        for c_idx in range(2, 11):
            ws_dash.cell(row=curr_row, column=c_idx).border = s["border_thin"]
            ws_dash.cell(row=curr_row, column=c_idx).font = s["font_regular"]
        curr_row += 1

    curr_row += 2

    # Tabla: Top 5 Alertas Críticas
    ws_dash.cell(row=curr_row, column=2, value="3. PRINCIPALES ALERTAS DETECTADAS").font = s["font_section"]
    curr_row += 1

    ws_dash.cell(row=curr_row, column=2, value="Regla / Mensaje de Alerta").font = s["font_header"]
    ws_dash.cell(row=curr_row, column=2).fill = s["fill_primary"]
    ws_dash.cell(row=curr_row, column=7, value="Cantidad").font = s["font_header"]
    ws_dash.cell(row=curr_row, column=7).fill = s["fill_primary"]
    ws_dash.cell(row=curr_row, column=8, value="% del Total").font = s["font_header"]
    ws_dash.cell(row=curr_row, column=8).fill = s["fill_primary"]
    ws_dash.merge_cells(start_row=curr_row, start_column=2, end_row=curr_row, end_column=6)
    curr_row += 1

    for a in compact.get("top_5_alertas", []):
        c_msg = ws_dash.cell(row=curr_row, column=2, value=a.get("mensaje", ""))
        c_msg.alignment = s["align_left"]
        ws_dash.cell(row=curr_row, column=7, value=a.get("cantidad", 0)).alignment = s["align_center"]
        ws_dash.cell(row=curr_row, column=8, value=f"{a.get('pct', 0.0):.1f}%").alignment = s["align_center"]
        ws_dash.merge_cells(start_row=curr_row, start_column=2, end_row=curr_row, end_column=6)
        for c_idx in range(2, 9):
            ws_dash.cell(row=curr_row, column=c_idx).border = s["border_thin"]
            ws_dash.cell(row=curr_row, column=c_idx).font = s["font_regular"]
        curr_row += 1

    # Auto-ajuste de columnas para Dashboard
    for col in ws_dash.columns:
        col_letter = get_column_letter(col[0].column)
        ws_dash.column_dimensions[col_letter].width = 18

    # =========================================================================
    # HOJA 2: Integridad Celdas (ABCD)
    # =========================================================================
    ws_cells = wb.create_sheet(title="Integridad Celdas (ABCD)")
    ws_cells.views.sheetView[0].showGridLines = True

    ws_cells.cell(row=1, column=1, value="EVALUACIÓN DE INTEGRIDAD DE SECUENCIAS ABCD POR CELDA").font = s["font_title"]
    ws_cells.cell(row=2, column=1, value="Verifica que cada celda de mapeo contenga exactamente 4 muestras en secuencia estricta A-B-C-D").font = s["font_subtitle"]

    headers_int = ["Celda Mapeo", "Fecha Ensayo", "Campaña", "Tipo Litológico", "Nivel", "Muestras", "Secuencia", "Estado Secuencia", "Alertas", "Advertencias", "Vacíos"]
    for c_idx, h in enumerate(headers_int, start=1):
        c = ws_cells.cell(row=4, column=c_idx, value=h)
        c.font = s["font_header"]
        c.fill = s["fill_primary"]
        c.alignment = s["align_center"]

    r_cell = 5
    resumen_celdas = compact.get("resumen_por_celda", {})
    for c_key, c_val in resumen_celdas.items():
        est = c_val.get("estado_secuencia", "")
        fill_color = s["fill_green"] if "CORRECTO" in est else (s["fill_yellow"] if "ORDEN" in est else s["fill_orange"])

        ws_cells.cell(row=r_cell, column=1, value=c_val.get("celda", "")).alignment = s["align_left"]
        ws_cells.cell(row=r_cell, column=2, value=c_val.get("fecha", "")).alignment = s["align_center"]
        ws_cells.cell(row=r_cell, column=3, value=str(c_val.get("campania", ""))).alignment = s["align_center"]
        ws_cells.cell(row=r_cell, column=4, value=str(c_val.get("tipo_litologico", ""))).alignment = s["align_left"]
        ws_cells.cell(row=r_cell, column=5, value=c_val.get("nivel", "")).alignment = s["align_center"]
        ws_cells.cell(row=r_cell, column=6, value=c_val.get("total_muestras", 0)).alignment = s["align_center"]
        ws_cells.cell(row=r_cell, column=7, value=c_val.get("secuencia", "")).alignment = s["align_center"]

        c_est = ws_cells.cell(row=r_cell, column=8, value=est)
        c_est.alignment = s["align_center"]
        c_est.fill = fill_color
        c_est.font = s["font_bold"]

        ws_cells.cell(row=r_cell, column=9, value=c_val.get("alertas", 0)).alignment = s["align_center"]
        ws_cells.cell(row=r_cell, column=10, value=c_val.get("advertencias", 0)).alignment = s["align_center"]
        ws_cells.cell(row=r_cell, column=11, value=c_val.get("vacios", 0)).alignment = s["align_center"]

        for c_idx in range(1, 12):
            ws_cells.cell(row=r_cell, column=c_idx).border = s["border_thin"]
            if c_idx != 8:
                ws_cells.cell(row=r_cell, column=c_idx).font = s["font_regular"]
        r_cell += 1

    for col in ws_cells.columns:
        col_letter = get_column_letter(col[0].column)
        ws_cells.column_dimensions[col_letter].width = 16

    # =========================================================================
    # Agrupación por Regla / Categoría de Incidencias
    # =========================================================================
    cat_incidencias: Dict[str, List[dict]] = defaultdict(list)
    for inc in incidencias:
        cat_name = get_plt_incidence_category_name(inc)
        cat_incidencias[cat_name].append(inc)

    # Identificar campañas disponibles
    campanias_disponibles = sorted(list({str(i.get("campania")) for i in incidencias if i.get("campania") not in (None, "", "None")}))
    if not campanias_disponibles:
        campanias_disponibles = ["General"]

    # =========================================================================
    # HOJA 3: Catálogo de Errores (Índice SSOT)
    # =========================================================================
    ws_cat = wb.create_sheet(title="Catálogo de Errores")
    ws_cat.views.sheetView[0].showGridLines = True

    ws_cat.cell(row=1, column=1, value="CATÁLOGO CONSOLIDADO DE REGLAS QA/QC — PLT").font = s["font_title"]
    ws_cat.cell(row=2, column=1, value="Índice maestro de reglas evaluadas con conteo de incidencias y enlaces a hojas de detalle").font = s["font_subtitle"]

    headers_cat = ["Cód. Regla", "Regla / Mensaje Canónico", "Severidad"] + [f"Camp. {c}" for c in campanias_disponibles] + ["Total Incidencias", "Celdas Afectadas", "Enlace Hoja Detalle"]
    for c_idx, h in enumerate(headers_cat, start=1):
        c = ws_cat.cell(row=4, column=c_idx, value=h)
        c.font = s["font_header"]
        c.fill = s["fill_primary"]
        c.alignment = s["align_center"]

    r_cat = 5
    # Iterar sobre las categorías canónicas del SSOT
    for cat_code, cat_obj in CATEGORIES_REGISTRY_PLT.items():
        cat_name = cat_obj.name
        inc_list = cat_incidencias.get(cat_name, [])
        total_inc = len(inc_list)

        celdas_afectadas = len({i.get("celda_mapeo") for i in inc_list if i.get("celda_mapeo")})

        ws_cat.cell(row=r_cat, column=1, value=cat_code).alignment = s["align_center"]
        ws_cat.cell(row=r_cat, column=2, value=cat_name).alignment = s["align_left"]

        c_sev = ws_cat.cell(row=r_cat, column=3, value=cat_obj.severity)
        c_sev.alignment = s["align_center"]
        c_sev.fill = s["fill_red"] if cat_obj.severity == "ALERTA" else (s["fill_yellow"] if cat_obj.severity == "ADVERTENCIA" else s["fill_kpi_gray"])
        c_sev.font = s["font_bold"]

        col_curr = 4
        for camp in campanias_disponibles:
            c_count = sum(1 for i in inc_list if str(i.get("campania")) == camp)
            ws_cat.cell(row=r_cat, column=col_curr, value=c_count).alignment = s["align_center"]
            col_curr += 1

        ws_cat.cell(row=r_cat, column=col_curr, value=total_inc).alignment = s["align_center"]
        ws_cat.cell(row=r_cat, column=col_curr + 1, value=celdas_afectadas).alignment = s["align_center"]

        # Enlace a hoja individual si tiene incidencias
        if total_inc > 0:
            safe_title = _safe_sheet_title(cat_code)
            c_link = ws_cat.cell(row=r_cat, column=col_curr + 2, value=f"Ver Detalle ({total_inc}) ->")
            c_link.hyperlink = f"#'{safe_title}'!A1"
            c_link.font = s["font_link"]
            c_link.alignment = s["align_center"]
        else:
            ws_cat.cell(row=r_cat, column=col_curr + 2, value="Sin incidencias").alignment = s["align_center"]

        for c_idx in range(1, col_curr + 3):
            ws_cat.cell(row=r_cat, column=c_idx).border = s["border_thin"]
            if c_idx not in (3, col_curr + 2):
                ws_cat.cell(row=r_cat, column=c_idx).font = s["font_regular"]

        r_cat += 1

    ws_cat.column_dimensions["A"].width = 20
    ws_cat.column_dimensions["B"].width = 50
    ws_cat.column_dimensions["C"].width = 16
    for c_i in range(4, col_curr + 3):
        ws_cat.column_dimensions[get_column_letter(c_i)].width = 18

    # =========================================================================
    # HOJA 4: Detalle de Incidencias (Tabla Completa)
    # =========================================================================
    ws_det = wb.create_sheet(title="Detalle de Incidencias")
    ws_det.views.sheetView[0].showGridLines = True

    ws_det.cell(row=1, column=1, value="LISTADO COMPLETO DE INCIDENCIAS QA/QC — PLT").font = s["font_title"]
    headers_det = ["Fila Excel", "Tipo Incidencia", "Cód. Regla", "Celda Mapeo", "Campaña", "Columna Evaluada", "Valor Actual", "Mensaje de Inconsistencia"]
    for c_idx, h in enumerate(headers_det, start=1):
        c = ws_det.cell(row=3, column=c_idx, value=h)
        c.font = s["font_header"]
        c.fill = s["fill_primary"]
        c.alignment = s["align_center"]

    r_det = 4
    for inc in incidencias:
        sev = inc.get("tipo_incidencia", "ALERTA")
        fill_sev = s["fill_red"] if sev == "ALERTA" else (s["fill_yellow"] if sev == "ADVERTENCIA" else s["fill_kpi_gray"])

        ws_det.cell(row=r_det, column=1, value=inc.get("fila_excel", "")).alignment = s["align_center"]
        c_s = ws_det.cell(row=r_det, column=2, value=sev)
        c_s.alignment = s["align_center"]
        c_s.fill = fill_sev
        c_s.font = s["font_bold"]

        ws_det.cell(row=r_det, column=3, value=inc.get("rule_code", "")).alignment = s["align_center"]
        ws_det.cell(row=r_det, column=4, value=inc.get("celda_mapeo", "")).alignment = s["align_left"]
        ws_det.cell(row=r_det, column=5, value=str(inc.get("campania", ""))).alignment = s["align_center"]
        ws_det.cell(row=r_det, column=6, value=inc.get("columna", "")).alignment = s["align_left"]
        ws_det.cell(row=r_det, column=7, value=str(inc.get("valor_actual", "—"))).alignment = s["align_center"]
        ws_det.cell(row=r_det, column=8, value=inc.get("mensaje", "")).alignment = s["align_left"]

        for c_idx in range(1, 9):
            ws_det.cell(row=r_det, column=c_idx).border = s["border_thin"]
            if c_idx != 2:
                ws_det.cell(row=r_det, column=c_idx).font = s["font_regular"]
        r_det += 1

    ws_det.column_dimensions["A"].width = 12
    ws_det.column_dimensions["B"].width = 16
    ws_det.column_dimensions["C"].width = 25
    ws_det.column_dimensions["D"].width = 18
    ws_det.column_dimensions["E"].width = 14
    ws_det.column_dimensions["F"].width = 25
    ws_det.column_dimensions["G"].width = 20
    ws_det.column_dimensions["H"].width = 60

    # =========================================================================
    # HOJAS ESPECÍFICAS: Una hoja por cada regla activa con hipervínculo de retorno
    # =========================================================================
    for cat_code, cat_obj in CATEGORIES_REGISTRY_PLT.items():
        cat_name = cat_obj.name
        inc_list = cat_incidencias.get(cat_name, [])
        if not inc_list:
            continue

        sheet_title = _safe_sheet_title(cat_code)
        ws_rule = wb.create_sheet(title=sheet_title)
        ws_rule.views.sheetView[0].showGridLines = True

        # Botón de retorno al Catálogo
        c_back = ws_rule.cell(row=1, column=1, value="<- Volver al Catálogo de Errores")
        c_back.hyperlink = "#'Catálogo de Errores'!A1"
        c_back.font = s["font_link"]

        ws_rule.cell(row=3, column=1, value=f"REGLA: {cat_name}").font = s["font_title"]
        ws_rule.cell(row=4, column=1, value=f"Código: {cat_code}  |  Severidad: {cat_obj.severity}  |  Total Afectados: {len(inc_list)}").font = s["font_subtitle"]

        headers_rule = ["Fila Excel", "Celda Mapeo", "Campaña", "Columna Evaluada", "Valor Actual", "Mensaje Detallado"]
        for c_idx, h in enumerate(headers_rule, start=1):
            c = ws_rule.cell(row=6, column=c_idx, value=h)
            c.font = s["font_header"]
            c.fill = s["fill_primary"]
            c.alignment = s["align_center"]

        r_r = 7
        for inc in inc_list:
            ws_rule.cell(row=r_r, column=1, value=inc.get("fila_excel", "")).alignment = s["align_center"]
            ws_rule.cell(row=r_r, column=2, value=inc.get("celda_mapeo", "")).alignment = s["align_left"]
            ws_rule.cell(row=r_r, column=3, value=str(inc.get("campania", ""))).alignment = s["align_center"]
            ws_rule.cell(row=r_r, column=4, value=inc.get("columna", "")).alignment = s["align_left"]
            ws_rule.cell(row=r_r, column=5, value=str(inc.get("valor_actual", "—"))).alignment = s["align_center"]
            ws_rule.cell(row=r_r, column=6, value=inc.get("mensaje", "")).alignment = s["align_left"]

            for c_idx in range(1, 7):
                ws_rule.cell(row=r_r, column=c_idx).border = s["border_thin"]
                ws_rule.cell(row=r_r, column=c_idx).font = s["font_regular"]
            r_r += 1

        ws_rule.column_dimensions["A"].width = 12
        ws_rule.column_dimensions["B"].width = 18
        ws_rule.column_dimensions["C"].width = 14
        ws_rule.column_dimensions["D"].width = 25
        ws_rule.column_dimensions["E"].width = 20
        ws_rule.column_dimensions["F"].width = 60

    # Guardar en memoria
    output_stream = io.BytesIO()
    wb.save(output_stream)
    output_stream.seek(0)
    return output_stream
