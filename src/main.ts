import Phaser from 'phaser';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import { COLORS, css, HD_SCALE, HEIGHT, WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { CharacterScene } from './scenes/CharacterScene';
import { GearScene } from './scenes/GearScene';
import { PackScene } from './scenes/PackScene';
import { ShopScene } from './scenes/ShopScene';
import { BracketScene } from './scenes/BracketScene';
import { CalendarScene } from './scenes/CalendarScene';
import { PartnerScene } from './scenes/PartnerScene';
import { MatchScene } from './scenes/MatchScene';
import { ResultScene } from './scenes/ResultScene';
import { AchievementsScene } from './scenes/AchievementsScene';
import { TutorialScene } from './scenes/TutorialScene';
import { SettingsScene } from './scenes/SettingsScene';
import { TitleScene } from './scenes/TitleScene';

// Portrait layout (360x640 logical), drawn on a canvas HD_SCALE times bigger and scaled to fit any screen.
const game = new Phaser.Game({
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
  scene: [BootScene, TitleScene, SettingsScene, CharacterScene, GearScene, ShopScene, PackScene, CalendarScene, BracketScene, PartnerScene, MatchScene, ResultScene, AchievementsScene, TutorialScene],
});

// Dev server only: lets screenshot scripts jump to a scene.
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
