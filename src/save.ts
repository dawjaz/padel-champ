/**
 * Save data (settings + career stats). No Phaser imports so it can be unit-tested.
 * Uses localStorage on the web; the Capacitor WebView supports it too. If storage is
 * unavailable (private mode, blocked), the game still runs and just does not persist.
 */

import { emptyRecords, sanitizeRecords, sanitizeUnlocked, type Records } from './career/achievements';
import { newProfile, sanitizeProfile, type Profile } from './career/profile';

export interface SaveData {
  version: 2;
  settings: { sound: boolean; tutorialSeen: boolean };
  stats: { played: number; won: number; lost: number };
  profile: Profile;
  /** Unlocked achievement ids and the records behind them (see career/achievements.ts). */
  achievements: string[];
  records: Records;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = 'padel-champ-26:save';

export function defaultSave(): SaveData {
  return { version: 2, settings: { sound: true, tutorialSeen: false }, stats: { played: 0, won: 0, lost: 0 }, profile: newProfile(), achievements: [], records: emptyRecords() };
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
      },
      stats: { played: count(p?.stats?.played), won: count(p?.stats?.won), lost: count(p?.stats?.lost) },
      profile: sanitizeProfile(p?.profile),
      achievements: sanitizeUnlocked(p?.achievements),
      records: sanitizeRecords(p?.records),
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
