import Phaser from 'phaser';
import { T } from '../i18n';
import { ASSETS, assetUrl } from '../assets';
import { applyHd } from '../hd';
import { HEIGHT, WIDTH } from '../config';
import { loadThemeFonts } from '../theme';

/** Loads everything listed in assets.ts, then plays the studio board and the intro (StudioScene -> SplashScene -> StartScene -> TitleScene). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // The HD camera first, or everything below would be drawn small in a corner of the bigger canvas.
    applyHd(this);
    const cx = WIDTH / 2, cy = HEIGHT / 2;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x080818, 0x080818, 0x15367a, 0x1b4a96, 1);
    bg.fillRect(0, 0, WIDTH, HEIGHT);
    // A court line under the ball, a ball hopping on it (squashing its shadow), a rounded progress bar and the percentage.
    bg.lineStyle(2, 0xffffff, 0.18);
    bg.lineBetween(cx - 120, cy + 30, cx + 120, cy + 30);
    const shadow = this.add.ellipse(cx, cy + 30, 30, 8, 0x000000, 0.4);
    const ball = this.add.circle(cx, cy - 20, 16, 0xe8ff3a).setStrokeStyle(3, 0x2a3a00);
    this.tweens.add({ targets: ball, y: cy - 90, duration: 420, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: shadow, scaleX: 0.55, alpha: 0.18, duration: 420, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });

    const BAR_W = 220, BAR_H = 12, by = cy + 78;
    const track = this.add.graphics();
    track.fillStyle(0x000000, 0.4);
    track.fillRoundedRect(cx - BAR_W / 2 - 3, by - 3, BAR_W + 6, BAR_H + 6, 9);
    const fill = this.add.graphics();
    const label = this.add.text(cx, by + 34, '0%', { fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '20px', fontStyle: 'italic', color: '#ffffff', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(2);
    this.load.on('progress', (p: number) => {
      fill.clear();
      fill.fillStyle(0xff7a1a, 1);
      fill.fillRoundedRect(cx - BAR_W / 2, by, Math.max(BAR_H, BAR_W * p), BAR_H, 6);
      fill.fillStyle(0xffffff, 0.35);
      fill.fillRoundedRect(cx - BAR_W / 2 + 2, by + 2, Math.max(BAR_H - 4, BAR_W * p - 4), 3, 2);
      label.setText(T('LOADING {0}%', Math.round(p * 100)));
    });

    for (const a of ASSETS.images) this.load.image(a.key, assetUrl(a.path));
    for (const a of ASSETS.audio) this.load.audio(a.key, assetUrl(a.path));
  }

  create(): void {
    applyHd(this);
    // The theme fonts must be ready before the first scene creates text, otherwise it would be drawn in a fallback font.
    void loadThemeFonts().then(() => this.scene.start('StudioScene'));
  }
}
