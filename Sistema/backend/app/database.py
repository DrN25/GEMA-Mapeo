import os
import urllib.parse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

def load_dotenv():
    for path in [".env", "../.env", "app/.env"]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        parts = line.split("=", 1)
                        if len(parts) == 2:
                            key, val = parts[0].strip(), parts[1].strip()
                            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                                val = val[1:-1]
                            if key not in os.environ:
                                os.environ[key] = val
            break

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

engine = None
connect_args = {}

# 1. Probar DATABASE_URL primero si está configurado
if DATABASE_URL:
    try:
        if "sqlite" in DATABASE_URL:
            connect_args = {"check_same_thread": False}
        engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
        # Verificar conexión
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"Conexión exitosa usando DATABASE_URL.")
    except Exception as e:
        print(f"Error al conectar usando DATABASE_URL: {e}")
        engine = None

# 2. Si no hay DATABASE_URL o falló, intentar conexión por defecto con SQL Server (SQLEXPRESS)
if not engine:
    db_server = os.environ.get("DB_SERVER", "localhost\\SQLEXPRESS")
    db_name = os.environ.get("DB_NAME", "ventanas")
    db_trusted = os.environ.get("DB_TRUSTED", "yes").lower() == "yes"
    db_user = os.environ.get("DB_USER", "")
    db_password = os.environ.get("DB_PASSWORD", "")
    
    # Probar primero con drivers modernos para evitar el error de precisión SQLBindParameter
    drivers_to_try = [
        "ODBC Driver 17 for SQL Server",
        "ODBC Driver 18 for SQL Server",
        os.environ.get("DB_DRIVER", "SQL Server")
    ]
    
    for driver in drivers_to_try:
        try:
            if db_trusted:
                conn_str = f"DRIVER={{{driver}}};SERVER={db_server};DATABASE={db_name};Trusted_Connection=yes;"
            else:
                conn_str = f"DRIVER={{{driver}}};SERVER={db_server};DATABASE={db_name};UID={db_user};PWD={db_password};"
            
            # En el Driver 18 es necesario confiar en el certificado de servidor auto-firmado
            if "Driver 18" in driver:
                conn_str += "TrustServerCertificate=yes;"
                
            params = urllib.parse.quote_plus(conn_str)
            url = f"mssql+pyodbc:///?odbc_connect={params}"
            
            temp_engine = create_engine(url, pool_pre_ping=True)
            # Validar con consulta simple, parámetros vinculados y reflexión de metadatos (para detectar error de driver en SQLBindParameter)
            with temp_engine.connect() as conn:
                conn.execute(text("SELECT 1 WHERE :x = :y"), {"x": "test", "y": "test"})
                from sqlalchemy import inspect
                inspector = inspect(temp_engine)
                inspector.has_table("ventana")
            
            engine = temp_engine
            DATABASE_URL = url
            print(f"Conexión exitosa a SQL Server '{db_server}', BD '{db_name}' usando driver: '{driver}'.")
            break
        except Exception as e:
            print(f"No se pudo establecer conexión a SQL Server con el driver '{driver}' o falló la verificación de metadatos: {e}")

# 3. Si todo lo anterior falla, caer en SQLite local por defecto
if not engine:
    sqlite_path = os.path.join(os.path.dirname(__file__), "ventanas.db")
    DATABASE_URL = f"sqlite:///{sqlite_path}"
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
    print(f"ADVERTENCIA: Fallaron las conexiones a SQL Server. Cayendo en base de datos SQLite local: '{sqlite_path}'")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
