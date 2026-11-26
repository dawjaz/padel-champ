import { describe, expect, it } from 'vitest';
import { shotsOfKind } from './catalog';
import { playableShots, startPoint, stepHit, type Teams } from './point';
import { practicePoint, SITUATIONS } from './practice';
import { seededRng } from './rng';
import playersData from '../data/players.json';
import type { PlayerDef } from './types';

const you = playersData.you as unknown as PlayerDef[];
const cpu = playersData.cpu as unknown as PlayerDef[];
const teams: Teams = [[you[0], you[1]], [cpu[0], cpu[1]]];
const guts = Object.fromEntries(teams.flat().map((p) => [p.id, p.maxGuts]));

describe('practice court situations', () => {
  const rally = SITUATIONS.filter((s) => s.kind === 'rally');

  it('every rally situation offers the shots it is there to practise (by the engine rules of a match)', () => {
    for (const s of rally) {
      const st = practicePoint(startPoint(guts, 0, 0, 0), s.setup!, 0, 0, 0);
      const ids = playableShots(shotsOfKind('rally'), st).map((sh) => sh.id);
      for (const want of s.signature) expect(ids, `${s.id} offers ${want}`).toContain(want);
    }
  });

  it('a smash is only on offer from the short lob; the bajada only off the glass', () => {
    for (const s of rally) {
      const st = practicePoint(startPoint(guts, 0, 0, 0), s.setup!, 0, 0, 0);
      const ids = playableShots(shotsOfKind('rally'), st).map((sh) => sh.id);
      expect(ids.includes('smash_x3'), s.id).toBe(s.id === 'short_lob');
      expect(ids.includes('bajada_fast'), s.id).toBe(s.setup!.glass);
    }
  });

  it('a situation plays like a match: every offered shot can be hit from it', () => {
    const rng = seededRng(11);
    for (const s of rally) {
      const st = practicePoint(startPoint(guts, 0, 0, 0), s.setup!, 0, 0, 0);
      for (const sh of playableShots(shotsOfKind('rally'), st)) {
        const r = stepHit(teams, st, sh, sh.fixedDirection ?? 'cross', rng);
        expect(['continue', 'winner', 'error']).toContain(r.step.outcome);
      }
    }
  });

  it('formations are by side: the human pair keeps its own whoever holds the ball', () => {
    const s = SITUATIONS.find((x) => x.id === 'net')!.setup!;
    expect(practicePoint(startPoint(guts, 0, 0, 0), s, 0, 0, 0).formation).toEqual(['net', 'back']);
    expect(practicePoint(startPoint(guts, 0, 0, 0), s, 1, 0, 0).formation).toEqual(['net', 'back']);
    // the weak lob is never given to the opponents
    const lob = SITUATIONS.find((x) => x.id === 'short_lob')!.setup!;
    expect(practicePoint(startPoint(guts, 0, 0, 0), lob, 1, 0, 0).ball.lob).toBeUndefined();
  });
});
