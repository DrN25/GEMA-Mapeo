# app/main.py
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.database import engine, Base

# Asegurar que el directorio raíz esté en el path para las importaciones
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Auto-migración preventiva de columnas faltantes
try:
    with engine.begin() as conn:
        for col_def, table in [
            ("ALTER TABLE ventana ADD turno VARCHAR(50) NULL", "ventana"),
            ("ALTER TABLE ventanas_final ADD turno VARCHAR(50) NULL", "ventanas_final"),
            ("ALTER TABLE ventanas_final ADD campania INT NULL", "ventanas_final")
        ]:
            try:
                conn.execute(text(col_dir))
            except Exception:
                pass
except Exception as e:
    print(f"[*] Comprobación de migración de base de datos finalizada: {e}")

app = FastAPI(
    title="Geomechanical Window Mapping API",
    description="Backend modularizado y optimizado para el mapeo de ventanas geomecánicas",
    version="2.0"
)

# Configuración física de directorios de subida
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
uploads_dir = os.path.join(BASE_DIR, "uploads")
os.makedirs(uploads_dir, exist_ok=True)
os.makedirs(os.path.join(uploads_dir, "history"), exist_ok=True)

app.mount("/api/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Middleware de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Importación e inyección de routers modulares
from app.routers import ventanas, plt, auditoria

app.include_router(ventanas.router, prefix="/api", tags=["Ventanas"])
app.include_router(plt.router, prefix="/api", tags=["Ensayos PLT"])
app.include_router(auditoria.router, prefix="/api", tags=["Auditoría Geotécnica Masiva"])

@app.get("/")
def read_root():
    return {"status": "online", "service": "Geomechanical Mapping Engine API"}