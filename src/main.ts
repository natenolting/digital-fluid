import GUI from 'lil-gui';
import { generate, type Drawing } from './generate';
import { drawCanvas, toSvg } from './render';
import { defaults, presets, type Params } from './params';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const stage = document.getElementById('stage') as HTMLDivElement;
const info = document.getElementById('info') as HTMLDivElement;
const ctx = canvas.getContext('2d')!;

const params: Params = defaults();
const view = { zoom: false, zoomPxPerMm: 6 };

// Seed lives in the URL hash so a good one can be bookmarked / shared.
const hashSeed = Number(new URLSearchParams(location.hash.slice(1)).get('seed'));
if (Number.isFinite(hashSeed) && hashSeed > 0) params.seed = hashSeed;

let drawing: Drawing;

function render() {
  const t0 = performance.now();
  drawing = generate(params);
  const t1 = performance.now();

  const { width, height } = params.paperP;
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min((stage.clientWidth - 48) / width, (stage.clientHeight - 48) / height);
  const cssPxPerMm = view.zoom ? view.zoomPxPerMm : fit;
  canvas.style.width = `${width * cssPxPerMm}px`;
  canvas.style.height = `${height * cssPxPerMm}px`;
  canvas.width = Math.round(width * cssPxPerMm * dpr);
  canvas.height = Math.round(height * cssPxPerMm * dpr);
  stage.classList.toggle('zoom', view.zoom);

  drawCanvas(ctx, drawing, params.paperP, cssPxPerMm * dpr);

  history.replaceState(null, '', `#seed=${params.seed}`);
  info.textContent =
    `seed ${params.seed} · ${drawing.cellCount} cells · ${drawing.lines.length} strokes · ` +
    `${(t1 - t0).toFixed(0)}ms gen · [r] reseed  [s] svg  [z] zoom`;
}

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    render();
  });
}

function download(name: string, data: BlobPart, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const actions = {
  reseed() {
    params.seed = Math.floor(Math.random() * 1e9);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    schedule();
  },
  exportSvg() {
    download(`digital-fluid-${params.seed}.svg`, toSvg(drawing, params.paperP, { params }), 'image/svg+xml');
  },
  exportPng() {
    canvas.toBlob((b) => b && download(`digital-fluid-${params.seed}.png`, b, 'image/png'));
  },
  copyParams() {
    navigator.clipboard.writeText(JSON.stringify(params, null, 2));
  },
};

// ---- GUI -------------------------------------------------------------------
const gui = new GUI({ title: 'digital fluid' });
gui.onChange(schedule);

gui.add(params, 'seed', 1, 1e9, 1);
gui.add(actions, 'reseed').name('new seed [r]');
const presetState = { preset: 'dense' };
gui
  .add(presetState, 'preset', Object.keys(presets))
  .name('preset')
  .onChange((name: string) => {
    const seed = params.seed;
    const next = presets[name]();
    Object.assign(params.paperP, next.paperP);
    Object.assign(params.marble, next.marble);
    Object.assign(params.grid, next.grid);
    Object.assign(params.hatch, next.hatch);
    params.seed = seed;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  });

const fm = gui.addFolder('marbling (field)');
fm.add(params.marble, 'centers', 1, 30, 1);
fm.add(params.marble, 'ringsMin', 1, 80, 1);
fm.add(params.marble, 'ringsMax', 1, 120, 1);
fm.add(params.marble, 'dropRadius', 0.005, 0.15, 0.001);
fm.add(params.marble, 'jitter', 0, 2, 0.01);
fm.add(params.marble, 'tines', 0, 20, 1);
fm.add(params.marble, 'tineStrength', 0, 0.5, 0.005);
fm.add(params.marble, 'tineLambda', 0.005, 0.3, 0.005);
fm.add(params.marble, 'waves', 0, 8, 1);
fm.add(params.marble, 'waveAmp', 0, 0.2, 0.001);
fm.add(params.marble, 'waveFreq', 0.2, 10, 0.1);
fm.add(params.marble, 'inkBackground');

const fg = gui.addFolder('grid + warp');
fg.add(params.grid, 'cols', 8, 300, 1);
fg.add(params.grid, 'rows', 8, 200, 1);
fg.add(params.grid, 'xWarp', 0, 6, 0.01).name('xWarp (squeeze)');
fg.add(params.grid, 'xWarpFreq', 0.1, 6, 0.01);
fg.add(params.grid, 'xWarpDrift', 0, 6, 0.01).name('xWarpDrift (rows)');
fg.add(params.grid, 'yWarp', 0, 3, 0.01);
fg.add(params.grid, 'yWarpFreq', 0.1, 6, 0.01);
fg.add(params.grid, 'edgeSqueeze', 0, 1, 0.01);
fg.add(params.grid, 'sampleMix', 0, 1, 0.01).name('sampleMix (idx→pos)');

const fk = gui.addFolder('mask (paper showing)');
fk.add(params.grid, 'maskOn');
fk.add(params.grid, 'maskFreq', 0.2, 6, 0.01);
fk.add(params.grid, 'maskLo', 0, 1, 0.01);
fk.add(params.grid, 'maskHi', 0, 1, 0.01);
fk.close();

const fh = gui.addFolder('hatch');
fh.add(params.hatch, 'spacing', 0.1, 2, 0.01).name('spacing (mm)');
fh.add(params.hatch, 'gapFrac', 0, 0.9, 0.01);
fh.add(params.hatch, 'gapMax', 0, 3, 0.01).name('gapMax (mm)');
fh.add(params.hatch, 'gapY', 0, 3, 0.01).name('gapY (mm)');
fh.add(params.hatch, 'serpentine');
fh.close();

const fp = gui.addFolder('paper + pen');
fp.add(params.paperP, 'width', 50, 1000, 1).name('width (mm)');
fp.add(params.paperP, 'height', 50, 1000, 1).name('height (mm)');
fp.add(params.paperP, 'margin', 0, 100, 1).name('margin (mm)');
fp.add(params.paperP, 'stroke', 0.05, 2, 0.01).name('pen width (mm)');
fp.addColor(params.paperP, 'paper');
fp.addColor(params.paperP, 'ink');
fp.add(view, 'zoom').name('zoom 1:1 [z]');
fp.add(view, 'zoomPxPerMm', 2, 20, 0.5).name('zoom px/mm');
fp.close();

const fx = gui.addFolder('export');
fx.add(actions, 'exportSvg').name('SVG (plotter) [s]');
fx.add(actions, 'exportPng').name('PNG (preview)');
fx.add(actions, 'copyParams').name('copy params JSON');

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('.lil-gui')) return;
  if (e.key === 'r') actions.reseed();
  if (e.key === 's') actions.exportSvg();
  if (e.key === 'z') {
    view.zoom = !view.zoom;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    schedule();
  }
});
window.addEventListener('resize', schedule);

render();
