// Generatori di rilievo: ognuno restituisce Float32Array (nx*ny) con valori 0..1.
// Coordinate in mm, origine al centro della cover, y verso l'alto (vista da dietro).

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a || 1e-6)); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);

function hash2(ix, iy, seed) {
  let h = ix * 374761393 + iy * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}
function valueNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, seed) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += a * valueNoise(x * f, y * f, seed + i * 17); f *= 2; a *= 0.5; }
  return s / 0.9375;
}

function fill(g, fn) {
  const out = new Float32Array(g.nx * g.ny);
  let i = 0;
  for (let j = 0; j < g.ny; j++) {
    const y = g.y0 + j * g.cell;
    for (let k = 0; k < g.nx; k++, i++) out[i] = clamp01(fn(g.x0 + k * g.cell, y));
  }
  return out;
}
const rot = (x, y, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [x * c + y * s, -x * s + y * c]; };

export const PATTERNS = [
  { id: 'none', label: 'Liscio', icon: 'square', params: [], make: g => new Float32Array(g.nx * g.ny) },

  { id: 'labyrinth', label: 'Labirinto', icon: 'waypoints', tactile: true,
    params: [{ k: 'size', label: 'Larghezza linee', min: 1.6, max: 6, step: 0.1, v: 3, unit: 'mm' }, { k: 'sharp', label: 'Nitidezza', min: 0.05, max: 0.5, step: 0.01, v: 0.18 }],
    make(g, p, seed) { return grayScott(g, p.size, p.sharp, seed); } },

  { id: 'waves', label: 'Onde', icon: 'waves', tactile: true,
    params: [{ k: 'size', label: 'Periodo', min: 3, max: 24, step: 0.5, v: 9, unit: 'mm' }, { k: 'angle', label: 'Angolo', min: 0, max: 180, step: 1, v: 20, unit: '°' }, { k: 'mix', label: 'Interferenza', min: 0, max: 1, step: 0.05, v: 0.5 }],
    make: (g, p) => fill(g, (x, y) => {
      const [u, v] = rot(x, y, p.angle);
      const a = Math.sin(u / p.size * 2 * Math.PI + Math.sin(v / p.size * 1.3) * 2);
      const b = Math.sin((v + u * 0.5) / p.size * 2 * Math.PI * 0.8);
      return 0.5 + 0.5 * (a * (1 - p.mix * 0.5) + b * p.mix * 0.5);
    }) },

  { id: 'hex', label: 'Esagoni', icon: 'hexagon', tactile: true,
    params: [{ k: 'size', label: 'Dimensione', min: 3, max: 16, step: 0.5, v: 7, unit: 'mm' }, { k: 'gap', label: 'Solco', min: 0.4, max: 2.4, step: 0.1, v: 1, unit: 'mm' }],
    make: (g, p) => {
      const s = p.size / 2; // raggio
      return fill(g, (x, y) => {
        // coordinate assiali
        const q = (Math.sqrt(3) / 3 * x - y / 3) / s, r = (2 / 3 * y) / s;
        let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r);
        const dx = Math.abs(rx - q), dy = Math.abs(ry - (-q - r)), dz = Math.abs(rz - r);
        if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
        const cx = s * Math.sqrt(3) * (rx + rz / 2), cy = s * 1.5 * rz;
        const px = Math.abs(x - cx), py = Math.abs(y - cy);
        const apothem = s * Math.sqrt(3) / 2;
        const d = apothem - Math.max(px * Math.sqrt(3) / 2 + py / 2, py); // distanza dal bordo
        return smooth(p.gap / 2, p.gap / 2 + 0.6, d);
      });
    } },

  { id: 'knurl', label: 'Zigrinatura', icon: 'grid-3x3', tactile: true,
    params: [{ k: 'size', label: 'Passo', min: 1.5, max: 8, step: 0.1, v: 3.2, unit: 'mm' }, { k: 'angle', label: 'Angolo', min: 0, max: 90, step: 1, v: 45, unit: '°' }],
    make: (g, p) => fill(g, (x, y) => {
      const [u, v] = rot(x, y, p.angle);
      const fu = fract(u / p.size) - 0.5, fv = fract(v / p.size) - 0.5;
      return 1 - 2 * Math.max(Math.abs(fu), Math.abs(fv));
    }) },

  { id: 'dots', label: 'Punti', icon: 'circle-dot', tactile: true,
    params: [{ k: 'size', label: 'Passo', min: 2, max: 10, step: 0.1, v: 4, unit: 'mm' }, { k: 'fill', label: 'Diametro', min: 0.4, max: 0.98, step: 0.02, v: 0.8 }],
    make: (g, p) => fill(g, (x, y) => {
      const row = Math.floor(y / (p.size * 0.866));
      const ox = (row & 1) ? p.size / 2 : 0;
      const fx = ((x + ox) % p.size + p.size) % p.size - p.size / 2;
      const fy = (y - (row + 0.5) * p.size * 0.866);
      const r = Math.hypot(fx, fy) / (p.size * p.fill / 2);
      return r < 1 ? Math.sqrt(1 - r * r) : 0;
    }) },

  { id: 'ribs', label: 'Nervature', icon: 'align-justify', tactile: true,
    params: [{ k: 'size', label: 'Passo', min: 1.5, max: 10, step: 0.1, v: 3, unit: 'mm' }, { k: 'angle', label: 'Angolo', min: 0, max: 180, step: 1, v: 90, unit: '°' }],
    make: (g, p) => fill(g, (x, y) => {
      const [, v] = rot(x, y, p.angle);
      const f = fract(v / p.size) * 2 - 1;
      return Math.sqrt(Math.max(0, 1 - f * f));
    }) },

  { id: 'contour', label: 'Curve di livello', icon: 'mountain', tactile: true,
    params: [{ k: 'size', label: 'Scala', min: 15, max: 90, step: 1, v: 45, unit: 'mm' }, { k: 'lines', label: 'Linee', min: 4, max: 22, step: 1, v: 10 }, { k: 'width', label: 'Spessore', min: 0.1, max: 0.6, step: 0.01, v: 0.28 }],
    make: (g, p, seed) => fill(g, (x, y) => {
      const n = fbm(x / p.size * 2 + 11, y / p.size * 2 + 5, seed) * p.lines;
      const d = Math.abs(fract(n) - 0.5) * 2; // 0 al centro della banda
      return 1 - smooth(1 - p.width, 1 - p.width + 0.18, d) * 1;
    }) },

  { id: 'voronoi', label: 'Voronoi', icon: 'component', tactile: true,
    params: [{ k: 'size', label: 'Dimensione', min: 4, max: 24, step: 0.5, v: 10, unit: 'mm' }, { k: 'gap', label: 'Solco', min: 0.4, max: 2.4, step: 0.1, v: 1, unit: 'mm' }],
    make: (g, p, seed) => fill(g, (x, y) => {
      const gx = x / p.size, gy = y / p.size;
      const ix = Math.floor(gx), iy = Math.floor(gy);
      let d1 = 9, d2 = 9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = ix + i + 0.15 + 0.7 * hash2(ix + i, iy + j, seed), cy = iy + j + 0.15 + 0.7 * hash2(ix + i, iy + j, seed + 101);
        const d = Math.hypot(gx - cx, gy - cy);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      const edge = (d2 - d1) * p.size / 2; // approssimazione della distanza dal bordo
      return smooth(p.gap / 2, p.gap / 2 + 0.7, edge);
    }) },

  { id: 'image', label: 'Immagine', icon: 'image', raster: true, params: [], make: null },
  { id: 'text', label: 'Testo', icon: 'type', raster: true, params: [], make: null }
];

export const patternById = id => PATTERNS.find(p => p.id === id) || PATTERNS[0];
export function patternDefaults(id) {
  const o = {};
  for (const q of patternById(id).params) o[q.k] = q.v;
  return o;
}

// ---- Gray-Scott (labirinto/corallo) ----
let gsCache = { key: '', data: null };
function grayScott(g, stripe, sharp, seed) {
  const key = [g.nx, g.ny, g.cell, stripe, sharp, seed].join('|');
  if (gsCache.key === key) return gsCache.data;
  const cellMm = stripe / 4.5;
  const w = Math.max(24, Math.round(g.sx / cellMm)), h = Math.max(24, Math.round(g.sy / cellMm));
  let U = new Float32Array(w * h).fill(1), V = new Float32Array(w * h);
  let U2 = new Float32Array(w * h), V2 = new Float32Array(w * h);
  // semi iniziali
  const n = Math.round(w * h / 140);
  for (let s = 0; s < n; s++) {
    const cx = Math.floor(hash2(s, 1, seed) * w), cy = Math.floor(hash2(s, 2, seed) * h), r = 2 + Math.floor(hash2(s, 3, seed) * 2);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const xx = (cx + x + w) % w, yy = (cy + y + h) % h;
      U[yy * w + xx] = 0.5; V[yy * w + xx] = 0.25 + 0.05 * hash2(xx, yy, seed);
    }
  }
  const Du = 0.2097, Dv = 0.105, F = 0.029, K = 0.057;
  const iters = 3400;
  for (let it = 0; it < iters; it++) {
    for (let y = 0; y < h; y++) {
      const ym = ((y - 1 + h) % h) * w, yp = ((y + 1) % h) * w, yc = y * w;
      for (let x = 0; x < w; x++) {
        const xm = (x - 1 + w) % w, xp = (x + 1) % w, i = yc + x;
        const u = U[i], v = V[i];
        const lu = U[yc + xm] + U[yc + xp] + U[ym + x] + U[yp + x] - 4 * u;
        const lv = V[yc + xm] + V[yc + xp] + V[ym + x] + V[yp + x] - 4 * v;
        const uvv = u * v * v;
        U2[i] = u + Du * lu - uvv + F * (1 - u);
        V2[i] = v + Dv * lv + uvv - (F + K) * v;
      }
    }
    let t = U; U = U2; U2 = t; t = V; V = V2; V2 = t;
  }
  let mn = 1e9, mx = -1e9;
  for (let i = 0; i < V.length; i++) { if (V[i] < mn) mn = V[i]; if (V[i] > mx) mx = V[i]; }
  const mid = (mn + mx) / 2, span = (mx - mn) || 1;
  const out = new Float32Array(g.nx * g.ny);
  for (let j = 0; j < g.ny; j++) {
    const fy = (j / (g.ny - 1)) * (h - 1);
    const y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for (let i = 0; i < g.nx; i++) {
      const fx = (i / (g.nx - 1)) * (w - 1);
      const x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
      const v = (V[y0 * w + x0] * (1 - tx) + V[y0 * w + x1] * tx) * (1 - ty) + (V[y1 * w + x0] * (1 - tx) + V[y1 * w + x1] * tx) * ty;
      out[j * g.nx + i] = smooth(mid - sharp * span, mid + sharp * span, v);
    }
  }
  gsCache = { key, data: out };
  return out;
}
