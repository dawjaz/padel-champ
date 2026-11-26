// How points and single shots end in the engine (read-only analysis, nothing in src/ is changed).
// Run: npx vite-node scripts/simMatrix.ts [outDir] [matchPoints] [trialsPerCell]
//   outDir defaults to ../analysis (next to the repo); writes engine_matrix.csv there and prints markdown tables.
// Part 1: CPU-vs-CPU matches (simCore.playMatch) for several team strengths: how points end, rally lengths.
// Part 2: a shot matrix: stepHit called directly for every rally shot / special across ball, positions, aim and level.
// Part 3: sensitivity: the same shot with the receiving defender placed further and further from the landing spot.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import playersData from '../src/data/players.json';
import { pickHit } from '../src/game/ai';
import { fatigued, gutsFor, STAT_KEYS } from '../src/game/attributes';
import { SHOTS } from '../src/game/catalog';
import { landingX, landingZ, restPos } from '../src/game/court';
import { reachAgainst, stepHit, unavailableReason, withSpecial, type PointState, type ReachPositions, type Step, type Teams } from '../src/game/point';
import { seededRng } from '../src/game/rng';
import type { BallState, CourtPos, Direction, Formation, Height, PlayerDef, ShotDef, SideIndex, StatKey } from '../src/game/types';
import { playMatch, type Tally } from './simCore';

const OUT = resolve(process.argv[2] ?? '../analysis');
const MATCH_POINTS = Number(process.argv[3] ?? 6000);
const TRIALS = Number(process.argv[4] ?? 3000);

const YOU = playersData.you as unknown as PlayerDef[];
const CPU = playersData.cpu as unknown as PlayerDef[];
const mk = (id: string, v: number): PlayerDef => {
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, v])) as Record<StatKey, number>;
  return { ...YOU[0], id, name: id, stats, maxGuts: gutsFor(v) };
};
const pair = (tag: string, v: number): PlayerDef[] => [mk(`${tag}0`, v), mk(`${tag}1`, v)];
const other = (s: SideIndex): SideIndex => (s === 0 ? 1 : 0);
const pct = (a: number, b: number): string => (b > 0 ? ((100 * a) / b).toFixed(1) : '-');

// ---------------------------------------------------------------- Part 1: matches
interface MatchStats {
  points: number;
  aces: number;
  doubleFaults: number;
  winners: number;
  winnersGap: number; // reach < 1 at the nominal landing spot: the ball came down out of the defender's full reach
  winnersReachable: number; // reach = 1: the ball came down within the defender's full reach and still was not touched
  winnersFixed: number; // smashes over the fence / rulo: no landing spot, reach is not measured (always 1)
  winnersReboundBack: number;
  winnersEarly: number; // Por Cuatro fumbled before the glass (counted as the hitter's winner)
  winnersSpecial: number;
  winnersReturn: number;
  errors: number;
  errorsPressured: number; // proxy for a forced error: the ball the hitter played came with pressure >= 0.10
  errorsReturn: number;
  hitsTotal: number;
  rally: number[]; // shots per point including the serve that was in (ace = 1, double fault = 0)
  winnerShots: Record<string, number>;
  errorShots: Record<string, number>;
  usage: Record<string, number>;
  pressureOnErrors: number;
  pressureOnAll: number;
  errBuckets: number[]; // errors by incoming pressure: 0, (0, 0.05), [0.05, 0.10), >= 0.10
  hitBuckets: number[];
  hitsCounted: number;
}

function newStats(): MatchStats {
  return {
    points: 0, aces: 0, doubleFaults: 0, winners: 0, winnersGap: 0, winnersReachable: 0, winnersFixed: 0, winnersReboundBack: 0,
    winnersEarly: 0, winnersSpecial: 0, winnersReturn: 0, errors: 0, errorsPressured: 0, errorsReturn: 0, hitsTotal: 0, rally: [],
    winnerShots: {}, errorShots: {}, usage: {}, pressureOnErrors: 0, pressureOnAll: 0, hitsCounted: 0, errBuckets: [0, 0, 0, 0], hitBuckets: [0, 0, 0, 0],
  };
}

const FORCED_PRESSURE = 0.1;
const bucket = (p: number): number => (p <= 0 ? 0 : p < 0.05 ? 1 : p < FORCED_PRESSURE ? 2 : 3);

/** The aim depth the CPU asked for (see ai.ts pickHit): deeper against a pair at the net, shorter against a pair at the back. */
function preferDepth(shot: ShotDef, defFormation: Formation): number | undefined {
  if (shot.fixedDirection || shot.overFence) return undefined;
  if (defFormation === 'net') return shot.landDepth + 1.5;
  if (defFormation === 'back') return shot.landDepth - 1.5;
  return undefined;
}

function runMatches(label: string, teams: Teams, seed: number): MatchStats {
  const rng = seededRng(seed);
  const s = newStats();
  let prev: PointState | null = null;
  let shotsThisPoint = 0;
  for (let m = 0; s.points < MATCH_POINTS; m++) {
    const tally: Record<string, Tally> = {};
    for (const p of teams.flat()) tally[p.id] = { hits: 0, spent: 0, tiredHits: 0, points: 0 };
    playMatch(teams, rng, tally, (m % 2) as SideIndex, {
      onStep: (step: Step, state: PointState) => {
        if (step.kind === 'serve') {
          if (step.outcome === 'ace') { s.aces++; shotsThisPoint = 1; }
          else if (step.outcome === 'double-fault') { s.doubleFaults++; shotsThisPoint = 0; }
          else if (step.outcome === 'in') shotsThisPoint = 1;
        } else {
          shotsThisPoint++;
          s.hitsTotal++;
          const inc = prev!.ball;
          s.pressureOnAll += inc.pressure; s.hitsCounted++;
          s.hitBuckets[bucket(inc.pressure)]++;
          s.usage[step.shot.id] = (s.usage[step.shot.id] ?? 0) + 1;
          const defSide = other(step.side);
          if (step.outcome === 'winner') {
            s.winners++;
            s.winnerShots[step.shot.id] = (s.winnerShots[step.shot.id] ?? 0) + 1;
            if (step.kind === 'return') s.winnersReturn++;
            if (step.shot.kind === 'special') s.winnersSpecial++;
            if (step.reboundBack) s.winnersReboundBack++;
            if (step.earlyError) s.winnersEarly++;
            if (step.landX === undefined) s.winnersFixed++;
            else {
              const f = prev!.formation[defSide];
              const defs = teams[defSide].map((p) => fatigued(p, prev!.guts[p.id])) as [PlayerDef, PlayerDef];
              const r = reachAgainst(defs, defSide, f, step.shot, step.landX, preferDepth(step.shot, f) ?? step.shot.landDepth);
              if (r >= 0.999) s.winnersReachable++; else s.winnersGap++;
            }
          } else if (step.outcome === 'error') {
            s.errors++;
            s.errorShots[step.shot.id] = (s.errorShots[step.shot.id] ?? 0) + 1;
            s.pressureOnErrors += inc.pressure;
          s.errBuckets[bucket(inc.pressure)]++;
            if (inc.pressure >= FORCED_PRESSURE) s.errorsPressured++;
            if (step.kind === 'return') s.errorsReturn++;
          }
        }
        if (step.pointWinner !== null) {
          s.points++;
          s.rally.push(shotsThisPoint);
        }
        prev = state;
      },
    });
  }
  void label;
  return s;
}

function matchTable(rows: Array<[string, MatchStats]>): string {
  const h = '| Teams | Points | Winner | Unforced err. | Forced err. (proxy) | Ace | Double fault | Winner into a gap | Winner within reach | Avg shots/point (incl. serve) | 1-2 | 3-5 | 6-9 | 10+ |';
  const sep = '|' + '---|'.repeat(14);
  const lines = rows.map(([l, s]) => {
    const n = s.points;
    const r = s.rally;
    const avg = r.reduce((a, b) => a + b, 0) / r.length;
    const b = (lo: number, hi: number): string => pct(r.filter((x) => x >= lo && x <= hi).length, r.length);
    return `| ${l} | ${n} | ${pct(s.winners, n)}% | ${pct(s.errors - s.errorsPressured, n)}% | ${pct(s.errorsPressured, n)}% | ${pct(s.aces, n)}% | ${pct(s.doubleFaults, n)}% | ${pct(s.winnersGap, n)}% | ${pct(s.winnersReachable + s.winnersFixed, n)}% | ${avg.toFixed(2)} | ${b(0, 2)}% | ${b(3, 5)}% | ${b(6, 9)}% | ${b(10, 999)}% |`;
  });
  return [h, sep, ...lines].join('\n');
}

function matchDetail(rows: Array<[string, MatchStats]>): string {
  const h = '| Teams | Winners: within reach (landing spot) | over the fence / rulo (no spot) | rebound back over the net | Por Cuatro early fumble | specials | on the return | Errors on a ball with pressure >= 0.10 | Mean pressure: all hits / errors |';
  const sep = '|' + '---|'.repeat(9);
  const lines = rows.map(([l, s]) =>
    `| ${l} | ${pct(s.winnersReachable, s.winners)}% | ${pct(s.winnersFixed, s.winners)}% | ${pct(s.winnersReboundBack, s.winners)}% | ${pct(s.winnersEarly, s.winners)}% | ${pct(s.winnersSpecial, s.winners)}% | ${pct(s.winnersReturn, s.winners)}% | ${pct(s.errorsPressured, s.errors)}% | ${(s.pressureOnAll / s.hitsCounted).toFixed(3)} / ${(s.pressureOnErrors / Math.max(1, s.errors)).toFixed(3)} |`);
  const h2 = '| Teams | Incoming pressure: 0 | (0, 0.05) | [0.05, 0.10) | >= 0.10 | Error rate per hit in each band (0 / low / mid / high) |';
  const sep2 = '|---|---|---|---|---|---|';
  const lines2 = rows.map(([l, s]) => `| ${l} | ${s.hitBuckets.map((b) => pct(b, s.hitsCounted) + '% of hits').join(' | ')} | ${s.errBuckets.map((e, i) => pct(e, s.hitBuckets[i])).join(' / ')} % |`);
  return [h, sep, ...lines, '', h2, sep2, ...lines2].join('\n');
}

function shotUsageTable(s: MatchStats): string {
  const h = '| Shot | Share of hits | Winner% | Error% | Share of all winners | Share of all errors |';
  const sep = '|---|---|---|---|---|---|';
  const lines = Object.entries(s.usage).sort((a, b) => b[1] - a[1]).map(([id, u]) =>
    `| ${id} | ${pct(u, s.hitsTotal)}% | ${pct(s.winnerShots[id] ?? 0, u)}% | ${pct(s.errorShots[id] ?? 0, u)}% | ${pct(s.winnerShots[id] ?? 0, s.winners)}% | ${pct(s.errorShots[id] ?? 0, s.errors)}% |`);
  return [h, sep, ...lines].join('\n');
}

// ---------------------------------------------------------------- Part 2: shot matrix
type Ctx = 'bounce' | 'glass' | 'air';
type DefSetup = 'back' | 'mid' | 'net' | 'split';
interface Aim { id: string; dir?: Direction; target?: { x: number; depth: number } }
// The hitter is always the left-hand player (index 0, x = -2.5) of the near pair (side 0); the defenders are side 1.
// Directions as in the menu (no CPU gap preference: one of the 10 aim points of the direction at random). Target aims as with
// SETTINGS > AIM: TAP THE SPOT (the scene picks the direction whose landing point is nearest).
const AIMS: Aim[] = [
  { id: 'parallel', dir: 'parallel' },
  { id: 'middle', dir: 'middle' },
  { id: 'cross', dir: 'cross' },
  { id: 'T:mid-deep', target: { x: 0, depth: 8.8 } },
  { id: 'T:mid-nominal', target: { x: 0, depth: -1 } }, // depth -1 = the shot's own landDepth
  { id: 'T:corner-deep', target: { x: 3.6, depth: 8.8 } },
];
const DIRS: Direction[] = ['parallel', 'middle', 'cross'];
function dirForTarget(x: number, hitterIdx: number): Direction {
  let best: Direction = 'middle';
  let bestD = Infinity;
  for (const d of DIRS) {
    const dx = Math.abs(landingX(d, d === 'cross' ? 1 - hitterIdx : hitterIdx) - x);
    if (dx < bestD) { bestD = dx; best = d; }
  }
  return best;
}

function ballFor(height: Height, ctx: Ctx): BallState {
  return {
    height,
    pressure: 0,
    glass: ctx === 'glass',
    ...(ctx === 'air' ? { air: true } : {}),
    // generous extras so the special requirements (bloqueo: a hard ball, contrapared: by the wall, rulo: mid-court, smash: weak lob) can be met
    speed: 25,
    nearWall: true,
    zone: 'mid',
    ...(ctx === 'air' && height === 'high' ? { lob: 'weak' as const } : {}),
  };
}

function defPositions(setup: DefSetup): [CourtPos, CourtPos] {
  if (setup === 'split') return [restPos(1, 0, 'net'), restPos(1, 1, 'back')];
  return [restPos(1, 0, setup), restPos(1, 1, setup)];
}
/** The engine keeps one formation per pair; for the split set-up (one up, one back) the pair is 'back' for the rules and only the reach sees the real places. */
const defFormation = (setup: DefSetup): Formation => (setup === 'split' ? 'back' : setup);

interface Cell {
  shot: string; kind: string; level: string; height: Height; ctx: Ctx; hitterF: Formation; defSetup: DefSetup; aim: string; dir: Direction;
  n: number; win: number; err: number; cont: number; pressSum: number; reachSum: number; reachOne: number;
  winReachable: number; reboundBack: number; early: number; answered: number; block: number;
  replyWin: number; replyErr: number; replyCont: number; replyN: number; nextLow: number; nextGlass: number;
}

function stateFor(teams: Teams, ball: BallState, hitterF: Formation, setup: DefSetup, returnShot: boolean): PointState {
  const guts: Record<string, number> = {};
  for (const p of teams.flat()) guts[p.id] = p.maxGuts;
  return {
    servingSide: returnShot ? 1 : 0, serverIdx: 0, serveLane: 1, receiverIdx: 0, status: 'rally', attempt: 1,
    hits: returnShot ? 0 : 2, holder: 0, hitterIdx: 0, ball, formation: [hitterF, defFormation(setup)], guts, winner: null,
  };
}

function runCell(teams: Teams, shot: ShotDef, level: string, height: Height, ctx: Ctx, hitterF: Formation, setup: DefSetup, aim: Aim, seed: number): Cell | null {
  const returnShot = shot.kind === 'return';
  const ball = ballFor(height, ctx);
  const st0 = stateFor(teams, ball, hitterF, setup, returnShot);
  if (unavailableReason(shot, st0) !== null) return null;
  const fixedAim = shot.overFence === true || shot.wall === 'fence';
  if (aim.target && fixedAim) return null; // no tap target for the smashes over the fence and the rulo
  if (shot.fixedDirection && aim.dir && aim.dir !== shot.fixedDirection) return null;
  const rng = seededRng(seed);
  const positions: ReachPositions = { defenders: defPositions(setup), hitter: restPos(0, 0, hitterF) };
  const target = aim.target ? { x: aim.target.x, depth: aim.target.depth < 0 ? shot.landDepth : aim.target.depth } : undefined;
  const dir: Direction = shot.fixedDirection ?? (aim.dir ?? dirForTarget(target!.x, 0));
  const c: Cell = {
    shot: shot.id, kind: shot.kind, level, height, ctx, hitterF, defSetup: setup, aim: aim.id, dir,
    n: 0, win: 0, err: 0, cont: 0, pressSum: 0, reachSum: 0, reachOne: 0, winReachable: 0, reboundBack: 0, early: 0, answered: 0, block: 0,
    replyWin: 0, replyErr: 0, replyCont: 0, replyN: 0, nextLow: 0, nextGlass: 0,
  };
  const defs = [teams[1][0], teams[1][1]] as [PlayerDef, PlayerDef];
  for (let t = 0; t < TRIALS; t++) {
    const { state, step } = stepHit(teams, st0, shot, dir, rng, undefined, { positions, ...(target ? { target } : {}) });
    c.n++;
    // reach of the nominal spot, as resolveHit saw it (target: the rolled spot; direction: the rolled aim point at the nominal depth)
    const reach = step.landX === undefined ? 1 : reachAgainst(defs, 1, st0.formation[1], shot, step.landX, target ? (step.landDepth ?? shot.landDepth) : shot.landDepth, positions);
    c.reachSum += reach;
    if (reach >= 0.999) c.reachOne++;
    if (step.outcome === 'winner') {
      c.win++;
      if (reach >= 0.999) c.winReachable++;
      if (step.reboundBack) c.reboundBack++;
      if (step.earlyError) c.early++;
    } else if (step.outcome === 'error') c.err++;
    else {
      c.cont++;
      c.pressSum += state.ball.pressure;
      if (step.answered) c.answered++;
      if (step.block) c.block++;
      if (state.ball.height === 'low') c.nextLow++;
      if (state.ball.glass) c.nextGlass++;
      // the defender's reply, as the CPU would play it (the hitting pair at the rest places of its new formation)
      const opp = [0, 1].map((i) => restPos(0, i, state.formation[0]));
      const pick = pickHit(teams, state, rng, opp);
      const reply = stepHit(teams, state, pick.shot, pick.direction, rng, pick.prefer, { positions: { defenders: opp as [CourtPos, CourtPos], hitter: restPos(1, state.hitterIdx, state.formation[1]) } });
      c.replyN++;
      if (reply.step.outcome === 'winner') c.replyWin++;
      else if (reply.step.outcome === 'error') c.replyErr++;
      else c.replyCont++;
    }
  }
  return c;
}

// ---------------------------------------------------------------- main
mkdirSync(OUT, { recursive: true });
const out: string[] = [];
const log = (s = ''): void => { out.push(s); console.log(s); };

const teamSets: Array<[string, Teams]> = [
  ['default (Toro+Mia v Bruno+Ines)', [YOU.map(withSpecial), CPU.map(withSpecial)]],
  ['even 4 v 4', [pair('a', 4).map(withSpecial), pair('b', 4).map(withSpecial)]],
  ['even 7 v 7', [pair('a', 7).map(withSpecial), pair('b', 7).map(withSpecial)]],
  ['even 7 v 7, no specials', [pair('a', 7), pair('b', 7)]],
  ['strong 7 v weak 4', [pair('a', 7).map(withSpecial), pair('b', 4).map(withSpecial)]],
];
log('## Part 1: CPU v CPU matches');
const mRows: Array<[string, MatchStats]> = teamSets.map(([l, t], i) => [l, runMatches(l, t, 1000 + i)]);
log(matchTable(mRows));
log();
log(matchDetail(mRows));
for (const [l, s] of mRows) {
  if (!l.startsWith('default') && !l.startsWith('even 4') && !l.startsWith('even 7 v 7,')) continue;
  log();
  log(`### Shots in play: ${l}`);
  log(shotUsageTable(s));
}

log();
log('## Part 2: shot matrix');
const levels: Array<[string, Teams]> = [
  ['4v4', [pair('a', 4), pair('b', 4)]],
  ['7v7', [pair('a', 7), pair('b', 7)]],
  ['7v4', [pair('a', 7), pair('b', 4)]],
];
const matrixShots = SHOTS.filter((s) => s.kind !== 'serve');
const heights: Height[] = ['low', 'mid', 'high'];
const ctxs: Ctx[] = ['bounce', 'glass', 'air'];
const forms: Formation[] = ['back', 'mid', 'net'];
const setups: DefSetup[] = ['back', 'mid', 'net', 'split'];
const cells: Cell[] = [];
let seed = 1;
const t0 = Date.now();
for (const shot of matrixShots)
  for (const [lv, teams] of levels)
    for (const h of heights)
      for (const cx of ctxs)
        for (const hf of forms)
          for (const ds of setups)
            for (const aim of AIMS) {
              const c = runCell(teams, shot, lv, h, cx, hf, ds, aim, seed++);
              if (c) cells.push(c);
            }
console.error(`matrix: ${cells.length} cells in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

const csvHead = 'shot,kind,level,height,ctx,hitter_formation,def_setup,aim,direction,trials,winner_pct,error_pct,continue_pct,mean_next_pressure,mean_reach,reach1_pct,winners_within_reach_pct,rebound_back_pct,early_fumble_pct,special_answered_pct,blocked_pct,next_ball_low_pct,next_ball_glass_pct,reply_winner_pct,reply_error_pct,reply_continue_pct';
const f = (v: number, d = 1): string => v.toFixed(d);
const csv = [csvHead, ...cells.map((c) => [
  c.shot, c.kind, c.level, c.height, c.ctx, c.hitterF, c.defSetup, c.aim, c.dir, c.n,
  f((100 * c.win) / c.n), f((100 * c.err) / c.n), f((100 * c.cont) / c.n), c.cont ? f(c.pressSum / c.cont, 3) : '',
  f(c.reachSum / c.n, 3), f((100 * c.reachOne) / c.n), c.win ? f((100 * c.winReachable) / c.win) : '',
  f((100 * c.reboundBack) / c.n), f((100 * c.early) / c.n), f((100 * c.answered) / c.n), c.cont ? f((100 * c.block) / c.cont) : '',
  c.cont ? f((100 * c.nextLow) / c.cont) : '', c.cont ? f((100 * c.nextGlass) / c.cont) : '',
  c.replyN ? f((100 * c.replyWin) / c.replyN) : '', c.replyN ? f((100 * c.replyErr) / c.replyN) : '', c.replyN ? f((100 * c.replyCont) / c.replyN) : '',
].join(','))];
writeFileSync(resolve(OUT, 'engine_matrix.csv'), csv.join('\n') + '\n');

/** Pooled W/E/C for a group of cells (equal weight per cell). */
function pool(cs: Cell[]): { w: number; e: number; c: number; p: number; rw: number; re: number; n: number } | null {
  if (cs.length === 0) return null;
  const n = cs.reduce((a, c) => a + c.n, 0);
  const w = cs.reduce((a, c) => a + c.win, 0);
  const e = cs.reduce((a, c) => a + c.err, 0);
  const co = cs.reduce((a, c) => a + c.cont, 0);
  const ps = cs.reduce((a, c) => a + c.pressSum, 0);
  const rn = cs.reduce((a, c) => a + c.replyN, 0);
  const rw = cs.reduce((a, c) => a + c.replyWin, 0);
  const re = cs.reduce((a, c) => a + c.replyErr, 0);
  return { w: (100 * w) / n, e: (100 * e) / n, c: (100 * co) / n, p: co ? ps / co : 0, rw: rn ? (100 * rw) / rn : 0, re: rn ? (100 * re) / rn : 0, n };
}
const fmt = (r: ReturnType<typeof pool>): string => (r ? `${r.w.toFixed(0)}/${r.e.toFixed(0)}/${r.c.toFixed(0)}` : '-');

// Table A: per shot, by defender set-up (all aims, heights, contexts and hitter places pooled), per level
for (const lv of ['4v4', '7v7', '7v4']) {
  log();
  log(`### A. Winner / error / continue % by defender set-up, level ${lv} (direction aims only, everything else pooled)`);
  log('| Shot | def back | def mid | def net | def split (1 up 1 back) | all | mean pressure after continue | reply W/E % (defender\'s next shot) |');
  log('|---|---|---|---|---|---|---|---|');
  for (const shot of matrixShots) {
    const cs = cells.filter((c) => c.shot === shot.id && c.level === lv && !c.aim.startsWith('T:'));
    if (cs.length === 0) continue;
    const all = pool(cs)!;
    log(`| ${shot.id} | ${setups.map((s) => fmt(pool(cs.filter((c) => c.defSetup === s)))).join(' | ')} | ${fmt(all)} | ${all.p.toFixed(3)} | ${all.rw.toFixed(0)}/${all.re.toFixed(0)} |`);
  }
}

// Table B: per shot, by aim, per level (defender set-ups pooled)
for (const lv of ['4v4', '7v7', '7v4']) {
  log();
  log(`### B. Winner / error / continue % by aim, level ${lv} (defender set-ups, heights, contexts pooled)`);
  log(`| Shot | ${AIMS.map((a) => a.id).join(' | ')} |`);
  log('|---|' + AIMS.map(() => '---|').join(''));
  for (const shot of matrixShots) {
    const cs = cells.filter((c) => c.shot === shot.id && c.level === lv);
    if (cs.length === 0) continue;
    log(`| ${shot.id} | ${AIMS.map((a) => fmt(pool(cs.filter((c) => c.aim === a.id)))).join(' | ')} |`);
  }
}

// Table C: per shot, by incoming height, context and hitter place (level 4 and 7 side by side)
log();
log('### C. Winner / error / continue % by the ball played and the hitter\'s place (direction aims, defender set-ups pooled): 4v4 | 7v7');
log('| Shot | low | mid | high | after bounce | off glass | out of the air | hitter back | hitter mid | hitter net |');
log('|---|---|---|---|---|---|---|---|---|---|');
for (const shot of matrixShots) {
  const cs = cells.filter((c) => c.shot === shot.id && !c.aim.startsWith('T:'));
  const two = (sel: (c: Cell) => boolean): string => {
    const a = pool(cs.filter((c) => c.level === '4v4' && sel(c)));
    const b = pool(cs.filter((c) => c.level === '7v7' && sel(c)));
    return a || b ? `${fmt(a)} \\| ${fmt(b)}` : '-';
  };
  log(`| ${shot.id} | ${heights.map((h) => two((c) => c.height === h)).join(' | ')} | ${ctxs.map((x) => two((c) => c.ctx === x)).join(' | ')} | ${forms.map((x) => two((c) => c.hitterF === x)).join(' | ')} |`);
}

// Outliers
log();
log('### D. Outlier cells (winner > 35%, error > 30%, or 0% continue)');
const outl = cells.filter((c) => c.win / c.n > 0.35 || c.err / c.n > 0.3 || c.cont === 0);
const byShot: Record<string, Cell[]> = {};
for (const c of outl) (byShot[c.shot] ??= []).push(c);
log('| Shot | outlier cells / all cells | max winner% (cell) | max error% | cells with 0% continue |');
log('|---|---|---|---|---|');
for (const shot of matrixShots) {
  const all = cells.filter((c) => c.shot === shot.id);
  const o = byShot[shot.id] ?? [];
  if (all.length === 0) continue;
  const mw = all.reduce((a, c) => (c.win / c.n > a.win / a.n ? c : a), all[0]);
  const me = all.reduce((a, c) => (c.err / c.n > a.err / a.n ? c : a), all[0]);
  const zero = all.filter((c) => c.cont === 0).length;
  log(`| ${shot.id} | ${o.length} / ${all.length} | ${pct(mw.win, mw.n)}% (${mw.level} ${mw.height} ${mw.ctx} hitter ${mw.hitterF} def ${mw.defSetup} ${mw.aim}) | ${pct(me.err, me.n)}% | ${zero} |`);
}

// Defender position effect: spread of winner% across defender set-ups for the same other conditions
log();
log('### E. Does the defenders\' position matter? Range of winner% across the 4 defender set-ups, same shot/level/ball/hitter/aim');
log('| Shot | mean range (pp) | max range (pp) | cells where all 4 set-ups are within 2 pp |');
log('|---|---|---|---|');
for (const shot of matrixShots) {
  const groups: Record<string, Cell[]> = {};
  for (const c of cells.filter((x) => x.shot === shot.id)) (groups[[c.level, c.height, c.ctx, c.hitterF, c.aim].join('|')] ??= []).push(c);
  const ranges = Object.values(groups).filter((g) => g.length >= 2).map((g) => {
    const ws = g.map((c) => (100 * c.win) / c.n);
    return Math.max(...ws) - Math.min(...ws);
  });
  if (ranges.length === 0) continue;
  const flat = ranges.filter((r) => r <= 2).length;
  log(`| ${shot.id} | ${(ranges.reduce((a, b) => a + b, 0) / ranges.length).toFixed(1)} | ${Math.max(...ranges).toFixed(1)} | ${flat} / ${ranges.length} |`);
}

// ---------------------------------------------------------------- Part 3: bajadas in focus + distance sweep
log();
log('## Part 3: bajadas in focus');
log('### F. Bajada cells: ball HIGH off the glass, hitter at the back; W/E/C % per defender set-up (reach = mean reach factor; reply = W/E % of the defender\'s next shot)');
log('| Shot | Level | Aim | def back | def mid | def net | def split | reach back/mid/net/split | reply W/E vs net |');
log('|---|---|---|---|---|---|---|---|---|');
for (const id of ['bajada_slow', 'bajada_fast'])
  for (const lv of ['4v4', '7v7', '7v4'])
    for (const aim of AIMS) {
      const cs = setups.map((ds) => cells.find((x) => x.shot === id && x.level === lv && x.hitterF === 'back' && x.height === 'high' && x.ctx === 'glass' && x.defSetup === ds && x.aim === aim.id));
      if (cs.every((c) => !c)) continue;
      const net = cs[2];
      log(`| ${id} | ${lv} | ${aim.id} | ${cs.map((c) => (c ? `${pct(c.win, c.n)}/${pct(c.err, c.n)}/${pct(c.cont, c.n)}` : '-')).join(' | ')} | ${cs.map((c) => (c ? (c.reachSum / c.n).toFixed(2) : '-')).join('/')} | ${net && net.replyN ? `${pct(net.replyWin, net.replyN)}/${pct(net.replyErr, net.replyN)}` : '-'} |`);
    }

log();
log('### G. Distance sweep: the receiving defender stands d m (sideways) from the tapped spot, partner far away; hitter at the back, ball high off the glass');
const sweepShots = ['bajada_slow', 'bajada_fast', 'bounce_shot', 'volley', 'vibora', 'bandeja'];
const dists = [0, 1, 2, 3, 4];
log(`| Shot | Level | Def formation | Spot | ${dists.map((d) => `d=${d} m W/E/C`).join(' | ')} |`);
log('|---|---|---|---|' + dists.map(() => '---|').join(''));
for (const id of sweepShots) {
  const shot = SHOTS.find((s) => s.id === id)!;
  for (const [lv, teams] of levels.slice(0, 2))
    for (const form of ['back', 'net'] as Formation[])
      for (const spot of [{ x: 0, depth: 8.8, n: 'mid-deep' }, { x: 0, depth: shot.landDepth, n: 'mid-nominal' }]) {
        const cols: string[] = [];
        for (const d of dists) {
          const ctx: Ctx = id.startsWith('bajada') ? 'glass' : id === 'bounce_shot' ? 'bounce' : 'air';
          const height: Height = 'high';
          const hitterF: Formation = id === 'volley' ? 'net' : id === 'bounce_shot' || id.startsWith('bajada') ? 'back' : 'mid';
          const st0 = stateFor(teams, ballFor(height, ctx), hitterF, form, false);
          if (unavailableReason(shot, st0) !== null) { cols.push('n/a'); continue; }
          const z = landingZ(1, spot.depth);
          // receiver right of the spot by d (x clamped inside the court), partner on the other side, 4 m further away
          const recv: CourtPos = { x: Math.min(4.6, spot.x + d), z };
          const partner: CourtPos = { x: -4.6, z: restPos(1, 0, form).z };
          const positions: ReachPositions = { defenders: [partner, recv], hitter: restPos(0, 0, hitterF) };
          const rng = seededRng(9000 + d * 31 + spot.depth * 7);
          let w = 0, e = 0, c = 0;
          for (let t = 0; t < TRIALS; t++) {
            const r = stepHit(teams, st0, shot, 'middle', rng, undefined, { positions, target: { x: spot.x, depth: spot.depth } });
            if (r.step.outcome === 'winner') w++; else if (r.step.outcome === 'error') e++; else c++;
          }
          cols.push(`${pct(w, TRIALS)}/${pct(e, TRIALS)}/${pct(c, TRIALS)}`);
        }
        log(`| ${id} | ${lv} | ${form} | ${spot.n} | ${cols.join(' | ')} |`);
      }
}

log();
log('### H. Bajadas: the hitter\'s power against two defender pairs (hitter at the back, ball high off the glass; W/E/C %)');
const powers = [4, 5, 6, 7, 8, 9];
const defPairs: Array<[string, PlayerDef[]]> = [['all-5 pair', pair('d', 5)], ['Bruno+Ines (default CPU)', CPU]];
log(`| Shot | Defenders | Def set-up | Aim | ${powers.map((p) => `power ${p}`).join(' | ')} |`);
log('|---|---|---|---|' + powers.map(() => '---|').join(''));
for (const id of ['bajada_slow', 'bajada_fast']) {
  const shot = SHOTS.find((s) => s.id === id)!;
  for (const [dl, dp] of defPairs)
    for (const ds of ['net', 'back', 'split'] as DefSetup[])
      for (const aim of AIMS.filter((a) => ['middle', 'cross', 'T:mid-deep', 'T:mid-nominal'].includes(a.id))) {
        const cols = powers.map((pw) => {
          const hitter: PlayerDef = { ...mk('h0', 5), stats: { ...mk('h0', 5).stats, power: pw } };
          const teams: Teams = [[hitter, mk('h1', 5)], dp];
          const c = runCell(teams, shot, `p${pw}`, 'high', 'glass', 'back', ds, aim, 5000 + pw);
          return c ? `${pct(c.win, c.n)}/${pct(c.err, c.n)}/${pct(c.cont, c.n)}` : 'n/a';
        });
        log(`| ${id} | ${dl} | ${ds} | ${aim.id} | ${cols.join(' | ')} |`);
      }
}

log();
log('### I. Reach factor (share of his defence the defender keeps) against a bajada, by where it lands; speed-5 defenders at their formation places, hitter at the back');
const spots = [
  { n: 'middle, nominal depth', x: 0, d: -1 },
  { n: 'middle, deep (8.8 m)', x: 0, d: 8.8 },
  { n: 'at the right defender (x 2.5), nominal', x: 2.5, d: -1 },
  { n: 'at the right defender (x 2.5), deep 8.8', x: 2.5, d: 8.8 },
  { n: 'right corner deep (3.6, 8.8)', x: 3.6, d: 8.8 },
  { n: 'short, at the net player (2.5, 2.5)', x: 2.5, d: 2.5 },
];
log('| Landing spot | bajada_slow: def net | def mid | def back | bajada_fast: def net | def mid | def back |');
log('|---|---|---|---|---|---|---|');
for (const sp of spots) {
  const cols: string[] = [];
  for (const id of ['bajada_slow', 'bajada_fast']) {
    const shot = SHOTS.find((s) => s.id === id)!;
    for (const f of ['net', 'mid', 'back'] as Formation[]) {
      const d5 = pair('r', 5) as [PlayerDef, PlayerDef];
      cols.push(reachAgainst(d5, 1, f, shot, sp.x, sp.d < 0 ? shot.landDepth : sp.d, { defenders: [restPos(1, 0, f), restPos(1, 1, f)], hitter: restPos(0, 0, 'back') }).toFixed(2));
    }
  }
  log(`| ${sp.n} | ${cols.join(' | ')} |`);
}

writeFileSync(resolve(OUT, 'engine_tables.md'), out.join('\n') + '\n');
console.error(`wrote ${resolve(OUT, 'engine_matrix.csv')} and engine_tables.md`);
