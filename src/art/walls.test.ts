import { describe, expect, it } from 'vitest';
import { BACK_WALL, SIDE_DOOR, sideWallHeightAt, sideWallSegments } from './walls';

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

  it('puts the entrance door in the mesh-only part of the side wall, below the top of the mesh', () => {
    const seg = sideWallSegments().find((x) => SIDE_DOOR.z0 >= x.z0 && SIDE_DOOR.z1 <= x.z1);
    expect(seg).toBeDefined();
    expect(seg!.glass).toBe(0);
    expect(SIDE_DOOR.height).toBeLessThanOrEqual(seg!.mesh);
    expect(SIDE_DOOR.z1 - SIDE_DOOR.z0).toBeCloseTo(1, 5);
  });
});
