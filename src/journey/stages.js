import * as THREE from 'three';
import { Route, keyed, smooth, smoother, clamp01 } from '../core/route.js';
import { PathRibbon, TravelerMarker, Beacon, highlightShell } from '../core/fx.js';
import { makeTrain, makeBus, makeCar } from '../scenes/vehicles.js';
import { departureRoute, arrivalRoute, L as TL, boardZ, trackCenter, departureBoard } from '../scenes/station.js';
import { lilleArrivalRoute, lilleBoardX, LF } from '../scenes/stationLille.js';
import { trainPath, routeLineMesh, STATIONS } from '../scenes/region.js';
import { toMin, fmt } from './time.js';

/*
 * Étapes du parcours. Chaque étape est entièrement déterministe :
 * update(t) place tous les objets à l'instant t, ce qui permet pause,
 * retour, rejouer… sans état caché.
 *
 * Interface d'une étape construite :
 *   { id, seg, place, world, duration, cues[], group, labels[],
 *     update(t, time), camera(t), overview, clock(t) (minutes), info(t), focus(t) }
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const MAP_NAME = { lille: 'Lille', lens: 'Lens', arras: 'Arras', bethune: 'Béthune' };

/* ------------------------------------------------------------------ */
/*  Outils communs                                                     */
/* ------------------------------------------------------------------ */

/** Position lissée (moyenne pondérée autour de t) pour une caméra calme. */
function smoothPos(route, distAt, t, span = [-1.2, 0, 1.2, 2.4]) {
  const p = new THREE.Vector3();
  const w = [0.15, 0.35, 0.3, 0.2];
  span.forEach((dt, i) => p.addScaledVector(route.posAt(distAt(t + dt)), w[i]));
  return p;
}

function walker({ group, route, revealStart = 0, revealDur = 1.6, walkStart, ribbonWidth = 1.0, scale = 1 }) {
  const ribbon = new PathRibbon(route, { width: ribbonWidth, scale });
  group.add(ribbon.object);
  const marker = new TravelerMarker(scale);
  group.add(marker.object);
  const dist = (t) => route.distAt(t - walkStart);
  const tmp = new THREE.Vector3();
  return {
    ribbon, marker, route, dist,
    end: walkStart + route.duration,
    update(t, time) {
      const reveal = route.length * smooth(clamp01((t - revealStart) / revealDur));
      const d = dist(t);
      ribbon.update(reveal, d, time);
      marker.set(route.posAt(d, tmp), route.dirAt(Math.min(route.length - 0.01, d + 0.5)), time);
    },
    pos(t) { return route.posAt(dist(t)); },
  };
}

function liftsFollow(lifts, route, d) {
  // cabines : suivent le voyageur quand il est dans la gaine, sinon restent au bon niveau
  for (const lf of lifts) {
    const inShaft = (p) => p.x > lf.rect.x0 - 0.1 && p.x < lf.rect.x1 + 0.1 && p.z > lf.rect.z0 - 0.1 && p.z < lf.rect.z1 + 0.1;
    let first = -1, last = -1;
    route.points.forEach((pt, i) => { if (inShaft(pt.p)) { if (first < 0) first = i; last = i; } });
    if (first < 0) { lf.cabin.position.y = 0; continue; }
    const p = route.posAt(d);
    if (d <= route.cum[first]) lf.cabin.position.y = route.points[first].p.y;
    else if (d >= route.cum[last]) lf.cabin.position.y = route.points[last].p.y;
    else lf.cabin.position.y = inShaft(p) ? p.y : lf.cabin.position.y;
  }
}

function trainLabel(train) {
  return `<span class="tm">${train.depart}</span> ${train.numero} · ${train.direction}`;
}

/* ------------------------------------------------------------------ */
/*  Étape 1 — Gare de départ                                           */
/* ------------------------------------------------------------------ */

export function stageDeparture(ctx) {
  const { data, dest, stepFree, world } = ctx;
  const T = dest.train;
  const group = new THREE.Group();
  const labels = [];
  const quai = T.quai;

  // train : on cale la porte avant de la voiture choisie vers x ≈ 6
  const probe = makeTrain({ cars: 3, accent: true });
  const front = Math.max(...probe.doors.filter((d) => d.car === T.voiture).map((d) => d.x));
  const headX = 6 - front;
  const tr = probe;
  tr.object.position.set(headX, TL.trackY + 0.28, trackCenter[quai]);
  group.add(tr.object);
  const boardX = 6;
  const shell = highlightShell(tr.object, 0.35);
  group.add(shell);

  // tableau des départs cohérent avec les données
  const rows = [...(data.autresDeparts || []), { heure: T.depart, destination: T.direction, train: T.numero, quai, highlight: true }]
    .sort((a, b) => toMin(a.heure) - toMin(b.heure)).slice(0, 4);
  const board = departureBoard(rows);
  board.position.set(2, 0, 9.2);
  group.add(board);

  const route = new Route(departureRoute({ quai, boardX, stepFree }));
  const walkStart = 2.2;
  const w = walker({ group, route, revealStart: 0.4, revealDur: 1.8, walkStart });
  const holdEnd = w.end + 4.5;
  const beacon = new Beacon({ radius: 1.4, height: 6 });
  beacon.object.position.set(boardX, 0, boardZ[quai]);
  group.add(beacon.object);

  labels.push({ html: 'Vous êtes ici', cls: 'accent big', obj: w.marker.object, offset: V(0, 2.6, 0), until: walkStart + 1.2 });
  labels.push({ html: `Quai ${quai} · voiture ${T.voiture}`, cls: 'accent', pos: V(boardX, 3.2, boardZ[quai]) });
  labels.push({ html: trainLabel(T), cls: '', pos: V(headX - 8, 5.6, trackCenter[quai]), from: w.end - 1 });
  labels.push({ html: 'Ascenseur', cls: 'soft', pos: V(23.5, 3.6, 7), when: () => stepFree });
  labels.push({ html: 'Passage souterrain', cls: 'soft', pos: V(20, -1.5, -4) });

  const realWalk = route.realSeconds();
  const startMin = toMin(data.borne.heure);
  const cues = [...route.cues(walkStart)];
  cues[cues.length - 1] = { ...cues[cues.length - 1], text: 'Votre train se trouve ici', sub: `${T.numero} · voiture ${T.voiture} · départ ${T.depart}` };

  const hall = V(-2, 0, 10);
  return {
    id: 'depart', seg: 'gare', place: data.gares.bethune.nomComplet, world: 'bethune', duration: holdEnd,
    group, labels, cues, realWalk,
    update(t, time) {
      w.update(t, time);
      liftsFollow(world.lifts, route, w.dist(t));
      const k = clamp01((t - (w.end - 1.2)) / 1.2);
      shell.visible = k > 0;
      shell.material.opacity = 0.03 + 0.05 * k * (0.6 + 0.4 * Math.sin(time * 3));
      beacon.update(time, smooth(clamp01((t - (w.end - 2)) / 1.5)));
    },
    camera(t) {
      if (t < walkStart) return { target: hall, yaw: 0.32, pitch: 0.95, dist: 105 };
      const p = smoothPos(route, w.dist, t);
      const under = p.y < -1.5 ? 1 : 0;
      if (t > w.end - 0.5) return { target: V(boardX - 8, 0, boardZ[quai] - 1), yaw: 0.55, pitch: 0.85, dist: 92 };
      return { target: p.add(V(0, 0, -4)), yaw: 0.35 + under * 0.15, pitch: 0.98 + under * 0.1, dist: 80 - under * 12 };
    },
    overview: { target: V(0, 0, -4), yaw: 0.35, pitch: 0.98, dist: 190 },
    focus(t) { return w.pos(t); },
    clock(t) { return startMin + (realWalk / 60) * (w.dist(t) / route.length); },
    info(t) {
      if (t < walkStart) return null;
      return `<div class="ic-k">Votre train</div><div class="ic-v">${T.numero}</div>
        <div class="ic-k">Direction</div><div class="ic-v">${T.direction}</div>
        <div class="ic-k">Départ · Quai</div><div class="ic-v">${T.depart} · Quai ${quai}</div>
        <div class="ic-k">Voiture</div><div class="ic-v">${T.voiture}</div>`;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Étape 2 — Voyage en train (carte régionale)                        */
/* ------------------------------------------------------------------ */

export function stageTrain(ctx) {
  const { data, dest, city } = ctx;
  const T = dest.train;
  const group = new THREE.Group();
  const names = ['Béthune', ...T.arrets.map((a) => a.gare), MAP_NAME[city.id]];
  const times = [T.depart, ...T.arrets.map((a) => a.heure), T.arrivee].map(toMin);
  const { pts, stopIdx } = trainPath(names);
  const line = routeLineMesh(pts);
  group.add(line);
  const segCount = line.geometry.index ? line.geometry.index.count / (pts.length - 1) : 0;

  // horaires d'animation : intro, segments, arrêts
  const intro = 3.2;
  const dwell = 1.5;
  const segDur = [];
  for (let i = 0; i < names.length - 1; i++) {
    const a = pts[stopIdx[i]], b = pts[stopIdx[i + 1]];
    segDur.push(2.6 + a.distanceTo(b) / 55);
  }
  const keys = []; // {t, idx, minutes}
  let t = intro;
  keys.push({ t, i: stopIdx[0], m: times[0] });
  for (let i = 0; i < segDur.length; i++) {
    t += segDur[i];
    keys.push({ t, i: stopIdx[i + 1], m: times[i + 1], move: true });
    if (i < segDur.length - 1) { t += dwell; keys.push({ t, i: stopIdx[i + 1], m: times[i + 1] }); }
  }
  const arriveT = t;
  const duration = arriveT + 3.5;

  const fIdx = (tt) => {
    if (tt <= keys[0].t) return stopIdx[0];
    for (let k = 1; k < keys.length; k++) {
      if (tt <= keys[k].t) {
        const a = keys[k - 1], b = keys[k];
        if (!b.move) return a.i;
        return a.i + (b.i - a.i) * smoother((tt - a.t) / (b.t - a.t));
      }
    }
    return stopIdx[stopIdx.length - 1];
  };
  const posAtIdx = (f) => {
    const i = Math.max(0, Math.min(pts.length - 2, Math.floor(f)));
    return pts[i].clone().lerp(pts[i + 1], f - i);
  };
  const train = makeTrain({ cars: 3, accent: true, scale: 0.26, carNumbers: false });
  group.add(train.object);
  const halo = new Beacon({ radius: 7, height: 22 });
  group.add(halo.object);

  const labels = names.map((n, i) => ({
    html: `${n} <span class="tm">${fmt(times[i])}</span>`,
    cls: i === 0 || i === names.length - 1 ? 'accent' : '',
    pos: V(STATIONS[n] ? STATIONS[n][0] : pts[stopIdx[i]].x, 3, STATIONS[n] ? STATIONS[n][1] : pts[stopIdx[i]].z),
    stem: true,
  }));

  const start = pts[0], end = pts[pts.length - 1];
  const dir = end.clone().sub(start);
  const travelYaw = Math.atan2(-dir.x, -dir.z) * 0.55;
  const center = start.clone().add(end).multiplyScalar(0.5);
  const span = Math.max(80, start.distanceTo(end));
  const cues = [{ t: 0, text: 'Votre train relie les villes', sub: 'Trajet accéléré pour la démonstration' }];
  for (let i = 1; i < names.length; i++) {
    const k = keys.find((kk) => kk.i === stopIdx[i] && kk.move);
    if (i < names.length - 1) cues.push({ t: k.t - 0.6, text: `Arrêt : ${names[i]}`, sub: `${fmt(times[i])} · restez à bord` });
    else cues.push({ t: k.t - 0.6, text: `Arrivée : ${data.gares[city.id].nomComplet}`, sub: `${T.arrivee} · descendez du train` });
  }
  cues.splice(1, 0, { t: intro - 0.4, text: `Départ de Béthune à ${T.depart}`, sub: `${T.numero} · direction ${T.direction}` });

  const tmp = new THREE.Vector3();
  return {
    id: 'train', seg: 'train', place: `${T.numero} · ${T.direction}`, world: 'region', duration, group, labels, cues,
    update(tt, time) {
      const f = fIdx(tt);
      const p = posAtIdx(f);
      const ahead = posAtIdx(Math.min(pts.length - 1.001, f + 1.5));
      const behind = posAtIdx(Math.max(0, f - 1.5));
      tmp.copy(ahead).sub(behind);
      train.object.position.copy(p).setY(0.45);
      if (tmp.lengthSq() > 1e-6) train.object.rotation.y = Math.atan2(-tmp.z, tmp.x);
      // la tête de la rame est à l'origine : on la décale pour centrer sur le point
      train.object.position.addScaledVector(tmp.normalize(), train.length / 2);
      halo.object.position.copy(p).setY(0.1);
      halo.update(time, tt > arriveT - 0.2 ? 1 : 0.5);
      // tracé révélé
      const rev = clamp01(tt / 2.2);
      const shown = Math.max(Math.floor(f), Math.floor(rev * (pts.length - 1)));
      line.geometry.setDrawRange(0, Math.round(shown * segCount) + segCount);
    },
    camera(tt) {
      if (tt < intro - 0.6) return { target: center, yaw: travelYaw * 0.4, pitch: 1.1, dist: span * 1.75 + 120 };
      if (tt > arriveT - 0.4) return { target: end, yaw: travelYaw, pitch: 0.9, dist: 190 };
      const p = posAtIdx(fIdx(tt + 0.8));
      return { target: p, yaw: travelYaw, pitch: 0.95, dist: 230 };
    },
    overview: { target: center, yaw: 0, pitch: 1.12, dist: span * 1.8 + 140 },
    focus() { return null; },
    clock(tt) {
      if (tt <= keys[0].t) return keys[0].m;
      for (let k = 1; k < keys.length; k++) if (tt <= keys[k].t) {
        const a = keys[k - 1], b = keys[k];
        return a.m + (b.m - a.m) * clamp01((tt - a.t) / (b.t - a.t));
      }
      return times[times.length - 1];
    },
    info(tt) {
      let next = names.length - 1;
      for (let i = 1; i < names.length; i++) { const k = keys.find((kk) => kk.i === stopIdx[i] && kk.move); if (tt < k.t + 0.1) { next = i; break; } }
      const last = next === names.length - 1;
      return `<div class="ic-k">${last ? 'Arrivée' : 'Prochain arrêt'}</div><div class="ic-v">${names[next]} · ${fmt(times[next])}</div>
        <div class="ic-k">Terminus de votre trajet</div><div class="ic-v">${data.gares[city.id].nomComplet} · ${T.arrivee}</div>`;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Étape 3 — Gare d'arrivée et correspondance                         */
/* ------------------------------------------------------------------ */

export function stageArrival(ctx) {
  const { data, dest, leg, stepFree, world, city } = ctx;
  const T = dest.train;
  const quai = T.quaiArrivee;
  const group = new THREE.Group();
  const labels = [];
  const gy = world.groundY;

  /* --- train qui entre en gare --- */
  const train = makeTrain({ cars: 3, accent: true });
  const front = Math.max(...train.doors.filter((d) => d.car === T.voiture).map((d) => d.x));
  group.add(train.object);
  const arriveDur = 4.2;
  let placeTrain, doorPos;
  if (world.kind === 'terminus') {
    const tx = LF.tracks[quai - 1];
    const headStop = LF.buffer - 2.5;
    train.object.rotation.y = -Math.PI / 2;
    doorPos = V(lilleBoardX(quai), 0, headStop + front);
    placeTrain = (t) => {
      const k = smoother(clamp01(t / arriveDur));
      train.object.position.set(tx, LF.trackY + 0.28, headStop - (1 - k) * 220);
    };
  } else {
    const headX = 6 - front;
    doorPos = V(6, 0, boardZ[quai]);
    placeTrain = (t) => {
      const k = smoother(clamp01(t / arriveDur));
      train.object.position.set(headX - (1 - k) * 260, TL.trackY + 0.28, trackCenter[quai]);
    };
  }

  /* --- itinéraire : quai → sortie → point de correspondance --- */
  const pts = world.kind === 'terminus'
    ? lilleArrivalRoute({ quai, doorZ: doorPos.z, stepFree })
    : arrivalRoute({ quai, doorX: doorPos.x, stepFree });
  const walkKey = leg.mode === 'marche' ? null : leg.point + (stepFree && world.walks[leg.point + ':sf'] ? ':sf' : '');
  const poi = leg.point ? world.pois[leg.point] : null;
  if (walkKey && world.walks[walkKey]) {
    const wpts = world.walks[walkKey];
    wpts.slice(1).forEach(([x, z], i) => {
      const cue = i === 0 ? (leg.mode === 'bus'
        ? { text: 'Rejoignez l’arrêt de bus', sub: `${leg.nomPoint}` }
        : { text: 'Rejoignez le point de prise en charge', sub: leg.nomPoint }) : null;
      pts.push({ p: V(x, gy, z), cue });
    });
    pts[pts.length - 1].cue = leg.mode === 'bus'
      ? { text: `Attendez le bus ligne ${leg.ligne}`, sub: `Direction ${leg.direction} · départ ${leg.depart}` }
      : { text: 'Votre voiture arrive', sub: `${leg.vehicule} · ${leg.depart}` };
  } else {
    pts[pts.length - 1].cue = { text: 'Sortez sur le parvis', sub: `Ensuite : ${dest.nom} à pied` };
  }
  const route = new Route(pts);
  const walkStart = arriveDur + 1.2;
  const w = walker({ group, route, revealStart: arriveDur - 0.8, revealDur: 2.2, walkStart });
  w.marker.object.visible = false;

  /* --- véhicule de correspondance --- */
  let vehicle = null, vRoute = null, vStart = w.end + 0.4, vDur = 0;
  if (leg.mode === 'bus' || leg.mode === 'voiture') {
    const key = (leg.mode === 'bus' ? 'bus' : 'voiture') + ':arrivee';
    const rp = (world.routes[key] || [[poi.x + 150, poi.z + 6], [poi.x, poi.z + 6]]).map(([x, z]) => ({ p: V(x, gy + 0.02, z) }));
    vRoute = new Route(rp, { speeds: { walk: 30 } });
    vDur = 3.6;
    vehicle = leg.mode === 'bus' ? makeBus({ line: leg.ligne, direction: leg.direction }) : makeCar({ accent: true });
    group.add(vehicle.object);
    labels.push({ html: leg.mode === 'bus' ? `<span class="tm">${leg.ligne}</span> ${leg.direction} · ${leg.depart}` : `${leg.vehicule}`, cls: 'accent', obj: vehicle.object, offset: V(0, leg.mode === 'bus' ? 5 : 3.4, 0), from: vStart });
  }
  const boardT = vehicle ? vStart + vDur + 0.6 : w.end;
  const duration = boardT + (vehicle ? 2.6 : 2.2);

  const beacon = new Beacon({ radius: 1.8, height: 7 });
  const endP = route.points[route.points.length - 1].p;
  beacon.object.position.copy(endP);
  group.add(beacon.object);
  if (poi) labels.push({ html: leg.nomPoint, cls: 'accent', pos: V(poi.x, gy + 4, poi.z) });
  labels.push({ html: `Quai ${quai}`, cls: '', pos: doorPos.clone().add(V(0, 3.2, 0)) });

  const cues = [{ t: 0, text: `Arrivée : ${data.gares[city.id].nomComplet}`, sub: `${T.arrivee} · quai ${quai}` }, ...route.cues(walkStart)];
  if (vehicle) cues.push({ t: vStart + vDur + 0.2, text: 'Montez à bord', sub: leg.mode === 'bus' ? `Ligne ${leg.ligne} · direction ${leg.direction}` : `${leg.vehicule}` });

  const arrMin = toMin(T.arrivee);
  const realWalk = route.realSeconds();
  const depMin = toMin(leg.depart);
  const tmp = new THREE.Vector3();
  const isTerminus = world.kind === 'terminus';
  return {
    id: 'arrivee', seg: 'correspondance', place: data.gares[city.id].nomComplet, world: city.id, duration, group, labels, cues, realWalk,
    update(t, time) {
      placeTrain(t);
      w.update(t, time);
      w.marker.object.visible = t > walkStart - 0.5 && (!vehicle || t < boardT);
      if (world.lifts) liftsFollow(world.lifts, route, w.dist(t));
      if (vehicle) {
        const d = vRoute.length * smooth(clamp01((t - vStart) / vDur));
        const p = vRoute.posAt(d, tmp);
        vehicle.object.position.copy(p);
        const dirv = vRoute.dirAt(Math.min(vRoute.length - 0.1, d));
        vehicle.object.rotation.y = Math.atan2(-dirv.z, dirv.x);
        vehicle.object.visible = t > vStart - 0.2;
      }
      beacon.update(time, smooth(clamp01((t - (w.end - 2)) / 1.2)) * (vehicle && t > boardT ? 0 : 1));
    },
    camera(t) {
      if (t < walkStart) {
        return isTerminus
          ? { target: doorPos.clone().add(V(-6, 0, 10)), yaw: Math.PI - 0.5, pitch: 0.88, dist: 120 }
          : { target: doorPos.clone().add(V(-6, 0, 0)), yaw: 0.45, pitch: 0.88, dist: 110 };
      }
      if (vehicle && t > w.end - 0.5) return { target: V(endP.x * 0.55, endP.y, (endP.z + 12) / 2), yaw: 0.22, pitch: 0.82, dist: 135 };
      const p = smoothPos(route, w.dist, t);
      const under = p.y < -1.5 ? 1 : 0;
      const outside = p.z > 20 ? 1 : 0;
      const yaw = isTerminus ? (p.z > 16 ? 0.4 : Math.PI - 0.45) : (outside ? 0.25 : 0.35 + under * 0.15);
      return { target: p, yaw, pitch: 0.98 + under * 0.1, dist: (isTerminus ? 88 : 80) - under * 12 + outside * 20 };
    },
    overview: isTerminus ? { target: V(-10, 0, -10), yaw: Math.PI - 0.5, pitch: 0.95, dist: 230 } : { target: V(0, 0, 5), yaw: 0.4, pitch: 0.98, dist: 200 },
    focus(t) { return t > walkStart - 0.5 ? w.pos(t) : null; },
    clock(t) {
      const walked = arrMin + (realWalk / 60) * (w.dist(t) / route.length);
      if (!vehicle) return walked;
      return t < w.end ? walked : walked + (depMin - walked) * clamp01((t - w.end) / (boardT - w.end));
    },
    info() {
      if (leg.mode === 'bus') return `<div class="ic-k">Correspondance</div><div class="ic-v"><span class="ic-line">${leg.ligne}</span>Bus</div>
        <div class="ic-k">Direction</div><div class="ic-v">${leg.direction}</div>
        <div class="ic-k">Arrêt · Départ</div><div class="ic-v">${leg.nomPoint.replace(/^Arrêt /, '')} · ${leg.depart}</div>`;
      if (leg.mode === 'voiture') return `<div class="ic-k">Prise en charge</div><div class="ic-v">${leg.nomPoint}</div>
        <div class="ic-k">Véhicule</div><div class="ic-v">${leg.vehicule}</div>
        <div class="ic-k">Rendez-vous</div><div class="ic-v">${leg.depart}</div>`;
      return `<div class="ic-k">Ensuite</div><div class="ic-v">À pied jusqu’à ${dest.nom}</div>`;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Étape 4 — Fin de parcours jusqu'à la destination                    */
/* ------------------------------------------------------------------ */

export function stageDestination(ctx) {
  const { dest, leg, stepFree, world } = ctx;
  const group = new THREE.Group();
  const labels = [];
  const gy = world.groundY;
  const place = world.pois[dest.lieu];
  const depMin = toMin(leg.depart), arrMin = toMin(leg.arrivee);
  const finalMin = arrMin + (leg.marcheFinale || 0);
  const lift = (pts) => pts.map(([x, z]) => ({ p: V(x, gy + 0.02, z) }));

  let ride = null, vehicle = null, rideDur = 0, walk, walkStart;
  const cues = [];
  if (leg.mode === 'bus' || leg.mode === 'voiture') {
    const key = (leg.mode === 'bus' ? 'bus:' : 'voiture:') + dest.lieu;
    const rpts = world.routes[key];
    const route = new Route(lift(rpts));
    rideDur = Math.max(9, Math.min(18, route.length / 55));
    ride = { route, ribbon: new PathRibbon(route, { width: 3.2, scale: 3 }) };
    group.add(ride.ribbon.object);
    vehicle = leg.mode === 'bus' ? makeBus({ line: leg.ligne, direction: leg.direction }) : makeCar({ accent: true });
    group.add(vehicle.object);
    labels.push({ html: leg.mode === 'bus' ? `<span class="tm">${leg.ligne}</span> ${leg.direction}` : 'Votre voiture', cls: 'accent', obj: vehicle.object, offset: V(0, leg.mode === 'bus' ? 5 : 3.5, 0), until: 1.4 + rideDur });
    cues.push({ t: 0, text: leg.mode === 'bus' ? `Trajet en bus · ligne ${leg.ligne}` : 'Trajet en voiture', sub: leg.mode === 'bus' ? `Direction ${leg.direction}` : `${leg.vehicule}` });
    cues.push({ t: 1.4 + rideDur - 1.6, text: leg.mode === 'bus' ? `Descendez à l’arrêt « ${leg.arretDescente} »` : 'Descendez de la voiture', sub: `${leg.arrivee}` });
    const wk0 = world.walks[`${dest.lieu}:${leg.mode}`] || [[rpts[rpts.length - 1][0], rpts[rpts.length - 1][1]]];
    const wk = [...wk0.slice(0, -1), [place.x, place.z]];
    if (wk.length < 2) wk.unshift(rpts[rpts.length - 1]);
    const wr = new Route(lift(wk).map((p, i) => (i === 0 ? { ...p, cue: { text: `Rejoignez ${dest.nom}`, sub: `${leg.marcheFinale || 1} min à pied` } } : p)), { speeds: { walk: 4 } });
    walkStart = 1.4 + rideDur + 0.8;
    walk = walker({ group, route: wr, revealStart: walkStart - 0.8, revealDur: 0.8, walkStart, ribbonWidth: 1.4, scale: 1.4 });
    cues.push(...wr.cues(walkStart));
  } else {
    const key = `${dest.lieu}:marche` + (stepFree && world.walks[`${dest.lieu}:marche:sf`] ? ':sf' : '');
    const wk = world.walks[key] || [[0, 24], [place.x, place.z]];
    const pts = lift(wk);
    pts[0].cue = { text: `Rejoignez ${dest.nom} à pied`, sub: `${Math.round(arrMin - depMin)} min · suivez le chemin` };
    const lenEst = pts.reduce((s, p, i) => (i ? s + p.p.distanceTo(pts[i - 1].p) : 0), 0);
    pts[Math.floor(pts.length / 2)].cue = { text: 'Continuez tout droit', sub: 'Le chemin reste sur les trottoirs' };
    const wr = new Route(pts, { speeds: { walk: Math.max(7, lenEst / 16) } });
    walkStart = 1.2;
    walk = walker({ group, route: wr, revealStart: 0, revealDur: 2.4, walkStart, ribbonWidth: 2.6, scale: 2 });
    cues.push(...wr.cues(walkStart));
  }
  const arriveT = walk.end;
  const duration = arriveT + 5;
  cues.push({ t: arriveT - 0.3, text: 'Vous êtes arrivé', sub: `${dest.nom} · ${fmt(finalMin)}` });

  const beacon = new Beacon({ radius: 7, height: 26 });
  beacon.object.position.set(place.x, gy, place.z);
  group.add(beacon.object);
  labels.push({ html: `${dest.nom}`, cls: 'accent big', pos: V(place.x, gy + 18, place.z) });
  if (ride && leg.mode === 'bus') labels.push({ html: `Arrêt ${leg.arretDescente}`, cls: '', pos: ride.route.points[ride.route.points.length - 1].p.clone().add(V(0, 4, 0)) });

  const tmp = new THREE.Vector3();
  const endP = new THREE.Vector3(place.x, gy, place.z);
  return {
    id: 'destination', seg: 'destination', place: dest.nom, world: ctx.city.id, duration, group, labels, cues,
    update(t, time) {
      if (ride) {
        const k = smooth(clamp01((t - 1.4) / rideDur));
        const d = ride.route.length * k;
        ride.ribbon.update(ride.route.length * smooth(clamp01(t / 1.4)), d, time);
        const p = ride.route.posAt(d, tmp);
        vehicle.object.position.copy(p);
        const dv = ride.route.dirAt(Math.min(ride.route.length - 0.1, d + 1));
        vehicle.object.rotation.y = Math.atan2(-dv.z, dv.x);
      }
      walk.update(t, time);
      walk.marker.object.visible = t > walkStart - 0.3;
      beacon.update(time, 0.4 + 0.6 * smooth(clamp01((t - (arriveT - 2)) / 1.5)));
    },
    camera(t) {
      if (t > arriveT - 0.6) {
        const spin = (t - arriveT) * 0.08;
        return { target: endP, yaw: 0.6 + spin, pitch: 0.7, dist: 200 };
      }
      if (ride && t < walkStart - 0.3) {
        const k = smooth(clamp01((t - 1.4 + 1.2) / rideDur));
        const p = ride.route.posAt(ride.route.length * k);
        const s = ride.route.posAt(0), e = ride.route.posAt(ride.route.length);
        const dir = e.clone().sub(s);
        return { target: p, yaw: Math.atan2(-dir.x, -dir.z) * 0.8, pitch: 0.98, dist: 300 };
      }
      const p = smoothPos(walk.route, walk.dist, t);
      const s = walk.route.posAt(0), e = walk.route.posAt(walk.route.length);
      const dir = e.clone().sub(s);
      return { target: p, yaw: dir.lengthSq() > 100 ? Math.atan2(-dir.x, -dir.z) * 0.85 : 0.5, pitch: 0.95, dist: ride ? 110 : 190 };
    },
    overview: (() => {
      const s = (ride ? ride.route : walk.route).posAt(0);
      // centre un peu côté destination : son libellé passe sous le bandeau du haut sinon
      const c = s.clone().lerp(endP, 0.56);
      // trajet dans l'axe vertical de l'écran (borne en portrait) : départ en bas, destination en haut
      const dir = endP.clone().sub(s);
      const yaw = dir.lengthSq() > 100 ? Math.atan2(-dir.x, -dir.z) : 0.3;
      return { target: c, yaw, pitch: 1.05, dist: Math.max(380, s.distanceTo(endP) * 2.3) };
    })(),
    focus(t) { return t > walkStart - 0.3 ? walk.pos(t) : null; },
    clock(t) {
      if (ride) {
        if (t < walkStart) return depMin + (arrMin - depMin) * clamp01((t - 1.4) / rideDur);
        return arrMin + (finalMin - arrMin) * clamp01((t - walkStart) / (arriveT - walkStart));
      }
      return depMin + (arrMin - depMin) * clamp01((t - walkStart) / (arriveT - walkStart));
    },
    info() {
      return `<div class="ic-k">Destination</div><div class="ic-v">${dest.nom}</div>
        <div class="ic-k">${dest.type}</div><div class="ic-v">Arrivée ${fmt(finalMin)}</div>`;
    },
  };
}

export function buildStages(ctx) {
  return [stageDeparture, stageTrain, stageArrival, stageDestination];
}
