# Tween motion: churn sweep (PROTOTYPE)

Branch `prototype/tween-motion`. Each knob swept one way (0→1) in STEPS frames, seed 1.
Run: `npx rolldown src/tween-sweep.ts --format esm --platform node -o /tmp/sweep.mjs && STEPS=60 node /tmp/sweep.mjs`

- `flips/step`: cells that turn on or off between frames (mean).
- `flips/cell`: over the whole sweep, how often each touched cell flipped. ~1 = a boundary sliding past.
- `blink%`: share of flips undone next frame (on-off-on). Flicker signature.
- `passΔ/step`: hatch lines gained/lost per frame with no cell change.
- `stream` = today's mask dither (one shared RNG, pulled only for inked cells). `hash` = per-cell hash of (seed, i, j).

Mask off (`dense`) → stream and hash are identical, as expected.

## 60 steps (2 s at 30 fps)

```
preset  dither  knob                 flips/step  %inked  flips/cell  blink%  passΔ/step
dense   stream  marble.dropRadius          1596   45.1%       13.35     44%         163
dense   stream  marble.jitter               109    3.0%        1.84     14%          40
dense   stream  marble.tineStrength         860   23.6%        7.38     27%         149
dense   stream  marble.waveAmp              159    4.4%        2.46     21%          46
dense   stream  grid.xWarp                    0    0.0%           -       -          25
dense   stream  grid.xWarpDrift               0    0.0%           -       -          42
dense   stream  grid.sampleMix              793   21.8%        7.33     38%         117
dense   stream  grid.maskLo/maskHi           10    0.6%        1.00      0%          54
dense   stream  hatch.spacing                 0    0.0%           -       -         226
dense   stream  hatch.gapFrac                 0    0.0%           -       -          51
dense   hash    marble.dropRadius          1596   45.1%       13.35     44%         163
dense   hash    marble.jitter               109    3.0%        1.84     14%          40
dense   hash    marble.tineStrength         860   23.6%        7.38     27%         149
dense   hash    marble.waveAmp              159    4.4%        2.46     21%          46
dense   hash    grid.xWarp                    0    0.0%           -       -          25
dense   hash    grid.xWarpDrift               0    0.0%           -       -          42
dense   hash    grid.sampleMix              793   21.8%        7.33     38%         117
dense   hash    grid.maskLo/maskHi           11    0.6%        1.00      0%          56
dense   hash    hatch.spacing                 0    0.0%           -       -         226
dense   hash    hatch.gapFrac                 0    0.0%           -       -          51
sparse  stream  marble.dropRadius           839   49.1%       12.43     59%          97
sparse  stream  marble.jitter               333   19.4%        7.91     83%          51
sparse  stream  marble.tineStrength         734   42.8%       10.89     57%          97
sparse  stream  marble.waveAmp              357   21.0%        7.96     80%          58
sparse  stream  grid.xWarp                   12    0.7%        1.05      0%          19
sparse  stream  grid.xWarpDrift             100    7.3%        3.14      5%          60
sparse  stream  grid.sampleMix              735   43.7%       11.36     65%          83
sparse  stream  grid.maskLo/maskHi           12    0.7%        1.00      0%          57
sparse  stream  hatch.spacing                 0    0.0%           -       -          80
sparse  stream  hatch.gapFrac                 0    0.0%           -       -          24
sparse  hash    marble.dropRadius           609   36.0%       11.28     40%          74
sparse  hash    marble.jitter                60    3.5%        2.17     17%          23
sparse  hash    marble.tineStrength         483   28.3%        8.85     31%          75
sparse  hash    marble.waveAmp               90    5.4%        2.95     25%          25
sparse  hash    grid.xWarp                   12    0.7%        1.05      0%          17
sparse  hash    grid.xWarpDrift              99    7.3%        3.08      5%          56
sparse  hash    grid.sampleMix              480   28.9%        9.20     43%          77
sparse  hash    grid.maskLo/maskHi           12    0.7%        1.00      0%          57
sparse  hash    hatch.spacing                 0    0.0%           -       -          78
sparse  hash    hatch.gapFrac                 0    0.0%           -       -          23
```

## 240 steps (8 s at 30 fps)

```
preset  dither  knob                 flips/step  %inked  flips/cell  blink%  passΔ/step
dense   stream  marble.dropRadius           472   13.3%       15.78     14%          92
dense   stream  marble.jitter                31    0.8%        2.05     10%          20
dense   stream  marble.tineStrength         275    7.5%        9.43     22%          72
dense   stream  marble.waveAmp               46    1.3%        2.85     13%          24
dense   stream  grid.xWarp                    0    0.0%           -       -           7
dense   stream  grid.xWarpDrift               0    0.0%           -       -          16
dense   stream  grid.sampleMix              275    7.6%       10.17     29%          71
dense   stream  grid.maskLo/maskHi            3    0.1%        1.00      0%          13
dense   stream  hatch.spacing                 0    0.0%           -       -          57
dense   stream  hatch.gapFrac                 0    0.0%           -       -          13
dense   hash    marble.dropRadius           472   13.3%       15.78     14%          92
dense   hash    marble.jitter                31    0.8%        2.05     10%          20
dense   hash    marble.tineStrength         275    7.5%        9.43     22%          72
dense   hash    marble.waveAmp               46    1.3%        2.85     13%          24
dense   hash    grid.xWarp                    0    0.0%           -       -           7
dense   hash    grid.xWarpDrift               0    0.0%           -       -          16
dense   hash    grid.sampleMix              275    7.6%       10.17     29%          71
dense   hash    grid.maskLo/maskHi            3    0.2%        1.00      0%          14
dense   hash    hatch.spacing                 0    0.0%           -       -          57
dense   hash    hatch.gapFrac                 0    0.0%           -       -          13
sparse  stream  marble.dropRadius           453   26.5%       26.26     68%          82
sparse  stream  marble.jitter               273   16.0%       25.46     91%          48
sparse  stream  marble.tineStrength         426   24.9%       24.90     73%          77
sparse  stream  marble.waveAmp              281   16.6%       24.45     89%          56
sparse  stream  grid.xWarp                    3    0.2%        1.05      0%           7
sparse  stream  grid.xWarpDrift              25    1.8%        3.15      0%          25
sparse  stream  grid.sampleMix              436   25.9%       26.58     73%          78
sparse  stream  grid.maskLo/maskHi            3    0.2%        1.00      0%          14
sparse  stream  hatch.spacing                 0    0.0%           -       -          20
sparse  stream  hatch.gapFrac                 0    0.0%           -       -           6
sparse  hash    marble.dropRadius           195   11.6%       14.48     20%          45
sparse  hash    marble.jitter                17    1.0%        2.47     11%          13
sparse  hash    marble.tineStrength         160    9.4%       11.72     26%          37
sparse  hash    marble.waveAmp               26    1.6%        3.43     13%          13
sparse  hash    grid.xWarp                    3    0.2%        1.05      0%           8
sparse  hash    grid.xWarpDrift              25    1.8%        3.10      0%          26
sparse  hash    grid.sampleMix              172   10.3%       13.16     31%          43
sparse  hash    grid.maskLo/maskHi            3    0.2%        1.00      0%          14
sparse  hash    hatch.spacing                 0    0.0%           -       -          20
sparse  hash    hatch.gapFrac                 0    0.0%           -       -           6
```
