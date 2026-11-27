import Phaser from 'phaser';
import { T } from '../i18n';
import { WIDTH } from '../config';
import { CHALLENGES, CUPS, challengeProgress, goldCount, type Cup } from '../career/cups';
import { divisionById } from '../career/tournament';
import { cityAccent, drawCup } from '../art/cupArt';
import { drawIcon } from '../art/icons';
import { getSave } from '../save';
import { applyLightScreen, bakedShape, drawBar, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

const COLS = 3;
const ROWS = 4;
const PER_PAGE = COLS * ROWS;
const CELL_W = 112;
const CELL_H = 100;
const CH_PER_PAGE = 5;

type Mode = 'cups' | 'seasons' | 'sets';
const NEXT_MODE: Record<Mode, Mode> = { cups: 'seasons', seasons: 'sets', sets: 'cups' };
const MODE_LABEL: Record<Mode, string> = { cups: 'SEASONS', seasons: 'SETS', sets: 'CUPS' };
/** The season trophy: gold for the world top 3, silver for the top 10, bronze for the rest. */
export const seasonMetal = (place: number): 'gold' | 'silver' | 'bronze' => (place <= 3 ? 'gold' : place <= 10 ? 'silver' : 'bronze');
const METAL_FILL = { gold: 0xffc933, silver: 0xc3ccd9, bronze: 0xd08a4a } as const;

/** The cup cabinet: a cup for every city and division, grey until it is won (gold for a title, silver for a lost final). */
export class CupsScene extends Phaser.Scene {
  private mode: Mode = 'cups';
  private page = 0;
  private selected: string | null = null;
  private selectedSeason: number | null = null;

  constructor() {
    super('CupsScene');
  }

  private from = 'TitleScene';

  init(data: { from?: string }): void {
    this.from = data?.from ?? 'TitleScene';
  }

  create(): void {
    this.mode = 'cups';
    this.page = 0;
    this.selected = null;
    this.selectedSeason = null;
    this.render(true);
  }

  private render(first = false): void {
    this.children.removeAll(true);
    applyLightScreen(this, first);
    const save = getSave();
    const shelf = save.profile.cups;
    screenHeader(this, 'Trophies', { onBack: () => this.scene.start(this.from), coins: save.profile.coins });
    const silvers = CUPS.filter((c) => (shelf[c.id]?.silver ?? 0) > 0 && !(shelf[c.id]?.gold > 0)).length;
    themeText(this, WIDTH / 2, 76, T('{0} / {1} GOLD   ·   {2} SILVER', goldCount(shelf), CUPS.length, silvers), { size: 12, color: TC.sub, font: 'display' });
    if (this.mode === 'cups') this.renderCups();
    else if (this.mode === 'seasons') this.renderSeasons();
    else this.renderSets();
    const pages = this.pageCount();
    makeThemeButton(this, 36, 614, 40, 36, '<', () => { this.page = (this.page + pages - 1) % pages; this.selected = null; this.render(); }, 'secondary', 16);
    themeText(this, 76, 614, `${this.page + 1}/${pages}`, { size: 12, color: TC.navy, font: 'display' });
    makeThemeButton(this, 116, 614, 40, 36, '>', () => { this.page = (this.page + 1) % pages; this.selected = null; this.render(); }, 'secondary', 16);
    makeThemeButton(this, 202, 614, 84, 36, MODE_LABEL[this.mode], () => { this.mode = NEXT_MODE[this.mode]; this.page = 0; this.selected = null; this.render(); }, 'blue', 13);
    makeThemeButton(this, 300, 614, 96, 36, 'ACHIEVEMENTS', () => this.scene.start('AchievementsScene', { from: this.from }), 'secondary', 9);
  }

  private pageCount(): number {
    if (this.mode === 'seasons') return 1;
    return Math.ceil((this.mode === 'cups' ? CUPS.length : CHALLENGES.length) / (this.mode === 'cups' ? PER_PAGE : CH_PER_PAGE));
  }

  private renderCups(): void {
    const shelf = getSave().profile.cups;
    const list = CUPS.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    list.forEach((cup, i) => {
      const x = 12 + (i % COLS) * CELL_W;
      const y = 92 + Math.floor(i / COLS) * CELL_H;
      const rec = shelf[cup.id];
      const gold = (rec?.gold ?? 0) > 0;
      const silver = !gold && (rec?.silver ?? 0) > 0;
      const sel = this.selected === cup.id;
      const card = this.add.graphics().setPosition(x + 3, y);
      drawCard(card, CELL_W - 6, CELL_H - 6, { radius: 12, stroke: sel ? TC.orange : gold ? TC.goldDark : TC.navy, fill: gold ? 0xfff3d6 : TC.white, shadow: 2 });
      const metal = gold ? 'gold' : silver ? 'silver' : 'locked';
      bakedShape(this, x + 6, y + 4, CELL_W - 12, 66, (g) => drawCup(g, (CELL_W - 12) / 2, 38, 62, cup.division, metal, cityAccent(cup.city), cup.symbol));
      themeText(this, x + CELL_W / 2, y + 74, cup.city.toUpperCase(), { size: 10, color: gold || silver ? TC.navy : TC.sub, font: 'display' });
      themeText(this, x + CELL_W / 2, y + 86, (divisionById(cup.division)?.name ?? cup.division).toUpperCase(), { size: 7, color: TC.sub });
      if ((rec?.gold ?? 0) > 1) themeText(this, x + CELL_W - 12, y + 12, `x${rec!.gold}`, { size: 11, color: TC.orange, font: 'display', origin: [1, 0.5] });
      this.add.zone(x + 3, y, CELL_W - 6, CELL_H - 6).setOrigin(0, 0).setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.selected = this.selected === cup.id ? null : cup.id;
        this.render();
      });
    });
    this.renderInfo(CUPS.find((c) => c.id === this.selected));
  }

  /** One trophy for every finished season (its metal by the final place in the world), grey for the ones still to play. */
  private renderSeasons(): void {
    const done = getSave().profile.career.seasons;
    const current = getSave().profile.career.season;
    const first = done.length > 0 ? done[0].season : 1;
    for (let i = 0; i < PER_PAGE; i++) {
      const n = first + i;
      const rec = done.find((s) => s.season === n);
      const x = 12 + (i % COLS) * CELL_W;
      const y = 92 + Math.floor(i / COLS) * CELL_H;
      const sel = this.selectedSeason === n;
      const metal = rec ? seasonMetal(rec.place) : null;
      const card = this.add.graphics().setPosition(x + 3, y);
      drawCard(card, CELL_W - 6, CELL_H - 6, { radius: 12, stroke: sel ? TC.orange : metal === 'gold' ? TC.goldDark : TC.navy, fill: metal === 'gold' ? 0xfff3d6 : TC.white, shadow: 2 });
      bakedShape(this, x + 6, y + 4, CELL_W - 12, 66, (g) => {
        const cx = (CELL_W - 12) / 2;
        g.fillStyle(metal ? METAL_FILL[metal] : TC.track, 1).fillCircle(cx, 36, 28).lineStyle(3, TC.navy, 1).strokeCircle(cx, 36, 28);
        g.lineStyle(2, 0xffffff, metal ? 0.6 : 0.2).strokeCircle(cx, 36, 22);
        drawIcon(g, 'trophy', cx, 36, 28, metal ? TC.navy : TC.sub);
      });
      themeText(this, x + CELL_W / 2, y + 76, T('SEASON {0}', n), { size: 10, color: rec ? TC.navy : TC.sub, font: 'display' });
      themeText(this, x + CELL_W / 2, y + 88, rec ? T('#{0} IN THE WORLD', rec.place) : n === current ? 'IN PROGRESS' : 'TO PLAY', { size: 8, color: rec ? TC.orange : TC.sub });
      this.add.zone(x + 3, y, CELL_W - 6, CELL_H - 6).setOrigin(0, 0).setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.selectedSeason = this.selectedSeason === n ? null : n;
        this.render();
      });
    }
    const rec = done.find((s) => s.season === this.selectedSeason);
    const g = this.add.graphics().setPosition(12, 500);
    drawCard(g, WIDTH - 24, 96, { radius: 14 });
    if (!rec) {
      themeText(this, WIDTH / 2, 548, done.length ? 'TAP A TROPHY FOR DETAILS' : 'FINISH A SEASON (24 WEEKS) TO WIN THE FIRST ONE', { size: 12, color: TC.sub, font: 'display', wrap: WIDTH - 48 });
      return;
    }
    themeText(this, WIDTH / 2, 522, T('SEASON {0}: #{1} IN THE WORLD', rec.season, rec.place), { size: 15, color: TC.navy, font: 'display' });
    themeText(this, WIDTH / 2, 550, T('{0} POINTS  ·  {1} TOURNAMENTS  ·  {2} {3}', rec.points.toLocaleString('en-US'), rec.events, rec.titles, T(rec.titles === 1 ? 'TITLE' : 'TITLES')), { size: 10, color: TC.orange });
    themeText(this, WIDTH / 2, 578, T('{0} TROPHY: TOP 3 GOLD, TOP 10 SILVER, THE REST BRONZE', seasonMetal(rec.place).toUpperCase()), { size: 9, color: TC.blue });
  }

  private renderInfo(cup: Cup | undefined): void {
    const rec = cup ? getSave().profile.cups[cup.id] : undefined;
    const g = this.add.graphics().setPosition(12, 500);
    drawCard(g, WIDTH - 24, 96, { radius: 14 });
    if (!cup) {
      themeText(this, WIDTH / 2, 548, 'TAP A CUP FOR DETAILS', { size: 12, color: TC.sub, font: 'display' });
      return;
    }
    themeText(this, WIDTH / 2, 522, cup.name.toUpperCase(), { size: 15, color: TC.navy, font: 'display' });
    const line = rec ? T('GOLD x{0}   ·   SILVER x{1}   ·   LAST: SEASON {2}', rec.gold, rec.silver, rec.season) : 'NOT WON YET: WIN THE TITLE FOR GOLD, REACH THE FINAL FOR SILVER';
    themeText(this, WIDTH / 2, 548, line, { size: 10, color: rec ? TC.orange : TC.sub, wrap: WIDTH - 48 });
    const sets = CHALLENGES.filter((c) => (c.divisions?.includes(cup.division) ?? false) || (c.cities?.includes(cup.city) ?? false)).map((c) => c.name);
    if (sets.length) themeText(this, WIDTH / 2, 578, T('PART OF: {0}', sets.join(', ').toUpperCase()), { size: 9, color: TC.blue, wrap: WIDTH - 48 });
  }

  private renderSets(): void {
    const save = getSave();
    CHALLENGES.slice(this.page * CH_PER_PAGE, (this.page + 1) * CH_PER_PAGE).forEach((ch, i) => {
      const y = 94 + i * 90;
      const done = save.profile.cupClaims.includes(ch.id);
      const pr = challengeProgress(ch, save.profile.cups);
      const g = this.add.graphics().setPosition(12, y);
      drawCard(g, WIDTH - 24, 82, { radius: 14, stroke: done ? TC.orange : TC.navy, fill: done ? 0xfff3d6 : TC.white });
      themeText(this, 24, y + 16, ch.name.toUpperCase(), { size: 14, color: TC.navy, font: 'display', origin: [0, 0.5] });
      themeText(this, WIDTH - 24, y + 16, done ? 'DONE' : `${pr.have}/${pr.need}`, { size: 12, color: done ? TC.green : TC.blue, font: 'display', origin: [1, 0.5] });
      const what = ch.golds ? T('Win {0} different cups (gold).', ch.golds) : ch.divisions ? T('Win gold in every {0} tournament.', ch.divisions.map((d) => divisionById(d)?.name ?? d).join(" / ")) : T('Win gold in every cup of {0}.', ch.cities!.join(', '));
      themeText(this, 24, y + 36, what, { size: 10, color: TC.sub, origin: [0, 0.5], wrap: WIDTH - 60 });
      if (!done) drawBar(this.add.graphics(), 24, y + 52, 190, 8, pr.need ? pr.have / pr.need : 0, TC.blue);
      const packs = Object.entries(ch.packs).map(([id, n]) => T('{0} {1} PACK{2}', n, id.toUpperCase(), T(n > 1 ? 'S' : ''))).join(' + ');
      themeText(this, 24, y + 70, T('+{0} COINS  +  {1}', ch.coins, packs), { size: 10, color: TC.orange, origin: [0, 0.5] });
    });
  }
}
