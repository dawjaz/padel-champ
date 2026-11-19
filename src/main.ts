import Phaser from 'phaser';
import { COLORS, css, HEIGHT, WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { MatchScene } from './scenes/MatchScene';
import { ResultScene } from './scenes/ResultScene';
import { SettingsScene } from './scenes/SettingsScene';
import { TitleScene } from './scenes/TitleScene';

// Portrait layout (360x640), scaled to fit any phone screen or browser window.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: css(COLORS.bg),
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // The first scene in the list starts automatically.
  scene: [BootScene, TitleScene, SettingsScene, MatchScene, ResultScene],
});
