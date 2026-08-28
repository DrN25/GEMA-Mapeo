"""
app/core/rules_plt.py — SSOT de Reglas de Validación QA/QC para Ensayos PLT Irregulares.
Centraliza la definición de categorías y reglas de inconsistencia con severidad y mensajes parametrizados.
"""

from typing import Dict, List, Optional


class RuleCategoryPLT:
    def __init__(self, code: str, name: str, severity: str):
        self.code = code
        self.name = name  # Título canónico mostrado en la hoja "Catálogo de Errores"
        self.severity = severity  # 'ALERTA', 'ADVERTENCIA', 'VACIO'


class ErrorRulePLT:
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
# 1. CATEGORÍAS MAESTRAS PLT (SSOT)
# ===========================================================================
CATEGORIES_REGISTRY_PLT: Dict[str, RuleCategoryPLT] = {
    # Vacíos
    "CAT_CAMPO_OBLIGATORIO_VACIO": RuleCategoryPLT(
        "CAT_CAMPO_OBLIGATORIO_VACIO",
        "Campo obligatorio se encuentra vacío.",
        "VACIO"
    ),

    # Grupo 1: Información General
    "CAT_PLT_CAMPANA_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_CAMPANA_INVALIDA",
        "Año de campaña no válido (debe ser un año entre 2000 y 2035).",
        "ALERTA"
    ),
    "CAT_PLT_FECHA_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_FECHA_INVALIDA",
        "Fecha de ensayo con formato no válido o no parseable.",
        "ALERTA"
    ),
    "CAT_PLT_FECHA_FUTURA": RuleCategoryPLT(
        "CAT_PLT_FECHA_FUTURA",
        "Fecha de ensayo posterior a la fecha actual del sistema.",
        "ALERTA"
    ),
    "CAT_PLT_TIPO_ENSAYO_INVALIDO": RuleCategoryPLT(
        "CAT_PLT_TIPO_ENSAYO_INVALIDO",
        "Tipo de ensayo no admitido (debe ser 'i' para irregular).",
        "ALERTA"
    ),

    # Grupo 2: Identificación y Litología
    "CAT_PLT_NIVEL_NO_NUMERICO": RuleCategoryPLT(
        "CAT_PLT_NIVEL_NO_NUMERICO",
        "Valor de nivel contiene caracteres no numéricos.",
        "ALERTA"
    ),
    "CAT_PLT_NIVEL_NEGATIVO": RuleCategoryPLT(
        "CAT_PLT_NIVEL_NEGATIVO",
        "Valor de nivel no puede ser negativo.",
        "ALERTA"
    ),
    "CAT_PLT_NIVEL_LIMITE_EXCEDIDO": RuleCategoryPLT(
        "CAT_PLT_NIVEL_LIMITE_EXCEDIDO",
        "Valor de nivel supera el límite máximo permitido (> 4999).",
        "ALERTA"
    ),
    "CAT_PLT_MUESTRA_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_MUESTRA_INVALIDA",
        "Letra de muestra inválida (debe ser A, B, C o D).",
        "ALERTA"
    ),
    "CAT_PLT_MUESTRA_DUPLICADA": RuleCategoryPLT(
        "CAT_PLT_MUESTRA_DUPLICADA",
        "Muestra duplicada dentro de la misma celda de mapeo en la misma fecha.",
        "ALERTA"
    ),
    "CAT_PLT_CODIGO_MUESTRA_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_CODIGO_MUESTRA_INCONGRUENTE",
        "Código de muestra no coincide con la celda y muestra correspondiente.",
        "ALERTA"
    ),
    "CAT_PLT_LITO1_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_LITO1_INVALIDA",
        "Litología 1 no existe en el catálogo de litologías.",
        "ALERTA"
    ),
    "CAT_PLT_LITOLOGIA_COMBINACION_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_LITOLOGIA_COMBINACION_INVALIDA",
        "Combinación litológica (Lito 1-2-3) no pertenece al catálogo geológico.",
        "ALERTA"
    ),
    "CAT_PLT_TIPO_LITOLOGICO_INVALIDO": RuleCategoryPLT(
        "CAT_PLT_TIPO_LITOLOGICO_INVALIDO",
        "Tipo litológico no pertenece a los 5 grupos admitidos.",
        "ALERTA"
    ),
    "CAT_PLT_TIPO_LITOLOGICO_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_TIPO_LITOLOGICO_INCONGRUENTE",
        "Tipo litológico es incongruente con la combinación Lito 1-2-3.",
        "ALERTA"
    ),

    # Grupo 3: Coordenadas WGS84
    "CAT_PLT_COORD_ESTE_RANGO": RuleCategoryPLT(
        "CAT_PLT_COORD_ESTE_RANGO",
        "Coordenada Este no puede ser menor o igual a cero.",
        "ALERTA"
    ),
    "CAT_PLT_COORD_NORTE_RANGO": RuleCategoryPLT(
        "CAT_PLT_COORD_NORTE_RANGO",
        "Coordenada Norte no puede ser menor o igual a cero.",
        "ALERTA"
    ),
    "CAT_PLT_ELEVACION_RANGO": RuleCategoryPLT(
        "CAT_PLT_ELEVACION_RANGO",
        "Elevación (msnm) no puede ser menor o igual a cero.",
        "ALERTA"
    ),

    # Grupo 4: Geometría
    "CAT_PLT_ESPESOR_D_RANGO": RuleCategoryPLT(
        "CAT_PLT_ESPESOR_D_RANGO",
        "Espesor D (cm) debe ser un valor positivo mayor a cero.",
        "ALERTA"
    ),
    "CAT_PLT_LONGITUD_L_RANGO": RuleCategoryPLT(
        "CAT_PLT_LONGITUD_L_RANGO",
        "Longitud L (cm) debe ser un valor positivo mayor a cero.",
        "ALERTA"
    ),
    "CAT_PLT_ANCHO_W1_RANGO": RuleCategoryPLT(
        "CAT_PLT_ANCHO_W1_RANGO",
        "Ancho W1 (cm) debe ser un valor positivo mayor a cero.",
        "ALERTA"
    ),
    "CAT_PLT_ANCHO_W2_RANGO": RuleCategoryPLT(
        "CAT_PLT_ANCHO_W2_RANGO",
        "Ancho W2 (cm) debe ser un valor positivo mayor a cero.",
        "ALERTA"
    ),
    "CAT_PLT_ANCHO_W_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_ANCHO_W_INCONGRUENTE",
        "Ancho W (cm) no coincide con el promedio de W1 y W2.",
        "ALERTA"
    ),
    "CAT_PLT_MUESTRA_VALIDA_LONG_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_MUESTRA_VALIDA_LONG_INCONGRUENTE",
        "Validación de longitud de muestra (L >= D) es incongruente.",
        "ALERTA"
    ),
    "CAT_PLT_MUESTRA_VALIDA_ANCHO_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_MUESTRA_VALIDA_ANCHO_INCONGRUENTE",
        "Validación de ancho de muestra (0.3W < D < W) es incongruente.",
        "ALERTA"
    ),

    # Grupo 5: Datos de Ensayo
    "CAT_PLT_FUERZA_P_RANGO": RuleCategoryPLT(
        "CAT_PLT_FUERZA_P_RANGO",
        "Fuerza P (kN) debe ser un valor positivo mayor a cero.",
        "ALERTA"
    ),
    "CAT_PLT_DIRECCION_ROTURA_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_DIRECCION_ROTURA_INVALIDA",
        "Dirección de rotura no admitida (debe ser Pa, Pe o NA).",
        "ALERTA"
    ),
    "CAT_PLT_TIPO_FRACTURA_INVALIDO": RuleCategoryPLT(
        "CAT_PLT_TIPO_FRACTURA_INVALIDO",
        "Tipo de fractura no admitido (debe ser M, E o C).",
        "ALERTA"
    ),

    # Grupo 6: Cálculo Is
    "CAT_PLT_DIAMETRO_EQUIV_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_DIAMETRO_EQUIV_INCONGRUENTE",
        "Diámetro equivalente De (cm) no coincide con la fórmula sqrt(4*D*W/pi).",
        "ALERTA"
    ),
    "CAT_PLT_FACTOR_F_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_FACTOR_F_INCONGRUENTE",
        "Factor de corrección F no coincide con la fórmula ((De*10)/50)^0.45.",
        "ALERTA"
    ),
    "CAT_PLT_IS_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_IS_INCONGRUENTE",
        "Índice Is (MPa) no coincide con la fórmula P*1000/(De*10)^2.",
        "ALERTA"
    ),
    "CAT_PLT_IS50_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_IS50_INCONGRUENTE",
        "Índice Is(50) (MPa) no coincide con la fórmula Is * F.",
        "ALERTA"
    ),

    # Grupo 7: Resistencia de Roca
    "CAT_PLT_FACTOR_K_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_FACTOR_K_INCONGRUENTE",
        "Factor de conversión K no coincide con el valor asignado por el catálogo litológico.",
        "ALERTA"
    ),
    "CAT_PLT_FACTOR_K_RANGO": RuleCategoryPLT(
        "CAT_PLT_FACTOR_K_RANGO",
        "Factor de conversión K fuera de rango razonable [5, 30].",
        "ALERTA"
    ),
    "CAT_PLT_UCS_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_UCS_INCONGRUENTE",
        "Resistencia UCS (MPa) no coincide con la fórmula Is(50) * K.",
        "ALERTA"
    ),
    "CAT_PLT_RESISTENCIA_ISRM_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_RESISTENCIA_ISRM_INCONGRUENTE",
        "Clasificación de resistencia ISRM no corresponde al rango de UCS según tabla oficial.",
        "ALERTA"
    ),

    # Global / Excel
    "CAT_PLT_FORMULA_ERROR": RuleCategoryPLT(
        "CAT_PLT_FORMULA_ERROR",
        "La celda contiene un error de evaluación de fórmula (#VALUE!, #REF!, #DIV/0!).",
        "ALERTA"
    ),

    # Integridad de Celdas (Advertencias)
    "CAT_PLT_SECUENCIA_DESORDEN": RuleCategoryPLT(
        "CAT_PLT_SECUENCIA_DESORDEN",
        "Las muestras de la celda de mapeo no se encuentran en orden canónico (A-B-C-D).",
        "ADVERTENCIA"
    ),
    "CAT_PLT_CELDA_INCOMPLETA": RuleCategoryPLT(
        "CAT_PLT_CELDA_INCOMPLETA",
        "La celda de mapeo se encuentra incompleta (posee menos de 4 muestras).",
        "ADVERTENCIA"
    ),
    "CAT_PLT_CELDA_EXCEDENTE": RuleCategoryPLT(
        "CAT_PLT_CELDA_EXCEDENTE",
        "La celda de mapeo posee más de 4 muestras registradas.",
        "ADVERTENCIA"
    ),
}


# ===========================================================================
# 2. REGLAS ESPECÍFICAS PLT (RULES_REGISTRY_PLT)
# ===========================================================================
RULES_REGISTRY_PLT: Dict[str, ErrorRulePLT] = {
    # Vacío
    "ERR_PLT_CAMPO_OBLIGATORIO_VACIO": ErrorRulePLT(
        "ERR_PLT_CAMPO_OBLIGATORIO_VACIO",
        "CAT_CAMPO_OBLIGATORIO_VACIO",
        [],
        "Campo obligatorio se encuentra vacío: '{col_name}'."
    ),

    # Grupo 1: General
    "ERR_PLT_CAMPANA_INVALIDA": ErrorRulePLT(
        "ERR_PLT_CAMPANA_INVALIDA",
        "CAT_PLT_CAMPANA_INVALIDA",
        ["Campaña"],
        "Año de campaña inválido: '{value}'. Debe ser un año de 4 dígitos entre 2000 y 2035."
    ),
    "ERR_PLT_FECHA_INVALIDA": ErrorRulePLT(
        "ERR_PLT_FECHA_INVALIDA",
        "CAT_PLT_FECHA_INVALIDA",
        ["Fecha de ensayo"],
        "Formato de fecha de ensayo no válido o no parseable: '{value}'."
    ),
    "ERR_PLT_FECHA_FUTURA": ErrorRulePLT(
        "ERR_PLT_FECHA_FUTURA",
        "CAT_PLT_FECHA_FUTURA",
        ["Fecha de ensayo"],
        "La fecha de ensayo '{value}' es posterior a la fecha actual del sistema."
    ),
    "ERR_PLT_TIPO_ENSAYO_INVALIDO": ErrorRulePLT(
        "ERR_PLT_TIPO_ENSAYO_INVALIDO",
        "CAT_PLT_TIPO_ENSAYO_INVALIDO",
        ["Tipo de ensayo"],
        "Tipo de ensayo no admitido: '{value}'. Debe ser 'i' (Irregular)."
    ),

    # Grupo 2: Muestra y Litología
    "ERR_PLT_NIVEL_NO_NUMERICO": ErrorRulePLT(
        "ERR_PLT_NIVEL_NO_NUMERICO",
        "CAT_PLT_NIVEL_NO_NUMERICO",
        ["Nivel"],
        "El nivel ingresado '{value}' no es un valor numérico válido."
    ),
    "ERR_PLT_NIVEL_NEGATIVO": ErrorRulePLT(
        "ERR_PLT_NIVEL_NEGATIVO",
        "CAT_PLT_NIVEL_NEGATIVO",
        ["Nivel"],
        "El nivel ingresado ({value}) no puede ser un valor negativo."
    ),
    "ERR_PLT_NIVEL_LIMITE_EXCEDIDO": ErrorRulePLT(
        "ERR_PLT_NIVEL_LIMITE_EXCEDIDO",
        "CAT_PLT_NIVEL_LIMITE_EXCEDIDO",
        ["Nivel"],
        "El nivel ingresado ({value}) supera el límite máximo permitido (4999)."
    ),
    "ERR_PLT_MUESTRA_INVALIDA": ErrorRulePLT(
        "ERR_PLT_MUESTRA_INVALIDA",
        "CAT_PLT_MUESTRA_INVALIDA",
        ["Muestra"],
        "Letra de muestra inválida: '{value}'. Debe ser A, B, C o D."
    ),
    "ERR_PLT_MUESTRA_DUPLICADA_EN_CELDA": ErrorRulePLT(
        "ERR_PLT_MUESTRA_DUPLICADA_EN_CELDA",
        "CAT_PLT_MUESTRA_DUPLICADA",
        ["Muestra", "Celda de mapeo"],
        "Muestra duplicada '{muestra}' para la celda '{celda}' en fecha '{fecha}'."
    ),
    "ERR_PLT_CODIGO_MUESTRA_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_CODIGO_MUESTRA_INCONGRUENTE",
        "CAT_PLT_CODIGO_MUESTRA_INCONGRUENTE",
        ["Código de muestra"],
        "Código de muestra '{actual}' no coincide con la celda '{celda}' y muestra '{muestra}' (esperado: '{expected}')."
    ),
    "ERR_PLT_LITO1_INVALIDA": ErrorRulePLT(
        "ERR_PLT_LITO1_INVALIDA",
        "CAT_PLT_LITO1_INVALIDA",
        ["Litología 1"],
        "Litología 1 '{value}' no existe en el catálogo geológico de litologías."
    ),
    "ERR_PLT_LITOLOGIA_COMBINACION_INVALIDA": ErrorRulePLT(
        "ERR_PLT_LITOLOGIA_COMBINACION_INVALIDA",
        "CAT_PLT_LITOLOGIA_COMBINACION_INVALIDA",
        ["Litología 1", "Litología 2", "Litología 3"],
        "Combinación litológica (Lito 1: '{l1}', Lito 2: '{l2}', Lito 3: '{l3}') no existe en el catálogo."
    ),
    "ERR_PLT_TIPO_LITOLOGICO_INVALIDO": ErrorRulePLT(
        "ERR_PLT_TIPO_LITOLOGICO_INVALIDO",
        "CAT_PLT_TIPO_LITOLOGICO_INVALIDO",
        ["Tipo litológico"],
        "Tipo litológico '{value}' no pertenece a los 5 grupos admitidos (INTRUSIVOS, SEDIMENTARIOS, METAMORFICAS, BRECHAS, ENDOSKARN)."
    ),
    "ERR_PLT_TIPO_LITOLOGICO_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_TIPO_LITOLOGICO_INCONGRUENTE",
        "CAT_PLT_TIPO_LITOLOGICO_INCONGRUENTE",
        ["Tipo litológico"],
        "Tipo litológico '{actual}' no coincide con el grupo geológico '{expected}' correspondiente a la litología."
    ),

    # Grupo 3: Coordenadas
    "ERR_PLT_COORD_ESTE_RANGO": ErrorRulePLT(
        "ERR_PLT_COORD_ESTE_RANGO",
        "CAT_PLT_COORD_ESTE_RANGO",
        ["Este (m)"],
        "Coordenada Este ({value}) no puede ser menor o igual a cero."
    ),
    "ERR_PLT_COORD_NORTE_RANGO": ErrorRulePLT(
        "ERR_PLT_COORD_NORTE_RANGO",
        "CAT_PLT_COORD_NORTE_RANGO",
        ["Norte (m)"],
        "Coordenada Norte ({value}) no puede ser menor o igual a cero."
    ),
    "ERR_PLT_ELEVACION_RANGO": ErrorRulePLT(
        "ERR_PLT_ELEVACION_RANGO",
        "CAT_PLT_ELEVACION_RANGO",
        ["Elevación (msnm)"],
        "Elevación ({value} msnm) no puede ser menor o igual a cero."
    ),

    # Grupo 4: Geometría
    "ERR_PLT_ESPESOR_D_RANGO": ErrorRulePLT(
        "ERR_PLT_ESPESOR_D_RANGO",
        "CAT_PLT_ESPESOR_D_RANGO",
        ["Espesor D (cm)"],
        "Espesor D ({value} cm) debe ser mayor a cero."
    ),
    "ERR_PLT_LONGITUD_L_RANGO": ErrorRulePLT(
        "ERR_PLT_LONGITUD_L_RANGO",
        "CAT_PLT_LONGITUD_L_RANGO",
        ["Longitud L (cm)"],
        "Longitud L ({value} cm) debe ser mayor a cero."
    ),
    "ERR_PLT_ANCHO_W1_RANGO": ErrorRulePLT(
        "ERR_PLT_ANCHO_W1_RANGO",
        "CAT_PLT_ANCHO_W1_RANGO",
        ["Ancho W1 (cm)"],
        "Ancho W1 ({value} cm) debe ser mayor a cero."
    ),
    "ERR_PLT_ANCHO_W2_RANGO": ErrorRulePLT(
        "ERR_PLT_ANCHO_W2_RANGO",
        "CAT_PLT_ANCHO_W2_RANGO",
        ["Ancho W2 (cm)"],
        "Ancho W2 ({value} cm) debe ser mayor a cero."
    ),
    "ERR_PLT_ANCHO_W_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_ANCHO_W_INCONGRUENTE",
        "CAT_PLT_ANCHO_W_INCONGRUENTE",
        ["Ancho W (cm)"],
        "Ancho W ingresado ({actual} cm) difiere del promedio de W1 ({w1}) y W2 ({w2}) -> esperado: {expected} cm."
    ),
    "ERR_PLT_MUESTRA_VALIDA_LONG_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_MUESTRA_VALIDA_LONG_INCONGRUENTE",
        "CAT_PLT_MUESTRA_VALIDA_LONG_INCONGRUENTE",
        ["Muestra válida - longitud"],
        "Muestra válida longitud ingresada '{actual}' es incongruente con L={l_val} y D={d_val} (esperado: '{expected}')."
    ),
    "ERR_PLT_MUESTRA_VALIDA_ANCHO_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_MUESTRA_VALIDA_ANCHO_INCONGRUENTE",
        "CAT_PLT_MUESTRA_VALIDA_ANCHO_INCONGRUENTE",
        ["Muestra válida - ancho"],
        "Muestra válida ancho ingresada '{actual}' es incongruente con D={d_val} y W={w_val} (esperado: '{expected}')."
    ),

    # Grupo 5: Datos Ensayo
    "ERR_PLT_FUERZA_P_RANGO": ErrorRulePLT(
        "ERR_PLT_FUERZA_P_RANGO",
        "CAT_PLT_FUERZA_P_RANGO",
        ["Fuerza P (kN)"],
        "Fuerza P ({value} kN) debe ser un valor mayor a cero."
    ),
    "ERR_PLT_DIRECCION_ROTURA_INVALIDA": ErrorRulePLT(
        "ERR_PLT_DIRECCION_ROTURA_INVALIDA",
        "CAT_PLT_DIRECCION_ROTURA_INVALIDA",
        ["Dirección de rotura"],
        "Dirección de rotura '{value}' no admitida. Debe ser Pa, Pe o NA."
    ),
    "ERR_PLT_TIPO_FRACTURA_INVALIDO": ErrorRulePLT(
        "ERR_PLT_TIPO_FRACTURA_INVALIDO",
        "CAT_PLT_TIPO_FRACTURA_INVALIDO",
        ["Tipo de fractura"],
        "Tipo de fractura '{value}' no admitido. Debe ser M, E o C."
    ),

    # Grupo 6: Cálculo Is
    "ERR_PLT_DIAMETRO_EQUIV_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_DIAMETRO_EQUIV_INCONGRUENTE",
        "CAT_PLT_DIAMETRO_EQUIV_INCONGRUENTE",
        ["Diametro equivalente (cm)"],
        "Diámetro equivalente De ingresado ({actual} cm) difiere del cálculo sqrt(4*D*W/pi) -> esperado: {expected} cm."
    ),
    "ERR_PLT_FACTOR_F_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_FACTOR_F_INCONGRUENTE",
        "CAT_PLT_FACTOR_F_INCONGRUENTE",
        ["F"],
        "Factor de corrección F ingresado ({actual}) difiere del cálculo ((De*10)/50)^0.45 -> esperado: {expected}."
    ),
    "ERR_PLT_IS_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_IS_INCONGRUENTE",
        "CAT_PLT_IS_INCONGRUENTE",
        ["Is (MPa)"],
        "Índice Is ingresado ({actual} MPa) difiere del cálculo P*1000/(De*10)^2 -> esperado: {expected} MPa."
    ),
    "ERR_PLT_IS50_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_IS50_INCONGRUENTE",
        "CAT_PLT_IS50_INCONGRUENTE",
        ["Is(50) (MPa)"],
        "Índice Is(50) ingresado ({actual} MPa) difiere del cálculo Is * F -> esperado: {expected}."
    ),

    # Grupo 7: Resistencia de Roca
    "ERR_PLT_FACTOR_K_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_FACTOR_K_INCONGRUENTE",
        "CAT_PLT_FACTOR_K_INCONGRUENTE",
        ["Factor de conversión K"],
        "Factor K ingresado ({actual}) difiere del valor teórico asignado por el catálogo litológico ({expected})."
    ),
    "ERR_PLT_FACTOR_K_RANGO": ErrorRulePLT(
        "ERR_PLT_FACTOR_K_RANGO",
        "CAT_PLT_FACTOR_K_RANGO",
        ["Factor de conversión K"],
        "Factor K ingresado ({value}) fuera de rango permitido [5, 30]."
    ),
    "ERR_PLT_UCS_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_UCS_INCONGRUENTE",
        "CAT_PLT_UCS_INCONGRUENTE",
        ["RCS/UCS (MPa)"],
        "Resistencia UCS ingresada ({actual} MPa) difiere del cálculo Is(50) * K -> esperado: {expected} MPa."
    ),
    "ERR_PLT_RESISTENCIA_ISRM_INCONGRUENTE": ErrorRulePLT(
        "ERR_PLT_RESISTENCIA_ISRM_INCONGRUENTE",
        "CAT_PLT_RESISTENCIA_ISRM_INCONGRUENTE",
        ["Resistencia ISRM"],
        "Resistencia ISRM ingresada '{actual}' no corresponde al rango de UCS ({ucs_val} MPa) -> esperado: '{expected}'."
    ),

    # Global / Excel
    "ERR_PLT_FORMULA_ERROR": ErrorRulePLT(
        "ERR_PLT_FORMULA_ERROR",
        "CAT_PLT_FORMULA_ERROR",
        [],
        "Celda con error de fórmula de Excel en columna '{col_name}': '{value}'."
    ),

    # Integridad Celdas ABCD
    "WRN_PLT_SECUENCIA_DESORDEN": ErrorRulePLT(
        "WRN_PLT_SECUENCIA_DESORDEN",
        "CAT_PLT_SECUENCIA_DESORDEN",
        ["Celda de mapeo", "Muestra"],
        "Celda '{celda}': Orden de muestras alterado ({secuencia}). Debe ser A-B-C-D."
    ),
    "WRN_PLT_CELDA_INCOMPLETA": ErrorRulePLT(
        "WRN_PLT_CELDA_INCOMPLETA",
        "CAT_PLT_CELDA_INCOMPLETA",
        ["Celda de mapeo", "Muestra"],
        "Celda '{celda}': Registro incompleto con {count}/4 muestras ({secuencia})."
    ),
    "WRN_PLT_CELDA_EXCEDENTE": ErrorRulePLT(
        "WRN_PLT_CELDA_EXCEDENTE",
        "CAT_PLT_CELDA_EXCEDENTE",
        ["Celda de mapeo", "Muestra"],
        "Celda '{celda}': Posee más de 4 muestras ({count}/4) ({secuencia})."
    ),
}
