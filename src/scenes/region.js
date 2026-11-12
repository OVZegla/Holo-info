import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette } from '../core/materials.js';
import { mesh, block } from '../core/build.js';
import { rng } from './city.js';
import { getOsm } from './osm.js';
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

  // villes : vrai bâti OSM en miniature pour les 4 gares, petits bourgs pour les autres
  const blockGeos = [], roadGeos = [];
  const OSM_ID = { 'Béthune': 'bethune', 'Lens': 'lens', 'Arras': 'arras', 'Lille': 'lille' };
  for (const name of Object.keys(STATIONS)) {
    const [x, z] = STATIONS[name];
    const major = MAJOR.includes(name);
    if (name === 'Lille-Flandres' || name === 'Lille Flandres') continue;
    const osm = OSM_ID[name] && getOsm(OSM_ID[name]);
    if (osm) miniCity(osm, blockGeos, roadGeos);
    // pas de bourg sur une grande ville (gares « Lille Porte de Douai », « Lille CHR »…)
    else if (!MAJOR.some((m) => Math.hypot(STATIONS[m][0] - x, STATIONS[m][1] - z) < 26)) smallTown(x, z, rand, blockGeos, roadGeos);
    else continue;
    labels.push({ name, at: [x, z], major });
  }
  g.add(mesh(mergeGeometries(blockGeos), 'facade', { edgeAngle: 40, edgeOpacity: 0.35 }));
  if (roadGeos.length) {
    const roads = new THREE.Mesh(mergeGeometries(roadGeos), palette.get('road'));
    roads.receiveShadow = true;
    g.add(roads);
  }

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
 * Ville en miniature (1 unité = 100 m) à partir des emprises OSM :
 * bâtiments extrudés (hauteur ×2,5 pour la lisibilité) et grands axes.
 */
function miniCity(osm, blockGeos, roadGeos) {
  const { lat, lon } = osm.station;
  const [sx, sz] = P(lon, lat);
  const kx = 710 / (111320 * Math.cos((lat * Math.PI) / 180)), kz = 1112 / 110540;
  const toMap = ([E, N]) => [sx + E * kx, sz - N * kz];
  const area = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); };
  for (const b of osm.buildings) {
    if (b.p.length < 4 || area(b.p) < 140) continue; // trop petit à cette échelle
    const pts = b.p.map(toMap);
    const h = Math.max(0.12, ((b.h || 9) / 100) * 2.5);
    try {
      const shape = new THREE.Shape(pts.map(([px, pz]) => new THREE.Vector2(px, -pz)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0.05, 0);
      blockGeos.push(geo);
    } catch { /* polygone dégénéré */ }
  }
  const W = { trunk: 0.22, primary: 0.2, secondary: 0.16, tertiary: 0.12 };
  for (const r of osm.roads) {
    const w = W[r.k];
    if (!w) continue;
    const pts = r.p.map(toMap);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1e-3) continue;
      const gg = new THREE.BoxGeometry(len + w, 0.02, w);
      gg.rotateY(-Math.atan2(bz - az, bx - ax));
      gg.translate((ax + bx) / 2, 0.06, (az + bz) / 2);
      roadGeos.push(gg);
    }
  }
}

/** Petit bourg : maisons alignées le long d'une rue et d'une transversale. */
function smallTown(x, z, rand, blockGeos, roadGeos) {
  const a = rand() * Math.PI;
  const u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]];
  for (const [dir, L] of [[u, 9], [v, 5]]) {
    const gg = new THREE.BoxGeometry(L * 2, 0.02, 0.16);
    gg.rotateY(-Math.atan2(dir[1], dir[0]));
    gg.translate(x, 0.06, z);
    roadGeos.push(gg);
    for (let d = -L + 0.8; d < L - 0.5; d += 1.1 + rand() * 0.5) {
      for (const side of [-1, 1]) {
        if (rand() < 0.2) continue;
        const n = dir === u ? v : u;
        const bx = x + dir[0] * d + n[0] * side * 0.6, bz = z + dir[1] * d + n[1] * side * 0.6;
        const w = 0.5 + rand() * 0.4, dd = 0.5 + rand() * 0.3, h = 0.25 + rand() * 0.25;
        const geo = new THREE.BoxGeometry(w, h, dd);
        geo.rotateY(-Math.atan2(dir[1], dir[0]));
        geo.translate(bx, h / 2 + 0.05, bz);
        blockGeos.push(geo.toNonIndexed()); // même format que les bâtiments extrudés (fusion)
      }
    }
  }
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
