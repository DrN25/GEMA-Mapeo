from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import date, datetime
import io
import openpyxl
import math
import os
import shutil
import json
from fastapi.staticfiles import StaticFiles

import sys
from fastapi import BackgroundTasks

from app.database import get_db, Base, engine
from app import models, schemas, calculator
from sqlalchemy import text


# Agregar el directorio raíz al path para poder importar tu validador_geomecanico.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from validador_geomecanico import validate_bulk_excel
except ImportError:
    # Fallback preventivo si se ejecuta desde otro contexto de directorios
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from validador_geomecanico import validate_bulk_excel

# Caches globales en memoria para respuestas instantáneas (< 10ms) al frontend
DIAGNOSTIC_CACHE = None
COMPACT_CACHE = None

# Auto-migrate database tables to add missing columns on startup
try:
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE ventana ADD turno VARCHAR(50) NULL"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE ventanas_final ADD turno VARCHAR(50) NULL"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE ventanas_final ADD campania INT NULL"))
        except Exception:
            pass
except Exception as e:
    print(f"Error checking/adding database columns: {e}")

app = FastAPI(title="Geomechanical Window Mapping API", version="1.0")

# Crear carpeta de uploads física si no existe
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
uploads_dir = os.path.join(BASE_DIR, "uploads")
os.makedirs(uploads_dir, exist_ok=True)

# Servir estáticos de forma pública desde /uploads
app.mount("/api/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HELPER: Sync data to flat table ventanas_final
def sync_to_ventanas_final(db: Session, ventana_id: int):
    # Load normalized entities
    v = db.query(models.Ventana).filter_by(ventana_id=ventana_id).first()
    if not v:
        return
    
    # Run geomechanical calculations
    rows_data = []
    for d in v.discontinuidades:
        rows_data.append({
            "fam": d.familia_id,
            "dist": float(d.distancia_m) if d.distancia_m is not None else None,
            "tipo": d.tipo_estructura,
            "dip": float(d.dip),
            "dipdir": float(d.dip_dir),
            "aber": float(d.abertura_mm) if d.abertura_mm is not None else None,
            "esp": float(d.espesor_mm) if d.espesor_mm is not None else None,
            "cont": float(d.continuidad_m) if d.continuidad_m is not None else None,
            "espac": float(d.espaciamiento_m),
            "nstr": float(d.n_estructuras) if d.n_estructuras is not None else None,
            "next": d.n_extremos_visibles,
            "term": d.terminacion,
            "r1": d.relleno_1_codigo,
            "r2": d.relleno_2_codigo,
            "jrc": d.jrc,
            "rug": d.rugosidad_codigo,
            "forma": d.forma_estructura,
            "alt": d.alteracion_codigo
        })
        
    rmr_data = {
        "agua_codigo": v.rmr_input.agua_codigo if v.rmr_input else "C",
        "resistencia_codigo": v.rmr_input.resistencia_codigo if v.rmr_input else "R4",
        "gsi_estructura": v.rmr_input.gsi_estructura if v.rmr_input else "VB",
        "gsi_superficie": v.rmr_input.gsi_superficie if v.rmr_input else "G",
        "gsi_visual": v.rmr_input.gsi_visual if v.rmr_input else 50,
        "control_estructural": v.rmr_input.control_estructural if v.rmr_input else 4,
        "efectos_voladura": v.rmr_input.efectos_voladura if v.rmr_input else 3,
        "ucs_mpa": float(v.rmr_input.ucs_mpa) if (v.rmr_input and v.rmr_input.ucs_mpa is not None) else 74.0,
        "is50_mpa": float(v.rmr_input.is50_mpa) if (v.rmr_input and v.rmr_input.is50_mpa is not None) else 5.0,
        "comentario": v.rmr_input.comentario if v.rmr_input else ""
    }
    
    # Asegurar redondeo estricto a entero de largo_m
    largo_entero = int(round(float(v.largo_m))) if v.largo_m is not None else None

    header_data = {
        "este_ini": v.este_ini,
        "norte_ini": v.norte_ini,
        "cota_ini": v.cota_ini,
        "este_fin": v.este_fin,
        "norte_fin": v.norte_fin,
        "cota_fin": v.cota_fin,
        "largo_m": largo_entero
    }
    
    res = calculator.calculate_geomechanics(header_data, rows_data, rmr_data)
    
    # Delete existing rows in ventanas_final for this celda
    db.query(models.VentanasFinal).filter_by(celda=v.codigo).delete()
    db.flush()
    
    # Query current max id to manually assign
    max_id = db.execute(text("SELECT MAX(id) FROM ventanas_final")).scalar()
    next_id = (max_id or 0) + 1
    
    # Insert flat rows
    for r_idx, r_calc in enumerate(res["rows"]):
        row_norm = r_calc["row"]
        
        # nstr guardado como None si es -1
        final_nstr = int(row_norm["nstr"]) if (row_norm["nstr"] is not None and row_norm["nstr"] != -1) else None

        final_row = models.VentanasFinal(
            id=next_id,
            celda=v.codigo,
            este_from=float(v.este_ini),
            norte_from=float(v.norte_ini),
            cota_from=float(v.cota_ini),
            este_to=float(v.este_fin),
            norte_to=float(v.norte_fin),
            cota_to=float(v.cota_fin),
            dist_celda=largo_entero,
            altura=float(v.altura_m) if v.altura_m is not None else None,
            dip=float(v.dip_hw) if v.dip_hw is not None else (r_calc["alfa"] * 180 / math.pi if r_calc["alfa"] else None),  
            az_hole=float(v.az_hw) if v.az_hw is not None else (r_calc["teta"] * 180 / math.pi if r_calc["teta"] else None),
            dip_talud=float(v.dip_talud),
            dip_dir_talud=float(v.dipdir_talud) if v.dipdir_talud is not None else (float(v.dip_talud) + 90) % 360,
            intemperismo=v.intemperismo_codigo,
            cond_agua_76=v.rmr_input.agua_codigo if v.rmr_input else "C",
            cond_agua_valor_76=res["agua_r76"],
            dureza_76=v.rmr_input.resistencia_codigo if v.rmr_input else "R4",
            resistencia_est_valor_76=res["resist_r76"],
            gsi_visual_76=v.rmr_input.gsi_visual if v.rmr_input else 50,
            control_estructural_76=v.rmr_input.control_estructural if v.rmr_input else 4,
            efectos_voladura_76=v.rmr_input.efectos_voladura if v.rmr_input else 3,
            rqd_valor_76=res["rqd_r76"],
            rqd_76=res["rqd_pct"],
            freq_fractura_m_76=res["jv"],
            tam_bloques_m3_76=res["espac_prom"]**3 if res["espac_prom"] else None,
            espaciamiento_prom_76=res["espac_prom"],
            espaciamiento_valor_76=res["spacing_r76"],
            cond_discontinuidad_valor_76=res["condisc_r76"],
            rmr_76=res["rmr_76"],
            ucs_mpa=float(v.rmr_input.ucs_mpa) if v.rmr_input else None,
            is50_mpa=float(v.rmr_input.is50_mpa) if v.rmr_input else None,
            cond_agua_89=v.rmr_input.agua_codigo if v.rmr_input else "C",
            cond_agua_valor_89=res["agua_r89"],
            dureza_89=v.rmr_input.resistencia_codigo if v.rmr_input else "R4",
            resistencia_est_valor_89=res["resist_r89"],
            gsi_visual_89=v.rmr_input.gsi_visual if v.rmr_input else 50,
            control_estructural_89=v.rmr_input.control_estructural if v.rmr_input else 4,
            efecto_voladura_89=v.rmr_input.efectos_voladura if v.rmr_input else 3,
            rqd_valor_89=res["rqd_r89"],
            rqd_89=res["rqd_pct"],
            freq_fractura_m_89=res["jv"],
            tam_bloques_m3_89=res["espac_prom"]**3 if res["espac_prom"] else None,
            espaciamiento_prom_89=res["espac_prom"],
            espaciamiento_valor_89=res["spacing_r89"],
            cond_discontinuidad_valor_89=res["condisc_r89"],
            rmr_89=res["rmr_89"],
            fecha=datetime.combine(v.fecha_mapeo, datetime.min.time()) if v.fecha_mapeo else None,
            comentario=v.rmr_input.comentario if v.rmr_input else "",
            dist_estructura=row_norm["dist"],
            angulo_estruct_teta=r_calc["teta"],
            angulo_estruct_alfa=r_calc["alfa"],
            estruct_x=r_calc["wx"],
            struct_y=r_calc["wy"],
            struct_z=r_calc["wz"],
            tipo_estructura=row_norm["tipo"],
            dip_estructura=row_norm["dip"],
            dip_dir_estructura=row_norm["dipdir"],
            num_estructuras=final_nstr,
            abertura_mm=row_norm["aber"] if row_norm["aber"] is not None else 0.0,
            espesor_mm=row_norm["esp"] if row_norm["esp"] is not None else 0.0,
            continuidad_m=row_norm["cont"] if row_norm["cont"] is not None else 0.0,
            espaciamiento_m=row_norm["espac"],
            num_extremos_visibles=row_norm["next"],
            tipo_relleno_1=row_norm["r1"] if row_norm["r1"] else "cwf",
            tipo_relleno_2=row_norm["r2"] if row_norm["r2"] else "-1",
            jrc=row_norm["jrc"],
            rugosidad_estructuras=row_norm["rug"] if row_norm["rug"] is not None else 1,
            forma_estructura=row_norm["forma"] if row_norm["forma"] else "P",
            alteracion=row_norm["alt"] if row_norm["alt"] else "f",
            geotecnico=v.mapeador,
            nivel=v.nivel,
            lito_1=v.lito_1,
            lito_2=v.lito_2,
            lito_3=v.lito_3,
            unidad_litologica=v.unidad_litologica,
            sector_geotecnico=v.sector_geotecnico if v.sector_geotecnico else "E1",
            campania=v.campania if v.campania is not None else 2026,
            turno=v.turno
        )
        db.add(final_row)
        next_id += 1
    db.flush()

# API ENDPOINTS

@app.get("/api/ventanas", response_model=List[schemas.VentanaSummarySchema])
def get_ventanas(db: Session = Depends(get_db)):
    ventanas = db.query(models.Ventana).all()
    res = []
    for v in ventanas:
        res.append(schemas.VentanaSummarySchema(
            codigo=v.codigo,
            fecha_mapeo=v.fecha_mapeo,
            mapeador=v.mapeador,
            lito_1=v.lito_1,
            discontinuidades_count=len(v.discontinuidades),
            creado_en=v.creado_en
        ))
    return res

@app.get("/api/ventanas/{codigo}", response_model=schemas.VentanaSaveSchema, response_model_by_alias=False)
def get_ventana(codigo: str, db: Session = Depends(get_db)):
    v = db.query(models.Ventana).filter_by(codigo=codigo.strip().upper()).first()
    if not v:
        raise HTTPException(status_code=404, detail="Ventana no encontrada")
    
    # Construct schema
    discs = []
    for d in v.discontinuidades:
        discs.append(schemas.DiscontinuidadBase(
            familia_id=d.familia_id,
            distancia_m=float(d.distancia_m) if d.distancia_m is not None else None,
            tipo_estructura=d.tipo_estructura,
            dip=float(d.dip),
            dip_dir=float(d.dip_dir),
            abertura_mm=float(d.abertura_mm) if d.abertura_mm is not None else None,
            espesor_mm=float(d.espesor_mm) if d.espesor_mm is not None else None,
            continuidad_m=float(d.continuidad_m) if d.continuidad_m is not None else None,
            espaciamiento_m=float(d.espaciamiento_m),
            n_estructuras=float(d.n_estructuras) if d.n_estructuras is not None else -1.0, # Retornar -1.0 si es NULL
            n_extremos_visibles=d.n_extremos_visibles,
            terminacion=d.terminacion,
            relleno_1_codigo=d.relleno_1_codigo,
            relleno_2_codigo=d.relleno_2_codigo,
            jrc=d.jrc,
            rugosidad_codigo=d.rugosidad_codigo,
            forma_estructura=d.forma_estructura,
            alteracion_codigo=d.alteracion_codigo
        ))
        
    rmr = None
    if v.rmr_input:
        rmr = schemas.VentanaRmrInputBase(
            agua_codigo=v.rmr_input.agua_codigo,
            resistencia_codigo=v.rmr_input.resistencia_codigo,
            gsi_estructura=v.rmr_input.gsi_estructura,
            gsi_superficie=v.rmr_input.gsi_superficie,
            gsi_visual=v.rmr_input.gsi_visual,
            control_estructural=v.rmr_input.control_estructural,
            efectos_voladura=v.rmr_input.efectos_voladura,
            ucs_mpa=float(v.rmr_input.ucs_mpa) if v.rmr_input.ucs_mpa is not None else None,
            is50_mpa=float(v.rmr_input.is50_mpa) if v.rmr_input.is50_mpa is not None else None,
            comentario=v.rmr_input.comentario
        )
        
    return schemas.VentanaSaveSchema(
        codigo=v.codigo,
        fecha_mapeo=v.fecha_mapeo,
        mapeador=v.mapeador,
        campania=v.campania,
        este_ini=float(v.este_ini),
        norte_ini=float(v.norte_ini),
        cota_ini=float(v.cota_ini),
        este_fin=float(v.este_fin),
        norte_fin=float(v.norte_fin),
        cota_fin=float(v.cota_fin),
        largo_m=int(round(float(v.largo_m))) if v.largo_m is not None else None, # Retornar como entero
        altura_m=float(v.altura_m) if v.altura_m is not None else None,
        dip_talud=float(v.dip_talud),
        dipdir_talud=float(v.dipdir_talud) if v.dipdir_talud is not None else None,
        dip_hw=float(v.dip_hw) if v.dip_hw is not None else None,
        az_hw=float(v.az_hw) if v.az_hw is not None else None,
        alteracion_codigo=v.alteracion_codigo,
        intemperismo_codigo=v.intemperismo_codigo,
        lito_1=v.lito_1,
        lito_2=v.lito_2,
        lito_3=v.lito_3,
        unidad_litologica=v.unidad_litologica,
        sector=v.sector,
        fase=v.fase,
        nivel=v.nivel,
        sector_geotecnico=v.sector_geotecnico,
        turno=v.turno,
        discontinuidades=discs,
        rmr_input=rmr
    )

@app.post("/api/ventanas")
def save_ventana(data: schemas.VentanaSaveSchema, db: Session = Depends(get_db)):
    code_up = data.codigo.strip().upper()
    v = db.query(models.Ventana).filter_by(codigo=code_up).first()

    def clean_null_val(val):
        if val == -1 or val == -1.0 or val == "-1" or val == "":
            return None
        return val
    
    if v:
        # Update header details
        v.fecha_mapeo = data.fecha_mapeo
        v.mapeador = data.mapeador
        v.campania = data.campania
        v.este_ini = data.este_ini
        v.norte_ini = data.norte_ini
        v.cota_ini = data.cota_ini
        v.este_fin = data.este_fin
        v.norte_fin = data.norte_fin
        v.cota_fin = data.cota_fin
        if "sqlite" in str(db.bind.url).lower():
            v.largo_m = data.largo_m
        v.altura_m = data.altura_m
        v.dip_talud = data.dip_talud
        v.dipdir_talud = data.dipdir_talud
        v.dip_hw = data.dip_hw
        v.az_hw = data.az_hw
        v.alteracion_codigo = data.alteracion_codigo
        v.intemperismo_codigo = data.intemperismo_codigo
        v.lito_1 = data.lito_1
        v.lito_2 = data.lito_2
        v.lito_3 = data.lito_3
        v.unidad_litologica = data.unidad_litologica
        v.sector = data.sector
        v.fase = data.fase
        v.nivel = data.nivel
        v.sector_geotecnico = data.sector_geotecnico
        v.turno = data.turno
        
        # Delete old dependent children
        db.query(models.Discontinuidad).filter_by(ventana_id=v.ventana_id).delete()
        if v.rmr_input:
            db.delete(v.rmr_input)
    else:
        # Create new Ventana
        v = models.Ventana(
            codigo=code_up,
            fecha_mapeo=data.fecha_mapeo,
            mapeador=data.mapeador,
            campania=data.campania,
            este_ini=data.este_ini,
            norte_ini=data.norte_ini,
            cota_ini=data.cota_ini,
            este_fin=data.este_fin,
            norte_fin=data.norte_fin,
            cota_fin=data.cota_fin,
            altura_m=data.altura_m,
            dip_talud=data.dip_talud,
            dipdir_talud=data.dipdir_talud,
            dip_hw=data.dip_hw,
            az_hw=data.az_hw,
            alteracion_codigo=data.alteracion_codigo,
            intemperismo_codigo=data.intemperismo_codigo,
            lito_1=data.lito_1,
            lito_2=data.lito_2,
            lito_3=data.lito_3,
            unidad_litologica=data.unidad_litologica,
            sector=data.sector,
            fase=data.fase,
            nivel=data.nivel,
            sector_geotecnico=data.sector_geotecnico,
            turno=data.turno
        )
        if "sqlite" in str(db.bind.url).lower():
            v.largo_m = data.largo_m
        db.add(v)
        db.flush() # get ventana_id
        
    # Add discontinuidades
    for idx, d in enumerate(data.discontinuidades):
        disc = models.Discontinuidad(
            ventana_id=v.ventana_id,
            familia_id=d.fam,
            orden_en_familia=idx + 1,
            distancia_m=clean_null_val(d.dist),
            tipo_estructura=d.tipo,
            dip=clean_null_val(d.dip),
            dip_dir=clean_null_val(d.dipdir),
            abertura_mm=clean_null_val(d.aber),
            espesor_mm=clean_null_val(d.esp),
            continuidad_m=clean_null_val(d.cont),
            espaciamiento_m=clean_null_val(d.espac),
            n_estructuras=clean_null_val(d.nstr), # Guardar en SQL Server / SQLite de forma libre
            n_extremos_visibles=clean_null_val(d.next),
            terminacion=clean_null_val(d.term),
            relleno_1_codigo=d.r1 if d.r1 != "-1" else None,
            relleno_2_codigo=d.r2 if d.r2 != "-1" else None,
            jrc=clean_null_val(d.jrc),
            rugosidad_codigo=clean_null_val(d.rug),
            forma_estructura=d.forma if d.forma != "-1" else None,
            alteracion_codigo=d.alt if d.alt != "-1" else None
           )
        db.add(disc)

    db.flush()
        
    # Add rmr_input
    if data.rmr_input:
        ri = models.VentanaRmrInput(
            ventana_id=v.ventana_id,
            agua_codigo=data.rmr_input.agua_codigo,
            resistencia_codigo=data.rmr_input.resistencia_codigo,
            gsi_estructura=data.rmr_input.gsi_estructura,
            gsi_superficie=data.rmr_input.gsi_superficie,
            gsi_visual=data.rmr_input.gsi_visual,
            control_estructural=data.rmr_input.control_estructural,
            efectos_voladura=data.rmr_input.efectos_voladura,
            ucs_mpa=data.rmr_input.ucs_mpa,
            is50_mpa=data.rmr_input.is50_mpa,
            comentario=data.rmr_input.comentario
        )
        db.add(ri)
        
    db.flush()
    
    # Sync with ventanas_final flat table
    sync_to_ventanas_final(db, v.ventana_id)
    
    db.commit()
    return {"status": "success", "message": f"Ventana {code_up} guardada y sincronizada correctamente"}

@app.delete("/api/ventanas/{codigo}")
def delete_ventana(codigo: str, db: Session = Depends(get_db)):
    code_up = codigo.strip().upper()
    v = db.query(models.Ventana).filter_by(codigo=code_up).first()
    if not v:
        raise HTTPException(status_code=404, detail="Ventana no encontrada")
    
    # Cascades will automatically clean up discontinuidad and rmr_input
    db.delete(v)
    
    # Delete flat rows too
    db.query(models.VentanasFinal).filter_by(celda=code_up).delete()
    
    db.commit()
    return {"status": "success", "message": f"Ventana {code_up} eliminada correctamente de la base de datos"}

@app.post("/api/calculate")
def run_calculate(data: Dict[str, Any]):
    header = data.get("header", {})
    discs = data.get("discontinuidades", [])
    rmr_input = data.get("rmr_input", {})
    
    res = calculator.calculate_geomechanics(header, discs, rmr_input)
    return res

LITHOLOGY_CLASSIFICATION_DB = [
    {"grupo": "INTRUSIVOS", "unidad": "MZB", "litologia": "MZB", "codigo": "MZB_EQ"},
    {"grupo": "INTRUSIVOS", "unidad": "MZB", "litologia": "MZB", "codigo": "MZB_P"},
    {"grupo": "INTRUSIVOS", "unidad": "MBF1", "litologia": "MBF", "codigo": "MBF1"},
    {"grupo": "INTRUSIVOS", "unidad": "MBF2", "litologia": "MBF", "codigo": "MBF2"},
    {"grupo": "INTRUSIVOS", "unidad": "MBF2", "litologia": "MBF", "codigo": "MBF_P"},
    {"grupo": "INTRUSIVOS", "unidad": "MZM", "litologia": "MZM", "codigo": "MZM_F"},
    {"grupo": "INTRUSIVOS", "unidad": "MZM", "litologia": "MZM", "codigo": "MZM_M"},
    {"grupo": "INTRUSIVOS", "unidad": "MZH", "litologia": "MZH", "codigo": "MZH_1"},
    {"grupo": "INTRUSIVOS", "unidad": "MZH", "litologia": "MZH", "codigo": "MZH_2"},
    {"grupo": "INTRUSIVOS", "unidad": "MZD", "litologia": "MZD", "codigo": "MZD"},
    {"grupo": "INTRUSIVOS", "unidad": "MZQ", "litologia": "MZQ", "codigo": "MZQ"},
    {"grupo": "INTRUSIVOS", "unidad": "AN", "litologia": "LAM", "codigo": "LAM"},
    {"grupo": "SEDIMENTARIOS", "unidad": "LMT", "litologia": "LMT", "codigo": "LMT_M"},
    {"grupo": "SEDIMENTARIOS", "unidad": "LMT", "litologia": "LMT", "codigo": "LMT_MG"},
    {"grupo": "SEDIMENTARIOS", "unidad": "LMT", "litologia": "LMT", "codigo": "LMT_S"},
    {"grupo": "SEDIMENTARIOS", "unidad": "LMT", "litologia": "LMT", "codigo": "LMT_C"},
    {"grupo": "SEDIMENTARIOS", "unidad": "LMT", "litologia": "LMT", "codigo": "LMT_U"},
    {"grupo": "SEDIMENTARIOS", "unidad": "SHL", "litologia": "HFL", "codigo": "SHL_MA"},
    {"grupo": "METAMORFICAS", "unidad": "LMT", "litologia": "GSK", "codigo": "Varios"},
    {"grupo": "METAMORFICAS", "unidad": "LMT", "litologia": "PSK", "codigo": "Varios"},
    {"grupo": "METAMORFICAS", "unidad": "LMT", "litologia": "MSK", "codigo": "Varios"},
    {"grupo": "METAMORFICAS", "unidad": "LMT", "litologia": "ESK", "codigo": "Varios"},
    {"grupo": "METAMORFICAS", "unidad": "LMT", "litologia": "MBC", "codigo": "Varios"},
    {"grupo": "METAMORFICAS", "unidad": "LMT", "litologia": "MBL", "codigo": "Varios"},
    {"grupo": "METAMORFICAS", "unidad": "SHL", "litologia": "HFL", "codigo": "-"},
    {"grupo": "METAMORFICAS", "unidad": "SND", "litologia": "QZT", "codigo": "-"},
    {"grupo": "BRECHAS", "unidad": "TBX", "litologia": "TBX", "codigo": "TBX"},
    {"grupo": "BRECHAS", "unidad": "HBX", "litologia": "HBX", "codigo": "HBX"},
    {"grupo": "BRECHAS", "unidad": "MBX / varios", "litologia": "MBX", "codigo": "MBX"},
    {"grupo": "ENDOSKARN", "unidad": "MZM", "litologia": "EPG", "codigo": "-"},
    {"grupo": "ENDOSKARN", "unidad": "MZM", "litologia": "EGT", "codigo": "-"}
]

def resolve_lithology(lito3_code: str) -> dict:
    """
    Sanea y busca el código de Litología 3 en el catálogo para autocompletar 
    las 4 variables consistentes en la base de datos de forma autocurativa.
    """
    code_clean = str(lito3_code or "").strip().upper().replace(" ", "").replace("-", "")
    
    match = None
    for item in LITHOLOGY_CLASSIFICATION_DB:
        item_code = item["codigo"].upper().replace(" ", "").replace("-", "")
        if item_code and item_code == code_clean:
            match = item
            break
            
    if not match:
        for item in LITHOLOGY_CLASSIFICATION_DB:
            if code_clean in item["codigo"].upper() or code_clean in item["litologia"].upper():
                match = item
                break

    if match:
        return {
            "lito_1": match["unidad"],
            "lito_2": match["litologia"],
            "lito_3": match["codigo"],
            "unidad_litologica": match["grupo"]
        }
    
    # Fallback por defecto si no se encuentra en el catálogo
    return {
        "lito_1": lito3_code,
        "lito_2": "",
        "lito_3": lito3_code,
        "unidad_litologica": "INTRUSIVOS"
    }

@app.post("/api/importar-excel")
async def importar_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    
    imported_count = 0
    
    # CASO 1: Pestaña "ventana" estructurada cada 30 filas
    if "ventana" in wb.sheetnames:
        ws = wb["ventana"]
        
        for start in range(3, ws.max_row, 30):
            celda_val = ws.cell(row=start+1, column=1).value
            if not celda_val:
                celda_val = ws.cell(row=start, column=51).value
            
            if not celda_val or not str(celda_val).strip():
                continue
                
            codigo = str(celda_val).strip().upper()
            
            fecha_val = ws.cell(row=start+1, column=37).value
            if isinstance(fecha_val, str):
                try:
                    fecha_mapeo = datetime.strptime(fecha_val[:10], "%Y-%m-%d").date()
                except:
                    fecha_mapeo = date.today()
            elif isinstance(fecha_val, datetime):
                fecha_mapeo = fecha_val.date()
            else:
                fecha_mapeo = date.today()
                
            def get_num(r, c):
                val = ws.cell(row=r, column=c).value
                if val is None:
                    return 0.0
                try:
                    return float(val)
                except:
                    return 0.0
            
            def get_str(r, c):
                val = ws.cell(row=r, column=c).value
                return str(val).strip() if val is not None else ""

            este_ini = round(get_num(start+2, 2), 4)      # <- 4 decimales
            norte_ini = round(get_num(start+2, 4), 3)     # <- 3 decimales
            cota_ini = round(get_num(start+2, 6), 2)
            este_fin = round(get_num(start+3, 2), 4)      # <- 4 decimales
            norte_fin = round(get_num(start+3, 4), 3)     # <- 3 decimales
            cota_fin = round(get_num(start+3, 6), 2)
            
            largo = int(round(get_num(start+2, 11)))
            altura = round(get_num(start+3, 11), 1)
            dip_talud = round(get_num(start+2, 14), 2)
            
            # Recuperamos Lito 3 (codigo) de Row 7 Col P (Lito-Model)
            lito_model = get_str(start+4, 16)
            
            mapeador = get_str(start+5, 16)
            sector = get_str(start+1, 20)
            fase = int(get_num(start+2, 21))
            nivel = round(get_num(start+3, 21), 2)
            sect_geot = get_str(start+4, 21)
            intemp = get_str(start+3, 16)
            
            agua_code = get_str(start+8, 36)
            res_code = get_str(start+8, 38)
            gsi_cond = get_str(start+8, 40)
            gsi_est = get_str(start+8, 41)
            gsi_vis = int(get_num(start+8, 42))
            ctrl = int(get_num(start+8, 43))
            vol = int(get_num(start+8, 44))
            ucs = get_num(start+8, 53)
            is50 = get_num(start+8, 54)
            comentario = get_str(start+18, 56)
            
            # Resolución dinámica en cascada de los 4 campos litológicos
            lito_details = resolve_lithology(lito_model)
            
            discs = []
            for r_idx in range(start+12, start+25):
                fam_val = ws.cell(row=r_idx, column=1).value
                if fam_val is None or str(fam_val).strip() == "":
                    continue
                try:
                    fam_id = int(fam_val)
                except:
                    continue
                
                raw_nstr = int(round(get_num(r_idx, 6)))
                nstr = raw_nstr if raw_nstr > 0 else -1

                discs.append(schemas.DiscontinuidadBase(
                    familia_id=fam_id,
                    distancia_m=int(round(get_num(r_idx, 2))),
                    tipo_estructura=get_str(r_idx, 3) if get_str(r_idx, 3) else "JN",
                    dip=round(get_num(r_idx, 4), 2),
                    dip_dir=round(get_num(r_idx, 5), 2),
                    n_estructuras=nstr,
                    abertura_mm=round(get_num(r_idx, 7), 1),
                    espesor_mm=round(get_num(r_idx, 8), 1),
                    continuidad_m=round(get_num(r_idx, 9), 2),
                    espaciamiento_m=round(get_num(r_idx, 10), 2),
                    n_extremos_visibles=min(2, max(0, int(get_num(r_idx, 11)))) if ws.cell(row=r_idx, column=11).value is not None else None,
                    terminacion=min(3, max(0, int(get_num(r_idx, 12)))) if ws.cell(row=r_idx, column=12).value is not None else None,
                    relleno_1_codigo=get_str(r_idx, 13),
                    relleno_2_codigo=get_str(r_idx, 14),
                    jrc=min(20, max(0, int(get_num(r_idx, 19)))) if ws.cell(row=r_idx, column=19).value is not None else None,
                    rugosidad_codigo=min(9, max(0, int(get_num(r_idx, 20)))) if ws.cell(row=r_idx, column=20).value is not None else None,
                    forma_estructura=get_str(r_idx, 21),
                    alteracion_codigo=get_str(r_idx, 22)
                ))
                
            ri_schema = schemas.VentanaRmrInputBase(
                agua_codigo=agua_code if agua_code else "C",
                resistencia_codigo=res_code if res_code else "R4",
                gsi_estructura=gsi_est if gsi_est else "VB",
                gsi_superficie=gsi_cond if gsi_cond else "G",
                gsi_visual=gsi_vis if gsi_vis else 50,
                control_estructural=ctrl if ctrl else 4,
                efectos_voladura=vol if vol else 3,
                ucs_mpa=ucs if ucs else 74.0,
                is50_mpa=is50 if is50 else 5.0,
                comentario=comentario
            )
            
            ventana_schema = schemas.VentanaSaveSchema(
                codigo=codigo,
                fecha_mapeo=fecha_mapeo,
                mapeador=mapeador if mapeador else "RD/RB",
                campania=2026,
                este_ini=este_ini,
                norte_ini=norte_ini,
                cota_ini=cota_ini,
                este_fin=este_fin,
                norte_fin=norte_fin,
                cota_fin=cota_fin,
                largo_m=largo,
                altura_m=altura,
                dip_talud=dip_talud,
                alteracion_codigo=intemp,
                intemperismo_codigo=intemp,
                lito_1=lito_details["lito_1"],
                lito_2=lito_details["lito_2"],
                lito_3=lito_details["lito_3"],
                unidad_litologica=lito_details["unidad_litologica"],
                sector=sector,
                fase=fase,
                nivel=nivel,
                sector_geotecnico=sect_geot,
                discontinuidades=discs,
                rmr_input=ri_schema
            )
            
            save_ventana(ventana_schema, db)
            imported_count += 1
            
    # CASO 2: Pestaña plana desnormalizada "BD"
    elif "BD" in wb.sheetnames:
        ws = wb["BD"]
        celda_groups = {}
        for r_idx in range(2, ws.max_row + 1):
            celda_val = ws.cell(row=r_idx, column=3).value or ws.cell(row=r_idx, column=4).value
            if not celda_val or str(celda_val).strip() == "":
                continue
            celda_code = str(celda_val).strip().upper()
            if celda_code not in celda_groups:
                celda_groups[celda_code] = []
            celda_groups[celda_code].append(r_idx)
            
        for celda_code, rows_indices in celda_groups.items():
            f_row = rows_indices[0]
            
            def get_num(r, c):
                val = ws.cell(row=r, column=c).value
                if val is None:
                    return 0.0
                try:
                    return float(val)
                except:
                    return 0.0
            
            def get_str(r, c):
                val = ws.cell(row=r, column=c).value
                return str(val).strip() if val is not None else ""
                
            este_from = round(get_num(f_row, 6), 4)       # <- 4 decimales
            norte_from = round(get_num(f_row, 7), 3)      # <- 3 decimales
            cota_from = round(get_num(f_row, 8), 2)
            este_to = round(get_num(f_row, 10), 4)        # <- 4 decimales
            norte_to = round(get_num(f_row, 11), 3)       # <- 3 decimales
            cota_to = round(get_num(f_row, 12), 2)
            dist_celda = int(round(get_num(f_row, 13)))
            altura = round(get_num(f_row, 14), 1)
            dip_talud = round(get_num(f_row, 20), 2)
            intemp = get_str(f_row, 23)
            
            agua_code = get_str(f_row, 43)
            res_code = get_str(f_row, 45)
            gsi_vis = int(get_num(f_row, 47))
            ctrl = int(get_num(f_row, 48))
            vol = int(get_num(f_row, 49))
            ucs = get_num(f_row, 40)
            is50 = get_num(f_row, 41)
            fecha_val = ws.cell(row=f_row, column=59).value
            if isinstance(fecha_val, str):
                try:
                    fecha_mapeo = datetime.strptime(fecha_val[:10], "%Y-%m-%d").date()
                except:
                    fecha_mapeo = date.today()
            elif isinstance(fecha_val, datetime):
                fecha_mapeo = fecha_val.date()
            else:
                fecha_mapeo = date.today()
                
            comentario = get_str(f_row, 61)
            geot = get_str(f_row, 85)
            nivel = round(get_num(f_row, 95), 2)
            
            # Leemos Lito 3 (LITO3_MODELO) de Col CK (Index 89)
            l1 = get_str(f_row, 89)
            
            # Resolución dinámica en cascada de los 4 campos litológicos
            lito_details = resolve_lithology(l1)
            
            discs = []
            for r_idx in rows_indices:
                fam_val = ws.cell(row=r_idx, column=1).value or 1
                
                raw_nstr = int(round(get_num(r_idx, 72)))
                nstr = raw_nstr if raw_nstr > 0 else -1

                discs.append(schemas.DiscontinuidadBase(
                    familia_id=int(fam_val),
                    distancia_m=int(round(get_num(r_idx, 63))),
                    tipo_estructura=get_str(r_idx, 69) if get_str(r_idx, 69) else "JN",
                    dip=round(get_num(r_idx, 70), 2),
                    dip_dir=round(get_num(r_idx, 71), 2),
                    n_estructuras=nstr,
                    abertura_mm=round(get_num(r_idx, 73), 1),
                    espesor_mm=round(get_num(r_idx, 74), 1),
                    continuidad_m=round(get_num(r_idx, 75), 2),
                    espaciamiento_m=round(get_num(r_idx, 76), 2),
                    n_extremos_visibles=min(2, max(0, int(get_num(r_idx, 77)))) if ws.cell(row=r_idx, column=77).value is not None else None,
                    terminacion=3,
                    relleno_1_codigo=get_str(r_idx, 78),
                    relleno_2_codigo=get_str(r_idx, 79),
                    jrc=min(20, max(0, int(get_num(r_idx, 80)))) if ws.cell(row=r_idx, column=80).value is not None else None,
                    rugosidad_codigo=min(9, max(0, int(get_num(r_idx, 81)))) if ws.cell(row=r_idx, column=81).value is not None else None,
                    forma_estructura=get_str(r_idx, 82),
                    alteracion_codigo=get_str(r_idx, 83)
                ))
                
            ri_schema = schemas.VentanaRmrInputBase(
                agua_codigo=agua_code if agua_code else "C",
                resistencia_codigo=res_code if res_code else "R4",
                gsi_estructura="VB",
                gsi_superficie="G",
                gsi_visual=gsi_vis if gsi_vis else 50,
                control_estructural=ctrl if ctrl else 4,
                efectos_voladura=vol if vol else 3,
                ucs_mpa=ucs if ucs else 74.0,
                is50_mpa=is50 if is50 else 5.0,
                comentario=comentario
            )
            
            ventana_schema = schemas.VentanaSaveSchema(
                codigo=celda_code,
                fecha_mapeo=fecha_mapeo,
                mapeador=geot if geot else "RD/RB",
                campania=2026,
                este_ini=este_from,
                norte_ini=norte_from,
                cota_ini=cota_from,
                este_fin=este_to,
                norte_fin=norte_to,
                cota_fin=cota_to,
                largo_m=dist_celda,
                altura_m=altura,
                dip_talud=dip_talud,
                alteracion_codigo=intemp,
                intemperismo_codigo=intemp,
                lito_1=lito_details["lito_1"],
                lito_2=lito_details["lito_2"],
                lito_3=lito_details["lito_3"],
                unidad_litologica=lito_details["unidad_litologica"],
                sector="E1",
                fase=5,
                nivel=nivel,
                sector_geotecnico="E1",
                discontinuidades=discs,
                rmr_input=ri_schema
            )
            
            save_ventana(ventana_schema, db)
            imported_count += 1
            
    return {"status": "success", "message": f"Importación completada. {imported_count} ventanas importadas con éxito."}

@app.get("/api/ventanas/{codigo}/exportar")
def exportar_ventana_excel(codigo: str, db: Session = Depends(get_db)):
    code_up = codigo.strip().upper()
    
    # Consultar todas las filas calculadas para esta celda
    rows = db.query(models.VentanasFinal).filter_by(celda=code_up).order_by(models.VentanasFinal.id).all()
    if not rows:
        raise HTTPException(
            status_code=404, 
            detail=f"No se encontraron datos calculados para la celda {code_up}. Por favor, guarde la celda primero para sincronizar."
        )
        
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Mapeo Ventana"
    
    # Encabezados de columna idénticos a la maqueta de referencia
    headers = [
        "id", "CELDA", "CELDA", "ESTE_FROM", "NORTE_FROM", "COTA", "ESTE_TO", "NORTE_TO", "COTA",
        "Dist.Celda", "Altura", "DIP", "AZ_HOLE",
        "DIP_TALUD", "DIP_DIR_TALUD", "INTEMPERISMO",
        "CONDICION DE AGUA '76", "CONDICION DE AGUA VALOR '76", "DUREZA '76", "RESISTENCIA ESTIMADA VALOR '76",
        "GSI VISUAL '76", "CONTROL ESTRUCTURAL '76", "EFECTOS DE VOLADURA '76", "RQD - VALOR '76", "RQD '76",
        "FRECUENCIA DE FRACTURAMIENTO x m '76", "TAMAÑO DE BLOQUES x m3 '76", "ESPACIAMIENTO PROMEDIO '76",
        "ESPACIAMIENTO - VALOR '76", "CONDICION DE DISCONTINUIDAD - VALOR '76", "RMR '76",
        "( UCS ) (Mpa)", "is50 (Mpa)",
        "CONDICION DE AGUA '89", "CONDICION DE AGUA VALOR '89", "DUREZA '89", "RESISTENCIA ESTIMADA VALOR '89",
        "GSI VISUAL '89", "CONTROL ESTRUCTURAL '89", "EFECTOS DE VOLADURA '89", "RQD - VALOR '89", "RQD '89",
        "FRECUENCIA DE FRACTURAMIENTO x m '89", "TAMAÑO DE BLOQUES x m3 '89", "ESPACIAMIENTO PROMEDIO '89",
        "ESPACIAMIENTO - VALOR '89", "CONDICION DE DISCONTINUIDAD - VALOR '89", "RMR '89",
        "FECHA", "COMENTARIO",
        "Dist. de estr.", "teta", "alfa", "x", "y", "z",
        "TIPO DE ESTRUCT", "DIP", "DIP DIR", "NUMERO DE ESTRUCTURAS", "ABERTURA mm", "ESPESOR mm",
        "CONTINUIDAD m", "ESPACIAMIENTO m", "NUMERO DE EXTREMOS VISIBLES", "TIPO DE RELLENO 1", "TIPO DE RELLENO 2",
        "JRC", "RUGOSIDAD", "FORMA DE ESTRUCTURA", "ALTERACION", "GEOTECNICO", "Is50_Mpa", "LITO3_MODELO", "Sector", "Nivel"
    ]
    
    ws.append(headers)
    
    # Escribir los registros desnormalizados en el mismo orden
    for r in rows:
        row_data = [
            r.id,
            r.celda,
            r.celda,  # Duplicado según formato requerido
            float(r.este_from) if r.este_from is not None else 0.0,
            float(r.norte_from) if r.norte_from is not None else 0.0,
            float(r.cota_from) if r.cota_from is not None else 0.0,
            float(r.este_to) if r.este_to is not None else 0.0,
            float(r.norte_to) if r.norte_to is not None else 0.0,
            float(r.cota_to) if r.cota_to is not None else 0.0,
            r.dist_celda,
            float(r.altura) if r.altura is not None else None,
            float(r.dip) if r.dip is not None else None,
            float(r.az_hole) if r.az_hole is not None else None,
            float(r.dip_talud) if r.dip_talud is not None else None,
            float(r.dip_dir_talud) if r.dip_dir_talud is not None else None,
            r.intemperismo,
            r.cond_agua_76,
            r.cond_agua_valor_76,
            r.dureza_76,
            r.resistencia_est_valor_76,
            r.gsi_visual_76,
            r.control_estructural_76,
            r.efectos_voladura_76,
            r.rqd_valor_76,
            r.rqd_76,
            r.freq_fractura_m_76,
            r.tam_bloques_m3_76,
            r.espaciamiento_prom_76,
            r.espaciamiento_valor_76,
            r.cond_discontinuidad_valor_76,
            r.rmr_76,
            r.ucs_mpa,
            r.is50_mpa,
            r.cond_agua_89,
            r.cond_agua_valor_89,
            r.dureza_89,
            r.resistencia_est_valor_89,
            r.gsi_visual_89,
            r.control_estructural_89,
            r.efecto_voladura_89,
            r.rqd_valor_89,
            r.rqd_89,
            r.freq_fractura_m_89,
            r.tam_bloques_m3_89,
            r.espaciamiento_prom_89,
            r.espaciamiento_valor_89,
            r.cond_discontinuidad_valor_89,
            r.rmr_89,
            r.fecha.strftime("%Y-%m-%d") if r.fecha else "",
            r.comentario,
            r.dist_estructura,
            r.angulo_estruct_teta,
            r.angulo_estruct_alfa,
            r.estruct_x,
            r.struct_y,
            r.struct_z,
            r.tipo_estructura,
            r.dip_estructura,
            r.dip_dir_estructura,
            r.num_estructuras,
            r.abertura_mm,
            r.espesor_mm,
            r.continuidad_m,
            r.espaciamiento_m,
            r.num_extremos_visibles,
            r.tipo_relleno_1,
            r.tipo_relleno_2,
            r.jrc,
            r.rugosidad_estructuras,
            r.forma_estructura,
            r.alteracion,
            r.geotecnico,
            r.is50_mpa, # Duplicada en maqueta
            r.lito_3,
            r.sector_geotecnico,
            r.nivel
        ]
        ws.append(row_data)

    # --- ESTILIZACIÓN PREMIUM DE COLUMNAS SEGÚN MAQUETA ---
    # Fills en formato pastel elegante para no fatigar la lectura de datos
    fill_red = PatternFill(start_color="F2DCDB", end_color="F2DCDB", fill_type="solid")     # Rojo suave (A-I)
    fill_blue = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")    # Azul suave (J-M)
    fill_yellow = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")  # Amarillo suave (N-AE)
    fill_peach = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")   # Durazno/Salmón (AF-AG)
    fill_green = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")   # Verde suave (AH-AW)
    fill_brown = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")   # Gris/Marrón para proyección (BB-BG)

    font_header = Font(name="Arial", size=9, bold=True, color="333333")
    alignment_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    border_thin = Border(
        left=Side(style='thin', color='BFBFBF'),
        right=Side(style='thin', color='BFBFBF'),
        top=Side(style='thin', color='BFBFBF'),
        bottom=Side(style='thin', color='BFBFBF')
    )

    # Aplicar diseño agrupado a la fila de cabeceras
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = font_header
        cell.alignment = alignment_center
        cell.border = border_thin
        
        # Agrupación por color según rangos de la maqueta
        if col_idx <= 9:                      # A - I
            cell.fill = fill_red
        elif 10 <= col_idx <= 13:             # J - M
            cell.fill = fill_blue
        elif 14 <= col_idx <= 31:             # N - AE
            cell.fill = fill_yellow
        elif 32 <= col_idx <= 33:             # AF - AG
            cell.fill = fill_peach
        elif 34 <= col_idx <= 48:             # AH - AW
            cell.fill = fill_green
        elif 51 <= col_idx <= 56:             # BB - BG
            cell.fill = fill_brown
        elif col_idx >= 57:                   # BH - Nivel
            cell.fill = fill_yellow

    # Dar formato limpio de visualización al cuerpo de la tabla
    font_body = Font(name="Arial", size=9, bold=False)
    for col_idx in range(1, len(headers) + 1):
        header_name = headers[col_idx - 1].upper()
        for row_idx in range(2, ws.max_row + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.font = font_body
            cell.border = border_thin
            if isinstance(cell.value, (int, float)):
                if "ESTE" in header_name or header_name == "X":
                    cell.number_format = '0.0000' # <- Visualizar 4 decimales en Excel
                elif "NORTE" in header_name or header_name == "Y":
                    cell.number_format = '0.000'  # <- Visualizar 3 decimales en Excel
                elif "COTA" in header_name or header_name == "Z" or "ELEVACION" in header_name:
                    cell.number_format = '0.00'   # <- Visualizar 2 decimales en Excel
                else:
                    cell.number_format = '0.00'   # fallback general

    # Autoajustar anchos de columnas
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

    # Transmitir el archivo de regreso
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=mapeo_ventana_{code_up}.xlsx"}
    )

@app.get("/api/ensayos-plt", response_model=List[schemas.EnsayoPLTSaveSchema])
def get_ensayos_plt(db: Session = Depends(get_db)):
    res = db.query(models.EnsayoPLTIrregular).all()
    return res

@app.post("/api/ensayos-plt")
def save_ensayos_plt(data: List[schemas.EnsayoPLTSaveSchema], db: Session = Depends(get_db)):
    existing = {r.id: r for r in db.query(models.EnsayoPLTIrregular).all()}
    incoming_ids = {d.id for d in data if d.id is not None}
    
    # 1. Delete rows not in incoming data
    for rid, row in list(existing.items()):
        if rid not in incoming_ids:
            db.delete(row)
            
    # 2. Insert or update incoming rows
    for d in data:
        if d.id is not None and d.id in existing:
            # Update
            row = existing[d.id]
            row.campana = d.campana
            row.fecha_ensayo = d.fecha_ensayo
            row.sector_geotecnico = d.sector_geotecnico
            row.ejecutado_por = d.ejecutado_por
            row.zona_mapeo = d.zona_mapeo
            row.nivel = d.nivel
            row.celda_mapeo = d.celda_mapeo.strip().upper()
            row.muestra = d.muestra
            row.codigo_muestra = d.codigo_muestra
            row.litologia_1 = d.litologia_1
            row.litologia_2 = d.litologia_2
            row.litologia_3 = d.litologia_3
            row.tipo_litologico = d.tipo_litologico
            row.este = d.este
            row.norte = d.norte
            row.elevacion = d.elevacion
            row.espesor_d = d.espesor_d
            row.longitud_l = d.longitud_l
            row.ancho_w1 = d.ancho_w1
            row.ancho_w2 = d.ancho_w2
            row.fuerza_p = d.fuerza_p
            row.direccion_rotura = d.direccion_rotura
            row.tipo_fractura = d.tipo_fractura
            row.factor_conversion_k = d.factor_conversion_k
            row.observaciones = d.observaciones
        else:
            # Insert new
            row = models.EnsayoPLTIrregular(
                campana=d.campana,
                fecha_ensayo=d.fecha_ensayo,
                sector_geotecnico=d.sector_geotecnico,
                ejecutado_por=d.ejecutado_por,
                zona_mapeo=d.zona_mapeo,
                nivel=d.nivel,
                celda_mapeo=d.celda_mapeo.strip().upper(),
                muestra=d.muestra,
                codigo_muestra=d.codigo_muestra,
                litologia_1=d.litologia_1,
                litologia_2=d.litologia_2,
                litologia_3=d.litologia_3,
                tipo_litologico=d.tipo_litologico,
                este=d.este,
                norte=d.norte,
                elevacion=d.elevacion,
                espesor_d=d.espesor_d,
                longitud_l=d.longitud_l,
                ancho_w1=d.ancho_w1,
                ancho_w2=d.ancho_w2,
                fuerza_p=d.fuerza_p,
                direccion_rotura=d.direccion_rotura,
                tipo_fractura=d.tipo_fractura,
                factor_conversion_k=d.factor_conversion_k,
                observaciones=d.observaciones
            )
            db.add(row)
            
    db.commit()
    return {"status": "success", "message": "Ensayos PLT guardados con éxito"}

@app.post("/api/ventanas/{codigo}/fotos")
async def upload_foto(codigo: str, index: int, file: UploadFile = File(...)):
    code_up = codigo.strip().upper()
    dir_path = os.path.join(uploads_dir, code_up)
    os.makedirs(dir_path, exist_ok=True)
    
    # Validar tamaño máximo (5 MB)
    MAX_SIZE = 5 * 1024 * 1024
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="La fotografía excede el tamaño máximo permitido de 5MB")
        
    # Validar formato de imagen
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    allowed_exts = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "svg", "tiff"]
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400, 
            detail="Formato de imagen no soportado. Use JPG, JPEG, PNG, WEBP, BMP, GIF o SVG."
        )
    
    # Nueva convención de nombre solicitado: {codigo}-VENTANA-{index + 1}.{ext}
    new_filename = f"{code_up}-VENTANA-{index + 1}.{ext}"
    
    # Eliminar fotos previas en este índice (tanto del formato nuevo como del antiguo)
    # con otras extensiones para evitar archivos huérfanos duplicados en el disco
    for e in allowed_exts:
        # Limpiar formato antiguo si existía
        old_path = os.path.join(dir_path, f"foto_{index}.{e}")
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except:
                pass
        
        # Limpiar formato nuevo con otra extensión
        new_path_diff_ext = os.path.join(dir_path, f"{code_up}-VENTANA-{index + 1}.{e}")
        if os.path.exists(new_path_diff_ext) and e != ext:
            try:
                os.remove(new_path_diff_ext)
            except:
                pass
                
    # Guardar la nueva fotografía con la extensión correspondiente
    file_path = os.path.join(dir_path, new_filename)
    with open(file_path, "wb") as f:
        f.write(contents)
        
    return {"status": "success", "url": f"/api/uploads/{code_up}/{new_filename}"}


@app.delete("/api/ventanas/{codigo}/fotos/{index}")
def delete_foto(codigo: str, index: int):
    code_up = codigo.strip().upper()
    dir_path = os.path.join(uploads_dir, code_up)
    allowed_exts = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "svg", "tiff"]
    
    for e in allowed_exts:
        # Eliminar del formato nuevo
        new_path = os.path.join(dir_path, f"{code_up}-VENTANA-{index + 1}.{e}")
        if os.path.exists(new_path):
            try:
                os.remove(new_path)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al eliminar archivo: {e}")
        
        # Eliminar del formato antiguo (compatibilidad)
        old_path = os.path.join(dir_path, f"foto_{index}.{e}")
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al eliminar archivo: {e}")
                
    return {"status": "success"}

@app.post("/api/ventanas/{codigo}/fotos/meta")
def save_metadata(codigo: str, data: Dict[str, Any]):
    code_up = codigo.strip().upper()
    dir_path = os.path.join(uploads_dir, code_up)
    os.makedirs(dir_path, exist_ok=True)
    
    meta_path = os.path.join(dir_path, "metadata.json")
    import json
    try:
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar metadatos: {e}")
    return {"status": "success"}

@app.get("/api/ventanas/{codigo}/fotos")
def get_fotos(codigo: str):
    code_up = codigo.strip().upper()
    dir_path = os.path.join(uploads_dir, code_up)
    
    photos = ["", "", "", ""]
    captions = ["", "", "", ""]
    
    if os.path.exists(dir_path):
        # 1. Recuperar leyendas si existen en metadata.json
        meta_path = os.path.join(dir_path, "metadata.json")
        if os.path.exists(meta_path):
            try:
                import json
                with open(meta_path, 'r') as f: # o lectura estándar compatible
                    meta = json.load(f)
                    captions = meta.get("captions", ["", "", "", ""])
            except:
                # Si falla por bloqueo o formato, usamos fallback vacío
                pass
                
        # 2. Comprobar existencia física de las 4 fotos
        allowed_exts = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "svg", "tiff"]
        for i in range(4):
            found = False
            # Intentar buscar la foto en el formato nuevo
            for e in allowed_exts:
                file_path = os.path.join(dir_path, f"{code_up}-VENTANA-{i+1}.{e}")
                if os.path.exists(file_path):
                    import time
                    photos[i] = f"/api/uploads/{code_up}/{code_up}-VENTANA-{i+1}.{e}?t={int(time.time())}"
                    found = True
                    break
            
            # Fallback de compatibilidad por si tenían el formato antiguo foto_{i}.{e}
            if not found:
                for e in allowed_exts:
                    file_path = os.path.join(dir_path, f"foto_{i}.{e}")
                    if os.path.exists(file_path):
                        import time
                        photos[i] = f"/api/uploads/{code_up}/foto_{i}.{e}?t={int(time.time())}"
                        break
                
    return {"photos": photos, "captions": captions}

def run_bulk_pipeline(file_path: str):
    """
    Background Task: Ejecuta tu validador sobre el Excel subido,
    escribe el JSON de 200MB y genera el resumen compacto de < 1MB de forma automática.
    """
    raw_json_out = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
    compact_json_out = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
    
    # 1. Ejecutar tu validador de 79 columnas ya corregido
    validate_bulk_excel(file_path, raw_json_out)
    
    # 2. Cargar en memoria y generar la versión compacta (Sinfín de Incidencias)
    global DIAGNOSTIC_CACHE, COMPACT_CACHE
    with open(raw_json_out, "r", encoding="utf-8") as f:
        DIAGNOSTIC_CACHE = json.load(f)
        
    # Extraemos todos los KPIs menos el arreglo de 1 millón de incidencias detalladas
    COMPACT_CACHE = {k: v for k, v in DIAGNOSTIC_CACHE.items() if k != "incidencias"}
    
    # Guardamos la versión compacta ligera en el disco del servidor
    with open(compact_json_out, "w", encoding="utf-8") as f:
        json.dump(COMPACT_CACHE, f, ensure_ascii=False)

@app.post("/api/geomecanica/importar-excel-bulk")
async def importar_excel_bulk(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Recibe la planilla Excel bulk y ejecuta la auditoría en segundo plano."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="El archivo provisto no es una planilla Excel valida.")
        
    file_path = os.path.join(uploads_dir, "bulk_raw.xlsx")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    background_tasks.add_task(run_bulk_pipeline, file_path)
    return {"status": "procesando"}

@app.get("/api/geomecanica/resumen-ligero")
def obtener_resumen_ligero():
    """Retorna los KPIs ligeros (<1MB) de forma instantánea para la web."""
    global COMPACT_CACHE
    if COMPACT_CACHE is None:
        compact_file = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
        if os.path.exists(compact_file):
            with open(compact_file, "r", encoding="utf-8") as f:
                COMPACT_CACHE = json.load(f)
        else:
            return JSONResponse(status_code=202, content={"status": "procesando", "message": "Los datos aun se estan procesando en el servidor."})
    return COMPACT_CACHE

@app.get("/api/geomecanica/incidencias-paginadas")
def obtener_incidencias_paginadas(
    page: int = 1,
    limit: int = 50,
    tipo: str = None,
    celda: str = None
):
    """Devuelve bloques de incidencias (de 50 en 50) consultando la caché de 200MB."""
    global DIAGNOSTIC_CACHE
    if DIAGNOSTIC_CACHE is None:
        raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
        if os.path.exists(raw_file):
            with open(raw_file, "r", encoding="utf-8") as f:
                DIAGNOSTIC_CACHE = json.load(f)
        else:
            raise HTTPException(status_code=404, detail="El diagnostico no ha sido generado en el servidor.")

    incidencias = DIAGNOSTIC_CACHE.get("incidencias", [])
    
    # Filtros optimizados en memoria
    filtered = incidencias
    if tipo:
        filtered = [i for i in filtered if i.get("tipo_incidencia") == tipo.upper()]
    if celda:
        filtered = [i for i in filtered if i.get("celda_padre") == celda.upper() or i.get("celda_hija") == celda.upper()]
        
    total_records = len(filtered)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    
    return {
        "page": page,
        "limit": limit,
        "total_records": total_records,
        "total_pages": math.ceil(total_records / limit),
        "data": filtered[start_idx:end_idx]
    }