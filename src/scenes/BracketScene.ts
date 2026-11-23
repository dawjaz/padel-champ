import Phaser from 'phaser';
import { WIDTH } from '../config';
import { activeBracket, withdraw } from '../career/careerFlow';
import { consumableById, toggleQueued } from '../career/gear';
import { heroFrom } from '../career/profile';
import { eventById } from '../career/season';
import { rivalLine } from '../career/rivals';
import { rivalTalk, type Talk } from '../speech';
import { STAT_KEYS } from '../game/attributes';
import playersData from '../data/players.json';
import type { PlayerDef } from '../game/types';
import { getSave, updateSave } from '../save';
import { HERO_ID } from '../career/tournament';
import { applyLightScreen, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

const BASE_HERO = (playersData.you as unknown as PlayerDef[])[0];

/** The draw of the tournament in progress: the round, who plays whom, your next opponent. */
export class BracketScene extends Phaser.Scene {
  private confirm = false;

  constructor() {
    super('BracketScene');
  }

  create(): void {
    applyLightScreen(this);
    this.confirm = false;
    const profile = getSave().profile;
    const bracket = activeBracket(profile);
    if (!bracket || bracket.status !== 'active') {
      this.scene.start('CalendarScene');
      return;
    }
    const names = new Map(bracket.entries.map((e) => [e.id, e.name]));
    const round = bracket.rounds[bracket.rounds.length - 1];
    const roundName = bracket.roundNames[bracket.rounds.length - 1];
    const text = (x: number, y: number, s: string, size: number, color: number, bold = false, ox = 0.5): Phaser.GameObjects.Text =>
      themeText(this, x, y, s, { size, color, origin: [ox, 0.5], font: bold ? 'display' : 'body', align: 'center' });

    screenHeader(this, roundName, { onBack: () => this.scene.start('CalendarScene'), coins: profile.coins });
    text(WIDTH / 2, 76, bracket.division.name.toUpperCase(), 12, TC.sub, true);

    const rowH = round.length > 4 ? 30 : 40;
    round.forEach((m, i) => {
      const y = 98 + i * (rowH + 4) + rowH / 2;
      const hero = m.a === HERO_ID || m.b === HERO_ID;
      const g = this.add.graphics().setPosition(12, y - rowH / 2);
      drawCard(g, WIDTH - 24, rowH, { radius: 10, shadow: 2, stroke: hero ? TC.orange : TC.navy, fill: hero ? 0xfff3e0 : TC.white });
      const one = (id: string, x: number, ox: number): void => {
        const win = m.winner === id;
        text(x, y, `${win ? '> ' : ''}${(names.get(id) ?? id).toUpperCase()}`, 11, id === HERO_ID ? TC.orange : win ? TC.navy : m.winner ? 0x8d9bb0 : TC.navy, id === HERO_ID || win, ox);
      };
      one(m.a, 26, 0);
      text(WIDTH / 2, y, 'v', 10, TC.sub);
      one(m.b, 334, 1);
    });

    // Next opponent and the comparison of strength
    const opp = bracket.opponent!;
    const hero = heroFrom(BASE_HERO, profile);
    const heroAvg = STAT_KEYS.reduce((a, k) => a + hero.stats[k], 0) / STAT_KEYS.length;
    const y0 = 98 + round.length * (rowH + 4) + 10;
    text(WIDTH / 2, y0 + 8, `NEXT: ${opp.name.toUpperCase()}`, 16, TC.navy, true);
    text(WIDTH / 2, y0 + 30, `OPPONENT ${opp.rating.toFixed(1)}   YOU ${heroAvg.toFixed(1)}`, 12, opp.rating > heroAvg + 0.5 ? 0xc62828 : opp.rating < heroAvg - 0.5 ? TC.green : TC.orange, true);

    // One boost from the bag can be used in this match (bought in the shop between tournaments).
    const inv = profile.inventory;
    const bagIds = [...new Set(inv.boosts)];
    if (bagIds.length === 0) {
      text(WIDTH / 2, 470, 'NO BOOSTS IN THE BAG (BUY THEM IN THE SHOP)', 10, TC.sub);
    } else {
      text(WIDTH / 2, 446, 'USE A BOOST IN THIS MATCH?', 12, TC.navy, true);
      bagIds.forEach((id, i) => {
        const c = consumableById(id)!;
        const count = inv.boosts.filter((b) => b === id).length;
        const on = inv.queued.includes(id);
        const bx = WIDTH / 2 + (i - (bagIds.length - 1) / 2) * 168;
        const b = makeThemeButton(this, bx, 480, 160, 40, `${on ? '* ' : ''}${c.name.toUpperCase()}${count > 1 ? ` x${count}` : ''}\n${c.short}`, () => {
          updateSave((d) => ({ ...d, profile: { ...d.profile, inventory: toggleQueued(d.profile.inventory, id) } }));
          this.scene.restart();
        }, on ? 'primary' : 'blue', 10);
        void b;
      });
    }

    makeThemeButton(this, WIDTH / 2, 536, 270, 52, 'PLAY MATCH', () => this.faceOff(opp.players, rivalLine('before', opp.players[0].name, `${bracket.roundsWon}`), { opponents: opp.players, name: bracket.division.name, city: eventById(profile.career.active?.eventId ?? '')?.city }), 'primary', 22);
    const leave = makeThemeButton(this, WIDTH / 2, 598, 200, 38, 'WITHDRAW', () => {
      if (!this.confirm) {
        this.confirm = true;
        leave.text.setText('SURE? TAP AGAIN');
        leave.text.setColor('#c62828');
        return;
      }
      const f = withdraw(getSave().profile);
      if (f) updateSave((d) => ({ ...d, profile: f.profile }));
      this.scene.start('CalendarScene');
    }, 'secondary', 13);
  }

  /** The face-off before a match: the rival's head and a speech bubble with his line, typed letter by letter. A tap skips the typing, the next tap starts the match. */
  private faceOff(players: PlayerDef[], line: string, career: { opponents: PlayerDef[]; name: string; city?: string }): void {
    const depth = 20000;
    const veil = this.add.rectangle(WIDTH / 2, 320, WIDTH, 640, TC.navyDark, 1).setDepth(depth).setInteractive();
    const title = themeText(this, WIDTH / 2, 70, 'YOUR NEXT OPPONENT', { size: 15, color: TC.gold, font: 'display' }).setDepth(depth + 1);
    const names = themeText(this, WIDTH / 2, 98, players.map((pl) => pl.name.toUpperCase()).join('  &  '), { size: 17, color: TC.white, font: 'display' }).setDepth(depth + 1);
    let hint: Phaser.GameObjects.Text | null = null;
    const talk: Talk = rivalTalk(this, {
      appearance: players[0].appearance, name: players[0].name, line, layout: 'below', x: WIDTH / 2, y: 118, headWidth: 150, bubbleWidth: 300, textSize: 17, depth: depth + 1,
      onDone: () => {
        hint = themeText(this, WIDTH / 2, 590, 'TAP TO START THE MATCH', { size: 14, color: TC.white, font: 'display' }).setDepth(depth + 1);
        this.tweens.add({ targets: hint, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
      },
    });
    veil.on('pointerdown', () => {
      if (!talk.isDone()) talk.skip();
      else {
        talk.destroy();
        void title;
        void names;
        void hint;
        this.scene.start('MatchScene', { practice: null, career });
      }
    });
  }
}
