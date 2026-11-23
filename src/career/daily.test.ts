import { describe, expect, it } from 'vitest';
import { newProfile } from './profile';
import { addFacts, bonusReady, claimBonus, claimLogin, claimTask, dayKey, hasWaiting, loginReward, loginStatus, newDaily, previousDay, sanitizeDaily, STREAK_LENGTH, taskViews, tasksOf, TASKS, type DailyFacts } from './daily';

const facts = (o: Partial<DailyFacts> = {}): DailyFacts => ({ won: true, points: 24, longestRally: 12, smash: 3, dejada: 1, viboraBandeja: 2, bajada: 1, ace: 2, ...o });

describe('days', () => {
  it('formats the local date and finds the previous day across month and year ends', () => {
    expect(dayKey(new Date(2026, 10, 3))).toBe('2026-11-03');
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2027-01-01')).toBe('2026-12-31');
    expect(previousDay('2028-03-01')).toBe('2028-02-29');
  });
});

describe('login streak', () => {
  it('pays day 1, then not again on the same day', () => {
    const r = claimLogin(newProfile(), newDaily(), '2026-11-23')!;
    expect(r.reward.coins).toBe(loginReward(1).coins);
    expect(r.profile.coins).toBe(loginReward(1).coins);
    expect(claimLogin(r.profile, r.daily, '2026-11-23')).toBeNull();
    expect(hasWaiting(r.daily, '2026-11-23')).toBe(false);
  });
  it('continues on the next day, restarts after a missed day', () => {
    const a = claimLogin(newProfile(), newDaily(), '2026-11-23')!;
    const b = claimLogin(a.profile, a.daily, '2026-11-24')!;
    expect(b.daily.streak).toBe(2);
    expect(loginStatus(b.daily, '2026-11-26')).toMatchObject({ claimable: true, day: 1, streak: 1 });
  });
  it('day 7 brings a pack and the cycle starts over on day 8', () => {
    let p = newProfile();
    let d = newDaily();
    let day = '2026-11-01';
    for (let i = 1; i <= STREAK_LENGTH; i++) {
      const r = claimLogin(p, d, day)!;
      p = r.profile;
      d = r.daily;
      if (i === STREAK_LENGTH) expect(r.reward.pack).toBe(true);
      day = `2026-11-${String(i + 1).padStart(2, '0')}`;
    }
    expect(p.inventory.packs.gear).toBe(1);
    expect(loginStatus(d, '2026-11-08').day).toBe(1);
  });
});

describe('daily tasks', () => {
  it('are the same all day, differ by stat and change between days', () => {
    const a = tasksOf('2026-11-23');
    expect(tasksOf('2026-11-23').map((t) => t.id)).toEqual(a.map((t) => t.id));
    expect(a).toHaveLength(3);
    expect(new Set(a.map((t) => t.stat)).size).toBe(3);
    const ids = new Set<string>();
    for (let d = 1; d <= 28; d++) for (const t of tasksOf(`2026-11-${String(d).padStart(2, '0')}`)) ids.add(t.id);
    expect(ids.size).toBeGreaterThan(6);
    expect(TASKS.length).toBeGreaterThanOrEqual(8);
  });
  it('count facts of a match, are claimed once, and the bonus needs all three', () => {
    const today = '2026-11-23';
    let p = newProfile();
    let d = newDaily();
    // Several matches are enough to finish any task of the day.
    for (let i = 0; i < 3; i++) d = addFacts(d, today, facts({ points: 40, longestRally: 20, smash: 5, dejada: 3, viboraBandeja: 5, bajada: 3, ace: 5 }));
    const views = taskViews(d, today);
    expect(views.every((v) => v.done)).toBe(true);
    for (const v of views) {
      const r = claimTask(p, d, today, v.def.id)!;
      p = r.profile;
      d = r.daily;
      expect(claimTask(p, d, today, v.def.id)).toBeNull();
    }
    expect(bonusReady(d, today)).toBe(true);
    const b = claimBonus(p, d, today)!;
    expect(b.profile.coins).toBeGreaterThan(p.coins);
    expect(claimBonus(b.profile, b.daily, today)).toBeNull();
  });
  it('rally is a maximum, other counts add up, and a new day clears the progress', () => {
    let d = addFacts(newDaily(), '2026-11-23', facts({ longestRally: 7, points: 10 }));
    d = addFacts(d, '2026-11-23', facts({ longestRally: 5, points: 10 }));
    expect(d.progress.rally).toBe(7);
    expect(d.progress.points).toBe(20);
    expect(d.progress.played).toBe(2);
    expect(addFacts(d, '2026-11-24', facts({ points: 1 })).progress.points).toBe(1);
  });
  it('cannot claim a task that is not done', () => {
    expect(claimTask(newProfile(), newDaily(), '2026-11-23', tasksOf('2026-11-23')[0].id)).toBeNull();
  });
});

describe('sanitizeDaily', () => {
  it('repairs garbage', () => {
    expect(sanitizeDaily(null)).toEqual(newDaily());
    const s = sanitizeDaily({ lastLogin: 'x', streak: -4, day: '2026-11-23', progress: { points: 5, hack: 99 }, claimed: ['play2', 'nope'], bonusClaimed: 'yes' });
    expect(s.lastLogin).toBe('');
    expect(s.streak).toBe(0);
    expect(s.progress).toEqual({ points: 5 });
    expect(s.claimed).toEqual(['play2']);
    expect(s.bonusClaimed).toBe(false);
  });
});
