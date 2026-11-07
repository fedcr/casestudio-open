import Module from '../vendor/manifold.js';
import { buildCase, toBuffers } from './geometry.js';

let M = null;
const ready = (async () => {
  M = await Module({ locateFile: f => new URL('../vendor/' + f, import.meta.url).href });
  M.setup();
})();

self.onmessage = async (e) => {
  const { id, P, raster, fitTest } = e.data;
  try {
    await ready;
    const t0 = performance.now();
    const r = buildCase(M, P, raster);
    let bumper = r.bumper;
    const out = { id, meta: r.meta };
    if (fitTest) {
      // anello di prova: solo la parte anteriore (labbro + cavita) per verificare la misura in pochi minuti
      const h = r.meta.lipT + 4;
      bumper = bumper.intersect(M.Manifold.cube([400, 400, h], true).translate([0, 0, h / 2]));
    }
    const b = toBuffers(bumper), p = toBuffers(r.plate);
    out.bumper = b; out.plate = p;
    out.stats = { bumperVol: bumper.volume(), plateVol: r.plate.volume(), ms: performance.now() - t0 };
    self.postMessage(out, [b.pos.buffer, b.idx.buffer, p.pos.buffer, p.idx.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
