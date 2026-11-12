import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette } from '../core/materials.js';
import { mesh, rectsMinus, block, shapeFromXZ, extrudeShapeGeo } from '../core/build.js';
import { LANDMARKS } from './landmarks.js';

/*
 * Maquette urbaine générée à partir d'un « plan » (voir cityPlans.js) :
 * rues, places, parcs, voies ferrées, monuments, et îlots bâtis générés le long
 * des rues (front bâti continu, cœurs d'îlots dégagés).
 * Les coordonnées du plan sont en mètres (Est, Nord) depuis le centre de la
 * façade de la gare ; elles sont converties dans le repère local de la gare.
 */

export function makeFrame(facadeBearingDeg, frontZ = 20) {
  const F = (facadeBearingDeg * Math.PI) / 180;
  const ez = [Math.sin(F), Math.cos(F)];
  const ex = [Math.sin(F - Math.PI / 2), Math.cos(F - Math.PI / 2)];
  const toLocal = ([E, N]) => [E * ex[0] + N * ex[1], frontZ + E * ez[0] + N * ez[1]];
  // cap (en radians, repère three : rotation.y) d'une direction exprimée en relèvement géographique
  const yawOfBearing = (b) => {
    const r = (b * Math.PI) / 180;
    const E = Math.sin(r), N = Math.cos(r);
    const lx = E * ex[0] + N * ex[1], lz = E * ez[0] + N * ez[1];
    return Math.atan2(lx, lz); // rotation.y telle que l'avant (+z local de l'objet) pointe dans cette direction
  };
  return { toLocal, yawOfBearing };
}

/* ---------------- grille d'occupation ---------------- */
class Grid {
  constructor(R, cell = 2) {
    this.R = R; this.cell = cell; this.n = Math.ceil((2 * R) / cell);
    this.a = new Uint8Array(this.n * this.n);
  }
  idx(x, z) {
    const i = Math.floor((x + this.R) / this.cell), j = Math.floor((z + this.R) / this.cell);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return j * this.n + i;
  }
  get(x, z) { const k = this.idx(x, z); return k < 0 ? 1 : this.a[k]; }
  /** marque un polygone convexe (ou quelconque) par balayage de boîte englobante + test point-dans-polygone */
  fillPoly(poly, v = 1) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let z = z0; z <= z1; z += this.cell * 0.5) for (let x = x0; x <= x1; x += this.cell * 0.5) {
      if (pointInPoly(x, z, poly)) { const k = this.idx(x, z); if (k >= 0) this.a[k] = Math.max(this.a[k], v); }
    }
  }
  testPoly(poly) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let z = z0; z <= z1; z += this.cell * 0.5) for (let x = x0; x <= x1; x += this.cell * 0.5) {
      if (pointInPoly(x, z, poly) && this.get(x, z)) return false;
    }
    return true;
  }
  fillSegment(a, b, halfW, v = 1) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * halfW, nz = (dx / len) * halfW;
    this.fillPoly([[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], v);
    this.fillPoly(circlePoly(a, halfW, 10), v);
    this.fillPoly(circlePoly(b, halfW, 10), v);
  }
}

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function circlePoly([cx, cz], r, n = 16) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  return out;
}

/* ---------------- RNG déterministe ---------------- */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------------- géométries ---------------- */

function ribbonGeo(pts, w, y) {
  const geos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.01) continue;
    const g = new THREE.PlaneGeometry(len, w);
    g.rotateX(-Math.PI / 2);
    g.rotateY(-Math.atan2(bz - az, bx - ax));
    g.translate((ax + bx) / 2, y, (az + bz) / 2);
    geos.push(g);
  }
  for (const p of pts) {
    const c = new THREE.CircleGeometry(w / 2, 16);
    c.rotateX(-Math.PI / 2);
    c.translate(p[0], y, p[1]);
    geos.push(c);
  }
  return geos;
}

function flatPolyGeo(poly, y) {
  const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Bâtiment rectangulaire orienté (centre, demi-axes u et v) avec toit plat ou à deux pans. */
function buildingGeo(cx, cz, ux, uz, hw, hd, h, y0, roof) {
  const geos = [];
  const box = new THREE.BoxGeometry(hw * 2, h, hd * 2).toNonIndexed();
  const ang = Math.atan2(uz, ux);
  box.rotateY(-ang);
  box.translate(cx, y0 + h / 2, cz);
  geos.push(box);
  if (roof === 'gable') {
    const rh = Math.min(hd * 0.9, 5.5);
    const s = new THREE.Shape([new THREE.Vector2(-hd, 0), new THREE.Vector2(hd, 0), new THREE.Vector2(0, rh)]);
    const g = new THREE.ExtrudeGeometry(s, { depth: hw * 2, bevelEnabled: false });
    g.translate(0, 0, -hw);
    g.rotateY(Math.PI / 2); // faîtage le long de u
    g.rotateY(-ang);
    g.translate(cx, y0 + h, cz);
    geos.push(g);
  } else if (roof === 'mansard') {
    const rh = 3.2;
    const top = new THREE.CylinderGeometry(1, 1, 1, 4, 1);
    void top;
    const s = new THREE.Shape([new THREE.Vector2(-hd, 0), new THREE.Vector2(hd, 0), new THREE.Vector2(hd - 1.4, rh), new THREE.Vector2(-hd + 1.4, rh)]);
    const g = new THREE.ExtrudeGeometry(s, { depth: hw * 2 - 0.4, bevelEnabled: false });
    g.translate(0, 0, -hw + 0.2);
    g.rotateY(Math.PI / 2);
    g.rotateY(-ang);
    g.translate(cx, y0 + h, cz);
    geos.push(g);
  }
  return geos;
}

/* ------------------------------------------------------------------ */

/**
 * plan : voir cityPlans.js
 * opts.reserve : rectangles locaux [x0,z0,x1,z1] à laisser libres (gare)
 */
export function buildCity(plan, { reserve = [], groundY = 0 } = {}) {
  // eslint-disable-next-line no-param-reassign
  const frame = makeFrame(plan.facadeBearing, plan.frontZ ?? 20);
  const T = plan.local ? (p) => [p[0], p[1]] : (p) => frame.toLocal(p);
  reserve = [...reserve, ...(plan.reserve || [])];
  groundY = plan.groundY ?? groundY;
  const R = plan.radius;
  const grid = new Grid(R + 40, 2);
  const rand = rng(plan.seed || 7);
  const g = new THREE.Group();
  g.name = 'city';
  const labels = [];
  const y = groundY;

  /* ---- socle ---- */
  const plinth = [-R, -R, R, R];
  const holes = reserve.map((r) => r);
  g.add(slabTwoTone(plinth, holes, y));
  for (const r of plan.noBuild || []) grid.fillPoly([[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]], 2);
  for (const r of reserve) grid.fillPoly([[r[0] - 2, r[1] - 2], [r[2] + 2, r[1] - 2], [r[2] + 2, r[3] + 2], [r[0] - 2, r[3] + 2]], 2);
  // bord du socle : liseré cyan très discret
  const rim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * R, 0.01, 2 * R)), new THREE.LineBasicMaterial({ color: '#8fe0f8', transparent: true, opacity: 0.6 }));
  rim.position.y = y + 0.02;
  rim.material.userData.owned = true;
  g.add(rim);

  /* ---- surfaces : places, parcs, eau ---- */
  const surf = { square: [], park: [], water: [] };
  for (const s of plan.areas || []) {
    const poly = s.poly.map(T);
    surf[s.kind || 'square'].push(flatPolyGeo(poly, y + (s.kind === 'water' ? 0.015 : 0.02)));
    grid.fillPoly(poly, 3);
    if (s.label) labels.push({ text: s.label, at: centroid(poly), cls: 'city minor', h: 4 });
    if (s.kind === 'park') {
      // arbres
      const [cx, cz] = centroid(poly);
      void cx; void cz;
      const bb = bbox(poly);
      const n = Math.min(160, Math.floor(((bb[2] - bb[0]) * (bb[3] - bb[1])) / 260));
      for (let i = 0; i < n; i++) {
        const tx = bb[0] + rand() * (bb[2] - bb[0]), tz = bb[1] + rand() * (bb[3] - bb[1]);
        if (pointInPoly(tx, tz, poly)) treesAt.push([tx, tz, 0.8 + rand() * 0.6]);
      }
    }
  }
  const sqMat = palette.get('floor');
  if (surf.square.length) g.add(meshNoEdges(mergeGeometries(surf.square), sqMat));
  if (surf.park.length) g.add(meshNoEdges(mergeGeometries(surf.park), palette.get('green')));
  if (surf.water.length) g.add(meshNoEdges(mergeGeometries(surf.water), palette.get('water', { roughness: 0.3 })));

  /* ---- voies ferrées extérieures ---- */
  const railGeos = [], bedGeos = [];
  for (const r of plan.rails || []) {
    const pts = r.pts.map(T);
    const n = r.tracks || 2;
    const bw = r.single ? 4 : n * 4.5 + 2;
    bedGeos.push(...ribbonGeo(pts, bw, y + 0.03));
    for (let i = 0; i < pts.length - 1; i++) grid.fillSegment(pts[i], pts[i + 1], bw / 2 + 1, 2);
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * 4.5;
      for (const d of [-0.75, 0.75]) railGeos.push(...ribbonGeo(offsetLine(pts, off + d), 0.14, y + 0.08).filter((q) => q.type === 'PlaneGeometry'));
    }
  }
  if (bedGeos.length) g.add(meshNoEdges(mergeGeometries(bedGeos), palette.get('trackbed')));
  if (railGeos.length) g.add(meshNoEdges(mergeGeometries(railGeos), palette.get('rail')));

  /* ---- rues ---- */
  const roadGeos = [], lineGeos = [];
  const streets = (plan.streets || []).map((s) => ({ ...s, pts: s.pts.map(T) }));
  for (const s of streets) {
    roadGeos.push(...ribbonGeo(s.pts, s.w, y + 0.04));
    if (s.w >= 14) lineGeos.push(...ribbonGeo(s.pts, 0.25, y + 0.05).filter((q) => q.type === 'PlaneGeometry'));
    for (let i = 0; i < s.pts.length - 1; i++) grid.fillSegment(s.pts[i], s.pts[i + 1], s.w / 2 + 1.5, 2);
    if (s.label) {
      const mid = Math.floor((s.pts.length - 1) / 2);
      const a = s.pts[mid], b = s.pts[mid + 1] || a;
      labels.push({ text: s.label, at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cls: 'city minor', h: 2 });
    }
  }
  if (roadGeos.length) g.add(meshNoEdges(mergeGeometries(roadGeos), palette.get('road')));
  if (lineGeos.length) g.add(meshNoEdges(mergeGeometries(lineGeos), palette.get('roadLine')));

  /* ---- monuments ---- */
  const landmarkObjs = {};
  for (const lm of plan.landmarks || []) {
    const fn = LANDMARKS[lm.type];
    if (!fn) continue;
    const obj = fn(lm.params || {});
    const [x, z] = T(lm.at);
    obj.position.set(x, y, z);
    obj.rotation.y = plan.local ? ((lm.rot || 0) * Math.PI) / 180 : frame.yawOfBearing(lm.facing ?? 0);
    g.add(obj);
    obj.updateMatrixWorld(true);
    // emprise réservée
    const box = new THREE.Box3().setFromObject(obj);
    grid.fillPoly([[box.min.x - 3, box.min.z - 3], [box.max.x + 3, box.min.z - 3], [box.max.x + 3, box.max.z + 3], [box.min.x - 3, box.max.z + 3]], 4);
    if (lm.label) labels.push({ text: lm.label, at: [x, z], cls: 'city', h: (box.max.y - y) + 4 });
    landmarkObjs[lm.id || lm.type] = { obj, x, z, height: box.max.y - y };
  }

  /* ---- emplacements (POI) : réservés ---- */
  const pois = {};
  for (const [id, p] of Object.entries(plan.pois || {})) {
    const [x, z] = T(p.at);
    pois[id] = { ...p, x, z };
    if (p.footprint) {
      const [w, d] = p.footprint;
      const yaw = ((p.rot || 0) * Math.PI) / 180;
      const poly = orientedRect(x, z, Math.sin(yaw), Math.cos(yaw), w / 2, d / 2);
      grid.fillPoly(poly.map(([a, b]) => [a, b]), 4);
    }
  }

  /* ---- arbres d'alignement ---- */
  for (const s of streets) {
    if (!s.trees) continue;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const [ax, az] = s.pts[i], [bx, bz] = s.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      for (let d = 6; d < len - 6; d += s.trees === 'sparse' ? 24 : 11) {
        for (const side of [-1, 1]) {
          const px = ax + ((bx - ax) * d) / len + nx * side * (s.w / 2 - 1.2);
          const pz = az + ((bz - az) * d) / len + nz * side * (s.w / 2 - 1.2);
          treesAt.push([px, pz, 0.75]);
        }
      }
    }
  }

  /* ---- îlots bâtis le long des rues ---- */
  const facGeosA = [], facGeosB = [];
  const hc = plan.heights || {};
  const center = hc.center ? T(hc.center) : [0, 0];
  let count = 0;
  for (const s of streets) {
    if (s.noBuild) continue;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const [ax, az] = s.pts[i], [bx, bz] = s.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 8) continue;
      const ux = (bx - ax) / len, uz = (bz - az) / len;
      const nx = -uz, nz = ux;
      for (const side of [-1, 1]) {
        if (s.oneSide && s.oneSide !== side) continue;
        let d = 3;
        while (d < len - 4) {
          const wFront = (hc.wMin ?? 7) + rand() * ((hc.wMax ?? 16) - (hc.wMin ?? 7));
          const depth = (hc.dMin ?? 9) + rand() * ((hc.dMax ?? 15) - (hc.dMin ?? 9));
          const setback = s.w / 2 + 1.6 + (s.setback || 0);
          const cx = ax + ux * (d + wFront / 2) + nx * side * (setback + depth / 2);
          const cz = az + uz * (d + wFront / 2) + nz * side * (setback + depth / 2);
          const poly = orientedRect(cx, cz, ux, uz, wFront / 2, depth / 2);
          const shrunk = orientedRect(cx, cz, ux, uz, wFront / 2 - 0.6, depth / 2 - 0.6);
          const dist = Math.hypot(cx - center[0], cz - center[1]);
          if (Math.abs(cx) < R - 8 && Math.abs(cz) < R - 8 && grid.testPoly(shrunk) && dist > (hc.voidRadius || 0)) {
            grid.fillPoly(poly, 1);
            const f = Math.max(0, 1 - dist / (hc.falloff || 900));
            const hmin = hc.min ?? 7, hmax = hc.max ?? 14;
            let h = hmin + (hmax - hmin) * (0.35 * rand() + 0.65 * f * (0.6 + 0.4 * rand()));
            h = Math.round(h / 3) * 3 + 1;
            const roofType = rand() < (hc.gable ?? 0.3) && h < 14 ? 'gable' : rand() < (hc.mansard ?? 0) ? 'mansard' : 'flat';
            const geos = buildingGeo(cx, cz, ux, uz, wFront / 2, depth / 2, h, y, roofType);
            (rand() < 0.62 ? facGeosA : facGeosB).push(...geos);
            count++;
            d += wFront + (rand() < 0.12 ? 3 + rand() * 6 : 0);
          } else {
            d += 2.5;
          }
        }
      }
    }
  }
  /* ---- bâti réel (OpenStreetMap) ---- */
  if (plan.osmBuildings) {
    const hmin = hc.min ?? 7, hmax = hc.max ?? 14;
    for (const b of plan.osmBuildings) {
      const poly = b.poly;
      if (poly.some(([px, pz]) => Math.abs(px) > R - 4 || Math.abs(pz) > R - 4)) continue;
      const [cx, cz] = centroid(poly);
      if (grid.get(cx, cz) >= 2 || poly.filter(([px, pz]) => grid.get(px, pz) >= 2).length > poly.length * 0.3) continue;
      const area = polyArea(poly);
      if (area < 10) continue;
      let h = b.h || hmin + rand() * (hmax - hmin) * (area > 400 ? 1 : 0.75);
      h = Math.min(130, Math.max(3, h));
      const obb = minRect(poly);
      try {
        if (obb && area < 200 && area / obb.area > 0.85 && h < 14 && rand() < (hc.gable ?? 0.3)) {
          (rand() < 0.62 ? facGeosA : facGeosB).push(...buildingGeo(obb.cx, obb.cz, obb.ux, obb.uz, obb.hw, obb.hd, h, y, 'gable'));
        } else {
          (rand() < 0.62 ? facGeosA : facGeosB).push(extrudeShapeGeo(shapeFromXZ(poly), y, y + h));
        }
        count++;
        b.built = true;
      } catch { /* polygone dégénéré */ }
    }
  }

  const occ = [];
  if (facGeosA.length) g.add(mesh(mergeGeometries(facGeosA), 'facade', { edgeAngle: 35, edgeOpacity: 0.75 }));
  if (facGeosB.length) g.add(mesh(mergeGeometries(facGeosB), 'facade2', { edgeAngle: 35, edgeOpacity: 0.75 }));

  /* ---- arbres (instanciés) ---- */
  if (treesAt.length) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const im = new THREE.InstancedMesh(geo, palette.get('tree', { flat: true }), treesAt.length);
    const m4 = new THREE.Matrix4();
    treesAt.forEach(([x, z, s], i) => {
      m4.compose(new THREE.Vector3(x, y + 3.4 * s + 1.2, z), new THREE.Quaternion(), new THREE.Vector3(2.4 * s, 2.2 * s, 2.4 * s));
      im.setMatrixAt(i, m4);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    g.add(im);
    treesAt.length = 0;
  }

  return { group: g, frame, T, labels, pois, landmarks: landmarkObjs, occluders: occ, buildings: count, streets, graph: plan.graph || null, groundY: y };
}

const treesAt = [];

/* ---------------- utilitaires ---------------- */

function meshNoEdges(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  m.raycast = () => {};
  return m;
}

function slabTwoTone(outer, holes, y) {
  const grp = new THREE.Group();
  const top = rectsMinus(outer, holes).map(([a, b, c, d]) => { const g = new THREE.BoxGeometry(c - a, 0.4, d - b); g.translate((a + c) / 2, y - 0.2, (b + d) / 2); return g; });
  const low = rectsMinus(outer, holes).map(([a, b, c, d]) => { const g = new THREE.BoxGeometry(c - a, 4.6 + y, d - b); g.translate((a + c) / 2, (y - 0.4 - 5) / 2, (b + d) / 2); return g; });
  const t = new THREE.Mesh(mergeGeometries(top), palette.get('ground'));
  t.receiveShadow = true;
  const l = new THREE.Mesh(mergeGeometries(low), palette.get('socleSide'));
  l.receiveShadow = true;
  l.castShadow = true;
  grp.add(t, l);
  grp.traverse((o) => (o.raycast = () => {}));
  void block;
  return grp;
}

export function orientedRect(cx, cz, ux, uz, hw, hd) {
  const nx = -uz, nz = ux;
  return [
    [cx - ux * hw - nx * hd, cz - uz * hw - nz * hd],
    [cx + ux * hw - nx * hd, cz + uz * hw - nz * hd],
    [cx + ux * hw + nx * hd, cz + uz * hw + nz * hd],
    [cx - ux * hw + nx * hd, cz - uz * hw + nz * hd],
  ];
}

function offsetLine(pts, off) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [p[0] - (dz / l) * off, p[1] + (dx / l) * off];
  });
}

export function centroid(poly) {
  let x = 0, z = 0;
  for (const p of poly) { x += p[0]; z += p[1]; }
  return [x / poly.length, z / poly.length];
}
function bbox(poly) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return [x0, z0, x1, z1];
}

function polyArea(p) { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); }

/** Rectangle orienté d'aire minimale (pour poser un toit à deux pans). */
function minRect(poly) {
  let best = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 0.5) continue;
    const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l, nx = -uz, nz = ux;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of poly) { const u = x * ux + z * uz, v = x * nx + z * nz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
      const long = u1 - u0 >= v1 - v0;
      best = { area, cx: ux * uc + nx * vc, cz: uz * uc + nz * vc,
        ux: long ? ux : nx, uz: long ? uz : nz, hw: (long ? u1 - u0 : v1 - v0) / 2, hd: (long ? v1 - v0 : u1 - u0) / 2 };
    }
  }
  return best;
}
