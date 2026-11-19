import { NET_Z } from '../game/court';
import type { CourtPos, Height, ReceiveMode, ShotDef, SideIndex } from '../game/types';
import { NET_HEIGHT_M } from './camera';
import { BACK_WALL, sideWallSegments } from './walls';

/**
 * Ball flight with real physics (pure, so it is testable). Metres and seconds; x across (-5..5),
 * z along the court (0 = far baseline, 20 = near baseline), h = height above the floor.
 *
 * Each shot is a ballistic arc from the racket to its first bounce (gravity, enough loft to clear the net,
 * a lob gets its tall arc from `flight.apex`). After the bounce the ball is simulated step by step:
 *  - floor: loses speed; topspin kicks it forward and up, backspin/slice makes it skid short and low;
 *  - glass: lively (keeps ~75% of its speed into the wall), mesh: dead (keeps ~30%);
 *  - the ball leaves the court if it goes over the top of a wall.
 * The player who has to play the ball hits it where it comes down to hitting height, after the bounce, or
 * after the first wall when the shot (or the serve choice) says so. That spot is `Flight.hit`.
 */
export interface Sample {
  /** Seconds since the racket touched the ball. */
  t: number;
  x: number;
  z: number;
  h: number;
}

export type FlightEventKind = 'bounce' | 'glass' | 'mesh' | 'net' | 'out';

export interface FlightEvent {
  kind: FlightEventKind;
  t: number;
  x: number;
  z: number;
  h: number;
}

export type FlightOutcome =
  | 'fault'
  | 'double-fault'
  | 'ace'
  | 'in'
  | 'error'
  | 'winner'
  | 'intercept'
  | 'continue';

export interface FlightOpts {
  from: CourtPos;
  /** Height of the ball when it is hit. Default: waist height (serves). */
  startH?: number;
  hitterSide: SideIndex;
  shot: ShotDef;
  /** x where the ball first lands in the opponent's court. */
  landX: number;
  outcome: FlightOutcome;
  /** For a serve to the side glass: take it after the bounce or after the glass. Default 'wall'. */
  receive?: ReceiveMode;
}

export interface Flight {
  path: Sample[];
  /** Where the ball is hit next (on the opponent's side). On a fault or an error there is no hit. */
  hit: CourtPos;
  /** Height of the ball at that moment: it is also the height the next shot starts from. */
  hitH: number;
  events: FlightEvent[];
  /** Real duration in seconds. */
  duration: number;
}

export const HIT_HEIGHT_M = 0.9;
/** Height at which the next player meets the ball, by the height class of the shot (ball LOW / MID / HIGH). */
export const ARRIVAL_HEIGHT: Record<Height, number> = { high: 2.0, mid: 1.0, low: 0.5 };

export const GRAVITY = 9.81;
const DT = 1 / 90;
const MAX_TIME = 6;
/** The ball must pass the net at least this much above its top edge. */
const NET_CLEARANCE = 0.15;

// Floor: vertical bounciness and how much horizontal speed is kept, before spin.
const FLOOR_E = 0.76;
const FLOOR_KEEP = 0.5;
/** Air drag after the bounce: a padel ball is light and slows quickly (fraction of speed lost per second). */
const AIR_DRAG = 0.35;
// Walls: glass is lively, mesh is dead. Keep = fraction of the speed along the wall (friction).
const GLASS_E = 0.75;
const GLASS_KEEP = 0.92;
const MESH_E = 0.3;
const MESH_KEEP = 0.65;
const WALL_VERTICAL_KEEP = 0.9;

/** A ball that does not come down to hitting height is played at this share of its highest point, but not lower than this. */
const PLAY_FRACTION = 0.7;
const MIN_PLAY_HEIGHT = 0.3;

/** Players are never further than this from a wall when they hit. */
const WALL_MARGIN = 0.4;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

interface Vec {
  x: number;
  z: number;
  h: number;
}

interface Arc {
  /** Flight time in seconds. */
  T: number;
  vx: number;
  vz: number;
  vy: number;
}

/** Ballistic arc from `from` (at height h0) to the floor at `to`, as fast as `speed` allows while still clearing the net. */
function solveArc(from: Vec, to: { x: number; z: number }, speed: number, apex: number): Arc {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  let T = Math.max(Math.hypot(dx, dz) / speed, 0.2);

  // Enough loft to clear the net.
  const f = dz !== 0 ? (NET_Z - from.z) / dz : -1;
  if (f > 0.02 && f < 0.98) {
    const need = NET_HEIGHT_M + NET_CLEARANCE - from.h * (1 - f);
    if (need > 0) T = Math.max(T, Math.sqrt((2 * need) / (GRAVITY * f * (1 - f))));
  }
  // A lob: arc at least `apex` metres high (apex above the chord is about g T^2 / 8).
  if (apex > 0) T = Math.max(T, Math.sqrt((8 * apex) / GRAVITY));
  T = Math.min(T, 3.5);

  return { T, vx: dx / T, vz: dz / T, vy: -from.h / T + 0.5 * GRAVITY * T };
}

function arcPoint(from: Vec, a: Arc, t: number): Vec {
  return {
    x: from.x + a.vx * t,
    z: from.z + a.vz * t,
    h: Math.max(0, from.h + a.vy * t - 0.5 * GRAVITY * t * t),
  };
}

/** What is hit when the ball reaches a wall at this height: glass, mesh, or nothing (it flies out). */
function sideWallMaterial(z: number, h: number): 'glass' | 'mesh' | 'out' {
  const zz = clamp(z, 0, 20);
  const seg = sideWallSegments().find((s) => zz >= s.z0 && zz <= s.z1) ?? sideWallSegments()[0];
  if (h < seg.glass) return 'glass';
  if (h < seg.glass + seg.mesh) return 'mesh';
  return 'out';
}

function backWallMaterial(h: number): 'glass' | 'mesh' | 'out' {
  if (h < BACK_WALL.glass) return 'glass';
  if (h < BACK_WALL.glass + BACK_WALL.mesh) return 'mesh';
  return 'out';
}

interface SimOpts {
  shot: ShotDef;
  /** Hitting height the player meets the ball at. */
  hitHeight: number;
  /** Whether the ball has to touch a wall before it is played. */
  needWall: boolean;
  /** A winning rulo flies out over the fence instead of staying in play. */
  exitOverFence: boolean;
}

/** Simulates the ball from its first bounce on. Returns samples, events and where it is played. */
function simulateAfterBounce(
  start: { x: number; z: number; vx: number; vz: number; vy: number },
  t0: number,
  o: SimOpts,
): { samples: Sample[]; events: FlightEvent[]; hitIndex: number; end: number } {
  const { spin, wallKick } = o.shot.flight;
  const keep = clamp(FLOOR_KEEP + 0.14 * spin, 0.4, 0.95);
  const restitution = clamp(FLOOR_E + 0.05 * spin, 0.6, 0.8);

  const samples: Sample[] = [];
  const events: FlightEvent[] = [];
  let { x, z } = start;
  let h = 0;
  let { vx, vz, vy } = start;
  let t = t0;
  let bounces = 0;
  let kicked = false;

  const floorBounce = (): void => {
    h = 0;
    vy = -vy * restitution;
    vx *= keep;
    vz *= keep;
    bounces++;
    events.push({ kind: 'bounce', t, x, z, h: 0 });
  };
  samples.push({ t, x, z, h: 0 });
  floorBounce();

  const crossings: number[] = [];
  let firstContact = -1;
  let end = -1;

  for (let i = 0; i < MAX_TIME / DT; i++) {
    const prevH = h;
    vx *= 1 - AIR_DRAG * DT;
    vz *= 1 - AIR_DRAG * DT;
    vy -= GRAVITY * DT;
    x += vx * DT;
    z += vz * DT;
    h += vy * DT;
    t += DT;

    if (h <= 0 && vy < 0) {
      x = clamp(x, -5, 5);
      z = clamp(z, 0, 20);
      floorBounce();
      samples.push({ t, x, z, h: 0 });
      if (bounces >= 2) {
        end = samples.length - 1;
        break;
      }
      continue;
    }

    // Side walls
    if (Math.abs(x) >= 5) {
      const mat = sideWallMaterial(z, h);
      const sign = Math.sign(x);
      if (mat === 'out' || (mat === 'mesh' && o.exitOverFence)) {
        x = sign * 5;
        samples.push({ t, x, z, h });
        events.push({ kind: 'out', t, x, z, h });
        end = samples.length - 1;
        break;
      }
      x = sign * 5;
      const glass = mat === 'glass';
      vx = -vx * (glass ? GLASS_E : MESH_E);
      const along = (glass ? GLASS_KEEP : MESH_KEEP) * (kicked ? 1 : wallKick);
      vz *= along;
      vy *= WALL_VERTICAL_KEEP * (glass ? 1 : 0.7);
      kicked = true;
      if (firstContact < 0) firstContact = samples.length;
      events.push({ kind: mat, t, x, z, h });
    }
    // Back walls (both ends)
    if (z <= 0 || z >= 20) {
      const mat = backWallMaterial(h);
      if (mat === 'out' || (mat === 'mesh' && o.exitOverFence)) {
        z = z <= 0 ? 0 : 20;
        samples.push({ t, x, z, h });
        events.push({ kind: 'out', t, x, z, h });
        end = samples.length - 1;
        break;
      }
      z = z <= 0 ? 0 : 20;
      const glass = mat === 'glass';
      vz = -vz * (glass ? GLASS_E : MESH_E);
      // Backspin makes the ball die against the back glass; topspin keeps it lively.
      const spinKeep = clamp(1 + 0.25 * o.shot.flight.spin, 0.5, 1.2);
      vx *= (glass ? GLASS_KEEP : MESH_KEEP) * (kicked ? 1 : wallKick);
      vy *= WALL_VERTICAL_KEEP * (glass ? 1 : 0.7) * Math.min(1, spinKeep);
      kicked = true;
      if (firstContact < 0) firstContact = samples.length;
      events.push({ kind: mat, t, x, z, h });
    }

    samples.push({ t, x, z, h });
    const idx = samples.length - 1;
    if (vy < 0 && prevH >= o.hitHeight && h < o.hitHeight) crossings.push(idx);
  }
  if (end < 0) end = samples.length - 1;

  // Choose where the ball is played. Without a wall the player takes it before the ball reaches the glass;
  // with a wall, after the first contact. Within that window: where it comes down to hitting height,
  // else its highest point (a dying ball is played at the top of its bounce).
  const lastIndex = Math.max(1, end - (samples[end].h <= 0 ? 1 : 0));
  let from = 1;
  let to = lastIndex;
  if (firstContact >= 0 && firstContact <= lastIndex) {
    if (o.needWall) from = firstContact;
    else to = Math.max(1, firstContact - 1);
  }
  let hitIndex = -1;
  for (const c of crossings) {
    if (c >= from && c <= to) {
      hitIndex = c;
      break;
    }
  }
  if (hitIndex < 0) {
    // The ball never comes down through hitting height: play it on the way down from its highest point
    // (at 70% of that height, but not lower than knee height), or at the top if it dies there.
    let apex = from;
    for (let i = from; i <= to; i++) if (samples[i].h > samples[apex].h) apex = i;
    const level = Math.max(MIN_PLAY_HEIGHT, PLAY_FRACTION * samples[apex].h);
    hitIndex = apex;
    for (let i = apex + 1; i <= to; i++) {
      if (samples[i].h <= level) {
        hitIndex = i;
        break;
      }
    }
  }
  return { samples, events, hitIndex, end };
}

/** Where a ball can be played, kept inside the court and on the receiving half. */
function clampHit(p: Vec, hitterSide: SideIndex): Vec {
  const x = clamp(p.x, -5 + WALL_MARGIN, 5 - WALL_MARGIN);
  const z =
    hitterSide === 0
      ? clamp(p.z, WALL_MARGIN, NET_Z - 0.5)
      : clamp(p.z, NET_Z + 0.5, 20 - WALL_MARGIN);
  return { x, z, h: p.h };
}

export function buildFlight(o: FlightOpts): Flight {
  // Direction of travel along z: the near team (side 0) hits towards z = 0.
  const away = o.hitterSide === 0 ? -1 : 1;
  const h0 = o.startH ?? HIT_HEIGHT_M;
  const from: Vec = { x: o.from.x, z: o.from.z, h: h0 };
  const fl = o.shot.flight;
  const path: Sample[] = [];
  const events: FlightEvent[] = [];

  const sampleArc = (origin: Vec, a: Arc, t0: number): void => {
    const steps = Math.max(2, Math.ceil(a.T / DT));
    for (let i = 0; i <= steps; i++) {
      const t = (a.T * i) / steps;
      const p = arcPoint(origin, a, t);
      path.push({ t: t0 + t, x: p.x, z: p.z, h: p.h });
    }
  };

  // A fault or an unforced error: the ball dies in the net.
  if (o.outcome === 'fault' || o.outcome === 'double-fault' || o.outcome === 'error') {
    const x = (o.from.x + o.landX) / 2;
    const netZ = NET_Z - away * 0.1;
    const dist = Math.hypot(x - from.x, netZ - from.z);
    const T = Math.max(0.25, dist / fl.speed);
    const targetH = 0.55;
    const a: Arc = {
      T,
      vx: (x - from.x) / T,
      vz: (netZ - from.z) / T,
      vy: (targetH - from.h) / T + 0.5 * GRAVITY * T,
    };
    const steps = Math.max(2, Math.ceil(T / DT));
    for (let i = 0; i <= steps; i++) {
      const t = (T * i) / steps;
      path.push({
        t,
        x: from.x + a.vx * t,
        z: from.z + a.vz * t,
        h: Math.max(0, from.h + a.vy * t - 0.5 * GRAVITY * t * t),
      });
    }
    events.push({ kind: 'net', t: T, x, z: netZ, h: targetH });
    // Drops down on the hitter's side of the net.
    const fall = Math.sqrt((2 * targetH) / GRAVITY);
    for (let i = 1; i <= 8; i++) {
      const u = (fall * i) / 8;
      path.push({ t: T + u, x, z: netZ - away * 0.05 * (i / 8), h: Math.max(0, targetH - 0.5 * GRAVITY * u * u) });
    }
    const end = path[path.length - 1];
    return { path, hit: { x: end.x, z: end.z }, hitH: 0, events, duration: end.t };
  }

  // In play: ballistic arc to the first bounce, then the simulation.
  const land = { x: o.landX, z: NET_Z + away * o.shot.landDepth };
  const arc = solveArc(from, land, fl.speed, fl.apex);
  sampleArc(from, arc, 0);
  const touch = { x: land.x, z: land.z, vx: arc.vx, vz: arc.vz, vy: arc.vy - GRAVITY * arc.T };

  const isServe = o.shot.kind === 'serve';
  // Serves: the receiver chooses (bounce or glass) when the serve goes to the glass. Rally balls that reach a wall
  // are played after it, because a ball that is about to hit the glass cannot be taken before it.
  const needWall = isServe ? o.shot.wall !== 'none' && o.receive !== 'bounce' : true;
  const sim = simulateAfterBounce(touch, arc.T, {
    shot: o.shot,
    hitHeight: ARRIVAL_HEIGHT[o.shot.out],
    needWall,
    exitOverFence: o.shot.wall === 'fence' && o.outcome === 'winner',
  });
  events.push({ kind: 'bounce', t: arc.T, x: land.x, z: land.z, h: 0 });
  for (const e of sim.events.slice(1)) events.push(e);

  const winning = o.outcome === 'ace' || o.outcome === 'winner';
  const natural = sim.samples[sim.hitIndex];
  const hit = clampHit(natural, o.hitterSide);

  // Samples up to the hit (or to the end for a winner: the ball flies on past the defender).
  const last = winning ? sim.end : sim.hitIndex;
  for (let i = 1; i <= last; i++) path.push(sim.samples[i]);
  if (!winning) {
    path[path.length - 1] = { t: natural.t, x: hit.x, z: hit.z, h: hit.h };
  }

  if (o.outcome === 'intercept') {
    // The defender turns it around, hard and flat, past the original hitter.
    const origin: Vec = { x: hit.x, z: hit.z, h: hit.h };
    const back = { x: o.from.x * 0.6, z: NET_Z - away * 7 };
    const ret = solveArc(origin, back, 22, 0);
    const t0 = path[path.length - 1].t;
    const n = Math.max(2, Math.ceil(ret.T / DT));
    for (let i = 1; i <= n; i++) {
      const t = (ret.T * i) / n;
      const p = arcPoint(origin, ret, t);
      path.push({ t: t0 + t, x: p.x, z: p.z, h: p.h });
    }
    events.push({ kind: 'bounce', t: t0 + ret.T, x: back.x, z: back.z, h: 0 });
  }

  const end = path[path.length - 1];
  const seen = events.filter((e) => e.t <= end.t + 1e-9);
  return { path, hit: { x: hit.x, z: hit.z }, hitH: winning ? hit.h : end.h, events: seen, duration: end.t };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Position of the ball at u (0..1) of the flight (real time, scaled to the animation). */
export function ballPoint(path: Sample[], u: number): { x: number; z: number; h: number } {
  const first = path[0];
  const last = path[path.length - 1];
  if (path.length < 2 || last.t <= 0) return { x: first.x, z: first.z, h: first.h };
  const t = clamp(u, 0, 1) * last.t;
  // Samples are evenly spaced in time, so the index can be estimated, then corrected.
  let i = clamp(Math.floor((t / last.t) * (path.length - 1)), 0, path.length - 2);
  while (i > 0 && path[i].t > t) i--;
  while (i < path.length - 2 && path[i + 1].t < t) i++;
  const a = path[i];
  const b = path[i + 1];
  const span = b.t - a.t;
  const k = span > 0 ? clamp((t - a.t) / span, 0, 1) : 1;
  return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), h: lerp(a.h, b.h, k) };
}

/** Animation speed relative to real time: the game should feel quick. */
export const TIME_SCALE = 0.4;

/** How long a flight takes on screen, in milliseconds. */
export function flightDuration(flight: Flight): number {
  return clamp(flight.duration * TIME_SCALE * 1000, 280, 1400);
}
