import { describe, expect, it } from 'vitest';
import { STAT_KEYS } from '../game/attributes';
import { seededRng } from '../game/rng';
import { buildBracket, DIVISIONS, divisionById, HERO_ID, makePair, prizeFor, roundNamesFor } from './tournament';

describe('divisions', () => {
  it('get harder: level gates, ranking gates, fees, ratings and prizes only grow', () => {
    for (let i = 1; i < DIVISIONS.length; i++) {
      const a = DIVISIONS[i - 1];
      const b = DIVISIONS[i];
      expect(b.minLevel, b.id).toBeGreaterThan(a.minLevel);
      expect(b.rating, b.id).toBeGreaterThan(a.rating);
      expect(b.minRank, b.id).toBeGreaterThanOrEqual(a.minRank);
      if (b.id !== 'finals') expect(b.title.coins, b.id).toBeGreaterThan(a.title.coins);
    }
    expect(DIVISIONS.every((d) => d.draw === 8 || d.draw === 16)).toBe(true);
  });
});

describe('opponents', () => {
  it('are reproducible, valid, and scatter around the rating', () => {
    const a = makePair(seededRng(5), 6, 'x');
    const b = makePair(seededRng(5), 6, 'x');
    expect(a).toEqual(b);
    expect(a.players.length).toBe(2);
    for (const p of a.players) {
      for (const k of STAT_KEYS) {
        expect(p.stats[k]).toBeGreaterThanOrEqual(1);
        expect(p.stats[k]).toBeLessThanOrEqual(10);
      }
    }
    const hi = makePair(seededRng(9), 9, 'h').rating;
    const lo = makePair(seededRng(9), 3, 'l').rating;
    expect(hi).toBeGreaterThan(lo);
  });
});

describe('bracket', () => {
  it('has the right size, the hero once, and unique entries', () => {
    for (const d of DIVISIONS) {
      const b = buildBracket(d.id, 11, []);
      expect(b.entries.length).toBe(d.draw);
      expect(b.rounds[0].length).toBe(d.draw / 2);
      expect(b.rounds[0].flatMap((m) => [m.a, m.b]).filter((id) => id === HERO_ID).length).toBe(1);
      expect(new Set(b.rounds[0].flatMap((m) => [m.a, m.b])).size).toBe(d.draw);
      expect(b.status).toBe('active');
      expect(b.opponent).toBeDefined();
      expect(b.roundNames).toEqual(roundNamesFor(d.draw));
    }
  });

  it('is rebuilt identically from the seed, and the results move it along', () => {
    const start = buildBracket('regional', 42, []);
    expect(buildBracket('regional', 42, [])).toEqual(start);
    const r1 = buildBracket('regional', 42, [true]);
    expect(r1.status).toBe('active');
    expect(r1.roundsWon).toBe(1);
    expect(r1.rounds.length).toBe(2);
    expect(r1.rounds[0].every((m) => m.winner)).toBe(true);
    // the first round does not change when the hero plays on
    expect(r1.rounds[0]).toEqual(buildBracket('regional', 42, [true, true]).rounds[0]);
    // the opponent in round 2 is one of the winners of round 1
    const winners = r1.rounds[0].map((m) => m.winner);
    expect(winners).toContain(r1.opponent!.id);
  });

  it('a loss ends it, winning every round makes the hero champion', () => {
    const lost = buildBracket('club', 3, [true, false]);
    expect(lost.status).toBe('lost');
    expect(lost.roundsWon).toBe(1);
    const champ = buildBracket('club', 3, [true, true, true]);
    expect(champ.status).toBe('won');
    expect(champ.roundsWon).toBe(3);
    const big = buildBracket('major', 3, [true, true, true, true]);
    expect(big.status).toBe('won');
    expect(big.rounds.length).toBe(4);
    expect(big.rounds[3].length).toBe(1);
  });

  it('stronger pairs win the other matches more often', () => {
    let top = 0;
    let total = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const b = buildBracket('gold', seed, [true]);
      const byId = new Map(b.entries.map((e) => [e.id, e]));
      for (const m of b.rounds[0]) {
        if (m.a === HERO_ID || m.b === HERO_ID) continue;
        const stronger = byId.get(m.a)!.rating >= byId.get(m.b)!.rating ? m.a : m.b;
        total++;
        if (m.winner === stronger) top++;
      }
    }
    expect(top / total).toBeGreaterThan(0.5);
  });
});

describe('prizes', () => {
  it('grow with every round, nothing for an opening loss, the pack only for the title', () => {
    const d = divisionById('silver')!;
    expect(prizeFor(d, 0)).toEqual({ coins: 0, xp: 0, rank: 0 });
    let last = 0;
    for (let r = 1; r <= 4; r++) {
      const p = prizeFor(d, r);
      expect(p.coins).toBeGreaterThan(last);
      last = p.coins;
      expect(p.pack === undefined).toBe(r < 4);
    }
    expect(prizeFor(d, 4).coins).toBe(d.title.coins);
    expect(prizeFor(divisionById('club')!, 3).coins).toBe(divisionById('club')!.title.coins);
  });
});
