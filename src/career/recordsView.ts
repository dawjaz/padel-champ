// The personal records shown on the ranking screen. Every row has an id so that an online board can use the same ids later. Pure, tested.

import type { Records } from './achievements';

export interface RecordRow {
  id: string;
  label: string;
  value: string;
}

export interface RecordInput {
  stats: { played: number; won: number; lost: number };
  records: Records;
  titles: number;
  level: number;
  /** Ranking points and world position now. */
  rankPoints: number;
  position: number;
}

const none = (n: number, suffix = ''): string => (n > 0 ? `${n}${suffix}` : '-');

export function recordRows(i: RecordInput): RecordRow[] {
  const rate = i.stats.played > 0 ? `${Math.round((i.stats.won / i.stats.played) * 100)}%` : '-';
  return [
    { id: 'matches', label: 'MATCHES PLAYED', value: `${i.stats.played}` },
    { id: 'wins', label: 'MATCHES WON', value: `${i.stats.won}` },
    { id: 'winRate', label: 'WIN RATE', value: rate },
    { id: 'streak', label: 'WINNING STREAK NOW', value: `${i.records.streak}` },
    { id: 'bestStreak', label: 'BEST WINNING STREAK', value: none(i.records.bestStreak) },
    { id: 'shutouts', label: 'WON WITHOUT LOSING A GAME', value: `${i.records.shutouts}` },
    { id: 'rally', label: 'LONGEST RALLY', value: none(i.records.longestRally, ' HITS') },
    { id: 'aces', label: 'MOST ACES IN A MATCH', value: none(i.records.maxAces) },
    { id: 'smashes', label: 'MOST SMASH WINNERS IN A MATCH', value: none(i.records.maxSmashes) },
    { id: 'titles', label: 'TOURNAMENT TITLES', value: `${i.titles}` },
    { id: 'rank', label: 'RANKING POINTS (NOW / BEST)', value: `${i.rankPoints} / ${Math.max(i.records.bestRank, i.rankPoints)}` },
    { id: 'position', label: 'WORLD POSITION (NOW / BEST)', value: `#${i.position} / ${i.records.bestPosition > 0 ? `#${Math.min(i.records.bestPosition, i.position)}` : `#${i.position}`}` },
    { id: 'level', label: 'LEVEL', value: `${i.level}` },
  ];
}
