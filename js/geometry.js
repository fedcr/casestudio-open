// Motore geometrico: genera bumper (TPU) e piastra posteriore (PLA) con Manifold (CSG).
// Sistema di coordinate: vista da DIETRO il telefono, x a destra, y in alto,
// z cresce dal fronte (z=0, schermo) verso il retro. Il bumper si stampa con il fronte sul piano.
import { LAYER, snap, snapUp, gridSpec } from './params.js';
import { patternById, patternDefaults } from './patterns.js';

const SEG = 48;

export async function initManifold(loader) {
  const wasm = await loader();
  wasm.setup();
  return wasm;
}

// ----- helpers 2D/3D -----
function rrect(M, W, H, R, d, segs = SEG) {
  const hw = Math.max(0.01, W / 2 - R), hh = Math.max(0.01, H / 2 - R);
  return M.CrossSection.square([2 * hw, 2 * hh], true).offset(Math.max(0.05, R + d), 'Round', 2, segs);
}
const ext = (xs, z0, z1) => xs.extrude(z1 - z0).translate([0, 0, z0]);

// riferimento: cubo/slot orientati con asse "normale" lungo +-x o +-y
// local: a (lungo il bordo), b (z modello), n (normale uscente)
function frameMatrix(nx, ny, c) {
  // colonne: a, b(=z), n ; destrorso: a = b x n
  const n = [nx, ny, 0], b = [0, 0, 1];
  const a = [b[1] * n[2] - b[2] * n[1], b[2] * n[0] - b[0] * n[2], b[0] * n[1] - b[1] * n[0]];
  return [a[0], a[1], a[2], 0, b[0], b[1], b[2], 0, n[0], n[1], n[2], 0, c[0], c[1], c[2], 1];
}
// slot arrotondato (lung. l lungo il bordo, alt. h in z, profondita d lungo la normale), centrato in c
function slot(M, nx, ny, c, l, h, d) {
  const r = Math.min(h, l) / 2;
  const xs = M.CrossSection.square([Math.max(0.01, l - 2 * r), Math.max(0.01, h - 2 * r)], true).offset(r, 'Round', 2, 24);
  const s = xs.extrude(d).translate([0, 0, -d / 2]);
  return s.transform(frameMatrix(nx, ny, c));
}
function box(M, nx, ny, c, l, h, d) {
  return M.Manifold.cube([l, h, d], true).transform(frameMatrix(nx, ny, c));
}

export function buildCase(M, P, raster) {
  const { Manifold, CrossSection } = M;
  const ph = P.phone, { W, H, R, T } = ph;
  const tol = P.fit.tol, B = P.bumper, PL = P.plate, BT = P.buttons, MG = P.mag;
  const warnings = [];
  const pat = patternById(P.pattern.kind);
  const hasRelief = pat.id !== 'none' && P.pattern.amp > 0.05;

  // ---------- quote ----------
  const lipT = snap(B.lipT);
  const cavH = snapUp(T + 0.2);
  // piastra: spessore minimo per il magnete incorporato
  let plateT = snap(PL.T);
  const pocketH = snapUp(MG.depth + 0.2);
  if (MG.mode === 'ring' || MG.mode === 'discs') {
    const need = snapUp(0.4 + (MG.mode === 'discs' ? snapUp(MG.discH + 0.2) : pocketH) + 0.4);
    if (plateT < need) { plateT = need; warnings.push({ k: 'Spessore piastra portato a {0} mm per alloggiare i magneti.', a: [plateT.toFixed(1)] }); }
  } else if (MG.mode === 'open') {
    if (plateT < 1.4) plateT = 1.4;
  }
  const relief = hasRelief ? snapUp(P.pattern.amp, 0.1) : 0;
  const rimT = snapUp(Math.max(1.2, relief + 0.4));
  const grooveH = plateT + 0.2;
  const zc1 = lipT + cavH;           // fine cavita telefono
  const zg1 = zc1 + grooveH;         // fine scanalatura piastra
  const Z = zg1 + rimT;              // altezza totale bumper
  const grooveOff = B.engage + 0.15;
  const innerAt = z => {
    if (z < lipT) return -B.lipOv + B.lipChamfer * (1 - z / lipT);
    if (z < zc1) return tol;
    if (z < zg1) return grooveOff;
    return -B.rimOv;
  };
  const baseOut = tol + B.wall;
  const outerAt = z => {
    let o = baseOut;
    const c = B.chamfer;
    if (z < c) o -= (c - z);
    else if (z > Z - c) o -= (c - (Z - z));
    if (z > lipT + 1 && z < zc1 - 1) {
      const k = z - lipT;
      if (B.side === 'ribs') o -= (k % 2.4) < 1.0 ? 0.5 : 0;
      else if (B.side === 'wave') o -= 0.35 * (0.5 + 0.5 * Math.sin(k / 2.4 * 2 * Math.PI));
    }
    return Math.round(o * 20) / 20;
  };

  // ---------- bumper: anelli impilati ----------
  const slabs = [];
  const n = Math.round(Z / LAYER);
  for (let i = 0; i < n; i++) {
    const z0 = i * LAYER, zm = z0 + LAYER / 2;
    const key = outerAt(zm).toFixed(2) + '|' + innerAt(zm).toFixed(2);
    const last = slabs[slabs.length - 1];
    if (last && last.key === key) last.z1 = z0 + LAYER;
    else slabs.push({ key, z0, z1: z0 + LAYER, o: outerAt(zm), i: innerAt(zm) });
  }
  const rings = slabs.map(s => {
    // angoli esterni: 'follow' = offset costante dal telefono; 'sharp' = raggio vicino a quello del telefono (piu' materiale sugli spigoli)
    const outer = B.corners === 'sharp' ? rrect(M, W + 2 * s.o, H + 2 * s.o, Math.min(R + 0.8, R + s.o), 0) : rrect(M, W, H, R, s.o);
    const xs = outer.subtract(rrect(M, W, H, R, s.i));
    return ext(xs, s.z0, s.z1);
  });
  let bumper = Manifold.union(rings);

  // ---------- aperture ----------
  const zBody = lipT + T / 2;
  const wallMid = tol + B.wall / 2;
  const cuts = [];
  // fondo (USB, speaker)
  {
    const yb = -(H / 2 + wallMid);
    const list = Array.isArray(ph.bottom) ? ph.bottom : [ph.bottom];
    if (B.bottom === 'open') {
      cuts.push(slot(M, 0, -1, [0, yb, zBody], Math.min(W - 2 * Math.max(R, 4) + 6, W - 8), Math.max(6, Math.min(T - 0.6, 7)), B.wall + 2));
    } else for (const c of list) {
      const h = Math.max(2.4, Math.min(T - 0.8, c.h || 6));
      cuts.push(slot(M, 0, -1, [c.x, yb, zBody], Math.max(c.len, h), h, B.wall + 2));
    }
  }
  // tasti laterali
  const items = ph.buttons.map((b, idx) => ({ ...b, idx })).filter(b => !BT.enabled || BT.enabled.includes(b.idx));
  const adds = [];
  const tabH = Math.max(4, Math.min(7, T * 0.7));
  const mem = Math.min(BT.membrane, B.wall - 0.6);
  for (const b of items) {
    const sgn = b.side === 'right' ? -1 : 1;       // lato destro visto da davanti = x negativo da dietro
    const yc = H / 2 - b.y;
    const xo = sgn * (W / 2 + tol + B.wall / 2);   // centro parete
    const xf = sgn * (W / 2 + tol + B.wall);       // faccia esterna
    if (BT.mode === 'cutout' || b.cut) {
      cuts.push(slot(M, sgn, 0, [xo, yc, zBody], b.len + 3, Math.max(4, tabH), B.wall + 2));
    } else if (BT.mode === 'tab') {
      // pad: stadio in rilievo, circondato da una gola che lascia una membrana flessibile (nessun foro passante)
      const L = b.len + BT.extra, g = BT.slit, d = B.wall - mem;
      const groove = slot(M, sgn, 0, [xf + sgn * (1 - d) / 2, yc, zBody], L + 2 * g, tabH + 2 * g, d + 1)
        .subtract(slot(M, sgn, 0, [xf + sgn * (1 - d) / 2, yc, zBody], L, tabH, d + 3));
      cuts.push(groove);
      // nub interno che preme il tasto del telefono
      const xin = sgn * (W / 2 - BT.preload), xout = sgn * (W / 2 + tol + 0.4);
      adds.push(slot(M, sgn, 0, [(xin + xout) / 2, yc, zBody], Math.min(b.len * 0.8, L - 3), Math.min(tabH - 1.4, 3.6), Math.abs(xout - xin)));
      // cappuccio esterno
      const ph1 = BT.padH;
      if (BT.pad === 'flat') {
        adds.push(slot(M, sgn, 0, [xf + sgn * (ph1 - 0.4) / 2, yc, zBody], L - 1, tabH - 1, ph1 + 0.4));
      } else if (BT.pad === 'soft') {
        adds.push(slot(M, sgn, 0, [xf + sgn * (0.5 - 0.4) / 2, yc, zBody], L - 1, tabH - 1, 0.9));
        adds.push(slot(M, sgn, 0, [xf + sgn * (0.5 + (ph1 - 0.5) / 2), yc, zBody], L - 3, tabH - 3, Math.max(0.2, ph1 - 0.5)));
      } else { // ridged: base con nervature trasversali
        const cap = slot(M, sgn, 0, [xf + sgn * (ph1 - 0.4) / 2, yc, zBody], L - 1, tabH - 1, ph1 + 0.4);
        const n = Math.max(2, Math.floor((L - 3) / 2));
        const gr = [];
        for (let k = 0; k < n; k++) gr.push(box(M, sgn, 0, [xf + sgn * ph1, yc - (L - 3) / 2 + (k + 0.5) * (L - 3) / n, zBody], 0.7, tabH + 2, ph1 * 0.9 + 0.01));
        adds.push(cap.subtract(Manifold.union(gr)));
      }
    }
  }
  if (cuts.length) bumper = bumper.subtract(Manifold.union(cuts));
  if (adds.length) bumper = bumper.add(Manifold.union(adds));

  // ---------- piastra ----------
  const plateOutline = rrect(M, W, H, R, B.engage);
  let plate;
  const lim = 3.5;
  const camShapes = (ph.cams || []).map(c => {
    const m = PL.camMargin;
    let w = c.w + 2 * m, h = c.h + 2 * m;
    w = Math.min(w, W - 2 * lim); h = Math.min(h, H - 2 * lim);
    const cx = Math.max(-W / 2 + lim + w / 2, Math.min(W / 2 - lim - w / 2, c.x - W / 2));
    const cy = Math.max(-H / 2 + lim + h / 2, Math.min(H / 2 - lim - h / 2, H / 2 - c.y));
    if (c.t === 'c') return CrossSection.circle(Math.min(w, h) / 2, 48).translate([cx, cy]);
    const r = Math.max(0.1, Math.min(c.r + m, w / 2, h / 2));
    return CrossSection.square([Math.max(0.1, w - 2 * r), Math.max(0.1, h - 2 * r)], true).offset(r, 'Round', 2, 36).translate([cx, cy]);
  });
  const camHole = camShapes.length ? CrossSection.union(camShapes) : null;
  const g = gridSpec(P);
  let hf = null;
  if (hasRelief) {
    let grid = pat.raster ? (raster && raster.length === g.nx * g.ny ? raster : null) : pat.make(g, { ...patternDefaults(pat.id), ...P.pattern.p }, P.pattern.seed);
    if (grid) {
      grid = blur3(grid, g.nx, g.ny);
      const amp = relief;
      const hv = new Float32Array(g.nx * g.ny);
      const hw = W / 2 - R, hh = H / 2 - R;
      const lim2 = -(B.rimOv + 0.5);
      for (let j = 0; j < g.ny; j++) {
        const y = g.y0 + j * g.cell, qy = Math.abs(y) - hh;
        for (let i = 0; i < g.nx; i++) {
          const x = g.x0 + i * g.cell, qx = Math.abs(x) - hw;
          const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R; // <0 dentro
          let v = grid[j * g.nx + i];
          if (P.pattern.invert) v = 1 - v;
          const m = sd < lim2 ? 1 : 0;
          // quantizza altezza a 0.1 mm per un modello piu' pulito
          hv[j * g.nx + i] = m ? Math.round(v * amp * 20) / 20 : 0;
        }
      }
      hf = heightfield(M, g, hv, plateT);
    } else warnings.push('Immagine non ancora caricata: la piastra resta liscia.');
  }
  if (hf) {
    const prism = ext(plateOutline, 0, plateT + relief + 1);
    plate = hf.intersect(prism);
  } else {
    plate = ext(plateOutline, 0, plateT);
  }
  // protezione fotocamera
  if (camHole) {
    if (PL.guard) {
      const ring = ext(camHole.offset(1.3, 'Round', 2, 36).subtract(camHole), 0, plateT + PL.guardH);
      plate = plate.add(ring.intersect(ext(rrect(M, W, H, R, B.engage - 0.8), 0, plateT + PL.guardH + 1)));
    }
    plate = plate.subtract(ext(camHole, -1, plateT + PL.guardH + relief + 2));
  }

  // magneti
  const pauses = [];
  const mc = [0, MG.y];
  if (MG.mode === 'ring' || MG.mode === 'discs') {
    const ph2 = MG.mode === 'discs' ? snapUp(MG.discH + 0.2) : pocketH;
    const pz1 = plateT - 0.4, pz0 = pz1 - ph2;
    let pocket;
    if (MG.mode === 'ring') {
      pocket = CrossSection.circle(MG.od / 2 + 0.15, 96).subtract(CrossSection.circle(MG.id / 2 - 0.15, 96));
    } else {
      const parts = [];
      for (let k = 0; k < MG.discN; k++) {
        const a = k / MG.discN * 2 * Math.PI;
        parts.push(CrossSection.circle(MG.discD / 2 + 0.15, 32).translate([MG.discR * Math.cos(a), MG.discR * Math.sin(a)]));
      }
      pocket = CrossSection.union(parts);
    }
    plate = plate.subtract(ext(pocket.translate(mc), pz0, pz1));
    pauses.push({ top_z: +(pz1 + LAYER).toFixed(2), type: 'pause', msg: 'Inserisci i magneti, poi riprendi' });
  } else if (MG.mode === 'open') {
    const pocket = CrossSection.circle(MG.od / 2 + 0.15, 96).subtract(CrossSection.circle(MG.id / 2 - 0.15, 96));
    plate = plate.subtract(ext(pocket.translate(mc), -1, pocketH));
  }
  if (hasRelief && P.pattern.twoTone) pauses.push({ top_z: +(plateT + LAYER).toFixed(2), type: 'color', msg: 'Cambia filamento per il rilievo' });
  pauses.sort((a, b) => a.top_z - b.top_z);

  // controlli
  if (Math.max(W, H) + 2 * baseOut > 180) warnings.push('La cover supera il piano di stampa dell\'A1 mini (180 mm).');

  return {
    bumper, plate,
    meta: { Z, lipT, cavH, zc1, zg1, plateT, rimT, relief, pauses, outerW: W + 2 * baseOut, outerH: H + 2 * baseOut, warnings }
  };
}

// Sfocatura 3x3: smussa i bordi verticali (stampabili meglio, niente scalini)
function blur3(a, nx, ny) {
  const o = new Float32Array(a.length);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let s = 0, w = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const x = i + di, y = j + dj; if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
      const k = (di === 0 ? 2 : 1) * (dj === 0 ? 2 : 1); s += a[y * nx + x] * k; w += k;
    }
    o[j * nx + i] = s / w;
  }
  return o;
}

// Heightfield chiuso (top variabile, base piatta a z=0). h = altezza aggiuntiva sopra baseT.
function heightfield(M, g, h, baseT) {
  const { nx, ny } = g, N = nx * ny;
  const pos = new Float32Array(N * 2 * 3);
  for (let j = 0, i = 0; j < ny; j++) for (let k = 0; k < nx; k++, i++) {
    const x = g.x0 + k * g.cell, y = g.y0 + j * g.cell;
    pos.set([x, y, baseT + h[i]], i * 3);
    pos.set([x, y, 0], (N + i) * 3);
  }
  const tris = [];
  const id = (k, j) => j * nx + k;
  for (let j = 0; j < ny - 1; j++) for (let k = 0; k < nx - 1; k++) {
    const a = id(k, j), b = id(k + 1, j), c = id(k + 1, j + 1), d = id(k, j + 1);
    tris.push(a, b, c, a, c, d);
    tris.push(N + a, N + c, N + b, N + a, N + d, N + c);
  }
  for (let k = 0; k < nx - 1; k++) {
    let a = id(k, 0), b = id(k + 1, 0);
    tris.push(a, N + a, N + b, a, N + b, b);
    a = id(k, ny - 1); b = id(k + 1, ny - 1);
    tris.push(a, N + b, N + a, a, b, N + b);
  }
  for (let j = 0; j < ny - 1; j++) {
    let a = id(0, j), b = id(0, j + 1);
    tris.push(a, N + b, N + a, a, b, N + b);
    a = id(nx - 1, j); b = id(nx - 1, j + 1);
    tris.push(a, N + a, N + b, a, N + b, b);
  }
  const mesh = new M.Mesh({ numProp: 3, vertProperties: pos, triVerts: new Uint32Array(tris) });
  mesh.merge();
  return new M.Manifold(mesh);
}

export function toBuffers(m) {
  const mesh = m.getMesh();
  const np = mesh.numProp;
  const vp = mesh.vertProperties;
  let pos;
  if (np === 3) pos = new Float32Array(vp);
  else { pos = new Float32Array((vp.length / np) * 3); for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { pos[j] = vp[i]; pos[j + 1] = vp[i + 1]; pos[j + 2] = vp[i + 2]; } }
  return { pos, idx: new Uint32Array(mesh.triVerts) };
}
