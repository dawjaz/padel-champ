import { NET_Z } from '../game/court';
import type { CourtPos, ErrorKind, Height, ReceiveMode, ShotDef, SideIndex } from '../game/types';
import { NET_HEIGHT_M } from './camera';
import { BACK_WALL, sideWallHeightAt, sideWallSegments } from './walls';

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
  /** A defender at the net blocks the ball out of the air in front of him, before it bounces. */
  block?: boolean;
  /** A weak lob: the defender hits it out of the air (smash, vibora, bandeja) instead of letting it bounce. */
  airHit?: boolean;
  /** How a lost ball ends (fault or error): the net, the back glass without a bounce, or the mesh above the glass. */
  errorKind?: ErrorKind;
  /** Height class the ball is played at (after the glass: how high it rebounds). Default: the shot's own `out`. */
  arrival?: Height;
  /** A winner that comes off the back glass or fence and flies back over the net into the hitter's own half. */
  reboundBack?: boolean;
  /** Pace of this hit relative to the shot's usual speed (1 = as usual): harder off a high ball, slower off a low one. */
  speedMul?: number;
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
/** No shot is faster than this (m/s): about 125 km/h, a hard smash. */
const MAX_SHOT_SPEED = 35;
const DT = 1 / 90;
const MAX_TIME = 6;
/** The ball must pass the net at least this much above its top edge. */
const NET_CLEARANCE = 0.15;

// Floor: vertical bounciness and how much horizontal speed is kept, before spin.
const FLOOR_E = 0.76;
const FLOOR_KEEP = 0.55;
/** Air drag after the bounce: a padel ball is light and slows quickly (fraction of speed lost per second). */
const AIR_DRAG = 0.35;
// Walls: glass is lively, mesh is dead. Keep = fraction of the speed along the wall (friction).
const GLASS_E = 0.76;
const GLASS_KEEP = 0.92;
/** Friction between the ball and the glass: tangential impulse per unit of normal impulse (rubber on glass). */
const GLASS_MU = 0.35;
/** Speed of the ball surface at the contact per unit of `spin` (m/s): about 2500 rpm x ball radius is 8.8 m/s. */
const SPIN_SURFACE = 7;
/** The spin of a ball in flight fades slowly (fraction lost per second); a floor bounce takes a good part of it. */
const SPIN_DECAY = 0.3;
const FLOOR_SPIN_KEEP = 0.6;
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
  /** Effective gravity: topspin pulls the ball down faster, backspin keeps it up (Magnus effect). */
  g: number;
  /** Sideways acceleration from side spin (m/s^2); the path bows out and back to the aim point. */
  lx: number;
  lz: number;
}

/**
 * The Magnus effect on a shot. A padel ball spins at 20-40 rev/s and flies at 15-30 m/s: the force of a topspin shot is
 * about 0.3-0.5 g downwards (it dips steeply and kicks), a slice or backspin lifts it by a similar amount (it floats, stays
 * flatter and travels further), and side spin bends the flight by half a metre or more over a court length.
 */
export const MAGNUS_LIFT = 9;
export const MAGNUS_SIDE = 9;
export function magnus(shot: ShotDef, dx: number, dz: number): { g: number; lx: number; lz: number } {
  const f = shot.flight.speed / 25;
  const g = clamp(GRAVITY + MAGNUS_LIFT * shot.flight.spin * f, 5.5, 19);
  const len = Math.hypot(dx, dz) || 1;
  const a = MAGNUS_SIDE * shot.flight.side * f;
  // the force is w x v: for side spin w = (0, -side, 0) it points along (-dz, dx)
  return { g, lx: (-dz / len) * a, lz: (dx / len) * a };
}

/**
 * Real glass: a ball hits it faster than it leaves it, and the faster it comes the more energy it loses
 * (the rubber ball squashes). Slow balls keep about 0.76 of their speed along the normal, a 25 m/s smash only about 0.55.
 */
function glassNormalE(vn: number): number {
  return clamp(GLASS_E - 0.008 * Math.max(0, vn - 10), 0.55, GLASS_E);
}

/**
 * Vertical speed after a wall contact. The wall is vertical, so up/down is the tangential direction: friction takes a little
 * of it, and the spin kicks the ball: topspin (turning forward) kicks it UP off a wall, backspin pushes it down. The kick is limited by
 * friction (mu x (1 + e) x the normal speed) and by how fast the ball surface moves (the spin).
 */
function wallVertical(vy: number, vn: number, spin: number, e: number): number {
  const maxKick = GLASS_MU * (1 + e) * vn;
  const kick = clamp(0.5 * SPIN_SURFACE * spin, -maxKick, maxKick);
  return vy * 0.9 + kick;
}

/** Ballistic arc from `from` (at height h0) to the floor at `to`, as fast as `speed` allows while still clearing the net. */
function solveArc(
  from: Vec,
  to: { x: number; z: number },
  speed: number,
  apex: number,
  mag?: { g: number; lx: number; lz: number },
  clearance = NET_CLEARANCE,
): Arc {
  const g = mag?.g ?? GRAVITY;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  let T = Math.max(Math.hypot(dx, dz) / speed, 0.2);

  // Enough loft to clear the net.
  const f = dz !== 0 ? (NET_Z - from.z) / dz : -1;
  if (f > 0.02 && f < 0.98) {
    const need = NET_HEIGHT_M + clearance - from.h * (1 - f);
    if (need > 0) T = Math.max(T, Math.sqrt((2 * need) / (g * f * (1 - f))));
  }
  // A lob: arc at least `apex` metres high (apex above the chord is about g T^2 / 8).
  if (apex > 0) T = Math.max(T, Math.sqrt((8 * apex) / g));
  T = Math.min(T, 3.5);

  return { T, vx: dx / T, vz: dz / T, vy: -from.h / T + 0.5 * g * T, g, lx: mag?.lx ?? 0, lz: mag?.lz ?? 0 };
}

function arcPoint(from: Vec, a: Arc, t: number): Vec {
  const bow = 0.5 * t * (a.T - t);
  return {
    x: from.x + a.vx * t + a.lx * bow,
    z: from.z + a.vz * t + a.lz * bow,
    h: Math.max(0, from.h + a.vy * t - 0.5 * a.g * t * t),
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
  const deaden = o.shot.flight.deaden ?? 1;
  const keep = clamp(FLOOR_KEEP + 0.14 * spin, 0.4, 0.95) * deaden;
  const restitution = clamp(FLOOR_E + 0.05 * spin, 0.6, 0.8) * boost * deaden;
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
  // Spin of the ball (+ topspin, - backspin; side spin about the vertical axis). A floor bounce takes part of it, a wall turns
  // topspin into backspin (the ball keeps turning the same way while it now travels the other way).
  let lift = o.shot.flight.spin;
  let side = o.shot.flight.side;

  const floorBounce = (): void => {
    lift *= FLOOR_SPIN_KEEP;
    side *= FLOOR_SPIN_KEEP;
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
    // Magnus force on the spinning ball: topspin pulls it down, backspin lifts it, side spin bends it sideways.
    const hv = Math.hypot(vx, vz);
    if (hv > 0.5) {
      const f = hv / 25;
      vy -= MAGNUS_LIFT * lift * f * DT;
      const a = MAGNUS_SIDE * side * f * DT;
      const ovx = vx;
      vx += (-vz / hv) * a;
      vz += (ovx / hv) * a;
    }
    lift *= 1 - SPIN_DECAY * DT;
    side *= 1 - SPIN_DECAY * DT;
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
        const vn = Math.abs(vx);
        const eN = glass ? glassNormalE(vn) : MESH_E;
        vx = -vx * eN;
        const along = (glass ? GLASS_KEEP : MESH_KEEP) * (kicked ? 1 : kick);
        vz *= along;
        vy = glass ? wallVertical(vy, vn, lift, eN) : vy * WALL_VERTICAL_KEEP * 0.7;
        lift *= -0.7;
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
      const vn = Math.abs(vz);
      const vzIn = vz;
      const eN = glass ? glassNormalE(vn) : MESH_E;
      vz = -vz * eN;
      vx *= (glass ? GLASS_KEEP : MESH_KEEP) * (kicked ? 1 : kick);
      if (glass) {
        // Side spin kicks the ball along the glass, against the way the spin bends it in the air (as topspin kicks up off the glass).
        const maxKick = GLASS_MU * (1 + eN) * vn;
        vx += Math.sign(vzIn) * clamp(0.5 * SPIN_SURFACE * side, -maxKick, maxKick);
        side *= 0.6;
      }
      // What the contact itself leaves: the normal speed is cut by the glass, the vertical speed gets friction and the spin kick.
      const vyPhys = glass ? wallVertical(vy, vn, lift, eN) : vy * WALL_VERTICAL_KEEP * 0.7;
      if (o.reboundPeak !== undefined && glass && backContact < 0 && !o.exitOverFence) {
        // The rebound off the back glass is low, medium or high. The ball is tilted to that class, but it keeps the speed the
        // contact left it with (a hard flat ball comes off fast at an angle, it does not shoot straight up and hang there).
        const total = Math.hypot(vx, vz, vyPhys);
        const wanted = Math.sqrt(2 * GRAVITY * Math.max(o.reboundPeak - h, 0.05));
        const vyOut = Math.min(wanted, 0.7 * total);
        const hNow = Math.hypot(vx, vz) || 1e-6;
        const hNew = Math.sqrt(Math.max(total * total - vyOut * vyOut, 0));
        vx *= hNew / hNow;
        vz *= hNew / hNow;
        vy = vyOut;
      } else {
        vy = vyPhys;
      }
      lift *= -0.7;
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
  // After a side wall the ball is taken before it reaches the back glass: the receiver waits for the side glass only.
  if (o.needWall && !o.backGlass && backContact > from) to = Math.max(from, Math.min(to, backContact - 1));
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

/**
 * A winning Por Tres, as the real shot goes: a medium-hard topspin ball is hit down into the court near the end line (towards the
 * corner), bounces, kicks off the back glass and leaves over the side wall near the corner. Every surface takes speed off it
 * (floor, then glass) and the spin keeps acting: topspin dives, side spin kicks it along the glass. The path is put together
 * from three ballistic legs (hit -> floor, floor -> glass, glass -> over the wall) with the contact rules of the simulation; a
 * small search over where it lands finds the combination that really clears the wall. Returns null if none does.
 */
/** Distances of the first bounce from the back glass, preferred first: the service line is 3 m from the glass, the ball lands halfway (1.5 m). */
const POR_TRES_UB = [1.5, 1.8, 2.1, 1.2, 2.5, 2.9, 3.3, 3.8, 4.5];

function scriptedSideExit(o: FlightOpts): Flight | null {
  const away = o.hitterSide === 0 ? -1 : 1;
  const backZ = away === -1 ? 0 : 20;
  const zAt = (u: number): number => backZ - away * u; // u = distance from the back wall
  const fl = o.shot.flight;
  const from: Vec = { x: o.from.x, z: o.from.z, h: o.startH ?? HIT_HEIGHT_M };
  const sgn = o.landX >= 0 ? 1 : -1;
  type Cand = { score: number; xb: number; ub: number; arc: Arc; t2: number; t3: number; hG: number; hE: number; vyIn: number; xg: number; xe: number; ue: number; v2: Vec; v3: Vec; vy2: number; vyG: number; vy3: number; vz2: number };
  let best: Cand | null = null;
  // Strict first (leaves near the corner, clearly over the wall), then more relaxed for balls hit from lower down.
  for (const [ueMax, margin] of [[7.5, 0.4], [9, 0.2], [10, 0.05], [12, -0.3], [14, -0.8]]) {
  if (best) break;
  for (const xb of [3.4, 3.0, 2.6, 2.2, 1.8, 1.4, 1.0, 0.6, 0.2, 3.8]) {
    for (const ub of POR_TRES_UB) {
      const land = { x: sgn * xb, z: zAt(ub) };
      const arc = solveArc(from, land, Math.min(fl.speed * (o.speedMul ?? 1), MAX_SHOT_SPEED), 0, magnus(o.shot, land.x - from.x, land.z - from.z));
      const vyIn = -from.h / arc.T - 0.5 * arc.g * arc.T; // vertical speed at the floor (negative)
      // floor: keeps part of the horizontal speed, bounces up with part of the vertical one
      const vx2 = arc.vx * FLOOR_KEEP;
      const vz2 = arc.vz * FLOOR_KEEP;
      const vy2 = -vyIn * (FLOOR_E - 0.04);
      const w = Math.abs(vz2);
      if (w < 1) continue;
      const t2 = ub / w;
      const g2 = GRAVITY + 0.3 * (arc.g - GRAVITY);
      const hG = vy2 * t2 - 0.5 * g2 * t2 * t2;
      const xg = land.x + vx2 * t2;
      if (hG < 0.5 || hG > 2.9 || Math.abs(xg) > 4.8) continue;
      const vyG = vy2 - g2 * t2;
      // back glass: the normal speed is cut, topspin kicks up, side spin kicks along the glass towards the wall the ball is heading for
      const eN = glassNormalE(w);
      const maxKick = GLASS_MU * (1 + eN) * w;
      const kickUp = clamp(0.5 * SPIN_SURFACE * fl.spin * FLOOR_SPIN_KEEP, -maxKick, maxKick);
      const kickSide = clamp(0.5 * SPIN_SURFACE * Math.abs(fl.side) * FLOOR_SPIN_KEEP, 0, maxKick);
      const vy3 = 0.9 * vyG + kickUp;
      const vz3 = -vz2 * eN;
      const vx3 = vx2 * GLASS_KEEP + sgn * kickSide;
      if (sgn * vx3 < 0.5) continue;
      const t3 = (5 - Math.abs(xg)) / Math.abs(vx3);
      const g3 = GRAVITY - 0.2 * (arc.g - GRAVITY); // the spin has turned over: the ball floats a little
      const hE = hG + vy3 * t3 - 0.5 * g3 * t3 * t3;
      const ue = Math.abs(vz3) * t3;
      const top = sideWallHeightAt(clamp(zAt(ue), 0, 20));
      if (ue > ueMax || hE < top + margin) continue;
      // every surface takes speed off the ball
      const s1 = Math.hypot(arc.vx, arc.vz, vyIn);
      const s2 = Math.hypot(vx2, vz2, vy2);
      const sIn = Math.hypot(vx2, vz2, vyG);
      const sOut = Math.hypot(vx3, vz3, vy3);
      if (!(s2 < s1 && sOut < sIn)) continue;
      const score = ue + 0.5 * Math.abs(hE - (top + 1.5));
      if (!best || score < best.score) {
        best = { score, xb, ub, arc, t2, t3, hG, hE, vyIn, xg, xe: sgn * 5, ue, v2: { x: vx2, z: vz2, h: vy2 }, v3: { x: vx3, z: vz3, h: vy3 }, vy2, vyG, vy3, vz2 };
      }
    }
  }
  }
  if (!best) return null;
  const c = best;
  const path: Sample[] = [];
  const events: FlightEvent[] = [];
  const g2 = GRAVITY + 0.3 * (c.arc.g - GRAVITY);
  const g3 = GRAVITY - 0.2 * (c.arc.g - GRAVITY);
  const land = { x: sgn * c.xb, z: zAt(c.ub) };
  // leg 1: racket -> floor
  const steps1 = Math.max(2, Math.ceil(c.arc.T / DT));
  for (let i = 0; i <= steps1; i++) {
    const t = (c.arc.T * i) / steps1;
    const p = arcPoint(from, c.arc, t);
    path.push({ t, x: p.x, z: p.z, h: p.h });
  }
  events.push({ kind: 'bounce', t: c.arc.T, x: land.x, z: land.z, h: 0 });
  // leg 2: floor -> back glass
  const T2 = c.arc.T + c.t2;
  const steps2 = Math.max(2, Math.ceil(c.t2 / DT));
  for (let i = 1; i <= steps2; i++) {
    const u = (c.t2 * i) / steps2;
    path.push({ t: c.arc.T + u, x: land.x + c.v2.x * u, z: land.z + c.v2.z * u, h: Math.max(0, c.vy2 * u - 0.5 * g2 * u * u) });
  }
  const gx = land.x + c.v2.x * c.t2;
  events.push({ kind: 'glass', t: T2, x: gx, z: backZ, h: c.hG });
  // leg 3: back glass -> over the side wall
  const steps3 = Math.max(2, Math.ceil(c.t3 / DT));
  for (let i = 1; i <= steps3; i++) {
    const u = (c.t3 * i) / steps3;
    path.push({ t: T2 + u, x: gx + c.v3.x * u, z: backZ + c.v3.z * u, h: Math.max(0, c.hG + c.vy3 * u - 0.5 * g3 * u * u) });
  }
  const end = path[path.length - 1];
  events.push({ kind: 'out', t: end.t, x: sgn * 5, z: end.z, h: end.h });
  const spot = clampHit({ x: land.x, z: land.z, h: 0 }, o.hitterSide);
  return { path, hit: { x: spot.x, z: spot.z }, hitH: 0, events, duration: end.t };
}

export function buildFlight(o: FlightOpts): Flight {
  if ((o.outcome === 'winner' || o.outcome === 'ace') && o.shot.exitVia === 'side' && o.landDepth === undefined) {
    const f = scriptedSideExit(o);
    if (f) return f;
  }
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
    // A ball that is too hard or too long flies into the back glass (out), or into the mesh above it, without a bounce.
    if (!fence && (o.errorKind === 'glass' || o.errorKind === 'mesh')) {
      const r = makeRand(o.seed ?? Math.round(Math.abs(o.from.x * 977 + o.landX * 131) * 1000) + 11);
      const wallZ = away === -1 ? 0.02 : 19.98;
      const x = clamp(o.from.x + (o.landX - o.from.x) * (0.7 + 0.3 * r()), -4.2, 4.2);
      const targetH = o.errorKind === 'glass' ? 1.4 + 1.3 * r() : 3.15 + 0.6 * r();
      const dist = Math.hypot(x - from.x, wallZ - from.z);
      const T = Math.max(0.3, dist / fl.speed);
      const g = magnus(o.shot, x - from.x, wallZ - from.z).g;
      const a: Arc = {
        T,
        vx: (x - from.x) / T,
        vz: (wallZ - from.z) / T,
        vy: (targetH - from.h) / T + 0.5 * g * T,
        g,
        lx: 0,
        lz: 0,
      };
      sampleArc(from, a, 0);
      // The contact with the wall itself is played by the ball's free flight after the point (one sound, one flash).
      const end = path[path.length - 1];
      return { path, hit: { x: end.x, z: end.z }, hitH: end.h, events: [], duration: end.t };
    }
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
      g: GRAVITY,
      lx: 0,
      lz: 0,
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
  // A winning shot may be hit differently (a winning Por Tres bounces further from the glass so that it has time to rise).
  const winShot = o.outcome === 'winner' || o.outcome === 'ace';
  const depth = o.landDepth ?? (winShot ? o.shot.winLandDepth : undefined) ?? o.shot.landDepth;
  const land = { x: toBack ? clamp(o.landX, -2.6, 2.6) : o.landX, z: NET_Z + away * depth };
  // A volley from right at the net is much faster than one from mid-court (full boost within 2 m, none from 4.5 m).
  const close = clamp((4.5 - Math.abs(o.from.z - NET_Z)) / 2.5, 0, 1);
  const speed = Math.min(fl.speed * (o.speedMul ?? 1) * (1 + (fl.netBoost ?? 0) * close), MAX_SHOT_SPEED);
  // A fast volley from the net skims over the tape; every other ball clears it comfortably.
  const clearance = NET_CLEARANCE - 0.09 * (fl.netBoost ? close : 0);
  const arc = solveArc(from, land, speed, fl.apex, magnus(o.shot, land.x - from.x, land.z - from.z), clearance);
  sampleArc(from, arc, 0);
  // A ball that is played out of the air (a block at the net, or a weak lob taken overhead) ends where it is hit.
  if ((o.block || o.airHit) && (o.outcome === 'continue' || o.outcome === 'in')) {
    let tHit = -1;
    if (o.block) {
      const zb = NET_Z + away * Math.min(1.6, depth * 0.5);
      const t = arc.vz !== 0 ? (zb - from.z) / arc.vz : -1;
      if (t > 0 && t < arc.T) tHit = t;
    } else {
      const level = ARRIVAL_HEIGHT.high;
      const disc = arc.vy * arc.vy - 2 * arc.g * (level - from.h);
      if (disc > 0) {
        const t = (arc.vy + Math.sqrt(disc)) / arc.g;
        if (t > 0 && t < arc.T) tHit = t;
      }
    }
    if (tHit > 0) {
      path.length = 0;
      const steps = Math.max(2, Math.ceil(tHit / DT));
      for (let i = 0; i <= steps; i++) {
        const t = (tHit * i) / steps;
        const p = arcPoint(from, arc, t);
        path.push({ t, x: p.x, z: p.z, h: p.h });
      }
      const end = path[path.length - 1];
      const spot = clampHit(end, o.hitterSide);
      path[path.length - 1] = { t: end.t, x: spot.x, z: spot.z, h: end.h };
      return { path, hit: { x: spot.x, z: spot.z }, hitH: end.h, events: [], duration: end.t };
    }
  }
  // After the bounce the ball is simulated with the ordinary speeds of the arc (the spin of the shot is handled there).
  const touch = {
    x: land.x,
    z: land.z,
    vx: arc.vx,
    vz: arc.vz,
    vy: -from.h / arc.T - 0.5 * GRAVITY * arc.T,
  };

  const isServe = o.shot.kind === 'serve';
  const rulo = o.shot.wall === 'fence';
  const rand = makeRand(o.seed ?? Math.round(Math.abs(o.from.x * 977 + o.from.z * 313 + o.landX * 131) * 1000) + 7);
  // Serves: the receiver chooses (bounce or glass) when the serve goes to the glass. Rally balls that reach a wall
  // are played after it, because a ball that is about to hit the glass cannot be taken before it.
  const needWall = isServe ? o.shot.wall !== 'none' && o.receive !== 'bounce' : o.glass ?? true;
  const backGlass = !isServe && (o.glass === true || o.reboundBack === true);
  const arrival = o.arrival ?? o.shot.out;
  const hitHeight = ARRIVAL_HEIGHT[arrival];
  const winning = o.outcome === 'ace' || o.outcome === 'winner';
  // Only a smash can leave the court over the fence. A rulo that comes off the mesh stays in the court.
  const exits = winning && o.shot.wall !== 'fence' && o.shot.overFence === true;
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
      // The ball must leave on the receiving half: it never comes back over the net.
      if (o.hitterSide === 0 ? e.z > NET_Z - 0.3 : e.z < NET_Z + 0.3) return false;
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

  // A ball hit so hard that it comes off the back wall and flies back over the net: after the wall contact it is a new arc that
  // lands in the hitter's own half (the defenders never touch it).
  let wallIdx = -1;
  if (o.reboundBack === true && winning) {
    const w = sim.events.find((e) => (e.kind === 'glass' || e.kind === 'mesh') && (e.z < 0.1 || e.z > 19.9));
    if (w) wallIdx = sim.samples.findIndex((p) => p.t >= w.t - 1e-9);
  }
  const wallT = wallIdx > 0 ? sim.samples[wallIdx].t : Infinity;
  for (const e of sim.events.slice(1)) if (e.t <= wallT + 1e-9) events.push(e);

  const natural = sim.samples[wallIdx > 0 ? wallIdx : sim.hitIndex];
  const hit = clampHit(natural, o.hitterSide);

  // Samples up to the hit (or to the end for a winner: the ball flies on past the defender).
  const last = wallIdx > 0 ? wallIdx : winning ? sim.end : sim.hitIndex;
  for (let i = 1; i <= last; i++) path.push(sim.samples[i]);
  if (wallIdx > 0) {
    const s0 = sim.samples[wallIdx];
    const origin: Vec = { x: s0.x, z: s0.z, h: Math.max(s0.h, 0.5) };
    const back = { x: clamp(s0.x * 0.4, -3.5, 3.5), z: NET_Z - away * 5.5 };
    const ret = solveArc(origin, back, 15, 0);
    const n = Math.max(2, Math.ceil(ret.T / DT));
    for (let i = 1; i <= n; i++) {
      const t = (ret.T * i) / n;
      const p = arcPoint(origin, ret, t);
      path.push({ t: s0.t + t, x: p.x, z: p.z, h: p.h });
    }
    events.push({ kind: 'bounce', t: s0.t + ret.T, x: back.x, z: back.z, h: 0 });
  }
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
const ROLL_DECEL = 1.6;
const OUTSIDE_ROLL_DECEL = 2.8;
/** Below this vertical speed after a bounce the ball stops bouncing and rolls. */
const ROLL_VY = 1.2;
const COAST_MAX_TIME = 6;

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
      // The ground outside the court is softer (grass, paving): the ball bounces less and loses more speed.
      vy = -vy * (inside ? e : e * 0.7);
      vx *= inside ? keep : keep * 0.75;
      vz *= inside ? keep : keep * 0.75;
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

/** Speed of the ball at time t of a path: total (m/s) and vertical. Used to decide how hard a bounce or a wall hit sounds. */
export function speedAt(path: Sample[], t: number): { v: number; vy: number } {
  if (path.length < 2) return { v: 0, vy: 0 };
  let i = 0;
  while (i < path.length - 1 && path[i].t < t) i++;
  const a = path[Math.max(0, i - 3)];
  const b = path[Math.min(path.length - 1, i + 3)];
  const dt = b.t - a.t;
  if (dt <= 0) return { v: 0, vy: 0 };
  const vy = (b.h - a.h) / dt;
  return { v: Math.hypot(b.x - a.x, b.z - a.z, b.h - a.h) / dt, vy };
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
