import { describe, expect, it } from 'vitest';
import { SHOTS } from '../game/catalog';
import { apply, IDENTITY, launchSpin, rotate, visibleRings, type Vec3 } from './spin';

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

describe('ball rotation', () => {
  it('topspin turns the top of the ball along the direction of travel, backspin against it', () => {
    const away = [0, -1] as const; // towards the far end
    const top = launchSpin(1, 0, away[0], away[1]);
    // velocity of the top of the ball = w x up
    expect(cross(top, [0, 1, 0])[2]).toBeLessThan(0);
    const back = launchSpin(-1, 0, away[0], away[1]);
    expect(cross(back, [0, 1, 0])[2]).toBeGreaterThan(0);
    // sideways travel: the top moves sideways too
    expect(cross(launchSpin(1, 0, 1, 0), [0, 1, 0])[0]).toBeGreaterThan(0);
  });

  it('side spin turns about the vertical axis, clockwise seen from above for a positive value', () => {
    const w = launchSpin(0.5, 1, 0, -1);
    expect(w[1]).toBeLessThan(0);
    expect(launchSpin(0.5, -1, 0, -1)[1]).toBeGreaterThan(0);
  });

  it('even a flat shot turns a little', () => {
    const w = launchSpin(0, 0, 0, -1);
    expect(Math.hypot(...w)).toBeGreaterThan(1);
  });

  it('keeps the orientation a proper rotation and turns by the expected angle', () => {
    let m = IDENTITY;
    const w: Vec3 = [0, 10, 0];
    for (let i = 0; i < 100; i++) m = rotate(m, w, 0.001); // one radian in total
    const p = apply(m, [1, 0, 0]);
    expect(Math.hypot(...p)).toBeCloseTo(1, 6);
    expect(p[0]).toBeCloseTo(Math.cos(1), 3);
    expect(p[2]).toBeCloseTo(-Math.sin(1), 3);
  });

  it('shows only the near half of the printed rings', () => {
    for (const ring of visibleRings(IDENTITY)) {
      for (const run of ring.runs) for (const p of run) expect(p.depth).toBeGreaterThan(0);
    }
  });

  it('gives every shot its own mix of top and side spin', () => {
    const mixes = new Set(SHOTS.map((s) => `${s.flight.spin}/${s.flight.side}`));
    expect(mixes.size).toBeGreaterThan(12);
    for (const s of SHOTS) expect(typeof s.flight.side).toBe('number');
  });
});
