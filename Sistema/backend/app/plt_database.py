"""
plt_database.py — Conexión SQLite exclusiva para Ensayos PLT.
Independiente de GEMA. Almacena datos localmente en plt.db
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Ruta de la BD SQLite dentro de app/
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PLT_DB_PATH = os.path.join(BASE_DIR, "plt.db")

engine = create_engine(
    f"sqlite:///{PLT_DB_PATH}",
    connect_args={"check_same_thread": False},
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_plt_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()