import { NET_Z } from '../game/court';
import type { CourtPos, ReceiveMode, ShotDef, SideIndex } from '../game/types';

/**
 * Flight of the ball as a list of waypoints in court metres (x across, z along, h height).
 * Pure, so it is testable. The scene plays it with `ballPoint(path, t)`.
 *
 * The flight also decides WHERE the next player hits the ball (`hit`): after the first bounce, or, for
 * balls that go to a wall, where the ball comes down after the glass / fence. The defender walks there.
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
  outcome: FlightOutcome;
  /** For a serve to the side glass: take it after the bounce or after the glass. Default 'wall'. */
  receive?: ReceiveMode;
}

export interface Flight {
  path: Waypoint[];
  /** Where the ball is hit next (on the opponent's side). On a fault or an error there is no hit. */
  hit: CourtPos;
}

export const HIT_HEIGHT_M = 0.9;
const ARC_BY_HEIGHT = { high: 3.2, mid: 1.5, low: 0.9 } as const;
/** Ball hits the side glass this far (in metres along the court) behind where it first bounced. */
const SIDE_WALL_RUN = 2;
/** After the glass the ball comes down this far from the wall. */
const SIDE_WALL_DROP_X = 2.2;
/** After the back wall the ball comes back out and comes down this much further from the wall than it bounced. */
const BACK_WALL_REBOUND = 1.5;
/** After a plain bounce the ball is taken this far past the bounce. */
const BOUNCE_RUN = 1.2;
const MIN_DEPTH = 1.5;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function buildFlight(o: FlightOpts): Flight {
  // Direction of travel along z: the near team (side 0) hits towards z = 0.
  const away = o.hitterSide === 0 ? -1 : 1;
  const start: Waypoint = { x: o.from.x, z: o.from.z, h: HIT_HEIGHT_M, arc: 0 };
  const opponentBackZ = away === -1 ? 0 : 20;
  const ownBackZ = away === -1 ? 20 : 0;
  /** z of a point `d` metres in front of the opponent's back wall. */
  const zAt = (d: number): number => opponentBackZ - away * d;

  // A fault or an unforced error: the ball dies in the net.
  if (o.outcome === 'fault' || o.outcome === 'double-fault' || o.outcome === 'error') {
    const x = (o.from.x + o.landX) / 2;
    return {
      path: [
        start,
        { x, z: NET_Z - away * 0.2, h: 0.55, arc: 0.5 },
        { x, z: NET_Z - away * 0.6, h: 0, arc: 0.2 },
      ],
      hit: { x, z: NET_Z - away * 0.6 },
    };
  }

  const landD = NET_Z - o.shot.landDepth; // metres in front of the opponent's back wall
  const landZ = zAt(landD);
  const wallSign = o.landX !== 0 ? Math.sign(o.landX) : 1;
  const path: Waypoint[] = [start, { x: o.landX, z: landZ, h: 0, arc: ARC_BY_HEIGHT[o.shot.out] }];

  // A serve to the glass can be taken straight after the bounce.
  const afterBounce = o.shot.wall === 'none' || (o.shot.kind === 'serve' && o.receive === 'bounce');
  let hit: CourtPos;

  if (afterBounce) {
    hit = { x: o.landX, z: zAt(Math.max(MIN_DEPTH, landD - BOUNCE_RUN)) };
  } else if (o.shot.wall === 'side') {
    const wallD = clamp(landD - SIDE_WALL_RUN, MIN_DEPTH, 9);
    path.push({ x: wallSign * 5, z: zAt(wallD), h: 1.4, arc: 0.5 });
    hit = { x: wallSign * (5 - SIDE_WALL_DROP_X), z: zAt(Math.max(MIN_DEPTH, wallD - 0.3)) };
  } else if (o.shot.wall === 'back') {
    path.push({ x: o.landX, z: opponentBackZ, h: 1.4, arc: 0.5 });
    hit = { x: o.landX * 0.9, z: zAt(clamp(landD + BACK_WALL_REBOUND, 2.5, 9)) };
  } else {
    // Rulo: into the mesh above the glass; the ball drops down along the fence.
    const wallD = clamp(landD - 1, MIN_DEPTH, 9);
    path.push({ x: wallSign * 5, z: zAt(wallD), h: 2.5, arc: 0.8 });
    hit = { x: wallSign * 4.2, z: zAt(Math.max(MIN_DEPTH, wallD - 0.3)) };
  }

  if (o.outcome === 'ace' || o.outcome === 'winner') {
    // Past the defender: ends against the back wall.
    const last = path[path.length - 1];
    if (last.z !== opponentBackZ) path.push({ x: last.x * 0.9, z: opponentBackZ, h: 0.7, arc: 0.3 });
    return { path, hit };
  }

  path.push({ x: hit.x, z: hit.z, h: HIT_HEIGHT_M, arc: afterBounce ? 0.7 : 0.3 });
  if (o.outcome === 'intercept') {
    // The defender turns it around and it flies past the original hitter.
    path.push({ x: o.from.x, z: ownBackZ, h: 0.8, arc: 0.6 });
  }
  return { path, hit };
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

/** How long a flight should take, in milliseconds. Short: the game should feel quick. */
export function flightDuration(path: Waypoint[]): number {
  return Math.min(900, 220 + 140 * (path.length - 1));
}
