import type { Appearance } from '../../game/types';
import { ellipsePath, luma, rotateAbout, scaleAbout, shadeHex, translate, type Mat, type Op, type PathOp, rectPath } from './ops';

/**
 * Toon character (about 4.5 heads tall, flat cel shading, dark outline), drawn in "character units": the
 * figure is 200 wide and about 340 tall, centre x = 100, feet at y = 334. Poses move the racket hand, the
 * off hand, the feet, the lean of the upper body and the crouch (see `POSES`); arms and legs are two-bone
 * limbs solved from those targets.
 */
export type ToonView = 'front' | 'back';

/** Same names as the old pixel characters, so the match can swap them one for one. */
export type ToonPose =
  | 'idle' | 'ready' | 'runA' | 'runB'
  | 'fhPrep' | 'fhHit' | 'fhFollow'
  | 'bhPrep' | 'bhHit' | 'bhFollow'
  | 'smashPrep' | 'smashHit' | 'smashFollow';

/** `idle` = the relaxed menu pose (arms down); `ready` = the athletic waiting stance of a match: wide, knees bent, racket in front. */
export const TOON_POSES: ToonPose[] = ['idle', 'ready', 'runA', 'runB', 'fhPrep', 'fhHit', 'fhFollow', 'bhPrep', 'bhHit', 'bhFollow', 'smashPrep', 'smashHit', 'smashFollow'];

type Pt = [number, number];

/**
 * Targets of a pose. Hands are in the upper body's own frame (the frame is leaned and lowered with the body); ankles are in
 * figure coordinates (sole of the ground = ankle y 304). The racket hand is the viewer's right one.
 */
export interface PoseSpec {
  /** Racket hand and the racket's tilt (degrees clockwise from pointing straight up). */
  hand: Pt;
  racket: number;
  /** Elbow of the racket arm when it must not be solved (the ready pose keeps its original look). */
  elbow?: Pt;
  /** Off hand: a point, or 'grip' = on the racket handle (two-handed backhand). */
  off: Pt | 'grip';
  offElbow?: Pt;
  /** Lean of the upper body in degrees (clockwise) about the waist, and how far it sinks (negative = rises in a jump). */
  lean: number;
  crouch: number;
  /** Ankles of the viewer's left and right leg. */
  left: Pt;
  right: Pt;
}

const GROUND = 304;
export const POSES: Record<ToonPose, PoseSpec> = {
  idle: { hand: [150, 190], racket: 16, elbow: [155, 148], off: [51, 202], offElbow: [47, 154], lean: 0, crouch: 0, left: [75, GROUND], right: [125, GROUND] },
  // Poses follow photos of pro players: wide base, deep knee bend, the racket in front of the body, the free arm out for balance.
  ready: { hand: [124, 150], racket: 10, off: 'grip', lean: 0, crouch: 22, left: [58, GROUND], right: [142, GROUND] },
  runA: { hand: [128, 152], racket: 14, off: [48, 150], lean: 4, crouch: 16, left: [82, 280], right: [134, GROUND] },
  runB: { hand: [128, 152], racket: 14, off: [48, 150], lean: -4, crouch: 16, left: [66, GROUND], right: [118, 280] },
  fhPrep: { hand: [172, 128], racket: 38, off: [28, 128], lean: 6, crouch: 24, left: [54, GROUND], right: [146, GROUND] },
  fhHit: { hand: [188, 158], racket: 96, off: [14, 126], lean: -2, crouch: 28, left: [50, GROUND], right: [150, GROUND] },
  fhFollow: { hand: [90, 92], racket: -36, off: [24, 142], lean: -8, crouch: 20, left: [60, GROUND], right: [140, GROUND] },
  bhPrep: { hand: [72, 152], racket: -46, off: 'grip', lean: -6, crouch: 24, left: [54, GROUND], right: [146, GROUND] },
  bhHit: { hand: [34, 160], racket: -84, off: 'grip', lean: 4, crouch: 28, left: [50, GROUND], right: [150, GROUND] },
  bhFollow: { hand: [60, 86], racket: -18, off: [168, 128], lean: -8, crouch: 18, left: [60, GROUND], right: [140, GROUND] },
  smashPrep: { hand: [158, 40], racket: -12, elbow: [180, 98], off: [38, 40], lean: 4, crouch: 22, left: [52, GROUND], right: [148, GROUND] },
  smashHit: { hand: [142, 32], racket: 4, off: [84, 128], lean: -2, crouch: -28, left: [72, 282], right: [134, 294] },
  smashFollow: { hand: [82, 132], racket: -70, off: [40, 120], lean: -8, crouch: 14, left: [58, GROUND], right: [142, GROUND] },
};

/** Two-bone solver: the middle joint of a limb from `a` to `b`, bending towards `down` (true) or up. */
function bend(a: Pt, b: Pt, l1: number, l2: number, pick: (p1: Pt, p2: Pt) => Pt): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.5);
  const ux = dx / (Math.hypot(dx, dy) || 1);
  const uy = dy / (Math.hypot(dx, dy) || 1);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const bx = a[0] + ux * along;
  const by = a[1] + uy * along;
  return pick([bx - uy * h, by + ux * h], [bx + uy * h, by - ux * h]);
}

export const OUTLINE = '#14213D';
/** x of the figure's centre line, y of the soles: scenes use these to place the picture. */
export const FIG = { cx: 100, feet: 334, top: -4 } as const;

export interface ToonLook {
  skin: string;
  hair: string;
  style: Appearance['hairStyle'];
  shirt: string;
  trim: string;
  bottom: string;
  bottomTrim: string;
  skirt: boolean;
  shoes: string;
  racket: string;
  racketShape: NonNullable<Appearance['racketShape']>;
  /** Body width factor (1 = male default). */
  build: number;
  female: boolean;
  band?: string;
  cap?: string;
  wristband?: string;
  eye: string;
  lip: string;
}

/** Derives everything the drawing needs from a game `Appearance`. */
export function lookOf(a: Appearance): ToonLook {
  const female = a.gender === 'female';
  return {
    skin: a.skin,
    hair: a.hairColor,
    style: a.hairStyle,
    shirt: a.shirt,
    trim: luma(a.shirt) > 0.62 ? '#14213D' : '#ffffff',
    bottom: a.bottom,
    bottomTrim: luma(a.bottom) > 0.6 ? shadeHex(a.bottom, 0.72) : '#ffffff',
    skirt: a.bottomStyle === 'skirt',
    shoes: a.shoes,
    racket: a.racket,
    racketShape: a.racketShape ?? 'teardrop',
    build: female ? 0.9 : 1,
    female,
    band: a.headband,
    cap: a.cap,
    wristband: a.wristband,
    eye: luma(a.skin) < 0.4 ? '#1a0d06' : '#3a2418',
    lip: female ? '#c2566a' : '#a8503e',
  };
}

const p = (d: string, o: Omit<PathOp, 'k' | 'd'> = {}): PathOp => ({ k: 'p', d, ...o });
const shape = (d: string, fill: string, ol = 2.6): PathOp => p(d, { fill, stroke: OUTLINE, sw: ol });
const R = (v: number): number => Math.round(v);

/** Stroked limbs with an outline: all outlines first, so joints between segments stay clean; then fills and a cel-shade line. */
function limbs(segs: Array<[string, number]>, color: string, sh = 0.28): Op[] {
  const sc = shadeHex(color, 0.8);
  const out: Op[] = segs.map(([d, w]) => p(d, { stroke: OUTLINE, sw: w + 5.2, cap: 'round' }));
  for (const [d, w] of segs) {
    out.push(p(d, { stroke: color, sw: w, cap: 'round' }));
    out.push(p(d, { stroke: sc, sw: w * sh, cap: 'round', a: 0.5, m: translate(w * 0.27, 0) }));
  }
  return out;
}

function racketOps(c: string, shape_: ToonLook['racketShape']): Op[] {
  const hi = shadeHex(c, 1.25);
  const face = {
    round: ellipsePath(0, -70, 24, 25),
    teardrop: 'M0 -100 C 20 -100 26 -80 24 -64 C 22 -48 10 -40 0 -40 C -10 -40 -22 -48 -24 -64 C -26 -80 -20 -100 0 -100 Z',
    diamond: 'M0 -104 C 14 -100 26 -78 26 -66 C 24 -52 10 -42 0 -38 C -10 -42 -24 -52 -26 -66 C -26 -78 -14 -100 0 -104 Z',
  }[shape_];
  const holes: Array<[number, number]> = [[-9, -84], [0, -86], [9, -84], [-14, -74], [-5, -74], [5, -74], [14, -74], [-14, -64], [-5, -64], [5, -64], [14, -64], [-9, -54], [0, -54], [9, -54]];
  return [
    p(rectPath(-3.4, -44, 6.8, 40, 3), { fill: '#1d2a4a', stroke: OUTLINE, sw: 2 }),
    p(rectPath(-3.4, -30, 6.8, 5), { fill: '#f2f2f2', a: 0.85 }),
    p(face, { fill: c, stroke: OUTLINE, sw: 8 }),
    p(face, { fill: '#fbfbf6', stroke: c, sw: 5 }),
    ...holes.map(([x, y]) => p(ellipsePath(x, y, 2.2, 2.2), { fill: shadeHex(c, 0.7), a: 0.8 })),
    p('M-14 -92 C -8 -97 6 -97 12 -92', { stroke: hi, sw: 2.5, cap: 'round', a: 0.9 }),
  ];
}

/** How far (figure units) a racket held in front of the body is moved to the side in the back view, so that it shows beside the body. */
const BACK_VIEW_SIDE_SHIFT = 22;
const HEAD_SCALE = scaleAbout(1.13, 100, 94);
const AFRO = 'M100 -6 C 142 -6 158 30 152 60 C 148 84 128 92 100 92 C 72 92 52 84 48 60 C 42 30 58 -6 100 -6 Z';
const BUN = 'M100 -2 C 112 -2, 120 6, 120 14 C 120 24, 110 28, 100 28 C 90 28, 80 24, 80 14 C 80 6, 88 -2, 100 -2 Z';

export function buildToon(a: Appearance, view: ToonView = 'front', pose: ToonPose | PoseSpec = 'idle', shadow = true): Op[] {
  return buildToonLook(lookOf(a), view, pose, shadow);
}

/** The point of a racket (drawn with its handle end at the local origin, pointing up) that sits in the hand, as a matrix. */
function racketMatrix(hand: Pt, deg: number): { m: Mat; at: (x: number, y: number) => Pt } {
  const r = rotateAbout(deg, 0, 0);
  // Local (0, -12) is where the hand holds the handle.
  const e = hand[0] - (r[2] * -12);
  const f = hand[1] - (r[3] * -12);
  const m: Mat = [r[0], r[1], r[2], r[3], e, f];
  return { m, at: (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] };
}

export function buildToonLook(L: ToonLook, view: ToonView = 'front', pose: ToonPose | PoseSpec = 'idle', shadow = true): Op[] {
  const back = view === 'back';
  const sk = L.skin;
  const skd = shadeHex(sk, 0.8);
  const hd = shadeHex(L.hair, 0.62);
  const hh = shadeHex(L.hair, 1.7, 0.9);
  const sx = (x: number): number => R(100 + (x - 100) * L.build);
  const P = typeof pose === 'string' ? POSES[pose] : pose;
  const o: Op[] = [];
  const lift = Math.max(0, -P.crouch);
  if (shadow) o.push(p(ellipsePath(100, 334, 58 - lift * 0.4, 8 - lift * 0.1), { fill: `rgba(11,31,58,${0.22 - lift * 0.003})` }));

  // legs: hips sink with the crouch, ankles are the targets
  const hips: [Pt, Pt] = [[sx(87), 198 + P.crouch], [sx(113), 198 + P.crouch]];
  const ankles: [Pt, Pt] = [P.left, P.right];
  const outward = (side: -1 | 1) => (p1: Pt, p2: Pt): Pt => ((p1[0] - p2[0]) * side > 0 ? p1 : p2);
  ([-1, 1] as const).forEach((side, i) => {
    const hip = hips[i];
    const an = ankles[i];
    const knee = bend(hip, an, 53, 54, outward(side));
    o.push(...limbs([[`M${hip[0]} ${hip[1]} L ${R(knee[0])} ${R(knee[1])}`, 27], [`M${R(knee[0])} ${R(knee[1])} L ${an[0]} ${an[1]}`, 19]], sk));
    // sock and shoe follow the ankle
    const x = an[0];
    const dy = an[1] - GROUND;
    o.push(p(`M${x - 8} ${an[1] - 8} L ${x + 8} ${an[1] - 8} L ${x + 8} ${an[1] + 8} L ${x - 8} ${an[1] + 8} Z`, { fill: '#ffffff', stroke: OUTLINE, sw: 2.4 }));
    o.push(p(`M${x - 8} ${an[1] - 4} H${x + 8}`, { stroke: L.shirt, sw: 2.4 }));
    const sxx = x + side * 5;
    const dr = side;
    const tip = sxx + dr * 20;
    o.push({
      k: 'g',
      m: translate(0, dy),
      ops: [
        shape(`M${sxx - 14 * dr} 310 L ${sxx + 9 * dr} 310 C ${tip} 312, ${tip + dr * 4} 322, ${tip + dr * 3} 330 L ${sxx - 15 * dr} 330 C ${sxx - 17 * dr} 320, ${sxx - 16 * dr} 314, ${sxx - 14 * dr} 310 Z`, L.shoes),
        p(`M${sxx - 16 * dr} 326 L ${tip + dr * 3} 326 L ${tip + dr * 3} 332 L ${sxx - 16 * dr} 332 Z`, { fill: '#e8ecf4', stroke: OUTLINE, sw: 2.4 }),
        p(`M${sxx - 6 * dr} 314 q ${dr * 8} 2 ${dr * 14} 9`, { stroke: shadeHex(L.shoes, 0.7), sw: 2.6, cap: 'round' }),
        p(ellipsePath(sxx + dr * 2, 313, 5, 2), { fill: '#ffffff', a: 0.6 }),
      ],
    });
  });

  // upper body: leaned about the waist and lowered by the crouch
  const rot = rotateAbout(P.lean, 100, 190);
  const bodyM: Mat = [rot[0], rot[1], rot[2], rot[3], rot[4], rot[5] + P.crouch];
  const u: Op[] = [];
  const armTo = (shoulder: Pt, hand: Pt, elbow: Pt | undefined, sleeve: string, outwardSign: -1 | 1): Op[] => {
    const e = elbow ?? bend(shoulder, hand, 42, 42, (p1, p2) => (p1[1] + outwardSign * p1[0] * 0.3 > p2[1] + outwardSign * p2[0] * 0.3 ? p1 : p2));
    const ex = R(e[0]);
    const ey = R(e[1]);
    return [
      ...limbs([[`M${shoulder[0]} ${shoulder[1]} L ${ex} ${ey}`, 27]], sleeve, 0.3),
      ...limbs([[`M${ex} ${ey} L ${R(hand[0])} ${R(hand[1])}`, 19]], sk),
    ];
  };
  const handOps = (h: Pt): Op[] => [
    p(ellipsePath(h[0], h[1] + 2, 11, 11), { fill: sk, stroke: OUTLINE, sw: 2.4 }),
    p(`M${h[0] - 7} ${h[1] - 1} q7 -4 14 0 M${h[0] - 7} ${h[1] + 4} q7 -3 14 0`, { stroke: skd, sw: 2, cap: 'round' }),
  ];

  // hair behind the head (front view)
  if (!back) {
    if (L.style === 'long') u.push({ k: 'g', m: HEAD_SCALE, ops: [shape('M64 44 C 58 90, 60 120, 70 134 L 90 118 L 110 118 L 130 134 C 140 120, 142 90, 136 44 Z', L.hair)] });
    if (L.style === 'afro') u.push({ k: 'g', m: HEAD_SCALE, ops: [shape(AFRO, L.hair)] });
    if (L.style === 'ponytail') u.push({ k: 'g', m: HEAD_SCALE, ops: [shape('M126 36 C 156 36 168 70 160 112 C 154 124 146 120 148 108 C 150 84 140 62 124 56 Z', L.hair)] });
  }

  // shorts or skirt
  if (L.skirt) {
    u.push(shape(`M${sx(68)} 176 L ${sx(132)} 176 L ${sx(146)} 226 C ${sx(120)} 236, ${sx(80)} 236, ${sx(54)} 226 Z`, L.bottom));
    u.push(p(`M${sx(86)} 180 L ${sx(80)} 232 M${sx(100)} 180 L ${sx(100)} 234 M${sx(114)} 180 L ${sx(120)} 232`, { stroke: shadeHex(L.bottom, 0.78), sw: 2.2 }));
    u.push(p(`M${sx(54)} 226 C ${sx(80)} 236, ${sx(120)} 236, ${sx(146)} 226`, { stroke: L.bottomTrim, sw: 3.4 }));
  } else {
    u.push(shape(`M${sx(68)} 176 L ${sx(132)} 176 L ${sx(140)} 232 L ${sx(104)} 236 L 100 212 L ${sx(96)} 236 L ${sx(60)} 232 Z`, L.bottom));
    u.push(p(`M${sx(121)} 180 L ${sx(131)} 230`, { stroke: L.bottomTrim, sw: 3.4 }));
    u.push(p(`M${sx(112)} 180 L ${sx(121)} 230 L ${sx(138)} 230 L ${sx(131)} 180 Z`, { fill: shadeHex(L.bottom, 0.7), a: 0.35 }));
  }

  // torso
  u.push(shape(`M${sx(63)} 108 C ${sx(78)} 100, ${sx(122)} 100, ${sx(137)} 108 L ${sx(133)} 180 C ${sx(118)} 186, ${sx(82)} 186, ${sx(67)} 180 Z`, L.shirt));
  u.push(p(`M${sx(114)} 104 C ${sx(126)} 104, ${sx(132)} 106, ${sx(137)} 108 L ${sx(133)} 180 C ${sx(128)} 182, ${sx(122)} 184, ${sx(116)} 185 Z`, { fill: shadeHex(L.shirt, 0.62), a: 0.5 }));
  u.push(p(`M${sx(66)} 128 C ${sx(90)} 134, ${sx(110)} 134, ${sx(134)} 128 L ${sx(133)} 140 C ${sx(110)} 146, ${sx(90)} 146, ${sx(67)} 140 Z`, { fill: L.trim, a: 0.95 }));
  u.push(p(`M${sx(63)} 108 C ${sx(78)} 100, ${sx(122)} 100, ${sx(137)} 108`, { stroke: L.trim, sw: 3 }));

  // neck
  u.push(shape('M89 86 L 89 108 C 95 114, 105 114, 111 108 L 111 86 Z', sk));
  u.push(p('M89 100 C 96 108, 104 108, 111 100 L 111 86 L 103 86 C 103 96, 96 100, 89 100Z', { fill: skd, a: 0.55 }));
  u.push(p(back ? 'M89 106 C 95 112, 105 112, 111 106' : 'M89 106 L 100 120 L 111 106', { stroke: OUTLINE, sw: 2.4 }));


  // off arm (viewer's left), behind the head unless it is on the racket handle
  // Seen from behind, a racket held in front of the body (ready stance, running) must sit BEHIND the torso and head, with the
  // hand and the racket peeking out at the side; drawn on top of the back it looked as if it was held behind the back.
  const frontHeld = back && P.hand[0] < 140 && P.hand[1] > 100 && P.hand[1] < 175 && P.racket > -20 && P.racket < 30;
  const hx = sx(P.hand[0]) + (frontHeld ? BACK_VIEW_SIDE_SHIFT : 0);
  const rk = racketMatrix([hx, P.hand[1]], P.racket);
  const frontOps: Op[] = [];
  const offHand: Pt = P.off === 'grip' ? rk.at(0, -34) : [sx(P.off[0]), P.off[1]];
  if (P.off !== 'grip') {
    u.push(...armTo([sx(63), 114], offHand, P.offElbow ? [sx(P.offElbow[0]), P.offElbow[1]] : undefined, L.shirt, -1));
    u.push(...handOps(offHand));
  }

  // head
  const head: Op[] = [];
  head.push(p(ellipsePath(68, 56, 6, 8), { fill: sk, stroke: OUTLINE, sw: 2.4 }));
  head.push(p(ellipsePath(132, 56, 6, 8), { fill: sk, stroke: OUTLINE, sw: 2.4 }));
  head.push(shape('M68 46 C 68 22, 132 22, 132 46 C 132 70, 120 90, 100 94 C 80 90, 68 70, 68 46 Z', sk));
  head.push(p('M122 36 C 134 50, 130 74, 112 90 C 120 86, 128 76, 132 60 C 134 50, 130 40, 122 36Z', { fill: skd, a: 0.5 }));
  if (!back) {
    head.push(p(ellipsePath(86, 58, 7.2, 6.2), { fill: '#ffffff', stroke: OUTLINE, sw: 2 }));
    head.push(p(ellipsePath(114, 58, 7.2, 6.2), { fill: '#ffffff', stroke: OUTLINE, sw: 2 }));
    for (const x of [87, 115]) {
      head.push(p(ellipsePath(x, 59, 4.2, 4.2), { fill: L.eye }));
      head.push(p(ellipsePath(x, 59, 2.2, 2.2), { fill: '#0b0b12' }));
      head.push(p(ellipsePath(x + 1.6, 57.2, 1.4, 1.4), { fill: '#ffffff' }));
    }
    if (L.female) head.push(p('M79 54 q-3 -3 -6 -1 M121 54 q3 -3 6 -1', { stroke: OUTLINE, sw: 2, cap: 'round' }));
    head.push(p('M78 46 C 83 41, 91 41, 95 45 M105 45 C 109 41, 117 41, 122 46', { stroke: hd, sw: L.female ? 2.8 : 3.8, cap: 'round' }));
    head.push(p('M100 60 C 98 68, 97 70, 100 72 C 102 72, 104 71, 103 70', { stroke: skd, sw: 2.4, cap: 'round' }));
    head.push(p('M89 77 C 96 84, 104 84, 111 77 C 104 79, 96 79, 89 77 Z', { fill: '#ffffff', stroke: OUTLINE, sw: 2 }));
    head.push(p('M89 77 C 96 80, 104 80, 111 77', { stroke: L.lip, sw: 2.4, cap: 'round' }));
    head.push(p(ellipsePath(78, 72, 6, 3.4), { fill: '#e8706a', a: 0.22 }));
    head.push(p(ellipsePath(122, 72, 6, 3.4), { fill: '#e8706a', a: 0.22 }));
  }
  if (back) {
    if (L.style === 'afro') head.push(shape(AFRO, L.hair));
    else if (L.style !== 'bald') {
      head.push(shape('M66 52 C 62 14, 138 14, 134 52 C 133 66, 124 78, 100 80 C 76 78, 67 66, 66 52 Z', L.hair));
      head.push(p('M78 30 C 88 20, 112 20, 122 30', { stroke: hh, sw: 4, cap: 'round', a: 0.6 }));
    }
    if (L.style === 'bun') head.push(shape(BUN, L.hair));
    if (L.style === 'ponytail') head.push(shape('M92 58 C 108 58 116 70 114 94 C 112 124 104 130 98 128 C 92 124 94 100 92 86 C 90 72 90 64 92 58 Z', L.hair));
  } else {
    if (L.style === 'short' || L.style === 'ponytail' || L.style === 'long' || L.style === 'bun') {
      head.push(shape('M65 54 C 58 18, 96 8, 112 12 C 134 16, 144 36, 135 56 C 134 48, 130 42, 124 38 C 112 44, 96 40, 82 36 C 74 40, 70 46, 65 54 Z', L.hair));
      head.push(p('M76 26 C 86 18, 102 16, 114 20', { stroke: hh, sw: 4, cap: 'round', a: 0.7 }));
    }
    if (L.style === 'bun') {
      head.push(shape(BUN, L.hair));
      head.push(p('M90 8 C 96 3, 104 3, 110 8', { stroke: hh, sw: 3, cap: 'round', a: 0.7 }));
    }
    if (L.style === 'afro') {
      head.push(shape('M68 48 C 64 24, 82 14, 100 14 C 118 14, 136 24, 132 48 C 128 40, 120 34, 110 34 C 100 38, 90 38, 80 34 C 74 38, 70 44, 68 48 Z', L.hair));
      head.push(p('M72 22 C 84 8, 112 8, 128 22', { stroke: hh, sw: 4, cap: 'round', a: 0.6 }));
    }
  }
  if (L.style === 'bald') head.push(p(ellipsePath(88, 40, 9, 3.4), { fill: '#ffffff', a: 0.35, m: rotateAbout(-20, 88, 40) }));
  if (L.band) head.push(shape('M67 40 C 80 32, 120 32, 133 40 L 133 50 C 120 42, 80 42, 67 50 Z', L.band));
  if (L.cap) {
    head.push(shape('M66 44 C 62 14, 138 14, 134 44 C 120 36, 80 36, 66 44 Z', L.cap));
    head.push(shape('M70 42 C 90 46, 124 46, 142 52 C 140 42, 120 38, 100 38 Z', shadeHex(L.cap, 0.7)));
  }
  u.push({ k: 'g', m: HEAD_SCALE, ops: head });
  if (back && L.style === 'long') {
    u.push(shape('M62 70 C 56 100, 60 126, 74 136 L 96 124 L 104 124 L 126 136 C 140 126, 144 100, 138 70 C 130 84, 70 84, 62 70 Z', L.hair));
  }

  // racket arm (viewer's right) and racket
  const racketPart: Op[] = frontHeld ? frontOps : u;
  racketPart.push(...armTo([sx(137), 114], [hx, P.hand[1]], P.elbow ? [sx(P.elbow[0]), P.elbow[1]] : undefined, L.shirt, 1));
  racketPart.push({ k: 'g', m: rk.m, ops: racketOps(L.racket, L.racketShape) });
  racketPart.push(...handOps([hx, P.hand[1]]));
  if (L.wristband) racketPart.push(p(`M${R(hx - 9)} ${R(P.hand[1] - 12)} q9 5 18 0`, { stroke: L.wristband, sw: 5, cap: 'round' }));
  if (P.off === 'grip') {
    racketPart.push(...armTo([sx(63), 114], offHand, undefined, L.shirt, -1));
    racketPart.push(...handOps(offHand));
  }
  if (frontHeld) u.unshift(...frontOps);
  o.push({ k: 'g', m: bodyM, ops: u });
  return o;
}

const lerpN = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpP = (a: Pt, b: Pt, t: number): Pt => [lerpN(a[0], b[0], t), lerpN(a[1], b[1], t)];

/** A pose between two others (t 0..1). The off hand jumps from or to a racket grip halfway; elbows are solved when either pose has none. */
export function mixPose(a: PoseSpec, b: PoseSpec, t: number): PoseSpec {
  const off: PoseSpec['off'] = a.off === 'grip' || b.off === 'grip' ? (t < 0.5 ? a.off : b.off) : lerpP(a.off, b.off, t);
  return {
    hand: lerpP(a.hand, b.hand, t),
    racket: lerpN(a.racket, b.racket, t),
    elbow: a.elbow && b.elbow ? lerpP(a.elbow, b.elbow, t) : undefined,
    off,
    offElbow: a.offElbow && b.offElbow ? lerpP(a.offElbow, b.offElbow, t) : undefined,
    lean: lerpN(a.lean, b.lean, t),
    crouch: lerpN(a.crouch, b.crouch, t),
    left: lerpP(a.left, b.left, t),
    right: lerpP(a.right, b.right, t),
  };
}

/** Frames of the run cycle (two steps per cycle). */
export const RUN_FRAMES = 8;

/** One frame of the run cycle: legs swing and lift, the body bobs and leans, arms swing against the legs, the racket stays up. */
export function runFrame(frame: number): PoseSpec {
  const ph = ((frame % RUN_FRAMES) + RUN_FRAMES) % RUN_FRAMES / RUN_FRAMES;
  const a = ph * Math.PI * 2;
  const leg = (offset: number, cx: number): Pt => {
    const q = a + offset;
    return [R(cx + 15 * Math.cos(q)), R(GROUND - 30 * Math.max(0, Math.sin(q)))];
  };
  const sw = Math.cos(a);
  return {
    hand: [R(128 + 5 * sw), R(150 - 4 * Math.abs(sw))],
    racket: 14 + 5 * sw,
    off: [R(48 - 6 * sw), R(150 + 6 * sw)],
    lean: 5 + 2 * Math.cos(2 * a),
    crouch: R(14 + 7 * Math.cos(2 * a + Math.PI)),
    left: leg(0, 72),
    right: leg(Math.PI, 128),
  };
}
