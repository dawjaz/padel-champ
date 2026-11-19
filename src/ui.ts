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
  const r = Math.min(14, h / 2);
  g.clear();
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(-w / 2 + 1, -h / 2 + 4, w, h, r);
  g.fillStyle(hover ? COLORS.panelHover : fill, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.fillStyle(0xffffff, hover ? 0.2 : 0.12);
  g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.45, { tl: r - 2, tr: r - 2, bl: 4, br: 4 });
  g.lineStyle(2, accent, 0.95);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
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
