import React from 'react';
import { Composition } from 'remotion';
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';
import { PointInfo, CiteDeNoel, Beffroi, Biennale, Novembre, Services, Retro, Agenda } from './spots.jsx';

const FPS = 30;
const W = 1080, H = 1920;
// ordre de la boucle : le rappel « point info » revient régulièrement
const SEQUENCE = [
  [PointInfo, 6], [CiteDeNoel, 7], [Beffroi, 7], [Biennale, 7],
  [PointInfo, 5], [Novembre, 7], [Services, 7], [Retro, 7], [Agenda, 7],
];
const T = 18; // durée des transitions (images)
const total = SEQUENCE.reduce((s, [, d]) => s + d * FPS, 0) - (SEQUENCE.length - 1) * T;

const Boucle = () => (
  <TransitionSeries>
    {SEQUENCE.flatMap(([C, d], i) => {
      const items = [<TransitionSeries.Sequence key={`s${i}`} durationInFrames={d * FPS}><C /></TransitionSeries.Sequence>];
      if (i < SEQUENCE.length - 1) {
        items.push(<TransitionSeries.Transition key={`t${i}`} timing={i % 2 ? linearTiming({ durationInFrames: T }) : springTiming({ durationInFrames: T, config: { damping: 200 } })}
          presentation={i % 2 ? fade() : slide({ direction: 'from-bottom' })} />);
      }
      return items;
    })}
  </TransitionSeries>
);

export const Root = () => (
  <>
    <Composition id="Boucle" component={Boucle} durationInFrames={total} fps={FPS} width={W} height={H} />
    {[PointInfo, CiteDeNoel, Beffroi, Biennale, Novembre, Services, Retro, Agenda].map((C) => (
      <Composition key={C.name} id={C.name} component={C} durationInFrames={7 * FPS} fps={FPS} width={W} height={H} />
    ))}
  </>
);
