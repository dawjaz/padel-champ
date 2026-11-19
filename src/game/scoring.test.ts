import { describe, expect, it } from 'vitest';
import { awardPoint, isGoldenPoint, newScore, pointLabels } from './scoring';

describe('scoring', () => {
  it('counts 0/15/30/40', () => {
    let s = newScore();
    expect(pointLabels(s)).toEqual(['0', '0']);
    s = awardPoint(s, 0).score;
    s = awardPoint(s, 0).score;
    s = awardPoint(s, 1).score;
    expect(pointLabels(s)).toEqual(['30', '15']);
  });

  it('wins a game from 40 and resets points', () => {
    let s = newScore();
    for (let i = 0; i < 3; i++) s = awardPoint(s, 0).score;
    const res = awardPoint(s, 0);
    expect(res.gameWon).toBe(true);
    expect(res.score.games).toEqual([1, 0]);
    expect(res.score.points).toEqual([0, 0]);
  });

  it('uses the golden point at 40-40', () => {
    let s = newScore();
    for (let i = 0; i < 3; i++) {
      s = awardPoint(s, 0).score;
      s = awardPoint(s, 1).score;
    }
    expect(isGoldenPoint(s)).toBe(true);
    const res = awardPoint(s, 1);
    expect(res.gameWon).toBe(true);
    expect(res.score.games).toEqual([0, 1]);
  });

  it('ends the match when a side reaches gamesToWin', () => {
    let s = newScore(2);
    for (let g = 0; g < 2; g++) {
      for (let i = 0; i < 4; i++) s = awardPoint(s, 1).score;
    }
    expect(s.winner).toBe(1);
    // No more points after the match is over.
    expect(awardPoint(s, 0).score).toBe(s);
  });
});
