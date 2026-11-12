import * as THREE from 'three';
import { palette } from './materials.js';

const BG = new THREE.Color('#f4f7f9');

/* ------------------------------------------------------------------ */
/*  Caméra « rig » : cible, cap, inclinaison, distance — lissés         */
/* ------------------------------------------------------------------ */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.cur = { target: new THREE.Vector3(), yaw: 0, pitch: 0.9, dist: 60, fov: 36 };
    this.want = { target: new THREE.Vector3(), yaw: 0, pitch: 0.9, dist: 60, fov: 36 };
    this.stiffness = 2.0;
  }
  set(v, snap = false) {
    if (v.target) this.want.target.copy(v.target);
    for (const k of ['yaw', 'pitch', 'dist', 'fov']) if (v[k] !== undefined) this.want[k] = v[k];
    if (snap) this.snap();
  }
  snap() {
    this.cur.target.copy(this.want.target);
    this.cur.yaw = this.want.yaw; this.cur.pitch = this.want.pitch; this.cur.dist = this.want.dist; this.cur.fov = this.want.fov;
  }
  update(dt) {
    const k = 1 - Math.exp(-dt * this.stiffness);
    const kd = 1 - Math.exp(-dt * this.stiffness * 0.8);
    this.cur.target.lerp(this.want.target, k);
    let dy = this.want.yaw - this.cur.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.cur.yaw += dy * kd;
    this.cur.pitch += (this.want.pitch - this.cur.pitch) * kd;
    this.cur.dist += (this.want.dist - this.cur.dist) * kd;
    this.cur.fov += (this.want.fov - this.cur.fov) * kd;
    this.apply();
  }
  apply() {
    const { target, yaw, pitch, dist, fov } = this.cur;
    const c = this.camera;
    c.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    c.lookAt(target);
    if (Math.abs(c.fov - fov) > 0.01) { c.fov = fov; c.updateProjectionMatrix(); }
  }
}

/* ------------------------------------------------------------------ */
/*  Étiquettes HTML projetées                                           */
/* ------------------------------------------------------------------ */
export class LabelLayer {
  constructor(el) { this.el = el; this.items = new Set(); this.v = new THREE.Vector3(); }
  add({ html, cls = '', pos, obj = null, offset = null, maxDist = Infinity, minDist = 0, stem = true }) {
    const d = document.createElement('div');
    d.className = 'lbl ' + cls;
    d.innerHTML = `<span class="lb">${html}</span>${stem ? '<span class="stem"></span>' : ''}`;
    this.el.appendChild(d);
    const item = {
      el: d, pos: pos ? pos.clone() : new THREE.Vector3(), obj, offset: offset || new THREE.Vector3(), maxDist, minDist,
      visible: true, opacity: 1,
      setHTML(h) { d.querySelector('.lb').innerHTML = h; },
      setVisible(v) { this.visible = v; },
    };
    this.items.add(item);
    return item;
  }
  clear() { for (const it of this.items) it.el.remove(); this.items.clear(); }
  remove(it) { if (it) { it.el.remove(); this.items.delete(it); } }
  update(camera, w, h) {
    for (const it of this.items) {
      const p = this.v;
      if (it.obj) { it.obj.getWorldPosition(p); p.add(it.offset); } else p.copy(it.pos);
      const dist = p.distanceTo(camera.position);
      p.project(camera);
      const on = it.visible && p.z < 1 && p.z > -1 && Math.abs(p.x) < 1.15 && Math.abs(p.y) < 1.15 && dist < it.maxDist && dist > it.minDist;
      if (!on) { if (!it.el.classList.contains('hidden')) it.el.classList.add('hidden'); continue; }
      it.el.classList.remove('hidden');
      const x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Moteur                                                             */
/* ------------------------------------------------------------------ */
export class Engine {
  constructor(container, labelsEl, settings) {
    this.container = container;
    this.settings = settings;
    const quality = settings.qualite === 'standard' ? 'standard' : 'haute';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__HOLO_TEST__ });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'haute' ? 2 : 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = BG.clone();
    this.scene.fog = new THREE.Fog(BG.clone(), 100, 600);

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 12000);
    this.rig = new CameraRig(this.camera);
    this.labels = new LabelLayer(labelsEl);

    // éclairage doux : ciel + soleil rasant légèrement
    this.hemi = new THREE.HemisphereLight('#ffffff', '#cfd8e0', 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.0);
    this.sunDir = new THREE.Vector3(-0.55, 1.0, 0.42).normalize();
    this.sun.castShadow = true;
    const ms = quality === 'haute' ? 4096 : 2048;
    this.sun.shadow.mapSize.set(ms, ms);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight('#eef6ff', 0.35);
    this.fill.position.set(0.6, 0.5, -0.8);
    this.scene.add(this.fill);

    // sol infini (se fond dans la brume)
    const gg = new THREE.PlaneGeometry(60000, 60000);
    gg.rotateX(-Math.PI / 2);
    this.ground = new THREE.Mesh(gg, palette.get('ground'));
    this.ground.receiveShadow = true;
    this.ground.position.y = -5;
    this.ground.raycast = () => {};
    this.scene.add(this.ground);

    this.world = new THREE.Group(); // contenu de la scène courante
    this.scene.add(this.world);

    this.occluders = []; // { group, mats: [], fade, want }
    this.raycaster = new THREE.Raycaster();
    this.focus = null; // Vector3 : point à garder visible (voyageur)
    this.frameCbs = new Set();
    this.time = 0;
    this.shadowSize = 120;
    this.fps = 60;

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.applySettings(settings);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  applySettings(s) {
    this.settings = s;
    palette.apply(s);
    this.renderer.toneMappingExposure = s.exposition;
    const sh = THREE.MathUtils.clamp(s.ombres, 0, 1);
    this.sun.castShadow = sh > 0.01;
    if ('intensity' in this.sun.shadow) this.sun.shadow.intensity = sh;
    this.sun.shadow.radius = s.douceurOmbres;
    this.sun.shadow.blurSamples = 16;
    // sans intensité d'ombre native, on compense par l'éclairage d'ambiance
    this.hemi.intensity = 1.25 + (1 - sh) * 0.15;
    this.ground.material.color.copy(palette.color('ground'));
    this.scene.background.copy(BG);
  }

  /** Rend un groupe « effaçable » : il s'estompe quand il masque le voyageur. */
  addOccluder(group, { min = null } = {}) {
    const entry = { group, mats: [], fade: 1, want: 1, min };
    const cache = new Map();
    group.traverse((o) => {
      if (!o.material || o.userData.sign) return;
      const src = o.material;
      if (!cache.has(src)) {
        const c = src.clone();
        c.userData = { ...src.userData, owned: true, baseOpacity: src.opacity, occ: true };
        cache.set(src, c);
        entry.mats.push(c);
        if (src.userData.lineFactor) palette.lineMats.add(c);
        if (src.userData.glassFactor) palette.glassMats.add(c);
      }
      o.material = cache.get(src);
      o.userData.occluderEntry = entry;
    });
    this.occluders.push(entry);
    return entry;
  }

  clearWorld() {
    for (const o of [...this.world.children]) {
      this.world.remove(o);
    }
    this.occluders = [];
    this.labels.clear();
    this.focus = null;
  }

  onFrame(cb) { this.frameCbs.add(cb); return () => this.frameCbs.delete(cb); }

  _updateOcclusion(dt) {
    if (!this.occluders.length) return;
    const targets = [];
    if (this.focus) targets.push(this.focus);
    const cam = this.camera.position;
    for (const e of this.occluders) e.want = 1;
    const meshes = [];
    for (const e of this.occluders) e.group.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
    for (const t of targets) {
      for (const dy of [0.4, 1.8]) {
        const p = t.clone(); p.y += dy;
        const dir = p.clone().sub(cam);
        const len = dir.length();
        this.raycaster.set(cam, dir.normalize());
        this.raycaster.far = len - 0.3;
        for (const h of this.raycaster.intersectObjects(meshes, false)) {
          const e = h.object.userData.occluderEntry;
          if (e) e.want = e.min ?? this.settings.opaciteMasques;
        }
      }
    }
    const k = 1 - Math.exp(-dt * 5);
    for (const e of this.occluders) {
      e.fade += (e.want - e.fade) * k;
      const f = e.fade;
      for (const m of e.mats) {
        const base = m.userData.glassFactor ? this.settings.opaciteVitrages * m.userData.glassFactor
          : m.userData.lineFactor ? this.settings.contours * m.userData.lineFactor : 1;
        const op = base * f;
        const tr = f < 0.995 || !!m.userData.glassFactor || !!m.userData.lineFactor;
        if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
        m.opacity = op;
        m.depthWrite = !tr;
      }
      e.group.traverse((o) => { if (o.isMesh) o.castShadow = f > 0.6 && !o.userData.noShadow; });
    }
  }

  _updateShadowCam() {
    const t = this.rig.cur.target;
    const S = THREE.MathUtils.clamp(this.rig.cur.dist * 0.85, 30, this.shadowMax || 900);
    const cam = this.sun.shadow.camera;
    // accrochage à la grille de texels pour éviter le scintillement
    const texel = (2 * S) / this.sun.shadow.mapSize.x;
    const snap = (v) => Math.round(v / texel) * texel;
    const tx = snap(t.x), tz = snap(t.z);
    this.sun.target.position.set(tx, 0, tz);
    this.sun.position.set(tx + this.sunDir.x * S * 2, this.sunDir.y * S * 2, tz + this.sunDir.z * S * 2);
    if (cam.right !== S) {
      cam.left = -S; cam.right = S; cam.top = S; cam.bottom = -S;
      cam.near = 1; cam.far = S * 5;
      cam.updateProjectionMatrix();
    }
  }

  _updateFog() {
    const d = this.rig.cur.dist;
    const b = THREE.MathUtils.clamp(this.settings.brume, 0, 1);
    this.scene.fog.near = d * (0.95 + (1 - b) * 0.8);
    this.scene.fog.far = d * (2.4 + (1 - b) * 7);
  }

  start() {
    let last = performance.now();
    let acc = 0, frames = 0;
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt; frames++;
      if (acc > 1) { this.fps = frames / acc; acc = 0; frames = 0; }
      this.step(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  step(dt) {
    this.time += dt;
    for (const cb of this.frameCbs) cb(dt, this.time);
    this.rig.update(dt);
    this._updateOcclusion(dt);
    this._updateShadowCam();
    this._updateFog();
    this.renderer.render(this.scene, this.camera);
    this.labels.update(this.camera, this.w, this.h);
  }
}
