import type { Appearance } from '../../game/types';
import { ellipsePath, luma, rotateAbout, scaleAbout, shadeHex, translate, type Op, type PathOp, rectPath } from './ops';

/**
 * Toon character (about 4.5 heads tall, flat cel shading, dark outline), drawn in "character units": the
 * figure is 200 wide and about 340 tall, centre x = 100, feet at y = 334. Only the ready pose exists so far;
 * the pose parameter will carry arm and racket angles for the swing poses later.
 */
export type ToonView = 'front' | 'back';

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

const HEAD_SCALE = scaleAbout(1.13, 100, 94);
const AFRO = 'M100 -6 C 142 -6 158 30 152 60 C 148 84 128 92 100 92 C 72 92 52 84 48 60 C 42 30 58 -6 100 -6 Z';
const BUN = 'M100 -2 C 112 -2, 120 6, 120 14 C 120 24, 110 28, 100 28 C 90 28, 80 24, 80 14 C 80 6, 88 -2, 100 -2 Z';

export function buildToon(a: Appearance, view: ToonView = 'front'): Op[] {
  return buildToonLook(lookOf(a), view);
}

export function buildToonLook(L: ToonLook, view: ToonView = 'front'): Op[] {
  const back = view === 'back';
  const sk = L.skin;
  const skd = shadeHex(sk, 0.8);
  const hd = shadeHex(L.hair, 0.62);
  const hh = shadeHex(L.hair, 1.7, 0.9);
  const sx = (x: number): number => R(100 + (x - 100) * L.build);
  const o: Op[] = [];
  o.push(p(ellipsePath(100, 334, 58, 8), { fill: 'rgba(11,31,58,.22)' }));

  // hair behind the head (front view)
  if (!back) {
    if (L.style === 'long') o.push({ k: 'g', m: HEAD_SCALE, ops: [shape('M64 44 C 58 90, 60 120, 70 134 L 90 118 L 110 118 L 130 134 C 140 120, 142 90, 136 44 Z', L.hair)] });
    if (L.style === 'afro') o.push({ k: 'g', m: HEAD_SCALE, ops: [shape(AFRO, L.hair)] });
    if (L.style === 'ponytail') o.push({ k: 'g', m: HEAD_SCALE, ops: [shape('M126 36 C 156 36 168 70 160 112 C 154 124 146 120 148 108 C 150 84 140 62 124 56 Z', L.hair)] });
  }

  // legs
  o.push(...limbs([[`M${sx(87)} 198 L 81 250`, 27], ['M81 250 L 75 304', 19]], sk));
  o.push(...limbs([[`M${sx(113)} 198 L 119 250`, 27], ['M119 250 L 125 304', 19]], sk));
  for (const x of [74, 126]) {
    o.push(p(`M${x - 8} 296 L ${x + 8} 296 L ${x + 8} 312 L ${x - 8} 312 Z`, { fill: '#ffffff', stroke: OUTLINE, sw: 2.4 }));
    o.push(p(`M${x - 8} 300 H${x + 8}`, { stroke: L.shirt, sw: 2.4 }));
  }
  // shoes
  for (const [x, dr] of [[70, -1], [130, 1]] as const) {
    const tip = x + dr * 20;
    o.push(shape(`M${x - 14 * dr} 310 L ${x + 9 * dr} 310 C ${tip} 312, ${tip + dr * 4} 322, ${tip + dr * 3} 330 L ${x - 15 * dr} 330 C ${x - 17 * dr} 320, ${x - 16 * dr} 314, ${x - 14 * dr} 310 Z`, L.shoes));
    o.push(p(`M${x - 16 * dr} 326 L ${tip + dr * 3} 326 L ${tip + dr * 3} 332 L ${x - 16 * dr} 332 Z`, { fill: '#e8ecf4', stroke: OUTLINE, sw: 2.4 }));
    o.push(p(`M${x - 6 * dr} 314 q ${dr * 8} 2 ${dr * 14} 9`, { stroke: shadeHex(L.shoes, 0.7), sw: 2.6, cap: 'round' }));
    o.push(p(ellipsePath(x + dr * 2, 313, 5, 2), { fill: '#ffffff', a: 0.6 }));
  }

  // shorts or skirt
  if (L.skirt) {
    o.push(shape(`M${sx(68)} 176 L ${sx(132)} 176 L ${sx(146)} 226 C ${sx(120)} 236, ${sx(80)} 236, ${sx(54)} 226 Z`, L.bottom));
    o.push(p(`M${sx(86)} 180 L ${sx(80)} 232 M${sx(100)} 180 L ${sx(100)} 234 M${sx(114)} 180 L ${sx(120)} 232`, { stroke: shadeHex(L.bottom, 0.78), sw: 2.2 }));
    o.push(p(`M${sx(54)} 226 C ${sx(80)} 236, ${sx(120)} 236, ${sx(146)} 226`, { stroke: L.bottomTrim, sw: 3.4 }));
  } else {
    o.push(shape(`M${sx(68)} 176 L ${sx(132)} 176 L ${sx(140)} 232 L ${sx(104)} 236 L 100 212 L ${sx(96)} 236 L ${sx(60)} 232 Z`, L.bottom));
    o.push(p(`M${sx(121)} 180 L ${sx(131)} 230`, { stroke: L.bottomTrim, sw: 3.4 }));
    o.push(p(`M${sx(112)} 180 L ${sx(121)} 230 L ${sx(138)} 230 L ${sx(131)} 180 Z`, { fill: shadeHex(L.bottom, 0.7), a: 0.35 }));
  }

  // torso
  o.push(shape(`M${sx(63)} 108 C ${sx(78)} 100, ${sx(122)} 100, ${sx(137)} 108 L ${sx(133)} 180 C ${sx(118)} 186, ${sx(82)} 186, ${sx(67)} 180 Z`, L.shirt));
  o.push(p(`M${sx(114)} 104 C ${sx(126)} 104, ${sx(132)} 106, ${sx(137)} 108 L ${sx(133)} 180 C ${sx(128)} 182, ${sx(122)} 184, ${sx(116)} 185 Z`, { fill: shadeHex(L.shirt, 0.62), a: 0.5 }));
  o.push(p(`M${sx(66)} 128 C ${sx(90)} 134, ${sx(110)} 134, ${sx(134)} 128 L ${sx(133)} 140 C ${sx(110)} 146, ${sx(90)} 146, ${sx(67)} 140 Z`, { fill: L.trim, a: 0.95 }));
  o.push(p(`M${sx(63)} 108 C ${sx(78)} 100, ${sx(122)} 100, ${sx(137)} 108`, { stroke: L.trim, sw: 3 }));

  // neck
  o.push(shape('M89 86 L 89 108 C 95 114, 105 114, 111 108 L 111 86 Z', sk));
  o.push(p('M89 100 C 96 108, 104 108, 111 100 L 111 86 L 103 86 C 103 96, 96 100, 89 100Z', { fill: skd, a: 0.55 }));
  o.push(p(back ? 'M89 106 C 95 112, 105 112, 111 106' : 'M89 106 L 100 120 L 111 106', { stroke: OUTLINE, sw: 2.4 }));

  // arm on the viewer's left
  o.push(...limbs([[`M${sx(63)} 114 L ${sx(47)} 152`, 27]], L.shirt, 0.3));
  o.push(...limbs([[`M${sx(47)} 154 C ${sx(41)} 172, ${sx(43)} 186, ${sx(51)} 196`, 19]], sk));
  o.push(p(ellipsePath(sx(51), 202, 10.5, 11.5), { fill: sk, stroke: OUTLINE, sw: 2.4 }));
  o.push(p(`M${sx(45)} 204 q6 5 12 0`, { stroke: skd, sw: 2, cap: 'round' }));

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
  o.push({ k: 'g', m: HEAD_SCALE, ops: head });
  if (back && L.style === 'long') {
    o.push(shape('M62 70 C 56 100, 60 126, 74 136 L 96 124 L 104 124 L 126 136 C 140 126, 144 100, 138 70 C 130 84, 70 84, 62 70 Z', L.hair));
  }

  // racket arm (viewer's right) and racket
  o.push(...limbs([[`M${sx(137)} 114 L ${sx(155)} 148`, 27]], L.shirt, 0.3));
  const hx = sx(150);
  const hy = 190;
  o.push(...limbs([[`M${sx(155)} 150 C ${sx(162)} 164, ${sx(158)} 180, ${hx} ${hy}`, 19]], sk));
  o.push({ k: 'g', m: [...rotateAbout(16, 0, 0).slice(0, 4), hx, hy + 6] as [number, number, number, number, number, number], ops: racketOps(L.racket, L.racketShape) });
  o.push(p(ellipsePath(hx, hy + 2, 11, 11), { fill: sk, stroke: OUTLINE, sw: 2.4 }));
  o.push(p(`M${hx - 7} ${hy - 1} q7 -4 14 0 M${hx - 7} ${hy + 4} q7 -3 14 0`, { stroke: skd, sw: 2, cap: 'round' }));
  if (L.wristband) o.push(p(`M${R(hx - 9)} ${hy - 12} q9 5 18 0`, { stroke: L.wristband, sw: 5, cap: 'round' }));
  return o;
}
