import Phaser from 'phaser';
import { ensureCharacterTexture } from '../art/characterTexture';
import { applyHd } from '../hd';
import { BALL_KEY, ensureBallTextures } from '../art/hdTextures';
import { HD_CHARACTER_SCALE } from '../art/hd/characterHd';
import { BUILD_ID, COLORS, SHOW_FREE_PRACTICE, css, FONT, GAME_TITLE, GAME_VERSION, HD_SCALE, HEIGHT, WIDTH } from '../config';
import playersData from '../data/players.json';
import type { PlayerDef } from '../game/types';
import { getSave } from '../save';
import { logoText, makeButton } from '../ui';

const HEROES = playersData.you as unknown as PlayerDef[];

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(): void {
    applyHd(this);
    this.drawBackdrop();

    // Logo: PADEL / CHAMP / [26]
    logoText(this, WIDTH / 2, 80, 'PADEL', 64, COLORS.yellow);
    logoText(this, WIDTH / 2, 146, 'CHAMP', 64, COLORS.white);
    const badge = this.add.rectangle(WIDTH / 2, 215, 90, 46, COLORS.red).setStrokeStyle(4, COLORS.white);
    const badgeText = logoText(this, WIDTH / 2, 215, '26', 36, COLORS.white);
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        const on = !badge.visible;
        badge.setVisible(on);
        badgeText.setVisible(on);
      },
    });

    this.add
      .text(WIDTH / 2, 262, 'COMMAND PADEL', { fontFamily: FONT, resolution: HD_SCALE, fontSize: '14px', color: css(COLORS.sky) })
      .setOrigin(0.5);

    // Bouncing ball
    ensureBallTextures(this);
    const ball = this.add.image(WIDTH / 2, 310, BALL_KEY).setDisplaySize(20, 20);
    this.tweens.add({ targets: ball, y: 350, duration: 380, yoyo: true, repeat: -1, ease: 'Quad.easeIn' });

    // The two heroes flank the ball, bouncing on the spot
    HEROES.forEach((hero, i) => {
      const key = ensureCharacterTexture(this, hero.appearance, 'front');
      const sprite = this.add.image(i === 0 ? 62 : WIDTH - 62, 388, key).setOrigin(0.5, 1).setScale(2.3 / HD_CHARACTER_SCALE);
      this.tweens.add({
        targets: sprite,
        y: 382,
        duration: 420,
        yoyo: true,
        repeat: -1,
        delay: i * 210,
        ease: 'Sine.easeInOut',
      });
    });

    // Menu
    const mainMenu: Phaser.GameObjects.GameObject[] = [];
    const practiceMenu: Phaser.GameObjects.GameObject[] = [];
    const show = (list: Phaser.GameObjects.GameObject[], on: boolean): void => {
      for (const o of list) (o as Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => unknown }).setVisible(on);
    };
    const add = (list: Phaser.GameObjects.GameObject[], b: { parts: Phaser.GameObjects.GameObject[] }): void => {
      list.push(...b.parts);
    };
    // Free Practice stays in the game but is hidden from the menu (set SHOW_FREE_PRACTICE in config.ts to bring it back).
    const entries: Array<[string, () => void]> = [
      ['QUICK MATCH', () => this.scene.start('MatchScene', { practice: null, career: null })],
      ['CAREER', () => this.scene.start('CalendarScene')],
      ['HERO', () => this.scene.start('CharacterScene')],
      ['SHOP', () => this.scene.start('ShopScene')],
    ];
    if (SHOW_FREE_PRACTICE) entries.push(['FREE PRACTICE', () => { show(mainMenu, false); show(practiceMenu, true); }]);
    entries.push(['SETTINGS', () => this.scene.start('SettingsScene')]);
    const step = Math.max(34, Math.min(42, 164 / (entries.length - 1)));
    entries.forEach(([label, fn], i) => add(mainMenu, makeButton(this, WIDTH / 2, 408 + i * step, 220, step - 8, label, fn)));
    add(practiceMenu, makeButton(this, WIDTH / 2, 436, 220, 52, 'ATTACKING', () => this.scene.start('MatchScene', { practice: 'attack', career: null })));
    add(practiceMenu, makeButton(this, WIDTH / 2, 496, 220, 52, 'DEFENDING', () => this.scene.start('MatchScene', { practice: 'defend', career: null })));
    add(practiceMenu, makeButton(this, WIDTH / 2, 556, 220, 52, 'BACK', () => { show(practiceMenu, false); show(mainMenu, true); }));
    show(practiceMenu, false);

    const s = getSave().stats;
    const statsLine = s.played === 0 ? 'NO MATCHES YET' : `PLAYED ${s.played}  WON ${s.won}  LOST ${s.lost}`;
    this.add
      .text(WIDTH / 2, 612, statsLine, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '12px', color: css(COLORS.gray) })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT - 14, `${GAME_TITLE}  v${GAME_VERSION} (${BUILD_ID})`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '10px', color: css(COLORS.gray) })
      .setOrigin(0.5);
  }

  private drawBackdrop(): void {
    const g = this.add.graphics();
    // Court-coloured floor with lines, behind the menu
    g.fillStyle(COLORS.court, 1);
    g.fillRect(0, 390, WIDTH, HEIGHT - 390);
    g.lineStyle(3, COLORS.courtLine, 0.5);
    g.lineBetween(0, 390, WIDTH, 390);
    g.lineBetween(WIDTH / 2, 390, WIDTH / 2, HEIGHT);
    g.lineStyle(3, COLORS.courtLine, 0.25);
    g.lineBetween(0, 560, WIDTH, 560);
  }
}
