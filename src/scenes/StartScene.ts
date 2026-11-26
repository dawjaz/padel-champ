import Phaser from 'phaser';
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

    this.add.rectangle(WIDTH / 2, 576, WIDTH, 42, 0x0a0f2e, 0.72);
    const tap = this.add.text(WIDTH / 2, 576, 'TAP TO PLAY', { fontFamily: SPORT, fontSize: '26px', fontStyle: 'italic', color: '#ffffff', resolution: 2 })
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
}
