import Phaser from 'phaser';
import { WIDTH } from '../config';
import { DEBUG } from '../debug';
import { getSave, resetSave, updateSave } from '../save';
import { applyLightScreen, makeThemeButton, screenHeader, TC, themeText } from '../theme';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create(): void {
    applyLightScreen(this);
    screenHeader(this, 'Settings', { onBack: () => this.scene.start('TitleScene') });

    // Rows top to bottom; AIM, TIMING and SHOT MENU only in debug mode (dev server or ?debug), kept for testing changes.
    let y = 96;
    const BTN = 42;
    const gapAfter = (lines: number): number => BTN / 2 + 8 + lines * 13 + 14;
    const row = (label: () => string, toggle: () => void, note?: string): void => {
      const b = makeThemeButton(this, WIDTH / 2, y, 260, BTN, label(), () => {
        toggle();
        b.text.setText(label());
      }, 'blue', 19);
      if (note) {
        themeText(this, WIDTH / 2, y + BTN / 2 + 8, note, { size: 10, color: TC.sub, align: 'center' }).setOrigin(0.5, 0);
        y += gapAfter(note.split('\n').length) + BTN / 2;
      } else y += BTN + 14;
    };

    row(() => `SOUND: ${getSave().settings.sound ? 'ON' : 'OFF'}`, () => updateSave((d) => ({ ...d, settings: { ...d.settings, sound: !d.settings.sound } })));

    if (DEBUG) {
      row(
        () => `AIM: ${getSave().settings.aim === 'point' ? 'TAP THE SPOT' : 'DIRECTIONS'}`,
        () => updateSave((d) => ({ ...d, settings: { ...d.settings, aim: d.settings.aim === 'point' ? 'directions' : 'point', aimPicked: true } })),
        'DEBUG. Directions: Parallel / Middle / Cross.\nTap the spot: choose where the ball lands.',
      );
      row(
        () => `TIMING: ${getSave().settings.timing === 'auto' ? 'AUTO' : 'RING'}`,
        () => updateSave((d) => ({ ...d, settings: { ...d.settings, timing: d.settings.timing === 'auto' ? 'ring' : 'auto' } })),
        'DEBUG. Ring: touch as it closes. Auto: no ring, no bonus.',
      );
      row(
        () => `SHOT MENU: ${getSave().settings.shotMenu === 'columns' ? 'COLUMNS' : 'LIST'}`,
        () => updateSave((d) => ({ ...d, settings: { ...d.settings, shotMenu: d.settings.shotMenu === 'columns' ? 'list' : 'columns' } })),
        'DEBUG. Columns: defence | neutral | attack. List: plain list.',
      );
    }

    const cutNames = { full: 'FULL', short: 'SHORT', off: 'OFF' } as const;
    row(
      () => `CUTSCENES: ${cutNames[getSave().settings.cutscenes]}`,
      () => updateSave((d) => ({ ...d, settings: { ...d.settings, cutscenes: d.settings.cutscenes === 'full' ? 'short' : d.settings.cutscenes === 'short' ? 'off' : 'full' } })),
      'The scenes between events (a game, a match,\na tournament). A touch always skips them.',
    );

    makeThemeButton(this, WIDTH / 2, y, 260, BTN, 'HOW TO PLAY', () => this.scene.start('TutorialScene', { next: 'SettingsScene' }), 'blue', 19);
    y += BTN + 14;

    let armed = false;
    const reset = makeThemeButton(this, WIDTH / 2, y, 260, BTN, 'RESET SAVE', () => {
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
    themeText(this, WIDTH / 2, y + BTN / 2 + 8, 'Reset clears your progress,\nmatch stats and settings.', { size: 12, color: TC.sub, align: 'center' }).setOrigin(0.5, 0);
  }
}
