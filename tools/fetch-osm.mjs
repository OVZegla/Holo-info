// Import des emprises de bâtiments et des rues réelles (OpenStreetMap, via Overpass)
// autour des 4 gares. Usage : npm run osm   (nécessite un accès à overpass-api.de)
// Résultat : src/data/osm-<ville>.json (coordonnées en mètres Est/Nord depuis la gare).
// Données © contributeurs OpenStreetMap, licence ODbL.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// curl respecte le proxy HTTPS de l'environnement (contrairement à fetch() de Node)
const ENDPOINTS = (process.env.OVERPASS || 'https://overpass.kumi.systems/api/interpreter,https://overpass-api.de/api/interpreter').split(',');
const CITIES = {
  bethune: { name: 'Béthune', bbox: [50.50, 2.60, 50.55, 2.68], radius: 950 },
  lens: { name: 'Lens', bbox: [50.41, 2.80, 50.45, 2.86], radius: 1000 },
  arras: { name: 'Arras', bbox: [50.27, 2.75, 50.31, 2.81], radius: 850 },
  lille: { name: 'Lille Flandres', bbox: [50.62, 3.05, 50.65, 3.09], radius: 800 },
};

async function overpass(q) {
  let last;
  for (const url of ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = execFileSync('curl', ['-sS', '--fail', '-m', '300', '-A', 'holo-trajet-poc', '--data-urlencode', 'data=' + q, url], { maxBuffer: 512 * 1024 * 1024 });
        return JSON.parse(out.toString());
      } catch (e) { last = e; console.error('échec', url, String(e.message).slice(0, 120)); execFileSync('sleep', ['5']); }
    }
  }
  throw last;
}

const only = process.argv[2];
fs.mkdirSync('src/data', { recursive: true });
for (const [id, c] of Object.entries(CITIES)) {
  if (only && only !== id) continue;
  const [s, w, n, e] = c.bbox;
  const st = await overpass(`[out:json][timeout:60];(node["railway"="station"]["name"~"^${c.name}"](${s},${w},${n},${e});way["railway"="station"]["name"~"^${c.name}"](${s},${w},${n},${e}););out center;`);
  const el = st.elements[0];
  if (!el) { console.error('gare introuvable', id); continue; }
  const lat0 = el.lat ?? el.center.lat, lon0 = el.lon ?? el.center.lon;
  const R = c.radius;
  const data = await overpass(`[out:json][timeout:120];(
    way["building"](around:${R},${lat0},${lon0});
    way["highway"~"^(primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|service|trunk)$"](around:${R},${lat0},${lon0});
    way["railway"="rail"](around:${R},${lat0},${lon0});
    way["leisure"="park"](around:${R},${lat0},${lon0});
    way["place"="square"](around:${R},${lat0},${lon0});
  );out geom tags;`);
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  const P = (g) => [Math.round((g.lon - lon0) * kx * 10) / 10, Math.round((g.lat - lat0) * ky * 10) / 10];
  const out = { station: { lat: lat0, lon: lon0 }, buildings: [], roads: [], rails: [], parks: [], squares: [] };
  for (const w2 of data.elements) {
    if (!w2.geometry) continue;
    const pts = w2.geometry.map(P);
    const t = w2.tags || {};
    if (t.building) {
      const h = t.height ? parseFloat(t.height) : t['building:levels'] ? parseFloat(t['building:levels']) * 3.2 + 1 : null;
      out.buildings.push({ p: pts, h, n: t.name || undefined });
    } else if (t.highway) out.roads.push({ p: pts, k: t.highway, n: t.name || undefined });
    else if (t.railway) out.rails.push({ p: pts });
    else if (t.leisure) out.parks.push({ p: pts, n: t.name || undefined });
    else if (t.place) out.squares.push({ p: pts, n: t.name || undefined });
  }
  fs.writeFileSync(`src/data/osm-${id}.json`, JSON.stringify(out));
  console.log(id, out.buildings.length, 'bâtiments,', out.roads.length, 'voies');
}
