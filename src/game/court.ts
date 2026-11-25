import { aimSkill, aimSpreadMul } from './attributes';
import type { CourtPos, Direction, Formation, LaneSign, Rng, SideIndex } from './types';

/**
 * Court geometry for the rules (pure). Metres: x across (-5..5), z along
 * (0 = far baseline, 10 = net, 20 = near baseline). Side 0 is the near team, side 1 the far team.
 *
 * Each player owns a lane: index 0 = screen left (x = -2.5), index 1 = screen right (x = +2.5),
 * on both teams. So "parallel" from index i goes to index i on the other side, "cross" to the other index.
 */
export const LANE_X = 2.5;
export const NET_Z = 10;

export function laneSign(idx: number): LaneSign {
  return idx === 0 ? -1 : 1;
}

export function laneX(idx: number): number {
  return laneSign(idx) * LANE_X;
}

export function indexOfLane(sign: LaneSign): number {
  return sign === -1 ? 0 : 1;
}

/** Who receives the ball: parallel = same index, cross = the other one, middle = either (random). */
export function defenderIndex(hitterIdx: number, direction: Direction, rng: Rng): number {
  if (direction === 'parallel') return hitterIdx;
  if (direction === 'cross') return 1 - hitterIdx;
  return rng() < 0.5 ? 0 : 1;
}

/** Where the ball first lands (x) for a rally shot, given who it is aimed at. */
export function landingX(direction: Direction, defenderIdx: number): number {
  const sign = laneSign(defenderIdx);
  if (direction === 'parallel') return sign * 3.6;
  if (direction === 'cross') return sign * 2.5;
  return sign * 0.3;
}

/** Number of different points the ball can be aimed at inside one direction (across the court), and in depth. */
export const AIM_POINTS_X = 10;
export const AIM_POINTS_DEPTH = 20;
/** Half-width (m) of the strip of aim points around the centre of a direction. */
const AIM_HALF_WIDTH = 0.9;
/** The aim points in depth spread this far (m) around the shot's usual landing depth. */
const AIM_HALF_DEPTH = 1.5;

/** One of the 10 aim points of a direction, chosen at random. */
export function aimX(direction: Direction, defenderIdx: number, rng: Rng, prefer?: number, accuracy = 5): number {
  let k = Math.min(AIM_POINTS_X - 1, Math.floor(rng() * AIM_POINTS_X));
  const point = (i: number): number =>
    Math.max(-4.6, Math.min(4.6, landingX(direction, defenderIdx) + ((i - (AIM_POINTS_X - 1) / 2) / ((AIM_POINTS_X - 1) / 2)) * AIM_HALF_WIDTH * aimSpreadMul(accuracy)));
  if (prefer !== undefined && rng() < aimSkill(accuracy)) {
    // a good hitter finds the gap: the aim point nearest to where the ball should go
    // the nearest aim points; equally near ones (a ball aimed exactly between two) are chosen at random, not always the first
    const dist = Array.from({ length: AIM_POINTS_X }, (_, i) => Math.abs(point(i) - prefer));
    const nearest = Math.min(...dist);
    const ties = dist.flatMap((d, i) => (d <= nearest + 1e-9 ? [i] : []));
    k = ties.length === 1 ? ties[0] : ties[Math.min(ties.length - 1, Math.floor(rng() * ties.length))];
  }
  return point(k);
}
/** Spread (m, either way at accuracy 5) of a ball aimed at a point the player chose: across and in depth. */
export const TARGET_SPREAD_X = 0.6;
export const TARGET_SPREAD_DEPTH = 0.9;

/**
 * A ball aimed at a point the player tapped (x across, depth past the net): it comes down around it, a triangular spread that grows
 * for a less accurate (or tired) hitter. Kept on the court (|x| <= 4.6, depth 1..9.4).
 */
export function targetLanding(target: { x: number; depth: number }, rng: Rng, accuracy = 5): { x: number; depth: number } {
  const k = aimSpreadMul(accuracy);
  const tri = (): number => rng() + rng() - 1;
  return {
    x: Math.max(-4.6, Math.min(4.6, target.x + tri() * TARGET_SPREAD_X * k)),
    depth: Math.max(1, Math.min(9.4, target.depth + tri() * TARGET_SPREAD_DEPTH * k)),
  };
}

/** Extra error risk of a chosen target right behind the net (into the net) or at the back glass (straight into it). Side walls: `edgeRisk`. */
export function targetRisk(depth: number): number {
  return Math.max(0, 1.6 - depth) * 0.08 + Math.max(0, depth - 8.6) * 0.1;
}

/** How often a CPU hitter really hits the aim point he wants (otherwise the point is random, he misses his spot a little). */
export const AIM_SKILL = 0.75;

/** One of the 20 aim points in depth around `base` metres past the net, chosen at random. */
export function aimDepth(base: number, rng: Rng, spread = AIM_HALF_DEPTH, prefer?: number, accuracy = 5): number {
  let k = Math.min(AIM_POINTS_DEPTH - 1, Math.floor(rng() * AIM_POINTS_DEPTH));
  const point = (i: number): number =>
    Math.max(1, Math.min(9, base + ((i - (AIM_POINTS_DEPTH - 1) / 2) / ((AIM_POINTS_DEPTH - 1) / 2)) * spread * aimSpreadMul(accuracy)));
  if (prefer !== undefined && rng() < aimSkill(accuracy)) {
    k = 0;
    for (let i = 1; i < AIM_POINTS_DEPTH; i++) if (Math.abs(point(i) - prefer) < Math.abs(point(k) - prefer)) k = i;
  }
  return point(k);
}

/**
 * The lane the server stands in. The serve alternates between the left and the right side of the
 * server's own court every point of a game, LEFT first (the second point is served from the right, and so on).
 * A second serve after a fault is taken from the same side. The near team looks up the screen, so its left
 * is -x; the far team looks down the screen, so its left is +x.
 */
export function serveLane(servingSide: SideIndex, pointsPlayed: number, receiverIdx?: number): LaneSign {
  // Star Point: the receiving pair chose who receives, so the server stands in the opposite lane (the serve is cross).
  if (receiverIdx !== undefined) return -laneSign(receiverIdx) as LaneSign;
  const ownLeft: LaneSign = servingSide === 0 ? -1 : 1;
  return pointsPlayed % 2 === 0 ? ownLeft : (-ownLeft as LaneSign);
}

export function formationZ(side: SideIndex, formation: Formation): number {
  if (formation === 'net') return side === 0 ? 12 : 8;
  if (formation === 'mid') return side === 0 ? 14.5 : 5.5;
  return side === 0 ? 17.5 : 2.5;
}

export function restPos(side: SideIndex, idx: number, formation: Formation): CourtPos {
  return { x: laneX(idx), z: formationZ(side, formation) };
}

/**
 * Reach of a defender: the ball is played at his full strength within `REACH_FULL` of his radius; further away he is stretched
 * (his defence falls evenly) down to `REACH_MIN` of it at `REACH_FAR` radii and beyond. The radius grows with his speed
 * (2.9 m at speed 5). Distances in depth count a little less (`REACH_DEPTH_WEIGHT`): a step forward or back is quicker than a dive sideways.
 */
export const REACH_BASE = 2.2;
export const REACH_PER_SPEED = 0.14;
export const REACH_FULL = 0.5;
export const REACH_FAR = 1.5;
export const REACH_MIN = 0.55;
export const REACH_DEPTH_WEIGHT = 0.6;
/** A lob goes over the defenders: they turn and run, so the reach never takes more than this share of their defence. */
export const REACH_LOB_MIN = 0.75;

export const reachRadius = (speed: number): number => REACH_BASE + REACH_PER_SPEED * speed;

/**
 * Time of flight: a defender can run further against a slow ball, and less against a fast one. The reach is scaled by
 * (flight time / REACH_REF_TIME) ^ REACH_TIME_EXP, kept between REACH_TIME_MIN and REACH_TIME_MAX. A ball with an arc (a lob) is in the
 * air for at least the time of a free fall from its apex up and down.
 */
export const REACH_REF_TIME = 0.8;
export const REACH_TIME_EXP = 0.35;
export const REACH_TIME_MIN = 0.8;
export const REACH_TIME_MAX = 1.3;
/** Distance (m) from the hitter to the landing spot that is assumed when his position is not known. */
export const REACH_DEFAULT_RUN = 16;

/** Seconds the ball is in the air for a shot of speed `speed` (m/s) and arc height `apex` (m) over `dist` metres. */
export const flightTime = (speed: number, apex: number, dist: number): number => Math.max(dist / Math.max(speed, 1), apex > 0 ? 2 * Math.sqrt((2 * apex) / 9.81) : 0);

/** Scale of the reach for a ball that is `seconds` in the air. */
export const reachTimeFactor = (seconds: number, max = REACH_TIME_MAX): number => Math.max(REACH_TIME_MIN, Math.min(max, Math.pow(seconds / REACH_REF_TIME, REACH_TIME_EXP)));
/** A lob hangs in the air for two seconds: the time can add more to the reach than for a flat ball. */
export const REACH_LOB_TIME_MAX = 1.6;

/** Share (REACH_MIN to 1) of his defence a defender keeps when the ball comes down `gap` metres away (see `reachGap`). */
export function reachFactor(gap: number, radius: number, floor = REACH_MIN): number {
  const t = (gap / radius - REACH_FULL) / (REACH_FAR - REACH_FULL);
  return Math.max(floor, Math.min(1, 1 - t * (1 - REACH_MIN)));
}

/** How far (m, depth weighted) from the defender at `spot` a ball that comes down at (landX, landZ) is. */
export const reachGap = (spot: CourtPos, landX: number, landZ: number): number => Math.hypot(landX - spot.x, REACH_DEPTH_WEIGHT * (landZ - spot.z));

/** The z (m) where a ball hit `depth` metres past the net comes down in the court of `defSide`. */
export const landingZ = (defSide: SideIndex, depth: number): number => (defSide === 0 ? NET_Z + depth : NET_Z - depth);

export interface ServeSetup {
  /** Lane the server stands in (serves cross to the opposite lane). */
  lane: LaneSign;
  receiverIdx: number;
  server: CourtPos;
  /** The server's partner never leaves their own lane; they stand a third of the way back from the net. */
  partner: CourtPos;
  receiver: CourtPos;
  receiverPartner: CourtPos;
}

/** How far from the net the server's partner stands during the serve: a third of a half-court (the middle of the service box). */
export const SERVE_PARTNER_DEPTH = 10 / 3;
/** A server who has to serve from the other half of the court than their own lane stands just beside the centre mark. */
export const CENTRE_SERVE_X = 0.9;

/**
 * Partners keep their own halves: when the point is served from the opposite side to the server's own lane,
 * the server steps over to the centre mark, but the partner does not swap sides.
 */
export function serveSetup(
  servingSide: SideIndex,
  pointsPlayed: number,
  serverIdx: number,
  /** Set at the Star Point, when the receiving pair chooses which of them receives. */
  receiverChoice?: number,
): ServeSetup {
  const lane = serveLane(servingSide, pointsPlayed, receiverChoice);
  const recvSide: SideIndex = servingSide === 0 ? 1 : 0;
  const receiverLane = -lane as LaneSign;
  const backZ = formationZ(recvSide, 'back');
  const ownLane = laneSign(serverIdx);
  return {
    lane,
    receiverIdx: indexOfLane(receiverLane),
    server: { x: lane === ownLane ? lane * LANE_X : lane * CENTRE_SERVE_X, z: servingSide === 0 ? 18.5 : 1.5 },
    partner: { x: laneX(1 - serverIdx), z: servingSide === 0 ? NET_Z + SERVE_PARTNER_DEPTH : NET_Z - SERVE_PARTNER_DEPTH },
    receiver: { x: receiverLane * LANE_X, z: backZ },
    receiverPartner: { x: -receiverLane * LANE_X, z: backZ },
  };
}
