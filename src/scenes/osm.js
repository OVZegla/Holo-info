/*
 * Données OpenStreetMap (© contributeurs OpenStreetMap, licence ODbL).
 * Fichiers src/data/osm-<ville>.json produits par tools/fetch-osm.mjs :
 * coordonnées [Est, Nord] en mètres depuis la gare. S'ils sont absents,
 * la maquette utilise le bâti généré (cityPlans.js).
 */
const FILES = import.meta.glob('../data/osm-*.json', { eager: true, import: 'default' });

export function getOsm(id) {
  return FILES[`../data/osm-${id}.json`] || null;
}

export const hasOsm = () => Object.keys(FILES).length > 0;

const D2R = Math.PI / 180;

/**
 * Repère local aligné sur la maquette : on mesure l'orientation réelle des voies
 * près de la gare, puis on fait coïncider le faisceau de voies OSM avec celui de
 * la gare modélisée.
 */
export function osmFrame(osm, plan) {
  const near = plan.kind === 'terminus' ? 320 : 160;
  let sx = 0, sy = 0;
  const segs = [];
  for (const r of osm.rails) {
    for (let i = 0; i < r.p.length - 1; i++) {
      const [e1, n1] = r.p[i], [e2, n2] = r.p[i + 1];
      const me = (e1 + e2) / 2, mn = (n1 + n2) / 2;
      if (Math.hypot(me, mn) > near) continue;
      const len = Math.hypot(e2 - e1, n2 - n1);
      const b = Math.atan2(e2 - e1, n2 - n1); // relèvement
      sx += Math.cos(2 * b) * len; sy += Math.sin(2 * b) * len;
      segs.push([me, mn, len]);
    }
  }
  const guess = plan.facadeBearing * D2R;
  let F = guess;
  if (segs.length) {
    const B = Math.atan2(sy, sx) / 2;
    const cands = plan.kind === 'terminus' ? [B, B + Math.PI] : [B + Math.PI / 2, B - Math.PI / 2];
    const diff = (a) => Math.abs(Math.atan2(Math.sin(a - guess), Math.cos(a - guess)));
    F = cands.sort((a, b) => diff(a) - diff(b))[0];
  }
  const ez = [Math.sin(F), Math.cos(F)];
  const ex = [Math.sin(F - Math.PI / 2), Math.cos(F - Math.PI / 2)];
  let offX = 0, offZ = plan.osmNodeZ ?? 12;
  if (segs.length) {
    let w = 0, acc = 0;
    for (const [me, mn, len] of segs) {
      const u = plan.kind === 'terminus' ? me * ex[0] + mn * ex[1] : me * ez[0] + mn * ez[1];
      acc += u * len; w += len;
    }
    const mean = acc / w;
    if (plan.kind === 'terminus') offX = -mean;
    else offZ = -15 - mean; // centre du faisceau de voies de la gare modélisée
  }
  const toLocal = ([E, N]) => [E * ex[0] + N * ex[1] + offX, E * ez[0] + N * ez[1] + offZ];
  return { F: F / D2R, toLocal };
}

/* ------------------------------------------------------------------ */
/*  Graphe des rues et plus court chemin                               */
/* ------------------------------------------------------------------ */
const DRIVE = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
const WALK_EXCLUDE = new Set(['trunk', 'motorway', 'motorway_link', 'trunk_link']);

export class RoadGraph {
  constructor(roads) {
    this.nodes = []; // [x, z]
    this.keyToId = new Map();
    this.adj = { drive: [], walk: [] };
    const id = ([x, z]) => {
      const k = Math.round(x * 5) + ',' + Math.round(z * 5);
      let i = this.keyToId.get(k);
      if (i === undefined) { i = this.nodes.length; this.nodes.push([x, z]); this.keyToId.set(k, i); this.adj.drive.push([]); this.adj.walk.push([]); }
      return i;
    };
    for (const r of roads) {
      const ids = r.pts.map(id);
      for (let i = 0; i < ids.length - 1; i++) {
        const a = ids[i], b = ids[i + 1];
        if (a === b) continue;
        const [ax, az] = this.nodes[a], [bx, bz] = this.nodes[b];
        const w = Math.hypot(bx - ax, bz - az);
        if (DRIVE.has(r.k)) { this.adj.drive[a].push([b, w]); this.adj.drive[b].push([a, w]); }
        if (!WALK_EXCLUDE.has(r.k)) {
          // les piétons préfèrent les rues calmes et piétonnes
          const pw = w * (r.k === 'pedestrian' || r.k === 'living_street' || r.k === 'footway' ? 0.8 : r.k === 'primary' ? 1.25 : 1);
          this.adj.walk[a].push([b, pw]); this.adj.walk[b].push([a, pw]);
        }
      }
    }
  }

  nearest([x, z], mode) {
    let best = -1, bd = Infinity;
    const adj = this.adj[mode];
    for (let i = 0; i < this.nodes.length; i++) {
      if (!adj[i].length) continue;
      const d = (this.nodes[i][0] - x) ** 2 + (this.nodes[i][1] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /** Chemin [x, z][] de a vers b ; null si introuvable. */
  route(a, b, mode = 'drive') {
    const s = this.nearest(a, mode), t = this.nearest(b, mode);
    if (s < 0 || t < 0) return null;
    const n = this.nodes.length, adj = this.adj[mode];
    const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
    dist[s] = 0;
    const heap = [[0, s]];
    const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [d, u] = pop();
      if (u === t) break;
      if (d > dist[u]) continue;
      for (const [v, w] of adj[u]) if (d + w < dist[v]) { dist[v] = d + w; prev[v] = u; push([dist[v], v]); }
    }
    if (!isFinite(dist[t])) return null;
    const path = [];
    for (let u = t; u >= 0; u = prev[u]) path.push(this.nodes[u]);
    path.reverse();
    return simplify([a, ...path, b]);
  }
}

function simplify(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1.5) continue;
    if (Math.abs(cross) / (Math.hypot(c[0] - a[0], c[1] - a[1]) || 1) < 0.6) continue;
    out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export const ROAD_WIDTH = { trunk: 18, primary: 16, secondary: 13, tertiary: 11, residential: 8, unclassified: 8, living_street: 6, pedestrian: 7, service: 5 };

/* ------------------------------------------------------------------ */
/*  Préparation du plan de ville à partir des données OSM               */
/* ------------------------------------------------------------------ */
const inRects = ([x, z], rects) => rects.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
const centroidOf = (p) => { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; };
const areaOf = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); };

/** Découpe une polyligne en morceaux hors des rectangles exclus. */
function splitOutside(pts, rects) {
  const parts = [];
  let cur = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (inRects(mid, rects)) { if (cur.length > 1) parts.push(cur); cur = []; continue; }
    if (!cur.length) cur.push(a);
    cur.push(b);
  }
  if (cur.length > 1) parts.push(cur);
  return parts;
}

/**
 * Remplace le bâti généré, les rues et les voies du plan par les données OSM,
 * et recale les monuments sur leur emprise réelle (recherche par nom).
 * Renvoie le plan modifié (ou le plan tel quel sans données).
 */
export function applyOsm(plan) {
  const osm = getOsm(plan.id);
  if (!osm) return plan;
  const frame = osmFrame(osm, plan);
  const T = frame.toLocal;
  const R = plan.radius - 6;
  const out = (p) => Math.abs(p[0]) > R || Math.abs(p[1]) > R;
  const excl = [...(plan.reserve || []), ...(plan.modelZone ? [plan.modelZone] : [])];

  const bld = osm.buildings.map((b) => ({ poly: b.p.map(T), h: b.h, n: b.n || '' })).filter((b) => b.poly.length >= 3 && !b.poly.every(out));
  const squares = (osm.squares || []).map((s) => ({ poly: s.p.map(T), n: s.n || '' }));

  // recalage des monuments par nom
  const deltas = {};
  for (const lm of plan.landmarks || []) {
    if (!lm.osm) continue;
    const re = new RegExp(lm.osm, 'i');
    let best = null, bd = 450;
    for (const c of [...bld, ...squares]) {
      if (!re.test(c.n) || c.poly.length < 3) continue;
      const ce = centroidOf(c.poly);
      const d = Math.hypot(ce[0] - lm.at[0], ce[1] - lm.at[1]) - Math.sqrt(areaOf(c.poly)) * 0.2;
      if (d < bd) { bd = d; best = ce; }
    }
    if (best) { deltas[lm.id || lm.type] = [best[0] - lm.at[0], best[1] - lm.at[1]]; lm.at = best; }
  }
  for (const lm of plan.landmarks || []) {
    const d = lm.anchor && deltas[lm.anchor];
    if (d && !lm.osm) { lm.at = [lm.at[0] + d[0], lm.at[1] + d[1]]; deltas[lm.id || lm.type] = d; }
  }
  for (const p of Object.values(plan.pois || {})) {
    const d = p.anchor && deltas[p.anchor];
    if (d) { p.at = [p.at[0] + d[0], p.at[1] + d[1]]; p.delta = d; }
  }

  // surfaces : celles de la maquette + places et parcs réels
  plan.areas = (plan.areas || []).filter((a) => a.model);
  for (const s of squares) if (s.poly.length >= 3 && !inRects(centroidOf(s.poly), excl)) plan.areas.push({ poly: s.poly, kind: 'square', label: s.n || undefined });
  for (const p of osm.parks || []) {
    const poly = p.p.map(T);
    if (poly.length >= 3 && !inRects(centroidOf(poly), excl) && areaOf(poly) > 600) plan.areas.push({ poly, kind: 'park', label: areaOf(poly) > 15000 ? p.n : undefined });
  }

  // rues : rues « maquette » (parvis) + réseau réel hors gare
  const roads = [];
  for (const r of osm.roads) {
    const pts = r.p.map(T);
    for (const part of splitOutside(pts, excl)) if (!part.every(out)) roads.push({ pts: part, k: r.k, n: r.n });
  }
  const modelStreets = (plan.streets || []).filter((s) => s.model);
  plan.streets = [
    ...modelStreets,
    ...roads.map((r) => ({ pts: r.pts, w: ROAD_WIDTH[r.k] || 6, noBuild: true, trees: r.k === 'primary' || r.k === 'secondary' ? 'sparse' : false })),
  ];
  plan.rails = [];
  for (const r of osm.rails) for (const part of splitOutside(r.p.map(T), plan.reserve || [])) plan.rails.push({ pts: part, tracks: 1, single: true });

  plan.osmBuildings = bld;
  plan.graph = new RoadGraph(roads);
  plan.osmDeltas = deltas;
  plan.osm = true;
  plan.osmFrame = frame;
  return plan;
}
