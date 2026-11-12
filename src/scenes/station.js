import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette } from '../core/materials.js';
import { block, slab, rectsMinus, stairs, signHanging, signOnPosts, signPanel, mesh, FONT, roundRect, tree } from '../core/build.js';
import { makeTrain } from './vehicles.js';

/*
 * Gare traversante paramétrique (Béthune, Lens, Arras).
 * Repère local : x le long des voies, +z vers la ville (parvis), y vers le haut.
 *
 *   z  20 ┌──────────── façade (côté ville) ────────────┐
 *         │                 HALL                         │
 *   z   4 └──────────────────────────────────────────────┘
 *   z  -4   Quai 1  (latéral, de plain-pied avec le hall)
 *   z  -6.25  voie 1
 *   z -10.75  voie 2
 *   z -13 … -22  Quai central 2 | 3
 *   z -24.25  voie 3
 *
 *   Passage souterrain : x ∈ [18, 22], sol à y = -4, de z = 9.5 à z = -20.
 *   Escaliers : hall (x 11.5→18, z 6.5…9.5), quai central (x 11.5→18, z -19…-16).
 *   Ascenseurs : hall (x 22…25, z 5.5…8.5), quai central (x 22…25, z -19…-16).
 */

export const L = {
  hall: { x0: -30, x1: 30, z0: 4, z1: 20, h: 8.5 },
  q1: [-4, 4],
  t1: [-8.5, -4],
  t2: [-13, -8.5],
  island: [-22, -13],
  t3: [-26.5, -22],
  site: { x0: -90, x1: 90, z0: -42, z1: 20 },
  under: { x0: 18, x1: 22, z0: -20, z1: 9.5, y: -4 },
  stairsHall: { x0: 11.5, x1: 18, z0: 6.5, z1: 9.5 },
  stairsIsland: { x0: 11.5, x1: 18, z0: -19, z1: -16 },
  liftHall: { x0: 22, x1: 25, z0: 5.5, z1: 8.5 },
  liftIsland: { x0: 22, x1: 25, z0: -19, z1: -16 },
  platformX: [-78, 78],
  trackY: -0.9,
  base: -5,
};

const trackCenter = { 1: (L.t1[0] + L.t1[1]) / 2, 2: (L.t2[0] + L.t2[1]) / 2, 3: (L.t3[0] + L.t3[1]) / 2 };
/** Bord de quai où l'on attend le train de chaque voie. */
const boardZ = { 1: L.q1[0] + 0.7, 2: L.island[1] - 0.7, 3: L.island[0] + 0.7 };

const R = (o) => [o.x0, o.z0, o.x1, o.z1];

/* ------------------------------------------------------------------ */

export function buildThroughStation({ name, facade, sideDecor, trainOn = null, trainCar = 2, trainHeadX = 48, departures = null, kiosk = false, arrivalMode = false, accentTrain = true, extent = 300 }) {
  const g = new THREE.Group();
  g.name = 'station-' + name;
  const occ = []; // groupes effaçables
  const P = L.platformX;

  /* ---- socle percé ---- */
  const site = [L.site.x0, L.site.z0, L.site.x1, L.site.z1];
  const tracks = [L.t1, L.t2, L.t3].map(([a, b]) => [P[0] - 40, a, P[1] + 40, b]);
  const tracksInSite = tracks.map(([, a, , b]) => [L.site.x0, a, L.site.x1, b]);
  const shafts = [R(L.under), R(L.stairsHall), R(L.stairsIsland), R(L.liftHall), R(L.liftIsland)];
  // couche haute (quais, hall)  y ∈ [-0.9, 0]
  g.add(slab(site, [...tracksInSite, ...shafts], L.trackY, 0, 'platform', { edgeAngle: 20 }));
  // couche intermédiaire y ∈ [-4, -0.9]
  g.add(slab(site, shafts, L.under.y, L.trackY, 'socle', { edgeAngle: 20 }));
  // fond y ∈ [-5, -4]
  g.add(block(site[0], L.base, site[1], site[2], L.under.y, site[3], 'socleSide', { edgeAngle: 20 }));
  // voies prolongées hors du site (jusqu'au bord de la maquette)
  for (const [, z0, , z1] of tracks) {
    for (const [a, b] of [[-extent, L.site.x0], [L.site.x1, extent]]) g.add(block(a, L.base, z0, b, L.trackY, z1, 'socle', { edges: false }));
  }

  /* ---- sol du passage souterrain et vitrages au-dessus ---- */
  const U = L.under;
  g.add(block(U.x0, U.y - 0.02, U.z0, U.x1, U.y + 0.02, U.z1, 'floor', { edges: false }));
  // tablier : découpe selon les bandes voies / quais
  const zCuts = [U.z0, L.t3[0], L.t3[1], L.t2[0], L.t2[1], L.t1[0], L.t1[1], U.z1].sort((a, b) => a - b);
  const deck = [];
  for (let i = 0; i < zCuts.length - 1; i++) {
    const z0 = zCuts[i], z1 = zCuts[i + 1];
    if (z1 - z0 < 0.01) continue;
    const zc = (z0 + z1) / 2;
    const inTrack = [L.t1, L.t2, L.t3].some(([t0, t1]) => zc > t0 && zc < t1);
    const yTop = inTrack ? L.trackY : 0;
    for (const [a, b, c, d] of rectsMinus([U.x0, z0, U.x1, z1], [R(L.liftHall), R(L.liftIsland)])) {
      const geo = new THREE.BoxGeometry(c - a, 0.1, d - b);
      geo.translate((a + c) / 2, yTop - 0.05, (b + d) / 2);
      deck.push(geo);
    }
  }
  const deckMesh = new THREE.Mesh(mergeGeometries(deck), palette.glass(1.1));
  deckMesh.renderOrder = 2;
  g.add(deckMesh);
  // bande lumineuse au plafond du passage (repère visuel)
  g.add(block(U.x0 + 1.6, -1.25, U.z0 + 0.5, U.x1 - 1.6, -1.18, U.z1 - 0.5, palette.accent('accentSoft', { glow: 0.5, opacity: 0.5 }), { edges: false, cast: false }));

  /* ---- escaliers ---- */
  const sh = L.stairsHall, si = L.stairsIsland;
  g.add(stairs({ axis: 'x', a: sh.x0, b: sh.x1, ya: 0, yb: U.y, c: (sh.z0 + sh.z1) / 2, w: sh.z1 - sh.z0, steps: 16 }));
  g.add(stairs({ axis: 'x', a: si.x0, b: si.x1, ya: 0, yb: U.y, c: (si.z0 + si.z1) / 2, w: si.z1 - si.z0, steps: 16 }));
  // garde-corps vitrés autour des trémies
  for (const s of [sh, si]) {
    for (const z of [s.z0, s.z1]) {
      const gr = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0, 1.05, 0.05), palette.glass(1.4));
      gr.position.set((s.x0 + s.x1) / 2, 0.52, z);
      g.add(gr);
      g.add(block(s.x0, 1.02, z - 0.04, s.x1, 1.08, z + 0.04, 'detail', { edges: false, cast: false }));
    }
  }

  /* ---- ascenseurs (gaines vitrées + cabines) ---- */
  const lifts = [];
  for (const lf of [L.liftHall, L.liftIsland]) {
    const cx = (lf.x0 + lf.x1) / 2, cz = (lf.z0 + lf.z1) / 2;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(lf.x1 - lf.x0, 7.6, lf.z1 - lf.z0), palette.glass(1.3));
    shaft.position.set(cx, U.y + 3.8, cz);
    g.add(shaft);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(shaft.geometry), palette.line('dark', 0.8));
    frame.position.copy(shaft.position);
    g.add(frame);
    g.add(block(lf.x0 - 0.1, U.y + 7.6, lf.z0 - 0.1, lf.x1 + 0.1, U.y + 7.9, lf.z1 + 0.1, 'facade', { cast: true }));
    const cabin = new THREE.Group();
    const cab = block(-1.25, 0.02, -1.25, 1.25, 2.4, 1.25, palette.glass(2.4, 'accentSoft'), { edges: false });
    cabin.add(cab);
    cabin.add(block(-1.3, 0, -1.3, 1.3, 0.12, 1.3, 'facade2', { edges: false }));
    cabin.add(block(-1.3, 2.4, -1.3, 1.3, 2.52, 1.3, 'facade2', { edges: false }));
    cabin.position.set(cx, 0, cz);
    g.add(cabin);
    lifts.push({ cabin, x: cx, z: cz, rect: lf });
  }

  /* ---- voies : ballast, traverses, rails ---- */
  const sleeperGeos = [], railGeos = [];
  for (const k of [1, 2, 3]) {
    const zc = trackCenter[k];
    const x0 = -extent, x1 = extent;
    for (let x = x0; x < x1; x += 1.4) {
      const sg = new THREE.BoxGeometry(0.3, 0.14, 2.5);
      sg.translate(x, L.trackY + 0.07, zc);
      sleeperGeos.push(sg);
    }
    for (const dz of [-0.75, 0.75]) {
      const rg = new THREE.BoxGeometry(x1 - x0, 0.16, 0.1);
      rg.translate((x0 + x1) / 2, L.trackY + 0.2, zc + dz);
      railGeos.push(rg);
    }
  }
  const sleepers = new THREE.Mesh(mergeGeometries(sleeperGeos), palette.get('sleeper'));
  sleepers.receiveShadow = true;
  g.add(sleepers);
  const rails = new THREE.Mesh(mergeGeometries(railGeos), palette.get('rail', { roughness: 0.5 }));
  rails.receiveShadow = true;
  g.add(rails);
  // caténaires légères
  const catGeos = [];
  for (let x = P[0]; x <= P[1]; x += 26) {
    const pg = new THREE.BoxGeometry(0.22, 7.2, 0.22);
    pg.translate(x, L.trackY + 3.6, L.t3[0] - 1.4);
    catGeos.push(pg);
  }
  g.add(mesh(mergeGeometries(catGeos), 'detail', { edges: false }));

  /* ---- bordures de quai (bande blanche) ---- */
  const edgeGeos = [];
  for (const z of [L.q1[0] + 0.45, L.island[1] - 0.45, L.island[0] + 0.45]) {
    for (const [a, b] of [[P[0], U.x0 - 0.3], [U.x1 + 0.3, P[1]]]) {
      const eg = new THREE.BoxGeometry(b - a, 0.02, 0.25);
      eg.translate((a + b) / 2, 0.012, z);
      edgeGeos.push(eg);
    }
  }
  g.add(new THREE.Mesh(mergeGeometries(edgeGeos), palette.get('white')));
  // délimitation de la longueur de quai (quai = zone plus claire)
  for (const [z0, z1] of [L.q1, L.island]) {
    g.add(block(P[0], -0.005, z0, P[0] + 0.15, 0.03, z1, 'detail', { edges: false }));
    g.add(block(P[1] - 0.15, -0.005, z0, P[1], 0.03, z1, 'detail', { edges: false }));
  }

  /* ---- abris de quai (effaçables) ---- */
  const canopies = new THREE.Group();
  for (const [z0, z1, xs] of [[L.island[0] + 2, L.island[1] - 2, [[-60, 8], [27, 62]]], [L.q1[0] + 1.6, L.q1[1] - 0.2, [[-70, -32], [32, 70]]]]) {
    for (const [a, b] of xs) {
      canopies.add(block(a, 4.2, z0, b, 4.45, z1, 'roof', { edgeAngle: 20 }));
      for (let x = a + 2; x <= b - 1; x += 9) canopies.add(block(x - 0.12, 0, (z0 + z1) / 2 - 0.12, x + 0.12, 4.2, (z0 + z1) / 2 + 0.12, 'detail', { edges: false }));
    }
  }
  g.add(canopies);
  occ.push(canopies);

  /* ---- hall ---- */
  const H = L.hall;
  const hall = new THREE.Group();
  hall.name = 'hall';
  // sol du hall (plus clair)
  const hallFloor = rectsMinus([H.x0, H.z0, H.x1, H.z1], [R(L.stairsHall), R(L.liftHall), [U.x0, H.z0, U.x1, U.z1]]);
  for (const [a, b, c, d] of hallFloor) g.add(block(a, -0.02, b, c, 0.03, d, 'floor', { edges: false, cast: false }));
  // murs latéraux et arrière (le mur avant est fourni par la façade)
  const wallH = H.h, wt = 0.5;
  const back = new THREE.Group();
  // mur arrière avec grandes baies vers le quai 1
  const backOpenings = [[-26, -6], [-4, 4], [6, 10], [26, 30]];
  let xPrev = H.x0;
  for (const [a, b] of backOpenings) {
    if (a > xPrev) back.add(block(xPrev, 0, H.z0, a, wallH, H.z0 + wt, 'facade'));
    back.add(block(a, 3.2, H.z0, b, wallH, H.z0 + wt, 'facade'));
    back.add(new THREE.Mesh(new THREE.BoxGeometry(b - a, 3.2, 0.06), palette.glass(1)).translateX((a + b) / 2).translateY(1.6).translateZ(H.z0 + wt / 2));
    xPrev = b;
  }
  if (xPrev < H.x1) back.add(block(xPrev, 0, H.z0, H.x1, wallH, H.z0 + wt, 'facade'));
  hall.add(back);
  const sides = new THREE.Group();
  sides.add(block(H.x0 - wt, 0, H.z0, H.x0, wallH, H.z1, 'facade'));
  sides.add(block(H.x1, 0, H.z0, H.x1 + wt, wallH, H.z1, 'facade'));
  hall.add(sides);
  // charpente légère (toiture ouverte : seule la trame reste)
  const roof = new THREE.Group();
  for (let x = H.x0 + 5; x < H.x1; x += 5) roof.add(block(x - 0.12, wallH - 0.5, H.z0, x + 0.12, wallH, H.z1, 'facade2', { edges: false }));
  roof.add(block(H.x0, wallH - 0.4, (H.z0 + H.z1) / 2 - 0.15, H.x1, wallH, (H.z0 + H.z1) / 2 + 0.15, 'facade2', { edges: false }));
  const skylight = new THREE.Mesh(new THREE.BoxGeometry(H.x1 - H.x0, 0.05, H.z1 - H.z0), palette.glass(0.45));
  skylight.position.set((H.x0 + H.x1) / 2, wallH, (H.z0 + H.z1) / 2);
  roof.add(skylight);
  hall.add(roof);
  g.add(hall);
  occ.push(back, sides, roof);

  // façade spécifique (élément reconnaissable)
  const fac = facade();
  g.add(fac);
  occ.push(fac);

  /* ---- mobilier & repères du hall ---- */
  const props = new THREE.Group();
  // accueil
  props.add(block(-23, 0, 9.5, -15, 1.1, 11.2, 'white'));
  props.add(block(-23, 1.1, 9.5, -15, 1.18, 11.2, palette.accent('accent', { glow: 0.2 }), { edges: false }));
  const acc = signHanging({ w: 4.2, h: 0.9, lines: [{ text: 'Accueil', size: 0.7 }], key: 'sg-accueil' }, 4.2, wallH - 0.3);
  acc.position.set(-19, 0, 10.4);
  props.add(acc);
  // billetterie : guichets le long du mur ouest + automates
  props.add(block(-29.5, 0, 8, -27.5, 1.2, 17, 'white'));
  for (let z = 9; z < 17; z += 2.6) props.add(block(-29.6, 1.2, z, -27.4, 2.6, z + 0.12, palette.glass(1.5), { edges: false }));
  const bil = signHanging({ w: 4.6, h: 0.9, lines: [{ text: 'Billetterie', size: 0.7 }], key: 'sg-billetterie' }, 4.2, wallH - 0.3);
  bil.position.set(-26.5, 0, 12.5);
  bil.rotation.y = Math.PI / 2;
  props.add(bil);
  for (let i = 0; i < 4; i++) {
    const x = -12 + i * 1.6;
    props.add(block(x - 0.5, 0, 4.6, x + 0.5, 1.9, 5.4, 'facade2'));
    props.add(block(x - 0.35, 1.0, 5.41, x + 0.35, 1.65, 5.44, palette.accent('accentSoft', { glow: 0.4 }), { edges: false }));
  }
  // commerce
  props.add(block(24, 0, 13, 29.5, 3.2, 19.3, 'facade2'));
  const shop = signPanel({ w: 3.6, h: 0.6, lines: [{ text: 'Café · Presse', size: 0.7 }], key: 'sg-cafe' });
  shop.position.set(26.75, 3.6, 13);
  props.add(shop);
  // bancs
  for (const [x, z] of [[-8, 8], [-2, 8], [6, 15.5], [12, 15.5]]) props.add(block(x - 1.6, 0, z - 0.3, x + 1.6, 0.45, z + 0.3, 'facade3'));
  // tableau des départs
  if (departures) {
    const board = departureBoard(departures);
    board.position.set(2, 0, 9.2);
    props.add(board);
  }
  // signalétique vers les quais
  const toQ = signHanging({ w: 5.2, h: 1.1, key: 'sg-quais23-' + name, lines: [{ text: 'Quais 2 – 3', size: 0.6 }, { text: 'Passage souterrain', size: 0.4, weight: 500, color: '#5b6876' }] }, 4.4, wallH - 0.3);
  toQ.position.set(14.8, 0, 10.6);
  props.add(toQ);
  const toQ1 = signHanging({ w: 3.2, h: 0.9, key: 'sg-quai1', lines: [{ text: 'Quai 1', size: 0.7 }] }, 4.2, wallH - 0.3);
  toQ1.position.set(0, 0, 5.2);
  props.add(toQ1);
  const lift = signHanging({ w: 3.4, h: 0.9, key: 'sg-asc', lines: [{ text: 'Ascenseur', size: 0.62 }] }, 4.2, wallH - 0.3);
  lift.position.set(23.5, 0, 9.6);
  props.add(lift);
  if (arrivalMode) {
    const out = signHanging({ w: 4.6, h: 0.9, key: 'sg-sortie', style: 'accent', lines: [{ text: 'Sortie · Ville', size: 0.62 }] }, 4.2, wallH - 0.3);
    out.position.set(4, 0, 18.4);
    props.add(out);
  }
  g.add(props);

  // totems de numéros de quai
  for (const [x, z, txt] of [[-30, L.q1[0] + 2.2, '1'], [30, L.q1[0] + 2.2, '1'], [-40, (L.island[0] + L.island[1]) / 2, '2 | 3'], [2, (L.island[0] + L.island[1]) / 2, '2 | 3'], [40, (L.island[0] + L.island[1]) / 2, '2 | 3']]) {
    const t = signOnPosts({ w: txt.length > 1 ? 2.2 : 1.2, h: 1.0, key: 'q-' + txt, style: 'light', lines: [{ text: (txt.length > 1 ? 'Quais ' : 'Quai ') + txt, size: 0.6 }] }, 2.9);
    t.position.set(x, 0, z);
    g.add(t);
  }
  // escaliers / ascenseur du quai central : panneau
  const islandSign = signHanging({ w: 4, h: 0.8, key: 'sg-sortie-q', lines: [{ text: 'Sortie · Hall', size: 0.6 }] }, 3.4, 4.2);
  islandSign.position.set(14.5, 0, -14.4);
  g.add(islandSign);

  /* ---- borne « Vous êtes ici » ---- */
  let kioskObj = null;
  if (kiosk) {
    kioskObj = new THREE.Group();
    kioskObj.add(block(-0.45, 0, -0.2, 0.45, 2.1, 0.2, 'white'));
    kioskObj.add(block(-0.36, 0.7, 0.2, 0.36, 1.95, 0.24, palette.accent('accentSoft', { glow: 0.7 }), { edges: false }));
    kioskObj.add(block(-0.6, 0, -0.35, 0.6, 0.06, 0.35, 'facade3', { edges: false }));
    kioskObj.position.set(-6, 0, 15.4);
    g.add(kioskObj);
  }

  /* ---- train ---- */
  let train = null;
  if (trainOn) {
    const tr = makeTrain({ cars: 3, accent: accentTrain });
    tr.object.position.set(trainHeadX, L.trackY + 0.25, trackCenter[trainOn]);
    g.add(tr.object);
    const doorsW = tr.doors.map((d) => ({ ...d, x: d.x + trainHeadX }));
    const side = trainOn === 3 ? -1 : 1; // côté du quai
    train = { ...tr, track: trainOn, doorsW, side, carDoor: doorsW.filter((d) => d.car === trainCar) };
  }

  /* ---- décor latéral optionnel ---- */
  if (sideDecor) g.add(sideDecor());

  return { group: g, occluders: occ, lifts, train, kiosk: kioskObj };
}

/* ------------------------------------------------------------------ */
/*  Tableau des départs (canvas)                                        */
/* ------------------------------------------------------------------ */

function departureBoard(rows) {
  const grp = new THREE.Group();
  const w = 6.4, h = 2.6;
  const panel = signPanel({ w, h, px: 200, key: 'board-' + rows.map((r) => r.heure + r.destination + r.quai).join('|'), draw: (ctx, W, H) => {
    ctx.fillStyle = '#26313c';
    roundRect(ctx, 0, 0, W, H, 18); ctx.fill();
    ctx.fillStyle = '#9fb0bf';
    ctx.font = `600 ${Math.round(H * 0.075)}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('Départs', W * 0.04, H * 0.1);
    ctx.textAlign = 'right';
    ctx.fillText('Quai', W * 0.96, H * 0.1);
    ctx.textAlign = 'left';
    const rh = H * 0.19;
    rows.slice(0, 4).forEach((r, i) => {
      const y = H * 0.22 + i * rh;
      if (r.highlight) { ctx.fillStyle = '#12b3e6'; roundRect(ctx, W * 0.02, y, W * 0.96, rh * 0.9, 10); ctx.fill(); }
      ctx.fillStyle = r.highlight ? '#ffffff' : '#e8eef3';
      ctx.font = `700 ${Math.round(rh * 0.42)}px ${FONT}`;
      ctx.fillText(r.heure, W * 0.04, y + rh * 0.45);
      ctx.font = `600 ${Math.round(rh * 0.42)}px ${FONT}`;
      ctx.fillText(r.destination, W * 0.2, y + rh * 0.45);
      ctx.font = `500 ${Math.round(rh * 0.28)}px ${FONT}`;
      ctx.fillStyle = r.highlight ? '#e3f7fd' : '#9fb0bf';
      ctx.fillText(r.train, W * 0.62, y + rh * 0.47);
      ctx.textAlign = 'right';
      ctx.font = `700 ${Math.round(rh * 0.48)}px ${FONT}`;
      ctx.fillStyle = r.highlight ? '#ffffff' : '#e8eef3';
      ctx.fillText(String(r.quai), W * 0.95, y + rh * 0.45);
      ctx.textAlign = 'left';
    });
  } });
  panel.position.y = 4.6;
  grp.add(panel);
  grp.add(block(-0.08, 0, -0.08, 0.08, 3.3, 0.08, 'detail', { edges: false }));
  grp.add(block(-w / 2, 3.25, -0.12, w / 2, 5.95, -0.03, 'dark', { edges: false }));
  return grp;
}

/* ------------------------------------------------------------------ */
/*  Itinéraires dans la gare traversante                               */
/* ------------------------------------------------------------------ */

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Hall → quai (départ). Retourne la liste de points pour Route.
 * quai : 1 | 2 | 3 ; boardX : abscisse de la porte ; stepFree : sans escalier.
 */
export function departureRoute({ quai, boardX, stepFree, start = V(-6, 0, 16.6) }) {
  const bz = boardZ[quai];
  if (quai === 1) {
    return [
      { p: start, cue: { text: 'Traversez le hall', sub: 'Direction : quai 1, de plain-pied' } },
      { p: V(-1.5, 0, 9.5) },
      { p: V(0, 0, 5.6), cue: { text: 'Passez les portes vers le quai 1', sub: 'Accès direct, sans marche' } },
      { p: V(0, 0, 1.6) },
      { p: V(boardX + Math.sign(0 - boardX) * 2, 0, bz + 0.6), cue: { text: 'Longez le quai 1', sub: 'Jusqu’au repère de votre voiture' } },
      { p: V(boardX, 0, bz), cue: { text: 'Votre train se trouve ici', sub: 'Montez à bord' }, final: true },
    ];
  }
  const islandEdge = quai === 2 ? L.island[1] - 1.6 : L.island[0] + 1.6;
  if (!stepFree) {
    return [
      { p: start, cue: { text: 'Traversez le hall', sub: 'Direction : accès aux quais, à droite' } },
      { p: V(3, 0, 11.6), cue: { text: `Rejoignez l’accès aux quais 2 – 3`, sub: 'Suivez le panneau « Passage souterrain »' } },
      { p: V(10.6, 0, 8) , cue: { text: 'Descendez l’escalier', sub: 'Vers le passage souterrain' } },
      { p: V(18, L.under.y, 8), kind: 'stairs' },
      { p: V(20, L.under.y, 7.4), cue: { text: 'Empruntez le passage souterrain', sub: 'Il passe sous les voies 1 et 2' } },
      { p: V(20, L.under.y, -17.5) },
      { p: V(18, L.under.y, -17.5), cue: { text: `Montez vers le quai ${quai}`, sub: 'Escalier de droite' } },
      { p: V(11.2, 0, -17.5), kind: 'stairs', cue: { text: `Continuez jusqu’au quai ${quai}`, sub: 'Avancez jusqu’au repère de votre voiture' } },
      { p: V(Math.min(8.5, boardX + 3), 0, islandEdge) },
      { p: V(boardX, 0, bz), cue: { text: 'Votre train se trouve ici', sub: 'Montez à bord' }, final: true },
    ];
  }
  const lh = L.liftHall, li = L.liftIsland;
  const lhx = (lh.x0 + lh.x1) / 2, lhz = (lh.z0 + lh.z1) / 2, liz = (li.z0 + li.z1) / 2;
  const exitZ = quai === 2 ? li.z1 + 1.6 : li.z0 - 1.6;
  return [
    { p: start, cue: { text: 'Traversez le hall', sub: 'Direction : ascenseur, à droite' } },
    { p: V(9, 0, 12.4), cue: { text: 'Dirigez-vous vers l’ascenseur', sub: 'À droite de l’accès aux quais' } },
    { p: V(lhx, 0, lh.z1 + 1.6) , cue: { text: 'Prenez l’ascenseur', sub: 'Niveau –1 · passage souterrain' } },
    { p: V(lhx, 0, lhz), wait: 0.6 },
    { p: V(lhx, L.under.y, lhz), kind: 'lift', wait: 0.8 },
    { p: V(20, L.under.y, lhz), cue: { text: 'Empruntez le passage souterrain', sub: 'Parcours sans marche' } },
    { p: V(20, L.under.y, liz) },
    { p: V(lhx, L.under.y, liz), cue: { text: `Prenez l’ascenseur vers le quai ${quai}`, sub: 'Quai central 2 | 3' }, wait: 0.6 },
    { p: V(lhx, 0, liz), kind: 'lift', wait: 0.8 },
    { p: V(lhx, 0, exitZ), cue: { text: `Continuez jusqu’au quai ${quai}`, sub: 'Avancez jusqu’au repère de votre voiture' } },
    { p: V(Math.min(16, boardX + 4), 0, islandEdge) },
    { p: V(boardX, 0, bz), cue: { text: 'Votre train se trouve ici', sub: 'Montez à bord' }, final: true },
  ];
}

/** Quai → sortie (arrivée), via passage souterrain si nécessaire. */
export function arrivalRoute({ quai, doorX, stepFree, exit = V(0, 0, 21.5) }) {
  const bz = boardZ[quai];
  const out = [];
  if (quai === 1) {
    out.push(
      { p: V(doorX, 0, bz), cue: { text: 'Descendez du train', sub: 'Quai 1, côté gare' } },
      { p: V(doorX * 0.5, 0, 0), cue: { text: 'Entrez dans le hall', sub: 'Portes vitrées face à vous' } },
      { p: V(0, 0, 5.6) },
    );
  } else {
    const islandEdge = quai === 2 ? L.island[1] - 1.6 : L.island[0] + 1.6;
    out.push({ p: V(doorX, 0, bz), cue: { text: 'Descendez du train', sub: `Quai ${quai}` } });
    if (!stepFree) {
      out.push(
        { p: V(Math.min(doorX + 3, 8.5), 0, islandEdge), cue: { text: 'Rejoignez l’escalier', sub: 'Panneau « Sortie · Hall »' } },
        { p: V(11.2, 0, -17.5), cue: { text: 'Descendez dans le passage souterrain', sub: '' } },
        { p: V(18, L.under.y, -17.5), kind: 'stairs' },
        { p: V(20, L.under.y, -16.5), cue: { text: 'Suivez le passage vers le hall', sub: 'Il passe sous les voies' } },
        { p: V(20, L.under.y, 8.2) },
        { p: V(18, L.under.y, 8), cue: { text: 'Montez dans le hall', sub: '' } },
        { p: V(10.6, 0, 8), kind: 'stairs' },
      );
    } else {
      const lh = L.liftHall, li = L.liftIsland;
      const lx = (lh.x0 + lh.x1) / 2, lhz = (lh.z0 + lh.z1) / 2, liz = (li.z0 + li.z1) / 2;
      const exitZ = quai === 2 ? li.z1 + 1.6 : li.z0 - 1.6;
      out.push(
        { p: V(Math.min(doorX + 4, 16), 0, islandEdge), cue: { text: 'Rejoignez l’ascenseur', sub: 'Au bout du quai, à droite' } },
        { p: V(lx, 0, exitZ) },
        { p: V(lx, 0, liz), wait: 0.6, cue: { text: 'Prenez l’ascenseur', sub: 'Niveau –1 · passage souterrain' } },
        { p: V(lx, L.under.y, liz), kind: 'lift', wait: 0.8 },
        { p: V(20, L.under.y, liz), cue: { text: 'Suivez le passage vers le hall', sub: 'Parcours sans marche' } },
        { p: V(20, L.under.y, lhz) },
        { p: V(lx, L.under.y, lhz), wait: 0.6, cue: { text: 'Remontez dans le hall', sub: 'Ascenseur' } },
        { p: V(lx, 0, lhz), kind: 'lift', wait: 0.8 },
        { p: V(lx, 0, lh.z1 + 1.6) },
      );
    }
  }
  out.push(
    { p: V(4, 0, 13), cue: { text: 'Traversez le hall vers la sortie', sub: 'Suivez « Sortie · Ville »' } },
    { p: V(exit.x, 0, 19) },
    { p: exit.clone(), cue: { text: 'Sortez sur le parvis', sub: '' } },
  );
  return out;
}

export { boardZ, trackCenter, departureBoard };

/** Zones à exclure du socle de la ville pour une gare traversante. */
export function throughReserve(extent) {
  const r = [[L.site.x0, L.site.z0, L.site.x1, L.site.z1]];
  for (const [z0, z1] of [L.t1, L.t2, L.t3]) { r.push([-extent, z0, L.site.x0, z1]); r.push([L.site.x1, z0, extent, z1]); }
  return r;
}
export const decorTree = tree;
