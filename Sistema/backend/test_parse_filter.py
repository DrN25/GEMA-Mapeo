"""Smoke test: verificar que parse recibe celdas y filtra correctamente."""
import sys, os, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)

# Probar conceldas especificas
material_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "Material")
fpath = os.path.join(material_dir, "Excel_B_BD.xlsx")

with open(fpath, 'rb') as f:
    r = client.post('/api/importar-excel/parse?celdas=A1,B1,C3', files={'file': ('test.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')})

print(f"Status: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(f"Total: {data['total']}")
    for c in data['celdas']:
        print(f"  {c['codigo']} - {len(c['data'].get('discontinuidades', []))} discontinuidades")
        print(f"     sector={c['data'].get('sector_geotecnico')}")
else:
    print(f"Error: {r.text[:500]}")