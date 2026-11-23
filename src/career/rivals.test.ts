import { describe, expect, it } from 'vitest';
import { RIVAL_LINES, rivalLine, type RivalMoment } from './rivals';

describe('rival lines', () => {
  it('has lines for every moment, all short enough for one or two lines of the screen', () => {
    for (const m of Object.keys(RIVAL_LINES) as RivalMoment[]) {
      expect(RIVAL_LINES[m].length).toBeGreaterThanOrEqual(5);
      for (const l of RIVAL_LINES[m]) expect(l.length).toBeLessThanOrEqual(60);
    }
  });
  it('is stable for the same rival and moment, and varies between rivals', () => {
    expect(rivalLine('before', 'Bruno Silva', '1')).toBe(rivalLine('before', 'Bruno Silva', '1'));
    const lines = new Set(['Alex', 'Bruno', 'Carla', 'Diana', 'Ethan', 'Fran', 'Gabi', 'Hugo'].map((n) => rivalLine('before', n)));
    expect(lines.size).toBeGreaterThan(2);
  });
});
