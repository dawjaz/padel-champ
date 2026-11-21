import Phaser from 'phaser';
import { applyHd } from '../hd';
import { COLORS, css, FONT, WIDTH, HD_SCALE } from '../config';
import { getSave } from '../save';
import type { SideIndex } from '../game/types';
import { levelOf, levelProgress, type Reward } from '../career/profile';
import { logoText, makeButton } from '../ui';

export interface ResultData {
  winner: SideIndex;
  games: [number, number];
  reward?: Reward;
  /** The new level when the match brought a level up, else 0. */
  levelUp?: number;
}

export class ResultScene extends Phaser.Scene {
  private outcome: ResultData = { winner: 0, games: [0, 0] };

  constructor() {
    super('ResultScene');
  }

  init(data: Partial<ResultData>): void {
    this.outcome = { winner: data.winner ?? 0, games: data.games ?? [0, 0], reward: data.reward, levelUp: data.levelUp ?? 0 };
  }

  create(): void {
    applyHd(this);
    const won = this.outcome.winner === 0;
    logoText(this, WIDTH / 2, 110, won ? 'YOU WIN!' : 'YOU LOSE', 48, won ? COLORS.yellow : COLORS.red);

    this.add
      .text(WIDTH / 2, 190, `${this.outcome.games[0]} - ${this.outcome.games[1]}`, {
        fontFamily: FONT, resolution: HD_SCALE,
        fontSize: '40px',
        fontStyle: 'bold',
        color: css(COLORS.white),
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 232, 'GAMES', { fontFamily: FONT, resolution: HD_SCALE, fontSize: '12px', color: css(COLORS.gray) })
      .setOrigin(0.5);

    const s = getSave().stats;
    this.add
      .text(WIDTH / 2, 300, `PLAYED ${s.played}\nWON ${s.won}   LOST ${s.lost}`, {
        fontFamily: FONT, resolution: HD_SCALE,
        fontSize: '16px',
        color: css(COLORS.sky),
        align: 'center',
      })
      .setOrigin(0.5);

    const prof = getSave().profile;
    const lvl = levelOf(prof.xp);
    const rw = this.outcome.reward;
    if (rw) {
      this.add
        .text(WIDTH / 2, 352, `+${rw.xp} XP    +${rw.coins} COINS`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '16px', fontStyle: 'bold', color: css(COLORS.yellow) })
        .setOrigin(0.5);
    }
    this.add
      .text(WIDTH / 2, 378, this.outcome.levelUp ? `LEVEL UP!  LEVEL ${this.outcome.levelUp}` : `LEVEL ${lvl}`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '14px', fontStyle: 'bold', color: css(this.outcome.levelUp ? COLORS.yellow : COLORS.white) })
      .setOrigin(0.5);
    this.add.rectangle(WIDTH / 2, 398, 200, 8, 0x000000, 0.5).setStrokeStyle(1, COLORS.white);
    const barW = Math.round(198 * levelProgress(prof.xp));
    if (barW > 0) this.add.rectangle(WIDTH / 2 - 99, 398, barW, 6, COLORS.sky).setOrigin(0, 0.5);

    makeButton(this, WIDTH / 2, 430, 240, 52, 'REMATCH', () => this.scene.start('MatchScene', { practice: null }));
    makeButton(this, WIDTH / 2 - 62, 500, 116, 52, 'HERO', () => this.scene.start('CharacterScene'));
    makeButton(this, WIDTH / 2 + 62, 500, 116, 52, 'TITLE', () => this.scene.start('TitleScene'));
  }
}
