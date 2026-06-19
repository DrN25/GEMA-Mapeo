import math

# CONSTANTS AND LOOKUPS FROM RMR SHEET

RESISTENCIA_RATING = {
    "R6": {"r89": 15, "r76": 15},
    "R5": {"r89": 12, "r76": 12},
    "R4": {"r89": 7, "r76": 7},
    "R3": {"r89": 4, "r76": 4},
    "R2": {"r89": 2, "r76": 2},
    "R1": {"r89": 1, "r76": 1},
    "R0": {"r89": 0, "r76": 0},
}

AGUA_RATING = {
    "C": {"r89": 15, "r76": 10},
    "H": {"r89": 10, "r76": 10},
    "M": {"r89": 7, "r76": 7},
    "E": {"r89": 4, "r76": 4},
    "F": {"r89": 0, "r76": 0},
}

ALTERACION_RATING = {
    "f": {"r89": 6, "r76": 5},
    "d": {"r89": 5, "r76": 5},
    "m": {"r89": 3, "r76": 4},
    "a": {"r89": 3, "r76": 3},
    "c": {"r89": 2, "r76": 2},
    "s": {"r89": 1, "r76": 1},
}

RUGOSIDAD_RATING = {
    1: {"r89": 6, "r76": 5},
    2: {"r89": 5, "r76": 4},
    3: {"r89": 5, "r76": 4},
    4: {"r89": 3, "r76": 2},
    5: {"r89": 3, "r76": 2},
    6: {"r89": 1, "r76": 0},
    7: {"r89": 1, "r76": 0},
    8: {"r89": 0, "r76": 0},
    9: {"r89": 0, "r76": 0},
}

RELLENO_TIPO = {
    "cwf": 3,
    "si": 1,
    "sf": 1,
    "ep": 1,
    "ox": 1,
    "g": 2,
    "cl": 2,
    "ca": 2,
}

RELLENO_VALORES = {
    1: {"r89": 4, "r76": 4}, # Duro < 5mm
    2: {"r89": 2, "r76": 3}, # Duro >= 5mm
    3: {"r89": 2, "r76": 2}, # Blando < 5mm
    4: {"r89": 0, "r76": 0}, # Blando >= 5mm
    5: {"r89": 6, "r76": 5}, # Sin relleno (cwf)
}

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
    if not tipo_code or tipo_code == "-1":
        return None
    r_type = RELLENO_TIPO.get(tipo_code)
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
    if espac < 0.05:
        r76 = 5
    elif espac < 0.3:
        r76 = 10
    elif espac < 1.0:
        r76 = 20
    elif espac <= 3.0:
        r76 = 25
    else:
        r76 = 30

    # R89 Lookup
    if espac < 0.06:
        r89 = 5
    elif espac < 0.2:
        r89 = 8
    elif espac < 0.6:
        r89 = 10
    elif espac < 2.0:
        r89 = 15
    else:
        r89 = 20
        
    return {"r89": r89, "r76": r76}

def get_rqd_rating(rqd_pct):
    if rqd_pct is None:
        return {"r89": 0, "r76": 0}
    
    # R76 Lookup (Discrete)
    if rqd_pct < 25:
        r76 = 3
    elif rqd_pct < 50:
        r76 = 8
    elif rqd_pct < 75:
        r76 = 13
    elif rqd_pct < 90:
        r76 = 17
    else:
        r76 = 20
        
    # R89 Polynomial Cubic Formula
    # Rating = -0.000006 * RQD^3 + 0.0015 * RQD^2 + 0.0806 * RQD + 3.0282
    if 0 <= rqd_pct <= 100:
        r89 = (-0.000006 * (rqd_pct ** 3)) + (0.0015 * (rqd_pct ** 2)) + (0.0806 * rqd_pct) + 3.0282
    else:
        r89 = 0
    return {"r89": r89, "r76": r76}


# CALCULATION MAIN FUNCTION

def calculate_geomechanics(header, discontinuidades, rmr_input):
    """
    Calcula todos los parámetros RMR76, RMR89, coordenadas, promedios y Jv de la ventana.
    """
    # 1. Calc window length if coords are fully present
    h_ini_x = header.get("este_ini")
    h_ini_y = header.get("norte_ini")
    h_ini_z = header.get("cota_ini")
    h_fin_x = header.get("este_fin")
    h_fin_y = header.get("norte_fin")
    h_fin_z = header.get("cota_fin")
    
    largo = header.get("largo_m")
    
    # 1. Asegurar redondeo estricto del largo en Python
    if largo is not None:
        largo = int(round(float(largo)))
    
    # Vector unitario 3D de la línea de detalle
    has_coords = all(v is not None for v in [h_ini_x, h_ini_y, h_ini_z, h_fin_x, h_fin_y, h_fin_z])
    dx, dy, dz = 0.0, 0.0, 0.0
    ux, uy, uz = 0.0, 0.0, 0.0
    scan_len = 0.0
    teta, alfa = 0.0, 0.0
    
    if has_coords:
        dx = float(h_fin_x - h_ini_x)
        dy = float(h_fin_y - h_ini_y)
        dz = float(h_fin_z - h_ini_z)
        scan_len = math.sqrt(dx**2 + dy**2 + dz**2)
        if scan_len > 0:
            ux = dx / scan_len
            uy = dy / scan_len
            uz = dz / scan_len
            # teta and alfa matching spreadsheet logic
            teta = math.atan2(dx, dy) if dy != 0 else (0.0 if dx >= 0 else math.pi)
            alfa = math.atan2(dx, dz) if dz != 0 else 0.0
        if largo is None or largo == 0:
            largo = scan_len

    # 2. Spacing promedios per family
    family_spacings = {1: [], 2: [], 3: []}
    rows_calculated = []
    
    for row in discontinuidades:
        fam = row.get("fam")
        espac = row.get("espac")        
        nstr = row.get("nstr")
        if nstr is None or nstr == -1:
            nstr = 0
        
        # Calculate row-level ratings
        alt_code = row.get("alt")
        alt_rating = ALTERACION_RATING.get(alt_code, {"r89": 0, "r76": 0})
        
        c1 = get_relleno_comb_code(row.get("r1"), row.get("esp"))
        c2 = get_relleno_comb_code(row.get("r2"), row.get("esp"))
        
        r1_rating = get_relleno_rating(c1)
        r2_rating = get_relleno_rating(c2)
        
        # Min relleno score
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
        
        # Row totals
        v89 = alt_rating["r89"] + r_r89 + cont_rating["r89"] + aber_rating["r89"] + rug_rating["r89"]
        v76 = alt_rating["r76"] + r_r76 + cont_rating["r76"] + aber_rating["r76"] + rug_rating["r76"]
        
        # Row UTM coords
        dist = row.get("dist")
        wx, wy, wz = 0.0, 0.0, 0.0
        if has_coords and dist is not None:
            wx = float(h_ini_x) + float(dist) * ux
            wy = float(h_ini_y) + float(dist) * uy
            wz = float(h_ini_z) + float(dist) * uz
            
        rows_calculated.append({
            "row": row,
            "alt_r89": alt_rating["r89"],
            "alt_r76": alt_rating["r76"],
            "relleno_r89": r_r89,
            "relleno_r76": r_r76,
            "cont_r89": cont_rating["r89"],
            "cont_r76": cont_rating["r76"],
            "aber_r89": aber_rating["r89"],
            "aber_r76": aber_rating["r76"],
            "rug_r89": rug_rating["r89"],
            "rug_r76": rug_rating["r76"],
            "v89": v89,
            "v76": v76,
            "wx": wx,
            "wy": wy,
            "wz": wz,
            "teta": teta,
            "alfa": alfa
        })
        
        if fam in family_spacings and espac is not None and espac > 0:
            family_spacings[fam].append((espac, nstr))

    # Calculate Promedios by family (Weighted Average: Sum(espac*nstr)/Sum(nstr))
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

    # 3. RQD estimation and ratings
    rqd_pct = max(0.0, min(100.0, 115.0 - 3.3 * jv)) if jv > 0 else 100.0
    rqd_ratings = get_rqd_rating(rqd_pct)
    
    # 4. Spacing rating
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
    espac_prom = sum_espac / sum_n_espac if sum_n_espac > 0 else 0.5 # fallback default
    spacing_ratings = get_spacing_rating(espac_prom)
    
    # 5. Condition average rating (weighted by nstr)
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

    # 6. Global Water and UCS Ratings
    w_code = rmr_input.get("agua_codigo", "C")
    w_ratings = AGUA_RATING.get(w_code, {"r89": 15, "r76": 10})
    
    res_code = rmr_input.get("resistencia_codigo", "R4")
    res_ratings = RESISTENCIA_RATING.get(res_code, {"r89": 7, "r76": 7})

    # 7. Final RMR sums
    rmr_76 = round(w_ratings["r76"] + res_ratings["r76"] + rqd_ratings["r76"] + spacing_ratings["r76"] + condisc_r76)
    rmr_89 = round(w_ratings["r89"] + res_ratings["r89"] + rqd_ratings["r89"] + spacing_ratings["r89"] + condisc_r89)
    
    return {
        "largo_m": largo,
        "proms": proms,
        "jv": jv,
        "rqd_pct": rqd_pct,
        "rqd_r89": rqd_ratings["r89"],
        "rqd_r76": rqd_ratings["r76"],
        "espac_prom": espac_prom,
        "spacing_r89": spacing_ratings["r89"],
        "spacing_r76": spacing_ratings["r76"],
        "condisc_r89": condisc_r89,
        "condisc_r76": condisc_r76,
        "rmr_76": rmr_76,
        "rmr_89": rmr_89,
        "agua_r76": w_ratings["r76"],
        "agua_r89": w_ratings["r89"],
        "resist_r76": res_ratings["r76"],
        "resist_r89": res_ratings["r89"],
        "rows": rows_calculated,
    }
