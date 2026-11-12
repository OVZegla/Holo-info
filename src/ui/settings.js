/*
 * Panneau de réglages (maintenance) : touche « R » ou appui long (3 s) sur l'horloge.
 * Les valeurs sont appliquées en direct et mémorisées sur la borne (localStorage).
 */
const SCHEMA = [
  { k: 'contraste', label: 'Contraste des volumes', min: 0.5, max: 1.6, step: 0.05 },
  { k: 'exposition', label: 'Luminosité', min: 0.6, max: 1.4, step: 0.05 },
  { k: 'ombres', label: 'Intensité des ombres', min: 0, max: 1, step: 0.05 },
  { k: 'douceurOmbres', label: 'Douceur des ombres', min: 1, max: 10, step: 0.5 },
  { k: 'opaciteVitrages', label: 'Opacité des vitrages', min: 0.05, max: 0.7, step: 0.01 },
  { k: 'opaciteMasques', label: 'Opacité des murs effacés', min: 0, max: 0.6, step: 0.01 },
  { k: 'contours', label: 'Arêtes « maquette »', min: 0, max: 1, step: 0.05 },
  { k: 'brume', label: 'Profondeur (brume)', min: 0, max: 1, step: 0.05 },
  { k: 'vitesse', label: 'Vitesse des animations', min: 0.5, max: 2, step: 0.1 },
  { k: 'inactiviteSecondes', label: 'Retour accueil (s, 0 = jamais)', min: 0, max: 600, step: 10 },
];

export function setupSettings({ engine, settings, defaults, onChange }) {
  const panel = document.querySelector('#settings');
  const body = document.querySelector('#set-body');
  let s = settings;

  const save = () => { try { localStorage.setItem('holo-reglages', JSON.stringify(s)); } catch { /* indisponible */ } };
  const render = () => {
    body.innerHTML = '';
    for (const f of SCHEMA) {
      const row = document.createElement('div');
      row.className = 'set-row';
      row.innerHTML = `<label for="set-${f.k}">${f.label}</label><output>${s[f.k]}</output>
        <input id="set-${f.k}" type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${s[f.k]}">`;
      const input = row.querySelector('input'), out = row.querySelector('output');
      input.oninput = () => {
        s[f.k] = Number(input.value);
        out.textContent = input.value;
        engine.applySettings(s);
        onChange(s);
        save();
      };
      body.appendChild(row);
    }
    const q = document.createElement('div');
    q.className = 'set-row';
    q.innerHTML = `<label>Qualité (au prochain lancement)</label><output></output>
      <select><option value="haute">Haute</option><option value="standard">Standard</option></select>`;
    const selq = q.querySelector('select');
    selq.value = s.qualite;
    selq.onchange = () => { s.qualite = selq.value; save(); };
    body.appendChild(q);
  };

  const open = () => { render(); panel.hidden = false; };
  const close = () => { panel.hidden = true; };
  document.querySelector('#set-close').onclick = close;
  document.querySelector('#set-reset').onclick = () => {
    Object.assign(s, defaults);
    engine.applySettings(s); onChange(s); save(); render();
  };
  document.querySelector('#set-copy').onclick = async () => {
    const txt = 'window.HOLO_REGLAGES = ' + JSON.stringify(s, null, 2) + ';';
    try { await navigator.clipboard.writeText(txt); document.querySelector('#set-fps').textContent = 'Réglages copiés dans le presse-papiers.'; }
    catch { document.querySelector('#set-fps').textContent = txt; }
  };
  window.addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') (panel.hidden ? open : close)(); });
  let timer = null;
  const clock = document.querySelector('#clock');
  clock.addEventListener('pointerdown', () => { timer = setTimeout(open, 3000); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) clock.addEventListener(ev, () => clearTimeout(timer));
  setInterval(() => {
    if (!panel.hidden) document.querySelector('#set-fps').textContent = `${engine.fps.toFixed(0)} images/s · ${engine.renderer.info.render.triangles.toLocaleString('fr-FR')} triangles`;
  }, 1000);
}
