import { describe, expect, it } from 'vitest';
import playersData from '../data/players.json';
import { fatigued, fatigueFactor, receiveDecisionMs, RECEIVE_DECISION_MS, aimSkill, aimSpreadMul, edgeRiskMul, fatigueStart, gutsFor, gutsRecovery, NEUTRAL, powerSpeedMul, spinMul, STAT_KEYS } from './attributes';
import { aimX } from './court';
import { errorChance } from './engine';
import { DIRECTIONS, SHOTS } from './catalog';
import { seededRng } from './rng';
import type { PlayerDef } from './types';

const all = [...playersData.you, ...playersData.cpu] as unknown as PlayerDef[];

describe('attributes', () => {
  it('5 is neutral: every multiplier is 1 and the guts are the old 10', () => {
    expect(powerSpeedMul(NEUTRAL)).toBeCloseTo(1);
    expect(spinMul(NEUTRAL)).toBeCloseTo(1);
    expect(aimSpreadMul(NEUTRAL)).toBeCloseTo(1);
    expect(edgeRiskMul(NEUTRAL)).toBeCloseTo(1);
    expect(aimSkill(NEUTRAL)).toBeCloseTo(0.75);
    expect(fatigueStart(NEUTRAL)).toBe(6);
    expect(gutsFor(NEUTRAL)).toBe(10);
    expect(gutsRecovery(NEUTRAL)).toBe(2);
  });

  it('more of an attribute is always better, never worse', () => {
    for (let a = 1; a < 10; a++) {
      expect(powerSpeedMul(a + 1)).toBeGreaterThanOrEqual(powerSpeedMul(a));
      expect(spinMul(a + 1)).toBeGreaterThanOrEqual(spinMul(a));
      expect(aimSkill(a + 1)).toBeGreaterThanOrEqual(aimSkill(a));
      expect(aimSpreadMul(a + 1)).toBeLessThanOrEqual(aimSpreadMul(a));
      expect(edgeRiskMul(a + 1)).toBeLessThanOrEqual(edgeRiskMul(a));
      expect(fatigueStart(a + 1)).toBeGreaterThan(fatigueStart(a));
      expect(gutsFor(a + 1)).toBeGreaterThanOrEqual(gutsFor(a));
      expect(gutsRecovery(a + 1)).toBeGreaterThanOrEqual(gutsRecovery(a));
    }
  });

  it('every player has all seven attributes and guts that match the stamina', () => {
    for (const p of all) {
      for (const k of STAT_KEYS) expect(p.stats[k], `${p.id} ${k}`).toBeGreaterThan(0);
      expect(p.maxGuts, p.id).toBe(gutsFor(p.stats.stamina));
    }
  });

  it('a more accurate hitter spreads the aim less, a more technical one and an accurate one err less', () => {
    const spread = (acc: number): number => {
      const xs: number[] = [];
      for (let i = 1; i < 400; i++) xs.push(aimX('cross', 1, seededRng(i), undefined, acc));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spread(9)).toBeLessThan(spread(5));
    expect(spread(5)).toBeLessThan(spread(2));
    const base = all[0];
    const withStats = (stats: Partial<PlayerDef['stats']>): PlayerDef => ({ ...base, stats: { ...base.stats, ...stats } });
    const shot = SHOTS.find((s) => s.id === 'flat')!;
    const e = (p: PlayerDef, landX?: number, rally = 12): number => errorChance(p, shot, DIRECTIONS.cross, rally, landX);
    expect(e(withStats({ accuracy: 9 }), 4.6)).toBeLessThan(e(withStats({ accuracy: 3 }), 4.6));
    expect(e(withStats({ stamina: 9 }))).toBeLessThan(e(withStats({ stamina: 3 })));
    expect(e(withStats({ technique: 9 }))).toBeLessThan(e(withStats({ technique: 3 })));
  });
});

describe('fatigue (what the guts do)', () => {
  it('a fresh player and one at half the bar are not affected, an empty bar costs 30%', () => {
    expect(fatigueFactor(10, 10)).toBe(1);
    expect(fatigueFactor(5, 10)).toBe(1);
    expect(fatigueFactor(0, 10)).toBeCloseTo(0.7);
    expect(fatigueFactor(2.5, 10)).toBeCloseTo(0.85);
    for (let g = 0; g < 10; g++) expect(fatigueFactor(g + 1, 10)).toBeGreaterThanOrEqual(fatigueFactor(g, 10));
  });

  it('a tired player has less power, accuracy and speed, and nothing else changes', () => {
    const p = all[0];
    expect(fatigued(p, p.maxGuts)).toBe(p);
    expect(fatigued(p, undefined)).toBe(p);
    const t = fatigued(p, 0);
    expect(t.stats.power).toBeCloseTo(p.stats.power * 0.7);
    expect(t.stats.accuracy).toBeCloseTo(p.stats.accuracy * 0.7);
    expect(t.stats.speed).toBeCloseTo(p.stats.speed * 0.7);
    expect(t.stats.technique).toBe(p.stats.technique);
    expect(t.stats.defense).toBe(p.stats.defense);
    expect(t.id).toBe(p.id);
  });
});

describe('receiveDecisionMs', () => {
  it('is the full time at full guts and shrinks as the guts run out', () => {
    expect(receiveDecisionMs(10, 10)).toBe(RECEIVE_DECISION_MS);
    expect(receiveDecisionMs(0, 10)).toBeLessThan(receiveDecisionMs(5, 10));
    for (let g = 0; g < 10; g++) expect(receiveDecisionMs(g, 10)).toBeLessThan(receiveDecisionMs(g + 1, 10));
    expect(receiveDecisionMs(0, 10)).toBeGreaterThan(2000);
  });
});
