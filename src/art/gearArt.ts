// Little illustrations of the gear items (shirt, shorts, shoes, racket, bag) in the colours of the item and the accent of its brand.
// Drawn with Phaser Graphics on a 40x40 design grid centred on (cx, cy). Used by the collection and the gear screens.

import type Phaser from 'phaser';
import { brandById, type GearItem } from '../career/gear';

const OUTLINE = 0x0b2a5b;

type Pt = [number, number];

const hex = (s: string | undefined, fallback: number): number => (s && /^#[0-9a-f]{6}$/i.test(s) ? parseInt(s.slice(1), 16) : fallback);

/** Mixes `c` with white (t > 0) or black (t < 0). */
export function shade(c: number, t: number): number {
  const target = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  const ch = (v: number): number => Math.round(v + (target - v) * k);
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

/** Draws the item. `size` is the width and height of the picture in pixels. */
export function drawGear(g: Phaser.GameObjects.Graphics, it: GearItem, cx: number, cy: number, size: number): void {
  const u = size / 40;
  const base = hex(it.color, 0x8d9bb0);
  const accent = hex(brandById(it.brand)?.colors[3], 0xffb800);
  const dark = shade(base, -0.38);
  let rot = 0;
  const P = ([x, y]: Pt): { x: number; y: number } => {
    const rx = x * Math.cos(rot) - y * Math.sin(rot);
    const ry = x * Math.sin(rot) + y * Math.cos(rot);
    return { x: cx + rx * u, y: cy + ry * u };
  };
  const line = Math.max(1.2, 1.6 * u);
  const fill = (pts: Pt[], color: number, alpha = 1, outline = true): void => {
    const q = pts.map(P);
    g.fillStyle(color, alpha);
    g.fillPoints(q, true);
    if (outline) {
      g.lineStyle(line, OUTLINE, 1);
      g.strokePoints(q, true);
    }
  };
  const stroke = (pts: Pt[], color: number, w: number, alpha = 1): void => {
    g.lineStyle(Math.max(1, w * u), color, alpha);
    g.strokePoints(pts.map(P), false);
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, color: number, alpha = 1, outline = true): void => fill([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], color, alpha, outline);

  if (it.slot === 'top') {
    fill([[-6, -15], [-15, -11], [-20, -2], [-14, 1], [-11, -3], [-11, 16], [11, 16], [11, -3], [14, 1], [20, -2], [15, -11], [6, -15], [3, -12], [0, -10.5], [-3, -12]], base);
    rect(-10.5, 4, 10.5, 8, accent, 1, false);
    rect(-10.5, -3, -7, 15.5, 0xffffff, 0.22, false);
    stroke([[-20, -2], [-14, 1]], accent, 3);
    stroke([[20, -2], [14, 1]], accent, 3);
    fill([[-6, -15], [6, -15], [3, -12], [0, -10.5], [-3, -12]], dark);
  } else if (it.slot === 'shorts') {
    fill([[-13, -6], [13, -6], [15, 14], [2, 14], [0, 3], [-2, 14], [-15, 14]], base);
    fill([[-13, -6], [-11, -6], [-13, 14], [-15, 14]], accent, 1, false);
    fill([[13, -6], [11, -6], [13, 14], [15, 14]], accent, 1, false);
    rect(-13, -12, 13, -6, dark);
    stroke([[-2, -9], [-3, -2]], 0xffffff, 1.4);
    stroke([[2, -9], [3, -2]], 0xffffff, 1.4);
    rect(-12, -5, -8, 12, 0xffffff, 0.2, false);
  } else if (it.slot === 'shoes') {
    // Side view, toe to the right.
    fill([[-18, 8], [-18, -9], [-9, -11], [-4, -5], [4, -2], [14, 3], [19, 8], [19, 10], [-18, 10]], base);
    fill([[-18, -9], [-9, -11], [-8, -6], [-18, -4]], dark);
    stroke([[-12, 3], [-2, 5.5], [9, 1]], accent, 3.4);
    for (const x of [-3, 0.5, 4]) stroke([[x, -5 + (x + 3) * 0.45], [x + 1.6, -1.5 + (x + 3) * 0.45]], 0xffffff, 1.4);
    rect(-19, 10, 20, 15, 0xf4f6fa);
    stroke([[-19, 12.4], [20, 12.4]], shade(OUTLINE, 0.5), 0.8);
    rect(-17, -7, -13, 6, 0xffffff, 0.2, false);
  } else if (it.slot === 'racket') {
    rot = -0.5;
    const s = 1.7;
    const head: Pt[] =
      it.shape === 'diamond'
        ? ([[0, -10], [6.5, -5], [5, -1.5], [0, 3], [-5, -1.5], [-6.5, -5], [-3.2, -9.2]] as Pt[]).map(([x, y]) => [x * s, y * s - 4])
        : it.shape === 'round'
          ? Array.from({ length: 28 }, (_, i): Pt => [Math.cos((i / 28) * Math.PI * 2) * 11.5, Math.sin((i / 28) * Math.PI * 2) * 11.5 - 6])
          : ([[0, -10.5], [5.4, -7.5], [5.8, -3.5], [2.2, 2.6], [-2.2, 2.6], [-5.8, -3.5], [-5.4, -7.5]] as Pt[]).map(([x, y]) => [x * s, y * s - 4]);
    // Handle first (behind the frame), then the strings, then the frame.
    rect(-2.4, 6, 2.4, 19, 0x2b3350);
    for (const y of [9, 12, 15]) stroke([[-2.4, y], [2.4, y + 1.6]], 0xffffff, 1, 0.7);
    rect(-3, 18, 3, 20, accent);
    fill(head, 0xffffff, 0.85, false);
    const ys = head.map((p) => p[1]);
    const xs = head.map((p) => p[0]);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    for (let y = y0 + 3; y < y1 - 1; y += 3.4) stroke([[x0 + 2, y], [x1 - 2, y]], base, 0.6, 0.45);
    for (let x = x0 + 3; x < x1 - 1; x += 3.4) stroke([[x, y0 + 2], [x, y1 - 2]], base, 0.6, 0.45);
    g.lineStyle(Math.max(2, 5.4 * u), OUTLINE, 1);
    g.strokePoints(head.map(P), true);
    g.lineStyle(Math.max(1.4, 3.2 * u), base, 1);
    g.strokePoints(head.map(P), true);
    stroke([[-3.4, y1 - 0.5], [0, 7], [3.4, y1 - 0.5]], dark, 2.6);
  } else {
    // Bag: a duffel with a handle, a pocket and a strap.
    stroke([[-8, -6], [-8, -12], [8, -12], [8, -6]], OUTLINE, 3.6);
    stroke([[-8, -6], [-8, -12], [8, -12], [8, -6]], dark, 1.8);
    fill([[-17, 0], [-14, -7], [14, -7], [17, 0], [17, 11], [14, 14], [-14, 14], [-17, 11]], base);
    rect(-16.5, -6.5, 16.5, -1, 0xffffff, 0.22, false);
    stroke([[-16, -1], [16, -1]], dark, 1.2);
    rect(-12, 3, -2, 11, accent);
    rect(4, -7, 8, 14, accent, 1, false);
    stroke([[4, -7], [4, 14]], OUTLINE, 1.2);
    stroke([[8, -7], [8, 14]], OUTLINE, 1.2);
    stroke([[10, 5], [14, 5]], dark, 1.6);
  }
}
