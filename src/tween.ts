// PROTOTYPE (prototype/tween-motion): tween one knob back and forth and watch
// whether it reads as motion or flicker. Throwaway. Open /tween.html under `npx vite`.

import GUI from 'lil-gui';
import { drawCanvas } from './render';
import { presets } from './params';
import type { Cell } from './grid';
import { churn, frameParams, generate, inkMask, passCount, stages } from './tween-stages';
import { smoothstep } from './rng';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const stage = document.getElementById('stage') as HTMLDivElement;
const info = document.getElementById('info') as HTMLDivElement;
const ctx = canvas.getContext('2d')!;

const s = {
  preset: 'sparse',
  knob: stages[0].name,
  hashDither: false,
  seed: 1,
  seconds: 3, // one way
  fps: 30, // 0 = every display frame; otherwise t snaps to video frames
  ease: true,
  playing: true,
  t: 0,
  showFlips: false,
};

let prev: Uint8Array | null = null;
let prevPasses = 0;
let prevCells = new Map<number, Cell>();
let lastKey = '';
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

  const st = stages.find((x) => x.name === s.knob)!;
  const key = `${s.preset}|${s.knob}|${s.hashDither}|${s.seed}`;
  if (key !== lastKey) {
    prev = null;
    prevCells = new Map();
    lastKey = key;
  }
  const drawnKey = `${key}|${s.t}|${s.showFlips}|${stage.clientWidth}x${stage.clientHeight}`;
  if (drawnKey === lastDrawn) return void requestAnimationFrame(frame);
  lastDrawn = drawnKey;
  const p = frameParams(s.preset, s.seed, st, s.t, s.hashDither);
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
    `${st.label(p)}\n` +
    `t ${s.t.toFixed(3)} · dither ${s.hashDither ? 'HASH' : 'stream'} · preset ${s.preset}\n` +
    `${c.inked} inked · ${c.flipped} flipped this frame (${((c.flipped / Math.max(c.inked, 1)) * 100).toFixed(1)}%) · ` +
    `${c.passDelta} hatch passes Δ · ${genMs.toFixed(0)}ms gen`;

  prev = mask;
  prevPasses = passCount(d);
  prevCells = cells;
  requestAnimationFrame(frame);
}

const gui = new GUI({ title: 'PROTOTYPE tween' });
gui.add(s, 'preset', Object.keys(presets));
const knobCtl = gui.add(s, 'knob', stages.map((x) => x.name));
const hashCtl = gui.add(s, 'hashDither').name('hash dither [h]');
gui.add(s, 'seed', 1, 1e6, 1);
gui.add(s, 'seconds', 0.5, 10, 0.5).name('seconds (one way)');
gui.add(s, 'fps', [0, 12, 24, 30, 60]).name('fps (0 = live)');
gui.add(s, 'ease').name('ease in/out');
const playCtl = gui.add(s, 'playing').name('play [space]');
const tCtl = gui.add(s, 't', 0, 1, 0.001).name('t (scrub)');
const flipCtl = gui.add(s, 'showFlips').name('show flips [f]');

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('.lil-gui')) return;
  if (e.key === ' ') (s.playing = !s.playing), playCtl.updateDisplay(), e.preventDefault();
  if (e.key === 'h') (s.hashDither = !s.hashDither), hashCtl.updateDisplay();
  if (e.key === 'f') (s.showFlips = !s.showFlips), flipCtl.updateDisplay();
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const i = stages.findIndex((x) => x.name === s.knob);
    const n = stages.length;
    s.knob = stages[(i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n].name;
    knobCtl.updateDisplay();
  }
});

requestAnimationFrame(frame);
