// Daily rewards and tasks: a login reward on a 7-day streak and three tasks a day (plus a bonus for all three). Pure (no Phaser), tested.
// Only career matches count (a quick match is a sparring). The numbers and the task list live in src/data/daily.json.

import data from '../data/daily.json';
import type { Profile } from './profile';

export type DailyStat = 'played' | 'won' | 'points' | 'rally' | 'smash' | 'dejada' | 'viboraBandeja' | 'bajada' | 'ace';

export interface TaskDef {
  id: string;
  text: string;
  stat: DailyStat;
  n: number;
}

export const TASKS = data.tasks as TaskDef[];
export const LOGIN_COINS = data.loginCoins;
export const STREAK_LENGTH = LOGIN_COINS.length;

export interface Daily {
  /** Day (YYYY-MM-DD) of the last claimed login reward, or ''. */
  lastLogin: string;
  /** Days in a row with a claimed login reward (the reward cycles every 7). */
  streak: number;
  /** The day the progress below belongs to. */
  day: string;
  progress: Partial<Record<DailyStat, number>>;
  /** Ids of the tasks already paid today. */
  claimed: string[];
  bonusClaimed: boolean;
}

export const newDaily = (): Daily => ({ lastLogin: '', streak: 0, day: '', progress: {}, claimed: [], bonusClaimed: false });

/** The local date as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The day before a YYYY-MM-DD key (calendar arithmetic in UTC, so time zones and summer time do not matter). */
export function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** Moves the progress to `today` (a new day starts with empty progress). */
export function refresh(d: Daily, today: string): Daily {
  return d.day === today ? d : { ...d, day: today, progress: {}, claimed: [], bonusClaimed: false };
}

export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };
}

/** The tasks of a day: the same for everybody on the same date, no two with the same stat. */
export function tasksOf(today: string, rng: () => number = mulberry(seedOf(today))): TaskDef[] {
  const pool = [...TASKS];
  const out: TaskDef[] = [];
  while (out.length < data.tasksPerDay && pool.length > 0) {
    const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    if (out.some((o) => o.stat === t.stat)) continue;
    out.push(t);
  }
  return out;
}

export interface LoginStatus {
  claimable: boolean;
  /** The day of the 7-day cycle (1..7) that is paid by the next claim (or was paid today when not claimable). */
  day: number;
  /** The streak the claim will make (or the streak now when not claimable). */
  streak: number;
}

export function loginStatus(d: Daily, today: string): LoginStatus {
  if (d.lastLogin === today) return { claimable: false, day: ((d.streak - 1) % STREAK_LENGTH) + 1, streak: d.streak };
  const streak = d.lastLogin === previousDay(today) ? d.streak + 1 : 1;
  return { claimable: true, day: ((streak - 1) % STREAK_LENGTH) + 1, streak };
}

export interface LoginReward {
  coins: number;
  pack: boolean;
}

export const loginReward = (day: number): LoginReward => ({ coins: LOGIN_COINS[day - 1] ?? 0, pack: day === STREAK_LENGTH });

const addPack = (p: Profile, id: string): Profile => ({ ...p, inventory: { ...p.inventory, packs: { ...p.inventory.packs, [id]: (p.inventory.packs[id] ?? 0) + 1 } } });

export function claimLogin(p: Profile, d: Daily, today: string): { profile: Profile; daily: Daily; reward: LoginReward } | null {
  const s = loginStatus(d, today);
  if (!s.claimable) return null;
  const reward = loginReward(s.day);
  let profile: Profile = { ...p, coins: p.coins + reward.coins };
  if (reward.pack) profile = addPack(profile, data.loginPack);
  return { profile, daily: { ...refresh(d, today), lastLogin: today, streak: s.streak }, reward };
}

/** What a career match did, for the tasks. */
export interface DailyFacts {
  won: boolean;
  points: number;
  longestRally: number;
  /** Points the hero's side won with a smash, a Dejada, a Vibora or Bandeja, a Bajada, or by an ace. */
  smash: number;
  dejada: number;
  viboraBandeja: number;
  bajada: number;
  ace: number;
}

/** Adds the facts of one career match to a progress record ('rally' is a best, everything else adds up). */
export function mergeFacts(progress: Partial<Record<DailyStat, number>>, f: DailyFacts): Partial<Record<DailyStat, number>> {
  const pr = { ...progress };
  const add = (k: DailyStat, n: number): void => void (pr[k] = (pr[k] ?? 0) + n);
  add('played', 1);
  add('won', f.won ? 1 : 0);
  add('points', f.points);
  pr.rally = Math.max(pr.rally ?? 0, f.longestRally);
  add('smash', f.smash);
  add('dejada', f.dejada);
  add('viboraBandeja', f.viboraBandeja);
  add('bajada', f.bajada);
  add('ace', f.ace);
  return pr;
}

export function addFacts(d: Daily, today: string, f: DailyFacts): Daily {
  const cur = refresh(d, today);
  return { ...cur, progress: mergeFacts(cur.progress, f) };
}

export interface TaskView {
  def: TaskDef;
  have: number;
  done: boolean;
  claimed: boolean;
}

export function taskViews(d: Daily, today: string): TaskView[] {
  const cur = refresh(d, today);
  return tasksOf(today).map((def) => {
    const have = Math.min(def.n, cur.progress[def.stat] ?? 0);
    return { def, have, done: have >= def.n, claimed: cur.claimed.includes(def.id) };
  });
}

export function claimTask(p: Profile, d: Daily, today: string, id: string): { profile: Profile; daily: Daily } | null {
  const v = taskViews(d, today).find((t) => t.def.id === id);
  if (!v || !v.done || v.claimed) return null;
  const cur = refresh(d, today);
  return { profile: { ...p, coins: p.coins + data.taskCoins }, daily: { ...cur, claimed: [...cur.claimed, id] } };
}

/** The bonus for all of the day's tasks is claimable once every task is paid. */
export function bonusReady(d: Daily, today: string): boolean {
  const cur = refresh(d, today);
  return !cur.bonusClaimed && taskViews(d, today).every((t) => t.claimed);
}

export function claimBonus(p: Profile, d: Daily, today: string): { profile: Profile; daily: Daily } | null {
  if (!bonusReady(d, today)) return null;
  return { profile: { ...p, coins: p.coins + data.bonusCoins }, daily: { ...refresh(d, today), bonusClaimed: true } };
}

/** True when something waits to be claimed (the badge on the title screen). */
export function hasWaiting(d: Daily, today: string): boolean {
  return loginStatus(d, today).claimable || taskViews(d, today).some((t) => t.done && !t.claimed) || bonusReady(d, today);
}

export const TASK_COINS: number = data.taskCoins;
export const BONUS_COINS: number = data.bonusCoins;

export function sanitizeDaily(raw: unknown): Daily {
  const o = (raw ?? {}) as Partial<Record<string, unknown>>;
  const day = (v: unknown): string => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const known = new Set(TASKS.map((t) => t.id));
  const stats = new Set<string>(TASKS.map((t) => t.stat));
  const progress: Partial<Record<DailyStat, number>> = {};
  const src = (o.progress ?? {}) as Partial<Record<string, unknown>>;
  for (const k of Object.keys(src)) if (stats.has(k)) progress[k as DailyStat] = Math.min(n(src[k]), 1000);
  return {
    lastLogin: day(o.lastLogin),
    streak: Math.min(n(o.streak), 10000),
    day: day(o.day),
    progress,
    claimed: Array.from(new Set(Array.isArray(o.claimed) ? o.claimed.filter((x): x is string => typeof x === 'string' && known.has(x)) : [])),
    bonusClaimed: o.bonusClaimed === true,
  };
}
