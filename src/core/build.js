import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette } from './materials.js';

export const FONT = "'Segoe UI Variable Display', 'Segoe UI', 'Inter', system-ui, Arial, sans-serif";

/* ------------------------------------------------------------------ */
/*  Boîtes & volumes                                                    */
/* ------------------------------------------------------------------ */

/** Pavé défini par ses bornes. mat = nom de palette ou matériau. */
export function block(x0, y0, z0, x1, y1, z1, mat = 'facade', opts = {}) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const g = new THREE.BoxGeometry(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return mesh(g, mat, opts);
}

/** Pavé centré en x,z, posé en y. */
export function boxAt(x, y, z, w, h, d, mat = 'facade', opts = {}) {
  return block(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, mat, opts);
}

export function mesh(geometry, mat = 'facade', opts = {}) {
  const material = typeof mat === 'string' ? palette.get(mat) : mat;
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.receive ?? true;
  if (opts.edges !== false && !material.transparent) addEdges(m, opts.edgeAngle ?? 30, opts.edgeColor, opts.edgeOpacity);
  if (opts.name) m.name = opts.name;
  return m;
}

export function addEdges(m, angle = 30, color = 'detail', opacity = 1) {
  const eg = new THREE.EdgesGeometry(m.geometry, angle);
  const lines = new THREE.LineSegments(eg, palette.line(color || 'detail', opacity ?? 1));
  lines.raycast = () => {};
  lines.userData.isEdge = true;
  m.add(lines);
  return lines;
}

/* ------------------------------------------------------------------ */
/*  Dalles percées : rectangle moins une liste de trous                 */
/* ------------------------------------------------------------------ */

/** rect = [x0, z0, x1, z1]. Retourne une liste de rectangles couvrant outer \ holes. */
export function rectsMinus(outer, holes) {
  const [ox0, oz0, ox1, oz1] = outer;
  const xs = new Set([ox0, ox1]);
  const zs = new Set([oz0, oz1]);
  const hs = holes
    .map(([a, b, c, d]) => [Math.max(Math.min(a, c), ox0), Math.max(Math.min(b, d), oz0), Math.min(Math.max(a, c), ox1), Math.min(Math.max(b, d), oz1)])
    .filter(([a, b, c, d]) => c > a && d > b);
  for (const [a, b, c, d] of hs) { xs.add(a); xs.add(c); zs.add(b); zs.add(d); }
  const X = [...xs].sort((a, b) => a - b);
  const Z = [...zs].sort((a, b) => a - b);
  const inHole = (cx, cz) => hs.some(([a, b, c, d]) => cx > a && cx < c && cz > b && cz < d);
  const out = [];
  for (let j = 0; j < Z.length - 1; j++) {
    let run = null;
    for (let i = 0; i < X.length - 1; i++) {
      const cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2;
      if (!inHole(cx, cz)) {
        if (run) run[2] = X[i + 1];
        else run = [X[i], Z[j], X[i + 1], Z[j + 1]];
      } else if (run) { out.push(run); run = null; }
    }
    if (run) out.push(run);
  }
  // fusion verticale des bandes identiques
  const merged = [];
  for (const r of out) {
    const m = merged.find((q) => q[0] === r[0] && q[2] === r[2] && Math.abs(q[3] - r[1]) < 1e-6);
    if (m) m[3] = r[3];
    else merged.push([...r]);
  }
  return merged;
}

export function slab(outer, holes, y0, y1, mat = 'platform', opts = {}) {
  const geos = rectsMinus(outer, holes).map(([a, b, c, d]) => {
    const g = new THREE.BoxGeometry(c - a, y1 - y0, d - b);
    g.translate((a + c) / 2, (y0 + y1) / 2, (b + d) / 2);
    return g;
  });
  if (!geos.length) return new THREE.Group();
  return mesh(mergeGeometries(geos), mat, opts);
}

/* ------------------------------------------------------------------ */
/*  Extrusions de polygones (plan x,z)                                  */
/* ------------------------------------------------------------------ */

export function shapeFromXZ(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  return s;
}

/** Extrude une forme (THREE.Shape dans le plan x,-z) entre y0 et y1. */
export function extrudeShapeGeo(shape, y0, y1, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 12 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

export function extrudeXZ(pts, y0, y1, mat = 'facade', opts = {}) {
  return mesh(extrudeShapeGeo(shapeFromXZ(pts), y0, y1), mat, opts);
}

/** Façade plane verticale (plan x,y) avec ouvertures, extrudée selon z (épaisseur). */
export function wallWithOpenings({ w, h, depth = 0.4, openings = [], mat = 'facade', opts = {} }) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
  for (const o of openings) s.holes.push(openingPath(o));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 });
  g.translate(0, 0, -depth / 2);
  return mesh(g, mat, opts);
}

/** Ouverture : {x, y, w, h, arch} (arch = true pour un plein cintre). */
export function openingPath({ x, y, w, h, arch = false, round = false }) {
  const p = new THREE.Path();
  if (round) { p.absarc(x, y + w / 2, w / 2, 0, Math.PI * 2, true); return p; }
  const r = arch ? w / 2 : 0;
  p.moveTo(x - w / 2, y);
  p.lineTo(x + w / 2, y);
  p.lineTo(x + w / 2, y + h - r);
  if (arch) p.absarc(x, y + h - r, r, 0, Math.PI, false);
  else p.lineTo(x - w / 2, y + h);
  p.lineTo(x - w / 2, y);
  return p;
}

/** Vitrage remplissant une ouverture. */
export function glassPane({ x, y, w, h, arch = false, round = false }, factor = 1) {
  const s = new THREE.Shape(openingPath({ x, y, w, h, arch, round }).getPoints(24));
  const g = new THREE.ShapeGeometry(s, 16);
  const m = new THREE.Mesh(g, palette.glass(factor));
  m.raycast = () => {};
  return m;
}

/* ------------------------------------------------------------------ */
/*  Escaliers                                                          */
/* ------------------------------------------------------------------ */

/** Escalier allant de (xa,ya) à (xb,yb) le long de l'axe x (ou z si axis='z'), largeur w autour de c. */
export function stairs({ axis = 'x', a, b, ya, yb, c, w, steps = 14, mat = 'floor2' }) {
  const geos = [];
  const n = steps;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const s0 = a + (b - a) * t0, s1 = a + (b - a) * t1;
    const top = ya + (yb - ya) * (ya > yb ? t1 : t0) ; // la marche à la hauteur la plus basse de l'intervalle côté descente
    const yTop = Math.max(ya + (yb - ya) * t0, ya + (yb - ya) * t1);
    const yBot = Math.min(ya, yb) - 0.3;
    const lo = Math.min(s0, s1), hi = Math.max(s0, s1);
    const g = axis === 'x' ? new THREE.BoxGeometry(hi - lo, yTop - yBot, w) : new THREE.BoxGeometry(w, yTop - yBot, hi - lo);
    if (axis === 'x') g.translate((lo + hi) / 2, (yTop + yBot) / 2, c);
    else g.translate(c, (yTop + yBot) / 2, (lo + hi) / 2);
    void top;
    geos.push(g);
  }
  return mesh(mergeGeometries(geos), mat, { edgeAngle: 50, edgeOpacity: 0.6 });
}

/* ------------------------------------------------------------------ */
/*  Panneaux de signalétique (texture canvas)                           */
/* ------------------------------------------------------------------ */

const texCache = new Map();

/**
 * Crée une texture de panneau. spec = { w, h (px), bg, draw(ctx, W, H) }.
 */
export function canvasTexture(key, W, H, draw) {
  if (key && texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  draw(ctx, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (key) texCache.set(key, t);
  return t;
}

export function clearTextureCache() {
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Panneau suspendu ou sur pied. lines = [{text, size, color, weight, align}] ou chaîne.
 * style: 'light' (blanc, texte foncé) | 'accent' (cyan) | 'board' (tableau des départs)
 */
export function signPanel({ w = 3, h = 0.8, lines = [], style = 'light', draw = null, key = null, double = true, px = 256 }) {
  const W = Math.round(w * px), H = Math.round(h * px);
  const tex = canvasTexture(key, W, H, (ctx) => {
    if (draw) return draw(ctx, W, H);
    const bg = style === 'accent' ? '#12b3e6' : '#ffffff';
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, W, H, Math.min(W, H) * 0.12);
    ctx.fill();
    if (style !== 'accent') {
      ctx.fillStyle = '#12b3e6';
      ctx.fillRect(0, 0, Math.max(10, W * 0.012), H);
    }
    const arr = typeof lines === 'string' ? [{ text: lines }] : lines;
    const total = arr.reduce((s, l) => s + (l.size || 0.5), 0);
    let y = (H - total * H * 0.82) / 2;
    for (const l of arr) {
      const size = (l.size || 0.5) * H * 0.82;
      ctx.font = `${l.weight || 600} ${Math.round(size * 0.82)}px ${FONT}`;
      ctx.fillStyle = l.color || (style === 'accent' ? '#ffffff' : '#26313c');
      ctx.textBaseline = 'middle';
      ctx.textAlign = l.align || 'center';
      const x = l.align === 'left' ? W * 0.06 : l.align === 'right' ? W * 0.94 : W / 2;
      ctx.fillText(l.text, x, y + size / 2);
      y += size;
    }
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, alphaTest: 0.02, side: double ? THREE.DoubleSide : THREE.FrontSide });
  const g = new THREE.PlaneGeometry(w, h);
  const m = new THREE.Mesh(g, mat);
  m.userData.sign = true;
  return m;
}

/** Panneau posé sur deux poteaux fins. */
export function signOnPosts(opts, y = 2.6, postColor = 'detail') {
  const grp = new THREE.Group();
  const p = signPanel(opts);
  p.position.y = y;
  grp.add(p);
  const back = block(-opts.w / 2, y - opts.h / 2, -0.03, opts.w / 2, y + opts.h / 2, -0.01, 'facade2', { edges: false });
  grp.add(back);
  for (const sx of [-opts.w / 2 + 0.15, opts.w / 2 - 0.15]) grp.add(block(sx - 0.04, 0, -0.06, sx + 0.04, y - opts.h / 2, 0.02, postColor, { edges: false }));
  return grp;
}

/** Panneau suspendu (deux filins). */
export function signHanging(opts, y = 3.2, ceiling = 5.5) {
  const grp = new THREE.Group();
  const p = signPanel(opts);
  p.position.y = y;
  grp.add(p);
  for (const sx of [-opts.w / 2 + 0.2, opts.w / 2 - 0.2]) grp.add(block(sx - 0.015, y + opts.h / 2, -0.015, sx + 0.015, ceiling, 0.015, 'dark', { edges: false, cast: false }));
  return grp;
}

/* ------------------------------------------------------------------ */
/*  Divers                                                             */
/* ------------------------------------------------------------------ */

export function mergeMeshes(meshes, mat, opts = {}) {
  const geos = meshes.map((m) => {
    m.updateMatrixWorld(true);
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    return g;
  });
  return mesh(mergeGeometries(geos), mat, opts);
}

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material.map && !o.material.userData.keepMap) {
      // textures de panneaux : uniquement si non partagées
      if (!o.material.map.userData?.shared) o.material.map.dispose();
    }
    if (o.material && o.material.userData?.owned) o.material.dispose();
  });
}

/** Arbre stylisé (sphère facettée sur tronc fin), très clair. */
export function tree(x, z, s = 1) {
  const g = new THREE.Group();
  g.add(block(x - 0.12 * s, 0, z - 0.12 * s, x + 0.12 * s, 2.2 * s, z + 0.12 * s, 'detail', { edges: false }));
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9 * s, 1), palette.get('tree', { flat: true }));
  crown.position.set(x, 3.6 * s, z);
  crown.castShadow = true;
  crown.receiveShadow = true;
  g.add(crown);
  return g;
}

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
