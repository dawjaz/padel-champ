// The hero's career profile: XP, level, coins and the skill points spent on the seven attributes. Pure (no Phaser), tested.
// All numbers live in src/data/levels.json.

import levels from '../data/levels.json';
import playersData from '../data/players.json';
import { cleanName, MAX_NAME, MAX_NICK } from '../game/names';
import packsData from '../data/packs.json';
import { newCareer, sanitizeCareer, type Career } from './season';
import { applyLook, gearBonus, legacyRefund, newInventory, sanitizeInventory, syncUnlocks, type Boost, type Inventory } from './gear';
import { emptyShelf, sanitizeClaims, sanitizeShelf, type CupShelf } from './cups';
import { gutsFor, STAT_KEYS } from '../game/attributes';
import type { Appearance, Gender, PlayerDef, StatKey } from '../game/types';

/** The side of the court the hero plays on, as the TV camera sees it: left (lane 0) or right (lane 1). */
export type HeroSide = 'left' | 'right';

export type Alloc = Record<StatKey, number>;

export interface Profile {
  /** The hero's name and nickname (the player can change both). */
  name: string;
  nick: string;
  /** Male or female hero: the look and the default name (see `HERO_DEFAULTS`). */
  gender: Gender;
  /** The preferred side of the court (can be changed before every match). */
  heroSide: HeroSide;
  xp: number;
  coins: number;
  /** Skill points put into each attribute (on top of `levels.startStat`). */
  alloc: Alloc;
  /** Gear, consumables (see gear.ts). */
  inventory: Inventory;
  /** The cup cabinet and the cup challenges already paid (see cups.ts). */
  cups: CupShelf;
  cupClaims: string[];
  /** Calendar, ranking, the tournament in progress and the partner (see season.ts). */
  career: Career;
}

export interface MatchSummary {
  won: boolean;
  /** Points won / lost by the hero's team. */
  pointsWon: number;
  pointsLost: number;
  /** Longest rally of the match, in hits. */
  longestRally: number;
}

export interface Reward {
  xp: number;
  coins: number;
}

export const emptyAlloc = (): Alloc => Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Alloc;

const BASE_HERO = playersData.you[0];
export const DEFAULT_NAME = BASE_HERO.name;
export const DEFAULT_NICK = BASE_HERO.nick;

export const HERO_DEFAULTS = playersData.heroDefaults as Record<Gender, { name: string; nick: string; hairStyle: Appearance['hairStyle'] }>;

/** The hero's look: the base look of the hero in the chosen gender, with the colours of the equipped gear. */
export const heroLook = (p: Pick<Profile, 'gender' | 'inventory'>, base: Appearance = BASE_HERO.appearance as Appearance): Appearance =>
  applyLook({ ...base, gender: p.gender, hairStyle: HERO_DEFAULTS[p.gender].hairStyle }, p.inventory);

/** The lane (player index in the team, 0 = left, 1 = right) the hero plays in. */
export const heroLane = (p: Pick<Profile, 'heroSide'>): number => (p.heroSide === 'right' ? 1 : 0);

/** Switches the hero's gender; a name or nickname that is still the default of the other gender becomes the default of the new one. */
export function withGender(p: Profile, gender: Gender): Profile {
  if (p.gender === gender) return p;
  const from = HERO_DEFAULTS[p.gender];
  const to = HERO_DEFAULTS[gender];
  return { ...p, gender, name: p.name === from.name ? to.name : p.name, nick: p.nick === from.nick ? to.nick : p.nick };
}

export const newProfile = (): Profile => ({ name: DEFAULT_NAME, nick: DEFAULT_NICK, gender: 'male', heroSide: 'left', cups: emptyShelf(), cupClaims: [], xp: 0, coins: 0, alloc: emptyAlloc(), inventory: newInventory(), career: newCareer() });

/** Total XP needed to reach `level` (level 1 = 0). */
export function xpToReach(level: number): number {
  if (level <= 1) return 0;
  return Math.round(levels.xpBase * Math.pow(level - 1, levels.xpExp));
}

export function levelOf(xp: number): number {
  let level = 1;
  while (level < levels.maxLevel && xp >= xpToReach(level + 1)) level++;
  return level;
}

/** Progress inside the current level, 0..1 (1 at the max level). */
export function levelProgress(xp: number): number {
  const level = levelOf(xp);
  if (level >= levels.maxLevel) return 1;
  const lo = xpToReach(level);
  return (xp - lo) / (xpToReach(level + 1) - lo);
}

/** Highest value one attribute may have at this level (before gear). */
export const statCap = (level: number): number =>
  Math.min(levels.statMax, levels.capBase + Math.floor((Math.max(1, level) - 1) / levels.levelsPerCap));

export const pointsEarned = (level: number): number => levels.startPoints + (Math.max(1, level) - 1) * levels.pointsPerLevel;

export const pointsSpent = (alloc: Alloc): number => STAT_KEYS.reduce((n, k) => n + alloc[k], 0);

export const freePoints = (p: Profile): number => pointsEarned(levelOf(p.xp)) - pointsSpent(p.alloc);

export const statValue = (p: Profile, key: StatKey): number => levels.startStat + p.alloc[key];

export function canSpend(p: Profile, key: StatKey): boolean {
  return freePoints(p) > 0 && statValue(p, key) < statCap(levelOf(p.xp));
}

export function spend(p: Profile, key: StatKey): Profile {
  return canSpend(p, key) ? { ...p, alloc: { ...p.alloc, [key]: p.alloc[key] + 1 } } : p;
}

export const canUnspend = (p: Profile, key: StatKey): boolean => p.alloc[key] > 0;

/** Takes one skill point back from a stat (never below the starting value). */
export function unspend(p: Profile, key: StatKey): Profile {
  return canUnspend(p, key) ? { ...p, alloc: { ...p.alloc, [key]: p.alloc[key] - 1 } } : p;
}

/** Takes the whole allocation back (free for now; a cost can come with the shop). */
export const respec = (p: Profile): Profile => ({ ...p, alloc: emptyAlloc() });

export function matchReward(m: MatchSummary): Reward {
  const r = levels.reward;
  const rallyBonus = Math.max(0, m.longestRally - r.rallyHitsFrom + 1) * r.xpPerRallyHit;
  return {
    xp: r.xpPlayed + (m.won ? r.xpWin : 0) + m.pointsWon * r.xpPerPoint + Math.min(rallyBonus, 20),
    coins: r.coinsPlayed + (m.won ? r.coinsWin : 0) + m.pointsWon * r.coinsPerPoint,
  };
}

export function award(p: Profile, r: Reward): Profile {
  const xp = p.xp + r.xp;
  const gained = levelOf(xp) - levelOf(p.xp);
  const inv = syncUnlocks(p.inventory, levelOf(xp));
  // Every level up brings one free pack.
  const packs = gained > 0 ? { ...inv.packs, [packsData.levelUpPack]: (inv.packs[packsData.levelUpPack] ?? 0) + gained } : inv.packs;
  return { ...p, xp, coins: p.coins + r.coins, inventory: { ...inv, packs } };
}

/** Makes a stored profile safe: whole numbers, nothing above the level cap, never more points than earned. */
export function sanitizeProfile(raw: unknown): Profile {
  const o = (raw ?? {}) as Partial<Record<string, unknown>>;
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const xp = n(o.xp);
  const level = levelOf(xp);
  const src = (o.alloc ?? {}) as Partial<Record<string, unknown>>;
  const alloc = emptyAlloc();
  let left = pointsEarned(level);
  for (const k of STAT_KEYS) {
    const v = Math.min(n(src[k]), statCap(level) - levels.startStat, left);
    alloc[k] = Math.max(0, v);
    left -= alloc[k];
  }
  const gender: Gender = o.gender === 'female' ? 'female' : 'male';
  return { name: cleanName(o.name, MAX_NAME, HERO_DEFAULTS[gender].name), nick: cleanName(o.nick, MAX_NICK, HERO_DEFAULTS[gender].nick), gender, heroSide: o.heroSide === 'right' ? 'right' : 'left', cups: sanitizeShelf(o.cups), cupClaims: sanitizeClaims(o.cupClaims), xp, coins: n(o.coins) + legacyRefund(o.inventory), alloc, inventory: sanitizeInventory(o.inventory, level), career: sanitizeCareer(o.career) };
}

/** The playable hero: the base player with the attributes of the profile plus gear (and the boost of the queued consumables), capped at `statMax`, and the look of the equipped gear. */
export function heroFrom(base: PlayerDef, p: Profile, boost?: Boost): PlayerDef {
  const gear = gearBonus(p.inventory);
  const stats = Object.fromEntries(
    STAT_KEYS.map((k) => [k, Math.min(levels.statMax, statValue(p, k) + gear[k] + (boost?.stats[k] ?? 0))]),
  ) as Record<StatKey, number>;
  return { ...base, name: p.name, nick: p.nick, stats, maxGuts: gutsFor(stats.stamina) + (boost?.maxGuts ?? 0), appearance: heroLook(p, base.appearance) };
}
