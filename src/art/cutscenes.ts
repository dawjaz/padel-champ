// Cutscenes between events: which one plays, how often, how long. Pure (no Phaser), so it is tested.

export type CutOccasion =
  | 'tourStart'
  | 'preMatch'
  | 'gameWon'
  | 'gameLost'
  | 'matchWon'
  | 'matchLost'
  | 'champion'
  | 'runnerUp'
  | 'earlyExit';

/** Settings > CUTSCENES: full, short (every scene in its short cut), off. */
export type CutMode = 'full' | 'short' | 'off';

/** What has been seen: per occasion, how many times and the last variant (so the same one does not come twice in a row). */
export type CutHistory = Partial<Record<CutOccasion, { n: number; last: string | null }>>;

/** The variants of each occasion (two each to start with; the pool can grow). The scene draws each by its id. */
export const CUT_VARIANTS: Record<CutOccasion, string[]> = {
  tourStart: ['city', 'broadcast'],
  preMatch: ['versus', 'walkon'],
  gameWon: ['fist', 'highfive'],
  gameLost: ['headshake', 'encourage'],
  matchWon: ['jump', 'handshake'],
  matchLost: ['walkoff', 'handshake'],
  champion: ['lift', 'photo'],
  runnerUp: ['applause', 'determined'],
  earlyExit: ['walkoff', 'rain'],
};

export const CUT_OCCASIONS = Object.keys(CUT_VARIANTS) as CutOccasion[];

/** Full and short length of a cutscene (ms); a touch skips it at any time. */
export const CUT_FULL_MS = 2600;
export const CUT_SHORT_MS = 1500;
/** After this many viewings of an occasion its scenes play in their short cut. */
export const CUT_SHORTEN_AFTER = 3;

/**
 * How often an occasion plays: the ones that come every game (a game won or lost) always the first two times, then about one game in
 * three; the one before every match the first three times, then every other match; the rest (a tournament starting or ending, a match
 * ending) every time.
 */
function playChance(occ: CutOccasion, n: number): number {
  if (occ === 'gameWon' || occ === 'gameLost') return n < 2 ? 1 : 1 / 3;
  if (occ === 'preMatch') return n < 3 ? 1 : 0.5;
  return 1;
}

export interface CutDecision {
  play: boolean;
  variant: string;
  short: boolean;
  /** The history with this decision in it (save it when the scene plays). */
  history: CutHistory;
}

/** Whether a cutscene plays for `occ` now, which variant (never the last one again) and in which cut. */
export function cutDecision(occ: CutOccasion, history: CutHistory, mode: CutMode, rng: () => number): CutDecision {
  const seen = history[occ] ?? { n: 0, last: null };
  const pool = CUT_VARIANTS[occ];
  const fresh = pool.length > 1 ? pool.filter((v) => v !== seen.last) : pool;
  const variant = fresh[Math.min(fresh.length - 1, Math.floor(rng() * fresh.length))];
  if (mode === 'off' || rng() >= playChance(occ, seen.n)) return { play: false, variant, short: false, history };
  return {
    play: true,
    variant,
    short: mode === 'short' || seen.n >= CUT_SHORTEN_AFTER,
    history: { ...history, [occ]: { n: seen.n + 1, last: variant } },
  };
}

/** A saved history, cleaned: only known occasions and variants, counts as whole numbers. */
export function sanitizeCutHistory(raw: unknown): CutHistory {
  const out: CutHistory = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const occ of CUT_OCCASIONS) {
    const e = (raw as Record<string, unknown>)[occ] as { n?: unknown; last?: unknown } | undefined;
    if (!e || typeof e !== 'object') continue;
    const n = typeof e.n === 'number' && Number.isFinite(e.n) && e.n > 0 ? Math.floor(e.n) : 0;
    const last = typeof e.last === 'string' && CUT_VARIANTS[occ].includes(e.last) ? e.last : null;
    out[occ] = { n, last };
  }
  return out;
}

/** Which tournament-end occasion a finished tournament gets: the title, a lost final, or out before the final. */
export function tournamentEnd(champion: boolean, lostFinal: boolean): CutOccasion {
  return champion ? 'champion' : lostFinal ? 'runnerUp' : 'earlyExit';
}
