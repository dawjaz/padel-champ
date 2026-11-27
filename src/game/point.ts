import { baseId, DIRECTIONS, SPECIALS } from './catalog';
import { aimDepth, aimX, defenderIndex, laneSign, flightTime, indexOfLane, landingZ, NET_Z, REACH_DEFAULT_RUN, REACH_LOB_MIN, REACH_LOB_TIME_MAX, REACH_MIN, reachFactor, reachGap, reachRadius, reachTimeFactor, restPos, serveLane, targetLanding, targetSpread, trackGap } from './court';
import { fatigued, STAT_KEYS } from './attributes';
import { LOB_APEX, MAX_PRESSURE, resolveHit, resolveServe, SECOND_SERVE_RETURN, spendGuts, WINNER_MARGIN, type HitOutcome } from './engine';
import type { AimPreference, BallState, CourtPos, Direction, ErrorKind, Formation, Height, LaneSign, LobQuality, Zone, PlayerDef, ReceiveMode, Rng, ShotDef, SideIndex } from './types';

/** A high, slow arc that is meant to send the opponents back. */
export const isLob = (shot: ShotDef): boolean => shot.flight.apex >= LOB_APEX;

/** Where the players really stand (the scene knows, the engine otherwise assumes the places of their formation). */
export interface ReachPositions {
  /** The two defenders. */
  defenders?: [CourtPos, CourtPos];
  /** The hitter: how far the ball has to fly decides how much time the defenders have. */
  hitter?: CourtPos;
}

/**
 * How much of his defence a defender keeps against a ball that comes down at (landX, depth m past the net). His reach grows with his
 * speed and with the time the ball is in the air (a slow or high ball can be run down, a hard flat one cannot). 1 = the ball is within
 * his reach, down to REACH_MIN when it is far from both. A lob can be run down (never below REACH_LOB_MIN). Without `at` the defenders
 * are at the places of their formation and the hitter is assumed REACH_DEFAULT_RUN away.
 * - A defender who takes this ball out of the air (a pair at the net volleys it, one in mid-court takes it before it lands) is measured to
 *   the nearest point of its path, not to where it would land behind him (that made a deep ball past a net pair look unreachable).
 * - Both defenders cover the court: the better placed one counts, and the other closes part of what is left (a ball into the middle is
 *   not a gap that neither can reach).
 */
/**
 * Reach tuning: `cover` = how much of the remaining gap the second defender closes (1 = all he can reach, 0 = only the nearer one
 * counts); `volleyGapMul` = a ball that flies past a volleying defender counts as this many times further away than it passes (he has
 * a split second to react; >1 keeps real gaps beside and between players at the net).
 */
export const REACH_TUNE = { cover: 0.5, volleyGapMul: 3 };

export function reachAgainst(defenders: [PlayerDef, PlayerDef], defSide: SideIndex, formation: Formation, shot: ShotDef, landX: number, depth: number, at: ReachPositions = {}): number {
  const z = landingZ(defSide, depth);
  const hitter: CourtPos = at.hitter ?? { x: 0, z: defSide === 0 ? NET_Z - REACH_DEFAULT_RUN / 2 : NET_Z + REACH_DEFAULT_RUN / 2 };
  const dist = at.hitter ? Math.hypot(landX - at.hitter.x, z - at.hitter.z) : REACH_DEFAULT_RUN;
  const lobMax = isLob(shot) ? REACH_LOB_TIME_MAX : undefined;
  const floor = isLob(shot) ? REACH_LOB_MIN : REACH_MIN;
  const inAir = netVolley(shot, formation, undefined) || airTake(shot, formation, undefined, depth) !== undefined;
  const f: number[] = [];
  for (let i = 0; i < 2; i++) {
    const spot = at.defenders ? at.defenders[i] : restPos(defSide, i, formation);
    let gap = reachGap(spot, landX, z);
    let flown = dist;
    if (inAir) {
      const t = trackGap(spot, hitter, landX, z);
      const tg = t.gap * REACH_TUNE.volleyGapMul;
      if (tg < gap) {
        gap = tg;
        flown = at.hitter ? t.dist : REACH_DEFAULT_RUN * (t.dist / Math.max(1e-6, Math.hypot(landX - hitter.x, z - hitter.z)));
      }
    }
    const time = reachTimeFactor(flightTime(shot.flight.speed, shot.flight.apex, flown), lobMax);
    f.push(reachFactor(gap, reachRadius(defenders[i].stats.speed) * time, floor));
  }
  const hi = Math.max(f[0], f[1]);
  const lo = Math.min(f[0], f[1]);
  return Math.min(1, hi + (REACH_TUNE.cover * (1 - hi) * (lo - floor)) / (1 - floor));
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
  /** This error came from the pressure of the incoming ball (a forced error), not from the shot's own risk. */
  forcedError?: boolean;
  /** A special shot the defender got back (it would have been a winner; he paid guts for it). */
  answered?: boolean;
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
  return baseId(step.shot) === 'smash_x4' && (step.reboundBack === true || step.netReturn === true);
}

/**
 * Out-of-court play (FIP rules, see HANDOFF v0.95): a ball that bounced in the receivers' half and left over a side wall stays in play;
 * the receiver may run out through the opening by the net and play it back. In the game that is the Por Tres (a Por Cuatro goes out
 * over the back wall: lost whatever happens). The run costs `RUN_OUT_COST` guts, made or not.
 */
export const RUN_OUT_COST = 3;
/** True for a step after which the defender may run out after the ball: a Por Tres winner that left over the side wall. */
export function canRunOut(step: Pick<Step, 'kind' | 'outcome' | 'shot' | 'reboundBack'>): boolean {
  return step.kind !== 'serve' && step.outcome === 'winner' && baseId(step.shot) === 'smash_x3' && step.reboundBack !== true;
}
/**
 * The chance that a run-out gets the ball back: speed above all (25% at 5, 46% at 8), less when tired; the timing of the shot outside
 * (0 to 1; undefined: neutral, at most 75%) from x0.6 to x1.4, and a clean touch (0.6 up to 1) closes most of the gap to a sure thing: PERFECT is 97%. None without the guts for it.
 */
export function runOutChance(p: PlayerDef, guts: number, timing?: number): number {
  if (guts < RUN_OUT_COST) return 0;
  const share = p.maxGuts > 0 ? Math.min(1, guts / p.maxGuts) : 1;
  const base = Math.max(0.08, Math.min(0.6, 0.25 + 0.07 * (p.stats.speed - 5))) * (0.7 + 0.3 * share);
  if (timing === undefined) return Math.min(0.75, base);
  const q = Math.max(0, Math.min(1, timing));
  // a clean touch on the ring (green) almost always gets the ball back: the better the timing over 0.6, the more of what is left
  const clean = q >= 0.6 ? (q - 0.6) / 0.4 : 0;
  return Math.min(0.97, base * (0.6 + 0.8 * q) + (1 - base) * 0.95 * clean);
}
/** How a run-out is played back: a lob over the wall (safe) or a flat ball through the door by the net (only where the angles allow it). */
export type RunOutMode = 'lob' | 'door';

/** The opening in the side fence by the net: its centre is this far from the net, its half-width along the net line (metres). */
export const DOOR_FROM_NET = 0.75;
export const DOOR_HALF = 0.7;
/** Where a ball played through the door lands (metres from the net, in the other pair's half). */
const DOOR_LAND_DEPTH = 4.5;

export interface DoorShot {
  /** The flat ball through the door can be played from here. */
  open: boolean;
  /** 0..1: how wide the door looks from the contact point (a narrow gap is hard to hit). */
  window: number;
  /** The centre of the door (the ball passes through it), on the fence line. */
  gate: { x: number; z: number };
  /** Where the ball would land in the other half when played through the centre of the door. */
  target: { x: number; z: number };
}

/**
 * The flat shot back through the door, for a runner on `runSide` who meets the ball at `contact` (outside the court, |x| over 5). It
 * only exists where the geometry allows it: the angle the opening takes up from the contact point must be wide enough (the further
 * along the fence from the door, the narrower it gets), and the line through it must cross the net inside the posts and land in the
 * court on the other side.
 */
export function doorShot(runSide: SideIndex, contact: { x: number; z: number }): DoorShot {
  const sgn = Math.sign(contact.x) || 1;
  const gz = runSide === 0 ? NET_Z + DOOR_FROM_NET : NET_Z - DOOR_FROM_NET;
  const gate = { x: sgn * 5, z: gz };
  const landZ = runSide === 0 ? NET_Z - DOOR_LAND_DEPTH : NET_Z + DOOR_LAND_DEPTH;
  const dx = gate.x - contact.x;
  const dz = gz - contact.z;
  const none: DoorShot = { open: false, window: 0, gate, target: { x: gate.x, z: landZ } };
  if (Math.abs(contact.x) < 5.05 || Math.abs(dz) < 1e-6 && Math.abs(dx) < 1e-6) return none;
  // the ball must travel towards the net and the other half
  if (runSide === 0 ? dz >= 0 : dz <= 0) return none;
  const k = (landZ - contact.z) / dz;
  const target = { x: contact.x + k * dx, z: landZ };
  const kNet = (NET_Z - contact.z) / dz;
  const atNet = contact.x + kNet * dx;
  if (Math.abs(target.x) > 4.8 || Math.abs(atNet) > 4.95) return none;
  const a1 = Math.atan2(gate.x - contact.x, gz - DOOR_HALF - contact.z);
  const a2 = Math.atan2(gate.x - contact.x, gz + DOOR_HALF - contact.z);
  const width = Math.abs(a1 - a2);
  const window = Math.max(0, Math.min(1, (width - 0.08) / 0.3));
  return { open: window > 0, window, gate, target };
}

/**
 * The run-out itself, after the step `step` (a Por Tres winner, `done` the finished state). Made: the point goes on and the ball comes
 * back to the hitting pair under heavy pressure (a ball played from outside the court is very hard to keep in play): as a defensive lob
 * (medium, played out of the air; the pair drops to mid-court), or, through the door (`mode` 'door', needs `window` from `doorShot`),
 * flat and low, harder to make (the narrower the door the less often) and harder still to play. Not made: the point stays won. The
 * runner pays `RUN_OUT_COST` guts either way.
 */
export const RUN_OUT_PRESSURE = 0.3;
export function runOutReturn(teams: Teams, done: PointState, step: Step, rng: Rng, timing?: number, mode: RunOutMode = 'lob', window = 0): { made: boolean; state: PointState } {
  const runSide = other(step.side);
  const runner = teams[runSide][step.defenderIdx];
  const g = done.guts[runner.id] ?? runner.maxGuts;
  const door = mode === 'door';
  // the flat ball is the harder one: a narrow door and a loose touch cost it dearly
  const doorMul = door ? (0.45 + 0.4 * window) * (0.8 + 0.04 * runner.stats.accuracy) : 1;
  const made = rng() < runOutChance(fatigued(runner, g), g, timing) * doorMul;
  const guts = { ...done.guts, [runner.id]: spendGuts(g, RUN_OUT_COST) };
  if (!made) return { made, state: { ...done, guts } };
  // the hitting pair steps back from the net for the lob (mid-court: vibora, bandeja or a volley), the runner's pair is at the back
  const formation: [Formation, Formation] = step.side === 0 ? ['mid', 'back'] : ['back', 'mid'];
  const t = timing === undefined ? 0.5 : timing;
  return {
    made,
    state: {
      ...done,
      guts,
      status: 'rally',
      winner: null,
      holder: step.side,
      // the one of the pair the lob goes to: the hitter (he is at the net, the ball drops behind him) or his partner
      hitterIdx: rng() < 0.5 ? step.attackerIdx : 1 - step.attackerIdx,
      hits: done.hits + 1,
      ball: door
        ? { height: 'low', pressure: RUN_OUT_PRESSURE + 0.1 + 0.2 * window * (0.5 + 0.5 * t), glass: false, air: true, zone: 'mid', speed: 22 }
        : { height: 'high', pressure: RUN_OUT_PRESSURE, lob: 'medium', glass: false, air: true, zone: 'back', speed: 14 },
      formation,
    },
  };
}

/** Guts a defender spends to get a special shot back (and the guts the hitter must have on top of its cost for the CPU to try one). */
export const SPECIAL_ANSWER_COST = 3;
/**
 * The special shots `player` can play now: he has them, it is a rally ball (not the serve or its return) and the ball and the
 * positions allow it (the same rules as its base shot). The guts are not checked here (a special without enough guts is RISKY, as any
 * shot).
 */
export function specialsFor(player: PlayerDef, state: PointState): ShotDef[] {
  if (!player.specials?.length || state.status !== 'rally' || state.hits === 0) return [];
  return SPECIALS.filter((s) => player.specials!.includes(s.id) && unavailableReason(s, state) === null);
}
/** CPU players and partners whose attributes average at least this have a special shot (the Rise division and up; quick match). */
export const SPECIAL_MIN_RATING = 5;
const SPECIAL_BY_STAT: Partial<Record<keyof PlayerDef['stats'], string>> = {
  power: 'sp_skyrocket',
  spin: 'sp_venom',
  technique: 'sp_cornerlock',
  accuracy: 'sp_freeze',
};
/** The special of a CPU player: the one of his best attacking attribute (power, spin, technique, accuracy); none for weaker players. */
export function cpuSpecial(p: PlayerDef): string | undefined {
  const mean = STAT_KEYS.reduce((a, k) => a + p.stats[k], 0) / STAT_KEYS.length;
  if (mean < SPECIAL_MIN_RATING) return undefined;
  const keys = Object.keys(SPECIAL_BY_STAT) as Array<keyof PlayerDef['stats']>;
  const best = keys.reduce((a, k) => (p.stats[k] > p.stats[a] ? k : a), keys[0]);
  return SPECIAL_BY_STAT[best];
}
/** A CPU player with his special (a player who has one keeps it). */
export const withSpecial = (p: PlayerDef): PlayerDef => {
  if (p.specials?.length) return p;
  const sp = cpuSpecial(p);
  return sp ? { ...p, specials: [sp] } : p;
};

/**
 * The chance that a defender gets back a special shot that would have been a winner, with guts left to pay for it (none with less than
 * `SPECIAL_ANSWER_COST`), scaled by how full his guts bar is: `PER_POINT x (defence + speed) - OFFSET`, at most 40%. Since v0.157 a
 * weak pair answers one now and then too (15% at defence + speed 8, 21% at 10, 33% at 14, 39% at 16; before: 0, 10, 30, 40%).
 */
export const SPECIAL_ANSWER_PER_POINT = 0.03;
export const SPECIAL_ANSWER_OFFSET = 0.09;
export function specialAnswerChance(defender: PlayerDef, guts: number): number {
  if (guts < SPECIAL_ANSWER_COST) return 0;
  const share = defender.maxGuts > 0 ? Math.min(1, guts / defender.maxGuts) : 1;
  return Math.max(0, Math.min(0.4, SPECIAL_ANSWER_PER_POINT * (defender.stats.defense + defender.stats.speed) - SPECIAL_ANSWER_OFFSET)) * share;
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
  /** How well the serve was timed (0 to 1); undefined: neutral. */
  timing?: number,
): StepResult {
  if (state.status !== 'serve') throw new Error('Point is not at the serve');
  const side = state.servingSide;
  const recvSide = other(side);
  const server = teams[side][state.serverIdx];
  const receiver = fatigued(teams[recvSide][state.receiverIdx], state.guts[teams[recvSide][state.receiverIdx].id]);

  const res = resolveServe(server, state.guts[server.id], shot, receiver, DIRECTIONS.cross, rng, receive, state.attempt === 2, shot.timed === true ? timing : undefined);
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
  /** A point the human player chose (x across, depth m past the net): the ball comes down around it (`targetLanding`) instead of one of the aim points of the direction. */
  target?: { x: number; depth: number };
  /** How well a timed shot was timed (0 to 1); undefined: neutral (AUTO, the CPU). */
  timing?: number;
}

/**
 * How far a ball aimed at a chosen point may stray for this hitter now (see `targetSpread`): his accuracy as tiredness leaves it, the guts
 * he has left, the pressure of the ball he plays, the shot. The scene draws the same spread as the aiming ellipse.
 */
export function targetSpreadFor(hitter: PlayerDef, state: PointState, shot: ShotDef): { x: number; depth: number } {
  const g = state.guts[hitter.id] ?? hitter.maxGuts;
  return targetSpread({
    accuracy: fatigued(hitter, g).stats.accuracy,
    gutsShare: hitter.maxGuts > 0 ? g / hitter.maxGuts : 1,
    pressure: state.ball.pressure ?? 0,
    speed: shot.flight.speed,
    lob: isLob(shot),
    touch: baseId(shot) === 'dejada',
  });
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
  const tgt = !fixedAim && options?.target ? targetLanding(options.target, rng, targetSpreadFor(hitter, state, shot)) : undefined;
  const fixDepth = tgt?.depth;
  // A corner shot (Corner Lock: `edgeX`) goes into the back corner on the side of the player it is aimed at, never anywhere else.
  const landX = fixedAim ? undefined : tgt ? tgt.x : shot.edgeX !== undefined ? laneSign(targetIdx) * shot.edgeX : aimX(direction, targetIdx, rng, prefer?.x, attacker.stats.accuracy);
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
    timing: shot.timed === true ? options?.timing : undefined,
    // aimed at a chosen point the walls are dealt with by where the ball really falls (a miss below), not by an extra risk
    landX: tgt ? undefined : landX,
    // The ball comes down at the nominal depth (the real one is rolled later). A ball into a gap between the defenders, or too short or too long for where they stand, is hard to reach.
    reach:
      landX === undefined
        ? 1
        : reachAgainst([fatigued(teams[defSide][0], state.guts[teams[defSide][0].id]), fatigued(teams[defSide][1], state.guts[teams[defSide][1].id])], defSide, state.formation[defSide], shot, landX, fixDepth ?? prefer?.depth ?? shot.landDepth, options?.positions),
    rng,
  });
  const force = options?.force;
  const forced = force === undefined ? rolled : { ...rolled, outcome: force === 'rebound' ? ('continue' as const) : force, pressure: force === 'continue' || force === 'rebound' ? rolled.pressure : 0 };
  // A ball aimed at a chosen point that strays off the court is an error, whatever the roll said.
  const aimed0 = tgt?.miss && force === undefined && forced.outcome !== 'error' ? { ...forced, outcome: 'error' as const, pressure: 0 } : forced;
  // A special shot that would win the point can still be got back by a strong defender with guts left: he pays for it, and the ball
  // comes back under the heaviest pressure.
  const defGuts = state.guts[teams[defSide][defIdx].id] ?? teams[defSide][defIdx].maxGuts;
  const answered =
    shot.kind === 'special' && force === undefined && aimed0.outcome === 'winner' && rng() < specialAnswerChance(teams[defSide][defIdx], defGuts) * (shot.answerMul ?? 1);
  const res = answered ? { ...aimed0, outcome: 'continue' as const, pressure: MAX_PRESSURE } : aimed0;
  const guts = {
    ...state.guts,
    [attacker.id]: spendGuts(state.guts[attacker.id], shot.cost),
    ...(answered ? { [teams[defSide][defIdx].id]: spendGuts(defGuts, SPECIAL_ANSWER_COST) } : {}),
  };

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
    ...(answered ? { answered: true } : {}),
    ...(res.outcome === 'error' && res.forced === true ? { forcedError: true } : {}),
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
        !answered &&
        next.glass &&
        !isLob(shot) &&
        shot.wall !== 'fence' &&
        shot.noReboundBack !== true &&
        shot.flight.speed >= REBOUND_BACK_SPEED &&
        res.attackScore - res.defenseScore > winMargin * REBOUND_BACK_SHARE)
    ) {
      return {
        state: { ...state, guts, hits: state.hits + 1, status: 'done', winner: side },
        step: { ...step, outcome: 'winner', pointWinner: side, reboundBack: true, glass: true, ...aimDepthFor(shot, rng, landX, shot.reboundWin !== undefined ? REBOUND_WIN_DEPTH : fixDepth, prefer?.depth, attacker.stats.accuracy) },
      };
    }
    // A defender at the net volleys: the ball never bounces, he plays it in front of the net (chest height for a fast ball, lower
    // for a soft one) and stays at the net.
    const aimed = aimDepthFor(shot, rng, landX, next.landDepth ?? fixDepth, prefer?.depth, attacker.stats.accuracy);
    // A Por Cuatro that is not hit well comes back off the glass: the defender runs to the net and plays it back (a volley).
    // The defender judges the ball: he takes it early (before the glass), which is risky, or waits for the glass and runs to the net.
    // (a special he got back is played back, never fumbled)
    const early = !answered && shot.reboundWin !== undefined && next.lob === undefined && rng() < EARLY_TAKE;
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
        : aimDepthFor(shot, rng, landX, res.outcome === 'winner' ? shot.winLandDepth ?? fixDepth : fixDepth, prefer?.depth, attacker.stats.accuracy)),
      errorKind: res.outcome === 'error' && shot.wall !== 'fence' ? (tgt?.miss ?? pickErrorKind(shot, rng, landX)) : undefined,
    },
  };
}
