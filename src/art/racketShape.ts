// A padel racket in real measurements (centimetres), shared by every picture of a racket: the character, the gear art and the
// small shape icons. Pure (no Phaser), tested.
//
// FIP limits: total length 45.5 cm, head width 26 cm, profile 38 mm, handle up to 20 cm; a solid striking face with holes of
// 9-13 mm; a wrist cord. The three head shapes differ in where the head is widest: round (low, large central sweet spot),
// teardrop (a little higher) and diamond (high, straighter sides, a flatter top: the power shape). Every racket has an open
// throat (two arms around a heart-shaped hole) between the handle and the face, which is what makes it read as padel.
//
// Coordinates: x to the right, y up is negative, the butt of the handle at (0, 0), the racket pointing up (y = -45.5 at the top).

export type RacketShape = 'diamond' | 'teardrop' | 'round';
export type Pt = [number, number];

export const RACKET = {
  /** Total length and head width (cm). */
  length: 45.5,
  width: 26,
  /** The grip runs from the butt to here (cm). */
  gripTo: 13,
  /** Width of the grip with an overgrip, and of the butt cap (cm). */
  gripW: 3.6,
  buttW: 4.3,
  /** The face (the solid striking surface) starts here, above the throat (cm from the butt). */
  faceFrom: 19.6,
  /** Width of the frame seen from the front (cm). */
  rim: 1.0,
  /** Width of each throat arm (cm). */
  arm: 1.9,
  /** Radius of a hole (cm): 11 mm holes. */
  holeR: 0.55,
} as const;

/** Character units per cm for the racket of the toon figure (the head is about 60% of the shoulder width, as on a real player). */
export const TOON_CM = 2.4;

/** Right half of the outer frame, from where it leaves the handle to the top centre: [half width, height from the butt] (cm). */
const HALF: Record<RacketShape, Pt[]> = {
  round: [[1.9, 13], [5.6, 17.4], [9.6, 20.6], [12.2, 24.6], [13, 29.6], [12.7, 34.6], [11, 39.4], [7.6, 43.3], [3.6, 45.1], [0, 45.5]],
  teardrop: [[1.9, 13], [5.3, 17.8], [8.7, 21.6], [11.3, 26], [12.8, 31], [13, 35.6], [12, 40.2], [8.8, 43.8], [4.2, 45.3], [0, 45.5]],
  diamond: [[1.9, 13], [4.9, 18], [7.7, 22.6], [10.3, 27.6], [12.4, 32.6], [13, 36.8], [12.3, 40.6], [9.6, 43.6], [5, 45.2], [0, 45.5]],
};

export interface RacketGeom {
  shape: RacketShape;
  /** The whole outer frame (head + throat), closed, ending at the top of the grip. */
  outline: Pt[];
  /** The head only (the frame around the face), closed. */
  head: Pt[];
  /** The solid striking surface inside the frame, closed (convex). */
  face: Pt[];
  /** The open throat (the heart), closed. */
  heart: Pt[];
  /** The two throat arms as closed polygons (right, left). */
  arms: [Pt[], Pt[]];
  /** Hole centres on the face. */
  holes: Pt[];
  /** The top of the frame (where a frame protector sits), an open polyline. */
  protector: Pt[];
  /** Two decoration areas clipped to the face: a wide diagonal sweep and a thin accent stripe. */
  sweep: Pt[];
  stripe: Pt[];
  /** Height (cm from the butt, positive) where the face is widest: the sweet spot sits about here. */
  widestAt: number;
}

/** Chaikin corner cutting on a closed loop. */
function chaikin(pts: Pt[], iterations: number): Pt[] {
  let out = pts;
  for (let it = 0; it < iterations; it++) {
    const next: Pt[] = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    out = next;
  }
  return out;
}

/** Signed area (positive = counter-clockwise in y-up maths, i.e. clockwise on screen). */
export function area(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/** Moves every vertex of a closed convex loop inwards by `d` along the averaged edge normals. */
export function inset(poly: Pt[], d: number): Pt[] {
  const sign = area(poly) > 0 ? 1 : -1;
  const n = poly.length;
  return poly.map((p, i) => {
    const a = poly[(i - 1 + n) % n];
    const b = poly[(i + 1) % n];
    const nrm = (u: Pt, v: Pt): Pt => {
      const dx = v[0] - u[0];
      const dy = v[1] - u[1];
      const l = Math.hypot(dx, dy) || 1;
      return [(-dy / l) * sign, (dx / l) * sign];
    };
    const n1 = nrm(a, p);
    const n2 = nrm(p, b);
    const nx = n1[0] + n2[0];
    const ny = n1[1] + n2[1];
    const l = Math.hypot(nx, ny) || 1;
    return [p[0] + (nx / l) * d, p[1] + (ny / l) * d];
  });
}

/** Keeps the part of a closed polygon where nx*x + ny*y <= c (Sutherland-Hodgman against one line). */
export function clipHalf(poly: Pt[], nx: number, ny: number, c: number): Pt[] {
  const out: Pt[] = [];
  const f = (p: Pt): number => nx * p[0] + ny * p[1] - c;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = f(a);
    const fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa <= 0) !== (fb <= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export function inside(poly: Pt[], p: Pt): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const cache = new Map<RacketShape, RacketGeom>();

export function racketGeom(shape: RacketShape = 'teardrop'): RacketGeom {
  const hit = cache.get(shape);
  if (hit) return hit;
  const R = RACKET;
  const half = HALF[shape];
  // Mirror the right half into a closed loop (top point once) and smooth it.
  const loop: Pt[] = [...half, ...half.slice(0, -1).reverse().map(([x, h]): Pt => [-x, h])];
  let smooth = chaikin(loop, 3);
  // Back to the exact measurements: width 26, length 45.5, the grip end of the throat stays at 13 cm.
  const maxX = Math.max(...smooth.map((p) => Math.abs(p[0])));
  const maxH = Math.max(...smooth.map((p) => p[1]));
  smooth = smooth.map(([x, h]): Pt => [(x * (R.width / 2)) / maxX, R.gripTo + ((h - R.gripTo) * (R.length - R.gripTo)) / (maxH - R.gripTo)]);
  const toY = (pts: Pt[]): Pt[] => pts.map(([x, h]): Pt => [x, -h]);

  // Throat: the inner edge of each arm runs `arm` inside the outer edge, from the bottom of the heart up to the face.
  const right = smooth.filter(([x, h]) => x > 0 && h < R.faceFrom + 0.6).sort((a, b) => a[1] - b[1]);
  const innerR: Pt[] = right.map(([x, h]): Pt => [x - R.arm * (1 + 0.5 * (1 - (h - R.gripTo) / (R.faceFrom - R.gripTo))), h]).filter(([x, h]) => x > 0.15 && h > R.gripTo + 2.4);
  const heartBottom = Math.max(R.gripTo + 2.2, (innerR[0]?.[1] ?? R.gripTo + 2.6) - 0.7);
  const bridge = R.faceFrom - 0.25;
  const innerRight: Pt[] = [...innerR.filter(([, h]) => h < bridge), [innerR.length ? innerR[innerR.length - 1][0] * 0.92 : 3, bridge]];
  const heartH: Pt[] = [[0, heartBottom], ...innerRight, [innerRight[innerRight.length - 1][0] * 0.45, bridge + 0.3], [0, bridge + 0.35]];
  const heartHalf = heartH;
  const heart: Pt[] = [...heartHalf, ...heartHalf.slice(1, -1).reverse().map(([x, h]): Pt => [-x, h])];

  // The head: the outer loop above the face line, closed straight across at the bridge.
  const headPts = smooth.filter(([, h]) => h >= R.faceFrom - 0.4);
  const head = headPts;
  const face = inset(head, R.rim);
  // The arms: outer edge (from the handle up to the face line) and back down the inner edge to the heart's bottom.
  const outerR = right.filter(([, h]) => h <= R.faceFrom);
  const armR: Pt[] = [[0, R.gripTo], ...outerR, ...[...innerRight].reverse(), [0, heartBottom]];
  const armL: Pt[] = armR.map(([x, h]): Pt => [-x, h]);

  // Holes: rows 2.3 cm apart, every other row shifted, kept 1.3 cm inside the face, none in the top 3 cm.
  const zone = inset(face, 1.3);
  const holes: Pt[] = [];
  const step = 2.45;
  for (let row = 0, h = R.faceFrom + 2.3; h < R.length - 3.2; row++, h += step * 0.9) {
    for (let x = row % 2 ? step / 2 : 0; x < R.width / 2; x += step) {
      for (const sx of x === 0 ? [0] : [x, -x]) if (inside(zone, [sx, h])) holes.push([sx, -h]);
    }
  }

  const protector = smooth.filter(([, h]) => h > R.length - 5.5);
  protector.sort((a, b) => a[0] - b[0]);

  // Decoration: a diagonal sweep across the lower face and a thin accent stripe above it (both clipped to the face).
  const faceY = toY(face);
  const ang = shape === 'diamond' ? 0.62 : shape === 'round' ? 0.42 : 0.52;
  const nx = Math.sin(ang);
  const ny = Math.cos(ang);
  const mid = -(R.faceFrom + (R.length - R.faceFrom) * 0.45);
  const c0 = ny * mid;
  const sweep = clipHalf(clipHalf(faceY, -nx, -ny, -(c0 + 1.2)), nx, ny, c0 + 6.5);
  const stripe = clipHalf(clipHalf(faceY, nx, ny, c0 + 0.2), -nx, -ny, -(c0 - 0.7));

  let widestAt = 0;
  let w = 0;
  for (const [x, h] of smooth) if (x > w) [w, widestAt] = [x, h];

  const geom: RacketGeom = {
    shape,
    outline: toY(smooth),
    head: toY(head),
    face: faceY,
    heart: toY(heart),
    arms: [toY(armR), toY(armL)],
    holes,
    protector: toY(protector),
    sweep,
    stripe,
    widestAt,
  };
  cache.set(shape, geom);
  return geom;
}

/** A shape for a racket without one (CPU players): stable for the same colours, so a player keeps his racket. */
export function shapeFor(seed: string): RacketShape {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (['teardrop', 'round', 'diamond'] as const)[h % 3];
}
