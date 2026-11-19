import Phaser from 'phaser';
import { sfx } from './audio';
import { COLORS, css, FONT, HD_SCALE } from './config';

export interface ButtonParts {
  /** Invisible hit area (use it for events). */
  bg: Phaser.GameObjects.Zone;
  text: Phaser.GameObjects.Text;
  /** Everything that makes up the button, for hiding or destroying it. */
  parts: Phaser.GameObjects.GameObject[];
  /** Changes the colour of the outline (for example a red "are you sure?" state). */
  setAccent: (color: number) => void;
}

/** A rounded, glossy panel drawn around (0,0). `hover` brightens it, `accent` is the outline colour. */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  accent: number,
  hover: boolean,
  fill: number = COLORS.panel,
): void {
  // 3D-ish: an extruded rounded slab (visible side), a gradient face and a glossy top highlight.
  const r = Math.min(12, h / 2);
  const depth = 5;
  g.clear();
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(-w / 2 + 2, -h / 2 + depth + 3, w, h, r);
  g.fillStyle(0x10113a, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + depth, w, h, r);
  const top = hover ? COLORS.panelHover : fill;
  g.fillGradientStyle(lighten(top, 1.45), lighten(top, 1.45), top, top, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.fillStyle(0xffffff, hover ? 0.28 : 0.2);
  g.fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, h * 0.32, { tl: r - 3, tr: r - 3, bl: 6, br: 6 });
  g.lineStyle(2, accent, 0.95);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
}

function lighten(c: number, k: number): number {
  const ch = (v: number): number => Math.min(255, Math.round(v * k));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

/** Menu button: rounded, glossy, with a hover state. Plays a select beep and calls `onClick`. */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
): ButtonParts {
  let accent: number = COLORS.white;
  let hover = false;
  const gfx = scene.add.graphics().setPosition(x, y);
  const redraw = (): void => drawPanel(gfx, w, h, accent, hover);
  redraw();
  const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
  const text = scene.add
    .text(x, y, label, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '18px', fontStyle: 'bold', color: css(COLORS.white) })
    .setOrigin(0.5);
  zone.on('pointerover', () => {
    hover = true;
    redraw();
  });
  zone.on('pointerout', () => {
    hover = false;
    redraw();
  });
  zone.on('pointerdown', () => {
    sfx('select');
    onClick();
  });
  return {
    bg: zone,
    text,
    parts: [gfx, zone, text],
    setAccent: (color: number) => {
      accent = color;
      redraw();
    },
  };
}

/** Big chunky title text with a soft drop shadow. */
export function logoText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color: number,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, str, { fontFamily: FONT, resolution: HD_SCALE, fontSize: `${size}px`, fontStyle: 'bold', color: css(color) })
    .setOrigin(0.5)
    .setStroke('#000000', Math.max(3, Math.round(size / 9)))
    .setShadow(0, 4, '#000000', 6, true, true);
}
