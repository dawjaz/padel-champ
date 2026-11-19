import Phaser from 'phaser';
import { COLORS, css, FONT, WIDTH } from '../config';
import { getSave, resetSave, updateSave } from '../save';
import { logoText, makeButton } from '../ui';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create(): void {
    logoText(this, WIDTH / 2, 80, 'SETTINGS', 36, COLORS.yellow);

    const soundLabel = () => `SOUND: ${getSave().settings.sound ? 'ON' : 'OFF'}`;
    const sound = makeButton(this, WIDTH / 2, 200, 240, 52, soundLabel(), () => {
      updateSave((d) => ({ ...d, settings: { ...d.settings, sound: !d.settings.sound } }));
      sound.text.setText(soundLabel());
    });

    let armed = false;
    const reset = makeButton(this, WIDTH / 2, 280, 240, 52, 'RESET SAVE', () => {
      if (!armed) {
        armed = true;
        reset.text.setText('SURE? TAP AGAIN');
        reset.bg.setStrokeStyle(3, COLORS.red);
        return;
      }
      resetSave();
      armed = false;
      reset.text.setText('SAVE RESET');
      reset.bg.setStrokeStyle(3, COLORS.white);
    });

    this.add
      .text(WIDTH / 2, 350, 'Reset clears your match\nstats and settings.', {
        fontFamily: FONT,
        fontSize: '12px',
        color: css(COLORS.gray),
        align: 'center',
      })
      .setOrigin(0.5);

    makeButton(this, WIDTH / 2, 540, 240, 52, 'BACK', () => this.scene.start('TitleScene'));
  }
}
