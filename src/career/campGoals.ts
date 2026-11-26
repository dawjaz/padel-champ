// Camp goals: two small goals a day and two a week, fed by the camp minigames (plan 4b). Pure (no Phaser), tested.
// They are separate from the daily tasks of the career matches (the camp is closed while a tournament is on, so a camp goal must never
// hold back the daily bonus). The numbers and the goal lists live in src/data/campGoals.json. Day and week keys as in daily / weekly.

import data from '../data/campGoals.json';
import type { CampGameId } from './camp';
import { mulberry, seedOf } from './daily';
import type { Profile } from './profile';

export type GoalKind = 'trials' | 'stars' | 'best' | 'perfect' | 'games';
export interface GoalDef {
  id: string;
  text: string;
  kind: GoalKind;
  n: number;
  /** Only trials of this game count. */
  game?: CampGameId;
}
export type Period = 'day' | 'week';

export const DAY_GOALS = data.dayGoals as GoalDef[];
export const WEEK_GOALS = data.weekGoals as GoalDef[];
export const GOAL_COINS: Record<Period, number> = { day: data.dayCoins, week: data.weekCoins };
const GAMES: CampGameId[] = ['targets', 'serve', 'timing', 'smash'];
const LOG_MAX = 40;

/** One finished trial. */
export interface TrialLog {
  g: CampGameId;
  s: number;
}

export interface CampGoals {
  /** The day / the Monday of the week (YYYY-MM-DD) the logs belong to, or ''. */
  day: string;
  week: string;
  dayLog: TrialLog[];
  weekLog: TrialLog[];
  /** Ids of the goals already paid in the current day / week. */
  dayClaimed: string[];
  weekClaimed: string[];
}

export const newCampGoals = (): CampGoals => ({ day: '', week: '', dayLog: [], weekLog: [], dayClaimed: [], weekClaimed: [] });

/** A new day or week starts with empty logs. */
export function refreshGoals(g: CampGoals, day: string, week: string): CampGoals {
  return {
    day,
    week,
    dayLog: g.day === day ? g.dayLog : [],
    dayClaimed: g.day === day ? g.dayClaimed : [],
    weekLog: g.week === week ? g.weekLog : [],
    weekClaimed: g.week === week ? g.weekClaimed : [],
  };
}

/** The goals of a day or a week: the same for the whole period, no two of the same kind. */
export function goalsOf(period: Period, key: string): GoalDef[] {
  const rng = mulberry(seedOf(`camp${period}:${key}`));
  const pool = [...(period === 'day' ? DAY_GOALS : WEEK_GOALS)];
  const out: GoalDef[] = [];
  const want = period === 'day' ? data.perDay : data.perWeek;
  while (out.length < want && pool.length > 0) {
    const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    if (out.some((o) => o.kind === t.kind)) continue;
    out.push(t);
  }
  return out;
}

/** How far a log is towards a goal (not above `n`). */
export function goalProgress(def: GoalDef, log: TrialLog[]): number {
  const mine = def.game ? log.filter((t) => t.g === def.game) : log;
  const have =
    def.kind === 'trials' ? mine.length
    : def.kind === 'stars' ? mine.reduce((a, t) => a + t.s, 0)
    : def.kind === 'best' ? mine.reduce((a, t) => Math.max(a, t.s), 0)
    : def.kind === 'perfect' ? mine.filter((t) => t.s >= 3).length
    : new Set(mine.map((t) => t.g)).size;
  return Math.min(def.n, have);
}

/** A finished trial counts for the day and the week. */
export function addTrial(g: CampGoals, day: string, week: string, game: CampGameId, stars: number): CampGoals {
  const cur = refreshGoals(g, day, week);
  const t: TrialLog = { g: game, s: Math.max(0, Math.min(3, Math.floor(stars))) };
  return { ...cur, dayLog: [...cur.dayLog, t].slice(-LOG_MAX), weekLog: [...cur.weekLog, t].slice(-LOG_MAX) };
}

export interface GoalView {
  def: GoalDef;
  have: number;
  done: boolean;
  claimed: boolean;
}

export function goalViews(g: CampGoals, period: Period, day: string, week: string): GoalView[] {
  const cur = refreshGoals(g, day, week);
  const log = period === 'day' ? cur.dayLog : cur.weekLog;
  const claimed = period === 'day' ? cur.dayClaimed : cur.weekClaimed;
  return goalsOf(period, period === 'day' ? day : week).map((def) => {
    const have = goalProgress(def, log);
    return { def, have, done: have >= def.n, claimed: claimed.includes(def.id) };
  });
}

/** Pays a finished goal once. Null when it is not finished, already paid, or not a goal of this period. */
export function claimGoal(p: Profile, g: CampGoals, period: Period, day: string, week: string, id: string): { profile: Profile; goals: CampGoals } | null {
  const v = goalViews(g, period, day, week).find((x) => x.def.id === id);
  if (!v || !v.done || v.claimed) return null;
  const cur = refreshGoals(g, day, week);
  const goals = period === 'day' ? { ...cur, dayClaimed: [...cur.dayClaimed, id] } : { ...cur, weekClaimed: [...cur.weekClaimed, id] };
  return { profile: { ...p, coins: p.coins + GOAL_COINS[period] }, goals };
}

/** Is there a finished goal waiting to be claimed (the dot on the camp)? */
export const goalsWaiting = (g: CampGoals, day: string, week: string): boolean =>
  (['day', 'week'] as const).some((per) => goalViews(g, per, day, week).some((v) => v.done && !v.claimed));

export function sanitizeCampGoals(raw: unknown): CampGoals {
  const o = (raw ?? {}) as Partial<Record<string, unknown>>;
  const key = (v: unknown): string => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const log = (v: unknown): TrialLog[] =>
    (Array.isArray(v) ? v : [])
      .filter((t): t is TrialLog => !!t && typeof t === 'object' && GAMES.includes((t as TrialLog).g) && typeof (t as TrialLog).s === 'number')
      .map((t) => ({ g: t.g, s: Math.max(0, Math.min(3, Math.floor(t.s))) }))
      .slice(-LOG_MAX);
  const ids = (v: unknown, defs: GoalDef[]): string[] => Array.from(new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && defs.some((d) => d.id === x)) : []));
  return { day: key(o.day), week: key(o.week), dayLog: log(o.dayLog), weekLog: log(o.weekLog), dayClaimed: ids(o.dayClaimed, DAY_GOALS), weekClaimed: ids(o.weekClaimed, WEEK_GOALS) };
}
