import Phaser from 'phaser';
import { applyScreen } from '../hd';
import { COLORS, css, FONT, WIDTH, HD_SCALE } from '../config';
import { ACHIEVEMENTS, progressOf } from '../career/achievements';
import { getSave } from '../save';
import { logoText, makeButton } from '../ui';

const PER_PAGE = 6;

export class AchievementsScene extends Phaser.Scene {
  private page = 0;

  constructor() {
    super('AchievementsScene');
  }

  create(): void {
    this.page = 0;
    this.cameras.main.fadeIn(220, 8, 8, 24);
    this.render();
  }

  private render(): void {
    this.children.removeAll(true);
    applyScreen(this, false);
    const save = getSave();
    const prog = progressOf(save.stats, save.records, save.profile);
    logoText(this, WIDTH / 2, 50, 'TROPHIES', 30, COLORS.yellow);
    this.add
      .text(WIDTH / 2, 86, `${save.achievements.length} / ${ACHIEVEMENTS.length} UNLOCKED`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '12px', color: css(COLORS.sky) })
      .setOrigin(0.5);
    const pages = Math.ceil(ACHIEVEMENTS.length / PER_PAGE);
    ACHIEVEMENTS.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((a, i) => {
      const y = 128 + i * 62;
      const done = save.achievements.includes(a.id);
      this.add.rectangle(WIDTH / 2, y, 330, 54, done ? 0x1d4d2b : 0x000000, done ? 0.9 : 0.45).setStrokeStyle(2, done ? COLORS.yellow : COLORS.gray);
      this.add.text(24, y - 18, a.name.toUpperCase(), { fontFamily: FONT, resolution: HD_SCALE, fontSize: '13px', fontStyle: 'bold', color: css(done ? COLORS.yellow : COLORS.white) });
      this.add.text(24, y + 1, a.desc, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '10px', color: css(COLORS.gray) });
      const have = Math.min(prog[a.stat], a.n);
      this.add
        .text(WIDTH - 24, y - 18, done ? 'DONE' : `${have}/${a.n}`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '11px', fontStyle: 'bold', color: css(done ? COLORS.yellow : COLORS.sky) })
        .setOrigin(1, 0);
      this.add.text(WIDTH - 24, y + 1, `+${a.coins} COINS`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '10px', color: css(COLORS.gray) }).setOrigin(1, 0);
    });
    makeButton(this, 60, 560, 84, 44, '<', () => { this.page = (this.page + pages - 1) % pages; this.render(); });
    this.add.text(WIDTH / 2 - 30, 560, `${this.page + 1}/${pages}`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '12px', color: css(COLORS.white) }).setOrigin(0.5);
    makeButton(this, 140, 560, 84, 44, '>', () => { this.page = (this.page + 1) % pages; this.render(); });
    makeButton(this, 276, 560, 130, 44, 'BACK', () => this.scene.start('TitleScene'));
  }
}
