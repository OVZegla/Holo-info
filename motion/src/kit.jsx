/*
 * Kit graphique de la boucle de veille (affichage portrait 1080 × 1920).
 * Fonds exclusivement clairs et pastel : sur la vitrine LCD transparente,
 * le clair laisse voir à travers et renforce l'effet de relief.
 */
import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

export const FONT = "'Segoe UI Variable Display', 'Segoe UI', 'Inter', system-ui, sans-serif";
export const PALETTES = {
  ciel: { a: '#e6f4fd', b: '#f6fbff', c: '#cdeafb', ink: '#0d6f9a', soft: '#5d7d93' },
  menthe: { a: '#e3f6ee', b: '#f7fcf9', c: '#c9eedd', ink: '#1d7a56', soft: '#5b8173' },
  peche: { a: '#fdebe1', b: '#fffaf6', c: '#fbd6c2', ink: '#b05a2a', soft: '#8a6a58' },
  lavande: { a: '#eee9fb', b: '#fbfaff', c: '#dcd3f6', ink: '#5d48a8', soft: '#76708f' },
  citron: { a: '#fbf5d8', b: '#fffdf3', c: '#f5e8a8', ink: '#86700f', soft: '#857c52' },
  rose: { a: '#fce6ee', b: '#fffafc', c: '#f8cfdd', ink: '#ad3f66', soft: '#8b6774' },
};

/** Ressort standard de l'habillage (entrées nettes, sans rebond excessif). */
export const useSpring = (delay = 0, config = { damping: 200, mass: 0.8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config });
};

/** Fond pastel vivant : dégradé + grandes taches floues qui dérivent lentement. */
export const PastelBackground = ({ p }) => {
  const frame = useCurrentFrame();
  const blob = (i, x, y, r, color) => {
    const dx = Math.sin(frame / 90 + i * 1.7) * 60, dy = Math.cos(frame / 110 + i) * 70;
    return <div key={i} style={{ position: 'absolute', left: x + dx - r, top: y + dy - r, width: r * 2, height: r * 2, borderRadius: '50%', background: color, filter: 'blur(90px)', opacity: 0.85 }} />;
  };
  return (
    <AbsoluteFill style={{ background: `linear-gradient(165deg, ${p.b} 0%, ${p.a} 55%, ${p.b} 100%)`, overflow: 'hidden' }}>
      {blob(0, 180, 380, 360, p.c)}
      {blob(1, 920, 1150, 420, p.c)}
      {blob(2, 520, 1750, 300, p.a)}
    </AbsoluteFill>
  );
};

/** Petite étiquette en capitales (« Ville de Béthune », « Patrimoine »…). */
export const Kicker = ({ children, p, delay = 0, style }) => {
  const s = useSpring(delay);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, padding: '14px 30px', borderRadius: 999, background: 'rgba(255,255,255,0.78)',
      color: p.ink, fontFamily: FONT, fontWeight: 700, fontSize: 30, letterSpacing: '0.14em', textTransform: 'uppercase',
      boxShadow: '0 10px 30px rgba(40,60,80,0.08)', opacity: s, transform: `translateY(${(1 - s) * 30}px)`, ...style }}>
      <span style={{ width: 14, height: 14, borderRadius: '50%', background: p.ink }} />{children}
    </div>
  );
};

/** Titre cinétique : chaque mot monte et apparaît avec un léger décalage. */
export const BigTitle = ({ text, delay = 0, size = 120, color = '#1f2b36', weight = 700, lineHeight = 1.02, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: weight, lineHeight, color, letterSpacing: '-0.025em', ...style }}>
      {words.map((w, i) => {
        const s = spring({ frame: frame - delay - i * 3, fps, config: { damping: 200, mass: 0.7 } });
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: '0.08em' }}>
            <span style={{ display: 'inline-block', transform: `translateY(${(1 - s) * 105}%)`, opacity: s }}>{w}&nbsp;</span>
          </span>
        );
      })}
    </div>
  );
};

/** Texte courant qui apparaît en fondu. */
export const Body = ({ children, delay = 0, size = 44, color, style }) => {
  const s = useSpring(delay);
  return <div style={{ fontFamily: FONT, fontSize: size, lineHeight: 1.3, color, opacity: s, transform: `translateY(${(1 - s) * 24}px)`, ...style }}>{children}</div>;
};

/** Pastilles d'information (date, lieu…). */
export const Pills = ({ items, p, delay = 0 }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
    {items.map((t, i) => {
      const s = useSpring(delay + i * 5);
      return (
        <div key={i} style={{ fontFamily: FONT, fontSize: 34, fontWeight: 600, color: p.ink, background: 'rgba(255,255,255,0.82)', borderRadius: 999,
          padding: '16px 32px', boxShadow: '0 8px 24px rgba(40,60,80,0.07)', opacity: s, transform: `scale(${0.9 + s * 0.1})` }}>{t}</div>
      );
    })}
  </div>
);

/** Image détourée qui surgit du bas avec une ombre douce et une légère dérive. */
export const Cutout = ({ src, delay = 0, style, from = 220, drift = 18 }) => {
  const frame = useCurrentFrame();
  const s = useSpring(delay, { damping: 18, mass: 1, stiffness: 70 });
  const float = Math.sin(frame / 45) * drift * 0.3;
  return (
    <Img src={staticFile(src)} style={{ position: 'absolute', objectFit: 'contain', transform: `translateY(${(1 - s) * from + float}px)`, opacity: Math.min(1, s * 1.4),
      filter: 'drop-shadow(0 40px 50px rgba(40,60,80,0.18))', ...style }} />
  );
};

/** Photo en plein cadre arrondi avec lent zoom (effet « Ken Burns »). */
export const PhotoFrame = ({ src, delay = 0, style, zoom = [1.12, 1], pan = [0, 0], position = 'center', glow = false }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useSpring(delay);
  const k = interpolate(frame, [0, durationInFrames], [0, 1], { easing: Easing.inOut(Easing.quad) });
  const z = zoom[0] + (zoom[1] - zoom[0]) * k;
  // glow : photo de nuit en « superposition lumineuse » — le noir disparaît dans le fond
  // pastel, seules les lumières restent (pas d'aplat sombre, opaque sur la vitrine transparente)
  const frameStyle = glow
    ? { maskImage: 'radial-gradient(ellipse 70% 62% at 50% 50%, #000 55%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 70% 62% at 50% 50%, #000 55%, transparent 100%)', mixBlendMode: 'multiply' }
    : { borderRadius: 48, boxShadow: '0 40px 80px rgba(40,60,80,0.18)', border: '14px solid rgba(255,255,255,0.9)' };
  return (
    <div style={{ position: 'absolute', overflow: 'hidden', opacity: s, transform: `translateY(${(1 - s) * 80}px)`, ...frameStyle, ...style }}>
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: position,
        transform: `scale(${z}) translateX(${pan[0] + (pan[1] - pan[0]) * k}px)`, filter: glow ? 'invert(1) hue-rotate(180deg) saturate(1.4) brightness(1.04)' : 'none' }} />
    </div>
  );
};

/** Bandeau de marque en bas : rappel « point info » + crédit photo obligatoire. */
export const BrandBar = ({ p, credit }) => {
  const s = useSpring(6);
  return (
    <>
      <div style={{ position: 'absolute', left: 70, right: 70, bottom: 150, display: 'flex', alignItems: 'center', gap: 22, padding: '26px 34px', borderRadius: 34,
        background: 'rgba(255,255,255,0.86)', boxShadow: '0 14px 40px rgba(40,60,80,0.1)', opacity: s, transform: `translateY(${(1 - s) * 40}px)` }}>
        <Beacon color={p.ink} />
        <div style={{ fontFamily: FONT, lineHeight: 1.2 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#1f2b36' }}>Visualisez votre trajet en 3D</div>
          <div style={{ fontSize: 28, color: p.soft }}>Point info voyageurs · approchez-vous de l’écran</div>
        </div>
      </div>
      {credit && <div style={{ position: 'absolute', left: 70, right: 70, bottom: 92, fontFamily: FONT, fontSize: 20, color: 'rgba(60,80,95,0.6)', textAlign: 'center' }}>{credit}</div>}
    </>
  );
};

/** Balise pulsante (ondes concentriques). */
export const Beacon = ({ color, size = 60 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      {[0, 1].map((i) => {
        const t = ((frame + i * 22) % 44) / 44;
        return <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `4px solid ${color}`, opacity: 1 - t, transform: `scale(${0.5 + t * 0.9})` }} />;
      })}
      <div style={{ position: 'absolute', inset: size * 0.3, borderRadius: '50%', background: color }} />
    </div>
  );
};

export const credit = (c) => (c ? `Photo : ${c.auteur} · ${c.licence} · Wikimedia Commons` : '');
