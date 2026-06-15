import urllib.request
import json

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
  "alteracion_codigo": "f",
  "intemperismo_codigo": "UWF",
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

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/ventanas",
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    with urllib.request.urlopen(req) as response:
        print("Status Code:", response.status)
        print("Response text:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP Error Status:", e.code)
    print("HTTP Error Response:", e.read().decode('utf-8'))
except Exception as e:
    print("Connection failed:", e)
