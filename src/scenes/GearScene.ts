import Phaser from 'phaser';
import { ensureCharacterTexture } from '../art/characterTexture';
import { HD_CHARACTER_SCALE } from '../art/hd/characterHd';
import { drawIcon } from '../art/icons';
import { COLORS, css, FONT, HD_SCALE, WIDTH } from '../config';
import { applyLook, equip, gearBonus, hasNewIn, itemsOfSlot, markSeen, SLOT_LABEL, SLOTS, unequip, type GearItem, type Inventory, type Slot } from '../career/gear';
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
  private slot: Slot = 'shoes';

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

  private button(x: number, y: number, w: number, h: number, text: string, size: number, accent: number, onClick: () => void, dim = false): void {
    const b = makeButton(this, x, y, w, h, text, onClick);
    b.text.setFontSize(size);
    b.setAccent(accent);
    if (dim) b.text.setAlpha(0.45);
    this.dyn.push(...b.parts);
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

    // Slots, two columns
    SLOTS.forEach((s, i) => {
      const x = i % 2 === 0 ? 92 : 268;
      const y = 154 + Math.floor(i / 2) * 40;
      const g = inv.equipped[s] ? itemsOfSlot(s).find((it) => it.id === inv.equipped[s]) : undefined;
      const accent = s === this.slot ? COLORS.yellow : g ? RARITY_COLOR[g.rarity] : COLORS.gray;
      this.button(x, y, 170, 34, g ? g.name.replace(/ (Cap|Shirt|Shorts|Shoes|Racket|Wristband|Bag|Balls)$/i, '') : SLOT_LABEL[s], 10, accent, () => {
        this.slot = s;
        this.redraw();
      }, !g);
      const ic = this.add.graphics().setDepth(5);
      drawIcon(ic, s, x - 70, y, 20, g ? RARITY_COLOR[g.rarity] : COLORS.gray);
      this.dyn.push(ic);
      // A star on the category when something new can be put on.
      if (s !== this.slot && hasNewIn(inv, s, level)) {
        const star = this.add.graphics().setDepth(6).setPosition(x + 76, y - 12);
        drawIcon(star, 'star', 0, 0, 20, 0xffe066);
        this.tweens.add({ targets: star, scale: 1.25, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.dyn.push(star);
      }
    });

    // Items of the chosen slot
    this.label(WIDTH / 2, 322, SLOT_LABEL[this.slot], 13, COLORS.white, true);
    itemsOfSlot(this.slot).forEach((it: GearItem, i) => {
      const y = 352 + i * 38;
      const owned = inv.owned.includes(it.id);
      const usable = owned && level >= it.minLevel;
      const on = inv.equipped[this.slot] === it.id;
      const text = usable ? `${on ? '* ' : ''}${it.name}   ${bonusText(it.bonus)}` : `${it.name}   LEVEL ${it.minLevel}`;
      this.button(WIDTH / 2, y, 330, 34, text, 11, on ? COLORS.yellow : RARITY_COLOR[it.rarity], () => {
        if (!usable) return;
        this.save((v) => (on ? unequip(v, this.slot) : equip(v, it.id, level)));
      }, !usable);
    });
  }
}
