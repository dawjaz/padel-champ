import type { ToonPose } from './toon/character';

/**
 * 'front' = faces the camera, 'back' = seen from behind, 'left' / 'right' = running to that side of the screen.
 * The near team normally shows its back and the far team its front; players turn when they run or wait for a ball
 * that comes off the back glass. A player who runs sideways (or is turned sideways) is shown in profile.
 */
export type Facing = 'front' | 'back' | 'left' | 'right';

/** Body poses of the match: the same names as `ToonPose` without the menu pose `idle`. */
export type PoseName = Exclude<ToonPose, 'idle'>;

export const POSE_NAMES: PoseName[] = ['ready', 'runA', 'runB', 'fhPrep', 'fhHit', 'fhFollow', 'bhPrep', 'bhHit', 'bhFollow', 'smashPrep', 'smashHit', 'smashFollow', 'fhvPrep', 'fhvHit', 'fhvFollow', 'bhvPrep', 'bhvHit', 'bhvFollow', 'ovPrep', 'ovHit', 'ovFollow'];

/** Forehand = ball on the racket side, backhand = on the other side, smash = overhead (jumping), ov = overhead on the ground (bandeja, vibora), fhv / bhv = from above, downwards (volley). */
export type Stance = 'fh' | 'bh' | 'smash' | 'ov' | 'fhv' | 'bhv';

export function poseOf(stance: Stance, phase: 'Prep' | 'Hit' | 'Follow'): PoseName {
  return `${stance}${phase}` as PoseName;
}
