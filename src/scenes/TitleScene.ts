import Phaser from 'phaser';
import { T, done, getLang, LANG_LABEL, type Lang } from '../i18n';
import type { IconKind } from '../art/icons';
import { addToon } from '../art/toonTexture';
import { heroLook, levelOf, xpToReach } from '../career/profile';
import { tournamentActive } from '../career/careerFlow';
import { BUILD_ID, GAME_SUBTITLE, GAME_TITLE, GAME_VERSION, HEIGHT, SHOW_FREE_PRACTICE, WIDTH } from '../config';
import { dayKey, hasWaiting } from '../career/daily';
import { weekKey, weeklyWaiting } from '../career/weekly';
import { getSave, updateSave } from '../save';
import { applyLightScreen, coinPill, drawBar, drawCard, drawStage, drawXp, iconChip, makeThemeButton, SPORT, TC, themeText } from '../theme';


export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(): void {
    applyLightScreen(this);
    const save = getSave();
    const profile = save.profile;

    // Title bar with the coins.
    const bar = this.add.graphics().setDepth(5);
    bar.fillGradientStyle(TC.navyLight, TC.navyLight, TC.navy, TC.navy, 1);
    bar.fillRect(0, 0, WIDTH, 58);
    bar.fillStyle(TC.navyDark, 1);
    bar.fillRect(0, 55, WIDTH, 3);
    // The brand's one-line logo (POR tag + TRES) in the bar.
    const barLogo = this.add.image(12, 30, 'logo_bar').setOrigin(0, 0.5).setDepth(6);
    barLogo.setScale(44 / barLogo.height);
    for (const o of coinPill(this, WIDTH - 12, 29, profile.coins)) (o as Phaser.GameObjects.Graphics).setDepth?.(6);

    // The hero on a pale stage, with a name plate (level and XP) over the feet.
    drawStage(this, WIDTH / 2, 190, 128);
    const hero = addToon(this, WIDTH / 2, 308, 236, heroLook(profile), 'front');
    this.tweens.add({ targets: hero, y: hero.y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.drawPlate(profile.xp);

    // Daily rewards: a badge on the stage, with a pulsing dot while something waits to be claimed.
    const waiting = hasWaiting(save.daily, dayKey(new Date())) || weeklyWaiting(save.weekly, weekKey(new Date()));
    const dg = this.add.graphics().setPosition(14, 74);
    drawCard(dg, 84, 38, { radius: 12 });
    themeText(this, 56, 93, 'DAILY', { size: 15, font: 'display', color: waiting ? TC.orange : TC.navy });
    const dz = this.add.zone(56, 93, 84, 38).setInteractive({ useHandCursor: true });
    dz.on('pointerdown', () => this.scene.start('DailyScene'));
    if (waiting) {
      const dot = this.add.graphics();
      dot.fillStyle(0xe53935, 1);
      dot.fillCircle(92, 78, 7);
      dot.lineStyle(2, TC.navy, 1);
      dot.strokeCircle(92, 78, 7);
      this.tweens.add({ targets: dot, scale: 1.25, duration: 500, yoyo: true, repeat: -1 });
    }

    // Career is the main button, the four tiles below.
    const locked = tournamentActive(profile);
    const tiles: Phaser.GameObjects.GameObject[] = [];
    const practice: Phaser.GameObjects.GameObject[] = [];
    const showList = (list: Phaser.GameObjects.GameObject[], on: boolean): void => {
      for (const o of list) (o as Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => unknown }).setVisible(on);
    };

    // CAREER in the brand's sport lettering (slanted Anton with a red shadow), like the logo.
    const career = makeThemeButton(this, WIDTH / 2, 410, 328, 60, 'CAREER', () => this.scene.start('CalendarScene'), 'primary', 30);
    (career.text as Phaser.GameObjects.Text).setFontFamily(SPORT).setFontStyle('italic').setLetterSpacing(2).setPadding(8, 4, 12, 4).setShadow(3, 3, '#a81f14', 0, true, true);

    const note = themeText(this, WIDTH / 2, 586, '', { size: 12, color: TC.sub, origin: [0.5, 0.5] });
    const flash = (msg: string): void => {
      note.setText(msg).setColor('#d93f00');
      this.time.delayedCall(2200, () => note.setText('').setColor('#44566f'));
    };

    const entries: Array<{ label: string; icon: IconKind; color: number; lock?: boolean; go: () => void }> = [
      {
        label: 'QUICK MATCH',
        icon: 'speed',
        color: TC.blue,
        go: () =>
          this.scene.start(
            save.settings.tutorialSeen ? 'MatchScene' : 'TutorialScene',
            save.settings.tutorialSeen ? { practice: null, career: null } : { first: true, next: 'MatchScene', data: { practice: null, career: null } },
          ),
      },
      { label: 'HERO', icon: 'top', color: TC.orange, lock: true, go: () => this.scene.start('CharacterScene') },
      { label: 'SHOP', icon: 'coin', color: TC.blue, lock: true, go: () => this.scene.start('ShopScene') },
      { label: 'TROPHIES', icon: 'trophy', color: TC.orange, go: () => this.scene.start('CupsScene') },
    ];
    entries.forEach((e, i) => {
      const x = 16 + (i % 2) * 174;
      const y = 452 + Math.floor(i / 2) * 78;
      const isLocked = locked && e.lock;
      const g = this.add.graphics().setPosition(x, y);
      drawCard(g, 154, 68);
      const chip = this.add.graphics();
      iconChip(chip, x + 10, y + 14, 40, e.color, e.icon);
      const t = themeText(this, x + 60, y + 36, e.label, { size: 16, font: 'display', origin: [0, 0.5] });
      t.setWordWrapWidth(88);
      const z = this.add.zone(x + 77, y + 34, 154, 68).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        if (isLocked) flash('FINISH THE TOURNAMENT FIRST');
        else e.go();
      });
      if (isLocked) for (const o of [g, chip, t]) o.setAlpha(0.5);
      tiles.push(g, chip, t, z);
    });

    // Practice Court, Collection and Settings: small buttons in a row at the bottom.
    const prc = makeThemeButton(this, WIDTH / 2 - 104, 614, 92, 24, 'PRACTICE', () => this.scene.start('MatchScene', { practice: 'court', career: null }), 'secondary', 13);
    tiles.push(...prc.parts);
    const col = makeThemeButton(this, WIDTH / 2, 614, 106, 24, 'COLLECTION', () => this.scene.start('CollectionScene'), 'secondary', 13);
    tiles.push(...col.parts);
    const set = makeThemeButton(this, WIDTH / 2 + 104, 614, 92, 24, 'SETTINGS', () => this.scene.start('SettingsScene'), 'secondary', 13);
    tiles.push(...set.parts);

    // Free Practice stays in the game but hidden (SHOW_FREE_PRACTICE in config.ts brings it back).
    if (SHOW_FREE_PRACTICE) {
      const fp = makeThemeButton(this, WIDTH / 2 - 60, 616, 100, 26, 'PRACTICE', () => { showList(tiles, false); showList(practice, true); }, 'secondary', 13);
      tiles.push(...fp.parts);
    }
    practice.push(...makeThemeButton(this, WIDTH / 2, 470, 240, 52, 'ATTACKING', () => this.scene.start('MatchScene', { practice: 'attack', career: null }), 'blue').parts);
    practice.push(...makeThemeButton(this, WIDTH / 2, 536, 240, 52, 'DEFENDING', () => this.scene.start('MatchScene', { practice: 'defend', career: null }), 'blue').parts);
    practice.push(...makeThemeButton(this, WIDTH / 2, 602, 240, 40, 'BACK', () => { showList(practice, false); showList(tiles, true); }, 'secondary').parts);
    showList(practice, false);

    themeText(this, 16, HEIGHT - 3, done(`${T(GAME_TITLE)}: ${T(GAME_SUBTITLE)}  v${GAME_VERSION} (${BUILD_ID})`), { size: 8, color: TC.sub, weight: '600', origin: [0, 1] }).setAlpha(0.8);

    // The language: a small button for the other language (the choice is kept in the save; Settings has it too).
    const other: Lang = getLang() === 'en' ? 'es' : 'en';
    const langBtn = makeThemeButton(this, WIDTH - 52, 72, 84, 20, LANG_LABEL[other], () => {
      updateSave((d) => ({ ...d, settings: { ...d.settings, language: other } }));
      this.scene.restart();
    }, 'secondary', 10);
    langBtn.text.setDepth(8);
  }

  /** Name plate at the foot of the stage: name, level badge and the XP bar with numbers. */
  private drawPlate(xp: number): void {
    const level = levelOf(xp);
    const into = Math.max(0, xp - xpToReach(level));
    const next = xpToReach(level + 1) - xpToReach(level);
    const c = this.add.container(WIDTH / 2, 318).setRotation(-0.02);
    const g = this.add.graphics();
    drawCard(g, 328, 62, { radius: 16 });
    g.setPosition(-164, -31);
    const prof = getSave().profile;
    const name = themeText(this, -150, -18, prof.name.toUpperCase(), { size: 22, font: 'display', origin: [0, 0.5] });
    const nick = themeText(this, -150, -2, `"${T(prof.nick.toUpperCase())}"`, { size: 10, color: TC.orange, origin: [0, 0.5] });
    const badge = this.add.graphics();
    const bx = -150 + name.width + 10;
    badge.fillStyle(TC.gold, 1);
    badge.fillRoundedRect(bx, -29, 54, 22, 11);
    badge.lineStyle(2, TC.navy, 1);
    badge.strokeRoundedRect(bx, -29, 54, 22, 11);
    const lv = themeText(this, bx + 27, -18, T('LVL {0}', level), { size: 12, origin: [0.5, 0.5] });
    const xpLabel = this.add.graphics();
    drawXp(xpLabel, -142, 15, 8);
    const xb = this.add.graphics();
    drawBar(xb, -128, 8, 170, 14, next > 0 ? into / next : 1, TC.orange);
    const num = themeText(this, 150, 15, `${into.toLocaleString('en-US')} / ${next.toLocaleString('en-US')}`, { size: 12, origin: [1, 0.5] });
    c.add([g, name, nick, badge, lv, xpLabel, xb, num]);
  }
}
