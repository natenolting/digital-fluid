// PROTOTYPE (prototype/tween-motion): sweep each knob 0→1 in STEPS steps and
// print churn per preset × dither mode. Throwaway.
//
//   npx rolldown src/tween-sweep.ts --format esm --platform node -o /tmp/sweep.mjs && node /tmp/sweep.mjs
//
// flips/step  = cells that turned on or off between neighbouring frames (mean)
// %inked      = flips/step as a share of inked cells
// flips/cell  = over the whole one-way sweep, how often each touched cell flipped.
//               ~1 = a boundary sliding past (motion). ≫1 = cells blinking (flicker).
// blink%      = share of flips that undo themselves next frame (on-off-on). Motion
//               slower than a cell per frame never blinks; blinking = flicker or aliasing.
// passΔ/step  = hatch passes gained or lost per frame (line pops with no cell change)

declare const process: { env: Record<string, string | undefined> };

import { churn, frameParams, generate, inkMask, passCount, stages } from './tween-stages';

const STEPS = Number(process.env.STEPS ?? 60);
const SEED = Number(process.env.SEED ?? 1);
const PRESETS = (process.env.PRESETS ?? 'dense,sparse').split(',');

const rows: string[][] = [['preset', 'dither', 'knob', 'flips/step', '%inked', 'flips/cell', 'blink%', 'passΔ/step']];

for (const preset of PRESETS) {
  for (const hash of [false, true]) {
    for (const stage of stages) {
      let prev: Uint8Array | null = null;
      let prev2: Uint8Array | null = null;
      let blinks = 0;
      let prevPasses = 0;
      let flips = 0;
      let inked = 0;
      let passDelta = 0;
      let perCell: Uint16Array | null = null;
      for (let s = 0; s <= STEPS; s++) {
        const p = frameParams(preset, SEED, stage, s / STEPS, hash);
        const d = generate(p);
        const mask = inkMask(p, d);
        const c = churn(prev, prevPasses, mask, d);
        if (prev) {
          perCell ??= new Uint16Array(mask.length);
          for (let k = 0; k < mask.length; k++) perCell[k] += mask[k] ^ prev[k];
          if (prev2) for (let k = 0; k < mask.length; k++) blinks += +(prev2[k] === mask[k] && prev[k] !== mask[k]);
          flips += c.flipped;
          passDelta += c.passDelta;
        }
        inked += c.inked;
        prev2 = prev;
        prev = mask;
        prevPasses = passCount(d);
      }
      let touched = 0;
      let total = 0;
      for (const n of perCell!) if (n) (touched++, (total += n));
      const fps = flips / STEPS;
      rows.push([
        preset,
        hash ? 'hash' : 'stream',
        stage.name,
        fps.toFixed(0),
        ((fps / (inked / (STEPS + 1))) * 100).toFixed(1) + '%',
        touched ? (total / touched).toFixed(2) : '-',
        flips ? (((2 * blinks) / flips) * 100).toFixed(0) + '%' : '-',
        (passDelta / STEPS).toFixed(0),
      ]);
    }
  }
}

const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
for (const r of rows) console.log(r.map((c, i) => (i < 3 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  '));
