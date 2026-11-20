import { MAX_PRESSURE } from './engine';
import type { BallState, ShotDef } from './types';

/** A ball slower than this (m/s) lets the volley hit through it with more pace. */
const SLOW_BALL = 14;
/** Speed (m/s) from which a ball counts as fast: a volley on it keeps its normal pace. */
const FAST_BALL = 20;

/**
 * How hard the hit goes, relative to the shot's usual speed, from the ball that comes to the hitter (cosmetic: the flight):
 *  - a LOW ball is always played a little slower (the hitter has to get under it);
 *  - a MID or HIGH ball is played harder when the hitter is well set (little pressure on him): the ball comes to his strike zone;
 *  - a volley on a slow ball is hit with much more pace (the hitter has time to step into it); on a fast ball it stays as it is.
 * Serves, lobs, chiquitas and the rulo keep their own speed.
 */
export function paceFactor(shot: ShotDef, ball: BallState): number {
  if (shot.kind === 'serve' || shot.flight.apex >= 3 || shot.wall === 'fence' || shot.id.includes('chiquita')) return 1;
  const comfort = 1 - Math.min(1, Math.max(0, ball.pressure / MAX_PRESSURE));
  let f = 1;
  if (ball.height === 'low') f = 0.85;
  else if (ball.height === 'mid') f = 1 + 0.08 * comfort;
  else f = 1 + 0.15 * comfort;
  if (shot.id === 'volley' && ball.speed !== undefined) {
    const slow = Math.min(1, Math.max(0, (FAST_BALL - ball.speed) / (FAST_BALL - SLOW_BALL)));
    f *= 1 + 0.3 * slow;
  }
  return f;
}
