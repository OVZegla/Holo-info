import { makeFrame } from './city.js';

/*
 * PLANS DES QUARTIERS DE GARE
 * ---------------------------------------------------------------------------
 * Coordonnées en mètres dans le repère local de la maquette :
 *   origine = centre de la façade de la gare ramené en z = 20,
 *   +z = vers la ville (devant la façade), x = parallèle à la façade.
 * Les monuments repères sont positionnés à partir de leur situation réelle
 * (direction et distance depuis la gare) via geo([Est, Nord]).
 * Les rues secondaires et le bâti courant sont générés : ils évoquent le
 * tissu urbain sans le reproduire exactement.
 *
 * Emplacements (pois) utilisés par les scénarios (voir data/scenarios.js) :
 *   'arret-bus', 'depose-minute', et les lieux d'arrivée.
 */

const deg = (d) => (d * Math.PI) / 180;

function rect(cx, cz, ux, uz, len, wid) {
  const l = Math.hypot(ux, uz); ux /= l; uz /= l;
  const nx = -uz, nz = ux;
  return [
    [cx - ux * len / 2 - nx * wid / 2, cz - uz * len / 2 - nz * wid / 2],
    [cx + ux * len / 2 - nx * wid / 2, cz + uz * len / 2 - nz * wid / 2],
    [cx + ux * len / 2 + nx * wid / 2, cz + uz * len / 2 + nz * wid / 2],
    [cx - ux * len / 2 + nx * wid / 2, cz - uz * len / 2 + nz * wid / 2],
  ];
}

/** Rues en grille légèrement tournée, dans une emprise donnée. */
function grid({ x0, x1, z0, z1, step = 90, stepZ = null, angle = 0, w = 10, skip = () => false, jitter = 0 }) {
  const out = [];
  const c = Math.cos(deg(angle)), s = Math.sin(deg(angle));
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const rot = ([x, z]) => [cx + (x - cx) * c - (z - cz) * s, cz + (x - cx) * s + (z - cz) * c];
  let i = 0;
  for (let x = x0; x <= x1 + 0.1; x += step) {
    const xx = x + (jitter ? ((i++ * 37) % 11) - 5 : 0);
    const seg = [rot([xx, z0]), rot([xx, z1])];
    if (!skip(seg)) out.push({ pts: seg, w });
  }
  for (let z = z0; z <= z1 + 0.1; z += stepZ || step) {
    const seg = [rot([x0, z]), rot([x1, z])];
    if (!skip(seg)) out.push({ pts: seg, w });
  }
  return out;
}

const insideRect = (r) => ([a, b]) => {
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return mid[0] > r[0] && mid[0] < r[2] && mid[1] > r[1] && mid[1] < r[3];
};

/* ======================================================================== */
/*  BÉTHUNE — façade orientée vers le nord (centre-ville)                    */
/* ======================================================================== */
function bethune() {
  const F = makeFrame(10);
  const geo = F.toLocal;
  const beff = geo([-40, 780]);
  const stationZone = [-95, -30, 95, 26];
  return {
    id: 'bethune', radius: 900, seed: 11, local: true, facadeBearing: 10, modelZone: [-160, -45, 160, 62],
    heights: { min: 7, max: 15, center: beff, falloff: 900, gable: 0.55, wMin: 6, wMax: 13, dMin: 9, dMax: 14 },
    areas: [
      { poly: rect(0, 32, 1, 0, 120, 22), kind: 'square', model: true },
      { poly: rect(beff[0], beff[1], 0.985, -0.174, 150, 95), kind: 'square', label: 'Grand’Place' },
      { poly: rect(-260, 380, 1, 0.3, 160, 110), kind: 'park' },
    ],
    streets: [
      { pts: [[-150, 48], [150, 48]], w: 16, trees: true, model: true },
      { pts: [[-700, 48], [-150, 48]], w: 16, trees: true },
      { pts: [[150, 48], [700, 48]], w: 16, trees: true },
      { pts: [[0, 48], [30, 260], [110, 520], [beff[0] - 20, beff[1] - 60]], w: 16, trees: true, label: 'Vers le centre-ville' },
      { pts: [[-180, 48], [-200, 300], [-160, 640]], w: 12 },
      { pts: [[220, 48], [240, 300], [300, 640]], w: 12 },
      { pts: [[-700, -80], [700, -80]], w: 12, noBuild: false },
      ...grid({ x0: -640, x1: 640, z0: 120, z1: 860, step: 95, stepZ: 85, angle: 6, w: 9, skip: insideRect([beff[0] - 90, beff[1] - 60, beff[0] + 90, beff[1] + 60]) }),
      ...grid({ x0: -640, x1: 640, z0: -380, z1: -140, step: 110, stepZ: 90, angle: -4, w: 9 }),
    ],
    rails: [],
    landmarks: [
      { type: 'beffroiBethune', at: beff, rot: 10, label: 'Beffroi de Béthune', id: 'beffroi', osm: 'beffroi' },
      { type: 'placeArras', at: beff, rot: 10 + 90, params: { w: 150, d: 95, seed: 21, skipSides: [] }, id: 'grandplace', anchor: 'beffroi' },
    ],
    reserve: [stationZone],
    pois: {},
  };
}

/* ======================================================================== */
/*  LENS — façade vers le sud-est (centre), voies est-ouest                  */
/* ======================================================================== */
function lens() {
  const F = makeFrame(160);
  const geo = F.toLocal;
  const stade = geo([-880, 420]);
  const pavillon = [stade[0] + 110, stade[1] + 120];
  return {
    id: 'lens', radius: 950, seed: 23, local: true, facadeBearing: 160, modelZone: [-160, -45, 160, 62],
    heights: { min: 6, max: 14, center: [60, 380], falloff: 800, gable: 0.7, wMin: 6, wMax: 12, dMin: 8, dMax: 13 },
    areas: [
      { poly: rect(-10, 33, 1, 0, 120, 26), kind: 'square', model: true },
      { poly: rect(stade[0], stade[1], 1, 0.35, 230, 190), kind: 'square' },
      { poly: rect(250, 300, 1, 0.1, 140, 90), kind: 'park' },
      { poly: rect(stade[0] + 260, stade[1] - 40, 0.4, 1, 240, 120), kind: 'park' },
    ],
    streets: [
      { pts: [[-150, 48], [150, 48]], w: 16, trees: true, model: true },
      { pts: [[-950, 48], [-150, 48]], w: 16, trees: true },
      { pts: [[150, 48], [950, 48]], w: 16, trees: true },
      { pts: [[-10, 48], [10, 220], [60, 420], [90, 700]], w: 16, trees: true },
      { pts: [[-300, 48], [-335, -60], [-420, -250], [-560, -470], [stade[0] + 70, stade[1] + 160], [stade[0] - 60, stade[1] + 260]], w: 15, trees: true },
      { pts: [[-900, -60], [500, -60]], w: 12 },
      { pts: [[stade[0] + 150, stade[1] + 40], [stade[0] + 170, stade[1] - 200]], w: 12 },
      ...grid({ x0: -700, x1: 760, z0: 110, z1: 900, step: 95, stepZ: 80, angle: -8, w: 9, jitter: true }),
      ...grid({ x0: -900, x1: 600, z0: -880, z1: -140, step: 110, stepZ: 70, angle: 20, w: 8, skip: insideRect([stade[0] - 160, stade[1] - 140, stade[0] + 160, stade[1] + 140]) }),
    ],
    landmarks: [
      { type: 'stadeBollaert', at: stade, rot: 20, label: 'Stade Bollaert-Delelis', id: 'stade', osm: '^stade.*bollaert' },
      { type: 'pavillon', at: pavillon, rot: 200, params: { w: 34, d: 24, h: 10, name: 'Pavillon des Rencontres' }, id: 'bollaert-dest', anchor: 'stade' },
    ],
    reserve: [[-95, -30, 95, 26]],
    pois: {
      'arret-bus': { at: [-38, 37.5], rot: 180, label: 'Arrêt de bus' },
      'depose-minute': { at: [34, 37.5], rot: 180, label: 'Dépose-minute' },
      bollaert: { at: [pavillon[0] - 10, pavillon[1] - 20], building: 'bollaert-dest', anchor: 'stade', label: 'Pavillon des Rencontres' },
    },
    routes: {
      // circulation à droite : les véhicules vers -x roulent côté gare (z ≈ 44)
      'voiture:arrivee': [[300, 44], [34, 44]],
      'voiture:bollaert': [[34, 44], [-290, 44], [-325, -60], [-410, -250], [-550, -470], [stade[0] + 75, stade[1] + 152], [pavillon[0] - 22, pavillon[1] - 30]],
      'bus:arrivee': [[300, 44], [-38, 44]],
      'bus:bollaert': [[-38, 44], [-290, 44], [-325, -60], [-410, -250], [-550, -470], [stade[0] + 75, stade[1] + 152], [pavillon[0] - 30, pavillon[1] - 40]],
    },
    walks: {
      // gare → point de correspondance (sur le parvis)
      'depose-minute': [[0, 24], [20, 30], [34, 36]],
      'arret-bus': [[0, 24], [-20, 30], [-38, 36]],
      'bollaert:voiture': [[pavillon[0] - 18, pavillon[1] - 26], [pavillon[0] - 6, pavillon[1] - 13]],
      'bollaert:bus': [[pavillon[0] - 28, pavillon[1] - 36], [pavillon[0] - 6, pavillon[1] - 13]],
    },
  };
}

/* ======================================================================== */
/*  ARRAS — façade vers l'ouest (place Foch), voies nord-sud                 */
/* ======================================================================== */
function arras() {
  const heros = [-426, 477];
  const uEW = [-0.342, -0.94]; // axe est-ouest dans le repère local
  const vNS = [-0.94, 0.342];
  const beff = [heros[0] + 0.342 * 56, heros[1] + 0.94 * 56];
  const grand = [-505, 645];
  const cath = [-200, 590];
  const dest = [heros[0] - vNS[0] * 22 + uEW[0] * 18, heros[1] - vNS[1] * 22 + uEW[1] * 18];
  return {
    id: 'arras', radius: 820, seed: 31, local: true, facadeBearing: 290, modelZone: [-160, -45, 160, 62],
    heights: { min: 8, max: 16, center: heros, falloff: 700, gable: 0.5, wMin: 6, wMax: 13, dMin: 10, dMax: 15 },
    areas: [
      { poly: rect(0, 70, 1, 0, 150, 90), kind: 'square', label: 'Place du Maréchal-Foch', model: true },
      { poly: rect(heros[0], heros[1], uEW[0], uEW[1], 112, 64), kind: 'square', label: 'Place des Héros' },
      { poly: rect(grand[0], grand[1], uEW[0], uEW[1], 190, 118), kind: 'square', label: 'Grand’Place' },
      { poly: rect(120, 320, 1, 0.2, 180, 120), kind: 'park' },
    ],
    streets: [
      { pts: [[-800, 122], [800, 122]], w: 14, trees: true },
      { pts: [[-60, 120], [-150, 250], [-280, 370], [-372, 432]], w: 13, trees: true, label: 'Rue Gambetta' },
      { pts: [[-80, 24], [-80, 122]], w: 12, model: true },
      { pts: [[80, 24], [80, 122]], w: 12, model: true },
      { pts: [[-150, 122], [150, 122]], w: 14, model: true },
      { pts: [[heros[0] + vNS[0] * 45, heros[1] + vNS[1] * 45], [grand[0] - vNS[0] * 70, grand[1] - vNS[1] * 70]], w: 10, label: 'Rue de la Taillerie' },
      { pts: [[-372, 432], [cath[0] - 20, cath[1] - 80]], w: 11 },
      ...grid({ x0: -760, x1: 600, z0: 160, z1: 800, step: 85, stepZ: 75, angle: 22, w: 9, skip: (seg) => [heros, grand, cath].some((c) => segNear(seg, c, c === grand ? 115 : 75)) }),
      ...grid({ x0: -700, x1: 700, z0: -760, z1: -120, step: 120, stepZ: 90, angle: -3, w: 9 }),
    ],
    landmarks: [
      { type: 'beffroiArras', at: beff, rot: 110 + 90, label: 'Beffroi d’Arras', id: 'beffroi', osm: 'beffroi' },
      { type: 'hotelDeVilleArras', at: [beff[0] + 0.94 * -2 + 0.342 * 8, beff[1] + 0.94 * 8], rot: 110 + 90, anchor: 'beffroi' },
      { type: 'placeArras', at: heros, rot: 110, params: { w: 112, d: 64, seed: 7, skipSides: ['w'] }, id: 'heros', osm: 'h[ée]ros' },
      { type: 'placeArras', at: grand, rot: 110, params: { w: 190, d: 118, seed: 13 }, id: 'grand', osm: '^grand.?place', osmMax: 450 }, // position estimée ≈ 330 m à côté du réel
      { type: 'cathedraleArras', at: cath, rot: 110 - 90, label: 'Cathédrale', id: 'cathedrale', osm: 'cath[ée]drale' },
    ],
    reserve: [[-95, -30, 95, 26]],
    pois: {
      heros: { at: dest, label: 'Atelier des Arcades', highlightRow: true, anchor: 'heros' },
    },
    routes: {},
    walks: {
      'heros:marche': [[0, 24], [-20, 60], [-58, 112], [-62, 124], [-150, 250], [-280, 370], [-372, 432], [heros[0] + 40, heros[1] - 2], [dest[0] + 8, dest[1] - 4], dest],
    },
  };
}

function segNear([a, b], c, r) {
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dz) / l2));
  void mid;
  return Math.hypot(a[0] + dx * t - c[0], a[1] + dz * t - c[1]) < r;
}

/* ======================================================================== */
/*  LILLE — gare en cul-de-sac, façade vers l'ouest-nord-ouest (rue Faidherbe) */
/* ======================================================================== */
function lille() {
  const F = makeFrame(297);
  const geo = F.toLocal;
  const opera = geo([-333, 167]);           // ≈ (2, 393)
  const cci = geo([-354, 78]);              // Chambre de commerce
  const bourse = geo([-468, 56]);
  const grandPlace = geo([-531, 22]);
  const hdv = geo([-14, -601]);             // Hôtel de Ville et beffroi
  const europe = geo([390, 311]);           // Lille-Europe
  const skiboot = geo([460, 233]);
  const lilleurope = geo([305, 178]);
  const euralilleC = geo([250, 80]);
  const matisse = geo([480, 500]);
  const stMaurice = geo([-213, -78]);
  const horizon = [-655, -330];
  const theatre = [56, 420];
  const lgvDir = [0.743, -0.669];
  const GY = -1.2;
  return {
    id: 'lille', radius: 760, seed: 41, local: true, groundY: GY, facadeBearing: 297, kind: 'terminus', osmNodeZ: 10, modelZone: [-130, 18, 160, 62],
    heights: { min: 12, max: 24, center: [80, 420], falloff: 900, gable: 0.05, mansard: 0.5, wMin: 8, wMax: 18, dMin: 11, dMax: 17 },
    areas: [
      { poly: rect(0, 32, 1, 0, 140, 26), kind: 'square', label: 'Place de la Gare', model: true },
      { poly: rect(theatre[0], theatre[1], 1, 0.1, 90, 56), kind: 'square', label: 'Place du Théâtre' },
      { poly: rect(grandPlace[0], grandPlace[1], 1, -0.2, 120, 84), kind: 'square', label: 'Grand’Place' },
      { poly: rect(matisse[0], matisse[1], 0.5, 1, 300, 200), kind: 'park', label: 'Parc Henri-Matisse' },
      { poly: rect(-400, -40, 1, 0.3, 90, 60), kind: 'park' },
    ],
    streets: [
      { pts: [[-110, 44], [140, 44]], w: 16, trees: false, model: true },
      { pts: [[0, 52], [0, 372]], w: 18, trees: true, label: 'Rue Faidherbe' },
      { pts: [[-110, 44], [-160, -30], [-250, -100], [-420, -150]], w: 20, trees: true, label: 'Avenue Le Corbusier' },
      { pts: [[-420, -150], [-520, -205], [-600, -262], [-690, -330]], w: 18, trees: true, label: 'Boulevard de Turin' },
      { pts: [[-250, -100], [-270, -420]], w: 16, label: 'Avenue Willy-Brandt' },
      { pts: [[64, 40], [64, -420]], w: 12, label: 'Rue de Tournai', oneSide: 1 },
      { pts: [[140, 44], [260, 0], [400, -90], [hdv[0] - 40, hdv[1] + 50]], w: 14 },
      { pts: [[140, 44], [300, 120], [grandPlace[0] + 40, grandPlace[1] - 60]], w: 12 },
      { pts: [[-110, 44], [-200, 120], [-260, 300]], w: 12 },
      ...grid({ x0: -420, x1: 520, z0: 110, z1: 720, step: 82, stepZ: 78, angle: 8, w: 9, jitter: true, skip: (s) => segNear(s, theatre, 50) || segNear(s, grandPlace, 70) || segNear(s, [0, 200], 30) }),
      ...grid({ x0: 120, x1: 720, z0: -680, z1: -40, step: 85, stepZ: 80, angle: -20, w: 10, skip: (s) => segNear(s, hdv, 50) }),
      ...grid({ x0: -720, x1: -320, z0: -700, z1: -420, step: 90, w: 10 }),
    ],
    rails: [
      { pts: [[europe[0] - lgvDir[0] * 330, europe[1] - lgvDir[1] * 330], [europe[0] + lgvDir[0] * 280, europe[1] + lgvDir[1] * 280]], tracks: 4 },
    ],
    landmarks: [
      { type: 'operaLille', at: [opera[0], opera[1] + 30], rot: 180, label: 'Opéra', id: 'opera', osm: 'op[ée]ra' },
      { type: 'beffroiCCI', at: [cci[0] + 10, cci[1] + 40], rot: 270, label: 'Beffroi de la Chambre de commerce', id: 'cci', osm: 'chambre de commerce|nouvelle bourse' },
      { type: 'vieilleBourse', at: bourse, rot: 180, label: 'Vieille Bourse', id: 'bourse', osm: 'vieille bourse' },
      { type: 'colonneDeesse', at: grandPlace, rot: 0, id: 'deesse', osm: '^grand.?place$|g[ée]n[ée]ral.de.gaulle' },
      { type: 'beffroiLille', at: hdv, rot: 297 - 180 - 90, label: 'Beffroi de l’Hôtel de Ville', id: 'hdv', osm: 'h[ôo]tel de ville' },
      { type: 'saintMaurice', at: stMaurice, rot: 270, label: 'Église Saint-Maurice', id: 'stmaurice', osm: 'saint-maurice' },
      { type: 'lilleEurope', at: europe, rot: Math.atan2(lgvDir[0], lgvDir[1]) * 180 / Math.PI, label: 'Gare Lille-Europe', id: 'europe', osm: '^(gare (de )?)?lille[- ]europe$' },
      { type: 'tourDeLille', at: [skiboot[0] + 40, skiboot[1] - 30], rot: 40, label: 'Tour de Lille', id: 'skiboot', osm: 'tour de lille|lyonnais' },
      { type: 'tourLilleurope', at: [lilleurope[0] + 30, lilleurope[1] + 40], rot: 30, label: 'Tour Lilleurope', id: 'lilleurope', osm: 'lilleurope' },
      { type: 'euralille', at: [euralilleC[0] - 20, euralilleC[1] - 40], rot: 60, label: 'Euralille', id: 'euralille', osm: '^euralille' },
      { type: 'espaceHorizon', at: horizon, rot: 55, id: 'horizon-bldg' },
    ],
    reserve: [[-48, -900, 48, 22], [-12, 20, 12, 25], [-36, 20, -24, 35]],
    noBuild: [[-150, 20, 210, 72]], // jusqu'à x = 210 : entrée des véhicules sur le parvis
    pois: {
      'arret-bus': { at: [-50, 36.6], rot: 180, label: 'Arrêt de bus' },
      'depose-minute': { at: [42, 36.6], rot: 180, label: 'Dépose-minute' },
      horizon: { at: [horizon[0] + 30, horizon[1] + 38], building: 'horizon-bldg', label: 'Espace Horizon' },
      theatre: { at: [theatre[0] + 28, theatre[1] + 6], label: 'Maison des Beffrois', anchor: 'opera' },
    },
    routes: {
      'bus:arrivee': [[180, 40], [-50, 40]],
      'bus:horizon': [[-50, 40], [-108, 40], [-160, -30], [-250, -100], [-420, -150], [-520, -205], [-590, -255]],
      'voiture:arrivee': [[200, 40], [42, 40]],
      'voiture:horizon': [[42, 40], [-108, 40], [-160, -30], [-250, -100], [-420, -150], [-520, -205], [-610, -270], [horizon[0] + 46, horizon[1] + 46]],
    },
    walks: {
      'arret-bus': [[0, 24], [-30, 30], [-50, 34.5]],
      'depose-minute': [[0, 24], [26, 30], [42, 34.5]],
      'arret-bus:sf': [[-30, 34.5], [-40, 34.5], [-50, 34.5]],
      'depose-minute:sf': [[-30, 34.5], [0, 33], [26, 33], [42, 34.5]],
      'horizon:bus': [[-590, -262], [-600, -280], [horizon[0] + 30, horizon[1] + 38]],
      'horizon:voiture': [[horizon[0] + 46, horizon[1] + 40], [horizon[0] + 30, horizon[1] + 38]],
      'theatre:marche': [[0, 24], [-6, 34], [-6, 52], [-6, 200], [-6, 372], [theatre[0] - 20, theatre[1] - 16], [theatre[0] + 28, theatre[1] + 6]],
      'theatre:marche:sf': [[-30, 34.5], [-12, 36], [-6, 52], [-6, 200], [-6, 372], [theatre[0] - 20, theatre[1] - 16], [theatre[0] + 28, theatre[1] + 6]],
    },
  };
}

export const CITY_PLANS = { bethune, lens, arras, lille };
