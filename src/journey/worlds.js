import * as THREE from 'three';
import { buildThroughStation, throughReserve, L } from '../scenes/station.js';
import { buildLilleStation, LF } from '../scenes/stationLille.js';
import { buildCity } from '../scenes/city.js';
import { CITY_PLANS } from '../scenes/cityPlans.js';
import { buildRegion } from '../scenes/region.js';
import { facadeBethune, facadeLens, facadeArras, abribus, poteauDepose } from '../scenes/landmarks.js';

/*
 * « Mondes » 3D : une gare et son quartier, ou la carte régionale.
 * Ils sont construits une seule fois puis réutilisés d'une étape à l'autre.
 */

const FACADES = { bethune: facadeBethune, lens: facadeLens, arras: facadeArras };
const cache = new Map();

export function getWorld(id, engine) {
  if (cache.has(id)) return cache.get(id);
  const w = id === 'region' ? buildRegionWorld() : buildStationWorld(id);
  // groupes effaçables enregistrés une fois
  const before = engine.occluders;
  engine.occluders = [];
  w.occEntries = w.occluders.map((o) => engine.addOccluder(o));
  engine.occluders = before;
  cache.set(id, w);
  return w;
}

function buildRegionWorld() {
  const r = buildRegion();
  return { id: 'region', kind: 'region', group: r.group, occluders: [], labels: r.labels.map((l) => ({
    text: l.name, at: l.at, h: l.h ?? (l.major ? 9 : 4), cls: l.major ? 'city' : 'city minor', maxDist: l.major ? 5000 : 1400,
  })), groundY: 0 };
}

function buildStationWorld(id) {
  const plan = CITY_PLANS[id]();
  const g = new THREE.Group();
  g.name = 'world-' + id;
  let station, reserve = [];
  if (id === 'lille') {
    station = buildLilleStation({ extent: plan.radius });
  } else {
    station = buildThroughStation({ name: id, facade: FACADES[id], kiosk: id === 'bethune', arrivalMode: id !== 'bethune', extent: plan.radius });
    reserve = throughReserve(plan.radius);
  }
  g.add(station.group);
  const city = buildCity(plan, { reserve });
  g.add(city.group);
  // mobilier des points de correspondance
  for (const [pid, p] of Object.entries(city.pois)) {
    if (pid === 'arret-bus') {
      const a = abribus({ line: '', label: 'Quai B' });
      a.position.set(p.x, city.groundY ?? plan.groundY ?? 0, p.z);
      a.rotation.y = ((p.rot || 0) * Math.PI) / 180;
      g.add(a);
      p.object = a;
    } else if (pid === 'depose-minute') {
      const d = poteauDepose();
      d.position.set(p.x, plan.groundY ?? 0, p.z);
      g.add(d);
    }
  }
  const groundY = plan.groundY ?? 0;
  // entrée des lieux d'arrivée : devant la façade du bâtiment associé
  for (const p of Object.values(city.pois)) {
    const lm = p.building && city.landmarks[p.building];
    if (!lm) continue;
    const r = lm.obj.rotation.y, d = (lm.obj.userData.depth || 30) / 2 + 4;
    p.x = lm.x + Math.sin(r) * d;
    p.z = lm.z + Math.cos(r) * d;
  }
  const labels = city.labels.map((l) => ({ text: l.text, at: l.at, h: l.h, cls: l.cls, maxDist: l.cls.includes('minor') ? 700 : 2600, y: groundY }));
  return {
    id, kind: id === 'lille' ? 'terminus' : 'through', group: g, plan, city, station,
    occluders: [...station.occluders, ...city.occluders],
    lifts: station.lifts || [],
    labels, groundY,
    pois: city.pois, routes: plan.routes || {}, walks: plan.walks || {},
    exitPoint: id === 'lille' ? null : new THREE.Vector3(0, 0, 21.5),
    layout: id === 'lille' ? LF : L,
    buildings: city.buildings,
  };
}
