// The world ranking of the career, on this device: a field of CPU pairs whose points follow the season (deterministic, no server), with the
// hero's pair inserted by his ranking points. Pure, tested. Online rankings later use the same row shape (see RankingSource).

import calendarData from '../data/calendar.json';
import opponents from '../data/opponents.json';
import { mulberry, seedOf } from './daily';
import type { Career } from './season';

export const WORLD_PAIRS = 60;
/** What the best CPU pair earns in one season (the weaker ones earn less); half of the points carry over to the next season, like the hero's. */
export const SEASON_POINTS = 2200;

export interface RankRow {
  pos: number;
  name: string;
  points: number;
  you: boolean;
}

interface CpuPair {
  name: string;
  strength: number;
}

const surname = (i: number): string => opponents.last[i % opponents.last.length].toUpperCase();

/** The field: the same pairs every time. Strength falls from 1 (the best) to about 0.06. */
export const CPU_PAIRS: CpuPair[] = (() => {
  const rnd = mulberry(seedOf('world-ranking'));
  const used = new Set<string>();
  const out: CpuPair[] = [];
  for (let i = 0; i < WORLD_PAIRS; i++) {
    let name = '';
    for (let k = 0; k < 200 && (name === '' || used.has(name)); k++) {
      const a = Math.floor(rnd() * opponents.last.length);
      const b = Math.floor(rnd() * opponents.last.length);
      name = a === b ? '' : `${surname(a)} / ${surname(b)}`;
    }
    used.add(name);
    out.push({ name, strength: 1 - 0.94 * Math.pow(i / (WORLD_PAIRS - 1), 0.8) });
  }
  return out;
})();

/** A pair's luck in a season: 0.85 .. 1.15, so the order changes a little from season to season. */
function luck(i: number, season: number): number {
  return 0.85 + 0.3 * mulberry(seedOf(`luck:${i}:${season}`))();
}

/** The points a CPU pair ends `season` with. */
export function cpuEndPoints(i: number, season: number): number {
  let carried = 0;
  let end = 0;
  for (let s = 1; s <= season; s++) {
    end = Math.round(CPU_PAIRS[i].strength * SEASON_POINTS * luck(i, s)) + carried;
    carried = Math.floor(end * calendarData.rankCarry);
  }
  return end;
}

/** The points of a CPU pair in `week` of `season` (weeks 1 .. WEEKS; the points of a week are in once the week is over). */
export function cpuPoints(i: number, season: number, week: number): number {
  const carried = season > 1 ? Math.floor(cpuEndPoints(i, season - 1) * calendarData.rankCarry) : 0;
  const gained = Math.round(CPU_PAIRS[i].strength * SEASON_POINTS * luck(i, season));
  return carried + Math.round((gained * Math.max(0, Math.min(calendarData.weeks, week - 1))) / calendarData.weeks);
}

/** The whole ranking now, best first; the hero is `heroName` with the career's ranking points (on a tie he is placed after the CPU pairs: a new hero starts at the bottom). */
export function worldRanking(career: Pick<Career, 'season' | 'week' | 'rankPoints'>, heroName: string): RankRow[] {
  const rows = CPU_PAIRS.map((p, i) => ({ name: p.name, points: cpuPoints(i, career.season, career.week), you: false }));
  rows.push({ name: heroName, points: career.rankPoints, you: true });
  rows.sort((a, b) => b.points - a.points || (a.you === b.you ? 0 : a.you ? 1 : -1));
  return rows.map((r, i) => ({ ...r, pos: i + 1 }));
}

/** The hero's place (1 = top). */
export const positionOf = (career: Pick<Career, 'season' | 'week' | 'rankPoints'>): number => worldRanking(career, 'YOU').find((r) => r.you)!.pos;

/** The rows to show: the top `top` and, when the hero is further down, a gap and the hero with the pair above and below him. `null` = a gap. */
export function visibleRows(rows: RankRow[], top = 7): Array<RankRow | null> {
  const me = rows.findIndex((r) => r.you);
  if (me < top) return rows.slice(0, top + 1);
  const out: Array<RankRow | null> = rows.slice(0, top - 2);
  if (me - 1 > top - 2) out.push(null);
  out.push(...rows.slice(Math.max(top - 2, me - 1), Math.min(rows.length, me + 2)));
  return out;
}

/**
 * Where a ranking comes from. The local one is computed here; an online one will fetch rows from a server (same row shape) and may be unavailable.
 * `load` is async so that both fit the same screen.
 */
export interface RankingSource {
  id: 'world' | 'online';
  label: string;
  /** False while the source cannot be used (the tab is shown, locked). */
  available: boolean;
  load(career: Career, heroName: string): Promise<RankRow[]>;
}

export const WORLD_SOURCE: RankingSource = {
  id: 'world',
  label: 'WORLD',
  available: true,
  load: (career, heroName) => Promise.resolve(worldRanking(career, heroName)),
};

export const ONLINE_SOURCE: RankingSource = {
  id: 'online',
  label: 'ONLINE',
  available: false,
  load: () => Promise.reject(new Error('Online rankings are not available yet')),
};
