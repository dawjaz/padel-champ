import { describe, expect, it } from 'vitest';
import movesData from '../data/moves.json';
import responsesData from '../data/responses.json';
import { recoverGuts, resolveExchange, spendGuts, TIRED_FACTOR } from './engine';
import type { Appearance, MoveDef, PlayerDef, ResponseDef } from './types';

const LOOK: Appearance = {
  gender: 'male',
  skin: '#c68642',
  hairStyle: 'short',
  hairColor: '#1a1a1a',
  shirt: '#e8554e',
  bottom: '#2b2b5e',
  bottomStyle: 'shorts',
  shoes: '#f8f8f8',
  racket: '#f2a33a',
};

const MOVES = movesData as unknown as MoveDef[];
const RESPONSES = responsesData as unknown as ResponseDef[];
const move = (id: string): MoveDef => MOVES.find((m) => m.id === id)!;
const resp = (id: string): ResponseDef => RESPONSES.find((r) => r.id === id)!;

const player = (stats: Partial<PlayerDef['stats']>): PlayerDef => ({
  id: 'p',
  name: 'P',
  stats: { power: 5, technique: 5, speed: 5, defense: 5, ...stats },
  maxGuts: 10,
  appearance: LOOK,
});

const zero = () => 0;

describe('resolveExchange', () => {
  it('lets a strong smash beat a weak defender', () => {
    const r = resolveExchange(player({ power: 10 }), 10, move('smash'), player({ defense: 1 }), resp('block'), zero);
    expect(r.outcome).toBe('winner');
  });

  it('lets a strong defender intercept a weak shot', () => {
    const r = resolveExchange(player({ technique: 1 }), 10, move('lob'), player({ defense: 10 }), resp('block'), zero);
    expect(r.outcome).toBe('intercept');
  });

  it('continues the rally when both sides are even', () => {
    const r = resolveExchange(player({}), 10, move('bandeja'), player({}), resp('block'), zero);
    expect(r.outcome).toBe('continue');
  });

  it('flags and rewards a countering response', () => {
    const a = player({});
    const d = player({});
    const countered = resolveExchange(a, 10, move('smash'), d, resp('retreat'), zero);
    const plain = resolveExchange(a, 10, move('smash'), d, resp('block'), zero);
    expect(countered.countered).toBe(true);
    expect(plain.countered).toBe(false);
  });

  it('weakens the attack when the hitter is too tired to pay the cost', () => {
    const a = player({ power: 5 });
    const d = player({});
    const fresh = resolveExchange(a, 10, move('smash'), d, resp('block'), zero);
    const tired = resolveExchange(a, 0, move('smash'), d, resp('block'), zero);
    expect(tired.tired).toBe(true);
    expect(tired.attackScore).toBeCloseTo(fresh.attackScore * TIRED_FACTOR);
  });
});

describe('guts', () => {
  it('never goes below 0 or above max', () => {
    expect(spendGuts(1, 3)).toBe(0);
    expect(recoverGuts(9, 5, 10)).toBe(10);
  });
});

describe('data', () => {
  it('only references responses that exist', () => {
    const ids = new Set(RESPONSES.map((r) => r.id));
    for (const m of MOVES) for (const c of m.counteredBy) expect(ids.has(c)).toBe(true);
  });

  it('has at least one free move so a tired player can always act', () => {
    expect(MOVES.some((m) => m.cost === 0)).toBe(true);
    expect(RESPONSES.some((r) => r.cost === 0)).toBe(true);
  });
});
