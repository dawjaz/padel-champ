import { describe, expect, it } from 'vitest';
import { emptyRecords, recordMatch } from './achievements';
import { recordRows } from './recordsView';

const input = (o: Partial<Parameters<typeof recordRows>[0]> = {}): Parameters<typeof recordRows>[0] => ({ stats: { played: 0, won: 0, lost: 0 }, records: emptyRecords(), titles: 0, level: 1, rankPoints: 0, position: 61, ...o });

describe('records view', () => {
  it('shows dashes for what has not happened and has unique ids', () => {
    const rows = recordRows(input());
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.find((r) => r.id === 'winRate')!.value).toBe('-');
    expect(rows.find((r) => r.id === 'rally')!.value).toBe('-');
  });
  it('formats the numbers', () => {
    let r = emptyRecords();
    r = recordMatch(r, { won: true, longestRally: 14, gamesLost: 0, aces: 3, smashes: 5, rankPoints: 120, position: 20 });
    r = recordMatch(r, { won: false, longestRally: 9, gamesLost: 6, aces: 1, smashes: 0, rankPoints: 120 });
    const rows = recordRows(input({ stats: { played: 4, won: 3, lost: 1 }, records: r, titles: 1, rankPoints: 100, position: 25 }));
    const v = (id: string): string => rows.find((x) => x.id === id)!.value;
    expect(v('winRate')).toBe('75%');
    expect(v('rally')).toBe('14 HITS');
    expect(v('aces')).toBe('3');
    expect(v('smashes')).toBe('5');
    expect(v('rank')).toBe('100 / 120');
    expect(v('position')).toBe('#25 / #20');
    expect(v('shutouts')).toBe('1');
  });
  it('records the best position only when a tournament ends and keeps the best', () => {
    let r = recordMatch(emptyRecords(), { won: true, longestRally: 1, gamesLost: 0, position: 30 });
    r = recordMatch(r, { won: true, longestRally: 1, gamesLost: 0 });
    expect(r.bestPosition).toBe(30);
    r = recordMatch(r, { won: true, longestRally: 1, gamesLost: 0, position: 12 });
    r = recordMatch(r, { won: true, longestRally: 1, gamesLost: 0, position: 40 });
    expect(r.bestPosition).toBe(12);
  });
});
