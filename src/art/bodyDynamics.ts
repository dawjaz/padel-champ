// Weight and momentum for a player's picture (stage A of the character work): the body leans into a run, leans back and squashes
// when it brakes, stretches in a sprint, bobs with the steps and breathes when it stands. Springs, so a stop overshoots a little
// and settles. Pure (no Phaser): the scene feeds the screen movement of the feet every frame and applies the result to the sprite.

export interface BodyState {
  /** Smoothed velocity in metres per second on the screen plane (x across, y down the screen). */
  vx: number;
  vy: number;
  /** Lean in radians (+ = towards screen right) and its spring speed. */
  lean: number;
  leanVel: number;
  /** Squash offset (+ = taller and thinner, - = squashed) and its spring speed. */
  squash: number;
  squashVel: number;
  /** Distance run, for the step bob (metres). */
  stride: number;
  /** Whether the body was running fast in the last frames (a stop from a run kicks a brake). */
  fast: boolean;
  /** Breathing phase offset, so the four players do not breathe in step. */
  phase: number;
}

export interface BodyPose {
  rotation: number;
  scaleX: number;
  scaleY: number;
  /** Lift of the feet in metres (multiply by pixels per metre). */
  bob: number;
  /** True on the frame the body brakes hard from a run (time for a dust puff). */
  braked: boolean;
}

export const LEAN_PER_SPEED = 0.03; // rad per m/s
export const LEAN_PER_ACCEL = 0.012; // rad per m/s^2 (braking leans back)
export const LEAN_MAX = 0.24;
const LEAN_STIFF = 160;
const LEAN_DAMP = 14;
const SQUASH_STIFF = 260;
const SQUASH_DAMP = 13;
const STRETCH_PER_SPEED = 0.008;
const FAST = 2.2; // m/s
const STOPPED = 0.6;
const STEP_LEN = 0.9; // metres per step
const BOB = 0.05; // metres

export const newBody = (phase = 0): BodyState => ({ vx: 0, vy: 0, lean: 0, leanVel: 0, squash: 0, squashVel: 0, stride: 0, fast: false, phase });

/** Kicks the squash spring: + stretches (a hit, a take-off), - squashes (a landing, a crouch before a start). */
export function kickBody(s: BodyState, amount: number): void {
  s.squashVel += amount;
}

/**
 * Advances the body by `dt` seconds after its feet moved (dx, dy) metres on the screen plane. `idle` is true when the player stands
 * waiting (breathing shows), `time` is the scene time in seconds.
 */
export function stepBody(s: BodyState, dx: number, dy: number, dt: number, time: number, idle: boolean): BodyPose {
  dt = Math.min(Math.max(dt, 1 / 240), 1 / 20);
  const k = Math.min(1, dt * 18);
  const vx = s.vx + (dx / dt - s.vx) * k;
  const vy = s.vy + (dy / dt - s.vy) * k;
  const ax = (vx - s.vx) / dt;
  s.vx = vx;
  s.vy = vy;
  const speed = Math.hypot(vx, vy);

  const target = clamp(vx * LEAN_PER_SPEED + clamp(ax, -30, 30) * LEAN_PER_ACCEL, -LEAN_MAX, LEAN_MAX);
  s.leanVel += ((target - s.lean) * LEAN_STIFF - s.leanVel * LEAN_DAMP) * dt;
  s.lean = clamp(s.lean + s.leanVel * dt, -LEAN_MAX * 1.3, LEAN_MAX * 1.3);

  let braked = false;
  if (speed > FAST) s.fast = true;
  else if (s.fast && speed < STOPPED) {
    s.fast = false;
    braked = true;
    kickBody(s, -1.6);
  }
  const stretch = Math.min(0.05, speed * STRETCH_PER_SPEED);
  s.squashVel += ((stretch - s.squash) * SQUASH_STIFF - s.squashVel * SQUASH_DAMP) * dt;
  s.squash = clamp(s.squash + s.squashVel * dt, -0.18, 0.14);

  s.stride += speed * dt;
  const bob = speed > STOPPED ? Math.abs(Math.sin((s.stride / STEP_LEN) * Math.PI)) * BOB * Math.min(1, speed / FAST) : 0;
  const breath = idle && speed < STOPPED ? Math.sin(time * 3.6 + s.phase) * 0.012 : 0;
  const sy = 1 + s.squash + breath;
  // Volume is kept: taller is thinner.
  return { rotation: s.lean, scaleX: 1 / Math.sqrt(sy), scaleY: sy, bob, braked };
}

/**
 * Position along a run (0..1 in, 0..1 out) with a quick start, a steady pace and a long brake: the speed is a trapezium
 * (18% accelerating, 30% braking), so a stop has weight instead of the even glide of a sine curve.
 */
export function runEase(t: number, accel = 0.18, brake = 0.3): number {
  t = clamp(t, 0, 1);
  const vmax = 1 / (1 - accel / 2 - brake / 2);
  if (t < accel) return (vmax * t * t) / (2 * accel);
  if (t > 1 - brake) return 1 - (vmax * (1 - t) * (1 - t)) / (2 * brake);
  return vmax * (accel / 2 + (t - accel));
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
