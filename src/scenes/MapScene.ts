import Phaser from 'phaser';
import { WIDTH } from '../config';
import { COURT_THEMES, themeIdOfCity } from '../art/hd/courtThemes';
import { cityPosition, EUROPE_VIEW, landFor, placeLabels, projectLonLat, viewFor, type Frame, type LonLat } from '../art/worldMap';
import { EVENTS, eventName, eventsOfWeek, WEEKS } from '../career/season';
import { divisionById } from '../career/tournament';
import { getSave } from '../save';
import { applyLightScreen, drawCard, drawCoin, makeThemeButton, screenHeader, TC, themeText } from '../theme';

const FRAME: Frame = { x: 18, y: 78, w: 324, h: 196 };
const OCEAN = 0xdcebfb;
const LAND_FILL = 0xb9d2ee;
const LAND_LINE = 0x8fb0d8;
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

    // The map card: ocean, land, every tournament city as a small dot. When all tournaments of the week are in Europe the map
    // zooms there, so that neighbouring cities are apart.
    const events = eventsOfWeek(this.week);
    const view = viewFor(events.map((e) => e.city));
    const card = add(this.add.graphics().setPosition(12, 70));
    drawCard(card, WIDTH - 24, 212, { radius: 16, fill: OCEAN });
    const land = add(this.add.graphics());
    const toPts = (ring: LonLat[]): Phaser.Math.Vector2[] => ring.map((p) => { const q = projectLonLat(p, FRAME, view); return new Phaser.Math.Vector2(q.x, q.y); });
    const shapes = landFor(view);
    land.fillStyle(LAND_FILL, 1);
    for (const l of shapes) land.fillPoints(toPts(l.outer), true);
    land.fillStyle(OCEAN, 1); // lakes and inland seas (Black Sea, Caspian Sea)
    for (const l of shapes) for (const h of l.holes) land.fillPoints(toPts(h), true);
    land.lineStyle(1.2, LAND_LINE, 1);
    for (const l of shapes) {
      land.strokePoints(toPts(l.outer), true);
      for (const h of l.holes) land.strokePoints(toPts(h), true);
    }
    const weekCities = new Set(events.map((e) => e.city));
    const small: Array<{ x: number; y: number; r: number }> = [];
    const dots = add(this.add.graphics());
    dots.fillStyle(TC.navy, 0.4);
    for (const c of new Set(EVENTS.map((e) => e.city))) {
      if (weekCities.has(c)) continue;
      const p = cityPosition(c, FRAME, view);
      if (!p || p.x <= FRAME.x + 1 || p.x >= FRAME.x + FRAME.w - 1 || p.y <= FRAME.y + 1 || p.y >= FRAME.y + FRAME.h - 1) continue;
      dots.fillCircle(p.x, p.y, 2.6);
      small.push({ x: p.x, y: p.y, r: 3.5 });
    }

    // The tournaments of the viewed week: big dots in the court colour, with names placed so that nothing covers anything.
    // In the zoomed Europe view the dots are big; in the world view neighbours (Berlin, Warsaw) are only about 14 px apart, so they are smaller.
    const R = view === EUROPE_VIEW ? 7 : 5;
    const spots = events.flatMap((e) => {
      const p = cityPosition(e.city, FRAME, view);
      return p ? [{ e, p }] : [];
    });
    const texts = spots.map(({ e }) => {
      const t = add(themeText(this, 0, 0, e.city.toUpperCase(), { size: 10, font: 'display', origin: [0.5, 0.5] }));
      t.setStroke('#ffffff', 4);
      return t;
    });
    const places = placeLabels(spots.map(({ p }, i) => ({ x: p.x, y: p.y, r: R + 1, w: texts[i].width + 2, h: texts[i].height - 2 })), small, FRAME);
    const lines = add(this.add.graphics());
    lines.lineStyle(1.5, TC.navy, 0.8);
    spots.forEach(({ e, p }, i) => {
      const colour = hex(COURT_THEMES[themeIdOfCity(e.city)].top);
      const ring = add(this.add.circle(p.x, p.y, R + 2, colour, 0.25));
      this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 1100, repeat: -1 });
      if (places[i].leader) lines.lineBetween(...(places[i].leader as [number, number, number, number]));
      const dot = add(this.add.graphics());
      dot.fillStyle(0xffffff, 1);
      dot.fillCircle(p.x, p.y, R);
      dot.fillStyle(colour, 1);
      dot.fillCircle(p.x, p.y, R - 2);
      dot.lineStyle(2, TC.navy, 1);
      dot.strokeCircle(p.x, p.y, R);
      texts[i].setPosition(places[i].x, places[i].y);
      this.children.bringToTop(texts[i]);
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
      const pairs = add(themeText(this, 64, y + 36, `${div?.draw ?? '?'} PAIRS`, { size: 11, color: TC.sub, origin: [0, 0.5] }));
      const fx = 64 + pairs.width + 16;
      add(themeText(this, fx, y + 36, 'ENTRY FEE', { size: 11, color: TC.sub, origin: [0, 0.5] }));
      const fee = add(themeText(this, fx + 66, y + 36, `${div?.fee ?? '?'}`, { size: 13, font: 'display', origin: [0, 0.5] }));
      const coin = add(this.add.graphics());
      drawCoin(coin, fx + 66 + fee.width + 11, y + 36, 8);
    });

    add(themeText(this, WIDTH / 2, 618, 'THE DOT COLOUR IS THE COLOUR OF THE COURT THERE', { size: 10, color: TC.sub, font: 'display' }));
  }
}
