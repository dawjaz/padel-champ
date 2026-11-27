import { describe, expect, it } from 'vitest';
import { DIRECTIONS, SHOTS, shotsOfKind } from './catalog';
import {
  ACE_MARGIN,
  GAME_BREAK_RECOVERY_MUL,
  DEFENSE_SCALE,
  defenseRating,
  errorChance,
  faultChance,
  MAX_ERROR,
  MIN_ERROR,
  recoverGuts,
  resolveHit,
  resolveServe,
  spendGuts,
  RISKY_PER_G,
  type HitInput,
  DUEL,
  forcedErrorChance,
  ringQuality,
  timingEffect,
} from './engine';
import { fixedRng, seededRng } from './rng';
import type { Appearance, BallState, PlayerDef, ShotDef } from './types';

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

const player = (stats: Partial<PlayerDef['stats']>): PlayerDef => ({
  id: 'p',
  name: 'P',
  stats: { power: 5, spin: 5, technique: 5, accuracy: 5, stamina: 5, speed: 5, defense: 5, ...stats },
  maxGuts: 10,
  appearance: LOOK,
});

const shot = (id: string): ShotDef => SHOTS.find((s) => s.id === id)!;
const MID: BallState = { height: 'mid', pressure: 0 };

/** rng order in resolveHit: error roll, attack spread, defence spread. */
const NO_ERROR_NO_SPREAD = [0.99, 0, 0];

function hit(over: Partial<HitInput>): HitInput {
  return {
    attacker: player({}),
    attackerGuts: 10,
    shot: shot('bandeja'),
    direction: DIRECTIONS.cross,
    incoming: MID,
    defender: player({}),
    rallyLength: 0,
    rng: fixedRng(NO_ERROR_NO_SPREAD),
    ...over,
  };
}

describe('resolveHit', () => {
  it('makes an unforced error when the error roll is low', () => {
    expect(resolveHit(hit({ rng: fixedRng([0]) })).outcome).toBe('error');
  });

  it('lets a strong rulo beat a weak defender', () => {
    const r = resolveHit(
      hit({
        attacker: player({ power: 10 }),
        shot: shot('rulo'),
        incoming: { height: 'high', pressure: 0 },
        defender: player({ defense: 1, speed: 1 }),
      }),
    );
    expect(r.outcome).toBe('winner');
  });

  it('never gives the point to the defender outright: a strong defender only keeps the rally going (no intercepts)', () => {
    for (let seed = 1; seed < 300; seed++) {
      const r = resolveHit(
        hit({
          attacker: player({ technique: 1 }),
          shot: shot('lob'),
          defender: player({ defense: 10, speed: 10 }),
          rng: seededRng(seed),
        }),
      );
      expect(['continue', 'error']).toContain(r.outcome);
    }
  });

  it('continues the rally when both sides are even', () => {
    const r = resolveHit(hit({}));
    expect(r.outcome).toBe('continue');
    expect(r.pressure).toBe(0);
  });

  it('turns a narrow attack lead into pressure on the next hit', () => {
    const r = resolveHit(hit({ shot: shot('vibora'), incoming: { height: 'high', pressure: 0 } }));
    expect(r.outcome).toBe('continue');
    expect(r.pressure).toBeGreaterThan(0);
  });

  it('rewards the right shot for the incoming height', () => {
    const onHigh = resolveHit(hit({ shot: shot('bandeja'), incoming: { height: 'high', pressure: 0 } }));
    const onLow = resolveHit(hit({ shot: shot('bandeja'), incoming: { height: 'low', pressure: 0 } }));
    expect(onHigh.fit).toBeGreaterThan(onLow.fit);
    expect(onHigh.attackScore).toBeGreaterThan(onLow.attackScore);
  });

  it('a shot the hitter cannot pay for is risky: more error chance per missing guts point, no weaker attack', () => {
    const fresh = resolveHit(hit({ shot: shot('rulo'), attackerGuts: 10 }));
    const tired = resolveHit(hit({ shot: shot('rulo'), attackerGuts: 0 }));
    expect(fresh.tired).toBe(false);
    expect(tired.tired).toBe(true);
    expect(tired.attackScore).toBeCloseTo(fresh.attackScore);
    const cost = shot('rulo').cost;
    const a = player({});
    const base = errorChance(a, shot('rulo'), DIRECTIONS.cross, 0);
    expect(errorChance(a, shot('rulo'), DIRECTIONS.cross, 0, undefined, 1)).toBeCloseTo(base + RISKY_PER_G);
    expect(errorChance(a, shot('rulo'), DIRECTIONS.cross, 0, undefined, 2)).toBeGreaterThan(errorChance(a, shot('rulo'), DIRECTIONS.cross, 0, undefined, 1));
    expect(cost).toBeGreaterThan(0);
  });

  it('weakens the attack under pressure', () => {
    const calm = resolveHit(hit({}));
    const pressed = resolveHit(hit({ incoming: { height: 'mid', pressure: 0.2 } }));
    expect(pressed.attackScore).toBeCloseTo(calm.attackScore * 0.8);
  });
});

describe('defenseRating and errorChance', () => {
  it('confuses the receiver on middle balls', () => {
    const d = player({});
    expect(defenseRating(d, DIRECTIONS.middle)).toBeLessThan(defenseRating(d, DIRECTIONS.cross));
  });

  it('uses speed as well as defense', () => {
    expect(defenseRating(player({ speed: 9 }), DIRECTIONS.cross)).toBeGreaterThan(
      defenseRating(player({ speed: 2 }), DIRECTIONS.cross),
    );
  });

  it('makes errors likelier in long rallies and for riskier directions, unlikelier with technique', () => {
    const a = player({});
    const base = errorChance(a, shot('vibora'), DIRECTIONS.cross, 0);
    expect(errorChance(a, shot('vibora'), DIRECTIONS.cross, 14)).toBeGreaterThan(base);
    expect(errorChance(a, shot('vibora'), DIRECTIONS.parallel, 0)).toBeGreaterThan(base);
    expect(errorChance(player({ technique: 10 }), shot('vibora'), DIRECTIONS.cross, 0)).toBeLessThan(base);
  });

  it('keeps probabilities in range', () => {
    const extreme = errorChance(player({ technique: 10 }), shot('lob'), DIRECTIONS.middle, 0);
    expect(extreme).toBeGreaterThanOrEqual(MIN_ERROR);
    expect(errorChance(player({ technique: 1 }), shot('rulo'), DIRECTIONS.parallel, 100)).toBeLessThanOrEqual(MAX_ERROR);
    expect(faultChance(player({}), shot('hard_glass'))).toBeGreaterThan(faultChance(player({}), shot('t_serve')));
  });
});

describe('resolveServe', () => {
  const receiver = player({});
  /** rng order in resolveServe: fault roll, attack spread, defence spread. */
  const rng = () => fixedRng(NO_ERROR_NO_SPREAD);

  it('faults when the fault roll is low', () => {
    const r = resolveServe(player({}), 10, shot('hard_glass'), receiver, DIRECTIONS.cross, fixedRng([0]));
    expect(r.outcome).toBe('fault');
  });

  it('aces a weak receiver with a big serve', () => {
    const r = resolveServe(player({ power: 10 }), 10, shot('hard_glass'), player({ defense: 1, speed: 1 }), DIRECTIONS.cross, rng());
    expect(r.outcome).toBe('ace');
    expect(r.attackScore - r.defenseScore).toBeGreaterThan(ACE_MARGIN);
  });

  it('puts pressure on the receiver when the serve is better than their defence', () => {
    const r = resolveServe(player({ power: 8 }), 10, shot('at_opponent'), receiver, DIRECTIONS.cross, rng());
    expect(r.outcome).toBe('in');
    expect(r.pressure).toBeGreaterThan(0);
  });

  it('makes a glass serve harder to take off the bounce, but halves its pressure there', () => {
    const server = player({ power: 8 });
    const bounce = resolveServe(server, 10, shot('hard_glass'), receiver, DIRECTIONS.cross, rng(), 'bounce');
    const wall = resolveServe(server, 10, shot('hard_glass'), receiver, DIRECTIONS.cross, rng(), 'wall');
    expect(bounce.defenseScore).toBeLessThan(wall.defenseScore);
    expect(bounce.attackScore).toBe(wall.attackScore);
    if (bounce.outcome === 'in' && wall.outcome === 'in') expect(bounce.pressure).toBeLessThan(wall.pressure + 1e-9);
  });

  it('ignores the receive choice for serves that stay off the walls', () => {
    const server = player({ power: 8 });
    const a = resolveServe(server, 10, shot('at_opponent'), receiver, DIRECTIONS.cross, rng(), 'bounce');
    const b = resolveServe(server, 10, shot('at_opponent'), receiver, DIRECTIONS.cross, rng(), 'wall');
    expect(a).toEqual(b);
  });

  it('puts no pressure on a safe serve that is weaker than the defence', () => {
    const r = resolveServe(player({}), 10, shot('t_serve'), receiver, DIRECTIONS.cross, rng());
    expect(r.outcome).toBe('in');
    expect(r.pressure).toBe(0);
  });
});

describe('guts', () => {
  it('never goes below 0 or above max', () => {
    expect(spendGuts(1, 3)).toBe(0);
    expect(recoverGuts(9, 5, 10)).toBe(10);
  });
});

describe('shot data', () => {
  it('has the shots the owner asked for', () => {
    expect(shotsOfKind('serve').map((s) => s.id).sort()).toEqual(['at_opponent', 'hard_glass', 'spin_glass', 't_serve']);
    expect(shotsOfKind('return').map((s) => s.id).sort()).toEqual(['chiquita', 'flat', 'lob']);
    expect(shotsOfKind('rally').map((s) => s.id).sort()).toEqual(['bajada_fast', 'bajada_slow', 'bandeja', 'bloqueo', 'bounce_shot', 'contrapared', 'dejada', 'rally_chiquita', 'rally_lob', 'rulo', 'smash_x3', 'smash_x4', 'vibora', 'volley']);
  });

  it('has unique ids, a free shot per kind and fit values for every height', () => {
    expect(new Set(SHOTS.map((s) => s.id)).size).toBe(SHOTS.length);
    for (const kind of ['serve', 'return'] as const) {
      expect(shotsOfKind(kind).some((s) => s.cost === 0)).toBe(true);
    }
    for (const s of SHOTS) {
      for (const h of ['high', 'mid', 'low'] as const) expect(s.fit[h], `${s.id}.${h}`).toBeGreaterThan(0);
    }
  });

  it('plays the rulo always cross, into the fence', () => {
    expect(shot('rulo').fixedDirection).toBe('cross');
    expect(shot('rulo').wall).toBe('fence');
    expect(SHOTS.filter((s) => s.fixedDirection).map((s) => s.id)).toEqual(['contrapared', 'rulo']);
  });

  it('gives every serve a landing spot', () => {
    for (const s of shotsOfKind('serve')) expect(s.landX, s.id).toBeGreaterThanOrEqual(0);
  });
});

describe('running down a bajada', () => {
  const runner = (speed: number, defense: number): PlayerDef => player({ speed, defense });
  const bajada = SHOTS.find((x) => x.id === 'bajada_fast')!;
  const dir = DIRECTIONS.cross;

  it('rates a fast defender at the back higher than a slow one, and than anyone at the net', () => {
    const fastBack = defenseRating(runner(9, 5), dir, 'back');
    const slowBack = defenseRating(runner(3, 5), dir, 'back');
    const fastNet = defenseRating(runner(9, 5), dir, 'net');
    expect(fastBack).toBeGreaterThan(slowBack);
    expect(fastBack).toBeGreaterThan(fastNet);
    expect(defenseRating(runner(9, 5), dir, 'mid')).toBeGreaterThan(fastNet);
  });

  it('leaves speed worth more than defence for the bajada, and the normal rating untouched', () => {
    expect(defenseRating(runner(9, 3), dir, 'mid')).toBeGreaterThan(defenseRating(runner(3, 9), dir, 'mid'));
    expect(defenseRating(runner(5, 5), dir)).toBe((5 * 7 + 5 * 3) * DEFENSE_SCALE);
    expect(bajada.reboundChase).toBe(true);
  });
});

describe('rest after a game', () => {
  it('doubles the recovery: 4 guts instead of 2 at stamina 5', () => {
    expect(GAME_BREAK_RECOVERY_MUL).toBe(2);
  });
});

describe('lob', () => {
  it('is never a winner by itself, however well it is hit and wherever it lands', () => {
    const base = { attacker: player({ technique: 10 }), defender: player({ defense: 1 }), shot: { ...shot('rally_lob'), winnerMargin: 1 } };
    for (const reach of [1, 0.75]) expect(resolveHit(hit({ ...base, reach, rng: fixedRng(NO_ERROR_NO_SPREAD) })).outcome).toBe('continue');
  });
  it('still builds pressure on the next hit', () => {
    const r = resolveHit(hit({ attacker: player({ technique: 10 }), defender: player({ defense: 1 }), shot: { ...shot('rally_lob'), winnerMargin: 1 }, rng: fixedRng(NO_ERROR_NO_SPREAD) }));
    expect(r.pressure).toBeGreaterThan(0);
  });
});

describe('timing of key shots', () => {
  it('a clean hit is safer and a little stronger, a mistimed one the opposite, none is neutral; serves get a smaller edge', () => {
    expect(timingEffect(undefined)).toEqual({ risk: 1, attack: 1 });
    expect(timingEffect(0.5).risk).toBeCloseTo(1);
    expect(timingEffect(0.5).attack).toBeCloseTo(1);
    expect(timingEffect(1).risk).toBeCloseTo(0.7);
    expect(timingEffect(1).attack).toBeCloseTo(1.06);
    expect(timingEffect(0).risk).toBeCloseTo(1.3);
    expect(timingEffect(0).attack).toBeCloseTo(0.94);
    expect(timingEffect(1, true).attack).toBeCloseTo(1.03);
  });
});

describe('ring quality', () => {
  it('is 1 near the moment, 0.3 at the edge of the window, 0 beyond or without a touch', () => {
    expect(ringQuality(0, 200)).toBe(1);
    expect(ringQuality(-80, 200)).toBe(1);
    expect(ringQuality(200, 200)).toBeCloseTo(0.3);
    expect(ringQuality(201, 200)).toBe(0);
    expect(ringQuality(null, 200)).toBe(0);
  });
});

describe('special shot timing', () => {
  it('a clean touch costs little, no ring more, a mistimed touch most', async () => {
    const { specialTimingError } = await import('./engine');
    expect(specialTimingError(1)).toBeLessThan(specialTimingError(undefined));
    expect(specialTimingError(undefined)).toBeLessThan(specialTimingError(0.5));
    expect(specialTimingError(0.5)).toBeLessThan(specialTimingError(0));
    expect(specialTimingError(0)).toBeLessThanOrEqual(0.5);
  });
});

describe('forced errors and the stat gap (v0.157)', () => {
  it('a ball under pressure adds a forced error chance, flagged as forced; no pressure, no forced errors', () => {
    expect(forcedErrorChance(player({}), 0)).toBe(0);
    expect(forcedErrorChance(player({}), 0.1)).toBeGreaterThan(0.08);
    let forced = 0;
    let plain = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const r = resolveHit(hit({ incoming: { ...MID, pressure: 0.12 }, rng: seededRng(seed) }));
      if (r.outcome === 'error' && r.forced) forced++;
      const q = resolveHit(hit({ incoming: { ...MID, pressure: 0 }, rng: seededRng(seed) }));
      if (q.outcome === 'error' && q.forced) plain++;
    }
    expect(forced).toBeGreaterThan(150);
    expect(plain).toBe(0);
  });

  it('a good defender with clean technique handles pressure better', () => {
    expect(forcedErrorChance(player({ defense: 8, technique: 8 }), 0.1)).toBeLessThan(forcedErrorChance(player({ defense: 3, technique: 3 }), 0.1));
  });

  it('attributes count less in the rally duel (DUEL.statGap < 1), but more is still better', () => {
    expect(DUEL.statGap).toBeLessThan(1);
    const score = (v: number) => resolveHit(hit({ attacker: player({ [shot('bandeja').stat]: v }) })).attackScore;
    expect(score(8)).toBeGreaterThan(score(5));
    expect(score(8) - score(5)).toBeLessThan(30 * shot('bandeja').power);
  });
});

describe('pressure of a rally shot (v0.158)', () => {
  it('a shot with pressureMult puts proportionally less pressure on the next player', () => {
    const rng = () => seededRng(7);
    const full = resolveHit(hit({ shot: shot('flat'), rng: rng() }));
    const half = resolveHit(hit({ shot: { ...shot('flat'), pressureMult: 1 }, rng: rng() }));
    expect(shot('flat').pressureMult).toBe(0.5);
    if (half.outcome === 'continue' && half.pressure > 0) expect(full.pressure).toBeCloseTo(half.pressure * 0.5);
  });
});
