import { describe, expect, it } from 'vitest';
import { CHALLENGES, CUPS, challengeProgress, cupId, goldCount, recordCup, requiredCups, sanitizeShelf, unclaimed, emptyShelf, lastTrophies } from './cups';
import { enterEvent, reportMatch } from './careerFlow';
import { newProfile } from './profile';
import { EVENTS } from './season';

describe('cups', () => {
  it('has one cup per city and division of the calendar', () => {
    expect(CUPS.length).toBe(35);
    expect(new Set(CUPS.map((c) => c.id)).size).toBe(35);
  });
  it('counts only gold for challenges', () => {
    let s = emptyShelf();
    const club = requiredCups(CHALLENGES.find((c) => c.id === 'set_club')!);
    expect(club.length).toBe(8);
    for (const c of club) s = recordCup(s, c.id, 'silver', 1);
    expect(goldCount(s)).toBe(0);
    expect(unclaimed(s, [])).toEqual([]);
    for (const c of club) s = recordCup(s, c.id, 'gold', 1);
    expect(challengeProgress(CHALLENGES.find((c) => c.id === 'set_club')!, s)).toEqual({ have: 8, need: 8 });
    expect(unclaimed(s, []).map((c) => c.id)).toContain('set_club');
    expect(unclaimed(s, ['set_club']).map((c) => c.id)).not.toContain('set_club');
  });
  it('every challenge can be completed', () => {
    for (const ch of CHALLENGES) expect(ch.golds ? ch.golds <= CUPS.length : requiredCups(ch).length).toBeTruthy();
  });
  it('sanitizes a stored shelf', () => {
    expect(sanitizeShelf({ 'Nowhere|club': { gold: 1 }, [cupId('Doha', 'club')]: { gold: 2.7, silver: -1 } })).toEqual({ [cupId('Doha', 'club')]: { gold: 2, silver: 0, season: 1 } });
  });
  it('a title gives a gold cup, a lost final a silver one, an early exit nothing', () => {
    const ev = EVENTS.find((e) => e.division === 'club')!;
    const play = (results: boolean[]) => {
      let p = enterEvent({ ...newProfile(), coins: 999 }, ev.id, 7)!;
      let fin;
      for (const r of results) {
        const out = reportMatch(p, r);
        p = out.profile;
        fin = out.finished;
      }
      return { p, fin };
    };
    const id = cupId(ev.city, ev.division);
    const win = play([true, true, true]);
    expect(win.fin?.cup).toMatchObject({ id, kind: 'gold' });
    expect(win.p.cups[id].gold).toBe(1);
    const final = play([true, true, false]);
    expect(final.fin?.cup).toMatchObject({ id, kind: 'silver' });
    expect(play([false]).fin?.cup).toBeUndefined();
    expect(play([true, false]).fin?.cup).toBeUndefined();
  });
});

describe('lastTrophies', () => {
  it('lists the cups of the last titles, newest first, at most six, skipping lost finals', () => {
    const h = [
      { event: 'Club Cup Doha', champion: true },
      { event: 'Regional Open Warsaw', champion: false },
      { event: 'Regional Open Warsaw', champion: true },
      ...Array.from({ length: 6 }, () => ({ event: 'FIP Silver Athens', champion: true })),
    ];
    const t = lastTrophies(h);
    expect(t).toHaveLength(6);
    expect(t.every((c) => c.name === 'FIP Silver Athens')).toBe(true);
    expect(lastTrophies(h.slice(0, 3)).map((c) => c.name)).toEqual(['Regional Open Warsaw', 'Club Cup Doha']);
    expect(lastTrophies([{ event: 'Nowhere Cup', champion: true }])).toEqual([]);
  });
});
