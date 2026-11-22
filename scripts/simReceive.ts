// Receiver's point win rate per wall serve, for AFTER BOUNCE vs WAIT FOR THE GLASS. Run: npx vite-node scripts/simReceive.ts [matches]
import playersData from '../src/data/players.json';
import { gutsFor, STAT_KEYS } from '../src/game/attributes';
import { seededRng } from '../src/game/rng';
import type { Step, Teams } from '../src/game/point';
import type { PlayerDef, SideIndex, StatKey } from '../src/game/types';
import { playMatch, type Tally } from './simCore';

const YOU = playersData.you as unknown as PlayerDef[];
const n = Number(process.argv[2] ?? 300);
const mk = (id: string, v: number): PlayerDef => {
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, v])) as Record<StatKey, number>;
  return { ...YOU[0], id, name: id, stats, maxGuts: gutsFor(v) };
};
const matchups: Array<[string, Teams]> = [
  ['even 5 v 5', [[mk('a0', 5), mk('a1', 5)], [mk('b0', 5), mk('b1', 5)]]],
  ['servers 8 v receivers 4', [[mk('a0', 8), mk('a1', 8)], [mk('b0', 4), mk('b1', 4)]]],
  ['servers 4 v receivers 8', [[mk('a0', 4), mk('a1', 4)], [mk('b0', 8), mk('b1', 8)]]],
];
type Cell = { pts: number; recvWins: number; aces: number };
for (const [label, teams] of matchups) {
  console.log(`\n== ${label}: receiver wins % of points (all serves of these shots, both sides serving; ace% in brackets)`);
  const res: Record<string, Record<string, Cell>> = {};
  for (const mode of ['bounce', 'wall'] as const) {
    const rng = seededRng(5);
    let serveId = '';
    let recvSide: SideIndex = 1;
    for (let i = 0; i < n; i++) {
      const tally: Record<string, Tally> = {};
      for (const p of teams.flat()) tally[p.id] = { hits: 0, spent: 0, tiredHits: 0, points: 0 };
      playMatch(teams, rng, tally, (i % 2) as SideIndex, {
        receive: mode,
        onStep: (s: Step) => {
          if (s.kind === 'serve' && (s.outcome === 'in' || s.outcome === 'ace')) {
            serveId = s.shot.id;
            recvSide = (s.side === 0 ? 1 : 0) as SideIndex;
          }
          if (s.pointWinner !== null && s.outcome !== 'double-fault' && serveId !== '') {
            const c = ((res[serveId] ??= {})[mode] ??= { pts: 0, recvWins: 0, aces: 0 });
            c.pts++;
            if (s.pointWinner === recvSide) c.recvWins++;
            if (s.kind === 'serve' && s.outcome === 'ace') c.aces++;
            serveId = '';
          }
        },
      });
    }
  }
  for (const [id, byMode] of Object.entries(res)) {
    const f = (c?: Cell): string => (c ? `${((100 * c.recvWins) / c.pts).toFixed(1).padStart(5)}% (ace ${((100 * c.aces) / c.pts).toFixed(1)}%) n=${c.pts}` : '-');
    console.log(`   ${id.padEnd(12)} bounce ${f(byMode.bounce)}   wall ${f(byMode.wall)}`);
  }
}
