import Phaser from 'phaser';
import { ballPoint, buildFlight, flightDuration, HIT_HEIGHT_M } from '../art/ballPath';
import { NET_HEIGHT_M, project, type Projected } from '../art/camera';
import { SPRITE_H } from '../art/character';
import { ensureCharacterTexture } from '../art/characterTexture';
import { BACK_WALL, sideWallSegments } from '../art/walls';
import { sfx } from '../audio';
import { FONT, HEIGHT, WIDTH } from '../config';
import playersData from '../data/players.json';
import { pickHit, pickServe } from '../game/ai';
import { DIRECTIONS, shotsOfKind } from '../game/catalog';
import { laneSign, landingX, NET_Z, restPos, serveSetup } from '../game/court';
import { recoverGuts } from '../game/engine';
import { startPoint, stepHit, stepServe, type PointState, type Step, type Teams } from '../game/point';
import { awardPoint, isGoldenPoint, newScore, pointLabels, type MatchScore } from '../game/scoring';
import type { CourtPos, Direction, PlayerDef, ShotDef, SideIndex } from '../game/types';
import { recordResult, updateSave } from '../save';

const TEAMS: Teams = [playersData.you as unknown as PlayerDef[], playersData.cpu as unknown as PlayerDef[]];

const GUTS_RECOVERY_PER_POINT = 2;
const SIDE_NAME = ['YOU', 'CPU'] as const;
const DIRECTION_ORDER: Direction[] = ['parallel', 'middle', 'cross'];

/** How tall a character looks on screen, in court metres (chibi: big head, so a bit exaggerated). */
const VISUAL_HEIGHT_M = 2.0;

type Tone = 'normal' | 'good' | 'poor' | 'tired';

const TONE_STROKE: Record<Tone, number> = { normal: 0xffffff, good: 0x6dff8b, poor: 0xffa94d, tired: 0xff6666 };
const TONE_TEXT: Record<Tone, string> = { normal: '#ffffff', good: '#b5ffc5', poor: '#ffd29a', tired: '#ff9999' };

interface PlayerView {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  player: PlayerDef;
  side: SideIndex;
  /** Jump height in pixels (animated by the hit "hop"). */
  lift: number;
}

interface ButtonSpec {
  label: string;
  tone: Tone;
  onPick: () => void;
}

const other = (s: SideIndex): SideIndex => (s === 0 ? 1 : 0);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class MatchScene extends Phaser.Scene {
  private matchScore: MatchScore = newScore(2);
  private server: SideIndex = 0;
  /** Which player of each team serves in their next service game. */
  private serverIdx: [number, number] = [0, 0];
  private point!: PointState;
  private guts: Record<string, number> = {};
  private busy = false;
  private menu: Phaser.GameObjects.GameObject[] = [];
  private views: Record<string, PlayerView> = {};
  private pos: Record<string, CourtPos> = {};
  private activeId: string | null = null;
  private ballFloor: CourtPos = { x: 0, z: NET_Z };
  private overlay!: Phaser.GameObjects.Graphics;
  private ball!: Phaser.GameObjects.Arc;
  private scoreText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;

  constructor() {
    super('MatchScene');
  }

  create(): void {
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

    this.drawArena();
    this.overlay = this.add.graphics().setDepth(1);
    this.createViews();
    this.ball = this.add.circle(0, 0, 4, 0xfff27a).setStrokeStyle(1, 0x222222).setDepth(5000);

    this.add.rectangle(WIDTH / 2, 27, 190, 42, 0x000000, 0.6).setDepth(9990);
    this.scoreText = this.add
      .text(WIDTH / 2, 9, '', { fontFamily: FONT, fontSize: '15px', color: '#ffe066', align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(10000);
    this.logText = this.add
      .text(WIDTH / 2, 391, '', {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 340 },
      })
      .setOrigin(0.5, 0)
      .setDepth(10000);

    this.refreshScore();
    this.refreshGuts();
    this.beginPoint();
  }

  // ---------- arena: court, glass, mesh, net, stands ----------

  private fillQuad(g: Phaser.GameObjects.Graphics, a: Projected, b: Projected, c: Projected, d: Projected): void {
    g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
    g.fillTriangle(a.x, a.y, c.x, c.y, d.x, d.y);
  }

  private line(g: Phaser.GameObjects.Graphics, a: Projected, b: Projected): void {
    g.lineBetween(a.x, a.y, b.x, b.y);
  }

  /**
   * One piece of wall. `at(u, h)` maps a position along the wall and a height to the screen.
   * Glass: translucent blue with panel joints every `step` metres. Mesh: dark, with a visible wire grid and posts.
   */
  private wallBand(
    g: Phaser.GameObjects.Graphics,
    at: (u: number, h: number) => Projected,
    u0: number,
    u1: number,
    h0: number,
    h1: number,
    kind: 'glass' | 'mesh',
    step: number,
  ): void {
    const a = at(u0, h0);
    const b = at(u1, h0);
    const c = at(u1, h1);
    const d = at(u0, h1);

    if (kind === 'glass') {
      g.fillStyle(0x9fd8ff, 0.17);
      this.fillQuad(g, a, b, c, d);
      g.lineStyle(2, 0xdff3ff, 0.7);
      for (let u = u0; u <= u1 + 1e-6; u += step) this.line(g, at(u, h0), at(u, h1));
      this.line(g, d, c);
      return;
    }

    g.fillStyle(0x06081a, 0.3);
    this.fillQuad(g, a, b, c, d);
    g.lineStyle(1, 0xc9d3e6, 0.45);
    for (let u = u0; u <= u1 + 1e-6; u += step) this.line(g, at(u, h0), at(u, h1));
    for (let h = h0; h <= h1 + 1e-6; h += step) this.line(g, at(u0, h), at(u1, h));
    g.lineStyle(2, 0x9aa5bd, 0.9);
    this.line(g, a, d);
    this.line(g, b, c);
    this.line(g, d, c);
  }

  private drawArena(): void {
    const P = project;

    // Stands: dark background with a crowd of coloured dots (deterministic, same every match)
    const bg = this.add.graphics().setDepth(-10);
    bg.fillStyle(0x0b0b1a, 1);
    bg.fillRect(0, 0, WIDTH, HEIGHT);
    const crowd = [0x3a3a6a, 0x5a2a4a, 0x2a4a5a, 0x6a5a2a, 0x4a2a2a, 0x2a2a4a];
    let seed = 12345;
    const rnd = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 260; i++) {
      bg.fillStyle(crowd[Math.floor(rnd() * crowd.length)], 1);
      bg.fillRect(Math.floor(rnd() * WIDTH), 20 + Math.floor(rnd() * 88), 3, 4);
    }

    // Floor in alternating depth bands
    const floor = this.add.graphics().setDepth(-5);
    for (let i = 0; i < 10; i++) {
      floor.fillStyle(i % 2 === 0 ? 0x2f6ed6 : 0x2a62c4, 1);
      this.fillQuad(floor, P(-5, i * 2), P(5, i * 2), P(5, i * 2 + 2), P(-5, i * 2 + 2));
    }

    // Court lines
    const lines = this.add.graphics().setDepth(-4);
    lines.lineStyle(2, 0xfcfcfc, 0.95);
    this.line(lines, P(-5, 0), P(5, 0));
    this.line(lines, P(-5, 20), P(5, 20));
    this.line(lines, P(-5, 0), P(-5, 20));
    this.line(lines, P(5, 0), P(5, 20));
    this.line(lines, P(-5, 3.05), P(5, 3.05));
    this.line(lines, P(-5, 16.95), P(5, 16.95));
    this.line(lines, P(0, 3.05), P(0, 16.95));

    // Walls: back wall (3 m glass + 1 m mesh) and the stepped side walls (see art/walls.ts)
    const walls = this.add.graphics().setDepth(-3);
    const backAt = (x: number, h: number): Projected => P(x, 0, h);
    this.wallBand(walls, backAt, -5, 5, 0, BACK_WALL.glass, 'glass', 2);
    walls.fillStyle(0x1b3d8f, 1);
    this.fillQuad(walls, P(-5, 0, 0), P(5, 0, 0), P(5, 0, 0.9), P(-5, 0, 0.9));
    this.wallBand(walls, backAt, -5, 5, BACK_WALL.glass, BACK_WALL.glass + BACK_WALL.mesh, 'mesh', 0.5);
    for (const x of [-5, 5]) {
      const sideAt = (z: number, h: number): Projected => P(x, z, h);
      for (const seg of sideWallSegments()) {
        if (seg.glass > 0) this.wallBand(walls, sideAt, seg.z0, seg.z1, 0, seg.glass, 'glass', 2);
        if (seg.mesh > 0) this.wallBand(walls, sideAt, seg.z0, seg.z1, seg.glass, seg.glass + seg.mesh, 'mesh', 0.5);
      }
    }
    const board = P(0, 0, 0.45);
    this.add
      .text(board.x, board.y, 'PADEL CHAMP 26', {
        fontFamily: FONT,
        fontSize: `${Math.max(7, Math.round(board.scale * 0.55))}px`,
        fontStyle: 'bold',
        color: '#ffe066',
      })
      .setOrigin(0.5)
      .setDepth(-2.9);

    // Net: depth-sorted with the players, so far players stand behind it and near players in front
    const net = this.add.graphics().setDepth(P(0, NET_Z).y);
    net.fillStyle(0x000000, 0.4);
    this.fillQuad(net, P(-5, NET_Z, NET_HEIGHT_M), P(5, NET_Z, NET_HEIGHT_M), P(5, NET_Z, 0), P(-5, NET_Z, 0));
    net.lineStyle(1, 0xc9d3e6, 0.3);
    for (let x = -5; x <= 5.001; x += 0.5) this.line(net, P(x, NET_Z, 0), P(x, NET_Z, NET_HEIGHT_M));
    net.lineStyle(2, 0x9a9ab0, 1);
    for (const x of [-5.05, 5.05]) this.line(net, P(x, NET_Z, 0), P(x, NET_Z, NET_HEIGHT_M + 0.05));
    net.lineStyle(3, 0xfcfcfc, 1);
    this.line(net, P(-5, NET_Z, NET_HEIGHT_M), P(5, NET_Z, NET_HEIGHT_M));
  }

  // ---------- players and ball ----------

  private createViews(): void {
    ([0, 1] as SideIndex[]).forEach((side) => {
      TEAMS[side].forEach((player, idx) => {
        this.pos[player.id] = restPos(side, idx, 'back');
        const key = ensureCharacterTexture(this, player.appearance, side === 0 ? 'back' : 'front');
        const sprite = this.add.image(0, 0, key).setOrigin(0.5, 1);
        const label = this.add
          .text(0, 0, '', { fontFamily: FONT, fontSize: '10px', color: '#ffffff', align: 'center' })
          .setOrigin(0.5, side === 0 ? 0 : 1)
          .setStroke('#000000', 3)
          .setDepth(9000);
        this.views[player.id] = { sprite, label, player, side, lift: 0 };
        this.placeView(player.id);
      });
    });
    this.redrawOverlay();
  }

  private placeView(id: string): void {
    const v = this.views[id];
    const pos = this.pos[id];
    const p = project(pos.x, pos.z);
    const scale = (p.scale * VISUAL_HEIGHT_M) / SPRITE_H;
    const spriteHeight = SPRITE_H * scale;
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

  private setBall(x: number, z: number, h: number): void {
    const p = project(x, z, h);
    this.ballFloor = { x, z };
    this.ball.setPosition(p.x, p.y).setRadius(Math.max(3, p.scale * 0.17));
    this.redrawOverlay();
  }

  private hop(id: string): void {
    const v = this.views[id];
    this.tweens.add({
      targets: v,
      lift: 8,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
      onUpdate: () => this.placeView(id),
    });
  }

  /** Walks players to the given court positions. */
  private movePlayers(targets: Record<string, CourtPos>, duration: number, onDone?: () => void): void {
    const ids = Object.keys(targets);
    const starts: Record<string, CourtPos> = {};
    for (const id of ids) starts[id] = { ...this.pos[id] };
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const t = tween.getValue() ?? 0;
        for (const id of ids) {
          this.pos[id] = { x: lerp(starts[id].x, targets[id].x, t), z: lerp(starts[id].z, targets[id].z, t) };
          this.placeView(id);
        }
        this.redrawOverlay();
      },
      onComplete: () => {
        for (const id of ids) {
          this.pos[id] = { ...targets[id] };
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
      v.label.setText(`${v.player.name}\nG ${this.guts[v.player.id]}/${v.player.maxGuts}`);
    }
  }

  private refreshScore(): void {
    const s = this.matchScore;
    const [a, b] = pointLabels(s);
    const golden = isGoldenPoint(s) ? '  GOLDEN POINT' : '';
    this.scoreText.setText(`YOU ${s.games[0]} - ${s.games[1]} CPU\n${a} - ${b}${golden}`);
  }

  private say(msg: string): void {
    this.logText.setText(msg);
  }

  // ---------- menu ----------

  private clearMenu(): void {
    for (const o of this.menu) o.destroy();
    this.menu = [];
  }

  private showButtons(title: string, items: ButtonSpec[]): void {
    this.clearMenu();
    this.menu.push(
      this.add.text(WIDTH / 2, 440, title, { fontFamily: FONT, fontSize: '13px', color: '#9fd8ff' }).setOrigin(0.5),
    );
    items.forEach((item, i) => {
      const x = 95 + (i % 2) * 170;
      const y = 485 + Math.floor(i / 2) * 58;
      const bg = this.add
        .rectangle(x, y, 160, 48, 0x2b2b5e)
        .setStrokeStyle(2, TONE_STROKE[item.tone])
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(x, y, item.label, {
          fontFamily: FONT,
          fontSize: '14px',
          color: TONE_TEXT[item.tone],
          align: 'center',
        })
        .setOrigin(0.5);
      bg.on('pointerdown', () => {
        if (this.busy) return;
        this.busy = true;
        sfx('select');
        this.clearMenu();
        item.onPick();
      });
      this.menu.push(bg, text);
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

  // ---------- flow: serve -> return -> rally ----------

  private beginPoint(): void {
    const pointsPlayed = this.matchScore.points[0] + this.matchScore.points[1];
    const idx = this.serverIdx[this.server];
    this.point = startPoint(this.guts, this.server, idx, pointsPlayed);

    // Serve set-up: the server stands in their serving lane, the partner in the middle of their half.
    const setup = serveSetup(this.server, pointsPlayed);
    const recvSide = other(this.server);
    const targets: Record<string, CourtPos> = {
      [TEAMS[this.server][idx].id]: setup.server,
      [TEAMS[this.server][1 - idx].id]: setup.partner,
      [TEAMS[recvSide][setup.receiverIdx].id]: setup.receiver,
      [TEAMS[recvSide][1 - setup.receiverIdx].id]: setup.receiverPartner,
    };
    const server = TEAMS[this.server][idx];
    this.setActive(null);
    this.say(`${server.name} (${SIDE_NAME[this.server]}) is going to serve.`);
    this.movePlayers(targets, 550, () => {
      this.setBall(setup.server.x, setup.server.z, HIT_HEIGHT_M);
      this.serveTurn();
    });
  }

  private serveTurn(): void {
    const st = this.point;
    const server = TEAMS[st.servingSide][st.serverIdx];
    this.setActive(server.id);
    const tag = st.attempt === 2 ? ' (2nd serve)' : '';

    if (st.servingSide === 0) {
      this.showButtons(
        `${server.name}: serve${tag}`,
        shotsOfKind('serve').map((s) => ({
          label: `${s.name}\n[${s.cost}]${this.guts[server.id] < s.cost ? ' tired' : ''}`,
          tone: this.toneFor(s, server),
          onPick: () => this.performServe(s),
        })),
      );
    } else {
      this.say(`${server.name} serves${tag}.`);
      const shot = pickServe(TEAMS, st, Math.random);
      this.time.delayedCall(700, () => this.performServe(shot));
    }
  }

  private hitTurn(): void {
    const st = this.point;
    const side = st.holder;
    const hitter = TEAMS[side][st.hitterIdx];
    this.setActive(hitter.id);

    if (side === 0) {
      this.showShotMenu();
    } else {
      this.say(`${hitter.name} is ready to hit.`);
      const { shot, direction } = pickHit(TEAMS, st, Math.random);
      this.time.delayedCall(700, () => this.performHit(shot, direction));
    }
  }

  private showShotMenu(): void {
    const st = this.point;
    const hitter = TEAMS[0][st.hitterIdx];
    const kind = st.hits === 0 ? 'return' : 'rally';
    this.showButtons(
      `${hitter.name}: ${kind === 'return' ? 'return' : 'your shot'} (ball ${st.ball.height.toUpperCase()})`,
      shotsOfKind(kind).map((s) => ({
        label: `${s.name}\n[${s.cost}]${this.guts[hitter.id] < s.cost ? ' tired' : ''}`,
        tone: this.toneFor(s, hitter),
        onPick: () => (s.fixedDirection ? this.performHit(s, s.fixedDirection) : this.showDirectionMenu(s)),
      })),
    );
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

  private performServe(shot: ShotDef): void {
    const { state, step } = stepServe(TEAMS, this.point, shot, Math.random);
    this.playStep(step, state);
  }

  private performHit(shot: ShotDef, direction: Direction): void {
    const { state, step } = stepHit(TEAMS, this.point, shot, direction, Math.random);
    this.playStep(step, state);
  }

  /** Animates one step (ball flight, hop, movement), then decides what happens next. */
  private playStep(step: Step, next: PointState): void {
    const attacker = TEAMS[step.side][step.attackerIdx];
    const defender = TEAMS[other(step.side)][step.defenderIdx];
    this.guts = { ...next.guts };
    this.refreshGuts();

    const landX =
      step.kind === 'serve'
        ? laneSign(step.defenderIdx) * (step.shot.landX ?? 3)
        : landingX(step.direction, step.defenderIdx);
    const flight = buildFlight({
      from: { ...this.pos[attacker.id] },
      hitterSide: step.side,
      shot: step.shot,
      landX,
      target: { ...this.pos[defender.id] },
      outcome: step.outcome,
    });
    const duration = flightDuration(flight);

    const way = step.kind === 'serve' ? '' : ` ${DIRECTIONS[step.direction].name.toLowerCase()}`;
    const headline = `${attacker.name}: ${step.shot.name}${way}!${step.tired ? ' (tired)' : ''}`;
    this.say(headline);
    sfx('hit');
    this.hop(attacker.id);

    // After a good serve or a returned ball everybody takes up the new formation.
    if (step.outcome === 'in' || step.outcome === 'continue') {
      this.movePlayers(this.rallyTargets(next), duration);
    }

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const p = ballPoint(flight, tween.getValue() ?? 0);
        this.setBall(p.x, p.z, p.h);
      },
      onComplete: () => this.afterStep(step, next, headline),
    });
  }

  private afterStep(step: Step, next: PointState, headline: string): void {
    const attacker = TEAMS[step.side][step.attackerIdx];
    const defender = TEAMS[other(step.side)][step.defenderIdx];
    this.point = next;

    const endPoint = (text: string, delay = 1300): void => {
      this.say(`${headline}\n${text}`);
      this.time.delayedCall(delay, () => this.endPoint(step.pointWinner as SideIndex));
    };

    switch (step.outcome) {
      case 'fault':
        this.say(`${headline}\nFAULT! Second serve.`);
        this.time.delayedCall(1000, () => this.serveTurn());
        break;
      case 'double-fault':
        endPoint('DOUBLE FAULT!');
        break;
      case 'ace':
        endPoint('ACE!');
        break;
      case 'in':
        this.say(`${headline}\n${defender.name} has to return it.`);
        this.time.delayedCall(800, () => this.hitTurn());
        break;
      case 'winner':
        endPoint(`${attacker.name} wins the point with a winner!`);
        break;
      case 'error':
        endPoint(`${attacker.name} hits the net. Error!`);
        break;
      case 'intercept':
        endPoint(`${defender.name} reads it and wins the point!`);
        break;
      case 'continue':
        this.say(`${headline}\nThe rally goes on...`);
        this.time.delayedCall(800, () => this.hitTurn());
        break;
    }
  }

  private endPoint(winner: SideIndex): void {
    this.guts = { ...this.point.guts };
    const res = awardPoint(this.matchScore, winner);
    this.matchScore = res.score;

    for (const p of TEAMS.flat()) {
      this.guts[p.id] = recoverGuts(this.guts[p.id], GUTS_RECOVERY_PER_POINT, p.maxGuts);
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
      this.say(`Game to ${SIDE_NAME[winner]}!`);
      this.time.delayedCall(1300, () => this.beginPoint());
    } else {
      this.say(`Point to ${SIDE_NAME[winner]}.`);
      this.time.delayedCall(900, () => this.beginPoint());
    }
  }

  private endMatch(winner: SideIndex): void {
    this.clearMenu();
    this.setActive(null);
    updateSave((d) => recordResult(d, winner === 0));
    this.time.delayedCall(500, () => sfx(winner === 0 ? 'win' : 'lose'));
    this.say(winner === 0 ? 'YOU WIN THE MATCH!' : 'CPU WINS THE MATCH...');
    const games: [number, number] = [this.matchScore.games[0], this.matchScore.games[1]];
    this.time.delayedCall(2200, () => this.scene.start('ResultScene', { winner, games }));
  }
}
