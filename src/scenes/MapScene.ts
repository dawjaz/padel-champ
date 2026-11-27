import Phaser from 'phaser';
import { T } from '../i18n';
import { WIDTH } from '../config';
import { COURT_THEMES, themeIdOfCity } from '../art/hd/courtThemes';
import { eventName, eventsOfWeek, WEEKS } from '../career/season';
import { drawWeekMap, hexOf as hex } from './weekMap';
import { divisionById } from '../career/tournament';
import { getSave } from '../save';
import { applyLightScreen, drawCard, drawCoin, makeThemeButton, screenHeader, TC, themeText } from '../theme';


/** The career calendar as a world map: arrows move through the weeks, the cities of the week's tournaments light up in the colour of their court. */
export class MapScene extends Phaser.Scene {
  private week = 1;
  private dyn: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('MapScene');
  }

  create(): void {
    applyLightScreen(this);
    this.week = getSave().profile.career.week;
    this.redraw();
  }

  private redraw(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    this.tweens.killAll();
    const now = getSave().profile.career.week;
    const before = this.children.length;
    screenHeader(this, 'Map', { onBack: () => this.scene.start('CalendarScene'), coins: getSave().profile.coins });
    this.dyn.push(...this.children.list.slice(before));
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.dyn.push(o);
      return o;
    };

    const events = eventsOfWeek(this.week);
    this.dyn.push(...drawWeekMap(this, events, { x: 12, y: 70, w: WIDTH - 24, h: 212 }));
    if (events.length === 0) add(themeText(this, WIDTH / 2, 176, 'NO TOURNAMENTS THIS WEEK', { size: 13, color: TC.sub, font: 'display' }));

    // Week arrows.
    const arrow = (x: number, label: string, to: number): void => {
      const b = makeThemeButton(this, x, 306, 56, 34, label, () => {
        this.week = Math.max(1, Math.min(WEEKS, to));
        this.redraw();
      }, 'blue', 18);
      if (to < 1 || to > WEEKS) b.text.setAlpha(0.4);
      this.dyn.push(...b.parts);
    };
    arrow(44, '<', this.week - 1);
    arrow(WIDTH - 44, '>', this.week + 1);
    add(themeText(this, WIDTH / 2, 298, T('WEEK {0}/{1}', this.week, WEEKS), { size: 17, font: 'display' }));
    add(themeText(this, WIDTH / 2, 318, this.week === now ? 'THIS WEEK' : this.week < now ? 'ALREADY PLAYED' : T('IN {0} WEEK{1}', this.week - now, this.week - now === 1 ? '' : 'S'), { size: 11, color: this.week === now ? TC.orange : TC.sub, font: 'display' }));

    // The tournaments of the week as a list.
    events.forEach((e, i) => {
      const y = 342 + i * 58;
      const div = divisionById(e.division);
      const g = add(this.add.graphics().setPosition(12, y));
      drawCard(g, WIDTH - 24, 50, { radius: 12 });
      const sw = add(this.add.graphics());
      const th = COURT_THEMES[themeIdOfCity(e.city)];
      sw.fillGradientStyle(hex(th.top), hex(th.top), hex(th.bottom), hex(th.bottom), 1);
      sw.fillRoundedRect(22, y + 9, 32, 32, 8);
      sw.lineStyle(2, TC.navy, 1);
      sw.strokeRoundedRect(22, y + 9, 32, 32, 8);
      add(themeText(this, 64, y + 17, eventName(e).toUpperCase(), { size: 13, font: 'display', origin: [0, 0.5] }));
      const pairs = add(themeText(this, 64, y + 36, T('{0} PAIRS', div?.draw ?? '?'), { size: 11, color: TC.sub, origin: [0, 0.5] }));
      const fx = 64 + pairs.width + 16;
      add(themeText(this, fx, y + 36, 'ENTRY FEE', { size: 11, color: TC.sub, origin: [0, 0.5] }));
      const fee = add(themeText(this, fx + 66, y + 36, `${div?.fee ?? '?'}`, { size: 13, font: 'display', origin: [0, 0.5] }));
      const coin = add(this.add.graphics());
      drawCoin(coin, fx + 66 + fee.width + 11, y + 36, 8);
    });

    add(themeText(this, WIDTH / 2, 618, 'THE DOT COLOUR IS THE COLOUR OF THE COURT THERE', { size: 10, color: TC.sub, font: 'display' }));
  }
}
