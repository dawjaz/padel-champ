import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, claim, emptyRecords, newlyEarned, progressOf, recordMatch, sanitizeRecords, sanitizeUnlocked } from './achievements';
import { newProfile } from './profile';

describe('achievements', () => {
  it('ids are unique and every goal is reachable (n > 0, coins > 0)', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.n).toBeGreaterThan(0);
      expect(a.coins).toBeGreaterThan(0);
    }
  });
  it('records a win streak, best streak, longest rally and shutouts', () => {
    let r = emptyRecords();
    r = recordMatch(r, { won: true, longestRally: 12, gamesLost: 0 });
    r = recordMatch(r, { won: true, longestRally: 8, gamesLost: 1 });
    expect(r).toEqual({ streak: 2, bestStreak: 2, longestRally: 12, shutouts: 1 });
    r = recordMatch(r, { won: false, longestRally: 20, gamesLost: 2 });
    expect(r).toEqual({ streak: 0, bestStreak: 2, longestRally: 20, shutouts: 1 });
  });
  it('a fresh hero has nothing; a first win earns First Win and Level 1 goals only', () => {
    const p = newProfile();
    expect(newlyEarned(progressOf({ played: 0, won: 0 }, emptyRecords(), p), [])).toEqual([]);
    const ids = newlyEarned(progressOf({ played: 1, won: 1 }, recordMatch(emptyRecords(), { won: true, longestRally: 3, gamesLost: 1 }), p), []).map((a) => a.id);
    expect(ids).toEqual(['first_win']);
  });
  it('an unlocked achievement is not earned twice and claim pays the coins', () => {
    const p = newProfile();
    const prog = progressOf({ played: 1, won: 1 }, emptyRecords(), p);
    const earned = newlyEarned(prog, []);
    const c = claim(p, [], earned);
    expect(c.profile.coins).toBe(earned.reduce((s, a) => s + a.coins, 0));
    expect(newlyEarned(prog, c.unlocked)).toEqual([]);
  });
  it('sanitizing drops unknown ids, duplicates and nonsense numbers', () => {
    expect(sanitizeUnlocked(['first_win', 'first_win', 'cheat', 5])).toEqual(['first_win']);
    expect(sanitizeUnlocked('x')).toEqual([]);
    expect(sanitizeRecords({ streak: 3, bestStreak: 1, longestRally: 9999, shutouts: -4 })).toEqual({ streak: 3, bestStreak: 3, longestRally: 500, shutouts: 0 });
  });
});
