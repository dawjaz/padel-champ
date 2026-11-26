import { describe, expect, it } from 'vitest';
import { FIRST_RUN, LESSONS, lessonById, markTip, newTips, sanitizeTips, setTipsOff, tipDue } from './lessons';

describe('lessons', () => {
  it('have unique ids, at least one page each and short texts that fit a card', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      expect(l.pages.length, l.id).toBeGreaterThan(0);
      for (const p of l.pages) {
        expect(p.text.split('\n').length, `${l.id}: ${p.head}`).toBeLessThanOrEqual(5);
        for (const line of p.text.split('\n')) expect(line.length, `${l.id}: ${line}`).toBeLessThanOrEqual(46);
      }
    }
    for (const id of FIRST_RUN) expect(lessonById(id)).toBeDefined();
  });
});

describe('tip state', () => {
  it('shows a tip once, never when switched off, never for an unknown lesson', () => {
    let t = newTips();
    expect(tipDue(t, 'ring')).toBe(true);
    t = markTip(t, 'ring');
    expect(tipDue(t, 'ring')).toBe(false);
    expect(markTip(t, 'ring')).toBe(t);
    expect(tipDue(newTips(), 'nope')).toBe(false);
    expect(tipDue(setTipsOff(newTips(), true), 'ring')).toBe(false);
  });

  it('survives junk and counts the basics as seen for a player of the old tutorial', () => {
    expect(sanitizeTips(null)).toEqual({ seen: [], off: false });
    expect(sanitizeTips({ seen: ['ring', 'ring', 5, 'gone'], off: true })).toEqual({ seen: ['ring'], off: true });
    expect(sanitizeTips(undefined, true).seen).toEqual(FIRST_RUN);
  });
});
