import Phaser from 'phaser';
import { inOut, poseSignature, Rig, type Step } from '../art/rig';
import { buildToon, POSES, runFrame, RUN_FRAMES } from '../art/toon/character';
import type { PoseSpec } from '../art/toon/character';
import { drawOps, VIEW } from '../art/toon/ops';
import type { Appearance } from '../game/types';

/** Figure units per pixel of the actor's own picture (sharp at the cutscene's size). */
const UNIT = 0.9;
let serial = 0;

/**
 * A player on the cutscene stage: the match's rig and drawing (glides between poses, sequences like the fist pump), placed in screen
 * pixels (feet at x, y; `height` px tall), seen from the front or from behind, or in profile while walking.
 */
export class StageActor {
  readonly sprite: Phaser.GameObjects.Image;
  private rig = new Rig();
  private canvas: Phaser.Textures.CanvasTexture;
  private drawn = '';
  private view: 'front' | 'back' | 'side';
  private walking: Phaser.Tweens.Tween | null = null;
  private lift = 0;
  private key: string;

  constructor(
    private scene: Phaser.Scene,
    private appearance: Appearance,
    public x: number,
    public y: number,
    private height: number,
    private base: 'front' | 'back' = 'front',
    depth = 10,
  ) {
    this.view = base;
    this.key = `stage:${serial++}`;
    this.canvas = scene.textures.createCanvas(this.key, Math.round(VIEW.w * UNIT), Math.round(VIEW.h * UNIT))!;
    this.sprite = scene.add.image(x, y, this.key).setDepth(depth);
    this.rig.to(scene.time.now, POSES.ready, 1);
    this.redraw(true);
    this.place();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Glides into a pose. */
  to(p: PoseSpec, ms = 220): this {
    this.rig.to(this.scene.time.now, p, ms, inOut);
    return this;
  }

  /** Plays a sequence (fist pump, high five, ...). */
  play(steps: Step[]): this {
    this.rig.play(this.scene.time.now, steps);
    return this;
  }

  /** Walks to `toX` (and `toY`) in `ms`, in profile, then turns back to the front (or back). */
  walkTo(toX: number, ms: number, toY = this.y, done?: () => void): this {
    this.walking?.stop();
    const sx = this.x;
    const sy = this.y;
    this.setView('side', toX < sx);
    this.walking = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        this.x = sx + (toX - sx) * t;
        this.y = sy + (toY - sy) * t;
        this.rig.drive(runFrame(((Math.abs(toX - sx) * t) / (this.height * 0.55)) * RUN_FRAMES, true));
      },
      onComplete: () => {
        this.walking = null;
        this.setView(this.base, false);
        this.rig.to(this.scene.time.now, POSES.ready, 160);
        done?.();
      },
    });
    return this;
  }

  /** A jump of `px` pixels. */
  hop(px: number, ms = 360, delay = 0): this {
    this.scene.tweens.add({ targets: this, lift: px, delay, duration: ms * 0.45, ease: 'Quad.easeOut', yoyo: true, hold: 20 });
    return this;
  }

  /** The point a hand is at in screen pixels (figure units of the pose: x 0..200, y down from the head, ground 304). */
  screenOf(pt: [number, number]): { x: number; y: number } {
    const s = this.height / 300;
    const flip = this.sprite.flipX ? -1 : 1;
    return { x: this.x + flip * (pt[0] - 100) * s, y: this.y - this.lift - (304 - pt[1]) * s };
  }

  private setView(view: 'front' | 'back' | 'side', flip: boolean): void {
    this.view = view;
    // the front view is drawn as seen from behind and mirrored (as in a match)
    this.sprite.setFlipX(view === 'front' ? !flip : flip);
    this.redraw(true);
  }

  update(time: number, dt: number): void {
    this.rig.update(time, dt);
    this.redraw(false);
    this.place();
  }

  private place(): void {
    // the picture's feet (VIEW origin) at (x, y); `height` covers the figure (about 300 figure units)
    const s = this.height / 300 / UNIT;
    const fx = (0 - VIEW.x) * UNIT;
    const fy = (304 - VIEW.y) * UNIT;
    this.sprite.setOrigin((fx + 100 * UNIT) / this.canvas.width, fy / this.canvas.height);
    this.sprite.setScale(s).setPosition(this.x, this.y - this.lift);
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

  destroy(): void {
    this.walking?.stop();
    if (this.sprite.active) this.sprite.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}
