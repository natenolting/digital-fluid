// PROTOTYPE (prototype/tween-motion): knob stages for the tween-motion demo and
// the churn metric shared by the page and the node sweep. Throwaway.

import { generate, type Drawing } from './generate';
import { presets, type Params } from './params';
import { lerp } from './rng';

export interface Stage {
  name: string;
  /** Write the knob value(s) for tween position t in [0,1]. */
  apply(p: Params, t: number): void;
  /** Force whatever the knob needs to be visible (e.g. maskOn for the mask band). */
  setup?(p: Params): void;
  label(p: Params): string;
}

const knob = <S extends 'marble' | 'grid' | 'hatch'>(stage: S, key: keyof Params[S] & string, a: number, b: number): Stage => ({
  name: `${stage}.${key}`,
  apply: (p, t) => {
    (p[stage] as unknown as Record<string, number>)[key] = lerp(a, b, t);
  },
  label: (p) => `${key} = ${(p[stage] as unknown as Record<string, number>)[key].toFixed(3)}  (${a} → ${b})`,
});

export const stages: Stage[] = [
  knob('marble', 'dropRadius', 0.03, 0.08),
  knob('marble', 'jitter', 0, 1),
  knob('marble', 'tineStrength', 0, 0.3),
  knob('marble', 'waveAmp', 0, 0.1),
  knob('grid', 'xWarp', 1, 5),
  knob('grid', 'xWarpDrift', 0, 3),
  knob('grid', 'sampleMix', 0, 1),
  {
    name: 'grid.maskLo/maskHi',
    setup: (p) => {
      p.grid.maskOn = true;
    },
    apply: (p, t) => {
      p.grid.maskLo = lerp(0.3, 0.45, t);
      p.grid.maskHi = lerp(0.55, 0.7, t);
    },
    label: (p) => `maskLo/Hi = ${p.grid.maskLo.toFixed(3)} / ${p.grid.maskHi.toFixed(3)}  (0.30/0.55 → 0.45/0.70)`,
  },
  knob('hatch', 'spacing', 0.3, 0.9),
  knob('hatch', 'gapFrac', 0.1, 0.6),
];

export function frameParams(preset: string, seed: number, stage: Stage, t: number, hashDither: boolean): Params {
  const p = presets[preset]();
  p.seed = seed;
  stage.setup?.(p);
  p.grid.hashDither = hashDither;
  stage.apply(p, t);
  return p;
}

/** What changed between two frames: cells that turned on/off, and hatch passes gained/lost. */
export interface Churn {
  inked: number;
  flipped: number;
  passes: number;
  passDelta: number;
}

export function inkMask(p: Params, d: Drawing): Uint8Array {
  const m = new Uint8Array(p.grid.cols * p.grid.rows);
  for (const c of d.cells) m[c.j * p.grid.cols + c.i] = 1;
  return m;
}

export const passCount = (d: Drawing) => d.lines.reduce((n, l) => n + l.length / 2, 0);

export function churn(prev: Uint8Array | null, prevPasses: number, mask: Uint8Array, d: Drawing): Churn {
  let flipped = 0;
  if (prev) for (let k = 0; k < mask.length; k++) flipped += mask[k] ^ prev[k];
  const passes = passCount(d);
  return { inked: d.cellCount, flipped, passes, passDelta: prev ? Math.abs(passes - prevPasses) : 0 };
}

export { generate };
