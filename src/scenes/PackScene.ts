import Phaser from 'phaser';
import { sfx } from '../audio';
import { COLORS, css, FONT, HD_SCALE, HEIGHT, WIDTH } from '../config';
import { SLOT_LABEL } from '../career/gear';
import type { Drop } from '../career/packs';
import { applyScreen } from '../hd';
import { logoText, makeButton } from '../ui';

const RARITY_COLOR: Record<string, number> = { common: COLORS.gray, rare: COLORS.sky, epic: 0xc060ff, legendary: COLORS.yellow };
const SHORT: Record<string, string> = { power: 'POW', spin: 'SPIN', technique: 'TECH', accuracy: 'ACC', stamina: 'STA', speed: 'SPD', defense: 'DEF' };

interface PackData {
  drops: Drop[];
  packName: string;
}

/** Opens a pack: tap to turn the cards one by one. */
export class PackScene extends Phaser.Scene {
  private opened: PackData = { drops: [], packName: '' };

  constructor() {
    super('PackScene');
  }

  init(data: Partial<PackData>): void {
    this.opened = { drops: data.drops ?? [], packName: data.packName ?? '' };
  }

  create(): void {
    applyScreen(this);
    logoText(this, WIDTH / 2, 40, this.opened.packName.toUpperCase(), 24, COLORS.yellow);
    const cardH = 84;
    const top = 90;
    const step = cardH + 10;
    const text = (x: number, y: number, s: string, size: number, c: number, bold = false, ox = 0): Phaser.GameObjects.Text =>
      this.add.text(x, y, s, { fontFamily: FONT, resolution: HD_SCALE, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: css(c) }).setOrigin(ox, 0.5);

    const hint = text(WIDTH / 2, HEIGHT - 90, 'TAP TO REVEAL', 14, COLORS.white, true, 0.5);
    const done = makeButton(this, WIDTH / 2, HEIGHT - 48, 200, 46, 'DONE', () => this.scene.start('ShopScene'));
    const doneParts = done.parts as Array<Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => unknown }>;
    doneParts.forEach((o) => o.setVisible(false));
    done.bg.disableInteractive();

    const cards = this.opened.drops.map((d, i) => {
      const cy = top + i * step + cardH / 2;
      const g = this.add.graphics();
      const frame = (color: number, width: number): void => {
        g.clear();
        g.fillStyle(COLORS.panel, 1);
        g.fillRoundedRect(15, cy - cardH / 2, 330, cardH, 10);
        g.lineStyle(width, color, 1);
        g.strokeRoundedRect(15, cy - cardH / 2, 330, cardH, 10);
      };
      frame(COLORS.gray, 2);
      const q = text(WIDTH / 2, cy, '?', 36, COLORS.gray, true, 0.5);
      return () => {
        q.destroy();
        if (d.kind === 'gear') {
          const color = RARITY_COLOR[d.item.rarity];
          frame(color, 4);
          text(30, cy - 26, d.item.rarity.toUpperCase(), 11, color, true);
          text(30, cy - 6, d.item.name.toUpperCase(), 16, COLORS.white, true);
          const bonus = Object.entries(d.item.bonus).map(([k, v]) => `+${v} ${SHORT[k]}`).join('  ');
          text(30, cy + 16, `${SLOT_LABEL[d.item.slot]}   ${bonus}`, 11, COLORS.yellow, true);
          text(30, cy + 32, d.duplicate ? `DUPLICATE: +${d.coins} COINS` : `NEW!  NEEDS LEVEL ${d.item.minLevel}`, 11, d.duplicate ? COLORS.gray : COLORS.sky, true);
        } else {
          frame(COLORS.green, 3);
          text(30, cy - 14, 'BOOST', 11, COLORS.green, true);
          text(30, cy + 10, d.name.toUpperCase(), 16, COLORS.white, true);
        }
        sfx(d.kind === 'gear' && d.item.rarity !== 'common' ? 'win' : 'point');
      };
    });

    let shown = 0;
    const next = (): void => {
      if (shown < cards.length) {
        cards[shown++]();
      }
      if (shown >= cards.length) {
        hint.setVisible(false);
        doneParts.forEach((o) => o.setVisible(true));
        done.bg.setInteractive({ useHandCursor: true });
      }
    };
    if (cards.length === 0) next();
    this.input.on('pointerdown', (_p: unknown, over: unknown[]) => {
      if (over.length === 0) next();
    });
  }
}
