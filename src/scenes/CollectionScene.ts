import Phaser from 'phaser';
import { WIDTH } from '../config';
import { BRANDS, GEAR, itemsOfBrand, ownedOfBrand, setBonusOf, SET_PIECES, SLOT_LABEL, SLOTS, type Rarity } from '../career/gear';
import { drawGear, shade } from '../art/gearArt';
import { STAT_KEYS } from '../game/attributes';
import { getSave } from '../save';
import { applyLightScreen, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

const RARITY_COLOR: Record<Rarity, number> = { common: 0x8d9bb0, rare: TC.blue, epic: 0x9b3df0, legendary: 0xf2a900 };
const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const SHORT: Record<string, string> = { power: 'POW', spin: 'SPIN', technique: 'TECH', accuracy: 'ACC', stamina: 'STA', speed: 'SPD', defense: 'DEF' };
const FULL: Record<string, string> = { power: 'POWER', spin: 'SPIN', technique: 'TECHNIQUE', accuracy: 'ACCURACY', stamina: 'STAMINA', speed: 'SPEED', defense: 'DEFENSE' };

/** Every item of the game, by brand: what you own, what you wear, and the set bonus of the brand. */
export class CollectionScene extends Phaser.Scene {
  private brand = 0;

  constructor() {
    super('CollectionScene');
  }

  create(): void {
    this.brand = 0;
    const worn = setBonusOf(getSave().profile.inventory);
    if (worn) this.brand = Math.max(0, BRANDS.findIndex((b) => b.id === worn.brand.id));
    this.render(true);
  }

  private render(first = false): void {
    this.children.removeAll(true);
    applyLightScreen(this, first);
    const save = getSave();
    const inv = save.profile.inventory;
    screenHeader(this, 'Collection', { onBack: () => this.scene.start('TitleScene'), coins: save.profile.coins });
    const br = BRANDS[this.brand];
    const step = (d: number): void => {
      this.brand = (this.brand + d + BRANDS.length) % BRANDS.length;
      this.render();
    };

    // Brand switcher.
    makeThemeButton(this, 36, 90, 52, 40, '<', () => step(-1), 'blue', 22);
    makeThemeButton(this, WIDTH - 36, 90, 52, 40, '>', () => step(1), 'blue', 22);
    const head = this.add.graphics().setPosition(70, 70);
    drawCard(head, WIDTH - 140, 40, { radius: 12, fill: parseInt(br.colors[1].slice(1), 16), stroke: TC.navy });
    themeText(this, WIDTH / 2, 84, br.name.toUpperCase(), { size: 18, font: 'display', color: TC.white });
    themeText(this, WIDTH / 2, 101, `${br.tag.toUpperCase()}   ${ownedOfBrand(inv, br.id)}/20`, { size: 10, font: 'display', color: TC.white });

    // Set bonus of the brand.
    const worn = setBonusOf(inv);
    const pieces = worn?.brand.id === br.id ? worn.pieces : 0;
    const a = FULL[br.set[0]];
    const b = FULL[br.set[1]];
    const line = (n: number, y: number, text: string): void => {
      const on = pieces >= n;
      themeText(this, 16, y, `${n} PIECES`, { size: 11, font: 'display', color: on ? TC.orange : TC.navy, origin: [0, 0.5] });
      themeText(this, 92, y, text, { size: 11, color: on ? TC.orange : TC.sub, weight: '700', origin: [0, 0.5] });
      themeText(this, WIDTH - 16, y, on ? 'ACTIVE' : '', { size: 11, font: 'display', color: TC.orange, origin: [1, 0.5] });
    };
    themeText(this, 16, 128, `SET BONUS  (WORN ${pieces}/5)`, { size: 12, font: 'display', origin: [0, 0.5] });
    line(SET_PIECES[0], 146, `+1 ${a}`);
    line(SET_PIECES[1], 162, `+1 ${a}  +1 ${b}`);

    // Grid: a row per slot, a column per model (common to legendary). An item you own is drawn in full colour, one you do not own is faded.
    const gx = 78;
    const cw = 64;
    const th = 76;
    RARITIES.forEach((r, c) => themeText(this, gx + c * cw + 29, 184, r.toUpperCase(), { size: 9, font: 'display', color: RARITY_COLOR[r] }));
    SLOTS.forEach((s, row) => {
      const y = 194 + row * 80;
      themeText(this, 12, y + th / 2, SLOT_LABEL[s], { size: 11, font: 'display', origin: [0, 0.5] });
      itemsOfBrand(s, br.id).forEach((it, c) => {
        const x = gx + c * cw;
        const own = inv.owned.includes(it.id);
        const wearing = inv.equipped[s] === it.id;
        const rc = RARITY_COLOR[it.rarity];
        const g = this.add.graphics().setPosition(x, y);
        drawCard(g, 58, th, { radius: 10, fill: own ? shade(rc, 0.85) : 0xf1f4f9, stroke: wearing ? TC.orange : own ? TC.navy : 0xb9c6da, shadow: own ? 3 : 1 });
        if (own) {
          g.fillStyle(rc, 1);
          g.fillRoundedRect(4, 4, 50, 5, 2.5);
        }
        const art = this.add.graphics();
        drawGear(art, it, x + 29, y + 31, 42);
        if (!own) art.setAlpha(0.36);
        if (own) {
          const bonus = Object.entries(it.bonus).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => `+${v} ${SHORT[k]}`);
          themeText(this, x + 29, y + 62, bonus.join('\n'), { size: 9, font: 'display', color: TC.navy, align: 'center' }).setLineSpacing(-3);
          if (wearing) {
            const tag = this.add.graphics();
            tag.fillStyle(TC.orange, 1);
            tag.fillRoundedRect(x + 12, y - 6, 34, 13, 6);
            tag.lineStyle(1.5, TC.navy, 1);
            tag.strokeRoundedRect(x + 12, y - 6, 34, 13, 6);
            themeText(this, x + 29, y + 1, 'WORN', { size: 8, font: 'display', color: TC.white });
          }
        } else {
          themeText(this, x + 29, y + 62, `LVL ${it.minLevel}`, { size: 9, font: 'display', color: 0x8896ad });
        }
      });
    });
    const total = GEAR.filter((g) => inv.owned.includes(g.id)).length;
    themeText(this, WIDTH / 2, 606, `COLLECTION  ${total} / ${GEAR.length}`, { size: 14, font: 'display' });
    themeText(this, WIDTH / 2, 626, 'GET MORE IN THE SHOP: PACKS CAN BE BOUGHT PER BRAND', { size: 10, color: TC.sub });
    void STAT_KEYS;
  }
}
