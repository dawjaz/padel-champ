import Phaser from 'phaser';
import { drawIcon, type IconKind } from './art/icons';
import { sfx } from './audio';
import { HD_SCALE, HEIGHT, WIDTH } from './config';
import { applyHd } from './hd';
import { tournamentActive } from './career/careerFlow';
import { getSave } from './save';
import type { ButtonParts } from './ui';

/**
 * The "broadcast" look (light sports-TV style): navy outlines with a hard offset shadow, rounded cards, orange and blue
 * accents, Baloo 2 headings and Nunito body text. Screens are moved to it one by one; the old dark look lives in
 * config.ts / ui.ts / hd.ts until every screen is converted. Fonts come from the npm packages @fontsource/* (offline).
 */
export const TC = {
  navy: 0x0b2a5b,
  navyDark: 0x06183a,
  navyLight: 0x123c80,
  blue: 0x1e6bff,
  blueLight: 0x4b8bff,
  orange: 0xd93f00,
  orangeLight: 0xf0642a,
  bg: 0xeaf1fa,
  sky: 0xbfd8ff,
  sky2: 0xd7e7fc,
  gold: 0xffb800,
  goldDark: 0xb47a00,
  white: 0xffffff,
  sub: 0x44566f,
  track: 0xdce6f5,
  green: 0x0e8f5c,
} as const;

export const DISPLAY = '"Baloo 2", "Trebuchet MS", "Segoe UI", sans-serif';
export const BODY = '"Nunito", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

export const tcss = (c: number): string => '#' + c.toString(16).padStart(6, '0');

/** Resolves when the theme fonts are ready (call before the first scene creates text). */
export function loadThemeFonts(): Promise<unknown> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const wanted = ['800 24px "Baloo 2"', '700 24px "Baloo 2"', '600 14px "Nunito"', '700 14px "Nunito"', '800 14px "Nunito"'];
  return Promise.all(wanted.map((f) => document.fonts.load(f))).catch(() => undefined);
}

export interface TextOpts {
  size?: number;
  color?: number;
  font?: 'display' | 'body';
  weight?: string;
  origin?: [number, number];
  align?: 'left' | 'center' | 'right';
}

export function themeText(scene: Phaser.Scene, x: number, y: number, str: string, o: TextOpts = {}): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, str, {
    fontFamily: o.font === 'display' ? DISPLAY : BODY,
    resolution: HD_SCALE,
    fontSize: `${o.size ?? 14}px`,
    fontStyle: o.weight ?? '800',
    color: tcss(o.color ?? TC.navy),
    align: o.align ?? 'left',
  });
  const [ox, oy] = o.origin ?? [0.5, 0.5];
  return t.setOrigin(ox, oy);
}

/** Light screen: camera zoom, plain light background, short fade-in. */
export function applyLightScreen(scene: Phaser.Scene, fade = true): void {
  applyHd(scene);
  scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, TC.bg).setDepth(-100);
  if (fade) scene.cameras.main.fadeIn(160, 234, 241, 250);
}

/** Rounded card with a navy outline and a hard offset shadow, drawn with its top-left corner at (0, 0). */
export function drawCard(g: Phaser.GameObjects.Graphics, w: number, h: number, o: { fill?: number; stroke?: number; radius?: number; shadow?: number; pressed?: boolean } = {}): void {
  const r = Math.min(o.radius ?? 16, h / 2);
  const stroke = o.stroke ?? TC.navy;
  const sh = o.pressed ? 0 : (o.shadow ?? 3);
  const dy = o.pressed ? 3 : 0;
  g.clear();
  if (sh > 0) {
    g.fillStyle(stroke, 1);
    g.fillRoundedRect(0, sh, w, h, r);
  }
  g.fillStyle(o.fill ?? TC.white, 1);
  g.fillRoundedRect(0, dy, w, h, r);
  g.lineStyle(2.5, stroke, 1);
  g.strokeRoundedRect(0, dy, w, h, r);
}

/** Gradient face (top lighter) used for the coloured buttons. */
function drawFaceButton(g: Phaser.GameObjects.Graphics, w: number, h: number, top: number, bottom: number, pressed: boolean): void {
  const r = Math.min(14, h / 2);
  const dy = pressed ? 3 : 0;
  g.clear();
  if (!pressed) {
    g.fillStyle(TC.navy, 1);
    g.fillRoundedRect(0, 3, w, h, r);
  }
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRoundedRect(0, dy, w, h, r);
  g.fillStyle(0xffffff, 0.22);
  g.fillRoundedRect(4, dy + 3, w - 8, h * 0.28, { tl: r - 4, tr: r - 4, bl: 4, br: 4 });
  g.lineStyle(2.5, TC.navy, 1);
  g.strokeRoundedRect(0, dy, w, h, r);
}

export interface BakedShape {
  rt: Phaser.GameObjects.RenderTexture;
  /** Clears the texture and paints again (shape coordinates start at 0,0 in the top-left corner). */
  repaint: (paint: (g: Phaser.GameObjects.Graphics) => void) => void;
}

/**
 * A Graphics shape painted once into a texture. A Graphics object is triangulated again on every frame (rounded corners are
 * expensive), a texture is a single quad: use this for everything that stays still or changes rarely (buttons, cards, bars).
 * The texture has HD_SCALE times the pixels, so it stays sharp. `(x, y)` is the top-left corner of the shape, `pad` leaves room
 * for strokes and shadows outside it.
 */
export function bakedShape(scene: Phaser.Scene, x: number, y: number, w: number, h: number, paint: (g: Phaser.GameObjects.Graphics) => void, pad = 4): BakedShape {
  const S = HD_SCALE;
  const rt = scene.add.renderTexture(x - pad, y - pad, Math.ceil((w + pad * 2) * S), Math.ceil((h + pad * 2) * S)).setOrigin(0, 0).setScale(1 / S);
  const tmp = scene.make.graphics({}, false);
  rt.once(Phaser.GameObjects.Events.DESTROY, () => tmp.destroy());
  const repaint = (fn: (g: Phaser.GameObjects.Graphics) => void): void => {
    rt.clear();
    tmp.clear();
    tmp.setScale(S).setPosition(pad * S, pad * S);
    fn(tmp);
    rt.draw(tmp);
  };
  repaint(paint);
  return { rt, repaint };
}

export type ThemeButtonKind = 'primary' | 'secondary' | 'blue';

/** Rounded button centred on (x, y): primary (orange), blue, or secondary (white card). Plays the select beep. */
export function makeThemeButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, kind: ThemeButtonKind = 'primary', size = 20): ButtonParts {
  let pressed = false;
  const paint = (g: Phaser.GameObjects.Graphics): void => {
    if (kind === 'primary') drawFaceButton(g, w, h, TC.orangeLight, TC.orange, pressed);
    else if (kind === 'blue') drawFaceButton(g, w, h, TC.blueLight, TC.blue, pressed);
    else drawCard(g, w, h, { radius: 14, pressed });
  };
  const baked = bakedShape(scene, x - w / 2, y - h / 2, w, h, paint);
  const gfx = baked.rt;
  const draw = (): void => baked.repaint(paint);
  const text = themeText(scene, x, y + 2, label, { size, color: kind === 'secondary' ? TC.navy : TC.white, font: 'display' });
  const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', () => {
    pressed = true;
    draw();
    text.y += 3;
    sfx('select');
    scene.time.delayedCall(90, () => {
      pressed = false;
      draw();
      text.y -= 3;
      onClick();
    });
  });
  return { bg: zone, text, parts: [gfx, zone, text], setAccent: () => undefined };
}

/** Rounded progress bar with a navy outline, drawn with its top-left corner at (x, y). `frac` 0..1. */
export function drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number): void {
  const r = h / 2;
  g.fillStyle(TC.track, 1);
  g.fillRoundedRect(x, y, w, h, r);
  const fw = Math.max(0, Math.min(1, frac)) * (w - 2);
  if (fw > h * 0.4) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x + 1, y + 1, fw, h - 2, r - 1);
    g.fillStyle(0xffffff, 0.38);
    g.fillRoundedRect(x + 3, y + 2, Math.max(0, fw - 4), (h - 2) * 0.32, 2);
  }
  g.lineStyle(2, TC.navy, 1);
  g.strokeRoundedRect(x, y, w, h, r);
}

/** A small gold coin (the currency icon). */
export function drawCoin(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.fillStyle(TC.gold, 1);
  g.fillCircle(x, y, r);
  g.lineStyle(1.5, TC.goldDark, 1);
  g.strokeCircle(x, y, r);
  g.strokeCircle(x, y, r * 0.6);
}

/** The experience icon: a white star on a blue disc (the coin's counterpart). */
export function drawXp(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.fillStyle(TC.blue, 1);
  g.fillCircle(x, y, r);
  g.lineStyle(1.5, TC.navy, 1);
  g.strokeCircle(x, y, r);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r * 0.7 : r * 0.3;
    pts.push({ x: x + Math.cos(a) * rr, y: y + 0.5 + Math.sin(a) * rr });
  }
  g.fillStyle(TC.white, 1);
  g.fillPoints(pts, true);
}

export type RewardKind = 'xp' | 'coin';

/** A row of rewards, each an icon and an amount (for example "(star) +120   (coin) +40"), centred on `cx` at height `y` (`left`: starting at `cx`). */
export function rewardRow(scene: Phaser.Scene, cx: number, y: number, items: { kind: RewardKind | null; text: string }[], o: { size?: number; color?: number; left?: boolean; gap?: number } = {}): Phaser.GameObjects.GameObject[] {
  const size = o.size ?? 15;
  const r = size * 0.62;
  const gap = o.gap ?? 16;
  const labels = items.map((it) => themeText(scene, 0, y + 1, it.text, { size, color: o.color ?? TC.navy, font: 'display', origin: [0, 0.5] }));
  const widths = items.map((it, i) => (it.kind ? r * 2 + 5 : 0) + labels[i].width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  const g = scene.add.graphics();
  let x = o.left ? cx : cx - total / 2;
  items.forEach((it, i) => {
    if (it.kind === 'xp') drawXp(g, x + r, y, r);
    else if (it.kind === 'coin') drawCoin(g, x + r, y, r);
    labels[i].x = x + (it.kind ? r * 2 + 5 : 0);
    x += widths[i] + gap;
  });
  return [g, ...labels];
}

/** White pill with a gold coin and the amount, right-aligned to `right`, vertically centred on `y`. */
export function coinPill(scene: Phaser.Scene, right: number, y: number, amount: number): Phaser.GameObjects.GameObject[] {
  const label = themeText(scene, 0, y + 1, amount.toLocaleString('en-US'), { size: 14, origin: [0, 0.5] });
  const w = label.width + 40;
  const x0 = right - w;
  label.x = x0 + 31;
  const g = scene.add.graphics();
  g.fillStyle(TC.white, 1);
  g.fillRoundedRect(x0, y - 16, w, 32, 16);
  g.lineStyle(2.5, TC.navy, 1);
  g.strokeRoundedRect(x0, y - 16, w, 32, 16);
  g.fillStyle(TC.gold, 1);
  g.fillCircle(x0 + 17, y, 10);
  g.lineStyle(1.5, TC.goldDark, 1);
  g.strokeCircle(x0 + 17, y, 10);
  g.strokeCircle(x0 + 17, y, 6);
  scene.children.bringToTop(label);
  // Tapping the coins opens the shop (not in the shop itself, and not while a tournament is going on: the shop is closed then).
  const out: Phaser.GameObjects.GameObject[] = [g, label];
  if (scene.scene.key !== 'ShopScene') {
    const z = scene.add.zone(x0 + w / 2, y, w + 8, 44).setInteractive({ useHandCursor: true }).setDepth(7);
    z.on('pointerdown', () => {
      if (tournamentActive(getSave().profile)) return;
      sfx('select');
      scene.scene.start('ShopScene', { from: scene.scene.key });
    });
    out.push(z);
  }
  return out;
}

/** Navy title bar across the top (58 px). Returns the bottom edge. */
export function screenHeader(scene: Phaser.Scene, title: string, o: { onBack?: () => void; coins?: number } = {}): number {
  const g = scene.add.graphics().setDepth(5);
  g.fillGradientStyle(TC.navyLight, TC.navyLight, TC.navy, TC.navy, 1);
  g.fillRect(0, 0, WIDTH, 58);
  g.fillStyle(TC.navyDark, 1);
  g.fillRect(0, 55, WIDTH, 3);
  let tx = 14;
  if (o.onBack) {
    g.lineStyle(2, TC.white, 1);
    g.fillStyle(0xffffff, 0.14);
    g.fillRoundedRect(12, 10, 38, 38, 12);
    g.strokeRoundedRect(12, 10, 38, 38, 12);
    g.lineStyle(4, TC.white, 1);
    g.beginPath();
    g.moveTo(35, 21);
    g.lineTo(26, 29);
    g.lineTo(35, 37);
    g.strokePath();
    const z = scene.add.zone(31, 29, 44, 44).setInteractive({ useHandCursor: true }).setDepth(6);
    z.on('pointerdown', () => {
      sfx('select');
      o.onBack?.();
    });
    tx = 62;
  }
  themeText(scene, tx, 31, title.toUpperCase(), { size: 26, color: TC.white, font: 'display', origin: [0, 0.5] }).setDepth(6);
  if (o.coins !== undefined) for (const c of coinPill(scene, WIDTH - 12, 29, o.coins)) (c as Phaser.GameObjects.Graphics).setDepth?.(6);
  return 58;
}

/** The pale circles behind a character (a "stage"), centred on (cx, cy). */
export function drawStage(scene: Phaser.Scene, cx: number, cy: number, r: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(TC.sky2, 1);
  g.fillCircle(cx, cy, r);
  g.fillStyle(TC.sky, 1);
  g.fillCircle(cx, cy, r * 0.72);
  g.fillStyle(TC.white, 1);
  g.fillCircle(cx, cy, r * 0.4);
  return g;
}

/** Small square tile with an icon (for menu tiles): navy-outlined rounded square, filled with `color`. */
export function iconChip(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number, icon: IconKind): void {
  g.fillStyle(color, 1);
  g.fillRoundedRect(x, y, size, size, 12);
  g.lineStyle(2, TC.navy, 1);
  g.strokeRoundedRect(x, y, size, size, 12);
  drawIcon(g, icon, x + size / 2, y + size / 2, size * 0.58, TC.white);
}
