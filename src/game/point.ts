import { DIRECTIONS } from './catalog';
import { aimDepth, aimX, defenderIndex, flightTime, indexOfLane, landingZ, REACH_DEFAULT_RUN, REACH_LOB_MIN, reachFactor, reachGap, reachRadius, reachTimeFactor, restPos, serveLane } from './court';
import { fatigued } from './attributes';
import { resolveHit, resolveServe, SECOND_SERVE_RETURN, spendGuts, WINNER_MARGIN, type HitOutcome } from './engine';
import type { AimPreference, BallState, CourtPos, Direction, ErrorKind, Formation, Height, LaneSign, LobQuality, Zone, PlayerDef, ReceiveMode, Rng, ShotDef, SideIndex } from './types';

/** A high, slow arc that is meant to send the opponents back. */
export const isLob = (shot: ShotDef): boolean => shot.flight.apex >= 3;

/** Where the players really stand (the scene knows, the engine otherwise assumes the places of their formation). */
export interface ReachPositions {
  /** The two defenders. */
  defenders?: [CourtPos, CourtPos];
  /** The hitter: how far the ball has to fly decides how much time the defenders have. */
  hitter?: CourtPos;
}

/**
 * How much of his defence a defender keeps against a ball that comes down at (landX, depth m past the net): the nearer of the two
 * defenders counts. His reach grows with his speed and with the time the ball is in the air (a slow or high ball can be run down, a
 * hard flat one cannot). 1 = the ball is within his reach, down to REACH_MIN when it is far from both. A lob can be run down (never
 * below REACH_LOB_MIN). Without `at` the defenders are at the places of their formation and the hitter is assumed REACH_DEFAULT_RUN away.
 */
export function reachAgainst(defenders: [PlayerDef, PlayerDef], defSide: SideIndex, formation: Formation, shot: ShotDef, landX: number, depth: number, at: ReachPositions = {}): number {
  const z = landingZ(defSide, depth);
  const dist = at.hitter ? Math.hypot(landX - at.hitter.x, z - at.hitter.z) : REACH_DEFAULT_RUN;
  const time = reachTimeFactor(flightTime(shot.flight.speed, shot.flight.apex, dist));
  let best = 0;
  for (let i = 0; i < 2; i++) {
    const spot = at.defenders ? at.defenders[i] : restPos(defSide, i, formation);
    const f = reachFactor(reachGap(spot, landX, z), reachRadius(defenders[i].stats.speed) * time, isLob(shot) ? REACH_LOB_MIN : undefined);
    best = Math.max(best, f);
  }
  return best;
}
/**
 * Shares of the three kinds of lob: deep (into the court, it bounces), medium (the back third, played out of the air with a
 * vibora or a bandeja) and weak (mid-court or close to the net, smash); the rest is weak.
 */
export const LOB_DEEP_CHANCE = 0.55;
export const LOB_MEDIUM_CHANCE = 0.25;
/** A lob played from a high or a mid ball is better prepared: it goes deep more often. */
export const LOB_DEEP_CHANCE_HIGH_BALL = 0.75;
export const LOB_MEDIUM_CHANCE_HIGH_BALL = 0.15;
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
  /** The second serve after a fault (slower, easier to return). */
  second?: boolean;
  /** Power of the hitter now relative to his own (fatigue, the return of a second serve): scales the ball speed. */
  powerFactor?: number;
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
  /** Overrides the shot's landing depth (a weak lob lands short; other shots pick one of 20 depths). */
  landDepth?: number;
  /** One of the 10 aim points of the chosen direction (x, metres). */
  landX?: number;
  /** The defender at the net blocks the ball out of the air. */
  block?: boolean;
  /** A defender in mid-court takes the ball out of the air this far (m) from the net (set together with `block`). */
  airDist?: number;
  /** Por Cuatro: the defender tried to take it before the glass and fumbled it (the point goes to the hitter). */
  earlyError?: boolean;
  /** Por Cuatro that was not hit well: the ball comes back off the glass and the defender, now at the net, plays it back. */
  netReturn?: boolean;
  /** A hard ball that comes off the glass or the fence so fast that it flies back over the net: the point is the attackers' (nobody touches it). */
  reboundBack?: boolean;
  /** Serve: the receiver did not decide in time and never touched the ball, so it is an ace. */
  late?: boolean;
  /** How a mistake or a fault ends (the net, the back glass, the mesh above it). */
  errorKind?: ErrorKind;
}

export interface StepResult {
  state: PointState;
  step: Step;
}

const other = (s: SideIndex): SideIndex => (s === 0 ? 1 : 0);

/** The name shown for a Por Cuatro that does not fly out over the back glass. */
export const POWERFUL_SMASH = 'Powerful Smash';

/**
 * A real Por Cuatro bounces flat in the front of the court and flies out over the back glass. When the ball instead comes off the
 * back glass and back into the opponents' court (the deeper winner, or a mishit that the defender plays back from the net), the
 * shot is not a Por Cuatro any more: it is a Powerful Smash.
 */
export function isPowerfulSmash(step: Pick<Step, 'shot' | 'reboundBack' | 'netReturn'>): boolean {
  return step.shot.id === 'smash_x4' && (step.reboundBack === true || step.netReturn === true);
}

/** The shot's name as the player is told it (a Por Cuatro that stays in the court is a Powerful Smash). */
export function shotLabel(step: Pick<Step, 'shot' | 'reboundBack' | 'netReturn'>): string {
  return isPowerfulSmash(step) ? POWERFUL_SMASH : step.shot.name;
}

export function startPoint(
  guts: Record<string, number>,
  servingSide: SideIndex,
  serverIdx: number,
  pointsPlayed: number,
  /** Star Point only: the receiving pair's choice of who receives (decides the serving lane). */
  receiverChoice?: number,
): PointState {
  const lane = serveLane(servingSide, pointsPlayed, receiverChoice);
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
 * How formations change after a shot. The hitter's team fights for the net:
 *  - net shots (volley, smash, ...) keep or take the net;
 *  - after a lob the hitter has time to get to the net (after a weak lob only to mid-court);
 *  - after any other shot from the back the hitter comes up to mid-court;
 *  - from mid-court, when the opponents are (or are being sent) back, the hitter takes the net.
 * A high ball sends the opponents back; a weak lob (lands mid-court or close to the net) does not: players at the net stay
 * there, the others come to mid-court, so they can smash it.
 */
export function nextFormation(
  current: [Formation, Formation],
  hitterSide: SideIndex,
  shot: ShotDef,
  lob?: LobQuality,
): [Formation, Formation] {
  const f: [Formation, Formation] = [current[0], current[1]];
  const def = other(hitterSide);
  if (shot.out === 'high') f[def] = lob === 'weak' ? (current[def] === 'net' ? 'net' : 'mid') : lob === 'medium' ? 'mid' : 'back';

  const from = current[hitterSide];
  let to: Formation;
  if (shot.advance === 'net') to = 'net';
  else if (isLob(shot)) to = lob === 'weak' || lob === 'medium' ? (from === 'net' ? 'net' : 'mid') : 'net';
  else if (from === 'net') to = 'net';
  else if (from === 'mid') to = f[def] === 'back' ? 'net' : 'mid';
  else to = 'mid';
  f[hitterSide] = to;
  return f;
}

/** A ball that comes down this far from the centre line (m) or further is right by a side wall. */
export const NEAR_WALL_X = 3;

/** The zone a ball comes down in, from how far past the net it lands (metres). */
export function zoneOf(depth: number): Zone {
  return depth < 3.5 ? 'net' : depth < 7 ? 'mid' : 'back';
}

/** Why the shot cannot be played now (text for the button), or null when it can. */
export function unavailableReason(shot: ShotDef, state: PointState): string | null {
  const r = shot.requires;
  if (!r) return null;
  if (r.formations && !r.formations.includes(state.formation[state.holder])) return r.hint;
  if (r.heights && !r.heights.includes(state.ball.height)) return r.hint;
  if (r.glass !== undefined && (state.ball.glass === true) !== r.glass) return r.hint;
  if (r.air === true && state.ball.air !== true) return r.hint;
  if (r.air === false && state.ball.air === true) return r.hint;
  if (r.oppFormations && !r.oppFormations.includes(state.formation[other(state.holder)])) return r.hint;
  if (r.minBallSpeed !== undefined && (state.ball.speed ?? 0) < r.minBallSpeed) return r.hint;
  if (r.nearWall === true && state.ball.nearWall !== true) return r.hint;
  if (r.weakLob && state.ball.lob !== 'weak') return r.hint;
  if (r.zones && (state.ball.zone === undefined || !r.zones.includes(state.ball.zone))) return r.hint;
  return null;
}

/** The shots of this kind that can be played in the current state. */
export function playableShots(shots: ShotDef[], state: PointState): ShotDef[] {
  return shots.filter((s) => unavailableReason(s, state) === null);
}

const DEFAULT_ERRORS: Record<ErrorKind, number> = { net: 0.6, glass: 0.25, mesh: 0.15, side: 0, long: 0, bouncemesh: 0 };
/** How a faulted serve ends: not only the net but also out in several ways (a serve to a wall can also hit the wall low first or bounce and land on the mesh). */
const SERVE_ERRORS: Record<ErrorKind, number> = { net: 0.3, glass: 0.12, mesh: 0, side: 0.18, long: 0.25, bouncemesh: 0.15 };
/** The mesh over the back glass is hit much less often than the glass: a ball that is too long goes low into the glass. */
const MESH_ERROR_SCALE = 0.35;

/**
 * How a lost ball ends: a roll on the weights of the shot. A ball aimed towards a side wall (|landX| over 2.2 m) often goes
 * straight into that wall instead (up to 55% at the very edge).
 */
export function pickErrorKind(shot: ShotDef, rng: Rng, landX?: number): ErrorKind {
  if (landX !== undefined && Math.abs(landX) > 2.2 && shot.wall !== 'fence') {
    const share = Math.min(0.55, ((Math.abs(landX) - 2.2) / 2.4) * 0.55);
    if (rng() < share) return 'side';
  }
  const serve = shot.kind === 'serve';
  const w = serve ? SERVE_ERRORS : (shot.errorKinds ?? DEFAULT_ERRORS);
  // Only a serve to a side wall can hit it low first or bounce and go on to the mesh.
  const weight = (k: ErrorKind): number =>
    serve && shot.wall === 'none' && (k === 'side' || k === 'bouncemesh') ? 0 : (w[k] ?? 0) * (k === 'mesh' ? MESH_ERROR_SCALE : 1);
  const order: ErrorKind[] = ['net', 'glass', 'mesh', 'side', 'long', 'bouncemesh'];
  const total = order.reduce((a, k) => a + weight(k), 0);
  let roll = rng() * total;
  for (const k of order) {
    roll -= weight(k);
    if (roll <= 0) return k;
  }
  return 'net';
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
  incoming: Height = 'low',
): { ball: BallState; glass: boolean; arrival: Height; lob?: LobQuality; landDepth?: number } {
  let lob: LobQuality | undefined;
  let landDepth: number | undefined;
  if (isLob(shot)) {
    const roll = rng();
    const deep = incoming === 'low' ? LOB_DEEP_CHANCE : LOB_DEEP_CHANCE_HIGH_BALL;
    const medium = incoming === 'low' ? LOB_MEDIUM_CHANCE : LOB_MEDIUM_CHANCE_HIGH_BALL;
    lob = roll < deep ? 'deep' : roll < deep + medium ? 'medium' : 'weak';
    if (lob === 'weak') {
      const [lo, hi] = shot.weakDepth ?? [2.5, 5.5];
      landDepth = lo + rng() * (hi - lo);
    } else if (lob === 'medium') {
      const [lo, hi] = shot.mediumDepth ?? [5.8, 7.4];
      landDepth = lo + rng() * (hi - lo);
    }
  }
  const chance = lob === 'weak' || lob === 'medium' ? 0 : shot.glassChance ?? 0;
  const glass = chance > 0 && rng() < chance;
  const arrival: Height = glass ? pickRebound(shot.rebound ?? DEFAULT_REBOUND, rng) : shot.out;
  // A weak or medium lob is played out of the air (smash, vibora, bandeja); a deep lob bounces first, so nothing from the air is played to it.
  return { ball: { height: arrival, pressure, lob, glass, speed: shot.flight.speed, ...(lob === 'weak' || lob === 'medium' ? { air: true } : {}) }, glass, arrival, lob, landDepth };
}

export function stepServe(
  teams: Teams,
  state: PointState,
  shot: ShotDef,
  rng: Rng,
  receive: ReceiveMode = 'wall',
  /** The receiver ran out of time to decide: a serve that is in becomes an ace (a fault stays a fault). */
  late = false,
): StepResult {
  if (state.status !== 'serve') throw new Error('Point is not at the serve');
  const side = state.servingSide;
  const recvSide = other(side);
  const server = teams[side][state.serverIdx];
  const receiver = fatigued(teams[recvSide][state.receiverIdx], state.guts[teams[recvSide][state.receiverIdx].id]);

  const res = resolveServe(server, state.guts[server.id], shot, receiver, DIRECTIONS.cross, rng, receive, state.attempt === 2);
  const guts = { ...state.guts, [server.id]: spendGuts(state.guts[server.id], shot.cost) };

  const base = {
    kind: 'serve' as const,
    side,
    attackerIdx: state.serverIdx,
    defenderIdx: state.receiverIdx,
    shot,
    direction: 'cross' as const,
    tired: res.tired,
    second: state.attempt === 2,
    fit: 1,
    // Only a serve that goes to a wall gives the receiver a choice.
    receive: shot.wall === 'none' ? ('bounce' as const) : receive,
  };

  if (res.outcome === 'fault') {
    const errorKind = pickErrorKind(shot, rng);
    if (state.attempt === 1) {
      return { state: { ...state, guts, attempt: 2 }, step: { ...base, outcome: 'fault', pointWinner: null, errorKind } };
    }
    return {
      state: { ...state, guts, status: 'done', winner: recvSide },
      step: { ...base, outcome: 'double-fault', pointWinner: recvSide, errorKind },
    };
  }
  if (res.outcome === 'ace' || late) {
    return {
      state: { ...state, guts, status: 'done', winner: side },
      step: { ...base, outcome: 'ace', pointWinner: side, ...(late && res.outcome !== 'ace' ? { late: true } : {}) },
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
      ball: { height: shot.out, pressure: res.pressure, glass: offGlass, zone: zoneOf(shot.landDepth), speed: shot.flight.speed },
      formation,
    },
    step: { ...base, outcome: 'in', pointWinner: null, glass: offGlass, arrival: shot.out },
  };
}

/**
 * Where the ball is aimed: one of 10 points across the chosen direction (rolled first, it decides who plays the ball) and
 * one of 20 depths, at random. The rulo and the smashes that leave the court keep their fixed targets. `depth` is a depth
 * that is already set (a weak lob).
 */
function aimDepthFor(
  shot: ShotDef,
  rng: Rng,
  landX: number | undefined,
  depth?: number,
  preferDepth?: number,
  accuracy = 5,
): { landX?: number; landDepth?: number } {
  if (landX === undefined) return depth === undefined ? {} : { landDepth: depth };
  return { landX, landDepth: depth ?? aimDepth(shot.landDepth, rng, shot.depthSpread, preferDepth, accuracy) };
}

/**
 * A defender at the net takes the ball out of the air and finishes with a volley, instead of waiting for it to bounce and backing
 * off to mid-court: every ball he can reach (not a lob over him, not a smash or rulo that leaves the court) is played in front of the net.
 */
export function netVolley(shot: ShotDef, defenderFormation: Formation, lob: LobQuality | undefined): boolean {
  return (
    defenderFormation === 'net' &&
    lob === undefined &&
    shot.kind !== 'serve' &&
    !isLob(shot) &&
    shot.overFence !== true &&
    shot.wall !== 'fence'
  );
}

/** Por Cuatro: the share of defenders who go for it before the glass, the base risk of that, and where (m from the net) they play it. */
export const EARLY_TAKE = 0.35;
export const EARLY_TAKE_ERROR = 0.62;
export const EARLY_TAKE_DIST = 2.4;

/** Where (m from the net) the deeper kind of Por Cuatro winner lands: about 2 m from the back glass. */
export const REBOUND_WIN_DEPTH = 8;

function withFormation(f: [Formation, Formation], side: SideIndex, to: Formation): [Formation, Formation] {
  const r: [Formation, Formation] = [f[0], f[1]];
  r[side] = to;
  return r;
}

/** A ball that lands no deeper than this (m from the net) is taken out of the air by a defender in mid-court. */
export const AIR_TAKE_DEPTH = 7;

/**
 * A defender in mid-court takes a ball that is coming into the middle or the front two thirds of the court out of the air, instead of
 * waiting for the bounce. Returns the distance from the net (m) where he plays it, or undefined when he lets it bounce.
 */
export function airTake(shot: ShotDef, defenderFormation: Formation, lob: LobQuality | undefined, landDepth: number): number | undefined {
  if (defenderFormation !== 'mid' || lob !== undefined || landDepth > AIR_TAKE_DEPTH) return undefined;
  if (shot.kind === 'serve' || isLob(shot) || shot.overFence === true || shot.wall === 'fence' || shot.flight.speed < 6) return undefined;
  return Math.min(Math.max(landDepth * 0.6, 2.2), Math.max(landDepth * 0.75, 0.8), 4.2);
}

/** A shot at least this fast (m/s) that rebounds off the glass can fly back over the net. */
export const REBOUND_BACK_SPEED = 22;
/** ... when the attack beats the defence by at least this share of the winner margin (but not enough for a plain winner). */
export const REBOUND_BACK_SHARE = 0.8;

/** Free Practice: lets the player play any shot and decide how the hit ends. */
export interface HitOptions {
  /** 'rebound' = the ball comes off the glass and flies back over the net (a winner for the hitter). */
  force?: HitOutcome | 'rebound';
  /** Play the shot even if the ball does not meet the shot's requirements. */
  ignoreRequires?: boolean;
  /** The real positions of the players (see `ReachPositions`): the reach of the defenders is measured from where they stand. */
  positions?: ReachPositions;
}

export function stepHit(
  teams: Teams,
  state: PointState,
  shot: ShotDef,
  chosenDirection: Direction,
  rng: Rng,
  /** CPU / partner hitters: where they would like to put the ball (the gap in the opponents' set-up). */
  prefer?: AimPreference,
  options?: HitOptions,
): StepResult {
  if (state.status !== 'rally') throw new Error('Point is not in the rally');
  if (options?.ignoreRequires !== true && unavailableReason(shot, state) !== null) throw new Error(`${shot.id} cannot be played now`);
  const side = state.holder;
  const defSide = other(side);
  const direction: Direction = shot.fixedDirection ?? chosenDirection;
  const hitter = teams[side][state.hitterIdx];
  // Tired players are slower, weaker and less precise; whoever returns a second serve hits it with more power and accuracy.
  let attacker = fatigued(hitter, state.guts[hitter.id]);
  if (state.hits === 0 && state.attempt === 2) {
    attacker = { ...attacker, stats: { ...attacker.stats, power: attacker.stats.power * SECOND_SERVE_RETURN, accuracy: attacker.stats.accuracy * SECOND_SERVE_RETURN } };
  }
  const targetIdx = defenderIndex(state.hitterIdx, direction, rng);
  // The ball is aimed at one of 10 points; whoever of the two is closer to where it will come down plays it (they read the ball).
  const fixedAim = shot.overFence === true || shot.wall === 'fence';
  const landX = fixedAim ? undefined : aimX(direction, targetIdx, rng, prefer?.x, attacker.stats.accuracy);
  // A ball exactly on the centre line goes to the player it was aimed at (random for a middle ball), not always to the right-hand one.
  const defIdx = landX === undefined || Math.abs(landX) < 1e-6 ? targetIdx : landX < 0 ? 0 : 1;
  const defender = fatigued(teams[defSide][defIdx], state.guts[teams[defSide][defIdx].id]);

  const rolled = resolveHit({
    attacker,
    attackerGuts: state.guts[attacker.id],
    shot,
    direction: DIRECTIONS[direction],
    incoming: state.ball,
    defender,
    defenderFormation: state.formation[defSide],
    // The nominal landing spot decides (the real one is rolled later); a lob never counts.
    airTake:
      netVolley(shot, state.formation[defSide], undefined) || airTake(shot, state.formation[defSide], undefined, shot.landDepth) !== undefined,
    rallyLength: state.hits,
    landX,
    // The ball comes down at the nominal depth (the real one is rolled later). A ball into a gap between the defenders, or too short or too long for where they stand, is hard to reach.
    reach:
      landX === undefined
        ? 1
        : reachAgainst([fatigued(teams[defSide][0], state.guts[teams[defSide][0].id]), fatigued(teams[defSide][1], state.guts[teams[defSide][1].id])], defSide, state.formation[defSide], shot, landX, prefer?.depth ?? shot.landDepth, options?.positions),
    rng,
  });
  const force = options?.force;
  const res = force === undefined ? rolled : { ...rolled, outcome: force === 'rebound' ? ('continue' as const) : force, pressure: force === 'continue' || force === 'rebound' ? rolled.pressure : 0 };
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
    powerFactor: attacker.stats.power / Math.max(0.01, hitter.stats.power),
    fit: res.fit,
    // Balls that go to a wall are always taken after the wall, the others after the bounce.
    receive: shot.wall === 'none' ? 'bounce' : 'wall',
  };

  if (res.outcome === 'continue') {
    const next = nextBall(shot, res.pressure, rng, state.ball.height);
    // A hard ball that bounces and then comes off the glass or fence with great pace flies back over the net, past everybody.
    const winMargin = shot.winnerMargin ?? WINNER_MARGIN;
    if (
      force === 'rebound' ||
      (force === undefined &&
        next.glass &&
        !isLob(shot) &&
        shot.wall !== 'fence' &&
        shot.noReboundBack !== true &&
        shot.flight.speed >= REBOUND_BACK_SPEED &&
        res.attackScore - res.defenseScore > winMargin * REBOUND_BACK_SHARE)
    ) {
      return {
        state: { ...state, guts, hits: state.hits + 1, status: 'done', winner: side },
        step: { ...step, outcome: 'winner', pointWinner: side, reboundBack: true, glass: true, ...aimDepthFor(shot, rng, landX, shot.reboundWin !== undefined ? REBOUND_WIN_DEPTH : undefined, prefer?.depth, attacker.stats.accuracy) },
      };
    }
    // A defender at the net volleys: the ball never bounces, he plays it in front of the net (chest height for a fast ball, lower
    // for a soft one) and stays at the net.
    const aimed = aimDepthFor(shot, rng, landX, next.landDepth, prefer?.depth, attacker.stats.accuracy);
    // A Por Cuatro that is not hit well comes back off the glass: the defender runs to the net and plays it back (a volley).
    // The defender judges the ball: he takes it early (before the glass), which is risky, or waits for the glass and runs to the net.
    const early = shot.reboundWin !== undefined && next.lob === undefined && rng() < EARLY_TAKE;
    if (early && rng() < EARLY_TAKE_ERROR - defender.stats.technique * 0.04) {
      return {
        state: { ...state, guts, hits: state.hits + 1, status: 'done', winner: side },
        step: { ...step, outcome: 'winner', pointWinner: side, earlyError: true, ...aimDepthFor(shot, rng, landX, shot.winLandDepth, prefer?.depth, attacker.stats.accuracy) },
      };
    }
    const netReturn = shot.reboundWin !== undefined && !early && next.glass === true;
    const netBlock = netVolley(shot, state.formation[defSide], next.lob);
    const airDist = early ? EARLY_TAKE_DIST : netBlock ? undefined : airTake(shot, state.formation[defSide], next.lob, aimed.landDepth ?? shot.landDepth);
    const block = netBlock || airDist !== undefined;
    if (block) {
      // A ball hit downwards comes down at his feet; a flat one is taken at the chest when it is fast.
      const height: Height = shot.downward !== true && shot.flight.speed >= 15 ? 'mid' : 'low';
      next.ball = { height, pressure: res.pressure, glass: false, air: true, speed: shot.flight.speed };
      next.glass = false;
      next.arrival = height;
    }
    if (netReturn) {
      next.ball = { height: 'mid', pressure: res.pressure, glass: false, air: true, speed: 18 };
      next.glass = false;
      next.arrival = 'mid';
    }
    next.ball = {
      ...next.ball,
      zone: netReturn ? 'net' : netBlock ? 'net' : airDist !== undefined ? 'mid' : zoneOf(aimed.landDepth ?? shot.landDepth),
      // A ball that comes down right by a side wall can be played into that wall (contrapared).
      ...(aimed.landX !== undefined && Math.abs(aimed.landX) >= NEAR_WALL_X ? { nearWall: true } : {}),
    };
    return {
      state: {
        ...state,
        guts,
        hits: state.hits + 1,
        holder: defSide,
        hitterIdx: defIdx,
        ball: next.ball,
        formation: netReturn ? withFormation(nextFormation(state.formation, side, shot, next.lob), defSide, 'net') : nextFormation(state.formation, side, shot, next.lob),
      },
      step: { ...step, netReturn: netReturn || undefined, block: block || undefined, airDist, glass: next.glass, arrival: next.arrival, lob: next.lob, ...aimed },
    };
  }

  // winner: the hitter scores. error: the other side scores.
  const winner = res.outcome === 'winner' ? side : defSide;
  return {
    state: { ...state, guts, hits: state.hits + 1, status: 'done', winner },
    step: {
      ...step,
      pointWinner: winner,
      // Por Cuatro winners: the nail into the front of the court (flies out over the 4 m glass) or, deeper, off the back glass.
      ...(res.outcome === 'winner' && shot.reboundWin !== undefined && rng() < shot.reboundWin
        ? { reboundBack: true, glass: true, ...aimDepthFor(shot, rng, landX, REBOUND_WIN_DEPTH, prefer?.depth, attacker.stats.accuracy) }
        : aimDepthFor(shot, rng, landX, res.outcome === 'winner' ? shot.winLandDepth : undefined, prefer?.depth, attacker.stats.accuracy)),
      errorKind: res.outcome === 'error' && shot.wall !== 'fence' ? pickErrorKind(shot, rng, landX) : undefined,
    },
  };
}
