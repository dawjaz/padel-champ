// The training camp: minigames for the weeks without a tournament (plan 4b). Pure (no Phaser), tested; the scenes come later.
// Rules: a few tries per career week (plus one extra for a rewarded ad), rewards only from the free pool (coins, a basic boost,
// fragments of a Gear Pack), never premium packs or epic / legendary items. Every random roll goes through an injected `rng`.

import campData from '../data/camp.json';
import { targetLanding, targetSpread } from '../game/court';
import type { PlayerDef, Rng, ShotDef } from '../game/types';
import { MAX_BOOSTS } from './gear';
import type { Profile } from './profile';

export type CampGameId = 'targets' | 'serve' | 'timing' | 'smash';

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
  /**
   * A moving zone: it goes to and fro along `dir` (a unit vector: x across, depth) up to `amp` metres either side of its centre, at a
   * steady `speed` (m/s); `phase` (0..1) is where in the cycle it starts.
   */
  move?: { dir: [number, number]; amp: number; speed: number; phase: number };
}

/** Where a moving zone is `t` seconds after the round starts (steady speed, turning at the ends; a still zone stays put). */
export function zoneAt(z: Zone, t: number): Zone {
  if (!z.move) return z;
  const { dir, amp, speed, phase } = z.move;
  if (amp <= 0) return z;
  const s = (((phase + (speed * t) / (4 * amp)) % 1) + 1) % 1;
  const d = amp * (s < 0.5 ? -1 + 4 * s : 3 - 4 * s);
  return { ...z, x: z.x + dir[0] * d, depth: z.depth + dir[1] * d };
}

/** Points of one ball for a zone: 100 in the middle down to 50 at the edge, 20 near it (within two radii), 0 out or a miss. */
export function zonePoints(zone: Zone, landing: { x: number; depth: number; miss?: string } | null): number {
  if (!landing || landing.miss) return 0;
  const d = Math.hypot(landing.x - zone.x, landing.depth - zone.depth);
  if (d <= zone.r) return Math.round(100 - 50 * (d / zone.r));
  return d <= 2 * zone.r ? 20 : 0;
}

const D = Math.SQRT1_2;
/**
 * Target practice: the zone moves across, in depth or on a slant at a steady speed of its own each round (faster and smaller as the
 * rounds go on); it stays inside the opponents' half all the way.
 */
export function targetZone(rng: Rng, round: number): Zone {
  const k = round / Math.max(1, campGame('targets').rounds - 1);
  const r = 1.3 - 0.4 * k;
  const pick = Math.floor(rng() * 4);
  const dir: [number, number] = pick === 0 ? [1, 0] : pick === 1 ? [0, 1] : pick === 2 ? [D, D] : [-D, D];
  const amp = dir[1] === 0 ? 1.6 + rng() * 1.2 : dir[0] === 0 ? 1.2 + rng() * 0.8 : 1.4 + rng() * 0.8;
  const xr = Math.max(0, 4.6 - r - amp * Math.abs(dir[0]));
  const dLo = 1 + r + amp * dir[1];
  const dHi = Math.max(dLo, 9.3 - r - amp * dir[1]);
  return {
    x: (rng() * 2 - 1) * xr,
    depth: dLo + rng() * (dHi - dLo),
    r,
    move: { dir, amp, speed: 0.9 + 2.2 * k + rng() * 0.9, phase: rng() },
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
  // the zone glides across the box (or in depth) at a steady speed, a little faster round by round
  const r = 1.25 - 0.25 * k;
  const across = rng() < 0.65;
  const centre = across ? { x: -lane * 2.5, depth: 3.8 + rng() * 2 } : { x: -lane * (1.4 + rng() * 2.2), depth: 4.2 };
  const amp = across ? 2.4 - r : 2.6 - r;
  return { ...centre, r, move: { dir: across ? [1, 0] : [0, 1], amp: Math.max(0.4, amp), speed: 0.7 + 1.3 * k + rng() * 0.4, phase: rng() } };
}
/** A serve that lands outside the service box is a fault: no points. */
export function serveLanding(lane: -1 | 1, landing: { x: number; depth: number; miss?: string }): { x: number; depth: number; miss?: string } | null {
  const inBox = !landing.miss && landing.depth <= SERVICE_DEPTH && landing.x * -lane >= 0 && Math.abs(landing.x) <= 5;
  return inBox ? landing : null;
}

/**
 * Timing: the ring closes on the ball in `closeMs`; the tap is scored by how far off it is. Each round is a different ball: from another
 * place, faster or slower, flat, lobbed or curling with spin, and the hero stands somewhere else.
 */
export interface TimingRound {
  closeMs: number;
  /** Taps within this many ms of the moment score; within a fifth of it, perfect. */
  window: number;
  from: { x: number; z: number; h: number };
  hero: { x: number; z: number };
  /** Height of the arc (m) and the sideways curl of spin (m, + to the right). */
  apex: number;
  curve: number;
  kind: 'flat' | 'lob' | 'spin';
}
export function timingRound(hero: PlayerDef, round: number, rng: Rng): TimingRound {
  const k = round / Math.max(1, campGame('timing').rounds - 1);
  const kind = (['flat', 'lob', 'spin'] as const)[Math.floor(rng() * 3)];
  const closeMs = Math.round((kind === 'lob' ? 1500 : kind === 'flat' ? 950 : 1200) * (1 - 0.35 * k) * (0.85 + rng() * 0.3));
  const base = (60 + 7 * hero.stats.technique + 4 * hero.stats.accuracy) * (closeMs / 1200);
  return {
    closeMs,
    window: Math.round(base * (1 - 0.3 * k)),
    from: { x: -3.5 + rng() * 7, z: 1 + rng() * 4, h: 1 },
    hero: { x: -3 + rng() * 6, z: 14.5 + rng() * 4 },
    apex: kind === 'lob' ? 4 + rng() * 1.5 : kind === 'flat' ? 0.6 + rng() * 0.5 : 1.6 + rng() * 0.8,
    curve: kind === 'spin' ? (rng() < 0.5 ? -1 : 1) * (1 + rng() * 1.5) : 0,
    kind,
  };
}
export type TimingGrade = 'perfect' | 'great' | 'good' | 'ok' | 'miss';
/** 100 within a fifth of the window, then down from 90 to 10 at its edge, 0 beyond. */
export function timingPoints(r: TimingRound, tapMs: number | null): { points: number; grade: TimingGrade } {
  if (tapMs === null) return { points: 0, grade: 'miss' };
  const off = Math.abs(tapMs - r.closeMs);
  const core = r.window / 5;
  if (off <= core) return { points: 100, grade: 'perfect' };
  if (off > r.window) return { points: 0, grade: 'miss' };
  const points = Math.round(90 - (80 * (off - core)) / (r.window - core));
  return { points, grade: points >= 70 ? 'great' : points >= 40 ? 'good' : 'ok' };
}

/**
 * Smash: the opponent lobs, the hero picks the smash and hits it as the ring closes on the ball over his head. A Por Tres or a Por
 * Cuatro hit right flies out of the court (a Por Cuatro is the harder one and pays more), a Vibora hit right dies off the side glass;
 * hit a little off, the ball comes back off the glass into play; off by more, into the net. Which smash fits depends on the lob: a
 * short lob near the net is the one to put away, a deep one is safer with a Vibora.
 */
export type SmashKind = 'x3' | 'x4' | 'vibora';
export type LobDepth = 'short' | 'mid' | 'deep';
export interface SmashRound {
  lob: LobDepth;
  /** Where the hero meets the ball (court metres, near half; height in metres). */
  contact: { x: number; z: number; h: number };
  /** Where the lob is hit from (far half). */
  from: { x: number; z: number };
  /** The lob's flight time to the contact (ms). */
  closeMs: number;
}
export const SMASH_SHOT: Record<SmashKind, string> = { x3: 'smash_x3', x4: 'smash_x4', vibora: 'vibora' };
/** How much of the timing window each smash keeps against each lob (a Por Cuatro off a deep lob is nearly hopeless). */
const SMASH_FIT: Record<SmashKind, Record<LobDepth, number>> = {
  x3: { short: 1, mid: 0.75, deep: 0.45 },
  x4: { short: 0.8, mid: 0.5, deep: 0.25 },
  vibora: { short: 0.7, mid: 1, deep: 1.1 },
};
const SMASH_TOP: Record<SmashKind, number> = { x3: 140, x4: 165, vibora: 110 };
export function smashRound(round: number, rng: Rng): SmashRound {
  const k = round / Math.max(1, campGame('smash').rounds - 1);
  const z = 11.6 + rng() * 4;
  const lob: LobDepth = z < 13 ? 'short' : z < 14.6 ? 'mid' : 'deep';
  return {
    lob,
    contact: { x: -3 + rng() * 6, z, h: 2.7 },
    from: { x: -3 + rng() * 6, z: 2 + rng() * 4 },
    closeMs: Math.round((1900 - 500 * k) * (0.9 + rng() * 0.2)),
  };
}
/** The timing window (ms either side) for this smash against this lob; power and technique widen it. */
export function smashWindow(hero: PlayerDef, r: SmashRound, kind: SmashKind): number {
  return Math.round((110 + 8 * hero.stats.power + 6 * hero.stats.technique) * SMASH_FIT[kind][r.lob]);
}
export type SmashOutcome = 'out' | 'winner' | 'glass' | 'net';
/** `tapMs`: when the player touched, from the start of the lob (null: never). The core of the window is its inner 40%. */
export function smashResult(hero: PlayerDef, r: SmashRound, kind: SmashKind, tapMs: number | null): { outcome: SmashOutcome; points: number } {
  if (tapMs === null) return { outcome: 'net', points: 0 };
  const w = smashWindow(hero, r, kind);
  const q = Math.abs(tapMs - r.closeMs) / Math.max(1, w);
  if (q <= 0.4) return { outcome: kind === 'vibora' ? 'winner' : 'out', points: SMASH_TOP[kind] };
  if (q <= 1) return { outcome: 'glass', points: Math.round(60 - (30 * (q - 0.4)) / 0.6) };
  return { outcome: 'net', points: 0 };
}
