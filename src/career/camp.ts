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

/**
 * Serve & Return: the rounds alternate. On a serve round the receiver stands off-centre and leaves a gap (the middle or out wide):
 * the player serves into one of three spots and hits the ball as it comes up off its bounce; the points come from the pressure.
 * On a return round the opponent serves: the player sees what kind of serve it is, picks the return and hits it on time.
 */
export type ServeKind = 'flat' | 'kick' | 'slice';
export type ServeSpot = 'T' | 'body' | 'wide';
export type ReturnShot = 'lob' | 'chiquita' | 'drive' | 'glass';
export const SERVE_KINDS: ServeKind[] = ['flat', 'kick', 'slice'];
export const SERVE_SPOTS: ServeSpot[] = ['T', 'body', 'wide'];
/** The returns on offer: off the glass only for a ball that is going into the glass, a drive otherwise. */
export const returnShotsFor = (toGlass: boolean): ReturnShot[] => ['lob', 'chiquita', toGlass ? 'glass' : 'drive'];

/** A point of the court floor (metres). */
export interface FloorPoint {
  x: number;
  z: number;
}
/**
 * Where a ball that came from `from` and bounced at `land` is when it reaches the depth `toZ`: it goes on in a straight line after the
 * bounce (it keeps its direction) and comes off a side glass (x = +-5) as off a mirror if it gets there first. `wall` is where it hit
 * that glass (null if it did not).
 */
export function rollOn(from: FloorPoint, land: FloorPoint, toZ: number): { x: number; z: number; wall: FloorPoint | null } {
  const dx = land.x - from.x;
  const dz = land.z - from.z;
  if (Math.abs(dz) < 1e-6) return { x: land.x, z: toZ, wall: null };
  const t = (toZ - land.z) / dz;
  let x = land.x + dx * t;
  let wall: FloorPoint | null = null;
  if (Math.abs(x) > 5) {
    const side = Math.sign(x) * 5;
    const tw = (side - land.x) / dx;
    wall = { x: side, z: land.z + dz * tw };
    x = 2 * side - x;
  }
  return { x: Math.max(-4.7, Math.min(4.7, x)), z: toZ, wall };
}
const pick = <T>(rng: Rng, list: T[]): T => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
export const isServeRound = (round: number): boolean => round % 2 === 0;
/** The gap the receiver leaves (he stands towards the other side). */
export const openSpotOf = (rng: Rng): ServeSpot => (rng() < 0.5 ? 'T' : 'wide');
/** Where the receiver stands for a gap (x across his box, from the server's lane). */
export const receiverX = (open: ServeSpot, lane: -1 | 1): number => -lane * (open === 'wide' ? 1.5 : 3.7);
/** Where each spot is in the service box across from the server's lane (x across, depth past the net). */
export function serveSpotAt(spot: ServeSpot, lane: -1 | 1): { x: number; depth: number } {
  const s = -lane;
  if (spot === 'T') return { x: s * 0.7, depth: 5.9 };
  if (spot === 'wide') return { x: s * 4.2, depth: 5.2 };
  return { x: s * 2.5, depth: 6.3 };
}
export type ServeTier = 'ace' | 'weak' | 'average' | 'strong' | 'fault';
export const SERVE_POINTS: Record<ServeTier, number> = { ace: 100, weak: 70, average: 30, strong: 0, fault: 0 };
/** The timing window (ms either side) of the serve: technique and accuracy widen it. */
export const tossWindow = (hero: PlayerDef): number => Math.round(170 + 6 * hero.stats.technique + 4 * hero.stats.accuracy);
/** Timing quality: 1 in the inner 40% of the window, down to 0.3 at its edge, 0 beyond. */
function quality(offMs: number | null, window: number): number {
  if (offMs === null) return 0;
  const q = Math.abs(offMs) / window;
  if (q <= 0.4) return 1;
  if (q <= 1) return 1 - (0.7 * (q - 0.4)) / 0.6;
  return 0;
}
export const tossQuality = (hero: PlayerDef, offMs: number | null): number => quality(offMs, tossWindow(hero));
/** How a serve goes: into the gap is pressure, at the body some, where he stands little; timing adds; a missed ball is a fault. */
export function serveOutcome(open: ServeSpot, spot: ServeSpot, q: number, rng: Rng): { tier: ServeTier; pressure: number; points: number } {
  if (q <= 0 || rng() < (0.04 + (spot === 'wide' ? 0.03 : 0)) * (1.6 - q)) return { tier: 'fault', pressure: 0, points: 0 };
  const pressure = 0.25 + (spot === open ? 0.4 : spot === 'body' ? 0.2 : 0) + 0.3 * q + (rng() - 0.5) * 0.16;
  const tier: ServeTier = pressure >= 0.86 ? 'ace' : pressure >= 0.62 ? 'weak' : pressure >= 0.42 ? 'average' : 'strong';
  return { tier, pressure, points: SERVE_POINTS[tier] };
}

export interface ReturnRound {
  kind: ServeKind;
  spot: ServeSpot;
}
/** How well each return answers each serve (0..1): a high kick sits up for a lob, a low slice is for the chiquita, a fast flat one is
 * best let onto the glass when it goes there, or driven back when it comes at you. */
export const RETURN_FIT: Record<ServeKind, Record<ReturnShot, number>> = {
  flat: { lob: 0.6, chiquita: 0.7, drive: 0.9, glass: 1 },
  kick: { lob: 1, chiquita: 0.4, drive: 0.6, glass: 0.6 },
  slice: { lob: 0.35, chiquita: 1, drive: 0.5, glass: 0.45 },
};
export const returnFit = (r: ReturnRound, shot: ReturnShot): number => RETURN_FIT[r.kind][shot];
export function returnRound(rng: Rng): ReturnRound {
  return { kind: pick(rng, SERVE_KINDS), spot: pick(rng, SERVE_SPOTS) };
}
export const returnWindow = (hero: PlayerDef): number => Math.round(160 + 6 * hero.stats.technique + 4 * hero.stats.speed);
export type ReturnTier = 'winner' | 'good' | 'weak' | 'error';
/** `offMs`: the tap against the ideal moment (null: no swing). Points = 100 x how well the return fits x how well it was hit. */
export function returnResult(hero: PlayerDef, r: ReturnRound, shot: ReturnShot, offMs: number | null): { tier: ReturnTier; points: number } {
  const qv = quality(offMs, returnWindow(hero));
  const points = Math.round(100 * returnFit(r, shot) * qv);
  const tier: ReturnTier = qv === 0 ? 'error' : points >= 80 ? 'winner' : points >= 50 ? 'good' : 'weak';
  return { tier, points };
}
