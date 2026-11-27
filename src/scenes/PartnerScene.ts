import Phaser from 'phaser';
import { T } from '../i18n';
import { addToonHead } from '../art/toonTexture';
import { drawIcon, type IconKind } from '../art/icons';
import { sfx } from '../audio';
import { WIDTH } from '../config';
import { buyPartner, choosePartner, tournamentActive } from '../career/careerFlow';
import { PARTNERS } from '../career/season';
import { levelOf } from '../career/profile';
import { shownStat, STAT_KEYS } from '../game/attributes';
import { showTip } from '../tutorial/tips';
import { getSave, updateSave } from '../save';
import { applyLightScreen, drawBar, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

const SHOWN: Array<[IconKind, 'power' | 'technique' | 'speed' | 'defense', string]> = [
  ['power', 'power', 'POW'],
  ['technique', 'technique', 'TEC'],
  ['speed', 'speed', 'SPD'],
  ['defense', 'defense', 'DEF'],
];
const TINTS = [0xffe3cc, 0xd4f5e3, 0xebddfb, 0xfadadf, 0xfff0bf, 0xd5e4ff];

const PER_PAGE = 6;

/** The roster of partners as tiles: tap one, then buy it or pick who plays next to you. */
export class PartnerScene extends Phaser.Scene {
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private page = 0;
  private sel = '';

  constructor() {
    super('PartnerScene');
  }

  create(): void {
    this.page = 0;
    // The partner can only be changed between tournaments.
    if (tournamentActive(getSave().profile)) {
      this.scene.start('CalendarScene');
      return;
    }
    this.sel = getSave().profile.career.partnerId;
    this.page = Math.floor(Math.max(0, PARTNERS.findIndex((d) => d.id === this.sel)) / PER_PAGE);
    applyLightScreen(this);
    this.redraw();
    this.time.delayedCall(250, () => showTip(this, 'partner'));
  }

  private redraw(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const p = getSave().profile;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.dyn.push(o);
      return o;
    };
    const text = (x: number, y: number, s: string, size: number, color: number, ox = 0.5, display = false): Phaser.GameObjects.Text =>
      add(themeText(this, x, y, s, { size, color, origin: [ox, 0.5], font: display ? 'display' : 'body' }));
    // The header is rebuilt with the current coin count, so its objects belong to the redrawn set.
    const before = this.children.length;
    screenHeader(this, 'Partners', { onBack: () => this.scene.start('CalendarScene'), coins: p.coins });
    this.dyn.push(...this.children.list.slice(before));

    const pages = Math.ceil(PARTNERS.length / PER_PAGE);
    const level = levelOf(p.xp);
    PARTNERS.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((def, i) => {
      const x = 12 + (i % 2) * 176;
      const y = 66 + Math.floor(i / 2) * 164;
      const owned = p.career.partners.includes(def.id);
      const chosen = p.career.partnerId === def.id;
      const selected = this.sel === def.id;
      const lvlOk = level >= def.minLevel;
      const avg = STAT_KEYS.reduce((a, k) => a + def.stats[k], 0) / STAT_KEYS.length;
      const g = add(this.add.graphics().setPosition(x, y));
      drawCard(g, 164, 156, { stroke: selected ? TC.orange : TC.navy, shadow: 3 });
      // Portrait on a tinted panel (greyed while the partner is out of reach).
      const pg = add(this.add.graphics());
      pg.fillStyle(TINTS[(this.page * PER_PAGE + i) % TINTS.length], 1);
      pg.fillRoundedRect(x + 3, y + 3, 158, 62, { tl: 13, tr: 13, bl: 0, br: 0 });
      pg.lineStyle(2.5, TC.navy, 1);
      pg.lineBetween(x + 2, y + 65, x + 162, y + 65);
      const head = add(addToonHead(this, x + 82, y + 6, 60, def.appearance, 'front', 0.92));
      if (!owned && !lvlOk) head.setTint(0x9aa7bb);
      // Rating badge.
      const rb = add(this.add.graphics());
      rb.fillStyle(TC.white, 1);
      rb.fillRoundedRect(x + 8, y + 8, 40, 20, 10);
      rb.lineStyle(2, TC.navy, 1);
      rb.strokeRoundedRect(x + 8, y + 8, 40, 20, 10);
      text(x + 28, y + 18, shownStat(avg).toFixed(1), 12, TC.navy);
      if (chosen || (!owned && !lvlOk)) {
        const chip = add(this.add.graphics());
        chip.fillStyle(chosen ? TC.green : TC.white, 1);
        chip.fillCircle(x + 146, y + 20, 12);
        chip.lineStyle(2, TC.navy, 1);
        chip.strokeCircle(x + 146, y + 20, 12);
        if (chosen) {
          chip.lineStyle(3, TC.white, 1);
          chip.beginPath();
          chip.moveTo(x + 140, y + 20);
          chip.lineTo(x + 145, y + 25);
          chip.lineTo(x + 153, y + 15);
          chip.strokePath();
        } else {
          chip.lineStyle(2.5, TC.navy, 1);
          chip.strokeRoundedRect(x + 141, y + 20, 10, 8, 2);
          chip.beginPath();
          chip.arc(x + 146, y + 20, 3.5, Math.PI, 0);
          chip.strokePath();
        }
      }
      // Name and state.
      text(x + 10, y + 79, def.name.toUpperCase(), 17, TC.navy, 0, true);
      if (def.nick) text(x + 10, y + 92, `"${T(def.nick.toUpperCase())}"`, 9, TC.orange, 0);
      const state = chosen ? 'PLAYING' : owned ? 'OWNED' : lvlOk ? `${def.price}` : T('LEVEL {0}', def.minLevel);
      const bw = state.length * 6.5 + 14;
      const sb = add(this.add.graphics());
      sb.fillStyle(chosen ? TC.blue : owned ? TC.track : lvlOk ? TC.gold : TC.track, 1);
      sb.fillRoundedRect(x + 154 - bw, y + 70, bw, 18, 9);
      sb.lineStyle(2, TC.navy, 1);
      sb.strokeRoundedRect(x + 154 - bw, y + 70, bw, 18, 9);
      text(x + 154 - bw / 2, y + 79, state, 9, chosen ? TC.white : TC.navy);
      // Four attribute bars.
      SHOWN.forEach(([icon, key, abbr], r) => {
        const ry = y + 99 + r * 14;
        const ic = add(this.add.graphics());
        drawIcon(ic, icon, x + 18, ry + 5, 11, TC.blue);
        text(x + 28, ry + 5, abbr, 9, TC.sub, 0);
        const b = add(this.add.graphics());
        drawBar(b, x + 56, ry, 78, 9, def.stats[key] / 10, TC.blue);
        text(x + 154, ry + 5, String(shownStat(def.stats[key])), 11, TC.navy, 1);
      });
      const z = add(this.add.zone(x + 82, y + 78, 164, 156).setInteractive({ useHandCursor: true }));
      z.on('pointerdown', () => {
        sfx('select');
        this.sel = def.id;
        this.redraw();
      });
    });

    // Footer: page arrows and the action for the selected partner.
    const foot = add(this.add.graphics());
    foot.fillStyle(TC.white, 1);
    foot.fillRect(0, 572, WIDTH, 68);
    foot.fillStyle(TC.navy, 1);
    foot.fillRect(0, 570, WIDTH, 3);
    const prev = makeThemeButton(this, 30, 606, 40, 40, '<', () => { this.page = (this.page + pages - 1) % pages; this.redraw(); }, 'secondary', 18);
    const next = makeThemeButton(this, 116, 606, 40, 40, '>', () => { this.page = (this.page + 1) % pages; this.redraw(); }, 'secondary', 18);
    this.dyn.push(...prev.parts, ...next.parts);
    text(73, 606, `${this.page + 1} / ${pages}`, 12, TC.navy);
    const def = PARTNERS.find((d) => d.id === this.sel) ?? PARTNERS[0];
    const owned = p.career.partners.includes(def.id);
    const chosen = p.career.partnerId === def.id;
    const lvlOk = level >= def.minLevel;
    const label = chosen ? 'PLAYING' : owned ? 'SELECT' : lvlOk ? T('BUY {0}', def.price) : T('LEVEL {0}', def.minLevel);
    const can = !chosen && (owned || (lvlOk && p.coins >= def.price));
    const act = makeThemeButton(this, 262, 606, 172, 44, `${def.name.toUpperCase()}: ${label}`, () => {
      if (!can) return;
      updateSave((d) => ({ ...d, profile: (owned ? choosePartner(d.profile, def.id) : buyPartner(d.profile, def.id)) ?? d.profile }));
      this.redraw();
    }, can ? 'primary' : 'secondary', 14);
    act.text.setAlpha(can || chosen ? 1 : 0.5);
    this.dyn.push(...act.parts);
  }
}
