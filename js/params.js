import { phoneById, clonePhone } from './phones.js';

export const LAYER = 0.2; // altezza layer: tutte le quote verticali sono multiple di questo valore
export const snap = (v, step = LAYER) => Math.max(step, Math.round(v / step) * step);
export const snapUp = (v, step = LAYER) => Math.ceil(v / step - 1e-6) * step;

export function defaults() {
  return {
    phoneId: 'ip16pro',
    phone: clonePhone(phoneById('ip16pro')),
    fit: { tol: 0.2 },
    bumper: {
      wall: 1.8,      // spessore parete
      lipT: 1.2,      // spessore del bordo che copre lo schermo
      lipOv: 1.4,     // quanto il bordo copre lo schermo
      lipChamfer: 0.6,
      rimOv: 0.9,     // quanto il bordo posteriore trattiene la piastra
      engage: 0.5,    // quanto la piastra entra nella scanalatura
      chamfer: 0.6,   // smusso esterno
      side: 'smooth', // smooth | ribs | wave
      bottom: 'cut',  // cut | open
      corners: 'follow' // follow | sharp
    },
    plate: {
      T: 2.0,         // spessore base
      guard: true,    // anello di protezione fotocamera
      guardH: 0.8,
      camMargin: 0.8,
      cell: 0.5       // risoluzione del rilievo (mm)
    },
    pattern: {
      kind: 'labyrinth',
      amp: 1.0,
      invert: false,
      seed: 7,
      twoTone: true,
      // parametri specifici (riempiti dai default del pattern)
      p: {},
      image: { dataUrl: null, fit: 'contain', zoom: 1, offx: 0, offy: 0, contrast: 1.4, threshold: 0.5, auto: true, mode: 'binary', ink: 'dark', blur: 0.2 },
      text: { value: 'CASE', font: 'sans-serif', weight: 800, size: 0.5, angle: 0 }
    },
    mag: {
      mode: 'ring',   // none | ring | discs | open
      od: 55, id: 47, depth: 0.8,
      y: 0,
      discD: 6, discH: 1.0, discN: 12, discR: 25
    },
    buttons: {
      mode: 'tab',    // tab | cutout | closed
      pad: 'soft',    // soft | flat | ridged
      extra: 6,       // lunghezza extra del pad
      padH: 1.2,
      slit: 0.7,       // larghezza della gola attorno al pad
      membrane: 0.8,   // spessore della membrana flessibile
      preload: 0.0,
      enabled: null   // null = tutti
    },
    colors: { bumper: '#3d8bff', plate: '#f2f4f7', relief: '#1f5fd6' }
  };
}

// Dimensioni della griglia del rilievo (mm) in funzione dei parametri
export function gridSpec(P) {
  const { W, H } = P.phone;
  const ext = P.bumper.engage + P.fit.tol;
  const cell = P.plate.cell;
  const sx = W + 2 * ext + 2, sy = H + 2 * ext + 2;
  const nx = Math.ceil(sx / cell) + 1, ny = Math.ceil(sy / cell) + 1;
  return { nx, ny, cell, x0: -(nx - 1) * cell / 2, y0: -(ny - 1) * cell / 2, sx: (nx - 1) * cell, sy: (ny - 1) * cell };
}

export function deepMerge(a, b) {
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return b === undefined ? a : b;
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = (k in a) ? deepMerge(a[k], b[k]) : b[k];
  return out;
}
