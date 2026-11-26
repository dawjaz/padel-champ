import Phaser from 'phaser';
import { WIDTH } from '../config';
import { getSave, resetSave, updateSave } from '../save';
import { applyLightScreen, makeThemeButton, screenHeader, TC, themeText } from '../theme';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create(): void {
    applyLightScreen(this);
    screenHeader(this, 'Settings', { onBack: () => this.scene.start('TitleScene') });

    const soundLabel = (): string => `SOUND: ${getSave().settings.sound ? 'ON' : 'OFF'}`;
    const sound = makeThemeButton(this, WIDTH / 2, 112, 260, 48, soundLabel(), () => {
      updateSave((d) => ({ ...d, settings: { ...d.settings, sound: !d.settings.sound } }));
      sound.text.setText(soundLabel());
    }, 'blue', 20);

    const aimLabel = (): string => `AIM: ${getSave().settings.aim === 'point' ? 'TAP THE SPOT' : 'DIRECTIONS'}`;
    const aim = makeThemeButton(this, WIDTH / 2, 172, 260, 48, aimLabel(), () => {
      updateSave((d) => ({ ...d, settings: { ...d.settings, aim: d.settings.aim === 'point' ? 'directions' : 'point', aimPicked: true } }));
      aim.text.setText(aimLabel());
    }, 'blue', 20);
    themeText(this, WIDTH / 2, 205, 'Directions: Parallel / Middle / Cross.\nTap the spot: choose where the ball lands.', { size: 11, color: TC.sub, align: 'center' });

    const timingLabel = (): string => `TIMING: ${getSave().settings.timing === 'auto' ? 'AUTO' : 'RING'}`;
    const timing = makeThemeButton(this, WIDTH / 2, 250, 260, 48, timingLabel(), () => {
      updateSave((d) => ({ ...d, settings: { ...d.settings, timing: d.settings.timing === 'auto' ? 'ring' : 'auto' } }));
      timing.text.setText(timingLabel());
    }, 'blue', 20);
    themeText(this, WIDTH / 2, 283, 'Ring: touch as it closes on smashes, viboras,\nbandejas and serves. Auto: no ring, no bonus.', { size: 11, color: TC.sub, align: 'center' });

    const cutNames = { full: 'FULL', short: 'SHORT', off: 'OFF' } as const;
    const cutLabel = (): string => `CUTSCENES: ${cutNames[getSave().settings.cutscenes]}`;
    const cuts = makeThemeButton(this, WIDTH / 2, 328, 260, 48, cutLabel(), () => {
      updateSave((d) => ({ ...d, settings: { ...d.settings, cutscenes: d.settings.cutscenes === 'full' ? 'short' : d.settings.cutscenes === 'short' ? 'off' : 'full' } }));
      cuts.text.setText(cutLabel());
    }, 'blue', 20);
    themeText(this, WIDTH / 2, 361, 'The scenes between events (a game, a match,\na tournament). A touch always skips them.', { size: 11, color: TC.sub, align: 'center' });

    makeThemeButton(this, WIDTH / 2, 410, 260, 48, 'HOW TO PLAY', () => this.scene.start('TutorialScene', { next: 'SettingsScene' }), 'blue', 20);

    let armed = false;
    const reset = makeThemeButton(this, WIDTH / 2, 476, 260, 48, 'RESET SAVE', () => {
      if (!armed) {
        armed = true;
        reset.text.setText('SURE? TAP AGAIN');
        reset.text.setColor('#c62828');
        return;
      }
      resetSave();
      armed = false;
      reset.text.setText('SAVE RESET');
      reset.text.setColor('#0b2a5b');
    }, 'secondary', 20);

    themeText(this, WIDTH / 2, 516, 'Reset clears your progress,\nmatch stats and settings.', { size: 12, color: TC.sub, align: 'center' });
  }
}
