// The padel serve is struck after a bounce, underarm, between the knee and the hip: the ball is dropped from the free hand, bounces in
// the server's own area and is hit as it comes down again. One ball path for every serve in the game (match, career, camp, lessons).
// Pure apart from the zone marker, which draws on a Phaser graphics it is given and takes the camera projection as an argument.
import type Phaser from 'phaser';

/** Where the legs and the body of the server are, in metres: the ball must be between the knee and the hip when it is struck. */
export const KNEE_M = 0.5;
export const HIP_M = 0.95;
/** The ball leaves the hand this high. */
export const DROP_M = 1.15;
/** Highest point after the bounce (at the hip) and when, as a share of the time from the bounce to the moment of the hit. */
export const PEAK_M = 0.95;
const PEAK_AT = 0.7;
/** How long the drop takes, and how long from the hand to the moment of the hit (ms). */
export const DROP_MS = 420;
export const SERVE_DUE_MS = 1000;

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

/** The marker of the zone: a thin green bracket beside the ball between knee and hip height (`project` is the camera's). */
export function drawServeZone(
  g: Phaser.GameObjects.Graphics,
  project: (x: number, z: number, h: number) => { x: number; y: number; scale: number },
  x: number,
  z: number,
): void {
  const lo = project(x, z, KNEE_M);
  const hi = project(x, z, HIP_M);
  const w = Math.max(6, lo.scale * 0.14);
  const left = lo.x + Math.max(10, lo.scale * 0.34);
  g.clear();
  g.fillStyle(0x4ade80, 0.28).fillRoundedRect(left, hi.y, w, lo.y - hi.y, 3);
  g.lineStyle(2, 0x4ade80, 0.9).strokeRoundedRect(left, hi.y, w, lo.y - hi.y, 3);
}
