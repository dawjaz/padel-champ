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
  /** The server's partner stands in the middle of their own quarter: the lane the server is NOT in. */
  partner: CourtPos;
  receiver: CourtPos;
  receiverPartner: CourtPos;
}

/** How far from the net the server's partner stands during the serve: a third of a half-court (the middle of the service box). */
export const SERVE_PARTNER_DEPTH = 10 / 3;

export function serveSetup(servingSide: SideIndex, pointsPlayed: number): ServeSetup {
  const lane = serveLane(servingSide, pointsPlayed);
  const recvSide: SideIndex = servingSide === 0 ? 1 : 0;
  const receiverLane = -lane as LaneSign;
  const backZ = formationZ(recvSide, 'back');
  return {
    lane,
    receiverIdx: indexOfLane(receiverLane),
    server: { x: lane * LANE_X, z: servingSide === 0 ? 18.5 : 1.5 },
    partner: { x: -lane * LANE_X, z: servingSide === 0 ? NET_Z + SERVE_PARTNER_DEPTH : NET_Z - SERVE_PARTNER_DEPTH },
    receiver: { x: receiverLane * LANE_X, z: backZ },
    receiverPartner: { x: -receiverLane * LANE_X, z: backZ },
  };
}
