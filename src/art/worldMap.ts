// A simple stylised world map for the career calendar: rough land shapes and a projection of (lon, lat) into a rectangle. Pure, tested.
// City positions are in src/data/cityMap.json.

import cityMap from '../data/cityMap.json';

export type LonLat = [number, number];

/** The part of the world that shows: from Mexico to the Gulf, from Stockholm to Buenos Aires. */
export const MAP_BOUNDS = { west: -105, east: 65, north: 62, south: -40 };

export const NORTH_AMERICA: LonLat[] = [[-105, 62], [-80, 62], [-62, 52], [-68, 44], [-76, 36], [-81, 30], [-80, 25], [-90, 29], [-97, 25], [-97, 20], [-90, 21], [-87, 16], [-83, 10], [-77, 8], [-80, 7], [-86, 12], [-94, 16], [-105, 20], [-110, 24], [-105, 28], [-105, 40]];
export const SOUTH_AMERICA: LonLat[] = [[-77, 8], [-62, 11], [-52, 4], [-35, -6], [-39, -16], [-42, -23], [-48, -28], [-54, -34], [-58, -39], [-66, -42], [-70, -38], [-72, -30], [-71, -18], [-77, -12], [-81, -4], [-80, 2]];
export const EURASIA: LonLat[] = [[-9, 37], [-9, 43], [-2, 44], [-4, 48], [2, 51], [5, 54], [8, 57], [11, 56], [12, 54], [19, 55], [22, 60], [18, 60], [17, 57], [25, 62], [65, 62], [65, 25], [59, 22], [52, 16], [43, 13], [35, 28], [35, 36], [27, 37], [26, 40], [21, 39], [20, 41], [16, 41], [18, 40], [12, 38], [8, 44], [3, 43], [0, 39], [-2, 36]];
export const AFRICA: LonLat[] = [[-17, 21], [-13, 28], [-6, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [42, -2], [40, -15], [35, -25], [20, -35], [14, -24], [12, -6], [9, 4], [-8, 4], [-17, 13]];
export const LAND: LonLat[][] = [NORTH_AMERICA, SOUTH_AMERICA, EURASIA, AFRICA];

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Projects (lon, lat) into the frame (simple equirectangular, stretched to fit), clamped to its edges. */
export function projectLonLat(p: LonLat, f: Frame): { x: number; y: number } {
  const b = MAP_BOUNDS;
  const u = (p[0] - b.west) / (b.east - b.west);
  const v = (b.north - p[1]) / (b.north - b.south);
  return { x: f.x + Math.max(0, Math.min(1, u)) * f.w, y: f.y + Math.max(0, Math.min(1, v)) * f.h };
}

/** The position of a calendar city, or null for an unknown name. */
export function cityPosition(city: string, f: Frame): { x: number; y: number } | null {
  const ll = (cityMap as unknown as Record<string, LonLat>)[city];
  return ll ? projectLonLat(ll, f) : null;
}
