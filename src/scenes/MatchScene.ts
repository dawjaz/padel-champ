import Phaser from 'phaser';
import { ARRIVAL_HEIGHT, ballPoint, buildCoast, buildFlight, flightDuration, HIT_HEIGHT_M, speedAt, TIME_SCALE, type Flight, type FlightEvent, type Sample } from '../art/ballPath';
import { project } from '../art/camera';
import { IDENTITY, launchSpin, rotate, type Mat3, type Vec3 } from '../art/spin';
import { SPRITE_H } from '../art/character';
import { poseOf, type Facing, type PoseName, type Stance } from '../art/character';
import { ensureCharacterTexture } from '../art/characterTexture';
import { chooseStance, standingSpot } from '../art/stance';
import { HD_CHARACTER_SCALE } from '../art/hd/characterHd';
import { ARENA_BACK_KEY, ARENA_NET_KEY, BALL_KEY, ensureArenaTextures, ensureBallTextures, GLOW_KEY } from '../art/hdTextures';
import { impactSound, sfx } from '../audio';
import { racketKind } from '../sfxKind';
import { FONT, HEIGHT, WIDTH, HD_SCALE } from '../config';
import playersData from '../data/players.json';
import { applyHd } from '../hd';
import { drawPanel } from '../ui';
import { pickStarReceiver, pickHit, pickReceive, pickServe } from '../game/ai';
import { DIRECTIONS, shotsOfKind } from '../game/catalog';
import { laneSign, landingX, NET_Z, restPos, serveSetup } from '../game/court';
import { recoverGuts, SECOND_SERVE_SPEED } from '../game/engine';
import { playableShots, startPoint, stepHit, stepServe, unavailableReason, type HitOptions, type PointState, type Step, type Teams } from '../game/point';
import { awardPoint, deuceLabel, isStarPoint, newScore, pointLabels, type MatchScore } from '../game/scoring';
import type { AimPreference, CourtPos, Direction, Formation, Height, PlayerDef, ReceiveMode, ShotDef, SideIndex } from '../game/types';
import { paceFactor } from '../game/pace';
import { seededRng } from '../game/rng';
import { fatigueFactor, gutsRecovery, powerSpeedMul, spinMul } from '../game/attributes';
import { reportMatch, type Finished } from '../career/careerFlow';
import { partnerById } from '../career/season';
import { boostOf, consumeQueued } from '../career/gear';
import { award, heroFrom, levelOf, matchReward } from '../career/profile';
import { getSave, recordResult, updateSave } from '../save';

const BASE_YOU = playersData.you as unknown as PlayerDef[];
/** The teams of the current match: the human hero (idx 0) has the attributes of the career profile; set in create(). */
const DEFAULT_CPU = playersData.cpu as unknown as PlayerDef[];
let TEAMS: Teams = [BASE_YOU, DEFAULT_CPU];

/** A career match: the opponent pair of the bracket (the partner comes from the career). */
export interface CareerMatch {
  opponents: PlayerDef[];
  name: string;
}

/** The one player you control. Your partner and the whole CPU team play automatically and quickly. */
const HUMAN_SIDE: SideIndex = 0;
const HUMAN_IDX = 0;
/** Pauses in milliseconds: relaxed, like the rallies at a real tournament. */
const CPU_DELAY = 56;
const NEXT_HIT_DELAY = 88;
/** Before a CPU player plays the ball the pause is half as long: only the human has a choice to make. */
const CPU_NEXT_HIT_DELAY = NEXT_HIT_DELAY / 2;
const FAULT_PAUSE = 900;
const POINT_PAUSE = 1100;
const GAME_PAUSE = 1500;
/** A player who hits a ball off the back glass stands this far (m) behind the ball, so that it is at his side and a little in front. */
const REBOUND_BEHIND_BALL = 0.55;
const SIDE_NAME = ['YOU', 'CPU'] as const;
const DIRECTION_ORDER: Direction[] = ['parallel', 'middle', 'cross'];

/** How tall a character looks on screen, in court metres (chibi: big head, so a bit exaggerated). */
const VISUAL_HEIGHT_M = 1.75;

type Tone = 'normal' | 'good' | 'poor' | 'tired' | 'off';

const TONE_STROKE: Record<Tone, number> = { normal: 0xffffff, good: 0x6dff8b, poor: 0xffa94d, tired: 0xff6666, off: 0x555566 };
const TONE_TEXT: Record<Tone, string> = { normal: '#ffffff', good: '#b5ffc5', poor: '#ffd29a', tired: '#ff9999', off: '#777788' };

interface PlayerView {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  player: PlayerDef;
  side: SideIndex;
  /** Jump height in pixels (animated by the hit "hop"). */
  lift: number;
  pose: PoseName;
  /** Which way the player looks: towards the net by default, to the side when running. */
  facing: Facing;
  /** The player is playing a stroke (swing animation) until this time (ms), so running must not overwrite it. */
  busyUntil: number;
}

interface ButtonSpec {
  label: string;
  tone: Tone;
  /** Greyed out and not clickable (the shot is not possible now). */
  disabled?: boolean;
  onPick: () => void;
}

const other = (s: SideIndex): SideIndex => (s === 0 ? 1 : 0);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class MatchScene extends Phaser.Scene {
  private matchScore: MatchScore = newScore(2);
  private career: CareerMatch | null = null;
  /** The text on the status line (it stays until the next shot replaces it). */
  private lastSaid = '';
  /** Set for the shot in the air: the court mark at its bounce is stronger (Por Cuatro, a strong Por Tres). */
  private powerStyle: 'x4' | 'x3' | null = null;
  private pointsWon: [number, number] = [0, 0];
  private longestRally = 0;
  /** Extra guts recovery of the hero from consumables (0.1 = +10%). */
  private recoveryPct = 0;
  private server: SideIndex = 0;
  /** Which player of each team serves in their next service game. */
  private serverIdx: [number, number] = [0, 0];
  private point!: PointState;
  private guts: Record<string, number> = {};
  private busy = false;
  private menu: Phaser.GameObjects.GameObject[] = [];
  private views: Record<string, PlayerView> = {};
  private pos: Record<string, CourtPos> = {};
  /** How each player is set up for the next stroke (chosen when they run to the ball). */
  private stance: Record<string, Stance> = {};
  /** Players who play the next ball after it has come off the back glass: they turn to it and hit side-on. */
  private activeId: string | null = null;
  private ballFloor: CourtPos = { x: 0, z: NET_Z };
  /** Height of the ball when it is played next (a lob arrives high, a chiquita low). */
  private ballH = HIT_HEIGHT_M;
  private coastTween: Phaser.Tweens.Tween | null = null;
  private coastRunning = false;
  /** Big "HIGH BALL / MID BALL / LOW BALL" in the lower part of the court while the human picks a shot. */
  private heightText!: Phaser.GameObjects.Text;
  private heightSub!: Phaser.GameObjects.Text;
  /** Orientation and angular velocity of the ball, and when it was last turned (scene clock, ms). */
  private ballR: Mat3 = IDENTITY;
  private ballOmega: Vec3 = [0, 0, 0];
  private ballTurnedAt = 0;
  private redrawBall: (m: Mat3) => void = () => undefined;
  private overlay!: Phaser.GameObjects.Graphics;
  private ball!: Phaser.GameObjects.Image;
  private ballGlow!: Phaser.GameObjects.Image;
  private trailGfx!: Phaser.GameObjects.Graphics;
  /** Recent screen positions of the ball, for its fading trail. */
  private trail: Array<{ x: number; y: number; d: number }> = [];
  private scoreText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;

  /** Free Practice: 'attack' = you play any shot at the opponents, 'defend' = the opponents play a shot of your choice at you. */
  private practice: 'attack' | 'defend' | null = null;
  private pr: { ball: Height; glass: boolean; weakLob: boolean; me: Formation; opp: Formation; result: 'auto' | HitOptions['force']; page: number } = {
    ball: 'mid', glass: false, weakLob: false, me: 'back', opp: 'back', result: 'auto', page: 0,
  };

  constructor() {
    super('MatchScene');
  }

  // Phaser keeps the data of the previous start when a scene is started without any: a normal match is always started with { practice: null }.
  init(data?: { practice?: 'attack' | 'defend' | null; career?: CareerMatch | null }): void {
    this.practice = data?.practice ?? null;
    this.career = data?.career ?? null;
    this.pr = { ball: 'mid', glass: false, weakLob: false, me: 'back', opp: 'back', result: 'auto', page: 0 };
  }

  create(): void {
    applyHd(this);
    const profile = getSave().profile;
    // Queued consumables boost one real match (not Free Practice) and are used up when it starts.
    const boost = this.practice ? undefined : boostOf(profile.inventory);
    this.recoveryPct = boost?.recoveryPct ?? 0;
    const partner = this.career ? (partnerById(profile.career.partnerId) ?? BASE_YOU[1]) : BASE_YOU[1];
    TEAMS = [[heroFrom(BASE_YOU[0], profile, boost), partner], this.career ? this.career.opponents : DEFAULT_CPU];
    if (boost && profile.inventory.queued.length > 0) {
      updateSave((d) => ({ ...d, profile: { ...d.profile, inventory: consumeQueued(d.profile.inventory) } }));
    }
    this.pointsWon = [0, 0];
    this.longestRally = 0;
    this.matchScore = newScore(2);
    this.server = 0;
    this.serverIdx = [0, 0];
    this.busy = false;
    this.menu = [];
    this.views = {};
    this.pos = {};
    this.activeId = null;
    this.guts = {};
    for (const p of TEAMS.flat()) this.guts[p.id] = p.maxGuts;

    this.trail = [];
    this.drawArenaHd();
    this.overlay = this.add.graphics().setDepth(1);
    this.createViews();
    this.redrawBall = ensureBallTextures(this).redrawBall;
    this.trailGfx = this.add.graphics().setDepth(4990);
    this.ballGlow = this.add.image(0, 0, GLOW_KEY).setDepth(4999).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
    this.ball = this.add.image(0, 0, BALL_KEY).setDepth(5000);

    // Scoreboard panel, TV style
    const bug = this.add.graphics().setPosition(WIDTH / 2, 27).setDepth(9990).setAlpha(0.9);
    drawPanel(bug, 196, 44, 0x6f8bff, false, 0x0d1030);
    this.scoreText = this.add
      .text(WIDTH / 2, 9, '', { fontFamily: FONT, resolution: HD_SCALE, fontSize: '15px', color: '#ffe066', align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(10000);
    this.logText = this.add
      .text(WIDTH / 2, 391, '', {
        fontFamily: FONT, resolution: HD_SCALE,
        fontSize: '11px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 340 },
      })
      .setOrigin(0.5, 0)
      .setDepth(10000);

    this.heightText = this.add
      .text(WIDTH / 2, 358, '', { fontFamily: FONT, resolution: HD_SCALE, fontSize: '30px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#000000', 6)
      .setShadow(0, 3, '#000000', 4, true, true)
      .setDepth(9001)
      .setAlpha(0.92)
      .setVisible(false);
    this.heightSub = this.add
      .text(WIDTH / 2, 378, '', { fontFamily: FONT, resolution: HD_SCALE, fontSize: '12px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#000000', 4)
      .setDepth(9001)
      .setVisible(false);

    this.refreshScore();
    this.refreshGuts();
    if (this.practice) this.practiceMenu();
    else this.beginPoint();
  }

  // ---------- arena: a pre-rendered, lit picture of the court (see art/hd/arenaHd.ts) ----------

  private drawArenaHd(): void {
    const { netY } = ensureArenaTextures(this);
    this.add.image(0, 0, ARENA_BACK_KEY).setOrigin(0, 0).setDisplaySize(WIDTH, HEIGHT).setDepth(-10);
    // The net is its own strip, sorted with the players: far players stand behind it, near players in front.
    const net = this.add.image(0, netY, ARENA_NET_KEY).setOrigin(0, 0).setDepth(project(0, NET_Z).y);
    net.setDisplaySize(WIDTH, net.height / HD_SCALE);
  }

  // ---------- players and ball ----------

  private createViews(): void {
    ([0, 1] as SideIndex[]).forEach((side) => {
      TEAMS[side].forEach((player, idx) => {
        this.pos[player.id] = restPos(side, idx, 'back');
        const key = ensureCharacterTexture(this, player.appearance, side === 0 ? 'back' : 'front');
        const sprite = this.add.image(0, 0, key).setOrigin(0.5, 1);
        const label = this.add
          .text(0, 0, '', { fontFamily: FONT, resolution: HD_SCALE, fontSize: '10px', color: '#ffffff', align: 'center' })
          .setOrigin(0.5, side === 0 ? 0 : 1)
          .setStroke('#000000', 3)
          .setDepth(9000);
        this.views[player.id] = { sprite, label, player, side, lift: 0, pose: 'ready', facing: side === 0 ? 'back' : 'front', busyUntil: 0 };
        this.placeView(player.id);
      });
    });
    this.redrawOverlay();
  }

  private placeView(id: string): void {
    const v = this.views[id];
    const pos = this.pos[id];
    const p = project(pos.x, pos.z);
    const scale = (p.scale * VISUAL_HEIGHT_M) / (SPRITE_H * HD_CHARACTER_SCALE);
    const spriteHeight = SPRITE_H * HD_CHARACTER_SCALE * scale;
    v.sprite.setPosition(p.x, p.y - v.lift).setScale(scale).setDepth(p.y);
    v.label.setPosition(p.x, v.side === 0 ? p.y + 6 : p.y - spriteHeight - 2 - v.lift);
  }

  /** Shadows under players and ball, and the ring under the player who has to act. */
  private redrawOverlay(): void {
    const g = this.overlay;
    g.clear();
    g.fillStyle(0x000000, 0.35);
    for (const id of Object.keys(this.views)) {
      const p = project(this.pos[id].x, this.pos[id].z);
      g.fillEllipse(p.x, p.y, p.scale * 1.1, p.scale * 0.4);
    }
    const b = project(this.ballFloor.x, this.ballFloor.z);
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(b.x, b.y, Math.max(5, b.scale * 0.35), Math.max(2, b.scale * 0.12));
    if (this.activeId) {
      const p = project(this.pos[this.activeId].x, this.pos[this.activeId].z);
      g.lineStyle(2, 0xffe066, 1);
      g.strokeEllipse(p.x, p.y, p.scale * 1.5, p.scale * 0.6);
    }
  }

  private setActive(id: string | null): void {
    this.activeId = id;
    this.redrawOverlay();
  }

  /** Places the ball. `trail` = false puts it down without a trail (a new serve). */
  private setBall(x: number, z: number, h: number, trail = true): void {
    const p = project(x, z, h);
    this.ballFloor = { x, z };
    const d = Math.max(6, p.scale * 0.3);
    const now = this.time.now;
    if (trail) {
      const dt = Math.min(0.05, Math.max(0, (now - this.ballTurnedAt) / 1000));
      if (dt > 0) {
        this.ballR = rotate(this.ballR, this.ballOmega, dt);
        this.redrawBall(this.ballR);
      }
    }
    this.ballTurnedAt = now;
    this.ball.setPosition(p.x, p.y).setDisplaySize(d, d);
    this.ballGlow.setPosition(p.x, p.y).setDisplaySize(d * 3.4, d * 3.4);
    if (trail) {
      this.trail.push({ x: p.x, y: p.y, d });
      if (this.trail.length > 14) this.trail.shift();
    } else {
      this.trail = [];
    }
    this.drawTrail();
    this.redrawOverlay();
  }

  private drawTrail(): void {
    const g = this.trailGfx;
    g.clear();
    const n = this.trail.length;
    this.trail.forEach((t, i) => {
      const k = (i + 1) / n;
      g.fillStyle(0xfff4a0, 0.3 * k);
      g.fillCircle(t.x, t.y, t.d * 0.5 * (0.35 + 0.65 * k));
    });
  }

  /** Dust where the ball bounces, a flash where it hits the glass or the net. */
  private impactFx(e: FlightEvent, path: Sample[]): void {
    const p = project(e.x, e.z, e.h);
    // The sound depends on the material and on how hard the ball arrives.
    const { v, vy } = speedAt(path, e.t);
    if (e.kind === 'bounce') {
      if (Math.abs(vy) > 0.6) impactSound('floor', Math.min(1, (Math.abs(vy) / 11) * 0.8 + (v / 40) * 0.2));
    } else if (e.kind === 'glass' || e.kind === 'mesh' || e.kind === 'net') {
      impactSound(e.kind, Math.min(1, v / (e.kind === 'net' ? 20 : 24)));
    }
    if (e.kind === 'bounce' && this.powerStyle !== null) {
      this.powerImpact(p, this.powerStyle);
      this.powerStyle = null;
    }
    if (e.kind === 'bounce') {
      const puff = this.add.ellipse(p.x, p.y, Math.max(4, p.scale * 0.22), Math.max(2, p.scale * 0.09), 0xffffff, 0.55).setDepth(p.y);
      this.tweens.add({ targets: puff, scaleX: 3.4, scaleY: 2, alpha: 0, duration: 340, ease: 'Quad.easeOut', onComplete: () => puff.destroy() });
    } else if (e.kind === 'glass' || e.kind === 'mesh') {
      const color = e.kind === 'glass' ? 0xcfeaff : 0xdde3f0;
      const flash = this.add.ellipse(p.x, p.y, Math.max(4, p.scale * 0.2), Math.max(8, p.scale * 0.8), color, 0.85).setDepth(4000);
      this.tweens.add({ targets: flash, scaleX: 2.6, scaleY: 1.3, alpha: 0, duration: 280, onComplete: () => flash.destroy() });
    } else if (e.kind === 'net') {
      const flash = this.add.circle(p.x, p.y, Math.max(3, p.scale * 0.15), 0xffffff, 0.8).setDepth(4000);
      this.tweens.add({ targets: flash, scale: 3, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    }
  }

  /**
   * Where a Por Cuatro / strong Por Tres hits the court: a bright flash, a shock ring on the floor, sparks flying out and a scuff mark,
   * and a small shake of the camera (Por Cuatro), so that one can feel the power go into the floor.
   */
  private powerImpact(p: { x: number; y: number; scale: number }, style: 'x4' | 'x3'): void {
    const big = style === 'x4';
    const k = big ? 1 : 0.7;
    const core = this.add.circle(p.x, p.y, Math.max(5, p.scale * 0.3) * k, 0xffffff, 0.95).setDepth(9990);
    this.tweens.add({ targets: core, scale: 3.2, alpha: 0, duration: 190, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
    const glow = this.add.ellipse(p.x, p.y, Math.max(10, p.scale * 0.7) * k, Math.max(5, p.scale * 0.3) * k, 0xffb347, 0.75).setDepth(9989);
    this.tweens.add({ targets: glow, scaleX: 4.2, scaleY: 3, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });
    for (let i = 0; i < (big ? 3 : 2); i++) {
      const ring = this.add.ellipse(p.x, p.y, 16 * k, 7 * k, 0xffffff, 0).setStrokeStyle(big ? 3 : 2, i === 0 ? 0xffe066 : 0xffffff, 1).setDepth(9988);
      this.tweens.add({ targets: ring, scaleX: 3 + i * 1.6, scaleY: 3 + i * 1.6, alpha: 0, delay: i * 70, duration: 460, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }
    const n = big ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + (i % 2) * 0.2;
      const len = (big ? 34 : 22) * (0.7 + 0.6 * ((i * 7) % 5) / 4);
      const spark = this.add.rectangle(p.x, p.y, 8 * k, 2.5 * k, i % 2 === 0 ? 0xffe066 : 0xffffff, 1).setDepth(9991).setRotation(ang);
      this.tweens.add({ targets: spark, x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len * 0.45, alpha: 0, scaleX: 0.3, duration: 330, ease: 'Quad.easeOut', onComplete: () => spark.destroy() });
    }
    const scuff = this.add.ellipse(p.x, p.y, 14 * k, 6 * k, 0x000000, 0.28).setDepth(p.y - 1);
    this.tweens.add({ targets: scuff, alpha: 0, delay: 700, duration: 900, onComplete: () => scuff.destroy() });
    this.cameras.main.shake(big ? 110 : 70, big ? 0.0035 : 0.002);
  }

  /** A big, short-lived banner such as ACE! in the middle of the court, with the shot that won it underneath. */
  private announce(text: string, color: string, sub?: string): void {
    const t = this.add
      .text(WIDTH / 2, 205, text, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '34px', fontStyle: 'bold', color })
      .setOrigin(0.5)
      .setStroke('#000000', 6)
      .setShadow(0, 4, '#000000', 6, true, true)
      .setDepth(9995)
      .setAlpha(0)
      .setScale(0.6);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 170, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1100, duration: 260, onComplete: () => t.destroy() });
    if (!sub) return;
    const chip = this.add.container(WIDTH / 2, 245).setDepth(9995).setAlpha(0).setScale(0.4);
    const label = this.add
      .text(0, 0, sub, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '17px', fontStyle: 'bold', color: '#0d1030' })
      .setOrigin(0.5);
    const bg = this.add.graphics();
    bg.fillStyle(0xffe066, 1);
    bg.fillRoundedRect(-label.width / 2 - 12, -label.height / 2 - 4, label.width + 24, label.height + 8, 10);
    bg.lineStyle(2, 0x0d1030, 1);
    bg.strokeRoundedRect(-label.width / 2 - 12, -label.height / 2 - 4, label.width + 24, label.height + 8, 10);
    chip.add([bg, label]);
    this.tweens.add({ targets: chip, alpha: 1, scale: 1, delay: 120, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: chip, alpha: 0, delay: 1150, duration: 260, onComplete: () => chip.destroy() });
  }

  /** A flash of light and a shock ring where the ball is when a point is won. */
  private winFlash(): void {
    this.cameras.main.flash(170, 255, 246, 170);
    const p = project(this.ballFloor.x, this.ballFloor.z);
    for (let i = 0; i < 2; i++) {
      const ring = this.add.circle(p.x, p.y, 10, 0xffffff, 0).setStrokeStyle(3, 0xffe066, 1).setDepth(9994).setScale(0.3);
      this.tweens.add({ targets: ring, scale: 4 + i * 2, alpha: 0, delay: i * 120, duration: 520, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }
  }

  private hop(id: string, height = 8): void {
    const v = this.views[id];
    this.tweens.add({
      targets: v,
      lift: height,
      duration: height > 10 ? 150 : 110,
      yoyo: true,
      ease: 'Quad.easeOut',
      onUpdate: () => this.placeView(id),
    });
  }

  /** Shows the player in a pose (a picture drawn once per look, facing and pose). */
  private setPose(id: string, pose: PoseName): void {
    const v = this.views[id];
    if (v.pose === pose) return;
    v.pose = pose;
    v.sprite.setTexture(ensureCharacterTexture(this, v.player.appearance, v.facing, pose));
  }

  private defaultFacing(id: string): Facing {
    return this.views[id].side === 0 ? 'back' : 'front';
  }

  private setFacing(id: string, facing: Facing): void {
    const v = this.views[id];
    if (v.facing === facing) return;
    v.facing = facing;
    v.sprite.setTexture(ensureCharacterTexture(this, v.player.appearance, facing, v.pose));
  }

  /** A runner looks where he runs: sideways in profile, otherwise towards or away from the camera. */
  private runFacing(dx: number, dz: number): Facing {
    if (Math.abs(dx) >= Math.abs(dz) * 1.1) return dx > 0 ? 'right' : 'left';
    return dz > 0 ? 'front' : 'back';
  }

  /** The stroke: contact pose, follow-through, then back to ready. Overhead shots are played with a jump. */
  private swing(id: string, shot: ShotDef | null, aimDx = 0): void {
    const v = this.views[id];
    const overhead = shot === null || shot.id.startsWith('smash_') || shot.id === 'bandeja' || shot.id === 'vibora' || shot.id === 'rulo';
    // The rulo is hit overhead with the body turned sideways, towards the fence it is played to.
    if (shot?.id === 'rulo') this.setFacing(id, aimDx >= 0 ? 'right' : 'left');
    const prep = this.stance[id];
    const stance: Stance = overhead ? 'smash' : prep === undefined || prep === 'smash' ? 'fh' : prep;
    v.busyUntil = this.time.now + 420;
    this.setPose(id, poseOf(stance, 'Hit'));
    if (stance === 'smash') this.hop(id, 13);
    this.time.delayedCall(130, () => this.setPose(id, poseOf(stance, 'Follow')));
    this.time.delayedCall(420, () => {
      if (this.views[id].busyUntil <= this.time.now) {
        this.setFacing(id, this.defaultFacing(id));
        this.setPose(id, 'ready');
      }
    });
  }

  /** 1 for a fresh player, down to 0.7 on an empty guts bar (see `fatigueFactor`). */
  private freshness(id: string): number {
    const p = TEAMS.flat().find((q) => q.id === id);
    return p && this.guts[id] !== undefined ? fatigueFactor(this.guts[id], p.maxGuts) : 1;
  }

  /** Walks players to the given court positions, running (two alternating leg poses) while they move. */
  private movePlayers(
    targets: Record<string, CourtPos>,
    duration: number,
    onDone?: () => void,
    endPose: Record<string, PoseName> = {},
    endFacing: Record<string, Facing> = {},
  ): void {
    const ids = Object.keys(targets);
    // Tired players run slower: the move takes longer (by up to 30%) when the slowest of them is on the bar's last legs.
    const slowest = Math.min(1, ...ids.map((id) => this.freshness(id)));
    duration = duration / Math.max(0.77, slowest);
    const starts: Record<string, CourtPos> = {};
    for (const id of ids) starts[id] = { ...this.pos[id] };
    const running = new Set(ids.filter((id) => Math.hypot(targets[id].x - starts[id].x, targets[id].z - starts[id].z) > 0.35));
    for (const id of running) {
      if (this.time.now >= this.views[id].busyUntil) {
        this.setFacing(id, this.runFacing(targets[id].x - starts[id].x, targets[id].z - starts[id].z));
      }
    }
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const t = tween.getValue() ?? 0;
        const frame = Math.floor(this.time.now / 115) % 2 === 0;
        for (const id of ids) {
          this.pos[id] = { x: lerp(starts[id].x, targets[id].x, t), z: lerp(starts[id].z, targets[id].z, t) };
          const v = this.views[id];
          if (running.has(id) && t < 0.97 && this.time.now >= v.busyUntil) {
            this.setPose(id, frame ? 'runA' : 'runB');
            v.lift = frame ? 2 : 0;
          }
          this.placeView(id);
        }
        this.redrawOverlay();
      },
      onComplete: () => {
        for (const id of ids) {
          this.pos[id] = { ...targets[id] };
          const v = this.views[id];
          if (this.time.now >= v.busyUntil) {
            if (running.has(id) || endPose[id] || endFacing[id]) {
              this.setFacing(id, endFacing[id] ?? this.defaultFacing(id));
              this.setPose(id, endPose[id] ?? 'ready');
            }
            v.lift = 0;
          }
          this.placeView(id);
        }
        this.redrawOverlay();
        onDone?.();
      },
    });
  }

  /** Where everybody stands in the rally, given the teams' formations. */
  private rallyTargets(state: PointState): Record<string, CourtPos> {
    const t: Record<string, CourtPos> = {};
    ([0, 1] as SideIndex[]).forEach((side) => {
      TEAMS[side].forEach((p, idx) => {
        t[p.id] = restPos(side, idx, state.formation[side]);
      });
    });
    return t;
  }

  private refreshGuts(): void {
    for (const v of Object.values(this.views)) {
      v.label.setText(`${v.player.name}\nG ${Math.floor(this.guts[v.player.id])}/${v.player.maxGuts}`);
    }
  }

  private refreshScore(): void {
    if (this.practice) {
      this.scoreText.setText(`FREE PRACTICE\n${this.practice === 'attack' ? 'ATTACKING' : 'DEFENDING'}`);
      return;
    }
    const s = this.matchScore;
    const [a, b] = pointLabels(s);
    const deuce = deuceLabel(s);
    this.scoreText.setText(`YOU ${s.games[0]} - ${s.games[1]} CPU\n${a} - ${b}${deuce ? `  ${deuce}` : ''}`);
  }

  private say(msg: string): void {
    this.lastSaid = msg;
    this.logText.setText(msg);
  }

  // ---------- menu ----------

  private clearMenu(): void {
    for (const o of this.menu) o.destroy();
    this.menu = [];
  }

  private showButtons(title: string, items: ButtonSpec[]): void {
    this.clearMenu();
    // No caption above the buttons (the owner does not want the "who: shot (ball ...)" line); `title` stays for the callers.
    void title;
    // Up to 6 buttons: 2 big columns; more: 3 compact columns.
    const compact = items.length > 6;
    const cols = compact ? 3 : 2;
    const w = compact ? 112 : 160;
    const h = compact ? 44 : 48;
    const gapY = compact ? 52 : 58;
    const y0 = compact ? 478 : 485;
    items.forEach((item, i) => {
      const x = compact ? 62 + (i % cols) * 118 : 95 + (i % cols) * 170;
      const y = y0 + Math.floor(i / cols) * gapY;
      const gfx = this.add.graphics().setPosition(x, y);
      const stroke = TONE_STROKE[item.tone];
      const redraw = (hover: boolean): void => drawPanel(gfx, w, h, stroke, hover && !item.disabled);
      redraw(false);
      const bg = this.add.zone(x, y, w, h);
      const text = this.add
        .text(x, y, item.label, {
          fontFamily: FONT, resolution: HD_SCALE,
          fontSize: compact ? '11px' : '14px',
          color: TONE_TEXT[item.tone],
          align: 'center',
        })
        .setOrigin(0.5);
      if (!item.disabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => redraw(true));
        bg.on('pointerout', () => redraw(false));
        bg.on('pointerdown', () => {
          if (this.busy) return;
          this.busy = true;
          sfx('select');
          this.clearMenu();
          item.onPick();
        });
      }
      this.menu.push(gfx, bg, text);
    });
    this.busy = false;
  }

  /** Colour hint for a shot: red = too tired, green = good against this ball, orange = poor. */
  private toneFor(shot: ShotDef, hitter: PlayerDef): Tone {
    if (this.guts[hitter.id] < shot.cost) return 'tired';
    const fit = shot.fit[this.point.ball.height];
    if (fit >= 1.05) return 'good';
    if (fit <= 0.85) return 'poor';
    return 'normal';
  }


  // ---------- Free Practice ----------

  private practiceState(holder: SideIndex, hitterIdx: number): PointState {
    return {
      ...startPoint(this.guts, 0, HUMAN_IDX, 0),
      status: 'rally',
      holder,
      hitterIdx,
      hits: 1,
      ball: { height: this.pr.ball, pressure: 0, glass: this.pr.glass, air: !this.pr.glass, zone: 'mid', speed: 18, lob: this.pr.weakLob && holder === HUMAN_SIDE ? 'weak' : undefined },
      formation: [this.pr.me, this.pr.opp],
    };
  }

  /** Puts everybody back in place, refills the guts and shows the menu of the exercise. */
  private practiceMenu(): void {
    this.clearMenu();
    this.hideHeight();
    this.setActive(null);
    for (const p of TEAMS.flat()) this.guts[p.id] = p.maxGuts;
    this.refreshGuts();
    const attack = this.practice === 'attack';
    const st = this.practiceState(attack ? HUMAN_SIDE : 1, attack ? HUMAN_IDX : 0);
    this.point = st;
    for (const id of Object.keys(this.views)) {
      this.setFacing(id, this.defaultFacing(id));
      this.setPose(id, 'ready');
    }
    this.movePlayers(this.rallyTargets(st), 450, () => {
      const place = (): void => {
        if (this.coastRunning) {
          this.time.delayedCall(80, place);
          return;
        }
        this.stopCoast();
        const holder = TEAMS[st.holder][st.hitterIdx];
        this.ballH = attack ? ARRIVAL_HEIGHT[this.pr.ball] : HIT_HEIGHT_M;
        this.setBall(this.pos[holder.id].x, this.pos[holder.id].z, this.ballH, false);
        this.showPracticeButtons();
      };
      place();
    });
  }

  /** Attacking: serves and the shots that can be played with the ball and positions of the SETUP (the rules are the same as in a match). Defending: every shot the opponents can play. */
  private practiceShots(): ShotDef[] {
    const all = [...shotsOfKind('serve'), ...shotsOfKind('return'), ...shotsOfKind('rally')];
    if (this.practice !== 'attack') return all;
    return all.filter((sh) => sh.kind === 'serve' || unavailableReason(sh, this.point) === null);
  }

  private showPracticeButtons(): void {
    const attack = this.practice === 'attack';
    const all = this.practiceShots();
    const per = 6;
    const pages = Math.ceil(all.length / per);
    this.pr.page %= pages;
    const page = this.pr.page;
    const items: ButtonSpec[] = all.slice(page * per, (page + 1) * per).map((sh) => ({
      label: sh.name,
      tone: 'normal' as Tone,
      onPick: () => (attack ? this.practicePick(sh) : this.practiceFeed(sh)),
    }));
    items.push(
      { label: `MORE\n${page + 1}/${pages}`, tone: 'good', onPick: () => { this.pr.page++; this.showPracticeButtons(); } },
      { label: 'SETUP', tone: 'good', onPick: () => this.showPracticeSetup() },
      { label: 'EXIT', tone: 'tired', onPick: () => this.scene.start('TitleScene') },
    );
    if (attack) {
      this.say('FREE PRACTICE, attacking: the shots you can play with this ball (change it in SETUP).');
      this.showHeight(this.pr.ball, this.pr.glass ? ', off the glass' : '');
    } else {
      this.say('FREE PRACTICE, defending: pick the shot the opponents play at you, then return it.');
    }
    this.showButtons('practice', items);
  }

  private showPracticeSetup(): void {
    const next = <T,>(list: T[], cur: T): T => list[(list.indexOf(cur) + 1) % list.length];
    const forms: Formation[] = ['net', 'mid', 'back'];
    const results: Array<'auto' | HitOptions['force']> = ['auto', 'continue', 'winner', 'error', 'intercept', 'rebound'];
    const again = (): void => this.showPracticeSetup();
    const items: ButtonSpec[] = [];
    if (this.practice === 'attack') {
      items.push(
        { label: `BALL\n${this.pr.ball.toUpperCase()}`, tone: 'normal', onPick: () => { this.pr.ball = next<Height>(['low', 'mid', 'high'], this.pr.ball); again(); } },
        { label: `OFF GLASS\n${this.pr.glass ? 'YES' : 'NO'}`, tone: 'normal', onPick: () => { this.pr.glass = !this.pr.glass; again(); } },
        { label: `WEAK LOB\n${this.pr.weakLob ? 'YES' : 'NO'}`, tone: 'normal', onPick: () => { this.pr.weakLob = !this.pr.weakLob; again(); } },
        { label: `RESULT\n${String(this.pr.result).toUpperCase()}`, tone: 'normal', onPick: () => { this.pr.result = next(results, this.pr.result); again(); } },
      );
    }
    items.push(
      { label: `YOU\n${this.pr.me.toUpperCase()}`, tone: 'normal', onPick: () => { this.pr.me = next(forms, this.pr.me); again(); } },
      { label: `OPPONENTS\n${this.pr.opp.toUpperCase()}`, tone: 'normal', onPick: () => { this.pr.opp = next(forms, this.pr.opp); again(); } },
      { label: 'DONE', tone: 'good', onPick: () => this.practiceMenu() },
    );
    this.say('SETUP: ball, position of you and the opponents, and how your shot ends (RESULT: winner, error, REBOUND = back over the net...).');
    this.showButtons('setup', items);
  }

  private practicePick(shot: ShotDef): void {
    if (shot.kind === 'serve') {
      this.practiceServe(shot, HUMAN_SIDE);
      return;
    }
    const options: HitOptions = { force: this.pr.result === 'auto' ? undefined : this.pr.result };
    if (shot.fixedDirection) {
      this.performHit(shot, shot.fixedDirection, undefined, options);
      return;
    }
    const items: ButtonSpec[] = DIRECTION_ORDER.map((d) => ({
      label: DIRECTIONS[d].name.toUpperCase(),
      tone: 'normal' as Tone,
      onPick: () => this.performHit(shot, d, undefined, options),
    }));
    items.push({ label: 'BACK', tone: 'normal', onPick: () => this.showPracticeButtons() });
    this.showButtons(`${shot.name}: which way?`, items);
  }

  /** The opponents play `shot` at you (the human). */
  private practiceFeed(shot: ShotDef): void {
    if (shot.kind === 'serve') {
      this.practiceServe(shot, 1);
      return;
    }
    const dirs: Direction[] = ['parallel', 'middle', 'cross'];
    for (let i = 0; i < 80; i++) {
      const hitterIdx = Math.random() < 0.5 ? 0 : 1;
      const st = this.practiceState(1, hitterIdx);
      const dir = shot.fixedDirection ?? dirs[Math.floor(Math.random() * dirs.length)];
      const r = stepHit(TEAMS, st, shot, dir, Math.random, undefined, { force: 'continue', ignoreRequires: true });
      if (r.step.defenderIdx === HUMAN_IDX && r.state.holder === HUMAN_SIDE) {
        this.point = st;
        const hitter = TEAMS[1][hitterIdx];
        this.ballH = HIT_HEIGHT_M;
        this.setBall(this.pos[hitter.id].x, this.pos[hitter.id].z, this.ballH, false);
        this.playStep(r.step, r.state);
        return;
      }
    }
    this.practiceMenu();
  }

  /** A serve of the practice: by you (attacking) or at you (defending). The players walk to the serving positions first. */
  private practiceServe(shot: ShotDef, serverSide: SideIndex): void {
    const serverIdx = serverSide === HUMAN_SIDE ? HUMAN_IDX : 0;
    let points = 0;
    let st = startPoint(this.guts, serverSide, serverIdx, points);
    if (serverSide !== HUMAN_SIDE) {
      // You are the receiver: pick the serving side (point number) that makes you receive.
      for (points = 0; points < 4; points++) {
        st = startPoint(this.guts, serverSide, serverIdx, points);
        if (st.receiverIdx === HUMAN_IDX) break;
      }
    }
    this.point = st;
    const setup = serveSetup(serverSide, points, serverIdx);
    const recvSide = other(serverSide);
    const server = TEAMS[serverSide][serverIdx];
    const targets: Record<string, CourtPos> = {
      [server.id]: setup.server,
      [TEAMS[serverSide][1 - serverIdx].id]: setup.partner,
      [TEAMS[recvSide][setup.receiverIdx].id]: setup.receiver,
      [TEAMS[recvSide][1 - setup.receiverIdx].id]: setup.receiverPartner,
    };
    this.movePlayers(targets, 450, () => {
      this.stance[server.id] = 'smash';
      this.setPose(server.id, 'smashPrep');
      this.ballH = HIT_HEIGHT_M;
      this.setBall(this.pos[server.id].x, this.pos[server.id].z, this.ballH, false);
      this.chooseReceive(shot);
    });
  }

  // ---------- flow: serve -> return -> rally ----------

  private beginPoint(): void {
    // Star Point: the receiving pair chooses who receives, which also decides the side the serve comes from.
    if (!isStarPoint(this.matchScore)) {
      this.startServe();
      return;
    }
    const recvSide = other(this.server);
    if (recvSide !== HUMAN_SIDE) {
      const choice = pickStarReceiver(TEAMS[recvSide], Math.random);
      this.say(`STAR POINT: ${TEAMS[recvSide][choice].name} will receive.`);
      this.startServe(choice);
      return;
    }
    this.setActive(null);
    this.say('STAR POINT! Who receives?');
    this.showButtons(
      'Star Point: who receives?',
      TEAMS[recvSide].map((pl, i) => ({
        label: `${pl.name}\n[${laneSign(i) < 0 ? 'left' : 'right'} side]`,
        tone: 'normal' as Tone,
        onPick: () => {
          this.clearMenu();
          this.startServe(i);
        },
      })),
    );
  }

  /** Sets up one point: players walk to their serving positions, then the server's turn starts. */
  private startServe(receiverChoice?: number): void {
    const pointsPlayed = this.matchScore.points[0] + this.matchScore.points[1];
    const idx = this.serverIdx[this.server];
    this.point = startPoint(this.guts, this.server, idx, pointsPlayed, receiverChoice);

    // Serve set-up: the server stands in their serving lane, the partner in the middle of their half.
    const setup = serveSetup(this.server, pointsPlayed, idx, receiverChoice);
    const recvSide = other(this.server);
    const targets: Record<string, CourtPos> = {
      [TEAMS[this.server][idx].id]: setup.server,
      [TEAMS[this.server][1 - idx].id]: setup.partner,
      [TEAMS[recvSide][setup.receiverIdx].id]: setup.receiver,
      [TEAMS[recvSide][1 - setup.receiverIdx].id]: setup.receiverPartner,
    };
    for (const id of Object.keys(this.views)) {
      this.setFacing(id, this.defaultFacing(id));
      this.setPose(id, 'ready');
    }
    this.setActive(null);
    this.movePlayers(targets, 450, () => {
      // The ball of the last point is never stopped: it is put down for the serve only when it has finished rolling.
      const place = (): void => {
        if (this.coastRunning) {
          this.time.delayedCall(80, place);
          return;
        }
        this.stopCoast();
        this.ballH = HIT_HEIGHT_M;
        this.setBall(setup.server.x, setup.server.z, this.ballH, false);
        this.serveTurn();
      };
      place();
    });
  }

  private isHuman(side: SideIndex, idx: number): boolean {
    return side === HUMAN_SIDE && idx === HUMAN_IDX;
  }

  private serveTurn(): void {
    const st = this.point;
    const server = TEAMS[st.servingSide][st.serverIdx];
    const tag = st.attempt === 2 ? ' (2nd serve)' : '';

    this.stance[server.id] = 'smash';
    this.setPose(server.id, 'smashPrep'); // the toss: racket back, other arm up
    // The ball is back in the server's hand (after a fault it lay at the net).
    this.ballH = HIT_HEIGHT_M;
    this.setBall(this.pos[server.id].x, this.pos[server.id].z, this.ballH, false);

    if (this.isHuman(st.servingSide, st.serverIdx)) {
      this.setActive(server.id);
      this.showButtons(
        `${server.name}: serve${tag}`,
        shotsOfKind('serve').map((s) => ({
          label: `${s.name}\n[${s.cost}]${this.guts[server.id] < s.cost ? ' tired' : ''}`,
          tone: this.toneFor(s, server),
          onPick: () => this.chooseReceive(s),
        })),
      );
    } else {
      this.setActive(null);
      const shot = pickServe(TEAMS, st, Math.random);
      this.time.delayedCall(CPU_DELAY, () => this.chooseReceive(shot));
    }
  }

  /**
   * A serve to the side glass can be taken straight after the bounce or after the glass: the receiver decides.
   * Your own receiver gets a menu, everybody else decides automatically.
   */
  private chooseReceive(shot: ShotDef): void {
    const st = this.point;
    if (shot.wall === 'none') {
      this.performServe(shot, 'bounce');
      return;
    }
    const recvSide = other(st.servingSide);
    const receiver = TEAMS[recvSide][st.receiverIdx];
    if (!this.isHuman(recvSide, st.receiverIdx)) {
      this.performServe(shot, pickReceive(TEAMS, st, Math.random));
      return;
    }
    this.setActive(receiver.id);
    this.previewServe(shot);
  }

  /**
   * The human receiver decides while the serve is in the air: the ball flies until just before its bounce, then crawls in slow
   * motion for a moment, with the speed of the serve and the spot where it will hit the glass on the screen and a bar that runs
   * out. After the choice (or when the bar is empty: on the bounce) the same flight carries on from where it was.
   */
  private previewServe(shot: ShotDef): void {
    const st = this.point;
    const server = TEAMS[st.servingSide][st.serverIdx];
    const receiver = TEAMS[other(st.servingSide)][st.receiverIdx];
    const seed = Math.floor(Math.random() * 1e9);
    const probe = stepServe(TEAMS, st, shot, seededRng(seed), 'bounce');
    const startH = this.ballH;
    const { flight, landX } = this.buildStepFlight(probe.step, seed, startH);
    const bounce = flight.events.find((e) => e.kind === 'bounce');
    // A fault is a fault whatever the receiver does: no decision, the serve just plays.
    if (probe.step.outcome === 'fault') {
      this.performServe(shot, 'bounce', { seed });
      return;
    }
    if (!bounce || flight.duration <= 0) {
      this.showButtons(`${receiver.name}: take it...`, [
        { label: 'ON THE BOUNCE\nfast, clean', tone: 'normal', onPick: () => this.performServe(shot, 'bounce') },
        { label: 'OFF THE GLASS\nmore time', tone: 'normal', onPick: () => this.performServe(shot, 'wall') },
      ]);
      return;
    }
    const total = flightDuration(flight);
    const pb = bounce.t / flight.duration;
    const p0 = pb * 0.78;
    const p1 = pb * 0.93;
    const kmh = Math.round(shot.flight.speed * (probe.step.second ? SECOND_SERVE_SPEED : 1) * powerSpeedMul(server.stats.power) * 3.6);
    const where = Math.abs(landX) < 1.2 ? 'to the T' : Math.abs(landX) < 3.4 ? 'at your body' : `wide, off the ${landX < 0 ? 'left' : 'right'} glass`;

    this.say(`${server.name}: ${shot.name}!`);
    impactSound(racketKind(shot.id, true, shot.flight.speed), Math.max(0.15, Math.min(1, shot.flight.speed / 30)));
    this.swing(server.id, null, 0);
    const glassHit = flight.events.find((e) => e.kind === 'glass');

    let progress = 0;
    this.tweens.addCounter({
      from: 0,
      to: p0,
      duration: total * p0,
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        progress = tween.getValue() ?? 0;
        const p = ballPoint(flight.path, progress);
        this.setBall(p.x, p.z, p.h);
      },
      onComplete: () => {
        // The decision: the ball hangs in the air, almost still.
        let decided = false;
        let crawl: Phaser.Tweens.Tween | null = null;
        const choose = (receive: ReceiveMode): void => {
          if (decided) return;
          decided = true;
          crawl?.stop();
          this.tweens.killTweensOf(this.menu);
          this.clearMenu();
          this.performServe(shot, receive, { seed, from: progress, startH });
        };
        this.showButtons(`${receiver.name}: take it...`, [
          { label: 'ON THE BOUNCE\nfast, clean', tone: 'normal', onPick: () => choose('bounce') },
          { label: 'OFF THE GLASS\nmore time', tone: 'normal', onPick: () => choose('wall') },
        ]);
        const title = this.add
          .text(WIDTH / 2, 196, `${kmh} km/h`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '32px', fontStyle: 'bold', color: kmh >= 95 ? '#ff9a6a' : '#ffe066' })
          .setOrigin(0.5)
          .setStroke('#000000', 6)
          .setDepth(9995);
        const sub = this.add
          .text(WIDTH / 2, 226, `${shot.name.toUpperCase()}  ${where.toUpperCase()}`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '12px', fontStyle: 'bold', color: '#ffffff' })
          .setOrigin(0.5)
          .setStroke('#000000', 4)
          .setDepth(9995);
        const barBg = this.add.rectangle(WIDTH / 2, 248, 180, 8, 0x000000, 0.6).setStrokeStyle(1, 0xffffff).setDepth(9995);
        const bar = this.add.rectangle(WIDTH / 2 - 89, 248, 178, 6, 0x5db4ff).setOrigin(0, 0.5).setDepth(9996);
        this.menu.push(title, sub, barBg, bar);
        // Where the ball will land and where it will hit the glass.
        const marks: Array<{ x: number; z: number; h: number; color: number }> = [{ x: bounce.x, z: bounce.z, h: 0, color: 0xffe066 }];
        if (glassHit) marks.push({ x: glassHit.x, z: glassHit.z, h: glassHit.h, color: 0x9fd8ff });
        for (const m of marks) {
          const pr = project(m.x, m.z, m.h);
          const ring = this.add.ellipse(pr.x, pr.y, 22, m.h > 0 ? 22 : 10, 0xffffff, 0).setStrokeStyle(2, m.color, 1).setDepth(9990);
          this.tweens.add({ targets: ring, scale: 1.6, alpha: 0.2, duration: 520, yoyo: true, repeat: -1 });
          this.menu.push(ring);
        }
        this.tweens.add({ targets: bar, scaleX: 0, duration: 2600, ease: 'Linear' });
        crawl = this.tweens.addCounter({
          from: p0,
          to: p1,
          duration: 2600,
          ease: 'Linear',
          onUpdate: (tween: Phaser.Tweens.Tween) => {
            progress = tween.getValue() ?? p0;
            const p = ballPoint(flight.path, progress);
            this.setBall(p.x, p.z, p.h);
          },
          onComplete: () => choose('bounce'),
        });
      },
    });
  }

  private hitTurn(): void {
    const st = this.point;
    const side = st.holder;
    const hitter = TEAMS[side][st.hitterIdx];

    if (this.isHuman(side, st.hitterIdx)) {
      this.setActive(hitter.id);
      this.showShotMenu();
    } else {
      this.setActive(null);
      // The hitter looks for holes: he sees where the opponents stand right now.
      const opp = TEAMS[other(side)].map((p) => ({ ...this.pos[p.id] }));
      const { shot, direction, prefer } = pickHit(TEAMS, st, Math.random, opp);
      this.time.delayedCall(CPU_DELAY, () => this.performHit(shot, direction, prefer));
    }
  }

  /** The height of the ball to play, big and in colour: high = green, mid = blue, low = yellow. */
  private showHeight(height: Height, context: string): void {
    const color: Record<Height, string> = { high: '#4dff88', mid: '#5db4ff', low: '#ffe14d' };
    this.heightText.setText(`${height.toUpperCase()} BALL`).setColor(color[height]).setVisible(true).setScale(1.3);
    this.tweens.add({ targets: this.heightText, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.heightSub.setText(context.replace(/^, /, '')).setVisible(context !== '');
  }

  private hideHeight(): void {
    this.heightText.setVisible(false);
    this.heightSub.setVisible(false);
  }

  private showShotMenu(): void {
    const st = this.point;
    const hitter = TEAMS[0][st.hitterIdx];
    const kind = st.hits === 0 ? 'return' : 'rally';
    const context = st.ball.glass ? ', off the glass' : st.ball.lob === 'weak' ? ', weak lob' : st.ball.lob === 'deep' ? ', deep lob' : '';
    const title = `${hitter.name}: ${kind === 'return' ? 'return' : 'your shot'} (ball ${st.ball.height.toUpperCase()}${context})`;
    const label = (sh: ShotDef): string => {
      const tired = this.guts[hitter.id] < sh.cost ? ' tired' : '';
      return sh.menuLabel ? `${sh.menuLabel} [${sh.cost}]${tired}` : `${sh.name}\n[${sh.cost}]${tired}`;
    };
    // Only the shots that can be played now are offered.
    const items: ButtonSpec[] = playableShots(shotsOfKind(kind), st).map((sh) => ({
      label: label(sh),
      tone: this.toneFor(sh, hitter),
      onPick: () => (sh.fixedDirection ? this.performHit(sh, sh.fixedDirection) : this.showDirectionMenu(sh)),
    }));
    this.showHeight(st.ball.height, context);
    this.showButtons(title, items);
  }

  private showDirectionMenu(shot: ShotDef): void {
    const st = this.point;
    const hitter = TEAMS[0][st.hitterIdx];
    const parallelTarget = TEAMS[1][st.hitterIdx].name;
    const crossTarget = TEAMS[1][1 - st.hitterIdx].name;
    const targetName: Record<Direction, string> = { parallel: parallelTarget, cross: crossTarget, middle: 'both' };

    const items: ButtonSpec[] = DIRECTION_ORDER.map((d) => ({
      label: `${DIRECTIONS[d].name.toUpperCase()}\n-> ${targetName[d]}`,
      tone: 'normal' as Tone,
      onPick: () => this.performHit(shot, d),
    }));
    items.push({ label: 'BACK', tone: 'normal', onPick: () => this.showShotMenu() });
    this.showButtons(`${hitter.name}: ${shot.name}, which way?`, items);
  }

  private performServe(shot: ShotDef, receive: ReceiveMode, opts?: { seed?: number; from?: number; startH?: number }): void {
    this.hideHeight();
    const { state, step } = stepServe(TEAMS, this.point, shot, opts?.seed !== undefined ? seededRng(opts.seed) : Math.random, receive);
    this.playStep(step, state, opts);
  }

  private performHit(shot: ShotDef, direction: Direction, prefer?: AimPreference, options?: HitOptions): void {
    this.hideHeight();
    const { state, step } = stepHit(TEAMS, this.point, shot, direction, Math.random, prefer, options);
    this.playStep(step, state);
  }

  /** The flight of the ball for a step (the same seed always gives the same flight). */
  private buildStepFlight(step: Step, seed: number, startH: number): { flight: Flight; landX: number } {
    const attacker = TEAMS[step.side][step.attackerIdx];
    const landX =
      step.kind === 'serve'
        ? laneSign(step.defenderIdx) * (step.shot.landX ?? 3)
        : step.landX !== undefined
          ? step.landX
          : step.shot.edgeX !== undefined
          ? Math.sign(landingX(step.direction, step.defenderIdx) || 1) * step.shot.edgeX
          : landingX(step.direction, step.defenderIdx);
    const flight = buildFlight({
      from: { ...this.pos[attacker.id] },
      startH,
      hitterSide: step.side,
      shot: step.shot,
      landX,
      outcome: step.outcome,
      receive: step.receive,
      seed,
      glass: step.kind === 'serve' ? undefined : step.glass,
      arrival: step.arrival,
      landDepth: step.landDepth,
      block: step.block,
      airDist: step.airDist,
      errorKind: step.errorKind,
      reboundBack: step.reboundBack,
      netReturn: step.netReturn,
      airHit: step.lob === 'weak',
      // Hard when the ball comes to the hitter's strike zone, slower off a low ball; a volley on a slow ball gets more pace.
      speedMul: (step.kind === 'serve' ? (step.second ? SECOND_SERVE_SPEED : 1) : paceFactor(step.shot, this.point.ball)) * powerSpeedMul(attacker.stats.power * (step.powerFactor ?? 1)),
      spinMul: spinMul(attacker.stats.spin),
    });
    return { flight, landX };
  }

  /**
   * Animates one step (ball flight, hop, movement), then decides what happens next. `from` (0..1) resumes a serve that was already
   * on its way (the receiver's decision): the same seed rebuilds the same flight and it goes on from there.
   */
  private playStep(step: Step, next: PointState, opts?: { seed?: number; from?: number; startH?: number }): void {
    const attacker = TEAMS[step.side][step.attackerIdx];
    const defender = TEAMS[other(step.side)][step.defenderIdx];
    this.stopCoast();
    this.guts = { ...next.guts };
    this.refreshGuts();

    const { flight, landX } = this.buildStepFlight(step, opts?.seed ?? Math.floor(Math.random() * 1e9), opts?.startH ?? this.ballH);
    const from = opts?.from ?? 0;
    const duration = flightDuration(flight);
    // The ball leaves the racket spinning: topspin / backspin about the horizontal axis, side spin about the vertical one.
    {
      const k = Math.min(flight.path.length - 1, 12);
      const a = flight.path[0];
      const b = flight.path[k];
      this.ballOmega = launchSpin(step.shot.flight.spin, step.shot.flight.side, b.x - a.x, b.z - a.z);
      this.ballTurnedAt = this.time.now;
    }

    const way = step.kind === 'serve' ? '' : ` ${DIRECTIONS[step.direction].name.toLowerCase()}`;
    const headline = `${attacker.name}: ${step.shot.name}${way}!${step.tired ? ' (tired)' : ''}`;
    this.say(headline);
    if (from === 0) {
      impactSound(
        racketKind(step.shot.id, step.kind === 'serve', step.shot.flight.speed),
        step.shot.id.startsWith('smash_') || step.shot.id === 'rulo' ? 1 : Math.max(0.15, Math.min(1, step.shot.flight.speed / 30)),
      );
      this.swing(attacker.id, step.kind === 'serve' ? null : step.shot, landX - this.pos[attacker.id].x);
    }
    // Por Cuatro (and a strong Por Tres) leave a mark where the ball hits the court.
    this.powerStyle = step.shot.id === 'smash_x4' ? 'x4' : step.shot.id === 'smash_x3' && (step.outcome === 'winner' || step.reboundBack === true) ? 'x3' : null;

    // Everybody moves while the ball flies: the hitter's team takes up its new formation, and the player who
    // has to play the ball runs to the spot where it will be hit (after the bounce, or after the glass).
    const out = step.outcome;
    const targets: Record<string, CourtPos> = {};
    const endPose: Record<string, PoseName> = {};
    const endFacing: Record<string, Facing> = {};
    const defSideNow = other(step.side);
    const clampX = (x: number): number => Math.max(-4.2, Math.min(4.2, x));
    const clampZ = (z: number): number => Math.max(defSideNow === 0 ? NET_Z + 1.2 : 1, Math.min(defSideNow === 0 ? 19 : NET_Z - 1.2, z));
    /** Nobody stands still: the hitting pair follows the shot into its new formation, shifted towards the side the ball was sent to. */
    const shiftHitters = (): void => {
      const shift = Math.max(-1.2, Math.min(1.2, 0.25 * landX));
      for (const p of TEAMS[step.side]) {
        const t = targets[p.id];
        targets[p.id] = { x: clampX(t.x + shift), z: t.z };
      }
    };
    // Both players are in the game. The partner covers the court: he slides across towards the ball (so the pair closes the
    // middle), drops back or comes forward with his partner, and never stands closer than about 1.8 m to him.
    const movePartner = (): void => {
      const partner = TEAMS[defSideNow][1 - step.defenderIdx];
      const base = targets[partner.id];
      const spot = targets[defender.id];
      let px = base.x + 0.55 * (flight.hit.x - base.x);
      const gap = 1.8;
      if (Math.abs(px - spot.x) < gap) px = spot.x + (base.x >= spot.x ? gap : -gap);
      px = clampX(px);
      const pz = clampZ(base.z + 0.6 * (spot.z - base.z));
      // Never stand still: if the new spot is almost where he is, he takes a small step to the side that covers the court.
      const cur = this.pos[partner.id];
      const tiny = Math.hypot(px - cur.x, pz - cur.z) < 0.5;
      targets[partner.id] = { x: tiny ? clampX(px + (px > 0 ? -0.6 : 0.6)) : px, z: pz };
    };
    if (out === 'in' || out === 'continue' || out === 'intercept') {
      Object.assign(targets, this.rallyTargets(next));
      // The player who has to play the ball picks a stance and stands beside the ball's landing spot.
      // A ball that comes off the back glass (bajada) is played with the back to the glass and the face to the net: the player
      // stands a little behind the ball and hits it from the side (the ball at about one or two o'clock), never overhead.
      const offGlass = step.glass === true && step.kind !== 'serve';
      const stance = chooseStance(other(step.side), this.pos[defender.id].x, flight.hit.x, offGlass ? 0 : flight.hitH);
      this.stance[defender.id] = stance;
      targets[defender.id] = standingSpot(other(step.side), stance, flight.hit, offGlass ? REBOUND_BEHIND_BALL : 0);
      endPose[defender.id] = poseOf(stance, step.block ? 'Hit' : 'Prep');
      movePartner();
      shiftHitters();
    } else if (out === 'winner' || out === 'ace' || out === 'error') {
      // The point ends with this ball, but nobody freezes: the defender runs for it (all the way when it is a winner, but he cannot get
      // there in time and lunges a moment too late; a part of the way when it is an error, then he watches it go), the partner covers,
      // and the hitting pair follows its shot.
      Object.assign(targets, this.rallyTargets(next));
      const d = this.pos[defender.id];
      const stance = chooseStance(other(step.side), d.x, flight.hit.x, flight.hitH);
      const spot = standingSpot(other(step.side), stance, flight.hit);
      if (out === 'error') {
        targets[defender.id] = { x: clampX(d.x + 0.65 * (spot.x - d.x)), z: clampZ(d.z + 0.45 * (spot.z - d.z)) };
      } else {
        targets[defender.id] = spot;
        endPose[defender.id] = poseOf(stance, 'Hit');
      }
      movePartner();
      shiftHitters();
    } else {
      // A fault or a double fault: the receivers take a few steps towards the ball and stop when it is clearly out.
      const d = this.pos[defender.id];
      targets[defender.id] = { x: clampX(d.x + 0.4 * (flight.hit.x - d.x)), z: clampZ(d.z + 0.3 * (flight.hit.z - d.z)) };
    }
    const remain = duration * (1 - from);
    this.movePlayers(targets, remain, undefined, endPose, endFacing);
    for (const e of flight.events) {
      const at = flight.duration > 0 ? e.t / flight.duration : 0;
      if (at < from) continue;
      this.time.delayedCall((at - from) * duration, () => this.impactFx(e, flight.path));
    }

    this.tweens.addCounter({
      from,
      to: 1,
      duration: remain,
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const p = ballPoint(flight.path, tween.getValue() ?? 0);
        this.setBall(p.x, p.z, p.h);
      },
      onComplete: () => {
        this.powerStyle = null;
        this.trail = [];
        this.drawTrail();
        this.ballH = flight.hitH;
        // When the point is over the ball is not stopped: it falls, bounces and rolls on.
        const over = ['winner', 'ace', 'error', 'double-fault', 'fault'].includes(step.outcome);
        const coast = over ? this.playCoast(flight, step.shot.flight.spin) : { ms: 0, end: null };
        // A defender who has lost the point still runs after the ball until it has stopped.
        if (coast.end && !step.reboundBack && (step.outcome === 'winner' || step.outcome === 'ace')) this.chaseBall(defender.id, other(step.side), coast.end, coast.ms);
        this.afterStep(step, next, headline, coast.ms);
      },
    });
  }

  /** Lets the ball carry on freely after the flight: bounces, rolls, glass, outside the court. Returns its length in ms. */
  private playCoast(flight: Flight, spin: number): { ms: number; end: CourtPos | null } {
    const coast = buildCoast(flight, spin);
    if (coast.duration <= 0) return { ms: 0, end: null };
    const ms = Math.min(3400, coast.duration * TIME_SCALE * 1000);
    this.coastRunning = true;
    for (const e of coast.events) {
      this.time.delayedCall((e.t / coast.duration) * ms, () => this.impactFx(e, coast.path));
    }
    const asFlight: Flight = { ...flight, path: coast.path, duration: coast.duration };
    this.coastTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const p = ballPoint(asFlight.path, tween.getValue() ?? 0);
        this.setBall(p.x, p.z, p.h);
      },
      onComplete: () => {
        this.coastRunning = false;
      },
    });
    const last = coast.path[coast.path.length - 1];
    return { ms, end: { x: last.x, z: last.z } };
  }

  /** The player runs towards where the ball is going (kept inside his half of the court). */
  private chaseBall(id: string, side: SideIndex, ball: CourtPos, ms: number): void {
    const from = this.pos[id];
    const zMin = side === 0 ? NET_Z + 0.8 : 0.6;
    const zMax = side === 0 ? 19.4 : NET_Z - 0.8;
    const target = {
      x: Math.max(-4.7, Math.min(4.7, lerp(from.x, ball.x, 0.9))),
      z: Math.max(zMin, Math.min(zMax, lerp(from.z, ball.z, 0.9))),
    };
    this.movePlayers({ [id]: target }, Math.max(300, ms));
  }

  /** What happened to a lost ball, for the log. */
  private errorText(step: Step): string {
    if (step.errorKind === 'glass') return 'sends it into the back glass without a bounce: out';
    if (step.errorKind === 'mesh') return 'sends it into the fence above the glass: out';
    if (step.errorKind === 'side') return step.kind === 'serve' ? 'hits the glass low first: out' : 'sends it straight into the side wall: out';
    if (step.errorKind === 'long') return 'bounces beyond the line: out';
    if (step.errorKind === 'bouncemesh') return 'bounces and then lands on the fence: out';
    return 'hits the net';
  }

  /** Where a faulted serve went, for the log. */
  private faultWhere(step: Step): string {
    switch (step.errorKind) {
      case 'glass': return 'into the back glass';
      case 'mesh': return 'into the fence';
      case 'side': return 'low on the glass first';
      case 'long': return 'bounce beyond the line';
      case 'bouncemesh': return 'bounced, then on the fence';
      default: return 'net';
    }
  }

  private stopCoast(): void {
    this.coastTween?.stop();
    this.coastTween = null;
    this.coastRunning = false;
  }

  private afterStep(step: Step, next: PointState, headline: string, coastMs = 0): void {
    const attacker = TEAMS[step.side][step.attackerIdx];
    const defender = TEAMS[other(step.side)][step.defenderIdx];
    this.point = next;

    const endPoint = (text: string, delay = Math.max(POINT_PAUSE + 500, Math.min(coastMs + 350, 2200))): void => {
      const winnerLine = step.pointWinner === null ? '' : `  >  POINT TO ${SIDE_NAME[step.pointWinner]}`;
      this.say(`${headline}\n${text}${winnerLine}`);
      const banner: Partial<Record<string, [string, string]>> = {
        'double-fault': ['DOUBLE FAULT', '#ff9a6a'],
        ace: ['ACE!', '#ffe066'],
        winner: ['WINNER!', '#ffe066'],
        error: ['ERROR', '#ff9a6a'],
        intercept: ['INTERCEPTED!', '#9fd8ff'],
      };
      const b = banner[step.outcome];
      const how: Partial<Record<string, string>> = {
        ace: step.shot.name,
        winner: step.shot.name,
        error:
          step.shot.wall === 'fence'
            ? `${step.shot.name} into the fence`
            : `${step.shot.name}: ${step.errorKind === 'glass' ? 'out, back glass' : step.errorKind === 'mesh' ? 'out, fence' : step.errorKind === 'side' ? 'out, side wall' : 'net'}`,
      };
      if (b) this.announce(b[0], b[1], how[step.outcome]);
      if (step.outcome === 'ace' || step.outcome === 'winner') {
        this.cameras.main.shake(140, 0.004);
        this.winFlash();
      }
      this.time.delayedCall(delay, () => this.endPoint(step.pointWinner as SideIndex));
    };

    switch (step.outcome) {
      case 'fault':
        if (this.practice) {
          this.say(`${headline}\nFAULT! (practice: back to the menu)`);
          this.announce('FAULT', '#ff9a6a');
          this.time.delayedCall(Math.max(POINT_PAUSE, Math.min(coastMs + 350, 2200)), () => this.practiceMenu());
          break;
        }
        this.say(`${headline}\nFAULT (${this.faultWhere(step)})! Second serve.`);
        this.announce('FAULT', '#ff9a6a', this.faultWhere(step));
        this.time.delayedCall(FAULT_PAUSE, () => this.serveTurn());
        break;
      case 'double-fault':
        endPoint('DOUBLE FAULT!');
        break;
      case 'ace':
        endPoint('ACE!');
        break;
      case 'in':
        if (this.practice && !this.isHuman(next.holder, next.hitterIdx)) {
          this.say(`${headline}\nIn play. (practice: back to the menu)`);
          this.time.delayedCall(1300, () => this.practiceMenu());
          break;
        }
        this.say(headline);
        this.time.delayedCall(this.isHuman(next.holder, next.hitterIdx) ? NEXT_HIT_DELAY : CPU_NEXT_HIT_DELAY, () => this.hitTurn());
        break;
      case 'winner':
        endPoint(
          step.earlyError
            ? `${defender.name} goes for the Por Cuatro before the glass and fumbles it. Point!`
            : step.reboundBack
            ? `${attacker.name}: the ball comes off the glass and flies back over the net. Point!`
            : step.shot.overFence
            ? `${attacker.name} hits it out over the fence!`
            : `${attacker.name} wins the point with a winner!`,
        );
        break;
      case 'error':
        endPoint(
          step.shot.wall === 'fence'
            ? `${attacker.name} mishits the rulo straight into the fence. Error!`
            : `${attacker.name} ${this.errorText(step)}. Error!`,
        );
        break;
      case 'intercept':
        endPoint(`${defender.name} reads it and wins the point!`);
        break;
      case 'continue':
        if (this.practice && !this.isHuman(next.holder, next.hitterIdx)) {
          this.say(`${headline}\nIn play. (practice: back to the menu)`);
          this.time.delayedCall(1300, () => this.practiceMenu());
          break;
        }
        this.say(headline);
        this.time.delayedCall(this.isHuman(next.holder, next.hitterIdx) ? NEXT_HIT_DELAY : CPU_NEXT_HIT_DELAY, () => this.hitTurn());
        break;
    }
  }

  private endPoint(winner: SideIndex): void {
    if (this.practice) {
      this.practiceMenu();
      return;
    }
    this.guts = { ...this.point.guts };
    this.pointsWon[winner]++;
    this.longestRally = Math.max(this.longestRally, this.point.hits);
    const res = awardPoint(this.matchScore, winner);
    this.matchScore = res.score;

    for (const p of TEAMS.flat()) {
      this.guts[p.id] = recoverGuts(this.guts[p.id], gutsRecovery(p.stats.stamina) * (p.id === TEAMS[0][0].id ? 1 + this.recoveryPct : 1), p.maxGuts);
    }
    this.refreshScore();
    this.refreshGuts();
    sfx('point');
    this.clearMenu();

    if (this.matchScore.winner !== null) {
      this.endMatch(this.matchScore.winner);
      return;
    }
    if (res.gameWon) {
      this.server = other(this.server);
      this.serverIdx[this.server] = 1 - this.serverIdx[this.server];
      this.say(`${this.lastSaid}\nGAME TO ${SIDE_NAME[winner]}!`);
      this.time.delayedCall(GAME_PAUSE, () => this.beginPoint());
    } else {
      this.time.delayedCall(POINT_PAUSE, () => this.beginPoint());
    }
  }

  private endMatch(winner: SideIndex): void {
    this.clearMenu();
    this.setActive(null);
    const reward = matchReward({ won: winner === 0, pointsWon: this.pointsWon[0], pointsLost: this.pointsWon[1], longestRally: this.longestRally });
    const levelBefore = levelOf(getSave().profile.xp);
    const out: { finished?: Finished } = {};
    updateSave((d) => {
      const r = recordResult(d, winner === 0);
      let profile = award(r.profile, reward);
      if (this.career) {
        const rep = reportMatch(profile, winner === 0);
        profile = rep.profile;
        out.finished = rep.finished;
      }
      return { ...r, profile };
    });
    const levelAfter = levelOf(getSave().profile.xp);
    this.time.delayedCall(500, () => sfx(winner === 0 ? 'win' : 'lose'));
    this.say(winner === 0 ? 'YOU WIN THE MATCH!' : 'CPU WINS THE MATCH...');
    const games: [number, number] = [this.matchScore.games[0], this.matchScore.games[1]];
    this.time.delayedCall(2200, () => this.scene.start('ResultScene', { winner, games, reward, levelUp: levelAfter > levelBefore ? levelAfter : 0, packs: Math.max(0, levelAfter - levelBefore), career: this.career !== null, finished: out.finished ? { event: out.finished.event, roundsWon: out.finished.roundsWon, champion: out.finished.champion, prize: out.finished.prize } : undefined }));
  }
}
