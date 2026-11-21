// How the seven attributes drive the mechanics. Pure functions. 5 is the neutral value: at 5 every multiplier is 1, so the balance
// of the game (tuned with the default players) does not change, and each point away from 5 moves the mechanics a little.

import type { PlayerDef, StatKey } from './types';

export const STAT_KEYS: StatKey[] = ['power', 'spin', 'technique', 'accuracy', 'stamina', 'speed', 'defense'];
export const NEUTRAL = 5;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Guts (the stamina bar) of a player: 10 at stamina 5. */
export const gutsFor = (stamina: number): number => Math.round(6 + 0.8 * stamina);

/** Guts recovered after every point: 2 at stamina 5. */
export const gutsRecovery = (stamina: number): number => Math.max(1, Math.round(1 + 0.2 * stamina));

/** The rally length after which a hit starts to add error chance: 6 at stamina 5, one more hit for about every 1.7 points. */
export const fatigueStart = (stamina: number, base = 6): number => base + (stamina - NEUTRAL) * 0.6;

/** Ball speed off the racket: x1 at power 5. */
export const powerSpeedMul = (power: number): number => clamp(0.9 + 0.02 * power, 0.85, 1.15);

/** Spin of the shot (topspin, backspin, side spin): x1 at spin 5. */
export const spinMul = (spin: number): number => clamp(0.7 + 0.06 * spin, 0.6, 1.4);

/** How often a hitter really hits the gap he aims at: 0.75 at accuracy 5. */
export const aimSkill = (accuracy: number): number => clamp(0.45 + 0.06 * accuracy, 0.3, 0.95);

/** Spread of the aim points across and in depth: x1 at accuracy 5, tighter above. */
export const aimSpreadMul = (accuracy: number): number => clamp(1.5 - 0.1 * accuracy, 0.6, 1.3);

/** Multiplies the risk of a ball aimed at a side wall: x1 at accuracy 5, less for a precise player. */
export const edgeRiskMul = (accuracy: number): number => clamp(1.3 - 0.06 * accuracy, 0.5, 1.2);

/** The attributes as the engine reads them (all seven). */
export const statsOf = (p: PlayerDef): Record<StatKey, number> => p.stats;
