"""
routers/ventanas.py — Alineado a GEMA (SQL Server)

Novedades vs versión anterior:
- Sin sync_to_ventanas_final (tabla eliminada — schema GEMA no la tiene)
- Lookup códigos string → IDs FK usando GEMA (cached en sesión por request)
- Patrón Hybrid Cache Writable: backend recalcula sub-ratings, no confía en UI
- IDs gestionados por IDENTITY de SQL Server (sin MAX(id)+1)
- Foto upload mantenido; PLT eliminado (offline)
"""
import os
import io
import math
import time
import json
import openpyxl
from datetime import date, datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, case

from app.database import get_db
from app import models, schemas, calculator
from app.core.catalogs import LITHOLOGY_CLASSIFICATION

router = APIRouter()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
uploads_dir = os.path.join(BASE_DIR, "uploads")


# ============================================================================
# HELPERS — Lookup códigos → IDs en GEMA (cache por request)
# ============================================================================

class GEMACatalogResolver:
    """
    Resuelve codigos string -> IDs FK leyendo catalogos de GEMA.
    Estrategia de 2 niveles:
      Grupo A (Litologia, TipoEstructura, UnidadLitologica): NULL si no existe o inferir
      Grupo B (Sector, Geotecnico): Crear en GEMA si no existe
    Mantiene cache en sesion por request.
    """
    def __init__(self, db: Session):
        self.db = db
        self._cache: Dict[str, Dict[str, int]] = {}

    def _load(self, model_cls, pk_attr: str, code_attr: str, cache_key: str) -> Dict[str, int]:
        if cache_key in self._cache:
            return self._cache[cache_key]
        rows = self.db.query(model_cls).all()
        m = {}
        for r in rows:
            k = str(getattr(r, code_attr)).strip().upper()
            v = getattr(r, pk_attr)
            m[k] = v
        self._cache[cache_key] = m
        return m

    # ==================== GRUPO A: NULL si no existe ====================

    def litologia_id(self, codigo: Optional[str]) -> Optional[int]:
        if not codigo: return None
        m = self._load(models.Litologia, "litologia_id", "codigo", "litologias")
        code_clean = codigo.strip().upper()
        if code_clean in m:
            return m[code_clean]
        # Synonym fallbacks
        syns = {
            "LMT_S2": "LMT_S", "LMT_S3": "LMT_S3", "LMT_S4": "LMT_S4",
            "SKARN": "GSK", "SKARN_G": "GSK", "SKARN_P": "PSK",
            "MZB/P": "MZB_P", "MZM/M": "MZM_M", "MZM/F": "MZM_F",
            "ENDO": "ENDO", "ENDOSKARN": "ENDOSKARN"
        }
        target = syns.get(code_clean)
        if target and target in m:
            return m[target]
        return None

    def tipo_estructura_id(self, codigo: Optional[str]) -> Optional[int]:
        if not codigo: return None
        m = self._load(models.TipoEstructura, "tipo_estructura_id", "codigo", "tipos_estructura")
        code_clean = codigo.strip().upper()
        if code_clean in ("J", "JS"): code_clean = "JN"
        if code_clean == "DQ":
            # DB might have 'Dq' or 'DQ'
            return m.get("DQ") or m.get("DQ")
        return m.get(code_clean)

    def unidad_litologica_id(self, codigo: Optional[str]) -> Optional[int]:
        if not codigo: return None
        code_clean = codigo.strip().upper()
        syns = {
            "SEDIMENTARIOS": "SEDIMENTARIAS",
            "SEDIMENTARIO": "SEDIMENTARIAS",
            "SEDIMENTARIA": "SEDIMENTARIAS",
            "INTRUSIVA": "INTRUSIVOS",
            "INTRUSIVAS": "INTRUSIVOS",
            "INTRUSIVO": "INTRUSIVOS",
            "METAMORFICO": "METAMORFICAS",
            "METAMORFICOS": "METAMORFICAS",
            "METAMORFICA": "METAMORFICAS",
            "BRECHA": "BRECHAS",
        }
        target = syns.get(code_clean, code_clean)
        m = self._load(models.UnidadLitologica, "unidad_id", "codigo", "unidades")
        return m.get(target) or m.get(code_clean)

    def infer_unidad_id_from_lito(self, lito_code: Optional[str]) -> Optional[int]:
        if not lito_code: return None
        code_up = lito_code.strip().upper()
        match = next(
            (item for item in LITHOLOGY_CLASSIFICATION if item["lito1"].upper() == code_up or item["lito2"].upper() == code_up or item["lito3"].upper() == code_up),
            None
        )
        if match and match.get("grupo"):
            return self.unidad_litologica_id(match["grupo"])
        return None

    # ==================== GRUPO B: crear en GEMA si no existe ====================

    def sector_id(self, codigo: Optional[str]) -> Optional[int]:
        if not codigo: return None
        m = self._load(models.SectorGeotecnico, "sector_id", "codigo", "sectores")
        code_up = codigo.strip().upper()
        if code_up in m:
            return m[code_up]
        # No existe -> crear
        nuevo = models.SectorGeotecnico(
            codigo=code_up, nombre=code_up,
            proyecto="Ferrobamba", estado="Activo"
        )
        self.db.add(nuevo)
        self.db.flush()
        # Actualizar cache
        m[code_up] = nuevo.sector_id
        return nuevo.sector_id

    def geotecnico_id(self, codigo: Optional[str]) -> Optional[int]:
        if not codigo: return None
        m = self._load(models.Geotecnico, "geotecnico_id", "nombre", "geotecnicos")
        code_up = codigo.strip().upper()
        if code_up in m:
            return m[code_up]
        # No existe -> crear
        nuevo = models.Geotecnico(
            nombre=code_up, estado="Activo"
        )
        self.db.add(nuevo)
        self.db.flush()
        m[code_up] = nuevo.geotecnico_id
        return nuevo.geotecnico_id

    # ==================== CAMPAÑAS ====================

    def resolve_campania_id(self, value: Any) -> Optional[int]:
        if not value: return None
        val_str = str(value).strip().lower()
        try:
            val_int = int(val_str)
            row = self.db.query(models.Campania).filter_by(campania_id=val_int).first()
            if row: return row.campania_id
        except ValueError:
            pass
        # Buscar por coincidencia de año o texto (ej. 2021 -> Campaña 2021)
        for row in self.db.query(models.Campania).all():
            if val_str in row.nombre.lower():
                return row.campania_id
        # Fallback a Campaña 2026 (7) o primera disponible
        first_c = self.db.query(models.Campania).first()
        return first_c.campania_id if first_c else 1

    def campania_id(self, value: Any) -> bool:
        return self.resolve_campania_id(value) is not None


# ============================================================================
# HELPERS — Serialización ORM → API (IDs → códigos)
# ============================================================================

def serialize_ventana(v: models.Ventana, db: Session) -> schemas.VentanaResponseSchema:
    resolver = GEMACatalogResolver(db)
    tipos_map = {t.tipo_estructura_id: t.codigo for t in db.query(models.TipoEstructura).all()}

    def _to_int(val):
        if val is None:
            return None
        try:
            return int(float(str(val)))
        except (ValueError, TypeError):
            return None

    def _to_float(val):
        if val is None:
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    def _reverse(model_cls, id_val, code_attr):
        if not id_val:
            return None
        pk_col = None
        for c in model_cls.__table__.columns:
            if c.primary_key:
                pk_col = c
                break
        if pk_col is None:
            return None
        obj = db.query(model_cls).filter(pk_col == id_val).first()
        return getattr(obj, code_attr) if obj else None

    def _reverse_sector(id_val):
        """Reverse lookup de sector, retorna el código exacto (incluyendo PENDIENTE)."""
        return _reverse(models.SectorGeotecnico, id_val, "codigo")

    lito1_code = _reverse(models.Litologia, v.litologia1_id, "codigo")
    lito2_code = _reverse(models.Litologia, v.litologia2_id, "codigo")
    lito3_code = _reverse(models.Litologia, v.litologia3_id, "codigo")
    unidad_code = _reverse(models.UnidadLitologica, v.unidad_litologica_id, "codigo")
    if unidad_code:
        u_up = unidad_code.strip().upper()
        syns = {
            "SEDIMENTARIAS": "SEDIMENTARIAS",
            "SEDIMENTARIA": "SEDIMENTARIAS",
            "INTRUSIVOS": "INTRUSIVOS",
            "INTRUSIVO": "INTRUSIVOS",
            "METAMORFICAS": "METAMORFICAS",
            "METAMORFICOS": "METAMORFICAS",
            "METAMORFICA": "METAMORFICAS",
            "BRECHAS": "BRECHAS",
            "BRECHA": "BRECHAS",
            "VOLCANICAS": "VOLCANICAS",
            "VOLCANICA": "VOLCANICAS",
        }
        unidad_code = syns.get(u_up, u_up)

    # Inferencia inteligente de unidad litológica si en BD estaba en NULL
    if not unidad_code and lito1_code:
        l1_up = lito1_code.strip().upper()
        match = next(
            (item for item in LITHOLOGY_CLASSIFICATION if item["lito1"].upper() == l1_up or item["lito2"].upper() == l1_up or item["lito3"].upper() == l1_up),
            None
        )
        if match and match.get("grupo"):
            unidad_code = match["grupo"]

    discs = []
    for idx, e in enumerate(v.discontinuidades, start=1):
        num_est = e.numero_estructura if (e.numero_estructura is not None and e.numero_estructura > 0) else idx
        # Agrupación estricta de 3 estructuras por familia (F1=1..3, F2=4..6, F3=7..9)
        fam_computed = math.ceil(num_est / 3.0)
        tipo_codigo = tipos_map.get(e.tipo_estructura_id) if e.tipo_estructura_id else None
        if tipo_codigo == "J" or tipo_codigo == "JS":
            tipo_codigo = "JN"
        discs.append(schemas.DiscontinuidadResponse(
            fam=fam_computed,
            dist=float(e.distancia_estructura) if e.distancia_estructura is not None else None,
            tipo=tipo_codigo or "JN",
            dip=float(e.dip),
            dipdir=float(e.dip_dir),
            aber=float(e.abertura_mm) if e.abertura_mm is not None else None,
            esp=float(e.espesor_mm) if e.espesor_mm is not None else None,
            cont=float(e.continuidad_m) if e.continuidad_m is not None else None,
            espac=float(e.espaciamiento_m) if e.espaciamiento_m is not None else None,
            nstr=e.numero_estructuras,
            next=e.numero_extremos_visibles,
            term=e.terminacion,
            r1=e.tipo_relleno_1,
            r2=e.tipo_relleno_2,
            jrc=float(e.jrc) if e.jrc is not None else None,
            rug=int(e.rugosidad_estructura) if e.rugosidad_estructura is not None else None,
            forma=e.forma_estructura,
            alt=e.alteracion,
            numero_estructura=e.numero_estructura,
            altR76=_to_float(e.valor_alteracion_cd76),
            relR76=_to_float(e.valor_relleno_cd76),
            contR76=_to_float(e.continuidad_cd76),
            abR76=_to_float(e.abertura_cd76),
            rugR76=_to_float(e.rugosidad_cd76),
            totalR76=_to_float(e.valor_condicion_cd76),
            altR89=_to_float(e.valor_alteracion_cd89),
            relR89=_to_float(e.valor_relleno_cd89),
            contR89=_to_float(e.continuidad_cd89),
            abR89=_to_float(e.abertura_cd89),
            rugR89=_to_float(e.rugosidad_cd89),
            totalR89=_to_float(e.valor_condicion_cd89),
            teta=_to_float(e.teta),
            alfa=_to_float(e.alfa),
            x=_to_float(e.x),
            y=_to_float(e.y),
            z=_to_float(e.z),
        ))

    rmr_input = None
    if v.condicion_agua_rmr76:
        rmr_input = schemas.VentanaRmrInputBase(
            agua_codigo=v.condicion_agua_rmr76,
            resistencia_codigo=v.dureza_rmr76,
            gsi_estructura=v.gsi_estructura,
            gsi_superficie=v.gsi_superficie,
            gsi_visual=_to_float(v.gsi_visual_rmr76),
            control_estructural=_to_int(v.control_estructural_rmr76),
            efectos_voladura=_to_int(v.efectos_voladura_rmr76),
            ucs_mpa=_to_float(v.ucs_mpa),
            is50_mpa=_to_float(v.is50_mpa),
            comentario=v.comentarios,
        )

    try:
        ix, iy, ic = float(v.este_from), float(v.norte_from), float(v.cota_from)
        fx, fy, fc = float(v.este_to), float(v.norte_to), float(v.cota_to)
        largo_m = math.sqrt((fx-ix)**2 + (fy-iy)**2 + (fc-ic)**2)
    except Exception:
        largo_m = float(v.distancia_celda) if v.distancia_celda is not None else None

    return schemas.VentanaResponseSchema(
        codigo=v.codigo_celda,
        campania=v.campania_id,
        sector_geotecnico=_reverse_sector(v.sector_geotecnico_id),
        fecha_mapeo=v.fecha_mapeo,
        nivel=v.nivel,
        este_ini=float(v.este_from), norte_ini=float(v.norte_from), cota_ini=float(v.cota_from),
        este_fin=float(v.este_to), norte_fin=float(v.norte_to), cota_fin=float(v.cota_to),
        distancia_celda=_to_float(v.distancia_celda),
        altura=_to_float(v.altura),
        dip=_to_float(v.dip),
        azimut_hole=_to_float(v.azimut_hole),
        dip_talud=float(v.dip_talud) if v.dip_talud is not None else 0.0,
        dipdir_talud=_to_float(v.dip_dir_talud),
        lito_1=lito1_code,
        lito_2=lito2_code,
        lito_3=lito3_code,
        unidad_litologica=unidad_code,
        intemperismo=v.grado_intemperismo,
        altura_zona=v.altura_zona,
        fase=v.fase,
        turno=v.turno,
        mapeador=_reverse(models.Geotecnico, v.geotecnico_id, "nombre"),
        rmr_input=rmr_input,
        agua_r76=_to_float(v.condicion_agua_valor_rmr76),
        agua_r89=_to_float(v.condicion_agua_valor_rmr89),
        resist_r76=_to_float(v.resistencia_estimada_valor_rmr76),
        resist_r89=_to_float(v.resistencia_estimada_valor_rmr89),
        rqd_r76=_to_float(v.rqd_valor_rmr76),
        rqd_r89=_to_float(v.rqd_valor_rmr89),
        rqd_pct=_to_float(v.rqd_rmr76),
        jv=_to_float(v.frecuencia_fracturamiento_rmr76),
        espac_prom=_to_float(v.espaciamiento_promedio_rmr76),
        spacing_r76=_to_float(v.espaciamiento_valor_rmr76),
        spacing_r89=_to_float(v.espaciamiento_valor_rmr89),
        condisc_r76=_to_float(v.condicion_discontinuidad_valor_rmr76),
        condisc_r89=_to_float(v.condicion_discontinuidad_valor_rmr89),
        rmr_76=_to_float(v.rmr76_total),
        rmr_89=_to_float(v.rmr89_total),
        largo_m=largo_m,
        discontinuidades=discs,
    )


def calculate_and_persist_subratings(db: Session, v: models.Ventana):
    """Hybrid Cache Writable: recalcular sub-ratings en backend y persistir."""
    header_data = {
        "este_ini": float(v.este_from), "norte_ini": float(v.norte_from), "cota_ini": float(v.cota_from),
        "este_fin": float(v.este_to), "norte_fin": float(v.norte_to), "cota_fin": float(v.cota_to),
        "largo_m": float(v.distancia_celda) if v.distancia_celda is not None else None,
    }
    rows_data = []
    for e in v.discontinuidades:
        tipo_codigo = None
        if e.tipo_estructura_id:
            tipo_obj = db.query(models.TipoEstructura).filter_by(tipo_estructura_id=e.tipo_estructura_id).first()
            if tipo_obj:
                tipo_codigo = tipo_obj.codigo
        rows_data.append({
            "fam": e.familia_id,
            "dist": float(e.distancia_estructura) if e.distancia_estructura is not None else None,
            "tipo": tipo_codigo,
            "dip": float(e.dip),
            "dipdir": float(e.dip_dir),
            "aber": float(e.abertura_mm) if e.abertura_mm is not None else None,
            "esp": float(e.espesor_mm) if e.espesor_mm is not None else None,
            "cont": float(e.continuidad_m) if e.continuidad_m is not None else None,
            "espac": float(e.espaciamiento_m) if e.espaciamiento_m is not None else 0.5,
            "nstr": e.numero_estructuras,
            "rug": int(e.rugosidad_estructura) if e.rugosidad_estructura is not None else None,
            "alt": e.alteracion,
            "r1": e.tipo_relleno_1,
            "r2": e.tipo_relleno_2,
        })
    rmr_input = {
        "agua_codigo": v.condicion_agua_rmr76,
        "resistencia_codigo": v.dureza_rmr76,
    }

    res = calculator.calculate_geomechanics(header_data, rows_data, rmr_input)

    v.condicion_agua_valor_rmr76 = res["agua_r76"]
    v.condicion_agua_valor_rmr89 = res["agua_r89"]
    v.resistencia_estimada_valor_rmr76 = res["resist_r76"]
    v.resistencia_estimada_valor_rmr89 = res["resist_r89"]
    v.rqd_valor_rmr76 = res["rqd_r76"]
    v.rqd_valor_rmr89 = res["rqd_r89"]
    v.rqd_rmr76 = res["rqd_pct"]
    v.rqd_rmr89 = res["rqd_pct"]
    v.frecuencia_fracturamiento_rmr76 = res["jv"]
    v.frecuencia_fracturamiento_rmr89 = res["jv"]
    v.espaciamiento_promedio_rmr76 = res["espac_prom"]
    v.espaciamiento_promedio_rmr89 = res["espac_prom"]
    v.espaciamiento_valor_rmr76 = res["spacing_r76"]
    v.espaciamiento_valor_rmr89 = res["spacing_r89"]
    v.condicion_discontinuidad_valor_rmr76 = res["condisc_r76"]
    v.condicion_discontinuidad_valor_rmr89 = res["condisc_r89"]
    v.rmr76_total = res["rmr_76"]
    v.rmr89_total = res["rmr_89"]
    if res["espac_prom"]:
        v.tamano_bloques_rmr76 = res["espac_prom"] ** 3
        v.tamano_bloques_rmr89 = res["espac_prom"] ** 3
    if v.distancia_celda is None and res["largo_m"]:
        v.distancia_celda = res["largo_m"]

    for r_calc, e in zip(res["rows"], v.discontinuidades):
        e.valor_alteracion_cd76 = r_calc["alt_r76"]
        e.valor_alteracion_cd89 = r_calc["alt_r89"]
        e.valor_relleno_cd76 = r_calc["relleno_r76"]
        e.valor_relleno_cd89 = r_calc["relleno_r89"]
        e.continuidad_cd76 = r_calc["cont_r76"]
        e.continuidad_cd89 = r_calc["cont_r89"]
        e.abertura_cd76 = r_calc["aber_r76"]
        e.abertura_cd89 = r_calc["aber_r89"]
        e.rugosidad_cd76 = r_calc["rug_r76"]
        e.rugosidad_cd89 = r_calc["rug_r89"]
        e.valor_condicion_cd76 = r_calc["v76"]
        e.valor_condicion_cd89 = r_calc["v89"]
        e.teta = math.degrees(r_calc["teta"]) if r_calc["teta"] else None
        e.alfa = math.degrees(r_calc["alfa"]) if r_calc["alfa"] else None
        e.x = r_calc["wx"]
        e.y = r_calc["wy"]
        e.z = r_calc["wz"]
    db.flush()


# ============================================================================
# ENDPOINTS — CRUD
# ============================================================================

@router.get("/ventanas", response_model=schemas.VentanasPaginatedResponse)
def get_ventanas(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200, alias="page_size"),
    order_by: str = Query("fecha_mapeo", pattern="^(fecha_mapeo|codigo_celda|rmr76_total|rmr89_total)$"),
    order_dir: str = Query("desc", pattern="^(asc|desc)$"),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    sector: Optional[str] = Query(None),
    mapeador: Optional[str] = Query(None),
    campania: Optional[int] = Query(None),
    q: Optional[str] = Query(None, description="Buscar por código de celda"),
    rmr_min: Optional[float] = Query(None, ge=0, le=100),
    rmr_max: Optional[float] = Query(None, ge=0, le=100),
    search_global: bool = Query(False, description="Ignorar filtro de fecha y buscar en todo el historial"),
    db: Session = Depends(get_db),
):
    # 1. Query base + joins para resolver códigos
    query = db.query(models.Ventana)

    # 2. Filtros
    has_q = q and isinstance(q, str) and not q.startswith("Query(") and q.strip()
    if has_q:
        q_clean = q.strip()
        query = query.filter(models.Ventana.codigo_celda.ilike(f"%{q_clean}%"))
        # Si NO es búsqueda global explícita, respetar el rango de fecha activo
        if not search_global:
            if fecha_desde and isinstance(fecha_desde, date):
                query = query.filter(models.Ventana.fecha_mapeo >= fecha_desde)
            if fecha_hasta and isinstance(fecha_hasta, date):
                query = query.filter(models.Ventana.fecha_mapeo <= fecha_hasta)
    else:
        if fecha_desde and isinstance(fecha_desde, date):
            query = query.filter(models.Ventana.fecha_mapeo >= fecha_desde)
        if fecha_hasta and isinstance(fecha_hasta, date):
            query = query.filter(models.Ventana.fecha_mapeo <= fecha_hasta)

    if sector and isinstance(sector, str) and not sector.startswith("Query("):
        query = query.join(models.SectorGeotecnico, models.Ventana.sector_geotecnico_id == models.SectorGeotecnico.sector_id)
        query = query.filter(models.SectorGeotecnico.codigo.ilike(f"%{sector}%"))
    if mapeador and isinstance(mapeador, str) and not mapeador.startswith("Query("):
        query = query.join(models.Geotecnico, models.Ventana.geotecnico_id == models.Geotecnico.geotecnico_id)
        query = query.filter(models.Geotecnico.nombre.ilike(f"%{mapeador}%"))
    if campania and isinstance(campania, int):
        query = query.filter(models.Ventana.campania_id == campania)
    if rmr_min is not None and isinstance(rmr_min, (int, float)):
        query = query.filter(models.Ventana.rmr89_total >= rmr_min)
    if rmr_max is not None and isinstance(rmr_max, (int, float)):
        query = query.filter(models.Ventana.rmr89_total <= rmr_max)

    # 3. Total antes de paginar
    total_filtered = query.count()

    # 4. Ordenamiento con priorización de coincidencia exacta (A1 primero que DA1 o ZA1)
    order_col = getattr(models.Ventana, order_by, models.Ventana.fecha_mapeo)
    order_fn = getattr(order_col, order_dir, order_col.desc)

    if has_q:
        q_clean = q.strip().lower()
        exact_order = case(
            (func.lower(models.Ventana.codigo_celda) == q_clean, 0),
            (func.lower(models.Ventana.codigo_celda).like(f"{q_clean}%"), 1),
            else_=2
        )
        query = query.order_by(exact_order, order_fn(), models.Ventana.ventana_id.desc())
    else:
        query = query.order_by(order_fn(), models.Ventana.ventana_id.desc())

    # 5. Paginación
    total_pages = max(1, (total_filtered + page_size - 1) // page_size)
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    total_global = db.query(func.count(models.Ventana.ventana_id)).scalar() or 0

    # 6. KPIs del subconjunto filtrado
    kpis_query = db.query(
        func.count(models.Ventana.ventana_id),
        func.coalesce(func.sum(models.Ventana.distancia_celda), 0),
        func.avg(models.Ventana.rmr76_total),
        func.avg(models.Ventana.rmr89_total),
        func.min(models.Ventana.fecha_mapeo),
        func.max(models.Ventana.fecha_mapeo),
    )
    if has_q:
        q_clean = q.strip()
        kpis_query = kpis_query.filter(models.Ventana.codigo_celda.ilike(f"%{q_clean}%"))
        if not search_global:
            if fecha_desde and isinstance(fecha_desde, date): kpis_query = kpis_query.filter(models.Ventana.fecha_mapeo >= fecha_desde)
            if fecha_hasta and isinstance(fecha_hasta, date): kpis_query = kpis_query.filter(models.Ventana.fecha_mapeo <= fecha_hasta)
    else:
        if fecha_desde and isinstance(fecha_desde, date): kpis_query = kpis_query.filter(models.Ventana.fecha_mapeo >= fecha_desde)
        if fecha_hasta and isinstance(fecha_hasta, date): kpis_query = kpis_query.filter(models.Ventana.fecha_mapeo <= fecha_hasta)

    if sector and isinstance(sector, str) and not sector.startswith("Query("):
        kpis_query = kpis_query.join(models.SectorGeotecnico, models.Ventana.sector_geotecnico_id == models.SectorGeotecnico.sector_id)
        kpis_query = kpis_query.filter(models.SectorGeotecnico.codigo.ilike(f"%{sector}%"))
    if mapeador and isinstance(mapeador, str) and not mapeador.startswith("Query("):
        kpis_query = kpis_query.join(models.Geotecnico, models.Ventana.geotecnico_id == models.Geotecnico.geotecnico_id)
        kpis_query = kpis_query.filter(models.Geotecnico.nombre.ilike(f"%{mapeador}%"))
    if campania and isinstance(campania, int): kpis_query = kpis_query.filter(models.Ventana.campania_id == campania)
    if rmr_min is not None and isinstance(rmr_min, (int, float)): kpis_query = kpis_query.filter(models.Ventana.rmr89_total >= rmr_min)
    if rmr_max is not None and isinstance(rmr_max, (int, float)): kpis_query = kpis_query.filter(models.Ventana.rmr89_total <= rmr_max)

    kpis_row = kpis_query.first()

    # Último mapeador en el subconjunto (más reciente)
    last_mapeador = None
    if mapeador and isinstance(mapeador, str) and not mapeador.startswith("Query("):
        last_mapeador = mapeador
    else:
        last_v = db.query(models.Ventana).order_by(models.Ventana.fecha_mapeo.desc(), models.Ventana.ventana_id.desc()).first()
        if last_v and last_v.geotecnico_id:
            geo = db.query(models.Geotecnico).filter_by(geotecnico_id=last_v.geotecnico_id).first()
            if geo:
                last_mapeador = geo.nombre

    kpis = schemas.VentanasKPISchema(
        celdas_count=kpis_row[0] or 0,
        total_global=total_global,
        largo_total_m=round(float(kpis_row[1] or 0), 1),
        rmr_76_promedio=round(float(kpis_row[2]), 1) if kpis_row[2] is not None else None,
        rmr_89_promedio=round(float(kpis_row[3]), 1) if kpis_row[3] is not None else None,
        mapeador_mas_reciente=last_mapeador,
        fecha_min=kpis_row[4],
        fecha_max=kpis_row[5],
    )

    # 7. Serializar items (información liviana, sin sub-ratings)
    items_data = []
    for v in items:
        geologo = None
        if v.geotecnico_id:
            geo = db.query(models.Geotecnico).filter_by(geotecnico_id=v.geotecnico_id).first()
            if geo:
                geologo = geo.nombre
        sector_code = None
        if v.sector_geotecnico_id:
            sec = db.query(models.SectorGeotecnico).filter_by(sector_id=v.sector_geotecnico_id).first()
            if sec:
                sector_code = sec.codigo
        items_data.append(schemas.VentanaListItemSchema(
            codigo=v.codigo_celda,
            fecha_mapeo=v.fecha_mapeo,
            sector_geotecnico=sector_code,
            mapeador=geologo,
            lito_1=(
                db.query(models.Litologia).filter_by(litologia_id=v.litologia1_id).first().codigo
                if v.litologia1_id else None
            ),
            largo_m=float(v.distancia_celda) if v.distancia_celda is not None else None,
            altura_m=float(v.altura) if v.altura is not None else None,
            nivel=v.nivel,
            rmr_76=float(v.rmr76_total) if v.rmr76_total is not None else None,
            rmr_89=float(v.rmr89_total) if v.rmr89_total is not None else None,
            discontinuidades_count=len(v.discontinuidades),
            creado_en=v.fecha_registro,
        ))

    return schemas.VentanasPaginatedResponse(
        items=items_data,
        total=total_global,
        total_filtered=total_filtered,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        kpis=kpis,
    )


@router.get("/filtros/opciones")
def get_filtros_opciones(db: Session = Depends(get_db)):
    """Devuelve catálogos para popular los selects de filtros del Dashboard."""
    sectores = db.query(models.SectorGeotecnico).order_by(models.SectorGeotecnico.codigo).all()
    geotecnicos = db.query(models.Geotecnico).order_by(models.Geotecnico.nombre).all()
    campanias = db.query(models.Campania).order_by(models.Campania.campania_id).all()
    return {
        "sectores": [{"codigo": s.codigo, "nombre": s.nombre} for s in sectores if s.estado == "Activo"],
        "mapeadores": [{"codigo": g.nombre, "nombre": g.nombre} for g in geotecnicos if g.estado == "Activo"],
        "campanias": [{"id": c.campania_id, "nombre": c.nombre} for c in campanias if c.estado == "Activa"],
    }


class GeotecnicoCreateSchema(schemas.BaseModel):
    nombre: str

@router.post("/geotecnicos")
def create_geotecnico(data: GeotecnicoCreateSchema, db: Session = Depends(get_db)):
    """Crea un nuevo geotécnico/mapeador en la base de datos si no existe."""
    nombre_clean = data.nombre.strip().upper()
    if not nombre_clean:
        raise HTTPException(status_code=400, detail="Nombre de geotécnico requerido")
    existing = db.query(models.Geotecnico).filter(func.upper(models.Geotecnico.nombre) == nombre_clean).first()
    if existing:
        return {"id": existing.geotecnico_id, "nombre": existing.nombre, "created": False}
    nuevo = models.Geotecnico(nombre=nombre_clean, estado="Activo")
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return {"id": nuevo.geotecnico_id, "nombre": nuevo.nombre, "created": True}


@router.get("/ventanas/{codigo}", response_model=schemas.VentanaResponseSchema)
def get_ventana(codigo: str, db: Session = Depends(get_db)):
    code_up = codigo.strip().upper()
    v = db.query(models.Ventana).filter_by(codigo_celda=code_up).first()
    if not v:
        raise HTTPException(status_code=404, detail="Ventana no encontrada")
    return serialize_ventana(v, db)


@router.post("/ventanas")
def save_ventana(data: schemas.VentanaSaveSchema, db: Session = Depends(get_db)):
    code_up = data.codigo.strip().upper()
    resolver = GEMACatalogResolver(db)

    sector_id = resolver.sector_id(data.sector_geotecnico)
    if data.sector_geotecnico and sector_id is None:
        raise HTTPException(status_code=400, detail=f"Sector '{data.sector_geotecnico}' no encontrado en GEMA")
    
    campania_id = resolver.resolve_campania_id(data.campania)
    if not campania_id:
        raise HTTPException(status_code=400, detail=f"Campaña ID {data.campania} no encontrada en GEMA")

    lito1_id = resolver.litologia_id(data.lito_1)
    lito2_id = resolver.litologia_id(data.lito_2)
    lito3_id = resolver.litologia_id(data.lito_3)
    unidad_id = resolver.unidad_litologica_id(data.unidad_litologica)
    if unidad_id is None and data.lito_1:
        unidad_id = resolver.infer_unidad_id_from_lito(data.lito_1)
    geotecnico_id = resolver.geotecnico_id(data.mapeador)

    def clean(val):
        if val in (-1, -1.0, "-1"):
            return None
        return val

    v = db.query(models.Ventana).filter_by(codigo_celda=code_up).first()
    if v:
        v.campania_id = campania_id
        v.sector_geotecnico_id = sector_id
        v.fecha_mapeo = data.fecha_mapeo
        v.nivel = data.nivel
        v.este_from = data.este_ini; v.norte_from = data.norte_ini; v.cota_from = data.cota_ini
        v.este_to = data.este_fin; v.norte_to = data.norte_fin; v.cota_to = data.cota_fin
        v.distancia_celda = data.distancia_celda
        v.altura = data.altura
        v.dip = data.dip; v.azimut_hole = data.azimut_hole
        v.dip_talud = data.dip_talud; v.dip_dir_talud = data.dipdir_talud
        v.litologia1_id = lito1_id; v.litologia2_id = lito2_id; v.litologia3_id = lito3_id
        v.unidad_litologica_id = unidad_id
        v.grado_intemperismo = data.intemperismo
        v.altura_zona = data.altura_zona
        v.fase = data.fase; v.turno = data.turno
        v.geotecnico_id = geotecnico_id
        for e in list(v.discontinuidades):
            db.delete(e)
        db.flush()
    else:
        v = models.Ventana(
            codigo_celda=code_up, campania_id=campania_id,
            sector_geotecnico_id=sector_id,
            fecha_mapeo=data.fecha_mapeo, nivel=data.nivel,
            este_from=data.este_ini, norte_from=data.norte_ini, cota_from=data.cota_ini,
            este_to=data.este_fin, norte_to=data.norte_fin, cota_to=data.cota_fin,
            distancia_celda=data.distancia_celda, altura=data.altura,
            dip=data.dip, azimut_hole=data.azimut_hole,
            dip_talud=data.dip_talud, dip_dir_talud=data.dipdir_talud,
            litologia1_id=lito1_id, litologia2_id=lito2_id, litologia3_id=lito3_id,
            unidad_litologica_id=unidad_id,
            grado_intemperismo=data.intemperismo,
            altura_zona=data.altura_zona, fase=data.fase, turno=data.turno,
            geotecnico_id=geotecnico_id,
        )
        db.add(v)
        db.flush()

    if data.rmr_input:
        v.condicion_agua_rmr76 = data.rmr_input.agua_codigo
        v.condicion_agua_rmr89 = data.rmr_input.agua_codigo
        v.dureza_rmr76 = data.rmr_input.resistencia_codigo
        v.dureza_rmr89 = data.rmr_input.resistencia_codigo
        v.gsi_visual_rmr76 = data.rmr_input.gsi_visual
        v.gsi_visual_rmr89 = data.rmr_input.gsi_visual
        v.control_estructural_rmr76 = str(data.rmr_input.control_estructural) if data.rmr_input.control_estructural is not None else None
        v.control_estructural_rmr89 = str(data.rmr_input.control_estructural) if data.rmr_input.control_estructural is not None else None
        v.efectos_voladura_rmr76 = str(data.rmr_input.efectos_voladura) if data.rmr_input.efectos_voladura is not None else None
        v.efectos_voladura_rmr89 = str(data.rmr_input.efectos_voladura) if data.rmr_input.efectos_voladura is not None else None
        v.gsi_superficie = data.rmr_input.gsi_superficie
        v.gsi_estructura = data.rmr_input.gsi_estructura
        v.ucs_mpa = data.rmr_input.ucs_mpa
        v.is50_mpa = data.rmr_input.is50_mpa
        v.comentarios = data.rmr_input.comentario

    for idx, d in enumerate(data.discontinuidades, start=1):
        tipo_id = resolver.tipo_estructura_id(d.tipo)
        if d.tipo and tipo_id is None:
            raise HTTPException(status_code=400, detail=f"Tipo estructura '{d.tipo}' no encontrado en GEMA")
        fam_computed = math.ceil(idx / 3.0)
        e = models.EstructuraGeologica(
            ventana_id=v.ventana_id,
            numero_estructura=idx,
            familia_id=fam_computed,
            tipo_estructura_id=tipo_id,
            dip=d.dip, dip_dir=d.dipdir,
            distancia_estructura=clean(d.dist),
            abertura_mm=clean(d.aber), espesor_mm=clean(d.esp),
            continuidad_m=clean(d.cont), espaciamiento_m=clean(d.espac),
            numero_estructuras=clean(d.nstr),
            numero_extremos_visibles=clean(d.next),
            terminacion=clean(d.term),
            tipo_relleno_1=d.r1 if d.r1 and d.r1 != "-1" else None,
            tipo_relleno_2=d.r2 if d.r2 and d.r2 != "-1" else None,
            jrc=clean(d.jrc),
            rugosidad_estructura=str(d.rug) if d.rug is not None else None,
            forma_estructura=d.forma if d.forma and d.forma != "-1" else None,
            alteracion=d.alt if d.alt and d.alt != "-1" else None,
        )
        db.add(e)
    db.flush()

    calculate_and_persist_subratings(db, v)
    db.commit()
    return {"status": "success", "message": f"Ventana {code_up} guardada en GEMA", "ventana_id": v.ventana_id}


@router.delete("/ventanas/{codigo}")
def delete_ventana(codigo: str, db: Session = Depends(get_db)):
    code_up = codigo.strip().upper()
    v = db.query(models.Ventana).filter_by(codigo_celda=code_up).first()
    if not v:
        raise HTTPException(status_code=404, detail="Ventana no encontrada")
    db.delete(v)
    db.commit()
    return {"status": "success", "message": f"Ventana {code_up} eliminada de GEMA"}


# ============================================================================
# EXPORTAR EXCEL
# ============================================================================

@router.get("/ventanas/{codigo}/exportar")
def exportar_ventana_excel(codigo: str, db: Session = Depends(get_db)):
    code_up = codigo.strip().upper()
    v = db.query(models.Ventana).filter_by(codigo_celda=code_up).first()
    if not v:
        raise HTTPException(status_code=404, detail=f"Ventana {code_up} no encontrada")
    data = serialize_ventana(v, db)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Mapeo Ventana"
    headers = [
        "id", "CELDA", "Campaña", "Sector", "FECHA",
        "ESTE_FROM", "NORTE_FROM", "COTA_FROM", "ESTE_TO", "NORTE_TO", "COTA_TO",
        "Dist.Celda", "Altura", "DIP", "AZ_HOLE", "DIP_TALUD", "DIP_DIR_TALUD",
        "INTEMPERISMO", "Lito1", "Lito2", "Lito3", "Unidad", "AlturaZona", "Fase", "Turno", "Mapeador",
        "CONDICION_AGUA_76", "VALOR_AGUA_76", "DUREZA_76", "RESISTENCIA_VALOR_76",
        "GSI_VISUAL_76", "CONTROL_ESTRUC_76", "EFECTOS_VOLADURA_76",
        "RQD_VALOR_76", "RQD_76", "FREC_FRACT_76", "TAM_BLOQUES_76",
        "ESPAC_PROM_76", "ESPAC_VALOR_76", "COND_DISC_VALOR_76", "RMR_76",
        "DUREZA_89", "RESISTENCIA_VALOR_89", "GSI_VISUAL_89", "CONTROL_ESTRUC_89", "EFECTOS_VOL_89",
        "RQD_VALOR_89", "RQD_89", "FREC_FRACT_89", "TAM_BLOQUES_89",
        "ESPAC_PROM_89", "ESPAC_VALOR_89", "COND_DISC_VALOR_89", "RMR_89",
        "UCS_MPa", "IS50_MPa", "COMENTARIO",
        "TIPO", "DIP", "DIPDIR", "NumEstructura", "NumEstructuras",
        "ABERTURA_mm", "ESPESOR_mm", "CONTINUIDAD_m", "ESPACIAMIENTO_m",
        "EXTREMOS", "TERMINACION", "RELLENO1", "RELLENO2", "JRC", "RUGOSIDAD", "FORMA", "ALTERACION",
        "altR76", "relR76", "contR76", "abR76", "rugR76", "totalR76",
        "altR89", "relR89", "contR89", "abR89", "rugR89", "totalR89",
        "teta", "alfa", "x", "y", "z",
    ]
    ws.append(headers)
    for d in data.discontinuidades:
        ws.append([
            v.ventana_id, data.codigo, data.campania, data.sector_geotecnico,
            data.fecha_mapeo.isoformat() if data.fecha_mapeo else "",
            data.este_ini, data.norte_ini, data.cota_ini,
            data.este_fin, data.norte_fin, data.cota_fin,
            data.distancia_celda, data.altura, data.dip, data.azimut_hole,
            data.dip_talud, data.dipdir_talud,
            data.intemperismo, data.lito_1, data.lito_2, data.lito_3, data.unidad_litologica,
            data.altura_zona, data.fase, data.turno, data.mapeador,
            data.rmr_input.agua_codigo if data.rmr_input else None, data.agua_r76,
            data.rmr_input.resistencia_codigo if data.rmr_input else None, data.resist_r76,
            data.rmr_input.gsi_visual if data.rmr_input else None,
            data.rmr_input.control_estructural if data.rmr_input else None,
            data.rmr_input.efectos_voladura if data.rmr_input else None,
            data.rqd_r76, data.rqd_pct, data.jv,
            (data.espac_prom ** 3) if data.espac_prom else None,
            data.espac_prom, data.spacing_r76, data.condisc_r76, data.rmr_76,
            data.rmr_input.resistencia_codigo if data.rmr_input else None, data.resist_r89,
            data.rmr_input.gsi_visual if data.rmr_input else None,
            data.rmr_input.control_estructural if data.rmr_input else None,
            data.rmr_input.efectos_voladura if data.rmr_input else None,
            data.rqd_r89, data.rqd_pct, data.jv,
            (data.espac_prom ** 3) if data.espac_prom else None,
            data.espac_prom, data.spacing_r89, data.condisc_r89, data.rmr_89,
            data.rmr_input.ucs_mpa if data.rmr_input else None,
            data.rmr_input.is50_mpa if data.rmr_input else None,
            data.rmr_input.comentario if data.rmr_input else None,
            d.tipo, d.dip, d.dipdir, d.numero_estructura, d.nstr,
            d.aber, d.esp, d.cont, d.espac,
            d.next, d.term, d.r1, d.r2, d.jrc, d.rug, d.forma, d.alt,
            d.altR76, d.relR76, d.contR76, d.abR76, d.rugR76, d.totalR76,
            d.altR89, d.relR89, d.contR89, d.abR89, d.rugR89, d.totalR89,
            d.teta, d.alfa, d.x, d.y, d.z,
        ])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=mapeo_ventana_{code_up}.xlsx"}
    )


# ============================================================================
# IMPORTAR EXCEL — Bulk import desde formato BD/ventana compatible con GEMA
# ============================================================================

@router.post("/importar-excel/preview")
async def preview_import_excel(
    file: UploadFile = File(...),
    formato: Optional[str] = Query(None, pattern="^(ventana|bd|auto)?$"),
    db: Session = Depends(get_db)
):
    """Parsea el Excel y devuelve lista de celdas detectadas SIN guardar en BD."""
    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    resolver = GEMACatalogResolver(db)

    # Detectar hoja
    data_sheet = None
    sheet_name = ""
    if formato == "ventana":
        for sn in wb.sheetnames:
            if "ventana" in sn.lower():
                data_sheet = wb[sn]
                sheet_name = "ventana"
                break
        if not data_sheet:
            raise HTTPException(status_code=400, detail="No se encontro hoja 'ventana' (formato forzado)")
    elif formato == "bd":
        data_sheet = wb[wb.sheetnames[0]]
        sheet_name = "BD"
    else:
        if "ventana" in wb.sheetnames:
            data_sheet = wb["ventana"]; sheet_name = "ventana"
        elif "BD" in wb.sheetnames:
            data_sheet = wb["BD"]; sheet_name = "BD"
        else:
            for sn in wb.sheetnames:
                ws2 = wb[sn]
                h1 = str(ws2.cell(row=1, column=1).value or "").strip()
                h2 = str(ws2.cell(row=1, column=2).value or "").strip()
                if h1 == "id" and h2.upper() == "CELDA":
                    data_sheet = ws2; sheet_name = "BD"; break
    if not data_sheet:
        raise HTTPException(status_code=400, detail="No se encontro hoja de datos")
    ws = data_sheet

    celdas_detectadas = []

    if sheet_name == "ventana":
        for start in range(3, ws.max_row, 30):
            celda_val = ws.cell(row=start + 1, column=1).value or ws.cell(row=start, column=51).value
            if not celda_val or not str(celda_val).strip():
                continue
            codigo = str(celda_val).strip().upper()

            def gn(r, c):
                try: return float(ws.cell(row=r, column=c).value or 0.0)
                except: return 0.0
            def gs(r, c):
                return str(ws.cell(row=r, column=c).value or "").strip()

            est = round(gn(start + 2, 2), 4)
            norte = round(gn(start + 2, 4), 3)
            geo = gs(start + 5, 16)
            n_disc = 0
            for r_idx in range(start + 12, start + 25):
                if ws.cell(row=r_idx, column=1).value is not None:
                    n_disc += 1

            celdas_detectadas.append({
                "codigo": codigo, "este": est, "norte": norte,
                "n_discontinuidades": n_disc, "mapeador": geo or None,
                "fecha": str(ws.cell(row=start + 1, column=37).value or ""),
            })

    elif sheet_name == "BD":
        col_map = {}
        cota_seen = 0
        celda_seen = 0
        for ci in range(1, ws.max_column + 1):
            h = ws.cell(row=1, column=ci).value
            hs = str(h).strip() if h else ""
            if hs == "COTA":
                hs = "COTA_FROM" if cota_seen == 0 else "COTA_TO"
                cota_seen += 1
            elif hs == "CELDA":
                hs = "CELDA_PADRE" if celda_seen == 0 else "CELDA_DUPLICADA_IGNORE"
                celda_seen += 1
            norm = "".join(hs.upper().split()).replace(".","").replace("'","").replace('"',"").replace("(","").replace(")","").replace("-","").replace("_","")
            col_map[norm] = ci

        def _c(name, default=1):
            norm = "".join(str(name).upper().split()).replace(".","").replace("'","").replace('"',"").replace("(","").replace(")","").replace("-","").replace("_","")
            return col_map.get(norm, default)

        idx_celda = _c("CELDAPADRE", 2)
        celda_groups = {}
        for r_idx in range(2, ws.max_row + 1):
            cv = ws.cell(row=r_idx, column=idx_celda).value
            if cv and str(cv).strip():
                code = str(cv).strip().upper()
                celda_groups.setdefault(code, []).append(r_idx)

        for code, rows_indices in celda_groups.items():
            # Preview siempre muestra todas las celdas
            f_row = rows_indices[0]
            def gn(r, c):
                try: return float(ws.cell(row=r, column=c).value or 0.0)
                except: return 0.0
            def gs(r, c):
                return str(ws.cell(row=r, column=c).value or "").strip()

            este = round(gn(f_row, _c("ESTEFROM", 4)), 4)
            norte = round(gn(f_row, _c("NORTEFROM", 5)), 3)
            geo = gs(f_row, _c("GEOTECNICO", 74))
            fecha = str(ws.cell(row=f_row, column=_c("FECHA", 51)).value or "")

            # Contar discontinuidades en el grupo
            n_disc = len(rows_indices)

            celdas_detectadas.append({
                "codigo": code, "este": este, "norte": norte,
                "n_discontinuidades": n_disc, "mapeador": geo or None,
                "fecha": fecha[:10] if fecha else "",
            })

    return {
        "total": len(celdas_detectadas),
        "celdas": celdas_detectadas,
    }


@router.post("/importar-excel/parse")
async def parse_import_excel(
    file: UploadFile = File(...),
    celdas: str = Query(..., description="Lista de celdas separadas por coma"),
    formato: Optional[str] = Query(None, pattern="^(ventana|bd|auto)?$"),
    db: Session = Depends(get_db)
):
    """Parsea el Excel y devuelve los datos completos de las celdas seleccionadas SIN guardar."""
    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    resolver = GEMACatalogResolver(db)
    celdas_set = set(c.strip().upper() for c in celdas.split(","))
    resultado = []

    # Detectar hoja (misma logica que preview)
    data_sheet = None
    sheet_name = ""
    if formato == "ventana":
        for sn in wb.sheetnames:
            if "ventana" in sn.lower():
                data_sheet = wb[sn]; sheet_name = "ventana"; break
        if not data_sheet:
            raise HTTPException(status_code=400, detail="No se encontro hoja 'ventana'")
    elif formato == "bd":
        data_sheet = wb[wb.sheetnames[0]]; sheet_name = "BD"
    else:
        if "ventana" in wb.sheetnames:
            data_sheet = wb["ventana"]; sheet_name = "ventana"
        elif "BD" in wb.sheetnames:
            data_sheet = wb["BD"]; sheet_name = "BD"
        else:
            for sn in wb.sheetnames:
                ws2 = wb[sn]
                if str(ws2.cell(row=1, column=1).value or "").strip() == "id" and str(ws2.cell(row=1, column=2).value or "").strip().upper() == "CELDA":
                    data_sheet = ws2; sheet_name = "BD"; break
    if not data_sheet:
        raise HTTPException(status_code=400, detail="No se encontro hoja de datos")
    ws = data_sheet

    if sheet_name == "ventana":
        for start in range(3, ws.max_row, 30):
            celda_val = ws.cell(row=start + 1, column=1).value or ws.cell(row=start, column=51).value
            if not celda_val: continue
            codigo = str(celda_val).strip().upper()
            if codigo not in celdas_set: continue

            def gn(r, c):
                try: return float(ws.cell(row=r, column=c).value or 0.0)
                except: return 0.0
            def gs(r, c):
                return str(ws.cell(row=r, column=c).value or "").strip()

            discs = []
            for r_idx in range(start + 12, start + 25):
                if ws.cell(row=r_idx, column=1).value is None: continue
                raw_nstr = int(round(gn(r_idx, 6))) if gn(r_idx, 6) else -1
                discs.append(schemas.DiscontinuidadBase(
                    familia_id=int(ws.cell(row=r_idx, column=1).value),
                    distancia_m=round(gn(r_idx, 2)) if gn(r_idx, 2) else None,
                    tipo_estructura=gs(r_idx, 3) or "JN",
                    dip=round(gn(r_idx, 4), 2), dip_dir=round(gn(r_idx, 5), 2),
                    n_estructuras=raw_nstr if raw_nstr > 0 else -1,
                    abertura_mm=round(gn(r_idx, 7), 1) if gn(r_idx, 7) else None,
                    espesor_mm=round(gn(r_idx, 8), 1) if gn(r_idx, 8) else None,
                    continuidad_m=round(gn(r_idx, 9), 2) if gn(r_idx, 9) else None,
                    espaciamiento_m=round(gn(r_idx, 10), 2),
                    n_extremos_visibles=min(2, max(0, int(gn(r_idx, 11)))),
                    terminacion=min(3, max(0, int(gn(r_idx, 12)))),
                    relleno_1_codigo=gs(r_idx, 13), relleno_2_codigo=gs(r_idx, 14),
                    jrc=min(20, max(0, int(gn(r_idx, 19)))),
                    rugosidad_codigo=min(9, max(0, int(gn(r_idx, 20)))),
                    forma_estructura=gs(r_idx, 21), alteracion_codigo=gs(r_idx, 22),
                ))

            resultado.append({
                "codigo": codigo,
                "data": {
                    "codigo": codigo,
                    "campania": 7,
                    "sector_geotecnico": sect_geot or sector if (sect_geot := gs(start + 4, 21)) or (sector := gs(start + 1, 20)) else None,
                    "fecha_mapeo": str(ws.cell(row=start + 1, column=37).value or ""),
                    "nivel": str(round(gn(start + 3, 21), 2)) if gn(start + 3, 21) else None,
                    "este_ini": round(gn(start + 2, 2), 4),
                    "norte_ini": round(gn(start + 2, 4), 3), "cota_ini": round(gn(start + 2, 6), 2),
                    "este_fin": round(gn(start + 3, 2), 4),
                    "norte_fin": round(gn(start + 3, 4), 3), "cota_fin": round(gn(start + 3, 6), 2),
                    "distancia_celda": int(round(gn(start + 2, 11))),
                    "altura": round(gn(start + 3, 11), 1),
                    "dip_talud": round(gn(start + 2, 14), 2),
                    "dipdir_talud": round(gn(start + 3, 14), 2) if gn(start + 3, 14) else None,
                    "intemperismo": gs(start + 3, 16) or None,
                    "mapeador": gs(start + 5, 16) or None,
                    "discontinuidades": [d.model_dump() for d in discs],
                    "rmr_input": {
                        "agua_codigo": gs(start + 8, 36) or None,
                        "resistencia_codigo": gs(start + 8, 38) or None,
                        "gsi_visual": int(gn(start + 8, 42)) if gn(start + 8, 42) else None,
                        "control_estructural": int(gn(start + 8, 43)) if gn(start + 8, 43) else None,
                        "efectos_voladura": int(gn(start + 8, 44)) if gn(start + 8, 44) else None,
                        "ucs_mpa": gn(start + 8, 53) if gn(start + 8, 53) else None,
                        "is50_mpa": gn(start + 8, 54) if gn(start + 8, 54) else None,
                        "comentario": gs(start + 18, 56) or None,
                    }
                }
            })

    elif sheet_name == "BD":
        # Construir col_map (igual que preview)
        col_map = {}
        cota_seen = 0; celda_seen = 0
        for ci in range(1, ws.max_column + 1):
            h = ws.cell(row=1, column=ci).value
            hs = str(h).strip() if h else ""
            if hs == "COTA":
                hs = "COTA_FROM" if cota_seen == 0 else "COTA_TO"; cota_seen += 1
            elif hs == "CELDA":
                hs = "CELDA_PADRE" if celda_seen == 0 else "CELDA_DUPLICADA_IGNORE"; celda_seen += 1
            norm = "".join(hs.upper().split()).replace(".","").replace("'","").replace('"',"").replace("(","").replace(")","").replace("-","").replace("_","")
            col_map[norm] = ci

        def _c(name, default=1):
            norm = "".join(str(name).upper().split()).replace(".","").replace("'","").replace('"',"").replace("(","").replace(")","").replace("-","").replace("_","")
            return col_map.get(norm, default)

        idx_celda = _c("CELDAPADRE", 2)
        celda_groups = {}
        for r_idx in range(2, ws.max_row + 1):
            cv = ws.cell(row=r_idx, column=idx_celda).value
            if cv and str(cv).strip():
                code = str(cv).strip().upper()
                celda_groups.setdefault(code, []).append(r_idx)

        for code, rows_indices in celda_groups.items():
            if code not in celdas_set: continue
            f_row = rows_indices[0]
            def gn(r, c):
                try: return float(ws.cell(row=r, column=c).value or 0.0)
                except: return 0.0
            def gs(r, c):
                return str(ws.cell(row=r, column=c).value or "").strip()

            dip_col = _c("DIP", 60)
            for hc, ci in col_map.items():
                if hc == "DIP" and ci > 15: dip_col = ci; break

            discs = []
            for ri in rows_indices:
                disc_pos = ri - rows_indices[0]  # 0, 1, 2, 3... dentro del grupo
                nstr = int(round(gn(ri, _c("NUMERODEESTRUCTURAS", 62)))) if gn(ri, _c("NUMERODEESTRUCTURAS", 62)) else -1
                discs.append(schemas.DiscontinuidadBase(
                    familia_id=(disc_pos // 3) + 1,  # 0-2→F1, 3-5→F2, 6-8→F3
                    distancia_m=round(gn(ri, _c("Distdeestr", 53))) if gn(ri, _c("Distdeestr", 53)) else None,
                    tipo_estructura=gs(ri, _c("TIPO", 59)) or "JN",
                    dip=round(gn(ri, dip_col), 2), dip_dir=round(gn(ri, _c("DIPDIR", 61)), 2),
                    n_estructuras=nstr if nstr > 0 else -1,
                    abertura_mm=round(gn(ri, _c("ABERTURAmm", 63)), 1) if gn(ri, _c("ABERTURAmm", 63)) else None,
                    espesor_mm=round(gn(ri, _c("ESPESORmm", 64)), 1) if gn(ri, _c("ESPESORmm", 64)) else None,
                    continuidad_m=round(gn(ri, _c("CONTINUIDADm", 65)), 2) if gn(ri, _c("CONTINUIDADm", 65)) else None,
                    espaciamiento_m=round(gn(ri, _c("ESPACIAMIENTOm", 66)), 2),
                    n_extremos_visibles=min(2, max(0, int(gn(ri, _c("NUMERODEEXTREMOSVISIBLES", 67))))),
                    terminacion=3,
                    relleno_1_codigo=gs(ri, _c("TIPODERELLENO1", 68)),
                    relleno_2_codigo=gs(ri, _c("TIPODERELLENO2", 69)),
                    jrc=min(20, max(0, int(gn(ri, _c("JRC", 70))))),
                    rugosidad_codigo=min(9, max(0, int(gn(ri, _c("RUGOSIDADDEESTRUCTURAS", 71))))),
                    forma_estructura=gs(ri, _c("FORMADEESTRUCTURA", 72)),
                    alteracion_codigo=gs(ri, _c("ALTERACION", 73)),
                ))

            fecha_val = ws.cell(row=f_row, column=_c("FECHA", 51)).value
            resultado.append({
                "codigo": code,
                "data": {
                    "codigo": code,
                    "campania": 7,
                    "sector_geotecnico": gs(f_row, _c("SectorGeotecnicos", 80)) or None,
                    "fecha_mapeo": str(fecha_val)[:10] if fecha_val else None,
                    "nivel": str(round(gn(f_row, _c("Nivel", 75)), 2)) if gn(f_row, _c("Nivel", 75)) else None,
                    "este_ini": round(gn(f_row, _c("ESTEFROM", 4)), 4),
                    "norte_ini": round(gn(f_row, _c("NORTEFROM", 5)), 3),
                    "cota_ini": round(gn(f_row, _c("COTAFROM", 6)), 2),
                    "este_fin": round(gn(f_row, _c("ESTETO", 7)), 4),
                    "norte_fin": round(gn(f_row, _c("NORTETO", 8)), 3),
                    "cota_fin": round(gn(f_row, _c("COTATO", 9)), 2),
                    "distancia_celda": int(round(gn(f_row, _c("DistCelda", 10)))) if gn(f_row, _c("DistCelda", 10)) else None,
                    "altura": round(gn(f_row, _c("Altura", 11)), 1) if gn(f_row, _c("Altura", 11)) else None,
                    "dip": round(gn(f_row, 12), 2) if gn(f_row, 12) else None,
                    "azimut_hole": round(gn(f_row, 13), 2) if gn(f_row, 13) else None,
                    "dip_talud": round(gn(f_row, 14), 2),
                    "dipdir_talud": round(gn(f_row, 15), 2) if gn(f_row, 15) else None,
                    "intemperismo": gs(f_row, _c("INTEMPERISMO", 16)) or None,
                    "mapeador": gs(f_row, _c("GEOTECNICO", 74)) or None,
                    "lito_1": gs(f_row, _c("Lito1", 76)) or None,
                    "lito_2": gs(f_row, _c("Lito2", 77)) or None,
                    "lito_3": gs(f_row, _c("Lito3", 78)) or None,
                    "unidad_litologica": gs(f_row, _c("UnidadLitologica", 79)) or None,
                    "discontinuidades": [d.model_dump() for d in discs],
                    "rmr_input": {
                        "agua_codigo": gs(f_row, _c("CONDICIONDEAGUA89", 35)) or None,
                        "resistencia_codigo": gs(f_row, _c("DUREZA89", 37)) or None,
                        "gsi_visual": gn(f_row, _c("GSIVISUAL89", 39)) or None,
                        "control_estructural": gn(f_row, _c("CONTROLESTRUCTURAL89", 40)) or None,
                        "efectos_voladura": gn(f_row, _c("EFECTOSDEVOLADURA89", 41)) or None,
                        "ucs_mpa": gn(f_row, _c("UCSMpa", 33)) or None,
                        "is50_mpa": gn(f_row, _c("is50Mpa", 34)) or None,
                        "comentario": gs(f_row, _c("COMENTARIO", 52)) or None,
                    }
                }
            })

    return {"total": len(resultado), "celdas": resultado}
@router.post("/importar-excel")
async def importar_excel_endpoint(
    file: UploadFile = File(...),
    formato: Optional[str] = Query(None, pattern="^(ventana|bd|auto)?$"),
    celdas: Optional[str] = Query(None, description="Lista de celdas a importar separadas por coma (ej: A1,B1)"),
    db: Session = Depends(get_db)
):
    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    resolver = GEMACatalogResolver(db)
    imported_count = 0

    # Detectar hoja de datos: probar "ventana", "BD", o cualquier hoja con cabeceras BD
    data_sheet = None
    sheet_name = ""
    if formato == "ventana":
        for sn in wb.sheetnames:
            if "ventana" in sn.lower():
                data_sheet = wb[sn]
                sheet_name = "ventana"
                break
        if not data_sheet:
            raise HTTPException(status_code=400, detail="No se encontro hoja 'ventana' en el archivo (formato forzado a Estaciones)")
    elif formato == "bd":
        for sn in wb.sheetnames:
            if "bd" in sn.lower():
                data_sheet = wb[sn]
                sheet_name = "BD"
                break
        if not data_sheet:
            # Si no hay hoja llamada BD, usar la primera hoja como BD
            data_sheet = wb[wb.sheetnames[0]]
            sheet_name = "BD"
    else:
        # Auto-deteccion
        if "ventana" in wb.sheetnames:
            data_sheet = wb["ventana"]
            sheet_name = "ventana"
        elif "BD" in wb.sheetnames:
            data_sheet = wb["BD"]
            sheet_name = "BD"
        else:
            for sn in wb.sheetnames:
                ws = wb[sn]
                h1 = str(ws.cell(row=1, column=1).value or "").strip()
                h2 = str(ws.cell(row=1, column=2).value or "").strip()
                h3 = str(ws.cell(row=1, column=3).value or "").strip()
                if h1 == "id" and (h2.upper() == "CELDA" or h3.upper() == "CELDA"):
                    data_sheet = ws
                    sheet_name = "BD"
                    break

    if not data_sheet:
        raise HTTPException(status_code=400, detail="No se encontro una hoja de datos valida (ventana, BD o formato tabular)")

    ws = data_sheet

    # Filtrar por celdas si se especifico
    celdas_filter = set(c.strip().upper() for c in celdas.split(",")) if celdas else None

    if sheet_name == "ventana":
        for start in range(3, ws.max_row, 30):
            celda_val = ws.cell(row=start + 1, column=1).value or ws.cell(row=start, column=51).value
            if not celda_val or not str(celda_val).strip():
                continue
            codigo = str(celda_val).strip().upper()
            if celdas_filter and codigo not in celdas_filter:
                continue
            fecha_val = ws.cell(row=start + 1, column=37).value
            fecha_mapeo = fecha_val.date() if isinstance(fecha_val, datetime) else None

            def gn(r, c):
                try:
                    return float(ws.cell(row=r, column=c).value or 0.0)
                except:
                    return 0.0

            def gs(r, c):
                return str(ws.cell(row=r, column=c).value or "").strip()

            este_ini = round(gn(start + 2, 2), 4)
            norte_ini = round(gn(start + 2, 4), 3)
            cota_ini = round(gn(start + 2, 6), 2)
            este_fin = round(gn(start + 3, 2), 4)
            norte_fin = round(gn(start + 3, 4), 3)
            cota_fin = round(gn(start + 3, 6), 2)
            dist_celda = int(round(gn(start + 2, 11)))
            altura = round(gn(start + 3, 11), 1)
            dip_talud = round(gn(start + 2, 14), 2)
            dipdir_talud = round(gn(start + 3, 14), 2) if gn(start + 3, 14) else None
            dip_val = round(gn(start + 2, 12), 2) if gn(start + 2, 12) else None
            az_hole = round(gn(start + 2, 13), 2) if gn(start + 2, 13) else None
            lito_model = gs(start + 4, 16)
            mapeador = gs(start + 5, 16)
            sector = gs(start + 1, 20)
            fase = int(gn(start + 2, 21)) if gn(start + 2, 21) else None
            nivel = round(gn(start + 3, 21), 2) if gn(start + 3, 21) else None
            sect_geot = gs(start + 4, 21)
            intemp = gs(start + 3, 16)
            agua_code = gs(start + 8, 36)
            res_code = gs(start + 8, 38)
            gsi_vis = int(gn(start + 8, 42)) if gn(start + 8, 42) else None
            ctrl = int(gn(start + 8, 43)) if gn(start + 8, 43) else None
            vol = int(gn(start + 8, 44)) if gn(start + 8, 44) else None
            ucs = gn(start + 8, 53) if gn(start + 8, 53) else None
            is50_v = gn(start + 8, 54) if gn(start + 8, 54) else None
            comentario = gs(start + 18, 56)

            # Resolver litología por cascada
            lito1, lito2, lito3 = "", "", ""
            unidad = ""
            for row in LITHOLOGY_CLASSIFICATION:
                if row["lito3"].upper() == lito_model.upper().replace(" ", "").replace("-", ""):
                    lito1 = row["lito1"]
                    lito2 = row["lito2"]
                    lito3 = row["lito3"]
                    unidad = row["grupo"]
                    break

            discs = []
            for r_idx in range(start + 12, start + 25):
                fam_val = ws.cell(row=r_idx, column=1).value
                if fam_val is None or str(fam_val).strip() == "":
                    continue
                try:
                    fam_id = int(fam_val)
                except:
                    continue
                raw_nstr = int(round(gn(r_idx, 6))) if gn(r_idx, 6) else -1
                discs.append(schemas.DiscontinuidadBase(
                    familia_id=fam_id,
                    distancia_m=int(round(gn(r_idx, 2))) if gn(r_idx, 2) else None,
                    tipo_estructura=gs(r_idx, 3) or "JN",
                    dip=round(gn(r_idx, 4), 2), dip_dir=round(gn(r_idx, 5), 2),
                    n_estructuras=raw_nstr if raw_nstr > 0 else -1,
                    abertura_mm=round(gn(r_idx, 7), 1) if gn(r_idx, 7) else None,
                    espesor_mm=round(gn(r_idx, 8), 1) if gn(r_idx, 8) else None,
                    continuidad_m=round(gn(r_idx, 9), 2) if gn(r_idx, 9) else None,
                    espaciamiento_m=round(gn(r_idx, 10), 2),
                    n_extremos_visibles=min(2, max(0, int(gn(r_idx, 11)))),
                    terminacion=min(3, max(0, int(gn(r_idx, 12)))),
                    relleno_1_codigo=gs(r_idx, 13), relleno_2_codigo=gs(r_idx, 14),
                    jrc=min(20, max(0, int(gn(r_idx, 19)))),
                    rugosidad_codigo=min(9, max(0, int(gn(r_idx, 20)))),
                    forma_estructura=gs(r_idx, 21), alteracion_codigo=gs(r_idx, 22),
                ))

            ri = schemas.VentanaRmrInputBase(
                agua_codigo=agua_code or None, resistencia_codigo=res_code or None,
                gsi_estructura=gs(start + 8, 41) or None,
                gsi_superficie=gs(start + 8, 40) or None,
                gsi_visual=gsi_vis, control_estructural=ctrl,
                efectos_voladura=vol, ucs_mpa=ucs, is50_mpa=is50_v,
                comentario=comentario or None,
            )

            schema = schemas.VentanaSaveSchema(
                codigo=codigo, fecha_mapeo=fecha_mapeo, mapeador=mapeador or None,
                campania=7,  # Campaña 2026 por defecto en importación
                sector_geotecnico=sect_geot or sector,
                este_ini=este_ini, norte_ini=norte_ini, cota_ini=cota_ini,
                este_fin=este_fin, norte_fin=norte_fin, cota_fin=cota_fin,
                distancia_celda=dist_celda, altura=altura,
                dip_talud=dip_talud, dipdir_talud=dipdir_talud,
                dip=dip_val, azimut_hole=az_hole,
                intemperismo=intemp or None, lito_1=lito1 or None,
                lito_2=lito2 or None, lito_3=lito3 or lito_model or None,
                unidad_litologica=unidad or None,
                altura_zona=None, fase=fase, turno=None,
                discontinuidades=discs, rmr_input=ri,
            )
            # Usar save_ventana para upsert con recálculo
            code_up = schema.codigo.strip().upper()
            v = db.query(models.Ventana).filter_by(codigo_celda=code_up).first()
            if v:
                for e in list(v.discontinuidades):
                    db.delete(e)
            else:
                v = models.Ventana()
                db.add(v)

            _populate_ventana_from_schema(v, schema, resolver)
            db.flush()
            _populate_discontinuidades(db, v, schema.discontinuidades, resolver)
            db.flush()
            calculate_and_persist_subratings(db, v)
            db.flush()
            imported_count += 1

    elif sheet_name == "BD":
        # ws ya esta asignado desde la deteccion de hojas

        # Mapear cabeceras dinamicamente
        def _norm_col(c):
            return "".join(str(c).upper().split()).replace(".", "").replace("'", "").replace('"', "").replace("(", "").replace(")", "").replace("-", "").replace("_", "")

        col_map = {}
        cota_seen = 0
        celda_seen = 0
        for ci in range(1, ws.max_column + 1):
            h = ws.cell(row=1, column=ci).value
            hs = str(h).strip() if h else ""
            if hs == "COTA":
                hs = "COTA_FROM" if cota_seen == 0 else "COTA_TO"
                cota_seen += 1
            elif hs == "CELDA":
                hs = "CELDA_PADRE" if celda_seen == 0 else "CELDA_DUPLICADA_IGNORE"
                celda_seen += 1
            col_map[_norm_col(hs)] = ci

        def _c(name, default=1):
            return col_map.get(_norm_col(name), default)

        celda_groups = {}
        for r_idx in range(2, ws.max_row + 1):
            cv = ws.cell(row=r_idx, column=_c("CELDA_PADRE", 2)).value
            if cv and str(cv).strip():
                code = str(cv).strip().upper()
                celda_groups.setdefault(code, []).append(r_idx)

        for celda_code, rows_indices in celda_groups.items():
            if celdas_filter and celda_code not in celdas_filter:
                continue
            f_row = rows_indices[0]

            def gn(r, c):
                try:
                    return float(ws.cell(row=r, column=c).value or 0.0)
                except:
                    return 0.0

            def gs(r, c):
                return str(ws.cell(row=r, column=c).value or "").strip()

            # Resolver litología
            l1 = gs(f_row, _c("Lito1", 76))
            l2 = gs(f_row, _c("Lito2", 77))
            l3 = gs(f_row, _c("Lito3", 78))
            ug = gs(f_row, _c("UnidadLitologica", 79))
            lito_det = {"lito_1": l1, "lito_2": l2, "lito_3": l3, "unidad_litologica": ug}
            if l3:
                for row in LITHOLOGY_CLASSIFICATION:
                    if row["lito3"].upper().replace(" ", "").replace("-", "") == l3.upper().replace(" ", "").replace("-", ""):
                        lito_det = {"lito_1": row["lito1"], "lito_2": row["lito2"], "lito_3": row["lito3"], "unidad_litologica": row["grupo"]}
                        break

            discs = []
            for r_idx in rows_indices:
                disc_pos = r_idx - rows_indices[0]
                dip_col = _c("DIP", 60)
                for hc, ci in col_map.items():
                    if hc == "DIP" and ci > 15:
                        dip_col = ci
                        break
                nstr = int(round(gn(r_idx, _c("NUMERODEESTRUCTURAS", 62)))) if gn(r_idx, _c("NUMERODEESTRUCTURAS", 62)) else -1
                discs.append(schemas.DiscontinuidadBase(
                    familia_id=(disc_pos // 3) + 1,
                    distancia_m=round(gn(r_idx, _c("Distdeestr", 53))) if gn(r_idx, _c("Distdeestr", 53)) else None,
                    tipo_estructura=gs(r_idx, _c("TIPO", 59)) or "JN",
                    dip=round(gn(r_idx, dip_col), 2),
                    dip_dir=round(gn(r_idx, _c("DIPDIR", 61)), 2),
                    n_estructuras=nstr if nstr > 0 else -1,
                    abertura_mm=round(gn(r_idx, _c("ABERTURAmm", 63)), 1) if gn(r_idx, _c("ABERTURAmm", 63)) else None,
                    espesor_mm=round(gn(r_idx, _c("ESPESORmm", 64)), 1) if gn(r_idx, _c("ESPESORmm", 64)) else None,
                    continuidad_m=round(gn(r_idx, _c("CONTINUIDADm", 65)), 2) if gn(r_idx, _c("CONTINUIDADm", 65)) else None,
                    espaciamiento_m=round(gn(r_idx, _c("ESPACIAMIENTOm", 66)), 2),
                    n_extremos_visibles=min(2, max(0, int(gn(r_idx, _c("NUMERODEEXTREMOSVISIBLES", 67))))),
                    terminacion=3,  # Default para importación BD
                    relleno_1_codigo=gs(r_idx, _c("TIPODERELLENO1", 68)),
                    relleno_2_codigo=gs(r_idx, _c("TIPODERELLENO2", 69)),
                    jrc=min(20, max(0, int(gn(r_idx, _c("JRC", 70))))),
                    rugosidad_codigo=min(9, max(0, int(gn(r_idx, _c("RUGOSIDADDEESTRUCTURAS", 71))))),
                    forma_estructura=gs(r_idx, _c("FORMADEESTRUCTURA", 72)),
                    alteracion_codigo=gs(r_idx, _c("ALTERACION", 73)),
                ))

            fecha_val = ws.cell(row=f_row, column=_c("FECHA", 51)).value
            fecha_mapeo = fecha_val.date() if isinstance(fecha_val, datetime) else None

            ri = schemas.VentanaRmrInputBase(
                agua_codigo=gs(f_row, _c("CONDICIONDEAGUA89", 35)) or None,
                resistencia_codigo=gs(f_row, _c("DUREZA89", 37)) or None,
                gsi_visual=gn(f_row, _c("GSIVISUAL89", 39)) or None,
                control_estructural=gn(f_row, _c("CONTROLESTRUCTURAL89", 40)) or None,
                efectos_voladura=gn(f_row, _c("EFECTOSDEVOLADURA89", 41)) or None,
                ucs_mpa=gn(f_row, _c("UCSMpa", 33)) or None,
                is50_mpa=gn(f_row, _c("is50Mpa", 34)) or None,
                comentario=gs(f_row, _c("COMENTARIO", 52)) or None,
            )

            geo = gs(f_row, _c("GEOTECNICO", 74))
            nivel = round(gn(f_row, _c("Nivel", 75)), 2) if gn(f_row, _c("Nivel", 75)) else None
            # Campaña: buscar varias formas de escribir la columna
            campania_idx = _c("CampañaID", 81)
            if campania_idx == 81:
                for alt_name in ["Campaña", "Campana", "Campa", "CampaniaID", "Campania"]:
                    tmp = _c(alt_name, 0)
                    if tmp:
                        campania_idx = tmp
                        break
            campania_val = int(gn(f_row, campania_idx)) if gn(f_row, campania_idx) else None
            if campania_val and resolver.campania_id(campania_val):
                campania = campania_val
            else:
                campania = 7

            schema = schemas.VentanaSaveSchema(
                codigo=celda_code, fecha_mapeo=fecha_mapeo, mapeador=geo or None,
                campania=campania, sector_geotecnico=gs(f_row, _c("SectorGeotecnicos", 80)) or None,
                este_ini=round(gn(f_row, _c("ESTE_FROM", 4)), 4),
                norte_ini=round(gn(f_row, _c("NORTE_FROM", 5)), 3),
                cota_ini=round(gn(f_row, _c("COTA_FROM", 6)), 2),
                este_fin=round(gn(f_row, _c("ESTE_TO", 7)), 4),
                norte_fin=round(gn(f_row, _c("NORTE_TO", 8)), 3),
                cota_fin=round(gn(f_row, _c("COTA_TO", 9)), 2),
                distancia_celda=int(round(gn(f_row, _c("DistCelda", 10)))) if gn(f_row, _c("DistCelda", 10)) else None,
                altura=round(gn(f_row, _c("Altura", 11)), 1) if gn(f_row, _c("Altura", 11)) else None,
                dip_talud=round(gn(f_row, _c("DIPTALUD", 14)), 2),
                intemperismo=gs(f_row, _c("INTEMPERISMO", 16)) or None,
                lito_1=lito_det["lito_1"] or None, lito_2=lito_det["lito_2"] or None,
                lito_3=lito_det["lito_3"] or None, unidad_litologica=lito_det["unidad_litologica"] or None,
                nivel=str(nivel) if nivel else None, fase=5, turno=None,
                discontinuidades=discs, rmr_input=ri,
            )

            # Crear o actualizar ventana + rellenar campos ANTES del primer flush
            code_up = schema.codigo.strip().upper()
            v = db.query(models.Ventana).filter_by(codigo_celda=code_up).first()
            if v:
                for e in list(v.discontinuidades):
                    db.delete(e)
            else:
                v = models.Ventana()
                db.add(v)

            # Llenar todos los campos (incluye NOT NULLs) antes del flush
            _populate_ventana_from_schema(v, schema, resolver)
            db.flush()

            _populate_discontinuidades(db, v, schema.discontinuidades, resolver)
            db.flush()
            calculate_and_persist_subratings(db, v)
            db.flush()
            imported_count += 1

    db.commit()
    return {"status": "success", "message": f"Importación completada. {imported_count} ventanas importadas."}


# ============================================================================
# HELPERS COMPARTIDOS — para save_ventana e importar_excel
# ============================================================================

def _populate_ventana_from_schema(v: models.Ventana, data: schemas.VentanaSaveSchema, resolver: GEMACatalogResolver):
    """Llena los campos de una ventana ORM desde el schema."""
    v.codigo_celda = data.codigo.strip().upper()
    campania_id = data.campania if isinstance(data.campania, int) else 7
    v.campania_id = campania_id if resolver.campania_id(campania_id) else 7
    sector_id = resolver.sector_id(data.sector_geotecnico) if data.sector_geotecnico else None
    v.sector_geotecnico_id = sector_id
    v.fecha_mapeo = data.fecha_mapeo
    v.nivel = data.nivel
    v.este_from = data.este_ini; v.norte_from = data.norte_ini; v.cota_from = data.cota_ini
    v.este_to = data.este_fin; v.norte_to = data.norte_fin; v.cota_to = data.cota_fin
    v.distancia_celda = data.distancia_celda
    v.altura = data.altura
    v.dip = data.dip; v.azimut_hole = data.azimut_hole
    v.dip_talud = data.dip_talud; v.dip_dir_talud = data.dipdir_talud
    v.litologia1_id = resolver.litologia_id(data.lito_1) if data.lito_1 else None
    v.litologia2_id = resolver.litologia_id(data.lito_2) if data.lito_2 else None
    v.litologia3_id = resolver.litologia_id(data.lito_3) if data.lito_3 else None
    v.unidad_litologica_id = resolver.unidad_litologica_id(data.unidad_litologica) if data.unidad_litologica else None
    v.grado_intemperismo = data.intemperismo
    v.altura_zona = data.altura_zona
    v.fase = data.fase; v.turno = data.turno
    v.geotecnico_id = resolver.geotecnico_id(data.mapeador) if data.mapeador else None
    if data.rmr_input:
        v.condicion_agua_rmr76 = data.rmr_input.agua_codigo
        v.condicion_agua_rmr89 = data.rmr_input.agua_codigo
        v.dureza_rmr76 = data.rmr_input.resistencia_codigo
        v.dureza_rmr89 = data.rmr_input.resistencia_codigo
        v.gsi_visual_rmr76 = data.rmr_input.gsi_visual
        v.gsi_visual_rmr89 = data.rmr_input.gsi_visual
        v.control_estructural_rmr76 = str(data.rmr_input.control_estructural) if data.rmr_input.control_estructural is not None else None
        v.control_estructural_rmr89 = str(data.rmr_input.control_estructural) if data.rmr_input.control_estructural is not None else None
        v.efectos_voladura_rmr76 = str(data.rmr_input.efectos_voladura) if data.rmr_input.efectos_voladura is not None else None
        v.efectos_voladura_rmr89 = str(data.rmr_input.efectos_voladura) if data.rmr_input.efectos_voladura is not None else None
        v.gsi_superficie = data.rmr_input.gsi_superficie
        v.gsi_estructura = data.rmr_input.gsi_estructura
        v.ucs_mpa = data.rmr_input.ucs_mpa
        v.is50_mpa = data.rmr_input.is50_mpa
        v.comentarios = data.rmr_input.comentario


def _populate_discontinuidades(db: Session, v: models.Ventana, discs: List[schemas.DiscontinuidadBase], resolver: GEMACatalogResolver):
    """Inserta discontinuidades en GEMA desde el schema."""
    for idx, d in enumerate(discs, start=1):
        tipo_id = resolver.tipo_estructura_id(d.tipo)
        if not tipo_id:
            tipo_id = 7137  # fallback a JN (NOT NULL en GEMA)
        e = models.EstructuraGeologica(
            ventana_id=v.ventana_id,
            numero_estructura=idx,
            tipo_estructura_id=tipo_id,
            dip=float(d.dip), dip_dir=float(d.dipdir),
            distancia_estructura=float(d.dist) if d.dist is not None and d.dist != -1 else None,
            abertura_mm=float(d.aber) if d.aber is not None and d.aber != -1 else None,
            espesor_mm=float(d.esp) if d.esp is not None and d.esp != -1 else None,
            continuidad_m=float(d.cont) if d.cont is not None and d.cont != -1 else None,
            espaciamiento_m=float(d.espac) if d.espac is not None else 0.5,
            numero_estructuras=d.nstr if d.nstr is not None and d.nstr != -1 else None,
            numero_extremos_visibles=d.next if d.next is not None and d.next != -1 else None,
            terminacion=d.term if d.term is not None and d.term != -1 else None,
            tipo_relleno_1=d.r1 if d.r1 and d.r1 != "-1" else None,
            tipo_relleno_2=d.r2 if d.r2 and d.r2 != "-1" else None,
            jrc=float(d.jrc) if d.jrc is not None and d.jrc != -1 else None,
            rugosidad_estructura=str(d.rug) if d.rug is not None and d.rug != -1 else None,
            forma_estructura=d.forma if d.forma and d.forma != "-1" else None,
            alteracion=d.alt if d.alt and d.alt != "-1" else None,
            familia_id=d.fam,
        )
        db.add(e)
# ============================================================================

@router.post("/ventanas/{codigo}/fotos")
async def upload_foto(codigo: str, index: int, file: UploadFile = File(...)):
    code_up = codigo.strip().upper()
    dir_path = os.path.join(uploads_dir, code_up)
    os.makedirs(dir_path, exist_ok=True)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La fotografía excede los 5MB")
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    allowed_exts = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "svg", "tiff"]
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Formato no soportado.")
    new_filename = f"{code_up}-VENTANA-{index + 1}.{ext}"
    for e in allowed_exts:
        old_path = os.path.join(dir_path, f"foto_{index}.{e}")
        if os.path.exists(old_path): os.remove(old_path)
        new_path_diff_ext = os.path.join(dir_path, f"{code_up}-VENTANA-{index + 1}.{e}")
        if os.path.exists(new_path_diff_ext) and e != ext: os.remove(new_path_diff_ext)
    file_path = os.path.join(dir_path, new_filename)
    with open(file_path, "wb") as f:
        f.write(contents)
    return {"status": "success", "url": f"/api/uploads/{code_up}/{new_filename}"}


@router.delete("/ventanas/{codigo}/fotos/{index}")
def delete_foto(codigo: str, index: int):
    code_up = codigo.strip().upper()
    dir_path = os.path.join(uploads_dir, code_up)
    allowed_exts = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "svg", "tiff"]
    for e in allowed_exts:
        new_path = os.path.join(dir_path, f"{code_up}-VENTANA-{index + 1}.{e}")
        if os.path.exists(new_path): os.remove(new_path)
        old_path = os.path.join(dir_path, f"foto_{index}.{e}")
        if os.path.exists(old_path): os.remove(old_path)
    return {"status": "success"}


@router.post("/ventanas/{codigo}/fotos/meta")
def save_metadata(codigo: str, data: Dict[str, Any]):
    code_up = codigo.strip().upper()
    dir_path = os.path.join(uploads_dir, code_up)
    os.makedirs(dir_path, exist_ok=True)
    meta_path = os.path.join(dir_path, "metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return {"status": "success"}


@router.get("/ventanas/{codigo}/fotos")
def get_fotos(codigo: str):
    code_up = codigo.strip().upper()
    dir_path = os.path.join(uploads_dir, code_up)
    photos = ["", "", "", ""]
    captions = ["", "", "", ""]
    if os.path.exists(dir_path):
        meta_path = os.path.join(dir_path, "metadata.json")
        if os.path.exists(meta_path):
            try:
                with open(meta_path, 'r') as f:
                    meta = json.load(f)
                    captions = meta.get("captions", ["", "", "", ""])
            except Exception:
                pass
        allowed_exts = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "svg", "tiff"]
        for i in range(4):
            found = False
            for e in allowed_exts:
                file_path = os.path.join(dir_path, f"{code_up}-VENTANA-{i+1}.{e}")
                if os.path.exists(file_path):
                    photos[i] = f"/api/uploads/{code_up}/{code_up}-VENTANA-{i+1}.{e}?t={int(time.time())}"
                    found = True
                    break
            if not found:
                for e in allowed_exts:
                    file_path = os.path.join(dir_path, f"foto_{i}.{e}")
                    if os.path.exists(file_path):
                        photos[i] = f"/api/uploads/{code_up}/foto_{i}.{e}?t={int(time.time())}"
                        break
    return {"photos": photos, "captions": captions}