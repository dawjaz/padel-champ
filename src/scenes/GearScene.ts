import Phaser from 'phaser';
import { addToon } from '../art/toonTexture';
import { sfx } from '../audio';
import { drawIcon, drawRacketShape } from '../art/icons';
import { WIDTH } from '../config';
import { applyLook, BRANDS, brandById, equip, gearBonus, gearById, hasNewIn, itemsOfBrand, markSeen, SLOT_LABEL, SLOTS, unequip, type GearItem, type Inventory, type Slot } from '../career/gear';
import { levelOf } from '../career/profile';
import playersData from '../data/players.json';
import { STAT_KEYS } from '../game/attributes';
import type { PlayerDef } from '../game/types';
import { tournamentActive } from '../career/careerFlow';
import { getSave, updateSave } from '../save';
import { applyLightScreen, drawCard, drawStage, screenHeader, TC, themeText } from '../theme';

const HERO = (playersData.you as unknown as PlayerDef[])[0];
const RARITY_COLOR: Record<string, number> = { common: 0x8d9bb0, rare: TC.blue, epic: 0x9b3df0, legendary: 0xf2a900 };
const SHORT: Record<string, string> = { power: 'POW', spin: 'SPIN', technique: 'TECH', accuracy: 'ACC', stamina: 'STA', speed: 'SPD', defense: 'DEF' };

const bonusText = (b: Partial<Record<string, number>>): string =>
  Object.entries(b)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `+${v} ${SHORT[k]}`)
    .join(' ');

export class GearScene extends Phaser.Scene {
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private slot: Slot = 'racket';
  private brand = 'adaro';

  constructor() {
    super('GearScene');
  }

  create(): void {
    // Upgrades, gear, packs and the shop are closed while a tournament is going on.
    if (tournamentActive(getSave().profile)) {
      this.scene.start('TitleScene');
      return;
    }
    applyLightScreen(this);
    screenHeader(this, 'Gear', { onBack: () => this.scene.start('CharacterScene'), coins: getSave().profile.coins });
    this.redraw();
  }

  private label(x: number, y: number, str: string, size: number, color: number, originX = 0.5, display = false): Phaser.GameObjects.Text {
    const t = themeText(this, x, y, str, { size, color, origin: [originX, 0.5], font: display ? 'display' : 'body' });
    this.dyn.push(t);
    return t;
  }

  /** A tappable rounded card at (x, y) (top-left). */
  private tile(x: number, y: number, w: number, h: number, o: { stroke?: number; radius?: number; fill?: number; shadow?: number }, onClick: () => void): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setPosition(x, y);
    drawCard(g, w, h, o);
    const z = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => {
      sfx('select');
      onClick();
    });
    this.dyn.push(g, z);
    return g;
  }

  private save(fn: (inv: Inventory) => Inventory): void {
    updateSave((d) => ({ ...d, profile: { ...d.profile, inventory: fn(d.profile.inventory) } }));
    this.redraw();
  }

  private redraw(): void {
    for (const o of this.dyn) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.dyn = [];
    let p = getSave().profile;
    const level = levelOf(p.xp);
    // What is new in the slot on screen is seen now; the other slots show a star until they are opened.
    const seenInv = markSeen(p.inventory, this.slot, level);
    if (seenInv !== p.inventory) {
      updateSave((d) => ({ ...d, profile: { ...d.profile, inventory: markSeen(d.profile.inventory, this.slot, level) } }));
      p = getSave().profile;
    }
    const inv = p.inventory;

    // Stage: the hero as he looks now, slot tiles left and right.
    this.dyn.push(drawStage(this, WIDTH / 2, 186, 112));
    this.dyn.push(addToon(this, WIDTH / 2, 288, 210, applyLook(HERO.appearance, inv), 'front'));
    const bonus = gearBonus(inv);
    const lines = STAT_KEYS.filter((k) => bonus[k] > 0).map((k) => `+${bonus[k]} ${SHORT[k]}`);
    this.label(WIDTH / 2, 308, lines.length > 0 ? lines.join('  ') : 'NOTHING EQUIPPED', 11, lines.length > 0 ? TC.orange : TC.sub).setWordWrapWidth(150).setAlign('center');
    SLOTS.forEach((s, i) => {
      const left = i < 3;
      const x = left ? 10 : WIDTH - 76;
      const y = 70 + (i % 3) * 78;
      const g = inv.equipped[s] ? gearById(inv.equipped[s]!) : undefined;
      const sel = s === this.slot;
      this.tile(x, y, 66, 72, { stroke: sel ? TC.orange : g ? RARITY_COLOR[g.rarity] : TC.navy, radius: 14 }, () => {
        this.slot = s;
        this.redraw();
      });
      const ic = this.add.graphics().setDepth(5);
      drawIcon(ic, s, x + 33, y + 25, 26, sel ? TC.orange : g ? RARITY_COLOR[g.rarity] : TC.blue);
      this.dyn.push(ic);
      this.label(x + 33, y + 50, SLOT_LABEL[s], 10, sel ? TC.orange : TC.navy).setDepth(6);
      this.label(x + 33, y + 62, g ? g.name.split(' ')[0] : 'EMPTY', 9, TC.sub).setDepth(6);
      if (!sel && hasNewIn(inv, s, level)) {
        const star = this.add.graphics().setDepth(6).setPosition(x + 55, y + 12);
        drawIcon(star, 'star', 0, 0, 20, TC.gold);
        this.tweens.add({ targets: star, scale: 1.25, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.dyn.push(star);
      }
    });

    // Sheet: brand tabs and the four models of this brand in this slot.
    const sheet = this.add.graphics().setPosition(0, 316);
    sheet.fillStyle(TC.white, 1);
    sheet.fillRoundedRect(0, 0, WIDTH, 340, { tl: 20, tr: 20, bl: 0, br: 0 });
    sheet.lineStyle(3, TC.navy, 1);
    sheet.strokeRoundedRect(0, 0, WIDTH, 340, { tl: 20, tr: 20, bl: 0, br: 0 });
    this.dyn.push(sheet);
    BRANDS.forEach((br, i) => {
      const x = 12 + i * 56;
      const y = 326;
      const own = itemsOfBrand(this.slot, br.id).filter((it) => inv.owned.includes(it.id)).length;
      const sel = br.id === this.brand;
      this.tile(x, y, 51, 40, { stroke: sel ? TC.orange : TC.navy, radius: 10, shadow: sel ? 3 : 2 }, () => {
        this.brand = br.id;
        this.redraw();
      });
      const dot = this.add.graphics();
      dot.fillStyle(parseInt(br.colors[1].slice(1), 16), 1);
      dot.fillRoundedRect(x + 6, y + 5, 39, 6, 3);
      this.dyn.push(dot);
      this.label(x + 25.5, y + 21, br.name.toUpperCase(), 8, sel ? TC.orange : TC.navy);
      this.label(x + 25.5, y + 32, `${own}/4`, 9, own > 0 ? TC.navy : TC.sub);
    });
    const br = brandById(this.brand)!;
    this.label(WIDTH / 2, 382, `${br.name.toUpperCase()}: ${br.tag.toUpperCase()}`, 12, TC.blue);

    itemsOfBrand(this.slot, this.brand).forEach((it: GearItem, i) => {
      const y = 396 + i * 56;
      const owned = inv.owned.includes(it.id);
      const usable = owned && level >= it.minLevel;
      const on = inv.equipped[this.slot] === it.id;
      const status = !owned ? 'NOT OWNED' : level < it.minLevel ? `LEVEL ${it.minLevel}` : on ? 'WORN' : '';
      const g = this.tile(12, y, WIDTH - 24, 50, { stroke: on ? TC.orange : TC.navy, radius: 14, fill: usable ? TC.white : 0xf1f4f9 }, () => {
        if (!usable) return;
        this.save((v) => (on ? unequip(v, this.slot) : equip(v, it.id, level)));
      });
      const rc = RARITY_COLOR[it.rarity];
      const tint = this.add.graphics();
      tint.fillStyle(rc, usable ? 1 : 0.5);
      tint.fillRoundedRect(12, y + 8, 6, 34, 3);
      const ic = this.add.graphics().setDepth(5);
      if (it.shape) drawRacketShape(ic, it.shape, 44, y + 25, 32, usable ? rc : 0x8d9bb0);
      else drawIcon(ic, it.slot, 44, y + 25, 26, usable ? rc : 0x8d9bb0);
      this.dyn.push(tint, ic);
      const name = this.label(66, y + 17, it.name, 14, usable ? TC.navy : TC.sub, 0, true);
      this.label(66, y + 36, bonusText(it.bonus), 11, usable ? TC.orange : TC.sub, 0);
      if (status) {
        const bw = status.length * 7 + 16;
        const badge = this.add.graphics();
        badge.fillStyle(on ? TC.green : TC.track, 1);
        badge.fillRoundedRect(WIDTH - 24 - bw, y + 14, bw, 22, 11);
        badge.lineStyle(2, TC.navy, 1);
        badge.strokeRoundedRect(WIDTH - 24 - bw, y + 14, bw, 22, 11);
        this.dyn.push(badge);
        this.label(WIDTH - 24 - bw / 2, y + 25, status, 10, on ? TC.white : TC.navy);
      }
      void name;
      void g;
    });
    this.label(WIDTH / 2, 626, 'MODELS GET BETTER AND NEED A HIGHER LEVEL', 10, TC.sub);
  }
}
