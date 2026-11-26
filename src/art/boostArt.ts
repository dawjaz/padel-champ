import type Phaser from 'phaser';

/**
 * The little drawing of a boost on its shop button, centred on (cx, cy) inside a disc about 36 px across (own shapes, no outside art):
 * a bottle of isotonic drink, an energy gel sachet, a roll of grip tape, a tube of fresh balls.
 */
export function drawBoostIcon(g: Phaser.GameObjects.Graphics, id: string, cx: number, cy: number): void {
  const navy = 0x0b2a5b;
  switch (id) {
    case 'isotonic': {
      g.fillStyle(0x2f9bff, 1).fillRoundedRect(cx - 6, cy - 6, 12, 16, 3);
      g.fillStyle(0xbfe3ff, 1).fillRect(cx - 6, cy + 1, 12, 5);
      g.fillStyle(0xffffff, 1).fillRect(cx - 3, cy - 10, 6, 4);
      g.fillStyle(0xff7a1a, 1).fillRect(cx - 4, cy - 12, 8, 3);
      g.lineStyle(1.5, navy, 1).strokeRoundedRect(cx - 6, cy - 6, 12, 16, 3);
      break;
    }
    case 'gel': {
      g.fillStyle(0xff7a1a, 1).fillPoints([{ x: cx - 6, y: cy - 8 }, { x: cx + 6, y: cy - 8 }, { x: cx + 5, y: cy + 9 }, { x: cx - 5, y: cy + 9 }] as Phaser.Geom.Point[], true);
      g.fillStyle(0xffe066, 1).fillRect(cx - 5.5, cy - 2, 11, 5);
      g.fillStyle(navy, 1).fillRect(cx - 6, cy - 10, 12, 3);
      g.lineStyle(1.5, navy, 1).strokePoints([{ x: cx - 6, y: cy - 8 }, { x: cx + 6, y: cy - 8 }, { x: cx + 5, y: cy + 9 }, { x: cx - 5, y: cy + 9 }] as Phaser.Geom.Point[], true);
      break;
    }
    case 'grip_tape': {
      g.fillStyle(0x4ade80, 1).fillCircle(cx, cy, 10);
      g.fillStyle(0xffffff, 1).fillCircle(cx, cy, 4);
      g.lineStyle(1.5, navy, 1).strokeCircle(cx, cy, 10).strokeCircle(cx, cy, 4);
      g.fillStyle(0x4ade80, 1).fillRect(cx + 4, cy + 7, 9, 4);
      g.lineStyle(1.5, navy, 1).strokeRect(cx + 4, cy + 7, 9, 4);
      break;
    }
    default: {
      // fresh balls: two balls with the seam
      const ball = (x: number, y: number): void => {
        g.fillStyle(0xd7f542, 1).fillCircle(x, y, 7);
        g.lineStyle(1.3, 0xffffff, 1).beginPath().arc(x - 7, y, 6.5, -0.9, 0.9).strokePath();
        g.beginPath().arc(x + 7, y, 6.5, Math.PI - 0.9, Math.PI + 0.9).strokePath();
        g.lineStyle(1.5, navy, 1).strokeCircle(x, y, 7);
      };
      ball(cx - 4, cy + 3);
      ball(cx + 4, cy - 4);
    }
  }
}
