import { describe, expect, it } from 'vitest';
import type { Appearance, HairStyle } from '../../game/types';
import { buildToon, lookOf } from './character';
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
