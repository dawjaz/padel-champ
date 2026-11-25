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
  /** The pose before the look and the head lag are added (what the keys and the drive produce). */
  private raw: PoseSpec;
  private lastHand: Pt;
  private lag: Pt = [0, 0];
  /** Where the head looks (-1..1) when nothing else sets it (the ball during a rally); null: as the pose says. */
  private lookAt: number | null = null;
  private lookNow = 0;
  /** The last target given to `to` (a repeated call with the same target does not restart the glide). */
  private target: PoseSpec | null = null;

  constructor(start: PoseSpec = POSES.ready) {
    this.out = start;
    this.raw = start;
    this.lastHand = start.hand;
  }

  /** The pose to draw now. */
  get pose(): PoseSpec {
    return this.out;
  }

  /** Turns the head towards `look` (-1..1, eased) while the pose has no look of its own; null stops it. */
  setLook(look: number | null): void {
    this.lookAt = look;
  }

  /** True while it follows a run or side-step cycle. */
  driving(): boolean {
    return this.driven !== null;
  }

  /** True while a sequence is playing (a stroke). */
  playing(now: number): boolean {
    return this.keys.length > 0 && this.keys[this.keys.length - 1].at > now;
  }

  /** Glides from the pose shown now to `pose` in `ms`. */
  to(now: number, pose: PoseSpec, ms: number, ease: Ease = inOut): void {
    if (!this.driven && this.target === pose && (this.playing(now) || this.raw === pose)) return;
    this.target = pose;
    this.driven = null;
    this.keys = [
      { at: now, pose: this.raw, ease: lin },
      { at: now + Math.max(1, ms), pose, ease },
    ];
  }

  /** Plays a sequence of steps from the pose shown now. */
  play(now: number, steps: Step[]): void {
    this.driven = null;
    this.target = null;
    let at = now;
    this.keys = [{ at, pose: this.raw, ease: lin }];
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
      pose = mixPose(this.raw, this.driven, 1 - Math.exp(-Math.max(0, dt) / DRIVE_TAU));
      pose = { ...pose, front: this.driven.front, racketBehind: this.driven.racketBehind };
    } else if (this.keys.length > 0) {
      pose = sampleKeys(this.keys, now);
      if (now >= this.keys[this.keys.length - 1].at) this.keys = [];
    } else {
      pose = this.raw;
    }
    this.raw = pose;
    // The head trails the racket hand a little (secondary motion) and catches up.
    const s = Math.max(1, dt) / 1000;
    const vx = (pose.hand[0] - this.lastHand[0]) / s;
    const vy = (pose.hand[1] - this.lastHand[1]) / s;
    this.lastHand = pose.hand;
    const want: Pt = [clamp(-vx * 0.006, -6, 6), clamp(-vy * 0.004, -5, 5)];
    const k = 1 - Math.exp(-Math.max(0, dt) / 70);
    this.lag = [this.lag[0] + (want[0] - this.lag[0]) * k, this.lag[1] + (want[1] - this.lag[1]) * k];
    if (this.lookAt !== null && !this.driven && !pose.look) {
      this.lookNow += (this.lookAt - this.lookNow) * (1 - Math.exp(-Math.max(0, dt) / 140));
      const l = Math.round(this.lookNow * 10) / 10;
      if (l !== 0) pose = { ...pose, look: l };
    } else this.lookNow = pose.look ?? 0;
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

/**
 * How the stroke follows the ball's height at contact (metres): a low ball is taken with a deep knee bend and the racket low, a high one
 * with the body stretched up and the racket high. 0.7..1.2 m is the comfortable middle (no change).
 */
export function forHeight(p: PoseSpec, height: number | undefined): PoseSpec {
  if (height === undefined) return p;
  const low = clamp((0.75 - height) / 0.45, 0, 1);
  const high = clamp((height - 1.2) / 0.6, 0, 1);
  if (low === 0 && high === 0) return p;
  return { ...p, crouch: p.crouch + 12 * low - 6 * high, hand: [p.hand[0], p.hand[1] + 22 * low - 20 * high], racket: p.racket + (p.racket >= 0 ? 1 : -1) * 14 * low };
}

/**
 * A lunge towards a ball wide of the player: a long step out with the leg on the ball's side (bent deep), the other leg stretched behind,
 * the hips low, the body over the front knee. `dir`: -1 or 1, the ball's side in the picture's own x; `reach` 0..1 how far.
 */
export function lungePose(p: PoseSpec, dir: number, reach = 1): PoseSpec {
  const k = clamp(reach, 0, 1);
  const crouch = Math.max(p.crouch, 14) + 10 * k;
  // the back leg is stretched (almost straight) from its hip, the front foot is planted well out, the knee bent over it
  const hipY = 198 + crouch;
  const backHip = dir > 0 ? 87 : 113;
  const frontHip = dir > 0 ? 113 : 87;
  const reachX = Math.sqrt(Math.max(0, 104 * 104 - (GROUND - hipY) ** 2));
  const back: [number, number] = [R(backHip - dir * reachX * (0.75 + 0.25 * k)), GROUND];
  const out: [number, number] = [R(frontHip + dir * (26 + 22 * k)), GROUND];
  return {
    ...p,
    crouch,
    lean: p.lean + dir * (4 + 4 * k),
    hand: [p.hand[0] + dir * 10 * k, p.hand[1] + 6 * k],
    left: dir > 0 ? back : out,
    right: dir > 0 ? out : back,
  };
}

const R = (v: number): number => Math.round(v);

/** Keeps the legs (and the depth of the hips) of a pose: a stroke played from a lunge stays in the lunge until it recovers. */
export function withLegs(p: PoseSpec, legs: PoseSpec | null): PoseSpec {
  if (!legs) return p;
  return { ...p, left: legs.left, right: legs.right, crouch: Math.max(p.crouch, legs.crouch), lean: (p.lean + legs.lean) / 2 };
}

/** The preparation of a stroke, wound up further than the pose (anticipation). A smash is loaded on the left (take-off) leg. */
export function loadPose(name: PoseName, height?: number): PoseSpec {
  const p = POSES[name];
  if (name === 'smashPrep') return tweak(p, { crouch: 8, racket: -10, left: [90, GROUND], right: [140, GROUND - 8] });
  if (!name.endsWith('Prep')) return p;
  const s = sideOf(name);
  return forHeight(tweak(p, { crouch: 5, racket: 12 * s, lean: 3 * s, hand: [6 * s, -3] }), height);
}

/** Hit-stop after contact (ms): the pose holds and the ball stays on the racket. */
export const HIT_STOP = 50;

/**
 * The stroke from the moment of contact: snap into the hit pose, hold, overshoot the follow-through, settle, back to ready.
 * `height`: the ball's height at contact (see `forHeight`); `legs`: a lunge to keep until the recovery.
 */
export function strokeSteps(stance: 'fh' | 'bh' | 'ov' | 'fhv' | 'bhv', height?: number, legs: PoseSpec | null = null): Step[] {
  const hit = withLegs(forHeight(POSES[`${stance}Hit` as PoseName], height), legs);
  const follow = withLegs(forHeight(POSES[`${stance}Follow` as PoseName], height), legs);
  const s = stance.startsWith('bh') ? -1 : 1;
  const volley = stance === 'fhv' || stance === 'bhv';
  const over = tweak(follow, { racket: (volley ? 10 : -20) * s, hand: [-8 * s, volley ? 6 : -6], lean: -3 * s });
  return [
    [60, hit, easeIn],
    [HIT_STOP, hit, lin],
    [volley ? 110 : 150, over, easeOut],
    [130, follow, inOut],
    [legs ? 420 : volley ? 260 : 360, POSES.ready, inOut],
  ];
}

/** The split step as the opponent hits: a small hop with the feet together, a landing wide and low, ready (the scene lifts the body). */
export function splitSteps(): Step[] {
  const up = { ...POSES.ready, crouch: 4, left: [80, GROUND - 4] as Pt, right: [120, GROUND - 4] as Pt };
  const land = { ...POSES.ready, crouch: 18, left: [56, GROUND] as Pt, right: [144, GROUND] as Pt };
  return [
    [70, up, easeOut],
    [90, land, easeIn],
    [200, POSES.ready, inOut],
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
  return [pt(P.hand), h(P.racket), pt(P.elbow), P.off === 'grip' ? 'g' : pt(P.off), pt(P.offElbow), h(P.lean), h(P.crouch), pt(P.left), pt(P.right), h((P.look ?? 0) * 10), pt(P.head), P.front ? 1 : 0, P.racketBehind ? 1 : 0, P.mood ?? ''].join('|');
}

// ---------- stage D: reactions, fatigue, celebrations ----------

const pose = (p: Partial<PoseSpec>): PoseSpec => ({ ...POSES.ready, ...p });

// In the front and back views `lean` tilts the body sideways, so a forward bend is shown by the hips and a lowered head (`head`).

/** A fist pumped up with the free hand, the racket down by the side: the player who has just won the point. */
export function fistSteps(big = true): Step[] {
  const up = pose({ off: [50, big ? 24 : 62], hand: [146, 176], racket: 150, crouch: 4, lean: -3 });
  const down = pose({ off: [60, big ? 70 : 88], hand: [146, 180], racket: 155, crouch: 10, lean: 1 });
  return big
    ? [[180, up, easeOut], [120, down, inOut], [140, up, easeOut], [500, up, lin], [400, POSES.ready, inOut]]
    : [[220, down, easeOut], [160, up, easeOut], [400, up, lin], [380, POSES.ready, inOut]];
}

/** A high five with the partner (`dir`: the partner's side in the picture's own x): the hand on that side goes up and out. */
export function highFiveSteps(dir: number): Step[] {
  const reach = dir > 0 ? pose({ hand: [168, 26], racket: 20, off: [60, 160], lean: 6, crouch: 4 }) : pose({ off: [30, 26], hand: [140, 170], racket: 150, lean: -6, crouch: 4 });
  const slap = dir > 0 ? { ...reach, hand: [176, 34] as Pt } : { ...reach, off: [22, 34] as Pt };
  return [[220, reach, easeOut], [80, slap, easeIn], [500, reach, lin], [380, POSES.ready, inOut]];
}

/** Both hands on the head (a mistake), then the racket hangs and the shoulders drop. */
export function frustrationSteps(): Step[] {
  const head = pose({ hand: [124, 46], racket: 140, racketBehind: true, off: [76, 46], crouch: 2, lean: 0, look: 0, mood: 'sad' });
  const slump = pose({ hand: [138, 196], racket: 168, off: [64, 190], crouch: 6, lean: 0, head: [0, 6], mood: 'sad' });
  return [[260, head, easeOut], [550, head, lin], [300, slump, inOut], [600, slump, lin], [400, POSES.ready, inOut]];
}

/** The shoulders drop and the racket hangs: a point lost to a winner. */
export function disappointSteps(): Step[] {
  const slump = pose({ hand: [138, 198], racket: 170, off: [64, 192], crouch: 6, lean: 0, head: [0, 6], mood: 'sad' });
  return [[320, slump, inOut], [900, slump, lin], [420, POSES.ready, inOut]];
}

/** An exhausted player between points: hands on the knees, bent forward. */
export function tiredSteps(): Step[] {
  const knees = pose({ hand: [136, 208], racket: 172, off: [64, 208], crouch: 26, lean: 0, head: [0, 10], left: [60, GROUND], right: [140, GROUND], mood: 'sad' });
  return [[420, knees, inOut], [1100, knees, lin], [500, POSES.ready, inOut]];
}

/** A tired ready position: lower, bent forward, the racket lower (`tired` 0..1). */
export function tiredReady(tired: number): PoseSpec {
  if (tired <= 0) return POSES.ready;
  return { ...POSES.ready, crouch: POSES.ready.crouch + 6 * tired, head: [0, R(4 * tired)], hand: [POSES.ready.hand[0], POSES.ready.hand[1] + 18 * tired], racket: POSES.ready.racket + 20 * tired };
}

/** The racket raised high (a game won); `both`: both arms up (the match). */
export function celebrateSteps(both: boolean): Step[] {
  const up = both ? pose({ hand: [150, 4], racket: 6, off: [50, 10], crouch: 2, lean: -3 }) : pose({ hand: [148, 10], racket: 8, off: [64, 150], crouch: 4, lean: -2 });
  const bounce = { ...up, crouch: 14 };
  return both
    ? [[200, up, easeOut], [160, bounce, inOut], [160, up, easeOut], [160, bounce, inOut], [160, up, easeOut], [900, up, lin]]
    : [[220, up, easeOut], [700, up, lin], [400, POSES.ready, inOut]];
}
