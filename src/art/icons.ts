// Small vector icons for the menu screens (gear slots, attributes, coins, boosts), drawn with Phaser Graphics.
// Each icon fits a square of `size` px centred on (x, y). No assets needed.

import type Phaser from 'phaser';

export type IconKind =
  | 'head' | 'top' | 'shorts' | 'shoes' | 'racket' | 'wristband' | 'bag' | 'balls'
  | 'power' | 'spin' | 'technique' | 'accuracy' | 'stamina' | 'speed' | 'defense'
  | 'coin' | 'boost' | 'trophy' | 'star';

export function drawIcon(g: Phaser.GameObjects.Graphics, kind: IconKind, x: number, y: number, size: number, color: number): void {
  const u = size / 16; // 16 design units
  const X = (v: number): number => x + (v - 8) * u;
  const Y = (v: number): number => y + (v - 8) * u;
  const dark = 0x0d1030;
  g.fillStyle(color, 1);
  g.lineStyle(Math.max(1, u * 1.4), color, 1);
  const poly = (pts: number[][], fill = true): void => {
    g.beginPath();
    pts.forEach(([a, b], i) => (i === 0 ? g.moveTo(X(a), Y(b)) : g.lineTo(X(a), Y(b))));
    g.closePath();
    if (fill) g.fillPath();
    else g.strokePath();
  };
  switch (kind) {
    case 'head': // cap
      g.fillEllipse(X(7), Y(9), 12 * u, 9 * u);
      g.fillRect(X(7), Y(9), 9 * u, 2.4 * u);
      g.fillStyle(dark, 0.5);
      g.fillRect(X(2), Y(10.6), 6 * u, 1 * u);
      break;
    case 'top': // shirt
      poly([[5, 2], [8, 4], [11, 2], [15, 5], [13, 8], [11.5, 7], [11.5, 14], [4.5, 14], [4.5, 7], [3, 8], [1, 5]]);
      break;
    case 'shorts':
      poly([[3, 3], [13, 3], [14, 13], [9, 13], [8, 8], [7, 13], [2, 13]]);
      break;
    case 'shoes':
      poly([[2, 5], [6, 5], [7, 8], [12, 9], [14, 12], [14, 13], [2, 13]]);
      g.fillStyle(dark, 0.55);
      g.fillRect(X(2), Y(12), 12 * u, 1.4 * u);
      break;
    case 'racket':
      g.strokeEllipse(X(7), Y(6), 9 * u, 11 * u);
      g.fillStyle(color, 0.35);
      g.fillEllipse(X(7), Y(6), 9 * u, 11 * u);
      g.fillStyle(color, 1);
      g.fillRect(X(6), Y(11), 2 * u, 5 * u);
      break;
    case 'wristband':
      g.fillRoundedRect(X(3), Y(5), 10 * u, 6 * u, 2 * u);
      g.fillStyle(dark, 0.45);
      g.fillRect(X(3), Y(7), 10 * u, 1.2 * u);
      break;
    case 'bag':
      g.fillRoundedRect(X(2), Y(6), 12 * u, 8 * u, 2 * u);
      g.strokeRoundedRect(X(5), Y(2.5), 6 * u, 5 * u, 2 * u);
      g.fillStyle(dark, 0.5);
      g.fillRect(X(7), Y(9), 2 * u, 2 * u);
      break;
    case 'balls':
      g.fillCircle(X(5.5), Y(10), 4 * u);
      g.fillCircle(X(10.5), Y(10), 4 * u);
      g.fillCircle(X(8), Y(5.5), 4 * u);
      g.lineStyle(Math.max(1, u), dark, 0.6);
      g.beginPath();
      g.arc(X(8), Y(5.5), 3 * u, 0.4, 2.6);
      g.strokePath();
      break;
    case 'power': // lightning
      poly([[9, 1], [3, 9], [7.5, 9], [6, 15], [13, 6.5], [8.5, 6.5]]);
      break;
    case 'spin': // spiral arrows
      g.beginPath();
      g.arc(X(8), Y(8), 5 * u, 0.4, 5.2);
      g.strokePath();
      poly([[11, 1], [14, 6], [8, 6]]);
      break;
    case 'technique': // star
      poly([[8, 1], [10, 6], [15, 6], [11, 9.5], [12.5, 15], [8, 11.5], [3.5, 15], [5, 9.5], [1, 6], [6, 6]]);
      break;
    case 'accuracy': // target
      g.strokeCircle(X(8), Y(8), 6.5 * u);
      g.strokeCircle(X(8), Y(8), 3.5 * u);
      g.fillCircle(X(8), Y(8), 1.5 * u);
      break;
    case 'stamina': // heart
      g.fillCircle(X(5), Y(6), 3.6 * u);
      g.fillCircle(X(11), Y(6), 3.6 * u);
      poly([[1.6, 7.5], [14.4, 7.5], [8, 14.5]]);
      break;
    case 'speed': // wing / chevrons
      poly([[1, 3], [6, 8], [1, 13], [4, 13], [9, 8], [4, 3]]);
      poly([[7, 3], [12, 8], [7, 13], [10, 13], [15, 8], [10, 3]]);
      break;
    case 'defense': // shield
      poly([[8, 1], [14, 3], [13.5, 9], [8, 15], [2.5, 9], [2, 3]]);
      g.fillStyle(dark, 0.4);
      poly([[8, 4], [11.5, 5], [11, 8.5], [8, 12]]);
      break;
    case 'coin':
      g.fillCircle(X(8), Y(8), 7 * u);
      g.fillStyle(dark, 0.45);
      g.fillCircle(X(8), Y(8), 5 * u);
      g.fillStyle(color, 1);
      g.fillRect(X(7.2), Y(4.5), 1.6 * u, 7 * u);
      break;
    case 'boost': // bottle / drop
      poly([[8, 1.5], [12.5, 8], [11.5, 12], [8, 14.5], [4.5, 12], [3.5, 8]]);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(X(6.5), Y(9), 1.6 * u);
      break;
    case 'star': // five-point star with a dark outline, for "new"
      {
        const pts: number[][] = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 === 0 ? 7.6 : 3.2;
          pts.push([8 + Math.cos(a) * r, 8 + Math.sin(a) * r]);
        }
        g.fillStyle(dark, 0.9);
        g.beginPath();
        pts.forEach(([a, b], i) => (i === 0 ? g.moveTo(X(8 + (a - 8) * 1.22), Y(8 + (b - 8) * 1.22)) : g.lineTo(X(8 + (a - 8) * 1.22), Y(8 + (b - 8) * 1.22))));
        g.closePath();
        g.fillPath();
        g.fillStyle(color, 1);
        poly(pts);
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(X(6.6), Y(6.2), 1.1 * u);
      }
      break;
    case 'trophy':
      g.fillRoundedRect(X(4), Y(2), 8 * u, 7 * u, 2 * u);
      g.strokeCircle(X(3.5), Y(5), 2 * u);
      g.strokeCircle(X(12.5), Y(5), 2 * u);
      g.fillRect(X(7), Y(9), 2 * u, 3 * u);
      g.fillRect(X(4.5), Y(12), 7 * u, 2.4 * u);
      break;
  }
}

/** The outline of a racket head by shape, for the GEAR list: a small side-on silhouette with a handle, centred on (x, y). */
export function drawRacketShape(g: Phaser.GameObjects.Graphics, shape: 'diamond' | 'teardrop' | 'round' | undefined, x: number, y: number, size: number, color: number): void {
  const u = size / 20;
  g.fillStyle(color, 1);
  g.lineStyle(Math.max(1.4, u * 1.6), color, 1);
  const P = (px: number, py: number): { x: number; y: number } => ({ x: x + px * u, y: y + py * u });
  const poly = (pts: Array<[number, number]>): void => {
    g.beginPath();
    pts.forEach(([a, b], i) => (i === 0 ? g.moveTo(P(a, b).x, P(a, b).y) : g.lineTo(P(a, b).x, P(a, b).y)));
    g.closePath();
    g.strokePath();
  };
  if (shape === 'round') g.strokeCircle(P(0, -3).x, P(0, -3).y, 6.8 * u);
  else if (shape === 'diamond') poly([[0, -10], [6.5, -5], [5, -1.5], [0, 3], [-5, -1.5], [-6.5, -5], [-3.2, -9.2]]);
  else poly([[0, -10.5], [5.4, -7.5], [5.8, -3.5], [2.2, 2.6], [-2.2, 2.6], [-5.8, -3.5], [-5.4, -7.5]]);
  g.fillRect(P(-1, 3).x, P(-1, 3).y, 2 * u, 7 * u);
}
