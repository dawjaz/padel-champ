import type { Appearance } from '../game/types';
import { hex, shade } from './palette';

/**
 * Procedural 16-bit-style comic characters (big head, small body), drawn from rectangles and
 * discs on a 32x46 pixel grid. This file only produces a list of shapes (pure, testable);
 * characterTexture.ts turns them into a Phaser texture.
 *
 * Every garment/skin/hair colour comes from `Appearance`, so outfits can be swapped later
 * (career mode equipment) without new art.
 */
export const SPRITE_W = 32;
export const SPRITE_H = 46;
export const OUTLINE_COLOR = 0x14142b;

/** 'front' = faces the camera (far team), 'back' = seen from behind (near team). */
export type Facing = 'front' | 'back';

export interface RectOp {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}
export interface DiscOp {
  kind: 'disc';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: number;
}
export type Op = RectOp | DiscOp;

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The pixel rectangles that make up a shape (a disc becomes one 1px-high row per scanline). */
export function opPixels(op: Op): PixelRect[] {
  if (op.kind === 'rect') return [{ x: op.x, y: op.y, w: op.w, h: op.h }];
  const rows: PixelRect[] = [];
  const top = Math.floor(op.cy - op.ry);
  const bottom = Math.ceil(op.cy + op.ry);
  for (let y = top; y < bottom; y++) {
    const dy = (y + 0.5 - op.cy) / op.ry;
    if (Math.abs(dy) >= 1) continue;
    const halfWidth = op.rx * Math.sqrt(1 - dy * dy);
    const x0 = Math.round(op.cx - halfWidth);
    const x1 = Math.round(op.cx + halfWidth);
    if (x1 > x0) rows.push({ x: x0, y, w: x1 - x0, h: 1 });
  }
  return rows;
}

/** Grows a shape by `by` pixels on every side (used for the dark outline). */
export function expand(op: Op, by = 1): Op {
  if (op.kind === 'rect') {
    return { ...op, x: op.x - by, y: op.y - by, w: op.w + 2 * by, h: op.h + 2 * by };
  }
  return { ...op, rx: op.rx + by, ry: op.ry + by };
}

const Y_OFFSET = 2; // headroom above the head for buns and afros
const EYE = 0x1a1a2e;
const WHITE = 0xf4f4f4;
const STRINGS = 0xe6ecf5;

export function buildCharacter(a: Appearance, facing: Facing): Op[] {
  const back = facing === 'back';
  const skin = hex(a.skin);
  const skinLo = shade(skin, 0.8);
  const hair = hex(a.hairColor);
  const hairHi = shade(hair, 1.6);
  const shirt = hex(a.shirt);
  const shirtLo = shade(shirt, 0.78);
  const bottom = hex(a.bottom);
  const bottomLo = shade(bottom, 0.75);
  const shoes = hex(a.shoes);
  const racket = hex(a.racket);
  const accent = a.headband ? hex(a.headband) : racket;

  const ops: Op[] = [];
  const rect = (x: number, y: number, w: number, h: number, color: number): void => {
    ops.push({ kind: 'rect', x, y: y + Y_OFFSET, w, h, color });
  };
  const disc = (cx: number, cy: number, rx: number, ry: number, color: number): void => {
    ops.push({ kind: 'disc', cx, cy: cy + Y_OFFSET, rx, ry, color });
  };

  // --- behind the body ---
  if (a.hairStyle === 'afro') disc(16, 11, 14, 12, hair);
  if (a.hairStyle === 'long' && !back) rect(6, 12, 20, 17, hair);
  if (a.hairStyle === 'ponytail' && !back) rect(23, 10, 4, 10, hair);

  // --- legs and shoes ---
  rect(11, 37, 4, 4, skin);
  rect(17, 37, 4, 4, skin);
  rect(10, 40, 6, 3, shoes);
  rect(16, 40, 6, 3, shoes);
  rect(10, 42, 6, 1, WHITE);
  rect(16, 42, 6, 1, WHITE);

  // --- shorts or skirt ---
  if (a.bottomStyle === 'skirt') {
    rect(9, 33, 14, 5, bottom);
    rect(12, 34, 1, 4, bottomLo);
    rect(16, 34, 1, 4, bottomLo);
    rect(20, 34, 1, 4, bottomLo);
  } else {
    rect(10, 33, 12, 5, bottom);
    rect(15, 35, 2, 3, bottomLo);
  }

  // --- torso, neck, arms ---
  rect(14, 22, 4, 3, skinLo);
  rect(10, 24, 12, 10, shirt);
  rect(19, 26, 3, 8, shirtLo);
  if (back) rect(13, 24, 6, 1, shirtLo);
  else rect(14, 24, 4, 2, skin);
  rect(7, 25, 3, 8, skin);
  rect(22, 25, 3, 8, skin);
  rect(7, 24, 3, 4, shirt);
  rect(22, 24, 3, 4, shirt);

  // --- head ---
  disc(16, 13, 9, 9, skin);

  // --- hair on top ---
  if (a.hairStyle !== 'bald') {
    if (back) {
      disc(16, 13, 10, 10, hair);
      rect(11, 5, 6, 1, hairHi);
      if (a.hairStyle === 'long') {
        rect(7, 13, 18, 17, hair);
        rect(10, 20, 2, 8, shade(hair, 0.75));
      }
      if (a.hairStyle === 'ponytail') {
        rect(14, 19, 4, 11, hair);
        rect(14, 19, 4, 2, accent);
      }
    } else {
      disc(16, a.hairStyle === 'afro' ? 7 : 8, a.hairStyle === 'afro' ? 12 : 10, a.hairStyle === 'afro' ? 6 : 5, hair);
      rect(12, 4, 5, 1, hairHi);
      if (a.hairStyle === 'long') {
        rect(6, 10, 3, 14, hair);
        rect(23, 10, 3, 14, hair);
      }
    }
    if (a.hairStyle === 'bun') {
      disc(16, 3, 4, 3, hair);
      rect(14, 1, 2, 1, hairHi);
    }
    if (a.hairStyle === 'ponytail' && !back) rect(23, 17, 4, 2, accent);
  }

  // --- face (front view only) ---
  if (!back) {
    rect(11, 14, 3, 4, EYE);
    rect(19, 14, 3, 4, EYE);
    rect(11, 14, 1, 1, WHITE);
    rect(19, 14, 1, 1, WHITE);
    rect(16, 18, 1, 2, skinLo);
    rect(15, 20, 3, 1, a.gender === 'female' ? 0xc2405a : 0x8a2a2a);
    if (a.gender === 'female') {
      rect(10, 13, 2, 1, EYE);
      rect(20, 13, 2, 1, EYE);
    }
  }

  // --- headband ---
  if (a.headband) rect(7, 10, 18, 2, hex(a.headband));

  // --- racket (held on the outer side) ---
  const hx = back ? 25 : 6;
  rect(hx, 31, 1, 5, WHITE);
  rect(hx - 1, 32, 3, 3, skin);
  disc(hx, 26, 3, 5, racket);
  disc(hx, 26, 1.2, 3, STRINGS);

  return ops;
}
