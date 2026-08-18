"""
services/excel_exporter.py — Motor de exportación a Excel basado en plantilla maestra.

Carga la plantilla maestra 'backend/templates/plantilla.xlsx' y rellena la información
geomecánica en la Hoja 1 ('ventana') respetando:
  - Celdas con fórmulas existentes (K5, N6:N8, AS11:AZ12, etc.).
  - Inyección de fórmulas W..AI solo en filas de discontinuidades activas (evita #¡VALOR!).
  - Adaptación de fórmulas de espaciamiento y condición ponderada (AW11/12, AY11/12).
  - Sanitización estricta de valores centinela (-1, '-1', 'None', etc. -> celda vacía).
  - Soporte multi-celda con 2 filas de separación (fila inicio = fin_anterior + 3).
  - Preparado para soportar Hoja 2 ('BD') en el futuro.
"""

import io
import os
import re
import copy
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union
import openpyxl
from openpyxl.worksheet.worksheet import Worksheet

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_TEMPLATE_PATH = os.path.join(BASE_DIR, "templates", "plantilla.xlsx")


def _sanitize_val(val: Any) -> Any:
    """
    Convierte valores centinela (-1, '-1', 'None', etc.) en None (celda vacía en Excel)
    para que las fórmulas matemáticas y lógicas de Excel no fallen con #¡VALOR!.
    """
    if val is None:
        return None
    if isinstance(val, (int, float)):
        if val in (-1, -1.0):
            return None
        return val
    if isinstance(val, (date, datetime)):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    if s in ("", "-1", "-1.0", "None", "nan", "NaN", "null", "NULL", "undefined"):
        return None
    return s


def _adapt_row_in_formula(formula: str, from_row: int, to_row: int) -> str:
    """
    Desplaza las referencias de fila de una fórmula de Excel.
    Ejemplo: 'V15' con from_row=15, to_row=16 -> 'V16'
             'IF(O15="","",MIN(O15:P15))' -> 'IF(O16="","",MIN(O16:P16))'
    """
    if not formula or not isinstance(formula, str):
        return formula
    # Reemplaza letras de columna + from_row por letras de columna + to_row
    pattern = rf"([A-Z]+){from_row}(?!\d)"
    return re.sub(pattern, rf"\g<1>{to_row}", formula)


def _normalize_ventana_input(item: Any) -> Dict[str, Any]:
    """
    Normaliza cualquier objeto de entrada (ORM models.Ventana, schemas.VentanaResponseSchema,
    diccionario con excel_data + estructuras, o WindowData) a una estructura unificada.
    """
    if isinstance(item, dict):
        if "excel_data" in item:
            excel_data = item.get("excel_data") or {}
            estructuras = item.get("estructuras") or []
            codigo = item.get("codigo_final") or item.get("codigo") or excel_data.get("codigo") or "VENTANA"
            return {
                "codigo": codigo,
                "header": excel_data,
                "estructuras": estructuras,
                "comentarios": excel_data.get("comentarios") or excel_data.get("comentario") or ""
            }
        elif "header" in item and "joints" in item:
            # Formato WindowData de frontend
            header = item.get("header") or {}
            joints = item.get("joints") or []
            return {
                "codigo": header.get("celda") or "VENTANA",
                "header": header,
                "estructuras": joints,
                "comentarios": header.get("comentario") or ""
            }
        else:
            return {
                "codigo": item.get("codigo") or item.get("codigo_celda") or "VENTANA",
                "header": item,
                "estructuras": item.get("discontinuidades") or item.get("estructuras") or [],
                "comentarios": item.get("comentarios") or item.get("comentario") or ""
            }

    # Si es un objeto Pydantic / Schema
    if hasattr(item, "codigo"):
        discs = getattr(item, "discontinuidades", []) or []
        rmr_in = getattr(item, "rmr_input", None)
        coment = getattr(rmr_in, "comentario", "") if rmr_in else ""
        return {
            "codigo": getattr(item, "codigo", "VENTANA"),
            "header": item,
            "estructuras": discs,
            "comentarios": coment or ""
        }

    return {"codigo": "VENTANA", "header": {}, "estructuras": [], "comentarios": ""}


def _get_val(source: Any, *keys: str, default: Any = None) -> Any:
    """Extrae el primer valor no nulo de un diccionario u objeto por varias claves posibles."""
    if source is None:
        return default
    if isinstance(source, dict):
        for k in keys:
            if k in source and source[k] is not None:
                return source[k]
        return default
    for k in keys:
        if hasattr(source, k):
            v = getattr(source, k)
            if v is not None:
                return v
    return default


def _fill_sheet_ventana_block(ws: Worksheet, base_row: int, ventana_dict: Dict[str, Any]):
    """
    Rellena un bloque de celda (filas base_row a base_row + 27) en la hoja 'ventana'.
    """
    codigo = ventana_dict.get("codigo") or "VENTANA"
    header = ventana_dict.get("header") or {}
    estructuras = ventana_dict.get("estructuras") or []
    comentarios = ventana_dict.get("comentarios") or _get_val(header, "comentarios", "comentario") or ""

    # =========================================================================
    # 1. CABECERA (Filas base_row a base_row + 4)
    # =========================================================================
    # A4: Nombre de Celda
    ws[f"A{base_row}"] = _sanitize_val(codigo)

    # B5, D5, F5: Coordenadas FROM
    ws[f"B{base_row + 1}"] = _sanitize_val(_get_val(header, "este_ini", "este_from"))
    ws[f"D{base_row + 1}"] = _sanitize_val(_get_val(header, "norte_ini", "norte_from"))
    ws[f"F{base_row + 1}"] = _sanitize_val(_get_val(header, "cota_ini", "cota_from"))

    # B6, D6, F6: Coordenadas TO
    ws[f"B{base_row + 2}"] = _sanitize_val(_get_val(header, "este_fin", "este_to"))
    ws[f"D{base_row + 2}"] = _sanitize_val(_get_val(header, "norte_fin", "norte_to"))
    ws[f"F{base_row + 2}"] = _sanitize_val(_get_val(header, "cota_fin", "cota_to"))

    # K5: [CON FORMULA] Largo -> NO sobreescribir
    # K6: Altura
    ws[f"K{base_row + 2}"] = _sanitize_val(_get_val(header, "altura_m", "altura"))

    # N5: Dip_talud
    ws[f"N{base_row + 1}"] = _sanitize_val(_get_val(header, "dip_talud"))
    # N6, N7, N8: [CON FORMULA] DipDir_talud, Dip_hole, Az_hole -> NO sobreescribir

    # P4 y P7: Lito 3
    lito3_val = _sanitize_val(_get_val(header, "lito_3", "litologia_3", "lito3"))
    ws[f"P{base_row}"] = lito3_val
    ws[f"P{base_row + 3}"] = lito3_val

    # P5: Alteracion
    ws[f"P{base_row + 1}"] = _sanitize_val(_get_val(header, "alteracion", "alt_mapeo"))
    # P6: Intemperismo
    ws[f"P{base_row + 2}"] = _sanitize_val(_get_val(header, "intemperismo", "intemperia"))

    # U4 y U7: Sector
    sector_val = _sanitize_val(_get_val(header, "sector", "sector_geotecnico", "sect_geot"))
    ws[f"U{base_row}"] = sector_val
    ws[f"U{base_row + 3}"] = sector_val

    # U5: Fase | U6: Nivel
    ws[f"U{base_row + 1}"] = _sanitize_val(_get_val(header, "fase"))
    ws[f"U{base_row + 2}"] = _sanitize_val(_get_val(header, "nivel"))

    # P8: Mapeador
    ws[f"P{base_row + 4}"] = _sanitize_val(_get_val(header, "mapeador"))

    # AK4: Fecha
    ws[f"AK{base_row}"] = _sanitize_val(_get_val(header, "fecha", "fecha_mapeo"))

    # Comentarios: BD21
    if base_row == 4:
        ws["BD21"] = _sanitize_val(comentarios)
    else:
        ws[f"BD{base_row + 17}"] = _sanitize_val(comentarios)

    # =========================================================================
    # 2. RMR & GSI INPUTS (Filas base_row + 7 y base_row + 8 -> ej. 11 y 12)
    # =========================================================================
    r_76 = base_row + 7  # 11
    r_89 = base_row + 8  # 12

    # Agua
    agua_76 = _sanitize_val(_get_val(header, "condicion_agua_rmr76", "condicion_agua", "agua_codigo"))
    agua_89 = _sanitize_val(_get_val(header, "condicion_agua_rmr89", "condicion_agua", "agua_codigo")) or agua_76
    ws[f"AJ{r_76}"] = agua_76
    ws[f"AJ{r_89}"] = agua_89

    # Dureza / Resistencia
    dureza_76 = _sanitize_val(_get_val(header, "dureza_rmr76", "resistencia_ucs", "dureza", "resistencia_codigo"))
    dureza_89 = _sanitize_val(_get_val(header, "dureza_rmr89", "resistencia_ucs", "dureza", "resistencia_codigo")) or dureza_76
    ws[f"AL{r_76}"] = dureza_76
    ws[f"AL{r_89}"] = dureza_89

    # GSI Superficie y Estructura
    gsi_sup = _sanitize_val(_get_val(header, "gsi_superficie"))
    gsi_est = _sanitize_val(_get_val(header, "gsi_estructura"))
    ws[f"AN{r_76}"] = gsi_sup
    ws[f"AN{r_89}"] = gsi_sup
    ws[f"AO{r_76}"] = gsi_est
    ws[f"AO{r_89}"] = gsi_est

    # GSI Visual
    gsi_vis_76 = _sanitize_val(_get_val(header, "gsi_visual_rmr76", "gsi_visual"))
    gsi_vis_89 = _sanitize_val(_get_val(header, "gsi_visual_rmr89", "gsi_visual")) or gsi_vis_76
    ws[f"AP{r_76}"] = gsi_vis_76
    ws[f"AP{r_89}"] = gsi_vis_89

    # Control Estructural
    ctrl_76 = _sanitize_val(_get_val(header, "control_estructural_rmr76", "control_estructural"))
    ctrl_89 = _sanitize_val(_get_val(header, "control_estructural_rmr89", "control_estructural")) or ctrl_76
    ws[f"AQ{r_76}"] = ctrl_76
    ws[f"AQ{r_89}"] = ctrl_89

    # Efectos Voladura
    vol_76 = _sanitize_val(_get_val(header, "efectos_voladura_rmr76", "efectos_voladura"))
    vol_89 = _sanitize_val(_get_val(header, "efectos_voladura_rmr89", "efectos_voladura")) or vol_76
    ws[f"AR{r_76}"] = vol_76
    ws[f"AR{r_89}"] = vol_89

    # UCS e Is50
    ucs_val = _sanitize_val(_get_val(header, "ucs_mpa"))
    is50_val = _sanitize_val(_get_val(header, "is50_mpa"))
    ws[f"BA{r_76}"] = ucs_val
    ws[f"BA{r_89}"] = ucs_val
    ws[f"BB{r_76}"] = is50_val
    ws[f"BB{r_89}"] = is50_val

    # =========================================================================
    # 3. TABLA DE DISCONTINUIDADES (Filas base_row + 11 a base_row + 24 -> 15 a 28)
    # =========================================================================
    start_struct_row = base_row + 11  # 15
    max_template_structs = 14
    num_structs = len(estructuras)

    # Fórmulas de subratings base de la fila 15 (para replicar hacia abajo con {r})
    subrating_formulas_template = {
        "W": "=VLOOKUP(V{r},RMR!$A$40:$C$45,3,FALSE)",
        "X": "=IF(O{r}=\"\",\"error\",MIN(O{r}:P{r}))",
        "Y": "=VLOOKUP(I{r},RMR!$A$31:$D$35,4,TRUE)",
        "Z": "=IF(G{r}=\"\",\"error\",VLOOKUP(G{r},RMR!$B$51:$E$55,4,TRUE))",
        "AA": "=VLOOKUP(T{r},RMR!$A$59:$C$67,3,TRUE)",
        "AB": "=SUM(X{r}+Y{r}+Z{r}+AA{r}+W{r})",
        "AC": "=VLOOKUP(V{r},RMR!$A$40:$C$45,2,FALSE)",
        "AD": "=IF(Q{r}=\"\",\"error\",MIN(Q{r}:R{r}))",
        "AE": "=VLOOKUP(I{r},RMR!$A$31:$D$35,3,TRUE)",
        "AF": "=IF(G{r}=\"\",\"error\",VLOOKUP(G{r},RMR!$B$51:$E$55,3,TRUE))",
        "AG": "=VLOOKUP(T{r},RMR!$A$59:$C$67,2,TRUE)",
        "AH": "=SUM(AC{r}+AD{r}+AE{r}+AF{r}+AG{r})",
        "AI": "=(5/J{r})/3"
    }

    active_rows_count = 0
    for slot_idx in range(max_template_structs):
        curr_row = start_struct_row + slot_idx
        if slot_idx < num_structs:
            s = estructuras[slot_idx]
            fam = _sanitize_val(_get_val(s, "familia_id", "familia", "numero_estructura"))
            dist = _sanitize_val(_get_val(s, "distancia_m", "distancia"))
            tipo = _sanitize_val(_get_val(s, "tipo_estructura", "tipo"))
            dip = _sanitize_val(_get_val(s, "dip"))
            dip_dir = _sanitize_val(_get_val(s, "dip_dir", "dipdir"))

            is_active = any(x is not None for x in [dist, tipo, dip, dip_dir])

            # Inyectar datos de entrada
            ws[f"A{curr_row}"] = fam
            ws[f"B{curr_row}"] = dist
            ws[f"C{curr_row}"] = tipo
            ws[f"D{curr_row}"] = dip
            ws[f"E{curr_row}"] = dip_dir
            ws[f"F{curr_row}"] = _sanitize_val(_get_val(s, "n_estructuras", "nstr", "numero_estructuras"))
            ws[f"G{curr_row}"] = _sanitize_val(_get_val(s, "abertura_mm", "abertura", "aber"))
            ws[f"H{curr_row}"] = _sanitize_val(_get_val(s, "espesor_mm", "espesor", "esp"))
            ws[f"I{curr_row}"] = _sanitize_val(_get_val(s, "continuidad_m", "continuidad", "cont"))
            ws[f"J{curr_row}"] = _sanitize_val(_get_val(s, "espaciamiento_m", "espaciamiento", "espac"))
            ws[f"K{curr_row}"] = _sanitize_val(_get_val(s, "n_extremos_visibles", "extremos_visibles", "next"))
            ws[f"L{curr_row}"] = _sanitize_val(_get_val(s, "terminacion", "term"))
            ws[f"M{curr_row}"] = _sanitize_val(_get_val(s, "relleno_1_codigo", "relleno1", "r1"))
            ws[f"N{curr_row}"] = _sanitize_val(_get_val(s, "relleno_2_codigo", "relleno2", "r2"))
            ws[f"S{curr_row}"] = _sanitize_val(_get_val(s, "jrc"))
            ws[f"T{curr_row}"] = _sanitize_val(_get_val(s, "rugosidad_codigo", "rugosidad", "rug"))
            ws[f"U{curr_row}"] = _sanitize_val(_get_val(s, "forma_estructura", "forma"))
            ws[f"V{curr_row}"] = _sanitize_val(_get_val(s, "alteracion_codigo", "alteracion", "alt"))

            if is_active:
                active_rows_count += 1
                # Inyectar fórmulas adaptadas para esta fila en W..AI
                for col_letter, formula_tmpl in subrating_formulas_template.items():
                    ws[f"{col_letter}{curr_row}"] = formula_tmpl.format(r=curr_row)
            else:
                # Fila sin registro: limpiar fórmulas W..AI
                for col_letter in subrating_formulas_template.keys():
                    ws[f"{col_letter}{curr_row}"] = None
        else:
            # Fila vacía de la plantilla: limpiar entradas y fórmulas W..AI
            for col_letter in ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "S", "T", "U", "V"]:
                ws[f"{col_letter}{curr_row}"] = None
            for col_letter in subrating_formulas_template.keys():
                ws[f"{col_letter}{curr_row}"] = None

    # =========================================================================
    # 4. ADAPTACIÓN DE FÓRMULAS DINÁMICAS RMR (AW11/12 y AY11/12)
    # =========================================================================
    end_calc_row = start_struct_row + max(1, min(active_rows_count, max_template_structs)) - 1
    if active_rows_count > 0:
        # AW11: Espaciamiento ponderado =(J15*F15+...+Jn*Fn)/SUMA(F15:Fn)
        prod_j_f = "+".join([f"J{r}*F{r}" for r in range(start_struct_row, end_calc_row + 1)])
        ws[f"AW{r_76}"] = f"=({prod_j_f})/SUM(F{start_struct_row}:F{end_calc_row})"
        ws[f"AW{r_89}"] = f"=AW{r_76}"

        # AY11: Condición Discontinuidad 76 =(AB15*F15+...+ABn*Fn)/SUMA(F15:Fn)
        prod_ab_f = "+".join([f"AB{r}*F{r}" for r in range(start_struct_row, end_calc_row + 1)])
        ws[f"AY{r_76}"] = f"=({prod_ab_f})/SUM(F{start_struct_row}:F{end_calc_row})"

        # AY12: Condición Discontinuidad 89 =(AH15*F15+...+AHn*Fn)/SUMA(F15:Fn)
        prod_ah_f = "+".join([f"AH{r}*F{r}" for r in range(start_struct_row, end_calc_row + 1)])
        ws[f"AY{r_89}"] = f"=({prod_ah_f})/SUM(F{start_struct_row}:F{end_calc_row})"


def export_ventanas_to_excel(
    ventanas: Union[List[Any], Any],
    template_path: Optional[str] = None
) -> io.BytesIO:
    """
    Genera un archivo Excel (.xlsx) a partir de la plantilla maestra, inyectando
    los datos de una o múltiples ventanas en la hoja 'ventana'.

    Retorna un buffer BytesIO con el contenido del workbook listo para streaming.
    """
    path = template_path or DEFAULT_TEMPLATE_PATH
    if not os.path.exists(path):
        raise FileNotFoundError(f"No se encontró la plantilla de Excel en: {path}")

    # Lista normalizada de ventanas
    if not isinstance(ventanas, list):
        ventanas_list = [ventanas]
    else:
        ventanas_list = ventanas

    if not ventanas_list:
        raise ValueError("Se debe proporcionar al menos una ventana para exportar.")

    normalized_ventanas = [_normalize_ventana_input(v) for v in ventanas_list]

    # Cargar workbook preservando fórmulas y estilos
    wb = openpyxl.load_workbook(path, data_only=False)

    if "ventana" not in wb.sheetnames:
        raise ValueError(f"La plantilla no contiene la hoja requerida 'ventana'. Hojas disponibles: {wb.sheetnames}")

    ws = wb["ventana"]

    # Bloque 1: Celda 1 empieza siempre en base_row = 4
    _fill_sheet_ventana_block(ws, 4, normalized_ventanas[0])

    # Bloques adicionales (Multi-celda)
    # Cada bloque estándar ocupa de fila 4 a 31 (28 filas).
    # Con 2 filas en blanco de separación, el siguiente bloque inicia en:
    # base_row_siguiente = base_row_actual + 28 + 2 = base_row_actual + 30
    current_base_row = 4
    block_height = 28  # filas 4 a 31
    spacing = 2        # 2 filas en blanco

    for v_idx in range(1, len(normalized_ventanas)):
        next_base_row = current_base_row + block_height + spacing
        # Copiar celdas y estilos de las filas 4..31 a next_base_row..next_base_row+27
        row_offset = next_base_row - 4
        for r in range(4, 32):
            target_r = r + row_offset
            for c in range(1, ws.max_column + 1):
                src_cell = ws.cell(row=r, column=c)
                tgt_cell = ws.cell(row=target_r, column=c)
                # Copiar valor o fórmula adaptada
                if src_cell.value is not None:
                    if str(src_cell.value).startswith("="):
                        tgt_cell.value = _adapt_row_in_formula(src_cell.value, r, target_r)
                    else:
                        tgt_cell.value = src_cell.value
                # Copiar formato
                if src_cell.has_style:
                    tgt_cell.font = copy.copy(src_cell.font)
                    tgt_cell.border = copy.copy(src_cell.border)
                    tgt_cell.fill = copy.copy(src_cell.fill)
                    tgt_cell.number_format = src_cell.number_format
                    tgt_cell.protection = copy.copy(src_cell.protection)
                    tgt_cell.alignment = copy.copy(src_cell.alignment)

        # Inyectar datos de la celda en el nuevo bloque
        _fill_sheet_ventana_block(ws, next_base_row, normalized_ventanas[v_idx])
        current_base_row = next_base_row

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
