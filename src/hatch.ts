// Turn filled cells into pen strokes. Each cell becomes one serpentine
// polyline of vertical passes at the pen's line spacing — a single pen-down
// per cell. Cells narrower than the spacing get a single centred line, which
// is what makes squeezed columns read as fine hatching.

import type { Cell } from './grid';

export interface HatchParams {
  spacing: number; // distance between hatch passes (mm)
  gapFrac: number; // gutter between neighbouring cells, as a fraction of cell width…
  gapMax: number;  // …capped at this many mm
  gapY: number;    // gutter between rows (mm)
  serpentine: boolean; // join passes into one zig-zag stroke
}

export type Polyline = [number, number][];

export function hatchCells(cells: Cell[], p: HatchParams): Polyline[] {
  const out: Polyline[] = [];
  for (const c of cells) {
    const y0 = c.y0 + p.gapY / 2;
    const y1 = c.y1 - p.gapY / 2;
    if (y1 <= y0) continue;

    const w = c.x1 - c.x0;
    const gutter = Math.min(w * p.gapFrac, p.gapMax);
    const inner = w - gutter;
    const xs: number[] = [];
    if (inner <= p.spacing) {
      xs.push((c.x0 + c.x1) / 2);
    } else {
      const n = Math.floor(inner / p.spacing) + 1;
      const step = inner / (n - 1);
      const start = c.x0 + gutter / 2;
      for (let k = 0; k < n; k++) xs.push(start + k * step);
    }

    if (p.serpentine) {
      const line: Polyline = [];
      xs.forEach((x, k) => {
        if (k % 2 === 0) line.push([x, y0], [x, y1]);
        else line.push([x, y1], [x, y0]);
      });
      out.push(line);
    } else {
      for (const x of xs) out.push([[x, y0], [x, y1]]);
    }
  }
  return out;
}
