// The training camp: minigames for the weeks without a tournament (plan 4b). Pure (no Phaser), tested; the scenes come later.
// Rules: a few tries per career week (plus one extra for a rewarded ad), rewards only from the free pool (coins, a basic boost,
// fragments of a Gear Pack), never premium packs or epic / legendary items. Every random roll goes through an injected `rng`.

import campData from '../data/camp.json';
import { buildFlight } from '../art/ballPath';
import { NET_Z, targetLanding, targetSpread } from '../game/court';
import type { PlayerDef, Rng, ShotDef } from '../game/types';
import { MAX_BOOSTS } from './gear';
import type { Profile } from './profile';

export type CampGameId = 'targets' | 'glass' | 'serve' | 'timing';

export interface CampGameDef {
  id: CampGameId;
  name: string;
  desc: string;
  rounds: number;
  /** Total score needed for 1, 2 and 3 stars. */
  stars: [number, number, number];
}

export interface CampState {
  /** The career week the tries belong to ("season:week"); a new week refills them. */
  week: string;
  triesLeft: number;
  /** Extra tries already given this week (rewarded ad). */
  extraUsed: number;
  /** Best stars per minigame. */
  best: Partial<Record<CampGameId, number>>;
  /** Stars earned over all tries (the milestones count them). */
  totalStars: number;
  /** Gear Pack fragments not yet turned into a pack. */
  fragments: number;
  /** Milestones already paid: indexes into `milestones`, then repeats as "r<n>". */
  claimed: string[];
}

export const CAMP = campData as unknown as {
  triesPerWeek: number;
  extraTriesPerWeek: number;
  baseCoins: number;
  coinShare: number[];
  boostOnThreeStars: number;
  boostPool: string[];
  fragmentsPerPack: number;
  fragmentPack: string;
  milestones: Array<{ stars: number; fragments: number }>;
  repeatEvery: number;
  repeatFragments: number;
  games: CampGameDef[];
};

export const CAMP_GAMES = CAMP.games;
export const campGame = (id: CampGameId): CampGameDef => CAMP_GAMES.find((g) => g.id === id)!;

const weekKey = (p: Profile): string => `${p.career.season}:${p.career.week}`;

export const newCamp = (): CampState => ({ week: '', triesLeft: CAMP.triesPerWeek, extraUsed: 0, best: {}, totalStars: 0, fragments: 0, claimed: [] });

/** The camp as it is this week: a new week refills the tries. */
export function campNow(p: Profile): CampState {
  const c = p.camp;
  return c.week === weekKey(p) ? c : { ...c, week: weekKey(p), triesLeft: CAMP.triesPerWeek, extraUsed: 0 };
}

/** The camp is open in a week without a tournament in progress. */
export const campOpen = (p: Profile): boolean => p.career.active === null;

/** Whether a try can be started now (open, tries left). */
export const canTry = (p: Profile): boolean => campOpen(p) && campNow(p).triesLeft > 0;

/** Starts a try: one of the week's tries is used (also when the player leaves the minigame early). Null when there is none. */
export function startTry(p: Profile): Profile | null {
  if (!canTry(p)) return null;
  const c = campNow(p);
  return { ...p, camp: { ...c, triesLeft: c.triesLeft - 1 } };
}

/** A rewarded ad gives one more try this week (at most `extraTriesPerWeek`). */
export function grantExtraTry(p: Profile): Profile | null {
  const c = campNow(p);
  if (!campOpen(p) || c.extraUsed >= CAMP.extraTriesPerWeek) return null;
  return { ...p, camp: { ...c, triesLeft: c.triesLeft + 1, extraUsed: c.extraUsed + 1 } };
}

export function starsFor(game: CampGameId, score: number): number {
  const t = campGame(game).stars;
  return score >= t[2] ? 3 : score >= t[1] ? 2 : score >= t[0] ? 1 : 0;
}

export interface CampReward {
  stars: number;
  newBest: boolean;
  coins: number;
  boost?: string;
  fragments: number;
  /** Gear Packs made from fragments by this try. */
  packs: number;
}

/** Fragments paid by the milestones crossed when the total stars go from `before` to `after` (keys of the milestones paid). */
export function milestonesCrossed(before: number, after: number, claimed: string[]): Array<{ key: string; fragments: number }> {
  const out: Array<{ key: string; fragments: number }> = [];
  CAMP.milestones.forEach((m, i) => {
    if (after >= m.stars && !claimed.includes(String(i))) out.push({ key: String(i), fragments: m.fragments });
  });
  const last = CAMP.milestones[CAMP.milestones.length - 1]?.stars ?? 0;
  // after the last milestone, one more every `repeatEvery` stars
  for (let n = 1; last + n * CAMP.repeatEvery <= after; n++) {
    const key = `r${n}`;
    if (!claimed.includes(key)) out.push({ key, fragments: CAMP.repeatFragments });
  }
  void before;
  return out;
}

/**
 * Finishes a try with its score: stars, coins (a share of a match's pay by stars), on three stars maybe a basic boost (if the bag has
 * room), milestone fragments (enough of them make a Gear Pack). `double`: a rewarded ad doubles the coins.
 */
export function finishTry(p: Profile, game: CampGameId, score: number, rng: Rng, double = false): { profile: Profile; reward: CampReward } {
  const c = campNow(p);
  const stars = starsFor(game, score);
  const newBest = stars > (c.best[game] ?? 0);
  const coins = Math.round(CAMP.baseCoins * (CAMP.coinShare[stars] ?? 0) * (double ? 2 : 1));
  let boosts = p.inventory.boosts;
  let boost: string | undefined;
  if (stars === 3 && boosts.length < MAX_BOOSTS && rng() < CAMP.boostOnThreeStars) {
    boost = CAMP.boostPool[Math.min(CAMP.boostPool.length - 1, Math.floor(rng() * CAMP.boostPool.length))];
    boosts = [...boosts, boost];
  }
  const totalStars = c.totalStars + stars;
  const crossed = milestonesCrossed(c.totalStars, totalStars, c.claimed);
  const fragments = crossed.reduce((a, m) => a + m.fragments, 0);
  let pool = c.fragments + fragments;
  const packs = Math.floor(pool / CAMP.fragmentsPerPack);
  pool -= packs * CAMP.fragmentsPerPack;
  const invPacks = packs > 0 ? { ...p.inventory.packs, [CAMP.fragmentPack]: (p.inventory.packs[CAMP.fragmentPack] ?? 0) + packs } : p.inventory.packs;
  const camp: CampState = { ...c, best: newBest ? { ...c.best, [game]: stars } : c.best, totalStars, fragments: pool, claimed: [...c.claimed, ...crossed.map((m) => m.key)] };
  return {
    profile: { ...p, coins: p.coins + coins, camp, inventory: { ...p.inventory, boosts, packs: invPacks } },
    reward: { stars, newBest, coins, boost, fragments, packs },
  };
}

export function sanitizeCamp(raw: unknown): CampState {
  const base = newCamp();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Partial<Record<keyof CampState, unknown>>;
  const n = (v: unknown, min: number, max = Infinity): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : min);
  const best: Partial<Record<CampGameId, number>> = {};
  if (o.best && typeof o.best === 'object') for (const g of CAMP_GAMES) { const v = (o.best as Record<string, unknown>)[g.id]; if (typeof v === 'number') best[g.id] = n(v, 0, 3); }
  return {
    week: typeof o.week === 'string' ? o.week : '',
    triesLeft: n(o.triesLeft ?? CAMP.triesPerWeek, 0, CAMP.triesPerWeek + CAMP.extraTriesPerWeek),
    extraUsed: n(o.extraUsed, 0, CAMP.extraTriesPerWeek),
    best,
    totalStars: n(o.totalStars, 0),
    fragments: n(o.fragments, 0, CAMP.fragmentsPerPack - 1),
    claimed: Array.isArray(o.claimed) ? o.claimed.filter((k): k is string => typeof k === 'string') : [],
  };
}

// ---------- the minigames' rounds and scoring ----------

/** A round of target practice or serve zones: a zone on the opponents' half (x across, depth past the net, radius, all metres). */
export interface Zone {
  x: number;
  depth: number;
  r: number;
}

/** Points of one ball for a zone: 100 in the middle down to 50 at the edge, 20 near it (within two radii), 0 out or a miss. */
export function zonePoints(zone: Zone, landing: { x: number; depth: number; miss?: string } | null): number {
  if (!landing || landing.miss) return 0;
  const d = Math.hypot(landing.x - zone.x, landing.depth - zone.depth);
  if (d <= zone.r) return Math.round(100 - 50 * (d / zone.r));
  return d <= 2 * zone.r ? 20 : 0;
}

/** Target practice: zones get smaller and nearer the lines round by round. */
export function targetZone(rng: Rng, round: number): Zone {
  const k = round / Math.max(1, campGame('targets').rounds - 1);
  const side = rng() < 0.5 ? -1 : 1;
  return {
    x: side * (0.6 + rng() * (2.2 + 1.4 * k)),
    depth: 3 + rng() * (3.5 + 2.4 * k),
    r: 1.4 - 0.5 * k,
  };
}

/** Where the hero's ball lands when aimed at `aim` with `shot` (the same spread as the spot aim in a match, fresh, no pressure). */
export function landShot(hero: PlayerDef, shot: ShotDef, aim: { x: number; depth: number }, rng: Rng): { x: number; depth: number; miss?: string } {
  const spread = targetSpread({ accuracy: hero.stats.accuracy, gutsShare: 1, pressure: 0, speed: shot.flight.speed, lob: shot.flight.apex >= 3, touch: shot.id === 'dejada' });
  return targetLanding(aim, rng, spread);
}

/** Serve zones: the service box is 6.95 m deep from the net and half the court wide (cross from the server's lane `lane`). */
export const SERVICE_DEPTH = 6.95;
export function serveZone(rng: Rng, round: number, lane: -1 | 1): Zone {
  const k = round / Math.max(1, campGame('serve').rounds - 1);
  // the box is on the other side of the centre line from the server: x between 0 and -lane * 5
  const kind = Math.floor(rng() * 3); // 0 = T (centre), 1 = body, 2 = wide (to the glass)
  const xs = [0.5, 2.3, 4.2];
  return { x: -lane * xs[kind], depth: 4.2 + rng() * 2.2, r: 1.2 - 0.45 * k };
}
/** A serve that lands outside the service box is a fault: no points. */
export function serveLanding(lane: -1 | 1, landing: { x: number; depth: number; miss?: string }): { x: number; depth: number; miss?: string } | null {
  const inBox = !landing.miss && landing.depth <= SERVICE_DEPTH && landing.x * -lane >= 0 && Math.abs(landing.x) <= 5;
  return inBox ? landing : null;
}

/** Read the glass: a ball hit into the near back glass; the player taps where it will be played after the glass. */
export interface GlassRound {
  shot: ShotDef;
  from: { x: number; z: number };
  landX: number;
  arrival: 'low' | 'mid' | 'high';
}
export function glassRound(rng: Rng, shots: ShotDef[]): GlassRound {
  const shot = shots[Math.floor(rng() * shots.length)];
  const arrival = (['low', 'mid', 'high'] as const)[Math.floor(rng() * 3)];
  return { shot, from: { x: -3 + rng() * 6, z: NET_Z - 3 - rng() * 5 }, landX: -3.8 + rng() * 7.6, arrival };
}
/** Where a glass round's ball is really played (after the glass), on the hero's (near) half. */
export function glassAnswer(r: GlassRound): { x: number; z: number } {
  const f = buildFlight({ from: r.from, hitterSide: 1, shot: r.shot, landX: r.landX, outcome: 'continue', glass: true, arrival: r.arrival, startH: 1 });
  return f.hit;
}
/** Points for a guess: 100 on the spot, nothing from 2.5 m away. */
export const glassPoints = (guess: { x: number; z: number }, answer: { x: number; z: number }): number =>
  Math.max(0, Math.round(100 * (1 - Math.hypot(guess.x - answer.x, guess.z - answer.z) / 2.5)));

/** Timing: the ring closes on the ball in `closeMs`; a tap within `window` ms of the moment counts (perfect within a third of it). */
export interface TimingRound {
  closeMs: number;
  window: number;
}
export function timingRound(hero: PlayerDef, round: number): TimingRound {
  const k = round / Math.max(1, campGame('timing').rounds - 1);
  return { closeMs: Math.round(1300 - 550 * k), window: Math.round((70 + 8 * hero.stats.technique + 4 * hero.stats.accuracy) * (1 - 0.35 * k)) };
}
export function timingPoints(r: TimingRound, tapMs: number | null): { points: number; grade: 'perfect' | 'good' | 'miss' } {
  if (tapMs === null) return { points: 0, grade: 'miss' };
  const off = Math.abs(tapMs - r.closeMs);
  if (off <= r.window / 3) return { points: 100, grade: 'perfect' };
  if (off <= r.window) return { points: 60, grade: 'good' };
  return { points: 0, grade: 'miss' };
}
