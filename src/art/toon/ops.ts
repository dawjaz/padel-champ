/**
 * Drawing operations for the "toon" character style (flat cel shading, dark outline). Pure data: a list of
 * SVG-style paths that can be drawn on a Canvas2D context (`drawOps`, via Path2D, synchronous) or exported
 * as an SVG string (`toSvg`, used by tests and for the design mock-ups).
 */
export type Mat = [number, number, number, number, number, number];

export interface PathOp {
  k: 'p';
  /** SVG path data. */
  d: string;
  fill?: string;
  stroke?: string;
  sw?: number;
  cap?: 'round' | 'butt';
  /** Opacity 0..1. */
  a?: number;
  m?: Mat;
}
export interface GroupOp {
  k: 'g';
  m: Mat;
  ops: Op[];
}
export type Op = PathOp | GroupOp;

/** The picture covers x -20..220, y -34..346 in character units. */
export const VIEW = { x: -20, y: -34, w: 240, h: 380 } as const;

export const translate = (tx: number, ty: number): Mat => [1, 0, 0, 1, tx, ty];
export const rotateAbout = (deg: number, cx: number, cy: number): Mat => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
};
export const scaleAbout = (k: number, cx: number, cy: number): Mat => [k, 0, 0, k, cx - k * cx, cy - k * cy];

const n = (v: number): string => String(Math.round(v * 100) / 100);

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0Z`;
}

export function rectPath(x: number, y: number, w: number, h: number, r = 0): string {
  if (r <= 0) return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;
  return `M${n(x + r)} ${n(y)}h${n(w - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(r)}v${n(h - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(r)}h${n(-(w - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(-r)}v${n(-(h - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(-r)}Z`;
}

function setPaint(ctx: CanvasRenderingContext2D, o: PathOp): void {
  ctx.globalAlpha = o.a ?? 1;
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fill(new Path2D(o.d));
  }
  if (o.stroke && o.sw) {
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = o.sw;
    ctx.lineCap = o.cap ?? 'butt';
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(o.d));
  }
}

export function drawOps(ctx: CanvasRenderingContext2D, ops: Op[]): void {
  for (const o of ops) {
    ctx.save();
    if (o.m) ctx.transform(...o.m);
    if (o.k === 'g') drawOps(ctx, o.ops);
    else setPaint(ctx, o);
    ctx.restore();
  }
}

/** Renders the ops into a new canvas; `unit` = pixels per character unit (the full picture is 240 x 380 units). */
export function renderOpsCanvas(ops: Op[], unit: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(VIEW.w * unit);
  canvas.height = Math.round(VIEW.h * unit);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  ctx.scale(unit, unit);
  ctx.translate(-VIEW.x, -VIEW.y);
  drawOps(ctx, ops);
  return canvas;
}

const matStr = (m: Mat): string => `matrix(${m.map(n).join(' ')})`;

function opSvg(o: Op): string {
  const t = o.m ? ` transform="${matStr(o.m)}"` : '';
  if (o.k === 'g') return `<g${t}>${o.ops.map(opSvg).join('')}</g>`;
  const f = `fill="${o.fill ?? 'none'}"`;
  const s = o.stroke && o.sw ? ` stroke="${o.stroke}" stroke-width="${n(o.sw)}" stroke-linecap="${o.cap ?? 'butt'}" stroke-linejoin="round"` : '';
  const a = o.a !== undefined && o.a !== 1 ? ` opacity="${n(o.a)}"` : '';
  return `<path d="${o.d}" ${f}${s}${a}${t}/>`;
}

export function toSvg(ops: Op[], width = 240): string {
  const h = Math.round((width * VIEW.h) / VIEW.w);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" width="${width}" height="${h}">${ops.map(opSvg).join('')}</svg>`;
}

/** Shades a "#rrggbb" colour in HSL: lightness x `light`, saturation x `sat` (both clamped). */
export function shadeHex(color: string, light: number, sat = 1): string {
  const v = parseInt(color.replace('#', ''), 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  l = Math.max(0, Math.min(1, l * light));
  s = Math.max(0, Math.min(1, s * sat));
  const hue = (p: number, q: number, t0: number): number => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let rr = l;
  let gg = l;
  let bb = l;
  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rr = hue(p, q, h + 1 / 3);
    gg = hue(p, q, h);
    bb = hue(p, q, h - 1 / 3);
  }
  const to = (x: number): string => Math.floor(x * 255).toString(16).padStart(2, '0');
  return `#${to(rr)}${to(gg)}${to(bb)}`;
}

/** Relative brightness 0..1 of a "#rrggbb" colour. */
export function luma(color: string): number {
  const v = parseInt(color.replace('#', ''), 16);
  return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
}
