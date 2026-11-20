import { describe, expect, it } from 'vitest';
import { racketKind } from './sfxKind';

describe('racketKind', () => {
  it('uses the serve recording for a serve whatever the shot', () => {
    expect(racketKind('t_serve', true, 20)).toBe('racket_serve');
  });
  it('maps smashes to strong, spin shots to spin, touch shots to soft', () => {
    expect(racketKind('smash_x3', false, 25)).toBe('racket_strong');
    expect(racketKind('vibora', false, 22)).toBe('racket_spin');
    expect(racketKind('chiquita', false, 12)).toBe('racket_soft');
  });
  it('falls back on speed for other shots', () => {
    expect(racketKind('flat', false, 28)).toBe('racket_strong');
    expect(racketKind('volley', false, 14)).toBe('racket_soft');
  });
});
