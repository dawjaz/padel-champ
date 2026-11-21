import Phaser from 'phaser';
import { COLORS, css, FONT, HD_SCALE, WIDTH } from '../config';
import { activeBracket, withdraw } from '../career/careerFlow';
import { consumableById, toggleQueued } from '../career/gear';
import { heroFrom } from '../career/profile';
import { STAT_KEYS } from '../game/attributes';
import playersData from '../data/players.json';
import type { PlayerDef } from '../game/types';
import { applyScreen } from '../hd';
import { getSave, updateSave } from '../save';
import { HERO_ID } from '../career/tournament';
import { logoText, makeButton } from '../ui';

const BASE_HERO = (playersData.you as unknown as PlayerDef[])[0];

/** The draw of the tournament in progress: the round, who plays whom, your next opponent. */
export class BracketScene extends Phaser.Scene {
  private confirm = false;

  constructor() {
    super('BracketScene');
  }

  create(): void {
    applyScreen(this);
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
      this.add.text(x, y, s, { fontFamily: FONT, resolution: HD_SCALE, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: css(color), align: 'center' }).setOrigin(ox, 0.5);

    logoText(this, WIDTH / 2, 30, roundName.toUpperCase(), 26, COLORS.yellow);
    text(WIDTH / 2, 58, bracket.division.name.toUpperCase(), 12, COLORS.sky, true);

    const rowH = round.length > 4 ? 30 : 40;
    round.forEach((m, i) => {
      const y = 96 + i * (rowH + 4) + rowH / 2;
      const hero = m.a === HERO_ID || m.b === HERO_ID;
      const g = this.add.graphics();
      g.fillStyle(hero ? COLORS.panelHover : COLORS.panel, 0.9);
      g.fillRoundedRect(15, y - rowH / 2, 330, rowH, 8);
      if (hero) {
        g.lineStyle(2, COLORS.yellow, 1);
        g.strokeRoundedRect(15, y - rowH / 2, 330, rowH, 8);
      }
      const one = (id: string, x: number, ox: number): void => {
        const win = m.winner === id;
        text(x, y, `${win ? '> ' : ''}${(names.get(id) ?? id).toUpperCase()}`, 11, id === HERO_ID ? COLORS.yellow : win ? COLORS.white : m.winner ? COLORS.gray : COLORS.white, id === HERO_ID || win, ox);
      };
      one(m.a, 26, 0);
      text(WIDTH / 2, y, 'v', 10, COLORS.gray);
      one(m.b, 334, 1);
    });

    // Next opponent and the comparison of strength
    const opp = bracket.opponent!;
    const hero = heroFrom(BASE_HERO, profile);
    const heroAvg = STAT_KEYS.reduce((a, k) => a + hero.stats[k], 0) / STAT_KEYS.length;
    const y0 = 96 + round.length * (rowH + 4) + 10;
    text(WIDTH / 2, y0 + 8, `NEXT: ${opp.name.toUpperCase()}`, 14, COLORS.white, true);
    text(WIDTH / 2, y0 + 30, `OPPONENT ${opp.rating.toFixed(1)}   YOU ${heroAvg.toFixed(1)}`, 12, opp.rating > heroAvg + 0.5 ? COLORS.red : opp.rating < heroAvg - 0.5 ? COLORS.green : COLORS.yellow, true);

    // One boost from the bag can be used in this match (bought in the shop between tournaments).
    const inv = profile.inventory;
    const bagIds = [...new Set(inv.boosts)];
    if (bagIds.length === 0) {
      text(WIDTH / 2, 470, 'NO BOOSTS IN THE BAG (BUY THEM IN THE SHOP)', 10, COLORS.gray);
    } else {
      text(WIDTH / 2, 446, 'USE A BOOST IN THIS MATCH?', 11, COLORS.white, true);
      bagIds.forEach((id, i) => {
        const c = consumableById(id)!;
        const count = inv.boosts.filter((b) => b === id).length;
        const on = inv.queued.includes(id);
        const bx = WIDTH / 2 + (i - (bagIds.length - 1) / 2) * 168;
        const b = makeButton(this, bx, 480, 160, 40, `${on ? '* ' : ''}${c.name.toUpperCase()}${count > 1 ? ` x${count}` : ''}\n${c.short}`, () => {
          updateSave((d) => ({ ...d, profile: { ...d.profile, inventory: toggleQueued(d.profile.inventory, id) } }));
          this.scene.restart();
        });
        b.text.setFontSize(10);
        b.setAccent(on ? COLORS.yellow : COLORS.sky);
      });
    }

    makeButton(this, WIDTH / 2, 536, 260, 50, 'PLAY MATCH', () => this.scene.start('MatchScene', { practice: null, career: { opponents: opp.players, name: bracket.division.name } }));
    const leave = makeButton(this, WIDTH / 2, 596, 200, 38, 'WITHDRAW', () => {
      if (!this.confirm) {
        this.confirm = true;
        leave.text.setText('SURE? TAP AGAIN');
        leave.setAccent(COLORS.red);
        return;
      }
      const f = withdraw(getSave().profile);
      if (f) updateSave((d) => ({ ...d, profile: f.profile }));
      this.scene.start('CalendarScene');
    });
    leave.text.setFontSize(13);
  }
}
