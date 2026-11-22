import { describe, expect, it } from 'vitest';
import type { Appearance, HairStyle } from '../game/types';
import { buildCharacter, expand, opPixels, POSE_NAMES, SPRITE_H, SPRITE_W, type Facing } from './character';
import { hex } from './palette';

const BASE: Appearance = {
  gender: 'female',
  skin: '#8d5524',
  hairStyle: 'short',
  hairColor: '#123456',
  shirt: '#e8554e',
  bottom: '#2b2b5e',
  bottomStyle: 'skirt',
  shoes: '#f4f4f4',
  racket: '#f2a33a',
  headband: '#35c4a8',
};

const STYLES: HairStyle[] = ['short', 'long', 'ponytail', 'bun', 'afro', 'bald'];
const FACINGS: Facing[] = ['front', 'back', 'left', 'right'];

describe('buildCharacter', () => {
  it('keeps every pixel, including the 1px outline, inside the sprite canvas', () => {
    for (const hairStyle of STYLES) {
      for (const facing of FACINGS) {
        for (const bottomStyle of ['shorts', 'skirt'] as const) {
          const ops = buildCharacter({ ...BASE, hairStyle, bottomStyle }, facing);
          for (const op of ops) {
            for (const r of opPixels(expand(op, 1))) {
              const label = `${hairStyle}/${facing}/${bottomStyle}`;
              expect(r.x, label).toBeGreaterThanOrEqual(0);
              expect(r.y, label).toBeGreaterThanOrEqual(0);
              expect(r.x + r.w, label).toBeLessThanOrEqual(SPRITE_W);
              expect(r.y + r.h, label).toBeLessThanOrEqual(SPRITE_H);
            }
          }
        }
      }
    }
  });

  it('keeps every pose, including the racket and the outline, inside the sprite canvas', () => {
    for (const pose of POSE_NAMES) {
      for (const facing of FACINGS) {
        for (const hairStyle of STYLES) {
          for (const op of buildCharacter({ ...BASE, hairStyle }, facing, pose)) {
            for (const r of opPixels(expand(op, 1))) {
              const label = `${pose}/${facing}/${hairStyle}`;
              expect(r.x, label).toBeGreaterThanOrEqual(0);
              expect(r.y, label).toBeGreaterThanOrEqual(0);
              expect(r.x + r.w, label).toBeLessThanOrEqual(SPRITE_W);
              expect(r.y + r.h, label).toBeLessThanOrEqual(SPRITE_H);
            }
          }
        }
      }
    }
  });

  it('draws a different picture for every pose', () => {
    const shapes = POSE_NAMES.map((pose) => JSON.stringify(buildCharacter(BASE, 'back', pose)));
    expect(new Set(shapes).size).toBe(POSE_NAMES.length);
  });

  it('uses the appearance colours', () => {
    const colors = new Set(buildCharacter(BASE, 'front').map((o) => o.color));
    expect(colors.has(hex(BASE.skin))).toBe(true);
    expect(colors.has(hex(BASE.shirt))).toBe(true);
    expect(colors.has(hex(BASE.hairColor))).toBe(true);
  });

  it('draws no hair for bald characters', () => {
    for (const facing of FACINGS) {
      const colors = new Set(buildCharacter({ ...BASE, hairStyle: 'bald' }, facing).map((o) => o.color));
      expect(colors.has(hex(BASE.hairColor))).toBe(false);
    }
  });

  it('shows a face from the front but not from behind', () => {
    const front = buildCharacter(BASE, 'front');
    const back = buildCharacter(BASE, 'back');
    expect(front.length).toBeGreaterThan(back.length - 10);
    const eye = 0x1a1a2e;
    expect(front.some((o) => o.color === eye)).toBe(true);
    expect(back.some((o) => o.color === eye)).toBe(false);
  });

  it('produces different shapes for different looks', () => {
    const a = JSON.stringify(buildCharacter(BASE, 'front'));
    const b = JSON.stringify(buildCharacter({ ...BASE, hairStyle: 'afro' }, 'front'));
    const c = JSON.stringify(buildCharacter({ ...BASE, skin: '#ffdbac' }, 'front'));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('opPixels', () => {
  it('turns a disc into centred scanlines that widen towards the middle', () => {
    const rows = opPixels({ kind: 'disc', cx: 10, cy: 10, rx: 5, ry: 5, color: 0 });
    const widths = rows.map((r) => r.w);
    expect(Math.max(...widths)).toBeGreaterThanOrEqual(9);
    expect(widths[0]).toBeLessThan(Math.max(...widths));
  });
});

describe('cap and wristband (gear)', () => {
  const base = { gender: 'male', skin: '#c68642', hairStyle: 'short', hairColor: '#111111', shirt: '#e8554e', bottom: '#2b2b5e', bottomStyle: 'shorts', shoes: '#ffffff', racket: '#f2a33a' } as const;
  it('add shapes in every view and leave the character unchanged without them', () => {
    for (const facing of ['front', 'back', 'left', 'right'] as const) {
      const plain = buildCharacter({ ...base }, facing).length;
      expect(buildCharacter({ ...base, cap: '#ff0000' }, facing).length, facing).toBeGreaterThan(plain);
      expect(buildCharacter({ ...base, wristband: '#00ff00' }, facing).length, facing).toBe(plain + 1);
    }
  });
});

describe('racket shapes', () => {
  const plainLook = { gender: 'male', skin: '#c68642', hairStyle: 'short', hairColor: '#111111', shirt: '#e8554e', bottom: '#2b2b5e', bottomStyle: 'shorts', shoes: '#ffffff', racket: '#f2a33a' } as const;
  const shapes = ['round', 'teardrop', 'diamond'] as const;
  it('every shape draws a different racket head, in every view', () => {
    for (const facing of ['front', 'back', 'left', 'right'] as const) {
      const outs = [undefined, ...shapes].map((racketShape) => JSON.stringify(buildCharacter({ ...plainLook, racketShape }, facing, 'ready')));
      expect(new Set(outs).size, facing).toBe(4);
    }
  });
});
