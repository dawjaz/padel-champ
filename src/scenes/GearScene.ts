import Phaser from 'phaser';
import { showTip } from '../tutorial/tips';
import { addToon } from '../art/toonTexture';
import { sfx } from '../audio';
import { drawIcon } from '../art/icons';
import { drawGear } from '../art/gearArt';
import { WIDTH } from '../config';
import { setBonusOf, BRANDS, brandById, equip, gearBonus, gearById, hasNewIn, hasNewInBrand, isNewItem, itemsOfBrand, markItemSeen, SLOT_LABEL, SLOTS, tierOf, unequip, type GearItem, type Inventory, type Slot } from '../career/gear';
import { heroFrom, heroLook, levelOf } from '../career/profile';
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
  /** The model the player has tapped: its effect on the stats is shown before he wears it. */
  private sel: string | null = null;

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
    this.time.delayedCall(250, () => showTip(this, 'gear'));
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

  /** The pulsing gold star that marks something new. */
  private star(x: number, y: number, size: number): void {
    const star = this.add.graphics().setDepth(10).setPosition(x, y);
    drawIcon(star, 'star', 0, 0, size, TC.gold);
    this.tweens.add({ targets: star, scale: 1.25, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.dyn.push(star);
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
    const p = getSave().profile;
    const level = levelOf(p.xp);
    // A star stays on a new model (its row, its brand tab, its slot) until the player taps that model.
    const inv = p.inventory;

    // Stage: the hero as he looks now (or in the model he is trying on), his stats in a table with the change a tapped model makes.
    const selItem = this.sel ? gearById(this.sel) : undefined;
    const preview = selItem && selItem.slot === this.slot ? (inv.equipped[this.slot] === selItem.id ? unequip(inv, this.slot) : { ...inv, equipped: { ...inv.equipped, [this.slot]: selItem.id } }) : undefined;
    const shown = preview ?? inv;
    this.dyn.push(drawStage(this, WIDTH / 2, 120, 50));
    this.dyn.push(addToon(this, WIDTH / 2, 168, 100, heroLook({ gender: p.gender, inventory: shown }), 'front'));
    const now = heroFrom(HERO, p).stats;
    const after = preview ? heroFrom(HERO, { ...p, inventory: preview }).stats : now;
    const gear = gearBonus(shown);
    STAT_KEYS.forEach((k, i) => {
      const y = 186 + i * 17;
      const delta = after[k] - now[k];
      this.label(88, y, SHORT[k], 11, TC.sub, 0);
      this.label(150, y, String(after[k]), 12, delta > 0 ? TC.green : delta < 0 ? TC.orange : TC.navy, 1, true);
      if (preview) {
        this.label(160, y, delta === 0 ? '' : `${delta > 0 ? '+' : ''}${delta}`, 11, delta > 0 ? TC.green : TC.orange, 0);
      } else if (gear[k] > 0) {
        this.label(160, y, `+${gear[k]} gear`, 10, TC.orange, 0);
      }
      // a small bar: how far the stat is from the top
      const bar = this.add.graphics();
      bar.fillStyle(TC.track, 1);
      bar.fillRoundedRect(204, y - 4, 74, 8, 4);
      bar.fillStyle(delta < 0 ? TC.orange : delta > 0 ? TC.green : TC.blue, 1);
      bar.fillRoundedRect(204, y - 4, Math.max(5, (74 * after[k]) / 10), 8, 4);
      this.dyn.push(bar);
    });
    const set = setBonusOf(shown);
    if (preview && selItem) this.label(WIDTH / 2, 308, `TRYING ON: ${selItem.name.toUpperCase()}`, 10, TC.blue).setWordWrapWidth(210).setAlign('center');
    else if (set && set.stats.length > 0) this.label(WIDTH / 2, 308, `${set.brand.name.toUpperCase()} SET ${set.pieces}/5 (INCLUDED)`, 10, TC.blue);
    else if (!Object.values(inv.equipped).some(Boolean)) this.label(WIDTH / 2, 308, 'NOTHING EQUIPPED', 10, TC.sub);
    SLOTS.forEach((s, i) => {
      const left = i < 3;
      const x = left ? 10 : WIDTH - 76;
      const y = 70 + (i % 3) * 78;
      const g = inv.equipped[s] ? gearById(inv.equipped[s]!) : undefined;
      const sel = s === this.slot;
      this.tile(x, y, 66, 72, { stroke: sel ? TC.orange : g ? RARITY_COLOR[g.rarity] : TC.navy, radius: 14 }, () => {
        this.slot = s;
        this.sel = null;
        this.redraw();
      });
      const ic = this.add.graphics().setDepth(5);
      drawIcon(ic, s, x + 33, y + 20, 24, sel ? TC.orange : g ? RARITY_COLOR[g.rarity] : TC.blue);
      this.dyn.push(ic);
      this.label(x + 33, y + 40, SLOT_LABEL[s], 10, sel ? TC.orange : TC.navy).setDepth(6);
      this.label(x + 33, y + 51, g ? g.name.split(' ')[0] : 'EMPTY', 9, TC.sub).setDepth(6);
      if (g) this.label(x + 33, y + 62, tierOf(g).toUpperCase(), 9, RARITY_COLOR[g.rarity], 0.5, true).setDepth(6);
      if (!sel && hasNewIn(inv, s, level)) this.star(x + 55, y + 12, 20);
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
        this.sel = null;
        this.redraw();
      });
      const dot = this.add.graphics();
      dot.fillStyle(parseInt(br.colors[1].slice(1), 16), 1);
      dot.fillRoundedRect(x + 6, y + 5, 39, 6, 3);
      this.dyn.push(dot);
      this.label(x + 25.5, y + 21, br.name.toUpperCase(), 8, sel ? TC.orange : TC.navy);
      this.label(x + 25.5, y + 32, `${own}/4`, 9, own > 0 ? TC.navy : TC.sub);
      if (hasNewInBrand(inv, this.slot, br.id, level)) this.star(x + 45, y + 4, 16);
    });
    const br = brandById(this.brand)!;
    this.label(WIDTH / 2, 382, `${br.name.toUpperCase()}: ${br.tag.toUpperCase()}`, 12, TC.blue);

    itemsOfBrand(this.slot, this.brand).forEach((it: GearItem, i) => {
      const y = 396 + i * 56;
      const owned = inv.owned.includes(it.id);
      const usable = owned && level >= it.minLevel;
      const on = inv.equipped[this.slot] === it.id;
      const status = !owned ? 'NOT OWNED' : level < it.minLevel ? `LEVEL ${it.minLevel}` : on ? 'WORN' : '';
      const picked = this.sel === it.id;
      const g = this.tile(12, y, WIDTH - 24, 50, { stroke: picked ? TC.blue : on ? TC.orange : TC.navy, radius: 14, fill: usable ? TC.white : 0xf1f4f9 }, () => {
        // a tap shows what the model does to the stats; the button on the row wears it
        this.sel = picked ? null : it.id;
        if (isNewItem(inv, it, level)) updateSave((d) => ({ ...d, profile: { ...d.profile, inventory: markItemSeen(d.profile.inventory, it.id) } }));
        this.redraw();
      });
      const rc = RARITY_COLOR[it.rarity];
      const tint = this.add.graphics();
      tint.fillStyle(rc, usable ? 1 : 0.5);
      tint.fillRoundedRect(12, y + 8, 6, 34, 3);
      const ic = this.add.graphics().setDepth(5);
      drawGear(ic, it, 44, y + 25, 38);
      if (!usable) ic.setAlpha(owned ? 0.5 : 0.36);
      this.dyn.push(tint, ic);
      const name = this.label(66, y + 17, it.name, 14, usable ? TC.navy : TC.sub, 0, true);
      this.label(66, y + 36, bonusText(it.bonus), 11, usable ? TC.orange : TC.sub, 0);
      if (isNewItem(inv, it, level)) this.star(66 + name.width + 14, y + 15, 18);
      if (picked && usable) {
        // WEAR / REMOVE: the button that changes the equipment
        const text = on ? 'REMOVE' : 'WEAR';
        const bw = 74;
        const btn = this.add.graphics().setDepth(7);
        btn.fillStyle(on ? TC.track : TC.green, 1);
        btn.fillRoundedRect(WIDTH - 24 - bw, y + 11, bw, 28, 14);
        btn.lineStyle(2, TC.navy, 1);
        btn.strokeRoundedRect(WIDTH - 24 - bw, y + 11, bw, 28, 14);
        const bz = this.add.zone(WIDTH - 24 - bw / 2, y + 25, bw + 6, 40).setInteractive({ useHandCursor: true }).setDepth(8);
        bz.on('pointerdown', () => {
          sfx('select');
          this.sel = null;
          this.save((v) => (on ? unequip(v, this.slot) : equip(v, it.id, level)));
        });
        this.dyn.push(btn, bz);
        this.label(WIDTH - 24 - bw / 2, y + 25, text, 12, on ? TC.navy : TC.white).setDepth(9);
      } else if (status) {
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
    this.label(WIDTH / 2, 626, 'TAP A MODEL TO TRY IT ON, THEN WEAR IT', 10, TC.sub);
  }
}
