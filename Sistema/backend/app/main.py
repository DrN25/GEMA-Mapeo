# app/main.py
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Crear tablas PLT en SQLite local al arrancar
from app.plt_database import engine as plt_engine, Base as PltBase
from app.plt_models import EnsayoPLTIrregular
PltBase.metadata.create_all(bind=plt_engine)
print("Tabla PLT creada/verificada en SQLite local (plt.db)")

app = FastAPI(
    title="Geomechanical Window Mapping API",
    description="Backend alineado a base GEMA (SQL Server) + PLT local (SQLite)",
    version="3.1"
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
from app.routers.comparativo import router as comparativo_router
from app.routers.catalogs import router as catalogs_router
from app.routers.congruencia import router as congruencia_router

app.include_router(ventanas_router, prefix="/api", tags=["Ventanas"])
app.include_router(plt_router, prefix="/api", tags=["Ensayos PLT"])
app.include_router(auditoria_router, prefix="/api", tags=["Auditoría Geotécnica Masiva"])
app.include_router(comparativo_router, prefix="/api", tags=["Comparación de Auditorías"])
app.include_router(catalogs_router, prefix="/api", tags=["Catálogos"])
app.include_router(congruencia_router, prefix="/api", tags=["Congruencia Geomecánica"])

@app.get("/")
def read_root():
    return {"status": "online", "service": "Geomechanical Mapping Engine API", "bd": "GEMA + SQLite PLT"}