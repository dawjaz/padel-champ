import { describe, expect, it } from 'vitest';
import { EVENTS } from '../../career/season';
import { COURT_THEMES, DEFAULT_THEME_ID, themeById, themeIdOfCity } from './courtThemes';

describe('court themes', () => {
  it('every calendar city has a known theme', () => {
    for (const e of EVENTS) {
      const id = themeIdOfCity(e.city);
      expect(COURT_THEMES[id], e.city).toBeDefined();
    }
  });
  it('maps every calendar city explicitly (no silent fallback to the default)', async () => {
    const cities = (await import('../../data/cities.json')).default as Record<string, string>;
    for (const e of EVENTS) expect(cities[e.city], e.city).toBeDefined();
  });
  it('uses several different themes', () => {
    const used = new Set(EVENTS.map((e) => themeIdOfCity(e.city)));
    expect(used.size).toBeGreaterThanOrEqual(5);
  });
  it('falls back to the default for sparring and unknown cities', () => {
    expect(themeIdOfCity(undefined)).toBe(DEFAULT_THEME_ID);
    expect(themeIdOfCity('Atlantis')).toBe(DEFAULT_THEME_ID);
    expect(themeById('nope').id).toBe(DEFAULT_THEME_ID);
  });
});
