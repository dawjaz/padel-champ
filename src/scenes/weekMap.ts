import Phaser from 'phaser';
import { COURT_THEMES, themeIdOfCity } from '../art/hd/courtThemes';
import { cityPosition, EUROPE_VIEW, landFor, placeLabels, projectLonLat, viewFor, type Frame, type LonLat } from '../art/worldMap';
import { EVENTS, type CalendarEvent } from '../career/season';
import { drawCard, TC, themeText } from '../theme';

const OCEAN = 0xdcebfb;
const LAND_FILL = 0xb9d2ee;
const LAND_LINE = 0x8fb0d8;
export const hexOf = (css: string): number => parseInt(css.slice(1), 16);
/** The colour of a tournament's court (its dot on the map and its swatch in lists). */
export const courtColour = (city: string): number => hexOf(COURT_THEMES[themeIdOfCity(city)].top);

/**
 * The map card of one week's tournaments (shared by the Map screen and the Career screen): ocean, land, every calendar city as a small
 * dot, the week's cities as big pulsing dots in the colour of their court with their names placed so nothing covers anything. Zooms to
 * Europe when all of them are there. `card`: the card's rectangle; returns every object made (the caller destroys them on redraw).
 */
export function drawWeekMap(scene: Phaser.Scene, events: CalendarEvent[], card: Frame, compact = false): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    out.push(o);
    return o;
  };
  const frame: Frame = { x: card.x + 6, y: card.y + 8, w: card.w - 12, h: card.h - 16 };
  const view = viewFor(events.map((e) => e.city));
  const bg = add(scene.add.graphics().setPosition(card.x, card.y));
  drawCard(bg, card.w, card.h, { radius: compact ? 12 : 16, fill: OCEAN });
  const land = add(scene.add.graphics());
  const toPts = (ring: LonLat[]): Phaser.Math.Vector2[] => ring.map((p) => { const q = projectLonLat(p, frame, view); return new Phaser.Math.Vector2(q.x, q.y); });
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
  const inFrame = (p: { x: number; y: number }): boolean => p.x > frame.x + 1 && p.x < frame.x + frame.w - 1 && p.y > frame.y + 1 && p.y < frame.y + frame.h - 1;
  const weekCities = new Set(events.map((e) => e.city));
  const small: Array<{ x: number; y: number; r: number }> = [];
  const dots = add(scene.add.graphics());
  dots.fillStyle(TC.navy, 0.4);
  for (const c of new Set(EVENTS.map((e) => e.city))) {
    if (weekCities.has(c)) continue;
    const p = cityPosition(c, frame, view);
    if (!p || !inFrame(p)) continue;
    dots.fillCircle(p.x, p.y, compact ? 2 : 2.6);
    small.push({ x: p.x, y: p.y, r: compact ? 3 : 3.5 });
  }
  // In the zoomed Europe view the dots are big; in the world view neighbours (Berlin, Warsaw) are close, so they are smaller.
  const R = (view === EUROPE_VIEW ? 7 : 5) - (compact ? 1 : 0);
  const spots = events.flatMap((e) => {
    const p = cityPosition(e.city, frame, view);
    return p ? [{ e, p }] : [];
  });
  const texts = spots.map(({ e }) => {
    const t = add(themeText(scene, 0, 0, e.city.toUpperCase(), { size: compact ? 9 : 10, font: 'display', origin: [0.5, 0.5] }));
    t.setStroke('#ffffff', compact ? 3 : 4);
    return t;
  });
  const places = placeLabels(spots.map(({ p }, i) => ({ x: p.x, y: p.y, r: R + 1, w: texts[i].width + 2, h: texts[i].height - 2 })), small, frame);
  const lines = add(scene.add.graphics());
  lines.lineStyle(1.5, TC.navy, 0.8);
  spots.forEach(({ e, p }, i) => {
    const colour = courtColour(e.city);
    const ring = add(scene.add.circle(p.x, p.y, R + 2, colour, 0.25));
    scene.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 1100, repeat: -1 });
    if (places[i].leader) lines.lineBetween(...(places[i].leader as [number, number, number, number]));
    const dot = add(scene.add.graphics());
    dot.fillStyle(0xffffff, 1);
    dot.fillCircle(p.x, p.y, R);
    dot.fillStyle(colour, 1);
    dot.fillCircle(p.x, p.y, R - 2);
    dot.lineStyle(2, TC.navy, 1);
    dot.strokeCircle(p.x, p.y, R);
    texts[i].setPosition(places[i].x, places[i].y);
    scene.children.bringToTop(texts[i]);
  });
  return out;
}
