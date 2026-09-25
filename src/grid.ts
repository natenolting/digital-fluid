// The "8-bit" part: a coarse cols×rows grid of 1-bit cells whose COLUMN WIDTHS
// vary smoothly per row. Where the warp squeezes, cells collapse into thin
// slivers that read as fine hatching; where it relaxes, cells open into chunky
// pixels. Because the warp drifts slowly from row to row, the squeeze zones
// curve down the page — that's the moiré / lens-bulge look.

import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { type Rng, lerp, smoothstep, stream } from './rng';
import { type Op, sampleInk } from './marbling';

export interface GridParams {
  cols: number;
  rows: number;
  xWarp: number;        // strength of column-width variation (log scale)
  xWarpFreq: number;    // how many squeeze/relax zones across a row
  xWarpDrift: number;   // how fast the zones move from row to row
  yWarp: number;        // row-height variation (rows stay straight)
  yWarpFreq: number;
  edgeSqueeze: number;  // extra compression toward left/right page edges
  sampleMix: number;    // 0 = sample field by cell index (pattern squishes with the warp), 1 = by warped position
  maskOn: boolean;      // leave paper showing in some regions
  maskFreq: number;
  maskLo: number;       // mask falloff; cells are randomly dropped across this band
  maskHi: number;
}

export interface Cell {
  i: number;
  j: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface Layout {
  x: number;
  y: number;
  w: number;
  h: number;
}

function fbm(n: NoiseFunction2D, x: number, y: number): number {
  return n(x, y) * 0.65 + n(x * 2.03 + 17.1, y * 2.03 - 5.3) * 0.35;
}

/** Positive weights → cumulative boundaries spanning [start, start+size]. */
function boundaries(weights: number[], start: number, size: number): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const out = [start];
  let acc = 0;
  for (const w of weights) {
    acc += w;
    out.push(start + (acc / total) * size);
  }
  return out;
}

export function buildCells(
  seed: number,
  p: GridParams,
  ops: Op[],
  inkBackground: boolean,
  box: Layout,
): Cell[] {
  const warpNoise = createNoise2D(stream(seed, 'xwarp'));
  const rowNoise = createNoise2D(stream(seed, 'ywarp'));
  const maskNoise = createNoise2D(stream(seed, 'mask'));
  const dropRng: Rng = stream(seed, 'mask-dither');

  const { cols, rows } = p;

  const rowW = Array.from({ length: rows }, (_, j) =>
    Math.exp(p.yWarp * fbm(rowNoise, (j / rows) * p.yWarpFreq, 3.7)),
  );
  const ys = boundaries(rowW, box.y, box.h);

  const cells: Cell[] = [];
  for (let j = 0; j < rows; j++) {
    const v = (j + 0.5) / rows;
    const colW = Array.from({ length: cols }, (_, i) => {
      const u = (i + 0.5) / cols;
      const edge = 1 - p.edgeSqueeze * (1 - smoothstep(0, 0.18, Math.min(u, 1 - u)));
      return Math.exp(p.xWarp * fbm(warpNoise, u * p.xWarpFreq, v * p.xWarpDrift)) * Math.max(edge, 0.02);
    });
    const xs = boundaries(colW, box.x, box.w);

    for (let i = 0; i < cols; i++) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      const y0 = ys[j];
      const y1 = ys[j + 1];

      // Where to read the marbling field for this cell.
      const uIdx = (i + 0.5) / cols;
      const vIdx = v;
      const uGeo = ((x0 + x1) / 2 - box.x) / box.w;
      const vGeo = ((y0 + y1) / 2 - box.y) / box.h;
      const fu = lerp(uIdx, uGeo, p.sampleMix);
      const fv = lerp(vIdx, vGeo, p.sampleMix);

      if (!sampleInk(ops, fu, fv, inkBackground)) continue;

      if (p.maskOn) {
        const m = (maskNoise(uGeo * p.maskFreq, vGeo * p.maskFreq) + 1) / 2;
        if (smoothstep(p.maskLo, p.maskHi, m) < dropRng()) continue;
      }

      cells.push({ i, j, x0, x1, y0, y1 });
    }
  }
  return cells;
}
