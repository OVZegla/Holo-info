import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette } from '../core/materials.js';
import { mesh, block } from '../core/build.js';
import { rng } from './city.js';
import { beffroiBethune, beffroiArras, beffroiLille, tourDeLille, stadeBollaert } from './landmarks.js';

/*
 * Carte régionale schématique (réseau FICTIF : il ne reproduit pas le tracé réel).
 * Unités : 1 = 100 m. Nord vers -z. Positions approximatives des villes.
 * Pour ajouter une gare d'arrêt, compléter STATIONS ci-dessous (nom exact
 * utilisé dans data/scenarios.js). Un arrêt inconnu est placé automatiquement
 * entre ses voisins.
 */
const LON0 = 2.85, LAT0 = 50.47;
const P = (lon, lat) => [(lon - LON0) * 710, -(lat - LAT0) * 1112];

export const STATIONS = {
  'Béthune': P(2.640, 50.521),
  'Lens': P(2.829, 50.428),
  'Arras': P(2.781, 50.287),
  'Lille-Flandres': P(3.070, 50.637),
  'Lille': P(3.070, 50.637),
  'La Bassée': P(2.808, 50.535),
  'Don-Sainghin': P(2.896, 50.560),
  'Nœux-les-Mines': P(2.665, 50.481),
  'Mazingarbe': P(2.715, 50.471),
  'Douai': P(3.080, 50.371),
  'Hazebrouck': P(2.539, 50.723),
  'Armentières': P(2.880, 50.688),
  'Hénin-Beaumont': P(2.951, 50.421),
  'Saint-Pol-sur-Ternoise': P(2.335, 50.381),
};

const MAJOR = ['Béthune', 'Lens', 'Arras', 'Lille'];
const CONTEXT_LINES = [
  ['Béthune', 'Nœux-les-Mines', 'Mazingarbe', 'Lens', 'Hénin-Beaumont', 'Douai'],
  ['Béthune', 'La Bassée', 'Don-Sainghin', 'Lille'],
  ['Lens', 'Arras', 'Douai'],
  ['Lille', 'Douai'],
  ['Lille', 'Armentières', 'Hazebrouck', 'Béthune'],
  ['Béthune', 'Saint-Pol-sur-Ternoise'],
];

const v = (p, y = 0) => new THREE.Vector3(p[0], y, p[1]);

function smoothLine(names, y = 0.35) {
  const pts = names.map((n) => v(STATIONS[n] || [0, 0], y));
  if (pts.length < 2) return pts;
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  return c.getPoints(pts.length * 24);
}

function lineGeo(points, w, y) {
  const geos = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const len = a.distanceTo(b);
    if (len < 1e-3) continue;
    const g = new THREE.BoxGeometry(len + w * 0.6, 0.12, w);
    g.rotateY(-Math.atan2(b.z - a.z, b.x - a.x));
    g.translate((a.x + b.x) / 2, y, (a.z + b.z) / 2);
    geos.push(g);
  }
  return mergeGeometries(geos);
}

export function buildRegion() {
  const g = new THREE.Group();
  g.name = 'region';
  const rand = rng(99);
  const labels = [];

  // plateau
  const W = 520, D = 600, cx = -30, cz = -40;
  const shape = new THREE.Shape();
  const r = 26;
  const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
  shape.moveTo(x0 + r, -z0); shape.lineTo(x1 - r, -z0); shape.quadraticCurveTo(x1, -z0, x1, -z0 - r);
  shape.lineTo(x1, -z1 + r); shape.quadraticCurveTo(x1, -z1, x1 - r, -z1); shape.lineTo(x0 + r, -z1);
  shape.quadraticCurveTo(x0, -z1, x0, -z1 + r); shape.lineTo(x0, -z0 - r); shape.quadraticCurveTo(x0, -z0, x0 + r, -z0);
  const plateGeo = new THREE.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: true, bevelSize: 1.2, bevelThickness: 1.2, bevelSegments: 3 });
  plateGeo.rotateX(-Math.PI / 2);
  plateGeo.translate(0, -7.2, 0);
  const plate = new THREE.Mesh(plateGeo, palette.get('ground'));
  plate.receiveShadow = true; plate.castShadow = true;
  g.add(plate);

  // cours d'eau stylisés (Deûle, Scarpe, Lys)
  const rivers = [
    [P(2.56, 50.70), P(2.75, 50.64), P(2.90, 50.60), P(3.03, 50.64), P(3.10, 50.70)],
    [P(2.62, 50.30), P(2.78, 50.29), P(2.92, 50.33), P(3.07, 50.37), P(3.18, 50.38)],
    [P(2.84, 50.40), P(2.90, 50.47), P(2.95, 50.55), P(3.02, 50.62)],
  ];
  for (const rv of rivers) {
    const c = new THREE.CatmullRomCurve3(rv.map((p) => v(p, 0.06)));
    g.add(new THREE.Mesh(lineGeo(c.getPoints(60), 1.6, 0.06), palette.get('water')));
  }

  // grandes zones urbaines (taches claires) + petits volumes
  const blockGeos = [];
  for (const name of Object.keys(STATIONS)) {
    const [x, z] = STATIONS[name];
    const major = MAJOR.includes(name) || name === 'Lille-Flandres';
    if (name === 'Lille-Flandres') continue;
    const rad = name === 'Lille' ? 34 : major ? 18 : 8;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(rad, 40).rotateX(-Math.PI / 2), palette.get('socle'));
    disc.position.set(x, 0.05, z);
    disc.receiveShadow = true;
    g.add(disc);
    const n = name === 'Lille' ? 140 : major ? 55 : 14;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * rad * 0.85;
      const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
      const h = (name === 'Lille' ? 1.2 : 0.7) + rand() * (name === 'Lille' ? 2.6 : 1.2) * (1 - d / rad);
      const s = 1.2 + rand() * 2.2;
      const geo = new THREE.BoxGeometry(s, h, s * (0.6 + rand() * 0.8));
      geo.rotateY(rand() * Math.PI);
      geo.translate(bx, h / 2 + 0.05, bz);
      blockGeos.push(geo);
    }
    labels.push({ name, at: [x, z], major });
  }
  g.add(mesh(mergeGeometries(blockGeos), 'facade', { edgeAngle: 40, edgeOpacity: 0.5 }));

  // monuments miniatures (échelle exagérée pour la lisibilité)
  const mini = (fn, at, s, dx = 0, dz = 0) => { const o = fn(); o.scale.setScalar(s); o.position.set(at[0] + dx, 0.05, at[1] + dz); g.add(o); return o; };
  mini(beffroiBethune, STATIONS['Béthune'], 0.14, 4, -6);
  mini(beffroiArras, STATIONS['Arras'], 0.11, -6, -4);
  mini(beffroiLille, STATIONS['Lille'], 0.09, 8, 14);
  mini(tourDeLille, STATIONS['Lille'], 0.07, -12, -8);
  mini(stadeBollaert, STATIONS['Lens'], 0.05, -10, -6);
  // terrils jumeaux de Loos-en-Gohelle
  const ter = P(2.79, 50.457);
  for (const [dx, dz, rr, h] of [[-3, 0, 6.5, 8], [5, 1.5, 7, 8.6]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(rr, h, 10), palette.get('socle', { flat: true }));
    m.position.set(ter[0] + dx, h / 2, ter[1] + dz);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  labels.push({ name: 'Terrils de Loos-en-Gohelle', at: [ter[0], ter[1] - 2], minor: true, h: 10 });

  // réseau de contexte (gris)
  const ctxGeos = [];
  for (const line of CONTEXT_LINES) ctxGeos.push(lineGeo(smoothLine(line, 0.25), 1.5, 0.25));
  const net = new THREE.Mesh(mergeGeometries(ctxGeos), palette.get('detail'));
  net.receiveShadow = true;
  g.add(net);

  return { group: g, labels };
}

/**
 * Itinéraire du train sur la carte : liste de points + indices des gares.
 */
export function trainPath(stops) {
  const known = stops.map((s) => STATIONS[s] || null);
  // arrêts inconnus : interpolés entre voisins connus
  for (let i = 0; i < known.length; i++) {
    if (known[i]) continue;
    let a = i - 1; while (a >= 0 && !known[a]) a--;
    let b = i + 1; while (b < known.length && !known[b]) b++;
    const A = known[a] || [0, 0], B = known[b] || A;
    const f = (i - a) / (b - a);
    known[i] = [A[0] + (B[0] - A[0]) * f + 6, A[1] + (B[1] - A[1]) * f];
  }
  const ctrl = known.map((p) => v(p, 0.5));
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal', 0.5);
  const N = 60 * (ctrl.length - 1);
  const pts = curve.getSpacedPoints(N);
  // indices des points les plus proches des gares
  const stopIdx = ctrl.map((c) => {
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = p.distanceToSquared(c); if (d < bd) { bd = d; best = i; } });
    return best;
  });
  return { pts, stopIdx, positions: known };
}

export function routeLineMesh(pts) {
  const m = new THREE.Mesh(lineGeo(pts, 3.2, 0.5), new THREE.MeshBasicMaterial({ color: '#12b3e6', transparent: true, opacity: 0.95 }));
  m.material.userData.owned = true;
  return m;
}

export { block };
