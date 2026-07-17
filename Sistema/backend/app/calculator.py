import math
from app.core.catalogs import (
    RESISTENCIA_RATING_CATALOG as RESISTENCIA_RATING,
    CONDICION_AGUA_CATALOG as AGUA_RATING,
    ALTERACION_RATING_CATALOG as ALTERACION_RATING,
    RUGOSIDAD_RATING_CATALOG as RUGOSIDAD_RATING,
    RELLENO_TIPO,
    RELLENO_VALORES
)

def get_abertura_rating(aber):
    if aber is None:
        return {"r89": 0, "r76": 0}
    if aber == 0:
        return {"r89": 6, "r76": 5}
    elif aber < 0.1:
        return {"r89": 5, "r76": 4}
    elif aber < 1.0:
        return {"r89": 3, "r76": 3}
    elif aber <= 5.0:
        return {"r89": 1, "r76": 1}
    else:
        return {"r89": 0, "r76": 0}

def get_continuidad_rating(cont):
    if cont is None:
        return {"r89": 0, "r76": 0}
    if cont < 1.0:
        return {"r89": 6, "r76": 5}
    elif cont < 3.0:
        return {"r89": 4, "r76": 4}
    elif cont < 10.0:
        return {"r89": 2, "r76": 3}
    elif cont <= 20.0:
        return {"r89": 1, "r76": 1}
    else:
        return {"r89": 0, "r76": 0}

def get_relleno_comb_code(tipo_code, espesor):
    if tipo_code is None or tipo_code == "":
        return None
    r_type = RELLENO_TIPO.get(str(tipo_code).strip().lower())
    if not r_type:
        return None
    if r_type == 3:
        return 5 # Sin relleno
    if espesor is None:
        return None
    
    es_menor_5 = espesor < 5.0
    if r_type == 1: # Duro
        return 1 if es_menor_5 else 2
    if r_type == 2: # Blando
        return 3 if es_menor_5 else 4
    return None

def get_relleno_rating(comb_code):
    if not comb_code:
        return {"r89": None, "r76": None}
    val = RELLENO_VALORES.get(comb_code)
    if val:
        return val
    return {"r89": None, "r76": None}

def get_spacing_rating(espac):
    if espac is None:
        return {"r89": 0, "r76": 0}
    
    # R76 Lookup
    if espac < 0.05 - 1e-9:
        r76 = 5
    elif espac < 0.3 - 1e-9:
        r76 = 10
    elif espac < 1.0 - 1e-9:
        r76 = 20
    elif espac < 3.0 - 1e-9:
        r76 = 25
    else:
        r76 = 30

    # R89 Lookup
    if espac < 0.06 - 1e-9:
        r89 = 5
    elif espac < 0.2 - 1e-9:
        r89 = 8
    elif espac < 0.6 - 1e-9:
        r89 = 10
    elif espac < 2.0 - 1e-9:
        r89 = 15
    else:
        r89 = 20
        
    return {"r89": r89, "r76": r76}

def get_rqd_rating(rqd_pct):
    if rqd_pct is None:
        return {"r89": 0, "r76": 0}
    
    # Redondear directamente a entero para evaluación discreta (lógica Excel)
    rqd_int = int(round(rqd_pct))
    
    # R76 Lookup (Discrete)
    if rqd_int < 25:
        r76 = 3
    elif rqd_int < 50:
        r76 = 8
    elif rqd_int < 75:
        r76 = 13
    elif rqd_int < 90:
        r76 = 17
    else:
        r76 = 20
        
    # R89 Polynomial Cubic Formula
    if 0 <= rqd_pct <= 100:
        r89 = (-0.000006 * (rqd_pct ** 3)) + (0.0015 * (rqd_pct ** 2)) + (0.0806 * rqd_pct) + 3.0282
    else:
        r89 = 0
        
    return {"r89": r89, "r76": r76}

def acot(val: float) -> float:
    if val == 0:
        return math.pi / 2
    atan_val = math.atan(1.0 / val)
    return math.pi + atan_val if val < 0 else atan_val

def calculate_geomechanics(header, discontinuidades, rmr_input):
    h_ini_x = header.get("este_ini")
    h_ini_y = header.get("norte_ini")
    h_ini_z = header.get("cota_ini")
    h_fin_x = header.get("este_fin")
    h_fin_y = header.get("norte_fin")
    h_fin_z = header.get("cota_fin")
    
    largo = header.get("largo_m")
    
    if largo is not None:
        largo = int(round(float(largo)))
    
    has_coords = all(v is not None for v in [h_ini_x, h_ini_y, h_ini_z, h_fin_x, h_fin_y, h_fin_z])
    dx, dy, dz = 0.0, 0.0, 0.0
    scan_len = 0.0
    teta, alfa = 0.0, 0.0
    
    if has_coords:
        dx = float(h_fin_x - h_ini_x)
        dy = float(h_fin_y - h_ini_y)
        dz = float(h_fin_z - h_ini_z)
        scan_len = math.sqrt(dx**2 + dy**2 + dz**2)
        if scan_len > 0:
            teta = acot(dy / dx) if dx != 0 else (math.pi / 2 if dy >= 0 else 1.5 * math.pi)
            alfa = 0.0 if dz == 0 else acot(dx / dz)
            
        if largo is None or largo == 0:
            largo = scan_len

    family_spacings = {1: [], 2: [], 3: []}
    rows_calculated = []
    
    for row in discontinuidades:
        fam = row.get("fam")
        espac = row.get("espac")        
        nstr = row.get("nstr")
        if nstr is None or nstr == -1:
            nstr = 0
        
        alt_code = row.get("alt")
        alt_rating = ALTERACION_RATING.get(alt_code, {"r89": 0, "r76": 0})
        
        c1 = get_relleno_comb_code(row.get("r1"), row.get("esp"))
        c2 = get_relleno_comb_code(row.get("r2"), row.get("esp"))
        
        r1_rating = get_relleno_rating(c1)
        r2_rating = get_relleno_rating(c2)
        
        r_r89, r_r76 = 0, 0
        if r1_rating["r89"] is not None and r2_rating["r89"] is not None:
            r_r89 = min(r1_rating["r89"], r2_rating["r89"])
            r_r76 = min(r1_rating["r76"], r2_rating["r76"])
        elif r1_rating["r89"] is not None:
            r_r89 = r1_rating["r89"]
            r_r76 = r1_rating["r76"]
        elif r2_rating["r89"] is not None:
            r_r89 = r2_rating["r89"]
            r_r76 = r2_rating["r76"]
            
        cont_rating = get_continuidad_rating(row.get("cont"))
        aber_rating = get_abertura_rating(row.get("aber"))
        rug_rating = RUGOSIDAD_RATING.get(row.get("rug"), {"r89": 0, "r76": 0})
        
        v89 = alt_rating["r89"] + r_r89 + cont_rating["r89"] + aber_rating["r89"] + rug_rating["r89"]
        v76 = alt_rating["r76"] + r_r76 + cont_rating["r76"] + aber_rating["r76"] + rug_rating["r76"]
        
        dist = row.get("dist")
        wx, wy, wz = 0.0, 0.0, 0.0
        if has_coords and dist is not None:
            wx = float(dist) * math.sin(teta) + float(h_ini_x)
            wy = float(dist) * math.cos(teta) + float(h_ini_y)
            wz = float(dist) * math.cos(teta) * math.sin(alfa) + float(h_ini_z)
            
        rows_calculated.append({
            "row": row, "alt_r89": alt_rating["r89"], "alt_r76": alt_rating["r76"],
            "relleno_r89": r_r89, "relleno_r76": r_r76, "cont_r89": cont_rating["r89"],
            "cont_r76": cont_rating["r76"], "aber_r89": aber_rating["r89"], "aber_r76": aber_rating["r76"],
            "rug_r89": rug_rating["r89"], "rug_r76": rug_rating["r76"], "v89": v89, "v76": v76,
            "wx": wx, "wy": wy, "wz": wz, "teta": teta, "alfa": alfa
        })
        
        if fam in family_spacings and espac is not None and espac > 0:
            family_spacings[fam].append((espac, nstr))

    proms = {1: None, 2: None, 3: None}
    jv = 0.0
    for f in [1, 2, 3]:
        spacings = family_spacings[f]
        if spacings:
            sum_pond = sum(sp * n for sp, n in spacings)
            sum_n = sum(n for sp, n in spacings)
            if sum_n > 0:
                p_val = sum_pond / sum_n
                proms[f] = p_val
                jv += 1.0 / p_val

    rqd_pct = max(0.0, min(100.0, 115.0 - 3.3 * jv)) if jv > 0 else 100.0
    rqd_ratings = get_rqd_rating(rqd_pct)
    
    all_spacings = []
    for row in discontinuidades:
        esp = row.get("espac")
        if esp is not None and esp > 0:
            n = row.get("nstr")
            if n is None or n == -1:
                n = 0
            all_spacings.append((esp, n))

    sum_espac = sum(sp * n for sp, n in all_spacings)
    sum_n_espac = sum(n for sp, n in all_spacings)
    espac_prom = sum_espac / sum_n_espac if sum_n_espac > 0 else 0.5
    spacing_ratings = get_spacing_rating(espac_prom)
    
    sum_v89 = 0.0
    sum_v76 = 0.0
    sum_n_cond = 0.0
    for r in rows_calculated:
        n = r["row"].get("nstr")
        if n is None or n == -1:
            n = 0
        sum_v89 += r["v89"] * n
        sum_v76 += r["v76"] * n
        sum_n_cond += n
    
    condisc_r89 = sum_v89 / sum_n_cond if sum_n_cond > 0 else 25.0
    condisc_r76 = sum_v76 / sum_n_cond if sum_n_cond > 0 else 20.0

    w_code = rmr_input.get("agua_codigo") or "C"
    w_ratings = AGUA_RATING.get(w_code, {"r89": 15, "r76": 10})
    
    # Código de resistencia obtenido directamente de la estimación de campo (ISRM R0-R6)
    res_code = rmr_input.get("resistencia_codigo") or "R4"

    # Obtención del rating unificado desde las constantes compartidas
    res_ratings = RESISTENCIA_RATING.get(res_code, {"r89": 7, "r76": 7})

    rmr_76 = round(w_ratings["r76"] + res_ratings["r76"] + rqd_ratings["r76"] + spacing_ratings["r76"] + condisc_r76)
    rmr_89 = round(w_ratings["r89"] + res_ratings["r89"] + rqd_ratings["r89"] + spacing_ratings["r89"] + condisc_r89)
    
    return {
        "largo_m": largo, "proms": proms, "jv": jv, "rqd_pct": rqd_pct,
        "rqd_r89": rqd_ratings["r89"], "rqd_r76": rqd_ratings["r76"],
        "espac_prom": espac_prom, "spacing_r89": spacing_ratings["r89"], "spacing_r76": spacing_ratings["r76"],
        "condisc_r89": condisc_r89, "condisc_r76": condisc_r76,
        "rmr_76": rmr_76, "rmr_89": rmr_89,
        "agua_r76": w_ratings["r76"], "agua_r89": w_ratings["r89"],
        "resist_r76": res_ratings["r76"], "resist_r89": res_ratings["r89"],
        "rows": rows_calculated,
    }