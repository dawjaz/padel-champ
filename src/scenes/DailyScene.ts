import Phaser from 'phaser';
import { T } from '../i18n';
import { WIDTH } from '../config';
import { BONUS_COINS, bonusReady, claimBonus, claimLogin, claimTask, dayKey, loginReward, loginStatus, STREAK_LENGTH, TASK_COINS, taskViews } from '../career/daily';
import { weekKey, weeklyWaiting } from '../career/weekly';
import { showTip } from '../tutorial/tips';
import { getSave, updateSave } from '../save';
import { sfx } from '../audio';
import { applyLightScreen, drawBar, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

/** Daily login reward (7-day streak) and the three tasks of the day with a bonus for all of them. */
export class DailyScene extends Phaser.Scene {
  constructor() {
    super('DailyScene');
  }

  create(): void {
    this.render(true);
    this.time.delayedCall(250, () => showTip(this, 'tasks'));
  }

  private render(first = false): void {
    this.children.removeAll(true);
    applyLightScreen(this, first);
    const today = dayKey(new Date());
    const save = getSave();
    const daily = save.daily;
    screenHeader(this, 'Daily', { onBack: () => this.scene.start('TitleScene'), coins: save.profile.coins });

    // Login streak: seven days, the reward of today is claimed with a button.
    const s = loginStatus(daily, today);
    const g = this.add.graphics().setPosition(12, 72);
    drawCard(g, WIDTH - 24, 168, { radius: 16 });
    themeText(this, 24, 90, 'DAILY LOGIN', { size: 18, font: 'display', origin: [0, 0.5] });
    themeText(this, WIDTH - 24, 90, T('STREAK {0}', s.claimable ? (s.streak > 1 ? s.streak - 1 : 0) : s.streak), { size: 12, color: TC.orange, font: 'display', origin: [1, 0.5] });
    const claimedDays = s.claimable ? (s.streak > 1 ? s.day - 1 : 0) : s.day;
    for (let i = 1; i <= STREAK_LENGTH; i++) {
      const x = 22 + (i - 1) * 47;
      const y = 108;
      const done = i <= claimedDays;
      const now = s.claimable && i === s.day;
      const t = this.add.graphics();
      t.fillStyle(done ? TC.gold : now ? 0xfff3d6 : TC.track, 1);
      t.fillRoundedRect(x, y, 42, 60, 10);
      t.lineStyle(now ? 3 : 2, now ? TC.orange : TC.navy, 1);
      t.strokeRoundedRect(x, y, 42, 60, 10);
      themeText(this, x + 21, y + 12, T('DAY {0}', i), { size: 9, font: 'display' });
      const rw = loginReward(i);
      themeText(this, x + 21, y + 30, done ? 'OK' : rw.pack ? 'PACK' : `${rw.coins}`, { size: rw.pack && !done ? 11 : 14, font: 'display', color: done ? TC.navy : TC.orange });
      if (rw.pack) themeText(this, x + 21, y + 49, `+${rw.coins}`, { size: 9, font: 'display', color: TC.sub });
      if (now) this.tweens.add({ targets: t, alpha: 0.6, duration: 600, yoyo: true, repeat: -1 });
    }
    if (s.claimable) {
      const rw = loginReward(s.day);
      makeThemeButton(this, WIDTH / 2, 205, 270, 44, T('CLAIM  +{0} COINS{1}', rw.coins, rw.pack ? '  +PACK' : ''), () => {
        updateSave((d) => {
          const r = claimLogin(d.profile, d.daily, today);
          return r ? { ...d, profile: r.profile, daily: r.daily } : d;
        });
        sfx('win');
        this.render();
      }, 'primary', 16);
    } else {
      themeText(this, WIDTH / 2, 205, 'CLAIMED. COME BACK TOMORROW!', { size: 14, color: TC.sub, font: 'display' });
    }

    // Tasks of the day (only career matches count).
    themeText(this, 16, 262, 'TODAY\'S TASKS', { size: 16, font: 'display', origin: [0, 0.5] });
    themeText(this, WIDTH - 16, 262, 'CAREER MATCHES ONLY', { size: 10, color: TC.sub, font: 'display', origin: [1, 0.5] });
    taskViews(daily, today).forEach((v, i) => {
      const y = 280 + i * 76;
      const card = this.add.graphics().setPosition(12, y);
      drawCard(card, WIDTH - 24, 68, { radius: 14, fill: v.claimed ? 0xe9f6ec : TC.white });
      themeText(this, 24, y + 18, v.def.text.toUpperCase(), { size: 13, font: 'display', origin: [0, 0.5] }).setWordWrapWidth(210);
      const bar = this.add.graphics();
      drawBar(bar, 24, y + 44, 150, 12, v.have / v.def.n, TC.orange);
      themeText(this, 182, y + 50, `${v.have}/${v.def.n}`, { size: 12, color: TC.sub, font: 'display', origin: [0, 0.5] });
      if (v.claimed) themeText(this, WIDTH - 62, y + 34, 'DONE', { size: 16, color: 0x2e8b57, font: 'display' });
      else if (v.done) {
        makeThemeButton(this, WIDTH - 72, y + 34, 100, 44, `+${TASK_COINS}`, () => {
          updateSave((d) => {
            const r = claimTask(d.profile, d.daily, today, v.def.id);
            return r ? { ...d, profile: r.profile, daily: r.daily } : d;
          });
          sfx('point');
          this.render();
        }, 'primary', 18);
      } else themeText(this, WIDTH - 62, y + 34, `+${TASK_COINS}`, { size: 16, color: TC.sub, font: 'display' });
    });

    // Bonus for all three.
    const by = 280 + 3 * 76 + 4;
    const b = this.add.graphics().setPosition(12, by);
    const ready = bonusReady(daily, today);
    drawCard(b, WIDTH - 24, 62, { radius: 14, fill: daily.bonusClaimed ? 0xe9f6ec : ready ? 0xfff3d6 : TC.white, stroke: ready ? TC.orange : TC.navy });
    themeText(this, 24, by + 31, 'ALL 3 TASKS BONUS', { size: 14, font: 'display', origin: [0, 0.5] });
    if (daily.bonusClaimed) themeText(this, WIDTH - 62, by + 31, 'DONE', { size: 16, color: 0x2e8b57, font: 'display' });
    else if (ready) {
      makeThemeButton(this, WIDTH - 78, by + 31, 112, 44, `+${BONUS_COINS}`, () => {
        updateSave((d) => {
          const r = claimBonus(d.profile, d.daily, today);
          return r ? { ...d, profile: r.profile, daily: r.daily } : d;
        });
        sfx('win');
        this.render();
      }, 'primary', 18);
    } else themeText(this, WIDTH - 62, by + 31, `+${BONUS_COINS}`, { size: 16, color: TC.sub, font: 'display' });

    makeThemeButton(this, WIDTH / 2, 606, 270, 38, 'WEEKLY CHALLENGES', () => this.scene.start('WeeklyScene'), 'blue', 14);
    // The same pulsing dot as on the main menu: something of the weekly challenges is waiting to be claimed.
    if (weeklyWaiting(save.weekly, weekKey(new Date()))) {
      const dot = this.add.graphics().setPosition(WIDTH / 2 + 128, 589).setDepth(8);
      dot.fillStyle(0xe53935, 1);
      dot.fillCircle(0, 0, 7);
      dot.lineStyle(2, TC.navy, 1);
      dot.strokeCircle(0, 0, 7);
      this.tweens.add({ targets: dot, scale: 1.25, duration: 500, yoyo: true, repeat: -1 });
    }
  }
}
