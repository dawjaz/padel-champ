import { describe, expect, it } from 'vitest';
import playersData from '../data/players.json';
import { pickHit, SPECIAL_USE } from './ai';
import { baseId, SHOTS, shotsOfKind, SPECIALS } from './catalog';
import { cpuSpecial, playableShots, SPECIAL_ANSWER_COST, SPECIAL_MIN_RATING, withSpecial, specialAnswerChance, specialsFor, startPoint, stepHit, type PointState, type Teams } from './point';
import { practicePoint, situation, type SituationId } from './practice';
import { seededRng } from './rng';
import type { PlayerDef } from './types';

const you = playersData.you as unknown as PlayerDef[];
const cpu = playersData.cpu as unknown as PlayerDef[];
const full = (teams: Teams): Record<string, number> => Object.fromEntries(teams.flat().map((p) => [p.id, p.maxGuts]));
const at = (teams: Teams, sit: SituationId, guts?: Record<string, number>): PointState =>
  practicePoint(startPoint(guts ?? full(teams), 0, 0, 0), situation(sit).setup!, 0, 0, 0);
const shot = (id: string) => SHOTS.find((s) => s.id === id)!;

describe('special shots', () => {
  it('there are four, each a version of an ordinary shot, unlocked by level, never offered as rally shots', () => {
    expect(SPECIALS.map((s) => s.id)).toEqual(['sp_skyrocket', 'sp_venom', 'sp_cornerlock', 'sp_freeze']);
    for (const s of SPECIALS) {
      expect(SHOTS.find((b) => b.id === s.base), s.id).toBeDefined();
      expect(s.unlockLevel).toBeGreaterThan(0);
      expect(s.kind).toBe('special');
    }
    expect(baseId(shot('sp_venom'))).toBe('vibora');
    expect(baseId(shot('vibora'))).toBe('vibora');
  });

  it('a special is on offer only to its owner, in a rally, from the ball its base shot needs', () => {
    const hero = { ...you[0], specials: ['sp_skyrocket'] };
    const teams: Teams = [[hero, you[1]], [cpu[0], cpu[1]]];
    expect(specialsFor(you[0], at(teams, 'short_lob'))).toEqual([]);
    expect(specialsFor(hero, at(teams, 'short_lob')).map((x) => x.id)).toEqual(['sp_skyrocket']);
    expect(specialsFor(hero, at(teams, 'mid_lob')).map((x) => x.id)).toEqual(['sp_skyrocket']); // unlike a Por Cuatro: no short lob needed
    expect(specialsFor(hero, at(teams, 'deep_lob'))).toEqual([]); // off the glass
    expect(specialsFor(hero, { ...at(teams, 'short_lob'), hits: 0 })).toEqual([]); // the return of serve
    expect(specialsFor({ ...you[0], specials: ['sp_venom'] }, at(teams, 'mid_lob')).map((x) => x.id)).toEqual(['sp_venom']);
    expect(specialsFor({ ...you[0], specials: ['sp_freeze'] }, at(teams, 'net')).map((x) => x.id)).toEqual(['sp_freeze']);
    expect(specialsFor({ ...you[0], specials: ['sp_freeze'] }, at(teams, 'mid_lob'))).toEqual([]);
  });

  it('a special wins far more often than any ordinary shot of its situation, and costs much more than its base shot', () => {
    const teams: Teams = [[you[0], you[1]], [cpu[0], cpu[1]]];
    const rng = seededRng(3);
    const rate = (id: string, sit: SituationId): number => {
      let w = 0;
      for (let i = 0; i < 2000; i++) if (stepHit(teams, at(teams, sit), shot(id), 'cross', rng).step.outcome === 'winner') w++;
      return w / 2000;
    };
    for (const [sp, sit] of [['sp_skyrocket', 'mid_lob'], ['sp_venom', 'mid_lob'], ['sp_cornerlock', 'mid_lob'], ['sp_freeze', 'net']] as const) {
      const best = Math.max(...playableShots(shotsOfKind('rally'), at(teams, sit)).map((o) => rate(o.id, sit)));
      expect(rate(sp, sit), sp).toBeGreaterThan(best + 0.3);
      expect(shot(sp).cost).toBeGreaterThanOrEqual(shot(shot(sp).base!).cost * 2.5);
    }
  });

  it('a strong defender with guts sometimes gets a special back (and pays for it); without guts never', () => {
    const wall: PlayerDef = { ...cpu[0], stats: { ...cpu[0].stats, defense: 9, speed: 9 } };
    expect(specialAnswerChance(wall, wall.maxGuts)).toBeCloseTo(0.4);
    expect(specialAnswerChance(wall, SPECIAL_ANSWER_COST - 1)).toBe(0);
    // since v0.157 a weak defender answers one now and then too (15% with full guts), never more than a strong one
    const weak = { ...cpu[0], stats: { ...cpu[0].stats, defense: 4, speed: 4 } };
    expect(specialAnswerChance(weak, weak.maxGuts)).toBeCloseTo(0.15);
    expect(specialAnswerChance(weak, weak.maxGuts)).toBeLessThan(specialAnswerChance(wall, wall.maxGuts));
    const teams: Teams = [[you[0], you[1]], [wall, { ...wall, id: 'wall2' }]];
    const rng = seededRng(9);
    let answered = 0;
    for (let i = 0; i < 2000; i++) {
      const st = at(teams, 'mid_lob');
      const r = stepHit(teams, st, shot('sp_skyrocket'), 'cross', rng);
      if (r.step.answered) {
        answered++;
        expect(r.step.outcome).toBe('continue');
        const def = teams[1][r.step.defenderIdx];
        expect(r.state.guts[def.id]).toBe(st.guts[def.id] - SPECIAL_ANSWER_COST);
      }
    }
    expect(answered).toBeGreaterThan(100);
    const tired = full(teams);
    tired[wall.id] = 1;
    tired.wall2 = 1;
    for (let i = 0; i < 300; i++) expect(stepHit(teams, at(teams, 'mid_lob', tired), shot('sp_skyrocket'), 'cross', rng).step.answered).toBeUndefined();
  });

  it('the CPU goes for its special about as often as SPECIAL_USE when it can, never without the guts', () => {
    const ace = { ...you[0], specials: ['sp_skyrocket'] };
    const teams: Teams = [[ace, you[1]], [cpu[0], cpu[1]]];
    const rng = seededRng(5);
    let used = 0;
    for (let i = 0; i < 2000; i++) if (pickHit(teams, at(teams, 'short_lob'), rng).shot.id === 'sp_skyrocket') used++;
    expect(used / 2000).toBeGreaterThan(SPECIAL_USE - 0.05);
    expect(used / 2000).toBeLessThan(SPECIAL_USE + 0.05);
    const low = full(teams);
    low[ace.id] = 5; // the cost, but no reserve
    for (let i = 0; i < 300; i++) expect(pickHit(teams, at(teams, 'short_lob', low), rng).shot.id).not.toBe('sp_skyrocket');
  });

  it('CPU players get the special of their best attacking attribute; weaker players none', () => {
    const base = cpu[0];
    const flat = (v: number) => Object.fromEntries(Object.keys(base.stats).map((k) => [k, v])) as PlayerDef['stats'];
    expect(cpuSpecial({ ...base, stats: { ...flat(5), power: 8 } })).toBe('sp_skyrocket');
    expect(cpuSpecial({ ...base, stats: { ...flat(5), spin: 8 } })).toBe('sp_venom');
    expect(cpuSpecial({ ...base, stats: { ...flat(5), technique: 8 } })).toBe('sp_cornerlock');
    expect(cpuSpecial({ ...base, stats: { ...flat(5), accuracy: 8 } })).toBe('sp_freeze');
    expect(cpuSpecial({ ...base, stats: flat(SPECIAL_MIN_RATING - 1) })).toBeUndefined();
    expect(withSpecial({ ...base, specials: ['sp_freeze'] }).specials).toEqual(['sp_freeze']);
  });

  it('Corner Lock always goes into a back corner: the left one at the left-hand player, the right one at the right-hand player', () => {
    const teams: Teams = [[you[0], you[1]], [cpu[0], cpu[1]]];
    const rng = seededRng(9);
    for (let i = 0; i < 200; i++) {
      const st = at(teams, 'mid_lob');
      for (const d of ['parallel', 'cross'] as const) {
        const step = stepHit(teams, st, shot('sp_cornerlock'), d, rng, undefined, { ignoreRequires: true }).step;
        if (step.landX === undefined) continue;
        expect(Math.abs(step.landX)).toBeCloseTo(shot('sp_cornerlock').edgeX!);
        const lane = d === 'parallel' ? st.hitterIdx : 1 - st.hitterIdx;
        expect(Math.sign(step.landX)).toBe(lane === 0 ? -1 : 1);
      }
    }
  });
});

