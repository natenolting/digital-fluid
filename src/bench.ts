// Frame-timing bench for the "How fast is one frame?" ticket.
// Open /bench.html under `vite`; results land in #out and window.benchResult.

import { generate } from './generate';
import { drawCanvas } from './render';
import { presets, type Params } from './params';

const RUNS = 10;
const WARMUP = 2;
const SIZES = [1080, 2160]; // square canvas px (video-ish, and ~retina fit)

type Case = { name: string; make: () => Params };

const heavy = (name: string, tweak: (p: Params) => void): Case => ({
  name,
  make: () => {
    const p = presets.dense();
    tweak(p);
    return p;
  },
});

const cases: Case[] = [
  ...Object.keys(presets).map((name) => ({ name, make: presets[name] })),
  heavy('max grid (300x200)', (p) => { p.grid.cols = 300; p.grid.rows = 200; }),
  heavy('max rings (80-120)', (p) => { p.marble.ringsMin = 80; p.marble.ringsMax = 120; }),
  heavy('max grid + rings', (p) => {
    p.grid.cols = 300; p.grid.rows = 200; p.marble.ringsMin = 80; p.marble.ringsMax = 120;
  }),
  heavy('fine hatch (spacing 0.2)', (p) => { p.hatch.spacing = 0.2; }),
];

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

// Live: an on-screen canvas, generate + draw once per rAF, knob nudged each frame
// like a tween would. Wall time per frame is what playback would actually get.
async function live(p: Params, size: number): Promise<number[]> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.style.width = canvas.style.height = '300px';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const base = p.grid.xWarp;
  const times: number[] = [];
  let last = await nextFrame();
  for (let i = 0; i < WARMUP + RUNS; i++) {
    p.grid.xWarp = base + i * 0.01;
    drawCanvas(ctx, generate(p), p.paperP, size / p.paperP.width);
    const now = await nextFrame();
    if (i >= WARMUP) times.push(now - last);
    last = now;
  }
  p.grid.xWarp = base;
  canvas.remove();
  return times;
}

// Export: draw + read the whole frame back, as an encoder would need.
function exportFrame(p: Params, size: number): number[] {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const d = generate(p);
  const times: number[] = [];
  for (let i = 0; i < WARMUP + RUNS; i++) {
    const t0 = performance.now();
    drawCanvas(ctx, d, p.paperP, size / p.paperP.width);
    ctx.getImageData(0, 0, size, size);
    const t1 = performance.now();
    if (i >= WARMUP) times.push(t1 - t0);
  }
  return times;
}

const rows: Record<string, unknown>[] = [];
for (const c of cases) {
  const p = c.make();
  const gen: number[] = [];
  let d = generate(p);
  for (let i = 0; i < WARMUP + RUNS; i++) {
    p.seed = 1 + i;
    const t0 = performance.now();
    d = generate(p);
    const t1 = performance.now();
    if (i >= WARMUP) gen.push(t1 - t0);
  }
  p.seed = 1;
  const row: Record<string, unknown> = {
    case: c.name,
    strokes: d.lines.length,
    points: d.lines.reduce((n, l) => n + l.length, 0),
    genMed: median(gen),
  };
  for (const size of SIZES) {
    const t = await live(p, size);
    row[`live${size}Med`] = median(t);
    row[`live${size}Fps`] = 1000 / median(t);
  }
  for (const size of SIZES) row[`export${size}Med`] = median(exportFrame(p, size));
  rows.push(row);
}

const ms = (v: unknown) => (typeof v === 'number' ? v.toFixed(1) : String(v));
const header = Object.keys(rows[0]);
document.getElementById('out')!.textContent =
  navigator.userAgent + '\n\n' +
  header.join('\t') + '\n' +
  rows.map((r) => header.map((h) => ms(r[h])).join('\t')).join('\n');
(window as unknown as { benchResult: unknown }).benchResult = { ua: navigator.userAgent, rows };
