// The padel serve is struck after a bounce, underarm, between the knee and the hip: the ball is dropped from the free hand, bounces in
// the server's own area and is hit as it comes down again. One ball path for every serve in the game (match, career, camp, lessons).

/** Where the legs and the body of the server are, in metres: the ball must be between the knee and the hip when it is struck. */
export const KNEE_M = 0.5;
export const HIP_M = 0.95;
/** The ball leaves the hand this high. */
export const DROP_M = 1.15;
/** Highest point after the bounce (at the hip) and when, as a share of the time from the bounce to the moment of the hit. */
export const PEAK_M = 0.95;
const PEAK_AT = 0.7;
/** How long the drop takes, and how long from the hand to the moment of the hit (ms). */
export const DROP_MS = 300;
export const SERVE_DUE_MS = 700;

/**
 * The height of the serve ball `ms` after it left the hand: falls, bounces on the floor, rises to the hip and drops again;
 * at `due` it is about a thumb below the hip, in the middle of the knee-hip zone.
 */
export function serveBallH(ms: number, drop = DROP_MS, due = SERVE_DUE_MS): number {
  if (ms <= 0) return DROP_M;
  if (ms < drop) return DROP_M * (1 - (ms / drop) ** 2);
  const u = Math.min(1.6, (ms - drop) / Math.max(1, due - drop));
  return Math.max(0, PEAK_M * (1 - ((u - PEAK_AT) / PEAK_AT) ** 2));
}

/** True when the ball is between the knee and the hip (the serve may be struck). */
export const inServeZone = (h: number): boolean => h >= KNEE_M && h <= HIP_M;
