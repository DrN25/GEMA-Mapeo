import numpy as np
from scipy.interpolate import CubicSpline, PchipInterpolator

# -------------------------------------------------------------------
# 1. RATING PROMEDIO DE RQD (R2)
# -------------------------------------------------------------------
_puntos_rqd = np.array([
    0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50,
    55, 60, 65, 70, 75, 80, 85, 90, 95, 100
])
_puntos_rating_rqd = np.array([
    3.000, 3.384, 3.873, 4.437, 5.068, 5.762, 6.511, 7.310, 8.154, 9.036, 9.953,
    10.899, 11.870, 12.861, 13.867, 14.886, 15.912, 16.944, 17.976, 19.007, 20.000
])
_curva_rqd = CubicSpline(_puntos_rqd, _puntos_rating_rqd, bc_type="natural")


def rating_discreto_rqd(rqd):
    rqd = np.asarray(rqd, dtype=float)
    r = np.zeros_like(rqd)
    r[rqd < 25] = 3
    r[(rqd >= 25) & (rqd < 50)] = 8
    r[(rqd >= 50) & (rqd < 75)] = 13
    r[(rqd >= 75) & (rqd < 90)] = 17
    r[rqd >= 90] = 20
    return r


def rating_continuo_rqd(rqd):
    rqd = np.asarray(rqd, dtype=float)
    return np.clip(_curva_rqd(np.clip(rqd, 0, 100)), 0, 20)


def rating_promedio_rqd(rqd):
    """
    Devuelve el rating promedio de RQD para un porcentaje de RQD dado.
    """
    d = rating_discreto_rqd(rqd)
    c = rating_continuo_rqd(rqd)
    return np.round((d + c) / 2, 2)


# -------------------------------------------------------------------
# 2. RATING PROMEDIO DE RESISTENCIA (R1)
# -------------------------------------------------------------------
_puntos_ucs = np.array([0,  20,  40,  60,  80,  100, 120, 140, 160, 180, 200, 220, 240, 260])
_puntos_rating_ucs = np.array([1,  3.0, 4.7, 6.3, 8.1, 9.5, 10.9, 12.0, 13.0, 13.6, 14.2, 14.6, 15.0, 15.0])
_curva_r1 = PchipInterpolator(_puntos_ucs, _puntos_rating_ucs)


def rating_discreto_r1(ucs):
    ucs = np.asarray(ucs, dtype=float)
    r = np.zeros_like(ucs)
    r[ucs > 250] = 15
    r[(ucs > 100) & (ucs <= 250)] = 12
    r[(ucs > 50)  & (ucs <= 100)] = 7
    r[(ucs > 25)  & (ucs <= 50)]  = 4
    r[(ucs > 5)   & (ucs <= 25)]  = 2
    r[(ucs > 1)   & (ucs <= 5)]   = 1
    r[ucs <= 1] = 0
    return r


def rating_continuo_r1(ucs):
    ucs = np.asarray(ucs, dtype=float)
    return np.clip(_curva_r1(np.clip(ucs, 0, 260)), 0, 15)


def rating_promedio_r1(ucs):
    """
    Devuelve el rating promedio de Resistencia para un valor de UCS dado.
    """
    d = rating_discreto_r1(ucs)
    c = rating_continuo_r1(ucs)
    return np.round((d + c) / 2, 2)
