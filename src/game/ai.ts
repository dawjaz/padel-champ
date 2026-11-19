import { DIRECTIONS, shotsOfKind } from './catalog';
import { defenseRating, faultChance } from './engine';
import { playableShots, type PointState, type Teams } from './point';
import type { Direction, ReceiveMode, Rng, ShotDef } from './types';

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

/** CPU choice of shot and direction for a return or rally hit. */
export function pickHit(teams: Teams, state: PointState, rng: Rng): { shot: ShotDef; direction: Direction } {
  const side = state.holder;
  const hitter = teams[side][state.hitterIdx];
  const options = playableShots(shotsOfKind(state.hits === 0 ? 'return' : 'rally'), state);

  const weights = options.map((s) => {
    const affordable = state.guts[hitter.id] >= s.cost ? 1 : 0.15;
    return Math.max(0.05, hitter.stats[s.stat] * s.power * s.fit[state.ball.height] * affordable);
  });
  const shot = weightedPick(options, weights, rng);
  if (shot.fixedDirection) return { shot, direction: shot.fixedDirection };

  // Aim at the weaker defender, with some randomness; middle only when it is clearly safest.
  const defTeam = teams[side === 0 ? 1 : 0];
  let best: Direction = 'cross';
  let bestScore = -Infinity;
  for (const d of DIRECTION_ORDER) {
    const dir = DIRECTIONS[d];
    const rating =
      d === 'middle'
        ? (defenseRating(defTeam[0], dir) + defenseRating(defTeam[1], dir)) / 2
        : defenseRating(defTeam[d === 'parallel' ? state.hitterIdx : 1 - state.hitterIdx], dir);
    const score = dir.attack * 30 - rating - dir.risk * 100 + rng() * 25;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return { shot, direction: best };
}

/**
 * CPU choice for a serve that kicks off the side glass: quick, technical players take it off the bounce,
 * solid defenders wait for the glass.
 */
export function pickReceive(teams: Teams, state: PointState, rng: Rng): ReceiveMode {
  const receiver = teams[state.servingSide === 0 ? 1 : 0][state.receiverIdx];
  const bounce = receiver.stats.technique + receiver.stats.speed;
  const wall = receiver.stats.defense * 1.5 + 2;
  return weightedPick<ReceiveMode>(['bounce', 'wall'], [bounce, wall], rng);
}
