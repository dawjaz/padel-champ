import Phaser from 'phaser';
import { WIDTH } from '../config';
import { updateSave } from '../save';
import { applyLightScreen, drawCard, makeThemeButton, TC, themeText } from '../theme';

const PAGES: Array<{ title: string; lines: string[] }> = [
  { title: 'THE POINT', lines: ['Padel is played in pairs, with', 'walls. Every ball you hit has to', 'cross the net and bounce in the', 'court before it touches anything.', '', 'You choose each shot from a menu:', 'pick the TYPE, then the SHOT,', 'then the DIRECTION.'] },
  { title: 'SERVE AND RECEIVE', lines: ['Serve to the body, the T or the', 'glass. A fault gives a slower,', 'easier second serve.', '', 'When the opponent serves, the ball', 'flies in slow motion: read its', 'speed and direction, THEN pick', 'how to return it.'] },
  { title: 'GUTS (G)', lines: ['Every shot costs guts. A tired', 'player is slower, weaker and less', 'accurate; below half the bar the', 'drop starts. Soft shots recover.', '', 'A shot you cannot pay for is', 'RISKY (red): +15% chance to', 'miss per missing G. Boosts help.'] },
  { title: 'WHAT CAN I PLAY?', lines: ['The menu only offers shots that', 'fit the ball:', '', 'VOLLEY, VIBORA, BANDEJA: only', 'out of the air, never after a bounce.', 'BAJADA: only off the back glass.', 'SMASH: weak lobs. LOB: any time.'] },
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
    applyLightScreen(this, false);
    const p = PAGES[this.page];
    themeText(this, WIDTH / 2, 56, 'HOW TO PLAY', { size: 30, color: TC.navy, font: 'display' });
    themeText(this, WIDTH / 2, 112, p.title, { size: 20, color: TC.orange, font: 'display' });
    const card = this.add.graphics().setPosition(15, 144);
    drawCard(card, 330, 262, { radius: 18 });
    themeText(this, WIDTH / 2, 275, p.lines.join('\n'), { size: 14, color: TC.navy, align: 'center', weight: '700' }).setLineSpacing(5);
    // Page dots
    PAGES.forEach((_, i) => {
      const d = this.add.graphics();
      d.fillStyle(i === this.page ? TC.orange : TC.sky, 1);
      d.fillCircle(WIDTH / 2 + (i - (PAGES.length - 1) / 2) * 18, 434, 5);
      d.lineStyle(1.5, TC.navy, 1);
      d.strokeCircle(WIDTH / 2 + (i - (PAGES.length - 1) / 2) * 18, 434, 5);
    });
    const last = this.page === PAGES.length - 1;
    makeThemeButton(this, WIDTH / 2, 494, 260, 54, last ? "LET'S PLAY" : 'NEXT', () => {
      if (last) this.finish();
      else { this.page++; this.render(); }
    }, 'primary', 22);
    makeThemeButton(this, WIDTH / 2, 556, 160, 40, 'SKIP', () => this.finish(), 'secondary', 15);
  }
}
