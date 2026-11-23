// The map of the career calendar: real coastlines (Natural Earth 1:50m, simplified, src/data/land.json), a projection of
// (lon, lat) into a rectangle, two views (the world and Europe) and a placement of city names that never covers a dot. Pure, tested.
// City positions are in src/data/cityMap.json.

import cityMap from '../data/cityMap.json';
import landData from '../data/land.json';

export type LonLat = [number, number];

export interface MapView {
  west: number;
  east: number;
  north: number;
  south: number;
}

/** From Mexico to the Gulf, from Stockholm to Buenos Aires. */
export const WORLD_VIEW: MapView = { west: -105, east: 65, north: 62, south: -40 };
/** Lisbon to Athens, Stockholm to Malaga: used when every tournament of the week is in Europe, so neighbouring cities are apart. */
export const EUROPE_VIEW: MapView = { west: -12, east: 32, north: 62, south: 34 };

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Land {
  outer: LonLat[];
  holes: LonLat[][];
}

export const LAND_FULL = landData as unknown as Land[];

const inside = (p: LonLat, v: MapView): boolean => p[0] >= v.west && p[0] <= v.east && p[1] >= v.south && p[1] <= v.north;

/** The view that shows all `cities`: Europe when they are all there, else the world. */
export function viewFor(cities: string[]): MapView {
  const all = cities.map((c) => (cityMap as unknown as Record<string, LonLat>)[c]).filter((p): p is LonLat => !!p);
  return all.length > 0 && all.every((p) => inside(p, EUROPE_VIEW)) ? EUROPE_VIEW : WORLD_VIEW;
}

/** Projects (lon, lat) into the frame (equirectangular, stretched to fit the frame), clamped to its edges. */
export function projectLonLat(p: LonLat, f: Frame, v: MapView = WORLD_VIEW): Pt {
  const u = (p[0] - v.west) / (v.east - v.west);
  const w = (v.north - p[1]) / (v.north - v.south);
  return { x: f.x + Math.max(0, Math.min(1, u)) * f.w, y: f.y + Math.max(0, Math.min(1, w)) * f.h };
}

/** The position of a calendar city, or null for an unknown name. */
export function cityPosition(city: string, f: Frame, v: MapView = WORLD_VIEW): Pt | null {
  const ll = (cityMap as unknown as Record<string, LonLat>)[city];
  return ll ? projectLonLat(ll, f, v) : null;
}

/** Clips a ring to a view (Sutherland-Hodgman). */
export function clipRing(ring: LonLat[], v: MapView): LonLat[] {
  type Edge = [(p: LonLat) => boolean, (a: LonLat, b: LonLat) => LonLat];
  const edges: Edge[] = [
    [(p) => p[0] >= v.west, (a, b) => [v.west, a[1] + ((v.west - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[0] <= v.east, (a, b) => [v.east, a[1] + ((v.east - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[1] >= v.south, (a, b) => [a[0] + ((v.south - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), v.south]],
    [(p) => p[1] <= v.north, (a, b) => [a[0] + ((v.north - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), v.north]],
  ];
  let out = ring;
  for (const [ok, cut] of edges) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const cur = src[i];
      const prev = src[(i + src.length - 1) % src.length];
      if (ok(cur)) {
        if (!ok(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (ok(prev)) out.push(cut(prev, cur));
    }
    if (out.length === 0) break;
  }
  return out;
}

/** The land that is visible in a view, clipped to it. */
export function landFor(v: MapView): Land[] {
  const out: Land[] = [];
  for (const l of LAND_FULL) {
    const outer = clipRing(l.outer, v);
    if (outer.length < 3) continue;
    out.push({ outer, holes: l.holes.map((h) => clipRing(h, v)).filter((h) => h.length >= 3) });
  }
  return out;
}

export interface LabelItem {
  /** The dot: centre and radius. */
  x: number;
  y: number;
  r: number;
  /** The size of the text box. */
  w: number;
  h: number;
}

export interface LabelSpot {
  /** Centre of the text box. */
  x: number;
  y: number;
  /** A line from the dot to the label, when the label had to move away from it. */
  leader?: [number, number, number, number];
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const rectOf = (cx: number, cy: number, w: number, h: number): Rect => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
const overlap = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/**
 * Places the name of each city so that it covers no dot (the big dots of the week and the small dots of the other cities) and no other name, and stays inside
 * the frame: next to the dot (above, below, right, left), then further away with a leader line when the neighbourhood is crowded.
 */
export function placeLabels(items: LabelItem[], obstacles: Array<{ x: number; y: number; r: number }>, frame: Frame, gap = 3): LabelSpot[] {
  const dots: Rect[] = [...obstacles.map((o) => rectOf(o.x, o.y, o.r * 2, o.r * 2)), ...items.map((i) => rectOf(i.x, i.y, i.r * 2, i.r * 2))];
  const placed: Rect[] = [];
  const out: LabelSpot[] = [];
  for (const it of items) {
    let best: { score: number; x: number; y: number; far: boolean } | null = null;
    for (const extra of [0, 14, 30, 48]) {
      const dx = it.r + gap + it.w / 2 + extra;
      const dy = it.r + gap + it.h / 2 + extra;
      const cands: Array<[number, number]> = [[0, -dy], [0, dy], [dx, 0], [-dx, 0], [dx * 0.7, -dy * 0.8], [-dx * 0.7, -dy * 0.8], [dx * 0.7, dy * 0.8], [-dx * 0.7, dy * 0.8]];
      for (const [ox, oy] of cands) {
        const cx = Math.max(frame.x + it.w / 2, Math.min(frame.x + frame.w - it.w / 2, it.x + ox));
        const cy = Math.max(frame.y + it.h / 2, Math.min(frame.y + frame.h - it.h / 2, it.y + oy));
        const rect = rectOf(cx, cy, it.w, it.h);
        let score = extra * 0.5;
        for (const d of dots) score += overlap(rect, d) * 10;
        for (const q of placed) score += overlap(rect, q) * 10;
        if (!best || score < best.score) best = { score, x: cx, y: cy, far: extra > 0 };
      }
      if (best && best.score <= extra * 0.5 + 1e-9) break; // a free spot at this distance
    }
    const b = best!;
    placed.push(rectOf(b.x, b.y, it.w, it.h));
    out.push({ x: b.x, y: b.y, leader: b.far ? [it.x, it.y, b.x, b.y] : undefined });
  }
  return out;
}
