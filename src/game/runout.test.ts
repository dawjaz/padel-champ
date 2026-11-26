import { describe, expect, it } from 'vitest';
import playersData from '../data/players.json';
import { SHOTS } from './catalog';
import { canRunOut, doorShot, playableShots, RUN_OUT_COST, RUN_OUT_PRESSURE, runOutChance, runOutReturn, startPoint, stepHit, type PointState, type Step, type Teams } from './point';
import { practicePoint, situation } from './practice';
import { seededRng } from './rng';
import { shotsOfKind } from './catalog';
import type { PlayerDef } from './types';

const you = playersData.you as unknown as PlayerDef[];
const cpu = playersData.cpu as unknown as PlayerDef[];
const teams: Teams = [[you[0], you[1]], [cpu[0], cpu[1]]];
const shot = (id: string) => SHOTS.find((s) => s.id === id)!;
const guts = Object.fromEntries(teams.flat().map((p) => [p.id, p.maxGuts]));

/** A Por Tres winner by the near pair (the hero) and the state it leaves. */
function x3Winner(seed: number): { step: Step; state: PointState } {
  const rng = seededRng(seed);
  for (let i = 0; i < 500; i++) {
    const st = practicePoint(startPoint(guts, 0, 0, 0), situation('short_lob').setup!, 0, 0, 0);
    const r = stepHit(teams, st, shot('smash_x3'), 'cross', rng);
    if (r.step.outcome === 'winner' && !r.step.reboundBack) return r;
  }
  throw new Error('no Por Tres winner');
}

describe('running out of the court', () => {
  it('only after a Por Tres winner that went out over the side wall', () => {
    const { step } = x3Winner(1);
    expect(canRunOut(step)).toBe(true);
    expect(canRunOut({ ...step, reboundBack: true })).toBe(false);
    expect(canRunOut({ ...step, shot: shot('smash_x4') })).toBe(false); // over the back wall: lost whatever happens
    expect(canRunOut({ ...step, outcome: 'continue' })).toBe(false);
    expect(canRunOut({ ...step, kind: 'serve' })).toBe(false);
  });

  it('the chance grows with speed, guts and timing; none without the guts', () => {
    const p = (speed: number): PlayerDef => ({ ...cpu[0], stats: { ...cpu[0].stats, speed } });
    expect(runOutChance(p(5), p(5).maxGuts)).toBeCloseTo(0.25);
    expect(runOutChance(p(8), p(8).maxGuts)).toBeCloseTo(0.46);
    expect(runOutChance(p(5), RUN_OUT_COST - 1)).toBe(0);
    expect(runOutChance(p(5), RUN_OUT_COST)).toBeLessThan(runOutChance(p(5), p(5).maxGuts));
    expect(runOutChance(p(5), p(5).maxGuts, 0)).toBeCloseTo(0.15);
    // a clean touch on the ring (green) nearly always gets it back
    expect(runOutChance(p(5), p(5).maxGuts, 1)).toBeGreaterThan(0.9);
    expect(runOutChance(p(5), p(5).maxGuts, 1)).toBeLessThanOrEqual(0.97);
    expect(runOutChance(p(5), p(5).maxGuts, 0.8)).toBeGreaterThan(runOutChance(p(5), p(5).maxGuts, 0.5));
    expect(runOutChance(p(10), p(10).maxGuts)).toBeLessThanOrEqual(0.75);
  });

  it('made: the point goes on with a defensive lob to the hitting pair; not made: it stays won; the runner pays either way', () => {
    const { step, state } = x3Winner(2);
    const runner = teams[1][step.defenderIdx];
    const rng = seededRng(4);
    let made = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const r = runOutReturn(teams, state, step, rng);
      expect(r.state.guts[runner.id]).toBe(Math.max(0, state.guts[runner.id] - RUN_OUT_COST));
      if (!r.made) {
        expect(r.state.status).toBe('done');
        expect(r.state.winner).toBe(0);
        continue;
      }
      made++;
      expect(r.state.status).toBe('rally');
      expect(r.state.winner).toBeNull();
      expect(r.state.holder).toBe(0);
      expect(r.state.ball).toMatchObject({ height: 'high', lob: 'medium', air: true });
      expect(r.state.formation).toEqual(['mid', 'back']);
      // and the rally can go on from there: the hitting pair has its overheads
      const ids = playableShots(shotsOfKind('rally'), r.state).map((s) => s.id);
      expect(ids).toContain('vibora');
      expect(ids).toContain('bandeja');
    }
    expect(made / n).toBeGreaterThan(runOutChance(runner, state.guts[runner.id]) - 0.04);
    expect(made / n).toBeLessThan(runOutChance(runner, state.guts[runner.id]) + 0.04);
  });

  it('a lob and a door shot both come back under heavy pressure', () => {
    const { step, state } = x3Winner(3);
    const rng = seededRng(9);
    const lob = Array.from({ length: 200 }, () => runOutReturn(teams, state, step, rng)).find((r) => r.made)!;
    expect(lob.state.ball.pressure).toBeGreaterThanOrEqual(RUN_OUT_PRESSURE);
    const door = Array.from({ length: 400 }, () => runOutReturn(teams, state, step, rng, 1, 'door', 1)).find((r) => r.made)!;
    expect(door.state.ball).toMatchObject({ height: 'low', air: true });
    expect(door.state.ball.pressure).toBeGreaterThan(lob.state.ball.pressure);
  });

  it('the door is harder to make than the lob, and the narrower the door the harder', () => {
    const { step, state } = x3Winner(4);
    const rate = (mode: 'lob' | 'door', window: number): number => {
      const rng = seededRng(21);
      let made = 0;
      for (let i = 0; i < 4000; i++) if (runOutReturn(teams, state, step, rng, 0.8, mode, window).made) made++;
      return made / 4000;
    };
    expect(rate('door', 1)).toBeLessThan(rate('lob', 0));
    expect(rate('door', 0.1)).toBeLessThan(rate('door', 1));
  });
});

describe('the door by the net', () => {
  it('opens from beside the door and closes further along the fence', () => {
    // the hero side (z over 10): the door is by the net on each side
    const near = doorShot(0, { x: 5.9, z: 11.9 });
    expect(near.open).toBe(true);
    expect(near.window).toBeGreaterThan(0.5);
    expect(near.target.z).toBeLessThan(10); // the ball goes into the other half
    expect(Math.abs(near.target.x)).toBeLessThanOrEqual(4.8);
    const far = doorShot(0, { x: 5.9, z: 17 });
    expect(far.open).toBe(false);
    const mid = doorShot(0, { x: 5.9, z: 13 });
    expect(mid.window).toBeLessThan(near.window);
  });

  it('works on both sides of the court and for both halves', () => {
    expect(doorShot(0, { x: -5.9, z: 11.9 }).open).toBe(true);
    const far = doorShot(1, { x: 5.9, z: 8.1 });
    expect(far.open).toBe(true);
    expect(far.target.z).toBeGreaterThan(10);
    expect(doorShot(1, { x: 5.9, z: 3 }).open).toBe(false);
  });

  it('not from inside the court, nor from behind the door (the ball must travel towards the net)', () => {
    expect(doorShot(0, { x: 4.9, z: 11.9 }).open).toBe(false);
    expect(doorShot(0, { x: 5.9, z: 10.2 }).open).toBe(false);
  });
});
