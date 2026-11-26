import { describe, expect, it } from 'vitest';
import { DROP_M, DROP_MS, HIP_M, inServeZone, KNEE_M, PEAK_M, SERVE_DUE_MS, serveBallH } from './serveDrop';

describe('serve ball (dropped, bounced, hit between knee and hip)', () => {
  it('starts in the hand, touches the floor at the end of the drop and never goes above the hip', () => {
    expect(serveBallH(0)).toBe(DROP_M);
    expect(serveBallH(DROP_MS)).toBeCloseTo(0, 5);
    let max = 0;
    for (let ms = DROP_MS; ms <= SERVE_DUE_MS * 1.6; ms += 5) max = Math.max(max, serveBallH(ms));
    expect(max).toBeLessThanOrEqual(PEAK_M + 1e-9);
    expect(PEAK_M).toBeLessThanOrEqual(HIP_M);
  });

  it('is between the knee and the hip at the moment of the hit, and still on its way up before the peak is out of the zone', () => {
    expect(inServeZone(serveBallH(SERVE_DUE_MS))).toBe(true);
    expect(serveBallH(SERVE_DUE_MS)).toBeGreaterThan(KNEE_M);
    // too early (just after the bounce) the ball is below the knee; much too late it is below it again
    expect(inServeZone(serveBallH(DROP_MS + 40))).toBe(false);
    expect(inServeZone(serveBallH(SERVE_DUE_MS + 500))).toBe(false);
  });
});
