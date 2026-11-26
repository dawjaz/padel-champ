import { edgeRiskMul, fatigueStart } from './attributes';
import type { BallState, DirectionDef, Formation, PlayerDef, ReceiveMode, Rng, ShotDef } from './types';

/** Default score lead needed to win the point outright (a shot can override it). */
export const WINNER_MARGIN = 24;
/** A shot that flies this high is a lob (it never wins the point by itself). */
export const LOB_APEX = 3;
/** An ace needs this much more than the receiver's defence. */
export const ACE_MARGIN = 48;
/**
 * Scales defence up so that average shots get returned and rallies last. Tuned with a CPU-vs-CPU
 * simulation of 20,000 points: ~4 hits after the serve, server wins ~55%, aces < 1%.
 */
export const DEFENSE_SCALE = 1.3;
/** Defence multiplier of a player who takes the ball out of the air (volley) instead of running back for it. */
export const AIR_DEFENSE = { net: 1.2, mid: 1.12 } as const;
/** The second serve (after a fault) is slower and safer: less attack (fewer aces), less pressure on the return, fewer faults. */
export const SECOND_SERVE_POWER = 0.82;
export const SECOND_SERVE_PRESSURE = 0.5;
export const SECOND_SERVE_FAULT = 0.75;
/** Ball speed of the second serve. */
export const SECOND_SERVE_SPEED = 0.8;
/** The receiver returns a second serve with more power and accuracy (x1.2). */
export const SECOND_SERVE_RETURN = 1.2;
/** Extra error (fault) chance for every guts point the hitter is short of when he plays a shot he cannot pay for ("RISKY"). */
export const RISKY_PER_G = 0.15;
/** Random spread added to each side's score. */
export const RANDOM_SPREAD = 20;
/** Rally length after which every extra hit adds a little error chance. */
export const FATIGUE_START = 6;
export const FATIGUE_STEP = 0.02;
/** Each technique point lowers the error chance by this much. */
export const TECHNIQUE_SAFETY = 0.008;
export const MIN_ERROR = 0.01;
export const MAX_ERROR = 0.6;
export const MAX_PRESSURE = 0.25;
export const MAX_SERVE_PRESSURE = 0.4;
/**
 * Receiving a glass serve. Straight off the bounce the ball is fast (defence x0.9) but the contact is clean,
 * so the serve's pressure on the return is halved. Waiting for the glass gives more time (defence x1.1) but
 * leaves the full pressure. Serves that do not touch a wall ignore this.
 */
export const BOUNCE_DEFENSE = 0.9;
export const WALL_DEFENSE = 1.1;
export const BOUNCE_PRESSURE_RELIEF = 0.5;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** How well a player defends a ball. Middle balls confuse the receiver (direction.hesitation < 1). */
/** How well placed a defender is to run down a ball that comes off the back glass. */
export const REBOUND_POSITION: Record<Formation, number> = { back: 1.25, mid: 1.0, net: 0.75 };

/**
 * A drop shot lands just behind the net: whoever stands at the back has a long run (x0.75), one in mid-court a shorter one, one at the
 * net hardly any. Speed counts for most.
 */
export const DROP_POSITION: Record<Formation, number> = { back: 0.75, mid: 0.95, net: 1.2 };

export function defenseRating(defender: PlayerDef, direction: DirectionDef, chase?: Formation, drop?: Formation): number {
  // After a bajada the ball rebounds off the back glass: a fast player who stands well can still get to it.
  const weights = drop ? { defense: 3, speed: 7 } : chase ? { defense: 4, speed: 8 } : { defense: 7, speed: 3 };
  const place = drop ? DROP_POSITION[drop] : chase ? REBOUND_POSITION[chase] : 1;
  const base = (defender.stats.defense * weights.defense + defender.stats.speed * weights.speed) * DEFENSE_SCALE * place;
  return direction.id === 'middle' ? base * direction.hesitation : base;
}

/** Extra risk of a ball aimed right at a side wall (|x| of 4.6 m and more): it is easy to put it straight into the glass or the mesh. */
export const EDGE_RISK = 0.09;
export const edgeRisk = (landX: number | undefined, accuracy = 5): number =>
  landX === undefined ? 0 : EDGE_RISK * edgeRiskMul(accuracy) * clamp((Math.abs(landX) - 2.4) / 2.2, 0, 1);

export function errorChance(attacker: PlayerDef, shot: ShotDef, direction: DirectionDef, rallyLength: number, landX?: number, missingGuts = 0): number {
  const fatigue = Math.max(0, rallyLength - fatigueStart(attacker.stats.stamina, FATIGUE_START)) * FATIGUE_STEP;
  const raw = shot.risk + direction.risk + fatigue + edgeRisk(landX, attacker.stats.accuracy) - attacker.stats.technique * TECHNIQUE_SAFETY + missingGuts * RISKY_PER_G;
  return clamp(raw, MIN_ERROR, MAX_ERROR);
}

export function faultChance(server: PlayerDef, shot: ShotDef, missingGuts = 0): number {
  return clamp(shot.risk - server.stats.technique * TECHNIQUE_SAFETY + missingGuts * RISKY_PER_G, 0.02, MAX_ERROR);
}

export type HitOutcome = 'winner' | 'error' | 'continue';

export interface HitInput {
  attacker: PlayerDef;
  attackerGuts: number;
  shot: ShotDef;
  direction: DirectionDef;
  incoming: BallState;
  defender: PlayerDef;
  /** Where the defender's team stands (only matters for shots with `reboundChase`). */
  defenderFormation?: Formation;
  /** The defender plays the ball out of the air (a volley at the net or in mid-court): he has time to get there, so he defends better. */
  airTake?: boolean;
  /** Hits so far in this rally, not counting the serve. */
  rallyLength: number;
  /** Where the ball is aimed across the court (m): near a side wall it is more likely to be lost. */
  landX?: number;
  /** Share (0 to 1) of his defence the defender keeps because of how far from him the ball comes down (see `reachFactor`); default 1. */
  reach?: number;
  /** How well a timed shot was timed (0 to 1, see `timingEffect`); undefined: not timed (AUTO, the CPU), neutral. */
  timing?: number;
  rng: Rng;
}

/** The timing ring's window for a key shot in a match (ms either side of the moment): technique and accuracy widen it. */
export function ringWindow(p: PlayerDef): number {
  return Math.round(150 + 6 * p.stats.technique + 4 * p.stats.accuracy);
}

/** How well a touch was timed: 1 in the inner 40% of the window, down to 0.3 at its edge, 0 beyond it or with no touch (null). */
export function ringQuality(offMs: number | null, window: number): number {
  if (offMs === null) return 0;
  const q = Math.abs(offMs) / Math.max(1, window);
  if (q <= 0.4) return 1;
  if (q <= 1) return 1 - (0.7 * (q - 0.4)) / 0.6;
  return 0;
}

/**
 * What the timing of a key shot does (`q` 0 to 1; undefined: neutral, like AUTO and the CPU). A clean hit (q 1) makes an error 30%
 * less likely and adds 6% to the attack (3% for a serve: the ace threshold is steep); an average one (q 0.5) changes nothing; a
 * mistimed one (q 0) does the opposite. A whiff (no touch at all) is dealt with by the scene as q 0. Measured (scripts, level-1
 * hero): Por Tres winners 59% on AUTO, 76% clean, 35% mistimed; the hard serve 1.8% aces and 18% faults on AUTO, 4.8% and 12% clean.
 */
export function timingEffect(q: number | undefined, serve = false): { risk: number; attack: number } {
  if (q === undefined) return { risk: 1, attack: 1 };
  const t = clamp(q, 0, 1);
  return { risk: 1.3 - 0.6 * t, attack: serve ? 0.97 + 0.06 * t : 0.94 + 0.12 * t };
}

export interface HitResult {
  outcome: HitOutcome;
  attackScore: number;
  defenseScore: number;
  errorChance: number;
  tired: boolean;
  /** Height-fit multiplier that was applied. */
  fit: number;
  /** Pressure on the next hit (only after a narrow attack lead). */
  pressure: number;
}

/**
 * Resolves one hit of the rally (a return counts too). Pure: all randomness comes from `rng`,
 * which is called once for the error roll and twice for the score spreads, in that order.
 */
export function resolveHit(i: HitInput): HitResult {
  const missing = Math.max(0, i.shot.cost - i.attackerGuts);
  const tired = missing > 0;
  const fit = i.shot.fit[i.incoming.height];
  const lowOffGlass = i.incoming.glass === true && i.incoming.height === 'low' ? (i.shot.lowGlassRisk ?? 0) : 0;
  const te = timingEffect(i.timing);
  const chance = clamp((errorChance(i.attacker, i.shot, i.direction, i.rallyLength, i.landX, missing) + lowOffGlass) * te.risk, MIN_ERROR, MAX_ERROR);

  if (i.rng() < chance) {
    return { outcome: 'error', attackScore: 0, defenseScore: 0, errorChance: chance, tired, fit, pressure: 0 };
  }

  let attackScore =
    i.attacker.stats[i.shot.stat] * 10 * i.shot.power * i.direction.attack * fit * (i.shot.ignorePressure === true ? 1 : 1 - i.incoming.pressure) +
    i.rng() * RANDOM_SPREAD;
  attackScore *= te.attack;
  const airBonus = i.airTake === true ? (i.defenderFormation === 'net' ? AIR_DEFENSE.net : AIR_DEFENSE.mid) : 1;
  const defenseScore =
    defenseRating(i.defender, i.direction, i.shot.reboundChase ? (i.defenderFormation ?? 'back') : undefined, i.shot.drop === true ? (i.defenderFormation ?? 'back') : undefined) * airBonus * (i.reach ?? 1) + i.rng() * RANDOM_SPREAD;

  const diff = attackScore - defenseScore;
  const margin = i.shot.winnerMargin ?? WINNER_MARGIN;
  let outcome: HitOutcome = 'continue';
  // A lob is never a winner by itself: it hangs in the air for two seconds and then comes off the glass, so the defenders always get
  // there (they are on their way while it flies; the reach is only measured from where they stood when it was hit). A good lob
  // leaves them under pressure, and the points come from their mistakes.
  const lob = i.shot.flight.apex >= LOB_APEX;
  if (diff > margin && !lob) outcome = 'winner';

  const pressure = outcome === 'continue' ? clamp(diff / 200, 0, MAX_PRESSURE) : 0;
  return { outcome, attackScore, defenseScore, errorChance: chance, tired, fit, pressure };
}

export type ServeOutcome = 'fault' | 'ace' | 'in';

export interface ServeResult {
  outcome: ServeOutcome;
  attackScore: number;
  defenseScore: number;
  tired: boolean;
  /** How much the serve weakens the receiver's return. */
  pressure: number;
}

/**
 * Resolves one serve attempt. `cross` is the (always cross) direction used for the receiver's defence.
 * `rng` is called once for the fault roll and twice for the score spreads.
 * `receive` only matters for serves that go to a wall.
 */
export function resolveServe(
  server: PlayerDef,
  serverGuts: number,
  shot: ShotDef,
  receiver: PlayerDef,
  cross: DirectionDef,
  rng: Rng,
  receive: ReceiveMode = 'wall',
  second = false,
  /** How well the serve was timed (see `timingEffect`); undefined: neutral. */
  timing?: number,
): ServeResult {
  const missing = Math.max(0, shot.cost - serverGuts);
  const tired = missing > 0;
  const te = timingEffect(timing, true);
  if (rng() < faultChance(server, shot, missing) * (second ? SECOND_SERVE_FAULT : 1) * te.risk) {
    return { outcome: 'fault', attackScore: 0, defenseScore: 0, tired, pressure: 0 };
  }

  let attackScore = (server.stats[shot.stat] * 10 * shot.power + rng() * RANDOM_SPREAD) * te.attack;
  if (second) attackScore *= SECOND_SERVE_POWER;
  const walled = shot.wall !== 'none';
  const receiveMod = !walled ? 1 : receive === 'bounce' ? BOUNCE_DEFENSE : WALL_DEFENSE;
  const defenseScore = defenseRating(receiver, cross) * receiveMod + rng() * RANDOM_SPREAD;

  const diff = attackScore - defenseScore;
  if (diff > (shot.aceMargin ?? ACE_MARGIN)) return { outcome: 'ace', attackScore, defenseScore, tired, pressure: 0 };

  const relief = walled && receive === 'bounce' ? BOUNCE_PRESSURE_RELIEF : 1;
  const pressure = clamp(clamp(diff / 200, 0, MAX_PRESSURE) * (shot.pressureMult ?? 1) * relief * (second ? SECOND_SERVE_PRESSURE : 1), 0, MAX_SERVE_PRESSURE);
  return { outcome: 'in', attackScore, defenseScore, tired, pressure };
}

/** Guts after paying a cost (never below 0). */
export function spendGuts(guts: number, cost: number): number {
  return Math.max(0, guts - cost);
}

/** The game that has just ended is a short rest: the guts recovered after its last point are this many times the usual amount (4 instead of 2 at stamina 5). */
export const GAME_BREAK_RECOVERY_MUL = 2;

/** Guts after recovering (never above max). */
export function recoverGuts(guts: number, amount: number, maxGuts: number): number {
  return Math.min(maxGuts, guts + amount);
}
