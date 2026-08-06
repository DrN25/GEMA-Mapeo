MANDATORY_COLS_COUNT = 77

from typing import Optional

NORM_GROUP_MAP = {
    "SEDIMENTARIAS": "SEDIMENTARIOS",
    "SEDIMENTARIOS": "SEDIMENTARIOS",
    "INTRUSIVOS": "INTRUSIVOS",
    "METAMORFICAS": "METAMORFICAS",
    "BRECHAS": "BRECHAS",
    "ENDOSKARN": "ENDOSKARN"
}

# 1. TABLA CONDICION DE AGUA
CONDICION_AGUA_CATALOG = {
    "C": {"desc": "completamente seco", "r76": 10, "r89": 15},
    "H": {"desc": "humedo", "r76": 10, "r89": 10},
    "M": {"desc": "mojado", "r76": 7, "r89": 7},
    "E": {"desc": "goteando", "r76": 4, "r89": 4},
    "F": {"desc": "fluyendo", "r76": 0, "r89": 0}
}

# 2. TABLAS DE RESISTENCIA ISRM (Ratings & UCS Min)
RESISTENCIA_RATING_CATALOG = {
    "R6": {"min_ucs": 250.0, "r89": 15, "r76": 15, "denom": "Extremadamente resistente"},
    "R5": {"min_ucs": 100.0, "r89": 12, "r76": 12, "denom": "Muy resistente"},
    "R4": {"min_ucs": 50.0,  "r89": 7,  "r76": 7,  "denom": "Resistente"},
    "R3": {"min_ucs": 25.0,  "r89": 4,  "r76": 4,  "denom": "Moderadamente resistente"},
    "R2": {"min_ucs": 5.0,   "r89": 2,  "r76": 2,  "denom": "Débil"},
    "R1": {"min_ucs": 1.0,   "r89": 1,  "r76": 1,  "denom": "Muy débil"},
    "R0": {"min_ucs": 0.25,  "r89": 0,  "r76": 0,  "denom": "Extremadamente débil"}
}

# 3. VALORES DE ALTERACION (Unificado de calculator.py)
ALTERACION_RATING_CATALOG = {
    "f": {"r89": 6, "r76": 5},
    "d": {"r89": 5, "r76": 5},
    "m": {"r89": 3, "r76": 4},
    "a": {"r89": 3, "r76": 3},
    "c": {"r89": 2, "r76": 2},
    "s": {"r89": 1, "r76": 1},
}

# 4. VALORES DE RUGOSIDAD (Unificado de calculator.py)
RUGOSIDAD_RATING_CATALOG = {
    1: {"r89": 6, "r76": 5},
    2: {"r89": 5, "r76": 4},
    3: {"r89": 5, "r76": 4},
    4: {"r89": 3, "r76": 2},
    5: {"r89": 3, "r76": 2},
    6: {"r89": 1, "r76": 0},
    7: {"r89": 1, "r76": 0},
    8: {"r89": 0, "r76": 0},
    9: {"r89": 0, "r76": 0},
}

# 5. CONSTANTES DE RELLENO (Unificado de calculator.py)
RELLENO_TIPO = {
    "-1": 3,
    "c": 3,
    "cwf": 3,
    "si": 1,
    "sf": 1,
    "ep": 1,
    "ox": 1,
    "qz": 1,
    "g": 2,
    "cl": 2,
    "ca": 2,
    "ys": 2,
    "ch": 2,
    "sa": 2,
}

RELLENO_VALORES = {
    1: {"r89": 4, "r76": 4}, # Duro < 5mm
    2: {"r89": 2, "r76": 3}, # Duro >= 5mm
    3: {"r89": 2, "r76": 2}, # Blando < 5mm
    4: {"r89": 0, "r76": 0}, # Blando >= 5mm
    5: {"r89": 6, "r76": 5}, # Sin relleno (cwf)
}

# 6. TABLA CONTROL ESTRUCTURAL
CONTROL_ESTRUCTURAL_CATALOG = [1, 2, 3, 4, 5]

# 7. TABLA EFECTOS DE VOLADURA
EFECTOS_VOLADURA_CATALOG = [1, 2, 3, 5, 6]

# 8. TABLA RQD% (Ratings por umbral discreto)
RQD_RATINGS_CATALOG = [
    {"limit": 25,  "r76": 3,  "r89": 3},
    {"limit": 50,  "r76": 8,  "r89": 8},
    {"limit": 75,  "r76": 13, "r89": 13},
    {"limit": 90,  "r76": 17, "r89": 17},
    {"limit": 100, "r76": 20, "r89": 20}
]

# 9. TABLA ESPACIAMIENTO (Puntajes límites)
ESPACIAMIENTO_R89_CATALOG = [
    {"limit": 0.06, "rating": 5},   # < 60 mm
    {"limit": 0.20, "rating": 8},   # 60-200 mm
    {"limit": 0.60, "rating": 10},  # 200-600 mm
    {"limit": 2.00, "rating": 15},  # 600-2000 mm
    {"limit": float('inf'), "rating": 20} # > 2000 mm
]

ESPACIAMIENTO_R76_CATALOG = [
    {"limit": 0.05, "rating": 5},   # < 50 mm
    {"limit": 0.30, "rating": 10},  # 50-300 mm
    {"limit": 1.00, "rating": 20},  # 300-1000 mm
    {"limit": 3.00, "rating": 25},  # 1000-3000 mm
    {"limit": float('inf'), "rating": 30} # > 3000 mm
]

# 10. TABLA TIPO DE ESTRUCTURA
TIPO_ESTRUCTURA_CATALOG = ['BED', 'CON', 'F', 'JN', 'SZ', 'DQ', '-1']
    
# 11. TABLA TIPO DE RELLENO ACTUALIZADA CON NOMBRES REALES DE EXCEL
TIPO_RELLENO_CATALOG = ['c', 'cwf', 'si', 'sf', 'ep', 'ox', 'qz', 'g', 'cl', 'ca', 'ys', 'ch', 'sa', '-1']

# 12. TABLA PERFILES DE RUGOSIDAD TIPICOS (ISRM, 1989)
RUGOSIDAD_CATALOG = [1, 2, 3, 4, 5, 6, 7, 8, 9]

# 13. TABLA FORMA DE ESTRUCTURA
FORMA_ESTRUCTURA_CATALOG = ['P', 'C', 'O', 'E', 'I']

# 14. TABLA TIPOS DE ALTERACION
ALTERACION_CATALOG = ['f', 'd', 'm', 'a', 'c', 's', '-1']

# 15. TABLA LITOLOGÍAS Y FACTOR K
LITHOLOGY_CLASSIFICATION = [
    # INTRUSIVOS
    {"grupo": "INTRUSIVOS", "lito1": "MZB", "lito2": "MZB", "lito3": "MZB_EQ", "k": 8.29},
    {"grupo": "INTRUSIVOS", "lito1": "MZB", "lito2": "MZB", "lito3": "MZB_P", "k": 8.53},
    {"grupo": "INTRUSIVOS", "lito1": "MBF1", "lito2": "MBF", "lito3": "MBF1", "k": 9.20},
    {"grupo": "INTRUSIVOS", "lito1": "MBF2", "lito2": "MBF", "lito3": "MBF2", "k": 10.73},
    {"grupo": "INTRUSIVOS", "lito1": "MBF2", "lito2": "MBF", "lito3": "MBF_P", "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZM", "lito2": "MZM", "lito3": "MZM_F", "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZM", "lito2": "MZM", "lito3": "MZM_M", "k": 8.61},
    {"grupo": "INTRUSIVOS", "lito1": "MZH", "lito2": "MZH", "lito3": "MZH_1", "k": 11.62},
    {"grupo": "INTRUSIVOS", "lito1": "MZH", "lito2": "MZH", "lito3": "MZH_2", "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZD", "lito2": "MZD", "lito3": "MZD", "k": 7.60},
    {"grupo": "INTRUSIVOS", "lito1": "MZQ", "lito2": "MZQ", "lito3": "MZQ", "k": 12.29},
    {"grupo": "INTRUSIVOS", "lito1": "MBF1", "lito2": "MBF", "lito3": "NR", "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MBF2", "lito2": "MBF", "lito3": "NR", "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZM", "lito2": "MZM", "lito3": "NR", "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZB", "lito2": "MZB", "lito3": "NR", "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZH", "lito2": "MZH", "lito3": "NR", "k": 9.31},
    # ENDOSKARN
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EGT", "lito3": "MZM_M", "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EGT", "lito3": "MZB_EQ", "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EGT", "lito3": "-", "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "MZB_EQ", "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "MZM_M", "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "MZD", "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "-", "k": 9.87},
    # BRECHAS
    {"grupo": "BRECHAS", "lito1": "TBX", "lito2": "TBX", "lito3": "TBX", "k": 13.72},
    {"grupo": "BRECHAS", "lito1": "BX", "lito2": "TBX", "lito3": "TBX", "k": 13.72},
    {"grupo": "BRECHAS", "lito1": "HBX", "lito2": "HBX", "lito3": "HBX", "k": 11.41},
    {"grupo": "BRECHAS", "lito1": "MBX / varios", "lito2": "MBX", "lito3": "MBX", "k": 11.41},
    # SEDIMENTARIAS
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT", "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "NR", "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_M", "k": 14.74},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_MG", "k": 14.25},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_S", "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_C", "k": 16.83},
    {"grupo": "SEDIMENTARIOS", "lito1": "SHL", "lito2": "HFL", "lito3": "SHL_MA", "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "OVD", "lito3": "OVD", "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "OVD", "lito3": "-", "k": 14.84},
    # METAMORFICAS
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_M", "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_C", "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_S", "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_U", "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "Varios", "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "LMT_MG", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "LMT_C", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "LMT_S", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "LMT_U", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MSK", "lito3": "LMT_MG", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MSK", "lito3": "LMT_S", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "LMT_M", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "LMT_MG", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "LMT_C", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "LMT_S", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "Varios", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "LMT_M", "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "LMT_MG", "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "LMT_S", "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "Varios", "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "LMT_MG", "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "LMT_S", "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "LMT_M", "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "LMT_C", "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "Varios", "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "SHL", "lito2": "HFL", "lito3": "-", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "SND", "lito2": "QZT", "lito3": "-", "k": 12.63}
]

# ==============================================================================
# CATÁLOGOS DISPLAY — Fuente única de verdad expuesta vía REST API al frontend
# Cualquier cambio en los datos se hace SOLO AQUÍ y se propaga automáticamente.
# ==============================================================================

# D1. RESISTENCIA ISRM con textos de rango y denominación
RESISTENCIA_DISPLAY_CATALOG = [
    {"codigo": "R6", "rango": "≥ 250",         "r76": 15, "r89": 15, "r89_min": 15.0, "r89_max": 15.0, "denom": "Extremadamente resistente"},
    {"codigo": "R5", "rango": "≥ 100 y < 250", "r76": 12, "r89": 12, "r89_min": 12.0, "r89_max": 12.0, "denom": "Muy resistente"},
    {"codigo": "R4", "rango": "≥ 50 y < 100",  "r76": 7,  "r89": 7,  "r89_min": 7.0,  "r89_max": 7.0,  "denom": "Resistente"},
    {"codigo": "R3", "rango": "≥ 25 y < 50",   "r76": 4,  "r89": 4,  "r89_min": 4.0,  "r89_max": 4.0,  "denom": "Moderadamente resistente"},
    {"codigo": "R2", "rango": "≥ 5 y < 25",    "r76": 2,  "r89": 2,  "r89_min": 2.0,  "r89_max": 2.0,  "denom": "Débil"},
    {"codigo": "R1", "rango": "≥ 1 y < 5",     "r76": 1,  "r89": 1,  "r89_min": 1.0,  "r89_max": 1.0,  "denom": "Muy débil"},
    {"codigo": "R0", "rango": "< 1",            "r76": 0,  "r89": 0,  "r89_min": 0.0,  "r89_max": 0.0,  "denom": "Extremadamente débil"},
]

# D2. RQD con texto de rango y calidad
RQD_DISPLAY_CATALOG = [
    {"rango": "< 25 %",         "r76": 3,  "r89": 3,  "r89_min": 3.00,  "r89_max": 3.00,  "calidad": "Muy Mala"},
    {"rango": "≥ 25 y < 50 %",  "r76": 8,  "r89": 8,  "r89_min": 8.00,  "r89_max": 8.00,  "calidad": "Mala"},
    {"rango": "≥ 50 y < 75 %",  "r76": 13, "r89": 13, "r89_min": 13.00, "r89_max": 13.00, "calidad": "Regular"},
    {"rango": "≥ 75 y < 90 %",  "r76": 17, "r89": 17, "r89_min": 17.00, "r89_max": 17.00, "calidad": "Buena"},
    {"rango": "≥ 90 y ≤ 100 %", "r76": 20, "r89": 20, "r89_min": 20.00, "r89_max": 20.00, "calidad": "Excelente"},
]

# D3. ESPACIAMIENTO con rangos en mm para R89 y R76 lado a lado
ESPACIAMIENTO_DISPLAY_CATALOG = [
    {"r89_range": "< 60 mm",           "r89_rating": 5,  "r76_range": "< 50 mm",            "r76_rating": 5},
    {"r89_range": "≥ 60 y < 200 mm",   "r89_rating": 8,  "r76_range": "≥ 50 y < 300 mm",    "r76_rating": 10},
    {"r89_range": "≥ 200 y < 600 mm",  "r89_rating": 10, "r76_range": "≥ 300 y < 1000 mm",  "r76_rating": 20},
    {"r89_range": "≥ 600 y < 2000 mm", "r89_rating": 15, "r76_range": "≥ 1000 y < 3000 mm", "r76_rating": 25},
    {"r89_range": "≥ 2000 mm",          "r89_rating": 20, "r76_range": "≥ 3000 mm",           "r76_rating": 30},
]

# D4. CONDICIÓN DE AGUA con código, descripción y ratings
AGUA_DISPLAY_CATALOG = [
    {"codigo": "C", "desc": "Completamente seco", "r76": 10, "r89": 15},
    {"codigo": "H", "desc": "Húmedo",              "r76": 10, "r89": 10},
    {"codigo": "M", "desc": "Mojado",              "r76": 7,  "r89": 7},
    {"codigo": "E", "desc": "Goteando",            "r76": 4,  "r89": 4},
    {"codigo": "F", "desc": "Fluyendo",            "r76": 0,  "r89": 0},
]

# D5. ALTERACIÓN con código, nombre y ratings
ALTERACION_DISPLAY_CATALOG = [
    {"codigo": "f", "nombre": "Fresca",                    "r76": 5, "r89": 6},
    {"codigo": "d", "nombre": "Débilmente meteorizada",    "r76": 5, "r89": 5},
    {"codigo": "m", "nombre": "Moderadamente meteorizada", "r76": 4, "r89": 3},
    {"codigo": "a", "nombre": "Altamente meteorizada",     "r76": 3, "r89": 3},
    {"codigo": "c", "nombre": "Completamente meteorizada", "r76": 2, "r89": 2},
    {"codigo": "s", "nombre": "Suelo residual",            "r76": 1, "r89": 1},
]

# D6. RELLENO con nombre completo, tipo y ratings por espesor
RELLENO_DISPLAY_CATALOG = [
    {"codigo": "-1",  "nombre": "Sin información",         "tipo": "Sin relleno", "r76_lt5": 5, "r89_lt5": 6, "r76_gte5": 5, "r89_gte5": 6},
    {"codigo": "c",   "nombre": "Limpio sin relleno",      "tipo": "Sin relleno", "r76_lt5": 5, "r89_lt5": 6, "r76_gte5": 5, "r89_gte5": 6},
    {"codigo": "si",  "nombre": "Sílice",                  "tipo": "Duro",        "r76_lt5": 4, "r89_lt5": 4, "r76_gte5": 3, "r89_gte5": 2},
    {"codigo": "sf",  "nombre": "Sulfuros",                "tipo": "Duro",        "r76_lt5": 4, "r89_lt5": 4, "r76_gte5": 3, "r89_gte5": 2},
    {"codigo": "ep",  "nombre": "Epidota",                 "tipo": "Duro",        "r76_lt5": 4, "r89_lt5": 4, "r76_gte5": 3, "r89_gte5": 2},
    {"codigo": "ox",  "nombre": "Óxidos",                  "tipo": "Duro",        "r76_lt5": 4, "r89_lt5": 4, "r76_gte5": 3, "r89_gte5": 2},
    {"codigo": "qz",  "nombre": "Cuarzo",                  "tipo": "Duro",        "r76_lt5": 4, "r89_lt5": 4, "r76_gte5": 3, "r89_gte5": 2},
    {"codigo": "g",   "nombre": "Panizo (Roca Triturada)", "tipo": "Blando",      "r76_lt5": 2, "r89_lt5": 2, "r76_gte5": 0, "r89_gte5": 0},
    {"codigo": "cl",  "nombre": "Arcilla",                 "tipo": "Blando",      "r76_lt5": 2, "r89_lt5": 2, "r76_gte5": 0, "r89_gte5": 0},
    {"codigo": "ca",  "nombre": "Calcita",                 "tipo": "Blando",      "r76_lt5": 2, "r89_lt5": 2, "r76_gte5": 0, "r89_gte5": 0},
    {"codigo": "ys",  "nombre": "Yeso",                    "tipo": "Blando",      "r76_lt5": 2, "r89_lt5": 2, "r76_gte5": 0, "r89_gte5": 0},
    {"codigo": "ch",  "nombre": "Clorita",                 "tipo": "Blando",      "r76_lt5": 2, "r89_lt5": 2, "r76_gte5": 0, "r89_gte5": 0},
    {"codigo": "sa",  "nombre": "Arena",                   "tipo": "Blando",      "r76_lt5": 2, "r89_lt5": 2, "r76_gte5": 0, "r89_gte5": 0},
]

# D7. RUGOSIDAD con descripción y ratings
RUGOSIDAD_DISPLAY_CATALOG = [
    {"clase": 1, "desc": "Muy rugosa (Escalón/Irreg)", "r76": 5, "r89": 6},
    {"clase": 2, "desc": "Rugosa (Ondulada)",           "r76": 4, "r89": 5},
    {"clase": 3, "desc": "Lig. Rugosa (Ondulada)",      "r76": 4, "r89": 5},
    {"clase": 4, "desc": "Plana Rugosa",                "r76": 2, "r89": 3},
    {"clase": 5, "desc": "Plana Lig. Rugosa",           "r76": 2, "r89": 3},
    {"clase": 6, "desc": "Plana Lisa",                  "r76": 0, "r89": 1},
    {"clase": 7, "desc": "Ondulada Pulida",             "r76": 0, "r89": 1},
    {"clase": 8, "desc": "Plana Pulida / Espejo",       "r76": 0, "r89": 0},
    {"clase": 9, "desc": "Cizallada / Arcillosa",       "r76": 0, "r89": 0},
]

# D8. FORMA DE ESTRUCTURA
FORMA_DISPLAY_CATALOG = [
    {"codigo": "P", "desc": "Plana"},
    {"codigo": "C", "desc": "Curva"},
    {"codigo": "O", "desc": "Ondulada"},
    {"codigo": "E", "desc": "Escalonada"},
    {"codigo": "I", "desc": "Irregular"},
]

# D9. TIPO DE ESTRUCTURA
ESTRUCTURA_DISPLAY_CATALOG = [
    {"codigo": "JN",  "nombre": "Junta (JS)"},
    {"codigo": "BED", "nombre": "Estratos (BED)"},
    {"codigo": "F",   "nombre": "Falla (F)"},
    {"codigo": "SZ",  "nombre": "Zona de Cizalla (SZ)"},
    {"codigo": "CON", "nombre": "Contacto (CON)"},
    {"codigo": "DQ",  "nombre": "Dique (DQ)"},
]

# D10. EXTREMOS VISIBLES / TERMINACIÓN
EXTREMOS_TERMINACION_DISPLAY_CATALOG = [
    {"codigo": 0, "terminacion": "No se ven",                "desc": "No se observan ambos extremos"},
    {"codigo": 1, "terminacion": "Solo vemos uno",           "desc": "Solo se observa un extremo visible que termina en otra estructura en el banco"},
    {"codigo": 2, "terminacion": "Se ven dos extremos",      "desc": "Se observan dos extremos visibles que terminan en otra estructura en el banco"},
    {"codigo": 3, "terminacion": "Termina entre estructuras","desc": "La estructura finaliza en el espacio comprendido entre dos estructuras cercanas."},
]

# D11. CONTROL ESTRUCTURAL
CONTROL_ESTRUCTURAL_DISPLAY_CATALOG = [
    {"val": 1, "clas": "Ninguno",    "desc": "No hay discontinuidades aparentes, o no hay discontinuidades que influyan la estabilidad del banco"},
    {"val": 2, "clas": "Débil",      "desc": "Uno a tres conjuntos de estructuras que son discontinuas y/o tienen una orientación favorable"},
    {"val": 3, "clas": "Moderado",   "desc": "Las discontinuidades forman inestabilidades pequeñas y discontinuas del banco"},
    {"val": 4, "clas": "Fuerte",     "desc": "Las discontinuidades están bien desarrolladas y forman deslizamientos tipo cuña o plano"},
    {"val": 5, "clas": "Muy Fuerte", "desc": "Las discontinuidades están bien desarrolladas y forman deslizamientos planos o cuñas de igual altura del banco"},
]

# D12. EFECTOS DE VOLADURA
EFECTOS_VOLADURA_DISPLAY_CATALOG = [
    {"val": 1, "clas": "Ninguno",    "desc": "No hay efectos visibles."},
    {"val": 2, "clas": "Débil",      "desc": "Hay fracturamiento menor y sobrequiebre del área de la cresta. Pocas fracturas nuevas y abiertas."},
    {"val": 3, "clas": "Moderado",   "desc": "Varias fracturas irregulares en la cara de banco. Las juntas y fracturas están abiertas < 10 mm."},
    {"val": 5, "clas": "Fuerte",     "desc": "Varias fracturas abiertas hasta 20 mm. La cresta del banco está suelta y existe sobrequiebre."},
    {"val": 6, "clas": "Muy Fuerte", "desc": "Muchas fracturas abiertas y concoidales. La cresta está fracturada intensamente. Diaclasas > 20mm."},
]

# D13. LITOLOGÍA TABLA 1 — Correlación Lito1/Lito2/Lito3/K (vista de reporte esquemático)
LITO_COLORES_DISPLAY_CATALOG = [
    {"lito1": "MZB",          "lito2": "MZB", "lito3": "MZB_EQ", "k": 8.29},
    {"lito1": "MZB",          "lito2": "MZB", "lito3": "MZB_P",  "k": 8.53},
    {"lito1": "MBF1",         "lito2": "MBF", "lito3": "MBF1",   "k": 9.20},
    {"lito1": "MBF2",         "lito2": "MBF", "lito3": "MBF2",   "k": 10.73},
    {"lito1": "MBF2",         "lito2": "MBF", "lito3": "MBF_P",  "k": 9.31},
    {"lito1": "MZM",          "lito2": "MZM", "lito3": "MZM_F",  "k": 9.31},
    {"lito1": "MZM",          "lito2": "MZM", "lito3": "MZM_M",  "k": 8.61},
    {"lito1": "MZH",          "lito2": "MZH", "lito3": "MZH_1",  "k": 11.62},
    {"lito1": "MZH",          "lito2": "MZH", "lito3": "MZH_2",  "k": 9.31},
    {"lito1": "MZD",          "lito2": "MZD", "lito3": "MZD",    "k": 7.60},
    {"lito1": "MZQ",          "lito2": "MZQ", "lito3": "MZQ",    "k": 12.29},
    {"lito1": "AN",           "lito2": "AN",  "lito3": "LAM",    "k": 9.31},
    {"lito1": "LMT",          "lito2": "LMT", "lito3": "LMT_M",  "k": 14.74},
    {"lito1": "LMT",          "lito2": "LMT", "lito3": "LMT_Mg", "k": 14.25},
    {"lito1": "LMT",          "lito2": "LMT", "lito3": "LMT_S",  "k": 14.84},
    {"lito1": "LMT",          "lito2": "LMT", "lito3": "LMT_C",  "k": 16.83},
    {"lito1": "LMT",          "lito2": "LMT", "lito3": "LMT_U",  "k": 14.84},
    {"lito1": "SHL",          "lito2": "HFL", "lito3": "SHL_MA", "k": 14.84},
    {"lito1": "LMT",          "lito2": "GSK", "lito3": "Varios", "k": 11.15},
    {"lito1": "LMT",          "lito2": "PSK", "lito3": "Varios", "k": 12.63},
    {"lito1": "LMT",          "lito2": "MSK", "lito3": "Varios", "k": 12.63},
    {"lito1": "LMT",          "lito2": "ESK", "lito3": "Varios", "k": 12.63},
    {"lito1": "LMT",          "lito2": "MBC", "lito3": "Varios", "k": 11.78},
    {"lito1": "LMT",          "lito2": "MBL", "lito3": "Varios", "k": 13.34},
    {"lito1": "SHL",          "lito2": "HFL", "lito3": "-",      "k": 12.63},
    {"lito1": "SND",          "lito2": "QZT", "lito3": "-",      "k": 12.63},
    {"lito1": "TBX",          "lito2": "TBX", "lito3": "TBX",    "k": 13.72},
    {"lito1": "HBX",          "lito2": "HBX", "lito3": "HBX",    "k": 11.41},
    {"lito1": "MBX / varios", "lito2": "MBX", "lito3": "MBX",   "k": 11.41},
    {"lito1": "Intrusivo",    "lito2": "EPG", "lito3": "-",      "k": 9.87},
    {"lito1": "Intrusivo",    "lito2": "EGT", "lito3": "-",      "k": 9.87},
]

# D14. LITOLOGÍA TABLA 2 — Validación por pares Lito2/Lito3 (vista de base de datos/reglas de escape)
LITO_VALIDACION_DISPLAY_CATALOG = [
    {"grupo": "INTRUSIVOS",    "lito2": "MZB", "lito3": "MZB_EQ",  "validacion": "MZB/MZB_EQ",  "k": 8.29},
    {"grupo": "INTRUSIVOS",    "lito2": "MZB", "lito3": "MZB_P",   "validacion": "MZB/MZB_P",   "k": 8.53},
    {"grupo": "INTRUSIVOS",    "lito2": "MBF", "lito3": "MBF1",    "validacion": "MBF/MBF1",    "k": 9.20},
    {"grupo": "INTRUSIVOS",    "lito2": "MBF", "lito3": "MBF2",    "validacion": "MBF/MBF2",    "k": 10.73},
    {"grupo": "INTRUSIVOS",    "lito2": "MBF", "lito3": "MBF_P",   "validacion": "MBF/MBF_P",   "k": 9.31},
    {"grupo": "INTRUSIVOS",    "lito2": "MZM", "lito3": "MZM_F",   "validacion": "MZM/MZM_F",   "k": 9.31},
    {"grupo": "INTRUSIVOS",    "lito2": "MZM", "lito3": "MZM_M",   "validacion": "MZM/MZM_M",   "k": 8.61},
    {"grupo": "INTRUSIVOS",    "lito2": "MZH", "lito3": "MZH_1",   "validacion": "MZH/MZH_1",   "k": 11.62},
    {"grupo": "INTRUSIVOS",    "lito2": "MZH", "lito3": "MZH_2",   "validacion": "MZH/MZH_2",   "k": 9.31},
    {"grupo": "INTRUSIVOS",    "lito2": "MZD", "lito3": "MZD",     "validacion": "MZD/MZD",     "k": 7.60},
    {"grupo": "INTRUSIVOS",    "lito2": "MZQ", "lito3": "MZQ",     "validacion": "MZQ/MZQ",     "k": 12.29},
    {"grupo": "INTRUSIVOS",    "lito2": "MBF", "lito3": "NR",      "validacion": "MBF/NR",      "k": 9.31},
    {"grupo": "INTRUSIVOS",    "lito2": "MZM", "lito3": "NR",      "validacion": "MZM/NR",      "k": 9.31},
    {"grupo": "INTRUSIVOS",    "lito2": "MZB", "lito3": "NR",      "validacion": "MZB/NR",      "k": 9.31},
    {"grupo": "INTRUSIVOS",    "lito2": "MZH", "lito3": "NR",      "validacion": "MZH/NR",      "k": 9.31},
    {"grupo": "ENDOSKARN",     "lito2": "EGT", "lito3": "MZM_M",   "validacion": "EGT/MZM_M",   "k": 9.87},
    {"grupo": "ENDOSKARN",     "lito2": "EGT", "lito3": "MZB_EQ",  "validacion": "EGT/MZB_EQ",  "k": 9.87},
    {"grupo": "ENDOSKARN",     "lito2": "EGT", "lito3": "-",       "validacion": "EGT/-",       "k": 9.87},
    {"grupo": "ENDOSKARN",     "lito2": "EPG", "lito3": "MZB_EQ",  "validacion": "EPG/MZB_EQ",  "k": 9.87},
    {"grupo": "ENDOSKARN",     "lito2": "EPG", "lito3": "MZM_M",   "validacion": "EPG/MZM_M",   "k": 9.87},
    {"grupo": "ENDOSKARN",     "lito2": "EPG", "lito3": "MZD",     "validacion": "EPG/MZD",     "k": 9.87},
    {"grupo": "ENDOSKARN",     "lito2": "EPG", "lito3": "-",       "validacion": "EPG/-",       "k": 9.87},
    {"grupo": "BRECHAS",       "lito2": "TBX", "lito3": "TBX",     "validacion": "TBX/TBX",     "k": 13.72},
    {"grupo": "BRECHAS",       "lito2": "BX",  "lito3": "TBX",     "validacion": "BX/TBX",      "k": 13.72},
    {"grupo": "BRECHAS",       "lito2": "HBX", "lito3": "HBX",     "validacion": "HBX/HBX",     "k": 11.41},
    {"grupo": "BRECHAS",       "lito2": "MBX", "lito3": "MBX",     "validacion": "MBX/MBX",     "k": 11.41},
    {"grupo": "SEDIMENTARIAS", "lito2": "LMT", "lito3": "LMT",     "validacion": "LMT/LMT",     "k": 14.84},
    {"grupo": "SEDIMENTARIAS", "lito2": "LMT", "lito3": "NR",      "validacion": "LMT/NR",      "k": 14.84},
    {"grupo": "SEDIMENTARIAS", "lito2": "LMT", "lito3": "LMT_M",   "validacion": "LMT/LMT_M",   "k": 14.74},
    {"grupo": "SEDIMENTARIAS", "lito2": "LMT", "lito3": "LMT_MG",  "validacion": "LMT/LMT_MG",  "k": 14.25},
    {"grupo": "SEDIMENTARIAS", "lito2": "LMT", "lito3": "LMT_S",   "validacion": "LMT/LMT_S",   "k": 14.84},
    {"grupo": "SEDIMENTARIAS", "lito2": "LMT", "lito3": "LMT_C",   "validacion": "LMT/LMT_C",   "k": 16.83},
    {"grupo": "SEDIMENTARIAS", "lito2": "HFL", "lito3": "SHL_MA",  "validacion": "HFL/SHL_MA",  "k": 14.84},
    {"grupo": "SEDIMENTARIAS", "lito2": "OVD", "lito3": "OVD",     "validacion": "OVD/OVD",     "k": 14.84},
    {"grupo": "SEDIMENTARIAS", "lito2": "OVD", "lito3": "-",       "validacion": "OVD/-",       "k": 14.84},
    {"grupo": "METAMORFICAS",  "lito2": "GSK", "lito3": "LMT_M",   "validacion": "GSK/LMT_M",   "k": 11.15},
    {"grupo": "METAMORFICAS",  "lito2": "GSK", "lito3": "LMT_C",   "validacion": "GSK/LMT_C",   "k": 11.15},
    {"grupo": "METAMORFICAS",  "lito2": "GSK", "lito3": "LMT_S",   "validacion": "GSK/LMT_S",   "k": 11.15},
    {"grupo": "METAMORFICAS",  "lito2": "GSK", "lito3": "LMT_U",   "validacion": "GSK/LMT_U",   "k": 11.15},
    {"grupo": "METAMORFICAS",  "lito2": "GSK", "lito3": "Varios",  "validacion": "GSK/Varios",  "k": 11.15},
    {"grupo": "METAMORFICAS",  "lito2": "PSK", "lito3": "LMT_MG",  "validacion": "PSK/LMT_MG",  "k": 12.63},
    {"grupo": "METAMORFICAS",  "lito2": "PSK", "lito3": "LMT_C",   "validacion": "PSK/LMT_C",   "k": 12.63},
    {"grupo": "METAMORFICAS",  "lito2": "PSK", "lito3": "LMT_S",   "validacion": "PSK/LMT_S",   "k": 12.63},
    {"grupo": "METAMORFICAS",  "lito2": "PSK", "lito3": "LMT_U",   "validacion": "PSK/LMT_U",   "k": 12.63},
    {"grupo": "METAMORFICAS",  "lito2": "MSK", "lito3": "LMT_MG",  "validacion": "MSK/LMT_MG",  "k": 12.63},
    {"grupo": "METAMORFICAS",  "lito2": "MSK", "lito3": "LMT_S",   "validacion": "MSK/LMT_S",   "k": 12.63},
    {"grupo": "METAMORFICAS",  "lito2": "ESK", "lito3": "LMT_M",   "validacion": "ESK/LMT_M",   "k": 12.63},
    {"grupo": "METAMORFICAS",  "lito2": "ESK", "lito3": "LMT_MG",  "validacion": "ESK/LMT_MG",  "k": 12.63},
    {"grupo": "METAMORFICAS",  "lito2": "ESK", "lito3": "LMT_C",   "validacion": "ESK/LMT_C",   "k": 12.63},
    {"grupo": "METAMORFICAS",  "lito2": "ESK", "lito3": "LMT_S",   "validacion": "ESK/LMT_S",   "k": 12.63},
    {"grupo": "METAMORFICAS",  "lito2": "ESK", "lito3": "Varios",  "validacion": "ESK/Varios",  "k": 12.63},
    {"grupo": "METAMORFICAS",  "lito2": "MBC", "lito3": "LMT_M",   "validacion": "MBC/LMT_M",   "k": 11.78},
    {"grupo": "METAMORFICAS",  "lito2": "MBC", "lito3": "LMT_MG",  "validacion": "MBC/LMT_MG",  "k": 11.78},
    {"grupo": "METAMORFICAS",  "lito2": "MBC", "lito3": "LMT_S",   "validacion": "MBC/LMT_S",   "k": 11.78},
    {"grupo": "METAMORFICAS",  "lito2": "MBC", "lito3": "Varios",  "validacion": "MBC/Varios",  "k": 11.78},
    {"grupo": "METAMORFICAS",  "lito2": "MBL", "lito3": "LMT_MG",  "validacion": "MBL/LMT_MG",  "k": 13.34},
    {"grupo": "METAMORFICAS",  "lito2": "MBL", "lito3": "LMT_S",   "validacion": "MBL/LMT_S",   "k": 13.34},
    {"grupo": "METAMORFICAS",  "lito2": "MBL", "lito3": "LMT_M",   "validacion": "MBL/LMT_M",   "k": 13.34},
    {"grupo": "METAMORFICAS",  "lito2": "MBL", "lito3": "LMT_C",   "validacion": "MBL/LMT_C",   "k": 13.34},
    {"grupo": "METAMORFICAS",  "lito2": "MBL", "lito3": "Varios",  "validacion": "MBL/Varios",  "k": 13.34},
]

# D15. LITOLOGÍA FULL — Tabla completa con lito1/lito2/lito3/grupo/k
# Usada por el frontend para resolveLithologyCascade (lookupPltKOnly)
LITHOLOGY_FULL_CATALOG = [
    # INTRUSIVOS
    {"grupo": "INTRUSIVOS", "lito1": "MZB",  "lito2": "MZB", "lito3": "MZB_EQ", "k": 8.29},
    {"grupo": "INTRUSIVOS", "lito1": "MZB",  "lito2": "MZB", "lito3": "MZB_P",  "k": 8.53},
    {"grupo": "INTRUSIVOS", "lito1": "MZB",  "lito2": "MZB", "lito3": "NR",     "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MBF1", "lito2": "MBF", "lito3": "MBF1",   "k": 9.20},
    {"grupo": "INTRUSIVOS", "lito1": "MBF1", "lito2": "MBF", "lito3": "NR",     "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MBF2", "lito2": "MBF", "lito3": "MBF2",   "k": 10.73},
    {"grupo": "INTRUSIVOS", "lito1": "MBF2", "lito2": "MBF", "lito3": "MBF_P",  "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MBF2", "lito2": "MBF", "lito3": "NR",     "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZM",  "lito2": "MZM", "lito3": "MZM_F",  "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZM",  "lito2": "MZM", "lito3": "MZM_M",  "k": 8.61},
    {"grupo": "INTRUSIVOS", "lito1": "MZM",  "lito2": "MZM", "lito3": "NR",     "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZH",  "lito2": "MZH", "lito3": "MZH_1",  "k": 11.62},
    {"grupo": "INTRUSIVOS", "lito1": "MZH",  "lito2": "MZH", "lito3": "MZH_2",  "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZH",  "lito2": "MZH", "lito3": "NR",     "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZD",  "lito2": "MZD", "lito3": "MZD",    "k": 7.60},
    {"grupo": "INTRUSIVOS", "lito1": "MZQ",  "lito2": "MZQ", "lito3": "MZQ",    "k": 12.29},
    {"grupo": "INTRUSIVOS", "lito1": "AN",   "lito2": "AN",  "lito3": "LAM",    "k": 9.31},
    # SEDIMENTARIOS
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT",    "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_M",  "k": 14.74},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_MG", "k": 14.25},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_S",  "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_C",  "k": 16.83},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_U",  "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "NR",     "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "SHL", "lito2": "HFL", "lito3": "SHL_MA", "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "SHL", "lito2": "HFL", "lito3": "-",      "k": 12.63},
    {"grupo": "SEDIMENTARIOS", "lito1": "SND", "lito2": "QZT", "lito3": "-",      "k": 12.63},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "OVD", "lito3": "OVD",    "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "OVD", "lito3": "-",      "k": 14.84},
    # BRECHAS
    {"grupo": "BRECHAS", "lito1": "TBX",          "lito2": "TBX", "lito3": "TBX", "k": 13.72},
    {"grupo": "BRECHAS", "lito1": "HBX",          "lito2": "HBX", "lito3": "HBX", "k": 11.41},
    {"grupo": "BRECHAS", "lito1": "MBX / varios", "lito2": "MBX", "lito3": "MBX", "k": 11.41},
    # ENDOSKARN
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "MZB_EQ", "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "MZM_M",  "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "MZD",    "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "-",      "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EGT", "lito3": "MZM_M",  "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EGT", "lito3": "MZB_EQ", "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EGT", "lito3": "-",      "k": 9.87},
    # METAMORFICAS
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_M",  "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_C",  "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_S",  "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_U",  "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_MG", "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "Varios", "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "LMT_MG", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "LMT_C",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "LMT_S",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "LMT_U",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "Varios", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MSK", "lito3": "LMT_MG", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MSK", "lito3": "LMT_S",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MSK", "lito3": "Varios", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "LMT_M",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "LMT_MG", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "LMT_C",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "LMT_S",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "Varios", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "LMT_M",  "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "LMT_MG", "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "LMT_S",  "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "Varios", "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "LMT_MG", "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "LMT_S",  "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "LMT_M",  "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "LMT_C",  "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "Varios", "k": 13.34},
]

# D16. CATÁLOGO DIRECCIÓN DE ROTURA PLT (cat.DireccionRuptura)
DIRECCION_ROTURA_DISPLAY_CATALOG = [
    {"codigo": "Pa", "descripcion": "Paralela a los planos de debilidad de la muestra"},
    {"codigo": "Pe", "descripcion": "Perpendicular a los planos de debilidad de la muestra"},
    {"codigo": "NA", "descripcion": "No aplica — roca masiva sin planos de debilidad definidos"}
]

# D17. CATÁLOGO TIPO DE FRACTURA PLT (cat.TipoFracturaPLT)
TIPO_FRACTURA_DISPLAY_CATALOG = [
    {"codigo": "M", "descripcion": "Rotura por matriz — falla a través de la roca intacta"},
    {"codigo": "E", "descripcion": "Rotura por estructura — falla a lo largo de discontinuidad preexistente"},
    {"codigo": "C", "descripcion": "Rotura combinada — por matriz y estructura simultáneamente"}
]

# D18. GSI — CONDICIÓN DE LA SUPERFICIE (eje X de la gráfica Hoek-Brown; 45 unidades / 5 columnas = 9/columna)
GSI_SUPERFICIE_DISPLAY_CATALOG = [
    {"codigo": "VG", "termino": "VERY GOOD", "desc": "Superficies muy rugosas, frescas y no intemperizadas.", "min": 36, "max": 45},
    {"codigo": "G",  "termino": "GOOD",       "desc": "Superficies rugosas, ligeramente intemperizadas y con manchas de hierro.", "min": 27, "max": 36},
    {"codigo": "F",  "termino": "FAIR",       "desc": "Superficies lisas, moderadamente intemperizadas y alteradas.", "min": 18, "max": 27},
    {"codigo": "P",  "termino": "POOR",       "desc": "Superficies con espejo de falla (slickensided), altamente intemperizadas con recubrimientos compactos o rellenos de fragmentos angulares.", "min": 9, "max": 18},
    {"codigo": "VP", "termino": "VERY POOR",  "desc": "Superficies con espejo de falla (slickensided), altamente intemperizadas con recubrimientos o rellenos de arcilla blanda.", "min": 0, "max": 9},
]

# D19. GSI — ESTRUCTURA (eje Y de la gráfica Hoek-Brown; 40 unidades / 4 filas = 10/fila)
GSI_ESTRUCTURA_DISPLAY_CATALOG = [
    {"codigo": "B",  "termino": "BLOCKY",                   "desc": "Masa rocosa inalterada y bien intertrabada, formada por bloques cúbicos constituidos por tres familias de juntas que se intersectan.", "min": 30, "max": 40},
    {"codigo": "VB", "termino": "VERY BLOCKY",               "desc": "Masa rocosa intertrabada y parcialmente perturbada, con bloques angulares multifacéticos formados por 4 o más familias de juntas.", "min": 20, "max": 30},
    {"codigo": "BD", "termino": "BLOCKY, DISTURBED / SEAMY", "desc": "Plegada con bloques angulares formados por muchas familias de juntas que se intersectan. Persistencia de planos de estratificación o esquistosidad.", "min": 10, "max": 20},
    {"codigo": "D",  "termino": "DISINTEGRATED",             "desc": "Masa rocosa pobremente intertrabada y fuertemente rota, con una mezcla de fragmentos de roca angulares y redondeados.", "min": 0, "max": 10},
]

# D20. SINÓNIMOS DE GRUPOS LITOLÓGICOS (normalización a singular/plural)
LITHOLOGY_GROUP_SYNONYMS = {
    "SEDIMENTARIA": "SEDIMENTARIAS",
    "SEDIMENTARIO": "SEDIMENTARIAS",
    "SEDIMENTARIOS": "SEDIMENTARIAS",
    "INTRUSIVA": "INTRUSIVOS",
    "INTRUSIVAS": "INTRUSIVOS",
    "INTRUSIVO": "INTRUSIVOS",
    "METAMORFICO": "METAMORFICAS",
    "METAMORFICOS": "METAMORFICAS",
    "METAMORFICA": "METAMORFICAS",
    "BRECHA": "BRECHAS",
}


def _norm_litho(val) -> str:
    return str(val or "").strip().upper()


def infer_lithology_from_lito3(lito3: str) -> Optional[dict]:
    """Dado un código de Lito 3 (ej. 'MZQ', 'LMT_M', 'MZB_P'), busca en el
    catálogo LITHOLOGY_FULL_CATALOG la primera combinación válida de
    lito1/lito2/lito3 que lo acepte y devuelve:
        {"lito1": ..., "lito2": ..., "lito3": ..., "grupo": ..., "k": ...}
    o None si no se encuentra.

    Estrategia:
      1. Match exacto de lito3 (priorizando lito1 == lito2, combinación
         "directa" más probable).
      2. Si no, primer match exacto de lito3.
      3. Si no, match por comodines del catálogo ('Varios', '-', 'NR').
    """
    target = _norm_litho(lito3)
    if not target:
        return None

    exact = [it for it in LITHOLOGY_FULL_CATALOG if _norm_litho(it.get("lito3")) == target]
    if exact:
        direct = next(
            (it for it in exact if _norm_litho(it.get("lito1")) == _norm_litho(it.get("lito2"))),
            None,
        )
        chosen = direct or exact[0]
        return {
            "lito1": chosen.get("lito1"),
            "lito2": chosen.get("lito2"),
            "lito3": chosen.get("lito3"),
            "grupo": chosen.get("grupo"),
            "k": chosen.get("k"),
        }

    # Comodines: lito3 en catálogo es 'Varios', '-' o 'NR' — cualquier
    # combinación que acepte el lito3 entrante como específico no aplica
    # aquí (el comodín es para el otro sentido). Se devuelve None para que
    # el importador deje los litos vacíos y el usuario los complete.
    return None