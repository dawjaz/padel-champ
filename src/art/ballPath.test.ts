import { describe, expect, it } from 'vitest';
import { SHOTS } from '../game/catalog';
import { landingX } from '../game/court';
import type { ShotDef } from '../game/types';
import { ARRIVAL_HEIGHT, ballPoint, buildCoast, buildFlight, flightDuration, GRAVITY, magnus, type FlightOutcome } from './ballPath';

const shot = (id: string): ShotDef => SHOTS.find((s) => s.id === id)!;
const OUTCOMES: FlightOutcome[] = ['fault', 'double-fault', 'ace', 'in', 'error', 'winner', 'intercept', 'continue'];
const NO_PLAY: FlightOutcome[] = ['fault', 'double-fault', 'error'];
const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Flight of a shot hit from the near court (side 0), cross to the far right. */
function fly(id: string, extra: Partial<Parameters<typeof buildFlight>[0]> = {}) {
  const s = shot(id);
  const landX = s.kind === 'serve' ? (s.landX ?? 3) : landingX('cross', 1);
  const from = s.kind === 'serve' ? { x: -2.5, z: 18.5 } : { x: -2.5, z: 17.5 };
  return buildFlight({ from, startH: s.kind === 'serve' ? 0.9 : 1, hitterSide: 0, shot: s, landX, outcome: 'continue', ...extra });
}

describe('buildFlight: general', () => {
  it('starts at the hitter at the given height and ends where the next player hits the ball', () => {
    const f = fly('bandeja', { startH: 1.7 });
    expect(f.path[0]).toMatchObject({ t: 0, x: -2.5, z: 17.5, h: 1.7 });
    const end = f.path[f.path.length - 1];
    expect(end).toMatchObject({ x: f.hit.x, z: f.hit.z });
    expect(end.h).toBeCloseTo(f.hitH);
    expect(f.duration).toBeCloseTo(end.t);
  });

  it('keeps the ball inside the court, above the floor, and clear of the net, for every shot and outcome', () => {
    // Violations are collected and checked once: an expect() per sample would make this test very slow.
    const problems: string[] = [];
    for (const s of SHOTS) {
      for (const outcome of OUTCOMES) {
        for (const hitterSide of [0, 1] as const) {
          for (const receive of ['bounce', 'wall'] as const) {
            for (const hx of [-2.5, 2.5]) {
              const from = { x: hx, z: hitterSide === 0 ? 14 : 6 };
              const f = buildFlight({ from, startH: 1, hitterSide, shot: s, landX: -hx, outcome, receive });
              const label = `${s.id}/${outcome}/${hitterSide}/${receive}/${hx}`;
              for (const p of f.path) {
                const ok =
                  Math.abs(p.x) <= 5.0001 && p.z >= -1e-6 && p.z <= 20.0001 && p.h >= -1e-9 && Number.isFinite(p.x + p.z + p.h);
                if (!ok) {
                  problems.push(`${label}: out of bounds at ${JSON.stringify(p)}`);
                  break;
                }
              }
              if (NO_PLAY.includes(outcome)) continue;
              if (!(hitterSide === 0 ? f.hit.z < 10 : f.hit.z > 10)) problems.push(`${label}: hit on the wrong half`);
              for (let i = 1; i < f.path.length; i++) {
                const a = f.path[i - 1];
                const b = f.path[i];
                if ((a.z - 10) * (b.z - 10) < 0 && Math.min(a.h, b.h) <= 0.92) {
                  problems.push(`${label}: hits the net`);
                  break;
                }
              }
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  }, 30000);

  it('dies in the net on a fault or an error', () => {
    for (const outcome of NO_PLAY) {
      const f = fly('hard_glass', { outcome });
      expect(f.events.some((e) => e.kind === 'net')).toBe(true);
      const net = f.events.find((e) => e.kind === 'net')!;
      expect(Math.abs(net.z - 10)).toBeLessThan(0.5);
      expect(net.h).toBeLessThan(0.92);
      expect(f.path[f.path.length - 1].h).toBeCloseTo(0);
    }
  });

  it('bounces first in the opponent court, at the intended spot', () => {
    for (const s of SHOTS) {
      const f = fly(s.id);
      const first = f.events[0];
      expect(first.kind, s.id).toBe('bounce');
      expect(first.z, s.id).toBeCloseTo(10 - s.landDepth, 3);
      expect(first.h, s.id).toBe(0);
    }
  });
});

describe('buildFlight: real-world behaviour of each shot', () => {
  const apexOf = (id: string): number => Math.max(...fly(id).path.map((p) => p.h));

  it('lobs high (5 m and more) and arrives high, other shots stay low', () => {
    expect(apexOf('lob')).toBeGreaterThan(5);
    expect(apexOf('rally_lob')).toBeGreaterThan(4.5);
    expect(fly('lob').hitH).toBeGreaterThan(1.5);
    for (const id of ['flat', 'volley', 'vibora', 'bandeja', 'hard_glass', 't_serve', 'chiquita']) {
      expect(apexOf(id), id).toBeLessThan(2.6);
    }
  });

  it('hits hard shots faster than soft ones: a chiquita takes longer than a flat return', () => {
    expect(fly('chiquita').path[0].t).toBe(0);
    const tFirstBounce = (id: string): number => fly(id).events[0].t;
    // Per metre of ground covered, the chiquita is much slower.
    const pace = (id: string): number => {
      const f = fly(id);
      return dist(f.path[0], f.events[0]) / f.events[0].t;
    };
    expect(pace('chiquita')).toBeLessThan(pace('flat') * 0.7);
    expect(tFirstBounce('lob')).toBeGreaterThan(tFirstBounce('flat') * 2);
  });

  it('lands a chiquita short and a lob deep', () => {
    expect(fly('chiquita').events[0].z).toBeGreaterThan(fly('lob').events[0].z + 4);
  });

  it('kicks a topspin ball forward off the bounce and makes a slice skid short', () => {
    const base = shot('at_opponent');
    const run = (spin: number): number => {
      const custom: ShotDef = { ...base, landDepth: 3, flight: { ...base.flight, spin } };
      const f = buildFlight({
        from: { x: 0, z: 18.5 },
        startH: 0.9,
        hitterSide: 0,
        shot: custom,
        landX: 0,
        outcome: 'continue',
        receive: 'bounce',
      });
      return dist(f.events[0], f.hit);
    };
    expect(run(1)).toBeGreaterThan(run(-1) + 0.5);
  });

  it('lets a glass serve be taken right after the bounce, or after it has come off the glass', () => {
    const bounce = fly('hard_glass', { outcome: 'in', receive: 'bounce' });
    const wall = fly('hard_glass', { outcome: 'in', receive: 'wall' });
    const walls = (f: typeof bounce): number => f.events.filter((e) => e.kind === 'glass' || e.kind === 'mesh').length;
    expect(walls(bounce)).toBe(0);
    expect(walls(wall)).toBeGreaterThanOrEqual(1);
    // The glass serve kicks off the side glass first, then often the back glass as well
    const first = wall.events.find((e) => e.kind === 'glass')!;
    expect(Math.abs(first.x)).toBeCloseTo(5, 1);
    expect(wall.duration).toBeGreaterThan(bounce.duration);
  });

  it('plays rally balls that reach the glass only after the glass', () => {
    for (const id of ['vibora', 'bandeja', 'lob', 'rulo', 'flat']) {
      const f = fly(id);
      expect(f.events.some((e) => e.kind === 'glass' || e.kind === 'mesh'), id).toBe(true);
    }
  });

  it('lets a winner fly on past the defender, to the wall or out', () => {
    const f = fly('volley', { outcome: 'winner' });
    const hitT = f.path.findIndex((p) => p.x === f.hit.x && p.z === f.hit.z);
    expect(f.path.length).toBeGreaterThan(hitT);
    const end = f.path[f.path.length - 1];
    expect(end.t).toBeGreaterThan(0.5);
  });

  it('turns an intercepted ball around, back towards the hitter', () => {
    const f = fly('flat', { outcome: 'intercept' });
    const end = f.path[f.path.length - 1];
    expect(end.z).toBeGreaterThan(10);
  });
});

describe('ballPoint and flightDuration', () => {
  const f = fly('lob');

  it('starts and ends at the first and last sample and clamps u outside 0..1', () => {
    const a = ballPoint(f.path, 0);
    const b = ballPoint(f.path, 1);
    expect(a).toMatchObject({ x: f.path[0].x, z: f.path[0].z });
    expect(b.x).toBeCloseTo(f.hit.x);
    expect(b.z).toBeCloseTo(f.hit.z);
    expect(ballPoint(f.path, -1)).toEqual(a);
    expect(ballPoint(f.path, 2)).toEqual(b);
  });

  it('never goes below the floor and rises high in the middle of a lob', () => {
    let max = 0;
    for (let i = 0; i <= 100; i++) {
      const p = ballPoint(f.path, i / 100);
      expect(p.h).toBeGreaterThanOrEqual(-1e-9);
      max = Math.max(max, p.h);
    }
    expect(max).toBeGreaterThan(5);
  });

  it('keeps flights quick but gives a lob more time than a flat shot', () => {
    for (const s of SHOTS) {
      const d = flightDuration(fly(s.id));
      expect(d).toBeGreaterThanOrEqual(450);
      expect(d).toBeLessThanOrEqual(2000);
    }
    expect(flightDuration(fly('lob'))).toBeGreaterThan(flightDuration(fly('flat'))* 2);
  });
});

describe('smash', () => {
  const lands = [-3.6, -2.5, -0.3, 0.3, 2.5, 3.6];

  it('flies out over the back glass when a winning smash x4 is hit', () => {
    for (const x of lands) {
      const f = fly('smash_x4', { startH: 2, landX: x, outcome: 'winner' });
      const out = f.events.find((e) => e.kind === 'out');
      expect(out, `landX ${x}`).toBeDefined();
      expect(out!.z).toBeCloseTo(0);
      expect(out!.h).toBeGreaterThanOrEqual(3);
    }
  });

  it('kicks a winning smash x3 off the back glass and out over the side wall or mesh', () => {
    for (const x of lands) {
      const f = fly('smash_x3', { startH: 2, landX: x, outcome: 'winner' });
      expect(f.events.some((e) => e.kind === 'glass'), `landX ${x} glass`).toBe(true);
      expect(f.events.some((e) => e.kind === 'out'), `landX ${x} out`).toBe(true);
    }
  });

  it('keeps a smash in play (back glass or mesh, then the next hit) when it does not win', () => {
    for (const id of ['smash_x3', 'smash_x4']) {
      for (const x of lands) {
        const f = fly(id, { startH: 2, landX: x, outcome: 'continue' });
        expect(f.events.some((e) => e.kind === 'out'), `${id} ${x}`).toBe(false);
        expect(f.events.some((e) => e.kind === 'glass' || e.kind === 'mesh'), `${id} ${x} wall`).toBe(true);
        expect(f.hit.z).toBeLessThan(10);
      }
    }
  });
});

describe('rulo', () => {
  const rulo = (outcome: FlightOutcome, seed: number) => fly('rulo', { startH: 1.5, landX: 4.55, outcome, seed });

  it('bounces on the floor beside the side fence first, then hits the mesh', () => {
    for (const outcome of ['continue', 'winner'] as const) {
      const f = rulo(outcome, 3);
      const kinds = f.events.map((e) => e.kind);
      expect(kinds[0], outcome).toBe('bounce');
      expect(kinds[1], outcome).toBe('mesh');
      expect(Math.abs(f.events[0].x)).toBeGreaterThan(4.3);
      expect(f.events[0].h).toBe(0);
    }
  });

  it('comes off the mesh and stays in the court when it wins: the ball rolls out inside the court', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const f = rulo('winner', seed);
      expect(f.events.some((e) => e.kind === 'mesh')).toBe(true);
      expect(f.events.some((e) => e.kind === 'out')).toBe(false);
      const c = buildCoast(f, 1.4);
      for (const p of c.path) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(5.001);
        expect(p.z).toBeGreaterThanOrEqual(-0.001);
        expect(p.z).toBeLessThanOrEqual(20.001);
      }
    }
  });

  it('comes off the mesh unpredictably when it stays in play, but always stays on the receiving half', () => {
    const spots = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const f = rulo('continue', seed);
      expect(f.events.some((e) => e.kind === 'out')).toBe(false);
      expect(f.hit.z).toBeLessThan(10);
      expect(f.hit.z).toBeGreaterThan(0);
      spots.add(`${Math.round(f.hit.x)}:${Math.round(f.hit.z)}`);
    }
    expect(spots.size).toBeGreaterThan(5);
  });

  it('goes straight into the mesh and drops dead when it is mishit', () => {
    const f = rulo('error', 1);
    expect(f.events.map((e) => e.kind)).toEqual(['mesh']);
    expect(f.events[0].h).toBeGreaterThan(1);
    expect(f.path[f.path.length - 1].h).toBeCloseTo(0);
    expect(Math.abs(f.hit.x)).toBeGreaterThan(4.5);
  });
});

describe('rules rework: glass, rebound height, weak lob, free ball', () => {
  it('plays a weak lob short and a deep one long', () => {
    const weak = fly('rally_lob', { landDepth: 3.5, glass: false, arrival: 'high' });
    const deep = fly('rally_lob', { glass: false, arrival: 'high' });
    expect(weak.events.find((e) => e.kind === 'bounce')!.z).toBeGreaterThan(deep.events.find((e) => e.kind === 'bounce')!.z);
  });

  it('takes a non-glass ball before any wall and a glass ball after the back glass', () => {
    const plain = fly('vibora', { glass: false, arrival: 'high' });
    expect(plain.events.filter((e) => e.kind === 'glass' && e.t <= plain.duration).length).toBe(0);
    for (const arrival of ['low', 'mid', 'high'] as const) {
      const f = fly('vibora', { glass: true, arrival });
      const back = f.events.find((e) => (e.kind === 'glass' || e.kind === 'mesh') && e.z <= 0.01);
      expect(back, arrival).toBeDefined();
      expect(f.hit.z).toBeGreaterThan(0);
    }
  });

  it('rebounds off the back glass to the chosen height class', () => {
    const hh = (arrival: 'low' | 'mid' | 'high') => fly('bounce_shot', { glass: true, arrival }).hitH;
    expect(hh('high')).toBeGreaterThan(hh('mid'));
    expect(hh('mid')).toBeGreaterThan(hh('low'));
    expect(ARRIVAL_HEIGHT.high).toBeGreaterThan(ARRIVAL_HEIGHT.low);
  });

  it('lets the ball fall, bounce and roll to a stop after the point', () => {
    const f = fly('smash_x4', { outcome: 'winner', landX: 1 });
    const c = buildCoast(f, 1);
    expect(c.duration).toBeGreaterThan(0);
    expect(c.path.every((p) => p.h >= -1e-9)).toBe(true);
    const last = c.path[c.path.length - 1];
    expect(last.h).toBeLessThan(0.1);
    const prev = c.path[c.path.length - 2];
    expect(Math.hypot(last.x - prev.x, last.z - prev.z) / (last.t - prev.t)).toBeLessThan(0.2);
  });

  it('keeps a dead ball (error in the net) where it is', () => {
    const c = buildCoast(fly('vibora', { outcome: 'error' }), -0.4);
    const first = c.path[0];
    const last = c.path[c.path.length - 1];
    expect(Math.hypot(last.x - first.x, last.z - first.z)).toBeLessThan(1.5);
  });
});

describe('blocks at the net, weak lobs and chiquitas', () => {
  it('ends a blocked ball in the air close to the net, before any bounce', () => {
    const f = fly('vibora', { block: true, glass: false, arrival: 'mid', landDepth: 6 });
    expect(f.events.some((e) => e.kind === 'bounce')).toBe(false);
    expect(f.hit.z).toBeLessThan(10);
    expect(f.hit.z).toBeGreaterThan(7.5);
    expect(f.hitH).toBeGreaterThan(0.5);
  });

  it('lets a weak lob be taken overhead out of the air', () => {
    const f = fly('rally_lob', { airHit: true, landDepth: 4, glass: false, arrival: 'high' });
    expect(f.events.some((e) => e.kind === 'bounce')).toBe(false);
    expect(f.hitH).toBeGreaterThan(1.7);
    expect(f.hitH).toBeLessThan(2.3);
  });

  it('lands a chiquita just behind the net', () => {
    const f = fly('rally_chiquita', { landDepth: 1.6, glass: false });
    const b = f.events.find((e) => e.kind === 'bounce')!;
    expect(10 - b.z).toBeLessThan(2.2);
  });
});

describe('serve to the side glass', () => {
  it('is taken after the side glass but before the back glass', () => {
    for (const id of ['hard_glass', 'spin_glass']) {
      const f = fly(id, { receive: 'wall' });
      const walls = f.events.filter((e) => e.kind === 'glass' || e.kind === 'mesh');
      expect(walls.length, id).toBeGreaterThan(0);
      for (const w of walls) expect(w.z > 0.05 && w.z < 19.95, `${id} back wall`).toBe(true);
    }
  });
});

describe('Magnus effect and lost balls', () => {
  it('pulls a topspin ball down faster and lets a backspin ball float', () => {
    expect(magnus(shot('smash_x3'), 0, -1).g).toBeGreaterThan(GRAVITY + 2);
    expect(magnus(shot('rulo'), 0, -1).g).toBeGreaterThan(GRAVITY + 2);
    expect(magnus(shot('bandeja'), 0, -1).g).toBeLessThan(GRAVITY - 2);
    expect(magnus(shot('bajada_slow'), 0, -1).g).toBeLessThan(GRAVITY - 2);
  });

  it('bends the flight sideways with side spin, the other way for the other direction of travel', () => {
    const away = magnus(shot('vibora'), 0, -1);
    const toward = magnus(shot('vibora'), 0, 1);
    expect(Math.abs(away.lx)).toBeGreaterThan(1);
    expect(Math.sign(away.lx)).toBe(-Math.sign(toward.lx));
  });

  it('a topspin shot comes down steeper than the same ball without spin', () => {
    const top = shot('smash_x4');
    const plain = { ...top, flight: { ...top.flight, spin: 0, side: 0 } };
    const mk = (s: ShotDef) => buildFlight({ from: { x: -2.5, z: 17.5 }, startH: 1.8, hitterSide: 0, shot: s, landX: 1, outcome: 'continue' });
    const a = mk(top);
    const b = mk(plain);
    // the angle at which it arrives at the floor
    const angle = (f: ReturnType<typeof mk>) => {
      const t = f.events.find((e) => e.kind === 'bounce')!.t;
      const p1 = ballPoint(f.path, (t - 0.04) / f.duration);
      const p2 = ballPoint(f.path, t / f.duration);
      return p1.h - p2.h < 0 ? 0 : (p1.h - p2.h) / Math.hypot(p1.x - p2.x, p1.z - p2.z);
    };
    expect(angle(a)).toBeGreaterThan(angle(b));
  });

  it('ends a lost ball in the back glass (out) or in the mesh above it, without a bounce', () => {
    const g = fly('bajada_fast', { outcome: 'error', errorKind: 'glass' });
    const end = g.path[g.path.length - 1];
    expect(end.z).toBeLessThan(0.1);
    expect(end.h).toBeGreaterThan(0.3);
    expect(end.h).toBeLessThan(1.3); // low in the glass, not at the top
    expect(g.events.some((e) => e.kind === 'bounce' || e.kind === 'net')).toBe(false);
    const m = fly('rally_lob', { outcome: 'error', errorKind: 'mesh' });
    expect(m.path[m.path.length - 1].h).toBeGreaterThan(3.1);
    const c = buildCoast(g, 0.6);
    expect(c.events.some((e) => e.kind === 'glass')).toBe(true);
  });

  it('a ball aimed at the side that is lost goes straight into the side wall, without a bounce', () => {
    const f = fly('flat', { outcome: 'error', errorKind: 'side', landX: 4.4 });
    const end = f.path[f.path.length - 1];
    expect(Math.abs(end.x)).toBeGreaterThan(4.9);
    expect(end.z).toBeLessThan(10);
    expect(f.events.some((e) => e.kind === 'bounce' || e.kind === 'net')).toBe(false);
  });
});

describe('volley speed and the sweep of winners', () => {
  it('is faster from right at the net than from mid-court', () => {
    const v = shot('volley');
    const from = (z: number) => buildFlight({ from: { x: -2.5, z }, startH: 1.2, hitterSide: 0, shot: v, landX: 1, outcome: 'continue' });
    const net = from(12);
    const mid = from(14.5);
    const speedOf = (f: ReturnType<typeof from>) => {
      const p1 = ballPoint(f.path, 0.02);
      const p2 = ballPoint(f.path, 0.08);
      const dt = (0.06 * f.duration);
      return Math.hypot(p2.x - p1.x, p2.z - p1.z) / dt;
    };
    expect(speedOf(net)).toBeGreaterThan(speedOf(mid) * 1.1);
  });

  it('leaves no winner rolling to a stop outside the court unless a smash sent it over the fence', () => {
    const problems: string[] = [];
    for (const s of SHOTS) {
      if (s.kind === 'return') continue;
      for (const outcome of ['winner', 'ace'] as const) {
        if (s.kind === 'serve' && outcome === 'winner') continue;
        if (s.kind !== 'serve' && outcome === 'ace') continue;
        for (const hx of [-2.5, 2.5]) {
          for (const hitterSide of [0, 1] as const) {
            const f = buildFlight({ from: { x: hx, z: hitterSide === 0 ? 15 : 5 }, startH: 1.2, hitterSide, shot: s, landX: -hx, outcome, receive: 'wall', seed: 3 });
            const c = buildCoast(f, s.flight.spin);
            const end = c.path[c.path.length - 1];
            const outside = Math.abs(end.x) > 5.05 || end.z < -0.05 || end.z > 20.05;
            const leftOver = f.events.some((e) => e.kind === 'out') || c.events.length === 0 && false;
            if (outside && !leftOver && s.overFence !== true) problems.push(`${s.id}/${outcome}/${hitterSide}/${hx}: ${end.x.toFixed(1)},${end.z.toFixed(1)}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('glass rebound physics', () => {
  /** Horizontal and vertical speed of the ball just before and just after its first contact with the back glass. */
  function backGlassRebound(id: string, arrival: 'low' | 'mid' | 'high') {
    const f = buildFlight({
      from: { x: 1.5, z: 14 }, startH: 1.2, hitterSide: 0, shot: shot(id), landX: -1, outcome: 'continue', glass: true, arrival,
    });
    const g = f.events.find((e) => e.kind === 'glass' && (e.z < 0.1 || e.z > 19.9));
    if (!g) return null;
    const P = f.path;
    const i = P.findIndex((p) => p.t >= g.t - 1e-6);
    const v = (a: number, b: number) => {
      const dt = P[b].t - P[a].t;
      return { vh: Math.hypot(P[b].x - P[a].x, P[b].z - P[a].z) / dt, vy: (P[b].h - P[a].h) / dt };
    };
    return { pre: v(i - 6, i - 1), post: v(i + 1, i + 6) };
  }

  it('a fast ball comes off the back glass fast and at an angle, not slowly and straight up', () => {
    for (const id of ['bajada_fast', 'smash_x4', 'bounce_shot']) {
      for (const arrival of ['low', 'mid', 'high'] as const) {
        const r = backGlassRebound(id, arrival);
        expect(r, `${id} ${arrival}`).not.toBeNull();
        if (!r) continue;
        // keeps at least half of its horizontal speed, and never leaves steeper than about 45 degrees
        expect(r.post.vh, `${id} ${arrival} speed`).toBeGreaterThan(0.45 * r.pre.vh);
        expect(Math.atan2(r.post.vy, r.post.vh), `${id} ${arrival} angle`).toBeLessThan((46 * Math.PI) / 180);
      }
    }
  });

  it('the rebound class still decides how high the ball goes', () => {
    const peak = (arrival: 'low' | 'mid' | 'high'): number => {
      const f = buildFlight({
        from: { x: 1.5, z: 14 }, startH: 1.2, hitterSide: 0, shot: shot('bajada_fast'), landX: -1, outcome: 'continue', glass: true, arrival,
      });
      const g = f.events.find((e) => e.kind === 'glass')!;
      return Math.max(...f.path.filter((p) => p.t > g.t).map((p) => p.h));
    };
    expect(peak('mid')).toBeGreaterThan(peak('low') + 0.3);
    expect(peak('high')).toBeGreaterThan(peak('mid') + 0.5);
  });
});

describe('spin curvature', () => {
  /** Largest sideways distance of the flight (up to the first bounce) from the straight line start -> bounce. */
  function bow(id: string): number {
    const f = fly(id);
    const b = f.events.find((e) => e.kind === 'bounce')!;
    const a = f.path[0];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    let max = 0;
    for (const p of f.path) {
      if (p.t > b.t) break;
      max = Math.max(max, Math.abs(((b.x - a.x) * (a.z - p.z) - (a.x - p.x) * (b.z - a.z)) / len));
    }
    return max;
  }

  it('side-spin shots bend clearly (vibora, spin glass), flat shots hardly at all', () => {
    expect(bow('vibora')).toBeGreaterThan(0.4);
    expect(bow('flat')).toBeLessThan(0.1);
  });

  it('topspin dips steeper than backspin: effective gravity differs by a lot', () => {
    expect(magnus(shot('bajada_fast'), 0, -10).g).toBeGreaterThan(GRAVITY + 3);
    expect(magnus(shot('bandeja'), 0, -10).g).toBeLessThan(GRAVITY - 3);
  });
});

describe('Por Tres (smash x3) physics', () => {
  const x3 = shot('smash_x3');
  const speed = (P: Array<{ t: number; x: number; z: number; h: number }>, i: number, j: number): number => {
    const dt = P[j].t - P[i].t;
    return Math.hypot(P[j].x - P[i].x, P[j].z - P[i].z, P[j].h - P[i].h) / dt;
  };

  it('a winning Por Tres bounces, kicks off the back glass and leaves over the top of the side wall', () => {
    for (const hitterSide of [0, 1] as const) {
      for (const hx of [-2.5, 2.5]) {
        for (const landX of [-3.6, -2.5, 0, 2.5, 3.6]) {
          for (const startH of [1.5, 2.2]) {
            const label = `${hitterSide}/${hx}/${landX}/${startH}`;
            const f = buildFlight({ from: { x: hx, z: hitterSide === 0 ? 14 : 6 }, startH, hitterSide, shot: x3, landX, outcome: 'winner' });
            expect(f.events.map((e) => e.kind), label).toEqual(['bounce', 'glass', 'out']);
            const out = f.events[2];
            expect(Math.abs(out.x), label).toBeGreaterThanOrEqual(5 - 1e-6);
            expect(out.h, `${label} clears the glass`).toBeGreaterThan(2.5);
          }
        }
      }
    }
  });

  it('every surface takes some speed off the ball', () => {
    const f = buildFlight({ from: { x: -2.5, z: 14 }, startH: 2.2, hitterSide: 0, shot: x3, landX: -2.5, outcome: 'winner' });
    const P = f.path;
    const at = (kind: string): number => P.findIndex((p) => p.t >= f.events.find((e) => e.kind === kind)!.t - 1e-6);
    const bounce = at('bounce');
    const glass = at('glass');
    const hit = speed(P, 0, 3);
    const beforeFloor = speed(P, bounce - 4, bounce - 1);
    const afterFloor = speed(P, bounce + 1, bounce + 4);
    const beforeGlass = speed(P, glass - 4, glass - 1);
    const afterGlass = speed(P, glass + 1, glass + 4);
    expect(afterFloor).toBeLessThan(beforeFloor);
    expect(afterGlass).toBeLessThan(beforeGlass);
    expect(afterGlass).toBeLessThan(hit);
  });
});

describe('rebound back over the net', () => {
  it('the ball comes off the back wall and lands in the hitter own half', () => {
    const s = SHOTS.find((x) => x.id === 'hard_glass')!;
    for (const hs of [0, 1] as const) {
      const f = buildFlight({ from: { x: 1, z: hs === 0 ? 14 : 6 }, startH: 1.5, hitterSide: hs, shot: s, landX: 2, outcome: 'winner', reboundBack: true });
      const end = f.path[f.path.length - 1];
      expect(hs === 0 ? end.z > 10 : end.z < 10).toBe(true);
      expect(f.events.some((e) => e.kind === 'glass' || e.kind === 'mesh')).toBe(true);
    }
  });
});
