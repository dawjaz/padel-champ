import Phaser from 'phaser';
import { T } from '../i18n';
import { drawIcon, type IconKind } from '../art/icons';
import { celebrateSteps, fistSteps, highFiveSteps, loadPose, racketEnds, smashSteps, strokeSteps, tiredSteps } from '../art/rig';
import { POSES } from '../art/toon/character';
import type { Appearance } from '../game/types';
import { HD_SCALE } from '../config';
import { DISPLAY, TC, tcss } from '../theme';
import type { ArtId } from '../tutorial/lessons';
import { StageActor } from './stageActor';
import levels from '../data/levels.json';

/**
 * The comic slides of the graphic tutorial: a framed panel with the cutscenes' own characters (the match's rig) acting the lesson out
 * on a loop: the preparation, the swing, the ball, speech bubbles, a shout, a finger showing when to touch. Local coordinates are
 * the panel's (0..SLIDE_W, 0..SLIDE_H); the player stands at the bottom seen from behind, the opponent at the far end of the court.
 */
export const SLIDE_W = 312;
export const SLIDE_H = 232;

export interface SlideCast {
  hero: Appearance;
  mate: Appearance;
  rival: Appearance;
}
export interface Slide {
  update(time: number, dt: number): void;
  destroy(): void;
}

const BALL = 0xf6e84a;
const GREEN = 0x2fbf71;
const GLASS = 0x9fdcff;
const GOLD = 0xffe066;
type Pt = [number, number];

interface Script {
  stage: 'court' | 'burst' | 'gold' | 'outside';
  /** How long one loop is (ms). */
  period: number;
  /** The player behind and the opponent far (rally), the player big in front (solo), him and his partner (duo). */
  cast: 'rally' | 'solo' | 'duo' | 'side';
  run: (k: Kit, cycle: number) => void;
}

/** What a script can do (all in local coordinates). */
interface Kit {
  hero: StageActor;
  rival: StageActor | null;
  mate: StageActor | null;
  at(ms: number, fn: () => void): void;
  /** The ball from `from` to `to` along an arc `apex` px high; `after` runs when it arrives. */
  ball(from: Pt, to: Pt, o: { apex?: number; ms: number; after?: () => void }): void;
  ballAt(p: Pt): void;
  hideBall(): void;
  bubble(x: number, y: number, text: string, o?: { tail?: 'down' | 'up' | 'left' | 'right'; color?: number; size?: number; ttl?: number }): void;
  shout(x: number, y: number, text: string, o?: { color?: number; size?: number; angle?: number }): void;
  tap(x: number, y: number): void;
  ring(x: number, y: number, ms: number): void;
  burst(x: number, y: number, color?: number): void;
  flash(color: number): void;
  chip(x: number, y: number, w: number, text: string, o?: { color?: number; on?: boolean; size?: number; h?: number }): void;
  icon(kind: IconKind, x: number, y: number, size: number, color?: number): void;
  bar(from: number, to: number, ms: number): void;
  glow(x: number, y: number, w: number, h: number, color?: number): void;
  cross(x: number, y: number): void;
  /** The racket head of a pose of an actor, local. */
  head(a: StageActor, pose: keyof typeof POSES): Pt;
  /** Sets the hero's x (local) for this loop. */
  heroX(x: number): void;
  /** The hero runs (in profile) to local x. */
  walk(x: number, ms: number): void;
}

// ---------- the stages ----------

function stage(scene: Phaser.Scene, ox: number, oy: number, kind: Script['stage'], objs: Phaser.GameObjects.GameObject[]): void {
  const g = scene.add.graphics().setPosition(ox, oy).setDepth(1);
  objs.push(g);
  const sky = kind === 'gold' ? [0x7a4a00, 0xffc933] : kind === 'burst' ? [0x4b8bff, 0xbfd8ff] : [0x1a2f66, 0x2a4c96];
  g.fillStyle(sky[0], 1).fillRoundedRect(0, 0, SLIDE_W, SLIDE_H, 18);
  if (kind === 'outside') {
    // the court on the left, its side glass with a door, and the ground outside it on the right
    g.fillStyle(0x203a7c, 1).fillRect(0, 26, 190, 66);
    g.lineStyle(1.5, GLASS, 0.5);
    for (let i = 0; i <= 6; i++) g.lineBetween(i * 31.6, 26, i * 31.6, 92);
    g.fillStyle(0x2f6fd0, 1).fillRect(0, 92, 190, 140);
    g.fillStyle(0x3a80e8, 1).fillRect(0, 112, 190, 80);
    g.lineStyle(2, 0xffffff, 0.9).lineBetween(0, 92, 190, 92).lineBetween(0, 112, 190, 112).lineBetween(0, 192, 190, 192);
    g.fillStyle(0xeaf1fa, 0.9).fillRect(0, 142, 190, 9);
    g.lineStyle(2, TC.navy, 1).strokeRect(0, 142, 190, 9);
    g.fillStyle(0x34456e, 1).fillRect(202, 26, 110, 70);
    g.fillStyle(0x6b7a90, 1).fillRect(202, 96, 110, 136);
    g.lineStyle(2, 0x8fa0ba, 1).lineBetween(202, 96, 312, 96);
    // the side glass, with the door in it
    g.fillStyle(GLASS, 0.5).fillRect(190, 26, 12, 142).fillRect(190, 222, 12, 10);
    g.lineStyle(3, GLASS, 0.95).strokeRect(190, 26, 12, 206);
    g.fillStyle(0x6b7a90, 1).fillRect(190, 168, 12, 54);
    g.lineStyle(3, TC.navy, 1).strokeRect(190, 168, 12, 54);
  } else if (kind !== 'court') {
    g.fillStyle(sky[1], 0.9).fillRoundedRect(0, SLIDE_H * 0.35, SLIDE_W, SLIDE_H * 0.65, { tl: 0, tr: 0, bl: 18, br: 18 });
    const cx = SLIDE_W / 2;
    const cy = 120;
    for (let i = 0; i < 18; i++) {
      const a0 = (i / 18) * Math.PI * 2;
      const a1 = a0 + Math.PI / 18;
      g.fillStyle(0xffffff, 0.2).fillTriangle(cx, cy, cx + Math.cos(a0) * 340, cy + Math.sin(a0) * 340, cx + Math.cos(a1) * 340, cy + Math.sin(a1) * 340);
    }
    g.fillStyle(0x000000, 0.14).fillEllipse(cx, 224, 220, 22);
  } else {
    g.fillStyle(0x203a7c, 1).fillRect(74, 26, 164, 64);
    g.lineStyle(1.5, GLASS, 0.55);
    for (let i = 0; i <= 6; i++) g.lineBetween(74 + i * 27.3, 26, 74 + i * 27.3, 90);
    g.lineStyle(3, GLASS, 0.9).strokeRect(74, 26, 164, 64);
    g.lineStyle(3, GLASS, 0.6).lineBetween(74, 26, 8, 150).lineBetween(238, 26, 304, 150);
    g.fillStyle(0x2f6fd0, 1).fillPoints([new Phaser.Geom.Point(112, 90), new Phaser.Geom.Point(200, 90), new Phaser.Geom.Point(318, SLIDE_H), new Phaser.Geom.Point(-6, SLIDE_H)], true);
    g.fillStyle(0x3a80e8, 1).fillPoints([new Phaser.Geom.Point(104, 112), new Phaser.Geom.Point(208, 112), new Phaser.Geom.Point(266, 190), new Phaser.Geom.Point(46, 190)], true);
    g.lineStyle(2, 0xffffff, 0.9);
    g.lineBetween(112, 90, 200, 90).lineBetween(112, 90, -6, SLIDE_H).lineBetween(200, 90, 318, SLIDE_H);
    g.lineBetween(100, 112, 212, 112).lineBetween(44, 190, 268, 190).lineBetween(156, 112, 156, 190);
    g.fillStyle(0xeaf1fa, 0.9).fillRect(56, 130, 200, 11);
    g.lineStyle(2, TC.navy, 1).strokeRect(56, 130, 200, 11);
    g.fillStyle(TC.navy, 1).fillRect(52, 126, 5, 18).fillRect(255, 126, 5, 18);
  }
  g.fillStyle(0xffffff, 0.12);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 9 - y * 2; x++) g.fillCircle(8 + x * 9 + (y % 2) * 4, 8 + y * 8, 2.2);
}

// ---------- the scripts ----------

const HERO_X = 102;
const SPOTS: Pt[] = [[132, 104], [196, 106], [236, 104]];
const NET_OVER: Pt = [166, 120];

const SCRIPTS: Partial<Record<ArtId, Script>> = {
  court: {
    stage: 'court', period: 6400, cast: 'rally',
    run: (k) => {
      const h = k.head(k.hero, 'fhHit');
      k.hero.to(loadPose('fhPrep'), 260);
      k.bubble(84, 30, 'OVER THE NET...', { tail: 'down', size: 12 });
      k.at(500, () => {
        k.hero.play(strokeSteps('fh'));
        k.ball(h, NET_OVER, { apex: 50, ms: 420, after: () => k.ball(NET_OVER, [176, 106], { apex: 8, ms: 300, after: () => { k.burst(176, 106, 0xffffff); k.shout(176, 82, '1 BOUNCE', { size: 17, color: GOLD }); } }) });
      });
      k.at(1900, () => k.ball([176, 106], [182, 58], { apex: 6, ms: 360, after: () => { k.burst(182, 58, GLASS); k.bubble(228, 34, '...THEN THE WALL IS YOURS', { tail: 'left', size: 11 }); } }));
      k.at(2900, () => { k.rival?.to(loadPose('bhPrep'), 200); k.ball([182, 58], [196, 108], { apex: 18, ms: 360 }); });
      k.at(3400, () => { k.rival?.play(strokeSteps('bh')); k.ball([196, 108], [118, 214], { apex: 56, ms: 780, after: () => k.hideBall() }); });
    },
  },
  menu: {
    stage: 'court', period: 6400, cast: 'rally',
    run: (k) => {
      const t = SPOTS[2];
      k.hero.to(POSES.ready, 200);
      k.at(300, () => { k.chip(244, 28, 112, 'LOB', { color: TC.blue, on: false, size: 12, h: 24 }); k.chip(244, 56, 112, 'VIBORA', { color: TC.blue, on: false, size: 12, h: 24 }); k.chip(244, 84, 112, 'DEJADA', { color: TC.blue, on: false, size: 12, h: 24 }); });
      k.at(1300, () => { k.tap(244, 84); });
      k.at(2300, () => { k.chip(244, 116, 112, '2  WHERE', { color: TC.orange, on: true, size: 12, h: 24 }); k.tap(t[0], t[1]); k.glow(t[0], t[1], 46, 18, TC.orange); });
      k.at(3200, () => k.hero.to(loadPose('fhPrep'), 220));
      k.at(3700, () => { const h = k.head(k.hero, 'fhHit'); k.hero.play(strokeSteps('fh')); k.shout(96, 150, 'WHAM!', { color: GOLD }); k.ball(h, t, { apex: 56, ms: 900, after: () => k.burst(t[0], t[1], 0xffffff) }); });
    },
  },
  guts: {
    stage: 'court', period: 8200, cast: 'rally',
    run: (k) => {
      k.bar(1, 1, 10);
      k.hero.to(loadPose('smashPrep'), 300);
      k.at(700, () => { k.hero.play(smashSteps(520)); k.shout(96, 120, 'SMASH!', { color: GOLD }); k.bar(1, 0.55, 500); k.bubble(112, 52, 'COSTS 45% OF YOUR G', { tail: 'up', size: 11 }); });
      k.at(2700, () => { k.hero.play(tiredSteps()); k.bubble(104, 150, 'PHEW...', { tail: 'down' }); });
      k.at(4300, () => { k.chip(232, 196, 130, 'NOT ENOUGH G = RISKY', { color: 0xc62828, on: true, size: 10 }); k.bubble(232, 160, '+15% TO MISS PER MISSING G', { tail: 'down', size: 10 }); });
      k.at(6000, () => { k.bar(0.55, 0.92, 900); k.bubble(104, 110, 'SOFT SHOTS RECOVER G', { tail: 'down', size: 11 }); k.hero.to(POSES.ready, 300); });
    },
  },
  serve: {
    stage: 'court', period: 8000, cast: 'rally',
    run: (k, c) => {
      // all three serves bounce inside the far court; the third bounces first and then goes on to the side glass
      const spots: Pt[] = [[146, 104], [186, 106], [194, 99]];
      const names = ['THE T', 'THE OPPONENT', 'THE GLASS (BOUNCE FIRST)'];
      const i = c % 3;
      const sp = spots[i];
      spots.forEach((p, j) => k.glow(p[0], p[1], 40, 14, j === i ? GREEN : 0xffffff));
      k.bubble(sp[0] - (i === 2 ? 20 : 0), 52, T('SERVE TO {0}', names[i]), { tail: 'down', size: 10, ttl: 3600 });
      k.hero.to(loadPose('fhPrep'), 260);
      const hit = k.head(k.hero, 'fhHit');
      // the ball is dropped from the hand, bounces and is struck on its way down, between knee and hip
      const top: Pt = [hit[0] + 4, hit[1] - 50];
      k.ballAt(top);
      k.ball(top, [hit[0] + 4, 222], { ms: 380, after: () => k.ball([hit[0] + 4, 222], hit, { apex: 34, ms: 1100 }) });
      k.at(500, () => k.bubble(204, 190, 'IT MUST BOUNCE FIRST', { tail: 'left', size: 10, ttl: 1500 }));
      k.at(900, () => k.bubble(214, 150, 'HIT IT BETWEEN KNEE AND HIP', { tail: 'left', size: 10, ttl: 1500 }));
      k.at(400, () => k.ring(hit[0], hit[1], 1100));
      k.at(1500, () => {
        k.hero.play(strokeSteps('fh'));
        k.tap(hit[0], hit[1]);
        k.shout(100, 150, 'WHAM!', { color: GOLD });
        k.ball(hit, sp, { apex: 52, ms: 720, after: () => {
          k.burst(sp[0], sp[1], 0xffffff);
          if (i === 2) k.ball(sp, [236, 90], { apex: 6, ms: 320, after: () => { k.burst(236, 90, GLASS); k.ball([236, 90], [206, 118], { apex: 10, ms: 380, after: () => k.hideBall() }); } });
          else k.ball(sp, [sp[0] + (i === 1 ? 20 : -22), sp[1] - 30], { apex: 14, ms: 320, after: () => k.hideBall() });
        } });
      });
    },
  },
  receive: {
    stage: 'court', period: 8200, cast: 'rally',
    run: (k) => {
      k.rival?.to(loadPose('fhPrep'), 240);
      k.bubble(120, 26, 'HE SERVES...', { tail: 'down', size: 12, ttl: 2300 });
      // he drops the ball, it bounces, he strikes it
      k.ballAt([204, 92]);
      k.ball([204, 92], [204, 122], { ms: 380, after: () => k.ball([204, 122], [200, 104], { apex: 8, ms: 520 }) });
      k.at(1250, () => {
        k.rival?.play(strokeSteps('fh'));
        k.ball([200, 104], [150, 176], { apex: 46, ms: 1700, after: () => k.ball([150, 176], [122, 204], { apex: 14, ms: 800 }) });
        k.shout(150, 124, 'SLOW MOTION', { color: GLASS, size: 20, angle: -4 });
      });
      k.at(3600, () => { k.hero.to(POSES.ready, 200); k.bubble(100, 62, 'READ SPEED, SPIN, DIRECTION', { tail: 'down', size: 11, ttl: 1600 }); });
      k.at(5400, () => { ['LOB', 'CHIQUITA', 'DRIVE'].forEach((t, i) => k.chip(54 + i * 102, 26, 92, t, { color: TC.blue, on: i === 1, size: 13 })); k.tap(156, 36); });
      k.at(6000, () => k.hero.to(loadPose('fhPrep'), 220));
      k.at(6500, () => { const h = k.head(k.hero, 'fhHit'); k.hero.play(strokeSteps('fh')); k.ballAt(h); k.ball(h, [172, 110], { apex: 30, ms: 650, after: () => k.hideBall() }); });
    },
  },
  ring: {
    stage: 'court', period: 6000, cast: 'rally',
    run: (k) => {
      k.hero.to(loadPose('smashPrep'), 300);
      const hit = k.head(k.hero, 'smashHit');
      const from: Pt = [hit[0] + 46, hit[1] - 96];
      k.ballAt(from);
      k.ball(from, hit, { ms: 1500 });
      k.ring(hit[0], hit[1], 1500);
      k.bubble(236, 40, 'RING CLOSES...', { tail: 'left', size: 12 });
      k.at(1350, () => { k.tap(hit[0], hit[1]); k.bubble(232, 84, 'TOUCH ON GREEN!', { tail: 'left', size: 12, color: 0xc9f7dc }); });
      k.at(1580, () => {
        k.hero.play(smashSteps(520));
        k.shout(150, 70, 'WHAM!', { color: GOLD, size: 34 });
        k.flash(0xffffff);
        k.ball(hit, [214, 100], { apex: 10, ms: 520, after: () => { k.burst(214, 100, 0xffffff); k.ball([214, 100], [292, 28], { apex: 6, ms: 360, after: () => k.hideBall() }); } });
      });
      k.at(3200, () => k.bubble(120, 170, 'EARLY OR LATE = WEAKER', { tail: 'down', size: 11 }));
    },
  },
  glass: {
    stage: 'court', period: 8600, cast: 'rally',
    run: (k) => {
      k.hero.to(loadPose('ovPrep'), 260);
      k.bubble(120, 22, 'IN THE AIR: VOLLEY, VIBORA, BANDEJA', { tail: 'down', size: 10 });
      const h = k.head(k.hero, 'ovHit');
      k.ballAt([h[0] + 34, h[1] - 84]);
      k.ball([h[0] + 34, h[1] - 84], h, { ms: 700 });
      k.at(800, () => { k.hero.play(strokeSteps('ov')); k.shout(100, 112, 'BANDEJA', { color: GOLD, size: 24 }); k.ball(h, [184, 108], { apex: 30, ms: 560, after: () => k.hideBall() }); });
      k.at(3600, () => {
        k.glow(100, 222, 170, 10, GLASS);
        k.bubble(214, 160, 'OFF YOUR BACK GLASS: BAJADA', { tail: 'left', size: 10 });
        k.hero.to(loadPose('fhPrep'), 260);
        k.ballAt([140, 150]);
        k.ball([140, 150], [112, 212], { apex: 20, ms: 460, after: () => { k.burst(112, 226, GLASS); k.ball([112, 226], k.head(k.hero, 'fhHit'), { apex: 30, ms: 520 }); } });
      });
      k.at(5200, () => { const hh = k.head(k.hero, 'fhHit'); k.hero.play(strokeSteps('fh')); k.shout(100, 150, 'BAJADA', { color: GOLD, size: 24 }); k.ball(hh, [170, 108], { apex: 52, ms: 760, after: () => k.hideBall() }); });
    },
  },
  aim: {
    stage: 'court', period: 6600, cast: 'rally',
    run: (k, c) => {
      const t = SPOTS[(c + 1) % 3];
      k.hero.to(loadPose('fhPrep'), 260);
      k.bubble(220, 170, 'TOUCH THE COURT...', { tail: 'left', size: 11 });
      k.at(700, () => { k.tap(t[0], t[1]); k.cross(t[0], t[1]); });
      k.at(1500, () => {
        const h = k.head(k.hero, 'fhHit');
        k.hero.play(strokeSteps('fh'));
        k.shout(100, 150, 'WHAM!', { color: GOLD });
        k.ball(h, t, { apex: 56, ms: 900, after: () => { k.burst(t[0], t[1], GREEN); k.bubble(t[0], t[1] - 28, '...WHERE IT LANDS', { tail: 'down', size: 11 }); } });
      });
    },
  },
  runout: {
    stage: 'court', period: 8600, cast: 'rally',
    run: (k) => {
      k.hero.to(loadPose('smashPrep'), 260);
      const h = k.head(k.hero, 'smashHit');
      k.ballAt([h[0] + 24, h[1] - 70]);
      k.ball([h[0] + 24, h[1] - 70], h, { ms: 520 });
      k.at(600, () => {
        k.hero.play(smashSteps(520));
        k.shout(96, 110, 'POR TRES!', { color: GOLD, size: 26 });
        k.ball(h, [186, 106], { apex: 20, ms: 420, after: () => { k.burst(186, 106, 0xffffff); k.shout(150, 120, '1 BOUNCE', { size: 15, color: GOLD }); k.ball([186, 106], [242, 92], { apex: 6, ms: 340, after: () => { k.burst(242, 92, GLASS); k.ball([242, 92], [292, 44], { apex: 24, ms: 520, after: () => {
          k.glow(292, 44, 40, 40, GOLD);
          k.bubble(224, 92, 'THE BALL HANGS IN THE AIR', { tail: 'right', size: 10 });
          k.chip(228, 28, 104, 'RUN OUT!', { color: TC.orange, on: true, size: 15 });
          k.tap(228, 34);
        } }); } }); } });
      });
      k.at(3600, () => { k.walk(262, 1400); k.bubble(130, 150, 'YOUR PLAYER CHASES IT OUTSIDE', { tail: 'down', size: 10 }); });
    },
  },
  runout2: {
    stage: 'outside', period: 9400, cast: 'side',
    run: (k) => {
      // the player is OUTSIDE the court, beside the side glass; the ball has come over the fence
      k.heroX(262);
      k.hero.to(loadPose('fhPrep'), 200);
      const hit = k.head(k.hero, 'fhHit');
      k.chip(257, 52, 104, 'OUTSIDE THE COURT', { color: TC.navy, on: true, size: 9, h: 22 });
      k.chip(96, 52, 96, 'THE COURT', { color: TC.blue, on: true, size: 10, h: 22 });
      k.ballAt([300, 30]);
      k.ball([300, 30], hit, { apex: 6, ms: 1300 });
      k.ring(hit[0], hit[1], 1300);
      k.at(1200, () => k.tap(hit[0], hit[1]));
      k.at(1350, () => { k.hero.play(strokeSteps('fh')); k.shout(236, 130, 'WHAM!', { color: GOLD, size: 22 }); });
      // LOB: high over the glass, back into the court
      k.at(1700, () => {
        k.chip(96, 82, 128, 'LOB: OVER THE GLASS', { color: TC.blue, on: true, size: 9, h: 24 });
        k.ball(hit, [92, 124], { apex: 120, ms: 1200, after: () => { k.burst(92, 124, GREEN); k.hideBall(); } });
      });
      // DOOR: flat through the opening in the glass
      k.at(4700, () => {
        k.hero.to(loadPose('fhPrep'), 200);
        const h2 = k.head(k.hero, 'fhHit');
        k.ballAt(h2);
        k.chip(96, 214, 150, 'DOOR: FLAT THROUGH IT', { color: TC.orange, on: true, size: 9, h: 24 });
        k.bubble(252, 120, 'ONLY IF THE ANGLE ALLOWS', { tail: 'down', size: 10, ttl: 2600 });
        k.at(500, () => { k.hero.play(strokeSteps('fh')); k.shout(236, 150, 'WHAM!', { color: GOLD, size: 22 }); k.ball(h2, [196, 196], { apex: 6, ms: 320, after: () => k.ball([196, 196], [96, 160], { apex: 10, ms: 520, after: () => { k.burst(96, 160, 0xffffff); k.bubble(100, 120, 'HARD TO HOLD!', { tail: 'down', size: 11, ttl: 1600 }); k.hideBall(); } }) }); });
      });
    },
  },
  special: {
    stage: 'gold', period: 8200, cast: 'solo',
    run: (k) => {
      const names: Array<[string, string]> = [['L3', 'SKY ROCKET'], ['L6', 'VENOM'], ['L10', 'CORNER LOCK'], ['L15', 'FREEZE DROP']];
      k.hero.to(loadPose('smashPrep'), 300);
      // a special shot needs the timing ring as well: touch on green, or it is only a normal shot
      const hit = k.head(k.hero, 'smashHit');
      const from: Pt = [hit[0] + 46, hit[1] - 96];
      k.ballAt(from);
      k.ball(from, hit, { ms: 1300 });
      k.ring(hit[0], hit[1], 1300);
      k.bubble(236, 60, 'WAIT FOR THE GREEN RING', { tail: 'left', size: 10, ttl: 1300 });
      k.at(1200, () => k.tap(hit[0], hit[1]));
      k.at(1350, () => { k.hero.play(smashSteps(560)); k.shout(156, 90, 'SKY ROCKET!', { color: 0xffffff, size: 30 }); k.flash(GOLD); k.burst(156, 120, 0xffffff); k.ball(hit, [214, 100], { apex: 10, ms: 520, after: () => { k.burst(214, 100, 0xffffff); k.hideBall(); } }); });
      // the level chips come after the shot, so they do not hide the ring
      k.at(2400, () => names.forEach(([lv], i) => k.chip(46 + i * 74, 22, 62, lv, { color: TC.gold, on: false, size: 13 })));
      names.forEach(([lv, nm], i) => k.at(2600 + i * 1350, () => { k.chip(46 + i * 74, 22, 62, lv, { color: TC.gold, on: true, size: 13 }); k.bubble(156, 70, T('LEVEL {0}: {1}', lv.slice(1), nm), { tail: 'up', size: 12, ttl: 1200 }); k.burst(46 + i * 74, 22, 0xffffff); }));
      k.at(2000, () => k.bubble(156, 196, 'COSTLY, AND IT NEVER EXPIRES', { tail: 'up', size: 10, ttl: 5600 }));
      k.at(7300, () => k.bubble(156, 196, 'EARLY OR LATE = A NORMAL SHOT', { tail: 'up', size: 10, ttl: 600 }));
    },
  },
  hero: {
    stage: 'burst', period: 7000, cast: 'solo',
    run: (k) => {
      k.hero.to(POSES.ready, 200);
      const rows: Array<[IconKind, string, number]> = [['power', 'POWER', 50], ['speed', 'SPEED', 100], ['technique', 'TECHNIQUE', 150]];
      rows.forEach(([ic, txt, y], i) => k.at(500 + i * 1100, () => { k.icon(ic, 44, y, 26, TC.navy); k.chip(226, y, 130, `${txt}  +1`, { color: TC.orange, on: true, size: 13 }); k.burst(226, y, 0xffffff); }));
      k.at(4200, () => { k.hero.play(celebrateSteps(false)); k.shout(156, 60, 'LEVEL UP!', { color: GOLD, size: 30 }); k.flash(0xffffff); });
      k.at(5200, () => k.bubble(156, 196, T('{0} SKILL POINTS EVERY LEVEL', levels.pointsPerLevel), { tail: 'up', size: 11, ttl: 1700 }));
    },
  },
  gear: {
    stage: 'burst', period: 8000, cast: 'solo',
    run: (k) => {
      const slots: IconKind[] = ['top', 'shorts', 'shoes', 'racket', 'bag'];
      slots.forEach((s, i) => k.at(300 + i * 250, () => k.icon(s, 36, 24 + i * 40, 24, TC.navy)));
      const grades: Array<[string, number]> = [['BASIC', 0x9aa6b8], ['PRO', 0x2f6df0], ['TECHNICAL', 0x8a3df0], ['ELITE', 0xffb800]];
      grades.forEach(([t, col], i) => k.at(1500 + i * 1100, () => { k.chip(244, 40 + i * 42, 110, t, { color: col, on: true, size: 13 }); k.burst(244, 40 + i * 42, 0xffffff); }));
      k.at(6000, () => { k.icon('star', 262, 200, 34, TC.gold); k.bubble(150, 30, 'A STAR MARKS WHAT IS NEW', { tail: 'down', size: 10, ttl: 1800 }); });
      k.at(1000, () => k.hero.to(POSES.ready, 200));
    },
  },
  career: {
    stage: 'burst', period: 7600, cast: 'duo',
    run: (k) => {
      const ev = ['CLUB CUP', 'REGIONAL OPEN', 'FIP RISE'];
      ev.forEach((e, i) => k.at(300 + i * 900, () => k.chip(156, 22 + i * 28, 150, e, { color: TC.orange, on: i === 2, size: 12, h: 24 })));
      k.at(3600, () => { k.hero.play(highFiveSteps(1)); k.mate?.play(highFiveSteps(-1)); k.shout(156, 100, 'WIN!', { color: GOLD, size: 34 }); k.icon('trophy', 156, 170, 44, TC.gold); k.flash(0xffffff); });
      k.at(5000, () => k.bubble(156, 130, 'ONE MATCH PER TIE', { tail: 'down', size: 11, ttl: 2000 }));
    },
  },
  practice: {
    stage: 'court', period: 7400, cast: 'rally',
    run: (k, c) => {
      const sits = ['A SHORT LOB', 'A POR TRES', 'A RUN OUT'];
      k.bubble(70, 30, T('TRAIN: {0}', sits[c % 3]), { tail: 'down', size: 11 });
      k.rival?.to(loadPose('fhPrep'), 200);
      k.hero.to(POSES.ready, 200);
      k.at(600, () => { k.rival?.play(strokeSteps('fh')); k.ball([188, 112], [118, 200], { apex: 80, ms: 1100 }); });
      k.at(1500, () => k.hero.to(loadPose('fhPrep'), 220));
      k.at(1900, () => { const h = k.head(k.hero, 'fhHit'); k.hero.play(strokeSteps('fh')); k.ball(h, [170, 108], { apex: 56, ms: 800, after: () => { k.hideBall(); k.shout(160, 80, 'AGAIN!', { color: GOLD, size: 28 }); } }); });
      k.at(4200, () => k.bubble(214, 170, 'IT SHOWS WHAT EACH SHOT WOULD DO', { tail: 'left', size: 10 }));
    },
  },
  camp: {
    stage: 'burst', period: 7600, cast: 'solo',
    run: (k) => {
      const tiles: Array<[string, number, number]> = [['TARGETS', 62, 40], ['SERVE & RETURN', 250, 40], ['TIMING', 62, 96], ['SMASH SHOW', 250, 96]];
      tiles.forEach(([t, x, y], i) => k.at(300 + i * 500, () => { k.chip(x, y, 112, t, { color: TC.blue, on: false, size: 11, h: 30 }); [0, 1, 2].forEach((s) => k.icon('star', x - 24 + s * 24, y + 24, 16, i % 2 ? TC.gold : 0xb8c4d8)); }));
      k.at(3000, () => { k.hero.play(fistSteps(true)); k.shout(156, 150, 'STARS!', { color: GOLD, size: 30 }); k.burst(62, 40, 0xffffff); k.burst(250, 96, 0xffffff); });
      k.at(4600, () => k.bubble(156, 206, 'COINS, BOOSTS, GEAR PACK FRAGMENTS', { tail: 'up', size: 10, ttl: 2400 }));
    },
  },
  targets: {
    stage: 'court', period: 6800, cast: 'rally',
    run: (k, c) => {
      const z = SPOTS[c % 3];
      k.glow(z[0], z[1], 58, 22, GREEN);
      k.bubble(z[0], z[1] - 30, 'THE ZONE MOVES', { tail: 'down', size: 11 });
      k.hero.to(loadPose('fhPrep'), 260);
      k.at(900, () => k.cross(z[0], z[1]));
      k.at(1500, () => { const h = k.head(k.hero, 'fhHit'); k.hero.play(strokeSteps('fh')); k.shout(100, 150, 'WHAM!', { color: GOLD }); k.ball(h, z, { apex: 56, ms: 900, after: () => { k.burst(z[0], z[1], GREEN); k.bubble(z[0], z[1] - 30, 'IN THE ZONE: POINTS!', { tail: 'down', size: 11 }); } }); });
    },
  },
  toss: {
    stage: 'burst', period: 7200, cast: 'solo',
    run: (k) => {
      k.hero.to(POSES.ready, 200);
      k.chip(100, 40, 100, 'HEADS', { color: TC.orange, on: true, size: 14 });
      k.chip(212, 40, 100, 'TAILS', { color: TC.blue, on: false, size: 14 });
      k.tap(100, 48);
      [0, 1, 2, 3].forEach((i) => k.at(900 + i * 280, () => k.icon('coin', 156, 150 - Math.sin((i / 3) * Math.PI) * 70, 34, TC.gold)));
      k.at(2600, () => { k.hero.play(fistSteps(true)); k.shout(156, 110, 'YOU SERVE FIRST!', { color: GOLD, size: 22 }); k.burst(156, 150, 0xffffff); });
      k.at(4800, () => k.bubble(156, 200, 'THEN YOU CHANGE SIDES EVERY ODD GAME', { tail: 'up', size: 10, ttl: 2200 }));
    },
  },
  retire: {
    stage: 'court', period: 7000, cast: 'rally',
    run: (k) => {
      k.hero.to(POSES.ready, 200);
      k.at(400, () => k.hero.play(tiredSteps()));
      k.at(900, () => k.bubble(156, 24, 'RETIRE FROM THE MATCH?', { tail: 'down', size: 12, ttl: 5200 }));
      k.at(1700, () => { k.chip(84, 62, 130, 'YES, RETIRE', { color: 0xe05a2b, on: true, size: 11, h: 26 }); k.chip(228, 62, 130, 'KEEP PLAYING', { color: TC.blue, on: false, size: 11, h: 26 }); });
      k.at(3200, () => k.tap(84, 70));
      k.at(4000, () => k.bubble(156, 190, 'THE OPPONENTS WIN. NO XP, NO COINS.', { tail: 'up', size: 10, ttl: 2600 }));
    },
  },
  shop: {
    stage: 'burst', period: 7600, cast: 'solo',
    run: (k) => {
      k.hero.to(POSES.ready, 200);
      k.chip(86, 36, 130, 'GEAR PACK 150', { color: TC.blue, on: false, size: 12, h: 30 });
      k.chip(226, 36, 130, 'PREMIUM 500', { color: TC.orange, on: true, size: 12, h: 30 });
      k.at(500, () => { k.icon('coin', 36, 90, 26, TC.gold); k.icon('boost', 276, 90, 26, TC.navy); });
      k.at(1600, () => k.tap(226, 44));
      k.at(2200, () => { k.hero.play(fistSteps(true)); k.shout(156, 100, 'NEW GEAR!', { color: GOLD, size: 30 }); k.burst(226, 36, 0xffffff); k.icon('star', 156, 168, 36, TC.gold); k.flash(0xffffff); });
      k.at(4600, () => k.bubble(156, 206, 'BOOSTS HELP IN ONE MATCH', { tail: 'up', size: 10, ttl: 2400 }));
    },
  },
  partner: {
    stage: 'burst', period: 7600, cast: 'duo',
    run: (k) => {
      k.chip(88, 24, 104, 'YOU 5.0', { color: TC.blue, on: true, size: 12, h: 24 });
      k.at(500, () => k.chip(222, 24, 124, 'PARTNER 4.6', { color: TC.blue, on: true, size: 12, h: 24 }));
      k.at(1400, () => k.chip(156, 60, 170, 'PAIR RATING 4.8', { color: TC.orange, on: true, size: 13, h: 28 }));
      k.at(3000, () => { k.hero.play(highFiveSteps(1)); k.mate?.play(highFiveSteps(-1)); k.shout(156, 110, 'TEAM!', { color: GOLD, size: 32 }); k.flash(0xffffff); });
      k.at(4800, () => k.bubble(156, 150, 'A BETTER PARTNER NEEDS LEVEL AND COINS', { tail: 'down', size: 10, ttl: 2400 }));
    },
  },
  tasks: {
    stage: 'burst', period: 7600, cast: 'solo',
    run: (k) => {
      k.hero.to(POSES.ready, 200);
      const rows = ['PLAY 2 CAREER MATCHES', 'WIN A CAREER MATCH', 'WIN 20 POINTS'];
      rows.forEach((t, i) => {
        k.at(300 + i * 500, () => k.chip(120, 30 + i * 34, 214, t, { color: TC.blue, on: false, size: 11, h: 28 }));
        k.at(2400 + i * 700, () => { k.chip(262, 30 + i * 34, 62, 'DONE', { color: 0x2fbf71, on: true, size: 11, h: 28 }); k.burst(262, 30 + i * 34, 0xffffff); });
      });
      k.at(4700, () => { k.hero.play(celebrateSteps(false)); k.shout(156, 150, 'BONUS!', { color: GOLD, size: 32 }); k.icon('coin', 156, 190, 34, TC.gold); k.flash(0xffffff); });
    },
  },
  season: {
    stage: 'gold', period: 8200, cast: 'solo',
    run: (k) => {
      k.hero.to(POSES.ready, 200);
      k.at(300, () => k.shout(156, 36, 'SEASON COMPLETE', { color: 0xffffff, size: 22 }));
      k.at(1200, () => { k.icon('trophy', 156, 100, 52, TC.gold); k.burst(156, 100, 0xffffff); });
      k.at(2000, () => k.chip(156, 150, 160, '#7 IN THE WORLD', { color: TC.orange, on: true, size: 13, h: 28 }));
      k.at(3000, () => { k.hero.play(celebrateSteps(false)); k.icon('coin', 70, 196, 28, TC.gold); k.icon('boost', 242, 196, 28, TC.navy); k.flash(0xffffff); });
      k.at(4600, () => k.bubble(156, 70, 'COINS, PACKS AND HALF YOUR POINTS CARRY ON', { tail: 'down', size: 10, ttl: 2800 }));
    },
  },
  smash: {
    stage: 'court', period: 7000, cast: 'rally',
    run: (k) => {
      ['POR TRES', 'POR CUATRO', 'VIBORA'].forEach((t, i) => k.chip(54 + i * 102, 22, 94, t, { color: TC.blue, on: i === 0, size: 12, h: 26 }));
      k.tap(54, 30);
      k.hero.to(loadPose('smashPrep'), 300);
      const hit = k.head(k.hero, 'smashHit');
      k.at(800, () => { k.ballAt([190, 100]); k.ball([190, 100], hit, { apex: 90, ms: 1500 }); k.ring(hit[0], hit[1], 1500); k.bubble(236, 100, 'A LOB COMES...', { tail: 'left', size: 11 }); });
      k.at(2150, () => k.tap(hit[0], hit[1]));
      k.at(2380, () => { k.hero.play(smashSteps(520)); k.shout(150, 80, 'WHAM!', { color: GOLD, size: 32 }); k.flash(0xffffff); k.ball(hit, [214, 100], { apex: 10, ms: 480, after: () => { k.burst(214, 100, 0xffffff); k.ball([214, 100], [292, 28], { apex: 6, ms: 360, after: () => k.hideBall() }); } }); });
      k.at(4000, () => k.bubble(120, 176, 'THE DEEPER THE LOB, THE HARDER THE POR CUATRO', { tail: 'down', size: 10 }));
    },
  },
};

// ---------- the engine ----------

export function buildSlide(scene: Phaser.Scene, id: ArtId, ox: number, oy: number, cast: SlideCast): Slide {
  const sc = SCRIPTS[id] ?? SCRIPTS.court!;
  const perm: Phaser.GameObjects.GameObject[] = [];
  let temp: Phaser.GameObjects.GameObject[] = [];
  let tweens: Phaser.Tweens.Tween[] = [];
  let timers: Phaser.Time.TimerEvent[] = [];
  const actors: StageActor[] = [];
  const A = (x: number, y: number): Pt => [ox + x, oy + y];

  stage(scene, ox, oy, sc.stage, perm);
  const make = (look: Appearance, x: number, y: number, h: number, view: 'front' | 'back'): StageActor => {
    const a = new StageActor(scene, look, ox + x, oy + y, h, view, 12);
    actors.push(a);
    return a;
  };
  const hero = sc.cast === 'rally' || sc.cast === 'side' ? make(cast.hero, HERO_X, 228, 122, 'back') : sc.cast === 'duo' ? make(cast.hero, 100, 218, 132, 'front') : make(cast.hero, 156, 218, 140, 'front');
  const rival = sc.cast === 'rally' ? make(cast.rival, 208, 118, 62, 'front') : null;
  const mate = sc.cast === 'duo' ? make(cast.mate, 212, 218, 132, 'front') : null;
  const heroStart = hero.x;

  const track = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    temp.push(o);
    return o;
  };
  const tw = (cfg: Phaser.Types.Tweens.TweenBuilderConfig | Phaser.Types.Tweens.TweenChainBuilderConfig): Phaser.Tweens.Tween => {
    const t = scene.tweens.add(cfg as Phaser.Types.Tweens.TweenBuilderConfig);
    tweens.push(t);
    return t;
  };
  const text = (x: number, y: number, s: string, size: number, color: number, wrap = 0): Phaser.GameObjects.Text => {
    const [ax, ay] = A(x, y);
    return track(scene.add.text(ax, ay, T(s), { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: `${size}px`, color: tcss(color), align: 'center', ...(wrap ? { wordWrap: { width: wrap } } : {}) }).setOrigin(0.5).setDepth(40));
  };

  let ballObj: Phaser.GameObjects.Arc | null = null;
  const ballOf = (): Phaser.GameObjects.Arc => {
    if (!ballObj || !ballObj.active) ballObj = track(scene.add.circle(0, 0, 6.5, BALL).setStrokeStyle(2, TC.navy).setDepth(20));
    return ballObj;
  };

  const kit: Kit = {
    hero, rival, mate,
    at: (ms, fn) => { timers.push(scene.time.delayedCall(ms, fn)); },
    ballAt: (p) => { const [x, y] = A(p[0], p[1]); ballOf().setPosition(x, y).setVisible(true); },
    hideBall: () => { ballObj?.setVisible(false); },
    ball: (from, to, o) => {
      const b = ballOf().setVisible(true);
      const apex = o.apex ?? 0;
      const trailDots: Phaser.GameObjects.Arc[] = [];
      tw({
        targets: { u: 0 }, u: 1, duration: o.ms, ease: 'Sine.easeInOut',
        onUpdate: (t) => {
          const u = (t.getValue() ?? 0) as number;
          const [x, y] = A(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u - apex * 4 * u * (1 - u));
          b.setPosition(x, y);
          if (Math.random() < 0.5) {
            const d = track(scene.add.circle(x, y, 3.5, BALL, 0.5).setDepth(19));
            trailDots.push(d);
            scene.tweens.add({ targets: d, alpha: 0, scale: 0.3, duration: 260, onComplete: () => d.destroy() });
          }
        },
        onComplete: () => o.after?.(),
      });
    },
    bubble: (x, y, str, o = {}) => {
      const t = text(x, y, str, o.size ?? 12, TC.navy, 150);
      const [ax, ay] = A(x, y);
      const w = t.width + 18;
      const h = t.height + 12;
      const g = track(scene.add.graphics().setPosition(ax, ay).setDepth(39));
      g.fillStyle(o.color ?? 0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      g.lineStyle(2.5, TC.navy, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      const tail = o.tail ?? 'down';
      const pts: Array<[number, number]> = tail === 'down' ? [[-7, h / 2 - 1], [7, h / 2 - 1], [0, h / 2 + 9]] : tail === 'up' ? [[-7, -h / 2 + 1], [7, -h / 2 + 1], [0, -h / 2 - 9]] : tail === 'left' ? [[-w / 2 + 1, -6], [-w / 2 + 1, 6], [-w / 2 - 9, 0]] : [[w / 2 - 1, -6], [w / 2 - 1, 6], [w / 2 + 9, 0]];
      g.fillStyle(o.color ?? 0xffffff, 1).fillTriangle(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
      g.lineStyle(2.5, TC.navy, 1).lineBetween(pts[0][0], pts[0][1], pts[2][0], pts[2][1]).lineBetween(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
      g.fillStyle(o.color ?? 0xffffff, 1).fillRect(Math.min(pts[0][0], pts[1][0]) + (tail === 'down' || tail === 'up' ? 1 : 0), Math.min(pts[0][1], pts[1][1]) + (tail === 'left' || tail === 'right' ? 1 : 0), tail === 'down' || tail === 'up' ? 12 : 3, tail === 'down' || tail === 'up' ? 3 : 10);
      g.setScale(0.5).setAlpha(0);
      t.setScale(0.5).setAlpha(0);
      tw({ targets: [g, t], scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
      if (o.ttl) tw({ targets: [g, t], alpha: 0, delay: o.ttl, duration: 220 });
    },
    shout: (x, y, str, o = {}) => {
      const t = text(x, y, str, o.size ?? 28, o.color ?? GOLD);
      t.setStroke(tcss(TC.navy), 7).setAngle(o.angle ?? -7).setDepth(45).setScale(1.7).setAlpha(0);
      tw({ targets: t, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
      tw({ targets: t, alpha: 0, y: t.y - 14, delay: 1000, duration: 320 });
    },
    tap: (x, y) => {
      const [ax, ay] = A(x, y);
      const dot = track(scene.add.circle(ax, ay, 9, TC.orange, 0.9).setStrokeStyle(2, 0xffffff).setDepth(46));
      const rim = track(scene.add.circle(ax, ay, 10).setStrokeStyle(3, 0xffffff, 1).setDepth(46));
      dot.setScale(0.4);
      tw({ targets: dot, scale: 1, duration: 140, ease: 'Back.easeOut' });
      tw({ targets: rim, scale: 3, alpha: 0, duration: 520, delay: 120 });
      tw({ targets: dot, alpha: 0, duration: 260, delay: 620 });
    },
    ring: (x, y, ms) => {
      const [ax, ay] = A(x, y);
      const g = track(scene.add.graphics().setDepth(30));
      tw({
        targets: { u: 0 }, u: 1, duration: ms, ease: 'Sine.easeIn',
        onUpdate: (t) => {
          const u = (t.getValue() ?? 0) as number;
          const green = u > 0.86;
          g.clear().lineStyle(green ? 6 : 3.5, green ? GREEN : 0xffffff, 0.95).strokeCircle(ax, ay, 8 + 54 * (1 - u));
        },
        onComplete: () => tw({ targets: g, alpha: 0, duration: 300 }),
      });
    },
    burst: (x, y, color = 0xffffff) => {
      const [ax, ay] = A(x, y);
      const g = track(scene.add.graphics().setPosition(ax, ay).setDepth(35));
      g.fillStyle(color, 0.9);
      const pts: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 16; i++) { const r = i % 2 ? 7 : 17; pts.push(new Phaser.Geom.Point(Math.cos((i / 16) * Math.PI * 2) * r, Math.sin((i / 16) * Math.PI * 2) * r)); }
      g.fillPoints(pts, true).lineStyle(2, TC.navy, 0.8).strokePoints(pts, true);
      g.setScale(0.3);
      tw({ targets: g, scale: 1.5, alpha: 0, duration: 520, ease: 'Cubic.easeOut' });
    },
    flash: (color) => {
      const f = track(scene.add.rectangle(ox, oy, SLIDE_W, SLIDE_H, color, 0.7).setOrigin(0, 0).setDepth(50));
      tw({ targets: f, alpha: 0, duration: 260 });
    },
    chip: (x, y, w, str, o = {}) => {
      const h = o.h ?? 30;
      const [ax, ay] = A(x, y);
      const g = track(scene.add.graphics().setPosition(ax, ay).setDepth(38));
      g.fillStyle(o.on ? (o.color ?? TC.orange) : 0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 9);
      g.lineStyle(2.5, TC.navy, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
      const t = text(x, y, str, o.size ?? 13, o.on ? 0xffffff : TC.navy).setDepth(41);
      g.setScale(0.6).setAlpha(0);
      t.setScale(0.6).setAlpha(0);
      tw({ targets: [g, t], scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    },
    icon: (kind, x, y, size, color = TC.navy) => {
      const [ax, ay] = A(x, y);
      const g = track(scene.add.graphics().setPosition(ax, ay).setDepth(38));
      g.fillStyle(0xffffff, 1).fillCircle(0, 0, size * 0.78).lineStyle(2.5, TC.navy, 1).strokeCircle(0, 0, size * 0.78);
      drawIcon(g, kind, 0, 0, size, color);
      g.setScale(0.4).setAlpha(0);
      tw({ targets: g, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    },
    bar: (from, to, ms) => {
      const [ax, ay] = A(18, 16);
      const w = 128;
      const g = track(scene.add.graphics().setDepth(38));
      const lab = text(10, 16, 'G', 14, 0xffffff).setDepth(41);
      void lab;
      tw({
        targets: { v: from }, v: to, duration: Math.max(1, ms),
        onUpdate: (t) => {
          const v = (t.getValue() ?? from) as number;
          g.clear().fillStyle(0xffffff, 1).fillRoundedRect(ax, ay - 8, w, 16, 7).fillStyle(v < 0.5 ? 0xe05a2b : TC.blue, 1).fillRoundedRect(ax + 2, ay - 6, Math.max(6, (w - 4) * v), 12, 5).lineStyle(2.5, TC.navy, 1).strokeRoundedRect(ax, ay - 8, w, 16, 7).lineStyle(2, TC.navy, 0.8).lineBetween(ax + w / 2, ay - 11, ax + w / 2, ay + 11);
        },
      });
    },
    glow: (x, y, w, h, color = 0xffffff) => {
      const [ax, ay] = A(x, y);
      const g = track(scene.add.graphics().setPosition(ax, ay).setDepth(3));
      g.fillStyle(color, 0.4).fillEllipse(0, 0, w, h).lineStyle(2.5, color, 1).strokeEllipse(0, 0, w, h);
      tw({ targets: g, alpha: 0.35, yoyo: true, repeat: -1, duration: 420 });
    },
    cross: (x, y) => {
      const [ax, ay] = A(x, y);
      const g = track(scene.add.graphics().setPosition(ax, ay).setDepth(31));
      g.lineStyle(3, TC.orange, 1).strokeCircle(0, 0, 11).lineBetween(-18, 0, 18, 0).lineBetween(0, -18, 0, 18);
      g.setScale(2).setAlpha(0);
      tw({ targets: g, scale: 1, alpha: 1, duration: 220, ease: 'Cubic.easeOut' });
    },
    head: (a, pose) => {
      const p = a.screenOf(racketEnds(POSES[pose])[1]);
      return [p.x - ox, p.y - oy];
    },
    heroX: (x) => { hero.x = ox + x; },
    walk: (x, ms) => { hero.walkTo(ox + x, ms); },
  };

  let cycle = 0;
  const clear = (): void => {
    for (const t of tweens) t.stop();
    tweens = [];
    for (const e of timers) e.remove(false);
    timers = [];
    for (const o of temp) o.destroy();
    temp = [];
    ballObj = null;
  };
  const start = (): void => {
    clear();
    hero.x = heroStart;
    hero.to(POSES.ready, 120);
    sc.run(kit, cycle++);
  };
  const loop = scene.time.addEvent({ delay: sc.period, loop: true, callback: start });
  start();

  // the panel's frame, over everything
  const frame = scene.add.graphics().setPosition(ox, oy).setDepth(60);
  frame.lineStyle(4, TC.navy, 1).strokeRoundedRect(0, 0, SLIDE_W, SLIDE_H, 18);
  perm.push(frame);

  return {
    update: (time, dt) => { for (const a of actors) a.update(time, dt); },
    destroy: () => {
      loop.remove(false);
      clear();
      for (const a of actors) a.destroy();
      for (const o of perm) o.destroy();
    },
  };
}

void tcss;
