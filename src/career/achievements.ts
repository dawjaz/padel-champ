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
  /** The most ranking points the hero ever had (before a new season halves them). */
  bestRank: number;
  /** The best place in the world ranking after a tournament (1 = top), 0 = none yet. */
  bestPosition: number;
  /** The most aces and the most smash winners in one career match. */
  maxAces: number;
  maxSmashes: number;
}

export const emptyRecords = (): Records => ({ streak: 0, bestStreak: 0, longestRally: 0, shutouts: 0, bestRank: 0, bestPosition: 0, maxAces: 0, maxSmashes: 0 });

export interface MatchFacts {
  won: boolean;
  longestRally: number;
  /** Games the hero's side lost in this match. */
  gamesLost: number;
  aces?: number;
  smashes?: number;
  /** The hero's ranking points now, and the place in the world ranking when a tournament has just ended. */
  rankPoints?: number;
  position?: number;
}

/** Updates the records after a match. */
export function recordMatch(r: Records, m: MatchFacts): Records {
  const streak = m.won ? r.streak + 1 : 0;
  return {
    streak,
    bestStreak: Math.max(r.bestStreak, streak),
    longestRally: Math.max(r.longestRally, m.longestRally),
    shutouts: r.shutouts + (m.won && m.gamesLost === 0 ? 1 : 0),
    bestRank: Math.max(r.bestRank, m.rankPoints ?? 0),
    bestPosition: m.position && m.position > 0 ? (r.bestPosition > 0 ? Math.min(r.bestPosition, m.position) : m.position) : r.bestPosition,
    maxAces: Math.max(r.maxAces, m.aces ?? 0),
    maxSmashes: Math.max(r.maxSmashes, m.smashes ?? 0),
  };
}

export function sanitizeRecords(raw: unknown): Records {
  const o = (raw ?? {}) as Partial<Record<string, unknown>>;
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const r: Records = {
    streak: n(o.streak),
    bestStreak: n(o.bestStreak),
    longestRally: Math.min(n(o.longestRally), 500),
    shutouts: n(o.shutouts),
    bestRank: Math.min(n(o.bestRank), 1000000),
    bestPosition: Math.min(n(o.bestPosition), 1000),
    maxAces: Math.min(n(o.maxAces), 500),
    maxSmashes: Math.min(n(o.maxSmashes), 500),
  };
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
