import Phaser from 'phaser';
import { ASSETS, assetUrl } from '../assets';
import { applyHd } from '../hd';
import { COLORS, css, FONT, HEIGHT, WIDTH, HD_SCALE } from '../config';
import { loadThemeFonts } from '../theme';

/** Loads everything listed in assets.ts, then plays the intro (SplashScene -> StartScene -> TitleScene). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    const label = this.add
      .text(WIDTH / 2, HEIGHT / 2, 'LOADING...', { fontFamily: FONT, resolution: HD_SCALE, fontSize: '16px', color: css(COLORS.white) })
      .setOrigin(0.5);
    this.load.on('progress', (p: number) => label.setText(`LOADING ${Math.round(p * 100)}%`));

    for (const a of ASSETS.images) this.load.image(a.key, assetUrl(a.path));
    for (const a of ASSETS.audio) this.load.audio(a.key, assetUrl(a.path));
  }

  create(): void {
    applyHd(this);
    // The theme fonts must be ready before the first scene creates text, otherwise it would be drawn in a fallback font.
    void loadThemeFonts().then(() => this.scene.start('SplashScene'));
  }
}
