import { describe, expect, it } from 'vitest';
import { CPU_PAIRS, cpuEndPoints, cpuPoints, ONLINE_SOURCE, positionOf, SEASON_POINTS, visibleRows, WORLD_PAIRS, WORLD_SOURCE, worldRanking } from './ranking';

const career = (season: number, week: number, rankPoints: number): { season: number; week: number; rankPoints: number } => ({ season, week, rankPoints });

describe('world ranking', () => {
  it('has unique pairs, strongest first, the same every time', () => {
    expect(CPU_PAIRS).toHaveLength(WORLD_PAIRS);
    expect(new Set(CPU_PAIRS.map((p) => p.name)).size).toBe(WORLD_PAIRS);
    for (let i = 1; i < WORLD_PAIRS; i++) expect(CPU_PAIRS[i].strength).toBeLessThanOrEqual(CPU_PAIRS[i - 1].strength);
    expect(worldRanking(career(2, 5, 300), 'YOU')).toEqual(worldRanking(career(2, 5, 300), 'YOU'));
  });
  it('points grow through a season and half of them carry to the next', () => {
    expect(cpuPoints(0, 1, 1)).toBe(0);
    expect(cpuPoints(0, 1, 13)).toBeGreaterThan(0);
    expect(cpuPoints(0, 1, 24)).toBeGreaterThan(cpuPoints(0, 1, 13));
    expect(cpuPoints(0, 2, 1)).toBe(Math.floor(cpuEndPoints(0, 1) * 0.5));
    expect(cpuEndPoints(0, 3)).toBeGreaterThan(cpuEndPoints(0, 1));
    expect(cpuEndPoints(0, 6)).toBeLessThan(SEASON_POINTS * 1.15 * 2.1);
  });
  it('puts the hero in by his points, on a tie after the CPU pairs, positions run 1..n', () => {
    const rows = worldRanking(career(1, 1, 0), 'YOU');
    expect(rows).toHaveLength(WORLD_PAIRS + 1);
    expect(rows[rows.length - 1]).toMatchObject({ pos: WORLD_PAIRS + 1, you: true }); // at the start everybody has 0: the new hero is last
    const mid = worldRanking(career(1, 13, 100000), 'YOU');
    expect(mid[0].you).toBe(true);
    expect(rows.map((r) => r.pos)).toEqual(rows.map((_, i) => i + 1));
    for (let i = 1; i < mid.length; i++) expect(mid[i].points).toBeLessThanOrEqual(mid[i - 1].points);
  });
  it('the hero climbs when he earns points', () => {
    expect(positionOf(career(1, 10, 10))).toBeGreaterThan(positionOf(career(1, 10, 400)));
    expect(positionOf(career(1, 10, 100000))).toBe(1);
  });
  it('shows the top, or a gap and the hero with his neighbours', () => {
    const top = visibleRows(worldRanking(career(1, 10, 100000), 'YOU'), 7);
    expect(top).toHaveLength(8);
    expect(top.every((r) => r !== null)).toBe(true);
    const low = visibleRows(worldRanking(career(1, 20, 0), 'YOU'), 7);
    expect(low.some((r) => r === null)).toBe(true);
    expect(low.some((r) => r?.you)).toBe(true);
    expect(low.filter((r) => r !== null)[0]?.pos).toBe(1);
  });
  it('has a local source that works and an online source that is not available yet', async () => {
    expect(WORLD_SOURCE.available).toBe(true);
    expect(ONLINE_SOURCE.available).toBe(false);
    expect((await WORLD_SOURCE.load({ season: 1, week: 3, rankPoints: 0 } as never, 'YOU')).length).toBe(WORLD_PAIRS + 1);
    await expect(ONLINE_SOURCE.load({} as never, 'YOU')).rejects.toThrow();
  });
});
