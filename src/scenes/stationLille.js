import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette } from '../core/materials.js';
import { block, slab, stairs, signHanging, signOnPosts, signPanel, wallWithOpenings, glassPane, mesh, FONT } from '../core/build.js';

/*
 * Gare Lille-Flandres (cul-de-sac), repère local :
 *   façade (bâtiment voyageurs) z ∈ [8, 20], centrée en x = 0, tournée vers +z (rue Faidherbe)
 *   hall transversal (têtes de quais) z ∈ [-10, 8]
 *   quais et voies vers -z, numérotés 1 à 8 de gauche (x < 0) à droite.
 *   Le parvis (place de la Gare) est 1,20 m plus bas : marches au centre,
 *   rampe d'accès sans marche devant l'aile gauche (x ≈ -30).
 */

export const LF = {
  site: { x0: -48, x1: 48, z1: 20 },
  platformEnd: -240,
  buffer: -10,
  trackY: -0.9,
  base: -5,
  groundY: -1.2,
  tracks: [-36.25, -23.75, -16.25, -3.75, 3.75, 16.25, 23.75, 36.25],
  channels: [[-38.5, -34], [-26, -14], [-6, 6], [14, 26], [34, 38.5]],
  islands: [[-34, -26], [-14, -6], [6, 14], [26, 34]],
  steps: { x0: -12, x1: 12, z0: 20, z1: 25 },
  ramp: { x0: -36, x1: -24, z0: 20, z1: 35 },
};

/** Bord de quai (x) d'où l'on descend du train de la voie n. */
export function lilleBoardX(n) {
  const tx = LF.tracks[n - 1];
  const isl = LF.islands.find(([a, b]) => Math.abs(a - (tx + 2.25)) < 0.01 || Math.abs(b - (tx - 2.25)) < 0.01);
  if (!isl) return tx + 3;
  return Math.abs(isl[0] - (tx + 2.25)) < 0.01 ? isl[0] + 0.7 : isl[1] - 0.7;
}

export function buildLilleStation({ extent = 760 } = {}) {
  const g = new THREE.Group();
  g.name = 'station-lille';
  const occ = [];
  const S = LF.site;
  const zEnd = -extent;

  /* ---- socle : quais (y=0) jusqu'à platformEnd, faisceau de voies au-delà ---- */
  const channelRects = LF.channels.map(([a, b]) => [a, LF.platformEnd, b, LF.buffer]);
  g.add(slab([S.x0, LF.platformEnd, S.x1, S.z1], channelRects, LF.trackY, 0, 'platform', { edgeAngle: 20 }));
  g.add(block(S.x0, LF.base, LF.platformEnd, S.x1, LF.trackY, S.z1, 'socle', { edgeAngle: 20 }));
  g.add(block(S.x0, LF.base, zEnd, S.x1, LF.trackY, LF.platformEnd, 'socle', { edgeAngle: 20 }));
  // sol du hall plus clair
  g.add(block(S.x0 + 0.5, -0.02, LF.buffer, S.x1 - 0.5, 0.03, 8, 'floor', { edges: false, cast: false }));

  /* ---- voies ---- */
  const sleeperGeos = [], railGeos = [];
  for (const x of LF.tracks) {
    for (let z = zEnd; z < LF.buffer - 1; z += 1.4) {
      const sg = new THREE.BoxGeometry(2.5, 0.14, 0.3);
      sg.translate(x, LF.trackY + 0.07, z);
      sleeperGeos.push(sg);
    }
    for (const dx of [-0.75, 0.75]) {
      const rg = new THREE.BoxGeometry(0.1, 0.16, LF.buffer - 1 - zEnd);
      rg.translate(x + dx, LF.trackY + 0.2, (LF.buffer - 1 + zEnd) / 2);
      railGeos.push(rg);
    }
    // heurtoir
    g.add(block(x - 1.4, LF.trackY, LF.buffer - 1.6, x + 1.4, LF.trackY + 1.3, LF.buffer - 0.6, 'facade2'));
  }
  g.add(new THREE.Mesh(mergeGeometries(sleeperGeos), palette.get('sleeper')));
  const rails = new THREE.Mesh(mergeGeometries(railGeos), palette.get('rail', { roughness: 0.5 }));
  g.add(rails);

  // bandes de bord de quai
  const edgeGeos = [];
  for (const [a, b] of LF.islands) for (const x of [a + 0.45, b - 0.45]) {
    const eg = new THREE.BoxGeometry(0.25, 0.02, LF.buffer - LF.platformEnd - 2);
    eg.translate(x, 0.012, (LF.buffer + LF.platformEnd) / 2 - 1);
    edgeGeos.push(eg);
  }
  g.add(new THREE.Mesh(mergeGeometries(edgeGeos), palette.get('white')));

  // numéros de quais (totems en tête de quai)
  LF.islands.forEach(([a, b], i) => {
    const t = signOnPosts({ w: 2.4, h: 1.0, key: 'lq' + i, lines: [{ text: `Quais ${i * 2 + 1} | ${i * 2 + 2}`, size: 0.58 }] }, 2.8);
    t.position.set((a + b) / 2, 0, LF.buffer - 4);
    g.add(t);
    const t2 = t.clone();
    t2.position.z = -80;
    g.add(t2);
  });

  /* ---- grande halle métallique (vue en coupe : arcs et verrière) ---- */
  const shed = new THREE.Group();
  const span = S.x1 - S.x0 + 2;
  const ribGeos = [];
  const curve = new THREE.EllipseCurve(0, 0, span / 2, 15, 0, Math.PI, false);
  const arcPts = curve.getPoints(28).map((p) => new THREE.Vector3(p.x, p.y + 9, 0));
  for (let z = LF.buffer - 2; z > LF.platformEnd + 30; z -= 14) {
    const c = new THREE.CatmullRomCurve3(arcPts.map((p) => p.clone().setZ(z)));
    ribGeos.push(new THREE.TubeGeometry(c, 40, 0.28, 6, false));
    for (const x of [S.x0 - 0.5, S.x1 + 0.5]) {
      const col = new THREE.BoxGeometry(0.5, 9, 0.5); col.translate(x, 4.5, z); ribGeos.push(col.toNonIndexed());
    }
  }
  const ribs = new THREE.Mesh(mergeGeometries(ribGeos.map((q) => (q.index ? q.toNonIndexed() : q))), palette.get('facade3', { roughness: 0.6 }));
  ribs.castShadow = true;
  shed.add(ribs);
  // pannes longitudinales
  for (const a of [0.15, 0.32, 0.5, 0.68, 0.85]) {
    const p = curve.getPoint(a);
    shed.add(block(p.x - 0.15, p.y + 9 - 0.15, LF.platformEnd + 30, p.x + 0.15, p.y + 9 + 0.15, LF.buffer - 2, 'facade3', { edges: false }));
  }
  // verrière (bande centrale)
  const glassShape = new THREE.Shape();
  const gpts = curve.getPoints(28).filter((p) => Math.abs(p.x) < span * 0.36);
  glassShape.moveTo(gpts[0].x, gpts[0].y);
  gpts.forEach((p) => glassShape.lineTo(p.x, p.y));
  const gGeo = new THREE.ExtrudeGeometry(glassShape, { depth: (LF.buffer - 2) - (LF.platformEnd + 30), bevelEnabled: false });
  gGeo.translate(0, 9, LF.platformEnd + 30);
  const glass = new THREE.Mesh(gGeo, palette.glass(0.7));
  shed.add(glass);
  g.add(shed);
  occ.push(shed);

  /* ---- hall transversal : verrière légère ---- */
  const hallRoof = new THREE.Group();
  for (let x = S.x0 + 4; x < S.x1; x += 8) hallRoof.add(block(x - 0.15, 11.5, LF.buffer, x + 0.15, 12, 8, 'facade3', { edges: false }));
  const hr = new THREE.Mesh(new THREE.BoxGeometry(S.x1 - S.x0, 0.06, 8 - LF.buffer), palette.glass(0.5));
  hr.position.set(0, 12, (8 + LF.buffer) / 2);
  hallRoof.add(hr);
  g.add(hallRoof);
  occ.push(hallRoof);

  /* ---- bâtiment voyageurs (façade historique) ---- */
  const bv = buildFacadeLille();
  g.add(bv);
  occ.push(bv);

  /* ---- marches et rampe vers le parvis ---- */
  const st = LF.steps;
  g.add(stairs({ axis: 'z', a: st.z0, b: st.z1, ya: 0, yb: LF.groundY, c: 0, w: st.x1 - st.x0, steps: 6, mat: 'facade2' }));
  const rp = LF.ramp;
  const rampLen = Math.hypot(rp.z1 - rp.z0, -LF.groundY);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(rp.x1 - rp.x0, 0.4, rampLen), palette.get('facade2'));
  ramp.rotation.x = Math.atan2(-LF.groundY, rp.z1 - rp.z0);
  ramp.position.set((rp.x0 + rp.x1) / 2, LF.groundY / 2 - 0.2, (rp.z0 + rp.z1) / 2);
  ramp.castShadow = true; ramp.receiveShadow = true;
  g.add(ramp);
  g.add(block(rp.x0 - 0.3, LF.groundY, rp.z0, rp.x0, 0.9, rp.z1, 'facade', { edges: true }));
  g.add(block(rp.x1, LF.groundY, rp.z0, rp.x1 + 0.3, 0.9, rp.z1, 'facade', { edges: true }));
  // podium devant la façade
  g.add(block(-46, LF.groundY - 0.01, 20, rp.x0 - 0.3, 0, 21.5, 'facade2'));
  g.add(block(rp.x1 + 0.3, LF.groundY - 0.01, 20, st.x0, 0, 21.5, 'facade2'));
  g.add(block(st.x1, LF.groundY - 0.01, 20, 46, 0, 21.5, 'facade2'));

  /* ---- mobilier du hall ---- */
  const props = new THREE.Group();
  const board = signPanel({ w: 9, h: 2.4, px: 160, key: 'lille-arrivals', draw: (ctx, W, H) => {
    ctx.fillStyle = '#26313c'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e8eef3'; ctx.font = `600 ${Math.round(H * 0.16)}px ${FONT}`; ctx.textBaseline = 'middle';
    ctx.fillText('Arrivées · Départs', W * 0.04, H * 0.2);
    ctx.fillStyle = '#9fb0bf'; ctx.font = `500 ${Math.round(H * 0.11)}px ${FONT}`;
    ctx.fillText('Lille-Flandres', W * 0.04, H * 0.42);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#3a4653'; ctx.fillRect(W * 0.04, H * (0.56 + i * 0.13), W * 0.92, H * 0.09); }
  } });
  board.position.set(0, 6.2, -2);
  props.add(board);
  props.add(block(-4.6, 4.9, -2.12, 4.6, 7.5, -2.04, 'dark', { edges: false }));
  for (const x of [-30, 30]) props.add(block(x - 4, 0, -1, x + 4, 3.4, 4, 'facade2'));
  const shopL = signPanel({ w: 5, h: 0.6, key: 'lshop1', lines: [{ text: 'Boutiques', size: 0.7 }] }); shopL.position.set(-30, 3.9, 4.02); props.add(shopL);
  const shopR = signPanel({ w: 5, h: 0.6, key: 'lshop2', lines: [{ text: 'Café', size: 0.7 }] }); shopR.position.set(30, 3.9, 4.02); props.add(shopR);
  for (let i = 0; i < 4; i++) props.add(block(14 + i * 1.6 - 0.5, 0, 5.8, 14 + i * 1.6 + 0.5, 1.9, 6.6, 'facade2'));
  props.add(block(-20, 0, 4.6, -12, 1.1, 6.2, 'white'));
  const acc = signHanging({ w: 4, h: 0.9, key: 'lacc', lines: [{ text: 'Accueil', size: 0.7 }] }, 4.4, 11.5); acc.position.set(-16, 0, 5.4); props.add(acc);
  const ex = signHanging({ w: 6.4, h: 1.0, key: 'lsortie', style: 'accent', lines: [{ text: 'Sortie · Bus · Taxis', size: 0.62 }] }, 5.4, 11.5);
  ex.position.set(0, 0, 3); props.add(ex);
  const exL = signHanging({ w: 5.6, h: 1.0, key: 'lsortie2', lines: [{ text: 'Sortie sans marche', size: 0.55 }] }, 5.4, 11.5);
  exL.position.set(-26, 0, 3); props.add(exL);
  g.add(props);

  return { group: g, occluders: occ };
}

/** Façade de Lille-Flandres : pavillon central à grande baie cintrée et horloge, ailes à arcades. */
function buildFacadeLille() {
  const g = new THREE.Group();
  const z = 20, zb = 8;
  // pavillon central
  const pc = wallWithOpenings({ w: 26, h: 22, depth: 1.4, mat: 'facade', openings: [
    { x: -6.5, y: 0, w: 4.4, h: 7, arch: true }, { x: 0, y: 0, w: 4.4, h: 7, arch: true }, { x: 6.5, y: 0, w: 4.4, h: 7, arch: true },
    { x: 0, y: 8.6, w: 15, h: 11, arch: true },
  ] });
  pc.position.set(0, 0, z - 0.2);
  g.add(pc);
  const gp = glassPane({ x: 0, y: 8.6, w: 15, h: 11, arch: true }, 1.3); gp.position.set(0, 0, z - 0.3); g.add(gp);
  for (let x = -5; x <= 5; x += 2.5) g.add(block(x - 0.1, 8.6, z - 0.4, x + 0.1, 18.5, z - 0.2, 'facade3', { edges: false }));
  for (const x of [-13, -9.4, 9.4, 13]) g.add(block(x - 0.7, 0, z - 0.6, x + 0.7, 22.6, z + 1.0, 'white'));
  g.add(block(-13.8, 21.6, z - 0.9, 13.8, 22.6, z + 1.2, 'white'));
  // attique avec horloge
  g.add(block(-8, 22.6, z - 0.4, 8, 26.4, z + 0.6, 'facade'));
  const arcS = new THREE.Shape(); arcS.moveTo(-8, 0); arcS.lineTo(8, 0); arcS.quadraticCurveTo(0, 4.4, -8, 0);
  const arcG = new THREE.ExtrudeGeometry(arcS, { depth: 1.0, bevelEnabled: false }); arcG.translate(0, 26.4, z - 0.4);
  g.add(mesh(arcG, 'facade'));
  const clockG = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.2, 40), palette.get('white')); disc.rotation.x = Math.PI / 2; clockG.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.12, 6, 40), palette.get('dark')); clockG.add(ring);
  const h1 = block(-0.06, 0, 0.1, 0.06, 1.0, 0.16, 'dark', { edges: false }); clockG.add(h1);
  const h2 = block(-0.06, 0, 0.1, 0.06, 1.3, 0.16, 'dark', { edges: false }); h2.rotation.z = -2.4; clockG.add(h2);
  clockG.position.set(0, 24.6, z + 0.72);
  g.add(clockG);
  for (const x of [-10, 10]) { const st = block(x - 0.6, 22.6, z, x + 0.6, 25.8, z + 1.2, 'facade3'); g.add(st); }
  // ailes
  for (const s of [-1, 1]) {
    const cx = s * 24.5;
    const openings = [];
    for (let i = 0; i < 5; i++) {
      const x = -9 + i * 4.5;
      const isDoor = s < 0 && i === 1;
      openings.push({ x, y: isDoor ? 0 : 1.2, w: isDoor ? 3.2 : 2.6, h: isDoor ? 5.6 : 5, arch: true });
      openings.push({ x, y: 8, w: 2.2, h: 4.2, arch: true });
    }
    const w = wallWithOpenings({ w: 23, h: 15, depth: 0.9, mat: 'facade', openings });
    w.position.set(cx, 0, z - 0.45);
    g.add(w);
    for (const o of openings) if (o.y > 0) { const p = glassPane(o, 0.9); p.position.set(cx, 0, z - 0.5); g.add(p); }
    g.add(block(cx - 11.5, 15, z - 0.9, cx + 11.5, 16, z + 0.3, 'white'));
    // pavillons d'extrémité
    const ex = s * 41;
    const pw = wallWithOpenings({ w: 10, h: 18, depth: 1.2, mat: 'facade', openings: [{ x: 0, y: 2, w: 4.4, h: 9, arch: true }] });
    pw.position.set(ex, 0, z - 0.3);
    g.add(pw);
    const pg = glassPane({ x: 0, y: 2, w: 4.4, h: 9, arch: true }, 0.9); pg.position.set(ex, 0, z - 0.4); g.add(pg);
    g.add(block(ex - 5.4, 18, z - 1, ex + 5.4, 19.2, z + 0.4, 'white'));
    // murs latéraux et arrière (toit ouvert : vue en coupe)
    g.add(block(s * 46 - (s > 0 ? 0.6 : 0), 0, zb, s * 46 + (s < 0 ? 0.6 : 0), 15, z - 0.9, 'facade2'));
  }
  // mur arrière avec grandes ouvertures vers le hall
  const back = wallWithOpenings({ w: 92, h: 12, depth: 0.6, mat: 'facade2', openings: [
    { x: -30, y: 0, w: 8, h: 5 }, { x: -16, y: 0, w: 6, h: 5 }, { x: 0, y: 0, w: 12, h: 6 }, { x: 16, y: 0, w: 6, h: 5 }, { x: 30, y: 0, w: 8, h: 5 },
  ] });
  back.position.set(0, 0, zb);
  g.add(back);
  // planchers intermédiaires coupés (lecture des niveaux)
  for (const [a, b] of [[-46, -34], [-26, -6], [6, 26], [34, 46]]) g.add(block(a, 7.4, zb + 0.4, b, 7.7, z - 1, 'floor2', { edges: true }));
  // nom
  const name = signPanel({ w: 10, h: 0.9, key: 'name-lille', draw: (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#26313c'; ctx.font = `600 ${Math.round(H * 0.6)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('LILLE-FLANDRES', W / 2, H / 2 + 2);
  } });
  name.position.set(0, 7.9, z + 0.62);
  g.add(name);
  return g;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Itinéraire d'arrivée : porte du train → hall → parvis. */
export function lilleArrivalRoute({ quai, doorZ, stepFree }) {
  const bx = lilleBoardX(quai);
  const toward = bx > 0 ? -1 : 1;
  const pts = [
    { p: V(bx, 0, doorZ), cue: { text: 'Descendez du train', sub: `Quai ${quai}` } },
    { p: V(bx + toward * 1.4, 0, doorZ + 3), cue: { text: 'Remontez le quai vers le hall', sub: 'Les quais se terminent dans le hall' } },
    { p: V(bx + toward * 1.4, 0, LF.buffer - 3) },
  ];
  if (!stepFree) {
    pts.push(
      { p: V(4, 0, 0), cue: { text: 'Traversez le hall', sub: 'Suivez « Sortie · Bus · Taxis »' } },
      { p: V(0, 0, 8.5) },
      { p: V(0, 0, 19.8), cue: { text: 'Sortez par l’entrée principale', sub: 'Quelques marches vers la place' } },
      { p: V(0, LF.groundY, 25), kind: 'stairs' },
      { p: V(0, LF.groundY, 26.5), cue: { text: 'Vous êtes sur la place de la Gare', sub: '' } },
    );
  } else {
    pts.push(
      { p: V(-10, 0, 1), cue: { text: 'Traversez le hall vers la gauche', sub: 'Suivez « Sortie sans marche »' } },
      { p: V(-30, 0, 6.5) },
      { p: V(-30, 0, 19.8), cue: { text: 'Empruntez la rampe', sub: 'Accès de plain-pied à la place' } },
      { p: V(-30, LF.groundY, 35) },
      { p: V(-30, LF.groundY, 36), cue: { text: 'Vous êtes sur la place de la Gare', sub: '' } },
    );
  }
  return pts;
}
