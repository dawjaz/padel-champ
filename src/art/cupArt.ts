// Draws a trophy cup with Phaser Graphics (paint it into a `bakedShape`, it is not meant to be redrawn every frame).
// The shape grows with the division, the metal says gold or silver (or locked: flat grey), the ribbon takes the colour of
// the city's court and the city has its own small emblem on the cup.

import type Phaser from 'phaser';
import { themeById, themeIdOfCity } from './hd/courtThemes';
import { DIVISIONS } from '../career/tournament';

export type Metal = 'gold' | 'silver' | 'locked';

const METALS: Record<Metal, { main: number; light: number; dark: number }> = {
  gold: { main: 0xf5c542, light: 0xffeb9a, dark: 0xb98410 },
  silver: { main: 0xc9d3de, light: 0xf6f9fc, dark: 0x7f8fa1 },
  locked: { main: 0xcdd3dc, light: 0xdde2e9, dark: 0xaeb6c2 },
};

const NAVY = 0x0b2a5b;

/** Court colour of a city as a number (the cup's ribbon and emblem). */
export function cityAccent(city: string): number {
  return parseInt(themeById(themeIdOfCity(city)).slabTop.replace('#', ''), 16) || 0x3a6ea5;
}

function poly(g: Phaser.GameObjects.Graphics, pts: Array<[number, number]>, ox: number, oy: number, k: number): void {
  g.fillPoints(pts.map(([x, y]) => ({ x: ox + x * k, y: oy + y * k })) as Phaser.Geom.Point[], true);
}

function emblem(g: Phaser.GameObjects.Graphics, symbol: string, ox: number, oy: number, k: number, col: number): void {
  g.fillStyle(col, 1);
  g.lineStyle(2 * k, col, 1);
  const c = (x: number, y: number, r: number): void => void g.fillCircle(ox + x * k, oy + y * k, r * k);
  const p = (pts: Array<[number, number]>): void => poly(g, pts, ox, oy, k);
  switch (symbol) {
    case 'drop': p([[0, -9], [6, 2], [0, 8], [-6, 2]]); c(0, 2, 6); break;
    case 'sun': c(0, 0, 5); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; g.lineBetween(ox + Math.cos(a) * 7 * k, oy + Math.sin(a) * 7 * k, ox + Math.cos(a) * 10 * k, oy + Math.sin(a) * 10 * k); } break;
    case 'column': g.fillRect(ox - 7 * k, oy - 9 * k, 14 * k, 3 * k); g.fillRect(ox - 5 * k, oy - 6 * k, 3 * k, 12 * k); g.fillRect(ox + 2 * k, oy - 6 * k, 3 * k, 12 * k); g.fillRect(ox - 7 * k, oy + 6 * k, 14 * k, 3 * k); break;
    case 'star': p([[0, -10], [3, -3], [10, -3], [4, 2], [6, 9], [0, 5], [-6, 9], [-4, 2], [-10, -3], [-3, -3]]); break;
    case 'wave': g.beginPath(); g.moveTo(ox - 9 * k, oy); for (let i = 0; i <= 18; i++) g.lineTo(ox + (-9 + i) * k, oy + Math.sin(i * 0.7) * 4 * k); g.strokePath(); g.beginPath(); g.moveTo(ox - 9 * k, oy + 6 * k); for (let i = 0; i <= 18; i++) g.lineTo(ox + (-9 + i) * k, oy + 6 * k + Math.sin(i * 0.7) * 4 * k); g.strokePath(); break;
    case 'crown': p([[-9, 6], [-9, -6], [-4, 0], [0, -8], [4, 0], [9, -6], [9, 6]]); break;
    case 'grape': c(-4, -4, 3.5); c(4, -4, 3.5); c(0, 1, 3.5); c(-4, 6, 3.5); c(4, 6, 3.5); break;
    case 'anchor': g.lineBetween(ox, oy - 8 * k, ox, oy + 8 * k); g.lineBetween(ox - 5 * k, oy - 4 * k, ox + 5 * k, oy - 4 * k); g.beginPath(); g.arc(ox, oy + 2 * k, 8 * k, 0.15 * Math.PI, 0.85 * Math.PI); g.strokePath(); break;
    case 'tower': p([[-2, -10], [2, -10], [5, 9], [-5, 9]]); g.fillRect(ox - 7 * k, oy + 7 * k, 14 * k, 3 * k); break;
    case 'mermaid': c(0, -6, 3); p([[-3, -3], [3, -3], [2, 5], [-2, 5]]); p([[0, 5], [6, 10], [0, 8], [-6, 10]]); break;
    case 'palm': g.lineBetween(ox, oy + 9 * k, ox, oy - 2 * k); for (let i = -2; i <= 2; i++) g.lineBetween(ox, oy - 2 * k, ox + i * 4.5 * k, oy - 8 * k + Math.abs(i) * 3 * k); break;
    case 'spire': p([[0, -11], [3, 0], [2, 9], [-2, 9], [-3, 0]]); break;
    case 'tulip': p([[-6, -6], [-3, -2], [0, -7], [3, -2], [6, -6], [5, 3], [0, 6], [-5, 3]]); g.lineBetween(ox, oy + 6 * k, ox, oy + 11 * k); break;
    case 'note': c(-3, 6, 3.5); g.lineBetween(ox, oy + 5 * k, ox, oy - 9 * k); g.lineBetween(ox, oy - 9 * k, ox + 6 * k, oy - 6 * k); break;
    case 'orange': c(0, 1, 7); g.fillStyle(0xffffff, 0.8); g.fillCircle(ox + 2 * k, oy - 7 * k, 2.5 * k); break;
    case 'gate': g.fillRect(ox - 9 * k, oy - 8 * k, 18 * k, 3 * k); [-7, -2, 3].forEach((x) => g.fillRect(ox + x * k, oy - 5 * k, 4 * k, 12 * k)); break;
    default: p([[0, -9], [9, 0], [0, 9], [-9, 0]]);
  }
}

/**
 * Draws the cup of `division` centred on (cx, cy), about `size` px tall. `tier` comes from the order of the divisions:
 * 0 club (plain), 1 regional (handles), 2 rise (taller), 3-4 bronze, silver (lid), 5 gold (lid and wreath),
 * 6 platinum (ball), 7-8 premier (racket), 9 major (globe), 10 season finals (globe and wings).
 */
export function drawCup(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number, division: string, metal: Metal, accent: number, symbol: string): void {
  const tier = Math.max(0, DIVISIONS.findIndex((d) => d.id === division));
  const m = METALS[metal];
  const k = size / 100;
  const ox = cx;
  const oy = cy;
  const X = (v: number): number => ox + v * k;
  const Y = (v: number): number => oy + v * k;
  const locked = metal === 'locked';
  const line = locked ? 0x9aa3b0 : NAVY;

  // Wings behind the cup (season finals).
  if (tier >= 10) {
    g.fillStyle(m.dark, 1);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) poly(g, [[s * 22, -26 + i * 7], [s * (44 - i * 3), -34 + i * 8], [s * (40 - i * 3), -26 + i * 8], [s * 22, -20 + i * 7]], ox, oy, k);
  }
  // Handles.
  if (tier >= 1) {
    g.lineStyle(5 * k, line, 1);
    g.beginPath(); g.arc(X(-24), Y(-18), 10 * k, Math.PI / 2, (3 * Math.PI) / 2); g.strokePath();
    g.beginPath(); g.arc(X(24), Y(-18), 10 * k, -Math.PI / 2, Math.PI / 2); g.strokePath();
    g.lineStyle(2.5 * k, m.main, 1);
    g.beginPath(); g.arc(X(-24), Y(-18), 10 * k, Math.PI / 2, (3 * Math.PI) / 2); g.strokePath();
    g.beginPath(); g.arc(X(24), Y(-18), 10 * k, -Math.PI / 2, Math.PI / 2); g.strokePath();
  }
  // Plinth and foot.
  const plinthTop = tier >= 2 ? 30 : 26;
  g.fillStyle(locked ? 0xb9c0cb : 0x4a2f19, 1);
  g.fillRect(X(-24), Y(plinthTop), 48 * k, 14 * k);
  g.lineStyle(2 * k, line, 1);
  g.strokeRect(X(-24), Y(plinthTop), 48 * k, 14 * k);
  g.fillStyle(locked ? 0xd3d8e0 : accent, 1);
  g.fillRect(X(-13), Y(plinthTop + 3.5), 26 * k, 7 * k);
  // Stem and foot of the cup.
  g.fillStyle(m.dark, 1);
  g.fillRect(X(-4), Y(2), 8 * k, (plinthTop - 12) * k);
  g.fillStyle(m.main, 1);
  g.fillRect(X(-2.5), Y(2), 5 * k, (plinthTop - 12) * k);
  poly(g, [[-5, plinthTop - 10], [5, plinthTop - 10], [16, plinthTop], [-16, plinthTop]], ox, oy, k);
  g.lineStyle(2 * k, line, 1);
  g.strokePoints([{ x: X(-5), y: Y(plinthTop - 10) }, { x: X(-16), y: Y(plinthTop) }, { x: X(16), y: Y(plinthTop) }, { x: X(5), y: Y(plinthTop - 10) }] as Phaser.Geom.Point[], false);
  // Bowl: a half ellipse with a lit strip and a rim.
  const bowl: Array<[number, number]> = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI;
    bowl.push([Math.cos(a) * 25, -32 + Math.sin(a) * 36]);
  }
  g.fillStyle(m.main, 1);
  poly(g, bowl, ox, oy, k);
  g.lineStyle(2.5 * k, line, 1);
  g.strokePoints(bowl.map(([x, y]) => ({ x: X(x), y: Y(y) })) as Phaser.Geom.Point[], false);
  g.fillStyle(m.light, locked ? 0.5 : 0.85);
  poly(g, [[-18, -26], [-12, -26], [-8, -4], [-13, -4]], ox, oy, k);
  g.fillStyle(m.dark, 0.55);
  poly(g, [[14, -28], [22, -28], [14, -2]], ox, oy, k);
  g.fillStyle(m.light, 1);
  g.fillEllipse(X(0), Y(-32), 50 * k, 8 * k);
  g.lineStyle(2 * k, line, 1);
  g.strokeEllipse(X(0), Y(-32), 50 * k, 8 * k);
  // Ribbon band and the emblem of the city.
  g.fillStyle(locked ? 0xd3d8e0 : accent, 1);
  g.fillRect(X(-23), Y(-24), 46 * k, 5 * k);
  emblem(g, symbol, ox, oy - 8 * k, k * 0.95, locked ? 0xaeb6c2 : accent);
  // Wreath (gold and up): small leaves around the foot of the bowl.
  if (tier >= 5 && !locked) {
    g.fillStyle(0x3c9a54, 1);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) g.fillCircle(X(s * (21 - i * 4)), Y(8 + i * 5), 2.6 * k);
  }
  // The top.
  if (tier >= 3 && tier <= 5) {
    // lid with a knob
    g.fillStyle(m.main, 1);
    poly(g, [[-23, -34], [23, -34], [10, -48], [-10, -48]], ox, oy, k);
    g.lineStyle(2 * k, line, 1);
    g.strokePoints([{ x: X(-23), y: Y(-34) }, { x: X(-10), y: Y(-48) }, { x: X(10), y: Y(-48) }, { x: X(23), y: Y(-34) }] as Phaser.Geom.Point[], false);
    g.fillStyle(m.light, 1);
    g.fillCircle(X(0), Y(-52), 5 * k);
    g.strokeCircle(X(0), Y(-52), 5 * k);
  } else if (tier === 6) {
    g.fillStyle(locked ? 0xdde2e9 : 0xe4f04a, 1);
    g.fillCircle(X(0), Y(-45), 11 * k);
    g.lineStyle(2 * k, line, 1);
    g.strokeCircle(X(0), Y(-45), 11 * k);
  } else if (tier === 7 || tier === 8) {
    g.lineStyle(4 * k, line, 1);
    g.strokeEllipse(X(0), Y(-52), 18 * k, 24 * k);
    g.lineBetween(X(0), Y(-40), X(0), Y(-32));
    g.lineStyle(2 * k, m.light, 1);
    g.strokeEllipse(X(0), Y(-52), 18 * k, 24 * k);
    if (tier === 8) {
      g.fillStyle(locked ? 0xaeb6c2 : 0xffd447, 1);
      g.fillCircle(X(0), Y(-52), 4 * k);
    }
  } else if (tier >= 9) {
    g.fillStyle(locked ? 0xdde2e9 : 0x4aa3e8, 1);
    g.fillCircle(X(0), Y(-48), 13 * k);
    g.lineStyle(1.8 * k, line, 1);
    g.strokeCircle(X(0), Y(-48), 13 * k);
    g.strokeEllipse(X(0), Y(-48), 13 * k, 26 * k);
    g.lineBetween(X(-13), Y(-48), X(13), Y(-48));
  }
}
