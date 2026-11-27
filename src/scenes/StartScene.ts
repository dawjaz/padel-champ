import Phaser from 'phaser';
import { T } from '../i18n';
import { BUILD_ID, GAME_SUBTITLE, GAME_TITLE, GAME_VERSION, HEIGHT, WIDTH } from '../config';
import { applyHd } from '../hd';
import { heroLook } from '../career/profile';
import { getSave } from '../save';
import { buildToon, FIG } from '../art/toon/character';
import { renderOpsCanvas, VIEW } from '../art/toon/ops';
import { sfx } from '../audio';
import { SPORT, themeText, TC } from '../theme';

/** Pixels per character unit of the big hero on this screen. */
const UNIT = 1.6;

/**
 * The start screen ("tap to play"): night court with beams, the logo, the hero in the smash pose, a pulsing TAP TO PLAY.
 * Shown once per launch, after the intro; a touch opens the main menu (TitleScene).
 */
export class StartScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
  }

  create(): void {
    applyHd(this);
    const bg = this.add.image(WIDTH / 2, HEIGHT / 2, 'start_bg');
    bg.setDisplaySize(WIDTH, HEIGHT);

    // The hero (the player's own look and gear) in the smash pose, big, standing on the court.
    const look = heroLook(getSave().profile);
    const key = `start-hero:${JSON.stringify(look)}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, renderOpsCanvas(buildToon(look, 'front', 'smashHit', true), UNIT));
    const height = 300;
    const k = height / (FIG.feet - FIG.top);
    const hero = this.add.image(WIDTH / 2 - 10, 624, key);
    hero.setOrigin((FIG.cx - VIEW.x) / VIEW.w, (FIG.feet + 2 - VIEW.y) / VIEW.h);
    hero.setDisplaySize(VIEW.w * k, VIEW.h * k);
    this.tweens.add({ targets: hero, y: hero.y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const logo = this.add.image(WIDTH / 2 - 6, 124, 'logo_all');
    logo.setScale(300 / logo.width);
    this.tweens.add({ targets: logo, scale: logo.scale * 1.03, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.addLife(hero);

    this.add.rectangle(WIDTH / 2, 576, WIDTH, 42, 0x0a0f2e, 0.72);
    const tap = this.add.text(WIDTH / 2, 576, T('TAP TO PLAY'), { fontFamily: SPORT, fontSize: '26px', fontStyle: 'italic', color: '#ffffff', resolution: 2 })
      .setOrigin(0.5).setPadding(8, 4, 14, 4).setShadow(3, 3, '#e8261c', 0, true, true).setLetterSpacing(2);
    this.tweens.add({ targets: tap, alpha: 0.35, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    themeText(this, WIDTH / 2, HEIGHT - 8, `${GAME_TITLE}: ${GAME_SUBTITLE}  v${GAME_VERSION} (${BUILD_ID})`, { size: 8, color: TC.white, weight: '600' }).setAlpha(0.6);

    this.cameras.main.fadeIn(220, 10, 15, 46);
    this.input.once('pointerdown', () => {
      sfx('select');
      this.cameras.main.fadeOut(200, 234, 241, 250);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
    });
  }
  /** The living background: two light beams sweeping the court, a ball rallying across it, sparkles round the logo. */
  private addLife(hero: Phaser.GameObjects.Image): void {
    // Beams: soft white triangles, behind the hero, swaying slowly in opposite directions.
    const beams: Phaser.GameObjects.Graphics[] = [];
    for (const [x, dir, delay] of [[70, 1, 0], [WIDTH - 70, -1, 700]] as const) {
      const g = this.add.graphics().setPosition(x, -10).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.16);
      g.fillStyle(0xbfd8ff, 1);
      g.fillTriangle(0, 0, -34, HEIGHT, 34, HEIGHT);
      g.setDepth(hero.depth - 1);
      g.angle = -9 * dir;
      this.tweens.add({ targets: g, angle: 9 * dir, duration: 3200, delay, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      beams.push(g);
    }
    // The ball: a rally from side to side in front of the hero's feet, with a squashing shadow on the floor.
    const FLOOR = 612;
    const shadow = this.add.ellipse(0, FLOOR + 4, 16, 5, 0x000000, 0.35).setDepth(hero.depth + 1);
    const ball = this.add.circle(0, 0, 6, 0xe8ff3a).setStrokeStyle(1.5, 0x2a3a00).setDepth(hero.depth + 2);
    const rally = (): void => {
      const fromLeft = Math.random() < 0.5;
      const x0 = fromLeft ? -12 : WIDTH + 12, x1 = fromLeft ? WIDTH + 12 : -12;
      const t = { v: 0 };
      this.tweens.add({
        targets: t, v: 1, duration: 2600, ease: 'Linear',
        onUpdate: () => {
          const bounce = Math.abs(Math.sin(t.v * Math.PI * 3));
          ball.x = x0 + (x1 - x0) * t.v;
          ball.y = FLOOR - 6 - bounce * 70 * (1 - t.v * 0.3);
          shadow.x = ball.x;
          shadow.setScale(1 - bounce * 0.5, 1 - bounce * 0.5);
          ball.angle += 14;
        },
        onComplete: () => this.time.delayedCall(1400, rally),
      });
    };
    ball.setPosition(-30, FLOOR);
    this.time.delayedCall(900, rally);
    // Sparkles round the logo: small stars that pop and fade at random spots.
    this.time.addEvent({
      delay: 520, loop: true,
      callback: () => {
        const sp = this.add.star(30 + Math.random() * (WIDTH - 60), 70 + Math.random() * 120, 4, 1.5, 5, 0xffffff).setAlpha(0).setScale(0.4);
        this.tweens.add({ targets: sp, alpha: 0.95, scale: 1.2, angle: 45, duration: 260, yoyo: true, ease: 'Quad.easeOut', onComplete: () => sp.destroy() });
      },
    });
  }
}
