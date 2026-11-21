import Phaser from 'phaser';
import { COLORS, css, FONT, HD_SCALE, WIDTH } from '../config';
import { buyPack, oddsOf, openStockPack, PACKS, RARITIES, type Opened, type PackDef } from '../career/packs';
import { applyHd } from '../hd';
import { getSave, updateSave } from '../save';
import { logoText, makeButton } from '../ui';

const RARITY_COLOR: Record<string, number> = { common: COLORS.gray, rare: COLORS.sky, epic: 0xc060ff, legendary: COLORS.yellow };

const describe = (p: PackDef): string => {
  const parts: string[] = [];
  if (p.items) parts.push(`${p.items} GEAR`);
  if (p.consumables) parts.push(`${p.consumables} BOOSTS`);
  return parts.join(' + ');
};

export class ShopScene extends Phaser.Scene {
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private note = '';

  constructor() {
    super('ShopScene');
  }

  create(): void {
    applyHd(this);
    logoText(this, WIDTH / 2, 30, 'SHOP', 30, COLORS.yellow);
    makeButton(this, WIDTH / 2, 608, 160, 40, 'BACK', () => this.scene.start('TitleScene'));
    this.redraw();
  }

  private label(x: number, y: number, str: string, size: number, color: number, bold = false, originX = 0.5): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, str, { fontFamily: FONT, resolution: HD_SCALE, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: css(color) })
      .setOrigin(originX, 0.5);
    this.dyn.push(t);
    return t;
  }

  private open(result: Opened | null, packName: string): void {
    if (!result) {
      this.note = 'NOT ENOUGH COINS';
      this.redraw();
      return;
    }
    updateSave((d) => ({ ...d, profile: result.profile }));
    this.scene.start('PackScene', { drops: result.drops, packName });
  }

  private redraw(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const p = getSave().profile;
    this.label(WIDTH - 16, 62, `COINS ${p.coins}`, 14, COLORS.yellow, true, 1);

    // Free packs (one per level up)
    let y = 84;
    for (const def of PACKS) {
      const n = p.inventory.packs[def.id] ?? 0;
      if (n <= 0) continue;
      const b = makeButton(this, WIDTH / 2, y + 16, 330, 34, `OPEN FREE ${def.name.toUpperCase()}  x${n}`, () => this.open(openStockPack(getSave().profile, def.id, Math.random), def.name));
      b.text.setFontSize(13);
      b.setAccent(COLORS.yellow);
      this.dyn.push(...b.parts);
      y += 42;
    }

    const cardH = 132;
    const gap = 8;
    const top = Math.max(y, 90);
    PACKS.forEach((def, i) => {
      const cy = top + i * (cardH + gap) + cardH / 2;
      const g = this.add.graphics();
      g.fillStyle(COLORS.panel, 0.9);
      g.fillRoundedRect(15, cy - cardH / 2, 330, cardH, 10);
      g.lineStyle(2, COLORS.white, 0.6);
      g.strokeRoundedRect(15, cy - cardH / 2, 330, cardH, 10);
      this.dyn.push(g);
      this.label(28, cy - cardH / 2 + 18, def.name.toUpperCase(), 15, COLORS.white, true, 0);
      this.label(28, cy - cardH / 2 + 38, describe(def), 11, COLORS.gray, false, 0);
      if (def.odds) {
        const odds = oddsOf(def);
        RARITIES.forEach((r) => {
          const o = odds.find((x) => x.rarity === r);
          if (!o) return;
          const row = odds.indexOf(o);
          this.label(28, cy - cardH / 2 + 62 + row * 15, `${r.toUpperCase()}`, 11, RARITY_COLOR[r], true, 0);
          this.label(110, cy - cardH / 2 + 62 + row * 15, `${o.percent}%`, 11, COLORS.white, false, 0);
        });
        if (def.pity) this.label(28, cy + cardH / 2 - 16, `SURE ${def.pity.min.toUpperCase()}+ EVERY ${def.pity.after} PACKS (${p.inventory.pity[def.id] ?? 0}/${def.pity.after - 1})`, 10, COLORS.sky, false, 0);
      } else {
        this.label(28, cy - cardH / 2 + 62, 'RANDOM BOOSTS: DRINK, GEL, TAPE, BALLS', 11, COLORS.white, false, 0);
      }
      const afford = p.coins >= def.price;
      const b = makeButton(this, 282, cy - 10, 96, 44, `${def.price}`, () => this.open(buyPack(getSave().profile, def.id, Math.random), def.name));
      b.setAccent(afford ? COLORS.yellow : COLORS.gray);
      b.text.setAlpha(afford ? 1 : 0.4);
      this.dyn.push(...b.parts);
      this.label(282, cy + 22, 'COINS', 10, COLORS.gray);
    });
    this.label(WIDTH / 2, 586, this.note || 'A DUPLICATE TURNS INTO COINS', 11, COLORS.sky);
  }
}
