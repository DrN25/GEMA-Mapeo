"""GSI subgraph of the existing editor, with JS-compatible positive rounding.

Deliberately does not change the persistence calculator's other RMR formulas.
"""
from collections import defaultdict
import math
from app.core.catalogs import ALTERACION_RATING_CATALOG, RUGOSIDAD_RATING_CATALOG, RELLENO_TIPO, RELLENO_VALORES
from .normalization import number, js_round


def geometry(header):
    start=[number(header.get(k+'_from'),sentinel=False) for k in ('este','norte','cota')]
    end=[number(header.get(k+'_to'),sentinel=False) for k in ('este','norte','cota')]
    if any(x is None for x in start+end):return None
    length=math.dist(start,end)
    if not math.isfinite(length) or length <= 0:return None
    dx,dy,dz=(end[i]-start[i] for i in range(3))
    azimuth=math.degrees(math.atan2(dx,dy)) % 360
    return {'length_m':length,'dip_hw':math.degrees(math.asin(max(-1,min(1,-dz/length)))),
            'az_hw':azimuth,'dipdir_talud':(azimuth+90)%360}


def filling(code, thickness):
    if not code or str(code).strip() == '-1':
        return None
    material = RELLENO_TIPO.get(str(code).strip().lower())
    if material is None:
        return None
    if material == 3:
        return RELLENO_VALORES[5]['r89']
    # UI base score is used for zero/missing thickness and thickness <5 mm.
    combination = (1 if material == 2 else 3) + (1 if thickness is not None and thickness >= 5 else 0)
    return RELLENO_VALORES[combination]['r89']


def effective_gsi(joints):
    families = defaultdict(list)
    weighted, count = 0, 0
    for row in joints:
        n = number(row.get('n_estructuras'))
        n = n if n is not None and n > 0 else 1
        spacing = number(row.get('espaciamiento'))
        spacing = spacing if spacing is not None and spacing > 0 else .40 / n
        fam = number(row.get('familia'))
        # Family spacing derivation requires an actual positive count if no spacing.
        original_sp = number(row.get('espaciamiento'))
        original_n = number(row.get('n_estructuras'))
        if fam is not None and 1 <= fam <= 9 and ((original_sp is not None and original_sp > 0) or (original_n is not None and original_n > 0)):
            families[fam].append(spacing)
        alt = ALTERACION_RATING_CATALOG.get(row.get('alteracion'), {}).get('r89')
        rug = RUGOSIDAD_RATING_CATALOG.get(number(row.get('rugosidad')), {}).get('r89')
        cont, aperture = number(row.get('continuidad')), number(row.get('abertura'))
        cont_rating = None if cont is None else 6 if cont < 1 else 4 if cont < 3 else 2 if cont < 10 else 1 if cont < 20 else 0
        aperture_rating = None if aperture is None else 6 if aperture <= 0 else 5 if aperture < .1 else 3 if aperture < 1 else 1 if aperture < 5 else 0
        ratings = [filling(row.get(k), number(row.get('espesor'))) for k in ('relleno1', 'relleno2')]
        # The old editor returns an object with null ratings for a supplied '-1'.
        supplied = [r if r is not None else 99 for k, r in zip(('relleno1', 'relleno2'), ratings) if row.get(k)]
        fill = min(supplied) if len(supplied) == 2 else ratings[0] if row.get('relleno1') else ratings[1]
        components = [alt, rug, cont_rating, aperture_rating, fill]
        if all(x is not None for x in components):
            weighted += min(30, sum(components)) * n
            count += n
    averages = [js_round(sum(v) / len(v), 4) for v in families.values()]
    jv = js_round(sum(1 / x for x in averages if x > 0), 4)
    rqd = js_round(max(0, min(100, 115 - 3.3 * jv)) if jv > 0 else 0, 2)
    condition = js_round(weighted / count, 2) if count else 0
    return {'gsi_visual': min(85, js_round(1.5 * condition + rqd / 2)), 'rqd_est': rqd, 'condicion_rating_89': condition}
