import Phaser from 'phaser';
import playersData from '../data/players.json';
import { HD_SCALE, HEIGHT, WIDTH } from '../config';
import { project, unproject } from '../art/camera';
import { ballPoint, buildFlight, flightDuration, type Flight } from '../art/ballPath';
import { themeIdOfCity } from '../art/hd/courtThemes';
import { ARENA_NET_KEY, BALL_KEY, ensureArenaTextures, ensureBallTextures, ensureFlatTextures, SHADOW_KEY } from '../art/hdTextures';
import { addToon } from '../art/toonTexture';
import {
  campGame, glassAnswer, glassPoints, glassRound, landShot, serveLanding, serveZone, targetZone, timingPoints, timingRound, zonePoints,
  type CampGameId, type GlassRound, type TimingRound, type Zone,
} from '../career/camp';
import { heroFrom, heroLook } from '../career/profile';
import { SHOTS } from '../game/catalog';
import { NET_Z } from '../game/court';
import type { PlayerDef, ShotDef } from '../game/types';
import { getSave } from '../save';
import { applyHd } from '../hd';
import { sfx } from '../audio';
import { DISPLAY, makeThemeButton, TC, themeText } from '../theme';

const NAVY_CSS = '#0b2a5b';

const shot = (id: string): ShotDef => SHOTS.find((s) => s.id === id)!;
const TARGET_SHOTS = ['bounce_shot', 'rally_lob', 'dejada'];
const SERVE_SHOT = 't_serve';
const GLASS_SHOTS = ['bounce_shot', 'volley', 'bajada_fast', 'vibora'];
/** Seconds of ball flight per screen of the parabola animation (the camp is quicker than a match). */
const FLIGHT_MS_PER_M = 55;

type Landing = { x: number; depth: number; miss?: string };

/**
 * The four camp minigames on the match's court (same camera and art): target practice and serve zones (choose the spot, the ball
 * lands with the hero's real spread), read the glass (tap where a ball will be played after the back glass), timing (tap as the ring
 * closes). Scores come from camp.ts; the result screen pays the reward.
 */
export class MinigameScene extends Phaser.Scene {
  private gameId: CampGameId = 'targets';
  private round = 0;
  private score = 0;
  private hero!: PlayerDef;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private hud!: Phaser.GameObjects.Text;
  private ball!: Phaser.GameObjects.Image;
  private ballShadow!: Phaser.GameObjects.Image;
  private heroSprite!: Phaser.GameObjects.Image;
  private shotId = TARGET_SHOTS[0];
  private busy = false;

  constructor() {
    super('MinigameScene');
  }

  init(data: { game: CampGameId }): void {
    this.gameId = data.game;
    this.round = 0;
    this.score = 0;
    this.busy = false;
    this.layer = [];
    this.shotId = TARGET_SHOTS[0];
  }

  create(): void {
    applyHd(this);
    const p = getSave().profile;
    this.hero = heroFrom((playersData.you as unknown as PlayerDef[])[0], p);
    const { netY, backKey } = ensureArenaTextures(this, themeIdOfCity(null));
    this.add.image(0, 0, backKey).setOrigin(0, 0).setDisplaySize(WIDTH, HEIGHT).setDepth(-10);
    const net = this.add.image(0, netY, ARENA_NET_KEY).setOrigin(0, 0).setDepth(project(0, NET_Z).y);
    net.setDisplaySize(WIDTH, net.height / HD_SCALE);
    ensureBallTextures(this);
    ensureFlatTextures(this);
    // bottom panel and HUD
    const panel = this.add.graphics().setDepth(9000);
    panel.fillStyle(TC.navy, 1).fillRoundedRect(0, 392, WIDTH, HEIGHT - 392, 16);
    this.hud = themeText(this, WIDTH / 2, 18, '', { size: 14, color: TC.white, font: 'display' }).setDepth(9500).setStroke(NAVY_CSS, 5);
    const quit = makeThemeButton(this, 44, 618, 72, 30, 'QUIT', () => this.finish(), 'secondary', 12);
    for (const o of quit.parts) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(9300);
    const pos = this.heroSpot();
    const pp = project(pos.x, pos.z);
    this.heroSprite = addToon(this, pp.x, pp.y, pp.scale * 1.75, heroLook(p), 'back').setDepth(pp.y);
    this.ballShadow = this.add.image(0, 0, SHADOW_KEY).setAlpha(0.35).setVisible(false).setDepth(5);
    this.ball = this.add.image(0, 0, BALL_KEY).setVisible(false).setDepth(9100);
    this.nextRound();
  }

  private get total(): number {
    return campGame(this.gameId).rounds;
  }

  private heroSpot(): { x: number; z: number } {
    if (this.gameId === 'serve') return { x: this.lane() * 2.4, z: 19.6 };
    return { x: 0.6, z: 17.2 };
  }

  /** The serve alternates lanes round by round (left first). */
  private lane(): -1 | 1 {
    return this.round % 2 === 0 ? -1 : 1;
  }

  private clearLayer(): void {
    for (const o of this.layer) o.destroy();
    this.layer = [];
  }

  private updateHud(): void {
    this.hud.setText(`${campGame(this.gameId).name.toUpperCase()}   ROUND ${Math.min(this.round + 1, this.total)}/${this.total}   SCORE ${this.score}`);
  }

  private nextRound(): void {
    this.clearLayer();
    this.busy = false;
    if (this.round >= this.total) {
      this.time.delayedCall(400, () => this.finish());
      return;
    }
    this.updateHud();
    if (this.gameId === 'serve') {
      const pos = this.heroSpot();
      const pp = project(pos.x, pos.z);
      this.heroSprite.setPosition(pp.x, pp.y);
    }
    if (this.gameId === 'targets') this.zoneRound(targetZone(Math.random, this.round), false);
    else if (this.gameId === 'serve') this.zoneRound(serveZone(Math.random, this.round, this.lane()), true);
    else if (this.gameId === 'glass') this.glassRound(glassRound(Math.random, GLASS_SHOTS.map(shot)));
    else this.timingRound(timingRound(this.hero, this.round));
  }

  private finish(): void {
    this.scene.start('CampResultScene', { game: this.gameId, score: this.score });
  }

  private hint(text: string): void {
    this.layer.push(themeText(this, WIDTH / 2, 420, text, { size: 13, color: TC.white, font: 'display', align: 'center' }).setDepth(9100));
  }

  private popup(x: number, y: number, text: string, good: boolean): void {
    const t = this.add
      .text(x, y, text, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '22px', color: good ? '#ffe066' : '#ff9a6a' })
      .setOrigin(0.5)
      .setStroke(NAVY_CSS, 6)
      .setDepth(9400);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, delay: 500, duration: 500, onComplete: () => t.destroy() });
  }

  /** A zone (an ellipse on the floor) drawn in court metres. */
  private drawZone(z: Zone, color: number): void {
    const g = this.add.graphics().setDepth(4);
    const zz = NET_Z - z.depth;
    const c = project(z.x, zz);
    const a = project(z.x - z.r, zz);
    const b = project(z.x + z.r, zz);
    const n = project(z.x, zz + z.r);
    const f = project(z.x, zz - z.r);
    g.fillStyle(color, 0.35).fillEllipse(c.x, (n.y + f.y) / 2, b.x - a.x, n.y - f.y);
    g.lineStyle(3, 0xffffff, 0.95).strokeEllipse(c.x, (n.y + f.y) / 2, b.x - a.x, n.y - f.y);
    g.fillStyle(0xffffff, 1).fillCircle(c.x, c.y, 3);
    this.layer.push(g);
  }

  /** Animates a ball along a parabola from `from` to `to` (court metres, heights), then calls `done`. */
  private flyArc(from: { x: number; z: number; h: number }, to: { x: number; z: number; h: number }, apex: number, done: () => void): void {
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    const ms = Math.max(420, dist * FLIGHT_MS_PER_M);
    this.ball.setVisible(true);
    this.ballShadow.setVisible(true);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (tw) => {
        const u = tw.getValue() ?? 0;
        const x = from.x + (to.x - from.x) * u;
        const z = from.z + (to.z - from.z) * u;
        const h = from.h + (to.h - from.h) * u + 4 * apex * u * (1 - u);
        this.placeBall(x, z, h);
      },
      onComplete: done,
    });
  }

  private placeBall(x: number, z: number, h: number): void {
    const p = project(x, z, h);
    const g = project(x, z);
    this.ball.setPosition(p.x, p.y).setDisplaySize(Math.max(6, p.scale * 0.32), Math.max(6, p.scale * 0.32));
    this.ballShadow.setPosition(g.x, g.y).setDisplaySize(Math.max(5, g.scale * 0.35), Math.max(2, g.scale * 0.12));
  }

  // ---------- target practice and serve zones ----------
  private zoneRound(zone: Zone, serve: boolean): void {
    this.drawZone(zone, 0x4ade80);
    if (serve) {
      // the service box the serve must land in
      const g = this.add.graphics().setDepth(3);
      const s = -this.lane();
      const pts = [project(0, NET_Z), project(s * 5, NET_Z), project(s * 5, NET_Z - 6.95), project(0, NET_Z - 6.95)];
      g.lineStyle(2, 0xffe066, 0.9).strokePoints(pts as unknown as Phaser.Geom.Point[], true);
      this.layer.push(g);
      this.hint('TOUCH THE ZONE TO SERVE\n(outside the service box is a fault)');
    } else {
      this.hint('PICK A SHOT, THEN TOUCH THE ZONE');
      TARGET_SHOTS.forEach((id, i) => {
        const b = makeThemeButton(this, 64 + i * 116, 480, 108, 40, shot(id).name.toUpperCase(), () => {
          this.shotId = id;
          this.clearLayer();
          this.zoneRound(zone, serve);
        }, this.shotId === id ? 'primary' : 'secondary', 11);
        for (const o of b.parts) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(9300);
        this.layer.push(...(b.parts as Phaser.GameObjects.GameObject[]));
      });
    }
    const far = project(0, 0.2).y;
    const netY = project(0, NET_Z - 0.3).y;
    const marker = this.add.graphics().setDepth(9050);
    this.layer.push(marker);
    const aimAt = (wx: number, wy: number): { x: number; depth: number } => {
      const c = unproject(wx, Math.max(far, Math.min(netY, wy)));
      return { x: Math.max(-4.8, Math.min(4.8, c.x)), depth: Math.max(0.6, Math.min(9.6, NET_Z - c.z)) };
    };
    const show = (a: { x: number; depth: number }): void => {
      const p = project(a.x, NET_Z - a.depth);
      marker.clear().lineStyle(3, 0xffffff, 1).strokeCircle(p.x, p.y, Math.max(5, p.scale * 0.22));
    };
    let aim: { x: number; depth: number } | null = null;
    const zoneObj = this.add.zone(0, far - 24, WIDTH, netY - far + 40).setOrigin(0, 0).setDepth(9020).setInteractive();
    this.layer.push(zoneObj);
    zoneObj.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.busy) return;
      aim = aimAt(ptr.worldX, ptr.worldY);
      show(aim);
    });
    zoneObj.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || !aim || this.busy) return;
      aim = aimAt(ptr.worldX, ptr.worldY);
      show(aim);
    });
    zoneObj.on('pointerup', () => {
      if (!aim || this.busy) return;
      this.busy = true;
      zoneObj.disableInteractive();
      const s = shot(serve ? SERVE_SHOT : this.shotId);
      const landing: Landing = landShot(this.hero, s, aim, Math.random);
      const counted = serve ? serveLanding(this.lane(), landing) : landing;
      const pts = zonePoints(zone, counted);
      this.shootTo(landing, s, () => {
        this.score += pts;
        const end = project(landing.x, NET_Z - Math.min(landing.depth, 9.8));
        this.popup(end.x, end.y - 20, pts > 0 ? `+${pts}` : serve && !counted && !landing.miss ? 'FAULT' : landing.miss ? 'OUT' : 'MISS', pts > 0);
        sfx(pts > 0 ? 'point' : 'select');
        this.round++;
        this.time.delayedCall(850, () => this.nextRound());
      });
      aim = null;
    });
  }

  /** The hero's ball to its landing point (a miss goes into the glass, the side wall or the net). */
  private shootTo(l: Landing, s: ShotDef, done: () => void): void {
    sfx('hit');
    this.tweens.add({ targets: this.heroSprite, scaleY: this.heroSprite.scaleY * 0.94, yoyo: true, duration: 90 });
    const from = { ...this.heroSpot(), h: s.kind === 'serve' ? 0.8 : 1 };
    let to = { x: l.x, z: NET_Z - l.depth, h: 0 };
    if (l.miss === 'glass') to = { x: l.x, z: 0, h: 1.4 };
    else if (l.miss === 'side') to = { x: Math.sign(l.x) * 5, z: NET_Z - l.depth, h: 1.2 };
    else if (l.miss === 'net') to = { x: l.x, z: NET_Z, h: 0.5 };
    this.flyArc(from, to, Math.max(1.2, s.flight.apex), done);
  }

  // ---------- read the glass ----------
  private glassRound(r: GlassRound): void {
    const answer = glassAnswer(r);
    const flight: Flight = buildFlight({ from: r.from, hitterSide: 1, shot: r.shot, landX: r.landX, outcome: 'continue', glass: true, arrival: r.arrival, startH: 1 });
    const total = flightDuration(flight) * 0.9;
    const glassT = flight.events.find((e) => e.kind === 'glass')?.t ?? flight.duration * 0.6;
    const stopAt = Math.min(1, glassT / Math.max(1e-6, flight.duration));
    this.hint(`${r.shot.name.toUpperCase()} INTO YOUR BACK GLASS\nWATCH, THEN TOUCH WHERE YOU WILL PLAY IT`);
    sfx('hit');
    this.ball.setVisible(true);
    this.ballShadow.setVisible(true);
    this.tweens.addCounter({
      from: 0,
      to: stopAt,
      duration: total * stopAt,
      onUpdate: (tw) => {
        const p = ballPoint(flight.path, tw.getValue() ?? 0);
        this.placeBall(p.x, p.z, p.h);
      },
      onComplete: () => this.askGlass(flight, stopAt, total, answer),
    });
  }

  private askGlass(flight: Flight, stopAt: number, total: number, answer: { x: number; z: number }): void {
    const top = project(0, NET_Z + 0.5).y;
    const bottom = project(0, 19.8).y;
    const marker = this.add.graphics().setDepth(9050);
    this.layer.push(marker);
    const zoneObj = this.add.zone(0, top - 10, WIDTH, Math.min(392, bottom + 20) - top + 10).setOrigin(0, 0).setDepth(9020).setInteractive();
    this.layer.push(zoneObj);
    const guessAt = (wx: number, wy: number): { x: number; z: number } => {
      const c = unproject(wx, Math.max(top, Math.min(bottom, wy)));
      return { x: Math.max(-4.8, Math.min(4.8, c.x)), z: Math.max(NET_Z + 0.5, Math.min(19.8, c.z)) };
    };
    zoneObj.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (this.busy) return;
      this.busy = true;
      zoneObj.disableInteractive();
      const guess = guessAt(ptr.worldX, ptr.worldY);
      const gp = project(guess.x, guess.z);
      marker.lineStyle(3, 0xffffff, 1).strokeCircle(gp.x, gp.y, Math.max(5, gp.scale * 0.22));
      this.tweens.addCounter({
        from: stopAt,
        to: 1,
        duration: total * (1 - stopAt),
        onUpdate: (tw) => {
          const p = ballPoint(flight.path, tw.getValue() ?? 0);
          this.placeBall(p.x, p.z, p.h);
        },
        onComplete: () => {
          const pts = glassPoints(guess, answer);
          const ap = project(answer.x, answer.z);
          marker.fillStyle(0x4ade80, 0.9).fillCircle(ap.x, ap.y, Math.max(4, ap.scale * 0.15));
          marker.lineStyle(2, 0xffe066, 0.9).lineBetween(gp.x, gp.y, ap.x, ap.y);
          this.score += pts;
          this.popup(ap.x, ap.y - 24, pts > 0 ? `+${pts}` : 'MISS', pts > 0);
          sfx(pts > 0 ? 'point' : 'select');
          this.round++;
          this.time.delayedCall(1200, () => this.nextRound());
        },
      });
    });
  }

  // ---------- timing ----------
  private timingRound(r: TimingRound): void {
    this.hint('TOUCH WHEN THE RING CLOSES ON THE BALL');
    const from = { x: -1 + Math.random() * 2, z: 3, h: 1.6 };
    const to = { x: this.heroSpot().x + 0.5, z: this.heroSpot().z - 0.4, h: 1 };
    const ring = this.add.graphics().setDepth(9200);
    this.layer.push(ring);
    const t0 = this.time.now;
    let done = false;
    this.ball.setVisible(true);
    this.ballShadow.setVisible(true);
    const end = (tapMs: number | null): void => {
      if (done) return;
      done = true;
      const res = timingPoints(r, tapMs);
      this.score += res.points;
      const p = project(to.x, to.z, to.h);
      this.popup(p.x, p.y - 40, res.grade === 'perfect' ? 'PERFECT +100' : res.grade === 'good' ? 'GOOD +60' : 'MISS', res.points > 0);
      sfx(res.points > 0 ? 'hit' : 'select');
      if (res.points > 0) this.flyArc({ ...to }, { x: -1.5 + Math.random() * 3, z: 4, h: 0 }, 1.6, () => undefined);
      this.round++;
      this.time.delayedCall(900, () => this.nextRound());
    };
    const tick = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const ms = this.time.now - t0;
        const u = Math.min(1.25, ms / r.closeMs);
        const x = from.x + (to.x - from.x) * u;
        const z = from.z + (to.z - from.z) * u;
        const h = from.h + (to.h - from.h) * u + 2.2 * Math.min(1, u) * (1 - Math.min(1, u));
        if (!done) this.placeBall(x, z, h);
        const p = project(x, z, h);
        const rad = Math.max(6, 70 * (1 - Math.min(1, u)) + 8);
        ring.clear();
        if (!done) ring.lineStyle(3, u >= 1 - r.window / r.closeMs / 3 && u <= 1 + r.window / r.closeMs / 3 ? 0x4ade80 : 0xffffff, 0.95).strokeCircle(p.x, p.y, rad);
        if (ms > r.closeMs + r.window + 250) {
          tick.remove();
          end(null);
        }
      },
    });
    const tap = this.add.zone(0, 0, WIDTH, 392).setOrigin(0, 0).setDepth(9020).setInteractive();
    this.layer.push(tap);
    tap.on('pointerdown', () => {
      if (done) return;
      tick.remove();
      ring.clear();
      end(this.time.now - t0);
    });
    this.layer.push({ destroy: () => tick.remove() } as unknown as Phaser.GameObjects.GameObject);
  }
}
