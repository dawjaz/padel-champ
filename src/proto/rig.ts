// Stage B prototype (characters): the same toon character animated two ways, one above the other.
// Top "NOW": what MatchScene does today (fixed pose pictures, three in-between steps, run frames every 62 ms, a sine glide).
// Bottom "RIG": the pose is rebuilt every frame from keyframes with easing, anticipation, a hit-stop, overshoot, a racket smear,
// body springs (bodyDynamics.ts), a continuous run cycle with braking, head lag and look. Not part of the game build's logic.

import playersData from '../data/players.json';
import type { Appearance } from '../game/types';
import { FIG, POSES, buildToon, mixPose, runFrame, type PoseSpec, type ToonView } from '../art/toon/character';
import { drawOps } from '../art/toon/ops';
import { kickBody, newBody, runEase, stepBody, type BodyPose } from '../art/bodyDynamics';

type Pt = [number, number];
const AP = (playersData.you as unknown as Array<{ appearance: Appearance }>)[0].appearance;

const W = 360;
const PANEL = 236;
const H = PANEL * 2;
const UNIT = 0.5; // pixels per figure unit
const PPM = 188 * UNIT; // pixels per metre (the figure is ~1.8 m)
const GROUND_Y = PANEL - 26;

const canvas = document.getElementById('c') as HTMLCanvasElement;
const dpr = Math.min(3, window.devicePixelRatio || 1);
canvas.width = W * dpr;
canvas.height = H * dpr;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
const ctx = canvas.getContext('2d')!;

// ---------- easing and keyframes ----------
type Ease = (t: number) => number;
const lin: Ease = (t) => t;
const inOut: Ease = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const easeOut: Ease = (t) => 1 - (1 - t) ** 3;
const easeIn: Ease = (t) => t ** 3;
const sineInOut: Ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Keyframes: [time s, pose, ease used to arrive at this key]. */
type Key = [number, PoseSpec, Ease];
function sample(keys: Key[], t: number): PoseSpec {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, p1, e] = keys[i];
    const t0 = keys[i - 1][0];
    if (t <= t1) return mixPose(keys[i - 1][1], p1, e(t1 > t0 ? (t - t0) / (t1 - t0) : 1));
  }
  return keys[keys.length - 1][1];
}
const tweak = (p: PoseSpec, d: Partial<PoseSpec> & { dRacket?: number; dCrouch?: number; dLean?: number; dHand?: Pt }): PoseSpec => ({
  ...p,
  ...d,
  racket: (d.racket ?? p.racket) + (d.dRacket ?? 0),
  crouch: (d.crouch ?? p.crouch) + (d.dCrouch ?? 0),
  lean: (d.lean ?? p.lean) + (d.dLean ?? 0),
  hand: d.dHand ? [p.hand[0] + d.dHand[0], p.hand[1] + d.dHand[1]] : d.hand ?? p.hand,
});

/** Today's `blendTo`: three in-between pictures, then the pose (steps, not a glide). */
function stepBlend(from: PoseSpec, to: PoseSpec, ms: number, elapsed: number): PoseSpec {
  const step = Math.min(4, Math.floor(elapsed / (ms / 4)) + 1);
  return step >= 4 ? to : mixPose(from, to, step / 4);
}

// ---------- drawing ----------
interface Figure {
  x: number;
  lift: number; // metres
  pose: PoseSpec;
  view: ToonView;
  mirror: boolean;
  body?: BodyPose;
}

function racketPoint(P: PoseSpec, lx: number, ly: number): Pt {
  const r = (P.racket * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const e = P.hand[0] - 12 * s;
  const f = P.hand[1] - c * -12;
  const x = c * lx - s * ly + e;
  const y = s * lx + c * ly + f;
  const L = (P.lean * Math.PI) / 180;
  const lc = Math.cos(L);
  const ls = Math.sin(L);
  return [lc * (x - 100) - ls * (y - 190) + 100, ls * (x - 100) + lc * (y - 190) + 190 + P.crouch];
}

function withFigure(f: Figure, y0: number, draw: () => void): void {
  ctx.save();
  ctx.translate(f.x, y0 + GROUND_Y - f.lift * PPM - (f.body?.bob ?? 0) * PPM);
  if (f.body) {
    ctx.rotate(f.body.rotation);
    ctx.scale(f.body.scaleX, f.body.scaleY);
  }
  if (f.mirror) ctx.scale(-1, 1);
  ctx.scale(UNIT, UNIT);
  ctx.translate(-FIG.cx, -(FIG.feet + 2));
  draw();
  ctx.restore();
}

function drawFigure(f: Figure, y0: number): number {
  const t0 = performance.now();
  const ops = buildToon(AP, f.view, f.pose, true);
  withFigure(f, y0, () => drawOps(ctx, ops));
  return performance.now() - t0;
}

/** Racket smear: a fading band through the last positions of the racket face. */
function drawSmear(f: Figure, y0: number, trail: Array<[Pt, Pt]>): void {
  if (trail.length < 2) return;
  withFigure(f, y0, () => {
    for (let i = 1; i < trail.length; i++) {
      const [a1, b1] = trail[i - 1];
      const [a2, b2] = trail[i];
      ctx.globalAlpha = (i / trail.length) * 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(a1[0], a1[1]);
      ctx.lineTo(b1[0], b1[1]);
      ctx.lineTo(b2[0], b2[1]);
      ctx.lineTo(a2[0], a2[1]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

function drawCourt(y0: number, label: string): void {
  const g = ctx.createLinearGradient(0, y0, 0, y0 + PANEL);
  g.addColorStop(0, '#3a7cc4');
  g.addColorStop(1, '#2a62a6');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, PANEL);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y0 + GROUND_Y + 8);
  ctx.lineTo(W, y0 + GROUND_Y + 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(11,42,91,0.75)';
  ctx.fillRect(8, y0 + 8, label.length * 8 + 16, 22);
  ctx.fillStyle = '#ffe066';
  ctx.font = '800 13px "Trebuchet MS", sans-serif';
  ctx.fillText(label, 16, y0 + 24);
}

function drawBall(x: number, y: number): void {
  ctx.fillStyle = 'rgba(11,31,58,0.25)';
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#e4f04a';
  ctx.fill();
  ctx.strokeStyle = '#0b2a5b';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

interface Puff { x: number; y: number; t: number; dir: number }
const puffs: Puff[] = [];
function drawPuffs(now: number): void {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    const k = (now - p.t) / 0.4;
    if (k >= 1) {
      puffs.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = 0.7 * (1 - k);
    ctx.fillStyle = '#f3e6c8';
    ctx.beginPath();
    ctx.ellipse(p.x + p.dir * k * 22, p.y, 8 + 14 * k, 3 + 4 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---------- clips ----------
type Clip = 'run' | 'forehand' | 'backhand' | 'smash' | 'waiting';
const CLIPS: Array<[Clip, string]> = [['run', 'RUN + BRAKE'], ['forehand', 'FOREHAND'], ['backhand', 'BACKHAND'], ['smash', 'SMASH'], ['waiting', 'WAITING']];
const PERIOD: Record<Clip, number> = { run: 3.2, forehand: 2, backhand: 2, smash: 2.4, waiting: 4 };
let clip: Clip = 'forehand';
let slow = false;
let view: ToonView = 'back';

const body = newBody(0.4);
let trail: Array<[Pt, Pt]> = [];
let lastRig: PoseSpec | null = null;
let lastRigX = 0;
let lastT = -1;
let headLag: Pt = [0, 0];
let wasAir = false;
let hitKicked = false;
let lastBrakeT = -1;

function strokeKeys(prep: PoseSpec, hit: PoseSpec, follow: PoseSpec, tHit: number, sign: number): Key[] {
  const R = POSES.ready;
  const load = tweak(prep, { dCrouch: 6, dRacket: 14 * sign, dLean: 3 * sign, dHand: [8 * sign, -4] });
  const over = tweak(follow, { dRacket: -22 * sign, dHand: [-10 * sign, -8], dLean: -3 * sign });
  return [
    [0, R, lin],
    [tHit - 0.5, R, lin],
    [tHit - 0.14, load, inOut], // anticipation: wind up further than the pose
    [tHit - 0.07, load, lin], // a tiny hold before the snap
    [tHit, hit, easeIn], // the racket accelerates into the ball
    [tHit + 0.05, hit, lin], // hit-stop
    [tHit + 0.2, over, easeOut], // follow-through overshoots
    [tHit + 0.34, follow, inOut],
    [tHit + 0.75, R, inOut],
  ];
}

function nowStroke(prep: PoseSpec, hit: PoseSpec, follow: PoseSpec, tHit: number, t: number): PoseSpec {
  const R = POSES.ready;
  if (t < tHit - 0.4) return R;
  if (t < tHit) return prep;
  const ms = (t - tHit) * 1000;
  if (ms < 80) return stepBlend(prep, hit, 70, ms);
  if (ms < 220) return stepBlend(hit, follow, 110, ms - 80);
  if (ms < 420) return stepBlend(follow, R, 200, ms - 220);
  return R;
}

/** Ball path through a contact point (screen), arriving from `fromX` and leaving to `toX`. */
function ball(t: number, tHit: number, contact: Pt, fromX: number, toX: number, y0: number, drop = false): Pt | null {
  if (t < tHit - 0.5 || t > tHit + 0.4) return null;
  if (t <= tHit) {
    const k = (t - (tHit - 0.5)) / 0.5;
    if (drop) return [contact[0] + 30 * (1 - k), y0 + contact[1] - 150 * (1 - k) * (1 - k)];
    return [fromX + (contact[0] - fromX) * k, y0 + contact[1] - 40 * Math.sin(Math.PI * k) * (1 - k)];
  }
  const k = (t - tHit) / 0.4;
  return [contact[0] + (toX - contact[0]) * k, y0 + contact[1] + (drop ? 140 * k : -60 * k + 40 * k * k)];
}

function screenOf(f: Figure, p: Pt): Pt {
  let x = (p[0] - FIG.cx) * UNIT;
  const y = (p[1] - (FIG.feet + 2)) * UNIT;
  if (f.mirror) x = -x;
  return [f.x + x, GROUND_Y - f.lift * PPM + y];
}

let rigMs = 0;
let rigN = 0;

function frame(nowMs: number): void {
  const real = nowMs / 1000;
  const speed = slow ? 0.25 : 1;
  const clock = (frame as unknown as { c?: number }).c ?? 0;
  const prevReal = (frame as unknown as { r?: number }).r ?? real;
  const c = clock + (real - prevReal) * speed;
  (frame as unknown as { c: number }).c = c;
  (frame as unknown as { r: number }).r = real;
  const P = PERIOD[clip];
  const t = c % P;
  if (t < lastT) {
    trail = [];
    hitKicked = false;
  }
  const dt = lastT < 0 || t < lastT ? 1 / 60 : t - lastT;
  lastT = t;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCourt(0, 'NOW (in the game today)');
  drawCourt(PANEL, 'RIG (prototype)');

  const front = view === 'front';
  const mirror = front; // the game mirrors the front view (right-handed players)
  let now: Figure;
  let rig: Figure;
  let ballPt: Pt | null = null;
  let ballPtRig: Pt | null = null;

  if (clip === 'run') {
    // 0..1.0 run right, stand to 1.6, 1.6..2.6 run left, stand to 3.2
    const x0 = 70;
    const x1 = 290;
    const leg = t < 1.6 ? 0 : 1;
    const u = clamp((t - leg * 1.6) / 1.0, 0, 1);
    const from = leg === 0 ? x0 : x1;
    const to = leg === 0 ? x1 : x0;
    const goingLeft = leg === 1;
    // NOW: sine glide, run pictures every 62 ms, the ready picture when it arrives
    const nx = from + (to - from) * sineInOut(u);
    const running = u > 0 && u < 0.97;
    now = running
      ? { x: nx, lift: 0, pose: runFrame(Math.floor((t * 1000) / 62)), view: 'side', mirror: goingLeft }
      : { x: nx, lift: 0, pose: POSES.ready, view, mirror };
    // RIG: quick start, long brake, continuous run cycle, a braking pose blended in, springs on the body
    const rx = from + (to - from) * runEase(u);
    const cycle = (body.stride / 1.7) * 8;
    const brake: PoseSpec = { ...POSES.ready, lean: -9, crouch: 18, left: [58, 304], right: [142, 304], hand: [132, 146], racket: 18, off: [44, 150] };
    let pose: PoseSpec = runFrame(cycle);
    if (u > 0.72 && u < 1) pose = mixPose(pose, brake, clamp((u - 0.72) / 0.22, 0, 1));
    const rRunning = u > 0 && u < 1;
    const settle = t - (leg * 1.6 + 1.0);
    if (!rRunning && settle >= 0 && settle < 0.25) pose = mixPose(brake, POSES.ready, easeOut(settle / 0.25));
    rig = { x: rx, lift: 0, pose: rRunning ? pose : settle >= 0 && settle < 0.25 ? pose : POSES.ready, view: rRunning ? 'side' : view, mirror: rRunning ? goingLeft : mirror };
    if (u > 0.02 && u < 0.05 && !hitKicked) {
      kickBody(body, -0.9);
      hitKicked = true;
    }
    if (u >= 1) hitKicked = false;
  } else if (clip === 'waiting') {
    now = { x: W / 2, lift: 0, pose: POSES.ready, view, mirror };
    const bounce = Math.sin(t * Math.PI * 2 * 2.1);
    const ballX = W / 2 + Math.sin((t / P) * Math.PI * 2) * 150;
    const look = clamp((ballX - W / 2) / 120, -1, 1) * (front ? -1 : 1);
    const shift = Math.sin((t / P) * Math.PI * 4) * 3;
    const pose: PoseSpec = { ...POSES.ready, crouch: 10 + 2.5 * Math.max(0, bounce), left: [66 + shift, 304 - 3 * Math.max(0, -bounce)], right: [134 + shift, 304 - 3 * Math.max(0, -bounce)], look, lean: shift * 0.6 };
    rig = { x: W / 2, lift: 0, pose, view, mirror };
    ballPt = [ballX, 60];
    ballPtRig = [ballX, PANEL + 60];
  } else {
    const fh = clip === 'forehand';
    const sm = clip === 'smash';
    const tHit = sm ? 1.1 : 0.9;
    const [prep, hit, follow] = sm ? [POSES.smashPrep, POSES.smashHit, POSES.smashFollow] : fh ? [POSES.fhPrep, POSES.fhHit, POSES.fhFollow] : [POSES.bhPrep, POSES.bhHit, POSES.bhFollow];
    const sign = fh || sm ? 1 : -1;
    // NOW
    let nLift = 0;
    if (sm) {
      const ms = (t - tHit) * 1000;
      if (ms >= 0 && ms < 300) nLift = (13 / PPM) * (ms < 150 ? easeOut(ms / 150) : 1 - (1 - easeOut((300 - ms) / 150)));
    }
    now = { x: W / 2, lift: nLift, pose: nowStroke(prep, hit, follow, tHit, t), view, mirror };
    // RIG
    let keys = strokeKeys(prep, hit, follow, tHit, sign);
    let lift = 0;
    if (sm) {
      const crouchLoad = tweak(prep, { dCrouch: 14, dRacket: -16, hand: [166, 52] });
      const air = tweak(prep, { crouch: -16, dRacket: -30 });
      keys = [
        [0, POSES.ready, lin],
        [tHit - 0.7, POSES.ready, lin],
        [tHit - 0.32, crouchLoad, inOut],
        [tHit - 0.18, air, easeOut],
        [tHit, hit, easeIn],
        [tHit + 0.05, hit, lin],
        [tHit + 0.22, tweak(follow, { dRacket: -20, crouch: -6 }), easeOut],
        [tHit + 0.36, tweak(follow, { dCrouch: 16 }), easeIn], // landing: knees give
        [tHit + 0.8, POSES.ready, inOut],
      ];
      const a = tHit - 0.2;
      const b = tHit + 0.33;
      if (t > a && t < b) {
        const k = (t - a) / (b - a);
        lift = 0.42 * 4 * k * (1 - k);
      }
    }
    let pose = sample(keys, t);
    // head: trails the body a little and looks towards the ball side
    rig = { x: W / 2, lift, pose, view, mirror };
    const air = lift > 0.01;
    if (wasAir && !air) kickBody(body, -2.2);
    if (!wasAir && air) kickBody(body, 1.2);
    wasAir = air;
    if (!hitKicked && t >= tHit) {
      kickBody(body, 1.3);
      hitKicked = true;
    }
    // racket smear while the racket moves fast
    if (lastRig) {
      const a1 = racketPoint(lastRig, 0, -44);
      const b1 = racketPoint(lastRig, 0, -100);
      const a2 = racketPoint(pose, 0, -44);
      const b2 = racketPoint(pose, 0, -100);
      const fast = Math.hypot(b2[0] - b1[0], b2[1] - b1[1]) / Math.max(dt, 1e-3) > 900;
      if (fast) trail.push([a2, b2]);
      else if (trail.length) trail.shift();
      if (trail.length > 7) trail.shift();
      void a1;
    }
    const handV: Pt = lastRig ? [(pose.hand[0] - lastRig.hand[0]) / Math.max(dt, 1e-3), (pose.hand[1] - lastRig.hand[1]) / Math.max(dt, 1e-3)] : [0, 0];
    const target: Pt = [clamp(-handV[0] * 0.006, -6, 6), clamp(-handV[1] * 0.004 + (pose.crouch - 10) * 0.15, -6, 6)];
    headLag = [headLag[0] + (target[0] - headLag[0]) * Math.min(1, dt * 12), headLag[1] + (target[1] - headLag[1]) * Math.min(1, dt * 12)];
    pose = { ...pose, head: headLag, look: (sign * 0.5) * (front ? -1 : 1) };
    rig.pose = pose;
    // ball (both panels): through the racket face of the hit pose
    const contactFig = racketPoint(hit, 0, -70);
    const cN = screenOf({ ...now, lift: sm ? 13 / PPM : 0 }, contactFig);
    const cR = screenOf({ ...rig, lift: sm ? 0.42 * 4 * (0.2 / 0.53) * (1 - 0.2 / 0.53) : 0 }, contactFig);
    const fromX = (fh ? W + 20 : -20) * (front ? 1 : 1);
    const toX = fh ? -20 : W + 20;
    ballPt = ball(t, tHit, cN, mirror ? W - fromX : fromX, mirror ? W - toX : toX, 0, sm);
    ballPtRig = ball(t, tHit, cR, mirror ? W - fromX : fromX, mirror ? W - toX : toX, PANEL, sm);
    // hit-stop: the whole rig panel holds still for 50 ms (pose already holds; the ball waits at the racket)
  }

  // body springs from the rig figure's movement
  const dxm = (rig.x - lastRigX) / PPM;
  lastRigX = rig.x;
  const look = stepBody(body, Math.abs(dxm) > 0.5 ? 0 : dxm, 0, dt, t, clip === 'waiting');
  if (look.braked && t - lastBrakeT > 0.3) {
    lastBrakeT = t;
    puffs.push({ x: rig.x - Math.sign(body.vx || 1) * 18, y: PANEL + GROUND_Y + 4, t: real, dir: -Math.sign(body.vx || 1) }, { x: rig.x - Math.sign(body.vx || 1) * 30, y: PANEL + GROUND_Y + 6, t: real + 0.04, dir: -Math.sign(body.vx || 1) });
  }
  rig.body = look;

  // shadows
  for (const [f, y0] of [[now, 0], [rig, PANEL]] as Array<[Figure, number]>) {
    ctx.fillStyle = 'rgba(11,31,58,0.28)';
    ctx.beginPath();
    ctx.ellipse(f.x, y0 + GROUND_Y + 4, 32 - f.lift * 30, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  drawFigure(now, 0);
  if (clip !== 'run' && clip !== 'waiting') drawSmear(rig, PANEL, trail);
  rigMs += drawFigure(rig, PANEL);
  rigN++;
  drawPuffs(real);
  if (ballPt) drawBall(ballPt[0], ballPt[1]);
  if (ballPtRig) drawBall(ballPtRig[0], ballPtRig[1]);
  lastRig = rig.pose;

  if (rigN >= 60) {
    stats.textContent = `rig: ${(rigMs / rigN).toFixed(2)} ms per figure per frame (build + draw)${slow ? ' · slow motion x0.25' : ''}`;
    rigMs = 0;
    rigN = 0;
  }
  requestAnimationFrame(frame);
}

// ---------- UI ----------
const stats = document.getElementById('stats') as HTMLDivElement;
const clipsRow = document.getElementById('clips') as HTMLDivElement;
const optsRow = document.getElementById('opts') as HTMLDivElement;
function buttons(): void {
  clipsRow.innerHTML = '';
  for (const [id, label] of CLIPS) {
    const b = document.createElement('button');
    b.textContent = label;
    if (id === clip) b.className = 'on';
    b.onclick = () => {
      clip = id;
      (frame as unknown as { c: number }).c = 0;
      lastT = -1;
      trail = [];
      lastRig = null;
      buttons();
    };
    clipsRow.appendChild(b);
  }
  optsRow.innerHTML = '';
  const s = document.createElement('button');
  s.textContent = slow ? 'SLOW MOTION: ON' : 'SLOW MOTION: OFF';
  if (slow) s.className = 'on';
  s.onclick = () => {
    slow = !slow;
    buttons();
  };
  optsRow.appendChild(s);
  const v = document.createElement('button');
  v.textContent = view === 'back' ? 'VIEW: HERO (BACK)' : 'VIEW: RIVAL (FRONT)';
  v.onclick = () => {
    view = view === 'back' ? 'front' : 'back';
    buttons();
  };
  optsRow.appendChild(v);
}
buttons();
requestAnimationFrame(frame);
