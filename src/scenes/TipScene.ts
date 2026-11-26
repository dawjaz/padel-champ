import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { applyHd } from '../hd';
import { makeAppearance } from '../career/tournament';
import { heroLook } from '../career/profile';
import { seededRng } from '../game/rng';
import { buildSlide, SLIDE_H, SLIDE_W, type Slide } from './tutorialSlides';
import { getSave, updateSave } from '../save';
import { lessonById, markTip, setTipsOff, type Lesson } from '../tutorial/lessons';
import type { Appearance } from '../game/types';
import { drawCard, makeThemeButton, TC, themeText } from '../theme';

export interface TipData {
  /** Lessons to show one after the other (each is marked as seen). */
  queue: string[];
  /** The scene underneath: paused while this one is open, resumed when it closes. */
  under: string;
  /** Called (on the scene underneath, after it is resumed) when the last page is closed. */
  done?: () => void;
  /** Contextual tip (offers to switch tips off) rather than a lesson opened from the list. */
  tip?: boolean;
}

/**
 * A lesson over another scene: a drawing that moves, a few lines under it, NEXT / GOT IT. Tips show it once, the first time the
 * player reaches a place; the list under SETTINGS > HOW TO PLAY shows it again.
 */
export class TipScene extends Phaser.Scene {
  private d!: TipData;
  private lesson!: Lesson;
  private page = 0;
  private slide: Slide | null = null;
  private body: Phaser.GameObjects.GameObject[] = [];
  private inQueue = 0;
  private closing = false;

  constructor() {
    super('TipScene');
  }

  init(data: TipData): void {
    this.d = data;
    this.inQueue = 0;
    this.closing = false;
    this.page = 0;
    this.lesson = lessonById(data.queue[0])!;
    this.body = [];
  }

  create(): void {
    applyHd(this);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, TC.navyDark, 0.82).setInteractive().on('pointerdown', () => undefined);
    this.markSeen();
    this.render();
  }

  update(time: number, delta: number): void {
    this.slide?.update(time, delta);
  }

  private markSeen(): void {
    updateSave((s) => ({ ...s, tips: markTip(s.tips, this.lesson.id) }));
  }

  private render(): void {
    this.slide?.destroy();
    this.slide = null;
    for (const o of this.body) o.destroy();
    this.body = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.body.push(o);
      return o;
    };
    const pg = this.lesson.pages[this.page];
    const card = add(this.add.graphics().setPosition(14, 44));
    drawCard(card, WIDTH - 28, 556, { radius: 22, shadow: 5 });
    add(themeText(this, WIDTH / 2, 68, this.lesson.title, { size: 12, color: TC.sub, font: 'display' }));
    add(themeText(this, WIDTH / 2, 94, pg.head, { size: 21, color: TC.orange, font: 'display' }));
    const ox = (WIDTH - SLIDE_W) / 2;
    const oy = 116;
    const cast = this.cast();
    this.slide = buildSlide(this, pg.art, ox, oy, cast);
    add(themeText(this, WIDTH / 2, oy + SLIDE_H + 44, pg.text, { size: 13, color: TC.navy, align: 'center', weight: '700' }).setLineSpacing(4));
    // page dots
    const n = this.lesson.pages.length;
    for (let i = 0; i < n; i++) {
      const dot = add(this.add.graphics());
      dot.fillStyle(i === this.page ? TC.orange : TC.sky, 1).fillCircle(WIDTH / 2 + (i - (n - 1) / 2) * 18, 460, 5);
      dot.lineStyle(1.5, TC.navy, 1).strokeCircle(WIDTH / 2 + (i - (n - 1) / 2) * 18, 460, 5);
    }
    const last = this.page === n - 1;
    const more = this.inQueue < this.d.queue.length - 1;
    const label = !last ? 'NEXT' : more ? 'NEXT LESSON' : 'GOT IT';
    const next = makeThemeButton(this, WIDTH / 2, 508, 250, 50, label, () => this.advance(), 'primary', 22);
    this.body.push(...(next.parts as Phaser.GameObjects.GameObject[]));
    if (this.d.tip) {
      const off = makeThemeButton(this, WIDTH / 2, 566, 210, 30, getSave().tips.off ? 'TIPS ARE OFF' : "DON'T SHOW TIPS", () => {
        updateSave((s) => ({ ...s, tips: setTipsOff(s.tips, !s.tips.off) }));
        off.text.setText(getSave().tips.off ? 'TIPS ARE OFF' : "DON'T SHOW TIPS");
      }, 'secondary', 12);
      this.body.push(...(off.parts as Phaser.GameObjects.GameObject[]));
    }
  }

  /** The player as he looks in the game, his partner and an opponent (always the same two faces). */
  private cast(): { hero: Appearance; mate: Appearance; rival: Appearance } {
    const p = getSave().profile;
    return { hero: heroLook(p), mate: makeAppearance(seededRng(11), p.gender === 'male'), rival: makeAppearance(seededRng(5), p.gender !== 'male') };
  }

  private advance(): void {
    if (this.closing) return;
    if (this.page < this.lesson.pages.length - 1) {
      this.page++;
      this.render();
      return;
    }
    if (this.inQueue < this.d.queue.length - 1) {
      this.inQueue++;
      this.lesson = lessonById(this.d.queue[this.inQueue])!;
      this.page = 0;
      this.markSeen();
      this.render();
      return;
    }
    this.closing = true;
    const { under, done } = this.d;
    this.slide?.destroy();
    this.slide = null;
    this.scene.stop();
    this.scene.resume(under);
    done?.();
  }
}
