# app/core/catalogs.py

MANDATORY_COLS_COUNT = 77

NORM_GROUP_MAP = {
    "SEDIMENTARIAS": "SEDIMENTARIOS",
    "SEDIMENTARIOS": "SEDIMENTARIOS",
    "INTRUSIVOS": "INTRUSIVOS",
    "METAMORFICAS": "METAMORFICAS",
    "BRECHAS": "BRECHAS",
    "ENDOSKARN": "ENDOSKARN"
}

LITHOLOGY_CATALOG = {
    "INTRUSIVOS": [
        {"lito1": "MZB", "lito2": "MZB", "lito3": "MZB_EQ", "k": 8.29},
        {"lito1": "MZB", "lito2": "MZB", "lito3": "MZB_P", "k": 8.53},
        {"lito1": "MBF1", "lito2": "MBF", "lito3": "MBF1", "k": 9.20},
        {"lito1": "MBF2", "lito2": "MBF", "lito3": "MBF2", "k": 10.73},
        {"lito1": "MBF2", "lito2": "MBF", "lito3": "MBF_P", "k": 9.31},
        {"lito1": "MZM", "lito2": "MZM", "lito3": "MZM_F", "k": 9.31},
        {"lito1": "MZM", "lito2": "MZM", "lito3": "MZM_M", "k": 8.61},
        {"lito1": "MZH", "lito2": "MZH", "lito3": "MZH_1", "k": 11.62},
        {"lito1": "MZH", "lito2": "MZH", "lito3": "MZH_2", "k": 9.31},
        {"lito1": "MZD", "lito2": "MZD", "lito3": "MZD", "k": 7.60},
        {"lito1": "MZQ", "lito2": "MZQ", "lito3": "MZQ", "k": 12.29},
        {"lito1": "AN", "lito2": "AN", "lito3": "LAM", "k": 9.31}
    ],
    "SEDIMENTARIOS": [
        {"lito1": "LMT", "lito2": "LMT", "lito3": "LMT_M", "k": 14.74},
        {"lito1": "LMT", "lito2": "LMT", "lito3": "LMT_Mg", "k": 14.25},
        {"lito1": "LMT", "lito2": "LMT", "lito3": "LMT_S", "k": 14.84},
        {"lito1": "LMT", "lito2": "LMT", "lito3": "LMT_C", "k": 16.83},
        {"lito1": "LMT", "lito2": "LMT", "lito3": "LMT_U", "k": 14.84},
        {"lito1": "SHL", "lito2": "HFL", "lito3": "SHL_MA", "k": 14.84}
    ],
    "METAMORFICAS": [
        {"lito1": "LMT", "lito2": "GSK", "lito3": "Varios", "k": 11.15},
        {"lito1": "LMT", "lito2": "PSK", "lito3": "Varios", "k": 12.63},
        {"lito1": "LMT", "lito2": "MSK", "lito3": "Varios", "k": 12.63},
        {"lito1": "LMT", "lito2": "ESK", "lito3": "Varios", "k": 12.63},
        {"lito1": "LMT", "lito2": "MBC", "lito3": "Varios", "k": 11.78},
        {"lito1": "LMT", "lito2": "MBL", "lito3": "Varios", "k": 13.34},
        {"lito1": "SHL", "lito2": "HFL", "lito3": "-", "k": 12.63},
        {"lito1": "SND", "lito2": "QZT", "lito3": "-", "k": 12.63}
    ],
    "BRECHAS": [
        {"lito1": "TBX", "lito2": "TBX", "lito3": "TBX", "k": 13.72},
        {"lito1": "HBX", "lito2": "HBX", "lito3": "HBX", "k": 11.41},
        {"lito1": "MBX / varios", "lito2": "MBX", "lito3": "MBX", "k": 11.41},
        {"lito1": "MBX", "lito2": "MBX", "lito3": "MBX", "k": 11.41}
    ],
    "ENDOSKARN": [
        {"lito1": "Intrusivo", "lito2": "EPG", "lito3": "-", "k": 9.87},
        {"lito1": "Intrusivo", "lito2": "EGT", "lito3": "-", "k": 9.87}
    ]
}