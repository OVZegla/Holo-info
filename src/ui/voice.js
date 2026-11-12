/*
 * Voix de la borne (API Web Speech du navigateur) :
 *  - synthèse : lecture des consignes à voix haute (fonctionne hors ligne avec
 *    les voix françaises de Windows) ;
 *  - reconnaissance : dictée de la destination (Chrome / Edge ; nécessite en
 *    général un accès Internet, le bouton micro est masqué si indisponible).
 */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

let enabled = true;
let voice = null;
function pickVoice() {
  if (!synth) return;
  const vs = synth.getVoices().filter((v) => /^fr(-|_|$)/i.test(v.lang));
  // voix locales d'abord (pas de réseau), puis voix « naturelles » si présentes
  voice = vs.find((v) => v.localService && /fr-FR/i.test(v.lang)) || vs.find((v) => /fr-FR/i.test(v.lang)) || vs[0] || null;
}
if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }

export const canSpeak = () => !!synth;
export const canListen = () => !!Recognition;
export const voiceEnabled = () => enabled && !!synth;
export function setVoiceEnabled(on) { enabled = on; if (!on) synth?.cancel(); }

/** Lit un texte (interrompt la lecture en cours). */
export function speak(text, { rate = 1, force = false } = {}) {
  if (!synth || (!enabled && !force) || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/·/g, ',').replace(/\s+/g, ' '));
  u.lang = 'fr-FR';
  if (voice) u.voice = voice;
  u.rate = rate;
  synth.speak(u);
}
export const stopSpeaking = () => synth?.cancel();

/**
 * Écoute une phrase. onText(texte, final) est appelé au fil de la dictée.
 * Renvoie une fonction d'arrêt.
 */
export function listen({ onText, onEnd, onError }) {
  if (!Recognition) { onError?.('indisponible'); return () => {}; }
  synth?.cancel();
  const r = new Recognition();
  r.lang = 'fr-FR';
  r.interimResults = true;
  r.maxAlternatives = 1;
  r.onresult = (e) => {
    const res = e.results[e.results.length - 1];
    onText(res[0].transcript, res.isFinal);
  };
  r.onerror = (e) => onError?.(e.error);
  r.onend = () => onEnd?.();
  try { r.start(); } catch (err) { onError?.(String(err)); }
  return () => { try { r.stop(); } catch { /* déjà arrêtée */ } };
}
