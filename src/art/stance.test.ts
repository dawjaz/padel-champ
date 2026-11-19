import { describe, expect, it } from 'vitest';
import { chooseStance, standingSpot, STROKE_GAP } from './stance';

describe('chooseStance', () => {
  it('plays a high ball overhead', () => {
    expect(chooseStance(0, 0, 3, 2.0)).toBe('smash');
    expect(chooseStance(1, 0, -3, 1.8)).toBe('smash');
  });

  it('near team (seen from behind, racket on the screen right): ball to the right is a forehand', () => {
    expect(chooseStance(0, 0, 2, 1)).toBe('fh');
    expect(chooseStance(0, 0, -2, 1)).toBe('bh');
  });

  it('far team (facing the camera, racket on the screen left): ball to the left is a forehand', () => {
    expect(chooseStance(1, 0, -2, 1)).toBe('fh');
    expect(chooseStance(1, 0, 2, 1)).toBe('bh');
  });
});

describe('standingSpot', () => {
  it('puts the ball on the racket side for a forehand and across the body for a backhand', () => {
    const hit = { x: 1, z: 15 };
    expect(standingSpot(0, 'fh', hit).x).toBeCloseTo(1 - STROKE_GAP); // ball is to the right of the player
    expect(standingSpot(0, 'bh', hit).x).toBeCloseTo(1 + STROKE_GAP);
    expect(standingSpot(1, 'fh', hit).x).toBeCloseTo(1 + STROKE_GAP); // far team: racket side is the screen's left
    expect(standingSpot(1, 'bh', hit).x).toBeCloseTo(1 - STROKE_GAP);
  });

  it('stays inside the court', () => {
    expect(standingSpot(0, 'bh', { x: 4.9, z: 15 }).x).toBeLessThanOrEqual(4.7);
    expect(standingSpot(0, 'fh', { x: -4.9, z: 15 }).x).toBeGreaterThanOrEqual(-4.7);
  });
});
