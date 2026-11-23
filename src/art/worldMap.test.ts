import { describe, expect, it } from 'vitest';
import { EVENTS } from '../career/season';
import { cityPosition, LAND, MAP_BOUNDS, projectLonLat } from './worldMap';

const F = { x: 10, y: 20, w: 340, h: 200 };

describe('world map', () => {
  it('every calendar city has a position inside the frame', () => {
    for (const e of EVENTS) {
      const p = cityPosition(e.city, F);
      expect(p, e.city).not.toBeNull();
      expect(p!.x).toBeGreaterThanOrEqual(F.x);
      expect(p!.x).toBeLessThanOrEqual(F.x + F.w);
      expect(p!.y).toBeGreaterThanOrEqual(F.y);
      expect(p!.y).toBeLessThanOrEqual(F.y + F.h);
    }
  });
  it('places west left of east and north above south', () => {
    expect(cityPosition('Mexico City', F)!.x).toBeLessThan(cityPosition('Doha', F)!.x);
    expect(cityPosition('Stockholm', F)!.y).toBeLessThan(cityPosition('Buenos Aires', F)!.y);
  });
  it('clamps far points to the edges and has land shapes', () => {
    expect(projectLonLat([-170, 80], F)).toEqual({ x: F.x, y: F.y });
    expect(projectLonLat([MAP_BOUNDS.east + 50, -80], F)).toEqual({ x: F.x + F.w, y: F.y + F.h });
    expect(LAND.every((poly) => poly.length >= 8)).toBe(true);
  });
  it('unknown cities have no position', () => {
    expect(cityPosition('Atlantis', F)).toBeNull();
  });
});
