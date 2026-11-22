import Phaser from 'phaser';
import { WIDTH } from '../config';
import { ACHIEVEMENTS, progressOf } from '../career/achievements';
import { getSave } from '../save';
import { applyLightScreen, drawBar, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

const PER_PAGE = 6;

export class AchievementsScene extends Phaser.Scene {
  private page = 0;

  constructor() {
    super('AchievementsScene');
  }

  create(): void {
    this.page = 0;
    this.render(true);
  }

  private render(first = false): void {
    this.children.removeAll(true);
    applyLightScreen(this, first);
    const save = getSave();
    const prog = progressOf(save.stats, save.records, save.profile);
    screenHeader(this, 'Trophies', { onBack: () => this.scene.start('TitleScene'), coins: save.profile.coins });
    themeText(this, WIDTH / 2, 78, `${save.achievements.length} / ${ACHIEVEMENTS.length} UNLOCKED`, { size: 12, color: TC.sub, font: 'display' });
    const pages = Math.ceil(ACHIEVEMENTS.length / PER_PAGE);
    ACHIEVEMENTS.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((a, i) => {
      const y = 96 + i * 66;
      const done = save.achievements.includes(a.id);
      const g = this.add.graphics().setPosition(12, y);
      drawCard(g, WIDTH - 24, 60, { radius: 14, stroke: done ? TC.orange : TC.navy, fill: done ? 0xfff3d6 : TC.white });
      // Medal
      const m = this.add.graphics();
      m.fillStyle(done ? TC.gold : TC.track, 1);
      m.fillCircle(40, y + 30, 16);
      m.lineStyle(2.5, TC.navy, 1);
      m.strokeCircle(40, y + 30, 16);
      if (done) {
        m.lineStyle(3.5, TC.navy, 1);
        m.beginPath();
        m.moveTo(33, y + 30);
        m.lineTo(38, y + 36);
        m.lineTo(48, y + 24);
        m.strokePath();
      }
      themeText(this, 66, y + 17, a.name.toUpperCase(), { size: 14, color: TC.navy, font: 'display', origin: [0, 0.5] });
      themeText(this, 66, y + 36, a.desc, { size: 10, color: TC.sub, origin: [0, 0.5] });
      const have = Math.min(prog[a.stat], a.n);
      if (!done) {
        const b = this.add.graphics();
        drawBar(b, 66, y + 46, 150, 7, have / a.n, TC.blue);
      }
      themeText(this, WIDTH - 24, y + 17, done ? 'DONE' : `${have}/${a.n}`, { size: 12, color: done ? TC.green : TC.blue, font: 'display', origin: [1, 0.5] });
      themeText(this, WIDTH - 24, y + 38, `+${a.coins} COINS`, { size: 10, color: TC.orange, origin: [1, 0.5] });
    });
    makeThemeButton(this, 40, 610, 44, 40, '<', () => { this.page = (this.page + pages - 1) % pages; this.render(); }, 'secondary', 18);
    themeText(this, 90, 610, `${this.page + 1}/${pages}`, { size: 13, color: TC.navy, font: 'display' });
    makeThemeButton(this, 140, 610, 44, 40, '>', () => { this.page = (this.page + 1) % pages; this.render(); }, 'secondary', 18);
  }
}
