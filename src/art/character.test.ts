import { describe, expect, it } from 'vitest';
import type { Appearance, HairStyle } from '../game/types';
import { buildCharacter, expand, opPixels, SPRITE_H, SPRITE_W, type Facing } from './character';
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
const FACINGS: Facing[] = ['front', 'back'];

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
