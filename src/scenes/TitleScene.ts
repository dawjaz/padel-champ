import Phaser from 'phaser';
import { COLORS, css, FONT, GAME_TITLE, HEIGHT, WIDTH } from '../config';
import { getSave } from '../save';
import { logoText, makeButton } from '../ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.drawBackdrop();

    // Logo: PADEL / CHAMP / [26]
    logoText(this, WIDTH / 2, 80, 'PADEL', 64, COLORS.yellow);
    logoText(this, WIDTH / 2, 146, 'CHAMP', 64, COLORS.white);
    const badge = this.add.rectangle(WIDTH / 2, 215, 90, 46, COLORS.red).setStrokeStyle(4, COLORS.white);
    const badgeText = logoText(this, WIDTH / 2, 215, '26', 36, COLORS.white);
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        const on = !badge.visible;
        badge.setVisible(on);
        badgeText.setVisible(on);
      },
    });

    this.add
      .text(WIDTH / 2, 262, 'COMMAND PADEL', { fontFamily: FONT, fontSize: '14px', color: css(COLORS.sky) })
      .setOrigin(0.5);

    // Bouncing ball
    const ball = this.add.circle(WIDTH / 2, 310, 8, 0xfff27a).setStrokeStyle(2, COLORS.black);
    this.tweens.add({ targets: ball, y: 350, duration: 380, yoyo: true, repeat: -1, ease: 'Quad.easeIn' });

    // Menu
    makeButton(this, WIDTH / 2, 440, 220, 52, 'START MATCH', () => this.scene.start('MatchScene'));
    makeButton(this, WIDTH / 2, 508, 220, 52, 'SETTINGS', () => this.scene.start('SettingsScene'));

    const s = getSave().stats;
    const statsLine = s.played === 0 ? 'NO MATCHES YET' : `PLAYED ${s.played}  WON ${s.won}  LOST ${s.lost}`;
    this.add
      .text(WIDTH / 2, 580, statsLine, { fontFamily: FONT, fontSize: '12px', color: css(COLORS.gray) })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT - 20, `${GAME_TITLE}  v0.2`, { fontFamily: FONT, fontSize: '10px', color: css(COLORS.gray) })
      .setOrigin(0.5);
  }

  private drawBackdrop(): void {
    const g = this.add.graphics();
    // Court-coloured floor with lines, behind the menu
    g.fillStyle(COLORS.court, 1);
    g.fillRect(0, 390, WIDTH, HEIGHT - 390);
    g.lineStyle(3, COLORS.courtLine, 0.5);
    g.lineBetween(0, 390, WIDTH, 390);
    g.lineBetween(WIDTH / 2, 390, WIDTH / 2, HEIGHT);
    g.lineStyle(3, COLORS.courtLine, 0.25);
    g.lineBetween(0, 560, WIDTH, 560);
  }
}
