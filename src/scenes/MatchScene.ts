import Phaser from 'phaser';
import { NET_HEIGHT_M, NET_Z, project, WALL_HEIGHT_M, type Projected } from '../art/camera';
import { SPRITE_H } from '../art/character';
import { ensureCharacterTexture } from '../art/characterTexture';
import { sfx } from '../audio';
import { FONT, HEIGHT, WIDTH } from '../config';
import movesData from '../data/moves.json';
import playersData from '../data/players.json';
import responsesData from '../data/responses.json';
import { recoverGuts, resolveExchange, spendGuts } from '../game/engine';
import { awardPoint, isGoldenPoint, newScore, pointLabels, type MatchScore } from '../game/scoring';
import type { MoveDef, PlayerDef, ResponseDef, SideIndex } from '../game/types';
import { recordResult, updateSave } from '../save';

const MOVES = movesData as unknown as MoveDef[];
const RESPONSES = responsesData as unknown as ResponseDef[];
const TEAMS: [PlayerDef[], PlayerDef[]] = [
  playersData.you as unknown as PlayerDef[],
  playersData.cpu as unknown as PlayerDef[],
];

const GUTS_RECOVERY_PER_POINT = 2;
const SIDE_NAME = ['YOU', 'CPU'] as const;

/** How tall a character looks on screen, in court metres (chibi: big head, so a bit exaggerated). */
const VISUAL_HEIGHT_M = 2.0;
/** Height of the racket contact point above the floor, in metres. */
const HIT_HEIGHT_M = 0.9;

interface PlayerView {
  sprite: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  player: PlayerDef;
}

interface ButtonSpec {
  label: string;
  warn: boolean;
  onPick: () => void;
}

interface CourtPos {
  x: number;
  z: number;
}

export class MatchScene extends Phaser.Scene {
  private matchScore: MatchScore = newScore(2);
  private server: SideIndex = 0;
  private holder: SideIndex = 0;
  private hitIdx: [number, number] = [0, 0];
  private guts: Record<string, number> = {};
  private busy = false;
  private menu: Phaser.GameObjects.GameObject[] = [];
  private views: Record<string, PlayerView> = {};
  private ball!: Phaser.GameObjects.Arc;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private scoreText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;

  constructor() {
    super('MatchScene');
  }

  create(): void {
    this.matchScore = newScore(2);
    this.server = 0;
    this.holder = 0;
    this.hitIdx = [0, 0];
    this.busy = false;
    this.menu = [];
    this.views = {};
    this.guts = {};
    for (const p of TEAMS.flat()) this.guts[p.id] = p.maxGuts;

    this.drawArena();
    this.createViews();

    this.ballShadow = this.add.ellipse(0, 0, 8, 3, 0x000000, 0.4).setDepth(2);
    this.ball = this.add.circle(0, 0, 4, 0xfff27a).setStrokeStyle(1, 0x222222).setDepth(5000);

    this.add.rectangle(WIDTH / 2, 27, 190, 42, 0x000000, 0.6).setDepth(9990);
    this.scoreText = this.add
      .text(WIDTH / 2, 9, '', { fontFamily: FONT, fontSize: '15px', color: '#ffe066', align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(10000);
    this.logText = this.add
      .text(WIDTH / 2, 396, '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 330 },
      })
      .setOrigin(0.5, 0)
      .setDepth(10000);

    this.refreshScore();
    this.refreshGuts();
    this.startPoint();
  }

  // ---------- arena (fake-3D court, glass walls, net, stands) ----------

  private fillQuad(g: Phaser.GameObjects.Graphics, a: Projected, b: Projected, c: Projected, d: Projected): void {
    g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
    g.fillTriangle(a.x, a.y, c.x, c.y, d.x, d.y);
  }

  private line(g: Phaser.GameObjects.Graphics, a: Projected, b: Projected): void {
    g.lineBetween(a.x, a.y, b.x, b.y);
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

    // Back glass (far end) with an advertising board along its foot
    const back = this.add.graphics().setDepth(-3);
    back.fillStyle(0x9fd8ff, 0.16);
    this.fillQuad(back, P(-5, 0, 0), P(5, 0, 0), P(5, 0, WALL_HEIGHT_M), P(-5, 0, WALL_HEIGHT_M));
    back.fillStyle(0x1b3d8f, 1);
    this.fillQuad(back, P(-5, 0, 0), P(5, 0, 0), P(5, 0, 0.9), P(-5, 0, 0.9));
    back.lineStyle(2, 0xdff3ff, 0.7);
    this.line(back, P(-5, 0, WALL_HEIGHT_M), P(5, 0, WALL_HEIGHT_M));
    for (const x of [-5, -2.5, 0, 2.5, 5]) this.line(back, P(x, 0, 0), P(x, 0, WALL_HEIGHT_M));
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

    // Side glass walls (the near parts rise tall at the screen edges, like on TV)
    const side = this.add.graphics().setDepth(-2);
    for (const x of [-5, 5]) {
      side.fillStyle(0x9fd8ff, 0.14);
      this.fillQuad(side, P(x, 0, 0), P(x, 20, 0), P(x, 20, WALL_HEIGHT_M), P(x, 0, WALL_HEIGHT_M));
      side.lineStyle(2, 0xdff3ff, 0.65);
      this.line(side, P(x, 0, WALL_HEIGHT_M), P(x, 20, WALL_HEIGHT_M));
      for (const z of [0, 5, 10, 15, 20]) this.line(side, P(x, z, 0), P(x, z, WALL_HEIGHT_M));
    }

    // Net: depth-sorted with the players, so far players stand behind it and near players in front
    const net = this.add.graphics().setDepth(P(0, NET_Z).y);
    net.fillStyle(0x000000, 0.4);
    this.fillQuad(net, P(-5, NET_Z, NET_HEIGHT_M), P(5, NET_Z, NET_HEIGHT_M), P(5, NET_Z, 0), P(-5, NET_Z, 0));
    net.lineStyle(2, 0x9a9ab0, 1);
    for (const x of [-5.05, 5.05]) this.line(net, P(x, NET_Z, 0), P(x, NET_Z, NET_HEIGHT_M + 0.05));
    net.lineStyle(3, 0xfcfcfc, 1);
    this.line(net, P(-5, NET_Z, NET_HEIGHT_M), P(5, NET_Z, NET_HEIGHT_M));
  }

  // ---------- players ----------

  /** Where a player stands, in court metres. Fixed formation for now (to be redesigned). */
  private courtPos(side: SideIndex, idx: number): CourtPos {
    return { x: idx === 0 ? -2.5 : 2.5, z: side === 0 ? 15.5 : 4.5 };
  }

  private createViews(): void {
    ([0, 1] as SideIndex[]).forEach((side) => {
      TEAMS[side].forEach((player, idx) => {
        const pos = this.courtPos(side, idx);
        const p = project(pos.x, pos.z);
        const key = ensureCharacterTexture(this, player.appearance, side === 0 ? 'back' : 'front');
        const scale = (p.scale * VISUAL_HEIGHT_M) / SPRITE_H;
        const spriteHeight = SPRITE_H * scale;

        this.add.ellipse(p.x, p.y, p.scale * 1.1, p.scale * 0.4, 0x000000, 0.35).setDepth(1);
        const ring = this.add
          .ellipse(p.x, p.y, p.scale * 1.5, p.scale * 0.6)
          .setStrokeStyle(2, 0xffe066)
          .setDepth(2)
          .setVisible(false);
        const sprite = this.add.image(p.x, p.y, key).setOrigin(0.5, 1).setScale(scale).setDepth(p.y);
        const label = this.add
          .text(p.x, side === 0 ? p.y + 6 : p.y - spriteHeight - 2, '', {
            fontFamily: FONT,
            fontSize: '10px',
            color: '#ffffff',
            align: 'center',
          })
          .setOrigin(0.5, side === 0 ? 0 : 1)
          .setStroke('#000000', 3)
          .setDepth(9000);
        this.views[player.id] = { sprite, ring, label, player };
      });
    });
  }

  private highlight(activeId: string): void {
    for (const [id, v] of Object.entries(this.views)) v.ring.setVisible(id === activeId);
  }

  private hop(playerId: string): void {
    const v = this.views[playerId];
    this.tweens.add({ targets: v.sprite, y: v.sprite.y - 8, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
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

  private placeBall(x: number, z: number, h: number): void {
    const p = project(x, z, h);
    const f = project(x, z, 0);
    this.ball.setPosition(p.x, p.y).setRadius(Math.max(3, p.scale * 0.17));
    this.ballShadow.setPosition(f.x, f.y);
  }

  // ---------- menu ----------

  private clearMenu(): void {
    for (const o of this.menu) o.destroy();
    this.menu = [];
  }

  private showButtons(title: string, items: ButtonSpec[]): void {
    this.clearMenu();
    this.menu.push(
      this.add.text(180, 438, title, { fontFamily: FONT, fontSize: '14px', color: '#9fd8ff' }).setOrigin(0.5),
    );
    items.forEach((item, i) => {
      const x = 95 + (i % 2) * 170;
      const y = 485 + Math.floor(i / 2) * 58;
      const bg = this.add
        .rectangle(x, y, 160, 48, 0x2b2b5e)
        .setStrokeStyle(2, item.warn ? 0xff6666 : 0xffffff)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(x, y, item.label, {
          fontFamily: FONT,
          fontSize: '14px',
          color: item.warn ? '#ff9999' : '#ffffff',
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

  // ---------- flow ----------

  private hitter(side: SideIndex): PlayerDef {
    return TEAMS[side][this.hitIdx[side]];
  }

  private startPoint(): void {
    this.holder = this.server;
    this.hitIdx = [0, 0];
    const server = this.hitter(this.server);
    const pos = this.courtPos(this.server, 0);
    this.placeBall(pos.x, pos.z, HIT_HEIGHT_M);
    this.say(`${server.name} (${SIDE_NAME[this.server]}) serves.`);
    this.nextTurn();
  }

  private nextTurn(): void {
    const side = this.holder;
    const hitter = this.hitter(side);
    this.highlight(hitter.id);

    if (side === 0) {
      this.showButtons(
        `${hitter.name}: choose a shot`,
        MOVES.map((m) => {
          const tired = this.guts[hitter.id] < m.cost;
          return {
            label: `${m.name} [${m.cost}]${tired ? '\n(tired)' : ''}`,
            warn: tired,
            onPick: () => this.onMovePicked(hitter, m),
          };
        }),
      );
    } else {
      const move = this.cpuPickMove(hitter);
      this.say(`${hitter.name} plays ${move.name}!`);
      const defender = this.hitter(0);
      this.showButtons(
        `${defender.name}: how do you answer?`,
        RESPONSES.map((r) => {
          const tired = this.guts[defender.id] < r.cost;
          return {
            label: `${r.name} [${r.cost}]${tired ? '\n(tired)' : ''}`,
            warn: tired,
            onPick: () => this.resolve(1, hitter, move, defender, r),
          };
        }),
      );
    }
  }

  private onMovePicked(hitter: PlayerDef, move: MoveDef): void {
    const defender = this.hitter(1);
    const response = this.cpuPickResponse(defender, move);
    this.resolve(0, hitter, move, defender, response);
  }

  private resolve(atkSide: SideIndex, attacker: PlayerDef, move: MoveDef, defender: PlayerDef, response: ResponseDef): void {
    const defSide: SideIndex = atkSide === 0 ? 1 : 0;
    const result = resolveExchange(attacker, this.guts[attacker.id], move, defender, response, Math.random);

    this.guts[attacker.id] = spendGuts(this.guts[attacker.id], move.cost);
    this.guts[defender.id] = spendGuts(this.guts[defender.id], response.cost);
    this.refreshGuts();

    let msg = `${attacker.name}: ${move.name}!\n${defender.name}: ${response.name}.`;
    if (result.tired) msg += ' (tired!)';
    if (result.countered) msg += ' Read it!';
    this.say(msg);

    sfx('hit');
    this.hop(attacker.id);
    const from = this.courtPos(atkSide, this.hitIdx[atkSide]);
    const to = this.courtPos(defSide, this.hitIdx[defSide]);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520,
      ease: 'Sine.easeInOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const t = tween.getValue() ?? 0;
        const h = HIT_HEIGHT_M + 1.8 * Math.sin(Math.PI * t);
        this.placeBall(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, h);
      },
      onComplete: () => {
        if (result.outcome === 'winner') {
          this.say(`${msg}\n${attacker.name}'s ${move.name} is a WINNER!`);
          this.time.delayedCall(1300, () => this.pointTo(atkSide));
        } else if (result.outcome === 'intercept') {
          this.say(`${msg}\n${defender.name} intercepts!`);
          this.time.delayedCall(1300, () => this.pointTo(defSide));
        } else {
          this.say(`${msg}\nThe rally goes on...`);
          this.hitIdx[atkSide] = this.hitIdx[atkSide] === 0 ? 1 : 0;
          this.holder = defSide;
          this.time.delayedCall(900, () => this.nextTurn());
        }
      },
    });
  }

  private pointTo(side: SideIndex): void {
    const res = awardPoint(this.matchScore, side);
    this.matchScore = res.score;

    for (const p of TEAMS.flat()) {
      this.guts[p.id] = recoverGuts(this.guts[p.id], GUTS_RECOVERY_PER_POINT, p.maxGuts);
    }
    this.refreshScore();
    this.refreshGuts();
    sfx('point');

    if (this.matchScore.winner !== null) {
      this.endMatch(this.matchScore.winner);
      return;
    }
    if (res.gameWon) {
      this.server = this.server === 0 ? 1 : 0;
      this.say(`Game to ${SIDE_NAME[side]}!`);
      this.time.delayedCall(1300, () => this.startPoint());
    } else {
      this.say(`Point to ${SIDE_NAME[side]}.`);
      this.time.delayedCall(900, () => this.startPoint());
    }
  }

  private endMatch(winner: SideIndex): void {
    this.clearMenu();
    updateSave((d) => recordResult(d, winner === 0));
    this.time.delayedCall(500, () => sfx(winner === 0 ? 'win' : 'lose'));
    this.say(winner === 0 ? 'YOU WIN THE MATCH!' : 'CPU WINS THE MATCH...');
    const games: [number, number] = [this.matchScore.games[0], this.matchScore.games[1]];
    this.time.delayedCall(2200, () => this.scene.start('ResultScene', { winner, games }));
  }

  // ---------- CPU ----------

  private cpuPickMove(hitter: PlayerDef): MoveDef {
    const affordable = MOVES.filter((m) => m.cost <= this.guts[hitter.id]);
    const pool = affordable.length > 0 ? affordable : MOVES.filter((m) => m.cost === 0);
    const weights = pool.map((m) => hitter.stats[m.stat] * m.power);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  private cpuPickResponse(defender: PlayerDef, move: MoveDef): ResponseDef {
    const affordable = RESPONSES.filter((r) => r.cost <= this.guts[defender.id]);
    const pool = affordable.length > 0 ? affordable : RESPONSES.filter((r) => r.cost === 0);
    const counters = pool.filter((r) => move.counteredBy.includes(r.id));
    const list = counters.length > 0 && Math.random() < 0.4 ? counters : pool;
    return list[Math.floor(Math.random() * list.length)];
  }
}
