import { describe, expect, it } from 'vitest';
import playersData from '../data/players.json';
import { SHOTS } from './catalog';
import { canRunOut, playableShots, RUN_OUT_COST, runOutChance, runOutReturn, startPoint, stepHit, type PointState, type Step, type Teams } from './point';
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
    expect(runOutChance(p(5), p(5).maxGuts, 1)).toBeCloseTo(0.35);
    expect(runOutChance(p(5), p(5).maxGuts, 0)).toBeCloseTo(0.15);
    expect(runOutChance(p(10), p(10).maxGuts, 1)).toBeLessThanOrEqual(0.75);
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
});
