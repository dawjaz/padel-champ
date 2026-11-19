import type { SideIndex } from './types';

export interface MatchScore {
  /** Points in the current game, 0..3 (0/15/30/40). Reaching 4 wins the game. */
  points: [number, number];
  games: [number, number];
  gamesToWin: number;
  winner: SideIndex | null;
}

const LABELS = ['0', '15', '30', '40'];

export function newScore(gamesToWin = 2): MatchScore {
  return { points: [0, 0], games: [0, 0], gamesToWin, winner: null };
}

/**
 * Awards a point. Uses the golden point rule: at 40-40 the next point wins the game.
 * Returns a new score object and whether the point ended a game.
 */
export function awardPoint(score: MatchScore, side: SideIndex): { score: MatchScore; gameWon: boolean } {
  if (score.winner !== null) return { score, gameWon: false };

  const points: [number, number] = [score.points[0], score.points[1]];
  const games: [number, number] = [score.games[0], score.games[1]];
  points[side] += 1;

  if (points[side] < 4) {
    return { score: { ...score, points, games }, gameWon: false };
  }

  games[side] += 1;
  const winner: SideIndex | null = games[side] >= score.gamesToWin ? side : null;
  return { score: { ...score, points: [0, 0], games, winner }, gameWon: true };
}

export function pointLabels(score: MatchScore): [string, string] {
  return [LABELS[Math.min(score.points[0], 3)], LABELS[Math.min(score.points[1], 3)]];
}

export function isGoldenPoint(score: MatchScore): boolean {
  return score.points[0] === 3 && score.points[1] === 3;
}
