import { describe, expect, it } from 'vitest';
import { awardPoint, deuceLabel, isStarPoint, newScore, pointLabels } from './scoring';

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

  const toDeuce = (): ReturnType<typeof newScore> => {
    let s = newScore();
    for (let i = 0; i < 3; i++) {
      s = awardPoint(s, 0).score;
      s = awardPoint(s, 1).score;
    }
    return s;
  };

  it('plays advantage at the first deuce: the point after the advantage wins the game', () => {
    let s = toDeuce();
    expect(s.deuce).toBe(1);
    expect(isStarPoint(s)).toBe(false);
    expect(deuceLabel(s)).toBe('DEUCE 1');
    s = awardPoint(s, 0).score;
    expect(pointLabels(s)).toEqual(['AD', '40']);
    expect(deuceLabel(s)).toBe('ADVANTAGE YOU');
    const res = awardPoint(s, 0);
    expect(res.gameWon).toBe(true);
    expect(res.score.games).toEqual([1, 0]);
    expect(res.score.deuce).toBe(0);
  });

  it('a lost advantage goes back to deuce, and the third deuce is the Star Point', () => {
    let s = toDeuce();
    s = awardPoint(s, 0).score; // advantage 1
    s = awardPoint(s, 1).score; // deuce 2
    expect(s.deuce).toBe(2);
    expect(s.advantage).toBeNull();
    expect(pointLabels(s)).toEqual(['40', '40']);
    s = awardPoint(s, 1).score; // advantage 2
    expect(pointLabels(s)).toEqual(['40', 'AD']);
    s = awardPoint(s, 0).score; // deuce 3
    expect(isStarPoint(s)).toBe(true);
    expect(deuceLabel(s)).toBe('STAR POINT');
    const res = awardPoint(s, 1); // one point decides
    expect(res.gameWon).toBe(true);
    expect(res.score.games).toEqual([0, 1]);
  });

  it('the Star Point can be won by either side, and the next game starts clean', () => {
    let s = toDeuce();
    s = awardPoint(awardPoint(s, 0).score, 1).score;
    s = awardPoint(awardPoint(s, 1).score, 0).score;
    expect(isStarPoint(s)).toBe(true);
    const res = awardPoint(s, 0);
    expect(res.score.games).toEqual([1, 0]);
    expect(res.score.points).toEqual([0, 0]);
    expect(res.score.deuce).toBe(0);
    expect(res.score.advantage).toBeNull();
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
