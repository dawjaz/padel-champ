import { describe, expect, it } from 'vitest';
import { MAX_TOUCH_AGE, touchTime } from './touchTime';

describe('touchTime', () => {
  it('uses the moment the finger landed (the event stamp), not when the handler ran', () => {
    // handler runs 120 ms after the touch; the scene clock is at the start of the current frame
    expect(touchTime(1990, 2010, 1890)).toBe(1890);
  });
  it('falls back to the scene clock for a stamp that is not on the performance clock or is stale', () => {
    expect(touchTime(1990, 2010, undefined)).toBe(1990);
    expect(touchTime(1990, 2010, 1.7e12)).toBe(1990); // epoch milliseconds (old browsers)
    expect(touchTime(1990, 2010, 2010 - MAX_TOUCH_AGE - 1)).toBe(1990);
    expect(touchTime(1990, 2010, Number.NaN)).toBe(1990);
  });
});
