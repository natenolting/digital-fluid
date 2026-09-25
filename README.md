# digital fluid

Generative study after Gustavo Muñoz's "Next Move" pen-plotter pieces: 8-bit suminagashi rendered as hatched cells on a warped grid.

```
npm install
npm run dev
```

Keys: `r` new seed · `s` export SVG · `z` toggle 1:1 zoom (the fit-to-window preview aliases the hatching; zoom to judge line density).

## How it works

1. **Field**, `src/marbling.ts`: suminagashi as a list of ink operations (concentric drops, tine strokes, sine combs) using Jaffer's closed-form marbling maps. To sample a point, run each op's inverse from newest to oldest. The first drop the point falls inside sets its colour. The field is 1-bit and resolution-independent.
2. **Grid**, `src/grid.ts`: a coarse `cols × rows` grid. Each row's column widths are `exp(xWarp · noise(u, v))`, normalised to the page width. Squeezed columns turn into slivers that read as fine hatching. Because the noise drifts from row to row, the squeeze bands curve. `sampleMix` controls where each cell reads the field. At 0 it reads by cell index, so the marbling squishes along with the warp (the moiré look). At 1 it reads by warped position, so the marbling stays put and only the pixel sizes change.
3. **Hatch**, `src/hatch.ts`: each inked cell becomes one serpentine stroke of vertical passes. Cells narrower than the line spacing get a single centred line.
4. **Output**, `src/render.ts`: the same polylines go to the canvas and to a single-path SVG in millimetres. The params are embedded in `<metadata>` so you can reproduce a print.

The pipeline in `generate.ts` has no DOM dependency and runs under node too.

For plotting, run the exported SVG through [vpype](https://github.com/abey79/vpype) (`linesort`, `linemerge`) to cut pen-up travel.
