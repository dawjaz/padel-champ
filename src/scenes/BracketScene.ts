import { withNick } from '../game/names';
import Phaser from 'phaser';
import { WIDTH } from '../config';
import { activeBracket, withdraw } from '../career/careerFlow';
import { consumableById, toggleQueued } from '../career/gear';
import { heroFrom, heroLook } from '../career/profile';
import { playCutscene } from './CutsceneScene';
import type { CareerMatch } from './MatchScene';
import { eventById, eventName, partnerById } from '../career/season';
import { rivalLine } from '../career/rivals';
import { rivalTalk, type Talk } from '../speech';
import { shownStat, STAT_KEYS } from '../game/attributes';
import playersData from '../data/players.json';
import type { PlayerDef } from '../game/types';
import { getSave, updateSave } from '../save';
import { HERO_ID, type Bracket } from '../career/tournament';
import { applyLightScreen, makeSideSwitch, makeThemeButton, screenHeader, TC, themeText } from '../theme';

const BASE_HERO = (playersData.you as unknown as PlayerDef[])[0];

/** The draw of the tournament in progress: the round, who plays whom, your next opponent. */
export class BracketScene extends Phaser.Scene {
  private confirm = false;
  /** Just entered from the calendar: the tournament-start cutscene plays over the draw. */
  private fresh = false;

  constructor() {
    super('BracketScene');
  }

  init(data?: { fresh?: boolean }): void {
    this.fresh = data?.fresh === true;
    // Phaser keeps the data of the last start for a start without any: the cutscene must not come back
    this.sys.settings.data = {};
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
    const roundName = bracket.roundNames[bracket.rounds.length - 1];
    const ev = eventById(profile.career.active?.eventId ?? '');
    const eventLabel = ev ? eventName(ev) : bracket.division.name;
    const text = (x: number, y: number, s: string, size: number, color: number, bold = false, ox = 0.5): Phaser.GameObjects.Text =>
      themeText(this, x, y, s, { size, color, origin: [ox, 0.5], font: bold ? 'display' : 'body', align: 'center' });

    screenHeader(this, roundName, { onBack: () => this.scene.start('CalendarScene'), coins: profile.coins });
    text(WIDTH / 2, 76, bracket.division.name.toUpperCase(), 12, TC.sub, true);

    const treeBottom = this.drawTree(bracket, 84);

    // Next opponent and the comparison of strength
    const opp = bracket.opponent!;
    const hero = heroFrom(BASE_HERO, profile);
    const heroAvg = STAT_KEYS.reduce((a, k) => a + hero.stats[k], 0) / STAT_KEYS.length;
    const y0 = treeBottom + 12;
    text(WIDTH / 2, y0 + 8, `NEXT: ${opp.name.toUpperCase()}`, 16, TC.navy, true);
    text(WIDTH / 2, y0 + 30, `OPPONENT ${shownStat(opp.rating).toFixed(1)}   YOU ${shownStat(heroAvg).toFixed(1)}`, 12, opp.rating > heroAvg + 0.5 ? 0xc62828 : opp.rating < heroAvg - 0.5 ? TC.green : TC.orange, true);

    // The side of the court for this match (the default is set on the HERO screen).
    text(86, y0 + 62, 'I PLAY ON THE', 12, TC.navy, true, 0);
    makeSideSwitch(this, 244, y0 + 62, profile.heroSide, (side) => {
      updateSave((d) => ({ ...d, profile: { ...d.profile, heroSide: side } }));
      this.scene.restart();
    }, 66, 26);

    // One boost from the bag can be used in this match (bought in the shop between tournaments).
    const inv = profile.inventory;
    const bagIds = [...new Set(inv.boosts)];
    if (bagIds.length === 0) {
      text(WIDTH / 2, y0 + 108, 'NO BOOSTS IN THE BAG (BUY THEM IN THE SHOP)', 10, TC.sub);
    } else {
      text(WIDTH / 2, y0 + 86, 'USE A BOOST IN THIS MATCH?', 12, TC.navy, true);
      bagIds.forEach((id, i) => {
        const c = consumableById(id)!;
        const count = inv.boosts.filter((b) => b === id).length;
        const on = inv.queued.includes(id);
        const bx = WIDTH / 2 + (i - (bagIds.length - 1) / 2) * 168;
        const b = makeThemeButton(this, bx, y0 + 118, 160, 40, `${on ? '* ' : ''}${c.name.toUpperCase()}${count > 1 ? ` x${count}` : ''}\n${c.short}`, () => {
          updateSave((d) => ({ ...d, profile: { ...d.profile, inventory: toggleQueued(d.profile.inventory, id) } }));
          this.scene.restart();
        }, on ? 'primary' : 'blue', 10);
        void b;
      });
    }

    makeThemeButton(this, WIDTH / 2, 536, 270, 52, 'PLAY MATCH', () => this.faceOff(opp.players, rivalLine('before', opp.players[0].name, `${bracket.roundsWon}`), { opponents: opp.players, name: bracket.division.name, city: eventById(profile.career.active?.eventId ?? '')?.city, round: roundName.toUpperCase(), event: eventLabel }), 'primary', 22);
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

    // just entered: the tournament opens with its scene, over the draw
    if (this.fresh) {
      this.fresh = false;
      const mate = partnerById(profile.career.partnerId);
      playCutscene(this, 'tourStart', {
        hero: { name: profile.name, appearance: heroLook(profile) },
        partner: mate ? { name: mate.name, appearance: mate.appearance } : undefined,
        event: eventLabel,
        city: ev?.city,
        round: roundName.toUpperCase(),
      }, () => undefined);
    }
  }

  /**
   * The draw as a tree: one column per round, the winners moving to the right; the hero's path is orange. Rounds that are not played
   * yet are empty slots. Returns the bottom edge of the tree.
   */
  private drawTree(bracket: Bracket, top: number): number {
    const draw = bracket.division.draw;
    const roundsN = bracket.roundNames.length;
    const pitch = draw === 16 ? 17 : 34;
    const margin = 8;
    const gap = draw === 16 ? 9 : 12;
    const w = (WIDTH - margin * 2 - gap * roundsN) / (roundsN + 1);
    const h = pitch - 3;
    const names = new Map(bracket.entries.map((e) => [e.id, e.name]));
    const short = (id: string | undefined): string => {
      if (!id) return '';
      if (id === HERO_ID) return 'YOU';
      const per = Math.max(3, Math.floor(((w - 10) / ((draw === 16 ? 9 : 11) * 0.6) - 1) / 2));
      return (names.get(id) ?? id)
        .split(' / ')
        .map((n) => n.slice(0, per))
        .join('/');
    };
    const colX = (r: number): number => margin + r * (w + gap);
    // centre of match m of round r; slot a above it and slot b below
    const centre = (r: number, m: number): number => (r === 0 ? top + pitch * (2 * m + 1) : (centre(r - 1, 2 * m) + centre(r - 1, 2 * m + 1)) / 2);
    const half = (r: number): number => (pitch * 2 ** r) / 2;
    const lines = this.add.graphics();
    const boxes = this.add.graphics();
    const colour = (id: string | undefined): number => (id === HERO_ID ? TC.orange : TC.navy);

    const slot = (r: number, y: number, id: string | undefined, state: 'win' | 'lose' | 'open'): void => {
      const hero = id === HERO_ID;
      boxes.fillStyle(hero ? 0xfff3e0 : TC.white, 1);
      boxes.fillRoundedRect(colX(r), y - h / 2, w, h, 4);
      boxes.lineStyle(hero ? 2 : 1.5, hero ? TC.orange : id && state !== 'lose' ? TC.navy : 0xb9c8e0, 1);
      boxes.strokeRoundedRect(colX(r), y - h / 2, w, h, 4);
      if (id)
        themeText(this, colX(r) + w / 2, y + 0.5, short(id), { size: draw === 16 ? 9 : 11, color: hero ? TC.orange : state === 'lose' ? 0x8d9bb0 : TC.navy, font: 'body', origin: [0.5, 0.5] });
    };

    for (let r = 0; r <= roundsN; r++) {
      const matches = r < roundsN ? draw / 2 ** (r + 1) : 0;
      if (r === roundsN) {
        // the champion
        const fin = bracket.rounds[roundsN - 1]?.[0];
        slot(r, centre(roundsN - 1, 0), fin?.winner, 'win');
        continue;
      }
      for (let m = 0; m < matches; m++) {
        const c = centre(r, m);
        const match = bracket.rounds[r]?.[m];
        // who stands in the two slots: the match itself, or the winners of the two matches that lead to it
        const prev = (side: number): string | undefined => bracket.rounds[r - 1]?.[2 * m + side]?.winner;
        const a = match ? match.a : r > 0 ? prev(0) : undefined;
        const b = match ? match.b : r > 0 ? prev(1) : undefined;
        const ya = c - half(r);
        const yb = c + half(r);
        const state = (id: string | undefined): 'win' | 'lose' | 'open' => (!match?.winner ? 'open' : match.winner === id ? 'win' : 'lose');
        slot(r, ya, a, state(a));
        slot(r, yb, b, state(b));
        // connectors to the next round
        const x1 = colX(r) + w;
        const x2 = x1 + gap / 2;
        const x3 = colX(r + 1);
        lines.lineStyle(1.5, 0xb9c8e0, 1);
        lines.lineBetween(x1, ya, x2, ya);
        lines.lineBetween(x1, yb, x2, yb);
        lines.lineBetween(x2, ya, x2, yb);
        lines.lineBetween(x2, c, x3, c);
        if (match?.winner) {
          const wy = match.winner === a ? ya : yb;
          lines.lineStyle(2, colour(match.winner), 1);
          lines.lineBetween(x1, wy, x2, wy);
          lines.lineBetween(x2, wy, x2, c);
          lines.lineBetween(x2, c, x3, c);
        }
      }
    }
    return centre(0, draw / 2 - 1) + pitch;
  }

  /** The face-off before a match: the rival's head and a speech bubble with his line, typed letter by letter. A tap skips the typing, the next tap starts the match. */
  private faceOff(players: PlayerDef[], line: string, career: CareerMatch): void {
    const depth = 20000;
    const veil = this.add.rectangle(WIDTH / 2, 320, WIDTH, 640, TC.navyDark, 1).setDepth(depth).setInteractive();
    const title = themeText(this, WIDTH / 2, 70, 'YOUR NEXT OPPONENT', { size: 15, color: TC.gold, font: 'display' }).setDepth(depth + 1);
    const names = players.map((pl, i) => themeText(this, WIDTH / 2, 94 + i * 20, withNick(pl).toUpperCase(), { size: 16, color: TC.white, font: 'display' }).setDepth(depth + 1));
    let hint: Phaser.GameObjects.Text | null = null;
    const talk: Talk = rivalTalk(this, {
      appearance: players[0].appearance, name: players[0].name, nick: players[0].nick, line, layout: 'below', x: WIDTH / 2, y: 132, headWidth: 150, bubbleWidth: 300, textSize: 17, depth: depth + 1,
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
