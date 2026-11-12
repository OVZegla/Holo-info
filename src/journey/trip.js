import * as THREE from 'three';
import { Route } from '../core/route.js';
import { departureRoute, arrivalRoute, boardZ } from '../scenes/station.js';
import { lilleArrivalRoute, lilleBoardX, LF } from '../scenes/stationLille.js';
import { CITY_PLANS } from '../scenes/cityPlans.js';
import { toMin, fmt } from './time.js';

/**
 * Calcule les informations du récapitulatif (temps de marche issus des chemins 3D)
 * et vérifie la cohérence des horaires.
 */
export function computeTrip(data, city, dest, leg, stepFree) {
  const T = dest.train;
  const dep = new Route(departureRoute({ quai: T.quai, boardX: 6, stepFree }));
  const plan = CITY_PLANS[city.id]();
  let arrPts;
  if (city.id === 'lille') arrPts = lilleArrivalRoute({ quai: T.quaiArrivee, doorZ: LF.buffer - 40, stepFree });
  else arrPts = arrivalRoute({ quai: T.quaiArrivee, doorX: 6, stepFree });
  if (leg.mode !== 'marche') {
    const key = leg.point + (stepFree && plan.walks[leg.point + ':sf'] ? ':sf' : '');
    for (const [x, z] of (plan.walks[key] || []).slice(1)) arrPts.push({ p: new THREE.Vector3(x, plan.groundY ?? 0, z) });
  }
  const arr = new Route(arrPts);
  const walkDep = Math.max(1, Math.ceil(dep.realSeconds() / 60));
  const walkArr = Math.max(1, Math.ceil(arr.realSeconds() / 60));
  const start = toMin(data.borne.heure);
  const end = toMin(leg.arrivee) + (leg.marcheFinale || 0);
  const warnings = [];
  if (start + walkDep > toMin(T.depart)) warnings.push(`Temps de marche (${walkDep} min) supérieur au délai avant le départ du train.`);
  if (toMin(T.arrivee) + walkArr > toMin(leg.depart)) warnings.push(`Correspondance trop courte à ${data.gares[city.id].nom} (${walkArr} min de marche).`);
  const usesStairsDep = dep.hasKind('stairs');
  const usesLiftDep = dep.hasKind('lift');
  void boardZ; void lilleBoardX;
  return {
    walkDep, walkArr, start, end, total: end - start,
    startStr: fmt(start), endStr: fmt(end),
    usesStairsDep, usesLiftDep,
    usesStairsArr: arr.hasKind('stairs'), usesLiftArr: arr.hasKind('lift'),
    warnings,
  };
}
