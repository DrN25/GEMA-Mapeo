"""
app/core/rules_plt.py — Catálogo Oficial de Reglas de Consistencia Geomecánica para Ensayos PLT.
Define las categorías canónicas de error y las reglas específicas evaluadas por el sistema.
"""

from typing import Dict, List, Set


class RuleCategoryPLT:
    """Categoría canónica mostrada en el Catálogo de Errores del Excel y Dashboard."""
    def __init__(self, code: str, name: str, severity: str):
        self.code = code
        self.name = name
        self.severity = severity  # 'ALERTA', 'ADVERTENCIA', 'VACIO'


class ErrorRulePLT:
    """Regla específica de validación geomecánica."""
    def __init__(self, code: str, category_code: str, columns: List[str], message_template: str):
        self.code = code
        self.category_code = category_code
        self.columns = columns
        self.message_template = message_template

    def format_message(self, **kwargs) -> str:
        try:
            return self.message_template.format(**kwargs)
        except Exception:
            return self.message_template


# ===========================================================================
# 1. CATEGORÍAS CANÓNICAS DE ERROR (SSOT)
# ===========================================================================
CATEGORIES_REGISTRY_PLT: Dict[str, RuleCategoryPLT] = {
    "CAT_CAMPO_OBLIGATORIO_VACIO": RuleCategoryPLT(
        "CAT_CAMPO_OBLIGATORIO_VACIO", "Campo obligatorio se encuentra vacío.", "VACIO"
    ),
    "CAT_PLT_CAMPANA_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_CAMPANA_INVALIDA", "Año de campaña no válido (debe ser un año entre 2000 y 2035).", "ALERTA"
    ),
    "CAT_PLT_FECHA_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_FECHA_INVALIDA", "Fecha de ensayo con formato no válido o no parseable.", "ALERTA"
    ),
    "CAT_PLT_FECHA_FUTURA": RuleCategoryPLT(
        "CAT_PLT_FECHA_FUTURA", "Fecha de ensayo posterior a la fecha actual del sistema.", "ALERTA"
    ),
    "CAT_PLT_TIPO_ENSAYO_INVALIDO": RuleCategoryPLT(
        "CAT_PLT_TIPO_ENSAYO_INVALIDO", "Tipo de ensayo no admitido (debe ser 'i' para irregular).", "ALERTA"
    ),
    "CAT_PLT_NIVEL_NO_NUMERICO": RuleCategoryPLT(
        "CAT_PLT_NIVEL_NO_NUMERICO", "Valor de nivel contiene caracteres no numéricos.", "ALERTA"
    ),
    "CAT_PLT_NIVEL_NEGATIVO": RuleCategoryPLT(
        "CAT_PLT_NIVEL_NEGATIVO", "Valor de nivel no puede ser negativo.", "ALERTA"
    ),
    "CAT_PLT_NIVEL_LIMITE_EXCEDIDO": RuleCategoryPLT(
        "CAT_PLT_NIVEL_LIMITE_EXCEDIDO", "Valor de nivel supera el límite máximo permitido (> 4999).", "ALERTA"
    ),
    "CAT_PLT_MUESTRA_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_MUESTRA_INVALIDA", "Letra de muestra inválida (debe ser A, B, C o D).", "ADVERTENCIA"
    ),
    "CAT_PLT_MUESTRA_DUPLICADA": RuleCategoryPLT(
        "CAT_PLT_MUESTRA_DUPLICADA", "Muestra duplicada dentro de la misma celda de mapeo en la misma fecha.", "ALERTA"
    ),
    "CAT_PLT_CODIGO_MUESTRA_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_CODIGO_MUESTRA_INCONGRUENTE", "Código de muestra no coincide con la celda y muestra correspondiente.", "ALERTA"
    ),
    "CAT_PLT_LITO1_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_LITO1_INVALIDA", "Litología no existe en el catálogo de litologías oficiales.", "ALERTA"
    ),
    "CAT_PLT_LITOLOGIA_COMBINACION_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_LITOLOGIA_COMBINACION_INVALIDA", "Combinación litológica (Lito 1-2-3) no pertenece al catálogo geológico.", "ALERTA"
    ),
    "CAT_PLT_TIPO_LITOLOGICO_INVALIDO": RuleCategoryPLT(
        "CAT_PLT_TIPO_LITOLOGICO_INVALIDO", "Tipo litológico no pertenece a los 5 grupos admitidos.", "ALERTA"
    ),
    "CAT_PLT_TIPO_LITOLOGICO_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_TIPO_LITOLOGICO_INCONGRUENTE", "Tipo litológico es incongruente con la combinación Lito 1-2-3.", "ALERTA"
    ),
    "CAT_PLT_COORD_ESTE_RANGO": RuleCategoryPLT(
        "CAT_PLT_COORD_ESTE_RANGO", "Coordenada Este no puede ser menor o igual a cero.", "ALERTA"
    ),
    "CAT_PLT_COORD_NORTE_RANGO": RuleCategoryPLT(
        "CAT_PLT_COORD_NORTE_RANGO", "Coordenada Norte no puede ser menor o igual a cero.", "ALERTA"
    ),
    "CAT_PLT_ELEVACION_RANGO": RuleCategoryPLT(
        "CAT_PLT_ELEVACION_RANGO", "Elevación (msnm) no puede ser menor o igual a cero.", "ALERTA"
    ),
    "CAT_PLT_ESPESOR_D_RANGO": RuleCategoryPLT(
        "CAT_PLT_ESPESOR_D_RANGO", "Espesor D (cm) debe ser un valor positivo mayor a cero.", "ALERTA"
    ),
    "CAT_PLT_LONGITUD_L_RANGO": RuleCategoryPLT(
        "CAT_PLT_LONGITUD_L_RANGO", "Longitud L (cm) debe ser un valor positivo mayor a cero.", "ALERTA"
    ),
    "CAT_PLT_ANCHO_W1_RANGO": RuleCategoryPLT(
        "CAT_PLT_ANCHO_W1_RANGO", "Ancho W1 (cm) debe ser un valor positivo mayor a cero.", "ALERTA"
    ),
    "CAT_PLT_ANCHO_W2_RANGO": RuleCategoryPLT(
        "CAT_PLT_ANCHO_W2_RANGO", "Ancho W2 (cm) debe ser un valor positivo mayor a cero.", "ALERTA"
    ),
    "CAT_PLT_ANCHO_W_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_ANCHO_W_INCONGRUENTE", "Ancho W (cm) no coincide con el promedio de W1 y W2.", "ALERTA"
    ),
    "CAT_PLT_MUESTRA_VALIDA_LONG_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_MUESTRA_VALIDA_LONG_INCONGRUENTE", "Validación de longitud de muestra (L >= D) es incongruente.", "ALERTA"
    ),
    "CAT_PLT_MUESTRA_VALIDA_ANCHO_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_MUESTRA_VALIDA_ANCHO_INCONGRUENTE", "Validación de ancho de muestra (0.3W < D < W) es incongruente.", "ALERTA"
    ),
    "CAT_PLT_FUERZA_P_RANGO": RuleCategoryPLT(
        "CAT_PLT_FUERZA_P_RANGO", "Fuerza P (kN) debe ser un valor positivo mayor a cero.", "ALERTA"
    ),
    "CAT_PLT_DIRECCION_ROTURA_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_DIRECCION_ROTURA_INVALIDA", "Dirección de rotura no admitida (debe ser Pa, Pe, NA o N/A).", "ALERTA"
    ),
    "CAT_PLT_TIPO_FRACTURA_INVALIDO": RuleCategoryPLT(
        "CAT_PLT_TIPO_FRACTURA_INVALIDO", "Tipo de fractura no admitido (debe ser M, E o C).", "ALERTA"
    ),
    "CAT_PLT_DIAMETRO_EQUIV_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_DIAMETRO_EQUIV_INCONGRUENTE", "Diámetro equivalente De (cm) no coincide con la fórmula sqrt(4*D*W/pi).", "ALERTA"
    ),
    "CAT_PLT_FACTOR_F_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_FACTOR_F_INCONGRUENTE", "Factor de corrección F no coincide con la fórmula ((De*10)/50)^0.45.", "ALERTA"
    ),
    "CAT_PLT_IS_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_IS_INCONGRUENTE", "Índice Is (MPa) no coincide con la fórmula P*1000/(De*10)^2.", "ALERTA"
    ),
    "CAT_PLT_IS50_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_IS50_INCONGRUENTE", "Índice Is(50) (MPa) no coincide con la fórmula Is * F.", "ALERTA"
    ),
    "CAT_PLT_FACTOR_K_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_FACTOR_K_INCONGRUENTE", "Factor de conversión K no coincide con el valor asignado por el catálogo litológico.", "ALERTA"
    ),
    "CAT_PLT_FACTOR_K_RANGO": RuleCategoryPLT(
        "CAT_PLT_FACTOR_K_RANGO", "Factor de conversión K fuera de rango razonable [5, 30].", "ALERTA"
    ),
    "CAT_PLT_UCS_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_UCS_INCONGRUENTE", "Resistencia UCS (MPa) no coincide con la fórmula Is(50) * K.", "ALERTA"
    ),
    "CAT_PLT_RESISTENCIA_ISRM_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_RESISTENCIA_ISRM_INCONGRUENTE", "Clasificación de resistencia ISRM no corresponde al rango de UCS según tabla oficial.", "ALERTA"
    ),
    "CAT_PLT_FORMULA_ERROR": RuleCategoryPLT(
        "CAT_PLT_FORMULA_ERROR", "La celda contiene un error de evaluación de fórmula (#VALUE!, #REF!, #DIV/0!).", "ALERTA"
    ),
    "CAT_PLT_SECUENCIA_DESORDEN": RuleCategoryPLT(
        "CAT_PLT_SECUENCIA_DESORDEN", "Las muestras de la celda de mapeo no se encuentran en orden canónico (A-B-C-D).", "ADVERTENCIA"
    ),
    "CAT_PLT_CELDA_INCOMPLETA": RuleCategoryPLT(
        "CAT_PLT_CELDA_INCOMPLETA", "La celda de mapeo se encuentra incompleta (posee menos de 4 muestras).", "ADVERTENCIA"
    ),
    "CAT_PLT_CELDA_EXCEDENTE": RuleCategoryPLT(
        "CAT_PLT_CELDA_EXCEDENTE", "La celda de mapeo posee más de 4 muestras registradas.", "ADVERTENCIA"
    ),
}

# Categorías que aplican exclusivamente al Formato de Campo Compacto (03 feb1.xlsx)
COMPACT_FIELD_CATEGORIES: Set[str] = {
    "CAT_CAMPO_OBLIGATORIO_VACIO",
    "CAT_PLT_MUESTRA_INVALIDA",
    "CAT_PLT_CODIGO_MUESTRA_INCONGRUENTE",
    "CAT_PLT_LITO1_INVALIDA",
    "CAT_PLT_LITOLOGIA_COMBINACION_INVALIDA",
    "CAT_PLT_COORD_ESTE_RANGO",
    "CAT_PLT_COORD_NORTE_RANGO",
    "CAT_PLT_ELEVACION_RANGO",
    "CAT_PLT_ESPESOR_D_RANGO",
    "CAT_PLT_LONGITUD_L_RANGO",
    "CAT_PLT_ANCHO_W1_RANGO",
    "CAT_PLT_ANCHO_W2_RANGO",
    "CAT_PLT_ANCHO_W_INCONGRUENTE",
    "CAT_PLT_MUESTRA_VALIDA_LONG_INCONGRUENTE",
    "CAT_PLT_MUESTRA_VALIDA_ANCHO_INCONGRUENTE",
    "CAT_PLT_FUERZA_P_RANGO",
    "CAT_PLT_DIRECCION_ROTURA_INVALIDA",
    "CAT_PLT_TIPO_FRACTURA_INVALIDO",
    "CAT_PLT_DIAMETRO_EQUIV_INCONGRUENTE",
    "CAT_PLT_FACTOR_F_INCONGRUENTE",
    "CAT_PLT_IS_INCONGRUENTE",
    "CAT_PLT_IS50_INCONGRUENTE",
    "CAT_PLT_UCS_INCONGRUENTE",
    "CAT_PLT_RESISTENCIA_ISRM_INCONGRUENTE",
    "CAT_PLT_FORMULA_ERROR",
    "CAT_PLT_SECUENCIA_DESORDEN",
    "CAT_PLT_CELDA_INCOMPLETA",
    "CAT_PLT_CELDA_EXCEDENTE",
}


# ===========================================================================
# 2. REGLAS DETALLADAS DE ERROR
# ===========================================================================
RULES_REGISTRY_PLT: Dict[str, ErrorRulePLT] = {
    "ERR_PLT_CAMPO_OBLIGATORIO_VACIO": ErrorRulePLT(
        "ERR_PLT_CAMPO_OBLIGATORIO_VACIO",
        "CAT_CAMPO_OBLIGATORIO_VACIO",
        ["Campaña", "Fecha de ensayo", "Tipo de ensayo", "Ejecutado por", "Zona de mapeo", "Nivel", "Celda de mapeo", "Muestra", "Código de muestra", "Litología 1", "Litología 2", "Litología 3", "Tipo litológico", "Este (m)", "Norte (m)", "Elevación (msnm)", "Espesor D (cm)", "Longitud L (cm)", "Ancho W1 (cm)", "Ancho W2 (cm)", "Ancho W (cm)", "Muestra válida - Longitud", "Muestra válida - Ancho", "Fuerza P (kN)", "Dirección de rotura", "Tipo de fractura", "Diámetro equivalente (cm)", "Factor F", "Is (MPa)", "Is(50) (MPa)", "Factor de conversión K", "RCS/UCS (MPa)", "Resistencia ISRM"],
        "Campo obligatorio se encuentra vacío: '{col_name}'.",
    ),
    "ERR_PLT_CAMPANIA_RANGO": ErrorRulePLT(
        "ERR_PLT_CAMPANIA_RANGO",
        "CAT_PLT_CAMPANA_INVALIDA",
        ["Campaña"],
        "Campaña con valor '{value}' fuera de rango. Debe ser un año entre 2000 y 2035.",
    ),
    "ERR_PLT_FORMATO_FECHA_INVALIDO": ErrorRulePLT(
        "ERR_PLT_FORMATO_FECHA_INVALIDO",
        "CAT_PLT_FECHA_INVALIDA",
        ["Fecha de ensayo"],
        "Fecha de ensayo '{value}' tiene un formato no válido o no parseable.",
    ),
    "ERR_PLT_FECHA_FUTURA": ErrorRulePLT(
        "ERR_PLT_FECHA_FUTURA",
        "CAT_PLT_FECHA_FUTURA",
        ["Fecha de ensayo"],
        "Fecha de ensayo '{value}' es posterior a la fecha actual del sistema.",
    ),
    "ERR_PLT_TIPO_ENSAYO_CATALOGO": ErrorRulePLT(
        "ERR_PLT_TIPO_ENSAYO_CATALOGO",
        "CAT_PLT_TIPO_ENSAYO_INVALIDO",
        ["Tipo de ensayo"],
        "Tipo de ensayo '{value}' no admitido. Debe ser 'i' (irregular).",
    ),
    "ERR_PLT_NIVEL_NO_NUMERICO": ErrorRulePLT(
        "ERR_PLT_NIVEL_NO_NUMERICO",
        "CAT_PLT_NIVEL_NO_NUMERICO",
        ["Nivel"],
        "Nivel '{value}' contiene caracteres no numéricos o no es un entero válido.",
    ),
    "ERR_PLT_NIVEL_RANGO": ErrorRulePLT(
        "ERR_PLT_NIVEL_RANGO",
        "CAT_PLT_NIVEL_NEGATIVO",
        ["Nivel"],
        "Nivel con valor '{value}' no puede ser negativo.",
    ),
    "ERR_PLT_NIVEL_LIMITE_EXCEDIDO": ErrorRulePLT(
        "ERR_PLT_NIVEL_LIMITE_EXCEDIDO",
        "CAT_PLT_NIVEL_LIMITE_EXCEDIDO",
        ["Nivel"],
        "Nivel con valor '{value}' supera el límite máximo permitido (> 4999).",
    ),
    "ERR_PLT_MUESTRA_LETRA_INVALIDA": ErrorRulePLT(
        "ERR_PLT_MUESTRA_LETRA_INVALIDA",
        "CAT_PLT_MUESTRA_INVALIDA",
        ["Muestra"],
        "Letra de muestra '{value}' inválida. Debe ser A, B, C o D.",
    ),
    "WRN_PLT_MUESTRA_LETRA_INVALIDA": ErrorRulePLT(
        "WRN_PLT_MUESTRA_LETRA_INVALIDA",
        "CAT_PLT_MUESTRA_INVALIDA",
        ["Muestra"],
        "Letra de muestra '{value}' inválida. Debe ser A, B, C o D.",
    ),
    "ERR_PLT_MUESTRA_DUPLICADA_EN_CELDA": ErrorRulePLT(
        "ERR_PLT_MUESTRA_DUPLICADA_EN_CELDA",
        "CAT_PLT_MUESTRA_DUPLICADA",
        ["Muestra"],
        "Muestra '{muestra}' duplicada en celda '{celda}'.",
    ),
    "ERR_PLT_CODIGO_MUESTRA_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_CODIGO_MUESTRA_INCONGRUENTE",
        "CAT_PLT_CODIGO_MUESTRA_INCONGRUENTE",
        ["Código de muestra"],
        "Código de muestra '{actual}' no coincide con celda '{celda}' y muestra '{muestra}'.",
    ),
    "ERR_PLT_LITO1_NO_RECONOCIDO": ErrorRulePLT(
        "ERR_PLT_LITO1_NO_RECONOCIDO",
        "CAT_PLT_LITO1_INVALIDA",
        ["Litología 1"],
        "Litología '{value}' no existe en el catálogo geológico oficial.",
    ),
    "ERR_PLT_LITO2_NO_RECONOCIDO": ErrorRulePLT(
        "ERR_PLT_LITO2_NO_RECONOCIDO",
        "CAT_PLT_LITO1_INVALIDA",
        ["Litología 2"],
        "Litología '{value}' no existe en el catálogo geológico oficial.",
    ),
    "ERR_PLT_LITO3_NO_RECONOCIDO": ErrorRulePLT(
        "ERR_PLT_LITO3_NO_RECONOCIDO",
        "CAT_PLT_LITO1_INVALIDA",
        ["Litología 3"],
        "Litología '{value}' no existe en el catálogo geológico oficial.",
    ),
    "ERR_PLT_COMBINACION_LITOLOGICA_NO_VALIDA": ErrorRulePLT(
        "ERR_PLT_COMBINACION_LITOLOGICA_NO_VALIDA",
        "CAT_PLT_LITOLOGIA_COMBINACION_INVALIDA",
        ["Litología 1", "Litología 2", "Litología 3"],
        "Combinación ({lito1}, {lito2}, {lito3}) no pertenece al catálogo geológico.",
    ),
    "ERR_PLT_TIPO_LITOLOGICO_CATALOGO": ErrorRulePLT(
        "ERR_PLT_TIPO_LITOLOGICO_CATALOGO",
        "CAT_PLT_TIPO_LITOLOGICO_INVALIDO",
        ["Tipo litológico"],
        "Tipo litológico '{value}' no pertenece a los 5 grupos admitidos.",
    ),
    "ERR_PLT_TIPO_LITOLOGICO_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_TIPO_LITOLOGICO_INCONGRUENTE",
        "CAT_PLT_TIPO_LITOLOGICO_INCONGRUENTE",
        ["Tipo litológico"],
        "Tipo litológico '{actual}' es incongruente con la combinación litológica (esperado: '{expected}').",
    ),
    "ERR_PLT_ESTE_RANGO": ErrorRulePLT(
        "ERR_PLT_ESTE_RANGO",
        "CAT_PLT_COORD_ESTE_RANGO",
        ["Este (m)"],
        "Coordenada Este ({value}) fuera de rango válido.",
    ),
    "ERR_PLT_NORTE_RANGO": ErrorRulePLT(
        "ERR_PLT_NORTE_RANGO",
        "CAT_PLT_COORD_NORTE_RANGO",
        ["Norte (m)"],
        "Coordenada Norte ({value}) fuera de rango válido.",
    ),
    "ERR_PLT_ELEVACION_RANGO": ErrorRulePLT(
        "ERR_PLT_ELEVACION_RANGO",
        "CAT_PLT_ELEVACION_RANGO",
        ["Elevación (msnm)"],
        "Elevación ({value}) fuera de rango válido (0 a 6000 msnm).",
    ),
    "ERR_PLT_ESPESOR_D_RANGO": ErrorRulePLT(
        "ERR_PLT_ESPESOR_D_RANGO",
        "CAT_PLT_ESPESOR_D_RANGO",
        ["Espesor D (cm)"],
        "Espesor D ({value}) debe ser un valor positivo mayor a cero (D > 0).",
    ),
    "ERR_PLT_LONGITUD_L_RANGO": ErrorRulePLT(
        "ERR_PLT_LONGITUD_L_RANGO",
        "CAT_PLT_LONGITUD_L_RANGO",
        ["Longitud L (cm)"],
        "Longitud L ({value}) debe ser un valor positivo mayor a cero (L > 0).",
    ),
    "ERR_PLT_ANCHO_W1_RANGO": ErrorRulePLT(
        "ERR_PLT_ANCHO_W1_RANGO",
        "CAT_PLT_ANCHO_W1_RANGO",
        ["Ancho W1 (cm)"],
        "Ancho W1 ({value}) debe ser un valor positivo mayor a cero (W1 > 0).",
    ),
    "ERR_PLT_ANCHO_W2_RANGO": ErrorRulePLT(
        "ERR_PLT_ANCHO_W2_RANGO",
        "CAT_PLT_ANCHO_W2_RANGO",
        ["Ancho W2 (cm)"],
        "Ancho W2 ({value}) debe ser un valor positivo mayor a cero (W2 > 0).",
    ),
    "ERR_PLT_ANCHO_W_RANGO": ErrorRulePLT(
        "ERR_PLT_ANCHO_W_RANGO",
        "CAT_PLT_ANCHO_W1_RANGO",
        ["Ancho W (cm)"],
        "Ancho W ({value}) debe ser un valor positivo mayor a cero (W > 0).",
    ),
    "ERR_PLT_ANCHO_W_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_ANCHO_W_INCONGRUENTE",
        "CAT_PLT_ANCHO_W_INCONGRUENTE",
        ["Ancho W (cm)"],
        "Ancho W ({actual}) diverge de (W1+W2)/2 = ({w1}+{w2})/2 = {expected} cm.",
    ),
    "ERR_PLT_MUESTRA_VALIDA_LONG_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_MUESTRA_VALIDA_LONG_INCONGRUENTE",
        "CAT_PLT_MUESTRA_VALIDA_LONG_INCONGRUENTE",
        ["Muestra válida - Longitud"],
        "Criterio Longitud (L >= D): con L={l} cm y D={d} cm se esperaba '{expected}', pero se registró '{actual}'.",
    ),
    "ERR_PLT_MUESTRA_VALIDA_ANCHO_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_MUESTRA_VALIDA_ANCHO_INCONGRUENTE",
        "CAT_PLT_MUESTRA_VALIDA_ANCHO_INCONGRUENTE",
        ["Muestra válida - Ancho"],
        "Criterio Ancho (0.3*W < D < W): con 0.3*W={lim_inf} cm, D={d} cm y W={w} cm se esperaba '{expected}', pero se registró '{actual}'.",
    ),
    "ERR_PLT_FUERZA_P_RANGO": ErrorRulePLT(
        "ERR_PLT_FUERZA_P_RANGO",
        "CAT_PLT_FUERZA_P_RANGO",
        ["Fuerza P (kN)"],
        "Fuerza P ({value}) debe ser un valor positivo mayor a cero (P > 0).",
    ),
    "ERR_PLT_DIRECCION_ROTURA_CATALOGO": ErrorRulePLT(
        "ERR_PLT_DIRECCION_ROTURA_CATALOGO",
        "CAT_PLT_DIRECCION_ROTURA_INVALIDA",
        ["Dirección de rotura"],
        "Dirección de rotura '{value}' no admitida (debe ser Pa, Pe, NA o N/A).",
    ),
    "ERR_PLT_TIPO_FRACTURA_CATALOGO": ErrorRulePLT(
        "ERR_PLT_TIPO_FRACTURA_CATALOGO",
        "CAT_PLT_TIPO_FRACTURA_INVALIDO",
        ["Tipo de fractura"],
        "Tipo de fractura '{value}' no admitido (debe ser M, E o C).",
    ),
    "ERR_PLT_DIAMETRO_EQUIV_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_DIAMETRO_EQUIV_INCONGRUENTE",
        "CAT_PLT_DIAMETRO_EQUIV_INCONGRUENTE",
        ["Diámetro equivalente (cm)"],
        "Diámetro De ({actual} cm) diverge de sqrt(4*W*D/pi) = sqrt(4*{w}*{d}/pi) = {expected} cm.",
    ),
    "ERR_PLT_FACTOR_F_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_FACTOR_F_INCONGRUENTE",
        "CAT_PLT_FACTOR_F_INCONGRUENTE",
        ["Factor F"],
        "Factor F ({actual}) diverge de (De_mm / 50)^0.45 = ({de_mm} / 50)^0.45 = {expected}.",
    ),
    "ERR_PLT_IS_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_IS_INCONGRUENTE",
        "CAT_PLT_IS_INCONGRUENTE",
        ["Is (MPa)"],
        "Índice Is ({actual} MPa) diverge de (10 * P) / De^2 = (10 * {p}) / ({de})^2 = {expected} MPa.",
    ),
    "ERR_PLT_IS50_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_IS50_INCONGRUENTE",
        "CAT_PLT_IS50_INCONGRUENTE",
        ["Is(50) (MPa)"],
        "Índice Is(50) ({actual} MPa) diverge de F * Is = {f} * {is_val} = {expected} MPa.",
    ),
    "ERR_PLT_FACTOR_K_INCORRECTO": ErrorRulePLT(
        "ERR_PLT_FACTOR_K_INCORRECTO",
        "CAT_PLT_FACTOR_K_INCONGRUENTE",
        ["Factor de conversión K"],
        "Factor K ({actual}) diverge del asignado para litología '{litos}' (esperado K = {expected}).",
    ),
    "ERR_PLT_FACTOR_K_RANGO": ErrorRulePLT(
        "ERR_PLT_FACTOR_K_RANGO",
        "CAT_PLT_FACTOR_K_RANGO",
        ["Factor de conversión K"],
        "Factor K ({value}) fuera de rango razonable [5, 30].",
    ),
    "ERR_PLT_UCS_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_UCS_INCONGRUENTE",
        "CAT_PLT_UCS_INCONGRUENTE",
        ["RCS/UCS (MPa)"],
        "Resistencia UCS ({actual} MPa) diverge de Is(50) * K = {is50} * {k} = {expected} MPa.",
    ),
    "ERR_PLT_RESISTENCIA_ISRM_CATALOGO": ErrorRulePLT(
        "ERR_PLT_RESISTENCIA_ISRM_CATALOGO",
        "CAT_PLT_RESISTENCIA_ISRM_INCONGRUENTE",
        ["Resistencia ISRM"],
        "Resistencia ISRM '{actual}' no coincide con rango esperado '{expected}' para UCS = {ucs_val} MPa.",
    ),
    "ERR_PLT_CELDA_ANOMALA": ErrorRulePLT(
        "ERR_PLT_CELDA_ANOMALA",
        "CAT_PLT_FORMULA_ERROR",
        ["Celda de mapeo"],
        "Celda '{celda}': Contiene errores críticos de fórmula (#VALUE!, #REF!, etc.).",
    ),
    "WRN_PLT_SECUENCIA_DESORDEN": ErrorRulePLT(
        "WRN_PLT_SECUENCIA_DESORDEN",
        "CAT_PLT_SECUENCIA_DESORDEN",
        ["Muestra", "Código de muestra"],
        "Celda '{celda}': Secuencia de muestras en desorden ({secuencia}). Esperado A-B-C-D.",
    ),
    "WRN_PLT_CELDA_INCOMPLETA": ErrorRulePLT(
        "WRN_PLT_CELDA_INCOMPLETA",
        "CAT_PLT_CELDA_INCOMPLETA",
        ["Celda de mapeo", "Código de muestra"],
        "Celda '{celda}': Registro incompleto con {count}/4 muestras ({secuencia}).",
    ),
    "WRN_PLT_CELDA_EXCEDENTE": ErrorRulePLT(
        "WRN_PLT_CELDA_EXCEDENTE",
        "CAT_PLT_CELDA_EXCEDENTE",
        ["Celda de mapeo", "Código de muestra"],
        "Celda '{celda}': Registro excedente con {count}/4 muestras ({secuencia}).",
    ),
}
