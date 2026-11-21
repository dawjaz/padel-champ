// Achievements: one-time goals with a coin reward. Pure (no Phaser), tested. The list lives in src/data/achievements.json.

import data from '../data/achievements.json';
import type { Profile } from './profile';
import { levelOf } from './profile';

export type AchStat = 'won' | 'played' | 'bestStreak' | 'longestRally' | 'shutouts' | 'level' | 'gearOwned' | 'titles' | 'partners';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  stat: AchStat;
  n: number;
  coins: number;
}

export const ACHIEVEMENTS = data as AchievementDef[];

/** Records kept besides the match counters (they live in the save, see save.ts). */
export interface Records {
  /** Matches won in a row (0 after a loss). */
  streak: number;
  bestStreak: number;
  /** Longest rally ever, in hits. */
  longestRally: number;
  /** Matches won without losing a game. */
  shutouts: number;
}

export const emptyRecords = (): Records => ({ streak: 0, bestStreak: 0, longestRally: 0, shutouts: 0 });

export interface MatchFacts {
  won: boolean;
  longestRally: number;
  /** Games the hero's side lost in this match. */
  gamesLost: number;
}

/** Updates the records after a match. */
export function recordMatch(r: Records, m: MatchFacts): Records {
  const streak = m.won ? r.streak + 1 : 0;
  return {
    streak,
    bestStreak: Math.max(r.bestStreak, streak),
    longestRally: Math.max(r.longestRally, m.longestRally),
    shutouts: r.shutouts + (m.won && m.gamesLost === 0 ? 1 : 0),
  };
}

export function sanitizeRecords(raw: unknown): Records {
  const o = (raw ?? {}) as Partial<Record<string, unknown>>;
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const r: Records = { streak: n(o.streak), bestStreak: n(o.bestStreak), longestRally: Math.min(n(o.longestRally), 500), shutouts: n(o.shutouts) };
  return { ...r, bestStreak: Math.max(r.bestStreak, r.streak) };
}

export function sanitizeUnlocked(raw: unknown): string[] {
  const known = new Set(ACHIEVEMENTS.map((a) => a.id));
  return Array.from(new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && known.has(x)) : []));
}

export interface Progress {
  won: number;
  played: number;
  bestStreak: number;
  longestRally: number;
  shutouts: number;
  level: number;
  gearOwned: number;
  titles: number;
  partners: number;
}

export function progressOf(stats: { played: number; won: number }, records: Records, profile: Profile): Progress {
  return {
    won: stats.won,
    played: stats.played,
    bestStreak: records.bestStreak,
    longestRally: records.longestRally,
    shutouts: records.shutouts,
    level: levelOf(profile.xp),
    gearOwned: profile.inventory.owned.length,
    titles: profile.career.titles,
    partners: profile.career.partners.length,
  };
}

/** The achievements reached now that are not unlocked yet. */
export function newlyEarned(p: Progress, unlocked: string[]): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.includes(a.id) && p[a.stat] >= a.n);
}

/** Unlocks them and pays the coins. */
export function claim(profile: Profile, unlocked: string[], earned: AchievementDef[]): { profile: Profile; unlocked: string[] } {
  const coins = earned.reduce((s, a) => s + a.coins, 0);
  return { profile: { ...profile, coins: profile.coins + coins }, unlocked: [...unlocked, ...earned.map((a) => a.id)] };
}
