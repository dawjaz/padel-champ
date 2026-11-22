// Shot statistics from CPU-vs-CPU matches. Run: npx vite-node scripts/simShots.ts [matches]
// Prints rally length, usage and results per shot, and the receiver's results with AFTER BOUNCE vs WAIT FOR THE GLASS.
import playersData from '../src/data/players.json';
import { gutsFor, STAT_KEYS } from '../src/game/attributes';
import { seededRng } from '../src/game/rng';
import type { Step, Teams } from '../src/game/point';
import type { PlayerDef, SideIndex, StatKey } from '../src/game/types';
import { playMatch, type Tally } from './simCore';

const YOU = playersData.you as unknown as PlayerDef[];
const CPU = playersData.cpu as unknown as PlayerDef[];
const n = Number(process.argv[2] ?? 300);

const mk = (id: string, v: number): PlayerDef => {
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, v])) as Record<StatKey, number>;
  return { ...YOU[0], id, name: id, stats, maxGuts: gutsFor(v) };
};
const sets: Array<[string, Teams]> = [
  ['default teams', [YOU, CPU]],
  ['even 4 v 4', [[mk('a0', 4), mk('a1', 4)], [mk('b0', 4), mk('b1', 4)]]],
  ['even 7 v 7', [[mk('a0', 7), mk('a1', 7)], [mk('b0', 7), mk('b1', 7)]]],
];

interface ShotStat { uses: number; winners: number; errors: number; continues: number }

function run(label: string, teams: Teams, receive?: 'bounce' | 'wall') {
  const rng = seededRng(77);
  const shots: Record<string, ShotStat> = {};
  let points = 0, hits = 0, aces = 0, doubleFaults = 0;
  const rallyLen: number[] = [];
  let wallServePoints = 0, wallServeRecvWins = 0, lastWall = false, lastRecvSide: SideIndex = 0;
  let cur = 0;
  for (let i = 0; i < n; i++) {
    const tally: Record<string, Tally> = {};
    for (const p of teams.flat()) tally[p.id] = { hits: 0, spent: 0, tiredHits: 0, points: 0 };
    playMatch(teams, rng, tally, (i % 2) as SideIndex, {
      receive,
      onStep: (s: Step) => {
        if (s.kind === 'serve') {
          if (s.outcome === 'ace') aces++;
          if (s.outcome === 'double-fault') doubleFaults++;
          if (s.outcome === 'in' || s.outcome === 'ace') {
            lastWall = s.shot.wall !== 'none';
            lastRecvSide = (s.side === 0 ? 1 : 0) as SideIndex;
            cur = 0;
          }
        } else {
          cur++;
          hits++;
          const st = (shots[s.shot.id] ??= { uses: 0, winners: 0, errors: 0, continues: 0 });
          st.uses++;
          if (s.outcome === 'winner') st.winners++;
          else if (s.outcome === 'error') st.errors++;
          else st.continues++;
        }
        if (s.pointWinner !== null) {
          points++;
          rallyLen.push(cur);
          if (lastWall && s.kind !== 'serve' || (lastWall && s.kind === 'serve' && s.outcome === 'ace')) {
            wallServePoints++;
            if (s.pointWinner === lastRecvSide) wallServeRecvWins++;
          }
          cur = 0;
        }
      },
    });
  }
  const avg = rallyLen.reduce((a, b) => a + b, 0) / rallyLen.length;
  const long = rallyLen.filter((l) => l >= 12).length / rallyLen.length;
  console.log(`\n== ${label}${receive ? ` (receive always ${receive})` : ''}: ${points} points, avg rally ${avg.toFixed(2)} hits after the serve, ${(100 * long).toFixed(0)}% of rallies 12+ hits, aces ${((100 * aces) / points).toFixed(1)}%, double faults ${((100 * doubleFaults) / points).toFixed(1)}%`);
  console.log(`   wall serves: receiver wins ${wallServePoints > 0 ? ((100 * wallServeRecvWins) / wallServePoints).toFixed(1) : '-'}% of ${wallServePoints} points`);
  return { shots, hits, points };
}

for (const [label, teams] of sets) {
  const r = run(label, teams);
  if (label === 'even 4 v 4' || label === 'default teams') {
    console.log('   shot'.padEnd(22) + 'share  winner%  error%');
    for (const [id, st] of Object.entries(r.shots).sort((a, b) => b[1].uses - a[1].uses)) {
      console.log(`   ${id.padEnd(17)} ${((100 * st.uses) / r.hits).toFixed(1).padStart(5)}% ${((100 * st.winners) / st.uses).toFixed(1).padStart(7)}% ${((100 * st.errors) / st.uses).toFixed(1).padStart(7)}%`);
    }
  }
}
for (const [label, teams] of sets) {
  run(label, teams, 'bounce');
  run(label, teams, 'wall');
}
