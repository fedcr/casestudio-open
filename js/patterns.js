// Generatori di rilievo. Ogni pattern restituisce Float32Array (nx*ny) con valori 0..1.
// Coordinate in mm, origine al centro della cover, y verso l'alto (vista da dietro).

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a || 1e-6)); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const tri = t => Math.abs(2 * fract(t) - 1);
const rib = f => { const u = 2 * fract(f) - 1; return Math.sqrt(Math.max(0, 1 - u * u)); };
const S3 = Math.sqrt(3);
const rot = (x, y, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [x * c + y * s, -x * s + y * c]; };

function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}
function vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, seed, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17); n += a; f *= 2; a *= 0.5; }
  return s / n;
}
const tile = (d, gap, bevel = 0.6) => smooth(gap / 2, gap / 2 + bevel, d);
const lineProfile = (d, w) => 1 - smooth(w / 2, w / 2 + 0.45, d);

function hexInfo(x, y, s) { // s = raggio; restituisce centro, id e distanza dal bordo
  const q = (S3 / 3 * x - y / 3) / s, r = (2 / 3 * y) / s;
  let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r);
  const dx = Math.abs(rx - q), dy = Math.abs(ry - (-q - r)), dz = Math.abs(rz - r);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  const cx = s * S3 * (rx + rz / 2), cy = s * 1.5 * rz;
  const px = Math.abs(x - cx), py = Math.abs(y - cy);
  const ap = s * S3 / 2;
  return { cx, cy, id: rx * 7919 + rz * 104729, d: ap - Math.max(px * S3 / 2 + py / 2, py) };
}
function worley(x, y, size, seed) {
  const gx = x / size, gy = y / size, ix = Math.floor(gx), iy = Math.floor(gy);
  let d1 = 9, d2 = 9, id = 0, cx = 0, cy = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const px = ix + i + 0.12 + 0.76 * hash2(ix + i, iy + j, seed), py = iy + j + 0.12 + 0.76 * hash2(ix + i, iy + j, seed + 101);
    const d = Math.hypot(gx - px, gy - py);
    if (d < d1) { d2 = d1; d1 = d; id = hash2(ix + i, iy + j, seed + 7); cx = px; cy = py; } else if (d < d2) d2 = d;
  }
  return { d1: d1 * size, d2: d2 * size, id, cx: cx * size, cy: cy * size };
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

const q = (k, label, min, max, step, v, unit) => ({ k, label, min, max, step, v, unit });
const SIZE = (min, max, v, label = 'Dimensione') => q('size', label, min, max, 0.1, v, 'mm');
const ANG = (v = 0, max = 180) => q('angle', 'Angolo', 0, max, 1, v, '°');
const GAP = (v = 1, label = 'Solco') => q('gap', label, 0.4, 2.6, 0.1, v, 'mm');

export const CATEGORIES = [
  { id: 'geo', label: 'Geometrici' },
  { id: 'tex', label: 'Linee e tessuti' },
  { id: 'nat', label: 'Natura' },
  { id: 'org', label: 'Organici' },
  { id: 'own', label: 'Tuoi' }
];

// pt: definisce un pattern puntuale
const pt = (id, label, cat, params, fn, extra = {}) => ({ id, label, cat, params, make: (g, p, seed) => fill(g, (x, y) => fn(x, y, p, seed)), ...extra });

export const PATTERNS = [
  { id: 'none', label: 'Liscio', cat: 'own', params: [], make: g => new Float32Array(g.nx * g.ny) },
  { id: 'image', label: 'Immagine', cat: 'own', params: [], raster: true, make: null },
  { id: 'text', label: 'Testo', cat: 'own', params: [], raster: true, make: null },

  // ================= GEOMETRICI =================
  pt('waves', 'Onde', 'geo', [SIZE(3, 24, 9, 'Periodo'), ANG(20), q('mix', 'Interferenza', 0, 1, 0.05, 0.5)], (x, y, p) => {
    const [u, v] = rot(x, y, p.angle);
    const a = Math.sin(u / p.size * 2 * Math.PI + Math.sin(v / p.size * 1.3) * 2);
    const b = Math.sin((v + u * 0.5) / p.size * 2 * Math.PI * 0.8);
    return 0.5 + 0.5 * (a * (1 - p.mix * 0.5) + b * p.mix * 0.5);
  }),
  pt('hex', 'Esagoni', 'geo', [SIZE(3, 16, 7), GAP(1)], (x, y, p) => tile(hexInfo(x, y, p.size / 2).d, p.gap)),
  pt('honeycomb', 'Alveare', 'geo', [SIZE(4, 16, 8), q('wall', 'Spessore pareti', 0.5, 2.4, 0.1, 1.2, 'mm')], (x, y, p) => 1 - smooth(p.wall / 2, p.wall / 2 + 0.5, hexInfo(x, y, p.size / 2).d)),
  pt('hexgrad', 'Esagoni sfumati', 'geo', [SIZE(4, 16, 8), GAP(0.9), ANG(90)], (x, y, p) => {
    const h = hexInfo(x, y, p.size / 2);
    const [, v] = rot(h.cx, h.cy, p.angle - 90);
    return tile(h.d, p.gap) * clamp01(0.25 + 0.75 * (v / 80 + 0.5));
  }),
  pt('cubes', 'Cubi', 'geo', [SIZE(5, 20, 10), GAP(0.6)], (x, y, p) => {
    const h = hexInfo(x, y, p.size / 2);
    const th = Math.atan2(y - h.cy, x - h.cx);
    const sec = Math.floor((((th + Math.PI * 2 - Math.PI / 6) % (Math.PI * 2)) / (Math.PI * 2)) * 3);
    return tile(h.d, p.gap, 0.4) * [1, 0.55, 0.2][sec];
  }),
  pt('knurl', 'Zigrinatura', 'geo', [SIZE(1.5, 8, 3.2, 'Passo'), ANG(45, 90)], (x, y, p) => {
    const [u, v] = rot(x, y, p.angle);
    return 1 - 2 * Math.max(Math.abs(fract(u / p.size) - 0.5), Math.abs(fract(v / p.size) - 0.5));
  }),
  pt('dots', 'Punti', 'geo', [SIZE(2, 10, 4, 'Passo'), q('fill', 'Diametro', 0.4, 0.98, 0.02, 0.8)], (x, y, p) => {
    const row = Math.floor(y / (p.size * 0.866)), ox = (row & 1) ? p.size / 2 : 0;
    const fx = ((x + ox) % p.size + p.size) % p.size - p.size / 2, fy = y - (row + 0.5) * p.size * 0.866;
    const r = Math.hypot(fx, fy) / (p.size * p.fill / 2);
    return r < 1 ? Math.sqrt(1 - r * r) : 0;
  }),
  pt('ribs', 'Nervature', 'geo', [SIZE(1.5, 10, 3, 'Passo'), ANG(90)], (x, y, p) => rib(rot(x, y, p.angle)[1] / p.size)),
  pt('triangles', 'Piramidi', 'geo', [SIZE(3, 14, 6.5)], (x, y, p) => {
    const b = 2 * y / S3 / p.size, a = x / p.size - b / 2, fa = fract(a), fb = fract(b);
    const m = fa + fb < 1 ? Math.min(1 - fa - fb, fa, fb) : Math.min(fa + fb - 1, 1 - fa, 1 - fb);
    return Math.min(1, m * 3);
  }),
  pt('trimesh', 'Rete triangolare', 'geo', [SIZE(4, 16, 8), q('w', 'Spessore linea', 0.5, 2.4, 0.1, 1.1, 'mm')], (x, y, p) => {
    const b = 2 * y / S3 / p.size, a = x / p.size - b / 2, fa = fract(a), fb = fract(b);
    const m = fa + fb < 1 ? Math.min(1 - fa - fb, fa, fb) : Math.min(fa + fb - 1, 1 - fa, 1 - fb);
    return lineProfile(m * p.size * 0.87, p.w);
  }),
  pt('squares', 'Mattonelle', 'geo', [SIZE(3, 16, 7), GAP(1), ANG(0, 90)], (x, y, p) => {
    const [u, v] = rot(x, y, p.angle);
    return tile((0.5 - Math.max(Math.abs(fract(u / p.size) - 0.5), Math.abs(fract(v / p.size) - 0.5))) * p.size, p.gap);
  }),
  pt('diamonds', 'Rombi', 'geo', [SIZE(3, 16, 7), GAP(1), ANG(45, 90)], (x, y, p) => {
    const [u, v] = rot(x, y, p.angle);
    return tile((0.5 - Math.max(Math.abs(fract(u / p.size) - 0.5), Math.abs(fract(v / p.size) - 0.5))) * p.size, p.gap, 0.8);
  }),
  pt('bricks', 'Mattoni', 'geo', [SIZE(5, 22, 12, 'Larghezza'), GAP(1)], (x, y, p) => {
    const w = p.size, h = w / 2.2, row = Math.floor(y / h), u = fract((x + (row & 1) * w / 2) / w), v = fract(y / h);
    return tile(Math.min(Math.min(u, 1 - u) * w, Math.min(v, 1 - v) * h), p.gap);
  }),
  pt('checker', 'Scacchiera', 'geo', [SIZE(3, 18, 8), q('bevel', 'Smusso', 0.2, 1.6, 0.1, 0.6, 'mm')], (x, y, p) => {
    const i = Math.floor(x / p.size), j = Math.floor(y / p.size);
    if (((i + j) & 1) === 0) return 0;
    const fu = fract(x / p.size), fv = fract(y / p.size);
    return smooth(0, p.bevel, Math.min(fu, 1 - fu, fv, 1 - fv) * p.size);
  }),
  pt('chevron', 'Chevron', 'geo', [SIZE(2, 10, 4, 'Passo'), q('amp', 'Ampiezza', 2, 14, 0.5, 6, 'mm'), q('period', 'Lunghezza', 4, 30, 0.5, 12, 'mm')], (x, y, p) => rib((y + p.amp * tri(x / p.period)) / p.size)),
  pt('knit', 'Maglia', 'geo', [SIZE(3, 9, 5, 'Passo')], (x, y, p) => {
    const s = p.size, f = fract(x / s), v = fract((y + Math.abs(f * 2 - 1) * s * 0.9) / (s * 1.1));
    return rib(v) * (0.6 + 0.4 * Math.sin(f * Math.PI));
  }),
  pt('rings', 'Cerchi concentrici', 'geo', [SIZE(1.6, 8, 3, 'Passo')], (x, y, p) => rib(Math.hypot(x, y) / p.size)),
  pt('spiral', 'Spirale', 'geo', [SIZE(1.8, 8, 3.2, 'Passo'), q('arms', 'Bracci', 1, 5, 1, 2)], (x, y, p) => rib(Math.hypot(x, y) / p.size - Math.atan2(y, x) * p.arms / (2 * Math.PI))),
  pt('sunburst', 'Raggi', 'geo', [q('rays', 'Numero raggi', 8, 72, 1, 36), q('hole', 'Vuoto centrale', 0, 30, 1, 8, 'mm')], (x, y, p) => rib(Math.atan2(y, x) * p.rays / (2 * Math.PI)) * smooth(p.hole, p.hole + 8, Math.hypot(x, y))),
  pt('stripes', 'Strisce diagonali', 'geo', [SIZE(2, 14, 5, 'Passo'), ANG(45), q('duty', 'Spessore', 0.2, 0.8, 0.02, 0.5)], (x, y, p) => {
    const f = fract(rot(x, y, p.angle)[1] / p.size);
    return smooth(0, 0.12, f) * (1 - smooth(p.duty, p.duty + 0.12, f));
  }),
  pt('wavylines', 'Linee ondulate', 'geo', [SIZE(2, 10, 4, 'Passo'), q('amp', 'Ampiezza', 1, 12, 0.5, 5, 'mm'), q('period', 'Lunghezza', 6, 40, 1, 20, 'mm')], (x, y, p) => rib((y + p.amp * Math.sin(x / p.period * 2 * Math.PI)) / p.size)),
  pt('grid', 'Griglia', 'geo', [SIZE(3, 16, 7, 'Passo'), q('w', 'Spessore linea', 0.5, 3, 0.1, 1.2, 'mm'), ANG(0, 90)], (x, y, p) => {
    const [u, v] = rot(x, y, p.angle);
    return Math.max(lineProfile(Math.min(fract(u / p.size), 1 - fract(u / p.size)) * p.size, p.w), lineProfile(Math.min(fract(v / p.size), 1 - fract(v / p.size)) * p.size, p.w));
  }),
  pt('mesh', 'Rete a rombi', 'geo', [SIZE(3, 16, 7, 'Passo'), q('w', 'Spessore linea', 0.5, 3, 0.1, 1.2, 'mm')], (x, y, p) => {
    const [u, v] = rot(x, y, 45);
    return Math.max(lineProfile(Math.min(fract(u / p.size), 1 - fract(u / p.size)) * p.size, p.w), lineProfile(Math.min(fract(v / p.size), 1 - fract(v / p.size)) * p.size, p.w));
  }),
  pt('sierpinski', 'Sierpinski', 'geo', [SIZE(1.6, 6, 2.6, 'Cella')], (x, y, p) => ((Math.floor(x / p.size) + 4096) & (Math.floor(y / p.size) + 4096)) === 0 ? 1 : 0),
  pt('mosaic', 'Mosaico', 'geo', [SIZE(2, 10, 4.5), q('levels', 'Livelli', 2, 6, 1, 4), GAP(0.5)], (x, y, p, seed) => {
    const i = Math.floor(x / p.size), j = Math.floor(y / p.size), fu = fract(x / p.size), fv = fract(y / p.size);
    const lv = Math.floor(hash2(i, j, seed) * p.levels) / (p.levels - 1);
    return (0.15 + 0.85 * lv) * smooth(0, 0.5, Math.min(fu, 1 - fu, fv, 1 - fv) * p.size / (p.gap / 2 + 0.05));
  }),
  pt('scales', 'Scaglie', 'geo', [SIZE(4, 16, 8)], (x, y, p) => scaleField(x, y, p.size, 0)),
  pt('seigaiha', 'Onde giapponesi', 'geo', [SIZE(6, 20, 11), q('rings', 'Anelli', 2, 5, 1, 3)], (x, y, p) => scaleField(x, y, p.size, p.rings)),
  pt('flower', 'Fiore della vita', 'geo', [SIZE(5, 20, 10, 'Raggio'), q('w', 'Spessore linea', 0.5, 2.4, 0.1, 1.1, 'mm')], (x, y, p) => {
    const R = p.size, dy = R * 0.866, j0 = Math.round(y / dy);
    let best = 0;
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      const off = (j & 1) ? R / 2 : 0, i0 = Math.round((x - off) / R);
      for (let i = i0 - 1; i <= i0 + 1; i++) best = Math.max(best, lineProfile(Math.abs(Math.hypot(x - (i * R + off), y - j * dy) - R), p.w));
    }
    return best;
  }),
  pt('equalizer', 'Equalizzatore', 'geo', [SIZE(1.6, 6, 3, 'Larghezza barre'), q('gap', 'Spazio', 0.4, 2, 0.1, 0.8, 'mm'), q('speed', 'Variazione', 0.2, 2, 0.05, 1)], (x, y, p, seed) => {
    const i = Math.floor(x / p.size), fu = fract(x / p.size) * p.size;
    const h = (0.12 + 0.88 * Math.abs(Math.sin(i * 0.7 * p.speed) * 0.6 + hash2(i, 3, seed) * 0.8 - 0.1)) * 70;
    const inBar = fu > p.gap / 2 && fu < p.size - p.gap / 2;
    return inBar && Math.abs(y) < h ? smooth(0, 0.8, Math.min(fu - p.gap / 2, p.size - p.gap / 2 - fu)) : 0;
  }),

  // ================= LINEE E TESSUTI =================
  pt('weave', 'Tessuto', 'tex', [SIZE(2, 9, 4.5, 'Passo')], (x, y, p) => {
    const u = x / p.size, v = y / p.size, i = Math.floor(u), j = Math.floor(v), fu = fract(u), fv = fract(v);
    return ((i + j) & 1) ? Math.sin(Math.PI * fv) ** 0.7 * (0.55 + 0.45 * Math.sin(Math.PI * fu)) : Math.sin(Math.PI * fu) ** 0.7 * (0.55 + 0.45 * Math.sin(Math.PI * fv)) * 0.85;
  }),
  pt('carbon', 'Carbonio', 'tex', [SIZE(1.6, 6, 3, 'Passo')], (x, y, p) => {
    const u = x / p.size, v = y / p.size, i = Math.floor(u), j = Math.floor(v), fu = fract(u), fv = fract(v);
    const over = ((i + j) & 3) < 2;
    return over ? Math.sin(Math.PI * fv) ** 0.6 * 0.95 : Math.sin(Math.PI * fu) ** 0.6 * 0.6;
  }),
  pt('basket', 'Cesto intrecciato', 'tex', [SIZE(3, 10, 6, 'Blocco'), q('strands', 'Fili', 2, 5, 1, 3)], (x, y, p) => {
    const bi = Math.floor(x / p.size), bj = Math.floor(y / p.size), fu = fract(x / p.size), fv = fract(y / p.size);
    const f = ((bi + bj) & 1) ? fv : fu;
    const k = rib(f * p.strands);
    const edge = smooth(0, 0.08, Math.min(fu, 1 - fu, fv, 1 - fv));
    return k * edge;
  }),
  pt('rope', 'Corda', 'tex', [SIZE(2, 9, 4, 'Passo'), ANG(35)], (x, y, p) => {
    const [u, v] = rot(x, y, p.angle);
    return rib(u / p.size + 0.18 * Math.sin(v / p.size * 1.6)) ** 0.8;
  }),
  pt('moire', 'Moiré', 'tex', [SIZE(1.6, 8, 3.2, 'Passo'), q('delta', 'Sfasamento', 1, 15, 0.5, 5, '°')], (x, y, p) => {
    const [u1] = rot(x, y, 0), [u2] = rot(x, y, p.delta);
    return Math.abs(Math.sin(u1 / p.size * Math.PI)) * Math.abs(Math.sin(u2 / p.size * Math.PI));
  }),
  pt('fadelines', 'Linee sfumate', 'tex', [SIZE(1.5, 7, 3, 'Passo'), ANG(0, 180)], (x, y, p) => {
    const [u, v] = rot(x, y, p.angle), t = clamp01(v / 90 + 0.5);
    return smooth(0, 0.1, fract(u / p.size)) * (1 - smooth(t * 0.95, t * 0.95 + 0.1, fract(u / p.size)));
  }),
  pt('halftone', 'Mezzatinta', 'tex', [SIZE(2, 8, 3.6, 'Passo'), ANG(90)], (x, y, p) => {
    const [, v] = rot(x, y, p.angle - 90); const t = clamp01(v / 85 + 0.5);
    const row = Math.floor(y / (p.size * 0.866)), ox = (row & 1) ? p.size / 2 : 0;
    const fx = ((x + ox) % p.size + p.size) % p.size - p.size / 2, fy = y - (row + 0.5) * p.size * 0.866;
    const r = Math.hypot(fx, fy) / (p.size * 0.5 * (0.15 + 0.8 * t));
    return r < 1 ? Math.sqrt(1 - r * r) : 0;
  }),
  pt('rain', 'Pioggia digitale', 'tex', [SIZE(1.6, 5, 2.4, 'Larghezza colonna'), q('len', 'Lunghezza tratti', 6, 40, 1, 18, 'mm')], (x, y, p, seed) => {
    const i = Math.floor(x / p.size), fu = fract(x / p.size);
    const off = hash2(i, 9, seed) * 100, sp = 0.6 + hash2(i, 4, seed);
    const f = fract((y * sp + off) / p.len);
    return smooth(0.1, 0.8, fu) * (1 - smooth(0.8, 1, fu)) * (0.2 + 0.8 * f) * (hash2(i, 5, seed) > 0.25 ? 1 : 0.15);
  }),
  pt('stars', 'Costellazione', 'tex', [SIZE(5, 16, 8, 'Densità'), q('maxr', 'Dimensione max', 1, 5, 0.1, 2.6, 'mm')], (x, y, p, seed) => {
    const gx = x / p.size, gy = y / p.size, ix = Math.floor(gx), iy = Math.floor(gy);
    let v = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if (hash2(ix + i, iy + j, seed + 5) < 0.35) continue;
      const cx = (ix + i + hash2(ix + i, iy + j, seed)) * p.size, cy = (iy + j + hash2(ix + i, iy + j, seed + 1)) * p.size;
      const r = p.maxr * (0.35 + 0.65 * hash2(ix + i, iy + j, seed + 2)), d = Math.hypot(x - cx, y - cy) / r;
      if (d < 1) v = Math.max(v, Math.sqrt(1 - d * d));
    }
    return v;
  }),
  pt('basketw', 'Spina di pesce', 'tex', [SIZE(3, 10, 5, 'Larghezza'), GAP(0.6)], (x, y, p) => {
    const [u, v] = [x + y, y - x];
    const a = Math.floor(u / (p.size * 1.4)), b = Math.floor(v / (p.size * 1.4)), fu = fract(u / (p.size * 1.4)), fv = fract(v / (p.size * 1.4));
    const f = ((a + b) & 1) ? fu : fv;
    return tile(Math.min(f, 1 - f) * p.size * 1.4, p.gap, 0.5) * (0.6 + 0.4 * ((a + b) & 1));
  }),

  // ================= NATURA =================
  pt('contour', 'Curve di livello', 'nat', [SIZE(15, 90, 45, 'Scala'), q('lines', 'Linee', 4, 22, 1, 10), q('width', 'Spessore', 0.1, 0.6, 0.01, 0.28)], (x, y, p, seed) => {
    const n = fbm(x / p.size * 2 + 11, y / p.size * 2 + 5, seed) * p.lines;
    return 1 - smooth(1 - p.width, 1 - p.width + 0.18, Math.abs(fract(n) - 0.5) * 2);
  }),
  pt('voronoi', 'Voronoi', 'nat', [SIZE(4, 24, 10), GAP(1)], (x, y, p, seed) => { const w = worley(x, y, p.size, seed); return smooth(p.gap / 2, p.gap / 2 + 0.7, (w.d2 - w.d1) / 2); }),
  pt('crystals', 'Cristalli', 'nat', [SIZE(5, 24, 11), GAP(0.7), q('levels', 'Contrasto livelli', 0.2, 1, 0.05, 0.8)], (x, y, p, seed) => {
    const w = worley(x, y, p.size, seed);
    return smooth(p.gap / 2, p.gap / 2 + 0.5, (w.d2 - w.d1) / 2) * (1 - p.levels + p.levels * w.id);
  }),
  pt('pebbles', 'Ciottoli', 'nat', [SIZE(4, 18, 8)], (x, y, p, seed) => { const w = worley(x, y, p.size, seed); return clamp01(1 - (w.d1 / (p.size * 0.62)) ** 2) ** 0.6; }),
  pt('craters', 'Crateri', 'nat', [SIZE(5, 20, 10)], (x, y, p, seed) => { const w = worley(x, y, p.size, seed); return 1 - clamp01(1 - (w.d1 / (p.size * 0.55)) ** 2) ** 0.7 * (hash2(Math.round(w.cx), Math.round(w.cy), seed) > 0.25 ? 1 : 0); }),
  pt('leather', 'Pelle', 'nat', [SIZE(1.6, 6, 3, 'Grana')], (x, y, p, seed) => {
    const w = worley(x, y, p.size, seed);
    return 0.75 * smooth(0.12, 0.7, (w.d2 - w.d1)) + 0.25 * vnoise(x / p.size * 3, y / p.size * 3, seed);
  }),
  pt('orange', 'Buccia d\'arancia', 'nat', [SIZE(0.8, 3, 1.4, 'Grana')], (x, y, p, seed) => fbm(x / p.size, y / p.size, seed, 2)),
  pt('hills', 'Colline', 'nat', [SIZE(15, 80, 40, 'Scala')], (x, y, p, seed) => smooth(0.2, 0.8, fbm(x / p.size, y / p.size, seed, 4))),
  pt('mountains', 'Montagne', 'nat', [SIZE(15, 80, 36, 'Scala')], (x, y, p, seed) => (1 - Math.abs(2 * fbm(x / p.size, y / p.size, seed, 5) - 1)) ** 2.2),
  pt('clouds', 'Nuvole', 'nat', [SIZE(10, 60, 24, 'Scala'), q('cover', 'Copertura', 0.35, 0.65, 0.01, 0.5)], (x, y, p, seed) => smooth(p.cover - 0.08, p.cover + 0.18, fbm(x / p.size, y / p.size, seed + 33, 5))),
  pt('dunes', 'Dune', 'nat', [SIZE(2.5, 10, 5, 'Passo'), q('warp', 'Ondulazione', 2, 30, 1, 12, 'mm')], (x, y, p, seed) => rib((y + p.warp * (fbm(x / 45, y / 45, seed, 3) - 0.5) * 2) / p.size)),
  pt('marble', 'Marmo', 'nat', [SIZE(8, 40, 20, 'Scala'), q('w', 'Spessore vene', 0.1, 0.5, 0.01, 0.2)], (x, y, p, seed) => 1 - smooth(p.w, p.w + 0.12, Math.abs(Math.sin(Math.PI * (x / p.size * 0.6 + y / p.size * 0.4 + 2.2 * fbm(x / 28, y / 28, seed, 4)))))),
  pt('wood', 'Venatura del legno', 'nat', [SIZE(2.5, 9, 4.5, 'Anelli'), ANG(0)], (x, y, p, seed) => {
    const [u, v] = rot(x, y, p.angle);
    return rib(Math.hypot(u * 0.12, v + 14 * (fbm(u / 60, v / 30, seed, 3) - 0.5)) / p.size * 4.5) * (0.85 + 0.15 * vnoise(u * 0.2, v * 3, seed));
  }),

  // ================= ORGANICI (reazione-diffusione) =================
  gs('labyrinth', 'Labirinto', 0.029, 0.057, 3),
  gs('spots', 'Macchie di Turing', 0.035, 0.065, 3.4),
  gs('coral', 'Corallo', 0.0545, 0.062, 3),
  gs('mitosis', 'Mitosi', 0.0367, 0.0649, 3.2),
  gs('worms', 'Vermi', 0.078, 0.061, 2.8),
  gs('solitons', 'Isole', 0.03, 0.062, 3.6)
];

function gs(id, label, F, K, stripe) {
  return {
    id, label, cat: 'org', gs: true,
    params: [q('size', 'Scala', 1.6, 7, 0.1, stripe, 'mm'), q('sharp', 'Morbidezza', 0.05, 0.6, 0.01, 0.28)],
    make: (g, p, seed) => grayScott(g, p.size, p.sharp, seed, F, K)
  };
}

function scaleField(x, y, s, rings) {
  const R = s / 2, dy = R * 0.5, r0 = Math.floor(y / dy);
  let bestRow = -1e9, val = 0;
  for (let r = r0 - 2; r <= r0 + 2; r++) {
    const off = (r & 1) ? s / 2 : 0, c = Math.round((x - off) / s);
    for (let i = c - 1; i <= c + 1; i++) {
      const d = Math.hypot(x - (i * s + off), y - r * dy) / R;
      if (d < 1 && r > bestRow) {
        bestRow = r;
        val = rings ? rib(d * rings * 0.5) : clamp01(0.25 + 0.75 * (1 - d * d)) * smooth(0, 0.08, 1 - d);
      }
    }
  }
  return val;
}

export const patternById = id => PATTERNS.find(p => p.id === id) || PATTERNS[0];
export function patternDefaults(id) {
  const o = {};
  for (const p of patternById(id).params) o[p.k] = p.v;
  return o;
}

// ---- labirinto quadrato: usato dal pattern 'maze' ----
PATTERNS.splice(PATTERNS.findIndex(p => p.id === 'sierpinski') + 1, 0, {
  id: 'maze', label: 'Labirinto quadro', cat: 'geo',
  params: [q('size', 'Cella', 1.6, 6, 0.1, 2.6, 'mm')],
  make(g, p, seed) {
    let w = Math.ceil(g.sx / p.size) + 2, h = Math.ceil(g.sy / p.size) + 2;
    if (w % 2 === 0) w++; if (h % 2 === 0) h++;
    const wall = new Uint8Array(w * h).fill(1);
    let s = seed * 9301 + 49297; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const stack = [[1, 1]]; wall[w + 1] = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dy]) => cx + dx > 0 && cx + dx < w - 1 && cy + dy > 0 && cy + dy < h - 1 && wall[(cy + dy) * w + cx + dx]);
      if (!dirs.length) { stack.pop(); continue; }
      const [dx, dy] = dirs[Math.floor(rnd() * dirs.length)];
      wall[(cy + dy / 2) * w + cx + dx / 2] = 0; wall[(cy + dy) * w + cx + dx] = 0; stack.push([cx + dx, cy + dy]);
    }
    return fill(g, (x, y) => {
      const i = Math.floor((x + g.sx / 2) / p.size + (w - g.sx / p.size) / 2), j = Math.floor((y + g.sy / 2) / p.size + (h - g.sy / p.size) / 2);
      return (i < 0 || j < 0 || i >= w || j >= h) ? 1 : wall[j * w + i];
    });
  }
});

// ---- Gray-Scott ----
let gsCache = { key: '', data: null };
function grayScott(g, stripe, sharp, seed, F, K) {
  const key = [g.nx, g.ny, g.cell, stripe, sharp, seed, F, K].join('|');
  if (gsCache.key === key) return gsCache.data;
  const cellMm = stripe / 4.5;
  const w = Math.max(24, Math.round(g.sx / cellMm)), h = Math.max(24, Math.round(g.sy / cellMm));
  let U = new Float32Array(w * h).fill(1), V = new Float32Array(w * h);
  let U2 = new Float32Array(w * h), V2 = new Float32Array(w * h);
  const n = Math.round(w * h / 140);
  for (let s = 0; s < n; s++) {
    const cx = Math.floor(hash2(s, 1, seed) * w), cy = Math.floor(hash2(s, 2, seed) * h), r = 2 + Math.floor(hash2(s, 3, seed) * 2);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const xx = (cx + x + w) % w, yy = (cy + y + h) % h;
      U[yy * w + xx] = 0.5; V[yy * w + xx] = 0.25 + 0.05 * hash2(xx, yy, seed);
    }
  }
  const Du = 0.2097, Dv = 0.105, iters = 3400;
  for (let it = 0; it < iters; it++) {
    for (let y = 0; y < h; y++) {
      const ym = ((y - 1 + h) % h) * w, yp = ((y + 1) % h) * w, yc = y * w;
      for (let x = 0; x < w; x++) {
        const xm = (x - 1 + w) % w, xp = (x + 1) % w, i = yc + x, u = U[i], v = V[i];
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
    const fy = (j / (g.ny - 1)) * (h - 1), y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for (let i = 0; i < g.nx; i++) {
      const fx = (i / (g.nx - 1)) * (w - 1), x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
      const v = (V[y0 * w + x0] * (1 - tx) + V[y0 * w + x1] * tx) * (1 - ty) + (V[y1 * w + x0] * (1 - tx) + V[y1 * w + x1] * tx) * ty;
      out[j * g.nx + i] = smooth(mid - sharp * span, mid + sharp * span, v);
    }
  }
  gsCache = { key, data: out };
  return out;
}
