import { describe, expect, it } from 'vitest';
import { SHOTS } from '../game/catalog';
import type { ShotDef } from '../game/types';
import { ballPoint, buildFlight, flightDuration, type FlightOutcome } from './ballPath';

const shot = (id: string): ShotDef => SHOTS.find((s) => s.id === id)!;
const OUTCOMES: FlightOutcome[] = ['fault', 'double-fault', 'ace', 'in', 'error', 'winner', 'intercept', 'continue'];

describe('buildFlight', () => {
  const base = { from: { x: -2.5, z: 15.5 }, hitterSide: 0 as const, landX: 3 };

  it('starts at the hitter and ends at the point where the next player hits the ball', () => {
    const { path, hit } = buildFlight({ ...base, shot: shot('bandeja'), outcome: 'continue' });
    expect(path[0]).toMatchObject({ x: -2.5, z: 15.5 });
    expect(path[path.length - 1]).toMatchObject({ x: hit.x, z: hit.z });
  });

  it('lands in the opponent half after the net, for both ends of the court', () => {
    const near = buildFlight({ ...base, shot: shot('volley'), outcome: 'continue' });
    expect(near.path[1].z).toBeLessThan(10);
    const far = buildFlight({
      from: { x: 2.5, z: 4.5 },
      hitterSide: 1,
      shot: shot('volley'),
      landX: -3,
      outcome: 'continue',
    });
    expect(far.path[1].z).toBeGreaterThan(10);
  });

  it('lands a chiquita short and a lob deep', () => {
    const chiquita = buildFlight({ ...base, shot: shot('chiquita'), outcome: 'continue' }).path[1];
    const lob = buildFlight({ ...base, shot: shot('lob'), outcome: 'continue' }).path[1];
    expect(chiquita.z).toBeGreaterThan(lob.z); // for side 0 the far baseline is z = 0
    expect(lob.z).toBeLessThan(3);
  });

  it('hits the net on a fault or an error', () => {
    for (const outcome of ['fault', 'double-fault', 'error'] as const) {
      const { path } = buildFlight({ ...base, shot: shot('hard_glass'), outcome });
      expect(path.some((p) => Math.abs(p.z - 10) < 0.5 && p.h > 0)).toBe(true);
      expect(path[path.length - 1].h).toBe(0);
    }
  });

  it('sends a glass serve off the side glass, or lets the receiver take it right after the bounce', () => {
    const wall = buildFlight({ ...base, shot: shot('hard_glass'), outcome: 'in', receive: 'wall' });
    expect(wall.path.some((p) => Math.abs(p.x) === 5)).toBe(true);
    const bounce = buildFlight({ ...base, shot: shot('hard_glass'), outcome: 'in', receive: 'bounce' });
    expect(bounce.path.some((p) => Math.abs(p.x) === 5)).toBe(false);
    // Taken off the bounce: close to where it landed. Taken off the glass: further back, nearer the glass.
    const land = bounce.path[1];
    expect(Math.hypot(bounce.hit.x - land.x, bounce.hit.z - land.z)).toBeLessThan(1.5);
    expect(Math.abs(wall.hit.x)).toBeGreaterThan(Math.abs(bounce.hit.x) - 1);
    expect(wall.hit.z).toBeLessThan(land.z);
  });

  it('lets the defender wait where a wall ball comes down, not where the ball bounced', () => {
    for (const id of ['vibora', 'bandeja', 'lob', 'rulo']) {
      const { path, hit } = buildFlight({ ...base, shot: shot(id), outcome: 'continue' });
      const land = path[1];
      expect(Math.hypot(hit.x - land.x, hit.z - land.z), id).toBeGreaterThan(1);
    }
  });

  it('sends a rulo into the fence above the glass', () => {
    const { path } = buildFlight({ ...base, shot: shot('rulo'), outcome: 'continue' });
    const fence = path.find((p) => Math.abs(p.x) === 5);
    expect(fence).toBeDefined();
    expect(fence!.h).toBeGreaterThan(2);
  });

  it('keeps every point on or above the court and inside the walls, and the hit point on the opponent half', () => {
    for (const s of SHOTS) {
      for (const outcome of OUTCOMES) {
        for (const hitterSide of [0, 1] as const) {
          for (const receive of ['bounce', 'wall'] as const) {
            const from = hitterSide === 0 ? { x: -2.5, z: 15.5 } : { x: 2.5, z: 4.5 };
            const { path, hit } = buildFlight({ from, hitterSide, shot: s, landX: -3, outcome, receive });
            const label = `${s.id}/${outcome}/${hitterSide}/${receive}`;
            expect(path.length, label).toBeGreaterThanOrEqual(2);
            for (const p of path) {
              expect(Math.abs(p.x), label).toBeLessThanOrEqual(5);
              expect(p.z, label).toBeGreaterThanOrEqual(0);
              expect(p.z, label).toBeLessThanOrEqual(20);
              expect(p.h, label).toBeGreaterThanOrEqual(0);
            }
            expect(Math.abs(hit.x), label).toBeLessThanOrEqual(5);
            expect(hit.z, label).toBeGreaterThanOrEqual(0);
            expect(hit.z, label).toBeLessThanOrEqual(20);
            if (outcome === 'continue' || outcome === 'in') {
              expect(hitterSide === 0 ? hit.z < 10 : hit.z > 10, label).toBe(true);
            }
          }
        }
      }
    }
  });

  it('ends a winner or an ace against the opponent back wall', () => {
    const { path } = buildFlight({ ...base, shot: shot('volley'), outcome: 'winner' });
    expect(path[path.length - 1].z).toBe(0);
  });
});

describe('ballPoint', () => {
  const { path } = buildFlight({
    from: { x: -2.5, z: 15.5 },
    hitterSide: 0,
    shot: shot('lob'),
    landX: 3,
    outcome: 'continue',
  });

  it('starts and ends at the first and last waypoint', () => {
    const a = ballPoint(path, 0);
    const b = ballPoint(path, 1);
    expect(a.x).toBeCloseTo(-2.5);
    expect(a.z).toBeCloseTo(15.5);
    expect(b.x).toBeCloseTo(path[path.length - 1].x);
    expect(b.z).toBeCloseTo(path[path.length - 1].z);
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
    expect(flightDuration(path)).toBeLessThanOrEqual(900);
  });
});
