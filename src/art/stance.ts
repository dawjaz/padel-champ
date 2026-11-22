import type { Stance } from './pose';
import type { CourtPos, SideIndex } from '../game/types';

/** A ball played at or above this height (m) is taken overhead (smash, bandeja). */
export const OVERHEAD_HEIGHT = 1.7;
/** How far beside the ball (m, along x) a player stands for a forehand/backhand. */
export const STROKE_GAP = 0.6;

/**
 * How a player sets up for a ball that will be hit at (hitX, hitH), coming from fromX: overhead for a high ball, otherwise
 * forehand when the ball is on the racket side and backhand when it is on the other side. The racket is in the right
 * hand: on the screen's right for the near team (side 0, seen from behind), on the left for the far team.
 */
export function chooseStance(side: SideIndex, fromX: number, hitX: number, hitH: number): Stance {
  if (hitH >= OVERHEAD_HEIGHT) return 'smash';
  const ballOnRight = hitX > fromX;
  const racketOnRight = side === 0;
  return ballOnRight === racketOnRight ? 'fh' : 'bh';
}

/** Where the player stands: the ball is beside them on the racket side (forehand) or across the body (backhand). */
export function standingSpot(side: SideIndex, stance: Stance, hit: CourtPos, behindBall = 0): CourtPos {
  const racketDir = side === 0 ? 1 : -1; // screen direction of the racket side
  const gap = stance === 'bh' ? -STROKE_GAP : stance === 'fh' ? STROKE_GAP : 0.25;
  // `behindBall`: stands further from the net than the ball (side 0 defends z = 20, side 1 defends z = 0), so the ball is a little in front of him
  const z = hit.z + (side === 0 ? behindBall : -behindBall);
  return { x: Math.max(-4.7, Math.min(4.7, hit.x - racketDir * gap)), z: Math.max(0.3, Math.min(19.7, z)) };
}
