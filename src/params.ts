import type { MarbleParams } from './marbling';
import type { GridParams } from './grid';
import type { HatchParams } from './hatch';

export interface PaperParams {
  width: number;  // mm
  height: number; // mm
  margin: number; // mm
  paper: string;
  ink: string;
  stroke: number; // pen tip width (mm)
}

export interface Params {
  seed: number;
  paperP: PaperParams;
  marble: MarbleParams;
  grid: GridParams;
  hatch: HatchParams;
}

export const defaults = (): Params => ({
  seed: 1,
  paperP: {
    width: 300,
    height: 300,
    margin: 12,
    paper: '#efe9dd',
    ink: '#2447c4',
    stroke: 0.35,
  },
  marble: {
    centers: 12,
    ringsMin: 14,
    ringsMax: 34,
    dropRadius: 0.05,
    jitter: 0.25,
    tines: 3,
    tineStrength: 0.12,
    tineLambda: 0.05,
    waves: 2,
    waveAmp: 0.04,
    waveFreq: 2,
    inkBackground: false,
  },
  grid: {
    cols: 130,
    rows: 56,
    xWarp: 3.4,
    xWarpFreq: 1.3,
    xWarpDrift: 1.4,
    yWarp: 0.35,
    yWarpFreq: 1.5,
    edgeSqueeze: 0.6,
    sampleMix: 0,
    maskOn: false,
    maskFreq: 1.4,
    maskLo: 0.35,
    maskHi: 0.6,
  },
  hatch: {
    spacing: 0.45,
    gapFrac: 0.3,
    gapMax: 0.7,
    gapY: 0.2,
    serpentine: true,
  },
});

/** Starting points. "dense" ≈ the full-sheet pieces, "sparse" ≈ the masked, fragmentary ones. */
export const presets: Record<string, () => Params> = {
  dense: defaults,
  sparse: () => {
    const p = defaults();
    p.grid.maskOn = true;
    p.grid.maskFreq = 1.2;
    p.grid.maskLo = 0.4;
    p.grid.maskHi = 0.62;
    return p;
  },
  chunky: () => {
    const p = defaults();
    p.grid.cols = 70;
    p.grid.rows = 40;
    p.marble.centers = 8;
    p.marble.dropRadius = 0.07;
    return p;
  },
  moire: () => {
    const p = defaults();
    p.marble.ringsMin = 40;
    p.marble.ringsMax = 90;
    p.marble.dropRadius = 0.03;
    p.grid.sampleMix = 0.6;
    return p;
  },
};
