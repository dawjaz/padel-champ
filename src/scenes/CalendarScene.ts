import Phaser from 'phaser';
import { WIDTH } from '../config';
import { activeBracket, enterEvent, entryCheck, skipWeek, tournamentActive } from '../career/careerFlow';
import { levelOf } from '../career/profile';
import { eventName, eventsOfWeek, partnerById, WEEKS } from '../career/season';
import { divisionById } from '../career/tournament';
import { getSave, updateSave } from '../save';
import { applyLightScreen, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

/** The career hub: the week of the season, the events you can enter, partner, ranking. */
export class CalendarScene extends Phaser.Scene {
  private dyn: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('CalendarScene');
  }

  create(): void {
    applyLightScreen(this);
    this.redraw();
  }

  private label(x: number, y: number, str: string, size: number, color: number, originX = 0.5, display = false): Phaser.GameObjects.Text {
    const t = themeText(this, x, y, str, { size, color, origin: [originX, 0.5], font: display ? 'display' : 'body', align: originX === 0.5 ? 'center' : 'left' });
    this.dyn.push(t);
    return t;
  }

  private button(x: number, y: number, w: number, h: number, text: string, size: number, kind: 'primary' | 'secondary' | 'blue', onClick: () => void, dim = false): void {
    const b = makeThemeButton(this, x, y, w, h, text, onClick, kind, size);
    if (dim) b.text.setAlpha(0.5);
    this.dyn.push(...b.parts);
  }

  private redraw(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const p = getSave().profile;
    const c = p.career;
    const level = levelOf(p.xp);
    const before = this.children.length;
    screenHeader(this, 'Career', { onBack: () => this.scene.start('TitleScene'), coins: p.coins });
    this.dyn.push(...this.children.list.slice(before));

    // Season card
    const sc = this.add.graphics().setPosition(12, 68);
    drawCard(sc, WIDTH - 24, 56, { radius: 14 });
    this.dyn.push(sc);
    this.label(26, 84, `SEASON ${c.season}   WEEK ${c.week}/${WEEKS}`, 16, TC.navy, 0, true);
    this.label(26, 107, `RANKING ${c.rankPoints}   TITLES ${c.titles}`, 12, TC.sub, 0);
    this.label(WIDTH - 26, 84, `LEVEL ${level}`, 13, TC.orange, 1, true);
    this.button(WIDTH - 58, 104, 70, 22, 'MAP', 11, 'blue', () => this.scene.start('MapScene'));

    let y = 140;
    if (c.active) {
      const b = activeBracket(p);
      this.label(WIDTH / 2, y, 'TOURNAMENT IN PROGRESS', 13, TC.navy, 0.5, true);
      this.button(WIDTH / 2, y + 38, 336, 52, `CONTINUE: ${b ? b.division.name.toUpperCase() : ''}`, 16, 'primary', () => this.scene.start('BracketScene'));
      y += 90;
    } else {
      this.label(WIDTH / 2, y, `THIS WEEK'S EVENTS`, 13, TC.navy, 0.5, true);
      y += 18;
      for (const e of eventsOfWeek(c.week)) {
        const problem = entryCheck(p, e);
        const div = divisionById(e.division)!;
        const text = `${eventName(e).toUpperCase()}\n${div.draw} PAIRS  FEE ${div.fee}  ${problem ? problem.toUpperCase() : 'TAP TO ENTER'}`;
        this.button(WIDTH / 2, y + 28, 336, 56, text, 12, problem ? 'secondary' : 'primary', () => {
          if (problem) return;
          const next = enterEvent(getSave().profile, e.id, Math.floor(Math.random() * 1e9));
          if (!next) return;
          updateSave((d) => ({ ...d, profile: next }));
          this.scene.start('BracketScene');
        }, !!problem);
        y += 64;
      }
      this.button(WIDTH / 2, y + 20, 336, 36, 'SKIP THIS WEEK', 13, 'secondary', () => {
        updateSave((d) => ({ ...d, profile: skipWeek(d.profile) }));
        this.redraw();
      });
      y += 52;
    }

    const partner = partnerById(c.partnerId);
    // The partner is chosen between tournaments only.
    const lockedPartner = tournamentActive(p);
    this.button(WIDTH / 2, y + 22, 336, 42, `PARTNER: ${(partner?.name ?? '-').toUpperCase()}${lockedPartner ? '  (LOCKED)' : ''}`, 14, lockedPartner ? 'secondary' : 'blue', () => {
      if (!lockedPartner) this.scene.start('PartnerScene');
    }, lockedPartner);
    y += 56;

    if (c.history.length > 0) {
      this.label(WIDTH / 2, y + 8, 'LAST RESULTS', 12, TC.navy, 0.5, true);
      c.history.slice(-4).reverse().forEach((h, i) => {
        const text = `${h.champion ? '* CHAMPION' : `${h.roundsWon} ROUND${h.roundsWon === 1 ? '' : 'S'}`}   ${h.event.toUpperCase()}`;
        this.label(20, y + 30 + i * 17, text, 11, h.champion ? TC.orange : TC.sub, 0);
      });
    }
  }
}
