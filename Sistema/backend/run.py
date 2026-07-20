import os
import uvicorn

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

if __name__ == "__main__":
    load_dotenv()

    # Validar conexión al arranque (sin migraciones agresivas — GEMA ya tiene su esquema)
    try:
        from app.database import engine
        from sqlalchemy import text, inspect
        print("Verificando conexión a GEMA (SQL Server)...")
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            inspector = inspect(engine)
            if inspector.has_table("VentanasMapeo", schema="mapeo"):
                print("✓ Tabla mapeo.VentanasMapeo accesible.")
            else:
                print("⚠ ADVERTENCIA: Tabla mapeo.VentanasMapeo no encontrada. Verifica que GEMA.sql y migracion_gema.sql hayan sido ejecutados.")
        print("Conexión verificada con éxito.")
    except Exception as e:
        print(f"Error al conectar con GEMA: {e}")
        print("El servidor intentará continuar...")

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)