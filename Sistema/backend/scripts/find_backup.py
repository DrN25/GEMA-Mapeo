import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import text
from app.database import engine

with engine.connect() as conn:
    print("== Tablas de respaldo (BKP) ==")
    rows = conn.execute(text("""
        SELECT TABLE_SCHEMA, TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME LIKE '%BKP%'
        ORDER BY TABLE_SCHEMA, TABLE_NAME
    """)).fetchall()
    for r in rows:
        print(f"  {r.TABLE_SCHEMA}.{r.TABLE_NAME}")
    if not rows:
        print("  (ninguna)")

    print("== ¿Alguna tabla con datos de ventanas TEST-*? ==")
    ventanas_rows = conn.execute(text("""
        SELECT TABLE_SCHEMA, TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME LIKE '%Ventanas%' OR TABLE_NAME LIKE '%Estructuras%' OR TABLE_NAME LIKE '%EnsayoPLT%'
        ORDER BY TABLE_SCHEMA, TABLE_NAME
    """)).fetchall()
    for r in ventanas_rows:
        try:
            n = conn.execute(text(f'SELECT COUNT(*) FROM [{r.TABLE_SCHEMA}].[{r.TABLE_NAME}] WHERE CodigoCelda LIKE :p' if 'Ventanas' in r.TABLE_NAME or 'Estructuras' in r.TABLE_NAME else 'SELECT 1')).scalar() if False else None
        except Exception:
            pass
        print(f"  {r.TABLE_SCHEMA}.{r.TABLE_NAME}")
