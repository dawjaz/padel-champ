// Profile-level career actions: entering an event, reporting a match, finishing a tournament, the partner. Pure, tested.

import { award, levelOf, type Profile, type Reward } from './profile';
import { advanceWeek, entryProblem, eventById, eventName, HISTORY_LIMIT, partnerById, type CalendarEvent } from './season';
import { buildBracket, divisionById, prizeFor, type Bracket, type Prize } from './tournament';

/** The bracket of the tournament in progress, or null. */
export function activeBracket(p: Profile): Bracket | null {
  const a = p.career.active;
  const event = a ? eventById(a.eventId) : undefined;
  return a && event ? buildBracket(event.division, a.seed, a.results) : null;
}

/** True while a tournament is in progress: the hero, gear, shop and partner are locked until it ends. */
export const tournamentActive = (p: Profile): boolean => p.career.active !== null;

export const entryCheck = (p: Profile, event: CalendarEvent): string | null => entryProblem(p.career, levelOf(p.xp), p.coins, event);

/** Pays the fee and starts the tournament (`seed` makes the draw), or returns null when the hero cannot enter. */
export function enterEvent(p: Profile, eventId: string, seed: number): Profile | null {
  const event = eventById(eventId);
  if (!event || entryCheck(p, event) !== null) return null;
  const div = divisionById(event.division)!;
  return { ...p, coins: p.coins - div.fee, career: { ...p.career, active: { eventId, seed: Math.floor(seed), results: [] } } };
}

export interface Finished {
  profile: Profile;
  event: string;
  roundsWon: number;
  champion: boolean;
  prize: Prize;
  /** XP and coins of the matches of this tournament, paid out now together with the prize. */
  matches: Reward;
}

/** Ends the tournament: prizes, ranking points, history, and the week moves on. */
function finish(p: Profile, bracket: Bracket): Finished {
  const a = p.career.active!;
  const event = eventById(a.eventId)!;
  const prize = prizeFor(bracket.division, bracket.roundsWon);
  const champion = bracket.status === 'won';
  // The matches of the tournament paid nothing until now: they are paid out here, so level ups and free packs come after it.
  const matches: Reward = { xp: a.pending?.xp ?? 0, coins: a.pending?.coins ?? 0 };
  let next = award(p, { xp: prize.xp + matches.xp, coins: prize.coins + matches.coins });
  if (prize.pack) {
    next = { ...next, inventory: { ...next.inventory, packs: { ...next.inventory.packs, [prize.pack]: (next.inventory.packs[prize.pack] ?? 0) + 1 } } };
  }
  next = { ...next, inventory: { ...next.inventory, queued: [] } }; // a boost picked for a match that was never played stays in the bag
  const history = [...next.career.history, { season: next.career.season, event: eventName(event), division: event.division, roundsWon: bracket.roundsWon, champion }].slice(-HISTORY_LIMIT);
  const career = advanceWeek({ ...next.career, active: null, rankPoints: next.career.rankPoints + prize.rank, titles: next.career.titles + (champion ? 1 : 0), history });
  return { profile: { ...next, career }, event: eventName(event), roundsWon: bracket.roundsWon, champion, prize, matches };
}

export interface Reported {
  profile: Profile;
  /** Set when the tournament is over (the hero lost or won the final). */
  finished?: Finished;
}

/** The hero's match of the current round is over; its reward is kept until the tournament ends. */
export function reportMatch(p: Profile, won: boolean, reward: Reward = { xp: 0, coins: 0 }): Reported {
  const a = p.career.active;
  if (!a) return { profile: p };
  const pending = { xp: (a.pending?.xp ?? 0) + reward.xp, coins: (a.pending?.coins ?? 0) + reward.coins };
  const next: Profile = { ...p, career: { ...p.career, active: { ...a, results: [...a.results, won], pending } } };
  const bracket = activeBracket(next)!;
  if (bracket.status === 'active') return { profile: next };
  const finished = finish(next, bracket);
  return { profile: finished.profile, finished };
}

/** Leaves the tournament: the prize for the rounds won so far, then the week moves on. */
export function withdraw(p: Profile): Finished | null {
  const bracket = activeBracket(p);
  if (!bracket) return null;
  return finish(p, { ...bracket, status: 'lost' });
}

/** Skips a week without playing (only with no tournament in progress). */
export function skipWeek(p: Profile): Profile {
  return p.career.active ? p : { ...p, career: advanceWeek(p.career) };
}

export function buyPartner(p: Profile, id: string): Profile | null {
  const def = partnerById(id);
  if (!def || p.career.partners.includes(id) || p.coins < def.price) return null;
  return { ...p, coins: p.coins - def.price, career: { ...p.career, partners: [...p.career.partners, id], partnerId: id } };
}

export function choosePartner(p: Profile, id: string): Profile {
  return p.career.partners.includes(id) ? { ...p, career: { ...p.career, partnerId: id } } : p;
}
