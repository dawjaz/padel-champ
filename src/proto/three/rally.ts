// 3D prototype: a CPU-vs-CPU match driven by the game's own engine (point.ts, ai.ts) and ball flights (ballPath.ts), shown in 3D.
// Every player has a little state machine (idle / run / stroke / reaction) that produces his Pose3D each frame.

import * as THREE from 'three';
import playersData from '../../data/players.json';
import { pickHit, pickReceive, pickServe } from '../../game/ai';
import { laneSign, NET_Z, restPos, serveSetup } from '../../game/court';
import { startPoint, stepHit, stepServe, type PointState, type Step, type Teams } from '../../game/point';
import { awardPoint, newScore, type MatchScore } from '../../game/scoring';
import type { PlayerDef, SideIndex } from '../../game/types';
import { ballPoint, buildFlight, flightDuration, type Flight } from '../../art/ballPath';
import { P } from './arena';
import { mix, POSE, READY, runPose, type Pose3D, Player3D } from './player3d';

export const TEAMS: Teams = [playersData.you as unknown as PlayerDef[], playersData.cpu as unknown as PlayerDef[]];
const other = (s: SideIndex): SideIndex => (s === 0 ? 1 : 0);
const smooth = (t: number): number => t * t * (3 - 2 * t);
const easeOut = (t: number): number => 1 - (1 - t) ** 3;
const easeIn = (t: number): number => t ** 3;

/** A timed sequence of poses: [seconds from the start, pose, ease to it]. */
export type Track = Array<[number, Pose3D, (t: number) => number]>;

export function sampleTrack(track: Track, t: number, from: Pose3D): Pose3D {
  let prevT = 0;
  let prev = from;
  for (const [at, p, ease] of track) {
    if (t <= at) return mix(prev, p, ease(Math.max(0, Math.min(1, (t - prevT) / Math.max(1e-3, at - prevT)))));
    prevT = at;
    prev = p;
  }
  return prev;
}

export const STROKES = {
  fh: (): Track => [[0.06, POSE.fhHit, easeIn], [0.11, POSE.fhHit, (t) => t], [0.27, POSE.fhFollow, easeOut], [0.4, POSE.fhFollow, (t) => t], [0.75, READY, smooth]],
  bh: (): Track => [[0.06, POSE.bhHit, easeIn], [0.11, POSE.bhHit, (t) => t], [0.27, POSE.bhFollow, easeOut], [0.4, POSE.bhFollow, (t) => t], [0.75, READY, smooth]],
  smash: (): Track => [[0.06, POSE.smashAir, easeIn], [0.11, POSE.smashAir, (t) => t], [0.28, POSE.smashFollow, easeOut], [0.38, POSE.land, easeIn], [0.8, READY, smooth]],
  split: (): Track => [[0.08, POSE.splitUp, easeOut], [0.18, POSE.splitLand, easeIn], [0.42, READY, smooth]],
};

export class Actor {
  pos = new THREE.Vector2();
  target = new THREE.Vector2();
  speed = 5.5;
  facing = 0;
  current: Pose3D = READY;
  track: Track | null = null;
  trackStart = 0;
  trackFrom: Pose3D = READY;
  prep: Pose3D | null = null;
  jumpStart = -1;
  jumpLen = 0.33;
  jumpH = 0;
  stride = 0;
  shadow: THREE.Mesh;
  constructor(readonly def: PlayerDef, readonly side: SideIndex, readonly model: Player3D, shadowMat: THREE.Material) {
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18), shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
  }
  play(track: Track, now: number): void {
    this.trackFrom = this.current;
    this.track = track;
    this.trackStart = now;
    this.prep = null;
  }
  jump(now: number, h: number, len = 0.33): void {
    this.jumpStart = now;
    this.jumpH = h;
    this.jumpLen = len;
  }
  update(now: number, dt: number): void {
    const d = this.target.clone().sub(this.pos);
    const dist = d.length();
    const moving = dist > 0.05;
    if (moving) {
      const step = Math.min(dist, this.speed * dt * Math.min(1, 0.35 + dist));
      this.pos.add(d.multiplyScalar(step / dist));
      this.stride += step;
    }
    let p: Pose3D;
    if (this.track) {
      const t = now - this.trackStart;
      p = sampleTrack(this.track, t, this.trackFrom);
      if (t > this.track[this.track.length - 1][0]) this.track = null;
    } else if (moving && dist > 0.25) {
      p = mix(this.current, runPose(this.stride / 1.8), 0.5);
    } else {
      p = mix(this.current, this.prep ?? READY, Math.min(1, dt * 10));
    }
    this.current = p;
    this.model.setPose(p);
    let lift = 0;
    if (this.jumpStart >= 0) {
      const u = (now - this.jumpStart) / this.jumpLen;
      if (u >= 1) this.jumpStart = -1;
      else lift = this.jumpH * (u < 0.42 ? easeOut(u / 0.42) : 1 - easeIn((u - 0.42) / 0.58));
    }
    // face the net; a runner turns a little towards where he runs
    const baseYaw = this.side === 0 ? Math.PI : 0;
    // players never turn their back on the net: running back they back-pedal facing it; forwards or sideways they turn into the run
    const towardNet = this.side === 0 ? -d.y : d.y;
    const want = moving && dist > 0.6 && towardNet > -0.3 * Math.abs(d.x) ? Math.atan2(d.x, d.y) : baseYaw;
    let diff = want - this.facing;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    this.facing += diff * Math.min(1, dt * 8);
    this.model.root.position.copy(P(this.pos.x, this.pos.y, lift));
    this.model.root.rotation.y = this.facing;
    this.shadow.position.copy(P(this.pos.x, this.pos.y, 0.01));
    this.shadow.scale.setScalar(1 - Math.min(0.5, lift));
  }
}

export interface RallyEvents {
  onHit?: (a: Actor, step: Step, flight: Flight) => void;
  onPointOver?: (step: Step, winner: SideIndex, score: MatchScore) => void;
}

/** Runs points one after another: serve, rally, the point's end, a pause. `paused` stops it (for the cut-ins). */
export class Rally {
  actors: Record<string, Actor> = {};
  ball = new THREE.Vector3(0, -5, 0);
  score = newScore(2);
  paused = false;
  slow = 1;
  private state!: PointState;
  private guts: Record<string, number> = {};
  private flight: Flight | null = null;
  private flightStart = 0;
  private flightMs = 1;
  private lastStep: Step | null = null;
  private waitUntil = 0;
  private server: SideIndex = 0;
  private serverIdx = [0, 0];
  private ballH = 1;
  lastWinner: Step | null = null;
  constructor(actors: Actor[], private events: RallyEvents) {
    for (const a of actors) this.actors[a.def.id] = a;
    for (const p of TEAMS.flat()) this.guts[p.id] = p.maxGuts;
    this.newPoint(0);
  }
  actorOf(side: SideIndex, idx: number): Actor {
    return this.actors[TEAMS[side][idx].id];
  }
  private newPoint(now: number): void {
    const played = this.score.points[0] + this.score.points[1];
    this.state = startPoint(this.guts, this.server, this.serverIdx[this.server], played);
    const setup = serveSetup(this.server, played, this.serverIdx[this.server]);
    for (const side of [0, 1] as SideIndex[]) {
      for (let i = 0; i < 2; i++) {
        const a = this.actorOf(side, i);
        const rp = restPos(side, i, 'back');
        a.target.set(rp.x, rp.z);
      }
    }
    this.actorOf(this.server, this.state.serverIdx).target.set(setup.server.x, setup.server.z);
    this.actorOf(this.server, 1 - this.state.serverIdx).target.set(setup.partner.x, setup.partner.z);
    this.actorOf(other(this.server), setup.receiverIdx).target.set(setup.receiver.x, setup.receiver.z);
    this.actorOf(other(this.server), 1 - setup.receiverIdx).target.set(setup.receiverPartner.x, setup.receiverPartner.z);
    this.flight = null;
    this.waitUntil = now + 1.4;
    this.ballH = 1;
  }
  private launch(now: number, step: Step, next: PointState, attacker: Actor): void {
    const landX =
      step.kind === 'serve' ? laneSign(step.defenderIdx) * (step.shot.landX ?? 3) : step.landX ?? (step.side === 0 ? -1 : 1) * 2.5;
    const flight = buildFlight({
      from: { x: attacker.pos.x, z: attacker.pos.y }, startH: this.ballH, hitterSide: step.side, shot: step.shot, landX,
      outcome: step.outcome, receive: step.receive, glass: step.kind === 'serve' ? undefined : step.glass, arrival: step.arrival,
      landDepth: step.landDepth, block: step.block, airDist: step.airDist, errorKind: step.errorKind, reboundBack: step.reboundBack,
      netReturn: step.netReturn, airHit: step.lob === 'weak' || step.lob === 'medium',
    });
    this.flight = flight;
    this.flightStart = now + 0.11; // the ball stays on the racket for the hit-stop
    this.flightMs = flightDuration(flight) / 1000;
    this.lastStep = step;
    this.state = next;
    // the swing
    const high = this.ballH > 1.9 && step.kind !== 'serve';
    const fhSide = step.side === 0 ? 1 : -1;
    const ballSide = Math.sign(this.ball.x - attacker.pos.x || 1) * fhSide;
    attacker.play(high ? STROKES.smash() : ballSide >= 0 ? STROKES.fh() : STROKES.bh(), now);
    if (high) attacker.jump(now, 0.45);
    // the receivers: the one who plays it runs to where it will be hit, a split step for both
    const recv = other(step.side);
    for (let i = 0; i < 2; i++) {
      const a = this.actorOf(recv, i);
      a.play(STROKES.split(), now + 0.04);
      a.jump(now + 0.04, 0.08, 0.18);
      const rp = restPos(recv, i, next.formation?.[recv] ?? 'back');
      a.target.set(rp.x, rp.z);
    }
    if (step.outcome === 'continue' || step.outcome === 'in') {
      const d = this.actorOf(recv, step.defenderIdx);
      const side = recv === 0 ? 1 : -1;
      d.target.set(flight.hit.x - 0.45 * side, flight.hit.z + (recv === 0 ? 0.3 : -0.3));
      d.prep = flight.hitH > 1.9 ? POSE.smashPrep : (flight.hit.x - d.pos.x) * side >= -0.3 ? POSE.fhPrep : POSE.bhPrep;
    }
    // the hitting pair follows its shot to its formation
    for (let i = 0; i < 2; i++) {
      if (i === step.attackerIdx) continue;
      const rp = restPos(step.side, i, next.formation?.[step.side] ?? 'back');
      this.actorOf(step.side, i).target.set(rp.x, rp.z);
    }
    this.events.onHit?.(attacker, step, flight);
  }
  update(now: number, dt: number): void {
    for (const a of Object.values(this.actors)) a.update(now, dt);
    if (this.paused) return;
    if (this.flight) {
      const u = (now - this.flightStart) / this.flightMs;
      if (u < 0) return;
      const p = ballPoint(this.flight.path, Math.min(1, u));
      this.ball.copy(P(p.x, p.z, p.h));
      if (u < 1) return;
      this.ballH = this.flight.hitH;
      const step = this.lastStep!;
      this.flight = null;
      if (this.state.status === 'rally') this.nextHit(now);
      else if (this.state.status === 'serve') this.serve(now);
      else this.pointOver(now, step);
      return;
    }
    if (this.pending !== null) {
      if (now < this.pending) return;
      this.pending = null;
      this.newPoint(now);
      return;
    }
    if (now < this.waitUntil) return;
    if (this.state.status === 'serve') this.serve(now);
  }
  private serve(now: number): void {
    const rng = Math.random;
    const shot = pickServe(TEAMS, this.state, rng);
    const receive = pickReceive(TEAMS, this.state, rng, shot);
    const sv = this.actorOf(this.state.servingSide, this.state.serverIdx);
    this.ball.copy(P(sv.pos.x, sv.pos.y, 1));
    const r = stepServe(TEAMS, this.state, shot, rng, receive);
    this.launch(now, r.step, r.state, sv);
  }
  private nextHit(now: number): void {
    const st = this.state;
    const opp = TEAMS[other(st.holder)].map((p) => ({ x: this.actors[p.id].pos.x, z: this.actors[p.id].pos.y }));
    const { shot, direction, prefer } = pickHit(TEAMS, st, Math.random, opp);
    const a = this.actorOf(st.holder, st.hitterIdx);
    const r = stepHit(TEAMS, st, shot, direction, Math.random, prefer);
    this.launch(now, r.step, r.state, a);
  }
  private pointOver(now: number, step: Step): void {
    const w = this.state.winner as SideIndex;
    this.guts = { ...this.state.guts };
    const res = awardPoint(this.score, w);
    this.score = res.score;
    if (res.gameWon) {
      this.server = other(this.server);
      this.serverIdx[this.server] = 1 - this.serverIdx[this.server];
    }
    if (this.score.winner !== null) this.score = newScore(2);
    this.lastWinner = step;
    this.events.onPointOver?.(step, w, this.score);
    this.pending = now + 2.4;
  }
  /** When the next point is set up (after a point's end). */
  private pending: number | null = null;
}

export { NET_Z };
