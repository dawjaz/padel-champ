import directionsData from '../data/directions.json';
import shotsData from '../data/shots.json';
import type { Direction, DirectionDef, ShotDef, ShotKind } from './types';

export const SHOTS = shotsData as unknown as ShotDef[];
export const DIRECTION_LIST = directionsData as unknown as DirectionDef[];

export const DIRECTIONS: Record<Direction, DirectionDef> = Object.fromEntries(
  DIRECTION_LIST.map((d) => [d.id, d]),
) as Record<Direction, DirectionDef>;

export function shotsOfKind(kind: ShotKind): ShotDef[] {
  return SHOTS.filter((s) => s.kind === kind);
}

/** The special shots (one per player; the hero unlocks them by level and equips one). */
export const SPECIALS: ShotDef[] = shotsOfKind('special');

/** The ordinary shot a shot looks, sounds and counts as (a special plays as its base shot). */
export function baseId(shot: ShotDef): string {
  return shot.base ?? shot.id;
}
