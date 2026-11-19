import { describe, expect, it } from 'vitest';
import { hex, shade } from './palette';

describe('palette', () => {
  it('parses hex colours with or without #', () => {
    expect(hex('#ff8000')).toBe(0xff8000);
    expect(hex('00ff00')).toBe(0x00ff00);
  });

  it('rejects malformed colours', () => {
    expect(() => hex('#fff')).toThrow();
    expect(() => hex('red')).toThrow();
  });

  it('darkens and lightens, clamping to valid range', () => {
    expect(shade(0x808080, 0.5)).toBe(0x404040);
    expect(shade(0xffffff, 1.5)).toBe(0xffffff);
    expect(shade(0x102030, 0)).toBe(0x000000);
  });
});
