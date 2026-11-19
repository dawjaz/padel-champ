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
export function aimX(direction: Direction, defenderIdx: number, rng: Rng): number {
  const k = Math.min(AIM_POINTS_X - 1, Math.floor(rng() * AIM_POINTS_X));
  const offset = ((k - (AIM_POINTS_X - 1) / 2) / ((AIM_POINTS_X - 1) / 2)) * AIM_HALF_WIDTH;
  return Math.max(-4.6, Math.min(4.6, landingX(direction, defenderIdx) + offset));
}

/** One of the 20 aim points in depth around `base` metres past the net, chosen at random. */
export function aimDepth(base: number, rng: Rng, spread = AIM_HALF_DEPTH): number {
  const k = Math.min(AIM_POINTS_DEPTH - 1, Math.floor(rng() * AIM_POINTS_DEPTH));
  const offset = ((k - (AIM_POINTS_DEPTH - 1) / 2) / ((AIM_POINTS_DEPTH - 1) / 2)) * spread;
  return Math.max(1, Math.min(9, base + offset));
}

/**
 * The lane the server stands in. The serve alternates between the left and the right side of the
 * server's own court every point of a game, LEFT first (the second point is served from the right, and so on).
 * A second serve after a fault is taken from the same side. The near team looks up the screen, so its left
 * is -x; the far team looks down the screen, so its left is +x.
 */
export function serveLane(servingSide: SideIndex, pointsPlayed: number): LaneSign {
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
export function serveSetup(servingSide: SideIndex, pointsPlayed: number, serverIdx: number): ServeSetup {
  const lane = serveLane(servingSide, pointsPlayed);
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
