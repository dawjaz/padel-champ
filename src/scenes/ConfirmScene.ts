import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { applyHd } from '../hd';
import { drawCard, makeThemeButton, TC, themeText } from '../theme';

export interface ConfirmData {
  /** The scene underneath: it is paused while this one is open. */
  under: string;
  title: string;
  text: string;
  yes: string;
  no: string;
  /** Emitted on the scene underneath (after it is resumed) when the player confirms. */
  event: string;
}

/** A yes/no question on top of another scene. The scene underneath is paused (its timers and tweens stop) until the player answers. */
export class ConfirmScene extends Phaser.Scene {
  private data0!: ConfirmData;

  constructor() {
    super('ConfirmScene');
  }

  init(data: ConfirmData): void {
    this.data0 = data;
  }

  create(): void {
    applyHd(this);
    const d = this.data0;
    const veil = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, TC.navyDark, 0.78).setInteractive();
    veil.on('pointerdown', () => undefined); // taps do not reach the scene underneath
    const g = this.add.graphics().setPosition(24, 190);
    drawCard(g, WIDTH - 48, 256, { radius: 20, shadow: 5 });
    themeText(this, WIDTH / 2, 226, d.title, { size: 22, font: 'display', color: 0xc62828 });
    themeText(this, WIDTH / 2, 282, d.text, { size: 14, color: TC.navy, align: 'center' }).setWordWrapWidth(WIDTH - 90).setLineSpacing(4);
    const close = (): void => {
      this.scene.stop();
      this.scene.resume(d.under);
    };
    makeThemeButton(this, WIDTH / 2, 348, 240, 48, d.no, close, 'blue', 17);
    makeThemeButton(this, WIDTH / 2, 402, 240, 44, d.yes, () => {
      close();
      this.scene.get(d.under).events.emit(d.event);
    }, 'secondary', 15);
  }
}
