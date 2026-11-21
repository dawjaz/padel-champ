import Phaser from 'phaser';
import { applyScreen } from '../hd';
import { COLORS, css, FONT, WIDTH, HD_SCALE } from '../config';
import { getSave } from '../save';
import { tournamentActive } from '../career/careerFlow';
import type { SideIndex } from '../game/types';
import { levelOf, levelProgress, type Reward } from '../career/profile';
import { logoText, makeButton } from '../ui';

export interface ResultData {
  winner: SideIndex;
  games: [number, number];
  reward?: Reward;
  /** The new level when the match brought a level up, else 0. */
  levelUp?: number;
  /** Free packs this match brought (one per level up). */
  packs?: number;
  /** A career match: the tournament goes on or ends here. */
  career?: boolean;
  /** Achievements unlocked by this match: "Name +coins". */
  trophies?: string[];
  finished?: { event: string; roundsWon: number; champion: boolean; prize: { coins: number; xp: number; rank: number; pack?: string }; matches: Reward };
}

export class ResultScene extends Phaser.Scene {
  private outcome: ResultData = { winner: 0, games: [0, 0] };

  constructor() {
    super('ResultScene');
  }

  init(data: Partial<ResultData>): void {
    this.outcome = { winner: data.winner ?? 0, games: data.games ?? [0, 0], reward: data.reward, levelUp: data.levelUp ?? 0, packs: data.packs ?? 0, career: data.career ?? false, trophies: data.trophies ?? [], finished: data.finished };
  }

  create(): void {
    applyScreen(this);
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
    const fin = this.outcome.finished;
    const summary = fin
      ? `${fin.event.toUpperCase()}\n${fin.champion ? 'CHAMPION!' : `OUT AFTER ${fin.roundsWon} ROUND${fin.roundsWon === 1 ? '' : 'S'} WON`}\n+${fin.prize.coins} COINS  +${fin.prize.xp} XP  +${fin.prize.rank} RANK${fin.prize.pack ? '  +PACK' : ''}`
      : this.outcome.career
        ? 'ROUND WON: THE TOURNAMENT GOES ON'
        : `PLAYED ${s.played}\nWON ${s.won}   LOST ${s.lost}`;
    this.add
      .text(WIDTH / 2, 296, summary, {
        fontFamily: FONT, resolution: HD_SCALE,
        fontSize: '16px',
        color: css(COLORS.sky),
        align: 'center',
      })
      .setOrigin(0.5);

    const prof = getSave().profile;
    // While a tournament is going on nothing about the hero changes or is shown (XP, level, free packs): that comes with the
    // tournament summary, and the hero, gear and shop are locked until then.
    const locked = tournamentActive(prof);
    // A match of the tournament itself shows none of it; a quick match played meanwhile still shows its reward.
    const hideProgress = locked && this.outcome.career;
    const lvl = levelOf(prof.xp);
    const rw = this.outcome.reward;
    if (!hideProgress) {
      if (rw) {
        this.add
          .text(WIDTH / 2, 352, `${fin ? 'MATCHES  ' : ''}+${rw.xp} XP    +${rw.coins} COINS`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '16px', fontStyle: 'bold', color: css(COLORS.yellow) })
          .setOrigin(0.5);
      }
      this.add
        .text(WIDTH / 2, 378, this.outcome.levelUp ? `LEVEL UP!  LEVEL ${this.outcome.levelUp}` : `LEVEL ${lvl}`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '14px', fontStyle: 'bold', color: css(this.outcome.levelUp ? COLORS.yellow : COLORS.white) })
        .setOrigin(0.5);
      if (this.outcome.packs) {
        this.add
          .text(WIDTH / 2, 416, `FREE PACK x${this.outcome.packs}: ${locked ? 'OPEN IT AFTER THE TOURNAMENT' : 'OPEN IT IN THE SHOP'}`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '11px', fontStyle: 'bold', color: css(COLORS.sky) })
          .setOrigin(0.5);
      }
      this.add.rectangle(WIDTH / 2, 398, 200, 8, 0x000000, 0.5).setStrokeStyle(1, COLORS.white);
      const barW = Math.round(198 * levelProgress(prof.xp));
      if (barW > 0) this.add.rectangle(WIDTH / 2 - 99, 398, barW, 6, COLORS.sky).setOrigin(0, 0.5);
    }
    const trophies = this.outcome.trophies ?? [];
    if (trophies.length > 0) {
      this.add
        .text(WIDTH / 2, 566, `ACHIEVEMENT!\n${trophies.slice(0, 3).join('\n')}${trophies.length > 3 ? `\n+${trophies.length - 3} MORE` : ''}`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '11px', fontStyle: 'bold', color: css(COLORS.yellow), align: 'center' })
        .setOrigin(0.5, 0);
    }

    if (this.outcome.career) {
      makeButton(this, WIDTH / 2, 448, 240, 48, 'CONTINUE', () => this.scene.start(fin ? 'CalendarScene' : 'BracketScene'));
    } else {
      makeButton(this, WIDTH / 2, 448, 240, 48, 'REMATCH', () => this.scene.start('MatchScene', { practice: null, career: null }));
    }
    if (locked) {
      makeButton(this, WIDTH / 2, 512, 240, 48, 'TITLE', () => this.scene.start('TitleScene'));
    } else {
      makeButton(this, WIDTH / 2 - 62, 512, 116, 48, 'HERO', () => this.scene.start('CharacterScene'));
      makeButton(this, WIDTH / 2 + 62, 512, 116, 48, 'TITLE', () => this.scene.start('TitleScene'));
    }
  }
}
