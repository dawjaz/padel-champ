import { describe, expect, it } from 'vitest';
import { defaultSave, getSave, parseSave, recordResult, resetSave, updateSave, type KeyValueStore } from './save';

function fakeStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe('save v1 -> v2', () => {
  it('an old save keeps its stats and settings and gets a fresh profile', () => {
    const s = parseSave(JSON.stringify({ version: 1, settings: { sound: false }, stats: { played: 7, won: 4, lost: 3 } }));
    expect(s.version).toBe(2);
    expect(s.stats).toEqual({ played: 7, won: 4, lost: 3 });
    expect(s.profile).toEqual(defaultSave().profile);
  });

  it('the profile survives a round trip through the store', () => {
    const store = fakeStore();
    resetSave(store);
    updateSave((d) => ({ ...d, profile: { ...d.profile, xp: 2000, coins: 90, alloc: { ...d.profile.alloc, power: 2 } } }), store);
    const back = parseSave(store.data['padel-champ-26:save']);
    expect(back.profile.xp).toBe(2000);
    expect(back.profile.coins).toBe(90);
    expect(back.profile.alloc.power).toBe(2);
  });
});

describe('parseSave', () => {
  it('returns defaults for empty or broken input', () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave('not json')).toEqual(defaultSave());
    expect(parseSave('null')).toEqual(defaultSave());
  });

  it('keeps valid values and repairs invalid ones', () => {
    const s = parseSave(JSON.stringify({ settings: { sound: false }, stats: { played: 5, won: -3, lost: 'x' } }));
    expect(s.settings.sound).toBe(false);
    expect(s.stats).toEqual({ played: 5, won: 0, lost: 0 });
  });
});

describe('recordResult', () => {
  it('counts wins and losses', () => {
    let s = defaultSave();
    s = recordResult(s, true);
    s = recordResult(s, false);
    s = recordResult(s, true);
    expect(s.stats).toEqual({ played: 3, won: 2, lost: 1 });
  });
});

describe('storage', () => {
  it('persists updates and can be reset', () => {
    const store = fakeStore();
    resetSave(store);
    updateSave((d) => recordResult(d, true), store);
    expect(JSON.parse(store.data['padel-champ-26:save']).stats.won).toBe(1);
    expect(getSave(store).stats.played).toBe(1);

    resetSave(store);
    expect(Object.keys(store.data)).toHaveLength(0);
    expect(getSave(store).stats.played).toBe(0);
  });

  it('works without any storage', () => {
    resetSave(null);
    const s = updateSave((d) => recordResult(d, false), null);
    expect(s.stats.lost).toBe(1);
  });
});
