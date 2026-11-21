import * as THREE from 'three';

/** Colours of one comic big-head player (hex numbers). */
export interface PlayerLook {
  shirt: number;
  shorts: number;
  skin: number;
  hair: number;
  racket: number;
  /** Optional headband colour. */
  band?: number;
}

/** The strokes the character can play. */
export type Stroke = 'forehand' | 'backhand' | 'volley' | 'lob' | 'serve' | 'smash' | 'bandeja' | 'vibora' | 'bajada';
export const STROKES: Stroke[] = ['forehand', 'backhand', 'volley', 'lob', 'serve', 'smash', 'bandeja', 'vibora', 'bajada'];

/** Speed (m/s) a player runs at when he walks to a new spot. */
const RUN_SPEED = 8;

// ---- body proportions (metres): a stylised athlete with a big comic head ----
const THIGH = 0.39;
const SHIN = 0.39;
const FOOT = 0.08;
const WAIST = 0.07; // hips -> spine pivot
const NECK = 0.4; // spine pivot -> neck
const SHOULDER_Y = 0.35; // spine pivot -> shoulder line
const SHOULDER_X = 0.23;
const UPPER = 0.29;
const FORE = 0.27;
const HEAD_R = 0.26;

/**
 * Joint angles of the whole body (radians; metres for `jump`). Conventions, for a body that looks along local +Z:
 * a positive rotation about X tips +Y towards +Z, so a hanging arm goes BACK with positive `sx` and UP/FORWARD with negative
 * `sx`; the racket arm is the right arm, whose outside is local -X (negative `sz` lifts it sideways). A positive `twist`
 * turns the right shoulder forward, a negative one winds it back. Thigh `rt`/`lt` is hip flexion (forward positive), knee
 * `rk`/`lk` bends the shin back.
 */
export interface Pose {
  lean: number;
  twist: number;
  hip: number;
  head: number;
  /** Racket arm: shoulder pitch, shoulder side lift, upper-arm roll, elbow, wrist. */
  sx: number;
  sz: number;
  sy: number;
  ex: number;
  wx: number;
  /** Free arm: shoulder pitch, side lift, elbow. */
  lsx: number;
  lsz: number;
  lex: number;
  rt: number;
  rk: number;
  lt: number;
  lk: number;
  jump: number;
}

export const READY: Pose = {
  lean: 0.14, twist: 0.1, hip: 0, head: -0.1,
  sx: -0.5, sz: -0.2, sy: 0, ex: -1.25, wx: 0.1,
  lsx: -0.35, lsz: 0.25, lex: -0.8,
  rt: 0.5, rk: 0.85, lt: 0.4, lk: 0.7, jump: 0,
};

type Key = [number, Partial<Pose>];
interface StrokeDef {
  /** Seconds from the start of the swing to the moment the racket meets the ball. */
  contact: number;
  keys: Key[];
}

/** Keyframes per stroke (times in seconds; the last key returns to READY). Poses not listed fall back to READY. */
const STROKE_DEFS: Record<Stroke, StrokeDef> = {
  forehand: {
    contact: 0.2,
    keys: [
      [0, {}],
      [0.1, { twist: -0.85, hip: -0.5, lean: 0.1, sx: 0.5, sz: -0.9, ex: -1.0, wx: -0.2, lsx: -0.9, lsz: 0.7, lex: -0.4, rt: 0.7, rk: 1.0, lt: 0.2, lk: 0.5 }],
      [0.2, { twist: 0.25, hip: 0.15, lean: 0.22, sx: -1.15, sz: -0.55, ex: -0.3, wx: 0, lsx: -0.5, lsz: 0.9, lex: -0.5, rt: 0.35, rk: 0.8, lt: 0.7, lk: 0.9 }],
      [0.4, { twist: 1.0, hip: 0.6, lean: 0.12, sx: -1.15, sz: 1.0, ex: -2.0, wx: 0.3, lsx: -0.2, lsz: 0.4, lex: -0.9, rt: 0.2, rk: 0.4, lt: 0.7, lk: 0.7 }],
      [0.6, {}],
    ],
  },
  backhand: {
    contact: 0.2,
    keys: [
      [0, {}],
      [0.1, { twist: 0.95, hip: 0.5, lean: 0.12, sx: -0.9, sz: 0.95, ex: -1.6, wx: 0.3, lsx: 0.2, lsz: 1.0, lex: -0.3, rt: 0.2, rk: 0.6, lt: 0.7, lk: 1.0 }],
      [0.2, { twist: -0.1, hip: -0.1, lean: 0.2, sx: -1.25, sz: -0.2, ex: -0.25, wx: 0, lsx: 0.3, lsz: 1.2, lex: -0.2, rt: 0.7, rk: 0.9, lt: 0.3, lk: 0.7 }],
      [0.4, { twist: -0.9, hip: -0.5, lean: 0.1, sx: -1.35, sz: -1.2, ex: -0.5, wx: 0.1, lsx: 0.3, lsz: 1.3, lex: -0.2, rt: 0.6, rk: 0.7, lt: 0.2, lk: 0.5 }],
      [0.6, {}],
    ],
  },
  volley: {
    contact: 0.12,
    keys: [
      [0, {}],
      [0.06, { twist: -0.35, hip: -0.15, sx: -0.4, sz: -0.85, ex: -1.3, wx: 0, lsx: -0.5, lsz: 0.6, rt: 0.55, rk: 0.95, lt: 0.35, lk: 0.7 }],
      [0.12, { twist: 0.1, hip: 0.05, lean: 0.25, sx: -1.2, sz: -0.5, ex: -0.75, wx: 0, lsx: -0.3, lsz: 0.7, rt: 0.35, rk: 0.8, lt: 0.7, lk: 0.9 }],
      [0.26, { twist: 0.3, lean: 0.2, sx: -1.3, sz: -0.2, ex: -0.9, wx: 0.1, rt: 0.45, rk: 0.85, lt: 0.6, lk: 0.85 }],
      [0.4, {}],
    ],
  },
  lob: {
    contact: 0.24,
    keys: [
      [0, {}],
      [0.12, { twist: -0.5, hip: -0.3, lean: 0.25, sx: 0.55, sz: -0.5, ex: -0.6, wx: -0.3, lsx: -0.4, lsz: 0.7, rt: 0.9, rk: 1.5, lt: 0.5, lk: 1.0 }],
      [0.24, { twist: 0.15, hip: 0.1, lean: 0.0, sx: -1.9, sz: -0.4, ex: -0.3, wx: 0.2, lsx: -0.5, lsz: 0.9, lex: -0.5, rt: 0.35, rk: 0.5, lt: 0.2, lk: 0.2, jump: 0.04 }],
      [0.46, { twist: 0.5, hip: 0.3, lean: -0.05, sx: -2.4, sz: -0.2, ex: -0.8, wx: 0.3, rt: 0.2, rk: 0.4, lt: 0.2, lk: 0.5 }],
      [0.7, {}],
    ],
  },
  serve: {
    contact: 0.46,
    keys: [
      [0, {}],
      [0.18, { twist: -0.55, hip: -0.3, lean: 0.0, sx: 0.2, sz: -1.0, ex: -1.5, wx: 0, lsx: -2.7, lsz: 0.25, lex: -0.1, rt: 0.35, rk: 0.7, lt: 0.35, lk: 0.7 }],
      [0.34, { twist: -0.85, hip: -0.5, lean: -0.12, sx: -1.9, sz: -1.3, ex: -2.3, wx: 0.5, lsx: -2.9, lsz: 0.2, lex: -0.1, rt: 0.5, rk: 1.2, lt: 0.5, lk: 1.2 }],
      [0.46, { twist: 0.25, hip: 0.2, lean: -0.05, sx: -3.0, sz: -0.3, ex: -0.1, wx: 0, lsx: -1.2, lsz: 0.6, lex: -0.9, rt: 0.1, rk: 0.1, lt: 0.1, lk: 0.1, jump: 0.14 }],
      [0.68, { twist: 0.7, hip: 0.4, lean: 0.42, sx: -1.2, sz: 0.1, ex: -0.8, wx: 0.2, lsx: -0.2, lsz: 0.5, lex: -0.9, rt: 0.5, rk: 0.9, lt: -0.3, lk: 0.3 }],
      [0.95, {}],
    ],
  },
  smash: {
    contact: 0.36,
    keys: [
      [0, {}],
      [0.16, { twist: -0.7, hip: -0.4, lean: -0.1, sx: -1.5, sz: -1.2, ex: -2.4, wx: 0.4, lsx: -2.6, lsz: 0.35, lex: -0.1, rt: 0.45, rk: 1.1, lt: 0.35, lk: 1.0 }],
      [0.36, { twist: 0.3, hip: 0.2, lean: -0.1, sx: -3.0, sz: -0.3, ex: -0.1, wx: 0, lsx: -1.4, lsz: 0.55, lex: -0.9, rt: 0.15, rk: 0.15, lt: 0.15, lk: 0.15, jump: 0.2 }],
      [0.58, { twist: 0.8, hip: 0.45, lean: 0.5, sx: -1.0, sz: 0.2, ex: -0.7, wx: 0.2, lsx: -0.2, lsz: 0.5, lex: -0.9, rt: 0.6, rk: 1.0, lt: -0.2, lk: 0.4 }],
      [0.85, {}],
    ],
  },
  bandeja: {
    contact: 0.3,
    keys: [
      [0, {}],
      [0.15, { twist: -1.0, hip: -0.55, lean: 0.05, sx: -2.5, sz: -1.1, ex: -1.7, wx: 0.3, lsx: -1.5, lsz: 0.9, lex: -0.5, rt: 0.5, rk: 0.9, lt: 0.3, lk: 0.7 }],
      [0.3, { twist: -0.1, hip: -0.1, lean: 0.12, sx: -2.5, sz: -0.5, ex: -0.5, wx: 0, lsx: -1.2, lsz: 0.9, lex: -0.6, rt: 0.4, rk: 0.8, lt: 0.5, lk: 0.9 }],
      [0.5, { twist: 0.6, hip: 0.3, lean: 0.25, sx: -1.5, sz: 0.4, ex: -1.0, wx: 0.3, lsx: -0.4, lsz: 0.7, lex: -0.8, rt: 0.5, rk: 0.8, lt: 0.4, lk: 0.7 }],
      [0.75, {}],
    ],
  },
  vibora: {
    contact: 0.28,
    keys: [
      [0, {}],
      [0.14, { twist: -1.2, hip: -0.7, lean: 0.05, sx: -2.6, sz: -1.2, ex: -1.9, wx: 0.4, lsx: -1.4, lsz: 1.0, lex: -0.5, rt: 0.6, rk: 1.0, lt: 0.3, lk: 0.8 }],
      [0.28, { twist: 0.1, hip: 0.1, lean: 0.15, sx: -2.4, sz: -0.4, ex: -0.4, wx: -0.1, lsx: -1.1, lsz: 0.9, lex: -0.5, rt: 0.45, rk: 0.8, lt: 0.55, lk: 0.9 }],
      [0.5, { twist: 1.0, hip: 0.6, lean: 0.35, sx: -1.2, sz: 0.5, ex: -1.2, wx: 0.4, lsx: -0.3, lsz: 0.6, lex: -0.9, rt: 0.5, rk: 0.9, lt: 0.35, lk: 0.7 }],
      [0.78, {}],
    ],
  },
  bajada: {
    contact: 0.26,
    keys: [
      [0, {}],
      [0.14, { twist: -0.95, hip: -0.55, lean: 0.12, sx: -0.3, sz: -1.3, ex: -1.6, wx: 0.3, lsx: -0.9, lsz: 0.8, lex: -0.4, rt: 0.7, rk: 1.2, lt: 0.2, lk: 0.7 }],
      [0.26, { twist: 0.3, hip: 0.2, lean: 0.25, sx: -2.0, sz: -0.6, ex: -0.3, wx: 0, lsx: -0.5, lsz: 0.9, lex: -0.6, rt: 0.3, rk: 0.7, lt: 0.7, lk: 0.9, jump: 0.06 }],
      [0.48, { twist: 1.1, hip: 0.65, lean: 0.4, sx: -1.5, sz: 0.4, ex: -1.2, wx: 0.3, lsx: -0.2, lsz: 0.5, lex: -0.9, rt: 0.4, rk: 0.8, lt: 0.6, lk: 0.8 }],
      [0.75, {}],
    ],
  },
};

const KEYS = Object.keys(READY) as (keyof Pose)[];
const smooth = (u: number): number => u * u * (3 - 2 * u);

function lerpPose(a: Pose, b: Pose, u: number): Pose {
  const out = { ...a };
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * u;
  return out;
}

/** Duration of a stroke in seconds. */
export const strokeDuration = (s: Stroke): number => STROKE_DEFS[s].keys[STROKE_DEFS[s].keys.length - 1][0];
/** Seconds from the start of a stroke until the racket meets the ball. */
export const strokeContact = (s: Stroke): number => STROKE_DEFS[s].contact;

/** The pose of a stroke `t` seconds after it started (READY after it ended). Pure. */
export function strokePose(stroke: Stroke, t: number): Pose {
  const keys = STROKE_DEFS[stroke].keys;
  if (t <= 0) return { ...READY, ...keys[0][1] };
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, p0] = keys[i - 1];
      const [t1, p1] = keys[i];
      return lerpPose({ ...READY, ...p0 }, { ...READY, ...p1 }, smooth((t - t0) / (t1 - t0)));
    }
  }
  return { ...READY };
}

/** A run cycle at `phase` (radians): legs scissor, knees fold, arms pump against the legs. Pure. */
export function runPose(phase: number): Pose {
  const s = Math.sin(phase);
  const c = Math.sin(phase + Math.PI);
  const fold = (p: number): number => 0.35 + 1.1 * Math.max(0, Math.sin(p + 1.9));
  return {
    ...READY,
    lean: 0.3,
    twist: s * 0.18,
    hip: -s * 0.12,
    head: -0.25,
    sx: -0.7 + c * 0.55,
    sz: -0.2,
    ex: -1.5,
    wx: 0.1,
    lsx: -0.5 - c * 0.55,
    lsz: 0.2,
    lex: -1.3,
    rt: s * 0.85 + 0.1,
    rk: fold(phase),
    lt: c * 0.85 + 0.1,
    lk: fold(phase + Math.PI),
  };
}

const std = (color: number, roughness = 0.7): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });

function capsule(r: number, len: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 6, 14), mat);
}

/** A limb segment that hangs down from its pivot (pivot at the top, mesh centred below it). */
function segment(r: number, len: number, mat: THREE.Material): THREE.Mesh {
  const m = capsule(r, len, mat);
  m.position.y = -len / 2;
  return m;
}

/**
 * A stylised player with a jointed skeleton (hips, waist, neck, shoulders, elbows, wrists, hips, knees, ankles) driven by
 * poses: a ready stance, a run cycle and nine strokes. Feet are at y = 0 and stay planted when he crouches; the front of
 * the body is local +Z. World position is in three.js units (x across, y up, z along the court with the net at 0);
 * `Court3D` converts from court metres.
 */
export class Player3D {
  readonly group = new THREE.Group();
  private readonly hipsRoot = new THREE.Group();
  private readonly pelvis = new THREE.Group();
  private readonly waist = new THREE.Group();
  private readonly neck = new THREE.Group();
  private readonly arm = { sh: new THREE.Group(), el: new THREE.Group(), wr: new THREE.Group() };
  private readonly freeArm = { sh: new THREE.Group(), el: new THREE.Group() };
  private readonly leg = [
    { hip: new THREE.Group(), knee: new THREE.Group(), ankle: new THREE.Group() },
    { hip: new THREE.Group(), knee: new THREE.Group(), ankle: new THREE.Group() },
  ];
  private target = new THREE.Vector3();
  private stroke: Stroke | null = null;
  private strokeT = 0;
  private blend = 0;
  private runPhase = 0;
  private moving = false;
  private pose: Pose = { ...READY };
  private idleT = Math.random() * 10;

  constructor(look: PlayerLook) {
    const skin = std(look.skin, 0.55);
    const shirt = std(look.shirt, 0.65);
    const shorts = std(look.shorts, 0.75);
    const sock = std(0xf4f4f4, 0.8);
    const shoe = std(0xfafafa, 0.5);
    const sole = std(0x2a2f3a, 0.8);

    this.group.add(this.hipsRoot);
    this.hipsRoot.add(this.pelvis);

    // Pelvis and shorts.
    const pelvisMesh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), shorts);
    pelvisMesh.scale.set(1.15, 0.8, 0.85);
    pelvisMesh.position.y = 0.01;
    this.pelvis.add(pelvisMesh);

    // Legs: thigh (skin + shorts leg), shin (skin + sock), shoe. The legs hang from the hips root, so the pelvis can turn without turning the feet.
    [-1, 1].forEach((side, i) => {
      const l = this.leg[i];
      l.hip.position.set(side * 0.1, 0, 0);
      this.hipsRoot.add(l.hip);
      l.hip.add(segment(0.068, THIGH, skin));
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.096, 0.27, 14), shorts);
      sl.position.y = -0.14;
      l.hip.add(sl);
      l.knee.position.y = -THIGH;
      l.hip.add(l.knee);
      l.knee.add(segment(0.055, SHIN, skin));
      const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.17, 12), sock);
      sk.position.y = -SHIN + 0.1;
      l.knee.add(sk);
      l.ankle.position.y = -SHIN;
      l.knee.add(l.ankle);
      const sh = capsule(0.062, 0.26, shoe);
      sh.rotation.x = Math.PI / 2;
      sh.position.set(0, -0.025, 0.06);
      sh.scale.set(1, 1, 0.9);
      const so = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.022, 0.255), sole);
      so.position.set(0, -0.075, 0.06);
      l.ankle.add(sh, so);
    });

    // Waist, chest, neck, head.
    this.waist.position.y = WAIST;
    this.pelvis.add(this.waist);
    const abdomen = capsule(0.15, 0.3, shirt);
    abdomen.scale.set(1.1, 1, 0.78);
    abdomen.position.y = 0.1;
    const chest = capsule(0.18, 0.36, shirt);
    chest.scale.set(1.28, 1, 0.82);
    chest.position.y = 0.26;
    this.waist.add(abdomen, chest);

    this.neck.position.y = NECK;
    this.waist.add(this.neck);
    const neckMesh = capsule(0.055, 0.14, skin);
    neckMesh.position.y = 0.02;
    this.neck.add(neckMesh);
    const head = new THREE.Group();
    head.position.y = 0.2 + HEAD_R * 0.55;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 28, 20), skin);
    skull.scale.set(1, 1.04, 1);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R * 1.04, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), std(look.hair, 0.9));
    hair.position.y = 0.012;
    hair.rotation.x = -0.28;
    const white = std(0xffffff, 0.3);
    const dark = std(0x14110f, 0.3);
    for (const sx of [-1, 1]) {
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 10), white);
      eyeW.position.set(sx * 0.098, 0.03, HEAD_R * 0.86);
      eyeW.scale.set(1, 1.15, 0.6);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), dark);
      pupil.position.set(sx * 0.098, 0.03, HEAD_R * 0.86 + 0.026);
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.07, 3, 8), std(look.hair, 0.9));
      brow.rotation.z = Math.PI / 2 + sx * 0.18;
      brow.position.set(sx * 0.098, 0.1, HEAD_R * 0.9);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), skin);
      ear.position.set(sx * HEAD_R * 0.97, -0.01, 0);
      ear.scale.set(0.5, 1, 0.8);
      head.add(eyeW, pupil, brow, ear);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 8), skin);
    nose.position.set(0, -0.02, HEAD_R * 0.98);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0085, 6, 14, Math.PI), dark);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -0.09, HEAD_R * 0.9);
    head.add(skull, hair, nose, mouth);
    if (look.band !== undefined) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(HEAD_R * 0.99, 0.022, 8, 28), std(look.band, 0.6));
      band.rotation.x = Math.PI / 2 - 0.12;
      band.position.y = 0.12;
      head.add(band);
    }
    this.neck.add(head);

    // Arms: shoulder -> upper arm (sleeve + skin) -> elbow -> forearm -> wrist. The racket arm is the right arm (local -X).
    const buildArm = (side: number, a: { sh: THREE.Group; el: THREE.Group }): void => {
      a.sh.position.set(side * SHOULDER_X, SHOULDER_Y, 0);
      this.waist.add(a.sh);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), shirt);
      a.sh.add(ball);
      a.sh.add(segment(0.05, UPPER, skin));
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.07, 0.16, 12), shirt);
      sleeve.position.y = -0.08;
      a.sh.add(sleeve);
      a.el.position.y = -UPPER;
      a.sh.add(a.el);
      a.el.add(segment(0.043, FORE, skin));
    };
    buildArm(-1, this.arm);
    buildArm(1, this.freeArm);

    // Wrist, hand and the racket (handle, throat, round solid head with the face towards local +/-X).
    this.arm.wr.position.y = -FORE;
    this.arm.el.add(this.arm.wr);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), skin);
    this.arm.wr.add(hand);
    const racket = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.2, 10), std(0x1d1d22, 0.6));
    handle.position.y = -0.03;
    const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.12, 10), std(look.racket, 0.4));
    throat.position.y = -0.17;
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.036, 28), std(look.racket, 0.35));
    frame.rotation.z = Math.PI / 2;
    frame.scale.set(1, 1, 1.18);
    frame.position.y = -0.35;
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.042, 24), std(0x16161a, 0.5));
    face.rotation.z = Math.PI / 2;
    face.scale.set(1, 1, 1.18);
    face.position.y = -0.35;
    racket.add(handle, throat, frame, face);
    racket.rotation.x = -0.25;
    this.arm.wr.add(racket);

    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.apply(READY);
  }

  /** Teleport to a spot (three.js units). */
  snap(x: number, z: number): void {
    this.group.position.set(x, 0, z);
    this.target.set(x, 0, z);
    this.moving = false;
  }

  /** Walk to a spot. */
  moveTo(x: number, z: number): void {
    this.target.set(x, 0, z);
  }

  /** Look towards +Z (angle 0) or -Z (angle PI), with a small turn towards a ball at x. */
  face(towardsPositiveZ: boolean, ballX: number): void {
    const base = towardsPositiveZ ? 0 : Math.PI;
    const turn = THREE.MathUtils.clamp((ballX - this.group.position.x) * 0.06, -0.5, 0.5);
    this.group.rotation.y = base + (towardsPositiveZ ? -turn : turn);
  }

  /** Starts a stroke (a forehand by default). The racket meets the ball `strokeContact(stroke)` seconds later. */
  swing(stroke: Stroke = 'forehand'): void {
    this.stroke = stroke;
    this.strokeT = 0;
  }

  /** Freezes the body in a stroke at time `t` (seconds), for viewers and screenshots. */
  showStroke(stroke: Stroke, t: number): void {
    this.stroke = null;
    this.moving = false;
    this.apply(strokePose(stroke, t));
  }

  /** Freezes the body in the run cycle at `phase`. */
  showRun(phase: number): void {
    this.stroke = null;
    this.apply(runPose(phase));
  }

  update(dt: number): void {
    const pos = this.group.position;
    const to = this.target.clone().sub(pos);
    to.y = 0;
    const dist = to.length();
    this.moving = dist > 0.05;
    if (this.moving) {
      const step = Math.min(dist, RUN_SPEED * dt);
      pos.addScaledVector(to.normalize(), step);
      this.runPhase += dt * 13;
    }
    this.idleT += dt;

    // Base pose: running, or breathing in the ready stance.
    let base: Pose;
    if (this.moving) base = runPose(this.runPhase);
    else {
      const b = Math.sin(this.idleT * 2.4);
      base = { ...READY, lean: READY.lean + b * 0.015, rk: READY.rk + b * 0.04, lk: READY.lk + b * 0.04, sx: READY.sx + b * 0.03 };
    }

    // A stroke takes over the whole body, blended in and out so nothing snaps.
    let pose = base;
    if (this.stroke) {
      this.strokeT += dt;
      if (this.strokeT >= strokeDuration(this.stroke)) this.stroke = null;
    }
    this.blend = THREE.MathUtils.clamp(this.blend + (this.stroke ? 1 : -1) * dt * 14, 0, 1);
    if (this.stroke) pose = lerpPose(base, strokePose(this.stroke, this.strokeT), smooth(this.blend));
    else if (this.blend > 0) pose = lerpPose(base, this.pose, smooth(this.blend));
    this.apply(pose);
  }

  /** Writes a pose into the skeleton and keeps the lowest foot on the ground. */
  private apply(p: Pose): void {
    this.pose = p;
    const legs = [
      { a: p.rt, k: p.rk },
      { a: p.lt, k: p.lk },
    ];
    let drop = 0;
    legs.forEach((l, i) => {
      const L = this.leg[i];
      L.hip.rotation.set(-l.a, 0, (i === 0 ? -1 : 1) * 0.07);
      L.knee.rotation.x = l.k;
      L.ankle.rotation.x = l.a - l.k;
      drop = Math.max(drop, THIGH * Math.cos(l.a) + SHIN * Math.cos(l.a - l.k));
    });
    this.hipsRoot.position.y = drop + FOOT + p.jump;

    this.pelvis.rotation.y = p.hip;
    this.waist.rotation.set(p.lean, p.twist - p.hip, 0);
    this.neck.rotation.x = p.head - p.lean * 0.5;
    this.neck.rotation.y = -(p.twist - p.hip) * 0.45;

    this.arm.sh.rotation.set(p.sx, p.sy, p.sz);
    this.arm.el.rotation.x = p.ex;
    this.arm.wr.rotation.x = p.wx;
    this.freeArm.sh.rotation.set(p.lsx, 0, p.lsz);
    this.freeArm.el.rotation.x = p.lex;
  }
}
