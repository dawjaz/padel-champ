// The end of a season: where the hero finished in the world ranking, what the season paid, and the recap shown once. Pure, tested.

import calendarData from '../data/calendar.json';
import { positionOf } from './ranking';
import { SEASONS_LIMIT, WEEKS, type Career, type SeasonRecap } from './season';
import type { Profile } from './profile';

interface Tier {
  place: number;
  label: string;
  coins: number;
  packs: Record<string, number>;
}
const R = calendarData.seasonRewards as unknown as { minEvents: number; perTitle: number; tiers: Tier[] };
export const SEASON_MIN_EVENTS = R.minEvents;

/** What a season paid for the final place (the best tier that fits) and the titles; nothing under `SEASON_MIN_EVENTS` tournaments. */
export function seasonPay(place: number, events: number, titles: number): { label: string; coins: number; packs: Record<string, number>; paid: boolean } {
  const tier = R.tiers.find((t) => place <= t.place) ?? R.tiers[R.tiers.length - 1];
  if (events < R.minEvents) return { label: `PLAY ${R.minEvents} TOURNAMENTS A SEASON TO EARN REWARDS`, coins: 0, packs: {}, paid: false };
  return { label: tier.label, coins: tier.coins + R.perTitle * titles, packs: { ...tier.packs }, paid: true };
}

/**
 * The season is over: `pre` is the career as it was in the last week, after the last tournament (before the new season started).
 * Pays the rewards into the profile, notes the season and leaves the recap for the calendar to show once.
 */
export function closeSeason(p: Profile, pre: Career): Profile {
  if (p.career.season === pre.season) return p;
  const place = positionOf({ season: pre.season, week: WEEKS + 1, rankPoints: pre.rankPoints });
  const pay = seasonPay(place, pre.log.events, pre.log.titles);
  const packs = { ...p.inventory.packs };
  for (const [id, n] of Object.entries(pay.packs)) packs[id] = (packs[id] ?? 0) + n;
  const recap: SeasonRecap = { season: pre.season, place, points: pre.rankPoints, carried: p.career.rankPoints, log: pre.log, ...pay };
  const seasons = [...p.career.seasons, { season: pre.season, place, points: pre.rankPoints, events: pre.log.events, titles: pre.log.titles }].slice(-SEASONS_LIMIT);
  return { ...p, coins: p.coins + pay.coins, inventory: { ...p.inventory, packs }, career: { ...p.career, recap, seasons } };
}

/** The recap has been shown. */
export const dismissRecap = (p: Profile): Profile => (p.career.recap ? { ...p, career: { ...p.career, recap: null } } : p);
