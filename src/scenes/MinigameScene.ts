import Phaser from 'phaser';
import playersData from '../data/players.json';
import { HD_SCALE, HEIGHT, WIDTH } from '../config';
import { project, unproject } from '../art/camera';
import { ballPoint, buildFlight, flightDuration, type Flight } from '../art/ballPath';
import { themeIdOfCity } from '../art/hd/courtThemes';
import { ARENA_NET_KEY, BALL_KEY, ensureArenaTextures, ensureBallTextures, ensureFlatTextures, SHADOW_KEY } from '../art/hdTextures';
import {
  campGame, isServeRound, landShot, openSpotOf, receiverX, RETURN_SHOTS, returnResult, returnRound, returnWindow, serveOutcome, serveSpotAt, SERVE_SPOTS, SMASH_SHOT, tossQuality, tossWindow, smashResult, smashRound, targetZone, timingPoints, timingRound, zoneAt, zonePoints,
  type CampGameId, type ReturnRound, type ReturnShot, type ServeSpot, type SmashKind, type SmashRound, type TimingRound, type Zone,
} from '../career/camp';
import { CampHero } from './campHero';
import { makeAppearance } from '../career/tournament';
import { inOut } from '../art/rig';
import { POSES } from '../art/toon/character';
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
const TARGET_SHOT = 'bounce_shot';
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
  private heroView!: CampHero;
  /** The opponent of Serve & Return (far half, seen from the front). */
  private rival: CampHero | null = null;
  private busy = false;
  /** Scene time when the ball of a timing or smash round is due (for automated checks). */
  hitDueAt = 0;

  constructor() {
    super('MinigameScene');
  }

  init(data: { game: CampGameId }): void {
    this.gameId = data.game;
    this.round = 0;
    this.score = 0;
    this.busy = false;
    this.layer = [];
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
    void pp;
    this.heroView = new CampHero(this, heroLook(p), pos.x, pos.z);
    if (this.gameId === 'serve') this.rival = new CampHero(this, makeAppearance(Math.random, Math.random() < 0.5), 2.6, 2.2, { key: 'rig:camprival', front: true });
    this.ballShadow = this.add.image(0, 0, SHADOW_KEY).setAlpha(0.35).setVisible(false).setDepth(5);
    this.ball = this.add.image(0, 0, BALL_KEY).setVisible(false).setDepth(9100);
    this.updateHud();
    this.countdown(() => this.nextRound());
  }

  /** 3, 2, 1, GO! before the first round, so the player is ready. */
  private countdown(done: () => void): void {
    this.busy = true;
    const help = themeText(this, WIDTH / 2, 440, campGame(this.gameId).desc, { size: 13, color: TC.white, font: 'display', align: 'center', wrap: WIDTH - 48 }).setDepth(9100);
    const steps = ['3', '2', '1', 'GO!'];
    steps.forEach((label, i) => {
      this.time.delayedCall(i * 700, () => {
        const go = i === steps.length - 1;
        const t = this.add
          .text(WIDTH / 2, 200, label, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: go ? '64px' : '80px', color: go ? '#4ade80' : '#ffe066' })
          .setOrigin(0.5)
          .setStroke(NAVY_CSS, 10)
          .setDepth(9700)
          .setScale(1.8)
          .setAlpha(0);
        this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
        this.tweens.add({ targets: t, scale: 0.7, alpha: 0, delay: go ? 480 : 520, duration: 160, onComplete: () => t.destroy() });
        sfx(go ? 'point' : 'select');
      });
    });
    this.time.delayedCall(steps.length * 700 - 120, () => {
      help.destroy();
      this.busy = false;
      done();
    });
  }

  update(time: number, delta: number): void {
    this.heroView.watch = this.ball.visible ? this.ball.x : null;
    this.heroView.update(time, delta);
    if (this.rival) {
      this.rival.watch = this.heroView.watch;
      this.rival.update(time, delta);
    }
  }

  private get total(): number {
    return campGame(this.gameId).rounds;
  }

  private heroSpot(): { x: number; z: number } {
    if (this.gameId === 'serve') return isServeRound(this.round) ? { x: this.lane() * 2.4, z: 19.6 } : { x: this.lane() * 2.7, z: 18.4 };
    if (this.gameId === 'smash') return { x: 0.3, z: 12.6 };
    return { x: 0.6, z: 17.2 };
  }

  /** Serve & Return changes sides every two rounds (a serve and a return on each side; left first). */
  private lane(): -1 | 1 {
    return Math.floor(this.round / 2) % 2 === 0 ? -1 : 1;
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
    this.ball.setVisible(false).setRotation(0);
    this.ballShadow.setVisible(false);
    if (this.round >= this.total) {
      this.time.delayedCall(400, () => this.finish());
      return;
    }
    this.updateHud();
    if (this.gameId === 'targets' || this.gameId === 'smash' || (this.gameId === 'serve' && isServeRound(this.round))) {
      const pos = this.heroSpot();
      this.heroView.runTo(pos.x, pos.z, 520);
    }
    if (this.gameId === 'targets') this.zoneRound(targetZone(Math.random, this.round));
    else if (this.gameId === 'serve') {
      if (isServeRound(this.round)) this.serveRound(openSpotOf(Math.random));
      else this.returnRound(returnRound(this.round, Math.random));
    }
    else if (this.gameId === 'smash') this.smashRound(smashRound(this.round, Math.random));
    else this.timingRound(timingRound(this.hero, this.round, Math.random));
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

  /** Animates a ball along a parabola from `from` to `to` (court metres, heights), then calls `done`. */
  private flyArc(from: { x: number; z: number; h: number }, to: { x: number; z: number; h: number }, apex: number, done: () => void, msPerM = FLIGHT_MS_PER_M): void {
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    const ms = Math.max(msPerM < FLIGHT_MS_PER_M ? 200 : 420, dist * msPerM);
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
  private zoneRound(zone: Zone): void {
    const t0 = this.time.now;
    const zoneG = this.add.graphics().setDepth(4);
    this.layer.push(zoneG);
    const paintZone = (z: Zone): void => {
      zoneG.clear();
      const zz = NET_Z - z.depth;
      const c = project(z.x, zz);
      const a = project(z.x - z.r, zz);
      const b = project(z.x + z.r, zz);
      const n = project(z.x, zz + z.r);
      const f = project(z.x, zz - z.r);
      zoneG.fillStyle(0x4ade80, 0.35).fillEllipse(c.x, (n.y + f.y) / 2, b.x - a.x, n.y - f.y);
      zoneG.lineStyle(3, 0xffffff, 0.95).strokeEllipse(c.x, (n.y + f.y) / 2, b.x - a.x, n.y - f.y);
      zoneG.fillStyle(0xffffff, 1).fillCircle(c.x, c.y, 3);
    };
    paintZone(zone);
    if (zone.move) {
      const ev = this.time.addEvent({ delay: 16, loop: true, callback: () => paintZone(zoneAt(zone, (this.time.now - t0) / 1000)) });
      this.layer.push({ destroy: () => ev.remove() } as unknown as Phaser.GameObjects.GameObject);
    }
    this.hint('THE ZONE MOVES: TOUCH TO AIM,\nLET GO TO HIT (IT KEEPS MOVING!)');
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
      this.heroView.prep('fhPrep', 0.9);
    });
    zoneObj.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || !aim || this.busy) return;
      aim = aimAt(ptr.worldX, ptr.worldY);
      show(aim);
    });
    const fire = (): void => {
      if (!aim || this.busy) return;
      this.busy = true;
      zoneObj.disableInteractive();
      const s = shot(TARGET_SHOT);
      const landing: Landing = landShot(this.hero, s, aim, Math.random);
      this.heroView.stroke('fh', 0.9);
      this.shootTo(landing, s, () => {
        // a moving zone is judged where it is when the ball comes down
        const at = zoneAt(zone, (this.time.now - t0) / 1000);
        const pts = zonePoints(at, landing);
        this.score += pts;
        this.updateHud();
        const end = project(landing.x, NET_Z - Math.min(landing.depth, 9.8));
        this.popup(end.x, end.y - 20, pts > 0 ? `+${pts}` : landing.miss ? 'OUT' : 'MISS', pts > 0);
        sfx(pts > 0 ? 'point' : 'select');
        if (pts >= 80) this.heroView.cheer();
        this.round++;
        this.time.delayedCall(850, () => this.nextRound());
      });
      aim = null;
    };
    zoneObj.on('pointerup', () => fire());
  }

  /** The hero's ball to its landing point (a miss goes into the glass, the side wall or the net). */
  private shootTo(l: Landing, s: ShotDef, done: () => void): void {
    sfx('hit');
    const from = this.heroView.contact(s.kind === 'serve' ? 0.8 : 1);
    let to = { x: l.x, z: NET_Z - l.depth, h: 0 };
    if (l.miss === 'glass') to = { x: l.x, z: 0, h: 1.4 };
    else if (l.miss === 'side') to = { x: Math.sign(l.x) * 5, z: NET_Z - l.depth, h: 1.2 };
    else if (l.miss === 'net') to = { x: l.x, z: NET_Z, h: 0.5 };
    this.flyArc(from, to, Math.max(1.2, s.flight.apex), done);
  }

  // ---------- timing ----------
  private timingRound(r: TimingRound): void {
    this.hint(`${r.kind === 'lob' ? 'A LOB' : r.kind === 'spin' ? 'A CURLING BALL' : 'A FLAT, FAST BALL'}\nTOUCH WHEN THE RING CLOSES ON THE BALL`);
    // the hero moves to his new spot first, then the ball comes
    this.heroView.runTo(r.hero.x, r.hero.z, 560, () => this.time.delayedCall(180, () => this.timingBall(r)));
  }

  private timingBall(r: TimingRound): void {
    // a ball on his left side is a backhand
    const bh = r.from.x + r.curve < r.hero.x - 0.6;
    const to = bh ? { x: r.hero.x - 0.55, z: r.hero.z - 0.35, h: 1 } : this.heroView.contact(1);
    const ring = this.add.graphics().setDepth(9200);
    this.layer.push(ring);
    const t0 = this.time.now;
    let done = false;
    let prepped = false;
    this.ball.setVisible(true);
    this.ballShadow.setVisible(true);
    sfx('hit');
    this.time.delayedCall(Math.min(260, r.closeMs * 0.25), () => this.heroView.split());
    const end = (tapMs: number | null): void => {
      if (done) return;
      done = true;
      const res = timingPoints(r, tapMs);
      this.score += res.points;
      this.updateHud();
      const p = project(to.x, to.z, to.h);
      this.popup(p.x, p.y - 40, res.points > 0 ? `${res.grade.toUpperCase()} +${res.points}` : 'MISS', res.points > 0);
      sfx(res.points > 0 ? 'hit' : 'select');
      if (tapMs !== null) this.heroView.stroke(bh ? 'bh' : 'fh', 1);
      if (res.points > 0) {
        this.flyArc({ ...to }, { x: -1.5 + Math.random() * 3, z: 4, h: 0 }, 1.6, () => undefined);
        if (res.points >= 90) this.time.delayedCall(450, () => this.heroView.cheer());
      }
      this.round++;
      this.time.delayedCall(1100, () => this.nextRound());
    };
    const tick = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const ms = this.time.now - t0;
        if (!prepped && ms > r.closeMs - 420) {
          prepped = true;
          this.heroView.prep(bh ? 'bhPrep' : 'fhPrep', 1);
        }
        const u = Math.min(1.25, ms / r.closeMs);
        const uu = Math.min(1, u);
        const x = r.from.x + (to.x - r.from.x) * u + r.curve * Math.sin(Math.PI * uu);
        const z = r.from.z + (to.z - r.from.z) * u;
        const h = r.from.h + (to.h - r.from.h) * u + 4 * r.apex * uu * (1 - uu);
        if (!done) this.placeBall(x, z, h);
        const p = project(x, z, h);
        const rad = Math.max(6, 70 * (1 - uu) + 8);
        const inCore = Math.abs(ms - r.closeMs) <= r.window / 5;
        ring.clear();
        if (!done) ring.lineStyle(3, inCore ? 0x4ade80 : 0xffffff, 0.95).strokeCircle(p.x, p.y, rad);
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

  // ---------- smash show ----------
  /** The lob's landing spot is shown first; the player picks the smash, then the lob comes and he hits as the ring closes. */
  private smashRound(r: SmashRound): void {
    const lobName = r.lob === 'short' ? 'A SHORT LOB, NEAR THE NET' : r.lob === 'mid' ? 'A LOB TO MID-COURT' : 'A DEEP LOB';
    this.hint(`${lobName}\nPICK YOUR SMASH`);
    // where the hero will meet it: a pulsing ring on the floor
    const mark = this.add.graphics().setDepth(4);
    this.layer.push(mark);
    const fp = project(r.contact.x, r.contact.z);
    mark.lineStyle(3, 0xffe066, 0.95).strokeEllipse(fp.x, fp.y, fp.scale * 0.9, fp.scale * 0.3);
    this.tweens.add({ targets: mark, alpha: 0.35, yoyo: true, repeat: -1, duration: 420 });
    const opts: Array<[SmashKind, string, string]> = [
      ['x3', 'POR TRES', r.lob === 'deep' ? 'RISKY' : 'GOOD'],
      ['x4', 'POR CUATRO', r.lob === 'short' ? 'GOOD' : r.lob === 'mid' ? 'RISKY' : 'VERY HARD'],
      ['vibora', 'VIBORA', r.lob === 'short' ? 'OK' : 'SAFE'],
    ];
    const parts: Phaser.GameObjects.GameObject[] = [];
    opts.forEach(([kind, label, tag], i) => {
      const x = 64 + i * 116;
      const b = makeThemeButton(this, x, 486, 108, 44, label, () => {
        if (this.busy) return;
        this.busy = true;
        for (const o of parts) o.destroy();
        this.smashLob(r, kind);
      }, kind === 'x4' ? 'primary' : 'secondary', 13);
      for (const o of b.parts) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(9300);
      const t = themeText(this, x, 518, tag, { size: 11, color: tag === 'GOOD' || tag === 'SAFE' ? TC.white : TC.orange, font: 'display' }).setDepth(9300);
      parts.push(...(b.parts as Phaser.GameObjects.GameObject[]), t);
    });
    this.layer.push(...parts);
  }

  private smashLob(r: SmashRound, kind: SmashKind): void {
    const c = r.contact;
    const ring = this.add.graphics().setDepth(9200);
    this.layer.push(ring);
    const t0 = this.time.now;
    let done = false;
    let prepped = false;
    this.hitDueAt = t0 + r.closeMs;
    const apex = 6.5;
    this.ball.setVisible(true);
    this.ballShadow.setVisible(true);
    sfx('hit');
    // he runs under it (the ball a little in front of his racket shoulder), then loads the smash
    this.heroView.runTo(c.x - 0.45, c.z + 0.3, Math.min(900, r.closeMs * 0.45));
    const ballAt = (ms: number): { x: number; z: number; h: number } => {
      const u = ms / r.closeMs;
      return { x: r.from.x + (c.x - r.from.x) * u, z: r.from.z + (c.z - r.from.z) * u, h: 1 + (c.h - 1) * u + 4 * apex * u * (1 - u) * (u <= 1 ? 1 : 1) };
    };
    const end = (tapMs: number | null): void => {
      if (done) return;
      done = true;
      ring.clear();
      const res = smashResult(this.hero, r, kind, tapMs);
      const from = tapMs === null ? ballAt(Math.min(this.time.now - t0, r.closeMs * 1.15)) : ballAt(Math.max(0, Math.min(tapMs, r.closeMs * 1.15)));
      if (kind === 'vibora') this.heroView.stroke('ov');
      else this.heroView.smash(340);
      if (tapMs === null) {
        // no swing: it drops behind him
        this.flyArc(from, { x: c.x, z: Math.min(19.5, c.z + 2.5), h: 0 }, 0.4, () => this.smashDone(res.points, 'MISSED', false));
        return;
      }
      sfx('hit');
      if (res.outcome === 'out' || res.outcome === 'winner') this.cameras.main.shake(140, 0.006);
      const s = shot(SMASH_SHOT[kind]);
      const side = Math.random() < 0.5 ? -1 : 1;
      const flight = buildFlight({
        from: { x: from.x, z: from.z }, startH: Math.max(2, from.h), hitterSide: 0, shot: s,
        landX: kind === 'vibora' ? side * 3.5 : side * 1.5,
        outcome: res.outcome === 'net' ? 'error' : res.outcome === 'glass' ? 'continue' : 'winner',
        netReturn: kind === 'x4' && res.outcome === 'glass' ? true : undefined,
      });
      this.playFlight(flight, (e) => {
        if (e === 'out') this.bigCall(kind === 'x3' ? 'POR TRES!' : 'POR CUATRO!');
      }, () => {
        const label = res.outcome === 'out' ? `+${res.points}` : res.outcome === 'winner' ? `WINNER +${res.points}` : res.outcome === 'glass' ? `BACK IN PLAY +${res.points}` : 'NET';
        this.smashDone(res.points, label, res.outcome === 'out' || res.outcome === 'winner');
      });
    };
    const tick = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const ms = this.time.now - t0;
        if (!prepped && ms > r.closeMs - 520) {
          prepped = true;
          this.heroView.prep(kind === 'vibora' ? 'ovPrep' : 'smashPrep');
        }
        if (done) return;
        const b = ballAt(Math.min(ms, r.closeMs * 1.3));
        this.placeBall(b.x, b.z, b.h);
        const u = Math.min(1, ms / r.closeMs);
        const p = project(c.x, c.z, c.h);
        const rad = Math.max(6, 80 * (1 - u) + 8);
        const w = Math.abs(ms - r.closeMs);
        ring.clear().lineStyle(3, w < 60 ? 0x4ade80 : 0xffffff, 0.95).strokeCircle(p.x, p.y, rad);
        ring.fillStyle(0xffe066, 0.9).fillCircle(p.x, p.y, 3);
        if (ms > r.closeMs * 1.3) {
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
      end(this.time.now - t0);
    });
    this.layer.push({ destroy: () => tick.remove() } as unknown as Phaser.GameObjects.GameObject);
  }

  /** Plays a real ball flight at its own pace; `onEvent` hears every bounce, glass and exit. The ball fades when it leaves the court. */
  private playFlight(f: Flight, onEvent: (kind: string) => void, done: () => void): void {
    const ms = flightDuration(f);
    const seen = new Set<number>();
    this.ball.setVisible(true).setAlpha(1);
    this.ballShadow.setVisible(true);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (tw) => {
        const u = tw.getValue() ?? 0;
        const p = ballPoint(f.path, u);
        this.placeBall(p.x, p.z, p.h);
        const t = u * f.duration;
        f.events.forEach((e, i) => {
          if (e.t <= t && !seen.has(i)) {
            seen.add(i);
            onEvent(e.kind);
            if (e.kind === 'glass') sfx('select');
          }
        });
      },
      onComplete: () => {
        const out = f.events.some((e) => e.kind === 'out');
        if (out) {
          this.ballShadow.setVisible(false);
          this.tweens.add({ targets: this.ball, alpha: 0, scale: this.ball.scale * 0.5, y: this.ball.y - 30, duration: 300, onComplete: () => this.ball.setVisible(false).setAlpha(1) });
        }
        done();
      },
    });
  }

  /** A big call across the court for a ball sent out of it. */
  private bigCall(text: string): void {
    this.cameras.main.flash(160, 255, 240, 170);
    sfx('point');
    const t = this.add
      .text(WIDTH / 2, 170, text, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '38px', color: '#ffe066' })
      .setOrigin(0.5)
      .setStroke('#ff7a3d', 8)
      .setDepth(9600)
      .setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: 140, delay: 900, duration: 350, onComplete: () => t.destroy() });
  }

  private smashDone(points: number, label: string, great: boolean): void {
    this.score += points;
    this.updateHud();
    const p = project(this.heroView.x, this.heroView.z - 3);
    this.popup(p.x, p.y - 30, label, points > 0);
    if (!great) sfx(points > 0 ? 'point' : 'select');
    if (great) this.time.delayedCall(300, () => this.heroView.cheer());
    this.round++;
    this.time.delayedCall(great ? 1500 : 1100, () => this.nextRound());
  }

  // ---------- serve & return ----------
  /**
   * A ring that closes on the ball itself (it follows it): wide when there is time, the ball's size at the moment to hit; green inside
   * the best part of the timing window.
   */
  private ringOn(ring: Phaser.GameObjects.Graphics, ball: { x: number; z: number; h: number }, ms: number, due: number, sweet: number): void {
    const p = project(ball.x, ball.z, ball.h);
    const u = Math.min(1, ms / due);
    const r = Math.max(7, 64 * (1 - u) + 8);
    const green = Math.abs(ms - due) <= sweet;
    ring.clear().lineStyle(green ? 4 : 3, green ? 0x4ade80 : 0xffffff, 0.95).strokeCircle(p.x, p.y, r);
  }

  /** He stands off-centre: serve into the gap (or at the body), then hit the ball as it comes up off its bounce. */
  private serveRound(open: ServeSpot): void {
    const lane = this.lane();
    const rival = this.rival!;
    rival.runTo(receiverX(open, lane), 2.4, 500);
    this.hint('SERVE INTO THE GAP');
    let chosen: ServeSpot | null = null;
    const spotsG = this.add.graphics().setDepth(4);
    this.layer.push(spotsG);
    const paintSpots = (): void => {
      spotsG.clear();
      for (const sp of SERVE_SPOTS) {
        const a = serveSpotAt(sp, lane);
        const p = project(a.x, NET_Z - a.depth);
        const on = sp === chosen;
        spotsG.fillStyle(on ? 0x4ade80 : 0xffffff, on ? 0.6 : 0.25).fillEllipse(p.x, p.y, p.scale * 1.4, p.scale * 0.55);
        spotsG.lineStyle(on ? 3 : 2, on ? 0x4ade80 : 0xffffff, 0.95).strokeEllipse(p.x, p.y, p.scale * 1.4, p.scale * 0.55);
      }
    };
    paintSpots();
    for (const sp of SERVE_SPOTS) {
      const a = serveSpotAt(sp, lane);
      const p = project(a.x, NET_Z - a.depth);
      const zw = Math.max(48, p.scale * 1.7);
      const z = this.add.zone(p.x - zw / 2, p.y - 26, zw, 52).setOrigin(0, 0).setDepth(9020).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        if (this.busy) return;
        this.busy = true;
        chosen = sp;
        paintSpots();
        sfx('select');
        this.time.delayedCall(250, () => this.serveToss(open, sp));
      });
      this.layer.push(z);
    }
    const tip = themeText(this, WIDTH / 2, 470, 'TOUCH A SPOT IN HIS BOX', { size: 12, color: TC.white, font: 'display' }).setDepth(9300);
    this.layer.push(tip);
  }

  /** The underhand padel serve: the ball dropped, its bounce, the hit as it comes up (the ring closes on it). */
  private serveToss(open: ServeSpot, spot: ServeSpot): void {
    this.clearLayer();
    this.hint('TOUCH WHEN THE RING\nCLOSES ON THE BALL');
    const c = this.heroView.contact(0.75);
    const dropMs = 520;
    const due = 1150;
    const t0 = this.time.now;
    this.hitDueAt = t0 + due;
    this.ball.setVisible(true);
    this.ballShadow.setVisible(true);
    this.heroView.prep('fhPrep', 0.6);
    const ring = this.add.graphics().setDepth(9200);
    this.layer.push(ring);
    const sweet = tossWindow(this.hero) * 0.4;
    let done = false;
    // dropped from 1.2 m, bounces, comes up to 0.8 m at `due`
    const ballH = (ms: number): number => {
      if (ms < dropMs) return 1.2 * (1 - (ms / dropMs) ** 2);
      const u = Math.min(1.6, (ms - dropMs) / (due - dropMs));
      return Math.max(0, 0.8 * (2 * u - u * u));
    };
    const hit = (offMs: number | null): void => {
      if (done) return;
      done = true;
      tick.remove();
      ring.clear();
      const q = tossQuality(this.hero, offMs);
      const out = serveOutcome(open, spot, q, Math.random);
      if (offMs !== null) {
        this.heroView.stroke('fh', 0.6);
        sfx('hit');
      }
      const from = { ...c, h: Math.max(0.25, ballH(Math.min(this.time.now - t0, due + 300))) };
      const aim = serveSpotAt(spot, this.lane());
      const ang = Math.random() * Math.PI * 2;
      const err = (1 - q) * 1.0;
      const land = { x: aim.x + Math.cos(ang) * err, z: NET_Z - aim.depth + Math.sin(ang) * err * 0.6, h: 0 };
      if (out.tier === 'fault') {
        if (offMs === null) {
          this.flyArc({ ...c, h: 0.1 }, { x: c.x + 0.3, z: c.z + 0.6, h: 0 }, 0.2, () => this.serveDone(0, 'MISSED', false));
          return;
        }
        this.flyArc(from, { x: land.x * 0.5, z: NET_Z + 0.1, h: 0.4 }, 0.3, () => this.serveDone(out.points, 'FAULT', false), 85);
        return;
      }
      this.flyArc(from, land, 1.0, () => {
        const rv = this.rival!;
        const meet = { x: land.x + (rv.x - land.x) * 0.6, z: land.z - 1.6, h: 0.9 };
        const fh = meet.x < rv.x;
        this.flyArc(land, meet, 0.3, () => {
          if (out.tier === 'ace') {
            rv.react([[260, { ...POSES.ready, crouch: 10 }, inOut]]);
            this.flyArc(meet, { x: meet.x, z: 0.1, h: 0.8 }, 0.1, () => this.serveDone(out.points, 'ACE! +100', true), 85);
            return;
          }
          rv.stroke(fh ? 'fh' : 'bh', meet.h);
          sfx('hit');
          const lane = this.lane();
          if (out.tier === 'weak') this.flyArc(meet, { x: lane * 1, z: NET_Z + 2.6, h: 0 }, 5.5, () => this.serveDone(out.points, 'WEAK RETURN +70', true));
          else if (out.tier === 'average') this.flyArc(meet, { x: 0, z: NET_Z + 6, h: 0 }, 2.4, () => this.serveDone(out.points, '+30', true));
          else this.flyArc(meet, { x: lane * 1.4, z: NET_Z + 8.6, h: 0 }, 0.9, () => this.serveDone(out.points, 'HE WAS READY', false), 55);
        }, 85);
      }, 85);
    };
    const tick = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const ms = this.time.now - t0;
        const b = { ...c, h: ballH(ms) };
        this.placeBall(b.x, b.z, b.h);
        if (ms > dropMs * 0.5) this.ringOn(ring, b, ms - dropMs * 0.5, due - dropMs * 0.5, sweet);
        if (ms > due + tossWindow(this.hero) + 150) hit(null);
      },
    });
    const tap = this.add.zone(0, 0, WIDTH, HEIGHT).setOrigin(0, 0).setDepth(9025).setInteractive();
    this.layer.push(tap);
    tap.on('pointerdown', () => hit(this.time.now - t0 - due));
    this.layer.push({ destroy: () => tick.remove() } as unknown as Phaser.GameObjects.GameObject);
  }

  private serveDone(points: number, label: string, good: boolean): void {
    this.score += points;
    this.updateHud();
    const p = project(this.rival!.x, this.rival!.z);
    this.popup(p.x, p.y - 50, label, good);
    sfx(points > 0 ? 'point' : 'select');
    if (points >= 70) this.time.delayedCall(250, () => this.heroView.cheer());
    this.round++;
    this.time.delayedCall(1100, () => this.nextRound());
  }

  /** He serves: slow motion to the bounce, the kind of serve is named, the player picks the return and hits it on time. */
  private returnRound(r: ReturnRound): void {
    const lane = this.lane();
    const rv = this.rival!;
    this.heroView.runTo(lane * 2.7, 18.4, 420);
    rv.runTo(-lane * 2.4, 0.5, 420, () => {
      this.hint('HE SERVES');
      const a = serveSpotAt(r.spot, lane === 1 ? -1 : 1);
      const land = { x: a.x, z: NET_Z + a.depth, h: 0 };
      const from = rv.contact(0.7);
      rv.prep('fhPrep', 0.6);
      this.time.delayedCall(300, () => {
        rv.stroke('fh', 0.6);
        sfx('hit');
        this.flyArc(from, land, r.kind === 'kick' ? 2.0 : r.kind === 'slice' ? 1.0 : 0.6, () => this.askReturn(r, land), 220);
        this.time.delayedCall(500, () => rv.runTo(-lane * 1.2, NET_Z - 2.6, 900));
      });
    });
  }

  private askReturn(r: ReturnRound, land: { x: number; z: number; h: number }): void {
    this.clearLayer();
    const name = r.kind === 'kick' ? 'HIGH KICK' : r.kind === 'slice' ? 'LOW SLICE' : 'FAST & FLAT';
    const big = themeText(this, WIDTH / 2, 432, name, { size: 22, color: 0xffe066, font: 'display' }).setDepth(9300);
    this.layer.push(big);
    const parts: Phaser.GameObjects.GameObject[] = [];
    const labels: Record<ReturnShot, string> = { lob: 'LOB', chiquita: 'CHIQUITA', glass: 'OFF GLASS' };
    RETURN_SHOTS.forEach((k, i) => {
      const b = makeThemeButton(this, 64 + i * 116, 490, 108, 44, labels[k], () => {
        if (this.busy) return;
        this.busy = true;
        for (const o of parts) o.destroy();
        this.hitReturn(r, k, land);
      }, 'blue', 14);
      for (const o of b.parts) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(9300);
      parts.push(...(b.parts as Phaser.GameObjects.GameObject[]));
    });
    this.layer.push(...parts);
  }

  private hitReturn(r: ReturnRound, shotK: ReturnShot, land: { x: number; z: number; h: number }): void {
    this.clearLayer();
    this.hint('TOUCH WHEN THE RING\nCLOSES ON THE BALL');
    const lane = this.lane();
    const glass = shotK === 'glass';
    const hx = Math.max(-4.3, Math.min(4.3, land.x + (r.spot === 'wide' ? lane * 0.6 : 0)));
    const meet = { x: hx, z: glass ? 19.0 : Math.min(18.6, land.z + 2.2), h: r.kind === 'kick' ? 1.4 : r.kind === 'slice' ? 0.45 : 0.9 };
    const bh = meet.x - this.heroView.x < -0.2;
    this.heroView.runTo(meet.x - (bh ? -0.55 : 0.5), meet.z + 0.35, Math.min(500, r.closeMs * 0.4), () => this.heroView.prep(bh ? 'bhPrep' : 'fhPrep', meet.h));
    const ring = this.add.graphics().setDepth(9200);
    this.layer.push(ring);
    const t0 = this.time.now;
    this.hitDueAt = t0 + r.closeMs;
    const sweet = returnWindow(this.hero) * 0.4;
    let done = false;
    const apex = r.kind === 'kick' ? 1.4 : r.kind === 'slice' ? 0.2 : 0.5;
    const at = (ms: number): { x: number; z: number; h: number } => {
      const u = ms / r.closeMs;
      const uu = Math.min(1, u);
      return { x: land.x + (meet.x - land.x) * u, z: land.z + (meet.z - land.z) * u, h: meet.h * uu + 4 * apex * uu * (1 - uu) };
    };
    const end = (offMs: number | null): void => {
      if (done) return;
      done = true;
      tick.remove();
      ring.clear();
      const res = returnResult(this.hero, r, shotK, offMs);
      const from = at(Math.min(this.time.now - t0, r.closeMs * 1.2));
      if (offMs !== null) {
        this.heroView.stroke(bh ? 'bh' : 'fh', meet.h);
        sfx('hit');
      }
      const label = res.tier === 'winner' ? `GREAT +${res.points}` : res.tier === 'good' ? `GOOD +${res.points}` : res.tier === 'weak' ? `+${res.points}` : 'MISSED';
      const finish = (): void => {
        this.score += res.points;
        this.updateHud();
        const p = project(from.x, from.z, 2);
        this.popup(p.x, p.y - 30, label, res.points > 0);
        sfx(res.points > 0 ? 'point' : 'select');
        if (res.tier === 'winner') this.time.delayedCall(250, () => this.heroView.cheer());
        this.round++;
        this.time.delayedCall(1100, () => this.nextRound());
      };
      if (res.tier === 'error') {
        this.flyArc(from, offMs === null ? { x: from.x, z: 19.9, h: 0.6 } : { x: from.x * 0.6, z: NET_Z + 0.1, h: 0.4 }, 0.3, finish);
        return;
      }
      const rv = this.rival!;
      const to = shotK === 'lob' ? { x: -lane * 1.5, z: 1.4, h: 0 } : shotK === 'chiquita' ? { x: rv.x + 0.6, z: NET_Z - 1.4, h: 0 } : { x: 0.4, z: 4.5, h: 0 };
      this.flyArc(from, to, shotK === 'lob' ? 6.5 : shotK === 'chiquita' ? 0.9 : 2.2, () => {
        if (res.tier !== 'winner') rv.stroke('fhv', 1);
        finish();
      });
    };
    const tick = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const ms = this.time.now - t0;
        const b = at(Math.min(ms, r.closeMs * 1.25));
        this.placeBall(b.x, b.z, b.h);
        this.ringOn(ring, b, ms, r.closeMs, sweet);
        if (ms > r.closeMs + returnWindow(this.hero) + 150) end(null);
      },
    });
    const tap = this.add.zone(0, 0, WIDTH, HEIGHT).setOrigin(0, 0).setDepth(9025).setInteractive();
    this.layer.push(tap);
    tap.on('pointerdown', () => end(this.time.now - t0 - r.closeMs));
    this.layer.push({ destroy: () => tick.remove() } as unknown as Phaser.GameObjects.GameObject);
  }
}
