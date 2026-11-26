import playersData from '../data/players.json';
import { describe, expect, it } from 'vitest';
import levels from '../data/levels.json';
import { STAT_KEYS } from '../game/attributes';
import { award, canSpend, freePoints, heroFrom, levelOf, levelProgress, matchReward, newProfile, pointsEarned, respec, sanitizeProfile, spend, withGender, heroLane, heroLook, HERO_DEFAULTS, statCap, statValue, unspend, xpToReach, unlockedSpecials } from './profile';
import type { PlayerDef } from '../game/types';

describe('levels', () => {
  it('xp thresholds grow and levels follow them', () => {
    for (let l = 1; l < levels.maxLevel; l++) expect(xpToReach(l + 1)).toBeGreaterThan(xpToReach(l));
    expect(levelOf(0)).toBe(1);
    expect(levelOf(xpToReach(5))).toBe(5);
    expect(levelOf(xpToReach(5) - 1)).toBe(4);
    expect(levelOf(1e9)).toBe(levels.maxLevel);
    expect(levelProgress(xpToReach(3))).toBeCloseTo(0);
    expect(levelProgress(1e9)).toBe(1);
  });

  it('the caps rise with the level and the total points fit under them', () => {
    expect(statCap(1)).toBe(levels.capBase);
    expect(statCap(levels.maxLevel)).toBe(levels.statMax);
    const room = STAT_KEYS.length * (levels.statMax - levels.startStat);
    expect(pointsEarned(levels.maxLevel)).toBe(room); // a maxed hero is reachable and no point is ever stuck
  });

  it('every point earned can be spent at once: the room under the cap is never smaller than the points (owner: level 5, points stuck)', () => {
    for (let level = 1; level <= levels.maxLevel; level++) {
      const roomNow = STAT_KEYS.length * (statCap(level) - levels.startStat);
      expect(pointsEarned(level), `level ${level}`).toBeLessThanOrEqual(roomNow);
    }
    // the hero from the report: level 5, everything at the old cap of 5
    let p = { ...newProfile(), xp: xpToReach(5) };
    for (const k of STAT_KEYS) p = spend(p, k);
    expect(freePoints(p)).toBeGreaterThan(0);
    expect(STAT_KEYS.some((k) => canSpend(p, k))).toBe(true);
  });
});

describe('taking a point back', () => {
  it('returns one point from a stat, never below the start, and frees it again', () => {
    let p = newProfile();
    const before = freePoints(p);
    const base = statValue(p, 'power');
    expect(unspend(p, 'power')).toBe(p);
    p = spend(spend(p, 'power'), 'speed');
    expect(statValue(p, 'power')).toBe(base + 1);
    expect(freePoints(p)).toBe(before - 2);
    p = unspend(p, 'power');
    expect(statValue(p, 'power')).toBe(base);
    expect(freePoints(p)).toBe(before - 1);
    p = unspend(unspend(p, 'power'), 'speed');
    expect(statValue(p, 'power')).toBe(base);
    expect(freePoints(p)).toBe(before);
  });
});

describe('spending points', () => {
  it('starts with free points, spends one at a time up to the cap and no further', () => {
    let p = newProfile();
    expect(freePoints(p)).toBe(levels.startPoints);
    p = spend(p, 'power');
    expect(statValue(p, 'power')).toBe(levels.startStat + 1);
    expect(freePoints(p)).toBe(levels.startPoints - 1);
    while (canSpend(p, 'power')) p = spend(p, 'power');
    expect(statValue(p, 'power')).toBe(statCap(1));
    expect(spend(p, 'power')).toBe(p);
    expect(canSpend(p, 'spin')).toBe(freePoints(p) > 0);
  });

  it('respec gives every point back', () => {
    const p = respec(spend(spend(newProfile(), 'spin'), 'speed'));
    expect(freePoints(p)).toBe(levels.startPoints);
  });

  it('a level up brings new points', () => {
    const p = award(newProfile(), { xp: xpToReach(4), coins: 0 });
    expect(levelOf(p.xp)).toBe(4);
    expect(freePoints(p)).toBe(levels.startPoints + 3 * levels.pointsPerLevel);
  });
});

describe('rewards', () => {
  it('a win pays more than a loss, more points pay more, and nothing is negative', () => {
    const base = { pointsWon: 10, pointsLost: 20, longestRally: 5 };
    const win = matchReward({ ...base, won: true });
    const loss = matchReward({ ...base, won: false });
    expect(win.xp).toBeGreaterThan(loss.xp);
    expect(win.coins).toBeGreaterThan(loss.coins);
    expect(loss.xp).toBeGreaterThan(0);
    expect(matchReward({ ...base, won: true, pointsWon: 20 }).xp).toBeGreaterThan(win.xp);
    expect(matchReward({ ...base, won: true, longestRally: 99 }).xp - win.xp).toBeLessThanOrEqual(20);
  });
});

describe('storage safety', () => {
  it('junk becomes a valid profile, cheating is cut to the earned points and the cap', () => {
    expect(sanitizeProfile(null)).toEqual(newProfile());
    expect(sanitizeProfile({ xp: -5, coins: 'x', alloc: { power: -3 } })).toEqual(newProfile());
    const cheat = sanitizeProfile({ xp: 0, alloc: Object.fromEntries(STAT_KEYS.map((k) => [k, 99])) });
    expect(STAT_KEYS.reduce((n, k) => n + cheat.alloc[k], 0)).toBe(levels.startPoints);
    for (const k of STAT_KEYS) expect(statValue(cheat, k)).toBeLessThanOrEqual(statCap(1));
    expect(freePoints(cheat)).toBe(0);
  });

  it('the hero gets the profile attributes and matching guts', () => {
    const base = { id: 'toro', name: 'Toro', stats: {}, maxGuts: 1, appearance: {} } as unknown as PlayerDef;
    const p = spend(spend(award(newProfile(), { xp: xpToReach(6), coins: 0 }), 'stamina'), 'stamina');
    const hero = heroFrom(base, p);
    expect(hero.stats.stamina).toBe(levels.startStat + 2);
    expect(hero.stats.power).toBe(levels.startStat);
    expect(hero.maxGuts).toBe(Math.round(6 + 0.8 * hero.stats.stamina));
    expect(hero.id).toBe('toro');
  });
});

describe('hero gender', () => {
  it('switches the default name and look, keeps a custom name', () => {
    const f = withGender(newProfile(), 'female');
    expect(f.name).toBe(HERO_DEFAULTS.female.name);
    expect(heroLook(f).gender).toBe('female');
    const custom = withGender({ ...newProfile(), name: 'Kasia' }, 'female');
    expect(custom.name).toBe('Kasia');
    expect(withGender(f, 'male').name).toBe(HERO_DEFAULTS.male.name);
  });
  it('sanitizes the stored gender and falls back to the default name of it', () => {
    expect(sanitizeProfile({ gender: 'female', name: '' }).name).toBe(HERO_DEFAULTS.female.name);
    expect(sanitizeProfile({ gender: 'x' }).gender).toBe('male');
  });
});

describe('hero side', () => {
  it('defaults to the left lane and is sanitized', () => {
    expect(newProfile().heroSide).toBe('left');
    expect(heroLane(newProfile())).toBe(0);
    expect(sanitizeProfile({ heroSide: 'right' }).heroSide).toBe('right');
    expect(heroLane(sanitizeProfile({ heroSide: 'right' }))).toBe(1);
    expect(sanitizeProfile({ heroSide: 'up' }).heroSide).toBe('left');
  });
});

describe('hero special shot', () => {
  it('unlocks by level and nothing expires: the hero plays every special he has unlocked', () => {
    const p = newProfile();
    const base = playersData.you[0] as unknown as PlayerDef;
    expect(heroFrom(base, p).specials).toBeUndefined();
    const at = (lvl: number) => ({ ...p, xp: xpToReach(lvl) });
    expect(unlockedSpecials(3)).toEqual(['sp_skyrocket']);
    expect(heroFrom(base, at(3)).specials).toEqual(['sp_skyrocket']);
    expect(heroFrom(base, at(6)).specials).toEqual(['sp_skyrocket', 'sp_venom']); // the old one stays
    expect(unlockedSpecials(15)).toHaveLength(4);
    expect(heroFrom(base, at(15)).specials).toHaveLength(4);
    expect('special' in sanitizeProfile({ special: 'sp_freeze' })).toBe(false); // the old one-at-a-time choice is gone
  });
});
