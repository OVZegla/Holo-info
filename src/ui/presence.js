/*
 * Détection de présence devant la borne par la webcam.
 * Mouvement mesuré par différence d'images en très basse définition (80 × 60),
 * analysé dans le navigateur : aucune image n'est enregistrée ni transmise.
 *
 *   startPresence({ onArrive }) → { present(), stop() }
 *   - onArrive() : quelqu'un vient de se présenter (mouvement net et soutenu)
 *   - present()  : quelqu'un bouge encore devant la borne (dans les dernières secondes)
 */
const W = 80, H = 60;

export async function startPresence({ onArrive, threshold = 0.07, holdMs = 600 } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
  } catch (err) {
    console.info('[Présence] caméra indisponible :', err.name);
    return null;
  }
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.srcObject = stream;
  await video.play().catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let prev = null, since = 0, lastMotion = 0, timer = 0;

  const tick = () => {
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;
      const lum = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) lum[i] = (px[i * 4] * 3 + px[i * 4 + 1] * 6 + px[i * 4 + 2]) / 10;
      if (prev) {
        let moved = 0;
        for (let i = 0; i < lum.length; i++) if (Math.abs(lum[i] - prev[i]) > 22) moved++;
        const frac = moved / lum.length;
        const now = performance.now();
        if (frac > 0.012) lastMotion = now; // petit mouvement : quelqu'un est encore là
        // arrivée : grand mouvement (une personne qui s'approche occupe une bonne part de l'image) et soutenu
        if (frac > threshold) { if (!since) since = now; if (now - since > holdMs) { since = 0; onArrive?.(); } }
        else since = 0;
      }
      prev = lum;
    }
    timer = setTimeout(tick, 150);
  };
  tick();
  return {
    present: (withinMs = 4000) => performance.now() - lastMotion < withinMs,
    stop() { clearTimeout(timer); for (const t of stream.getTracks()) t.stop(); },
  };
}
