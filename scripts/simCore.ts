// Shared CPU-vs-CPU match simulation for the balance scripts (see simBalance.ts, simShots.ts).
import { pickHit, pickReceive, pickServe, pickStarReceiver } from '../src/game/ai';
import { gutsRecovery } from '../src/game/attributes';
import { restPos } from '../src/game/court';
import { recoverGuts } from '../src/game/engine';
import { stepHit, stepServe, startPoint, type PointState, type Step, type Teams } from '../src/game/point';
import { awardPoint, isStarPoint, newScore } from '../src/game/scoring';
import type { Rng, SideIndex } from '../src/game/types';

export interface Tally { hits: number; spent: number; tiredHits: number; points: number }
export const other = (s: SideIndex): SideIndex => (s === 0 ? 1 : 0);

export interface SimOptions {
  /** Called for every serve and hit step (shot, outcome, who). */
  onStep?: (step: Step, state: PointState) => void;
  /** Force the receive mode on wall serves instead of the CPU choice. */
  receive?: 'bounce' | 'wall';
}

export function playMatch(teams: Teams, rng: Rng, tally: Record<string, Tally>, firstServer: SideIndex = 0, opts: SimOptions = {}) {
  const guts: Record<string, number> = {};
  for (const p of teams.flat()) guts[p.id] = p.maxGuts;
  let score = newScore(2);
  let server: SideIndex = firstServer;
  const serverIdx = [0, 0];
  let points = [0, 0];
  let pointCount = 0;
  let longest = 0;
  while (score.winner === null) {
    const played = score.points[0] + score.points[1]; // scene: points of the current game only
    let choice: number | undefined;
    if (isStarPoint(score)) choice = pickStarReceiver(teams[other(server)], rng);
    let st: PointState = startPoint(guts, server, serverIdx[server], played, choice);
    // serve (and second serve)
    for (;;) {
      const shot = pickServe(teams, st, rng);
      const receive = opts.receive ?? pickReceive(teams, st, rng, shot);
      const before = st.guts[teams[server][st.serverIdx].id];
      const r = stepServe(teams, st, shot, rng, receive);
      opts.onStep?.(r.step, r.state);
      const sv = teams[server][st.serverIdx].id;
      tally[sv].spent += before - r.state.guts[sv];
      st = r.state;
      if (st.status !== 'serve') break;
    }
    while (st.status === 'rally') {
      const opp = teams[other(st.holder)].map((p, i) => ({ ...restPos(other(st.holder), i, st.formation[other(st.holder)]) }));
      const { shot, direction, prefer } = pickHit(teams, st, rng, opp);
      const hitter = teams[st.holder][st.hitterIdx];
      const before = st.guts[hitter.id];
      const t = tally[hitter.id];
      t.hits++;
      if (before < hitter.maxGuts / 2) t.tiredHits++;
      const r = stepHit(teams, st, shot, direction, rng, prefer);
      opts.onStep?.(r.step, r.state);
      t.spent += before - r.state.guts[hitter.id];
      st = r.state;
    }
    longest = Math.max(longest, st.hits);
    const w = st.winner as SideIndex;
    points[w]++; pointCount++;
    for (const p of teams.flat()) tally[p.id].points++;
    for (const p of teams.flat()) guts[p.id] = recoverGuts(st.guts[p.id], gutsRecovery(p.stats.stamina), p.maxGuts);
    const res = awardPoint(score, w);
    score = res.score;
    if (res.gameWon) {
      server = other(server);
      serverIdx[server] = 1 - serverIdx[server];
    }
  }
  return { winner: score.winner as SideIndex, points, longest };
}

