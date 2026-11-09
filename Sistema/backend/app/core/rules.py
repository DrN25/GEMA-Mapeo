# backend/app/core/rules.py

class RuleCategory:
    def __init__(self, code: str, name: str, severity: str):
        self.code = code
        self.name = name  # This is the title/message shown in the "Catálogo de Errores" sheet
        self.severity = severity


class ErrorRule:
    def __init__(
        self, 
        code: str, 
        category_code: str, 
        columns: list, 
        message_template: str,
        description: str = "",
        technical_formula: str = "",
        example_ok: str = "",
        example_error: str = "",
        tipo_mapeo: str = "Mapeo de Celdas"
    ):
        self.code = code
        self.category_code = category_code
        self.columns = columns
        self.message_template = message_template
        self.description = description
        self.technical_formula = technical_formula
        self.example_ok = example_ok
        self.example_error = example_error
        self.tipo_mapeo = tipo_mapeo

    def format_message(self, **kwargs) -> str:
        try:
            return self.message_template.format(**kwargs)
        except Exception:
            # Fallback in case of formatting error
            return self.message_template


# 1. CATEGORÍAS MAESTRAS (Reemplaza la lista estática y desordenada anterior)
CATEGORIES_REGISTRY = {
    # Alertas (Física, Rangos y Catálogos obligatorios)
    "CAT_DIP_TALUD_RANGO": RuleCategory(
        "CAT_DIP_TALUD_RANGO", 
        "Ángulo del talud fuera del rango [-90, 90] grados.", 
        "ALERTA"
    ),
    "CAT_AGUA_CODIGO_INVALIDO": RuleCategory(
        "CAT_AGUA_CODIGO_INVALIDO", 
        "Código de agua '76 / '89 no admitido. Debe ser C, H, M, E o F.", 
        "ALERTA"
    ),
    "CAT_AGUA_LIMITE_EXCEDIDO": RuleCategory(
        "CAT_AGUA_LIMITE_EXCEDIDO", 
        "Valor de agua '76 / '89 fuera del rango de la escala.", 
        "ALERTA"
    ),
    "CAT_AGUA_INCONGRUENTE": RuleCategory(
        "CAT_AGUA_INCONGRUENTE", 
        "El valor de agua '76 / '89 no coincide con el código.", 
        "ALERTA"
    ),
    "CAT_DUREZA_INVALIDA": RuleCategory(
        "CAT_DUREZA_INVALIDA", 
        "Dureza '76 / '89 no admitida. Debe ser R0 a R6.", 
        "ALERTA"
    ),
    "CAT_RESISTENCIA_LIMITE_EXCEDIDO": RuleCategory(
        "CAT_RESISTENCIA_LIMITE_EXCEDIDO", 
        "Puntaje de resistencia '76 / '89 fuera del rango permitido.", 
        "ALERTA"
    ),
    "CAT_RESISTENCIA_INCONGRUENTE": RuleCategory(
        "CAT_RESISTENCIA_INCONGRUENTE", 
        "El puntaje de resistencia '76 / '89 no coincide con la dureza.", 
        "ALERTA"
    ),
    "CAT_CONTROL_ESTRUCTURAL_FUERA_LIMITES": RuleCategory(
        "CAT_CONTROL_ESTRUCTURAL_FUERA_LIMITES", 
        "Control estructural '76 / '89 fuera de límites permitidos [1, 5].", 
        "ALERTA"
    ),
    "CAT_EFECTOS_VOLADURA_EXCEDE_ESCALA": RuleCategory(
        "CAT_EFECTOS_VOLADURA_EXCEDE_ESCALA", 
        "Efecto de voladura '76 / '89 fuera de la escala [1, 6].", 
        "ALERTA"
    ),
    "CAT_RQD_SUPERIOR_100": RuleCategory(
        "CAT_RQD_SUPERIOR_100", 
        "Porcentaje de RQD '76 / '89 no puede ser superior al 100%.", 
        "ALERTA"
    ),
    "CAT_RQD_INCONGRUENTE": RuleCategory(
        "CAT_RQD_INCONGRUENTE", 
        "El puntaje de RQD '76 / '89 no coincide con el porcentaje.", 
        "ALERTA"
    ),
    "CAT_ESPACIAMIENTO_PROMEDIO_CERO": RuleCategory(
        "CAT_ESPACIAMIENTO_PROMEDIO_CERO", 
        "El espaciamiento promedio '76 / '89 no puede ser 0.0 m (debe ser mayor a cero).", 
        "ALERTA"
    ),
    "CAT_ESPACIAMIENTO_PROMEDIO_NEGATIVO": RuleCategory(
        "CAT_ESPACIAMIENTO_PROMEDIO_NEGATIVO", 
        "El espaciamiento promedio '76 / '89 debe ser positivo.", 
        "ALERTA"
    ),
    "CAT_ESPACIAMIENTO_RATING_RANGO": RuleCategory(
        "CAT_ESPACIAMIENTO_RATING_RANGO", 
        "Puntaje de espaciamiento '76 / '89 fuera de rango.", 
        "ALERTA"
    ),
    "CAT_ESPACIAMIENTO_NO_ALINEADO": RuleCategory(
        "CAT_ESPACIAMIENTO_NO_ALINEADO", 
        "El puntaje de espaciamiento '76 / '89 no coincide con el promedio.", 
        "ALERTA"
    ),
    "CAT_TIPO_ESTRUCTURA_INVALIDO": RuleCategory(
        "CAT_TIPO_ESTRUCTURA_INVALIDO", 
        "Tipo de estructura geológica no permitida.", 
        "ALERTA"
    ),
    "CAT_RELLENO_INVALIDO": RuleCategory(
        "CAT_RELLENO_INVALIDO", 
        "Tipo de relleno no pertenece al catálogo.", 
        "ALERTA"
    ),
    "CAT_JRC_RANGO": RuleCategory(
        "CAT_JRC_RANGO", 
        "Valor JRC fuera de rango permitido [0, 20].", 
        "ALERTA"
    ),
    "CAT_RUGOSIDAD_RANGO": RuleCategory(
        "CAT_RUGOSIDAD_RANGO", 
        "Clase de rugosidad de junta fuera de límites [1, 9].", 
        "ALERTA"
    ),
    "CAT_FORMA_ESTRUCTURA_INVALIDA": RuleCategory(
        "CAT_FORMA_ESTRUCTURA_INVALIDA", 
        "Forma de estructura inválida. Debe ser P, C, O, E o I.", 
        "ALERTA"
    ),
    "CAT_ALTERACION_INVALIDA": RuleCategory(
        "CAT_ALTERACION_INVALIDA", 
        "Código de alteración inválido.", 
        "ALERTA"
    ),
    "CAT_ESPESOR_SUPERIOR_ABERTURA": RuleCategory(
        "CAT_ESPESOR_SUPERIOR_ABERTURA", 
        "Espesor del relleno es superior a la abertura total.", 
        "ALERTA"
    ),
    "CAT_ABERTURA_EXCEDE_CELDA": RuleCategory(
        "CAT_ABERTURA_EXCEDE_CELDA", 
        "La abertura de la falla supera la longitud de la celda.", 
        "ALERTA"
    ),
    "CAT_UCS_DIVERGENTE_IS50": RuleCategory(
        "CAT_UCS_DIVERGENTE_IS50", 
        "Los valores de UCS e Is50 no guardan relación física válida.", 
        "ALERTA"
    ),
    "CAT_LITOLOGIA_COMBINACION_INVALIDA": RuleCategory(
        "CAT_LITOLOGIA_COMBINACION_INVALIDA", 
        "Combinación litológica Lito 1-2-3 inválida según el catálogo.", 
        "ALERTA"
    ),
    "CAT_UNIDAD_LITOLOGICA_INCONGRUENTE": RuleCategory(
        "CAT_UNIDAD_LITOLOGICA_INCONGRUENTE", 
        "La unidad litológica no coincide con la litología.", 
        "ALERTA"
    ),
    "CAT_DIP_ESTRUC_RANGO": RuleCategory(
        "CAT_DIP_ESTRUC_RANGO", 
        "Valor de inclinación (Dip) fuera de rango permitido [-90, 90] grados.", 
        "ALERTA"
    ),

    "CAT_ESPESOR_NEGATIVO": RuleCategory(
        "CAT_ESPESOR_NEGATIVO", 
        "El espesor del relleno no puede ser un valor negativo.", 
        "ALERTA"
    ),
    "CAT_ABERTURA_NEGATIVO": RuleCategory(
        "CAT_ABERTURA_NEGATIVO", 
        "La abertura total no puede ser un valor negativo.", 
        "ALERTA"
    ),
    "CAT_CONTINUIDAD_NEGATIVA": RuleCategory(
        "CAT_CONTINUIDAD_NEGATIVA", 
        "La continuidad no puede ser un valor negativo.", 
        "ALERTA"
    ),
    "CAT_ESPACIAMIENTO_NEGATIVO": RuleCategory(
        "CAT_ESPACIAMIENTO_NEGATIVO", 
        "El espaciamiento no puede ser un valor negativo.", 
        "ALERTA"
    ),
    "CAT_NUMERO_ESTRUCTURAS_DECIMAL": RuleCategory(
        "CAT_NUMERO_ESTRUCTURAS_DECIMAL", 
        "En número de estructuras solamente se permiten números enteros.", 
        "ALERTA"
    ),
    "CAT_CELDA_PADRE_MISSING": RuleCategory(
        "CAT_CELDA_PADRE_MISSING", 
        "La fila no tiene una celda de mapeo asociada en CELDA.", 
        "ALERTA"
    ),

    # Advertencias de Consistencia y Formato
    "CAT_AGUA_VALOR_MEDIO": RuleCategory(
        "CAT_AGUA_VALOR_MEDIO", 
        "El valor de agua '76 / '89 no es un valor estándar del catálogo.", 
        "ADVERTENCIA"
    ),
    "CAT_RESISTENCIA_VALOR_ALEJADO": RuleCategory(
        "CAT_RESISTENCIA_VALOR_ALEJADO", 
        "El puntaje de resistencia '76 / '89 no coincide con el catálogo.", 
        "ADVERTENCIA"
    ),
    "CAT_EFECTOS_VOLADURA_VALOR_MEDIO": RuleCategory(
        "CAT_EFECTOS_VOLADURA_VALOR_MEDIO", 
        "El puntaje de efectos de voladura '76 / '89 no es un valor estándar del catálogo.", 
        "ADVERTENCIA"
    ),
    "CAT_RQD_VAL_VALOR_ALEJADO": RuleCategory(
        "CAT_RQD_VAL_VALOR_ALEJADO", 
        "El puntaje de RQD '76 / '89 no coincide con el catálogo.", 
        "ADVERTENCIA"
    ),
    "CAT_ESPACIAMIENTO_VALOR_MEDIO": RuleCategory(
        "CAT_ESPACIAMIENTO_VALOR_MEDIO", 
        "El puntaje de espaciamiento '76 / '89 no es un valor estándar del catálogo.", 
        "ADVERTENCIA"
    ),
    "CAT_TIPO_ESTRUCTURA_J": RuleCategory(
        "CAT_TIPO_ESTRUCTURA_J", 
        "Tipo de estructura geológica 'J' debe normalizarse a 'JN'.", 
        "ADVERTENCIA"
    ),
    "CAT_UCS_VS_IS50_K_DIVERGENTE": RuleCategory(
        "CAT_UCS_VS_IS50_K_DIVERGENTE", 
        "El valor de UCS difiere del producto Is50 * K.", 
        "ADVERTENCIA"
    ),
    
    # RMR y Consistencia Geométrica de Dips y Coordenadas
    "CAT_RMR_CERO": RuleCategory(
        "CAT_RMR_CERO",
        "El valor de RMR '76 / '89 no puede ser 0.",
        "ALERTA"
    ),
    "CAT_DIP_TALUD_DISCREPANCIA": RuleCategory(
        "CAT_DIP_TALUD_DISCREPANCIA",
        "Diferencia entre DIP_TALUD y el valor esperado de la celda.",
        "ADVERTENCIA"
    ),
    "CAT_DIP_DISCREPANCIA_COORD": RuleCategory(
        "CAT_DIP_DISCREPANCIA_COORD",
        "Diferencia entre DIP y el calculado por coordenadas.",
        "ADVERTENCIA"
    ),
    "CAT_AZ_HOLE_DISCREPANCIA": RuleCategory(
        "CAT_AZ_HOLE_DISCREPANCIA",
        "Diferencia entre AZ_HOLE y el calculado por coordenadas.",
        "ADVERTENCIA"
    ),

    # Nuevas Categorías Geométricas, Duplicados y Estructurales
    "CAT_GEOM_COORDENADAS": RuleCategory(
        "CAT_GEOM_COORDENADAS",
        "Coordenadas fuera del rango del proyecto.",
        "ALERTA"
    ),
    "CAT_GEOM_LONGITUD": RuleCategory(
        "CAT_GEOM_LONGITUD",
        "Celda con distancia cero (FROM y TO iguales).",
        "ALERTA"
    ),
    "CAT_GEOM_NIVEL": RuleCategory(
        "CAT_GEOM_NIVEL",
        "Diferencia entre la Cota promedio y el Nivel.",
        "ADVERTENCIA"
    ),
    "CAT_DUPLICADOS_CELDA": RuleCategory(
        "CAT_DUPLICADOS_CELDA",
        "Código de celda repetido en el archivo.",
        "ALERTA"
    ),
    "CAT_DUPLICADOS_GEOMETRIA": RuleCategory(
        "CAT_DUPLICADOS_GEOMETRIA",
        "Coordenadas FROM-TO repetidas en otra celda.",
        "ALERTA"
    ),
    "CAT_DISTANCIA_CELDA": RuleCategory(
        "CAT_DISTANCIA_CELDA",
        "Diferencia entre Dist.Celda y coordenadas 3D.",
        "ALERTA"
    ),
    "CAT_ESTRUCTURA_LIMITES": RuleCategory(
        "CAT_ESTRUCTURA_LIMITES",
        "Dist. de estr. supera la longitud de la celda.",
        "ALERTA"
    ),
    "CAT_ESTRUCTURA_GEOMETRIA": RuleCategory(
        "CAT_ESTRUCTURA_GEOMETRIA",
        "Coordenadas (x, y, z) de la estructura fuera de la línea de la celda.",
        "ALERTA"
    ),
    "CAT_ESTRUCTURA_CALCULO": RuleCategory(
        "CAT_ESTRUCTURA_CALCULO",
        "Diferencia entre coordenadas declaradas (x, y, z) y coordenadas calculadas.",
        "ADVERTENCIA"
    ),

    # Vacíos
    "CAT_CAMPO_OBLIGATORIO_VACIO": RuleCategory(
        "CAT_CAMPO_OBLIGATORIO_VACIO", 
        "Campo obligatorio se encuentra vacío.", 
        "VACIO"
    )
}

# =============================================================================
# UMBRALES Y PARÁMETROS GEOMECÁNICOS DEL PROYECTO (SSOT CENTRALIZADO)
# =============================================================================
# Edita aquí los límites y tolerancias para que se sincronicen automáticamente
# tanto en el motor de validación del Excel como en el Diccionario de Reglas.
GEOMECHANICAL_THRESHOLDS = {
    # Coordenadas UTM y Elevaciones del tajo del proyecto
    "COORD_ESTE_MIN": 790000.0,
    "COORD_ESTE_MAX": 795000.0,
    "COORD_NORTE_MIN": 8400000.0,
    "COORD_NORTE_MAX": 8450000.0,
    "COORD_COTA_MIN": 3400.0,  # Límite inferior de cota (actualizado a 3400)
    "COORD_COTA_MAX": 4500.0,

    # Coherencia Cota promedio vs Nivel declarado (bancos separados 15 m)
    "COTA_VS_NIVEL_MAX_DIFF": 20.0,

    # Coherencia Distancia Euclidiana 3D vs Dist.Celda declarada
    "DISTANCIA_CELDA_MAX_DIFF": 0.30,

    # Tolerancia longitud estructura vs ventana (+0.03 m = 3 cm)
    "ESTRUCTURA_DISTANCIA_TOLERANCIA": 0.03,

    # Tolerancia ortogonal y angular de estructura (+0.30 m = 30 cm)
    "ESTRUCTURA_COORD_TOLERANCIA": 0.30,
}


# 2. REGLAS ESPECÍFICAS DE ERROR
RULES_REGISTRY = {
    # DIP_TALUD
    "ERR_DIP_TALUD_RANGO": ErrorRule(
        "ERR_DIP_TALUD_RANGO",
        "CAT_DIP_TALUD_RANGO",
        ["DIP_TALUD"],
        "Ángulo del talud fuera del rango [-90, 90] grados. Valor actual de DIP_TALUD: {value}°."
    ),

    # CONDICION DE AGUA
    "ERR_AGUA_76_CODIGO_INVALIDO": ErrorRule(
        "ERR_AGUA_76_CODIGO_INVALIDO",
        "CAT_AGUA_CODIGO_INVALIDO",
        ["CONDICION DE AGUA  '76."],
        "Código de agua '76 no admitido. Valor ingresado: '{value}'. Debe ser uno de {allowed_codes} (C, H, M, E, F)."
    ),
    "ERR_AGUA_89_CODIGO_INVALIDO": ErrorRule(
        "ERR_AGUA_89_CODIGO_INVALIDO",
        "CAT_AGUA_CODIGO_INVALIDO",
        ["CONDICION DE AGUA  '89"],
        "Código de agua '89 no admitido. Valor ingresado: '{value}'. Debe ser uno de {allowed_codes} (C, H, M, E, F)."
    ),
    "ERR_AGUA_76_LIMITE_EXCEDIDO": ErrorRule(
        "ERR_AGUA_76_LIMITE_EXCEDIDO",
        "CAT_AGUA_LIMITE_EXCEDIDO",
        ["CONDICION DE AGUA VALOR  '76"],
        "El valor de agua '76 ({value}) está fuera de la escala [0, 10]."
    ),
    "ERR_AGUA_89_LIMITE_EXCEDIDO": ErrorRule(
        "ERR_AGUA_89_LIMITE_EXCEDIDO",
        "CAT_AGUA_LIMITE_EXCEDIDO",
        ["CONDICION DE AGUA VALOR '89"],
        "El valor de agua '89 ({value}) está fuera de la escala [0, 15]."
    ),
    "ERR_AGUA_76_INCONGRUENTE": ErrorRule(
        "ERR_AGUA_76_INCONGRUENTE",
        "CAT_AGUA_INCONGRUENTE",
        ["CONDICION DE AGUA VALOR  '76", "CONDICION DE AGUA  '76."],
        "El valor de agua '76 ({value}) no coincide con el código '{code_val}'. Debe ser {expected}."
    ),
    "ERR_AGUA_89_INCONGRUENTE": ErrorRule(
        "ERR_AGUA_89_INCONGRUENTE",
        "CAT_AGUA_INCONGRUENTE",
        ["CONDICION DE AGUA VALOR '89", "CONDICION DE AGUA  '89"],
        "El valor de agua '89 ({value}) no coincide con el código '{code_val}'. Debe ser {expected}."
    ),
    "WRN_AGUA_76_VALOR_MEDIO": ErrorRule(
        "WRN_AGUA_76_VALOR_MEDIO",
        "CAT_AGUA_VALOR_MEDIO",
        ["CONDICION DE AGUA VALOR  '76"],
        "El valor de agua '76 ({value}) no es un valor estándar del catálogo. Opciones: [10, 7, 4, 0]."
    ),
    "WRN_AGUA_89_VALOR_MEDIO": ErrorRule(
        "WRN_AGUA_89_VALOR_MEDIO",
        "CAT_AGUA_VALOR_MEDIO",
        ["CONDICION DE AGUA VALOR '89"],
        "El valor de agua '89 ({value}) no es un valor estándar del catálogo. Opciones: [15, 10, 7, 4, 0]."
    ),

    # DUREZA & RESISTENCIA
    "ERR_DUREZA_76_INVALIDA": ErrorRule(
        "ERR_DUREZA_76_INVALIDA",
        "CAT_DUREZA_INVALIDA",
        ["DUREZA  '76"],
        "Dureza '76 '{value}' no admitida. Debe ser R0 a R6."
    ),
    "ERR_DUREZA_89_INVALIDA": ErrorRule(
        "ERR_DUREZA_89_INVALIDA",
        "CAT_DUREZA_INVALIDA",
        ["DUREZA '89"],
        "Dureza '89 '{value}' no admitida. Debe ser R0 a R6."
    ),
    "ERR_RESISTENCIA_76_LIMITE_EXCEDIDO": ErrorRule(
        "ERR_RESISTENCIA_76_LIMITE_EXCEDIDO",
        "CAT_RESISTENCIA_LIMITE_EXCEDIDO",
        ["RESISTENCIA ESTIMADA VALOR  '76"],
        "El puntaje de resistencia '76 ({value}) está fuera de la escala [0, 15]."
    ),
    "ERR_RESISTENCIA_89_LIMITE_EXCEDIDO": ErrorRule(
        "ERR_RESISTENCIA_89_LIMITE_EXCEDIDO",
        "CAT_RESISTENCIA_LIMITE_EXCEDIDO",
        ["RESISTENCIA ESTIMADA VALOR '89"],
        "El puntaje de resistencia '89 ({value}) está fuera de la escala [0, 15]."
    ),
    "ERR_RESISTENCIA_76_INCONGRUENTE": ErrorRule(
        "ERR_RESISTENCIA_76_INCONGRUENTE",
        "CAT_RESISTENCIA_INCONGRUENTE",
        ["RESISTENCIA ESTIMADA VALOR  '76", "DUREZA  '76"],
        "El puntaje de resistencia '76 ({value}) no coincide con la dureza '{dureza_val}'. Debe ser {expected} (tolerancia ±0.2)."
    ),
    "ERR_RESISTENCIA_89_INCONGRUENTE": ErrorRule(
        "ERR_RESISTENCIA_89_INCONGRUENTE",
        "CAT_RESISTENCIA_INCONGRUENTE",
        ["RESISTENCIA ESTIMADA VALOR '89", "DUREZA '89"],
        "El puntaje de resistencia '89 ({value}) no coincide con la dureza '{dureza_val}'. Debe estar en el rango {expected}."
    ),
    "WRN_RESISTENCIA_76_VALOR_ALEJADO": ErrorRule(
        "WRN_RESISTENCIA_76_VALOR_ALEJADO",
        "CAT_RESISTENCIA_VALOR_ALEJADO",
        ["RESISTENCIA ESTIMADA VALOR  '76"],
        "El puntaje de resistencia '76 ({value}) no coincide con los valores del catálogo: [0, 1, 2, 4, 7, 12, 15]."
    ),
    "WRN_RESISTENCIA_89_VALOR_ALEJADO": ErrorRule(
        "WRN_RESISTENCIA_89_VALOR_ALEJADO",
        "CAT_RESISTENCIA_VALOR_ALEJADO",
        ["RESISTENCIA ESTIMADA VALOR '89"],
        "El puntaje de resistencia '89 ({value}) está fuera de los límites del catálogo. Rangos válidos: R0 (0.0), R1 (1.5) o R2-R6 (1.5 a 15.0)."
    ),

    # CONTROL ESTRUCTURAL
    "ERR_CONTROL_ESTRUCTURAL_76_FUERA_LIMITES": ErrorRule(
        "ERR_CONTROL_ESTRUCTURAL_76_FUERA_LIMITES",
        "CAT_CONTROL_ESTRUCTURAL_FUERA_LIMITES",
        ["CONTROL ESTRUCTURAL  '76"],
        "Control estructural '76 fuera de límites permitidos [1, 5]. Valor ingresado: {value}."
    ),
    "ERR_CONTROL_ESTRUCTURAL_89_FUERA_LIMITES": ErrorRule(
        "ERR_CONTROL_ESTRUCTURAL_89_FUERA_LIMITES",
        "CAT_CONTROL_ESTRUCTURAL_FUERA_LIMITES",
        ["CONTROL ESTRUCTURAL '89"],
        "Control estructural '89 fuera de límites permitidos [1, 5]. Valor ingresado: {value}."
    ),

    # EFECTOS DE VOLADURA
    "ERR_EFECTOS_VOLADURA_76_EXCEDE_ESCALA": ErrorRule(
        "ERR_EFECTOS_VOLADURA_76_EXCEDE_ESCALA",
        "CAT_EFECTOS_VOLADURA_EXCEDE_ESCALA",
        ["EFECTOS DE VOLADURA  '76"],
        "El efecto de voladura '76 ({value}) está fuera de la escala [1, 6]."
    ),
    "ERR_EFECTOS_VOLADURA_89_EXCEDE_ESCALA": ErrorRule(
        "ERR_EFECTOS_VOLADURA_89_EXCEDE_ESCALA",
        "CAT_EFECTOS_VOLADURA_EXCEDE_ESCALA",
        ["EFECTOS DE VOLADURA '89"],
        "El efecto de voladura '89 ({value}) está fuera de la escala [1, 6]."
    ),
    "WRN_EFECTOS_VOLADURA_76_VALOR_MEDIO": ErrorRule(
        "WRN_EFECTOS_VOLADURA_76_VALOR_MEDIO",
        "CAT_EFECTOS_VOLADURA_VALOR_MEDIO",
        ["EFECTOS DE VOLADURA  '76"],
        "El valor de efectos de voladura '76 ({value}) no es un valor estándar del catálogo: {allowed_values}."
    ),
    "WRN_EFECTOS_VOLADURA_89_VALOR_MEDIO": ErrorRule(
        "WRN_EFECTOS_VOLADURA_89_VALOR_MEDIO",
        "CAT_EFECTOS_VOLADURA_VALOR_MEDIO",
        ["EFECTOS DE VOLADURA '89"],
        "El valor de efectos de voladura '89 ({value}) no es un valor estándar del catálogo: {allowed_values}."
    ),

    # RQD
    "WRN_RQD_VAL_76_VALOR_ALEJADO": ErrorRule(
        "WRN_RQD_VAL_76_VALOR_ALEJADO",
        "CAT_RQD_VAL_VALOR_ALEJADO",
        ["RQD - VALOR  '76"],
        "El puntaje de RQD '76 ({value}) no coincide con los valores del catálogo: [3, 8, 13, 17, 20]."
    ),
    "WRN_RQD_VAL_89_VALOR_ALEJADO": ErrorRule(
        "WRN_RQD_VAL_89_VALOR_ALEJADO",
        "CAT_RQD_VAL_VALOR_ALEJADO",
        ["RQD - VALOR '89"],
        "El puntaje de RQD '89 ({value}) está fuera de la escala [3.0, 20.0]."
    ),
    "ERR_RQD_76_SUPERIOR_100": ErrorRule(
        "ERR_RQD_76_SUPERIOR_100",
        "CAT_RQD_SUPERIOR_100",
        ["RQD  '76"],
        "El porcentaje de RQD '76 ({value}%) no puede ser superior a 100%."
    ),
    "ERR_RQD_89_SUPERIOR_100": ErrorRule(
        "ERR_RQD_89_SUPERIOR_100",
        "CAT_RQD_SUPERIOR_100",
        ["RQD '89"],
        "El porcentaje de RQD '89 ({value}%) no puede ser superior a 100%."
    ),
    "ERR_RQD_76_INCONGRUENTE": ErrorRule(
        "ERR_RQD_76_INCONGRUENTE",
        "CAT_RQD_INCONGRUENTE",
        ["RQD - VALOR  '76", "RQD  '76"],
        "El puntaje de RQD '76 ({value}) no coincide con el porcentaje ({pct}%). Debe ser {expected} (tolerancia ±0.2)."
    ),
    "ERR_RQD_89_INCONGRUENTE": ErrorRule(
        "ERR_RQD_89_INCONGRUENTE",
        "CAT_RQD_INCONGRUENTE",
        ["RQD - VALOR '89", "RQD '89"],
        "El puntaje de RQD '89 ({value}) no coincide con el porcentaje ({pct}%). Debe estar en el rango {expected}."
    ),

    # ESPACIAMIENTO
    "ERR_ESPACIAMIENTO_PROMEDIO_76_NEGATIVO": ErrorRule(
        "ERR_ESPACIAMIENTO_PROMEDIO_76_NEGATIVO",
        "CAT_ESPACIAMIENTO_PROMEDIO_NEGATIVO",
        ["ESPACIAMIENTO PROMEDIO   '76"],
        "El espaciamiento promedio '76 no puede ser negativo ({value} m)."
    ),
    "ERR_ESPACIAMIENTO_PROMEDIO_89_NEGATIVO": ErrorRule(
        "ERR_ESPACIAMIENTO_PROMEDIO_89_NEGATIVO",
        "CAT_ESPACIAMIENTO_PROMEDIO_NEGATIVO",
        ["ESPACIAMIENTO PROMEDIO '89"],
        "El espaciamiento promedio '89 no puede ser negativo ({value} m)."
    ),
    "ERR_ESPACIAMIENTO_PROMEDIO_76_CERO": ErrorRule(
        "ERR_ESPACIAMIENTO_PROMEDIO_76_CERO",
        "CAT_ESPACIAMIENTO_PROMEDIO_CERO",
        ["ESPACIAMIENTO PROMEDIO   '76"],
        "El espaciamiento promedio '76 no puede ser 0.0 m (debe ser mayor a cero)."
    ),
    "ERR_ESPACIAMIENTO_PROMEDIO_89_CERO": ErrorRule(
        "ERR_ESPACIAMIENTO_PROMEDIO_89_CERO",
        "CAT_ESPACIAMIENTO_PROMEDIO_CERO",
        ["ESPACIAMIENTO PROMEDIO '89"],
        "El espaciamiento promedio '89 no puede ser 0.0 m (debe ser mayor a cero)."
    ),
    "ERR_ESPACIAMIENTO_VALOR_76_RANGO": ErrorRule(
        "ERR_ESPACIAMIENTO_VALOR_76_RANGO",
        "CAT_ESPACIAMIENTO_RATING_RANGO",
        ["ESPACIAMIENTO - VALOR    '76"],
        "El puntaje de espaciamiento '76 ({value}) está fuera del rango [5, 30]."
    ),
    "ERR_ESPACIAMIENTO_VALOR_89_RANGO": ErrorRule(
        "ERR_ESPACIAMIENTO_VALOR_89_RANGO",
        "CAT_ESPACIAMIENTO_RATING_RANGO",
        ["ESPACIAMIENTO - VALOR '89"],
        "El puntaje de espaciamiento '89 ({value}) está fuera del rango [5, 20]."
    ),
    "WRN_ESPACIAMIENTO_VALOR_76_VALOR_MEDIO": ErrorRule(
        "WRN_ESPACIAMIENTO_VALOR_76_VALOR_MEDIO",
        "CAT_ESPACIAMIENTO_VALOR_MEDIO",
        ["ESPACIAMIENTO - VALOR    '76"],
        "El puntaje de espaciamiento '76 ({value}) no coincide con los valores del catálogo: [5, 10, 20, 25, 30]."
    ),
    "WRN_ESPACIAMIENTO_VALOR_89_VALOR_MEDIO": ErrorRule(
        "WRN_ESPACIAMIENTO_VALOR_89_VALOR_MEDIO",
        "CAT_ESPACIAMIENTO_VALOR_MEDIO",
        ["ESPACIAMIENTO - VALOR '89"],
        "El puntaje de espaciamiento '89 ({value}) no coincide con los valores del catálogo: [5, 8, 10, 15, 20]."
    ),
    "ERR_ESPACIAMIENTO_VALOR_76_NO_ALINEADO": ErrorRule(
        "ERR_ESPACIAMIENTO_VALOR_76_NO_ALINEADO",
        "CAT_ESPACIAMIENTO_NO_ALINEADO",
        ["ESPACIAMIENTO - VALOR    '76", "ESPACIAMIENTO PROMEDIO   '76"],
        "El puntaje de espaciamiento '76 ({value}) no coincide con el promedio ({promedio} m). Debe ser {expected}."
    ),
    "ERR_ESPACIAMIENTO_VALOR_89_NO_ALINEADO": ErrorRule(
        "ERR_ESPACIAMIENTO_VALOR_89_NO_ALINEADO",
        "CAT_ESPACIAMIENTO_NO_ALINEADO",
        ["ESPACIAMIENTO - VALOR '89", "ESPACIAMIENTO PROMEDIO '89"],
        "El puntaje de espaciamiento '89 ({value}) no coincide con el promedio ({promedio} m). Debe ser {expected}."
    ),

    # TIPO DE ESTRUCTURA
    "WRN_TIPO_ESTRUCTURA_J": ErrorRule(
        "WRN_TIPO_ESTRUCTURA_J",
        "CAT_TIPO_ESTRUCTURA_J",
        ["TIPO"],
        "El código de estructura 'J' debe registrarse como 'JN' según el catálogo."
    ),
    "ERR_TIPO_ESTRUCTURA_INVALIDO": ErrorRule(
        "ERR_TIPO_ESTRUCTURA_INVALIDO",
        "CAT_TIPO_ESTRUCTURA_INVALIDO",
        ["TIPO"],
        "Tipo de estructura geológica no permitida: '{value}'. Debe ser uno de {allowed_types}."
    ),

    # RELLENOS
    "ERR_RELLENO_1_INVALIDO": ErrorRule(
        "ERR_RELLENO_1_INVALIDO",
        "CAT_RELLENO_INVALIDO",
        ["TIPO DE  RELLENO 1"],
        "El tipo de relleno 1 ('{value}') no pertenece al catálogo: {allowed_fill_types}."
    ),
    "ERR_RELLENO_2_INVALIDO": ErrorRule(
        "ERR_RELLENO_2_INVALIDO",
        "CAT_RELLENO_INVALIDO",
        ["TIPO DE  RELLENO 2"],
        "El tipo de relleno 2 ('{value}') no pertenece al catálogo: {allowed_fill_types}."
    ),

    # JRC
    "ERR_JRC_RANGO": ErrorRule(
        "ERR_JRC_RANGO",
        "CAT_JRC_RANGO",
        ["JRC"],
        "El valor JRC ({value}) está fuera del rango permitido [0, 20]."
    ),

    # RUGOSIDAD
    "ERR_RUGOSIDAD_RANGO": ErrorRule(
        "ERR_RUGOSIDAD_RANGO",
        "CAT_RUGOSIDAD_RANGO",
        ["RUGOSIDAD DE ESTRUCTURAS"],
        "La rugosidad de junta ({value}) está fuera del rango [1, 9]."
    ),

    # FORMA
    "ERR_FORMA_ESTRUCTURA_INVALIDA": ErrorRule(
        "ERR_FORMA_ESTRUCTURA_INVALIDA",
        "CAT_FORMA_ESTRUCTURA_INVALIDA",
        ["FORMA DE ESTRUCTURA"],
        "Forma de estructura inválida: '{value}'. Debe ser P, C, O, E o I."
    ),

    # ALTERACIÓN
    "ERR_ALTERACION_INVALIDA": ErrorRule(
        "ERR_ALTERACION_INVALIDA",
        "CAT_ALTERACION_INVALIDA",
        ["ALTERACION"],
        "Código de alteración inválido: '{value}'. Debe ser uno de {allowed_alteration_types}."
    ),

    # ESPESOR & ABERTURA
    "ERR_ESPESOR_NEGATIVO": ErrorRule(
        "ERR_ESPESOR_NEGATIVO",
        "CAT_ESPESOR_NEGATIVO",
        ["ESPESOR mm."],
        "El espesor del relleno no puede ser negativo ({value} mm)."
    ),
    "ERR_ABERTURA_NEGATIVO": ErrorRule(
        "ERR_ABERTURA_NEGATIVO",
        "CAT_ABERTURA_NEGATIVO",
        ["ABERTURA mm."],
        "La abertura total no puede ser negativa ({value} mm)."
    ),
    "ERR_ESPESOR_SUPERIOR_ABERTURA": ErrorRule(
        "ERR_ESPESOR_SUPERIOR_ABERTURA",
        "CAT_ESPESOR_SUPERIOR_ABERTURA",
        ["ESPESOR mm.", "ABERTURA mm."],
        "El espesor del relleno ({thickness} mm) es mayor a la abertura ({aperture} mm) para la estructura '{struct_type}'."
    ),
    "ERR_ABERTURA_EXCEDE_CELDA": ErrorRule(
        "ERR_ABERTURA_EXCEDE_CELDA",
        "CAT_ABERTURA_EXCEDE_CELDA",
        ["ABERTURA mm."],
        "La abertura ({aperture} mm) supera la longitud de la celda ({cell_len} m) para la estructura '{struct_type}'."
    ),

    # CONTINUIDAD & ESPACIAMIENTO STRUCT
    "ERR_CONTINUIDAD_NEGATIVA": ErrorRule(
        "ERR_CONTINUIDAD_NEGATIVA",
        "CAT_CONTINUIDAD_NEGATIVA",
        ["CONTINUIDAD m."],
        "La continuidad no puede ser negativa ({value} m)."
    ),
    "ERR_ESPACIAMIENTO_NEGATIVO": ErrorRule(
        "ERR_ESPACIAMIENTO_NEGATIVO",
        "CAT_ESPACIAMIENTO_NEGATIVO",
        ["ESPACIAMIENTO m."],
        "El espaciamiento no puede ser negativo ({value} m)."
    ),

    # DIP & DIP DIR
    "ERR_DIP_ESTRUC_RANGO": ErrorRule(
        "ERR_DIP_ESTRUC_RANGO",
        "CAT_DIP_ESTRUC_RANGO",
        ["DIP"],
        "El valor de buzamiento (DIP: {value}°) está fuera del rango permitido [0, 90]."
    ),

    # NÚMERO DE ESTRUCTURAS
    "ERR_NUMERO_ESTRUCTURAS_DECIMAL": ErrorRule(
        "ERR_NUMERO_ESTRUCTURAS_DECIMAL",
        "CAT_NUMERO_ESTRUCTURAS_DECIMAL",
        ["NUMERO DE ESTRUCTURAS"],
        "El número de estructuras debe ser un número entero (se ingresó: {value})."
    ),

    # LITOLOGÍA & UCS
    "ERR_LITOLOGIA_COMBINACION_INVALIDA": ErrorRule(
        "ERR_LITOLOGIA_COMBINACION_INVALIDA",
        "CAT_LITOLOGIA_COMBINACION_INVALIDA",
        ["Lito 1", "Lito 2", "Lito 3"],
        "Combinación litológica (Lito 1: '{l1}', Lito 2: '{l2}', Lito 3: '{l3}') no válida según el catálogo."
    ),
    "ERR_UNIDAD_LITOLOGICA_INCONGRUENTE": ErrorRule(
        "ERR_UNIDAD_LITOLOGICA_INCONGRUENTE",
        "CAT_UNIDAD_LITOLOGICA_INCONGRUENTE",
        ["Unidad Litologica"],
        "La unidad litológica '{value}' no coincide con la litología registrada. Se esperaba '{expected_group}'."
    ),
    "ERR_UCS_DIVERGENTE_IS50": ErrorRule(
        "ERR_UCS_DIVERGENTE_IS50",
        "CAT_UCS_DIVERGENTE_IS50",
        ["( UCS )  (Mpa)", "is50 (Mpa)"],
        "Los valores de UCS ({ucs_val} MPa) e Is50 ({is50_val} MPa) no guardan relación física válida."
    ),
    "WRN_UCS_VS_IS50_K_DIVERGENTE": ErrorRule(
        "WRN_UCS_VS_IS50_K_DIVERGENTE",
        "CAT_UCS_VS_IS50_K_DIVERGENTE",
        ["( UCS )  (Mpa)", "is50 (Mpa)"],
        "El valor de UCS ({ucs_val} MPa) difiere del producto Is50 * K ({is50_val} * {factor_k} = {expected_ucs:.2f} MPa)."
    ),

    # CELDA PADRE MISSING
    "ERR_CELDA_PADRE_MISSING": ErrorRule(
        "ERR_CELDA_PADRE_MISSING",
        "CAT_CELDA_PADRE_MISSING",
        ["CELDA_PADRE"],
        "La fila no tiene una celda de mapeo asociada en CELDA."
    ),

    # CAMPO OBLIGATORIO VACÍO
    "ERR_CAMPO_OBLIGATORIO_VACIO": ErrorRule(
        "ERR_CAMPO_OBLIGATORIO_VACIO",
        "CAT_CAMPO_OBLIGATORIO_VACIO",
        [],
        "Campo obligatorio vacío: '{col_key}'."
    ),

    # RMR CERO
    "ERR_RMR_76_CERO": ErrorRule(
        "ERR_RMR_76_CERO",
        "CAT_RMR_CERO",
        ["RMR  '76"],
        "El valor de RMR '76 no puede ser 0."
    ),
    "ERR_RMR_89_CERO": ErrorRule(
        "ERR_RMR_89_CERO",
        "CAT_RMR_CERO",
        ["RMR '89"],
        "El valor de RMR '89 no puede ser 0."
    ),

    # CONSISTENCIA GEOMÉTRICA DE DIPS Y COORDENADAS (Tolerancia: 2 grados)
    "WRN_DIP_TALUD_DISCREPANCIA": ErrorRule(
        "WRN_DIP_TALUD_DISCREPANCIA",
        "CAT_DIP_TALUD_DISCREPANCIA",
        ["DIP_TALUD"],
        "La inclinación del talud (DIP_TALUD: {actual}°) difiere del valor esperado ({expected}°). Supera la tolerancia de 2°."
    ),
    "WRN_DIP_DISCREPANCIA_COORD": ErrorRule(
        "WRN_DIP_DISCREPANCIA_COORD",
        "CAT_DIP_DISCREPANCIA_COORD",
        ["DIP"],
        "El valor de DIP ({actual}°) difiere del calculado por coordenadas ({expected}°). Supera la tolerancia de 2°."
    ),
    "WRN_AZ_HOLE_DISCREPANCIA": ErrorRule(
        "WRN_AZ_HOLE_DISCREPANCIA",
        "CAT_AZ_HOLE_DISCREPANCIA",
        ["AZ_HOLE"],
        "El valor de AZ_HOLE ({actual}°) difiere del calculado por coordenadas ({expected}°). Supera la tolerancia de 2°."
    ),
    "WRN_DIP_DIR_TALUD_DISCREPANCIA": ErrorRule(
        "WRN_DIP_DIR_TALUD_DISCREPANCIA",
        "CAT_AZ_HOLE_DISCREPANCIA",
        ["DIP_DIR_TALUD"],
        "El valor de DIP_DIR_TALUD ({actual}°) difiere del esperado ({expected}° según AZ_HOLE + 90°). Supera la tolerancia de 2°."
    ),

    # =========================================================================
    # NUEVAS REGLAS DE AUDITORÍA (Spec SDD Noviembre 2026)
    # =========================================================================

    # 1. Coordenadas fuera de rango de proyecto
    "GEOM_ERR_COORD_FUERA_DE_PROYECTO": ErrorRule(
        "GEOM_ERR_COORD_FUERA_DE_PROYECTO",
        "CAT_GEOM_COORDENADAS",
        ["ESTE_FROM", "NORTE_FROM", "COTA_FROM", "ESTE_TO", "NORTE_TO", "COTA_TO"],
        f"La coordenada {{columna}} con valor '{{valor}}' está fuera del rango del proyecto [Este: {int(GEOMECHANICAL_THRESHOLDS['COORD_ESTE_MIN']):,} - {int(GEOMECHANICAL_THRESHOLDS['COORD_ESTE_MAX']):,}, Norte: {int(GEOMECHANICAL_THRESHOLDS['COORD_NORTE_MIN']):,} - {int(GEOMECHANICAL_THRESHOLDS['COORD_NORTE_MAX']):,}, Cota: {int(GEOMECHANICAL_THRESHOLDS['COORD_COTA_MIN'])}-{int(GEOMECHANICAL_THRESHOLDS['COORD_COTA_MAX'])}].".replace(",", " "),
        description="Revisa que las coordenadas Este, Norte y Cota estén dentro de los límites del proyecto minero.",
        technical_formula=f"Este ∈ [{int(GEOMECHANICAL_THRESHOLDS['COORD_ESTE_MIN'])}, {int(GEOMECHANICAL_THRESHOLDS['COORD_ESTE_MAX'])}] ∧ Norte ∈ [{int(GEOMECHANICAL_THRESHOLDS['COORD_NORTE_MIN'])}, {int(GEOMECHANICAL_THRESHOLDS['COORD_NORTE_MAX'])}] ∧ Cota ∈ [{int(GEOMECHANICAL_THRESHOLDS['COORD_COTA_MIN'])}, {int(GEOMECHANICAL_THRESHOLDS['COORD_COTA_MAX'])}]",
        example_ok="ESTE_FROM: 792533.9 m, NORTE_FROM: 8441076.2 m, COTA: 4260.0 msnm",
        example_error="ESTE_FROM: 79253.9 m (falta un dígito) o ESTE_FROM: 0.0",
        tipo_mapeo="Mapeo de Celdas"
    ),

    # 2. Segmento de celda con distancia cero
    "GEOM_ERR_SEGMENTO_DEGENERADO": ErrorRule(
        "GEOM_ERR_SEGMENTO_DEGENERADO",
        "CAT_GEOM_LONGITUD",
        ["ESTE_FROM", "NORTE_FROM", "COTA_FROM", "ESTE_TO", "NORTE_TO", "COTA_TO"],
        "Las coordenadas FROM y TO son iguales. La celda tiene distancia cero.",
        description="Revisa que la celda tenga longitud física real y no tenga las mismas coordenadas de inicio y fin.",
        technical_formula="√(ΔX² + ΔY² + ΔZ²) < 0.01 m",
        example_ok="FROM=(792533.9, 8441076.2, 4260.0), TO=(792539.1, 8441090.3, 4260.0)",
        example_error="FROM=(792533.9, 8441076.2, 4260.0), TO=(792533.9, 8441076.2, 4260.0)",
        tipo_mapeo="Mapeo de Celdas"
    ),

    # 3. Cota promedio vs Nivel
    "GEOM_WRN_COTA_VS_NIVEL": ErrorRule(
        "GEOM_WRN_COTA_VS_NIVEL",
        "CAT_GEOM_NIVEL",
        ["Nivel", "COTA_FROM", "COTA_TO"],
        "La cota promedio ({cota_prom} m) no coincide con el Nivel ({nivel}). Diferencia de {diff} m (tolerancia: 20 m).",
        description="Revisa que la cota promedio entre FROM y TO no se aleje más de 20 m del valor en la columna Nivel.",
        technical_formula="|((Cota_FROM + Cota_TO)/2) - Nivel| > 20.0 m",
        example_ok="Nivel: 4260, Cota_FROM: 4260.0 m, Cota_TO: 4260.5 m (Diferencia: 0.25 m)",
        example_error="Nivel: 3960, Cota_FROM: 4260.0 m, Cota_TO: 4260.0 m (Diferencia: 300 m)",
        tipo_mapeo="Mapeo de Celdas"
    ),

    # 4. Código de celda repetido en el libro Excel
    "ERR_CODIGO_CELDA_DUPLICADO": ErrorRule(
        "ERR_CODIGO_CELDA_DUPLICADO",
        "CAT_DUPLICADOS_CELDA",
        ["CELDA"],
        "El código de celda '{codigo}' está repetido en el archivo (aparece primero en la fila {fila_orig}).",
        description="Revisa que el código de la celda no se repita en filas separadas del archivo.",
        technical_formula="Código de celda único en el archivo",
        example_ok="Celda 'FW-101' registrada en un solo bloque continuo de filas",
        example_error="Celda 'FW-101' reaparece en la fila 450 después de haber cerrado en la fila 35",
        tipo_mapeo="Mapeo de Celdas"
    ),

    # 5. Coordenadas de celda repetidas en otra celda
    "ERR_COORDENADAS_CELDA_DUPLICADAS": ErrorRule(
        "ERR_COORDENADAS_CELDA_DUPLICADAS",
        "CAT_DUPLICADOS_GEOMETRIA",
        ["ESTE_FROM", "NORTE_FROM", "COTA_FROM", "ESTE_TO", "NORTE_TO", "COTA_TO"],
        "La celda '{codigo}' tiene las mismas coordenadas FROM-TO que la celda '{otro_codigo}' (registrada en la fila {fila_orig}).",
        description="Revisa que dos celdas con distinto nombre no tengan las mismas coordenadas de inicio y fin.",
        technical_formula="‖FROM_A - FROM_B‖ ≤ 0.05 m ∧ ‖TO_A - TO_B‖ ≤ 0.05 m",
        example_ok="Celda A en [FROM1 -> TO1] y Celda B en [FROM2 -> TO2]",
        example_error="Celda A y Celda B tienen exactamente las mismas coordenadas UTM de inicio y fin",
        tipo_mapeo="Mapeo de Celdas"
    ),

    # 6. Distancia euclidiana 3D vs Distancia declarada (> 0.30 m)
    "ERR_DISTANCIA_CELDA_DISCREPANCIA_COORD": ErrorRule(
        "ERR_DISTANCIA_CELDA_DISCREPANCIA_COORD",
        "CAT_DISTANCIA_CELDA",
        ["Dist.Celda", "ESTE_FROM", "NORTE_FROM", "COTA_FROM", "ESTE_TO", "NORTE_TO", "COTA_TO"],
        "La distancia declarada en Dist.Celda ({decl} m) difiere de la calculada por coordenadas ({calc} m) en {diff} m (tolerancia: 0.30 m).",
        description="Compara la columna Dist.Celda contra la distancia real calculada entre FROM y TO.",
        technical_formula="|D_3D - Dist.Celda| > 0.30 m, donde D_3D = √(ΔX² + ΔY² + ΔZ²)",
        example_ok="Dist.Celda: 15.0 m, Coordenadas calculan: 15.02 m (Diferencia: 0.02 m)",
        example_error="Dist.Celda: 15.0 m, Coordenadas calculan: 15.40 m (Diferencia: 0.40 m)",
        tipo_mapeo="Mapeo de Celdas"
    ),

    # 7. Distancia de estructura excede celda
    "ERR_DISTANCIA_ESTRUCTURA_EXCEDE_CELDA": ErrorRule(
        "ERR_DISTANCIA_ESTRUCTURA_EXCEDE_CELDA",
        "CAT_ESTRUCTURA_LIMITES",
        ["Dist. de estr.", "Dist.Celda"],
        "La columna Dist. de estr. ({dest} m) supera la longitud de la celda ({largo} m).",
        description="Revisa que la distancia de la estructura no sobrepase la longitud de la celda (Dist.Celda).",
        technical_formula="d_est ≠ -1 ∧ (d_est < 0 ∨ d_est > Dist.Celda + 0.03 m)",
        example_ok="Dist.Celda: 15.0 m, Dist. de estr.: 8.5 m (o -1 si no hay registro)",
        example_error="Dist.Celda: 15.0 m, Dist. de estr.: 22.0 m",
        tipo_mapeo="Mapeo de Estructuras"
    ),

    # 8. Coordenadas de estructura fuera de la línea de la celda
    "ERR_COORD_ESTRUCTURA_FUERA_DE_CELDA": ErrorRule(
        "ERR_COORD_ESTRUCTURA_FUERA_DE_CELDA",
        "CAT_ESTRUCTURA_GEOMETRIA",
        ["x", "y", "z"],
        "Las coordenadas de la estructura (x={x}, y={y}, z={z}) se desvían {desv} m de la línea entre FROM y TO (tolerancia: 0.30 m).",
        description="Revisa que las coordenadas (x, y, z) de la estructura estén sobre la línea recta entre FROM y TO.",
        technical_formula="d_perp = ‖w - t*v‖ > 0.30 m",
        example_ok="Estructura sobre la línea entre FROM y TO con desviación < 0.03 m",
        example_error="Estructura desviada a 1.2 m de la línea entre FROM y TO",
        tipo_mapeo="Mapeo de Estructuras"
    ),

    # 9. Coordenadas calculadas vs declaradas de estructura (Advertencia fila por fila)
    "ERR_COORD_ESTRUCTURA_DISCREPANCIA_CALCULO": ErrorRule(
        "ERR_COORD_ESTRUCTURA_DISCREPANCIA_CALCULO",
        "CAT_ESTRUCTURA_CALCULO",
        ["x", "y", "z"],
        "Las coordenadas declaradas ({decl_x}, {decl_y}, {decl_z}) difieren en {diff} m del cálculo analítico ({calc_x}, {calc_y}, {calc_z}). "
        "Fórmula: P = FROM + (Dist.estr / L_celda) * (TO - FROM). "
        "Reemplazo: FROM=({ef}, {nf}, {cf}), TO=({et}, {nt}, {ct}), Dist.estr={dest} m, L_celda={l_scan} m (tolerancia: 0.30 m).",
        description="Calcula la posición analítica (x, y, z) a lo largo de la celda a partir de Dist. de estr. y la compara con los valores ingresados.",
        technical_formula="P_calc = FROM + (Dist.estr / L_scan) * (TO - FROM); diff = ‖P_decl - P_calc‖ > 0.30 m",
        example_ok="Coordenadas declaradas coinciden con el cálculo (diferencia ≤ 0.30 m)",
        example_error="Las coordenadas declaradas (792533.96, 8441076.22, 4260.01) difieren en 4.04 m del cálculo analítico (792535.34, 8441080.02, 4260.01)",
        tipo_mapeo="Mapeo de Estructuras"
    )
}


def get_rules_catalog_data():
    """
    Retorna el diccionario completo de reglas con sus metadatos, severidad,
    categoría, columnas afectadas, explicaciones y ejemplos para la UI.
    """
    catalog = []
    for code, rule in RULES_REGISTRY.items():
        cat = CATEGORIES_REGISTRY.get(rule.category_code)
        severity = cat.severity if cat else "ALERTA"
        category_name = cat.name if cat else rule.category_code
        
        catalog.append({
            "code": rule.code,
            "category_code": rule.category_code,
            "category_name": category_name,
            "severity": severity,
            "columns": rule.columns,
            "message_template": rule.message_template,
            "description": rule.description or category_name,
            "technical_formula": rule.technical_formula,
            "example_ok": rule.example_ok,
            "example_error": rule.example_error,
            "tipo_mapeo": rule.tipo_mapeo
        })
    return catalog
