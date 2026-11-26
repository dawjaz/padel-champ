import { describe, expect, it } from 'vitest';
import { addTrial, claimGoal, goalProgress, goalsOf, goalsWaiting, goalViews, GOAL_COINS, newCampGoals, sanitizeCampGoals, DAY_GOALS, WEEK_GOALS, type GoalDef } from './campGoals';
import { newProfile } from './profile';

const D = '2026-11-26';
const W = '2026-11-23';

describe('camp goals', () => {
  it('two goals a day and two a week, of different kinds, the same all period', () => {
    for (const [per, key] of [['day', D], ['week', W]] as const) {
      const g = goalsOf(per, key);
      expect(g).toHaveLength(2);
      expect(new Set(g.map((x) => x.kind)).size).toBe(2);
      expect(goalsOf(per, key)).toEqual(g);
    }
    expect(new Set(DAY_GOALS.map((g) => g.id)).size).toBe(DAY_GOALS.length);
    expect(new Set(WEEK_GOALS.map((g) => g.id)).size).toBe(WEEK_GOALS.length);
  });

  it('counts trials, stars, the best, three-star trials and different games, per game when a goal names one', () => {
    const log = [{ g: 'targets', s: 1 }, { g: 'targets', s: 3 }, { g: 'smash', s: 2 }] as const;
    const mk = (kind: GoalDef['kind'], n: number, game?: GoalDef['game']): GoalDef => ({ id: 'x', text: '', kind, n, game });
    expect(goalProgress(mk('trials', 9), [...log])).toBe(3);
    expect(goalProgress(mk('stars', 9), [...log])).toBe(6);
    expect(goalProgress(mk('best', 3), [...log])).toBe(3);
    expect(goalProgress(mk('best', 3, 'smash'), [...log])).toBe(2);
    expect(goalProgress(mk('perfect', 5), [...log])).toBe(1);
    expect(goalProgress(mk('games', 9), [...log])).toBe(2);
    expect(goalProgress(mk('trials', 2), [...log])).toBe(2); // never above n
  });

  it('a trial counts for the day and the week; a new day or week starts empty', () => {
    let g = addTrial(newCampGoals(), D, W, 'serve', 3);
    g = addTrial(g, D, W, 'timing', 2);
    expect(g.dayLog).toHaveLength(2);
    expect(g.weekLog).toHaveLength(2);
    const tomorrow = addTrial(g, '2026-11-27', W, 'smash', 1);
    expect(tomorrow.dayLog).toHaveLength(1);
    expect(tomorrow.weekLog).toHaveLength(3);
    const next = addTrial(g, '2026-11-30', '2026-11-30', 'smash', 1);
    expect(next.weekLog).toHaveLength(1);
    expect(next.dayClaimed).toEqual([]);
  });

  it('pays a finished goal once, with its coins, and only goals of that period', () => {
    let g = newCampGoals();
    for (let i = 0; i < 6; i++) for (const game of ['targets', 'serve', 'timing', 'smash'] as const) g = addTrial(g, D, W, game, 3);
    const day = goalViews(g, 'day', D, W);
    expect(day.every((v) => v.done)).toBe(true);
    expect(goalsWaiting(g, D, W)).toBe(true);
    const p = newProfile();
    const r = claimGoal(p, g, 'day', D, W, day[0].def.id)!;
    expect(r.profile.coins).toBe(p.coins + GOAL_COINS.day);
    expect(claimGoal(r.profile, r.goals, 'day', D, W, day[0].def.id)).toBeNull();
    expect(claimGoal(p, g, 'week', D, W, day[0].def.id)).toBeNull(); // a day goal is not a week goal
    expect(claimGoal(p, newCampGoals(), 'day', D, W, day[0].def.id)).toBeNull(); // not finished
    expect(goalsWaiting(newCampGoals(), D, W)).toBe(false);
  });

  it('sanitizes a stored record', () => {
    expect(sanitizeCampGoals(undefined)).toEqual(newCampGoals());
    const s = sanitizeCampGoals({ day: 'x', week: W, dayLog: [{ g: 'smash', s: 9 }, { g: 'nope', s: 1 }, 5], weekLog: 'no', dayClaimed: ['d_best3', 'zzz', 'd_best3'], weekClaimed: [3] });
    expect(s.day).toBe('');
    expect(s.week).toBe(W);
    expect(s.dayLog).toEqual([{ g: 'smash', s: 3 }]);
    expect(s.weekLog).toEqual([]);
    expect(s.dayClaimed).toEqual(['d_best3']);
    expect(s.weekClaimed).toEqual([]);
  });
});
