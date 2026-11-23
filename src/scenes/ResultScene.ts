import Phaser from 'phaser';
import { WIDTH } from '../config';
import { getSave } from '../save';
import { tournamentActive } from '../career/careerFlow';
import type { SideIndex } from '../game/types';
import { rivalLine } from '../career/rivals';
import { rivalTalk } from '../speech';
import type { Appearance } from '../game/types';
import { levelOf, levelProgress, type Reward } from '../career/profile';
import { sfx } from '../audio';
import { applyLightScreen, drawBar, drawCard, makeThemeButton, rewardRow, tcss, TC, themeText } from '../theme';

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
  /** The hero retired from the match (END THE GAME): the opponents win by retirement. */
  retired?: boolean;
  /** The rival (first opponent) of a career match: he says a line after the match. */
  rival?: { name: string; nick?: string; appearance: Appearance };
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
    this.outcome = { winner: data.winner ?? 0, games: data.games ?? [0, 0], reward: data.reward, levelUp: data.levelUp ?? 0, packs: data.packs ?? 0, career: data.career ?? false, trophies: data.trophies ?? [], finished: data.finished, rival: data.rival, retired: data.retired === true };
  }

  create(): void {
    applyLightScreen(this);
    const won = this.outcome.winner === 0;
    const text = (y: number, s: string, size: number, color: number, display = true, align: 'center' | 'left' = 'center'): Phaser.GameObjects.Text =>
      themeText(this, WIDTH / 2, y, s, { size, color, font: display ? 'display' : 'body', align });

    // Big result banner
    const ban = this.add.graphics().setPosition(30, 52);
    drawCard(ban, WIDTH - 60, 84, { radius: 22, fill: won ? TC.gold : TC.white, shadow: 5 });
    const retired = this.outcome.retired === true;
    text(94, won ? 'YOU WIN!' : retired ? 'RETIRED' : 'YOU LOSE', 46, won ? TC.navy : 0xc62828);
    // Score
    const sc = this.add.graphics().setPosition(WIDTH / 2 - 80, 156);
    drawCard(sc, 160, 78, { radius: 18 });
    text(188, `${this.outcome.games[0]} - ${this.outcome.games[1]}`, 40, TC.navy);
    if (!retired) text(220, 'GAMES', 11, TC.sub, false);
    else text(256, 'THE OPPONENTS WIN BY RETIREMENT', 13, 0xc62828, true);

    const fin = this.outcome.finished;
    const summary = fin
      ? `${fin.event.toUpperCase()}\n${fin.champion ? 'CHAMPION!' : `OUT AFTER ${fin.roundsWon} ROUND${fin.roundsWon === 1 ? '' : 'S'} WON`}`
      : this.outcome.career
        ? 'ROUND WON: THE TOURNAMENT GOES ON'
        : '';
    // A quick match is a sparring: no summary line at all.
    if (summary !== '') text(retired ? 290 : 280, summary, 15, TC.navy, true).setLineSpacing(2);
    // The prize of the tournament, with icons: coins, XP, ranking points and the pack.
    if (fin) {
      rewardRow(this, WIDTH / 2, 316, [
        { kind: 'coin', text: `+${fin.prize.coins}` },
        { kind: 'xp', text: `+${fin.prize.xp}` },
        { kind: null, text: `+${fin.prize.rank} RANK` },
        ...(fin.prize.pack ? [{ kind: null, text: '+PACK' }] : []),
      ]);
    }

    const prof = getSave().profile;
    // While a tournament is going on nothing about the hero changes or is shown (XP, level, free packs): that comes with the
    // tournament summary, and the hero, gear and shop are locked until then.
    const locked = tournamentActive(prof);
    // A match of the tournament itself shows none of it, and a quick match (a sparring) has no progress to show.
    const hideProgress = !this.outcome.career || locked;
    const rw = this.outcome.reward;
    if (!hideProgress) {
      // What the matches of the tournament paid (the XP also goes into the bar below).
      const matches = fin?.matches ?? rw;
      if (matches) rewardRow(this, WIDTH / 2, 342, [{ kind: null, text: 'MATCHES' }, { kind: 'xp', text: `+${matches.xp}` }, { kind: 'coin', text: `+${matches.coins}` }], { size: 14, color: TC.orange });
      this.xpBar(prof.xp, (fin ? fin.prize.xp + fin.matches.xp : (rw?.xp ?? 0)));
      if (this.outcome.packs) text(412, `FREE PACK x${this.outcome.packs}: ${locked ? 'OPEN IT AFTER THE TOURNAMENT' : 'OPEN IT IN THE SHOP'}`, 11, TC.blue);
    }
    // The rival's line (between rounds of a tournament, where the progress block above is empty): his head and a bubble, typed letter by letter.
    if (this.outcome.rival && this.outcome.career && hideProgress && !retired) {
      const r = this.outcome.rival;
      const line = rivalLine(won ? 'afterYouWin' : 'afterYouLose', r.name, `${this.outcome.games[0]}-${this.outcome.games[1]}`);
      rivalTalk(this, { appearance: r.appearance, name: r.name, nick: r.nick, line, layout: 'side', x: 22, y: 330, headWidth: 62, bubbleWidth: 252, textSize: 13 });
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

  /** The level and XP bar: it starts where the hero was before the tournament and fills up to where he is now (over a level-up it fills, flashes and starts again). */
  private xpBar(xpAfter: number, gain: number): void {
    const xpBefore = Math.max(0, xpAfter - gain);
    const barX = WIDTH / 2 - 100;
    const levelNow = levelOf(xpAfter);
    const label = (level: number, up: boolean): string => (up ? `LEVEL UP!  LEVEL ${level}` : `LEVEL ${level}`);
    const lvlText = themeText(this, WIDTH / 2, 368, label(levelOf(xpBefore), false), { size: 14, font: 'display' });
    const bar = this.add.graphics();
    const paint = (xp: number): void => {
      bar.clear();
      drawBar(bar, barX, 384, 200, 12, levelProgress(xp), TC.orange);
    };
    paint(xpBefore);
    if (gain <= 0) {
      lvlText.setText(label(levelNow, false));
      return;
    }
    let shown = levelOf(xpBefore);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      delay: 600,
      duration: 1500,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const xp = xpBefore + (xpAfter - xpBefore) * (tw.getValue() ?? 0);
        paint(xp);
        const level = levelOf(xp);
        if (level !== shown) {
          shown = level;
          lvlText.setText(label(level, true)).setColor(tcss(TC.orange));
          this.tweens.add({ targets: lvlText, scale: 1.25, duration: 150, yoyo: true });
          sfx('win');
        }
      },
      onComplete: () => paint(xpAfter),
    });
  }
}
