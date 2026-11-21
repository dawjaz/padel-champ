import Phaser from 'phaser';
import { ensureCharacterTexture } from '../art/characterTexture';
import { HD_CHARACTER_SCALE } from '../art/hd/characterHd';
import { drawIcon } from '../art/icons';
import { COLORS, css, FONT, HD_SCALE, WIDTH } from '../config';
import { gearBonus } from '../career/gear';
import { canSpend, freePoints, levelOf, levelProgress, respec, spend, statCap, statValue, xpToReach } from '../career/profile';
import levels from '../data/levels.json';
import playersData from '../data/players.json';
import { STAT_KEYS } from '../game/attributes';
import type { PlayerDef, StatKey } from '../game/types';
import { applyScreen } from '../hd';
import { tournamentActive } from '../career/careerFlow';
import { getSave, updateSave } from '../save';
import { logoText, makeButton } from '../ui';

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
  spin: 'curve and bounce, vibora',
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
    applyScreen(this);
    logoText(this, WIDTH / 2, 34, 'HERO', 34, COLORS.yellow);
    const key = ensureCharacterTexture(this, HERO.appearance, 'front');
    this.add.image(58, 150, key).setOrigin(0.5, 1).setScale(1.9 / HD_CHARACTER_SCALE);
    makeButton(this, 62, 596, 104, 44, 'RESET', () => {
      updateSave((d) => ({ ...d, profile: respec(d.profile) }));
      this.redraw();
    });
    makeButton(this, WIDTH / 2, 596, 104, 44, 'GEAR', () => this.scene.start('GearScene'));
    makeButton(this, WIDTH - 62, 596, 104, 44, 'BACK', () => this.scene.start('TitleScene'));
    this.redraw();
  }

  private text(x: number, y: number, str: string, size: number, color: number, bold = false, originX = 0.5): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, str, { fontFamily: FONT, resolution: HD_SCALE, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: css(color) })
      .setOrigin(originX, 0.5);
    this.dyn.push(t);
    return t;
  }

  private redraw(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const p = getSave().profile;
    const level = levelOf(p.xp);
    const free = freePoints(p);

    this.text(110, 96, `${HERO.name.toUpperCase()}  LEVEL ${level}`, 18, COLORS.white, true, 0);
    const bar = this.add.rectangle(110, 122, 200, 10, 0x000000, 0.5).setOrigin(0, 0.5).setStrokeStyle(1, COLORS.white);
    this.dyn.push(bar);
    const w = Math.round(198 * levelProgress(p.xp));
    if (w > 0) this.dyn.push(this.add.rectangle(111, 122, w, 8, COLORS.sky).setOrigin(0, 0.5));
    const next = level >= levels.maxLevel ? 'MAX LEVEL' : `XP ${p.xp} / ${xpToReach(level + 1)}`;
    this.text(110, 142, next, 11, COLORS.gray, false, 0);
    this.text(310, 142, `COINS ${p.coins}`, 12, COLORS.yellow, true, 1);

    this.text(WIDTH / 2, 186, free > 0 ? `${free} SKILL POINT${free === 1 ? '' : 'S'} TO SPEND` : 'NO FREE SKILL POINTS', 14, free > 0 ? COLORS.yellow : COLORS.gray, true);

    const cap = statCap(level);
    const gear = gearBonus(p.inventory);
    STAT_KEYS.forEach((k, i) => {
      const y = 232 + i * 48;
      const v = statValue(p, k);
      const ic = this.add.graphics();
      drawIcon(ic, k, 30, y, 24, COLORS.sky);
      this.dyn.push(ic);
      this.text(48, y - 8, LABEL[k], 14, COLORS.white, true, 0);
      this.text(48, y + 9, HINT[k], 10, COLORS.gray, false, 0);
      const g = this.add.graphics();
      this.dyn.push(g);
      for (let s = 0; s < levels.statMax; s++) {
        const x = 138 + s * 14;
        const filled = s < v;
        g.fillStyle(filled ? COLORS.sky : 0x000000, filled ? 1 : 0.45);
        g.fillRect(x, y - 9, 11, 18);
        if (s >= cap) {
          g.fillStyle(COLORS.red, 0.35);
          g.fillRect(x, y - 9, 11, 18);
        }
      }
      this.text(280, y, String(v), 14, COLORS.white, true, 0.5);
      if (gear[k] > 0) this.text(296, y, `+${gear[k]}`, 12, COLORS.yellow, true, 0);
      const ok = canSpend(p, k);
      const b = makeButton(this, 330, y, 36, 36, '+', () => {
        updateSave((d) => ({ ...d, profile: spend(d.profile, k) }));
        this.redraw();
      });
      b.setAccent(ok ? COLORS.yellow : COLORS.gray);
      b.text.setAlpha(ok ? 1 : 0.35);
      if (!ok) b.bg.disableInteractive();
      this.dyn.push(...b.parts);
    });
    this.text(WIDTH / 2, 566, `RED SEGMENTS UNLOCK WITH LEVEL (CAP NOW ${cap})`, 10, COLORS.gray);
  }
}
