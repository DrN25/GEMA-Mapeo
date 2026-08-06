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
from sqlalchemy.orm import Session, selectinload
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
            estructura_id=e.estructura_id,
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
            r1="c" if (not e.tipo_relleno_1 or str(e.tipo_relleno_1).strip().lower() in ("-1", "-1.0", "cwf")) else str(e.tipo_relleno_1).strip().lower(),
            r2=None if (not e.tipo_relleno_2 or str(e.tipo_relleno_2).strip().lower() in ("-1", "-1.0")) else ("c" if str(e.tipo_relleno_2).strip().lower() == "cwf" else str(e.tipo_relleno_2).strip().lower()),
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
        # Solo calcular largo_m si AMBOS extremos son distintos de (0,0,0)
        # para evitar calcular la magnitud del vector desde el origen (coordenadas UTM brutas)
        origin_from = (ix == 0.0 and iy == 0.0 and ic == 0.0)
        origin_to   = (fx == 0.0 and fy == 0.0 and fc == 0.0)
        if not origin_from and not origin_to:
            largo_m = math.sqrt((fx-ix)**2 + (fy-iy)**2 + (fc-ic)**2)
        else:
            largo_m = float(v.distancia_celda) if v.distancia_celda is not None else None
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
        alteracion=v.alteracion if hasattr(v, 'alteracion') and v.alteracion is not None else getattr(v, 'altura_mapeo', None),
        altura_mapeo=v.alteracion if hasattr(v, 'alteracion') and v.alteracion is not None else getattr(v, 'altura_mapeo', None),
        fase=v.fase,
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


def _safe_distancia_celda(value) -> Optional[float]:
    """Cap distancia_celda al rango máximo de Numeric(8,3) = 99999.999 m.
    Si el valor supera ese límite o es negativo, retorna None para evitar
    un DataError de desbordamiento aritmético en SQL Server."""
    if value is None:
        return None
    try:
        v = float(value)
        if v < 0 or v > 99999.999:
            return None
        return round(v, 3)
    except (ValueError, TypeError):
        return None


def calculate_and_persist_subratings(db: Session, v: models.Ventana):
    """Hybrid Cache Writable: recalcular sub-ratings en backend y persistir."""
    try:
        ix = float(v.este_from or 0)
        iy = float(v.norte_from or 0)
        ic = float(v.cota_from or 0)
        fx = float(v.este_to or 0)
        fy = float(v.norte_to or 0)
        fc = float(v.cota_to or 0)
    except (TypeError, ValueError):
        ix = iy = ic = fx = fy = fc = 0.0

    # Solo calcular largo_m si AMBOS extremos son distintos de (0,0,0)
    # para evitar calcular la magnitud del vector desde el origen (coordenadas UTM brutas)
    origin_from = (ix == 0.0 and iy == 0.0 and ic == 0.0)
    origin_to   = (fx == 0.0 and fy == 0.0 and fc == 0.0)
    valid_coords = not origin_from and not origin_to

    header_data = {
        "este_ini": ix if valid_coords else None,
        "norte_ini": iy if valid_coords else None,
        "cota_ini": ic if valid_coords else None,
        "este_fin": fx if valid_coords else None,
        "norte_fin": fy if valid_coords else None,
        "cota_fin": fc if valid_coords else None,
        "largo_m": _safe_distancia_celda(v.distancia_celda),
    }
    rows_data = []
    # Consultar las discontinuidades por ventana_id (NO por la relationship
    # v.discontinuidades): esta puede quedar cacheada vacía cuando los objetos
    # se insertan después de haberla accedido (celdas nuevas) y el cálculo
    # RMR/RQD/espaciamiento terminaría en 0 silenciosamente.
    estructuras = db.query(models.EstructuraGeologica).filter(
        models.EstructuraGeologica.ventana_id == v.ventana_id
    ).all()
    for e in estructuras:
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
    if v.distancia_celda is None and res.get("largo_m"):
        safe_largo = _safe_distancia_celda(res["largo_m"])
        if safe_largo is not None:
            v.distancia_celda = safe_largo

    for r_calc, e in zip(res["rows"], estructuras):
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
    rmr76: Optional[float] = Query(None, ge=0, le=100, description="RMR 76 exacto"),
    rmr89: Optional[float] = Query(None, ge=0, le=100, description="RMR 89 exacto"),
    rqd76: Optional[float] = Query(None, ge=0, le=100, description="RQD % 76 exacto"),
    rqd89: Optional[float] = Query(None, ge=0, le=100, description="RQD % 89 exacto"),
    gsi: Optional[float] = Query(None, ge=0, le=100, description="GSI visual exacto"),
    search_global: bool = Query(False, description="Ignorar filtro de fecha y buscar en todo el historial"),
    db: Session = Depends(get_db),
):
    # 1. Query base + joins para resolver códigos
    # Eager loading de relaciones para evitar N+1 (SmarterASP limita conexiones).
    query = db.query(models.Ventana).options(
        selectinload(models.Ventana.discontinuidades),
    )

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
    if rmr76 is not None and isinstance(rmr76, (int, float)):
        query = query.filter(models.Ventana.rmr76_total == rmr76)
    if rmr89 is not None and isinstance(rmr89, (int, float)):
        query = query.filter(models.Ventana.rmr89_total == rmr89)
    if rqd76 is not None and isinstance(rqd76, (int, float)):
        query = query.filter(models.Ventana.rqd_rmr76 == rqd76)
    if rqd89 is not None and isinstance(rqd89, (int, float)):
        query = query.filter(models.Ventana.rqd_rmr89 == rqd89)
    if gsi is not None and isinstance(gsi, (int, float)):
        query = query.filter(models.Ventana.gsi_visual_rmr89 == gsi)

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
    if rmr76 is not None and isinstance(rmr76, (int, float)): kpis_query = kpis_query.filter(models.Ventana.rmr76_total == rmr76)
    if rmr89 is not None and isinstance(rmr89, (int, float)): kpis_query = kpis_query.filter(models.Ventana.rmr89_total == rmr89)
    if rqd76 is not None and isinstance(rqd76, (int, float)): kpis_query = kpis_query.filter(models.Ventana.rqd_rmr76 == rqd76)
    if rqd89 is not None and isinstance(rqd89, (int, float)): kpis_query = kpis_query.filter(models.Ventana.rqd_rmr89 == rqd89)
    if gsi is not None and isinstance(gsi, (int, float)): kpis_query = kpis_query.filter(models.Ventana.gsi_visual_rmr89 == gsi)

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
    # Precargar catálogos en lote para evitar N+1 (SmarterASP limita conexiones).
    geo_ids = {v.geotecnico_id for v in items if v.geotecnico_id}
    sec_ids = {v.sector_geotecnico_id for v in items if v.sector_geotecnico_id}
    lito_ids = {v.litologia1_id for v in items if v.litologia1_id}

    geo_map = {}
    if geo_ids:
        geo_map = {g.geotecnico_id: g.nombre for g in db.query(models.Geotecnico).filter(models.Geotecnico.geotecnico_id.in_(geo_ids)).all()}
    sec_map = {}
    if sec_ids:
        sec_map = {s.sector_id: s.codigo for s in db.query(models.SectorGeotecnico).filter(models.SectorGeotecnico.sector_id.in_(sec_ids)).all()}
    lito_map = {}
    if lito_ids:
        lito_map = {l.litologia_id: l.codigo for l in db.query(models.Litologia).filter(models.Litologia.litologia_id.in_(lito_ids)).all()}

    items_data = []
    for v in items:
        items_data.append(schemas.VentanaListItemSchema(
            codigo=v.codigo_celda,
            fecha_mapeo=v.fecha_mapeo,
            sector_geotecnico=sec_map.get(v.sector_geotecnico_id),
            mapeador=geo_map.get(v.geotecnico_id),
            lito_1=lito_map.get(v.litologia1_id),
            largo_m=float(v.distancia_celda) if v.distancia_celda is not None else None,
            altura_m=float(v.altura) if v.altura is not None else None,
            nivel=v.nivel,
            rmr_76=float(v.rmr76_total) if v.rmr76_total is not None else None,
            rmr_89=float(v.rmr89_total) if v.rmr89_total is not None else None,
            rqd76_pct=float(v.rqd_rmr76) if v.rqd_rmr76 is not None else None,
            rqd89_pct=float(v.rqd_rmr89) if v.rqd_rmr89 is not None else None,
            gsi_visual=float(v.gsi_visual_rmr89) if v.gsi_visual_rmr89 is not None else None,
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


@router.get("/ventanas-check/{codigo}")
@router.get("/ventanas/check-codigo/{codigo}")
def check_codigo_celda(codigo: str, current_codigo: Optional[str] = Query(None), db: Session = Depends(get_db)):
    clean_code = codigo.strip().upper()
    if not clean_code:
        return {"codigo": "", "exists": False, "valid": False}
    
    query = db.query(models.Ventana).filter(models.Ventana.codigo_celda == clean_code)
    if current_codigo:
        query = query.filter(models.Ventana.codigo_celda != current_codigo.strip().upper())
    
    existing = query.first()
    return {
        "codigo": clean_code,
        "exists": existing is not None,
        "valid": True
    }


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

    # Celdas sin sector: usar el sector "PENDIENTE" (misma convención que el
    # importador de Excel). Si se enviara None, la columna SectorGeotecnicoID
    # (NOT NULL) viola la integridad → 500 → la celda queda pendiente para
    # siempre aunque el guardado de los demás campos haya sido exitoso.
    sector_geotecnico = data.sector_geotecnico or "PENDIENTE"
    sector_id = resolver.sector_id(sector_geotecnico)
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
        v.distancia_celda = _safe_distancia_celda(data.distancia_celda)
        v.altura = data.altura if data.altura is not None else data.altura_m
        v.dip = data.dip if data.dip is not None else data.dip_hw
        v.azimut_hole = data.azimut_hole if data.azimut_hole is not None else data.az_hw
        v.dip_talud = data.dip_talud; v.dip_dir_talud = data.dipdir_talud
        v.litologia1_id = lito1_id; v.litologia2_id = lito2_id; v.litologia3_id = lito3_id
        v.unidad_litologica_id = unidad_id
        raw_alt_zona = data.alteracion or data.altura_mapeo or data.alteracion_codigo
        v.grado_intemperismo = data.intemperismo or data.intemperismo_codigo
        v.alteracion = raw_alt_zona.lower().strip() if raw_alt_zona else None
        v.fase = data.fase
        v.geotecnico_id = geotecnico_id
        db.flush()
    else:
        raw_alt_zona = data.alteracion or data.altura_mapeo or data.alteracion_codigo
        v = models.Ventana(
            codigo_celda=code_up, campania_id=campania_id,
            sector_geotecnico_id=sector_id,
            fecha_mapeo=data.fecha_mapeo, nivel=data.nivel,
            este_from=data.este_ini, norte_from=data.norte_ini, cota_from=data.cota_ini,
            este_to=data.este_fin, norte_to=data.norte_fin, cota_to=data.cota_fin,
            distancia_celda=_safe_distancia_celda(data.distancia_celda),
            altura=data.altura if data.altura is not None else data.altura_m,
            dip=data.dip if data.dip is not None else data.dip_hw,
            azimut_hole=data.azimut_hole if data.azimut_hole is not None else data.az_hw,
            dip_talud=data.dip_talud, dip_dir_talud=data.dipdir_talud,
            litologia1_id=lito1_id, litologia2_id=lito2_id, litologia3_id=lito3_id,
            unidad_litologica_id=unidad_id,
            grado_intemperismo=data.intemperismo or data.intemperismo_codigo,
            alteracion=raw_alt_zona.lower().strip() if raw_alt_zona else None,
            fase=data.fase,
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

    def clean_relleno(val):
        if not val or val in ("-1", "-1.0"):
            return None
        v_clean = str(val).strip().lower()
        if v_clean == "cwf":
            return "c"
        return v_clean

    # Upsert de discontinuidades: las que vienen con EstructuraID real se
    # ACTUALIZAN en su mismo registro (no se recrean, preservando cualquier
    # columna futura); si no viene id pero coincide el NumeroEstructura, se
    # actualiza por posición (clave natural, evita colisión con el UNIQUE
    # UQ_EstructurasGeo_VentanaNumero); las nuevas se insertan; las existentes
    # que ya no vienen en la lista se eliminan (el usuario las borró localmente).
    existing_map = {e.estructura_id: e for e in v.discontinuidades}
    existing_by_num = {e.numero_estructura: e for e in v.discontinuidades}
    incoming_ids = set()

    for idx, d in enumerate(data.discontinuidades, start=1):
        tipo_id = resolver.tipo_estructura_id(d.tipo) if d.tipo and str(d.tipo) not in ("-1", "-1.0") else None
        if d.tipo and str(d.tipo) not in ("-1", "-1.0") and tipo_id is None:
            raise HTTPException(status_code=400, detail=f"Tipo estructura '{d.tipo}' no encontrado en GEMA")
        fam_computed = math.ceil(idx / 3.0)

        e = None
        if d.estructura_id and d.estructura_id in existing_map:
            e = existing_map[d.estructura_id]
        elif idx in existing_by_num:
            e = existing_by_num[idx]
        if e is None:
            e = models.EstructuraGeologica(ventana_id=v.ventana_id)
            db.add(e)
        if e.estructura_id:
            incoming_ids.add(e.estructura_id)

        e.numero_estructura = idx
        e.familia_id = fam_computed
        e.tipo_estructura_id = tipo_id
        e.dip = clean(d.dip); e.dip_dir = clean(d.dipdir)
        e.distancia_estructura = clean(d.dist)
        e.abertura_mm = clean(d.aber); e.espesor_mm = clean(d.esp)
        e.continuidad_m = clean(d.cont); e.espaciamiento_m = clean(d.espac)
        e.numero_estructuras = clean(d.nstr)
        e.numero_extremos_visibles = clean(d.next)
        e.terminacion = clean(d.term)
        e.tipo_relleno_1 = clean_relleno(d.r1)
        e.tipo_relleno_2 = clean_relleno(d.r2)
        e.jrc = clean(d.jrc)
        e.rugosidad_estructura = str(d.rug) if d.rug is not None and str(d.rug) not in ("-1", "-1.0") else None
        e.forma_estructura = d.forma if d.forma and str(d.forma) not in ("-1", "-1.0") else None
        e.alteracion = d.alt if d.alt and str(d.alt) not in ("-1", "-1.0") else None

    for old_id, e in existing_map.items():
        if old_id not in incoming_ids:
            db.delete(e)

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
    # Borrar discontinuidades asociadas (la FK no tiene ON DELETE CASCADE)
    for est in list(v.discontinuidades):
        db.delete(est)
    # Borrar ensayos PLT asociados a la ventana (si existen)
    for plt in db.query(models.EnsayoPLT).filter(models.EnsayoPLT.ventana_id == v.ventana_id).all():
        db.delete(plt)
    db.delete(v)
    db.commit()
    return {"status": "success", "message": f"Ventana {code_up} eliminada de GEMA"}


@router.put("/ventanas/{codigo}/rename")
def rename_ventana(codigo: str, payload: Dict[str, str], db: Session = Depends(get_db)):
    old_code = codigo.strip().upper()
    new_code = payload.get("new_codigo", "").strip().upper()
    
    if not new_code:
        raise HTTPException(status_code=400, detail="El nuevo nombre de celda no puede estar vacío.")
    
    if old_code == new_code:
        return {"status": "ok", "message": "El nombre es idéntico, no se requiere cambio.", "old_codigo": old_code, "new_codigo": new_code}
    
    # Verificar si new_code ya existe en la BD SQL Server
    exists = db.query(models.Ventana).filter(models.Ventana.codigo_celda == new_code).first()
    if exists:
        raise HTTPException(status_code=400, detail=f"La celda con el código '{new_code}' ya existe en SQL Server.")
    
    v = db.query(models.Ventana).filter(models.Ventana.codigo_celda == old_code).first()
    if not v:
        # Si la celda aún no ha sido persistida en SQL Server (solo existe localmente)
        return {"status": "ok", "message": "Renombrado local completado.", "old_codigo": old_code, "new_codigo": new_code}
    
    v.codigo_celda = new_code
    db.commit()
    return {"status": "ok", "message": f"Celda renombrada de '{old_code}' a '{new_code}'.", "old_codigo": old_code, "new_codigo": new_code}


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
        "INTEMPERISMO", "Lito1", "Lito2", "Lito3", "Unidad", "AlturaMapeo", "Fase", "Mapeador",
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
            data.alteracion or data.altura_mapeo, data.fase, data.mapeador,
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
    v.altura = data.altura if data.altura is not None else data.altura_m
    v.dip = data.dip if data.dip is not None else data.dip_hw
    v.azimut_hole = data.azimut_hole if data.azimut_hole is not None else data.az_hw
    v.dip_talud = data.dip_talud; v.dip_dir_talud = data.dipdir_talud
    v.litologia1_id = resolver.litologia_id(data.lito_1) if data.lito_1 else None
    v.litologia2_id = resolver.litologia_id(data.lito_2) if data.lito_2 else None
    v.litologia3_id = resolver.litologia_id(data.lito_3) if data.lito_3 else None
    v.unidad_litologica_id = resolver.unidad_litologica_id(data.unidad_litologica) if data.unidad_litologica else None
    v.grado_intemperismo = data.intemperismo
    raw_alt_zona = data.alteracion or data.altura_mapeo or data.alteracion_codigo
    v.alteracion = raw_alt_zona.lower().strip() if raw_alt_zona else None
    v.altura_mapeo = data.altura_mapeo
    v.fase = data.fase
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
        tipo_id = resolver.tipo_estructura_id(d.tipo) if d.tipo and str(d.tipo) not in ("-1", "-1.0") else None
        e = models.EstructuraGeologica(
            ventana_id=v.ventana_id,
            numero_estructura=idx,
            tipo_estructura_id=tipo_id,
            dip=clean(d.dip), dip_dir=clean(d.dipdir),
            distancia_estructura=clean(d.dist),
            abertura_mm=clean(d.aber),
            espesor_mm=clean(d.esp),
            continuidad_m=clean(d.cont),
            espaciamiento_m=clean(d.espac),
            numero_estructuras=clean(d.nstr),
            numero_extremos_visibles=clean(d.next),
            terminacion=clean(d.term),
            tipo_relleno_1=clean_relleno(d.r1),
            tipo_relleno_2=clean_relleno(d.r2),
            jrc=clean(d.jrc),
            rugosidad_estructura=str(d.rug) if d.rug is not None and str(d.rug) not in ("-1", "-1.0") else None,
            forma_estructura=d.forma if d.forma and str(d.forma) not in ("-1", "-1.0") else None,
            alteracion=d.alt if d.alt and str(d.alt) not in ("-1", "-1.0") else None,
            familia_id=d.fam,

            # Proyección 3D
            teta=clean(d.teta),
            alfa=clean(d.alfa),
            x=clean(d.x),
            y=clean(d.y),
            z=clean(d.z),

            # Sub-ratings RMR '76
            valor_alteracion_cd76=clean(d.altR76),
            valor_relleno_cd76=clean(d.relR76),
            continuidad_cd76=clean(d.contR76),
            abertura_cd76=clean(d.abR76),
            rugosidad_cd76=clean(d.rugR76),
            valor_condicion_cd76=clean(d.totalR76),

            # Sub-ratings RMR '89
            valor_alteracion_cd89=clean(d.altR89),
            valor_relleno_cd89=clean(d.relR89),
            continuidad_cd89=clean(d.contR89),
            abertura_cd89=clean(d.abR89),
            rugosidad_cd89=clean(d.rugR89),
            valor_condicion_cd89=clean(d.totalR89),
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