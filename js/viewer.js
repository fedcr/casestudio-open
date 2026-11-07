import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { toCreasedNormals } from '../vendor/BufferGeometryUtils.js';

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
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(buf.pos, 3));
    g.setIndex(new THREE.BufferAttribute(buf.idx, 1));
    g = toCreasedNormals(g, 0.6);
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
    const { W, H, R, T, cam } = P.phone;
    const s = new THREE.Shape(), hw = W / 2, hh = H / 2;
    s.moveTo(-hw + R, -hh); s.lineTo(hw - R, -hh); s.absarc(hw - R, -hh + R, R, -Math.PI / 2, 0); s.lineTo(hw, hh - R);
    s.absarc(hw - R, hh - R, R, 0, Math.PI / 2); s.lineTo(-hw + R, hh); s.absarc(-hw + R, hh - R, R, Math.PI / 2, Math.PI);
    s.lineTo(-hw, -hh + R); s.absarc(-hw + R, -hh + R, R, Math.PI, Math.PI * 1.5);
    const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 24 });
    g.translate(0, 0, meta.lipT);
    const isl = new THREE.BoxGeometry(cam.w, cam.h, 2.6);
    isl.translate(cam.cx + cam.w / 2 - W / 2, H / 2 - cam.cy - cam.h / 2, meta.lipT + T + 1.3);
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0x1b2230, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.55 }));
    m.add(new THREE.Mesh(isl, new THREE.MeshStandardMaterial({ color: 0x0c0f14, roughness: 0.3 })));
    this.phoneMesh = m; this.group.add(m);
  }
  view(name) {
    const d = 330;
    const p = { back: [0, 0, d], front: [0, 0, -d], angle: [60, -150, 260], side: [d, 0, 0], top: [0, d, 0.01] }[name] || [60, -150, 260];
    this.cam.position.set(...p); this.ctl.target.set(0, 0, 0); this.ctl.update();
  }
  screenshot() { this.r.render(this.scene, this.cam); return this.canvas.toDataURL('image/png'); }
}
