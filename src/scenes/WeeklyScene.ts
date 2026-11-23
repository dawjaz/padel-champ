import Phaser from 'phaser';
import { WIDTH } from '../config';
import { claimWeeklyBonus, claimWeeklyTask, daysLeft, WEEKLY_BONUS_COINS, WEEKLY_TASK_COINS, weekKey, weeklyBonusReady, weeklyViews } from '../career/weekly';
import { getSave, updateSave } from '../save';
import { sfx } from '../audio';
import { applyLightScreen, drawBar, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

/** Three bigger tasks a week (Monday to Sunday), with a pack and coins for finishing all of them. Career matches only. */
export class WeeklyScene extends Phaser.Scene {
  constructor() {
    super('WeeklyScene');
  }

  create(): void {
    this.render(true);
  }

  private render(first = false): void {
    this.children.removeAll(true);
    applyLightScreen(this, first);
    const now = new Date();
    const week = weekKey(now);
    const save = getSave();
    const weekly = save.weekly;
    screenHeader(this, 'Weekly', { onBack: () => this.scene.start('DailyScene'), coins: save.profile.coins });

    const left = daysLeft(now);
    themeText(this, 16, 82, 'THIS WEEK\'S CHALLENGES', { size: 16, font: 'display', origin: [0, 0.5] });
    themeText(this, WIDTH - 16, 82, left === 0 ? 'LAST DAY' : `${left + 1} DAYS LEFT`, { size: 11, color: TC.orange, font: 'display', origin: [1, 0.5] });
    themeText(this, 16, 102, 'CAREER MATCHES ONLY', { size: 10, color: TC.sub, font: 'display', origin: [0, 0.5] });

    weeklyViews(weekly, week).forEach((v, i) => {
      const y = 120 + i * 92;
      const card = this.add.graphics().setPosition(12, y);
      drawCard(card, WIDTH - 24, 84, { radius: 14, fill: v.claimed ? 0xe9f6ec : TC.white });
      themeText(this, 24, y + 22, v.def.text.toUpperCase(), { size: 13, font: 'display', origin: [0, 0.5] }).setWordWrapWidth(200);
      const bar = this.add.graphics();
      drawBar(bar, 24, y + 58, 150, 12, v.have / v.def.n, TC.orange);
      themeText(this, 182, y + 64, `${v.have}/${v.def.n}`, { size: 12, color: TC.sub, font: 'display', origin: [0, 0.5] });
      if (v.claimed) themeText(this, WIDTH - 62, y + 42, 'DONE', { size: 16, color: 0x2e8b57, font: 'display' });
      else if (v.done) {
        makeThemeButton(this, WIDTH - 72, y + 42, 100, 46, `+${WEEKLY_TASK_COINS}`, () => {
          updateSave((d) => {
            const r = claimWeeklyTask(d.profile, d.weekly, week, v.def.id);
            return r ? { ...d, profile: r.profile, weekly: r.weekly } : d;
          });
          sfx('point');
          this.render();
        }, 'primary', 18);
      } else themeText(this, WIDTH - 62, y + 42, `+${WEEKLY_TASK_COINS}`, { size: 16, color: TC.sub, font: 'display' });
    });

    const by = 120 + 3 * 92 + 4;
    const b = this.add.graphics().setPosition(12, by);
    const ready = weeklyBonusReady(weekly, week);
    drawCard(b, WIDTH - 24, 74, { radius: 14, fill: weekly.week === week && weekly.bonusClaimed ? 0xe9f6ec : ready ? 0xfff3d6 : TC.white, stroke: ready ? TC.orange : TC.navy });
    themeText(this, 24, by + 24, 'ALL 3 CHALLENGES BONUS', { size: 14, font: 'display', origin: [0, 0.5] });
    themeText(this, 24, by + 50, `+${WEEKLY_BONUS_COINS} COINS  +GEAR PACK`, { size: 11, color: TC.sub, font: 'display', origin: [0, 0.5] });
    if (weekly.week === week && weekly.bonusClaimed) themeText(this, WIDTH - 62, by + 37, 'DONE', { size: 16, color: 0x2e8b57, font: 'display' });
    else if (ready) {
      makeThemeButton(this, WIDTH - 78, by + 37, 112, 46, 'CLAIM', () => {
        updateSave((d) => {
          const r = claimWeeklyBonus(d.profile, d.weekly, week);
          return r ? { ...d, profile: r.profile, weekly: r.weekly } : d;
        });
        sfx('win');
        this.render();
      }, 'primary', 18);
    }

    makeThemeButton(this, WIDTH / 2, 606, 270, 38, 'DAILY TASKS', () => this.scene.start('DailyScene'), 'blue', 14);
  }
}
