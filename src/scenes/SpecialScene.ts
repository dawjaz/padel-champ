import Phaser from 'phaser';
import { WIDTH } from '../config';
import { SHOTS, SPECIALS } from '../game/catalog';
import type { ShotDef } from '../game/types';
import { levelOf } from '../career/profile';
import { getSave } from '../save';
import { applyLightScreen, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

/** The little emblem of a special shot (own shapes): a rocket, a snake's curve, a corner, a snowflake. */
function drawEmblem(g: Phaser.GameObjects.Graphics, id: string, cx: number, cy: number, on: boolean): void {
  const fill = on ? 0xffc83d : 0xc9d3e2;
  const ink = on ? TC.navy : 0x8d9bb0;
  g.fillStyle(fill, 1).fillCircle(cx, cy, 22);
  g.lineStyle(2, ink, 1).strokeCircle(cx, cy, 22);
  g.lineStyle(3, ink, 1);
  if (id === 'sp_skyrocket') {
    g.fillStyle(ink, 1).fillTriangle(cx, cy - 13, cx - 6, cy - 3, cx + 6, cy - 3);
    g.fillRect(cx - 4, cy - 3, 8, 12);
    g.fillStyle(0xff6b2a, 1).fillTriangle(cx - 4, cy + 9, cx + 4, cy + 9, cx, cy + 16);
  } else if (id === 'sp_venom') {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push(new Phaser.Math.Vector2(cx - 12 + 24 * t, cy + Math.sin(t * Math.PI * 2) * 7));
    }
    g.strokePoints(pts);
    g.fillStyle(ink, 1).fillCircle(cx + 12, cy, 3);
  } else if (id === 'sp_cornerlock') {
    g.lineBetween(cx - 11, cy - 11, cx + 11, cy - 11);
    g.lineBetween(cx + 11, cy - 11, cx + 11, cy + 11);
    g.fillStyle(ink, 1).fillCircle(cx + 6, cy - 6, 4);
  } else {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      g.lineBetween(cx - Math.cos(a) * 12, cy - Math.sin(a) * 12, cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
    }
  }
}

/**
 * The hero's special shots: the four of the game, unlocked by level and all kept (a portfolio that grows); the match offers each one the ball allows. All
 * of them can be tried on the Practice Court, whatever the level.
 */
export class SpecialScene extends Phaser.Scene {
  private dyn: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('SpecialScene');
  }

  create(): void {
    applyLightScreen(this);
    screenHeader(this, 'Special shot', { onBack: () => this.scene.start('CharacterScene') });
    makeThemeButton(this, WIDTH / 2, 612, 300, 44, 'TRY THEM ON THE PRACTICE COURT', () => this.scene.start('MatchScene', { practice: 'court', career: null }), 'blue', 14);
    this.redraw();
  }

  private redraw(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const p = getSave().profile;
    const level = levelOf(p.xp);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.dyn.push(o);
      return o;
    };
    add(themeText(this, WIDTH / 2, 80, 'Every level opens a new special shot and you keep them all.\nEach costs a lot of G and only works from its own ball.', { size: 11, color: TC.sub, align: 'center' }));
    const sorted = [...SPECIALS].sort((a, b) => (a.unlockLevel ?? 0) - (b.unlockLevel ?? 0));
    sorted.forEach((sp: ShotDef, i) => {
      const y = 108 + i * 118;
      const open = level >= (sp.unlockLevel ?? 0);
      const on = open;
      const card = add(this.add.graphics().setPosition(12, y));
      drawCard(card, WIDTH - 24, 108, { fill: on ? 0xfff4cf : open ? 0xffffff : 0xf1f4f8, stroke: on ? 0xc98a00 : TC.navy });
      const emb = add(this.add.graphics());
      drawEmblem(emb, sp.id, 48, y + 36, open);
      add(themeText(this, 82, y + 22, sp.name.toUpperCase(), { size: 17, font: 'display', color: open ? TC.navy : 0x8d9bb0, origin: [0, 0.5] }));
      const base = SHOTS.find((s) => s.id === sp.base);
      add(themeText(this, 82, y + 42, `${base ? base.name.toUpperCase() : ''} · COSTS ${sp.cost} G`, { size: 10, color: TC.orange, font: 'display', origin: [0, 0.5] }));
      const desc = (sp as ShotDef & { desc?: string }).desc?.replace(/^Special\. /, '') ?? '';
      add(themeText(this, 24, y + 76, desc, { size: 10, color: open ? TC.navy : 0x8d9bb0, origin: [0, 0.5], wrap: WIDTH - 140, align: 'left' }));
      if (!open) {
        add(themeText(this, WIDTH - 66, y + 36, `LEVEL ${sp.unlockLevel}`, { size: 13, font: 'display', color: 0x8d9bb0 }));
        add(themeText(this, WIDTH - 66, y + 54, 'LOCKED', { size: 10, color: 0x8d9bb0 }));
      } else {
        add(themeText(this, WIDTH - 66, y + 40, 'YOURS', { size: 14, font: 'display', color: 0xb07700 }));
      }
    });
  }
}
