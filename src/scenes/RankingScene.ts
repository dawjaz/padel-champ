import Phaser from 'phaser';
import { WIDTH } from '../config';
import { levelOf } from '../career/profile';
import { ONLINE_SOURCE, positionOf, visibleRows, WORLD_SOURCE, worldRanking, type RankingSource, type RankRow } from '../career/ranking';
import { recordRows } from '../career/recordsView';
import { partnerById, WEEKS } from '../career/season';
import { getSave } from '../save';
import { applyLightScreen, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

type Tab = 'world' | 'seasons' | 'records' | 'online';
const TABS: Array<{ id: Tab; label: string; source?: RankingSource }> = [
  { id: 'world', label: 'WORLD', source: WORLD_SOURCE },
  { id: 'seasons', label: 'SEASONS' },
  { id: 'records', label: 'RECORDS' },
  { id: 'online', label: 'ONLINE', source: ONLINE_SOURCE },
];

/** Rankings and records: the world ranking of the career (computed on this device), your personal records, and a locked tab for the online ranking to come. */
export class RankingScene extends Phaser.Scene {
  private tab: Tab = 'world';
  private dyn: Phaser.GameObjects.GameObject[] = [];

  /** Where the back button leads (the calendar, or the hero screen). */
  private from = 'CalendarScene';

  constructor() {
    super('RankingScene');
  }

  init(data: { from?: string }): void {
    this.from = data?.from ?? 'CalendarScene';
    this.tab = 'world';
  }

  create(): void {
    applyLightScreen(this);
    this.redraw();
  }

  private redraw(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const save = getSave();
    const before = this.children.length;
    screenHeader(this, 'Ranks', { onBack: () => this.scene.start(this.from), coins: save.profile.coins });
    this.dyn.push(...this.children.list.slice(before));
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.dyn.push(o);
      return o;
    };

    TABS.forEach((t, i) => {
      const locked = t.source !== undefined && !t.source.available;
      const b = makeThemeButton(this, 12 + 41 + i * 85, 82, 81, 32, t.label, () => {
        if (locked && this.tab === t.id) return;
        this.tab = t.id;
        this.redraw();
      }, this.tab === t.id ? 'primary' : 'blue', 11);
      if (locked) b.text.setAlpha(0.6);
      this.dyn.push(...b.parts);
    });

    if (this.tab === 'world') this.world(add);
    else if (this.tab === 'seasons') this.seasons(add);
    else if (this.tab === 'records') this.records(add);
    else this.online(add);
  }

  private world(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const save = getSave();
    const c = save.profile.career;
    const partner = partnerById(c.partnerId);
    const me = `${save.profile.name.toUpperCase()} / ${(partner?.name ?? 'PARTNER').toUpperCase()}`;
    const all = worldRanking(c, me);
    add(themeText(this, 16, 134, `SEASON ${c.season}   WEEK ${c.week}/${WEEKS}`, { size: 13, font: 'display', origin: [0, 0.5] }));
    add(themeText(this, WIDTH - 16, 134, `YOUR PLACE  #${positionOf(c)}`, { size: 13, color: TC.orange, font: 'display', origin: [1, 0.5] }));
    let y = 152;
    for (const r of visibleRows(all, 8)) {
      if (r === null) {
        add(themeText(this, WIDTH / 2, y + 10, '. . .', { size: 14, color: TC.sub, font: 'display' }));
        y += 24;
        continue;
      }
      this.row(add, y, r);
      y += 40;
    }
    add(themeText(this, WIDTH / 2, 612, `${all.length} PAIRS. HALF OF THE POINTS CARRY OVER TO THE NEXT SEASON.`, { size: 10, color: TC.sub, font: 'display' }));
  }

  private row(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T, y: number, r: RankRow): void {
    const g = add(this.add.graphics().setPosition(12, y));
    drawCard(g, WIDTH - 24, 34, { radius: 10, shadow: 2, stroke: r.you ? TC.orange : TC.navy, fill: r.you ? 0xfff3e0 : TC.white });
    add(themeText(this, 40, y + 18, `${r.pos}`, { size: 14, color: r.you ? TC.orange : r.pos <= 3 ? TC.goldDark : TC.navy, font: 'display' }));
    add(themeText(this, 66, y + 18, r.name, { size: 12, color: r.you ? TC.orange : TC.navy, font: 'display', origin: [0, 0.5] }));
    add(themeText(this, WIDTH - 26, y + 18, `${r.points}`, { size: 14, color: r.you ? TC.orange : TC.navy, font: 'display', origin: [1, 0.5] }));
  }

  private records(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const save = getSave();
    const c = save.profile.career;
    const rows = recordRows({ stats: save.stats, records: save.records, titles: c.titles, level: levelOf(save.profile.xp), rankPoints: c.rankPoints, position: positionOf(c) });
    let y = 128;
    for (const r of rows) {
      const g = add(this.add.graphics().setPosition(12, y));
      drawCard(g, WIDTH - 24, 31, { radius: 10, shadow: 2 });
      add(themeText(this, 24, y + 16, r.label, { size: 11, color: TC.sub, font: 'display', origin: [0, 0.5] }));
      add(themeText(this, WIDTH - 24, y + 16, r.value, { size: 14, font: 'display', origin: [1, 0.5] }));
      y += 36;
    }
    add(themeText(this, WIDTH / 2, 624, 'CAREER MATCHES ONLY. SPARRING DOES NOT COUNT.', { size: 10, color: TC.sub, font: 'display' }));
  }

  /** The finished seasons: the final place in the world, the points and what he won. */
  private seasons(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const list = [...getSave().profile.career.seasons].reverse();
    if (list.length === 0) {
      add(themeText(this, WIDTH / 2, 260, 'NO SEASON FINISHED YET', { size: 16, color: TC.orange, font: 'display' }));
      add(themeText(this, WIDTH / 2, 310, 'A season is 24 weeks. When it ends you get\nyour final place in the world and a reward.', { size: 12, color: TC.sub, align: 'center' }).setLineSpacing(4));
      return;
    }
    list.slice(0, 8).forEach((s, i) => {
      const y = 130 + i * 62;
      const g = add(this.add.graphics().setPosition(12, y));
      drawCard(g, WIDTH - 24, 56, { radius: 14, shadow: 2, stroke: s.place <= 3 ? TC.orange : TC.navy });
      add(themeText(this, 26, y + 18, `SEASON ${s.season}`, { size: 15, font: 'display', origin: [0, 0.5] }));
      add(themeText(this, 26, y + 39, `${s.events} TOURNAMENTS  ·  ${s.titles} ${s.titles === 1 ? 'TITLE' : 'TITLES'}  ·  ${s.points.toLocaleString('en-US')} PTS`, { size: 10, color: TC.sub, origin: [0, 0.5] }));
      add(themeText(this, WIDTH - 26, y + 28, `#${s.place}`, { size: 26, color: s.place <= 3 ? TC.orange : TC.navy, font: 'display', origin: [1, 0.5] }));
    });
  }

  private online(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const g = add(this.add.graphics().setPosition(12, 150));
    drawCard(g, WIDTH - 24, 200, { radius: 16 });
    add(themeText(this, WIDTH / 2, 190, 'ONLINE RANKING', { size: 20, font: 'display' }));
    add(themeText(this, WIDTH / 2, 226, 'COMING SOON', { size: 16, color: TC.orange, font: 'display' }));
    add(themeText(this, WIDTH / 2, 288, 'Compare your records and your ranking points\nwith players from all over the world.\nYour progress stays on this device until then.', { size: 12, color: TC.sub, align: 'center' }).setLineSpacing(4));
  }
}
