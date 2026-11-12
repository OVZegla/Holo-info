// Vérifie la cohérence de data/scenarios.js : champs obligatoires, quais existants,
// emplacements connus, ordre chronologique des horaires.
// Usage : npm run check   (ou : node tools/check-data.mjs chemin/vers/scenarios.js)
import fs from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2] || 'public/data/scenarios.js';
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx);
const D = ctx.window.HOLO_DONNEES;
const errors = [], warns = [];
const toMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); if (!m) return NaN; return +m[1] * 60 + +m[2]; };
const QUAIS = { bethune: [1, 2, 3], lens: [1, 2, 3], arras: [1, 2, 3], lille: [1, 2, 3, 4, 5, 6, 7, 8] };
const LIEUX = { lille: ['horizon', 'theatre'], lens: ['bollaert'], arras: ['heros'] };
const POINTS = { lille: ['arret-bus', 'depose-minute'], lens: ['arret-bus', 'depose-minute'], arras: [] };

if (Number.isNaN(toMin(D.borne.heure))) errors.push('borne.heure invalide');
for (const v of D.villes) {
  if (!D.gares[v.id]) errors.push(`gare manquante pour la ville ${v.id}`);
  for (const d of v.destinations) {
    const where = `${v.id}/${d.id}`;
    const T = d.train;
    if (!LIEUX[v.id]?.includes(d.lieu)) errors.push(`${where} : lieu « ${d.lieu} » inconnu (${LIEUX[v.id]})`);
    if (!QUAIS.bethune.includes(T.quai)) errors.push(`${where} : quai de départ ${T.quai} inexistant`);
    if (!QUAIS[v.id].includes(T.quaiArrivee)) errors.push(`${where} : quai d'arrivée ${T.quaiArrivee} inexistant`);
    const seq = [D.borne.heure, T.depart, ...T.arrets.map((a) => a.heure), T.arrivee];
    for (let i = 1; i < seq.length; i++) if (!(toMin(seq[i]) > toMin(seq[i - 1]))) errors.push(`${where} : horaires du train non croissants (${seq[i - 1]} → ${seq[i]})`);
    if (toMin(T.depart) - toMin(D.borne.heure) < 4) warns.push(`${where} : moins de 4 min entre la borne et le départ`);
    for (const c of d.correspondances) {
      if (!['bus', 'voiture', 'marche'].includes(c.mode)) errors.push(`${where} : mode ${c.mode} inconnu`);
      if (c.mode !== 'marche' && !POINTS[v.id].includes(c.point)) errors.push(`${where} : point « ${c.point} » inconnu`);
      if (!(toMin(c.depart) > toMin(T.arrivee))) errors.push(`${where} (${c.mode}) : départ ${c.depart} avant l'arrivée du train ${T.arrivee}`);
      if (!(toMin(c.arrivee) > toMin(c.depart))) errors.push(`${where} (${c.mode}) : arrivée avant départ`);
      if (c.mode === 'bus' && (!c.ligne || !c.direction)) errors.push(`${where} : bus sans ligne/direction`);
    }
  }
}
for (const w of warns) console.log('⚠', w);
for (const e of errors) console.log('✖', e);
console.log(errors.length ? `${errors.length} erreur(s)` : '✔ Données cohérentes');
process.exit(errors.length ? 1 : 0);
