import type { Appearance } from '../../game/types';
import { buildCharacter, OUTLINE_COLOR, SPRITE_H, SPRITE_W, type Facing, type Op } from '../character';
import { shade } from '../palette';

/**
 * Smooth "128-bit era" version of the same characters: the shapes of `buildCharacter` (so every look,
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
  roundedRect(g, (op.x - grow) * s, (op.y - grow) * s, w, h, Math.min(w, h) * 0.34);
}

function fillFor(g: CanvasRenderingContext2D, op: Op, s: number): CanvasGradient {
  if (op.kind === 'disc') {
    // Light from the top left: a round, glossy volume.
    const gr = g.createRadialGradient(
      (op.cx - op.rx * 0.35) * s,
      (op.cy - op.ry * 0.4) * s,
      op.rx * 0.1 * s,
      op.cx * s,
      op.cy * s,
      Math.max(op.rx, op.ry) * 1.1 * s,
    );
    gr.addColorStop(0, css(shade(op.color, 1.28)));
    gr.addColorStop(0.55, css(op.color));
    gr.addColorStop(1, css(shade(op.color, 0.8)));
    return gr;
  }
  const gr = g.createLinearGradient(op.x * s, op.y * s, (op.x + op.w) * s, (op.y + op.h) * s);
  gr.addColorStop(0, css(shade(op.color, 1.14)));
  gr.addColorStop(1, css(shade(op.color, 0.86)));
  return gr;
}

export function renderCharacterCanvas(a: Appearance, facing: Facing, s = HD_CHARACTER_SCALE): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_W * s;
  canvas.height = SPRITE_H * s;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('2D canvas is not available');
  const ops = buildCharacter(a, facing);

  // Pass 1: dark outline, every shape grown a little.
  g.fillStyle = css(OUTLINE_COLOR);
  for (const op of ops) {
    shapePath(g, op, s, 0.9);
    g.fill();
  }
  // Pass 2: shaded fills.
  for (const op of ops) {
    shapePath(g, op, s, 0);
    g.fillStyle = fillFor(g, op, s);
    g.fill();
  }
  // Pass 3: overall light: bright top, darker feet (only where something was drawn).
  g.globalCompositeOperation = 'source-atop';
  const light = g.createLinearGradient(0, 0, 0, canvas.height);
  light.addColorStop(0, 'rgba(255,255,255,0.14)');
  light.addColorStop(0.5, 'rgba(255,255,255,0)');
  light.addColorStop(1, 'rgba(0,0,30,0.26)');
  g.fillStyle = light;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.globalCompositeOperation = 'source-over';
  return canvas;
}
