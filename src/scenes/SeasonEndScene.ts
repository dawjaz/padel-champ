import Phaser from 'phaser';
import { WIDTH } from '../config';
import { dismissRecap } from '../career/seasonEnd';
import { sfx } from '../audio';
import { showTip } from '../tutorial/tips';
import { getSave, updateSave } from '../save';
import { iconChip, applyLightScreen, drawCard, makeThemeButton, rewardRow, screenHeader, TC, themeText } from '../theme';

const PACK_NAMES: Record<string, string> = { gear: 'GEAR PACK', premium: 'PREMIUM PACK' };

/** The recap of a finished season (shown once, the first time the calendar opens after it): the final place, the season in numbers, the pay. */
export class SeasonEndScene extends Phaser.Scene {
  constructor() {
    super('SeasonEndScene');
  }

  create(): void {
    applyLightScreen(this);
    const s = getSave();
    const r = s.profile.career.recap;
    if (!r) {
      this.scene.start('CalendarScene');
      return;
    }
    screenHeader(this, `Season ${r.season}`, { coins: s.profile.coins });
    themeText(this, WIDTH / 2, 88, 'SEASON COMPLETE', { size: 24, color: TC.orange, font: 'display' });
    // the place, big
    const card = this.add.graphics().setPosition(14, 112);
    drawCard(card, WIDTH - 28, 108, { radius: 20, shadow: 5 });
    iconChip(this.add.graphics(), 30, 130, 56, TC.gold, 'trophy');
    themeText(this, 108, 150, `#${r.place}`, { size: 44, color: TC.navy, font: 'display', origin: [0, 0.5] });
    themeText(this, 108, 192, `IN THE WORLD  ·  ${r.points.toLocaleString('en-US')} POINTS`, { size: 11, color: TC.sub, origin: [0, 0.5] });
    // the season in numbers
    const rows: Array<[string, string]> = [
      ['TOURNAMENTS PLAYED', String(r.log.events)],
      ['FINALS REACHED', String(r.log.finals)],
      ['TITLES WON', String(r.log.titles)],
      ['RANKING POINTS WON', r.log.rankGained.toLocaleString('en-US')],
    ];
    rows.forEach(([k, v], i) => {
      const y = 240 + i * 28;
      themeText(this, 28, y, k, { size: 12, color: TC.navy, font: 'display', origin: [0, 0.5] });
      themeText(this, WIDTH - 28, y, v, { size: 14, color: TC.orange, font: 'display', origin: [1, 0.5] });
    });
    // the pay
    const pay = this.add.graphics().setPosition(14, 360);
    drawCard(pay, WIDTH - 28, 124, { radius: 18, stroke: r.paid ? TC.orange : TC.navy });
    themeText(this, WIDTH / 2, 380, r.label, { size: 14, color: r.paid ? TC.orange : TC.sub, font: 'display', wrap: WIDTH - 60 });
    if (r.paid) {
      const items: Array<{ kind: 'coin' | null; text: string }> = [{ kind: 'coin', text: `+${r.coins.toLocaleString('en-US')}` }];
      for (const [id, n] of Object.entries(r.packs)) items.push({ kind: null, text: `${n} × ${PACK_NAMES[id] ?? id.toUpperCase()}` });
      rewardRow(this, WIDTH / 2, 420, items.slice(0, 1), { size: 20 });
      themeText(this, WIDTH / 2, 452, items.slice(1).map((i) => i.text).join('   '), { size: 14, color: TC.navy, font: 'display' });
      themeText(this, WIDTH / 2, 472, 'ADDED TO YOUR BAG', { size: 10, color: TC.sub });
    }
    themeText(this, WIDTH / 2, 516, `SEASON ${r.season + 1} BEGINS WITH ${r.carried.toLocaleString('en-US')} POINTS\n(HALF OF YOUR POINTS CARRY OVER)`, { size: 12, color: TC.sub, align: 'center' });
    if (r.paid) sfx('win');
    this.time.delayedCall(900, () => showTip(this, 'season'));
    makeThemeButton(this, WIDTH / 2, 584, 280, 52, `START SEASON ${r.season + 1}`, () => {
      updateSave((d) => ({ ...d, profile: dismissRecap(d.profile) }));
      this.scene.start('CalendarScene');
    }, 'primary', 22);
  }
}
