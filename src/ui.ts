import Phaser from 'phaser';
import { sfx } from './audio';
import { COLORS, css, FONT } from './config';

export interface ButtonParts {
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

/** NES-style menu button. Plays a select beep and calls `onClick`. */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
): ButtonParts {
  const bg = scene.add
    .rectangle(x, y, w, h, COLORS.panel)
    .setStrokeStyle(3, COLORS.white)
    .setInteractive({ useHandCursor: true });
  const text = scene.add
    .text(x, y, label, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: css(COLORS.white) })
    .setOrigin(0.5);
  bg.on('pointerover', () => bg.setFillStyle(COLORS.panelHover));
  bg.on('pointerout', () => bg.setFillStyle(COLORS.panel));
  bg.on('pointerdown', () => {
    sfx('select');
    onClick();
  });
  return { bg, text };
}

/** Big chunky title text with a hard drop shadow, like an NES logo. */
export function logoText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color: number,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: css(color) })
    .setOrigin(0.5)
    .setShadow(4, 4, '#000000', 0, false, true);
}
