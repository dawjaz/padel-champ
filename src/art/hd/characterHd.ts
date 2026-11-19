import type { Appearance } from '../../game/types';
import { buildCharacter, OUTLINE_COLOR, SPRITE_H, SPRITE_W, type Facing, type Op } from '../character';
import { shade } from '../palette';

/**
 * MODERN RETRO version (flat colours, hard two-tone shading, thick outline) -- smooth "128-bit era" original of the same characters: the shapes of `buildCharacter` (so every look,
 * outfit and later equipment works unchanged) drawn at high resolution as rounded, shaded, outlined
 * toon shapes instead of hard pixels. Pure Canvas2D, no Phaser, so it can be checked in any browser.
 */
export const HD_CHARACTER_SCALE = 6;

const css = (c: number): string => '#' + c.toString(16).padStart(6, '0');

function roundedRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function shapePath(g: CanvasRenderingContext2D, op: Op, s: number, grow: number): void {
  if (op.kind === 'disc') {
    g.beginPath();
    g.ellipse(op.cx * s, op.cy * s, (op.rx + grow) * s, (op.ry + grow) * s, 0, 0, Math.PI * 2);
    return;
  }
  const w = (op.w + 2 * grow) * s;
  const h = (op.h + 2 * grow) * s;
  roundedRect(g, (op.x - grow) * s, (op.y - grow) * s, w, h, Math.min(w, h) * 0.16);
}

export function renderCharacterCanvas(a: Appearance, facing: Facing, s = HD_CHARACTER_SCALE): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_W * s;
  canvas.height = SPRITE_H * s;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('2D canvas is not available');
  const ops = buildCharacter(a, facing);

  // Pass 1: thick dark outline with a hard drop shadow to the lower right.
  g.fillStyle = 'rgba(10,0,40,0.55)';
  for (const op of ops) {
    g.save();
    g.translate(0.9 * s, 0.9 * s);
    shapePath(g, op, s, 1.1);
    g.fill();
    g.restore();
  }
  g.fillStyle = css(OUTLINE_COLOR);
  for (const op of ops) {
    shapePath(g, op, s, 1.1);
    g.fill();
  }
  // Pass 2: flat colour, then one hard shadow tone on the lower right and a small highlight.
  for (const op of ops) {
    shapePath(g, op, s, 0);
    g.fillStyle = css(op.color);
    g.fill();
    g.save();
    shapePath(g, op, s, 0);
    g.clip();
    g.fillStyle = css(shade(op.color, 0.74));
    if (op.kind === 'disc') {
      g.beginPath();
      g.rect((op.cx - op.rx) * s, (op.cy - op.ry) * s, op.rx * 2 * s, op.ry * 2 * s);
      g.ellipse((op.cx - op.rx * 0.22) * s, (op.cy - op.ry * 0.22) * s, op.rx * 1.05 * s, op.ry * 1.05 * s, 0, 0, Math.PI * 2, true);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.beginPath();
      g.ellipse((op.cx - op.rx * 0.38) * s, (op.cy - op.ry * 0.45) * s, op.rx * 0.2 * s, op.ry * 0.14 * s, -0.5, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(op.x * s, (op.y + op.h * 0.68) * s, op.w * s, op.h * 0.32 * s);
    }
    g.restore();
  }
  return canvas;
}
