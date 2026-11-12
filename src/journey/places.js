/*
 * Recherche de lieux (saisie libre ou dictée) dans les quartiers de gare :
 * rues, places, parcs et bâtiments nommés d'OpenStreetMap + arrêts de bus GTFS.
 * Les positions sont en mètres [Est, Nord] depuis la gare (repère des fichiers osm-*.json).
 */
import { getOsm } from '../scenes/osm.js';
import { GTFS, planOf } from './planner.js';

const CITY_WORDS = { bethune: ['bethune'], lens: ['lens'], arras: ['arras'], lille: ['lille'] };
const CITY_NAME = { bethune: 'Béthune', lens: 'Lens', arras: 'Arras', lille: 'Lille' };
const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'en', 'et', 'sur', 'pres', 'vers', 'je', 'veux', 'aller', 'voudrais', 'vais', 'me', 'rendre', 'pour']);
const KIND_LABEL = { road: 'Rue', square: 'Place', park: 'Parc', building: 'Lieu', stop: 'Arrêt', landmark: 'Monument', station: 'Gare SNCF' };
const STATION_NAME = { bethune: 'Gare de Béthune', lens: 'Gare de Lens', arras: 'Gare d’Arras', lille: 'Gare Lille-Flandres' };
// mots-clés supplémentaires des monuments de la maquette
// noms d'usage des lieux OSM (clé : nom OSM normalisé)
const NAME_ALIAS = { 'place du general de gaulle': 'grand place','place des heros': 'petite place' };
const ALIAS = { stade: 'stade bollaert foot rc lens', opera: 'opera theatre', bourse: 'vieille bourse', europe: 'gare lille europe', hdv: 'hotel de ville mairie beffroi', beffroi: 'beffroi hotel de ville mairie' };

export const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((w) => w && !STOP.has(w));
const centroid = (pts) => { let e = 0, n = 0; for (const p of pts) { e += p[0]; n += p[1]; } return [e / pts.length, n / pts.length]; };

let INDEX = null;

function build() {
  const out = [];
  for (const city of Object.keys(CITY_WORDS)) {
    const osm = getOsm(city);
    if (!osm) continue;
    const byName = new Map();
    const add = (n, kind, pts, prio) => {
      if (!n) return;
      const k = norm(n) + '|' + kind;
      const g = byName.get(k) || { name: n, kind, pts: [], prio };
      g.pts.push(...pts);
      byName.set(k, g);
    };
    for (const b of osm.buildings) add(b.n, 'building', b.p, 3);
    for (const s of osm.squares || []) add(s.n, 'square', s.p, 4);
    for (const p of osm.parks || []) add(p.n, 'park', p.p, 3);
    // rues : les rues piétonnes nommées « place … » comptent comme des places
    for (const r of osm.roads) add(r.n, /^(place|grand.?place|parvis|square)/i.test(r.n || '') ? 'square' : 'road', r.p, 2);
    for (const s of GTFS?.bus?.[city]?.stops || []) add(s.n, 'stop', [s.p], 1);
    const plan = planOf(city);
    const inPlan = ([x, z]) => Math.max(Math.abs(x), Math.abs(z)) < plan.radius - 40; // décor carré
    for (const g of byName.values()) {
      const en = centroid(g.pts);
      if (!inPlan(plan.osmFrame.toLocal(en))) continue; // hors du décor 3D : non proposé
      const extra = NAME_ALIAS[norm(g.name)] || '';
      out.push({ city, name: g.name, kind: g.kind, prio: g.prio + (extra ? 3 : 0), en, poly: g.kind === 'building' ? g.pts : null, toks: tokens(`${g.name} ${extra}`), dist: Math.hypot(en[0], en[1]) });
    }
    // la gare elle-même (« gare d'arras ») : le trajet s'arrête à la sortie de la gare
    out.push({ city, name: STATION_NAME[city], kind: 'station', prio: 8, xz: [0, 24], en: [0, 0], toks: tokens(`${STATION_NAME[city]} gare sncf station`), dist: 0 });
    // monuments modélisés (Opéra, stade Bollaert…) : certains n'ont pas de nom dans OSM
    for (const lm of plan.landmarks || []) {
      if (!lm.label || lm.at.some(Number.isNaN) || !inPlan(lm.at)) continue;
      out.push({ city, name: lm.label, kind: 'landmark', prio: 5, xz: lm.at, en: [0, 0], toks: tokens(`${lm.label} ${ALIAS[lm.id] || ''}`), dist: Math.hypot(lm.at[0], lm.at[1]) });
    }
  }
  return out;
}

/** Découpe une requête en ville éventuelle + mots du lieu. */
function parse(q) {
  let toks = tokens(q), city = null;
  for (const [id, words] of Object.entries(CITY_WORDS)) {
    if (toks.some((t) => words.includes(t))) { city = id; toks = toks.filter((t) => !words.includes(t)); }
  }
  return { city, toks };
}

/**
 * Lieux correspondant à la requête, du plus pertinent au moins pertinent.
 * « grand place de béthune » → Grand'Place (Béthune) ; « euralille » → Euralille (Lille).
 */
export function searchPlaces(q, limit = 6) {
  INDEX ??= build();
  const { city, toks } = parse(q);
  if (!toks.length) return [];
  const scored = [];
  for (const e of INDEX) {
    if (city && e.city !== city) continue;
    let s = 0;
    for (const t of toks) {
      if (e.toks.includes(t)) s += 3;
      else if (e.toks.some((w) => w.startsWith(t))) s += t.length >= 3 ? 2 : 0.5;
      else if (t.length >= 5 && e.toks.some((w) => w.includes(t) || t.includes(w) && w.length >= 4)) s += 1; // « euralille » / « eura lille »
      else s -= 1.5;
    }
    if (s <= 0) continue;
    s += e.toks.length === toks.length ? 1 : 0; // nom complet
    // mots du nom en trop (hors alias) : « Hôtel Mercure … Grand-Place » < « Grand Place »
    s -= 0.3 * Math.max(0, new Set(tokens(e.name)).size - toks.length);
    s += e.prio * 0.3 - e.dist / 3000;
    scored.push({ ...e, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  // pas deux fois le même nom dans la même ville (bâtiment + rue « Euralille »)
  // (le résultat gardé récupère le contour du bâtiment homonyme : on vise son accès, pas son centre)
  const seen = new Map();
  return scored.filter((e) => {
    const k = e.city + norm(e.name);
    const kept = seen.get(k);
    if (kept) { if (!kept.poly && e.poly) kept.poly = e.poly; return false; }
    seen.set(k, e);
    return true;
  }).slice(0, limit)
    .map((e) => ({ city: e.city, cityName: CITY_NAME[e.city], name: e.name, kind: e.kind, kindLabel: KIND_LABEL[e.kind], en: e.en, xz: e.xz, poly: e.poly }));
}
