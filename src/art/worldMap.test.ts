import { describe, expect, it } from 'vitest';
import { EVENTS } from '../career/season';
import { cityPosition, clipRing, EUROPE_VIEW, landFor, LAND_FULL, placeLabels, projectLonLat, viewFor, WORLD_VIEW, type Frame, type LabelItem } from './worldMap';

const F: Frame = { x: 10, y: 20, w: 340, h: 200 };

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
  it('clamps far points to the edges', () => {
    expect(projectLonLat([-170, 80], F)).toEqual({ x: F.x, y: F.y });
    expect(projectLonLat([WORLD_VIEW.east + 50, -80], F)).toEqual({ x: F.x + F.w, y: F.y + F.h });
  });
  it('unknown cities have no position', () => {
    expect(cityPosition('Atlantis', F)).toBeNull();
  });
  it('has real coastlines that stay inside the view after clipping', () => {
    expect(LAND_FULL.length).toBeGreaterThan(20);
    for (const view of [WORLD_VIEW, EUROPE_VIEW]) {
      const land = landFor(view);
      expect(land.length).toBeGreaterThan(3);
      for (const l of land) for (const p of l.outer) {
        expect(p[0]).toBeGreaterThanOrEqual(view.west - 1e-9);
        expect(p[0]).toBeLessThanOrEqual(view.east + 1e-9);
        expect(p[1]).toBeGreaterThanOrEqual(view.south - 1e-9);
        expect(p[1]).toBeLessThanOrEqual(view.north + 1e-9);
      }
    }
  });
  it('clips a ring to a view', () => {
    const r = clipRing([[-20, 40], [50, 40], [50, 50], [-20, 50]], EUROPE_VIEW);
    expect(Math.min(...r.map((p) => p[0]))).toBe(EUROPE_VIEW.west);
    expect(Math.max(...r.map((p) => p[0]))).toBe(EUROPE_VIEW.east);
  });
  it('zooms to Europe only when every city of the week is there', () => {
    expect(viewFor(['Paris', 'Brussels', 'Warsaw'])).toBe(EUROPE_VIEW);
    expect(viewFor(['Paris', 'Doha'])).toBe(WORLD_VIEW);
    expect(viewFor(['Sao Paulo'])).toBe(WORLD_VIEW);
    expect(viewFor([])).toBe(WORLD_VIEW);
  });
});

describe('city labels', () => {
  const cover = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean =>
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
  const items = (cities: string[], view = EUROPE_VIEW): LabelItem[] =>
    cities.map((c) => ({ ...cityPosition(c, F, view)!, r: 7, w: c.length * 7 + 4, h: 14 }));

  it('never covers a dot or another name, also for neighbouring cities', () => {
    for (const set of [['Paris', 'Brussels', 'Amsterdam'], ['Madrid', 'Barcelona', 'Valencia'], ['Milan', 'Vienna', 'Rome']]) {
      const its = items(set);
      const others = EVENTS.map((e) => e.city).filter((c) => !set.includes(c)).map((c) => ({ ...cityPosition(c, F, EUROPE_VIEW)!, r: 3 }));
      const spots = placeLabels(its, others, F);
      spots.forEach((s, i) => {
        const box = { x: s.x, y: s.y, w: its[i].w, h: its[i].h };
        for (const it of its) expect(cover(box, { x: it.x, y: it.y, w: it.r * 2, h: it.r * 2 }), set.join()).toBe(false);
        spots.forEach((t, j) => {
          if (j !== i) expect(cover(box, { x: t.x, y: t.y, w: its[j].w, h: its[j].h }), set.join()).toBe(false);
        });
      });
    }
  });
  it('keeps the names inside the frame, also at the edge of the map', () => {
    const its = items(['Mexico City', 'Sao Paulo', 'Dubai'], WORLD_VIEW);
    for (const s of placeLabels(its, [], F)) {
      expect(s.x).toBeGreaterThanOrEqual(F.x);
      expect(s.x).toBeLessThanOrEqual(F.x + F.w);
      expect(s.y).toBeGreaterThanOrEqual(F.y);
      expect(s.y).toBeLessThanOrEqual(F.y + F.h);
    }
  });
});
