import Phaser from 'phaser';
import { COLORS, css, HD_SCALE, HEIGHT, WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { CharacterScene } from './scenes/CharacterScene';
import { MatchScene } from './scenes/MatchScene';
import { ResultScene } from './scenes/ResultScene';
import { SettingsScene } from './scenes/SettingsScene';
import { TitleScene } from './scenes/TitleScene';

// Portrait layout (360x640 logical), drawn on a canvas HD_SCALE times bigger and scaled to fit any screen.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH * HD_SCALE,
  height: HEIGHT * HD_SCALE,
  backgroundColor: css(COLORS.bg),
  // Smooth rendering (the 128-bit look): no pixel-art mode.
  pixelArt: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // The first scene in the list starts automatically.
  scene: [BootScene, TitleScene, SettingsScene, CharacterScene, MatchScene, ResultScene],
});
