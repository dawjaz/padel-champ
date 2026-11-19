import { describe, expect, it } from 'vitest';
import playersData from '../data/players.json';
import { pickHit, pickReceive, pickServe } from './ai';
import { SHOTS, shotsOfKind } from './catalog';
import { recoverGuts } from './engine';
import { nextFormation, playableShots, startPoint, stepHit, stepServe, unavailableReason, type PointState, type Teams } from './point';
import { aimDepth, aimX } from './court';
import { fixedRng, seededRng } from './rng';
import type { PlayerDef, ShotDef } from './types';

const TEAMS: Teams = [playersData.you as unknown as PlayerDef[], playersData.cpu as unknown as PlayerDef[]];
const shot = (id: string): ShotDef => SHOTS.find((s) => s.id === id)!;

function freshGuts(): Record<string, number> {
  const g: Record<string, number> = {};
  for (const p of TEAMS.flat()) g[p.id] = p.maxGuts;
  return g;
}

/** A point already in the rally, with the given hitter. */
function rallyState(over: Partial<PointState> = {}): PointState {
  return { ...startPoint(freshGuts(), 0, 0, 0), status: 'rally', holder: 0, hitterIdx: 0, hits: 0,
    ball: { height: 'high', pressure: 0 }, ...over };
}

describe('startPoint', () => {
  it('starts at the serve with the right server and a cross receiver', () => {
    const s = startPoint(freshGuts(), 0, 1, 0);
    expect(s.status).toBe('serve');
    expect(s.holder).toBe(0);
    expect(s.hitterIdx).toBe(1);
    expect(s.attempt).toBe(1);
    // The near team serves the first point from its left (-x), so the receiver is on the far right: index 1.
    expect(s.serveLane).toBe(-1);
    expect(s.receiverIdx).toBe(1);
  });

  it('copies the guts instead of sharing them', () => {
    const g = freshGuts();
    const s = startPoint(g, 0, 0, 0);
    s.guts.toro = 0;
    expect(g.toro).toBe(10);
  });
});

describe('stepServe', () => {
  it('gives a second serve after the first fault, and loses the point on a double fault', () => {
    const first = stepServe(TEAMS, startPoint(freshGuts(), 0, 0, 0), shot('hard_glass'), fixedRng([0]));
    expect(first.step.outcome).toBe('fault');
    expect(first.state.status).toBe('serve');
    expect(first.state.attempt).toBe(2);
    expect(first.step.pointWinner).toBeNull();

    const second = stepServe(TEAMS, first.state, shot('hard_glass'), fixedRng([0]));
    expect(second.step.outcome).toBe('double-fault');
    expect(second.state.status).toBe('done');
    expect(second.state.winner).toBe(1);
  });

  it('keeps the serving side for the second serve and switches it for the next point', () => {
    const first = stepServe(TEAMS, startPoint(freshGuts(), 0, 0, 0), shot('hard_glass'), fixedRng([0]));
    expect(first.state.serveLane).toBe(-1);
    expect(startPoint(freshGuts(), 0, 0, 1).serveLane).toBe(1);
  });

  it('records how the glass serve is received, and ignores the choice for serves that stay off the walls', () => {
    const ok = fixedRng([0.99, 0.5, 0.5]);
    const glass = stepServe(TEAMS, startPoint(freshGuts(), 0, 0, 0), shot('hard_glass'), ok, 'bounce');
    expect(glass.step.receive).toBe('bounce');
    const t = stepServe(TEAMS, startPoint(freshGuts(), 0, 0, 0), shot('t_serve'), fixedRng([0.99, 0.5, 0.5]), 'wall');
    expect(t.step.receive).toBe('bounce');
  });

  it('spends the guts of the serve', () => {
    const r = stepServe(TEAMS, startPoint(freshGuts(), 0, 0, 0), shot('hard_glass'), fixedRng([0.99, 0.5, 0.5]));
    expect(r.state.guts.toro).toBe(10 - shot('hard_glass').cost);
  });

  it('hands the ball to the receiver after a good serve and sends the serving team to the net', () => {
    const start = startPoint(freshGuts(), 0, 0, 0);
    const r = stepServe(TEAMS, start, shot('t_serve'), fixedRng([0.99, 0.5, 0.5]));
    expect(r.step.outcome).toBe('in');
    expect(r.state.status).toBe('rally');
    expect(r.state.holder).toBe(1);
    expect(r.state.hitterIdx).toBe(start.receiverIdx);
    expect(r.state.ball.height).toBe('low');
    expect(r.state.formation).toEqual(['net', 'back']);
  });

  it('is not allowed once the serve is over', () => {
    expect(() => stepServe(TEAMS, rallyState(), shot('t_serve'), fixedRng([0.5]))).toThrow();
  });
});

describe('stepHit', () => {
  it('sends parallel to the same lane and cross to the other', () => {
    const rng = fixedRng([0.99, 0.5, 0.5]);
    expect(stepHit(TEAMS, rallyState({ hitterIdx: 0 }), shot('vibora'), 'parallel', rng).step.defenderIdx).toBe(0);
    expect(stepHit(TEAMS, rallyState({ hitterIdx: 0 }), shot('vibora'), 'cross', rng).step.defenderIdx).toBe(1);
  });

  it('ignores the chosen direction for the rulo', () => {
    const r = stepHit(TEAMS, rallyState({ hitterIdx: 0 }), shot('rulo'), 'parallel', fixedRng([0.99, 0.5, 0.5]));
    expect(r.step.direction).toBe('cross');
    expect(r.step.defenderIdx).toBe(1);
  });

  it('calls the first hit after the serve a return, later ones rally shots', () => {
    const rng = fixedRng([0.99, 0.5, 0.5]);
    expect(stepHit(TEAMS, rallyState({ hits: 0 }), shot('lob'), 'cross', rng).step.kind).toBe('return');
    expect(stepHit(TEAMS, rallyState({ hits: 3 }), shot('vibora'), 'cross', rng).step.kind).toBe('rally');
  });

  it('gives the point to the other side after an unforced error', () => {
    const r = stepHit(TEAMS, rallyState({ holder: 0, hitterIdx: 0 }), shot('vibora'), 'cross', fixedRng([0]));
    expect(r.step.outcome).toBe('error');
    expect(r.state.status).toBe('done');
    expect(r.state.winner).toBe(1);
  });

  it('passes the ball on after a continued rally and updates the formation', () => {
    const r = stepHit(TEAMS, rallyState({ holder: 0, hitterIdx: 0 }), shot('lob'), 'cross', fixedRng([0.99, 0.5, 0.5, 0.9, 0.5, 0.5]));
    expect(r.step.outcome).toBe('continue');
    expect(r.state.status).toBe('rally');
    expect(r.state.holder).toBe(1);
    expect(r.state.hitterIdx).toBe(r.step.defenderIdx);
    expect(r.state.hits).toBe(1);
    // a weak lob (30%) only brings the opponents to the middle of their half
    expect(r.state.formation).toEqual(['mid', 'mid']);
    expect(r.state.ball.lob).toBe('weak');
    expect(r.step.landDepth).toBeGreaterThan(0);
  });

  it('plays a good lob (70%) deep and sends the opponents back', () => {
    const r = stepHit(TEAMS, rallyState({ holder: 0, hitterIdx: 0 }), shot('lob'), 'cross', fixedRng([0.99, 0.5, 0.5, 0.1, 0.5, 0.5]));
    expect(r.state.ball.lob).toBe('deep');
    expect(r.state.formation).toEqual(['net', 'back']);
    expect(r.step.landDepth).toBeGreaterThan(6);
  });

  it('does not mutate the previous state', () => {
    const before = rallyState();
    const snapshot = JSON.stringify(before);
    stepHit(TEAMS, before, shot('vibora'), 'cross', fixedRng([0.99, 0.5, 0.5]));
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('is not allowed during the serve', () => {
    expect(() => stepHit(TEAMS, startPoint(freshGuts(), 0, 0, 0), shot('vibora'), 'cross', fixedRng([0.5]))).toThrow();
  });
});

describe('nextFormation', () => {
  it('sends the opponents back after a deep lob and lets the hitter take the net', () => {
    expect(nextFormation(['back', 'back'], 0, shot('rally_lob'), 'deep')).toEqual(['net', 'back']);
    expect(nextFormation(['net', 'net'], 0, shot('lob'))).toEqual(['net', 'back']);
  });

  it('brings a weak-lobbing hitter and the opponents only to mid-court', () => {
    expect(nextFormation(['back', 'back'], 0, shot('rally_lob'), 'weak')).toEqual(['mid', 'mid']);
    expect(nextFormation(['back', 'net'], 0, shot('rally_lob'), 'weak')).toEqual(['mid', 'net']);
  });

  it('moves up to mid-court after an ordinary shot from the back, to the net from mid-court when the opponents are back', () => {
    expect(nextFormation(['back', 'back'], 0, shot('bounce_shot'))).toEqual(['mid', 'back']);
    expect(nextFormation(['mid', 'back'], 0, shot('bounce_shot'))).toEqual(['net', 'back']);
    expect(nextFormation(['mid', 'mid'], 0, shot('bounce_shot'))).toEqual(['mid', 'mid']);
    expect(nextFormation(['back', 'back'], 0, shot('volley'))).toEqual(['net', 'back']);
  });

  it('works for the far team too', () => {
    expect(nextFormation(['back', 'back'], 1, shot('rally_lob'), 'deep')).toEqual(['back', 'net']);
  });
});

describe('aim points', () => {
  it('picks one of 10 x points per direction and 20 depths', () => {
    const xs = new Set<number>();
    const ds = new Set<number>();
    for (let i = 0; i < 4000; i++) {
      const r = Math.random;
      xs.add(Math.round(aimX('cross', 1, r) * 1000));
      ds.add(Math.round(aimDepth(6, r) * 1000));
    }
    expect(xs.size).toBe(10);
    expect(ds.size).toBe(20);
  });

  it('keeps the aim points inside the court and inside the direction', () => {
    for (const d of ['parallel', 'cross', 'middle'] as const) {
      for (let i = 0; i < 200; i++) {
        const x = aimX(d, 1, Math.random);
        expect(Math.abs(x)).toBeLessThanOrEqual(4.6);
        expect(Math.sign(x) === 1 || d === 'middle').toBe(true);
      }
    }
  });

  it('puts the aim in the step of a rally shot, but not for the rulo', () => {
    const r = stepHit(TEAMS, rallyState(), shot('vibora'), 'cross', fixedRng([0.99, 0.5, 0.5, 0.5, 0.5, 0.5]));
    expect(r.step.landX).toBeDefined();
    expect(r.step.landDepth).toBeDefined();
    const rulo = stepHit(TEAMS, rallyState(), shot('rulo'), 'cross', fixedRng([0.99, 0.5, 0.5, 0.5]));
    expect(rulo.step.landX).toBe(undefined);
  });
});

describe('whole points (CPU vs CPU, seeded)', () => {
  it('always ends, with believable rally lengths and no runaway serve advantage', () => {
    const rng = seededRng(7);
    let guts = freshGuts();
    let hitsTotal = 0;
    let serverWins = 0;
    const N = 600;

    for (let n = 0; n < N; n++) {
      const servingSide = (n % 2) as 0 | 1;
      let state = startPoint(guts, servingSide, 0, Math.floor(n / 2));
      let guard = 0;
      while (state.status !== 'done') {
        expect(guard++).toBeLessThan(200);
        state =
          state.status === 'serve'
            ? stepServe(TEAMS, state, pickServe(TEAMS, state, rng), rng, pickReceive(TEAMS, state, rng)).state
            : (() => {
                const c = pickHit(TEAMS, state, rng);
                return stepHit(TEAMS, state, c.shot, c.direction, rng).state;
              })();
      }
      expect(state.winner).not.toBeNull();
      hitsTotal += state.hits;
      if (state.winner === servingSide) serverWins++;
      guts = { ...state.guts };
      for (const p of TEAMS.flat()) guts[p.id] = recoverGuts(guts[p.id], 2, p.maxGuts);
    }

    const avgHits = hitsTotal / N;
    expect(avgHits).toBeGreaterThan(2.5);
    expect(avgHits).toBeLessThan(9);
    expect(serverWins / N).toBeGreaterThan(0.4);
    expect(serverWins / N).toBeLessThan(0.7);
  });
});

describe('shot availability', () => {
  const weak = (height: 'high' | 'mid' | 'low' = 'high') => ({ height, pressure: 0, lob: 'weak' as const });

  it('offers a smash only at the net or mid-court after a weak lob', () => {
    for (const id of ['smash_x3', 'smash_x4']) {
      const s = shot(id);
      expect(unavailableReason(s, rallyState({ holder: 0, formation: ['net', 'back'], ball: weak() }))).toBeNull();
      expect(unavailableReason(s, rallyState({ holder: 0, formation: ['back', 'back'], ball: weak() }))).not.toBeNull();
      expect(unavailableReason(s, rallyState({ holder: 0, formation: ['net', 'back'], ball: { height: 'high', pressure: 0, lob: 'deep' } }))).not.toBeNull();
      expect(unavailableReason(s, rallyState({ holder: 0, formation: ['net', 'back'], ball: { ...weak(), glass: true } }))).not.toBeNull();
    }
  });

  it('offers vibora and bandeja only on a high ball that did not come off the glass', () => {
    for (const id of ['vibora', 'bandeja']) {
      const s = shot(id);
      expect(unavailableReason(s, rallyState({ ball: { height: 'high', pressure: 0 } }))).toBeNull();
      expect(unavailableReason(s, rallyState({ ball: { height: 'high', pressure: 0, glass: true } }))).not.toBeNull();
      expect(unavailableReason(s, rallyState({ ball: { height: 'mid', pressure: 0 } }))).not.toBeNull();
    }
  });

  it('offers the volley only before the back glass, and the bajada only after a mid or high rebound', () => {
    expect(unavailableReason(shot('volley'), rallyState({ ball: { height: 'mid', pressure: 0 } }))).toBeNull();
    expect(unavailableReason(shot('volley'), rallyState({ ball: { height: 'mid', pressure: 0, glass: true } }))).not.toBeNull();
    expect(unavailableReason(shot('bajada'), rallyState({ ball: { height: 'mid', pressure: 0, glass: true } }))).toBeNull();
    expect(unavailableReason(shot('bajada'), rallyState({ ball: { height: 'high', pressure: 0, glass: true } }))).toBeNull();
    expect(unavailableReason(shot('bajada'), rallyState({ ball: { height: 'low', pressure: 0, glass: true } }))).not.toBeNull();
    expect(unavailableReason(shot('bajada'), rallyState({ ball: { height: 'high', pressure: 0 } }))).not.toBeNull();
  });

  it('after a low rebound off the glass only the lob, bounce shot and chiquita remain', () => {
    const st = rallyState({ formation: ['back', 'back'], ball: { height: 'low', pressure: 0, glass: true } });
    const ids = playableShots(shotsOfKind('rally'), st).map((x) => x.id).sort();
    expect(ids).toEqual(['bounce_shot', 'rally_chiquita', 'rally_lob']);
  });

  it('throws when an unavailable shot is played', () => {
    const st = rallyState({ holder: 0, formation: ['back', 'back'] });
    expect(() => stepHit(TEAMS, st, shot('smash_x4'), 'cross', fixedRng([0.99, 0.5, 0.5]))).toThrow();
  });

  it('keeps unavailable shots out of the CPU choice', () => {
    const st = rallyState({ holder: 1, hitterIdx: 0, formation: ['back', 'back'], ball: { height: 'mid', pressure: 0 } });
    for (let i = 0; i < 300; i++) {
      const { shot: s } = pickHit(TEAMS, st, Math.random);
      expect(unavailableReason(s, st)).toBeNull();
    }
  });
});
