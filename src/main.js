import * as THREE from 'three';
import './styles.css';
import { Engine } from './core/engine.js';
import { getWorld, releaseWorlds } from './journey/worlds.js';
import { stageDeparture, stageTrain, stageArrival, stageDestination } from './journey/stages.js';
import { computeTrip } from './journey/trip.js';
import { toMin, fmt, fmtDur } from './journey/time.js';
import { setupSettings } from './ui/settings.js';
import { hasOsm } from './scenes/osm.js';
import { searchPlaces, norm } from './journey/places.js';
import { planTo, injectCustom, restoreWorld, hasGtfs } from './journey/planner.js';
import { speak, stopSpeaking, listen, canListen, canSpeak, setVoiceEnabled, voiceEnabled } from './ui/voice.js';
import { mountKeyboard } from './ui/keyboard.js';

/* ------------------------------------------------------------------ */
/*  Données & réglages                                                  */
/* ------------------------------------------------------------------ */
const DATA = window.HOLO_DONNEES;
const DEFAULTS = {
  contraste: 1, exposition: 1, ombres: 0.55, douceurOmbres: 5, opaciteVitrages: 0.28, opaciteMasques: 0.12,
  contours: 0.55, brume: 0.6, vitesse: 1, qualite: 'haute', inactiviteSecondes: 120, ...(window.HOLO_REGLAGES || {}),
};
let settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem('holo-reglages') || '{}')); } catch { /* stockage indisponible */ }

const $ = (s) => document.querySelector(s);
// licence ODbL : mention obligatoire dès que le bâti et les rues réels sont affichés
if (hasOsm()) {
  $('#disclaimer').firstChild.textContent = 'Démonstration — horaires et lieux d’arrivée fictifs';
  $('#osm-credit').textContent = 'plan © contributeurs OpenStreetMap';
}
const engine = new Engine($('#stage'), $('#labels'), settings);

/* ------------------------------------------------------------------ */
/*  État                                                               */
/* ------------------------------------------------------------------ */
// custom : trajet calculé vers un lieu cherché librement ({ place, dest, local })
const sel = { cityId: null, destId: null, legIdx: 0, stepFree: false, custom: null };
const FACTORIES = [stageDeparture, stageTrain, stageArrival, stageDestination];
const player = { ctx: null, stage: null, idx: -1, t: 0, playing: false, overview: false, cueIdx: -1, labels: [], ended: false, worldId: null, busy: false, factories: FACTORIES, worlds: [] };
let screen = 'home';
let lastInput = performance.now();

const cityOf = (id) => DATA.villes.find((c) => c.id === id)
  || (DATA.gares[id] && { id, nom: DATA.gares[id].nom, accroche: DATA.gares[id].nomComplet, destinations: [] });
const destOf = () => sel.custom ? sel.custom.dest : cityOf(sel.cityId)?.destinations.find((d) => d.id === sel.destId);
const legOf = () => destOf()?.correspondances[sel.legIdx];

/* ------------------------------------------------------------------ */
/*  Écrans                                                             */
/* ------------------------------------------------------------------ */
function show(name) {
  screen = name;
  for (const id of ['screen-home', 'screen-summary', 'hud', 'screen-end']) $('#' + id).classList.toggle('active', id === (name === 'journey' ? 'hud' : 'screen-' + name));
  if (name === 'end') $('#hud').classList.add('active');
  document.body.dataset.screen = name;
}

const MODE_LABEL = { bus: 'Bus', voiture: 'Voiture', marche: 'À pied' };
const MODE_SUB = (l) => l.mode === 'bus' ? `Ligne ${l.ligne} · ${l.depart}` : l.mode === 'voiture' ? `Prise en charge · ${l.depart}` : `${Math.round(toMin(l.arrivee) - toMin(l.depart))} min de marche`;
const legEnd = (l) => fmt(toMin(l.arrivee) + (l.marcheFinale || 0));
const legLabel = (l) => (l.mode === 'bus'
  ? (norm(l.ligne) === norm(l.vehicule) ? l.vehicule : `${l.vehicule || 'Bus'} ${l.ligne}`)
  : MODE_LABEL[l.mode]);
const CUSTOM_SUB = (l) => l.mode === 'bus'
  ? `${l.depart} · ${l.nomPoint.replace(/^Arrêt /, '')} → ${l.arretDescente} · arrivée ${legEnd(l)}`
  : `${Math.round(toMin(l.arrivee) - toMin(l.depart))} min · arrivée ${legEnd(l)}`;

function renderHome() {
  const panel = $('.home-panel');
  panel.classList.toggle('custom', !!sel.custom);
  if (sel.custom) {
    const { dest } = sel.custom;
    $('#mode-title').textContent = dest.local ? 'Comment y aller' : `Après le train (${dest.train.depart} → ${dest.train.arrivee})`;
    $('#mode-label').classList.remove('disabled');
    const ml = $('#mode-list');
    ml.innerHTML = '';
    dest.correspondances.forEach((l, i) => {
      const b = document.createElement('button');
      b.className = 'choice mode' + (i === sel.legIdx ? ' selected' : '');
      b.innerHTML = `<span class="mode-ico mi-${l.vehicule === 'Tram' ? 'tram' : l.mode}"></span><span><span class="c-title">${legLabel(l)}</span><br><span class="c-sub">${CUSTOM_SUB(l)}</span></span>`;
      b.onclick = () => { sel.legIdx = i; renderHome(); };
      ml.appendChild(b);
    });
    $('#stepfree').setAttribute('aria-pressed', String(sel.stepFree));
    $('#go-summary').disabled = false;
    return;
  }
  $('#mode-title').textContent = 'Après le train';
  $('#home-from').textContent = `Départ : ${DATA.gares[DATA.borne.gare].nom} · ${DATA.borne.nomLieu}`;
  const cl = $('#city-list');
  cl.innerHTML = '';
  for (const c of DATA.villes) {
    const b = document.createElement('button');
    b.className = 'choice' + (c.id === sel.cityId ? ' selected' : '');
    b.innerHTML = `<span class="c-title">${c.nom}</span><span class="c-sub">${c.accroche}</span>`;
    b.onclick = () => { sel.custom = null; sel.cityId = c.id; sel.destId = c.destinations[0].id; sel.legIdx = 0; renderHome(); previewCity(); };
    cl.appendChild(b);
  }
  const pl = $('#place-list');
  pl.innerHTML = '';
  const city = cityOf(sel.cityId);
  $('#place-list').previousElementSibling.classList.toggle('disabled', !city);
  if (city) for (const d of city.destinations) {
    const b = document.createElement('button');
    b.className = 'choice place' + (d.id === sel.destId ? ' selected' : '');
    b.innerHTML = `<span class="c-title">${d.nom}</span><span class="c-sub">${d.type}</span><span class="c-tag">Arrivée ${d.correspondances[0].arrivee}</span>`;
    b.onclick = () => { sel.destId = d.id; sel.legIdx = 0; renderHome(); };
    pl.appendChild(b);
  } else pl.innerHTML = '<div class="c-sub" style="font-size:calc(var(--u)*2.2);color:var(--text-3);padding:calc(var(--u)*1) 0">Choisissez d’abord une ville.</div>';
  const ml = $('#mode-list');
  ml.innerHTML = '';
  const dest = destOf();
  $('#mode-label').classList.toggle('disabled', !dest);
  if (dest) dest.correspondances.forEach((l, i) => {
    const b = document.createElement('button');
    b.className = 'choice mode' + (i === sel.legIdx ? ' selected' : '');
    b.innerHTML = `<span class="mode-ico mi-${l.mode}"></span><span><span class="c-title">${MODE_LABEL[l.mode]}</span><br><span class="c-sub">${MODE_SUB(l)}</span></span>`;
    b.onclick = () => { sel.legIdx = i; renderHome(); };
    ml.appendChild(b);
  });
  $('#stepfree').setAttribute('aria-pressed', String(sel.stepFree));
  $('#go-summary').disabled = !dest;
}

function previewCity() {
  // léger mouvement de caméra vers la direction de la ville choisie (vue d'accueil)
  homeYawBias = { lille: 0.5, lens: -0.4, arras: -0.9 }[sel.cityId] ?? 0;
}

/* ------------------------------------------------------------------ */
/*  Destination libre : recherche, dictée, clavier                      */
/* ------------------------------------------------------------------ */
let suggestions = [];
const searchInput = $('#search');

function setHint(text, error = false) {
  const h = $('#search-hint');
  h.textContent = text;
  h.classList.toggle('error', error);
}

function renderSuggestions() {
  const q = searchInput.value;
  suggestions = q.trim().length >= 2 ? searchPlaces(q) : [];
  const box = $('#suggest');
  box.innerHTML = '';
  for (const s of suggestions) {
    const b = document.createElement('button');
    b.className = 'choice sugg';
    b.innerHTML = `<span class="c-title">${s.name}</span><span class="c-sub">${s.kindLabel} · ${s.cityName}</span>`;
    b.onclick = () => choosePlace(s);
    box.appendChild(b);
  }
  $('.home-panel').classList.toggle('searching', q.trim().length > 0);
  if (q.trim().length >= 2 && !suggestions.length) setHint('Aucun lieu trouvé près des gares de Béthune, Lens, Arras ou Lille.', true);
  else setHint('Par exemple : « Grand-Place de Béthune », « Euralille », « Place des Héros Arras »');
}

function choosePlace(place) {
  const r = planTo(place, DATA.borne.heure);
  if (r.error) { setHint(r.error, true); speak(r.error); return; }
  sel.custom = { place, ...r };
  sel.cityId = place.city; sel.destId = 'custom'; sel.legIdx = 0;
  searchInput.value = `${place.name}, ${place.cityName}`;
  $('#suggest').innerHTML = '';
  closeKeyboard();
  renderHome();
  previewCity();
  const d = r.dest, l = d.correspondances[0];
  const how = l.mode === 'bus' ? `en ${(l.vehicule || 'bus').toLowerCase()}, ligne ${l.ligne}` : 'à pied';
  speak(d.local
    ? `${place.name}. Le plus rapide : ${how}, arrivée à ${legEnd(l)}.`
    : `${place.name}, à ${place.cityName}. Train de ${d.train.depart}, puis ${how}. Arrivée à ${legEnd(l)}.`);
}

function openKeyboard() { $('.home-panel').classList.add('kb-open'); }
function closeKeyboard() { $('.home-panel').classList.remove('kb-open'); searchInput.blur(); }

mountKeyboard($('#keyboard'), searchInput, { onEnter: () => { if (suggestions[0]) choosePlace(suggestions[0]); else closeKeyboard(); } });
searchInput.addEventListener('focus', () => { openKeyboard(); if (sel.custom) { sel.custom = null; sel.cityId = null; searchInput.select(); renderHome(); } });
searchInput.addEventListener('input', renderSuggestions);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && suggestions[0]) choosePlace(suggestions[0]); if (e.key === 'Escape') closeKeyboard(); });
if (!hasGtfs()) { $('#search-box').hidden = true; setHint(''); }

if (canListen()) {
  const mic = $('#mic');
  mic.hidden = false;
  let stop = null;
  mic.onclick = () => {
    if (stop) { stop(); return; }
    mic.classList.add('listening');
    setHint('Je vous écoute… dites par exemple « Euralille »');
    stop = listen({
      onText: (txt, final) => {
        searchInput.value = txt;
        renderSuggestions();
        if (final && suggestions[0]) choosePlace(suggestions[0]);
      },
      onEnd: () => { mic.classList.remove('listening'); stop = null; },
      onError: (err) => {
        mic.classList.remove('listening'); stop = null;
        setHint(err === 'not-allowed' ? 'Micro non autorisé sur cette borne.' : err === 'network' ? 'Dictée indisponible sans connexion : utilisez le clavier.' : 'Je n’ai pas compris, réessayez ou utilisez le clavier.', true);
      },
    });
  };
}

function renderSummaryLocal() {
  const dest = destOf(), leg = legOf(), g = DATA.gares;
  const end = legEnd(leg);
  const total = toMin(end) - toMin(DATA.borne.heure);
  $('#sum-title').innerHTML = `${g.bethune.nom} → ${dest.nom}`;
  const legLine = leg.mode === 'bus'
    ? `<div class="what">${leg.vehicule || 'Bus'} ligne ${leg.ligne}</div><div class="det">Direction <b>${leg.direction}</b> · ${leg.nomPoint}<br>Descente à <b>${leg.arretDescente}</b> à ${leg.arrivee}</div>`
    : `<div class="what">À pied</div><div class="det">Sortie de la gare → ${dest.nom}</div>`;
  $('#sum-body').innerHTML = `
    <div class="sum-facts">
      <div class="fact"><div class="k">Durée totale</div><div class="v">${fmtDur(total)}</div></div>
      <div class="fact"><div class="k">Mode</div><div class="v" style="font-size:calc(var(--u)*3)">${legLabel(leg)}</div></div>
      <div class="fact"><div class="k">Arrivée</div><div class="v">${end}</div></div>
    </div>
    <ol class="sum-timeline">
      <li class="sum-item"><span class="pin"><i class="mi-borne"></i></span><span class="time">${DATA.borne.heure}</span>
        <div><div class="what">${g.bethune.nomComplet}</div><div class="det">Vous êtes ici · ${DATA.borne.nomLieu}<br>Sortez par les portes principales</div></div></li>
      <li class="sum-item"><span class="pin"><i class="mi-${leg.mode}"></i></span><span class="time">${leg.depart}</span><div>${legLine}</div></li>
      <li class="sum-item"><span class="pin"><i class="mi-lieu"></i></span><span class="time">${end}</span>
        <div><div class="what">${dest.nom}</div><div class="det">${dest.type}${leg.mode === 'bus' && leg.marcheFinale ? ` · ${leg.marcheFinale} min à pied depuis l’arrêt` : ''}</div></div></li>
    </ol>`;
  return { endStr: end, total };
}

function renderSummary() {
  if (sel.custom?.local) return renderSummaryLocal();
  const city = cityOf(sel.cityId), dest = destOf(), leg = legOf(), T = dest.train;
  const trip = computeTrip(DATA, city, dest, leg, sel.stepFree);
  const g = DATA.gares;
  $('#sum-title').innerHTML = `${g.bethune.nom} → ${dest.nom}${sel.stepFree ? '<span class="badge-sf">Sans escalier</span>' : ''}`;
  const access = (st, lf) => (lf ? 'par ascenseur' : st ? 'par escalier' : 'de plain-pied');
  const legLine = leg.mode === 'bus'
    ? `<div class="what">${leg.vehicule || 'Bus'} ligne ${leg.ligne}</div><div class="det">Direction <b>${leg.direction}</b> · ${leg.nomPoint}<br>Descente à <b>${leg.arretDescente}</b> à ${leg.arrivee}</div>`
    : leg.mode === 'voiture'
      ? `<div class="what">Prise en charge en voiture</div><div class="det">${leg.nomPoint}<br>${leg.vehicule} · arrivée ${leg.arrivee}</div>`
      : `<div class="what">À pied</div><div class="det">${leg.nomPoint} → ${dest.nom} · arrivée ${leg.arrivee}</div>`;
  $('#sum-body').innerHTML = `
    <div class="sum-facts">
      <div class="fact"><div class="k">Durée totale</div><div class="v">${fmtDur(trip.total)}</div></div>
      <div class="fact"><div class="k">Marche en gare</div><div class="v">${trip.walkDep} <small>+</small> ${trip.walkArr} <small>min</small></div></div>
      <div class="fact"><div class="k">Arrivée</div><div class="v">${trip.endStr}</div></div>
    </div>
    <ol class="sum-timeline">
      <li class="sum-item"><span class="pin"><i class="mi-borne"></i></span><span class="time">${DATA.borne.heure}</span>
        <div><div class="what">${g.bethune.nomComplet}</div><div class="det">Vous êtes ici · ${DATA.borne.nomLieu}<br>${trip.walkDep} min jusqu’au <b>quai ${T.quai}</b>, ${access(trip.usesStairsDep, trip.usesLiftDep)}</div></div></li>
      <li class="sum-item"><span class="pin"><i class="mi-train"></i></span><span class="time">${T.depart}</span>
        <div><div class="what">${T.numero} · ${T.direction}</div><div class="det">Quai <b>${T.quai}</b> · voiture <b>${T.voiture}</b><br>Arrêts : ${T.arrets.map((a) => `${a.gare} ${a.heure}`).join(' · ') || 'direct'}</div></div></li>
      <li class="sum-item"><span class="pin"><i class="mi-gare"></i></span><span class="time">${T.arrivee}</span>
        <div><div class="what">${g[city.id].nomComplet}</div><div class="det">Arrivée quai <b>${T.quaiArrivee}</b> · ${trip.walkArr} min ${leg.mode === 'marche' ? 'jusqu’à la sortie' : 'jusqu’au point de correspondance'}, ${access(trip.usesStairsArr, trip.usesLiftArr)}</div></div></li>
      <li class="sum-item"><span class="pin"><i class="mi-${leg.mode}"></i></span><span class="time">${leg.depart}</span><div>${legLine}</div></li>
      <li class="sum-item"><span class="pin"><i class="mi-lieu"></i></span><span class="time">${trip.endStr}</span>
        <div><div class="what">${dest.nom}</div><div class="det">${dest.type}${leg.marcheFinale ? ` · ${leg.marcheFinale} min à pied depuis ${leg.mode === 'bus' ? 'l’arrêt' : 'le véhicule'}` : ''}</div></div></li>
    </ol>`;
  if (trip.warnings.length) console.warn('[Cohérence des données]', trip.warnings.join(' / '));
  return trip;
}

/* ------------------------------------------------------------------ */
/*  Lecteur du parcours                                                */
/* ------------------------------------------------------------------ */
function disposeStage(st) {
  if (!st) return;
  st.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) if (m.userData?.owned) m.dispose();
  });
}

const fade = (on) => new Promise((res) => { $('#fade').classList.toggle('on', on); setTimeout(res, on ? 460 : 10); });

async function enterStage(i, { snap = false } = {}) {
  if (player.busy) return;
  player.busy = true;
  const fac = player.factories[i];
  const ctx = player.ctx;
  const worldId = player.worlds[i];
  const changeWorld = worldId !== player.worldId;
  if (changeWorld && player.worldId) await fade(true);
  let world, stage;
  try {
    world = getWorld(worldId, engine);
    if (worldId === ctx.city.id) {
      // lieu, arrêt et tracés calculés pour une destination libre ; tracés d'origine sinon
      if (ctx.dest.custom) injectCustom(world, ctx.dest, ctx.leg); else restoreWorld(world);
    }
    stage = fac({ ...ctx, world });
  } catch (err) {
    console.error('[Étape]', err);
    player.busy = false;
    await fade(false);
    goHome();
    return;
  }
  disposeStage(player.stage);
  engine.clearWorld();
  engine.world.add(world.group, stage.group);
  engine.occluders = world.occEntries;
  for (const e of world.occEntries) { e.fade = 1; e.want = 1; }
  engine.shadowMax = world.kind === 'region' ? 700 : 900;
  // étiquettes
  player.labels = [];
  for (const l of world.labels) {
    const it = engine.labels.add({ html: l.text, cls: l.cls, pos: new THREE.Vector3(l.at[0], (l.y || 0) + l.h, l.at[1]), maxDist: l.maxDist });
    player.labels.push({ it, spec: {} });
  }
  for (const l of stage.labels) {
    const it = engine.labels.add({ html: l.html, cls: l.cls, pos: l.pos, obj: l.obj, offset: l.offset, stem: l.stem !== false, maxDist: l.maxDist ?? Infinity });
    player.labels.push({ it, spec: l });
  }
  player.stage = stage;
  lastInput = performance.now(); // l'inactivité se compte à partir de la dernière étape vue
  player.idx = i;
  player.t = 0;
  player.cueIdx = -1;
  player.ended = false;
  player.worldId = worldId;
  stage.update(0, engine.time);
  engine.rig.set(player.overview ? stage.overview : stage.camera(0), changeWorld || snap);
  updateFrise();
  $('#ins-place').textContent = stage.place;
  $('#brand-sub').textContent = worldId === 'region' ? 'Voyage en train' : DATA.gares[worldId].nomComplet;
  $('#infocard').classList.remove('show');
  if (changeWorld) { engine.step(0.016); await fade(false); }
  player.busy = false;
}

function updateFrise() {
  const segs = ['gare', 'train', 'correspondance', 'destination'];
  const cur = segs.indexOf(player.stage?.seg);
  document.querySelectorAll('#frise li').forEach((li, i) => {
    li.classList.toggle('done', i < cur || (player.ended && i === cur));
    li.classList.toggle('current', i === cur && !player.ended);
  });
  $('#ctl-prev').disabled = player.idx <= 0;
  $('#frise').classList.toggle('local', !!player.ctx?.dest.local);
}

function setPlaying(p) {
  player.playing = p;
  const b = $('#ctl-play');
  b.querySelector('i').className = 'ico ' + (p ? 'ico-pause' : 'ico-play');
  b.querySelector('span').textContent = p ? 'Pause' : 'Lecture';
}

async function startJourney() {
  const city = cityOf(sel.cityId), dest = destOf(), leg = legOf();
  player.ctx = { data: DATA, city, dest, leg, stepFree: sel.stepFree };
  // destination dans la ville de la borne : sortie de gare puis trajet, sans train
  if (dest.local) { player.factories = [stageArrival, stageDestination]; player.worlds = [city.id, city.id]; }
  else { player.factories = FACTORIES; player.worlds = ['bethune', 'region', city.id, city.id]; }
  releaseWorlds(['bethune', 'region', city.id]);
  player.overview = false;
  $('#ctl-overview').classList.remove('active');
  await fade(true);
  engine.rig.stiffness = 2.0;
  engine.setViewShift(0.04);
  player.worldId = null;
  show('journey');
  setPlaying(true);
  player.busy = false;
  await enterStage(0, { snap: true });
  await fade(false);
}

function showEnd() {
  const { dest, leg, city } = player.ctx;
  $('#end-title').textContent = dest.nom;
  const legTxt = leg.mode === 'bus' ? `${(leg.vehicule || 'bus').toLowerCase()} ${leg.ligne}` : leg.mode === 'voiture' ? 'voiture' : 'à pied';
  speak(`Vous êtes arrivé : ${dest.nom}.`);
  if (dest.local) {
    const end = legEnd(leg);
    $('#end-body').innerHTML = `
    <div class="sum-facts">
      <div class="fact"><div class="k">Arrivée</div><div class="v">${end}</div></div>
      <div class="fact"><div class="k">Durée</div><div class="v">${fmtDur(toMin(end) - toMin(DATA.borne.heure))}</div></div>
      <div class="fact"><div class="k">Mode</div><div class="v" style="font-size:calc(var(--u)*2.6)">${legLabel(leg)}</div></div>
    </div>
    <p class="det" style="font-size:calc(var(--u)*2.5);color:var(--text-2);margin:0 0 calc(var(--u)*3);line-height:1.4">
      ${DATA.gares.bethune.nomComplet} → ${dest.nom}, ${legTxt}.</p>`;
    lastInput = performance.now();
    $('#screen-end').classList.add('active');
    document.body.dataset.screen = 'end';
    screen = 'end';
    return;
  }
  const trip = computeTrip(DATA, city, dest, leg, sel.stepFree);
  $('#end-body').innerHTML = `
    <div class="sum-facts">
      <div class="fact"><div class="k">Arrivée</div><div class="v">${trip.endStr}</div></div>
      <div class="fact"><div class="k">Durée</div><div class="v">${fmtDur(trip.total)}</div></div>
      <div class="fact"><div class="k">Train</div><div class="v" style="font-size:calc(var(--u)*2.6)">${dest.train.depart} <small>quai ${dest.train.quai}</small></div></div>
    </div>
    <p class="det" style="font-size:calc(var(--u)*2.5);color:var(--text-2);margin:0 0 calc(var(--u)*3);line-height:1.4">
      ${DATA.gares.bethune.nom} → ${DATA.gares[city.id].nomComplet} en ${dest.train.numero}, puis ${legTxt} jusqu’à ${dest.nom}.</p>`;
  lastInput = performance.now();
  $('#screen-end').classList.add('active');
  document.body.dataset.screen = 'end';
  screen = 'end';
}

/* ------------------------------------------------------------------ */
/*  Boucle                                                             */
/* ------------------------------------------------------------------ */
let homeYawBias = 0;
let lastClock = '';

engine.onFrame((dt, time) => {
  if (screen === 'journey' || screen === 'end') tickJourney(dt, time);
  else tickHome(dt, time);
  // inactivité
  const idle = (performance.now() - lastInput) / 1000;
  if (!window.__HOLO_TEST__ && settings.inactiviteSecondes > 0 && idle > settings.inactiviteSecondes && screen !== 'home' && !(screen === 'journey' && player.playing)) goHome();
});

function tickJourney(dt, time) {
  const st = player.stage;
  if (!st || player.busy) return;
  if (player.playing && !player.ended) player.t += dt * settings.vitesse;
  if (player.ended) player.t += dt; // la caméra finale continue de tourner
  const t = player.t;
  if (t >= st.duration && !player.ended && player.playing) {
    if (player.idx < player.factories.length - 1) { enterStage(player.idx + 1); return; }
    player.ended = true;
    updateFrise();
    showEnd();
  }
  const tc = Math.min(t, st.duration);
  st.update(tc, time);
  engine.rig.set(player.overview ? st.overview : st.camera(t));
  engine.focus = st.focus(tc);
  // consignes
  let ci = -1;
  st.cues.forEach((c, i) => { if (c.t <= tc + 1e-3) ci = i; });
  if (ci !== player.cueIdx && ci >= 0) {
    player.cueIdx = ci;
    const c = st.cues[ci];
    $('#ins-text').textContent = c.text;
    $('#ins-sub').textContent = c.sub || '';
    $('#ins-count').textContent = `${ci + 1} / ${st.cues.length}`;
    if (player.playing) speak(c.sub ? `${c.text}. ${c.sub}` : c.text);
    const el = $('#instruction');
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }
  // étiquettes temporisées
  for (const { it, spec } of player.labels) {
    let v = true;
    if (spec.until !== undefined && tc > spec.until) v = false;
    if (spec.from !== undefined && tc < spec.from) v = false;
    if (spec.when && !spec.when()) v = false;
    it.setVisible(v);
  }
  // horloge, progression, carte d'information
  const clock = fmt(st.clock(tc));
  if (clock !== lastClock) { $('#clock').textContent = clock; lastClock = clock; }
  $('#progress-bar').style.width = `${((player.idx + Math.min(1, tc / st.duration)) / player.factories.length) * 100}%`;
  const info = st.info(tc);
  const ic = $('#infocard');
  if (info && ic.dataset.html !== info) { ic.innerHTML = info; ic.dataset.html = info; }
  ic.classList.toggle('show', !!info && !player.ended);
}

function tickHome(dt, time) {
  const yaw = Math.PI + 0.25 + Math.sin(time * 0.05) * 0.35 + homeYawBias * 0.3;
  engine.rig.set({ target: new THREE.Vector3(60, 0, 300), yaw, pitch: 0.72, dist: 760 });
  engine.focus = null;
}

/* ------------------------------------------------------------------ */
/*  Accueil (fond 3D)                                                   */
/* ------------------------------------------------------------------ */
function goHome() {
  setPlaying(false);
  disposeStage(player.stage);
  player.stage = null;
  player.idx = -1;
  player.worldId = 'bethune';
  const w = getWorld('bethune', engine);
  if (engine.light) releaseWorlds(['bethune']);
  engine.clearWorld();
  engine.world.add(w.group);
  engine.occluders = w.occEntries;
  for (const l of w.labels) engine.labels.add({ html: l.text, cls: l.cls, pos: new THREE.Vector3(l.at[0], (l.y || 0) + l.h, l.at[1]), maxDist: 4000 });
  $('#clock').textContent = DATA.borne.heure;
  $('#brand-sub').textContent = DATA.gares[DATA.borne.gare].nomComplet;
  lastClock = '';
  sel.cityId = null; sel.destId = null; sel.legIdx = 0; sel.stepFree = false; sel.custom = null;
  searchInput.value = '';
  $('#suggest').innerHTML = '';
  $('.home-panel').classList.remove('searching', 'kb-open');
  stopSpeaking();
  homeYawBias = 0;
  renderHome();
  show('home');
  engine.setViewShift(0.3);
  engine.rig.stiffness = 1.2;
}

/* ------------------------------------------------------------------ */
/*  Commandes                                                          */
/* ------------------------------------------------------------------ */
$('#stepfree').onclick = () => { sel.stepFree = !sel.stepFree; renderHome(); };
$('#go-summary').onclick = () => { if (!destOf()) return; renderSummary(); show('summary'); };
$('#sum-back').onclick = () => show('home');
$('#go-journey').onclick = () => { startJourney(); };
$('#ctl-home').onclick = () => goHome();
$('#ctl-play').onclick = () => {
  if (player.ended) { replayAll(); return; }
  setPlaying(!player.playing);
};
$('#ctl-replay').onclick = () => { player.t = 0; player.cueIdx = -1; player.ended = false; $('#screen-end').classList.remove('active'); screen = 'journey'; setPlaying(true); updateFrise(); };
$('#ctl-prev').onclick = () => { if (player.idx > 0) { $('#screen-end').classList.remove('active'); screen = 'journey'; setPlaying(true); enterStage(player.idx - 1); } };
$('#ctl-voice').onclick = () => {
  const on = !voiceEnabled();
  setVoiceEnabled(on);
  $('#ctl-voice').setAttribute('aria-pressed', String(on));
  $('#ctl-voice').classList.toggle('active', on);
  if (on) speak($('#ins-text').textContent);
};
if (!canSpeak()) $('#ctl-voice').hidden = true;
$('#ctl-next').onclick = () => {
  if (player.idx < player.factories.length - 1) { setPlaying(true); enterStage(player.idx + 1); }
  else if (!player.ended) { player.t = player.stage.duration; player.ended = true; updateFrise(); showEnd(); }
};
$('#ctl-overview').onclick = () => { player.overview = !player.overview; $('#ctl-overview').classList.toggle('active', player.overview); };
$('#end-replay').onclick = () => replayAll();
$('#end-home').onclick = () => goHome();

async function replayAll() {
  $('#screen-end').classList.remove('active');
  screen = 'journey';
  player.ended = false;
  setPlaying(true);
  await enterStage(0);
}

for (const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true });
window.addEventListener('keydown', (e) => {
  if (screen !== 'journey' && screen !== 'end') return;
  if (e.code === 'Space') { e.preventDefault(); $('#ctl-play').click(); }
  if (e.code === 'ArrowRight') $('#ctl-next').click();
  if (e.code === 'ArrowLeft') $('#ctl-prev').click();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

if (engine.light) document.body.classList.add('light');
engine.onContextLost = () => {
  const f = $('#fade');
  f.classList.add('on');
  f.innerHTML = '<p style="position:absolute;top:45%;width:100%;text-align:center;font-size:calc(var(--u)*3);color:#5b6876">Rechargement de l’affichage 3D…</p>';
  setTimeout(() => location.reload(), 2500);
};

setupSettings({ engine, settings, defaults: DEFAULTS, onChange: (s) => { settings = s; } });

/* ------------------------------------------------------------------ */
/*  Démarrage                                                          */
/* ------------------------------------------------------------------ */
goHome();
tickHome(0, 0);
engine.rig.snap();
engine.start();

// accès pour les tests automatisés
window.__holo = {
  engine, player, sel, DATA,
  select(cityId, destId, legIdx = 0, stepFree = false) { Object.assign(sel, { cityId, destId, legIdx, stepFree }); renderHome(); },
  summary() { renderSummary(); show('summary'); },
  async start() { await startJourney(); },
  async goto(i, t = 0) { await enterStage(i, { snap: true }); player.t = t; tickJourney(0, engine.time); engine.rig.snap(); engine.rig.update(0); },
  pause() { setPlaying(false); },
  trip() { return computeTrip(DATA, cityOf(sel.cityId), destOf(), legOf(), sel.stepFree); },
};
