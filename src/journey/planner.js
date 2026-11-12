/*
 * Itinéraire vers un lieu choisi librement (recherche ou dictée), à partir des
 * horaires officiels (src/data/gtfs.json, npm run gtfs) et des rues réelles
 * (src/data/osm-*.json, npm run osm).
 *
 * Produit une « destination » au même format que data/scenarios.js
 * (train + correspondances), avec lieu 'custom' : les étapes 3D l'affichent
 * comme les scénarios de démonstration. Les géométries calculées (arrêts,
 * tracé du bus, marches) sont injectées dans le monde 3D par injectCustom().
 */
import { CITY_PLANS } from '../scenes/cityPlans.js';
import { applyOsm } from '../scenes/osm.js';
import { STATIONS } from '../scenes/region.js';
import { fmt } from './time.js';

const FILES = import.meta.glob('../data/gtfs.json', { eager: true, import: 'default' });
export const GTFS = FILES['../data/gtfs.json'] || null;
export const hasGtfs = () => !!GTFS;

export const ORIGIN = 'bethune';
const STATION_FULL = { bethune: 'Gare de Béthune', lens: 'Gare de Lens', arras: 'Gare d’Arras', lille: 'Gare Lille-Flandres' };
const WALK = 72;            // m/min (≈ 4,3 km/h, rythme tranquille)
const EXIT = [0, 24];       // sortie de gare sur le parvis (repère local de la maquette)
const DEP_WALK = 6;         // hall → quai à Béthune (min, marge comprise)
const ARR_WALK = 4;         // quai → parvis à l'arrivée
const LOCAL_EXIT = 2;       // hall → parvis à Béthune
const BOARD_RADIUS = 520;   // arrêts de montée envisagés autour du parvis (m)
const ALIGHT_RADIUS = 550;  // arrêts de descente envisagés autour du lieu (m)
const MODES = { 0: 'Tram', 1: 'Métro', 3: 'Bus' }; // métro : tracé en pointillés (souterrain)

// gares du GTFS sur la carte régionale (positions réelles)
if (GTFS?.stations) for (const [n, [lat, lon]] of Object.entries(GTFS.stations)) STATIONS[n] ??= [(lon - 2.85) * 710, -(lat - 50.47) * 1112];

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const plans = new Map();
/** Plan de ville avec données OSM (repère, graphe des rues) — mêmes coordonnées que le monde 3D. */
export function planOf(city) {
  if (!plans.has(city)) plans.set(city, applyOsm(CITY_PLANS[city]()));
  return plans.get(city);
}
const pathLen = (p) => p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);

function walkPath(plan, a, b) {
  const r = plan.graph?.route(a, b, 'walk');
  const pts = r && r.length >= 2 ? r : [a, b];
  return { pts, min: Math.max(1, Math.round(pathLen(pts) / WALK)) };
}

/** Quai stable pour un numéro de train (le GTFS ne donne pas les voies). */
const quaiFor = (num, n) => 1 + ([...String(num)].reduce((s, c) => s + c.charCodeAt(0), 0) % n);

/**
 * Options pour aller du parvis de la gare (à t0, minutes) jusqu'au lieu P (local).
 * Renvoie des « correspondances » triées par heure d'arrivée.
 */
function localOptions(city, P, t0) {
  const plan = planOf(city);
  const T = plan.osmFrame.toLocal;
  const walk = walkPath(plan, EXIT, P);
  const opts = [{
    mode: 'marche', nomPoint: 'Sortie de la gare', depart: fmt(t0), arrivee: fmt(t0 + walk.min), marcheFinale: 0,
    _geo: { walk: walk.pts }, _end: t0 + walk.min,
  }];
  const net = GTFS?.bus?.[city];
  if (net && walk.min > 7) {
    const stops = net.stops.map((s) => ({ ...s, xz: T(s.p) }));
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const board = new Map(), alight = new Map();
    stops.forEach((s, i) => {
      if (d(s.xz, EXIT) < BOARD_RADIUS) board.set(i, Math.ceil((d(s.xz, EXIT) * 1.3) / WALK));
      if (d(s.xz, P) < ALIGHT_RADIUS) alight.set(i, Math.ceil((d(s.xz, P) * 1.3) / WALK));
    });
    const best = new Map(); // une option par ligne : la plus rapide
    for (const trip of net.trips) {
      const route = net.routes[trip.r];
      if (!MODES[route?.m]) continue;
      if (trip.st[0][1] > t0 + 90) break;
      for (let i = 0; i < trip.st.length; i++) {
        const [si, ti] = trip.st[i];
        if (!board.has(si) || ti < t0 + board.get(si) + 1) continue;
        for (let j = i + 1; j < trip.st.length; j++) {
          const [sj, tj] = trip.st[j];
          if (!alight.has(sj)) continue;
          // pas de « trajet » entre deux quais du même arrêt ou deux arrêts voisins
          if (stops[sj].n === stops[si].n || d(stops[sj].xz, stops[si].xz) < 300) continue;
          const end = tj + alight.get(sj);
          const prev = best.get(route.s);
          if (!prev || end < prev.end) best.set(route.s, { end, trip, i, j, route });
        }
        break; // premier arrêt de montée possible de cette course
      }
    }
    for (const b of best.values()) {
      if (b.end > walk.min + t0 - 3) continue; // le bus doit faire gagner au moins 3 min
      const s0 = stops[b.trip.st[b.i][0]], s1 = stops[b.trip.st[b.j][0]];
      const toStop = walkPath(plan, EXIT, s0.xz), fromStop = walkPath(plan, s1.xz, P);
      // tracé du véhicule sur les rues, d'arrêt en arrêt
      const via = b.trip.st.slice(b.i, b.j + 1).map(([si]) => stops[si].xz);
      const metro = b.route.m === 1;
      // métro souterrain : de station en station en ligne droite ; bus et tram : sur les rues
      let ride = [via[0]];
      for (let k = 1; k < via.length; k++) {
        if (metro) { ride.push(via[k]); continue; }
        const r = plan.graph?.route(via[k - 1], via[k], 'drive');
        ride = ride.concat((r && r.length >= 2 ? r : [via[k - 1], via[k]]).slice(1));
      }
      // approche du véhicule jusqu'à l'arrêt de montée (depuis l'arrêt précédent ou 150 m avant)
      const prevStop = b.i > 0 ? stops[b.trip.st[b.i - 1][0]].xz : null;
      const approach = prevStop && !metro ? plan.graph?.route(prevStop, s0.xz, 'drive') : null;
      const tArr = b.trip.st[b.j][1];
      if (tArr + fromStop.min > t0 + walk.min - 3) continue; // marche réelle depuis l'arrêt comprise
      opts.push({
        mode: 'bus', ligne: b.route.s, direction: b.trip.h || b.route.l || '', vehicule: MODES[b.route.m],
        point: 'custom-stop', nomPoint: `Arrêt ${s0.n}`, depart: fmt(b.trip.st[b.i][1]), arrivee: fmt(tArr),
        arretDescente: s1.n, marcheFinale: fromStop.min, couleur: b.route.c,
        _geo: { toStop: toStop.pts, ride, approach: approach && approach.length >= 2 ? approach.slice(-12) : null, fromStop: fromStop.pts, board: s0.xz, alight: s1.xz },
        _end: tArr + fromStop.min,
      });
    }
  }
  return opts.sort((a, b) => a._end - b._end).slice(0, 3);
}

/**
 * Trajet complet depuis la borne vers un lieu trouvé par searchPlaces().
 * @returns {{ dest, local } | { error }}
 */
export function planTo(place, nowStr) {
  if (!GTFS) return { error: 'Horaires indisponibles : lancer npm run gtfs.' };
  const now = toMin(nowStr);
  const plan = planOf(place.city);
  // monuments de la maquette : position déjà dans le repère local ;
  // bâtiment : on vise son côté le plus proche de la gare (accès), pas son centre
  let P = place.xz || plan.osmFrame.toLocal(place.en);
  if (place.poly?.length) {
    const d = (q) => Math.hypot(q[0] - EXIT[0], q[1] - EXIT[1]);
    P = place.poly.map(plan.osmFrame.toLocal).reduce((a, q) => (d(q) < d(a) ? q : a));
  }
  if (Math.max(Math.abs(P[0]), Math.abs(P[1])) > plan.radius - 20) return { error: `${place.name} est en dehors du plan de ${place.cityName}.` };
  const local = place.city === ORIGIN;
  // la gare elle-même, ou tout lieu « gare » à côté d'elle (bâtiment, arrêt « Gare Quai B »…) : arrêt à la gare
  const stationOnly = place.kind === 'station' || (/\bgare\b/i.test(place.name) && Math.hypot(P[0] - EXIT[0], P[1] - EXIT[1]) < 250);
  if (stationOnly && local) return { error: 'Vous êtes déjà à la gare de Béthune.' };
  let train = null, t0;
  if (local) t0 = now + LOCAL_EXIT;
  else {
    const T = (GTFS.trains[place.city] || []).find((t) => toMin(t.dep) >= now + DEP_WALK);
    if (!T) return { error: `Plus de train pour ${place.cityName} aujourd’hui.` };
    train = {
      numero: `TER ${T.num}`, direction: T.dir, depart: T.dep, arrivee: T.arr,
      quai: quaiFor(T.num, 3), voiture: 2, quaiArrivee: quaiFor(T.num, place.city === 'lille' ? 8 : 3),
      arrets: T.stops.map(([gare, heure]) => ({ gare, heure })),
    };
    t0 = toMin(T.arr) + ARR_WALK;
  }
  // gare d'arrivée elle-même : le trajet se termine à la sortie de la gare
  const correspondances = stationOnly
    ? [{ mode: 'gare', nomPoint: 'Sortie de la gare', depart: train.arrivee, arrivee: fmt(t0), marcheFinale: 0, _geo: {} }]
    : localOptions(place.city, P, t0);
  return {
    local,
    dest: {
      id: 'custom', custom: true, local, stationOnly, nom: stationOnly ? STATION_FULL[place.city] : place.name, type: `${place.kindLabel} · ${place.cityName}`,
      lieu: 'custom', at: P, train, correspondances,
    },
  };
}

/** Remet le monde (mis en cache) dans son état d'origine : tracés des scénarios de démonstration. */
export function restoreWorld(world) {
  if (!world.pois) return;
  world._base ??= { pois: { ...world.pois }, routes: { ...world.routes }, walks: { ...world.walks } };
  world.pois = { ...world._base.pois };
  world.routes = { ...world._base.routes };
  world.walks = { ...world._base.walks };
}

/**
 * Inscrit le lieu, l'arrêt et les tracés de l'option choisie dans le monde 3D
 * (emplacements « custom » / « custom-stop », itinéraires « bus:custom », marches).
 */
export function injectCustom(world, dest, leg) {
  restoreWorld(world);
  const g = leg._geo || {};
  world.pois.custom = { x: dest.at[0], z: dest.at[1], label: dest.nom };
  delete world.pois['custom-stop'];
  if (leg.mode === 'bus') {
    world.pois['custom-stop'] = { x: g.board[0], z: g.board[1], label: leg.nomPoint };
    world.walks['custom-stop'] = g.toStop;
    world.routes['bus:custom'] = g.ride;
    world.routes['bus:arrivee'] = g.approach || [[g.board[0] + 120, g.board[1]], g.board];
    world.walks['custom:bus'] = g.fromStop;
  } else if (g.walk) {
    world.walks['custom:marche'] = g.walk;
  }
}
