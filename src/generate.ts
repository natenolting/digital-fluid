// Pure pipeline: params → polylines in mm. No DOM, so it runs in node too.

import { makeProgram } from './marbling';
import { buildCells } from './grid';
import { hatchCells, type Polyline } from './hatch';
import { stream } from './rng';
import type { Params } from './params';

export interface Drawing {
  width: number;
  height: number;
  lines: Polyline[];
  cellCount: number;
}

export function generate(p: Params): Drawing {
  const { width, height, margin } = p.paperP;
  const ops = makeProgram(stream(p.seed, 'marble'), p.marble);
  const cells = buildCells(p.seed, p.grid, ops, p.marble.inkBackground, {
    x: margin,
    y: margin,
    w: width - margin * 2,
    h: height - margin * 2,
  });
  return { width, height, lines: hatchCells(cells, p.hatch), cellCount: cells.length };
}
