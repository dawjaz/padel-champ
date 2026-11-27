import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { applyHd } from '../hd';
import { drawStudioMark } from '../art/studioMark';
import { SPORT } from '../theme';

const MARK_H = 150;

/**
 * The studio board: from total black the Turbo mark (a leaning D with a j cut out) and the studio name come up to pure white,
 * hold, and fade out again. A touch skips it.
 */
export class StudioScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super('StudioScene');
  }

  create(): void {
    applyHd(this);
    this.leaving = false;
    this.cameras.main.setBackgroundColor(0x000000);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000);
    if (!this.textures.exists('studio_mark')) this.textures.addCanvas('studio_mark', drawStudioMark(512));
    const cx = WIDTH / 2, cy = HEIGHT / 2;
    const mark = this.add.image(cx - 40, cy - 40, 'studio_mark').setDisplaySize(MARK_H, MARK_H).setAlpha(0);
    const name = this.add.text(cx, cy + 70, 'DAVJ STUDIO', { fontFamily: SPORT, fontSize: '26px', fontStyle: 'italic', color: '#ffffff', resolution: 2 })
      .setOrigin(0.5).setPadding(8, 4, 16, 4).setLetterSpacing(8).setAlpha(0);
    // the mark glides in from the left, up to pure white; the name follows; both fade out together
    this.tweens.add({ targets: mark, alpha: 1, x: cx, duration: 800, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: name, alpha: 1, duration: 700, delay: 500, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: [mark, name], alpha: 0, duration: 600, delay: 2300, ease: 'Sine.easeIn',
      onComplete: () => this.leave(),
    });
    this.input.once('pointerdown', () => this.leave());
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('SplashScene');
  }
}
