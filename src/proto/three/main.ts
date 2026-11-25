// 3D prototype page (proto/three.html): the match in 3D (court, arena, four toon players, the game's own engine and ball flights)
// and short cinematic cut-ins rendered live: tournament intro, before the match, game won / lost, match won, tournament won,
// second place, early exit, and a slow-motion moment on a winning smash. Each occasion has a few variants, picked at random.

import * as THREE from 'three';
import { themeById } from '../../art/hd/courtThemes';
import { buildArena, P, toonGradient } from './arena';
import { Player3D, POSE, READY, type Pose3D } from './player3d';
import { Actor, Rally, TEAMS, type Track } from './rally';
import type { SideIndex } from '../../game/types';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const wrap = document.getElementById('wrap') as HTMLDivElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const theme = themeById('blue');
scene.background = new THREE.Color(theme.skyTop);
scene.fog = new THREE.Fog(new THREE.Color(theme.skyTop), 40, 90);
scene.add(new THREE.HemisphereLight(0xffffff, 0x5a6c8f, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-6, 14, 10);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 200);
const BROADCAST = { pos: P(0, 33.5, 12.5), look: P(0, 9.2, 0) };

const resize = (): void => {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
window.addEventListener('resize', resize);
resize();

const arena = buildArena(theme);
scene.add(arena.group);
const grad = toonGradient();
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x0b1f3a, transparent: true, opacity: 0.28, depthWrite: false });

const actors: Actor[] = [];
([0, 1] as SideIndex[]).forEach((side) =>
  TEAMS[side].forEach((p) => {
    const m = new Player3D(p.appearance, grad);
    const a = new Actor(p, side, m, shadowMat);
    scene.add(m.root);
    scene.add(a.shadow);
    actors.push(a);
  }),
);

const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshToonMaterial({ color: 0xe4f04a, gradientMap: grad }));
const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), shadowMat);
ballShadow.rotation.x = -Math.PI / 2;
scene.add(ballMesh, ballShadow);

// a trophy for the tournament cut-ins (a lathed cup)
const cupProfile = [[0, 0], [0.13, 0], [0.13, 0.03], [0.04, 0.06], [0.03, 0.18], [0.1, 0.22], [0.15, 0.36], [0.16, 0.44], [0.14, 0.44]].map(([x, y]) => new THREE.Vector2(x, y));
const cupMat = new THREE.MeshToonMaterial({ color: 0xf5c542, gradientMap: grad });
const cup = new THREE.Mesh(new THREE.LatheGeometry(cupProfile, 20), cupMat);
cup.scale.setScalar(0.8);
cup.visible = false;
scene.add(cup);

// ---------- HUD ----------
const scoreEl = document.getElementById('score') as HTMLDivElement;
const fpsEl = document.getElementById('fps') as HTMLDivElement;
const titleEl = document.getElementById('title') as HTMLDivElement;
const skipEl = document.getElementById('skip') as HTMLDivElement;
const showTitle = (big: string, small = ''): void => {
  (titleEl.querySelector('.big') as HTMLDivElement).textContent = big;
  (titleEl.querySelector('.small') as HTMLDivElement).textContent = small;
  titleEl.style.opacity = big ? '1' : '0';
};
const PTS = ['0', '15', '30', '40', 'AD'];

// ---------- time (slow motion scales it) ----------
let simTime = 0;
let timeScale = 1;
let slowUntil = 0;

const rally = new Rally(actors, {
  onHit: (a, step) => {
    // a winning smash: a moment of slow motion with the camera close on the hitter (live, not a recording)
    if (step.outcome === 'winner' && a.jumpStart >= 0 && !cut) {
      timeScale = 0.28;
      slowUntil = performance.now() / 1000 + 1.6;
      slowTarget = a;
    }
  },
  onPointOver: (step, winner, score) => {
    scoreEl.textContent = `${PTS[Math.min(4, score.points[0])]}-${PTS[Math.min(4, score.points[1])]}  ·  GAMES ${score.games[0]}-${score.games[1]}`;
    arena.cheer(simTime, 1);
    cheerUntil = simTime + 1.6;
    // reactions: the winners pump a fist, the losers drop their shoulders
    const now = simTime;
    for (const a of actors) {
      if (a.track) continue;
      a.play(a.side === winner ? react.fist() : step.outcome === 'error' && a.def.id === TEAMS[step.side][step.attackerIdx].id ? react.head() : react.slump(), now + 0.35);
    }
  },
});
let slowTarget: Actor | null = null;
let cheerUntil = 0;

const lin = (t: number): number => t;
const sm = (t: number): number => t * t * (3 - 2 * t);
const out = (t: number): number => 1 - (1 - t) ** 3;
const react = {
  fist: (): Track => [[0.2, POSE.fist, out], [0.35, POSE.fistDown, sm], [0.5, POSE.fist, out], [1.1, POSE.fist, lin], [1.5, READY, sm]],
  slump: (): Track => [[0.35, POSE.slump, sm], [1.3, POSE.slump, lin], [1.7, READY, sm]],
  head: (): Track => [[0.28, POSE.headHands, out], [1.0, POSE.headHands, lin], [1.3, POSE.slump, sm], [1.9, READY, sm]],
  arms: (): Track => [[0.22, POSE.arms, out], [2.4, POSE.arms, lin], [2.8, READY, sm]],
  racket: (): Track => [[0.22, POSE.racketUp, out], [2.0, POSE.racketUp, lin], [2.4, READY, sm]],
  wave: (): Track => [[0.25, POSE.wave, out], [0.5, { ...POSE.wave, lShoulder: [2.3, 0.5, 0] as [number, number, number] }, sm], [0.75, POSE.wave, sm], [1.0, { ...POSE.wave, lShoulder: [2.3, 0.5, 0] as [number, number, number] }, sm], [1.3, POSE.wave, sm], [2.6, READY, sm]],
  tall: (): Track => [[0.3, POSE.standTall, sm], [3, POSE.standTall, lin]],
  trophy: (): Track => [[0.4, POSE.trophy, out], [3.5, POSE.trophy, lin]],
  hold: (p: Pose3D, s: number): Track => [[0.3, p, sm], [s, p, lin], [s + 0.4, READY, sm]],
};

// ---------- cut-ins ----------
interface Shot {
  dur: number;
  from: { pos: THREE.Vector3; look: THREE.Vector3 };
  to: { pos: THREE.Vector3; look: THREE.Vector3 };
  title?: [string, string];
  start?: () => void;
}
interface CutIn {
  name: string;
  shots: Shot[];
}
let cut: { c: CutIn; i: number; t0: number } | null = null;

const near = (): Actor[] => actors.filter((a) => a.side === 0);
const far = (): Actor[] => actors.filter((a) => a.side === 1);
const mid = (as: Actor[]): THREE.Vector3 => {
  const v = new THREE.Vector3();
  for (const a of as) v.add(P(a.pos.x, a.pos.y, 1.1));
  return v.multiplyScalar(1 / as.length);
};
const playAll = (as: Actor[], mk: () => Track): void => as.forEach((a, i) => a.play(mk(), simTime + i * 0.12));
const jumpAll = (as: Actor[], h: number, delay = 0): void => as.forEach((a) => setTimeout(() => a.jump(simTime, h, 0.4), delay * 1000));
/** Puts the players at the net for a face-off (a cut-in may place them: the camera is elsewhere when it starts). */
const toNet = (): void => {
  for (const a of actors) {
    const i = TEAMS[a.side].findIndex((p) => p.id === a.def.id);
    const x = (i === 0 ? -1 : 1) * (a.side === 0 ? 1.4 : -1.4);
    a.pos.set(x, a.side === 0 ? 11.4 : 8.6);
    a.target.copy(a.pos);
  }
};
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const orbit = (centre: THREE.Vector3, r: number, h: number, ang: number): THREE.Vector3 => new THREE.Vector3(centre.x + Math.sin(ang) * r, centre.y + h, centre.z + Math.cos(ang) * r);
const holdCup = (a: Actor | null, color = 0xf5c542): void => {
  cupMat.color.set(color);
  cup.visible = a !== null;
  heldBy = a;
};
let heldBy: Actor | null = null;

const CUTS: Record<string, () => CutIn> = {
  'TOURNAMENT INTRO': () =>
    pick([
      { name: 'orbit', shots: [{ dur: 3.2, from: { pos: orbit(P(0, 10), 26, 16, -1.2), look: P(0, 10) }, to: { pos: orbit(P(0, 10), 26, 11, 0.6), look: P(0, 10) }, title: ['REGIONAL OPEN', 'WARSAW · ROUND OF 16'], start: () => playAll(actors, react.wave) }, { dur: 1.4, from: { pos: orbit(P(0, 10), 26, 11, 0.6), look: P(0, 10) }, to: BROADCAST }] },
      { name: 'flyover', shots: [{ dur: 3, from: { pos: P(0, -12, 14), look: P(0, 6) }, to: { pos: P(0, 26, 5), look: P(0, 12) }, title: ['REGIONAL OPEN', 'WARSAW'], start: () => playAll(actors, react.wave) }, { dur: 1.2, from: { pos: P(0, 26, 5), look: P(0, 12) }, to: BROADCAST }] },
      { name: 'crane', shots: [{ dur: 3, from: { pos: P(-3, 13, 0.8), look: P(0, 10, 1.2) }, to: { pos: P(-6, 26, 12), look: P(0, 9) }, title: ['REGIONAL OPEN', 'LET THE TOURNAMENT BEGIN'], start: () => playAll(actors, react.tall) }, { dur: 1.2, from: { pos: P(-6, 26, 12), look: P(0, 9) }, to: BROADCAST }] },
    ]),
  'BEFORE THE MATCH': () => {
    toNet();
    const n = near();
    const f = far();
    return pick([
      { name: 'pairs', shots: [
        { dur: 1.8, from: { pos: mid(n).add(new THREE.Vector3(0.5, 0.3, -2.3)), look: mid(n) }, to: { pos: mid(n).add(new THREE.Vector3(-0.3, 0.2, -1.9)), look: mid(n) }, title: [`${TEAMS[0][0].name.toUpperCase()} & ${TEAMS[0][1].name.toUpperCase()}`, 'YOUR PAIR'], start: () => playAll(n, () => react.hold(POSE.fist, 1.4)) },
        { dur: 1.8, from: { pos: mid(f).add(new THREE.Vector3(-0.5, 0.3, 2.3)), look: mid(f) }, to: { pos: mid(f).add(new THREE.Vector3(0.3, 0.2, 1.9)), look: mid(f) }, title: [`${TEAMS[1][0].name.toUpperCase()} & ${TEAMS[1][1].name.toUpperCase()}`, 'THE OPPONENTS'], start: () => playAll(f, () => react.hold(POSE.racketUp, 1.4)) },
        { dur: 1.1, from: { pos: P(0, 24, 6), look: P(0, 10) }, to: BROADCAST, title: ['GAME ON!', ''] },
      ] },
      { name: 'face off', shots: [
        { dur: 2.4, from: { pos: P(5.5, 10, 1.4), look: P(0, 10, 1.2) }, to: { pos: P(4.2, 10, 1.6), look: P(0, 10, 1.2) }, title: ['FACE OFF', `${TEAMS[0][0].name} / ${TEAMS[0][1].name}  vs  ${TEAMS[1][0].name} / ${TEAMS[1][1].name}`], start: () => playAll(actors, react.tall) },
        { dur: 1.1, from: { pos: P(4.2, 10, 1.6), look: P(0, 10, 1.2) }, to: BROADCAST },
      ] },
    ]);
  },
  'GAME WON': () => {
    const n = near();
    return pick([
      { name: 'high five', shots: [{ dur: 2.4, from: { pos: mid(n).add(new THREE.Vector3(0, 0.6, -4.5)), look: mid(n) }, to: { pos: mid(n).add(new THREE.Vector3(0, 0.3, -3)), look: mid(n) }, title: ['GAME!', 'GREAT WORK'], start: () => { playAll(n, react.racket); jumpAll(n, 0.18, 0.15); arena.cheer(simTime, 1); cheerUntil = simTime + 2.4; } }, { dur: 1, from: { pos: mid(n).add(new THREE.Vector3(0, 0.3, -3)), look: mid(n) }, to: BROADCAST }] },
      { name: 'jump', shots: [{ dur: 2.4, from: { pos: orbit(mid(n), 4, 0.4, 2.6), look: mid(n) }, to: { pos: orbit(mid(n), 4, 0.8, 3.6), look: mid(n) }, title: ['GAME!', ''], start: () => { playAll(n, react.arms); jumpAll(n, 0.3, 0.1); cheerUntil = simTime + 2.4; } }, { dur: 1, from: { pos: orbit(mid(n), 4, 0.8, 3.6), look: mid(n) }, to: BROADCAST }] },
      { name: 'fist', shots: [{ dur: 2.2, from: { pos: mid(n).add(new THREE.Vector3(2, -0.4, -2.5)), look: mid(n) }, to: { pos: mid(n).add(new THREE.Vector3(1, -0.2, -2)), look: mid(n) }, title: ['GAME!', 'VAMOS!'], start: () => { playAll(n, react.fist); cheerUntil = simTime + 2; } }, { dur: 1, from: { pos: mid(n).add(new THREE.Vector3(1, -0.2, -2)), look: mid(n) }, to: BROADCAST }] },
    ]);
  },
  'GAME LOST': () => {
    const n = near();
    return pick([
      { name: 'slump', shots: [{ dur: 2.4, from: { pos: mid(n).add(new THREE.Vector3(0, 1.4, -4)), look: mid(n) }, to: { pos: mid(n).add(new THREE.Vector3(0, 1.0, -3)), look: mid(n) }, title: ['GAME LOST', 'KEEP FIGHTING'], start: () => playAll(n, react.slump) }, { dur: 1, from: { pos: mid(n).add(new THREE.Vector3(0, 1, -3)), look: mid(n) }, to: BROADCAST }] },
      { name: 'hands on head', shots: [{ dur: 2.4, from: { pos: mid(n).add(new THREE.Vector3(-2, 0.2, -3)), look: mid(n) }, to: { pos: mid(n).add(new THREE.Vector3(-1.2, 0.2, -2.4)), look: mid(n) }, title: ['GAME LOST', ''], start: () => playAll(n, react.head) }, { dur: 1, from: { pos: mid(n).add(new THREE.Vector3(-1.2, 0.2, -2.4)), look: mid(n) }, to: BROADCAST }] },
    ]);
  },
  'MATCH WON': () => {
    const n = near();
    return pick([
      { name: 'circle', shots: [{ dur: 3.4, from: { pos: orbit(mid(n), 5, 0.6, 2.2), look: mid(n) }, to: { pos: orbit(mid(n), 5, 1.4, 4.4), look: mid(n) }, title: ['MATCH WON!', `${TEAMS[0][0].name} & ${TEAMS[0][1].name}`], start: () => { playAll(n, react.arms); jumpAll(n, 0.35, 0.1); jumpAll(n, 0.3, 0.7); cheerUntil = simTime + 3.4; playAll(far(), react.slump); } }, { dur: 1, from: { pos: orbit(mid(n), 5, 1.4, 4.4), look: mid(n) }, to: BROADCAST }] },
      { name: 'crowd', shots: [{ dur: 3, from: { pos: P(0, 30, 2), look: mid(n) }, to: { pos: P(0, 24, 3.5), look: mid(n) }, title: ['VICTORY!', ''], start: () => { playAll(n, react.racket); jumpAll(n, 0.3, 0.2); cheerUntil = simTime + 3; } }, { dur: 1, from: { pos: P(0, 24, 3.5), look: mid(n) }, to: BROADCAST }] },
    ]);
  },
  'TOURNAMENT WON': () => {
    const a = near()[0];
    return pick([
      { name: 'trophy lift', shots: [{ dur: 3.6, from: { pos: P(a.pos.x, a.pos.y - 2.4, 1.2), look: P(a.pos.x, a.pos.y, 1.6) }, to: { pos: P(a.pos.x + 1.5, a.pos.y - 3.4, 0.6), look: P(a.pos.x, a.pos.y, 2.2) }, title: ['CHAMPIONS!', 'REGIONAL OPEN WARSAW'], start: () => { a.play(react.trophy(), simTime); holdCup(a); playAll([near()[1]], react.arms); jumpAll([near()[1]], 0.3, 0.3); cheerUntil = simTime + 3.6; } }, { dur: 1.2, from: { pos: P(a.pos.x + 1.5, a.pos.y - 3.4, 0.6), look: P(a.pos.x, a.pos.y, 2.2) }, to: BROADCAST, start: () => setTimeout(() => holdCup(null), 1200) }] },
      { name: 'confetti orbit', shots: [{ dur: 3.6, from: { pos: orbit(P(a.pos.x, a.pos.y, 1.2), 2.8, 0.5, 2.8), look: P(a.pos.x, a.pos.y, 1.6) }, to: { pos: orbit(P(a.pos.x, a.pos.y, 1.2), 2.8, 1.8, 4.6), look: P(a.pos.x, a.pos.y, 1.8) }, title: ['CHAMPIONS!', ''], start: () => { a.play(react.trophy(), simTime); holdCup(a); jumpAll([a], 0.2, 0.3); cheerUntil = simTime + 3.6; } }, { dur: 1.2, from: { pos: orbit(P(a.pos.x, a.pos.y, 1.2), 2.8, 1.8, 4.6), look: P(a.pos.x, a.pos.y, 1.8) }, to: BROADCAST, start: () => setTimeout(() => holdCup(null), 1200) }] },
    ]);
  },
  'SECOND PLACE': () => {
    const a = near()[0];
    return { name: 'silver', shots: [{ dur: 3.2, from: { pos: P(a.pos.x - 1, a.pos.y - 3, 1.4), look: P(a.pos.x, a.pos.y, 1.5) }, to: { pos: P(a.pos.x - 0.5, a.pos.y - 2.4, 1.2), look: P(a.pos.x, a.pos.y, 1.6) }, title: ['RUNNERS-UP', 'A FINAL TO BE PROUD OF'], start: () => { a.play(react.hold({ ...POSE.trophy, rShoulder: [1.6, 0.3, 0], lShoulder: [1.6, 0.3, 0] }, 3), simTime); holdCup(a, 0xc9d3de); playAll([near()[1]], react.wave); } }, { dur: 1.1, from: { pos: P(a.pos.x - 0.5, a.pos.y - 2.4, 1.2), look: P(a.pos.x, a.pos.y, 1.6) }, to: BROADCAST, start: () => setTimeout(() => holdCup(null), 1100) }] };
  },
  'EARLY EXIT': () => {
    const n = near();
    return pick([
      { name: 'pull away', shots: [{ dur: 3.2, from: { pos: mid(n).add(new THREE.Vector3(0, 0.2, -2.4)), look: mid(n) }, to: { pos: mid(n).add(new THREE.Vector3(0, 5, -9)), look: mid(n) }, title: ['OUT IN ROUND 2', 'NEXT TIME!'], start: () => playAll(n, react.slump) }, { dur: 1, from: { pos: mid(n).add(new THREE.Vector3(0, 5, -9)), look: mid(n) }, to: BROADCAST }] },
      { name: 'consolation', shots: [{ dur: 3, from: { pos: orbit(mid(n), 3.5, 0.2, 3.4), look: mid(n) }, to: { pos: orbit(mid(n), 3.5, 0.6, 2.8), look: mid(n) }, title: ['TOURNAMENT OVER', 'TRAIN AND COME BACK'], start: () => { playAll([n[0]], react.head); playAll([n[1]], () => react.hold(POSE.wave, 2)); } }, { dur: 1, from: { pos: orbit(mid(n), 3.5, 0.6, 2.8), look: mid(n) }, to: BROADCAST }] },
    ]);
  },
};

const playCut = (name: string): void => {
  const c = CUTS[name]();
  cut = { c, i: 0, t0: performance.now() / 1000 };
  rally.paused = true;
  wrap.classList.add('bars');
  skipEl.style.display = 'block';
  c.shots[0].start?.();
};
const endCut = (): void => {
  cut = null;
  rally.paused = false;
  wrap.classList.remove('bars');
  skipEl.style.display = 'none';
  showTitle('');
  holdCup(null);
};
canvas.addEventListener('pointerdown', () => {
  if (cut) endCut();
});

// ---------- menu ----------
const menu = document.getElementById('menu') as HTMLDivElement;
for (const name of Object.keys(CUTS)) {
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = (): void => playCut(name);
  menu.appendChild(b);
}

// ---------- loop ----------
const camPos = BROADCAST.pos.clone();
const camLook = BROADCAST.look.clone();
let last = performance.now() / 1000;
let frames = 0;
let fpsT = last;
const tick = (): void => {
  const nowReal = performance.now() / 1000;
  const dtReal = Math.min(0.05, nowReal - last);
  last = nowReal;
  if (slowUntil && nowReal > slowUntil) {
    slowUntil = 0;
    timeScale = 1;
    slowTarget = null;
  }
  const dt = dtReal * timeScale;
  simTime += dt;
  rally.update(simTime, dt);
  arena.cheer(simTime, simTime < cheerUntil ? 1 : 0.0);
  ballMesh.position.copy(rally.ball);
  ballShadow.position.set(rally.ball.x, 0.012, rally.ball.z);
  ballShadow.visible = rally.ball.y > -1;
  if (heldBy) {
    // held up in both hands, above the head
    const r = heldBy.model.root.position;
    cup.position.set(r.x, r.y + 1.98, r.z);
  }

  // camera: a cut-in shot, the slow-motion close-up, or the broadcast view
  let wantPos = BROADCAST.pos;
  let wantLook = BROADCAST.look;
  let follow = 6;
  if (cut) {
    const s = cut.c.shots[cut.i];
    const u = Math.min(1, (nowReal - cut.t0) / s.dur);
    const e = u * u * (3 - 2 * u);
    wantPos = s.from.pos.clone().lerp(s.to.pos, e);
    wantLook = s.from.look.clone().lerp(s.to.look, e);
    follow = 30;
    if (s.title) showTitle(s.title[0], s.title[1]);
    else showTitle('');
    if (u >= 1) {
      cut.i++;
      cut.t0 = nowReal;
      if (cut.i >= cut.c.shots.length) endCut();
      else cut.c.shots[cut.i].start?.();
    }
  } else if (slowTarget) {
    const a = slowTarget;
    wantLook = rally.ball.clone().lerp(P(a.pos.x, a.pos.y, 1.6), 0.5);
    wantPos = P(a.pos.x + 2.6, a.pos.y + (a.side === 0 ? 4 : -4), 2.2);
    follow = 5;
  }
  camPos.lerp(wantPos, 1 - Math.exp(-dtReal * follow));
  camLook.lerp(wantLook, 1 - Math.exp(-dtReal * follow));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  renderer.render(scene, camera);

  frames++;
  if (nowReal - fpsT >= 1) {
    fpsEl.textContent = `${frames} FPS`;
    frames = 0;
    fpsT = nowReal;
  }
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
