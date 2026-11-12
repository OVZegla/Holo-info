import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette } from '../core/materials.js';
import { block, boxAt, mesh, wallWithOpenings, glassPane, extrudeXZ, signPanel, FONT } from '../core/build.js';

/*
 * Monuments et bâtiments repères, stylisés « maquette blanche ».
 * Chaque fonction renvoie un groupe dont l'origine est au sol, au centre,
 * la façade principale tournée vers +z (l'orientation réelle est appliquée
 * par le plan de ville).
 */

const G = () => new THREE.Group();

function cyl(r1, r2, h, seg, mat, y = 0, x = 0, z = 0, opts = {}) {
  const geo = new THREE.CylinderGeometry(r1, r2, h, seg, 1, false, opts.thetaStart ?? (seg === 4 ? Math.PI / 4 : 0));
  geo.translate(x, y + h / 2, z);
  return mesh(geo, mat, { edgeAngle: 35, edgeOpacity: opts.edgeOpacity ?? 0.8 });
}
function cone(r, h, seg, mat, y, x = 0, z = 0) { return cyl(0.001, r, h, seg, mat, y, x, z); }

function clock(r = 1.2) {
  const g = G();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 40), palette.get('white'));
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.07, 6, 40), palette.get('dark'));
  g.add(ring);
  const h1 = block(-r * 0.04, -r * 0.05, 0.06, r * 0.04, r * 0.55, 0.1, 'dark', { edges: false });
  const h2 = block(-r * 0.04, -r * 0.05, 0.06, r * 0.04, r * 0.8, 0.1, 'dark', { edges: false });
  h2.rotation.z = -2.1;
  g.add(h1, h2);
  return g;
}

/** Pignon flamand à gradins (pas de moineaux) : forme dans le plan x,y. */
function steppedGable(w, h, steps = 4) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  for (let i = 0; i < steps; i++) {
    const x = w / 2 - (i * w) / (2 * steps + 1);
    s.lineTo(x, ((i + 1) * h) / (steps + 1));
    s.lineTo(x - w / (2 * steps + 1), ((i + 1) * h) / (steps + 1));
  }
  s.lineTo(w / (2 * (2 * steps + 1)), h);
  s.lineTo(-w / (2 * (2 * steps + 1)), h);
  for (let i = steps - 1; i >= 0; i--) {
    const x = -w / 2 + (i * w) / (2 * steps + 1);
    s.lineTo(x + w / (2 * steps + 1), ((i + 1) * h) / (steps + 1));
    s.lineTo(x, ((i + 1) * h) / (steps + 1));
  }
  s.closePath();
  return s;
}

/** Pignon à volutes (baroque flamand, Arras). */
function curvedGable(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h * 0.12);
  s.quadraticCurveTo(w * 0.42, h * 0.5, w * 0.24, h * 0.55);
  s.lineTo(w * 0.24, h * 0.78);
  s.quadraticCurveTo(w * 0.2, h * 0.98, 0, h);
  s.quadraticCurveTo(-w * 0.2, h * 0.98, -w * 0.24, h * 0.78);
  s.lineTo(-w * 0.24, h * 0.55);
  s.quadraticCurveTo(-w * 0.42, h * 0.5, -w / 2, h * 0.12);
  s.closePath();
  return s;
}

function shapeSlab(shape, depth, mat, x = 0, y = 0, z = 0, opts = {}) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
  geo.translate(x, y, z - depth / 2);
  return mesh(geo, mat, { edgeAngle: 30, ...opts });
}

/** Prisme de toiture (2 pans) de largeur w (x), profondeur d (z), hauteur rh, posé en y. */
function gableRoof(w, d, rh, y, mat = 'roof', alongX = false) {
  const s = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rh)]);
  const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  geo.translate(0, 0, -w / 2);
  geo.rotateY(Math.PI / 2);
  if (!alongX) geo.rotateY(Math.PI / 2);
  geo.translate(0, y, 0);
  return mesh(geo, mat, { edgeAngle: 30 });
}

/* ================================================================== */
/*  BÉTHUNE                                                            */
/* ================================================================== */

/** Beffroi de Béthune (≈ 47 m) : tour carrée, tourelles d'angle, toit en pavillon et flèche. */
export function beffroiBethune() {
  const g = G();
  g.add(boxAt(0, 0, 0, 9, 29, 9, 'facade'));
  g.add(boxAt(0, 29, 0, 10, 1, 10, 'facade2'));
  g.add(boxAt(0, 30, 0, 7.4, 6, 7.4, 'facade'));
  for (const [x, z] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]]) {
    g.add(cyl(1.15, 1.15, 6.5, 12, 'facade', 28.5, x, z));
    g.add(cone(1.4, 3.6, 12, 'roof', 35, x, z));
  }
  g.add(cone(5.4, 6.5, 4, 'roof', 36));
  g.add(cyl(1.3, 1.3, 2.6, 8, 'facade', 41.5));
  g.add(cone(1.5, 1.2, 8, 'roof', 44.1));
  g.add(cone(0.35, 3.4, 6, 'detail', 45.2));
  for (const s of [-1, 1]) {
    const c = clock(1.5);
    c.position.set(0, 24, s * 4.56);
    if (s < 0) c.rotation.y = Math.PI;
    g.add(c);
  }
  // baies hautes
  for (const s of [-1, 1]) for (const x of [-2, 2]) g.add(block(x - 0.7, 31, s * 3.72 - 0.05, x + 0.7, 34.5, s * 3.72 + 0.05, 'facade3', { edges: false }));
  return g;
}

/** Façade de la gare de Béthune : pavillon central à pignon à gradins, horloge, ailes basses. */
export function facadeBethune() {
  const g = G();
  const z = 20;
  // ailes
  for (const s of [-1, 1]) {
    const w = wallWithOpenings({ w: 21, h: 8.5, depth: 0.6, mat: 'brick', openings: [-7, -2.3, 2.3, 7].map((x) => ({ x, y: 1.4, w: 2.4, h: 4.8, arch: true })) });
    w.position.set(s * 19.5, 0, z + 0.3);
    g.add(w);
    for (const x of [-7, -2.3, 2.3, 7]) { const gp = glassPane({ x, y: 1.4, w: 2.4, h: 4.8, arch: true }); gp.position.set(s * 19.5, 0, z + 0.3); g.add(gp); }
    g.add(block(s * 9 - (s > 0 ? 0 : 21), 8.5, z - 0.1, s * 9 + (s > 0 ? 21 : 0), 9.1, z + 0.9, 'facade', { edges: true }));
  }
  // pavillon central
  const ph = 13;
  const pw = 18;
  const front = wallWithOpenings({ w: pw, h: ph, depth: 1.2, mat: 'brick', openings: [
    { x: -5, y: 0, w: 3.2, h: 5.6, arch: true }, { x: 0, y: 0, w: 3.6, h: 6.4, arch: true }, { x: 5, y: 0, w: 3.2, h: 5.6, arch: true },
    { x: 0, y: 7.4, w: 9, h: 4.3, arch: true },
  ] });
  front.position.set(0, 0, z + 0.9);
  g.add(front);
  for (const o of [{ x: 0, y: 7.4, w: 9, h: 4.3, arch: true }]) { const gp = glassPane(o, 1.2); gp.position.set(0, 0, z + 0.9); g.add(gp); }
  const gable = shapeSlab(steppedGable(pw, 7.5, 4), 1.2, 'brick', 0, ph, z + 0.9);
  g.add(gable);
  g.add(block(-pw / 2 - 0.3, ph - 0.2, z + 0.1, pw / 2 + 0.3, ph + 0.35, z + 1.75, 'facade'));
  // pilastres
  for (const x of [-pw / 2, pw / 2]) g.add(block(x - 0.6, 0, z + 0.2, x + 0.6, ph + 1.2, z + 1.8, 'facade'));
  const c = clock(1.25);
  c.position.set(0, ph + 2.7, z + 1.56);
  g.add(c);
  // marquise
  g.add(block(-7.5, 5.9, z + 1.5, 7.5, 6.15, z + 4.2, 'roof'));
  // nom
  const name = signPanel({ w: 7, h: 0.75, key: 'name-bethune', draw: nameplate('Gare de Béthune') });
  name.position.set(0, 6.75, z + 1.52);
  g.add(name);
  return g;
}

function nameplate(text) {
  return (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#26313c';
    ctx.font = `600 ${Math.round(H * 0.62)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), W / 2, H / 2 + 2);
  };
}

/* ================================================================== */
/*  LENS                                                               */
/* ================================================================== */

/** Gare de Lens (Art déco, silhouette de locomotive) : long corps bas, tour-horloge, gradins. */
export function facadeLens() {
  const g = G();
  const z = 20;
  // corps principal (la « chaudière »)
  const body = wallWithOpenings({ w: 44, h: 8.5, depth: 0.7, mat: 'facade', openings: [
    ...[-18, -14, -10].map((x) => ({ x, y: 2.2, w: 2.6, h: 4.5 })),
    { x: 0, y: 0.4, w: 12, h: 7 },
    ...[10, 14, 18].map((x) => ({ x, y: 2.2, w: 2.6, h: 4.5 })),
  ] });
  body.position.set(-4, 0, z + 0.35);
  g.add(body);
  const gp = glassPane({ x: 0, y: 0.4, w: 12, h: 7 }, 1.2); gp.position.set(-4, 0, z + 0.35); g.add(gp);
  for (let x = -9.5; x <= 1.5; x += 2.2) g.add(block(x - 0.12, 0.4, z + 0.3, x + 0.12, 7.4, z + 0.9, 'facade2', { edges: false }));
  // bandeaux horizontaux
  for (const y of [7.6, 9.2]) g.add(block(-26.3, y, z - 0.2, 18.3, y + 0.35, z + 1.0, 'facade2', { edges: false }));
  // toiture arrondie de la « locomotive »
  const roofS = new THREE.Shape();
  roofS.moveTo(-8, 0); roofS.lineTo(8, 0); roofS.quadraticCurveTo(8, 3.2, 0, 3.4); roofS.quadraticCurveTo(-8, 3.2, -8, 0);
  const rg = new THREE.ExtrudeGeometry(roofS, { depth: 44, bevelEnabled: false, curveSegments: 12 });
  rg.translate(0, 0, -22);
  rg.rotateY(Math.PI / 2);
  rg.translate(-4, 8.5, z - 7.9);
  g.add(mesh(rg, 'roof', { edgeAngle: 25 }));
  // tour-horloge (la « cheminée »)
  g.add(boxAt(-27, 0, z - 2, 5.5, 23, 5.5, 'facade'));
  g.add(boxAt(-27, 23, z - 2, 6.5, 0.6, 6.5, 'facade2'));
  g.add(boxAt(-27, 23.6, z - 2, 4.2, 2.2, 4.2, 'facade'));
  for (let i = 0; i < 4; i++) g.add(block(-27 - 2.78, 4 + i * 4, z + 0.76, -27 + 2.78, 4.25 + i * 4, z + 0.86, 'facade2', { edges: false }));
  const c = clock(1.7); c.position.set(-27, 19.5, z + 0.8); g.add(c);
  // gradins côté est (la cabine)
  g.add(boxAt(23, 0, z - 6, 10, 10.5, 12, 'facade'));
  g.add(boxAt(27, 0, z - 6, 6, 12.5, 9, 'facade2'));
  g.add(block(18, 7.6, z + 0.2, 28, 7.95, z + 2.6, 'roof'));
  // marquise
  g.add(block(-12, 5.8, z + 0.6, 4, 6.05, z + 4.4, 'roof'));
  const name = signPanel({ w: 7.6, h: 0.75, key: 'name-lens', draw: nameplate('Gare de Lens') });
  name.position.set(-4, 8.0, z + 0.75);
  g.add(name);
  return g;
}

/** Stade Bollaert-Delelis (stylisé) : quatre tribunes couvertes autour de la pelouse. */
export function stadeBollaert() {
  const g = G();
  const W = 150, D = 110, pitchW = 105, pitchD = 68;
  g.add(block(-pitchW / 2 - 4, 0, -pitchD / 2 - 4, pitchW / 2 + 4, 0.15, pitchD / 2 + 4, 'green', { edges: false }));
  g.add(block(-0.15, 0.15, -pitchD / 2, 0.15, 0.2, pitchD / 2, 'white', { edges: false }));
  const stand = (len, depth, h) => {
    const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(depth, 0), new THREE.Vector2(depth, h), new THREE.Vector2(0, 1.5)]);
    const geo = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
    geo.translate(0, 0, -len / 2);
    return geo;
  };
  const sides = [
    { len: W - 24, depth: 20, h: 22, x: 0, z: pitchD / 2 + 6, rot: -Math.PI / 2 },
    { len: W - 24, depth: 20, h: 22, x: 0, z: -pitchD / 2 - 6, rot: Math.PI / 2 },
    { len: D - 24, depth: 16, h: 18, x: pitchW / 2 + 6, z: 0, rot: 0 },
    { len: D - 24, depth: 16, h: 18, x: -pitchW / 2 - 6, z: 0, rot: Math.PI },
  ];
  for (const sd of sides) {
    const geo = stand(sd.len, sd.depth, sd.h);
    geo.rotateY(sd.rot);
    geo.translate(sd.x, 0, sd.z);
    g.add(mesh(geo, 'facade'));
    // toiture
    const rt = new THREE.BoxGeometry(sd.depth + 6, 0.5, sd.len);
    rt.translate(sd.depth / 2 - 3, sd.h + 4, 0);
    rt.rotateY(sd.rot);
    rt.translate(sd.x, 0, sd.z);
    g.add(mesh(rt, 'roof'));
  }
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(cyl(0.6, 0.6, 34, 8, 'detail', 0, x * (W / 2 - 2), z * (D / 2 - 2)));
  return g;
}

/** Louvre-Lens (stylisé) : longs volumes bas et vitrés en enfilade. */
export function louvreLens() {
  const g = G();
  const parts = [[-120, 70, 0.06], [-45, 80, 0.0], [0, 30, 0], [45, 80, 0], [125, 70, -0.06]];
  for (const [x, len, rot] of parts) {
    const m = boxAt(0, 0, 0, len, 7, 26, 'white');
    m.position.x = x; m.rotation.y = rot;
    g.add(m);
  }
  const glass = new THREE.Mesh(new THREE.BoxGeometry(30, 6.5, 26.2), palette.glass(1.4));
  glass.position.y = 3.3;
  g.add(glass);
  return g;
}

/** Terrils jumeaux (Loos-en-Gohelle), à l'échelle du paysage. */
export function terrils() {
  const g = G();
  const mat = palette.get('socle', { flat: true });
  for (const [x, z, r, h] of [[-160, 0, 330, 140], [220, 60, 360, 146]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9, 1), mat);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

/* ================================================================== */
/*  ARRAS                                                              */
/* ================================================================== */

/** Gare d'Arras (années 1950) : long volume moderne à trame verticale, grande marquise. */
export function facadeArras() {
  const g = G();
  const z = 20;
  const w = wallWithOpenings({ w: 60, h: 11, depth: 0.5, mat: 'facade', openings: [{ x: 0, y: 0.4, w: 40, h: 9.4 }] });
  w.position.set(0, 0, z + 0.25);
  g.add(w);
  const gp = glassPane({ x: 0, y: 0.4, w: 40, h: 9.4 }, 1.1); gp.position.set(0, 0, z + 0.2); g.add(gp);
  const fins = [];
  for (let x = -19.5; x <= 19.5; x += 2.6) { const f = new THREE.BoxGeometry(0.3, 9.4, 1.3).toNonIndexed(); f.translate(x, 5.1, z + 0.9); fins.push(f); }
  g.add(mesh(mergeGeometries(fins), 'facade2', { edgeAngle: 30 }));
  g.add(block(-31, 11, z - 16.5, 31, 11.6, z + 1.0, 'roof'));
  g.add(block(-22, 4.2, z + 0.5, 22, 4.55, z + 6.5, 'roof'));
  for (const x of [-21, 21]) g.add(block(x - 0.2, 0, z + 6.0, x + 0.2, 4.2, z + 6.4, 'detail', { edges: false }));
  const c = clock(1.6); c.position.set(25, 7.8, z + 0.52); g.add(c);
  const name = signPanel({ w: 8.5, h: 0.8, key: 'name-arras', draw: nameplate("Gare d'Arras") });
  name.position.set(0, 10.4, z + 1.6);
  g.add(name);
  return g;
}

/** Beffroi d'Arras (≈ 75 m) : tour carrée, étage octogonal, couronne ajourée, bulbe et lion. */
export function beffroiArras() {
  const g = G();
  g.add(boxAt(0, 0, 0, 11, 36, 11, 'facade'));
  for (const [x, z] of [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]]) g.add(boxAt(x, 0, z, 1.6, 38, 1.6, 'facade2'));
  g.add(boxAt(0, 36, 0, 12.5, 1.2, 12.5, 'facade2'));
  for (const [x, z] of [[-5.6, -5.6], [5.6, -5.6], [-5.6, 5.6], [5.6, 5.6]]) g.add(cone(0.9, 6, 6, 'facade', 37.2, x, z));
  g.add(cyl(5, 5, 14, 8, 'facade', 37.2));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    g.add(block(Math.cos(a) * 4.95 - 0.5, 40, Math.sin(a) * 4.95 - 0.5, Math.cos(a) * 4.95 + 0.5, 49, Math.sin(a) * 4.95 + 0.5, 'facade3', { edges: false }));
  }
  g.add(cyl(5.6, 5.6, 0.8, 8, 'facade2', 51.2));
  // couronne
  g.add(cyl(3.6, 4.2, 7, 8, 'facade', 52));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(cone(0.55, 4.5, 6, 'facade', 56, Math.cos(a) * 4.0, Math.sin(a) * 4.0));
  }
  // bulbe et lanterne
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), palette.get('roof'));
  bulb.scale.set(1, 1.2, 1); bulb.position.y = 62.5; bulb.castShadow = true;
  g.add(bulb);
  g.add(cyl(1, 1, 3, 8, 'facade', 65.8));
  g.add(cone(1.4, 4, 8, 'roof', 68.8));
  g.add(cone(0.3, 3.5, 6, 'detail', 72.5));
  const c = clock(2.2); c.position.set(0, 30, 5.62); g.add(c);
  return g;
}

/** Hôtel de ville d'Arras (gothique, arcades, haute toiture). */
export function hotelDeVilleArras() {
  const g = G();
  const W = 46, D = 22, H = 15;
  g.add(boxAt(0, 0, 0, W, H, D, 'facade'));
  const arc = wallWithOpenings({ w: W, h: 6, depth: 0.8, mat: 'facade', openings: Array.from({ length: 7 }, (_, i) => ({ x: -W / 2 + 3.3 + i * 6.6, y: 0, w: 4.6, h: 5.2, arch: true })) });
  arc.position.set(0, 0, D / 2 + 0.4);
  g.add(arc);
  g.add(gableRoof(W, D, 12, H, 'roof', true));
  for (let i = 0; i < 6; i++) g.add(boxAt(-W / 2 + 5 + i * 7.2, H + 1.5, D / 2 - 3.5, 2.2, 3.2, 1.8, 'facade'));
  g.add(block(-W / 2, H, D / 2 - 0.2, W / 2, H + 0.6, D / 2 + 0.8, 'facade2'));
  return g;
}

/**
 * Rangée de maisons à pignons à volutes (places d'Arras), le long de x.
 * params.length (m), seed. Façades vers +z, arcades au rez-de-chaussée.
 */
export function rangeePignons({ length = 80, seed = 3, depth = 13 } = {}) {
  const g = G();
  let r = seed;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const fronts = [], gables = [], roofs = [];
  let x = -length / 2;
  while (x < length / 2 - 4) {
    const w = Math.min(5.5 + rnd() * 3, length / 2 - x);
    const h = 11 + rnd() * 3.5;
    const cx = x + w / 2;
    const body = new THREE.BoxGeometry(w - 0.12, h - 3.6, depth).toNonIndexed();
    body.translate(cx, 3.6 + (h - 3.6) / 2, -depth / 2);
    fronts.push(body);
    // arcade
    const pier = new THREE.BoxGeometry(0.7, 3.6, depth - 3).toNonIndexed();
    pier.translate(x + 0.4, 1.8, -depth / 2 - 1.5);
    fronts.push(pier);
    const back = new THREE.BoxGeometry(w, 3.6, depth - 3.2).toNonIndexed();
    back.translate(cx, 1.8, -depth / 2 - 1.6);
    fronts.push(back);
    const gs = curvedGable(w - 0.12, 6.5 + rnd() * 1.5);
    const gg = new THREE.ExtrudeGeometry(gs, { depth: 0.5, bevelEnabled: false, curveSegments: 8 });
    gg.translate(cx, h, -0.5);
    gables.push(gg);
    const rs = new THREE.Shape([new THREE.Vector2(-w / 2 + 0.3, 0), new THREE.Vector2(w / 2 - 0.3, 0), new THREE.Vector2(0, 6.5)]);
    const rg = new THREE.ExtrudeGeometry(rs, { depth: depth - 0.6, bevelEnabled: false });
    rg.translate(cx, h, -depth);
    roofs.push(rg);
    x += w;
  }
  g.add(mesh(mergeGeometries(fronts), 'brick', { edgeAngle: 30 }));
  g.add(mesh(mergeGeometries(gables), 'facade', { edgeAngle: 30 }));
  g.add(mesh(mergeGeometries(roofs), 'roof', { edgeAngle: 30 }));
  return g;
}

/** Place d'Arras complète : 4 rangées de maisons autour d'un rectangle libre. */
export function placeArras({ w = 100, d = 60, seed = 5, skipSides = [] } = {}) {
  const g = G();
  const sides = [
    { len: w, x: 0, z: d / 2 + 13, rot: Math.PI, id: 'n' },
    { len: w, x: 0, z: -d / 2 - 13, rot: 0, id: 's' },
    { len: d + 26, x: w / 2 + 13, z: 0, rot: -Math.PI / 2, id: 'e' },
    { len: d + 26, x: -w / 2 - 13, z: 0, rot: Math.PI / 2, id: 'w' },
  ];
  sides.forEach((s, i) => {
    if (skipSides.includes(s.id)) return;
    const row = rangeePignons({ length: s.len, seed: seed + i * 17 });
    row.rotation.y = s.rot;
    // la rangée est construite façade en z = 0 vers +z ; on la recule de sa profondeur
    row.position.set(s.x, 0, s.z);
    g.add(row);
  });
  void sides;
  return g;
}

/** Cathédrale d'Arras (classique) : longue nef, portique à fronton. */
export function cathedraleArras() {
  const g = G();
  g.add(boxAt(0, 0, -20, 26, 26, 90, 'facade'));
  g.add(boxAt(0, 0, -20, 40, 15, 70, 'facade2'));
  g.add(gableRoof(26, 90, 8, 26, 'roof'));
  const fr = new THREE.Shape([new THREE.Vector2(-13, 0), new THREE.Vector2(13, 0), new THREE.Vector2(0, 6)]);
  g.add(shapeSlab(fr, 1.2, 'facade', 0, 26, 25.6));
  for (let i = 0; i < 6; i++) g.add(cyl(0.8, 0.8, 18, 12, 'white', 1, -10 + i * 4, 28));
  g.add(block(-13, 19, 26.5, 13, 21, 29, 'facade'));
  g.add(block(-14, 0, 26, 14, 1, 30, 'facade2'));
  return g;
}

/* ================================================================== */
/*  LILLE                                                              */
/* ================================================================== */

/** Beffroi de l'Hôtel de Ville de Lille (104 m) et l'hôtel de ville (années 1930). */
export function beffroiLille() {
  const g = G();
  g.add(boxAt(0, 0, 0, 9, 70, 9, 'brick'));
  for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) g.add(boxAt(x, 0, z, 1.4, 72, 1.4, 'facade'));
  g.add(boxAt(0, 70, 0, 10, 1.4, 10, 'facade2'));
  g.add(boxAt(0, 71.4, 0, 8, 14, 8, 'facade'));
  for (const s of [-1, 1]) for (const x of [-2, 0, 2]) {
    g.add(block(x - 0.6, 73, s * 4 - 0.06, x + 0.6, 83.5, s * 4 + 0.06, 'facade3', { edges: false }));
    g.add(block(s * 4 - 0.06, 73, x - 0.6, s * 4 + 0.06, 83.5, x + 0.6, 'facade3', { edges: false }));
  }
  g.add(boxAt(0, 85.4, 0, 9, 1, 9, 'facade2'));
  for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) g.add(cone(0.9, 7, 6, 'facade', 86.4, x, z));
  g.add(cyl(3.2, 3.8, 6, 8, 'facade', 86.4));
  g.add(cyl(2.3, 2.6, 5, 8, 'facade', 92.4));
  g.add(cone(2.6, 4.5, 8, 'roof', 97.4));
  g.add(cone(0.3, 3.2, 6, 'detail', 101.6));
  const c = clock(2.0); c.position.set(0, 64, 4.56); g.add(c);
  // hôtel de ville (long bâtiment de brique)
  g.add(boxAt(-62, 0, -2, 112, 19, 22, 'brick'));
  for (let i = 0; i < 10; i++) g.add(boxAt(-112 + i * 11, 19, -2, 6, 3.4, 23, 'facade'));
  return g;
}

/** Chambre de commerce (Nouvelle Bourse) et son beffroi (76 m). */
export function beffroiCCI() {
  const g = G();
  g.add(boxAt(0, 0, -8, 46, 18, 34, 'brick'));
  g.add(gableRoof(46, 34, 8, 18, 'roof', true));
  for (const x of [-16, 0, 16]) g.add(shapeSlab(steppedGable(10, 7, 3), 0.8, 'facade', x, 18, 9.2));
  g.add(boxAt(0, 0, 4, 9, 46, 9, 'brick'));
  for (const [x, z] of [[-4.5, -0.5], [4.5, -0.5], [-4.5, 8.5], [4.5, 8.5]]) g.add(boxAt(x, 0, z, 1.2, 47, 1.2, 'facade'));
  g.add(boxAt(0, 46, 4, 10, 1, 10, 'facade2'));
  g.add(cyl(3.6, 4.2, 8, 8, 'facade', 47, 0, 4));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(3.4, 14, 10), palette.get('roof'));
  bulb.scale.set(1, 1.15, 1); bulb.position.set(0, 57, 4); bulb.castShadow = true;
  g.add(bulb);
  g.add(cyl(1, 1, 3, 8, 'facade', 60.5, 0, 4));
  g.add(cone(1.2, 12, 8, 'roof', 63.5, 0, 4));
  for (const s of [-1, 1]) { const c = clock(2.1); c.position.set(0, 41, 4 + s * 4.56); if (s < 0) c.rotation.y = Math.PI; g.add(c); }
  return g;
}

/** Opéra de Lille : bloc néoclassique, portique à colonnes et fronton sculpté. */
export function operaLille() {
  const g = G();
  g.add(boxAt(0, 0, -30, 52, 24, 62, 'facade'));
  g.add(boxAt(0, 24, -40, 40, 10, 34, 'facade2'));
  g.add(block(-24, 0, 0, 24, 3, 6, 'facade2'));
  for (let i = 0; i < 6; i++) g.add(cyl(0.95, 0.95, 13, 14, 'white', 3, -12.5 + i * 5, 4.5));
  g.add(block(-17, 16, 0, 17, 19.5, 6, 'facade'));
  const fr = new THREE.Shape([new THREE.Vector2(-17, 0), new THREE.Vector2(17, 0), new THREE.Vector2(0, 7)]);
  g.add(shapeSlab(fr, 2, 'facade', 0, 19.5, 5));
  g.add(boxAt(0, 26.5, 5.5, 4, 3, 1.2, 'facade3'));
  return g;
}

/** Vieille Bourse : quadrilatère baroque flamand à cour intérieure, lucarnes. */
export function vieilleBourse() {
  const g = G();
  const S = 44, d = 12, h = 15;
  const ring = [[-S / 2, -S / 2, S / 2, -S / 2 + d], [-S / 2, S / 2 - d, S / 2, S / 2], [-S / 2, -S / 2 + d, -S / 2 + d, S / 2 - d], [S / 2 - d, -S / 2 + d, S / 2, S / 2 - d]];
  for (const [a, b, c, e] of ring) g.add(block(a, 0, b, c, h, e, 'brick'));
  for (const [x, z, alongX] of [[0, -S / 2 + d / 2, true], [0, S / 2 - d / 2, true], [-S / 2 + d / 2, 0, false], [S / 2 - d / 2, 0, false]]) {
    const r = gableRoof(alongX ? S : S - 2 * d, d, 6, h, 'roof', alongX);
    r.position.set(x, 0, z);
    g.add(r);
  }
  for (let i = 0; i < 6; i++) {
    const x = -S / 2 + 4 + i * 7.2;
    const gg = shapeSlab(curvedGable(4.4, 5), 0.5, 'facade', x, h, S / 2 + 0.2);
    g.add(gg);
  }
  return g;
}

/** Colonne de la Déesse (Grand'Place). */
export function colonneDeesse() {
  const g = G();
  g.add(boxAt(0, 0, 0, 6, 4, 6, 'facade2'));
  g.add(cyl(0.9, 1.1, 24, 16, 'facade', 4));
  g.add(cyl(0.7, 0.4, 4, 10, 'facade3', 28));
  return g;
}

/** Église Saint-Maurice : église-halle gothique (pignons parallèles) et clocher. */
export function saintMaurice() {
  const g = G();
  const naves = 5, nw = 8.5, L = 64;
  for (let i = 0; i < naves; i++) {
    const x = -((naves - 1) * nw) / 2 + i * nw;
    const b = boxAt(x, 0, -L / 2, nw, 16, L, 'facade');
    g.add(b);
    const r = gableRoof(nw, L, 7, 16, 'roof');
    r.position.set(x, 0, -L / 2);
    g.add(r);
    const gs = new THREE.Shape([new THREE.Vector2(-nw / 2, 0), new THREE.Vector2(nw / 2, 0), new THREE.Vector2(0, 7)]);
    g.add(shapeSlab(gs, 0.6, 'facade', x, 16, 0.2));
  }
  g.add(boxAt(0, 0, 5, 9, 34, 9, 'facade'));
  g.add(cyl(3.8, 3.8, 6, 8, 'facade', 34, 0, 5));
  g.add(cone(4, 22, 8, 'roof', 40, 0, 5));
  return g;
}

/** Gare Lille-Europe : longue halle basse vitrée à toiture galbée. */
export function lilleEurope() {
  const g = G();
  const Lg = 360, W = 46;
  g.add(boxAt(0, 0, 0, W, 9, Lg, 'white'));
  const sh = new THREE.Shape();
  sh.moveTo(-W / 2 - 2, 0); sh.lineTo(W / 2 + 2, 0); sh.quadraticCurveTo(W / 2, 6, 0, 6.5); sh.quadraticCurveTo(-W / 2, 6, -W / 2 - 2, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Lg + 8, bevelEnabled: false, curveSegments: 14 });
  geo.translate(0, 9, -(Lg + 8) / 2);
  g.add(mesh(geo, 'roof', { edgeAngle: 20 }));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 7, Lg * 0.9), palette.glass(1.2));
  glass.position.y = 4.5;
  g.add(glass);
  return g;
}

/** Tour de Lille (« botte de ski ») : fût vertical, pied en équerre, sommet incliné. */
export function tourDeLille() {
  const g = G();
  const prof = new THREE.Shape();
  prof.moveTo(-14, 0); prof.lineTo(34, 0); prof.lineTo(34, 26); prof.lineTo(12, 30); prof.lineTo(12, 112); prof.lineTo(-14, 120); prof.closePath();
  const geo = new THREE.ExtrudeGeometry(prof, { depth: 26, bevelEnabled: false });
  geo.translate(0, 0, -13);
  g.add(mesh(geo, 'facade', { edgeAngle: 20 }));
  const grid = [];
  for (let y = 34; y < 110; y += 4) { const b = new THREE.BoxGeometry(26.4, 0.18, 26.4).toNonIndexed(); b.translate(-1, y, 0); grid.push(b); }
  g.add(mesh(mergeGeometries(grid), 'facade3', { edges: false }));
  return g;
}

/** Tour Lilleurope : tour élancée à face arrondie. */
export function tourLilleurope() {
  const g = G();
  const s = new THREE.Shape();
  s.moveTo(-14, -9); s.lineTo(8, -9); s.absarc(8, 0, 9, -Math.PI / 2, Math.PI / 2, false); s.lineTo(-14, 9); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 108, bevelEnabled: false, curveSegments: 18 });
  geo.rotateX(-Math.PI / 2);
  g.add(mesh(geo, 'facade2', { edgeAngle: 20 }));
  g.add(boxAt(-3, 108, 0, 18, 3, 14, 'facade'));
  return g;
}

/** Euralille : grand centre aux lignes souples (toiture ondulée). */
export function euralille() {
  const g = G();
  const pts = [[-150, -50], [140, -60], [100, 40], [-130, 70]];
  g.add(extrudeXZ(pts, 0, 14, 'facade'));
  const waves = [];
  for (let i = 0; i < 9; i++) {
    const x = -120 + i * 28;
    const geo = new THREE.CylinderGeometry(10, 10, 80, 16, 1, false, 0, Math.PI);
    geo.rotateX(Math.PI / 2);
    geo.rotateZ(Math.PI / 2);
    geo.translate(x, 13, 0);
    geo.scale(1, 0.4, 1);
    waves.push(geo.toNonIndexed());
  }
  g.add(mesh(mergeGeometries(waves), 'roof', { edgeAngle: 30 }));
  return g;
}

/* ================================================================== */
/*  Mobilier urbain et lieux d'arrivée (fictifs)                        */
/* ================================================================== */

export function abribus({ line = '', label = '' } = {}) {
  const g = G();
  g.add(block(-3.5, 2.6, -0.9, 3.5, 2.8, 0.9, 'roof'));
  const back = new THREE.Mesh(new THREE.BoxGeometry(7, 2.5, 0.06), palette.glass(2));
  back.position.set(0, 1.3, -0.85);
  g.add(back);
  for (const x of [-3.3, 3.3]) g.add(block(x - 0.06, 0, -0.9, x + 0.06, 2.6, -0.78, 'dark', { edges: false }));
  const totem = signPanel({ w: 0.9, h: 2.2, key: 'totem-' + line + label, draw: (ctx, W, H) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#12b3e6'; ctx.fillRect(0, 0, W, H * 0.32);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(W * 0.42)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('BUS', W / 2, H * 0.17);
    ctx.fillStyle = '#26313c'; ctx.font = `700 ${Math.round(W * 0.5)}px ${FONT}`;
    ctx.fillText(line, W / 2, H * 0.5);
    ctx.font = `600 ${Math.round(W * 0.16)}px ${FONT}`; ctx.fillStyle = '#5b6876';
    ctx.fillText(label, W / 2, H * 0.72);
  } });
  totem.position.set(4.2, 1.6, 0);
  g.add(totem);
  g.add(block(4.15, 0, -0.05, 4.25, 0.5, 0.05, 'dark', { edges: false }));
  return g;
}

export function poteauDepose() {
  const g = G();
  const p = signPanel({ w: 1.6, h: 1.0, key: 'depose', draw: (ctx, W, H) => {
    ctx.fillStyle = '#12b3e6'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(H * 0.42)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('P', W * 0.2, H * 0.52);
    ctx.font = `600 ${Math.round(H * 0.2)}px ${FONT}`;
    ctx.fillText('Dépose', W * 0.62, H * 0.38);
    ctx.fillText('minute', W * 0.62, H * 0.66);
  } });
  p.position.y = 2.6;
  g.add(p);
  g.add(block(-0.06, 0, -0.06, 0.06, 2.1, 0.06, 'dark', { edges: false }));
  return g;
}

/** Pavillon contemporain fictif (lieu d'arrivée). */
export function pavillon({ w = 40, d = 28, h = 12, name = '' } = {}) {
  const g = G();
  g.add(boxAt(0, 0, 0, w, 0.6, d, 'facade2'));
  g.add(boxAt(0, 0.6, 0, w - 4, h - 1.8, d - 4, 'white'));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 3.6, h - 3, d - 3.6), palette.glass(1.2));
  glass.position.y = (h - 3) / 2 + 0.6;
  g.add(glass);
  g.add(block(-w / 2 - 2, h - 1.2, -d / 2 - 2, w / 2 + 2, h, d / 2 + 2, 'roof'));
  g.add(block(-w / 2 - 2, h - 0.15, -d / 2 - 2, w / 2 + 2, h + 0.05, d / 2 + 2, palette.accent('accent', { glow: 0.3 }), { edges: false }));
  if (name) {
    const s = signPanel({ w: Math.min(w * 0.6, 18), h: 1.4, key: 'pav-' + name, draw: (ctx, W, H) => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0b8fc0'; ctx.font = `600 ${Math.round(H * 0.56)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, W / 2, H / 2);
    } });
    s.position.set(0, h - 0.6, d / 2 + 2.05);
    g.add(s);
  }
  return g;
}

/** Grand lieu d'exposition fictif : volumes en gradins et grande verrière. */
export function espaceHorizon() {
  const g = pavillon({ w: 64, d: 38, h: 14, name: 'Espace Horizon' });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.6, 8, 48), palette.accent('accentSoft', { glow: 0.4 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 16;
  g.add(ring);
  g.add(cyl(8.6, 8.6, 2.4, 40, 'white', 14));
  return g;
}

export const LANDMARKS = {
  beffroiBethune, beffroiArras, hotelDeVilleArras, rangeePignons, placeArras, cathedraleArras,
  beffroiLille, beffroiCCI, operaLille, vieilleBourse, colonneDeesse, saintMaurice, lilleEurope,
  tourDeLille, tourLilleurope, euralille, stadeBollaert, louvreLens, terrils, abribus, poteauDepose,
  pavillon, espaceHorizon,
};
