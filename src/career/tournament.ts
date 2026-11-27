// Knockout tournaments: opponents of a division, the draw, the bracket and the prizes. Pure, tested, deterministic from a seed:
// the save keeps only {event, seed, the hero's results}, and the whole bracket is rebuilt from it. Data: src/data/divisions.json.

import divisionsData from '../data/divisions.json';
import oppData from '../data/opponents.json';
import { gutsFor, STAT_KEYS } from '../game/attributes';
import { seededRng } from '../game/rng';
import type { Appearance, HairStyle, PlayerDef, Rng, StatKey } from '../game/types';

export interface Division {
  id: string;
  name: string;
  /** Pairs in the draw: 8 or 16. */
  draw: number;
  minLevel: number;
  /** Ranking points needed to enter. */
  minRank: number;
  /** Entry fee in coins. */
  fee: number;
  /** Average attribute level (1-10) of the opponents. */
  rating: number;
  /** What the champion gets; smaller shares go to those who lose later. */
  title: { coins: number; xp: number; rank: number };
  titlePack: string;
}

export const DIVISIONS = divisionsData.divisions as Division[];
export const divisionById = (id: string): Division | undefined => DIVISIONS.find((d) => d.id === id);

export interface Entry {
  id: string;
  name: string;
  /** Average attribute level of the pair. */
  rating: number;
  /** The two players (empty for the hero: the match uses the hero and the chosen partner). */
  players: PlayerDef[];
}

export interface BracketMatch {
  a: string;
  b: string;
  winner?: string;
}

export interface Bracket {
  division: Division;
  entries: Entry[];
  rounds: BracketMatch[][];
  roundNames: string[];
  /** 'active': the hero has a match to play (see `opponent`); 'won': champion; 'lost': knocked out. */
  status: 'active' | 'won' | 'lost';
  /** Rounds the hero has won. */
  roundsWon: number;
  /** The hero's next opponent while active. */
  opponent?: Entry;
}

export const HERO_ID = 'hero';

const pick = <T>(list: T[], rng: Rng): T => list[Math.floor(rng() * list.length)];
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function makeAppearance(rng: Rng, female: boolean): Appearance {
  const hairStyle: HairStyle = female ? pick(['long', 'ponytail', 'bun'] as HairStyle[], rng) : pick(['short', 'short', 'afro', 'bald'] as HairStyle[], rng);
  return {
    gender: female ? 'female' : 'male',
    skin: pick(oppData.skin, rng),
    hairStyle,
    hairColor: pick(oppData.hair, rng),
    shirt: pick(oppData.shirt, rng),
    bottom: pick(oppData.bottom, rng),
    bottomStyle: female && rng() < 0.7 ? 'skirt' : 'shorts',
    shoes: pick(oppData.shoes, rng),
    racket: pick(oppData.racket, rng),
  };
}

/** One opponent: attributes scatter around the division rating. */
export function makePlayer(rng: Rng, rating: number, id: string, name: string): PlayerDef {
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, clamp(Math.round(rating + (rng() - 0.5) * 3), 1, 10)])) as Record<StatKey, number>;
  return { id, name, nick: (oppData.nicks as Record<string, string>)[name], stats, maxGuts: gutsFor(stats.stamina), appearance: makeAppearance(rng, rng() < 0.5) };
}

const averageStat = (p: PlayerDef): number => STAT_KEYS.reduce((a, k) => a + p.stats[k], 0) / STAT_KEYS.length;

export function makePair(rng: Rng, rating: number, id: string): Entry {
  const first = pick(oppData.first, rng);
  let second = pick(oppData.first, rng);
  while (second === first) second = pick(oppData.first, rng);
  const last1 = pick(oppData.last, rng);
  const last2 = pick(oppData.last, rng);
  const players = [makePlayer(rng, rating, `${id}a`, first), makePlayer(rng, rating, `${id}b`, second)];
  return { id, name: `${last1} / ${last2}`, rating: (averageStat(players[0]) + averageStat(players[1])) / 2, players };
}

/**
 * The opponent in round `round` (0 = first) is stronger the further the tournament goes: `roundBonus` attribute levels per round.
 * The whole part goes to every attribute, the rest to a share of them (a fixed pattern, so the draw stays deterministic).
 */
export function toughen(entry: Entry, round: number): Entry {
  const bonus = divisionsData.roundBonus * round;
  if (bonus <= 0 || entry.players.length === 0) return entry;
  const whole = Math.floor(bonus);
  const frac = bonus - whole;
  const players = entry.players.map((p, pi) => {
    const stats = { ...p.stats };
    STAT_KEYS.forEach((k, i) => {
      const extra = (i * 0.618 + pi * 0.37) % 1 < frac ? 1 : 0;
      stats[k] = clamp(stats[k] + whole + extra, 1, 10);
    });
    return { ...p, stats, maxGuts: gutsFor(stats.stamina) };
  });
  return { ...entry, players, rating: (averageStat(players[0]) + averageStat(players[1])) / 2 };
}

export const roundNamesFor = (draw: number): string[] => (draw === 8 ? ['Quarterfinal', 'Semifinal', 'Final'] : ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final']);

/** Builds the bracket from the seed and what the hero has done so far (`results[r]` = won round r). */
export function buildBracket(divisionId: string, seed: number, results: boolean[]): Bracket {
  const division = divisionById(divisionId);
  if (!division) throw new Error(`unknown division ${divisionId}`);
  const rng = seededRng(seed);
  const entries: Entry[] = [{ id: HERO_ID, name: 'You', rating: 0, players: [] }];
  for (let i = 1; i < division.draw; i++) entries.push(makePair(rng, clamp(division.rating + (rng() - 0.5) * 1.6, 1, 10), `p${i}`));
  const byId = new Map(entries.map((e) => [e.id, e]));
  // Shuffle the draw
  const order = entries.map((e) => e.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const roundNames = roundNamesFor(division.draw);
  const rounds: BracketMatch[][] = [];
  let current = order;
  let roundsWon = 0;
  for (let r = 0; r < roundNames.length; r++) {
    const matches: BracketMatch[] = [];
    for (let m = 0; m < current.length; m += 2) matches.push({ a: current[m], b: current[m + 1] });
    const simRng = seededRng(seed * 131 + r * 17 + 7);
    let heroMatch: BracketMatch | undefined;
    for (const match of matches) {
      if (match.a === HERO_ID || match.b === HERO_ID) {
        heroMatch = match;
        continue;
      }
      const ra = byId.get(match.a)!.rating;
      const rb = byId.get(match.b)!.rating;
      const pA = 1 / (1 + Math.exp(-(ra - rb) * divisionsData.upsetSlope));
      match.winner = simRng() < pA ? match.a : match.b;
    }
    rounds.push(matches);
    if (!heroMatch) throw new Error('the hero is missing from the draw');
    const other = heroMatch.a === HERO_ID ? heroMatch.b : heroMatch.a;
    const result = results[r];
    if (result === undefined) return { division, entries, rounds, roundNames, status: 'active', roundsWon, opponent: toughen(byId.get(other)!, r) };
    heroMatch.winner = result ? HERO_ID : other;
    if (!result) return { division, entries, rounds, roundNames, status: 'lost', roundsWon };
    roundsWon++;
    current = matches.map((m) => m.winner!);
  }
  return { division, entries, rounds, roundNames, status: 'won', roundsWon };
}

export interface Prize {
  coins: number;
  xp: number;
  rank: number;
  /** Pack id for the champion. */
  pack?: string;
}

/** What a hero who won `roundsWon` rounds takes home: a share of the title prize (nothing for an opening-round exit). */
export function prizeFor(division: Division, roundsWon: number): Prize {
  const shares = (divisionsData.roundShare as Record<string, number[]>)[String(division.draw)];
  const share = roundsWon <= 0 ? 0 : shares[Math.min(roundsWon, shares.length) - 1];
  const prize: Prize = {
    coins: Math.round(division.title.coins * share),
    xp: Math.round(division.title.xp * share),
    rank: Math.round(division.title.rank * share),
  };
  if (roundsWon >= shares.length) prize.pack = division.titlePack;
  return prize;
}

/** Event names saved before v0.166 used the old division names; this maps them to the current ones (a saved history keeps working). */
export const currentEventName = (event: string): string =>
  event
    .replace(/^FIP (Rise|Bronze|Silver|Gold|Platinum) /, 'PT $1 ')
    .replace(/^Premier P2 /, 'PT Premier II ')
    .replace(/^Premier P1 /, 'PT Premier I ')
    .replace(/^Major /, 'Grand Slam Cup ');
