import Phaser from 'phaser';
import { WIDTH } from '../config';
import { COURT_THEMES, themeIdOfCity } from '../art/hd/courtThemes';
import { cityPosition, LAND, projectLonLat, type Frame } from '../art/worldMap';
import { EVENTS, eventName, eventsOfWeek, WEEKS } from '../career/season';
import { divisionById } from '../career/tournament';
import { getSave } from '../save';
import { applyLightScreen, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

const FRAME: Frame = { x: 18, y: 78, w: 324, h: 196 };
const hex = (css: string): number => parseInt(css.slice(1), 16);

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

    // The map card: ocean, land, every tournament city as a small dot.
    const card = add(this.add.graphics().setPosition(12, 70));
    drawCard(card, WIDTH - 24, 212, { radius: 16, fill: 0xdcebfb });
    const land = add(this.add.graphics());
    land.fillStyle(0xb9d2ee, 1);
    land.lineStyle(1.5, 0x8fb0d8, 1);
    for (const poly of LAND) {
      const pts = poly.map((p) => projectLonLat(p, FRAME));
      land.fillPoints(pts, true);
      land.strokePoints(pts, true);
    }
    const dots = add(this.add.graphics());
    const cities = new Set(EVENTS.map((e) => e.city));
    dots.fillStyle(TC.navy, 0.35);
    for (const c of cities) {
      const p = cityPosition(c, FRAME);
      if (p) dots.fillCircle(p.x, p.y, 2.4);
    }

    // The tournaments of the viewed week: big dots in the court colour with the city name.
    const events = eventsOfWeek(this.week);
    events.forEach((e, i) => {
      const p = cityPosition(e.city, FRAME);
      if (!p) return;
      const colour = hex(COURT_THEMES[themeIdOfCity(e.city)].top);
      const ring = add(this.add.circle(p.x, p.y, 9, colour, 0.25));
      this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 1100, repeat: -1 });
      const dot = add(this.add.graphics());
      dot.fillStyle(0xffffff, 1);
      dot.fillCircle(p.x, p.y, 7);
      dot.fillStyle(colour, 1);
      dot.fillCircle(p.x, p.y, 5);
      dot.lineStyle(2, TC.navy, 1);
      dot.strokeCircle(p.x, p.y, 7);
      // Names alternate above and below so that neighbouring cities do not cover each other.
      const above = i % 2 === 0;
      const t = add(themeText(this, Math.max(34, Math.min(WIDTH - 34, p.x)), p.y + (above ? -17 : 17), e.city.toUpperCase(), { size: 10, font: 'display', origin: [0.5, 0.5] }));
      t.setStroke('#ffffff', 4);
    });
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
    add(themeText(this, WIDTH / 2, 298, `WEEK ${this.week}/${WEEKS}`, { size: 17, font: 'display' }));
    add(themeText(this, WIDTH / 2, 318, this.week === now ? 'THIS WEEK' : this.week < now ? 'ALREADY PLAYED' : `IN ${this.week - now} WEEK${this.week - now === 1 ? '' : 'S'}`, { size: 11, color: this.week === now ? TC.orange : TC.sub, font: 'display' }));

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
      add(themeText(this, 64, y + 36, `${div?.draw ?? '?'} PAIRS   FEE ${div?.fee ?? '?'}`, { size: 11, color: TC.sub, origin: [0, 0.5] }));
    });

    add(themeText(this, WIDTH / 2, 618, 'THE DOT COLOUR IS THE COLOUR OF THE COURT THERE', { size: 10, color: TC.sub, font: 'display' }));
  }
}
