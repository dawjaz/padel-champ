/**
 * Real padel court walls, in metres (pure data, shared by the drawing code and the ball paths).
 * Sources: LTA padel court guidance and Wikipedia "Padel". Side-wall layouts vary between
 * manufacturers; this is the common one.
 *
 * Back wall: 3 m glass + 1 m wire mesh on top (4 m).
 * Side walls, measured from the nearest back wall: 2 m of glass 3 m high, then 2 m of glass 2 m high
 * (stepped), with mesh above the glass up to 4 m over the first 2 m and up to 3 m over the next 2 m;
 * the central part is mesh fence about 3 m high.
 */
export interface WallBand {
  /** Heights in metres: glass from 0 to `glass`, mesh from `glass` to `glass + mesh`. */
  glass: number;
  mesh: number;
}

export interface WallSegment extends WallBand {
  /** Court z range of this piece of the side wall. */
  z0: number;
  z1: number;
}

export const BACK_WALL: WallBand = { glass: 3, mesh: 1 };

/** One half of a side wall, from the back wall (d = 0) to the net (d = 10). */
const SIDE_HALF: Array<WallBand & { d0: number; d1: number }> = [
  { d0: 0, d1: 2, glass: 3, mesh: 1 },
  { d0: 2, d1: 4, glass: 2, mesh: 1 },
  { d0: 4, d1: 10, glass: 0, mesh: 3 },
];

/** The whole side wall (z = 0..20), listed from the far end to the near end. */
export function sideWallSegments(): WallSegment[] {
  const far = SIDE_HALF.map((s) => ({ z0: s.d0, z1: s.d1, glass: s.glass, mesh: s.mesh }));
  const near = [...SIDE_HALF]
    .reverse()
    .map((s) => ({ z0: 20 - s.d1, z1: 20 - s.d0, glass: s.glass, mesh: s.mesh }));
  return [...far, ...near];
}

/** Total height of the side wall at a given z (0 outside the court). */
export function sideWallHeightAt(z: number): number {
  const seg = sideWallSegments().find((s) => z >= s.z0 && z <= s.z1);
  return seg ? seg.glass + seg.mesh : 0;
}

/**
 * The two openings in each side wall (FIP: access to the court is placed symmetrically about the centre, one or two per side; with two,
 * each is 0.72 to 1.10 m wide and 2.00 to 2.20 m high). They are real gaps: no door, a floor beam in the opening, padded posts, and
 * the mesh goes on above them. z is metres along the court (10 = net), so the net post stands between the two openings.
 * Ball and players can pass through an opening.
 */
export const OPENING_HEIGHT = 2.05;
export const SIDE_OPENINGS: ReadonlyArray<{ z0: number; z1: number }> = [
  { z0: 8.85, z1: 9.85 },
  { z0: 10.15, z1: 11.15 },
];

/** True when the point of the side wall at (z, h) is open space: inside an opening, below its top. */
export function isSideOpening(z: number, h: number): boolean {
  return h < OPENING_HEIGHT && SIDE_OPENINGS.some((o) => z > o.z0 && z < o.z1);
}

/** The openings that lie in this piece of the side wall. */
export const openingsIn = (z0: number, z1: number): Array<{ z0: number; z1: number }> => SIDE_OPENINGS.filter((o) => o.z0 >= z0 && o.z1 <= z1);
