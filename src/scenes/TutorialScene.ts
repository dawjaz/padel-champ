import Phaser from 'phaser';
import { T } from '../i18n';
import { WIDTH } from '../config';
import { getSave, updateSave } from '../save';
import { FIRST_RUN, LESSONS, newTips, setTipsOff, type LessonGroup } from '../tutorial/lessons';
import { openLessons } from '../tutorial/tips';
import { applyLightScreen, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

const GROUPS: LessonGroup[] = ['MATCH', 'SHOTS', 'HERO', 'CAREER', 'CAMP'];

/**
 * HOW TO PLAY: the list of lessons by topic (a tick on the ones seen); a touch opens one over this screen (TipScene). On the very
 * first game the basics play in a row before the first match (`first`).
 */
export class TutorialScene extends Phaser.Scene {
  private group: LessonGroup = 'MATCH';
  private first = false;
  private next: { scene: string; data?: object } = { scene: 'SettingsScene' };

  constructor() {
    super('TutorialScene');
  }

  init(data: { first?: boolean; next?: string; data?: object }): void {
    this.first = data.first === true;
    this.next = { scene: data.next ?? 'SettingsScene', data: data.data };
    this.group = 'MATCH';
    this.sys.settings.data = {};
  }

  create(): void {
    if (this.first) {
      applyLightScreen(this, false);
      this.time.delayedCall(50, () => openLessons(this, FIRST_RUN, () => this.finish()));
      return;
    }
    this.render();
  }

  private finish(): void {
    updateSave((d) => ({ ...d, settings: { ...d.settings, tutorialSeen: true } }));
    this.scene.start(this.next.scene, this.next.data);
  }

  private render(): void {
    this.children.removeAll(true);
    applyLightScreen(this, false);
    screenHeader(this, 'How to play', { onBack: () => this.scene.start(this.next.scene, this.next.data) });
    const seen = getSave().tips.seen;
    GROUPS.forEach((g, i) => {
      const w = 62;
      const b = makeThemeButton(this, 18 + w / 2 + i * (w + 4), 92, w, 30, g, () => { this.group = g; this.render(); }, g === this.group ? 'primary' : 'secondary', 11);
      void b;
    });
    LESSONS.filter((l) => l.group === this.group).forEach((l, i) => {
      const y = 118 + i * 70;
      const ok = seen.includes(l.id);
      const card = this.add.graphics().setPosition(14, y);
      drawCard(card, WIDTH - 28, 62, { radius: 14, stroke: ok ? TC.navy : TC.orange });
      themeText(this, 28, y + 22, l.title, { size: 15, font: 'display', origin: [0, 0.5] });
      themeText(this, 28, y + 44, `${l.pages.length} ${l.pages.length === 1 ? 'PAGE' : 'PAGES'}${ok ? '  ·  SEEN' : '  ·  NEW'}`, { size: 10, color: ok ? TC.sub : TC.orange, origin: [0, 0.5] });
      makeThemeButton(this, WIDTH - 64, y + 31, 76, 36, ok ? 'AGAIN' : 'PLAY', () => openLessons(this, [l.id], () => this.render()), ok ? 'blue' : 'primary', 13);
    });
    makeThemeButton(this, WIDTH / 2, 518, 290, 40, 'WATCH ALL LESSONS', () => openLessons(this, LESSONS.map((l) => l.id), () => this.render()), 'primary', 16);
    makeThemeButton(this, WIDTH / 2, 562, 290, 34, 'SHOW EVERY TIP AGAIN IN PLAY', () => {
      updateSave((d) => ({ ...d, tips: { ...newTips(), off: false } }));
      this.render();
    }, 'secondary', 12);
    const tipsLabel = (): string => T('TIPS DURING PLAY: {0}', T(getSave().tips.off ? 'OFF' : 'ON'));
    const t = makeThemeButton(this, WIDTH / 2, 600, 290, 40, tipsLabel(), () => {
      updateSave((d) => ({ ...d, tips: setTipsOff(d.tips, !d.tips.off) }));
      t.text.setText(tipsLabel());
    }, 'secondary', 14);
  }
}
