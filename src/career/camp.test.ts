import { describe, expect, it } from 'vitest';
import playersData from '../data/players.json';
import { SHOTS } from '../game/catalog';
import { fixedRng, seededRng } from '../game/rng';
import type { PlayerDef } from '../game/types';
import {
  CAMP, CAMP_GAMES, campNow, canTry, finishTry, GLASS_SHOT_IDS, glassClassPoints, glassFlight, glassRebound, glassRound, zoneAt, grantExtraTry, landShot, milestonesCrossed, sanitizeCamp,
  serveLanding, serveZone, starsFor, startTry, targetZone, timingPoints, timingRound, zonePoints,
} from './camp';
import { newProfile, type Profile } from './profile';
import { MAX_BOOSTS } from './gear';
import { skipWeek, enterEvent } from './careerFlow';
import { EVENTS } from './season';

const hero = (playersData.you as unknown as PlayerDef[])[0];
const shot = (id: string) => SHOTS.find((s) => s.id === id)!;

describe('camp tries', () => {
  it('three tries a week, one more for an ad, a new week refills them', () => {
    let p: Profile = newProfile();
    for (let i = 0; i < CAMP.triesPerWeek; i++) p = startTry(p)!;
    expect(startTry(p)).toBeNull();
    p = grantExtraTry(p)!;
    expect(grantExtraTry(p)).toBeNull();
    p = startTry(p)!;
    expect(canTry(p)).toBe(false);
    p = skipWeek(p);
    expect(campNow(p).triesLeft).toBe(CAMP.triesPerWeek);
    expect(grantExtraTry(p)).not.toBeNull();
  });
  it('is closed while a tournament is in progress', () => {
    const p = enterEvent({ ...newProfile(), coins: 999 }, EVENTS.find((e) => e.division === 'club')!.id, 3)!;
    expect(canTry(p)).toBe(false);
    expect(startTry(p)).toBeNull();
  });
});

describe('camp rewards', () => {
  it('stars by score, coins by stars, the ad doubles the coins', () => {
    const g = CAMP_GAMES[0];
    expect(starsFor(g.id, g.stars[0] - 1)).toBe(0);
    expect(starsFor(g.id, g.stars[2])).toBe(3);
    const a = finishTry(newProfile(), g.id, g.stars[1], fixedRng([0.9]));
    const b = finishTry(newProfile(), g.id, g.stars[1], fixedRng([0.9]), true);
    expect(a.reward.stars).toBe(2);
    expect(b.reward.coins).toBe(a.reward.coins * 2);
    expect(a.profile.coins).toBe(newProfile().coins + a.reward.coins);
  });
  it('three stars may give a basic boost, never past a full bag', () => {
    const g = CAMP_GAMES[0];
    const r = finishTry(newProfile(), g.id, 9999, fixedRng([0, 0]));
    expect(r.reward.boost && CAMP.boostPool).toContain(r.reward.boost);
    const full = { ...newProfile(), inventory: { ...newProfile().inventory, boosts: Array(MAX_BOOSTS).fill('gel') } };
    expect(finishTry(full, g.id, 9999, fixedRng([0, 0])).reward.boost).toBeUndefined();
  });
  it('milestones give fragments once; ten fragments make a Gear Pack; only the free pool', () => {
    let p = newProfile();
    let packs = 0;
    let frags = 0;
    for (let i = 0; i < 20; i++) {
      const r = finishTry(p, 'targets', 9999, fixedRng([0.99]));
      p = r.profile;
      packs += r.reward.packs;
      frags += r.reward.fragments;
    }
    expect(p.camp.totalStars).toBe(60);
    expect(packs).toBe(Math.floor(frags / CAMP.fragmentsPerPack));
    expect(p.inventory.packs[CAMP.fragmentPack] ?? 0).toBe(packs);
    expect(Object.keys(p.inventory.packs).every((k) => k === CAMP.fragmentPack)).toBe(true);
    expect(milestonesCrossed(60, 60, p.camp.claimed)).toEqual([]);
  });
  it('sanitizes a stored camp', () => {
    const c = sanitizeCamp({ triesLeft: 99, best: { targets: 7, nope: 2 }, fragments: 55, claimed: ['0', 3] });
    expect(c.triesLeft).toBe(CAMP.triesPerWeek + CAMP.extraTriesPerWeek);
    expect(c.best).toEqual({ targets: 3 });
    expect(c.fragments).toBe(CAMP.fragmentsPerPack - 1);
    expect(c.claimed).toEqual(['0']);
  });
});

describe('camp minigames', () => {
  it('zone points: middle 100, edge 50, near 20, out 0', () => {
    const z = { x: 1, depth: 5, r: 1 };
    expect(zonePoints(z, { x: 1, depth: 5 })).toBe(100);
    expect(zonePoints(z, { x: 2, depth: 5 })).toBe(50);
    expect(zonePoints(z, { x: 2.5, depth: 5 })).toBe(20);
    expect(zonePoints(z, { x: 1, depth: 5, miss: 'glass' })).toBe(0);
  });
  it('target zones stay on the court and shrink round by round', () => {
    const rng = seededRng(4);
    for (let i = 0; i < 6; i++) {
      const z = targetZone(rng, i);
      expect(Math.abs(z.x) + z.r).toBeLessThanOrEqual(5.4);
      expect(z.depth).toBeLessThan(10);
    }
    expect(targetZone(seededRng(1), 5).r).toBeLessThan(targetZone(seededRng(1), 0).r);
  });
  it('a well aimed ball scores more than a random one', () => {
    const rng = seededRng(9);
    let aimed = 0;
    for (let i = 0; i < 200; i++) {
      const z = targetZone(rng, 2);
      aimed += zonePoints(z, landShot(hero, shot('bounce_shot'), { x: z.x, depth: z.depth }, rng));
    }
    expect(aimed / 200).toBeGreaterThan(55);
  });
  it('a serve outside the service box is a fault', () => {
    const z = serveZone(seededRng(2), 0, -1);
    expect(z.x).toBeGreaterThanOrEqual(0);
    expect(serveLanding(-1, { x: 2, depth: 8 })).toBeNull();
    expect(serveLanding(-1, { x: -1, depth: 4 })).toBeNull();
    expect(serveLanding(-1, { x: 2, depth: 4 })).not.toBeNull();
  });
  it('read the glass: about a third of each rebound class; the flight has that class; points for close guesses', () => {
    const shots = GLASS_SHOT_IDS.map(shot);
    const rng = seededRng(3);
    const n = { low: 0, mid: 0, high: 0 };
    for (let i = 0; i < 300; i++) n[glassRebound(glassRound(rng, shots))]++;
    for (const k of ['low', 'mid', 'high'] as const) expect(n[k]).toBeGreaterThan(60);
    const r = glassRound(seededRng(5), shots);
    expect(glassFlight(r).events.some((e) => e.kind === 'glass')).toBe(true);
    expect(glassClassPoints('mid', 'mid')).toBe(100);
    expect(glassClassPoints('low', 'mid')).toBe(40);
    expect(glassClassPoints('low', 'high')).toBe(0);
  });
  it('serve zones move inside the service box', () => {
    const z = serveZone(seededRng(8), 3, 1);
    expect(z.move).toBeDefined();
    for (let t = 0; t < 5; t += 0.1) {
      const at = zoneAt(z, t);
      expect(at.x).toBeLessThanOrEqual(0.2);
      expect(at.x).toBeGreaterThanOrEqual(-5.2);
      expect(at.depth).toBeLessThan(6.95 + 0.6);
    }
  });
  it('timing: a finer scale (100 perfect, 90..10 inside the window, 0 out); every ball differs', () => {
    const r = timingRound(hero, 0, seededRng(1));
    expect(timingPoints(r, r.closeMs).grade).toBe('perfect');
    expect(timingPoints(r, r.closeMs + r.window * 0.3).points).toBeGreaterThan(70);
    expect(timingPoints(r, r.closeMs + r.window * 0.9).points).toBeLessThan(30);
    expect(timingPoints(r, r.closeMs + r.window * 2).points).toBe(0);
    expect(timingPoints(r, null).grade).toBe('miss');
    const rng = seededRng(2);
    const kinds = new Set(Array.from({ length: 20 }, (_, i) => timingRound(hero, i % 8, rng).kind));
    expect(kinds.size).toBe(3);
  });
});
