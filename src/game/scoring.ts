import type { SideIndex } from './types';

export interface MatchScore {
  /** Points in the current game, 0..3 (0/15/30/40). At deuce both stay at 3. */
  points: [number, number];
  games: [number, number];
  gamesToWin: number;
  winner: SideIndex | null;
  /** 0 before 40-40; 1, 2 or 3 = which deuce this is ("Deuce 3" is the Star Point). */
  deuce: number;
  /** The side with the advantage at deuce 1 or 2, else null. */
  advantage: SideIndex | null;
}

const LABELS = ['0', '15', '30', '40'];

/** The FIP Star Point rule (2026): at 40-40 advantage is played, but only twice; at the third deuce one point decides the game. */
export const STAR_POINT_DEUCE = 3;

export function newScore(gamesToWin = 2): MatchScore {
  return { points: [0, 0], games: [0, 0], gamesToWin, winner: null, deuce: 0, advantage: null };
}

function gameWon(score: MatchScore, side: SideIndex): { score: MatchScore; gameWon: boolean } {
  const games: [number, number] = [score.games[0], score.games[1]];
  games[side] += 1;
  const winner: SideIndex | null = games[side] >= score.gamesToWin ? side : null;
  return { score: { ...score, points: [0, 0], games, winner, deuce: 0, advantage: null }, gameWon: true };
}

/**
 * Awards a point with the Star Point rule: the score runs 15, 30, 40; at 40-40 (deuce 1) the winner of the next point has the
 * advantage and wins the game with the point after that, or loses it and the score goes back to deuce (deuce 2, advantage again);
 * after the second lost advantage it is deuce 3, the Star Point: one point decides the game.
 */
export function awardPoint(score: MatchScore, side: SideIndex): { score: MatchScore; gameWon: boolean } {
  if (score.winner !== null) return { score, gameWon: false };

  if (score.deuce === 0) {
    const points: [number, number] = [score.points[0], score.points[1]];
    points[side] += 1;
    if (points[side] >= 4) return gameWon(score, side);
    return { score: { ...score, points, deuce: points[0] === 3 && points[1] === 3 ? 1 : 0 }, gameWon: false };
  }
  if (score.deuce >= STAR_POINT_DEUCE) return gameWon(score, side);
  if (score.advantage === null) return { score: { ...score, advantage: side }, gameWon: false };
  if (score.advantage === side) return gameWon(score, side);
  return { score: { ...score, advantage: null, deuce: score.deuce + 1 }, gameWon: false };
}

export function pointLabels(score: MatchScore): [string, string] {
  if (score.deuce > 0 && score.advantage !== null) return score.advantage === 0 ? ['AD', '40'] : ['40', 'AD'];
  return [LABELS[Math.min(score.points[0], 3)], LABELS[Math.min(score.points[1], 3)]];
}

/** True when the next point decides the game (deuce 3). */
export function isStarPoint(score: MatchScore): boolean {
  return score.deuce >= STAR_POINT_DEUCE;
}

/** What to show next to the score: DEUCE 1, ADVANTAGE, STAR POINT, or nothing. */
export function deuceLabel(score: MatchScore): string {
  if (score.deuce === 0) return '';
  if (isStarPoint(score)) return 'STAR POINT';
  return score.advantage === null ? `DEUCE ${score.deuce}` : `ADVANTAGE ${score.advantage === 0 ? 'YOU' : 'CPU'}`;
}
