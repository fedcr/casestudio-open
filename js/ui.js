import { Viewer } from './viewer.js';
import { PHONES, phoneById, clonePhone } from './phones.js';
import { PATTERNS, CATEGORIES, patternById, patternDefaults } from './patterns.js';
import { defaults, deepMerge, gridSpec, LAYER } from './params.js';
import { stl, threeMF, download, processPreset, filamentPreset, zip } from './export.js';

const $ = (s, r = document) => r.querySelector(s);
const ICON = n => `<svg class="i"><use href="sprite.svg#${n}"/></svg>`;
const KEY = 'csopen.v3';

// ---------- stato ----------
let P = defaults();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) P = deepMerge(defaults(), JSON.parse(raw));
} catch { /* storage non disponibile */ }
if (!Array.isArray(P.phone.cams)) P.phone = clonePhone(phoneById(P.phoneId));
if (!patternById(P.pattern.kind) || P.pattern.kind === 'image' || P.pattern.kind === 'text') { /* immagini non persistono */ P.pattern.kind = P.pattern.kind === 'text' ? 'text' : 'labyrinth'; }
P.pattern.image.dataUrl = null;
let tab = 'phone';
let showPhone = false;
let imgEl = null;
let photoEl = null;
let patCat = (patternById(P.pattern.kind) || {}).cat || 'org';
let last = null;
let seq = 0;
let sel = { type: 'cam', i: 0 };

const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const set = (o, path, v) => { const ks = path.split('.'); const l = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[l] = v; };
const save = () => { try { const c = JSON.parse(JSON.stringify(P)); c.pattern.image.dataUrl = null; localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ok */ } };
const fmt = (v, step) => { const d = step >= 1 ? 0 : step >= 0.1 ? 1 : 2; return Number(v).toFixed(d); };

// ---------- viewer & worker ----------
const viewer = new Viewer($('#cv'));
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const pending = new Map();
worker.onmessage = e => { const r = pending.get(e.data.id); if (r) { pending.delete(e.data.id); r(e.data); } };
worker.onerror = e => setStatus('Errore del motore 3D: ' + (e.message || 'sconosciuto'), 'err');
const request = (fitTest = false) => new Promise(res => {
  const id = ++seq; pending.set(id, res);
  worker.postMessage({ id, P: JSON.parse(JSON.stringify({ ...P, pattern: { ...P.pattern, image: { ...P.pattern.image, dataUrl: null } } })), raster: rasterize(), fitTest });
});

function setStatus(text, mode = 'idle') {
  $('#stText').textContent = text;
  $('#stSpin').classList.toggle('idle', mode !== 'busy');
  $('#stSpin').firstElementChild.setAttribute('href', 'sprite.svg#' + (mode === 'err' ? 'triangle-alert' : mode === 'ok' ? 'check' : 'loader-circle'));
}
let timer = 0;
function schedule(delay = 140) { clearTimeout(timer); save(); setStatus('Aggiorno il modello', 'busy'); timer = setTimeout(rebuild, delay); }
async function rebuild() {
  const r = await request();
  if (r.id !== seq) return; // risposta superata da una richiesta piu' recente
  if (r.error) { setStatus('Parametri non validi: ' + r.error, 'err'); return; }
  last = r;
  viewer.setModel(r, r.meta);
  viewer.setColors(P.colors, P.pattern.twoTone);
  viewer.showPhone(showPhone, P, r.meta);
  applyAccent();
  setStatus(`Pronto in ${(r.stats.ms / 1000).toFixed(1)} s`, 'ok');
  renderInfo();
  if (r.meta.warnings.length) toast(r.meta.warnings[0]);
  if (tab === 'print') updatePrintStatics();
}
function renderInfo() {
  if (!last) return;
  const m = last.meta, gT = last.stats.bumperVol * 1.21 / 1000 * 0.7, gP = last.stats.plateVol * 1.24 / 1000 * 0.8;
  $('#info').innerHTML = `<b>${m.outerW.toFixed(1)} × ${m.outerH.toFixed(1)} × ${m.Z.toFixed(1)} mm</b><br>Bordo ~${gT.toFixed(0)} g di TPU, piastra ~${gP.toFixed(0)} g di PLA`;
}
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 4500); }

// ---------- rasterizzazione immagine/testo ----------
function otsu(vals) {
  const h = new Float64Array(256); for (const v of vals) h[Math.min(255, Math.max(0, Math.round(v * 255)))]++;
  const tot = vals.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i];
  let sb = 0, wb = 0, best = 0, th = 128;
  for (let i = 0; i < 256; i++) {
    wb += h[i]; if (!wb) continue; const wf = tot - wb; if (!wf) break;
    sb += i * h[i]; const mb = sb / wb, mf = (sum - sb) / wf, v = wb * wf * (mb - mf) ** 2;
    if (v > best) { best = v; th = i; }
  }
  return th / 255;
}
function rasterize() {
  const kind = P.pattern.kind;
  if (kind !== 'image' && kind !== 'text') return null;
  const g = gridSpec(P);
  const c = document.createElement('canvas'); c.width = g.nx; c.height = g.ny;
  const x = c.getContext('2d', { willReadFrequently: true });
  let mode = 'binary', contrast = 1, th = 0.5, ink = 'light', auto = false;
  if (kind === 'image') {
    if (!imgEl) return null;
    const I = P.pattern.image; mode = I.mode; contrast = I.contrast; th = I.threshold; ink = I.ink; auto = I.auto;
    x.fillStyle = ink === 'dark' ? '#fff' : '#000'; x.fillRect(0, 0, g.nx, g.ny);
    const iw = imgEl.naturalWidth || imgEl.width || 1024, ih = imgEl.naturalHeight || imgEl.height || 1024;
    const k = (I.fit === 'cover' ? Math.max : Math.min)(g.nx / iw, g.ny / ih) * I.zoom;
    const w = iw * k, h = ih * k;
    if ('filter' in x && I.blur > 0) x.filter = `blur(${(I.blur / g.cell).toFixed(2)}px)`;
    x.drawImage(imgEl, (g.nx - w) / 2 + I.offx * g.nx / 2, (g.ny - h) / 2 - I.offy * g.ny / 2, w, h);
  } else {
    const T = P.pattern.text;
    x.fillStyle = '#000'; x.fillRect(0, 0, g.nx, g.ny);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.translate(g.nx / 2, g.ny / 2); x.rotate(-T.angle * Math.PI / 180);
    const lines = String(T.value || ' ').split('\n');
    let fs = 100; x.font = `${T.weight} ${fs}px ${T.font}`;
    const wMax = Math.max(...lines.map(l => x.measureText(l).width)) || 1;
    fs = Math.min(fs * (T.size * g.nx) / wMax, g.ny / lines.length * 0.9);
    x.font = `${T.weight} ${fs}px ${T.font}`;
    lines.forEach((l, i) => x.fillText(l, 0, (i - (lines.length - 1) / 2) * fs * 1.1));
  }
  const d = x.getImageData(0, 0, g.nx, g.ny).data, out = new Float32Array(g.nx * g.ny);
  const score = new Float32Array(g.nx * g.ny);
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const o = ((g.ny - 1 - j) * g.nx + i) * 4;
    const lum = (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;
    score[j * g.nx + i] = ink === 'dark' ? 1 - lum : lum; // 1 = rilievo
  }
  if (mode === 'binary' && kind === 'image' && auto) th = otsu(score);
  for (let n = 0; n < score.length; n++) {
    let v = score[n];
    if (mode === 'binary') { const t = Math.max(0, Math.min(1, (v - (th - .06)) / .12)); v = t * t * (3 - 2 * t); }
    else v = Math.max(0, Math.min(1, (v - .5) * contrast + .5));
    out[n] = v;
  }
  return out;
}
function loadImage(file) {
  if (!file || !(file.type.startsWith('image/') || /\.svg$/i.test(file.name))) return toast('Scegli un file immagine (PNG, JPG, WebP, SVG).');
  const url = URL.createObjectURL(file);
  const im = new Image();
  im.onload = () => { imgEl = im; P.pattern.image.dataUrl = url; P.pattern.kind = 'image'; P.plate.cell = Math.min(P.plate.cell, 0.4); patCat = 'own'; render(); schedule(60); toast('Immagine caricata'); };
  im.onerror = () => toast('Impossibile leggere questa immagine.');
  im.src = url;
}
function loadPhoto(file) {
  if (!file || !file.type.startsWith('image/')) return toast('Scegli una foto (PNG o JPG).');
  const im = new Image(); im.onload = () => { photoEl = im; drawEditor(); }; im.src = URL.createObjectURL(file);
}

// ---------- componenti UI ----------
const range = (path, label, min, max, step, unit = '') => {
  const v = get(P, path);
  return `<div class="row"><label for="r-${path}">${label}</label><span class="val" data-val="${path}">${fmt(v, step)}${unit ? ' ' + unit : ''}</span>
  <input id="r-${path}" type="range" data-p="${path}" data-unit="${unit}" data-step="${step}" min="${min}" max="${max}" step="${step}" value="${v}" style="--p:${(v - min) / (max - min) * 100}%"></div>`;
};
const seg = (path, opts) => { const v = get(P, path); return `<div class="seg" role="group">${opts.map(([k, l]) => `<button type="button" data-seg="${path}" data-v="${k}" aria-pressed="${v === k}">${l}</button>`).join('')}</div>`; };
const sw = (path, label) => `<label class="switch"><span>${label}</span><input type="checkbox" data-p="${path}" ${get(P, path) ? 'checked' : ''}><span class="tr"></span></label>`;
const num = (path, label, step = 0.1) => `<label class="fl">${label}<input type="number" data-p="${path}" step="${step}" value="${get(P, path)}" inputmode="decimal"></label>`;
const color = (path, label) => `<label class="sw"><input type="color" data-p="${path}" value="${get(P, path)}" aria-label="${label}">${label}</label>`;
const note = (t, cls = '', icon = 'triangle-alert') => `<div class="note ${cls}">${ICON(icon)}<div>${t}</div></div>`;

const TABS = [
  ['phone', 'smartphone', 'Telefono'], ['case', 'layers', 'Cover'], ['pattern', 'palette', 'Motivo'],
  ['mag', 'magnet', 'Magneti'], ['btn', 'mouse-pointer-click', 'Tasti'], ['print', 'printer', 'Stampa']
];
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([k, ic, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}">${ICON(ic)}<span>${l}</span></button>`).join('');
}

// ---------- miniature pattern ----------
const thumbCache = new Map();
function makeThumb(p) {
  if (thumbCache.has(p.id)) return thumbCache.get(p.id);
  const n = 56, cell = 0.9, g = { nx: n, ny: n, cell, x0: -(n - 1) * cell / 2, y0: -(n - 1) * cell / 2, sx: (n - 1) * cell, sy: (n - 1) * cell };
  let data;
  try { data = p.make(g, patternDefaults(p.id), 7); } catch { data = new Float32Array(n * n); }
  const c = document.createElement('canvas'); c.width = n; c.height = n;
  const x = c.getContext('2d'), im = x.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = data[(n - 1 - j) * n + i], o = (j * n + i) * 4;
    im.data[o] = 244 - v * 216; im.data[o + 1] = 245 - v * 210; im.data[o + 2] = 246 - v * 206; im.data[o + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  const url = c.toDataURL(); thumbCache.set(p.id, url); return url;
}
let thumbToken = 0;
function paintThumbs() {
  const token = ++thumbToken;
  const els = [...document.querySelectorAll('canvas[data-th]')];
  const step = () => {
    if (token !== thumbToken) return;
    const el = els.shift(); if (!el) return;
    const url = makeThumb(patternById(el.dataset.th)), im = new Image();
    im.onload = () => { if (el.isConnected) el.getContext('2d').drawImage(im, 0, 0, el.width, el.height); };
    im.src = url; setTimeout(step, 0);
  };
  setTimeout(step, 0);
}

// ---------- editor fotocamere/tasti ----------
const ED_H = 330;
function edMetrics() {
  const { W, H } = P.phone, s = ED_H / H, pad = 16;
  return { s, pad, w: Math.round(W * s + pad * 2), h: Math.round(ED_H + pad * 2) };
}
function drawEditor() {
  const cv = $('#ed'); if (!cv) return;
  const { W, H, R } = P.phone, m = edMetrics(), dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = m.w * dpr; cv.height = m.h * dpr; cv.style.width = m.w + 'px'; cv.style.height = m.h + 'px';
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, m.w, m.h);
  const rr = (X, Y, w, h, r) => { x.beginPath(); x.roundRect(X, Y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
  rr(m.pad, m.pad, W * m.s, H * m.s, R * m.s);
  x.save(); x.clip();
  x.fillStyle = '#eef0f2'; x.fillRect(0, 0, m.w, m.h);
  if (photoEl) { x.globalAlpha = 0.8; x.drawImage(photoEl, m.pad, m.pad, W * m.s, H * m.s); x.globalAlpha = 1; }
  x.restore();
  rr(m.pad, m.pad, W * m.s, H * m.s, R * m.s); x.strokeStyle = '#1c2328'; x.lineWidth = 1.5; x.stroke();
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent-ui').trim() || '#2f6bd8';
  P.phone.cams.forEach((c, i) => {
    const X = m.pad + c.x * m.s, Y = m.pad + c.y * m.s, w = c.w * m.s, h = c.h * m.s;
    if (c.t === 'c') { x.beginPath(); x.arc(X, Y, w / 2, 0, 7); } else rr(X - w / 2, Y - h / 2, w, h, c.r * m.s);
    const on = sel.type === 'cam' && sel.i === i;
    x.fillStyle = on ? acc : '#1c2328'; x.globalAlpha = on ? 0.85 : 0.7; x.fill(); x.globalAlpha = 1;
    x.strokeStyle = on ? acc : '#1c2328'; x.lineWidth = on ? 2 : 1; x.stroke();
  });
  P.phone.buttons.forEach((b, i) => {
    const left = b.side === 'right'; // visto da dietro il lato destro e' a sinistra
    const X = left ? m.pad : m.pad + W * m.s, Y = m.pad + b.y * m.s, L = b.len * m.s;
    const on = sel.type === 'btn' && sel.i === i, off = P.buttons.enabled && !P.buttons.enabled.includes(i);
    x.fillStyle = on ? '#1c2328' : off ? '#c5cbd0' : acc;
    rr(X + (left ? -5 : -1), Y - L / 2, 6, L, 3); x.fill();
  });
}
function edPos(e) {
  const cv = $('#ed'), r = cv.getBoundingClientRect(), m = edMetrics();
  return { mx: (e.clientX - r.left - m.pad) / m.s, my: (e.clientY - r.top - m.pad) / m.s, tol: 7 / m.s };
}
function edHit(p) {
  const { W } = P.phone;
  for (let i = P.phone.buttons.length - 1; i >= 0; i--) {
    const b = P.phone.buttons[i], ex = b.side === 'right' ? 0 : W;
    if (Math.abs(p.mx - ex) < p.tol * 1.4 && Math.abs(p.my - b.y) < b.len / 2 + p.tol * 0.4) return { type: 'btn', i };
  }
  for (let i = P.phone.cams.length - 1; i >= 0; i--) {
    const c = P.phone.cams[i];
    if (Math.abs(p.mx - c.x) <= c.w / 2 + p.tol * 0.3 && Math.abs(p.my - c.y) <= c.h / 2 + p.tol * 0.3) return { type: 'cam', i };
  }
  return null;
}
let drag = null;
function edDown(e) {
  const p = edPos(e), h = edHit(p);
  if (!h) { return; }
  sel = h; $('#ed').setPointerCapture(e.pointerId);
  const o = h.type === 'cam' ? P.phone.cams[h.i] : P.phone.buttons[h.i];
  drag = { h, p0: p, x0: o.x, y0: o.y };
  drawEditor(); refreshShapeList();
}
function edMove(e) {
  if (!drag) { const h = edHit(edPos(e)); $('#ed').style.cursor = h ? 'grab' : 'default'; return; }
  const p = edPos(e), dx = p.mx - drag.p0.mx, dy = p.my - drag.p0.my, { W, H } = P.phone;
  if (drag.h.type === 'cam') {
    const c = P.phone.cams[drag.h.i];
    c.x = Math.round(Math.max(0, Math.min(W, drag.x0 + dx)) * 10) / 10; c.y = Math.round(Math.max(0, Math.min(H, drag.y0 + dy)) * 10) / 10;
  } else {
    const b = P.phone.buttons[drag.h.i]; b.y = Math.round(Math.max(b.len / 2, Math.min(H - b.len / 2, drag.y0 + dy)) * 10) / 10;
  }
  drawEditor(); syncShapeInputs(); schedule(200);
}
function edUp() { drag = null; }
function shapeRows() {
  const cams = P.phone.cams.map((c, i) => `<div class="shape ${sel.type === 'cam' && sel.i === i ? 'sel' : ''}" data-sel="cam:${i}">
    <span title="${c.t === 'c' ? 'Cerchio' : 'Rettangolo'}">${ICON(c.t === 'c' ? 'circle-dot' : 'square')}</span>
    <input type="number" step="0.1" data-p="phone.cams.${i}.x" value="${c.x}" aria-label="X"><input type="number" step="0.1" data-p="phone.cams.${i}.y" value="${c.y}" aria-label="Y">
    <input type="number" step="0.1" data-p="phone.cams.${i}.w" value="${c.w}" aria-label="${c.t === 'c' ? 'Diametro' : 'Larghezza'}">
    ${c.t === 'c' ? '<span></span>' : `<input type="number" step="0.1" data-p="phone.cams.${i}.h" value="${c.h}" aria-label="Altezza">`}
    <button data-del-cam="${i}" aria-label="Elimina forma">${ICON('x')}</button></div>`).join('');
  return cams || '<p class="hint">Nessuna fotocamera: la piastra resta intera.</p>';
}
function refreshShapeList() { const el = $('#shapes'); if (el) el.innerHTML = shapeRows(); }
function syncShapeInputs() {
  document.querySelectorAll('#shapes input[data-p]').forEach(inp => { const v = get(P, inp.dataset.p); if (document.activeElement !== inp && v !== undefined) inp.value = v; });
  document.querySelectorAll('[data-btnrow] input[data-p]').forEach(inp => { const v = get(P, inp.dataset.p); if (document.activeElement !== inp && v !== undefined) inp.value = v; });
}

// ---------- viste ----------
const V = {
  phone() {
    const groups = {};
    PHONES.forEach(p => (groups[p.brand] ||= []).push(p));
    const opts = Object.entries(groups).map(([b, ps]) => `<optgroup label="${b}">${ps.map(p => `<option value="${p.id}" ${p.id === P.phoneId ? 'selected' : ''}>${p.name}</option>`).join('')}</optgroup>`).join('');
    const ph = phoneById(P.phoneId);
    return `<h2>Modello</h2>
    <select id="phoneSel" aria-label="Modello di telefono">${opts}</select>
    <p class="src">${ph.src ? 'Fotocamere, tasti e angoli misurati da: ' + ph.src + '.' : 'Fotocamere e tasti stimati: controllali nel disegno qui sotto.'}${ph.note ? ' ' + ph.note + '.' : ''}</p>
    ${ph.approx ? note('Alcune misure di questo modello sono stimate: confrontale con il tuo telefono prima di stampare.') : ''}
    <h2>Dimensioni (mm)</h2>
    <div class="grid2">${num('phone.W', 'Larghezza')}${num('phone.H', 'Altezza')}${num('phone.T', 'Spessore')}${num('phone.R', 'Raggio angoli')}</div>
    <p class="hint">Larghezza, altezza e spessore vengono dalle schede ufficiali.</p>
    <h2>Fotocamere e tasti</h2>
    <div class="editor"><canvas id="ed" aria-label="Disegno del retro del telefono: trascina fotocamere e tasti"></canvas></div>
    <div class="legend"><span><i style="background:#1c2328;opacity:.7"></i>Fotocamera</span><span><i style="background:var(--accent-ui)"></i>Tasto laterale</span></div>
    <p class="hint">Vista da dietro. <b>Trascina</b> le forme per allinearle al tuo telefono; i tasti si spostano lungo il bordo.</p>
    <div class="btns three">
      <button class="btn sm" data-act="addc">${ICON('circle-dot')}Cerchio</button>
      <button class="btn sm" data-act="addr">${ICON('square')}Rettangolo</button>
      <label class="btn sm" for="photo" style="cursor:pointer">${ICON('image')}Foto</label>
    </div>
    <input type="file" id="photo" accept="image/*" class="vh">
    <div class="shapes" id="shapes">${shapeRows()}</div>
    <p class="hint">Colonne: X, Y (centro dall'angolo in alto a sinistra), larghezza, altezza. Con <b>Foto</b> puoi sovrapporre uno scatto dritto del retro del telefono, ritagliato sui bordi, per allineare tutto a occhio.</p>
    <h2>Tolleranza</h2>
    ${range('fit.tol', 'Gioco per lato', 0, 0.6, 0.05, 'mm')}
    <p class="hint">0,2 mm va bene per TPU 95A. Se la cover risulta larga scendi a 0,1; se non entra sali a 0,3. Per provare senza sprecare materiale stampa l'anello di prova (scheda Stampa).</p>`;
  },
  case() {
    return `<h2>Bordo in TPU</h2>
    ${range('bumper.wall', 'Spessore parete', 1.4, 3, 0.1, 'mm')}
    ${range('bumper.lipOv', 'Bordo sullo schermo', 0.8, 2.4, 0.1, 'mm')}
    ${range('bumper.lipT', 'Rialzo schermo', 0.8, 2, 0.2, 'mm')}
    ${range('bumper.chamfer', 'Smusso esterno', 0, 1.2, 0.1, 'mm')}
    <h2>Fianchi</h2>
    ${seg('bumper.side', [['smooth', 'Lisci'], ['ribs', 'Nervature'], ['wave', 'Onda']])}
    <h2>Angoli esterni</h2>
    ${seg('bumper.corners', [['follow', 'Seguono il telefono'], ['sharp', 'Vivi']])}
    <h2>Lato inferiore</h2>
    ${seg('bumper.bottom', [['cut', 'Fori precisi'], ['open', 'Aperto']])}
    <h2>Piastra posteriore in PLA</h2>
    ${range('plate.T', 'Spessore base', 1.2, 3, 0.2, 'mm')}
    ${range('bumper.engage', 'Presa nel bordo', 0.3, 1, 0.1, 'mm')}
    ${range('bumper.rimOv', 'Bordo posteriore', 0.6, 1.6, 0.1, 'mm')}
    ${sw('plate.guard', 'Anello protezione fotocamera')}
    ${P.plate.guard ? range('plate.guardH', 'Altezza anello', 0.4, 2, 0.2, 'mm') : ''}
    ${range('plate.camMargin', 'Margine fotocamera', 0.6, 3, 0.2, 'mm')}
    <p class="hint">La piastra si incastra nella scanalatura del bordo in TPU: per cambiare stile basta stampare un'altra piastra.</p>`;
  },
  pattern() {
    const k = P.pattern.kind, pat = patternById(k);
    P.pattern.p = { ...patternDefaults(k), ...P.pattern.p };
    const list = PATTERNS.filter(p => p.cat === patCat);
    const items = list.map(p => `<button class="pitem" data-pat="${p.id}" aria-pressed="${p.id === k}">${p.cat === 'own' && p.id !== 'none' ? `<span class="ph-icon">${ICON(p.id === 'image' ? 'image' : 'type')}</span>` : p.id === 'none' ? `<span class="ph-icon">${ICON('square')}</span>` : `<canvas width="56" height="56" data-th="${p.id}"></canvas>`}${p.label}</button>`).join('');
    let h = `<h2>Motivo della piastra</h2>
    <div class="cats" role="group">${CATEGORIES.map(c => `<button class="cat" data-cat="${c.id}" aria-pressed="${c.id === patCat}">${c.label}</button>`).join('')}</div>
    <div class="pgrid">${items}</div>`;
    if (k === 'image') {
      const I = P.pattern.image;
      h += `<h2>La tua immagine</h2>
      <label class="drop" for="file" tabindex="0" id="drop">${ICON('upload')}<span>${imgEl ? 'Cambia immagine' : 'Scegli un file o trascinalo qui'}</span><small>PNG, JPG, WebP o SVG. Puoi anche incollarla con Ctrl+V.</small></label>`;
      if (imgEl) h += `<img class="thumb" alt="Anteprima" src="${I.dataUrl}">
      <h2>Rilievo da</h2>${seg('pattern.image.ink', [['dark', 'Parti scure'], ['light', 'Parti chiare']])}
      <h2>Come diventa rilievo</h2>${seg('pattern.image.mode', [['binary', 'Sagoma'], ['relief', 'Sfumature']])}
      ${I.mode === 'binary' ? `${sw('pattern.image.auto', 'Soglia automatica')}${I.auto ? '' : range('pattern.image.threshold', 'Soglia', 0.1, 0.9, 0.01)}` : range('pattern.image.contrast', 'Contrasto', 0.4, 3, 0.05)}
      ${range('pattern.image.blur', 'Ammorbidimento', 0, 3, 0.1, 'mm')}
      <h2>Inquadratura</h2>${seg('pattern.image.fit', [['contain', 'Contieni'], ['cover', 'Riempi']])}
      ${range('pattern.image.zoom', 'Zoom', 0.3, 3, 0.05)}${range('pattern.image.offx', 'Sposta in orizzontale', -1, 1, 0.02)}${range('pattern.image.offy', 'Sposta in verticale', -1, 1, 0.02)}`;
    } else if (k === 'text') {
      const T = P.pattern.text;
      h += `<h2>Testo</h2><textarea class="field" data-p="pattern.text.value" rows="2" style="height:auto;padding:9px 12px;resize:vertical" aria-label="Testo">${T.value}</textarea>
      <div class="row" style="grid-template-columns:1fr"><label class="fl">Carattere<select data-p="pattern.text.font">${['sans-serif', 'serif', 'monospace', 'cursive', 'Impact'].map(f => `<option ${T.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label></div>
      ${range('pattern.text.size', 'Larghezza', 0.2, 0.95, 0.01)}${range('pattern.text.angle', 'Rotazione', -90, 90, 1, '°')}`;
    } else if (pat.params.length) {
      h += `<h2>Parametri</h2>` + pat.params.map(q => range('pattern.p.' + q.k, q.label, q.min, q.max, q.step, q.unit || '')).join('');
      h += `<button class="btn sm" data-act="seed">${ICON('rotate-3d')}Nuova variante</button>`;
    }
    if (k !== 'none') {
      h += `<h2>Rilievo</h2>${range('pattern.amp', 'Altezza', 0.2, 1.6, 0.1, 'mm')}${range('plate.cell', 'Dettaglio (più basso = più fine)', 0.3, 1, 0.05, 'mm')}${sw('pattern.invert', 'Inverti rilievo')}
      ${sw('pattern.twoTone', 'Due colori (un cambio filamento)')}
      <p class="hint">${P.pattern.twoTone ? 'Il rilievo viene stampato in un secondo colore: la stampante si ferma a metà e cambi filamento a mano, senza AMS.' : 'Tutta la piastra resta in un solo colore.'}</p>
      <p class="hint"><b>Tattile:</b> da 0,8 mm in su il rilievo si sente bene sotto le dita e resta protetto dal bordo in TPU.</p>`;
    }
    h += `<h2>Colori</h2><div class="swatches">${color('colors.bumper', 'Bordo')}${color('colors.plate', 'Piastra')}${P.pattern.twoTone && k !== 'none' ? color('colors.relief', 'Rilievo') : ''}</div>`;
    return h;
  },
  mag() {
    const M = P.mag;
    return `<h2>Magneti</h2>
    ${seg('mag.mode', [['none', 'Nessuno'], ['ring', 'Anello'], ['discs', 'Dischetti'], ['open', 'Tasca aperta']])}
    ${M.mode === 'ring' || M.mode === 'open' ? `<h2>Anello magnetico</h2>${range('mag.od', 'Diametro esterno', 40, 60, 0.5, 'mm')}${range('mag.id', 'Diametro interno', 30, 54, 0.5, 'mm')}${range('mag.depth', 'Spessore magnete', 0.4, 2, 0.2, 'mm')}` : ''}
    ${M.mode === 'discs' ? `<h2>Dischetti</h2>${range('mag.discD', 'Diametro', 3, 10, 0.5, 'mm')}${range('mag.discH', 'Spessore', 0.5, 3, 0.5, 'mm')}${range('mag.discN', 'Quantità', 6, 24, 1)}${range('mag.discR', 'Raggio della corona', 18, 28, 0.5, 'mm')}` : ''}
    ${M.mode !== 'none' ? `${range('mag.y', 'Posizione verticale', -25, 25, 0.5, 'mm')}` : ''}
    ${M.mode === 'ring' || M.mode === 'discs' ? note('I magneti si inseriscono <b>durante la stampa</b>: il file contiene già una pausa al layer giusto. La scheda Stampa dice quando.', 'info', 'info') : ''}
    ${M.mode === 'open' ? note('La tasca resta aperta sul lato del telefono: incolla il magnete e lascialo premere contro il retro. Nessuna pausa necessaria.', 'info', 'info') : ''}
    ${M.mode === 'discs' ? note('Con i dischetti controlla le polarità: alterna N e S come negli anelli MagSafe originali, altrimenti i caricatori non si agganciano bene.') : ''}
    <p class="hint">Per la ricarica magnetica usa magneti da 0,8–1 mm e tieni la piastra sotto i 2,6 mm in totale. Misura il tuo anello prima di stampare.</p>`;
  },
  btn() {
    const B = P.buttons, list = P.phone.buttons;
    const rows = list.map((b, i) => {
      const on = !B.enabled || B.enabled.includes(i);
      return `<div data-btnrow><div class="btnrow"><label class="switch" style="margin:0"><span>${b.name ? b.name + ', ' : ''}${b.side === 'right' ? 'lato destro' : 'lato sinistro'}, ${b.len} mm${b.cut ? ' (sempre forato)' : ''}</span><input type="checkbox" data-bt="${i}" ${on ? 'checked' : ''}><span class="tr"></span></label></div>
      <div class="grid2" style="margin:2px 0 8px">${num('phone.buttons.' + i + '.y', 'Dall\'alto', 0.5)}${num('phone.buttons.' + i + '.len', 'Lunghezza', 0.5)}</div></div>`;
    }).join('');
    return `<h2>Tasti laterali</h2>
    ${seg('buttons.mode', [['tab', 'Pad'], ['cutout', 'Foro'], ['closed', 'Chiusi']])}
    <p class="hint">${B.mode === 'tab' ? '<b>Pad su membrana:</b> un cappuccio in rilievo, circondato da una gola che lascia una pellicola flessibile di TPU. Nessun foro, nessun pezzo da comprare, spessore invariato. Il pad è più lungo del tasto: fa da leva e si trova al tatto.' : B.mode === 'cutout' ? 'Il tasto resta scoperto: massimo feeling, meno protezione.' : 'Parete piena: il tasto si preme attraverso il TPU.'}</p>
    ${B.mode === 'tab' ? `<h2>Forma del pad</h2>${seg('buttons.pad', [['soft', 'Morbido'], ['flat', 'Piatto'], ['ridged', 'Zigrinato']])}
    ${range('buttons.extra', 'Lunghezza extra', 2, 14, 1, 'mm')}${range('buttons.padH', 'Altezza pad', 0.6, 2, 0.2, 'mm')}
    ${range('buttons.membrane', 'Membrana', 0.6, 1.2, 0.1, 'mm')}${range('buttons.slit', 'Larghezza gola', 0.5, 1.2, 0.1, 'mm')}
    <p class="hint">Membrana più sottile = tasto più morbido ma meno resistente. 0,8 mm sono 4 passate di ugello: se si strappa sali a 1,0.</p>` : ''}
    ${B.mode !== 'closed' ? `<h2>Tasti del telefono</h2><p class="hint" style="margin-top:0">Puoi anche trascinarli nel disegno della scheda Telefono.</p>${rows}` : ''}`;
  },
  print() {
    return `<h2>Stampante</h2>
    <div class="kv"><span>Macchina</span><b>Bambu Lab A1 mini</b><span>Ugello</span><b>0,4 mm</b><span>Layer</span><b>0,2 mm</b><span>AMS</span><b>non serve</b></div>
    <h2>Bordo in TPU</h2>
    <div class="btns two">
      <button class="btn" data-act="bumper3mf">${ICON('package')}3MF Bambu</button>
      <button class="btn" data-act="bumperstl">${ICON('file-box')}STL</button>
    </div>
    <p class="hint">Fronte sul piano, nessun supporto. Bobina esterna con TPU 95A, 230 °C, velocità ridotta (profilo già nel preset).</p>
    <h2>Piastra in PLA</h2>
    <div class="btns two">
      <button class="btn" data-act="plate3mf">${ICON('package')}3MF Bambu</button>
      <button class="btn" data-act="platestl">${ICON('file-box')}STL</button>
    </div>
    <div id="pauses"></div>
    <h2>Preset Bambu Lab</h2>
    <button class="btn wide" data-act="presets">${ICON('printer')}Scarica preset A1 mini (ZIP)</button>
    <p class="hint">Contiene processo e filamento per TPU e PLA. In Bambu Studio: <b>File → Importa → Importa configurazioni</b>.</p>
    <h2>Prova di misura</h2>
    <button class="btn wide" data-act="fit">${ICON('ruler')}Scarica anello di prova</button>
    <p class="hint">Stampa solo la parte anteriore del bordo, circa 15 minuti. Se il telefono entra con un leggero sforzo, la misura è giusta.</p>
    <h2>Controlli prima di stampare</h2>
    <ol class="steps"><li>Stampa prima l'<b>anello di prova</b>.</li><li>Poi il <b>bordo in TPU</b>, fronte sul piano.</li><li>Infine la <b>piastra in PLA</b>; ferma e riprendi quando richiesto.</li><li>Incastra la piastra da dietro e inserisci il telefono.</li></ol>`;
  }
};

function updatePrintStatics() {
  const el = $('#pauses'); if (!el || !last) return;
  const ps = last.meta.pauses;
  el.innerHTML = ps.length ? `<div class="note info">${ICON('info')}<div>${ps.map(p => `Layer <b>${Math.round(p.top_z / LAYER)}</b> (${p.top_z.toFixed(1)} mm): ${p.type === 'pause' ? 'pausa per i magneti' : 'cambio colore'}`).join('<br>')}<br><span style="color:var(--graphite)">Già inseriti nel 3MF. Con l'STL aggiungili a mano dal cursore dei layer.</span></div></div>` : '';
}

function render() {
  renderTabs();
  const b = $('#body'); const st = b.scrollTop;
  b.innerHTML = V[tab](); b.scrollTop = st;
  updatePrintStatics();
  if (tab === 'phone') { drawEditor(); const ed = $('#ed'); ed.onpointerdown = edDown; ed.onpointermove = edMove; ed.onpointerup = edUp; ed.onpointercancel = edUp; }
  if (tab === 'pattern') paintThumbs();
}

// ---------- eventi ----------
$('#tabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; $('#body').scrollTop = 0; render(); } });
$('#goExport').onclick = () => { tab = 'print'; render(); };
$('#body').addEventListener('input', e => {
  const t = e.target; const p = t.dataset.p;
  if (!p) return;
  let v;
  if (t.type === 'checkbox') v = t.checked;
  else if (t.type === 'range' || t.type === 'number') { v = parseFloat(t.value); if (Number.isNaN(v)) return; }
  else v = t.value;
  set(P, p, v);
  const m = p.match(/^phone\.cams\.(\d+)\.(w|h)$/);
  if (m) { const c = P.phone.cams[+m[1]]; if (c.t === 'c') { c.h = c.w; c.r = c.w / 2; } }
  if (t.type === 'range') {
    t.style.setProperty('--p', ((v - t.min) / (t.max - t.min) * 100) + '%');
    const lab = $(`[data-val="${p}"]`); if (lab) lab.textContent = fmt(v, +t.dataset.step) + (t.dataset.unit ? ' ' + t.dataset.unit : '');
  }
  if (t.type === 'checkbox' && ['plate.guard', 'pattern.twoTone', 'pattern.image.auto'].includes(p)) render();
  if (p.startsWith('colors.')) { viewer.setColors(P.colors, P.pattern.twoTone); applyAccent(); save(); drawEditor(); return; }
  if (p === 'pattern.twoTone') viewer.setColors(P.colors, P.pattern.twoTone);
  if (p.startsWith('phone.')) drawEditor();
  schedule();
});
$('#body').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'phoneSel') { P.phoneId = t.value; P.phone = clonePhone(phoneById(t.value)); P.buttons.enabled = null; P.bumper.corners = P.phone.outer || 'follow'; sel = { type: 'cam', i: 0 }; render(); schedule(60); }
  else if (t.id === 'photo') { loadPhoto(t.files[0]); t.value = ''; }
  else if (t.dataset.bt !== undefined) {
    const n = P.phone.buttons.length; const cur = P.buttons.enabled || [...Array(n).keys()];
    const i = +t.dataset.bt; P.buttons.enabled = t.checked ? [...new Set([...cur, i])] : cur.filter(x => x !== i); schedule(60);
  } else if (t.tagName === 'SELECT' && t.dataset.p) { set(P, t.dataset.p, t.value); schedule(60); }
});
$('#body').addEventListener('click', e => {
  const s = e.target.closest('[data-seg]');
  if (s) { set(P, s.dataset.seg, s.dataset.v); render(); schedule(60); return; }
  const cat = e.target.closest('[data-cat]');
  if (cat) { patCat = cat.dataset.cat; render(); return; }
  const c = e.target.closest('[data-pat]');
  if (c) { P.pattern.kind = c.dataset.pat; if (c.dataset.pat === 'image' || c.dataset.pat === 'text') P.plate.cell = Math.min(P.plate.cell, 0.4); P.pattern.p = patternDefaults(c.dataset.pat); render(); schedule(60); return; }
  const dc = e.target.closest('[data-del-cam]');
  if (dc) { P.phone.cams.splice(+dc.dataset.delCam, 1); sel = { type: 'cam', i: 0 }; render(); schedule(60); return; }
  const ss = e.target.closest('[data-sel]');
  if (ss && !e.target.closest('input')) { const [t, i] = ss.dataset.sel.split(':'); sel = { type: t, i: +i }; drawEditor(); refreshShapeList(); return; }
  const a = e.target.closest('[data-act]');
  if (a) action(a.dataset.act);
});
$('#body').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'drop') { e.preventDefault(); $('#file').click(); } });
$('#file').addEventListener('change', e => { loadImage(e.target.files[0]); e.target.value = ''; });
// trascinamento e incolla: funzionano ovunque nella pagina
addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; if (f) { e.preventDefault(); loadImage(f); } });
addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/')); if (f) loadImage(f); });

document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => viewer.view(b.dataset.view));
$('#tgExplode').onclick = e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); viewer.target = on ? 1 : 0; };
$('#tgPhone').onclick = e => { showPhone = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', showPhone); if (last) viewer.showPhone(showPhone, P, last.meta); };

// ---------- azioni ----------
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function action(a) {
  if (a === 'seed') { P.pattern.seed = Math.floor(Math.random() * 9999); schedule(60); return; }
  if (a === 'addc' || a === 'addr') {
    const { W, H } = P.phone;
    P.phone.cams.push(a === 'addc' ? { t: 'c', x: W / 2, y: H / 4, w: 12, h: 12, r: 6 } : { t: 'r', x: W / 2, y: H / 4, w: 20, h: 20, r: 6 });
    sel = { type: 'cam', i: P.phone.cams.length - 1 }; drawEditor(); refreshShapeList(); schedule(60); return;
  }
  if (!last) return toast('Attendi la fine del calcolo.');
  const base = slug(phoneById(P.phoneId).name);
  const pname = phoneById(P.phoneId).name;
  if (a === 'bumperstl') download(stl(last.bumper, 'bumper'), `${base}-bordo-tpu.stl`);
  else if (a === 'platestl') download(stl(last.plate, 'plate'), `${base}-piastra-pla.stl`);
  else if (a === 'bumper3mf' || a === 'plate3mf') {
    const isB = a === 'bumper3mf';
    const r = threeMF(isB ? last.bumper : last.plate, { name: `${pname} ${isB ? 'bordo TPU' : 'piastra PLA'}`, kind: isB ? 'tpu' : 'pla', pauses: isB ? [] : last.meta.pauses });
    if (!r.fits) toast('Attenzione: il pezzo supera i 180 mm del piano A1 mini.');
    download(r.blob, `${base}-${isB ? 'bordo-tpu' : 'piastra-pla'}.3mf`);
  } else if (a === 'presets') {
    const files = {
      'LEGGIMI.txt': 'CaseStudio Open - preset per Bambu Lab A1 mini (ugello 0.4)\r\nBambu Studio: File > Importa > Importa configurazioni, seleziona i 4 file .json.\r\n',
      'CaseStudio TPU bordo @A1M.process.json': JSON.stringify(processPreset('tpu', 'CaseStudio TPU bordo @A1M'), null, 2),
      'CaseStudio TPU 95A @A1M.filament.json': JSON.stringify(filamentPreset('tpu', 'CaseStudio TPU 95A @A1M'), null, 2),
      'CaseStudio PLA piastra @A1M.process.json': JSON.stringify(processPreset('pla', 'CaseStudio PLA piastra @A1M'), null, 2),
      'CaseStudio PLA @A1M.filament.json': JSON.stringify(filamentPreset('pla', 'CaseStudio PLA @A1M'), null, 2)
    };
    download(zip(files), 'casestudio-preset-a1-mini.zip');
  } else if (a === 'fit') {
    setStatus('Preparo l\'anello di prova', 'busy');
    const r = await request(true);
    if (r.error) return setStatus(r.error, 'err');
    download(stl(r.bumper, 'fit-test'), `${base}-anello-di-prova.stl`);
    setStatus('Anello di prova scaricato', 'ok');
    seq++; // invalida risposte in corso del modello principale
    schedule(30);
  }
}

// ---------- accento: il colore del filamento, reso leggibile ----------
function lum(hex) { const c = hex.replace('#', ''), v = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(u => u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function mix(hex, to, t) { const p = h => [0, 2, 4].map(i => parseInt(h.slice(1 + i, 3 + i), 16)); const a = p(hex), b = p(to); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function applyAccent() {
  const base = P.colors.bumper; let ui = base, t = 0;
  while (contrast(ui, '#f4f5f6') < 3.2 && t < 1) { t += 0.1; ui = mix(base, '#1c2328', t); }
  const root = document.documentElement.style;
  root.setProperty('--accent', base); root.setProperty('--accent-ui', ui);
  root.setProperty('--on-accent', contrast(ui, '#ffffff') >= 4.5 ? '#ffffff' : '#1c2328');
}

// ---------- avvio ----------
window.csopen = { viewer, get state() { return P; } };
render();
viewer.view('angle');
applyAccent();
schedule(10);
