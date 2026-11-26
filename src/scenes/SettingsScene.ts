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
    const sound = makeThemeButton(this, WIDTH / 2, 104, 260, 44, soundLabel(), () => {
      updateSave((d) => ({ ...d, settings: { ...d.settings, sound: !d.settings.sound } }));
      sound.text.setText(soundLabel());
    }, 'blue', 19);

    const aimLabel = (): string => `AIM: ${getSave().settings.aim === 'point' ? 'TAP THE SPOT' : 'DIRECTIONS'}`;
    const aim = makeThemeButton(this, WIDTH / 2, 162, 260, 44, aimLabel(), () => {
      updateSave((d) => ({ ...d, settings: { ...d.settings, aim: d.settings.aim === 'point' ? 'directions' : 'point', aimPicked: true } }));
      aim.text.setText(aimLabel());
    }, 'blue', 19);
    themeText(this, WIDTH / 2, 198, 'Directions: Parallel / Middle / Cross.\nTap the spot: choose where the ball lands.', { size: 10, color: TC.sub, align: 'center' });

    const timingLabel = (): string => `TIMING: ${getSave().settings.timing === 'auto' ? 'AUTO' : 'RING'}`;
    const timing = makeThemeButton(this, WIDTH / 2, 256, 260, 44, timingLabel(), () => {
      updateSave((d) => ({ ...d, settings: { ...d.settings, timing: d.settings.timing === 'auto' ? 'ring' : 'auto' } }));
      timing.text.setText(timingLabel());
    }, 'blue', 19);
    themeText(this, WIDTH / 2, 292, 'Ring: touch as it closes on smashes, viboras,\nbandejas and serves. Auto: no ring, no bonus.', { size: 10, color: TC.sub, align: 'center' });

    const cutNames = { full: 'FULL', short: 'SHORT', off: 'OFF' } as const;
    const cutLabel = (): string => `CUTSCENES: ${cutNames[getSave().settings.cutscenes]}`;
    const cuts = makeThemeButton(this, WIDTH / 2, 350, 260, 44, cutLabel(), () => {
      updateSave((d) => ({ ...d, settings: { ...d.settings, cutscenes: d.settings.cutscenes === 'full' ? 'short' : d.settings.cutscenes === 'short' ? 'off' : 'full' } }));
      cuts.text.setText(cutLabel());
    }, 'blue', 19);
    themeText(this, WIDTH / 2, 386, 'The scenes between events (a game, a match,\na tournament). A touch always skips them.', { size: 10, color: TC.sub, align: 'center' });

    makeThemeButton(this, WIDTH / 2, 442, 260, 44, 'HOW TO PLAY', () => this.scene.start('TutorialScene', { next: 'SettingsScene' }), 'blue', 19);

    let armed = false;
    const reset = makeThemeButton(this, WIDTH / 2, 510, 260, 44, 'RESET SAVE', () => {
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

    themeText(this, WIDTH / 2, 546, 'Reset clears your progress,\nmatch stats and settings.', { size: 12, color: TC.sub, align: 'center' });
  }
}
