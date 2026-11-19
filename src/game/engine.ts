import type { ExchangeResult, MoveDef, PlayerDef, ResponseDef, Rng } from './types';

/** Score difference needed to win the point outright (attack) or to intercept (defence). */
export const WINNER_MARGIN = 12;
export const INTERCEPT_MARGIN = 15;
/** Bonus when the defender picks a response that counters the move. */
export const COUNTER_BONUS = 15;
/** Attack multiplier when the hitter cannot pay the guts cost. */
export const TIRED_FACTOR = 0.6;
/** Random spread added to each side's score. */
export const RANDOM_SPREAD = 20;

/**
 * Resolves one exchange: the hitter plays `move`, the defender answers with `response`.
 * Pure function: all randomness comes from `rng` (0 <= rng() < 1), so it is testable.
 */
export function resolveExchange(
  attacker: PlayerDef,
  attackerGuts: number,
  move: MoveDef,
  defender: PlayerDef,
  response: ResponseDef,
  rng: Rng,
): ExchangeResult {
  const tired = attackerGuts < move.cost;
  const countered = move.counteredBy.includes(response.id);

  let attackScore = attacker.stats[move.stat] * 10 * move.power + rng() * RANDOM_SPREAD;
  if (tired) attackScore *= TIRED_FACTOR;

  let defenseScore = defender.stats.defense * 10 * response.mod + rng() * RANDOM_SPREAD;
  if (countered) defenseScore += COUNTER_BONUS;

  const diff = attackScore - defenseScore;
  let outcome: ExchangeResult['outcome'] = 'continue';
  if (diff > WINNER_MARGIN) outcome = 'winner';
  else if (-diff > INTERCEPT_MARGIN) outcome = 'intercept';

  return { outcome, attackScore, defenseScore, countered, tired };
}

/** Guts after paying a cost (never below 0). */
export function spendGuts(guts: number, cost: number): number {
  return Math.max(0, guts - cost);
}

/** Guts after recovering (never above max). */
export function recoverGuts(guts: number, amount: number, maxGuts: number): number {
  return Math.min(maxGuts, guts + amount);
}
