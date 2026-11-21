import Phaser from 'phaser';
import { drawIcon } from '../art/icons';
import { COLORS, css, FONT, HD_SCALE, WIDTH } from '../config';
import { boostProblem, buyBoost, buyPack, oddsOf, openStockPack, PACKS, RARITIES, type Opened, type PackDef } from '../career/packs';
import { CONSUMABLES, consumableById, MAX_BOOSTS } from '../career/gear';
import { applyScreen } from '../hd';
import { tournamentActive } from '../career/careerFlow';
import { getSave, updateSave } from '../save';
import { logoText, makeButton } from '../ui';

const RARITY_COLOR: Record<string, number> = { common: COLORS.gray, rare: COLORS.sky, epic: 0xc060ff, legendary: COLORS.yellow };

const describe = (p: PackDef): string => {
  const parts: string[] = [];
  if (p.items) parts.push(`${p.items} GEAR`);
  return parts.join(' + ');
};

export class ShopScene extends Phaser.Scene {
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private note = '';

  constructor() {
    super('ShopScene');
  }

  create(): void {
    // Upgrades, gear, packs and the shop are closed while a tournament is going on.
    if (tournamentActive(getSave().profile)) {
      this.scene.start('TitleScene');
      return;
    }
    applyScreen(this);
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
    const coinG = this.add.graphics();
    drawIcon(coinG, 'coin', WIDTH - 24, 62, 16, COLORS.yellow);
    this.dyn.push(coinG);
    this.label(WIDTH - 38, 62, `${p.coins}`, 14, COLORS.yellow, true, 1);

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

    const cardH = 118;
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
      }
      const afford = p.coins >= def.price;
      const b = makeButton(this, 282, cy - 10, 96, 44, `${def.price}`, () => this.open(buyPack(getSave().profile, def.id, Math.random), def.name));
      b.setAccent(afford ? COLORS.yellow : COLORS.gray);
      b.text.setAlpha(afford ? 1 : 0.4);
      this.dyn.push(...b.parts);
      this.label(282, cy + 22, 'COINS', 10, COLORS.gray);
    });

    // Boosts: bought here, kept in the bag (two at most) and used one per tournament match.
    const boostTop = top + PACKS.length * (cardH + gap) + 2;
    this.label(WIDTH / 2, boostTop + 10, `BOOSTS  (BAG ${p.inventory.boosts.length}/${MAX_BOOSTS})`, 12, COLORS.white, true);
    CONSUMABLES.forEach((c, i) => {
      const bx = 98 + (i % 2) * 164;
      const by = boostTop + 40 + Math.floor(i / 2) * 50;
      const problem = boostProblem(p, c.id);
      const b = makeButton(this, bx, by, 158, 44, `${c.name.toUpperCase()}\n${c.short}  ${c.price}`, () => {
        const next = buyBoost(getSave().profile, c.id);
        if (!next) {
          this.note = (boostProblem(getSave().profile, c.id) ?? 'CANNOT BUY').toUpperCase();
        } else {
          updateSave((d) => ({ ...d, profile: next }));
          this.note = `${c.name.toUpperCase()} IS IN YOUR BAG`;
        }
        this.redraw();
      });
      b.text.setFontSize(10);
      b.setAccent(problem ? COLORS.gray : COLORS.green);
      b.text.setAlpha(problem ? 0.45 : 1);
      this.dyn.push(...b.parts);
    });
    const bag = p.inventory.boosts.map((id) => consumableById(id)?.name.toUpperCase() ?? id);
    this.label(WIDTH / 2, boostTop + 148, `IN YOUR BAG: ${bag.length > 0 ? bag.join(', ') : 'EMPTY'}`, 11, COLORS.yellow, true);
    this.label(WIDTH / 2, boostTop + 168, this.note || 'USE ONE BOOST BEFORE EACH TOURNAMENT MATCH', 10, COLORS.sky);
  }
}
