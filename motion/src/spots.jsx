/*
 * Spots de la boucle de veille — uniquement des informations liées à Béthune.
 * Sources : bethune.fr, programme de la biennale (agglo Béthune-Bruay), UNESCO.
 * Relevé le 12/11/2026 : à mettre à jour avant diffusion.
 */
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import credits from '../assets/credits.json';
import { PALETTES, PastelBackground, Kicker, BigTitle, Body, Pills, Cutout, PhotoFrame, BrandBar, Beacon, FONT, credit, useSpring } from './kit.jsx';

const Pad = ({ children, top = 200 }) => <div style={{ position: 'absolute', left: 90, right: 90, top }}>{children}</div>;

/* ---------- Point info : invitation à s'approcher ---------- */
export const PointInfo = () => {
  const p = PALETTES.ciel;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useSpring(10);
  const iso = interpolate(frame, [0, durationInFrames], [0, 1]);
  return (
    <AbsoluteFill>
      <PastelBackground p={p} />
      <Cutout src="cutouts/beffroi.png" delay={8} style={{ right: -60, bottom: 260, height: 1300 }} />
      <Pad top={230}>
        <Kicker p={p}>Point info voyageurs</Kicker>
        <BigTitle text={'Où allez-vous ?'} delay={6} size={118} style={{ marginTop: 50, maxWidth: 640 }} />
        <Body delay={22} size={44} color={p.soft} style={{ marginTop: 34, maxWidth: 560 }}>
          Train, bus, tram, à pied : visualisez votre trajet <b style={{ color: p.ink }}>en 3D</b>, du hall de la gare jusqu’à votre destination.
        </Body>
      </Pad>
      <div style={{ position: 'absolute', left: 90, top: 1420, display: 'flex', alignItems: 'center', gap: 30, opacity: s, transform: `translateY(${(1 - s) * 40}px)` }}>
        <Beacon color={p.ink} size={110} />
        <div style={{ fontFamily: FONT }}>
          <div style={{ fontSize: 52, fontWeight: 700, color: '#1f2b36' }}>Approchez-vous</div>
          <div style={{ fontSize: 36, color: p.soft }}>ou touchez l’écran</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 90, bottom: 110, fontFamily: FONT, fontSize: 20, color: 'rgba(60,80,95,0.6)', opacity: iso > 0.05 ? 1 : 0 }}>{credit(credits.beffroi)}</div>
    </AbsoluteFill>
  );
};

/* ---------- Cité de Noël ---------- */
export const CiteDeNoel = () => {
  const p = PALETTES.rose;
  return (
    <AbsoluteFill>
      <PastelBackground p={p} />
      <PhotoFrame src="photos/grandplace.jpg" delay={4} zoom={[1.5, 1.3]} pan={[-60, 60]} style={{ left: 90, right: 90, top: 150, height: 900 }} position="64% 45%" />
      <Sparkles area={{ left: 90, top: 150, width: 900, height: 900 }} />
      <Pad top={1110}>
        <Kicker p={p} delay={10}>Ville de Béthune</Kicker>
        <BigTitle text="La Cité de Noël" delay={14} size={118} style={{ marginTop: 34 }} />
        <Body delay={24} size={42} color={p.soft} style={{ marginTop: 18 }}>Chalets, illuminations et animations au pied du beffroi.</Body>
        <div style={{ marginTop: 34 }}><Pills p={p} delay={30} items={['27 nov. → 27 déc.', 'Grand’Place', 'Entrée libre']} /></div>
      </Pad>
      <BrandBar p={p} credit={credit(credits.grandplace)} />
    </AbsoluteFill>
  );
};

/** Scintillements festifs (lueurs douces qui pulsent et descendent lentement) au-dessus d'une photo. */
const Sparkles = ({ area, n = 46 }) => {
  const frame = useCurrentFrame();
  const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  return (
    <div style={{ position: 'absolute', ...area, borderRadius: 48, overflow: 'hidden', pointerEvents: 'none',
      background: 'linear-gradient(180deg, rgba(255,214,228,0.28), rgba(255,238,214,0.18))' }}>
      {Array.from({ length: n }, (_, i) => {
        const size = 8 + rnd(i, 1) * 22;
        const y = ((rnd(i, 2) * area.height + frame * (0.6 + rnd(i, 3))) % (area.height + 40)) - 20;
        const x = rnd(i, 4) * area.width + Math.sin(frame / 30 + i) * 12;
        const a = 0.35 + 0.65 * Math.abs(Math.sin(frame / (14 + rnd(i, 5) * 20) + i));
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%',
          background: 'radial-gradient(circle, #fffdf6 0%, rgba(255,236,190,0.9) 35%, rgba(255,220,170,0) 70%)', opacity: a }} />;
      })}
    </div>
  );
};

/* ---------- Beffroi, patrimoine mondial ---------- */
export const Beffroi = () => {
  const p = PALETTES.citron;
  const frame = useCurrentFrame();
  const n = Math.round(interpolate(frame, [20, 60], [0, 47], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  return (
    <AbsoluteFill>
      <PastelBackground p={p} />
      <Cutout src="cutouts/beffroi.png" delay={2} style={{ right: 40, bottom: 300, height: 1500 }} from={420} />
      <Pad top={210}>
        <div style={{ maxWidth: 520 }}>
        <Kicker p={p}>Patrimoine</Kicker>
        <BigTitle text="Le beffroi" delay={6} size={120} style={{ marginTop: 44 }} />
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 210, color: p.ink, lineHeight: 1, marginTop: 30, letterSpacing: '-0.04em' }}>
          {n}<span style={{ fontSize: 90, fontWeight: 600 }}> m</span>
        </div>
        <Body delay={40} size={40} color={p.soft} style={{ marginTop: 20, maxWidth: 440 }}>
          Inscrit au patrimoine mondial de l’UNESCO depuis 2005, avec les beffrois de Belgique et de France.
        </Body>
        </div>
      </Pad>
      <BrandBar p={p} credit={credit(credits.beffroi)} />
    </AbsoluteFill>
  );
};

/* ---------- Biennale « Les mondes invisibles » ---------- */
export const Biennale = () => {
  const p = PALETTES.lavande;
  return (
    <AbsoluteFill>
      <PastelBackground p={p} />
      <Pad top={200}>
        <Kicker p={p}>Agglo Béthune-Bruay · Biennale</Kicker>
        <BigTitle text="Les mondes invisibles" delay={6} size={124} style={{ marginTop: 44 }} />
        <Body delay={20} size={42} color={p.soft} style={{ marginTop: 22 }}>D’Augustin Lesage à aujourd’hui : derniers jours pour découvrir l’exposition.</Body>
        <div style={{ marginTop: 36 }}><Pills p={p} delay={28} items={['Jusqu’au 15 novembre', 'Labanque', 'Chapelle Saint-Pry']} /></div>
      </Pad>
      <PhotoFrame src="photos/labanque.jpg" delay={14} zoom={[1.15, 1.02]} style={{ left: 90, right: 90, top: 960, height: 640 }} position="50% 45%" />
      <BrandBar p={p} credit={credit(credits.labanque)} />
    </AbsoluteFill>
  );
};

/* ---------- Novembre : vivre-ensemble et Novembre Bleu ---------- */
export const Novembre = () => {
  const p = PALETTES.ciel;
  const Card = ({ delay, title, text, ink, bg }) => {
    const s = useSpring(delay, { damping: 16, stiffness: 80 });
    return (
      <div style={{ background: bg, borderRadius: 44, padding: '46px 50px', boxShadow: '0 24px 60px rgba(40,60,80,0.1)', marginTop: 34,
        opacity: s, transform: `translateX(${(1 - s) * 140}px)` }}>
        <div style={{ fontFamily: FONT, fontSize: 66, fontWeight: 700, color: ink, lineHeight: 1.05 }}>{title}</div>
        <div style={{ fontFamily: FONT, fontSize: 38, color: '#4d6070', marginTop: 16, lineHeight: 1.3 }}>{text}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <PastelBackground p={p} />
      <Pad top={380}>
        <Kicker p={p}>Ville de Béthune</Kicker>
        <BigTitle text="En novembre à Béthune" delay={6} size={116} style={{ marginTop: 44 }} />
        <Card delay={20} title="Le mois du vivre-ensemble" text="Rencontres et animations dans les quartiers tout au long du mois." ink="#1d7a56" bg="rgba(227,246,238,0.92)" />
        <Card delay={32} title="Novembre Bleu" text="Un mois pour parler de la santé des hommes : prévention et dépistage." ink="#0d6f9a" bg="rgba(214,238,252,0.95)" />
      </Pad>
      <BrandBar p={p} />
    </AbsoluteFill>
  );
};

/* ---------- Services : B-Clic et Pass'Jeunes ---------- */
export const Services = () => {
  const p = PALETTES.menthe;
  return (
    <AbsoluteFill>
      <PastelBackground p={p} />
      <Cutout src="cutouts/hoteldeville.png" delay={4} style={{ right: -40, bottom: 330, height: 1300 }} />
      <Pad top={220}>
        <Kicker p={p}>Ville de Béthune</Kicker>
        <BigTitle text="La mairie dans votre poche" delay={6} size={112} style={{ marginTop: 44, maxWidth: 640 }} />
        <Body delay={20} size={40} color={p.soft} style={{ marginTop: 26, maxWidth: 560 }}>
          <b style={{ color: p.ink }}>B-Clic</b> : vos démarches en ligne, 7 jours sur 7.
        </Body>
        <Body delay={30} size={40} color={p.soft} style={{ marginTop: 22, maxWidth: 560 }}>
          <b style={{ color: p.ink }}>Pass’Jeunes 2026</b> : les bons plans culture, sport et loisirs des 0-25 ans.
        </Body>
      </Pad>
      <BrandBar p={p} credit={credit(credits.hoteldeville)} />
    </AbsoluteFill>
  );
};

/* ---------- Béthune Rétro ---------- */
export const Retro = () => {
  const p = PALETTES.peche;
  const frame = useCurrentFrame();
  // rayons rétro qui tournent lentement derrière le titre
  const rays = Array.from({ length: 18 }, (_, i) => (
    <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: 1600, height: 90, marginTop: -45, transformOrigin: '0 50%',
      transform: `rotate(${i * 20 + frame * 0.15}deg)`, background: i % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(251,214,194,0.45)' }} />
  ));
  return (
    <AbsoluteFill>
      <PastelBackground p={p} />
      <div style={{ position: 'absolute', left: 540, top: 900, width: 0, height: 0 }}>{rays}</div>
      <Pad top={420}>
        <Kicker p={p}>Le rendez-vous de l’été</Kicker>
        <div style={{ marginTop: 70, textAlign: 'center' }}>
          <BigTitle text="Béthune" delay={6} size={190} weight={800} color={p.ink} style={{ fontStyle: 'italic' }} />
          <BigTitle text="Rétro" delay={12} size={230} weight={800} color="#1f2b36" style={{ fontStyle: 'italic', marginTop: -20 }} />
        </div>
        <Body delay={26} size={44} color={p.soft} style={{ marginTop: 40, textAlign: 'center' }}>
          Rockabilly, voitures anciennes et concerts gratuits dans le centre-ville.
        </Body>
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}><Pills p={p} delay={34} items={['Fin août', 'Centre-ville', 'Entrée libre']} /></div>
      </Pad>
      <BrandBar p={p} />
    </AbsoluteFill>
  );
};

/* ---------- Agenda : Béthune, ça bouge ! ---------- */
export const Agenda = () => {
  const p = PALETTES.ciel;
  return (
    <AbsoluteFill>
      <PastelBackground p={p} />
      <Cutout src="cutouts/hoteldeville.png" delay={4} style={{ left: 70, top: 260, height: 820 }} />
      <Cutout src="cutouts/beffroi.png" delay={10} style={{ right: 110, top: 120, height: 960 }} />
      <Pad top={1070}>
        <Kicker p={p} delay={8}>Ville de Béthune</Kicker>
        <BigTitle text={'Béthune, ça bouge !'} delay={12} size={104} style={{ marginTop: 30 }} />
        <Body delay={22} size={40} color={p.soft} style={{ marginTop: 14 }}>Concerts, expositions, marchés, sport : tout l’agenda de la ville.</Body>
        <div style={{ marginTop: 24 }}><Pills p={p} delay={30} items={['agenda-bethune.fr']} /></div>
      </Pad>
      <BrandBar p={p} credit={`Photos : ${credits.hoteldeville.auteur} · ${credits.hoteldeville.licence} · Wikimedia Commons`} />
    </AbsoluteFill>
  );
};
