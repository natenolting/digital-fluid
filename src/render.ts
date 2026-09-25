import type { Drawing } from './generate';
import type { PaperParams } from './params';

export function drawCanvas(ctx: CanvasRenderingContext2D, d: Drawing, paper: PaperParams, pxPerMm: number) {
  const { canvas } = ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = paper.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(pxPerMm, 0, 0, pxPerMm, 0, 0);
  ctx.strokeStyle = paper.ink;
  ctx.lineWidth = paper.stroke;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  for (const line of d.lines) {
    ctx.moveTo(line[0][0], line[0][1]);
    for (let k = 1; k < line.length; k++) ctx.lineTo(line[k][0], line[k][1]);
  }
  ctx.stroke();
}

const f = (n: number) => n.toFixed(3).replace(/\.?0+$/, '');

/** Plotter-ready SVG in millimetres: one <path>, stroke only, no fills. */
export function toSvg(
  d: Drawing,
  paper: PaperParams,
  opts: { background?: boolean; params?: unknown } = {},
): string {
  const parts: string[] = [];
  for (const line of d.lines) {
    parts.push('M' + line.map(([x, y]) => `${f(x)} ${f(y)}`).join('L'));
  }
  const bg = opts.background ? `<rect width="100%" height="100%" fill="${paper.paper}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${d.width}mm" height="${d.height}mm" viewBox="0 0 ${d.width} ${d.height}">
${opts.params ? `<metadata><![CDATA[${JSON.stringify(opts.params)}]]></metadata>\n` : ''}${bg}<path d="${parts.join('')}" fill="none" stroke="${paper.ink}" stroke-width="${paper.stroke}" stroke-linecap="butt" stroke-linejoin="miter"/>
</svg>
`;
}
