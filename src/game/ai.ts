import { DIRECTIONS, shotsOfKind } from './catalog';
import { landingX, NET_Z } from './court';
import { defenseRating, faultChance } from './engine';
import { isLob, playableShots, type PointState, type Teams } from './point';
import type { AimPreference, CourtPos, Direction, PlayerDef, ReceiveMode, Rng, ShotDef } from './types';

/** Shots that are only available now and then; the CPU favours them when it can play them. */
const NICHE_SHOTS = ['vibora', 'bandeja', 'contrapared'];
const NICHE_WEIGHT = 3;
const DIRECTION_ORDER: Direction[] = ['parallel', 'middle', 'cross'];

function weightedPick<T>(items: T[], weights: number[], rng: Rng): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** CPU serve choice: prefers strong serves, avoids risky ones on the second attempt. */
export function pickServe(teams: Teams, state: PointState, rng: Rng): ShotDef {
  const server = teams[state.servingSide][state.serverIdx];
  const options = shotsOfKind('serve');
  const weights = options.map((s) => {
    const safety = 1 - faultChance(server, s) * (state.attempt === 2 ? 3 : 1);
    return Math.max(0.05, server.stats[s.stat] * s.power * safety);
  });
  return weightedPick(options, weights, rng);
}

/**
 * The best x for the ball inside the strip of a direction: the point furthest from both opponents (a gap in their set-up).
 * `centre` is where the direction usually lands; the strip is as wide as the aim points of that direction.
 */
function gapX(centre: number, opp: CourtPos[], rng: Rng): number {
  const xs: number[] = [];
  const gaps: number[] = [];
  for (let i = 0; i < 10; i++) {
    const x = Math.max(-4.6, Math.min(4.6, centre + ((i - 4.5) / 4.5) * 0.9));
    xs.push(x);
    gaps.push(Math.min(...opp.map((o) => Math.abs(o.x - x))));
  }
  // Points that are about as good as the best one are equal: pick one of them at random. (A fixed order made every ball down the
  // middle land on the same side, so one player of a pair did most of the work.)
  const top = Math.max(...gaps);
  const best = xs.filter((_, i) => gaps[i] >= top - 0.15);
  return best[Math.min(best.length - 1, Math.floor(rng() * best.length))];
}

/**
 * CPU / partner choice of shot and direction for a return or rally hit. Hitters look for holes in the opponents' set-up and
 * run them around: `opp` are the opponents' real positions (they move). With them the hitter prefers
 *  - lobs when both opponents are at the net, short balls (chiquita) when both are far back;
 *  - the direction and the aim point furthest from both opponents (a gap between them or behind one of them);
 *  - a deep ball against opponents at the net, a short one against opponents at the back.
 * Without positions only the stats of the defenders decide (the old behaviour).
 */
export function pickHit(
  teams: Teams,
  state: PointState,
  rng: Rng,
  opp?: CourtPos[],
): { shot: ShotDef; direction: Direction; prefer?: AimPreference } {
  const side = state.holder;
  const hitter = teams[side][state.hitterIdx];
  const options = playableShots(shotsOfKind(state.hits === 0 ? 'return' : 'rally'), state);

  // How far the opponents stand from the net (m), on average: small = at the net, large = at the back.
  const away = opp && opp.length > 0 ? opp.reduce((a, o) => a + Math.abs(o.z - NET_Z), 0) / opp.length : undefined;
  const atNet = away !== undefined && away < 4;
  const atBack = away !== undefined && away > 6.5;

  const weights = options.map((s) => {
    const affordable = state.guts[hitter.id] >= s.cost ? 1 : 0.15;
    let tactic = 1;
    if (atNet) tactic = isLob(s) ? 2.5 : s.id.includes('chiquita') ? 0.5 : 1;
    else if (atBack) tactic = s.id.includes('chiquita') || s.id === 'dejada' ? 2.2 : isLob(s) ? 0.5 : 1;
    // The niche shots (vibora, bandeja, contrapared) almost never came up in CPU play (0.1% of hits): a pair that can play them should.
    if (NICHE_SHOTS.includes(s.id)) tactic *= NICHE_WEIGHT;
    return Math.max(0.05, hitter.stats[s.stat] * s.power * s.fit[state.ball.height] * affordable * tactic);
  });
  const shot = weightedPick(options, weights, rng);
  if (shot.fixedDirection) return { shot, direction: shot.fixedDirection };

  // Aim at the gap (or the weaker defender when the positions are not known), with some randomness.
  const defTeam = teams[side === 0 ? 1 : 0];
  let best: Direction = 'cross';
  let bestScore = -Infinity;
  let bestX: number | undefined;
  for (const d of DIRECTION_ORDER) {
    const dir = DIRECTIONS[d];
    const targetIdx = d === 'parallel' ? state.hitterIdx : d === 'cross' ? 1 - state.hitterIdx : state.hitterIdx;
    const rating =
      d === 'middle'
        ? (defenseRating(defTeam[0], dir) + defenseRating(defTeam[1], dir)) / 2
        : defenseRating(defTeam[targetIdx], dir);
    let score = dir.attack * 30 - rating - dir.risk * 100 + rng() * 25;
    let x: number | undefined;
    if (opp && opp.length > 0) {
      // The middle is aimed between the players, so its centre is the middle of the court.
      x = gapX(d === 'middle' ? 0 : landingX(d, targetIdx), opp, rng);
      const gap = Math.min(...opp.map((o) => Math.abs(o.x - x!)));
      // the gap counts a lot: a ball that is 3 m from both opponents is hard to reach
      score = dir.attack * 30 - dir.risk * 100 - 0.4 * rating + 14 * Math.min(gap, 3.5) + rng() * 18;
    }
    if (score > bestScore) {
      bestScore = score;
      best = d;
      bestX = x;
    }
  }
  const prefer: AimPreference | undefined = opp && opp.length > 0 ? { x: bestX } : undefined;
  if (prefer && !shot.overFence) {
    if (atNet) prefer.depth = shot.landDepth + 1.5;
    else if (atBack) prefer.depth = shot.landDepth - 1.5;
  }
  return { shot, direction: best, prefer };
}

/**
 * CPU choice for a serve that kicks off the side glass: quick, technical players take it off the bounce,
 * solid defenders wait for the glass.
 */
export function pickReceive(teams: Teams, state: PointState, rng: Rng, shot?: ShotDef): ReceiveMode {
  const receiver = teams[state.servingSide === 0 ? 1 : 0][state.receiverIdx];
  let bounce = receiver.stats.technique + receiver.stats.speed;
  let wall = receiver.stats.defense * 1.5 + 2;
  // Like the player (who sees the speed of the serve): a fast serve is waited for, a slow one is taken straight off the bounce.
  // (In the simulation a fast serve off the bounce is an ace far more often, and a slow one hurts less when taken early.)
  if (shot) {
    if (shot.flight.speed >= FAST_SERVE_SPEED) wall *= 3;
    else if (shot.flight.speed <= SLOW_SERVE_SPEED) bounce *= 3;
  }
  return weightedPick<ReceiveMode>(['bounce', 'wall'], [bounce, wall], rng);
}
/** Serve speeds (m/s) from which the CPU waits for the glass / up to which it takes the ball off the bounce. */
export const FAST_SERVE_SPEED = 26;
export const SLOW_SERVE_SPEED = 20;

/**
 * Star Point: the CPU pair decides which of them receives (and so which side the serve comes to).
 * The better defender is more likely to take it; a little randomness keeps it unpredictable.
 */
export function pickStarReceiver(team: PlayerDef[], rng: Rng): number {
  const weights = team.map((p) => Math.max(0.1, p.stats.defense * 7 + p.stats.speed * 3));
  return weightedPick(team.map((_, i) => i), weights, rng);
}
