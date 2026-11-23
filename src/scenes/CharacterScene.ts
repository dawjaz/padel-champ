import Phaser from 'phaser';
import { addToon } from '../art/toonTexture';
import { drawIcon } from '../art/icons';
import { WIDTH } from '../config';
import { applyLook, gearBonus } from '../career/gear';
import { canSpend, canUnspend, freePoints, levelOf, levelProgress, respec, spend, statCap, statValue, unspend, xpToReach } from '../career/profile';
import levels from '../data/levels.json';
import playersData from '../data/players.json';
import { STAT_KEYS } from '../game/attributes';
import type { PlayerDef, StatKey } from '../game/types';
import { tournamentActive } from '../career/careerFlow';
import { getSave, updateSave } from '../save';
import { applyLightScreen, drawBar, drawCard, drawXp, makeThemeButton, screenHeader, TC, themeText } from '../theme';

const HERO = (playersData.you as unknown as PlayerDef[])[0];

const LABEL: Record<StatKey, string> = {
  power: 'POWER',
  spin: 'SPIN',
  technique: 'TECHNIQUE',
  accuracy: 'ACCURACY',
  stamina: 'STAMINA',
  speed: 'SPEED',
  defense: 'DEFENSE',
};
const HINT: Record<StatKey, string> = {
  power: 'ball speed, hard shots',
  spin: 'curve, bounce, vibora',
  technique: 'fewer errors',
  accuracy: 'finds the gap',
  stamina: 'guts and recovery',
  speed: 'reaches more balls',
  defense: 'holds hard shots',
};

export class CharacterScene extends Phaser.Scene {
  private dyn: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('CharacterScene');
  }

  create(): void {
    // Upgrades, gear, packs and the shop are closed while a tournament is going on.
    if (tournamentActive(getSave().profile)) {
      this.scene.start('TitleScene');
      return;
    }
    applyLightScreen(this);
    screenHeader(this, 'Hero', { onBack: () => this.scene.start('TitleScene'), coins: getSave().profile.coins });
    makeThemeButton(this, 96, 614, 164, 40, 'RESET POINTS', () => {
      updateSave((d) => ({ ...d, profile: respec(d.profile) }));
      this.scene.restart();
    }, 'secondary', 15);
    makeThemeButton(this, WIDTH - 96, 614, 164, 40, 'GEAR', () => this.scene.start('GearScene'), 'blue', 17);
    this.redraw();
  }

  private text(x: number, y: number, str: string, size: number, color: number, originX = 0.5, display = false): Phaser.GameObjects.Text {
    const t = themeText(this, x, y, str, { size, color, origin: [originX, 0.5], font: display ? 'display' : 'body' });
    this.dyn.push(t);
    return t;
  }

  private redraw(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const p = getSave().profile;
    const level = levelOf(p.xp);
    const free = freePoints(p);

    // Top card: the hero, name, level badge, XP bar with numbers.
    const top = this.add.graphics().setPosition(12, 66);
    drawCard(top, WIDTH - 24, 92);
    this.dyn.push(top);
    this.dyn.push(addToon(this, 52, 150, 76, applyLook(HERO.appearance, p.inventory), 'front'));
    const name = this.text(100, 85, p.name.toUpperCase(), 22, TC.navy, 0, true);
    this.text(100, 103, `"${p.nick.toUpperCase()}"`, 11, TC.orange, 0);
    const bx = 100 + name.width + 8;
    const badge = this.add.graphics();
    badge.fillStyle(TC.gold, 1);
    badge.fillRoundedRect(bx, 74, 56, 22, 11);
    badge.lineStyle(2, TC.navy, 1);
    badge.strokeRoundedRect(bx, 74, 56, 22, 11);
    this.dyn.push(badge);
    this.text(bx + 28, 85, `LVL ${level}`, 12, TC.navy);
    const edit = makeThemeButton(this, 306, 105, 52, 20, 'EDIT', () => this.scene.start('NameEditScene', { back: 'CharacterScene' }), 'secondary', 11);
    this.dyn.push(...(edit.parts as Phaser.GameObjects.GameObject[]));
    const xpIcon = this.add.graphics();
    drawXp(xpIcon, 106, 123, 8);
    this.dyn.push(xpIcon);
    const xb = this.add.graphics();
    drawBar(xb, 120, 116, 130, 14, levelProgress(p.xp), TC.orange);
    this.dyn.push(xb);
    this.text(332, 123, level >= levels.maxLevel ? 'MAX' : `${p.xp.toLocaleString('en-US')} / ${xpToReach(level + 1).toLocaleString('en-US')}`, 11, TC.navy, 1);

    // Skill points ribbon.
    const ribbon = this.add.graphics();
    ribbon.fillStyle(free > 0 ? TC.orange : TC.track, 1);
    ribbon.fillRoundedRect(12, 168, WIDTH - 24, 24, 12);
    ribbon.lineStyle(2, TC.navy, 1);
    ribbon.strokeRoundedRect(12, 168, WIDTH - 24, 24, 12);
    this.dyn.push(ribbon);
    this.text(WIDTH / 2, 180, free > 0 ? `${free} SKILL POINT${free === 1 ? '' : 'S'} TO SPEND` : 'NO FREE SKILL POINTS', 13, free > 0 ? TC.white : TC.sub);

    const cap = statCap(level);
    const gear = gearBonus(p.inventory);
    const max = levels.statMax;
    STAT_KEYS.forEach((k, i) => {
      const y = 192 + i * 54;
      const v = statValue(p, k);
      const row = this.add.graphics().setPosition(12, y);
      drawCard(row, WIDTH - 24, 50, { radius: 14 });
      this.dyn.push(row);
      const ic = this.add.graphics();
      ic.fillStyle(TC.blue, 1);
      ic.fillRoundedRect(20, y + 8, 36, 36, 10);
      ic.lineStyle(2, TC.navy, 1);
      ic.strokeRoundedRect(20, y + 8, 36, 36, 10);
      drawIcon(ic, k, 38, y + 26, 22, TC.white);
      this.dyn.push(ic);
      this.text(64, y + 17, LABEL[k], 14, TC.navy, 0, true);
      this.text(64, y + 36, HINT[k], 10, TC.sub, 0);
      // Bar: value in blue, gear bonus in orange, the part above the level cap shaded.
      const bx0 = 168;
      const bw = 72;
      const g = this.add.graphics();
      drawBar(g, bx0, y + 20, bw, 14, v / max, TC.blue);
      const bonus = Math.min(gear[k], max - v);
      if (bonus > 0) {
        g.fillStyle(TC.orange, 1);
        g.fillRoundedRect(bx0 + 1 + (bw - 2) * (v / max), y + 21, (bw - 2) * (bonus / max), 12, 3);
      }
      if (cap < max) {
        g.fillStyle(TC.navy, 0.16);
        g.fillRect(bx0 + 1 + (bw - 2) * (cap / max), y + 21, (bw - 2) * (1 - cap / max), 12);
        g.lineStyle(2, TC.navy, 0.8);
        g.lineBetween(bx0 + 1 + (bw - 2) * (cap / max), y + 18, bx0 + 1 + (bw - 2) * (cap / max), y + 36);
      }
      this.dyn.push(g);
      this.text(246, y + 26, String(v), 16, TC.navy, 0, true);
      if (gear[k] > 0) this.text(260, y + 26, `+${gear[k]}`, 11, TC.orange, 0);
      const ok = canSpend(p, k);
      const b = makeThemeButton(this, 330, y + 25, 32, 36, '+', () => {
        updateSave((d) => ({ ...d, profile: spend(d.profile, k) }));
        this.redraw();
      }, ok ? 'primary' : 'secondary', 24);
      b.text.setAlpha(ok ? 1 : 0.35);
      if (!ok) b.bg.disableInteractive();
      this.dyn.push(...b.parts);
      const can = canUnspend(p, k);
      const m = makeThemeButton(this, 292, y + 25, 32, 36, '-', () => {
        updateSave((d) => ({ ...d, profile: unspend(d.profile, k) }));
        this.redraw();
      }, 'secondary', 24);
      m.text.setAlpha(can ? 1 : 0.3);
      if (!can) m.bg.disableInteractive();
      this.dyn.push(...m.parts);
    });
    this.text(WIDTH / 2, 580, `SHADED PART OF THE BAR UNLOCKS WITH LEVEL (CAP NOW ${cap})`, 10, TC.sub);
  }
}
