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
/** The sprite is wider than the body (32 px) so that a raised or swung racket fits in. */
export const SPRITE_W = 56;
const X_OFFSET = 12;
export const SPRITE_H = 46;
export const OUTLINE_COLOR = 0x14142b;

/**
 * 'front' = faces the camera, 'back' = seen from behind, 'left' / 'right' = in profile, looking to that side of the screen.
 * The near team normally shows its back and the far team its front; players turn when they run or wait for a ball
 * that comes off the back glass.
 */
export type Facing = 'front' | 'back' | 'left' | 'right';

/**
 * Body poses. The player is shown with a stroke stance (forehand = ball on the racket side, backhand = ball on the other
 * side, smash = overhead), each with three phases: prepare (racket back), hit (contact) and follow-through.
 */
export type PoseName =
  | 'ready'
  | 'runA'
  | 'runB'
  | 'fhPrep'
  | 'fhHit'
  | 'fhFollow'
  | 'bhPrep'
  | 'bhHit'
  | 'bhFollow'
  | 'smashPrep'
  | 'smashHit'
  | 'smashFollow';

export const POSE_NAMES: PoseName[] = [
  'ready',
  'runA',
  'runB',
  'fhPrep',
  'fhHit',
  'fhFollow',
  'bhPrep',
  'bhHit',
  'bhFollow',
  'smashPrep',
  'smashHit',
  'smashFollow',
];

export type Stance = 'fh' | 'bh' | 'smash';

export function poseOf(stance: Stance, phase: 'Prep' | 'Hit' | 'Follow'): PoseName {
  return `${stance}${phase}` as PoseName;
}

/**
 * Hands in the player's own frame, relative to the shoulder: `dx` is outwards on the racket side (negative = across
 * the body), `dy` is down (negative = up). `angle` tilts the racket from vertical (positive = head outwards).
 */
interface PoseSpec {
  hand: { dx: number; dy: number };
  angle: number;
  off?: { dx: number; dy: number };
  /** Legs: lift of the left/right foot in pixels and the spread of the feet. */
  legs: { left: number; right: number; spread: number };
}

const POSES: Record<PoseName, PoseSpec> = {
  ready: { hand: { dx: 1.5, dy: 7.5 }, angle: 0.05, legs: { left: 0, right: 0, spread: 0 } },
  runA: { hand: { dx: 2, dy: 6 }, angle: 0.3, legs: { left: 2, right: 0, spread: 1 } },
  runB: { hand: { dx: 2, dy: 6 }, angle: 0.3, legs: { left: 0, right: 2, spread: 1 } },
  fhPrep: { hand: { dx: 7, dy: 3 }, angle: 1.15, legs: { left: 0, right: 0, spread: 2 } },
  fhHit: { hand: { dx: 6, dy: 7 }, angle: 1.0, legs: { left: 0, right: 0, spread: 3 } },
  fhFollow: { hand: { dx: -4, dy: -2 }, angle: -0.9, legs: { left: 0, right: 1, spread: 2 } },
  // Backhand of a right-hander: the racket arm crosses the chest and the racket is taken out on the far side of the body,
  // with the other hand on the throat for the preparation and the hit; the follow-through finishes up and out on that side.
  bhPrep: { hand: { dx: -13, dy: 4 }, angle: -1.3, off: { dx: -8, dy: 3 }, legs: { left: 0, right: 0, spread: 2 } },
  bhHit: { hand: { dx: -21, dy: 7 }, angle: -1.4, off: { dx: -6, dy: 6 }, legs: { left: 0, right: 0, spread: 3 } },
  bhFollow: { hand: { dx: -16, dy: -3 }, angle: -0.5, legs: { left: 1, right: 0, spread: 2 } },
  smashPrep: { hand: { dx: 5, dy: -4 }, angle: 1.0, off: { dx: -4, dy: -12 }, legs: { left: 0, right: 0, spread: 2 } },
  smashHit: { hand: { dx: 2, dy: -11 }, angle: 0.3, off: { dx: -5, dy: -3 }, legs: { left: 0, right: 2, spread: 1 } },
  smashFollow: { hand: { dx: -3, dy: 5 }, angle: -0.7, legs: { left: 1, right: 0, spread: 2 } },
};

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

export function buildCharacter(a: Appearance, facing: Facing, pose: PoseName = 'ready'): Op[] {
  if (facing === 'left' || facing === 'right') return buildProfile(a, facing, pose);
  const spec = POSES[pose];
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
    ops.push({ kind: 'rect', x: x + X_OFFSET, y: y + Y_OFFSET, w, h, color });
  };
  const disc = (cx: number, cy: number, rx: number, ry: number, color: number): void => {
    ops.push({ kind: 'disc', cx: cx + X_OFFSET, cy: cy + Y_OFFSET, rx, ry, color });
  };

  // --- behind the body ---
  if (a.hairStyle === 'afro') disc(16, 11, 14, 12, hair);
  if (a.hairStyle === 'long' && !back) rect(6, 12, 20, 17, hair);
  if (a.hairStyle === 'ponytail' && !back) rect(23, 10, 4, 10, hair);

  // --- legs and shoes (a running or stroke stance moves the feet) ---
  const { left, right, spread } = spec.legs;
  rect(11 - spread, 37 - left, 4, 4, skin);
  rect(17 + spread, 37 - right, 4, 4, skin);
  rect(10 - spread, 40 - left, 6, 3, shoes);
  rect(16 + spread, 40 - right, 6, 3, shoes);
  rect(10 - spread, 42 - left, 6, 1, WHITE);
  rect(16 + spread, 42 - right, 6, 1, WHITE);

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
  if (!spec.off) rect(back ? 7 : 22, 25, 3, 8, skin); // the arm that does not hold the racket
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
  // --- cap: crown over the hair, brim over the forehead (front view only) ---
  if (a.cap) {
    const cap = hex(a.cap);
    disc(16, 8, 10, 5.5, cap);
    rect(6, 8, 20, 3, cap);
    if (!back) rect(8, 11, 16, 2, shade(cap, 0.7));
  }

  // --- racket arm and racket, drawn from the pose (the racket hand is on the right of the player) ---
  const out = back ? 1 : -1;
  const shoulder = { x: back ? 23.5 : 8.5, y: 26 };
  const chain = (from: { x: number; y: number }, to: { x: number; y: number }): void => {
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      disc(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, 1.6, 1.6, skin);
    }
  };
  if (spec.off) {
    const offShoulder = { x: back ? 8.5 : 23.5, y: 26 };
    chain(offShoulder, { x: offShoulder.x + out * spec.off.dx, y: offShoulder.y + spec.off.dy });
  }
  const hand = { x: shoulder.x + out * spec.hand.dx, y: shoulder.y + spec.hand.dy };
  chain(shoulder, hand);
  if (a.wristband) disc(shoulder.x + (hand.x - shoulder.x) * 0.88, shoulder.y + (hand.y - shoulder.y) * 0.88, 2, 2, hex(a.wristband));
  const sin = Math.sin(spec.angle);
  const cos = Math.cos(spec.angle);
  for (let i = 1; i <= 3; i++) disc(hand.x + out * sin * i, hand.y - cos * i, 0.8, 0.8, WHITE);
  disc(hand.x, hand.y, 1.9, 1.9, skin);
  const head = { x: hand.x + out * sin * 7.5, y: hand.y - cos * 7.5 };
  const flat = Math.abs(sin);
  disc(head.x, head.y, 3 + 2.2 * flat, 5 - 2 * flat, racket);
  disc(head.x, head.y, 1.2 + 1.3 * flat, 3 - 1.4 * flat, STRINGS);

  return ops;
}

/**
 * The racket arm in profile (looking to the right), from the shoulder: `fx` is forward (to the right), `fy` down (negative =
 * up), `angle` tilts the racket from vertical (positive = head forward). `off` is the other hand (overhead shots).
 */
interface ProfilePose {
  hand: { fx: number; fy: number };
  angle: number;
  off?: { fx: number; fy: number };
}

const PROFILE_POSES: Record<PoseName, ProfilePose> = {
  ready: { hand: { fx: 4, fy: 8 }, angle: 0.5 },
  runA: { hand: { fx: 2, fy: 6 }, angle: 0.2 },
  runB: { hand: { fx: 5, fy: 7 }, angle: 0.7 },
  fhPrep: { hand: { fx: -5, fy: 5 }, angle: -1.2 },
  fhHit: { hand: { fx: 9, fy: 7 }, angle: 1.25 },
  fhFollow: { hand: { fx: 4, fy: -2 }, angle: -0.7 },
  bhPrep: { hand: { fx: 4, fy: 5 }, angle: 1.3, off: { fx: 3, fy: 5 } },
  bhHit: { hand: { fx: 10, fy: 8 }, angle: 1.35, off: { fx: 6, fy: 7 } },
  bhFollow: { hand: { fx: 9, fy: -2 }, angle: 0.4 },
  smashPrep: { hand: { fx: -3, fy: -6 }, angle: -1.0, off: { fx: 8, fy: -11 } },
  smashHit: { hand: { fx: 5, fy: -13 }, angle: 0.25, off: { fx: 3, fy: 0 } },
  smashFollow: { hand: { fx: 7, fy: 6 }, angle: 1.0 },
};

/** A player seen from the side. Drawn looking right; looking left is the mirror image. */
function buildProfile(a: Appearance, facing: 'left' | 'right', pose: PoseName): Op[] {
  const spec = POSES[pose];
  const pp = PROFILE_POSES[pose];
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
  const mirror = facing === 'left';
  const rect = (x: number, y: number, w: number, h: number, color: number): void => {
    const px = x + X_OFFSET;
    ops.push({ kind: 'rect', x: mirror ? SPRITE_W - (px + w) : px, y: y + Y_OFFSET, w, h, color });
  };
  const disc = (cx: number, cy: number, rx: number, ry: number, color: number): void => {
    const px = cx + X_OFFSET;
    ops.push({ kind: 'disc', cx: mirror ? SPRITE_W - px : px, cy: cy + Y_OFFSET, rx, ry, color });
  };

  // The racket arm is on the far side of the body when he looks left (we see his left side): draw it first, behind him.
  const shoulder = { x: 16, y: 26 };
  const arm = (): void => {
    const chain = (from: { x: number; y: number }, to: { x: number; y: number }): void => {
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        disc(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, 1.6, 1.6, skin);
      }
    };
    if (pp.off) chain(shoulder, { x: shoulder.x + pp.off.fx, y: shoulder.y + pp.off.fy });
    const hand = { x: shoulder.x + pp.hand.fx, y: shoulder.y + pp.hand.fy };
    chain(shoulder, hand);
    if (a.wristband) disc(shoulder.x + (hand.x - shoulder.x) * 0.88, shoulder.y + (hand.y - shoulder.y) * 0.88, 2, 2, hex(a.wristband));
    const sin = Math.sin(pp.angle);
    const cos = Math.cos(pp.angle);
    for (let i = 1; i <= 3; i++) disc(hand.x + sin * i, hand.y - cos * i, 0.8, 0.8, WHITE);
    disc(hand.x, hand.y, 1.9, 1.9, skin);
    const head = { x: hand.x + sin * 7.5, y: hand.y - cos * 7.5 };
    const flat = Math.abs(sin);
    disc(head.x, head.y, 2.6 + 1.2 * (1 - flat), 5 - 1.5 * flat, racket);
    disc(head.x, head.y, 1 + 0.6 * (1 - flat), 3 - 1.2 * flat, STRINGS);
  };
  if (mirror) arm();

  // --- behind the body: hair that hangs or trails ---
  if (a.hairStyle === 'afro') disc(15, 11, 13, 11, hair);
  if (a.hairStyle === 'long') rect(5, 11, 10, 18, hair);
  if (a.hairStyle === 'ponytail') {
    rect(4, 12, 5, 3, hair);
    rect(2, 14, 4, 8, hair);
  }

  // --- legs: the stride follows the pose; the front foot points forward ---
  const stride = Math.round(spec.legs.spread * 1.6) + (pose === 'runA' || pose === 'runB' ? 2 : 0);
  const frontLift = spec.legs.right;
  const backLift = spec.legs.left;
  const bx = 11 - stride;
  const fx = 16 + stride;
  rect(bx, 37 - backLift, 4, 4, skinLo);
  rect(bx - 2, 40 - backLift, 7, 3, shoes);
  rect(bx - 2, 42 - backLift, 7, 1, WHITE);
  rect(fx, 37 - frontLift, 4, 4, skin);
  rect(fx - 1, 40 - frontLift, 7, 3, shoes);
  rect(fx - 1, 42 - frontLift, 7, 1, WHITE);

  // --- shorts or skirt, torso, neck ---
  if (a.bottomStyle === 'skirt') {
    rect(10, 33, 12, 5, bottom);
    rect(13, 34, 1, 4, bottomLo);
    rect(18, 34, 1, 4, bottomLo);
  } else {
    rect(11, 33, 10, 5, bottom);
    rect(15, 35, 2, 3, bottomLo);
  }
  rect(14, 22, 4, 3, skinLo);
  rect(11, 24, 10, 10, shirt);
  rect(11, 24, 3, 10, shirtLo);
  rect(19, 27, 2, 5, shirtLo);

  // --- head, hair, face (the face looks forward) ---
  disc(17, 13, 8.5, 9, skin);
  if (a.hairStyle !== 'bald') {
    disc(15, a.hairStyle === 'afro' ? 8 : 10, a.hairStyle === 'afro' ? 11 : 9.5, a.hairStyle === 'afro' ? 7 : 7, hair);
    rect(12, 4, 5, 1, hairHi);
    if (a.hairStyle === 'long') rect(7, 11, 7, 16, hair);
    if (a.hairStyle === 'bun') {
      disc(13, 3, 4, 3, hair);
      rect(11, 1, 2, 1, hairHi);
    }
  }
  if (a.headband) rect(8, 9, 18, 2, accent);
  if (a.cap) {
    const cap = hex(a.cap);
    disc(14, 8, 9, 5.5, cap);
    rect(5, 8, 18, 3, cap);
    rect(21, 10, 8, 2, shade(cap, 0.7));
  }
  rect(21, 13, 2, 4, EYE);
  rect(21, 13, 1, 1, WHITE);
  rect(25, 16, 2, 3, skinLo);
  rect(21, 20, 3, 1, a.gender === 'female' ? 0xc2405a : 0x8a2a2a);
  if (a.gender === 'female') rect(21, 12, 2, 1, EYE);
  rect(14, 12, 2, 3, skinLo); // ear

  // --- the racket arm is in front of him when he looks right ---
  if (!mirror) arm();
  return ops;
}
