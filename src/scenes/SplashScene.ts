import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { applyHd } from '../hd';
import { impactSound } from '../audio';

/** Width of the intro logo on the 360 px screen; the layer PNGs share one frame (900 px wide). */
const LOGO_W = 300;
const NAVY = 0x0a0f2e;

/**
 * The intro (about 1.8 s, a touch skips it): the fireball flies in, the glass cracks, the shards fly, TRES slides in,
 * the POR tag drops, the PADEL CAREER strip slides in. Then StartScene. Plays once per launch (BootScene starts it).
 */
export class SplashScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super('SplashScene');
  }

  create(): void {
    applyHd(this);
    this.leaving = false;
    const cx = WIDTH / 2 - 8, cy = HEIGHT / 2 - 30;
    this.add.rectangle(cx, HEIGHT / 2, WIDTH, HEIGHT, NAVY);
    const layer = (k: string): Phaser.GameObjects.Image => {
      const img = this.add.image(cx, cy, `logo_${k}`);
      img.setScale(LOGO_W / img.width);
      return img;
    };
    const s = LOGO_W / 900;
    // the ball's centre inside the logo frame (900x615 px), for the cracks and the camera shake
    const ballAt = { x: cx + (730 - 450) * s, y: cy + (158 - 307) * s };
    const cracks = this.add.image(ballAt.x, ballAt.y, 'brand_cracks').setScale(0.2).setAlpha(0);
    const word = layer('word').setAlpha(0);
    const por = layer('por').setAlpha(0);
    const tag = layer('tag').setAlpha(0);
    const flame = layer('flame').setAlpha(0);
    const shards = layer('shards').setAlpha(0);
    const ball = layer('ball');
    const scale0 = ball.scale;

    // 1. the fireball comes in from the bottom left
    for (const o of [ball, flame]) { o.x -= 260; o.y += 420; }
    flame.setAlpha(1);
    this.tweens.add({ targets: [ball, flame], x: cx, y: cy, duration: 380, ease: 'Quad.easeIn' });
    // 2. impact: flash, cracks, shards, a small shake
    this.time.delayedCall(380, () => {
      impactSound('glass', 1);
      this.cameras.main.flash(120, 255, 255, 255);
      this.cameras.main.shake(160, 0.01);
      this.tweens.add({ targets: cracks, alpha: 0.55, scale: 0.36, duration: 160, ease: 'Quad.easeOut' });
      shards.setAlpha(1).setScale(scale0 * 0.7);
      this.tweens.add({ targets: shards, scale: scale0, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: ball, scale: { from: scale0 * 1.25, to: scale0 }, duration: 220, ease: 'Quad.easeOut' });
    });
    // 3. the letters
    this.time.delayedCall(480, () => {
      word.setAlpha(1).x -= 420;
      this.tweens.add({ targets: word, x: cx, duration: 300, ease: 'Back.easeOut' });
    });
    this.time.delayedCall(700, () => {
      por.setAlpha(1).y -= 220;
      this.tweens.add({ targets: por, y: cy, duration: 260, ease: 'Bounce.easeOut' });
    });
    this.time.delayedCall(900, () => {
      tag.setAlpha(1).x += 420;
      this.tweens.add({ targets: tag, x: cx, duration: 260, ease: 'Quad.easeOut' });
    });
    this.time.delayedCall(1900, () => this.leave());
    this.input.once('pointerdown', () => this.leave());
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(220, 10, 15, 46);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('StartScene'));
  }
}
