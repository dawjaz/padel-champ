// Little illustrations of the gear items (shirt, shorts, shoes, racket, bag) in the colours of the item and the accent of its brand.
// Drawn with Phaser Graphics on a 40x40 design grid centred on (cx, cy). Used by the collection and the gear screens.

import type Phaser from 'phaser';
import { brandById, type GearItem } from '../career/gear';
import { inside, racketGeom, RACKET } from './racketShape';

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
    // A padel racket at real proportions (art/racketShape.ts): solid face with holes, an open throat, a short grip with a
    // wrist cord. Basic and pro models have a light fibreglass face, technical and elite a carbon one (with a weave).
    rot = -0.5;
    const geo = racketGeom(it.shape ?? 'teardrop');
    const k = 41 / RACKET.length;
    const mid = RACKET.length / 2;
    const at = (pts: Pt[]): Pt[] => pts.map(([x, y]): Pt => [x * k, (y + mid) * k]);
    const carbon = it.rarity === 'epic' || it.rarity === 'legendary';
    const elite = it.rarity === 'legendary';
    const lum = (((base >> 16) & 255) * 0.3 + ((base >> 8) & 255) * 0.59 + (base & 255) * 0.11) / 255;
    const faceCol = carbon ? 0x1d222b : lum > 0.75 ? 0xd5dbe4 : shade(base, 0.8);
    const thin = Math.max(0.8, 0.9 * u);
    const poly = (pts: Pt[], color: number, alpha = 1): void => {
      g.fillStyle(color, alpha);
      g.fillPoints(at(pts).map(P), true);
    };
    const outline = (pts: Pt[], color: number, w: number, close = true, alpha = 1): void => {
      g.lineStyle(Math.max(0.7, w * u), color, alpha);
      g.strokePoints(at(pts).map(P), close);
    };
    // wrist cord, grip (overgrip with wraps), butt cap
    const gw = RACKET.gripW / 2;
    stroke(at([[-0.6, 0.3], [-1.6, 2], [-0.8, 3.4], [0.8, 3.4], [1.6, 2], [0.6, 0.3]]), 0x2a2f3a, 0.6, 0.7);
    fill(at([[-gw, -RACKET.gripTo], [gw, -RACKET.gripTo], [gw, 0], [-gw, 0]]), 0x262b36, 1, false);
    for (let y = -1.6; y > -RACKET.gripTo + 0.8; y -= 2) stroke(at([[-gw, y], [gw, y - 1.1]]), 0xffffff, 0.4, 0.18);
    fill(at([[-RACKET.buttW / 2, -1.3], [RACKET.buttW / 2, -1.3], [RACKET.buttW / 2, 0.4], [-RACKET.buttW / 2, 0.4]]), accent, 1, false);
    // frame (head + throat arms), the face, the graphics, the holes
    poly(geo.head, base);
    poly(geo.arms[0], base);
    poly(geo.arms[1], base);
    poly(geo.face, faceCol);
    if (carbon) {
      // a fine carbon weave: short diagonal ticks inside the face
      const zone = geo.face;
      let row = 0;
      for (let y = -RACKET.length + 2; y < -RACKET.faceFrom - 1; y += 1.8, row++) {
        for (let x = -12 + (row % 2) * 0.9; x < 12; x += 1.8) {
          const q: Pt = [x, y];
          if (inside(zone, q)) stroke(at([q, [q[0] + 0.7, q[1] - 0.7]]), 0xffffff, 0.3, 0.06);
        }
      }
    }
    if (it.rarity !== 'common') poly(geo.sweep, base, 0.92);
    poly(geo.stripe, elite ? 0xf2c230 : accent);
    for (const [x, y] of geo.holes) {
      const c = P(at([[x, y]])[0]);
      g.fillStyle(carbon ? 0x0a0d12 : 0xa9b1bd, 0.9);
      g.fillCircle(c.x, c.y, Math.max(0.45, RACKET.holeR * k * u));
    }
    // frame protector, highlight, outlines
    outline(geo.protector, 0x0b0f16, 1.3, false, 0.5);
    outline(geo.outline.filter(([x, y]) => x < -2 && y < -24), 0xffffff, 0.6, false, 0.45);
    if (elite) outline(geo.face, 0xf2c230, 0.5, true, 0.9);
    g.lineStyle(thin, OUTLINE, 1);
    g.strokePoints(at(geo.outline).map(P), true);
    g.strokePoints(at(geo.heart).map(P), true);
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
