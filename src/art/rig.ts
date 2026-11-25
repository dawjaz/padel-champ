// The character rig of the match (stage B): a player's pose is rebuilt every frame from keyframes with easing (a stroke has a wind-up,
// a snap into the ball, a short hit-stop, a follow-through that overshoots and settles) or follows a pose that changes all the time
// (run and side-step cycles, smoothed). The head trails fast movements a little. Pure (no Phaser): MatchScene asks for `pose` every
// frame and draws it (see `drawRig` there). Balance of the strokes is not here: only how they look.

import { mixPose, POSES, type PoseSpec } from './toon/character';
import type { PoseName } from './pose';

type Pt = [number, number];
export type Ease = (t: number) => number;
export const lin: Ease = (t) => t;
export const inOut: Ease = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
export const easeOut: Ease = (t) => 1 - (1 - t) ** 3;
export const easeIn: Ease = (t) => t ** 3;

/** One step of a sequence: how long after the previous step (ms), the pose to reach and the ease to reach it with. */
export type Step = [number, PoseSpec, Ease];

interface Key {
  at: number;
  pose: PoseSpec;
  ease: Ease;
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Time constant (ms) with which a driven pose (run, shuffle) is followed. */
const DRIVE_TAU = 45;

export class Rig {
  private keys: Key[] = [];
  private driven: PoseSpec | null = null;
  private out: PoseSpec;
  private lastHand: Pt;
  private lag: Pt = [0, 0];
  /** The last target given to `to` (a repeated call with the same target does not restart the glide). */
  private target: PoseSpec | null = null;

  constructor(start: PoseSpec = POSES.ready) {
    this.out = start;
    this.lastHand = start.hand;
  }

  /** The pose to draw now. */
  get pose(): PoseSpec {
    return this.out;
  }

  /** True while a sequence is playing (a stroke). */
  playing(now: number): boolean {
    return this.keys.length > 0 && this.keys[this.keys.length - 1].at > now;
  }

  /** Glides from the pose shown now to `pose` in `ms`. */
  to(now: number, pose: PoseSpec, ms: number, ease: Ease = inOut): void {
    if (!this.driven && this.target === pose && (this.playing(now) || this.out === pose)) return;
    this.target = pose;
    this.driven = null;
    this.keys = [
      { at: now, pose: this.out, ease: lin },
      { at: now + Math.max(1, ms), pose, ease },
    ];
  }

  /** Plays a sequence of steps from the pose shown now. */
  play(now: number, steps: Step[]): void {
    this.driven = null;
    this.target = null;
    let at = now;
    this.keys = [{ at, pose: this.out, ease: lin }];
    for (const [ms, pose, ease] of steps) {
      at += Math.max(1, ms);
      this.keys.push({ at, pose, ease });
    }
  }

  /** Follows a pose that changes every frame (a run or side-step cycle); the switch from the pose before is smoothed. */
  drive(pose: PoseSpec): void {
    this.driven = pose;
    this.keys = [];
    this.target = null;
  }

  /** Advances to `now` (ms); `dt` in ms. */
  update(now: number, dt: number): PoseSpec {
    let pose: PoseSpec;
    if (this.driven) {
      pose = mixPose(this.out, this.driven, 1 - Math.exp(-Math.max(0, dt) / DRIVE_TAU));
      pose = { ...pose, front: this.driven.front, racketBehind: this.driven.racketBehind };
    } else if (this.keys.length > 0) {
      pose = sampleKeys(this.keys, now);
      if (now >= this.keys[this.keys.length - 1].at) this.keys = [];
    } else {
      pose = this.out;
    }
    // The head trails the racket hand a little (secondary motion) and catches up.
    const s = Math.max(1, dt) / 1000;
    const vx = (pose.hand[0] - this.lastHand[0]) / s;
    const vy = (pose.hand[1] - this.lastHand[1]) / s;
    this.lastHand = pose.hand;
    const want: Pt = [clamp(-vx * 0.006, -6, 6), clamp(-vy * 0.004, -5, 5)];
    const k = 1 - Math.exp(-Math.max(0, dt) / 70);
    this.lag = [this.lag[0] + (want[0] - this.lag[0]) * k, this.lag[1] + (want[1] - this.lag[1]) * k];
    const still = Math.abs(this.lag[0]) < 0.15 && Math.abs(this.lag[1]) < 0.15;
    this.out = still && !pose.head ? pose : { ...pose, head: still ? pose.head : [R1(this.lag[0]), R1(this.lag[1])] };
    return this.out;
  }
}

const R1 = (v: number): number => Math.round(v * 10) / 10;

function sampleKeys(keys: Key[], now: number): PoseSpec {
  if (now <= keys[0].at) return keys[0].pose;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (now <= k.at) {
      const a = keys[i - 1];
      return mixPose(a.pose, k.pose, k.ease(clamp((now - a.at) / (k.at - a.at), 0, 1)));
    }
  }
  return keys[keys.length - 1].pose;
}

const tweak = (p: PoseSpec, d: { racket?: number; crouch?: number; lean?: number; hand?: Pt; left?: Pt; right?: Pt }): PoseSpec => ({
  ...p,
  racket: p.racket + (d.racket ?? 0),
  crouch: p.crouch + (d.crouch ?? 0),
  lean: p.lean + (d.lean ?? 0),
  hand: d.hand ? [p.hand[0] + d.hand[0], p.hand[1] + d.hand[1]] : p.hand,
  left: d.left ?? p.left,
  right: d.right ?? p.right,
});

const GROUND = POSES.ready.left[1];
const sideOf = (name: PoseName): number => (name.startsWith('bh') ? -1 : 1);

/** The preparation of a stroke, wound up further than the pose (anticipation). A smash is loaded on the left (take-off) leg. */
export function loadPose(name: PoseName): PoseSpec {
  const p = POSES[name];
  if (name === 'smashPrep') return tweak(p, { crouch: 8, racket: -10, left: [90, GROUND], right: [140, GROUND - 8] });
  if (!name.endsWith('Prep')) return p;
  const s = sideOf(name);
  return tweak(p, { crouch: 5, racket: 12 * s, lean: 3 * s, hand: [6 * s, -3] });
}

/** Hit-stop after contact (ms). */
export const HIT_STOP = 50;

/** The stroke from the moment of contact: snap into the hit pose, hold, overshoot the follow-through, settle, back to ready. */
export function strokeSteps(stance: 'fh' | 'bh' | 'ov' | 'fhv' | 'bhv'): Step[] {
  const hit = POSES[`${stance}Hit` as PoseName];
  const follow = POSES[`${stance}Follow` as PoseName];
  const s = stance.startsWith('bh') ? -1 : 1;
  const volley = stance === 'fhv' || stance === 'bhv';
  const over = tweak(follow, { racket: (volley ? 10 : -20) * s, hand: [-8 * s, volley ? 6 : -6], lean: -3 * s });
  return [
    [60, hit, easeIn],
    [HIT_STOP, hit, lin],
    [volley ? 110 : 150, over, easeOut],
    [130, follow, inOut],
    [volley ? 260 : 360, POSES.ready, inOut],
  ];
}

/**
 * The jumping smash from the moment of contact: in the air after the take-off from the left leg (right knee driven up), the racket
 * comes down across, the landing is on the left foot first with the knees giving, then both feet, then ready. The jump height itself
 * is the scene's (`airTime` ms in the air).
 */
export function smashSteps(airTime: number): Step[] {
  const air = POSES.smashHit;
  const followAir = { ...POSES.smashFollow, crouch: -20, left: air.left, right: air.right };
  const land = { ...POSES.smashFollow, crouch: 20, left: [94, GROUND] as Pt, right: [136, GROUND - 14] as Pt };
  const fall = Math.max(60, airTime - 60 - HIT_STOP);
  return [
    [60, air, easeIn],
    [HIT_STOP, air, lin],
    [fall, followAir, easeOut],
    [90, land, easeIn],
    [120, { ...land, crouch: 14, right: [136, GROUND] as Pt }, inOut],
    [320, POSES.ready, inOut],
  ];
}

/** The racket face's near and far ends in figure units (for the smear), from the pose (front / back views). */
export function racketEnds(P: PoseSpec): [Pt, Pt] {
  const at = (ly: number): Pt => {
    const r = (P.racket * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    const x = -s * ly + P.hand[0] - 12 * s;
    const y = c * ly + P.hand[1] + 12 * c;
    const L = (P.lean * Math.PI) / 180;
    const lc = Math.cos(L);
    const ls = Math.sin(L);
    return [lc * (x - 100) - ls * (y - 190) + 100, ls * (x - 100) + lc * (y - 190) + 190 + P.crouch];
  };
  return [at(-44), at(-100)];
}

/** A short text of a pose rounded to half units: two poses with the same signature look the same (no need to draw again). */
export function poseSignature(P: PoseSpec): string {
  const h = (v: number): number => Math.round(v * 2);
  const pt = (p: Pt | undefined): string => (p ? `${h(p[0])},${h(p[1])}` : '-');
  return [pt(P.hand), h(P.racket), pt(P.elbow), P.off === 'grip' ? 'g' : pt(P.off), pt(P.offElbow), h(P.lean), h(P.crouch), pt(P.left), pt(P.right), h((P.look ?? 0) * 10), pt(P.head), P.front ? 1 : 0, P.racketBehind ? 1 : 0].join('|');
}
