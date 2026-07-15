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

# Auto-migración preventiva de columnas faltantes corregida (sin typos de variables locales)
try:
    with engine.begin() as conn:
        for col_def in [
            "ALTER TABLE ventana ADD turno VARCHAR(50) NULL",
            "ALTER TABLE ventanas_final ADD turno VARCHAR(50) NULL",
            "ALTER TABLE ventanas_final ADD campania INT NULL",
            "ALTER TABLE ensayo_plt_irregular ADD tipo_ensayo VARCHAR(50) NULL"
        ]:
            try:
                conn.execute(text(col_def))
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

# IMPORTACIÓN DIRECTA Y EXPLÍCITA POR SUBMÓDULOS (Evita conflictos de __init__.py)
from app.routers.ventanas import router as ventanas_router
from app.routers.plt import router as plt_router
from app.routers.auditoria import router as auditoria_router
from app.routers.comparativo import router as comparativo_router
from app.routers.catalogs import router as catalogs_router

app.include_router(ventanas_router, prefix="/api", tags=["Ventanas"])
app.include_router(plt_router, prefix="/api", tags=["Ensayos PLT"])
app.include_router(auditoria_router, prefix="/api", tags=["Auditoría Geotécnica Masiva"])
app.include_router(comparativo_router, prefix="/api", tags=["Comparación de Auditorías"])
app.include_router(catalogs_router, prefix="/api", tags=["Catálogos"])

@app.get("/")
def read_root():
    return {"status": "online", "service": "Geomechanical Mapping Engine API"}