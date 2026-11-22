import Phaser from 'phaser';
import { WIDTH } from '../config';
import { getSave } from '../save';
import { tournamentActive } from '../career/careerFlow';
import type { SideIndex } from '../game/types';
import { levelOf, levelProgress, type Reward } from '../career/profile';
import { applyLightScreen, drawBar, drawCard, makeThemeButton, TC, themeText } from '../theme';

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
    applyLightScreen(this);
    const won = this.outcome.winner === 0;
    const text = (y: number, s: string, size: number, color: number, display = true, align: 'center' | 'left' = 'center'): Phaser.GameObjects.Text =>
      themeText(this, WIDTH / 2, y, s, { size, color, font: display ? 'display' : 'body', align });

    // Big result banner
    const ban = this.add.graphics().setPosition(30, 52);
    drawCard(ban, WIDTH - 60, 84, { radius: 22, fill: won ? TC.gold : TC.white, shadow: 5 });
    text(94, won ? 'YOU WIN!' : 'YOU LOSE', 46, won ? TC.navy : 0xc62828);
    // Score
    const sc = this.add.graphics().setPosition(WIDTH / 2 - 80, 156);
    drawCard(sc, 160, 78, { radius: 18 });
    text(188, `${this.outcome.games[0]} - ${this.outcome.games[1]}`, 40, TC.navy);
    text(220, 'GAMES', 11, TC.sub, false);

    const fin = this.outcome.finished;
    const summary = fin
      ? `${fin.event.toUpperCase()}\n${fin.champion ? 'CHAMPION!' : `OUT AFTER ${fin.roundsWon} ROUND${fin.roundsWon === 1 ? '' : 'S'} WON`}\n+${fin.prize.coins} COINS  +${fin.prize.xp} XP  +${fin.prize.rank} RANK${fin.prize.pack ? '  +PACK' : ''}`
      : this.outcome.career
        ? 'ROUND WON: THE TOURNAMENT GOES ON'
        : '';
    // A quick match is a sparring: no summary line at all.
    if (summary !== '') text(290, summary, 15, TC.navy, true).setLineSpacing(2);

    const prof = getSave().profile;
    // While a tournament is going on nothing about the hero changes or is shown (XP, level, free packs): that comes with the
    // tournament summary, and the hero, gear and shop are locked until then.
    const locked = tournamentActive(prof);
    // A match of the tournament itself shows none of it, and a quick match (a sparring) has no progress to show.
    const hideProgress = !this.outcome.career || locked;
    const lvl = levelOf(prof.xp);
    const rw = this.outcome.reward;
    if (!hideProgress) {
      if (rw) text(344, `${fin ? 'MATCHES  ' : ''}+${rw.xp} XP    +${rw.coins} COINS`, 15, TC.orange);
      text(368, this.outcome.levelUp ? `LEVEL UP!  LEVEL ${this.outcome.levelUp}` : `LEVEL ${lvl}`, 14, this.outcome.levelUp ? TC.orange : TC.navy);
      const bar = this.add.graphics();
      drawBar(bar, WIDTH / 2 - 100, 384, 200, 12, levelProgress(prof.xp), TC.orange);
      if (this.outcome.packs) text(412, `FREE PACK x${this.outcome.packs}: ${locked ? 'OPEN IT AFTER THE TOURNAMENT' : 'OPEN IT IN THE SHOP'}`, 11, TC.blue);
    }
    const trophies = this.outcome.trophies ?? [];
    if (trophies.length > 0) {
      const t = text(594, `ACHIEVEMENT!\n${trophies.slice(0, 2).join('\n')}${trophies.length > 2 ? `\n+${trophies.length - 2} MORE` : ''}`, 11, TC.orange);
      t.setOrigin(0.5, 0);
    }

    const small = (x: number, y: number, w: number, h: number, label: string, to: string): void => void makeThemeButton(this, x, y, w, h, label, () => this.scene.start(to), 'blue', 15);
    if (this.outcome.career) {
      makeThemeButton(this, WIDTH / 2, 448, 250, 50, 'CONTINUE', () => this.scene.start(fin ? 'CalendarScene' : 'BracketScene'), 'primary', 22);
    } else {
      makeThemeButton(this, WIDTH / 2, 448, 250, 50, 'REMATCH', () => this.scene.start('MatchScene', { practice: null, career: null }), 'primary', 22);
    }
    if (locked) {
      // A tournament is still going on: no hero, gear or shop.
      makeThemeButton(this, WIDTH / 2, 510, 250, 48, 'MAIN MENU', () => this.scene.start('TitleScene'), 'secondary', 18);
    } else if (fin) {
      // The tournament is over: now the hero can be upgraded and the shop is open.
      small(WIDTH / 2 - 64, 508, 120, 44, 'HERO', 'CharacterScene');
      small(WIDTH / 2 + 64, 508, 120, 44, 'GO TO SHOP', 'ShopScene');
      makeThemeButton(this, WIDTH / 2, 558, 250, 40, 'MAIN MENU', () => this.scene.start('TitleScene'), 'secondary', 16);
    } else {
      small(WIDTH / 2 - 64, 510, 120, 48, 'HERO', 'CharacterScene');
      makeThemeButton(this, WIDTH / 2 + 64, 510, 120, 48, 'MAIN MENU', () => this.scene.start('TitleScene'), 'secondary', 15);
    }
  }
}
