import { describe, expect, it } from 'vitest';
import { SHOTS } from './catalog';
import { paceFactor } from './pace';
import type { BallState, ShotDef } from './types';

const shot = (id: string): ShotDef => SHOTS.find((s) => s.id === id)!;
const ball = (over: Partial<BallState> = {}): BallState => ({ height: 'mid', pressure: 0, ...over });

describe('paceFactor', () => {
  it('plays a low ball slower, a high or mid ball harder when the hitter is well set', () => {
    for (const id of ['vibora', 'bounce_shot', 'volley', 'bajada_fast']) {
      expect(paceFactor(shot(id), ball({ height: 'low', speed: 25 })), id).toBeLessThan(1);
      expect(paceFactor(shot(id), ball({ height: 'mid', speed: 25 })), id).toBeGreaterThan(1);
      expect(paceFactor(shot(id), ball({ height: 'high', speed: 25 })), id).toBeGreaterThan(paceFactor(shot(id), ball({ height: 'mid', speed: 25 })));
    }
  });

  it('a hitter who is under pressure gets no bonus on a mid or high ball', () => {
    const rushed = ball({ height: 'high', pressure: 0.25, speed: 25 });
    expect(paceFactor(shot('vibora'), rushed)).toBeCloseTo(1);
    expect(paceFactor(shot('vibora'), ball({ height: 'high', pressure: 0.1, speed: 25 }))).toBeGreaterThan(1);
  });

  it('a volley on a slow ball gets much more pace; on a fast ball it is unchanged', () => {
    const slow = paceFactor(shot('volley'), ball({ height: 'mid', speed: 9 }));
    const fast = paceFactor(shot('volley'), ball({ height: 'mid', speed: 26 }));
    const base = paceFactor(shot('vibora'), ball({ height: 'mid', speed: 9 })); // same height bonus, no slow-ball bonus
    expect(slow).toBeGreaterThan(fast * 1.25);
    expect(fast).toBeCloseTo(paceFactor(shot('vibora'), ball({ height: 'mid', speed: 26 })));
    expect(base).toBeCloseTo(fast);
  });

  it('serves, lobs, chiquitas and the rulo keep their own speed', () => {
    for (const id of ['hard_glass', 'lob', 'rally_lob', 'chiquita', 'rally_chiquita', 'rulo']) {
      expect(paceFactor(shot(id), ball({ height: 'high', speed: 9 })), id).toBe(1);
    }
  });
});
