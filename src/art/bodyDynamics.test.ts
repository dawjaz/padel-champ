import { describe, expect, it } from 'vitest';
import { newBody, runEase, stepBody, LEAN_MAX } from './bodyDynamics';

const run = (s = newBody(), speed: number, frames: number, idle = false) => {
  let last = stepBody(s, 0, 0, 1 / 60, 0, idle);
  let braked = false;
  for (let i = 0; i < frames; i++) {
    last = stepBody(s, speed / 60, 0, 1 / 60, i / 60, idle);
    braked ||= last.braked;
  }
  return { s, last, braked };
};

describe('body dynamics', () => {
  it('leans into a run to the right, within the limit', () => {
    const { last } = run(undefined, 6, 60);
    expect(last.rotation).toBeGreaterThan(0.1);
    expect(last.rotation).toBeLessThanOrEqual(LEAN_MAX * 1.3);
    expect(last.bob).toBeGreaterThanOrEqual(0);
  });
  it('a hard stop from a run brakes: leans back, squashes and settles', () => {
    const { s } = run(undefined, 6, 60);
    const stop = run(s, 0, 30);
    expect(stop.braked).toBe(true);
    const settled = run(s, 0, 120);
    expect(Math.abs(settled.last.rotation)).toBeLessThan(0.01);
    expect(settled.last.scaleY).toBeCloseTo(1, 2);
  });
  it('keeps the volume when it squashes', () => {
    const { last } = run(undefined, 6, 20);
    expect(last.scaleX * last.scaleX * last.scaleY).toBeCloseTo(1, 5);
  });
  it('runEase starts and ends at the ends, rises monotonically', () => {
    expect(runEase(0)).toBe(0);
    expect(runEase(1)).toBeCloseTo(1, 9);
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const v = runEase(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
