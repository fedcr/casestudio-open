import { Viewer } from './viewer.js';
import { PHONES, phoneById, clonePhone } from './phones.js';
import { PATTERNS, patternById, patternDefaults } from './patterns.js';
import { defaults, deepMerge, gridSpec, LAYER } from './params.js';
import { stl, threeMF, download, jsonBlob, processPreset, filamentPreset, zip } from './export.js';

const $ = (s, r = document) => r.querySelector(s);
const ICON = n => `<svg class="i"><use href="sprite.svg#${n}"/></svg>`;
const KEY = 'csopen.v1';

// ---------- stato ----------
let P = defaults();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) P = deepMerge(defaults(), JSON.parse(raw));
} catch { /* storage non disponibile */ }
P.pattern.image.dataUrl = null;
let tab = 'phone';
let showPhone = false;
let imgEl = null;
let last = null;
let seq = 0;

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
function schedule(delay = 140) { clearTimeout(timer); save(); setStatus('Aggiorno il modello…', 'busy'); timer = setTimeout(rebuild, delay); }
async function rebuild() {
  const mine = seq + 1;
  const r = await request();
  if (r.id !== seq || mine > seq) { /* risposta superata */ }
  if (r.id !== seq) return;
  if (r.error) { setStatus('Parametri non validi: ' + r.error, 'err'); return; }
  last = r;
  viewer.setModel(r, r.meta);
  viewer.setColors(P.colors, P.pattern.twoTone);
  viewer.showPhone(showPhone, P, r.meta);
  document.documentElement.style.setProperty('--accent', P.colors.bumper);
  setStatus(`Pronto in ${(r.stats.ms / 1000).toFixed(1)} s`, 'ok');
  renderInfo();
  if (r.meta.warnings.length) toast(r.meta.warnings[0]);
  if (tab === 'print') updatePrintStatics();
}
function renderInfo() {
  if (!last) return;
  const m = last.meta, gT = last.stats.bumperVol * 1.21 / 1000 * 0.7, gP = last.stats.plateVol * 1.24 / 1000 * 0.8;
  $('#info').innerHTML = `<b>${m.outerW.toFixed(1)} × ${m.outerH.toFixed(1)} × ${m.Z.toFixed(1)}</b> mm<br>TPU ≈ <b>${gT.toFixed(0)} g</b> · PLA ≈ <b>${gP.toFixed(0)} g</b>`;
}
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 4500); }

// ---------- rasterizzazione immagine/testo ----------
function rasterize() {
  const kind = P.pattern.kind;
  if (kind !== 'image' && kind !== 'text') return null;
  const g = gridSpec(P);
  const c = document.createElement('canvas'); c.width = g.nx; c.height = g.ny;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#000'; x.fillRect(0, 0, g.nx, g.ny);
  let mode = 'relief', contrast = 1, th = .5;
  if (kind === 'image') {
    if (!imgEl) return null;
    const I = P.pattern.image; mode = I.mode; contrast = I.contrast; th = I.threshold;
    const k = (I.fit === 'cover' ? Math.max : Math.min)(g.nx / imgEl.width, g.ny / imgEl.height) * I.zoom;
    const w = imgEl.width * k, h = imgEl.height * k;
    if ('filter' in x && I.blur > 0) x.filter = `blur(${(I.blur / g.cell).toFixed(2)}px)`;
    x.drawImage(imgEl, (g.nx - w) / 2 + I.offx * g.nx / 2, (g.ny - h) / 2 - I.offy * g.ny / 2, w, h);
  } else {
    const T = P.pattern.text; mode = 'binary'; th = .5;
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.translate(g.nx / 2, g.ny / 2); x.rotate(-T.angle * Math.PI / 180);
    const lines = String(T.value || ' ').split('\n');
    let fs = 100; x.font = `${T.weight} ${fs}px ${T.font}`;
    const wMax = Math.max(...lines.map(l => x.measureText(l).width)) || 1;
    fs = fs * (T.size * g.nx) / wMax; fs = Math.min(fs, g.ny / lines.length * 0.9);
    x.font = `${T.weight} ${fs}px ${T.font}`;
    lines.forEach((l, i) => x.fillText(l, 0, (i - (lines.length - 1) / 2) * fs * 1.1));
  }
  const d = x.getImageData(0, 0, g.nx, g.ny).data, out = new Float32Array(g.nx * g.ny);
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const o = ((g.ny - 1 - j) * g.nx + i) * 4;
    let v = (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;
    if (mode === 'binary') { const t = Math.max(0, Math.min(1, (v - (th - .06)) / .12)); v = t * t * (3 - 2 * t); }
    else v = Math.max(0, Math.min(1, (v - .5) * contrast + .5));
    out[j * g.nx + i] = v;
  }
  return out;
}
function loadImage(file) {
  if (!file || !file.type.startsWith('image/')) return toast('Scegli un file immagine (PNG, JPG, WebP, SVG).');
  const url = URL.createObjectURL(file);
  const im = new Image();
  im.onload = () => { imgEl = im; P.pattern.image.dataUrl = url; P.pattern.kind = 'image'; render(); schedule(60); };
  im.onerror = () => toast('Impossibile leggere questa immagine.');
  im.src = url;
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
  ['mag', 'magnet', 'MagSafe'], ['btn', 'mouse-pointer-click', 'Tasti'], ['print', 'printer', 'Stampa']
];

function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([k, ic, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}" aria-label="${l}" title="${l}">${ICON(ic)}</button>`).join('');
}

const V = {
  phone() {
    const groups = {};
    PHONES.forEach(p => (groups[p.brand] ||= []).push(p));
    const opts = Object.entries(groups).map(([b, ps]) => `<optgroup label="${b}">${ps.map(p => `<option value="${p.id}" ${p.id === P.phoneId ? 'selected' : ''}>${p.name}${p.approx ? ' (stima)' : ''}</option>`).join('')}</optgroup>`).join('');
    const ph = phoneById(P.phoneId);
    return `<h2>Modello</h2>
    <select id="phoneSel" aria-label="Modello di telefono">${opts}</select>
    ${ph.approx ? note('Misure <b>stimate</b>: confrontale con il tuo telefono e correggi i campi sotto, poi stampa l\'anello di prova.') : ''}
    <h2>Dimensioni (mm)</h2>
    <div class="grid2">${num('phone.W', 'Larghezza')}${num('phone.H', 'Altezza')}${num('phone.T', 'Spessore')}${num('phone.R', 'Raggio angoli')}</div>
    <h2>Fotocamera, vista da dietro</h2>
    <div class="grid2">${num('phone.cam.cx', 'Da sinistra')}${num('phone.cam.cy', 'Dall\'alto')}${num('phone.cam.w', 'Larghezza')}${num('phone.cam.h', 'Altezza')}</div>
    <h2>Tolleranza</h2>
    ${range('fit.tol', 'Gioco per lato', 0, 0.6, 0.05, 'mm')}
    <p class="hint">0,2 mm va bene per TPU 95A. Se la cover risulta larga scendi a 0,1; se non entra sali a 0,3. Per provare senza sprecare materiale, stampa l'anello di prova dalla scheda Stampa.</p>`;
  },
  case() {
    return `<h2>Bordo in TPU</h2>
    ${range('bumper.wall', 'Spessore parete', 1.4, 3, 0.1, 'mm')}
    ${range('bumper.lipOv', 'Bordo sullo schermo', 0.8, 2.4, 0.1, 'mm')}
    ${range('bumper.lipT', 'Rialzo schermo', 0.8, 2, 0.2, 'mm')}
    ${range('bumper.chamfer', 'Smusso esterno', 0, 1.2, 0.1, 'mm')}
    <h2>Fianchi</h2>
    ${seg('bumper.side', [['smooth', 'Lisci'], ['ribs', 'Nervature'], ['wave', 'Onda']])}
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
    let h = `<h2>Stile della piastra</h2><div class="chips">${PATTERNS.map(p => `<button class="chip" data-pat="${p.id}" aria-pressed="${p.id === k}">${ICON(p.icon)}${p.label}</button>`).join('')}</div>`;
    if (k === 'image') {
      h += `<h2>La tua immagine</h2>
      <div class="drop" id="drop" tabindex="0" role="button">${ICON('upload')}<span>${imgEl ? 'Cambia immagine' : 'Trascina qui o scegli un file'}</span></div>`;
      if (imgEl) h += `<img class="thumb" alt="Anteprima" src="${P.pattern.image.dataUrl}">
      <h2>Come diventa rilievo</h2>${seg('pattern.image.mode', [['relief', 'Sfumature'], ['binary', 'Due livelli']])}
      ${P.pattern.image.mode === 'binary' ? range('pattern.image.threshold', 'Soglia', 0.1, 0.9, 0.01) : range('pattern.image.contrast', 'Contrasto', 0.4, 3, 0.05)}
      ${range('pattern.image.blur', 'Ammorbidimento', 0, 3, 0.1, 'mm')}
      <h2>Inquadratura</h2>${seg('pattern.image.fit', [['cover', 'Riempi'], ['contain', 'Contieni']])}
      ${range('pattern.image.zoom', 'Zoom', 0.3, 3, 0.05)}${range('pattern.image.offx', 'Sposta in orizzontale', -1, 1, 0.02)}${range('pattern.image.offy', 'Sposta in verticale', -1, 1, 0.02)}`;
    } else if (k === 'text') {
      const T = P.pattern.text;
      h += `<h2>Testo</h2><textarea class="field" data-p="pattern.text.value" rows="2" style="height:auto;padding:9px 12px;resize:vertical" aria-label="Testo">${T.value}</textarea>
      <div class="row" style="grid-template-columns:1fr"><label class="fl">Carattere<select data-p="pattern.text.font">${['sans-serif', 'serif', 'monospace', 'cursive', 'Impact'].map(f => `<option ${T.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label></div>
      ${range('pattern.text.size', 'Larghezza', 0.2, 0.95, 0.01)}${range('pattern.text.angle', 'Rotazione', -90, 90, 1, '°')}`;
    } else if (pat.params.length) {
      h += `<h2>Parametri</h2>` + pat.params.map(q => range('pattern.p.' + q.k, q.label, q.min, q.max, q.step, q.unit || '')).join('');
      if (['labyrinth', 'contour', 'voronoi'].includes(k)) h += `<button class="btn sm" data-act="seed">${ICON('rotate-3d')}Nuova variante</button>`;
    }
    if (k !== 'none') {
      h += `<h2>Rilievo</h2>${range('pattern.amp', 'Altezza', 0.2, 1.6, 0.1, 'mm')}${sw('pattern.invert', 'Inverti rilievo')}
      ${sw('pattern.twoTone', 'Due colori (un cambio filamento)')}
      <p class="hint">${P.pattern.twoTone ? 'Il rilievo viene stampato in un secondo colore: la stampante si ferma a metà e cambi filamento a mano, senza AMS.' : 'Tutta la piastra resta in un solo colore.'}</p>
      ${patternById(k).tactile ? '<p class="hint"><b>Tattile:</b> altezze da 0,8 mm in su si sentono bene sotto le dita e restano protette dal bordo in TPU.</p>' : ''}`;
    }
    h += `<h2>Colori</h2><div class="swatches">${color('colors.bumper', 'Bordo')}${color('colors.plate', 'Piastra')}${P.pattern.twoTone && P.pattern.kind !== 'none' ? color('colors.relief', 'Rilievo') : ''}</div>`;
    return h;
  },
  mag() {
    const M = P.mag;
    return `<h2>Magneti</h2>
    ${seg('mag.mode', [['none', 'Nessuno'], ['ring', 'Anello'], ['discs', 'Dischetti'], ['open', 'Tasca aperta']])}
    ${M.mode === 'ring' || M.mode === 'open' ? `<h2>Anello magnetico</h2>${range('mag.od', 'Diametro esterno', 40, 60, 0.5, 'mm')}${range('mag.id', 'Diametro interno', 30, 54, 0.5, 'mm')}${range('mag.depth', 'Spessore magnete', 0.4, 2, 0.2, 'mm')}` : ''}
    ${M.mode === 'discs' ? `<h2>Dischetti</h2>${range('mag.discD', 'Diametro', 3, 10, 0.5, 'mm')}${range('mag.discH', 'Spessore', 0.5, 3, 0.5, 'mm')}${range('mag.discN', 'Quantità', 6, 24, 1)}${range('mag.discR', 'Raggio della corona', 18, 28, 0.5, 'mm')}` : ''}
    ${M.mode !== 'none' ? `${range('mag.y', 'Posizione verticale', -25, 25, 0.5, 'mm')}` : ''}
    ${M.mode === 'ring' || M.mode === 'discs' ? note('I magneti si inseriscono <b>durante la stampa</b>: il file contiene già una pausa al layer giusto. Il pannello Stampa dice quando.', 'info', 'info') : ''}
    ${M.mode === 'open' ? note('La tasca resta aperta sul lato del telefono: incolla il magnete e lascialo premere contro il retro. Nessuna pausa necessaria.', 'info', 'info') : ''}
    ${M.mode === 'discs' ? note('Con i dischetti controlla le polarità: alterna N e S come negli anelli MagSafe originali, altrimenti i caricatori non si agganciano bene.') : ''}
    <p class="hint">Per la ricarica magnetica usa magneti da 0,8–1 mm e tieni la piastra sotto i 2,6 mm in totale. Misura il tuo anello prima di stampare.</p>`;
  },
  btn() {
    const B = P.buttons, list = P.phone.buttons;
    const rows = list.map((b, i) => {
      const on = !B.enabled || B.enabled.includes(i);
      return `<div class="btnrow"><label class="switch" style="margin:0"><span>${b.side === 'right' ? 'Destro' : 'Sinistro'} · ${b.len} mm</span><input type="checkbox" data-bt="${i}" ${on ? 'checked' : ''}><span class="tr"></span></label></div>
      <div class="grid2" style="margin:2px 0 8px">${num('phone.buttons.' + i + '.y', 'Posizione dall\'alto', 0.5)}${num('phone.buttons.' + i + '.len', 'Lunghezza', 0.5)}</div>`;
    }).join('');
    return `<h2>Tasti laterali</h2>
    ${seg('buttons.mode', [['tab', 'Linguetta'], ['cutout', 'Foro'], ['closed', 'Chiusi']])}
    <p class="hint">${B.mode === 'tab' ? '<b>Linguetta flessibile:</b> un pezzo di parete in TPU libero su tre lati. Premi il pad sul bordo e un piccolo perno spinge il tasto del telefono. Nessuna parte da comprare, spessore invariato.' : B.mode === 'cutout' ? 'Il tasto resta scoperto: massimo feeling, meno protezione.' : 'Parete piena: il tasto si preme attraverso il TPU.'}</p>
    ${B.mode === 'tab' ? `<h2>Pad</h2>${seg('buttons.pad', [['dome', 'Cupola'], ['flat', 'Piatto'], ['ridged', 'Zigrinato']])}
    ${range('buttons.extra', 'Linguetta più lunga', 2, 14, 1, 'mm')}${range('buttons.padH', 'Altezza pad', 0.4, 1.8, 0.2, 'mm')}${range('buttons.slit', 'Fessura', 0.4, 1, 0.1, 'mm')}
    <p class="hint">Una linguetta più lunga fa da leva e ti dà un pad più grande da trovare al tatto, come i pulsanti aggiuntivi tipo PinButton, ma tutto in un unico pezzo di TPU.</p>` : ''}
    ${B.mode !== 'closed' ? `<h2>Tasti del telefono</h2>${rows}` : ''}`;
  },
  print() {
    return `<h2>Stampante</h2>
    <div class="kv"><span>Macchina</span><b>Bambu Lab A1 mini</b><span>Ugello</span><b>0,4 mm</b><span>Layer</span><b>0,2 mm</b><span>AMS</span><b>non serve</b></div>
    <h2>Bordo in TPU</h2>
    <div class="btns">
      <button class="btn" data-act="bumper3mf">${ICON('package')}3MF per Bambu Studio</button>
      <button class="btn" data-act="bumperstl">${ICON('file-box')}STL</button>
    </div>
    <p class="hint">Fronte sul piano, nessun supporto. Bobina esterna con TPU 95A, 230 °C, velocità ridotta (profilo già nel preset).</p>
    <h2>Piastra in PLA</h2>
    <div class="btns">
      <button class="btn" data-act="plate3mf">${ICON('package')}3MF per Bambu Studio</button>
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
  el.innerHTML = ps.length ? `<div class="note info">${ICON('info')}<div>${ps.map(p => `Layer <b>${Math.round(p.top_z / LAYER)}</b> (${p.top_z.toFixed(1)} mm): ${p.type === 'pause' ? 'pausa per i magneti' : 'cambio colore'}`).join('<br>')}<br><span style="color:var(--mute)">Già inseriti nel 3MF. Con l'STL aggiungili a mano dal cursore dei layer.</span></div></div>` : '';
}

function render() {
  renderTabs();
  const b = $('#body'); const st = b.scrollTop;
  b.innerHTML = V[tab](); b.scrollTop = st;
  updatePrintStatics();
}

// ---------- eventi ----------
$('#tabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; $('#body').scrollTop = 0; render(); } });
$('#goExport').onclick = () => { tab = 'print'; render(); };
$('#body').addEventListener('input', e => {
  const t = e.target; const p = t.dataset.p;
  if (t.id === 'phoneSel') return;
  if (!p) return;
  let v;
  if (t.type === 'checkbox') v = t.checked;
  else if (t.type === 'range' || t.type === 'number') { v = parseFloat(t.value); if (Number.isNaN(v)) return; }
  else v = t.value;
  set(P, p, v);
  if (t.type === 'range') {
    t.style.setProperty('--p', ((v - t.min) / (t.max - t.min) * 100) + '%');
    const lab = $(`[data-val="${p}"]`); if (lab) lab.textContent = fmt(v, +t.dataset.step) + (t.dataset.unit ? ' ' + t.dataset.unit : '');
  }
  if (t.type === 'checkbox' && (p === 'plate.guard' || p === 'pattern.twoTone')) render();
  if (p.startsWith('colors.')) { viewer.setColors(P.colors, P.pattern.twoTone); document.documentElement.style.setProperty('--accent', P.colors.bumper); save(); return; }
  if (p === 'pattern.twoTone') viewer.setColors(P.colors, P.pattern.twoTone);
  schedule();
});
$('#body').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'phoneSel') { P.phoneId = t.value; P.phone = clonePhone(phoneById(t.value)); P.buttons.enabled = null; render(); schedule(60); }
  else if (t.dataset.bt !== undefined) {
    const n = P.phone.buttons.length; const cur = P.buttons.enabled || [...Array(n).keys()];
    const i = +t.dataset.bt; P.buttons.enabled = t.checked ? [...new Set([...cur, i])] : cur.filter(x => x !== i); schedule(60);
  } else if (t.type === 'file') { /* gestito altrove */ }
  else if (t.tagName === 'SELECT' && t.dataset.p) { set(P, t.dataset.p, t.value); schedule(60); }
});
$('#body').addEventListener('click', e => {
  const s = e.target.closest('[data-seg]');
  if (s) { set(P, s.dataset.seg, s.dataset.v); render(); schedule(60); return; }
  const c = e.target.closest('[data-pat]');
  if (c) { P.pattern.kind = c.dataset.pat; P.pattern.p = patternDefaults(c.dataset.pat); render(); schedule(60); return; }
  const a = e.target.closest('[data-act]');
  if (a) action(a.dataset.act);
  if (e.target.closest('#drop')) $('#file').click();
});
$('#body').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'drop') { e.preventDefault(); $('#file').click(); } });
$('#file').addEventListener('change', e => { loadImage(e.target.files[0]); e.target.value = ''; });
const panel = $('#panel');
panel.addEventListener('dragover', e => { if (P.pattern.kind === 'image' || true) { e.preventDefault(); $('#drop')?.classList.add('over'); } });
panel.addEventListener('dragleave', () => $('#drop')?.classList.remove('over'));
panel.addEventListener('drop', e => { e.preventDefault(); $('#drop')?.classList.remove('over'); loadImage(e.dataTransfer.files[0]); });

document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => viewer.view(b.dataset.view));
$('#tgExplode').onclick = e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); viewer.target = on ? 1 : 0; };
$('#tgPhone').onclick = e => { showPhone = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', showPhone); if (last) viewer.showPhone(showPhone, P, last.meta); };

// ---------- azioni ----------
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function action(a) {
  if (a === 'seed') { P.pattern.seed = Math.floor(Math.random() * 9999); schedule(60); return; }
  if (!last) return toast('Attendi la fine del calcolo.');
  const base = slug(phoneById(P.phoneId).name) + (P.phoneId === 'custom' ? '' : '');
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
    setStatus('Preparo l\'anello di prova…', 'busy');
    const r = await request(true);
    if (r.error) return setStatus(r.error, 'err');
    download(stl(r.bumper, 'fit-test'), `${base}-anello-di-prova.stl`);
    setStatus('Anello di prova scaricato', 'ok');
    seq++; // invalida risposte in corso del modello principale
    schedule(30);
  }
}

// ---------- avvio ----------
window.csopen = { viewer, get state() { return P; } };
render();
viewer.view('angle');
document.documentElement.style.setProperty('--accent', P.colors.bumper);
schedule(10);
