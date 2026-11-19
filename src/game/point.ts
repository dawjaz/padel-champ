import { DIRECTIONS } from './catalog';
import { defenderIndex, indexOfLane, serveLane } from './court';
import { resolveHit, resolveServe, spendGuts, type HitOutcome } from './engine';
import type { BallState, Direction, Formation, Height, LaneSign, LobQuality, PlayerDef, ReceiveMode, Rng, ShotDef, SideIndex } from './types';

/** A high, slow arc that is meant to send the opponents back. */
export const isLob = (shot: ShotDef): boolean => shot.flight.apex >= 3;
/** Share of lobs that are good (deep into the court); the rest are weak (mid-court or close to the net). */
export const LOB_DEEP_CHANCE = 0.7;
const DEFAULT_REBOUND: Record<Height, number> = { low: 0.3, mid: 0.4, high: 0.3 };

/**
 * One point as a pure state machine: serve -> return -> rally. The scene (or a simulation) calls
 * `stepServe` / `stepHit` with a chosen shot and animates the returned `Step`.
 */
export type Teams = [PlayerDef[], PlayerDef[]];
export type PointStatus = 'serve' | 'rally' | 'done';

export interface PointState {
  servingSide: SideIndex;
  serverIdx: number;
  /** Lane the server stands in (the serve goes cross to the other lane). */
  serveLane: LaneSign;
  receiverIdx: number;
  status: PointStatus;
  /** 1 or 2 (second serve after a fault). */
  attempt: 1 | 2;
  /** Hits made in the rally, not counting the serve. */
  hits: number;
  /** Side that has to act now. */
  holder: SideIndex;
  /** Index of the player that has to act now. */
  hitterIdx: number;
  ball: BallState;
  formation: [Formation, Formation];
  guts: Record<string, number>;
  winner: SideIndex | null;
}

export type StepOutcome = 'fault' | 'double-fault' | 'ace' | 'in' | HitOutcome;

export interface Step {
  kind: 'serve' | 'return' | 'rally';
  side: SideIndex;
  attackerIdx: number;
  defenderIdx: number;
  shot: ShotDef;
  direction: Direction;
  outcome: StepOutcome;
  /** Set when this step ended the point. */
  pointWinner: SideIndex | null;
  tired: boolean;
  /** Height-fit multiplier (1 for serves). */
  fit: number;
  /** Where the receiver takes the ball: after the first bounce or after the wall. */
  receive: ReceiveMode;
  /** The next ball is played after it has come off the back glass. */
  glass?: boolean;
  /** Height class of the next ball when it is played (after the glass, the height it rebounds to). */
  arrival?: Height;
  /** Quality of a lob. */
  lob?: LobQuality;
  /** Overrides the shot's landing depth (a weak lob lands short). */
  landDepth?: number;
}

export interface StepResult {
  state: PointState;
  step: Step;
}

const other = (s: SideIndex): SideIndex => (s === 0 ? 1 : 0);

export function startPoint(
  guts: Record<string, number>,
  servingSide: SideIndex,
  serverIdx: number,
  pointsPlayed: number,
): PointState {
  const lane = serveLane(servingSide, pointsPlayed);
  return {
    servingSide,
    serverIdx,
    serveLane: lane,
    receiverIdx: indexOfLane(-lane as LaneSign),
    status: 'serve',
    attempt: 1,
    hits: 0,
    holder: servingSide,
    hitterIdx: serverIdx,
    ball: { height: 'mid', pressure: 0 },
    formation: ['back', 'back'],
    guts: { ...guts },
    winner: null,
  };
}

/**
 * How formations change after a shot: the hitter's team may move, and a high ball sends the opponents back. A weak
 * lob (lands mid-court or close to the net) does not: players at the net stay there, the others come to mid-court,
 * so they can smash it.
 */
export function nextFormation(
  current: [Formation, Formation],
  hitterSide: SideIndex,
  shot: ShotDef,
  lob?: LobQuality,
): [Formation, Formation] {
  const f: [Formation, Formation] = [current[0], current[1]];
  if (shot.advance !== 'stay') f[hitterSide] = shot.advance;
  if (shot.out === 'high') {
    const def = other(hitterSide);
    f[def] = lob === 'weak' ? (current[def] === 'net' ? 'net' : 'mid') : 'back';
  }
  return f;
}

/** Why the shot cannot be played now (text for the button), or null when it can. */
export function unavailableReason(shot: ShotDef, state: PointState): string | null {
  const r = shot.requires;
  if (!r) return null;
  if (r.formations && !r.formations.includes(state.formation[state.holder])) return r.hint;
  if (r.heights && !r.heights.includes(state.ball.height)) return r.hint;
  if (r.glass !== undefined && (state.ball.glass === true) !== r.glass) return r.hint;
  if (r.weakLob && state.ball.lob !== 'weak') return r.hint;
  return null;
}

/** The shots of this kind that can be played in the current state. */
export function playableShots(shots: ShotDef[], state: PointState): ShotDef[] {
  return shots.filter((s) => unavailableReason(s, state) === null);
}

function pickRebound(weights: Record<Height, number>, rng: Rng): Height {
  const order: Height[] = ['low', 'mid', 'high'];
  const total = order.reduce((a, h) => a + weights[h], 0);
  let roll = rng() * total;
  for (const h of order) {
    roll -= weights[h];
    if (roll <= 0) return h;
  }
  return 'high';
}

/**
 * What the next ball is like: a lob is good (deep) 70% of the time and weak (short) 30%; a ball that reaches the back
 * glass comes off it low, mid or high. `rng` is called once for the lob quality (lobs only), once for the weak
 * lob's depth, once for the glass (when the shot can reach it) and once for the rebound height.
 */
function nextBall(
  shot: ShotDef,
  pressure: number,
  rng: Rng,
): { ball: BallState; glass: boolean; arrival: Height; lob?: LobQuality; landDepth?: number } {
  let lob: LobQuality | undefined;
  let landDepth: number | undefined;
  if (isLob(shot)) {
    lob = rng() < LOB_DEEP_CHANCE ? 'deep' : 'weak';
    if (lob === 'weak') {
      const [lo, hi] = shot.weakDepth ?? [2.5, 5.5];
      landDepth = lo + rng() * (hi - lo);
    }
  }
  const chance = lob === 'weak' ? 0 : shot.glassChance ?? 0;
  const glass = chance > 0 && rng() < chance;
  const arrival: Height = glass ? pickRebound(shot.rebound ?? DEFAULT_REBOUND, rng) : shot.out;
  return { ball: { height: arrival, pressure, lob, glass }, glass, arrival, lob, landDepth };
}

export function stepServe(
  teams: Teams,
  state: PointState,
  shot: ShotDef,
  rng: Rng,
  receive: ReceiveMode = 'wall',
): StepResult {
  if (state.status !== 'serve') throw new Error('Point is not at the serve');
  const side = state.servingSide;
  const recvSide = other(side);
  const server = teams[side][state.serverIdx];
  const receiver = teams[recvSide][state.receiverIdx];

  const res = resolveServe(server, state.guts[server.id], shot, receiver, DIRECTIONS.cross, rng, receive);
  const guts = { ...state.guts, [server.id]: spendGuts(state.guts[server.id], shot.cost) };

  const base = {
    kind: 'serve' as const,
    side,
    attackerIdx: state.serverIdx,
    defenderIdx: state.receiverIdx,
    shot,
    direction: 'cross' as const,
    tired: res.tired,
    fit: 1,
    // Only a serve that goes to a wall gives the receiver a choice.
    receive: shot.wall === 'none' ? ('bounce' as const) : receive,
  };

  if (res.outcome === 'fault') {
    if (state.attempt === 1) {
      return { state: { ...state, guts, attempt: 2 }, step: { ...base, outcome: 'fault', pointWinner: null } };
    }
    return {
      state: { ...state, guts, status: 'done', winner: recvSide },
      step: { ...base, outcome: 'double-fault', pointWinner: recvSide },
    };
  }
  if (res.outcome === 'ace') {
    return {
      state: { ...state, guts, status: 'done', winner: side },
      step: { ...base, outcome: 'ace', pointWinner: side },
    };
  }

  const formation = nextFormation(['back', 'back'], side, shot);
  formation[recvSide] = 'back';
  const offGlass = shot.wall !== 'none' && base.receive === 'wall';
  return {
    state: {
      ...state,
      guts,
      status: 'rally',
      hits: 0,
      holder: recvSide,
      hitterIdx: state.receiverIdx,
      ball: { height: shot.out, pressure: res.pressure, glass: offGlass },
      formation,
    },
    step: { ...base, outcome: 'in', pointWinner: null, glass: offGlass, arrival: shot.out },
  };
}

export function stepHit(
  teams: Teams,
  state: PointState,
  shot: ShotDef,
  chosenDirection: Direction,
  rng: Rng,
): StepResult {
  if (state.status !== 'rally') throw new Error('Point is not in the rally');
  if (unavailableReason(shot, state) !== null) throw new Error(`${shot.id} cannot be played now`);
  const side = state.holder;
  const defSide = other(side);
  const direction: Direction = shot.fixedDirection ?? chosenDirection;
  const attacker = teams[side][state.hitterIdx];
  const defIdx = defenderIndex(state.hitterIdx, direction, rng);
  const defender = teams[defSide][defIdx];

  const res = resolveHit({
    attacker,
    attackerGuts: state.guts[attacker.id],
    shot,
    direction: DIRECTIONS[direction],
    incoming: state.ball,
    defender,
    rallyLength: state.hits,
    rng,
  });
  const guts = { ...state.guts, [attacker.id]: spendGuts(state.guts[attacker.id], shot.cost) };

  const step: Step = {
    kind: state.hits === 0 ? 'return' : 'rally',
    side,
    attackerIdx: state.hitterIdx,
    defenderIdx: defIdx,
    shot,
    direction,
    outcome: res.outcome,
    pointWinner: null,
    tired: res.tired,
    fit: res.fit,
    // Balls that go to a wall are always taken after the wall, the others after the bounce.
    receive: shot.wall === 'none' ? 'bounce' : 'wall',
  };

  if (res.outcome === 'continue') {
    const next = nextBall(shot, res.pressure, rng);
    return {
      state: {
        ...state,
        guts,
        hits: state.hits + 1,
        holder: defSide,
        hitterIdx: defIdx,
        ball: next.ball,
        formation: nextFormation(state.formation, side, shot, next.lob),
      },
      step: { ...step, glass: next.glass, arrival: next.arrival, lob: next.lob, landDepth: next.landDepth },
    };
  }

  // winner: the hitter scores. error / intercept: the other side scores.
  const winner = res.outcome === 'winner' ? side : defSide;
  return {
    state: { ...state, guts, hits: state.hits + 1, status: 'done', winner },
    step: { ...step, pointWinner: winner },
  };
}
