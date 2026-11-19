import Phaser from 'phaser';
import { MatchScene } from './scenes/MatchScene';

// Portrait layout (360x640), scaled to fit any phone screen or browser window.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 360,
  height: 640,
  backgroundColor: '#0b0b1a',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MatchScene],
});
