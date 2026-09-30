// PROTOTYPE (prototype/tween-motion): tween any set of smooth knobs back and
// forth and watch whether it reads as motion or flicker. Throwaway. Open
// /tween.html under `npx vite`.
//
// Every smooth knob has a base value (its slider). Tick "animate" and it tweens
// from that base value to its "to" value. Integer/boolean knobs stay fixed.

import GUI from 'lil-gui';
import { drawCanvas } from './render';
import { presets, type Params } from './params';
import type { Cell } from './grid';
import { churn, generate, inkMask, passCount } from './tween-stages';
import { lerp, smoothstep } from './rng';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const stage = document.getElementById('stage') as HTMLDivElement;
const info = document.getElementById('info') as HTMLDivElement;
const ctx = canvas.getContext('2d')!;

type Group = 'marble' | 'grid' | 'hatch' | 'paperP';
interface Smooth {
  group: Group;
  key: string;
  min: number;
  max: number;
  step: number;
}
// Same ranges as the main GUI.
const smooth: Smooth[] = [
  ['marble', 'dropRadius', 0.005, 0.15, 0.001],
  ['marble', 'jitter', 0, 2, 0.01],
  ['marble', 'tineStrength', 0, 0.5, 0.005],
  ['marble', 'tineLambda', 0.005, 0.3, 0.005],
  ['marble', 'waveAmp', 0, 0.2, 0.001],
  ['marble', 'waveFreq', 0.2, 10, 0.1],
  ['grid', 'xWarp', 0, 6, 0.01],
  ['grid', 'xWarpFreq', 0.1, 6, 0.01],
  ['grid', 'xWarpDrift', 0, 6, 0.01],
  ['grid', 'yWarp', 0, 3, 0.01],
  ['grid', 'yWarpFreq', 0.1, 6, 0.01],
  ['grid', 'edgeSqueeze', 0, 1, 0.01],
  ['grid', 'sampleMix', 0, 1, 0.01],
  ['grid', 'maskFreq', 0.2, 6, 0.01],
  ['grid', 'maskLo', 0, 1, 0.01],
  ['grid', 'maskHi', 0, 1, 0.01],
  ['hatch', 'spacing', 0.1, 2, 0.01],
  ['hatch', 'gapFrac', 0, 0.9, 0.01],
  ['hatch', 'gapMax', 0, 3, 0.01],
  ['hatch', 'gapY', 0, 3, 0.01],
  ['paperP', 'stroke', 0.05, 2, 0.01],
].map(([group, key, min, max, step]) => ({ group, key, min, max, step }) as Smooth);

const MASK_KEYS = new Set(['maskFreq', 'maskLo', 'maskHi']);
const id = (k: Smooth) => `${k.group}.${k.key}`;
const get = (p: Params, k: Smooth) => (p[k.group] as unknown as Record<string, number>)[k.key];
const put = (p: Params, k: Smooth, v: number) => {
  (p[k.group] as unknown as Record<string, number>)[k.key] = v;
};

const s = {
  preset: 'sparse',
  hashDither: true,
  seed: 1,
  seconds: 3, // one way
  fps: 30, // 0 = every display frame; otherwise t snaps to video frames
  ease: true,
  playing: true,
  t: 0,
  showFlips: false,
};

let base: Params = presets[s.preset]();
const tracks: Record<string, { animate: boolean; to: number }> = {};
for (const k of smooth) {
  const v = get(base, k);
  tracks[id(k)] = { animate: false, to: Math.min(k.max, v + (k.max - k.min) * 0.2) };
}
tracks['marble.jitter'] = { animate: true, to: 1 };

let prev: Uint8Array | null = null;
let prevPasses = 0;
let prevCells = new Map<number, Cell>();
let lastDrawn = '';
let clock = 0;
let lastNow = performance.now();

function frame(now: number) {
  const dt = (now - lastNow) / 1000;
  lastNow = now;
  if (s.playing) {
    clock += dt;
    let phase = (clock / s.seconds) % 2;
    if (s.fps > 0) phase = Math.floor(phase * s.seconds * s.fps) / (s.seconds * s.fps);
    const lin = phase < 1 ? phase : 2 - phase;
    s.t = s.ease ? smoothstep(0, 1, lin) : lin;
    tCtl.updateDisplay();
  }

  const p = structuredClone(base);
  p.seed = s.seed;
  p.grid.hashDither = s.hashDither;
  const moving: string[] = [];
  for (const k of smooth) {
    const tr = tracks[id(k)];
    if (!tr.animate) continue;
    const v = lerp(get(base, k), tr.to, s.t);
    put(p, k, v);
    moving.push(`${k.key} ${v.toFixed(3)}`);
  }

  const drawnKey = `${JSON.stringify(p)}|${s.showFlips}|${stage.clientWidth}x${stage.clientHeight}`;
  if (drawnKey === lastDrawn) return void requestAnimationFrame(frame);
  lastDrawn = drawnKey;

  const t0 = performance.now();
  const d = generate(p);
  const genMs = performance.now() - t0;

  const { width, height } = p.paperP;
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min((stage.clientWidth - 48) / width, (stage.clientHeight - 48) / height);
  canvas.style.width = `${width * fit}px`;
  canvas.style.height = `${height * fit}px`;
  const cw = Math.round(width * fit * dpr);
  const ch = Math.round(height * fit * dpr);
  if (canvas.width !== cw || canvas.height !== ch) (canvas.width = cw), (canvas.height = ch);
  drawCanvas(ctx, d, p.paperP, fit * dpr);

  const mask = inkMask(p, d);
  if (prev && prev.length !== mask.length) prev = null;
  const c = churn(prev, prevPasses, mask, d);
  const cells = new Map<number, Cell>();
  for (const cell of d.cells) cells.set(cell.j * p.grid.cols + cell.i, cell);

  if (s.showFlips && prev) {
    ctx.setTransform(fit * dpr, 0, 0, fit * dpr, 0, 0);
    for (let k = 0; k < mask.length; k++) {
      if (mask[k] === prev[k]) continue;
      const cell = mask[k] ? cells.get(k) : prevCells.get(k);
      if (!cell) continue;
      ctx.fillStyle = mask[k] ? 'rgba(0,170,80,.75)' : 'rgba(220,40,40,.75)';
      ctx.fillRect(cell.x0, cell.y0, cell.x1 - cell.x0, cell.y1 - cell.y0);
    }
  }

  info.textContent =
    `${moving.length ? moving.join(' · ') : 'nothing animating: tick "animate" on a knob'}\n` +
    `t ${s.t.toFixed(3)} · dither ${s.hashDither ? 'HASH' : 'stream'} · preset ${s.preset}\n` +
    `${c.inked} inked · ${c.flipped} flipped this frame (${((c.flipped / Math.max(c.inked, 1)) * 100).toFixed(1)}%) · ` +
    `${c.passDelta} hatch passes Δ · ${genMs.toFixed(0)}ms gen`;

  prev = mask;
  prevPasses = passCount(d);
  prevCells = cells;
  requestAnimationFrame(frame);
}

// ---- GUI -------------------------------------------------------------------
const gui = new GUI({ title: 'PROTOTYPE tween' });

const fplay = gui.addFolder('playback');
fplay.add(s, 'preset', Object.keys(presets)).onChange((name: string) => {
  base = presets[name]();
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
});
const hashCtl = fplay.add(s, 'hashDither').name('hash dither [h]');
fplay.add(s, 'seed', 1, 1e6, 1);
fplay.add(s, 'seconds', 0.5, 20, 0.5).name('seconds (one way)');
fplay.add(s, 'fps', [0, 12, 24, 30, 60]).name('fps (0 = live)');
fplay.add(s, 'ease').name('ease in/out');
const playCtl = fplay.add(s, 'playing').name('play [space]');
const tCtl = fplay.add(s, 't', 0, 1, 0.001).name('t (scrub)');
const flipCtl = fplay.add(s, 'showFlips').name('show flips [f]');
fplay.add({ stopAll: () => {
  for (const tr of Object.values(tracks)) tr.animate = false;
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  refreshToRows();
} }, 'stopAll').name('stop animating all');

// Base values are read through a getter so a preset switch shows up.
const baseProxy = (group: Group) =>
  new Proxy({}, {
    get: (_, key: string) => (base[group] as unknown as Record<string, unknown>)[key],
    set: (_, key: string, v) => (((base[group] as unknown as Record<string, unknown>)[key] = v), true),
  }) as Record<string, number | boolean>;

const toRows: { k: Smooth; ctl: ReturnType<GUI['add']> }[] = [];
function refreshToRows() {
  for (const r of toRows) r.ctl.show(tracks[id(r.k)].animate);
}

function knobFolder(title: string, group: Group, keys: (k: Smooth) => boolean, fixed: [string, number?, number?, number?][], open: boolean) {
  const f = gui.addFolder(title);
  const b = baseProxy(group);
  for (const [key, min, max, step] of fixed) {
    if (min === undefined) f.add(b, key).name(`${key} (fixed)`);
    else f.add(b, key, min, max, step).name(`${key} (fixed)`);
  }
  for (const k of smooth.filter((k) => k.group === group && keys(k))) {
    const tr = tracks[id(k)];
    f.add(b, k.key, k.min, k.max, k.step).name(k.key);
    f.add(tr, 'animate').name(`  ↳ animate ${k.key}`).onChange(refreshToRows);
    toRows.push({ k, ctl: f.add(tr, 'to', k.min, k.max, k.step).name(`  ↳ to`) });
  }
  if (!open) f.close();
}

knobFolder('marbling', 'marble', () => true, [
  ['centers', 1, 30, 1], ['ringsMin', 1, 80, 1], ['ringsMax', 1, 120, 1],
  ['tines', 0, 20, 1], ['waves', 0, 8, 1], ['inkBackground'],
], true);
knobFolder('grid + warp', 'grid', (k) => !MASK_KEYS.has(k.key), [['cols', 8, 300, 1], ['rows', 8, 200, 1]], false);
knobFolder('mask', 'grid', (k) => MASK_KEYS.has(k.key), [['maskOn']], false);
knobFolder('hatch', 'hatch', () => true, [['serpentine']], false);
knobFolder('pen', 'paperP', () => true, [], false);
refreshToRows();

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest?.('.lil-gui')) return;
  if (e.key === ' ') (s.playing = !s.playing), playCtl.updateDisplay(), e.preventDefault();
  if (e.key === 'h') (s.hashDither = !s.hashDither), hashCtl.updateDisplay();
  if (e.key === 'f') (s.showFlips = !s.showFlips), flipCtl.updateDisplay();
});

requestAnimationFrame(frame);
