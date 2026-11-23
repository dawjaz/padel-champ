// Rivals: a short line from the opponent before a match of the career and after it. Pure, tested.
// The lines live in src/data/rivals.json. The same rival says the same line in the same situation (picked from his name).

import data from '../data/rivals.json';
import { seedOf } from './daily';

export type RivalMoment = 'before' | 'afterYouWin' | 'afterYouLose';

/** A line of `name`: `salt` (e.g. the round) changes it between matches against the same rival. */
export function rivalLine(moment: RivalMoment, name: string, salt = ''): string {
  const lines = data[moment];
  return lines[seedOf(`${moment}:${name}:${salt}`) % lines.length];
}

export const RIVAL_LINES: Record<RivalMoment, string[]> = data;
