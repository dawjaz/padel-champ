import type Phaser from 'phaser';
import { HD_SCALE, HEIGHT, WIDTH } from './config';

/** Call first in every scene's create(): shows the 360x640 logical screen on the HD_SCALE-times bigger canvas. */
export function applyHd(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(HD_SCALE).centerOn(WIDTH / 2, HEIGHT / 2);
}
