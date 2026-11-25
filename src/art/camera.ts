/**
 * Fake-3D "TV broadcast" camera: behind the near baseline, looking down the court.
 * World units are metres: x across the court (-5..5, centre 0), z along it
 * (0 = far baseline, 10 = net, 20 = near baseline), h = height above the floor.
 * Screen is the 360x640 logical canvas; the court occupies roughly y 100..385.
 * Pure maths, no Phaser, so it is unit-tested.
 */
export const COURT_WIDTH_M = 10;
export const COURT_LENGTH_M = 20;
export const NET_Z = 10;
export const NET_HEIGHT_M = 0.92;
export const WALL_HEIGHT_M = 3;

const CENTER_X = 180;
/** Camera distance (m) from the near baseline. Sets how strong the perspective is. */
const DIST_NEAR = 27.2;
const PX_PER_M_AT_ONE = 897.6;
const K = 18294;
const Y_HORIZON = -287.6;

export interface Projected {
  x: number;
  y: number;
  /** Pixels per metre at this depth (objects get smaller further away). */
  scale: number;
}

export function project(xm: number, zm: number, hm = 0): Projected {
  const dist = DIST_NEAR + (COURT_LENGTH_M - zm);
  const scale = PX_PER_M_AT_ONE / dist;
  return { x: CENTER_X + xm * scale, y: Y_HORIZON + K / dist - hm * scale, scale };
}

/** The court point (on the floor) under a screen point: the inverse of `project` at height 0. */
export function unproject(sx: number, sy: number): { x: number; z: number } {
  const dist = K / Math.max(1e-6, sy - Y_HORIZON);
  const scale = PX_PER_M_AT_ONE / dist;
  return { x: (sx - CENTER_X) / scale, z: COURT_LENGTH_M + DIST_NEAR - dist };
}
