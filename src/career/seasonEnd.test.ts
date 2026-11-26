import { describe, expect, it } from 'vitest';
import { advanceWeek, newCareer, sanitizeCareer, WEEKS } from './season';
import { closeSeason, dismissRecap, seasonPay, SEASON_MIN_EVENTS } from './seasonEnd';
import { newProfile } from './profile';
import { skipWeek } from './careerFlow';

describe('season end', () => {
  it('pays by the final place, more for titles, nothing for a season of skipped weeks', () => {
    expect(seasonPay(1, 12, 0).label).toBe('WORLD NUMBER 1');
    expect(seasonPay(1, 12, 0).coins).toBeGreaterThan(seasonPay(3, 12, 0).coins);
    expect(seasonPay(3, 12, 0).coins).toBeGreaterThan(seasonPay(40, 12, 0).coins);
    expect(seasonPay(40, 12, 2).coins).toBe(seasonPay(40, 12, 0).coins + 2 * 150);
    expect(seasonPay(40, 12, 0).packs).toEqual({ gear: 1 });
    expect(seasonPay(1, SEASON_MIN_EVENTS - 1, 0)).toMatchObject({ coins: 0, paid: false, packs: {} });
  });

  it('closing the last week starts the next season, pays once, leaves a recap and a line of history', () => {
    let p = newProfile();
    p = { ...p, career: { ...p.career, week: WEEKS, rankPoints: 3000, log: { events: 14, titles: 3, finals: 5, rankGained: 3000 } } };
    const coins = p.coins;
    const after = skipWeek(p);
    expect(after.career.season).toBe(2);
    expect(after.career.week).toBe(1);
    expect(after.career.rankPoints).toBe(1500);
    expect(after.career.log.events).toBe(0);
    const r = after.career.recap!;
    expect(r.season).toBe(1);
    expect(r.place).toBeGreaterThan(0);
    expect(r.log.titles).toBe(3);
    expect(r.carried).toBe(1500);
    expect(after.coins).toBe(coins + r.coins);
    expect(after.career.seasons).toHaveLength(1);
    expect(dismissRecap(after).career.recap).toBeNull();
    // an ordinary week changes nothing about seasons
    const mid = skipWeek(newProfile());
    expect(mid.career.recap).toBeNull();
    expect(closeSeason(mid, newCareer())).toBe(mid);
  });

  it('survives junk in a stored career and keeps what is valid', () => {
    const c = sanitizeCareer({ ...advanceWeek(newCareer()), log: { events: 'x', titles: 99 }, recap: { season: 1, label: 5 }, seasons: [{ season: 1, place: 4, points: 10, events: 9, titles: 1 }, 7] });
    expect(c.log).toEqual({ events: 0, titles: WEEKS, finals: 0, rankGained: 0 });
    expect(c.recap).toBeNull();
    expect(c.seasons).toEqual([{ season: 1, place: 4, points: 10, events: 9, titles: 1 }]);
  });
});
