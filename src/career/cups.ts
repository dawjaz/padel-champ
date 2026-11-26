// The cup cabinet: one cup per city + division of the calendar (35), gold for the title, silver for losing the final.
// Pure (no Phaser), tested. Challenges (sets of golden cups) pay coins and packs once.

import cupsData from '../data/cups.json';
import { divisionById, DIVISIONS } from './tournament';
import { EVENTS } from './season';

export type CupKind = 'gold' | 'silver';

export interface Cup {
  id: string;
  city: string;
  division: string;
  /** "Regional Open Warsaw" */
  name: string;
  symbol: string;
}

export interface CupRecord {
  gold: number;
  silver: number;
  /** The season of the last gold or silver. */
  season: number;
}

export type CupShelf = Record<string, CupRecord>;

export interface CupChallenge {
  id: string;
  name: string;
  divisions?: string[];
  cities?: string[];
  golds?: number;
  coins: number;
  packs: Record<string, number>;
}

export const cupId = (city: string, division: string): string => `${city}|${division}`;

const divIndex = (id: string): number => DIVISIONS.findIndex((d) => d.id === id);

/** Every cup of the game, from the lowest division up, each group in calendar order. */
export const CUPS: Cup[] = (() => {
  const seen = new Set<string>();
  const list: Cup[] = [];
  for (const e of EVENTS) {
    const id = cupId(e.city, e.division);
    if (seen.has(id)) continue;
    seen.add(id);
    list.push({ id, city: e.city, division: e.division, name: `${divisionById(e.division)?.name ?? e.division} ${e.city}`, symbol: (cupsData.symbols as Record<string, string>)[e.city] ?? 'star' });
  }
  return list.sort((a, b) => divIndex(a.division) - divIndex(b.division));
})();

export const CHALLENGES = cupsData.challenges as unknown as CupChallenge[];

export const cupById = (id: string): Cup | undefined => CUPS.find((c) => c.id === id);

export const emptyShelf = (): CupShelf => ({});

export const isGold = (shelf: CupShelf, id: string): boolean => (shelf[id]?.gold ?? 0) > 0;

export const goldCount = (shelf: CupShelf): number => CUPS.filter((c) => isGold(shelf, c.id)).length;

/** The cup that was won (or lost in the final) at an event, or undefined for an event that is not on the calendar. */
export const cupOfEvent = (city: string, division: string): Cup | undefined => cupById(cupId(city, division));

export function recordCup(shelf: CupShelf, id: string, kind: CupKind, season: number): CupShelf {
  if (!cupById(id)) return shelf;
  const r = shelf[id] ?? { gold: 0, silver: 0, season: 1 };
  return { ...shelf, [id]: { gold: r.gold + (kind === 'gold' ? 1 : 0), silver: r.silver + (kind === 'silver' ? 1 : 0), season } };
}

/** The cups a set challenge asks for (empty for a count challenge). */
export function requiredCups(ch: CupChallenge): Cup[] {
  if (ch.divisions) return CUPS.filter((c) => ch.divisions!.includes(c.division));
  if (ch.cities) return CUPS.filter((c) => ch.cities!.includes(c.city));
  return [];
}

/** How many golden cups of the challenge the hero has, and how many it needs (only gold counts). */
export function challengeProgress(ch: CupChallenge, shelf: CupShelf): { have: number; need: number } {
  if (ch.golds) return { have: Math.min(goldCount(shelf), ch.golds), need: ch.golds };
  const req = requiredCups(ch);
  return { have: req.filter((c) => isGold(shelf, c.id)).length, need: req.length };
}

export const challengeDone = (ch: CupChallenge, shelf: CupShelf): boolean => {
  const p = challengeProgress(ch, shelf);
  return p.need > 0 && p.have >= p.need;
};

/** Challenges that are complete now and have not been paid yet. */
export const unclaimed = (shelf: CupShelf, claims: string[]): CupChallenge[] => CHALLENGES.filter((c) => !claims.includes(c.id) && challengeDone(c, shelf));

/** Cleans a stored shelf: known cups, whole numbers. */
export function sanitizeShelf(raw: unknown): CupShelf {
  const out: CupShelf = {};
  if (!raw || typeof raw !== 'object') return out;
  const n = (v: unknown, min: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.floor(v)) : min);
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!cupById(id) || !v || typeof v !== 'object') continue;
    const r = v as Partial<Record<string, unknown>>;
    const gold = n(r.gold, 0);
    const silver = n(r.silver, 0);
    if (gold + silver > 0) out[id] = { gold, silver, season: n(r.season, 1) };
  }
  return out;
}

export const sanitizeClaims = (raw: unknown): string[] => (Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string' && CHALLENGES.some((c) => c.id === x)))] : []);

/** The cups of the last tournaments won, newest first (at most six). */
export function lastTrophies(history: Array<{ event: string; champion: boolean }>): Cup[] {
  const out: Cup[] = [];
  for (const h of [...history].reverse()) {
    if (!h.champion) continue;
    const cup = CUPS.find((c) => c.name === h.event);
    if (cup) out.push(cup);
    if (out.length >= 6) break;
  }
  return out;
}
