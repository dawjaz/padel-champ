import { describe, expect, it } from 'vitest';
import { lookup } from './i18n';
import shots from './data/shots.json';
import cups from './data/cups.json';
import divisions from './data/divisions.json';
import daily from './data/daily.json';
import weekly from './data/weekly.json';
import campGoals from './data/campGoals.json';
import camp from './data/camp.json';
import rivals from './data/rivals.json';
import consumables from './data/consumables.json';
import packs from './data/packs.json';
import cities from './data/cities.json';
import gear from './data/gear.json';

/** Every text the data files show to the player has a Spanish version (names of people, brands and racket models stay). */
const TEXT_KEYS = new Set(['name', 'text', 'desc', 'hint', 'short', 'menuLabel', 'before', 'afterYouWin', 'afterYouLose']);

function texts(x: unknown, key = '', out: string[] = []): string[] {
  if (Array.isArray(x)) x.forEach((i) => texts(i, key, out));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) texts(v, k, out);
  else if (typeof x === 'string' && TEXT_KEYS.has(key)) out.push(x);
  return out;
}

describe('Spanish texts of the data files', () => {
  const files: Record<string, unknown> = { shots, cups, divisions, daily, weekly, campGoals, camp, rivals, consumables, packs };
  for (const [name, data] of Object.entries(files)) {
    it(`${name}: every shown text is translated`, () => {
      const gaps = texts(data).filter((t) => lookup(t) === undefined);
      expect(gaps).toEqual([]);
    });
  }
  it('cities: every city has a Spanish form or keeps its name', () => {
    const names = Object.keys(cities as Record<string, unknown>);
    expect(names.length).toBeGreaterThan(10);
  });
  it('gear: non-racket items are translated by pattern', () => {
    const items = (gear as { items?: Array<{ slot: string; name: string }> }).items ?? (gear as unknown as Array<{ slot: string; name: string }>);
    const gaps = items.filter((g) => g.slot !== 'racket').map((g) => g.name).filter((n) => lookup(n) === undefined);
    expect(gaps).toEqual([]);
  });
});
