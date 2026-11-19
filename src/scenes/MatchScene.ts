import Phaser from 'phaser';
import movesData from '../data/moves.json';
import playersData from '../data/players.json';
import responsesData from '../data/responses.json';
import { recoverGuts, resolveExchange, spendGuts } from '../game/engine';
import { awardPoint, isGoldenPoint, newScore, pointLabels, type MatchScore } from '../game/scoring';
import type { MoveDef, PlayerDef, ResponseDef, SideIndex } from '../game/types';

const MOVES = movesData as unknown as MoveDef[];
const RESPONSES = responsesData as unknown as ResponseDef[];
const TEAMS: [PlayerDef[], PlayerDef[]] = [
  playersData.you as unknown as PlayerDef[],
  playersData.cpu as unknown as PlayerDef[],
];

const GUTS_RECOVERY_PER_POINT = 2;
const SIDE_NAME = ['YOU', 'CPU'] as const;
const FONT = '"Courier New", monospace';

interface PlayerSprite {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  player: PlayerDef;
}

interface ButtonSpec {
  label: string;
  warn: boolean;
  onPick: () => void;
}

export class MatchScene extends Phaser.Scene {
  private matchScore: MatchScore = newScore(2);
  private server: SideIndex = 0;
  private holder: SideIndex = 0;
  private hitIdx: [number, number] = [0, 0];
  private guts: Record<string, number> = {};
  private busy = false;
  private menu: Phaser.GameObjects.GameObject[] = [];
  private sprites: Record<string, PlayerSprite> = {};
  private ball!: Phaser.GameObjects.Arc;
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
    this.sprites = {};
    this.guts = {};
    for (const p of TEAMS.flat()) this.guts[p.id] = p.maxGuts;

    this.drawCourt();
    this.drawPlayers();

    this.scoreText = this.add
      .text(180, 12, '', { fontFamily: FONT, fontSize: '16px', color: '#ffe066', align: 'center' })
      .setOrigin(0.5, 0);
    this.logText = this.add
      .text(180, 396, '', { fontFamily: FONT, fontSize: '12px', color: '#ffffff', align: 'center', wordWrap: { width: 330 } })
      .setOrigin(0.5, 0);
    this.ball = this.add.circle(180, 340, 6, 0xfff27a).setStrokeStyle(2, 0x222222).setDepth(10);

    this.refreshScore();
    this.refreshGuts();
    this.startPoint();
  }

  // ---------- drawing ----------

  private drawCourt(): void {
    const g = this.add.graphics();
    g.fillStyle(0x1e5fa8, 1);
    g.fillRect(30, 90, 300, 300);
    g.lineStyle(4, 0x9fd8ff, 1);
    g.strokeRect(30, 90, 300, 300);
    g.lineStyle(2, 0xffffff, 1);
    g.lineBetween(30, 170, 330, 170);
    g.lineBetween(30, 310, 330, 310);
    g.lineBetween(180, 170, 180, 310);
    g.lineStyle(4, 0xffffff, 1);
    g.lineBetween(30, 240, 330, 240);
  }

  private positionOf(side: SideIndex, idx: number): { x: number; y: number } {
    return { x: 110 + idx * 140, y: side === 0 ? 340 : 140 };
  }

  private drawPlayers(): void {
    const colors: [number[], number[]] = [
      [0xe8554e, 0xf2a33a],
      [0x35c4a8, 0x9b6ee0],
    ];
    ([0, 1] as SideIndex[]).forEach((side) => {
      TEAMS[side].forEach((player, idx) => {
        const pos = this.positionOf(side, idx);
        const rect = this.add.rectangle(pos.x, pos.y, 28, 36, colors[side][idx]).setStrokeStyle(2, 0x000000);
        const labelY = side === 0 ? pos.y + 34 : pos.y - 34;
        const label = this.add
          .text(pos.x, labelY, '', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', align: 'center' })
          .setOrigin(0.5);
        this.sprites[player.id] = { rect, label, player };
      });
    });
  }

  private highlight(activeId: string): void {
    for (const [id, s] of Object.entries(this.sprites)) {
      if (id === activeId) s.rect.setStrokeStyle(3, 0xffff00);
      else s.rect.setStrokeStyle(2, 0x000000);
    }
  }

  private refreshGuts(): void {
    for (const s of Object.values(this.sprites)) {
      s.label.setText(`${s.player.name}\nG ${this.guts[s.player.id]}/${s.player.maxGuts}`);
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
    const pos = this.positionOf(this.server, 0);
    this.ball.setPosition(pos.x, pos.y);
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

    const defIdx = this.hitIdx[defSide];
    const target = this.positionOf(defSide, defIdx);
    this.tweens.add({
      targets: this.ball,
      x: target.x,
      y: target.y,
      duration: 450,
      ease: 'Sine.easeInOut',
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
    this.say(winner === 0 ? 'YOU WIN THE MATCH!' : 'CPU WINS THE MATCH...');
    const bg = this.add
      .rectangle(180, 530, 200, 56, 0x2b2b5e)
      .setStrokeStyle(2, 0xffe066)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(180, 530, 'PLAY AGAIN', { fontFamily: FONT, fontSize: '16px', color: '#ffe066' })
      .setOrigin(0.5);
    this.menu.push(bg, text);
    bg.once('pointerdown', () => this.scene.restart());
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
