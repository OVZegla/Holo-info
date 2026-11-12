/*
 * Écran de veille : bandeau « Point info — visualisez votre trajet », carrousel
 * d'informations municipales et de publicités (data/infos.js), bandeau défilant.
 */
const ICONS = {
  noel: '<path d="M12 3l2.2 4.5L19 8l-3.5 3.3.9 4.9L12 13.8 7.6 16.2l.9-4.9L5 8l4.8-.5z"/><path d="M12 16v5"/>',
  expo: '<rect x="4" y="4" width="16" height="13" rx="1.5"/><path d="M4 14l4.5-4 3.5 3 3-2.5 5 4.5M9 21h6M12 17v4"/>',
  sante: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M12 9v5M9.5 11.5h5"/>',
  coeur: '<circle cx="8" cy="8" r="2.5"/><circle cx="16" cy="8" r="2.5"/><path d="M3.5 19c.6-3.4 2.3-5 4.5-5s3.9 1.6 4.5 5M11.5 19c.6-3.4 2.3-5 4.5-5s3.9 1.6 4.5 5"/>',
  jeunes: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h6M7 14h4"/><circle cx="17" cy="12" r="2"/>',
  appli: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2M10 7h4M10 10.5h4"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M12 14h2M16 14h0"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3M16 21v-3"/>',
  travaux: '<path d="M3 20h18M6 20l5-14h2l5 14M8.5 13h7"/>',
  cafe: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/>',
  velo: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l3 7M9 6h3"/>',
  frites: '<path d="M6 10h12l-1.5 10h-9z"/><path d="M8 10V4M10.5 10V3M13 10V4M15.5 10V5"/>',
  retro: '<path d="M3 15l2-5h10l3 3h2.5v2"/><circle cx="7" cy="16" r="2"/><circle cx="17" cy="16" r="2"/><path d="M6 10l1.5-3h6L15 10"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ICONS.agenda}</svg>`;

export function setupAttract(root, infos) {
  const slides = infos?.diapos || [];
  const dur = (infos?.dureeDiapo || 8) * 1000;
  const card = root.querySelector('#attract-card');
  const dots = root.querySelector('#attract-dots');
  const ticker = root.querySelector('#attract-ticker-text');
  ticker.textContent = (infos?.bandeau || []).join('   •   ');
  // le texte est doublé pour un défilement continu
  ticker.textContent += '   •   ' + ticker.textContent;
  dots.innerHTML = slides.map(() => '<i></i>').join('');
  let idx = -1, timer = 0;

  const show = (i) => {
    idx = (i + slides.length) % slides.length;
    const s = slides[idx];
    card.className = `attract-card c-${s.couleur || 'bleu'} t-${s.type || 'info'}`;
    card.innerHTML = `
      <div class="ac-top"><span class="ac-ico">${icon(s.icone)}</span><span class="ac-src">${s.source || ''}</span></div>
      <div class="ac-title">${s.titre || ''}</div>
      <div class="ac-text">${s.texte || ''}</div>
      <div class="ac-meta">${s.quand ? `<span>${s.quand}</span>` : ''}${s.ou ? `<span>${s.ou}</span>` : ''}</div>
      <div class="ac-bar"><i style="animation-duration:${dur}ms"></i></div>`;
    dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === idx));
  };
  return {
    start() { if (!slides.length) return; clearInterval(timer); show(idx + 1); timer = setInterval(() => show(idx + 1), dur); },
    stop() { clearInterval(timer); },
  };
}
