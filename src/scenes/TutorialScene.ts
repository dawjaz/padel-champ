import Phaser from 'phaser';
import { applyHd } from '../hd';
import { COLORS, css, FONT, WIDTH, HD_SCALE } from '../config';
import { updateSave } from '../save';
import { logoText, makeButton } from '../ui';

const PAGES: Array<{ title: string; lines: string[] }> = [
  { title: 'THE POINT', lines: ['Padel is played in pairs, with', 'walls. Every ball you hit has to', 'cross the net and bounce in the', 'court before it touches anything.', '', 'You choose each shot from a menu:', 'pick the TYPE, then the SHOT,', 'then the DIRECTION.'] },
  { title: 'SERVE AND RECEIVE', lines: ['Serve to the body, the T or the', 'glass. A fault gives a slower,', 'easier second serve.', '', 'When the opponent serves, the ball', 'flies in slow motion: read its', 'speed and direction, THEN pick', 'how to return it.'] },
  { title: 'GUTS (G)', lines: ['Every shot costs guts. A tired', 'player is slower, weaker and less', 'accurate; below half the bar the', 'drop starts. Soft shots recover.', '', 'A shot you cannot pay for loses', '40% of its attack. Drinks and', 'gels from the shop help.'] },
  { title: 'WHAT CAN I PLAY?', lines: ['The menu only offers shots that', 'fit the ball:', '', 'VOLLEY: only out of the air.', 'BAJADA: only off the back glass.', 'BANDEJA, VIBORA: high balls that', 'did not touch the glass.', 'SMASH: weak lobs. LOB: any time.'] },
  { title: 'CAREER', lines: ['Win matches for XP and coins.', 'Spend skill points on your hero,', 'open packs for gear, play knockout', 'tournaments in the CAREER calendar', 'and climb the ranking.', '', 'Tournament ties are best of one', 'match. Trophies pay bonus coins.'] },
];

export class TutorialScene extends Phaser.Scene {
  private page = 0;
  private next: { scene: string; data?: object } = { scene: 'TitleScene' };

  constructor() {
    super('TutorialScene');
  }

  init(data: { next?: string; data?: object }): void {
    this.page = 0;
    this.next = { scene: data.next ?? 'TitleScene', data: data.data };
  }

  create(): void {
    this.render();
  }

  private finish(): void {
    updateSave((d) => ({ ...d, settings: { ...d.settings, tutorialSeen: true } }));
    this.scene.start(this.next.scene, this.next.data);
  }

  private render(): void {
    this.children.removeAll(true);
    applyHd(this);
    const p = PAGES[this.page];
    logoText(this, WIDTH / 2, 70, 'HOW TO PLAY', 30, COLORS.yellow);
    logoText(this, WIDTH / 2, 130, p.title, 22, COLORS.white);
    this.add.rectangle(WIDTH / 2, 300, 330, 230, 0x000000, 0.5).setStrokeStyle(2, COLORS.sky);
    this.add
      .text(WIDTH / 2, 300, p.lines.join('\n'), { fontFamily: FONT, resolution: HD_SCALE, fontSize: '13px', color: css(COLORS.white), align: 'center', lineSpacing: 4 })
      .setOrigin(0.5);
    this.add.text(WIDTH / 2, 440, `${this.page + 1} / ${PAGES.length}`, { fontFamily: FONT, resolution: HD_SCALE, fontSize: '12px', color: css(COLORS.gray) }).setOrigin(0.5);
    const last = this.page === PAGES.length - 1;
    makeButton(this, WIDTH / 2, 490, 240, 48, last ? 'LET\'S PLAY' : 'NEXT', () => {
      if (last) this.finish();
      else { this.page++; this.render(); }
    });
    makeButton(this, WIDTH / 2, 550, 240, 40, 'SKIP', () => this.finish());
  }
}
