import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { applyHd } from '../hd';
import { SPORT } from '../theme';

/** The studio board: from total black the studio name fades up to pure white, holds, and fades out. A touch skips it. */
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
    const name = this.add.text(WIDTH / 2, HEIGHT / 2, 'DAVJ STUDIO', { fontFamily: SPORT, fontSize: '34px', color: '#ffffff', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(10).setAlpha(0);
    this.tweens.add({ targets: name, alpha: 1, duration: 900, ease: 'Sine.easeInOut', hold: 900, yoyo: true, onComplete: () => this.leave() });
    this.input.once('pointerdown', () => this.leave());
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('SplashScene');
  }
}
