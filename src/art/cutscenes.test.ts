import { describe, expect, it } from 'vitest';
import { seededRng } from '../game/rng';
import { CUT_OCCASIONS, CUT_SHORTEN_AFTER, CUT_VARIANTS, cutDecision, sanitizeCutHistory, tournamentEnd, type CutHistory } from './cutscenes';

describe('cutscenes', () => {
  it('every occasion has at least two variants', () => {
    for (const occ of CUT_OCCASIONS) expect(CUT_VARIANTS[occ].length, occ).toBeGreaterThanOrEqual(2);
  });

  it('never the same variant twice in a row', () => {
    const rng = seededRng(1);
    let h: CutHistory = {};
    let last: string | null = null;
    for (let i = 0; i < 50; i++) {
      const d = cutDecision('matchWon', h, 'full', rng);
      expect(d.play).toBe(true);
      expect(d.variant).not.toBe(last);
      last = d.variant;
      h = d.history;
    }
  });

  it('a game won or lost always plays the first two times, then about one in three; the big moments always', () => {
    const rng = seededRng(2);
    let h: CutHistory = {};
    const first = [cutDecision('gameWon', h, 'full', rng)];
    h = first[0].history;
    first.push(cutDecision('gameWon', h, 'full', rng));
    expect(first.every((d) => d.play)).toBe(true);
    h = first[1].history;
    let played = 0;
    for (let i = 0; i < 3000; i++) if (cutDecision('gameWon', h, 'full', rng).play) played++;
    expect(played / 3000).toBeGreaterThan(0.28);
    expect(played / 3000).toBeLessThan(0.39);
    for (const occ of ['tourStart', 'matchWon', 'matchLost', 'champion', 'runnerUp', 'earlyExit'] as const) {
      expect(cutDecision(occ, { [occ]: { n: 50, last: null } }, 'full', rng).play, occ).toBe(true);
    }
  });

  it('short after a few viewings or when set to short; nothing when off', () => {
    const rng = seededRng(3);
    expect(cutDecision('champion', {}, 'full', rng).short).toBe(false);
    expect(cutDecision('champion', { champion: { n: CUT_SHORTEN_AFTER, last: null } }, 'full', rng).short).toBe(true);
    expect(cutDecision('champion', {}, 'short', rng).short).toBe(true);
    const off = cutDecision('champion', {}, 'off', rng);
    expect(off.play).toBe(false);
    expect(off.history).toEqual({});
  });

  it('a saved history is cleaned', () => {
    expect(sanitizeCutHistory(null)).toEqual({});
    expect(sanitizeCutHistory({ champion: { n: 2.7, last: 'lift' }, bogus: { n: 1 }, gameWon: { n: -1, last: 'nope' } })).toEqual({
      champion: { n: 2, last: 'lift' },
      gameWon: { n: 0, last: null },
    });
  });

  it('the end of a tournament: title, lost final, out before', () => {
    expect(tournamentEnd(true, false)).toBe('champion');
    expect(tournamentEnd(false, true)).toBe('runnerUp');
    expect(tournamentEnd(false, false)).toBe('earlyExit');
  });
});
