import Phaser from 'phaser';
import { ensureCharacterTexture } from '../art/characterTexture';
import { HD_CHARACTER_SCALE } from '../art/hd/characterHd';
import { drawIcon, drawRacketShape } from '../art/icons';
import { COLORS, css, FONT, HD_SCALE, WIDTH } from '../config';
import { applyLook, BRANDS, brandById, equip, gearBonus, gearById, hasNewIn, itemsOfBrand, markSeen, SLOT_LABEL, SLOTS, unequip, type GearItem, type Inventory, type Slot } from '../career/gear';
import { levelOf } from '../career/profile';
import playersData from '../data/players.json';
import { STAT_KEYS } from '../game/attributes';
import type { PlayerDef } from '../game/types';
import { applyScreen } from '../hd';
import { tournamentActive } from '../career/careerFlow';
import { getSave, updateSave } from '../save';
import { logoText, makeButton } from '../ui';

const HERO = (playersData.you as unknown as PlayerDef[])[0];
const RARITY_COLOR: Record<string, number> = { common: COLORS.gray, rare: COLORS.sky, epic: 0xc060ff, legendary: COLORS.yellow };
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
    applyScreen(this);
    logoText(this, WIDTH / 2, 30, 'GEAR', 30, COLORS.yellow);
    makeButton(this, WIDTH / 2, 608, 160, 40, 'BACK', () => this.scene.start('CharacterScene'));
    this.redraw();
  }

  private label(x: number, y: number, str: string, size: number, color: number, bold = false, originX = 0.5): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, str, { fontFamily: FONT, resolution: HD_SCALE, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: css(color) })
      .setOrigin(originX, 0.5);
    this.dyn.push(t);
    return t;
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

    const key = ensureCharacterTexture(this, applyLook(HERO.appearance, inv), 'front');
    this.dyn.push(this.add.image(46, 124, key).setOrigin(0.5, 1).setScale(1.5 / HD_CHARACTER_SCALE));
    const bonus = gearBonus(inv);
    this.label(100, 62, 'GEAR BONUS', 12, COLORS.gray, true, 0);
    const lines = STAT_KEYS.filter((k) => bonus[k] > 0).map((k) => `+${bonus[k]} ${SHORT[k]}`);
    this.label(100, 96, lines.length > 0 ? lines.join('   ') : 'NOTHING EQUIPPED', 12, COLORS.yellow, true, 0).setWordWrapWidth(240);

    // Slots: five tabs in a row (icon, rarity colour of what is worn, star when something new can be put on)
    SLOTS.forEach((s, i) => {
      const x = 36 + i * 72;
      const y = 164;
      const g = inv.equipped[s] ? gearById(inv.equipped[s]!) : undefined;
      const accent = s === this.slot ? COLORS.yellow : g ? RARITY_COLOR[g.rarity] : COLORS.gray;
      const b = makeButton(this, x, y, 66, 52, '', () => {
        this.slot = s;
        this.redraw();
      });
      b.setAccent(accent);
      this.dyn.push(...b.parts);
      const ic = this.add.graphics().setDepth(5);
      drawIcon(ic, s, x, y - 8, 22, g ? RARITY_COLOR[g.rarity] : COLORS.gray);
      this.dyn.push(ic);
      this.label(x, y + 16, SLOT_LABEL[s], 9, s === this.slot ? COLORS.yellow : COLORS.gray, true).setDepth(6);
      if (s !== this.slot && hasNewIn(inv, s, level)) {
        const star = this.add.graphics().setDepth(6).setPosition(x + 25, y - 22);
        drawIcon(star, 'star', 0, 0, 20, 0xffe066);
        this.tweens.add({ targets: star, scale: 1.25, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.dyn.push(star);
      }
    });

    // Brands: six tabs
    BRANDS.forEach((br, i) => {
      const x = 32 + (i % 6) * 59;
      const y = 226;
      const own = itemsOfBrand(this.slot, br.id).filter((it) => inv.owned.includes(it.id)).length;
      const b = makeButton(this, x, y, 56, 34, br.name.toUpperCase(), () => {
        this.brand = br.id;
        this.redraw();
      });
      b.text.setFontSize(9).setY(y - 4);
      b.setAccent(br.id === this.brand ? COLORS.yellow : parseInt(br.colors[1].slice(1), 16));
      this.dyn.push(...b.parts);
      this.label(x, y + 9, `${own}/4`, 8, own > 0 ? COLORS.white : COLORS.gray).setDepth(6);
    });
    const br = brandById(this.brand)!;
    this.label(WIDTH / 2, 262, `${br.name.toUpperCase()}: ${br.tag.toUpperCase()}`, 11, COLORS.sky, true);

    // The four models of this brand in this slot, from basic to elite
    itemsOfBrand(this.slot, this.brand).forEach((it: GearItem, i) => {
      const y = 306 + i * 52;
      const owned = inv.owned.includes(it.id);
      const usable = owned && level >= it.minLevel;
      const on = inv.equipped[this.slot] === it.id;
      const status = !owned ? 'NOT OWNED' : level < it.minLevel ? `LEVEL ${it.minLevel}` : on ? 'WORN' : '';
      const text = `${on ? '* ' : ''}${it.name}\n${bonusText(it.bonus)}${status ? `   ${status}` : ''}`;
      const b = makeButton(this, WIDTH / 2 + 12, y, 296, 46, text, () => {
        if (!usable) return;
        this.save((v) => (on ? unequip(v, this.slot) : equip(v, it.id, level)));
      });
      b.text.setFontSize(11).setAlign('center');
      b.setAccent(on ? COLORS.yellow : RARITY_COLOR[it.rarity]);
      if (!usable) b.text.setAlpha(0.45);
      this.dyn.push(...b.parts);
      const ic = this.add.graphics().setDepth(5);
      if (it.shape) drawRacketShape(ic, it.shape, 34, y + 2, 34, usable ? RARITY_COLOR[it.rarity] : COLORS.gray);
      else drawIcon(ic, it.slot, 34, y, 26, usable ? RARITY_COLOR[it.rarity] : COLORS.gray);
      this.dyn.push(ic);
    });
    this.label(WIDTH / 2, 520, 'MODELS GET BETTER AND NEED A HIGHER LEVEL', 10, COLORS.gray);
  }
}
