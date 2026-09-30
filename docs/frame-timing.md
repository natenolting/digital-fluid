# Frame timing

Answers [How fast is one frame?](https://github.com/natenolting/digital-fluid/issues/2).

- **Machine:** Apple M2 Max, macOS 26.6.2, 120 Hz display.
- **Browser:** Chrome 154 (Playwright, headed, GPU: ANGLE Metal).
- **Script:** `src/bench.ts`, open `/bench.html` under `npx vite`. 2 warm-up runs, median of 10.
- **Date:** 2026-09-30.

## Columns

- `gen` — `generate()` alone, new seed each run (ms).
- `live` — on-screen canvas, `generate()` + `drawCanvas()` once per `requestAnimationFrame`, `xWarp` nudged each frame like a tween. Wall time per frame (ms) and the fps that gives. Capped at 120 fps (8.3 ms) by the display.
- `export` — `drawCanvas()` + a full-frame `getImageData()` read-back on an off-screen canvas (ms). Worst case: the read-back pushes Chrome to CPU raster, so this is mostly CPU drawing cost. A WebCodecs `VideoFrame(canvas)` path may be cheaper.

## Results

| case | strokes | points | gen | live 1080px | live 2160px | export 1080px | export 2160px |
|---|---:|---:|---:|---:|---:|---:|---:|
| `dense` | 3,368 | 27,842 | 12.5 | 8.8 (114 fps) | 8.4 (119 fps) | 78.7 | 54.6 |
| `sparse` | 1,482 | 14,314 | 14.0 | 8.4 (119 fps) | 8.4 (119 fps) | 16.6 | 19.1 |
| `chunky` | 1,349 | 21,062 | 3.1 | 8.3 (120 fps) | 8.4 (119 fps) | 90.7 | 77.4 |
| `moire` | 3,480 | 29,920 | 32.0 | 25.8 (39 fps) | 25.1 (40 fps) | 75.9 | 53.7 |
| max grid (300×200) | 28,088 | 110,264 | 106.3 | 83.4 (12 fps) | 83.3 (12 fps) | 87.4 | 76.2 |
| max rings (80–120) | 3,775 | 31,942 | 15.0 | 8.3 (120 fps) | 8.5 (118 fps) | 80.9 | 56.5 |
| max grid + rings | 30,645 | 122,768 | 125.3 | 83.1 (12 fps) | 83.1 (12 fps) | 93.2 | 80.2 |
| fine hatch (spacing 0.2) | 3,368 | 58,566 | 13.7 | 9.3 (108 fps) | 9.4 (106 fps) | 23.4 | 34.2 |

## What it means

- **All four presets play live at 30 fps or better.** `moire` is the tightest at ~40 fps.
- **`generate()` is the bottleneck, not drawing.** On-screen GPU drawing is nearly free; canvas size (1080 vs 2160) barely matters live.
- **Grid size is what kills it.** `cols`/`rows` near the GUI max drop to ~12 fps. Rings and hatch spacing barely move the number.
- **Export is fine offline.** Worst case ≈ 125 ms gen + 95 ms draw/read-back ≈ 0.22 s/frame, so 10 s at 30 fps (300 frames) ≈ 66 s before encoding.

## Caveats

- One fast machine. Expect a slower laptop to be 2–4× slower, which would push `moire` under 30 fps.
- Chrome only. Safari and Firefox not measured.
- `live` is a little lower than `gen` for the same case. `live` holds seed 1 and runs after `gen` warmed the JIT, so treat `gen` as the safer number.
- Export timing leaves out encoding, which the canvas-to-video research covers.
