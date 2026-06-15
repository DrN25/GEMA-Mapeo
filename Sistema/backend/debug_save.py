import json
import traceback
from app.database import SessionLocal
from app import schemas
from app.main import save_ventana

payload = {
  "codigo": "V-01",
  "fecha_mapeo": "2026-06-15",
  "mapeador": "RD/RB",
  "campania": 2026,
  "este_ini": 1000.0,
  "norte_ini": 2000.0,
  "cota_ini": 3000.0,
  "este_fin": 1005.0,
  "norte_fin": 2005.0,
  "cota_fin": 3000.0,
  "largo_m": 7.07,
  "altura_m": 2.0,
  "dip_talud": 65.0,
  "alteracion_codigo": "d",
  "intemperismo_codigo": "d",
  "lito_1": "MZB",
  "lito_2": "MZB",
  "lito_3": "MZB",
  "unidad_litologica": "MZB",
  "sector": "E1",
  "fase": 5,
  "nivel": 3960.0,
  "sector_geotecnico": "E1",
  "discontinuidades": [
    {
      "fam": 1,
      "dist": 1.2,
      "tipo": "J",
      "dip": 45.0,
      "dipdir": 180.0,
      "aber": 0.1,
      "esp": 0.0,
      "cont": 1.5,
      "espac": 0.5,
      "nstr": 1.0,
      "next": 1,
      "term": 0,
      "r1": "cwf",
      "r2": "cwf",
      "jrc": 10,
      "rug": 2,
      "forma": "O",
      "alt": "d"
    }
  ],
  "rmr_input": {
    "agua_codigo": "C",
    "resistencia_codigo": "R4",
    "gsi_estructura": "VB",
    "gsi_superficie": "G",
    "gsi_visual": 50,
    "control_estructural": 4,
    "efectos_voladura": 3,
    "ucs_mpa": 74.0,
    "is50_mpa": 5.0,
    "comentario": "Test save"
  }
}

try:
    print("Parsing payload into VentanaSaveSchema...")
    data = schemas.VentanaSaveSchema(**payload)
    print("Payload parsed successfully.")
    
    print("Opening database session...")
    db = SessionLocal()
    try:
        print("Calling save_ventana...")
        res = save_ventana(data, db)
        print("Success:", res)
    except Exception as e:
        print("Error during save_ventana:")
        traceback.print_exc()
    finally:
        db.close()
except Exception as e:
    print("Error parsing schema:")
    traceback.print_exc()
