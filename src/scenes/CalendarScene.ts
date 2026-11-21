import Phaser from 'phaser';
import { COLORS, css, FONT, HD_SCALE, WIDTH } from '../config';
import { activeBracket, enterEvent, entryCheck, skipWeek, tournamentActive } from '../career/careerFlow';
import { levelOf } from '../career/profile';
import { eventName, eventsOfWeek, partnerById, WEEKS } from '../career/season';
import { divisionById } from '../career/tournament';
import { applyScreen } from '../hd';
import { getSave, updateSave } from '../save';
import { logoText, makeButton } from '../ui';

/** The career hub: the week of the season, the events you can enter, partner, ranking. */
export class CalendarScene extends Phaser.Scene {
  private dyn: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('CalendarScene');
  }

  create(): void {
    applyScreen(this);
    logoText(this, WIDTH / 2, 30, 'CAREER', 30, COLORS.yellow);
    makeButton(this, WIDTH / 2, 608, 160, 40, 'BACK', () => this.scene.start('TitleScene'));
    this.redraw();
  }

  private label(x: number, y: number, str: string, size: number, color: number, bold = false, originX = 0.5): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, str, { fontFamily: FONT, resolution: HD_SCALE, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: css(color), align: originX === 0.5 ? 'center' : 'left' })
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

  private redraw(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const p = getSave().profile;
    const c = p.career;
    const level = levelOf(p.xp);

    this.label(16, 64, `SEASON ${c.season}   WEEK ${c.week}/${WEEKS}`, 13, COLORS.white, true, 0);
    this.label(WIDTH - 16, 64, `COINS ${p.coins}`, 13, COLORS.yellow, true, 1);
    this.label(16, 84, `RANKING ${c.rankPoints}   TITLES ${c.titles}`, 11, COLORS.sky, false, 0);
    this.label(WIDTH - 16, 84, `LEVEL ${level}`, 11, COLORS.gray, false, 1);

    let y = 126;
    if (c.active) {
      const b = activeBracket(p);
      this.label(WIDTH / 2, y, 'TOURNAMENT IN PROGRESS', 12, COLORS.gray, true);
      this.button(WIDTH / 2, y + 34, 330, 44, `CONTINUE: ${b ? b.division.name.toUpperCase() : ''}`, 15, COLORS.yellow, () => this.scene.start('BracketScene'));
      y += 90;
    } else {
      this.label(WIDTH / 2, y, `THIS WEEK'S EVENTS`, 12, COLORS.gray, true);
      y += 22;
      for (const e of eventsOfWeek(c.week)) {
        const problem = entryCheck(p, e);
        const div = divisionById(e.division)!;
        const text = `${eventName(e).toUpperCase()}\n${div.draw} PAIRS  FEE ${div.fee}  ${problem ? problem.toUpperCase() : 'TAP TO ENTER'}`;
        this.button(WIDTH / 2, y + 26, 330, 52, text, 11, problem ? COLORS.gray : COLORS.yellow, () => {
          if (problem) return;
          const next = enterEvent(getSave().profile, e.id, Math.floor(Math.random() * 1e9));
          if (!next) return;
          updateSave((d) => ({ ...d, profile: next }));
          this.scene.start('BracketScene');
        }, !!problem);
        y += 60;
      }
      this.button(WIDTH / 2, y + 20, 330, 34, 'SKIP THIS WEEK', 12, COLORS.gray, () => {
        updateSave((d) => ({ ...d, profile: skipWeek(d.profile) }));
        this.redraw();
      });
      y += 52;
    }

    const partner = partnerById(c.partnerId);
    // The partner is chosen between tournaments only.
    const lockedPartner = tournamentActive(p);
    this.button(WIDTH / 2, y + 20, 330, 38, `PARTNER: ${(partner?.name ?? '-').toUpperCase()}${lockedPartner ? '  (LOCKED)' : ''}`, 13, lockedPartner ? COLORS.gray : COLORS.sky, () => {
      if (!lockedPartner) this.scene.start('PartnerScene');
    }, lockedPartner);
    y += 56;

    if (c.history.length > 0) {
      this.label(WIDTH / 2, y + 6, 'LAST RESULTS', 11, COLORS.gray, true);
      c.history.slice(-4).reverse().forEach((h, i) => {
        const text = `${h.champion ? '* CHAMPION' : `${h.roundsWon} ROUND${h.roundsWon === 1 ? '' : 'S'}`}   ${h.event.toUpperCase()}`;
        this.label(16, y + 28 + i * 16, text, 10, h.champion ? COLORS.yellow : COLORS.white, false, 0);
      });
    }
  }
}
