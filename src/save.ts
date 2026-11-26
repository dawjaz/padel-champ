/**
 * Save data (settings + career stats). No Phaser imports so it can be unit-tested.
 * Uses localStorage on the web; the Capacitor WebView supports it too. If storage is
 * unavailable (private mode, blocked), the game still runs and just does not persist.
 */

import { emptyRecords, sanitizeRecords, sanitizeUnlocked, type Records } from './career/achievements';
import { newDaily, sanitizeDaily, type Daily } from './career/daily';
import { newWeekly, sanitizeWeekly, type Weekly } from './career/weekly';
import { newCampGoals, sanitizeCampGoals, type CampGoals } from './career/campGoals';
import { newProfile, sanitizeProfile, type Profile } from './career/profile';
import { newTips, sanitizeTips, type TipState } from './tutorial/lessons';
import { sanitizeCutHistory, type CutHistory, type CutMode } from './art/cutscenes';

export interface SaveData {
  version: 2;
  /**
   * aim: 'point' = tap the spot on the court (the default since v0.125), 'directions' = the three ways (Parallel / Middle / Cross).
   * aimPicked: the player chose it in Settings (saves from before v0.125 move to 'point' unless they did).
   */
  /** timing: 'ring' = key shots (smashes, vibora, bandeja, serves) are hit with the timing ring; 'auto' = no ring, neutral. */
  /** cutscenes: the scenes between events in full, in their short cut, or none (see art/cutscenes.ts). */
  settings: { sound: boolean; tutorialSeen: boolean; aim: 'directions' | 'point'; aimPicked?: boolean; timing: 'ring' | 'auto'; cutscenes: CutMode; /** The shot menu: columns by intent (defence / neutral / attack) or the plain list. */ shotMenu: 'columns' | 'list' };
  stats: { played: number; won: number; lost: number };
  profile: Profile;
  /** Unlocked achievement ids and the records behind them (see career/achievements.ts). */
  achievements: string[];
  records: Records;
  /** Daily login reward and tasks (see career/daily.ts). */
  daily: Daily;
  /** Weekly challenges (see career/weekly.ts). */
  weekly: Weekly;
  /** The camp goals of the day and the week (see career/campGoals.ts). */
  campGoals: CampGoals;
  /** The cutscenes seen so far (how often, the last variant of each occasion). */
  cuts: CutHistory;
  /** The tutorial tips seen so far and whether they are switched off (see tutorial/lessons.ts). */
  tips: TipState;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// The storage key keeps the old working name on purpose: renaming it would wipe every existing save.
const KEY = 'padel-champ-26:save';

export function defaultSave(): SaveData {
  return { version: 2, settings: { sound: true, tutorialSeen: false, aim: 'point', timing: 'ring', cutscenes: 'full', shotMenu: 'list' }, stats: { played: 0, won: 0, lost: 0 }, profile: newProfile(), achievements: [], records: emptyRecords(), daily: newDaily(), weekly: newWeekly(), campGoals: newCampGoals(), cuts: {}, tips: newTips() };
}

function count(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

/** Parses stored JSON defensively: anything missing or malformed falls back to defaults. */
export function parseSave(raw: string | null): SaveData {
  const base = defaultSave();
  if (!raw) return base;
  try {
    const p = JSON.parse(raw) as Partial<SaveData> | null;
    // Version 1 saves have no profile: they migrate to a fresh one.
    return {
      version: 2,
      settings: { sound: typeof p?.settings?.sound === 'boolean' ? p.settings.sound : base.settings.sound,
        tutorialSeen: p?.settings?.tutorialSeen === true,
        aim: p?.settings?.aimPicked === true && p.settings.aim === 'directions' ? 'directions' : 'point',
        ...(p?.settings?.aimPicked === true ? { aimPicked: true } : {}),
        timing: p?.settings?.timing === 'auto' ? 'auto' : 'ring',
        // the columns layout was tried in v0.145 and put back by the owner: the list is the default (an old `menu` value is ignored)
        shotMenu: p?.settings?.shotMenu === 'columns' ? 'columns' : 'list',
        cutscenes: p?.settings?.cutscenes === 'short' || p?.settings?.cutscenes === 'off' ? p.settings.cutscenes : 'full',
      },
      stats: { played: count(p?.stats?.played), won: count(p?.stats?.won), lost: count(p?.stats?.lost) },
      profile: sanitizeProfile(p?.profile),
      achievements: sanitizeUnlocked(p?.achievements),
      records: sanitizeRecords(p?.records),
      daily: sanitizeDaily(p?.daily),
      weekly: sanitizeWeekly(p?.weekly),
      campGoals: sanitizeCampGoals(p?.campGoals),
      cuts: sanitizeCutHistory(p?.cuts),
      tips: sanitizeTips(p?.tips, p?.settings?.tutorialSeen === true),
    };
  } catch {
    return base;
  }
}

export function recordResult(data: SaveData, won: boolean): SaveData {
  return {
    ...data,
    stats: {
      played: data.stats.played + 1,
      won: data.stats.won + (won ? 1 : 0),
      lost: data.stats.lost + (won ? 0 : 1),
    },
  };
}

function defaultStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let cache: SaveData | null = null;

export function getSave(store: KeyValueStore | null = defaultStore()): SaveData {
  if (!cache) cache = parseSave(store?.getItem(KEY) ?? null);
  return cache;
}

export function updateSave(fn: (data: SaveData) => SaveData, store: KeyValueStore | null = defaultStore()): SaveData {
  cache = fn(getSave(store));
  try {
    store?.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked: keep playing with the in-memory copy.
  }
  return cache;
}

export function resetSave(store: KeyValueStore | null = defaultStore()): SaveData {
  cache = defaultSave();
  try {
    store?.removeItem(KEY);
  } catch {
    // ignore
  }
  return cache;
}
