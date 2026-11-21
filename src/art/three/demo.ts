import { SHOTS } from '../../game/catalog';
import type { CourtPos, SideIndex } from '../../game/types';
import { ballPoint, buildFlight, flightDuration, HIT_HEIGHT_M, type Flight, type FlightOutcome } from '../ballPath';
import { Court3D, type CameraMode } from './court3d';
import type { PlayerLook, Stroke } from './player3d';

/**
 * Prototype page (3d.html): a three.js court where the ball flies along the real `buildFlight` paths of the game.
 * No rules, no Phaser: a fixed rally script, to judge the look, the camera and the effects.
 */

interface ScriptStep {
  shot: string;
  outcome: FlightOutcome;
  glass?: boolean;
}

/** One rally: serve, return, lob, bajada, volley, vibora, bandeja, winning smash. Sides alternate, near team serves. */
const SCRIPT: ScriptStep[] = [
  { shot: 'spin_glass', outcome: 'in' },
  { shot: 'flat', outcome: 'continue' },
  { shot: 'rally_lob', outcome: 'continue', glass: true },
  { shot: 'bajada_fast', outcome: 'continue', glass: true },
  { shot: 'volley', outcome: 'continue' },
  { shot: 'vibora', outcome: 'continue' },
  { shot: 'bandeja', outcome: 'continue', glass: false },
  { shot: 'smash_x3', outcome: 'winner' },
];

const LOOKS: PlayerLook[] = [
  { shirt: 0xd8402e, shorts: 0x20232f, skin: 0xc68642, hair: 0x2b1b12, racket: 0xf2b01e },
  { shirt: 0x19a89a, shorts: 0x20232f, skin: 0xf1c6a0, hair: 0xc9792b, racket: 0xffffff },
  { shirt: 0x2a58d6, shorts: 0xe8e8ee, skin: 0x8a5a3b, hair: 0x101010, racket: 0xf2b01e },
  { shirt: 0xe0559c, shorts: 0xe8e8ee, skin: 0xe3b08a, hair: 0x4a2a14, racket: 0x222222 },
];

const START: CourtPos[] = [
  { x: 2.5, z: 19.4 },
  { x: -2.5, z: 13 },
  { x: -2.5, z: 1.6 },
  { x: 2.5, z: 6.5 },
];

/** Which animation plays for a shot. Groundstrokes are a forehand or a backhand depending on which side the ball goes. */
function strokeFor(id: string, kind: string, fromX: number, toX: number): Stroke {
  if (kind === 'serve') return 'serve';
  if (id.startsWith('smash')) return 'smash';
  if (id === 'bandeja') return 'bandeja';
  if (id === 'vibora') return 'vibora';
  if (id.startsWith('bajada')) return 'bajada';
  if (id === 'volley') return 'volley';
  if (id.includes('lob') || id.includes('chiquita')) return 'lob';
  return toX < fromX ? 'backhand' : 'forehand';
}

const stageEl = document.getElementById('stage');
const labelEl = document.getElementById('label');
const barEl = document.getElementById('bar');
if (!stageEl || !labelEl || !barEl) throw new Error('3d.html is missing its elements');
const stage: HTMLElement = stageEl;
const label: HTMLElement = labelEl;
const bar: HTMLElement = barEl;

const court = new Court3D(stage, LOOKS);
START.forEach((p, i) => court.placePlayer(i, p.x, p.z, true));

// ---- controls ----
let paused = false;
let slow = false;
const buttons = new Map<string, HTMLButtonElement>();
function addButton(id: string, text: string, onClick: () => void): void {
  const b = document.createElement('button');
  b.textContent = text;
  b.onclick = onClick;
  bar.appendChild(b);
  buttons.set(id, b);
}
function markCamera(mode: CameraMode): void {
  for (const m of ['tv', 'low', 'orbit']) buttons.get(m)?.classList.toggle('on', m === mode);
}
addButton('tv', 'TV', () => (court.setCamera('tv'), markCamera('tv')));
addButton('low', 'LOW', () => (court.setCamera('low'), markCamera('low')));
addButton('orbit', 'FREE', () => (court.setCamera('orbit'), markCamera('orbit')));
addButton('slow', 'SLOW', () => {
  slow = !slow;
  buttons.get('slow')?.classList.toggle('on', slow);
});
addButton('pause', 'PAUSE', () => {
  paused = !paused;
  buttons.get('pause')?.classList.toggle('on', paused);
});
court.onModeChange = markCamera;
const camParam = new URLSearchParams(location.search).get('cam');
if (camParam === 'low' || camParam === 'orbit') court.setCamera(camParam);
markCamera(camParam === 'low' || camParam === 'orbit' ? camParam : 'tv');

// ---- rally ----
const shotById = (id: string) => {
  const s = SHOTS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown shot ${id}`);
  return s;
};

interface Active {
  flight: Flight;
  elapsed: number;
  duration: number;
  fired: number;
  hitter: number;
  side: SideIndex;
}

let stepIdx = 0;
let hitFrom: CourtPos = { ...START[0] };
let startH = HIT_HEIGHT_M;
let active: Active | null = null;
let wait = 0.8;

const sideOf = (i: number): SideIndex => (i < 2 ? 0 : 1);
const teamOf = (side: SideIndex): number[] => (side === 0 ? [0, 1] : [2, 3]);

function closest(team: number[], pos: CourtPos): number {
  let best = team[0];
  let bestD = Infinity;
  for (const i of team) {
    const p = court.players[i].group.position;
    const d = Math.hypot(p.x - pos.x, p.z + 10 - pos.z);
    if (d < bestD) (bestD = d), (best = i);
  }
  return best;
}

function resetRally(): void {
  stepIdx = 0;
  hitFrom = { ...START[0] };
  startH = HIT_HEIGHT_M;
  active = null;
  START.forEach((p, i) => court.placePlayer(i, p.x, p.z, true));
  court.clearTrail();
  court.setBall(START[0].x, START[0].z, HIT_HEIGHT_M);
  label.textContent = 'READY';
  wait = 1.0;
}

function startStep(): void {
  const step = SCRIPT[stepIdx];
  const side: SideIndex = stepIdx % 2 === 0 ? 0 : 1;
  const shot = shotById(step.shot);
  const hitter = closest(teamOf(side), hitFrom);
  const partner = teamOf(side).find((i) => i !== hitter) ?? hitter;
  court.placePlayer(hitter, hitFrom.x, hitFrom.z, true);

  const serve = shot.kind === 'serve';
  const landX = serve ? -Math.sign(hitFrom.x || 1) * (shot.landX ?? 3.5) : hitFrom.x > 0 ? -2.5 : 2.5;
  let flight: Flight;
  try {
    flight = buildFlight({
      from: hitFrom,
      startH,
      hitterSide: side,
      shot,
      landX,
      outcome: step.outcome,
      glass: serve ? undefined : step.glass,
      seed: 7 + stepIdx,
    });
  } catch (e) {
    console.error(`buildFlight failed for ${shot.id}`, e);
    resetRally();
    label.textContent = `ERROR ${shot.id}: ${String(e)}`;
    wait = 3;
    return;
  }

  court.players[hitter].swing(strokeFor(shot.id, shot.kind, hitFrom.x, landX));
  // The other team's nearest player runs to where the ball will be played; his partner covers the other lane.
  const defSide: SideIndex = side === 0 ? 1 : 0;
  if (step.outcome !== 'winner') {
    const def = closest(teamOf(defSide), flight.hit);
    const defPartner = teamOf(defSide).find((i) => i !== def) ?? def;
    court.placePlayer(def, flight.hit.x, flight.hit.z);
    court.placePlayer(defPartner, flight.hit.x > 0 ? -2.3 : 2.3, defSide === 0 ? 13.5 : 6.5);
  }
  court.placePlayer(partner, hitFrom.x > 0 ? -2.3 : 2.3, side === 0 ? 13.5 : 6.5);

  label.textContent = `${side === 0 ? 'NEAR' : 'FAR'} · ${shot.name.toUpperCase()}${step.outcome === 'winner' ? ' · WINNER' : ''}`;
  active = { flight, elapsed: 0, duration: flightDuration(flight) / 1000, fired: 0, hitter, side };
  court.clearTrail();
}

function finishStep(a: Active): void {
  const step = SCRIPT[stepIdx];
  if (step.outcome === 'winner' || stepIdx >= SCRIPT.length - 1) {
    active = null;
    stepIdx = SCRIPT.length; // wait, then restart
    wait = 1.6;
    return;
  }
  hitFrom = { ...a.flight.hit };
  startH = a.flight.hitH;
  stepIdx++;
  active = null;
  wait = 0.14;
}

function tick(dtReal: number): void {
  const dt = paused ? 0 : dtReal * (slow ? 0.3 : 1);
  if (!active) {
    wait -= dt;
    if (wait <= 0) {
      if (stepIdx >= SCRIPT.length) resetRally();
      else startStep();
    }
  } else {
    const a = active;
    a.elapsed += dt;
    const u = Math.min(1, a.elapsed / a.duration);
    const p = ballPoint(a.flight.path, u);
    court.setBall(p.x, p.z, p.h);
    const total = a.flight.path[a.flight.path.length - 1].t || 1;
    while (a.fired < a.flight.events.length && a.flight.events[a.fired].t / total <= u) {
      const e = a.flight.events[a.fired++];
      court.pulse(e.kind, e.x, e.z, e.h, e.kind === 'glass' ? 1.3 : 1);
    }
    if (u >= 1) finishStep(a);
  }
  // Players face the net side of the opponent and turn a little towards the ball.
  const ball = ballPoint(active?.flight.path ?? [{ t: 0, x: 0, z: 10, h: 0 }], 0.5);
  court.players.forEach((p, i) => p.face(sideOf(i) === 1, ball.x));
  court.frame(dtReal);
}

resetRally();
let last = performance.now();
function loop(now: number): void {
  // Never negative (the first rAF timestamp can be older than `last`) and capped after a stall.
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  tick(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
