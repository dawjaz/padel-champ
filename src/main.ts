import Phaser from 'phaser';
import { SHOTS } from './game/catalog';
import playersData from './data/players.json';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import { COLORS, css, HD_SCALE, HEIGHT, WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { CharacterScene } from './scenes/CharacterScene';
import { SpecialScene } from './scenes/SpecialScene';
import { GearScene } from './scenes/GearScene';
import { PackScene } from './scenes/PackScene';
import { ShopScene } from './scenes/ShopScene';
import { BracketScene } from './scenes/BracketScene';
import { CalendarScene } from './scenes/CalendarScene';
import { PartnerScene } from './scenes/PartnerScene';
import { MatchScene } from './scenes/MatchScene';
import { ResultScene } from './scenes/ResultScene';
import { AchievementsScene } from './scenes/AchievementsScene';
import { CupsScene } from './scenes/CupsScene';
import { CampScene } from './scenes/CampScene';
import { CampResultScene } from './scenes/CampResultScene';
import { MinigameScene } from './scenes/MinigameScene';
import { DailyScene } from './scenes/DailyScene';
import { WeeklyScene } from './scenes/WeeklyScene';
import { MapScene } from './scenes/MapScene';
import { RankingScene } from './scenes/RankingScene';
import { ConfirmScene } from './scenes/ConfirmScene';
import { CutsceneScene } from './scenes/CutsceneScene';
import { NameEditScene } from './scenes/NameEditScene';
import { CollectionScene } from './scenes/CollectionScene';
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
  render: { powerPreference: 'high-performance' },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // The first scene in the list starts automatically.
  scene: [BootScene, TitleScene, SettingsScene, CharacterScene, SpecialScene, GearScene, ShopScene, PackScene, CalendarScene, BracketScene, PartnerScene, MatchScene, ResultScene, AchievementsScene, CupsScene, CampScene, MinigameScene, CampResultScene, DailyScene, WeeklyScene, MapScene, RankingScene, ConfirmScene, NameEditScene, CollectionScene, TutorialScene, CutsceneScene],
});

// Dev server only: lets screenshot scripts jump to a scene.
// Development builds only: handles for automated checks (the game and the shot list).
if (import.meta.env.DEV) Object.assign(window as unknown as Record<string, unknown>, { __game: game, __shots: SHOTS, __players: playersData });
