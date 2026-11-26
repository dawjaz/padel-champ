import Phaser from 'phaser';
import { WIDTH } from '../config';
import { claimGoal, GOAL_COINS, goalViews, type Period } from '../career/campGoals';
import { dayKey } from '../career/daily';
import { weekKey } from '../career/weekly';
import { sfx } from '../audio';
import { getSave, updateSave } from '../save';
import { applyLightScreen, drawBar, drawCard, makeThemeButton, rewardRow, screenHeader, TC, themeText } from '../theme';

/** The camp goals: two small goals for today and two for this week, fed by the camp minigames. Each pays coins once. */
export class CampGoalsScene extends Phaser.Scene {
  constructor() {
    super('CampGoalsScene');
  }

  create(): void {
    this.children.removeAll(true);
    applyLightScreen(this);
    const s = getSave();
    const now = new Date();
    const day = dayKey(now);
    const week = weekKey(now);
    screenHeader(this, 'Camp Goals', { onBack: () => this.scene.start('CampScene'), coins: s.profile.coins });
    let y = 84;
    for (const period of ['day', 'week'] as Period[]) {
      themeText(this, 18, y + 8, period === 'day' ? 'TODAY' : 'THIS WEEK', { size: 14, color: TC.navy, font: 'display', origin: [0, 0.5] });
      themeText(this, WIDTH - 18, y + 8, period === 'day' ? 'NEW GOALS TOMORROW' : 'NEW GOALS ON MONDAY', { size: 9, color: TC.sub, origin: [1, 0.5] });
      y += 22;
      for (const v of goalViews(s.campGoals, period, day, week)) {
        const card = this.add.graphics().setPosition(12, y);
        drawCard(card, WIDTH - 24, 78, { radius: 14, stroke: v.done && !v.claimed ? TC.orange : TC.navy });
        themeText(this, 24, y + 18, v.def.text.toUpperCase(), { size: 12, color: TC.navy, font: 'display', origin: [0, 0.5], wrap: 200 });
        drawBar(this.add.graphics(), 24, y + 52, 190, 12, v.have / v.def.n, v.done ? TC.green : TC.blue);
        themeText(this, 222, y + 58, `${v.have}/${v.def.n}`, { size: 11, color: TC.navy, font: 'display', origin: [0, 0.5] });
        if (v.claimed) {
          themeText(this, WIDTH - 24, y + 39, 'CLAIMED', { size: 12, color: TC.green, font: 'display', origin: [1, 0.5] });
        } else if (v.done) {
          makeThemeButton(this, WIDTH - 66, y + 48, 90, 34, `CLAIM`, () => this.claim(period, v.def.id), 'primary', 14);
          rewardRow(this, WIDTH - 66, y + 14, [{ kind: 'coin', text: `+${GOAL_COINS[period]}` }], { size: 11 });
        } else {
          rewardRow(this, WIDTH - 66, y + 39, [{ kind: 'coin', text: `${GOAL_COINS[period]}` }], { size: 14, color: TC.sub });
        }
        y += 84;
      }
      y += 8;
    }
    themeText(this, WIDTH / 2, 612, 'Goals count camp trials played from now on. Rewards: coins.', { size: 10, color: TC.sub });
  }

  private claim(period: Period, id: string): void {
    const s = getSave();
    const now = new Date();
    const r = claimGoal(s.profile, s.campGoals, period, dayKey(now), weekKey(now), id);
    if (!r) return;
    updateSave((d) => ({ ...d, profile: r.profile, campGoals: r.goals }));
    sfx('win');
    this.scene.restart();
  }
}
