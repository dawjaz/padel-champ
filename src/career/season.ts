// The career calendar: seasons of weeks with events, ranking points, the tournament in progress and the partner. Pure, tested.
// Data: src/data/calendar.json, src/data/partners.json. Profile-level actions (paying, prizes) are in careerFlow.ts.

import calendarData from '../data/calendar.json';
import partnersData from '../data/partners.json';
import { gutsFor } from '../game/attributes';
import type { PlayerDef } from '../game/types';
import { divisionById } from './tournament';

export interface CalendarEvent {
  id: string;
  week: number;
  division: string;
  city: string;
}

export interface ActiveTournament {
  eventId: string;
  seed: number;
  /** The hero's results, round by round. */
  results: boolean[];
  /** XP and coins of the matches played in this tournament: paid out with the prize when it ends (nothing changes for the hero before). */
  pending?: { xp: number; coins: number };
}

export interface HistoryEntry {
  season: number;
  event: string;
  division: string;
  roundsWon: number;
  champion: boolean;
}

export interface Career {
  season: number;
  /** The current week of the season (1 .. weeks). */
  week: number;
  /** Ranking points of this season plus what is carried over from the last ones. */
  rankPoints: number;
  partnerId: string;
  partners: string[];
  active: ActiveTournament | null;
  titles: number;
  history: HistoryEntry[];
}

export const WEEKS: number = calendarData.weeks;
export const EVENTS = calendarData.events as CalendarEvent[];
export const HISTORY_LIMIT = 12;

export const eventById = (id: string): CalendarEvent | undefined => EVENTS.find((e) => e.id === id);
export const eventsOfWeek = (week: number): CalendarEvent[] => EVENTS.filter((e) => e.week === week);
export const eventName = (e: CalendarEvent): string => `${divisionById(e.division)?.name ?? e.division} ${e.city}`;

export const newCareer = (): Career => ({
  season: 1,
  week: 1,
  rankPoints: 0,
  partnerId: partnersData.default,
  partners: [partnersData.default],
  active: null,
  titles: 0,
  history: [],
});

/** Why the hero cannot enter this event now (text), or null when he can. */
export function entryProblem(career: Career, level: number, coins: number, event: CalendarEvent): string | null {
  const div = divisionById(event.division);
  if (!div) return 'unknown event';
  if (career.active) return 'finish your tournament first';
  if (event.week !== career.week) return event.week < career.week ? 'already played' : 'not this week';
  if (level < div.minLevel) return `needs level ${div.minLevel}`;
  if (career.rankPoints < div.minRank) return `needs ${div.minRank} ranking points`;
  if (coins < div.fee) return `entry fee ${div.fee} coins`;
  return null;
}

/** The next week; after the last one a new season starts and part of the ranking points carries over. */
export function advanceWeek(career: Career): Career {
  if (career.week < WEEKS) return { ...career, week: career.week + 1 };
  return { ...career, season: career.season + 1, week: 1, rankPoints: Math.floor(career.rankPoints * calendarData.rankCarry) };
}

// ---------- partners ----------

export interface PartnerDef extends PlayerDef {
  price: number;
  /** The hero's level from which this partner can be bought (the stronger partners come with the divisions they are made for). */
  minLevel: number;
}

export const PARTNERS: PartnerDef[] = partnersData.partners.map((p) => ({
  ...(p as unknown as PlayerDef),
  maxGuts: gutsFor(p.stats.stamina),
  price: p.price,
  minLevel: p.minLevel,
}));
export const partnerById = (id: string): PartnerDef | undefined => PARTNERS.find((p) => p.id === id);

/** Makes a stored career safe: whole numbers, known ids, a partner that the hero owns. */
export function sanitizeCareer(raw: unknown): Career {
  const base = newCareer();
  const o = (raw ?? null) as Partial<Record<string, unknown>> | null;
  if (!o) return base;
  const n = (v: unknown, min: number, max = 1e9): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : min);
  const owned = Array.isArray(o.partners) ? [...new Set(o.partners.filter((x): x is string => typeof x === 'string' && !!partnerById(x)))] : [];
  if (!owned.includes(partnersData.default)) owned.unshift(partnersData.default);
  const partnerId = typeof o.partnerId === 'string' && owned.includes(o.partnerId) ? o.partnerId : partnersData.default;
  let active: ActiveTournament | null = null;
  const a = o.active as Partial<ActiveTournament> | null | undefined;
  if (a && typeof a.eventId === 'string' && eventById(a.eventId) && typeof a.seed === 'number' && Number.isFinite(a.seed) && Array.isArray(a.results)) {
    const pend = a.pending && typeof a.pending === 'object' ? (a.pending as Partial<Record<string, unknown>>) : null;
    active = {
      eventId: a.eventId,
      seed: Math.floor(a.seed),
      results: a.results.filter((r): r is boolean => typeof r === 'boolean').slice(0, 4),
      ...(pend ? { pending: { xp: n(pend.xp, 0), coins: n(pend.coins, 0) } } : {}),
    };
  }
  const history = (Array.isArray(o.history) ? o.history : [])
    .filter((h): h is HistoryEntry => !!h && typeof h.event === 'string' && typeof h.division === 'string' && !!divisionById(h.division))
    .slice(-HISTORY_LIMIT)
    .map((h) => ({ season: n(h.season, 1), event: h.event, division: h.division, roundsWon: n(h.roundsWon, 0, 4), champion: h.champion === true }));
  return {
    season: n(o.season, 1),
    week: n(o.week, 1, WEEKS),
    rankPoints: n(o.rankPoints, 0),
    partnerId,
    partners: owned,
    active,
    titles: n(o.titles, 0),
    history,
  };
}
