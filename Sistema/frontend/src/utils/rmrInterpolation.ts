/**
 * Utilidades de interpolación para RMR'89 (RQD y Resistencia).
 * Implementa de forma desacoplada la interpolación CubicSpline natural
 * y PCHIP para los cálculos de promedio discreto-continuo.
 */

// -------------------------------------------------------------------
// 1. CLASE CUBIC SPLINE (Natural)
// -------------------------------------------------------------------
class CubicSpline {
  private x: number[];
  private a: number[];
  private b: number[];
  private c: number[];
  private d: number[];

  constructor(x: number[], y: number[]) {
    const n = x.length - 1;
    this.x = x;
    this.a = [...y];
    this.b = new Array(n).fill(0);
    this.c = new Array(n + 1).fill(0);
    this.d = new Array(n).fill(0);

    const h = new Array(n);
    for (let i = 0; i < n; i++) {
      h[i] = x[i + 1] - x[i];
    }

    const alpha = new Array(n);
    alpha[0] = 0;
    for (let i = 1; i < n; i++) {
      alpha[i] = (3 / h[i]) * (this.a[i + 1] - this.a[i]) - (3 / h[i - 1]) * (this.a[i] - this.a[i - 1]);
    }

    const l = new Array(n + 1).fill(0);
    const mu = new Array(n + 1).fill(0);
    const z = new Array(n + 1).fill(0);
    l[0] = 1;
    mu[0] = 0;
    z[0] = 0;

    for (let i = 1; i < n; i++) {
      l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
      mu[i] = h[i] / l[i];
      z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }

    l[n] = 1;
    z[n] = 0;
    this.c[n] = 0;

    for (let j = n - 1; j >= 0; j--) {
      this.c[j] = z[j] - mu[j] * this.c[j + 1];
      this.b[j] = (this.a[j + 1] - this.a[j]) / h[j] - (h[j] * (this.c[j + 1] + 2 * this.c[j])) / 3;
      this.d[j] = (this.c[j + 1] - this.c[j]) / (3 * h[j]);
    }
  }

  public interpolate(val: number): number {
    const n = this.x.length - 1;
    if (val <= this.x[0]) return this.a[0];
    if (val >= this.x[n]) return this.a[n];

    let low = 0, high = n;
    while (low < high - 1) {
      const mid = Math.floor((low + high) / 2);
      if (this.x[mid] <= val) low = mid;
      else high = mid;
    }
    const i = low;
    const dx = val - this.x[i];
    return this.a[i] + this.b[i] * dx + this.c[i] * dx * dx + this.d[i] * dx * dx * dx;
  }
}

// -------------------------------------------------------------------
// 2. FUNCIÓN PCHIP (Piecewise Cubic Hermite Interpolating Polynomial)
// -------------------------------------------------------------------
function interpolatePchip(x: number[], y: number[], val: number): number {
  const n = x.length;
  if (val <= x[0]) return y[0];
  if (val >= x[n - 1]) return y[n - 1];

  const h = new Array(n - 1);
  const s = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = x[i + 1] - x[i];
    s[i] = (y[i + 1] - y[i]) / h[i];
  }

  const d = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (s[i - 1] * s[i] <= 0) {
      d[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      d[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i]);
    }
  }

  // Condición de borde izquierda
  const d0 = ((2 * h[0] + h[1]) * s[0] - h[0] * s[1]) / (h[0] + h[1]);
  if (d0 * s[0] <= 0) {
    d[0] = 0;
  } else if (s[0] * s[1] < 0 && Math.abs(d0) > 3 * Math.abs(s[0])) {
    d[0] = 3 * s[0];
  } else {
    d[0] = d0;
  }

  // Condición de borde derecha
  const dn = ((2 * h[n - 2] + h[n - 3]) * s[n - 2] - h[n - 2] * s[n - 3]) / (h[n - 2] + h[n - 3]);
  if (dn * s[n - 2] <= 0) {
    d[n - 1] = 0;
  } else if (s[n - 2] * s[n - 3] < 0 && Math.abs(dn) > 3 * Math.abs(s[n - 2])) {
    d[n - 1] = 3 * s[n - 2];
  } else {
    d[n - 1] = dn;
  }

  // Encontrar el intervalo correspondiente
  let idx = 0;
  for (let i = 0; i < n - 1; i++) {
    if (val >= x[i] && val <= x[i + 1]) {
      idx = i;
      break;
    }
  }

  const dx = val - x[idx];
  const hi = h[idx];
  const si = s[idx];
  const di = d[idx];
  const dip1 = d[idx + 1];

  const c = (3 * si - 2 * di - dip1) / hi;
  const e = (di + dip1 - 2 * si) / (hi * hi);

  return y[idx] + di * dx + c * dx * dx + e * dx * dx * dx;
}

// -------------------------------------------------------------------
// 3. ANCLAJES RQD (Chart B)
// -------------------------------------------------------------------
const RQD_ANCHORS_X = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
const RQD_ANCHORS_Y = [3.000, 3.384, 3.873, 4.437, 5.068, 5.762, 6.511, 7.310, 8.154, 9.036, 9.953, 10.899, 11.870, 12.861, 13.867, 14.886, 15.912, 16.944, 17.976, 19.007, 20.000];
const RQD_SPLINE_INSTANCE = new CubicSpline(RQD_ANCHORS_X, RQD_ANCHORS_Y);

export function ratingDiscretoRqd(rqd: number): number {
  if (rqd < 25) return 3;
  if (rqd < 50) return 8;
  if (rqd < 75) return 13;
  if (rqd < 90) return 17;
  return 20;
}

export function ratingContinuoRqd(rqd: number): number {
  const interpolated = RQD_SPLINE_INSTANCE.interpolate(rqd);
  return Math.max(0, Math.min(20, interpolated));
}

export function ratingPromedioRqd(rqd: number): number {
  const d = ratingDiscretoRqd(rqd);
  const c = ratingContinuoRqd(rqd);
  return Math.round(((d + c) / 2) * 100) / 100;
}

// -------------------------------------------------------------------
// 4. ANCLAJES RESISTENCIA UCS (Chart A)
// -------------------------------------------------------------------
const UCS_ANCHORS_X = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260];
const UCS_ANCHORS_Y = [1.0, 3.0, 4.7, 6.3, 8.1, 9.5, 10.9, 12.0, 13.0, 13.6, 14.2, 14.6, 15.0, 15.0];

export function ratingDiscretoResistencia(ucs: number): number {
  if (ucs > 250) return 15;
  if (ucs > 100) return 12;
  if (ucs > 50) return 7;
  if (ucs > 25) return 4;
  if (ucs > 5) return 2;
  if (ucs > 1) return 1;
  return 0;
}

export function ratingContinuoResistencia(ucs: number): number {
  const interpolated = interpolatePchip(UCS_ANCHORS_X, UCS_ANCHORS_Y, ucs);
  return Math.max(0, Math.min(15, interpolated));
}

export function ratingPromedioResistencia(ucs: number): number {
  const d = ratingDiscretoResistencia(ucs);
  const c = ratingContinuoResistencia(ucs);
  return Math.round(((d + c) / 2) * 100) / 100;
}
