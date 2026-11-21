import Phaser from 'phaser';
import { HD_SCALE, HEIGHT, WIDTH } from './config';

/** Call first in every scene's create(): shows the 360x640 logical screen on the HD_SCALE-times bigger canvas. */
export function applyHd(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(HD_SCALE).centerOn(WIDTH / 2, HEIGHT / 2);
}

/**
 * Menu screens (everything but the match): applyHd plus the shared backdrop (night gradient, a lit court in perspective,
 * slow drifting lights, a vignette) and a short fade-in. `fade` false when a scene redraws itself (page changes).
 */
export function applyScreen(scene: Phaser.Scene, fade = true): void {
  applyHd(scene);
  const g = scene.add.graphics().setDepth(-100);
  g.fillGradientStyle(0x080818, 0x080818, 0x15367a, 0x1b4a96, 1);
  g.fillRect(0, 0, WIDTH, HEIGHT);
  // The court: a trapezoid in perspective with the lines of a padel court.
  const top = 250;
  const x0 = (y: number, edge: number): number => WIDTH / 2 + edge * (0.42 + 0.58 * ((y - top) / (HEIGHT - top)));
  g.fillStyle(0x1e5fa8, 0.5);
  g.fillPoints([new Phaser.Geom.Point(x0(top, -1), top), new Phaser.Geom.Point(x0(top, 1), top), new Phaser.Geom.Point(WIDTH / 2 + 270, HEIGHT), new Phaser.Geom.Point(WIDTH / 2 - 270, HEIGHT)], true);
  g.lineStyle(2, 0xffffff, 0.16);
  g.lineBetween(WIDTH / 2, top, WIDTH / 2, HEIGHT);
  for (const f of [0.38, 0.78]) {
    const y = top + (HEIGHT - top) * f;
    g.lineBetween(x0(y, -1), y, x0(y, 1), y);
  }
  g.lineBetween(WIDTH / 2 - 150, top, WIDTH / 2 - 270, HEIGHT);
  g.lineBetween(WIDTH / 2 + 150, top, WIDTH / 2 + 270, HEIGHT);
  // Vignette: dark edges.
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
  g.fillRect(0, 0, WIDTH, 120);
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.6, 0.6);
  g.fillRect(0, HEIGHT - 140, WIDTH, 140);
  // Slow drifting lights (bokeh).
  for (let i = 0; i < 7; i++) {
    const x = 30 + ((i * 53) % (WIDTH - 60));
    const y = 40 + ((i * 97) % 300);
    const r = 14 + (i % 3) * 8;
    const c = scene.add.circle(x, y, r, i % 2 ? 0x9fd8ff : 0xf8b800, 0.07).setDepth(-99);
    scene.tweens.add({ targets: c, y: y + 26 + i * 3, x: x + (i % 2 ? 14 : -14), alpha: 0.14, duration: 3200 + i * 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  if (fade) scene.cameras.main.fadeIn(220, 8, 8, 24);
}
