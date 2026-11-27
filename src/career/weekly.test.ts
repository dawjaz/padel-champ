import { describe, expect, it } from 'vitest';
import { newProfile } from './profile';
import type { DailyFacts } from './daily';
import { addWeeklyCampTrial, addWeeklyFacts, claimWeeklyBonus, claimWeeklyTask, daysLeft, newWeekly, sanitizeWeekly, weekKey, weeklyBonusReady, weeklyTasksOf, weeklyViews, weeklyWaiting, WEEKLY_BONUS_COINS, WEEKLY_TASK_COINS } from './weekly';

/** A week of everything: a big match and three camp trials with three stars each. */
const everything = (w: ReturnType<typeof newWeekly>, week: string): ReturnType<typeof newWeekly> => {
  let r = addWeeklyFacts(w, week, big);
  for (let i = 0; i < 3; i++) r = addWeeklyCampTrial(r, week, 3);
  return r;
};

const big: DailyFacts = { won: true, points: 500, longestRally: 99, smash: 99, dejada: 99, viboraBandeja: 99, bajada: 99, ace: 99 };

describe('weekly challenges', () => {
  it('weeks run Monday to Sunday', () => {
    expect(weekKey(new Date(2026, 10, 23))).toBe('2026-11-23'); // a Monday
    expect(weekKey(new Date(2026, 10, 29))).toBe('2026-11-23'); // the Sunday after it
    expect(weekKey(new Date(2026, 10, 30))).toBe('2026-11-30');
    expect(weekKey(new Date(2026, 0, 1))).toBe('2025-12-29');
    expect(daysLeft(new Date(2026, 10, 23))).toBe(6);
    expect(daysLeft(new Date(2026, 10, 29))).toBe(0);
  });
  it('picks three tasks with different stats, the same for the whole week', () => {
    const t = weeklyTasksOf('2026-11-23');
    expect(t).toHaveLength(3);
    expect(new Set(t.map((x) => x.stat)).size).toBe(3);
    expect(weeklyTasksOf('2026-11-23')).toEqual(t);
  });
  it('a new week starts with empty progress', () => {
    const w = everything(newWeekly(), '2026-11-23');
    expect(weeklyViews(w, '2026-11-23').every((v) => v.done)).toBe(true);
    expect(weeklyViews(w, '2026-11-30').every((v) => v.have === 0)).toBe(true);
  });
  it('pays each task once, then the bonus with a pack once', () => {
    let p = newProfile();
    let w = everything(newWeekly(), '2026-11-23');
    expect(weeklyWaiting(w, '2026-11-23')).toBe(true);
    for (const v of weeklyViews(w, '2026-11-23')) {
      const r = claimWeeklyTask(p, w, '2026-11-23', v.def.id)!;
      expect(claimWeeklyTask(r.profile, r.weekly, '2026-11-23', v.def.id)).toBeNull();
      p = r.profile;
      w = r.weekly;
    }
    expect(p.coins).toBe(newProfile().coins + 3 * WEEKLY_TASK_COINS);
    expect(weeklyBonusReady(w, '2026-11-23')).toBe(true);
    const b = claimWeeklyBonus(p, w, '2026-11-23')!;
    expect(b.profile.coins).toBe(p.coins + WEEKLY_BONUS_COINS);
    expect(Object.values(b.profile.inventory.packs).reduce((a, n) => a + n, 0)).toBe(Object.values(p.inventory.packs).reduce((a, n) => a + n, 0) + 1);
    expect(claimWeeklyBonus(b.profile, b.weekly, '2026-11-23')).toBeNull();
    expect(weeklyWaiting(b.weekly, '2026-11-23')).toBe(false);
  });
  it('does not pay unfinished tasks and sanitizes junk', () => {
    expect(claimWeeklyTask(newProfile(), newWeekly(), '2026-11-23', weeklyTasksOf('2026-11-23')[0].id)).toBeNull();
    expect(sanitizeWeekly({ week: 5, progress: { won: -3, nope: 4 }, claimed: ['x', 7], bonusClaimed: 'yes' })).toEqual({ week: '', progress: { won: 0 }, claimed: [], bonusClaimed: false });
  });
});
