import { describe, expect, it } from 'vitest';
import type { Appearance, HairStyle } from '../../game/types';
import { buildToon, lookOf, mixPose, POSES, RUN_FRAMES, runFrame, TOON_POSES } from './character';
import { luma, shadeHex, toSvg, type Op } from './ops';

const BASE: Appearance = {
  gender: 'male',
  skin: '#e0ac69',
  hairStyle: 'short',
  hairColor: '#2b1a12',
  shirt: '#1f6fff',
  bottom: '#0f2a4d',
  bottomStyle: 'shorts',
  shoes: '#ffffff',
  racket: '#ff7a1a',
};
const STYLES: HairStyle[] = ['short', 'long', 'ponytail', 'bun', 'afro', 'bald'];

function count(ops: Op[]): number {
  return ops.reduce((n, o) => n + (o.k === 'g' ? count(o.ops) : 1), 0);
}

describe('toon character', () => {
  it('builds every hair style in both views, as well-formed SVG', () => {
    for (const style of STYLES) {
      for (const view of ['front', 'back'] as const) {
        const svg = toSvg(buildToon({ ...BASE, hairStyle: style }, view));
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
        expect(svg).not.toContain('NaN');
        expect(svg).not.toContain('undefined');
        expect((svg.match(/<g/g) ?? []).length).toBe((svg.match(/<\/g>/g) ?? []).length);
      }
    }
  });

  it('uses the colours of the appearance', () => {
    const svg = toSvg(buildToon({ ...BASE, shirt: '#ab1234', skin: '#8d5524', racket: '#19b36b', shoes: '#fedcba' }));
    for (const c of ['#ab1234', '#8d5524', '#19b36b', '#fedcba']) expect(svg).toContain(c);
  });

  it('shows no face from behind, and extras only when set', () => {
    const front = buildToon(BASE, 'front');
    const back = buildToon(BASE, 'back');
    expect(count(back)).toBeLessThan(count(front));
    const plain = count(buildToon(BASE));
    expect(count(buildToon({ ...BASE, headband: '#ffc21a' }))).toBe(plain + 1);
    expect(count(buildToon({ ...BASE, cap: '#d63a5a' }))).toBe(plain + 2);
    expect(count(buildToon({ ...BASE, wristband: '#ffffff' }))).toBe(plain + 1);
  });

  it('women are drawn a little narrower, skirts differ from shorts', () => {
    expect(lookOf({ ...BASE, gender: 'female' }).build).toBeLessThan(lookOf(BASE).build);
    expect(toSvg(buildToon({ ...BASE, bottomStyle: 'skirt' }))).not.toBe(toSvg(buildToon(BASE)));
  });

  it('is deterministic', () => {
    expect(toSvg(buildToon(BASE))).toBe(toSvg(buildToon(BASE)));
  });

  it('colour helpers behave', () => {
    expect(shadeHex('#808080', 1)).toBe('#808080');
    expect(luma(shadeHex('#336699', 0.5))).toBeLessThan(luma('#336699'));
    expect(luma('#ffffff')).toBeGreaterThan(0.99);
  });
});

describe('toon poses', () => {
  it('builds every pose in both views as well-formed SVG without NaN', () => {
    for (const style of STYLES) {
      for (const view of ['front', 'back'] as const) {
        for (const pose of TOON_POSES) {
          const svg = toSvg(buildToon({ ...BASE, hairStyle: style }, view, pose));
          expect(svg).not.toContain('NaN');
          expect(svg).not.toContain('undefined');
          expect((svg.match(/<g/g) ?? []).length).toBe((svg.match(/<\/g>/g) ?? []).length);
        }
      }
    }
  });

  it('every pose differs from the idle pose, and the default pose is idle', () => {
    const idle = toSvg(buildToon(BASE, 'back'));
    expect(toSvg(buildToon(BASE, 'back', 'idle'))).toBe(idle);
    for (const pose of TOON_POSES.filter((p) => p !== 'idle')) expect(toSvg(buildToon(BASE, 'back', pose))).not.toBe(idle);
  });

  it('keeps the racket hand and the feet inside the picture, and the soles on or above the ground', () => {
    for (const pose of TOON_POSES) {
      const P = POSES[pose];
      expect(P.hand[0]).toBeGreaterThan(-40);
      expect(P.hand[0]).toBeLessThan(240);
      // The racket (104 long) held up from the hand must stay below the top of the picture (y -130).
      expect(P.hand[1] - 104 + P.crouch).toBeGreaterThan(-130);
      expect(P.left[1]).toBeLessThanOrEqual(304);
      expect(P.right[1]).toBeLessThanOrEqual(304);
    }
  });
});

describe('pose blending and run cycle', () => {
  const a = BASE;
  it('every run frame and in-between draws in every view', () => {
    for (const view of ['front', 'back'] as const) {
      for (let f = 0; f < RUN_FRAMES; f++) expect(buildToon(a, view, runFrame(f)).length).toBeGreaterThan(10);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) expect(buildToon(a, view, mixPose(POSES.ready, POSES.fhHit, t)).length).toBeGreaterThan(10);
    }
  });
  it('mixing at the ends gives the end poses', () => {
    expect(mixPose(POSES.ready, POSES.runA, 1).crouch).toBe(POSES.runA.crouch);
    expect(mixPose(POSES.ready, POSES.runA, 0).left).toEqual(POSES.ready.left);
  });
  it('the run cycle moves the feet and loops', () => {
    expect(runFrame(0).left).not.toEqual(runFrame(2).left);
    expect(runFrame(RUN_FRAMES)).toEqual(runFrame(0));
  });
});
