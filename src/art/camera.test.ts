import { describe, expect, it } from 'vitest';
import { project, unproject } from './camera';

describe('project', () => {
  it('puts the near baseline at the bottom and the far baseline higher up', () => {
    expect(project(0, 20).y).toBeCloseTo(385, 0);
    expect(project(0, 0).y).toBeCloseTo(100, 0);
  });

  it('makes the court narrower in the distance', () => {
    const nearWidth = project(5, 20).x - project(-5, 20).x;
    const farWidth = project(5, 0).x - project(-5, 0).x;
    expect(nearWidth).toBeCloseTo(330, 0);
    expect(farWidth).toBeCloseTo(190, 0);
  });

  it('centres x=0 on the screen', () => {
    expect(project(0, 7).x).toBe(180);
  });

  it('draws nearer things larger', () => {
    expect(project(0, 15).scale).toBeGreaterThan(project(0, 5).scale);
  });

  it('moves higher points up the screen', () => {
    expect(project(0, 10, 2).y).toBeLessThan(project(0, 10, 0).y);
  });
});

describe('unproject', () => {
  it('is the inverse of project on the floor', () => {
    for (const [x, z] of [[0, 0], [-4, 3], [3.5, 9], [2, 17]]) {
      const p = project(x, z);
      const q = unproject(p.x, p.y);
      expect(q.x).toBeCloseTo(x, 6);
      expect(q.z).toBeCloseTo(z, 6);
    }
  });
});
