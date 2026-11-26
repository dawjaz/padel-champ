import Phaser from 'phaser';
import { project } from '../art/camera';
import { kickBody, newBody, runEase, stepBody, type BodyPose, type BodyState } from '../art/bodyDynamics';
import { easeOut, inOut, loadPose, lungePose, poseSignature, Rig, smashSteps, splitSteps, strokeSteps, type Step } from '../art/rig';
import { buildToon } from '../art/toon/character';
import { POSES, runFrame, RUN_FRAMES, SHUFFLE_FRAMES, shuffleFrame } from '../art/toon/character';
import { drawOps, VIEW } from '../art/toon/ops';
import { placeToonSprite } from '../art/toonTexture';
import type { PoseName } from '../art/pose';
import type { Appearance } from '../game/types';

const UNIT = 0.55;
/** The walls are a hard limit: a player's body stays this far inside the side glass and the back glass (court metres). */
export const WALL_ROOM = 0.45;
export const clampX = (x: number): number => Math.max(-5 + WALL_ROOM, Math.min(5 - WALL_ROOM, x));
const clampZ = (z: number): number => Math.max(WALL_ROOM, Math.min(20 - WALL_ROOM, z));
const HEIGHT_M = 1.75;
const RUN_CYCLE_M = 1.7;
const SHUFFLE_CYCLE_M = 0.9;

/**
 * The hero in the camp minigames, animated like in a match: the same rig (glides between poses, strokes, the jumping smash), run and
 * side-step cycles while he moves, the split step, and the body's lean, squash and breathing. Seen from behind (near half); a long run
 * sideways is seen in profile.
 */
export class CampHero {
  readonly sprite: Phaser.GameObjects.Image;
  x: number;
  z: number;
  private rig = new Rig();
  private canvas: Phaser.Textures.CanvasTexture;
  private drawn = '';
  private view: 'back' | 'front' | 'side' = 'back';
  /** Which way he faces when not running sideways: the hero (near half) from behind, a far-side opponent from the front. */
  private base: 'back' | 'front';
  private flip = false;
  private lift = 0;
  private body: BodyState = newBody(0.4);
  private look: BodyPose = { rotation: 0, scaleX: 1, scaleY: 1, bob: 0, braked: false };
  private lastFeet: { x: number; y: number } | null = null;
  private stride = 0;
  private busyUntil = 0;
  private move: Phaser.Tweens.Tween | null = null;
  /** Screen x of the ball (the head follows it while he waits), or null. */
  watch: number | null = null;

  constructor(private scene: Phaser.Scene, private appearance: Appearance, x: number, z: number, opts: { key?: string; front?: boolean } = {}) {
    this.x = x;
    this.z = z;
    this.base = opts.front ? 'front' : 'back';
    this.view = this.base;
    const key = opts.key ?? 'rig:camphero';
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.canvas = scene.textures.createCanvas(key, Math.round(VIEW.w * UNIT), Math.round(VIEW.h * UNIT))!;
    this.sprite = scene.add.image(0, 0, key).setFlipX(this.base === 'front');
    this.redraw(true);
    this.place();
  }

  /** Sets him down somewhere at once. */
  teleport(x: number, z: number): void {
    x = clampX(x);
    z = clampZ(z);
    this.move?.stop();
    this.move = null;
    this.x = x;
    this.z = z;
    this.lastFeet = null;
    this.setView(this.base, false);
    this.rig.to(this.scene.time.now, POSES.ready, 120);
    this.place();
  }

  /** Runs (or side-steps, for a short move across) to (x, z) in `ms`, then waits in the ready pose. */
  runTo(x: number, z: number, ms: number, done?: () => void): void {
    x = clampX(x);
    z = clampZ(z);
    this.move?.stop();
    const sx = this.x;
    const sz = this.z;
    const dx = x - sx;
    const dz = z - sz;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.2) {
      this.x = x;
      this.z = z;
      done?.();
      return;
    }
    const shuffle = Math.abs(dx) >= Math.abs(dz) && dist < 2.2;
    const profile = !shuffle && Math.abs(dx) >= Math.abs(dz) * 1.1;
    this.setView(profile ? 'side' : this.base, profile && dx < 0);
    kickBody(this.body, -0.9);
    const start = this.stride;
    this.move = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.max(120, ms),
      ease: (t: number) => runEase(t),
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        this.x = sx + dx * t;
        this.z = sz + dz * t;
        const walked = start + dist * t;
        this.stride = walked;
        if (t < 0.97 && this.scene.time.now >= this.busyUntil) {
          if (shuffle) this.rig.drive(shuffleFrame((walked / SHUFFLE_CYCLE_M) * SHUFFLE_FRAMES, dx > 0 ? 1 : -1));
          else this.rig.drive(runFrame((walked / RUN_CYCLE_M) * RUN_FRAMES, profile));
        }
      },
      onComplete: () => {
        this.move = null;
        this.setView(this.base, false);
        this.rig.to(this.scene.time.now, POSES.ready, 160);
        done?.();
      },
    });
  }

  /** Glides into the ready pose. */
  ready(): void {
    if (this.scene.time.now < this.busyUntil) return;
    this.rig.to(this.scene.time.now, POSES.ready, 180);
  }

  /** The split step as the ball is struck (a small hop, landing wide). */
  split(): void {
    if (this.move) return;
    this.rig.play(this.scene.time.now, splitSteps());
    this.hop(5, 160);
  }

  /** Winds up a stroke (`height`: the ball's height at contact). */
  prep(name: PoseName, height?: number): void {
    this.setView(this.base, false);
    this.rig.to(this.scene.time.now, loadPose(name, height), name === 'smashPrep' ? 260 : 220, inOut);
  }

  /** A stroke from the moment of contact. */
  stroke(stance: 'fh' | 'bh' | 'ov' | 'fhv' | 'bhv', height?: number): void {
    this.setView(this.base, false);
    this.busyUntil = this.scene.time.now + 520;
    kickBody(this.body, 1);
    this.rig.play(this.scene.time.now, strokeSteps(stance, height));
  }

  /** The jumping smash from the moment of contact (`air` ms in the air, `jump` pixels per metre of scale). */
  smash(air = 340, jump = 0.55): void {
    this.setView(this.base, false);
    this.busyUntil = this.scene.time.now + air + 520;
    this.rig.play(this.scene.time.now, smashSteps(air));
    this.hop(project(this.x, this.z).scale * jump, air);
  }

  /** A late, stretching stroke at a ball he cannot quite reach (a lunge to the `dir` side of the screen). */
  dive(stance: 'fh' | 'bh', height: number, dir: number): void {
    this.setView(this.base, false);
    this.busyUntil = this.scene.time.now + 620;
    kickBody(this.body, -1.2);
    this.rig.play(this.scene.time.now, strokeSteps(stance, height, lungePose(POSES.ready, this.base === 'front' ? -dir : dir, 1)));
  }

  /** Any sequence of poses (a cheer, a shrug). */
  react(steps: Step[]): void {
    this.setView(this.base, false);
    this.busyUntil = this.scene.time.now + steps.reduce((a, s) => a + s[0], 0);
    this.rig.play(this.scene.time.now, steps);
  }

  /** A fist pump after a great shot. */
  cheer(): void {
    const fist = { ...POSES.ready, hand: [128, 96] as [number, number], racket: -40, crouch: -4 };
    this.react([
      [140, fist, easeOut],
      [260, fist, inOut],
      [260, POSES.ready, inOut],
    ]);
    this.hop(6, 220);
  }

  private hop(px: number, ms: number): void {
    kickBody(this.body, 1.4);
    this.scene.tweens.add({ targets: this, lift: px, duration: ms * 0.42, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this, lift: 0, delay: ms * 0.42, duration: ms * 0.58, ease: 'Quad.easeIn', onComplete: () => kickBody(this.body, -2) });
  }

  private setView(view: 'back' | 'front' | 'side', flip: boolean): void {
    if (view === this.view && flip === this.flip && this.drawn !== '') return;
    this.view = view;
    this.flip = flip;
    // the front view is drawn as seen from behind and mirrored (as in a match)
    this.sprite.setFlipX(view === 'front' ? !flip : flip);
    this.redraw(true);
  }

  /** Every frame: the body's spring and breathing, the rig, the picture when the pose changed. */
  update(time: number, dt: number): void {
    const p = project(this.x, this.z);
    const last = this.lastFeet ?? p;
    this.lastFeet = { x: p.x, y: p.y };
    const ppm = Math.max(1, p.scale);
    this.look = stepBody(this.body, (p.x - last.x) / ppm, (p.y - last.y) / ppm, dt / 1000, time / 1000, !this.move && time >= this.busyUntil);
    if (this.view === 'back' && this.watch !== null && !this.move && time >= this.busyUntil && !this.rig.playing(time)) {
      this.rig.setLook(Math.round(Math.max(-1, Math.min(1, (this.watch - p.x) / (p.scale * 3))) * 2) / 2);
    } else this.rig.setLook(null);
    this.rig.update(time, dt);
    this.redraw(false);
    this.place();
  }

  private place(): void {
    const p = project(this.x, this.z);
    placeToonSprite(this.sprite, p.x, p.y - this.lift - this.look.bob * p.scale, p.scale * HEIGHT_M);
    this.sprite.setScale(this.sprite.scaleX * this.look.scaleX, this.sprite.scaleY * this.look.scaleY).setRotation(this.look.rotation).setDepth(p.y);
  }

  private redraw(force: boolean): void {
    const pose = this.rig.pose;
    const sig = `${this.view}|${poseSignature(pose)}`;
    if (!force && sig === this.drawn) return;
    this.drawn = sig;
    const ctx = this.canvas.getContext();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(UNIT, 0, 0, UNIT, -VIEW.x * UNIT, -VIEW.y * UNIT);
    drawOps(ctx, buildToon(this.appearance, this.view, pose, false));
    this.canvas.refresh();
  }

  /**
   * Where he stands to meet a ball at `ball` (court metres): with his forehand if there is room for it between the ball and the glass,
   * with the backhand otherwise.
   */
  stanceFor(ball: { x: number; z: number }): { x: number; z: number; fh: boolean } {
    const front = this.base === 'front';
    // his forehand side on the screen: right for the hero (seen from behind), left for an opponent (seen from the front)
    const fhX = front ? ball.x + 0.5 : ball.x - 0.5;
    const bhX = front ? ball.x - 0.55 : ball.x + 0.55;
    const z = front ? ball.z - 0.35 : ball.z + 0.35;
    const fh = Math.abs(fhX - clampX(fhX)) < 1e-6 || Math.abs(bhX - clampX(bhX)) > 1e-6;
    return { x: clampX(fh ? fhX : bhX), z: clampZ(z), fh };
  }

  /** Where the racket meets a ball for a stroke (court metres): a little to his right and in front. */
  contact(h = 1): { x: number; z: number; h: number } {
    return this.base === 'front' ? { x: this.x - 0.5, z: this.z + 0.35, h } : { x: this.x + 0.5, z: this.z - 0.35, h };
  }
}
