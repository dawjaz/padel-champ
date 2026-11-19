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
  /** Seed for the unpredictable bounce off the mesh (rulo). Visual only: the game outcome never depends on it. */
  seed?: number;
  /** Where the ball first lands, metres past the net (overrides the shot's own depth: a weak lob lands short). */
  landDepth?: number;
  /**
   * Rally balls: true = the ball is played after it has come off the back glass; false = before any wall.
   * Left out, the ball is played after the first wall it touches (the old behaviour).
   */
  glass?: boolean;
  /** Height class the ball is played at (after the glass: how high it rebounds). Default: the shot's own `out`. */
  arrival?: Height;
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

/** How high the ball rises after the back glass, by rebound class (metres): low / medium / high rebound. */
export const REBOUND_PEAK: Record<Height, number> = { low: 0.75, mid: 1.5, high: 2.6 };

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
  /** A winning rulo or smash flies out over the fence instead of staying in play. */
  exitOverFence: boolean;
  /** Extra liveliness of the floor bounce and the wall kick (1 = normal): a winning smash is hit with more spin and pace. */
  boost?: number;
  /** Random numbers for the unpredictable bounce off the mesh. */
  rand: () => number;
  /** Rulo: the ball bounces beside the side fence and hits the mesh; the bounce off the mesh is unpredictable. */
  rulo: boolean;
  /** Keeps the ball on the receiving half (only used while a rulo bounces unpredictably). */
  zRange?: [number, number];
  /** The ball is played after the back glass (not just any wall). */
  backGlass?: boolean;
  /** Highest point of the rebound off the back glass (steers the rebound to low, medium or high). */
  reboundPeak?: number;
  /** Extra carry of the first bounce so that the ball really reaches the back glass. */
  carry?: number;
}

/** Small seeded generator (mulberry32) so a flight is reproducible for a seed. */
function makeRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simulates the ball from its first bounce on. Returns samples, events and where it is played. */
function simulateAfterBounce(
  start: { x: number; z: number; vx: number; vz: number; vy: number },
  t0: number,
  o: SimOpts,
): { samples: Sample[]; events: FlightEvent[]; hitIndex: number; end: number; backContact: number } {
  const { spin, wallKick } = o.shot.flight;
  const boost = o.boost ?? 1;
  const keep = clamp(FLOOR_KEEP + 0.14 * spin, 0.4, 0.95);
  const restitution = clamp(FLOOR_E + 0.05 * spin, 0.6, 0.8) * boost;
  const kick = wallKick * (1 + (boost - 1) * 1.5);

  const samples: Sample[] = [];
  const events: FlightEvent[] = [];
  let { x, z } = start;
  let h = 0;
  let { vx, vz, vy } = start;
  let t = t0;
  let bounces = 0;
  let kicked = false;
  let climbing = false;
  let chaos = false;
  let backContact = -1;

  const floorBounce = (): void => {
    h = 0;
    vy = -vy * restitution;
    const k = bounces === 0 ? Math.min(keep * (o.carry ?? 1), 1.2) : keep;
    vx *= k;
    vz *= k;
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
      const meshHit = mat === 'mesh';
      if (o.rulo && o.exitOverFence && meshHit && !climbing && h < 2.2) {
        // A clean winning rulo: the topspin ball climbs the fence and goes out over the top.
        climbing = true;
        x = sign * 5;
        vx = 0;
        vy = Math.max(vy, 8.5);
        vz *= 0.6;
        if (firstContact < 0) firstContact = samples.length;
        events.push({ kind: 'mesh', t, x, z, h });
      } else if (climbing && mat !== 'out') {
        x = sign * 4.98;
        vx = sign * 0.5;
        vz = 0;
      } else if (mat === 'out' || (meshHit && o.exitOverFence && !o.rulo)) {
        x = sign * 5;
        samples.push({ t, x, z, h });
        events.push({ kind: 'out', t, x, z, h });
        end = samples.length - 1;
        break;
      } else if (o.rulo && meshHit && !chaos) {
        // A rulo that stays in play: the ball hits the loose mesh and comes off it unpredictably
        // (slowly, sideways, sometimes back towards the hitter), never like off the glass.
        chaos = true;
        x = sign * 5;
        const r1 = o.rand();
        const r2 = o.rand();
        const r3 = o.rand();
        vx = -vx * (0.1 + 0.8 * r1);
        vz *= -0.5 + 1.6 * r2;
        vy = vy * 0.5 + 0.8 + 3.2 * r3;
        kicked = true;
        if (firstContact < 0) firstContact = samples.length;
        events.push({ kind: 'mesh', t, x, z, h });
      } else {
        x = sign * 5;
        const glass = mat === 'glass';
        vx = -vx * (glass ? GLASS_E : MESH_E);
        const along = (glass ? GLASS_KEEP : MESH_KEEP) * (kicked ? 1 : kick);
        vz *= along;
        vy *= WALL_VERTICAL_KEEP * (glass ? 1 : 0.7);
        kicked = true;
        if (firstContact < 0) firstContact = samples.length;
        events.push({ kind: mat, t, x, z, h });
      }
    }
    if (chaos && o.zRange) {
      if (z < o.zRange[0]) {
        z = o.zRange[0];
        vz = Math.abs(vz) * 0.3;
      } else if (z > o.zRange[1]) {
        z = o.zRange[1];
        vz = -Math.abs(vz) * 0.3;
      }
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
      vx *= (glass ? GLASS_KEEP : MESH_KEEP) * (kicked ? 1 : kick);
      if (o.reboundPeak !== undefined && glass && backContact < 0 && !o.exitOverFence) {
        // The rebound off the back glass is low, medium or high: steer it to the chosen peak.
        vy = Math.sqrt(2 * GRAVITY * Math.max(o.reboundPeak - h, 0.05));
      } else {
        vy *= WALL_VERTICAL_KEEP * (glass ? 1 : 0.7) * Math.min(1, spinKeep);
      }
      kicked = true;
      if (backContact < 0) backContact = samples.length;
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
  if (o.needWall && o.backGlass && backContact >= 0 && backContact <= lastIndex) {
    from = backContact;
  } else if (firstContact >= 0 && firstContact <= lastIndex) {
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
  return { samples, events, hitIndex, end, backContact };
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

  // A fault or an unforced error: the ball dies in the net. A rulo that is not hit cleanly goes straight into the
  // side mesh instead (no bounce first) and drops down dead.
  if (o.outcome === 'fault' || o.outcome === 'double-fault' || o.outcome === 'error') {
    const fence = o.shot.wall === 'fence' && o.outcome === 'error';
    const wallSign = o.landX < 0 ? -1 : 1;
    const x = fence ? wallSign * 5 : (o.from.x + o.landX) / 2;
    const tz = fence ? NET_Z + away * Math.min(o.shot.landDepth, 6) : NET_Z - away * 0.1;
    const dist = Math.hypot(x - from.x, tz - from.z);
    const T = Math.max(0.25, dist / fl.speed);
    const targetH = fence ? 1.4 : 0.55;
    const a: Arc = {
      T,
      vx: (x - from.x) / T,
      vz: (tz - from.z) / T,
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
    events.push({ kind: fence ? 'mesh' : 'net', t: T, x, z: tz, h: targetH });
    // Drops down dead: on the hitter's side of the net, or along the mesh.
    const fall = Math.sqrt((2 * targetH) / GRAVITY);
    for (let i = 1; i <= 8; i++) {
      const u = (fall * i) / 8;
      path.push({
        t: T + u,
        x: fence ? x - wallSign * 0.15 * (i / 8) : x,
        z: fence ? tz : tz - away * 0.05 * (i / 8),
        h: Math.max(0, targetH - 0.5 * GRAVITY * u * u),
      });
    }
    const end = path[path.length - 1];
    return { path, hit: { x: end.x, z: end.z }, hitH: 0, events, duration: end.t };
  }

  // In play: ballistic arc to the first bounce, then the simulation.
  // A winning smash x4 that is meant to clear the back glass is not aimed so close to the side glass that it hits that first.
  const toBack = (o.outcome === 'winner' || o.outcome === 'ace') && o.shot.overFence === true && o.shot.exitVia === 'back';
  const depth = o.landDepth ?? o.shot.landDepth;
  const land = { x: toBack ? clamp(o.landX, -2.6, 2.6) : o.landX, z: NET_Z + away * depth };
  const arc = solveArc(from, land, fl.speed, fl.apex);
  sampleArc(from, arc, 0);
  const touch = { x: land.x, z: land.z, vx: arc.vx, vz: arc.vz, vy: arc.vy - GRAVITY * arc.T };

  const isServe = o.shot.kind === 'serve';
  const rulo = o.shot.wall === 'fence';
  const rand = makeRand(o.seed ?? Math.round(Math.abs(o.from.x * 977 + o.from.z * 313 + o.landX * 131) * 1000) + 7);
  // Serves: the receiver chooses (bounce or glass) when the serve goes to the glass. Rally balls that reach a wall
  // are played after it, because a ball that is about to hit the glass cannot be taken before it.
  const needWall = isServe ? o.shot.wall !== 'none' && o.receive !== 'bounce' : o.glass ?? true;
  const backGlass = !isServe && o.glass === true;
  const arrival = o.arrival ?? o.shot.out;
  const hitHeight = ARRIVAL_HEIGHT[arrival];
  const winning = o.outcome === 'ace' || o.outcome === 'winner';
  const exits = winning && (o.shot.wall === 'fence' || o.shot.overFence === true);
  const run = (boost: number, carry = 1): ReturnType<typeof simulateAfterBounce> =>
    simulateAfterBounce(touch, arc.T, {
      shot: o.shot,
      hitHeight,
      needWall,
      exitOverFence: exits,
      boost,
      rand,
      rulo,
      zRange: rulo ? (o.hitterSide === 0 ? [0.4, NET_Z - 0.8] : [NET_Z + 0.8, 19.6]) : undefined,
      backGlass,
      reboundPeak: backGlass ? REBOUND_PEAK[arrival] : undefined,
      carry,
    });
  let sim = run(1);
  // A ball that must come off the back glass has to reach it: give the first bounce more carry if it falls short.
  if (backGlass && sim.backContact < 0) {
    for (const carry of [1.25, 1.5, 1.8, 2.2, 2.8]) {
      const r = run(1, carry);
      sim = r;
      if (r.backContact >= 0) break;
    }
  }
  // A winning smash is hit hard enough to leave the court: spin it up until it really flies out, preferably the
  // way the shot is meant to (x4 over the back glass, x3 over the side glass or mesh), else any way.
  if (exits && o.shot.overFence === true) {
    const exitOf = (r: typeof sim): FlightEvent | undefined => r.events.find((e) => e.kind === 'out');
    const wanted = (r: typeof sim): boolean => {
      const e = exitOf(r);
      if (!e || !o.shot.exitVia) return e !== undefined;
      const side = Math.abs(e.x) >= 5;
      if (o.shot.exitVia === 'side') return side;
      // over the back glass at the far end (not after a rebound over the hitter's own end)
      const far = o.hitterSide === 0 ? e.z <= 0.01 : e.z >= 19.99;
      return !side && far;
    };
    let fallback = exitOf(sim) ? sim : null;
    if (!wanted(sim)) {
      for (const boost of [1.1, 1.2, 1.35, 1.5, 1.7, 1.9, 2.2, 2.6, 3.2]) {
        const r = run(boost);
        if (wanted(r)) {
          sim = r;
          fallback = null;
          break;
        }
        if (!fallback && exitOf(r)) fallback = r;
      }
      if (fallback) sim = fallback;
    }
  }
  events.push({ kind: 'bounce', t: arc.T, x: land.x, z: land.z, h: 0 });
  for (const e of sim.events.slice(1)) events.push(e);

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

/** Rolling resistance of the court floor (m/s^2) and of the ground outside it. */
const ROLL_DECEL = 1.1;
const OUTSIDE_ROLL_DECEL = 2.2;
/** Below this vertical speed after a bounce the ball stops bouncing and rolls. */
const ROLL_VY = 1.2;
const COAST_MAX_TIME = 5;

export interface Coast {
  /** Samples, t = 0 at the end of the flight. */
  path: Sample[];
  events: FlightEvent[];
  duration: number;
}

/**
 * After the point is over the ball is not stopped: it carries on freely from where the flight ended, with the
 * velocity it had then. It falls, bounces on the floor (less each time; topspin keeps more speed forward,
 * backspin kills it), hits glass, mesh or the net when it is still inside the court, flies on when it left over
 * the fence, and finally rolls to a stop. `spin` is the shot's spin (+ topspin, - backspin).
 */
export function buildCoast(flight: Flight, spin: number): Coast {
  const path = flight.path;
  const n = path.length;
  const last = path[n - 1];
  const prev = path[Math.max(0, n - 2)];
  const dt = last.t - prev.t;
  const start: Sample = { t: 0, x: last.x, z: last.z, h: last.h };
  if (n < 2 || dt <= 0) return { path: [start], events: [], duration: 0 };

  let x = last.x;
  let z = last.z;
  let h = last.h;
  let vx = (last.x - prev.x) / dt;
  let vz = (last.z - prev.z) / dt;
  let vy = (last.h - prev.h) / dt;
  let inside = Math.abs(x) <= 5 + 1e-6 && z >= -1e-6 && z <= 20 + 1e-6 && flight.events.every((e) => e.kind !== 'out');
  let rolling = false;
  const e = clamp(0.62 + 0.04 * spin, 0.5, 0.7);
  const keep = clamp(0.62 + 0.14 * spin, 0.35, 0.9);

  const samples: Sample[] = [start];
  const events: FlightEvent[] = [];
  let t = 0;
  for (let i = 0; i < COAST_MAX_TIME / DT; i++) {
    const speed = Math.hypot(vx, vz);
    if (rolling && speed < 0.05) break;
    t += DT;
    const pz = z;
    if (!rolling) {
      vx *= 1 - AIR_DRAG * DT;
      vz *= 1 - AIR_DRAG * DT;
      vy -= GRAVITY * DT;
      h += vy * DT;
    } else {
      const decel = (inside ? ROLL_DECEL : OUTSIDE_ROLL_DECEL) * DT;
      const f = Math.max(0, 1 - decel / Math.max(speed, 1e-6));
      vx *= f;
      vz *= f;
    }
    x += vx * DT;
    z += vz * DT;

    if (inside) {
      // The net stops a low ball.
      if (((pz - NET_Z) * (z - NET_Z) < 0 || Math.abs(z - NET_Z) < 0.02) && h < NET_HEIGHT_M) {
        z = pz;
        vz *= -0.2;
        vx *= 0.5;
        events.push({ kind: 'net', t, x, z, h });
      }
      if (Math.abs(x) >= 5) {
        const mat = sideWallMaterial(z, h);
        if (mat === 'out') inside = false;
        else {
          const glass = mat === 'glass';
          x = Math.sign(x) * 5;
          vx = -vx * (glass ? GLASS_E : MESH_E);
          vz *= glass ? GLASS_KEEP : MESH_KEEP;
          vy *= glass ? 1 : 0.7;
          rolling = false;
          events.push({ kind: mat, t, x, z, h });
        }
      }
      if (inside && (z <= 0 || z >= 20)) {
        const mat = backWallMaterial(h);
        if (mat === 'out') inside = false;
        else {
          const glass = mat === 'glass';
          z = z <= 0 ? 0 : 20;
          vz = -vz * (glass ? GLASS_E : MESH_E);
          vx *= glass ? GLASS_KEEP : MESH_KEEP;
          vy *= glass ? 1 : 0.7;
          rolling = false;
          events.push({ kind: mat, t, x, z, h });
        }
      }
    }

    if (!rolling && h <= 0 && vy < 0) {
      h = 0;
      vy = -vy * e;
      vx *= keep;
      vz *= keep;
      events.push({ kind: 'bounce', t, x, z, h: 0 });
      if (vy < ROLL_VY) {
        vy = 0;
        rolling = true;
      }
    }
    samples.push({ t, x, z, h });
  }
  return { path: samples, events, duration: t };
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
export const TIME_SCALE = 0.62;

/** How long a flight takes on screen, in milliseconds. */
export function flightDuration(flight: Flight): number {
  return clamp(flight.duration * TIME_SCALE * 1000, 450, 2000);
}
