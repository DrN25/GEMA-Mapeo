MANDATORY_COLS_COUNT = 77

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

# 3. TABLA CONTROL ESTRUCTURAL
CONTROL_ESTRUCTURAL_CATALOG = [1, 2, 3, 4, 5]

# 4. TABLA EFECTOS DE VOLADURA
EFECTOS_VOLADURA_CATALOG = [1, 2, 3, 5, 6]

# 5. TABLA RQD% (Ratings por umbral discreto)
RQD_RATINGS_CATALOG = [
    {"limit": 25,  "r76": 3,  "r89": 3},
    {"limit": 50,  "r76": 8,  "r89": 8},
    {"limit": 75,  "r76": 13, "r89": 13},
    {"limit": 90,  "r76": 17, "r89": 17},
    {"limit": 100, "r76": 20, "r89": 20}
]

# 6. TABLA ESPACIAMIENTO (Puntajes límites)
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

# 7. TABLA TIPO DE ESTRUCTURA
TIPO_ESTRUCTURA_CATALOG = ['BED', 'CON', 'DQ', 'F', 'JN', 'SZ', 'VN', 'SE', 'F+10', 'F-10', '-1', 'RF']

# 8. TABLA TIPO DE RELLENO ACTUALIZADA CON NOMBRES REALES DE EXCEL
TIPO_RELLENO_CATALOG = ['ca', 'sand', 'ch', 'cl', 'gy', 'rxf', 'fbx', 'gou', 'g', 'pat', 'sio', 'si', 'qz', 'su', 'sf', 'ox', 'ep', 'c', '-1']

# 9. TABLA PERFILES DE RUGOSIDAD TIPICOS (ISRM, 1989)
RUGOSIDAD_CATALOG = [1, 2, 3, 4, 5, 6, 7, 8, 9]

# 10. TABLA FORMA DE ESTRUCTURA
FORMA_ESTRUCTURA_CATALOG = ['P', 'C', 'O', 'E', 'I']

# 11. TABLA TIPOS DE ALTERACION
ALTERACION_CATALOG = ['f', 'd', 'm', 'a', 'c', 's', '-1']

# 12. TABLA LITOLOGÍAS Y FACTOR K
LITHOLOGY_CLASSIFICATION = [
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
    {"grupo": "INTRUSIVOS", "lito1": "AN", "lito2": "AN", "lito3": "LAM", "k": 9.31},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_M", "k": 14.74},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_Mg", "k": 14.25},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_S", "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_C", "k": 16.83},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_U", "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "SHL", "lito2": "HFL", "lito3": "SHL_MA", "k": 14.84},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "Varios", "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "Varios", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MSK", "lito3": "Varios", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "Varios", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "Varios", "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "Varios", "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "SHL", "lito2": "HFL", "lito3": "-", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "SND", "lito2": "QZT", "lito3": "-", "k": 12.63},
    {"grupo": "BRECHAS", "lito1": "TBX", "lito2": "TBX", "lito3": "TBX", "k": 13.72},
    {"grupo": "BRECHAS", "lito1": "HBX", "lito2": "HBX", "lito3": "HBX", "k": 11.41},
    {"grupo": "BRECHAS", "lito1": "MBX / varios", "lito2": "MBX", "lito3": "MBX", "k": 11.41},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "-", "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EGT", "lito3": "-", "k": 9.87}
]
