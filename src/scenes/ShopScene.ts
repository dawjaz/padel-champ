import Phaser from 'phaser';
import { WIDTH } from '../config';
import { boostProblem, buyBoost, buyPack, oddsOf, openStockPack, PACKS, priceOf, RARITIES, type Opened, type PackDef } from '../career/packs';
import { BRANDS, CONSUMABLES, consumableById, MAX_BOOSTS } from '../career/gear';
import { tournamentActive } from '../career/careerFlow';
import { getSave, updateSave } from '../save';
import { showTip } from '../tutorial/tips';
import { drawBoostIcon } from '../art/boostArt';
import { applyLightScreen, drawCard, drawCoin, makeThemeButton, screenHeader, TC, themeText } from '../theme';

const RARITY_COLOR: Record<string, number> = { common: 0x8d9bb0, rare: TC.blue, epic: 0x9b3df0, legendary: 0xf2a900 };

const describe = (p: PackDef): string => {
  const parts: string[] = [];
  if (p.items) parts.push(`${p.items} GEAR`);
  return parts.join(' + ');
};

export class ShopScene extends Phaser.Scene {
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private note = '';
  /** The brand a bought pack is limited to (null = any brand), a surcharge applies. */
  private brand: string | null = null;

  /** The scene the shop was opened from (by tapping the coins); the back button returns there. */
  private backTo = 'TitleScene';

  constructor() {
    super('ShopScene');
  }

  init(data: { from?: string }): void {
    this.backTo = data?.from ?? 'TitleScene';
  }

  create(): void {
    // Upgrades, gear, packs and the shop are closed while a tournament is going on.
    if (tournamentActive(getSave().profile)) {
      this.scene.start('TitleScene');
      return;
    }
    applyLightScreen(this);
    this.redraw();
    this.time.delayedCall(250, () => showTip(this, 'shop'));
  }

  private label(x: number, y: number, str: string, size: number, color: number, originX = 0.5, display = false): Phaser.GameObjects.Text {
    const t = themeText(this, x, y, str, { size, color, origin: [originX, 0.5], font: display ? 'display' : 'body' });
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
    // The header shows the coin count, so it is rebuilt with the rest.
    const before = this.children.length;
    screenHeader(this, 'Shop', { onBack: () => this.scene.start(this.backTo), coins: p.coins });
    this.dyn.push(...this.children.list.slice(before));

    // Free packs (one per level up)
    let y = 68;
    for (const def of PACKS) {
      const n = p.inventory.packs[def.id] ?? 0;
      if (n <= 0) continue;
      const b = makeThemeButton(this, WIDTH / 2, y + 17, 336, 34, `OPEN FREE ${def.name.toUpperCase()}  x${n}`, () => this.open(openStockPack(getSave().profile, def.id, Math.random), def.name), 'primary', 14);
      this.dyn.push(...b.parts);
      y += 42;
    }

    // Brand filter for the packs you buy (the free level-up packs are never limited).
    const names = ['ANY BRAND', ...BRANDS.map((b) => b.name.toUpperCase())];
    const ids: Array<string | null> = [null, ...BRANDS.map((b) => b.id)];
    const bi = Math.max(0, ids.indexOf(this.brand));
    const go = (d: number): void => {
      this.brand = ids[(bi + d + ids.length) % ids.length];
      this.redraw();
    };
    this.dyn.push(...makeThemeButton(this, 34, y + 18, 46, 34, '<', () => go(-1), 'blue', 20).parts);
    this.dyn.push(...makeThemeButton(this, WIDTH - 34, y + 18, 46, 34, '>', () => go(1), 'blue', 20).parts);
    const bg = this.add.graphics().setPosition(64, y + 1);
    drawCard(bg, WIDTH - 128, 34, { radius: 12 });
    this.dyn.push(bg);
    this.label(WIDTH / 2, y + 12, names[bi], 14, TC.navy, 0.5, true);
    this.label(WIDTH / 2, y + 27, this.brand ? `ONLY ${names[bi]} ITEMS  +50% PRICE` : 'PACKS GIVE ITEMS OF ANY BRAND', 9, this.brand ? TC.orange : TC.sub);
    y += 42;

    const cardH = 108;
    const gap = 4;
    const top = y;
    PACKS.forEach((def, i) => {
      const cy = top + i * (cardH + gap) + cardH / 2;
      const x0 = 12;
      const y0 = cy - cardH / 2;
      const g = this.add.graphics().setPosition(x0, y0);
      drawCard(g, WIDTH - 24, cardH, { radius: 14 });
      this.dyn.push(g);
      this.label(x0 + 14, y0 + 16, def.name.toUpperCase(), 16, TC.navy, 0, true);
      this.label(x0 + 14, y0 + 35, describe(def), 11, TC.sub, 0);
      if (def.odds) {
        const odds = oddsOf(def);
        RARITIES.forEach((r) => {
          const o = odds.find((v) => v.rarity === r);
          if (!o) return;
          const row = odds.indexOf(o);
          const ry = y0 + 54 + row * 14;
          const dot = this.add.graphics();
          dot.fillStyle(RARITY_COLOR[r], 1);
          dot.fillCircle(x0 + 20, ry, 4);
          dot.lineStyle(1.5, TC.navy, 1);
          dot.strokeCircle(x0 + 20, ry, 4);
          this.dyn.push(dot);
          this.label(x0 + 30, ry, r.toUpperCase(), 10, TC.navy, 0);
          this.label(x0 + 108, ry, `${o.percent}%`, 10, TC.sub, 0);
        });
        if (def.pity) this.label(x0 + 14, y0 + cardH - 12, `SURE ${def.pity.min.toUpperCase()}+ EVERY ${def.pity.after} PACKS (${p.inventory.pity[def.id] ?? 0}/${def.pity.after - 1})`, 9, TC.blue, 0);
      }
      const price = priceOf(def, this.brand ?? undefined);
      const afford = p.coins >= price;
      const b = makeThemeButton(this, 282, cy - 8, 100, 46, `${price}`, () => this.open(buyPack(getSave().profile, def.id, Math.random, this.brand ?? undefined), def.name), afford ? 'primary' : 'secondary', 18);
      b.text.setAlpha(afford ? 1 : 0.45);
      this.dyn.push(...b.parts);
      this.label(282, cy + 24, 'COINS', 10, TC.sub);
    });

    // Boosts: bought here, kept in the bag (two at most) and used one per tournament match.
    const boostTop = top + PACKS.length * (cardH + gap) + 2;
    this.label(WIDTH / 2, boostTop + 8, `BOOSTS  (BAG ${p.inventory.boosts.length}/${MAX_BOOSTS})`, 13, TC.navy, 0.5, true);
    CONSUMABLES.forEach((c, i) => {
      const bx = 97 + (i % 2) * 166;
      const by = boostTop + 40 + Math.floor(i / 2) * 50;
      const problem = boostProblem(p, c.id);
      const b = makeThemeButton(this, bx, by, 160, 44, ' ', () => {
        const next = buyBoost(getSave().profile, c.id);
        if (!next) {
          this.note = (boostProblem(getSave().profile, c.id) ?? 'CANNOT BUY').toUpperCase();
        } else {
          updateSave((d) => ({ ...d, profile: next }));
          this.note = `${c.name.toUpperCase()} IS IN YOUR BAG`;
        }
        this.redraw();
      }, problem ? 'secondary' : 'blue', 10);
      this.dyn.push(...b.parts);
      const dim = problem ? 0.5 : 1;
      // the item (drawn, on a light disc), what it gives, and the price with a coin
      const disc = this.add.graphics().setDepth(9000).setAlpha(dim);
      disc.fillStyle(0xffffff, 1).fillCircle(bx - 58, by, 18);
      disc.lineStyle(2, TC.navy, 1).strokeCircle(bx - 58, by, 18);
      drawBoostIcon(disc, c.id, bx - 58, by);
      const fx = themeText(this, bx + 14, by - 9, c.short, { size: 10, color: problem ? TC.navy : TC.white, font: 'display', origin: [0.5, 0.5] }).setDepth(9000).setAlpha(dim);
      const pr = themeText(this, bx + 5, by + 10, `${c.price}`, { size: 12, color: problem ? TC.navy : TC.white, font: 'display', origin: [0, 0.5] }).setDepth(9000).setAlpha(dim);
      const coin = this.add.graphics().setDepth(9000).setAlpha(dim);
      drawCoin(coin, bx - 4, by + 10, 6);
      pr.x = bx + 5;
      this.dyn.push(disc, fx, pr, coin);
    });
    const bag = p.inventory.boosts.map((id) => consumableById(id)?.name.toUpperCase() ?? id);
    this.label(WIDTH / 2, boostTop + 148, `IN YOUR BAG: ${bag.length > 0 ? bag.join(', ') : 'EMPTY'}`, 11, TC.orange);
    this.label(WIDTH / 2, boostTop + 166, this.note || 'USE ONE BOOST BEFORE EACH TOURNAMENT MATCH', 10, TC.sub);
  }
}
