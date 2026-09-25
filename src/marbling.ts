// Suminagashi-style marbling as a 1-bit field, after Aubrey Jaffer's
// "Mathematical Marbling" (https://people.csail.mit.edu/jaffer/Marbling/).
//
// Instead of simulating ink polygons, we keep the list of operations and, for
// any sample point, run the INVERSE of each op from newest to oldest. The first
// drop the point lands inside decides its colour; if it survives every op it
// is background. Every op here has an exact closed-form inverse, so the field
// is resolution-independent and cheap to sample on a coarse grid.

import { type Rng, range } from './rng';

export type Op =
  | { kind: 'drop'; cx: number; cy: number; r: number; ink: boolean }
  // Tine stroke: drag a line through (px,py) along unit dir (mx,my).
  // Displacement falls off with distance d from the line: alpha*lambda/(d+lambda).
  | { kind: 'tine'; px: number; py: number; mx: number; my: number; alpha: number; lambda: number }
  // Sinusoidal comb: shift along one axis as a function of the other.
  | { kind: 'wave'; axis: 'x' | 'y'; amp: number; freq: number; phase: number };

export interface MarbleParams {
  centers: number;      // number of ink drop sites
  ringsMin: number;     // concentric drops per site
  ringsMax: number;
  dropRadius: number;   // radius of each drop, in field units (field is 0..1)
  jitter: number;       // wobble of repeated drops around the site
  tines: number;        // straight tine strokes
  tineStrength: number; // max tine displacement
  tineLambda: number;   // tine falloff (smaller = sharper feathering)
  waves: number;        // sinusoidal comb passes
  waveAmp: number;
  waveFreq: number;
  inkBackground: boolean;
}

export function makeProgram(rng: Rng, p: MarbleParams): Op[] {
  const ops: Op[] = [];

  // Sites are interleaved round-robin so later sites push earlier ones around
  // and the rings deform into each other, like real floating ink.
  const sites = Array.from({ length: p.centers }, () => ({
    cx: range(rng, 0.05, 0.95),
    cy: range(rng, 0.05, 0.95),
    rings: Math.round(range(rng, p.ringsMin, p.ringsMax)),
    r: p.dropRadius * range(rng, 0.6, 1.4),
    ink: rng() < 0.5,
  }));
  const maxRings = Math.max(...sites.map((s) => s.rings), 0);
  for (let k = 0; k < maxRings; k++) {
    for (const s of sites) {
      if (k >= s.rings) continue;
      ops.push({
        kind: 'drop',
        cx: s.cx + (rng() - 0.5) * p.jitter * s.r,
        cy: s.cy + (rng() - 0.5) * p.jitter * s.r,
        r: s.r,
        ink: (k % 2 === 0) === s.ink,
      });
    }
  }

  for (let t = 0; t < p.tines; t++) {
    const a = rng() * Math.PI * 2;
    ops.push({
      kind: 'tine',
      px: rng(),
      py: rng(),
      mx: Math.cos(a),
      my: Math.sin(a),
      alpha: (rng() < 0.5 ? -1 : 1) * p.tineStrength * range(rng, 0.4, 1),
      lambda: p.tineLambda,
    });
  }

  for (let w = 0; w < p.waves; w++) {
    ops.push({
      kind: 'wave',
      axis: rng() < 0.5 ? 'x' : 'y',
      amp: p.waveAmp * range(rng, 0.5, 1),
      freq: p.waveFreq * range(rng, 0.6, 1.4) * Math.PI * 2,
      phase: rng() * Math.PI * 2,
    });
  }

  return ops;
}

/** Is there ink at (x, y)? Coordinates in 0..1 field space. */
export function sampleInk(ops: Op[], x: number, y: number, inkBackground: boolean): boolean {
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];
    if (op.kind === 'drop') {
      const dx = x - op.cx;
      const dy = y - op.cy;
      const d2 = dx * dx + dy * dy;
      const r2 = op.r * op.r;
      if (d2 < r2) return op.ink;
      // Forward: p' = c + (p-c)·sqrt(1 + r²/|p-c|²). Inverse:
      const s = Math.sqrt(1 - r2 / d2);
      x = op.cx + dx * s;
      y = op.cy + dy * s;
    } else if (op.kind === 'tine') {
      // Perpendicular distance is unchanged by the shift, so the inverse is exact.
      const d = Math.abs((x - op.px) * -op.my + (y - op.py) * op.mx);
      const shift = (op.alpha * op.lambda) / (d + op.lambda);
      x -= op.mx * shift;
      y -= op.my * shift;
    } else {
      if (op.axis === 'x') x -= op.amp * Math.sin(y * op.freq + op.phase);
      else y -= op.amp * Math.sin(x * op.freq + op.phase);
    }
  }
  return inkBackground;
}
