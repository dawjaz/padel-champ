import { NET_Z } from '../game/court';
import type { CourtPos, ShotDef, SideIndex } from '../game/types';

/**
 * Flight of the ball as a list of waypoints in court metres (x across, z along, h height).
 * Pure, so it is testable. The scene plays it with `ballPoint(path, t)`.
 */
export interface Waypoint {
  x: number;
  z: number;
  h: number;
  /** Extra height peak (a parabola-like arc) on the segment that ENDS at this waypoint. */
  arc: number;
}

export type FlightOutcome =
  | 'fault'
  | 'double-fault'
  | 'ace'
  | 'in'
  | 'error'
  | 'winner'
  | 'intercept'
  | 'continue';

export interface FlightOpts {
  from: CourtPos;
  hitterSide: SideIndex;
  shot: ShotDef;
  /** x where the ball first lands in the opponent's court. */
  landX: number;
  /** Where the receiving player stands. */
  target: CourtPos;
  outcome: FlightOutcome;
}

export const HIT_HEIGHT_M = 0.9;
const ARC_BY_HEIGHT = { high: 3.2, mid: 1.5, low: 0.9 } as const;
const clampZ = (z: number): number => Math.max(0.3, Math.min(19.7, z));

export function buildFlight(o: FlightOpts): Waypoint[] {
  // Direction of travel along z: the near team (side 0) hits towards z = 0.
  const away = o.hitterSide === 0 ? -1 : 1;
  const start: Waypoint = { x: o.from.x, z: o.from.z, h: HIT_HEIGHT_M, arc: 0 };

  // A fault or an unforced error: the ball dies in the net.
  if (o.outcome === 'fault' || o.outcome === 'double-fault' || o.outcome === 'error') {
    const x = (o.from.x + o.landX) / 2;
    return [
      start,
      { x, z: NET_Z - away * 0.2, h: 0.55, arc: 0.5 },
      { x, z: NET_Z - away * 0.6, h: 0, arc: 0.2 },
    ];
  }

  const landZ = NET_Z + away * o.shot.landDepth;
  const opponentBackZ = away === -1 ? 0 : 20;
  const ownBackZ = away === -1 ? 20 : 0;
  const wallSign = o.landX !== 0 ? Math.sign(o.landX) : Math.sign(o.target.x) || 1;

  const path: Waypoint[] = [start, { x: o.landX, z: landZ, h: 0, arc: ARC_BY_HEIGHT[o.shot.out] }];

  switch (o.shot.wall) {
    case 'side':
      path.push({ x: wallSign * 5, z: clampZ(landZ + away * 2.5), h: 1.4, arc: 0.5 });
      break;
    case 'back':
      path.push({ x: o.landX, z: opponentBackZ, h: 1.4, arc: 0.5 });
      break;
    case 'fence':
      // Rulo: into the mesh above the glass, near the corner end of the side wall.
      path.push({ x: wallSign * 5, z: clampZ(landZ + away * 1), h: 2.5, arc: 0.8 });
      break;
    default:
      break;
  }

  if (o.outcome === 'ace' || o.outcome === 'winner') {
    // Past the defender: ends against the back wall.
    const last = path[path.length - 1];
    if (last.z !== opponentBackZ) path.push({ x: o.landX * 0.9, z: opponentBackZ, h: 0.7, arc: 0.3 });
    return path;
  }

  path.push({ x: o.target.x, z: o.target.z, h: HIT_HEIGHT_M, arc: 0.4 });
  if (o.outcome === 'intercept') {
    // The defender turns it around and it flies past the original hitter.
    path.push({ x: o.from.x, z: ownBackZ, h: 0.8, arc: 0.6 });
  }
  return path;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Position of the ball at t (0..1) along the path; segments take time in proportion to their length. */
export function ballPoint(path: Waypoint[], t: number): { x: number; z: number; h: number } {
  if (path.length < 2) return { x: path[0].x, z: path[0].z, h: path[0].h };
  const clamped = Math.max(0, Math.min(1, t));

  const weights: number[] = [];
  for (let i = 1; i < path.length; i++) {
    weights.push(Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z) + 1);
  }
  const total = weights.reduce((a, b) => a + b, 0);

  let rest = clamped * total;
  for (let i = 1; i < path.length; i++) {
    const w = weights[i - 1];
    if (rest <= w || i === path.length - 1) {
      const u = Math.max(0, Math.min(1, rest / w));
      const a = path[i - 1];
      const b = path[i];
      return {
        x: lerp(a.x, b.x, u),
        z: lerp(a.z, b.z, u),
        h: lerp(a.h, b.h, u) + b.arc * Math.sin(Math.PI * u),
      };
    }
    rest -= w;
  }
  const end = path[path.length - 1];
  return { x: end.x, z: end.z, h: end.h };
}

/** How long a flight should take, in milliseconds. */
export function flightDuration(path: Waypoint[]): number {
  return Math.min(1300, 360 + 230 * (path.length - 1));
}
