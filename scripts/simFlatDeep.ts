// How often a flat return aimed at a chosen point wins the point. Run: npx vite-node scripts/simFlatDeep.ts
import playersData from '../src/data/players.json';
import shotsData from '../src/data/shots.json';
import { pickHit } from '../src/game/ai';
import { startPoint, stepHit, type PointState } from '../src/game/point';
import { seededRng } from '../src/game/rng';
import type { PlayerDef, ShotDef } from '../src/game/types';
const YOU = playersData.you as unknown as PlayerDef[];
const CPU = playersData.cpu as unknown as PlayerDef[];
const flat = (shotsData as unknown as ShotDef[]).find((s) => s.id === 'flat')!;
const freshGuts = (): Record<string, number> => Object.fromEntries([...YOU, ...CPU, ...ME, ...OPP].map((p) => [p.id, p.maxGuts]));
const st = (over: Partial<PointState>): PointState => ({ ...startPoint(freshGuts(), 0, 0, 0), status: 'rally', holder: 0, hitterIdx: 0, hits: 1, ball: { height: 'mid', pressure: 0.1, air: false, zone: 'back' }, ...over });
import { gutsFor, STAT_KEYS } from '../src/game/attributes';
const mk = (src: PlayerDef, id: string, v: number): PlayerDef => ({ ...src, id, name: id, stats: Object.fromEntries(STAT_KEYS.map((k) => [k, v])) as never, maxGuts: gutsFor(v) });
let ME: PlayerDef[] = YOU, OPP: PlayerDef[] = CPU;
function run(label: string, formation: 'back' | 'mid' | 'net', defs: Array<{ x: number; z: number }>, target: { x: number; depth: number }) {
  const out: Record<string, number> = {};
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const rng = seededRng(i + 1);
    const state = st({ formation: [ 'back', formation ] as never });
    const r = stepHit([ME, OPP], state, flat, 'middle', rng, undefined, { target, positions: { defenders: defs as never, hitter: { x: 0, z: 18 } as never } });
    let res = r; let cpuStuck = 0;
    // play the rest of the point CPU vs CPU
    let guard = 0;
    while (res.state.status === 'rally' && guard++ < 60) {
      const { shot, direction, prefer } = pickHit([ME, OPP], res.state, rng);
      res = stepHit([ME, OPP], res.state, shot, direction, rng, prefer);
    }
    if (guard >= 60) cpuStuck++;
    const key = r.step.outcome === 'continue' ? (res.state.winner === 0 ? 'point won by me' : 'point won by CPU') : r.step.outcome;
    out[key] = (out[key] ?? 0) + 1;
  }
  console.log(label.padEnd(44), Object.entries(out).map(([k, v]) => `${k} ${(100 * v / N).toFixed(0)}%`).join('  '));
}
for (const [a, b] of [[4, 4], [6, 4], [8, 4], [8, 6], [10, 5]]) {
  ME = [mk(YOU[0], 'm0', a), mk(YOU[1], 'm1', a)]; OPP = [mk(CPU[0], 'o0', b), mk(CPU[1], 'o1', b)];
  run(`me ${a} vs opp ${b}, flat to centre depth 6`, 'back', [{ x: -2.4, z: 3 }, { x: 2.4, z: 3 }] as never, { x: 0, depth: 6 });
}
for (const target of [{ x: 0, depth: 3 }, { x: 0, depth: 6 }, { x: 0, depth: 8.5 }, { x: 2.5, depth: 6 }]) {
  run(`defenders mid-back, target ${JSON.stringify(target)}`, 'back', [{ x: -2.4, z: 5 }, { x: 2.4, z: 5 }] as never, target);
  run(`defenders deep,     target ${JSON.stringify(target)}`, 'back', [{ x: -2.4, z: 1.5 }, { x: 2.4, z: 1.5 }] as never, target);
}
console.log('--- opponents formation net, but standing back (z 3..5 m behind the net)');
ME = YOU; OPP = CPU;
for (const f of ['net', 'mid', 'back'] as const) for (const [lx, ld] of [[0, 8.5], [0, 6], [2.5, 8]]) run(`formation ${f}, target ${lx},${ld}`, f, [{ x: -2.4, z: 5 }, { x: 2.4, z: 5 }] as never, { x: lx, depth: ld });
console.log('--- same ball (mid, after a lob), different first shot; me 8 vs opp 4, target centre depth 6 (or the shot default)');
import { SHOTS } from '../src/game/catalog';
ME = [mk(YOU[0], 'm0', 8), mk(YOU[1], 'm1', 8)]; OPP = [mk(CPU[0], 'o0', 4), mk(CPU[1], 'o1', 4)];
for (const id of ['flat', 'chiquita', 'lob', 'rally_lob', 'bajada']) {
  const sh = SHOTS.find((x) => x.id === id); if (!sh) continue;
  const out: Record<string, number> = {}; const N = 2000;
  for (let i = 0; i < N; i++) {
    const rng = seededRng(i + 1);
    const state = st({ formation: ['back', 'mid'] as never });
    let res;
    try { res = stepHit([ME, OPP], state, sh, 'middle', rng, undefined, { ignoreRequires: true, positions: { defenders: [{ x: -2.4, z: 5 }, { x: 2.4, z: 5 }] as never, hitter: { x: 0, z: 18 } as never } }); } catch { break; }
    let g = 0; while (res.state.status === 'rally' && g++ < 60) { const { shot, direction, prefer } = pickHit([ME, OPP], res.state, rng); res = stepHit([ME, OPP], res.state, shot, direction, rng, prefer); }
    const key = res.state.winner === 0 ? 'me' : 'cpu'; out[key] = (out[key] ?? 0) + 1;
  }
  console.log(id.padEnd(12), `me ${(100 * (out.me ?? 0) / N).toFixed(0)}%`);
}
