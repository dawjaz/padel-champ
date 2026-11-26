// How points and shots end, CPU v CPU, compared with real padel (docs/analysis/real.md).
// Run: npx vite-node scripts/simRealism.ts [matchesPerSetup] [shotIds...]
// Prints per set-up: winners / unforced errors / forced errors (an error on a ball that came in under pressure, `step.forcedError`) /
// aces / double faults as % of points, shots per point, lob share of rally hits, and per shot: uses, winner %, error %.
import playersData from '../src/data/players.json';
import { gutsFor, STAT_KEYS } from '../src/game/attributes';
import { isLob, withSpecial, type Step, type Teams } from '../src/game/point';
import { seededRng } from '../src/game/rng';
import type { PlayerDef, SideIndex, StatKey } from '../src/game/types';
import { playMatch, type Tally } from './simCore';
import { DUEL } from '../src/game/engine';
import { CPU_TACTICS } from '../src/game/ai';
import { SHOTS } from '../src/game/catalog';

// Tuning overrides (in memory only): GAP=statGap FORCED=forcedPerPressure LOB=lobWeight FAST_R=bajada_fast risk
const env = (k: string): number | undefined => (process.env[k] !== undefined ? Number(process.env[k]) : undefined);
if (env('GAP') !== undefined) DUEL.statGap = env('GAP')!;
if (env('FORCED') !== undefined) DUEL.forcedPerPressure = env('FORCED')!;
if (env('SPREAD') !== undefined) DUEL.spread = env('SPREAD')!;
if (env('LOB') !== undefined) CPU_TACTICS.lobWeight = env('LOB')!;
if (env('FAST_R') !== undefined) (SHOTS.find((x) => x.id === 'bajada_fast') as { risk: number }).risk = env('FAST_R')!;
console.log(`DUEL ${JSON.stringify(DUEL)} lobWeight ${CPU_TACTICS.lobWeight} bajada_fast risk ${SHOTS.find((x) => x.id === 'bajada_fast')!.risk}`);

const YOU = playersData.you as unknown as PlayerDef[];
const CPU = playersData.cpu as unknown as PlayerDef[];
const N = Number(process.argv[2] ?? 150);
const SHOW = process.argv.slice(3).length > 0 ? process.argv.slice(3) : ['volley', 'bandeja', 'vibora', 'smash_x3', 'smash_x4', 'bajada_fast', 'bajada_slow', 'flat', 'chiquita', 'dejada', 'rally_lob', 'lob', 'sp_skyrocket', 'sp_venom', 'sp_cornerlock', 'sp_freeze'];

const mk = (id: string, v: number): PlayerDef => {
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, v])) as Record<StatKey, number>;
  return { ...YOU[0], id, name: id, stats, maxGuts: gutsFor(v) };
};
export const SETUPS: Array<[string, Teams]> = [
  // Specials as in the game: players whose attributes average 5 or more get one (`withSpecial`).
  ['default teams', [YOU.map(withSpecial), CPU.map(withSpecial)]],
  ['even 4 v 4', [[mk('a0', 4), mk('a1', 4)], [mk('b0', 4), mk('b1', 4)]]],
  ['even 7 v 7', [[mk('a0', 7), mk('a1', 7)].map(withSpecial), [mk('b0', 7), mk('b1', 7)].map(withSpecial)]],
  ['strong 7 v weak 4', [[mk('a0', 7), mk('a1', 7)].map(withSpecial), [mk('b0', 4), mk('b1', 4)]]],
  ['5 v 6', [[mk('a0', 5), mk('a1', 5)].map(withSpecial), [mk('b0', 6), mk('b1', 6)].map(withSpecial)]],
];

interface S { uses: number; w: number; e: number; fe: number }
export function measure(teams: Teams, matches: number, seed = 11) {
  const rng = seededRng(seed);
  const shots: Record<string, S> = {};
  let points = 0, winners = 0, unforced = 0, forced = 0, aces = 0, dfs = 0, hits = 0, rallyHits = 0, lobs = 0, side0 = 0;
  let spW = 0, spAns = 0, spUses = 0;
  let cur = 0;
  for (let m = 0; m < matches; m++) {
    const tally: Record<string, Tally> = {};
    for (const p of teams.flat()) tally[p.id] = { hits: 0, spent: 0, tiredHits: 0, points: 0 };
    const r = playMatch(teams, rng, tally, (m % 2) as SideIndex, {
      onStep: (s: Step) => {
        cur++;
        if (s.kind === 'serve') {
          if (s.outcome === 'ace') aces++;
          if (s.outcome === 'double-fault') dfs++;
        } else {
          rallyHits++;
          if (isLob(s.shot)) lobs++;
          const st = (shots[s.shot.id] ??= { uses: 0, w: 0, e: 0, fe: 0 });
          st.uses++;
          if (s.outcome === 'winner') st.w++;
          if (s.outcome === 'error') {
            st.e++;
            if (s.forcedError) st.fe++;
          }
          if (s.shot.kind === 'special') {
            spUses++;
            if (s.outcome === 'winner') spW++;
            if (s.answered) spAns++;
          }
        }
        if (s.pointWinner !== null) {
          points++;
          hits += cur;
          cur = 0;
          if (s.outcome === 'winner' || s.outcome === 'ace') winners++;
          else if (s.outcome === 'error') (s.forcedError ? forced++ : unforced++);
        }
      },
    });
    side0 += r.points[0];
  }
  return { points, winners, unforced, forced, aces, dfs, hits, rallyHits, lobs, shots, spW, spAns, spUses, side0 };
}

const pct = (a: number, b: number): string => (b > 0 ? ((100 * a) / b).toFixed(1) : '-').padStart(5);

{
  console.log(`setup               | points |   W  | unf. E | forced E | ace | DF  | shots/pt | lob share | specials W / answered | side 0 won`);
  const perShot: string[] = [];
  for (const [name, teams] of SETUPS) {
    const r = measure(teams, N);
    console.log(`${name.padEnd(19)} | ${String(r.points).padStart(6)} | ${pct(r.winners, r.points)} | ${pct(r.unforced, r.points)}  | ${pct(r.forced, r.points)}    | ${pct(r.aces, r.points)} | ${pct(r.dfs, r.points)} | ${(r.hits / r.points).toFixed(2).padStart(8)} | ${pct(r.lobs, r.rallyHits)}     | ${pct(r.spW, r.spUses)} / ${pct(r.spAns, r.spUses)}          | ${pct(r.side0, r.points)}`);
    perShot.push(`${name}: ` + SHOW.map((id) => { const s = r.shots[id]; return s ? `${id} ${pct(s.w, s.uses).trim()}/${pct(s.e, s.uses).trim()}` : `${id} -`; }).join('  '));
  }
  console.log('\nper shot (winner % / error %):');
  for (const l of perShot) console.log(l);
}
