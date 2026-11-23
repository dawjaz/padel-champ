// Names and nicknames of the players. Pure, tested.

import type { PlayerDef } from './types';

export const MAX_NAME = 10;
export const MAX_NICK = 14;

/** Letters, digits, space, apostrophe and hyphen only: what the on-screen keyboard can type and the font can draw. */
const ALLOWED = /[^A-Za-z0-9 '-]/g;

const titleCase = (s: string): string => s.toLowerCase().replace(/(^|[ '-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());

/** A typed name or nickname made safe: odd characters dropped, spaces collapsed, Title Case, cut to `max`. Falls back to `fallback` when nothing is left. */
export function cleanName(raw: unknown, max: number, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const s = titleCase(raw.replace(ALLOWED, '').replace(/\s+/g, ' ').trim()).slice(0, max).trim();
  return s === '' ? fallback : s;
}

/** `Adam "Anvil"`: the name with the nickname after it (just the name when there is none). */
export function withNick(p: Pick<PlayerDef, 'name' | 'nick'>): string {
  return p.nick ? `${p.name} "${p.nick}"` : p.name;
}
