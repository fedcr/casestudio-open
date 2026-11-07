import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';


export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.r.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.toneMappingExposure = 0.9;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.65;
    this.cam = new THREE.PerspectiveCamera(32, 1, 1, 2000);
    this.cam.position.set(60, -150, 260);
    this.ctl = new OrbitControls(this.cam, canvas);
    this.ctl.enableDamping = true; this.ctl.dampingFactor = 0.08;
    this.ctl.minDistance = 80; this.ctl.maxDistance = 700;
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-120, 200, 260); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ec5ff, 0.8); rim.position.set(200, -100, -120); this.scene.add(rim);

    this.group = new THREE.Group(); this.scene.add(this.group);
    this.bumperMat = new THREE.MeshPhysicalMaterial({ color: 0x3d8bff, roughness: 0.55, metalness: 0, clearcoat: 0.15, vertexColors: false });
    this.plateMat = new THREE.MeshPhysicalMaterial({ roughness: 0.38, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.35, vertexColors: true });
    this.bumperMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.bumperMat);
    this.plateMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.plateMat);
    this.group.add(this.bumperMesh, this.plateMesh);
    this.phoneMesh = null;
    this.explode = 0; this.zp0 = 0; this.target = 0;
    this.colors = { plate: new THREE.Color('#f2f4f7'), relief: new THREE.Color('#1f5fd6') };
    this.plateT = 2; this.twoTone = true;
    const ro = new ResizeObserver(() => this.resize()); ro.observe(canvas.parentElement);
    this.resize();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  resize() {
    const p = this.canvas.parentElement, w = p.clientWidth, h = p.clientHeight;
    this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    // tieni il modello a sinistra del pannello su desktop
    // sposta il centro del modello a sinistra del pannello (desktop) o sopra di esso (mobile)
    if (w > 900) this.cam.setViewOffset(w, h, 200, 0, w, h);
    else this.cam.setViewOffset(w, h, 0, Math.round(h * 0.2), w, h);
  }
  loop() {
    this.ctl.update();
    this.explode += (this.target - this.explode) * 0.14;
    this.plateMesh.position.z = this.zp0 + this.explode * 26;
    if (this.phoneMesh) this.phoneMesh.position.z = this.explode * 12;
    this.r.render(this.scene, this.cam);
    requestAnimationFrame(this.loop);
  }
  geo(buf, colorFn) {
    let g;
    g = creased(buf, 0.62);
    if (colorFn) {
      const p = g.attributes.position, c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i += 3) {
        const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
        const col = colorFn(z);
        for (let k = 0; k < 3; k++) { c[(i + k) * 3] = col.r; c[(i + k) * 3 + 1] = col.g; c[(i + k) * 3 + 2] = col.b; }
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    return g;
  }
  setModel({ bumper, plate }, meta) {
    this.bumperMesh.geometry.dispose(); this.plateMesh.geometry.dispose();
    this.bumperMesh.geometry = this.geo(bumper);
    this.zp0 = meta.zc1;
    this.plateT = meta.plateT; this.plateMeta = meta;
    this.plateMesh.geometry = this.geo(plate, z => (this.twoTone && z > meta.plateT + 0.15 && meta.relief > 0) ? this.colors.relief : this.colors.plate);
    // centra
    this.bumperMesh.position.set(0, 0, 0);
    this.group.position.set(0, 0, -meta.Z / 2);
    this.ctl.target.set(0, 0, 0);
  }
  setColors({ bumper, plate, relief }, twoTone) {
    this.bumperMat.color.set(bumper);
    this.colors.plate.set(plate); this.colors.relief.set(relief); this.twoTone = twoTone;
    const m = this.plateMeta;
    if (m && this.plateMesh.geometry.attributes.color) {
      const p = this.plateMesh.geometry.attributes.position, c = this.plateMesh.geometry.attributes.color;
      for (let i = 0; i < p.count; i += 3) {
        const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
        const col = (twoTone && z > m.plateT + 0.15 && m.relief > 0) ? this.colors.relief : this.colors.plate;
        for (let k = 0; k < 3; k++) c.setXYZ(i + k, col.r, col.g, col.b);
      }
      c.needsUpdate = true;
    }
  }
  showPhone(on, P, meta) {
    if (this.phoneMesh) { this.group.remove(this.phoneMesh); this.phoneMesh.geometry.dispose(); this.phoneMesh = null; }
    if (!on) return;
    const { W, H, R, T, cams } = P.phone;
    const s = new THREE.Shape(), hw = W / 2, hh = H / 2;
    s.moveTo(-hw + R, -hh); s.lineTo(hw - R, -hh); s.absarc(hw - R, -hh + R, R, -Math.PI / 2, 0); s.lineTo(hw, hh - R);
    s.absarc(hw - R, hh - R, R, 0, Math.PI / 2); s.lineTo(-hw + R, hh); s.absarc(-hw + R, hh - R, R, Math.PI / 2, Math.PI);
    s.lineTo(-hw, -hh + R); s.absarc(-hw + R, -hh + R, R, Math.PI, Math.PI * 1.5);
    const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 24 });
    g.translate(0, 0, meta.lipT);
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0x1b2230, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.55 }));
    const mat = new THREE.MeshStandardMaterial({ color: 0x0c0f14, roughness: 0.3 });
    for (const c of cams || []) {
      const x = c.x - W / 2, y = H / 2 - c.y, z = meta.lipT + T + 1.3;
      let geo;
      if (c.t === 'c') { geo = new THREE.CylinderGeometry(c.w / 2, c.w / 2, 2.6, 32); geo.rotateX(Math.PI / 2); }
      else {
        const r = Math.min(c.r, c.w / 2, c.h / 2), sh = new THREE.Shape(), a = c.w / 2, b = c.h / 2;
        sh.moveTo(-a + r, -b); sh.lineTo(a - r, -b); sh.absarc(a - r, -b + r, r, -Math.PI / 2, 0); sh.lineTo(a, b - r);
        sh.absarc(a - r, b - r, r, 0, Math.PI / 2); sh.lineTo(-a + r, b); sh.absarc(-a + r, b - r, r, Math.PI / 2, Math.PI);
        sh.lineTo(-a, -b + r); sh.absarc(-a + r, -b + r, r, Math.PI, Math.PI * 1.5);
        geo = new THREE.ExtrudeGeometry(sh, { depth: 2.6, bevelEnabled: false, curveSegments: 16 }); geo.translate(0, 0, -1.3);
      }
      const mm = new THREE.Mesh(geo, mat); mm.position.set(x, y, z); m.add(mm);
    }
    this.phoneMesh = m; this.group.add(m);
  }
  view(name) {
    const d = 330;
    const p = { back: [0, 0, d], front: [0, 0, -d], angle: [60, -150, 260], side: [d, 0, 0], top: [0, d, 0.01] }[name] || [60, -150, 260];
    this.cam.position.set(...p); this.ctl.target.set(0, 0, 0); this.ctl.update();
  }
  screenshot() { this.r.render(this.scene, this.cam); return this.canvas.toDataURL('image/png'); }
}

// Normali "a spigolo": media pesata per area solo tra facce con angolo < crease.
// (Pesare per area evita le striature che nascono quando triangoli enormi e piccolissimi condividono un vertice.)
function creased(buf, crease) {
  const { pos, idx } = buf, nF = idx.length / 3, nV = pos.length / 3;
  const fn = new Float32Array(nF * 3);
  for (let f = 0; f < nF; f++) {
    const a = idx[f * 3] * 3, b = idx[f * 3 + 1] * 3, c = idx[f * 3 + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    fn[f * 3] = uy * vz - uz * vy; fn[f * 3 + 1] = uz * vx - ux * vz; fn[f * 3 + 2] = ux * vy - uy * vx;
  }
  const start = new Uint32Array(nV + 1);
  for (let i = 0; i < idx.length; i++) start[idx[i] + 1]++;
  for (let i = 0; i < nV; i++) start[i + 1] += start[i];
  const fill = start.slice(0, nV), list = new Uint32Array(idx.length);
  for (let f = 0; f < nF; f++) for (let k = 0; k < 3; k++) list[fill[idx[f * 3 + k]]++] = f;
  const P = new Float32Array(nF * 9), N = new Float32Array(nF * 9), cs = Math.cos(crease);
  for (let f = 0; f < nF; f++) {
    const x = fn[f * 3], y = fn[f * 3 + 1], z = fn[f * 3 + 2], l = Math.hypot(x, y, z) || 1;
    const nx = x / l, ny = y / l, nz = z / l;
    for (let k = 0; k < 3; k++) {
      const v = idx[f * 3 + k];
      let sx = 0, sy = 0, sz = 0;
      for (let t = start[v]; t < start[v + 1]; t++) {
        const g = list[t], gx = fn[g * 3], gy = fn[g * 3 + 1], gz = fn[g * 3 + 2], gl = Math.hypot(gx, gy, gz) || 1;
        if ((gx * nx + gy * ny + gz * nz) / gl >= cs) { sx += gx; sy += gy; sz += gz; }
      }
      const sl = Math.hypot(sx, sy, sz) || 1;
      const o = f * 9 + k * 3;
      P[o] = pos[v * 3]; P[o + 1] = pos[v * 3 + 1]; P[o + 2] = pos[v * 3 + 2];
      N[o] = sx / sl; N[o + 1] = sy / sl; N[o + 2] = sz / sl;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return g;
}
