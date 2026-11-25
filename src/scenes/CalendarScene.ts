import Phaser from 'phaser';
import { WIDTH } from '../config';
import { activeBracket, enterEvent, entryCheck, skipWeek, tournamentActive } from '../career/careerFlow';
import { levelOf } from '../career/profile';
import { campNow } from '../career/camp';
import { eventName, eventsOfWeek, partnerById, WEEKS } from '../career/season';
import { divisionById } from '../career/tournament';
import { getSave, updateSave } from '../save';
import { applyLightScreen, drawCard, drawCoin, makeThemeButton, screenHeader, TC, themeText } from '../theme';
import { courtColour, drawWeekMap } from './weekMap';

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

  private button(x: number, y: number, w: number, h: number, text: string, size: number, kind: 'primary' | 'secondary' | 'blue', onClick: () => void, dim = false): Phaser.GameObjects.Text {
    const b = makeThemeButton(this, x, y, w, h, text, onClick, kind, size);
    if (dim) b.text.setAlpha(0.5);
    this.dyn.push(...b.parts);
    return b.text;
  }

  /** The second line of an event button: pairs, the entry fee with a coin icon, and the status, centred in one row. */
  private feeRow(cy: number, pairs: number, fee: number, status: string, color: number, alpha: number): void {
    const mk = (str: string, bold = false): Phaser.GameObjects.Text => {
      const t = themeText(this, 0, cy, str, { size: 11, color, origin: [0, 0.5], font: bold ? 'display' : 'body' }).setAlpha(alpha);
      this.dyn.push(t);
      return t;
    };
    const a = mk(`${pairs} PAIRS`);
    const b = mk('ENTRY FEE');
    const n = mk(`${fee}`, true);
    const c = mk(status);
    const coin = 8;
    const total = a.width + 14 + b.width + 6 + coin * 2 + 3 + n.width + 14 + c.width;
    let x = WIDTH / 2 - total / 2;
    a.x = x;
    x += a.width + 14;
    b.x = x;
    x += b.width + 6;
    const g = this.add.graphics().setAlpha(alpha);
    drawCoin(g, x + coin, cy, coin);
    this.dyn.push(g);
    x += coin * 2 + 3;
    n.x = x;
    x += n.width + 14;
    c.x = x;
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
    this.label(26, 106, `RANKING ${c.rankPoints}  TITLES ${c.titles}`, 11, TC.sub, 0);
    this.label(WIDTH - 26, 84, `LEVEL ${level}`, 13, TC.orange, 1, true);
    const partner = partnerById(c.partnerId);
    // The partner is chosen between tournaments only.
    const lockedPartner = tournamentActive(p);
    const pText = `WITH ${(partner?.name ?? '-').toUpperCase()}`;
    const pw = Math.max(80, pText.length * 7.2 + 16);
    this.button(WIDTH - 26 - pw / 2, 104, pw, 22, pText, 11, lockedPartner ? 'secondary' : 'blue', () => {
      if (!lockedPartner) this.scene.start('PartnerScene');
    }, lockedPartner);
    this.button(WIDTH - 26 - pw - 6 - 27, 104, 54, 22, 'RANKS', 11, 'blue', () => this.scene.start('RankingScene'));

    // The week's tournaments on the map (a touch opens the full map, with the other weeks).
    const mapCard = { x: 12, y: 132, w: WIDTH - 24, h: 116 };
    this.dyn.push(...drawWeekMap(this, eventsOfWeek(c.week), mapCard, true));
    const mapHit = this.add.zone(mapCard.x, mapCard.y, mapCard.w, mapCard.h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    mapHit.on('pointerup', () => this.scene.start('MapScene'));
    this.dyn.push(mapHit);
    const full = this.label(mapCard.x + mapCard.w - 10, mapCard.y + mapCard.h - 10, 'FULL MAP >', 10, TC.navy, 1, true);
    full.setStroke('#ffffff', 3);

    let y = 262;
    if (c.active) {
      const b = activeBracket(p);
      this.label(WIDTH / 2, y, 'TOURNAMENT IN PROGRESS', 13, TC.navy, 0.5, true);
      this.button(WIDTH / 2, y + 38, 336, 52, `CONTINUE: ${b ? b.division.name.toUpperCase() : ''}`, 16, 'primary', () => this.scene.start('BracketScene'));
      y += 90;
    } else {
      this.label(WIDTH / 2, y, `THIS WEEK'S EVENTS`, 13, TC.navy, 0.5, true);
      y += 12;
      for (const e of eventsOfWeek(c.week)) {
        const problem = entryCheck(p, e);
        const div = divisionById(e.division)!;
        const name = this.button(WIDTH / 2, y + 23, 336, 44, eventName(e).toUpperCase(), 12, problem ? 'secondary' : 'primary', () => {
          if (problem) return;
          const next = enterEvent(getSave().profile, e.id, Math.floor(Math.random() * 1e9));
          if (!next) return;
          updateSave((d) => ({ ...d, profile: next }));
          this.scene.start('BracketScene');
        }, !!problem);
        name.y = y + 15;
        this.feeRow(y + 32, div.draw, div.fee, problem ? problem.toUpperCase() : 'TAP TO ENTER', problem ? TC.navy : TC.white, problem ? 0.5 : 1);
        // the colour of its dot on the map
        const sw = this.add.graphics();
        sw.fillStyle(0xffffff, 1).fillCircle(30, y + 23, 7);
        sw.fillStyle(courtColour(e.city), problem ? 0.5 : 1).fillCircle(30, y + 23, 5);
        sw.lineStyle(2, TC.navy, problem ? 0.5 : 1).strokeCircle(30, y + 23, 7);
        this.dyn.push(sw);
        y += 50;
      }
      // A week without a tournament: the training camp (minigames) or skip it.
      const tries = campNow(p).triesLeft;
      this.button(WIDTH / 2 - 86, y + 18, 164, 34, `TRAINING CAMP (${tries})`, 12, 'blue', () => this.scene.start('CampScene'));
      this.button(WIDTH / 2 + 86, y + 18, 164, 34, 'SKIP THIS WEEK', 12, 'secondary', () => {
        updateSave((d) => ({ ...d, profile: skipWeek(d.profile) }));
        this.redraw();
      });
      y += 44;
    }

    // the last results, as many as fit
    const room = Math.min(4, Math.floor((632 - (y + 30)) / 17) + 1);
    if (c.history.length > 0 && room > 0) {
      this.label(WIDTH / 2, y + 8, 'LAST RESULTS', 12, TC.navy, 0.5, true);
      c.history.slice(-room).reverse().forEach((h, i) => {
        const text = `${h.champion ? '* CHAMPION' : `${h.roundsWon} ROUND${h.roundsWon === 1 ? '' : 'S'}`}   ${h.event.toUpperCase()}`;
        this.label(20, y + 30 + i * 17, text, 11, h.champion ? TC.orange : TC.sub, 0);
      });
    }
  }
}
