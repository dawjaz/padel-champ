import Phaser from 'phaser';
import { HD_SCALE, HEIGHT, WIDTH } from '../config';
import { cityAccent, drawCup } from '../art/cupArt';
import { CUT_FULL_MS, CUT_SHORT_MS, cutDecision, type CutOccasion } from '../art/cutscenes';
import { disappointSteps, easeOut, fistSteps, frustrationSteps, highFiveSteps, inOut, type Step } from '../art/rig';
import { POSES, type PoseSpec } from '../art/toon/character';
import type { Appearance } from '../game/types';
import { applyHd } from '../hd';
import { getSave, updateSave } from '../save';
import { sfx } from '../audio';
import { DISPLAY } from '../theme';
import { StageActor } from './stageActor';

/** Who and what a cutscene shows. */
export interface CutCast {
  hero: { name: string; appearance: Appearance };
  partner?: { name: string; appearance: Appearance };
  opponents?: Array<{ name: string; appearance: Appearance }>;
  /** The tournament ("Regional Open Warsaw") and its city; the round ("SEMI-FINAL"). */
  event?: string;
  city?: string;
  round?: string;
  /** The cup of a won (gold) or lost final (silver). */
  cup?: { division: string; city: string; symbol: string; metal: 'gold' | 'silver' };
}

/**
 * Plays the cutscene of `occasion` over `scene` (which is paused meanwhile) if its turn has come (`cutDecision`: Settings > CUTSCENES,
 * how often it has been seen), then calls `done`. Without a cutscene `done` runs at once.
 */
export function playCutscene(scene: Phaser.Scene, occasion: CutOccasion, cast: CutCast, done: () => void): void {
  const save = getSave();
  const d = cutDecision(occasion, save.cuts, save.settings.cutscenes, Math.random);
  if (!d.play) {
    done();
    return;
  }
  updateSave((s) => ({ ...s, cuts: d.history }));
  scene.events.once('cutscene-done', done);
  scene.scene.launch('CutsceneScene', { occasion, variant: d.variant, short: d.short, cast, under: scene.scene.key });
  scene.scene.pause();
}

type P = Partial<PoseSpec>;
const pose = (p: P): PoseSpec => ({ ...POSES.ready, ...p });
const WAVE_A = pose({ hand: [156, 34], racket: 18, off: [60, 190], crouch: 2 });
const WAVE_B = pose({ hand: [176, 46], racket: 40, off: [60, 190], crouch: 2 });
const ARMS_UP = pose({ hand: [124, 6], racket: -8, off: [76, 6], crouch: -6, lean: 0 });
const HOLD_LOW = pose({ hand: [118, 120], racket: 170, off: [82, 120], crouch: 2 });
const CLAP_A = pose({ hand: [112, 136], racket: 170, off: [90, 134], crouch: 4 });
const CLAP_B = pose({ hand: [124, 140], racket: 170, off: [76, 138], crouch: 4 });
const HAND_OUT = pose({ hand: [150, 150], racket: 150, off: [64, 190], crouch: 4, lean: 3 });
const HEAD_DOWN = pose({ hand: [138, 198], racket: 170, off: [64, 192], crouch: 6, head: [0, 8], mood: 'sad' });

/** The scenes between events: cinema bars, a spotlight, the players (the match's rig, big), a caption; a touch skips. */
export class CutsceneScene extends Phaser.Scene {
  private actors: StageActor[] = [];
  private under = '';
  private over = false;
  private len = CUT_FULL_MS;

  constructor() {
    super('CutsceneScene');
  }

  create(data: { occasion: CutOccasion; variant: string; short: boolean; cast: CutCast; under: string }): void {
    applyHd(this);
    // a new start: the fade-out that ended the last cutscene must not carry over
    this.cameras.main.resetFX();
    this.cameras.main.setAlpha(1);
    this.scene.bringToTop();
    this.actors = [];
    this.over = false;
    this.under = data.under;
    this.len = data.short ? CUT_SHORT_MS : CUT_FULL_MS;
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x050b1a, 0.72).setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: shade, alpha: 1, duration: 180 });
    this.spotlight(WIDTH / 2, 330);
    this.stage(data);
    // cinema bars, over everything
    const top = this.add.rectangle(0, -70, WIDTH, 70, 0x000000).setOrigin(0, 0).setDepth(100);
    const bottom = this.add.rectangle(0, HEIGHT, WIDTH, 70, 0x000000).setOrigin(0, 0).setDepth(100);
    this.tweens.add({ targets: top, y: 0, duration: 220, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: bottom, y: HEIGHT - 70, duration: 220, ease: 'Cubic.easeOut' });
    this.add
      .text(WIDTH - 12, HEIGHT - 14, 'TAP TO SKIP', { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '10px', color: '#ffffff' })
      .setOrigin(1, 1)
      .setAlpha(0.55)
      .setDepth(101);
    // a touch skips (not in the first moment: the touch that started it must not end it)
    this.time.delayedCall(250, () => {
      const z = this.add.zone(0, 0, WIDTH, HEIGHT).setOrigin(0, 0).setDepth(102).setInteractive();
      z.on('pointerdown', () => this.finish());
    });
    this.time.delayedCall(this.len, () => this.finish());
  }

  update(time: number, delta: number): void {
    for (const a of this.actors) a.update(time, delta);
  }

  /** The time `t` (ms of the full cut) in this cut. */
  private at(t: number): number {
    return (t * this.len) / CUT_FULL_MS;
  }

  private later(t: number, fn: () => void): void {
    this.time.delayedCall(this.at(t), fn);
  }

  private finish(): void {
    if (this.over) return;
    this.over = true;
    this.cameras.main.fadeOut(160, 5, 11, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const under = this.scene.get(this.under);
      this.scene.resume(this.under);
      this.scene.stop();
      under.events.emit('cutscene-done');
    });
  }

  // ---------- building blocks ----------

  private spotlight(x: number, y: number): void {
    const g = this.add.graphics().setDepth(1);
    for (let i = 10; i >= 1; i--) g.fillStyle(0xfff3c4, 0.018 * (11 - i)).fillEllipse(x, y + 90, 40 * i, 12 * i);
    for (let i = 8; i >= 1; i--) g.fillStyle(0x9cc8ff, 0.012 * (9 - i)).fillCircle(x, y - 40, 26 * i);
  }

  private actor(a: { appearance: Appearance }, x: number, y = 440, h = 210, base: 'front' | 'back' = 'front'): StageActor {
    const s = new StageActor(this, a.appearance, x, y, h, base, 20);
    this.actors.push(s);
    return s;
  }

  private caption(text: string, sub = '', color = '#ffe066', delay = 120): void {
    const t = this.add
      .text(WIDTH / 2, 498, text, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '34px', color, align: 'center' })
      .setOrigin(0.5)
      .setDepth(60)
      .setStroke('#0b2a5b', 8)
      .setScale(1.5)
      .setAlpha(0);
    if (t.width > WIDTH - 24) t.setFontSize(Math.floor((34 * (WIDTH - 24)) / t.width));
    this.tweens.add({ targets: t, alpha: 1, scale: 1, delay: this.at(delay), duration: 260, ease: 'Back.easeOut' });
    if (sub) {
      const s = this.add
        .text(WIDTH / 2, 534, sub, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '14px', color: '#ffffff', align: 'center' })
        .setOrigin(0.5)
        .setDepth(60)
        .setAlpha(0);
      this.tweens.add({ targets: s, alpha: 1, delay: this.at(delay + 220), duration: 240 });
    }
  }

  /** A crowd behind the players: rows of heads in the dark, some camera flashes. */
  private crowd(flashes: number): void {
    const g = this.add.graphics().setDepth(2);
    const cols = [0x2a3d63, 0x34507d, 0x22324f, 0x3c5a8a];
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 16; i++) {
        const x = 12 + i * 23 + (row % 2) * 11;
        const y = 150 + row * 22;
        g.fillStyle(cols[(i + row) % cols.length], 1).fillCircle(x, y, 8).fillRoundedRect(x - 10, y + 6, 20, 14, 5);
      }
    }
    for (let i = 0; i < flashes; i++) {
      this.later(150 + Math.random() * 2100, () => {
        const f = this.add.circle(10 + Math.random() * (WIDTH - 20), 145 + Math.random() * 60, 5, 0xffffff, 1).setDepth(3);
        this.tweens.add({ targets: f, scale: 3, alpha: 0, duration: 260, onComplete: () => f.destroy() });
      });
    }
  }

  private confetti(n: number): void {
    const cols = [0xffd23f, 0xff6b4a, 0x4ade80, 0x5db4ff, 0xffffff, 0xc77dff];
    for (let i = 0; i < n; i++) {
      const c = this.add.rectangle(Math.random() * WIDTH, -10 - Math.random() * 120, 5, 9, cols[i % cols.length]).setDepth(40);
      this.tweens.add({
        targets: c,
        y: HEIGHT + 20,
        x: c.x + (Math.random() - 0.5) * 80,
        angle: 360 + Math.random() * 540,
        delay: this.at(Math.random() * 800),
        duration: this.at(1800 + Math.random() * 900),
        onComplete: () => c.destroy(),
      });
    }
  }

  private rain(): void {
    const g = this.add.graphics().setDepth(41);
    const drops = Array.from({ length: 70 }, () => ({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, v: 9 + Math.random() * 6 }));
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        g.clear().lineStyle(1.5, 0xa9c6ff, 0.55);
        for (const d of drops) {
          d.y += d.v;
          d.x -= 1.5;
          if (d.y > HEIGHT) {
            d.y = -10;
            d.x = Math.random() * (WIDTH + 40);
          }
          g.lineBetween(d.x, d.y, d.x + 3, d.y - 12);
        }
      },
    });
  }

  private cup(x: number, y: number, size: number, metal: 'gold' | 'silver', cast: CutCast): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(30);
    const c = cast.cup;
    drawCup(g, x, y, size, c?.division ?? 'club', metal, cityAccent(c?.city ?? cast.city ?? ''), c?.symbol ?? '');
    return g;
  }

  /** A broadcast-style band with a title (the tournament, the round). */
  private band(title: string, sub: string): void {
    const g = this.add.graphics().setDepth(50);
    g.fillStyle(0xff8a1a, 1).fillRect(0, 92, WIDTH, 50);
    g.fillStyle(0x0b2a5b, 1).fillRect(0, 142, WIDTH, 24);
    g.x = -WIDTH;
    this.tweens.add({ targets: g, x: 0, duration: 260, ease: 'Cubic.easeOut' });
    const t = this.add.text(16, 117, title, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '22px', color: '#ffffff' }).setOrigin(0, 0.5).setDepth(51).setAlpha(0);
    if (t.width > WIDTH - 32) t.setFontSize(Math.floor((22 * (WIDTH - 32)) / t.width));
    const s = this.add.text(16, 154, sub, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '12px', color: '#ffe066' }).setOrigin(0, 0.5).setDepth(51).setAlpha(0);
    this.tweens.add({ targets: [t, s], alpha: 1, delay: 220, duration: 200 });
  }

  private loop(a: StageActor, steps: Step[], from: number, times: number, every: number): void {
    for (let i = 0; i < times; i++) this.later(from + i * every, () => a.play(steps));
  }

  // ---------- the scenes ----------

  private stage(d: { occasion: CutOccasion; variant: string; cast: CutCast }): void {
    const c = d.cast;
    const hero = c.hero;
    const mate = c.partner;
    const opp = c.opponents ?? [];
    const pair = (y = 440, h = 210, base: 'front' | 'back' = 'front'): [StageActor, StageActor | null] => [
      this.actor(hero, mate ? 128 : WIDTH / 2, y, h, base),
      mate ? this.actor(mate, 232, y, h, base) : null,
    ];
    const names = mate ? `${hero.name.toUpperCase()} & ${mate.name.toUpperCase()}` : hero.name.toUpperCase();
    const oppNames = opp.map((o) => o.name.toUpperCase()).join(' & ');
    switch (`${d.occasion}:${d.variant}`) {
      case 'tourStart:city': {
        this.crowd(8);
        const [a, b] = pair();
        a.x = -60;
        a.walkTo(128, this.at(700));
        if (b) {
          b.x = WIDTH + 60;
          b.walkTo(232, this.at(700));
        }
        this.loop(a, [[200, WAVE_A, easeOut], [200, WAVE_B, inOut], [200, WAVE_A, inOut], [300, POSES.ready, inOut]], 800, 1, 0);
        if (b) this.loop(b, [[200, WAVE_A, easeOut], [200, WAVE_B, inOut], [200, WAVE_A, inOut], [300, POSES.ready, inOut]], 900, 1, 0);
        this.caption((c.city ?? 'WELCOME').toUpperCase(), c.event ?? '', '#ffffff', 600);
        sfx('coinLand');
        break;
      }
      case 'tourStart:broadcast': {
        this.band(c.event ?? 'TOURNAMENT', `${c.round ?? 'FIRST ROUND'}  ·  ${names}`);
        const [a, b] = pair(460, 220, 'back');
        a.play(fistSteps(false));
        b?.play(highFiveSteps(-1));
        this.caption('LET IT BEGIN!', '', '#ffe066', 700);
        sfx('coinLand');
        break;
      }
      case 'preMatch:versus': {
        // your pair on the left, theirs on the right, VS between
        this.actor(hero, 70, 430, 170);
        if (mate) this.actor(mate, 132, 448, 160);
        if (opp[0]) this.actor(opp[0], 290, 430, 170);
        if (opp[1]) this.actor(opp[1], 228, 448, 160);
        const vs = this.add
          .text(WIDTH / 2, 300, 'VS', { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '54px', color: '#ff8a1a' })
          .setOrigin(0.5)
          .setDepth(60)
          .setStroke('#ffffff', 8)
          .setScale(3)
          .setAlpha(0);
        this.tweens.add({ targets: vs, scale: 1, alpha: 1, delay: this.at(300), duration: 260, ease: 'Back.easeOut' });
        this.later(320, () => this.cameras.main.shake(140, 0.006));
        this.caption(c.round ?? 'MATCH', `${names}  vs  ${oppNames}`, '#ffffff', 500);
        sfx('point');
        break;
      }
      case 'preMatch:walkon': {
        this.crowd(10);
        const ours = [this.actor(hero, -40, 440, 190), ...(mate ? [this.actor(mate, -110, 452, 180)] : [])];
        const theirs = opp.map((o, i) => this.actor(o, WIDTH + 40 + i * 70, 440 + i * 12, 190 - i * 10));
        ours.forEach((a, i) => a.walkTo(90 + i * 60, this.at(900)));
        theirs.forEach((a, i) => a.walkTo(WIDTH - 90 - i * 60, this.at(900)));
        this.caption(c.round ?? 'MATCH TIME', c.event ?? '', '#ffffff', 800);
        break;
      }
      case 'gameWon:fist': {
        const a = this.actor(hero, WIDTH / 2, 470, 260);
        a.play(fistSteps(true));
        this.caption('GAME!', names);
        sfx('point');
        break;
      }
      case 'gameWon:highfive': {
        const [a, b] = pair();
        a.play(highFiveSteps(1));
        b?.play(highFiveSteps(-1));
        this.later(330, () => this.cameras.main.shake(90, 0.004));
        this.caption('GAME!', names);
        sfx('point');
        break;
      }
      case 'gameLost:headshake': {
        const a = this.actor(hero, WIDTH / 2, 470, 260);
        a.play(frustrationSteps().slice(0, 3));
        this.caption('GAME TO THEM', 'shake it off', '#ff9a6a');
        break;
      }
      case 'gameLost:encourage': {
        const [a, b] = pair();
        a.play(disappointSteps());
        if (b) this.later(500, () => b.play(fistSteps(false)));
        this.later(1100, () => a.play(fistSteps(false)));
        this.caption('COME ON!', 'the next one is ours', '#ffffff', 700);
        break;
      }
      case 'matchWon:jump': {
        this.crowd(14);
        const [a, b] = pair();
        a.play(fistSteps(true)).hop(46, 420, this.at(100));
        b?.play(fistSteps(true)).hop(46, 420, this.at(220));
        this.later(900, () => {
          a.hop(30, 360);
          b?.hop(30, 360, 80);
        });
        this.confetti(60);
        this.caption('MATCH WON!', names);
        sfx('win');
        break;
      }
      case 'matchWon:handshake':
      case 'matchLost:handshake': {
        const won = d.occasion === 'matchWon';
        const a = this.actor(hero, 40, 440, 190);
        const o = opp[0] ? this.actor(opp[0], WIDTH - 40, 440, 190) : null;
        a.walkTo(138, this.at(600), 440, () => a.to(HAND_OUT, 200));
        o?.walkTo(222, this.at(600), 440, () => o.to(HAND_OUT, 200));
        this.later(1500, () => {
          a.to(POSES.ready, 300);
          o?.to(POSES.ready, 300);
        });
        this.caption(won ? 'WELL PLAYED' : 'NEXT TIME', won ? 'a handshake at the net' : 'they were better today', won ? '#ffe066' : '#ffffff', 700);
        sfx(won ? 'win' : 'lose');
        break;
      }
      case 'matchLost:walkoff':
      case 'earlyExit:walkoff': {
        const [a, b] = pair(450, 200, 'back');
        a.to(HEAD_DOWN, 400);
        b?.to(HEAD_DOWN, 500);
        this.later(700, () => {
          a.walkTo(a.x - 40, this.at(1600), 420);
          b?.walkTo(b.x + 40, this.at(1600), 420);
        });
        const exit = d.occasion === 'earlyExit';
        this.caption(exit ? 'OUT OF THE TOURNAMENT' : 'MATCH LOST', exit ? (c.event ?? '') : names, '#ff9a6a', 500);
        sfx('lose');
        break;
      }
      case 'earlyExit:rain': {
        this.rain();
        const a = this.actor(hero, WIDTH / 2, 470, 250);
        a.to(HEAD_DOWN, 500);
        this.caption('NOT OUR DAY', c.event ?? '', '#a9c6ff', 600);
        sfx('lose');
        break;
      }
      case 'champion:lift': {
        this.crowd(22);
        const [a, b] = pair(460, 200);
        a.to(ARMS_UP, 300);
        b?.to(ARMS_UP, 360);
        // the cup over their heads, between their hands
        const cx = mate ? WIDTH / 2 : WIDTH / 2;
        const cupG = this.cup(cx, 190, 92, 'gold', c);
        cupG.y = 40;
        cupG.setAlpha(0);
        this.tweens.add({ targets: cupG, y: 0, alpha: 1, delay: this.at(200), duration: 360, ease: 'Back.easeOut' });
        this.tweens.add({ targets: cupG, y: -10, delay: this.at(700), duration: 260, yoyo: true, repeat: 3 });
        a.hop(14, 300, this.at(700));
        b?.hop(14, 300, this.at(760));
        this.confetti(90);
        this.caption('CHAMPIONS!', c.event ?? names);
        this.later(250, () => this.cameras.main.flash(180, 255, 236, 170));
        sfx('win');
        break;
      }
      case 'champion:photo': {
        this.crowd(30);
        const [a, b] = pair(460, 200);
        a.to(HOLD_LOW, 300);
        b?.to(HOLD_LOW, 300);
        this.cup(WIDTH / 2, 330, 70, 'gold', c);
        this.confetti(40);
        this.caption(`${(c.event ?? 'TOURNAMENT').toUpperCase()}`, `CHAMPIONS: ${names}`, '#ffe066', 400);
        for (let i = 0; i < 4; i++) this.later(500 + i * 420, () => this.cameras.main.flash(90, 255, 255, 255));
        sfx('win');
        break;
      }
      case 'runnerUp:applause': {
        this.crowd(8);
        const [a, b] = pair();
        for (const x of [a, b]) {
          if (!x) continue;
          this.loop(x, [[120, CLAP_A, easeOut], [120, CLAP_B, easeOut]], 200, 8, 240);
        }
        this.cup(WIDTH / 2, 300, 56, 'silver', c);
        this.caption('RUNNER-UP', c.event ?? '', '#dfe7f2', 300);
        break;
      }
      case 'runnerUp:determined': {
        const a = this.actor(hero, WIDTH / 2, 470, 260);
        a.to(HEAD_DOWN, 300);
        this.later(1000, () => a.play(fistSteps(false)));
        this.caption('SO CLOSE', 'next time it is ours', '#ffffff', 900);
        break;
      }
      default: {
        const a = this.actor(hero, WIDTH / 2, 470, 240);
        a.play(fistSteps(false));
        this.caption(names);
      }
    }
  }
}
