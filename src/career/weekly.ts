// Weekly challenges: three bigger tasks a week (Monday to Sunday) with a pack and coins for finishing all of them. Pure, tested.
// Same facts as the daily tasks (career matches only); the numbers and the task list live in src/data/weekly.json.

import data from '../data/weekly.json';
import { mergeCampTrial, mergeFacts, mulberry, seedOf, type DailyFacts, type DailyStat, type TaskDef } from './daily';
import type { Profile } from './profile';

export const WEEKLY_TASKS = data.tasks as TaskDef[];
export const WEEKLY_TASK_COINS: number = data.taskCoins;
export const WEEKLY_BONUS_COINS: number = data.bonusCoins;

export interface Weekly {
  /** The Monday (YYYY-MM-DD, local) of the week the progress belongs to, or ''. */
  week: string;
  progress: Partial<Record<DailyStat, number>>;
  claimed: string[];
  bonusClaimed: boolean;
}

export const newWeekly = (): Weekly => ({ week: '', progress: {}, claimed: [], bonusClaimed: false });

/** The Monday of the local week of `d` as YYYY-MM-DD. */
export function weekKey(d: Date): string {
  const back = (d.getDay() + 6) % 7;
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${m.getFullYear()}-${p(m.getMonth() + 1)}-${p(m.getDate())}`;
}

/** Whole days from the end of the week (Sunday evening) back to `d`: 0 on Sunday, 6 on Monday. */
export const daysLeft = (d: Date): number => (7 - ((d.getDay() + 6) % 7)) - 1;

export function refreshWeek(w: Weekly, week: string): Weekly {
  return w.week === week ? w : { week, progress: {}, claimed: [], bonusClaimed: false };
}

/** The tasks of a week: the same for everybody in the same week, no two with the same stat. */
export function weeklyTasksOf(week: string): TaskDef[] {
  const rng = mulberry(seedOf('week:' + week));
  const pool = [...WEEKLY_TASKS];
  const out: TaskDef[] = [];
  while (out.length < data.tasksPerWeek && pool.length > 0) {
    const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    if (out.some((o) => o.stat === t.stat)) continue;
    out.push(t);
  }
  return out;
}

export function addWeeklyCampTrial(w: Weekly, week: string, stars: number): Weekly {
  const cur = refreshWeek(w, week);
  return { ...cur, progress: mergeCampTrial(cur.progress, stars) };
}

export function addWeeklyFacts(w: Weekly, week: string, f: DailyFacts): Weekly {
  const cur = refreshWeek(w, week);
  return { ...cur, progress: mergeFacts(cur.progress, f) };
}

export interface WeeklyView {
  def: TaskDef;
  have: number;
  done: boolean;
  claimed: boolean;
}

export function weeklyViews(w: Weekly, week: string): WeeklyView[] {
  const cur = refreshWeek(w, week);
  return weeklyTasksOf(week).map((def) => {
    const have = Math.min(def.n, cur.progress[def.stat] ?? 0);
    return { def, have, done: have >= def.n, claimed: cur.claimed.includes(def.id) };
  });
}

export function claimWeeklyTask(p: Profile, w: Weekly, week: string, id: string): { profile: Profile; weekly: Weekly } | null {
  const v = weeklyViews(w, week).find((t) => t.def.id === id);
  if (!v || !v.done || v.claimed) return null;
  const cur = refreshWeek(w, week);
  return { profile: { ...p, coins: p.coins + data.taskCoins }, weekly: { ...cur, claimed: [...cur.claimed, id] } };
}

export function weeklyBonusReady(w: Weekly, week: string): boolean {
  const cur = refreshWeek(w, week);
  return !cur.bonusClaimed && weeklyViews(w, week).every((t) => t.claimed);
}

export function claimWeeklyBonus(p: Profile, w: Weekly, week: string): { profile: Profile; weekly: Weekly } | null {
  if (!weeklyBonusReady(w, week)) return null;
  const packs = { ...p.inventory.packs, [data.bonusPack]: (p.inventory.packs[data.bonusPack] ?? 0) + 1 };
  const profile: Profile = { ...p, coins: p.coins + data.bonusCoins, inventory: { ...p.inventory, packs } };
  return { profile, weekly: { ...refreshWeek(w, week), bonusClaimed: true } };
}

/** True when something of the week waits to be claimed. */
export const weeklyWaiting = (w: Weekly, week: string): boolean => weeklyViews(w, week).some((t) => t.done && !t.claimed) || weeklyBonusReady(w, week);

export function sanitizeWeekly(raw: unknown): Weekly {
  const o = (raw ?? {}) as Partial<Record<string, unknown>>;
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const known = new Set(WEEKLY_TASKS.map((t) => t.id));
  const stats = new Set<string>(WEEKLY_TASKS.map((t) => t.stat));
  const progress: Partial<Record<DailyStat, number>> = {};
  const src = (o.progress ?? {}) as Partial<Record<string, unknown>>;
  for (const k of Object.keys(src)) if (stats.has(k)) progress[k as DailyStat] = Math.min(n(src[k]), 10000);
  return {
    week: typeof o.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.week) ? o.week : '',
    progress,
    claimed: Array.from(new Set(Array.isArray(o.claimed) ? o.claimed.filter((x): x is string => typeof x === 'string' && known.has(x)) : [])),
    bonusClaimed: o.bonusClaimed === true,
  };
}
