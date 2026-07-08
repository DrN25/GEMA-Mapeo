# backend/app/core/rules.py

class RuleCategory:
    def __init__(self, code: str, name: str, severity: str):
        self.code = code
        self.name = name  # This is the title/message shown in the "Catálogo de Errores" sheet
        self.severity = severity


class ErrorRule:
    def __init__(self, code: str, category_code: str, columns: list, message_template: str):
        self.code = code
        self.category_code = category_code
        self.columns = columns
        self.message_template = message_template

    def format_message(self, **kwargs) -> str:
        try:
            return self.message_template.format(**kwargs)
        except Exception:
            # Fallback in case of formatting error
            return self.message_template


# 1. CATEGORÍAS MAESTRAS (Reemplaza la lista estática y desordenada anterior)
CATEGORIES_REGISTRY = {
    # Alertas Críticas (Física, Rangos y Catálogos obligatorios)
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
        "Valor de agua '76 / '89 excede los límites reales de la escala.", 
        "ALERTA"
    ),
    "CAT_AGUA_INCONGRUENTE": RuleCategory(
        "CAT_AGUA_INCONGRUENTE", 
        "Rating de agua '76 / '89 es incongruente con el código.", 
        "ALERTA"
    ),
    "CAT_DUREZA_INVALIDA": RuleCategory(
        "CAT_DUREZA_INVALIDA", 
        "Dureza '76 / '89 no admitida. Debe ser R0 a R6.", 
        "ALERTA"
    ),
    "CAT_RESISTENCIA_LIMITE_EXCEDIDO": RuleCategory(
        "CAT_RESISTENCIA_LIMITE_EXCEDIDO", 
        "Rating de resistencia '76 / '89 fuera del límite real.", 
        "ALERTA"
    ),
    "CAT_RESISTENCIA_INCONGRUENTE": RuleCategory(
        "CAT_RESISTENCIA_INCONGRUENTE", 
        "Resistencia '76 / '89 es incongruente con la dureza.", 
        "ALERTA"
    ),
    "CAT_CONTROL_ESTRUCTURAL_FUERA_LIMITES": RuleCategory(
        "CAT_CONTROL_ESTRUCTURAL_FUERA_LIMITES", 
        "Control estructural '76 / '89 fuera de límites permitidos [1, 5].", 
        "ALERTA"
    ),
    "CAT_EFECTOS_VOLADURA_EXCEDE_ESCALA": RuleCategory(
        "CAT_EFECTOS_VOLADURA_EXCEDE_ESCALA", 
        "Efecto de voladura '76 / '89 excede los límites de la escala.", 
        "ALERTA"
    ),
    "CAT_RQD_SUPERIOR_100": RuleCategory(
        "CAT_RQD_SUPERIOR_100", 
        "Porcentaje de RQD '76 / '89 no puede ser superior al 100%.", 
        "ALERTA"
    ),
    "CAT_ESPACIAMIENTO_PROMEDIO_CERO": RuleCategory(
        "CAT_ESPACIAMIENTO_PROMEDIO_CERO", 
        "Inconsistencia: El espaciamiento promedio '76 / '89 es de 0.0 m (debe ser mayor a cero).", 
        "ALERTA"
    ),
    "CAT_ESPACIAMIENTO_PROMEDIO_NEGATIVO": RuleCategory(
        "CAT_ESPACIAMIENTO_PROMEDIO_NEGATIVO", 
        "El espaciamiento promedio '76 / '89 debe ser positivo.", 
        "ALERTA"
    ),
    "CAT_ESPACIAMIENTO_RATING_RANGO": RuleCategory(
        "CAT_ESPACIAMIENTO_RATING_RANGO", 
        "Valor de rating de espaciamiento '76 / '89 fuera de rango.", 
        "ALERTA"
    ),
    "CAT_ESPACIAMIENTO_NO_ALINEADO": RuleCategory(
        "CAT_ESPACIAMIENTO_NO_ALINEADO", 
        "Rating de espaciamiento '76 / '89 no se alinea con el promedio.", 
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
        "UCS es divergente a Is50.", 
        "ALERTA"
    ),
    "CAT_LITOLOGIA_COMBINACION_INVALIDA": RuleCategory(
        "CAT_LITOLOGIA_COMBINACION_INVALIDA", 
        "Combinación litológica Lito 1-2-3 inválida según el catálogo.", 
        "ALERTA"
    ),
    "CAT_UNIDAD_LITOLOGICA_INCONGRUENTE": RuleCategory(
        "CAT_UNIDAD_LITOLOGICA_INCONGRUENTE", 
        "Unidad litológica es incongruente con la litología.", 
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
        "La persistencia de discontinuidad (continuidad) no puede ser un valor negativo.", 
        "ALERTA"
    ),
    "CAT_ESPACIAMIENTO_NEGATIVO": RuleCategory(
        "CAT_ESPACIAMIENTO_NEGATIVO", 
        "El espaciamiento de discontinuidad no puede ser un valor negativo.", 
        "ALERTA"
    ),
    "CAT_NUMERO_ESTRUCTURAS_DECIMAL": RuleCategory(
        "CAT_NUMERO_ESTRUCTURAS_DECIMAL", 
        "En número de estructuras solamente se permiten números enteros.", 
        "ALERTA"
    ),
    "CAT_CELDA_PADRE_MISSING": RuleCategory(
        "CAT_CELDA_PADRE_MISSING", 
        "La fila no posee una estación de mapeo válida asociada.", 
        "ALERTA"
    ),

    # Advertencias de Consistencia y Formato
    "CAT_AGUA_VALOR_MEDIO": RuleCategory(
        "CAT_AGUA_VALOR_MEDIO", 
        "El valor de agua '76 / '89 es un valor medio no exacto.", 
        "ADVERTENCIA"
    ),
    "CAT_RESISTENCIA_VALOR_ALEJADO": RuleCategory(
        "CAT_RESISTENCIA_VALOR_ALEJADO", 
        "Puntaje de resistencia '76 / '89 es un valor alejado no válido.", 
        "ADVERTENCIA"
    ),
    "CAT_EFECTOS_VOLADURA_VALOR_MEDIO": RuleCategory(
        "CAT_EFECTOS_VOLADURA_VALOR_MEDIO", 
        "Puntaje de efectos de voladura '76 / '89 es un valor medio no exacto.", 
        "ADVERTENCIA"
    ),
    "CAT_RQD_VAL_VALOR_ALEJADO": RuleCategory(
        "CAT_RQD_VAL_VALOR_ALEJADO", 
        "Puntaje de RQD '76 / '89 es un valor alejado no válido.", 
        "ADVERTENCIA"
    ),
    "CAT_ESPACIAMIENTO_VALOR_MEDIO": RuleCategory(
        "CAT_ESPACIAMIENTO_VALOR_MEDIO", 
        "Puntaje de espaciamiento '76 / '89 es un valor medio no exacto.", 
        "ADVERTENCIA"
    ),
    "CAT_TIPO_ESTRUCTURA_J": RuleCategory(
        "CAT_TIPO_ESTRUCTURA_J", 
        "Tipo de estructura geológica 'J' sugerida a normalizar por 'JN'.", 
        "ADVERTENCIA"
    ),
    "CAT_UCS_VS_IS50_K_DIVERGENTE": RuleCategory(
        "CAT_UCS_VS_IS50_K_DIVERGENTE", 
        "Divergencia de resistencia uniaxial (UCS vs Is50 * K).", 
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
        "Discrepancia en inclinación del talud con respecto al valor esperado.",
        "ADVERTENCIA"
    ),
    "CAT_DIP_DISCREPANCIA_COORD": RuleCategory(
        "CAT_DIP_DISCREPANCIA_COORD",
        "Discrepancia en inclinación (Dip) del taladro/celda con respecto a las coordenadas.",
        "ADVERTENCIA"
    ),
    "CAT_AZ_HOLE_DISCREPANCIA": RuleCategory(
        "CAT_AZ_HOLE_DISCREPANCIA",
        "Discrepancia en azimuth/dirección con respecto a las coordenadas.",
        "ADVERTENCIA"
    ),

    # Vacíos
    "CAT_CAMPO_OBLIGATORIO_VACIO": RuleCategory(
        "CAT_CAMPO_OBLIGATORIO_VACIO", 
        "Campo obligatorio se encuentra vacío.", 
        "VACIO"
    )
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
        "Valor de agua '76 excede los límites reales de la escala [0, 10]. Valor ingresado: {value}."
    ),
    "ERR_AGUA_89_LIMITE_EXCEDIDO": ErrorRule(
        "ERR_AGUA_89_LIMITE_EXCEDIDO",
        "CAT_AGUA_LIMITE_EXCEDIDO",
        ["CONDICION DE AGUA VALOR '89"],
        "Valor de agua '89 excede los límites reales de la escala [0, 15]. Valor ingresado: {value}."
    ),
    "ERR_AGUA_76_INCONGRUENTE": ErrorRule(
        "ERR_AGUA_76_INCONGRUENTE",
        "CAT_AGUA_INCONGRUENTE",
        ["CONDICION DE AGUA VALOR  '76", "CONDICION DE AGUA  '76."],
        "Rating de agua '76 es incongruente con el código. Valor ingresado: {value}, Código: '{code_val}'. Se esperaba {expected} según catálogo."
    ),
    "ERR_AGUA_89_INCONGRUENTE": ErrorRule(
        "ERR_AGUA_89_INCONGRUENTE",
        "CAT_AGUA_INCONGRUENTE",
        ["CONDICION DE AGUA VALOR '89", "CONDICION DE AGUA  '89"],
        "Rating de agua '89 es incongruente con el código. Valor ingresado: {value}, Código: '{code_val}'. Se esperaba {expected} según catálogo."
    ),
    "WRN_AGUA_76_VALOR_MEDIO": ErrorRule(
        "WRN_AGUA_76_VALOR_MEDIO",
        "CAT_AGUA_VALOR_MEDIO",
        ["CONDICION DE AGUA VALOR  '76"],
        "El valor de agua '76 es un valor medio no exacto. Valor ingresado: {value}. Valores permitidos: [10, 7, 4, 0]."
    ),
    "WRN_AGUA_89_VALOR_MEDIO": ErrorRule(
        "WRN_AGUA_89_VALOR_MEDIO",
        "CAT_AGUA_VALOR_MEDIO",
        ["CONDICION DE AGUA VALOR '89"],
        "El valor de agua '89 es un valor medio no exacto. Valor ingresado: {value}. Valores permitidos: [15, 10, 7, 4, 0]."
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
        "Rating de resistencia '76 fuera del límite real [0, 15]. Valor ingresado: {value}."
    ),
    "ERR_RESISTENCIA_89_LIMITE_EXCEDIDO": ErrorRule(
        "ERR_RESISTENCIA_89_LIMITE_EXCEDIDO",
        "CAT_RESISTENCIA_LIMITE_EXCEDIDO",
        ["RESISTENCIA ESTIMADA VALOR '89"],
        "Rating de resistencia '89 fuera del límite real [0, 15]. Valor ingresado: {value}."
    ),
    "ERR_RESISTENCIA_76_INCONGRUENTE": ErrorRule(
        "ERR_RESISTENCIA_76_INCONGRUENTE",
        "CAT_RESISTENCIA_INCONGRUENTE",
        ["RESISTENCIA ESTIMADA VALOR  '76", "DUREZA  '76"],
        "Resistencia '76 es incongruente con la dureza. Valor ingresado: {value}, Dureza: '{dureza_val}'. Se esperaba {expected} (Tolerancia ±0.5)."
    ),
    "ERR_RESISTENCIA_89_INCONGRUENTE": ErrorRule(
        "ERR_RESISTENCIA_89_INCONGRUENTE",
        "CAT_RESISTENCIA_INCONGRUENTE",
        ["RESISTENCIA ESTIMADA VALOR '89", "DUREZA '89"],
        "Resistencia '89 es incongruente con la dureza. Valor ingresado: {value}, Dureza: '{dureza_val}'. Se esperaba {expected} (Tolerancia ±0.5)."
    ),
    "WRN_RESISTENCIA_76_VALOR_ALEJADO": ErrorRule(
        "WRN_RESISTENCIA_76_VALOR_ALEJADO",
        "CAT_RESISTENCIA_VALOR_ALEJADO",
        ["RESISTENCIA ESTIMADA VALOR  '76"],
        "Puntaje de resistencia '76 es un valor alejado no válido. Valor ingresado: {value}. Valores discretos estándar: [0, 1, 2, 4, 7, 12, 15]."
    ),
    "WRN_RESISTENCIA_89_VALOR_ALEJADO": ErrorRule(
        "WRN_RESISTENCIA_89_VALOR_ALEJADO",
        "CAT_RESISTENCIA_VALOR_ALEJADO",
        ["RESISTENCIA ESTIMADA VALOR '89"],
        "Puntaje de resistencia '89 es un valor alejado no válido. Valor ingresado: {value}. Valores discretos estándar: [0, 1, 2, 4, 7, 12, 15]."
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
        "Efecto de voladura '76 excede los límites de la escala [1, 6]. Valor ingresado: {value}."
    ),
    "ERR_EFECTOS_VOLADURA_89_EXCEDE_ESCALA": ErrorRule(
        "ERR_EFECTOS_VOLADURA_89_EXCEDE_ESCALA",
        "CAT_EFECTOS_VOLADURA_EXCEDE_ESCALA",
        ["EFECTOS DE VOLADURA '89"],
        "Efecto de voladura '89 excede los límites de la escala [1, 6]. Valor ingresado: {value}."
    ),
    "WRN_EFECTOS_VOLADURA_76_VALOR_MEDIO": ErrorRule(
        "WRN_EFECTOS_VOLADURA_76_VALOR_MEDIO",
        "CAT_EFECTOS_VOLADURA_VALOR_MEDIO",
        ["EFECTOS DE VOLADURA  '76"],
        "Puntaje de efectos de voladura '76 es un valor medio no exacto. Valor ingresado: {value}. Se sugieren los valores estándar de catálogo: {allowed_values}."
    ),
    "WRN_EFECTOS_VOLADURA_89_VALOR_MEDIO": ErrorRule(
        "WRN_EFECTOS_VOLADURA_89_VALOR_MEDIO",
        "CAT_EFECTOS_VOLADURA_VALOR_MEDIO",
        ["EFECTOS DE VOLADURA '89"],
        "Puntaje de efectos de voladura '89 es un valor medio no exacto. Valor ingresado: {value}. Se sugieren los valores estándar de catálogo: {allowed_values}."
    ),

    # RQD
    "WRN_RQD_VAL_76_VALOR_ALEJADO": ErrorRule(
        "WRN_RQD_VAL_76_VALOR_ALEJADO",
        "CAT_RQD_VAL_VALOR_ALEJADO",
        ["RQD - VALOR  '76"],
        "Puntaje de RQD '76 es un valor alejado no válido. Valor ingresado: {value}. Valores de catálogo esperados: [3, 8, 13, 17, 20]."
    ),
    "WRN_RQD_VAL_89_VALOR_ALEJADO": ErrorRule(
        "WRN_RQD_VAL_89_VALOR_ALEJADO",
        "CAT_RQD_VAL_VALOR_ALEJADO",
        ["RQD - VALOR '89"],
        "Puntaje de RQD '89 es un valor alejado no válido. Valor ingresado: {value}. Valores de catálogo esperados: [3, 8, 13, 17, 20]."
    ),
    "ERR_RQD_76_SUPERIOR_100": ErrorRule(
        "ERR_RQD_76_SUPERIOR_100",
        "CAT_RQD_SUPERIOR_100",
        ["RQD  '76"],
        "Porcentaje de RQD '76 no puede ser superior al 100%. Porcentaje actual: {value}%."
    ),
    "ERR_RQD_89_SUPERIOR_100": ErrorRule(
        "ERR_RQD_89_SUPERIOR_100",
        "CAT_RQD_SUPERIOR_100",
        ["RQD '89"],
        "Porcentaje de RQD '89 no puede ser superior al 100%. Porcentaje actual: {value}%."
    ),

    # ESPACIAMIENTO
    "ERR_ESPACIAMIENTO_PROMEDIO_76_NEGATIVO": ErrorRule(
        "ERR_ESPACIAMIENTO_PROMEDIO_76_NEGATIVO",
        "CAT_ESPACIAMIENTO_PROMEDIO_NEGATIVO",
        ["ESPACIAMIENTO PROMEDIO   '76"],
        "El espaciamiento promedio '76 no puede ser negativo. Valor ingresado: {value} m."
    ),
    "ERR_ESPACIAMIENTO_PROMEDIO_89_NEGATIVO": ErrorRule(
        "ERR_ESPACIAMIENTO_PROMEDIO_89_NEGATIVO",
        "CAT_ESPACIAMIENTO_PROMEDIO_NEGATIVO",
        ["ESPACIAMIENTO PROMEDIO '89"],
        "El espaciamiento promedio '89 no puede ser negativo. Valor ingresado: {value} m."
    ),
    "ERR_ESPACIAMIENTO_PROMEDIO_76_CERO": ErrorRule(
        "ERR_ESPACIAMIENTO_PROMEDIO_76_CERO",
        "CAT_ESPACIAMIENTO_PROMEDIO_CERO",
        ["ESPACIAMIENTO PROMEDIO   '76"],
        "Inconsistencia: El espaciamiento promedio '76 es de 0.0 m (debe ser mayor a cero)."
    ),
    "ERR_ESPACIAMIENTO_PROMEDIO_89_CERO": ErrorRule(
        "ERR_ESPACIAMIENTO_PROMEDIO_89_CERO",
        "CAT_ESPACIAMIENTO_PROMEDIO_CERO",
        ["ESPACIAMIENTO PROMEDIO '89"],
        "Inconsistencia: El espaciamiento promedio '89 es de 0.0 m (debe ser mayor a cero)."
    ),
    "ERR_ESPACIAMIENTO_VALOR_76_RANGO": ErrorRule(
        "ERR_ESPACIAMIENTO_VALOR_76_RANGO",
        "CAT_ESPACIAMIENTO_RATING_RANGO",
        ["ESPACIAMIENTO - VALOR    '76"],
        "Valor de rating de espaciamiento '76 fuera del rango [5, 30]. Valor ingresado: {value}."
    ),
    "ERR_ESPACIAMIENTO_VALOR_89_RANGO": ErrorRule(
        "ERR_ESPACIAMIENTO_VALOR_89_RANGO",
        "CAT_ESPACIAMIENTO_RATING_RANGO",
        ["ESPACIAMIENTO - VALOR '89"],
        "Valor de rating de espaciamiento '89 fuera del rango [5, 20]. Valor ingresado: {value}."
    ),
    "WRN_ESPACIAMIENTO_VALOR_76_VALOR_MEDIO": ErrorRule(
        "WRN_ESPACIAMIENTO_VALOR_76_VALOR_MEDIO",
        "CAT_ESPACIAMIENTO_VALOR_MEDIO",
        ["ESPACIAMIENTO - VALOR    '76"],
        "Puntaje de espaciamiento '76 es un valor medio no exacto. Valor ingresado: {value}. Valores de catálogo estándar: [5, 10, 20, 25, 30]."
    ),
    "WRN_ESPACIAMIENTO_VALOR_89_VALOR_MEDIO": ErrorRule(
        "WRN_ESPACIAMIENTO_VALOR_89_VALOR_MEDIO",
        "CAT_ESPACIAMIENTO_VALOR_MEDIO",
        ["ESPACIAMIENTO - VALOR '89"],
        "Puntaje de espaciamiento '89 es un valor medio no exacto. Valor ingresado: {value}. Valores de catálogo estándar: [5, 8, 10, 15, 20]."
    ),
    "ERR_ESPACIAMIENTO_VALOR_76_NO_ALINEADO": ErrorRule(
        "ERR_ESPACIAMIENTO_VALOR_76_NO_ALINEADO",
        "CAT_ESPACIAMIENTO_NO_ALINEADO",
        ["ESPACIAMIENTO - VALOR    '76", "ESPACIAMIENTO PROMEDIO   '76"],
        "Rating de espaciamiento '76 no se alinea con el promedio. Valor ingresado: {value}, Espaciamiento promedio: {promedio} m. Se esperaba {expected} según la escala discreta R76."
    ),
    "ERR_ESPACIAMIENTO_VALOR_89_NO_ALINEADO": ErrorRule(
        "ERR_ESPACIAMIENTO_VALOR_89_NO_ALINEADO",
        "CAT_ESPACIAMIENTO_NO_ALINEADO",
        ["ESPACIAMIENTO - VALOR '89", "ESPACIAMIENTO PROMEDIO '89"],
        "Rating de espaciamiento '89 no se alinea con el promedio esperado. Valor ingresado: {value}, Espaciamiento promedio: {promedio} m. Se esperaba {expected} según la escala discreta R89."
    ),

    # TIPO DE ESTRUCTURA
    "WRN_TIPO_ESTRUCTURA_J": ErrorRule(
        "WRN_TIPO_ESTRUCTURA_J",
        "CAT_TIPO_ESTRUCTURA_J",
        ["TIPO"],
        "Tipo de estructura geológica 'J' sugerida a normalizar por 'JN' según catálogo estándar. Código ingresado: 'J'."
    ),
    "ERR_TIPO_ESTRUCTURA_INVALIDO": ErrorRule(
        "ERR_TIPO_ESTRUCTURA_INVALIDO",
        "CAT_TIPO_ESTRUCTURA_INVALIDO",
        ["TIPO"],
        "Tipo de estructura geológica no permitida. Valor ingresado: '{value}'. Debe ser uno de {allowed_types}."
    ),

    # RELLENOS
    "ERR_RELLENO_1_INVALIDO": ErrorRule(
        "ERR_RELLENO_1_INVALIDO",
        "CAT_RELLENO_INVALIDO",
        ["TIPO DE  RELLENO 1"],
        "Tipo de relleno no pertenece al catálogo. Relleno 1 ingresado: '{value}'. Catálogo permitido: {allowed_fill_types}."
    ),
    "ERR_RELLENO_2_INVALIDO": ErrorRule(
        "ERR_RELLENO_2_INVALIDO",
        "CAT_RELLENO_INVALIDO",
        ["TIPO DE  RELLENO 2"],
        "Tipo de relleno no pertenece al catálogo. Relleno 2 ingresado: '{value}'. Catálogo permitido: {allowed_fill_types}."
    ),

    # JRC
    "ERR_JRC_RANGO": ErrorRule(
        "ERR_JRC_RANGO",
        "CAT_JRC_RANGO",
        ["JRC"],
        "Valor JRC fuera de rango permitido [0, 20]. Valor ingresado: {value}."
    ),

    # RUGOSIDAD
    "ERR_RUGOSIDAD_RANGO": ErrorRule(
        "ERR_RUGOSIDAD_RANGO",
        "CAT_RUGOSIDAD_RANGO",
        ["RUGOSIDAD DE ESTRUCTURAS"],
        "Clase de rugosidad de junta fuera de límites [1, 9]. Valor ingresado: {value}."
    ),

    # FORMA
    "ERR_FORMA_ESTRUCTURA_INVALIDA": ErrorRule(
        "ERR_FORMA_ESTRUCTURA_INVALIDA",
        "CAT_FORMA_ESTRUCTURA_INVALIDA",
        ["FORMA DE ESTRUCTURA"],
        "Forma de estructura inválida. Debe ser P, C, O, E o I. Valor ingresado: '{value}'."
    ),

    # ALTERACIÓN
    "ERR_ALTERACION_INVALIDA": ErrorRule(
        "ERR_ALTERACION_INVALIDA",
        "CAT_ALTERACION_INVALIDA",
        ["ALTERACION"],
        "Código de alteración inválido. Código ingresado: '{value}'. Debe ser uno de {allowed_alteration_types}."
    ),

    # ESPESOR & ABERTURA
    "ERR_ESPESOR_NEGATIVO": ErrorRule(
        "ERR_ESPESOR_NEGATIVO",
        "CAT_ESPESOR_NEGATIVO",
        ["ESPESOR mm."],
        "El espesor del relleno no puede ser un valor negativo. Valor ingresado: {value} mm."
    ),
    "ERR_ABERTURA_NEGATIVO": ErrorRule(
        "ERR_ABERTURA_NEGATIVO",
        "CAT_ABERTURA_NEGATIVO",
        ["ABERTURA mm."],
        "La abertura total no puede ser un valor negativo. Valor ingresado: {value} mm."
    ),
    "ERR_ESPESOR_SUPERIOR_ABERTURA": ErrorRule(
        "ERR_ESPESOR_SUPERIOR_ABERTURA",
        "CAT_ESPESOR_SUPERIOR_ABERTURA",
        ["ESPESOR mm.", "ABERTURA mm."],
        "Espesor del relleno es superior a la abertura total y no pertenece a F, SZ, BED. Estructura geológica: '{struct_type}', Espesor: {thickness} mm, Abertura total: {aperture} mm."
    ),
    "ERR_ABERTURA_EXCEDE_CELDA": ErrorRule(
        "ERR_ABERTURA_EXCEDE_CELDA",
        "CAT_ABERTURA_EXCEDE_CELDA",
        ["ABERTURA mm."],
        "La abertura de la falla supera la longitud de la celda y no pertenece a F, SZ, BED. Tipo de junta: '{struct_type}', Abertura: {aperture} mm, Longitud de la celda (Dist.Celda): {cell_len} m."
    ),

    # CONTINUIDAD & ESPACIAMIENTO STRUCT
    "ERR_CONTINUIDAD_NEGATIVA": ErrorRule(
        "ERR_CONTINUIDAD_NEGATIVA",
        "CAT_CONTINUIDAD_NEGATIVA",
        ["CONTINUIDAD m."],
        "La persistencia de discontinuidad (continuidad) no puede ser un valor negativo. Valor ingresado: {value} m."
    ),
    "ERR_ESPACIAMIENTO_NEGATIVO": ErrorRule(
        "ERR_ESPACIAMIENTO_NEGATIVO",
        "CAT_ESPACIAMIENTO_NEGATIVO",
        ["ESPACIAMIENTO m."],
        "El espaciamiento de discontinuidad no puede ser un valor negativo. Valor ingresado: {value} m."
    ),

    # DIP & DIP DIR
    "ERR_DIP_ESTRUC_RANGO": ErrorRule(
        "ERR_DIP_ESTRUC_RANGO",
        "CAT_DIP_ESTRUC_RANGO",
        ["DIP"],
        "Valor de inclinación (Dip) fuera de rango permitido [0, 90] grados. Valor ingresado: {value}°."
    ),


    # NÚMERO DE ESTRUCTURAS
    "ERR_NUMERO_ESTRUCTURAS_DECIMAL": ErrorRule(
        "ERR_NUMERO_ESTRUCTURAS_DECIMAL",
        "CAT_NUMERO_ESTRUCTURAS_DECIMAL",
        ["NUMERO DE ESTRUCTURAS"],
        "En número de estructuras solamente se permiten números enteros. Valor ingresado: {value}."
    ),

    # LITOLOGÍA & UCS
    "ERR_LITOLOGIA_COMBINACION_INVALIDA": ErrorRule(
        "ERR_LITOLOGIA_COMBINACION_INVALIDA",
        "CAT_LITOLOGIA_COMBINACION_INVALIDA",
        ["Lito 1", "Lito 2", "Lito 3"],
        "Combinación litológica Lito 1-2-3 inválida según el catálogo. Litologías ingresadas -> Lito 1: '{l1}', Lito 2: '{l2}', Lito 3: '{l3}'."
    ),
    "ERR_UNIDAD_LITOLOGICA_INCONGRUENTE": ErrorRule(
        "ERR_UNIDAD_LITOLOGICA_INCONGRUENTE",
        "CAT_UNIDAD_LITOLOGICA_INCONGRUENTE",
        ["Unidad Litologica"],
        "Unidad litológica es incongruente con la litología. Unidad ingresada: '{value}'. Se esperaba la unidad geológica '{expected_group}' basada en la litología."
    ),
    "ERR_UCS_DIVERGENTE_IS50": ErrorRule(
        "ERR_UCS_DIVERGENTE_IS50",
        "CAT_UCS_DIVERGENTE_IS50",
        ["( UCS )  (Mpa)", "is50 (Mpa)"],
        "UCS es divergente a Is50. UCS ingresado: {ucs_val} MPa, Is50 ingresado: {is50_val} MPa."
    ),
    "WRN_UCS_VS_IS50_K_DIVERGENTE": ErrorRule(
        "WRN_UCS_VS_IS50_K_DIVERGENTE",
        "CAT_UCS_VS_IS50_K_DIVERGENTE",
        ["( UCS )  (Mpa)", "is50 (Mpa)"],
        "Divergencia de resistencia uniaxial (UCS vs Is50 * K). UCS ingresado: {ucs_val} MPa, Is50 ingresado: {is50_val} MPa, factor K asociado: {factor_k}, UCS esperado (Is50 * K): {expected_ucs:.2f} MPa."
    ),

    # CELDA PADRE MISSING
    "ERR_CELDA_PADRE_MISSING": ErrorRule(
        "ERR_CELDA_PADRE_MISSING",
        "CAT_CELDA_PADRE_MISSING",
        ["CELDA_PADRE"],
        "La fila no posee una estación de mapeo válida asociada."
    ),

    # CAMPO OBLIGATORIO VACÍO
    "ERR_CAMPO_OBLIGATORIO_VACIO": ErrorRule(
        "ERR_CAMPO_OBLIGATORIO_VACIO",
        "CAT_CAMPO_OBLIGATORIO_VACIO",
        [],
        "Campo obligatorio se encuentra vacío. Columna: '{col_key}'."
    ),

    # RMR CERO
    "ERR_RMR_76_CERO": ErrorRule(
        "ERR_RMR_76_CERO",
        "CAT_RMR_CERO",
        ["RMR  '76"],
        "Inconsistencia crítica: El RMR calculado RMR '76 es de 0.0 (no puede ser cero)."
    ),
    "ERR_RMR_89_CERO": ErrorRule(
        "ERR_RMR_89_CERO",
        "CAT_RMR_CERO",
        ["RMR '89"],
        "Inconsistencia crítica: El RMR calculado RMR '89 es de 0.0 (no puede ser cero)."
    ),

    # GEOMETRIC CONSISTENCY WARNINGS (Gravedad ADVERTENCIA, tolerancia de hasta 2 grados)
    "WRN_DIP_TALUD_DISCREPANCIA": ErrorRule(
        "WRN_DIP_TALUD_DISCREPANCIA",
        "CAT_DIP_TALUD_DISCREPANCIA",
        ["DIP_TALUD"],
        "Discrepancia en inclinación del talud: El geotécnico colocó {actual}°, pero el valor esperado de la celda es {expected}° (Excede la tolerancia de 2°)."
    ),
    "WRN_DIP_DISCREPANCIA_COORD": ErrorRule(
        "WRN_DIP_DISCREPANCIA_COORD",
        "CAT_DIP_DISCREPANCIA_COORD",
        ["DIP"],
        "Discrepancia en inclinación (Dip) de celda: El valor ingresado es {actual}°, pero el calculado por coordenadas es {expected}° (Excede la tolerancia de 2°)."
    ),
    "WRN_AZ_HOLE_DISCREPANCIA": ErrorRule(
        "WRN_AZ_HOLE_DISCREPANCIA",
        "CAT_AZ_HOLE_DISCREPANCIA",
        ["AZ_HOLE"],
        "Discrepancia en azimuth (AZ_HOLE) de celda: El valor ingresado es {actual}°, pero el calculado por coordenadas es {expected}° (Excede la tolerancia de 2°)."
    ),
    "WRN_DIP_DIR_TALUD_DISCREPANCIA": ErrorRule(
        "WRN_DIP_DIR_TALUD_DISCREPANCIA",
        "CAT_AZ_HOLE_DISCREPANCIA",
        ["DIP_DIR_TALUD"],
        "Discrepancia en dirección del talud (DIP_DIR_TALUD): El valor ingresado es {actual}°, pero el esperado (AZ_HOLE + 90) % 360 es {expected}° (Excede la tolerancia de 2°)."
    )
}
