import * as THREE from 'three';

/**
 * Palette « maquette blanche ». Chaque teinte est définie à contraste = 1 ;
 * le réglage de contraste rapproche (ou éloigne) chaque teinte du blanc.
 */
const BASE = {
  white: '#fdfeff',
  facade: '#f3f5f7',
  facade2: '#e6ebef',
  facade3: '#d9e0e6',
  roof: '#eceff2',
  floor: '#f1f4f6',
  floor2: '#e7ecf0',
  platform: '#e4e9ed',
  socle: '#dde4e9',
  socleSide: '#cdd6dd',
  ground: '#eef2f5',
  road: '#e2e8ec',
  roadLine: '#f9fbfc',
  trackbed: '#d2d9df',
  sleeper: '#c2cad2',
  rail: '#9ba6b1',
  detail: '#a9b3bd',
  dark: '#77838f',
  green: '#e2ebe5',
  tree: '#dbe6de',
  water: '#d8edf5',
  brick: '#e9e3df',
  glassTint: '#cdeef9',
  accent: '#12b3e6',
  accentSoft: '#8fe0f8',
  accentDeep: '#0b8fc0',
  vehicle: '#fbfcfd',
  vehicle2: '#e3e9ee',
};

const WHITE = new THREE.Color('#ffffff');

export class Palette {
  constructor() {
    this.settings = { contraste: 1, opaciteVitrages: 0.28, contours: 0.55 };
    this.mats = new Map(); // key -> material
    this.lineMats = new Set();
    this.glassMats = new Set();
  }

  color(name) {
    const base = new THREE.Color(BASE[name] || name);
    if (name.startsWith && name.startsWith('accent')) return base; // les touches de couleur ne bougent pas
    const k = this.settings.contraste;
    // lerp depuis le blanc : k=0 → blanc, k=1 → teinte de base, k>1 → plus soutenu
    const c = WHITE.clone().lerp(base, k);
    c.r = THREE.MathUtils.clamp(c.r, 0, 1);
    c.g = THREE.MathUtils.clamp(c.g, 0, 1);
    c.b = THREE.MathUtils.clamp(c.b, 0, 1);
    return c;
  }

  /** Matériau mat standard partagé. */
  get(name, opts = {}) {
    const key = name + JSON.stringify(opts);
    if (this.mats.has(key)) return this.mats.get(key);
    const m = new THREE.MeshStandardMaterial({
      color: this.color(name),
      roughness: opts.roughness ?? 0.92,
      metalness: 0,
      side: opts.side ?? THREE.FrontSide,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0),
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      flatShading: opts.flat ?? false,
    });
    m.userData.paletteName = name;
    this.mats.set(key, m);
    return m;
  }

  /** Vitrage léger, opacité pilotée par le réglage « opacité des vitrages ». */
  glass(factor = 1, tint = 'glassTint') {
    const key = 'glass' + factor + tint;
    if (this.mats.has(key)) return this.mats.get(key);
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(BASE[tint] || tint),
      roughness: 0.15,
      metalness: 0,
      transparent: true,
      opacity: this.settings.opaciteVitrages * factor,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    m.userData.glassFactor = factor;
    this.glassMats.add(m);
    this.mats.set(key, m);
    return m;
  }

  accent(name = 'accent', opts = {}) {
    const key = 'acc' + name + JSON.stringify(opts);
    if (this.mats.has(key)) return this.mats.get(key);
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(BASE[name] || name),
      roughness: 0.6,
      emissive: new THREE.Color(BASE[name] || name),
      emissiveIntensity: opts.glow ?? 0.25,
      transparent: !!opts.opacity,
      opacity: opts.opacity ?? 1,
      depthWrite: opts.opacity ? false : true,
    });
    this.mats.set(key, m);
    return m;
  }

  line(name = 'detail', opacity = 1) {
    const key = 'line' + name + opacity;
    if (this.mats.has(key)) return this.mats.get(key);
    const m = new THREE.LineBasicMaterial({
      color: this.color(name),
      transparent: true,
      opacity: this.settings.contours * opacity,
      depthWrite: false,
    });
    m.userData.lineFactor = opacity;
    m.userData.paletteName = name;
    this.lineMats.add(m);
    this.mats.set(key, m);
    return m;
  }

  apply(settings) {
    Object.assign(this.settings, settings);
    for (const m of this.mats.values()) {
      if (m.userData.paletteName && m.color && !m.userData.lineFactor) m.color.copy(this.color(m.userData.paletteName));
    }
    for (const m of this.glassMats) m.opacity = this.settings.opaciteVitrages * m.userData.glassFactor;
    for (const m of this.lineMats) {
      m.opacity = this.settings.contours * m.userData.lineFactor;
      m.color.copy(this.color(m.userData.paletteName));
      m.visible = this.settings.contours > 0.01;
    }
  }
}

export const palette = new Palette();
