import { describe, expect, it } from 'vitest';
import playersData from '../data/players.json';
import { pickStarReceiver, pickHit, pickReceive, pickServe } from './ai';
import { netVolley } from './point';
import { SHOTS, shotsOfKind } from './catalog';
import { recoverGuts } from './engine';
import { isPowerfulSmash, nextFormation, POWERFUL_SMASH, shotLabel, pickErrorKind, playableShots, zoneOf, startPoint, stepHit, stepServe, unavailableReason, type PointState, type Teams } from './point';
import { aimDepth, aimX } from './court';
import { fixedRng, seededRng } from './rng';
import type { Formation, PlayerDef, ShotDef } from './types';

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
    ball: { height: 'high', pressure: 0, air: true, zone: 'mid' }, ...over };
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

  it('Star Point: the receiving pair choice decides the receiver and the serving lane', () => {
    for (const choice of [0, 1]) {
      const s = startPoint(freshGuts(), 0, 0, 6, choice);
      expect(s.receiverIdx).toBe(choice);
      expect(s.serveLane).toBe(choice === 0 ? 1 : -1); // cross: the server stands in the opposite lane
    }
    // without a choice nothing changes
    expect(startPoint(freshGuts(), 0, 0, 6).serveLane).toBe(-1);
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
    const r = stepHit(TEAMS, rallyState({ holder: 0, hitterIdx: 0 }), shot('lob'), 'cross', fixedRng([0.5, 0.99, 0.5, 0.5, 0.9, 0.5, 0.5]));
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
    const r = stepHit(TEAMS, rallyState({ holder: 0, hitterIdx: 0 }), shot('lob'), 'cross', fixedRng([0.5, 0.99, 0.5, 0.5, 0.1, 0.5, 0.5]));
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

describe('rulo', () => {
  it('is played only from the air, on a ball that falls in the middle of the court', () => {
    const r = shot('rulo');
    expect(unavailableReason(r, rallyState({ ball: { height: 'high', pressure: 0, air: true, zone: 'mid' } }))).toBeNull();
    expect(unavailableReason(r, rallyState({ ball: { height: 'high', pressure: 0, air: true, zone: 'net' } }))).not.toBeNull();
    expect(unavailableReason(r, rallyState({ ball: { height: 'high', pressure: 0, air: true, zone: 'back' } }))).not.toBeNull();
    expect(unavailableReason(r, rallyState({ ball: { height: 'high', pressure: 0, air: true, zone: 'mid', glass: true } }))).not.toBeNull();
  });

  it('sets the zone of the next ball from where the shot lands', () => {
    expect(zoneOf(1.6)).toBe('net');
    expect(zoneOf(5)).toBe('mid');
    expect(zoneOf(8.5)).toBe('back');
  });
});

describe('blocks at the net', () => {
  const net: [Formation, Formation] = ['back', 'net'];
  it('has a defender at the net block a flat shot or a vibora out of the air', () => {
    for (const id of ['vibora', 'bounce_shot', 'bandeja']) {
      const st = rallyState({ formation: net, ball: { height: id === 'bounce_shot' ? 'low' : 'high', pressure: 0, ...(id === 'bounce_shot' ? {} : { air: true }) } });
      let seen = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const r = stepHit(TEAMS, st, shot(id), 'cross', seededRng(seed));
        if (r.step.outcome !== 'continue') continue;
        seen++;
        expect(r.step.block, id).toBe(true);
        expect(r.state.ball.glass).toBe(false);
        expect(r.state.ball.height).toBe('mid');
      }
      expect(seen, id).toBeGreaterThan(0);
    }
  });

  it('does not block when the defender is not at the net, or against a lob', () => {
    const st = rallyState({ formation: ['back', 'back'] });
    expect(stepHit(TEAMS, st, shot('vibora'), 'cross', fixedRng([0.99, 0.5, 0.5, 0.5])).step.block).toBe(undefined);
    const lob = rallyState({ formation: net });
    expect(stepHit(TEAMS, lob, shot('rally_lob'), 'cross', fixedRng([0.99, 0.5, 0.5, 0.5, 0.5])).step.block).toBe(undefined);
  });

  it('a defender in mid-court takes a ball into the middle of the court out of the air, not one into the back third', () => {
    const st = rallyState({ formation: ['back', 'mid'] });
    let air = 0;
    let deep = 0;
    for (let seed = 1; seed < 200; seed++) {
      const soft = stepHit(TEAMS, st, shot('chiquita'), 'cross', seededRng(seed), undefined, { ignoreRequires: true, force: 'continue' }).step;
      if (soft.block) air++;
      const l = stepHit(TEAMS, st, shot('rally_lob'), 'cross', seededRng(seed), undefined, { force: 'continue' }).step;
      if (l.block) deep++;
    }
    expect(air).toBeGreaterThan(150);
    expect(deep).toBe(0);
  });

  it('calls the flat shot "Flat shot"', () => {
    expect(shot('bounce_shot').name).toBe('Flat shot');
  });
});

describe('who plays the ball, lost balls and the two bajadas', () => {
  it('lets the partner who is closer to the aim point play the ball', () => {
    // a cross shot aimed to the far side of its lane's centre is taken by the other lane's player
    const rng = (x: number) => fixedRng([x, 0.99, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const left = stepHit(TEAMS, rallyState({ hitterIdx: 0 }), shot('vibora'), 'middle', rng(0.0));
    const right = stepHit(TEAMS, rallyState({ hitterIdx: 0 }), shot('vibora'), 'middle', rng(0.99));
    expect(new Set([left.step.defenderIdx, right.step.defenderIdx]).size).toBeGreaterThan(0);
    for (let seed = 1; seed <= 80; seed++) {
      const r = stepHit(TEAMS, rallyState({ hitterIdx: 0 }), shot('vibora'), 'cross', seededRng(seed));
      expect(r.step.defenderIdx).toBe((r.step.landX ?? 0) < 0 ? 0 : 1);
    }
  });

  it('rolls how a mistake ends: net, back glass or mesh', () => {
    expect(pickErrorKind(shot('vibora'), fixedRng([0.0]))).toBe('net');
    expect(pickErrorKind(shot('bajada_fast'), fixedRng([0.99]))).toBe('glass');
    expect(pickErrorKind(shot('rally_lob'), fixedRng([0.99]))).toBe('mesh');
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const r = stepHit(TEAMS, rallyState({ hitterIdx: 0 }), shot('vibora'), 'cross', seededRng(seed));
      if (r.step.outcome === 'error') kinds.add(r.step.errorKind ?? 'none');
    }
    expect(kinds.has('net')).toBe(true);
    expect(kinds.has('none')).toBe(false);
  });

  it('gives the bajada a high speed and a low speed version with the matching flight', () => {
    const fast = shot('bajada_fast');
    const slow = shot('bajada_slow');
    expect(fast.flight.speed).toBeGreaterThan(slow.flight.speed + 10);
    expect(fast.risk).toBeGreaterThan(slow.risk * 3);
    expect(slow.flight.spin).toBeLessThan(0);
    expect(slow.flight.side).toBeGreaterThan(0);
    expect((slow.rebound?.low ?? 0)).toBeGreaterThan(0.7);
    expect(fast.errorKinds?.glass).toBeGreaterThan(0);
  });
});

describe('lob rules', () => {
  it('is offered from every position, the net included', () => {
    const lob = shot('rally_lob');
    expect(unavailableReason(lob, rallyState({ formation: ['net', 'back'] }))).toBeNull();
    expect(unavailableReason(lob, rallyState({ formation: ['mid', 'back'] }))).toBeNull();
    expect(unavailableReason(lob, rallyState({ formation: ['back', 'back'] }))).toBeNull();
  });

  it('goes deep more often from a high or mid ball than from a low one', () => {
    const share = (height: 'high' | 'mid' | 'low'): number => {
      let deep = 0;
      let n = 0;
      for (let seed = 1; seed <= 1500; seed++) {
        const st = rallyState({ formation: ['back', 'back'], ball: { height, pressure: 0, air: true, zone: 'mid' } });
        const r = stepHit(TEAMS, st, shot('rally_lob'), 'cross', seededRng(seed));
        if (r.step.outcome !== 'continue') continue;
        n++;
        if (r.step.lob === 'deep') deep++;
      }
      return deep / n;
    };
    expect(share('high')).toBeGreaterThan(0.68);
    expect(share('mid')).toBeGreaterThan(0.68);
    expect(share('low')).toBeLessThan(0.63);
    expect(share('low')).toBeGreaterThan(0.48);
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
      for (const p of TEAMS.flat()) guts[p.id] = recoverGuts(guts[p.id], 1, p.maxGuts);
    }

    const avgHits = hitsTotal / N;
    expect(avgHits).toBeGreaterThan(2.5);
    expect(avgHits).toBeLessThan(9);
    expect(serverWins / N).toBeGreaterThan(0.4);
    expect(serverWins / N).toBeLessThan(0.7);
  });
});

describe('shot availability', () => {
  const weak = (height: 'high' | 'mid' | 'low' = 'high') => ({ height, pressure: 0, air: true, lob: 'weak' as const });

  it('offers a smash only at the net or mid-court after a weak lob', () => {
    for (const id of ['smash_x3', 'smash_x4']) {
      const s = shot(id);
      expect(unavailableReason(s, rallyState({ holder: 0, formation: ['net', 'back'], ball: weak() }))).toBeNull();
      expect(unavailableReason(s, rallyState({ holder: 0, formation: ['back', 'back'], ball: weak() }))).not.toBeNull();
      expect(unavailableReason(s, rallyState({ holder: 0, formation: ['net', 'back'], ball: { height: 'high', pressure: 0, lob: 'deep' } }))).not.toBeNull();
      expect(unavailableReason(s, rallyState({ holder: 0, formation: ['net', 'back'], ball: { ...weak(), glass: true } }))).not.toBeNull();
    }
  });

  it('offers vibora and bandeja only on a high ball, never off the glass, on a mid ball or on a low ball', () => {
    for (const id of ['vibora', 'bandeja']) {
      const s = shot(id);
      expect(unavailableReason(s, rallyState({ ball: { height: 'high', pressure: 0, air: true } }))).toBeNull();
      expect(unavailableReason(s, rallyState({ ball: { height: 'high', pressure: 0, air: true, glass: true } }))).not.toBeNull();
      expect(unavailableReason(s, rallyState({ ball: { height: 'low', pressure: 0, air: true } }))).not.toBeNull();
      expect(unavailableReason(s, rallyState({ ball: { height: 'mid', pressure: 0, air: true } }))).not.toBeNull();
    }
  });

  it('offers the volley only before the back glass, and the bajada only after a mid or high rebound', () => {
    expect(unavailableReason(shot('volley'), rallyState({ ball: { height: 'mid', pressure: 0, air: true } }))).toBeNull();
    expect(unavailableReason(shot('volley'), rallyState({ ball: { height: 'mid', pressure: 0, glass: true, air: true } }))).not.toBeNull();
    // after a bounce there is no volley
    expect(unavailableReason(shot('volley'), rallyState({ ball: { height: 'mid', pressure: 0 } }))).not.toBeNull();
    expect(unavailableReason(shot('bajada_fast'), rallyState({ ball: { height: 'mid', pressure: 0, glass: true } }))).toBeNull();
    expect(unavailableReason(shot('bajada_fast'), rallyState({ ball: { height: 'high', pressure: 0, glass: true } }))).toBeNull();
    expect(unavailableReason(shot('bajada_fast'), rallyState({ ball: { height: 'low', pressure: 0, glass: true } }))).not.toBeNull();
    expect(unavailableReason(shot('bajada_fast'), rallyState({ ball: { height: 'high', pressure: 0 } }))).not.toBeNull();
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

describe('pickStarReceiver', () => {
  it('returns a valid receiver index and favours the better defender', () => {
    const team = TEAMS[1];
    const rng = seededRng(7);
    const counts = [0, 0];
    for (let i = 0; i < 2000; i++) {
      const idx = pickStarReceiver(team, rng);
      expect([0, 1]).toContain(idx);
      counts[idx]++;
    }
    const rating = (p: PlayerDef) => p.stats.defense * 7 + p.stats.speed * 3;
    const better = rating(team[0]) >= rating(team[1]) ? 0 : 1;
    expect(counts[better]).toBeGreaterThanOrEqual(counts[1 - better]);
    expect(counts[1 - better]).toBeGreaterThan(0);
  });
});

describe('the net player volleys', () => {
  it('a defender at the net takes every ball he can reach out of the air', () => {
    for (const id of ['volley', 'bounce_shot', 'vibora', 'bandeja', 'rally_chiquita', 'bajada_fast']) {
      expect(netVolley(shot(id), 'net', undefined), id).toBe(true);
    }
  });
  it('but not a lob over him, a smash that leaves the court, a rulo, or anything when he is not at the net', () => {
    for (const id of ['rally_lob', 'smash_x3', 'smash_x4', 'rulo']) {
      expect(netVolley(shot(id), 'net', undefined), id).toBe(false);
    }
    expect(netVolley(shot('volley'), 'mid', undefined)).toBe(false);
    expect(netVolley(shot('volley'), 'back', undefined)).toBe(false);
    expect(netVolley(shot('volley'), 'net', 'weak')).toBe(false);
  });
  it('stepHit marks the step as a block (volley) whenever the defender is at the net and the rally continues', () => {
    let seen = 0;
    for (let seed = 1; seed <= 60 && seen < 3; seed++) {
      const st = rallyState({ formation: ['back', 'net'], ball: { height: 'mid', pressure: 0, zone: 'mid', air: true } });
      const r = stepHit(TEAMS, st, shot('volley'), 'cross', seededRng(seed));
      if (r.step.outcome !== 'continue') continue;
      seen++;
      expect(r.step.block).toBe(true);
      expect(r.state.ball.glass).toBe(false);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('Flat shot is not offered to a player at the net, the volley is', () => {
    const net = rallyState({ formation: ['net', 'back'], ball: { height: 'mid', pressure: 0, zone: 'net', air: true } });
    const ids = playableShots(shotsOfKind('rally'), net).map((s) => s.id);
    expect(ids).not.toContain('bounce_shot');
    expect(ids).toContain('volley');
    const back = rallyState({ formation: ['back', 'back'], ball: { height: 'low', pressure: 0, zone: 'mid' } });
    expect(playableShots(shotsOfKind('rally'), back).map((s) => s.id)).toContain('bounce_shot');
  });
  const AIR_ONLY = ['volley', 'bandeja', 'vibora', 'rulo', 'smash_x3', 'smash_x4'];
  it('after a bounce (a deep lob, with or without the glass) none of the shots from the air is offered', () => {
    for (const glass of [false, true]) {
      const st = rallyState({ formation: ['back', 'back'], ball: { height: 'high', pressure: 0, zone: 'back', lob: 'deep', glass } });
      const ids = playableShots(shotsOfKind('rally'), st).map((s) => s.id);
      for (const id of AIR_ONLY) expect(ids, id).not.toContain(id);
      expect(ids).toContain('rally_lob');
      expect(ids.includes('bajada_fast'), 'bajada').toBe(glass);
    }
  });
  it('a weak lob is played out of the air: the smashes at the net, bandeja and vibora in mid-court', () => {
    const ball = { height: 'high' as const, pressure: 0, zone: 'mid' as const, lob: 'weak' as const, glass: false, air: true };
    const atNet = playableShots(shotsOfKind('rally'), rallyState({ formation: ['net', 'net'], ball })).map((s) => s.id);
    expect(atNet).toContain('smash_x3');
    expect(atNet).not.toContain('bandeja');
    const mid = playableShots(shotsOfKind('rally'), rallyState({ formation: ['mid', 'mid'], ball })).map((s) => s.id);
    expect(mid).toContain('bandeja');
    expect(mid).toContain('vibora');
  });
  it('whatever the lob does, a ball that has bounced never offers a shot from the air (many random lobs)', () => {
    const lob = shotsOfKind('rally').find((x) => x.id === 'rally_lob')!;
    for (let seed = 1; seed < 400; seed++) {
      const r = stepHit(TEAMS, rallyState({ formation: ['net', 'net'], hits: 3 }), lob, 'cross', seededRng(seed));
      if (r.state.status !== 'rally') continue;
      const ids = playableShots(shotsOfKind('rally'), r.state).map((x) => x.id);
      const weak = r.state.ball.lob === 'weak' || r.state.ball.lob === 'medium';
      for (const id of AIR_ONLY) if (!weak) expect(ids, `${id} seed ${seed}`).not.toContain(id);
    }
  });
  it('the ball remembers how fast it was sent', () => {
    const st = rallyState({ formation: ['back', 'back'], ball: { height: 'mid', pressure: 0, zone: 'mid' } });
    for (let seed = 1; seed < 40; seed++) {
      const r = stepHit(TEAMS, st, shot('bounce_shot'), 'cross', seededRng(seed));
      if (r.step.outcome === 'continue') {
        expect(r.state.ball.speed).toBe(shot('bounce_shot').flight.speed);
        return;
      }
    }
  });
});

describe('CPU hitters look for the gaps', () => {
  const state = (over: Partial<PointState> = {}): PointState => rallyState({ holder: 1, hitterIdx: 0, formation: ['back', 'back'], ball: { height: 'mid', pressure: 0, air: true, zone: 'mid' }, ...over });

  it('a ball aimed at the gap is further from both opponents than the average aimed ball', () => {
    const rng = seededRng(5);
    // opponents stand in their lanes (-2.5, +2.5): the best gap is the middle
    const opp = [{ x: -2.5, z: 2.5 }, { x: 2.5, z: 2.5 }];
    let middle = 0;
    for (let i = 0; i < 300; i++) {
      const { direction } = pickHit(TEAMS, state(), rng, opp);
      if (direction === 'middle') middle++;
    }
    expect(middle).toBeGreaterThan(150);
  });

  it('avoids the side where the opponents stand: partner shifted to the middle, so the open space is on the line', () => {
    const rng = seededRng(9);
    const opp = [{ x: -0.8, z: 2.5 }, { x: 1.0, z: 2.5 }]; // both bunched in the middle
    const counts = { parallel: 0, cross: 0, middle: 0 } as Record<string, number>;
    for (let i = 0; i < 300; i++) counts[pickHit(TEAMS, state(), rng, opp).direction]++;
    expect(counts.middle).toBeLessThan(100);
  });

  it('asks for a deep ball against opponents at the net and a short one against opponents at the back', () => {
    const rng = seededRng(3);
    const net = pickHit(TEAMS, state(), rng, [{ x: -2.5, z: 8 }, { x: 2.5, z: 8 }]);
    const back = pickHit(TEAMS, state(), rng, [{ x: -2.5, z: 2 }, { x: 2.5, z: 2 }]);
    if (net.prefer?.depth !== undefined && !net.shot.overFence) expect(net.prefer.depth).toBeGreaterThan(net.shot.landDepth);
    if (back.prefer?.depth !== undefined && !back.shot.overFence) expect(back.prefer.depth).toBeLessThan(back.shot.landDepth);
  });

  it('lobs more against opponents at the net, chiquitas more against opponents at the back', () => {
    const rng = seededRng(21);
    const count = (opp: Array<{ x: number; z: number }>, test: (id: string) => boolean): number => {
      let n = 0;
      for (let i = 0; i < 600; i++) if (test(pickHit(TEAMS, state({ ball: { height: 'low', pressure: 0, air: true, zone: 'mid' } }), rng, opp).shot.id)) n++;
      return n;
    };
    const atNet = [{ x: -2.5, z: 8 }, { x: 2.5, z: 8 }];
    const atBack = [{ x: -2.5, z: 2 }, { x: 2.5, z: 2 }];
    expect(count(atNet, (id) => id.includes('lob'))).toBeGreaterThan(count(atBack, (id) => id.includes('lob')));
    expect(count(atBack, (id) => id.includes('chiquita'))).toBeGreaterThan(count(atNet, (id) => id.includes('chiquita')));
  });
});

describe('flat return', () => {
  it('is not a near-automatic winner: it needs a big margin, so a standing defender usually gets it back', () => {
    expect(shot('flat').winnerMargin ?? 0).toBeGreaterThanOrEqual(50);
  });
});

describe('rebound back over the net', () => {
  it('a hard shot that comes off the glass and beats the defence clearly ends the point for the attackers', () => {
    let found = 0;
    for (let seed = 1; seed < 6000 && found < 3; seed++) {
      const rng = seededRng(seed);
      const r = stepHit(TEAMS, rallyState(), shot('vibora'), 'cross', rng);
      if (r.step.reboundBack) {
        found++;
        expect(r.step.outcome).toBe('winner');
        expect(r.step.pointWinner).toBe(0);
        expect(r.state.status).toBe('done');
        expect(r.state.winner).toBe(0);
      }
    }
    expect(found).toBeGreaterThan(0);
  });
  it('the flat shot never flies back over the net, even when it beats the defence by a lot', () => {
    for (let seed = 1; seed < 3000; seed++) {
      const r = stepHit(TEAMS, rallyState({ ball: { height: 'mid', pressure: 0, zone: 'mid' } }), shot('bounce_shot'), 'cross', seededRng(seed));
      expect(r.step.reboundBack).toBeUndefined();
    }
  });
  it('soft shots never rebound back', () => {
    for (let seed = 1; seed < 500; seed++) {
      const r = stepHit(TEAMS, rallyState(), shot('chiquita'), 'cross', seededRng(seed));
      expect(r.step.reboundBack).toBeUndefined();
    }
  });
});

describe('Free Practice options', () => {
  it('ignoreRequires plays a shot that is normally unavailable, force decides how the hit ends', () => {
    const st = rallyState({ ball: { height: 'low', pressure: 0, air: true, zone: 'mid' } });
    expect(() => stepHit(TEAMS, st, shot('bajada_fast'), 'cross', seededRng(1))).toThrow();
    for (const force of ['winner', 'error', 'continue'] as const) {
      const r = stepHit(TEAMS, st, shot('bajada_fast'), 'cross', seededRng(2), undefined, { ignoreRequires: true, force });
      expect(r.step.outcome).toBe(force);
    }
    const rb = stepHit(TEAMS, st, shot('vibora'), 'cross', seededRng(3), undefined, { ignoreRequires: true, force: 'rebound' });
    expect(rb.step.reboundBack).toBe(true);
    expect(rb.step.pointWinner).toBe(0);
  });
});

describe('Por Tres and Por Cuatro', () => {
  it('are not offered on a low ball', () => {
    for (const id of ['smash_x3', 'smash_x4']) {
      const weak = (height: 'low' | 'mid' | 'high') => rallyState({ formation: ['net', 'back'], ball: { height, pressure: 0, air: true, lob: 'weak' } });
      expect(unavailableReason(shot(id), weak('high')), id).toBeNull();
      expect(unavailableReason(shot(id), weak('mid')), id).toBeNull();
      expect(unavailableReason(shot(id), weak('low')), id).not.toBeNull();
    }
  });

  it('Por Cuatro winners are either the nail (front of the court) or the deep rebound back over the net', () => {
    let nail = 0;
    let rebound = 0;
    const st = rallyState({ formation: ['net', 'back'], ball: { height: 'high', pressure: 0, air: true, lob: 'weak' } });
    for (let seed = 1; seed < 300; seed++) {
      const r = stepHit(TEAMS, st, shot('smash_x4'), 'cross', seededRng(seed), undefined, { force: 'winner' }).step;
      if (r.reboundBack) {
        rebound++;
        expect(r.landDepth).toBeGreaterThan(7);
      } else {
        nail++;
        expect(r.landDepth).toBeLessThan(5.5);
      }
    }
    expect(nail).toBeGreaterThan(80);
    expect(rebound).toBeGreaterThan(80);
  });

  it('a Por Cuatro that is not hit well comes back and the defender plays it at the net', () => {
    const st = rallyState({ formation: ['net', 'back'], ball: { height: 'high', pressure: 0, air: true, lob: 'weak' } });
    let seen = 0;
    for (let seed = 1; seed < 400; seed++) {
      const r = stepHit(TEAMS, st, shot('smash_x4'), 'cross', seededRng(seed), undefined, { force: 'continue' });
      if (r.step.netReturn) {
        seen++;
        expect(r.state.formation[1]).toBe('net');
        expect(r.state.ball.height).toBe('mid');
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('errors into the walls and the early Por Cuatro', () => {
  it('a ball aimed at the side wall is more often lost, and then often straight into that wall', () => {
    let side = 0;
    let total = 0;
    for (let seed = 1; seed < 400; seed++) {
      expect(pickErrorKind(shot('flat'), seededRng(seed), 0)).not.toBe('side');
      total++;
      if (pickErrorKind(shot('flat'), seededRng(seed), 4.5) === 'side') side++;
    }
    expect(side / total).toBeGreaterThan(0.3);
  });

  it('a Por Cuatro that is taken early (before the glass) is sometimes fumbled: the hitter wins the point', () => {
    const st = rallyState({ formation: ['net', 'back'], ball: { height: 'high', pressure: 0, air: true, lob: 'weak' } });
    let fumbled = 0;
    let early = 0;
    let net = 0;
    for (let seed = 1; seed < 600; seed++) {
      const r = stepHit(TEAMS, st, shot('smash_x4'), 'cross', seededRng(seed), undefined, { force: 'continue' });
      if (r.step.earlyError) fumbled++;
      else if (r.step.block) early++;
      else if (r.step.netReturn) net++;
    }
    expect(fumbled).toBeGreaterThan(20);
    expect(early).toBeGreaterThan(20);
    expect(net).toBeGreaterThan(50);
  });
});

describe('serve fault kinds', () => {
  it('a faulted serve to a wall ends in several ways, a serve to the open court in fewer', () => {
    const seen = new Set<string>();
    const seenOpen = new Set<string>();
    for (let seed = 1; seed < 600; seed++) {
      seen.add(pickErrorKind(shot('hard_glass'), seededRng(seed)));
      seenOpen.add(pickErrorKind(shot('t_serve'), seededRng(seed)));
    }
    expect([...seen].sort()).toEqual(['bouncemesh', 'glass', 'long', 'net', 'side']);
    expect(seenOpen.has('side')).toBe(false);
    expect(seenOpen.has('long')).toBe(true);
  });
  it('the rulo is offered on a high ball only', () => {
    const r = shot('rulo');
    const st = (height: 'low' | 'mid' | 'high') => rallyState({ ball: { height, pressure: 0, air: true, zone: 'mid' } });
    expect(unavailableReason(r, st('high'))).toBeNull();
    expect(unavailableReason(r, st('mid'))).not.toBeNull();
    expect(unavailableReason(r, st('low'))).not.toBeNull();
  });
});

describe('vibora and the net', () => {
  it('is not playable by a team that stands at the net, but is from mid and back', () => {
    const vibora = SHOTS.find((s) => s.id === 'vibora')!;
    const base = startPoint({}, 0, 0, 0);
    const st = (f: 'net' | 'mid' | 'back'): PointState => ({
      ...base,
      holder: 0,
      formation: [f, 'back'],
      ball: { ...base.ball, height: 'high', glass: false, air: true },
    });
    expect(unavailableReason(vibora, st('net'))).not.toBeNull();
    expect(unavailableReason(vibora, st('mid'))).toBeNull();
    expect(unavailableReason(vibora, st('back'))).toBeNull();
  });
});

describe('serve: the receiver is too late', () => {
  it('a serve that is in becomes an ace for the server, a fault stays a fault', () => {
    let aces = 0;
    let faults = 0;
    for (let seed = 1; seed < 400; seed++) {
      const st = startPoint(freshGuts(), 0, 0, 0);
      const normal = stepServe(TEAMS, st, shot('hard_glass'), seededRng(seed), 'bounce');
      const late = stepServe(TEAMS, st, shot('hard_glass'), seededRng(seed), 'bounce', true);
      if (normal.step.outcome === 'fault') {
        expect(late.step.outcome).toBe('fault');
        faults++;
      } else {
        expect(late.step.outcome).toBe('ace');
        expect(late.step.pointWinner).toBe(0);
        expect(late.state.status).toBe('done');
        if (normal.step.outcome === 'in') expect(late.step.late).toBe(true);
        aces++;
      }
    }
    expect(aces).toBeGreaterThan(0);
    expect(faults).toBeGreaterThan(0);
  });
});

describe('owner shots of v0.55: bandeja, vibora, flat shot, dejada, contrapared, block', () => {
  const ids = (st: PointState): string[] => playableShots(shotsOfKind('rally'), st).map((x) => x.id);
  const air = { height: 'high' as const, pressure: 0, zone: 'mid' as const, air: true };

  it('bandeja and vibora: from the middle or the back of the court, only out of the air', () => {
    for (const f of ['mid', 'back'] as Formation[]) {
      const st = rallyState({ formation: [f, 'back'], ball: air });
      expect(ids(st), f).toContain('bandeja');
      expect(ids(st), f).toContain('vibora');
      // after the bounce: neither
      const bounced = rallyState({ formation: [f, 'back'], ball: { height: 'high', pressure: 0, zone: 'back', lob: 'deep' } });
      expect(ids(bounced), f).not.toContain('bandeja');
      expect(ids(bounced), f).not.toContain('vibora');
    }
    const net = rallyState({ formation: ['net', 'back'], ball: air });
    expect(ids(net)).not.toContain('bandeja');
    expect(ids(net)).not.toContain('vibora');
  });

  it('flat shot: only after the bounce', () => {
    const ball = { height: 'low' as const, pressure: 0, zone: 'mid' as const };
    expect(ids(rallyState({ formation: ['back', 'back'], ball }))).toContain('bounce_shot');
    expect(ids(rallyState({ formation: ['back', 'back'], ball: { ...ball, air: true } }))).not.toContain('bounce_shot');
  });

  it('dejada: at the net or mid-court, low or mid ball, not off the glass, opponents not at the net', () => {
    const ball = { height: 'mid' as const, pressure: 0, zone: 'mid' as const, air: true };
    for (const f of ['net', 'mid'] as Formation[]) {
      for (const opp of ['back', 'mid'] as Formation[]) expect(ids(rallyState({ formation: [f, opp], ball })), `${f} vs ${opp}`).toContain('dejada');
    }
    expect(ids(rallyState({ formation: ['back', 'back'], ball }))).not.toContain('dejada');
    expect(ids(rallyState({ formation: ['net', 'net'], ball }))).not.toContain('dejada');
    expect(ids(rallyState({ formation: ['net', 'back'], ball: { ...ball, height: 'high' } }))).not.toContain('dejada');
    expect(ids(rallyState({ formation: ['mid', 'back'], ball: { ...ball, glass: true } }))).not.toContain('dejada');
    // also after the bounce
    expect(ids(rallyState({ formation: ['mid', 'back'], ball: { height: 'low', pressure: 0, zone: 'net' } }))).toContain('dejada');
  });

  it('dejada beats a defender at the back more often than one at the net', () => {
    const wins = (def: Formation): number => {
      let n = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const st = rallyState({ formation: ['net', def], ball: { height: 'mid', pressure: 0, zone: 'mid', air: true } });
        const r = stepHit(TEAMS, st, shot('dejada'), 'cross', seededRng(seed), undefined, { ignoreRequires: true });
        if (r.step.outcome === 'winner') n++;
      }
      return n;
    };
    expect(wins('back')).toBeGreaterThan(wins('net'));
  });

  it('contrapared: not at the net, after the bounce, low or mid, with a ball that comes down by a side wall', () => {
    const ball = { height: 'mid' as const, pressure: 0, zone: 'mid' as const, nearWall: true };
    expect(ids(rallyState({ formation: ['back', 'back'], ball }))).toContain('contrapared');
    expect(ids(rallyState({ formation: ['mid', 'back'], ball }))).toContain('contrapared');
    expect(ids(rallyState({ formation: ['net', 'back'], ball }))).not.toContain('contrapared');
    expect(ids(rallyState({ formation: ['back', 'back'], ball: { ...ball, nearWall: undefined } }))).not.toContain('contrapared');
    expect(ids(rallyState({ formation: ['back', 'back'], ball: { ...ball, air: true } }))).not.toContain('contrapared');
    expect(ids(rallyState({ formation: ['back', 'back'], ball: { ...ball, glass: true } }))).not.toContain('contrapared');
    expect(ids(rallyState({ formation: ['back', 'back'], ball: { ...ball, height: 'high' } }))).not.toContain('contrapared');
  });

  it('contrapared is always played cross', () => {
    expect(shot('contrapared').fixedDirection).toBe('cross');
    expect(shot('contrapared').ownWall).toBe(true);
  });

  it('a ball sent down the line (parallel) comes down by the wall; a cross ball does not', () => {
    const st = rallyState({ holder: 1, hitterIdx: 0, formation: ['back', 'back'], ball: { height: 'mid', pressure: 0, zone: 'mid' } });
    let near = 0, far = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const p = stepHit(TEAMS, st, shot('bounce_shot'), 'parallel', seededRng(seed), undefined, { ignoreRequires: true });
      const c = stepHit(TEAMS, st, shot('bounce_shot'), 'cross', seededRng(seed), undefined, { ignoreRequires: true });
      if (p.step.outcome === 'continue' && p.state.ball.nearWall) near++;
      if (c.step.outcome === 'continue' && c.state.ball.nearWall) far++;
    }
    expect(near).toBeGreaterThan(far);
    expect(near).toBeGreaterThan(20);
  });

  it('block: at the net, out of the air, low or mid, only against a hard ball', () => {
    const ball = { height: 'mid' as const, pressure: 0, zone: 'net' as const, air: true, speed: 27 };
    expect(ids(rallyState({ formation: ['net', 'back'], ball }))).toContain('bloqueo');
    expect(ids(rallyState({ formation: ['net', 'back'], ball: { ...ball, speed: 15 } }))).not.toContain('bloqueo');
    expect(ids(rallyState({ formation: ['net', 'back'], ball: { ...ball, speed: undefined } }))).not.toContain('bloqueo');
    expect(ids(rallyState({ formation: ['mid', 'back'], ball }))).not.toContain('bloqueo');
    expect(ids(rallyState({ formation: ['net', 'back'], ball: { ...ball, air: undefined } }))).not.toContain('bloqueo');
    expect(ids(rallyState({ formation: ['net', 'back'], ball: { ...ball, height: 'high' } }))).not.toContain('bloqueo');
  });

  it('a block is not weakened by the pressure of a hard ball, a volley is; the volley is the stronger attack', () => {
    expect(shot('bloqueo').ignorePressure).toBe(true);
    expect(shot('volley').power).toBeGreaterThan(shot('bloqueo').power);
    expect(shot('volley').flight.speed).toBeGreaterThanOrEqual(26);
    expect(shot('volley').flight.speed).toBeGreaterThan(shot('bloqueo').flight.speed);
  });
});

describe('Powerful Smash: a Por Cuatro that stays in the court', () => {
  const weak = { height: 'high' as const, pressure: 0, zone: 'mid' as const, lob: 'weak' as const, glass: false, air: true };
  const hits = (id: string, n = 600) => {
    const out: ReturnType<typeof stepHit>[] = [];
    for (let seed = 1; seed <= n; seed++) {
      out.push(stepHit(TEAMS, rallyState({ formation: ['net', 'back'], hitterIdx: seed % 2, ball: weak }), shot(id), 'cross', seededRng(seed), undefined, { ignoreRequires: true }));
    }
    return out;
  };
  it('is named Powerful Smash when the ball comes off the back glass (winner or played back from the net)', () => {
    const all = hits('smash_x4');
    const back = all.filter((r) => r.step.reboundBack);
    const net = all.filter((r) => r.step.netReturn);
    expect(back.length).toBeGreaterThan(0);
    expect(net.length).toBeGreaterThan(0);
    for (const r of [...back, ...net]) {
      expect(isPowerfulSmash(r.step)).toBe(true);
      expect(shotLabel(r.step)).toBe(POWERFUL_SMASH);
    }
  });
  it('stays a Por Cuatro when it flies out over the glass, or is an error', () => {
    const rest = hits('smash_x4').filter((r) => !r.step.reboundBack && !r.step.netReturn);
    expect(rest.some((r) => r.step.outcome === 'winner')).toBe(true);
    for (const r of rest) expect(shotLabel(r.step)).toBe('Por Cuatro');
  });
  it('never renames another shot', () => {
    for (const id of ['smash_x3', 'volley', 'bandeja', 'vibora']) {
      for (const r of hits(id, 120)) expect(shotLabel(r.step)).toBe(shot(id).name);
    }
  });
});

describe('the work is shared evenly inside a pair (the CPU used to feed the right-hand player)', () => {
  const evenTeams = (): Teams => {
    const flat = Object.fromEntries(Object.keys(TEAMS[0][0].stats).map((k) => [k, 5])) as PlayerDef['stats'];
    const mk = (id: string): PlayerDef => ({ ...TEAMS[0][0], id, name: id, stats: flat, maxGuts: 10 });
    return [[mk('a0'), mk('a1')], [mk('b0'), mk('b1')]];
  };

  it('a ball aimed exactly between two aim points goes to either side', () => {
    const rng = seededRng(5);
    const xs = new Set<number>();
    for (let i = 0; i < 200; i++) xs.add(Math.round(aimX('middle', 0, rng, -0.1, 5) * 100));
    expect([...xs].some((x) => x < 0)).toBe(true);
    expect([...xs].some((x) => x >= 0)).toBe(true);
  });

  it('with equal players both hit about the same number of balls', () => {
    const teams = evenTeams();
    const rng = seededRng(21);
    const guts = Object.fromEntries(teams.flat().map((p) => [p.id, p.maxGuts]));
    const hits = { a0: 0, a1: 0, b0: 0, b1: 0 } as Record<string, number>;
    for (let i = 0; i < 400; i++) {
      let st = startPoint(guts, (i % 2) as 0 | 1, 0, i);
      for (let k = 0; k < 3 && st.status === 'serve'; k++) st = stepServe(teams, st, pickServe(teams, st, rng), rng, pickReceive(teams, st, rng)).state;
      while (st.status === 'rally') {
        const opp = teams[st.holder === 0 ? 1 : 0].map((_, k) => ({ x: k === 0 ? -2.5 : 2.5, z: st.holder === 0 ? 8 : 12 }));
        const { shot: sh, direction, prefer } = pickHit(teams, st, rng, opp);
        hits[teams[st.holder][st.hitterIdx].id]++;
        st = stepHit(teams, st, sh, direction, rng, prefer).state;
      }
    }
    for (const [a, b] of [['a0', 'a1'], ['b0', 'b1']]) {
      const share = hits[a] / (hits[a] + hits[b]);
      expect(share).toBeGreaterThan(0.42);
      expect(share).toBeLessThan(0.58);
    }
  });
});

describe('the CPU receiver reads the speed of the serve', () => {
  it('waits for the glass on a fast serve and takes a slow one off the bounce', () => {
    const rng = seededRng(3);
    const st = startPoint(freshGuts(), 0, 0, 0);
    const share = (id: string): number => {
      let wall = 0;
      for (let i = 0; i < 600; i++) if (pickReceive(TEAMS, st, rng, shot(id)) === 'wall') wall++;
      return wall / 600;
    };
    expect(share('hard_glass')).toBeGreaterThan(0.65);
    expect(share('t_serve')).toBeLessThan(0.4);
  });
});

describe('the medium lob: the ball for the vibora and the bandeja', () => {
  it('about a quarter of the lobs are medium: they land in the back third and are played out of the air', () => {
    let medium = 0, n = 0;
    for (let seed = 1; seed <= 1200; seed++) {
      const st = rallyState({ formation: ['back', 'back'], ball: { height: 'low', pressure: 0, zone: 'mid' } });
      const r = stepHit(TEAMS, st, shot('rally_lob'), 'cross', seededRng(seed));
      if (r.step.outcome !== 'continue') continue;
      n++;
      if (r.step.lob === 'medium') {
        medium++;
        expect(r.state.ball.air).toBe(true);
        expect(r.state.ball.height).toBe('high');
        expect(r.state.formation[1]).toBe('mid');
        expect(r.step.landDepth!).toBeGreaterThan(5.7);
        expect(r.step.landDepth!).toBeLessThan(7.5);
        const ids = playableShots(shotsOfKind('rally'), r.state).map((x) => x.id);
        expect(ids).toContain('bandeja');
        expect(ids).toContain('vibora');
        expect(ids).not.toContain('smash_x3');
        expect(ids).not.toContain('smash_x4');
      }
    }
    expect(medium / n).toBeGreaterThan(0.18);
    expect(medium / n).toBeLessThan(0.32);
  });
});
