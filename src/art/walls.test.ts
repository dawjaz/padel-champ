import { describe, expect, it } from 'vitest';
import { BACK_WALL, isSideOpening, OPENING_HEIGHT, SIDE_OPENINGS, sideWallHeightAt, sideWallSegments } from './walls';

describe('walls', () => {
  it('has a 4 m back wall: 3 m glass and 1 m mesh', () => {
    expect(BACK_WALL.glass).toBe(3);
    expect(BACK_WALL.mesh).toBe(1);
  });

  it('covers the whole 20 m side wall without gaps', () => {
    const segs = sideWallSegments();
    expect(segs[0].z0).toBe(0);
    expect(segs[segs.length - 1].z1).toBe(20);
    for (let i = 1; i < segs.length; i++) expect(segs[i].z0).toBe(segs[i - 1].z1);
  });

  it('is symmetrical: both ends of the court have the same wall', () => {
    for (const z of [0.5, 1.5, 2.5, 3.5, 5, 8]) {
      expect(sideWallHeightAt(z)).toBe(sideWallHeightAt(20 - z));
    }
  });

  it('is tallest at the corners and 3 m in the mesh middle, never above 4 m', () => {
    expect(sideWallHeightAt(1)).toBe(4);
    expect(sideWallHeightAt(3)).toBe(3);
    expect(sideWallHeightAt(10)).toBe(3);
    for (const s of sideWallSegments()) expect(s.glass + s.mesh).toBeLessThanOrEqual(4);
  });

  it('uses glass near the corners and only mesh in the middle', () => {
    const segs = sideWallSegments();
    expect(segs[0].glass).toBeGreaterThan(0);
    expect(segs.some((s) => s.glass === 0 && s.mesh > 0)).toBe(true);
  });

  it('has two openings per side wall, symmetric about the net, in the mesh-only part, 0.72 to 1.10 m wide and 2.0 to 2.2 m high', () => {
    expect(SIDE_OPENINGS).toHaveLength(2);
    const [a, b] = SIDE_OPENINGS;
    expect(a.z0 + b.z1).toBeCloseTo(20, 6);
    expect(a.z1 + b.z0).toBeCloseTo(20, 6);
    for (const o of SIDE_OPENINGS) {
      expect(o.z1 - o.z0).toBeGreaterThanOrEqual(0.72);
      expect(o.z1 - o.z0).toBeLessThanOrEqual(1.1);
      const seg = sideWallSegments().find((x) => o.z0 >= x.z0 && o.z1 <= x.z1);
      expect(seg?.glass).toBe(0);
      expect(OPENING_HEIGHT).toBeGreaterThanOrEqual(2);
      expect(OPENING_HEIGHT).toBeLessThanOrEqual(2.2);
      expect(OPENING_HEIGHT).toBeLessThan(seg!.mesh);
    }
  });

  it('isSideOpening is open space only inside an opening and below its top', () => {
    const o = SIDE_OPENINGS[0];
    const mid = (o.z0 + o.z1) / 2;
    expect(isSideOpening(mid, 1)).toBe(true);
    expect(isSideOpening(mid, OPENING_HEIGHT + 0.1)).toBe(false);
    expect(isSideOpening(o.z0 - 0.5, 1)).toBe(false);
    expect(isSideOpening(10, 1)).toBe(false);
  });
});
