import Phaser from 'phaser';
import { T } from '../i18n';
import { WIDTH } from '../config';
import { addTrial } from '../career/campGoals';
import { addCampTrial, dayKey } from '../career/daily';
import { addWeeklyCampTrial, weekKey } from '../career/weekly';
import { campGame, finishTry, starsFor, type CampGameId, type CampReward } from '../career/camp';
import { consumableById } from '../career/gear';
import { rewardedAd } from '../ads';
import { getSave, updateSave } from '../save';
import { sfx } from '../audio';
import { applyLightScreen, drawCard, makeThemeButton, rewardRow, screenHeader, TC, themeText } from '../theme';
import { starText } from './CampScene';

/** The end of a minigame try: stars, then the reward collected as it is or doubled for a rewarded ad. */
export class CampResultScene extends Phaser.Scene {
  private gameId: CampGameId = 'targets';
  private score = 0;
  private collected: CampReward | null = null;

  constructor() {
    super('CampResultScene');
  }

  init(data: { game: CampGameId; score: number }): void {
    this.gameId = data.game;
    this.score = data.score;
    this.collected = null;
  }

  create(): void {
    this.render();
  }

  private collect(double: boolean): void {
    if (this.collected) return;
    const r = finishTry(getSave().profile, this.gameId, this.score, Math.random, double);
    const now = new Date();
    updateSave((d) => ({
      ...d,
      profile: r.profile,
      campGoals: addTrial(d.campGoals, dayKey(now), weekKey(now), this.gameId, r.reward.stars),
      daily: addCampTrial(d.daily, dayKey(now), r.reward.stars),
      weekly: addWeeklyCampTrial(d.weekly, weekKey(now), r.reward.stars),
    }));
    this.collected = r.reward;
    sfx('win');
    this.render();
  }

  private render(): void {
    this.children.removeAll(true);
    applyLightScreen(this, false);
    const p = getSave().profile;
    screenHeader(this, 'Camp Result', { coins: p.coins });
    const g = campGame(this.gameId);
    const stars = starsFor(this.gameId, this.score);
    const card = this.add.graphics().setPosition(16, 90);
    drawCard(card, WIDTH - 32, 250, { radius: 16 });
    themeText(this, WIDTH / 2, 118, g.name.toUpperCase(), { size: 18, color: TC.navy, font: 'display' });
    themeText(this, WIDTH / 2, 166, starText(stars), { size: 44, color: stars > 0 ? TC.orange : TC.sub });
    themeText(this, WIDTH / 2, 212, T('SCORE {0}', this.score), { size: 16, color: TC.navy, font: 'display' });
    themeText(this, WIDTH / 2, 236, `★ ${g.stars[0]}   ★★ ${g.stars[1]}   ★★★ ${g.stars[2]}`, { size: 10, color: TC.sub });
    if (this.collected) {
      const r = this.collected;
      rewardRow(this, WIDTH / 2, 270, [{ kind: 'coin', text: `+${r.coins}` }], { size: 16 });
      const extra: string[] = [];
      if (r.boost) extra.push(T('BOOST: {0}', (consumableById(r.boost)?.name ?? r.boost).toUpperCase()));
      if (r.fragments > 0) extra.push(T('+{0} GEAR PACK FRAGMENTS', r.fragments));
      if (r.packs > 0) extra.push(T('{0} GEAR PACK{1} COMPLETED!', r.packs, T(r.packs > 1 ? 'S' : '')));
      if (r.newBest) extra.push('NEW BEST!');
      themeText(this, WIDTH / 2, 306, extra.join('\n'), { size: 11, color: TC.orange, font: 'display', align: 'center' });
      makeThemeButton(this, WIDTH / 2, 396, 300, 50, 'BACK TO CAMP', () => this.scene.start('CampScene'), 'primary', 18);
      if (r.packs > 0) makeThemeButton(this, WIDTH / 2, 456, 300, 44, 'OPEN PACKS', () => this.scene.start('PackScene'), 'blue', 15);
    } else {
      themeText(this, WIDTH / 2, 280, 'COLLECT YOUR REWARD', { size: 12, color: TC.sub, font: 'display' });
      makeThemeButton(this, WIDTH / 2, 396, 300, 50, 'COLLECT', () => this.collect(false), 'primary', 18);
      makeThemeButton(this, WIDTH / 2, 456, 300, 44, 'x2 COINS: WATCH AN AD', () => {
        if (!rewardedAd().available()) return;
        void rewardedAd().show().then((ok) => this.collect(ok));
      }, 'blue', 14);
    }
  }
}
