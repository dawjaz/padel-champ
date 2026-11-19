/**
 * Rotation of the ball (pure maths, so it is testable). Coordinates as in ballPath: x across (right), y = height (up),
 * z along the court towards the viewer (the camera looks from the near baseline). That is a right-handed system.
 *
 * A ball is described by its angular velocity vector (rad/s) and an orientation matrix. Topspin turns the top of the ball
 * in the direction of travel, backspin against it; side spin turns it about the vertical axis. The vector is set when the
 * ball is hit and stays fixed in the world: a topspin ball that bounces off the back glass comes off it with backspin,
 * just as in real life.
 */
export type Vec3 = [number, number, number];
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** Angular speed on screen for a spin of 1 (rad/s). A real ball spins much faster (30+ rev/s); this reads well at 60 fps. */
export const SPIN_RATE = 52;
/** Even a "flat" shot turns a little. */
const MIN_TOP = 0.3;

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/**
 * Angular velocity of a ball hit with `top` (+ topspin, - backspin) and `side` (+ clockwise seen from above) while travelling
 * along the horizontal direction (dx, dz).
 */
export function launchSpin(top: number, side: number, dx: number, dz: number): Vec3 {
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const t = Math.abs(top) < MIN_TOP ? (top < 0 ? -MIN_TOP : MIN_TOP) : top;
  // the top of the ball moves along the direction of travel when w = up x direction
  return [t * SPIN_RATE * uz, -side * SPIN_RATE, -t * SPIN_RATE * ux];
}

export function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function mul(a: Mat3, b: Mat3): Mat3 {
  const r = new Array<number>(9).fill(0);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
    }
  }
  return r as Mat3;
}

/** The orientation after turning with angular velocity `w` for `dt` seconds (Rodrigues' rotation formula). */
export function rotate(m: Mat3, w: Vec3, dt: number): Mat3 {
  const speed = Math.hypot(w[0], w[1], w[2]);
  const angle = speed * dt;
  if (angle < 1e-9) return m;
  const x = w[0] / speed;
  const y = w[1] / speed;
  const z = w[2] / speed;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = 1 - c;
  const r: Mat3 = [
    c + x * x * k, x * y * k - z * s, x * z * k + y * s,
    y * x * k + z * s, c + y * y * k, y * z * k - x * s,
    z * x * k - y * s, z * y * k + x * s, c + z * z * k,
  ];
  return mul(r, m);
}

export interface Dot {
  x: number;
  y: number;
  /** Depth towards the viewer (0..1): 1 = in the middle of the visible face. */
  depth: number;
}

/** A point on the ball's surface, in the object's frame, as a screen position (x right, y DOWN) and depth; null when it is on the far side. */
export function surfacePoint(m: Mat3, p: Vec3): Dot | null {
  const q = apply(m, p);
  if (q[2] <= 0) return null;
  return { x: q[0], y: -q[1], depth: q[2] };
}

export interface Ring {
  kind: 'band' | 'seam';
  /** Visible stretches of the ring, each a run of connected points (unit sphere, screen y down). */
  runs: Dot[][];
}

const ringBasis = (n: Vec3): [Vec3, Vec3] => {
  const a: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u: Vec3 = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
  const l = Math.hypot(...u);
  const uu: Vec3 = [u[0] / l, u[1] / l, u[2] / l];
  const v: Vec3 = [n[1] * uu[2] - n[2] * uu[1], n[2] * uu[0] - n[0] * uu[2], n[0] * uu[1] - n[1] * uu[0]];
  return [uu, v];
};

/** The marks printed on the ball: two great circles and two dots. Fixed in the ball's own frame. */
const RINGS: Array<{ kind: Ring['kind']; normal: Vec3 }> = [
  { kind: 'band', normal: [0, 1, 0] },
  { kind: 'seam', normal: [1, 0, 0] },
];
export const DOT_HI: Vec3 = [Math.SQRT1_2, Math.SQRT1_2, 0];
export const DOT_LO: Vec3 = [-Math.SQRT1_2, -Math.SQRT1_2, 0];

/** The visible stretches of the printed rings for an orientation. */
export function visibleRings(m: Mat3, steps = 48): Ring[] {
  return RINGS.map(({ kind, normal }) => {
    const [u, v] = ringBasis(normal);
    const runs: Dot[][] = [];
    let run: Dot[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const p: Vec3 = [
        u[0] * Math.cos(a) + v[0] * Math.sin(a),
        u[1] * Math.cos(a) + v[1] * Math.sin(a),
        u[2] * Math.cos(a) + v[2] * Math.sin(a),
      ];
      const d = surfacePoint(m, p);
      if (d) run.push(d);
      else if (run.length) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length) runs.push(run);
    return { kind, runs };
  });
}
