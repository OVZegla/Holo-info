import * as THREE from 'three';

/**
 * Itinéraire piéton (ou véhicule) : suite de points 3D.
 * Chaque point peut porter :
 *   kind  : nature du segment qui y MÈNE ('walk' | 'stairs' | 'lift' | 'ride')
 *   wait  : pause (s) en arrivant sur ce point (ex. portes d'ascenseur)
 *   cue   : { text, sub } consigne affichée à l'arrivée sur le point précédent
 *           (autrement dit au DÉBUT du segment qui part de ce point)
 */
export const SPEEDS = {
  // vitesses d'animation (m/s), accélérées pour la démonstration
  anim: { walk: 6.5, stairs: 3.2, lift: 1.8, ride: 14 },
  // vitesses réelles (m/s) pour l'estimation affichée du temps de marche
  real: { walk: 1.15, stairs: 0.5, lift: 0.6, ride: 6 },
  realLiftWait: 35, // s d'attente moyenne d'un ascenseur
};

export class Route {
  constructor(points, { speeds = SPEEDS.anim, ease = true } = {}) {
    this.points = points.map((p) => ({ ...p, p: p.p.clone ? p.p.clone() : new THREE.Vector3(...p.p) }));
    this.speeds = speeds;
    this.cum = [0];
    for (let i = 1; i < this.points.length; i++) {
      this.cum.push(this.cum[i - 1] + this.points[i].p.distanceTo(this.points[i - 1].p));
    }
    this.length = this.cum[this.cum.length - 1];
    this._buildTiming(ease);
  }

  _buildTiming() {
    // keyframes (t, d) : on parcourt chaque segment à sa vitesse, pauses incluses
    const keys = [{ t: 0, d: 0 }];
    let t = 0;
    this.pointTimes = [0];
    for (let i = 1; i < this.points.length; i++) {
      const kind = this.points[i].kind || 'walk';
      const len = this.cum[i] - this.cum[i - 1];
      t += len / (this.speeds[kind] || this.speeds.walk);
      keys.push({ t, d: this.cum[i] });
      this.pointTimes.push(t);
      const w = this.points[i].wait || 0;
      if (w) { t += w; keys.push({ t, d: this.cum[i] }); }
    }
    this.keys = keys;
    this.duration = t;
  }

  /** Temps réel estimé (s) pour l'affichage « temps de marche ». */
  realSeconds() {
    let s = 0;
    for (let i = 1; i < this.points.length; i++) {
      const kind = this.points[i].kind || 'walk';
      const len = this.cum[i] - this.cum[i - 1];
      s += len / (SPEEDS.real[kind] || SPEEDS.real.walk);
      if (kind === 'lift' && (this.points[i - 1].kind || 'walk') !== 'lift') s += SPEEDS.realLiftWait;
    }
    return s;
  }

  hasKind(kind) { return this.points.some((p) => p.kind === kind); }

  /** Distance parcourue à l'instant t (avec départ et arrivée adoucis). */
  distAt(t) {
    if (t <= 0) return 0;
    if (t >= this.duration) return this.length;
    // départ / arrivée adoucis sur 0,8 s
    const k = this.keys;
    let i = 1;
    while (i < k.length && k[i].t < t) i++;
    const a = k[i - 1], b = k[i];
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
    let d = a.d + (b.d - a.d) * f;
    const ramp = 0.8;
    if (t < ramp) d *= easeIn(t / ramp) * 0.5 + 0.5 * (t / ramp);
    return d;
  }

  indexAt(d) {
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < d) i++;
    return i;
  }

  posAt(d, out = new THREE.Vector3()) {
    d = THREE.MathUtils.clamp(d, 0, this.length);
    const i = this.indexAt(d);
    const a = this.points[i - 1].p, b = this.points[i].p;
    const seg = this.cum[i] - this.cum[i - 1];
    const f = seg > 0 ? (d - this.cum[i - 1]) / seg : 0;
    return out.copy(a).lerp(b, f);
  }

  /** Direction horizontale au point d (ignore les segments verticaux). */
  dirAt(d, out = new THREE.Vector3()) {
    let i = this.indexAt(d);
    for (let k = 0; k < this.points.length; k++) {
      const a = this.points[Math.max(0, i - 1)].p, b = this.points[Math.min(this.points.length - 1, i)].p;
      out.set(b.x - a.x, 0, b.z - a.z);
      if (out.lengthSq() > 1e-6) return out.normalize();
      i = i + 1 < this.points.length ? i + 1 : i - 1;
      if (i <= 0) break;
    }
    return out.set(0, 0, -1);
  }

  kindAt(d) { return this.points[this.indexAt(d)].kind || 'walk'; }

  /** Liste des consignes avec leur instant d'apparition. */
  cues(offset = 0) {
    const out = [];
    this.points.forEach((p, i) => {
      if (p.cue) out.push({ t: offset + Math.max(0, this.pointTimes[i] + (p.wait && p.cueAfterWait ? p.wait : 0) - 0.25), ...p.cue });
    });
    return out;
  }
}

const easeIn = (x) => x * x;
export const smooth = (x) => x * x * (3 - 2 * x);
export const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
export const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Interpolation par images-clés : keys = [{t, v}] (v nombre ou Vector3). */
export function keyed(keys, t, ease = smooth) {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i];
      const f = ease((t - a.t) / Math.max(1e-6, b.t - a.t));
      if (typeof a.v === 'number') return a.v + (b.v - a.v) * f;
      return a.v.clone().lerp(b.v, f);
    }
  }
  return keys[keys.length - 1].v;
}
