import { describe, expect, it } from 'vitest';
import { SHOTS } from '../game/catalog';
import type { ShotDef } from '../game/types';
import { ballPoint, buildFlight, flightDuration, type FlightOutcome } from './ballPath';

const shot = (id: string): ShotDef => SHOTS.find((s) => s.id === id)!;
const OUTCOMES: FlightOutcome[] = ['fault', 'double-fault', 'ace', 'in', 'error', 'winner', 'intercept', 'continue'];

describe('buildFlight', () => {
  const base = { from: { x: -2.5, z: 15.5 }, hitterSide: 0 as const, landX: 3, target: { x: 2.5, z: 4.5 } };

  it('starts at the hitter and ends at the receiver when the rally continues', () => {
    const path = buildFlight({ ...base, shot: shot('bandeja'), outcome: 'continue' });
    expect(path[0]).toMatchObject({ x: -2.5, z: 15.5 });
    expect(path[path.length - 1]).toMatchObject({ x: 2.5, z: 4.5 });
  });

  it('lands in the opponent half after the net, for both ends of the court', () => {
    const near = buildFlight({ ...base, shot: shot('volley'), outcome: 'continue' });
    expect(near[1].z).toBeLessThan(10);
    const far = buildFlight({
      from: { x: 2.5, z: 4.5 },
      hitterSide: 1,
      shot: shot('volley'),
      landX: -3,
      target: { x: -2.5, z: 15.5 },
      outcome: 'continue',
    });
    expect(far[1].z).toBeGreaterThan(10);
  });

  it('hits the net on a fault or an error', () => {
    for (const outcome of ['fault', 'double-fault', 'error'] as const) {
      const path = buildFlight({ ...base, shot: shot('hard_glass'), outcome });
      expect(path.some((p) => Math.abs(p.z - 10) < 0.5 && p.h > 0)).toBe(true);
      expect(path[path.length - 1].h).toBe(0);
    }
  });

  it('sends a glass serve off the side glass and a rulo into the fence above the glass', () => {
    const serve = buildFlight({ ...base, shot: shot('hard_glass'), outcome: 'in' });
    expect(serve.some((p) => Math.abs(p.x) === 5)).toBe(true);
    const rulo = buildFlight({ ...base, shot: shot('rulo'), outcome: 'continue' });
    const fence = rulo.find((p) => Math.abs(p.x) === 5);
    expect(fence).toBeDefined();
    expect(fence!.h).toBeGreaterThan(2);
  });

  it('keeps every point on or above the court and inside the walls, for every shot and outcome', () => {
    for (const s of SHOTS) {
      for (const outcome of OUTCOMES) {
        for (const hitterSide of [0, 1] as const) {
          const from = hitterSide === 0 ? { x: -2.5, z: 15.5 } : { x: 2.5, z: 4.5 };
          const target = hitterSide === 0 ? { x: 2.5, z: 4.5 } : { x: -2.5, z: 15.5 };
          const path = buildFlight({ from, hitterSide, shot: s, landX: -3, target, outcome });
          expect(path.length, s.id).toBeGreaterThanOrEqual(2);
          for (const p of path) {
            const label = `${s.id}/${outcome}/${hitterSide}`;
            expect(Math.abs(p.x), label).toBeLessThanOrEqual(5);
            expect(p.z, label).toBeGreaterThanOrEqual(0);
            expect(p.z, label).toBeLessThanOrEqual(20);
            expect(p.h, label).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('ends a winner or an ace against the opponent back wall', () => {
    const path = buildFlight({ ...base, shot: shot('volley'), outcome: 'winner' });
    expect(path[path.length - 1].z).toBe(0);
  });
});

describe('ballPoint', () => {
  const path = buildFlight({
    from: { x: -2.5, z: 15.5 },
    hitterSide: 0,
    shot: shot('lob'),
    landX: 3,
    target: { x: 2.5, z: 4.5 },
    outcome: 'continue',
  });

  it('starts and ends at the first and last waypoint', () => {
    const a = ballPoint(path, 0);
    const b = ballPoint(path, 1);
    expect(a.x).toBeCloseTo(-2.5);
    expect(a.z).toBeCloseTo(15.5);
    expect(b.x).toBeCloseTo(2.5);
    expect(b.z).toBeCloseTo(4.5);
  });

  it('never goes below the floor and rises above the hit height in the middle of a lob', () => {
    let max = 0;
    for (let i = 0; i <= 50; i++) {
      const p = ballPoint(path, i / 50);
      expect(p.h).toBeGreaterThanOrEqual(-0.001);
      max = Math.max(max, p.h);
    }
    expect(max).toBeGreaterThan(2);
  });

  it('clamps t outside 0..1', () => {
    expect(ballPoint(path, -1)).toEqual(ballPoint(path, 0));
    expect(ballPoint(path, 2)).toEqual(ballPoint(path, 1));
  });

  it('gives longer flights more time, within limits', () => {
    expect(flightDuration(path)).toBeGreaterThan(flightDuration(path.slice(0, 2)));
    expect(flightDuration(path)).toBeLessThanOrEqual(1300);
  });
});
