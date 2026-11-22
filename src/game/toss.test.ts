import { describe, expect, it } from 'vitest';
import { fixedRng, seededRng } from './rng';
import { flipCoin, tossWinner } from './toss';

describe('coin toss', () => {
  it('flips heads below 0.5 and tails otherwise', () => {
    expect(flipCoin(fixedRng([0.1]))).toBe('heads');
    expect(flipCoin(fixedRng([0.9]))).toBe('tails');
  });
  it('the caller wins when the call matches', () => {
    expect(tossWinner('heads', 'heads', 0)).toBe(0);
    expect(tossWinner('tails', 'tails', 0)).toBe(0);
  });
  it('the other side wins when the call is wrong', () => {
    expect(tossWinner('heads', 'tails', 0)).toBe(1);
    expect(tossWinner('tails', 'heads', 0)).toBe(1);
  });
  it('is roughly fair', () => {
    const rng = seededRng(7);
    let heads = 0;
    for (let i = 0; i < 2000; i++) if (flipCoin(rng) === 'heads') heads++;
    expect(heads).toBeGreaterThan(900);
    expect(heads).toBeLessThan(1100);
  });
});
