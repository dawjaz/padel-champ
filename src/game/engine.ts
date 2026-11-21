import { edgeRiskMul, fatigueStart } from './attributes';
import type { BallState, DirectionDef, Formation, PlayerDef, ReceiveMode, Rng, ShotDef } from './types';

/** Default score lead needed to win the point outright (a shot can override it). */
export const WINNER_MARGIN = 24;
/** If the defence beats the attack by more than this, the defender wins the point. */
export const INTERCEPT_MARGIN = 48;
/** An ace needs this much more than the receiver's defence. */
export const ACE_MARGIN = 48;
/**
 * Scales defence up so that average shots get returned and rallies last. Tuned with a CPU-vs-CPU
 * simulation of 20,000 points: ~4 hits after the serve, server wins ~55%, aces < 1%.
 */
export const DEFENSE_SCALE = 1.3;
/** Defence multiplier of a player who takes the ball out of the air (volley) instead of running back for it. */
export const AIR_DEFENSE = { net: 1.2, mid: 1.12 } as const;
/** Attack multiplier when the hitter cannot pay the guts cost. */
export const TIRED_FACTOR = 0.6;
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

export function defenseRating(defender: PlayerDef, direction: DirectionDef, chase?: Formation): number {
  // After a bajada the ball rebounds off the back glass: a fast player who stands well can still get to it.
  const weights = chase ? { defense: 4, speed: 8 } : { defense: 7, speed: 3 };
  const place = chase ? REBOUND_POSITION[chase] : 1;
  const base = (defender.stats.defense * weights.defense + defender.stats.speed * weights.speed) * DEFENSE_SCALE * place;
  return direction.id === 'middle' ? base * direction.hesitation : base;
}

/** Extra risk of a ball aimed right at a side wall (|x| of 4.6 m and more): it is easy to put it straight into the glass or the mesh. */
export const EDGE_RISK = 0.09;
export const edgeRisk = (landX: number | undefined, accuracy = 5): number =>
  landX === undefined ? 0 : EDGE_RISK * edgeRiskMul(accuracy) * clamp((Math.abs(landX) - 2.4) / 2.2, 0, 1);

export function errorChance(attacker: PlayerDef, shot: ShotDef, direction: DirectionDef, rallyLength: number, landX?: number): number {
  const fatigue = Math.max(0, rallyLength - fatigueStart(attacker.stats.stamina, FATIGUE_START)) * FATIGUE_STEP;
  const raw = shot.risk + direction.risk + fatigue + edgeRisk(landX, attacker.stats.accuracy) - attacker.stats.technique * TECHNIQUE_SAFETY;
  return clamp(raw, MIN_ERROR, MAX_ERROR);
}

export function faultChance(server: PlayerDef, shot: ShotDef): number {
  return clamp(shot.risk - server.stats.technique * TECHNIQUE_SAFETY, 0.02, MAX_ERROR);
}

export type HitOutcome = 'winner' | 'error' | 'intercept' | 'continue';

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
  rng: Rng;
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
  const tired = i.attackerGuts < i.shot.cost;
  const fit = i.shot.fit[i.incoming.height];
  const lowOffGlass = i.incoming.glass === true && i.incoming.height === 'low' ? (i.shot.lowGlassRisk ?? 0) : 0;
  const chance = clamp(errorChance(i.attacker, i.shot, i.direction, i.rallyLength, i.landX) + lowOffGlass, MIN_ERROR, MAX_ERROR);

  if (i.rng() < chance) {
    return { outcome: 'error', attackScore: 0, defenseScore: 0, errorChance: chance, tired, fit, pressure: 0 };
  }

  let attackScore =
    i.attacker.stats[i.shot.stat] * 10 * i.shot.power * i.direction.attack * fit * (1 - i.incoming.pressure) +
    i.rng() * RANDOM_SPREAD;
  if (tired) attackScore *= TIRED_FACTOR;
  const airBonus = i.airTake === true ? (i.defenderFormation === 'net' ? AIR_DEFENSE.net : AIR_DEFENSE.mid) : 1;
  const defenseScore =
    defenseRating(i.defender, i.direction, i.shot.reboundChase ? (i.defenderFormation ?? 'back') : undefined) * airBonus + i.rng() * RANDOM_SPREAD;

  const diff = attackScore - defenseScore;
  const margin = i.shot.winnerMargin ?? WINNER_MARGIN;
  let outcome: HitOutcome = 'continue';
  if (diff > margin) outcome = 'winner';
  else if (-diff > INTERCEPT_MARGIN) outcome = 'intercept';

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
): ServeResult {
  const tired = serverGuts < shot.cost;
  if (rng() < faultChance(server, shot)) {
    return { outcome: 'fault', attackScore: 0, defenseScore: 0, tired, pressure: 0 };
  }

  let attackScore = server.stats[shot.stat] * 10 * shot.power + rng() * RANDOM_SPREAD;
  if (tired) attackScore *= TIRED_FACTOR;
  const walled = shot.wall !== 'none';
  const receiveMod = !walled ? 1 : receive === 'bounce' ? BOUNCE_DEFENSE : WALL_DEFENSE;
  const defenseScore = defenseRating(receiver, cross) * receiveMod + rng() * RANDOM_SPREAD;

  const diff = attackScore - defenseScore;
  if (diff > ACE_MARGIN) return { outcome: 'ace', attackScore, defenseScore, tired, pressure: 0 };

  const relief = walled && receive === 'bounce' ? BOUNCE_PRESSURE_RELIEF : 1;
  const pressure = clamp(clamp(diff / 200, 0, MAX_PRESSURE) * (shot.pressureMult ?? 1) * relief, 0, MAX_SERVE_PRESSURE);
  return { outcome: 'in', attackScore, defenseScore, tired, pressure };
}

/** Guts after paying a cost (never below 0). */
export function spendGuts(guts: number, cost: number): number {
  return Math.max(0, guts - cost);
}

/** Guts after recovering (never above max). */
export function recoverGuts(guts: number, amount: number, maxGuts: number): number {
  return Math.min(maxGuts, guts + amount);
}
