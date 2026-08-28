# app/main.py
import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from app.database import engine

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = FastAPI(
    title="Geomechanical Window Mapping API",
    description="Backend alineado a base GEMA (SQL Server) con persistencia directa en [plt].[EnsayoPLT]",
    version="3.2"
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
uploads_dir = os.path.join(BASE_DIR, "uploads")
os.makedirs(uploads_dir, exist_ok=True)
os.makedirs(os.path.join(uploads_dir, "history"), exist_ok=True)

app.mount("/api/uploads", StaticFiles(directory=uploads_dir), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers.ventanas import router as ventanas_router
from app.routers.plt import router as plt_router
from app.routers.auditoria import router as auditoria_router
from app.routers.auditoria_plt import router as auditoria_plt_router
from app.routers.comparativo import router as comparativo_router
from app.routers.catalogs import router as catalogs_router
from app.routers.congruencia import router as congruencia_router
from app.routers.importador import router as importador_router
from app.auth.router import router as auth_router
from app.routers.admin import router as admin_router
from app.agents.router import router as scan_router

app.include_router(auth_router, prefix="/api/auth", tags=["Autenticación"])
app.include_router(admin_router, prefix="/api/admin", tags=["Administración de Usuarios"])
app.include_router(ventanas_router, prefix="/api", tags=["Ventanas"])
app.include_router(plt_router, prefix="/api", tags=["Ensayos PLT"])
app.include_router(auditoria_plt_router, prefix="/api", tags=["Auditoría QAQC Ensayos PLT"])
app.include_router(auditoria_router, prefix="/api", tags=["Auditoría Geotécnica Masiva"])
app.include_router(comparativo_router, prefix="/api", tags=["Comparación de Auditorías"])
app.include_router(catalogs_router, prefix="/api", tags=["Catálogos"])
app.include_router(congruencia_router, prefix="/api", tags=["Congruencia Geomecánica"])
app.include_router(importador_router, prefix="/api", tags=["Importador de Excel"])
app.include_router(scan_router, prefix="/api", tags=["Agente de Escaneo IA"])

@app.get("/")
def read_root():
    return {"status": "online", "service": "Geomechanical Mapping Engine API", "bd": "GEMA + SQLite PLT"}

@app.get("/api/health")
def health_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "online", "bd": "ok"}
    except Exception:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")