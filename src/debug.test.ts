import { describe, expect, it } from 'vitest';
import { PLAY_DEFAULTS, playSettings } from './debug';

describe('play settings', () => {
  it('players get the defaults (tap the spot, the ring, the shot list); debug mode reads the save', () => {
    expect(playSettings(false)).toEqual({ aim: 'point', timing: 'ring', shotMenu: 'list' });
    expect(PLAY_DEFAULTS.aim).toBe('point');
    const d = playSettings(true);
    expect(['point', 'directions']).toContain(d.aim);
  });
});
