// CPU vs CPU match simulation for balance work. Run: npx vite-node scripts/simBalance.ts [fatigue|career]
// Both sides are played by the CPU AI (pickServe / pickReceive / pickHit), with players at their rest positions.
import playersData from '../src/data/players.json';
import divisions from '../src/data/divisions.json';
import partners from '../src/data/partners.json';
import { pickHit, pickReceive, pickServe, pickStarReceiver } from '../src/game/ai';
import { gutsFor, gutsRecovery, STAT_KEYS } from '../src/game/attributes';
import { restPos, serveSetup } from '../src/game/court';
import { recoverGuts } from '../src/game/engine';
import { stepHit, stepServe, startPoint, type PointState, type Teams } from '../src/game/point';
import { seededRng } from '../src/game/rng';
import { awardPoint, isStarPoint, newScore } from '../src/game/scoring';
import { makePair } from '../src/career/tournament';
import { statCap, pointsEarned, heroFrom, newProfile, emptyAlloc } from '../src/career/profile';
import type { PlayerDef, Rng, SideIndex, StatKey } from '../src/game/types';

const YOU = playersData.you as unknown as PlayerDef[];
const CPU = playersData.cpu as unknown as PlayerDef[];

interface Tally { hits: number; spent: number; tiredHits: number; points: number }
const other = (s: SideIndex): SideIndex => (s === 0 ? 1 : 0);

function playMatch(teams: Teams, rng: Rng, tally: Record<string, Tally>, firstServer: SideIndex = 0) {
  const guts: Record<string, number> = {};
  for (const p of teams.flat()) guts[p.id] = p.maxGuts;
  let score = newScore(2);
  let server: SideIndex = firstServer;
  const serverIdx = [0, 0];
  let points = [0, 0];
  let pointCount = 0;
  let longest = 0;
  while (score.winner === null) {
    const played = process.env.GLOBAL_PARITY ? pointCount : score.points[0] + score.points[1]; // scene: points of the current game only
    let choice: number | undefined;
    if (isStarPoint(score)) choice = pickStarReceiver(teams[other(server)], rng);
    let st: PointState = startPoint(guts, server, serverIdx[server], played, choice);
    // serve (and second serve)
    for (;;) {
      const shot = pickServe(teams, st, rng);
      const receive = pickReceive(teams, st, rng);
      const before = st.guts[teams[server][st.serverIdx].id];
      const r = stepServe(teams, st, shot, rng, receive);
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

const mk = (id: string, stats: Record<StatKey, number>): PlayerDef => ({ ...YOU[0], id, name: id, stats, maxGuts: gutsFor(stats.stamina) });
const flat = (v: number): Record<StatKey, number> => Object.fromEntries(STAT_KEYS.map((k) => [k, v])) as Record<StatKey, number>;

function fatigue(n: number): void {
  const rng = seededRng(11);
  const run = (label: string, teams: Teams): void => {
    const tally: Record<string, Tally> = {};
    for (const p of teams.flat()) tally[p.id] = { hits: 0, spent: 0, tiredHits: 0, points: 0 };
    let longest = 0, hitsTotal = 0, pts = 0;
    for (let i = 0; i < n; i++) {
      const r = playMatch(teams, rng, tally, (i % 2) as SideIndex);
      longest = Math.max(longest, r.longest);
      pts += r.points[0] + r.points[1];
    }
    console.log(`\n== ${label} (${n} matches, ${pts} points)`);
    for (const side of [0, 1] as SideIndex[]) teams[side].forEach((p, idx) => {
      const t = tally[p.id];
      hitsTotal += t.hits;
      console.log(`${side === 0 ? 'near' : 'far '} lane ${idx === 0 ? 'LEFT ' : 'RIGHT'} ${p.name.padEnd(7)} hits/match ${(t.hits / n).toFixed(1).padStart(5)}  G spent/match ${(t.spent / n).toFixed(1).padStart(5)}  tired-hit share ${((100 * t.tiredHits) / Math.max(1, t.hits)).toFixed(0)}%`);
    });
  };
  run('identical stats 5 everywhere', [[mk('nL', flat(5)), mk('nR', flat(5))], [mk('fL', flat(5)), mk('fR', flat(5))]]);
  run('default teams (Toro/Mia vs Bruno/Ines)', [YOU, CPU]);
  const rng2 = seededRng(5);
  const pair = makePair(rng2, 3.0, 'x');
  run('club-level random opponents vs flat 4', [[mk('hL', flat(4)), mk('hR', flat(4))], pair.players as unknown as PlayerDef[]]);
}

function hero(level: number): PlayerDef {
  // Spread the points evenly over the seven attributes up to the cap (what a balanced player does).
  const p = newProfile();
  const alloc = emptyAlloc();
  let left = pointsEarned(level);
  const cap = statCap(level) - 4;
  for (let round = 0; left > 0 && round < 20; round++) for (const k of STAT_KEYS) if (left > 0 && alloc[k] < cap) { alloc[k]++; left--; }
  return heroFrom(YOU[0], { ...p, alloc });
}

/** The partner a player has at about this level (coins earned so far buy the next one up). */
const PARTNER_BY_LEVEL: Array<[number, string]> = [[1, 'olek'], [3, 'lena'], [6, 'tomek'], [9, 'marco'], [12, 'mia'], [15, 'kasia'], [18, 'sofia'], [21, 'ivan'], [24, 'diego'], [27, 'ana']];

function career(n: number, offset: number): void {
  const list = partners.partners as unknown as Array<{ id: string; name: string; stats: Record<StatKey, number> }>;
  console.log(`hero at start: ${JSON.stringify(hero(1).stats)}   division rating offset ${offset >= 0 ? '+' : ''}${offset}`);
  for (const d of divisions.divisions as Array<{ id: string; rating: number; minLevel: number }>) {
    const rng = seededRng(100 + d.minLevel);
    let wins = 0, ptsFor = 0, ptsAgainst = 0;
    const h = hero(d.minLevel);
    const pid = [...PARTNER_BY_LEVEL].reverse().find(([lv]) => d.minLevel >= lv)![1];
    const pdef = list.find((x) => x.id === pid)!;
    const part = mk('partner', pdef.stats);
    const rating = d.rating + offset;
    for (let i = 0; i < n; i++) {
      const opp = makePair(rng, Math.max(1, Math.min(10, rating + (rng() - 0.5))), 'o').players as unknown as PlayerDef[];
      const tally: Record<string, Tally> = {};
      const teams: Teams = [[h, part], opp];
      for (const p of teams.flat()) tally[p.id] = { hits: 0, spent: 0, tiredHits: 0, points: 0 };
      const r = playMatch(teams, rng, tally, (i % 2) as SideIndex);
      if (r.winner === 0) wins++;
      ptsFor += r.points[0];
      ptsAgainst += r.points[1];
    }
    const avg = STAT_KEYS.reduce((a, k) => a + h.stats[k], 0) / 7;
    const pavg = STAT_KEYS.reduce((a, k) => a + pdef.stats[k], 0) / 7;
    console.log(`${d.id.padEnd(9)} lvl ${String(d.minLevel).padStart(2)} hero ${avg.toFixed(1)} + ${pid.padEnd(5)} ${pavg.toFixed(1)}  opp ${rating.toFixed(1)}  win ${((100 * wins) / n).toFixed(0).padStart(3)}%  points ${(ptsFor / n).toFixed(1)}-${(ptsAgainst / n).toFixed(1)}`);
  }
}

const mode = process.argv[2] ?? 'fatigue';
const n = Number(process.argv[3] ?? 400);
if (mode === 'fatigue') fatigue(n);
else career(n, Number(process.argv[4] ?? 0));
