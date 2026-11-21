import Phaser from 'phaser';
import { ensureCharacterTexture } from '../art/characterTexture';
import { HD_CHARACTER_SCALE } from '../art/hd/characterHd';
import { COLORS, css, FONT, HD_SCALE, WIDTH } from '../config';
import { applyLook, CONSUMABLES, equip, gearBonus, itemsOfSlot, MAX_QUEUED, SLOT_LABEL, SLOTS, toggleQueued, unequip, type GearItem, type Inventory, type Slot } from '../career/gear';
import { levelOf } from '../career/profile';
import playersData from '../data/players.json';
import { STAT_KEYS } from '../game/attributes';
import type { PlayerDef } from '../game/types';
import { applyHd } from '../hd';
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
  private note = 'TAP A BOOST TO USE IT IN YOUR NEXT MATCH';

  constructor() {
    super('GearScene');
  }

  create(): void {
    applyHd(this);
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
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const p = getSave().profile;
    const inv = p.inventory;
    const level = levelOf(p.xp);

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
      this.button(x, y, 170, 34, `${SLOT_LABEL[s]}: ${g ? g.name.replace(/ (Cap|Shirt|Shorts|Shoes|Racket|Wristband|Bag|Balls)$/i, '') : '-'}`, 10, s === this.slot ? COLORS.yellow : g ? RARITY_COLOR[g.rarity] : COLORS.gray, () => {
        this.slot = s;
        this.redraw();
      });
    });

    // Items of the chosen slot
    this.label(WIDTH / 2, 326, SLOT_LABEL[this.slot], 13, COLORS.white, true);
    itemsOfSlot(this.slot).forEach((it: GearItem, i) => {
      const y = 360 + i * 44;
      const owned = inv.owned.includes(it.id);
      const usable = owned && level >= it.minLevel;
      const on = inv.equipped[this.slot] === it.id;
      const text = usable ? `${on ? '* ' : ''}${it.name}   ${bonusText(it.bonus)}` : `${it.name}   LEVEL ${it.minLevel}`;
      this.button(WIDTH / 2, y, 330, 38, text, 11, on ? COLORS.yellow : RARITY_COLOR[it.rarity], () => {
        if (!usable) return;
        this.save((v) => (on ? unequip(v, this.slot) : equip(v, it.id, level)));
      }, !usable);
    });

    // Boosts for the next match
    this.label(WIDTH / 2, 500, `BOOSTS FOR THE NEXT MATCH (${inv.queued.length}/${MAX_QUEUED})`, 11, COLORS.white, true);
    CONSUMABLES.forEach((c, i) => {
      const n = inv.stock[c.id] ?? 0;
      const queued = inv.queued.includes(c.id);
      this.button(51 + i * 86, 536, 80, 44, `${c.name.split(' ')[0].toUpperCase()}\nx${n}`, 10, queued ? COLORS.yellow : COLORS.gray, () => {
        this.note = `${c.name.toUpperCase()}: ${c.desc}`;
        this.save((v) => toggleQueued(v, c.id));
      }, n === 0 && !queued);
    });
    this.label(WIDTH / 2, 574, this.note, 10, COLORS.sky).setWordWrapWidth(340);
  }
}
