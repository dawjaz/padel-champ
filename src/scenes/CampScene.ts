import Phaser from 'phaser';
import { showTip } from '../tutorial/tips';
import { WIDTH } from '../config';
import { CAMP, CAMP_GAMES, campNow, campOpen, canTry, grantExtraTry, nextMilestone, startTry, type CampGameId } from '../career/camp';
import { rewardedAd } from '../ads';
import { goalsWaiting } from '../career/campGoals';
import { dayKey } from '../career/daily';
import { weekKey } from '../career/weekly';
import { getSave, updateSave } from '../save';
import { applyLightScreen, drawBar, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

/** Stars as text (filled and empty). */
export const starText = (n: number, of = 3): string => '★'.repeat(n) + '☆'.repeat(Math.max(0, of - n));

/** The training camp: a few minigame tries a week without a tournament, best stars, fragments towards a Gear Pack. */
export class CampScene extends Phaser.Scene {
  constructor() {
    super('CampScene');
  }

  create(): void {
    this.children.removeAll(true);
    applyLightScreen(this);
    const p = getSave().profile;
    const c = campNow(p);
    screenHeader(this, 'Training Camp', { onBack: () => this.scene.start('CalendarScene'), coins: p.coins });
    const open = campOpen(p);
    themeText(this, WIDTH / 2, 78, open ? `WEEK ${p.career.week}  ·  TRIES LEFT: ${c.triesLeft}` : 'CLOSED WHILE A TOURNAMENT IS ON', { size: 13, color: open ? TC.navy : TC.sub, font: 'display' });
    // fragments towards a Gear Pack, total stars
    const g = this.add.graphics().setPosition(12, 92);
    drawCard(g, WIDTH - 130, 52, { radius: 12 });
    themeText(this, 24, 106, `GEAR PACK FRAGMENTS  ${c.fragments}/${CAMP.fragmentsPerPack}`, { size: 11, color: TC.navy, font: 'display', origin: [0, 0.5] });
    drawBar(this.add.graphics(), 24, 120, WIDTH - 250, 8, c.fragments / CAMP.fragmentsPerPack, TC.orange);
    // the stars here are all the stars earned in trials so far (they pay the fragments), not the best stars of the four games below
    const next = nextMilestone(c.totalStars, c.claimed);
    themeText(this, 24, 136, `${c.totalStars} ★ EARNED  ·  +${next.fragments} FRAGMENTS AT ${next.stars} ★`, { size: 9, color: TC.sub, font: 'body', origin: [0, 0.5] });
    const waiting = goalsWaiting(getSave().campGoals, dayKey(new Date()), weekKey(new Date()));
    makeThemeButton(this, WIDTH - 62, 115, 100, 46, 'GOALS', () => this.scene.start('CampGoalsScene'), waiting ? 'primary' : 'blue', 15);

    CAMP_GAMES.forEach((game, i) => {
      const y = 150 + i * 102;
      const card = this.add.graphics().setPosition(12, y);
      drawCard(card, WIDTH - 24, 94, { radius: 14 });
      themeText(this, 24, y + 18, game.name.toUpperCase(), { size: 15, color: TC.navy, font: 'display', origin: [0, 0.5] });
      themeText(this, WIDTH - 24, y + 18, starText(c.best[game.id] ?? 0), { size: 16, color: TC.orange, origin: [1, 0.5] });
      themeText(this, 24, y + 44, game.desc, { size: 11, color: TC.sub, origin: [0, 0.5], wrap: 210 });
      themeText(this, 24, y + 76, `${game.rounds} ROUNDS  ·  ★ ${game.stars.join(' / ')}`, { size: 9, color: TC.sub, origin: [0, 0.5] });
      const can = canTry(p);
      const b = makeThemeButton(this, WIDTH - 70, y + 60, 96, 40, 'PLAY', () => this.play(game.id), can ? 'primary' : 'secondary', 16);
      if (!can) b.text.setAlpha(0.5);
    });

    // no tries left: one more for a rewarded ad (once a week)
    if (open && c.triesLeft === 0) {
      const more = c.extraUsed < CAMP.extraTriesPerWeek;
      const b = makeThemeButton(this, WIDTH / 2, 572, 300, 42, more ? '+1 TRY: WATCH AN AD' : 'NO TRIES LEFT: COME BACK NEXT WEEK', () => {
        if (!more || !rewardedAd().available()) return;
        void rewardedAd().show().then((ok) => {
          if (!ok) return;
          const next = grantExtraTry(getSave().profile);
          if (next) updateSave((d) => ({ ...d, profile: next }));
          this.scene.restart();
        });
      }, more ? 'blue' : 'secondary', 13);
      if (!more) b.text.setAlpha(0.6);
    }
    themeText(this, WIDTH / 2, 612, 'Rewards: coins, basic boosts and Gear Pack fragments.', { size: 10, color: TC.sub });
    this.time.delayedCall(250, () => showTip(this, 'camp'));
  }

  private play(game: CampGameId): void {
    const next = startTry(getSave().profile);
    if (!next) return;
    updateSave((d) => ({ ...d, profile: next }));
    this.scene.start('MinigameScene', { game });
  }
}
