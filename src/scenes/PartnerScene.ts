import Phaser from 'phaser';
import { COLORS, css, FONT, HD_SCALE, WIDTH } from '../config';
import { buyPartner, choosePartner } from '../career/careerFlow';
import { PARTNERS } from '../career/season';
import { STAT_KEYS } from '../game/attributes';
import { applyScreen } from '../hd';
import { getSave, updateSave } from '../save';
import { logoText, makeButton } from '../ui';

const SHORT: Record<string, string> = { power: 'POW', spin: 'SPN', technique: 'TEC', accuracy: 'ACC', stamina: 'STA', speed: 'SPD', defense: 'DEF' };

const PER_PAGE = 5;

/** The roster of partners: buy with coins, then pick who plays next to you. */
export class PartnerScene extends Phaser.Scene {
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private page = 0;

  constructor() {
    super('PartnerScene');
  }

  create(): void {
    this.page = 0;
    applyScreen(this);
    logoText(this, WIDTH / 2, 30, 'PARTNER', 30, COLORS.yellow);
    makeButton(this, WIDTH / 2, 608, 160, 40, 'BACK', () => this.scene.start('CalendarScene'));
    this.redraw();
  }

  private redraw(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const p = getSave().profile;
    const text = (x: number, y: number, s: string, size: number, color: number, bold = false, ox = 0): void => {
      this.dyn.push(this.add.text(x, y, s, { fontFamily: FONT, resolution: HD_SCALE, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: css(color) }).setOrigin(ox, 0.5));
    };
    text(WIDTH - 16, 62, `COINS ${p.coins}`, 13, COLORS.yellow, true, 1);
    const pages = Math.ceil(PARTNERS.length / PER_PAGE);
    PARTNERS.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((def, i) => {
      const y = 100 + i * 94;
      const owned = p.career.partners.includes(def.id);
      const chosen = p.career.partnerId === def.id;
      const avg = STAT_KEYS.reduce((a, k) => a + def.stats[k], 0) / STAT_KEYS.length;
      const g = this.add.graphics();
      g.fillStyle(COLORS.panel, 0.9);
      g.fillRoundedRect(15, y - 42, 330, 84, 10);
      g.lineStyle(chosen ? 4 : 2, chosen ? COLORS.yellow : COLORS.white, chosen ? 1 : 0.5);
      g.strokeRoundedRect(15, y - 42, 330, 84, 10);
      this.dyn.push(g);
      text(28, y - 28, def.name.toUpperCase(), 15, COLORS.white, true);
      text(28, y - 8, `RATING ${avg.toFixed(1)}`, 11, COLORS.sky, true);
      text(28, y + 12, STAT_KEYS.slice(0, 4).map((k) => `${SHORT[k]} ${def.stats[k]}`).join('  '), 10, COLORS.gray);
      text(28, y + 28, STAT_KEYS.slice(4).map((k) => `${SHORT[k]} ${def.stats[k]}`).join('  '), 10, COLORS.gray);
      const label = chosen ? 'PLAYING' : owned ? 'SELECT' : `${def.price}`;
      const can = owned || p.coins >= def.price;
      const b = makeButton(this, 282, y, 100, 44, label, () => {
        if (!can || chosen) return;
        updateSave((d) => ({ ...d, profile: (owned ? choosePartner(d.profile, def.id) : buyPartner(d.profile, def.id)) ?? d.profile }));
        this.redraw();
      });
      b.text.setFontSize(14);
      b.setAccent(chosen ? COLORS.yellow : can ? COLORS.sky : COLORS.gray);
      b.text.setAlpha(can ? 1 : 0.4);
      this.dyn.push(...b.parts);
    });
    const prev = makeButton(this, 50, 562, 70, 36, '<', () => { this.page = (this.page + pages - 1) % pages; this.redraw(); });
    const next = makeButton(this, 310, 562, 70, 36, '>', () => { this.page = (this.page + 1) % pages; this.redraw(); });
    text(WIDTH / 2, 562, `${this.page + 1} / ${pages}`, 12, COLORS.white);
    this.dyn.push(...prev.parts, ...next.parts);
  }
}
