import { describe, expect, it } from 'vitest';
import { area, clipHalf, inside, racketGeom, RACKET, shapeFor, type RacketShape } from './racketShape';

const SHAPES: RacketShape[] = ['round', 'teardrop', 'diamond'];
const span = (pts: Array<[number, number]>, i: 0 | 1): [number, number] => [Math.min(...pts.map((p) => p[i])), Math.max(...pts.map((p) => p[i]))];

describe('padel racket geometry (FIP limits)', () => {
  for (const s of SHAPES) {
    it(`${s}: 45.5 cm long, 26 cm wide, a solid face with 9-13 mm holes and an open throat`, () => {
      const g = racketGeom(s);
      const [x0, x1] = span(g.outline, 0);
      const [y0] = span(g.outline, 1);
      expect(x1 - x0).toBeCloseTo(RACKET.width, 1);
      expect(-y0).toBeCloseTo(RACKET.length, 1);
      expect(RACKET.gripTo).toBeLessThanOrEqual(20);
      expect(RACKET.holeR * 2).toBeGreaterThanOrEqual(0.9);
      expect(RACKET.holeR * 2).toBeLessThanOrEqual(1.3);
      // the face sits inside the head, every hole on the face, the heart below the face
      for (const p of g.face) expect(inside(g.head, p)).toBe(true);
      for (const h of g.holes) expect(inside(g.face, h)).toBe(true);
      expect(g.holes.length).toBeGreaterThan(30);
      expect(Math.abs(area(g.heart))).toBeGreaterThan(4);
      expect(span(g.heart, 1)[0]).toBeGreaterThan(-RACKET.faceFrom - 0.5);
      expect(span(g.heart, 1)[1]).toBeLessThan(-RACKET.gripTo);
      // decoration stays on the face
      for (const p of [...g.sweep, ...g.stripe]) expect(Math.abs(p[0])).toBeLessThanOrEqual(RACKET.width / 2);
    });
  }

  it('round is widest lowest, diamond highest (where the sweet spot sits)', () => {
    const w = SHAPES.map((s) => racketGeom(s).widestAt);
    expect(w[0]).toBeLessThan(w[1]);
    expect(w[1]).toBeLessThan(w[2]);
  });

  it('clipHalf cuts a square in half; shapeFor is stable', () => {
    const sq: Array<[number, number]> = [[0, 0], [2, 0], [2, 2], [0, 2]];
    expect(Math.abs(area(clipHalf(sq, 1, 0, 1)))).toBeCloseTo(2);
    expect(shapeFor('#ff0000#00ff00')).toBe(shapeFor('#ff0000#00ff00'));
  });
});
