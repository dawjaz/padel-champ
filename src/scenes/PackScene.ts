import Phaser from 'phaser';
import { sfx } from '../audio';
import { drawGear } from '../art/gearArt';
import { HEIGHT, WIDTH } from '../config';
import { SLOT_LABEL } from '../career/gear';
import type { Drop } from '../career/packs';
import { applyLightScreen, makeThemeButton, TC, themeText } from '../theme';

const RARITY_COLOR: Record<string, number> = { common: 0x8d9bb0, rare: TC.blue, epic: 0x9b3df0, legendary: 0xf2a900 };
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
    applyLightScreen(this);
    themeText(this, WIDTH / 2, 44, this.opened.packName.toUpperCase(), { size: 28, color: TC.navy, font: 'display' });
    const cardH = 84;
    const top = 90;
    const step = cardH + 10;
    const text = (x: number, y: number, s: string, size: number, c: number, bold = false, ox = 0): Phaser.GameObjects.Text =>
      themeText(this, x, y, s, { size, color: c, origin: [ox, 0.5], font: bold ? 'display' : 'body' });

    const hint = text(WIDTH / 2, HEIGHT - 90, 'TAP TO REVEAL', 14, TC.navy, true, 0.5);
    const done = makeThemeButton(this, WIDTH / 2, HEIGHT - 48, 200, 46, 'DONE', () => this.scene.start('ShopScene'), 'primary', 20);
    const doneParts = done.parts as Array<Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => unknown }>;
    doneParts.forEach((o) => o.setVisible(false));
    done.bg.disableInteractive();

    const cards = this.opened.drops.map((d, i) => {
      const cy = top + i * step + cardH / 2;
      // The card is drawn around its own centre so that it can flip (scaleX) like a real card.
      const g = this.add.graphics().setPosition(WIDTH / 2, cy);
      const frame = (color: number, width: number): void => {
        g.clear();
        g.fillStyle(TC.navy, 1);
        g.fillRoundedRect(-165, -cardH / 2 + 4, 330, cardH, 16);
        g.fillStyle(TC.white, 1);
        g.fillRoundedRect(-165, -cardH / 2, 330, cardH, 16);
        g.lineStyle(width, color, 1);
        g.strokeRoundedRect(-165, -cardH / 2, 330, cardH, 16);
      };
      frame(TC.navy, 3);
      const q = text(WIDTH / 2, cy, '?', 40, TC.blue, true, 0.5);
      // A face-down card waits with a slow pulse.
      const pulse = this.tweens.add({ targets: [g, q], scaleX: 1.02, scaleY: 1.04, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const burst = (color: number, strong: boolean): void => {
        const ring = this.add.ellipse(WIDTH / 2, cy, 40, 20, color, 0).setStrokeStyle(4, color, 1).setDepth(20);
        this.tweens.add({ targets: ring, scaleX: 9, scaleY: 5, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        const n = strong ? 16 : 7;
        for (let k = 0; k < n; k++) {
          const ang = (k / n) * Math.PI * 2 + i;
          const dot = this.add.circle(WIDTH / 2, cy, strong ? 3 : 2, color, 1).setDepth(21);
          this.tweens.add({ targets: dot, x: WIDTH / 2 + Math.cos(ang) * (110 + (k % 3) * 22), y: cy + Math.sin(ang) * (46 + (k % 3) * 10), alpha: 0, duration: 600, ease: 'Cubic.easeOut', onComplete: () => dot.destroy() });
        }
      };
      return () => {
        pulse.stop();
        g.setScale(1);
        q.destroy();
        const reveal = (): void => {
          const shine = d.kind === 'gear' && (d.item.rarity === 'epic' || d.item.rarity === 'legendary');
          const added: Phaser.GameObjects.GameObject[] = [];
          const t = (...args: Parameters<typeof text>): void => { added.push(text(...args)); };
          if (d.kind === 'gear') {
            const color = RARITY_COLOR[d.item.rarity];
            frame(color, 4);
            t(30, cy - 26, d.item.rarity.toUpperCase(), 11, color, true);
            t(30, cy - 6, d.item.name.toUpperCase(), 17, TC.navy, true);
            const bonus = Object.entries(d.item.bonus).map(([k, v]) => `+${v} ${SHORT[k]}`).join('  ');
            t(30, cy + 16, `${SLOT_LABEL[d.item.slot]}   ${bonus}`, 11, TC.orange, true);
            t(30, cy + 32, d.duplicate ? `DUPLICATE: +${d.coins} COINS` : `NEW!  NEEDS LEVEL ${d.item.minLevel}`, 11, d.duplicate ? TC.sub : TC.blue, true);
            const ic = this.add.graphics();
            drawGear(ic, d.item, 306, cy, 56);
            added.push(ic);
            if (d.item.rarity !== 'common') burst(color, shine);
            if (shine) this.cameras.main.flash(180, 255, 240, 170);
          }
          for (const o of added) (o as Phaser.GameObjects.GameObject & { setAlpha: (a: number) => unknown }).setAlpha(0);
          this.tweens.add({ targets: added, alpha: 1, duration: 160 });
          this.tweens.add({ targets: g, scaleX: 1, duration: 140, ease: 'Back.easeOut' });
          sfx(d.kind === 'gear' && d.item.rarity !== 'common' ? 'win' : 'point');
        };
        // Flip: the card narrows to a line, then opens showing the face.
        this.tweens.add({ targets: g, scaleX: 0.02, duration: 110, ease: 'Quad.easeIn', onComplete: reveal });
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
