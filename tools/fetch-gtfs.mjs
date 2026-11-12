// Import des horaires théoriques officiels (GTFS, open data transport.data.gouv.fr) :
//   TER Hauts-de-France, Tadao (Béthune, Lens), Ilévia (Lille), Artis (Arras).
// Usage : npm run gtfs [AAAAMMJJ]   (date de référence ; par défaut le prochain jour ouvré)
// Résultat : src/data/gtfs.json — trains au départ de Béthune vers Lens, Arras, Lille-Flandres
// et lignes urbaines desservant chaque quartier de gare (arrêts en mètres Est/Nord depuis
// la gare, comme src/data/osm-*.json, qu'il faut avoir générés avant : npm run osm).
// Zips mis en cache dans scratch/gtfs/ (supprimer le dossier pour forcer le rechargement).
import fs from 'node:fs';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';

const UA = 'holo-trajet-poc/0.1 (+https://github.com/OVZegla/Holo-info)';
const FEEDS = {
  ter: { url: 'https://geocatalogue.hautsdefrance.fr/gtfs/HDF_TER_GTFS_J___90_jours.zip', nom: 'TER Hauts-de-France' },
  tadao: { url: 'https://chouette.enroute.mobi/api/v1/datas/opendata/gtfs.zip', nom: 'Tadao' },
  ilevia: { url: 'https://media.ilevia.fr/opendata/gtfs.zip', nom: 'Ilévia' },
  artis: { url: 'https://static.data.gouv.fr/resources/reseau-de-transport-artis/20260918-084320/gtfs-18-09-26.zip', nom: 'Artis' },
};
// réseau urbain de chaque quartier, nom de la gare dans le GTFS TER, rayon gardé autour de la gare
const CITIES = {
  bethune: { bus: 'tadao', gare: /^b[ée]thune$/i, radius: 1300 },
  lens: { bus: 'tadao', gare: /^lens$/i, radius: 1300 },
  arras: { bus: 'artis', gare: /^arras$/i, radius: 1200 },
  lille: { bus: 'ilevia', gare: /^lille[- ]flandres$/i, radius: 1100 },
};
const ORIGIN = 'bethune';

/* ---------- téléchargement et lecture ---------- */
const CACHE = 'scratch/gtfs';
fs.mkdirSync(CACHE, { recursive: true });

async function load(id) {
  const file = `${CACHE}/${id}.zip`;
  if (!fs.existsSync(file)) {
    console.log('téléchargement', FEEDS[id].nom, '…');
    const r = await fetch(FEEDS[id].url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(600000) });
    if (!r.ok) throw new Error(`${id} : HTTP ${r.status}`);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  // extraction par l'outil système (tar de Windows 10/11 et macOS, sinon unzip) : gère le ZIP64
  const dir = `${CACHE}/${id}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    try { execFileSync('tar', ['-xf', file, '-C', dir]); } catch { execFileSync('unzip', ['-q', '-o', file, '-d', dir]); }
  }
  const find = (name) => {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
    return walk(dir).find((f) => f.split('/').pop() === name);
  };
  const get = (name) => { const f = find(name); return f ? parseCsv(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')) : []; };
  // lecture ligne à ligne (stop_times.txt peut dépasser plusieurs centaines de Mo)
  const each = async (name, fn) => {
    const f = find(name);
    if (!f) return;
    let head = null;
    for await (const line of readline.createInterface({ input: fs.createReadStream(f, 'utf8'), crlfDelay: Infinity })) {
      if (!line) continue;
      const cells = line.includes('"') ? parseCsvLine(line) : line.split(',');
      if (!head) { head = cells.map((h) => h.replace(/^﻿/, '').trim()); continue; }
      fn(Object.fromEntries(head.map((h, i) => [h, (cells[i] ?? '').trim()])));
    }
  };
  return { get, each };
}

function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(txt) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) {
      if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.length > 1 || row[0]) rows.push(row); row = []; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

/** service_id actifs à la date (calendar + calendar_dates). */
function activeServices(feed, date) {
  const dow = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T12:00:00Z`).getUTCDay()];
  const on = new Set();
  for (const c of feed.get('calendar.txt')) if (c[dow] === '1' && c.start_date <= date && c.end_date >= date) on.add(c.service_id);
  for (const c of feed.get('calendar_dates.txt')) {
    if (c.date !== date) continue;
    if (c.exception_type === '1') on.add(c.service_id); else on.delete(c.service_id);
  }
  return on;
}

/* ---------- date de référence ---------- */
let date = process.argv[2];
if (!date) {
  const d = new Date();
  do d.setUTCDate(d.getUTCDate() + 1); while ([0, 6].includes(d.getUTCDay()));
  date = ymd(d);
}
console.log('date de référence', date);

const osm = Object.fromEntries(Object.keys(CITIES).map((id) => {
  const f = `src/data/osm-${id}.json`;
  if (!fs.existsSync(f)) throw new Error(`${f} absent : lancer d'abord npm run osm`);
  return [id, JSON.parse(fs.readFileSync(f)).station];
}));
const toEN = (id, lat, lon) => {
  const { lat: lat0, lon: lon0 } = osm[id];
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  return [Math.round((lon - lon0) * kx), Math.round((lat - lat0) * ky)];
};

const out = { date, generated: new Date().toISOString(), sources: Object.values(FEEDS).map((f) => f.nom), trains: {}, bus: {} };

/* ---------- trains au départ de Béthune ---------- */
{
  const ter = await load('ter');
  const stops = ter.get('stops.txt');
  const byId = new Map(stops.map((s) => [s.stop_id, s]));
  const parentName = (id) => { const s = byId.get(id); return s ? (s.parent_station && byId.get(s.parent_station)?.stop_name) || s.stop_name : ''; };
  const cityOfStop = new Map();
  for (const s of stops) for (const [cid, c] of Object.entries(CITIES)) if (c.gare.test(s.stop_name)) cityOfStop.set(s.stop_id, cid);
  for (const s of stops) if (s.parent_station && cityOfStop.has(s.parent_station)) cityOfStop.set(s.stop_id, cityOfStop.get(s.parent_station));
  const on = activeServices(ter, date);
  const trips = new Map(ter.get('trips.txt').filter((t) => on.has(t.service_id)).map((t) => [t.trip_id, t]));
  const seq = new Map();
  await ter.each('stop_times.txt', (st) => {
    if (!trips.has(st.trip_id)) return;
    let a = seq.get(st.trip_id); if (!a) seq.set(st.trip_id, (a = []));
    a.push(st);
  });
  for (const id of Object.keys(CITIES)) if (id !== ORIGIN) out.trains[id] = [];
  for (const [tid, a] of seq) {
    a.sort((x, y) => +x.stop_sequence - +y.stop_sequence);
    const i0 = a.findIndex((s) => cityOfStop.get(s.stop_id) === ORIGIN);
    if (i0 < 0) continue;
    const t = trips.get(tid);
    for (let j = i0 + 1; j < a.length; j++) {
      const cid = cityOfStop.get(a[j].stop_id);
      if (!cid || cid === ORIGIN || !out.trains[cid]) continue;
      out.trains[cid].push({
        dep: a[i0].departure_time.slice(0, 5), arr: a[j].arrival_time.slice(0, 5),
        num: t.trip_short_name || t.trip_headsign || tid, dir: parentName(a[a.length - 1].stop_id),
        stops: a.slice(i0 + 1, j).map((s) => [parentName(s.stop_id), s.departure_time.slice(0, 5)]),
      });
    }
  }
  // coordonnées des gares citées (carte régionale du trajet en train)
  out.stations = {};
  for (const s of stops) {
    const n = parentName(s.stop_id);
    if (!s.stop_lat || out.stations[n]) continue;
    out.stations[n] = [+(+s.stop_lat).toFixed(5), +(+s.stop_lon).toFixed(5)];
  }
  const used = new Set(Object.values(out.trains).flat().flatMap((t) => [t.dir, ...t.stops.map((s) => s[0])]));
  for (const n of Object.keys(out.stations)) if (!used.has(n)) delete out.stations[n];
  for (const [cid, l] of Object.entries(out.trains)) {
    l.sort((x, y) => toMin(x.dep) - toMin(y.dep));
    // un même train peut figurer deux fois (sens, variantes) : on dédoublonne
    out.trains[cid] = l.filter((x, i) => !i || x.dep !== l[i - 1].dep || x.num !== l[i - 1].num);
    console.log('trains Béthune →', cid, out.trains[cid].length);
  }
}

/* ---------- lignes urbaines autour de chaque gare ---------- */
const feeds = {};
for (const [cid, c] of Object.entries(CITIES)) {
  const feed = (feeds[c.bus] ??= await load(c.bus));
  const stops = feed.get('stops.txt').filter((s) => s.stop_lat && (s.location_type || '0') === '0');
  const keep = new Map();
  for (const s of stops) {
    const p = toEN(cid, +s.stop_lat, +s.stop_lon);
    if (Math.hypot(p[0], p[1]) <= c.radius) keep.set(s.stop_id, { n: s.stop_name, p });
  }
  const on = activeServices(feed, date);
  const trips = new Map(feed.get('trips.txt').filter((t) => on.has(t.service_id)).map((t) => [t.trip_id, t]));
  const seqs = new Map();
  await feed.each('stop_times.txt', (st) => {
    if (!trips.has(st.trip_id) || !keep.has(st.stop_id)) return;
    let a = seqs.get(st.trip_id); if (!a) seqs.set(st.trip_id, (a = []));
    a.push({ stop_id: st.stop_id, stop_sequence: st.stop_sequence, departure_time: st.departure_time, arrival_time: st.arrival_time });
  });
  const routes = new Map(feed.get('routes.txt').map((r) => [r.route_id, r]));
  const stopIdx = new Map(), stopList = [], routeOut = {}, tripOut = [];
  const si = (id) => { if (!stopIdx.has(id)) { stopIdx.set(id, stopList.length); stopList.push(keep.get(id)); } return stopIdx.get(id); };
  for (const [tid, a] of seqs) {
    if (a.length < 2) continue;
    a.sort((x, y) => +x.stop_sequence - +y.stop_sequence);
    const t = trips.get(tid), r = routes.get(t.route_id);
    if (!r) continue;
    routeOut[t.route_id] ??= { s: r.route_short_name || r.route_long_name, l: r.route_long_name, c: r.route_color ? '#' + r.route_color : null, m: +r.route_type };
    tripOut.push({ r: t.route_id, h: t.trip_headsign || '', st: a.map((s) => [si(s.stop_id), toMin(s.departure_time || s.arrival_time)]) });
  }
  tripOut.sort((x, y) => x.st[0][1] - y.st[0][1]);
  out.bus[cid] = { net: FEEDS[c.bus].nom, stops: stopList, routes: routeOut, trips: tripOut };
  console.log('bus', cid, FEEDS[c.bus].nom, stopList.length, 'arrêts,', Object.keys(routeOut).length, 'lignes,', tripOut.length, 'courses');
}

fs.writeFileSync('src/data/gtfs.json', JSON.stringify(out));
console.log('src/data/gtfs.json', Math.round(fs.statSync('src/data/gtfs.json').size / 1024), 'Ko');
