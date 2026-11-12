import * as THREE from 'three';
import { palette } from './materials.js';

/* ------------------------------------------------------------------ */
/*  Ruban de chemin animé (posé au sol, suit escaliers et pentes)       */
/* ------------------------------------------------------------------ */

const ribbonVS = /* glsl */ `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const ribbonFS = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColorDone;
  uniform float uReveal;
  uniform float uProgress;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uScale;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    float d = vUv.y;
    if (d > uReveal) discard;
    float across = abs(vUv.x - 0.5) * 2.0;
    float edge = 1.0 - smoothstep(0.78, 1.0, across);
    float border = smoothstep(0.55, 0.8, across) * (1.0 - smoothstep(0.86, 1.0, across));
    // chevrons qui défilent vers l'avant
    float ph = fract((d / uScale - across * 0.45) * 0.42 - uTime * 0.55);
    float chev = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.30, 0.36, ph));
    float done = step(d, uProgress);
    vec3 col = mix(uColor, vec3(1.0), chev * 0.6 * (1.0 - done));
    col = mix(col, uColorDone, done);
    col = mix(col, vec3(1.0), border * 0.35);
    float head = 1.0 - smoothstep(uReveal - 2.0 * uScale, uReveal, d) * 0.6;
    float a = edge * mix(0.92, 0.5, done) * head * uOpacity;
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class PathRibbon {
  constructor(route, { width = 1.0, lift = 0.06, color = '#12b3e6', doneColor = '#a8e6f8', scale = 1 } = {}) {
    this.route = route;
    const pts = route.points.map((p) => p.p);
    const pos = [], uv = [], idx = [];
    let side = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);
    const lifts = []; // segments verticaux
    let vi = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dir = b.clone().sub(a);
      const horiz = new THREE.Vector3(dir.x, 0, dir.z);
      if (horiz.length() < 0.05) { lifts.push([a, b]); continue; }
      side = new THREE.Vector3().crossVectors(horiz.normalize(), up).normalize();
      const hw = width / 2;
      const d0 = route.cum[i], d1 = route.cum[i + 1];
      // on prolonge légèrement chaque segment pour masquer les jointures
      const ext = Math.min(hw, (d1 - d0) / 2);
      const dn = dir.clone().normalize();
      const a2 = a.clone().addScaledVector(dn, -ext), b2 = b.clone().addScaledVector(dn, ext);
      const quad = [
        a2.clone().addScaledVector(side, -hw), a2.clone().addScaledVector(side, hw),
        b2.clone().addScaledVector(side, -hw), b2.clone().addScaledVector(side, hw),
      ];
      for (const q of quad) pos.push(q.x, q.y + lift, q.z);
      uv.push(0, d0 - ext, 1, d0 - ext, 0, d1 + ext, 1, d1 + ext);
      idx.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3);
      vi += 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: new THREE.Color(color) },
        uColorDone: { value: new THREE.Color(doneColor) },
        uReveal: { value: 0 },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uScale: { value: scale },
      },
    ]);
    const mat = new THREE.ShaderMaterial({
      vertexShader: ribbonVS, fragmentShader: ribbonFS, uniforms: this.uniforms,
      transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.renderOrder = 5;
    this.mesh.raycast = () => {};
    this.object = new THREE.Group();
    this.object.add(this.mesh);
    // colonnes cyan dans les gaines d'ascenseur
    this.liftBeams = lifts.map(([a, b]) => {
      const h = Math.abs(b.y - a.y);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, h, 12), palette.accent('accent', { opacity: 0.75, glow: 0.6 }));
      m.position.set(a.x, (a.y + b.y) / 2, a.z);
      m.userData.d0 = route.cum[route.points.findIndex((p) => p.p === a || p.p.equals(a))] ?? 0;
      this.object.add(m);
      return m;
    });
  }

  update(reveal, progress, time) {
    this.uniforms.uReveal.value = reveal;
    this.uniforms.uProgress.value = progress;
    this.uniforms.uTime.value = time;
    for (const b of this.liftBeams) b.visible = reveal > b.userData.d0;
  }

  setOpacity(o) { this.uniforms.uOpacity.value = o; }
}

/* ------------------------------------------------------------------ */
/*  Marqueur du voyageur                                               */
/* ------------------------------------------------------------------ */

export class TravelerMarker {
  constructor(scale = 1) {
    this.object = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 6, 16), palette.get('white', { roughness: 0.5 }));
    body.position.y = 0.78;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), palette.accent('accent', { glow: 0.45 }));
    head.position.y = 1.85;
    head.castShadow = true;
    const ringGeo = new THREE.RingGeometry(0.55, 0.75, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, palette.accent('accent', { opacity: 0.85, glow: 0.5 }).clone());
    this.ring.position.y = 0.05;
    this.ring.renderOrder = 6;
    const pulseGeo = new THREE.RingGeometry(0.7, 0.82, 48);
    pulseGeo.rotateX(-Math.PI / 2);
    this.pulse = new THREE.Mesh(pulseGeo, palette.accent('accent', { opacity: 0.6, glow: 0.6 }).clone());
    this.pulse.material.userData.owned = true;
    this.ring.material.userData.owned = true;
    this.pulse.position.y = 0.05;
    this.pulse.renderOrder = 6;
    // flèche de direction
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 1.25); arrowShape.lineTo(0.42, 0.88); arrowShape.lineTo(-0.42, 0.88); arrowShape.closePath();
    const ag = new THREE.ShapeGeometry(arrowShape);
    ag.rotateX(-Math.PI / 2);
    this.arrow = new THREE.Mesh(ag, palette.accent('accent', { glow: 0.4 }));
    this.arrow.position.y = 0.06;
    this.body = new THREE.Group();
    this.body.add(body, head);
    this.object.add(this.body, this.ring, this.pulse, this.arrow);
    this.object.scale.setScalar(scale);
    this.object.traverse((o) => (o.raycast = () => {}));
  }

  set(pos, dir, time) {
    this.object.position.copy(pos);
    if (dir) this.arrow.rotation.y = Math.atan2(-dir.x, -dir.z);
    const k = (time * 0.8) % 1;
    this.pulse.scale.setScalar(1 + k * 1.6);
    this.pulse.material.opacity = 0.55 * (1 - k);
    this.body.position.y = Math.sin(time * 3) * 0.04;
  }
}

/* ------------------------------------------------------------------ */
/*  Balise (point d'intérêt : quai, arrêt, destination)                 */
/* ------------------------------------------------------------------ */

export class Beacon {
  constructor({ radius = 1.6, height = 7, scale = 1 } = {}) {
    this.object = new THREE.Group();
    const discGeo = new THREE.CircleGeometry(radius, 48);
    discGeo.rotateX(-Math.PI / 2);
    this.disc = new THREE.Mesh(discGeo, palette.accent('accentSoft', { opacity: 0.35, glow: 0.4 }).clone());
    this.disc.material.userData.owned = true;
    this.disc.position.y = 0.04;
    const ringGeo = new THREE.RingGeometry(radius * 0.92, radius, 64);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, palette.accent('accent', { opacity: 0.9, glow: 0.5 }).clone());
    this.ring.material.userData.owned = true;
    this.ring.position.y = 0.05;
    const colGeo = new THREE.CylinderGeometry(radius * 0.08, radius * 0.08, height, 12, 1, true);
    colGeo.translate(0, height / 2, 0);
    const colMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color('#12b3e6') }, uO: { value: 1 } },
      vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 uColor; uniform float uO; varying float vY; void main(){ gl_FragColor = vec4(uColor, (1.0-vY)*0.55*uO);\n#include <colorspace_fragment>\n}',
    });
    colMat.userData.owned = true;
    this.col = new THREE.Mesh(colGeo, colMat);
    this.object.add(this.disc, this.ring, this.col);
    this.object.scale.setScalar(scale);
    this.object.traverse((o) => (o.raycast = () => {}));
    this.object.renderOrder = 4;
  }

  update(time, strength = 1) {
    const k = (time * 0.6) % 1;
    this.ring.scale.setScalar(1 + k * 0.5);
    this.ring.material.opacity = 0.9 * (1 - k) * strength;
    this.disc.material.opacity = 0.35 * strength;
    this.col.material.uniforms.uO.value = strength;
    this.object.visible = strength > 0.01;
  }
}

/** Surbrillance d'un objet (ex. le train) : coque translucide cyan + contour. */
export function highlightShell(obj, inflate = 0.25) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const g = new THREE.BoxGeometry(size.x + inflate * 2, size.y + inflate * 2, size.z + inflate * 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#12b3e6', transparent: true, opacity: 0.05, depthWrite: false }));
  m.material.userData.owned = true;
  m.position.copy(c);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: '#12b3e6', transparent: true, opacity: 0.8 }));
  e.material.userData.owned = true;
  m.add(e);
  m.raycast = () => {};
  return m;
}
